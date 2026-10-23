# Deck n595-622: the landing card (card 21) + the rigid deck behind it.
#  - card 21 pose: deck3d.py fits (P = 1680) for n598-622, lightly smoothed; n595-597 refitted with θ extrapolated (its right edge
#    is off-frame there) against its left edge and top line.
#  - deck behind: rigid slots W_j (deckrig.json) moved by the camera offset off(594) + s(n)·u (u = deck axis) with s(n) found by a
#    scan against the staircase steps (top and bottom), n595-618.
#  - collapse n619-623: the slots slide onto card 21: position = card21 + c(n)·(slot - card21), c fitted to the deck's left extent.
import sys, os, json, math
import numpy as np
sys.argv = [sys.argv[0], 'out/w4/meas/sil_deck.jsonl', 'out/w4/meas/deckf.json', '/dev/null']
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from deckv import front_quad
from deckfit2 import nm
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')); M = os.path.join(ROOT, 'out', 'w4', 'meas')
P = 1680.0; CX, CY = 540.0, 304.0; W, H = 582.0, 505.0
rig = json.load(open(os.path.join(M, 'deckrig.json')))
Wj = {int(k): np.array(v) for k, v in rig['W'].items()}; off = {int(k): np.array(v) for k, v in rig['off'].items()}
PO = {int(k): v for k, v in json.load(open(os.path.join(M, 'deck3d.json')))['poses'].items()}
DM = {int(k): v for k, v in json.load(open(os.path.join(M, 'deckm.json'))).items()}
sil = {}
for l in open(os.path.join(M, 'sil_deck.jsonl')):
    r = json.loads(l); sil[r['n']] = r
def corners3d(X, Y, Z, th):
    c, s = math.cos(math.radians(th)), math.sin(math.radians(th)); pts = []
    for ox, oy in ((-W / 2, -H / 2), (W / 2, -H / 2), (W / 2, H / 2), (-W / 2, H / 2)):
        x = X + ox * c; z = Z - ox * s; y = Y + oy; f = P / (P - z); pts.append((CX + x * f, CY + y * f))
    return np.array(pts)
# ── card 21 (landing card)
A = {n: list(PO[n][:4]) for n in range(598, 623)}
sm = {}
for n in range(598, 623):
    if 599 <= n <= 621: sm[n] = [(A[n - 1][i] + 2 * A[n][i] + A[n + 1][i]) / 4 for i in range(4)]
    else: sm[n] = A[n]
th_slope = (sm[606][3] - sm[599][3]) / 7.0
for n in (597, 596, 595):
    th = sm[n + 1][3] - th_slope
    q = front_quad(n); TL = q[0]; ct = DM[n]['ct']
    def f(p):
        X, Z = p; c = corners3d(X, 0.0, Z, th)
        e = (c[0][0] - TL[0]) ** 2
        for xx in (c[0][0], (c[0][0] + c[1][0]) / 2):   # model top line vs measured top line at two columns on the card
            t = (xx - c[0][0]) / (c[1][0] - c[0][0]); ym = c[0][1] + t * (c[1][1] - c[0][1]); e += (ym - (ct[0] * xx + ct[1])) ** 2
        return e
    p, v = nm(f, [sm[n + 1][0] + 15, sm[n + 1][2] + 20], [10, 20], 300); p, v = nm(f, p, [2, 4], 300)
    sm[n] = [p[0], 0.0, p[1], th]
    print('card21', n, [round(x, 2) for x in sm[n]], 'err', round(math.sqrt(v), 2))
# ── deck offset scan n595-618
u = np.array(rig['D0']) / np.linalg.norm(rig['D0'])
def arr(v): return np.array([np.nan if x is None else x for x in v])
def steps(p, sign, xmax, thr=2.0):
    out = []
    for x in range(1, int(min(xmax, 1079))):
        if np.isfinite(p[x]) and np.isfinite(p[x - 1]) and sign * (p[x] - p[x - 1]) > thr and 1 < p[x] < 606 and 1 < p[x - 1] < 606:
            if out and x - out[-1][1] <= 3: out[-1][1] = x
            else: out.append([x, x])
    return [s[0] - 0.5 for s in out]
svals = {}
for n in range(595, 619):
    c21 = corners3d(*sm[n]); xmax = min(c21[0][0], c21[3][0]) - 4
    t = arr(sil[n]['top']); ob = steps(t, -1, xmax)
    best = None
    for s in np.arange(-300, 400, 1.0):
        o = off[594] + s * u; pred = []
        for j in range(0, 21):
            X, Z = Wj[j] + o; c = corners3d(X, 22.7 if j else 0.0, Z, 27.5); pred.append(c[0][0])
        pred = np.array(pred); pred = pred[(pred > 0) & (pred < xmax)]
        if not len(pred) or not ob: continue
        e = np.mean([min(np.min(np.abs(pred - x)), 15) ** 2 for x in ob]) + np.mean([min(np.min(np.abs(np.array(ob) - x)), 15) ** 2 for x in pred])
        if best is None or e < best[1]: best = (s, e)
    svals[n] = best[0]; print('deck', n, 's', best[0], 'err', round(best[1], 2), 'nsteps', len(ob))
json.dump(dict(card21={n: [round(x, 3) for x in sm[n]] for n in sorted(sm)}, s=svals, u=u.tolist()), open(os.path.join(M, 'deckb2.json'), 'w'), indent=0)
