#!/usr/bin/env python3
"""The Lull's sound-effects layer, synthesized (no samples), every event on its frame. It follows hf01's sound grammar
(hf01-study/SOUND.md §3): the score carries the film, transitions have no whooshes, the UI is silent (no clicks, no
pops). The few dedicated sounds sit in hf01's slots, made space-true by the vacuum rule (in-suit sound until the
re-entry roar), plus the story's own: the alarm beeps on the red pulses and the re-entry roar.

  python3 sfx.py [--out audio/sfx.wav]       48 kHz stereo float32, the film's length (76.533 s); prints the event table

Frames are hf01's 30 fps frames (t = n / 30). Levels are set against the engine's music stem (RMS about -10 dBFS); the
finishing mix normalizes the sum to -14 LUFS. The user listens: this is checked by meters only.
"""
import argparse, json, os, wave
import numpy as np

SR = 48000
LEN = 76.533
JOB = os.path.expanduser('~/Downloads/launch-videos/manus2-space')
rng = np.random.default_rng(23)
T = lambda n: n / 30.0


def noise(sec, kind='white'):
    n = int(sec * SR)
    x = rng.standard_normal(n)
    if kind == 'white':
        return x
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = f[1]
    X /= np.sqrt(f) if kind == 'pink' else f
    y = np.fft.irfft(X, n)
    return y / (np.std(y) + 1e-12)


def band(x, lo=None, hi=None, soft=1.4):
    """FFT band shaping with smooth (log-domain) edges."""
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR) + 1e-6
    g = np.ones_like(f)
    if lo:
        g *= 1 / (1 + (lo / f) ** (2 * soft))
    if hi:
        g *= 1 / (1 + (f / hi) ** (2 * soft))
    return np.fft.irfft(X * g, n)


def env(sec, a, d, shape=1.0):
    """attack a s (power curve), exponential-ish decay to the end."""
    n = int(sec * SR)
    t = np.arange(n) / SR
    up = np.clip(t / max(a, 1e-4), 0, 1) ** shape
    dn = np.exp(-np.clip(t - a, 0, None) / max(d, 1e-4))
    return up * dn


def norm(x, peak_db):
    return x / (np.max(np.abs(x)) + 1e-12) * 10 ** (peak_db / 20)


def rms_to(x, db):
    return x / (np.sqrt(np.mean(x ** 2)) + 1e-12) * 10 ** (db / 20)


def tone(sec, f0, f1=None, harm=(1,), decay=None, vib=0.0):
    n = int(sec * SR)
    t = np.arange(n) / SR
    f = np.full(n, f0) if f1 is None else np.geomspace(f0, f1, n)
    if vib:
        f = f * (1 + vib * np.sin(2 * np.pi * 7 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = sum(np.sin(h * ph) / h for h in harm)
    if decay:
        y *= np.exp(-t / decay)
    return y


def mixl(*parts):
    """sum signals of different lengths; a part may be (signal, offset s)"""
    parts = [p if isinstance(p, tuple) else (p, 0.0) for p in parts]
    n = max(int(o * SR) + len(x) for x, o in parts)
    y = np.zeros(n)
    for x, o in parts:
        i = int(o * SR)
        y[i:i + len(x)] += x
    return y


# ---------------------------------------------------------------- the sounds
def static_burst(sec=0.12, lo=1000, hi=16000):
    grains = (rng.random(int(sec * SR)) < 0.08).astype(float) * rng.standard_normal(int(sec * SR))
    x = band(noise(sec) * 0.6 + grains * 2.0, lo, hi)
    return x * env(sec, 0.004, sec / 3)


def sub_thump(sec=0.3, f0=90, f1=45):
    return tone(sec, f0, f1) * env(sec, 0.003, 0.09)


def swish(sec, lo, hi, a_frac=0.7):
    return band(noise(sec), lo, hi) * env(sec, sec * a_frac, sec * 0.12, 1.6)


def comms_tick():
    tick = band(noise(0.012), 4000, 16000) * env(0.012, 0.0005, 0.003)
    th = tone(0.06, 70, 50) * env(0.06, 0.002, 0.02) * 0.5
    beep = np.concatenate([tone(0.055, 1250, harm=(1, 3)), tone(0.055, 1660, harm=(1, 3))]) * 0.18
    beep = band(beep, 600, 4000) * np.concatenate([env(0.055, 0.004, 0.04), env(0.055, 0.004, 0.04)])
    out = np.zeros(int(0.2 * SR))
    out[:len(tick)] += tick
    out[:len(th)] += th
    out[int(0.02 * SR):int(0.02 * SR) + len(beep)] += beep
    return out


def flare_whoomp(sec=0.55):
    low = band(noise(sec, 'brown'), 30, 420) * env(sec, 0.09, 0.16)
    cr = band((rng.random(int(sec * SR)) < 0.03) * rng.standard_normal(int(sec * SR)), 1000, 4000) * env(sec, 0.06, 0.12)
    return low + 0.6 * cr


def send_crackle(sec):
    imp = (rng.random(int(sec * SR)) < 0.02) * rng.standard_normal(int(sec * SR)) * 2.5
    wash = noise(sec) * 0.5
    x = band(imp + wash, 2000, 12000)
    e = env(sec, 0.02, sec * 0.45)
    return x * e


def suit_bed(sec):
    air = band(noise(sec, 'pink'), 120, 1100) * 0.9
    fan = tone(sec, 118, harm=(1, 2, 3)) * 0.05
    t = np.arange(int(sec * SR)) / SR
    breath = np.zeros_like(t)
    cyc, k = 4.4, 0.6
    while k < sec:                                          # inhale 1.0 s, exhale 1.4 s, then a pause
        for st, dur, lo, hi, g in ((k, 1.0, 500, 2200, 0.55), (k + 1.15, 1.4, 300, 1500, 0.45)):
            i0, n = int(st * SR), int(dur * SR)
            if i0 + n >= len(t):
                break
            sh = np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5
            breath[i0:i0 + n] += band(noise(dur), lo, hi) * sh * g
        k += cyc + rng.uniform(-0.3, 0.3)
    return air + fan + breath


def static_wash(sec):
    x = band(noise(sec), 2000, 8000)
    t = np.arange(len(x)) / SR
    flutter = 0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 3.1 * t + np.sin(2 * np.pi * 0.7 * t)))
    return x * flutter


def glove_thud():
    return band(noise(0.09), 140, 650) * env(0.09, 0.004, 0.025) + tone(0.09, 95, 70) * env(0.09, 0.002, 0.03) * 0.6


def tumble(sec=0.65):
    hi = band(noise(sec), 1000, 16000) * env(sec, 0.22, 0.2, 1.3)
    scrape = band(noise(sec), 300, 2000) * env(sec, 0.3, 0.15) * (0.5 + 0.5 * (rng.random(int(sec * SR)) < 0.3))
    low = band(noise(sec, 'brown'), 30, 200) * env(sec, 0.05, 0.12)
    return hi + 0.6 * scrape + 0.8 * low


def rising_whoosh(sec, lo=6000, hi=16000):
    n = int(sec * SR)
    a = band(noise(sec), lo * 0.5, hi * 0.6)
    b = band(noise(sec), lo, hi)
    m = np.linspace(0, 1, n) ** 2
    return (a * (1 - m) + b * m) * env(sec, sec * 0.85, 0.05, 2.0)


def clang():
    sec = 1.2
    t = np.arange(int(sec * SR)) / SR
    f0 = 1130
    parts = [(1.0, 0.55, 1.0), (2.76, 0.38, 0.6), (5.40, 0.22, 0.4), (8.93, 0.13, 0.25), (13.3, 0.08, 0.15)]
    ring = sum(a * np.sin(2 * np.pi * f0 * r * t) * np.exp(-t / d) for r, d, a in parts)
    click = np.zeros_like(t)
    c = band(noise(0.01), 3000, 16000) * env(0.01, 0.0003, 0.002)
    click[:len(c)] = c * 2.5
    tw = np.zeros_like(t)
    w = tone(0.35, 1000, 300, harm=(1, 2)) * env(0.35, 0.005, 0.12)
    i = int(0.07 * SR)
    tw[i:i + len(w)] = w * 0.35
    boom = np.zeros_like(t)
    b = tone(0.8, 55, 38) * env(0.8, 0.004, 0.22)
    boom[:len(b)] = b * 0.9
    return ring * 0.7 + click + tw + boom


def alarm_beep():
    b = tone(0.17, 880, harm=(1, 3, 5)) * 0.6 + tone(0.17, 1320, harm=(1, 3)) * 0.3
    return band(b, 300, 3500) * env(0.17, 0.006, 0.09)            # muffled: heard through the helmet


def reentry(sec):
    t = np.arange(int(sec * SR)) / SR
    rise = np.clip(t / sec, 0, 1) ** 1.4
    rumble = band(noise(sec, 'brown'), 25, 260) * (0.35 + 0.65 * rise)
    rattle = band(noise(sec), 800, 3200) * (0.5 + 0.5 * np.sin(2 * np.pi * 17 * t) ** 2) * (0.15 + 0.35 * rise)
    hiss = band(noise(sec), 3000, 9000) * 0.12 * rise
    return rumble + rattle + hiss


def sea(sec):
    x = band(noise(sec, 'pink'), 80, 2200)
    t = np.arange(len(x)) / SR
    sw = 0.55 + 0.45 * np.clip(np.sin(2 * np.pi * t / 6.2) * 0.8 + np.sin(2 * np.pi * t / 3.7 + 1) * 0.4, -1, 1)
    foam = band(noise(sec), 2500, 8000) * np.clip(np.sin(2 * np.pi * t / 6.2 - .6), 0, 1) ** 3 * 0.35
    return x * sw + foam


def gull_call():
    a = tone(0.12, 1500, 2500, harm=(1, 2, 3), vib=0.02)
    b = tone(0.28, 2500, 1150, harm=(1, 2, 3), vib=0.03)
    y = np.concatenate([a * env(0.12, 0.02, 0.2), b * env(0.28, 0.01, 0.12)])
    y += band(rng.standard_normal(len(y)), 1500, 5000) * 0.08
    return band(y, 700, 4500)


def wings(n_flaps=6, gap=0.075):
    out = np.zeros(int((n_flaps * gap + 0.12) * SR))
    for i in range(n_flaps):
        f = band(noise(0.06), 300, 2000) * env(0.06, 0.008, 0.02) * (1 - i / (n_flaps + 2))
        j = int(i * gap * SR)
        out[j:j + len(f)] += f
    return out


# ---------------------------------------------------------------- the score sheet
EVENTS = []          # (start frame, sound name, signal, peak or rms dB, pan -1..1, hf01 slot)


def at(n, name, x, db, pan=0.0, slot='-', mode='peak'):
    EVENTS.append((n, name, x, db, pan, slot, mode))


def bed(n0, n1, name, x_fn, db, slot, fade_in=0.08, fade_out=0.08):
    sec = (n1 - n0) / 30
    x = x_fn(sec)
    k0, k1 = int(fade_in * SR), int(fade_out * SR)
    x[:k0] *= np.linspace(0, 1, k0)
    x[-k1:] *= np.linspace(1, 0, k1)
    EVENTS.append((n0, name, x, db, 0.0, slot, 'rms'))


# title (hf01 U1-U4): our lockup lands, "2.0" flashes in, the icon card wipes, the zoom-through
at(6.7, 'title burst 1 + thump', mixl(static_burst(0.11), (sub_thump() * 0.8, 0.02)), -9, 0, 'U1 n6.7')
at(13.2, 'title burst 2', static_burst(0.14, 4000), -10, 0.1, 'U2 n13.2')
at(30.1, 'card swish + sub', mixl(swish(0.18, 1000, 10000), (sub_thump(0.28, 90, 70), 0.17)), -12, -0.1, 'U3 n30.1')
at(52.2, 'zoom-through air', swish(0.5, 2000, 12000, 0.9), -16, 0, 'U4 n52.2 (soft)')
# in-suit bed under the spacewalk (hf01 A1 waterfall bed n69-347 + jungle shots): live-action shots only, cut with the cuts
for n0, n1 in ((69, 348), (348, 382), (382, 661), (847, 928), (1103, 1234), (1234, 1257), (1487, 1523), (1531, 1651)):
    bed(n0, n1, 'suit air + breath n%d-%d' % (n0, n1), suit_bed, -34, 'A1 bed slot', 0.03, 0.02)
at(249.0, 'comms tick + beep', comms_tick(), -12, 0.15, 'F1 n249 (3 f before the bubble)')
at(344.7, 'glove lets go (fabric swish; no thud)', swish(0.22, 1500, 8000, 0.6), -18, 0.2, 'F2 n344.7 pre-lap')
at(500.5, 'sunrise whoomp', flare_whoomp(), -9, -0.15, 'F3 n511.8 (on our bloom, n502)')
at(644.6, 'P1 send crackle', send_crackle((661 - 644.6) / 30), -13, 0, 'U5 n644.6 → cut n661')
def jolt():
    x = sub_thump(0.35, 75, 40) * 1.2
    snap = band(noise(0.08), 400, 3000) * env(0.08, 0.002, 0.02)
    x[:len(snap)] += snap
    return x


at(912.0, 'tether snaps taut', jolt(), -8, 0.3, 'our jolt n914')
at(913.0, 'P2 send crackle', send_crackle(0.45), -15, 0, 'send slot')
bed(1103, 1234, 'comms static (night side)', static_wash, -38, 'A3 n1103 (on the cut)', 0.02, 0.03)
at(1181.0, 'P3 send', send_crackle(0.3), -15, 0, 'send slot')
at(1185.3, 'P3 crackle on the crash-zoom', send_crackle(0.25), -14, 0.1, 'U6 n1185.3')
for n in (1236, 1243, 1250):
    at(n, 'glove grabs rail', glove_thud(), -16, -0.2, 'F4 n1234-1256')
at(1480.5, 'tumble into the airlock', tumble(), -9, -0.2, 'F5 n1480.5 pre-lap')
for n in (1511, 1540, 1569, 1598, 1627):
    at(n - 3, 'alarm beep (pulse n%d)' % n, alarm_beep(), -17, 0, 'ours: red pulse peaks')
at(1511.1, 'wrench flight whoosh', rising_whoosh((1528 - 1511.1) / 30 + 0.05), -11, 0.4, 'F6 n1511.1, peak n1527.7')
at(1548.0, 'wrench clangs off the rim + twang + sub', clang(), -6, 0.35, 'F7+F8 n1530/1531.8 (on our strike n1548)')
at(1602.8, 'P4 bar enters (swell + blip)', mixl(swish(0.15, 4000, 16000, 0.8), (tone(0.12, 1500, 600) * env(0.12, 0.005, 0.05) * 0.4, 0.03)), -17, 0, 'U8 n1602.8')
at(1640.3, 'P4 send crackle → cut', send_crackle((1651 - 1640.3) / 30), -13, 0, 'U7 n1640.3')
bed(1800, 1905, 're-entry roar (the vacuum rule ends)', reentry, -20, 'ours: S24', 0.05, 0.004)
at(1895.0, 'P5 send', send_crackle(0.3), -16, 0, 'send slot')
bed(1933, 2168, 'sea wash', sea, -33, 'ours: S26', 0.04, 0.5)
for n in (2001, 2013):
    at(n, 'reply tick', comms_tick(), -15, 0.15, 'F1-style tick 3 f before each bubble')
at(2060, 'gull wings (lands n2072)', wings(), -20, 0.25, 'ours: the gull')
for n in (2118.4, 2124.0, 2141.0, 2148.0):
    at(n, 'gull call', gull_call(), -19, 0.3, 'V1 n2118-2153 (the chirps slot)')


def build(out):
    N = int(round(LEN * SR))
    mix = np.zeros((N, 2))
    rows = []
    for n, name, x, db, pan, slot, mode in EVENTS:
        x = rms_to(x, db) if mode == 'rms' else norm(x, db)
        i = int(round(T(n) * SR))
        j = min(N, i + len(x))
        if i >= N:
            continue
        gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        mix[i:j, 0] += x[:j - i] * gl * np.sqrt(2)
        mix[i:j, 1] += x[:j - i] * gr * np.sqrt(2)
        rows.append({'frame': n, 't': round(T(n), 3), 'sound': name, 'level_db': db, 'mode': mode, 'hf01_slot': slot})
    os.makedirs(os.path.dirname(out), exist_ok=True)
    pk = np.max(np.abs(mix))
    if pk > 0.98:
        raise SystemExit('sfx peak %.2f would clip' % pk)
    pcm = (np.clip(mix, -1, 1) * (2 ** 23 - 1)).round().astype('<i4')          # 24-bit PCM WAV
    with wave.open(out, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(3)
        w.setframerate(SR)
        w.writeframes(pcm.reshape(-1).view(np.uint8).reshape(-1, 4)[:, :3].tobytes())
    json.dump(rows, open(out[:-4] + '.events.json', 'w'), indent=1)
    for r in rows:
        print('n%-7s %6.2fs  %-42s %5.0f dB %-4s  %s' % (r['frame'], r['t'], r['sound'], r['level_db'], r['mode'], r['hf01_slot']))
    print('%d events, peak %.2f (%.1f dBFS) -> %s' % (len(rows), pk, 20 * np.log10(pk), out))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(JOB, 'audio', 'sfx.wav'))
    build(ap.parse_args().out)
