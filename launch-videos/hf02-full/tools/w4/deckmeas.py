# Direct per-frame measurement of the deck's FRONT card (n555-622) from the silhouette profiles:
#   right edge = quad.py R line; top/bottom = robust lines on the 230 px left of the right edge;
#   left edge = where the profile (scanning left) leaves the front card's line for good (top and bottom separately).
# Also lists the staircase steps left of the front card (the cards behind).
# usage: deckmeas.py <sil.jsonl> <quad.json> <out.json> [first last]
import sys, json
import numpy as np
sil = {}
for l in open(sys.argv[1]):
    r = json.loads(l); sil[r['n']] = r
Q = {r['n']: r for r in json.load(open(sys.argv[2]))}
a, b = (int(sys.argv[4]), int(sys.argv[5])) if len(sys.argv) > 5 else (555, 622)
def arr(v): return np.array([np.nan if x is None else x for x in v])
def robust(xs, ys):
    ok = np.isfinite(ys) & (ys > 1) & (ys < 606); xs, ys = xs[ok], ys[ok]
    if len(xs) < 8: return None
    c = np.polyfit(xs, ys, 1)
    for _ in range(4):
        r = np.abs(ys - np.polyval(c, xs)); keep = r < max(0.8, 2.0 * np.median(r))
        if keep.sum() < 8: break
        c = np.polyfit(xs[keep], ys[keep], 1)
    return c
def leave(p, c, x_start, tol=2.5, run=6):
    # scan left from x_start; return the x where |p - line| > tol for `run` consecutive columns (the front card's left edge)
    cnt = 0
    for x in range(int(x_start), -1, -1):
        y = p[x]
        bad = (not np.isfinite(y)) or abs(y - np.polyval(c, x)) > tol
        if bad and np.isfinite(y) and (y <= 1 or y >= 606): bad = False      # clipped by the frame edge: unknown, keep going
        cnt = cnt + 1 if bad else 0
        if cnt >= run: return x + run - 0.5
    return None
def steps(p, sign, xmax, thr=2.5):
    out = []
    for x in range(1, int(min(xmax, 1079))):
        if np.isfinite(p[x]) and np.isfinite(p[x - 1]) and sign * (p[x] - p[x - 1]) > thr:
            if out and x - out[-1][1] <= 3: out[-1][1] = x; out[-1][2] += sign * (p[x] - p[x - 1])
            else: out.append([x, x, sign * (p[x] - p[x - 1])])
    return [(s[0], round(s[2], 1)) for s in out]
res = {}
for n in range(a, b + 1):
    t = arr(sil[n]['top']); bo = arr(sil[n]['bot']); R = Q[n]['R']
    xr = R[0] + R[1] * 300
    xs = np.arange(int(xr - 240), int(xr - 18))
    xs = xs[(xs >= 0) & (xs < 1080)]
    ct = robust(xs.astype(float), t[xs]); cb = robust(xs.astype(float), bo[xs])
    xlt = leave(t, ct, xr - 240) if ct is not None else None
    xlb = leave(bo, cb, xr - 240) if cb is not None else None
    def corner_r(c):
        if c is None: return None
        # intersect y = c0 x + c1 with x = R0 + R1 y
        y = (c[0] * R[0] + c[1]) / (1 - c[0] * R[1]); return [R[0] + R[1] * y, y]
    def corner_l(c, x):
        if c is None or x is None: return None
        return [x, float(np.polyval(c, x))]
    r = dict(n=n, TL=corner_l(ct, xlt), TR=corner_r(ct), BR=corner_r(cb), BL=corner_l(cb, xlb),
             ct=None if ct is None else list(ct), cb=None if cb is None else list(cb),
             st=steps(t, -1, (xlt or xr) - 3), sb=steps(bo, +1, (xlb or xr) - 3))
    res[n] = r
    f = lambda p: None if p is None else [round(p[0], 1), round(p[1], 1)]
    print(n, 'TL', f(r['TL']), 'TR', f(r['TR']), 'BR', f(r['BR']), 'BL', f(r['BL']), '| T', r['st'][-6:], 'B', r['sb'][-6:])
json.dump({str(k): v for k, v in res.items()}, open(sys.argv[3], 'w'))
