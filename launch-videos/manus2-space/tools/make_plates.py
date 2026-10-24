# -*- coding: utf-8 -*-
"""Placeholder plates for the manus2-space STORYBOARD ("The Lull", the astronaut film). No AI generation, no network,
no image read: every pixel is drawn here from gradients and simple shapes (fonts are the only files opened).

One labelled 1920x1080 PNG per live-action shot (S01-S04, S09, S14, S15, S20-S22, S24, S26), one per piece of her film
shown in the editor viewer (A1-A5, A4 re-lit red by P4, and two helmet-cam clips for the S11 bin), and the S27 end-card
wash. Each plate is a gradient in the shot's look (SHOTLIST looks R0-R6: space black, Earth-limb blue, sunlight, aurora,
airlock white, plasma orange, golden sea), simple masses for the world (station, truss, arrays, capsule, Earth), a
silhouette / framing guide for the astronaut (one actor: white suit, signal-orange bands, clear bubble helmet, her face
visible) and a clear label "AI FOOTAGE · Sxx · <one line> · <lens> · <camera move>".
These are stand-ins: never higgsfield01 frames, never Manus screens.

Run: /usr/bin/python3 -B tools/make_plates.py   (writes assets/plates/*.png next to this folder)
"""
import os, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1920, 1080
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'assets', 'plates')
os.makedirs(OUT, exist_ok=True)
FB = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
FR = '/System/Library/Fonts/Supplemental/Arial.ttf'
SUIT = (234, 236, 238)
SUIT_SH = (170, 176, 184)
ORANGE = (232, 97, 30)          # signal orange (graded median ~#E8611E)
SKIN = (124, 82, 58)            # warm brown
CAP = (22, 22, 24)
PACK = (214, 218, 222)
GOLD = (214, 184, 118)          # insulation blankets
NAVY = (14, 26, 43)
def font(path, size):
    return ImageFont.truetype(path, size)


def grad(stops, w=W, h=H):
    """vertical gradient; stops = [(y fraction, (r, g, b)), ...]"""
    ys = np.linspace(0, 1, h)[:, None]
    out = np.zeros((h, 1, 3), np.float32)
    for c in range(3):
        out[:, 0, c] = np.interp(ys[:, 0], [s[0] for s in stops], [s[1][c] for s in stops])
    return np.repeat(out, w, axis=1)


def to_img(arr):
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def grain(img, amt=5, seed=1):
    rng = np.random.default_rng(seed)
    a = np.asarray(img).astype(np.float32)
    a += rng.normal(0, amt, a.shape[:2])[:, :, None]
    return to_img(a)


def layer():
    return Image.new('RGBA', (W, H), (0, 0, 0, 0))


def comp(img, lay, blur=0):
    if blur:
        lay = lay.filter(ImageFilter.GaussianBlur(blur))
    base = img.convert('RGBA')
    base.alpha_composite(lay)
    return base.convert('RGB')


def blobs(img, items, blur=30):
    """items: (kind, box or points, rgba)"""
    lay = layer(); d = ImageDraw.Draw(lay)
    for kind, geo, col in items:
        if kind == 'e':
            d.ellipse(geo, fill=col)
        elif kind == 'p':
            d.polygon(geo, fill=col)
        elif kind == 'r':
            d.rounded_rectangle(geo, radius=40, fill=col)
    return comp(img, lay, blur)


def fog(img, n=14, y0=0, y1=H, col=(240, 243, 241), alpha=(60, 150), seed=3, blur=60):
    r = random.Random(seed)
    items = []
    for _ in range(n):
        cx, cy = r.uniform(-200, W + 200), r.uniform(y0, y1)
        rw, rh = r.uniform(250, 700), r.uniform(60, 200)
        items.append(('e', (cx - rw, cy - rh, cx + rw, cy + rh), col + (int(r.uniform(*alpha)),)))
    return blobs(img, items, blur)


def rain(img, n=500, seed=5, alpha=70, angle=-0.25, length=(40, 110)):
    r = random.Random(seed)
    lay = layer(); d = ImageDraw.Draw(lay)
    for _ in range(n):
        x, y, L = r.uniform(0, W), r.uniform(0, H), r.uniform(*length)
        d.line([(x, y), (x + L * math.sin(angle), y + L * math.cos(angle))], fill=(225, 232, 236, int(alpha * r.uniform(.4, 1))), width=2)
    return comp(img, lay, 0.8)


def specks(img, box, n, cols, size=(2, 6), seed=9, blur=0, streak=0):
    r = random.Random(seed)
    lay = layer(); d = ImageDraw.Draw(lay)
    x0, y0, x1, y1 = box
    for _ in range(n):
        x, y, s = r.uniform(x0, x1), r.uniform(y0, y1), r.uniform(*size)
        c = r.choice(cols)
        if streak:
            d.line([(x, y), (x + streak * r.uniform(.5, 1.2), y + streak * .12)], fill=c, width=max(1, int(s)))
        else:
            d.ellipse((x - s, y - s, x + s, y + s), fill=c)
    return comp(img, lay, blur)


def bracket(img, bb, tag, side='right', at=None):
    """dashed framing box + a small tag: where the actor is and how big"""
    x0, y0, x1, y1 = bb
    x0, y0, x1, y1 = x0 - 14, y0 - 14, x1 + 14, y1 + 14
    lay = layer(); d = ImageDraw.Draw(lay)
    col = (255, 255, 255, 215)
    for (a, b) in [((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))]:
        L = math.hypot(b[0] - a[0], b[1] - a[1]); n = int(L // 22)
        for k in range(n):
            if k % 2: continue
            t0, t1 = k / n, min(1, (k + 1) / n)
            d.line([(a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0), (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)], fill=col, width=3)
    f = font(FB, 26)
    tw = d.textlength(tag, font=f)
    tx = x1 - tw - 16 if side == 'right' else x0
    tx = max(20, min(W - tw - 36, tx))
    ty = y1 + 8 if y1 + 50 < H else y0 - 46
    if at:
        tx, ty = at
    d.rounded_rectangle((tx, ty, tx + tw + 20, ty + 38), radius=8, fill=(20, 22, 24, 170))
    d.text((tx + 10, ty + 5), tag, font=f, fill=(255, 255, 255, 255))
    return comp(img, lay)


def thirds(img):
    lay = layer(); d = ImageDraw.Draw(lay)
    for x in (W / 3, 2 * W / 3):
        d.line([(x, 0), (x, H)], fill=(255, 255, 255, 46), width=2)
    for y in (H / 3, 2 * H / 3):
        d.line([(0, y), (W, y)], fill=(255, 255, 255, 46), width=2)
    return comp(img, lay)


def wrap(d, text, f, maxw):
    words, lines, cur = text.split(' '), [], ''
    for w_ in words:
        t = (cur + ' ' + w_).strip()
        if d.textlength(t, font=f) <= maxw:
            cur = t
        else:
            lines.append(cur); cur = w_
    if cur:
        lines.append(cur)
    return lines


def label(img, text, where='top', size=44, maxw=W - 240, x=96, y=None, sub=None, anchor='left'):
    """the placeholder label: a translucent dark band with the shot's AI-footage description"""
    lay = layer(); d = ImageDraw.Draw(lay)
    f, fs = font(FB, size), font(FR, int(size * .62))
    lines = wrap(d, text, f, maxw)
    lh = int(size * 1.22)
    hh = lh * len(lines) + (int(size * .9) if sub else 0) + 34
    yy = (64 if where == 'top' else H - 64 - hh) if y is None else y
    wmax = max(d.textlength(l, font=f) for l in lines)
    if sub:
        wmax = max(wmax, d.textlength(sub, font=fs))
    if anchor == 'right':
        x = W - 96 - wmax
    d.rounded_rectangle((x - 22, yy, x + wmax + 26, yy + hh), radius=14, fill=(14, 16, 18, 150))
    for i, l in enumerate(lines):
        d.text((x, yy + 16 + i * lh), l, font=f, fill=(255, 255, 255, 255))
    if sub:
        d.text((x, yy + 16 + len(lines) * lh + 4), sub, font=fs, fill=(225, 230, 232, 255))
    return comp(img, lay)


def inset(img, box, title, draw_fn):
    """a small end-framing thumbnail: draw_fn(img) -> img at full size, shrunk into box"""
    x0, y0, x1, y1 = box
    small = draw_fn().resize((x1 - x0, y1 - y0), Image.LANCZOS)
    img = img.copy()
    img.paste(small, (x0, y0))
    d = ImageDraw.Draw(img)
    d.rectangle((x0 - 3, y0 - 3, x1 + 3, y1 + 3), outline=(255, 255, 255), width=3)
    f = font(FB, 24)
    tw = d.textlength(title, font=f)
    d.rectangle((x0 - 3, y0 - 40, x0 + tw + 17, y0 - 3), fill=(14, 16, 18))
    d.text((x0 + 7, y0 - 36), title, font=f, fill=(255, 255, 255))
    return img


def save(img, name):
    p = os.path.join(OUT, name)
    img.save(p, optimize=True)
    print('wrote', p)




# ---------- the world: space, Earth, station (framing guides, not art) ----------
def space(top=(4, 5, 9), bottom=(8, 10, 16), stars=380, seed=1):
    img = to_img(grad([(0, top), (1, bottom)]))
    if stars:
        img = specks(img, (0, 0, W, H), stars, [(255, 255, 255, 200), (200, 214, 255, 150), (255, 240, 220, 120)], (0.6, 1.8), seed)
    return img


def radial(cx, cy, r, w=W, h=H):
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    return np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2) / max(r, 1)


def earth(img, cx, cy, r, night=False, light=(-.6, -.8), seed=11):
    """a big Earth disc: day = blue with cloud masses and a bright limb; night = dark with amber city lights"""
    a = np.asarray(img).astype(np.float32)
    d = radial(cx, cy, r)
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    nx, ny = (xs - cx) / r, (ys - cy) / r
    inside = d < 1
    if night:
        base = np.stack([12 + 0 * d, 20 + 0 * d, 40 + 0 * d], -1)
    else:
        lam = np.clip(-(nx * light[0] + ny * light[1]) * .7 + .55, .12, 1)
        base = np.stack([40 + 70 * lam, 92 + 110 * lam, 160 + 90 * lam], -1)
    a = np.where(inside[..., None], base, a)
    # atmosphere: a bright thin limb inside, a soft glow outside
    limb = np.clip(1 - np.abs(d - 1) / .012, 0, 1)
    glow = np.clip(1 - (d - 1) / .05, 0, 1) * (d > 1)
    col = np.array([90, 150, 255] if night else [150, 205, 255], np.float32)
    a = a * (1 - limb[..., None] * .8) + col * limb[..., None] * .8
    a = a * (1 - glow[..., None] * .45) + col * glow[..., None] * .45
    img = to_img(a)
    r_ = random.Random(seed)
    if not night:   # cloud masses
        items = []
        for _ in range(26):
            ang = r_.uniform(math.pi * 1.05, math.pi * 1.95); rr = r_.uniform(.15, .97) * r
            x, y = cx + rr * math.cos(ang), cy + rr * math.sin(ang)
            if y < 0 or y > H + 200: continue
            ew, eh = r_.uniform(60, 260), r_.uniform(14, 50)
            items.append(('e', (x - ew, y - eh, x + ew, y + eh), (245, 248, 252, int(r_.uniform(90, 190)))))
        lay = layer(); dd = ImageDraw.Draw(lay)
        for k, g, c in items: dd.ellipse(g, fill=c)
        lay = lay.filter(ImageFilter.GaussianBlur(10))
        m = Image.fromarray((inside * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))
        lay.putalpha(Image.fromarray(np.minimum(np.asarray(lay.split()[3]), np.asarray(m))))
        img = comp(img, lay)
    else:          # city lights
        pts = []
        for _ in range(900):
            ang = r_.uniform(math.pi * 1.05, math.pi * 1.95); rr = r_.uniform(.2, .99) * r
            x, y = cx + rr * math.cos(ang), cy + rr * math.sin(ang)
            if 0 <= x < W and 0 <= y < H: pts.append((x, y))
        lay = layer(); dd = ImageDraw.Draw(lay)
        for x, y in pts:
            s = r_.uniform(.8, 2.4); dd.ellipse((x - s, y - s, x + s, y + s), fill=(255, 190, 110, int(r_.uniform(120, 230))))
        img = comp(img, lay, .6)
    return img


def sun(img, cx, cy, r=90, gold=True, rays=8):
    a = np.asarray(img).astype(np.float32)
    d = radial(cx, cy, r)
    core = np.clip(1.25 - d, 0, 1) ** .6
    halo = np.exp(-d * .9) * .85
    col = np.array([255, 236, 190] if gold else [255, 252, 245], np.float32)
    a = a + col * halo[..., None]
    a = a * (1 - core[..., None]) + 255 * core[..., None]
    img = to_img(a)
    lay = layer(); dd = ImageDraw.Draw(lay)
    for k in range(rays):
        ang = k * math.pi / rays * 2 + .3
        L = r * (9 if k % 2 == 0 else 5)
        dd.line([(cx - L * math.cos(ang), cy - L * math.sin(ang)), (cx + L * math.cos(ang), cy + L * math.sin(ang))], fill=(255, 246, 220, 120), width=6)
    return comp(img, lay, 3)


def aurora(img, y0, y1, seed=21, alpha=150):
    r_ = random.Random(seed)
    lay = layer(); dd = ImageDraw.Draw(lay)
    for k in range(70):
        x = r_.uniform(-100, W + 100); hh = r_.uniform(.4, 1) * (y1 - y0)
        yb = y1 - r_.uniform(0, .15) * (y1 - y0) + 40 * math.sin(x / 210)
        g = (90 + int(r_.uniform(0, 60)), 255, 170 + int(r_.uniform(0, 50)))
        dd.line([(x, yb), (x + r_.uniform(-30, 30), yb - hh)], fill=g + (int(alpha * r_.uniform(.3, 1)),), width=int(r_.uniform(10, 34)))
    return comp(img, lay, 18)


def streaks(img, n, box, col=(255, 246, 225), angle=.42, length=(120, 420), width=(2, 4), seed=31, alpha=(150, 255)):
    r_ = random.Random(seed)
    lay = layer(); dd = ImageDraw.Draw(lay)
    x0, y0, x1, y1 = box
    for _ in range(n):
        x, y, L = r_.uniform(x0, x1), r_.uniform(y0, y1), r_.uniform(*length)
        dd.line([(x, y), (x - L * math.cos(angle), y - L * math.sin(angle))], fill=col + (int(r_.uniform(*alpha)),), width=int(r_.uniform(*width)))
        dd.ellipse((x - 3, y - 3, x + 3, y + 3), fill=(255, 255, 255, 255))
    return comp(img, lay, .8)


def truss(img, p0, p1, w=60, col=(200, 204, 208), rail=True, blur=1.0):
    """a lattice truss from p0 to p1 (two chords + zig-zag), with a white handrail along the near chord"""
    lay = layer(); dd = ImageDraw.Draw(lay)
    (x0, y0), (x1, y1) = p0, p1
    L = math.hypot(x1 - x0, y1 - y0); ux, uy = (x1 - x0) / L, (y1 - y0) / L; px, py = -uy, ux
    A = lambda t, s: (x0 + ux * t + px * s, y0 + uy * t + py * s)
    lw = max(2, int(w * .09))
    dd.line([A(0, -w / 2), A(L, -w / 2)], fill=col + (255,), width=lw)
    dd.line([A(0, w / 2), A(L, w / 2)], fill=col + (255,), width=lw)
    n = max(2, int(L / w))
    for k in range(n):
        t0, t1 = k * L / n, (k + 1) * L / n
        dd.line([A(t0, -w / 2), A(t1, w / 2)], fill=col + (230,), width=max(1, lw // 2))
        dd.line([A(t0, -w / 2), A(t0, w / 2)], fill=col + (200,), width=max(1, lw // 2))
    if rail:
        dd.line([A(0, w * .78), A(L, w * .78)], fill=(250, 250, 250, 255), width=max(2, int(lw * .8)))
        for k in range(0, n + 1, 2):
            dd.line([A(k * L / n, w / 2), A(k * L / n, w * .78)], fill=(240, 240, 240, 255), width=max(1, lw // 2))
    return comp(img, lay, blur)


def module(img, box, gold=True, window=False, shade=(150, 156, 162), blur=1.2):
    x0, y0, x1, y1 = box
    lay = layer(); dd = ImageDraw.Draw(lay)
    rr = int(min(x1 - x0, y1 - y0) * .45)
    dd.rounded_rectangle(box, radius=rr, fill=SUIT + (255,))
    dd.rounded_rectangle((x0, (y0 + y1) / 2 + (y1 - y0) * .12, x1, y1), radius=rr, fill=shade + (180,))
    if gold:
        for k in range(3):
            xa = x0 + (x1 - x0) * (.18 + k * .27)
            dd.rectangle((xa, y0 + (y1 - y0) * .08, xa + (x1 - x0) * .14, y1 - (y1 - y0) * .08), fill=GOLD + (200,))
    for k in range(1, 6):
        xa = x0 + (x1 - x0) * k / 6
        dd.line([(xa, y0 + 4), (xa, y1 - 4)], fill=(190, 194, 198, 160), width=2)
    if window:
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2; r = (y1 - y0) * .3
        dd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(40, 70, 110, 255), outline=(250, 250, 250, 255), width=6)
    return comp(img, lay, blur)


def array(img, box, cols=6, rows=3, blur=1.0):
    x0, y0, x1, y1 = box
    lay = layer(); dd = ImageDraw.Draw(lay)
    dd.rectangle(box, fill=(18, 26, 48, 255))
    for i in range(1, cols):
        xa = x0 + (x1 - x0) * i / cols; dd.line([(xa, y0), (xa, y1)], fill=(70, 86, 120, 255), width=2)
    for j in range(1, rows):
        ya = y0 + (y1 - y0) * j / rows; dd.line([(x0, ya), (x1, ya)], fill=(70, 86, 120, 255), width=2)
    dd.rectangle(box, outline=(120, 128, 140, 255), width=3)
    return comp(img, lay, blur)


def capsule(img, cx, cy, s, band=True, window=True, blur=1.0, col=SUIT):
    """a small white re-entry capsule (gumdrop), one signal-orange band; cy = the base centre"""
    lay = layer(); dd = ImageDraw.Draw(lay)
    pts = [(cx - s, cy), (cx - s * .55, cy - s * 1.15), (cx - s * .35, cy - s * 1.3), (cx + s * .35, cy - s * 1.3), (cx + s * .55, cy - s * 1.15), (cx + s, cy)]
    dd.polygon(pts, fill=col + (255,))
    dd.polygon([(cx + s * .1, cy - s * 1.3), (cx + s * .35, cy - s * 1.3), (cx + s * .55, cy - s * 1.15), (cx + s, cy), (cx + s * .3, cy)], fill=(190, 196, 202, 150))
    if band:
        dd.polygon([(cx - s * .86, cy - s * .22), (cx + s * .86, cy - s * .22), (cx + s * .8, cy - s * .38), (cx - s * .8, cy - s * .38)], fill=ORANGE + (255,))
    if window:
        dd.ellipse((cx - s * .2, cy - s * .9, cx + s * .1, cy - s * .62), fill=(30, 36, 44, 255))
    dd.ellipse((cx - s * 1.02, cy - s * .08, cx + s * 1.02, cy + s * .12), fill=(150, 156, 160, 255))
    return comp(img, lay, blur)


def wrench(img, cx, cy, s, ang=0.5, col=(206, 210, 214), blur=0.8):
    lay = layer(); dd = ImageDraw.Draw(lay)
    ux, uy = math.cos(ang), math.sin(ang)
    a = (cx - ux * s, cy - uy * s); b = (cx + ux * s, cy + uy * s)
    dd.line([a, b], fill=col + (255,), width=max(3, int(s * .22)))
    for (x, y) in (a, b):
        r = s * .26
        dd.ellipse((x - r, y - r, x + r, y + r), fill=col + (255,))
    x, y = b; r = s * .13
    dd.ellipse((x - r, y - r, x + r, y + r), fill=(20, 20, 24, 255))
    dd.line([a, (cx, cy)], fill=(250, 250, 252, 255), width=max(1, int(s * .06)))
    return comp(img, lay, blur)


def plush_whale(d, cx, cy, L, facing=1, col=(98, 140, 200, 255), belly=(196, 214, 236, 255)):
    """the plush whale (S24, S26): a round blue body, a pale belly, an up-turned two-lobed fluke and a spout tuft, so
    it reads as a whale, not a fish. L = body length in px; facing = +1 head right, -1 head left. Draws on an RGBA draw."""
    s = facing
    x0, x1 = (cx - .35 * L, cx + .5 * L) if s > 0 else (cx - .5 * L, cx + .35 * L)
    d.ellipse((x0, cy - .27 * L, x1, cy + .27 * L), fill=col)                                                   # body
    d.polygon([(cx - s * .15 * L, cy - .22 * L), (cx - s * .5 * L, cy - .3 * L), (cx - s * .47 * L, cy - .2 * L),
               (cx - s * .15 * L, cy + .2 * L)], fill=col)                                                       # tail stock, rising
    tx, ty = cx - s * .5 * L, cy - .27 * L
    d.polygon([(tx, ty), (tx - s * .04 * L, ty - .2 * L), (tx + s * .08 * L, ty - .13 * L)], fill=col)          # fluke lobe 1
    d.polygon([(tx, ty), (tx - s * .2 * L, ty - .06 * L), (tx - s * .16 * L, ty - .17 * L)], fill=col)          # fluke lobe 2
    bx0, bx1 = (cx - .1 * L, cx + .42 * L) if s > 0 else (cx - .42 * L, cx + .1 * L)
    d.ellipse((bx0, cy + .02 * L, bx1, cy + .25 * L), fill=belly)                                               # belly
    ex, ey, er = cx + s * .3 * L, cy - .03 * L, .03 * L
    d.ellipse((ex - er, ey - er, ex + er, ey + er), fill=(28, 32, 40, 255))                                     # eye
    sx, sy, w = cx + s * .2 * L, cy - .27 * L, max(2, int(.035 * L))
    for dx in (-.08, 0, .08):
        d.line([(sx, sy), (sx + dx * L, sy - .14 * L)], fill=belly, width=w)                                    # spout tuft


# ---------- the astronaut: a framing guide, not art ----------
def astro(img, cx, top, h, pose='float', facing=1, blur=1.2, tag=None, tag_side='right', tag_at=None, helmet=True, pack=True, mouth=False, glow=True):
    """cx = body centre x, top = top of the helmet, h = full height in px (pose scales it).
    One actor: matte white suit, signal-orange bands (upper arms, thighs, neck ring), clear bubble helmet (her face
    visible, black comms cap), white backpack (EVA), a wrist display on the left forearm."""
    u = h / 8.0
    lay = layer(); d = ImageDraw.Draw(lay)
    f = facing

    def P(x, y):
        return (cx + x * u * f, top + y * u)

    def limb(a, b, w, col=SUIT, bands=None):
        pa, pb = P(*a), P(*b)
        d.line([pa, pb], fill=col + (255,), width=max(2, int(w * u)))
        rr = w * u / 2
        for p in (pa, pb):
            d.ellipse((p[0] - rr, p[1] - rr, p[0] + rr, p[1] + rr), fill=col + (255,))
        for t0, t1 in (bands or []):
            q0 = (pa[0] + (pb[0] - pa[0]) * t0, pa[1] + (pb[1] - pa[1]) * t0)
            q1 = (pa[0] + (pb[0] - pa[0]) * t1, pa[1] + (pb[1] - pa[1]) * t1)
            d.line([q0, q1], fill=ORANGE + (255,), width=max(2, int(w * u * 1.02)))

    def head(x, y, s=1.0, bubble=True, wet=False, open_mouth=False):
        hx, hy = P(x, y)
        if bubble:
            br = .78 * u * s
            d.ellipse((hx - br, hy - br, hx + br, hy + br), fill=(150, 175, 205, 60), outline=(235, 240, 245, 230), width=max(2, int(.07 * u * s)))
            d.chord((hx - br, hy - br, hx + br, hy + br), 200, 250, fill=(255, 255, 255, 70))
            for sx in (-.62, .62):    # temple lamps
                d.ellipse((hx + sx * br - .08 * u * s, hy - .45 * br - .08 * u * s, hx + sx * br + .08 * u * s, hy - .45 * br + .08 * u * s), fill=(255, 250, 225, 255))
            d.rounded_rectangle((hx + br * .78, hy - .1 * u * s, hx + br * .78 + .22 * u * s, hy + .14 * u * s), radius=3, fill=(60, 62, 66, 255))   # helmet camera
            d.ellipse((hx - br * 1.02, hy + br * .62, hx + br * 1.02, hy + br * 1.05), fill=ORANGE + (255,))    # neck ring
        d.ellipse((hx - .4 * u * s, hy - .52 * u * s, hx + .4 * u * s, hy + .5 * u * s), fill=SKIN + (255,))
        if bubble:
            d.chord((hx - .43 * u * s, hy - .58 * u * s, hx + .43 * u * s, hy + .2 * u * s), 180, 360, fill=CAP + (255,))
        else:
            d.chord((hx - .44 * u * s, hy - .62 * u * s, hx + .44 * u * s, hy + .1 * u * s), 180, 360, fill=(30, 24, 22, 255))
            if wet:
                for k in range(7):
                    ex = hx - .36 * u * s + k * .12 * u * s
                    d.ellipse((ex - .07 * u * s, hy - .62 * u * s, ex + .07 * u * s, hy - .48 * u * s), fill=(30, 24, 22, 255))
        # brows (the left one with a small pale scar), eyes, mouth: just enough to read the face
        for sx in (-.17, .17):
            d.line([(hx + (sx - .1) * u * s, hy - .14 * u * s), (hx + (sx + .1) * u * s, hy - .17 * u * s)], fill=(30, 20, 16, 255), width=max(2, int(.05 * u * s)))
            d.ellipse((hx + (sx - .04) * u * s, hy - .07 * u * s, hx + (sx + .04) * u * s, hy + .0 * u * s), fill=(20, 14, 12, 255))
        if open_mouth:
            d.ellipse((hx - .12 * u * s, hy + .17 * u * s, hx + .12 * u * s, hy + .36 * u * s), fill=(60, 20, 20, 255))
        else:
            d.line([(hx - .12 * u * s, hy + .24 * u * s), (hx + .12 * u * s, hy + .24 * u * s)], fill=(70, 34, 28, 255), width=max(2, int(.04 * u * s)))

    def torso(x0, y0, x1, y1):
        a, b = P(x0, y0), P(x1, y1)
        d.rounded_rectangle((min(a[0], b[0]), a[1], max(a[0], b[0]), b[1]), radius=int(.4 * u), fill=SUIT + (255,))
        d.rounded_rectangle((min(a[0], b[0]) + .2 * u, a[1] + .3 * u, max(a[0], b[0]) - .2 * u, a[1] + 1.1 * u), radius=int(.2 * u), fill=(220, 224, 228, 255))

    def backpack(x0, y0, x1, y1):
        a, b = P(x0, y0), P(x1, y1)
        d.rounded_rectangle((min(a[0], b[0]), a[1], max(a[0], b[0]), b[1]), radius=int(.3 * u), fill=PACK + (255,))

    def boot(x, y):
        p = P(x, y)
        d.rounded_rectangle((p[0] - .42 * u, p[1] - .25 * u, p[0] + .42 * u, p[1] + .2 * u), radius=int(.12 * u), fill=(226, 228, 230, 255))

    def display(x, y, s=1.0):
        p = P(x, y)
        if glow:   # an opaque pale halo (a translucent fill would punch through the suit on this layer)
            d.rounded_rectangle((p[0] - .46 * u * s, p[1] - .32 * u * s, p[0] + .46 * u * s, p[1] + .32 * u * s), radius=int(.1 * u * s), fill=(196, 226, 250, 255))
        d.rounded_rectangle((p[0] - .36 * u * s, p[1] - .22 * u * s, p[0] + .36 * u * s, p[1] + .22 * u * s), radius=int(.06 * u * s), fill=(245, 246, 247, 255))
        d.rounded_rectangle((p[0] - .3 * u * s, p[1] - .16 * u * s, p[0] + .3 * u * s, p[1] + .16 * u * s), radius=int(.04 * u * s), fill=(150, 205, 250, 255) if glow else (18, 22, 28, 255))

    B_ARM, B_LEG = [(.12, .42)], [(.08, .4)]
    if pose == 'float':        # floating, 3/4 front, wrist display raised to her chest
        if pack: backpack(-1.0, 1.25, 1.0, 4.2)
        torso(-.8, 1.2, .8, 4.3); head(0, .75)
        limb((-.5, 4.2), (-.8, 6.0), .6, bands=B_LEG); limb((-.8, 6.0), (-.6, 7.5), .52); boot(-.6, 7.7)
        limb((.5, 4.2), (.9, 5.9), .6, bands=B_LEG); limb((.9, 5.9), (1.2, 7.3), .52); boot(1.25, 7.5)
        limb((-.75, 1.7), (-1.3, 3.2), .42, bands=B_ARM); limb((-1.3, 3.2), (-.3, 3.0), .38)
        limb((.75, 1.7), (1.3, 3.0), .42, bands=B_ARM); limb((1.3, 3.0), (.3, 2.9), .38)
        display(-.25, 2.95)
    elif pose == 'mcu':        # head and shoulders, large; the left forearm raised with the display
        if pack: backpack(-1.5, 1.4, 1.5, 4.8)
        torso(-1.35, 1.45, 1.35, 5.0); head(0, .8, 1.0, open_mouth=mouth)
        limb((-1.1, 2.0), (-1.5, 3.7), .55, bands=B_ARM); limb((-1.5, 3.7), (-.1, 3.4), .5)
        display(-.25, 3.35, 1.3)
    elif pose == 'profile':    # MCU profile (S14 END: a delighted shout)
        if pack: backpack(-1.7, 1.4, -.9, 4.8)
        torso(-1.0, 1.5, 1.0, 5.0); head(.15, .8, 1.0, open_mouth=True)
        limb((.6, 2.0), (1.6, 3.0), .55, bands=B_ARM); limb((1.6, 3.0), (2.4, 2.4), .5)
    elif pose == 'haul':       # side-on along a rail, both arms reaching forward to it, legs trailing
        if pack: backpack(-1.6, 1.0, -.7, 3.6)
        torso(-.8, 1.0, .7, 3.8); head(.35, .7)
        limb((.4, 1.6), (1.6, 1.4), .42, bands=B_ARM); limb((1.6, 1.4), (2.6, 1.9), .38)
        limb((.2, 1.8), (1.2, 2.4), .42, bands=B_ARM); limb((1.2, 2.4), (2.1, 2.6), .38)
        limb((-.4, 3.7), (-1.8, 4.6), .58, bands=B_LEG); limb((-1.8, 4.6), (-3.2, 5.1), .5); boot(-3.4, 5.2)
        limb((.1, 3.7), (-1.2, 5.0), .58, bands=B_LEG); limb((-1.2, 5.0), (-2.6, 5.9), .5); boot(-2.8, 6.0)
    elif pose == 'drift':      # side-on, drifting backward, turning a little, tapping the wrist display
        if pack: backpack(-1.5, 1.2, -.6, 4.0)
        torso(-.8, 1.1, .8, 4.2); head(.2, .7)
        limb((-.3, 4.1), (.2, 5.8), .6, bands=B_LEG); limb((.2, 5.8), (-.2, 7.3), .52); boot(-.25, 7.5)
        limb((.3, 4.1), (1.2, 5.6), .6, bands=B_LEG); limb((1.2, 5.6), (1.4, 7.0), .52); boot(1.5, 7.2)
        limb((.5, 1.7), (1.1, 3.0), .42, bands=B_ARM); limb((1.1, 3.0), (.6, 2.8), .38)
        limb((-.4, 1.7), (-.2, 3.2), .42, bands=B_ARM); limb((-.2, 3.2), (.5, 3.0), .38)
        display(.55, 2.85)
    elif pose == 'curl':       # curled up against a hatch, knees to chest
        if pack: backpack(-1.4, 1.4, -.6, 4.0)
        torso(-.8, 1.3, .7, 4.2); head(.1, .85)
        limb((-.1, 4.0), (1.1, 2.9), .62, bands=B_LEG); limb((1.1, 2.9), (1.0, 4.6), .55); boot(1.1, 4.8)
        limb((.2, 4.1), (1.4, 3.2), .62, bands=B_LEG); limb((1.4, 3.2), (1.5, 4.9), .55); boot(1.6, 5.1)
        limb((.5, 1.8), (1.4, 2.6), .42, bands=B_ARM); limb((1.4, 2.6), (1.1, 3.6), .38)
    elif pose == 'seat':       # strapped into the capsule couch, MCU, backpack off, wrist raised
        torso(-1.3, 1.5, 1.3, 5.2); head(0, .8)
        for sx in (-.7, .7):
            d.line([P(sx, 1.6), P(-sx * .2, 4.8)], fill=(60, 64, 70, 255), width=max(2, int(.18 * u)))    # harness
        limb((-1.05, 2.0), (-1.4, 3.7), .55, bands=B_ARM); limb((-1.4, 3.7), (-.1, 3.5), .5)
        display(-.2, 3.45, 1.3)
    elif pose == 'sit':        # sitting on the capsule top on the sea, helmet off on her lap, smiling, whale under her arm
        torso(-1.25, 1.3, 1.25, 5.0); head(0, .85, 1.0, bubble=False, wet=True)
        hx, hy = P(-.2, 5.0); br = .9 * u
        d.ellipse((hx - br, hy - br * .85, hx + br, hy + br * .85), fill=(200, 215, 230, 120), outline=(240, 242, 245, 255), width=max(2, int(.07 * u)))  # helmet on the lap
        wx, wy = P(1.25, 3.6)
        plush_whale(d, wx, wy, 1.65 * u, facing=-f)                                                       # the plush whale (head toward her)
        limb((1.0, 2.1), (1.5, 3.4), .5, bands=B_ARM); limb((1.5, 3.4), (.6, 3.9), .45)
        limb((-1.0, 2.1), (-1.4, 3.8), .5, bands=B_ARM); limb((-1.4, 3.8), (-.6, 4.6), .45)
    elif pose == 'tiny':       # small, wide shot: at the module with a wrench
        if pack: backpack(-1.0, 1.25, 1.0, 4.2)
        torso(-.8, 1.2, .8, 4.3); head(0, .75)
        limb((-.5, 4.2), (-.9, 7.2), .6, bands=B_LEG); limb((.5, 4.2), (.8, 7.2), .6, bands=B_LEG)
        limb((.75, 1.7), (1.7, 2.6), .42, bands=B_ARM); limb((-.75, 1.7), (-1.4, 3.3), .42, bands=B_ARM)
    lay = lay.filter(ImageFilter.GaussianBlur(blur))
    img = comp(img, lay)
    if tag:
        bb = lay.getbbox()
        if bb:
            img = bracket(img, bb, tag, tag_side, tag_at)
    return img


def tether(img, pts, col=ORANGE, width=7, blur=1.2):
    """a loose orange tether through the points (a smooth polyline)"""
    lay = layer(); dd = ImageDraw.Draw(lay)
    sm = []
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        for k in range(20):
            t = k / 20; sm.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
    sm.append(pts[-1])
    for _ in range(3):   # chaikin-ish smoothing
        sm = [sm[0]] + [((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) for a, b in zip(sm, sm[1:])] + [sm[-1]]
    dd.line(sm, fill=col + (255,), width=width, joint='curve')
    return comp(img, lay, blur)


def red(img, k=.35):
    """a soft red re-light (the S20-S22 alarm and P4's grade are comp layers; this is only for the ad still A4)"""
    a = np.asarray(img).astype(np.float32)
    lum = a.mean(-1, keepdims=True)
    tint = np.array([255, 96, 86], np.float32)
    out = a * (1 - k) + (lum / 255.0) * tint * k * 1.25
    return to_img(out)


# ---------- plates ----------
def S01_end():
    img = space(seed=101)
    img = earth(img, 1500, 1900, 1150, light=(-.4, -.9), seed=102)
    img = module(img, (1580, 180, 2300, 900), gold=True)
    img = astro(img, 1300, 210, 1050, 'mcu', facing=-1, blur=2.5)
    img = wrench(img, 620, 520, 46, ang=.9)
    return img


def S01():
    img = to_img(grad([(0, (10, 11, 13)), (.5, (22, 24, 27)), (1, (8, 9, 10))]))
    # the hatch: black space + Earth's blue limb inside a round opening
    win = space(seed=103)
    win = earth(win, 1000, 2240, 1480, light=(-.3, -.95), seed=104)
    m = Image.fromarray((radial(960, 560, 520) < 1).astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(1.5))
    img = Image.composite(win, img, m)
    lay = layer(); d = ImageDraw.Draw(lay)
    d.ellipse((960 - 560, 560 - 560, 960 + 560, 560 + 560), outline=(58, 62, 68, 255), width=56)       # hatch ring
    for k in range(16):
        ang = k * math.pi / 8; x, y = 960 + 560 * math.cos(ang), 560 + 560 * math.sin(ang)
        d.ellipse((x - 9, y - 9, x + 9, y + 9), fill=(96, 100, 108, 255))
    # module interior silhouettes: cable bundles, handrails, stowage straps
    for pts, w_ in [([(0, 120), (300, 200), (420, 470), (330, 1080)], 46), ([(1920, 260), (1600, 330), (1480, 620), (1600, 1080)], 52), ([(0, 900), (380, 860), (700, 1080)], 40)]:
        d.line(pts, fill=(30, 32, 36, 255), width=w_, joint='curve')
    d.rounded_rectangle((120, 60, 560, 96), radius=18, fill=(64, 68, 74, 255))
    d.rounded_rectangle((1420, 980, 1880, 1016), radius=18, fill=(64, 68, 74, 255))
    for x in (1700, 1760):
        d.rectangle((x, 0, x + 26, 300), fill=(44, 46, 50, 255))
    img = comp(img, lay, 2)
    img = grain(img, 3, 105)
    img = inset(img, (1380, 790, 1800, 1026), 'END n256-347: MCU; the wrench drifts off', S01_end)
    img = label(img, 'AI FOOTAGE · S01 · One free-flying move: a dark module, out of a round hatch, along the truss past the docked capsule, down to her at the guest module; the email, the wrench drifts off · ~18-20 mm FPV → ~35 mm MCU · creep push, burst out, glide, orbit in, settle', size=38, maxw=1340)
    save(img, 'S01.png')


def S02():
    img = to_img(grad([(0, (222, 216, 196)), (.5, (236, 236, 232)), (1, (176, 170, 150))]))
    img = blobs(img, [('r', (-50, 520, 2000, 1130), (214, 186, 120, 255))], 40)     # pale-gold blanket, soft
    img = specks(img, (0, 0, W, H), 300, [(200, 196, 184, 160)], (3, 8), 201, 6)     # quilting, out of focus
    lay = layer(); d = ImageDraw.Draw(lay)
    d.rounded_rectangle((560, 330, 1040, 740), radius=60, fill=(246, 246, 246, 255))  # the white tool bag
    d.rounded_rectangle((560, 330, 1040, 420), radius=50, fill=(226, 228, 230, 255))
    for x in (660, 940):
        d.rectangle((x, 330, x + 26, 740), fill=(196, 200, 204, 255))
    d.arc((720, 250, 880, 380), 180, 360, fill=(196, 200, 204, 255), width=22)
    img = comp(img, lay, 1.5)
    img = blobs(img, [('e', (1380, 420, 1900, 820), (232, 234, 236, 255)), ('r', (1280, 560, 1500, 700), (220, 222, 224, 255))], 14)   # the glove leaving right
    img = blobs(img, [('r', (1560, 470, 1720, 860), ORANGE + (255,))], 16)
    img = bracket(img, (560, 250, 1040, 740), 'the bag hangs in the air (it never drops)', 'left')
    img = grain(img, 3, 202)
    img = label(img, 'AI FOOTAGE · S02 · CU against the station hull: her glove lets go of the white tool bag and pulls away; the bag just stays there · ~35 mm, shallow focus · near-static (scale 0.994)')
    save(img, 'S02.png')


def S03():
    img = space(stars=0)
    img = blobs(img, [('e', (-300, 500, 900, 1300), (40, 60, 100, 200))], 120)
    lay = layer(); d = ImageDraw.Draw(lay)
    d.rounded_rectangle((260, 300, 1660, 980), radius=120, fill=SUIT + (255,))             # her forearm
    d.rectangle((260, 300, 1660, 400), fill=ORANGE + (255,))                                # the arm band
    d.rounded_rectangle((560, 430, 1360, 900), radius=40, fill=(246, 246, 247, 255))        # the bezel
    d.rounded_rectangle((610, 480, 1310, 850), radius=26, fill=(150, 205, 250, 255))        # the screen (glow, unreadable)
    d.polygon([(1360, 430), (1620, 260), (1760, 520), (1360, 640)], fill=(236, 238, 240, 255))   # the cover, ripped back
    img = comp(img, lay, 2)
    img = blobs(img, [('e', (600, 470, 1320, 860), (210, 236, 255, 160))], 40)
    img = blobs(img, [('e', (1560, 160, 1960, 560), (228, 230, 233, 255))], 10)              # the glove
    img = grain(img, 3, 301)
    img = label(img, 'AI FOOTAGE · S03 · CU: one broad pull rips open the padded Velcro cover of her wrist display; the screen glows (never readable) · ~50 mm, shallow focus · static, only the hand moves')
    save(img, 'S03.png')


def S04():
    img = space(seed=401)
    img = earth(img, 260, 1500, 900, light=(.5, -.9), seed=402)
    img = sun(img, 650, 450, 70)
    img = module(img, (1660, 60, 2400, 1000), gold=True)
    img = astro(img, 1360, 150, 1150, 'float', facing=-1, blur=2,
                tag='Wren, medium-wide, right half; her wrist display mid-frame', tag_at=(1180, 1000))
    img = grain(img, 3, 403)
    img = label(img, 'AI FOOTAGE · S04 · At the guest module\'s hull: she reads, sighs, bonks her helmet reaching for her nose, the sunrise blasts her visor, a deep breath, she taps P1 · 35-50 mm, soft background · wobble up, quick tilt to her face, slow push ×1.32, hold', size=38, maxw=1100)
    save(img, 'S04.png')


def S09():
    img = space(seed=901)
    img = earth(img, 900, 2350, 1500, light=(-.2, -.95), seed=902)
    img = truss(img, (-100, 330), (520, 420), 46, (150, 154, 160))
    img = module(img, (40, 260, 360, 420), gold=True, shade=(110, 114, 120))
    img = array(img, (120, 120, 420, 250), 6, 2)
    img = tether(img, [(430, 400), (620, 560), (820, 520), (1000, 430), (1120, 450)])
    img = astro(img, 1180, 200, 480, 'drift', facing=-1, blur=1.5, tag='Wren, side-on, drifting; tether to her waist', tag_at=(1340, 690))
    img = grain(img, 3, 903)
    img = label(img, 'AI FOOTAGE · S09 · She has drifted off the hull, slowly turning, the station behind, her orange tether paying out in a long loose curve; she taps P2, the tether snaps taut and yanks her out right · ~35 mm · free-flying track, a truss strut wipes off left, 3-frame jolt at n917', size=30, maxw=520, x=1350, y=40)
    save(img, 'S09.png')


def S14_end():
    img = to_img(grad([(0, (6, 14, 18)), (.6, (14, 40, 36)), (1, (6, 12, 16))]))
    img = specks(img, (0, 0, W, H), 60, [(140, 255, 200, 160), (255, 240, 210, 200)], (6, 22), 1401, 8)
    img = astro(img, 900, 160, 1150, 'profile', facing=1, blur=2.5)
    return img


def S14():
    img = space(top=(3, 5, 10), bottom=(6, 10, 18), seed=1402)
    img = earth(img, 960, 2200, 1500, night=True, seed=1403)
    img = aurora(img, 560, 1000, 1404)
    img = array(img, (40, 90, 520, 300), 8, 3)
    img = specks(img, (40, 90, 520, 300), 40, [(255, 255, 255, 255)], (1, 2.5), 1405)        # pinprick hits on the array
    img = truss(img, (-100, 470), (2020, 520), 70, (176, 182, 190))
    img = streaks(img, 16, (200, 0, 1900, 700), seed=1406)
    img = astro(img, 712, 300, 270, 'haul', facing=1, blur=1.2, tag='Wren small on the rail, hand over hand', tag_at=(560, 240))
    img = grain(img, 3, 1407)
    img = inset(img, (96, 790, 516, 1026), 'END n1200-1233: MCU profile, the shout', S14_end)
    img = label(img, 'AI FOOTAGE · S14 · Night side over an aurora, a solar storm arriving: a debris shower streaks past as she hauls herself along the truss; she taps P3, ducks, crash zoom to her delighted shout · ~28 mm wide → MCU · truck + slow push ×1.40, crash push ×5.6, surging bob', size=36, maxw=1700)
    save(img, 'S14.png')


def S15():
    img = to_img(grad([(0, (8, 14, 20)), (1, (10, 30, 30))]))
    img = truss(img, (-100, 820), (2020, 560), 110, (190, 196, 202), blur=3)
    img = blobs(img, [('e', (520, 520, 860, 820), (232, 234, 236, 255)), ('r', (440, 620, 560, 760), ORANGE + (255,)),
                      ('e', (1180, 440, 1520, 720), (232, 234, 236, 255)), ('r', (1500, 520, 1620, 660), ORANGE + (255,))], 10)
    img = streaks(img, 14, (0, 0, W, 500), angle=.02, length=(300, 700), seed=1501)
    img = img.filter(ImageFilter.BoxBlur(3))
    img = grain(img, 3, 1502)
    img = label(img, 'AI FOOTAGE · S15 · Low tracking CU along the handrail: her gloves grab rail after rail at speed, debris glints streak past · ~24 mm, heavy motion blur · tracking, a fast move left at the end')
    save(img, 'S15.png')


def airlock(img, cx=1100, cy=560):
    a = np.asarray(img).astype(np.float32)
    lay = layer(); d = ImageDraw.Draw(lay)
    for k in range(7):   # ring frames receding: a cramped white cylinder
        r = 980 - k * 120
        d.ellipse((cx - r * 1.1, cy - r * .9, cx + r * 1.1, cy + r * .9), outline=(206 - k * 6, 212 - k * 6, 218 - k * 6, 255), width=30)
    for x in (cx - 700, cx + 640):
        d.rectangle((x, 120, x + 60, 980), fill=(250, 252, 255, 180))                 # cool panel light strips
    return comp(img, lay, 4)


def S20():
    img = to_img(grad([(0, (196, 202, 208)), (.5, (226, 230, 234)), (1, (170, 176, 182))]))
    img = airlock(img)
    img = blobs(img, [('e', (-200, 120, 640, 940), (255, 255, 255, 255))], 40)                        # the sun's glare through the outer hatch
    img = blobs(img, [('p', [(140, 120), (560, 230), (560, 900), (140, 1000)], (176, 182, 190, 255))], 3)   # the outer hatch, half-closed
    img = tether(img, [(560, 980), (480, 760), (520, 540), (700, 520), (900, 700)], width=9)
    img = astro(img, 1300, 330, 640, 'curl', facing=-1, blur=1.5, tag='Wren curled against the inner hatch', tag_at=(1120, 980))
    img = grain(img, 3, 2001)
    img = label(img, 'AI FOOTAGE · S20 · The airlock: she tumbles in, bumps the far wall, fetches up curled against the inner hatch; the outer hatch won\'t close on her own tether (the red alarm pulse is a comp grade) · ~24 mm · handheld, drift right', size=38)
    save(img, 'S20.png')


def S21():
    img = to_img(grad([(0, (240, 230, 230)), (.5, (210, 120, 120)), (1, (240, 224, 224))]))
    img = streaks(img, 60, (0, 0, W + 400, H), col=(255, 255, 255), angle=0, length=(400, 900), width=(4, 14), seed=2101, alpha=(80, 200))
    img = img.filter(ImageFilter.BoxBlur(6))
    img = wrench(img, 338, 436, 92, ang=.35, blur=1.5)
    img = grain(img, 3, 2102)
    img = label(img, 'AI FOOTAGE · S21 · Macro tracking: the silver wrench from 09:12 tumbles end over end through the gap of the outer hatch into the red-lit airlock · ~100 mm macro · locked on the object, growing ~2 %/f', where='bottom')
    save(img, 'S21.png')


def S22():
    img = to_img(grad([(0, (190, 196, 204)), (.6, (214, 218, 224)), (1, (150, 156, 164))]))
    img = airlock(img, 800, 700)
    lay = layer(); d = ImageDraw.Draw(lay)
    d.arc((260, -520, 1460, 300), 0, 180, fill=(150, 156, 164, 255), width=70)                        # the hatch rim above her helmet
    img = comp(img, lay, 2)
    img = astro(img, 800, 170, 1300, 'mcu', facing=1, blur=2, tag='Wren MCU, helmet left of centre, rim just above', tag_at=(1060, 640))
    img = wrench(img, 1360, 600, 48, ang=-.6)
    img = grain(img, 3, 2201)
    img = label(img, x=1040, maxw=800, size=38, text='AI FOOTAGE · S22 · The wrench clangs off the rim an inch above her helmet and spins away; one long blink; she calmly taps P4 (the red alarm pulse is a comp grade) · ~50 mm · whip-in snap stop, then still')
    save(img, 'S22.png')


def S24():
    img = to_img(grad([(0, (40, 38, 40)), (.5, (58, 54, 56)), (1, (28, 26, 28))]))
    img = specks(img, (0, 0, W, H), 160, [(80, 76, 78, 200)], (10, 26), 2401, 4)                      # padded panels
    win = to_img(grad([(0, (255, 170, 110)), (.5, (255, 120, 140)), (1, (255, 200, 150))]))
    win = streaks(win, 40, (0, 0, W, H), col=(255, 240, 220), angle=-.3, length=(200, 600), width=(6, 16), seed=2402)
    m = Image.fromarray((radial(640, 360, 200) < 1).astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(2))
    img = Image.composite(win, img, m)
    img = blobs(img, [('e', (240, 0, 1300, 900), (255, 150, 110, 70))], 120)                           # warm spill
    lay = layer(); d = ImageDraw.Draw(lay)
    d.ellipse((640 - 230, 360 - 230, 640 + 230, 360 + 230), outline=(90, 88, 90, 255), width=36)
    d.line([(1780, 0), (1780, 430)], fill=(30, 30, 32, 255), width=4)                                   # the whale's cord
    plush_whale(d, 1750, 500, 260, facing=1)                                                            # the plush whale, hanging from it
    img = comp(img, lay, 2)
    img = astro(img, 1110, 380, 1100, 'seat', facing=1, blur=2, tag='Wren in the couch, low angle, wrist raised', tag_at=(1220, 1010))
    img = grain(img, 4, 2403)
    img = label(img, x=1000, maxw=860, size=32, text='AI FOOTAGE · S24 · Re-entry: plasma glow builds in the round window behind her, the cabin shakes and dims, the plush whale swings; she taps P5 on the last bar · ~24-28 mm low angle · slow pull-back ×0.41, the camera rising, fine shake')
    save(img, 'S24.png')


def sea(horizon=500, sunx=1500, suny=360):
    img = to_img(grad([(0, (236, 182, 120)), (horizon / H * .9, (252, 222, 170)), (horizon / H, (255, 236, 200)), (horizon / H + .02, (186, 150, 100)), (1, (70, 76, 90))]))
    img = sun(img, sunx, suny, 60)
    img = specks(img, (0, horizon, W, H), 900, [(255, 244, 210, 230), (255, 220, 160, 200)], (1, 4), 2601, .6, streak=26)
    return img


def S26_end():
    img = sea(500, 1720, 250)
    img = capsule(img, 560, 760, 60)
    img = blobs(img, [('e', (550, 660, 580, 680), (250, 250, 250, 255)), ('p', [(550, 668), (530, 660), (552, 672)], (60, 60, 60, 255))], 1)   # the gull, perched
    img = blobs(img, [('r', (1600, 492, 1616, 500), (80, 80, 90, 255))], 1)                          # the recovery boat, a speck
    return img


def S26():
    img = sea(560, 1600, 260)
    img = capsule(img, 1220, 1260, 520, window=False)
    img = astro(img, 1230, 150, 1000, 'sit', facing=-1, blur=2.5, tag='Wren MCU, helmet off, face to the sun', tag_at=(900, 70))
    img = grain(img, 3, 2602)
    img = inset(img, (1452, 120, 1852, 345), 'END n2085-2174: wide, gull lands', S26_end)
    img = label(img, 'AI FOOTAGE · S26 · 19:47, splashdown at golden hour: she sits on the bobbing capsule, smiles at the reply, then looks down at the water; pull back to one small capsule on a vast sea; a gull lands · ~50-85 mm MCU → wide · ease-out pan, tilt down, pull-back ×0.45', where='bottom', size=36)
    save(img, 'S26.png')


def S27():
    """end card A, 'endcard-wash': S26's last picture (the wide, no overlays) x 0.24 + #F7F7F7 x 0.76"""
    end = np.asarray(grain(S26_end(), 3, 2701)).astype(np.float32)
    wash = end * .24 + np.array([247, 247, 247], np.float32) * .76
    img = to_img(wash)
    d = ImageDraw.Draw(img)
    d.text((60, H - 56), 'PLACEHOLDER WASH · S26 n2174 (plate only) × 0.24 + #F7F7F7 × 0.76', font=font(FR, 24), fill=(150, 150, 150))
    save(img, 'S27-wash.png')


# ---------- her film's pieces (shown inside the editor viewer) ----------
def bubble_edge(img):
    """the faint curve of the helmet bubble at one edge: it reads as her helmet camera"""
    lay = layer(); d = ImageDraw.Draw(lay)
    d.arc((-900, -600, W + 300, H + 900), 190, 260, fill=(255, 255, 255, 60), width=10)
    return comp(img, lay, 6)


def A1():
    img = space(seed=3101)
    img = earth(img, 960, 2900, 2100, light=(0, -1), seed=3102)
    img = sun(img, 880, 790, 80)
    img = blobs(img, [('e', (300, 500, 1500, 1100), (255, 214, 140, 90))], 90)           # gold wash
    img = module(img, (1460, 860, 2300, 1300), gold=True)
    img = blobs(img, [('r', (1380, 820, 2000, 846), (250, 250, 250, 255))], 2)             # handrail
    img = bubble_edge(img)
    img = label(img, 'AI FOOTAGE (AD) · A1 · Her helmet cam: the sun bursts over Earth\'s thin blue limb, hull and handrail at the lower right · ~16 mm POV · slow weightless drift', size=40, maxw=860, where='top', anchor='right')
    save(img, 'A1-sunrise.png')


def A2():
    img = space(seed=3201)
    img = earth(img, 960, 1700, 1100, light=(-.3, -.95), seed=3202)
    img = truss(img, (560, 360), (1340, 400), 30, (190, 194, 200))
    img = module(img, (820, 330, 1080, 430), gold=True)
    img = array(img, (600, 250, 820, 340), 5, 2); img = array(img, (1100, 260, 1320, 350), 5, 2)
    img = tether(img, [(-40, 1100), (300, 800), (420, 560), (700, 450), (900, 400)], width=16, blur=2)
    img = bubble_edge(img)
    img = label(img, 'AI FOOTAGE (AD) · A2 · Her helmet cam drifting away: the station shrinks against the blue Earth, the orange tether paying out in front of the lens · ~16 mm POV · slowly turning, backing away', size=40, maxw=860, where='bottom', anchor='right')   # bottom: S13's framing crops the comp's top 26 %
    save(img, 'A2-drift.png')


def A3():
    img = space(top=(3, 5, 10), bottom=(6, 10, 18), seed=3301)
    img = earth(img, 960, 2100, 1450, night=True, seed=3302)
    img = aurora(img, 560, 1000, 3303, 170)
    img = streaks(img, 12, (300, 0, 1900, 600), col=(255, 236, 200), length=(240, 520), width=(2, 4), seed=3304, alpha=(120, 200))
    img = truss(img, (-60, 120), (200, 1100), 60, (150, 156, 164))
    img = label(img, 'AI FOOTAGE (AD) · A3 · Her helmet-cam debris over the aurora and the night side, played at 1/4 speed, graded warm: soft shooting stars · wide · locked off', size=40, maxw=860, where='top', anchor='right')
    save(img, 'A3-stars.png')


def lull_room():
    img = to_img(grad([(0, (226, 232, 238)), (.6, (236, 240, 244)), (1, (206, 212, 220))]))
    win = space(seed=3401)
    win = earth(win, 960, 900, 420, light=(-.4, -.9), seed=3402)
    m = Image.fromarray((radial(960, 470, 330) < 1).astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(2))
    img = Image.composite(win, img, m)
    lay = layer(); d = ImageDraw.Draw(lay)
    d.ellipse((960 - 350, 470 - 350, 960 + 350, 470 + 350), outline=(248, 248, 250, 255), width=26)
    d.rounded_rectangle((220, 760, 1700, 980), radius=110, fill=(246, 246, 244, 255))       # the curved soft lounge
    d.rounded_rectangle((260, 700, 1660, 800), radius=50, fill=(238, 238, 236, 255))
    d.ellipse((300, 470, 520, 600), fill=(240, 236, 230, 255)); d.ellipse((1420, 420, 1620, 540), fill=(240, 236, 230, 255))   # floating cushions
    for x in (120, 1780):
        d.rectangle((x, 140, x + 18, 940), fill=(255, 255, 255, 200))                       # hidden light strips
    img = comp(img, lay, 2)
    return img


def A4():
    img = lull_room()
    img = label(img, 'AI STILL (AD) · A4 · Marketing\'s photo: inside The Lull, a soft white lounge facing one big round window, Earth outside · 24 mm · still', size=40, maxw=860, where='bottom', anchor='right')
    save(img, 'A4-lull.png')


def A4red():
    img = red(lull_room(), .42)
    img = label(img, 'AI STILL (AD) · A4 + P4 grade (comp) · the same photo re-lit soft red: "mood lighting" · 24 mm · still', size=40, maxw=860, where='bottom', anchor='right')
    save(img, 'A4-lull-red.png')


def A5():
    img = to_img(grad([(0, (34, 32, 34)), (1, (20, 18, 20))]))
    img = specks(img, (0, 0, W, H), 120, [(70, 66, 68, 200)], (12, 30), 3501, 5)
    win = to_img(grad([(0, (255, 160, 110)), (.5, (255, 110, 150)), (1, (255, 196, 140))]))
    win = streaks(win, 50, (0, 0, W, H), col=(255, 244, 228), angle=-.3, length=(200, 700), width=(8, 20), seed=3502)
    m = Image.fromarray((radial(960, 520, 330) < 1).astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(2))
    img = Image.composite(win, img, m)
    img = blobs(img, [('e', (300, 0, 1620, 1080), (255, 140, 110, 80))], 140)
    lay = layer(); d = ImageDraw.Draw(lay)
    d.ellipse((960 - 370, 520 - 370, 960 + 370, 520 + 370), outline=(90, 86, 88, 255), width=60)
    img = comp(img, lay, 2)
    img = label(img, 'AI STILL (AD) · A5 · Her helmet cam in the capsule: the round window full of orange-pink plasma, warm light on padded panels · 50 mm · code push', size=40, maxw=860, where='top', anchor='right')
    save(img, 'A5-glow.png')


def B1():
    img = to_img(grad([(0, (222, 216, 196)), (1, (190, 182, 160))]))
    img = blobs(img, [('r', (660, 300, 1260, 800), (246, 246, 246, 255))], 3)
    img = bubble_edge(img)
    img = label(img, 'AI FOOTAGE (CLIP) · B1 · Her helmet cam: the tool bag floating in place, 09:13', size=40, maxw=860, where='top', anchor='right')
    save(img, 'B1-bag.png')


def B2():
    img = space(seed=3601)
    img = earth(img, 1500, 1900, 1150, light=(-.4, -.9), seed=3602)
    img = wrench(img, 760, 460, 70, ang=.9)
    img = bubble_edge(img)
    img = label(img, 'AI FOOTAGE (CLIP) · B2 · Her helmet cam: the wrench drifting away into the black, 09:12', size=40, maxw=860, where='top', anchor='right')
    save(img, 'B2-wrench.png')


if __name__ == '__main__':
    for fn in (S01, S02, S03, S04, S09, S14, S15, S20, S21, S22, S24, S26, S27, A1, A2, A3, A4, A4red, A5, B1, B2):
        fn()
