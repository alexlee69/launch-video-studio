# Our renders are 1920x1081: crop to 1920x1080 and resize to the reference's 1080x608 for the trackers that read frames as-is.
import sys, os
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]; os.makedirs(dst, exist_ok=True)
for f in sorted(os.listdir(src)):
    if f.endswith('.png'): Image.open(os.path.join(src, f)).convert('RGB').crop((0, 0, 1920, 1080)).resize((1080, 608), Image.LANCZOS).save(os.path.join(dst, f))
print('done', dst)
