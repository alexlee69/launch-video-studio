# Track one character through frames by scale+position template NCC (template cut from a clean frame), greyscale + colour.
# usage: tmpl.py <dir> <key n> <cx,cy,size> <first> <last> [--init cx,cy,size]
import sys, os, json, math
import numpy as np
from PIL import Image
d = sys.argv[1]; key = int(sys.argv[2]); kx, ky, ks = [float(v) for v in sys.argv[3].split(',')]; a, b = int(sys.argv[4]), int(sys.argv[5])
def load(n): return np.asarray(Image.open(os.path.join(d, 'n%04d.png' % n)).convert('RGB'), dtype=np.float64)
K = load(key); half = ks * 0.62
T = K[int(ky - half):int(ky + half), int(kx - half):int(kx + half)]
Th, Tw = T.shape[:2]
def score(F, cx, cy, s):
    # resample template to scale s and compare with the frame window
    w = max(6, int(round(Tw * s))); h = max(6, int(round(Th * s)))
    x0 = int(round(cx - w / 2)); y0 = int(round(cy - h / 2))
    if x0 < 0 or y0 < 0 or x0 + w > F.shape[1] or y0 + h > F.shape[0]: return -1
    Ti = np.asarray(Image.fromarray(T.astype(np.uint8)).resize((w, h), Image.BILINEAR), dtype=np.float64)
    W = F[y0:y0 + h, x0:x0 + w]
    A = Ti - Ti.mean(); B = W - W.mean()
    return float((A * B).sum() / (math.sqrt((A * A).sum() * (B * B).sum()) + 1e-9))
cur = None
order = list(range(key, b + 1)) + list(range(key - 1, a - 1, -1))
res = {}
for n in order:
    if n == key + 1 or n == key - 1 or cur is None: cur = (kx, ky, 1.0) if n in (key, key + 1, key - 1) else cur
    if n < key and (key - 1) in res and n == key - 1: cur = (kx, ky, 1.0)
    F = load(n); best = None
    cx, cy, s = cur
    for ds in np.exp(np.linspace(-0.3, 0.3, 9)):
        for dx in range(-36, 37, 6):
            for dy in range(-36, 37, 6):
                v = score(F, cx + dx, cy + dy, s * ds)
                if best is None or v > best[0]: best = (v, cx + dx, cy + dy, s * ds)
    v, cx, cy, s = best
    for ds in np.exp(np.linspace(-0.08, 0.08, 9)):
        for dx in range(-4, 5, 2):
            for dy in range(-4, 5, 2):
                v2 = score(F, cx + dx, cy + dy, s * ds)
                if v2 > best[0]: best = (v2, cx + dx, cy + dy, s * ds)
    v, cx, cy, s = best; cur = (cx, cy, s); res[n] = (round(cx, 1), round(cy, 1), round(ks * s, 1), round(v, 3))
    print(n, res[n], flush=True)
    if n == b: cur = (kx, ky, 1.0)
