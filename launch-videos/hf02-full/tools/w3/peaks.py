# QA table: camera/element speeds and peak frames, reference vs ours, from the tracker/template logs.
import json, sys
sys.path.insert(0, 'tools/w3')
def rd(p, kx='tx', ky='ty'):
    out = {}
    for l in open(p):
        l = l.strip()
        if l.startswith('{'):
            r = json.loads(l); out[r['n']] = (r.get(kx, r.get('dx')), r.get(ky, r.get('dy')), r['ncc'])
    return out
def merge(*ds):
    o = {}
    for d in ds: o.update(d)
    return o
def rel(A, B):   # A minus B (landmark relative to another)
    return {n: (A[n][0] - B[n][0], A[n][1] - B[n][1], min(A[n][2], B[n][2])) for n in A if n in B}
def v(d, n, axis):   # speed between n-0.5 and n+0.5 → reported at n+0.5
    return d[n + 1][axis] - d[n][axis] if n in d and n + 1 in d else None
def peak(d, a, b, axis):
    vs = {n + 0.5: v(d, n, axis) for n in range(a, b) if v(d, n, axis) is not None}
    ks = sorted(vs); best = max(ks, key=lambda k: abs(vs[k])); i = ks.index(best)
    if 0 < i < len(ks) - 1:
        y0, y1, y2 = abs(vs[ks[i - 1]]), abs(vs[best]), abs(vs[ks[i + 1]]); den = y0 - 2 * y1 + y2
        off = 0.5 * (y0 - y2) / den if den != 0 else 0
    else: off = 0
    return best + off, abs(vs[best])
C, O = 'tools/w3/curves/', 'tools/w3/ours/'
S = '../hf02-skill/ref/curves/'
rows = []
def row(label, R, Ov, a, b, axis, kind='peak'):
    if kind == 'peak':
        (fr, sr), (fo, so) = peak(R, a, b, axis), peak(Ov, a, b, axis)
        rows.append((label, '%.2f' % fr, '%.2f' % fo, '%.2f' % (fo - fr), '%.1f' % sr, '%.1f' % so, '%+.1f%%' % (100 * (so - sr) / sr)))
    else:   # mean drift speed over [a, b]
        sr = (R[b][axis] - R[a][axis]) / (b - a); so = (Ov[b][axis] - Ov[a][axis]) / (b - a)
        rows.append((label, '-', '-', '-', '%.2f' % sr, '%.2f' % so, '%+.2f px/f' % (so - sr)))
# A: chat opens (mascot landmark = camera)
Am, Amo = rd(C + 'A_m.log'), rd(O + 'A_m3.log')
row('A  entrance rise n264-266 (y)', Am, Amo, 264, 266, 1)
row('A  drift n272-286 (y)', Am, Amo, 272, 286, 1, 'drift')
row('A  exit pan n300-311 (x)', Am, Amo, 300, 311, 0)
Arep, Arepo = rel(rd(C + 'A_rep.log'), Am), rel(rd(O + 'A_rep.log'), Amo)
row('A  reply rise vs camera n265-272 (y)', Arep, Arepo, 265, 272, 1)
An = rel({r['n']: (r['dx'], r['dy'], r['ncc']) for r in json.load(open(C + 'A_name.json'))}, Am); Ano = rel(rd(O + 'A_name.log'), Amo)
row('A  name glide vs camera n268-290 (x)', An, Ano, 268, 290, 0, 'drift')
# B: window (global tracker, key 325 / 345)
B1 = merge(rd(S + 'B1r.log'), rd(S + 'B1f.log')); B1o = merge(rd(O + 'B1r.log'), rd(O + 'B1f.log'))
row('B  entrance n312-316 (x)', B1, B1o, 312, 316, 0)
row('B  drift n318-325 (x)', B1, B1o, 318, 325, 0, 'drift')
B2 = merge(rd(S + 'B2r.log'), rd(S + 'B2f.log')); B2o = merge(rd(O + 'B2r.log'), rd(O + 'B2f.log'))
# stitch key-325 and key-345 logs: the key-325 layout sits at B.tx(325) = -154.0 relative to n345 (motion.js)
B12 = merge({n: (x[0] - 154.0, x[1], x[2]) for n, x in B1.items() if n <= 333}, B2)
B12o = merge({n: (x[0] - 154.0, x[1], x[2]) for n, x in B1o.items() if n <= 333}, B2o)
row('B  sidebar pan peak n326-344 (x)', B12, B12o, 326, 344, 0)
row('B  tilt into dissolve n350-357 (y)', B2, B2o, 350, 357, 1)
# D: second chat (key 470 / 500)
D1 = merge(rd(S + 'D1r.log'), rd(S + 'D1f.log')); D1o = merge(rd(O + 'D1r.log'), rd(O + 'D1f.log'))
row('D  entrance n465-470 (y)', D1, D1o, 465, 470, 1)
D2 = merge(rd(S + 'D2r.log'), rd(S + 'D2f.log')); D2o = merge(rd(O + 'D2r.log'), rd(O + 'D2f.log'))
row('D  chat scroll peak n480-492 (y)', D2, D2o, 480, 491, 1)
row('D  exit n500-509 (y)', D2, D2o, 500, 509, 1)
# R: research (name = camera x + text rise, mascot = camera y)
Rn, Rno = rd(C + 'R_name.log'), rd(O + 'R_name3.log'); Rm, Rmo = rd(C + 'R_m.log'), rd(O + 'R_m3.log')
row('R  entrance n672-676 (x)', Rn, Rno, 672, 676, 0)
row('R  drift n684-694 (y)', Rm, Rmo, 684, 694, 1, 'drift')
row('R  exit n705-718 (y)', Rm, Rmo, 705, 718, 1)
# G: big type
Gm, Gmo = rd(C + 'G_m.log'), rd(O + 'G_m3.log')
row('G  entrance n719-723 (y)', Gm, Gmo, 719, 723, 1)
row('G  drift n728-736 (y)', Gm, Gmo, 728, 736, 1, 'drift')
row('G  exit n736-742 (y)', Gm, Gmo, 736, 742, 1)
Gh, Gho = rel(rd(C + 'G_heres.log'), Gm), rel(rd(O + 'G_heres3.log'), Gmo)
row('G  new line rise vs camera n721-731 (y)', Gh, Gho, 721, 731, 1)
# I: insights
Ih, Iho = rd(C + 'I_head.log'), rd(O + 'I_head3.log')
row('I  entrance n971-975 (x)', Ih, Iho, 971, 975, 0)
row('I  exit n990-998 (y)', Ih, Iho, 990, 998, 1)
Ia, Iao = rel(rd(C + 'I_ava.log'), Ih), rel(rd(O + 'I_ava3.log'), Iho)
row('I  header sweep peak n973-980 (x)', Ia, Iao, 973, 980, 0)
w = [max(len(str(r[i])) for r in rows + [('measure', 'ref peak f', 'ours peak f', 'Δf', 'ref px/f', 'ours px/f', 'Δ')]) for i in range(7)]
hdr = ('measure', 'ref peak f', 'ours peak f', 'Δf', 'ref px/f', 'ours px/f', 'Δ')
print('| ' + ' | '.join(hdr) + ' |'); print('|' + '|'.join('---' for _ in hdr) + '|')
for r in rows: print('| ' + ' | '.join(str(x) for x in r) + ' |')
