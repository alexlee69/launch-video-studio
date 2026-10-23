# Reference vs recreation, frame by frame: rows of [reference | ours] (+ optional 50/50 blend column)
import sys, os
from PIL import Image, ImageDraw, ImageFont
ref, ours, out = sys.argv[1], sys.argv[2], sys.argv[3]
ns = [int(x) for x in sys.argv[4].split(',')]
w = int(sys.argv[5]) if len(sys.argv) > 5 else 640
blend = '--blend' in sys.argv
font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 15)
cols = 3 if blend else 2
h = round(w * 608 / 1080); lab = 20
sheet = Image.new('RGB', (cols * (w + 6) + 6, len(ns) * (h + lab + 6) + 6), (40, 40, 40))
dr = ImageDraw.Draw(sheet)
for r, n in enumerate(ns):
    a = Image.open(os.path.join(ref, 'n%04d.png' % n)).convert('RGB').resize((w, h), Image.LANCZOS)
    b = Image.open(os.path.join(ours, 'n%04d.png' % n)).convert('RGB').resize((w, h), Image.LANCZOS)
    y = 6 + r * (h + lab + 6)
    dr.text((8, y + 2), 'n%d  t=%.3fs   reference' % (n, n / 30), fill=(255, 220, 0), font=font)
    dr.text((6 + w + 6 + 2, y + 2), 'ours', fill=(120, 230, 255), font=font)
    sheet.paste(a, (6, y + lab)); sheet.paste(b, (6 + w + 6, y + lab))
    if blend:
        dr.text((6 + 2 * (w + 6) + 2, y + 2), '50/50', fill=(200, 200, 200), font=font)
        sheet.paste(Image.blend(a, b, 0.5), (6 + 2 * (w + 6), y + lab))
sheet.save(out); print(out, sheet.size)
