# Colour-blob landmarks per frame: for each colour class, connected components (run-length union-find, no scipy).
# usage: python3 -E blobs.py <absdir> <first> <last> <out.json> [--scale 1080] [--min 6]
# prints per frame: class: [cx, cy, w, h, area] for components with area >= min (in 1080-wide px)
import sys, os, json
import numpy as np
from PIL import Image
d, a, b, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
MIN = float(sys.argv[sys.argv.index('--min') + 1]) if '--min' in sys.argv else 6
CLS = {  # reference rgb, max distance
    'blue': ((0, 113, 249), 70), 'orange': ((249, 120, 25), 70), 'green': ((0, 183, 80), 70),
    'purple': ((152, 86, 244), 60), 'lime': ((209, 246, 19), 70), 'dark': ((18, 16, 19), 60), 'grey': ((214, 212, 222), 9),
}
if '--ours' in sys.argv:   # our cast (lib/cast.js) and the studio tile; gradients need a wider tolerance
    CLS = {'blue': ((50, 104, 244), 85), 'orange': ((252, 128, 45), 75), 'green': ((38, 180, 130), 75), 'purple': ((136, 90, 240), 75),
           'dark': ((36, 36, 42), 45), 'white': ((247, 246, 250), 6)}
if '--cls' in sys.argv:
    keep = sys.argv[sys.argv.index('--cls') + 1].split(',')
    CLS = {k: v for k, v in CLS.items() if k in keep}
def comps(mask):
    H, W = mask.shape
    runs = []; rows = []
    for y in range(H):
        r = mask[y]
        if not r.any(): rows.append([]); continue
        dd = np.diff(np.concatenate([[0], r.view(np.int8), [0]]))
        st = np.where(dd == 1)[0]; en = np.where(dd == -1)[0]
        cur = []
        for s, e in zip(st, en): cur.append(len(runs)); runs.append((y, s, e))
        rows.append(cur)
    par = list(range(len(runs)))
    def f(i):
        while par[i] != i: par[i] = par[par[i]]; i = par[i]
        return i
    for y in range(1, H):
        A = rows[y - 1]; B = rows[y]; i = j = 0
        while i < len(A) and j < len(B):
            _, s1, e1 = runs[A[i]]; _, s2, e2 = runs[B[j]]
            if s1 < e2 and s2 < e1: par[f(A[i])] = f(B[j])
            if e1 < e2: i += 1
            else: j += 1
    g = {}
    for k, (y, s, e) in enumerate(runs):
        r = f(k); n = e - s
        if r not in g: g[r] = [0, 0.0, 0.0, 1e9, -1, 1e9, -1]
        G = g[r]; G[0] += n; G[1] += (s + e - 1) / 2 * n; G[2] += y * n
        G[3] = min(G[3], s); G[4] = max(G[4], e - 1); G[5] = min(G[5], y); G[6] = max(G[6], y)
    res = []
    for G in g.values():
        if G[0] >= MIN:
            res.append([round(float(G[1] / G[0]), 1), round(float(G[2] / G[0]), 1), int(G[4] - G[3] + 1), int(G[6] - G[5] + 1), int(G[0])])
    res.sort(key=lambda r: -r[4])
    return res
allr = {}
for n in range(a, b + 1):
    im = np.asarray(Image.open(os.path.join(d, 'n%04d.png' % n)).convert('RGB')).astype(np.int32)
    if im.shape[1] != 1080:
        im = np.asarray(Image.open(os.path.join(d, 'n%04d.png' % n)).convert('RGB').crop((0, 0, 1920, 1080)).resize((1080, 608), Image.LANCZOS)).astype(np.int32)
    fr = {}
    for k, (c, t) in CLS.items():
        dist = np.sqrt(((im - np.array(c)) ** 2).sum(axis=2))
        fr[k] = comps(dist < t)[:8]
    allr[n] = fr
    print(n, json.dumps({k: v[:4] for k, v in fr.items()}), flush=True)
json.dump(allr, open(out, 'w'))
