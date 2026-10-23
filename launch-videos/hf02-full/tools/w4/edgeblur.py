# Edge blur of a dark card on the light page: sigma from the 10-90% rise width across the card's left/right edges (sx)
# and top/bottom edges (sy).  usage: edgeblur.py <absdir> <quad.json> <first> <last> [lo,hi]
# Uses the quad lines in quad.json to know where each edge is; samples 9 profiles per edge, middle 60% of the edge.
import sys, os, json
import numpy as np
from PIL import Image
d, qj, a, b = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
Q = {r['n']: r for r in json.load(open(qj))}
def gray(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = im.crop((0, 0, im.width, round(im.width * 608 / 1080))).resize((1080, 608), Image.LANCZOS)
    return np.asarray(im).astype(float)
def width(prof):
    # prof goes light -> dark; 10-90% rise width (subpixel) using the profile's own end levels
    hi = np.median(prof[:4]); lo = np.median(prof[-4:])
    if hi - lo < 60: return None
    def cross(f):
        t = hi - f * (hi - lo)
        i = int(np.argmax(prof < t))
        if i == 0: return None
        return i - 1 + (prof[i - 1] - t) / (prof[i - 1] - prof[i])
    c1, c9 = cross(0.1), cross(0.9)
    if c1 is None or c9 is None: return None
    return (c9 - c1) / 2.563
out = []
for n in range(a, b + 1):
    if n not in Q or not Q[n].get('L'): continue
    g = gray(n); r = Q[n]; H, W = g.shape
    sx, sy = [], []
    y0, y1 = r['TL'][1], r['BL'][1]
    for f in np.linspace(0.25, 0.75, 9):
        y = int(round(y0 + f * (y1 - y0)))
        xl = r['L'][0] + r['L'][1] * y; xr = r['R'][0] + r['R'][1] * y
        i0 = int(xl) - 30; i1 = int(xl) + 30
        if 0 <= i0 and i1 < W:
            w = width(g[y, i0:i1]); sx.append(w) if w else None
        i0 = int(xr) - 30; i1 = int(xr) + 30
        if 0 <= i0 and i1 < W:
            w = width(g[y, i0:i1][::-1]); sx.append(w) if w else None
    x0, x1 = r['TL'][0], r['TR'][0]
    for f in np.linspace(0.25, 0.75, 9):
        x = int(round(x0 + f * (x1 - x0)))
        yt = r['T'][0] + r['T'][1] * x; yb = r['B'][0] + r['B'][1] * x
        i0 = int(yt) - 30; i1 = int(yt) + 30
        if 0 <= i0 and i1 < H:
            w = width(g[i0:i1, x]); sy.append(w) if w else None
        i0 = int(yb) - 30; i1 = int(yb) + 30
        if 0 <= i0 and i1 < H:
            w = width(g[i0:i1, x][::-1]); sy.append(w) if w else None
    rr = dict(n=n, sx=round(float(np.median(sx)), 2) if sx else None, sy=round(float(np.median(sy)), 2) if sy else None,
              nsx=len(sx), nsy=len(sy))
    out.append(rr); print(json.dumps(rr), flush=True)
