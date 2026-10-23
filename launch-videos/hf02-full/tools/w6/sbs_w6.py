# Frame-exact side-by-side for W6 (reference | ours), n1260–1531, piped to ffmpeg. usage: sbs_w6.py <ref> <ours> <out.mp4> [slow]
import sys, os, subprocess
from PIL import Image, ImageDraw, ImageFont
ref_dir, ours_dir, out = sys.argv[1:4]; slow = int(sys.argv[4]) if len(sys.argv) > 4 else 1
font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 22)
cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1920x600', '-r', '30', '-i', '-',
       '-vf', 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709', '-c:v', 'libx264', '-crf', '16', '-preset', 'slow',
       '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', out]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
for n in range(1260, 1532):
    c = Image.new('RGB', (1920, 600), (24, 24, 24)); d = ImageDraw.Draw(c)
    d.text((14, 16), 'n%d  t=%.3fs   reference' % (n, n / 30), fill=(255, 220, 0), font=font)
    d.text((974, 16), 'ours (W6)', fill=(120, 230, 255), font=font)
    a = Image.open(os.path.join(ref_dir, 'n%04d.png' % n)).convert('RGB').resize((960, 540), Image.LANCZOS)
    b = Image.open(os.path.join(ours_dir, 'n%04d.png' % n)).convert('RGB').crop((0, 0, 1920, 1080)).resize((960, 540), Image.LANCZOS)
    c.paste(a, (0, 60)); c.paste(b, (960, 60))
    for _ in range(slow): p.stdin.write(c.tobytes())
p.stdin.close(); p.wait(); print(out, 'exit', p.returncode)
