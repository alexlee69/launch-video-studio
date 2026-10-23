#!/bin/bash
# W2 QA: track our renders with the same tools used on the reference and print the comparisons.
# Needs: out/w2/f1 (n95–263), out/w2/f2 (n1529–1697) from render.mjs; out/w2/qa0 (n95–112), qa1 (n120–236), qa2 (n1586–1628),
# qa3 (n1529–1553) from tools/w2/render_qa.mjs (flat plates). Reference logs live in tools/w2/logs, ours go to tools/w2/logs/ours.
set -u
cd "$(dirname "$0")"
F=../../ref/frames; O=../../out/w2; L=logs/ours; mkdir -p $L
P="python3 -E"
echo "### plate 1 camera (pairwise chain, mask 0,0,820,350; framing 3 masks the mug: 300,0,820,350)"
$P trackp.py $O/f1 99 112 $L/p1c.json --half --mask 200,120,800,490 > $L/p1c.log &
$P trackp.py $O/f1 112 230 $L/p1a.json --half --mask 0,0,820,350 > $L/p1a.log &
$P trackp.py $O/f1 228 263 $L/p1b3.json --half --mask 300,0,820,350 > $L/p1b3.log &
$P trackp.py $O/f2 1553 1628 $L/p2.json --half --mask 120,0,1080,370 > $L/p2.log &
wait
echo "-- card interior n99–112";  $P qa_cam.py logs/p1_pair_c.log $L/p1c.log | tail -5
echo "-- push n112–230";          $P qa_cam.py logs/p1_pair_a.log $L/p1a.log | tail -5
echo "-- ease-back n228–263";     $P qa_cam.py logs/p1_pair_b2.log $L/p1b3.log | tail -5
echo "### plate 2 camera n1553–1628"; $P qa_cam.py logs/p2_ref_steps.log $L/p2.log | tail -5
echo "### plate 1 card (flat QA render): scale, corner diagonal, edge blur"
$P margins.py $O/qa0 97 110 > $L/p1_margins.jsonl
paste <($P corner.py $F 97 110) <($P corner.py $O/qa0 97 110) > $L/p1_corner.tsv
$P - <<'EOF'
import json, statistics as st
ref = {97: .4991, 98: .6034, 99: .684, 100: .7487, 101: .8012, 102: .844, 103: .8793, 104: .9089, 105: .9332, 106: .9526, 107: .9687, 108: .9808, 109: .9899, 110: .9963}
ms = {json.loads(l)['n']: json.loads(l) for l in open('logs/ours/p1_margins.jsonl')}
ds, dd, rs = [], [], []
for l in open('logs/ours/p1_corner.tsv'):
    a, b = [json.loads(x) for x in l.strip().split('\t')]
    n = a['n']; m = ms[n]
    ds.append(abs(m['sw'] - ref[n]) * 1080); dd.append(abs(st.median(b['diag']) - st.median(a['diag']))); rs.append(b['sigL'] / a['sigL'])
    print(n, 'scale ref %.4f ours %.4f | corner diag ref %.2f ours %.2f | edge sigma ref %.2f ours %.2f' % (ref[n], m['sw'], st.median(a['diag']), st.median(b['diag']), a['sigL'], b['sigL']))
print('max |Δwidth| %.1f px, max |Δdiag| %.2f px (n98–110: %.2f), sigma ratio %.2f–%.2f' % (max(ds), max(dd), max(dd[1:]), min(rs), max(rs)))
EOF
