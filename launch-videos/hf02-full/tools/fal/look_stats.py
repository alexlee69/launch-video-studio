# -*- coding: utf-8 -*-
# Measures the "look" of footage frames: tonal range, saturation, grain, sharpness, warm/cool split. numpy + PIL only.
import sys, glob, json
import numpy as np
from PIL import Image
def blur(a, s):
    r = int(3 * s + 0.5); x = np.arange(-r, r + 1); k = np.exp(-x * x / (2 * s * s)); k /= k.sum()
    a = np.apply_along_axis(lambda v: np.convolve(np.pad(v, r, mode='edge'), k, 'valid'), 1, a)
    return np.apply_along_axis(lambda v: np.convolve(np.pad(v, r, mode='edge'), k, 'valid'), 0, a)
def stats(path, crop=None):
    im = Image.open(path).convert('RGB')
    if crop: im = im.crop(crop)
    im = im.resize((960, int(960 * im.height / im.width)), Image.LANCZOS)
    rgb = np.asarray(im, dtype=np.float64)
    R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    Y = 0.2126 * R + 0.7152 * G + 0.0722 * B
    mx, mn = rgb.max(2), rgb.min(2); S = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    hf = Y - blur(Y, 1.2)                                   # fine detail + noise
    gy, gx = np.gradient(blur(Y, 2.0)); flat = np.hypot(gx, gy) < 0.6   # smooth areas: what's left there is grain
    lap = Y[1:-1, 1:-1] * -4 + Y[:-2, 1:-1] + Y[2:, 1:-1] + Y[1:-1, :-2] + Y[1:-1, 2:]
    sh, hi = Y < np.percentile(Y, 20), Y > np.percentile(Y, 80)
    return dict(p2=np.percentile(Y, 2), p50=np.percentile(Y, 50), p98=np.percentile(Y, 98), dark=(Y < 40).mean() * 100,
                sat=S.mean() * 100, grain=hf[flat].std() if flat.any() else float('nan'), sharp=lap.var() ** 0.5,
                warm_sh=(R - B)[sh].mean(), warm_hi=(R - B)[hi].mean())
def report(label, paths, crop=None):
    rows = [stats(p, crop) for p in paths]
    m = {k: float(np.nanmean([r[k] for r in rows])) for k in rows[0]}
    print('%-34s blacks p2 %5.1f | mid p50 %5.1f | whites p98 %5.1f | <40 luma %4.1f%% | sat %4.1f | grain %4.2f | sharpness %5.1f | R-B shadows %+6.1f highlights %+6.1f'
          % (label, m['p2'], m['p50'], m['p98'], m['dark'], m['sat'], m['grain'], m['sharp'], m['warm_sh'], m['warm_hi']))
    return m
if __name__ == '__main__':
    ref = '/Users/bytedance/Downloads/launch-videos/hf02-full/ref/frames/n%04d.png'
    # crops avoid the reference's watermark corner and the prompt bar
    report('reference plate 1 (n130-260)', [ref % n for n in range(130, 261, 13)], crop=(0, 0, 760, 400))
    report('reference plate 2 (n1560-1625)', [ref % n for n in range(1560, 1626, 13)], crop=(260, 0, 1080, 380))
    report('our H3 clip (vector-draft guided)', sorted(glob.glob(sys.argv[1] + '/ours_*.png')), crop=(0, 0, 1350, 720))
    # frame cadence: share of frames identical to the previous one inside the plate (no UI region)
    def g(n): return np.asarray(Image.open(ref % n).convert('L').crop((0, 0, 700, 380)).resize((350, 190)), dtype=np.float64)
    prev, dup = g(112), []
    for n in range(113, 230):
        cur = g(n); d = np.abs(cur - prev).mean(); prev = cur
        if d < 0.35: dup.append(n)
    gaps = np.diff(dup)
    print('reference plate 1 repeated frames n113-229: %d of 117 (%s), spacing %s' % (len(dup), dup[:12], sorted(set(gaps.tolist()))))
