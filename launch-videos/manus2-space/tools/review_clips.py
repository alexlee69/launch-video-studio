#!/usr/bin/env python3
"""Review sheets for Round 3 H3 clips: per clip, its specs (ffprobe) and a strip of frames across its length, with her
locked close-up first for the identity check. Writes footage/review/<name>.jpg and footage/review/clips.jpg (all rows).

  python3 review_clips.py [S01-1c S04-4A ...]        default: every footage/fal/*.mp4
"""
import glob, json, os, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont

JOB = os.path.expanduser('~/Downloads/launch-videos/manus2-space')
FAL = os.path.join(JOB, 'footage', 'fal')
OUT = os.path.join(JOB, 'footage', 'review')
FACE = {'eva': (120, 150, 820, 850), 'helmet-off': (160, 230, 800, 870)}
N = 6                                       # frames per strip


def probe(p):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                        'stream=width,height,r_frame_rate,nb_frames:format=duration', '-of', 'json', p],
                       capture_output=True, text=True, check=True)
    d = json.loads(r.stdout)
    s, f = d['streams'][0], d['format']
    num, den = s['r_frame_rate'].split('/')
    return {'w': s['width'], 'h': s['height'], 'fps': round(int(num) / int(den), 3), 'frames': int(s.get('nb_frames', 0)),
            'sec': round(float(f['duration']), 3)}


def frame(p, t, w=480):
    for back in (0, 0.1, 0.25, 0.5):            # a seek at the very end can land past the last frame: step back
        with tempfile.NamedTemporaryFile(suffix='.png') as tf:
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '%.3f' % max(0, t - back), '-i', p, '-frames:v', '1',
                            '-vf', 'scale=%d:-2' % w, tf.name], check=True)
            if os.path.getsize(tf.name):
                return Image.open(tf.name).convert('RGB')
    raise RuntimeError('no frame near %.2f s in %s' % (t, p))


def main():
    names = sys.argv[1:] or sorted(os.path.basename(p)[:-4] for p in glob.glob(os.path.join(FAL, 'S*.mp4')))
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 22)
    os.makedirs(OUT, exist_ok=True)
    rows, specs = [], {}
    for n in names:
        p = os.path.join(FAL, n + '.mp4')
        if not os.path.exists(p):
            print('missing', n)
            continue
        sp = probe(p)
        specs[n] = sp
        ts = [min(sp['sec'] - 0.05, i * sp['sec'] / (N - 1)) for i in range(N)]
        fr = [frame(p, t) for t in ts]
        ref = 'helmet-off' if n.endswith('-26') else 'eva'
        face = Image.open(os.path.join(JOB, 'cast', 'locked', ref + '.png')).convert('RGB').crop(FACE[ref]).resize((fr[0].height, fr[0].height))
        W = face.width + sum(f.width for f in fr) + 7 * 4
        row = Image.new('RGB', (W, fr[0].height + 34), (16, 16, 18))
        d = ImageDraw.Draw(row)
        d.text((6, 6), '%s  %dx%d  %.3g fps  %.2f s  %d frames' % (n, sp['w'], sp['h'], sp['fps'], sp['sec'], sp['frames']),
               fill=(255, 220, 90), font=font)
        x = 0
        row.paste(face, (x, 34))
        x += face.width + 4
        for t, f in zip(ts, fr):
            row.paste(f, (x, 34))
            d.text((x + 6, 40), '%.1fs' % t, fill=(255, 255, 255), font=font)
            x += f.width + 4
        row.save(os.path.join(OUT, n + '.jpg'), quality=88)
        rows.append(row)
    if rows:
        W = max(r.width for r in rows)
        sheet = Image.new('RGB', (W, sum(r.height for r in rows)), (16, 16, 18))
        y = 0
        for r in rows:
            sheet.paste(r, (0, y))
            y += r.height
        sheet.save(os.path.join(OUT, 'clips.jpg'), quality=86)
    json.dump(specs, open(os.path.join(OUT, 'specs.json'), 'w'), indent=1)
    print(json.dumps(specs, indent=1))


if __name__ == '__main__':
    main()
