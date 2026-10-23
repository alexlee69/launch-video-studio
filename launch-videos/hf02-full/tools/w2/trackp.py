# Pairwise (frame n-1 -> n) similarity registration, no blur term, masked; chained into a cumulative camera
# relative to the first frame. Robust where a single key frame drifts (non-rigid footage).
# usage: trackp.py <absdir> <first> <last> <out.json> [--mask x0,y0,x1,y1] [--half] [--blur s]  (first > last runs backwards)
import sys, os, json, math
import numpy as np
from PIL import Image
d, a, b, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
half = '--half' in sys.argv; SC = 0.5 if half else 1.0
MASK = [int(v) for v in sys.argv[sys.argv.index('--mask') + 1].split(',')] if '--mask' in sys.argv else [0, 0, 1080, 608]
BL = float(sys.argv[sys.argv.index('--blur') + 1]) if '--blur' in sys.argv else 0.0
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = im.resize((1080, round(im.height * 1080 / im.width)), Image.LANCZOS).crop((0, 0, 1080, 608))
    if SC != 1: im = im.resize((round(im.width * SC), round(im.height * SC)), Image.LANCZOS)
    A = np.asarray(im, dtype=np.float64)
    return A
x0, y0, x1, y1 = [round(v * SC) for v in MASK]
def sample(img, u, v):
    H, W = img.shape
    u0 = np.floor(u).astype(int); v0 = np.floor(v).astype(int); du = u - u0; dv = v - v0
    out = np.zeros_like(u)
    for oy, wy in ((0, 1 - dv), (1, dv)):
        for ox, wx in ((0, 1 - du), (1, du)):
            uu = np.clip(u0 + ox, 0, W - 1); vv = np.clip(v0 + oy, 0, H - 1)
            out += wy * wx * img[vv, uu]
    return out
ys, xs = np.mgrid[y0:y1, x0:x1].astype(np.float64)
def ncc(A, B):
    A = A - A.mean(); B = B - B.mean()
    return float((A * B).sum() / (math.sqrt((A * A).sum() * (B * B).sum()) + 1e-9))
def nm(f, x0_, steps, iters=120):
    n = len(x0_); pts = [np.array(x0_, float)]
    for i in range(n):
        p = np.array(x0_, float); p[i] += steps[i]; pts.append(p)
    vals = [f(p) for p in pts]
    for _ in range(iters):
        o = np.argsort(vals); pts = [pts[i] for i in o]; vals = [vals[i] for i in o]
        c = np.mean(pts[:-1], axis=0); xr = c + (c - pts[-1]); fr = f(xr)
        if fr < vals[0]:
            xe = c + 2 * (c - pts[-1]); fe = f(xe)
            if fe < fr: pts[-1], vals[-1] = xe, fe
            else: pts[-1], vals[-1] = xr, fr
        elif fr < vals[-2]: pts[-1], vals[-1] = xr, fr
        else:
            xc = c + 0.5 * (pts[-1] - c); fc = f(xc)
            if fc < vals[-1]: pts[-1], vals[-1] = xc, fc
            else:
                for i in range(1, len(pts)): pts[i] = pts[0] + 0.5 * (pts[i] - pts[0]); vals[i] = f(pts[i])
    i = int(np.argmin(vals)); return pts[i], vals[i]
step = 1 if b >= a else -1
prev = load(a)
S, TX, TY = 1.0, 0.0, 0.0     # cumulative: x_n = S * x_a + T  (1080 px)
res = [dict(n=a, s=1.0, tx=0.0, ty=0.0, ds=1.0, dtx=0.0, dty=0.0, ncc=1.0)]
print(json.dumps(res[0]), flush=True)
guess = [1.0, 0.0, 0.0]
for n in range(a + step, b + step, step):
    cur = load(n)
    F = cur[y0:y1, x0:x1]
    # model: cur(x) = prev((x - t)/s), params in 1080 px
    def f(p):
        s, tx, ty = p
        w = sample(prev, (xs - tx * SC) / s, (ys - ty * SC) / s)
        return -ncc(F, w)
    best = None
    for st in (guess, [1.0, 0.0, 0.0]):
        p, v = nm(f, st, [0.01, 6, 6], 90)
        p, v = nm(f, p, [0.002, 1.5, 1.5], 60)
        if best is None or v < best[1]: best = (p, v)
        if best[1] < -0.995: break
    p, v = best
    ds, dtx, dty = p
    # compose: x_n = ds * x_{n-1} + dt = ds*(S x_a + T) + dt
    S, TX, TY = ds * S, ds * TX + dtx, ds * TY + dty
    r = dict(n=n, s=round(S, 5), tx=round(TX, 2), ty=round(TY, 2), ds=round(ds, 5), dtx=round(dtx, 2), dty=round(dty, 2), ncc=round(-v, 4))
    res.append(r); print(json.dumps(r), flush=True)
    guess = [ds, dtx, dty] if -v > 0.9 else [1.0, 0.0, 0.0]
    prev = cur
json.dump(res, open(out, 'w'), indent=0)
