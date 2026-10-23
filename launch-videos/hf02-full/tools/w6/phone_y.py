# Phone vertical track: bottom edge B (subpixel, on a phone column left of the bubble) for n1489–1531, the purple chip row
# centre for n1484–1490, the measured top edge T from rect.json. Writes phone_track.json {n: {s, cx, T}} (s = width/362.35).
import json, os, sys
import numpy as np
from PIL import Image
d = sys.argv[1]; M = sys.argv[2]
R = {o['n']: o for o in json.load(open(os.path.join(M, 'ref_rect.json')))}
W0, H0, CHIP0, T0 = 362.35, 643.9, 315.98, 73.29
def g(n): return np.asarray(Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')).astype(float)
def bottom(n, x0=280, x1=300):
    col = np.median(g(n)[:, x0:x1], axis=1)
    dark = np.nonzero(col < 120)[0]
    runs = np.split(dark, np.nonzero(np.diff(dark) > 12)[0] + 1)
    run = [r for r in runs if r[0] < 40][0] if n < 1531 else runs[0]
    # the phone run continues through bright content: take the last dark row above the first long background gap
    b = run[-1]
    for r in runs[1:]:
        if r[0] - b < 40 and r[0] < 590 and not (n >= 1529 and r[-1] >= 600): b = r[-1]
    inside = np.median(col[b - 12:b - 3]); mid = (246 + inside) / 2
    return b + (col[b] - mid) / (col[b] - col[b + 1]) if col[b] != col[b + 1] else float(b)
def chip(n):
    a = np.asarray(Image.open(os.path.join(d, 'n%04d.png' % n)).convert('RGB')).astype(float)
    m = (a[..., 2] > 170) & (a[..., 0] > 80) & (a[..., 0] < 150) & (a[..., 1] < 90)
    ys, xs = np.nonzero(m); rows = np.bincount(ys, minlength=608); good = np.nonzero(rows > 8)[0]
    runs = np.split(good, np.nonzero(np.diff(good) > 3)[0] + 1)
    r = [r for r in runs if r[-1] - r[0] > 25][0]
    sel = (ys >= r[0]) & (ys <= r[-1]); return float(ys[sel].mean())
out = {}
for n in range(1408, 1532):
    o = R[n]
    s = o['w'] / W0 if n <= 1530 else R[1530]['w'] / W0
    cx = o['cx'] if n <= 1530 else R[1530]['cx']
    if n <= 1483: T, src = o['T'], 'top'
    elif n <= 1488: T, src = chip(n) - s * (CHIP0 - T0), 'chip'
    else: B = bottom(n); T, src = B - s * H0, 'bottom %.2f' % B
    out[n] = dict(s=round(s, 5), cx=round(cx, 2), T=round(T, 2), src=src)
    print(n, out[n])
json.dump(out, open(os.path.join(M, 'phone_track.json'), 'w'))
