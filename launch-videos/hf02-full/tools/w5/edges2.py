# Card silhouette edges on a light page by colour distance from the page (works for light-on-dark and coloured cards):
# coverage fraction per row (over a central column band) and per column (over a central row band); half-level crossings.
# usage: edges2.py <absdir> <first> <last> <out.json> [--band x0,x1,y0,y1] [--thr 22]
import sys, os, json
import numpy as np
from PIL import Image
d, a, b, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
arg = lambda k, dflt: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else dflt
band = [int(v) for v in arg('--band', '380,700,230,380').split(',')]; thr = float(arg('--thr', 22))
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('RGB')
    if im.width != 1080: im = im.crop((0, 0, im.width, round(im.width * 608 / 1080))).resize((1080, 608), Image.LANCZOS)
    return np.asarray(im, dtype=np.float64)
def cross(p, lvl):
    s = p > lvl; r = []
    for i in np.nonzero(s[1:] != s[:-1])[0]:
        y0, y1 = p[i], p[i + 1]; t = (lvl - y0) / (y1 - y0) if y1 != y0 else 0.5; r.append((round(i + t, 2), 1 if s[i + 1] else -1))
    return r
res = []
for n in range(a, b + 1):
    A = load(n); bg = np.median(np.concatenate([A[0:6].reshape(-1, 3), A[-6:].reshape(-1, 3)]), axis=0)
    dist = np.sqrt(((A - bg) ** 2).sum(axis=2))
    # soft coverage: 0 at the page, 1 at >= thr*3 away
    cov = np.clip(dist / (thr * 3), 0, 1)
    x0, x1, y0, y1 = band
    rp = cov[:, x0:x1].mean(axis=1); cp = cov[y0:y1, :].mean(axis=0)
    rr = cross(rp, 0.5 * np.percentile(rp, 95)); cc = cross(cp, 0.5 * np.percentile(cp, 95))
    top = next((p for p, dd in rr if dd == 1), None); bot = next((p for p, dd in reversed(rr) if dd == -1), None)
    left = next((p for p, dd in cc if dd == 1), None); right = next((p for p, dd in reversed(cc) if dd == -1), None)
    r = dict(n=n, top=top, bot=bot, left=left, right=right); res.append(r); print(json.dumps(r), flush=True)
json.dump(res, open(out, 'w'), indent=0)
