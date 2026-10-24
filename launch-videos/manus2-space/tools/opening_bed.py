#!/usr/bin/env python3
"""Opening bed for The Lull (Alex 10-23: "lift it"). hf01's first 22.18 s are an unpulsed drone + ambience + voice at
-13..-15 dBFS RMS; ours was a thin pad at -22. This adds a warm, unpulsed drone in F (score option B: bright F major)
under 0 -> 22.18 s (hf01's groove entry, bar 8), swelling in from the title and fading out across the drop, so the beat
still lands on the same frame. No pulse, so the beat grid is untouched (checked by music.py afterwards).

  python3 opening_bed.py [--out audio/opening.wav]      48 kHz stereo 24-bit, the film's length
"""
import argparse, os, wave
import numpy as np

SR, LEN = 48000, 76.533
DROP = 22.181                                   # hf01 bar 8 downbeat; our S05 drop
rng = np.random.default_rng(7)


def band(x, lo=None, hi=None):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR) + 1e-6
    g = np.ones_like(f)
    if lo: g *= 1 / (1 + (lo / f) ** 2.8)
    if hi: g *= 1 / (1 + (f / hi) ** 2.8)
    return np.fft.irfft(X * g, len(x))


def voice(t, f0, detune=0.0025, harm=(1, .45, .22, .1)):
    """a soft saw-ish pad voice: a few harmonics, three slightly detuned copies, slow drift"""
    y = np.zeros_like(t)
    for d in (-detune, 0, detune):
        ph = 2 * np.pi * f0 * (1 + d) * t + 0.3 * np.sin(2 * np.pi * 0.07 * t + d * 900)
        y += sum(a * np.sin(h * ph) for h, a in enumerate(harm, 1))
    return y / 3


def build(out):
    n = int(DROP * SR + 2.0 * SR)                # runs 2 s past the drop for the cross-fade
    t = np.arange(n) / SR
    F1, F2, C3, F3, A3, C4 = 43.65, 87.31, 130.81, 174.61, 220.0, 261.63
    low = voice(t, F1, harm=(1, .3, .1)) * 0.9 + voice(t, F2) * 0.8          # the floor
    fifth = voice(t, C3) * 0.45 + voice(t, F3) * 0.35                          # body
    sweet = voice(t, A3, harm=(1, .2)) * 0.18 + voice(t, C4, harm=(1, .2)) * 0.14   # the major colour, faint
    pad = low + fifth * (0.55 + 0.45 * np.clip((t - 4) / 10, 0, 1)) + sweet * np.clip((t - 9) / 8, 0, 1)
    air = band(rng.standard_normal(n), 2500, 9000) * (0.06 + 0.05 * np.sin(2 * np.pi * t / 7.3) ** 2)   # breath of air
    shimmer = band(rng.standard_normal(n), 5000, 12000) * 0.025 * np.clip((t - 12) / 9, 0, 1)       # lift toward the drop
    x = band(pad, 30, 3500) + air + shimmer
    # shape: in from the title (fast swell 0.2 s -> 1.8 s), a gentle rise to the drop, out across it (0.8 s)
    env = np.clip((t - 0.2) / 1.6, 0, 1) ** 1.5 * (0.75 + 0.25 * np.clip((t - 2) / 18, 0, 1))
    env *= np.clip(1 - (t - DROP + 0.15) / 0.95, 0, 1)
    x *= env
    st = np.stack([x + 0.15 * np.roll(x, 480), x + 0.15 * np.roll(x, -480)], 1)   # a little width
    st /= np.max(np.abs(st)) + 1e-9
    seg = st[int(4 * SR):int(20 * SR)]
    st *= 10 ** (-16 / 20) / np.sqrt(np.mean(seg ** 2))                       # -16 dBFS RMS over 4-20 s
    full = np.zeros((int(round(LEN * SR)), 2))
    full[:len(st)] = st
    pk = np.max(np.abs(full))
    assert pk < 0.95, pk
    pcm = (full * (2 ** 23 - 1)).round().astype('<i4')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with wave.open(out, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR)
        w.writeframes(pcm.reshape(-1).view(np.uint8).reshape(-1, 4)[:, :3].tobytes())
    print('opening bed: 0-%.2f s (+0.8 s fade across the drop), peak %.1f dBFS -> %s' % (DROP, 20 * np.log10(pk), out))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.expanduser('~/Downloads/launch-videos/manus2-space/audio/opening.wav'))
    build(ap.parse_args().out)
