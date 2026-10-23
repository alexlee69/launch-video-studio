# Build motion/w2.js from the measured logs in tools/w2/logs (reference measurements only).
import json, math, os
L = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
def jl(name):
    out = []
    for line in open(os.path.join(L, name)):
        line = line.strip()
        if line.startswith('{'): out.append(json.loads(line))
    return out
def comp(A, B):   # B after A: x -> sB*(sA x + tA) + tB
    sA, ax, ay = A; sB, bx, by = B
    return (sB * sA, sB * ax + bx, sB * ay + by)
def inv(A):
    s, x, y = A; return (1 / s, -x / s, -y / s)
R = lambda v, k=4: round(v, k)
M = {}
# ───── plate 1 ─────
# card scale about (540,304) (margins.py, n96–111; n95 read by eye on a zoomed crop; n111+ = 1)
card_s = {95: 0.051, 96: 0.3588, 97: 0.4991, 98: 0.6034, 99: 0.684, 100: 0.7487, 101: 0.8012, 102: 0.844, 103: 0.8793, 104: 0.9089,
          105: 0.9332, 106: 0.9526, 107: 0.9687, 108: 0.9808, 109: 0.9899, 110: 0.9963, 111: 1.0}
# on-screen corner radius, calibrated like-for-like: the corner diagonal (corner.py: half-way crossing along the diagonal from the
# bbox corner, median of the 4 corners) of the reference vs our flat-plate QA render (tools/w2/render_qa.mjs → out/w2/qa0), one
# iterations of r_new = r_old · d_ref / d_ours. Reference d: n97 5.4 · 98 5.5 · 99 5.5 · 100 5.0 · 101 4.3 · 102 3.4 · 103 2.5 · 104 1.95 ·
# 105 1.4 · 106 0.9 · 107 0.85 · 108 0.65 · 109 0.6 · 110 0.45 px. n95–96: too small/blurred to read (kept proportional).
card_r = {95: 0.5, 96: 5.0, 97: 6.7, 98: 9.3, 99: 10.9, 100: 10.2, 101: 9.3, 102: 7.3, 103: 5.2, 104: 3.8, 105: 2.4, 106: 1.2, 107: 1.5,
          108: 1.4, 109: 1.1, 110: 0.8, 111: 0.0}
# on-screen card blur σ (corner.py sigL, minus the 0.55 px content baseline in quadrature); n95/96 from the zoomed crop
sigL = {95: 3.0, 96: 11.0, 97: 8.51, 98: 5.9, 99: 4.65, 100: 3.73, 101: 2.99, 102: 2.55, 103: 2.22, 104: 1.77, 105: 1.41, 106: 1.41, 107: 0.93, 108: 0.69, 109: 0.56, 110: 0.55}
# ×1.12: one like-for-like iteration on the flat QA render (card.py sl, ours read 0.89 of the reference across n97–110)
card_b = {n: R(1.12 * math.sqrt(max(0.0, v * v - 0.55 ** 2)), 2) for n, v in sigL.items()}; card_b[111] = 0.0
# the growth blur is a zoom blur: horizontal edges (top/bottom, which move 304/540 as fast) blur less. card.py st/sb on the reference
# (mean of the two, minus a 0.7 px baseline): σy; n95–96 at the same 0.56 ratio
st_sb = {97: (5.76, 4.67), 98: (4.28, 3.64), 99: (3.3, 2.83), 100: (2.75, 2.29), 101: (2.3, 1.97), 102: (1.96, 1.59), 103: (1.72, 1.45), 104: (1.56, 1.15),
         105: (1.3, 1.04), 106: (1.11, 0.78), 107: (1.03, 0.7), 108: (0.98, 0.67), 109: (0.84, 0.71)}
card_by = {n: R(1.06 * math.sqrt(max(0.0, ((a + b) / 2) ** 2 - 0.7 ** 2)), 2) for n, (a, b) in st_sb.items()}   # ×1.06: same iteration
card_by.update({95: R(card_b[95] * 0.56, 2), 96: R(card_b[96] * 0.56, 2), 110: 0.2, 111: 0.0})
# picture camera T(n) relative to the n112 key (total, including the card) from the pairwise chains
T = {}
c = jl('p1_pair_c.log')                       # n99..112, cumulative relative to n99
C112 = next((r['s'], r['tx'], r['ty']) for r in c if r['n'] == 112)
for r in c: T[r['n']] = comp(inv(C112), (r['s'], r['tx'], r['ty']))
a = jl('p1_pair_a.log')                       # n112..230 relative to n112
for r in a: T[r['n']] = (r['s'], r['tx'], r['ty'])
b = jl('p1_pair_b2.log')                      # n228..263 relative to n228
A228 = T[228]
for r in b:
    if r['n'] > 228: T[r['n']] = comp(A228, (r['s'], r['tx'], r['ty']))
# footage camera inside the card: F = C^-1 ∘ T, C = scale c about (540,304)
F = {}
for n, (s, tx, ty) in T.items():
    cs = card_s.get(n, 1.0) if n <= 111 else 1.0
    F[n] = (s / cs, (tx - 540 * (1 - cs)) / cs, (ty - 304 * (1 - cs)) / cs)
# before n99 the picture inside the card is unmeasured (card < 0.68, blurred): continue n99→n100's velocity backwards
s99, x99, y99 = F[99]; s100, x100, y100 = F[100]
for n in (95, 96, 97, 98):
    k = 99 - n
    F[n] = (s99 * (s99 / s100) ** k, x99 + (x99 - x100) * k, y99 + (y99 - y100) * k)
M['p1'] = {
    'card': {'s': card_s, 'r': card_r, 'blur': card_b, 'blurY': card_by},
    'cam': {'s': {n: R(F[n][0], 5) for n in sorted(F)}, 'tx': {n: R(F[n][1], 2) for n in sorted(F)}, 'ty': {n: R(F[n][2], 2) for n in sorted(F)}},
}
# prompt bar: top edge offset from rest (vedge.py; rest top = 373.6 on the reference), vertical blur σ (minus 0.45 baseline)
bar_top = {123: 561.7, 124: 561.7, 125: 497.2, 126: 430.6, 127: 394.1, 128: 377.7, 129: 372.6, 130: 362.5, 131: 361.3, 132: 365.2, 133: 369.8,
           134: 373.1, 135: 374.6, 136: 374.8, 137: 374.2, 138: 373.6, 222: 373.6, 223: 372.6, 224: 366.9, 225: 353.4, 226: 343.3, 227: 339.9,
           228: 339.3, 229: 349.8, 230: 390.1, 231: 472.6, 232: 547.5, 233: 588.9, 234: 640.0}
bar_sig = {123: 6.67, 124: 6.65, 125: 8.41, 126: 6.15, 127: 2.91, 128: 1.15, 129: 1.15, 130: 0.82, 131: 0.56, 132: 0.67, 133: 0.61, 134: 0.5,
           135: 0.45, 222: 0.45, 223: 0.6, 224: 1.33, 225: 2.72, 226: 1.15, 227: 0.65, 228: 0.73, 229: 4.02, 230: 9.62, 231: 13.12, 232: 8.3, 233: 4.54, 234: 3.0}
M['p1']['bar'] = {'dy': {n: R(v - 373.6, 2) for n, v in bar_top.items()},
                  'sig': {n: R(math.sqrt(max(0.0, v * v - 0.45 ** 2)), 2) for n, v in bar_sig.items()}}
# type-on: cumulative visible characters of the reference per frame (two bursts), read from per-frame crops
M['p1']['typeRef'] = {'b1': {131: 0, 132: 2, 133: 4, 134: 7, 135: 9, 136: 12, 137: 14, 138: 17, 139: 19, 140: 20},
                      'b2': {169: 0, 170: 3, 171: 5, 172: 7, 173: 8, 174: 10, 175: 12, 176: 14, 177: 16, 178: 18}}
# send button scale (dark-disc diameter / 57.2)
d = {198: 56.8, 199: 57.1, 200: 57.2, 201: 56.7, 202: 55.0, 203: 49.6, 204: 39.1, 205: 33.7, 206: 35.0, 207: 35.4, 208: 36.8, 209: 41.7, 210: 52.3,
     211: 56.4, 212: 57.2}
M['p1']['btn'] = {n: R(min(1.0, v / 57.2), 3) for n, v in d.items() if n >= 201}
M['p1']['btn'][201] = 1.0
# like-for-like correction: the same dark-disc measure on our flat QA render read shallower (our sweep veils less of the disc);
# one iteration of applied·(ref/ours): measured ours n203–210 = .886 .738 .668 .688 .694 .711 .781 .925
ours_meas = {203: 0.886, 204: 0.738, 205: 0.668, 206: 0.688, 207: 0.694, 208: 0.711, 209: 0.781, 210: 0.925}
for n, v in ours_meas.items(): M['p1']['btn'][n] = R(M['p1']['btn'][n] * M['p1']['btn'][n] / v, 3)
# sweep: centroid offset from the button centre (752.3), 25% band width, strength (max / 100)
sw = [(204, 739.2, 765, 785, 4.4), (205, 746.9, 717, 785, 16.3), (206, 744.0, 703, 797, 31.7), (207, 739.4, 686, 798, 63.3),
      (208, 698.1, 649, 797, 72.6), (209, 666.8, 609, 718, 96.3), (210, 631.7, 576, 678, 100.2), (211, 559.7, 498, 611, 96.6),
      (212, 531.6, 451, 595, 95.6), (213, 519.7, 436, 576, 89.9), (214, 507.1, 425, 558, 80.9), (215, 496.7, 417, 549, 63.2),
      (216, 494.5, 415, 546, 54.1), (217, 495.5, 410, 553, 36.5), (218, 496.7, 397, 557, 16.9), (219, 498.6, 399, 527, 10.5), (220, 498.6, 399, 527, 5.4), (221, 498.6, 399, 527, 0.0)]
M['p1']['sweep'] = {'dx': {r[0]: R(r[1] - 752.3, 1) for r in sw}, 'w': {r[0]: r[3] - r[2] for r in sw}, 'a': {r[0]: R(min(1.0, r[4] / 100.2), 3) for r in sw}}
M['p1']['sweep']['a'][203] = 0.0
# ───── plate 2 ─────
top = {1529: 596.75, 1530: 497.0, 1531: 282.25, 1532: 217.75}
for r in jl('p2_cardbox.jsonl'):
    if r['n'] <= 1544: top[r['n']] = r['t']
cs2 = {1529: 0.701, 1530: 0.701}
cb2 = {}
for r in jl('p2_cardbox.jsonl'): cs2[r['n']] = r['s']
cs2[1531] = 0.701; cs2[1532] = 0.701; cs2[1553] = 1.0
cy2 = {}
for n in range(1529, 1554):
    s = cs2[n]
    if n in top and n <= 1544: cy2[n] = top[n] + 304 * s
    else: cy2[n] = 303.5
dy2 = {n: R(v - 304, 2) for n, v in cy2.items()}
# radius r ≈ 60 (1 − s) px on screen (corner2.py fit), blur σ ≈ 0.15 × edge speed (st/sl from card.py)
# on-screen corner radius, calibrated like-for-like on the flat QA render (out/w2/qa3): corner2.py diagonal, r_new = r_old · d_ref / d_ours
# from a first guess r = 60 (1 − s). Reference d (median; bottom corners once the top is cut): n1533–1541 ≈ 7.7–8.2, 1542 7.8, 1543 7.25,
# 1544 6.4, 1546 6.65, 1547 5.15, 1548 3.45, 1549 2.55, 1550 1.7, 1551 1.05, 1552 0.85 px
r2 = {1529: 18.2, 1530: 18.2, 1531: 18.2, 1532: 18.2, 1533: 18.2, 1534: 18.3, 1535: 19.1, 1536: 19.3, 1537: 19.3, 1538: 19.5, 1539: 19.3, 1540: 19.4,
      1541: 19.35, 1542: 18.75, 1543: 17.0, 1544: 14.5, 1545: 12.4, 1546: 11.9, 1547: 9.8, 1548: 7.9, 1549: 5.3, 1550: 3.8, 1551: 2.25, 1552: 1.5, 1553: 0.0}
sig2 = {1529: 7.9, 1530: 27.0, 1531: 13.2, 1532: 7.1, 1533: 4.43, 1534: 3.09, 1535: 2.22, 1536: 1.67, 1537: 1.34, 1538: 1.07, 1539: 0.89, 1540: 0.8, 1541: 0.87,
        1542: 1.12, 1543: 1.74, 1544: 2.9, 1545: 3.9, 1546: 4.1, 1547: 2.52, 1548: 1.85, 1549: 1.37, 1550: 1.05, 1551: 0.78, 1552: 0.68, 1553: 0.55}
sigb2 = {n: R(math.sqrt(max(0.0, v * v - 0.55 ** 2)), 2) for n, v in sig2.items()}
# anisotropic: σx from the vertical edges (card.py sl), σy from the horizontal edges (st while rising, sb while growing), both minus 0.55
sl2 = {1531: 0.61, 1532: 0.65, 1533: 0.69, 1534: 0.7, 1535: 0.82, 1536: 0.93, 1537: 0.9, 1538: 0.85, 1539: 0.83, 1540: 0.66, 1541: 0.87, 1542: 1.37,
       1543: 2.17, 1544: 4.57, 1545: 4.69, 1546: 5.71, 1547: 2.52, 1548: 1.92, 1549: 1.32, 1550: 0.97, 1551: 0.81, 1552: 0.55}
sb2 = {1541: 0.64, 1542: 0.64, 1543: 1.11, 1544: 1.79, 1545: 2.37, 1546: 2.29, 1547: 1.69, 1548: 1.23, 1549: 1.0, 1550: 0.78, 1551: 0.55, 1552: 0.55}
q = lambda v: R(math.sqrt(max(0.0, v * v - 0.55 ** 2)), 2)
bx2 = {1529: 0.3, 1530: 0.3}; bx2.update({n: q(v) for n, v in sl2.items()}); bx2[1553] = 0.0
by2 = {n: sigb2[n] for n in range(1529, 1541)}; by2.update({n: q(v) for n, v in sb2.items()}); by2[1553] = 0.0
# picture camera: pairwise chain from n1553, card-interior key fit for n1541..1552, held before
T2 = {}
for r in jl('p2_pair.log'): T2[r['n']] = (r['s'], r['tx'], r['ty'])
A1615 = T2[1615]
for r in jl('p2_pair_b.log'):
    if r['n'] > 1615: T2[r['n']] = comp(A1615, (r['s'], r['tx'], r['ty']))
F2 = {}
for n, (s, tx, ty) in T2.items(): F2[n] = (s, tx, ty)
for r in jl('p2_card.log'):
    n = r['n']
    if n < 1541 or n >= 1553: continue
    cs = cs2[n]; dyy = cy2[n] - 304
    F2[n] = (r['s'] / cs, (r['tx'] - 540 * (1 - cs)) / cs, (r['ty'] - 304 * (1 - cs) - dyy) / cs)
# the card-interior fit (ncc 0.77–0.92 while the card grows) jitters ±3 px/f; smooth n1542–1552 with a 1-4-6-4-1 kernel (ends held)
raw = {n: F2[n] for n in range(1539, 1556) if n in F2}
for n in range(1542, 1553):
    w = [(n + k, c) for k, c in ((-2, 1), (-1, 4), (0, 6), (1, 4), (2, 1)) if 1541 <= n + k <= 1553]
    W = sum(c for _, c in w)
    F2[n] = tuple(sum(raw[m][i] * c for m, c in w) / W for i in range(3))
for n in range(1529, 1541): F2[n] = F2[1541]
M['p2'] = {'card': {'s': cs2, 'dy': dy2, 'r': r2, 'blurX': bx2, 'blurY': by2},
           'cam': {'s': {n: R(F2[n][0], 5) for n in sorted(F2)}, 'tx': {n: R(F2[n][1], 2) for n in sorted(F2)}, 'ty': {n: R(F2[n][2], 2) for n in sorted(F2)}}}
# bubble: top-edge offset from its n1595 rest (vedge + bar.py), vertical blur (minus the 1.35 px pill-edge baseline)
btop = {1590: 588.9, 1591: 469.3, 1592: 420.2, 1593: 396.2, 1594: 384.4, 1595: 380.1}
for line in open(os.path.join(L, 'bubble_bar.txt')):
    p = line.split()
    n = int(p[0]); t = float(p[3])
    if n >= 1596: btop[n] = t
bsig = {1590: 17.8, 1591: 13.54, 1592: 7.16, 1593: 4.26, 1594: 2.64, 1595: 1.39, 1596: 1.35}
M['p2']['bubble'] = {'dy': {n: R(v - 380.1, 2) for n, v in btop.items()},
                     'sig': {n: R(math.sqrt(max(0.0, v * v - 1.35 ** 2)), 2) for n, v in bsig.items()},
                     'op': {1589: 0.0, 1590: 0.66, 1591: 1.0}}
# ───── carousel ─────
X = {}; x = 501.7
for r in jl('car_pcorr.txt'):
    n = r['n']
    if n > 1629: x += r['dx'] if n <= 1695 else 0.0
    X[n] = R(x, 1)
# the drop: cumulative frame-to-frame dy (phase correlation) from n1679; the row holds its height before (top edge flat at 38.9)
Y = {}; y = 0.0
for r in jl('car_pcorr.txt'):
    n = r['n']
    if n >= 1679: y += r['dy']
    Y[n] = R(y, 2)
M['car'] = {'x': X, 'y': Y}
js = "'use strict';\n// W2 measured motion (reference frames; 1080×608 px, 30 fps). Built by tools/w2/build_motion.py from tools/w2/logs.\nwindow.MW2 = " + json.dumps(M, separators=(',', ':')) + ";\n"
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'motion', 'w2.js'), 'w').write(js)
print('wrote motion/w2.js', len(js), 'bytes')
