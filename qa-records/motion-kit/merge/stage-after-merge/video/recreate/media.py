# -*- coding: utf-8 -*-
# Shared by the recreate tools: probe, decode frames by index (HDR converted to SDR as the film engine does), decode
# audio, fonts, outputs that never overwrite an input and are written whole (a temp file + one rename). Importing it also
# makes numpy and Pillow importable under `python3 -I` (which hides the user site-packages they live in on this Mac).
import os, sys, json, subprocess, tempfile
from urllib.request import pathname2url
try:
    import site
    if site.getusersitepackages() not in sys.path:
        sys.path.append(site.getusersitepackages())
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont
except ImportError as e:
    sys.stderr.write('\n✗ %s is missing for %s — install numpy and Pillow: pip3 install numpy pillow\n' % (e.name or 'a module', sys.executable))
    sys.exit(2)

VIDEO_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))     # …/product-launch-sting/video
HDR = {'arib-std-b67': 'HLG', 'smpte2084': 'PQ (HDR10)'}          # the transfers lib/hdr.mjs converts, as the film engine does


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


def rate(P):
    """the video's frame rate exactly, as a Fraction (r_frame_rate: 30000/1001, not 29.97); 0 when unknown"""
    from fractions import Fraction
    try:
        return Fraction(str((P.get('video') or {}).get('rate') or 0))
    except (ValueError, ZeroDivisionError):
        return Fraction(0)


def probe(path):
    """Video + first audio stream facts. w/h are the displayed size (rotation applied, as ffmpeg decodes it)."""
    if not os.path.isfile(path):
        raise UserError('no such file: %s' % path)
    out = run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path], 'ffprobe %s' % os.path.basename(path), text=True)
    j = json.loads(out or '{}')
    v = next((s for s in j.get('streams', []) if s.get('codec_type') == 'video' and not (s.get('disposition') or {}).get('attached_pic')), None)
    a = next((s for s in j.get('streams', []) if s.get('codec_type') == 'audio'), None)
    fmt = j.get('format', {})
    P = {'path': path, 'name': os.path.basename(path), 'duration': float(fmt.get('duration') or 0), 'video': None, 'audio': None, 'tags': fmt.get('tags', {}),
         'format': fmt.get('format_name') or ''}
    if v:
        rot = 0
        for sd in v.get('side_data_list', []) or []:
            if 'rotation' in sd:
                rot = int(round(float(sd['rotation'])))
        rot = rot or int((v.get('tags') or {}).get('rotate', 0) or 0)
        w, h = int(v['width']), int(v['height'])
        if abs(rot) % 180 == 90:
            w, h = h, w
        P['video'] = {'index': v['index'], 'w': w, 'h': h, 'fps': _rate(v.get('r_frame_rate')), 'rate': v.get('r_frame_rate'), 'avg_fps': _rate(v.get('avg_frame_rate')),
                      'frames': int(v['nb_frames']) if str(v.get('nb_frames', '')).isdigit() else None,
                      'duration': float(v.get('duration') or 0) or None, 'codec': v.get('codec_name'), 'trc': v.get('color_transfer')}
    if a:
        P['audio'] = {'index': a['index'], 'codec': a.get('codec_name'), 'sr': int(a.get('sample_rate') or 0), 'channels': int(a.get('channels') or 0),
                      'start_pts': a.get('start_pts'), 'time_base': a.get('time_base'), 'duration': float(a.get('duration') or 0) or None}
    return P


_hdr = {}


def hdr_chain(V, path):
    """HLG / PQ video → SDR BT.709 the way the film engine converts footage (lib/hdr.mjs hdrFilter, got from node), then
    back to TV-range yuv420p so it decodes on as an SDR file does; '' for SDR video. Refused, with what to do, when node
    can't give the conversion."""
    trc = (V or {}).get('trc')
    if trc not in HDR:
        return ''
    if trc not in _hdr:
        js = os.path.join(VIDEO_DIR, 'lib', 'hdr.mjs')
        try:
            r = subprocess.run(['node', '--input-type=module', '-e', 'import { hdrFilter } from %s; process.stdout.write(hdrFilter(process.argv[1]))'
                                % json.dumps('file://' + pathname2url(js)), trc], capture_output=True)
            f, err = r.stdout.decode('utf-8', 'replace'), r.stderr.decode('utf-8', 'replace').strip() if r.returncode else ''
        except FileNotFoundError:
            f, err = '', 'node is not installed (or not on PATH)'
        if err or not f.endswith(','):
            raise UserError("%s is %s HDR. It is compared after the film engine's own conversion to SDR (%s, run with node), which failed: %s\n"
                            'Install Node (nodejs.org, or brew install node) and run this again — or export an SDR (BT.709) copy of the file and '
                            'compare that.' % (path, HDR[trc], js, err or 'no filter came back'))
        _hdr[trc] = f + 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv'
    return _hdr[trc]


def frames(path, size=None, fmt='gray', first=0, last=None, flags='area', step=1):
    """Decoded frames by INDEX (presentation order, no re-timing: -fps_mode passthrough) of the video stream (never an
    attached cover picture), first..last inclusive, as uint8 arrays (h, w) or (h, w, 3). size = (w, h) scales in ffmpeg.
    step = k reads every k-th frame (frame k·i of a 60 fps file is frame i of its 30 fps grid); first/last count in those
    steps. HDR is converted to SDR as the film engine does. A decoder that fails, or decodes no frame at all, is an
    error (UserError), not an early end."""
    P = probe(path)
    V = P['video']
    if not V:
        raise UserError('%s has no video stream' % P['name'])
    vf, sel = [], (['not(mod(n\\,%d))' % step] if step > 1 else [])
    if first > 0 or last is not None:
        sel.append('between(n\\,%d\\,%d)' % (first * step, last * step) if last is not None else 'gte(n\\,%d)' % (first * step))
    if sel:
        vf.append("select='%s'" % '*'.join(sel))
    hdr = hdr_chain(V, path)
    if hdr:
        vf.append(hdr)
    if size:
        vf.append('scale=%d:%d:flags=%s' % (size[0], size[1], flags))
    cmd = ['ffmpeg', '-v', 'error', '-nostdin', '-i', path, '-map', '0:%d' % V['index'], '-an', '-sn', '-dn', '-fps_mode', 'passthrough']
    if vf:
        cmd += ['-vf', ','.join(vf)]
    cmd += ['-f', 'rawvideo', '-pix_fmt', fmt, '-']
    if size is None:
        size = (V['w'], V['h'])
    ch = 3 if fmt == 'rgb24' else 1
    n = size[0] * size[1] * ch
    err = tempfile.TemporaryFile()                  # not a pipe: a corrupt file's error stream can't stall the decode
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=err)
    log = lambda: (err.seek(0), err.read().decode('utf-8', 'replace').strip())[1]
    try:
        k, got = first, 0
        while last is None or k <= last:
            b = p.stdout.read(n)
            if len(b) < n:                          # the decoder's end: it must have finished cleanly, with frames
                rc, msg = p.wait(), log()
                if rc:
                    raise UserError("ffmpeg can't decode %s (exit %d%s) — a damaged or partial file? Re-export or re-download it:\n%s"
                                    % (path, rc, ', after %d good frames' % got if got else '', msg[-800:]))
                if not got:
                    raise UserError('%s: no frame decoded%s — %s' % (P['name'], ' from frame %d on' % first if first else '',
                                    'ffmpeg reported errors (a damaged or partial file? Re-export or re-download it):\n%s' % msg[-800:] if msg else
                                    'it lists %d frames' % count_frames(P) if first else 'is it an empty or still-downloading file?'))
                want = listed(P, first, last, step)
                if msg and want and got < want:    # frames dropped with decoder errors: exit 0, but not the file's frames
                    raise UserError('%s: ffmpeg decoded only %d of the %d frames it lists, with errors — a damaged or partial file? Re-export or re-download it:\n%s'
                                    % (path, got, want, msg[-800:]))
                if msg:
                    warn_decode(path, msg)
                break
            got += 1
            a = np.frombuffer(b, np.uint8)
            yield a.reshape(size[1], size[0], 3) if ch == 3 else a.reshape(size[1], size[0])
            k += 1
        else:                                       # stopped at `last`, ahead of the end: errors so far are worth a word
            msg = log()
            if msg:
                warn_decode(path, msg)
    finally:
        p.stdout.close()
        p.kill() if p.poll() is None else None
        p.wait()
        err.close()


_warned = set()


def warn_decode(path, msg):
    """ffmpeg logged decoder errors but every frame came out: said once per file (concealed frames can look wrong)"""
    if path not in _warned:
        _warned.add(path)
        lines = msg.splitlines()
        sys.stderr.write('! %s: ffmpeg reported %d decoder error line%s (first: %s) — if its frames look damaged, re-export it\n'
                         % (os.path.basename(path), len(lines), '' if len(lines) == 1 else 's', lines[0][:160]))


def listed(P, first=0, last=None, step=1):
    """how many frames the container lists in a frames() read (0 when it doesn't say)"""
    total = count_frames(P)
    if not total:
        return 0
    hi = min(last * step, total - 1) if last is not None else total - 1
    lo = first * step
    return (hi - lo) // step + 1 if hi >= lo else 0


def count_frames(P):
    """a video's frame count: the container's, else its packets counted (fast, no decode)"""
    if P['video'] and P['video']['frames']:
        return P['video']['frames']
    out = run(['ffprobe', '-v', 'error', '-select_streams', str(P['video']['index']), '-count_packets', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', P['path']], 'count the frames of %s' % P['name'], text=True)
    n = out.strip().split(',')[0]
    return int(n) if n.isdigit() else 0


def audio(path, sr=22050, mono=True):
    """The first audio stream as float64 samples (mono: (n,), else (n, 2))."""
    raw = run(['ffmpeg', '-v', 'error', '-nostdin', '-i', path, '-map', '0:a:0', '-vn', '-ac', '1' if mono else '2', '-ar', str(sr), '-f', 'f32le', '-'], 'decode the audio of %s' % os.path.basename(path))
    x = np.frombuffer(raw, np.float32).astype(np.float64)
    return x if mono else x.reshape(-1, 2)


# ── outputs: never an input, always whole ──
def same_file(a, b):
    """Would writing b touch a? The same path, the same inode (a hard link), or the same file through a symlink."""
    try:
        if os.path.exists(a) and os.path.exists(b) and os.path.samefile(a, b):
            return True
    except OSError:
        pass
    return os.path.realpath(a) == os.path.realpath(b)


# These behave as footage/_media.py's same-named functions do — the same checks in the same order, the same messages,
# the same file modes (work-B/tests/r3_parity.py runs both on the same cases). Each folder keeps its own copy: no import
# across folders. The one difference is how a refusal leaves: UserError here (the tool prints it, exit 2), die(2) there.
def guard_outputs(outputs, inputs):
    """Before any work: refuse an output that is an input (path, hard link or symlink) or a folder, or two outputs that
    are one file, and create every output's folder. outputs, inputs: paths."""
    for k, o in enumerate(outputs):
        if os.path.isdir(o):
            raise UserError('%s is a folder — give the output a file name' % o)
        for i in inputs:
            if same_file(i, o):
                why = ('the same path' if os.path.abspath(o) == os.path.abspath(i) else
                       'a symlink to it' if os.path.islink(o) or os.path.realpath(o) != os.path.abspath(o) else 'a hard link of it')
                raise UserError('the output %s is the input %s (%s) — writing it would destroy the input; give the output a name of its own' % (o, i, why))
        for o2 in outputs[k + 1:]:
            if same_file(o, o2):
                raise UserError('two outputs are the same file (%s, %s) — give them names of their own' % (o, o2))
        try:
            os.makedirs(os.path.dirname(os.path.abspath(o)), exist_ok=True)
        except OSError as e:
            raise UserError("can't create the folder for %s: %s" % (o, e))


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


def write_file(path, data, mode='w'):
    t = temp_beside(path)
    try:
        with open(t, mode, **({'encoding': 'utf-8'} if mode == 'w' else {})) as f:
            f.write(data)
        publish(t, path)
    except BaseException:
        discard(t)
        raise


def write_json(path, obj, **kw):
    """strict JSON (a NaN or an infinity is refused, never written as NaN), written whole"""
    try:
        s = json.dumps(obj, allow_nan=False, ensure_ascii=False, **kw)
    except ValueError:
        raise UserError('%s not written: a result came out as NaN or infinity (silent or too-short input?)' % path)
    write_file(path, s)


def save_image(im, path, **kw):
    t = temp_beside(path)
    try:
        im.save(t, **kw)
        publish(t, path)
    except BaseException:
        discard(t)
        raise


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
