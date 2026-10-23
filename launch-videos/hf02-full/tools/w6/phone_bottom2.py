# Phone bottom edge on frame columns 280–300 (left of the bubble): the lowest dark→paper transition (dark < 120 above,
# paper > 200 for the next 12 rows), subpixel half-level crossing. Same procedure for the reference and our render.
# usage: phone_bottom2.py <dir> a b <out.json>
import sys, os, json
import numpy as np
from PIL import Image
d, a, b, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
res = {}
for n in range(a, b + 1):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = im.crop((0, 0, 1920, 1080)).resize((1080, 608), Image.LANCZOS)
    col = np.median(np.asarray(im, float)[:, 280:301], axis=1)
    cand = [y for y in range(2, 594) if col[y] < 100 and (col[y + 1:y + 13] > 165).all()]
    if not cand: continue
    y = max(cand); lo = np.median(col[max(0, y - 8):y - 1]); hi = np.median(col[y + 4:y + 12]); mid = (lo + hi) / 2
    yy = y
    while yy < y + 6 and col[yy + 1] < mid: yy += 1
    B = yy + (col[yy] - mid) / (col[yy] - col[yy + 1]) if col[yy] != col[yy + 1] else float(yy)
    res[n] = round(float(B), 2)
json.dump(res, open(out, 'w')); print(len(res), 'frames')
