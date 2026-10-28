# -*- coding: utf-8 -*-
import sys
sys.path.insert(0, '/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/review/sonnet-B/stage/video/recreate'); sys.dont_write_bytecode = True
import compare, media, numpy as np
ref, ours, sbs = sys.argv[1:4]
R, O = media.probe(ref), media.probe(ours)
H, Wl, Wr = compare.layout(R, O)
pad = max(6, int(round(H * .026)));  band = 2 * pad + max(12, int(round(H * .048))) + max(8, int(round(H * .026))) + 4
print('layout', H, Wl, Wr, 'band', band)
S = [list(compare.vthumb(f, band) for f in media.frames(ref, (Wl, H), 'rgb24', 0, 119, flags='bicubic')), list(compare.vthumb(f, band) for f in media.frames(ours, (Wr, H), 'rgb24', 0, 119, flags='bicubic'))]
mad = lambda x, y: float(np.abs(x - y).mean())
rows = []
for k, f in enumerate(media.frames(sbs, (Wl + Wr, H), 'rgb24')):
    for side, half in ((0, f[:, :Wl]), (1, f[:, Wl:])):
        d = compare.vthumb(half, band); own = mad(d, S[side][k])
        for j in (k - 1, k + 1):
            if 0 <= j < 120:
                other = mad(d, S[side][j]); m = mad(S[side][k], S[side][j])
                if other + max(.2, .25 * m) < own: rows.append((k, side, j, round(own, 3), round(other, 3), round(m, 3)))
print('flagged:', rows)
# distribution: margin own-other-max(.2,.25m) for all frames
