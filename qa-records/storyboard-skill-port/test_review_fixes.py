# -*- coding: utf-8 -*-
"""QA 4 · every review finding, planted again. Sonnet = S1–S17 (review-sonnet/REPORT.md); later rounds append theirs.
Each check fails on the code before its fix."""
import json, os, re, shutil, signal, subprocess, sys, time
from qa_lib import QA, V, LV, PY, PH, run, ph, phone, check, fresh, write_json, done, plates_spec, stub_job

R = fresh(os.path.join(QA, 'out', 'review-fixes'))
S = os.path.dirname(V)
doc = lambda p: open(os.path.join(S, p), encoding='utf-8').read()


def plate_job(name, spec):
    d = stub_job(fresh(os.path.join(R, name)))
    write_json(os.path.join(d, 'tools', 'placeholders.json'), spec)
    return d


def flat(line='a desk lamp', **kw):
    p = {'line': line, 'look': 'studio', 'grain': 0}
    p.update(kw)
    return {'plates': {'P': p}}


def img(d, name='P'):
    import numpy as np
    from PIL import Image
    return np.asarray(Image.open(os.path.join(d, 'assets', 'plates', name + '.png')).convert('RGB')).astype(int)


# S1 · margins survive the engine's default move; the three bg fields are documented everywhere a user looks
d = plate_job('s1', flat())
rc, out = ph(['draw'], d)
a = img(d)
dark = (a.sum(axis=2) < 200)                                   # the label box over #8a8a8a
ys, xs = dark.nonzero()
check('S1a the label sits 7% inside the plate (x ≥ 134, y ≥ 75 on 1920×1080)', rc == 0 and xs.min() >= 133 and ys.min() >= 74, '%s %s %s' % (rc, xs.min() if len(xs) else None, ys.min() if len(ys) else None))
check('S1b draw\'s hint names bgMove: none, bgDim: 0, push: 0', 'bgMove: none' in out and 'bgDim: 0' in out and 'push: 0' in out, out)
st = json.load(open(os.path.join(V, 'storyboard', 'starter.json')))
check('S1c the starter note and STORYBOARD.md say to set them', 'bgMove: none' in st['_note'] and 'bgMove: none' in doc('video/STORYBOARD.md'))

# S2 · the contact sheet is guarded, atomic and marked
d = plate_job('s2', flat())
os.makedirs(os.path.join(d, 'assets', 'plates'))
sp = os.path.join(d, 'assets', 'plates', 'placeholders-sheet.jpg')
open(sp, 'w').write('PRECIOUS USER FILE')
rc, out = ph(['draw', '--sheet'], d)
check('S2a a user file at placeholders-sheet.jpg is refused and untouched', rc == 2 and open(sp).read() == 'PRECIOUS USER FILE' and not os.path.exists(os.path.join(d, 'assets', 'plates', 'P.png')), out)
os.remove(sp)
outside = os.path.join(R, 's2-outside.txt'); open(outside, 'w').write('keep me')
os.symlink(outside, sp)
rc, out = ph(['draw', '--sheet'], d)
check('S2b a symlink at the sheet is refused; its target untouched', rc == 2 and open(outside).read() == 'keep me', out)
os.remove(sp)
rc, out = ph(['draw', '--sheet'], d)
rc2, out2 = ph(['draw', '--sheet'], d)
from PIL import Image
check('S2c the sheet it made carries its marker and is redrawn in place', rc == 0 and rc2 == 0 and Image.open(sp).info.get('comment') == b'lv-placeholder-sheet', out + out2)

# S3 · the END inset stays inside every crop (portrait plate, 16:9 crop)
spec = {'aspect': '9x16', 'crops': ['16x9'], 'plates': {'P': {'line': 'an empty corridor', 'look': 'studio', 'grain': 0,
        'end': {'label': 'MCU, she looks up', 'look': 'night'}}}}
d = plate_job('s3', spec)
rc, out = ph(['draw'], d)
a = img(d)
crop_y0, crop_y1 = (1920 - 1080 * 1080 / 1920) / 2, (1920 + 1080 * 1080 / 1920) / 2
white_rows = [y for y in range(a.shape[0]) if ((a[y] > 235).all(axis=1)).sum() > 100]
outside_rows = [y for y in white_rows if y < crop_y0 - 2 or y > crop_y1 + 2]
check('S3 the END inset (its white frame) stays inside the 16:9 crop, or is left out with a warning',
      rc in (0, 1) and not outside_rows and (white_rows or 'no room for the END inset' in out), '%s rows outside, %s' % (len(outside_rows), out))

# S4 · root must be the job folder
e = fresh(os.path.join(R, 's4'))
job = stub_job(os.path.join(e, 'job'))
write_json(os.path.join(job, 'p.json'), flat())
rc, out = ph(['draw', '--spec', 'p.json'], job)
check('S4a a spec beside beats.yaml with the default root ".." is refused (the parent has no beats.yaml)', rc == 2 and 'has no beats.yaml' in out and not os.path.exists(os.path.join(e, 'assets')), out)
os.remove(os.path.join(job, 'p.json'))
rc, out = ph(['init', '--spec', 'p.json', '--shots', 'P'], job)
s = json.load(open(os.path.join(job, 'p.json')))
check('S4b init writes root as the folder it ran in', rc == 0 and s['root'] == '.', '%s %s' % (out, s.get('root')))

# S5 · bad inputs are refused (exit 2), never a crash
cases = {
    'S5a aspect as a list': lambda s: s.update(aspect=['16x9']),
    'S5b a crop as a list': lambda s: s.update(crops=[['16x9']]),
    'S5c who as a list': lambda s: s['plates']['name']['figures'][0].update(who=['hero']),
    'S5d a 400-digit integer': lambda s: s['plates']['name']['figures'][0].update(x=10 ** 400),
}
for name, mut in cases.items():
    d = stub_job(fresh(os.path.join(R, 's5-%s' % name[2:4])))
    sp_ = plates_spec(); mut(sp_)
    write_json(os.path.join(d, 'tools', 'placeholders.json'), sp_)
    rc, out = ph(['draw'], d)
    check(name + ' → exit 2, listed', rc == 2 and 'Traceback' not in out, out)
d = plate_job('s5-font', dict(flat(), font='fake.ttf'))
open(os.path.join(d, 'tools', 'fake.ttf'), 'w').write('not a font')
rc, out = ph(['check'], d)
check('S5e a text file as the font: check refuses it (exit 2)', rc == 2 and 'not a font' in out, out)
d = plate_job('s5-outfile', dict(flat(), out='assets/plates'))
os.makedirs(os.path.join(d, 'assets')); open(os.path.join(d, 'assets', 'plates'), 'w').write('x')
rc, out = ph(['draw'], d)
check('S5f out that is a file: refused (exit 2)', rc == 2 and 'is a file' in out, out)
d = plate_job('s5-underfile', dict(flat(), out='assets/f/plates'))
os.makedirs(os.path.join(d, 'assets')); open(os.path.join(d, 'assets', 'f'), 'w').write('x')
rc, out = ph(['draw'], d)
check('S5g out under a file: refused (exit 2)', rc == 2 and 'under a file' in out, out)
d = plate_job('s5-nopil', flat())
p = subprocess.run([PY, '-B', '-c', "import sys; sys.modules['PIL'] = None; sys.argv = ['placeholders.py', 'draw']; "
                    "exec(compile(open(%r).read(), 'placeholders.py', 'exec'), {'__name__': '__main__', '__file__': %r})" % (PH, PH)],
                   cwd=d, capture_output=True, text=True)
check('S5h no Pillow: refused with the pip hint (exit 2)', p.returncode == 2 and 'pip3 install numpy pillow' in p.stderr, p.stderr[-300:])

# S6 · the board's notes reach the phone edition
J = os.path.join(R, 'job')
run(['node', LV, '--job', J, '--init', '--title', 'Review Fixes'])
rc, out = run(['node', LV, '--job', J, '--storyboard', '--aspect', '16x9'])
check('S6a the sample job storyboards', rc == 0, out[-300:])
board = os.path.join(J, 'out', 'main', '16x9', 'board', 'board.html')
html0 = open(board, encoding='utf-8').read()
tl = json.load(open(os.path.join(J, 'out', 'main', 'timeline.json')))
warns = '<div class="warns"><b>Notes before the film</b><br>' + '<br>'.join('s%d: copy shrunk to fit: "a long line" 224→103.8px — shorten it?' % i for i in range(40)) + '</div>'
# since the motion kit (2026-10-27) the sample job's board has notes of its own: the 40 replace them
open(board, 'w', encoding='utf-8').write(re.sub(r'<div class="warns">.*?</div>', lambda m: warns, html0, count=1, flags=re.S)
                                         if 'class="warns"' in html0 else html0.replace('</body>', warns + '</body>'))
os.utime(board, (time.time() + 5, time.time() + 5))
rc, out = phone(['--job', J])
pj = json.load(open(os.path.join(J, 'out', 'main', '16x9', 'board-phone', 'pages.json')))
npages = len(os.listdir(os.path.join(J, 'out', 'main', '16x9', 'board-phone'))) - 1
check('S6b 40 board notes become notes pages after the cards', rc == 0 and pj.get('notes') == 40 and npages >= 1 + len(pj['shots_per_page']) + 2 and 'of notes' in out, '%s %s %s' % (out, pj.get('notes'), npages))
open(board, 'w', encoding='utf-8').write(html0)
os.utime(board, (time.time() + 10, time.time() + 10))

# S7 · GUIDE step 5 waits for the storyboard
check('S7 GUIDE step 5: footage and casting only after the step 4 gate', 'footage and casting only after the step 4 gate' in doc('video/GUIDE.md'))

# S8 · missing glyphs warn; a long word breaks
d = plate_job('s8', flat('太空站里的宇航员 walks in'))
rc, out = ph(['draw'], d)
check('S8a CJK text with Arial: warned (exit 1), names the characters', rc == 1 and 'no glyph for' in out and '太' in out, out)
d = plate_job('s8b', dict(flat('太空站里的宇航员 walks in'), font='/System/Library/Fonts/Hiragino Sans GB.ttc'))
rc, out = ph(['draw'], d)
check('S8b the same with Hiragino Sans GB: no glyph warning', rc == 0 and 'no glyph' not in out, out)
d = plate_job('s8c', flat('A' * 200))
rc, out = ph(['draw'], d)
a = img(d)
xs = ((a.sum(axis=2) < 200)).nonzero()[1]
check('S8c a 200-letter word breaks inside the label (nothing past x = 1920 − 134)', rc in (0, 1) and xs.max() <= 1920 - 133, str(xs.max()))

# S9 · a killed run leaves no temp file; a dead run's temp is swept
spec = {'plates': {'P%02d' % i: {'line': 'plate %d' % i, 'look': 'dusk', 'fx': [{'kind': 'glow', 'x': .5, 'y': .5}, {'kind': 'vignette'}]} for i in range(30)}}
d = plate_job('s9', spec)
left = []
for delay in (0.9, 1.6, 2.3):
    pr = subprocess.Popen([PY, '-B', PH, 'draw'], cwd=d, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(delay); pr.send_signal(signal.SIGTERM); rc = pr.wait()
    left += [f for f in os.listdir(os.path.join(d, 'assets', 'plates')) if '.tmp-' in f]
check('S9a SIGTERM mid-draw: exit 143, no temp file left (3 tries)', rc in (143, 0, 1) and not left, '%s %s' % (rc, left))
dead = os.path.join(d, 'assets', 'plates', '.P00.png.tmp-999999')
open(dead, 'w').write('x')
rc, out = ph(['draw', 'P00'], d)
check('S9b a dead run\'s temp file is swept by the next draw', not os.path.exists(dead), out)

# S10 · stale timeline (status) and stale plate (phone)
d = stub_job(fresh(os.path.join(R, 's10')))
os.makedirs(os.path.join(d, 'out', 'main'))
write_json(os.path.join(d, 'out', 'main', 'timeline.json'), {'shots': []})
os.utime(os.path.join(d, 'beats.yaml'), (time.time() + 5, time.time() + 5))
rc, out = ph(['status', '--job', d], d)
check('S10a status refuses a timeline older than beats.yaml', rc == 2 and '--grid' in out, out)
tlp = os.path.join(J, 'out', 'main', 'timeline.json')
tl_raw = open(tlp, encoding='utf-8').read()
t2 = json.loads(tl_raw)
t2['shots'][0]['bg'] = 'assets/new-footage.png'          # a shot whose still came from a file …
Image.new('RGB', (16, 9)).save(os.path.join(J, 'assets', 'new-footage.png'))
os.utime(os.path.join(J, 'assets', 'new-footage.png'), (time.time() + 20, time.time() + 20))   # … that changed after the board
open(tlp, 'w', encoding='utf-8').write(json.dumps(t2))
os.utime(tlp, (os.path.getmtime(board) - 1, os.path.getmtime(board) - 1))
rc, out = phone(['--job', J])
check('S10b a file a shot uses, newer than the board: phone refuses and names it', rc == 2 and 'assets/new-footage.png' in out and 'storyboard' in out, out)
open(tlp, 'w', encoding='utf-8').write(tl_raw)
os.utime(tlp, (os.path.getmtime(board) - 1, os.path.getmtime(board) - 1))
os.remove(os.path.join(J, 'assets', 'new-footage.png'))

# S11 · another tool's PDF is never replaced
pdf = os.path.join(J, '%s-storyboard-16x9-phone.pdf' % tl['slug'])
shutil.copy(pdf, pdf + '.ours')
open(pdf, 'wb').write(b'%PDF-1.4\n1 0 obj << /Creator (Keynote) >> endobj\n%%EOF\n')
rc, out = phone(['--job', J])
check('S11a a same-named PDF made by Keynote is refused and kept', rc == 2 and 'Keynote' in out and open(pdf, 'rb').read().startswith(b'%PDF-1.4\n1 0 obj << /Creator (Keynote)'), out)
os.replace(pdf + '.ours', pdf)
rc, out = phone(['--job', J])
check('S11b its own PDF is replaced as usual', rc == 0, out)

# S12 · no Chrome → a plain refusal
p = subprocess.run(['node', os.path.join(V, 'storyboard', 'phone.mjs'), '--job', J], capture_output=True, text=True, env=dict(os.environ, CHROME_PATH='/nonexistent/chrome'))
check('S12 no Chrome: exit 2, no stack trace', p.returncode == 2 and '    at ' not in p.stderr, p.stderr[-300:])

# S13 · stricter validation where it matters, looser where it misfired
d = plate_job('s13a', flat('he says <wow> and a < b > c'))
rc, out = ph(['check'], d)
check('S13a "<wow>" in a line is just text now', rc == 0, out)
for name, mut, msg in (('S13b "thirds": "false" is refused', lambda p: p.update(thirds='false'), 'true or false'),
                       ('S13c a vignette with a colour is a typo', lambda p: p.update(fx=[{'kind': 'vignette', 'color': '#f00'}]), 'unknown key color'),
                       ('S13d a line shape with a radius is a typo', lambda p: p.update(shapes=[{'kind': 'line', 'points': [[0, 0], [1, 1]], 'radius': .1}]), 'unknown key radius')):
    sp_ = flat(); mut(sp_['plates']['P'])
    d = plate_job('s13-' + name[2:5], sp_)
    rc, out = ph(['check'], d)
    check(name, rc == 2 and msg in out, out)
d = stub_job(fresh(os.path.join(R, 's13e')))
rc, out = ph(['init', '--shots', '_intro,S02'], d)
check('S13e an id may start with _ (like beats.yaml ids)', rc == 0, out)

# S14 · case-only id collisions
d = plate_job('s14', {'plates': {'S01': {'line': 'a'}, 's01': {'line': 'b'}}})
rc, out = ph(['draw'], d)
check('S14 S01 and s01 are refused (one file on macOS)', rc == 2 and 'only by case' in out, out)

# S15 · a bust is checked by its head; unnamed figures get a number
d = plate_job('s15', {'crops': ['9x16'], 'plates': {'B': {'line': 'close on her', 'figures': [{'x': .5, 'feet': 1.0, 'height': .9, 'pose': 'bust'}]}}})
rc, out = ph(['draw'], d)
check('S15a a centred bust inside the 9:16 crop: no crop warning', rc == 0 and 'leaves' not in out, out)
d = plate_job('s15b', {'crops': ['9x16'], 'plates': {'B': {'line': 'off to the side', 'figures': [{'x': .1, 'feet': .9, 'height': .3}]}}})
rc, out = ph(['draw'], d)
check('S15b an unnamed figure is reported as "figure 1"', rc == 1 and 'figure 1 leaves' in out and 'figure figure' not in out, out)

# S16 · the docs carry the flags, the aspect default and the 1:1 size
sb = doc('video/STORYBOARD.md')
check('S16 STORYBOARD.md: --dpr 1–3, --quality 30–100, --max-mb 1–500, the film\'s first aspect, 1:1 at 1000 px',
      all(x in sb for x in ('`--dpr` 1–3', '`--quality` 30–100', '`--max-mb` 1–500', "film's first aspect", '1:1 at 1000 px')))

# S17 · the story section stays as strong as its source, no stronger
rec = doc('video/RECREATE.md')
check('S17 RECREATE "The story": no "kills the fun", no "never lock", no "story panel"; the table row says "of our own"',
      'kills the fun' not in rec and 'never lock' not in rec and 'story panel' not in rec and 'heightened genre of our own' in rec)

# ---- round 2: the four areas Codex named before its usage limit stopped it (no report survived; checked by the author)
# C1 · the movement rule covers the camera fields too
d = plate_job('c1', flat())
ph(['draw'], d)
os.makedirs(os.path.join(d, 'out', 'main'))
shot = {'id': 'P', 'bg': 'assets/plates/P.png', 'bgMove': 'none', 'bgDim': 0, 'push': 0}
write_json(os.path.join(d, 'out', 'main', 'timeline.json'), {'shots': [dict(shot), dict(shot, id='Q', zoom=1.3), dict(shot, id='R', pan=[{'at': 5, 'by': [.1, 0]}]), dict(shot, id='T', zoom={'16x9': 1})]})
os.utime(os.path.join(d, 'beats.yaml'), (time.time() - 60, time.time() - 60))
rc, out = ph(['status', '--job', d], d)
check('C1 status flags a plate shot that zooms or pans (and not one whose zoom is 1)', rc == 1 and 'Q (zoom)' in out and 'R (pan)' in out and 'P (' not in out and 'T (' not in out, out)

# C2 · the temp file is created exclusively: a link sitting at the temp path is removed, never written through
d = plate_job('c2', flat())
victim = os.path.join(R, 'c2-victim.txt'); open(victim, 'w').write('do not touch')
code = ("import os, sys; sys.path.insert(0, %r); import placeholders as P; from PIL import Image; "
        "out = os.path.join(%r, 'x.png'); tmp = os.path.join(%r, '.x.png.tmp-%%d' %% os.getpid()); os.symlink(%r, tmp); "
        "P.save(Image.new('RGB', (8, 8)), out, {'id': 'x'}); print('saved', os.path.exists(out), os.path.lexists(tmp))") % (os.path.join(V, 'storyboard'), d, d, victim)
p = subprocess.run([PY, '-B', '-c', code], capture_output=True, text=True)
check('C2 a symlink at the temp path is removed, not written through', p.returncode == 0 and 'saved True False' in p.stdout and open(victim, 'rb').read() == b'do not touch', p.stdout + p.stderr)

# C3 · phone.mjs: Ctrl-C exits 130; a killed run's temp PDF is swept next time
pdf = os.path.join(J, '%s-storyboard-16x9-phone.pdf' % tl['slug'])
pr = subprocess.Popen(['node', os.path.join(V, 'storyboard', 'phone.mjs'), '--job', J], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8); pr.send_signal(signal.SIGINT); rc = pr.wait(timeout=60)
left = [f for f in os.listdir(J) if '.tmp-' in f]
check('C3a Ctrl-C mid-run: exit 130, no temp PDF left', rc == 130 and not left, '%s %s' % (rc, left))
stale = pdf + '.tmp-999999'
open(stale, 'w').write('half a pdf')
rc, out = phone(['--job', J])
check('C3b a dead run\'s temp PDF is swept by the next run', rc == 0 and not os.path.exists(stale), out)

# C4 · a brand file or a custom block newer than the board makes it stale
tl_raw = open(tlp, encoding='utf-8').read()
for label, mut, fname in (('C4a a brand logo', lambda t_: t_['brand'].update(logo='assets/c4-logo.svg'), 'assets/c4-logo.svg'),
                          ('C4b a custom block', lambda t_: t_.update(customBlocks={'c4': '/job/blocks/c4.mjs'}), 'blocks/c4.mjs')):
    t2 = json.loads(tl_raw); mut(t2)
    os.makedirs(os.path.dirname(os.path.join(J, fname)), exist_ok=True)
    open(os.path.join(J, fname), 'w').write('<svg/>')
    os.utime(os.path.join(J, fname), (time.time() + 50, time.time() + 50))
    open(tlp, 'w', encoding='utf-8').write(json.dumps(t2))
    os.utime(tlp, (os.path.getmtime(board) - 1, os.path.getmtime(board) - 1))
    rc, out = phone(['--job', J])
    check(label + ' newer than the board: refused, named', rc == 2 and fname in out, out)
    os.remove(os.path.join(J, fname))
open(tlp, 'w', encoding='utf-8').write(tl_raw)
os.utime(tlp, (os.path.getmtime(board) - 1, os.path.getmtime(board) - 1))

# ---- Opus round (review-opus/REPORT.md): O1–O15
def board_fresh():
    os.utime(board, (time.time() + 60, time.time() + 60))

# O1 · one phone run per board; a killed run's lock and pages are cleared next time
board_fresh()
pa = subprocess.Popen(['node', os.path.join(V, 'storyboard', 'phone.mjs'), '--job', J, '--dpr', '2'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
time.sleep(1.2)
rcb, outb = phone(['--job', J, '--dpr', '1'])
oa = pa.communicate(timeout=120)[0]
sizes = {Image.open(os.path.join(J, 'out', 'main', '16x9', 'board-phone', f)).size for f in os.listdir(os.path.join(J, 'out', 'main', '16x9', 'board-phone')) if f.endswith('.jpg')}
check('O1a a second run on the same board is refused while the first holds the lock; the first finishes whole', pa.returncode == 0 and rcb == 2 and 'another phone.mjs run' in outb and sizes == {(2160, 3840)}, '%s %s %s %s' % (pa.returncode, rcb, outb[-200:], sizes))
pk = subprocess.Popen(['node', os.path.join(V, 'storyboard', 'phone.mjs'), '--job', J], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5); pk.kill(); pk.wait()
lock = os.path.join(J, 'out', 'main', '16x9', 'board-phone.lock')
had = os.path.exists(lock)
rc, out = phone(['--job', J])
left = [f for f in os.listdir(os.path.join(J, 'out', 'main', '16x9')) if '.tmp-' in f or f.endswith('.lock')]
check('O1b after a SIGKILLed run, the next run clears its lock and page folder and succeeds', rc == 0 and not left, '%s had_lock=%s %s %s' % (rc, had, left, out[-200:]))

# O2 · a still that didn't load is refused
stills = sorted(f for f in os.listdir(os.path.dirname(board)) if f.endswith('.png'))
moved = os.path.join(os.path.dirname(board), stills[1])
os.rename(moved, moved + '.away')
board_fresh()
rc, out = phone(['--job', J])
os.rename(moved + '.away', moved)
check('O2 a missing still: refused, the card named', rc == 2 and 'did not load' in out and 'card 2' in out, out)

# O3 · aspects: init prefills from beats.yaml; draw warns on a missing crop; status and phone flag a plate shown in an aspect it wasn't drawn for
d = fresh(os.path.join(R, 'o3'))
open(os.path.join(d, 'beats.yaml'), 'w').write('title: o3\naspects: [16x9, 9x16, 1x1]   # each re-laid\n')
rc, out = ph(['init', '--shots', 'P'], d)
s3 = json.load(open(os.path.join(d, 'tools', 'placeholders.json')))
check('O3a init takes aspect and crops from beats.yaml', rc == 0 and s3['aspect'] == '16x9' and s3['crops'] == ['9x16', '1x1'], str((s3.get('aspect'), s3.get('crops'))))
open(os.path.join(d, 'beats.yaml'), 'w').write('title: o3\naspects:\n  - 16x9\n  - 9x16\n')
write_json(os.path.join(d, 'tools', 'placeholders.json'), dict(flat(), crops=[]))
rc, out = ph(['draw'], d)
check('O3b draw warns the film is cut to 9x16 with no crop for it (block-list aspects read too)', rc == 1 and 'cut to 9x16 too' in out, out)
t2 = json.loads(tl_raw); t2['shots'][0].update(bg='assets/o3-plate.png', bgMove='none', bgDim=0, push=0)
shutil.copy(os.path.join(d, 'assets', 'plates', 'P.png'), os.path.join(J, 'assets', 'o3-plate.png'))
pm = json.loads(Image.open(os.path.join(J, 'assets', 'o3-plate.png')).text['lv-placeholder'])
os.utime(os.path.join(J, 'assets', 'o3-plate.png'), (time.time() - 100, time.time() - 100))
t2['aspects'] = ['9x16', '16x9']                    # the timeline says the film is cut to 9:16 too
open(tlp, 'w', encoding='utf-8').write(json.dumps(t2)); os.utime(tlp, (time.time() - 50, time.time() - 50))
os.utime(os.path.join(J, 'beats.yaml'), (time.time() - 200, time.time() - 200))
rc, out = ph(['status', '--job', J], J)
check('O3c the plate records its aspect and crops; status flags it in 9x16', pm.get('aspect') == '16x9' and pm.get('crops') == [] and rc == 1 and 'no crop for an aspect' in out and '(9x16)' in out, out + str(pm))
board_fresh()
t2['aspects'] = ['16x9']; t2['shots'][0]['bg'] = 'assets/o3-plate.png'
pm2 = dict(pm, aspect='9x16')
from PIL.PngImagePlugin import PngInfo
info = PngInfo(); info.add_text('lv-placeholder', json.dumps(pm2))
Image.open(os.path.join(J, 'assets', 'o3-plate.png')).save(os.path.join(J, 'assets', 'o3-plate.png'), pnginfo=info)
os.utime(os.path.join(J, 'assets', 'o3-plate.png'), (time.time() - 100, time.time() - 100))
open(tlp, 'w', encoding='utf-8').write(json.dumps(t2)); os.utime(tlp, (time.time() - 50, time.time() - 50))
rc, out = phone(['--job', J, '--aspect', '16x9'])
check('O3d phone flags a plate drawn for 9x16 with no 16:9 crop, shown on the 16:9 board', rc == 0 and 'no 16:9 crop' in out, out)
open(tlp, 'w', encoding='utf-8').write(tl_raw); os.utime(tlp, (time.time() - 50, time.time() - 50))
os.remove(os.path.join(J, 'assets', 'o3-plate.png'))

# O4 · letterbox counts as covering the plate
d = plate_job('o4', flat())
ph(['draw'], d)
os.makedirs(os.path.join(d, 'out', 'main'))
shot = {'id': 'L', 'bg': 'assets/plates/P.png', 'bgMove': 'none', 'bgDim': 0, 'push': 0, 'letterbox': True}
write_json(os.path.join(d, 'out', 'main', 'timeline.json'), {'shots': [shot]})
os.utime(os.path.join(d, 'beats.yaml'), (time.time() - 60, time.time() - 60))
rc, out = ph(['status', '--job', d], d)
check('O4 status flags letterbox on a plate shot', rc == 1 and 'L (letterbox)' in out, out)

# O5 · an END inset fits on a 16:9 plate with a 9:16 crop, inside the crop
d = plate_job('o5', {'aspect': '16x9', 'crops': ['9x16'], 'plates': {'P': {'line': 'x', 'look': 'studio', 'grain': 0, 'end': {'label': 'y', 'look': 'night'}}}})
rc, out = ph(['draw'], d)
a = img(d)
cx0, cx1 = (1920 - 1080 * 1080 / 1920) / 2, (1920 + 1080 * 1080 / 1920) / 2
wcols = [x for x in range(a.shape[1]) if ((a[:, x] > 235).all(axis=1)).sum() > 40]
check('O5 the inset is drawn (no "no room") and its frame sits inside the 9:16 crop', rc == 0 and 'no room' not in out and wcols and min(wcols) >= cx0 and max(wcols) <= cx1, '%s %s %s' % (rc, out, (min(wcols), max(wcols)) if wcols else None))

# O6 · an unchanged redraw leaves the file (and its mtime) alone
d = plate_job('o6', flat())
ph(['draw'], d)
pp = os.path.join(d, 'assets', 'plates', 'P.png')
os.utime(pp, (1000000000, 1000000000))
rc, out = ph(['draw'], d)
check('O6 a redraw with no change keeps the file: "(unchanged)", old mtime', rc == 0 and '(unchanged)' in out and os.path.getmtime(pp) == 1000000000, out)

# O7 · duplicate keys are refused
d = stub_job(fresh(os.path.join(R, 'o7')))
os.makedirs(os.path.join(d, 'tools'))
open(os.path.join(d, 'tools', 'placeholders.json'), 'w').write('{"plates": {"S01": {"line": "a"}, "S01": {"line": "b"}}}')
rc, out = ph(['check'], d)
check('O7 two "S01" plates: refused, named', rc == 2 and 'duplicate key "S01"' in out, out)

# O8 · tags stay inside every crop, 7 % in
d = plate_job('o8', {'crops': ['9x16'], 'plates': {'P': {'line': 'x', 'look': 'studio', 'grain': 0, 'figures': [
    {'x': .5, 'feet': .98, 'height': .95, 'tag': 'TALL FIGURE TAG', 'body': '#cccccc', 'skin': '#cccccc', 'hair': '#cccccc', 'accent': '#cccccc'}]}}})
rc, out = ph(['draw'], d)
a = img(d)
ys, xs = ((a.sum(axis=2) < 200)).nonzero()
cw = 1080 * 1080 / 1920
check('O8 the tag (and label) of a tall figure stay inside the 9:16 crop, 7 % in', rc in (0, 1) and len(xs) and xs.min() >= cx0 + .07 * cw - 2 and xs.max() <= cx1 - .07 * cw + 2 and ys.min() >= .07 * 1080 - 2 and ys.max() <= 1080 * .93 + 2,
      '%s %s' % ((xs.min(), xs.max(), ys.min(), ys.max()) if len(xs) else None, (cx0 + .07 * cw, cx1 - .07 * cw)))

# O9 · status's fix-it command carries --cut and a quoted path
d = stub_job(fresh(os.path.join(R, 'o9 job ü')))
os.makedirs(os.path.join(d, 'out', '10s'))
write_json(os.path.join(d, 'out', '10s', 'timeline.json'), {'shots': []})
os.utime(os.path.join(d, 'beats.yaml'), (time.time() + 5, time.time() + 5))
rc, out = ph(['status', '--job', d, '--cut', '10s'], d)
check('O9 status --cut 10s: the hint says --cut 10s and quotes the path', rc == 2 and '--cut 10s' in out and "'%s'" % os.path.realpath(d) in out, out)

# O10 · phone checks the moves whenever the bg is a plate, even with another plate first
d = plate_job('o10', {'plates': {'A': {'line': 'a'}, 'B': {'line': 'b'}}})
ph(['draw'], d)
for f in ('A', 'B'):
    shutil.copy(os.path.join(d, 'assets', 'plates', f + '.png'), os.path.join(J, 'assets', 'o10-%s.png' % f))
    os.utime(os.path.join(J, 'assets', 'o10-%s.png' % f), (time.time() - 100, time.time() - 100))
t2 = json.loads(tl_raw)
s0 = t2['shots'][0]
t2['shots'][0] = dict([('cards', ['assets/o10-A.png'])] + list(s0.items()) + [('bg', 'assets/o10-B.png')])
open(tlp, 'w', encoding='utf-8').write(json.dumps(t2)); os.utime(tlp, (time.time() - 50, time.time() - 50))
board_fresh()
rc, out = phone(['--job', J])
check('O10 a shot with a card plate before its bg plate still gets the movement warning', rc == 0 and 'engine moves, dims or covers' in out and '%s (bgMove' % s0['id'] in out, out)
open(tlp, 'w', encoding='utf-8').write(tl_raw); os.utime(tlp, (time.time() - 50, time.time() - 50))
for f in ('A', 'B'):
    os.remove(os.path.join(J, 'assets', 'o10-%s.png' % f))

# O12 / O13 · docs
g, rec = doc('video/GUIDE.md'), doc('video/RECREATE.md')
check('O12 GUIDE: phone.mjs [--aspect A] [--cut NAME], A the film\'s first aspect', "phone.mjs --job DIR [--aspect A] [--cut NAME]" in g and "film's first aspect" in g)
check('O13 the story rules stay as scoped as their source', 'each on the same engine' in rec and 'its own engine' not in rec and 'When the reference tells a story' in rec
      and 'ad for an ad' not in g and 'When a story recreates a reference, judge it on fun' in g and 'for a recreation: loglines first' in g)

# O14 · status names the kit's own stand-in stills; the doc says what status can't see
d = stub_job(fresh(os.path.join(R, 'o14')))
os.makedirs(os.path.join(d, 'out', 'main'))
write_json(os.path.join(d, 'out', 'main', 'timeline.json'), {'shots': [{'id': 'w', 'cards': ['assets/placeholder-clip-1.svg']}]})
os.utime(os.path.join(d, 'beats.yaml'), (time.time() - 60, time.time() - 60))
rc, out = ph(['status', '--job', d], d)
check('O14 status names the kit\'s stand-in stills (exit 1); STORYBOARD.md names the marker limit', rc == 1 and 'placeholder-clip-1.svg' in out and 'loses its marker' in doc('video/STORYBOARD.md'), out)

# O15 · environment errors are refusals
d = stub_job(fresh(os.path.join(R, 'o15a')))
open(os.path.join(d, 'tools'), 'w').write('a file')
rc, out = ph(['init'], d)
check('O15a init when tools is a file: exit 2', rc == 2 and 'cannot write' in out and 'Traceback' not in out, out)
d = stub_job(fresh(os.path.join(R, 'o15b')))
os.makedirs(os.path.join(d, 'out', 'main'))
open(os.path.join(d, 'out', 'main', 'timeline.json'), 'w').write('[1, 2]')
os.utime(os.path.join(d, 'beats.yaml'), (time.time() - 60, time.time() - 60))
rc, out = ph(['status', '--job', d], d)
check('O15b status on a timeline that is a list: exit 2', rc == 2 and 'not a timeline' in out, out)
d = plate_job('o15c', flat())
os.makedirs(os.path.join(d, 'assets', 'plates'))
os.chmod(os.path.join(d, 'assets', 'plates'), 0o555)
rc, out = ph(['draw'], d)
os.chmod(os.path.join(d, 'assets', 'plates'), 0o755)
check('O15c draw into a read-only plates folder: exit 2', rc == 2 and 'cannot write' in out and 'Traceback' not in out, out)
done('QA 4 review fixes')
