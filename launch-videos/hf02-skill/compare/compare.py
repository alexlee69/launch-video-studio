# tracker readings of our render vs the reference's (ref/curves), per shot; landings; blur calibration
import json, os, sys, numpy as np
C = os.path.dirname(os.path.abspath(__file__)); R = os.path.expanduser('~/Downloads/launch-videos/hf02-skill/ref/curves')
def logf(p):
    if p.endswith('.json'): return {r['n']: r for r in json.load(open(p))}
    return {r['n']: r for r in (json.loads(l) for l in open(p) if l.strip().startswith('{'))}
ref = {k: logf(os.path.join(R, f'{k}.log')) for k in ['B1f', 'B1r', 'B2f', 'B2r', 'C0f', 'C0r', 'D1f', 'D1r', 'D2f', 'D2r']}
ref['A'] = logf(os.path.join(R, 'trackA.json'))
ours = {k: logf(os.path.join(C, f'trk-{k}.json')) for k in ref if os.path.exists(os.path.join(C, f'trk-{k}.json'))}
rows, out = [], []
def stat(name, pairs):
    e = [abs(a - b) for a, b in pairs]
    return (name, max(e), float(np.mean(e)), len(e))
SHOT = {'A': ['A'], 'B': ['B1f', 'B1r', 'B2f', 'B2r'], 'C': ['C0f', 'C0r'], 'D': ['D1f', 'D1r', 'D2f', 'D2r']}
excl = {357}       # the reference's B→C dissolve frame (ours is a hard drift cut: n357 is C's first frame)
table = []
NCC = float(sys.argv[1]) if len(sys.argv) > 1 else .6; lost = {}
for shot, keys in SHOT.items():
    ex, ey, ens, ncc_r, ncc_o = [], [], [], [], []
    for k in keys:
        if k not in ours: continue
        for n, r in ref[k].items():
            if n in excl and k.startswith('B'): continue
            o = ours[k].get(n)
            if not o: continue
            if r['ncc'] < NCC or o['ncc'] < NCC: lost.setdefault(shot, []).append((n, k, r['ncc'], o['ncc'])); continue
            ex.append(abs(o['tx'] - r['tx'])); ey.append(abs(o['ty'] - r['ty'])); ens.append(n); ncc_r.append(r['ncc']); ncc_o.append(o['ncc'])
    if ex:
        e = [max(a, b) for a, b in zip(ex, ey)]
        worst = ens[int(np.argmax(e))]
        table.append((shot, len(ex), max(ex), np.mean(ex), max(ey), np.mean(ey), worst, min(ncc_r), min(ncc_o)))
print('camera (similarity tracker, key frames as ref/curves; px in the 1080×608 frame)')
print(f'{"shot":5s} {"frames":>6s} {"tx max":>7s} {"tx mean":>7s} {"ty max":>7s} {"ty mean":>7s} {"worst n":>7s} {"min ncc ref/ours":>16s}')
for t in table: print(f'{t[0]:5s} {t[1]:6d} {t[2]:7.2f} {t[3]:7.2f} {t[4]:7.2f} {t[5]:7.2f} {t[6]:7d}   {t[7]:.3f}/{t[8]:.3f}')
# per-frame detail
for shot, keys in SHOT.items():
    for k in keys:
        if k not in ours: continue
        bad = [(n, ours[k][n]['tx'] - r['tx'], ours[k][n]['ty'] - r['ty']) for n, r in sorted(ref[k].items()) if n in ours[k] and not (n in excl and k.startswith('B')) and r['ncc'] >= NCC and ours[k][n]['ncc'] >= NCC and max(abs(ours[k][n]['tx'] - r['tx']), abs(ours[k][n]['ty'] - r['ty'])) > 3]
        if bad: print(f'  {k} > 3 px:', ' '.join(f'n{n}:{dx:+.1f},{dy:+.1f}' for n, dx, dy in bad))
for shot, l in lost.items(): print(f'  {shot}: not compared (tracker lost lock, ncc < {NCC} ref/ours):', ' '.join(f'n{n}({k} {a:.2f}/{b:.2f})' for n, k, a, b in l))
# list offset L and slot P (listL)
rL = {r['n']: r for r in json.load(open(os.path.join(R, 'listL.json')))}
oL = {r['n']: r for r in json.load(open(os.path.join(C, 'listL-ours.json')))}
ns = [n for n in range(379, 465) if n in rL and n in oL]
dl = [(oL[n]['L'] - oL[386]['L']) - (rL[n]['L'] - rL[386]['L']) for n in ns]
print(f'\nlist offset L (rel n386), n379–464: max {max(map(abs, dl)):.2f}  mean {np.mean(list(map(abs, dl))):.2f}')
ns2 = [n for n in range(358, 465) if n in rL and n in oL and rL[n]['pill_top'] and oL[n]['pill_top'] and rL[n]['pill_top'] > 1]
dp = np.array([oL[n]['pill_top'] - rL[n]['pill_top'] for n in ns2]); dp372 = dp - (oL[372]['pill_top'] - rL[372]['pill_top'])
print(f'slot top P n358–464 ({len(ns2)} frames): rel n372 max {np.abs(dp372).max():.2f} mean {np.abs(dp372).mean():.2f} | mean-aligned max {np.abs(dp - dp.mean()).max():.2f} mean {np.abs(dp - dp.mean()).mean():.2f} (layout offset {dp.mean():+.2f})')
for lo, hi, nm in [(358, 372, 'entrance n358–371'), (372, 452, 'drift + nudges n372–451'), (452, 465, 'exit n452–464')]:
    sel = [i for i, n in enumerate(ns2) if lo <= n < hi]
    print(f'   {nm}: mean-aligned max {np.abs(dp[sel] - dp.mean()).max():.2f}')
json.dump({'lost': {k: [x[0] for x in v] for k, v in lost.items()}, 'table': [list(map(lambda x: x if isinstance(x, str) else float(x), t)) for t in table], 'L': {'max': max(map(abs, dl)), 'mean': float(np.mean(list(map(abs, dl))))},
           'P': {'rel372_max': float(np.abs(dp372).max()), 'aligned_max': float(np.abs(dp - dp.mean()).max()), 'aligned_mean': float(np.abs(dp - dp.mean()).mean())}}, open(os.path.join(C, 'compare.json'), 'w'), indent=1)
