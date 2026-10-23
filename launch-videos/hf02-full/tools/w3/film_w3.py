# W3's range mp4: our frames for 264-509, 671-742, 971-1001 back to back (1920x1080, 30 fps). A contiguous numbered
# sequence of symlinks feeds ffmpeg's image2 demuxer (the concat demuxer duplicated a frame).
import sys, os, subprocess, shutil
src, out = os.path.abspath(sys.argv[1]), sys.argv[2]
seq = os.path.join(os.path.dirname(os.path.abspath(out)), 'seq')
if os.path.isdir(seq): shutil.rmtree(seq)
os.makedirs(seq)
k = 0
for a, b in [(264, 509), (671, 742), (971, 1001)]:
    for n in range(a, b + 1):
        os.symlink(os.path.join(src, 'n%04d.png' % n), os.path.join(seq, 's%04d.png' % k)); k += 1
r = subprocess.run(['ffmpeg', '-y', '-v', 'error', '-framerate', '30', '-start_number', '0', '-i', os.path.join(seq, 's%04d.png'),
    '-vf', 'crop=1920:1080:0:0,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709',
    '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', out])
shutil.rmtree(seq)
print(out, k, 'frames, exit', r.returncode)
