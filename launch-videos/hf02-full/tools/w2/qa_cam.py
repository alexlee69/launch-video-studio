# Compare per-frame camera steps of two pairwise-chained tracks (trackp.py logs): zoom rate (%/f) and frame-centre motion (px/f).
# usage: qa_cam.py <ref.log> <ours.log> [--skip n1,n2]   (prints a table + summary; json lines in each log)
import sys, json, math
def rd(p):
    out = {}
    for l in open(p):
        l = l.strip()
        if l.startswith('{'):
            r = json.loads(l); out[r['n']] = r
    return out
A, B = rd(sys.argv[1]), rd(sys.argv[2])
skip = set(int(v) for v in sys.argv[sys.argv.index('--skip') + 1].split(',')) if '--skip' in sys.argv else set()
def step(r):   # step from n-1 to n: zoom % and the motion of the frame centre (540,304)
    ds, dx, dy = r['ds'], r['dtx'], r['dty']
    return (ds - 1) * 100, (ds - 1) * 540 + dx, (ds - 1) * 304 + dy
rows = []
for n in sorted(set(A) & set(B)):
    if n == min(A) or n in skip: continue
    za, xa, ya = step(A[n]); zb, xb, yb = step(B[n])
    rows.append((n, za, zb, xa, xb, ya, yb, A[n]['ncc'], B[n]['ncc']))
print('   n | zoom%/f ref  ours |  cx px/f ref  ours |  cy px/f ref  ours | ncc ref ours')
for r in rows: print('%4d | %7.3f %7.3f | %7.2f %7.2f | %7.2f %7.2f | %.3f %.3f' % r)
def peak(col):
    i = max(range(len(rows)), key=lambda k: abs(rows[k][col])); return rows[i][0], rows[i][col]
for name, ca, cb in (('zoom', 1, 2), ('cx', 3, 4), ('cy', 5, 6)):
    pa, pb = peak(ca), peak(cb)
    md = max(abs(r[ca] - r[cb]) for r in rows); mean = sum(abs(r[ca] - r[cb]) for r in rows) / len(rows)
    print(f'{name:5s} peak ref n{pa[0]} {pa[1]:+.3f} | ours n{pb[0]} {pb[1]:+.3f} | speed ratio {pb[1] / pa[1] if pa[1] else float("nan"):.3f} | max|Δ| {md:.3f} mean|Δ| {mean:.3f}')
# cumulative end state
def last(D): n = max(D); return n, D[n]['s'], D[n]['tx'], D[n]['ty']
print('end ref ', last(A)); print('end ours', last(B))
