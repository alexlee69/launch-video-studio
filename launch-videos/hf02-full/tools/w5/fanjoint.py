# Joint fit over several frames: shared (ax, ay, az, g) + per-frame (X, Y, Z), perspective fixed. Coordinate descent.
# usage: fanjoint.py <absdir> <out.json> <n1,n2,...> --init "X,Y,Z,ax,ay,az,g" [--P 2060] [--N 12]
import sys, os, json
import numpy as np
sys.argv_saved = list(sys.argv)
here = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, here)
arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
D, OUT, NS = sys.argv[1], sys.argv[2], [int(v) for v in sys.argv[3].split(',')]
P = float(arg('--P', 2060)); N = int(arg('--N', 12)); init = [float(v) for v in arg('--init').split(',')]
# reuse fanfit's energy machinery without running its main loop
src = open(os.path.join(here, 'fanfit.py')).read().split('steps = [float')[0]
sys.argv = ['x', D, '0', '0', '/dev/null', '--init', ','.join(str(v) for v in init + [P]), '--N', str(N)]
g = {}; exec(src, g)
from nm import nm
G = {n: g['grads'](g['load'](n)) for n in NS}
xyz = {n: np.array(init[:3]) for n in NS}; sh = np.array(init[3:7])
def E(n, v3, s4): return g['energy'](np.concatenate([v3, s4, [P]]), *G[n])[0]
for it in range(4):
    for n in NS:
        f = lambda v: -E(n, v, sh)
        v, _ = nm(f, xyz[n], [30, 25, 250], 400); v, _ = nm(f, v, [6, 5, 50], 250); xyz[n] = v
    f = lambda s: -sum(E(n, xyz[n], s) for n in NS) / len(NS)
    s, val = nm(f, sh, [1.5, 1.5, 1.0, 10], 300); s, val = nm(f, s, [0.4, 0.4, 0.3, 3], 200); sh = s
    print('iter', it, 'shared', np.round(sh, 3).tolist(), 'meanE %.3f' % -val, flush=True)
json.dump(dict(shared=sh.tolist(), frames={str(n): xyz[n].tolist() for n in NS}), open(OUT, 'w'))
