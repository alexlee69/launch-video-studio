# Fit position + anisotropic gaussian blur of one sharp landmark patch (key frame) in other frames. numpy/PIL only.
# usage: blurfit.py <absdir> <key> <x0,y0,x1,y1> <n1,n2,...> [--w 1080] [--R 40] [--init dx,dy]
import sys, os, json, math
import numpy as np
from PIL import Image
from numpy.lib.stride_tricks import sliding_window_view as swv
d, key = sys.argv[1], int(sys.argv[2]); x0, y0, x1, y1 = [int(v) for v in sys.argv[3].split(',')]
ns = [int(v) for v in sys.argv[4].split(',')]
opt = lambda k, dv: type(dv)(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else dv
W = opt('--w', 1080); R = opt('--R', 40)
init = [float(v) for v in opt('--init', '0,0').split(',')]
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != W: im = im.crop((0, 0, im.width, round(im.width * 608 / 1080))).resize((W, round(W * 608 / 1080)), Image.LANCZOS)
    return np.asarray(im, dtype=np.float64)
def gblur(img, sx, sy):
    if sx < 0.05 and sy < 0.05: return img
    H, Wd = img.shape; fy = np.fft.fftfreq(H)[:, None]; fx = np.fft.rfftfreq(Wd)[None, :]
    return np.fft.irfft2(np.fft.rfft2(img) * np.exp(-2 * math.pi ** 2 * (sx ** 2 * fx ** 2 + sy ** 2 * fy ** 2)), s=img.shape)
K = load(key); pad = 40
big = K[y0 - pad:y1 + pad, x0 - pad:x1 + pad]
def best(F, sx, sy, cx, cy):
    T = gblur(big, sx, sy)[pad:-pad, pad:-pad]; th, tw = T.shape
    X0 = int(round(x0 + cx)) - R; Y0 = int(round(y0 + cy)) - R
    S = F[max(0, Y0):Y0 + 2 * R + th, max(0, X0):X0 + 2 * R + tw]; X0 = max(0, X0); Y0 = max(0, Y0)
    win = swv(S, (th, tw)); Tz = T - T.mean(); tn = math.sqrt((Tz * Tz).sum()) + 1e-9
    m = win.mean(axis=(2, 3)); num = np.einsum('ijkl,kl->ij', win, Tz)
    var = (win * win).sum(axis=(2, 3)) - th * tw * m * m
    c = num / (np.sqrt(np.clip(var, 1e-9, None)) * tn)
    iy, ix = np.unravel_index(np.argmax(c), c.shape)
    def sub(arr, i):
        if 0 < i < len(arr) - 1:
            l, cc, r = arr[i - 1], arr[i], arr[i + 1]; den = l - 2 * cc + r
            if den < 0: return 0.5 * (l - r) / den
        return 0.0
    return X0 + ix + sub(c[iy, :], ix) - x0, Y0 + iy + sub(c[:, ix], iy) - y0, float(c[iy, ix])
cx, cy = init
for n in ns:
    F = load(n); res = None
    for sx in [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10]:
        for sy in [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15]:
            r = best(F, sx, sy, cx, cy)
            if res is None or r[2] > res[2]: res = (r[0], r[1], r[2], sx, sy)
    # refine around the best
    bx, by = res[3], res[4]
    for sx in np.arange(max(0, bx - 0.75), bx + 0.8, 0.25):
        for sy in np.arange(max(0, by - 0.75), by + 0.8, 0.25):
            r = best(F, sx, sy, cx, cy)
            if r[2] > res[2]: res = (r[0], r[1], r[2], float(sx), float(sy))
    cx, cy = res[0], res[1]
    print(json.dumps(dict(n=n, dx=round(res[0], 2), dy=round(res[1], 2), bx=round(res[3], 2), by=round(res[4], 2), ncc=round(res[2], 4))), flush=True)
