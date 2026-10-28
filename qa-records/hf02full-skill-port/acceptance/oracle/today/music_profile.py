# -*- coding: utf-8 -*-
# Style profile of a track on the reference's beat grid: groove (onset strength per 16th of the bar, by band), band balance,
# brightness, key. Used to match our score's feel to the reference without copying its notes.
#   python3 -E tools/music_profile.py <audio or video> [label]
import sys, subprocess
import numpy as np
SR, N, HOP = 22050, 2048, 256
B0, P = 0.3905, 60 / 87.46            # beat k at B0 + k*P; bars of 4 start on beat 3
def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-vn', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)
x = load(sys.argv[1]); lab = sys.argv[2] if len(sys.argv) > 2 else sys.argv[1]
w = np.hanning(N); fr = np.lib.stride_tricks.sliding_window_view(x, N)[::HOP] * w
S = np.abs(np.fft.rfft(fr, axis=1)); F = np.fft.rfftfreq(N, 1 / SR); t = (np.arange(len(S)) * HOP + N / 2) / SR
body = (t > 4) & (t < 56)
def band(lo, hi): return S[:, (F >= lo) & (F < hi)]
def flux(B):
    m = np.log1p(50 * B); f = np.r_[0, np.maximum(np.diff(m, axis=0), 0).sum(axis=1)]
    return f / (f[body].mean() + 1e-9)
bands = {'kick 30-120': flux(band(30, 120)), 'snare/body 150-2.5k': flux(band(150, 2500)), 'hats 5-11k': flux(band(5000, 11000))}
# groove: mean onset strength at each 16th of the 4-beat bar (bars start on beat 3)
pos = np.floor(((t - (B0 + 3 * P)) / (P / 4)) % 16 + 0.5).astype(int) % 16
print('== %s' % lab)
print('groove (16ths of a bar, beat starts marked |):')
for name, f in bands.items():
    g = np.array([f[body & (pos == k)].mean() for k in range(16)]); g = g / g.max()
    print('  %-20s %s' % (name, ' '.join(('|' if k % 4 == 0 else ' ') + '%3.0f' % (100 * v) for k, v in enumerate(g))))
E = S[body] ** 2
tot = E.sum()
edges = [(20, 120, 'sub/bass'), (120, 500, 'low-mid'), (500, 2000, 'mid'), (2000, 6000, 'upper-mid'), (6000, 11000, 'air')]
print('band balance (share of energy, dB re total): ' + ' | '.join('%s %.1f' % (n, 10 * np.log10(E[:, (F >= a) & (F < b)].sum() / tot + 1e-12)) for a, b, n in edges))
cent = (S[body] * F).sum(axis=1) / (S[body].sum(axis=1) + 1e-9)
print('brightness (spectral centroid) median %.0f Hz' % np.median(cent))
# key: chroma from 80 Hz-5 kHz, Krumhansl-Schmuckler
sel = (F > 80) & (F < 5000); pc = np.round(12 * np.log2(F[sel] / 440.0) + 9).astype(int) % 12
ch = np.zeros(12)
for k in range(12): ch[k] = (S[body][:, sel][:, pc == k] ** 2).sum()
ch /= ch.sum()
maj = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]); mnr = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
names = 'C C# D D# E F F# G G# A A# B'.split()
sc = [(np.corrcoef(ch, np.roll(maj, k))[0, 1], names[k] + ' major') for k in range(12)] + [(np.corrcoef(ch, np.roll(mnr, k))[0, 1], names[k] + ' minor') for k in range(12)]
sc.sort(reverse=True)
print('key estimate: %s (r %.2f), runner-up %s (r %.2f)' % (sc[0][1], sc[0][0], sc[1][1], sc[1][0]))
print('chroma: ' + ' '.join('%s %.0f' % (names[k], 100 * ch[k]) for k in range(12)))
