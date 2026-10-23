# Stack offset per card (dx, dy in-plane, g along the normal) with the front-card pose held fixed (pose log).
# usage: gfit2.py <absdir> <pose.json[,..]> <n1,n2,..> <out.json> [--init g,dx,dy] [--overlay dir]
import sys, os, json
import numpy as np
here = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, here)
from nm import nm
arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
D, PJ, NS, OUT = sys.argv[1], sys.argv[2], [int(v) for v in sys.argv[3].split(',') if v.strip()], sys.argv[4]
P = float(arg('--P', 2060)); ovl = arg('--overlay'); init = [float(v) for v in arg('--init', '200,0,0,0').split(',')]
pose = {}
for f in PJ.split(','):
    for r in json.load(open(f)): pose[r['n']] = r
src = open(os.path.join(here, 'fanfit.py')).read().split('steps = [float')[0]
saved = sys.argv; sys.argv = ['x', D, '0', '0', '/dev/null', '--init', '0,0,0,0,0,0,0,%g' % P, '--N', arg('--N', '11')]
g = {'__file__': os.path.join(here, 'fanfit.py')}; exec(src, g); sys.argv = saved
res = []; prev = np.array(init)
for n in NS:
    r = pose[n]; base = [r['X'], r['Y'], r['Z'], r['ax'], r['ay'], r['az']]
    gx, gy = g['grads'](g['load'](n))
    E = lambda q: (1e3 if (q[0] < 90 and '--only-g' not in sys.argv) else -g['energy'](np.array(base + [q[0], P, q[1], q[2], q[3]]), gx, gy)[0])
    best = None
    if '--only-g' in sys.argv:
        lo_, hi_ = float(arg('--gmin', 100)), float(arg('--gmax', 320))
        if '--track' in sys.argv: lo_, hi_ = max(0.0, prev[0] - 40), prev[0] + 40
        cand = np.arange(lo_, hi_, 2.0); vals = [E(np.array([c, 0, 0, 0])) for c in cand]; c0 = cand[int(np.argmin(vals))]
        a_, b_ = max(lo_, c0 - 4), min(hi_, c0 + 4)
        for _ in range(24):
            m1 = a_ + (b_ - a_) / 3; m2 = b_ - (b_ - a_) / 3
            if E(np.array([m1, 0, 0, 0])) < E(np.array([m2, 0, 0, 0])): b_ = m2
            else: a_ = m1
        q = np.array([(a_ + b_) / 2, 0, 0, 0]); best = (q, E(q))
    else:
      for st in (prev, np.array([200.0, 0, 0, 0]), np.array([200.0, 0, 0, 2.0]), np.array([200.0, 0, 0, -2.0])):
        q, v = nm(E, st, [30, 30, 15, 1.5], 400); q, v = nm(E, q, [6, 6, 3, 0.3], 250)
        if best is None or v < best[1]: best = (q, v)
    q, v = best; prev = q
    out = dict(n=n, g=round(q[0], 2), dx=round(q[1], 2), dy=round(q[2], 2), dth=round(q[3], 3), E=round(-v, 3)); res.append(out); print(json.dumps(out), flush=True)
    if ovl:
        os.makedirs(ovl, exist_ok=True); g['draw'](n, np.array(base + [q[0], P, q[1], q[2], q[3]]), os.path.join(ovl, 'h%04d.png' % n))
json.dump(res, open(OUT, 'w'), indent=0)
