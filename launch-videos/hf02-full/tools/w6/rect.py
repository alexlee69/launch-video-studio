# Dark card / phone outline per frame: subpixel left/right/top/bottom edges of the biggest dark rectangle.
# usage: python3 -E rect.py <framesdir> <first> <last> <out.json> [--thr 120] [--band y0,y1]
import sys, os, json
import numpy as np
from PIL import Image
d, a, b, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
arg = lambda k, v: type(v)(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else v
THR = arg('--thr', 120.0)
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('RGB')
    if im.width != 1080: im = im.crop((0, 0, 1920, 1080)).resize((1080, 608), Image.LANCZOS)
    return np.asarray(im, float).mean(axis=2)
def cross(p, i0, i1, lo, hi):
    # subpixel position where profile p crosses (lo+hi)/2 between indices i0 and i1 (step ±1)
    mid = (lo + hi) / 2; st = 1 if i1 > i0 else -1; i = i0
    while i != i1:
        if (p[i] - mid) * (p[i + st] - mid) <= 0 and p[i] != p[i + st]:
            return i + st * (p[i] - mid) / (p[i] - p[i + st])
        i += st
    return None
res = []
for n in range(a, b + 1):
    g = load(n); M = g < THR
    cols = M.sum(axis=0); rows = M.sum(axis=1)
    r = dict(n=n)
    if cols.max() < 30: res.append(r); print(json.dumps(r)); continue
    xs = np.nonzero(cols > 0.45 * cols.max())[0]
    # largest contiguous run of columns
    runs = np.split(xs, np.nonzero(np.diff(xs) > 3)[0] + 1); run = max(runs, key=len)
    x0, x1 = int(run[0]), int(run[-1])
    ys = np.nonzero(M[:, x0:x1 + 1].sum(axis=1) > 0.45 * (x1 - x0 + 1))[0]
    yr = np.split(ys, np.nonzero(np.diff(ys) > 3)[0] + 1); yrun = max(yr, key=len)
    y0, y1 = int(yrun[0]), int(yrun[-1])
    # profiles through the body's interior band for subpixel edges (bg ~246, body = median inside)
    yb0, yb1 = y0 + (y1 - y0) // 4, y1 - (y1 - y0) // 4
    xb0, xb1 = x0 + (x1 - x0) // 4, x1 - (x1 - x0) // 4
    px = np.median(g[yb0:yb1 + 1, :], axis=0); py = np.median(g[:, xb0:xb1 + 1], axis=1)
    inside = float(np.median(g[yb0:yb1, xb0:xb1]))
    L = cross(px, max(0, x0 - 25), min(1079, x0 + 25), 246, inside) if True else None
    R = cross(px, min(1079, x1 + 25), max(0, x1 - 25), 246, inside)
    T = cross(py, max(0, y0 - 25), min(607, y0 + 25), 246, inside) if y0 > 1 else None
    B = cross(py, min(607, y1 + 25), max(0, y1 - 25), 246, inside) if y1 < 606 else None
    r.update(L=None if L is None else round(L, 2), R=None if R is None else round(R, 2), T=None if T is None else round(T, 2),
             B=None if B is None else round(B, 2), raw=[x0, y0, x1, y1], inside=round(inside, 1))
    if L is not None and R is not None: r['w'] = round(R - L, 2); r['cx'] = round((L + R) / 2, 2)
    res.append(r); print(json.dumps(r), flush=True)
json.dump(res, open(out, 'w'))
