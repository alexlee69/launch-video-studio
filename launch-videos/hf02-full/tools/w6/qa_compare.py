# W6 QA: every measured curve, reference vs our render (same tool on both), as one report. usage: python3 -E qa_compare.py > out/w6/qa_report.txt
import json, math, re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from curvecmp import cmp
M = os.path.expanduser('~/Downloads/launch-videos/hf02-full/out/w6/meas/')
def J(p): return json.load(open(M + p))
def logs(p): return {o['n']: o for o in (json.loads(l) for l in open(M + p) if l.startswith('{'))}
rows = []
def line(r, note=''):
    pr, po = r['ref_peak'], r['ours_peak']
    sp = 100 * (abs(po[1]) / abs(pr[1]) - 1) if pr[1] else 0
    rows.append((r['name'], '%.2f' % pr[0], '%+.2f' % pr[1], '%.2f' % po[0], '%+.2f' % po[1], '%+.2f' % (po[0] - pr[0]), '%+.1f%%' % sp, '%.2f' % r['worst_slow'], note))
# 1 split
def split(p, key=1270):
    D = {int(k): v for k, v in J(p).items()}; b0 = D[key]['B'] - 303.5; out = {}
    hwR, hwL = D[key]['R'] - 744.4, 335.0 - D[key]['L']
    for n, o in D.items():
        s = (o['B'] - 303.5) / b0; out[n] = dict(s=s, d=((o['R'] - hwR * s) - (o['L'] + hwL * s)) / 2)
    return out
r, o = split('ref_split2.json'), split('our_split2.json')
line(cmp('A split: half-separation d (px)', {n: r[n]['d'] for n in r}, {n: o[n]['d'] for n in o}, range(1261, 1280), show=False), 'split2.py')
line(cmp('A split: scale s (×100)', {n: 100 * r[n]['s'] for n in r}, {n: 100 * o[n]['s'] for n in o}, range(1261, 1280), show=False), 'split2.py')
# 2 bursts
def fit(p):
    out = {}
    for l in open(M + p):
        q = json.loads(l.split('}')[0] + '}'); out[q['n']] = q
    return out
for tag, a, b in (('1', 1281, 1299), ('2', 1300, 1316)):
    R, O = fit('ref_fit%s.txt' % tag), fit('our_fit%s.txt' % tag)
    line(cmp('B%s burst radial scale R (×1000)' % tag, {n: 1000 * R[n]['R'] for n in R if 'R' in R[n]}, {n: 1000 * O[n]['R'] for n in O if 'R' in O[n]}, range(a, b), show=False), 'blobs.py + burstfit.py')
    line(cmp('B%s burst size S (×1000)' % tag, {n: 1000 * R[n]['S'] for n in R if 'S' in R[n]}, {n: 1000 * O[n]['S'] for n in O if 'S' in O[n]}, range(a, b), show=False), 'tangential sd ratio')
def mom(p):
    out = {}
    for l in open(M + p):
        f = l.split(); d = dict(re.findall(r'(\w+)=\(?([-\d.]+)', l)); out[int(f[0])] = {k: float(v) for k, v in d.items()}
    return out
R, O = mom('ref_moments.txt'), mom('our_moments.txt')
line(cmp('C collapse: content spread sx (px)', {n: R[n]['sx'] for n in R}, {n: O[n]['sx'] for n in O}, range(1312, 1324), show=False), 'moments.py')
# 3 tiny character → avatar
s = open(os.path.expanduser('~/Downloads/launch-videos/hf02-full/motion/w6.js')).read(); W = json.loads(s[s.index('=') + 1:].rstrip().rstrip(';'))
av = {int(k): v for k, v in W['chat']['av'].items()}
B = {f['n']: f['blobs'] for f in J('our_blobs.json')}
def ours(n):
    c = [b for b in B[n] if b['area'] > 200 and b['x'] < 560 and b['y'] > 200 and b['cls'] in ('purple', 'blue', 'gray', 'green')]
    return max(c, key=lambda b: b['area']) if c else None
rx, ry, ox, oy = {}, {}, {}, {}
for n in range(1324, 1338):
    if n not in av: continue
    p = min(1, max(0, (537 - av[n][0]) / (537 - 116))); rx[n] = av[n][0] + 20 * p; ry[n] = av[n][1]
    q = ours(n)
    if q: ox[n], oy[n] = q['x'], q['y']
line(cmp('D tiny Writer x (ref + our 20 px slot offset)', rx, ox, range(1324, 1337), show=False), 'blob centroid')
line(cmp('D tiny Writer y', ry, oy, range(1324, 1337), show=False), 'blob centroid')
# 4 chat scroll
R = {**logs('ref_chatA.log'), **logs('ref_chatB.log')}; O = {**logs('our_chatA.log'), **logs('our_chatB.log')}
for n in (1419, 1420, 1421):
    if os.path.exists(M + 'our_chat_%d.log' % n): O.update(logs('our_chat_%d.log' % n))   # re-tracked from a near start (the chained run lost lock)
ok = [n for n in R if n in O and R[n]['ncc'] > 0.9 and n <= 1421]
for a, b, nm in ((1343, 1357, 'entry settle'), (1356, 1377, 'scroll for the card'), (1376, 1406, 'drift'), (1405, 1421, 'whip up')):
    w = [n for n in ok if a <= n <= b]
    line(cmp('E chat ty, %s (n%d–%d)' % (nm, a, b), {n: R[n]['ty'] for n in w}, {n: O[n]['ty'] for n in w}, range(a, b), show=False), 'trackm.py, key n1395')
blur = [(n, R[n]['by'], O[n]['by']) for n in sorted(ok) if n >= 1414]
# 5 phone
R = {o['n']: o for o in J('ref_rect.json')}; O = {o['n']: o for o in J('our_rect.json')}
okT = lambda d, n: d.get(n, {}).get('T') is not None and not (1426 <= n <= 1427)
line(cmp('F card/phone top T (n1365–1483)', {n: R[n]['T'] for n in R if 1365 <= n <= 1483 and okT(R, n)}, {n: O[n]['T'] for n in O if 1365 <= n <= 1483 and okT(O, n)}, range(1365, 1483), show=False), 'rect.py')
line(cmp('F phone width (n1408–1530)', {n: R[n]['w'] for n in R if R[n].get('w') and 1408 <= n <= 1530}, {n: O[n]['w'] for n in O if O[n].get('w') and 1408 <= n <= 1530}, range(1408, 1530), show=False), 'rect.py')
line(cmp('F phone centre x, rise (n1408–1443)', {n: R[n]['cx'] for n in R if R[n].get('cx') and 1408 <= n <= 1443}, {n: O[n]['cx'] for n in O if O[n].get('cx') and 1408 <= n <= 1443}, range(1408, 1443), show=False), 'rect.py (ours starts 21 px right by design)')
line(cmp('F phone centre x, push (n1460–1500)', {n: R[n]['cx'] for n in R if R[n].get('cx') and 1460 <= n <= 1500}, {n: O[n]['cx'] for n in O if O[n].get('cx') and 1460 <= n <= 1500}, range(1460, 1500), show=False), 'rect.py')
RB, OB = {int(k): v for k, v in J('ref_bottom2.json').items()}, {int(k): v for k, v in J('our_bottom2.json').items()}
both = sorted(set(RB) & set(OB)); dB = [OB[n] - RB[n] for n in both]
print('phone bottom edge pairs (ref/ours): ' + ' '.join('n%d %.1f/%.1f' % (n, RB[n], OB[n]) for n in both))
# 6 bubble
R = {int(k): v for k, v in J('ref_pill.json').items()}; O = {int(k): v for k, v in J('our_pill.json').items()}
line(cmp('G bubble pill centre y (n1492–1529)', {n: R[n]['yc'] for n in R if 1492 <= n <= 1529}, {n: O[n]['yc'] for n in O if 1492 <= n <= 1529}, range(1492, 1529), show=False), 'pillm.py')
def norm(D, a=1492, z=1507): return {n: 100 * (D[n]['right'] - D[a]['right']) / (D[z]['right'] - D[a]['right']) for n in D if D[n].get('right') and 1492 <= n <= 1512}
line(cmp('G bubble pill growth (% of final width)', norm(R), norm(O), range(1492, 1512), show=False), 'pillm.py, normalised')
print('%-46s %8s %9s %8s %9s %7s %8s %7s  %s' % ('curve', 'ref pk n', 'ref v/f', 'our pk n', 'our v/f', 'Δpeak', 'Δspeed', 'slowΔ', 'tool'))
for r in rows: print('%-46s %8s %9s %8s %9s %7s %8s %7s  %s' % r)
print('\nphone bottom edge (cols 280–300) where both read: %d frames, Δ mean %+.2f px, max |Δ| %.2f px' % (len(both), sum(dB) / len(dB), max(abs(x) for x in dB)))
print('chat whip blur by (tracker σ): ' + ' '.join('n%d %.2f/%.2f' % b for b in blur))
# burst radial blur (excess radial sd over the size-scaled rest sd, median over the outer characters)
for tag in ('1', '2'):
    R, O = fit('ref_fit%s.txt' % tag), fit('our_fit%s.txt' % tag)
    print('burst %s radial blur sigr ref/ours: ' % tag + ' '.join('n%d %.2f/%.2f' % (n, R[n]['sigr'], O[n]['sigr']) for n in sorted(R) if 'sigr' in R[n] and 'sigr' in O.get(n, {})))
# split edge blur (left edge of the left character, erf fit; static base ~1.1 ref / ~0.5 ours)
def eb(p):
    out = {}
    for l in open(M + p):
        f = l.split()
        if len(f) > 2: out[int(f[0])] = float(f[2].split('=')[1])
    return out
import subprocess
ref_eb = {}
for l in subprocess.run(['python3', '-E', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'edgeblur.py'), os.path.expanduser('~/Downloads/launch-videos/hf02-full/ref/frames'), '1260', '1280'], capture_output=True, text=True).stdout.splitlines():
    f = l.split()
    if len(f) > 2: ref_eb[int(f[0])] = float(f[2].split('=')[1])
our_eb = eb('our_edgeblur.txt')
q = lambda v, b: math.sqrt(max(0, v * v - b * b))
print('split edge blur σ (base removed in quadrature, ref base 1.1 / ours 0.5): ' + ' '.join('n%d %.1f/%.1f' % (n, q(ref_eb[n], 1.1), q(our_eb[n], 0.5)) for n in range(1261, 1281) if n in ref_eb and n in our_eb))
