# -*- coding: utf-8 -*-
# ORACLE (harness-only): DESIGN.md §B track.py CLI around today's tools/track.py (copied), which reads n%04d.png frames.
#   python3 track.py <video> --key N --from A --to B [--roi x,y,w,h] [--scale-to WxH] [--half] [--init s,tx,ty] --out track.json
# A, B, N are frame indices. Adds speed (px/frame of the frame centre, normalised to a 1080-wide frame) and a summary.
import os, sys, json, math, shutil, subprocess, tempfile
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
a = sys.argv[1:]
def opt(k, d=None):
    return a[a.index(k) + 1] if k in a else d
video, key, fa, fb, out = a[0], int(opt('--key')), int(opt('--from')), int(opt('--to')), opt('--out')
tmp = tempfile.mkdtemp(prefix='acc-track-')
vf = 'select=' + '+'.join('eq(n\\,%d)' % n for n in sorted({key} | set(range(min(fa, fb), max(fa, fb) + 1))))
if opt('--scale-to'): vf += ',scale=%s:flags=lanczos' % opt('--scale-to').replace('x', ':')
subprocess.run(['ffmpeg', '-v', 'error', '-i', video, '-vf', vf, '-fps_mode', 'passthrough', os.path.join(tmp, 'x%04d.png')], check=True)
order = sorted({key} | set(range(min(fa, fb), max(fa, fb) + 1)))
for i, n in enumerate(order): os.rename(os.path.join(tmp, 'x%04d.png' % (i + 1)), os.path.join(tmp, 'n%04d.png' % n))
from PIL import Image
W = Image.open(os.path.join(tmp, 'n%04d.png' % key)).width; H_ = Image.open(os.path.join(tmp, 'n%04d.png' % key)).height
cmd = [sys.executable, '-E', os.path.join(HERE, 'today', 'track.py'), tmp, str(key), str(fa), str(fb), os.path.join(tmp, 'raw.json')]
if '--half' in a: cmd.append('--half')
if opt('--init'): cmd += ['--init', opt('--init')]
subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)
rows = json.load(open(os.path.join(tmp, 'raw.json')))
c = np.array([W / 2.0, H_ / 2.0]); norm = 1080.0 / W
prev = np.array([c[0], c[1]])                              # the key frame's centre position (s=1, t=0)
frames = []
for r in rows:
    pos = r['s'] * c + np.array([r['tx'], r['ty']])
    sp = float(np.linalg.norm(pos - prev)) * norm; prev = pos
    frames.append({'n': r['n'], 'scale': r['s'], 'tx': r['tx'], 'ty': r['ty'], 'blur': round(math.hypot(r['bx'], r['by']), 3), 'blur_x': r['bx'], 'blur_y': r['by'],
                   'speed': round(sp, 3), 'ncc': r['ncc']})
sp = [f['speed'] for f in frames]; k = int(np.argmax(sp))
dec = [sp[i + 1] / sp[i] for i in range(k, len(sp) - 1) if sp[i] > .1 * sp[k] and sp[i] > 0]
summ = {'peak_speed': sp[k], 'peak_frame': frames[k]['n'], 'decay_per_frame': round(float(np.median(dec)), 4) if dec else None, 'normalised_to_width': 1080, 'source_width': W}
json.dump({'video': video, 'key': key, 'frames': frames, 'summary': summ}, open(out, 'w', encoding='utf-8'), indent=1)
print('peak %.1f px/frame (1080-wide) at n%d, decay ×%s per frame → %s' % (summ['peak_speed'], summ['peak_frame'], summ['decay_per_frame'], out))
shutil.rmtree(tmp, ignore_errors=True)
