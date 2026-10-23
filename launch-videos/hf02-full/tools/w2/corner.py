# Rounded-card corner radius and edge blur on a light page.
# usage: corner.py <absdir> <first> <last> <cardjson-lines from margins.py on stdin? no: pass l,r,t,b per frame via margins recompute>
import sys, os, json, math
import numpy as np
from PIL import Image
d, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = im.resize((1080, round(im.height * 1080 / im.width)), Image.LANCZOS)
    return np.asarray(im, dtype=np.float64)[:608]
def cross(p, mid):
    for i in range(1, len(p)):
        if (p[i - 1] - mid) * (p[i] - mid) <= 0 and p[i - 1] != p[i]:
            return i - 1 + (p[i - 1] - mid) / (p[i - 1] - p[i])
    return None
def bilin(L, x, y):
    x0 = int(math.floor(x)); y0 = int(math.floor(y)); fx = x - x0; fy = y - y0
    if x0 < 0 or y0 < 0 or x0 + 1 >= L.shape[1] or y0 + 1 >= L.shape[0]: return 245.0
    return (L[y0, x0] * (1 - fx) * (1 - fy) + L[y0, x0 + 1] * fx * (1 - fy) + L[y0 + 1, x0] * (1 - fx) * fy + L[y0 + 1, x0 + 1] * fx * fy)
for n in range(a, b + 1):
    L = load(n)
    cy, cx = 304, 540
    left = L[cy - 60:cy + 60, :cx].mean(axis=0)
    top = L[:cy, cx - 120:cx + 120].mean(axis=1)
    inner_l = np.median(left[len(left) // 2:]); inner_t = np.median(top[len(top) // 2:])
    l = cross(left, (245 + inner_l) / 2); t = cross(top, (245 + inner_t) / 2)
    # edge width 20-80% on the left edge
    lo = cross(left, 245 - 0.2 * (245 - inner_l)); hi = cross(left, 245 - 0.8 * (245 - inner_l))
    sig = (hi - lo) / 1.683 if lo is not None and hi is not None else None   # 20-80% of a gaussian edge = 1.683 sigma
    # corner: walk the diagonal from (l, t) inward; average the 4 corners
    ds = []
    for sx, sy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
        x0 = l if sx > 0 else 1079 - l; y0 = t if sy > 0 else 607 - t
        prof = np.array([bilin(L, x0 + sx * k / math.sqrt(2) * 0.25 * 4, y0 + sy * k / math.sqrt(2) * 0.25 * 4) for k in np.arange(0, 120, 0.25)])
        # midpoint between page and the card's corner-inner level
        inner = np.median(prof[-80:])
        c = cross(prof, (245 + inner) / 2)
        if c is not None: ds.append(c * 0.25)
    dd = float(np.median(ds)) if ds else None
    r = dd / (math.sqrt(2) - 1) if dd is not None else None
    print(json.dumps(dict(n=n, l=round(l, 1), t=round(t, 1), diag=[round(x, 1) for x in ds], r=round(r, 1) if r else None, sigL=round(sig, 2) if sig else None)))
