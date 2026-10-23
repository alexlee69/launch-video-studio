# Downscale our 1920x1081 renders to the reference's 1080x608 (crop to 1920x1080, LANCZOS), so every measuring tool
# runs on ours exactly as it ran on the reference.  usage: down.py <src dir> <dst dir> [first last]
import sys, os
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]; os.makedirs(dst, exist_ok=True)
a, b = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (0, 99999)
for f in sorted(os.listdir(src)):
    if not (f.startswith('n') and f.endswith('.png')): continue
    n = int(f[1:5])
    if not (a <= n <= b): continue
    im = Image.open(os.path.join(src, f)).convert('RGB')
    if im.width != 1080: im = im.crop((0, 0, 1920, 1080)).resize((1080, 608), Image.LANCZOS)
    im.save(os.path.join(dst, f))
print('ok')
