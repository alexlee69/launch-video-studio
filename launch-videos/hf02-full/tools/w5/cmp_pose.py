# Compare front-card / back-card corner trajectories implied by two pose logs (reference vs ours), same projection model.
# usage: cmp_pose.py <ref.json[,..]> <ours.json[,..]> <first> <last> [--g ref_g.json,.. --gours ours_g.json,..]
import sys, json, os
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fan import card_quad
arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
def loadp(spec):
    d = {}
    for f in spec.split(','):
        for r in json.load(open(f)): d[r['n']] = r
    return d
R = loadp(sys.argv[1]); O = loadp(sys.argv[2]); a, b = int(sys.argv[3]), int(sys.argv[4])
names = ['TL', 'TR', 'BR', 'BL']
rows = []
for n in range(a, b + 1):
    if n not in R or n not in O: continue
    pr = [R[n][k] for k in ('X', 'Y', 'Z', 'ax', 'ay', 'az')] + [0]; po = [O[n][k] for k in ('X', 'Y', 'Z', 'ax', 'ay', 'az')] + [0]
    qr = card_quad(pr, 0, 2060); qo = card_quad(po, 0, 2060)
    rows.append((n, qr, qo, R[n]['ncc'], O[n]['ncc']))
err = np.array([np.hypot(*(r[2] - r[1]).T) for r in rows])     # per frame, per corner
print('front-card corner error (px): mean %.2f  max %.2f  (frames %d-%d)' % (err.mean(), err.max(), a, b))
worst = rows[int(err.max(axis=1).argmax())]; print('  worst frame', worst[0], 'per corner', np.round(err.max(axis=1).max(), 2))
# velocity of each corner: peak frame and speed
for c in range(4):
    vr = np.array([np.hypot(*(rows[i + 1][1][c] - rows[i][1][c])) for i in range(len(rows) - 1)])
    vo = np.array([np.hypot(*(rows[i + 1][2][c] - rows[i][2][c])) for i in range(len(rows) - 1)])
    ir, io = int(vr.argmax()), int(vo.argmax())
    print('  %s speed peak: ref %.1f px/f @%.1f  ours %.1f px/f @%.1f   | median speed ref %.2f ours %.2f' % (names[c], vr[ir], rows[ir][0] + 0.5, vo[io], rows[io][0] + 0.5, np.median(vr), np.median(vo)))
for r, e in zip(rows, err):
    if r[0] % 5 == 0 or e.max() > 3: print('  n%d err %s  ncc %.3f/%.3f' % (r[0], np.round(e, 1).tolist(), r[3], r[4]))
