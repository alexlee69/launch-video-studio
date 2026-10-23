# Outro (n1698-1786): icon drop, pops (blob tool on both) and the slow push (track_roi T3 vs O3).
import json, math
def load(p):
    L = {}
    for line in open(p):
        n, js = line.split(' ', 1); L[int(n)] = json.loads(js)
    return L
R, O = load('logs/blobs_outro.log'), load('logs/blobs_ours_outro.log')
def near(L, n, cls, x, y, rad, minA=40):
    best = None
    for c in L.get(n, {}).get(cls, []):
        dd = math.hypot(c[0] - x, c[1] - y)
        if dd < rad and c[4] >= minA and (best is None or c[4] > best[4]): best = c
    return best
print('## outro: first mark drops from the top (centre y, px; rest y = n1708)')
ry = {}; oy = {}
def icon(L, n, x):     # the mark: dark components centred within 30 px of its column, merged (motion smear can split it)
    cs = [c for c in L.get(n, {}).get('dark', []) if abs(c[0] - x) < 30 and c[4] > 30]
    if not cs: return None
    A = sum(c[4] for c in cs); return sum(c[1] * c[4] for c in cs) / A
for n in range(1698, 1712):
    ry[n] = icon(R, n, 191); oy[n] = icon(O, n, 246)
r0, o0 = ry[1708], oy[1708]
print('| n | ref y-rest | ours y-rest |'); print('|---|---|---|')
for n in range(1698, 1712):
    print('| %d | %s | %s |' % (n, '%.1f' % (ry[n] - r0) if ry[n] else '-', '%.1f' % (oy[n] - o0) if oy[n] else '-'))
S = {'green': (('green', (931, 512)), ('green', (880, 515))), 'blue': (('blue', (530, 108)), ('blue', (775, 80))),
     'orange': (('orange', (134, 102)), ('orange', (301, 74))), 'purple': (('purple', (548, 522)), ('purple', (229, 531)))}
print('\n## outro pops: first visible frame and pop / pulse peaks (blob width / rest)')
for k, ((rc, rs), (oc, os_)) in S.items():
    out = []
    for L, (cls, seed) in ((R, (rc, rs)), (O, (oc, os_))):
        w = {}
        for n in range(1700, 1745):
            c = near(L, n, cls, seed[0], seed[1], 80, 15)
            if c: w[n] = c[2]
        rest = sorted(w[n] for n in range(1736, 1745) if n in w)[4]
        sc = {n: v / rest for n, v in w.items()}
        f = min(n for n in sc if sc[n] > 0.05)
        pk = max(range(f, f + 7), key=lambda n: sc.get(n, 0)); pu = max(range(f + 8, 1735), key=lambda n: sc.get(n, 0))
        out.append((f, pk, sc[pk], pu, sc[pu]))
    (fr, pr, vr, ur, wr), (fo, po, vo, uo, wo) = out
    print('%-7s first ref n%d ours n%d | pop peak ref n%d (%.2f) ours n%d (%.2f) | pulse ref n%d (%.2f) ours n%d (%.2f)' % (k, fr, fo, pr, vr, po, vo, ur, wr, uo, wo))
T3 = {r['n']: r for r in (json.loads(l) for f in ('logs/T3_outro_f.log', 'logs/T3_outro_b.log') for l in open(f) if l.startswith('{'))}
O3 = {r['n']: r for r in (json.loads(l) for f in ('logs/O3_outro_f.log', 'logs/O3_outro_b.log') for l in open(f) if l.startswith('{'))}
print('\n## outro slow push (key n1760): scale per frame and fixed point')
for n in (1720, 1730, 1740, 1750, 1770, 1780, 1786):
    if n in T3 and n in O3:
        a, b = T3[n], O3[n]
        fx = lambda r: (r['tx'] / (1 - r['s']), r['ty'] / (1 - r['s']))
        print('n%d  s ref %.5f ours %.5f | fixed point ref (%.0f, %.0f) ours (%.0f, %.0f)' % (n, a['s'], b['s'], *fx(a), *fx(b)))
