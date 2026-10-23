# Lockup build: the first mark's own offset (camera removed), reference vs ours.
# n<=14: centroid of the mark's dark blob (merged pieces); n>=15: track_roi (T2 ref on icon+word, O2 ours on the mark).
import json, math
def load(p):
    L = {}
    for line in open(p):
        n, js = line.split(' ', 1); L[int(n)] = json.loads(js)
    return L
R, O = load('logs/blobs_open.log'), load('logs/blobs_ours_open.log')
T2 = {r['n']: r for r in (json.loads(l) for l in open('logs/T2_build.log') if l.startswith('{'))}
O2 = {r['n']: r for r in (json.loads(l) for l in open('logs/O2_build.log') if l.startswith('{'))}
cam = lambda n: 1 + 0.00038 * (n - 45)
def mark(L, n, x, w0):
    cs = [c for c in L.get(n, {}).get('dark', []) if abs(c[0] - x) < 40 and c[4] > 30 and c[2] < 1.4 * w0]
    if not cs: return None
    A = sum(c[4] for c in cs); return (sum(c[0] * c[4] for c in cs) / A, sum(c[1] * c[4] for c in cs) / A)
# rest centres at n45 (frame px): ref icon (175, 270); ours mark from the blob log
ro = mark(O, 45, 246, 76); rr = (175.0, 270.1)
rows = {}
xr = 341.0; xo = ro[0] + 160.7
for n in range(1, 46):
    s = cam(n)
    if n <= 14:
        a = mark(R, n, xr, 72); b = mark(O, n, xo, 76)
        if a: xr = a[0]
        if b: xo = b[0]
        fa = (a[0] - (546 + s * (rr[0] - 546)), a[1] - (300 + s * (rr[1] - 300))) if a else None
        fb = (b[0] - (546 + s * (ro[0] - 546)), b[1] - (300 + s * (ro[1] - 300))) if b else None
    else:
        t, o = T2.get(n), O2.get(n)
        fa = (t['tx'] - 546 * (1 - t['s']), t['ty'] - 300 * (1 - t['s'])) if t else None
        fb = (o['tx'] - 546 * (1 - o['s']), o['ty'] - 300 * (1 - o['s'])) if o else None
    rows[n] = (fa, fb)
print('| n | offX ref | offX ours | offY ref | offY ours |'); print('|---|---|---|---|---|')
for n in range(1, 46):
    fa, fb = rows[n]
    f = lambda v, i: '%.1f' % v[i] if v else '-'
    print('| %d | %s | %s | %s | %s |' % (n, f(fa, 0), f(fb, 0), f(fa, 1), f(fb, 1)))
def peak(i, a, b, sign):
    j = 0 if a == 'x' else 1
    v = {n + 0.5: rows[n + 1][i][j] - rows[n][i][j] for n in range(b[0], b[1]) if rows[n][i] and rows[n + 1][i]}
    k = max(v, key=lambda m: sign * v[m]); return k, v[k]
for lab, ax, rng, sg in (('slide x (n9-22)', 'x', (9, 22), -1), ('drop y (n1-6)', 'y', (1, 6), -1), ('pill rise y (n28-40)', 'y', (28, 40), -1)):
    kr, vr = peak(0, ax, rng, sg); ko, vo = peak(1, ax, rng, sg)
    print('%-20s peak ref n%.1f %.1f px/f | ours n%.1f %.1f px/f (%+.0f%%)' % (lab, kr, vr, ko, vo, 100 * (vo / vr - 1)))
