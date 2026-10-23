# Whole-frame content spread around the frame centre (for the collapse/cluster frames, where characters merge):
# weighted sd of |frame - paper| in x and y, and the radius holding 50 % / 90 % of the content mass.
# usage: moments.py <dir> a b [--bg r,g,b] [--wm]   (--wm masks the reference watermark boxes)
import sys, os, math
import numpy as np
from PIL import Image
d, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
bg = np.array([float(v) for v in sys.argv[sys.argv.index('--bg') + 1].split(',')]) if '--bg' in sys.argv else np.array([246., 244., 249.])
wm = '--wm' in sys.argv
ys, xs = np.mgrid[0:608, 0:1080].astype(float)
rr = np.hypot(xs - 540, ys - 304)
for n in range(a, b + 1):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('RGB')
    if im.width != 1080: im = im.crop((0, 0, 1920, 1080)).resize((1080, 608), Image.LANCZOS)
    D = np.abs(np.asarray(im, float) - bg).max(axis=2); D[D < 8] = 0
    if wm: D[60:260, 800:1060] = 0; D[330:475, 45:275] = 0
    m = D.sum()
    if m < 1: print(n, '-'); continue
    cx, cy = (D * xs).sum() / m, (D * ys).sum() / m
    sx = math.sqrt((D * (xs - cx) ** 2).sum() / m); sy = math.sqrt((D * (ys - cy) ** 2).sum() / m)
    o = np.argsort(rr.ravel()); cum = np.cumsum(D.ravel()[o]) / m
    r50 = rr.ravel()[o][np.searchsorted(cum, 0.5)]; r90 = rr.ravel()[o][np.searchsorted(cum, 0.9)]
    print(n, 'c=(%.1f,%.1f) sx=%.1f sy=%.1f r50=%.1f r90=%.1f mass=%.0f' % (cx, cy, sx, sy, r50, r90, m / 1000))
