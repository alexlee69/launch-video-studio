# Dark-card silhouette on a light page: per frame, the card's four edge lines and corners.
# usage: python3 -E quad.py <absdir> <first> <last> <out.json> [--thr 150] [--rows y0,y1] [--cols x0,x1] [--scale 1080]
# Frames wider than 1080 (our 1920 renders) are resized to 1080 so all numbers are in reference px.
import sys, os, json
import numpy as np
from PIL import Image

d, a, b, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
opt = lambda k, dv: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else dv
THR = float(opt('--thr', 150))
rows = [int(v) for v in opt('--rows', '0,608').split(',')]
cols = [int(v) for v in opt('--cols', '0,1080').split(',')]

def gray(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != 1080:
        im = im.crop((0, 0, im.width, round(im.width * 608 / 1080))).resize((1080, 608), Image.LANCZOS)
    return np.asarray(im).astype(float)

def first_cross(v, thr):
    # first index where v drops below thr, subpixel (linear) ; None if never
    below = v < thr
    if not below.any(): return None
    i = int(np.argmax(below))
    if i == 0: return 0.0
    a_, b_ = v[i - 1], v[i]
    return i - 1 + (a_ - thr) / (a_ - b_)

def robust_line(t, x, keep=0.6, iters=4):
    # fit x = p0 + p1*t, iteratively dropping the worst residuals
    t = np.asarray(t, float); x = np.asarray(x, float)
    m = np.ones(len(t), bool)
    for it in range(iters):
        if m.sum() < 4: return None
        A = np.vstack([np.ones(m.sum()), t[m]]).T
        p = np.linalg.lstsq(A, x[m], rcond=None)[0]
        r = np.abs(x - (p[0] + p[1] * t))
        lim = max(0.6, np.quantile(r[m], keep))
        m = r <= lim if it < iters - 1 else m
    resid = float(np.median(np.abs(x[m] - (p[0] + p[1] * t[m]))))
    return [float(p[0]), float(p[1]), resid, int(m.sum())]

res = []
for n in range(a, b + 1):
    g = gray(n)
    G = g[rows[0]:rows[1], cols[0]:cols[1]]
    H, W = G.shape
    xl, xr, yt, yb = {}, {}, {}, {}
    def fcv(M):
        # first crossing below THR along axis 1 for every row of M; returns (valid, pos)
        below = M < THR; ok = below.any(axis=1); i = np.argmax(below, axis=1)
        im1 = np.maximum(i - 1, 0); r = np.arange(M.shape[0])
        a_ = M[r, im1]; b_ = M[r, i]
        pos = np.where(i == 0, 0.0, im1 + (a_ - THR) / np.where(a_ - b_ == 0, 1, a_ - b_))
        return ok, pos
    okL, pL = fcv(G); okR, pR = fcv(G[:, ::-1])
    for y in np.where(okL)[0]: xl[int(y)] = pL[y] + cols[0]; xr[int(y)] = (W - 1 - pR[y]) + cols[0]
    okT, pT = fcv(G.T); okB, pB = fcv(G[::-1, :].T)
    for x in np.where(okT)[0]: yt[int(x)] = pT[x] + rows[0]; yb[int(x)] = (H - 1 - pB[x]) + rows[0]
    if not xl:
        res.append(dict(n=n)); print(json.dumps(dict(n=n))); continue
    ys = np.array(sorted(xl)); top, bot = ys.min(), ys.max(); hh = bot - top
    xs = np.array(sorted(yt)); lef, rig = xs.min(), xs.max(); ww = rig - lef
    sel_y = [y for y in ys if top + 0.2 * hh <= y <= bot - 0.2 * hh]
    sel_x = [x for x in xs if lef + 0.2 * ww <= x <= rig - 0.2 * ww]
    L = robust_line([y + rows[0] for y in sel_y], [xl[y] for y in sel_y])
    R = robust_line([y + rows[0] for y in sel_y], [xr[y] for y in sel_y])
    T = robust_line([x + cols[0] for x in sel_x], [yt[x] for x in sel_x])
    B = robust_line([x + cols[0] for x in sel_x], [yb[x] for x in sel_x])
    def isect(V, Hh):
        # V: x = v0 + v1*y ; Hh: y = h0 + h1*x
        if V is None or Hh is None: return None
        y = (Hh[0] + Hh[1] * V[0]) / (1 - Hh[1] * V[1]); x = V[0] + V[1] * y
        return [round(x, 2), round(y, 2)]
    r = dict(n=n, TL=isect(L, T), TR=isect(R, T), BR=isect(R, B), BL=isect(L, B),
             L=[round(v, 4) for v in L] if L else None, R=[round(v, 4) for v in R] if R else None,
             T=[round(v, 4) for v in T] if T else None, B=[round(v, 4) for v in B] if B else None,
             bbox=[round(float(lef + cols[0]), 1), round(float(top + rows[0]), 1), round(float(rig + cols[0]), 1), round(float(bot + rows[0]), 1)])
    res.append(r); print(json.dumps(r), flush=True)
json.dump(res, open(out, 'w'), indent=0)
