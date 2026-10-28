# -*- coding: utf-8 -*-
# Is our score on the reference's beat? Tempo + beat phase from each track's onsets, plus the silence and the big hit.
#   python3 -E tools/beat_check.py <reference audio or video> <our audio or video>
import sys, subprocess
import numpy as np
SR, N, HOP = 22050, 1024, 256
def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-vn', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)
def onset_env(x):
    w = np.hanning(N); fr = np.lib.stride_tricks.sliding_window_view(x, N)[::HOP] * w
    mag = np.log1p(100 * np.abs(np.fft.rfft(fr, axis=1)))
    flux = np.maximum(np.diff(mag, axis=0), 0).sum(axis=1)
    flux = flux - np.convolve(flux, np.ones(31) / 31, 'same')          # remove the slow trend
    return np.maximum(flux, 0), (np.arange(len(flux)) + 1) * HOP / SR
def tempo(env):
    e = env - env.mean(); ac = np.correlate(e, e, 'full')[len(e) - 1:]
    lags = np.arange(len(ac)) * HOP / SR; ok = (lags > 60 / 160) & (lags < 60 / 60)
    k = np.argmax(ac * ok); return 60 / lags[k]
def phase(env, t, bpm):
    P = 60 / bpm; z = (env * np.exp(2j * np.pi * t / P)).sum()
    return (np.angle(z) / (2 * np.pi) * P) % P, abs(z) / env.sum()
def rms_db(x, t0, t1):
    s = x[int(t0 * SR):int(t1 * SR)]; return 20 * np.log10(np.sqrt((s ** 2).mean()) + 1e-12)
def hit_after(x, t0, t1):
    hop = int(0.005 * SR); seg = x[int(t0 * SR):int(t1 * SR)]
    env = np.array([np.abs(seg[i:i + hop]).max() for i in range(0, len(seg) - hop, hop)])
    k = np.argmax(env > 0.3 * env.max()); return t0 + k * hop / SR
ref, ours = load(sys.argv[1]), load(sys.argv[2])
REF_BPM = 87.46
for lab, x in (('reference', ref), ('ours', ours)):
    env, t = onset_env(x)
    body = (t > 3) & (t < 57)
    bpm = tempo(env[body]); ph, strength = phase(env[body], t[body], REF_BPM)
    print('%-9s tempo %.2f BPM | beat phase on the 87.46 grid: %.3f s (grid says 0.3905 mod 0.6860 = 0.3905), lock %.2f | '
          'level 59.80-59.95 s %.0f dB | hit at %.3f s | level 57.6-59.6 s %.0f dB'
          % (lab, bpm, ph, strength, rms_db(x, 59.80, 59.95), hit_after(x, 59.6, 60.6), rms_db(x, 57.6, 59.6)))
