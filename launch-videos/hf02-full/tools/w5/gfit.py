# Card spacing g per frame with the front-card pose held fixed (from a pose log): 1-D edge-energy search.
# usage: gfit.py <absdir> <pose.json[,pose2.json...]> <first> <last> <out.json> [--N 12] [--P 2060] [--overlay dir]
import sys, os, json
import numpy as np
here = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, here)
arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
D, PJ, A, B, OUT = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
N = int(arg('--N', 12)); P = float(arg('--P', 2060)); ovl = arg('--overlay')
pose = {}
for f in PJ.split(','):
    for r in json.load(open(f)): pose[r['n']] = r
src = open(os.path.join(here, 'fanfit.py')).read().split('steps = [float')[0]
saved = sys.argv
sys.argv = ['x', D, '0', '0', '/dev/null', '--init', '0,0,0,0,0,0,0,%g' % P, '--N', str(N)]
g = {'__file__': os.path.join(here, 'fanfit.py')}; exec(src, g); sys.argv = saved
res = []
for n in range(A, B + 1):
    if n not in pose: continue
    r = pose[n]; base = [r['X'], r['Y'], r['Z'], r['ax'], r['ay'], r['az']]
    gx, gy = g['grads'](g['load'](n))
    E = lambda gg: g['energy'](np.array(base + [gg, P]), gx, gy)[0]
    cand = np.arange(0, 320, 8.0); vals = [E(c) for c in cand]; c0 = cand[int(np.argmax(vals))]
    lo, hi = max(0, c0 - 8), c0 + 8
    for _ in range(24):
        m1 = lo + (hi - lo) / 3; m2 = hi - (hi - lo) / 3
        if E(m1) > E(m2): hi = m2
        else: lo = m1
    gg = (lo + hi) / 2; e = E(gg)
    out = dict(n=n, g=round(gg, 2), E=round(e, 3), E0=round(E(0.0), 3)); res.append(out); print(json.dumps(out), flush=True)
    if ovl:
        os.makedirs(ovl, exist_ok=True); g['draw'](n, np.array(base + [gg, P]), os.path.join(ovl, 'g%04d.png' % n))
json.dump(res, open(OUT, 'w'), indent=0)
