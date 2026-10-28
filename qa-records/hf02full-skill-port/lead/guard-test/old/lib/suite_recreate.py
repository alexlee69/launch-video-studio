# -*- coding: utf-8 -*-
# compare.py / track.py / music.py / temptrack.py acceptance (DESIGN.md §B), black-box on fixtures + today's real files.
import os, sys, json, re, glob, math
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness as H
import evals as E

C30, TRK, CLK, FLM = (os.path.join(H.FIX, x) for x in ('cuts30', 'track', 'clicks', 'films'))
FILM = os.path.join(H.HF02, 'film.mp4')
SHIM = os.path.join(H.LIB, 'shim')
TODAY_CUTS = [75, 97, 231, 264, 312, 357, 465, 510, 641, 671, 719, 743, 843, 922, 972, 1000, 1260, 1281, 1530, 1629, 1698, 1787]
REAL_PCM_MD5, REAL_VIDEO_MD5 = '486aab4c000ffa05f0730c5dd728c5ef', '80d435aeb3b6b1fd5a1e541ebb6c9326'


def jload(p):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception: return None


class Recreate(object):
    def __init__(self, tools, run_dir, report, tag='', deny=()):
        self.T, self.dir, self.R, self.tag, self.deny = tools, run_dir, report, tag, tuple(deny)
        os.makedirs(run_dir, exist_ok=True)
        self.log = os.path.join(run_dir, 'recreate-runs.log')
        self.truth = jload(os.path.join(C30, 'truth.json'))

    def py(self, tool, args, timeout=1800, shim=None, mark=None, tamper_dir=None, stem=''):
        e = H.base_env(home=H.REAL_HOME, tmp=os.path.join(self.dir, 'tmp'))
        if shim:
            e['PATH'] = SHIM + ':' + e['PATH']; e['ACC_TAMPER'] = shim; e['ACC_SHIM_MARK'] = mark; e['ACC_REAL_FFMPEG'] = H.FFMPEG
            if tamper_dir: e['ACC_TAMPER_DIR'] = tamper_dir; e['ACC_TAMPER_STEM'] = stem; e['ACC_TAMPER_EXT'] = '.mp4'
        return H.run([H.PY, self.T[tool]] + list(args), env=e, cwd=self.dir, timeout=timeout, deny_write=self.deny, log=self.log)

    def w(self, *p):
        d = os.path.join(self.dir, *p); os.makedirs(d, exist_ok=True); return d

    def add(self, cid, ok, det, real=False):
        self.R.add(cid, ok, det, 'real' if real else self.tag)

    # ── compare ──
    def compare(self, real=True):
        t = self.truth; bc = t['barcode']; ref = os.path.join(C30, 'ref.mp4')
        res = {}
        for v in ('ours_exact', 'ours_shift1', 'ours_mixed', 'ours_blank'):
            d = self.w('compare', v)
            res[v] = (self.py('compare', ['--ref', ref, '--ours', os.path.join(C30, v + '.mp4'), '--out', d]), d)
        r, d = res['ours_exact']
        self.add('compare.sbs-frame-lock', *self.eval_sbs(r, os.path.join(d, 'sbs.mp4'), ref, os.path.join(C30, 'ours_exact.mp4'), bc, 300))
        mark = os.path.join(self.w('compare', 'slip'), 'shim.jsonl')
        if os.path.exists(mark): os.remove(mark)
        rs = self.py('compare', ['--ref', ref, '--ours', os.path.join(C30, 'ours_exact.mp4'), '--out', self.w('compare', 'slip')], shim='slip-sbs', mark=mark,
                     tamper_dir=self.w('compare', 'slip'), stem='sbs')
        self.add('compare.verify-catches-slip', *self.eval_catch(rs, mark, r'verify:\s*(\d+)\s*/\s*(\d+)'))
        for v, cid in (('ours_exact', 'compare.cuts-exact'), ('ours_shift1', 'compare.cuts-shift1'), ('ours_mixed', 'compare.cuts-mixed')):
            rr, dd = res[v]
            self.add(cid, *self.eval_cuts(rr, dd, t['expect'][v], t['ref_cuts']))
        rr, dd = res['ours_blank']
        self.add('compare.cuts-trivial', *self.eval_trivial(rr, dd, t['expect']['ours_blank']['trivial'], t['ref_cuts']))
        bd = os.path.join(C30, 'breakdown', 'breakdown.json')
        rb = self.py('compare', ['--ref', ref, '--ours', os.path.join(C30, 'ours_exact.mp4'), '--out', self.w('compare', 'cutsfrom'), '--cuts-from', bd, '--no-video'])
        self.add('compare.cuts-from', *self.eval_cuts(rb, os.path.join(self.dir, 'compare', 'cutsfrom'), t['expect']['ours_exact'], t['ref_cuts']))
        rf = self.py('compare', ['--ref', ref, '--ours', os.path.join(C30, 'ours_25fps.mp4'), '--out', self.w('compare', 'fps')])
        self.add('compare.fps-mismatch-exit2', rf.rc == 2 and not glob.glob(os.path.join(self.dir, 'compare', 'fps', 'sbs*.mp4')), 'exit %s: %s' % (rf.rc, rf.brief(150)))
        o60 = os.path.join(C30, 'ours_60fps.mp4')
        if os.path.exists(o60):
            r6 = self.py('compare', ['--ref', ref, '--ours', o60, '--out', self.w('compare', 'fps60')])
            self.add('compare.fps-multiple', *self.eval_fps_multiple(r6, os.path.join(self.dir, 'compare', 'fps60'), ref, o60, bc, t))
        else:
            self.add('compare.fps-multiple', None, 'fixture ours_60fps.mp4 missing (python3 -E fixtures/make_fixtures.py cuts30_60fps)')
        ro = self.py('compare', ['--ref', ref, '--ours', os.path.join(C30, 'ours_short.mp4'), '--out', self.w('compare', 'short')])
        self.add('compare.overlap', *self.eval_overlap(ro, os.path.join(self.dir, 'compare', 'short'), ref, os.path.join(C30, 'ours_short.mp4'), bc))
        r, d = res['ours_exact']
        self.add('compare.sheet', *self.eval_sheet(os.path.join(d, 'sheet.png'), t['colors']))
        self.add('compare.options', *self.options(ref, bc))
        if real: self.compare_real()

    def options(self, ref, bc):
        ours = os.path.join(C30, 'ours_exact.mp4'); bad, ok = [], []
        dn = self.w('compare', 'novideo'); rn = self.py('compare', ['--ref', ref, '--ours', ours, '--out', dn, '--no-video'])
        files = set(os.listdir(dn))
        if rn.rc != 0 or any(f.startswith('sbs') and f.endswith('.mp4') for f in files) or not {'cuts.json', 'cuts.md', 'sheet.png'} <= files: bad.append('--no-video: exit %s, files %s' % (rn.rc, sorted(files)))
        else: ok.append('--no-video: report + sheet, no video')
        dh = self.w('compare', 'half'); rh = self.py('compare', ['--ref', ref, '--ours', ours, '--out', dh, '--half'])
        sh = os.path.join(dh, 'sbs-half.mp4')
        if rh.rc != 0 or not os.path.exists(sh): bad.append('--half: exit %s, no sbs-half.mp4 (%s)' % (rh.rc, rh.brief(100)))
        else:
            k, det, info = E.sbs_lock(sh, ref, ours, bc=bc)
            (ok if k else bad).append('--half: %s' % det)
        for mode, hz in (('ref', 440), ('ours', 880), ('none', None)):
            da = self.w('compare', 'audio-' + mode); ra = self.py('compare', ['--ref', ref, '--ours', ours, '--out', da, '--audio', mode, '--from', '2', '--to', '6'])
            sbs = (glob.glob(os.path.join(da, 'sbs*.mp4')) or [None])[0]
            if ra.rc != 0 or not sbs: bad.append('--audio %s: exit %s (%s)' % (mode, ra.rc, ra.brief(100))); continue
            _, astreams, _ = H.video_stream(sbs)
            if hz is None:
                (bad if astreams else ok).append('--audio none: %d audio stream(s)' % len(astreams))
            else:
                x = H.decode_audio(sbs, sr=8000) if astreams else np.zeros(16)
                f0 = float(np.argmax(np.abs(np.fft.rfft(x))) * 8000.0 / len(x)) if len(x) > 100 else 0
                (ok if abs(f0 - hz) < 15 else bad).append('--audio %s: %s Hz' % (mode, '%.0f' % f0 if astreams else 'no audio'))
            if mode == 'ref':
                n = H.count_frames(sbs); fr = H.decode_frames(sbs, fmt='gray')
                Hs = fr.shape[1]; sc = Hs / 360.0
                code = E.BC.decode(fr[0][:, :int(640 * sc)], sx=sc, sy=sc, **bc)
                (ok if abs(n - 120) <= 1 and code == 60 else bad).append('--from 2 --to 6: %d frames, first = reference frame %s' % (n, code))
        return not bad, '; '.join(bad + ok)

    def compare_real(self):
        miss = H.need_real(H.REF_MP4, FILM)
        if miss: return self.add('compare.real', None, miss, True)
        d = self.w('compare', 'real')
        r = self.py('compare', ['--ref', H.REF_MP4, '--ours', FILM, '--out', d, '--no-video'], timeout=3600)
        s = E.parse_cut_summary(r.text)
        if not s: return self.add('compare.real', False, 'no "cuts: N in the reference — …" line (exit %s: %s)' % (r.rc, r.brief(200)), True)
        recs = E.cut_records(jload(os.path.join(d, 'cuts.json')) or {})
        frames = [E.rec_frame(x) for x in recs]
        missing_today = [c for c in TODAY_CUTS if not any(f is not None and abs(f - c) <= 1 for f in frames)]
        extra = [f for f in frames if f is not None and not any(abs(f - c) <= 1 for c in TODAY_CUTS)]
        ok = s['exact'] >= 19 and s['exact'] + s['within1'] >= 21 and 20 <= s['ref'] <= 25
        self.add('compare.real', ok, '%s | vs today\'s 22: not found %s, new %s%s' % (s['line'], missing_today or 'none', extra or 'none',
                 '' if ok else ' — today: 22 cuts, 19 exact + 2 within 1 f; the worker must explain the difference'), True)

    @staticmethod
    def eval_sbs(r, sbs, ref, ours, bc, n):
        bad = []
        if r.rc != 0: bad.append('exit %s' % r.rc)
        m = re.search(r'verify:\s*(\d+)\s*/\s*(\d+)\s*frames exact', r.text)
        if not m or m.group(1) != m.group(2) or int(m.group(2)) != n: bad.append('verify line %s (want "verify: %d/%d frames exact")' % (m.group(0) if m else 'missing', n, n))
        if not os.path.exists(sbs): return False, '; '.join(bad + ['no sbs.mp4'])
        ok, det, info = E.sbs_lock(sbs, ref, ours, bc=bc)
        if not ok: bad.append('independent check: ' + det)
        return not bad, '; '.join(bad) or 'verify: %d/%d; independent decode by index on a µs-jittered reference (ffmpeg hstack slips on it): %s' % (n, n, det)

    @staticmethod
    def eval_fps_multiple(r, d, ref, ours60, bc, t):
        """ours at 60 fps vs a 30 fps reference: our frame 2i must stand against reference frame i (lead's review round)"""
        if r.rc != 0: return False, 'exit %s (an exact multiple of the reference fps must be accepted): %s' % (r.rc, r.brief(160))
        bad = []
        m = re.search(r'verify:\s*(\d+)\s*/\s*(\d+)', r.text)
        if not m or m.group(1) != m.group(2) or m.group(2) != '300': bad.append('verify %s (want 300/300)' % (m.group(0) if m else 'missing'))
        sbs = (glob.glob(os.path.join(d, 'sbs*.mp4')) or [None])[0]
        if not sbs: bad.append('no side-by-side')
        else:
            ok, det, _ = E.sbs_lock(sbs, ref, ours60, bc=bc, ostep=2)
            if not ok: bad.append('pairing: ' + det)
        s = E.parse_cut_summary(r.text)
        if not s or s['exact'] != 7: bad.append('cuts: %s (want 7 exact)' % (s['line'] if s else 'no summary'))
        return not bad, '; '.join(bad) or 'ours at 60 fps: our frame 2i against reference frame i on all 300 frames (barcodes), verify 300/300, %s' % s['line']

    @staticmethod
    def eval_catch(r, mark, rx):
        if not os.path.exists(mark) or not open(mark).read().strip():
            return None, 'could not inject the fault: the tool never wrote its output through `ffmpeg` on PATH (exit %s) — check by hand' % r.rc
        m = re.search(rx, r.text)
        ok = r.rc == 1 and (m is None or m.group(1) != m.group(2))
        return ok, '%s tampered after writing → exit %s, %s' % (json.loads(open(mark).read().strip().splitlines()[-1]).get('mode'), r.rc, (m.group(0) if m else r.brief(120)))

    @staticmethod
    def eval_cuts(r, d, exp, ref_cuts):
        if r.rc not in (0,): return False, 'exit %s: %s' % (r.rc, r.brief(200))
        s = E.parse_cut_summary(r.text) or E.parse_cut_summary(open(os.path.join(d, 'cuts.md'), encoding='utf-8').read() if os.path.exists(os.path.join(d, 'cuts.md')) else '')
        if not s: return False, 'no "cuts: N in the reference — …" summary line'
        bad = []
        if s['ref'] != len(ref_cuts): bad.append('%d reference cuts (want %d)' % (s['ref'], len(ref_cuts)))
        for k in ('exact', 'within1', 'off', 'missing'):
            if s[k] != exp[k]: bad.append('%s %d (want %d)' % (k, s[k], exp[k]))
        recs = E.cut_records(jload(os.path.join(d, 'cuts.json')) or {})
        if len(recs) != len(ref_cuts): bad.append('cuts.json has %d per-cut records (want %d)' % (len(recs), len(ref_cuts)))
        else:
            fr = [E.rec_frame(x) for x in recs]
            if any(f is None or min(abs(f - c) for c in ref_cuts) > 1 for f in fr): bad.append('cut frames %s ≠ %s' % (fr, ref_cuts))
            if 'offset' in exp:
                offs = [E.rec_offset(x) for x in recs]
                if any(o is None or abs(o) != exp['offset'] for o in offs): bad.append('offsets %s (want ±%d)' % (offs, exp['offset']))
            if 'off_cut' in exp:
                o = [x for x in recs if E.rec_frame(x) is not None and abs(E.rec_frame(x) - exp['off_cut']) <= 1]
                if not o or E.rec_offset(o[0]) is None or abs(E.rec_offset(o[0])) != exp['off_by']: bad.append('n%d offset %s (want ±%d)' % (exp['off_cut'], o and E.rec_offset(o[0]), exp['off_by']))
                if not re.search(r'n%d\s*[+-]?%d' % (exp['off_cut'], exp['off_by']), s['line']) and not re.search(r'n%d\s*\+\s*%d' % (exp['off_cut'], exp['off_by']), s['line']): bad.append('summary doesn\'t name the off cut ("n%d +%d f")' % (exp['off_cut'], exp['off_by']))
        return not bad, '; '.join(bad) or s['line']

    @staticmethod
    def eval_trivial(r, d, want, ref_cuts):
        if r.rc != 0: return False, 'exit %s: %s' % (r.rc, r.brief(160))
        recs = E.cut_records(jload(os.path.join(d, 'cuts.json')) or {})
        if not recs: return False, 'no per-cut records in cuts.json'
        flags = {E.rec_frame(x): E.rec_trivial(x) for x in recs}
        if all(v is None for v in flags.values()): return False, 'no "trivial" field in cuts.json'
        got = sorted(f for f, v in flags.items() if v and f is not None)
        ok = len(got) == len(want) and all(min(abs(g - w) for w in want) <= 1 for g in got)
        return ok, 'trivial flagged on %s (want %s: the cuts next to our black shot n188–219)' % (got, want)

    @staticmethod
    def eval_overlap(r, d, ref, ours, bc):
        bad = []
        if r.rc != 0: bad.append('exit %s (%s)' % (r.rc, r.brief(120)))
        if not re.search(r'overlap', r.text, re.I) and not (re.search(r'\b300\b', r.text) and re.search(r'\b240\b', r.text)): bad.append('doesn\'t say the lengths differ / that it compares the overlap')
        m = re.search(r'verify:\s*(\d+)\s*/\s*(\d+)', r.text)
        if not m or m.group(1) != m.group(2) or m.group(2) != '240': bad.append('verify %s (want 240/240)' % (m.group(0) if m else 'missing'))
        sbs = (glob.glob(os.path.join(d, 'sbs*.mp4')) or [None])[0]
        if sbs:
            ok, det, _ = E.sbs_lock(sbs, ref, ours, bc=bc)
            if not ok: bad.append(det)
        return not bad, '; '.join(bad) or 'compared the 240-frame overlap and said so; verify 240/240'

    @staticmethod
    def eval_sheet(path, colors):
        if not os.path.exists(path): return False, 'no sheet.png'
        try: a = np.asarray(Image.open(path).convert('RGB'), np.int16)
        except Exception as e: return False, 'unreadable: %s' % e
        px = a.reshape(-1, 3); miss = []
        for side in ('ref', 'ours'):
            for i, c in enumerate(colors[side]):
                frac = float((np.abs(px - np.array(c)).max(1) <= 18).mean())
                if frac < 3e-4: miss.append('%s shot %d' % (side, i + 1))
        return not miss, ('missing the colour of: %s' % ', '.join(miss)) if miss else '%dx%d sheet holds every reference shot and every one of ours (8 + 8 shot colours found)' % (a.shape[1], a.shape[0])

    # ── track ──
    def track(self, real=True):
        tr = jload(os.path.join(TRK, 'truth.json'))
        o = os.path.join(self.w('track'), 'pan.json')
        r = self.py('track', [os.path.join(TRK, 'pan.mp4'), '--key', '0', '--from', '1', '--to', '21', '--out', o], timeout=3600)
        self.add('track.pan', *self.eval_pan(r, o, tr['pan'], tr['W']))
        o2 = os.path.join(self.w('track'), 'zoom.json')
        r2 = self.py('track', [os.path.join(TRK, 'zoom.mp4'), '--key', '0', '--from', '1', '--to', '12', '--out', o2], timeout=3600)
        self.add('track.zoom', *self.eval_zoom(r2, o2, tr['zoom']))

    @staticmethod
    def frames_of(j):
        best = []
        def walk(o):
            nonlocal best
            if isinstance(o, list) and o and all(isinstance(x, dict) for x in o) and any('tx' in x for x in o):
                if len(o) > len(best): best = o
            elif isinstance(o, dict):
                for v in o.values(): walk(v)
            elif isinstance(o, list):
                for v in o: walk(v)
        walk(j)
        return best

    @staticmethod
    def num(d, *pats):
        for k, v in d.items():
            if any(re.fullmatch(p, k, re.I) for p in pats) and isinstance(v, (int, float)) and not isinstance(v, bool): return float(v)
        return None

    @classmethod
    def eval_pan(cls, r, out, t, W):
        j = jload(out)
        if not j: return False, 'no track.json (exit %s: %s)' % (r.rc, r.brief(200))
        fr = cls.frames_of(j); bad = []
        if len(fr) < 18: return False, '%d per-frame records (want 21)' % len(fr)
        for x in fr:
            n = cls.num(x, r'n', r'frame', r'index', r'i')
            if n is None: bad.append('record without a frame number'); break
            n = int(n); tx, sp, s = cls.num(x, r'tx'), cls.num(x, r'speed.*', r'v', r'velocity'), cls.num(x, r's', r'scale')
            bl = cls.num(x, r'blur', r'sigma', r'blur_?sigma', r'σ')
            if bl is None:                                          # separate x / y blur (today's track.py writes bx, by)
                bx, by = cls.num(x, r'bx', r'blur_?x', r'sigma_?x'), cls.num(x, r'by', r'blur_?y', r'sigma_?y')
                if bx is not None or by is not None: bl = math.hypot(bx or 0, by or 0)
            first = x is fr[0]
            if tx is None or abs(tx - t['p'][n]) > 1.0: bad.append('n%d tx %s (truth %.2f)' % (n, tx, t['p'][n]))
            if (sp is None and not first) or (sp is not None and abs(sp - t['v'][n] * 1080.0 / W) > 1.5): bad.append('n%d speed %s (truth %.2f px/frame on a 1080-wide frame)' % (n, sp, t['v'][n] * 1080.0 / W))
            if s is None or abs(s - 1) > .003: bad.append('n%d scale %s (truth 1)' % (n, s))
            if t['blur'][n] >= 2.0 and (bl is None or abs(bl - t['blur'][n]) > .35 * t['blur'][n]): bad.append('n%d blur %s (truth σ %.2f)' % (n, bl, t['blur'][n]))
        flat = H.flatten(j)
        pk = [v for p, v in flat if re.search(r'peak', p, re.I) and re.search(r'speed|v\b', p, re.I) and isinstance(v, (int, float))]
        pf = [v for p, v in flat if re.search(r'peak', p, re.I) and re.search(r'frame|\bn\b|index|_n$|at', p, re.I) and isinstance(v, (int, float))]
        dc = [v for p, v in flat if re.search(r'decay', p, re.I) and isinstance(v, (int, float))]
        if not pk or abs(pk[0] - t['peak_speed_1080']) > 2: bad.append('summary peak speed %s (truth %.1f)' % (pk[:1], t['peak_speed_1080']))
        if not pf or int(pf[0]) != t['peak_frame']: bad.append('summary peak frame %s (truth n%d)' % (pf[:1], t['peak_frame']))
        if not dc or abs(dc[0] - t['decay']) > .03: bad.append('summary decay %s (truth %.2f per frame)' % (dc[:1], t['decay']))
        return not bad, ('; '.join(bad[:6]) + (' …' if len(bad) > 6 else '')) if bad else '21 frames: tx within 1 px, speed within 1.5 px/frame (×2 for the 540-wide fixture), blur within 35 %%; peak %.1f at n%d, decay %.3f' % (pk[0], int(pf[0]), dc[0])

    @classmethod
    def eval_zoom(cls, r, out, t):
        j = jload(out)
        if not j: return False, 'no track.json (exit %s: %s)' % (r.rc, r.brief(200))
        fr = cls.frames_of(j); bad = []
        if len(fr) < 11: return False, '%d per-frame records (want 12)' % len(fr)
        cx, cy = t['center']
        for x in fr:
            n = int(cls.num(x, r'n', r'frame', r'index', r'i') or -1); s = cls.num(x, r's', r'scale'); tx, ty = cls.num(x, r'tx'), cls.num(x, r'ty')
            if n < 0 or s is None: bad.append('record %s' % x); break
            st = t['s'][n]
            if abs(s - st) > .003: bad.append('n%d scale %.4f (truth %.4f)' % (n, s, st))
            tl = tx is not None and ty is not None and abs(tx - cx * (1 - st)) <= 1.5 and abs(ty - cy * (1 - st)) <= 1.5
            ctr = tx is not None and ty is not None and abs(tx) <= 1.5 and abs(ty) <= 1.5
            if not (tl or ctr): bad.append('n%d t (%s, %s) fits neither a top-left (%.1f, %.1f) nor a centre (0, 0) origin' % (n, tx, ty, cx * (1 - st), cy * (1 - st)))
        return not bad, '; '.join(bad[:5]) or 'scale within 0.003 on every frame of a pure centre zoom (1.015…1.18); translation consistent'

    # ── music ──
    def music(self, real=True):
        tr = jload(os.path.join(CLK, 'truth.json'))
        o = os.path.join(self.w('music'), 'lag.json')
        r = self.py('music', ['compare', os.path.join(CLK, 'ref.wav'), os.path.join(CLK, 'lag40.wav'), '--json', o])
        o2 = os.path.join(self.w('music'), 'same.json')
        r2 = self.py('music', ['compare', os.path.join(CLK, 'ref.wav'), os.path.join(CLK, 'same.wav'), '--json', o2])
        self.add('music.compare-clicks', *self.eval_clicks(r, o, r2, o2, tr))
        o3 = os.path.join(self.w('music'), 'groove.json')
        r3 = self.py('music', ['profile', os.path.join(CLK, 'groove.wav'), '--bpm', '100', '--first-beat', '0.5', '--json', o3])
        o4 = os.path.join(self.w('music'), 'groove-tracker.json')
        r4 = self.py('music', ['profile', os.path.join(CLK, 'groove.wav'), '--json', o4])
        self.add('music.profile-groove', *self.eval_groove(r3, o3, r4, o4, tr['groove']))
        if real:
            miss = H.need_real(H.REF_MP4, FILM)
            if miss: return self.add('music.real', None, miss, True)
            o5 = os.path.join(self.w('music'), 'real.json')
            r5 = self.py('music', ['compare', H.REF_MP4, FILM, '--json', o5])
            self.add('music.real', *self.eval_real(r5, o5), real=True)
            o6 = os.path.join(self.w('music'), 'real-profile.json')
            r6 = self.py('music', ['profile', FILM, '--bpm', '87.46', '--first-beat', '0.3905', '--json', o6])
            self.add('music.real-profile', *self.eval_real_profile(r6, o6), real=True)

    @staticmethod
    def has(vals, x, tol): return any(abs(v - x) <= tol for v in vals)

    @classmethod
    def eval_clicks(cls, r, o, r2, o2, tr):
        j, j2 = jload(o), jload(o2)
        if not j: return False, 'no --json (exit %s: %s)' % (r.rc, r.brief(200))
        num = lambda pat, jj: [v for _, v in H.nums_at(jj, pat)]
        bad = []
        bpm = num(r'bpm|tempo', j)
        if sum(abs(v - 100) <= .15 for v in bpm) < 2: bad.append('bpm %s (want 100 for both)' % bpm[:4])
        fb = num(r'first.?beat|downbeat|phase', j)
        if not (cls.has(fb, tr['ref']['first_beat'], .01) and cls.has(fb, tr['lag40']['first_beat'], .01)): bad.append('first beats %s (want 0.25 and 0.29)' % fb[:6])
        lag = num(r'lag|offset_ms|shift', j)
        if not lag or not 34 <= abs(lag[0]) <= 46: bad.append('lag %s ms (want ±40)' % lag[:2])
        hit = num(r'hit', j)
        if not (cls.has(hit, tr['ref']['hit'], .02) and cls.has(hit, tr['lag40']['hit'], .02)): bad.append('hits %s (want %.2f and %.2f)' % (hit[:4], tr['ref']['hit'], tr['lag40']['hit']))
        q = num(r'quiet|silen', j)
        if not (cls.has(q, tr['ref']['quiet'][0][0], .06) and cls.has(q, tr['lag40']['quiet'][0][0], .06)): bad.append('quiet stretches %s (want starts ≈%.2f and ≈%.2f)' % (q[:6], tr['ref']['quiet'][0][0], tr['lag40']['quiet'][0][0]))
        lag2 = num(r'lag|offset_ms|shift', j2 or {})
        if not lag2 or abs(lag2[0]) > 2: bad.append('identical tracks: lag %s (want 0)' % lag2[:1])
        if not re.search(r'verdict|on (their|the) beat|not on', r.text + json.dumps(j), re.I): bad.append('no verdict line')
        return not bad, '; '.join(bad) or 'bpm 100/100, first beat 0.25/0.29, lag %.1f ms (40 late), quiet ≈19.6 s, hit ≈20.65 s; identical copy → lag %.1f' % (lag[0], lag2[0])

    @staticmethod
    def eval_groove(r, o, r2, o2, g):
        j = jload(o)
        if not j: return False, 'no --json (exit %s: %s)' % (r.rc, r.brief(200))
        lists = [(p, v) for p, v in H.flatten(j)]
        bands = {}
        def walk(x, path=''):
            if isinstance(x, dict):
                for k, v in x.items(): walk(v, path + '/' + k)
            elif isinstance(x, list) and len(x) == 16 and all(isinstance(v, (int, float)) for v in x): bands[path.lower()] = x
            elif isinstance(x, list):
                for i, v in enumerate(x): walk(v, path + '[%d]' % i)
        walk(j)
        pick = lambda rx: next((v for k, v in bands.items() if re.search(rx, k)), None)
        bad = []
        for name, rx, want in (('kick', r'kick|bass|low|sub', g['kick16']), ('snare', r'snare|body|mid', g['snare16']), ('hats', r'hat|high|air|top', g['hats16'])):
            v = pick(rx)
            if v is None: bad.append('no 16-step groove list for %s' % name); continue
            if int(np.argmax(v)) not in want: bad.append('%s peaks on 16th %d (want one of %s)' % (name, int(np.argmax(v)), want))
        if not re.search(r'F\s*maj', json.dumps(j) + r.text, re.I): bad.append('key guess isn\'t F major')
        j2 = jload(o2)
        b2 = [v for _, v in H.nums_at(j2 or {}, r'bpm|tempo')]
        if not b2 or abs(b2[0] - 100) > .15: bad.append('without --bpm the tracker grid reads %s (want 100)' % b2[:1])
        return not bad, '; '.join(bad) or 'kick on beats 1+3, snare on 2+4, hats on the off-beat 8ths; key F major; tracker grid 100 BPM without --bpm'

    @classmethod
    def eval_real(cls, r, o):
        j = jload(o)
        if not j: return False, 'no --json (exit %s: %s)' % (r.rc, r.brief(200))
        num = lambda pat: [v for _, v in H.nums_at(j, pat)]
        bad = []
        bpm, fb, hit, lag = num(r'bpm|tempo'), num(r'first.?beat'), num(r'hit'), num(r'lag|offset_ms')
        if not (cls.has(bpm, 87.46, .011) and cls.has(bpm, 87.45, .015)): bad.append('bpm %s (want 87.46 vs 87.45)' % bpm[:4])
        if not (cls.has(fb, .3905, .002) and cls.has(fb, .391, .003)): bad.append('first beat %s (want 0.3905 vs ~0.391)' % fb[:4])
        if sum(abs(v - 59.94) <= .02 for v in hit) < 2: bad.append('hit %s (want 59.94 s in both)' % hit[:4])
        if not lag or abs(lag[0]) > 12: bad.append('lag %s ms (want 0, within one 11.6 ms onset hop)' % lag[:1])
        return not bad, '; '.join(bad) or 'bpm %s, first beat %s, hit %s, lag %.1f ms — today\'s reading reproduced' % ([round(x, 2) for x in bpm[:2]], [round(x, 4) for x in fb[:2]], [round(x, 3) for x in hit[:2]], lag[0])

    @staticmethod
    def eval_real_profile(r, o):
        j = jload(o)
        if not j: return False, 'no --json (exit %s: %s)' % (r.rc, r.brief(200))
        c = [v for _, v in H.nums_at(j, r'centroid|bright')]
        bad = []
        if not c or abs(c[0] - 3116) > 312: bad.append('centroid %s (today 3116 Hz ±10 %%)' % c[:1])
        if not re.search(r'F\s*maj', json.dumps(j), re.I): bad.append('key guess isn\'t F major (today: F major, r 0.89)')
        return not bad, '; '.join(bad) or 'our film: centroid %.0f Hz (today 3116), key F major — matches today\'s music_profile.py' % c[0]

    # ── temptrack ──
    def temptrack(self, real=True):
        tr = jload(os.path.join(FLM, 'truth.json')); film, ref = os.path.join(FLM, 'film_a.mp4'), os.path.join(FLM, 'ref_a.mp4')
        d = self.w('temptrack'); bad, ok = [], []
        for f in glob.glob(os.path.join(d, '*')):
            if os.path.isfile(f): os.remove(f)
        ra = self.py('temptrack', ['--film', film, '--ref', ref, '--out', os.path.join(d, 'a')])
        rb = self.py('temptrack', ['--film', film, '--ref', ref, '--out', os.path.join(d, 'b.mp4')])
        rc = self.py('temptrack', ['--film', film, '--ref', ref, '--out', os.path.join(d, 'c-tempmusic-PRIVATE.mp4')])
        files = sorted(os.listdir(d))
        for name, r, want in (('a', ra, 'a-tempmusic-PRIVATE.mp4'), ('b.mp4', rb, 'b-tempmusic-PRIVATE.mp4'), ('c-tempmusic-PRIVATE.mp4', rc, 'c-tempmusic-PRIVATE.mp4')):
            (ok if r.rc == 0 and want in files else bad).append('--out %s → %s (exit %s)' % (name, want if want in files else 'no %s' % want, r.rc))
        if 'b.mp4' in files: bad.append('also wrote b.mp4 without the suffix')
        if any('PRIVATE-tempmusic' in f or f.count('tempmusic') > 1 for f in files): bad.append('double suffix: %s' % files)
        for fname in ('film_short2.mp4', 'film_long10.mp4'):
            dd = self.w('temptrack', 'refuse-' + fname[:-4])
            for f in glob.glob(os.path.join(dd, '*')): os.remove(f)
            r = self.py('temptrack', ['--film', os.path.join(FLM, fname), '--ref', ref, '--out', os.path.join(dd, 'x')])
            (ok if r.rc != 0 and not os.listdir(dd) else bad).append('%s (%+d frames) → exit %s, %s' % (fname, -2 if 'short' in fname else 10, r.rc, 'nothing written' if not os.listdir(dd) else 'wrote %s' % os.listdir(dd)))
        d1 = self.w('temptrack', 'one-frame'); r1 = self.py('temptrack', ['--film', os.path.join(FLM, 'film_short1.mp4'), '--ref', ref, '--out', os.path.join(d1, 'x')])
        ok.append('(info: a film 1 frame short → exit %s)' % r1.rc)
        self.add('temptrack.suffix-refuse', not bad, '; '.join(bad + ok))
        out = os.path.join(d, 'a-tempmusic-PRIVATE.mp4')
        okv, dv = E.temptrack_eval(out, film, ref)
        txt = ra.text
        if okv and not (re.search(r'\bPASS\b', txt) and re.search(r'private|never', txt, re.I)): okv, dv = False, 'output verifies, but the tool printed no PASS + private reminder (%s)' % ra.brief(160)
        self.add('temptrack.verify-good', okv, dv)
        res = []
        for mode in ('tamper-audio', 'tamper-video'):
            dt = self.w('temptrack', mode); mark = os.path.join(dt, 'shim.jsonl')
            for f in glob.glob(os.path.join(dt, '*')): os.remove(f)
            r = self.py('temptrack', ['--film', film, '--ref', ref, '--out', os.path.join(dt, 'x')], shim=mode, mark=mark, tamper_dir=dt, stem='x')
            res.append(self.eval_catch(r, mark, r'(?!)'))
        oks = [x[0] for x in res]
        self.add('temptrack.verify-catches', None if None in oks else all(oks), '; '.join(x[1] for x in res))
        if real:
            miss = H.need_real(H.REF_MP4, FILM)
            if miss: return self.add('temptrack.real', None, miss, True)
            dr = self.w('temptrack', 'real')
            for f in glob.glob(os.path.join(dr, '*')): os.remove(f)
            r = self.py('temptrack', ['--film', FILM, '--ref', H.REF_MP4, '--out', os.path.join(dr, 'film')], timeout=1800)
            o = os.path.join(dr, 'film-tempmusic-PRIVATE.mp4')
            okr, dr_ = E.temptrack_eval(o, FILM, H.REF_MP4)
            pa, vv = (H.stream_md5(o, '0:a'), H.stream_md5(o, '0:v', copy=True)) if os.path.exists(o) else (None, None)
            okr = okr and r.rc == 0 and pa == REAL_PCM_MD5 and vv == REAL_VIDEO_MD5
            self.add('temptrack.real', okr, 'exit %s; PCM md5 %s (today %s…), video packets %s (today %s…); %s' % (r.rc, pa, REAL_PCM_MD5[:8], vv, REAL_VIDEO_MD5[:8], dr_), True)


def run_suite(tools, run_dir, report, tag='', real=True, deny=(), parts=('compare', 'track', 'music', 'temptrack')):
    rc = Recreate(tools, run_dir, report, tag, deny)
    ids = {'compare': ['compare.sbs-frame-lock', 'compare.verify-catches-slip', 'compare.cuts-exact', 'compare.cuts-shift1', 'compare.cuts-mixed', 'compare.cuts-trivial', 'compare.cuts-from',
                       'compare.fps-mismatch-exit2', 'compare.fps-multiple', 'compare.overlap', 'compare.sheet', 'compare.options', 'compare.real'],
           'track': ['track.pan', 'track.zoom'], 'music': ['music.compare-clicks', 'music.profile-groove', 'music.real', 'music.real-profile'],
           'temptrack': ['temptrack.suffix-refuse', 'temptrack.verify-good', 'temptrack.verify-catches', 'temptrack.real']}
    for p in parts:
        if not os.path.exists(tools[p]):
            for cid in ids[p]: report.add(cid, False, 'tool missing: %s' % tools[p], tag)
            continue
        try:
            getattr(rc, p)(real)
        except Exception:
            import traceback
            report.add('%s.crashed' % p, False, 'harness error: %s' % traceback.format_exc().strip().splitlines()[-1], tag)
