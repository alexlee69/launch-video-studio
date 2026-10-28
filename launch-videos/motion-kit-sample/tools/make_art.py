# -*- coding: utf-8 -*-
"""Wayfinch sample art: drawn travel postcards (SVG), one wide panorama and the logo.

Every picture is drawn here from plain shapes and gradients: no stock, no footage, no generated images, no real place
or brand. Run:  /usr/bin/python3 -I tools/make_art.py   (writes assets/*.svg next to this folder)
"""
import math
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'assets')
os.makedirs(OUT, exist_ok=True)


def svg(w, h, body, defs=''):
    # preserveAspectRatio slice: drawn into a box of another shape (a 16:9 panorama as a 9:16 bg), the picture is
    # cover-cropped like a photo instead of letterboxed (an SVG's own default is meet, which the engine's bg <image>
    # slice does not override)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid slice">'
            f'<defs>{defs}</defs>{body}</svg>\n')


def lin(i, stops, x2=0, y2=1):
    s = ''.join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in stops)
    return f'<linearGradient id="{i}" x1="0" y1="0" x2="{x2}" y2="{y2}">{s}</linearGradient>'


def rad(i, stops, cx=.5, cy=.5, r=.5):
    s = ''.join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops)
    return f'<radialGradient id="{i}" cx="{cx}" cy="{cy}" r="{r}">{s}</radialGradient>'


def write(name, text):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        f.write(text)


def glitter(rng, x0, x1, y0, y1, n, col, op=.75):
    out = []
    for _ in range(n):
        y = rng.uniform(y0, y1)
        k = (y - y0) / max(1, y1 - y0)
        w = rng.uniform(18, 60) * (1 + k)
        x = rng.gauss((x0 + x1) / 2, (x1 - x0) / 4 * (1 + k))
        out.append(f'<rect x="{x - w / 2:.1f}" y="{y:.1f}" width="{w:.1f}" height="{3 + 3 * k:.1f}" rx="2" fill="{col}" opacity="{op * rng.uniform(.4, 1):.2f}"/>')
    return ''.join(out)


# ── the cove at golden hour (the hidden spot: lit tile, float card, its panorama) ──
def cove(w, h, seed=7):
    rng = random.Random(seed)
    sx, hz = w * .56, h * .54          # sun x, horizon
    defs = (lin('sky', [(0, '#F6A47F'), (.55, '#F7C08F'), (1, '#FFE2B4')]) +
            lin('sea', [(0, '#2A8E9B'), (.5, '#1A6D80'), (1, '#0F4B60')]) +
            lin('sand', [(0, '#F6D6A5'), (1, '#E9B984')]) +
            lin('cliffL', [(0, '#5A3554'), (1, '#2F1F3A')], 1, 0) +
            lin('cliffR', [(0, '#3A2443'), (1, '#64395A')], 1, 0) +
            rad('sun', [(0, '#FFF6E0', 1), (.35, '#FFE7B8', .8), (1, '#FFD49A', 0)]) +
            rad('vig', [(.6, '#000', 0), (1, '#2A1030', .28)], r=.75))
    b = [f'<rect width="{w}" height="{h}" fill="url(#sky)"/>',
         f'<circle cx="{sx}" cy="{hz - h * .02}" r="{h * .3}" fill="url(#sun)"/>',
         # the sun is half set: its lower half goes under the sea (drawn next), so a scrim over the picture never leaves
         # a grey disc floating behind a headline
         f'<circle cx="{sx}" cy="{hz + h * .012}" r="{h * .07}" fill="#FFF8EA"/>']
    # far headland on the horizon
    b.append(f'<path d="M{w * .26} {hz} C{w * .32} {hz - h * .045},{w * .4} {hz - h * .035},{w * .45} {hz - h * .015} L{w * .49} {hz} Z" fill="#B0617A" opacity=".55"/>')
    b.append(f'<rect y="{hz}" width="{w}" height="{h - hz}" fill="url(#sea)"/>')
    b.append(glitter(rng, sx - w * .08, sx + w * .08, hz + 6, h * .86, int(70 * w / 1000), '#FFE6BC'))
    # a small boat with a white sail
    bx, by = w * .7, hz + h * .1
    b.append(f'<path d="M{bx - 34} {by} L{bx + 34} {by} L{bx + 24} {by + 12} L{bx - 24} {by + 12} Z" fill="#2B1C33"/>'
             f'<path d="M{bx} {by - 2} L{bx} {by - 70} L{bx + 36} {by - 6} Z" fill="#FFF5E6"/>')
    # cliffs left and right (they frame the cove)
    b.append(f'<path d="M0 {h * .22} C{w * .1} {h * .2},{w * .18} {h * .3},{w * .22} {h * .44} C{w * .26} {h * .56},{w * .3} {h * .66},{w * .36} {h * .76} '
             f'C{w * .3} {h * .86},{w * .16} {h * .95},0 {h} Z" fill="url(#cliffL)"/>')
    b.append(f'<path d="M{w * .02} {h * .23} C{w * .1} {h * .22},{w * .17} {h * .31},{w * .2} {h * .43}" stroke="#E98F79" stroke-width="{w * .006}" fill="none" opacity=".7"/>')
    b.append(f'<path d="M{w} {h * .3} C{w * .9} {h * .3},{w * .84} {h * .4},{w * .82} {h * .5} C{w * .8} {h * .6},{w * .74} {h * .72},{w * .7} {h * .8} '
             f'C{w * .8} {h * .9},{w * .92} {h * .96},{w} {h} Z" fill="url(#cliffR)"/>')
    # the beach crescent and the foam line
    b.append(f'<path d="M{w * .12} {h} C{w * .3} {h * .84},{w * .7} {h * .84},{w * .9} {h} Z" fill="url(#sand)"/>')
    b.append(f'<path d="M{w * .16} {h * .975} C{w * .32} {h * .855},{w * .68} {h * .855},{w * .86} {h * .975}" stroke="#FFFFFF" stroke-width="{h * .008}" fill="none" opacity=".85"/>')
    b.append(f'<rect width="{w}" height="{h}" fill="url(#vig)"/>')
    return svg(w, h, ''.join(b), defs)


def cliffs(w=1000, h=1000):
    defs = (lin('sky', [(0, '#7CC8EC'), (1, '#E4F5FB')]) + lin('sea', [(0, '#2B9CC8'), (1, '#105E8A')]) +
            lin('chalk', [(0, '#FBF6EE'), (1, '#D8CCBB')], 1, 0))
    b = [f'<rect width="{w}" height="{h}" fill="url(#sky)"/>',
         f'<ellipse cx="{w * .25}" cy="{h * .18}" rx="{w * .14}" ry="{h * .035}" fill="#FFFFFF" opacity=".9"/>',
         f'<ellipse cx="{w * .33}" cy="{h * .16}" rx="{w * .09}" ry="{h * .04}" fill="#FFFFFF" opacity=".9"/>',
         f'<ellipse cx="{w * .78}" cy="{h * .28}" rx="{w * .12}" ry="{h * .025}" fill="#FFFFFF" opacity=".75"/>',
         f'<rect y="{h * .6}" width="{w}" height="{h * .4}" fill="url(#sea)"/>',
         # the chalk cliff, its green cap and its shadow face
         f'<path d="M{w * .34} {h} L{w * .4} {h * .5} C{w * .55} {h * .44},{w * .8} {h * .42},{w} {h * .4} L{w} {h} Z" fill="url(#chalk)"/>',
         f'<path d="M{w * .4} {h * .5} C{w * .55} {h * .44},{w * .8} {h * .42},{w} {h * .4} L{w} {h * .45} C{w * .8} {h * .47},{w * .56} {h * .49},{w * .41} {h * .55} Z" fill="#7DB36A"/>',
         f'<path d="M{w * .34} {h} L{w * .4} {h * .55} L{w * .47} {h * .56} L{w * .43} {h} Z" fill="#C9B9A4"/>',
         # the lighthouse
         f'<rect x="{w * .7}" y="{h * .23}" width="{w * .05}" height="{h * .2}" fill="#FFFFFF"/>',
         f'<rect x="{w * .7}" y="{h * .28}" width="{w * .05}" height="{h * .035}" fill="#E8452C"/>',
         f'<rect x="{w * .7}" y="{h * .36}" width="{w * .05}" height="{h * .035}" fill="#E8452C"/>',
         f'<rect x="{w * .695}" y="{h * .2}" width="{w * .06}" height="{h * .035}" rx="4" fill="#2B2F3A"/>',
         f'<path d="M{w * .7} {h * .2} L{w * .725} {h * .17} L{w * .75} {h * .2} Z" fill="#E8452C"/>',
         f'<path d="M{w * .02} {h * .78} C{w * .12} {h * .76},{w * .2} {h * .8},{w * .3} {h * .78}" stroke="#FFFFFF" stroke-width="5" fill="none" opacity=".6"/>',
         f'<path d="M{w * .05} {h * .9} C{w * .15} {h * .88},{w * .22} {h * .92},{w * .32} {h * .9}" stroke="#FFFFFF" stroke-width="5" fill="none" opacity=".45"/>']
    return svg(w, h, ''.join(b), defs)


def islands(w=1000, h=1000, seed=3):
    rng = random.Random(seed)
    defs = lin('sea', [(0, '#1BB0BE'), (1, '#0A6A8A')], 1, 1)
    b = [f'<rect width="{w}" height="{h}" fill="url(#sea)"/>']
    for (cx, cy, r) in [(.3, .32, .2), (.72, .62, .16), (.2, .8, .09), (.82, .18, .07)]:
        pts = []
        for k in range(14):
            a = k / 14 * math.tau
            rr = r * (1 + .18 * math.sin(3 * a + cx * 9) + .08 * math.sin(5 * a + cy * 7))
            pts.append((cx + rr * math.cos(a), cy + rr * .85 * math.sin(a)))
        def path(scale, col, op=1):
            q = [(cx + (x - cx) * scale, cy + (y - cy) * scale) for x, y in pts]
            d = f'M{q[0][0] * w:.1f} {q[0][1] * h:.1f}' + ''.join(
                f' Q{q[i][0] * w:.1f} {q[i][1] * h:.1f} {(q[i][0] + q[(i + 1) % len(q)][0]) / 2 * w:.1f} {(q[i][1] + q[(i + 1) % len(q)][1]) / 2 * h:.1f}' for i in range(len(q))) + 'Z'
            return f'<path d="{d}" fill="{col}" opacity="{op}"/>'
        b += [path(1.35, '#7FE0D6', .55), path(1.12, '#BDEFE3', .8), path(1.0, '#F3DFB3'), path(.82, '#58A866'), path(.5, '#3F8A52')]
    for _ in range(5):   # boat wakes
        x, y = rng.uniform(.45, .9) * w, rng.uniform(.25, .45) * h
        b.append(f'<path d="M{x:.0f} {y:.0f} l-70 34" stroke="#FFFFFF" stroke-width="4" opacity=".7"/><rect x="{x - 6:.0f}" y="{y - 4:.0f}" width="14" height="8" rx="3" fill="#FFFFFF"/>')
    return svg(w, h, ''.join(b), defs)


def oldtown(w=1000, h=1000, seed=11):
    rng = random.Random(seed)
    defs = lin('sky', [(0, '#2D3A72'), (.6, '#B66F86'), (1, '#F49C74')])
    b = [f'<rect width="{w}" height="{h}" fill="url(#sky)"/>', f'<circle cx="{w * .78}" cy="{h * .2}" r="{w * .035}" fill="#FFF2DA" opacity=".9"/>']
    # bell tower
    b.append(f'<rect x="{w * .58}" y="{h * .22}" width="{w * .09}" height="{h * .5}" fill="#E7C9A2"/><path d="M{w * .57} {h * .22} L{w * .625} {h * .12} L{w * .68} {h * .22} Z" fill="#B9483A"/>'
             f'<rect x="{w * .605}" y="{h * .28}" width="{w * .04}" height="{h * .06}" rx="{w * .02}" fill="#3A2440"/>')
    cols = ['#F2D7B6', '#E9B98F', '#F6E6CF', '#DDA27A', '#EFCFA8']
    for row, (y0, hh) in enumerate([(.5, .26), (.64, .24), (.78, .24)]):
        x = -40 + row * 30
        while x < w:
            bw = rng.uniform(.12, .2) * w
            top = (y0 + rng.uniform(-.03, .03)) * h
            col = rng.choice(cols)
            b.append(f'<rect x="{x:.0f}" y="{top:.0f}" width="{bw:.0f}" height="{h - top:.0f}" fill="{col}"/>')
            b.append(f'<path d="M{x - 8:.0f} {top:.0f} L{x + bw / 2:.0f} {top - bw * .32:.0f} L{x + bw + 8:.0f} {top:.0f} Z" fill="#C4553A"/>')
            for wx in range(2):
                for wy in range(2):
                    lit = rng.random() < .6
                    b.append(f'<rect x="{x + bw * (.2 + .4 * wx):.0f}" y="{top + 30 + wy * 60:.0f}" width="{bw * .18:.0f}" height="34" rx="4" fill="{"#FFD27A" if lit else "#5A4256"}"/>')
            x += bw + 6
    return svg(w, h, ''.join(b), defs)


def market(w=1000, h=1000, seed=5):
    rng = random.Random(seed)
    defs = lin('sky', [(0, '#0C1230'), (1, '#2A2F66')]) + rad('glow', [(0, '#FFC772', .55), (1, '#FFC772', 0)])
    b = [f'<rect width="{w}" height="{h}" fill="url(#sky)"/>']
    for k in range(3):   # strings of lights
        y0 = h * (.14 + k * .13)
        pts = [(i / 24 * w, y0 + math.sin(i / 24 * math.pi) * h * .09) for i in range(25)]
        b.append('<path d="M' + ' L'.join(f'{x:.0f} {y:.0f}' for x, y in pts) + '" stroke="#3B3A55" stroke-width="3" fill="none"/>')
        for x, y in pts[1:-1]:
            b.append(f'<circle cx="{x:.0f}" cy="{y + 10:.0f}" r="28" fill="url(#glow)"/><circle cx="{x:.0f}" cy="{y + 10:.0f}" r="8" fill="#FFE2A0"/>')
    for i in range(4):   # stalls with striped awnings
        x = w * (.02 + i * .25)
        b.append(f'<rect x="{x:.0f}" y="{h * .66:.0f}" width="{w * .22:.0f}" height="{h * .34:.0f}" fill="#1D1F3D"/>')
        for s in range(6):
            b.append(f'<rect x="{x + s * w * .22 / 6:.0f}" y="{h * .6:.0f}" width="{w * .22 / 6:.0f}" height="{h * .08:.0f}" fill="{"#E8452C" if s % 2 == 0 else "#FFF1DE"}"/>')
        b.append(f'<rect x="{x + w * .03:.0f}" y="{h * .74:.0f}" width="{w * .16:.0f}" height="{h * .05:.0f}" rx="6" fill="#FFB547" opacity=".85"/>')
    return svg(w, h, ''.join(b), defs)


def beach(w=1000, h=1000, seed=9):
    rng = random.Random(seed)
    defs = lin('sea', [(0, '#22B6C2'), (1, '#0E7E9A')], 1, 0)
    b = [f'<rect width="{w}" height="{h}" fill="#F1D8AA"/>',
         f'<path d="M{w * .55} 0 C{w * .62} {h * .3},{w * .52} {h * .62},{w * .72} {h} L{w} {h} L{w} 0 Z" fill="url(#sea)"/>',
         f'<path d="M{w * .55} 0 C{w * .62} {h * .3},{w * .52} {h * .62},{w * .72} {h}" stroke="#FFFFFF" stroke-width="14" fill="none" opacity=".9"/>',
         f'<path d="M{w * .6} 0 C{w * .67} {h * .3},{w * .57} {h * .62},{w * .77} {h}" stroke="#FFFFFF" stroke-width="5" fill="none" opacity=".5"/>']
    cols = [('#E8452C', '#FFF4E4'), ('#FFB547', '#FFFFFF'), ('#2BB3A8', '#FFFFFF'), ('#5747A8', '#FFE8C9')]
    for i in range(7):
        x, y = rng.uniform(.08, .45) * w, rng.uniform(.08, .92) * h
        a, c = cols[i % 4]
        b.append(f'<rect x="{x + 20:.0f}" y="{y + 40:.0f}" width="60" height="110" rx="8" fill="{c}" opacity=".9" transform="rotate(-20 {x:.0f} {y:.0f})"/>')
        segs = ''.join(f'<path d="M{x:.0f} {y:.0f} L{x + 62 * math.cos(k * math.pi / 4):.1f} {y + 62 * math.sin(k * math.pi / 4):.1f} A62 62 0 0 1 {x + 62 * math.cos((k + 1) * math.pi / 4):.1f} {y + 62 * math.sin((k + 1) * math.pi / 4):.1f} Z" fill="{a if k % 2 == 0 else c}"/>' for k in range(8))
        b.append(f'<circle cx="{x + 10:.0f}" cy="{y + 14:.0f}" r="62" fill="#000" opacity=".12"/>' + segs)
    return svg(w, h, ''.join(b), defs)


def lake(w=1000, h=1000):
    defs = lin('sky', [(0, '#F3B9A0'), (1, '#FCE3CF')]) + lin('lake', [(0, '#6E8FB8'), (1, '#2D4A73')])
    hz = h * .58
    mts = [(.0, .3, '#7A86B0'), (.3, .22, '#5E6C9C'), (.62, .34, '#8892B8')]
    b = [f'<rect width="{w}" height="{h}" fill="url(#sky)"/>']
    for x0, peak, col in mts:
        b.append(f'<path d="M{(x0 - .15) * w:.0f} {hz:.0f} L{(x0 + .2) * w:.0f} {peak * h:.0f} L{(x0 + .55) * w:.0f} {hz:.0f} Z" fill="{col}"/>')
        b.append(f'<path d="M{(x0 + .13) * w:.0f} {(peak + .08) * h:.0f} L{(x0 + .2) * w:.0f} {peak * h:.0f} L{(x0 + .27) * w:.0f} {(peak + .08) * h:.0f} Z" fill="#FFFFFF" opacity=".85"/>')
    b.append(f'<rect y="{hz}" width="{w}" height="{h - hz}" fill="url(#lake)"/>')
    for x0, peak, col in mts:
        b.append(f'<path d="M{(x0 - .15) * w:.0f} {hz:.0f} L{(x0 + .2) * w:.0f} {(2 * .58 - peak) * h:.0f} L{(x0 + .55) * w:.0f} {hz:.0f} Z" fill="{col}" opacity=".35"/>')
    for i in range(9):   # pines on the near shore
        x = (i / 8) * w * .5
        b.append(f'<path d="M{x:.0f} {h * .98:.0f} L{x + 30:.0f} {h * .8 - (i % 3) * 30:.0f} L{x + 60:.0f} {h * .98:.0f} Z" fill="#1E3B3A"/>')
    return svg(w, h, ''.join(b), defs)


def table(w=1000, h=1000, seed=13):
    rng = random.Random(seed)
    b = [f'<rect width="{w}" height="{h}" fill="#C88A57"/>']
    for i in range(9):
        b.append(f'<rect y="{i * h / 9:.0f}" width="{w}" height="3" fill="#A86E43" opacity=".6"/>')
    plates = [(.3, .3, .17, '#E8452C'), (.7, .34, .15, '#F0B13F'), (.42, .72, .16, '#4E9E5C'), (.8, .76, .11, '#8C3B5E')]
    for x, y, r, food in plates:
        b.append(f'<circle cx="{x * w + 10:.0f}" cy="{y * h + 14:.0f}" r="{r * w:.0f}" fill="#000" opacity=".15"/>'
                 f'<circle cx="{x * w:.0f}" cy="{y * h:.0f}" r="{r * w:.0f}" fill="#FFFDF7"/>'
                 f'<circle cx="{x * w:.0f}" cy="{y * h:.0f}" r="{r * w * .7:.0f}" fill="#F3EEE4"/>')
        for _ in range(7):
            a, d = rng.uniform(0, math.tau), rng.uniform(0, r * w * .45)
            b.append(f'<circle cx="{x * w + d * math.cos(a):.0f}" cy="{y * h + d * math.sin(a):.0f}" r="{rng.uniform(14, 30):.0f}" fill="{food}" opacity=".9"/>')
    b.append(f'<circle cx="{w * .12}" cy="{h * .62}" r="{w * .06}" fill="#7A1E3A" opacity=".85"/><circle cx="{w * .12}" cy="{h * .62}" r="{w * .06}" fill="none" stroke="#FFFFFF" stroke-width="6" opacity=".6"/>')
    return svg(w, h, ''.join(b), defs='')


def logo():
    # a coral tile with a white route that writes a W (for Wayfinch) and ends on a destination dot
    return svg(256, 256,
               '<rect width="256" height="256" rx="64" fill="#E8452C"/>'
               '<path d="M52 92 L88 176 L128 116 L168 176 L198 106" fill="none" stroke="#FFFFFF" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>'
               '<circle cx="206" cy="74" r="20" fill="#FFFFFF"/><circle cx="206" cy="74" r="8" fill="#E8452C"/>')



# ── the night coast (the name's backdrop): stars like the globe's dots, a crescent moon, a sea of moonlight ──
def night(w=1920, h=1080, seed=21):
    rng = random.Random(seed)
    hz = h * .62
    defs = (lin('sky', [(0, '#060A1A'), (.65, '#141C44'), (1, '#33285A')]) +
            lin('sea', [(0, '#101A3C'), (1, '#05070F')]) +
            rad('moonglow', [(0, '#F6D9C8', .35), (1, '#F6D9C8', 0)]) +
            rad('horizon', [(0, '#E8452C', .28), (1, '#E8452C', 0)], cy=.5, r=.5))
    b = [f'<rect width="{w}" height="{h}" fill="url(#sky)"/>',
         f'<ellipse cx="{w * .5}" cy="{hz}" rx="{w * .45}" ry="{h * .12}" fill="url(#horizon)"/>']
    for _ in range(int(260 * w / 1920)):
        x, y = rng.uniform(0, w), rng.uniform(0, hz * .96) ** 1.0
        r = rng.choice([1.2, 1.6, 2.2, 2.8, 3.6])
        col = rng.choice(['#FFFFFF', '#FFE6D8', '#F7B9A6'])
        b.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r}" fill="{col}" opacity="{rng.uniform(.35, .95):.2f}"/>')
    mx, my, mr = w * .78, h * .2, h * .05
    # the crescent is the lit disc masked by an offset disc (no dark disc painted over the glow: that read as an eclipse)
    defs += (f'<mask id="cres"><rect width="{w}" height="{h}" fill="#000"/><circle cx="{mx}" cy="{my}" r="{mr}" fill="#fff"/>'
             f'<circle cx="{mx + mr * .45}" cy="{my - mr * .2}" r="{mr * .92}" fill="#000"/></mask>')
    b.append(f'<circle cx="{mx - mr * .35}" cy="{my + mr * .1}" r="{mr * 2.6}" fill="url(#moonglow)" opacity=".7"/>'
             f'<circle cx="{mx}" cy="{my}" r="{mr}" fill="#FBE9DD" mask="url(#cres)"/>')
    b.append(f'<path d="M0 {hz} C{w * .12} {hz - h * .07},{w * .22} {hz - h * .05},{w * .3} {hz} Z" fill="#0A0F28"/>'
             f'<path d="M{w * .62} {hz} C{w * .72} {hz - h * .09},{w * .86} {hz - h * .1},{w} {hz - h * .04} L{w} {hz} Z" fill="#0A0F28"/>')
    b.append(f'<rect y="{hz}" width="{w}" height="{h - hz}" fill="url(#sea)"/>')
    b.append(glitter(rng, mx - w * .05, mx + w * .05, hz + 6, h * .95, int(60 * w / 1920), '#F3CBB8', .55))
    return svg(w, h, ''.join(b), defs)

write('cove.svg', cove(1000, 1000))
write('cove-wide.svg', cove(1920, 1080, seed=8))
write('cliffs.svg', cliffs())
write('islands.svg', islands())
write('oldtown.svg', oldtown())
write('market.svg', market())
write('beach.svg', beach())
write('lake.svg', lake())
write('table.svg', table())
write('logo.svg', logo())
write('night-wide.svg', night())
print('wrote', sorted(os.listdir(OUT)))
