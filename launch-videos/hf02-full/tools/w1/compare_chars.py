# Character motion, reference vs ours (blob tool on both): pops/pulses (scale vs rest), converge progress, corridor tracks.
import json, math, sys
def load(p):
    L = {}
    for line in open(p):
        n, js = line.split(' ', 1); L[int(n)] = json.loads(js)
    return L
R, O = load('logs/blobs_open.log'), load('logs/blobs_ours_open.log')
def follow(L, cls, seed, a, b, rad, minA=15, big=False):
    px, py = seed; out = {}
    for n in range(a, b + 1):
        if n not in L: continue
        best = None
        for c in L[n].get(cls, []):
            dd = math.hypot(c[0] - px, c[1] - py)
            if dd < rad and c[4] >= minA:
                key = -c[4] if big else dd
                if best is None or key < best[0]: best = (key, c)
        if best: out[n] = best[1]; px, py = best[1][0], best[1][1]
    return out
# slot → (ref class, ref seed n<=45), (our class, our seed)
S = {'green': (('green', (898, 498)), ('green', (842, 492))), 'tri': (('dark', (133, 498)), ('dark', (92, 302))),
     'blue': (('blue', (521, 136)), ('blue', (752, 104))), 'orange': (('orange', (178, 126)), ('orange', (338, 98))),
     'purple': (('purple', (562, 472)), ('purple', (262, 496)))}
res = {}
print('## pops and pulses: blob width / rest width (rest = median n36-45)')
for k, ((rc, rs), (oc, os_)) in S.items():
    r = follow(R, rc, rs, 0, 50, 70, big=True); o = follow(O, oc, os_, 0, 50, 70, big=True)
    rr = sorted(v[2] for n, v in r.items() if 36 <= n <= 45)[5]; orr = sorted(v[2] for n, v in o.items() if 36 <= n <= 45)[5]
    rs_ = {n: r[n][2] / rr for n in r}; os2 = {n: o[n][2] / orr for n in o}
    res[k] = (rs_, os2)
    first_r = min(n for n in rs_ if rs_[n] > 0.05); first_o = min(n for n in os2 if os2[n] > 0.05)
    # pop peak = max scale within 7 frames of the first frame; pulse = max after that
    pr = max(range(first_r, first_r + 7), key=lambda n: rs_.get(n, 0)); po = max(range(first_o, first_o + 7), key=lambda n: os2.get(n, 0))
    win = range(first_r + 8, 40)
    qr = max(win, key=lambda n: rs_.get(n, 0)); qo = max(win, key=lambda n: os2.get(n, 0))
    def sub(d, n):   # sub-frame peak by a parabola through n-1, n, n+1
        a, b, c = d.get(n - 1, 0), d.get(n, 0), d.get(n + 1, 0); den = a - 2 * b + c
        return n + (0.5 * (a - c) / den if den < 0 else 0), b
    print('%-7s first visible ref n%d ours n%d | pop peak ref n%.2f (%.2f) ours n%.2f (%.2f) | pulse peak ref n%.2f (%.2f) ours n%.2f (%.2f)' % (
        k, first_r, first_o, *sub(rs_, pr), *sub(os2, po), *sub(rs_, qr), *sub(os2, qo)))
    print('   ref ', ' '.join('%d:%.2f' % (n, rs_[n]) for n in range(first_r, first_r + 9) if n in rs_))
    print('   ours', ' '.join('%d:%.2f' % (n, os2[n]) for n in range(first_o, first_o + 9) if n in os2))
json.dump({k: [{str(n): v for n, v in a.items()}, {str(n): v for n, v in b.items()}] for k, (a, b) in res.items()}, open('logs/compare_pops.json', 'w'))
