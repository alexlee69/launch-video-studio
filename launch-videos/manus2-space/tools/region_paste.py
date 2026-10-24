#!/usr/bin/env python3
"""Paste one region of an edited frame back onto the untouched original, with a soft edge, so a fix touches only that
region (gpt-image edits drift and soften everything else). Used for patch-side fixes on key frames.

  python3 region_paste.py ORIGINAL EDIT OUT --box x0,y0,x1,y1 [--feather 18] [--why "..."]

Writes OUT plus OUT.json (inputs, box, the edit's drift inside and outside the box)."""
import argparse, json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument('orig')
ap.add_argument('edit')
ap.add_argument('out')
ap.add_argument('--box', required=True)
ap.add_argument('--feather', type=int, default=18)
ap.add_argument('--why', default='')
a = ap.parse_args()
x0, y0, x1, y1 = [int(v) for v in a.box.split(',')]
o = Image.open(a.orig).convert('RGB')
e = Image.open(a.edit).convert('RGB')
assert o.size == e.size, (o.size, e.size)
m = Image.new('L', o.size, 0)
ImageDraw.Draw(m).rectangle([x0 + a.feather, y0 + a.feather, x1 - a.feather, y1 - a.feather], fill=255)
m = m.filter(ImageFilter.GaussianBlur(a.feather / 2))
Image.composite(e, o, m).save(a.out)
d = np.abs(np.asarray(o).astype(float) - np.asarray(e).astype(float)).mean(2)
inside = d[y0:y1, x0:x1].mean()
outside = (d.sum() - d[y0:y1, x0:x1].sum()) / (d.size - d[y0:y1, x0:x1].size)
rec = {'original': a.orig, 'edit': a.edit, 'box': [x0, y0, x1, y1], 'feather': a.feather,
       'edit_drift_inside': round(float(inside), 1), 'edit_drift_outside_not_used': round(float(outside), 1), 'why': a.why}
json.dump(rec, open(os.path.splitext(a.out)[0] + '.json', 'w'), indent=1)
print(json.dumps(rec))
