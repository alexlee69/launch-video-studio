# Per-frame fit of the CSS 3D fan model to a frame's edges (occlusion-aware edge energy), vectorized.
# usage: fanfit.py <absdir> <first> <last> <out.json> --init "X,Y,Z,ax,ay,az,g[,P]" --N 11 [--fix 7] [--overlay dir]
# params: X Y Z ax ay az g P  (P = CSS perspective; fix it with --fix 7 after it is known)
import sys, os, json, math
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fan import rot, LOCAL, CX, CY
from nm import nm
arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
D, A, B, OUT = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
N = int(arg('--N', 11)); K = 40
init = [float(v) for v in arg('--init').split(',')]
if len(init) == 7: init.append(float(arg('--P', 2400)))
ovl = arg('--overlay')
def load(n):
    im = Image.open(os.path.join(D, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = im.crop((0, 0, im.width, round(im.width * 608 / 1080))).resize((1080, 608), Image.LANCZOS)
    return np.asarray(im, dtype=np.float64)
def gsmooth(a, s):
    h, w = a.shape; fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.rfftfreq(w)[None, :]
    return np.fft.irfft2(np.fft.rfft2(a) * np.exp(-2 * math.pi ** 2 * s * s * (fx ** 2 + fy ** 2)), s=a.shape)
def grads(L):
    S = gsmooth(np.pad(L, 16, mode='edge'), 1.2)[16:-16, 16:-16]; gy, gx = np.gradient(S); return gx, gy
def bil(img, x, y):
    h, w = img.shape; x = np.clip(x, 0, w - 1.001); y = np.clip(y, 0, h - 1.001)
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int); dx = x - x0; dy = y - y0
    return (img[y0, x0] * (1 - dx) * (1 - dy) + img[y0, x0 + 1] * dx * (1 - dy) + img[y0 + 1, x0] * (1 - dx) * dy + img[y0 + 1, x0 + 1] * dx * dy)
T = np.linspace(0.03, 0.97, K)
def quads(p):
    X, Y, Z, ax, ay, az, g, P = p[:8]
    dx, dy = (p[8], p[9]) if len(p) > 9 else (0.0, 0.0)
    dth = p[10] if len(p) > 10 else 0.0
    R = rot(ax, ay, az); out = []
    if dth:
        loc = np.concatenate([LOCAL @ rot(0, i * dth, 0).T + np.array([i * dx, i * dy, -i * g]) for i in range(N)])
    else:
        loc = np.concatenate([LOCAL + np.array([i * dx, i * dy, -i * g]) for i in range(N)])
    q = loc @ R.T + np.array([X, Y, Z]); w = 1 - q[:, 2] / P
    if (w <= 0.05).any(): return None
    xy = np.stack([CX + q[:, 0] / w, CY + q[:, 1] / w], axis=1)
    return xy.reshape(N, 4, 2)
def energy(p, gx, gy):
    Q = quads(p)
    if Q is None: return 0.0, 0
    A_ = Q; B_ = np.roll(Q, -1, axis=1)                                  # N,4,2 edge endpoints
    pts = A_[:, :, None, :] + (B_ - A_)[:, :, None, :] * T[None, None, :, None]   # N,4,K,2
    x = pts[..., 0]; y = pts[..., 1]
    vis = (x > 2) & (x < 1077) & (y > 2) & (y < 605)
    cen = Q.mean(axis=1)
    for j in range(N - 1):
        # points of cards behind j (i > j) inside quad j (grown 1.5 px) are hidden
        ins = np.ones(x[j + 1:].shape, bool)
        for k in range(4):
            a = Q[j, k]; b = Q[j, (k + 1) % 4]; e = b - a; nrm = np.array([e[1], -e[0]]) / (np.hypot(*e) + 1e-9)
            if np.dot(cen[j] - a, nrm) < 0: nrm = -nrm
            ins &= ((x[j + 1:] - a[0]) * nrm[0] + (y[j + 1:] - a[1]) * nrm[1]) > -1.5
        vis[j + 1:] &= ~ins
    e = B_ - A_; L = np.hypot(e[..., 0], e[..., 1]) + 1e-9
    nx = (e[..., 1] / L)[:, :, None]; ny = (-e[..., 0] / L)[:, :, None]
    v = np.abs(bil(gx, x, y) * nx + bil(gy, x, y) * ny)
    tot = (v * vis).sum(); cnt = vis.sum()
    return tot / (cnt + 0.15 * N * 4 * K), int(cnt)
def draw(n, p, path):
    im = Image.open(os.path.join(D, 'n%04d.png' % n)).convert('RGB')
    if im.width != 1080: im = im.crop((0, 0, im.width, round(im.width * 608 / 1080))).resize((1080, 608), Image.LANCZOS)
    d = ImageDraw.Draw(im); Q = quads(p)
    for i in range(N - 1, -1, -1): d.polygon([tuple(v) for v in Q[i]], outline=(255, 0, 255) if i else (0, 255, 0))
    im.save(path)
steps = [float(v) for v in arg('--steps', '40,30,300,2,2,2,12,300').split(',')]
fixed = [int(v) for v in arg('--fix', '').split(',') if v != '']
res = []; prev = np.array(init, float)
STEP = int(arg('--step', 1))
rng = range(A, B + 1, STEP) if B >= A else range(A, B - 1, -STEP)
for n in rng:
    gx, gy = grads(load(n))
    free = [k for k in range(8) if k not in fixed]
    def f(q):
        p = prev.copy(); p[free] = q; return -energy(p, gx, gy)[0]
    best = None
    for sc in (1.0, 0.35):
        q, v = nm(f, prev[free], [steps[k] * sc for k in free], 450)
        q, v = nm(f, q, [steps[k] * sc * 0.2 for k in free], 250)
        if best is None or v < best[1]: best = (q, v)
    p = prev.copy(); p[free] = best[0]
    e, c = energy(p, gx, gy)
    r = dict(n=n, X=round(p[0], 2), Y=round(p[1], 2), Z=round(p[2], 1), ax=round(p[3], 3), ay=round(p[4], 3), az=round(p[5], 3), g=round(p[6], 2), P=round(p[7], 1), E=round(e, 3), vis=c)
    res.append(r); print(json.dumps(r), flush=True)
    if ovl: os.makedirs(ovl, exist_ok=True); draw(n, p, os.path.join(ovl, 'o%04d.png' % n))
    prev = p
json.dump(res, open(OUT, 'w'), indent=0)
