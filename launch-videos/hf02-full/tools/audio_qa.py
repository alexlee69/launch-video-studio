#!/usr/bin/env python3
# Audio QA by meters (nobody listens here — the user is the ears):
#   1. the final mp4 carries 48 kHz stereo AAC for the whole 7.0 s at −14 ±0.5 LUFS, ≤ −1 dBTP
#   2. every point SFX (pop/tick) starts within 12 ms of its cue on points.wav; every whoosh peaks within 30 ms on whoosh.wav
#   3. the bed never drops out (no 250 ms window quieter than −45 dBFS RMS)
#   python3 tools/audio_qa.py [--points PATH] [--whoosh PATH]     (exit 0 PASS / 1 FAIL)
import json, re, subprocess, sys, os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, 'out', 'audio')
arg = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
pts_path, wsh_path = arg('--points', os.path.join(A, 'points.wav')), arg('--whoosh', os.path.join(A, 'whoosh.wav'))
mp4 = os.path.join(ROOT, 'hf02-recreate.mp4')
fails = []

def read(path, sr=48000):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)

# 1 — container + loudness
pr = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name,sample_rate,channels,duration',
                                '-of', 'json', mp4], capture_output=True, text=True).stdout).get('streams', [])
if not pr: fails.append('no audio stream in hf02-recreate.mp4')
else:
    a = pr[0]
    if a.get('codec_name') != 'aac' or a.get('sample_rate') != '48000' or a.get('channels') != 2: fails.append(f'audio stream {a}')
    if abs(float(a.get('duration', 0)) - 7.0) > 0.05: fails.append(f'audio duration {a.get("duration")} (want 7.0)')
s = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', mp4, '-map', '0:a', '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'],
                   capture_output=True, text=True).stderr
I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', s)[-1]); tp = re.search(r'True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS', s)
TP = float(tp.group(1)) if tp else float('nan')
if abs(I + 14) > 0.5: fails.append(f'loudness {I} LUFS (want −14 ±0.5)')
if not TP <= -1.0: fails.append(f'true peak {TP} dBTP (want ≤ −1)')

# 2 — cue timing: each point cue's attack, timed on its own isolated render (written by audio.mjs to out/audio/qa/)
cues = json.load(open(os.path.join(A, 'cues.json')))
qa_dir = arg('--qa-dir', os.path.join(A, 'qa')); sr = 48000; k1 = int(.001 * sr)
worst_p = 0
for c in cues['points']:
    x = read(os.path.join(qa_dir, c['qa']))
    sm = np.convolve(np.abs(x), np.ones(k1) / k1, mode='same')
    rise = np.zeros_like(sm); rise[:-k1] = sm[k1:] - sm[:-k1]
    o = c['qaStart'] + int(np.argmax(rise)) / sr          # steepest rise = the attack (nothing else is in this file)
    err = abs(o - c['t']); worst_p = max(worst_p, err)
    if err > .005: fails.append(f'{c["what"]}: attack {o:.4f}s vs cue {c["t"]:.4f}s ({err * 1000:.1f} ms)')
# whooshes: peak of the whoosh stem's envelope near each cue
w = read(wsh_path); k = int(.01 * sr)
wenv = np.convolve(np.abs(w), np.ones(k) / k, mode='same')
worst_w = 0; peaks = {}
for c in cues['whooshes']:
    if c['t'] > 6.95: continue          # the exit whoosh peaks on the last frame; its decay is cut by the clip end
    a, b = int((c['t'] - .15) * sr), int(min(len(wenv), (c['t'] + .1) * sr))
    pk = (a + int(np.argmax(wenv[a:b]))) / sr; peaks[c['n']] = pk
    err = abs(pk - c['t']); worst_w = max(worst_w, err)
    if err > .03: fails.append(f'{c["what"]}: whoosh peak {pk:.3f}s vs cue {c["t"]:.3f}s ({err * 1000:.0f} ms)')
# picture: hard cuts and fast transitions found in the final video's own frames must each sit on a whoosh peak (±1 frame).
# Frame-to-frame structural correlation drops to ~0 on a hard cut and dips on a dissolve or a whip-fast scroll,
# while ordinary motion blur barely moves it.
W, H = 240, 135
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', mp4, '-map', '0:v', '-vf', f'scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True, check=True).stdout
F = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float64)
def ncc(a, b):
    a = a - a.mean(); b = b - b.mean(); return float((a * b).sum() / (np.sqrt((a * a).sum() * (b * b).sum()) + 1e-9))
cc = np.array([ncc(F[i], F[i + 1]) for i in range(len(F) - 1)])
tb = lambda i: (i + 1) / 30 - 1 / 60                    # time of the boundary between frame i and i+1
hard = [tb(i) for i in range(len(cc)) if cc[i] < .1]
events = [tb(i) for i in range(len(cc)) if cc[i] < .35 and cc[i] == cc[max(0, i - 2):i + 3].min()]
cut_err = []
for tc in events:
    e = min(abs(pk - tc) for pk in peaks.values()); cut_err.append(e)
    if e > 1 / 30 + .005: fails.append(f'picture event at {tc:.3f}s has no whoosh peak within a frame (nearest {e * 1000:.0f} ms)')
if len(hard) != 2: fails.append(f'{len(hard)} hard cuts in the picture (expected 2: 10.40 s and 15.50 s source time)')
cuts = events

# 3 — the bed never drops out
m = read(os.path.join(ROOT, 'audio', 'hf02-music.wav'))
win = int(.25 * sr)
rms = [20 * np.log10(np.sqrt(np.mean(m[i:i + win] ** 2)) + 1e-12) for i in range(0, len(m) - win, win // 2)]
if min(rms) < -45: fails.append(f'music bed drops to {min(rms):.1f} dBFS RMS')

print(f'mp4 audio: {I} LUFS, {TP} dBTP | point cues worst {worst_p * 1000:.1f} ms over {len(cues["points"])} | '
      f'whoosh peaks worst {worst_w * 1000:.1f} ms | picture events at {[round(c, 3) for c in cuts]} (hard cuts {[round(c, 3) for c in hard]}) → worst {max(cut_err) * 1000:.0f} ms from a whoosh peak | '
      f'bed min {min(rms):.1f} dBFS RMS')
if fails:
    print('FAIL'); [print('  -', f) for f in fails]; sys.exit(1)
print('PASS')
