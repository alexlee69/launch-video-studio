# Per-group burst tables from the reference blob measurements → JSON (merged into motion/w6.js by build_motion.py)
import json, math, sys
B = {f['n']: f['blobs'] for f in json.load(open(sys.argv[1]))}
C = (540, 304)
def tracks(key, frames):
    rows = []
    for k in B[key]:
        line = {}; prev = (k['x'], k['y'])
        for m in frames:
            best = min(B[m], key=lambda o: (o['x'] - prev[0]) ** 2 + (o['y'] - prev[1]) ** 2)
            line[m] = best; prev = (best['x'], best['y'])
        rows.append((k, line))
    return rows
def group_of(r, edges):
    return min(edges, key=lambda g: abs(edges[g] - r))
out = {}
# burst 1: groups by rest radius at n1291
G1 = {'inner': 39, 'vert': 179, 'diag': 231, 'horiz': 370}
t_fw = tracks(1291, range(1291, 1300)); t_bw = tracks(1291, range(1291, 1280, -1))
b1 = {g: {} for g in G1}
for (k, fw), (_, bw) in zip(t_fw, t_bw):
    g = group_of(k['r'], G1)
    for m, o in list(fw.items()) + list(bw.items()):
        b1[g].setdefault(m, []).append(o['r'] - k['r'])
b1 = {g: {m: round(sum(v) / len(v), 2) for m, v in sorted(d.items())} for g, d in b1.items()}
# frames where the inner pair is merged with each other: replace by extrapolation (x2 per frame going back)
inner = b1['inner']
for m in range(1286, 1280, -1): inner[m] = round(inner[m + 1] * (1.75 if m < 1287 else 1), 2) if m < 1286 else -4.0
out['b1'] = b1
# burst 2: groups by rest radius at n1309 (ratio tables, since the entry is a per-group radial scale)
G2 = {'g21': 21.7, 'g99': 99.3, 'g128': 128.7, 'g205': 205.4, 'g221': 221, 'g253': 253.2, 'g424': 424.4, 'g455': 455}
t_fw = tracks(1309, range(1309, 1317)); t_bw = tracks(1309, range(1309, 1299, -1))
b2 = {g: {} for g in G2}
for (k, fw), (_, bw) in zip(t_fw, t_bw):
    g = group_of(k['r'], G2)
    for m, o in list(fw.items()) + list(bw.items()):
        b2[g].setdefault(m, []).append(o['r'] / k['r'])
b2 = {g: {m: round(sorted(v)[len(v) // 2], 4) for m, v in sorted(d.items())} for g, d in b2.items()}
out['b2raw'] = b2
json.dump(out, open(sys.argv[2], 'w'), indent=0)
for k, v in out.items():
    for g, d in v.items(): print(k, g, ' '.join('%d:%s' % (m, d[m]) for m in sorted(d)))
