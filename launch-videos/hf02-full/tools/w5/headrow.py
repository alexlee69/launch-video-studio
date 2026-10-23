# Vertical position of a chat headline row per frame: NCC of the row's vertical ink profile (first glyphs only, so the
# type-on does not bias it) against a key frame, subpixel by parabola. Prints the offset (frame px) of the row vs the key.
# usage: headrow.py <absdir> <key_n> <y0,y1,x0,x1 at key> <first> <last> <out.json> [--guess json_of_{n:offset}]
import sys, os, json, math
import numpy as np
from PIL import Image
d, kn = sys.argv[1], int(sys.argv[2]); y0, y1, x0, x1 = [int(v) for v in sys.argv[3].split(',')]
a, b, out = int(sys.argv[4]), int(sys.argv[5]), sys.argv[6]
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = im.crop((0, 0, im.width, round(im.width * 608 / 1080))).resize((1080, 608), Image.LANCZOS)
    return np.asarray(im, dtype=np.float64)
K = load(kn); bg = np.median(K[:, 1000:1070]); T = np.clip(bg - K[y0:y1, x0:x1], 0, None).sum(axis=1)
T = T - T.mean()
res = []
def run(seq, fwd):
  prev = 0.0
  for n in seq:
    F = load(n); bgf = np.median(F[:, 1000:1070]); P = np.clip(bgf - F[:, x0:x1], 0, None).sum(axis=1)
    P = np.concatenate([P, np.zeros(400)])   # allow rows partly below the frame
    best = None; vals = {}
    lo = -y0 + 1
    rng_ = range(max(lo, int(prev) - 70), int(prev) + 20) if fwd else range(max(lo, int(prev) - 20), int(prev) + 70)
    for s in rng_:
        Q = P[y0 + s:y1 + s]; Q = Q - Q.mean(); den = math.sqrt((Q * Q).sum() * (T * T).sum()) + 1e-9
        v = (Q * T).sum() / den; vals[s] = v
        if best is None or v > best[1]: best = (s, v)
    s, v = best
    if s - 1 in vals and s + 1 in vals:
        p0, p1, p2 = vals[s - 1], v, vals[s + 1]; den = p0 - 2 * p1 + p2
        if den < 0: s = s + 0.5 * (p0 - p2) / den
    prev = s; r = dict(n=n, off=round(s, 2), ncc=round(v, 3)); res.append(r)
run(range(kn, b + 1), True); run(range(kn - 1, a - 1, -1), False)
res.sort(key=lambda r: r['n'])
for r in res: print(json.dumps(r))
json.dump(res, open(out, 'w'))
