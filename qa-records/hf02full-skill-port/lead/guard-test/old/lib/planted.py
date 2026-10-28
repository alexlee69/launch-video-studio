# -*- coding: utf-8 -*-
# Planted-bad (and a few known-good) artifacts for the self-test: each check must FAIL on its planted-bad input.
import os, sys, json, math, shutil, subprocess
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness as H

FF = H.FFMPEG
TAGS = 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,format=yuv420p'


def ff(args, stdin=None):
    p = subprocess.run([FF, '-y', '-v', 'error'] + args, input=stdin, capture_output=True)
    if p.returncode: raise RuntimeError(p.stderr.decode()[-600:])


def encode(frames, out, fps_in, n_out, fps_out=30, vf_extra='', W=None, H_=None):
    H_, W = frames[0].shape[:2]
    vf = 'fps=%g:round=near' % fps_out + (',' + vf_extra if vf_extra else '') + ',' + TAGS
    ff(['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H_), '-framerate', str(fps_in), '-i', 'pipe:0', '-vf', vf,
        '-frames:v', str(n_out), '-c:v', 'libx264', '-crf', '15', '-preset', 'fast', out], stdin=b''.join(f.tobytes() for f in frames))


def _coeffs(dst, src):
    A, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        A += [[x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]]; b += [u, v]
    return np.linalg.solve(np.array(A, float), np.array(b, float))


def pin_planted(kind, out, fix, start=0.4, n_out=90):
    """kind: truth (good) | naive (no dark mask) | loose (+30 px, no mask) | frozen (frame-0 quad) | flipped (180°)"""
    t = json.load(open(os.path.join(fix, 'truth.json'), encoding='utf-8'))
    src = H.decode_frames(os.path.join(fix, 'clip.mp4'))
    scr = Image.open(os.path.join(fix, 'screen.png')).convert('RGBA')
    if kind == 'flipped': scr = scr.rotate(180)
    sw, sh = scr.size; S = [(0, 0), (sw, 0), (sw, sh), (0, sh)]
    k0 = int(round(start * 24)); frames = []
    for k in range(k0, min(len(src), k0 + int(math.ceil(n_out / 30.0 * 24)) + 2)):
        f = src[k].astype(np.float64); Hh, Ww = f.shape[:2]
        q = np.array(t['per_frame'][0 if kind == 'frozen' else k]['screen_corners'], float)
        if kind == 'loose': c = q.mean(0); q = c + (q - c) * (1 + 30.0 / np.linalg.norm(q - c, axis=1)[:, None])
        else: c = q.mean(0); q = c + (q - c) * 1.04
        w = np.asarray(scr.transform((Ww, Hh), Image.PERSPECTIVE, tuple(_coeffs([tuple(p) for p in q], S)), Image.BICUBIC, fillcolor=(0, 0, 0, 0)), np.float64) / 255.0
        a = w[..., 3]
        if kind in ('truth', 'frozen', 'flipped'):
            y = f[..., 0] * .2126 + f[..., 1] * .7152 + f[..., 2] * .0722
            a = a * (y < 24)
        a = (a * .97)[..., None]
        frames.append(np.clip(f * (1 - a) + w[..., :3] * 255 * .94 * a, 0, 255).astype(np.uint8))
    encode(frames, out, 24, n_out)
    return out


def conform_planted(kind, out, src, start=.5, n=60):
    vf = {'interp': 'minterpolate=fps=30', 'fast': 'setpts=0.8*PTS,fps=30:round=near', 'squash': 'fps=30:round=near,scale=360:360',
          'n61': 'fps=30:round=near', 'audio': 'fps=30:round=near', 'untagged': 'fps=30:round=near,format=yuv420p', 'yuv444': 'fps=30:round=near',
          'late': 'fps=30:round=near'}[kind]
    if kind not in ('untagged',): vf += ',' + (TAGS if kind != 'yuv444' else 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,format=yuv444p')
    ss = start + (.5 if kind == 'late' else 0)
    args = ['-ss', '%.4f' % ss, '-i', src] + ([] if kind == 'audio' else ['-an']) + ['-vf', vf, '-frames:v', str(n + 1 if kind == 'n61' else n), '-c:v', 'libx264', '-crf', '15', out]
    ff(args)
    return out


def sbs_compose(ref, ours, out, slip_at=None, label=True):
    """frame i = ref i | ours i composed by index (good), or with ours slipped by +1 from frame slip_at (bad)"""
    R = H.decode_frames(ref); O = H.decode_frames(ours); n = min(len(R), len(O))
    Hh = R.shape[1]; frames = []
    for i in range(n):
        j = i + 1 if (slip_at is not None and i >= slip_at and i + 1 < n) else i
        f = np.concatenate([R[i], O[j]], 1).copy()
        if label: f[10:40, 10:120] = 0; f[10:40, R.shape[2] + 10:R.shape[2] + 120] = 0
        frames.append(f)
    ff(['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (frames[0].shape[1], Hh), '-framerate', '30', '-i', 'pipe:0', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', out],
       stdin=b''.join(f.tobytes() for f in frames))
    return out


def sbs_compose_step(ref, ours, out, step=2, offset=1):
    """ref frame i | ours frame step*i+offset: the wrong half of a 60-vs-30 fps pairing (planted bad)"""
    R = H.decode_frames(ref); O = H.decode_frames(ours); n = min(len(R), (len(O) - offset) // step)
    frames = [np.concatenate([R[i], O[step * i + offset]], 1) for i in range(n)]
    ff(['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (frames[0].shape[1], frames[0].shape[0]), '-framerate', '30', '-i', 'pipe:0', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', out],
       stdin=b''.join(f.tobytes() for f in frames))
    return out


def sbs_hstack(ref, ours, out):
    ff(['-i', ref, '-i', ours, '-filter_complex', '[0:v][1:v]hstack=inputs=2[v]', '-map', '[v]', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', out])
    return out


def temptrack_planted(kind, film, ref, out):
    """good: our picture + the reference audio stream-copied; bad variants break one property each"""
    meta = ['-metadata', 'title=TEMP MUSIC — PRIVATE review copy', '-metadata', 'comment=private temp track, never a deliverable']
    if kind == 'good': ff(['-i', film, '-i', ref, '-map', '0:v', '-map', '1:a', '-c', 'copy'] + meta + [out])
    elif kind == 'reencoded-audio': ff(['-i', film, '-i', ref, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k'] + meta + [out])
    elif kind == 'reencoded-video': ff(['-i', film, '-i', ref, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-crf', '18', '-c:a', 'copy'] + meta + [out])
    elif kind == 'own-audio': ff(['-i', film, '-map', '0:v', '-map', '0:a', '-c', 'copy'] + meta + [out])
    elif kind == 'no-meta': ff(['-i', film, '-i', ref, '-map', '0:v', '-map', '1:a', '-c', 'copy', out])
    elif kind == 'shifted-audio': ff(['-i', film, '-itsoffset', '0.05', '-i', ref, '-map', '0:v', '-map', '1:a', '-c', 'copy'] + meta + [out])
    return out
