# -*- coding: utf-8 -*-
# Put the app's screen on a phone held in generated footage, then grade and conform it like conform.py (native speed, the
# clip's 24 fps put on --fps by repeating frames, exactly --frames frames, BT.709, no audio). numpy + Pillow only.
#   python3 pin.py <in> <screen.png> <out.mp4> --frames N [--fps 30] [--start S] [--size WxH] [--grade "…"] [--dark 24]
#                  [--track-png PATH] [--crf 15]
# The phone must show a black screen (prompt the model: "the screen stays completely black the whole time"), upright,
# 2–30 % of the frame. Tracking: frame 0 picks the most phone-like near-black region (luma < --dark, rectangular, portrait;
# union-find on a 1/4-size mask); later frames regrow it geodesically inside the dark mask from the previous region, boxed
# to its neighbourhood (an occluded or blurred frame holds the last region). Corners = the region's diagonal extremes,
# pushed out 4 % over the rounded corners, smoothed over 3 frames; the screen is warped onto them (PIL PERSPECTIVE) and
# shows only where the phone is black, so fingers over the glass stay in front. Works at --size (cover-cropped) or, by
# default, the clip scaled to 720 px on its short side. Writes <out>-track.png: frames first / middle / last with the corners.
# Exit codes: 0 written · 2 bad arguments, an unreadable clip, or a clip too short for N frames from --start · 3 no
# phone-like black screen in the first frame (advice printed) · 1 ffmpeg failed.
import argparse, math, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.dont_write_bytecode = True   # no __pycache__ in the skill
from _media import die, run, probe, fps_arg, fps_str, num, size_arg, cover, cadence, BT709
import numpy as np
from PIL import Image, ImageDraw

ap = argparse.ArgumentParser(description='Pin a screen PNG onto the black phone screen in a clip, then grade + conform.')
ap.add_argument('src'); ap.add_argument('screen'); ap.add_argument('out')
ap.add_argument('--frames', type=int, required=True); ap.add_argument('--fps', default='30')
ap.add_argument('--start', type=float, default=0.0); ap.add_argument('--size'); ap.add_argument('--grade', default='')
ap.add_argument('--dark', type=float, default=24, help='luma below which the screen counts as black (raise for a dark-grey screen)')
ap.add_argument('--track-png'); ap.add_argument('--crf', type=int, default=15)
a = ap.parse_args()
info = probe(a.src)
if not info or not info['fps']:
    die(2, '%s: ffprobe finds no video in it (missing, not a video, or still downloading — gen.mjs fetch resumes it)' % a.src)
if not os.path.isfile(a.screen):
    die(2, '%s: no such screen image (render one with screen.mjs, or use the product\'s official screenshot)' % a.screen)
if os.path.splitext(a.out)[1].lower() not in ('.mp4', '.mov', '.m4v'):
    die(2, '%s: the output is an H.264 movie — name it .mp4' % a.out)
if a.frames < 1 or a.start < 0 or not 0 <= a.crf <= 51 or not 0 < a.dark < 255:
    die(2, '--frames must be ≥ 1, --start ≥ 0, --crf 0–51 and --dark 1–254')
FPS, SRC = fps_arg(a.fps), info['fps']
if a.size:
    W, H = size_arg(a.size); fit = cover(W, H)
else:                                               # the clip at 720 px on its short side (today's 1076x1928 → 720x1290)
    s = min(720, info['w'], info['h']); even = lambda x: max(2, 2 * int(round(x / 2.0)))
    W, H = (s, even(s * info['h'] / info['w'])) if info['w'] <= info['h'] else (even(s * info['w'] / info['h']), s)
    W, H = even(W), even(H); fit = 'scale=%d:%d:flags=lanczos' % (W, H)
N24 = int(math.ceil(a.frames / float(FPS) * float(SRC))) + 3
raw = run(['ffmpeg', '-v', 'error', '-ss', '%.3f' % a.start, '-i', a.src, '-an', '-vf', fit, '-frames:v', str(N24), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], 'ffmpeg (decode)')
F = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
have = int(math.floor(len(F) * float(FPS) / float(SRC) + 0.5))        # what fps=<FPS>:round=near makes of len(F) piped frames
if have < a.frames:                                 # source frames the shot needs vs what the clip has left after --start
    miss, lack = a.frames - have, int(math.ceil((a.frames - 0.5) * float(SRC) / float(FPS))) - len(F)
    t = math.floor((a.start - lack / float(SRC)) * 1000) / 1000.0
    die(2, '%s covers %d of the %d frames asked for from %.2f s at %s fps: %d frame%s (%.2f s) short.\n%s' % (
        a.src, have, a.frames, a.start, num(FPS), miss, '' if miss == 1 else 's', miss / float(FPS),
        ('Start earlier (--start %.3f or less), shorten the shot, or generate a longer clip (gen.mjs video --sec).' % t) if t >= 0 else
        'Even from 0 s it is too short: shorten the shot or generate a longer clip (gen.mjs video --sec).'))
DARK = a.dark


def shift_or(m, it):
    for _ in range(it):
        m = m | np.roll(m, 1, 0) | np.roll(m, -1, 0) | np.roll(m, 1, 1) | np.roll(m, -1, 1)
    return m


def shift_and(m, it):
    for _ in range(it):
        m = m & np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1)
    return m


def dark_mask(rgb):
    y = rgb[..., 0] * .2126 + rgb[..., 1] * .7152 + rgb[..., 2] * .0722
    return shift_or(shift_and(y < DARK, 2), 2)                          # opening: drops thin dark lines and specks


def label(m):                                                           # 4-connected components on a small mask (union-find)
    h, w = m.shape; lab = np.zeros((h, w), np.int32); par = [0]

    def find(x):
        while par[x] != x:
            par[x] = par[par[x]]; x = par[x]
        return x
    for i in range(h):
        for j in range(w):
            if not m[i, j]:
                continue
            up = lab[i - 1, j] if i else 0; lf = lab[i, j - 1] if j else 0
            if up and lf:
                p, q = find(up), find(lf); lab[i, j] = min(p, q); par[max(p, q)] = min(p, q)
            elif up or lf:
                lab[i, j] = up or lf
            else:
                par.append(len(par)); lab[i, j] = len(par) - 1
    for k in range(len(par)):
        par[k] = find(k)
    return np.array(par)[lab]


def pick_phone(m):
    small = m[::4, ::4]; lab = label(small); best, bs = None, 0
    for k in np.unique(lab[lab > 0]):
        ys, xs = np.nonzero(lab == k); ar = len(ys) * 16; bw = (xs.max() - xs.min() + 1) * 4; bh = (ys.max() - ys.min() + 1) * 4
        rect, asp, frac = ar / (bw * bh), bh / max(bw, 1), ar / (W * H)
        if not (0.02 < frac < 0.30 and 1.35 < asp < 2.8 and rect > 0.6):
            continue
        sc = ar * rect
        if sc > bs:
            bs, best = sc, k
    if best is None:
        die(3, 'no phone-like black screen in the first frame of %s (from %.2f s): pin.py looks for an upright, roughly rectangular\n'
            'near-black region (luma < %g) covering 2–30 %% of the frame. Generate the clip with the screen kept black (prompt:\n'
            '"the screen stays completely black the whole time", and for the still: "the screen completely black and switched off"),\n'
            'use a --start where the phone faces the camera, or raise --dark (e.g. 40) if the screen reads dark grey.' % (a.src, a.start, DARK))
    reg = np.kron(lab == best, np.ones((4, 4), bool))[:H, :W]
    return regrow(m, reg)


def regrow(m, prev):                                                    # geodesic regrowth inside the dark mask, boxed near prev
    ys, xs = np.nonzero(prev); y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max(); py, px = int((y1 - y0) * .15) + 6, int((x1 - x0) * .15) + 6
    box = np.zeros_like(m); box[max(0, y0 - py):y1 + py, max(0, x0 - px):x1 + px] = True
    lim = m & box; g = shift_and(prev, 3) & lim
    if not g.any():
        g = prev & lim
    for _ in range(400):
        n = shift_or(g, 4) & lim
        if n.sum() == g.sum():
            break
        g = n
    return g


def corners(reg):
    ys, xs = np.nonzero(reg); s, d = xs + ys, xs - ys
    q = np.array([[xs[s.argmin()], ys[s.argmin()]], [xs[d.argmax()], ys[d.argmax()]], [xs[s.argmax()], ys[s.argmax()]], [xs[d.argmin()], ys[d.argmin()]]], float)
    c = q.mean(0); return c + (q - c) * 1.04                            # TL, TR, BR, BL, pushed out to cover the rounded corners


def persp_coeffs(dst, srcpts):                                          # PIL PERSPECTIVE maps output (x,y) -> input (u,v)
    A, b = [], []
    for (x, y), (u, v) in zip(dst, srcpts):
        A += [[x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]]; b += [u, v]
    return np.linalg.solve(np.array(A, float), np.array(b, float))


regs, quads = [], []
for i, fr in enumerate(F):
    m = dark_mask(fr.astype(np.float32))
    reg = pick_phone(m) if i == 0 else regrow(m, regs[-1])
    if regs and reg.sum() < 0.4 * regs[0].sum():
        reg = regs[-1]                                                  # lost it (occlusion/blur): hold the last region
    regs.append(reg); quads.append(corners(reg))
Q = np.array(quads); Qs = Q.copy()
for i in range(len(Q)):
    Qs[i] = Q[max(0, i - 1):i + 2].mean(0)                              # 3-frame smoothing
scr = Image.open(a.screen).convert('RGBA'); sw, sh = scr.size; S = [(0, 0), (sw, 0), (sw, sh), (0, sh)]
os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
vf = 'fps=%s:round=near' % fps_str(FPS) + (',' + a.grade if a.grade else '') + ',' + BT709 + ',format=yuv420p'
p = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-framerate', fps_str(SRC), '-i', '-',
                      '-vf', vf, '-frames:v', str(a.frames), '-c:v', 'libx264', '-preset', 'slow', '-crf', str(a.crf), '-movflags', '+faststart', a.out],
                     stdin=subprocess.PIPE, stderr=subprocess.PIPE)
try:
    for i, fr in enumerate(F):
        warped = scr.transform((W, H), Image.PERSPECTIVE, tuple(persp_coeffs(Qs[i], S)), Image.BICUBIC, fillcolor=(0, 0, 0, 0))
        wa = np.asarray(warped, np.float32) / 255.0
        soft = regs[i].astype(np.float32); soft = (soft + np.roll(soft, 1, 0) + np.roll(soft, -1, 0) + np.roll(soft, 1, 1) + np.roll(soft, -1, 1)) / 5
        al = (soft * wa[..., 3] * 0.97)[..., None]
        comp = fr.astype(np.float32) * (1 - al) + wa[..., :3] * 255 * 0.94 * al
        p.stdin.write(np.clip(comp, 0, 255).astype(np.uint8).tobytes())
    p.stdin.close()
except BrokenPipeError:                                                 # ffmpeg had all --frames it needs and closed its input
    try:
        p.stdin.close()
    except BrokenPipeError:
        pass
err = p.stderr.read().decode('utf-8', 'replace'); p.stderr.close()
if p.wait() != 0:
    die(1, 'ffmpeg (encode) failed:\n' + err.strip())
track = a.track_png or os.path.splitext(a.out)[0] + '-track.png'
dbg = Image.fromarray(np.concatenate([F[0], F[len(F) // 2], F[-1]], 1)); d = ImageDraw.Draw(dbg)
for k, idx in enumerate([0, len(F) // 2, len(F) - 1]):
    pts = [(x + k * W, y) for x, y in Qs[idx]]; d.line(pts + [pts[0]], fill=(255, 40, 40), width=4)
dbg.resize((dbg.width // 3, dbg.height // 3)).save(track)
got = subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', a.out],
                     capture_output=True).stdout.decode().strip()
if got != str(a.frames):
    die(1, 'wrote %s but it has %s frames, not %d' % (a.out, got or '?', a.frames))
print('wrote %s: %d frames at %s fps (%dx%d) from %.2f s into %s — %d source frames tracked, screen %.1f%% of the frame' % (
    a.out, a.frames, num(FPS), W, H, a.start, os.path.basename(a.src), len(F), 100 * regs[0].mean()))
print('  %s%s%s · tracking sheet %s (check the red corners hug the screen on all three frames)' % (
    cadence(SRC, FPS), ' · audio dropped' if info['audio'] else '', ' · graded' if a.grade else '', track))
