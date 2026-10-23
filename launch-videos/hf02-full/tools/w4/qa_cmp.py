# Reference vs ours, same measurement tools: per-frame tables + summary numbers for notes/w4.md.
import sys, os, json, math
import numpy as np
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
M = os.path.join(ROOT, 'out', 'w4', 'meas'); Q = os.path.join(ROOT, 'out', 'w4', 'qa')
J = lambda d, f: {r['n']: r for r in json.load(open(os.path.join(d, f)))}
def peak(curve):
    # curve {n: v}; returns (frame of max |v| (parabolic), max |v|)
    ns = sorted(curve); vs = np.array([abs(curve[n]) for n in ns]); i = int(np.argmax(vs))
    if 0 < i < len(vs) - 1:
        y0, y1, y2 = vs[i - 1], vs[i], vs[i + 1]; den = y0 - 2 * y1 + y2
        off = 0.5 * (y0 - y2) / den if den != 0 else 0
        return ns[i] + off, y1 - 0.25 * (y0 - y2) * off
    return ns[i], vs[i]
def vel(d, key, idx=None):
    ns = sorted(d); out = {}
    for a, b in zip(ns[:-1], ns[1:]):
        if b - a != 1: continue
        va = d[a][key] if idx is None else d[a][key][idx]; vb = d[b][key] if idx is None else d[b][key][idx]
        if va is None or vb is None: continue
        out[a + 0.5] = vb - va
    return out
rep = []
from PIL import Image
SCR = '/private/tmp/claude-501/-Users-bytedance-Downloads-Design-AutoPilot-stable/db3322f5-f4cf-44bc-bee5-82db478af53f/scratchpad/w4'
def wblob(d, n, kind, cx, cy, r=70):
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('RGB')
    A = np.asarray(im).astype(float); x0, y0 = int(max(0, cx - r)), int(max(0, cy - r)); A = A[y0:int(cy + r), x0:int(cx + r)]
    R, G, B = A[..., 0], A[..., 1], A[..., 2]
    w = np.clip((B - R - 90) / 60, 0, 1) * (B > 150) if kind == 'blue' else np.clip((R - B - 110) / 60, 0, 1) * (R > 180)
    s_ = w.sum()
    if s_ < 20: return None
    ys, xs = np.mgrid[0:w.shape[0], 0:w.shape[1]]
    return ((w * xs).sum() / s_ + x0, (w * ys).sum() / s_ + y0)
P = lambda *a: (rep.append(' '.join(str(x) for x in a)), print(*a))
# ── A: card corners n510-554
rA, oA = J(M, 'qA.json'), J(Q, 'oA.json')
errs = []
for n in range(512, 555):
    if n == 511: continue
    e = max(math.dist(rA[n][c], oA[n][c]) for c in ('TL', 'TR', 'BR', 'BL'))
    errs.append((n, e))
P('A corners n512-554: max corner error %.2f px (n%d), mean %.2f px' % (max(e for _, e in errs), max(errs, key=lambda x: x[1])[0], np.mean([e for _, e in errs])))
for key, i, nm in (('TL', 0, 'left edge x'), ('TL', 1, 'top y')):
    vr = {k: v for k, v in vel(rA, key, i).items() if 536 <= k <= 554}; vo = {k: v for k, v in vel(oA, key, i).items() if 536 <= k <= 554}
    pr, po = peak(vr), peak(vo)
    P('A %s velocity n536-554: ref peak %.2f px/f @ %.1f, ours %.2f px/f @ %.1f' % (nm, pr[1], pr[0], po[1], po[0]))
bA = J(M, 'bA.json'); be = []
for n in range(511, 555):
    c = wblob(SCR + '/r1s', n, 'blue', bA[n]['cx'], bA[n]['cy'])
    if c: be.append((n, math.dist((bA[n]['cx'], bA[n]['cy']), c)))
P('A Scout bubble centroid n511-554: max %.2f px (n%d), mean %.2f px' % (max(e for _, e in be), max(be, key=lambda x: x[1])[0], np.mean([e for _, e in be])))
# ── B/C: front card right edge (TR/BR) and deck left extent n555-640
rB, rC, oB = J(M, 'qB.json'), J(M, 'qC.json'), J(Q, 'oB.json')
eT, eL = [], []
for n in range(555, 641):
    r = rB[n] if n <= 622 else rC[n]
    o = oB[n]
    if r.get('R') and o.get('R'):
        x_r = r['R'][0] + r['R'][1] * 300; x_o = o['R'][0] + o['R'][1] * 300; eT.append((n, abs(x_r - x_o)))
    if r.get('bbox') and o.get('bbox'): eL.append((n, abs(r['bbox'][0] - o['bbox'][0])))
P('B/C front-card right edge at y=300 n555-640: max %.2f px (n%d), median %.2f px' % (max(e for _, e in eT), max(eT, key=lambda x: x[1])[0], np.median([e for _, e in eT])))
eT2 = [(n, e) for n, e in eT if n not in (595, 596, 597)]
P('   excluding n595-597 (reference right edge off-frame): max %.2f px (n%d); frames > 3 px: %s' % (max(e for _, e in eT2), max(eT2, key=lambda x: x[1])[0], [(n, round(e, 1)) for n, e in eT2 if e > 3]))
bB = J(M, 'bB.json'); bq = []
for n in range(597, 641):
    if bB.get(n, {}).get('area', 0) < 1500: continue
    c = wblob(SCR + '/r1s', n, 'blue', bB[n]['cx'], bB[n]['cy'])
    if c: bq.append((n, math.dist((bB[n]['cx'], bB[n]['cy']), c)))
P('B/C Scout bubble on the landing card n597-640: max %.2f px (n%d), mean %.2f px' % (max(e for _, e in bq), max(bq, key=lambda x: x[1])[0], np.mean([e for _, e in bq])))
P('B/C deck left extent (bbox left) n555-640: max %.1f px (n%d), median %.1f px' % (max(e for _, e in eL), max(eL, key=lambda x: x[1])[0], np.median([e for _, e in eL])))
# ── D: close-up edges + bubble
rD, oD = J(M, 'eD.json'), J(Q, 'oD.json')
ex = [abs(rD[n]['xl'] - oD[n]['xl']) for n in range(641, 671)]; ey = [abs(rD[n]['yb'] - oD[n]['yb']) for n in range(641, 671)]
P('D close-up card left edge: max %.2f px, bottom edge: max %.2f px' % (max(ex), max(ey)))
vr = vel(rD, 'xl'); vo = vel(oD, 'xl'); pr, po = peak({k: v for k, v in vr.items() if k > 655}), peak({k: v for k, v in vo.items() if k > 655})
P('D exit (left edge) peak speed: ref %.2f px/f @ %.1f, ours %.2f px/f @ %.1f' % (pr[1], pr[0], po[1], po[0]))
vr = vel(rD, 'yb'); vo = vel(oD, 'yb'); pr, po = peak(vr), peak(vo)
P('D entry (bottom edge) peak speed: ref %.2f px/f @ %.1f, ours %.2f px/f @ %.1f' % (pr[1], pr[0], po[1], po[0]))
bD = J(M, 'bD.json'); be = []
for n in range(641, 671):
    c = wblob(SCR + '/r1s', n, 'orange', bD[n]['cx'], bD[n]['cy'])
    if c: be.append(math.dist((bD[n]['cx'], bD[n]['cy']), c))
P('D Critic bubble centroid: max %.2f px, mean %.2f px' % (max(be), np.mean(be)))
# ── E: thread scroll (content offset) n743-843
rE, oE = J(M, 'thE.json'), J(Q, 'oE.json')
vr = {n: rE[n]['dy'] for n in range(744, 844)}; vo = {n: oE[n]['dy'] for n in range(744, 844) if 'dy' in oE[n]}
P('E thread scroll: max |offset diff| %.2f px; per-frame speed diff max %.2f px/f (mean %.2f)' % (
    max(abs(rE[n]['off'] - oE[n]['off']) for n in range(743, 844)), max(abs(vr[n] - vo[n]) for n in vo), np.mean([abs(vr[n] - vo[n]) for n in vo])))
for a, b, nm in ((757, 774, 'step 2'), (774, 796, 'step 3'), (796, 844, 'final run')):
    pr = peak({n: vr[n] for n in vr if a <= n < b}); po = peak({n: vo[n] for n in vo if a <= n < b})
    P('E %s peak: ref %.2f px/f @ %.1f, ours %.2f px/f @ %.1f' % (nm, pr[1], pr[0], po[1], po[0]))
P('E slowest drift: ref %.2f px/f, ours %.2f px/f' % (min(abs(v) for v in vr.values()), min(abs(v) for v in vo.values())))
# ── G: featured card (bottom edge, left edge) n927-970
rG, oG = J(M, 'qG.json'), J(Q, 'oG.json')
ey = [abs(rG[n]['BR'][1] - oG[n]['BR'][1]) for n in range(931, 971)]; ex = [abs(rG[n]['TL'][0] - oG[n]['TL'][0]) for n in range(927, 971)]
P('G featured card: bottom edge max %.2f px (n931-970), left edge max %.2f px (n927-970)' % (max(ey), max(ex)))
vr = {n: rG[n + 1]['TL'][0] - rG[n]['TL'][0] for n in range(948, 968)}; vo = {n: oG[n + 1]['TL'][0] - oG[n]['TL'][0] for n in range(948, 968)}
P('G exit speed n967->968: ref %.2f, ours %.2f px/f; n968->969 ref %.2f ours %.2f' % (vr[967], vo[967], rG[969]['TL'][0] - rG[968]['TL'][0], oG[969]['TL'][0] - oG[968]['TL'][0]))
open(os.path.join(Q, 'qa_report.txt'), 'w').write('\n'.join(rep) + '\n')
