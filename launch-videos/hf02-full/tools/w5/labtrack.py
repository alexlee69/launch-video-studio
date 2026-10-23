# Template tracker for a floating label: per frame fit centre (cx, cy), scale s (about the template centre), blur b,
# contrast a (regression slope ~ opacity) of the frame against a sharp template from one frame.
# usage: labtrack.py <absdir> <out.json> <name> <ref_n> <x0,y0,x1,y1> <first> <last>
import sys, os, json, math
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nm import nm
d, out, name, nref = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
x0, y0, x1, y1 = [int(v) for v in sys.argv[5].split(',')]; a, b = int(sys.argv[6]), int(sys.argv[7])
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = im.crop((0, 0, im.width, round(im.width * 608 / 1080))).resize((1080, 608), Image.LANCZOS)
    return np.asarray(im, dtype=np.float64)
def bil(img, x, y):
    h, w = img.shape; x = np.clip(x, 0, w - 1.001); y = np.clip(y, 0, h - 1.001)
    xi = np.floor(x).astype(int); yi = np.floor(y).astype(int); dx = x - xi; dy = y - yi
    return img[yi, xi] * (1 - dx) * (1 - dy) + img[yi, xi + 1] * dx * (1 - dy) + img[yi + 1, xi] * (1 - dx) * dy + img[yi + 1, xi + 1] * dx * dy
R = load(nref); T = R[y0:y1, x0:x1].copy(); th, tw = T.shape
tc = np.array([(x0 + x1 - 1) / 2, (y0 + y1 - 1) / 2])
uu, vv = np.meshgrid(np.arange(tw) - (tw - 1) / 2, np.arange(th) - (th - 1) / 2)
bgT = np.median(np.concatenate([T[0], T[-1], T[:, 0], T[:, -1]]))
Tc = T - bgT
# model: frame(c + u) = bg + a * blur_b( Tc scaled by s ) ; evaluate on a window 1.0x template around centre
def blur(img, s):
    if s < 0.15: return img
    h, w = img.shape; fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.rfftfreq(w)[None, :]
    p = 12; im2 = np.pad(img, p); h2, w2 = im2.shape; fy = np.fft.fftfreq(h2)[:, None]; fx = np.fft.rfftfreq(w2)[None, :]
    return np.fft.irfft2(np.fft.rfft2(im2) * np.exp(-2 * math.pi ** 2 * s * s * (fx ** 2 + fy ** 2)), s=im2.shape)[p:-p, p:-p]
def model_patch(s, bsig):
    # template scaled by s about its centre, sampled on the template grid (outside -> 0)
    xs = uu / max(s, 0.03) + (tw - 1) / 2; ys = vv / max(s, 0.03) + (th - 1) / 2
    ok = (xs >= 0) & (xs <= tw - 1) & (ys >= 0) & (ys <= th - 1)
    m = np.zeros_like(uu); m[ok] = bil(Tc, xs[ok], ys[ok])
    return blur(m, bsig)
res = []
def fitn(n, prev):
    F = load(n)
    def f(p):
        cx, cy, s, bs = p
        if s < 0.03 or s > 1.4: return 1e9
        Fp = bil(F, cx + uu, cy + vv); M = model_patch(s, abs(bs))
        Mc = M - M.mean(); Fc = Fp - Fp.mean(); den = math.sqrt((Mc * Mc).sum() * (Fc * Fc).sum()) + 1e-9
        return -(Mc * Fc).sum() / den
    best = None
    for st in ([4, 4, 0.08, 1.0], [10, 6, 0.25, 2.0]):
        p, v = nm(f, prev, st, 260)
        p, v = nm(f, p, [s * 0.25 for s in st], 160)
        if best is None or v < best[1]: best = (p, v)
    p, v = best; cx, cy, s, bs = p
    Fp = bil(F, cx + uu, cy + vv); M = model_patch(s, abs(bs)); Mc = M - M.mean()
    amp = float(((Fp - Fp.mean()) * Mc).sum() / ((Mc * Mc).sum() + 1e-9))
    return dict(n=n, cx=round(cx, 2), cy=round(cy, 2), s=round(s, 4), blur=round(abs(bs), 2), amp=round(amp, 3), ncc=round(-v, 4)), [cx, cy, s, bs]
rows = {}
for rng in (range(nref, b + 1), range(nref - 1, a - 1, -1)):
    prev = [tc[0], tc[1], 1.0, 0.3]
    for n in rng:
        r, p = fitn(n, prev); rows[n] = r
        if r['ncc'] > 0.6 and r['s'] > 0.15: prev = p
        else: prev = [p[0], p[1], max(p[2], 0.3), 0.5]
out_rows = [rows[k] for k in sorted(rows)]
for r in out_rows: print(name, json.dumps(r), flush=True)
allr = json.load(open(out)) if os.path.exists(out) else {}
allr[name] = out_rows; json.dump(allr, open(out, 'w'))
