# Overlay the fitted deck model (card outlines) on reference frames → contact sheet.
# usage: deckviz.py <fit.json> <out.png> n1 n2 ...
import sys, os, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(__file__))
sys.argv_saved = sys.argv
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
fit = json.load(open(sys.argv[1])); out = sys.argv[2]; ns = [int(v) for v in sys.argv[3:]]
import importlib.util
spec = importlib.util.spec_from_file_location('df', os.path.join(os.path.dirname(__file__), 'deckfit_core.py'))
df = importlib.util.module_from_spec(spec); spec.loader.exec_module(df)
G = fit['G']; poses = {int(k): v for k, v in fit['poses'].items()}
tw = 540; th = round(tw * 608 / 1080); cols = 2
font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 14)
rows = (len(ns) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (tw + 6) + 6, rows * (th + 26) + 6), (40, 40, 40)); dr0 = ImageDraw.Draw(sheet)
for i, n in enumerate(ns):
    im = Image.open(os.path.join(ROOT, 'ref', 'frames', 'n%04d.png' % n)).convert('RGB')
    d = ImageDraw.Draw(im)
    if n in poses:
        qs = df.cards(poses[n], G, df.front(n))
        for m, q in enumerate(qs):
            col = (255, 40, 40) if m == 0 else (40, 220, 255)
            d.line([tuple(p) for p in q] + [tuple(q[0])], fill=col, width=2)
    x = 6 + (i % cols) * (tw + 6); y = 6 + (i // cols) * (th + 26)
    dr0.text((x + 2, y + 2), 'n%d' % n, fill=(255, 220, 0), font=font)
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y + 20))
sheet.save(out); print(out)
