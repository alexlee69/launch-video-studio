# Blue sweep across the prompt bar: baseline-subtracted blue-excess column profile -> centroid, extent, strength.
# usage: sweep.py <absdir> <first> <last> <basen> y0,y1,x0,x1
import sys, os
import numpy as np
from PIL import Image
d, a, b, base = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
y0, y1, x0, x1 = [int(v) for v in sys.argv[5].split(',')]
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('RGB')
    if im.width != 1080: im = im.resize((1080, round(im.height * 1080 / im.width)), Image.LANCZOS).crop((0, 0, 1080, 608))
    return np.asarray(im, dtype=float)
def prof(n):
    A = load(n)[y0:y1, x0:x1]
    return np.clip(A[..., 2] - (A[..., 0] + A[..., 1]) / 2, 0, None).mean(axis=0)
B = prof(base)
xs = np.arange(x0, x1)
for n in range(a, b + 1):
    c = np.clip(prof(n) - B, 0, None)
    # light smoothing
    k = np.ones(9) / 9; c = np.convolve(c, k, mode='same')
    tot = c.sum(); m = c.max()
    if m < 2: print(n, 'none  max %.1f' % m); continue
    cx = (c * xs).sum() / tot
    idx = np.where(c >= 0.25 * m)[0]
    print(n, 'cx %.1f  peakx %d  L25 %d  R25 %d  max %.1f  tot %.0f' % (cx, xs[np.argmax(c)], xs[idx[0]], xs[idx[-1]], m, tot))
