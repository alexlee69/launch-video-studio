# Assemble every W5 measurement into motion/w5.js (window.MW5). Sources are the logs in tools/w5/logs (see notes/w5.md).
import json, math, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); LG = os.path.join(HERE, 'logs'); ROOT = os.path.dirname(os.path.dirname(HERE))
P = 2060.0
J = lambda f: json.load(open(os.path.join(LG, f)))
byn = lambda rows: {r['n']: r for r in rows}

# ───────── 1. card-stack pose, n999–1209: [X, Y, Z, ax, ay, az, g] ─────────
EA = byn(J('ref_edges_A.json')); EDE = byn(J('ref_edges_DE.json'))
pose = {}
def flat(s, cx, cy): return [(cx - 540) / s, (cy - 304) / s, P * (1 - 1 / s), 0.0, 0.0, 0.0, 0.0]
# rise 999–1012: top edge from the edge log (999 = hypothesised: n999 duplicates n1000 in the source), card ≈ frame-sized
top = {999: 600.0, 1000: 574.07}
for n in range(1001, 1013): top[n] = EA[n]['top']
erf_top = {1003: 224.96, 1004: 158.79, 1005: 114.17, 1006: 81.75, 1007: 58.07, 1008: 40.23, 1009: 27.03, 1010: 17.03, 1011: 9.85, 1012: 9.79}
top.update(erf_top)
s_meas = {n: (EA[n]['right'] - EA[n]['left']) / 1080 for n in range(1008, 1016)}
s_back = {}
ds = s_meas[1009] - s_meas[1008]; s = s_meas[1008]
for n in range(1007, 998, -1):
    ds /= 1.46; s -= ds; s_back[n] = s
for n in range(999, 1016):
    sc = s_meas.get(n, s_back.get(n))
    if n <= 1011: cx, cy = 540.0 if n < 1008 else (EA[n]['left'] + EA[n]['right']) / 2, top[n] + sc * 304
    else: cx, cy = (EA[n]['left'] + EA[n]['right']) / 2, (EA[n]['top'] + EA[n]['bot']) / 2
    pose[n] = flat(sc, cx, cy)
# 1016–1042: front card aligned to the flat key n1013 (content A); 1043–1137: aligned to key n1137 (content B)
HA = byn(J('homo_open.json')); HB = byn(J('homo_mid.json')); HB.update(byn(J('homo_zoom.json')))
key = lambda r: [r['X'], r['Y'], r['Z'], r['ax'], r['ay'], r['az']]
for n in range(1016, 1043): pose[n] = key(HA[n]) + [0.0]
for n in range(1043, 1138): pose[n] = key(HB[n]) + [0.0]
pose[1016] = [(a + b) / 2 for a, b in zip(flat((EA[1016]['right'] - EA[1016]['left']) / 1080, (EA[1016]['left'] + EA[1016]['right']) / 2, (EA[1016]['top'] + EA[1016]['bot']) / 2), pose[1016])]
# A/B junction: the two alignments disagree by a few px; cross-fade linear extrapolations of each over 1038–1047
A_tr = np.array([pose[n][:6] for n in range(1038, 1043)]); B_tr = np.array([pose[n][:6] for n in range(1043, 1048)])
fa = np.polyfit(np.arange(1038, 1043), A_tr, 1); fb = np.polyfit(np.arange(1043, 1048), B_tr, 1)
for n in range(1038, 1048):
    a = fa[0] * n + fa[1] if n > 1042 else np.array(pose[n][:6]); b = fb[0] * n + fb[1] if n < 1043 else np.array(pose[n][:6])
    t = (n - 1037.5) / 10.0; w = t * t * (3 - 2 * t)
    pose[n] = list((1 - w) * a + w * b) + [0.0]
# spacing g: fitted per frame with the front pose held (11 cards); smoothed
G = {}
for f in ('g11_open.json', 'g11_mid.json', 'g11_zoom.json', 'g11_zoom2.json'):
    for r in J(f): G[r['n']] = r['g']
for n in range(999, 1017): G[n] = 0.0
G[1017] = 5.0; G[1018] = 11.0
for n in range(1134, 1138): G[n] = 0.0
gn = np.array([G[n] for n in range(999, 1138)])
gs = gn.copy()
for i in range(len(gn)):                       # 5-frame running mean, except across the collapse start
    n = 999 + i
    if 1019 <= n <= 1132: gs[i] = gn[max(0, i - 2):i + 3].mean()
for i, n in enumerate(range(999, 1138)): pose[n][6] = float(gs[i])
# light smoothing of the stable fan (1045–1112) per parameter: local quadratic over ±4 frames
idx = list(range(1045, 1113))
arr = np.array([pose[n][:6] for n in range(1037, 1121)])
for n in idx:
    i = n - 1037; win = np.arange(max(0, i - 4), min(len(arr), i + 5)); x = win - i
    for k in range(6): pose[n][k] = float(np.polyval(np.polyfit(x, arr[win, k], 2), 0))
# 1138–1209: the banner card, flat at the n1137 scale; its bottom edge follows the measured pan, drift and exit
s37 = 2060 / (2060 + 212.7); X37 = HB[1137]['X']; Z37 = HB[1137]['Z']
bot = {1136: 573.05, 1137: 569.46, 1138: 561.43, 1139: 547.78, 1140: 526.48, 1141: 491.28, 1142: 441.42, 1143: 396.78, 1144: 353.36, 1145: 314.22,
       1146: 281.56, 1147: 255.47, 1148: 234.78, 1149: 218.29, 1150: 205.11, 1151: 194.31, 1152: 185.49, 1153: 178.19, 1154: 172.26, 1155: 167.46,
       1156: 163.44, 1157: 160.48, 1158: 158.05, 1159: 156.44, 1160: 155.34}
for n in range(1161, 1193): bot[n] = EDE[n]['bot'] + (155.34 - EDE[1160]['bot'])
EX = byn([json.loads(l) for l in open(os.path.join(LG, 'ref_trk_exit.log'))])
for n in range(1193, 1210): bot[n] = bot[1192] + EX[n]['ty']
# the banner's scale and centre from its measured side edges: the dive still grows it 1137→1139, then it holds
sx = {1138: (0.91139, 539.10)}
for n in range(1139, 1210): sx[n] = (0.9128, 539.6)
for n in range(1138, 1210):
    s_, cx_ = sx[n]; cy = bot[n] - s_ * 304
    pose[n] = [(cx_ - 540) / s_, (cy - 304) / s_, P * (1 - 1 / s_), 0.0, 0.0, 0.0, 0.0]
ROWS = [[round(v, 3) for v in pose[n]] for n in range(999, 1210)]

# ───────── 2. blur of the card layer [sx, sy] (frame px), measured edge sigmas less ~0.5 px source softness ─────────
q = lambda s: math.sqrt(max(0.0, s * s - 0.25))
fb = {999: (0, 3), 1000: (0, 8), 1001: (0, 18), 1002: (0, 20), 1003: (0, 9.5), 1004: (0, 6.4), 1005: (0, 4.7), 1006: (0, 3.4), 1007: (0, 2.6), 1008: (0, 1.8),
      1009: (0, 1.4), 1010: (0, 1.0), 1011: (0, 0.8), 1012: (0, 0), 1013: (0, 0), 1014: (10, 7), 1015: (3.4, 1.7),
      1138: (0, 1.5), 1139: (0, 2.5), 1140: (0, 3.9), 1141: (0, 7.2), 1142: (0, 7.1), 1143: (0, 7.0), 1144: (0, 6.2), 1145: (0, 5.4), 1146: (0, 4.4), 1147: (0, 3.4),
      1148: (0, 2.7), 1149: (0, 2.1), 1150: (0, 1.7), 1151: (0, 1.4), 1152: (0, 1.2), 1153: (0, 1.0), 1154: (0, 0.8), 1155: (0, 0.7), 1156: (0, 0.6), 1157: (0, 0),
      1193: (0, 0), 1199: (0, 0.6), 1202: (0, 0.9), 1204: (0, 1.2), 1206: (0, 1.8), 1207: (0, 2.2), 1208: (0, 2.7), 1209: (0, 5.5)}
fb = {k: (q(v[0]), q(v[1])) for k, v in fb.items()}
# the deck's softness (defocus + motion), set so that OUR render's front-card edge sigma reads like the reference's
# (calibrated with tools/w5/blurtest.mjs + edgesig.py on the same band; applied values, no source-softness term)
for k, v in {1016: 1.85, 1017: 2.3, 1018: 2.72, 1019: 3.5, 1020: 4.28, 1021: 5.3, 1022: 6.34, 1024: 5.4, 1026: 4.48, 1028: 4.1, 1030: 3.8, 1035: 3.4,
             1040: 3.2, 1060: 3.3, 1080: 3.35, 1100: 3.5, 1120: 3.5, 1122: 4.2, 1124: 4.8, 1126: 4.84, 1128: 5.6, 1130: 6.28, 1132: 5.2, 1134: 3.1,
             1135: 2.1, 1136: 1.3, 1137: 1.0}.items():
    fb[k] = (v, v)
ks = sorted(fb)
FB = []
for n in range(999, 1210):
    if n in fb: v = fb[n]
    else:
        a = max(k for k in ks if k < n); b = min(k for k in ks if k > n); t = (n - a) / (b - a)
        v = tuple(fb[a][i] + (fb[b][i] - fb[a][i]) * t for i in range(2))
    FB.append([round(v[0], 2), round(v[1], 2)])
# the plan chat rides its own curve (it lags the banner during the pan, then moves rigidly with it):
# headline-row offset vs n1170 (tools/w5/headrow.py), our headline cap-top sits 51.3 px below the block top
HR = {r['n']: r['off'] for r in J('ref_headrow.json')}
HR[1137] = 333.8; HR[1136] = 335.3; HR[1135] = 335.8
chatY = {n: round(251.0 + HR[n] - 51.3, 2) for n in range(1135, 1210)}
chatBlur = {}
for n in range(1136, 1210):
    v = (chatY[n + 1] - chatY[n - 1]) / 2 if n + 1 in chatY else chatY[n] - chatY[n - 1]
    k = 0.15 if n < 1190 else 0.25                 # the exit whip reads blurrier (tracker calibration on our render)
    chatBlur[n] = round(q(k * abs(v)), 2) if abs(v) > 3 else 0.0
for n in range(1193, 1210): FB[n - 999] = [0.0, chatBlur[n]]   # the banner whips out with the chat

# ───────── 3. labels: the measured label layer (2D drift + scale), pop / exit curves ─────────
LL = {int(k): v for k, v in J('label_layer.json').items()}
ln = sorted(LL)
a0, a1 = 1037, 1045; b0, b1 = 1100, 1114
for n in range(1020, a0):                     # extrapolate the layer before the first steady label
    t = n - a0; LL[n] = [LL[a0][0] + t * (LL[a1][0] - LL[a0][0]) / (a1 - a0), LL[a0][1] + t * (LL[a1][1] - LL[a0][1]) / (a1 - a0), LL[a0][2]]
for n in range(b1 + 1, 1131):
    t = n - b1; LL[n] = [LL[b1][0] + t * (LL[b1][0] - LL[b0][0]) / (b1 - b0), LL[b1][1] + t * (LL[b1][1] - LL[b0][1]) / (b1 - b0), LL[b1][2] + t * (LL[b1][2] - LL[b0][2]) / (b1 - b0)]
LAYER = {'from': 1020, 'rows': [[round(v, 3) for v in LL[n]] for n in range(1020, 1131)]}
LABELS = [{'tin': 1027, 'tout': 1065}, {'tin': 1029, 'tout': 1085}, {'tin': 1032, 'tout': 1075}, {'tin': 1036, 'tout': 1098},
          {'tin': 1043, 'tout': 1112}, {'tin': 1056, 'tout': 1119}, {'tin': 1062, 'tout': 1125}]
popS = {-1: 0.06, 0: 0.14, 1: 0.33, 2: 0.55, 3: 0.72, 4: 0.83, 5: 0.90, 6: 0.945, 7: 0.98, 8: 0.995, 9: 1.0, 12: 1.0}   # tuned so our render reads like the reference
popO = {-1: 0.3, 0: 0.8, 1: 1.0, 12: 1.0}
popB = {-1: 1.2, 0: 1.0, 1: 0.9, 2: 0.8, 3: 0.6, 4: 0.45, 5: 0.3, 6: 0.15, 7: 0.0, 12: 0.0}
outS = {0: 0.0, 1: 0.12, 2: 0.21, 3: 0.42, 4: 0.64, 5: 0.77, 6: 0.865, 7: 0.93, 8: 0.97, 9: 0.99, 10: 1.0, 14: 1.0}
outO = {0: 0.0, 1: 0.6, 2: 0.9, 3: 1.0, 14: 1.0}
outB = {0: 0.9, 1: 0.9, 2: 1.0, 3: 0.8, 4: 0.6, 5: 0.4, 6: 0.2, 7: 0.0, 14: 0.0}

# ───────── 4. caption, glow ─────────
capReveal = {1015: 0, 1016: 0.36, 1017: 0.54, 1018: 0.75, 1019: 0.91, 1020: 1.0}
capOp = {1015: 0, 1016: 0.03, 1017: 0.08, 1018: 0.17, 1019: 0.27, 1020: 0.42, 1021: 0.575, 1022: 0.67, 1023: 0.75, 1024: 0.83, 1025: 0.87, 1026: 0.91,
         1027: 0.94, 1028: 0.96, 1030: 0.98, 1034: 1.0, 1124: 1.0, 1125: 0.96, 1126: 0.94, 1127: 0.88, 1128: 0.85, 1129: 0.78, 1130: 0.71, 1131: 0.64,
         1132: 0.53, 1133: 0.48, 1134: 0.3, 1135: 0.0}
capBlur = {1015: 3.2, 1016: 3.0, 1017: 2.5, 1018: 2.0, 1019: 1.4, 1020: 0.8, 1021: 0.4, 1022: 0.0}
glow = {1020: 0, 1024: 0.1, 1028: 0.4, 1032: 0.7, 1036: 0.9, 1040: 1.0, 1050: 1.0, 1060: 0.9, 1080: 0.75, 1100: 0.5, 1110: 0.4, 1116: 0.45, 1120: 0.6,
        1126: 0.5, 1130: 0.3, 1134: 0.0}

# ───────── 5. plan chat ─────────
planHead = {1135: 0.0, 1136: 0.035, 1137: 0.07, 1138: 0.11, 1139: 0.14, 1140: 0.21, 1141: 0.25, 1142: 0.27, 1143: 0.32, 1144: 0.32, 1145: 0.39, 1146: 0.41,
            1147: 0.45, 1148: 0.50, 1149: 0.55, 1150: 0.58, 1151: 0.60, 1152: 0.64, 1153: 0.67, 1154: 0.67, 1155: 0.71, 1156: 0.75, 1157: 0.75, 1158: 0.75,
            1159: 0.81, 1160: 0.85, 1161: 0.89, 1162: 0.94, 1163: 0.98, 1164: 1.0}
planSub = {1142: 0.0, 1143: 0.11, 1144: 0.15, 1145: 0.18, 1146: 0.21, 1147: 0.21, 1148: 0.28, 1149: 0.32, 1150: 0.38, 1151: 0.41, 1152: 0.42, 1153: 0.46,
           1154: 0.51, 1155: 0.51, 1156: 0.55, 1157: 0.60, 1158: 0.62, 1159: 0.66, 1160: 0.69, 1161: 0.74, 1162: 0.74, 1163: 0.79, 1164: 0.79, 1165: 0.86,
           1166: 0.88, 1167: 0.93, 1168: 0.94, 1169: 0.99, 1170: 1.0, 1171: 1.06, 1172: 1.12, 1173: 1.2}
planIcon = {1154: 0.0, 1155: 0.51, 1156: 0.89, 1157: 1.09, 1158: 1.14, 1159: 1.13, 1160: 1.08, 1161: 1.03, 1162: 0.99, 1163: 0.97, 1164: 0.97, 1165: 0.98,
            1166: 0.99, 1167: 1.0}
planNameWipe = {1160: 0.0, 1161: 0.10, 1162: 0.32, 1163: 0.75, 1164: 0.9, 1165: 1.0}
planNameOp = {1160: 0.18, 1163: 0.15, 1164: 0.27, 1165: 0.40, 1166: 0.53, 1167: 0.61, 1168: 0.70, 1169: 0.78, 1170: 0.86, 1171: 0.92, 1172: 0.99, 1173: 1.0}
docF = {1145: 0, 1146: 0.10, 1147: 0.18, 1148: 0.63, 1149: 0.72, 1150: 0.79, 1151: 0.84, 1152: 0.87, 1153: 0.90, 1154: 0.92, 1155: 0.94, 1156: 0.99, 1157: 1.0}
planDocWipe = {n: round(v / 1.3, 4) for n, v in docF.items()}; planDocWipe[1158] = 0.85; planDocWipe[1160] = 1.0
planDocOp = {1145: 0.0, 1146: 0.7, 1148: 0.85, 1152: 0.95, 1157: 1.0}
planShine = {1162: -0.01, 1162.5: 0.0, 1180.5: 1.0, 1181: 1.02}

# ───────── 6. build chat ─────────
TB = byn(J('ref_trk_build_all.json'))
buildTy = {1209: 398.0, 1210: 325.0, 1211: 265.0}
for n in range(1212, 1256): buildTy[n] = TB[n]['ty']
buildTy[1256] = -46.68                          # headline-row profile (the tracker loses lock as the text dissolves)
v = buildTy[1256] - buildTy[1255]
for n in range(1257, 1260): v *= 1.16; buildTy[n] = round(buildTy[n - 1] + v, 2)
buildBlur = {1209: 13, 1210: 11, 1211: 9.0, 1212: 7.6, 1213: 5.9, 1214: 4.9, 1215: 4.1, 1216: 3.4, 1217: 2.8, 1218: 2.3, 1219: 1.9, 1220: 1.5, 1221: 1.0,
             1222: 0.6, 1223: 0.4, 1224: 0.0, 1248: 0.0, 1252: 0.5, 1255: 0.9, 1259: 1.8}
buildHead = {1209: 0, 1210: 0.05, 1211: 0.22, 1212: 0.53, 1213: 1.0}
buildName = {1210: 0.02, 1211: 0.10, 1212: 0.24, 1213: 0.38, 1214: 0.50, 1215: 0.63, 1216: 0.77, 1217: 0.90, 1218: 0.98, 1219: 1.0}   # one frame ahead of the raw reading (blur hides faint glyphs in both films)
buildL1 = {1213: 0.0, 1214: 0.36, 1215: 0.71, 1216: 0.98, 1217: 1.0, 1218: 1.08, 1219: 1.16, 1220: 1.25}
buildL2 = {1216: 0.0, 1217: 0.11, 1218: 0.22, 1219: 0.33, 1220: 0.45, 1221: 0.51, 1222: 0.60, 1223: 0.65, 1224: 0.70, 1225: 0.75, 1226: 0.76, 1227: 0.82,
           1228: 0.85, 1229: 0.90, 1230: 0.92, 1231: 0.94, 1232: 0.96, 1233: 0.97, 1234: 0.97, 1235: 0.99, 1236: 0.99, 1237: 1.0, 1238: 1.05, 1239: 1.1, 1240: 1.15}
fadeHead = {1247: 1, 1248: 0.98, 1249: 0.87, 1250: 0.72, 1251: 0.54, 1252: 0.40, 1253: 0.28, 1254: 0.17, 1255: 0.06, 1256: 0.0}
fadeName = {1247: 1, 1248: 0.91, 1249: 0.81, 1250: 0.72, 1251: 0.60, 1252: 0.49, 1253: 0.39, 1254: 0.28, 1255: 0.15, 1256: 0.04, 1257: 0.0}
fadeL1 = {1247: 1, 1248: 0.94, 1249: 0.76, 1250: 0.58, 1251: 0.37, 1252: 0.25, 1253: 0.14, 1254: 0.07, 1255: 0.03, 1256: 0.0}
fadeL2 = {1246: 1, 1247: 0.97, 1248: 0.89, 1249: 0.73, 1250: 0.59, 1251: 0.44, 1252: 0.34, 1253: 0.23, 1254: 0.13, 1255: 0.05, 1256: 0.0}
buildAvPop = {1212: 0.0, 1213: 0.2, 1214: 0.42, 1215: 0.58, 1216: 0.71, 1217: 0.80, 1218: 0.87, 1219: 0.91, 1220: 0.95, 1221: 0.97, 1222: 0.99, 1224: 1.0}
# the builder's path: rides the chat (its own rest point), then the reference's flight into the close-up
REST = (114.0, 190.0 + 24.0)                    # our avatar centre in the block at ty = 0
ref_rest = (116.5, 220.0)
ref_abs = {1244: (116.5, 215.0), 1245: (116.5, 215.1), 1246: (116.8, 216.3), 1247: (116.5, 218.9), 1248: (116.8, 223.5), 1249: (117.5, 230.0), 1250: (118.3, 238.8),
           1251: (121.5, 250.1), 1252: (127, 264), 1253: (135, 277), 1254: (150, 293), 1255: (174, 308), 1256: (205, 321), 1257: (248, 331), 1258: (308, 335), 1259: (397, 329)}
ref_size = {1244: 51, 1247: 51, 1248: 52, 1249: 55, 1250: 59, 1251: 63, 1252: 70, 1253: 78, 1254: 82, 1255: 93, 1256: 110, 1257: 132, 1258: 163, 1259: 190}
AV = []
prev = None
for n in range(1209, 1260):
    ty = buildTy[n]
    if n < 1244: x, y, sc = REST[0], REST[1] + ty, 1.0
    else:
        rx, ry = ref_abs[n]; dx, dy = rx - ref_rest[0], ry - (ref_rest[1] + ty)
        w = min(1.0, max(0.0, (n - 1247) / 6.0))                  # hand over from relative to absolute
        x = (REST[0] + dx) * (1 - w) + rx * w; y = (REST[1] + ty + dy) * (1 - w) + ry * w
        ks_ = sorted(ref_size); a = max(k for k in ks_ if k <= n); b = min(k for k in ks_ if k >= n)
        sz = ref_size[a] if a == b else ref_size[a] + (ref_size[b] - ref_size[a]) * (n - a) / (b - a)
        sc = sz / 51.0
    bx = by = 0.0
    if prev is not None and n >= 1250:
        bx = 0.15 * abs(x - prev[0]); by = 0.15 * abs(y - prev[1])
    AV.append([round(x, 2), round(y, 2), round(sc, 4), round(bx, 2), round(by, 2)]); prev = (x, y)

def tab(d): return {str(k): round(float(v), 4) for k, v in sorted(d.items())}
M = {'P': P, 'pose': {'from': 999, 'rows': ROWS}, 'fanBlur': {'from': 999, 'rows': FB}, 'mixB': {'1042': 0, '1043': 1},
     'glow': tab(glow), 'capReveal': tab(capReveal), 'capOp': tab(capOp), 'capBlur': tab(capBlur),
     'labels': LABELS, 'labLayer': LAYER, 'popS': tab(popS), 'popO': tab(popO), 'popB': tab(popB), 'outS': tab(outS), 'outO': tab(outO), 'outB': tab(outB),
     'chatBlur': tab(chatBlur), 'chatY': tab(chatY), 'planHead': tab(planHead), 'planSub': tab(planSub), 'planIcon': tab(planIcon), 'planNameWipe': tab(planNameWipe),
     'planNameOp': tab(planNameOp), 'planDocWipe': tab(planDocWipe), 'planDocOp': tab(planDocOp), 'planShine': tab(planShine),
     'buildTy': tab(buildTy), 'buildBlur': tab(buildBlur), 'buildHead': tab(buildHead), 'buildName': tab(buildName), 'buildL1': tab(buildL1), 'buildL2': tab(buildL2),
     'fadeHead': tab(fadeHead), 'fadeName': tab(fadeName), 'fadeL1': tab(fadeL1), 'fadeL2': tab(fadeL2), 'buildAvPop': tab(buildAvPop),
     'buildAv': {'from': 1209, 'rows': AV}}
hdr = ("'use strict';\n// W5 measured motion (reference frames 999–1259). Generated by tools/w5/build_motion.py from tools/w5/logs/*; see notes/w5.md.\n"
       "// pose rows: [X, Y, Z, rotateX, rotateY, rotateZ, card spacing] of the CSS transform\n"
       "//   perspective(P) translate3d(X,Y,Z) rotateX rotateY rotateZ translateZ(-i*spacing) on 11 frame-sized cards (origin = frame centre).\n")
open(os.path.join(ROOT, 'motion', 'w5.js'), 'w').write(hdr + 'window.MW5 = ' + json.dumps(M, separators=(',', ':')) + ';\n')
print('wrote motion/w5.js', len(ROWS), 'pose rows')
