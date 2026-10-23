# Frame-to-frame similarity over the whole source: NCC on 270x152 grey, plus mean abs diff.
import sys, os, json
import numpy as np
from PIL import Image
d = sys.argv[1]; out = sys.argv[2]
fs = sorted(f for f in os.listdir(d) if f.endswith('.png'))
prev = None; rows = []
for f in fs:
    n = int(f[1:5])
    a = np.asarray(Image.open(os.path.join(d, f)).convert('L').resize((270, 152), Image.BILINEAR), dtype=np.float32)
    m = float(a.mean())
    if prev is not None:
        x = a - a.mean(); y = prev - prev.mean()
        ncc = float((x * y).sum() / (np.sqrt((x * x).sum() * (y * y).sum()) + 1e-6))
        mad = float(np.abs(a - prev).mean())
        rows.append({'n': n, 'ncc': round(ncc, 4), 'mad': round(mad, 2), 'mean': round(m, 1)})
    prev = a
json.dump(rows, open(out, 'w'))
for r in rows:
    if r['ncc'] < 0.75 or r['mad'] > 25:
        print('n%d t=%.3f ncc=%.3f mad=%.1f mean=%.1f' % (r['n'], r['n'] / 30, r['ncc'], r['mad'], r['mean']))
