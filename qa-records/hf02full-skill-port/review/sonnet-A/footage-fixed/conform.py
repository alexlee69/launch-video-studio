# -*- coding: utf-8 -*-
# Drop a generated clip into the film's frame grid the way the reference's edit did: native speed, its 24 fps put on the
# film's 30 by repeating frames (fps=30:round=near: one repeat every 5 output frames, never interpolation), cover-scaled
# and centre-cropped to --size, graded, BT.709-tagged, yuv420p, no audio, exactly --frames frames.
#   python3 conform.py <in> <out.mp4> --frames N [--fps 30] [--start S] [--size WxH] [--grade "<ffmpeg filters>"] [--crf 15]
# --start = seconds into the clip for the shot's first frame: pick it so the action lands on the shot's beats (clips come
# back longer than asked — 6 s → 6.58 s — with the action stretched to match). --grade is appended after the fps (and
# --size) step, e.g. FOOTAGE.md's grades. Refuses when the clip can't cover N frames from --start, saying how much is missing.
# Exit codes: 0 written · 2 bad arguments, an unreadable clip, or a clip too short for N frames from --start · 1 ffmpeg failed.
import argparse, math, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.dont_write_bytecode = True   # no __pycache__ in the skill
from _media import die, run, probe, fps_arg, fps_str, num, size_arg, chain, cadence

ap = argparse.ArgumentParser(description='Conform a generated clip to the film: native speed, N frames at --fps, graded, no audio.')
ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--frames', type=int, required=True, help="the shot's length in frames at --fps")
ap.add_argument('--fps', default='30'); ap.add_argument('--start', type=float, default=0.0, help='seconds into the clip')
ap.add_argument('--size', help='WxH: cover-scale and centre-crop (default: the clip\'s own size)')
ap.add_argument('--grade', default='', help='ffmpeg filters appended to the chain')
ap.add_argument('--crf', type=int, default=15)
a = ap.parse_args()
info = probe(a.src)
if not info:
    die(2, "%s: ffprobe finds no video in it (missing, not a video, or still downloading — gen.mjs fetch resumes a cut-off download)" % a.src)
if os.path.splitext(a.dst)[1].lower() not in ('.mp4', '.mov', '.m4v'):
    die(2, '%s: the output is an H.264 movie — name it .mp4' % a.dst)
if a.frames < 1 or a.start < 0 or not 0 <= a.crf <= 51:
    die(2, '--frames must be ≥ 1, --start ≥ 0 and --crf 0–51')
if os.path.abspath(a.src) == os.path.abspath(a.dst):
    die(2, 'the output would overwrite the input')
fps, size = fps_arg(a.fps), size_arg(a.size) if a.size else None
# what ffmpeg's fps filter really yields from a start (the same seek + filter, decoded small; passthrough like the mp4 —
# a raw pipe would pad a start that lands between source frames with one extra frame): exact, edge cases included
count = lambda t: len(run(['ffmpeg', '-v', 'error', '-ss', '%.4f' % t, '-i', a.src, '-an', '-sn', '-vf', 'fps=%s:round=near,scale=8:8' % fps_str(fps),
                           '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], 'ffmpeg (counting frames)')) // 64
have = count(a.start)
if have < a.frames:
    miss, t, ok = a.frames - have, a.start - (a.frames - have) / float(fps), None
    for _ in range(4):                              # the latest start that works, checked the same way (source frames are 1/24 s apart)
        t = math.floor(t * 100) / 100.0
        if t < 0:
            break
        if count(t) >= a.frames:
            ok = t; break
        t -= 1.0 / float(info['fps'] or 24)
    whole = count(0) if ok is None else 0
    die(2, '%s covers %d of the %d frames asked for from %.2f s at %s fps: %d frame%s (%.2f s) short.\n%s' % (
        a.src, have, a.frames, a.start, num(fps), miss, '' if miss == 1 else 's', miss / float(fps),
        ('Start earlier (--start %.2f works), shorten the shot, or generate a longer clip (gen.mjs video --sec).' % ok) if ok is not None else
        ('Even from 0 s it gives %d frames (%.2f s at %s fps): shorten the shot or generate a longer clip (gen.mjs video --sec).' % (whole, whole / float(fps), num(fps)))))
os.makedirs(os.path.dirname(os.path.abspath(a.dst)), exist_ok=True)
run(['ffmpeg', '-y', '-v', 'error', '-ss', '%.4f' % a.start, '-i', a.src, '-an', '-sn', '-vf', chain(fps, a.grade, size), '-frames:v', str(a.frames),
     '-c:v', 'libx264', '-preset', 'slow', '-crf', str(a.crf), '-movflags', '+faststart', a.dst], 'ffmpeg (conform)')
got = subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames,width,height',
                      '-of', 'csv=p=0', a.dst], capture_output=True).stdout.decode().strip().split(',')
if len(got) < 3 or int(got[2]) != a.frames:
    die(1, 'wrote %s but it has %s frames, not %d' % (a.dst, got[-1] if got else '?', a.frames))
print('wrote %s: %d frames at %s fps (%sx%s, %.2f s) from %.2f s into %s' % (a.dst, a.frames, num(fps), got[0], got[1], a.frames / float(fps), a.start, os.path.basename(a.src)))
print('  %s%s%s · BT.709, yuv420p, crf %d' % (cadence(info['fps'], fps), ' · audio dropped' if info['audio'] else '', ' · graded' if a.grade else '', a.crf))
