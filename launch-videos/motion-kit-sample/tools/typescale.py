# -*- coding: utf-8 -*-
"""Per shot: the largest must-read text size on screen (audit px) and its share of the frame height, per aspect."""
import json, os, sys
J = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
H = {'16x9': 1080, '9x16': 1920, '1x1': 1080}
for a in ('16x9', '9x16', '1x1'):
    p = os.path.join(J, 'out', 'main', a, 'audits.json')
    if not os.path.exists(p):
        continue
    rows = []
    for au in json.load(open(p, encoding='utf-8')):
        bx = [b for b in au['boxes'] if not b.get('ui')]
        if not bx:
            continue
        big = max(bx, key=lambda b: b['px']); small = min(bx, key=lambda b: b['px'])
        rows.append(f"{au['shot']}: {big['text'][:22]!r} {big['px']:.0f}px ({100 * big['px'] / H[a]:.1f}%)" + (f", smallest {small['text'][:14]!r} {small['px']:.0f}px" if small is not big else ''))
    print(a, '·', '; '.join(rows))
