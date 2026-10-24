# -*- coding: utf-8 -*-
# Assemble each live-action shot's footage plate from its generated legs, the way a reference edit hides joins inside
# one continuous move, at the clips' NATIVE frame rate (no 30p resample here: a 24p reference's cadence is rebuilt by
# recreate/finish.py, which puts each 24 fps plate frame on the reference's own 30p slot).
#   python3 plates.py <spec.json> [SHOT …] [--clips DIR] [--out-dir DIR] [--sheet] [--dry-run]
# The spec (RECREATE.md §8; worked example: ../recreate/examples/manus2-space-plates.json):
#   {"ref_fps": 30,                    the reference's rate: every "frames" below counts its frames
#    "fps": null,                      the plates' rate (null: each shot's first leg's own rate — H3 clips are 24)
#    "size": "1920x1080",              cover-scaled and centre-cropped (null: the first leg's size)
#    "tail": 3, "crf": 14,             frames past the shot's end (the engine never runs off the plate), x264 quality
#    "clips": "../footage/fal",        where leg clips live, relative to the spec file (a leg may give a full path)
#    "out": "../assets/footage",       where <SHOT>.mp4 is written, relative to the spec file (--out-dir overrides)
#    "shots": {"S01": {"first": 0, "frames": 348, "legs": [
#        {"clip": "S01-1a.mp4", "start": 1.80, "frames": 95, "join": {"kind": "hblur", "frames": 4}},
#        {"clip": "S01-1b.mp4", "start": 1.35, "frames": 151, "join": {"kind": "hblur", "frames": 4}},
#        {"clip": "S01-1c.mp4", "start": 0.50, "frames": 102}]}}}
# A leg fills `frames` of the shot (reference frames) from `start` seconds into its clip; its legs must add up to the
# shot. A `join` crossfades into the NEXT leg over `frames` plate frames, starting on the leg boundary: any ffmpeg xfade
# transition (hblur and zoomin hide a join inside a whip or a crash-zoom, fadewhite inside a bloom; fade is a plain
# dissolve). Each window must lie inside its clip (the join's overlap and the last leg's tail included): a short window
# is refused (exit 2) with how much is missing and the latest start that fits. Output: H.264, yuv420p, BT.709, no audio,
# exactly (shot + tail) plate frames; t = 0 is the shot's first frame (beats.yaml: bg: <it>, bgFrom: 0, bgMove: none,
# bgDim: 0). HDR legs go to SDR through the film engine's own conversion first, as conform.py does. Outputs are written
# through a temp file and one rename and are never an input. --sheet writes <out>/review/plate-<SHOT>.jpg (8 frames,
# labelled with reference frame numbers); --dry-run checks every window and prints the plan, writing nothing.
# Exit codes: 0 written (or a clean dry run) · 2 a bad spec, a missing or unreadable clip, a window the clip can't cover ·
# 1 ffmpeg failed or the plate came out with the wrong frame count.
import argparse, json, math, os, sys
from fractions import Fraction
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.dont_write_bytecode = True   # no __pycache__ in the skill
from _media import die, run, call, probe, num, size_arg, cover, hdr_prefix, guard_outputs, temp_beside, publish, discard

ap = argparse.ArgumentParser(description="Assemble each shot's footage plate from its generated legs, at their native frame rate.")
ap.add_argument('spec'); ap.add_argument('shots', nargs='*', help='only these shots (default: all)')
ap.add_argument('--out-dir', help="write the plates here (default: the spec's \"out\")")
ap.add_argument('--clips', help="read leg clips from here (default: the spec's \"clips\")")
ap.add_argument('--sheet', action='store_true', help='also write a frame strip per plate (review/plate-<SHOT>.jpg)')
ap.add_argument('--dry-run', action='store_true', help='check every window and print the plan; write nothing')
a = ap.parse_args()

try:
    S = json.load(open(a.spec, encoding='utf-8'))
except (OSError, ValueError) as e:
    die(2, '%s: not a readable JSON spec (%s)' % (a.spec, e))
base = os.path.dirname(os.path.abspath(a.spec))
rel = lambda p: p if os.path.isabs(p) else os.path.normpath(os.path.join(base, p))
try:
    REF = Fraction(str(S.get('ref_fps', 30)))
except (ValueError, ZeroDivisionError):
    die(2, 'ref_fps %r: give the reference\'s frame rate, e.g. 30 or 30000/1001' % S.get('ref_fps'))
TAIL, CRF = int(S.get('tail', 3)), int(S.get('crf', 14))
SIZE = size_arg(S['size']) if S.get('size') else None
CLIPS = os.path.abspath(a.clips) if a.clips else rel(S.get('clips', '.'))
OUT = os.path.abspath(a.out_dir) if a.out_dir else rel(S.get('out', '.'))
shots = S.get('shots') or {}
if not isinstance(shots, dict) or not shots:
    die(2, '%s: no "shots" in the spec' % a.spec)
pick = a.shots or list(shots)
for s in pick:
    if s not in shots:
        die(2, '%s: no shot %r in the spec (it has %s)' % (a.spec, s, ', '.join(shots)))
if TAIL < 0 or not 0 <= CRF <= 51:
    die(2, 'tail must be ≥ 0 and crf 0–51')


def plan(sid):
    """Check one shot's spec and every leg's window; return what the encode needs."""
    sh = shots[sid]
    legs = sh.get('legs') or []
    if not legs or 'frames' not in sh:
        die(2, '%s: a shot needs "frames" and at least one leg' % sid)
    if sum(int(L.get('frames', 0)) for L in legs) != int(sh['frames']):
        die(2, '%s: its legs fill %d frames but the shot has %d — the legs\' "frames" must add up to the shot'
            % (sid, sum(int(L.get('frames', 0)) for L in legs), int(sh['frames'])))
    infos = []
    for k, L in enumerate(legs):
        p = rel(os.path.join(CLIPS, L['clip'])) if not os.path.isabs(L['clip']) else L['clip']
        info = probe(p)
        if not info:
            die(2, '%s leg %d: %s is missing or has no video (still downloading? gen.mjs fetch resumes it)' % (sid, k + 1, p))
        infos.append((p, info))
    fps = Fraction(str(S['fps'])) if S.get('fps') else infos[0][1]['fps']
    if fps <= 0:
        die(2, '%s: the plate rate is unknown — set "fps" in the spec' % sid)
    size = SIZE or (infos[0][1]['w'] - infos[0][1]['w'] % 2, infos[0][1]['h'] - infos[0][1]['h'] % 2)
    rows = []
    for k, (L, (p, info)) in enumerate(zip(legs, infos)):
        start, frames = float(L.get('start', 0)), int(L['frames'])
        if start < 0 or frames < 1:
            die(2, '%s leg %d: start must be ≥ 0 s and frames ≥ 1' % (sid, k + 1))
        join = L.get('join') if k < len(legs) - 1 else None
        jf = int(join.get('frames', 0)) if join else 0
        if join and (jf < 1 or not str(join.get('kind') or '')):
            die(2, '%s leg %d: a join needs a "kind" (an ffmpeg xfade transition) and "frames" ≥ 1' % (sid, k + 1))
        share = Fraction(frames) / REF
        need = share + Fraction(jf) / fps + (Fraction(TAIL) / fps if k == len(legs) - 1 else 0)
        have = info['dur'] - start
        if float(need) > have + 1e-3:
            miss = float(need) - have
            fits = info['dur'] - float(need)
            die(2, '%s leg %d (%s): the window needs %.3f s from %s s, the clip has %.3f s after it — %.3f s (%.1f frames at %s fps) '
                'missing. %s, or give this leg fewer frames.' % (sid, k + 1, os.path.basename(p), float(need), num(start), have, miss,
                miss * float(fps), num(fps), 'Start at %.2f s or earlier' % fits if fits >= 0 else 'The clip is shorter than the window'))
        if info['fps'] != fps:
            sys.stderr.write('! %s leg %d: %s is %s fps, the plate %s fps — it is resampled to the nearest frame (fps=%s:round=near)\n'
                             % (sid, k + 1, os.path.basename(p), num(info['fps']), num(fps), num(fps)))
        rows.append(dict(path=p, info=info, start=start, share=share, need=need, join=join, jf=jf))
    n = int(round((Fraction(int(sh['frames'])) / REF + Fraction(TAIL) / fps) * fps))
    return dict(sid=sid, first=int(sh.get('first', 0)), frames=int(sh['frames']), fps=fps, size=size, rows=rows, n=n)


def encode(P, out):
    fs = '%d/%d' % (P['fps'].numerator, P['fps'].denominator) if P['fps'].denominator != 1 else str(P['fps'].numerator)
    inputs, chains = [], []
    for i, r in enumerate(P['rows']):
        inputs += ['-ss', '%.3f' % r['start'], '-t', '%.4f' % float(r['need']), '-i', r['path']]
        chains.append('[%d:v]%sfps=%s,%s,setsar=1,format=yuv420p,setpts=PTS-STARTPTS[l%d]' % (i, hdr_prefix(r['info'], r['path']), fs, cover(*P['size']), i))
    cur, t = 'l0', P['rows'][0]['share']
    for i, r in enumerate(P['rows'][:-1]):
        nxt = 'x%d' % i
        chains.append('[%s][l%d]xfade=transition=%s:duration=%.4f:offset=%.4f[%s]' % (cur, i + 1, r['join']['kind'], r['jf'] / float(P['fps']), float(t), nxt))
        cur, t = nxt, t + P['rows'][i + 1]['share']
    tmp = temp_beside(out)
    try:
        r = call(['ffmpeg', '-v', 'error', '-y'] + inputs + ['-filter_complex', ';'.join(chains), '-map', '[%s]' % cur, '-frames:v', str(P['n']),
                  '-r', fs, '-c:v', 'libx264', '-crf', str(CRF), '-preset', 'medium', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709',
                  '-color_trc', 'bt709', '-colorspace', 'bt709', '-an', tmp], 'ffmpeg (plate %s)' % P['sid'], capture_output=True)
        if r.returncode:
            die(1, 'ffmpeg failed on %s:\n%s' % (P['sid'], r.stderr.decode('utf-8', 'replace').strip()[-1500:]))
        got = run(['ffprobe', '-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', tmp],
                  'ffprobe (counting %s)' % P['sid']).decode().strip()
        if got != str(P['n']):
            die(1, '%s: the plate has %s frames, want %d — not written' % (P['sid'], got, P['n']))
        publish(tmp, out)
    except BaseException:
        discard(tmp)
        raise


def sheet(P, out, path):
    from PIL import Image, ImageDraw, ImageFont
    np = __import__('numpy')
    total = P['frames'] / float(REF)
    tiles = []
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 20)
    except OSError:
        font = ImageFont.load_default()
    for i in range(8):
        t = min(total - 0.02, i * total / 7)
        raw = run(['ffmpeg', '-v', 'error', '-ss', '%.3f' % t, '-i', out, '-frames:v', '1', '-vf', 'scale=400:-2', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], 'ffmpeg (sheet)')
        h = len(raw) // (400 * 3)
        im = Image.fromarray(np.frombuffer(raw[:400 * 3 * h], np.uint8).reshape(h, 400, 3))
        ImageDraw.Draw(im).text((6, 6), 'n%d (%.2fs)' % (P['first'] + round(t * float(REF)), t), fill=(255, 220, 90), font=font)
        tiles.append(im)
    w = Image.new('RGB', (sum(x.width for x in tiles), tiles[0].height))
    x = 0
    for im in tiles:
        w.paste(im, (x, 0))
        x += im.width
    t = temp_beside(path)
    try:
        w.save(t, quality=85)
        publish(t, path)
    except BaseException:
        discard(t)
        raise


plans = [plan(s) for s in pick]                      # every window checked before anything is encoded
for P in plans:
    print('%s  n%d-%d  %.3f s · plate %d frames at %s fps (%s)  legs: %s' % (
        P['sid'], P['first'], P['first'] + P['frames'] - 1, P['frames'] / float(REF), P['n'], num(P['fps']), '%dx%d' % P['size'],
        ', '.join('%s@%ss%s' % (os.path.basename(r['path']), num(r['start']), ' →%s×%d' % (r['join']['kind'], r['jf']) if r['join'] else '') for r in P['rows'])))
if a.dry_run:
    print('dry run: %d plate(s) checked, nothing written' % len(plans))
    sys.exit(0)
for P in plans:
    out = os.path.join(OUT, P['sid'] + '.mp4')
    guard_outputs([out], [r['path'] for r in P['rows']])
    encode(P, out)
    if a.sheet:
        sp = os.path.join(OUT, 'review', 'plate-%s.jpg' % P['sid'])
        guard_outputs([sp], [])
        sheet(P, out, sp)
    print('  → %s' % out)
