# Converge (n45-75) and corridor crew (n76-96): reference vs ours from the blob logs (+ camera from T1/O1 to go camera-free).
import json, math
def load(p):
    L = {}
    for line in open(p):
        n, js = line.split(' ', 1); L[int(n)] = json.loads(js)
    return L
R, O = load('logs/blobs_open.log'), load('logs/blobs_ours_open.log')
cam = lambda f: {r['n']: r['s'] for r in (json.loads(l) for l in open(f) if l.startswith('{'))}
CR, CO = cam('logs/T1_push.log'), cam('logs/O1_push.log')
def follow(L, cls, seed, a, b, rad):
    px, py = seed; out = {}
    for n in range(a, b + 1):
        best = None
        for c in L.get(n, {}).get(cls, []):
            dd = math.hypot(c[0] - px, c[1] - py)
            if dd < rad and c[4] >= 6 and (best is None or dd < best[0]): best = (dd, c)
        if best: out[n] = best[1]; px, py = best[1][0], best[1][1]
    return out
def own(tr, C):
    o = {}
    for n, c in tr.items():
        s = C.get(n, 1 + 0.00038 * (n - 45)); o[n] = (546 + (c[0] - 546) / s, 300 + (c[1] - 300) / s, c[2] / s)
    return o
S = {'green': (('green', (905, 503)), ('green', (842, 492))), 'orange': (('orange', (172, 123)), ('orange', (338, 98))),
     'purple': (('purple', (562, 473)), ('purple', (262, 496))), 'tri': (('dark', (124, 500)), ('dark', (92, 302)))}
print('## converge: progress along rest->end (camera-free), peak speed frame and peak speed in path-lengths/frame')
for k, ((rc, rs), (oc, os_)) in S.items():
    rows = []
    for L, (cls, seed), C in ((R, (rc, rs), CR), (O, (oc, os_), CO)):
        tr = own(follow(L, cls, seed, 45, 72, 140), C)
        ns = sorted(tr); P0 = tr[45]; T = tr[ns[-1]]
        D = math.hypot(T[0] - P0[0], T[1] - P0[1])
        u = {n: ((tr[n][0] - P0[0]) * (T[0] - P0[0]) + (tr[n][1] - P0[1]) * (T[1] - P0[1])) / D / D for n in ns}
        v = {n + 0.5: u[n + 1] - u[n] for n in ns if n + 1 in u}
        pk = max(v, key=v.get)
        rows.append((u, v, pk, D, ns[-1]))
    (ur, vr, pr, Dr, er), (uo, vo, po, Do, eo) = rows
    print('%-7s peak ref n%.1f (%.3f/f = %.0f px/f) ours n%.1f (%.3f/f = %.0f px/f) | last seen ref n%d ours n%d' % (k, pr, vr[pr], vr[pr] * Dr, po, vo[po], vo[po] * Do, er, eo))
    print('   u ref ', ' '.join('%d:%.2f' % (n, ur[n]) for n in range(56, 72) if n in ur))
    print('   u ours', ' '.join('%d:%.2f' % (n, uo[n]) for n in range(56, 72) if n in uo))
