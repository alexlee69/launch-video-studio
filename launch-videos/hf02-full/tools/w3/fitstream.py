# Fit a per-character reveal model to a line's ink curve: char i starts at t0 + i/r and ramps to full over D frames
# with E(u) = 1-(1-u)^k.  usage: fitstream.py N "n:f,n:f,..."   (f = ink fraction of the finished line)
import sys, itertools
import numpy as np
N = int(sys.argv[1]); pts = [(float(a), float(b)) for a, b in (p.split(':') for p in sys.argv[2].split(','))]
ns = np.array([p[0] for p in pts]); fs = np.array([p[1] for p in pts])
def model(t0, r, D, k, n):
    i = np.arange(N)[None, :]; u = np.clip((n[:, None] - t0 - i / r) / D, 0, 1)
    return (1 - (1 - u) ** k).mean(axis=1)
best = None
for r in np.arange(1.5, 12.01, 0.25):
    for D in np.arange(0.5, 24.01, 0.5):
        for k in (1, 1.5, 2, 3, 4):
            # t0 by 1-D search
            for t0 in np.arange(ns.min() - 6, ns.min() + 3, 0.1):
                e = ((model(t0, r, D, k, ns) - fs) ** 2).sum()
                if best is None or e < best[0]: best = (e, t0, r, D, k)
e, t0, r, D, k = best
print('rms %.4f  t0 %.2f  rate %.2f ch/f  D %.1f f  k %.1f  -> last char starts %.2f, done %.2f' % ((e / len(ns)) ** .5, t0, r, D, k, t0 + (N - 1) / r, t0 + (N - 1) / r + D))
for n, f, m in zip(ns, fs, model(t0, r, D, k, ns)): print('  %d %.3f %.3f' % (n, f, m))
