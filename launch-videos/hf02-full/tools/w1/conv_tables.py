# Converge (n45..n76) tables per character slot in camera-free coordinates: progress u(n) along rest→target, scale k(n) vs rest.
import json
L = {}
for line in open('logs/blobs_open.log'):
    n, js = line.split(' ', 1); L[int(n)] = json.loads(js)
T1 = {r['n']: r for r in (json.loads(l) for l in open('logs/T1_push.log'))}
O = (546.0, 300.0)
def cam_s(n): return T1[n]['s'] if n in T1 else 1.0 + 0.00038 * (n - 45)
def follow(cls, seed, a, b, rad):
    px, py = seed; out = {}
    for n in range(a, b + 1):
        best = None
        for c in L[n][cls]:
            dd = ((c[0] - px) ** 2 + (c[1] - py) ** 2) ** .5
            if dd < rad and c[4] >= 6 and (best is None or dd < best[0]): best = (dd, c)
        if best: out[n] = best[1]; px, py = best[1][0], best[1][1]
    return out
slots = {'green': ('green', (905.5, 503)), 'orange': ('orange', (172, 123.3)), 'purple': ('purple', (562.4, 472.7)),
         'blue': ('blue', (522, 130)), 'tri': ('dark', (124.3, 499.8))}
res = {}
for k, (cls, seed) in slots.items():
    tr = follow(cls, seed, 45, 76, 130)
    own = {}
    for n, c in tr.items():
        s = cam_s(n)
        own[n] = (O[0] + (c[0] - O[0]) / s, O[1] + (c[1] - O[1]) / s, c[2] / s)
    ns = sorted(own); P0 = own[45]; Tn = ns[-1]; T = own[Tn]
    dx, dy = T[0] - P0[0], T[1] - P0[1]; L2 = dx * dx + dy * dy
    u = {n: round(((own[n][0] - P0[0]) * dx + (own[n][1] - P0[1]) * dy) / L2, 4) for n in ns}
    sc = {n: round(own[n][2] / P0[2], 3) for n in ns}
    res[k] = dict(rest=[round(P0[0], 1), round(P0[1], 1)], target=[round(T[0], 1), round(T[1], 1)], last=Tn, u=u, k=sc)
    print(k, 'rest', res[k]['rest'], 'target', res[k]['target'], 'last', Tn)
    print('  u', ' '.join('%d:%.3f' % (n, u[n]) for n in ns if n >= 48))
    print('  k', ' '.join('%d:%.2f' % (n, sc[n]) for n in ns if n >= 58))
json.dump(res, open('logs/conv_tables.json', 'w'))
