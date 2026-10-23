# Card on a light page: coarse bbox from a darkness mask, then each edge refined as the half-way crossing in a strip
# through the middle of the card. Also the left-edge 20-80% width (blur) and the corner radius from the diagonal.
# usage: card.py <absdir> <first> <last> [roi x0,y0,x1,y1] [--page 245]
import sys, os, json, math
import numpy as np
from PIL import Image
d, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
roi = [int(v) for v in sys.argv[4].split(',')] if len(sys.argv) > 4 and not sys.argv[4].startswith('--') else [0, 0, 1080, 608]
PAGE = float(sys.argv[sys.argv.index('--page') + 1]) if '--page' in sys.argv else None
def load(n):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('L')
    if im.width != 1080: im = im.resize((1080, round(im.height * 1080 / im.width)), Image.LANCZOS).crop((0, 0, 1080, 608))
    return np.asarray(im, dtype=np.float64)
def cross(p, mid):
    for i in range(1, len(p)):
        if (p[i - 1] - mid) * (p[i] - mid) <= 0 and p[i - 1] != p[i]:
            return i - 1 + (p[i - 1] - mid) / (p[i - 1] - p[i])
    return None
def edge(prof, page):
    # prof runs from outside (page) to inside the card
    inner = np.median(prof[-max(3, len(prof) // 3):])
    c = cross(prof, (page + inner) / 2)
    lo = cross(prof, page - 0.2 * (page - inner)); hi = cross(prof, page - 0.8 * (page - inner))
    sig = (hi - lo) / 1.683 if (lo is not None and hi is not None) else None
    return c, sig
for n in range(a, b + 1):
    L = load(n); x0, y0, x1, y1 = roi
    page = PAGE or float(np.percentile(L[y0:y1, x0:x1], 97))
    M = (L[y0:y1, x0:x1] < page - 40).astype(float)
    colf = M.mean(axis=0); rowf = M.mean(axis=1)
    cs = np.where(colf > 0.3 * colf.max())[0]; rs = np.where(rowf > 0.3 * rowf.max())[0]
    if len(cs) == 0 or len(rs) == 0: print(json.dumps({'n': n, 'none': 1})); continue
    cl, cr = cs[0] + x0, cs[-1] + x0; ct, cb = rs[0] + y0, rs[-1] + y0
    my0, my1 = int(ct + (cb - ct) * 0.3), int(ct + (cb - ct) * 0.7) + 1
    mx0, mx1 = int(cl + (cr - cl) * 0.3), int(cl + (cr - cl) * 0.7) + 1
    rec = {'n': n, 'page': round(page, 1)}
    W = 90
    # left
    a0 = max(0, int(cl) - W); p = L[my0:my1, a0:int(cl) + W].mean(axis=0); e, s = edge(p, page)
    rec['l'] = round(a0 + e, 1) if e is not None and cl > 2 else 0.0; rec['sl'] = round(s, 2) if s else None
    a1 = min(1080, int(cr) + W); p = L[my0:my1, int(cr) - W:a1].mean(axis=0)[::-1]; e, s = edge(p, page)
    rec['r'] = round(a1 - 1 - e, 1) if e is not None and cr < 1077 else 1079.0; rec['sr'] = round(s, 2) if s else None
    a0 = max(0, int(ct) - W); p = L[a0:int(ct) + W, mx0:mx1].mean(axis=1); e, s = edge(p, page)
    rec['t'] = round(a0 + e, 1) if e is not None and ct > 2 else 0.0; rec['st'] = round(s, 2) if s else None
    a1 = min(608, int(cb) + W); p = L[int(cb) - W:a1, mx0:mx1].mean(axis=1)[::-1]; e, s = edge(p, page)
    rec['b'] = round(a1 - 1 - e, 1) if e is not None and cb < 605 else 607.0; rec['sb'] = round(s, 2) if s else None
    rec['w'] = round(rec['r'] - rec['l'] + 1, 1); rec['h'] = round(rec['b'] - rec['t'] + 1, 1)
    rec['cx'] = round((rec['l'] + rec['r']) / 2, 1); rec['cy'] = round((rec['t'] + rec['b']) / 2, 1)
    rec['s'] = round(rec['w'] / 1080, 4)
    print(json.dumps(rec))
