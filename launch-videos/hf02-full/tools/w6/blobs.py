# Blob measurements per frame for the W6 burst: content = |frame - plate| (plate = paper + the reference watermark),
# connected components, per blob: weighted centroid, area, bbox, mean colour class, radial/tangential 2nd moments.
# usage: python3 -E blobs.py <framesdir> <first> <last> <out.json> [--cx 540 --cy 304] [--thr 12] [--nowm]
import sys, os, json, math
from collections import deque
import numpy as np
from PIL import Image
d, a, b, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
arg = lambda k, v: type(v)(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else v
CX, CY, THR = arg('--cx', 540.0), arg('--cy', 304.0), arg('--thr', 12.0)
REF = os.path.expanduser('~/Downloads/launch-videos/hf02-full/ref/frames')
BG = np.array([float(v) for v in sys.argv[sys.argv.index('--bg') + 1].split(',')] if '--bg' in sys.argv else [246, 244, 249], float)
def load(n, dd):
    im = Image.open(os.path.join(dd, 'n%04d.png' % n)).convert('RGB')
    if im.width != 1080: im = im.crop((0, 0, 1920, 1080)).resize((1080, 608), Image.LANCZOS)
    return np.asarray(im, float)
plate = np.ones((608, 1080, 3)) * BG
if '--nowm' not in sys.argv:
    wm = load(1327, REF); plate[60:260, 800:1060] = wm[60:260, 800:1060]
CLS = {'blue': (30, 110, 250), 'orange': (250, 120, 30), 'purple': (150, 80, 240), 'black': (40, 40, 45), 'gray': (222, 219, 224),
       'green': (30, 180, 100), 'white': (240, 240, 245)}
def classify(c):
    best = None
    for k, v in CLS.items():
        e = sum((c[i] - v[i]) ** 2 for i in range(3))
        if best is None or e < best[1]: best = (k, e)
    return best[0]
res = []
for n in range(a, b + 1):
    F = load(n, d)
    D = np.abs(F - plate).max(axis=2)
    M = D > THR
    H, W = M.shape
    lab = np.zeros((H, W), np.int32); nl = 0
    ys, xs = np.nonzero(M)
    blobs = []
    for y0, x0 in zip(ys, xs):
        if lab[y0, x0]: continue
        nl += 1; q = deque([(y0, x0)]); lab[y0, x0] = nl; pts = []
        while q:
            y, x = q.popleft(); pts.append((y, x))
            for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1), (y - 1, x - 1), (y + 1, x + 1), (y - 1, x + 1), (y + 1, x - 1)):
                if 0 <= yy < H and 0 <= xx < W and M[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = nl; q.append((yy, xx))
        if len(pts) < 25: continue
        P = np.array(pts); py, px = P[:, 0].astype(float), P[:, 1].astype(float)
        w = D[P[:, 0], P[:, 1]]
        sw = w.sum(); mx, my = (w * px).sum() / sw, (w * py).sum() / sw
        # radial unit vector from the burst centre
        rx, ry = mx - CX, my - CY; rr = math.hypot(rx, ry)
        ux, uy = (rx / rr, ry / rr) if rr > 1 else (1.0, 0.0)
        dx, dy = px - mx, py - my
        vr = (w * (dx * ux + dy * uy) ** 2).sum() / sw; vt = (w * (-dx * uy + dy * ux) ** 2).sum() / sw
        vx = (w * dx * dx).sum() / sw; vy = (w * dy * dy).sum() / sw
        core = w > 0.5 * w.max()
        col = F[P[core, 0], P[core, 1]].mean(axis=0)
        # colour from saturated core pixels (ignore eyes): pixels whose diff is in the upper half but not darkest
        blobs.append(dict(x=round(mx, 2), y=round(my, 2), r=round(rr, 2), ang=round(math.degrees(math.atan2(ry, rx)), 1), area=len(pts),
                          bbox=[int(px.min()), int(py.min()), int(px.max()), int(py.max())], sr=round(math.sqrt(vr), 2), st=round(math.sqrt(vt), 2),
                          sx=round(math.sqrt(vx), 2), sy=round(math.sqrt(vy), 2), wsum=round(sw, 1),
                          col=[int(c) for c in col], cls=classify(col)))
    blobs.sort(key=lambda o: (o['ang'], o['r']))
    res.append(dict(n=n, blobs=blobs))
    print(n, len(blobs), ' '.join('%s@%.0f,%.0f/%d' % (o['cls'][:2], o['x'], o['y'], o['area']) for o in blobs), flush=True)
json.dump(res, open(out, 'w'))
