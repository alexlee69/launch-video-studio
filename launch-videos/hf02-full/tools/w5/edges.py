# Dark-card edges on a light page, per frame: top/bottom (row profile over a central column band) and
# left/right (column profile over a central row band); subpixel half-level crossings.
# usage: edges.py <absdir> <first> <last> <out.json> [--band x0,x1,y0,y1] [--bg 245] [--w 1080]
import sys, os, json
import numpy as np
from PIL import Image
d, a, b, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
arg = lambda k, dflt: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else dflt
band = [int(v) for v in arg('--band', '380,700,230,380').split(',')]
BG = float(arg('--bg', '245'))
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = im.crop((0, 0, im.width, round(im.width * 608 / 1080))).resize((1080, 608), Image.LANCZOS)
    return np.asarray(im, dtype=np.float64)
def crossings(p, lvl):
    # all subpixel crossings of p through lvl: (pos, direction) dir=-1 light->dark, +1 dark->light
    s = p < lvl; r = []
    for i in np.nonzero(s[1:] != s[:-1])[0]:
        y0, y1 = p[i], p[i + 1]; t = (y0 - lvl) / (y0 - y1) if y0 != y1 else 0.5
        r.append((round(i + t, 2), -1 if s[i + 1] else 1))
    return r
res = []
for n in range(a, b + 1):
    L = load(n)
    x0, x1, y0, y1 = band
    rp = L[:, x0:x1].mean(axis=1); cp = L[y0:y1, :].mean(axis=0)
    dark_r = np.percentile(rp, 5); dark_c = np.percentile(cp, 5)
    lr = (BG + dark_r) / 2; lc = (BG + dark_c) / 2
    cr = crossings(rp, lr); cc = crossings(cp, lc)
    top = next((p for p, dd in cr if dd == -1), None); bot = next((p for p, dd in reversed(cr) if dd == 1), None)
    left = next((p for p, dd in cc if dd == -1), None); right = next((p for p, dd in reversed(cc) if dd == 1), None)
    r = dict(n=n, top=top, bot=bot, left=left, right=right, dr=round(dark_r, 1), dc=round(dark_c, 1))
    res.append(r); print(json.dumps(r), flush=True)
json.dump(res, open(out, 'w'), indent=0)
