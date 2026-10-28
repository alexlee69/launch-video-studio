# -*- coding: utf-8 -*-
# Shared by conform.py, pin.py and look.py: ffprobe facts, the conform filter chain, frame grabs, the cadence in words.
# numpy + Pillow live in the user site-packages on this Mac: under `python3 -I` (no user site) it is added back here.
import json, math, os, subprocess, sys
from fractions import Fraction

try:
    import numpy, PIL  # noqa: F401
except ImportError:
    import site
    if site.getusersitepackages() not in sys.path:
        sys.path.append(site.getusersitepackages())

BT709 = 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709'


def die(code, msg):
    sys.stderr.write(msg.rstrip() + '\n')
    sys.exit(code)


def run(cmd, what):
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode:
        die(1, '%s failed:\n%s' % (what, r.stderr.decode('utf-8', 'replace').strip()))
    return r.stdout


def probe(path):
    """The first video stream: w, h, fps (Fraction, r_frame_rate), duration (s), audio (bool); None if unreadable."""
    if not os.path.isfile(path):
        return None
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate:format=duration',
                        '-of', 'json', path], capture_output=True)
    try:
        j = json.loads(r.stdout.decode('utf-8', 'replace')) if r.returncode == 0 else {}
    except ValueError:
        return None
    st = j.get('streams') or []
    v = next((s for s in st if s.get('codec_type') == 'video'), None)
    if not v or not v.get('width'):
        return None
    try:
        fps = Fraction(v.get('r_frame_rate') or '0/1')
    except (ValueError, ZeroDivisionError):
        fps = Fraction(0)
    dur = float((j.get('format') or {}).get('duration') or 0)
    return dict(w=int(v['width']), h=int(v['height']), fps=fps, dur=dur, audio=any(s.get('codec_type') == 'audio' for s in st))


def fps_arg(s):
    """'30', '29.97', '30000/1001' → Fraction; the string ffmpeg gets back is the shortest exact form ('30' stays '30')."""
    try:
        f = Fraction(s)
    except (ValueError, ZeroDivisionError):
        die(2, '--fps %s: give frames per second, e.g. 30, 24, 60 or 30000/1001' % s)
    if f <= 0 or f > 240:
        die(2, '--fps %s: out of range' % s)
    return f


def fps_str(f):
    return str(f.numerator) if f.denominator == 1 else '%d/%d' % (f.numerator, f.denominator)


def num(f):
    return ('%.3f' % float(f)).rstrip('0').rstrip('.')


def size_arg(s):
    try:
        w, h = [int(x) for x in s.lower().split('x')]
    except ValueError:
        die(2, '--size %s: give it as WxH, e.g. 1920x1080' % s)
    if w < 16 or h < 16 or w % 2 or h % 2:
        die(2, '--size %s: width and height must be even numbers of at least 16 (H.264 4:2:0)' % s)
    return w, h


def cover(w, h):
    """Scale to cover WxH, then crop the middle (the same fit as lv.mjs's `cover` footage)."""
    return 'scale=%d:%d:force_original_aspect_ratio=increase:flags=lanczos,crop=%d:%d' % (w, h, w, h)


def chain(fps, grade='', size=None):
    """fps=<fps>:round=near (native speed: frames repeat or drop, never blend) → cover crop → grade → BT.709 → yuv420p."""
    vf = 'fps=%s:round=near' % fps_str(fps)
    if size:
        vf += ',' + cover(*size)
    if grade:
        vf += ',' + grade
    return vf + ',' + BT709 + ',format=yuv420p'


def cadence(src, dst):
    """'24 → 30 fps: 1 repeat every 5 (native speed, no interpolation)'."""
    s, d = float(src), float(dst)
    head = '%s → %s fps: ' % (num(src), num(dst))
    if s <= 0:
        return head + 'unknown source rate'
    if abs(s - d) < 1e-3:
        return head + 'frame for frame'
    if d > s:
        if d < 2 * s:
            return head + '1 repeat every %s (native speed, no interpolation)' % num(Fraction(d / (d - s)).limit_denominator(100))
        return head + 'each frame shown %d–%d times (native speed, no interpolation)' % (int(d // s), int(math.ceil(d / s)))
    if s < 2 * d:
        return head + '1 source frame dropped every %s (native speed)' % num(Fraction(s / (s - d)).limit_denominator(100))
    k = int(round(s / d))
    return head + 'every %s source frame kept (native speed)' % {2: '2nd', 3: '3rd'}.get(k, '%dth' % k)


def frames_at(path, w, h, picks):
    """RGB frames of a clip as uint8 arrays. picks = ('t', [seconds]) grabs each with `-ss t -frames:v 1` (what a still
    export does); ('n', [indices]) decodes by frame index (select=eq(n,…)), for clips with irregular timestamps."""
    np = __import__('numpy')
    kind, vals = picks
    out = []
    if kind == 't':
        for t in vals:
            raw = run(['ffmpeg', '-v', 'error', '-ss', '%.4f' % t, '-i', path, '-an', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], 'ffmpeg (grab %.3f s of %s)' % (t, path))
            if len(raw) < w * h * 3:
                die(2, '%s has no frame at %.3f s (it is %.2f s long)' % (path, t, (probe(path) or {}).get('dur', 0)))
            out.append(np.frombuffer(raw[:w * h * 3], np.uint8).reshape(h, w, 3))
        return out
    sel = '+'.join('eq(n\\,%d)' % n for n in sorted(set(vals)))
    raw = run(['ffmpeg', '-v', 'error', '-i', path, '-an', '-vf', 'select=' + sel, '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], 'ffmpeg (frames of %s)' % path)
    got = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)
    by = dict(zip(sorted(set(vals)), got))
    miss = [n for n in vals if n not in by]
    if miss:
        r = subprocess.run(['ffprobe', '-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', path], capture_output=True)
        die(2, '%s has no frame %d (it has %s frames: 0 … %s)' % (path, miss[0], r.stdout.decode().strip() or '?', int(r.stdout.decode().strip() or 1) - 1))
    return [by[n] for n in vals]
