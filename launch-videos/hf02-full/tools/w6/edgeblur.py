# Blur sigma of the outer edges of the split pair: erf-fit (10–90 % rise / 2.563) of the right char's right edge and the
# left char's left edge on a band of rows through the middle; also their vertical (bottom) edge. usage: edgeblur.py <dir> a b
import sys, os, math
import numpy as np
from PIL import Image
d, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
BG = np.array([246, 244, 249], float)
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('RGB')
    if im.width != 1080: im = im.crop((0, 0, 1920, 1080)).resize((1080, 608), Image.LANCZOS)
    a = np.asarray(im, float)
    bg = a[5:40, 5:40].reshape(-1, 3).mean(axis=0)
    return np.abs(a - bg).max(axis=2)
def width(p):
    # p rises from ~0 to plateau; plateau = median of the top part
    pl = np.median(p[np.argsort(p)[-max(5, len(p) // 4):]])
    if pl < 6: return None
    i10 = np.argmax(p > 0.1 * pl); i90 = np.argmax(p > 0.9 * pl)
    def sub(i, lev):
        if i == 0: return 0.0
        return i - 1 + (lev - p[i - 1]) / (p[i] - p[i - 1]) if p[i] != p[i - 1] else i
    return (sub(i90, 0.9 * pl) - sub(i10, 0.1 * pl)) / 2.563
for n in range(a, b + 1):
    D = load(n); band = np.median(D[290:318], axis=0)
    xs = np.nonzero(band > 6)[0]
    if not len(xs): print(n); continue
    R = band[xs[-1] - 60:xs[-1] + 25][::-1]; L = band[xs[0] - 25:xs[0] + 60]
    # vertical: bottom edge of the right char, at its centre column
    out = [n, 'sR=%.2f' % (width(R) or -1), 'sL=%.2f' % (width(L) or -1)]
    print(' '.join(map(str, out)))
