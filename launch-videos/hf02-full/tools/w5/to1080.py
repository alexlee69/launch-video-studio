# Our 1920×1081 renders → 1080×608 copies, so every measuring tool reads both films at the same scale.
import sys, os
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
for f in sorted(os.listdir(src)):
    if not f.endswith('.png'): continue
    o = os.path.join(dst, f)
    if os.path.exists(o) and os.path.getmtime(o) >= os.path.getmtime(os.path.join(src, f)): continue
    im = Image.open(os.path.join(src, f)).convert('RGB')
    im = im.crop((0, 0, 1920, 1080)).resize((1080, 608), Image.LANCZOS)
    im.save(o)
print('ok', dst)
