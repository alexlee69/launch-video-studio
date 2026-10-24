#!/usr/bin/env python3
"""Assemble each live-action shot's footage plate from its H3 legs, at the clips' native 24 fps (hf01 is a 24p edit:
the final cadence pass puts every 24p frame on hf01's own 30p slots, so nothing here is resampled to 30).

Each shot's plate = its legs' use windows (start s into the clip, length = the leg's share of the shot), joined the way
hf01 hides joins inside one continuous move: a short directional-blur or white-bloom crossfade at the join. Output:
assets/footage/<shot>.mp4 (H.264 CRF 14, yuv420p, BT.709, no audio, 1920x1080, 24 fps, the shot's length + 3 frames
of tail so the engine never runs off the end). Plate t = 0 is the shot's first frame (beats.yaml: bgFrom 0).

  python3 plates.py [S01 S04 ...] [--sheet]      --sheet: a frame strip per plate in footage/review/plate-<shot>.jpg
"""
import json, os, subprocess, sys

JOB = os.path.expanduser('~/Downloads/launch-videos/manus2-space')
FAL = os.path.join(JOB, 'footage', 'fal')
OUT = os.path.join(JOB, 'assets', 'footage')
FPS = 24
TAIL = 3 / FPS

# shot: (hf01 first frame, hf01 frames), [(clip, start s, seconds of the shot it fills, join into the NEXT leg)]
# Leg shares follow shotlist.json legs[].use (hf01 frames); starts are picked from each clip's own action (see the
# review strips): the action the shot needs must land inside the window.
PLATES = {
    'S01': (0, 348, [('S01-1a', 1.80, 95 / 30, ('hblur', 4)),          # the hatch fly-through; the array panel wipes
                     ('S01-1b', 1.35, 151 / 30, ('hblur', 4)),         # across the station to her at the guest module
                     ('S01-1c-t2', 0.50, 102 / 30, None)]),            # she reads; the wrench leaves her glove
    'S02': (348, 16, [('S02-2', 0.80, 16 / 30, None)]),
    'S03': (364, 18, [('S03-3', 1.60, 18 / 30, None)]),
    'S04': (382, 279, [('S04-4A', 0.95, 121 / 30, ('fadewhite', 4)),   # dawn; the sun bursts; join inside the bloom
                       ('S04-4B', 0.10, 158 / 30, None)]),
    'S09': (847, 81, [('S09-9', 2.33, 81 / 30, None)]),
    'S14': (1103, 131, [('S14-14A', 2.00, 89 / 30, ('zoomin', 4)),     # ends on the push into her face
                        ('S14-14B', 1.00, 42 / 30, None)]),
    'S15': (1234, 23, [('S15-15', 3.50, 23 / 30, None)]),
    'S20': (1487, 36, [('S20-20', 0.00, 36 / 30, None)]),
    'S21': (1523, 8, [('S21-21', 2.00, 8 / 30, None)]),
    'S22': (1531, 120, [('S22-22', 1.00, 120 / 30, None)]),
    'S24': (1800, 105, [('S24-24', 1.50, 105 / 30, None)]),
    'S26': (1933, 242, [('S26-26', 0.60, 242 / 30, None)]),
}


def dur(p):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p],
                       capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def build(shot):
    n0, nf, legs = PLATES[shot]
    total = nf / 30
    inputs, chains = [], []
    for i, (clip, start, share, join) in enumerate(legs):
        p = os.path.join(FAL, clip + '.mp4')
        xf = join[1] / FPS if join else 0
        need = share + xf + (TAIL if i == len(legs) - 1 else 0)          # a join overlaps the next leg by its length
        have = dur(p) - start
        if need > have + 1e-3:
            sys.exit('%s: %s needs %.3f s from %.2f s but has %.3f' % (shot, clip, need, start, have))
        inputs += ['-ss', '%.3f' % start, '-t', '%.4f' % need, '-i', p]
        chains.append('[%d:v]fps=%d,scale=1920:1080:flags=lanczos,setsar=1,format=yuv420p,setpts=PTS-STARTPTS[l%d]' % (i, FPS, i))
    cur, t = 'l0', legs[0][2]
    for i, (_, _, share, join) in enumerate(legs[:-1]):
        kind, frames = join
        d = frames / FPS
        nxt = 'x%d' % i
        chains.append('[%s][l%d]xfade=transition=%s:duration=%.4f:offset=%.4f[%s]' % (cur, i + 1, kind, d, t, nxt))
        cur, t = nxt, t + legs[i + 1][2]
    nframes = int(round((total + TAIL) * FPS))
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, shot + '.mp4')
    cmd = ['ffmpeg', '-v', 'error', '-y'] + inputs + ['-filter_complex', ';'.join(chains), '-map', '[%s]' % cur,
           '-frames:v', str(nframes), '-r', str(FPS), '-c:v', 'libx264', '-crf', '14', '-preset', 'medium',
           '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-an', out]
    subprocess.run(cmd, check=True)
    got = dur(out)
    print('%s  n%d-%d  %.3f s needed, plate %.3f s (%d frames @24)  legs: %s' % (
        shot, n0, n0 + nf - 1, total, got, nframes, ', '.join('%s@%.2f' % (c, s) for c, s, _, _ in legs)))
    return out


def sheet(shot, out):
    from PIL import Image, ImageDraw, ImageFont
    import tempfile
    n0, nf, _ = PLATES[shot]
    total = nf / 30
    k = 8
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 20)
    tiles = []
    for i in range(k):
        t = min(total - 0.02, i * total / (k - 1))
        with tempfile.NamedTemporaryFile(suffix='.png') as tf:
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '%.3f' % t, '-i', out, '-frames:v', '1', '-vf', 'scale=400:-2', tf.name], check=True)
            im = Image.open(tf.name).convert('RGB')
        ImageDraw.Draw(im).text((6, 6), 'n%d (%.2fs)' % (n0 + round(t * 30), t), fill=(255, 220, 90), font=font)
        tiles.append(im)
    w = Image.new('RGB', (sum(x.width for x in tiles), tiles[0].height))
    x = 0
    for im in tiles:
        w.paste(im, (x, 0))
        x += im.width
    os.makedirs(os.path.join(JOB, 'footage', 'review'), exist_ok=True)
    w.save(os.path.join(JOB, 'footage', 'review', 'plate-%s.jpg' % shot), quality=85)


if __name__ == '__main__':
    shots = [a for a in sys.argv[1:] if not a.startswith('--')] or list(PLATES)
    for s in shots:
        o = build(s)
        if '--sheet' in sys.argv:
            sheet(s, o)
