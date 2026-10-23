# Roster shot on OUR render (1080-wide frames): slot (white card) top/bottom from a column with no text, and the list
# offset L from frame-to-frame correlation of the text column's ink profile (same idea as tools/listL.py on the reference).
# usage: listours.py <dir> <first> <last> <anchor_n> <anchor_L> <out.json>
import sys, os, json
import numpy as np
from PIL import Image
d = sys.argv[1]; a, b = int(sys.argv[2]), int(sys.argv[3]); an, aL = int(sys.argv[4]), float(sys.argv[5]); out = sys.argv[6]
def gray(n): return np.asarray(Image.open(os.path.join(d, 'n%04d.png' % n)).convert('RGB')).astype(float).mean(axis=2)
def prof(g):
    reg = g[:, 330:760]; bg = np.percentile(reg, 95, axis=1, keepdims=True)
    return np.clip(bg - reg - 6, 0, None).sum(axis=1)
def slot(g):
    col = g[:, 840:880].mean(axis=1); hi = 254.0; lo = 244.0; mid = (hi + lo) / 2
    above = col > mid
    if not above.any(): return None, None
    i0 = int(np.argmax(above)); i1 = len(col) - 1 - int(np.argmax(above[::-1]))
    t = i0 - 1 + (mid - col[i0 - 1]) / (col[i0] - col[i0 - 1]) if i0 > 0 else 0.0
    bt = i1 + (col[i1] - mid) / (col[i1] - col[i1 + 1]) if i1 + 1 < len(col) else float(i1)
    return round(t, 2), round(bt, 2)
def shift(p, q, lo=-150, hi=60):
    best = None; vals = {}
    for s in range(lo, hi + 1):
        if s >= 0: A, B = p[:len(p) - s], q[s:]
        else: A, B = p[-s:], q[:len(q) + s]
        v = (A * B).sum() / (np.sqrt((A * A).sum() * (B * B).sum()) + 1e-9); vals[s] = v
        if best is None or v > best[1]: best = (s, v)
    s, v = best
    if s - 1 in vals and s + 1 in vals:
        y0, y1, y2 = vals[s - 1], v, vals[s + 1]; den = y0 - 2 * y1 + y2
        if den < 0: s = s + 0.5 * (y0 - y2) / den
    return s, v
G = {n: gray(n) for n in range(a, b + 1)}; P = {n: prof(G[n]) for n in G}
dL = {n + 1: shift(P[n], P[n + 1]) for n in range(a, b)}
L = {an: aL}
for n in range(an + 1, b + 1): L[n] = L[n - 1] + dL[n][0]
for n in range(an - 1, a - 1, -1): L[n] = L[n + 1] - dL[n + 1][0]
res = []
for n in range(a, b + 1):
    t, bt = slot(G[n]); r = dict(n=n, L=round(L[n], 2), corr=round(dL[n][1], 3) if n in dL else None, slot_top=t, slot_bot=bt)
    res.append(r); print(r, flush=True)
json.dump(res, open(out, 'w'))
