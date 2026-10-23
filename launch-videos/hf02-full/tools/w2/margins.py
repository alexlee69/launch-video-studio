# Card margins on a light page: per side, the half-way crossing of the luma profile in a strip through the card's middle.
# usage: margins.py <absdir> <first> <last> [cx cy]   (prints l, r, t, b, scale from width and height)
import sys, os, json
import numpy as np
from PIL import Image
d, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
cx = float(sys.argv[4]) if len(sys.argv) > 4 else 540; cy = float(sys.argv[5]) if len(sys.argv) > 5 else 304
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = im.resize((1080, round(im.height * 1080 / im.width)), Image.LANCZOS)
    return np.asarray(im, dtype=np.float64)[:608]
def cross(p, bg):
    # p runs from the page edge inward; find first index where p drops below the midpoint between bg and the inner level
    inner = np.median(p[len(p) // 2:]) if len(p) > 4 else p[-1]
    mid = (bg + inner) / 2
    for i in range(1, len(p)):
        if (p[i - 1] - mid) * (p[i] - mid) <= 0 and p[i - 1] != p[i]:
            return i - 1 + (p[i - 1] - mid) / (p[i - 1] - p[i])
    return 0.0
res = []
for n in range(a, b + 1):
    L = load(n)
    bg = 245.0
    ys = slice(int(cy - 60), int(cy + 60)); xs = slice(int(cx - 120), int(cx + 120))
    left = L[ys, :int(cx)].mean(axis=0)
    right = L[ys, int(cx):].mean(axis=0)[::-1]
    top = L[:int(cy), xs].mean(axis=1)
    bot = L[int(cy):, xs].mean(axis=1)[::-1]
    l = cross(left, bg); r = 1080 - 1 - cross(right, bg); t = cross(top, bg); bb = 608 - 1 - cross(bot, bg)
    rec = dict(n=n, l=round(l, 1), r=round(r, 1), t=round(t, 1), b=round(bb, 1), sw=round((r - l + 1) / 1080, 4), sh=round((bb - t + 1) / 608, 4), cx=round((l + r) / 2, 1), cy=round((t + bb) / 2, 1),
               bgL=round(float(L[ys, :3].mean()), 1), bgT=round(float(L[:3, xs].mean()), 1))
    res.append(rec); print(json.dumps(rec))
