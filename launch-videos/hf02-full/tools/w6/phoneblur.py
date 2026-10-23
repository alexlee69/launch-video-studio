# Edge blur of the phone outline: sigma from the 10–90 % rise of the left edge (horizontal profile, median over a band of rows
# inside the phone) and of the top or bottom edge (vertical profile, median over a band of columns). usage: phoneblur.py <dir> a b <rect.json>
import sys, os, json
import numpy as np
from PIL import Image
d, a, b, rj = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
R = {o['n']: o for o in json.load(open(rj))}
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = im.crop((0, 0, 1920, 1080)).resize((1080, 608), Image.LANCZOS)
    return np.asarray(im, float)
def sig(p):
    lo, hi = np.median(p[:6]), np.median(p[-6:])
    if abs(hi - lo) < 40: return None
    q = (p - lo) / (hi - lo)
    def cross(lev):
        for i in range(len(q) - 1):
            if (q[i] - lev) * (q[i + 1] - lev) <= 0 and q[i] != q[i + 1]: return i + (lev - q[i]) / (q[i + 1] - q[i])
        return None
    c1, c9 = cross(0.1), cross(0.9)
    return None if c1 is None or c9 is None else abs(c9 - c1) / 2.563
for n in range(a, b + 1):
    o = R.get(n)
    if not o or 'L' not in o or o['L'] is None: print(n); continue
    g = load(n); L = o['L']; cx = o['cx']
    T = o.get('T'); y0 = int((T if T and T > 0 else 0) + 40); y1 = min(600, y0 + 120)
    band = np.median(g[y0:y1, :], axis=0)
    x0 = int(L) - 30; sL = sig(band[max(0, x0):x0 + 60]) if x0 > 0 else None
    out = [n, 'sL=%.2f' % sL if sL else 'sL=-']
    if T and T > 25:
        col = np.median(g[:, int(cx) - 60:int(cx) + 60], axis=1); t0 = int(T) - 25
        sT = sig(col[t0:t0 + 50]); out.append('sT=%.2f' % sT if sT else 'sT=-')
    print(*out)
