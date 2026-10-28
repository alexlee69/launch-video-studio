# -*- coding: utf-8 -*-
# Shared plumbing for the acceptance harness: paths, the fake keys, sandboxed tool runs, the mock fal server, result
# reporting. Python 3.9 + numpy + Pillow; ffmpeg/ffprobe 8.1 on PATH.
import os, sys, json, time, hashlib, shutil, subprocess, base64, re, signal, urllib.request

ACC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.dirname(ACC)                                         # qa/hf02full-skill-port
LIB = os.path.join(ACC, 'lib')
FIX = os.path.join(ACC, 'fixtures')
REAL_HOME = os.path.expanduser('~')
LIVE = os.path.join(REAL_HOME, '.claude', 'skills', 'product-launch-sting')
REAL_ENV = os.path.join(REAL_HOME, 'Downloads', 'launch-videos', '.env')      # holds the real FAL_KEY: never read, never readable by a tool run
LAUNCH = os.path.join(REAL_HOME, 'Downloads', 'launch-videos')
HF02 = os.path.join(LAUNCH, 'hf02-full')
REF_MP4 = os.path.join(REAL_HOME, 'Downloads', 'higgsfield02.mp4')
PY = '/usr/bin/python3'
NODE = shutil.which('node') or '/opt/homebrew/bin/node'
FFMPEG = shutil.which('ffmpeg') or '/opt/homebrew/bin/ffmpeg'
FFPROBE = shutil.which('ffprobe') or '/opt/homebrew/bin/ffprobe'

# distinctive FAKE keys (hex-only, uuid:secret like real ones). The leak scan looks for any 12-char window of them.
KEY_A = 'a11ce5ec-0fa1-4ace-9eed-5ca1ab1e0001:0ddba11fee1dead5ca1ab1e00c0ffee1'
KEY_B = 'beefcafe-7e57-4b0b-9c0d-e1f2a3b4c5d6:f00dface7e57b0b5c0ffeed15ea5edd0'
KEY_C = 'c0c0a000-babe-4fab-8bad-f00d00c0ffee:decafbad00facade0000bead5eed5eed'


def md5_file(p):
    h = hashlib.md5()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''): h.update(b)
    return h.hexdigest()


def sha1_file(p):
    h = hashlib.sha1()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''): h.update(b)
    return h.hexdigest()


def leak_needles(keys=(KEY_A, KEY_B, KEY_C), win=12):
    out = set()
    for k in keys:
        for part in [k] + k.split(':'):
            for i in range(0, max(1, len(part) - win + 1)):
                out.add(part[i:i + win].encode())
        for pre in (b'', b'x', b'xx', b'Key ', b':'):          # base64 of the key at any alignment
            b64 = base64.b64encode(pre + k.encode())
            out.add(b64[8:8 + 16])
        out.add(k.replace(':', '%3A').encode())
    return out


NEEDLES = leak_needles()


def scan_for_key(data):
    """bytes -> list of needles found (empty = clean)"""
    return sorted({n.decode('latin-1') for n in NEEDLES if n in data})


def scan_tree(root, since=None, max_bytes=64 << 20):
    hits = []
    if not root or not os.path.exists(root): return hits
    if os.path.isfile(root): items = [root]
    else:
        items = []
        for d, _, fs in os.walk(root):
            for f in fs: items.append(os.path.join(d, f))
    for p in items:
        try:
            st = os.lstat(p)
            if not os.path.isfile(p) or os.path.islink(p): continue
            if since and st.st_mtime < since: continue
            if st.st_size > max_bytes: continue
            with open(p, 'rb') as f: data = f.read()
            h = scan_for_key(data)
            if h: hits.append((p, h[:3]))
        except (OSError, PermissionError):
            pass
    return hits


# ── sandboxed runs ──────────────────────────────────────────────────────────────────────────────────────────────────
# Every stage tool runs under sandbox-exec: the real .env is unreadable, the live skill / the original jobs / the reference
# are unwritable, and (by default) only 127.0.0.1 is reachable — so no test can spend money or leak the real key.
def sandbox_profile(net='localhost', deny_write=()):
    rules = ['(version 1)', '(allow default)',
             '(deny file-read* (literal "%s"))' % REAL_ENV,
             '(deny file-read* (regex #"^/Users/[^/]+/Downloads/launch-videos/\\.env$"))']
    for p in (LIVE, LAUNCH, REF_MP4) + tuple(deny_write):
        rules.append('(deny file-write* (subpath "%s"))' % os.path.realpath(p))
    if net == 'none':
        rules.append('(deny network-outbound (remote ip "*:*"))')
    elif net == 'localhost':
        rules += ['(deny network-outbound (remote ip "*:*"))', '(allow network-outbound (remote ip "localhost:*"))']
    return '\n'.join(rules)


_SB_OK = None


def sandbox_ok():
    global _SB_OK
    if _SB_OK is None:
        try:
            r = subprocess.run(['/usr/bin/sandbox-exec', '-p', sandbox_profile('none'), '/usr/bin/true'], capture_output=True, timeout=20)
            _SB_OK = r.returncode == 0
        except Exception:
            _SB_OK = False
    return _SB_OK


class Run(object):
    def __init__(self, cmd, rc, out, err, secs, timed_out=False):
        self.cmd, self.rc, self.out, self.err, self.secs, self.timed_out = cmd, rc, out, err, secs, timed_out

    @property
    def text(self): return (self.out or '') + '\n' + (self.err or '')

    def brief(self, n=300):
        t = re.sub(r'\s+', ' ', self.text).strip()
        return t[-n:]


def base_env(extra=None, home=None, tmp=None, locale_c=True):
    keep = ['PATH', 'USER', 'LOGNAME', 'SHELL', 'TERM']
    env = {k: os.environ[k] for k in keep if k in os.environ}
    env['HOME'] = home or os.path.join(ACC, 'runs', '_fakehome')
    env['PYTHONDONTWRITEBYTECODE'] = '1'
    if tmp:
        os.makedirs(tmp, exist_ok=True); env['TMPDIR'] = tmp
    if locale_c:                                              # the C-locale trap: tools must not depend on a UTF-8 locale
        env['LC_ALL'] = 'C'; env['LANG'] = 'C'
    if extra: env.update(extra)
    return env


def run(cmd, env=None, cwd=None, timeout=600, net='localhost', sandbox=True, stdin=None, deny_write=(), log=None):
    t0 = time.time()
    full = (['/usr/bin/sandbox-exec', '-p', sandbox_profile(net, deny_write)] if sandbox and sandbox_ok() else []) + list(cmd)
    try:
        p = subprocess.run(full, env=env, cwd=cwd, capture_output=True, timeout=timeout, stdin=stdin if stdin is not None else subprocess.DEVNULL)
        r = Run(cmd, p.returncode, p.stdout.decode('utf-8', 'replace'), p.stderr.decode('utf-8', 'replace'), time.time() - t0)
    except subprocess.TimeoutExpired as e:
        r = Run(cmd, -999, (e.stdout or b'').decode('utf-8', 'replace'), (e.stderr or b'').decode('utf-8', 'replace'), time.time() - t0, True)
    if log:
        with open(log, 'a', encoding='utf-8') as f:
            f.write('\n$ %s\n  (cwd %s, rc %s, %.1fs%s)\n--- stdout\n%s\n--- stderr\n%s\n' % (
                ' '.join(_q(c) for c in cmd), cwd, r.rc, r.secs, ', TIMEOUT' if r.timed_out else '', r.out[-20000:], r.err[-20000:]))
    return r


def _q(s):
    s = str(s)
    return s if re.match(r'^[\w@%+=:,./-]+$', s) else "'" + s.replace("'", "'\\''") + "'"


def popen(cmd, env=None, cwd=None, net='localhost', sandbox=True, deny_write=()):
    full = (['/usr/bin/sandbox-exec', '-p', sandbox_profile(net, deny_write)] if sandbox and sandbox_ok() else []) + list(cmd)
    return subprocess.Popen(full, env=env, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=subprocess.DEVNULL)


# ── media helpers ───────────────────────────────────────────────────────────────────────────────────────────────────
def ffprobe_json(path, extra=('-show_streams', '-show_format')):
    r = subprocess.run([FFPROBE, '-v', 'error', '-of', 'json'] + list(extra) + [path], capture_output=True)
    try: return json.loads(r.stdout.decode('utf-8', 'replace'))
    except Exception: return {}


def count_frames(path):
    r = subprocess.run([FFPROBE, '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', path], capture_output=True)
    try: return int(r.stdout.decode().strip().split(',')[0])
    except Exception: return -1


def video_stream(path):
    j = ffprobe_json(path)
    v = [s for s in j.get('streams', []) if s.get('codec_type') == 'video']
    a = [s for s in j.get('streams', []) if s.get('codec_type') == 'audio']
    return (v[0] if v else None), a, j.get('format', {})


def decode_frames(path, w=None, h=None, fmt='rgb24', vf=None):
    """every decoded frame, in order, no dup/drop (passthrough); returns uint8 array [n, h, w, c]"""
    import numpy as np
    v, _, _ = video_stream(path)
    if v is None: return None
    W, H = int(v['width']), int(v['height'])
    filt = []
    if vf: filt.append(vf)
    if w and h: filt.append('scale=%d:%d:flags=area' % (w, h)); W, H = w, h
    cmd = [FFMPEG, '-v', 'error', '-i', path, '-map', '0:v:0', '-fps_mode', 'passthrough'] + (['-vf', ','.join(filt)] if filt else []) + ['-f', 'rawvideo', '-pix_fmt', fmt, '-']
    raw = subprocess.run(cmd, capture_output=True).stdout
    c = {'rgb24': 3, 'gray': 1}[fmt]
    n = len(raw) // (W * H * c)
    a = np.frombuffer(raw[:n * W * H * c], np.uint8).reshape(n, H, W, c)
    return a if c > 1 else a[..., 0]


def decode_audio(path, sr=44100, ch=1, stream='0:a:0'):
    import numpy as np
    raw = subprocess.run([FFMPEG, '-v', 'error', '-i', path, '-map', stream, '-ac', str(ch), '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64)
    return x.reshape(-1, ch) if ch > 1 else x


def stream_md5(path, sel, copy=False):
    cmd = [FFMPEG, '-v', 'error', '-i', path, '-map', sel] + (['-c', 'copy'] if copy else []) + ['-f', 'md5', '-']
    r = subprocess.run(cmd, capture_output=True)
    m = re.search(r'MD5=([0-9a-f]{32})', r.stdout.decode())
    return m.group(1) if m else None


# ── mock fal server ─────────────────────────────────────────────────────────────────────────────────────────────────
class Mock(object):
    def __init__(self, state_dir, files_dir):
        self.state = state_dir
        os.makedirs(state_dir, exist_ok=True)
        pj = os.path.join(state_dir, 'ports.json')
        if os.path.exists(pj): os.remove(pj)
        env = dict(os.environ, MOCK_KEYS='a=%s,b=%s,c=%s' % (KEY_A, KEY_B, KEY_C))
        self.proc = subprocess.Popen([NODE, os.path.join(LIB, 'mockfal.mjs'), '--state', state_dir, '--files', files_dir], env=env,
                                     stdout=open(os.path.join(state_dir, 'mock.out'), 'w'), stderr=subprocess.STDOUT)
        for _ in range(200):
            if os.path.exists(pj):
                try:
                    self.ports = json.load(open(pj, encoding='utf-8')); break
                except ValueError:
                    pass
            time.sleep(.05)
        else:
            raise RuntimeError('mock fal server did not start (see %s/mock.out)' % state_dir)
        self.api = 'http://127.0.0.1:%d' % self.ports['api']
        self.cdn = 'http://127.0.0.1:%d' % self.ports['cdn']
        self.ctlbase = 'http://127.0.0.1:%d' % self.ports['ctl']

    def ctl(self, path, body=None):
        data = json.dumps(body or {}).encode()
        req = urllib.request.Request(self.ctlbase + path, data=data if body is not None or path != '/log' else None,
                                     method='POST' if path != '/log' else 'GET', headers={'content-type': 'application/json'})
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode('utf-8'))

    def reset(self): return self.ctl('/reset', {})
    def scenario(self, **kw): return self.ctl('/scenario', kw)
    def file(self, name, src, **kw): return self.ctl('/file', dict(name=name, **{'from': src}, **kw))
    def log(self): return self.ctl('/log')
    def complete(self, rid): return self.ctl('/complete', {'id': rid})
    def create(self, endpoint, **sc): return self.ctl('/create', {'endpoint': endpoint, 'scenario': sc})

    def stop(self):
        try:
            self.proc.send_signal(signal.SIGTERM); self.proc.wait(5)
        except Exception:
            try: self.proc.kill()
            except Exception: pass


# ── reporting ───────────────────────────────────────────────────────────────────────────────────────────────────────
class Report(object):
    def __init__(self, path=None, quiet=False):
        self.rows, self.path, self.quiet = [], path, quiet

    def add(self, cid, status, detail='', tag=''):
        status = {True: 'PASS', False: 'FAIL', None: 'SKIP'}.get(status, status)
        self.rows.append((cid, status, detail, tag))
        line = '%-4s  %-34s %s%s' % (status, cid, ('[%s] ' % tag) if tag else '', detail)
        if not self.quiet: print(line, flush=True)
        if self.path:
            with open(self.path, 'a', encoding='utf-8') as f: f.write(line + '\n')

    def counts(self):
        c = {}
        for r in self.rows: c[r[1]] = c.get(r[1], 0) + 1
        return c


def need_real(*paths):
    miss = [p for p in paths if not os.path.exists(p)]
    return None if not miss else 'missing real file(s): ' + ', '.join(miss)


def flatten(obj, prefix=''):
    """JSON → [(path, value)] for schema-agnostic lookups"""
    out = []
    if isinstance(obj, dict):
        for k, v in obj.items(): out += flatten(v, prefix + '/' + str(k))
    elif isinstance(obj, list):
        for i, v in enumerate(obj): out += flatten(v, prefix + '[%d]' % i)
    else:
        out.append((prefix, obj))
    return out


def nums_at(obj, pat):
    rx = re.compile(pat, re.I)
    return [(p, float(v)) for p, v in flatten(obj) if rx.search(p) and isinstance(v, (int, float)) and not isinstance(v, bool)]
