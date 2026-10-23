# Local template tracker (W3): follows one landmark patch through a shot where the global similarity tracker fails
# (elements streaming in, an independently moving avatar).  numpy + PIL only.
# usage: tmpl.py <absdir> <key> <x0,y0,x1,y1> <first> <last> <out.json> [--R 80] [--blur] [--scale 1.0] [--w 1080]
#   frames are resized to width --w (1080 for reference frames, our 1920 renders are downscaled the same way)
#   prints per frame: dx, dy (landmark displacement vs key frame, frame px), bx/by (best extra blur on the template), ncc
import sys, os, json, math
import numpy as np
from PIL import Image
from numpy.lib.stride_tricks import sliding_window_view as swv
d, key = sys.argv[1], int(sys.argv[2])
box = [int(v) for v in sys.argv[3].split(',')]
a, b, out = int(sys.argv[4]), int(sys.argv[5]), sys.argv[6]
opt = lambda k, dv: type(dv)(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else dv
R = opt('--R', 80); W = opt('--w', 1080); doblur = '--blur' in sys.argv
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != W: im = im.crop((0, 0, im.width, round(im.width * 608 / 1080))).resize((W, round(W * 608 / 1080)), Image.LANCZOS)
    return np.asarray(im, dtype=np.float64)
def gblur(img, sx, sy):
    if sx < 0.05 and sy < 0.05: return img
    H, Wd = img.shape; fy = np.fft.fftfreq(H)[:, None]; fx = np.fft.rfftfreq(Wd)[None, :]
    F = np.fft.rfft2(img) * np.exp(-2 * math.pi ** 2 * (sx ** 2 * fx ** 2 + sy ** 2 * fy ** 2))
    return np.fft.irfft2(F, s=img.shape)
K = load(key)
x0, y0, x1, y1 = box; pad = 12
def tmpl(sx, sy):
    big = gblur(K[y0 - pad:y1 + pad, x0 - pad:x1 + pad], sx, sy)
    return big[pad:-pad, pad:-pad]
def match(F, T, cx, cy):
    th, tw = T.shape
    X0 = max(0, int(round(x0 + cx)) - R); Y0 = max(0, int(round(y0 + cy)) - R)
    X1 = min(F.shape[1], int(round(x0 + cx)) + R + tw); Y1 = min(F.shape[0], int(round(y0 + cy)) + R + th)
    S = F[Y0:Y1, X0:X1]
    if S.shape[0] < th or S.shape[1] < tw: return None
    win = swv(S, (th, tw))
    Tz = T - T.mean(); tn = math.sqrt((Tz * Tz).sum()) + 1e-9
    m = win.mean(axis=(2, 3))
    num = np.einsum('ijkl,kl->ij', win, Tz)
    var = (win * win).sum(axis=(2, 3)) - th * tw * m * m
    ncc = num / (np.sqrt(np.clip(var, 1e-9, None)) * tn)
    iy, ix = np.unravel_index(np.argmax(ncc), ncc.shape)
    v = ncc[iy, ix]
    def sub(arr, i):
        if 0 < i < len(arr) - 1:
            l, c, r = arr[i - 1], arr[i], arr[i + 1]; den = l - 2 * c + r
            if den < 0: return 0.5 * (l - r) / den
        return 0.0
    fx = ix + sub(ncc[iy, :], ix); fy = iy + sub(ncc[:, ix], iy)
    return X0 + fx - x0, Y0 + fy - y0, float(v)
res = []; cx = cy = 0.0
order = list(range(key, a - 1, -1)) + list(range(key + 1, b + 1)) if a <= key <= b else (list(range(a, b + 1)) if a > key else list(range(a, b - 1, -1)))
prevs = {}
for n in order:
    F = load(n)
    if n == key + 1: cx, cy = prevs.get(key, (0.0, 0.0))
    best = None
    sig = [(0, 0)] + ([(s, 0) for s in (1, 2, 3, 5, 8, 12)] + [(0, s) for s in (1, 2, 3, 5, 8, 12)] if doblur else [])
    for sx, sy in sig:
        r = match(F, tmpl(sx, sy), cx, cy)
        if r and (best is None or r[2] > best[0][2]): best = (r, sx, sy)
    (dx, dy, v), sx, sy = best
    cx, cy = dx, dy; prevs[n] = (dx, dy)
    rec = dict(n=n, dx=round(dx, 2), dy=round(dy, 2), bx=sx, by=sy, ncc=round(v, 4))
    res.append(rec); print(json.dumps(rec), flush=True)
res.sort(key=lambda r: r['n'])
json.dump(res, open(out, 'w'), indent=0)
