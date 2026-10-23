# Silhouette profiles of dark shapes on the light page: per column x, the top/bottom crossing; per row, left/right.
# usage: sil.py <absdir> <n> [thr]
import sys, os, json
import numpy as np
from PIL import Image
d, n = sys.argv[1], int(sys.argv[2]); THR = float(sys.argv[3]) if len(sys.argv) > 3 else 150
im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
if im.width != 1080: im = im.crop((0, 0, im.width, round(im.width * 608 / 1080))).resize((1080, 608), Image.LANCZOS)
g = np.asarray(im).astype(float)
def fc(v):
    b = v < THR
    if not b.any(): return None
    i = int(np.argmax(b)); 
    if i == 0: return 0.0
    return i - 1 + (v[i-1] - THR) / (v[i-1] - v[i])
def fcv(M):
    below = M < THR; ok = below.any(axis=1); i = np.argmax(below, axis=1)
    im1 = np.maximum(i - 1, 0); r = np.arange(M.shape[0]); a_ = M[r, im1]; b_ = M[r, i]
    pos = np.where(i == 0, 0.0, im1 + (a_ - THR) / np.where(a_ - b_ == 0, 1, a_ - b_))
    return [round(float(p), 1) if o else None for o, p in zip(ok, pos)]
top = fcv(g.T); bot = [None if v is None else round(607 - v, 1) for v in fcv(g[::-1, :].T)]
print(json.dumps(dict(n=n, top=top, bot=bot)))
