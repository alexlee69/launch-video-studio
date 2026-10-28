# -*- coding: utf-8 -*-
# ORACLE (harness-only): DESIGN.md §B music.py — profile on a beat grid (today's music_profile.py measures) and
# "is ours on their beat?" (the skill's tracker + onset cross-correlation + quiet stretches + the biggest hit).
#   python3 music.py profile <audio|video> [--bpm B --first-beat T] [--json OUT] [--skill DIR]
#   python3 music.py compare <ref> <ours> [--json OUT] [--skill DIR]
import os, sys, json, subprocess
import numpy as np

a = sys.argv[1:]
def opt(k, d=None):
    return a[a.index(k) + 1] if k in a else d
SKILL = opt('--skill', os.path.expanduser('~/.claude/skills/product-launch-sting'))
SR = 22050


def load(p, sr=SR):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-vn', '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def tracker(p):
    r = subprocess.run(['node', os.path.join(SKILL, 'video', 'lib', 'breakdown.mjs'), '--tempo', p, '--json'], capture_output=True, text=True)
    j = json.loads(r.stdout)
    return {'bpm': j.get('bpm'), 'first_beat': j.get('firstBeat'), 'downbeat': j.get('downbeat'), 'confidence': j.get('confidence')}


def profile(x, b0, P):
    N, HOP = 2048, 256
    w = np.hanning(N); fr = np.lib.stride_tricks.sliding_window_view(x, N)[::HOP] * w
    S = np.abs(np.fft.rfft(fr, axis=1)); F = np.fft.rfftfreq(N, 1 / SR); t = (np.arange(len(S)) * HOP + N / 2) / SR
    body = (t > min(2, t[-1] * .1)) & (t < t[-1] - min(2, t[-1] * .1))
    def flux(B):
        m = np.log1p(50 * B); f = np.r_[0, np.maximum(np.diff(m, axis=0), 0).sum(axis=1)]
        return f / (f[body].mean() + 1e-9)
    band = lambda lo, hi: S[:, (F >= lo) & (F < hi)]
    bands = {'kick 30-120': flux(band(30, 120)), 'snare/body 150-2.5k': flux(band(150, 2500)), 'hats 5-11k': flux(band(5000, 11000))}
    pos = np.floor(((t - b0) / (P / 4)) % 16 + 0.5).astype(int) % 16
    groove = {}
    for name, f in bands.items():
        g = np.array([f[body & (pos == k)].mean() for k in range(16)]); groove[name] = [round(float(v), 3) for v in g / g.max()]
    E = S[body] ** 2; tot = E.sum()
    edges = [(20, 120, 'sub/bass'), (120, 500, 'low-mid'), (500, 2000, 'mid'), (2000, 6000, 'upper-mid'), (6000, 11000, 'air')]
    balance = {n: round(float(10 * np.log10(E[:, (F >= lo) & (F < hi)].sum() / tot + 1e-12)), 2) for lo, hi, n in edges}
    cent = float(np.median((S[body] * F).sum(axis=1) / (S[body].sum(axis=1) + 1e-9)))
    sel = (F > 80) & (F < 5000); pc = np.round(12 * np.log2(F[sel] / 440.0) + 9).astype(int) % 12
    ch = np.array([(S[body][:, sel][:, pc == k] ** 2).sum() for k in range(12)]); ch /= ch.sum()
    maj = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]); mnr = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
    names = 'C C# D D# E F F# G G# A A# B'.split()
    sc = sorted([(np.corrcoef(ch, np.roll(maj, k))[0, 1], names[k] + ' major') for k in range(12)] + [(np.corrcoef(ch, np.roll(mnr, k))[0, 1], names[k] + ' minor') for k in range(12)], reverse=True)
    return {'groove': groove, 'band_balance_db': balance, 'centroid_hz': round(cent, 1), 'key': sc[0][1], 'key_r': round(float(sc[0][0]), 3), 'runner_up': sc[1][1]}


def quiet(x, sr, thr=-45, minlen=.25, win=.01):
    hop = int(win * sr); n = len(x) // hop
    db = 20 * np.log10(np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(1)) + 1e-12)
    spans, s0 = [], None
    for i, v in enumerate(db):
        if v < thr and s0 is None: s0 = i
        if (v >= thr or i == n - 1) and s0 is not None:
            if (i - s0) * hop / sr >= minlen and s0 > 0 and i < n - 1: spans.append([round(s0 * hop / sr, 3), round(i * hop / sr, 3)])
            s0 = None
    return spans


def hit(x, sr):
    # the biggest hit = the biggest jump in level (vs the 20–200 ms before) that lands loud (> −24 dBFS)
    hop = int(.005 * sr); n = len(x) // hop
    env = np.maximum(-100, 20 * np.log10(np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(1)) + 1e-12))
    best, bk = -1e9, 0
    for k in range(40, n):
        if env[k] < -24: continue
        rise = env[k] - env[k - 40:k - 4].max()
        if rise > best: best, bk = rise, k
    k0 = max(0, bk - 6); on = k0 + int(np.argmax(env[k0:bk + 1] > env[bk] - 12))
    return round(on * hop / sr, 3)


def onset_env(x):
    N, HOP = 1024, 256
    w = np.hanning(N); fr = np.lib.stride_tricks.sliding_window_view(x, N)[::HOP] * w
    mag = np.log1p(100 * np.abs(np.fft.rfft(fr, axis=1))); fl = np.maximum(np.diff(mag, axis=0), 0).sum(axis=1)
    fl = fl - np.convolve(fl, np.ones(31) / 31, 'same')
    return np.maximum(fl, 0)


def lag_ms(xr, xo):
    # sample-accurate: cross-correlate the onset envelopes coarsely (±200 ms), then refine on the waveforms' envelopes
    er, eo = onset_env(xr), onset_env(xo); n = min(len(er), len(eo)); er, eo = er[:n] - er[:n].mean(), eo[:n] - eo[:n].mean()
    best, bl = -1e18, 0; L = int(.2 * SR / 256)
    for l in range(-L, L + 1):
        v = (er[max(0, -l):n - max(0, l)] * eo[max(0, l):n - max(0, -l)]).sum() if l else (er * eo).sum()
        if v > best: best, bl = v, l
    hop = 32; m = min(len(xr), len(xo)) // hop
    ar = np.abs(xr[:m * hop]).reshape(m, hop).max(1); ao = np.abs(xo[:m * hop]).reshape(m, hop).max(1)
    c = bl * 256 // hop; bb, bf = -1e18, c
    for l in range(c - 10, c + 11):
        v = (ar[max(0, -l):m - max(0, l)] * ao[max(0, l):m - max(0, -l)]).sum()
        if v > bb: bb, bf = v, l
    return round(bf * hop / SR * 1000, 1)


cmd = a[0] if a else ''
if cmd == 'profile':
    p = a[1]; x = load(p)
    if opt('--bpm'): T = {'bpm': float(opt('--bpm')), 'first_beat': float(opt('--first-beat', 0))}
    else: T = tracker(p)
    r = {'file': p, 'bpm': T['bpm'], 'first_beat': T['first_beat'], **profile(x, T['first_beat'], 60.0 / T['bpm'])}
    print('profile of %s on the %.2f BPM grid (first beat %.4f s): key %s, centroid %.0f Hz' % (p, r['bpm'], r['first_beat'], r['key'], r['centroid_hz']))
    for k, g in r['groove'].items(): print('  %-20s %s' % (k, ' '.join(('|' if i % 4 == 0 else ' ') + '%3.0f' % (100 * v) for i, v in enumerate(g))))
elif cmd == 'compare':
    pr, po = a[1], a[2]; xr, xo = load(pr), load(po)
    side = {}
    for lab, p, x in (('ref', pr, xr), ('ours', po, xo)):
        T = tracker(p); T['quiet'] = quiet(x, SR); T['hit'] = hit(x, SR); side[lab] = T
    lg = lag_ms(xr, xo)
    on = abs(lg) <= 10 and abs((side['ref']['bpm'] or 0) - (side['ours']['bpm'] or 0)) <= .15
    r = {'ref': side['ref'], 'ours': side['ours'], 'lag_ms': lg, 'verdict': 'on their beat' if on else 'NOT on their beat'}
    print('ref  %s BPM, first beat %s s (conf %s), hit %s s, quiet %s' % (side['ref']['bpm'], side['ref']['first_beat'], side['ref']['confidence'], side['ref']['hit'], side['ref']['quiet'][:3]))
    print('ours %s BPM, first beat %s s (conf %s), hit %s s, quiet %s' % (side['ours']['bpm'], side['ours']['first_beat'], side['ours']['confidence'], side['ours']['hit'], side['ours']['quiet'][:3]))
    print('onset lag %+.1f ms → %s' % (lg, r['verdict']))
else:
    print('usage: music.py profile|compare …'); sys.exit(2)
if opt('--json'):
    with open(opt('--json'), 'w', encoding='utf-8') as f: json.dump(r, f, indent=1)
