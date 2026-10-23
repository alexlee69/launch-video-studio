# overlay the deckfit3 model (front card red, cards behind cyan) on reference frames: deckviz3.py <out.png> n1 n2 ...
import sys, os, json, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')); M = os.path.join(ROOT, 'out', 'w4', 'meas')
import importlib.util
P = 1680.0; CX, CY = 540.0, 304.0; W, H = 582.0, 505.0
rig = json.load(open(os.path.join(M, 'deckrig.json'))); D0 = np.array(rig['D0'])
PO = {int(k): v for k, v in json.load(open(os.path.join(M, 'deck3d.json')))['poses'].items()}
C21 = {int(k): v for k, v in json.load(open(os.path.join(M, 'deckb2.json')))['card21'].items()}
F3 = {int(k): v for k, v in json.load(open(os.path.join(M, sys.argv[2] if sys.argv[2].endswith('.json') else 'deckfit3.json'))).items()}
args = sys.argv[3:] if sys.argv[2].endswith('.json') else sys.argv[2:]
def front(n): return 1 + (n - 555) // 2 if n <= 595 else 21
def fpose(n): return PO[n][:4] if n <= 594 else C21[n]
def quad(X, Y, Z, th):
    c, s = math.cos(math.radians(th)), math.sin(math.radians(th))
    ox = np.array([-W / 2, W / 2, W / 2, -W / 2]); oy = np.array([-H / 2, -H / 2, H / 2, H / 2])
    x = X + ox * c; z = Z - ox * s; y = Y + oy; f = P / (P - z)
    return np.stack([CX + x * f, CY + y * f], 1)
ns = [int(v) for v in args]
tw = 540; th_ = round(tw * 608 / 1080); cols = 2; rows = (len(ns) + 1) // 2
sheet = Image.new('RGB', (cols * (tw + 6) + 6, rows * (th_ + 26) + 6), (40, 40, 40)); d0 = ImageDraw.Draw(sheet)
font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 14)
for i, n in enumerate(ns):
    im = Image.open(os.path.join(ROOT, 'ref', 'frames', 'n%04d.png' % n)).convert('RGB'); d = ImageDraw.Draw(im)
    X, Y, Z, thf = fpose(n); f = F3[n]; K = front(n)
    dd = np.linalg.norm(D0) * np.array([math.sin(math.radians(f['phi'])), math.cos(math.radians(f['phi']))])
    for m in range(K, 0, -1):
        a = f['g'] + (m - 1) * f['lam']; q = quad(X - a * dd[0], f['Yd'], Z - a * dd[1], f['th'])
        d.line([tuple(p) for p in q] + [tuple(q[0])], fill=(40, 220, 255), width=1)
    q = quad(X, Y, Z, thf); d.line([tuple(p) for p in q] + [tuple(q[0])], fill=(255, 40, 40), width=2)
    x = 6 + (i % cols) * (tw + 6); y = 6 + (i // cols) * (th_ + 26)
    d0.text((x + 2, y + 2), 'n%d' % n, fill=(255, 220, 0), font=font); sheet.paste(im.resize((tw, th_), Image.LANCZOS), (x, y + 20))
sheet.save(sys.argv[1]); print(sys.argv[1])
