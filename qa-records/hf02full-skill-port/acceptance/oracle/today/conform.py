# -*- coding: utf-8 -*-
# Conform a generated clip into the film the way the reference's edit did: native speed, 24 fps into 30 fps by repeating
# frames (one repeat every 5 output frames), no interpolation, trimmed to the shot's frame count, optional grade.
#   python3 -E tools/fal/conform.py <in.mp4> <out.mp4> <frames> [--start seconds] [--grade "<ffmpeg filters>"]
import sys, subprocess
args = sys.argv[1:]
src, dst, frames = args[0], args[1], int(args[2])
def opt(k, d=None): return args[args.index(k) + 1] if k in args else d
start, grade = float(opt('--start', 0)), opt('--grade', '')
vf = 'fps=30:round=near' + (',' + grade if grade else '') + ',setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,format=yuv420p'
cmd = ['ffmpeg', '-y', '-v', 'error', '-ss', '%.4f' % start, '-i', src, '-an', '-vf', vf, '-frames:v', str(frames),
       '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-movflags', '+faststart', dst]
subprocess.run(cmd, check=True)
n = int(subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', dst],
                       capture_output=True, text=True).stdout.strip())
print('wrote %s: %d frames%s' % (dst, n, '' if n == frames else '  (WANTED %d: source too short)' % frames))
