# Typing / reveal progress of a chat block in OUR render, rows placed off the block's known top (motion/w5.js chatY or buildTy):
# per row, the right-most inked column → fraction of the row's final width; plus ink mass (opacity ramps).
# usage: chattiming.py <absdir> plan|build <out.json>
import sys, os, json
import numpy as np
from PIL import Image
d, which, out = sys.argv[1], sys.argv[2], sys.argv[3]
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
src = open(os.path.join(ROOT, 'motion', 'w5.js')).read(); M = json.loads(src[src.index('window.MW5 = ') + 13:].rstrip().rstrip(';'))
def trk(tab, n):
    ks = sorted(float(k) for k in tab); vs = [tab[('%g' % k) if ('%g' % k) in tab else str(k)] for k in ks]
    return float(np.interp(n, ks, vs))
rows = {'avatar': (-14, 60, 80, 150), 'name': (-3, 27, 150, 440), 'head': (44, 88, 150, 760), 'l1': (102, 130, 150, 760), 'l2': (144, 172, 150, 760), 'doc': (148, 242, 150, 712)}
rng = range(1135, 1210) if which == 'plan' else range(1209, 1260)
res = []
for n in rng:
    top = trk(M['chatY'], n) if which == 'plan' else 190 + trk(M['buildTy'], n)
    L = np.asarray(Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')).astype(float)
    bg = float(np.median(L[590:606, 900:1070])); r = dict(n=n, top=round(top, 2))
    for k, (o0, o1, x0, x1) in rows.items():
        if which == 'plan' and k == 'l2': continue
        if which == 'build' and k == 'doc': continue
        y0 = int(round(top + o0)); y1 = int(round(top + o1))
        if y0 < 0 or y1 > 608 or y1 <= y0: r[k] = None; continue
        C = np.clip(bg - 1 - L[y0:y1, x0:x1], 0, None); C[C < 12] = 0
        col = C.sum(axis=0); xs = np.nonzero(col > 30)[0]
        r[k] = dict(mass=round(float(C.sum())), xr=int(xs[-1] + x0) if len(xs) else None)
    res.append(r)
json.dump(res, open(out, 'w'))
print('ok', len(res))
