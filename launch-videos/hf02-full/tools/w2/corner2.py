# Corner radius of a card on a light page, given its bbox (card.py json lines on stdin). Diagonal 50% crossing d -> r = d/(sqrt2-1),
# minus the blur bias (0.77 sigma along the diagonal for a gaussian-blurred square corner; pass --nob to skip).
import sys, os, json, math
import numpy as np
from PIL import Image
d = sys.argv[1]; nob = '--nob' in sys.argv
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = im.resize((1080, round(im.height * 1080 / im.width)), Image.LANCZOS).crop((0, 0, 1080, 608))
    return np.asarray(im, dtype=np.float64)
def bil(L, x, y):
    x0 = int(math.floor(x)); y0 = int(math.floor(y)); fx = x - x0; fy = y - y0
    if x0 < 0 or y0 < 0 or x0 + 1 >= L.shape[1] or y0 + 1 >= L.shape[0]: return None
    return L[y0, x0] * (1 - fx) * (1 - fy) + L[y0, x0 + 1] * fx * (1 - fy) + L[y0 + 1, x0] * (1 - fx) * fy + L[y0 + 1, x0 + 1] * fx * fy
def cross(p, mid):
    for i in range(1, len(p)):
        if (p[i - 1] - mid) * (p[i] - mid) <= 0 and p[i - 1] != p[i]: return i - 1 + (p[i - 1] - mid) / (p[i - 1] - p[i])
    return None
for line in sys.stdin:
    r = json.loads(line)
    if 'l' not in r: continue
    L = load(r['n']); page = r.get('page', 245.0)
    ds = []
    for cx, cy, sx, sy in ((r['l'], r['t'], 1, 1), (r['r'], r['t'], -1, 1), (r['l'], r['b'], 1, -1), (r['r'], r['b'], -1, -1)):
        prof = []
        for k in np.arange(0, 80, 0.25):
            v = bil(L, cx + sx * k / math.sqrt(2), cy + sy * k / math.sqrt(2))
            if v is None: break
            prof.append(v)
        if len(prof) < 40: continue
        prof = np.array(prof)
        inner = np.median(prof[-60:])
        if page - inner < 40: continue
        c = cross(prof, (page + inner) / 2)
        if c is not None: ds.append(c * 0.25)
    if not ds: print(json.dumps({'n': r['n']})); continue
    dd = float(np.median(ds))
    sig = np.nanmean([v for v in (r.get('sl'), r.get('sr'), r.get('st'), r.get('sb')) if v]) if any(r.get(k) for k in ('sl', 'sr', 'st', 'sb')) else 0
    rad = (dd - (0 if nob else 0.77 * sig)) / (math.sqrt(2) - 1)
    print(json.dumps(dict(n=r['n'], diag=[round(x, 1) for x in ds], sig=round(float(sig), 2), r=round(rad, 1), s=r.get('s'))))
