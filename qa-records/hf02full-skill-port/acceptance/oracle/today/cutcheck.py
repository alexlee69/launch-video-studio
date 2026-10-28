# -*- coding: utf-8 -*-
# For every source cut, find the frame where the picture changes most within +-4 frames, in the source and in our render, and report the offset.
import sys, os, json
import numpy as np
from PIL import Image
J = '/Users/bytedance/Downloads/launch-videos/hf02-full'
CUTS = [(75, 'lockup > corridor'), (97, 'corridor > plate 1'), (231, 'plate cut'), (264, 'plate > chat'), (312, 'chat'), (357, 'dissolve'),
        (465, 'chat'), (510, 'chat > review card'), (641, 'card > close-up'), (671, 'close-up > research'), (719, 'research > big type'),
        (743, 'big type > thread'), (843, 'whip > wall'), (922, 'wall > featured'), (972, 'featured > insights'), (1000, 'insights > fan'),
        (1260, 'fan > cast'), (1281, 'cast > burst'), (1530, 'phone > plate 2'), (1629, 'plate 2 > carousel'), (1698, 'carousel > outro'), (1787, 'outro > end card')]
def series(d, cache):
    if cache and os.path.exists(cache): return {int(k): v for k, v in json.load(open(cache)).items()}
    out, prev = {}, None
    for f in sorted(f for f in os.listdir(d) if f.endswith('.png')):
        n = int(f[1:5]); a = np.asarray(Image.open(os.path.join(d, f)).convert('L').resize((270, 152), Image.BILINEAR), dtype=np.float32)
        if prev is not None:
            x, y = a - a.mean(), prev - prev.mean()
            ncc = float((x * y).sum() / (np.sqrt((x * x).sum() * (y * y).sum()) + 1e-6))
            out[n] = [ncc, float(np.abs(a - prev).mean()), float(a.std())]
        prev = a
    if cache: json.dump(out, open(cache, 'w'))
    return out
score = lambda r: max(0.0, 1 - r[0]) + r[1] / 30
def peak(s, c, w=4):
    win = [n for n in range(c - w, c + w + 1) if n in s]
    best = max(win, key=lambda n: score(s[n]))
    vals = sorted((score(s[n]) for n in win), reverse=True)
    return best, vals[0], (vals[1] if len(vals) > 1 else 0)
ref = series(J + '/ref/frames', sys.argv[2] + '/ref_series.json')
ours = series(sys.argv[1], None)
exact = near = 0; rows = []
for c, lab in CUTS:
    rn, rs, _ = peak(ref, c)
    if all(ours.get(n, [0, 0, 0])[2] < 1.5 for n in range(rn - 2, rn + 3)):
        rows.append('n%-5d %-22s source n%-5d ours: not built yet' % (c, lab, rn)); continue
    on, os_, o2 = peak(ours, rn)
    d = on - rn; exact += d == 0; near += abs(d) <= 1
    rows.append('n%-5d %-22s source n%-5d ours n%-5d %+d f  (strength ours %.2f vs source %.2f)' % (c, lab, rn, on, d, os_, rs))
print('\n'.join(rows))
built = sum('not built' not in r for r in rows)
print('\ncuts built: %d of %d; exact frame: %d; within 1 frame: %d' % (built, len(CUTS), exact, near))
