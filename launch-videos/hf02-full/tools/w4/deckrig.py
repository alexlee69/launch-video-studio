# Rigid 3D deck (n555-594) from the front-card poses alone:
#   card slots W_j along the deck axis: W_j - W_{j-1} = the pop jump measured when card j appears (new front minus the old front
#   carried one frame forward), camera offset(n) = front pose(n) - W_front(n). Back cards are then W_j + offset(n).
# Writes out/w4/meas/deckrig.json and an overlay sheet for checking against the reference.
# usage: deckrig.py
import sys, os, json, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
M = os.path.join(ROOT, 'out', 'w4', 'meas')
P = 1680.0; CX, CY = 540.0, 304.0; W, H = 582.0, 505.0
PO = {int(k): v for k, v in json.load(open(os.path.join(M, 'deck3d.json')))['poses'].items()}
def front(n): return 1 + (n - 555) // 2
def corners3d(X, Y, Z, th):
    c, s = math.cos(math.radians(th)), math.sin(math.radians(th)); pts = []
    for ox, oy in ((-W / 2, -H / 2), (W / 2, -H / 2), (W / 2, H / 2), (-W / 2, H / 2)):
        x = X + ox * c; z = Z - ox * s; y = Y + oy; f = P / (P - z); pts.append((CX + x * f, CY + y * f))
    return np.array(pts)
# pop jumps (X, Z) per card j >= 3 (pop at n = 555 + 2(j-1)); cards 1, 2 take the early value
Dj = {}
for j in range(3, 21):
    n = 555 + 2 * (j - 1)
    a = np.array(PO[n - 1][:3]); b = np.array(PO[n - 2][:3]); c = np.array(PO[n][:3]); e = np.array(PO[n + 1][:3])
    prev = a + ((a - b) + (e - c)) / 2
    Dj[j] = (c - prev)[[0, 2]]
D0 = np.mean([Dj[j] for j in (3, 4, 5, 6)], axis=0)
Dj[1] = D0; Dj[2] = D0
Wj = {0: np.array([0.0, 0.0])}
for j in range(1, 21): Wj[j] = Wj[j - 1] + Dj[j]
off = {}
for n in range(556, 595):
    k = front(n); off[n] = np.array([PO[n][0], PO[n][2]]) - Wj[k]
off[555] = off[556] - (off[557] - off[556])   # 555's own pose fit is poor (shot A hand-off); extrapolate the camera
out = dict(P=P, W={j: Wj[j].round(3).tolist() for j in Wj}, off={n: off[n].round(3).tolist() for n in off},
           th={n: round(PO[n][3], 3) for n in range(556, 595)}, Y={n: round(PO[n][1], 3) for n in range(556, 595)}, D0=D0.round(3).tolist())
json.dump(out, open(os.path.join(M, 'deckrig.json'), 'w'), indent=0)
print('D0', D0.round(2), 'jumps', {j: Dj[j].round(1).tolist() for j in range(3, 21)})
print('camera offset (X,Z):', {n: off[n].round(1).tolist() for n in range(555, 595, 3)})
if '--sheet' in sys.argv:
    ns = [int(v) for v in sys.argv[sys.argv.index('--sheet') + 1].split(',')]
    tw = 540; th_ = round(tw * 608 / 1080); cols = 2; rows = (len(ns) + 1) // 2
    sheet = Image.new('RGB', (cols * (tw + 6) + 6, rows * (th_ + 26) + 6), (40, 40, 40)); d0 = ImageDraw.Draw(sheet)
    font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 14)
    for i, n in enumerate(ns):
        im = Image.open(os.path.join(ROOT, 'ref', 'frames', 'n%04d.png' % n)).convert('RGB'); d = ImageDraw.Draw(im)
        k = front(n); thn = PO[n][3] if n in PO else 27.5
        for j in range(0, k + 1):
            X, Z = Wj[j] + off[n]; Y = PO[n][1] if j == k else 22.7
            if j == 0: Y = 0.0
            q = corners3d(X, Y, Z, thn)
            d.line([tuple(p) for p in q] + [tuple(q[0])], fill=(255, 40, 40) if j == k else (40, 220, 255), width=2)
        x = 6 + (i % cols) * (tw + 6); y = 6 + (i // cols) * (th_ + 26)
        d0.text((x + 2, y + 2), 'n%d' % n, fill=(255, 220, 0), font=font); sheet.paste(im.resize((tw, th_), Image.LANCZOS), (x, y + 20))
    sheet.save(sys.argv[sys.argv.index('--out') + 1]); print('sheet')
