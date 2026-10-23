# Split pair, second pass: bottom edge of the right character measured at its own centre column (iterated), so the scale reading
# does not depend on the character's corner shape. usage: split2.py <dir> a b <bg r,g,b> <cxr1270> <out.json>
import sys, os, json
import numpy as np
from PIL import Image
d, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
BG = np.array([float(v) for v in sys.argv[4].split(',')]); out = sys.argv[5]
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('RGB')
    if im.width != 1080: im = im.crop((0, 0, 1920, 1080)).resize((1080, 608), Image.LANCZOS)
    return np.abs(np.asarray(im, float) - BG).max(axis=2)
def edge_from(p, start, stop, lev):
    st = 1 if stop > start else -1; i = start
    while i != stop:
        if (p[i] - lev) * (p[i + st] - lev) <= 0 and p[i] != p[i + st]: return i + st * (p[i] - lev) / (p[i] - p[i + st])
        i += st
    return None
res = {}
for n in range(a, b + 1):
    D = load(n); band = np.median(D[290:318], axis=0); xs = np.nonzero(band > 6)[0]
    R = edge_from(band, 1079, int(xs[0]), 0.5 * np.median(band[max(xs[-1] - 60, xs[0]):xs[-1] - 5]))
    L = edge_from(band, 0, int(xs[-1]), 0.5 * np.median(band[xs[0] + 5:min(xs[0] + 60, xs[-1])]))
    xc = R - 85
    for _ in range(4):
        col = np.median(D[:, int(xc) - 6:int(xc) + 7], axis=1)
        plateau = np.median(col[330:360]); B = edge_from(col, 607, 304, 0.5 * plateau)
        s = (B - 303.5) / 85.0          # provisional: half height 85 at s=1 (normalised again in the comparison)
        xc = R - 85 * s
    res[n] = dict(R=R, L=L, B=B)
    print(n, json.dumps(res[n]))
json.dump(res, open(out, 'w'))
