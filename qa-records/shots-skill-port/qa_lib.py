# -*- coding: utf-8 -*-
"""Shared helpers for the shot-writer port's QA suites (2026-10-26). No network beyond 127.0.0.1, no keys, nothing
spent: the one paid path (gen.mjs --go) runs against mockfal.mjs with a fake key and a temporary HOME."""
import json, os, re, shutil, subprocess, sys, time

QA = os.path.dirname(os.path.abspath(__file__))
V = os.environ.get('SHOTS_QA_VIDEO') or os.path.expanduser('~/.claude/skills/product-launch-sting/video')
SHOTS = os.path.join(V, 'shots', 'shots.py')
PH = os.path.join(V, 'storyboard', 'placeholders.py')
CAST = os.path.join(V, 'casting', 'casting.py')
GEN = os.path.join(V, 'footage', 'gen.mjs')
ROLL = os.path.join(QA, 'rollback')
PY = '/usr/bin/python3'
RESULTS = []


def run(cmd, cwd=None, timeout=900, env=None):
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout, env=env)
    return p.returncode, p.stdout + p.stderr


def shots(args, cwd):
    return run([PY, '-B', SHOTS] + list(args), cwd=cwd)


def ph(args, cwd):
    return run([PY, '-B', PH] + list(args), cwd=cwd)


def cast(args, cwd):
    return run([PY, '-B', CAST] + list(args), cwd=cwd)


def check(name, ok, detail=''):
    RESULTS.append((name, bool(ok)))
    print('%s  %s%s' % ('PASS' if ok else 'FAIL', name, ('  [' + str(detail).strip().replace('\n', ' | ')[:400] + ']') if (detail and not ok) else ''))


def fresh(path):
    shutil.rmtree(path, ignore_errors=True)
    os.makedirs(path)
    return path


def write_json(path, obj):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(json.dumps(obj, indent=1, ensure_ascii=False) + '\n')


def read(path, mode='r'):
    with open(path, mode, **({} if 'b' in mode else {'encoding': 'utf-8'})) as f:
        return f.read()


def load(path):
    return json.loads(read(path))


def done(suite):
    n, ok = len(RESULTS), sum(1 for _, r in RESULTS if r)
    print('\n%s: %d/%d PASS' % (suite, ok, n))
    sys.exit(0 if ok == n and n else 1)


def png(path, w=64, h=36, color=(120, 130, 140)):
    from PIL import Image
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    Image.new('RGB', (w, h), color).save(path)
    return path


def jpg(path, w=64, h=36, color=(120, 130, 140)):
    from PIL import Image
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    Image.new('RGB', (w, h), color).save(path, quality=90)
    return path


PLATES = {
    'root': '..', 'out': 'assets/plates', 'aspect': '16x9', 'crops': [], 'kind': 'AI FOOTAGE',
    'cast': {'hero': {'body': '#e6e8eb', 'accent': '#e8611e', 'skin': '#a7795a', 'hair': '#1b1b1f'}},
    'defaults': {'look': 'overcast', 'grain': 4},
    'plates': {
        'S01': {'line': 'She walks into the empty office at dawn', 'lens': '35 mm', 'move': 'slow push in', 'look': 'dawn',
                'horizon': {'y': 0.7, 'color': '#3a3d44'},
                'fx': [{'kind': 'glow', 'x': 0.8, 'y': 0.35, 'r': 0.3}],
                'shapes': [{'kind': 'rect', 'box': [0.06, 0.22, 0.3, 0.7], 'color': '#2b2f36'}],
                'figures': [{'who': 'hero', 'x': 0.55, 'feet': 0.92, 'height': 0.6, 'pose': 'walk', 'facing': 'left', 'tag': 'hero walks in'}],
                'props': [{'kind': 'phone', 'x': 0.47, 'y': 0.62, 'w': 0.025}]},
        'S02': {'line': 'Two founders on the ridge', 'lens': '50 mm', 'move': 'locked off', 'look': 'golden',
                'horizon': {'y': 0.62, 'color': '#7a6a50'},
                'figures': [{'who': 'hero', 'x': 0.42, 'feet': 0.83, 'height': 0.45, 'pose': 'stand', 'facing': 'right'},
                            {'x': 0.6, 'feet': 0.84, 'height': 0.43, 'pose': 'stand', 'facing': 'camera'}]},
        'S03': {'line': 'An empty desert road', 'lens': '35 mm', 'move': 'drone push',
                'horizon': {'y': 0.45, 'color': '#c9a46b', 'line': True}},
        'S04': {'line': 'Close on her, back to us, at the laptop', 'lens': '85 mm', 'move': 'slow push',
                'figures': [{'who': 'hero', 'x': 0.38, 'feet': 1.25, 'height': 1.1, 'pose': 'bust', 'facing': 'away'},
                            {'x': 0.8, 'feet': 0.9, 'height': 0.3, 'pose': 'sit', 'facing': 'left'},
                            {'x': 0.2, 'feet': 0.6, 'height': 0.3, 'pose': 'float', 'facing': 'right'}],
                'props': [{'kind': 'laptop', 'x': 0.6, 'y': 0.85, 'w': 0.2}, {'kind': 'screen', 'x': 0.75, 'y': 0.3, 'w': 0.1},
                          {'kind': 'card', 'x': 0.1, 'y': 0.5, 'w': 0.08}, {'kind': 'box', 'x': 0.9, 'y': 0.8, 'w': 0.05},
                          {'kind': 'ball', 'x': 0.3, 'y': 0.9, 'w': 0.03}],
                'fx': [{'kind': 'rain', 'n': 200}, {'kind': 'fog', 'n': 4}, {'kind': 'stars', 'n': 100}, {'kind': 'vignette', 'strength': .3}],
                'shapes': [{'kind': 'ellipse', 'box': [0.55, 0.1, 0.95, 0.5], 'color': '#334455', 'blur': 40},
                           {'kind': 'poly', 'points': [[0, 0.8], [0.4, 0.75], [0.4, 1], [0, 1]], 'color': '#111111'},
                           {'kind': 'line', 'points': [[0.1, 0.3], [0.3, 0.2]], 'width': 6}]},
    },
}


def plate_job(d, plates=None):
    """a job folder with beats.yaml and tools/placeholders.json"""
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, 'beats.yaml'), 'w', encoding='utf-8') as f:
        f.write('title: qa\naspects: [16x9]\nshots: []\n')
    write_json(os.path.join(d, 'tools', 'placeholders.json'), plates or json.loads(json.dumps(PLATES)))
    return d


def casting_job(d):
    """tools/casting.json from `casting.py init`, every <…> hint filled with plain words, a lock (hero), a second
    person (friend: a states entry with no refs), a location (office)"""
    rc, out = cast(['init', d], d)
    if rc not in (0, 1):
        raise RuntimeError('casting.py init failed: %s' % out)
    p = os.path.join(d, 'tools', 'casting.json')
    t = read(p)
    t = re.sub(r'<(?:FILL:|[a-z])[^<>\n]{0,300}>', 'plain words', t)
    cs = json.loads(t)
    assert list(cs.get('lock') or {}) == ['hero'], cs.get('lock')
    cs.setdefault('states', {})['friend'] = {'refs': [], 'prompt': '{SHEET} The person is a man of about 60. {PROPORTIONS} {TAIL}', 'pin': {}}
    cs.setdefault('locations', {})['office'] = {'refs': [], 'prompt': 'An empty office at dawn. LENS GATE: one metre high, four metres back; {FOV:35}. {PLATE_TAIL}'}
    cs['stills'] = {}
    write_json(p, cs)
    return cs


def shots_spec(**over):
    s = {'root': '..', 'casting': 'casting.json', 'model': 'h3', 'aspect': '16:9',
         'people': {'hero': {'sheet': 'hero', 'is': 'the founder'}, 'friend': {'sheet': 'friend', 'is': 'her co-founder'}},
         'places': {'office': {'loc': 'office'}}, 'products': {}, 'shots': {}}
    s.update(over)
    return s


class Mock:
    """mockfal.mjs on 127.0.0.1 (copied from the hf02 acceptance harness): a fake fal queue + CDN"""
    KEY = 'fake-key-for-the-mock-0123456789'

    def __init__(self, state):
        import urllib.request
        self.ur = urllib.request
        fresh(state)
        env = dict(os.environ, MOCK_KEYS='a=%s' % self.KEY)
        self.p = subprocess.Popen(['node', os.path.join(QA, 'mockfal.mjs'), '--state', state, '--files', state], env=env,
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        pj = os.path.join(state, 'ports.json')
        for _ in range(100):
            if os.path.exists(pj) and os.path.getsize(pj):
                break
            time.sleep(.1)
        ports = load(pj)
        self.api, self.cdn, self.ctl = ['http://127.0.0.1:%d' % ports[k] for k in ('api', 'cdn', 'ctl')]

    def post(self, path, obj):
        req = self.ur.Request(self.ctl + path, data=json.dumps(obj).encode(), headers={'content-type': 'application/json'}, method='POST')
        return json.loads(self.ur.urlopen(req, timeout=10).read())

    def log(self):
        return json.loads(self.ur.urlopen(self.ctl + '/log', timeout=10).read())['log']

    def env(self, home):
        os.makedirs(home, exist_ok=True)
        return dict(os.environ, HOME=home, FAL_KEY=self.KEY, FAL_QUEUE_URL=self.api, FAL_DL_ATTEMPTS='3', FAL_DL_TIMEOUT='20')

    def stop(self):
        self.p.terminate()
        try:
            self.p.wait(5)
        except Exception:
            self.p.kill()
