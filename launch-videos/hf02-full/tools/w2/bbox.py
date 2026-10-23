# Dark-card-on-light-bg bounding box per frame (half-max crossings of darkness profiles).
# usage: bbox.py <absdir> <first> <last> [--bg 245] [--roi x0,y0,x1,y1] [--light]  (light: bright object on dark bg)
import sys, os, json
import numpy as np
from PIL import Image
d, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
roi = None
if '--roi' in sys.argv: roi = [int(v) for v in sys.argv[sys.argv.index('--roi') + 1].split(',')]
light = '--light' in sys.argv
thr = float(sys.argv[sys.argv.index('--thr') + 1]) if '--thr' in sys.argv else 0.5
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = im.resize((1080, round(im.height * 1080 / im.width)), Image.LANCZOS)
    return np.asarray(im, dtype=np.float64)[:608]
def edges(p):
    m = p.max()
    if m <= 0: return None
    idx = np.where(p >= thr * m)[0]
    if len(idx) == 0: return None
    i0, i1 = idx[0], idx[-1]
    # subpixel crossing
    def cross(i, j):
        a, b = p[i], p[j]
        if b == a: return float(i)
        return i + (thr * m - a) / (b - a) * (j - i)
    l = cross(i0 - 1, i0) if i0 > 0 else 0.0
    r = cross(i1, i1 + 1) if i1 + 1 < len(p) else float(len(p) - 1)
    return l, r
out = []
for n in range(a, b + 1):
    L = load(n)
    D = (L / 255.0) if light else (1 - L / 255.0)
    x0, y0, x1, y1 = roi if roi else (0, 0, 1080, 608)
    R = D[y0:y1, x0:x1]
    R = np.clip(R - np.median(D[y0:y1, x0:x1][:3, :]) if False else R, 0, 1)
    col = R.mean(axis=0); row = R.mean(axis=1)
    # subtract baseline (bg)
    col = col - np.percentile(col, 5); row = row - np.percentile(row, 5)
    ex = edges(col); ey = edges(row)
    if not ex or not ey: print(json.dumps({'n': n})); continue
    l, r = ex[0] + x0, ex[1] + x0; t, bt = ey[0] + y0, ey[1] + y0
    rec = dict(n=n, l=round(l, 1), r=round(r, 1), t=round(t, 1), b=round(bt, 1), w=round(r - l, 1), h=round(bt - t, 1), cx=round((l + r) / 2, 1), cy=round((t + bt) / 2, 1))
    out.append(rec); print(json.dumps(rec))
if '--out' in sys.argv: json.dump(out, open(sys.argv[sys.argv.index('--out') + 1], 'w'), indent=0)
