# -*- coding: utf-8 -*-
# Pin an app screen onto the black phone screen in a generated clip, then grade, conform (24 -> 30 fps by repeated frames,
# like the reference's edit) and trim. numpy + PIL only (no cv2/scipy on this Mac).
#   python3 -E tools/fal/carousel_pin.py <in.mp4> <screen.png> <out.mp4> <frames> <start_s> "<ffmpeg grade filters>"
# Tracking: frame 0 picks the most phone-like near-black region (rectangular, portrait, 2-30 % of the frame); later frames
# regrow it inside the dark mask from the previous region, boxed to its neighbourhood. Corners = the region's diagonal
# extremes, pushed out 4 % to cover the rounded corners, smoothed over 3 frames. The screen shows only where the phone is
# black, so fingers over the glass stay in front. Writes <out>-track.png with the tracked corners for review.
import sys, subprocess, math
import numpy as np
from PIL import Image, ImageDraw

src, screen_png, out, frames, start, grade = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), float(sys.argv[5]), sys.argv[6]
W, H = 720, 1290                                                   # processing size (the card shows ~500x885 in the film)
N24 = int(math.ceil(frames / 30 * 24)) + 3
raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', '%.3f' % start, '-i', src, '-an', '-vf', 'scale=%d:%d:flags=lanczos' % (W, H),
                      '-frames:v', str(N24), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
F = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
DARK = 24

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
    return shift_or(shift_and(y < DARK, 2), 2)                      # opening: drops thin dark lines and specks
def label(m):                                                       # 4-connected components on a small mask (union-find)
    h, w = m.shape; lab = np.zeros((h, w), np.int32); par = [0]
    def find(a):
        while par[a] != a: par[a] = par[par[a]]; a = par[a]
        return a
    for i in range(h):
        for j in range(w):
            if not m[i, j]: continue
            up = lab[i - 1, j] if i else 0; lf = lab[i, j - 1] if j else 0
            if up and lf:
                a, b = find(up), find(lf); lab[i, j] = min(a, b); par[max(a, b)] = min(a, b)
            elif up or lf: lab[i, j] = up or lf
            else: par.append(len(par)); lab[i, j] = len(par) - 1
    for k in range(len(par)): par[k] = find(k)
    return np.array(par)[lab]
def pick_phone(m):
    small = m[::4, ::4]; lab = label(small); best, bs = None, 0
    for k in np.unique(lab[lab > 0]):
        ys, xs = np.nonzero(lab == k); a = len(ys) * 16; bw = (xs.max() - xs.min() + 1) * 4; bh = (ys.max() - ys.min() + 1) * 4
        rect, asp, frac = a / (bw * bh), bh / max(bw, 1), a / (W * H)
        if not (0.02 < frac < 0.30 and 1.35 < asp < 2.8 and rect > 0.6): continue
        s = a * rect
        if s > bs: bs, best = s, k
    if best is None: raise SystemExit('no phone-like black screen found in the first frame of ' + src)
    reg = np.kron(lab == best, np.ones((4, 4), bool))[:H, :W]
    return regrow(m, reg)
def regrow(m, prev):                                                # geodesic regrowth inside the dark mask, boxed near prev
    ys, xs = np.nonzero(prev); y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max(); py, px = int((y1 - y0) * .15) + 6, int((x1 - x0) * .15) + 6
    box = np.zeros_like(m); box[max(0, y0 - py):y1 + py, max(0, x0 - px):x1 + px] = True
    lim = m & box; g = shift_and(prev, 3) & lim
    if not g.any(): g = prev & lim
    for _ in range(400):
        n = shift_or(g, 4) & lim
        if n.sum() == g.sum(): break
        g = n
    return g
def corners(reg):
    ys, xs = np.nonzero(reg); s, d = xs + ys, xs - ys
    q = np.array([[xs[s.argmin()], ys[s.argmin()]], [xs[d.argmax()], ys[d.argmax()]], [xs[s.argmax()], ys[s.argmax()]], [xs[d.argmin()], ys[d.argmin()]]], float)
    c = q.mean(0); return c + (q - c) * 1.04                        # TL, TR, BR, BL, pushed out to cover the rounded corners
def persp_coeffs(dst, srcpts):                                      # PIL PERSPECTIVE maps output (x,y) -> input (u,v)
    A, b = [], []
    for (x, y), (u, v) in zip(dst, srcpts):
        A += [[x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]]; b += [u, v]
    return np.linalg.solve(np.array(A, float), np.array(b, float))

regs, quads = [], []
for i, fr in enumerate(F):
    m = dark_mask(fr.astype(np.float32))
    reg = pick_phone(m) if i == 0 else regrow(m, regs[-1])
    if reg.sum() < 0.4 * regs[0].sum() if regs else False: reg = regs[-1]   # lost it (occlusion/blur): hold the last region
    regs.append(reg); quads.append(corners(reg))
Q = np.array(quads); Qs = Q.copy()
for i in range(len(Q)): Qs[i] = Q[max(0, i - 1):i + 2].mean(0)       # 3-frame smoothing
scr = Image.open(screen_png).convert('RGBA'); sw, sh = scr.size; S = [(0, 0), (sw, 0), (sw, sh), (0, sh)]
p = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-framerate', '24', '-i', '-',
                      '-vf', 'fps=30:round=near' + (',' + grade if grade else '') + ',setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,format=yuv420p',
                      '-frames:v', str(frames), '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
for i, fr in enumerate(F):
    warped = scr.transform((W, H), Image.PERSPECTIVE, tuple(persp_coeffs(Qs[i], S)), Image.BICUBIC, fillcolor=(0, 0, 0, 0))
    wa = np.asarray(warped, np.float32) / 255.0
    soft = regs[i].astype(np.float32); soft = (soft + np.roll(soft, 1, 0) + np.roll(soft, -1, 0) + np.roll(soft, 1, 1) + np.roll(soft, -1, 1)) / 5
    a = (soft * wa[..., 3] * 0.97)[..., None]
    comp = fr.astype(np.float32) * (1 - a) + wa[..., :3] * 255 * 0.94 * a
    p.stdin.write(np.clip(comp, 0, 255).astype(np.uint8).tobytes())
p.stdin.close(); assert p.wait() == 0
dbg = Image.fromarray(np.concatenate([F[0], F[len(F) // 2], F[-1]], 1)); d = ImageDraw.Draw(dbg)
for k, idx in enumerate([0, len(F) // 2, len(F) - 1]):
    pts = [(x + k * W, y) for x, y in Qs[idx]]; d.line(pts + [pts[0]], fill=(255, 40, 40), width=4)
dbg.resize((dbg.width // 3, dbg.height // 3)).save(out.replace('.mp4', '-track.png'))
print('wrote %s (%d source frames tracked, screen area %.1f%% of frame)' % (out, len(F), 100 * regs[0].mean()))
