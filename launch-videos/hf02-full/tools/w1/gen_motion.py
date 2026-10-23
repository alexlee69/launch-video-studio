# Writes motion/w1.js from the measured logs (tools/w1/logs) plus the hand-read sheet values documented in notes/w1.md.
import json, os, math
HERE = os.path.dirname(os.path.abspath(__file__)); LOG = os.path.join(HERE, 'logs')
def jl(p): return [json.loads(l) for l in open(os.path.join(LOG, p)) if l.strip().startswith('{')]
r4 = lambda v: round(v, 4)
M = {}
# ── opening camera: slow push 0.038 %/f about O, then the measured accelerating push (T1, zoomfit for the cut frames)
O = [546, 300]
cam = {n: r4(1 + 0.00038 * (n - 45)) for n in range(-2, 46, 4)}
for r in jl('T1_push.log'):
    if 46 <= r['n'] <= 73: cam[r['n']] = r4(r['s'])
zf = {r['n']: r for r in jl('zoomfit_ref.log')} if os.path.exists(os.path.join(LOG, 'zoomfit_ref.log')) else {}
for n in range(70, 75):
    if n in zf and zf[n]['ncc'] > 0.9: cam[n] = r4(zf[n]['s'])   # zoom + radial-blur fit (better than T1 on the cut frames)
cam[75] = 5.25          # landmark read (the join mark, n75) + the expo-in continuation (log-scale step x1.45); zoomfit failed (ncc .47)
cam[76] = 10.9          # same continuation; only blurred remnants of the lockup remain on n76
M['open'] = dict(O=O, cam=cam)
# lockup own offsets (frame px; icon centre minus the camera-mapped rest), blob tool n<=15, T2 tracker after
offX = {0: 160.7, 8: 160.6, 9: 159.5, 10: 156.5, 11: 152.7, 12: 145.85, 13: 134.1, 14: 112.9, 15: 74.7}
offY = {-2: 600, -1: 470, 0: 400, 1: 330, 2: 199.6, 3: 96.6, 4: 38.3, 5: 12.1, 6: 4.5, 7: 7.1, 8: 14.1, 9: 21.1, 10: 26.0, 11: 30.1, 12: 32.3, 13: 33.0}
for r in jl('T2_build.log'):
    n, s = r['n'], r['s']
    if n >= 16: offX[n] = round(r['tx'] - O[0] * (1 - s), 2)
    if n >= 15: offY[n] = round(r['ty'] - O[1] * (1 - s), 2)
for n in range(14, 29): offY[n] = 33.1 if n >= 14 else offY[n]
for n in range(23, 46): offX[n] = 0.0
for n in range(40, 46): offY[n] = 0.0
M['open'].update(offX=offX, offY=offY, textDelay=3.7)
# pops: one template P(t) (t = frames since start), per-slot start t0 (sub-frame, fitted on the first visible frame)
M['pop'] = {0: 0, 0.15: 0.09, 1.15: 0.63, 2.15: 1.0, 3.15: 1.17, 4.15: 1.2, 5.15: 1.1, 6.15: 1.04, 7.15: 0.99, 8.15: 0.95, 9.15: 0.97, 10.15: 0.99, 11.15: 1.0}
M['pulse'] = {-4: 1.0, -3: 1.02, -2: 1.09, -1: 1.19, 0: 1.26, 1: 1.21, 2: 1.13, 3: 1.05, 4: 1.0}
M['slots'] = {
    # t0 / popAmp: least-squares fit of the template to each character's blob width (tools/w1 notes); pulse = peak frame of the 'boing'
    'green': dict(t0=4.80, popAmp=1.06, pulse=16.2, pulseAmp=1.4), 'tri': dict(t0=6.32, popAmp=1.15, pulse=22.5, pulseAmp=1.0),
    'blue': dict(t0=8.85, popAmp=1.0, pulse=29.6, pulseAmp=1.0), 'sq': dict(t0=9.9, popAmp=1.0, pulse=24.0, pulseAmp=0.8),
    'orange': dict(t0=11.30, popAmp=1.10, pulse=27.4, pulseAmp=1.0), 'purple': dict(t0=15.09, popAmp=0.94, pulse=25.0, pulseAmp=0.96)}
conv = json.load(open(os.path.join(LOG, 'conv_paths.json')))
for k, v in conv.items():
    M['slots'][k]['conv'] = dict(along={int(n): a for n, a in v['along'].items() if int(n) >= 46}, perp={int(n): a for n, a in v['perp'].items() if int(n) >= 46},
                                 k={int(n): a for n, a in v['k'].items() if int(n) >= 56})
# second element: tile scale pop, tile own x offset (lags the slide), glyph pop, letter scatter times, separator fade
M['open'].update(tile={11.6: 0, 12: 0.11, 13: 0.47, 14: 0.9, 15: 1.11, 16: 1.08, 17: 1.01, 18: 0.99, 19: 1.0},
                 tileX={12: 0, 13: 1, 14: 4, 15: 7.6, 16: 5.8, 17: 4.1, 18: 3.15, 19: 1.65, 20: 1.3, 21: 1.0, 22: 0.44, 23: 0.2, 24: 0},
                 glyph={9.6: 0, 10: 0.35, 11: 0.8, 12: 1.0},
                 letters=[11.6, 10.8, 13.2, 12.2, 15.6, 14.3, 17.8, 20.6, 23.4, 25.6, 22.2, 28.2], letterLen=2.4,
                 sep=[17.4, 19.2],
                 shimmer=[19, 36],
                 tag=dict(type=[30.2, 36.0], tail=2.0, outline=[34.5, 39.2], pow=3, dot=[36, 38.5]))
# outro: no slide; icon drops from the top with a spring; text 2.5 f behind; tile slides in from the right
M['outro'] = dict(O=[539, 309], rate=0.0007, n0=1760,
                  offY={1696: -640, 1697: -450, 1698: -252, 1699: -82, 1700: 0.4, 1701: 27.8, 1702: 27.8, 1703: 19.3, 1704: 10.3, 1705: 3.7, 1706: 0.8, 1707: -0.2, 1708: 0},
                  textDelay=2.5, shift=1697,
                  tileX={1709: 17, 1710: 17, 1711: 4, 1712: 0.5, 1713: -4.6, 1714: -6.1, 1715: -5.8, 1716: -4.4, 1717: -3.4, 1718: -2.4, 1719: -1.5, 1720: -0.9, 1721: -0.5, 1723: 0},
                  tag=dict(type=[1698.6, 1716.0], tail=2.0, outline=[1706.8, 1715.5], pow=2, dot=[1716, 1718.5]),
                  spread=1.12)
# end card: black frame, 0.245 multiply overlay, 20 fps cadence, badge+handle group pop, colour cycle
M['end'] = dict(black=1787, start=1788, dim=0.755, origin=[540, 299],
                scale={1788: 0.986, 1789.5: 1.014, 1791: 1.057, 1792.5: 1.086, 1794: 1.10, 1795.5: 1.043, 1797: 0.90, 1798.5: 0.907, 1800: 0.929, 1801.5: 0.943, 1803: 1.0},
                handleAt=1794, colourIn=[1799.5, 1812], colourOut=[1862.5, 1875.5], spinDegPerFrame=4.1)   # linear ramps (fit to badge saturation)
# ── corridor (n76–96): flow rate k = v/(f·R) from tools/w1/tunnel.py (per frame pair, keyed at n+0.5); bad fits (ncc<.66) bridged
M['corr'] = dict(k={76: 0.00120, 77.5: 0.00125, 78.5: 0.00129, 79.5: 0.00166, 80.5: 0.00192, 81.5: 0.00293, 82.5: 0.00396, 83.5: 0.00440, 84.5: 0.00350,
                    85.5: 0.00289, 86.5: 0.00245, 87.5: 0.00203, 88.5: 0.00164, 89.5: 0.00164, 90.5: 0.00112, 91.5: 0.00130, 92.5: 0.00125,
                    93.5: 0.00128, 94.5: 0.00137, 95.5: 0.0020, 96.5: 0.0024},
                 vx={76: 537.5, 77.5: 537.0, 78.5: 536.2, 79.5: 536.7, 80.5: 532.7, 82: 531.5, 96: 531.0}, vy=304.0,
                 veil={75.5: 1.0, 76: 0.67, 77: 0.40, 78: 0.21, 79: 0.0}, endDepth94=800,
                 gain=1.09)   # our hall reads ~0.92x the input with the same tool (octagon vs their hall): v is scaled so the measured flow matches;
                              # k(83.5)/k(84.5) +5%/+4% over the raw fit: the tool under-reads our hall ~5% more on those two pairs (see notes)
# characters in the corridor: screen x, y and blob width per frame (n76–79 and the late frames read off zoomed crops; n80–94 blob tool / template tracker)
CH = {
 'green': {76: (518.5, 290, 23), 77: (517, 290, 28), 78: (515, 279, 37), 79: (512, 253, 45), 80: (509, 223, 53), 81: (506, 199, 64), 82: (506, 186, 74), 83: (507, 179, 80),
           84: (507, 174, 80), 85: (508, 169, 84), 86: (510, 166, 88), 87: (512, 162, 91), 88: (514, 158, 94), 89: (517, 153, 94), 90: (520, 148, 95), 91: (522, 144, 96),
           92: (526, 140, 97), 93: (532, 135, 99), 94: (540, 130, 102), 95: (557, 92, 127), 96: (612, -60, 205)},
 'blue': {76: (437, 297, 23), 77: (425, 313, 33), 78: (412, 330, 42), 79: (397, 346, 52), 80: (380, 362, 59), 81: (362, 378, 70), 82: (355, 384, 73), 83: (352, 387, 77),
          84: (347, 388, 79), 85: (342, 389, 81), 86: (337, 387, 83), 87: (332, 386, 97), 88: (328, 385, 104), 89: (326, 384, 106), 90: (324, 385, 108), 91: (324, 387, 110),
          92: (323, 388, 112), 93: (320, 388, 115), 94: (318, 386, 118), 95: (262, 404, 145), 96: (-40, 500, 300)},
 'orange': {76: (585, 269, 22), 77: (606, 269, 28), 78: (628, 271, 38), 79: (647, 272, 48), 80: (665, 276, 56), 81: (674, 289, 68), 82: (656, 313, 75), 83: (641, 331, 104),
            84: (633, 342, 116), 85: (628, 350, 120), 86: (626, 355, 122), 87: (626, 359, 126), 88: (629, 361, 127), 89: (632, 362, 130), 90: (639, 362, 132), 91: (646, 361, 137),
            92: (654, 361, 140), 93: (662, 362, 142), 94: (671, 364, 145), 95: (703, 390, 184), 96: (885, 520, 370)},
 'purple': {76: (473, 340, 18), 77: (473, 364, 26), 78: (483.5, 391, 32), 79: (493, 416, 40), 80: (501, 447, 48), 81: (507, 477, 55), 82: (510, 490, 61), 83: (512, 496, 61),
            84: (512, 502, 64), 85: (510, 507, 65), 86: (507, 511, 67), 87: (504, 515, 69), 88: (502, 518, 73), 89: (502, 522, 76), 90: (504, 525, 81), 91: (507, 528, 106),
            92: (508, 531, 114), 93: (507, 534, 117), 94: (501, 537, 121), 95: (470, 563, 152), 96: (430, 780, 300)},
 'tri': {76: (619, 327, 20), 77: (651, 341, 30), 78: (684, 355, 41), 79: (716, 356, 49), 80: (750, 343, 57), 81: (776, 319, 65), 82: (784, 301, 67), 83: (788, 291, 69),
         84: (794, 285, 72), 85: (800, 281, 74), 86: (806, 282, 76), 87: (812, 283, 79), 88: (820, 283, 79), 89: (828, 281, 82), 90: (840, 275, 87), 91: (846, 269, 115),
         92: (858, 261, 119), 93: (868, 251, 124), 94: (878, 243, 126), 95: (963, 206, 168), 96: (1250, 90, 330)},
 'sq': {76: (495, 222, 16), 77: (487, 202, 26), 78: (479, 182, 34), 79: (468, 164, 43.5), 80: (455, 150, 51), 81: (434, 136, 57), 82: (410, 133, 65), 83: (380, 140, 67),
        84: (350, 158, 69), 85: (333, 160, 71.5), 86: (320, 160, 73.5), 87: (312, 155, 80), 88: (304, 152, 115), 89: (300, 150, 120), 90: (296, 148, 123), 91: (292, 150, 125),
        92: (288, 150, 126), 93: (284, 150, 127), 94: (282, 148, 127), 95: (183, 92, 175), 96: (-150, -100, 330)},
}
# tri / sq: template tracker (tools/w1/tmpl.py, frames with ncc > .85) + zoomed-crop reads for the rest (logs/tmpl_*.log)
M['corr']['chars'] = {k: {n: [round(a, 1) for a in v] for n, v in sorted(t.items())} for k, t in CH.items()}
M['corr']['rot'] = -30     # our composition: every trajectory is rotated about the vanishing point (motion kept, layout changed)
open(os.path.join(HERE, '..', '..', 'motion', 'w1.js'), 'w').write("'use strict';\n// W1 measured motion (generated by tools/w1/gen_motion.py from tools/w1/logs; see notes/w1.md)\nwindow.MW1 = " + json.dumps(M, separators=(',', ':')) + ";\n")
print('wrote motion/w1.js', len(json.dumps(M)))
