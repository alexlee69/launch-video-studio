# -*- coding: utf-8 -*-
import sys, os
from PIL import Image, ImageDraw, ImageFont
REF = '/Users/bytedance/Downloads/launch-videos/hf02-full/ref/frames'
S = sys.argv[1]; out = sys.argv[2]
frames = sorted(int(f[1:5]) for f in os.listdir(S + '/ours') if f.endswith('.png'))
OWN = [(0, 97, 'W1'), (98, 263, 'W2'), (264, 509, 'W3'), (510, 670, 'W4'), (671, 742, 'W3'), (743, 971, 'W4'), (972, 1000, 'W3'),
       (1001, 1259, 'W5'), (1260, 1530, 'W6'), (1531, 1697, 'W2'), (1698, 1908, 'W1')]
owner = lambda n: next(w for a, b, w in OWN if a <= n <= b)
def font(sz):
    for p in ('/System/Library/Fonts/Helvetica.ttc', '/System/Library/Fonts/SFNS.ttf'):
        try: return ImageFont.truetype(p, sz)
        except Exception: pass
    return ImageFont.load_default()
F, Fs, Fh = font(15), font(12), font(20)
W, H, LAB, GAP, PAD, COLS = 320, 180, 22, 4, 12, 7
rows = (len(frames) + COLS - 1) // COLS
CH = LAB + H + GAP + H
sheet = Image.new('RGB', (COLS * W + (COLS + 1) * PAD, 44 + rows * CH + (rows + 1) * PAD), (24, 23, 28))
d = ImageDraw.Draw(sheet)
d.text((PAD, 12), 'hf02 full film - work in progress: source (top) vs ours (bottom), one frame per shot', font=Fh, fill=(240, 238, 244))
for i, n in enumerate(frames):
    c, r = i % COLS, i // COLS
    x, y = PAD + c * (W + PAD), 44 + PAD + r * (CH + PAD)
    d.text((x, y + 3), 'n%04d  %d:%04.1f  %s' % (n, int(n / 30 // 60), n / 30 % 60, owner(n)), font=F, fill=(240, 238, 244))
    for k, (path, tag) in enumerate(((REF + '/n%04d.png' % n, 'source'), (S + '/ours/n%04d.png' % n, 'ours'))):
        im = Image.open(path).convert('RGB').resize((W, H), Image.LANCZOS)
        yy = y + LAB + k * (H + GAP)
        sheet.paste(im, (x, yy))
        tw = d.textlength(tag, font=Fs)
        d.rectangle((x + 4, yy + 4, x + 12 + tw, yy + 21), fill=(0, 0, 0))
        d.text((x + 8, yy + 6), tag, font=Fs, fill=(255, 255, 255))
sheet.save(out)
print(out, sheet.size)
