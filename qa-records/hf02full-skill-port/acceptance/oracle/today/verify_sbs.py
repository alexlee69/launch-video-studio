# -*- coding: utf-8 -*-
# Decode the side-by-side and check that frame i's left half is source frame i and its right half is our frame i (not a neighbour).
import sys, subprocess, numpy as np
from PIL import Image
sbs, ref_dir, ours_dir = sys.argv[1:4]
w, h = 192, 108
def load(p): return np.asarray(Image.open(p).convert('L').resize((w, h), Image.BILINEAR), dtype=np.float32)
def ncc(a, b): x, y = a - a.mean(), b - b.mean(); return float((x * y).sum() / (np.sqrt((x * x).sum() * (y * y).sum()) + 1e-6))
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', sbs, '-vf', 'scale=%d:%d' % (2 * w, h), '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, h, 2 * w).astype(np.float32)
N = len(fr); print('decoded', N, 'frames')
for side, d, sl in (('left/source', ref_dir, slice(0, w)), ('right/ours', ours_dir, slice(w, 2 * w))):
    imgs = [load('%s/n%04d.png' % (d, n)) for n in range(N)]
    bad = []
    for i in range(N):
        s = {j: ncc(fr[i][:, sl], imgs[j]) for j in (i - 1, i, i + 1) if 0 <= j < N}
        best = max(s, key=s.get)
        if best != i and s[best] - s[i] > 0.002: bad.append((i, best, round(s[i], 4), round(s[best], 4)))
    print(side, 'mismatched frames:', len(bad), bad[:12])
