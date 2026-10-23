import sys, os
from PIL import Image, ImageDraw, ImageFont
# usage: sheet.py <absdir> <out.png> <first> <last> <step> <cols> <thumbw> [cropbox x0,y0,x1,y1]
d, out, a, b, step, cols, tw = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6]), int(sys.argv[7])
crop = tuple(int(v) for v in sys.argv[8].split(',')) if len(sys.argv) > 8 else None
ns = list(range(a, b + 1, step))
ims = []
for n in ns:
    im = Image.open(os.path.join(d, 'n%04d.png' % n)).convert('RGB')
    if crop: im = im.crop(crop)
    th = round(im.height * tw / im.width)
    ims.append((n, im.resize((tw, th), Image.LANCZOS)))
th = ims[0][1].height; lab = 22
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (tw + 6) + 6, rows * (th + lab + 6) + 6), (40, 40, 40))
dr = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 16)
except Exception: font = ImageFont.load_default()
for i, (n, im) in enumerate(ims):
    x = 6 + (i % cols) * (tw + 6); y = 6 + (i // cols) * (th + lab + 6)
    dr.text((x + 2, y + 2), 'n%d  t=%.3fs' % (n, n / 30), fill=(255, 220, 0), font=font)
    sheet.paste(im, (x, y + lab))
sheet.save(out)
print(out, sheet.size)
