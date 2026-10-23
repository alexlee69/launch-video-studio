# Builds motion/w4.js (window.MW4) from the W4 measurement logs in out/w4/meas/.
# Each section says how it was measured; see notes/w4.md for the full account.
import os, sys, json, math
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from homog import rect2quad, apply, inv_apply

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MEAS = os.path.join(ROOT, 'out', 'w4', 'meas')
REF = os.path.join(ROOT, 'ref', 'frames')
CW, CH = 582.0, 505.0          # our review card (= the reference card's face-on footprint at n524)
J = lambda f: json.load(open(os.path.join(MEAS, f)))
OUT = {}

def _num(v):
    if not isinstance(v, float): return str(v)
    t = ('%.6f' % v).rstrip('0').rstrip('.'); return t if t not in ('-0', '') else '0'
def tab(d, nd=None):
    return '{ ' + ', '.join('%s: %s' % (k, _num(v)) for k, v in sorted(d.items())) + ' }'

# ───────────── A: first review card n510-554 (dark-card silhouette → four edge lines → corners) ─────────────
qA = {r['n']: r for r in J('qA.json')}
# n511: the bubble crosses the card's top edge; refit the top line on columns 270-440 only (left of the bubble)
g = np.asarray(Image.open(os.path.join(REF, 'n0511.png')).convert('L')).astype(float)
ys = []
for x in range(270, 441):
    v = g[:, x]; i = int(np.argmax(v < 150)); ys.append(i - 1 + (v[i - 1] - 150) / (v[i - 1] - v[i]))
p = np.polyfit(np.arange(270, 441), ys, 1)
T511 = [p[1], p[0]]
r = qA[511]
def isect(V, Hh):
    y = (Hh[0] + Hh[1] * V[0]) / (1 - Hh[1] * V[1]); return [V[0] + V[1] * y, y]
r['TL'] = isect(r['L'], T511); r['TR'] = isect(r['R'], T511)
corners = {}
for n in range(510, 555):
    r = qA[n]; corners[n] = [r['TL'], r['TR'], r['BR'], r['BL']]
# light temporal smoothing (1-2-1) where the card is slow (n514-552); the fast entrance and exit frames stay raw
sm = {}
for n in range(510, 555):
    if 514 <= n <= 552:
        sm[n] = [[(corners[n - 1][i][j] + 2 * corners[n][i][j] + corners[n + 1][i][j]) / 4 for j in range(2)] for i in range(4)]
    else:
        sm[n] = corners[n]
A = {k: {} for k in ['x0', 'y0', 'x1', 'y1', 'x2', 'y2', 'x3', 'y3']}
for n in range(510, 555):
    for i in range(4):
        A['x%d' % i][n] = round(sm[n][i][0], 2); A['y%d' % i][n] = round(sm[n][i][1], 2)
# blur: n510-513 isotropic blur-in (10-90 % edge widths minus the 0.9 px base); n538-554 horizontal motion blur
eb = {json.loads(l)['n']: json.loads(l) for l in open(os.path.join(MEAS, 'blurA.jsonl'))}
A['blur'] = {510: 3.9, 511: 3.1, 512: 2.3, 513: 0.5, 514: 0.0}
# bubble: Scout's centroid (blue blob) mapped into card-local px through the inverse homography
bA = {r['n']: r for r in J('bA.json')}
A['bx'] = {}; A['by'] = {}
for n in range(511, 555):
    Hm = rect2quad(CW, CH, sm[n]); lx, ly = inv_apply(Hm, bA[n]['cx'], bA[n]['cy'])
    A['bx'][n] = round(lx, 2); A['by'][n] = round(ly, 2)
OUT['A'] = A

# A, composition-independent form: n519-554 the card is a rigid 582×505 plane in the deck's camera (P = 1680 about the frame
# centre), pose fitted to the four corners (rms ≤ 0.8 px); n510-518 it is a 2D entry (vertical decay + a horizontal stretch).
import math as _m0
from deckfit2 import nm as _nm0
def _q3(X, Y, Z, th, Hc=505.0):
    c, s_ = _m0.cos(_m0.radians(th)), _m0.sin(_m0.radians(th)); pts = []
    for ox, oy in ((-291.0, -Hc / 2), (291.0, -Hc / 2), (291.0, Hc / 2), (-291.0, Hc / 2)):
        x = X + ox * c; z = Z - ox * s_; y = Y + oy; f = 1680.0 / (1680.0 - z); pts.append((540.0 + x * f, 304.0 + y * f))
    return np.array(pts)
A3 = {k: {} for k in ('X', 'Y', 'Z', 'th', 'rms')}
init = [0.0, 0.0, 0.0, 0.0]
for n in range(519, 555):
    q = np.array(sm[n]); f = lambda p: float(np.sum((_q3(*p) - q) ** 2))
    p, v = _nm0(f, init, [20, 10, 40, 2], 400); p, v = _nm0(f, p, [2, 1, 4, 0.2], 400); init = list(p)
    for i, k in enumerate(('X', 'Y', 'Z', 'th')): A3[k][n] = round(float(p[i]), 3)
    A3['rms'][n] = round(_m0.sqrt(v / 8), 2)
A2 = {'dy': {}, 'sx': {}}
for n in range(510, 522):
    cy = sum(sm[n][i][1] for i in range(4)) / 4; w = ((sm[n][1][0] - sm[n][0][0]) + (sm[n][2][0] - sm[n][3][0])) / 2
    A2['dy'][n] = round(cy - 303.6, 2); A2['sx'][n] = round(w / 582.0, 4)
OUT['A3'] = A3; OUT['A2'] = A2

# ───────────── B: deck n555-622 + landing card n595-640 (3D: P = 1680 about (540, 304), cards rotateY(θ)) ─────────────
# front card poses: deck3d.py (B1, rms < 0.6 px), card 21 refitted here at its own face-on size (582 × H21) from the
# horizon-model quads (deckfront/deckv: left edge, top line, right edge, k = (bottom-304)/(top-304)); deck behind: deckfit3.py.
import math as _m
sys.argv = [sys.argv[0], os.path.join(MEAS, 'sil_deck.jsonl'), os.path.join(MEAS, 'deckf.json'), '/dev/null']
from deckv import front_quad
from deckfit2 import nm
P3 = 1680.0; CX3, CY3 = 540.0, 304.0; H21 = 527.3
def q3(X, Y, Z, th, Hc=CH):
    c, s_ = _m.cos(_m.radians(th)), _m.sin(_m.radians(th)); pts = []
    for ox, oy in ((-CW / 2, -Hc / 2), (CW / 2, -Hc / 2), (CW / 2, Hc / 2), (-CW / 2, Hc / 2)):
        x = X + ox * c; z = Z - ox * s_; y = Y + oy; f = P3 / (P3 - z); pts.append((CX3 + x * f, CY3 + y * f))
    return np.array(pts)
def fitpose(q, init, Hc):
    f = lambda p: float(np.sum((q3(*p, Hc=Hc) - q) ** 2))
    p, v = nm(f, init, [20, 10, 40, 2], 400); p, v = nm(f, p, [2, 1, 4, 0.2], 400); return list(p), _m.sqrt(v / 8)
PO = {int(k): v for k, v in J('deck3d.json')['poses'].items()}
F3 = {int(k): v for k, v in J('deckfit3.json').items()}
QC = {r['n']: r for r in J('qC.json')}
fr = {}
for n in range(556, 595): fr[n] = PO[n][:4]
v1 = np.array(PO[558][:3]) - np.array(PO[557][:3]); v0 = v1 * 0.62
fr[555] = [PO[556][0] - v0[0], PO[556][1] + 10.3, PO[556][2] - v0[2], PO[556][3]]   # first deck frame: pop rise + camera
# card 21: quads n598-622 from the horizon model, n623-640 from quad.py edges (top line, left/right lines) with k = -0.999
def quad21(n):
    if n <= 622: return front_quad(n)
    r = QC[n]; T = r['T']; L = r['L']; R_ = r['R']
    def top_at(x): return T[0] + T[1] * x
    xl = L[0] + L[1] * 200; xr = R_[0] + R_[1] * 200
    tl = [xl, top_at(xl)]; tr = [xr, top_at(xr)]
    if n >= 628:    # face-on, translating: constant height (the k = -1 height at n628)
        h = 2 * (CY3 - (QC[628]['T'][0] + QC[628]['T'][1] * 540)); return np.array([tl, tr, [xr, tr[1] + h], [xl, tl[1] + h]])
    return np.array([tl, tr, [xr, CY3 - 0.999 * (tr[1] - CY3)], [xl, CY3 - 0.999 * (tl[1] - CY3)]])
C21 = {int(k): v for k, v in J('deckb2.json')['card21'].items()}     # the deck's reference pose for n595-622 (deckfit3 used it)
q21 = {}
for n in range(595, 641):
    q21[n] = q3(C21[n][0], 0.0, C21[n][2], C21[n][3], Hc=H21) if n <= 597 else quad21(n)
# light 1-2-1 smoothing of the measured card-21 corners where they are slow (n600-637)
q21s = {}
for n in range(595, 641):
    q21s[n] = (q21[n - 1] + 2 * q21[n] + q21[n + 1]) / 4 if 600 <= n <= 637 else q21[n]
for n in range(595, 623): fr[n] = C21[n]
B = {k: {} for k in ['X', 'Y', 'Z', 'th', 'g', 'lam', 'Yd', 'phi', 'thd', 'sx', 'sy', 'bx', 'by']}
for n in range(555, 623):
    B['X'][n], B['Y'][n], B['Z'][n], B['th'][n] = [round(float(v), 3) for v in fr[n]]
for i in range(4):
    B['qx%d' % i] = {n: round(float(q21s[n][i][0]), 2) for n in range(595, 641)}
    B['qy%d' % i] = {n: round(float(q21s[n][i][1]), 2) for n in range(595, 641)}
# deck behind (n555-622): deckfit3 per-frame (g, λ, Yd, φ), smoothed (5-tap mean on g, λ, φ; outlier frames replaced)
bad = {555, 556, 593, 594, 595, 596}
raw = {n: F3[n] for n in range(555, 623)}
for n in range(555, 623):
    def avg(key):
        vals = [raw[m][key] for m in range(n - 2, n + 3) if m in raw and m not in bad and 557 <= m <= 618]
        return float(np.mean(vals)) if vals else raw[n][key]
    if n <= 556: g_, l_, ph_ = 0.95, 0.95, 23.3
    elif n <= 618: g_, l_, ph_ = avg('g'), avg('lam'), avg('phi')
    else: g_, l_, ph_ = B['g'][618], B['lam'][618], B['phi'][618]
    B['g'][n] = round(g_, 4); B['lam'][n] = round(l_, 4); B['phi'][n] = round(ph_, 3)
    B['Yd'][n] = round(raw[n]['Yd'] if n not in bad else (raw[n - 2]['Yd'] if n > 557 else 22.7), 2)
    B['thd'][n] = round(27.5 if n < 619 else float(fr[n][3]), 3)
# collapse n619-623: the deck squeezes onto card 21; c(n) multiplies (g, λ), fitted to the deck's left extent
sil = {}
for l in open(os.path.join(MEAS, 'sil_deck.jsonl')):
    r = json.loads(l); sil[r['n']] = r
D0n = float(np.linalg.norm(json.load(open(os.path.join(MEAS, 'deckrig.json')))['D0']))
B['col'] = {}
for n in range(555, 619): B['col'][n] = 1.0
for n in (619, 620, 621, 622):
    t = sil[n]['top']; fin = [i for i, v in enumerate(t) if v is not None]; dleft = fin[0] if fin else 0
    X, Y, Z, th = fr[n]; best = None
    for c in np.linspace(0.02, 1.0, 99):
        dd = D0n * np.array([_m.sin(_m.radians(B['phi'][n])), _m.cos(_m.radians(B['phi'][n]))]); xs = []
        for m in range(1, 21):
            a = c * (B['g'][n] + (m - 1) * B['lam'][n]); qq = q3(X - a * dd[0], B['Yd'][n], Z - a * dd[1], B['thd'][n]); xs.append(min(qq[0][0], qq[3][0]))
        e = abs(min(xs) - dleft) if dleft > 0 else max(0, min(xs) - 0)
        if best is None or e < best[1]: best = (c, e)
    B['col'][n] = round(float(best[0]), 3)
B['col'][623] = 0.0
print('collapse', {n: B['col'][n] for n in range(618, 624)})
# blur (σ, px): the front card's right-edge 10-90 % width (horizontal) and top edge (vertical), minus the 0.65 px base
bl = {int(k): v for k, v in J('blurB.json').items()}
for n in range(555, 641):
    sx, sy = bl[n]
    if sx is None: sx = {596: 8.0, 597: 4.5}.get(n, 2.0)
    if sy is None: sy = 0.7
    B['sx'][n] = round(_m.sqrt(max(sx * sx - 0.65 ** 2, 0)), 2); B['sy'][n] = round(_m.sqrt(max(sy * sy - 0.65 ** 2, 0)), 2)
B['sy'][555] = 2.0
# Scout's bubble on card 21: centroid → card-local px (inverse of card 21's projection), n596-640
bB = {r['n']: r for r in J('bB.json')}
for n in range(596, 641):
    if bB.get(n, {}).get('area', 0) < 500: continue
    Hm = rect2quad(CW, H21, q21s[n]); lx, ly = inv_apply(Hm, bB[n]['cx'], bB[n]['cy'])
    B['bx'][n] = round(lx, 2); B['by'][n] = round(ly, 2)
B['P'] = P3; B['H21'] = H21; B['D0'] = round(D0n, 3)
B['expr'] = [[511, 'open'], [596, 'blink'], [605, 'dots'], [615, 'happy'], [628, 'open']]
OUT['B'] = B

# ───────────── D: close-up n641-670 ─────────────
# card: left edge x (rows 60-280) and bottom edge y (columns 1000-1070) per frame (cuedges.py → eD.json); its scale vs the
# face-on card = 2.53 (track.py of n655 against key n630, init 2.2; confirmed by text-row pitch 2.55); the card stays sharp.
# Critic's bubble: orange-blob centroid (blob.py → bD.json), screen space.
eD = {r['n']: r for r in J('eD.json')}; bD = {r['n']: r for r in J('bD.json')}
D = {'xl': {}, 'yb': {}, 'bx': {}, 'by': {}}
for n in range(641, 671):
    D['xl'][n] = eD[n]['xl']; D['yb'][n] = eD[n]['yb']
    D['bx'][n] = bD[n]['cx']; D['by'][n] = bD[n]['cy']
D['bx'][640] = round(2 * bD[641]['cx'] - bD[642]['cx'] * 0.5 - bD[641]['cx'] * 0.5, 2)   # one frame before: same entry speed
D['by'][640] = round(2 * bD[641]['cy'] - bD[642]['cy'] * 0.5 - bD[641]['cy'] * 0.5, 2)
D['scale'] = round(2.53 * 0.9973, 4)
D['expr'] = [[641, 'open'], [652, 'blink'], [661, 'dots']]
OUT['D'] = D

# ───────────── E: thread n743-845 ─────────────
# content offset: frame-to-frame correlation of the panel's row-brightness profile (thread.py → thE.json), accumulated from n743;
# n844-845: the panel's bottom edge (page-gap detection) continues the curve; n846: extrapolated (×1.11) for the blur of the last frame.
thE = {r['n']: r for r in J('thE.json')}
E = {'off': {}}
for n in range(743, 844): E['off'][n] = thE[n]['off']
E['off'][844] = round(253.0 - 2839.0, 2); E['off'][845] = round(99.0 - 2839.0, 2)
E['off'][846] = round(E['off'][845] + 1.11 * (E['off'][845] - E['off'][844]), 2)
E['off'][742] = round(E['off'][743] + 1.4 * (E['off'][743] - E['off'][744]), 2)
# reply arrivals (header fade start, text stream start, text stream end), read on per-frame sheets of the reference
E['rep'] = [[743, 745, 763], [763, 766, 781], [785, 787, 802], [780, 797, 806], [700, 700, 701], [700, 700, 701], [700, 700, 701], [700, 700, 701]]
# (Derek/Kayla/Rosa/Tyler-equivalents stream in; the later replies arrive already complete, as in the reference)
OUT['E'] = E

# ───────────── F: wall n843-921 ─────────────
# Camera = similarity relative to key n880 (frame = s·x880 + t), chained from three track.py runs at --half:
#   key n858 (n849-872), key n880 (n872-886), key n903 (n886-921; mapped to n880 through tF_f[903]).
# Entry n842-849: cards fly up into their grid slots (column-band tracker on the centre column, key n852, gives the profile;
# the stagger col2 → col3 → col1 and rows bottom-up is read from per-frame sheets). Blur: tracker bx/by.
J3 = lambda f: {r['n']: r for r in J(f)}
t3b, t3f, tfb, tff, t2b, t2f = J3('tF3_b.json'), J3('tF3_f.json'), J3('tF_b.json'), J3('tF_f.json'), J3('tF2_b.json'), J3('tF2_f.json')
def chain(r, K):   # r relative to key frame; K = (s, tx, ty) of that key relative to n880
    return (r['s'] * K[0], r['s'] * K[1] + r['tx'], r['s'] * K[2] + r['ty'], r['bx'], r['by'])
K858 = (tfb[858]['s'], tfb[858]['tx'], tfb[858]['ty']); K903 = (tff[903]['s'], tff[903]['tx'], tff[903]['ty'])
F = {'s': {}, 'tx': {}, 'ty': {}, 'bx': {}, 'by': {}}
for n in range(849, 922):
    if n <= 858: v = chain(t3b[n], K858)
    elif n <= 872: v = chain(t3f[n], K858)
    elif n < 886: r = tfb[n] if n <= 880 else tff[n]; v = (r['s'], r['tx'], r['ty'], r['bx'], r['by'])
    else: v = chain(t2b[n] if n <= 903 else t2f[n], K903)
    F['s'][n] = round(v[0], 5); F['tx'][n] = round(v[1], 2); F['ty'][n] = round(v[2], 2)
    src = t3b if n <= 858 else t3f if n <= 872 else (tfb if n <= 880 else tff) if n < 886 else (t2b if n <= 903 else t2f)
    ok = src[n]['ncc'] > 0.85 and n >= 853                       # blur is only trusted where the model fits
    F['bx'][n] = round(min(v[3], 3.0), 2) if ok else 0.0; F['by'][n] = round(min(v[4], 3.0), 2) if ok else 0.0
for n in range(842, 849):
    F['s'][n] = F['s'][849]; F['tx'][n] = F['tx'][849]; F['ty'][n] = F['ty'][849]; F['bx'][n] = 0.0; F['by'][n] = 0.0
F['entry'] = [499, 381, 211, 89, 34, 16, 8, 4, 2, 1, 0]     # screen px below the slot, per frame from the card's start
F['t0'] = 842                                               # centre column, middle row starts here
F['grid'] = {'x0': 191.0, 'px': 238.67, 'y0': 196.0, 'py': 229.75, 'w': 223.0, 'h': 202.0}
OUT['F'] = F
# ───────────── G: featured card n922-970 ─────────────
# rest quad (quad.py, n944-948): TL (277.1, 65.1), 522 × 476.6. Vertical: the card's bottom edge (page-gap runs n923-926,
# quad.py n927-947) relative to rest; the card below it in the column sits 714.6 px further down (n923-926).
# Exit n948-970: the card's left edge (quad.py) relative to rest; n969 = n970 is a duplicated frame in the reference.
qG = {r['n']: r for r in J('qG.json')}
G = {'dy': {}, 'dx': {}, 'sy': {}, 'sx': {}}
bot = {922: -69.0, 923: 80.0, 924: 190.0, 925: 271.0, 926: 333.0}
for n in range(927, 948): bot[n] = qG[n]['BR'][1]
for n in range(948, 971): bot[n] = qG[n]['BR'][1]
for n in range(922, 971):
    G['dy'][n] = round(bot[n] - 541.71, 3)
    G['dx'][n] = round(qG[n]['TL'][0] - 277.11, 3) if n >= 927 else 0.0     # includes the sub-pixel drift of the hold
G['dy'][921] = round(G['dy'][922] - 1.35 * (G['dy'][923] - G['dy'][922]), 2)
for n in range(922, 971):
    vy = G['dy'].get(n + 1, G['dy'][n]) - G['dy'][n - 1] if n > 922 else (G['dy'][923] - G['dy'][921]) / 2
    vy = vy / 2 if n > 922 else vy
    G['sy'][n] = round(0.13 * abs(vy), 2)
tgf = J3('tG_f.json')
for n in range(948, 971): G['sx'][n] = tgf[n]['bx']
G['rest'] = [277.11, 65.14, 522.0, 476.6]; G['pitch'] = 714.6
OUT['G'] = G

# ───────────── write ─────────────
lines = ["'use strict';", "// W4 measured motion (reference frames n, 1080x608 px). Generated by tools/w4/build_motion.py from out/w4/meas/.",
         "// Every number is a measurement of ~/Downloads/higgsfield02.mp4; see notes/w4.md for the method per curve.", "window.MW4 = {"]
for sec, d in OUT.items():
    lines.append('  %s: {' % sec)
    for k, v in d.items():
        if isinstance(v, dict): lines.append('    %s: %s,' % (k, tab(v)))
        else: lines.append('    %s: %s,' % (k, json.dumps(v)))
    lines.append('  },')
lines.append('};')
open(os.path.join(ROOT, 'motion', 'w4.js'), 'w').write('\n'.join(lines) + '\n')
print('wrote motion/w4.js', {k: len(v) for k, v in OUT.items()})
