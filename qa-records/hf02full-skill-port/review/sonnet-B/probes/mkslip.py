# -*- coding: utf-8 -*-
# make a slipped copy of a side-by-side: argv: in.mp4 out.mp4 kind   (kinds: first, last, hold5, shift2, left_last)
import sys, subprocess
sys.path.insert(0, '/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/review/sonnet-B/stage/video/recreate')
sys.dont_write_bytecode = True
import media, numpy as np
src, dst, kind = sys.argv[1:4]
P = media.probe(src)['video']; W, H = P['w'], P['h']; Wl = W // 2
fr = [f.copy() for f in media.frames(src, (W, H), 'rgb24')]
n = len(fr)
out = [f.copy() for f in fr]
if kind == 'first':  out[0][:, Wl:] = fr[1][:, Wl:]
elif kind == 'last': out[n - 1][:, Wl:] = fr[n - 2][:, Wl:]
elif kind == 'left_last': out[n - 1][:, :Wl] = fr[n - 2][:, :Wl]
elif kind == 'hold5': out[5][:, Wl:] = fr[4][:, Wl:]
elif kind == 'shift2':
    for k in range(n): out[k][:, Wl:] = fr[max(0, k - 2)][:, Wl:]
elif kind == 'shift1':
    for k in range(n): out[k][:, Wl:] = fr[max(0, k - 1)][:, Wl:]
cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-framerate', '30', '-i', '-', '-c:v', 'libx264', '-crf', '18', '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', dst]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
for f in out: p.stdin.write(f.tobytes())
p.stdin.close(); p.wait()
