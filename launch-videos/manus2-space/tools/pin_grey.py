#!/usr/bin/env python3
"""Pin a reference sheet's background to the project grey (#8a8a8a), so every sheet matches (ad-asset-prep: one exact
hex per project). Per panel: flood-fill the grey from the panel's corners, fit a smooth background surface to it
(quadratic; flat when the panel has under 15% background), then move each pixel by (138 - surface), weighted 1 within
14 levels of the surface and 0 beyond 24, so the subject is untouched and gradients in the generated grey are flattened.

  python3 pin_grey.py SHEET.png OUT.png --cols X1,X2 [--rows Y1]     gutter centres in px (thin near-white lines)
"""
import argparse, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

TARGET = 138.0   # #8a8a8a


def boxes(W, H, xs, ys, pad=5):
    bx = [0] + [v for x in xs for v in (x - pad, x + pad)] + [W]
    by = [0] + [v for y in ys for v in (y - pad, y + pad)] + [H]
    X = [(bx[i], bx[i + 1]) for i in range(0, len(bx), 2)]
    Y = [(by[i], by[i + 1]) for i in range(0, len(by), 2)]
    return [(x0, y0, x1, y1) for (y0, y1) in Y for (x0, x1) in X]


def seedmask(tile):
    probe = tile.copy()
    w, h = tile.size
    for s in [(8, 8), (w - 9, 8), (8, h - 9), (w - 9, h - 9), (w // 2, 8), (8, h // 2), (w - 9, h // 2)]:
        px = np.array(probe.getpixel(s)).astype(int)
        if (px == [255, 0, 255]).all():
            continue
        if np.abs(px - px.mean()).max() < 10 and 100 < px.mean() < 170:      # seed only on neutral grey
            ImageDraw.floodfill(probe, s, (255, 0, 255), thresh=10)
    return (np.asarray(probe).astype(int) == [255, 0, 255]).all(2)


def design(xx, yy, w, h):
    u, v = xx / w - .5, yy / h - .5
    return np.stack([np.ones_like(u), u, v, u * u, v * v, u * v], -1)


def pin(src, dst, xs, ys):
    im = Image.open(src).convert('RGB')
    W, H = im.size
    a = np.asarray(im).astype(float)
    out = a.copy()
    wmap = np.zeros((H, W))
    rep = []
    for (x0, y0, x1, y1) in boxes(W, H, xs, ys):
        sub = a[y0:y1, x0:x1]
        h, w = sub.shape[:2]
        m = seedmask(im.crop((x0, y0, x1, y1)))
        if m.sum() < 500:
            rep.append([x0, y0, x1, y1, 'too little background: unchanged'])
            continue
        if m.mean() < 0.15:
            model, kind = np.broadcast_to(np.median(sub[m], 0), sub.shape).copy(), 'flat'
        else:
            yy, xx = np.nonzero(m)
            k = np.random.RandomState(0).choice(len(yy), min(40000, len(yy)), replace=False)
            A = design(xx[k].astype(float), yy[k].astype(float), w, h)
            Yg, Xg = np.mgrid[0:h, 0:w]
            D = design(Xg.astype(float), Yg.astype(float), w, h)
            model = np.zeros_like(sub)
            for c in range(3):
                coef, *_ = np.linalg.lstsq(A, sub[yy[k], xx[k], c], rcond=None)
                model[..., c] = D @ coef
            model = np.clip(model, np.percentile(sub[m], 1, axis=0) - 6, np.percentile(sub[m], 99, axis=0) + 6)
            kind = 'surface'
        r = np.abs(sub - model).max(2)
        wt = np.clip((24 - r) / 10, 0, 1)
        wt = np.asarray(Image.fromarray((wt * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))).astype(float) / 255
        out[y0:y1, x0:x1] = sub + (TARGET - model) * wt[..., None]
        wmap[y0:y1, x0:x1] = wt
        rep.append([int(x0), int(y0), int(x1), int(y1), '%s %d..%d -> 138, background %d%% of panel'
                    % (kind, model.mean(2).min(), model.mean(2).max(), round(100 * m.mean()))])
    final = Image.fromarray(np.clip(out, 0, 255).round().astype(np.uint8))
    final.save(dst)
    f = np.asarray(final).astype(float)
    bg = wmap > 0.99
    return {'src': src, 'panels': rep, 'bg_after_mean': round(float(f[bg].mean()), 1),
            'bg_after_std': round(float(f[bg].mean(1).std()), 1)}


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--cols', default='')
    ap.add_argument('--rows', default='')
    a = ap.parse_args()
    ints = lambda s: [int(v) for v in s.split(',') if v]
    print(json.dumps(pin(a.src, a.dst, ints(a.cols), ints(a.rows)), indent=1))
