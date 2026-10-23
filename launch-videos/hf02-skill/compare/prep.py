# our 60-fps film frames → 30-fps samples n<i+270>.png at 1080×608 (the reference's size and numbering)
import sys, os
from PIL import Image
src, dst, a, b = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
os.makedirs(dst, exist_ok=True)
for i in range(a, b + 1):
    im = Image.open(os.path.join(src, '%05d.png' % (2 * i))).convert('RGB').resize((1080, 608), Image.LANCZOS)
    im.save(os.path.join(dst, 'n%04d.png' % (i + 270)))
print('prepared', b - a + 1, 'frames →', dst)
