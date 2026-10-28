# -*- coding: utf-8 -*-
"""Compare a fresh render with the one shipped in this repo (used by setup.sh; reads only).
  python3 compare.py png NEW.png SHIPPED.png     pixel difference of two storyboards
  python3 compare.py film NEW.mp4 SHIPPED.mp4    frame count + PSNR of two films (ffmpeg), and the master WAVs if given
Prints one line per check and exits 0 when the new render matches (identical, or within run-to-run noise), 1 when not."""
import json, re, subprocess, sys


def png(a, b):
    import numpy as np
    from PIL import Image
    x, y = (np.asarray(Image.open(p).convert('RGB'), dtype=np.int16) for p in (a, b))
    if x.shape != y.shape:
        print('storyboard: size %s, shipped %s: DIFFERENT' % (x.shape[1::-1], y.shape[1::-1])); return 1
    d = np.abs(x - y); share = float((d.max(axis=2) > 0).mean())
    # known run-to-run noise on the same Mac (MORNING.md): the wall's raster (up to 8 code values) and the fan's soft card
    # shadow (up to 10). A missing font, other text or another layout moves pixels by 100+, so it still shows as DIFFERENT.
    same = d.max() <= 16 and d.mean() < 0.05
    print('storyboard: %s (max diff %d of 255, %.3f%% of pixels differ, mean %.4f)'
          % ('identical' if d.max() == 0 else ('same within noise' if same else 'DIFFERENT'), d.max(), share * 100, d.mean()))
    return 0 if same else 1


def frames(p):
    r = subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries',
                        'stream=nb_read_frames,width,height,r_frame_rate', '-of', 'json', p], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)['streams'][0]


def film(a, b, wa=None, wb=None):
    fa, fb = frames(a), frames(b); bad = 0
    if fa != fb:
        print('film: %s, shipped %s: DIFFERENT' % (fa, fb)); return 1
    r = subprocess.run(['ffmpeg', '-v', 'info', '-i', a, '-i', b, '-lavfi', '[0:v][1:v]psnr', '-f', 'null', '-'],
                       capture_output=True, text=True)
    m = re.search(r'PSNR .*?average:(\S+) min:(\S+)', r.stderr)
    if not m:
        print('film: ffmpeg gave no PSNR: DIFFERENT'); return 1
    avg, mn = m.group(1), m.group(2)
    num = lambda s: float('inf') if s == 'inf' else float(s)
    # x264 passes a tiny difference in one frame on to the frames that reference it, so judge by PSNR, not by bytes
    ok = num(avg) >= 50 and num(mn) >= 40
    print('film: %s frames %sx%s; PSNR average %s dB, worst frame %s dB: %s' % (
        fa['nb_read_frames'], fa['width'], fa['height'], avg, mn, 'identical' if avg == 'inf' else ('same within noise' if ok else 'DIFFERENT')))
    bad |= not ok
    if wa and wb:
        same = open(wa, 'rb').read() == open(wb, 'rb').read()
        print('sound: master WAV %s' % ('byte-identical' if same else 'differs (check it by meters, not by ear)'))
    return 1 if bad else 0


if __name__ == '__main__':
    mode, *args = sys.argv[1:]
    sys.exit({'png': png, 'film': film}[mode](*args))
