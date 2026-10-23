# Compare tracker logs (reference vs ours) for the same key/range: per-frame tx/ty/s/blur deltas, velocity peaks.
# usage: cmptrack.py <ref.log> <ours.log> [label]
import sys, json
def rd(p):
    out = {}
    for l in open(p):
        l = l.strip()
        if not l.startswith('{'): continue
        r = json.loads(l); out[r['n']] = r
    return out
A, B = rd(sys.argv[1]), rd(sys.argv[2]); lab = sys.argv[3] if len(sys.argv) > 3 else ''
ns = sorted(set(A) & set(B))
print('== %s  frames %d..%d' % (lab, ns[0], ns[-1]))
mx = {'tx': 0, 'ty': 0, 's': 0}
for n in ns:
    a, b = A[n], B[n]
    d = {k: b[k] - a[k] for k in ('tx', 'ty', 's')}
    for k in mx: mx[k] = max(mx[k], abs(d[k]) if a['ncc'] > 0.9 else 0)
    print('n%d  ref tx %8.2f ty %8.2f s %.4f b %.2f/%.2f ncc %.3f | ours tx %8.2f ty %8.2f s %.4f b %.2f/%.2f ncc %.3f | d %6.2f %6.2f' % (
        n, a['tx'], a['ty'], a['s'], a['bx'], a['by'], a['ncc'], b['tx'], b['ty'], b['s'], b['bx'], b['by'], b['ncc'], d['tx'], d['ty']))
print('max |d| over frames with ref ncc>0.9: tx %.2f ty %.2f s %.4f' % (mx['tx'], mx['ty'], mx['s']))
