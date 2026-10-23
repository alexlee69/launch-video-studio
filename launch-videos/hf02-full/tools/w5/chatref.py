# Reference plan chat: per-frame ink of each row, positioned relative to the banner's bottom edge (edges log).
import sys, os, json
import numpy as np
from PIL import Image
d = sys.argv[1]; E = {r['n']: r for r in json.load(open(sys.argv[2]))}
rows = {'icon': (54, 102, 85, 150), 'name': (55, 76, 170, 400), 'head': (100, 142, 170, 700), 'sub': (160, 190, 170, 700), 'doc': (205, 316, 170, 1005)}
out = []
for n in range(1137, 1207):
    L = np.asarray(Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')).astype(float)
    b = E[n]['bot']; r = dict(n=n, bot=b)
    for k, (o0, o1, x0, x1) in rows.items():
        y0 = int(round(b + o0)); y1 = int(round(b + o1))
        if y1 > 608 or y0 < 0: r[k] = None; continue
        C = L[y0:y1, x0:x1]; ink = np.clip(244 - C, 0, None); ink[ink < 12] = 0
        col = ink.sum(axis=0); xs = np.nonzero(col > 30)[0]
        r[k] = dict(mass=round(float(ink.sum())), xr=int(xs[-1] + x0) if len(xs) else None, xl=int(xs[0] + x0) if len(xs) else None)
    out.append(r)
    print(n, round(b, 1), '  '.join('%s:%s/%s' % (k, (r[k] or {}).get('mass'), (r[k] or {}).get('xr')) for k in rows))
json.dump(out, open(sys.argv[3], 'w'))
