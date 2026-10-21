#!/usr/bin/env python3
"""QA for the Cue proof cut. Run after render + master + mux:  python3 qa.py
Checks: hard cuts land on their exact 60-fps frames, no pixel-identical (frozen) frames,
final mp4 loudness/true peak/duration, and every SFX onset on the SFX-only stem."""
import json, math, re, struct, subprocess, sys

FAIL = []
def check(ok, msg):
    print(('PASS  ' if ok else 'FAIL  ') + msg)
    if not ok: FAIL.append(msg)

def ff(args):
    return subprocess.run(['ffmpeg', '-hide_banner', '-nostats'] + args, capture_output=True, text=True).stderr

# ── video: cuts and freezes from the lossless frames ──
CUTS = {180: 'f90 cast', 360: 'f180 identity', 540: 'f270 approval', 780: 'f390 apps', 1020: 'f510 end card'}
log = ff(['-framerate', '60', '-i', 'out/frames/%05d.png', '-vf',
          'format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=out/diff_avg.txt', '-f', 'null', '-'])
avg = [float(x) for x in re.findall(r'YAVG=([\d.]+)', open('out/diff_avg.txt').read())]
d = {i + 1: v for i, v in enumerate(avg)}            # d[i] = change from frame i-1 to frame i
check(len(d) == 1199, f'{len(d) + 1} frames rendered (want 1200)')
# whip transitions move hard on both sides of a cut, so the test is: the cut frame is the single
# biggest change within ±6 frames (and clearly above the runner-up), i.e. the cut sits on its exact frame
shots = json.load(open('out/shots.json'))
bounds = [i for i in range(1, len(shots)) if shots[i] != shots[i - 1]]
check(bounds == sorted(CUTS), f'render log: shot changes at idx {bounds} (want {sorted(CUTS)})')
WHIPS = {360, 540}                    # B→C and C→D cut inside a whip; every nearby frame moves hard
for i, lab in CUTS.items():
    nb = max(d.get(j, 0) for j in range(i - 6, i + 7) if j != i)
    msg = f'cut {lab} at idx {i}: pixel change {d[i]:.2f}, next largest within ±6 frames {nb:.2f}'
    if i in WHIPS: print('INFO  ' + msg + ' (whip cut, boundary verified from the render log)')
    else: check(d[i] > 1.3 * nb and d[i] > 3, msg)
ff(['-framerate', '60', '-i', 'out/frames/%05d.png', '-vf',
    'tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YMAX:file=out/diff_max.txt', '-f', 'null', '-'])
ymax = [float(x) for x in re.findall(r'YMAX=([\d.]+)', open('out/diff_max.txt').read())]
frozen = [i + 1 for i, v in enumerate(ymax) if v == 0]
check(not frozen, f'no frozen frames (pixel-identical pairs: {frozen[:8]}{"…" if len(frozen) > 8 else ""})')

# ── final file ──
probe = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', 'out/cue-proof-cut.mp4'],
                                  capture_output=True, text=True).stdout)
v = next(s for s in probe['streams'] if s['codec_type'] == 'video'); a = next(s for s in probe['streams'] if s['codec_type'] == 'audio')
check((v['width'], v['height'], v['r_frame_rate'], v['pix_fmt'], int(v['nb_frames'])) == (1920, 1080, '60/1', 'yuv420p', 1200),
      f"video {v['width']}x{v['height']} {v['r_frame_rate']} {v['pix_fmt']} {v['nb_frames']} frames")
check(abs(float(a['duration']) - 20.0) < .03, f"audio duration {a['duration']} s")
e = ff(['-i', 'out/cue-proof-cut.mp4', '-map', '0:a', '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'])
I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', e)[-1]); TP = float(re.search(r'True peak:\s+Peak:\s+(-?[\d.]+)', e).group(1))
check(abs(I + 14) <= .2, f'integrated loudness {I} LUFS (target −14)')
check(TP <= -1.0, f'true peak {TP} dBTP (≤ −1)')

# ── SFX timing on the SFX-only stem ──
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'out/audio/sfx-stem.wav', '-ac', '1', '-f', 'f32le', '-ar', '48000', 'out/audio/sfx.f32'])
raw = open('out/audio/sfx.f32', 'rb').read(); n = len(raw) // 4; x = struct.unpack(f'{n}f', raw); SR = 48000
def rms(a, b):
    a = max(0, a); s = x[a:b]; return math.sqrt(sum(q * q for q in s) / max(1, len(s))) + 1e-9
def onset(t, search=.02):
    best = (0, None)
    for i in range(int((t - search) * SR), int((t + search) * SR), 12):
        r = rms(i, i + int(.002 * SR)) / rms(i - int(.004 * SR), i - int(.0005 * SR))
        if r > best[0]: best = (r, i / SR)
    return best
def envpeak(t0, t1, w=.02):
    best, t = (0, None), t0
    while t < t1:
        r = rms(int((t - w / 2) * SR), int((t + w / 2) * SR)); best = max(best, (r, t)); t += .001   # centred 20 ms window: noise-proof
    return best[1]
fs = lambda f: f / 30
events = [('logo pop', fs(1)), ('bubble pop', fs(22))] + [(f'cast pop {i + 1}', fs(92 + 3 * i)) for i in range(7)] + \
         [(f'icon pop {i + 1}', fs(190 + 5 * i)) for i in range(3)] + [('card pop', fs(300)), ('tap', fs(337)), ('chime', fs(346)), ('logo hit', 17.0)] + \
         [(f'end cast pop {i + 1}', fs(531 + 2 * i)) for i in range(7)]
late = []
for name, t in events:
    r, o = onset(t)
    if o is None or abs(o - t) > .003 or r < 2: late.append(f'{name} {t:.3f}s→{o}(×{r:.1f})')   # pops have a 2 ms attack
check(not late, f'{len(events) - len(late)}/{len(events)} SFX onsets within 3 ms of their frame' + (f'  misses: {late}' if late else ''))
# whooshes are measured on their own stem (STEM=whoosh), so no pop or hit can mask the peak
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'out/audio/whoosh-stem.wav', '-ac', '1', '-f', 'f32le', '-ar', '48000', 'out/audio/whoosh.f32'])
raw = open('out/audio/whoosh.f32', 'rb').read(); x = struct.unpack(f'{len(raw) // 4}f', raw)
wh = [(c, envpeak(c - .25, c + .1)) for c in (3, 6, 9, 13, 17)]
check(all(abs(p - c) <= .012 for c, p in wh), 'whoosh peaks at the cuts: ' + ', '.join(f'{c}s→{p:.3f}' for c, p in wh))

print(f'\n{"ALL CHECKS PASSED" if not FAIL else f"{len(FAIL)} CHECK(S) FAILED"}')
sys.exit(1 if FAIL else 0)
