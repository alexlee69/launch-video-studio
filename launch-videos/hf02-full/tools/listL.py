# list offset L(n) via consecutive-frame vertical profile correlation of the text column; pill top/bottom at x 760..830
import sys, os, json
import numpy as np
from PIL import Image
d = sys.argv[1]; a, b = int(sys.argv[2]), int(sys.argv[3]); anchor_n, anchor_L = int(sys.argv[4]), float(sys.argv[5])
def gray(n): return np.asarray(Image.open(os.path.join(d, 'n%04d.png' % n)).convert('RGB')).astype(float).mean(axis=2)
def prof(g):
    reg = g[:, 345:760]; w = np.clip(215 - reg, 0, None)   # text darker than ~215 (pill 231, bg 246)
    return w.sum(axis=1)
def shift(p, q, lo=-150, hi=25):
    # find s maximizing sum p(y) q(y+s) normalized over overlap
    best = None; vals = {}
    for s in range(lo, hi + 1):
        if s >= 0: A, B = p[:len(p) - s], q[s:]
        else: A, B = p[-s:], q[:len(q) + s]
        den = np.sqrt((A * A).sum() * (B * B).sum()) + 1e-9
        v = (A * B).sum() / den; vals[s] = v
        if best is None or v > best[1]: best = (s, v)
    s, v = best
    if s - 1 in vals and s + 1 in vals:
        y0, y1, y2 = vals[s - 1], v, vals[s + 1]; den = y0 - 2 * y1 + y2
        if den < 0: s = s + 0.5 * (y0 - y2) / den
    return s, v
def pill(g):
    col = g[:, 760:830].mean(axis=1); mid = (245.5 + 231) / 2; below = col < mid
    if not below.any(): return None, None
    i0 = int(np.argmax(below)); i1 = len(col) - 1 - int(np.argmax(below[::-1]))
    t = i0 - 1 + (col[i0 - 1] - mid) / (col[i0 - 1] - col[i0]) if i0 > 0 else 0.0
    bt = i1 + (col[i1] - mid) / (col[i1] - col[i1 + 1]) if i1 + 1 < len(col) else float(i1)
    return round(t, 2), round(bt, 2)
G = {n: gray(n) for n in range(a, b + 1)}
P = {n: prof(G[n]) for n in G}
dL = {}
for n in range(a, b):
    s, v = shift(P[n], P[n + 1]); dL[n + 1] = (s, v)
L = {anchor_n: anchor_L}
for n in range(anchor_n + 1, b + 1): L[n] = L[n - 1] + dL[n][0]
for n in range(anchor_n - 1, a - 1, -1): L[n] = L[n + 1] - dL[n + 1][0]
out = []
for n in range(a, b + 1):
    pt, pb = pill(G[n])
    r = dict(n=n, L=round(L[n], 2), dL=round(dL[n][0], 2) if n in dL else None, corr=round(dL[n][1], 3) if n in dL else None, pill_top=pt, pill_bot=pb)
    out.append(r); print(r)
json.dump(out, open(sys.argv[6], 'w'))
