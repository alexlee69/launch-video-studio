# Thread shot (n743-848): the dark panel's left/right edges (→ x position and width) and the content's vertical offset
# (frame-to-frame correlation of the panel's row-brightness profile, accumulated; anchored to 0 at the first frame).
# usage: thread.py <absdir> <first> <last> <out.json> [--band x0,x1]
import sys, os, json
import numpy as np
from PIL import Image
d, a, b, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
def gray(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = im.crop((0, 0, im.width, round(im.width * 608 / 1080))).resize((1080, 608), Image.LANCZOS)
    return np.asarray(im).astype(float)
def edges(g, thr=128):
    L, R = [], []
    for y in range(120, 560, 8):
        row = g[y]; dk = row < thr
        if not dk.any(): continue
        i = int(np.argmax(dk)); j = 1079 - int(np.argmax(dk[::-1]))
        if 0 < i and j < 1079:
            L.append(i - 1 + (row[i - 1] - thr) / (row[i - 1] - row[i])); R.append(j + (row[j] - thr) / (row[j] - row[j + 1]))
    return (float(np.median(L)) if L else None, float(np.median(R)) if R else None)
def prof(g, x0, x1):
    p = g[:, int(x0):int(x1)].mean(axis=1); return p - p.mean()
def shift(p, q, lo=-140, hi=140):
    best = None; vals = {}
    for s in range(lo, hi + 1):
        if s >= 0: A, B = p[:len(p) - s], q[s:]
        else: A, B = p[-s:], q[:len(q) + s]
        if len(A) < 200: continue
        A = A - A.mean(); B = B - B.mean()
        v = (A * B).sum() / (np.sqrt((A * A).sum() * (B * B).sum()) + 1e-9); vals[s] = v
        if best is None or v > best[1]: best = (s, v)
    s, v = best
    if s - 1 in vals and s + 1 in vals:
        y0, y1, y2 = vals[s - 1], v, vals[s + 1]; den = y0 - 2 * y1 + y2
        if den < 0: s = s + 0.5 * (y0 - y2) / den
    return s, v
band = None
if '--band' in sys.argv: band = [int(v) for v in sys.argv[sys.argv.index('--band') + 1].split(',')]
res = []; prevP = None; off = 0.0
for n in range(a, b + 1):
    g = gray(n); L, R = edges(g)
    x0, x1 = band if band else ((L + 40, R - 40) if L is not None else (300, 800))
    P = prof(g, x0, x1)
    r = dict(n=n, L=None if L is None else round(L, 2), R=None if R is None else round(R, 2))
    if prevP is not None:
        s, v = shift(prevP, P); off += s; r['dy'] = round(s, 2); r['corr'] = round(v, 3)
    r['off'] = round(off, 2); prevP = P
    res.append(r); print(json.dumps(r), flush=True)
json.dump(res, open(out, 'w'), indent=0)
