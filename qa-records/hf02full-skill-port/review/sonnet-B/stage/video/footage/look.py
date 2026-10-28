# -*- coding: utf-8 -*-
# Measure footage's look — tonal range, deep shadow, saturation, grain, sharpness, warm/cool split — and compare it with a
# reference: the numbers FOOTAGE.md grades to. The measures are hf02-full's look_stats.py, unchanged (each frame cropped,
# resized to 960 px wide with Lanczos; luma = Rec.709 weights on the RGB code values), plus p10 / p90.
#   python3 look.py <clip|image|folder|"glob">… [--from S|Nf] [--to S|Nf] [--frames 12] [--crop x,y,w,h]…
#                   [--ref <clip|image|folder|"glob"> [--ref-from …] [--ref-to …] [--ref-frames N] [--ref-crop x,y,w,h]…]
#                   [--label TEXT] [--ref-label TEXT] [--json OUT]
# A clip gives --frames frames evenly spaced from --from to --to (default: all of it). Seconds grab each frame the way a
# still export does (ffmpeg -ss t); `130f` picks frames by index (clips with irregular timestamps, or frame numbers from a
# breakdown). Each --crop (x,y,w,h in the source's pixels) measures that box of every frame — crop the reference to its
# picture (no UI, watermark or letterbox); several crops average together. With --ref: both columns, the delta, and
# "◂ outside" where our mean leaves the reference's frame-to-frame range.
# Exit codes: 0 measured · 2 bad arguments or an unreadable input.
import argparse, glob, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.dont_write_bytecode = True   # no __pycache__ in the skill
from _media import die, probe, frames_at
import numpy as np
from PIL import Image

IMG = ('.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff')
MEASURES = [('p2', 'blacks p2', '%.1f'), ('p10', 'p10', '%.1f'), ('p50', 'mid p50', '%.1f'), ('p90', 'p90', '%.1f'), ('p98', 'whites p98', '%.1f'),
            ('dark', 'deep shadow % (luma < 40)', '%.1f'), ('sat', 'saturation', '%.1f'), ('grain', 'grain', '%.2f'), ('sharp', 'sharpness', '%.1f'),
            ('warm_sh', 'R−B shadows (darkest 20 %)', '%+.1f'), ('warm_hi', 'R−B highlights (top 20 %)', '%+.1f')]


def blur(a, s):
    r = int(3 * s + 0.5); x = np.arange(-r, r + 1); k = np.exp(-x * x / (2 * s * s)); k /= k.sum()
    a = np.apply_along_axis(lambda v: np.convolve(np.pad(v, r, mode='edge'), k, 'valid'), 1, a)
    return np.apply_along_axis(lambda v: np.convolve(np.pad(v, r, mode='edge'), k, 'valid'), 0, a)


def stats(im, crop=None):                           # look_stats.py's stats(), taking a PIL image
    im = im.convert('RGB')
    if crop:
        im = im.crop(crop)
    im = im.resize((960, int(960 * im.height / im.width)), Image.LANCZOS)
    rgb = np.asarray(im, dtype=np.float64)
    R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    Y = 0.2126 * R + 0.7152 * G + 0.0722 * B
    mx, mn = rgb.max(2), rgb.min(2); S = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    hf = Y - blur(Y, 1.2)                                               # fine detail + noise
    gy, gx = np.gradient(blur(Y, 2.0)); flat = np.hypot(gx, gy) < 0.6  # smooth areas: what's left there is grain
    lap = Y[1:-1, 1:-1] * -4 + Y[:-2, 1:-1] + Y[2:, 1:-1] + Y[1:-1, :-2] + Y[1:-1, 2:]
    sh, hi = Y < np.percentile(Y, 20), Y > np.percentile(Y, 80)
    return dict(p2=np.percentile(Y, 2), p10=np.percentile(Y, 10), p50=np.percentile(Y, 50), p90=np.percentile(Y, 90), p98=np.percentile(Y, 98),
                dark=(Y < 40).mean() * 100, sat=S.mean() * 100, grain=hf[flat].std() if flat.any() else float('nan'), sharp=lap.var() ** 0.5,
                warm_sh=(R - B)[sh].mean(), warm_hi=(R - B)[hi].mean())


def when(s, flag):
    if s is None:
        return None
    try:
        return ('n', int(s[:-1])) if s.endswith('f') else ('t', float(s.rstrip('s')))
    except ValueError:
        die(2, '%s %s: give seconds (2.5) or a frame index (75f)' % (flag, s))


def picks(path, info, a, b, n, flag):
    """--frames N evenly spaced from a to b: ('t', seconds) or ('n', indices)."""
    a, b = when(a, flag + 'from'), when(b, flag + 'to')
    unit = (a or b or ('t', 0))[0]
    if a and b and a[0] != b[0]:
        die(2, '%sfrom and %sto: give both in seconds or both as frames (75f)' % (flag, flag))
    if unit == 'n':
        if not b:
            import subprocess
            c = subprocess.run(['ffprobe', '-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', path], capture_output=True)
            b = ('n', int(c.stdout.decode().strip() or 1) - 1)
        lo, hi = (a or ('n', 0))[1], b[1]
        vals = [int(round(lo + k * (hi - lo) / float(n - 1))) for k in range(n)] if n > 1 else [lo]
    else:
        lo = (a or ('t', 0.0))[1]
        hi = b[1] if b else max(lo, info['dur'] - 1.5 / float(info['fps'] or 30))   # the last frame, not past it
        vals = [lo + k * (hi - lo) / float(n - 1) for k in range(n)] if n > 1 else [lo]
    if (unit == 'n' and (min(vals) < 0 or hi < lo)) or (unit == 't' and (min(vals) < 0 or hi < lo or lo >= info['dur'])):
        die(2, '%s: nothing to measure between %sfrom and %sto (the clip is %.2f s)' % (path, flag, flag, info['dur']))
    return unit, vals


def crops(specs):
    out = []
    for c in specs or []:
        try:
            x, y, w, h = [int(v) for v in c.split(',')]
        except ValueError:
            die(2, '--crop %s: give x,y,w,h in pixels, e.g. 0,0,760,400' % c)
        if w < 8 or h < 8 or x < 0 or y < 0:
            die(2, '--crop %s: needs a box of at least 8x8 inside the frame' % c)
        out.append((x, y, x + w, y + h))
    return out or [None]


def measure(srcs, a, b, n, crop_specs, flag):
    paths = []
    for s in srcs:
        if any(ch in s for ch in '*?['):
            paths += sorted(glob.glob(s))
        elif os.path.isdir(s):
            paths += sorted(os.path.join(s, f) for f in os.listdir(s) if f.lower().endswith(IMG))
        else:
            paths.append(s)
    if not paths:
        die(2, 'no frames found in %s' % ' '.join(srcs))
    boxes, rows, frames = crops(crop_specs), [], []
    for p in paths:
        if p.lower().endswith(IMG):
            try:
                ims = [(Image.open(p), {'src': p})]
            except (OSError, ValueError):
                die(2, '%s: Pillow can\'t read it' % p)
        else:
            info = probe(p)
            if not info:
                die(2, '%s: no such image or video (ffprobe finds no picture in it)' % p)
            unit, vals = picks(p, info, a, b, n, flag)
            ims = [(Image.fromarray(fr), {'src': p, unit: v}) for fr, v in zip(frames_at(p, info['w'], info['h'], (unit, vals)), vals)]
        for im, meta in ims:
            for box in boxes:
                if box and (box[2] > im.width or box[3] > im.height):
                    die(2, '--crop %d,%d,%d,%d reaches outside %s (%dx%d)' % (box[0], box[1], box[2] - box[0], box[3] - box[1], meta['src'], im.width, im.height))
                rows.append({k: float(v) for k, v in stats(im, box).items()})
                frames.append(dict(meta, crop=list(box) if box else None))
    keys = [k for k, _, _ in MEASURES]
    agg = lambda f: {k: float(f([r[k] for r in rows])) for k in keys}
    return dict(inputs=srcs, frames=frames, rows=rows, mean=agg(np.nanmean), min=agg(np.nanmin), max=agg(np.nanmax))


def line(label, m):                                  # look_stats.py's report line, to compare with the numbers in the docs
    return ('%-34s blacks p2 %5.1f | mid p50 %5.1f | whites p98 %5.1f | <40 luma %4.1f%% | sat %4.1f | grain %4.2f | sharpness %5.1f | R-B shadows %+6.1f highlights %+6.1f'
            % (label, m['p2'], m['p50'], m['p98'], m['dark'], m['sat'], m['grain'], m['sharp'], m['warm_sh'], m['warm_hi']))


ap = argparse.ArgumentParser(description="Measure footage's look; compare with a reference.")
ap.add_argument('src', nargs='+')
ap.add_argument('--from', dest='a'); ap.add_argument('--to', dest='b'); ap.add_argument('--frames', type=int, default=12)
ap.add_argument('--crop', action='append'); ap.add_argument('--label')
ap.add_argument('--ref', action='append'); ap.add_argument('--ref-from', dest='ra'); ap.add_argument('--ref-to', dest='rb')
ap.add_argument('--ref-frames', type=int); ap.add_argument('--ref-crop', action='append'); ap.add_argument('--ref-label')
ap.add_argument('--json')
o = ap.parse_args()
if o.frames < 1 or (o.ref_frames is not None and o.ref_frames < 1):
    die(2, '--frames must be ≥ 1')
ours = measure(o.src, o.a, o.b, o.frames, o.crop, '--')
name = lambda srcs, lab: lab or ', '.join(os.path.basename(s.rstrip('/')) or s for s in srcs)
ours['label'] = name(o.src, o.label)
print(line(ours['label'][:34], ours['mean']) + '   (%d frame%s)' % (len(ours['rows']), '' if len(ours['rows']) == 1 else 's'))
res = dict(ours=ours)
if o.ref:
    ref = measure(o.ref, o.ra, o.rb, o.ref_frames or o.frames, o.ref_crop, '--ref-')
    ref['label'] = name(o.ref, o.ref_label)
    print(line(ref['label'][:34], ref['mean']) + '   (%d frame%s)' % (len(ref['rows']), '' if len(ref['rows']) == 1 else 's'))
    out, delta = [], {}
    print('\n%-28s %9s %9s %8s   %s' % ('', 'ours', 'reference', 'delta', 'reference frame to frame'))
    for k, lab, f in MEASURES:
        m, r, lo, hi = ours['mean'][k], ref['mean'][k], ref['min'][k], ref['max'][k]
        delta[k] = m - r
        flag = not (lo <= m <= hi) if m == m else False
        if flag:
            out.append(k)
        print('%-28s %9s %9s %8s   %s … %s%s' % (lab, f % m, f % r, '%+.1f' % (m - r) if k != 'grain' else '%+.2f' % (m - r), f % lo, f % hi, '  ◂ outside' if flag else ''))
    res.update(ref=ref, delta=delta, outside=out)
    print('\n%s' % ('every measure sits inside the reference\'s frame-to-frame range' if not out else
                    '%d of %d measures outside the reference\'s range: %s' % (len(out), len(MEASURES), ', '.join(lab for k, lab, _ in MEASURES if k in out))))
else:
    print('\n%-28s %9s   %s' % ('', 'mean', 'frame to frame'))
    for k, lab, f in MEASURES:
        print('%-28s %9s   %s … %s' % (lab, f % ours['mean'][k], f % ours['min'][k], f % ours['max'][k]))
if o.json:
    clean = lambda v: {k: clean(x) for k, x in v.items()} if isinstance(v, dict) else [clean(x) for x in v] if isinstance(v, list) else None if v != v else v
    with open(o.json, 'w', encoding='utf-8') as fh:
        json.dump(clean(res), fh, indent=1, ensure_ascii=False)
    print('json %s' % o.json)
