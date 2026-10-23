# Deck behind the front card, n555-622, fitted per frame to the silhouettes LEFT of the front card.
# 3D model (P = 1680 about (540, 304), every card rotateY(θ)): back card m (m = 1..K) sits at
#     F_settled - (g + (m - 1)·λ)·D0        F = front card centre (X, Z), D0 = the pop step (deckrig.json), Y = Yd
# Per frame (g, λ, Yd) by a coarse grid then Nelder-Mead. θ: 27.5° (the measured deck angle), the front card's θ from n619 (collapse).
# Front card: deck3d poses (n555-594), deckb2 card21 (n595-622).
import sys, os, json, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from deckfit2 import nm
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')); M = os.path.join(ROOT, 'out', 'w4', 'meas')
P = 1680.0; CX, CY = 540.0, 304.0; W, H = 582.0, 505.0
rig = json.load(open(os.path.join(M, 'deckrig.json'))); D0 = np.array(rig['D0'])
PO = {int(k): v for k, v in json.load(open(os.path.join(M, 'deck3d.json')))['poses'].items()}
C21 = {int(k): v for k, v in json.load(open(os.path.join(M, 'deckb2.json')))['card21'].items()}
sil = {}
for l in open(os.path.join(M, 'sil_deck.jsonl')):
    r = json.loads(l); sil[r['n']] = r
XS = np.arange(1080, dtype=float)
def front(n): return 1 + (n - 555) // 2 if n <= 595 else 21
def fpose(n):
    if n <= 594: return PO[n][:4]
    return C21[n]
def quad(X, Y, Z, th):
    c, s = math.cos(math.radians(th)), math.sin(math.radians(th))
    ox = np.array([-W / 2, W / 2, W / 2, -W / 2]); oy = np.array([-H / 2, -H / 2, H / 2, H / 2])
    x = X + ox * c; z = Z - ox * s; y = Y + oy; f = P / (P - z)
    return np.stack([CX + x * f, CY + y * f], 1)
def profiles(qs, xmax):
    top = np.full(1080, np.inf); bot = np.full(1080, -np.inf)
    for q in qs:
        (x0, y0), (x1, y1), (x2, y2), (x3, y3) = q
        xl, xr = max(x0, x3), min(x1, x2, xmax)
        if xr <= xl: continue
        sel = (XS >= xl) & (XS <= xr)
        top[sel] = np.minimum(top[sel], y0 + (y1 - y0) * (XS[sel] - x0) / (x1 - x0))
        bot[sel] = np.maximum(bot[sel], y3 + (y2 - y3) * (XS[sel] - x3) / (x2 - x3))
    return top, bot
def hub(r, d=3.0):
    a = np.abs(r); return np.where(a < d, 0.5 * r * r, d * (a - 0.5 * d))
res = {}
prev = None
for n in range(555, 623):
    X, Y, Z, thf = fpose(n); K = front(n)
    th = thf if n >= 619 else 27.5
    qf = quad(X, Y, Z, thf); xmax = min(qf[0][0], qf[3][0]) - 2
    t = np.array([np.nan if v is None else v for v in sil[n]['top']]); b = np.array([np.nan if v is None else v for v in sil[n]['bot']])
    reg = XS < xmax
    vt = reg & np.isfinite(t) & (t > 1) & (t < 606); vb = reg & np.isfinite(b) & (b > 1) & (b < 606)
    fin = np.where(np.isfinite(t))[0]; dleft = float(fin[0]) if len(fin) else 0.0
    def cost(p):
        g, lam, Yd, phi = p
        if lam < 0.02 or g < 0.0: return 1e9
        dd = np.linalg.norm(D0) * np.array([math.sin(math.radians(phi)), math.cos(math.radians(phi))])
        qs = [quad(X - (g + (m - 1) * lam) * dd[0], Yd, Z - (g + (m - 1) * lam) * dd[1], th) for m in range(1, K + 1)]
        top, bot = profiles(qs, xmax)
        o1 = vt & np.isfinite(top); o2 = vb & np.isfinite(bot)
        c = hub(top[o1] - t[o1]).sum() + hub(bot[o2] - b[o2]).sum()
        c += 40.0 * ((vt & ~np.isfinite(top)).sum() + (vb & ~np.isfinite(bot)).sum())    # data with no model card
        c += 6.0 * ((reg & np.isfinite(top) & ~np.isfinite(t)).sum())                      # model card with no data
        if dleft > 0.5:
            ml = min(min(q[0][0], q[3][0]) for q in qs); c += 2.0 * (ml - dleft) ** 2
        return c
    best = None
    grid_g = np.linspace(0.2, 3.0, 15); grid_l = np.linspace(0.15, 2.4, 16)
    Ys = [22.7, Y] if n >= 595 else [22.7]
    for Yd in Ys:
      for phi in (8.0, 16.0, 23.3, 30.0, 38.0):
        for g in grid_g:
            for lam in grid_l:
                v = cost([g, lam, Yd, phi])
                if best is None or v < best[1]: best = ([g, lam, Yd, phi], v)
    if prev is not None:
        v = cost(prev)
        if v < best[1]: best = (list(prev), v)
    p, v = nm(cost, best[0], [0.15, 0.1, 4.0, 3.0], 300); p, v = nm(cost, p, [0.03, 0.02, 1.0, 0.6], 300)
    prev = list(p)
    res[n] = dict(g=round(float(p[0]), 4), lam=round(float(p[1]), 4), Yd=round(float(p[2]), 2), phi=round(float(p[3]), 3), th=th, cost=round(float(v), 1),
                  ncols=int(vt.sum() + vb.sum()))
    print(n, 'g %.3f lam %.3f Yd %.1f phi %.1f' % tuple(p), 'cost %.0f cols %d -> %.2f/col' % (v, vt.sum() + vb.sum(), v / max(1, vt.sum() + vb.sum())), flush=True)
json.dump({str(k): v for k, v in res.items()}, open(os.path.join(M, 'deckfit3.json'), 'w'), indent=0)
