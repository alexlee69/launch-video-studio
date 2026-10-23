# -*- coding: utf-8 -*-
# Frame-exact side-by-side: frame n = source n (left) | ours n (right), composed in Python and piped as rawvideo,
# because ffmpeg hstack re-times this source's irregular timestamps and slips frames. Then decodes the result and checks
# every frame against thumbnails saved while composing.
# usage: python3 -E tools/sbs_full.py <ours_dir> <out.mp4> [audio.wav] [--from a --to b] [--label "ours"]
import sys, os, subprocess, numpy as np
from multiprocessing import Pool
from PIL import Image, ImageDraw, ImageFont
J = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = sys.argv[1:]
def opt(k, d=None):
    return args[args.index(k) + 1] if k in args else d
pos = [a for i, a in enumerate(args) if not a.startswith('--') and (i == 0 or not args[i - 1].startswith('--'))]
ours_dir, out = pos[0], pos[1]; audio = pos[2] if len(pos) > 2 else None
a, b = int(opt('--from', 0)), int(opt('--to', 1908)); label = opt('--label', 'ours')
REF = os.path.join(J, 'ref', 'frames')
W, H, TW, TH = 960, 540, 192, 108
F = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 26)
def tag(d, x, txt):
    w = d.textlength(txt, font=F); d.rectangle((x + 16, 14, x + 16 + w + 28, 58), fill=(0, 0, 0)); d.text((x + 30, 22), txt, font=F, fill=(255, 255, 255))
def compose(n):
    L = Image.open(os.path.join(REF, 'n%04d.png' % n)).convert('RGB').resize((W, H), Image.BILINEAR)
    R = Image.open(os.path.join(ours_dir, 'n%04d.png' % n)).convert('RGB').resize((W, H), Image.BILINEAR)
    th = [np.asarray(im.convert('L').resize((TW, TH), Image.BILINEAR), dtype=np.uint8)[40:] for im in (L, R)]  # below the labels
    f = Image.new('RGB', (2 * W, H)); f.paste(L, (0, 0)); f.paste(R, (W, 0)); d = ImageDraw.Draw(f)
    tag(d, 0, 'source'); tag(d, W, label)
    return f.tobytes(), th[0], th[1]
if __name__ == '__main__':
    N = b - a + 1
    cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (2 * W, H), '-framerate', '30', '-i', '-']
    if audio: cmd += ['-ss', '%.6f' % (a / 30), '-t', '%.6f' % (N / 30), '-i', audio]
    cmd += ['-map', '0:v'] + (['-map', '1:a', '-c:a', 'aac', '-b:a', '192k'] if audio else []) + \
           ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    thL, thR = [], []
    with Pool(6) as pool:
        for buf, tl, tr in pool.imap(compose, range(a, b + 1), chunksize=4):
            p.stdin.write(buf); thL.append(tl); thR.append(tr)
    p.stdin.close(); assert p.wait() == 0, 'ffmpeg failed'
    # verify: decode and match each frame's halves to the thumbnails (exact index must beat its neighbours)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', out, '-vf', 'scale=%d:%d' % (2 * TW, TH), '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, TH, 2 * TW).astype(np.float32)[:, 40:]
    def ncc(x, y):
        x = x - x.mean(); y = y.astype(np.float32); y = y - y.mean(); return float((x * y).sum() / (np.sqrt((x * x).sum() * (y * y).sum()) + 1e-6))
    bad = []
    for i in range(len(fr)):
        for side, th, sl in (('L', thL, slice(0, TW)), ('R', thR, slice(TW, 2 * TW))):
            s = {j: ncc(fr[i][:, sl], th[j]) for j in (i - 1, i, i + 1) if 0 <= j < N}
            best = max(s, key=s.get)
            if best != i and s[best] - s[i] > 0.002: bad.append((a + i, side, a + best))
    print('wrote %s: %d frames (expected %d); frame-lock mismatches: %d %s' % (out, len(fr), N, len(bad), bad[:10]))
