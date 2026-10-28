# -*- coding: utf-8 -*-
# Shared by the recreate tools: probe, decode frames by index, decode audio, fonts. Importing it also makes numpy and
# Pillow importable under `python3 -I` (which hides the user site-packages they live in on this Mac).
import os, sys, json, subprocess
try:
    import numpy as np
except ImportError:
    import site
    sys.path.append(site.getusersitepackages())
    import numpy as np
from PIL import Image, ImageDraw, ImageFont

VIDEO_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))     # …/product-launch-sting/video


class UserError(Exception):
    """A problem the user fixes (bad input, wrong file): printed as one plain message, exit 2."""


def die(msg, code=2):
    sys.stderr.write('\n✗ %s\n' % msg)
    sys.exit(code)


def run(cmd, what, text=False):
    try:
        r = subprocess.run(cmd, capture_output=True, text=text)
    except FileNotFoundError:
        raise UserError('%s: %s is not installed (or not on PATH)' % (what, cmd[0]))
    if r.returncode:
        err = r.stderr if text else r.stderr.decode('utf-8', 'replace')
        raise UserError('%s failed:\n%s' % (what, err.strip()[-1500:]))
    return r.stdout


def _rate(s):
    try:
        a, b = str(s).split('/')
        return float(a) / float(b) if float(b) else 0.0
    except ValueError:
        return float(s or 0)


def probe(path):
    """Video + first audio stream facts. w/h are the displayed size (rotation applied, as ffmpeg decodes it)."""
    if not os.path.isfile(path):
        raise UserError('no such file: %s' % path)
    out = run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path], 'ffprobe %s' % os.path.basename(path), text=True)
    j = json.loads(out or '{}')
    v = next((s for s in j.get('streams', []) if s.get('codec_type') == 'video' and not (s.get('disposition') or {}).get('attached_pic')), None)
    a = next((s for s in j.get('streams', []) if s.get('codec_type') == 'audio'), None)
    fmt = j.get('format', {})
    P = {'path': path, 'name': os.path.basename(path), 'duration': float(fmt.get('duration') or 0), 'video': None, 'audio': None, 'tags': fmt.get('tags', {})}
    if v:
        rot = 0
        for sd in v.get('side_data_list', []) or []:
            if 'rotation' in sd:
                rot = int(round(float(sd['rotation'])))
        rot = rot or int((v.get('tags') or {}).get('rotate', 0) or 0)
        w, h = int(v['width']), int(v['height'])
        if abs(rot) % 180 == 90:
            w, h = h, w
        P['video'] = {'index': v['index'], 'w': w, 'h': h, 'fps': _rate(v.get('r_frame_rate')), 'avg_fps': _rate(v.get('avg_frame_rate')),
                      'frames': int(v['nb_frames']) if str(v.get('nb_frames', '')).isdigit() else None,
                      'duration': float(v.get('duration') or 0) or None, 'codec': v.get('codec_name')}
    if a:
        P['audio'] = {'index': a['index'], 'codec': a.get('codec_name'), 'sr': int(a.get('sample_rate') or 0), 'channels': int(a.get('channels') or 0),
                      'start_pts': a.get('start_pts'), 'time_base': a.get('time_base'), 'duration': float(a.get('duration') or 0) or None}
    return P


def frames(path, size=None, fmt='gray', first=0, last=None, flags='area'):
    """Decoded frames by INDEX (presentation order, no re-timing: -fps_mode passthrough), first..last inclusive, as
    uint8 arrays (h, w) or (h, w, 3). size = (w, h) scales in ffmpeg."""
    vf = []
    if first > 0 or last is not None:
        vf.append("select='%s'" % ('between(n\\,%d\\,%d)' % (first, last) if last is not None else 'gte(n\\,%d)' % first))
    if size:
        vf.append('scale=%d:%d:flags=%s' % (size[0], size[1], flags))
    cmd = ['ffmpeg', '-v', 'error', '-nostdin', '-i', path, '-map', '0:v:0', '-an', '-sn', '-dn', '-fps_mode', 'passthrough']
    if vf:
        cmd += ['-vf', ','.join(vf)]
    cmd += ['-f', 'rawvideo', '-pix_fmt', fmt, '-']
    if size is None:
        P = probe(path)['video']
        size = (P['w'], P['h'])
    ch = 3 if fmt == 'rgb24' else 1
    n = size[0] * size[1] * ch
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        k = first
        while last is None or k <= last:
            b = p.stdout.read(n)
            if len(b) < n:
                break
            a = np.frombuffer(b, np.uint8)
            yield a.reshape(size[1], size[0], 3) if ch == 3 else a.reshape(size[1], size[0])
            k += 1
    finally:
        p.stdout.close()
        p.kill() if p.poll() is None else None
        p.wait()


def audio(path, sr=22050, mono=True):
    """The first audio stream as float64 samples (mono: (n,), else (n, 2))."""
    raw = run(['ffmpeg', '-v', 'error', '-nostdin', '-i', path, '-map', '0:a:0', '-vn', '-ac', '1' if mono else '2', '-ar', str(sr), '-f', 'f32le', '-'], 'decode the audio of %s' % os.path.basename(path))
    x = np.frombuffer(raw, np.float32).astype(np.float64)
    return x if mono else x.reshape(-1, 2)


def font(size):
    for p in ('/System/Library/Fonts/Helvetica.ttc', '/System/Library/Fonts/SFNS.ttf', '/Library/Fonts/Arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            pass
    return ImageFont.load_default()


def tc(n, fps):
    """frame → m:ss.ss"""
    s = n / fps
    return '%d:%05.2f' % (s // 60, s % 60)


def tempo(path):
    """The skill's tempo tracker (lib/breakdown.mjs --tempo) on a file: bpm, beat, firstBeat, downbeat, confidence …"""
    out = run(['node', os.path.join(VIDEO_DIR, 'lib', 'breakdown.mjs'), '--tempo', path, '--json'], "the skill's tempo tracker on %s" % os.path.basename(path), text=True)
    return json.loads(out)
