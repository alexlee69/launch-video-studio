# Compare landmark (template) tracks: reference vs ours, optionally relative to another landmark (dx/dy of A minus B)
# usage: cmplm.py <ref.log> <ours.log> [--rel refB.log oursB.log] [--from n] [--to n]
import sys, json
def rd(p):
    out = {}
    for l in open(p):
        l = l.strip()
        if l.startswith('{'): r = json.loads(l); out[r['n']] = r
    return out
a = sys.argv
R, O = rd(a[1]), rd(a[2])
RB = OB = None
if '--rel' in a: i = a.index('--rel'); RB, OB = rd(a[i + 1]), rd(a[i + 2])
lo = int(a[a.index('--from') + 1]) if '--from' in a else -1; hi = int(a[a.index('--to') + 1]) if '--to' in a else 99999
mx = [0, 0]; rows = []
for n in sorted(set(R) & set(O)):
    if not (lo <= n <= hi): continue
    r, o = R[n], O[n]
    rx, ry, ox, oy = r['dx'], r['dy'], o['dx'], o['dy']
    if RB is not None:
        if n not in RB or n not in OB: continue
        rx -= RB[n]['dx']; ry -= RB[n]['dy']; ox -= OB[n]['dx']; oy -= OB[n]['dy']
    good = r['ncc'] > 0.9 and o['ncc'] > 0.9
    if good: mx = [max(mx[0], abs(ox - rx)), max(mx[1], abs(oy - ry))]
    print('n%d ref %7.2f %7.2f (%.3f)  ours %7.2f %7.2f (%.3f)  d %6.2f %6.2f%s' % (n, rx, ry, r['ncc'], ox, oy, o['ncc'], ox - rx, oy - ry, '' if good else '  *'))
print('max |d| (both ncc>0.9): dx %.2f dy %.2f   (* = a tracker lost lock: streaming/blurred content)' % tuple(mx))
