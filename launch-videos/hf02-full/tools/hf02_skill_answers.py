# -*- coding: utf-8 -*-
# Re-derives the three answers in hf02-skill/ANSWERS-measurements.md from the reference curves (read only):
# 1 entrance offset/decay per cut, 2 camera blur vs speed, 3 roster slot nudges.  python3 -E tools/hf02_skill_answers.py
import json, math, os, statistics as st
C = os.path.expanduser('~/Downloads/launch-videos/hf02-skill/ref/curves')
def log(f): return {r['n']: r for r in (json.loads(l) for l in open('%s/%s.log' % (C, f)) if l.strip().startswith('{'))}
A = {r['n']: r for r in json.load(open(C + '/trackA.json'))}
B1r, B1f, B2r, D1r, D1f, D2f = (log(f) for f in ('B1r', 'B1f', 'B2r', 'D1r', 'D1f', 'D2f'))
LL = {r['n']: r for r in json.load(open(C + '/listL.json'))}
W, H = 1080, 608
print('== 1. Entrances (offset above the shot\'s own base drift; t = 0 at the cut)')
def entrance(name, pos, n0, n1, cut, drift, size, axis):
    off = {n: pos[n] - (pos[n1] + drift * (n - n1)) for n in range(n0, n1 + 1)}       # offset from the rest line
    v = [abs(off[n + 1] - off[n]) for n in range(n0, n0 + 6)]
    r = st.median(v[i + 1] / v[i] for i in range(5))
    t0 = n0 - cut; E = abs(off[n0]) / r ** t0; E7 = abs(off[n0]) / 0.7 ** t0
    print('%-2s first frame n%d: offset %6.1f px, decay x%.3f/f, speed at the cut %5.1f px/f | E at cut %5.1f px = %.3f %s (with x0.70: %.3f %s)'
          % (name, n0, abs(off[n0]), r, E * -math.log(r), E, E / size, axis, E7 / size, axis))
entrance('B', {n: d['tx'] for n, d in B1r.items()}, 312, 325, 311.5, st.mean(B1r[n]['tx'] - B1r[n - 1]['tx'] for n in range(320, 326)), W, 'W')
D = {**{n: d['ty'] for n, d in D1r.items()}, **{n: d['ty'] for n, d in D1f.items()}}
entrance('D', D, 465, 477, 464.5, st.mean(D[n] - D[n - 1] for n in range(475, 478)), H, 'H')
P = {n: r['pill_top'] for n, r in LL.items()}
entrance('C', P, 358, 372, 356.5, st.mean(P[n] - P[n - 1] for n in range(374, 387)), H, 'H')
print('   C check: n360->372 slot top moves %.1f px, whole-frame track ty moves %.1f px; slot height n358-392 %.2f +- %.2f px (no zoom)'
      % (P[372] - P[360], -log('C0r')[360]['ty'], st.mean(LL[n]['pill_bot'] - P[n] for n in range(358, 393)), st.pstdev(LL[n]['pill_bot'] - P[n] for n in range(358, 393))))
print('   exits: A v(310.5) %.1f px/f, building x%.2f -> ~%.1f px/f on n311;  D v(508.5) %.1f, x%.2f -> ~%.1f on n509'
      % (A[311]['tx'] - A[310]['tx'], (A[311]['tx'] - A[310]['tx']) / (A[310]['tx'] - A[309]['tx']), (A[311]['tx'] - A[310]['tx']) * math.sqrt((A[311]['tx'] - A[310]['tx']) / (A[310]['tx'] - A[309]['tx'])),
         abs(D2f[509]['ty'] - D2f[508]['ty']), (D2f[509]['ty'] - D2f[508]['ty']) / (D2f[508]['ty'] - D2f[507]['ty']), abs(D2f[509]['ty'] - D2f[508]['ty']) * math.sqrt((D2f[509]['ty'] - D2f[508]['ty']) / (D2f[508]['ty'] - D2f[507]['ty']))))
print('\n== 2. Camera blur vs speed at the frame (sigma read / 0.93 = calibrated, from compare/blurcal.txt, sigma >= 2 px)')
CAL = 0.93
def row(lab, seg, n, k, bk, v):
    s = seg[n][bk] / CAL; print('   %-26s n%d  speed %5.1f px/f  sigma %4.2f  ratio %.3f' % (lab, n, v, s, s / v)); return s / v
inshot = [row('B pan (accel)', B1f, n, 'tx', 'bx', (B1f[n + 1]['tx'] - B1f[n - 1]['tx']) / 2) for n in (331, 332)]
inshot += [row('B pan (decel)', B2r, n, 'tx', 'bx', (B2r[n + 1]['tx'] - B2r[n - 1]['tx']) / 2) for n in (335, 336)]
exits = [row('A exit, last frame', A, 311, 'tx', 'bx', 16.3), row('D exit, n508 (central)', D2f, 508, 'ty', 'by', abs(D2f[509]['ty'] - D2f[507]['ty']) / 2),
         row('D exit, last frame', D2f, 509, 'ty', 'by', 26.6)]
print('   in-shot median %.3f | last exit frames median %.3f' % (st.median(inshot), st.median(exits)))
print('\n== 3. Slot nudges (listL: slot top P and bottom edge measured separately)')
dis = [abs((LL[n]['pill_top'] - LL[n - 1]['pill_top']) - (LL[n]['pill_bot'] - LL[n - 1]['pill_bot'])) for n in range(373, 461)]
hh = [LL[n]['pill_bot'] - LL[n]['pill_top'] for n in range(372, 465)]
print('   top/bottom per-frame disagreement: median %.2f, max %.2f px (n373-460); height %.2f +- %.2f px' % (st.median(dis), max(dis), st.mean(hh), st.pstdev(hh)))
for lab, lo, hi, pk in (('step 1', 390, 400, 394.5), ('step 2', 405, 416, 409.5), ('step 3', 421, 430, 424.5), ('3-row run', 433, 447, 439.5)):
    nmin = min(range(lo, int(pk) + 1), key=lambda n: P[n]); nmax = max(range(int(pk), hi + 1), key=lambda n: P[n])
    rise = P[nmax] - P[nmin]; rel = P[nmax] - (P[nmin] - 1.0 * (nmax - nmin))
    lv = max(abs(LL[n]['L'] - LL[n - 1]['L']) for n in range(int(pk) - 1, int(pk) + 3))
    print('   %-9s list peak %5.1f px/f at n%.1f | slot low n%d -> high n%d (%.1f f after the peak): rise %5.1f px, %4.1f px vs a 1 px/f drift line'
          % (lab, lv, pk, nmin, nmax, nmax - pk, rise, rel))
