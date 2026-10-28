# -*- coding: utf-8 -*-
# ORACLE (harness-only): DESIGN.md §A look.py on today's look_stats.py formulas (imported from the copy in today/).
#   python3 look.py <clip|image> [--from S] [--to S] [--frames 12] [--ref <clip|image> [--ref-from S] [--ref-to S]] [--json OUT]
import os, sys, json, subprocess, tempfile
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'today', 'look_stats.py'), encoding='utf-8').read().split("if __name__ == '__main__':")[0]
G = {}; exec(compile(src, 'look_stats.py', 'exec'), G)
NAMES = [('p10', 'p10 luma'), ('p50', 'p50 luma'), ('p90', 'p90 luma'), ('shadow_pct', 'deep shadow % (<40)'), ('saturation', 'saturation'),
         ('sharpness', 'sharpness'), ('grain', 'grain'), ('warmth_shadows', 'R-B shadows'), ('warmth_highlights', 'R-B highlights')]


def stats(path):
    d = G['stats'](path)
    im = Image.open(path).convert('RGB'); im = im.resize((960, int(960 * im.height / im.width)), Image.LANCZOS)
    rgb = np.asarray(im, dtype=np.float64); Y = .2126 * rgb[..., 0] + .7152 * rgb[..., 1] + .0722 * rgb[..., 2]
    return {'p10': float(np.percentile(Y, 10)), 'p50': d['p50'], 'p90': float(np.percentile(Y, 90)), 'shadow_pct': d['dark'], 'saturation': d['sat'],
            'sharpness': d['sharp'], 'grain': d['grain'], 'warmth_shadows': d['warm_sh'], 'warmth_highlights': d['warm_hi']}


sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))
import exactdecode as XD                                       # video frames: exact BT.709 from the raw yuv420p planes


def measure(path, t0, t1, n, tmp):
    if path.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff')): rows = [stats(path)]
    else:
        W, H_, pf, rng, dur = XD.probe(path)
        a, b = float(t0 or 0), float(t1 if t1 is not None else dur)
        rows = []
        for i in range(n):
            t = a + (i + .5) * (b - a) / n; f = os.path.join(tmp, 'f%03d.png' % i)
            Image.fromarray(XD.bt709_rgb(*XD.yuv_at(path, t, W, H_), full=(rng == 'pc'))).save(f)
            rows.append(stats(f))
    keys = rows[0].keys()
    return {k: float(np.nanmean([r[k] for r in rows])) for k in keys}, {k: [float(np.nanmin([r[k] for r in rows])), float(np.nanmax([r[k] for r in rows]))] for k in keys}


a = sys.argv[1:]
def opt(k, d=None):
    return a[a.index(k) + 1] if k in a else d
inp = a[0]; n = int(opt('--frames', 12)); tmp = tempfile.mkdtemp(prefix='acc-look-')
ours, orange = measure(inp, opt('--from'), opt('--to'), n, tmp)
out = {'input': inp, 'measures': ours, 'range': orange}
print('%-22s %10s' % ('measure', 'ours') + ('' if not opt('--ref') else ' %10s %10s  flag' % ('ref', 'delta')))
if opt('--ref'):
    ref, rrange = measure(opt('--ref'), opt('--ref-from'), opt('--ref-to'), n, tmp)
    out['ref'] = {'input': opt('--ref'), 'measures': ref, 'range': rrange}
    out['delta'] = {k: ours[k] - ref[k] for k in ours}
    out['flags'] = {k: not (rrange[k][0] <= ours[k] <= rrange[k][1]) for k in ours}
for k, lab in NAMES:
    line = '%-22s %10.2f' % (lab, ours[k])
    if opt('--ref'): line += ' %10.2f %+10.2f  %s' % (out['ref']['measures'][k], out['delta'][k], 'OUTSIDE ref range' if out['flags'][k] else '')
    print(line)
if opt('--json'):
    with open(opt('--json'), 'w', encoding='utf-8') as f: json.dump(out, f, indent=1)
