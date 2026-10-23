# Frame-exact side-by-side for W3's ranges: [reference | ours] with a label bar, piped to ffmpeg as raw RGB at 30 fps.
# usage: sbs_w3.py <ref dir> <ours dir> <out.mp4> [slow]
import sys, os, subprocess
from PIL import Image, ImageDraw, ImageFont
ref_dir, ours_dir, out = sys.argv[1:4]; slow = int(sys.argv[4]) if len(sys.argv) > 4 else 1
RANGES = [(264, 509), (671, 742), (971, 1001)]
font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 22)
cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1920x600', '-r', '30', '-i', '-',
       '-vf', 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709',
       '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p',
       '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', out]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
for a, b in RANGES:
    for n in range(a, b + 1):
        canvas = Image.new('RGB', (1920, 600), (24, 24, 24)); d = ImageDraw.Draw(canvas)
        d.text((14, 16), 'reference  n%d  t=%.3fs' % (n, n / 30), fill=(255, 220, 0), font=font)
        d.text((974, 16), 'W3 (ours)  n%d' % n, fill=(120, 230, 255), font=font)
        A = Image.open(os.path.join(ref_dir, 'n%04d.png' % n)).convert('RGB').resize((960, 540), Image.LANCZOS)
        B = Image.open(os.path.join(ours_dir, 'n%04d.png' % n)).convert('RGB').crop((0, 0, 1920, 1080)).resize((960, 540), Image.LANCZOS)
        canvas.paste(A, (0, 60)); canvas.paste(B, (960, 60))
        raw = canvas.tobytes()
        for _ in range(slow): p.stdin.write(raw)
p.stdin.close(); p.wait(); print(out, 'exit', p.returncode)
