# Vertical edge positions + blur of a bright horizontal band (bar) in a column strip: fit a box ⊗ gaussian profile.
# usage: vedge.py <absdir> <first> <last> x0,x1 [ylo,yhi]
import sys, os, json, math
import numpy as np
from PIL import Image
d, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
x0, x1 = [int(v) for v in sys.argv[4].split(',')]
ylo, yhi = ([int(v) for v in sys.argv[5].split(',')] if len(sys.argv) > 5 else (250, 608))
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = im.resize((1080, round(im.height * 1080 / im.width)), Image.LANCZOS).crop((0, 0, 1080, 608))
    return np.asarray(im, dtype=np.float64)
def verf(x):
    # Abramowitz-Stegun 7.1.26 (|err| < 1.5e-7)
    s = np.sign(x); x = np.abs(x); t = 1 / (1 + 0.3275911 * x)
    y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * np.exp(-x * x)
    return s * y
ys = np.arange(ylo, yhi, dtype=np.float64)
def model(p):
    t, bt, s, hi, lo = p
    s = max(abs(s), 0.3)
    return lo + (hi - lo) * 0.5 * (verf((ys - t) / (s * math.sqrt(2))) - verf((ys - bt) / (s * math.sqrt(2))))
def nm(f, x0, steps, iters=400):
    n = len(x0); pts = [np.array(x0, float)]
    for i in range(n):
        p = np.array(x0, float); p[i] += steps[i]; pts.append(p)
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
for n in range(a, b + 1):
    L = load(n)
    prof = L[ylo:yhi, x0:x1].mean(axis=1)
    hi = prof.max(); lo = np.median(prof)
    idx = np.where(prof > (hi + lo) / 2)[0]
    if len(idx) == 0: print(json.dumps({'n': n, 'none': 1})); continue
    p0 = [ys[idx[0]], ys[idx[-1]], 3.0, 248.0, lo]
    f = lambda p: float(((model(p) - prof) ** 2).sum())
    p, v = nm(f, p0, [5, 5, 3, 5, 10])
    p, v = nm(f, p, [1, 1, 1, 2, 3])
    print(json.dumps(dict(n=n, top=round(p[0], 1), bot=round(p[1], 1), h=round(p[1] - p[0], 1), sig=round(abs(p[2]), 2), hi=round(p[3], 1), lo=round(p[4], 1), rms=round(math.sqrt(v / len(ys)), 2))))
