# 2D projective deck model, fitted per frame to the reference's deck silhouettes (n555-622).
# Cards are parallel translates of each other, so their homographies differ only in the third column:
#   H_m = H_0 - m * [0 | 0 | v]      (m = 0 front card, m = 1 the card behind it, ...; v = (vx, vy, vz))
# H_0 maps the W×H card rect onto the front card's quad (TL, TR, BR, BL). Per frame: 8 corner numbers + v = 11 parameters,
# fitted (Nelder-Mead) to the top/bottom silhouette profiles + the front card's right-edge line.
# Card m (m >= 1) exists from the pop that put card k-m in front; at frame n the deck holds front(n)+1 cards (card 0 = shot A's card).
# usage: deckfit2.py <sil.jsonl> <quad.json> <out.json> <first> <last> [--init x0,y0,...,x3,y3,vx,vy,vz]
import sys, os, json, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from homog import rect2quad
W, H = 582.0, 505.0
def front(n): return 1 + (n - 555) // 2 if n <= 595 else 21
XS = np.arange(1080, dtype=float)
CORN = np.array([[0, 0, 1], [W, 0, 1], [W, H, 1], [0, H, 1]], float).T   # 3x4

def quads(p, k):
    q = p[:8].reshape(4, 2); v = np.array(p[8:11])
    H0 = rect2quad(W, H, q)
    base = H0 @ CORN                                  # 3x4 homogeneous corners of the front card
    out = []
    for m in range(k + 1):
        hm = base - m * v[:, None]
        out.append((hm[:2] / hm[2]).T)
    return out
def profiles(qs):
    top = np.full(1080, np.inf); bot = np.full(1080, -np.inf); mask = np.zeros(1080, bool)
    for q in qs:
        (x0, y0), (x1, y1), (x2, y2), (x3, y3) = q
        xl, xr = max(x0, x3), min(x1, x2)
        if xr <= xl: continue
        sel = (XS >= xl) & (XS <= xr)
        top[sel] = np.minimum(top[sel], y0 + (y1 - y0) * (XS[sel] - x0) / (x1 - x0))
        bot[sel] = np.maximum(bot[sel], y3 + (y2 - y3) * (XS[sel] - x3) / (x2 - x3))
        for xe in (xl, xr): mask |= np.abs(XS - xe) < 10
    return top, bot, mask
def huber(r, d=3.0):
    a = np.abs(r); return np.where(a < d, 0.5 * r * r, d * (a - 0.5 * d))
def make_cost(n, sil, Q, xmask=None):
    t = np.array([np.nan if v is None else v for v in sil['top']]); b = np.array([np.nan if v is None else v for v in sil['bot']])
    vt = np.isfinite(t) & (t > 1.0) & (t < 606.0); vb = np.isfinite(b) & (b > 1.0) & (b < 606.0)
    if xmask is not None: vt &= ~xmask; vb &= ~xmask
    has = np.isfinite(t)
    R = Q['R']; k = front(n)
    def cost(p):
        qs = quads(p, k)
        if any(not np.all(np.isfinite(q)) for q in qs): return 1e12
        top, bot, mask = profiles(qs)
        okt = vt & np.isfinite(top) & ~mask; okb = vb & np.isfinite(bot) & ~mask
        c = huber(top[okt] - t[okt]).sum() + huber(bot[okb] - b[okb]).sum()
        c += 30.0 * (has ^ np.isfinite(top)).sum()
        q = qs[0]
        for f in (0.15, 0.3, 0.45, 0.6, 0.75, 0.9):
            y = q[1][1] + f * (q[2][1] - q[1][1]); xm = q[1][0] + f * (q[2][0] - q[1][0])
            if 2 < y < 605: c += 6 * huber(np.array([xm - (R[0] + R[1] * y)])).sum()
        return c
    return cost
def nm(f, x0, steps, iters=600):
    n = len(x0); pts = [np.array(x0, float)]
    for i in range(n):
        p = np.array(x0, float); p[i] += steps[i]; pts.append(p)
    vals = [f(p) for p in pts]
    for _ in range(iters):
        o = np.argsort(vals); pts = [pts[i] for i in o]; vals = [vals[i] for i in o]
        c = np.mean(pts[:-1], axis=0)
        xr = c + (c - pts[-1]); fr = f(xr)
        if fr < vals[0]:
            xe = c + 2 * (c - pts[-1]); fe = f(xe)
            if fe < fr: pts[-1], vals[-1] = xe, fe
            else: pts[-1], vals[-1] = xr, fr
        elif fr < vals[-2]: pts[-1], vals[-1] = xr, fr
        else:
            xc = c + 0.5 * (pts[-1] - c); fc = f(xc)
            if fc < vals[-1]: pts[-1], vals[-1] = xc, fc
            else:
                for i in range(1, len(pts)):
                    pts[i] = pts[0] + 0.5 * (pts[i] - pts[0]); vals[i] = f(pts[i])
    i = int(np.argmin(vals)); return pts[i], vals[i]
STEPS1 = [8, 8, 8, 8, 8, 8, 8, 8, 6, 3, 0.03]
STEPS2 = [2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0.01]
def solve(cost, init):
    p, v = nm(cost, init, STEPS1, 700)
    for _ in range(3):
        p, v = nm(cost, p, STEPS2, 500)
    return p, v
if __name__ == '__main__':
    sil = {}
    for l in open(sys.argv[1]):
        r = json.loads(l); sil[r['n']] = r
    Q = {r['n']: r for r in json.load(open(sys.argv[2]))}
    out = sys.argv[3]; a, b = int(sys.argv[4]), int(sys.argv[5])
    init = [float(v) for v in sys.argv[sys.argv.index('--init') + 1].split(',')] if '--init' in sys.argv else None
    res = {}
    if os.path.exists(out) and '--fresh' not in sys.argv: res = {int(k): v for k, v in json.load(open(out)).items()}
    prev = init
    for n in range(a, b + 1):
        if prev is None: prev = res[n - 1]['p']
        start = list(prev)
        if front(n) > front(n - 1) and n > 555:
            # a pop: the old front becomes m=1, so the new front's homogeneous corners are the old ones + v
            q = np.array(start[:8]).reshape(4, 2); v = np.array(start[8:11])
            H0 = rect2quad(W, H, q); hc = H0 @ CORN + v[:, None]; start = list((hc[:2] / hc[2]).T.reshape(-1)) + list(v)
        cost = make_cost(n, sil[n], Q[n])
        p, val = solve(cost, start)
        res[n] = dict(p=[round(float(x), 4) for x in p], cost=round(float(val), 1))
        print(n, [round(float(x), 1) for x in p[:8]], [round(float(x), 4) for x in p[8:]], round(float(val), 1), flush=True)
        prev = list(p)
        json.dump({str(k): v for k, v in sorted(res.items())}, open(out, 'w'))
