# Reference vs ours, same tools on both: prints the QA tables for notes/w1.md.
import json, os, math, sys
import numpy as np
L = lambda p: [json.loads(l) for l in open(os.path.join('logs', p)) if l.strip().startswith('{')]
def bylog(p): return {r['n']: r for r in L(p)}
out = []
def P(*a): s = ' '.join(str(x) for x in a); print(s); out.append(s)
# ── 1. push-in: camera scale (T1/zoomfit on ref, O1/zoomfit on ours, same ROI logic, key n45)
T1, O1 = bylog('T1_push.log'), bylog('O1_push.log')
ZR, ZO = bylog('zoomfit_ref.log'), bylog('zoomfit_ours.log') if os.path.exists('logs/zoomfit_ours.log') else {}
def sR(n): return ZR[n]['s'] if n in ZR and ZR[n]['ncc'] > 0.9 else T1[n]['s']
def sO(n): return ZO[n]['s'] if n in ZO and ZO[n]['ncc'] > 0.9 else O1[n]['s']
P('## push-in (n45-75): scale s about (546,300); speed = d ln s per frame; edge px/f = speed x 520')
P('| n | s ref | s ours | d ln s ref | d ln s ours | blur dlog ref | blur dlog ours |'); P('|---|---|---|---|---|---|---|')
for n in range(55, 76):
    if n not in T1 or n not in O1: continue
    dr = math.log(sR(n) / sR(n - 1)) if n - 1 in T1 else 0; do = math.log(sO(n) / sO(n - 1)) if n - 1 in O1 else 0
    P('| %d | %.4f | %.4f | %.4f | %.4f | %s | %s |' % (n, sR(n), sO(n), dr, do, ZR[n]['dlog'] if n in ZR else '', ZO[n]['dlog'] if n in ZO else ''))
# ── 2. lockup build: own offsets (camera-mapped rest removed), ref T2 / ours O2
T2, O2 = bylog('T2_build.log'), bylog('O2_build.log')
off = lambda r: (r['tx'] - 546 * (1 - r['s']), r['ty'] - 300 * (1 - r['s']))
P('\n## lockup build offsets (px): x slide n9-22, y spring/rise; velocity peaks')
P('| n | offX ref | offX ours | offY ref | offY ours |'); P('|---|---|---|---|---|')
for n in range(15, 41):
    if n in T2 and n in O2:
        a, b = off(T2[n]), off(O2[n]); P('| %d | %.1f | %.1f | %.1f | %.1f |' % (n, a[0], b[0], a[1], b[1]))
json.dump(out, open('logs/compare_out.json', 'w'))
