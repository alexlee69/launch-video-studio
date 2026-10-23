# Corridor: flow rate k (tunnel.py on both) and the crew's sizes / distance from the vanishing point (blob tool on both).
import json, math
import glob, sys
def rd(pats):
    out = {}
    for p in pats:
        for f in sorted(glob.glob(p)):
            for l in open(f):
                if l.startswith('{'): r = json.loads(l); out[r['n']] = r
    return out
if '--v2' in sys.argv:   # the robust re-fit (default start every frame, never carries a lost fit), run in chunks
    TR, TO = rd(['logs/tunnel_ref2.log', 'logs/tr2_*.log']), rd(['logs/tunnel_ours2.log', 'logs/to2_*.log'])
else:
    TR, TO = rd(['logs/tunnel_ref.log']), rd(['logs/tunnel_ours.log'])
# k and the aspect a trade off inside the fit, so compare the flow it implies: mean radial speed 250 px from the VP (px/f)
def F(r):
    m = sum(math.sqrt((math.cos(t) / r['asp']) ** 2 + math.sin(t) ** 2) for t in [i * math.pi / 36 for i in range(72)]) / 72
    return r['k'] * 250 * 250 * m
for d in (TR, TO):
    for r in d.values(): r['F'] = F(r)
print('## corridor flow per frame pair (n -> n+1): k = v/(f·R), a = aspect; F250 = implied radial speed 250 px from the VP')
print('| pair | k ref | a ref | k ours | a ours | F250 ref | F250 ours | ours/ref | VPx ref | VPx ours | ncc ref | ncc ours |'); print('|---|---|---|---|---|---|---|---|---|---|---|---|')
for n in range(77, 95):
    if n in TR and n in TO:
        a, b = TR[n], TO[n]
        print('| %d-%d | %.5f | %.2f | %.5f | %.2f | %.1f | %.1f | %.2f | %.1f | %.1f | %.2f | %.2f |' % (n, n + 1, a['k'], a['asp'], b['k'], b['asp'], a['F'], b['F'], b['F'] / a['F'], a['vx'], b['vx'], a['ncc'], b['ncc']))
good = [n for n in range(77, 95) if n in TR and n in TO and TR[n]['ncc'] > 0.7 and TO[n]['ncc'] > 0.7]
if good:
    pr = max(good, key=lambda n: TR[n]['F']); po = max(good, key=lambda n: TO[n]['F'])
    print('peak F250 (pairs with ncc>.7 on both): ref n%d.5 %.1f px/f, ours n%d.5 %.1f px/f (%+.0f%%)' % (pr, TR[pr]['F'], po, TO[po]['F'], 100 * (TO[po]['F'] / TR[pr]['F'] - 1)))
    import statistics
    print('median F250 ours/ref over those pairs: %.3f' % statistics.median(TO[n]['F'] / TR[n]['F'] for n in good))
# crew
def load(p):
    L = {}
    for line in open(p):
        n, js = line.split(' ', 1); L[int(n)] = json.loads(js)
    return L
O = load('logs/blobs_ours_open.log')
M = json.loads(open('../../motion/w1.js').read().split('window.MW1 = ')[1].rstrip(';\n'))
C = M['corr']; rot = math.radians(C['rot'])
def vx(n):
    ks = sorted(float(k) for k in C['vx']); vals = [C['vx'][('%g' % k) if ('%g' % k) in C['vx'] else str(k)] for k in ks]
    import numpy as np; return float(np.interp(n, ks, vals))
cls = {'green': 'green', 'blue': 'blue', 'orange': 'orange', 'purple': 'purple', 'tri': 'dark'}
print('\n## corridor crew: blob width (px) and distance from the vanishing point, ref vs ours (ours rotated -30 deg about the VP)')
for k, c in cls.items():
    tab = {int(n): v for n, v in C['chars'][k].items()}
    rowsW, rowsR = [], []
    for n in range(78, 96):
        if n not in tab: continue
        x, y, w = tab[n]; cx = vx(n); dx, dy = x - cx, y - C['vy']
        ex, ey = cx + dx * math.cos(rot) - dy * math.sin(rot), C['vy'] + dx * math.sin(rot) + dy * math.cos(rot)
        best = None
        for b in O.get(n, {}).get(c, []):
            dd = math.hypot(b[0] - ex, b[1] - ey)
            if dd < 60 and b[4] > 30 and (best is None or dd < best[0]): best = (dd, b)
        if not best: continue
        b = best[1]
        rowsW.append('%d:%d/%d' % (n, w, b[2])); rowsR.append('%d:%.0f/%.0f' % (n, math.hypot(dx, dy), math.hypot(b[0] - cx, b[1] - C['vy'])))
    print('%-7s width ref/ours ' % k + ' '.join(rowsW)); print('        dist  ref/ours ' + ' '.join(rowsR))
