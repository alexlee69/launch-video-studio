# Fit a 3D deck model to the reference's deck silhouettes (n555-618).
# Model: cards W×H share one orientation; card j sits at C0 + j·D (D = step in card-local coords, rotated with the deck);
# card j (j>=1) appears at n = 555 + 2(j-1); card 0 is the first review card (shot A). Camera: CSS perspective P about (540, 304).
# Per frame we fit the pose of the FRONT card (X, Y, Z, rotY, rotX, rotZ) against the top/bottom silhouette profiles and the
# front card's right-edge line; globals (P, D) are fitted over all frames by an outer search.
# usage: deckfit.py <sil.jsonl> <quad.json> <out.json> [--globals P,dx,dy,dz]
import sys, os, json, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from deckfit_core import W, H, CX, CY, front, rot, OFF, cards
import os
sil = {}
for l in open(sys.argv[1]):
    r = json.loads(l); sil[r['n']] = r
Q = {r['n']: r for r in json.load(open(sys.argv[2]))}
out = sys.argv[3]
FR = [n for n in range(555, 619) if n in sil]

XS = np.arange(1080, dtype=float)
def profiles(qs):
    top = np.full(1080, np.inf); bot = np.full(1080, -np.inf); mask = np.zeros(1080, bool)
    for q in qs:
        (x0, y0), (x1, y1), (x2, y2), (x3, y3) = q
        xl, xr = max(x0, x3), min(x1, x2)
        if xr <= xl: continue
        sel = (XS >= xl) & (XS <= xr)
        yt = y0 + (y1 - y0) * (XS[sel] - x0) / (x1 - x0)
        yb = y3 + (y2 - y3) * (XS[sel] - x3) / (x2 - x3)
        top[sel] = np.minimum(top[sel], yt); bot[sel] = np.maximum(bot[sel], yb)
        for xe in (xl, xr): mask |= np.abs(XS - xe) < 14      # rounded corners: ignore columns near any card's side
    return top, bot, mask
def meas(n):
    r = sil[n]
    t = np.array([np.nan if v is None else v for v in r['top']]); b = np.array([np.nan if v is None else v for v in r['bot']])
    return t, b
MEAS = {n: meas(n) for n in FR}
def huber(r, d=4.0):
    a = np.abs(r); return np.where(a < d, 0.5 * r * r, d * (a - 0.5 * d))
def cost(pose, G, n):
    k = front(n); qs = cards(pose, G, k)
    top, bot, mask = profiles(qs)
    t, b = MEAS[n]
    c = 0.0
    okt = np.isfinite(t) & np.isfinite(top) & ~mask & (t > 1.5) & (t < 606)
    okb = np.isfinite(b) & np.isfinite(bot) & ~mask & (b > 1.5) & (b < 606)
    c += huber(top[okt] - t[okt]).sum() + huber(bot[okb] - b[okb]).sum()
    # coverage mismatch: columns where one has a silhouette and the other not
    c += 40.0 * (np.isfinite(t) ^ np.isfinite(top)).sum()
    # front card right edge (quad.py R line: x = R0 + R1*y), sampled at 5 heights
    R = Q[n]['R']; q = qs[0]
    for f in (0.2, 0.35, 0.5, 0.65, 0.8):
        y = q[1][1] + f * (q[2][1] - q[1][1]); xm = q[1][0] + f * (q[2][0] - q[1][0])
        if 2 < y < 605: c += 4 * huber(np.array([xm - (R[0] + R[1] * y)])).sum()
    return c
def nm(f, x0, steps, iters=300):
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
def fit_frames(G, frames, init, verbose=False):
    poses = {}; total = 0.0; prev = init
    for n in frames:
        f = lambda p: cost(p, G, n)
        best = None
        for start in ([prev] if best is None else []) + [prev]:
            p, v = nm(f, start, [25, 25, 60, 4, 2, 1.5], 260)
            p, v = nm(f, p, [5, 5, 15, 1, 0.5, 0.4], 200)
            if best is None or v < best[1]: best = (p, v)
        poses[n] = best[0]; total += best[1]; prev = list(best[0])
        if verbose: print(n, [round(x, 2) for x in best[0]], round(best[1], 1), flush=True)
    return poses, total

if __name__ == '__main__':
    G = [1500.0, -60.0, -6.0, -45.0]
    if '--globals' in sys.argv: G = [float(v) for v in sys.argv[sys.argv.index('--globals') + 1].split(',')]
    init = [80.0, 20.0, -150.0, 25.0, 0.0, 0.0]
    if '--init' in sys.argv: init = [float(v) for v in sys.argv[sys.argv.index('--init') + 1].split(',')]
    frames = FR
    if '--frames' in sys.argv:
        a, b = [int(v) for v in sys.argv[sys.argv.index('--frames') + 1].split(',')]; frames = [n for n in FR if a <= n <= b]
    if '--searchG' in sys.argv:
        # outer search over globals on a subset of frames
        sub = [n for n in frames if n % 4 == 1][:10]
        def gcost(Gv):
            _, t = fit_frames(list(Gv), sub, init); print('G', [round(x, 2) for x in Gv], round(t, 1), flush=True); return t
        Gb, vb = nm(gcost, G, [300, 20, 6, 20], 40)
        G = list(Gb); print('best G', G, vb)
    poses, total = fit_frames(G, frames, init, verbose=True)
    json.dump(dict(G=G, poses={n: list(map(float, p)) for n, p in poses.items()}, total=total), open(out, 'w'))
    print('total', total)
