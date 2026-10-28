# -*- coding: utf-8 -*-
# Where cuts land and how footage moves after finish.py's 24p-in-30p pass, end to end on a synthetic film. Reference
# cuts at every residue mod 15 (the 12 that aren't repeat slots, plus one listed on slot 5); every shot is "footage" the
# way lv.mjs shows it: a 24 fps plate that starts on the shot's first master frame f_k (plate frame p from f_k +
# round(2.5·p) — measured on manus2-space's own master), a bar that steps once per plate frame over the shot's own grey.
# Each master is finished by finish.py (--pattern 15:5,10,14) and the 30 fps output read back: the cut frames (the
# grey changes) and the holds (a non-slot frame that repeats the one before).
#   A  · shots at n/30 s, --cuts none (one clock, no clamp) → cuts at n % 15 ∈ {4, 9} and the slot cut land a frame
#        early, and every shot that starts on one of them judders (skip a plate frame, hold one) for its whole length
#   C  · the same master, its out/main/timeline.json (the default) → every cut on n (the slot cut on its slot); the only
#        holds are the frames finish.py lists as clamped, and they are exactly the last frames of the shots whose edit
#        frames outnumber their master frames (f_k + ceil(2.5·e_last) ≥ f_k+1: here the 34-frame shot from n30 and the
#        9-frame shot from n405 — both start on n % 15 = 0 and are 4 mod 5 frames long)
#   C2 · the same master, --cuts cuts.txt (shot starts in output frames) → the same video as C, byte for byte
#   D  · one shot starting on an odd master frame (as a beats: shot can), its timeline.json → that cut lands on
#        ceil(f/2) (the first output frame on or after the shot's start), and nothing judders
# The same measurement must catch each broken half of the fix (finish.py's own build_video with its index map swapped):
#   G  · the film's grid, clamped (ceil(2.5·m) kept inside each shot — the first fix tried on manus2-space) → every cut
#        lands, but every shot that starts on n % 15 = 4 or 9 judders all shot long
#   U  · each shot's own clock, unclamped → no judder, but the last frame of each shot that outlasts its master frames
#        shows the next shot: those cuts (n64, n414) land a frame early, and their first frames repeat it
#   /usr/bin/python3 -B shots_test.py OUTDIR        exit 0 = every claim holds
import json, math, os, re, shutil, subprocess, sys, tempfile
from fractions import Fraction
import numpy as np
V = os.path.expanduser('~/.claude/skills/product-launch-sting/video')
FI = ['/usr/bin/python3', '-B', os.path.join(V, 'recreate', 'finish.py')]
sys.path.insert(0, os.path.join(V, 'recreate')); sys.dont_write_bytecode = True
import finish as F

out = sys.argv[1]; os.makedirs(out, exist_ok=True)
P, S, O, FM = 15, (5, 10, 14), 30, 60
cuts = [30, 64, 92, 123, 154, 186, 217, 248, 279, 311, 342, 373, 391, 405, 414, 444, 470]
N = 510
W, H = 320, 180


def master(d, bounds):
    """d/master.mp4 at 60 fps + d/out/main/timeline.json (as lv.mjs writes it)"""
    os.makedirs(os.path.join(d, 'out', 'main'), exist_ok=True)
    json.dump({'renderFps': FM, 'fps': O, 'frames': N * FM // O, 'cuts': bounds[1:]}, open(os.path.join(d, 'out', 'main', 'timeline.json'), 'w'))
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', '%dx%d' % (W, H), '-r', str(FM), '-i', '-',
                            '-vf', 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv',
                            '-c:v', 'libx264', '-crf', '8', '-preset', 'fast', '-pix_fmt', 'yuv420p',
                            '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
                            os.path.join(d, 'master.mp4')], stdin=subprocess.PIPE)
    k = 0
    for f in range(N * FM // O):
        while k + 1 < len(bounds) and f >= bounds[k + 1]:
            k += 1
        fr = np.full((H, W), 40 + 8 * (k % 15), np.uint8)              # greys 40 … 152 under a bar of 250
        x = (8 * ((2 * (f - bounds[k])) // 5)) % (W - 16)              # plate frame p = 2·(f − f_k) // 5
        fr[60:120, x:x + 16] = 250
        enc.stdin.write(fr.tobytes())
    enc.stdin.close()
    assert enc.wait() == 0
    return os.path.join(d, 'master.mp4')


def read_back(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True).stdout
    g = np.frombuffer(raw, np.uint8).reshape(-1, H, W)
    shot = [int(round((g[i, 140:176, :].mean() - 40) / 8)) for i in range(len(g))]
    bar = [int(np.argmax(g[i, 85:95, :].mean(0) > 200)) for i in range(len(g))]
    cut = [i for i in range(1, len(g)) if shot[i] != shot[i - 1]]
    hold = [i for i in range(1, len(g)) if i % P not in S and shot[i] == shot[i - 1] and bar[i] == bar[i - 1]]
    return cut, hold


def finish(m, o, *extra):
    r = subprocess.run(FI + ['--master', m, '--out', o, '--pattern', '15:5,10,14', '--no-audio'] + list(extra), capture_output=True, text=True)
    open(o[:-4] + '.log', 'w').write(r.stdout + r.stderr + 'exit=%d\n' % r.returncode)
    return r.returncode, r.stdout


def overflow(bounds):
    """the last output frame of every shot whose last edit frame falls past its master frames (bounds: master starts)"""
    mo = lambda n: (n // P) * 12 + n % P - sum(1 for s in S if s <= n % P)
    ns = [math.ceil(f * O / FM) for f in bounds] + [N]
    return [ns[k + 1] - 1 for k in range(len(bounds) - 1)
            if bounds[k] + math.ceil(2.5 * (mo(ns[k + 1] - 1) - mo(ns[k]))) > bounds[k + 1] - 1]


def show(name, got, want, holds, want_holds, note):
    ok = got == want and holds == want_holds
    print('%s: cuts %s; holds %s (claimed %s) %s' % (name, 'as claimed' if got == want else 'NOT as claimed',
                                                      holds or 'none', want_holds or 'none', note))
    for n, g, w in zip(cuts, got, want):
        if g != n or g != w:
            print('    n%-4d r%-2d → n%-4d %+d%s' % (n, n % P, g, g - n, '' if g == w else '   (claimed n%d)' % w))
    return ok


ok = True
early = [n for n in cuts if n % P in (4, 9, 5)]
starts_of = dict(zip(cuts, [0] + cuts[:-1]))
judder = sorted(set(h for c in cuts if c % P in (4, 9) for h in range(c + 2, (cuts + [N])[cuts.index(c) + 1]) if h % P not in S))

mA = master(os.path.join(out, 'A'), [0] + [2 * n for n in cuts])
open(os.path.join(out, 'cuts.txt'), 'w').write('# synthetic reference cuts\n' + ''.join('%d  cut %d (r%d)\n' % (n, i + 1, n % P) for i, n in enumerate(cuts)))

rc, _ = finish(mA, os.path.join(out, 'A', 'A-final.mp4'), '--cuts', 'none')
got, holds = read_back(os.path.join(out, 'A', 'A-final.mp4'))
# one clock: the early cuts, and a judder after every cut on n % 15 = 4 or 9 (each such shot holds about every other frame)
jud_shots = [c for c in cuts if c % P in (4, 9)]
per = {c: sum(1 for h in holds if c <= h < (cuts + [N])[cuts.index(c) + 1]) for c in jud_shots}
other = [h for h in holds if not any(c <= h < (cuts + [N])[cuts.index(c) + 1] for c in jud_shots)]
a_ok = rc == 0 and got == [n - 1 if n in early else n for n in cuts] and not other and all(v >= 3 for v in per.values())
print('A · one clock (--cuts none): finish.py exit %d; cuts %s; judder: holds per shot starting on n%%15 = 4/9 %s, elsewhere %s → %s' % (
    rc, 'early on %s' % [n for n, g in zip(cuts, got) if g != n], per, other or 'none', 'as claimed' if a_ok else 'NOT as claimed'))
ok &= a_ok

rc, so = finish(mA, os.path.join(out, 'A', 'C-final.mp4'))
got, holds = read_back(os.path.join(out, 'A', 'C-final.mp4'))
clamped = [int(x) for x in re.findall(r'n(\d+)', so.split('kept inside their shot', 1)[1].split('\n', 1)[0])] if 'kept inside their shot' in so else []
pred = overflow([0] + [2 * n for n in cuts])
ok &= rc == 0 and 'shots from' in so and 'timeline.json' in so and clamped == pred
ok &= show('C · the master\'s timeline.json (default)', got, list(cuts), holds, pred, '(finish.py lists clamped %s; finish.py exit %d)' % (clamped, rc))

rc, _ = finish(mA, os.path.join(out, 'A', 'C2-final.mp4'), '--cuts', os.path.join(out, 'cuts.txt'))
vid = lambda p: subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-map', '0:v', '-f', 'md5', '-'], capture_output=True, text=True).stdout.strip()
same = vid(os.path.join(out, 'A', 'C-final.mp4')) == vid(os.path.join(out, 'A', 'C2-final.mp4'))
print('C2 · --cuts cuts.txt: finish.py exit %d; decoded video %s C\'s' % (rc, 'identical to' if same else 'DIFFERENT from'))
ok &= rc == 0 and same

bD = [0] + [2 * n + (1 if n == 186 else 0) for n in cuts]                # the shot from n186 starts on master frame 373
mD = master(os.path.join(out, 'D'), bD)
rc, so = finish(mD, os.path.join(out, 'D', 'D-final.mp4'))
got, holds = read_back(os.path.join(out, 'D', 'D-final.mp4'))
ok &= rc == 0 and show('D · a shot starting on odd master frame 373', got, [187 if n == 186 else n for n in cuts], holds, overflow(bD), '(finish.py exit %d)' % rc)

# G and U: the broken halves, through finish.py's own build_video with its index map swapped
real = F.index_map


def grid_clamped(N_, P_, S_, Fr, O_, starts=None, clamped=None):
    mp, M = real(N_, P_, S_, Fr, O_)                                    # the film's grid …
    fs = sorted({0} | set(starts)); ns = [math.ceil(Fraction(f) * O_ / Fr) for f in fs]
    out_, k = [], 0
    for n, (m, j) in enumerate(mp):
        while k + 1 < len(fs) and n >= ns[k + 1]:
            k += 1
        out_.append((m, min(max(j, fs[k]), fs[k + 1] - 1) if k + 1 < len(fs) else max(j, fs[k])))   # … kept inside the shot
    return out_, M


def own_unclamped(N_, P_, S_, Fr, O_, starts=None, clamped=None):
    mp, M = real(N_, P_, S_, Fr, O_, starts)
    mo = lambda n: (n // P_) * 12 + n % P_ - sum(1 for s in S_ if s <= n % P_)
    fs = sorted({0} | set(starts)); ns = [math.ceil(Fraction(f) * O_ / Fr) for f in fs]
    out_, k = [], 0
    for n, (m, j) in enumerate(mp):
        while k + 1 < len(fs) and n >= ns[k + 1]:
            k += 1
        out_.append((m, fs[k] + math.ceil(Fraction(m - mo(ns[k])) * Fr / M)))   # each shot's clock, never clamped
    return out_, M


for tag, fn in (('G', grid_clamped), ('U', own_unclamped)):
    F.index_map = fn
    tmp = tempfile.mkdtemp(prefix='shots-')
    try:
        F.build_video(mA, os.path.join(out, 'A', tag + '-final.mp4'), N, P, S, Fraction(O), None, tmp, 16, [2 * n for n in cuts])
    finally:
        F.index_map = real
        shutil.rmtree(tmp, ignore_errors=True)
    got, holds = read_back(os.path.join(out, 'A', tag + '-final.mp4'))
    early_ = [n for n, g in zip(cuts, got) if g != n]
    jud = {c: sum(1 for h in holds if c <= h < (cuts + [N])[cuts.index(c) + 1]) for c in jud_shots}
    if tag == 'G':
        caught = not early_ and all(v >= 3 for v in jud.values())
        print('G · the film\'s grid, clamped: cuts %s; judder (holds per shot starting on n%%15 = 4/9) %s → %s' % (
            'all on n' if not early_ else 'early on %s' % early_, jud, 'caught' if caught else 'NOT caught'))
    else:
        pe = [n + 1 for n in overflow([0] + [2 * n for n in cuts])]
        caught = early_ == pe and holds == pe                             # the only holds: each early cut's own first frame,
        print('U · own clocks, unclamped: cuts early on %s (the shots that outlast their master frames end on %s); holds %s '
              '(only those cut frames, which repeat the frame that already showed them: no judder) → %s' % (
                  early_, [n - 1 for n in pe], holds, 'caught' if caught else 'NOT caught'))
    ok &= caught
print('RESULT %s' % ('PASS' if ok else 'FAIL'))
sys.exit(0 if ok else 1)
