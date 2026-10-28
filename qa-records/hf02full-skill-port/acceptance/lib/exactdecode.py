# -*- coding: utf-8 -*-
# Decoder-independent look oracle: take the raw yuv420p planes from the H.264 decoder (bit-exact by spec) and convert
# them to RGB with the exact BT.709 matrix in numpy (limited range unless the stream says full), nearest chroma
# upsampling. Rec.709 luma of the result equals Y' itself, so p10/p50/p90/shadow don't depend on any RGB converter.
# Then today's look_stats.py formulas (oracle/today/look_stats.py) measure it.
import os, sys, json, subprocess, tempfile
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness as H

_G = {}


def _stats_fn():
    if not _G:
        src = open(os.path.join(H.ACC, 'oracle', 'today', 'look_stats.py'), encoding='utf-8').read().split("if __name__ == '__main__':")[0]
        exec(compile(src, 'look_stats.py', 'exec'), _G)
    return _G['stats']


def probe(path):
    j = H.ffprobe_json(path); v = [s for s in j.get('streams', []) if s.get('codec_type') == 'video'][0]
    return int(v['width']), int(v['height']), v.get('pix_fmt'), v.get('color_range'), float(j['format']['duration'])


def yuv_at(path, t, W, H_):
    raw = subprocess.run([H.FFMPEG, '-v', 'error', '-ss', '%.4f' % t, '-i', path, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-'], capture_output=True).stdout
    n = W * H_; cw, ch = (W + 1) // 2, (H_ + 1) // 2
    if len(raw) < n + 2 * cw * ch: return None
    Y = np.frombuffer(raw[:n], np.uint8).reshape(H_, W)
    U = np.frombuffer(raw[n:n + cw * ch], np.uint8).reshape(ch, cw); V = np.frombuffer(raw[n + cw * ch:n + 2 * cw * ch], np.uint8).reshape(ch, cw)
    return Y, U, V


def bt709_rgb(Y, U, V, full=False):
    H_, W = Y.shape
    U = np.repeat(np.repeat(U, 2, 0), 2, 1)[:H_, :W].astype(np.float64); V = np.repeat(np.repeat(V, 2, 0), 2, 1)[:H_, :W].astype(np.float64)
    y = Y.astype(np.float64)
    if full: yp, pb, pr = y / 255.0, (U - 128) / 255.0, (V - 128) / 255.0
    else: yp, pb, pr = (y - 16) / 219.0, (U - 128) / 224.0, (V - 128) / 224.0
    R = yp + 1.5748 * pr; G = yp - 0.187324 * pb - 0.468124 * pr; B = yp + 1.8556 * pb
    return np.clip(np.round(np.stack([R, G, B], -1) * 255), 0, 255).astype(np.uint8)


def frame_stats(path, t, W, H_, full):
    p = yuv_at(path, t, W, H_)
    if p is None: return None
    rgb = bt709_rgb(*p, full=full)
    d = tempfile.mkdtemp(prefix='acc-exact-'); f = os.path.join(d, 'f.png')
    Image.fromarray(rgb).save(f)
    s = _stats_fn()(f)
    im = Image.open(f).convert('RGB'); im = im.resize((960, int(960 * im.height / im.width)), Image.LANCZOS)
    a = np.asarray(im, np.float64); Yl = .2126 * a[..., 0] + .7152 * a[..., 1] + .0722 * a[..., 2]
    os.remove(f); os.rmdir(d)
    return {'p10': float(np.percentile(Yl, 10)), 'p50': s['p50'], 'p90': float(np.percentile(Yl, 90)), 'shadow': s['dark'], 'sat': s['sat'], 'sharp': s['sharp'],
            'grain': s['grain'], 'warm_sh': s['warm_sh'], 'warm_hi': s['warm_hi']}


def clip_stats(path, times):
    """mean of the exact-decode stats over the given times (seconds)"""
    W, H_, pf, rng, dur = probe(path)
    rows = [r for r in (frame_stats(path, t, W, H_, rng == 'pc') for t in times) if r]
    return {k: float(np.nanmean([r[k] for r in rows])) for k in rows[0]}, len(rows)


def even_times(path, n=12, a=0.0, b=None):
    dur = probe(path)[4]; b = dur if b is None else b
    return [a + (i + .5) * (b - a) / n for i in range(n)]
