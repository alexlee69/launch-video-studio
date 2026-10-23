# Fit the burst model to blob measurements: position_i(n) = C + Rs(n)·(p_i(key) − C), size_i(n) = Ss(n)·size_i(key)
# Rs from the median radial ratio of matched outer blobs, Ss from the median tangential-sd ratio; radial blur from sr² − (Ss·sr_key)².
# usage: burstfit.py <blobs.json> <key> <first> <last> [--rmin 150]
import sys, json, math
import numpy as np
B = {f['n']: f['blobs'] for f in json.load(open(sys.argv[1]))}
key, a, b = int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
rmin = float(sys.argv[sys.argv.index('--rmin') + 1]) if '--rmin' in sys.argv else 150
C = np.array([540.0, 304.0])
K = [o for o in B[key] if o['r'] > rmin]
out = []
Rs_prev = 1.0
for n in (range(key, b + 1), range(key - 1, a - 1, -1)):
    Rs_prev = 1.0
    for m in n:
        if m not in B: continue
        rr, ss, bl, vv = [], [], [], []
        for k in K:
            kp = np.array([k['x'], k['y']]) - C
            pred = C + Rs_prev * kp
            best = min(B[m], key=lambda o: (o['x'] - pred[0]) ** 2 + (o['y'] - pred[1]) ** 2)
            dist = math.hypot(best['x'] - pred[0], best['y'] - pred[1])
            if dist > 40 + 0.15 * Rs_prev * np.hypot(*kp): continue
            if best['area'] > 3 * k['area'] * max(Rs_prev, 0.3) ** 2 + 4000: continue   # merged blob
            rr.append(best['r'] / k['r']); ss.append(best['st'] / k['st'])
            vv.append((best['sr'] ** 2, k['sr'] ** 2))
        if not rr: out.append(dict(n=m)); continue
        Rs, Ss = float(np.median(rr)), float(np.median(ss))
        sig = float(np.median([math.sqrt(max(0, v - Ss * Ss * k0)) for v, k0 in vv]))
        Rs_prev = Rs
        out.append(dict(n=m, R=round(Rs, 4), S=round(Ss, 4), k=len(rr), sigr=round(sig, 2), sdR=round(float(np.std(rr)), 4)))
out.sort(key=lambda o: o['n'])
prev = None
for o in out:
    v = '' if prev is None or 'R' not in o or 'R' not in prev else ' dR=%+.4f' % (o['R'] - prev['R'])
    print(json.dumps(o) + v); prev = o
json.dump(out, open(sys.argv[1].replace('.json', '_fit_%d.json' % key), 'w'))
