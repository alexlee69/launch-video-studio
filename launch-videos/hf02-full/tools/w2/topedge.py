# Horizontal edge (top of a band of cards) position + gaussian sigma from the full-width row profile, erf fit.
# usage: topedge.py <absdir> <first> <last> <guess_y> [x0,x1] [--dark-below]
import sys, os, json, math
import numpy as np
from PIL import Image
d, a, b, g = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), float(sys.argv[4])
x0, x1 = ([int(v) for v in sys.argv[5].split(',')] if len(sys.argv) > 5 and not sys.argv[5].startswith('--') else (0, 1080))
def verf(x):
    s = np.sign(x); x = np.abs(x); t = 1 / (1 + 0.3275911 * x)
    y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * np.exp(-x * x)
    return s * y
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = im.resize((1080, round(im.height * 1080 / im.width)), Image.LANCZOS).crop((0, 0, 1080, 608))
    return np.asarray(im, dtype=np.float64)
for n in range(a, b + 1):
    L = load(n)
    prof = L[:, x0:x1].mean(axis=1)
    # find crossing nearest guess: search for steepest descent in a window
    lo_i = int(max(1, g - 120)); hi_i = int(min(606, g + 120))
    seg = prof[lo_i:hi_i]
    dif = np.diff(seg)
    i = int(np.argmin(dif)) + lo_i
    W = 40
    ys = np.arange(max(0, i - W), min(608, i + W)).astype(float); p = prof[max(0, i - W):min(608, i + W)]
    best = None
    for s in np.arange(0.3, 40, 0.1):
        for e in np.arange(i - 6, i + 6, 0.25):
            m = 0.5 * (1 - verf((ys - e) / (s * math.sqrt(2))))
            A = np.vstack([m, np.ones_like(m)]).T
            coef, res, *_ = np.linalg.lstsq(A, p, rcond=None)
            r = float(((A @ coef - p) ** 2).sum())
            if best is None or r < best[0]: best = (r, e, s, coef)
    r, e, s, coef = best
    print(json.dumps(dict(n=n, edge=round(e, 2), sig=round(s, 2), step=round(coef[0], 1), rms=round(math.sqrt(r / len(ys)), 2))))
