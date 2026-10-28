# -*- coding: utf-8 -*-
# look.py / conform.py / pin.py acceptance (DESIGN.md §A), black-box on fixtures + today's real files.
import os, sys, json, re, glob
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness as H
import evals as E

CAD, PH, LK = os.path.join(H.FIX, 'cadence'), os.path.join(H.FIX, 'phone24'), os.path.join(H.FIX, 'look')
V2, V3 = os.path.join(H.HF02, 'out', 'fal', 'v2'), os.path.join(H.HF02, 'out', 'fal', 'v3')
# today's parameters (memory note reference_minimax_h3_video_api.md + the 2026-10-22 commands)
PLATE1_GRADE = "curves=all='0/0 0.03/0.03 0.137/0.27 0.4/0.58 0.68/0.82 1/1',eq=saturation=1.25,colorbalance=rs=-0.04:bs=0.05:rh=0.08:gh=0.02:bh=-0.06,gblur=sigma=1.4"
CAR0_GRADE = "curves=all='0/0 0.516/0.49 1/1',eq=saturation=0.75,colorbalance=rh=0.04:bh=-0.04,gblur=sigma=0.8"
MEASURES = [('p10', r'p10'), ('p50', r'p50|median'), ('p90', r'p90'), ('shadow', r'shadow_?(pct|%|percent)|deep|dark|<\s*40|lt40|below_?40'),
            ('sat', r'sat'), ('sharp', r'sharp'), ('grain', r'grain|noise'), ('warm_sh', r'(warm|r.?b|temp).*(shadow|_sh\b|low)|(shadow|low).*(warm|r.?b)'),
            ('warm_hi', r'(warm|r.?b|temp).*(highlight|_hi\b|high)|(highlight|high).*(warm|r.?b)')]
TOL = {'p10': (1.0, 0), 'p50': (1.0, 0), 'p90': (1.0, 0), 'shadow': (.5, 0), 'sat': (.5, 0), 'sharp': (0, .05), 'grain': (0, .10), 'warm_sh': (.8, 0), 'warm_hi': (.8, 0)}


def find_measures(obj, side=None):
    """{measure: value} from a look.py --json, whatever the layout; side='ref' picks the reference column"""
    flat = [(p.lower(), v) for p, v in H.flatten(obj) if isinstance(v, (int, float)) and not isinstance(v, bool)]
    out = {}
    for m, rx in MEASURES:
        c = [(p, v) for p, v in flat if re.search(rx, p.split('/')[-1] if not p.endswith(']') else p, re.I) or re.search(rx, p, re.I)]
        c = [(p, v) for p, v in c if not re.search(r'min|max|std|range|delta|diff|flag|outside|\[\d+\]', p)]   # per-frame rows never count
        if side == 'ref': c = [(p, v) for p, v in c if re.search(r'ref', p)]
        else: c = [(p, v) for p, v in c if not re.search(r'ref', p)] or c
        c = sorted(c, key=lambda pv: 0 if re.search(r'mean|avg|average', pv[0]) else 1)                  # the clip's mean first
        if m == 'shadow': c = [(p, v) for p, v in c if not re.search(r'warm|r.?b', p)]
        if m == 'sharp': c = [(p, v) for p, v in c if 'sharp' in p]
        if c: out[m] = c[0][1]
    return out


def find_flags(obj):
    """{measure: bool} — flags as a dict, a list of flagged names, or per-measure records"""
    out = {}
    def mname(s):
        for m, rx in MEASURES:
            if re.search(rx, str(s), re.I): return m
    def walk(o, key=None):
        if isinstance(o, dict):
            nm = None
            for k in ('name', 'measure', 'metric', 'key', 'label', 'id'):
                if k in o and isinstance(o[k], str): nm = mname(o[k])
            for k, v in o.items():
                if re.search(r'flag|outside|out_of_range|beyond|warn', k, re.I):
                    if isinstance(v, bool) and (nm or mname(key)): out[nm or mname(key)] = v
                    elif isinstance(v, dict):
                        for kk, vv in v.items():
                            if mname(kk) and isinstance(vv, bool): out[mname(kk)] = vv
                    elif isinstance(v, list) and all(isinstance(x, str) for x in v):
                        for m, _ in MEASURES: out.setdefault(m, False)              # a list of flagged names: the rest are not flagged
                        for x in v:
                            if mname(x): out[mname(x)] = True
                    elif isinstance(v, str) and (nm or mname(key)): out[nm or mname(key)] = bool(v.strip())
                walk(v, k)
        elif isinstance(o, list):
            for x in o: walk(x, key)
    walk(obj)
    return out


class Footage(object):
    def __init__(self, tools, run_dir, report, tag='', deny=()):
        self.T, self.dir, self.R, self.tag, self.deny = tools, run_dir, report, tag, tuple(deny)
        os.makedirs(run_dir, exist_ok=True)
        self.log = os.path.join(run_dir, 'footage-runs.log')

    def py(self, tool, args, timeout=900):
        e = H.base_env(home=H.REAL_HOME, tmp=os.path.join(self.dir, 'tmp'))     # numpy/Pillow live in the user site under the real HOME
        return H.run([H.PY, self.T[tool]] + list(args), env=e, cwd=self.dir, timeout=timeout, deny_write=self.deny, log=self.log)

    def w(self, *p):
        d = os.path.join(self.dir, *p); os.makedirs(d, exist_ok=True); return d

    def add(self, cid, ok, det, real=False):
        self.R.add(cid, ok, det, ('real' if real else self.tag))

    # ── look ──
    def look(self, real=True):
        oracle = json.load(open(os.path.join(H.ACC, 'baselines', 'look-oracle.json'), encoding='utf-8'))
        out = os.path.join(self.w('look'), 'still.json')
        r = self.py('look', [os.path.join(LK, 'still.png'), '--json', out])
        self.add('look.oracle-still', *self.eval_look_still(r, out, oracle['still']))
        out2 = os.path.join(self.w('look'), 'ref.json')
        r2 = self.py('look', [os.path.join(LK, 'ours_bright.png'), '--ref', os.path.join(LK, 'ref.mp4'), '--json', out2])
        self.add('look.ref-flags', *self.eval_look_ref(r2, out2, oracle))
        self.add('look.decode-exact', *self.look_decode_exact())
        if real:
            miss = H.need_real(os.path.join(V2, 'plate1-i2v.mp4'), os.path.join(V2, 'plate1-v2-fit.mp4'))
            if miss: return self.add('look.real', None, miss, True)
            res, exp = {}, {}
            for name, f in (('i2v', 'plate1-i2v.mp4'), ('fit', 'plate1-v2-fit.mp4')):
                o = os.path.join(self.w('look'), 'real-%s.json' % name); rr = self.py('look', [os.path.join(V2, f), '--json', o])
                j = json.load(open(o, encoding='utf-8')) if os.path.exists(o) else {}
                res[name] = find_measures(j) if j else {}
                exp[name] = self.exact_expected(os.path.join(V2, f), j)
            self.add('look.real', *self.eval_look_real(res, exp), real=True)

    @staticmethod
    def tool_times(j):
        """the frame times the tool says it sampled for its own input (frames[].t), if it lists them"""
        best = []
        def walk(o, path=''):
            nonlocal best
            if isinstance(o, list) and o and all(isinstance(x, dict) and isinstance(x.get('t'), (int, float)) for x in o) and 'ref' not in path:
                if len(o) > len(best): best = [float(x['t']) for x in o]
            elif isinstance(o, dict):
                for k, v in o.items(): walk(v, path + '/' + k)
        walk(j)
        return best

    def exact_expected(self, clip, j):
        import exactdecode as XD
        times = self.tool_times(j) or XD.even_times(clip, 12)
        st, n = XD.clip_stats(clip, times)
        st['_frames'] = n; st['_times'] = 'the tool\'s own %d sample times' % n if self.tool_times(j) else '12 evenly spaced frames'
        return st

    def look_decode_exact(self):
        """QA1: look.py read the same pixels ~2 code values darker at 1928 px wide than at 1920. Five flat stripes with known
        YUV values (lossless, BT.709 tags) at both widths: look.py must read today's formulas on an exact BT.709 decode."""
        d = os.path.join(H.FIX, 'look_decode'); t = json.load(open(os.path.join(d, 'truth.json'), encoding='utf-8')); got = {}
        for name in sorted(t['clips']):
            o = os.path.join(self.w('look'), 'decode-%s.json' % name[:-4]); r = self.py('look', [os.path.join(d, name), '--json', o])
            got[name] = (find_measures(json.load(open(o, encoding='utf-8'))) if os.path.exists(o) else {}, r)
        return self.eval_look_decode(got, t)

    @staticmethod
    def eval_look_decode(got, t):
        bad, info = [], []
        for name, (m, r) in sorted(got.items()):
            ex = t['clips'][name]['exact']
            if not m: bad.append('%s: no --json (exit %s: %s)' % (name, r.rc if r else '?', r.brief(100) if r else '')); continue
            for k, tol in (('p10', .75), ('p90', .75), ('p50', 1.0), ('shadow', .5)):
                if abs(m.get(k, -99) - ex[k]) > tol: bad.append('%s %s %.2f vs exact %.2f' % (name.split('_')[1][:-4], k, m.get(k, -99), ex[k]))
            if abs(m.get('sat', -99) - ex['sat']) > .04 * ex['sat']: bad.append('%s sat %.2f vs exact %.2f' % (name.split('_')[1][:-4], m.get('sat', -99), ex['sat']))
            info.append('%s p10/p50/p90 %.2f/%.2f/%.2f' % (name.split('_')[1][:-4], m.get('p10', -99), m.get('p50', -99), m.get('p90', -99)))
        ms = [m for m, r in got.values() if m]
        if len(ms) == 2 and max(abs(ms[0].get(k, 0) - ms[1].get(k, 0)) for k in ('p10', 'p90')) > .5: bad.append('width-dependent: the same grey stripes read %.2f / %.2f (p10) at the two widths' % (ms[0].get('p10'), ms[1].get('p10')))
        ex0 = list(t['clips'].values())[0]['exact']
        return not bad, ('; '.join(bad) + ' — ' + '; '.join(info)) if bad else 'exact BT.709 at both widths (exact p10/p50/p90 %.2f/%.2f/%.2f): %s' % (ex0['p10'], ex0['p50'], ex0['p90'], '; '.join(info))

    @staticmethod
    def eval_look_still(r, out, want):
        if not os.path.exists(out): return False, 'no --json written (exit %s: %s)' % (r.rc, r.brief(160))
        got = find_measures(json.load(open(out, encoding='utf-8')))
        bad, miss = [], [m for m, _ in MEASURES if m not in got]
        for m, (ab, rel) in TOL.items():
            if m in got and abs(got[m] - want[m]) > max(ab, rel * abs(want[m])): bad.append('%s %.3f vs today\'s formula %.3f' % (m, got[m], want[m]))
        if miss: bad.append('measures not found in the JSON: %s' % ', '.join(miss))
        return not bad, '; '.join(bad) or 'all 9 measures within tolerance of today\'s look_stats formulas (p50 %.2f, sat %.2f, sharpness %.2f, grain %.3f)' % (got['p50'], got['sat'], got['sharp'], got['grain'])

    @staticmethod
    def eval_look_ref(r, out, oracle):
        if not os.path.exists(out): return False, 'no --json written (exit %s: %s)' % (r.rc, r.brief(160))
        j = json.load(open(out, encoding='utf-8'))
        ours, ref, fl = find_measures(j), find_measures(j, side='ref'), find_flags(j)
        bad = []
        if abs(ours.get('p50', -99) - oracle['ours_bright']['p50']) > 1.5: bad.append('ours p50 %s (want %.1f)' % (ours.get('p50'), oracle['ours_bright']['p50']))
        if abs(ref.get('p50', -99) - oracle['ref']['p50']) > 4: bad.append('reference p50 %s (want ≈%.1f)' % (ref.get('p50'), oracle['ref']['p50']))
        if not any(re.search(r'delta|diff', p, re.I) for p, _ in H.flatten(j)): bad.append('no delta column')
        for m in ('p10', 'p50', 'p90'):
            if fl.get(m) is not True: bad.append('%s (+50 luma above every reference frame) not flagged (%s)' % (m, fl.get(m)))
        unflagged = [m for m, v in fl.items() if v is False]
        if len(unflagged) < 2: bad.append('only %d measure(s) unflagged (%s): flags must mark only what falls outside the reference\'s frame range' % (len(unflagged), unflagged))
        return not bad, '; '.join(bad) or 'both columns + delta; p10/p50/p90 flagged (outside the reference\'s frame range), %s not' % ', '.join(unflagged)

    # today's documented numbers (DESIGN.md §A; ffmpeg's default RGB conversion, 1928-wide clips) — shown, not judged:
    # QA1 (2026-10-22) found that path ~2 code values dark at 1928 px; look.py is being made exact, FOOTAGE.md re-measured
    TODAY_LOOK = {'i2v': {'p50': 35, 'shadow': 55}, 'fit': {'p50': 64, 'sat': 46, 'sharp': 9.5}}

    @staticmethod
    def eval_look_real(res, exp):
        """decode-independent: look.py vs today's formulas on an exact BT.709 decode of the same frames (its own sample times)"""
        TOL = {'p50': (1.0, 0), 'shadow': (1.0, 0), 'sat': (1.0, 0), 'sharp': (0, .05), 'p10': (1.0, 0), 'p90': (1.0, 0)}
        bad, got = [], []
        for clip in ('i2v', 'fit'):
            m, e = res.get(clip, {}), (exp or {}).get(clip, {})
            if not m: bad.append('%s: no measures' % clip); continue
            for k, (ab, rel) in TOL.items():
                if k not in e: continue
                x = m.get(k)
                if x is None or abs(x - e[k]) > max(ab, rel * abs(e[k])): bad.append('%s %s %s vs exact %.2f' % (clip, k, None if x is None else round(x, 2), e[k]))
            got.append('%s p50 %.1f (exact %.1f, today %s) sat %.1f (exact %.1f) sharp %.2f (exact %.2f)' % (clip, m.get('p50', -99), e.get('p50', -99), Footage.TODAY_LOOK[clip].get('p50'),
                       m.get('sat', -99), e.get('sat', -99), m.get('sharp', -99), e.get('sharp', -99)))
        how = (exp or {}).get('fit', {}).get('_times', '')
        return not bad, ('; '.join(bad) + ' | ' if bad else 'matches an exact BT.709 decode of the same frames (%s): ' % how) + ' · '.join(got)

    # ── conform ──
    def conform(self, real=True):
        t = json.load(open(os.path.join(CAD, 'truth.json'), encoding='utf-8')); bc = t['barcode']
        src24 = H.decode_frames(os.path.join(CAD, 'src24.mp4')); src30 = H.decode_frames(os.path.join(CAD, 'src30.mp4'))
        d = self.w('conform')
        o1 = os.path.join(d, 'c24.mp4'); r1 = self.py('conform', [os.path.join(CAD, 'src24.mp4'), o1, '--frames', '60', '--start', '0.5'])
        self.add('conform.cadence', *self.eval_conform(r1, o1, bc, src24, 60, 12, 24, None, cadence_line=True))
        bad, det = [], []
        for size in ((360, 360), (1280, 720)):
            o = os.path.join(d, 'c%dx%d.mp4' % size); r = self.py('conform', [os.path.join(CAD, 'src24.mp4'), o, '--frames', '60', '--start', '0.5', '--size', '%dx%d' % size])
            ok, dd = self.eval_conform(r, o, bc, src24, 60, 12, 24, size)
            (det if ok else bad).append('%dx%d: %s' % (size[0], size[1], dd))
        self.add('conform.size-cover', not bad, '; '.join(bad or det))
        o3 = os.path.join(d, 'graded.mp4'); r3 = self.py('conform', [os.path.join(CAD, 'src24.mp4'), o3, '--frames', '60', '--start', '0.5', '--grade', 'eq=brightness=0.08'])
        self.add('conform.grade', *self.eval_grade(r3, o3, o1, bc))
        o4 = os.path.join(d, 'c30.mp4'); r4 = self.py('conform', [os.path.join(CAD, 'src30.mp4'), o4, '--frames', '60', '--start', '1.0'])
        self.add('conform.30fps', *self.eval_conform(r4, o4, bc, src30, 60, 30, 30, None))
        o5 = os.path.join(d, 'short.mp4'); r5 = self.py('conform', [os.path.join(CAD, 'src24.mp4'), o5, '--frames', '140', '--start', '0.5'])
        self.add('conform.refuse-short', *self.eval_refuse(r5, o5))
        if real:
            miss = H.need_real(os.path.join(V2, 'plate1-i2v.mp4'), os.path.join(V2, 'plate1-v2-fit.mp4'))
            if miss: return self.add('conform.real', None, miss, True)
            o6 = os.path.join(d, 'plate1-fit.mp4')
            r6 = self.py('conform', [os.path.join(V2, 'plate1-i2v.mp4'), o6, '--frames', '169', '--start', '0.9', '--grade', PLATE1_GRADE, '--crf', '14'])
            self.add('conform.real', *self.eval_pixel_close(r6, o6, os.path.join(V2, 'plate1-v2-fit.mp4')), real=True)

    @staticmethod
    def eval_conform(r, out, bc, src, n, start_idx, sfps, size, cadence_line=False):
        if r is not None and r.rc != 0: return False, 'exit %s: %s' % (r.rc, r.brief(200))
        if not os.path.exists(out): return False, 'no output'
        p = E.stream_props(out)
        okp, dp = E.check_props(p, n=n, fps=30, size=size or (640, 360))
        idx, fr = E.frame_indices(out, bc, (640, 360), size)
        okc, dc = E.cadence_eval(idx, n, start_idx, sfps, 30)
        okx, dx = (E.pixels_match_source(fr, idx, src, size) if okc else (True, ''))
        bad = [x for ok, x in ((okp, dp), (okc, dc), (okx, dx)) if not ok]
        if cadence_line and r is not None and not (re.search(r'repeat', r.text, re.I) and re.search(r'every\s*5', r.text)):
            bad.append('no cadence line ("24 → 30 fps: 1 repeat every 5") in the output')
        return not bad, '; '.join(bad) or '%s; %s' % (dc, dp)

    @staticmethod
    def eval_grade(r, graded, plain, bc):
        if r.rc != 0 or not os.path.exists(graded): return False, 'exit %s: %s' % (r.rc, r.brief(160))
        if not os.path.exists(plain): return None, 'no ungraded run to compare with'
        a, b = H.decode_frames(graded), H.decode_frames(plain)
        if a is None or b is None or len(a) != len(b): return False, 'frame counts differ (graded %s, plain %s)' % (None if a is None else len(a), None if b is None else len(b))
        ia = [E.BC.decode(f, **bc) for f in a]; ib = [E.BC.decode(f, **bc) for f in b]
        d = float(E.luma(a[:, :280]).mean() - E.luma(b[:, :280]).mean())
        ok = 10 <= d <= 40 and ia == ib
        return ok, 'eq=brightness=0.08 raised mean luma by %+.1f (want +10…+40), same source frames: %s' % (d, ia == ib)

    @staticmethod
    def eval_refuse(r, out):
        bad = []
        if r.rc != 2: bad.append('exit %s (want 2)' % r.rc)
        if not re.search(r'\d+(\.\d+)?\s*(s\b|sec|frames?)', r.text) or not re.search(r'miss|short|need|only|cover', r.text, re.I): bad.append('doesn\'t say how much is missing (%s)' % r.brief(160))
        if os.path.exists(out) and H.count_frames(out) == 140: bad.append('wrote a full-length output anyway')
        return not bad, '; '.join(bad) or 'exit 2: %s' % r.brief(160)

    @staticmethod
    def eval_pixel_close(r, out, today, tol=1.0):
        if r.rc != 0 or not os.path.exists(out): return False, 'exit %s: %s' % (r.rc, r.brief(200))
        A, B = H.decode_frames(out), H.decode_frames(today)
        if A is None or B is None: return False, 'could not decode'
        if A.shape != B.shape: return False, 'shape %s vs today\'s %s' % (A.shape, B.shape)
        mad = np.array([np.abs(a.astype(np.int16) - b.astype(np.int16)).mean() for a, b in zip(A, B)])
        mx = int(max(np.abs(a.astype(np.int16) - b.astype(np.int16)).max() for a, b in zip(A[::10], B[::10])))
        ok = mad.max() <= tol
        return ok, '%d frames; per-frame mean |Δ| max %.3f, mean %.3f (tolerance %.1f); max abs pixel diff %d (sampled every 10th frame)%s' % (len(A), mad.max(), mad.mean(), tol, mx, '' if ok else ' — not pixel-close')

    # ── pin ──
    def pin(self, real=True):
        t = json.load(open(os.path.join(PH, 'truth.json'), encoding='utf-8')); src = H.decode_frames(os.path.join(PH, 'clip.mp4'))
        d = self.w('pin'); o = os.path.join(d, 'pinned.mp4'); trk = os.path.join(d, 'track.png')
        r = self.py('pin', [os.path.join(PH, 'clip.mp4'), os.path.join(PH, 'screen.png'), o, '--frames', '90', '--start', '0.4', '--track-png', trk])
        self.add('pin.composite-inside-only', *self.eval_pin(r, o, t, src))
        self.add('pin.frames-cadence', *self.eval_pin_cadence(r, o, t))
        self.add('pin.track-png', *self.eval_track_png(r, trk))
        o2 = os.path.join(d, 'nophone.mp4'); r2 = self.py('pin', [os.path.join(PH, 'nophone.mp4'), os.path.join(PH, 'screen.png'), o2, '--frames', '30'])
        self.add('pin.no-phone-exit3', *self.eval_nophone(r2))
        if real:
            miss = H.need_real(os.path.join(V3, 'car0-i2v.mp4'), os.path.join(V3, 'ui_home.png'), os.path.join(V3, 'car0-fit.mp4'))
            if miss: return self.add('pin.real', None, miss, True)
            o3 = os.path.join(d, 'car0-fit.mp4')
            r3 = self.py('pin', [os.path.join(V3, 'car0-i2v.mp4'), os.path.join(V3, 'ui_home.png'), o3, '--frames', '69', '--start', '0.2', '--size', '720x1290', '--grade', CAR0_GRADE, '--track-png', os.path.join(d, 'car0-track.png')])
            # tolerance 3: the spec moves pin's processing size to the clip's own (today's tool resampled to 720×1290 first)
            self.add('pin.real', *self.eval_pixel_close(r3, o3, os.path.join(V3, 'car0-fit.mp4'), tol=3.0), real=True)

    @staticmethod
    def eval_pin(r, out, truth, src):
        if r is not None and r.rc != 0: return False, 'exit %s: %s' % (r.rc, r.brief(200))
        if not os.path.exists(out): return False, 'no output'
        res = E.pin_eval(out, truth, src)
        return res['ok'], res['detail']

    @staticmethod
    def eval_pin_cadence(r, out, truth):
        if not os.path.exists(out): return False, 'no output'
        okp, dp = E.check_props(E.stream_props(out), n=90, fps=30, size=(720, 1290))
        idx, _ = E.frame_indices(out, truth['barcode'], (720, 1290))
        okc, dc = E.cadence_eval(idx, 90, 10, 24, 30)
        return okp and okc, '; '.join(x for ok, x in ((okp, dp), (okc, dc)) if not ok) or '%s; %s' % (dc, dp)

    @staticmethod
    def eval_track_png(r, path):
        if not os.path.exists(path): return False, '--track-png wrote nothing (exit %s)' % (r.rc if r else '?')
        try:
            im = Image.open(path); im.verify(); return True, '%s: %dx%d PNG' % (os.path.basename(path), Image.open(path).width, Image.open(path).height)
        except Exception as e: return False, 'not a valid image: %s' % e

    @staticmethod
    def eval_nophone(r):
        bad = []
        if r.rc != 3: bad.append('exit %s (want 3)' % r.rc)
        if not re.search(r'black', r.text, re.I): bad.append('no advice about a black screen (%s)' % r.brief(160))
        return not bad, '; '.join(bad) or 'exit 3: %s' % r.brief(160)


def run_suite(tools, run_dir, report, tag='', real=True, deny=(), parts=('look', 'conform', 'pin')):
    f = Footage(tools, run_dir, report, tag, deny)
    for p in parts:
        if not os.path.exists(tools[p]):
            for cid in {'look': ['look.oracle-still', 'look.ref-flags', 'look.real'], 'conform': ['conform.cadence', 'conform.size-cover', 'conform.grade', 'conform.30fps', 'conform.refuse-short', 'conform.real'],
                        'pin': ['pin.composite-inside-only', 'pin.frames-cadence', 'pin.track-png', 'pin.no-phone-exit3', 'pin.real']}[p]:
                report.add(cid, False, 'tool missing: %s' % tools[p], tag)
            continue
        try:
            getattr(f, p)(real)
        except Exception as e:
            import traceback
            report.add('%s.crashed' % p, False, 'harness error: %s' % traceback.format_exc().strip().splitlines()[-1], tag)
