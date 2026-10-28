# -*- coding: utf-8 -*-
# Measure a shot's camera: similarity + blur registration of every frame against one sharp key frame of the same shot,
# frame n ≈ blur(R((x − t)/s)) (scale s about the top-left, shift t, Gaussian blur σx/σy), fitted by Nelder–Mead on NCC.
# Frames are read from the video by index, so frame numbers are that file's: a 60 fps lv.mjs master numbers twice as
# fast as a 30 fps reference — measure its 30 fps conform (RECREATE.md §5). numpy only: ~2.5–3 s a frame at --half on a
# 1080×608 reference, ~8 s at full size, so run one process per shot in parallel.
#
#   python3 track.py <video> --key N --from A --to B [--roi x,y,w,h] [--scale-to WxH] [--half] [--init s,tx,ty] --out track.json
#
#   --from > --to tracks backwards from the key (start each run at the key).
#   --scale-to WxH measures every frame at that size (a 1920×1080 render vs a 1080×608 reference: --scale-to 1080x608
#     on ours, so the readings compare 1:1); --roi x,y,w,h fits only that region (pixels of the measured frame) — the
#     part that moves as one picture; --half fits at half size (4× faster; readings stay in measured-frame pixels).
# Per frame: s, tx, ty, blur σx/σy (bx, by), ncc, and the speed in px/frame normalised to a 1080-wide frame. Summary:
# peak speed and its frame, the build and decay ratios per frame around it, blur/speed at the peak.
# Traps: a fit is only valid while the same picture is on screen (split at cuts); ncc < 0.9 = the model doesn't hold
# there (3D, parallax, new elements). Blur on a cut frame over-reads ~2× when other elements fade at the same time:
# calibrate by tracking your own render, where the applied σ is known.
# HDR (HLG / PQ) is measured after the film engine's conversion to SDR. --out is never the video (same path, hard link or
# symlink: refused) and is written whole (a temp file + one rename).
# exit 0 done · 2 bad input (a missing or undecodable video, a frame past its end …)
import os, sys, json, math, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True                  # no __pycache__ inside the skill
import media
from media import np, Image, UserError


def nm(f, x0, steps, iters=160):
    n = len(x0); pts = [np.array(x0, float)]
    for i in range(n):
        p = np.array(x0, float); p[i] += steps[i]; pts.append(p)
    vals = [f(p) for p in pts]
    for _ in range(iters):
        o = np.argsort(vals); pts = [pts[i] for i in o]; vals = [vals[i] for i in o]
        c = np.mean(pts[:-1], axis=0)
        xr = c + (c - pts[-1]); fr = f(xr)
        if fr < vals[0]:
            xe = c + 2 * (c - pts[-1]); fe = f(xe)
            if fe < fr: pts[-1], vals[-1] = xe, fe
            else: pts[-1], vals[-1] = xr, fr
        elif fr < vals[-2]: pts[-1], vals[-1] = xr, fr
        else:
            xc = c + .5 * (pts[-1] - c); fc = f(xc)
            if fc < vals[-1]: pts[-1], vals[-1] = xc, fc
            else:
                for i in range(1, len(pts)):
                    pts[i] = pts[0] + .5 * (pts[i] - pts[0]); vals[i] = f(pts[i])
    i = int(np.argmin(vals)); return pts[i], vals[i]


def main():
    ap = argparse.ArgumentParser(description='measure a shot\'s camera (scale, shift, blur) against a sharp key frame')
    ap.add_argument('video'); ap.add_argument('--key', type=int, required=True); ap.add_argument('--from', dest='frm', type=int, required=True)
    ap.add_argument('--to', type=int, required=True); ap.add_argument('--roi'); ap.add_argument('--scale-to'); ap.add_argument('--half', action='store_true')
    ap.add_argument('--init'); ap.add_argument('--out', required=True)
    A = ap.parse_args()
    media.guard_outputs([A.out], [A.video])                                     # before minutes of fitting, not after
    P = media.probe(A.video)
    if not P['video']:
        raise UserError('%s has no video stream' % P['name'])
    lo, hi = min(A.key, A.frm, A.to), max(A.key, A.frm, A.to)
    if lo < 0:
        raise UserError('frame numbers start at 0')
    nf = media.count_frames(P)
    if nf and hi >= nf:
        raise UserError('%s has %d frames; frame %d is past its end' % (P['name'], nf, hi))
    size = None
    if A.scale_to:
        try:
            size = tuple(int(v) for v in A.scale_to.lower().split('x'))
            assert len(size) == 2 and min(size) > 8
        except (ValueError, AssertionError):
            raise UserError('--scale-to wants WxH, e.g. 1080x608')
    init = None
    if A.init:
        try:
            init = [float(v) for v in A.init.split(',')]; assert len(init) == 3
        except (ValueError, AssertionError):
            raise UserError('--init wants s,tx,ty, e.g. 1,0,0')
    SC = .5 if A.half else 1.0
    need = set(range(min(A.frm, A.to), max(A.frm, A.to) + 1)) | {A.key}
    raw = {}
    for k, f in enumerate(media.frames(A.video, None, 'rgb24', lo, hi)):
        if lo + k in need:
            raw[lo + k] = f
    if len(raw) < len(need):
        raise UserError('%s has %d frames; frame %d is past its end' % (P['name'], lo + len(raw) if raw else 0, max(need - set(raw))))
    def load(n):
        im = Image.fromarray(raw[n]).convert('L')
        if size and im.size != size: im = im.resize(size, Image.LANCZOS)
        if SC != 1: im = im.resize((round(im.width * SC), round(im.height * SC)), Image.LANCZOS)
        a = 255.0 - np.asarray(im, dtype=np.float64)
        return a - np.median(a)
    Wm = size[0] if size else P['video']['w']                                 # the measured frame's width (readings are in its pixels)
    R = load(A.key); H, W = R.shape
    roi = (slice(0, H), slice(0, W))
    if A.roi:
        try:
            x, y, w, h = [float(v) for v in A.roi.split(',')]
        except ValueError:
            raise UserError('--roi wants x,y,w,h in pixels of the measured frame')
        x0, y0, x1, y1 = [int(round(v * SC)) for v in (x, y, x + w, y + h)]
        if not (0 <= x0 < x1 <= W and 0 <= y0 < y1 <= H and (x1 - x0) * (y1 - y0) >= 400):
            raise UserError('--roi %s is outside the %d×%d measured frame or too small' % (A.roi, round(W / SC), round(H / SC)))
        roi = (slice(y0, y1), slice(x0, x1))
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float64)
    fy = np.fft.fftfreq(H)[:, None]; fx = np.fft.rfftfreq(W)[None, :]
    def sample(img, u, v):
        u0 = np.floor(u).astype(int); v0 = np.floor(v).astype(int); du = u - u0; dv = v - v0
        out = np.zeros_like(u)
        for oy, wy in ((0, 1 - dv), (1, dv)):
            for ox, wx in ((0, 1 - du), (1, du)):
                uu = u0 + ox; vv = v0 + oy
                ok = (uu >= 0) & (uu < W) & (vv >= 0) & (vv < H)
                val = np.zeros_like(u); val[ok] = img[vv[ok], uu[ok]]
                out += wy * wx * val
        return out
    def render(p):
        s, tx, ty, sx, sy = p
        w = sample(R, (xs - tx * SC) / s, (ys - ty * SC) / s)
        sx = abs(sx) * SC; sy = abs(sy) * SC
        if sx > .05 or sy > .05:
            w = np.fft.irfft2(np.fft.rfft2(w) * np.exp(-2 * math.pi ** 2 * (sx ** 2 * fx ** 2 + sy ** 2 * fy ** 2)), s=w.shape)
        return w
    def ncc(A_, B_):
        A_ = A_ - A_.mean(); B_ = B_ - B_.mean()
        return float((A_ * B_).sum() / (math.sqrt((A_ * A_).sum() * (B_ * B_).sum()) + 1e-9))
    res, prev = [], (init[:] + [0.0, 0.0] if init else [1.0, 0.0, 0.0, 0.0, 0.0])
    for n in (range(A.frm, A.to + 1) if A.to >= A.frm else range(A.frm, A.to - 1, -1)):
        Fr = load(n)[roi]
        f = lambda p: -ncc(Fr, render(p)[roi])
        best = None
        for k, start in enumerate([prev, [prev[0], prev[1], prev[2], max(3.0, prev[3] * 1.5), max(3.0, prev[4] * 1.5)]]):
            if k == 1 and best[1] < -.985: break
            p, v = nm(f, start, [.03 * start[0], 12, 12, 2.5, 2.5], 110)
            p, v = nm(f, p, [.006 * p[0], 3, 3, 1.0, 1.0], 70)
            if best is None or v < best[1]: best = (p, v)
        p, v = best
        prev = [p[0], p[1], p[2], p[3], p[4]]
        r = dict(n=n, s=round(p[0], 5), tx=round(p[1], 2), ty=round(p[2], 2), bx=round(abs(p[3]), 2), by=round(abs(p[4]), 2), ncc=round(-v, 4))
        res.append(r); print(json.dumps(r), flush=True)
    # speeds in time order, normalised to a 1080-wide frame
    k1080 = 1080.0 / Wm
    seq = sorted(res, key=lambda r: r['n'])
    for i, r in enumerate(seq):
        q = seq[i - 1] if i else None
        r['speed'] = round(math.hypot(r['tx'] - q['tx'], r['ty'] - q['ty']) * k1080, 2) if q else None
        r['zoom_pct'] = round((r['s'] / q['s'] - 1) * 100, 3) if q else None
    sp = [r for r in seq if r['speed'] is not None]
    summ = {'frames': len(res), 'unreliable': [r['n'] for r in seq if r['ncc'] < .9]}
    if sp:
        pk = max(sp, key=lambda r: r['speed'])
        i = seq.index(pk)
        def ratio(rng):
            rs = [seq[j]['speed'] / seq[j - 1]['speed'] for j in rng if 0 < j < len(seq) and seq[j - 1]['speed'] and seq[j]['speed'] and seq[j - 1]['speed'] > .3 and seq[j]['speed'] > .3]
            return round(math.exp(sum(math.log(x) for x in rs) / len(rs)), 3) if rs else None
        blur = math.hypot(pk['bx'], pk['by']) * k1080
        summ.update({'peak_speed': pk['speed'], 'peak_frame': pk['n'], 'build_per_frame': ratio(range(max(1, i - 4), i + 1)),
                     'decay_per_frame': ratio(range(i + 1, min(len(seq), i + 6))), 'blur_at_peak': round(blur, 2),
                     'blur_per_speed_at_peak': round(blur / pk['speed'], 3) if pk['speed'] else None})
    out = {'video': os.path.abspath(A.video), 'key': A.key, 'from': A.frm, 'to': A.to, 'measured_size': [Wm, size[1] if size else P['video']['h']],
           'half': A.half, 'roi': A.roi, 'init': init, 'frames': res, 'summary': summ}
    out['fps'] = P['video']['fps']
    media.write_json(A.out, out, indent=0)
    s = summ
    if sp:
        per = lambda v: 'n/a' if v is None else '×%s/f' % v       # no ratio when the range starts or ends at the peak
        print('peak %.2f px/f (1080-wide) at n%d of a %g fps video · build %s · decay %s · blur at the peak %.2f px = %.2f × speed (house rule ≈ 0.2; a cut frame over-reads ~2×)%s'
              % (s['peak_speed'], s['peak_frame'], round(P['video']['fps'], 3), per(s['build_per_frame']), per(s['decay_per_frame']), s['blur_at_peak'], s['blur_per_speed_at_peak'] or 0,
                 ' · ncc < 0.9 (model doesn\'t hold): %s' % ', '.join('n%d' % n for n in s['unreliable']) if s['unreliable'] else ''))
    print('→ %s' % A.out)
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except UserError as e:
        media.die(str(e))
