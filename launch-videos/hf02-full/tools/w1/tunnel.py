# Corridor flow between consecutive frames: frame B(q) ~ A(VP + q / (1 + k * rho(q))), rho = sqrt((x/a)^2 + y^2), q = p - VP.
# A point at depth d moves to depth d - v; for a tunnel wall rho ~ f R / d, so k = v / (f R): the forward speed in wall units.
# Fits VPx, VPy, k, a per pair (n, n+1) by Nelder-Mead on masked NCC (half res). Masks: saturated pixels (characters),
# a central disc (r < rmin) and an optional box (e.g. a static watermark).
# usage: tunnel.py <absdir> <first> <last> <out.json> [--box x0,y0,x1,y1] [--rmin 50] [--init vx,vy,k,a]
import sys, os, json, math
import numpy as np
from PIL import Image
d, a, b, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
opt = lambda k, dflt: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else dflt
box = [float(v) for v in opt('--box', '0,0,0,0').split(',')]
rmin = float(opt('--rmin', '50'))
init = [float(v) for v in opt('--init', '540,300,0.0008,1.0').split(',')]
SC = 0.5
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('RGB')
    if im.width != 1080: im = im.crop((0, 0, 1920, 1080)).resize((1080, 608), Image.LANCZOS)
    im = im.resize((540, 304), Image.LANCZOS)
    rgb = np.asarray(im, dtype=np.float64)
    g = rgb.mean(axis=2)
    mx = rgb.max(axis=2); mn = rgb.min(axis=2); sat = (mx - mn) / (mx + 1e-6)
    return g, (sat > 0.35) & (mx > 60)
H, W = 304, 540
ys, xs = np.mgrid[0:H, 0:W].astype(np.float64)
def sample(img, u, v):
    u0 = np.floor(u).astype(int); v0 = np.floor(v).astype(int); du = u - u0; dv = v - v0
    out = np.zeros_like(u); ok_all = (u >= 0) & (u <= W - 1) & (v >= 0) & (v <= H - 1)
    for oy, wy in ((0, 1 - dv), (1, dv)):
        for ox, wx in ((0, 1 - du), (1, du)):
            uu = np.clip(u0 + ox, 0, W - 1); vv = np.clip(v0 + oy, 0, H - 1)
            out += wy * wx * img[vv, uu]
    return out, ok_all
def warp(A, p):
    vx, vy, k, asp = p
    qx = xs - vx * SC; qy = ys - vy * SC
    rho = np.sqrt((qx / asp) ** 2 + qy ** 2) / SC          # in full-res px
    f = 1.0 / (1.0 + k * rho)
    return sample(A, vx * SC + qx * f, vy * SC + qy * f)
res = []; prev = init[:]
inbox = (xs >= box[0] * SC) & (xs <= box[2] * SC) & (ys >= box[1] * SC) & (ys <= box[3] * SC)
for n in range(a, b):
    A, mA = load(n); B, mB = load(n + 1)
    def cost(p):
        if p[3] < 0.5 or p[3] > 2.6 or p[2] < 0 or abs(p[0] - 540) > 60 or abs(p[1] - 304) > 40: return 1.0
        Wp, ok = warp(A, p)
        mW, _ = warp(mA.astype(np.float64), p)
        r = np.sqrt((xs - p[0] * SC) ** 2 + (ys - p[1] * SC) ** 2) / SC
        m = ok & ~mB & (mW < 0.2) & ~inbox & (r > rmin)
        if m.sum() < 2000: return 1.0
        X = Wp[m] - Wp[m].mean(); Y = B[m] - B[m].mean()
        return -float((X * Y).sum() / (math.sqrt((X * X).sum() * (Y * Y).sum()) + 1e-9))
    # Nelder-Mead
    def nm(x0, steps, iters):
        pts = [np.array(x0, float)]
        for i in range(len(x0)):
            q = np.array(x0, float); q[i] += steps[i]; pts.append(q)
        vals = [cost(q) for q in pts]
        for _ in range(iters):
            o = np.argsort(vals); pts = [pts[i] for i in o]; vals = [vals[i] for i in o]
            c = np.mean(pts[:-1], axis=0); xr = c + (c - pts[-1]); fr = cost(xr)
            if fr < vals[0]:
                xe = c + 2 * (c - pts[-1]); fe = cost(xe)
                if fe < fr: pts[-1], vals[-1] = xe, fe
                else: pts[-1], vals[-1] = xr, fr
            elif fr < vals[-2]: pts[-1], vals[-1] = xr, fr
            else:
                xc = c + 0.5 * (pts[-1] - c); fc = cost(xc)
                if fc < vals[-1]: pts[-1], vals[-1] = xc, fc
                else:
                    for i in range(1, len(pts)): pts[i] = pts[0] + 0.5 * (pts[i] - pts[0]); vals[i] = cost(pts[i])
        i = int(np.argmin(vals)); return pts[i], vals[i]
    best = None
    for start in (prev, [prev[0], prev[1], prev[2] * 2 + 0.0005, prev[3]], [prev[0], prev[1], max(0.0, prev[2] * 0.4), prev[3]], [532, 304, 0.002, 1.15]):
        p, v = nm(start, [25, 20, 0.6 * start[2] + 0.0003, 0.15], 140)
        p, v = nm(p, [5, 5, 0.15 * p[2] + 0.0001, 0.04], 80)
        if best is None or v < best[1]: best = (p, v)
    p, v = best; prev = list(p) if -v > 0.6 else [532, 304, max(0.0012, p[2]), 1.15]   # never carry a lost fit forward
    r = dict(n=n, vx=round(p[0], 1), vy=round(p[1], 1), k=round(p[2], 6), asp=round(p[3], 3), ncc=round(-v, 4))
    res.append(r); print(json.dumps(r), flush=True)
json.dump(res, open(out, 'w'), indent=0)
