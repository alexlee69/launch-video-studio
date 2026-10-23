# Frame-exact side-by-side (reference | ours) for W1's ranges, piped to ffmpeg as raw RGB at 30 fps.
# usage: sbs_w1.py <ref dir> <ours dir 1920x1081> <out.mp4> a-b [c-d ...]
import sys, os, subprocess
from PIL import Image, ImageDraw, ImageFont
ref, ours, out = sys.argv[1:4]
ranges = [tuple(int(v) for v in r.split('-')) for r in sys.argv[4:]]
font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 26)
cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1920x600', '-r', '30', '-i', '-',
       '-vf', 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709', '-c:v', 'libx264', '-crf', '16', '-preset', 'slow',
       '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', out]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
for a, b in ranges:
    for n in range(a, b + 1):
        canvas = Image.new('RGB', (1920, 600), (24, 24, 26)); d = ImageDraw.Draw(canvas)
        d.text((16, 14), 'reference  n%d  t=%.3fs' % (n, n / 30), fill=(255, 220, 0), font=font)
        d.text((976, 14), 'ours (W1)', fill=(120, 230, 255), font=font)
        A = Image.open(os.path.join(ref, 'n%04d.png' % n)).convert('RGB').resize((960, 540), Image.LANCZOS)
        B = Image.open(os.path.join(ours, 'n%04d.png' % n)).convert('RGB').crop((0, 0, 1920, 1080)).resize((960, 540), Image.LANCZOS)
        canvas.paste(A, (0, 60)); canvas.paste(B, (960, 60))
        p.stdin.write(canvas.tobytes())
p.stdin.close(); p.wait(); print(out, 'exit', p.returncode)
