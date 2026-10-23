# White pill (prompt bar / bubble) on a darker picture: bbox from the near-white mask.
# usage: bar.py <absdir> <first> <last> x0,y0,x1,y1 [--min 215] [--frac 0.5]
import sys, os, json
import numpy as np
from PIL import Image
d, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
x0, y0, x1, y1 = [int(v) for v in sys.argv[4].split(',')]
mn = float(sys.argv[sys.argv.index('--min') + 1]) if '--min' in sys.argv else 215
frac = float(sys.argv[sys.argv.index('--frac') + 1]) if '--frac' in sys.argv else 0.5
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('RGB')
    if im.width != 1080: im = im.resize((1080, round(im.height * 1080 / im.width)), Image.LANCZOS).crop((0, 0, 1080, 608))
    return np.asarray(im, dtype=np.float64)
def span(p, f):
    m = p.max()
    if m <= 0.02: return None
    idx = np.where(p >= f * m)[0]
    i0, i1 = idx[0], idx[-1]
    def cr(i, j):
        if i < 0 or j >= len(p): return float(max(0, min(i, j)))
        a, b = p[i], p[j]; return i + (f * m - a) / (b - a) * (j - i) if b != a else float(i)
    return cr(i0 - 1, i0), cr(i1, i1 + 1)
for n in range(a, b + 1):
    A = load(n)[y0:y1, x0:x1]
    W = np.clip((A.min(axis=2) - (mn - 40)) / 40.0, 0, 1)   # soft near-white mask
    row = W.mean(axis=1); 
    sy = span(row, frac)
    if not sy: print(json.dumps({'n': n, 'none': 1})); continue
    t, bt = sy
    rows = W[int(t):int(bt) + 1]
    col = rows.mean(axis=0); sx = span(col, frac)
    l, r = sx
    rec = dict(n=n, l=round(l + x0, 1), r=round(r + x0, 1), t=round(t + y0, 1), b=round(bt + y0, 1), w=round(r - l, 1), h=round(bt - t, 1), cx=round((l + r) / 2 + x0, 1), cy=round((t + bt) / 2 + y0, 1), peak=round(float(row.max()), 3))
    print(json.dumps(rec))
