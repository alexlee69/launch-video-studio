# Follow each character blob through the corridor (backwards from n94) using the blobs log; prints cx, cy, w, h, area
import json, sys
L = {}
for line in open(sys.argv[1]):
    n, js = line.split(' ', 1); L[int(n)] = json.loads(js)
seeds = {'blue': (325, 379), 'orange': (625, 357), 'green': (511, 157), 'purple': (498, 514), 'dark': (817, 276), 'grey': (300, 152)}
a, b = int(sys.argv[2]), int(sys.argv[3])
res = {k: {} for k in seeds}
for k, (x, y) in seeds.items():
    px, py = x, y
    for n in range(b, a - 1, -1):
        best = None
        for c in L[n].get(k, []):
            dd = ((c[0] - px) ** 2 + (c[1] - py) ** 2) ** .5
            if dd < 90 and c[4] > 15 and (best is None or dd < best[0]): best = (dd, c)
        if best:
            c = best[1]; res[k][n] = c; px, py = c[0], c[1]
print('n   ' + ''.join('%-22s' % k for k in seeds))
for n in range(a, b + 1):
    print('%3d ' % n + ''.join('%-22s' % ('' if n not in res[k] else '%5.0f %5.0f %3d %3d' % tuple(res[k][n][:4])) for k in seeds))
json.dump(res, open(sys.argv[4], 'w'))
