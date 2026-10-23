# Frame-to-frame translation by phase correlation of gradient-magnitude images (sub-pixel, parabolic peak).
# usage: pcorr.py <absdir> <first> <last> [y0,y1] [--x0x1 a,b]   prints n, dx, dy (motion from n-1 to n, px in 1080 frame), peak
import sys, os, json
import numpy as np
from PIL import Image
d, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
y0, y1 = ([int(v) for v in sys.argv[4].split(',')] if len(sys.argv) > 4 and not sys.argv[4].startswith('--') else (0, 608))
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = im.resize((1080, round(im.height * 1080 / im.width)), Image.LANCZOS).crop((0, 0, 1080, 608))
    A = np.asarray(im, dtype=np.float64)[y0:y1]
    gx = np.zeros_like(A); gy = np.zeros_like(A)
    gx[:, 1:-1] = A[:, 2:] - A[:, :-2]; gy[1:-1] = A[2:] - A[:-2]
    G = np.hypot(gx, gy)
    # window to reduce edge effects
    wy = np.hanning(G.shape[0])[:, None]; wx = np.hanning(G.shape[1])[None, :]
    return (G - G.mean()) * wy * wx
def shift(A, B):
    FA = np.fft.fft2(A); FB = np.fft.fft2(B)
    R = FB * np.conj(FA); R /= np.abs(R) + 1e-9
    c = np.real(np.fft.ifft2(R))
    iy, ix = np.unravel_index(np.argmax(c), c.shape)
    H, W = c.shape
    def sub(cm, c0, cp):
        den = cm - 2 * c0 + cp
        return 0.5 * (cm - cp) / den if den != 0 else 0.0
    dx = ix + sub(c[iy, (ix - 1) % W], c[iy, ix], c[iy, (ix + 1) % W])
    dy = iy + sub(c[(iy - 1) % H, ix], c[iy, ix], c[(iy + 1) % H, ix])
    if dx > W / 2: dx -= W
    if dy > H / 2: dy -= H
    return dx, dy, float(c[iy, ix])
prev = load(a)
cx = cy = 0.0
print(json.dumps(dict(n=a, dx=0, dy=0, X=0, Y=0)))
for n in range(a + 1, b + 1):
    cur = load(n)
    dx, dy, pk = shift(prev, cur)
    cx += dx; cy += dy
    print(json.dumps(dict(n=n, dx=round(dx, 2), dy=round(dy, 2), X=round(cx, 1), Y=round(cy, 1), pk=round(pk, 3))))
    prev = cur
