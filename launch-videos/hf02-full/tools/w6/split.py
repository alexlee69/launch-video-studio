# Shot A (two characters splitting): per frame, the right char's right edge + its top/bottom, the left char's left edge + bottom,
# via half-level crossings on profiles through the frame's middle row. usage: split.py <dir> a b [--right gray|<rgb>] [--left orange|<rgb>]
import sys, os, json
import numpy as np
from PIL import Image
d, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
BG = np.array([float(v) for v in sys.argv[sys.argv.index('--bg') + 1].split(',')] if '--bg' in sys.argv else [246, 244, 249], float)
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('RGB')
    if im.width != 1080: im = im.crop((0, 0, 1920, 1080)).resize((1080, 608), Image.LANCZOS)
    return np.asarray(im, float)
def edge(p, lo_i, hi_i, lev):
    # first crossing of level lev scanning from lo_i toward hi_i
    st = 1 if hi_i > lo_i else -1; i = lo_i
    while i != hi_i:
        if (p[i] - lev) * (p[i + st] - lev) <= 0 and p[i] != p[i + st]: return i + st * (p[i] - lev) / (p[i] - p[i + st])
        i += st
    return None
out = []
for n in range(a, b + 1):
    F = load(n); D = np.abs(F - BG).max(axis=2)
    # content strength along the middle band (rows 280..330), max over rows to be robust to eyes
    band = D[285:325].mean(axis=0)
    full = np.median(D[285:325, :], axis=0)
    xs = np.nonzero(band > 6)[0]
    r = dict(n=n)
    if len(xs):
        lv = band.max()
        # right edge of the rightmost object: scan from the right at a level of half its plateau (plateau ~ gray diff 24..27)
        R = edge(band, 1079, int(xs[0]), 0.5 * np.median(band[max(xs[-1] - 60, xs[0]):xs[-1] - 5]) if xs[-1] - xs[0] > 70 else 12)
        L = edge(band, 0, int(xs[-1]), 0.5 * np.median(band[xs[0] + 5:min(xs[0] + 60, xs[-1])]) if xs[-1] - xs[0] > 70 else 12)
        r.update(L=round(L, 2) if L is not None else None, R=round(R, 2) if R is not None else None)
        # vertical extents: column through 40 px inside each outer edge
        for k, x in (('rT', R - 45 if R else None), ('lT', L + 45 if L else None)):
            if x is None: continue
            col = D[:, int(x) - 3:int(x) + 4].mean(axis=1); ys = np.nonzero(col > 6)[0]
            if not len(ys): continue
            mid = 0.5 * np.median(col[ys[0] + 8:ys[-1] - 8]) if ys[-1] - ys[0] > 30 else 12
            T = edge(col, 0, int(ys[-1]), mid); B = edge(col, 607, int(ys[0]), mid)
            r[k] = round(T, 2) if T is not None else None; r[k[0] + 'B'] = round(B, 2) if B is not None else None
    out.append(r); print(json.dumps(r), flush=True)
