# -*- coding: utf-8 -*-
# Synthetic fixtures for the acceptance harness — deterministic (seeded), made with numpy + Pillow + ffmpeg, each group
# with a truth.json the checks read. Re-running rebuilds a group from scratch.
#   python3 -E fixtures/make_fixtures.py [phone24 cadence cuts30 clicks films track look fal]   (default: all)
import os, sys, json, math, shutil, subprocess, struct, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))
import barcode as BC
import harness as H

FF = H.FFMPEG


def ff(args, stdin=None):
    p = subprocess.run([FF, '-y', '-v', 'error'] + args, input=stdin, capture_output=True)
    if p.returncode: raise RuntimeError('ffmpeg failed: %s\n%s' % (' '.join(args[-3:]), p.stderr.decode()[-800:]))


def write_video(path, frames, W, H_, fps, audio=None, crf=14, faststart=True, extra=(), vfilter=None):
    """frames: iterable of HxWx3 uint8; audio: lavfi source string or a wav path"""
    cmd = ['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H_), '-framerate', str(fps), '-i', 'pipe:0']
    if audio:
        cmd += (['-i', audio] if os.path.exists(str(audio)) else ['-f', 'lavfi', '-i', audio])
    cmd += ['-map', '0:v'] + (['-map', '1:a', '-c:a', 'aac', '-b:a', '128k', '-shortest'] if audio else [])
    if vfilter: cmd += ['-vf', vfilter]
    cmd += ['-c:v', 'libx264', '-preset', 'medium', '-crf', str(crf), '-pix_fmt', 'yuv420p'] + list(extra)
    if faststart: cmd += ['-movflags', '+faststart']
    cmd += [path]
    data = b''.join(np.ascontiguousarray(f, dtype=np.uint8).tobytes() for f in frames)
    ff(cmd, stdin=data)


def reset(d):
    if os.path.exists(d): shutil.rmtree(d)
    os.makedirs(d)
    return d


def save(d, truth):
    with open(os.path.join(d, 'truth.json'), 'w', encoding='utf-8') as f: json.dump(truth, f, indent=1)


def texture(rng, W, H_, lo=70, hi=205):
    """smooth photographic-ish background: gradient + blobs + sines, never dark"""
    y, x = np.mgrid[0:H_, 0:W].astype(np.float64)
    base = np.stack([140 + 40 * (x / W) - 20 * (y / H_), 130 + 10 * np.sin(x / 90.0), 120 - 30 * (x / W) + 25 * (y / H_)], -1)
    for _ in range(14):
        cx, cy, r = rng.uniform(0, W), rng.uniform(0, H_), rng.uniform(40, 180)
        col = rng.uniform(-45, 45, 3)
        base += col * np.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * r * r))[..., None]
    base += 12 * np.sin(x / 23.0 + y / 41.0)[..., None]
    return np.clip(base, lo, hi)


# ── phone24: a 24 fps clip with a black portrait "phone" screen that moves and turns, partly covered by a "finger" ──
def phone24():
    d = reset(os.path.join(HERE, 'phone24'))
    W, H_, N, FPS = 720, 1290, 96, 24
    rng = np.random.RandomState(24)
    bg = texture(rng, W + 80, H_ + 60)
    sw, sh_, bez, rad = 236.0, 480.0, 9.0, 18.0
    yy, xx = np.mgrid[0:H_ * 2, 0:W * 2].astype(np.float64) / 2.0 + .25       # 2x supersampling grid
    truth = {'W': W, 'H': H_, 'fps': FPS, 'frames': N, 'screen_w': sw, 'screen_h': sh_, 'bezel': bez, 'per_frame': [], 'barcode': dict(nbits=8, x0=200, y0=1220, block=24, gap=6)}

    def rrect(u, v, hw, hh, r):                              # inside a rounded rectangle (local coords)
        qx, qy = np.maximum(np.abs(u) - (hw - r), 0), np.maximum(np.abs(v) - (hh - r), 0)
        return (np.hypot(qx, qy) <= r) & (np.abs(u) <= hw) & (np.abs(v) <= hh)

    def capsule(px, py, T, D, L, r):
        ax, ay = px - T[0], py - T[1]
        t = np.clip(ax * D[0] + ay * D[1], 0, L)
        return np.hypot(ax - t * D[0], ay - t * D[1]) <= r

    def finger_tip(k):
        a = (700.0, 900.0); b = (430.0, 700.0); c = (690.0, 930.0)
        if k <= 50: s = k / 50.0; return (a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s)
        s = (k - 50) / 45.0; return (b[0] + (c[0] - b[0]) * s, b[1] + (c[1] - b[1]) * s)

    frames = []
    for k in range(N):
        cx, cy, th = 330 + .9 * k, 560 + .55 * k, math.radians(2.0 + 4.0 * k / (N - 1))
        ox, oy = int(round(40 - .3 * k)), int(round(30 - .2 * k))         # slow camera pan (the background moves too)
        img = bg[oy:oy + H_, ox:ox + W].copy()
        img += np.random.RandomState(1000 + k).normal(0, 2.5, img.shape)   # grain
        c, s = math.cos(th), math.sin(th)
        u = (xx - cx) * c + (yy - cy) * s; v = -(xx - cx) * s + (yy - cy) * c
        body = rrect(u, v, sw / 2 + bez, sh_ / 2 + bez, rad + bez).astype(np.float64)
        scr = rrect(u, v, sw / 2, sh_ / 2, rad).astype(np.float64)
        T, D, L, r = finger_tip(k), (.5, .8660254), 260.0, 34.0
        fin = capsule(xx, yy, T, D, L, r).astype(np.float64)
        ds = lambda m: m.reshape(H_, 2, W, 2).mean((1, 3))[..., None]
        bodyA, scrA, finA = ds(body), ds(scr), ds(fin)
        bezel_col = np.array([58, 58, 64.0])
        screen_col = 6 + 6 * ((np.arange(W)[None, :] + np.arange(H_)[:, None]) / float(W + H_))[..., None] * np.ones(3)
        img = img * (1 - bodyA) + bezel_col * bodyA
        img = img * (1 - scrA) + screen_col * scrA
        shade = 1 - .12 * ((np.arange(H_)[:, None] - T[1]) / 400.0)
        fcol = np.array([206, 152, 128.0]) * np.clip(shade, .8, 1.1)[..., None]
        img = img * (1 - finA) + fcol * finA
        img = np.clip(img, 0, 255).astype(np.uint8)
        BC.draw(img, k, **truth['barcode'])
        frames.append(img)
        corners = []
        for (lu, lv) in ((-sw / 2, -sh_ / 2), (sw / 2, -sh_ / 2), (sw / 2, sh_ / 2), (-sw / 2, sh_ / 2)):
            corners.append([round(cx + lu * c - lv * s, 3), round(cy + lu * s + lv * c, 3)])
        truth['per_frame'].append({'k': k, 'center': [cx, cy], 'theta_deg': round(math.degrees(th), 4), 'screen_corners': corners,
                                   'finger': {'tip': [round(T[0], 3), round(T[1], 3)], 'dir': list(D), 'len': L, 'r': r}})
    write_video(os.path.join(d, 'clip.mp4'), frames, W, H_, FPS, audio='sine=frequency=440:sample_rate=48000:duration=4', crf=12)
    # same scene, no phone (frame 0 has no black region): pin must refuse with exit 3
    nf = []
    for k in range(48):
        ox, oy = int(round(40 - .3 * k)), int(round(30 - .2 * k))
        img = np.clip(bg[oy:oy + H_, ox:ox + W] + np.random.RandomState(1000 + k).normal(0, 2.5, (H_, W, 3)), 0, 255).astype(np.uint8)
        BC.draw(img, k, **truth['barcode']); nf.append(img)
    write_video(os.path.join(d, 'nophone.mp4'), nf, W, H_, FPS, crf=14)
    # the app screen to pin: four colour quadrants under a white header band (orientation is checkable)
    S = np.zeros((2196, 1080, 3), np.uint8)
    S[:1098, :540] = (230, 40, 40); S[:1098, 540:] = (40, 200, 60); S[1098:, :540] = (40, 80, 230); S[1098:, 540:] = (240, 210, 40)
    S[:264] = (250, 250, 250)
    Image.fromarray(S).convert('RGBA').save(os.path.join(d, 'screen.png'))
    truth['screen_png'] = {'size': [1080, 2196], 'band_frac': 264 / 2196.0, 'quadrants': {'TL': [230, 40, 40], 'TR': [40, 200, 60], 'BL': [40, 80, 230], 'BR': [240, 210, 40]}}
    save(d, truth)
    return d


# ── cadence: 24 / 30 fps barcode clips for conform's frame-count, cadence, start and crop checks ──
def cadence():
    d = reset(os.path.join(HERE, 'cadence'))
    W, H_ = 640, 360
    bc = dict(nbits=8, x0=192, y0=290, block=22, gap=4)              # x 192–448: survives a centre crop to 360 wide
    rng = np.random.RandomState(7)
    bg = texture(rng, W, H_)

    def frame(k):
        img = bg.copy(); x = (7 * k) % W
        img[40:250, max(0, x - 6):x + 6] = (250, 250, 250)                # a moving bar: an interpolated frame shows two
        img[60 + (k * 3) % 150:90 + (k * 3) % 150, 40:120] = (30, 160, 220)
        img = np.clip(img + np.random.RandomState(50 + k).normal(0, 2, img.shape), 0, 255).astype(np.uint8)
        return BC.draw(img, k, **bc)
    write_video(os.path.join(d, 'src24.mp4'), [frame(k) for k in range(120)], W, H_, 24, audio='sine=frequency=330:sample_rate=48000:duration=5', crf=12)
    write_video(os.path.join(d, 'src30.mp4'), [frame(k) for k in range(120)], W, H_, 30, audio='sine=frequency=330:sample_rate=48000:duration=4', crf=12)
    save(d, {'W': W, 'H': H_, 'barcode': bc, 'src24': {'fps': 24, 'frames': 120}, 'src30': {'fps': 30, 'frames': 120}})
    return d


# ── cuts30: 30 fps films with cuts at known frames (+ one next to a black shot), a 1-frame-shifted copy, etc. ──
REF_CUTS = [37, 75, 104, 150, 188, 220, 262]
REF_JITTER_US = 2            # 0–8 µs pts jitter on a µs timebase (higgsfield02.mp4 has 33332…33335 µs steps): ffmpeg hstack slips on it


def cuts30():
    d = reset(os.path.join(HERE, 'cuts30'))
    W, H_, N = 640, 360, 300
    bc = dict(nbits=10, x0=176, y0=318, block=20, gap=4)
    refc = [(200, 60, 60), (60, 160, 70), (60, 90, 200), (210, 180, 50), (150, 70, 180), (60, 180, 190), (230, 130, 60), (120, 120, 120)]
    ourc = [(250, 150, 150), (150, 230, 160), (150, 175, 250), (250, 235, 150), (215, 160, 235), (160, 235, 240), (255, 200, 150), (200, 200, 200)]
    texs = {}

    def tex(seed, col):
        if seed not in texs:
            r = np.random.RandomState(seed); t = np.zeros((H_, W + 700, 3)) + col
            for _ in range(90):
                x0, y0, w, h = r.randint(0, W + 650), r.randint(0, H_ - 60), r.randint(10, 70), r.randint(8, 50)
                t[y0:y0 + h, x0:x0 + w] = np.clip(np.array(col) + r.uniform(-90, 90, 3), 0, 255)
            texs[seed] = t
        return texs[seed]

    def shot_of(i, cuts): return sum(1 for c in cuts if c <= i)

    def frame(i, cuts, cols, seed0, blank_shot=None, code=None):
        s = shot_of(i, cuts); start = ([0] + cuts)[s]
        if s == blank_shot:
            return np.full((H_, W, 3), 4, np.uint8)
        t = tex(seed0 + s, cols[s]); off = 2 * (i - start) + 40 * s
        img = t[:, off:off + W].copy()
        cy = 120 + 40 * math.sin(i / 9.0)
        yy, xx = np.ogrid[0:H_, 0:W]
        img[((xx - (180 + 60 * s)) ** 2 + (yy - cy) ** 2) < 45 ** 2] = (255 - np.array(cols[s])) * .8
        img = np.clip(img, 0, 255).astype(np.uint8)
        return BC.draw(img, i if code is None else code, **bc)

    ref_frames = [frame(i, REF_CUTS, refc, 100) for i in range(N)]
    ours = [frame(i, REF_CUTS, ourc, 200) for i in range(N)]
    mixed_cuts = [37, 75, 107, 150, 188, 220]                               # n104 → +3 (off), n262 removed (missing)
    mixed = [frame(i, mixed_cuts, ourc, 200) for i in range(N)]
    blank = [frame(i, REF_CUTS, ourc, 200, blank_shot=5) for i in range(N)]  # shot 5 = frames 188–219 near-black
    shift1 = [ours[0]] + ours[:-1]
    tone = lambda f, dur: 'sine=frequency=%d:sample_rate=48000:duration=%s' % (f, dur)
    # the reference: µs timebase with 33333/33334 µs steps, like higgsfield02.mp4 (ffmpeg hstack slips frames on it)
    jit = "settb=1/1000000,setpts='floor(N*1000000/30+0.5)+%d*mod(N\\,5)'" % REF_JITTER_US
    write_video(os.path.join(d, 'ref.mp4'), ref_frames, W, H_, 30, audio=tone(440, 10.2), crf=14, vfilter=jit,
                extra=('-fps_mode', 'passthrough', '-enc_time_base', '1:1000000', '-video_track_timescale', '1000000'))
    write_video(os.path.join(d, 'ours_exact.mp4'), ours, W, H_, 30, audio=tone(880, 10), crf=14)
    write_video(os.path.join(d, 'ours_shift1.mp4'), shift1, W, H_, 30, audio=tone(880, 10), crf=14)
    write_video(os.path.join(d, 'ours_mixed.mp4'), mixed, W, H_, 30, audio=tone(880, 10), crf=14)
    write_video(os.path.join(d, 'ours_blank.mp4'), blank, W, H_, 30, audio=tone(880, 10), crf=14)
    write_video(os.path.join(d, 'ours_short.mp4'), ours[:240], W, H_, 30, audio=tone(880, 8), crf=14)
    write_video(os.path.join(d, 'ours_25fps.mp4'), ours, W, H_, 25, audio=tone(880, 12), crf=14)
    truth = {'W': W, 'H': H_, 'fps': 30, 'frames': N, 'barcode': bc, 'ref_cuts': REF_CUTS,
             'expect': {'ours_exact': {'exact': 7, 'within1': 0, 'off': 0, 'missing': 0},
                        'ours_shift1': {'exact': 0, 'within1': 7, 'off': 0, 'missing': 0, 'offset': 1},
                        'ours_mixed': {'exact': 5, 'within1': 0, 'off': 1, 'missing': 1, 'off_cut': 104, 'off_by': 3, 'missing_cut': 262},
                        'ours_blank': {'trivial': [188, 220]}},
             'colors': {'ref': refc, 'ours': ourc}, 'audio_hz': {'ref': 440, 'ours': 880}, 'short_frames': 240}
    save(d, truth)
    return d


# ── clicks: click tracks at a known bpm / phase, a 40 ms-late copy, a different tempo; a groove in F major ──
SR = 44100


def write_wav(path, x):                    # mono float → 16-bit stereo PCM
    x = np.clip(x, -1, 1); s = (x * 32767).astype('<i2'); st = np.stack([s, s], -1).reshape(-1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes())


def clicks():
    d = reset(os.path.join(HERE, 'clicks'))
    dur = 30.0

    def track(bpm, first, lag=0.0, quiet=(19.6, 20.6), hit_beat=None, seed=3):   # the big hit lands on the first beat after the quiet span
        n = int(dur * SR); beat = 60.0 / bpm; r = np.random.RandomState(seed)
        tb = np.arange(n) / SR                                       # a soft bed (≈ −32 dBFS) everywhere but the quiet span
        x = .025 * (np.sin(2 * np.pi * 220 * tb) + np.sin(2 * np.pi * 277.2 * tb + 1)) + .004 * r.normal(0, 1, n)
        g = np.ones(n); qa, qb = int((quiet[0] + lag) * SR), int((quiet[1] + lag) * SR); g[qa:qb] = 0
        ramp = np.linspace(1, 0, int(.01 * SR)); g[qa - len(ramp):qa] = ramp; g[qb:qb + len(ramp)] = ramp[::-1]
        x *= g
        k, times, hit_t = 0, [], None
        while True:
            t = first + k * beat + lag
            if t > dur - .3: break
            if quiet[0] <= t - lag < quiet[1]: k += 1; continue
            i = int(round(t * SR)); m = min(n - i, int(.12 * SR)); tt = np.arange(m) / SR
            down = (k % 4 == 0)
            click = (.32 if down else .2) * np.sin(2 * np.pi * 2000 * tt) * np.exp(-tt / .012)
            click += (.08 if down else .05) * r.normal(0, 1, m) * np.exp(-tt / .006)
            if down: click += .25 * np.sin(2 * np.pi * 60 * tt) * np.exp(-tt / .05)
            if hit_t is None and t - lag >= quiet[1] and (hit_beat is None or k == hit_beat):
                m2 = min(n - i, int(.4 * SR)); t2 = np.arange(m2) / SR
                x[i:i + m2] += .85 * r.normal(0, 1, m2).clip(-1.2, 1.2) * np.exp(-t2 / .09) / 1.2 + .5 * np.sin(2 * np.pi * 55 * t2) * np.exp(-t2 / .15)
                hit_t = t
            x[i:i + m] += click; times.append(round(t, 5)); k += 1
        return x / max(1.0, np.abs(x).max() / .95), times, hit_t

    def quiet_spans(x, thr_db=-45, minlen=.25, win=.01):
        hop = int(win * SR); n = len(x) // hop
        rms = np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(1)); db = 20 * np.log10(rms + 1e-12)
        spans, a = [], None
        for i, v in enumerate(db):
            if v < thr_db and a is None: a = i
            if (v >= thr_db or i == n - 1) and a is not None:
                if (i - a) * win >= minlen: spans.append([round(a * win, 3), round(i * win, 3)])
                a = None
        return spans

    truth = {}
    for name, kw in (('ref', dict(bpm=100.0, first=.25)), ('lag40', dict(bpm=100.0, first=.25, lag=.04)), ('tempo104', dict(bpm=104.0, first=.25))):
        x, times, hit = track(**kw)
        write_wav(os.path.join(d, name + '.wav'), x)
        q = quiet_spans(x)
        truth[name] = {'bpm': kw['bpm'], 'first_beat': round(kw['first'] + kw.get('lag', 0), 4), 'hit': round(hit, 4), 'quiet': [s for s in q if 1 < s[0] < dur - 1]}
    shutil.copyfile(os.path.join(d, 'ref.wav'), os.path.join(d, 'same.wav'))
    truth['same'] = dict(truth['ref'])
    # groove: 100 BPM, first downbeat 0.5 s, kick 1+3, snare 2+4, hats on the off-beat 8ths, F major I-vi-IV-V
    bpm, first, bars = 100.0, .5, 10; beat = 60 / bpm; n = int((first + bars * 4 * beat + 1) * SR); x = np.zeros(n); r = np.random.RandomState(9)
    def add(t, sig):
        i = int(round(t * SR)); m = min(n - i, len(sig)); x[i:i + m] += sig[:m]
    tt = np.arange(int(.25 * SR)) / SR
    kick = .55 * np.sin(2 * np.pi * (50 + 60 * np.exp(-tt / .03)) * tt) * np.exp(-tt / .09)
    def bandnoise(lo, hi):                                                      # band-limited noise (FFT mask): bands don't leak
        X = np.fft.rfft(r.normal(0, 1, len(tt))); Fq = np.fft.rfftfreq(len(tt), 1.0 / SR); X[(Fq < lo) | (Fq > hi)] = 0
        y = np.fft.irfft(X, len(tt)); return y / np.abs(y).max()
    snare = .3 * bandnoise(200, 3000) * np.exp(-tt / .06) + .2 * np.sin(2 * np.pi * 185 * tt) * np.exp(-tt / .04)
    hat = .3 * bandnoise(6000, 12000) * np.exp(-tt / .015)
    F0 = 349.23
    chords = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]]                    # F, Dm, Bb, C (semitones from F)
    roots = [0, -3, -7, -5]
    for b in range(bars):
        t0 = first + b * 4 * beat; ch = chords[b % 4]
        tb = np.arange(int(4 * beat * SR)) / SR; env = np.minimum(1, tb / .05) * np.exp(-tb / 4)
        pad = sum(np.sin(2 * np.pi * F0 * 2 ** (s / 12.0) * tb) for s in ch) * .045 * env
        add(t0, pad)
        bass_f = F0 / 4 * 2 ** (roots[b % 4] / 12.0)
        for q in range(4):
            tq = t0 + q * beat
            add(tq, (.16 if b % 4 == 0 else .12) * np.sin(2 * np.pi * bass_f * tt) * np.exp(-tt / .18))
            add(tq, kick if q in (0, 2) else snare)
            add(tq + beat / 2, hat)
    write_wav(os.path.join(d, 'groove.wav'), x / (np.abs(x).max() / .9))
    truth['groove'] = {'bpm': bpm, 'first_beat': first, 'key': 'F major', 'kick16': [0, 8], 'snare16': [4, 12], 'hats16': [2, 6, 10, 14]}
    save(d, truth)
    return d


# ── films: temptrack inputs — "ours" (picture + our audio) and a "reference" (its picture + its own audio) ──
def films():
    d = reset(os.path.join(HERE, 'films'))
    W, H_ = 320, 180
    def pic(i, col, seed):
        img = np.zeros((H_, W, 3)) + col; x = (5 * i) % W
        img[30:150, max(0, x - 8):x + 8] = (255 - np.array(col)); img = np.clip(img + np.random.RandomState(seed + i).normal(0, 3, img.shape), 0, 255).astype(np.uint8)
        return BC.draw(img, i, nbits=8, x0=20, y0=150, block=14, gap=3)
    def melody(path, freqs, dur, sr):
        t = np.arange(int(dur * sr)) / sr; x = np.zeros_like(t)
        for k, f in enumerate(freqs * 40):
            a = k * .25
            if a >= dur: break
            m = (t >= a) & (t < a + .24); x[m] += .3 * np.sin(2 * np.pi * f * (t[m] - a)) * np.exp(-(t[m] - a) / .2)
        s = (np.clip(x, -1, 1) * 32767).astype('<i2'); st = np.stack([s, (s * .8).astype('<i2')], -1).reshape(-1)
        with wave.open(path, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr); w.writeframes(st.tobytes())
    melody(os.path.join(d, 'ref-audio.wav'), [523.25, 659.25, 783.99, 659.25], 6.0, 44100)
    melody(os.path.join(d, 'our-audio.wav'), [392.0, 493.88, 587.33], 6.0, 48000)
    write_video(os.path.join(d, 'ref_a.mp4'), [pic(i, (40, 60, 150), 10) for i in range(180)], W, H_, 30, audio=os.path.join(d, 'ref-audio.wav'), crf=16)
    for name, n in (('film_a', 180), ('film_short2', 178), ('film_long10', 190), ('film_short1', 179)):
        melody(os.path.join(d, name + '-audio.wav'), [392.0, 493.88, 587.33], n / 30.0, 48000)
        write_video(os.path.join(d, name + '.mp4'), [pic(i, (150, 90, 40), 20) for i in range(n)], W, H_, 30, audio=os.path.join(d, name + '-audio.wav'), crf=16)
    truth = {'ref': 'ref_a.mp4', 'film': 'film_a.mp4', 'refuse': ['film_short2.mp4', 'film_long10.mp4'], 'borderline': 'film_short1.mp4',
             'ref_pcm_md5': H.stream_md5(os.path.join(d, 'ref_a.mp4'), '0:a'), 'film_video_md5': H.stream_md5(os.path.join(d, 'film_a.mp4'), '0:v', copy=True)}
    save(d, truth)
    return d


# ── track: a pan with a known velocity profile (+ matching blur), and a pure zoom ──
def track():
    d = reset(os.path.join(HERE, 'track'))
    W, H_ = 540, 304
    r = np.random.RandomState(31)
    big = Image.fromarray(np.clip(texture(r, W + 400, H_ + 80, 20, 235), 0, 255).astype(np.uint8))
    dr = ImageDraw.Draw(big)
    for _ in range(160):
        x, y, s = r.randint(0, W + 380), r.randint(0, H_ + 60), r.randint(6, 40)
        dr.rectangle((x, y, x + s, y + s * r.uniform(.4, 1.6)), fill=tuple(int(v) for v in r.randint(0, 255, 3)))
    T = np.asarray(big, np.float64)
    v = [0, 0, 0, 2, 5, 10, 16, 22, 24]
    while len(v) < 22: v.append(round(v[-1] * .8, 4))
    p = np.cumsum(v)                                               # content displacement (px, + = moves right)
    X0, Y0 = 200, 40

    def shifted(dx):
        xs = np.arange(W) + X0 - dx; x0 = np.floor(xs).astype(int); fr = xs - x0
        return T[Y0:Y0 + H_, x0] * (1 - fr)[None, :, None] + T[Y0:Y0 + H_, x0 + 1] * fr[None, :, None]

    def hblur(img, sig):
        if sig < .05: return img
        rad = int(3 * sig + 1); k = np.exp(-np.arange(-rad, rad + 1) ** 2 / (2 * sig * sig)); k /= k.sum()
        pad = np.pad(img, ((0, 0), (rad, rad), (0, 0)), mode='edge')
        return sum(k[i] * pad[:, i:i + W] for i in range(len(k)))
    frames = [np.clip(hblur(shifted(p[n]), .2 * v[n]), 0, 255).astype(np.uint8) for n in range(len(v))]
    write_video(os.path.join(d, 'pan.mp4'), frames, W, H_, 30, crf=10)
    # zoom about the centre, no blur
    base = Image.fromarray(np.clip(T[Y0:Y0 + H_, X0:X0 + W], 0, 255).astype(np.uint8))
    zs = [round(1 + .015 * n, 4) for n in range(13)]
    zf = []
    for s in zs:
        w2, h2 = W / s, H_ / s; box = ((W - w2) / 2, (H_ - h2) / 2, (W + w2) / 2, (H_ + h2) / 2)
        zf.append(np.asarray(base.transform((W, H_), Image.EXTENT, box, Image.BICUBIC)))
    write_video(os.path.join(d, 'zoom.mp4'), zf, W, H_, 30, crf=10)
    peak = int(np.argmax(v))
    save(d, {'W': W, 'H': H_, 'pan': {'key': 0, 'v': v, 'p': [round(x, 4) for x in p], 'blur': [round(.2 * x, 4) for x in v], 'peak_frame': peak,
                                      'peak_speed_1080': v[peak] * 1080.0 / W, 'decay': .8},
                         'zoom': {'key': 0, 's': zs, 'center': [W / 2.0, H_ / 2.0]}})
    return d


# ── look: a still, a brighter/flatter "ours", and a reference clip whose frames vary (for --ref flags) ──
def look():
    d = reset(os.path.join(HERE, 'look'))
    W, H_ = 1280, 720
    r = np.random.RandomState(41)
    sc = texture(r, W, H_, 25, 200)
    y = np.arange(H_)[:, None, None]
    sc = sc * (1 - .45 * (y > 430))                                # a darker lower half (shadows)
    sc[460:640, 200:420] = (150, 40, 30); sc[120:300, 820:1100] = (40, 70, 160)
    grain = lambda seed: np.random.RandomState(seed).normal(0, 4, sc.shape)
    still = np.clip(sc + grain(1), 0, 255).astype(np.uint8)
    Image.fromarray(still).save(os.path.join(d, 'still.png'))
    frames = [np.clip(sc * (1 + .12 * math.sin(i / 2.0)) + grain(10 + i), 0, 255).astype(np.uint8) for i in range(30)]
    write_video(os.path.join(d, 'ref.mp4'), frames, W, H_, 30, crf=10,      # BT.709 matrix + tags: no 601/709 ambiguity for any decoder
                vfilter='scale=out_color_matrix=bt709:out_range=tv,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv')
    ours = np.clip(sc * 1.0 + 55 + grain(10 + 15), 0, 255).astype(np.uint8)
    Image.fromarray(ours).save(os.path.join(d, 'ours_bright.png'))
    save(d, {'still': 'still.png', 'ref': 'ref.mp4', 'ours_bright': 'ours_bright.png', 'note': 'expected numbers come from oracle/look_oracle.py (today\'s look_stats formulas)'})
    return d


# ── fal: what the mock CDN serves (stills, a video, guides) + the raw-mode input with @file fields ──
def fal():
    d = reset(os.path.join(HERE, 'fal'))
    def jpg(path, W, H_, seed, q=90):
        r = np.random.RandomState(seed); im = np.clip(texture(r, W, H_, 30, 230), 0, 255).astype(np.uint8)
        Image.fromarray(im).save(path, quality=q)
    jpg(os.path.join(d, 'key.jpg'), 768, 1376, 1)
    for i, s in ((0, 2), (1, 3)): jpg(os.path.join(d, 'still_%d.jpg' % i), 512, 912, s)
    for i, s in ((0, 4), (1, 5)): jpg(os.path.join(d, 'still2_%d.jpg' % i), 512, 912, s)
    Image.fromarray(np.full((64, 64, 3), 200, np.uint8)).save(os.path.join(d, 'thumb.png'))
    def clip(path, n, seed, W=320, H_=576, fps=24, audio=True, faststart=False):
        r = np.random.RandomState(seed); bg = texture(r, W, H_)
        fr = [np.clip(bg + 30 * math.sin(i / 5.0), 0, 255).astype(np.uint8) for i in range(n)]
        write_video(path, fr, W, H_, fps, audio=('sine=frequency=523:sample_rate=48000:duration=%.3f' % (n / float(fps))) if audio else None, crf=20, faststart=faststart)
    clip(os.path.join(d, 'clip.mp4'), 48, 6)                          # moov at the end: a truncated copy is unreadable
    clip(os.path.join(d, 'clip2.mp4'), 48, 7)
    for name, sec in (('guide_5p4', 5.4), ('guide_3', 3.0), ('guide_16', 16.0)):
        clip(os.path.join(d, name + '.mp4'), int(round(sec * 30)), 8, W=160, H_=90, fps=30, audio=False, faststart=True)
    with open(os.path.join(d, 'raw_input.json'), 'w', encoding='utf-8') as f:
        json.dump({'prompt': 'acc raw request', 'image_url': '@key.jpg', 'reference_video_urls': ['@guide_3.mp4'], 'note': '@key.jpg', 'seed': 11}, f, indent=1)
    sizes = {f: os.path.getsize(os.path.join(d, f)) for f in sorted(os.listdir(d)) if not f.endswith('.json')}
    md5s = {f: H.md5_file(os.path.join(d, f)) for f in sizes}
    dur = {f: float(H.ffprobe_json(os.path.join(d, f)).get('format', {}).get('duration', 0)) for f in sizes if f.endswith('.mp4')}
    save(d, {'sizes': sizes, 'md5': md5s, 'durations': dur})
    return d


def cuts30_60fps():
    """ours at 60 fps (an exact multiple of the reference's 30): frame 2i = ours frame i, frame 2i+1 = the same picture with
    barcode 512+i — compare.py must pair our frame 2i with reference frame i (lead's review round, 2026-10-22)"""
    d = os.path.join(HERE, 'cuts30'); tp = os.path.join(d, 'truth.json'); t = json.load(open(tp, encoding='utf-8')); bc = t['barcode']
    O = H.decode_frames(os.path.join(d, 'ours_exact.mp4')); frames = []
    for i, f in enumerate(O):
        frames.append(f); g = f.copy(); BC.draw(g, 512 + i, **bc); frames.append(g)
    write_video(os.path.join(d, 'ours_60fps.mp4'), frames, t['W'], t['H'], 60, audio='sine=frequency=880:sample_rate=48000:duration=10', crf=14)
    t['ours_60fps'] = {'fps': 60, 'frames': 2 * len(O), 'pairing': 'our frame 2i ↔ reference frame i; odd frames carry barcode 512+i'}
    save(d, t)
    return d


def look_decode():
    """look.py's decode, exact and width-independent (QA1, 2026-10-22: 2 code values darker at 1928 wide than at 1920):
    five flat stripes with KNOWN YUV values, lossless H.264 (qp 0, BT.709 tags, limited range), at 1920x1080 and 1928x1076.
    truth.json holds the exact-BT.709 numbers (lib/exactdecode.py + today's look_stats formulas)."""
    d = os.path.join(HERE, 'look_decode')
    if os.path.exists(d): shutil.rmtree(d)
    os.makedirs(d)
    Ys, CbCr = [45, 80, 110, 150, 190], [(128, 128), (118, 140), (112, 148), (140, 116), (128, 128)]
    truth = {'stripes_Y': Ys, 'stripes_CbCr': CbCr, 'clips': {}}
    for W, H_ in ((1920, 1080), (1928, 1076)):
        fr = [.15, .20, .30, .20]; xs = [0]
        for f in fr: xs.append(xs[-1] + int(round(f * W / 2.0)) * 2)
        xs.append(W)
        Y = np.zeros((H_, W), np.uint8); U = np.zeros((H_ // 2, W // 2), np.uint8); V = np.zeros_like(U)
        for k in range(5):
            Y[:, xs[k]:xs[k + 1]] = Ys[k]; U[:, xs[k] // 2:xs[k + 1] // 2] = CbCr[k][0]; V[:, xs[k] // 2:xs[k + 1] // 2] = CbCr[k][1]
        frame = Y.tobytes() + U.tobytes() + V.tobytes()
        name = 'stripes_%dx%d.mp4' % (W, H_)
        # tags via setparams only (output tag options make ffmpeg convert the pixels — width-dependently); planes must round-trip
        ff(['-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-s', '%dx%d' % (W, H_), '-framerate', '30', '-i', 'pipe:0',
            '-vf', 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv', '-c:v', 'libx264', '-qp', '0', '-pix_fmt', 'yuv420p', os.path.join(d, name)], stdin=frame * 60)
        back = subprocess.run([FF, '-v', 'error', '-i', os.path.join(d, name), '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-'], capture_output=True).stdout
        if back != frame: raise RuntimeError('%s: the YUV planes did not round-trip losslessly' % name)
        import exactdecode as XD
        st, n = XD.clip_stats(os.path.join(d, name), XD.even_times(os.path.join(d, name), 4))
        truth['clips'][name] = {'W': W, 'H': H_, 'stripe_x': xs, 'exact': st}
    save(d, truth)
    return d


GROUPS = dict(phone24=phone24, cadence=cadence, cuts30=cuts30, cuts30_60fps=cuts30_60fps, clicks=clicks, films=films, track=track, look=look, look_decode=look_decode, fal=fal)

if __name__ == '__main__':
    want = sys.argv[1:] or list(GROUPS)
    for g in want:
        t0 = __import__('time').time()
        GROUPS[g]()
        print('fixture %-8s built in %.1fs' % (g, __import__('time').time() - t0), flush=True)
