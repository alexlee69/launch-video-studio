# -*- coding: utf-8 -*-
# finish.py's picks check must catch a wrong master-frame pick that its cadence check can't see. Build the same frames
# twice, with finish.py's own index map (ceil(2.5·m)) and with a floor map (every odd edit frame one master frame early,
# the cadence untouched), and QA both against the TRUE map: ceil must pass, floor must fail.
#   /usr/bin/python3 -B picks_harness.py MASTER.mp4 OUTDIR N      exit 0 = ceil passes and floor fails
import math, os, shutil, sys, tempfile
from fractions import Fraction
V = os.path.expanduser('~/.claude/skills/product-launch-sting/video')
sys.path.insert(0, os.path.join(V, 'recreate')); sys.dont_write_bytecode = True
import finish as F

master, outdir, N = sys.argv[1], sys.argv[2], int(sys.argv[3])
P, S, O = 15, (5, 10, 14), Fraction(30)
Fr = Fraction(F.probe(master)['video']['rate'])
true_map = F.index_map


def floor_map(N, P, S, Fr, O, starts=None, clamped=None):
    mp, M = true_map(N, P, S, Fr, O)
    return [(m, math.floor(Fraction(m) * Fr / M)) for m, _ in mp], M


class A:
    lufs, tp = -14.0, -1.0


os.makedirs(outdir, exist_ok=True)
res = {}
for name, fn in (('ceil', true_map), ('floor', floor_map)):
    out = os.path.join(outdir, 'picks-%s.mp4' % name)
    tmp = tempfile.mkdtemp(prefix='picks-')
    F.index_map = fn
    try:
        v = F.build_video(master, out, N, P, S, O, None, tmp, 16)
    finally:
        F.index_map = true_map
        shutil.rmtree(tmp, ignore_errors=True)
    diff = sum(1 for (_, j), (_, j2) in zip(v['map'], true_map(N, P, S, Fr, O)[0]) if j != j2)
    print('%s map: %d of %d output frames take another master frame than the true map; QA against the true map:' % (name, diff, N))
    res[name] = F.qa(out, master, N, O, P, S, (P, S), A, None)
ok = res['ceil'] and not res['floor']
print('RESULT ceil %s, floor %s → %s' % ('passes' if res['ceil'] else 'FAILS', 'fails' if not res['floor'] else 'PASSES',
                                         'PASS: the picks check catches the floor map' if ok else 'FAIL'))
sys.exit(0 if ok else 1)
