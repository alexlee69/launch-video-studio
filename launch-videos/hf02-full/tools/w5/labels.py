# Floating-label measurements per frame: ink bbox (L < thr), ink mass, centre; the search box follows the label.
# usage: labels.py <absdir> <out.json> <name> <seed_n> <x0,y0,x1,y1> <first> <last> [thr]
import sys, os, json
import numpy as np
from PIL import Image
d, out, name, seed = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
box0 = [int(v) for v in sys.argv[5].split(',')]; a, b = int(sys.argv[6]), int(sys.argv[7])
thr = float(sys.argv[8]) if len(sys.argv) > 8 else 165
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = im.crop((0, 0, im.width, round(im.width * 608 / 1080))).resize((1080, 608), Image.LANCZOS)
    return np.asarray(im, dtype=np.float64)
def meas(n, box):
    x0, y0, x1, y1 = [int(round(v)) for v in box]; x0 = max(0, x0); y0 = max(0, y0); x1 = min(1080, x1); y1 = min(608, y1)
    L = load(n)[y0:y1, x0:x1]; bg = np.median(L); ink = np.clip(bg - L, 0, None); ink[ink < bg - thr] = ink[ink < bg - thr] * 0.0 + ink[ink < bg - thr]
    m = (L < thr)
    if m.sum() < 4: return dict(n=n, mass=round(float(np.clip(bg - L - 25, 0, None).sum()), 0), on=0)
    ys, xs = np.nonzero(m)
    w = np.clip(bg - L, 0, None)[m]
    return dict(n=n, on=1, x0=int(xs.min() + x0), x1=int(xs.max() + x0), y0=int(ys.min() + y0), y1=int(ys.max() + y0),
                cx=round(float((xs * w).sum() / w.sum() + x0), 2), cy=round(float((ys * w).sum() / w.sum() + y0), 2),
                mass=round(float(np.clip(bg - L - 25, 0, None).sum()), 0), npx=int(m.sum()), minL=round(float(L.min()), 1))
res = {}
bw, bh = box0[2] - box0[0], box0[3] - box0[1]
for rng in (range(seed, b + 1), range(seed - 1, a - 1, -1)):
    box = list(box0)
    for n in rng:
        r = meas(n, box); res[n] = r
        if r['on'] and r['npx'] > 40:
            cx = (r['x0'] + r['x1']) / 2; cy = (r['y0'] + r['y1']) / 2
            box = [cx - bw / 2 - 12, cy - bh / 2 - 10, cx + bw / 2 + 12, cy + bh / 2 + 10]
rows = [res[k] for k in sorted(res)]
for r in rows: print(name, json.dumps(r))
allr = json.load(open(out)) if os.path.exists(out) else {}
allr[name] = rows; json.dump(allr, open(out, 'w'))
