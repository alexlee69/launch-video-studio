# -*- coding: utf-8 -*-
# Shared by conform.py, pin.py and look.py: ffprobe facts (rotation and HDR included), the conform filter chain, the
# engine's own HDR → SDR conversion, frame grabs, the cadence in words. numpy + Pillow live in the user site-packages on
# this Mac: under `python3 -I` (no user site) it is added back here; need_numpy() says how to install them if missing.
# A missing ffmpeg, ffprobe or node is a plain message (exit 2), never a traceback: every program runs through call().
import json, math, os, subprocess, sys, tempfile
from fractions import Fraction
from urllib.request import pathname2url

try:
    import numpy, PIL  # noqa: F401
except ImportError:
    import site
    if site.getusersitepackages() not in sys.path:
        sys.path.append(site.getusersitepackages())

BT709 = 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709'
HDR = {'arib-std-b67': 'HLG', 'smpte2084': 'PQ (HDR10)'}          # the transfers lib/hdr.mjs converts, as the film engine does
HDR_JS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'lib', 'hdr.mjs')


def die(code, msg):
    sys.stderr.write(msg.rstrip() + '\n')
    sys.exit(code)


def need_numpy(tool):
    try:
        import numpy, PIL  # noqa: F401,F811
    except ImportError as e:
        die(2, '✗ %s is missing for %s (%s needs numpy and Pillow) — install them: pip3 install numpy pillow\n  (for that python: %s -m pip install numpy pillow)'
            % (e.name or 'numpy or Pillow', sys.executable, tool, sys.executable))


FIX = {'ffmpeg': 'install ffmpeg (macOS: brew install ffmpeg)', 'ffprobe': 'it comes with ffmpeg (macOS: brew install ffmpeg)',
       'node': 'install Node (nodejs.org, or brew install node)'}


def call(cmd, what, popen=False, **kw):
    """subprocess.run (or Popen) — except that a program that isn't installed is a plain message, exit 2."""
    try:
        return (subprocess.Popen if popen else subprocess.run)(cmd, **kw)
    except FileNotFoundError:
        die(2, '%s: %s is not installed (or not on PATH) — %s, then run this again' % (what, cmd[0], FIX.get(cmd[0], 'install it')))


def same_file(a, b):
    """Would writing b touch a? The same path, the same inode (a hard link), or the same file through a symlink."""
    try:
        if os.path.exists(a) and os.path.exists(b) and os.path.samefile(a, b):
            return True
    except OSError:
        pass
    return os.path.realpath(a) == os.path.realpath(b)


def guard_outputs(outputs, inputs):
    """Before any work: refuse an output that is an input (path, hard link or symlink) or a folder, or two outputs that
    are one file, and create every output's folder."""
    for k, o in enumerate(outputs):
        if os.path.isdir(o):
            die(2, '%s is a folder — give the output a file name' % o)
        for i in inputs:
            if same_file(i, o):
                why = ('the same path' if os.path.abspath(o) == os.path.abspath(i) else
                       'a symlink to it' if os.path.islink(o) or os.path.realpath(o) != os.path.abspath(o) else 'a hard link of it')
                die(2, 'the output %s is the input %s (%s) — writing it would destroy the input; give the output a name of its own' % (o, i, why))
        for o2 in outputs[k + 1:]:
            if same_file(o, o2):
                die(2, 'two outputs are the same file (%s, %s) — give them names of their own' % (o, o2))
        try:
            os.makedirs(os.path.dirname(os.path.abspath(o)), exist_ok=True)
        except OSError as e:
            die(2, "can't create the folder for %s: %s" % (o, e))


def temp_beside(path):
    """A fresh, exclusively created temp file next to path, keeping its extension (ffmpeg and PIL pick the format from
    it); publish() moves it onto path in one rename, so path is always the old file or the whole new one."""
    stem, ext = os.path.splitext(os.path.basename(path))
    fd, t = tempfile.mkstemp(prefix='.%s.' % stem, suffix='.tmp' + ext, dir=os.path.dirname(os.path.abspath(path)))
    um = os.umask(0); os.umask(um)                  # read the umask (put straight back): mkstemp made the file 0600
    os.fchmod(fd, 0o666 & ~um)                      # the mode a plain open() gives, so a published output is an ordinary file
    os.close(fd)
    return t


def publish(tmp, path):
    os.replace(tmp, path)                           # replaces a symlink or hard link at path itself, never what it points at


def discard(*paths):
    for t in paths:
        try:
            os.unlink(t)
        except OSError:
            pass


def run(cmd, what):
    r = call(cmd, what, capture_output=True)
    if r.returncode:
        die(1, '%s failed:\n%s' % (what, r.stderr.decode('utf-8', 'replace').strip()))
    return r.stdout


def probe(path):
    """The first video stream as ffmpeg decodes it (an attached cover picture is not the video): w, h (after its rotation
    tag), fps (Fraction, r_frame_rate), duration (s), audio (bool), trc (color_transfer); None if unreadable."""
    if not os.path.isfile(path):
        return None
    r = call(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate,color_transfer:stream_tags=rotate:'
              'stream_side_data=rotation:stream_disposition=attached_pic:format=duration', '-of', 'json', path], 'ffprobe (reading %s)' % path, capture_output=True)
    try:
        j = json.loads(r.stdout.decode('utf-8', 'replace')) if r.returncode == 0 else {}
    except ValueError:
        return None
    st = j.get('streams') or []
    v = next((s for s in st if s.get('codec_type') == 'video' and not (s.get('disposition') or {}).get('attached_pic')), None)
    if not v or not v.get('width'):
        return None
    try:
        fps = Fraction(v.get('r_frame_rate') or '0/1')
    except (ValueError, ZeroDivisionError):
        fps = Fraction(0)
    w, h = int(v['width']), int(v['height'])
    rot = next((d['rotation'] for d in v.get('side_data_list') or [] if 'rotation' in d), None)
    if rot is None:
        rot = (v.get('tags') or {}).get('rotate') or 0
    if int(round(float(rot))) % 180:                  # a phone clip stored sideways + a rotation tag: ffmpeg decodes it upright
        w, h = h, w
    dur = float((j.get('format') or {}).get('duration') or 0)
    return dict(w=w, h=h, fps=fps, dur=dur, audio=any(s.get('codec_type') == 'audio' for s in st), trc=v.get('color_transfer'))


_hdr_cache = {}


def hdr_prefix(info, path):
    """The film engine's HDR → SDR BT.709 conversion (lib/hdr.mjs hdrFilter, exactly as lv.mjs's extractPlates uses it),
    as a filter prefix ending in ','; '' for SDR footage."""
    trc = (info or {}).get('trc')
    if trc not in HDR:
        return ''
    if trc not in _hdr_cache:
        try:
            r = subprocess.run(['node', '--input-type=module', '-e', 'import { hdrFilter } from %s; process.stdout.write(hdrFilter(process.argv[1]))'
                                % json.dumps('file://' + pathname2url(HDR_JS)), trc], capture_output=True)
        except FileNotFoundError:
            die(2, "%s is %s HDR. The film engine converts it to SDR with node (%s), and node is not installed (or not on PATH).\n"
                'Install Node (nodejs.org, or brew install node) and run this again — or export an SDR (BT.709) copy of the clip and use that.'
                % (path, HDR[trc], HDR_JS))
        f = r.stdout.decode('utf-8', 'replace')
        if r.returncode or not f.endswith(','):
            die(2, "%s is %s HDR, and the film engine's conversion to SDR (%s, run with node) failed:\n%s\nConvert the clip to SDR first, "
                'or film with HDR Video off.' % (path, HDR[trc], HDR_JS, r.stderr.decode('utf-8', 'replace').strip()))
        _hdr_cache[trc] = f
    return _hdr_cache[trc]


NTSC = (24, 30, 48, 60, 120)                         # 23.976, 29.97, 47.952, 59.94, 119.88 mean N × 1000/1001


def fps_arg(s):
    """'30', '29.97', '30000/1001' → Fraction. A decimal NTSC rate is the exact rational cameras and ffmpeg mean: 29.97 →
    30000/1001, 59.94 → 60000/1001, 23.976 (or 23.98) → 24000/1001, never 2997/100. The string ffmpeg gets back is the
    exact form ('30' stays '30')."""
    try:
        f = Fraction(s)
    except (ValueError, ZeroDivisionError):
        die(2, '--fps %s: give frames per second, e.g. 30, 24, 60, 29.97 or 30000/1001' % s)
    if '/' not in s and '.' in s:
        n = int(round(float(f) * 1.001))
        if n in NTSC and abs(float(f) - n / 1.001) < 0.005:
            f = Fraction(n * 1000, 1001)
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


def chain(fps, grade='', size=None, hdr='', odd=None):
    """[HDR → SDR] fps=<fps>:round=near (native speed: frames repeat or drop, never blend) → [an odd w×h cropped to even, no
    resampling] → [cover crop] → grade → BT.709 → yuv420p. SDR footage of even size gets exactly the chain it always had."""
    vf = hdr + 'fps=%s:round=near' % fps_str(fps)
    if odd:
        vf += ',crop=%d:%d' % (odd[0] - odd[0] % 2, odd[1] - odd[1] % 2)
    if size:
        vf += ',' + cover(*size)
    if grade:
        vf += ',' + grade
    return vf + ',' + BT709 + (':range=tv' if hdr else '') + ',format=yuv420p'   # the HDR conversion ends full range: back to TV


def cadence(src, dst):
    """What fps=<dst>:round=near does to <src> frames, exact for any ratio: '24 → 30 fps: 1 repeat every 5 (native speed,
    no interpolation)', '60 → 30 fps: every 2nd source frame kept', '60 → 25 fps: 5 of every 12 source frames kept,
    nearest frame (about 1 in 2.4, native speed)'."""
    head = '%s → %s fps: ' % (num(src), num(dst))
    try:
        s, d = Fraction(src), Fraction(dst)
    except (TypeError, ValueError, ZeroDivisionError):
        s, d = Fraction(0), Fraction(1)
    if s <= 0:
        return head + 'unknown source rate'
    if abs(float(s) - float(d)) < 1e-3:
        return head + 'frame for frame'
    about = lambda part: '' if part.numerator == 1 else 'about 1 in %s, ' % num(1 / part)
    if d > s:                                         # more frames out than in: some source frames are shown again
        if d < 2 * s:
            rep = 1 - s / d                           # the share of output frames that repeat the one before
            what = '1 repeat every %d' % rep.denominator if rep.numerator == 1 else '%d repeats in every %d frames' % (rep.numerator, rep.denominator)
            return head + '%s (%snative speed, no interpolation)' % (what, about(rep))
        r = d / s
        return head + 'each frame shown %s times (native speed, no interpolation)' % ('%d' % r if r.denominator == 1 else '%d–%d' % (math.floor(r), math.ceil(r)))
    keep = d / s                                      # the share of source frames kept: the nearest one to each output frame
    if keep.numerator == 1:
        return head + 'every %s source frame kept (native speed)' % {2: '2nd', 3: '3rd'}.get(keep.denominator, '%dth' % keep.denominator)
    if s < 2 * d:
        drop = 1 - keep
        what = '1 source frame dropped every %d' % drop.denominator if drop.numerator == 1 else '%d of every %d source frames dropped' % (drop.numerator, drop.denominator)
        return head + '%s (%snative speed)' % (what, about(drop))
    return head + '%d of every %d source frames kept, nearest frame (%snative speed)' % (keep.numerator, keep.denominator, about(keep))


def frames_at(path, w, h, picks, hdr=''):
    """RGB frames of a clip as uint8 arrays, upright and (HDR) converted to SDR like the engine. picks = ('t', [seconds])
    grabs each with `-ss t -frames:v 1` (what a still export does); ('n', [indices]) decodes by frame index (select=eq(n,…),
    48 indices per pass: a longer select= expression runs ffmpeg out of memory), for clips with irregular timestamps."""
    np = __import__('numpy')
    kind, vals = picks
    conv = ['-vf', hdr + 'format=rgb24'] if hdr else []
    out = []
    if kind == 't':
        for t in vals:
            raw = run(['ffmpeg', '-v', 'error', '-ss', '%.4f' % t, '-i', path, '-an'] + conv + ['-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                      'ffmpeg (grab %.3f s of %s)' % (t, path))
            if len(raw) < w * h * 3:
                die(2, '%s has no frame at %.3f s (it is %.2f s long)' % (path, t, (probe(path) or {}).get('dur', 0)))
            out.append(np.frombuffer(raw[:w * h * 3], np.uint8).reshape(h, w, 3))
        return out
    want, by = sorted(set(vals)), {}
    for k in range(0, len(want), 48):
        part = want[k:k + 48]
        sel = 'select=' + '+'.join('eq(n\\,%d)' % n for n in part)
        raw = run(['ffmpeg', '-v', 'error', '-i', path, '-an', '-vf', sel + (',' + hdr + 'format=rgb24' if hdr else ''), '-fps_mode', 'passthrough',
                   '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], 'ffmpeg (frames of %s)' % path)
        got = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)
        by.update(zip(part, got))
    miss = [n for n in vals if n not in by]
    if miss:
        r = call(['ffprobe', '-v', 'error', '-count_packets', '-select_streams', 'V:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', path],
                 'ffprobe (counting the frames of %s)' % path, capture_output=True)
        die(2, '%s has no frame %d (it has %s frames: 0 … %s)' % (path, miss[0], r.stdout.decode().strip() or '?', int(r.stdout.decode().strip() or 1) - 1))
    return [by[n] for n in vals]
