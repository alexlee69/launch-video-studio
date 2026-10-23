# Blur sigma of one straight edge per frame: fit an erf step to a 1-D profile (mean over a band) around a given edge.
# usage: edgesig.py <absdir> <axis row|col> <band a,b> <n:pos,n:pos,...> [halfwin]
import sys, os, math
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nm import nm
d, axis, band, spec = sys.argv[1], sys.argv[2], [int(v) for v in sys.argv[3].split(',')], sys.argv[4]
hw = int(sys.argv[5]) if len(sys.argv) > 5 else 40
erf = np.vectorize(math.erf)
for item in spec.split(','):
    n, pos = item.split(':'); n = int(n); pos = float(pos)
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = im.crop((0, 0, im.width, round(im.width * 608 / 1080))).resize((1080, 608), Image.LANCZOS)
    L = np.asarray(im, dtype=np.float64)
    prof = L[:, band[0]:band[1]].mean(axis=1) if axis == 'row' else L[band[0]:band[1], :].mean(axis=0)
    lo = max(0, int(pos) - hw); hi = min(len(prof), int(pos) + hw); x = np.arange(lo, hi); y = prof[lo:hi]
    def f(p):
        a, b, c, s = p; m = a + (b - a) * 0.5 * (1 + erf((x - c) / (math.sqrt(2) * max(abs(s), 0.2))))
        return ((m - y) ** 2).sum()
    p, v = nm(f, [y[0], y[-1], pos, 3.0], [10, 10, 3, 2], 600)
    print(n, 'edge %.2f' % p[2], 'sigma %.2f' % abs(p[3]), 'levels %.0f->%.0f' % (p[0], p[1]), 'rms %.1f' % math.sqrt(v / len(x)))
