# -*- coding: utf-8 -*-
# Drop a generated clip into the film's frame grid the way the reference's edit did: native speed, its 24 fps put on the
# film's 30 by repeating frames (fps=30:round=near: one repeat every 5 output frames, never interpolation), cover-scaled
# and centre-cropped to --size, graded, BT.709-tagged, yuv420p, no audio, exactly --frames frames.
#   python3 conform.py <in> <out.mp4> --frames N [--fps 30] [--start S] [--size WxH] [--grade "<ffmpeg filters>"] [--crf 15]
# --start = seconds into the clip for the shot's first frame: pick it so the action lands on the shot's beats (clips come
# back longer than asked — 6 s → 6.58 s — with the action stretched to match). --grade is appended after the fps (and
# --size) step, e.g. FOOTAGE.md's grades. HDR clips (HLG / PQ, as phones record) go to SDR first through the film engine's
# own conversion (lib/hdr.mjs); a rotation tag is honoured; an odd width or height loses its last column / row (H.264
# 4:2:0 needs even sizes; nothing is resampled). Refuses when the clip can't cover N frames from --start, saying how much
# is missing. The output is never the input (same path, hard link or symlink: refused) and is written through a temp file
# and one rename, so it is always the old file or the whole new one.
# Exit codes: 0 written · 2 bad arguments, an unreadable clip, or a clip too short for N frames · 1 ffmpeg failed.
import argparse, math, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.dont_write_bytecode = True   # no __pycache__ in the skill
from _media import die, run, call, probe, fps_arg, fps_str, num, size_arg, chain, cadence, hdr_prefix, HDR, guard_outputs, temp_beside, publish, discard

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
fps, size = fps_arg(a.fps), size_arg(a.size) if a.size else None
guard_outputs([a.dst], [a.src])                     # before the work: never the input, its folder made
hdr = hdr_prefix(info, a.src)
odd = (info['w'], info['h']) if not size and (info['w'] % 2 or info['h'] % 2) else None
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
tmp = temp_beside(a.dst)
try:
    run(['ffmpeg', '-y', '-v', 'error', '-ss', '%.4f' % a.start, '-i', a.src, '-an', '-sn', '-vf', chain(fps, a.grade, size, hdr, odd), '-frames:v', str(a.frames),
         '-c:v', 'libx264', '-preset', 'slow', '-crf', str(a.crf), '-movflags', '+faststart', tmp], 'ffmpeg (conform)')
    got = call(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames,width,height',
                '-of', 'csv=p=0', tmp], 'ffprobe (checking the conformed clip)', capture_output=True).stdout.decode().strip().split(',')
    if len(got) < 3 or int(got[2]) != a.frames:
        die(1, 'the conformed clip has %s frames, not %d — %s was left as it was' % (got[-1] if got else '?', a.frames, a.dst))
    publish(tmp, a.dst)
finally:
    discard(tmp)                                    # gone already when published
print('wrote %s: %d frames at %s fps (%sx%s, %.2f s) from %.2f s into %s' % (a.dst, a.frames, num(fps), got[0], got[1], a.frames / float(fps), a.start, os.path.basename(a.src)))
print('  %s%s%s%s%s · BT.709, yuv420p, crf %d' % (cadence(info['fps'], fps), ' · audio dropped' if info['audio'] else '', ' · graded' if a.grade else '',
      ' · %s HDR → SDR (the film engine\'s conversion)' % HDR[info['trc']] if hdr else '', ' · %dx%d cropped to even' % odd if odd else '', a.crf))
