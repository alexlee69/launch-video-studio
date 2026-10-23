# Downscale our 1920x1081 renders to the reference's 1080x608 (crop the odd row first), for the reference tools.
# usage: down.py <srcdir> <dstdir> [first last]
import sys, os
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]; os.makedirs(dst, exist_ok=True)
names = sorted(f for f in os.listdir(src) if f.endswith('.png'))
if len(sys.argv) > 4:
    a, b = int(sys.argv[3]), int(sys.argv[4]); names = [f for f in names if a <= int(f[1:5]) <= b]
for f in names:
    im = Image.open(os.path.join(src, f)).convert('RGB')
    im.crop((0, 0, 1920, 1080)).resize((1080, 608), Image.LANCZOS).save(os.path.join(dst, f))
print(len(names), 'frames ->', dst)
