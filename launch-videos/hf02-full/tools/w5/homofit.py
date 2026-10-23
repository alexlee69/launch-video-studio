# Front-card pose by direct image alignment: the card content in a flat key frame (known scale/centre) is warped by the
# CSS 3D pose (X,Y,Z,ax,ay,az; perspective P) and matched (NCC) to each frame, with an isotropic blur level.
# usage: homofit.py <absdir> <key_n> <key_s> <key_cx> <key_cy> <first> <last> <out.json> --init "X,Y,Z,ax,ay,az" [--P 2060]
#        [--mask x0,y0,x1,y1;...] (screen boxes to ignore, e.g. a watermark) [--inner 0.97]
import sys, os, json, math
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fan import rot, CX, CY
from nm import nm
arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
D = sys.argv[1]; KN = int(sys.argv[2]); KS = float(sys.argv[3]); KCX = float(sys.argv[4]); KCY = float(sys.argv[5])
A, B, OUT = int(sys.argv[6]), int(sys.argv[7]), sys.argv[8]
P = float(arg('--P', 2060)); inner = float(arg('--inner', 0.97))
masks = [[float(v) for v in m.split(',')] for m in arg('--mask', '').split(';') if m]
def load(n):
    im = Image.open(os.path.join(D, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = im.crop((0, 0, im.width, round(im.width * 608 / 1080))).resize((1080, 608), Image.LANCZOS)
    return np.asarray(im, dtype=np.float64)
def gblur(a, s):
    if s < 0.2: return a
    p = int(3 * s) + 4; b = np.pad(a, p, mode='edge'); h, w = b.shape
    fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.rfftfreq(w)[None, :]
    return np.fft.irfft2(np.fft.rfft2(b) * np.exp(-2 * math.pi ** 2 * s * s * (fx ** 2 + fy ** 2)), s=b.shape)[p:-p, p:-p]
def bil(img, x, y):
    h, w = img.shape; ok = (x >= 0) & (x <= w - 1.001) & (y >= 0) & (y <= h - 1.001)
    x = np.clip(x, 0, w - 1.001); y = np.clip(y, 0, h - 1.001)
    xi = np.floor(x).astype(int); yi = np.floor(y).astype(int); dx = x - xi; dy = y - yi
    return img[yi, xi] * (1 - dx) * (1 - dy) + img[yi, xi + 1] * dx * (1 - dy) + img[yi + 1, xi] * (1 - dx) * dy + img[yi + 1, xi + 1] * dx * dy, ok
KEY = load(KN)
SIG = [0, 1, 2, 3, 4.5, 6, 8, 11, 15, 20, 26]
KB = {s: gblur(KEY, s) for s in SIG}
U, V = np.meshgrid(np.linspace(-540 * inner, 540 * inner, 150), np.linspace(-304 * inner, 304 * inner, 86))
U = U.ravel(); V = V.ravel(); LOC = np.stack([U, V, np.zeros_like(U)], axis=1)
def masked(x, y):
    m = np.zeros_like(x, bool)
    for x0, y0, x1, y1 in masks: m |= (x >= x0) & (x <= x1) & (y >= y0) & (y <= y1)
    return m
tx = KCX + KS * U; ty = KCY + KS * V
def proj(p):
    X, Y, Z, ax, ay, az = p
    q = LOC @ rot(ax, ay, az).T + np.array([X, Y, Z]); w = 1 - q[:, 2] / P
    return CX + q[:, 0] / w, CY + q[:, 1] / w, w
def score(p, F, s):
    fx, fy, w = proj(p)
    if (w < 0.05).any(): return 1.0
    a, oka = bil(F, fx, fy); b, okb = bil(KB[s], tx, ty)
    ok = oka & okb & ~masked(fx, fy) & ~masked(tx, ty)
    if ok.sum() < 200: return 1.0
    a = a[ok] - a[ok].mean(); b = b[ok] - b[ok].mean()
    return -float((a * b).sum() / (math.sqrt((a * a).sum() * (b * b).sum()) + 1e-9))
prev = np.array([float(v) for v in arg('--init').split(',')]); sprev = SIG.index(min(SIG, key=lambda s: abs(s - float(arg('--sig', 0)))))
res = []; pprev = None
for n in (range(A, B + 1) if B >= A else range(A, B - 1, -1)):
    F = load(n); best = None
    if '--predict' in sys.argv and pprev is not None:      # constant-velocity start (fast rotations between frames)
        start = prev + (prev - pprev); prev_keep = prev.copy()
        if score(start, F, SIG[sprev]) < score(prev, F, SIG[sprev]): prev = start
    else: prev_keep = prev.copy()
    for si in sorted(set([max(0, sprev - 1), sprev, min(len(SIG) - 1, sprev + 1)])):
        s = SIG[si]
        f = lambda p: score(p, F, s)
        p, v = nm(f, prev, [8, 8, 60, 1.0, 1.5, 0.8], 500)
        p, v = nm(f, p, [2, 2, 15, 0.3, 0.4, 0.2], 300)
        if best is None or v < best[1]: best = (p, v, si)
    p, v, si = best
    # widen the blur search if at the edge of the bracket
    if si in (sprev - 1, sprev + 1):
        si2 = si + (si - sprev)
        if 0 <= si2 < len(SIG):
            s = SIG[si2]; f = lambda q: score(q, F, s)
            q, v2 = nm(f, p, [2, 2, 15, 0.3, 0.4, 0.2], 300)
            if v2 < v: p, v, si = q, v2, si2
    sprev = si; pprev = prev_keep; prev = p
    fx, fy, w = proj(p)
    r = dict(n=n, X=round(p[0], 2), Y=round(p[1], 2), Z=round(p[2], 1), ax=round(p[3], 3), ay=round(p[4], 3), az=round(p[5], 3), sig=SIG[si], ncc=round(-v, 4),
             left=round(float(fx.min()), 1), right=round(float(fx.max()), 1), top=round(float(fy.min()), 1), bot=round(float(fy.max()), 1))
    res.append(r); print(json.dumps(r), flush=True)
json.dump(res, open(OUT, 'w'), indent=0)
