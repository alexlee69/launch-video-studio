# -*- coding: utf-8 -*-
# ORACLE (harness-only): DESIGN.md §A pin.py CLI wrapped around today's tools/fal/carousel_pin.py (copied, patched for
# size / fps / dark threshold), used to prove the pin checks can PASS on today's algorithm.
#   python3 pin.py <in> <screen.png> <out.mp4> --frames N [--fps 30] [--start S] [--size WxH] [--grade G] [--dark 24] [--track-png P]
# exit 0 ok · 2 bad input · 3 no phone-like black region in frame 0
import os, sys, json, shutil, subprocess, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
a = sys.argv[1:]
def opt(k, d=None):
    return a[a.index(k) + 1] if k in a else d
pos = [x for i, x in enumerate(a) if not x.startswith('--') and (i == 0 or not a[i - 1].startswith('--'))]
if len(pos) < 3 or '--frames' not in a:
    print('usage: pin.py <in> <screen.png> <out.mp4> --frames N [...]'); sys.exit(2)
src, screen, out = pos[:3]
frames, fps, start, grade, dark = int(opt('--frames')), float(opt('--fps', 30)), float(opt('--start', 0)), opt('--grade', ''), int(opt('--dark', 24))
j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'json', src], capture_output=True, text=True).stdout)['streams'][0]
n_, d_ = j['r_frame_rate'].split('/'); sfps = float(n_) / float(d_)
W, H_ = [int(x) for x in opt('--size').lower().split('x')] if opt('--size') else (j['width'], j['height'])
code = open(os.path.join(HERE, 'today', 'carousel_pin.py'), encoding='utf-8').read()
for old, new in (('W, H = 720, 1290', 'W, H = %d, %d' % (W, H_)), ('DARK = 24', 'DARK = %d' % dark),
                 ('N24 = int(math.ceil(frames / 30 * 24)) + 3', 'N24 = int(math.ceil(frames / %r * %r)) + 3' % (fps, sfps)),
                 ("'-framerate', '24'", "'-framerate', '%r'" % sfps), ("'fps=30:round=near'", "'fps=%g:round=near'" % fps)):
    if old not in code: print('oracle pin: today\'s script changed (%s)' % old); sys.exit(2)
    code = code.replace(old, new)
tmp = tempfile.mkdtemp(prefix='acc-pin-')
script = os.path.join(tmp, 'carousel_pin.py')
open(script, 'w', encoding='utf-8').write(code)
r = subprocess.run([sys.executable, '-E', script, src, screen, out, str(frames), str(start), grade], capture_output=True, text=True)
sys.stdout.write(r.stdout)
if r.returncode:
    if 'no phone-like' in r.stderr:
        print('✗ frame 0 of %s has no phone-like black region — prompt the video model for a phone whose screen stays completely black, or pick another clip' % src)
        sys.exit(3)
    sys.stderr.write(r.stderr); sys.exit(1)
trk = out.replace('.mp4', '-track.png')
if opt('--track-png') and os.path.exists(trk): shutil.move(trk, opt('--track-png'))
shutil.rmtree(tmp, ignore_errors=True)
