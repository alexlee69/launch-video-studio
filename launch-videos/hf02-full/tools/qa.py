#!/usr/bin/env python3
# Integrity QA for a rendered clip: format, frame count, colour tags, no blank frames, no frozen (duplicated) frames.
#   python3 tools/qa.py hf02-recreate.mp4 [--frames 210]
# Exit 0 = PASS, 1 = FAIL (every failed check is printed).
import json, subprocess, sys
import numpy as np

path = sys.argv[1]
want_frames = int(sys.argv[sys.argv.index('--frames') + 1]) if '--frames' in sys.argv else 210
fails = []

probe = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries',
    'stream=width,height,r_frame_rate,nb_read_frames,pix_fmt,color_primaries,color_transfer,color_space', '-of', 'json', path],
    capture_output=True, text=True, check=True).stdout)['streams'][0]
expect = {'width': 1920, 'height': 1080, 'r_frame_rate': '30/1', 'pix_fmt': 'yuv420p', 'color_primaries': 'bt709',
          'color_transfer': 'bt709', 'color_space': 'bt709'}
for k, v in expect.items():
    if probe.get(k) != v: fails.append(f'{k} = {probe.get(k)} (want {v})')
n = int(probe.get('nb_read_frames', 0))
if n != want_frames: fails.append(f'{n} frames (want {want_frames})')

W, H = 480, 270
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={W}:{H}:flags=area', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
                     capture_output=True, check=True).stdout
F = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
std = F.reshape(len(F), -1).std(axis=1)
blank = [i for i, s in enumerate(std) if s < 2.0]
if blank: fails.append(f'blank frames (luma std < 2): {blank[:10]}')
diff = np.abs(np.diff(F, axis=0)).reshape(len(F) - 1, -1).mean(axis=1)
frozen = [i + 1 for i, d in enumerate(diff) if d < 0.01]
if frozen: fails.append(f'frozen frames (identical to the previous one): {frozen[:10]}')

print(f'{path}: {n} frames, {probe.get("width")}x{probe.get("height")} @ {probe.get("r_frame_rate")}, '
      f'min luma std {std.min():.2f}, min frame-to-frame change {diff.min():.3f} (frame {int(diff.argmin()) + 1})')
if fails:
    print('FAIL'); [print('  -', f) for f in fails]; sys.exit(1)
print('PASS')
