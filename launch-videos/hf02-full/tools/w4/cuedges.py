# Close-up (n641-670): the card's left edge x (rows 60-280) and bottom edge y (columns 1000-1070), threshold crossings.
import sys, os, json
import numpy as np
from PIL import Image
d = sys.argv[1]; a, b = int(sys.argv[2]), int(sys.argv[3]); THR = 128
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = im.crop((0, 0, im.width, round(im.width * 608 / 1080))).resize((1080, 608), Image.LANCZOS)
    return np.asarray(im).astype(float)
def fc(v):
    bl = v < THR
    if not bl.any(): return None
    i = int(np.argmax(bl))
    return None if i == 0 else i - 1 + (v[i - 1] - THR) / (v[i - 1] - v[i])
out = []
for n in range(a, b + 1):
    g = load(n)
    xs = [fc(g[y, :]) for y in range(60, 281, 4)]; xs = [x for x in xs if x is not None]
    ys = [fc(g[::-1, x]) for x in range(1000, 1071, 3)]; ys = [607 - y for y in ys if y is not None]
    r = dict(n=n, xl=round(float(np.median(xs)), 2) if xs else None, yb=round(float(np.median(ys)), 2) if ys else None)
    out.append(r); print(json.dumps(r), flush=True)
json.dump(out, open(sys.argv[4], 'w'))
