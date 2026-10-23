# Shot C measurements per frame: slot pill edges (camera drift) + coloured mascot blobs.
import sys, os, json
import numpy as np
from PIL import Image
d = sys.argv[1]; a, b = int(sys.argv[2]), int(sys.argv[3])
def edges(prof, lo, hi):
    # first falling edge (bg->pill) and last rising edge (pill->bg) in prof[lo:hi], subpixel via half-level crossing
    p = prof[lo:hi]; bg = 245.5; pill = 231.0; mid = (bg + pill) / 2
    below = p < mid
    if not below.any(): return None, None
    i0 = int(np.argmax(below)); i1 = len(p) - 1 - int(np.argmax(below[::-1]))
    def cross(i, j):  # interpolate crossing between i and j
        a_, b_ = p[i], p[j]
        return i + (a_ - mid) / (a_ - b_) * (j - i) if a_ != b_ else i
    top = lo + (cross(i0 - 1, i0) if i0 > 0 else 0)
    bot = lo + (cross(i1, i1 + 1) if i1 + 1 < len(p) else i1)
    return round(top, 2), round(bot, 2)
out = []
for n in range(a, b + 1):
    im = np.asarray(Image.open(os.path.join(d, 'n%04d.png' % n)).convert('RGB')).astype(float)
    g = im.mean(axis=2)
    prof = g[:, 960:1000].mean(axis=1)    # right part of frame: pill only (rows' text never reaches x>960?)
    prof2 = g[:, 840:880].mean(axis=1)
    t1, b1 = edges(prof2, 0, 608)
    # right edge of the pill at its vertical centre
    r = {}
    if t1 is not None:
        yc = int((t1 + b1) / 2); row = g[max(0, yc - 10):yc + 10, :].mean(axis=0)
        mid = (245.5 + 231) / 2; xs = np.where(row[600:1080] < mid)[0]
        if len(xs): 
            i = 600 + xs[-1]; r['right'] = round(i + (row[i] - mid) / (row[i] - row[i + 1]) if i + 1 < 1080 and row[i] != row[i+1] else i, 2)
    R, G, B = im[..., 0], im[..., 1], im[..., 2]
    blobs = {}
    masks = {
        'blue': (B > 180) & (R < 90) & (G < 160) & (B - R > 120),
        'orange': (R > 200) & (G > 80) & (G < 170) & (B < 90),
        'purple': (R > 120) & (R < 200) & (B > 200) & (G < 120),
    }
    for k, m in masks.items():
        ys, xs = np.nonzero(m)
        if len(ys) > 30:
            blobs[k] = dict(cx=round(xs.mean(), 1), cy=round(ys.mean(), 1), x0=int(xs.min()), x1=int(xs.max()), y0=int(ys.min()), y1=int(ys.max()), area=int(len(ys)))
    out.append(dict(n=n, pill_top=t1, pill_bot=b1, **r, blobs=blobs))
    print(n, t1, b1, r.get('right'), {k: (v['cx'], v['cy'], v['x1'] - v['x0'], v['y1'] - v['y0'], v['area']) for k, v in blobs.items()}, flush=True)
json.dump(out, open(sys.argv[4], 'w'))
