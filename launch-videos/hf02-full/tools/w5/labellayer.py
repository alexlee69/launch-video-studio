# The labels ride one 2D layer: fit per-frame translation + uniform scale (about the frame centre) from every label that
# is fully popped in on both frames, chained frame to frame, anchored at n0. Prints and writes {n: [tx, ty, S]}.
import json, sys, math
import numpy as np
L = sys.argv[1]; out = sys.argv[2]
T = {'launch': (1027, 1065), 'brief': (1029, 1085), 'screens': (1032, 1075), 'brand': (1036, 1098), 'apps': (1043, 1112), 'ux': (1056, 1119), 'core': (1062, 1125)}
D = {}
for k in T:
    D[k] = {r['n']: r for r in json.load(open('%s/lt_%s.json' % (L, k)))[k]}
def steady(k, n): a, b = T[k]; return n - a >= 9 and b - n >= 10 and n in D[k]
C = np.array([540.0, 304.0])
n0 = 1060; res = {n0: (0.0, 0.0, 1.0)}
def step(n, m):
    ks = [k for k in T if steady(k, n) and steady(k, m)]
    if not ks: return None
    r = np.mean([D[k][m]['s'] / D[k][n]['s'] for k in ks])
    # p_m = C + r (p_n - C) + t  → t = mean(p_m - C - r (p_n - C))
    t = np.mean([np.array([D[k][m]['cx'], D[k][m]['cy']]) - C - r * (np.array([D[k][n]['cx'], D[k][n]['cy']]) - C) for k in ks], axis=0)
    resid = max(np.hypot(*(np.array([D[k][m]['cx'], D[k][m]['cy']]) - C - r * (np.array([D[k][n]['cx'], D[k][n]['cy']]) - C) - t)) for k in ks)
    return r, t, len(ks), resid
# compose: layer(n) maps layout(n0) → frame: p = C + S (q - C) + tvec
lay = {n0: (1.0, np.zeros(2))}
for n in range(n0, 1124):
    st = step(n, n + 1); S, t = lay[n]
    if st is None: lay[n + 1] = (S, t); continue
    r, tt, cnt, res_ = st
    lay[n + 1] = (S * r, r * t + tt)
for n in range(n0, 1028, -1):
    st = step(n - 1, n); S, t = lay[n]
    if st is None: lay[n - 1] = (S, t); continue
    r, tt, cnt, res_ = st                     # p_n = C + r (p_{n-1} - C) + tt  → invert
    lay[n - 1] = (S / r, (t - tt) / r)
rows = {}
for n in sorted(lay):
    S, t = lay[n]; rows[n] = [round(float(t[0]), 3), round(float(t[1]), 3), round(float(S), 5)]
for n in sorted(rows):
    st = step(n, n + 1)
    print(n, rows[n], '' if st is None else 'k=%d resid=%.2f' % (st[2], st[3]))
json.dump(rows, open(out, 'w'))
