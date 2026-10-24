#!/usr/bin/env python3
"""Finish The Lull the way hf01 is finished (hf01-study/CUTS-MOTION.md §1, OVERLAY-SPEC.md §2, SOUND.md §3):

1. **24p in 30p.** hf01 is a 24 fps edit shown at 30 fps: output frame n repeats n-1 when n % 15 in {5, 10, 14}
   (master index m(n) = 12*(n div 15) + r - [r>=5] - [r>=10] - [r>=14]). The engine renders 60 fps; 24p frame m is taken
   at 60 fps index ceil(2.5*m) (on or just after m/24, so a 24 fps footage plate shows its own frame m), and the 30p file
   is built by index: out[n] = master[m(n)]. Every cut and every judder step lands on hf01's frame.
2. **The corner bug on hf01's own clock.** The official white Manus mark + wordmark (no handle: unconfirmed) with a soft
   dark halo, TR <-> BL every 270 frames (switch s = 266 + 270k), hf01's fade-out (9 cf) and fade-in (11 cf) tables,
   built n6-n16, gone at the end-card cut n2175.
3. **The mix.** The engine's music stem (our score on hf01's grid, the sting 0.368 s into the end card) + our SFX layer
   (tools/sfx.py). No whoosh stem and no UI-cue stem: hf01 has neither. Two-pass loudnorm to -14 LUFS, -1 dBTP; AAC 320k.

  python3 finish.py [--master manus2-space-16x9.mp4] [--out manus2-space-final-16x9.mp4] [--no-wm]

Then QA: 2296 frames / 76.533 s, the repeat pattern measured on the output, loudness and true peak.
"""
import argparse, json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageFilter

JOB = os.path.expanduser('~/Downloads/launch-videos/manus2-space')
W, H, N = 1920, 1080, 2296
ML = [0, 1, 2, 3, 4, 4, 5, 6, 7, 8, 8, 9, 10, 11, 11]            # master frame within each block of 15 output frames
PICK = sorted({int(np.ceil(2.5 * m)) for m in range(12)})        # 60 fps indices per block of 30: 0 3 5 8 10 13 15 18 20 23 25 28

# ---- corner bug (hf01 §2), boxes at 1920x1080
GLYPH = {'TR': (1691, 137, 1783, 229), 'BL': (137, 603, 229, 695)}
TEXT = {'TR': (1492, 295, 1781, 331, 'right'), 'BL': (139, 761, 427, 796, 'left')}
FADE_OUT = {-5: .97, -4: .89, -3: .79, -2: .67, -1: .67, 0: .33, 1: .22, 2: .12, 3: .12, 4: .04, 5: 0.0}
FADE_IN = {6: .05, 7: .15, 8: .27, 9: .27, 10: .59, 11: .73, 12: .84, 13: .91, 14: .91, 15: .95, 16: .96, 17: .97, 18: .98, 19: .99}
SWITCH = [266 + 270 * k for k in range(8)]
END = 2175


def wm_state(n):
    """(place, glyph opacity, text opacity) for output frame n."""
    if n < 6 or n >= END:
        return None, 0, 0
    place, k = 'TR', 0
    for i, s in enumerate(SWITCH):
        if n > s + 5:
            place, k = ('BL' if i % 2 == 0 else 'TR'), i + 1
    op = 1.0
    for s in SWITCH:
        if s - 5 <= n <= s + 5:
            op = FADE_OUT[n - s]
        elif s + 6 <= n <= s + 19:
            op = FADE_IN[n - s]
    if n < 16:                                     # intro build: the glyph n6-n9, the wordmark cuts on at n16
        return place, (0.5 if n < 9 else 1.0), 0.0
    return place, op, op


def sprite(path, box_w, box_h):
    im = np.asarray(Image.open(path).convert('L')).astype(np.float32) / 255
    ys, xs = np.nonzero(im > 0.04)
    im = im[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = im.shape
    s = min(box_w / w, box_h / h)
    a = Image.fromarray((im * 255).astype(np.uint8)).resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    pad = 14
    big = Image.new('L', (a.width + 2 * pad, a.height + 2 * pad))
    big.paste(a, (pad, pad))
    halo = np.asarray(big.filter(ImageFilter.GaussianBlur(5))).astype(np.float32) / 255 * 0.45
    alpha = np.asarray(big).astype(np.float32) / 255
    return alpha, halo, pad


def place_sprites():
    g_a, g_h, gp = sprite(os.path.join(JOB, 'out/wm/manus-mark-white-chrome.png'), 92, 92)
    t_a, t_h, tp = sprite(os.path.join(JOB, 'out/wm/manus-wordmark-white-chrome.png'), 289, 36)
    out = {}
    for P in ('TR', 'BL'):
        x0, y0, x1, y1 = GLYPH[P]
        gx = (x1 if P == 'TR' else x0) - (g_a.shape[1] - 2 * gp if P == 'TR' else 0) - gp
        gy = y0 + (92 - (g_a.shape[0] - 2 * gp)) // 2 - gp
        tx0, ty0, tx1, ty1, al = TEXT[P]
        tw = t_a.shape[1] - 2 * tp
        tx = (tx1 - tw if al == 'right' else tx0) - tp
        ty = ty0 + (36 - (t_a.shape[0] - 2 * tp)) // 2 - tp
        out[P] = [(g_a, g_h, gx, gy, 'glyph'), (t_a, t_h, tx, ty, 'text')]
    return out


def composite(frame, sprites, place, og, ot):
    if not place:
        return frame
    f = frame.astype(np.float32)
    for a, h, x, y, kind in sprites[place]:
        o = og if kind == 'glyph' else ot
        if o <= 0:
            continue
        hh, ww = a.shape
        reg = f[y:y + hh, x:x + ww]
        reg *= (1 - h[..., None] * o)                               # the soft dark halo
        reg += (255 - reg) * (a[..., None] * o)                     # white ink
        f[y:y + hh, x:x + ww] = reg
    return np.clip(f, 0, 255).astype(np.uint8)


def m_of(n):
    """hf01's 24p master index of output frame n (CUTS-MOTION.md §1)."""
    q, r = divmod(n, 15)
    return 12 * q + ML[r]


def need_index(cuts):
    """60 fps master index for every output frame. The engine animates every shot (and samples its 24 fps plate, plate
    frame = 2·(f − start)//5) in the shot's own time from its first 60 fps frame start_k = 2·N_k, so the 24p pick is
    anchored there: j = start_k + ceil(2.5·(m(n) − m(N_k))) — one plate frame per edit frame, repeats only on hf01's
    slots. Anchoring to the film's grid instead (ceil(2.5·m(n))) put shots that start on an n % 15 == 4 cut out of phase
    (S03, S12, S15, S17, S19: plate 0,0,2,2,4,… = 12 fps judder; found by the skill-port fork with NCC, 10-23). Each
    sample is then clamped inside its shot's span [2·N_k, 2·N_k+1 − 1], so no frame before a cut reaches into the next
    shot (v0.1 without the clamp: 6 cuts a frame early)."""
    bounds = [0] + sorted(cuts) + [N]
    out = []
    for n in range(N):
        k = max(i for i in range(len(bounds) - 1) if bounds[i] <= n)
        a, b = bounds[k], bounds[k + 1]
        j = 2 * a + int(np.ceil(2.5 * (m_of(n) - m_of(a))))
        out.append(min(max(j, 2 * a), 2 * b - 1))
    return out


def video(master, out_v, use_wm, cuts):
    need = need_index(cuts)
    dec = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', master, '-an', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                           stdout=subprocess.PIPE)
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-r', '30',
                            '-i', '-', '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p',
                            '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', out_v],
                           stdin=subprocess.PIPE)
    sprites = place_sprites() if use_wm else None
    fsz = W * H * 3
    cur, j = None, -1                                             # the last decoded master frame and its index
    for n in range(N):
        while j < need[n]:
            buf = dec.stdout.read(fsz)
            if len(buf) < fsz:                                    # the master's very end: hold the last frame
                break
            cur, j = np.frombuffer(buf, np.uint8).reshape(H, W, 3), j + 1
        fr = composite(cur, sprites, *wm_state(n)) if sprites else cur
        enc.stdin.write(fr.tobytes())
    n = N
    enc.stdin.close()
    enc.wait()
    dec.stdout.close()
    dec.wait()
    return n


def audio(out_a):
    music = os.path.join(JOB, 'out/main/audio/music.wav')
    sfx = os.path.join(JOB, 'audio/sfx.wav')
    bed = os.path.join(JOB, 'audio/opening.wav')          # tools/opening_bed.py: the lifted opening (Alex 10-23)
    graph = '[0:a][1:a][2:a]amix=inputs=3:normalize=0:duration=first'
    r = subprocess.run(['ffmpeg', '-v', 'info', '-i', music, '-i', sfx, '-i', bed, '-filter_complex',
                        graph + ',loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True)
    js = json.loads(r.stderr[r.stderr.rindex('{'):r.stderr.rindex('}') + 1])
    # a linear gain to -14 LUFS, then a look-ahead limiter at -2.9 dBFS (AAC adds ~1.3 dB of true peak here) (4x oversampled true-peak check below): the
    # sting is the peak (hf01's own sting reaches +0.2 dBFS; we deliver at <= -1 dBTP like every skill master)
    gain = -14.0 - float(js['input_i']) + 0.9          # + what the limiter takes back (lands -14.5 LUFS, -2.0 dBTP after AAC)
    chain = graph + ',volume=%.2fdB,aresample=192000,alimiter=limit=0.70:attack=2:release=60:level=false,aresample=48000' % gain
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', music, '-i', sfx, '-i', bed, '-filter_complex', chain,
                    '-c:a', 'pcm_s24le', out_a], check=True)
    js['gain_db'] = round(gain, 2)
    return js


def mux(v, a, out):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', v, '-i', a, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac',
                    '-b:a', '320k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out], check=True)


def qa(out):
    p = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries',
                                   'stream=nb_read_frames,r_frame_rate,width,height:format=duration', '-of', 'json', out],
                                  capture_output=True, text=True).stdout)
    s = p['streams'][0]
    print('frames %s (want %d), %sx%s, %s fps, %.3f s' % (s['nb_read_frames'], N, s['width'], s['height'], s['r_frame_rate'], float(p['format']['duration'])))
    # the repeat pattern, measured on the output (small greyscale decode)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', out, '-vf', 'scale=240:136,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, 136, 240).astype(np.int16)
    d = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))
    rep = set(int(i + 1) for i in np.nonzero(d < 0.05)[0])
    want = set(n for n in range(1, len(fr)) if n % 15 in (5, 10, 14))
    print('repeats on hf01 slots: %d / %d; extra repeats (holds) %d; slots that changed %d' % (
        len(rep & want), len(want), len(rep - want), len(want - rep)))
    r = subprocess.run(['ffmpeg', '-v', 'info', '-i', out, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    tail = r[r.rindex('Summary'):]
    I = [l for l in tail.splitlines() if l.strip().startswith('I:')]
    P = [l for l in tail.splitlines() if l.strip().startswith('Peak:')]
    print('loudness %s, true peak %s' % (I[0].split(':', 1)[1].strip() if I else '?', P[0].split(':', 1)[1].strip() if P else '?'))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--master', default=os.path.join(JOB, 'manus2-space-16x9.mp4'))
    ap.add_argument('--out', default=os.path.join(JOB, 'manus2-space-final-16x9.mp4'))
    ap.add_argument('--no-wm', action='store_true')
    ap.add_argument('--cuts', default=os.path.expanduser('~/Downloads/launch-videos/hf01-study/cuts/cuts.txt'),
                    help='the film\'s cut frames (first frame of each new shot, one per line; # comments): our shots sit on these')
    a = ap.parse_args()
    tmp_v, tmp_a = os.path.join(JOB, 'out/final-video.mp4'), os.path.join(JOB, 'out/final-mix.wav')
    cuts = [int(l.split()[0]) for l in open(a.cuts) if l.strip() and not l.lstrip().startswith('#')]
    n = video(a.master, tmp_v, not a.no_wm, cuts)
    print('video: %d frames on the 24p-in-30p cadence' % n)
    js = audio(tmp_a)
    print('mix in: I %s LUFS, TP %s dBTP; gain %+.2f dB + limiter' % (js['input_i'], js['input_tp'], js['gain_db']))
    mux(tmp_v, tmp_a, a.out)
    qa(a.out)
    print('->', a.out)
