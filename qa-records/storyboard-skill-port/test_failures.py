# -*- coding: utf-8 -*-
"""QA 3 · failure paths. Every refusal names the problem, exits 2 and leaves files as they were; warnings exit 1.
One storyboard render; the phone cases that need a bad board edit the rendered board.html instead of re-rendering."""
import copy, hashlib, json, os, re, shutil, time
from qa_lib import QA, V, LV, PY, run, ph, phone, check, fresh, write_json, done, plates_spec, stub_job

X = fresh(os.path.join(QA, 'out', 'failures'))
sha = lambda p: hashlib.sha1(open(p, 'rb').read()).hexdigest()


def spec_case(name, mutate, expect_rc=2, must=(), cmd=('draw',)):
    d = stub_job(fresh(os.path.join(X, name)))
    s = plates_spec()
    mutate(s)
    write_json(os.path.join(d, 'tools', 'placeholders.json'), s)
    rc, out = ph(list(cmd), d)
    drawn = os.path.isdir(os.path.join(d, 'assets', 'plates')) and os.listdir(os.path.join(d, 'assets', 'plates'))
    ok = rc == expect_rc and all(m in out for m in must) and (expect_rc != 2 or not drawn)
    return ok, out, d


# ---- placeholders.py: the spec
ok, out, _ = spec_case('typo', lambda s: s['plates']['name'].update(figure=s['plates']['name'].pop('figures')), must=('unknown key figure',))
check('X1 a typo\'d key ("figure") is refused, nothing drawn', ok, out)


def many(s):
    p = s['plates']['ask']
    p['look'] = 'sunset-ish'
    p['figures'][0]['pose'] = 'kneel'
    p['figures'][1]['facing'] = 'up'
    p['props'][0]['kind'] = 'tablet'
    p['fx'][0]['kind'] = 'snow'
    p['shapes'][0]['color'] = 'brown'
    s['plates']['name']['horizon']['y'] = 1.4
    s['plates']['hook']['props'][0]['x'] = 'middle'
ok, out, _ = spec_case('many', many)
n = len(re.findall(r'^\s+spec|^\s+plates', out, re.M))
check('X2 eight different mistakes are all listed in one refusal', ok and '8 problems' in out, out)
ok, out, _ = spec_case('outside', lambda s: s.update(out='../../elsewhere'), must=('out: a folder inside the job folder',))
check('X3a out outside the job folder is refused', ok, out)
ok, out, _ = spec_case('absolute', lambda s: s.update(out='/tmp/plates'), must=('out: a folder inside the job folder',))
check('X3b an absolute out is refused', ok, out)
ok, out, _ = spec_case('badid', lambda s: s['plates'].update({'S 01': s['plates'].pop('name')}), must=('an id starts with a letter',))
check('X4 a plate id with a space is refused', ok, out)
ok, out, _ = spec_case('font', lambda s: s.update(font='nope/Bold.ttf'), must=('font: a .ttf',))
check('X5 a missing font file is refused', ok, out)
ok, out, _ = spec_case('who', lambda s: s['plates']['name']['figures'][0].update(who='villain'), must=('"villain" is not in cast',))
check('X6 a figure whose wardrobe is not in cast is refused', ok, out)
ok, out, _ = spec_case('crop', lambda s: s.update(crops=['4x3']), must=('crops:',))
check('X7 an unknown crop aspect is refused', ok, out)
ok, out, _ = spec_case('noline', lambda s: s['plates']['name'].pop('line'), must=('name.line',))
check('X8 a plate with no line is refused', ok, out)
ok, out, _ = spec_case('boolnum', lambda s: s['plates']['name']['figures'][0].update(height=True), must=('height',))
check('X9 true for a number is refused', ok, out)
d = stub_job(fresh(os.path.join(X, 'nan')))
os.makedirs(os.path.join(d, 'tools'))
txt = json.dumps(plates_spec()).replace('"x": 0.5, "feet": 0.9', '"x": NaN, "feet": 0.9', 1)
open(os.path.join(d, 'tools', 'placeholders.json'), 'w').write(txt)
rc, out = ph(['draw'], d)
check('X10 NaN in the spec is refused', rc == 2 and 'x' in out and 'a number' in out, out)
d = stub_job(fresh(os.path.join(X, 'badjson')))
os.makedirs(os.path.join(d, 'tools'))
open(os.path.join(d, 'tools', 'placeholders.json'), 'w').write('{"plates": {')
rc, out = ph(['draw'], d)
check('X11 a broken JSON file is refused', rc == 2 and 'not readable JSON' in out, out)
d = fresh(os.path.join(X, 'nospec'))
rc, out = ph(['draw'], d)
check('X12 no spec: refused with "run placeholders.py init"', rc == 2 and 'init' in out, out)
ok, out, _ = spec_case('inverted', lambda s: s['plates']['ask']['shapes'].append({'kind': 'rect', 'box': [0.5, 0.5, 0.2, 0.8]}), must=('x1 > x0',))
check('X13 an inverted box is refused', ok, out)

# ---- placeholders.py: files and commands
d = stub_job(fresh(os.path.join(X, 'files')))
write_json(os.path.join(d, 'tools', 'placeholders.json'), plates_spec())
before = open(os.path.join(d, 'tools', 'placeholders.json'), 'rb').read()
rc, out = ph(['init'], d)
check('X14 init refuses to overwrite a spec, and leaves it', rc == 2 and 'already exists' in out and open(os.path.join(d, 'tools', 'placeholders.json'), 'rb').read() == before, out)
rc, out = ph(['draw', 'nosuch'], d)
check('X15 draw of an id not in the spec is refused', rc == 2 and 'not in the spec: nosuch' in out, out)
os.makedirs(os.path.join(d, 'assets', 'plates'))
real = os.path.join(d, 'assets', 'plates', 'name.png')
from PIL import Image
Image.new('RGB', (64, 36), (10, 200, 30)).save(real)
h = sha(real)
rc, out = ph(['draw'], d)
check('X16 a real image in the way is refused, nothing drawn, it is untouched', rc == 2 and 'name.png' in out and sha(real) == h
      and not os.path.exists(os.path.join(d, 'assets', 'plates', 'hook.png')), out)
os.remove(real)
target = os.path.join(d, 'elsewhere.png')
Image.new('RGB', (8, 8)).save(target)
os.symlink(target, real)
ht = sha(target)
rc, out = ph(['draw'], d)
check('X17 a symlink in the way is refused; the link and its target are untouched', rc == 2 and os.path.islink(real) and sha(target) == ht, out)
os.remove(real)
rc, out = ph(['draw'], d)
check('X18 with the way clear, draw makes 3 plates', rc in (0, 1) and all(os.path.isfile(os.path.join(d, 'assets', 'plates', n + '.png')) for n in ('name', 'hook', 'ask')), out)
rc, out = ph(['draw', 'name'], d)
check('X19 a plate is redrawn in place (its own marker)', rc in (0, 1) and 'name.png' in out, out)
leftovers = [f for f in os.listdir(os.path.join(d, 'assets', 'plates')) if f.startswith('.')]
check('X20 no temp files left behind', not leftovers, str(leftovers))
rc, out = run([PY, '-B', os.path.join(V, 'storyboard', 'placeholders.py'), 'draw', '--she'], cwd=d)
check('X21 an abbreviated flag (--she) is refused, not guessed', rc == 2, out)
rc, out = ph(['status', '--job', d], d)
check('X22 status with no timeline is refused (exit 2)', rc == 2 and '--grid' in out, out)

# ---- placeholders.py: warnings (exit 1)
ok, out, _ = spec_case('longlabel', lambda s: (s.update(crops=['9x16']), s['plates']['name'].update(line=' '.join(['a very long line about the shot'] * 9))), expect_rc=1, must=('the label runs to',))
check('X23 a label past four lines warns (exit 1)', ok, out)
ok, out, _ = spec_case('offplate', lambda s: s['plates']['name']['figures'].append({'x': 1.45, 'feet': 0.5, 'height': 0.05}), expect_rc=1, must=('entirely off the plate',))
check('X24 a figure entirely off the plate warns (exit 1)', ok, out)

# ---- phone.mjs: one sample job, one render
J = os.path.join(X, 'job')
rc, out = run(['node', LV, '--job', J, '--init', '--title', 'Fail Test'])
rc, out = phone(['--job', J])
check('Y1 no timeline yet: refused, says to run --storyboard', rc == 2 and '--storyboard' in out, out)
rc, out = run(['node', LV, '--job', J, '--storyboard', '--aspect', '16x9'])
check('Y2 the sample job storyboards (16:9)', rc == 0, out[-400:])
tl = json.load(open(os.path.join(J, 'out', 'main', 'timeline.json')))
slug = tl['slug']
for args, msg, name in ((['--aspect', '16x9'], 'missing --job', 'Y3a no --job'), (['--job', J, '--bogus'], 'unknown flag --bogus', 'Y3b an unknown flag'),
                        (['--job', J, '--aspect', '4x3'], '--aspect: one of', 'Y3c a bad aspect'), (['--job', J, '--dpr', '9'], '--dpr: a number', 'Y3d dpr out of range'),
                        (['--job', J, '--quality', 'abc'], '--quality: a number', 'Y3e quality not a number'), (['--job', J, '--cut', '../x'], '--cut: a cut name', 'Y3f a cut with a path'),
                        (['--job', J, '--cover'], '--cover: a YAML', 'Y3g --cover with no file'), (['--job', J, '--cover', '/nope.yaml'], '--cover: no file', 'Y3h a cover that is not there')):
    rc, out = phone(args)
    check(name + ' is refused (exit 2)', rc == 2 and msg in out, out)
other = [a for a in ('9x16', '1x1') if a in tl.get('aspects', [])]
if other:
    rc, out = phone(['--job', J, '--aspect', other[0]])
    check('Y4 no board for %s yet: refused' % other[0], rc == 2 and 'no ' in out and '--storyboard --aspect %s' % other[0] in out, out)
rc, out = phone(['--job', J])
pdf = os.path.join(J, '%s-storyboard-16x9-phone.pdf' % slug)
check('Y5 the plain phone edition builds', rc == 0 and os.path.isfile(pdf), out)

board = os.path.join(J, 'out', 'main', '16x9', 'board', 'board.html')
os.utime(os.path.join(J, 'beats.yaml'), (time.time() + 5, time.time() + 5))
rc, out = phone(['--job', J])
check('Y6 beats.yaml newer than the board: refused as stale', rc == 2 and 'storyboard again' in out, out)
os.utime(board, (time.time() + 10, time.time() + 10))
rc, out = phone(['--job', J])
check('Y7 a fresh board passes again', rc == 0, out)

covers = {
    'Y8a an unknown cover key': ('titel: x\n', 'unknown key "titel"'),
    'Y8b the YAML ": " trap in a read line': ('read:\n  - Note: this becomes a key\n', 'read: a list of lines'),
    'Y8c a table row with two cells': ('table:\n  title: T\n  rows:\n    - [a, b]\n', 'table:'),
    'Y8d a cover that is a list': ('- a\n- b\n', 'an object with title'),
    'Y8e an empty title': ('title: ""\n', 'title: text'),
    'Y8f broken YAML': ('title: [unclosed\n', 'not readable YAML'),
}
for name, (body, msg) in covers.items():
    c = os.path.join(X, 'cover-%s.yaml' % name[:3])
    open(c, 'w', encoding='utf-8').write(body)
    rc, out = phone(['--job', J, '--cover', c])
    check(name + ' is refused', rc == 2 and msg in out, out)

rc, out = phone(['--job', J, '--max-mb', '1', '--quality', '100', '--dpr', '3'])
check('Y9 over --max-mb: written, exit 1, says how to shrink it', rc == 1 and os.path.isfile(pdf) and 'lower --quality' in out, out)

html0 = open(board, encoding='utf-8').read()
def board_with_note(words):
    note = '<div class="note">%s</div>' % ' '.join(['the camera keeps drifting while she reads.'] * words)
    t = html0.replace('</div></div>', '</div>' + note + '</div>', 1) if '<div class="note">' not in html0 else re.sub(r'<div class="note">.*?</div>', note, html0, count=1)
    open(board, 'w', encoding='utf-8').write(t)
    os.utime(board, (time.time() + 20, time.time() + 20))
board_with_note(55)
rc, out = phone(['--job', J])
pj = json.load(open(os.path.join(J, 'out', 'main', '16x9', 'board-phone', 'pages.json')))
check('Y10 a long note: the card gives up still height and fits (exit 0), and says so', rc == 0 and pj['shrunk'] and pj['shrunk'][0]['card'] == 1 and 50 <= pj['shrunk'][0]['pct'] < 100 and 'its still shrunk' in out, out + str(pj.get('shrunk')))
board_with_note(400)
rc, out = phone(['--job', J])
check('Y11 a note longer than a page: refused, says to shorten it', rc == 2 and 'shorten its note' in out, out)
t = re.sub(r'\n    <div class="card">', '\n    <div class="kard">', html0, count=1)
open(board, 'w', encoding='utf-8').write(t)
os.utime(board, (time.time() + 30, time.time() + 30))
rc, out = phone(['--job', J])
check('Y12 a board whose card count differs from the timeline: refused', rc == 2 and 'cards but the timeline' in out, out)
open(board, 'w', encoding='utf-8').write(html0)
os.utime(board, (time.time() + 40, time.time() + 40))
rc, out = phone(['--job', J])
check('Y13 the restored board builds again', rc == 0, out)
left = [f for f in os.listdir(J) if '.tmp-' in f]
check('Y14 no temp PDF left behind', not left, str(left))
done('QA 3 failures')
