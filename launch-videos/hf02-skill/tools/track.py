# Similarity + blur registration of reference frames: frame n ≈ blur(R((x - t)/s)), R = a sharp key frame.
# usage: track.py <absdir> <key> <first> <last> <out.json> [--half] [--init s,tx,ty]
import sys, os, json, math
import numpy as np
from PIL import Image
d, key, a, b, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
half = '--half' in sys.argv
init = None
if '--init' in sys.argv:
    init = [float(v) for v in sys.argv[sys.argv.index('--init') + 1].split(',')]
SC = 0.5 if half else 1.0
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if SC != 1: im = im.resize((round(im.width * SC), round(im.height * SC)), Image.LANCZOS)
    a = 255.0 - np.asarray(im, dtype=np.float64)
    return a - np.median(a)
R = load(key); H, W = R.shape
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
    if sx > 0.05 or sy > 0.05:
        Fw = np.fft.rfft2(w) * np.exp(-2 * math.pi ** 2 * (sx ** 2 * fx ** 2 + sy ** 2 * fy ** 2))
        w = np.fft.irfft2(Fw, s=w.shape)
    return w
def ncc(A, B):
    A = A - A.mean(); B = B - B.mean()
    return float((A * B).sum() / (math.sqrt((A * A).sum() * (B * B).sum()) + 1e-9))
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
            xc = c + 0.5 * (pts[-1] - c); fc = f(xc)
            if fc < vals[-1]: pts[-1], vals[-1] = xc, fc
            else:
                for i in range(1, len(pts)):
                    pts[i] = pts[0] + 0.5 * (pts[i] - pts[0]); vals[i] = f(pts[i])
    i = int(np.argmin(vals)); return pts[i], vals[i]
res = []; prev = init[:] + [0.0, 0.0] if init else [1.0, 0.0, 0.0, 0.0, 0.0]
for n in (range(a, b + 1) if b >= a else range(a, b - 1, -1)):
    F = load(n)
    f = lambda p: -ncc(F, render(p))
    best = None
    for k, start in enumerate([prev, [prev[0], prev[1], prev[2], max(3.0, prev[3]*1.5), max(3.0, prev[4]*1.5)]]):
        if k == 1 and best[1] < -0.985: break
        p, v = nm(f, start, [0.03 * start[0], 12, 12, 2.5, 2.5], 110)
        p, v = nm(f, p, [0.006 * p[0], 3, 3, 1.0, 1.0], 70)
        if best is None or v < best[1]: best = (p, v)
    p, v = best
    prev = [p[0], p[1], p[2], p[3], p[4]]
    r = dict(n=n, s=round(p[0], 5), tx=round(p[1], 2), ty=round(p[2], 2), bx=round(abs(p[3]), 2), by=round(abs(p[4]), 2), ncc=round(-v, 4))
    res.append(r); print(json.dumps(r), flush=True)
json.dump(res, open(out, 'w'), indent=0)
