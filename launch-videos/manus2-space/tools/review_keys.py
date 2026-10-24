#!/usr/bin/env python3
"""Review sheets for Round 2 key frames: per leg, v1 and v2 side by side, with her locked close-up (the identity master)
on the left for the face check. Writes stills/review/keys-<batch>.png (phone-readable, one leg per row).

  python3 review_keys.py [--legs 1c,4A,...] [--name identity]
"""
import argparse, glob, os, re
from PIL import Image, ImageDraw, ImageFont

JOB = os.path.expanduser('~/Downloads/launch-videos/manus2-space')
KEYS = os.path.join(JOB, 'stills', 'keys')
OUT = os.path.join(JOB, 'stills', 'review')
FACE = {'eva': (120, 150, 820, 850), 'helmet-off': (160, 230, 800, 870)}   # close-up crops on the 2560x1440 sheets


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--legs', default='')
    ap.add_argument('--name', default='keys')
    a = ap.parse_args()
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 30)
    files = sorted(glob.glob(os.path.join(KEYS, '*-v[12].png')))
    legs = []
    for f in files:
        m = re.match(r'(S\d+)-(\w+)-v([12])\.png$', os.path.basename(f))
        if m and (m.group(1), m.group(2)) not in legs and (not a.legs or m.group(2) in a.legs.split(',')):
            legs.append((m.group(1), m.group(2)))
    TW, TH, FW = 960, 540, 540
    sheet = Image.new('RGB', (FW + 2 * TW, len(legs) * (TH + 44)), (16, 16, 18))
    for r, (shot, leg) in enumerate(legs):
        y = r * (TH + 44)
        ref = 'helmet-off' if leg == '26' else 'eva'
        face = Image.open(os.path.join(JOB, 'cast', 'locked', ref + '.png')).convert('RGB').crop(FACE[ref]).resize((FW - 20, FW - 20))
        sheet.paste(face, (10, y + 44))
        d = ImageDraw.Draw(sheet)
        d.text((12, y + 6), '%s %s  (locked face)' % (shot, leg), fill=(255, 220, 90), font=font)
        for c, v in enumerate(('v1', 'v2')):
            p = os.path.join(KEYS, '%s-%s-%s.png' % (shot, leg, v))
            if os.path.exists(p):
                sheet.paste(Image.open(p).convert('RGB').resize((TW, TH), Image.LANCZOS), (FW + c * TW, y + 44))
                d.text((FW + c * TW + 12, y + 6), v, fill=(255, 220, 90), font=font)
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, '%s.jpg' % a.name)
    sheet.save(out, quality=88)
    print(out, sheet.size, len(legs), 'legs')


if __name__ == '__main__':
    main()
