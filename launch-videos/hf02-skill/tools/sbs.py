# Frame-exact side-by-side: label bar + [reference | ours], piped to ffmpeg as raw RGB at 30 fps.
import sys, os, subprocess
from PIL import Image
ref_dir, ours_dir, label, out = sys.argv[1:5]
slow = int(sys.argv[5]) if len(sys.argv) > 5 else 1
bar = Image.open(label).convert('RGB')
cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1920x600', '-r', '30', '-i', '-',
       '-vf', 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709',
       '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p',
       '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', out]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
for n in range(300, 510):
    canvas = Image.new('RGB', (1920, 600))
    canvas.paste(bar, (0, 0))
    a = Image.open(os.path.join(ref_dir, 'n%04d.png' % n)).convert('RGB').resize((960, 540), Image.LANCZOS)
    b = Image.open(os.path.join(ours_dir, 'n%04d.png' % n)).convert('RGB').crop((0, 0, 1920, 1080)).resize((960, 540), Image.LANCZOS)
    canvas.paste(a, (0, 60)); canvas.paste(b, (960, 60))
    raw = canvas.tobytes()
    for _ in range(slow): p.stdin.write(raw)
p.stdin.close(); p.wait(); print(out, 'exit', p.returncode)
