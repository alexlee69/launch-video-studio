# Downscale rendered 1920x1081 frames to 1080x608 (crop 1080 rows, LANCZOS), as the reference frames are, for the measuring tools.
import sys, os
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
for f in sorted(os.listdir(src)):
    if f.endswith('.png'):
        Image.open(os.path.join(src, f)).convert('RGB').crop((0, 0, 1920, 1080)).resize((1080, 608), Image.LANCZOS).save(os.path.join(dst, f))
print('done', dst)
