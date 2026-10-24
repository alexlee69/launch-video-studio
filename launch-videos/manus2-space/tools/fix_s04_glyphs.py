#!/usr/bin/env python3
"""S04 on the real footage (v0.2 review): the thought-glyph chain and the floating words were placed for the drawn
storyboard plate, so on the H3 plate several glyphs sat on her shoulder and the final film-frame glyph boxed the
station, not the sunrise. Re-anchor in the open space left of her (her body spans x ~570-1770 in 4A, ~810-1920 in 4B):
- glyph chain centred on (350, 420) at 1920x1080; the closing film-frame boxes the real sun (x ~300-330, y ~675-720
  from n512 on, measured on grid sheets of assets/footage-graded/S04.mp4);
- floating words in the band above it (y 110-265), checked against their +-150 px drift from each peak.
Edits beats.yaml in place (idempotent: refuses when the old text is gone)."""
import os, sys

P = os.path.expanduser('~/Downloads/launch-videos/manus2-space/beats.yaml')
REPL = [
    ('chain: [[384, frame, [600, 790, 390, 497]], [447, orbit, [520, 760, 300, 540]], [473, helmet, [540, 760, 320, 540]], [502, null], [503, flare, [450, 850, 250, 650]], [523, null], [566, frame, [470, 830, 348, 550]]]',
     'chain: [[384, frame, [230, 470, 333, 468]], [447, orbit, [230, 470, 300, 540]], [473, helmet, [240, 460, 310, 530]], [502, null], [503, flare, [200, 500, 270, 570]], [523, null], [566, frame, [135, 495, 589, 791]]]'),
    ('        box: [444, 871, 240, 631]\n', '        box: [135, 500, 270, 791]\n'),
    ('{words: Tonight?, n: 410, end: 441, peak: 423, drift: [11.2, -3.8], turn: 3, box: [330, 579, 150, 236]}',
     '{words: Tonight?, n: 410, end: 441, peak: 423, drift: [11.2, -3.8], turn: 3, box: [230, 479, 150, 236]}'),
    ('{words: From space?, n: 442, end: 473, peak: 452, drift: [11.2, -3.8], turn: -3, box: [140, 513, 300, 385]}',
     '{words: From space?, n: 442, end: 473, peak: 452, drift: [11.2, -3.8], turn: -3, box: [180, 553, 150, 236]}'),
]
t = open(P, encoding='utf-8').read()
for old, new in REPL:
    if new in t:
        continue
    if t.count(old) != 1:
        sys.exit('refused: expected exactly one of %r' % old[:60])
    t = t.replace(old, new)
open(P, 'w', encoding='utf-8').write(t)
print('S04 glyphs and words re-anchored')
