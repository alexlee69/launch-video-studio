# Our plan chat: per-frame typing / reveal extents, rows positioned off our banner's bottom edge (same method as chatref.py).
import sys, os, json
import numpy as np
from PIL import Image
d = sys.argv[1]; E = {r['n']: r for r in json.load(open(sys.argv[2]))}
# our layout (scenes/w5-fan.js chatBlock): block top = bot + 48; head baseline +76, sub baseline +122, doc card +150..+240, avatar centre (114, +24)
rows = {'icon': (0, 52, 80, 148), 'name': (2, 26, 150, 420), 'head': (50, 88, 150, 700), 'sub': (104, 132, 150, 700), 'doc': (150, 240, 150, 712)}
rows = {k: (v[0] + 48, v[1] + 48, v[2], v[3]) for k, v in rows.items()}
out = []
for n in range(1137, 1207):
    if n not in E or E[n]['bot'] is None: continue
    L = np.asarray(Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')).astype(float)
    b = E[n]['bot']; r = dict(n=n, bot=b)
    bg = float(np.median(L[560:600, 900:1060]))
    for k, (o0, o1, x0, x1) in rows.items():
        y0 = int(round(b + o0)); y1 = int(round(b + o1))
        if y1 > 608 or y0 < 0: r[k] = None; continue
        C = np.clip(bg - 1 - L[y0:y1, x0:x1], 0, None); C[C < 12] = 0
        col = C.sum(axis=0); xs = np.nonzero(col > 30)[0]
        r[k] = dict(mass=round(float(C.sum())), xr=int(xs[-1] + x0) if len(xs) else None, xl=int(xs[0] + x0) if len(xs) else None)
    out.append(r)
    print(n, round(b, 1), '  '.join('%s:%s/%s' % (k, (r[k] or {}).get('mass'), (r[k] or {}).get('xr')) for k in rows))
json.dump(out, open(sys.argv[3], 'w'))
