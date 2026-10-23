# Event timing by "ink": summed darkness of a region (blur-invariant), per frame, normalised to a reference frame.
# usage: ink.py <absdir> <track.json|none> <name:x0,y0,x1,y1;...> <first> <last> <normframe> [--w 1080] [--pad 10] [--chan rgb]
#   boxes are in key-frame coords; when a track (n, tx/ty or dx/dy) is given they move with it.
import sys, os, json
import numpy as np
from PIL import Image
d, trf, boxes, a, b, nf = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6])
opt = lambda k, dv: type(dv)(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else dv
W = opt('--w', 1080); pad = opt('--pad', 10)
B = []
for part in boxes.split(';'):
    nm, v = part.split(':'); B.append((nm, [int(x) for x in v.split(',')]))
T = {}
if trf != 'none':
    for r in json.load(open(trf)):
        T[r['n']] = (r.get('tx', r.get('dx', 0)), r.get('ty', r.get('dy', 0)))
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != W: im = im.crop((0, 0, im.width, round(im.width * 608 / 1080))).resize((W, round(W * 608 / 1080)), Image.LANCZOS)
    return np.asarray(im, dtype=np.float64)
def inks(n):
    g = load(n); tx, ty = T.get(n, (0, 0)); out = {}
    for nm, (x0, y0, x1, y1) in B:
        X0, Y0 = int(round(x0 + tx)) - pad, int(round(y0 + ty)) - pad; X1, Y1 = int(round(x1 + tx)) + pad, int(round(y1 + ty)) + pad
        r = g[max(0, Y0):Y1, max(0, X0):X1]
        bg = np.median(np.concatenate([r[:3].ravel(), r[-3:].ravel(), r[:, :3].ravel(), r[:, -3:].ravel()]))
        out[nm] = float(np.clip(bg - r, 0, None).sum())
    return out
ref = inks(nf)
for n in range(a, b + 1):
    v = inks(n)
    print(n, ' '.join('%s=%.3f' % (k, v[k] / max(ref[k], 1e-6)) for k, _ in B), flush=True)
