# Print the measured curves from motion/w5.js as compact markdown for notes/w5.md
import json, os, math, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from fan import card_quad, rot
src = open(os.path.join(ROOT, 'motion', 'w5.js')).read(); M = json.loads(src[src.index('window.MW5 = ') + 13:].rstrip().rstrip(';'))
P = M['P']; rows = M['pose']['rows']; f0 = M['pose']['from']
def pose(n): return rows[n - f0]
def kv(tab, fmt='%.3g'): return ', '.join(('%s: ' + fmt) % (k, v) for k, v in sorted(tab.items(), key=lambda t: float(t[0])))
out = []
# 1. rise / shrink as 2D: centre, scale
out.append('### Rise and shrink, n999–1016 (flat card; 2D numbers derived from the pose rows)\n')
out.append('| n | card centre x, y (px) | scale | vy (px/f) | blur σx, σy (px) |\n|---|---|---|---|---|')
prev = None
for n in range(999, 1017):
    X, Y, Z = pose(n)[:3]; s = P / (P - Z); cx = 540 + X * s; cy = 304 + Y * s
    vy = '' if prev is None else '%.1f' % (cy - prev); prev = cy
    b = M['fanBlur']['rows'][n - f0]
    out.append('| %d | %.1f, %.1f | %.4f | %s | %.2f, %.2f |' % (n, cx, cy, s, vy, b[0], b[1]))
# 2. deck pose
out.append('\n### Deck pose, n1016–1137 (CSS: `perspective(%dpx) translate3d(X,Y,Z) rotateX rotateY rotateZ translateZ(-i·g)` on 11 frame-sized cards, origin = frame centre)\n' % P)
out.append('| n | X | Y | Z | rotX° | rotY° | rotZ° | spacing g | front-card centre (px) | front scale | blur σ |\n|---|---|---|---|---|---|---|---|---|---|---|')
sel = list(range(1016, 1052)) + list(range(1055, 1111, 5)) + list(range(1111, 1138))
for n in sel:
    p = pose(n); q = card_quad(p, 0, P); c = q.mean(axis=0); s = P / (P - p[2]); b = M['fanBlur']['rows'][n - f0]
    out.append('| %d | %.1f | %.1f | %.0f | %.2f | %.2f | %.2f | %.1f | %.1f, %.1f | %.3f | %.2f |' % (n, p[0], p[1], p[2], p[3], p[4], p[5], p[6], c[0], c[1], s, b[0]))
# 3. banner after the dive
out.append('\n### Banner (the dived-into card) n1138–1209: flat, scale %.4f; bottom edge y (px)\n' % (P / (P - pose(1150)[2])))
bl = []
for n in range(1136, 1210):
    p = pose(n); q = card_quad(p, 0, P); bl.append('%d: %.1f' % (n, q[2][1]))
out.append(', '.join(bl))
# 4. chat block
out.append('\n### Plan chat block top y (px), n1135–1209 (own curve: lags the banner in the pan, rigid with it from ~1157)\n')
out.append(kv(M['chatY'], '%.2f'))
out.append('\nchat blur σy (px): ' + kv({k: v for k, v in M['chatBlur'].items() if v > 0}, '%.2f'))
# 5. label layer
L = M['labLayer']
out.append('\n### Label layer (2D similarity about the frame centre 540,304): p = C + S·(q − C) + t, n1020–1130 (every 5th; dense in motion/w5.js labLayer)\n')
out.append('| n | tx | ty | S |\n|---|---|---|---|')
for i, r in enumerate(L['rows']):
    n = L['from'] + i
    if n % 5 == 0: out.append('| %d | %.2f | %.2f | %.4f |' % (n, r[0], r[1], r[2]))
out.append('\nlabel in/out (first visible frame at pop scale ≈0.2 → first frame gone): ' + '; '.join('L%d %d→%d' % (i, l['tin'], l['tout']) for i, l in enumerate(M['labels'])))
out.append('\npop scale by k = n − tin: ' + kv(M['popS'], '%.3f') + '\n\npop opacity: ' + kv(M['popO'], '%.2f') + '\n\npop blur (px): ' + kv(M['popB'], '%.2f'))
out.append('\nexit scale by k = tout − n: ' + kv(M['outS'], '%.3f') + '\n\nexit opacity: ' + kv(M['outO'], '%.2f') + '\n\nexit blur (px): ' + kv(M['outB'], '%.2f'))
# 6. caption, glow
out.append('\n### Caption\n\nreveal (centre-out, fraction of width): ' + kv(M['capReveal'], '%.2f') + '\n\nopacity: ' + kv(M['capOp'], '%.3f') + '\n\nblur (px): ' + kv(M['capBlur'], '%.2f'))
out.append('\n\nglow opacity: ' + kv(M['glow'], '%.2f'))
# 7. plan chat timings
for k, lab in (('planHead', 'headline type-on (fraction of row width, hard glyph reveal)'), ('planSub', 'sub-line stream (leading-edge fraction; >1 lets the short tail finish)'),
               ('planIcon', 'agent pop (scale, pivot = character centre)'), ('planNameWipe', 'name + chip wipe (L→R, soft edge 0.4)'), ('planNameOp', 'name + chip opacity'),
               ('planDocWipe', 'doc card wipe (L→R, edge 0.3)'), ('planDocOp', 'doc card opacity'), ('planShine', 'doc shimmer band position (0 = left edge, 1 = right edge)')):
    out.append('\n%s — %s: %s' % (k, lab, kv(M[k], '%.3f')))
# 8. build chat
for k, lab in (('buildTy', 'block y offset (px; block top = 190 + offset)'), ('buildBlur', 'block blur σy (px)'), ('buildHead', 'headline type-on fraction'), ('buildName', 'name + chip opacity'),
               ('buildL1', 'line 1 stream'), ('buildL2', 'line 2 stream'), ('buildAvPop', 'builder pop (scale × opacity ramp)'),
               ('fadeHead', 'end dissolve level, headline'), ('fadeName', 'end fade, name row'), ('fadeL1', 'end dissolve, line 1'), ('fadeL2', 'end dissolve, line 2')):
    out.append('\n%s — %s: %s' % (k, lab, kv(M[k], '%.2f')))
A = M['buildAv']
out.append('\n\nbuilder flight (centre x, y px; scale; blur σx, σy): ' + ', '.join('%d: (%.1f, %.1f, ×%.2f, %.1f, %.1f)' % (A['from'] + i, *r) for i, r in enumerate(A['rows']) if A['from'] + i >= 1243))
print('\n'.join(out))
