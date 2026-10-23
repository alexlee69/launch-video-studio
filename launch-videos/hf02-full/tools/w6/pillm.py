# Floating bubble pill: rows (top/bottom → centre y) and the right edge, measured right of the phone where the pill is on paper.
# usage: pillm.py <dir> a b <lo,hi luminance band of the pill> <out.json>
import sys, os, json
import numpy as np
from PIL import Image
d, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); lo, hi = [float(v) for v in sys.argv[4].split(',')]; out = sys.argv[5]
res = {}
for n in range(a, b + 1):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = im.crop((0, 0, 1920, 1080)).resize((1080, 608), Image.LANCZOS)
    g = np.asarray(im, float)
    sub = g[200:560, 640:1075]; m = (sub >= lo) & (sub <= hi)
    rows = m.sum(axis=1); good = np.nonzero(rows > 30)[0]
    if not len(good): print(n, '-'); continue
    runs = np.split(good, np.nonzero(np.diff(good) > 2)[0] + 1); r = max(runs, key=len)
    if len(r) < 20: print(n, '- short'); continue
    y0, y1 = 200 + r[0], 200 + r[-1]; yc = (y0 + y1) / 2
    row = np.median(g[int(yc) - 5:int(yc) + 6, :], axis=0)
    xs = np.nonzero((row >= lo) & (row <= hi))[0]; xs = xs[xs > 600]
    res[n] = dict(top=int(y0), bot=int(y1), yc=float(yc), right=int(xs.max()) if len(xs) else None)
    print(n, res[n])
json.dump(res, open(out, 'w'))
