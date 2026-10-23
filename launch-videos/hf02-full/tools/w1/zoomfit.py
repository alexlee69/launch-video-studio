# Zoom-with-radial-blur fit for push-in cut frames: frame(n) ≈ mean_k R(O + (x - O) / (s * e^{δ·(k/(K-1) - 1/2)})) over a ROI of the key frame.
# Fits s, Ox, Oy, δ (log-scale smear during the shutter = blur along the radius). usage: zoomfit.py <dir> <key> <n1,n2,..> <roi x0,y0,x1,y1> [--init s,ox,oy,d]
import sys, os, json, math
import numpy as np
from PIL import Image
d, key = sys.argv[1], int(sys.argv[2]); ns = [int(v) for v in sys.argv[3].split(',')]
roi = [float(v) for v in sys.argv[4].split(',')]
init = [float(v) for v in sys.argv[sys.argv.index('--init') + 1].split(',')] if '--init' in sys.argv else [1.5, 546, 300, 0.05]
SC = 0.5
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L').crop((0, 0, 1920, 1080)).resize((1080, 608), Image.LANCZOS)
    im = im.resize((540, 304), Image.LANCZOS)
    a = 255.0 - np.asarray(im, dtype=np.float64); return a
R = load(key); H, W = R.shape
ys, xs = np.mgrid[0:H, 0:W].astype(np.float64)
def sample(img, u, v):
    u0 = np.floor(u).astype(int); v0 = np.floor(v).astype(int); du = u - u0; dv = v - v0
    out = np.zeros_like(u)
    for oy, wy in ((0, 1 - dv), (1, dv)):
        for ox, wx in ((0, 1 - du), (1, du)):
            uu = u0 + ox; vv = v0 + oy; ok = (uu >= 0) & (uu < W) & (vv >= 0) & (vv < H)
            val = np.zeros_like(u); val[ok] = img[vv[ok], uu[ok]]; out += wy * wx * val
    return out
K = 11
def render(p):
    s, ox, oy, dl = p; acc = np.zeros_like(xs)
    for k in range(K):
        sk = s * math.exp(dl * (k / (K - 1) - 0.5))
        acc += sample(R, ox * SC + (xs - ox * SC) / sk, oy * SC + (ys - oy * SC) / sk)
    u = ox * SC + (xs - ox * SC) / s; v = oy * SC + (ys - oy * SC) / s
    m = (u >= roi[0] * SC) & (u <= roi[2] * SC) & (v >= roi[1] * SC) & (v <= roi[3] * SC)
    return acc / K, m
def nm(f, x0, steps, iters):
    pts = [np.array(x0, float)]
    for i in range(len(x0)):
        q = np.array(x0, float); q[i] += steps[i]; pts.append(q)
    vals = [f(q) for q in pts]
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
prev = init
for n in ns:
    F = load(n)
    def cost(p):
        if p[0] < 0.5 or p[3] < 0 or p[3] > 1.5: return 1.0
        Rw, m = render(p)
        if m.sum() < 1500: return 1.0
        A = Rw[m] - Rw[m].mean(); B = F[m] - F[m].mean()
        return -float((A * B).sum() / (math.sqrt((A * A).sum() * (B * B).sum()) + 1e-9))
    best = None
    for st in (prev, [prev[0] * 1.15, prev[1], prev[2], prev[3] * 1.5 + 0.02]):
        p, v = nm(cost, st, [0.06 * st[0], 15, 15, 0.05 + 0.3 * st[3]], 120)
        p, v = nm(cost, p, [0.01 * p[0], 3, 3, 0.02 + 0.1 * p[3]], 80)
        if best is None or v < best[1]: best = (p, v)
    p, v = best; prev = list(p)
    print(json.dumps(dict(n=n, s=round(p[0], 4), ox=round(p[1], 1), oy=round(p[2], 1), dlog=round(p[3], 4), ncc=round(-v, 4))), flush=True)
