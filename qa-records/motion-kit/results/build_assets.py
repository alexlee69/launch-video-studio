# -*- coding: utf-8 -*-
"""Assets for the motion-kit results page (2026-10-27): frames across each new transition of the shipped Wayfinch
16:9 film, before/after sheets of the QA1 glitches, the new pieces' storyboard heroes and the starters' boards.
Run with /usr/bin/python3 (needs Pillow); writes qa/motion-kit/results/page/assets/."""
import os, shutil, subprocess
from PIL import Image, ImageDraw, ImageFont

Q = '/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit'
J = os.path.expanduser('~/Downloads/launch-videos/motion-kit-sample')
OUT = os.path.join(Q, 'results', 'page', 'assets')
FONT = '/System/Library/Fonts/Menlo.ttc'
shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT)


def jpg(src, dst, width, q=82):
    im = Image.open(src).convert('RGB')
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, dst), 'JPEG', quality=q, optimize=True, progressive=True)
    return dst


# frames across each new transition (60-fps frame numbers of the shipped 16:9 film)
CUTS = {'dive-globe': 90, 'flood-ask': 360, 'carry-spots': 1050, 'dive-day': 1200, 'morph-go': 1560}
OFFS = [-12, -6, -3, -1, 0, 2, 6, 14]
film = os.path.join(J, 'wayfinch-16x9.mp4')
for name, c in CUTS.items():
    tmp = os.path.join(OUT, '_tmp'); os.makedirs(tmp, exist_ok=True)
    sel = '+'.join('eq(n\\,%d)' % (c + o) for o in OFFS)
    subprocess.run(['ffmpeg', '-v', 'error', '-i', film, '-vf', "select='%s',scale=640:-2" % sel, '-fps_mode', 'passthrough',
                    os.path.join(tmp, 'f%02d.png')], check=True)
    for i, o in enumerate(OFFS):
        jpg(os.path.join(tmp, 'f%02d.png' % (i + 1)), '%s_%+d.jpg' % (name, o), 640, 80)
    shutil.rmtree(tmp)


def sheet(frames, labels, dst, cols=3, tile=640):
    """frames (paths) in a grid with a label bar over each, like QA1's own zoom sheets"""
    font = ImageFont.truetype(FONT, 20)
    ims = [Image.open(f).convert('RGB') for f in frames]
    th = round(ims[0].height * tile / ims[0].width); bar = 28
    rows = (len(ims) + cols - 1) // cols
    out = Image.new('RGB', (cols * tile, rows * (th + bar)), (40, 41, 46))
    d = ImageDraw.Draw(out)
    for i, (im, lab) in enumerate(zip(ims, labels)):
        x, y = (i % cols) * tile, (i // cols) * (th + bar)
        out.paste(im.resize((tile, th), Image.LANCZOS), (x, y + bar))
        d.text((x + 6, y + 3), lab, fill=(255, 214, 90) if '(+0)' in lab else (235, 235, 240), font=font)
    out.save(os.path.join(OUT, dst), 'JPEG', quality=82, optimize=True, progressive=True)


# QA1 glitch 1: a card grown from the send button popped in full size after the flood (prv-combo f180)
jpg(os.path.join(Q, 'jobs/qa1-zoom-prv-combo/stills/16x9/zoom-180.png'), 'glitch1-before.jpg', 1600)
cf = os.path.join(Q, 'jobs/qa1-v2-prv-combo/stills/16x9/cutframes/00180')
fr = [174, 176, 178, 179, 180, 181, 182, 184, 188]
sheet([os.path.join(cf, '%05d.jpg' % f) for f in fr], ['%d (%+d)' % (f, f - 180) for f in fr], 'glitch1-after.jpg')
# QA1 glitch 2: launch30's carried card jumped from landscape to a tilted square in one frame
jpg(os.path.join(Q, 'jobs/qa1-zoom-l30/stills/16x9/zoom-660-carry.png'), 'glitch2-before.jpg', 1600)
jpg(os.path.join(Q, 'jobs/qa1-v2-l30/stills/16x9/zoom-630.png'), 'glitch2-after.jpg', 1600)

# the new pieces, as the storyboard draws them (shipped sample, 16:9)
B = os.path.join(J, 'out/main/16x9/board')
for f in ('01-globe', '03-ask', '04-trips', '05-route', '06-booked', '07-spots', '09-words'):
    jpg(os.path.join(B, f + '.png'), 'piece-%s.jpg' % f[3:], 960)
# other aspects + starters
jpg(os.path.join(J, 'wayfinch-storyboard-9x16.png'), 'board-9x16.jpg', 1400)
jpg(os.path.join(J, 'wayfinch-storyboard-1x1.png'), 'board-1x1.jpg', 1400)
jpg(os.path.join(Q, 'jobs/live-smoke-l15/smoke-test-storyboard-16x9.png'), 'starter-l15.jpg', 1400)
jpg(os.path.join(Q, 'jobs/qa1-v2-l30/stills/16x9/board-heroes.png'), 'starter-l30.jpg', 1600)
for a in ('16x9', '9x16', '1x1'):
    shutil.copy(os.path.join(J, 'wayfinch-%s-thumb.jpg' % a), os.path.join(OUT, 'poster-%s.jpg' % a))
tot = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
print(len(os.listdir(OUT)), 'files,', round(tot / 1e6, 2), 'MB')
