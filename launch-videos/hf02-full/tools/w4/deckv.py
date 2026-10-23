# Deck n555-622: front-card quads (horizon model, deckfront.json) + the deck behind it as H_m = H_0 - m*[0|0|v].
# v = (vx, vy, vz) is fitted per frame (Nelder-Mead) to the top/bottom silhouettes LEFT of the front card.
# usage: deckv.py <sil.jsonl> <deckf.json> <out.json>
import sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from homog import rect2quad
from deckfit2 import nm, huber
W, H = 582.0, 505.0; CY = 304.0
def front(n): return 1 + (n - 555) // 2 if n <= 595 else 21
sil = {}
for l in open(sys.argv[1]):
    r = json.loads(l); sil[r['n']] = r
F = {int(k): v for k, v in json.load(open(sys.argv[2])).items()}
XS = np.arange(1080, dtype=float)
CORN = np.array([[0, 0, 1], [W, 0, 1], [W, H, 1], [0, H, 1]], float).T
def kval(n):
    k = F[n].get('k')
    if k is not None: return k
    if n <= 594: return -1.30 if (n - 555) % 2 == 0 else -1.20      # pop frames −1.30, second frames −1.20 (measured pattern)
    return -0.999
def front_quad(n):
    f = F[n]; ct = f['ct']; R = f['R']; xl = f['xl']; k = kval(n)
    yt = lambda x: ct[0] * x + ct[1]
    TR = [R[0] + R[1] * ((ct[0] * R[0] + ct[1]) / (1 - ct[0] * R[1])), (ct[0] * R[0] + ct[1]) / (1 - ct[0] * R[1])]
    TL = [xl, yt(xl)]
    BRy = CY + k * (TR[1] - CY); BR = [R[0] + R[1] * BRy, BRy]
    BL = [xl, CY + k * (TL[1] - CY)]
    return np.array([TL, TR, BR, BL])
def deck_quads(q0, v, k):
    H0 = rect2quad(W, H, q0); base = H0 @ CORN; out = []
    for m in range(1, k + 1):
        hm = base - m * np.asarray(v)[:, None]; out.append((hm[:2] / hm[2]).T)
    return out
def profiles(qs, xmax):
    top = np.full(1080, np.inf); bot = np.full(1080, -np.inf); mask = np.zeros(1080, bool)
    for q in qs:
        (x0, y0), (x1, y1), (x2, y2), (x3, y3) = q
        xl, xr = max(x0, x3), min(x1, x2, xmax)
        if xr <= xl: continue
        sel = (XS >= xl) & (XS <= xr)
        top[sel] = np.minimum(top[sel], y0 + (y1 - y0) * (XS[sel] - x0) / (x1 - x0))
        bot[sel] = np.maximum(bot[sel], y3 + (y2 - y3) * (XS[sel] - x3) / (x2 - x3))
    return top, bot, mask
if __name__ == '__main__':
    out = sys.argv[3]; res = {}
    v = np.array([22.5, -4.56, -0.015])
    for n in range(555, 623):
        q0 = front_quad(n); k = front(n)
        xmax = min(q0[0][0], q0[3][0]) - 3
        t = np.array([np.nan if x is None else x for x in sil[n]['top']]); b = np.array([np.nan if x is None else x for x in sil[n]['bot']])
        region = XS < xmax
        vt = region & np.isfinite(t) & (t > 1) & (t < 606); vb = region & np.isfinite(b) & (b > 1) & (b < 606)
        has = region & np.isfinite(t)
        fin = np.where(np.isfinite(t))[0]; dleft = float(fin[0]) if len(fin) else 0.0
        def cost(p):
            qs = deck_quads(q0, p, k)
            if any(not np.all(np.isfinite(q)) for q in qs): return 1e12
            top, bot, mask = profiles(qs, xmax)
            ok1 = vt & np.isfinite(top) & ~mask; ok2 = vb & np.isfinite(bot) & ~mask
            c = huber(top[ok1] - t[ok1]).sum() + huber(bot[ok2] - b[ok2]).sum()
            if p[2] >= -1e-4: c += 1e6
            # the deck's left extent (data: first column with a silhouette; model: leftmost card corner), when on-screen
            if dleft > 0.5:
                ml = min(min(q[0][0], q[3][0]) for q in qs)
                c += 3.0 * (ml - dleft) ** 2
            # columns the data covers but the model does not (or vice versa), softly
            c += 2.0 * (has ^ (region & np.isfinite(top))).sum()
            return c
        best = None
        for start in (v, v * np.array([1.2, 1.2, 1.2]), v * np.array([0.8, 0.8, 0.8])):
            p, val = nm(cost, list(start), [3, 1.5, 0.003], 300)
            p, val = nm(cost, list(p), [0.6, 0.3, 0.0006], 300)
            if best is None or val < best[1]: best = (p, val)
        v = np.array(best[0])
        res[n] = dict(q0=q0.round(3).tolist(), v=[round(float(x), 5) for x in v], k=k, cost=round(float(best[1]), 1),
                      ncols=int(vt.sum() + vb.sum()))
        print(n, 'v', [round(float(x), 4) for x in v], 'cost', round(float(best[1]), 1), 'cols', int(vt.sum() + vb.sum()), flush=True)
    json.dump({str(k_): v_ for k_, v_ in res.items()}, open(out, 'w'))
