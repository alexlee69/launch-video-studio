# Reference build chat: vertical offset for the entrance frames by matching the head's left part ("Buil...") against n1240,
# then per-row ink / typing extents relative to the tracked offset.
import sys, os, json, math
import numpy as np
from PIL import Image
d = sys.argv[1]; trk = {r['n']: r for r in json.load(open(sys.argv[2]))}
def L(n): return np.asarray(Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')).astype(float)
K = L(1240); tmpl = np.clip(244 - K[236:280, 176:260], 0, None)   # "Bui" at key
def find_ty(n, lo=-40, hi=420):
    F = np.clip(244 - L(n), 0, None); best = None
    for ty in range(lo, hi):
        y0 = 236 + ty
        if y0 < 0 or y0 + 44 > 608: continue
        P = F[y0:y0 + 44, 176:260]
        num = (P * tmpl).sum(); den = math.sqrt((P * P).sum() * (tmpl * tmpl).sum()) + 1e-9
        v = num / den
        if best is None or v > best[1]: best = (ty, v)
    return best
rows = {'avatar': (190, 248, 86, 148), 'name': (193, 216, 170, 340), 'head': (236, 280, 170, 640), 'l1': (298, 328, 170, 520), 'l2': (346, 375, 170, 700)}
out = []
for n in range(1208, 1260):
    if n in trk and n >= 1212: ty = trk[n]['ty']; src = 'trk'
    else:
        t, v = find_ty(n); ty = t; src = 'ncc%.2f' % v
    F = L(n); r = dict(n=n, ty=round(ty, 2), src=src)
    for k, (y0, y1, x0, x1) in rows.items():
        a = int(round(y0 + ty)); b = int(round(y1 + ty))
        if a < 0 or b > 608: r[k] = None; continue
        C = np.clip(244 - F[a:b, x0:x1], 0, None); C[C < 10] = 0
        col = C.sum(axis=0); xs = np.nonzero(col > 25)[0]
        r[k] = dict(mass=round(float(C.sum())), xr=int(xs[-1] + x0) if len(xs) else None)
    out.append(r)
    print(n, r['ty'], src, '  '.join('%s:%s/%s' % (k, (r[k] or {}).get('mass'), (r[k] or {}).get('xr')) for k in rows))
json.dump(out, open(sys.argv[3], 'w'))
