# Deck n555-622, cards behind the front card: H_m = H_0 - (m - 1 + g) * [0|0|v]  (m >= 1; g = 1 while the front card is part of
# the deck (B1, n555-594); g is scanned once the landing card is in front, n595+).
# v is solved per frame by LINEAR least squares from the staircase steps (each step = the left edge of one card behind):
#   top-left corners  x_m (1 - j vz) = TLx - j vx ,  y_m (1 - j vz) = TLy - j vy      (j = m - 1 + g)
#   bottom-left       x_m (w - j vz) = w BLx - j vx, y_m (w - j vz) = w BLy - j vy     (w = H_0 weight of the BL corner)
# Step indices are assigned in order from the front, then re-assigned to the nearest predicted index and refitted.
# usage: deckv2.py <sil.jsonl> <deckf.json> <out.json>
import sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from homog import rect2quad
from deckv import front_quad, front, W, H
sil = {}
for l in open(sys.argv[1]):
    r = json.loads(l); sil[r['n']] = r
def arr(v): return np.array([np.nan if x is None else x for x in v])
def steps(p, sign, xmax, thr=2.0):
    out = []
    for x in range(1, int(min(xmax, 1079))):
        if np.isfinite(p[x]) and np.isfinite(p[x - 1]) and sign * (p[x] - p[x - 1]) > thr and 1 < p[x] < 606 and 1 < p[x - 1] < 606:
            if out and x - out[-1][1] <= 3: out[-1][1] = x
            else: out.append([x, x])
    return [s[0] - 0.5 for s in out]
def corner_y(p, xs_sorted, i):
    # the card whose left edge is xs_sorted[i]: fit its edge on [x+5, next step-3] and evaluate at its left edge
    x = xs_sorted[i]; xe = xs_sorted[i - 1] if i > 0 else None
    hi = (xe - 3) if xe is not None else x + 40
    xs = np.arange(int(x + 5), int(hi))
    ys = p[xs] if len(xs) else np.array([])
    ok = np.isfinite(ys) & (ys > 1) & (ys < 606) if len(xs) else np.array([], bool)
    if ok.sum() >= 4:
        c = np.polyfit(xs[ok], ys[ok], 1); return float(np.polyval(c, x))
    xi = int(round(x + 2)); return float(p[xi]) if np.isfinite(p[xi]) else None
def solve(obs, g):
    # obs: list of (kind, m, x, y, w, X0, Y0) ; returns v and rms
    A = []; bx = []
    for kind, m, x, y, w, X0, Y0 in obs:
        j = m - 1 + g
        A.append([j, -j * x]); bx.append(w * X0 - w * x)          # j vx - j vz x = w X0 - w x   (w = 1 for TL)
    A = np.array(A); bx = np.array(bx)
    sol, *_ = np.linalg.lstsq(A, bx, rcond=None); vx, vz = sol
    Ay = []; by = []
    for kind, m, x, y, w, X0, Y0 in obs:
        j = m - 1 + g
        if y is None: continue
        Ay.append([j]); by.append(w * Y0 - y * (w - j * vz))
    vy = float(np.linalg.lstsq(np.array(Ay), np.array(by), rcond=None)[0][0]) if Ay else 0.0
    res = []
    for kind, m, x, y, w, X0, Y0 in obs:
        j = m - 1 + g
        px = (w * X0 - j * vx) / (w - j * vz); res.append(px - x)
    return np.array([vx, vy, vz]), float(np.sqrt(np.mean(np.square(res)))), np.array(res)
def predict_x(v, g, m, w, X0):
    j = m - 1 + g; return (w * X0 - j * v[0]) / (w - j * v[2])
out = {}
for n in range(555, 623):
    q0 = front_quad(n); k = front(n)
    H0 = rect2quad(W, H, q0); wBL = float(H0[2] @ np.array([0, H, 1.0]))
    TL0, BL0 = q0[0], q0[3]
    t = arr(sil[n]['top']); b = arr(sil[n]['bot'])
    st = sorted(steps(t, -1, TL0[0] - 4), reverse=True); sb = sorted(steps(b, +1, BL0[0] - 4), reverse=True)
    fin = np.where(np.isfinite(t))[0]; left = float(fin[0]) if len(fin) and fin[0] > 0 else None
    obs = []
    for i, x in enumerate(st): obs.append(['T', i + 1, x, corner_y(t, st, i), 1.0, TL0[0], TL0[1]])
    for i, x in enumerate(sb): obs.append(['B', i + 1, x, corner_y(b, sb, i), wBL, BL0[0], BL0[1]])
    if left is not None:
        obs.append(['T', len(st) + 1, left, None, 1.0, TL0[0], TL0[1]])
    if len(obs) < 3:
        out[n] = dict(q0=q0.tolist(), v=None, g=1.0, k=k, nobs=len(obs)); print(n, 'too few steps', len(obs)); continue
    gs = [1.0] if n <= 594 else list(np.linspace(0.6, 4.0, 35))
    best = None
    for g in gs:
        o = [list(r) for r in obs]
        for it in range(3):
            v, rms, res = solve(o, g)
            # re-assign indices to the nearest predicted card, drop far outliers
            new = []
            for r in o:
                ms = np.arange(1, k + 1)
                px = np.array([predict_x(v, g, m, r[4], r[5]) for m in ms])
                mi = int(ms[np.argmin(np.abs(px - r[2]))]); r[1] = mi
                if np.min(np.abs(px - r[2])) < 8: new.append(r)
            if len(new) >= 3: o = new
        v, rms, res = solve(o, g)
        if best is None or rms < best[1]: best = (v, rms, g, len(o), o)
    v, rms, g, no, o = best
    out[n] = dict(q0=q0.round(3).tolist(), v=[round(float(x), 5) for x in v], g=round(float(g), 3), k=k, rms=round(rms, 2), nobs=no,
                  steps=[[r[0], r[1], round(r[2], 1)] for r in o])
    print(n, 'v', [round(float(x), 4) for x in v], 'g %.2f' % g, 'rms %.2f' % rms, 'nobs', no, 'm', sorted(set(r[1] for r in o)), flush=True)
json.dump({str(k_): v_ for k_, v_ in out.items()}, open(sys.argv[3], 'w'))
