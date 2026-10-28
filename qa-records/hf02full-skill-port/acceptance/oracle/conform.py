# -*- coding: utf-8 -*-
# ORACLE (harness-only): conform.py written from DESIGN.md §A, used to prove the conform checks can PASS.
#   python3 conform.py <in> <out.mp4> --frames N [--fps 30] [--start S] [--size WxH] [--grade "<filters>"] [--crf 15]
# exit 0 ok · 2 bad input / clip too short
import sys, json, math, subprocess

a = sys.argv[1:]
def opt(k, d=None):
    return a[a.index(k) + 1] if k in a else d
pos = [x for i, x in enumerate(a) if not x.startswith('--') and (i == 0 or not a[i - 1].startswith('--'))]
if len(pos) < 2 or '--frames' not in a:
    print('usage: conform.py <in> <out.mp4> --frames N [--fps 30] [--start S] [--size WxH] [--grade F] [--crf 15]'); sys.exit(2)
src, dst = pos[0], pos[1]
n, fps, start, crf = int(opt('--frames')), float(opt('--fps', 30)), float(opt('--start', 0)), opt('--crf', '15')
size, grade = opt('--size'), opt('--grade', '')
j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate,duration,nb_frames,width,height',
                              '-show_entries', 'format=duration', '-of', 'json', src], capture_output=True, text=True).stdout)
st = j['streams'][0]; num, den = st['r_frame_rate'].split('/'); sfps = float(num) / float(den)
dur = float(st.get('duration') or j['format']['duration'])
need = start + n / fps
if need > dur + 0.5 / sfps:
    print('✗ %s is %.3f s long: from --start %.2f s it covers %.3f s, but %d frames at %g fps need %.3f s — %.3f s (%d frames) missing'
          % (src, dur, start, dur - start, n, fps, n / fps, need - dur, math.ceil((need - dur) * fps)))
    sys.exit(2)
vf = ['fps=%g:round=near' % fps]
if size:
    W, H_ = [int(x) for x in size.lower().split('x')]
    vf.append('scale=%d:%d:force_original_aspect_ratio=increase:flags=lanczos,crop=%d:%d' % (W, H_, W, H_))
if grade: vf.append(grade)
vf.append('setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,format=yuv420p')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '%.4f' % start, '-i', src, '-an', '-vf', ','.join(vf), '-frames:v', str(n),
                '-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf), '-movflags', '+faststart', dst], check=True)
rep = '%g → %g fps: ' % (sfps, fps) + ('1 repeat every %d' % round(fps / (fps - sfps)) if fps > sfps else 'no repeats' if fps == sfps else 'drops frames')
print('wrote %s: %d frames · %s' % (dst, n, rep))
