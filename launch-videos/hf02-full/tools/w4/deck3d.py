# 3D deck model, n555-622. Measured: the reference's deck is a CSS-style perspective scene with P ≈ 1680 px about the frame
# centre (540, 304); every card is turned rotateY(θ ≈ 27.5°) and the camera only translates in B1 (θ and P are constant).
# Step 1: per frame, the front card's pose (X, Y, Z, θ) from its four measured corners (P fixed).
# Step 2: the deck step D (camera coords, card m-1 minus card m) fitted over all B1 frames to the staircase steps.
# usage: deck3d.py <sil.jsonl> <deckf.json> <out.json>
import sys, os, json, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from deckv import front_quad, front, W, H
from deckfit2 import nm
P = 1680.0; CX, CY = 540.0, 304.0
sil = {}
for l in open(sys.argv[1]):
    r = json.loads(l); sil[r['n']] = r
def corners3d(X, Y, Z, th):
    c, s = math.cos(math.radians(th)), math.sin(math.radians(th))
    pts = []
    for ox, oy in ((-W / 2, -H / 2), (W / 2, -H / 2), (W / 2, H / 2), (-W / 2, H / 2)):
        x = X + ox * c; z = Z - ox * s; y = Y + oy
        f = P / (P - z); pts.append((CX + x * f, CY + y * f))
    return np.array(pts)
def fit_pose(q, init):
    f = lambda p: float(np.sum((corners3d(*p) - q) ** 2))
    p, v = nm(f, init, [20, 10, 40, 2], 400); p, v = nm(f, p, [2, 1, 4, 0.2], 400)
    return p, math.sqrt(v / 8)
poses = {}
init = [-100.0, 20.0, -150.0, 27.5]
for n in range(555, 623):
    q = front_quad(n)
    p, rms = fit_pose(q, init); poses[n] = (p, rms); init = list(p)
    print(n, 'X %.1f Y %.1f Z %.1f th %.2f rms %.2f' % (p[0], p[1], p[2], p[3], rms))
def arr(v): return np.array([np.nan if x is None else x for x in v])
def steps(p, sign, xmax, thr=2.0):
    out = []
    for x in range(1, int(min(xmax, 1079))):
        if np.isfinite(p[x]) and np.isfinite(p[x - 1]) and sign * (p[x] - p[x - 1]) > thr and 1 < p[x] < 606 and 1 < p[x - 1] < 606:
            if out and x - out[-1][1] <= 3: out[-1][1] = x
            else: out.append([x, x])
    return [s[0] - 0.5 for s in out]
OBS = {}
for n in range(555, 595):
    q = front_quad(n)
    t = arr(sil[n]['top']); b = arr(sil[n]['bot'])
    OBS[n] = (steps(t, -1, q[0][0] - 4), steps(b, +1, q[3][0] - 4))
def dcost(D, verbose=False):
    c = 0.0; cnt = 0
    for n in OBS:
        (X, Y, Z, th), _ = poses[n]; k = front(n)
        tl = []; bl = []
        for m in range(1, k + 1):
            q = corners3d(X - m * D[0], Y - m * D[1], Z - m * D[2], th)
            tl.append(q[0][0]); bl.append(q[3][0])
        tl = np.array(tl); bl = np.array(bl)
        for xs, pred in ((OBS[n][0], tl), (OBS[n][1], bl)):
            vis = pred[pred > 0]
            for x in xs:
                d = np.min(np.abs(vis - x)) if len(vis) else 50
                c += min(d, 12) ** 2; cnt += 1
    return c / max(cnt, 1)
if __name__ == '__main__':
    best = None
    for D0 in ([20, 0, 40], [40, 0, 60], [10, -5, 30], [30, 5, 80]):
        D, v = nm(dcost, D0, [10, 5, 15], 300); D, v = nm(dcost, D, [2, 1, 3], 300)
        print('D', [round(x, 2) for x in D], 'cost', round(v, 3))
        if best is None or v < best[1]: best = (D, v)
    D = best[0]
    print('best D', [round(x, 3) for x in D], 'mean sq err', round(best[1], 3))
    json.dump(dict(P=P, D=list(map(float, D)), poses={str(n): [float(x) for x in p] + [float(r)] for n, (p, r) in poses.items()}),
              open(sys.argv[3], 'w'))
