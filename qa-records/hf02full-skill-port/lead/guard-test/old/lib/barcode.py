# -*- coding: utf-8 -*-
# Frame-index barcode burnt into fixture frames: [white calib][bits MSB..LSB][grey calib], grey blocks only (survives
# yuv420p chroma subsampling, scaling and mild grading). decode() returns the index, or None when a block sits between
# the two calibration levels (a blended / interpolated frame) or the code is unreadable.
import numpy as np

HI, LO = 235, 100


def layout(nbits, x0, y0, block, gap):
    step = block + gap
    return [(x0 + i * step, y0) for i in range(nbits + 2)]


def draw(rgb, value, nbits=10, x0=0, y0=0, block=20, gap=4):
    bits = [(value >> (nbits - 1 - i)) & 1 for i in range(nbits)]
    levels = [HI] + [HI if b else LO for b in bits] + [LO]
    for (x, y), lv in zip(layout(nbits, x0, y0, block, gap), levels):
        rgb[y:y + block, x:x + block, :] = lv
    return rgb


def width(nbits, block=20, gap=4):
    return (nbits + 2) * (block + gap) - gap


def decode(frame, nbits=10, x0=0, y0=0, block=20, gap=4, sx=1.0, sy=1.0, ox=0.0, oy=0.0, tol=.28):
    """frame: HxW (luma) or HxWx3; geometry in SOURCE pixels, mapped by x' = x*sx + ox, y' = y*sy + oy"""
    f = frame.astype(np.float64)
    if f.ndim == 3: f = f[..., 0] * .2126 + f[..., 1] * .7152 + f[..., 2] * .0722
    H, W = f.shape
    vals = []
    for (x, y) in layout(nbits, x0, y0, block, gap):
        cx, cy = (x + block / 2.0) * sx + ox, (y + block / 2.0) * sy + oy
        r = max(1, int(block * min(sx, sy) * .25))
        xa, xb, ya, yb = int(round(cx - r)), int(round(cx + r)), int(round(cy - r)), int(round(cy + r))
        if xa < 0 or ya < 0 or xb > W or yb > H: return None
        vals.append(f[ya:yb, xa:xb].mean())
    hi, lo = vals[0], vals[-1]
    if hi - lo < 40: return None
    v = 0
    for x in vals[1:-1]:
        t = (x - lo) / (hi - lo)
        if abs(t - 1) <= tol: b = 1
        elif abs(t) <= tol: b = 0
        else: return None
        v = (v << 1) | b
    return v
