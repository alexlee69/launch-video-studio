# -*- coding: utf-8 -*-
# A sound-effects layer synthesized in code (no samples, no paid audio), every event on its frame, for a recreation
# whose sound follows the reference's own inventory (RECREATE.md §8): the score carries the film, so the dedicated
# effects sit only in the reference's slots (made true to our story), plus beds that cut with the picture.
#   python3 sfx.py <events.json> --out audio/sfx.wav [--length S | --match film.mp4] [--list]
# The spec (worked example: examples/manus2-space-sfx.json):
#   {"fps": 30, "sr": 48000, "length": 76.533, "seed": 23,
#    "events": [
#     {"at": 6.7, "name": "title burst", "parts": [{"sound": "static_burst", "params": {"sec": 0.11}},
#                                                   {"sound": "sub_thump", "gain": 0.8, "offset": 0.02}],
#      "db": -9, "pan": 0, "slot": "U1 n6.7"},
#     {"at": 644.6, "until": 661, "sound": "send_crackle", "db": -13, "slot": "U5"},      until → params.sec = (until − at)/fps (+ pad)
#     {"bed": [69, 348], "sound": "suit_bed", "db": -34, "fade": [0.03, 0.02], "slot": "A1"}]}   a bed: rms level, fades in seconds
# `at` / `bed` are frames at `fps` (t = frame / fps). `db` is the event's PEAK (dBFS) by default, or its RMS with
# "mode": "rms" (beds are rms by default). `pan` −1…1 (equal-power). `parts` sums several sounds (each with `gain` and
# `offset` in seconds) before the level is set. Sounds are generated in spec order from one seeded random stream, so a
# spec always renders the same WAV. Output: 24-bit PCM stereo WAV of exactly `length` seconds (--match takes a film's
# duration) + <out>.events.json (the table printed). Levels are set against the engine's music stem (RMS ≈ −10 dBFS on
# style film); finish.py masters the sum. The user listens: this is checked by meters only.
# The kit (`--list` prints it with each sound's parameters): static_burst, sub_thump, swish, comms_tick, flare_whoomp,
# send_crackle, suit_bed, static_wash, glove_thud, tumble, rising_whoosh, clang, alarm_beep, reentry, sea, gull_call,
# wings, noise_env (band-limited noise × an envelope), tone_env (a gliding tone × an envelope), tone.
# Exit codes: 0 written · 2 a bad spec (unknown sound or parameter, an event past the end) · 1 the sum would clip.
import argparse, inspect, json, os, sys, wave
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.dont_write_bytecode = True   # no __pycache__ in the skill
from media import np, UserError, die, probe, guard_outputs, temp_beside, publish, discard, write_json

SR = 48000
rng = None                                           # set per run from the spec's seed: one stream, consumed in spec order


# ---------------------------------------------------------------- primitives
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
    """a sine (gliding f0 → f1) with harmonics, an optional decay and vibrato"""
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


# ---------------------------------------------------------------- the kit
def static_burst(sec=0.12, lo=1000, hi=16000):
    """digital static: noise + sparse crackle grains, a fast attack (a title slam, a flash-in)"""
    grains = (rng.random(int(sec * SR)) < 0.08).astype(float) * rng.standard_normal(int(sec * SR))
    x = band(noise(sec) * 0.6 + grains * 2.0, lo, hi)
    return x * env(sec, 0.004, sec / 3)


def sub_thump(sec=0.3, f0=90, f1=45):
    """a falling sine thump under an impact or a title"""
    return tone(sec, f0, f1) * env(sec, 0.003, 0.09)


def swish(sec, lo, hi, a_frac=0.7):
    """band-limited air swelling to a short release (a wipe, a zoom-through, fabric)"""
    return band(noise(sec), lo, hi) * env(sec, sec * a_frac, sec * 0.12, 1.6)


def comms_tick():
    """a notification: high tick + low thump + a two-tone comms beep (0.2 s)"""
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
    """a low whoomp + 1-4 kHz crackle (a flare, a fire, a relight)"""
    low = band(noise(sec, 'brown'), 30, 420) * env(sec, 0.09, 0.16)
    cr = band((rng.random(int(sec * SR)) < 0.03) * rng.standard_normal(int(sec * SR)), 1000, 4000) * env(sec, 0.06, 0.12)
    return low + 0.6 * cr


def send_crackle(sec):
    """a digital crackle + noise wash (a prompt sent, pixels out into the next cut)"""
    imp = (rng.random(int(sec * SR)) < 0.02) * rng.standard_normal(int(sec * SR)) * 2.5
    wash = noise(sec) * 0.5
    x = band(imp + wash, 2000, 12000)
    e = env(sec, 0.02, sec * 0.45)
    return x * e


def suit_bed(sec):
    """in-helmet bed: suit air, a fan hum and slow breathing (inhale 1.0 s, exhale 1.4 s, ~4.4 s a cycle)"""
    air = band(noise(sec, 'pink'), 120, 1100) * 0.9
    fan = tone(sec, 118, harm=(1, 2, 3)) * 0.05
    t = np.arange(int(sec * SR)) / SR
    breath = np.zeros_like(t)
    cyc, k = 4.4, 0.6
    while k < sec:
        for st, dur, lo, hi, g in ((k, 1.0, 500, 2200, 0.55), (k + 1.15, 1.4, 300, 1500, 0.45)):
            i0, n = int(st * SR), int(dur * SR)
            if i0 + n >= len(t):
                break
            sh = np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5
            breath[i0:i0 + n] += band(noise(dur), lo, hi) * sh * g
        k += cyc + rng.uniform(-0.3, 0.3)
    return air + fan + breath


def static_wash(sec):
    """comms static, 2-8 kHz with a flutter"""
    x = band(noise(sec), 2000, 8000)
    t = np.arange(len(x)) / SR
    flutter = 0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 3.1 * t + np.sin(2 * np.pi * 0.7 * t)))
    return x * flutter


def glove_thud():
    """a soft gloved grab"""
    return band(noise(0.09), 140, 650) * env(0.09, 0.004, 0.025) + tone(0.09, 95, 70) * env(0.09, 0.002, 0.03) * 0.6


def tumble(sec=0.65):
    """a body tumbling: broad whoosh + scrape + low"""
    hi = band(noise(sec), 1000, 16000) * env(sec, 0.22, 0.2, 1.3)
    scrape = band(noise(sec), 300, 2000) * env(sec, 0.3, 0.15) * (0.5 + 0.5 * (rng.random(int(sec * SR)) < 0.3))
    low = band(noise(sec, 'brown'), 30, 200) * env(sec, 0.05, 0.12)
    return hi + 0.6 * scrape + 0.8 * low


def rising_whoosh(sec, lo=6000, hi=16000):
    """an object flying past the lens, rising to its peak at the end"""
    n = int(sec * SR)
    a = band(noise(sec), lo * 0.5, hi * 0.6)
    b = band(noise(sec), lo, hi)
    m = np.linspace(0, 1, n) ** 2
    return (a * (1 - m) + b * m) * env(sec, sec * 0.85, 0.05, 2.0)


def clang():
    """metal striking metal: inharmonic ring + click + a falling twang + a sub boom (1.2 s)"""
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
    """one alarm pulse, muffled (heard through a helmet)"""
    b = tone(0.17, 880, harm=(1, 3, 5)) * 0.6 + tone(0.17, 1320, harm=(1, 3)) * 0.3
    return band(b, 300, 3500) * env(0.17, 0.006, 0.09)


def reentry(sec):
    """a rising roar: rumble + rattle + plasma hiss"""
    t = np.arange(int(sec * SR)) / SR
    rise = np.clip(t / sec, 0, 1) ** 1.4
    rumble = band(noise(sec, 'brown'), 25, 260) * (0.35 + 0.65 * rise)
    rattle = band(noise(sec), 800, 3200) * (0.5 + 0.5 * np.sin(2 * np.pi * 17 * t) ** 2) * (0.15 + 0.35 * rise)
    hiss = band(noise(sec), 3000, 9000) * 0.12 * rise
    return rumble + rattle + hiss


def sea(sec):
    """open sea: slow swells with foam"""
    x = band(noise(sec, 'pink'), 80, 2200)
    t = np.arange(len(x)) / SR
    sw = 0.55 + 0.45 * np.clip(np.sin(2 * np.pi * t / 6.2) * 0.8 + np.sin(2 * np.pi * t / 3.7 + 1) * 0.4, -1, 1)
    foam = band(noise(sec), 2500, 8000) * np.clip(np.sin(2 * np.pi * t / 6.2 - .6), 0, 1) ** 3 * 0.35
    return x * sw + foam


def gull_call():
    """a distant gull 'kee-ow' (0.4 s)"""
    a = tone(0.12, 1500, 2500, harm=(1, 2, 3), vib=0.02)
    b = tone(0.28, 2500, 1150, harm=(1, 2, 3), vib=0.03)
    y = np.concatenate([a * env(0.12, 0.02, 0.2), b * env(0.28, 0.01, 0.12)])
    y += band(rng.standard_normal(len(y)), 1500, 5000) * 0.08
    return band(y, 700, 4500)


def wings(n_flaps=6, gap=0.075):
    """wing flaps, fading (a bird landing)"""
    out = np.zeros(int((n_flaps * gap + 0.12) * SR))
    for i in range(n_flaps):
        f = band(noise(0.06), 300, 2000) * env(0.06, 0.008, 0.02) * (1 - i / (n_flaps + 2))
        j = int(i * gap * SR)
        out[j:j + len(f)] += f
    return out


def noise_env(sec, lo=None, hi=None, a=0.002, d=0.02, shape=1.0, kind='white'):
    """band-limited noise × an envelope (a snap, a hit, a puff)"""
    return band(noise(sec, kind), lo, hi) * env(sec, a, d, shape)


def tone_env(sec, f0, f1=None, a=0.005, d=0.05, harm=(1,)):
    """a (gliding) tone × an envelope (a blip, a ping)"""
    return tone(sec, f0, f1, tuple(harm)) * env(sec, a, d)


KIT = {f.__name__: f for f in (static_burst, sub_thump, swish, comms_tick, flare_whoomp, send_crackle, suit_bed, static_wash,
                              glove_thud, tumble, rising_whoosh, clang, alarm_beep, reentry, sea, gull_call, wings, noise_env,
                              tone_env, tone)}


def sound(name, params, where):
    f = KIT.get(name)
    if not f:
        raise UserError('%s: unknown sound %r — the kit: %s' % (where, name, ', '.join(KIT)))
    try:
        inspect.signature(f).bind(**params)
    except TypeError as e:
        raise UserError('%s: %s(%s): %s — %s takes %s' % (where, name, ', '.join('%s=%r' % kv for kv in params.items()), e, name,
                                                           str(inspect.signature(f))))
    if 'harm' in params:
        params = dict(params, harm=tuple(params['harm']))
    return f(**params)


def render(spec, length):
    global rng, SR
    SR = int(spec.get('sr', 48000))
    fps = spec.get('fps', 30)
    rng = np.random.default_rng(int(spec.get('seed', 0)))
    T = lambda n: n / float(fps)
    N = int(round(length * SR))
    mix = np.zeros((N, 2))
    rows = []
    for k, ev in enumerate(spec.get('events') or []):
        where = 'event %d (%s)' % (k + 1, ev.get('name') or ev.get('sound') or 'parts')
        if 'bed' in ev:                                  # a bed: (n1 − n0)/fps seconds, faded, rms level by default
            n0, n1 = ev['bed']
            sec = (n1 - n0) / fps
            x = sound(ev['sound'], dict(ev.get('params') or {}, sec=sec), where)
            fi, fo = ev.get('fade', [0.08, 0.08])
            k0, k1 = int(fi * SR), int(fo * SR)
            if k0:
                x[:k0] *= np.linspace(0, 1, k0)
            if k1:
                x[-k1:] *= np.linspace(1, 0, k1)
            at, mode = n0, ev.get('mode', 'rms')
        else:
            at, mode = ev['at'], ev.get('mode', 'peak')
            if 'parts' in ev:
                parts = []
                for p in ev['parts']:
                    s = sound(p['sound'], dict(p.get('params') or {}), where)
                    if 'gain' in p:
                        s = s * p['gain']
                    parts.append((s, p.get('offset', 0.0)))
                x = mixl(*parts)
            else:
                params = dict(ev.get('params') or {})
                if 'until' in ev:
                    params['sec'] = (ev['until'] - at) / fps + ev['pad'] if 'pad' in ev else (ev['until'] - at) / fps
                x = sound(ev['sound'], params, where)
        if mode not in ('peak', 'rms'):
            raise UserError('%s: mode is "peak" or "rms" (got %r)' % (where, mode))
        db, pan = ev['db'], ev.get('pan', 0.0)
        x = rms_to(x, db) if mode == 'rms' else norm(x, db)
        i = int(round(T(at) * SR))
        if i >= N:
            raise UserError('%s: at frame %s (%.2f s) it starts past the end (%.3f s)' % (where, at, T(at), length))
        j = min(N, i + len(x))
        gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        mix[i:j, 0] += x[:j - i] * gl * np.sqrt(2)
        mix[i:j, 1] += x[:j - i] * gr * np.sqrt(2)
        rows.append({'frame': at, 't': round(T(at), 3), 'sound': ev.get('name') or ev.get('sound') or '+'.join(p['sound'] for p in ev['parts']),
                     'level_db': db, 'mode': mode, 'pan': pan, 'slot': ev.get('slot', '-'), 'end_frame': ev['bed'][1] if 'bed' in ev else None})
    return mix, rows


def write_wav(path, mix):
    pcm = (np.clip(mix, -1, 1) * (2 ** 23 - 1)).round().astype('<i4')          # 24-bit PCM WAV
    t = temp_beside(path)
    try:
        with wave.open(t, 'wb') as w:
            w.setnchannels(2)
            w.setsampwidth(3)
            w.setframerate(SR)
            w.writeframes(pcm.reshape(-1).view(np.uint8).reshape(-1, 4)[:, :3].tobytes())
        publish(t, path)
    except BaseException:
        discard(t)
        raise


def main():
    ap = argparse.ArgumentParser(description='A synthesized SFX layer from an events spec: every sound on its frame.')
    ap.add_argument('spec', nargs='?')
    ap.add_argument('--out', help='the WAV to write (24-bit stereo); <out>.events.json goes beside it')
    ap.add_argument('--length', type=float, help="seconds (default: the spec's length)")
    ap.add_argument('--match', help="take the length from this film's duration")
    ap.add_argument('--list', action='store_true', help='print the kit with each sound\'s parameters and exit')
    a = ap.parse_args()
    if a.list:
        for n, f in KIT.items():
            print('%-14s %-60s %s' % (n, str(inspect.signature(f)), (f.__doc__ or '').strip().splitlines()[0] if f.__doc__ else ''))
        return
    if not a.spec or not a.out:
        die('give an events spec and --out audio/sfx.wav (or --list for the kit)')
    try:
        spec = json.load(open(a.spec, encoding='utf-8'))
    except (OSError, ValueError) as e:
        die('%s: not a readable JSON spec (%s)' % (a.spec, e))
    length = a.length or (probe(a.match)['duration'] if a.match else spec.get('length'))
    if not length:
        die('give the length: "length" in the spec, --length S or --match film.mp4')
    if not a.out.lower().endswith('.wav'):
        die('%s: the output is a WAV — name it .wav' % a.out)
    ev_json = a.out[:-4] + '.events.json'
    guard_outputs([a.out, ev_json], [a.spec] + ([a.match] if a.match else []))
    mix, rows = render(spec, float(length))
    pk = float(np.max(np.abs(mix))) if len(mix) else 0.0
    if pk > 0.98:
        sys.stderr.write('\n✗ the summed effects peak at %.2f (%.1f dBFS) and would clip — lower the loudest events\' db\n' % (pk, 20 * np.log10(pk)))
        sys.exit(1)
    write_wav(a.out, mix)
    write_json(ev_json, rows, indent=1)
    for r in rows:
        print('n%-7s %6.2fs  %-42s %5.0f dB %-4s  %s' % (r['frame'], r['t'], r['sound'][:42], r['level_db'], r['mode'], r['slot']))
    print('%d events, %.3f s, peak %.2f (%.1f dBFS) -> %s' % (len(rows), float(length), pk, 20 * np.log10(pk) if pk else -120, a.out))


if __name__ == '__main__':
    try:
        main()
    except UserError as e:
        die(str(e))
