# Vertical whip measurement: 1-D row-profile correlation of a column band against a vertically blurred key frame.
# usage: vprof.py <absdir> <key> <x0,x1> <n1,n2,...> [--w 1080]
import sys, os, math
import numpy as np
from PIL import Image
d, key = sys.argv[1], int(sys.argv[2]); x0, x1 = [int(v) for v in sys.argv[3].split(',')]
ns = [int(v) for v in sys.argv[4].split(',')]
W = int(sys.argv[sys.argv.index('--w') + 1]) if '--w' in sys.argv else 1080
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != W: im = im.crop((0, 0, im.width, round(im.width * 608 / 1080))).resize((W, round(W * 608 / 1080)), Image.LANCZOS)
    return np.asarray(im, dtype=np.float64)
def prof(g): return np.clip(np.median(g) - g[:, x0:x1], 0, None).sum(axis=1)
K = prof(load(key)); H = len(K)
pad = np.zeros(H * 3); pad[H:2 * H] = K
def gb(p, s):
    if s < 0.05: return p
    r = int(4 * s) + 1; t = np.arange(-r, r + 1); k = np.exp(-t * t / (2 * s * s)); k /= k.sum()
    return np.convolve(p, k, mode='same')
for n in ns:
    P = prof(load(n)); best = None
    for s in np.arange(0, 40.1, 0.5):
        Kb = gb(pad, s)
        for sh in range(-H + 10, H - 10):
            seg = Kb[H - sh:2 * H - sh]
            v = (seg * P).sum() / (math.sqrt((seg * seg).sum() * (P * P).sum()) + 1e-9)
            if best is None or v > best[0]: best = (v, sh, s)
    print(n, 'dy %d  sigma_y %.1f  corr %.4f' % (best[1], best[2], best[0]), flush=True)
