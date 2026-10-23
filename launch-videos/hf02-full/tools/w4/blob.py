# Coloured blob (a character) per frame: centroid, area, bbox. usage: blob.py <absdir> <first> <last> <blue|orange> <out.json> [x0,y0,x1,y1]
import sys, os, json
import numpy as np
from PIL import Image
d, a, b, kind, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
box = [int(v) for v in sys.argv[6].split(',')] if len(sys.argv) > 6 else [0, 0, 1080, 608]
res = []
for n in range(a, b + 1):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('RGB')
    if im.width != 1080: im = im.crop((0, 0, im.width, round(im.width * 608 / 1080))).resize((1080, 608), Image.LANCZOS)
    A = np.asarray(im).astype(float)[box[1]:box[3], box[0]:box[2]]
    R, G, B = A[..., 0], A[..., 1], A[..., 2]
    if kind == 'blue': w = np.clip((B - R - 90) / 60, 0, 1) * (B > 150)
    elif kind == 'orange': w = np.clip((R - B - 110) / 60, 0, 1) * (R > 180)
    else: raise SystemExit('kind?')
    s = w.sum()
    if s < 20: res.append(dict(n=n, area=0)); print(json.dumps(res[-1])); continue
    ys, xs = np.mgrid[0:w.shape[0], 0:w.shape[1]]
    cx = (w * xs).sum() / s + box[0]; cy = (w * ys).sum() / s + box[1]
    m = w > 0.5
    yy, xx = np.where(m)
    r = dict(n=n, cx=round(cx, 2), cy=round(cy, 2), area=round(float(s), 1),
             bbox=[int(xx.min()) + box[0], int(yy.min()) + box[1], int(xx.max()) + box[0], int(yy.max()) + box[1]] if len(xx) else None)
    res.append(r); print(json.dumps(r), flush=True)
json.dump(res, open(out, 'w'), indent=0)
