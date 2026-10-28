# -*- coding: utf-8 -*-
# `music: film` acceptance (DESIGN.md §B): spec defaults, the score on the grid, the end card's silence-then-hit, the
# intro on the downbeat grid, break dips, --audio QA on a real film's frames, and old styles byte-identical to the live skill.
import os, sys, json, re, glob, shutil, subprocess, hashlib
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness as H
import evals as E

JOBS = os.path.join(H.ACC, 'jobs')
FILM_SAMPLE = os.path.join(H.LAUNCH, 'film-sample')
BASE = os.path.join(H.ACC, 'baselines', 'live-audio')
PROBE_YAML = '''# acceptance spec probe
title: Acceptance probe
brand: {name: Probe}
aspects: [16x9]
music: %s
shots:
  - {id: a, block: headline, beats: 8, text: "One *two.*"}
  - {id: b, block: headline, beats: 8, text: "Three *four.*"}
  - {id: c, block: endcard, beats: 6, name: Probe, cast: 0}
'''


class Film(object):
    def __init__(self, skill, run_dir, report, tag='', deny=()):
        self.S, self.dir, self.R, self.tag, self.deny = skill, run_dir, report, tag, tuple(deny)
        os.makedirs(run_dir, exist_ok=True)
        self.log = os.path.join(run_dir, 'film-runs.log')

    def node(self, args, timeout=1800, cwd=None):
        e = H.base_env(home=H.REAL_HOME, tmp=os.path.join(self.dir, 'tmp'), locale_c=False)
        return H.run([H.NODE] + list(args), env=e, cwd=cwd or self.dir, timeout=timeout, deny_write=self.deny, log=self.log)

    def build(self, job, out, master=False, skill=None):
        if os.path.exists(out): shutil.rmtree(out)
        r = self.node([os.path.join(H.LIB, 'build_audio.mjs'), skill or self.S, job, out] + (['--master'] if master else []))
        try: info = json.loads(r.out.strip().splitlines()[-1])
        except Exception: info = {'error': r.brief(300)}
        return info

    def probe(self, job, skill=None):
        r = self.node([os.path.join(H.LIB, 'build_audio.mjs'), skill or self.S, job, '-', '--probe'])
        try: return json.loads(r.out.strip().splitlines()[-1])
        except Exception: return {'error': r.brief(300)}

    def tempo(self, f, skill=None):
        r = self.node([os.path.join(skill or self.S, 'video', 'lv.mjs'), '--tempo', f], timeout=600)
        return E.parse_tempo(r.text), r

    def add(self, cid, ok, det):
        self.R.add(cid, ok, det, self.tag)

    # ── spec.mjs: STYLES has film, key F, 87 BPM ──
    def spec(self):
        d = os.path.join(self.dir, 'probe'); res = {}
        for name, m in (('default', '{style: film}'), ('grid', '{style: film, bpm: 87.46, downbeat: 0.3905}'), ('bad', '{style: filmx}'), ('keynote', '{style: keynote}')):
            j = os.path.join(d, name); os.makedirs(j, exist_ok=True)
            open(os.path.join(j, 'beats.yaml'), 'w', encoding='utf-8').write(PROBE_YAML % m)
            res[name] = self.probe(j)
        g = self.node([os.path.join(self.S, 'video', 'lv.mjs'), '--job', os.path.join(d, 'default'), '--grid'])
        self.add('film.spec-defaults', *self.eval_spec(res, g))

    @staticmethod
    def eval_spec(res, g):
        bad = []
        dflt, grid, badr, key = res['default'], res['grid'], res['bad'], res['keynote']
        if 'error' in dflt: return False, 'music: {style: film} rejected: %s' % dflt['error']
        if dflt['music'].get('style') != 'film': bad.append('style %s' % dflt['music'].get('style'))
        if dflt.get('bpm') != 87: bad.append('default bpm %s (want 87)' % dflt.get('bpm'))
        if dflt['music'].get('key') != 'F': bad.append('default key %s (want F)' % dflt['music'].get('key'))
        if 'error' in grid or abs(grid.get('bpm', 0) - 87.46) > 1e-9 or abs(grid['music'].get('downbeat', -1) - .3905) > 1e-9: bad.append('explicit bpm/downbeat not honoured: %s' % (grid.get('error') or (grid.get('bpm'), grid['music'].get('downbeat'))))
        if 'error' not in badr or 'film' not in badr['error']: bad.append('an unknown style is not refused with a list that includes film (%s)' % badr.get('error', 'accepted'))
        if 'error' in key or key.get('bpm') != 124 or key['music'].get('key') != 'D': bad.append('keynote defaults changed: %s' % (key.get('error') or (key.get('bpm'), key['music'].get('key'))))
        if not re.search(r'\b87 BPM', g.text): bad.append('lv.mjs --grid doesn\'t show 87 BPM (%s)' % g.brief(120))
        return not bad, '; '.join(bad) or 'style film accepted; defaults 87 BPM, key F; bpm/downbeat honoured; unknown styles refused (list includes film); keynote still 124/D; --grid shows 87 BPM'

    # ── the score itself (film-sample at the reference grid + an end card) ──
    def score(self):
        job = os.path.join(JOBS, 'film-grid'); out = os.path.join(self.dir, 'film-grid')
        info = self.build(job, out, master=True)
        if 'error' in info:
            for cid in ('film.grid', 'film.endcard', 'film.intro-grid', 'film.breaks', 'film.no-endcard'): self.add(cid, False, 'film-grid job did not build: %s' % info['error'])
            return
        br = json.load(open(os.path.join(out, 'brief.json'), encoding='utf-8'))
        tm, r = self.tempo(os.path.join(out, 'master.wav'))
        self.add('film.grid', *E.tempo_on_grid(tm, 87.46, .3905))
        x = H.decode_audio(os.path.join(out, 'music.wav'), sr=44100)
        self.add('film.endcard', *self.eval_endcard(x, 44100, br['endcard'], br['dur']))
        drop = next(s['start'] for s in br['shots'] if s['id'] == 'brief'); vb = next(s for s in br['shots'] if s['id'] == 'voice')
        self.add('film.intro-grid', *self.eval_intro(x, 44100, .3905, 60 / 87.46, drop, br['endcard']))
        self.add('film.breaks', *self.eval_break(x, 44100, drop, (vb['start'], vb['end']), br['endcard']))
        job2 = os.path.join(JOBS, 'film-noend'); out2 = os.path.join(self.dir, 'film-noend')
        info2 = self.build(job2, out2)
        if 'error' in info2: return self.add('film.no-endcard', False, info2['error'])
        x2 = H.decode_audio(os.path.join(out2, 'music.wav'), sr=44100)
        self.add('film.no-endcard', *self.eval_noend(x2, 44100, info2['dur'], 60 / 87.46))

    @staticmethod
    def eval_endcard(x, sr, end, dur):
        if end is None: return False, 'the job has no end card'
        q = E.rms_db(x, sr, end - .40, end - .005)
        on = E.first_onset_after(x, sr, end - .05, end + .4)
        ring = E.rms_db(x, sr, end + .5, min(dur, end + 1.0))
        bad = []
        if q > -50: bad.append('music stem %.1f dBFS RMS in the 0.40 s before the end card (want < −50)' % q)
        if on is None or not (-.01 <= on - end <= .03): bad.append('no hit on the end card (first onset %s s, end card %.3f s)' % (on, end))
        if ring < -45: bad.append('nothing rings out after the hit (%.1f dBFS 0.5–1.0 s after)' % ring)
        return not bad, '; '.join(bad) or 'no music.hit: %.1f dBFS in the 0.40 s before the end card at %.3f s; the hit on the card (%+.0f ms); rings out at %.1f dBFS' % (q, end, (on - end) * 1000, ring)

    @staticmethod
    def eval_intro(x, sr, downbeat, beat, drop, end):
        t, s = E.onsets(x, sr)
        it = t[(t > .15) & (t < drop - .1)]
        if len(it) < 6: return False, 'only %d intro onsets before the drop at %.2f s' % (len(it), drop)
        err = E.grid_err(it, downbeat, beat, 4)
        low_i = E.band_db(x, sr, .3, drop - .2, 30, 150); low_g = E.band_db(x, sr, drop + .5, end - 1.5, 30, 150)
        bad = []
        if np.median(err) > .008: bad.append('intro onsets sit %.1f ms (median) off the 16th grid from the downbeat %.4f s' % (np.median(err) * 1000, downbeat))
        if low_g - low_i < 12: bad.append('intro low end only %.1f dB under the groove (want ≥ 12: pad + shaker, no kick/bass)' % (low_g - low_i))
        return not bad, '; '.join(bad) or '%d intro onsets, median %.1f ms off the 16th grid anchored at %.4f s; intro low end %.1f dB under the groove' % (len(it), np.median(err) * 1000, downbeat, low_g - low_i)

    @staticmethod
    def eval_break(x, sr, drop, brk, end):
        low_b = E.band_db(x, sr, brk[0] + .1, brk[1] - .3, 30, 150); low_g = E.band_db(x, sr, drop + .5, end - 1.5, 30, 150)
        ok = low_g - low_b >= 12
        return ok, 'break shot "voice" %.2f–%.2f s: low end %.1f dB under the groove (want ≥ 12: pad + shaker only)' % (brk[0], brk[1], low_g - low_b)

    @staticmethod
    def eval_noend(x, sr, dur, beat):
        last = E.rms_db(x, sr, dur - 4 * beat, dur - .05)
        hop = int(.01 * sr); n = len(x) // hop
        db = 20 * np.log10(np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(1)) + 1e-12)
        tail = db[int((dur - 2.0) / .01):]
        run = mx = 0
        for v in tail:
            run = run + 1 if v < -50 else 0; mx = max(mx, run)
        ok = last > -40 and mx * .01 < .3
        return ok, 'no end card: last bar %.1f dBFS, longest silence in the last 2 s %.2f s (want the music to ring out, no end-card gap)' % (last, mx * .01)

    # ── music.hit (lead, 2026-10-22): the hit's offset after the end card's first frame, −1…2 s, default 0 ──
    def hit(self):
        base = os.path.join(JOBS, 'film-grid'); d = os.path.join(self.dir, 'hit'); res = {}
        for name, val in (('h0372', '0.372'), ('h59939', '59.939'), ('hneg', '-0.5'), ('h25', '2.5')):
            j = os.path.join(d, name)
            if os.path.exists(j): shutil.rmtree(j)
            shutil.copytree(base, j)
            y = os.path.join(j, 'beats.yaml'); txt = open(y, encoding='utf-8').read()
            txt2 = txt.replace('music: {style: film, bpm: 87.46, downbeat: 0.3905,', 'music: {style: film, bpm: 87.46, downbeat: 0.3905, hit: %s,' % val, 1)
            if txt2 == txt: raise RuntimeError('film-grid music line not found')
            open(y, 'w', encoding='utf-8').write(txt2)
            res[name] = {'probe': self.probe(j), 'grid': self.node([os.path.join(self.S, 'video', 'lv.mjs'), '--job', j, '--grid'])}
        dflt = self.probe(base)
        self.add('film.hit-validation', *self.eval_hit_validation(res, dflt))
        self.add('film.hit-warning', *self.hit_warning(d))
        info = self.build(os.path.join(d, 'h0372'), os.path.join(d, 'h0372-audio'))
        if 'error' in info: return self.add('film.hit-offset', False, 'hit: 0.372 job did not build: %s' % info['error'])
        x = H.decode_audio(os.path.join(d, 'h0372-audio', 'music.wav'), sr=44100)
        self.add('film.hit-offset', *self.eval_hit_offset(x, 44100, info['endcard'], .372, info['dur']))

    def hit_warning(self, d):
        """lead (after QA run 3): `hit:` on a film whose last shot isn't an endcard → --grid warns; no warning without hit,
        with the endcard last, or for other styles"""
        cases = (('film-noend', 'film', '0.372', True), ('film-noend', 'film', None, False), ('film-grid', 'film', '0.372', False), ('film-noend', 'keynote', '0.372', False))
        got = []
        for base, style, hit, want in cases:
            j = os.path.join(d, 'warn-%s-%s-%s' % (base, style, hit or 'nohit'))
            if os.path.exists(j): shutil.rmtree(j)
            shutil.copytree(os.path.join(JOBS, base), j)
            y = os.path.join(j, 'beats.yaml'); txt = open(y, encoding='utf-8').read()
            new = 'music: {style: %s, bpm: 87.46, downbeat: 0.3905,%s' % (style, (' hit: %s,' % hit) if hit else '')
            if 'music: {style: film, bpm: 87.46, downbeat: 0.3905,' not in txt: raise RuntimeError('music line not found in %s' % base)
            txt2 = txt.replace('music: {style: film, bpm: 87.46, downbeat: 0.3905,', new, 1)
            open(y, 'w', encoding='utf-8').write(txt2)
            r = self.node([os.path.join(self.S, 'video', 'lv.mjs'), '--job', j, '--grid'])
            warned = bool(re.search(r'music\.hit does nothing here', r.text))
            got.append((base, style, hit, want, warned, r.rc, r))
        bad = ['%s %s %s: %s (exit %s)' % (b_, s_, 'hit ' + h_ if h_ else 'no hit', 'no warning' if w_ else 'warned', rc) for b_, s_, h_, w_, wd, rc, _ in got if w_ != wd]
        w1 = got[0][6]
        if got[0][4] and not re.search(r"last shot \(end\) is a type", w1.text): bad.append('the warning doesn\'t name the last shot and its block (%s)' % w1.brief(140))
        return not bad, '; '.join(bad) or 'film + hit, last shot a type → --grid warns (%s); no warning without hit, with the endcard last, or for keynote (exit %s)' % (
            re.search(r'music\.hit does nothing here[^\n]*', w1.text).group(0)[:110], got[3][5])

    @staticmethod
    def eval_hit_validation(res, dflt):
        bad = []
        p = res['h0372']['probe']
        if 'error' in p or (p.get('music') or {}).get('hit') != .372: bad.append('hit: 0.372 not carried (music.hit = %s)' % (p.get('error') or (p.get('music') or {}).get('hit')))
        g = res['h59939']['grid']
        if g.rc != 2 or not re.search(r'\bhit\b', g.text): bad.append('hit: 59.939 → lv.mjs exit %s (want 2, naming music.hit): %s' % (g.rc, g.brief(120)))
        if 'error' not in res['h25']['probe']: bad.append('hit: 2.5 accepted (range −1…2)')
        pn = res['hneg']['probe']
        if 'error' in pn or (pn.get('music') or {}).get('hit') != -.5: bad.append('hit: −0.5 (inside −1…2) not accepted/carried: %s' % (pn.get('error') or (pn.get('music') or {}).get('hit')))
        if 'error' in dflt or (dflt.get('music') or {}).get('hit') not in (None, 0): bad.append('without hit, music.hit = %s (want absent or 0: the default; film.endcard checks the sound)' % (dflt.get('error') or (dflt.get('music') or {}).get('hit')))
        return not bad, '; '.join(bad) or 'hit 0.372 and −0.5 carried; 59.939 → lv.mjs exit 2 naming hit; 2.5 refused; no hit → default (music.hit %s)' % ((dflt.get('music') or {}).get('hit'),)

    @staticmethod
    def eval_hit_offset(x, sr, end, hit, dur):
        if end is None: return False, 'the job has no end card'
        t = end + hit
        q = E.rms_db(x, sr, t - .40, t - .005)
        on = E.first_onset_after(x, sr, t - .45, t + .4)
        ring = E.rms_db(x, sr, t + .5, min(dur, t + 1.0))
        bad = []
        if q > -50: bad.append('music stem %.1f dBFS RMS in the 0.40 s before the hit (want < −50)' % q)
        if on is None or not (-.01 <= on - t <= .03): bad.append('first onset %s s, want the hit at the end card %.3f + %.3f = %.3f s' % (None if on is None else round(on, 3), end, hit, t))
        if ring < -45: bad.append('nothing rings out after the hit (%.1f dBFS)' % ring)
        return not bad, '; '.join(bad) or 'hit: 0.372 → the hit lands %+.0f ms from %.3f s (end card %.3f + 0.372), %.1f dBFS in the 0.40 s before it, rings out at %.1f dBFS' % ((on - t) * 1000, t, end, q, ring)

    # ── the --init --kit film starter ──
    def starter(self):
        j = os.path.join(self.dir, 'film-init')
        if os.path.exists(j): shutil.rmtree(j)
        r = self.node([os.path.join(self.S, 'video', 'lv.mjs'), '--job', j, '--init', '--kit', 'film'])
        y = os.path.join(j, 'beats.yaml')
        if r.rc != 0 or not os.path.exists(y): return self.add('film.starter', False, '--init --kit film failed: %s' % r.brief(200))
        s = open(y, encoding='utf-8').read()
        s2, n = re.subn(r'(?m)^music:.*$', 'music: {style: film}                # acceptance: the film score at its defaults', s, count=1)
        if not n: return self.add('film.starter', False, 'no music: line in the starter')
        open(y, 'w', encoding='utf-8').write(s2)
        info = self.build(j, os.path.join(j, 'acc-audio'), master=True)
        if 'error' in info: return self.add('film.starter', False, 'starter with music: {style: film} did not build: %s' % info['error'])
        tm, _ = self.tempo(os.path.join(j, 'acc-audio', 'master.wav'))
        ok, det = E.tempo_on_grid(tm, 87, 0)
        bad = [] if ok else [det]
        if info.get('bpm') != 87 or info['music'].get('key') != 'F': bad.append('starter compiled at %s BPM key %s (want 87, F)' % (info.get('bpm'), info['music'].get('key')))
        self.add('film.starter', not bad, '; '.join(bad) or 'the --init --kit film starter at music: {style: film}: %.1f s, %s' % (info['dur'], det))

    # ── lv.mjs --audio QA on film-sample's real frames (timeline unchanged: 124 BPM, downbeat 0) ──
    def qa(self):
        miss = H.need_real(os.path.join(FILM_SAMPLE, 'out', 'main', '16x9', 'frames'))
        if miss: return self.add('film.qa-audio', None, miss)
        j = os.path.join(self.dir, 'film-qa')
        if os.path.exists(j): shutil.rmtree(j)
        os.makedirs(os.path.join(j, 'out', 'main'))
        os.makedirs(os.path.join(j, 'out', 'main', '16x9'))
        items = [('beats.yaml', ''), ('assets', ''), ('out/main/audio', 'out/main')] + \
                [('out/main/16x9/' + x, 'out/main/16x9') for x in sorted(os.listdir(os.path.join(FILM_SAMPLE, 'out', 'main', '16x9'))) if x not in ('layers', 'clips', 'board')]
        for src, dst in items:                                    # APFS clones (cp -c): no space used, originals untouched
            subprocess.run(['/bin/cp', '-cRp', os.path.join(FILM_SAMPLE, src), os.path.join(j, dst)], check=True)
        y = os.path.join(j, 'beats.yaml'); s = open(y, encoding='utf-8').read()
        s = s.replace('music: {style: keynote, drop: brief, breaks: [voice]}', 'music: {style: film, bpm: 124, drop: brief, breaks: [voice]}   # acceptance: same timeline, film score')
        open(y, 'w', encoding='utf-8').write(s)
        r = self.node([os.path.join(self.S, 'video', 'lv.mjs'), '--job', j, '--audio', '--aspect', '16x9'], timeout=3600)
        fails = [l for l in r.text.splitlines() if l.startswith('FAIL')]
        ok = r.rc == 0 and 'QA PASSED' in r.text
        det = 'exit %s, %s%s' % (r.rc, 'QA PASSED' if ok else 'QA not passed', (': ' + ' | '.join(fails[:4])) if fails else (' — ' + r.brief(160) if not ok else ''))
        m = os.path.join(j, 'orbit-film-master.wav')
        if ok and os.path.exists(m):                                  # info only: the spec's tempo bar is for the 87 BPM film jobs
            tm, _ = self.tempo(m); okg, dg = E.tempo_on_grid(tm, 124, 0)
            det += '; (info) master ' + dg
        self.add('film.qa-audio', ok, det)
        for sub in ('frames', 'bgref'): shutil.rmtree(os.path.join(j, 'out', 'main', '16x9', sub), ignore_errors=True)   # drop the clones, keep the reports

    # ── every other style: byte-identical to the live skill ──
    def old_styles(self):
        bad, ok = [], []
        for bj in sorted(glob.glob(os.path.join(BASE, 'old-*.json'))):
            b = json.load(open(bj, encoding='utf-8')); name = b['job']
            out = os.path.join(self.dir, 'old', name)
            info = self.build(os.path.join(JOBS, name), out)
            if 'error' in info: bad.append('%s: %s' % (name, info['error'])); continue
            got = {os.path.basename(p): H.md5_file(p) for p in sorted(glob.glob(os.path.join(out, '*'))) if os.path.basename(p) not in ('audio.json', 'brief.json', 'master.json', 'tl.json')}
            tl = hashlib.sha1(open(os.path.join(out, 'tl.json'), 'rb').read()).hexdigest()
            diff = sorted(k for k in set(got) | set(b['md5']) if got.get(k) != b['md5'].get(k))
            if diff or tl != b['timeline_sha1']: bad.append('%s (%s): %s%s' % (name, b['style'], ', '.join(diff[:5]) or '', ' + compiled timeline' if tl != b['timeline_sha1'] else ''))
            else: ok.append('%s/%s' % (b['style'], name[4:]))
        return not bad, ('changed vs the live skill: ' + '; '.join(bad)) if bad else '%d old jobs byte-identical (every stem + the compiled timeline): %s' % (len(ok), ', '.join(ok))


def run_suite(skill, run_dir, report, tag='', parts=('spec', 'score', 'hit', 'starter', 'qa', 'old'), deny=()):
    f = Film(skill, run_dir, report, tag, deny)
    for p in parts:
        try:
            if p == 'old': report.add('film.old-styles-unchanged', *f.old_styles(), tag)
            else: getattr(f, p)()
        except Exception:
            import traceback
            report.add('film.%s.crashed' % p, False, 'harness error: %s' % traceback.format_exc().strip().splitlines()[-1], tag)
