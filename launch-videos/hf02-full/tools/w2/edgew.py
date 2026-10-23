# Top-edge position and 10–90 % width of a bright band (the bar) in a column strip: sigma = width / 2.563 (gaussian edge).
# usage: edgew.py <absdir> <first> <last> x0,x1 y0,y1     (searches the strongest dark→bright step inside y0..y1)
import sys, os, json
import numpy as np
from PIL import Image
d, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
x0, x1 = [int(v) for v in sys.argv[4].split(',')]; y0, y1 = [int(v) for v in sys.argv[5].split(',')]
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = im.resize((1080, round(im.height * 1080 / im.width)), Image.LANCZOS).crop((0, 0, 1080, 608))
    return np.asarray(im, dtype=np.float64)
def cross(p, lv, i0, i1, step):
    rng = range(i0, i1, step)
    prev = None
    for i in rng:
        if prev is not None and (p[prev] - lv) * (p[i] - lv) <= 0 and p[prev] != p[i]:
            return prev + (lv - p[prev]) / (p[i] - p[prev]) * (i - prev)
        prev = i
    return None
for n in range(a, b + 1):
    p = np.convolve(load(n)[:, x0:x1].mean(axis=1), np.ones(3) / 3, mode='same')
    seg = p[y0:y1]
    if len(seg) < 10: print(json.dumps({'n': n})); continue
    hi = seg.max(); ih = int(np.argmax(seg)) + y0
    lo = p[max(0, y0 - 1):ih].min() if ih > y0 else seg.min()
    il = int(np.argmin(p[y0:ih])) + y0 if ih > y0 else y0
    if hi - lo < 30: print(json.dumps({'n': n, 'flat': 1})); continue
    y10 = cross(p, lo + 0.1 * (hi - lo), il, ih + 1, 1); y50 = cross(p, lo + 0.5 * (hi - lo), il, ih + 1, 1); y90 = cross(p, lo + 0.9 * (hi - lo), il, ih + 1, 1)
    if None in (y10, y50, y90): print(json.dumps({'n': n, 'fail': 1})); continue
    print(json.dumps(dict(n=n, top=round(y50, 1), sig=round((y90 - y10) / 2.563, 2), lo=round(lo), hi=round(hi))))
