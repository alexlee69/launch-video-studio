# -*- coding: utf-8 -*-
"""QA 2 · the flow on a fresh film job: init → plates → bg: → storyboard in 3 aspects → phone editions (default and
custom cover) → status → swap plates for "real" footage stills one by one until status is clean."""
import json, os, re, subprocess
from qa_lib import QA, V, LV, PY, run, ph, phone, check, fresh, write_json, done, plates_spec, strip_marker

F = fresh(os.path.join(QA, 'out', 'flow'))
J = os.path.join(F, 'job')
rc, out = run(['node', LV, '--job', J, '--init', '--kit', 'film', '--title', 'Plate Test'])
check('F1a lv.mjs --init --kit film', rc == 0, out)
rc, out = ph(['init', '--shots', 'name,hook,ask'], J)
check('F1b placeholders init writes the starter for 3 shots', rc == 0 and os.path.isfile(os.path.join(J, 'tools', 'placeholders.json')), out)
rc, out = ph(['draw'], J)
check('F1c the unfilled starter is refused (exit 2), nothing drawn', rc == 2 and 'replace the <FILL: …> hint' in out and not os.path.exists(os.path.join(J, 'assets', 'plates')), out)
write_json(os.path.join(J, 'tools', 'placeholders.json'), plates_spec(['9x16', '1x1']))
rc, out = ph(['check'], J)
check('F1d check passes the filled spec', rc == 0 and '3 plates' in out, out)
rc, out = ph(['draw', '--sheet'], J)
plates = os.path.join(J, 'assets', 'plates')
check('F1e draw makes 3 plates + a sheet (exit 1: crop warnings named)', rc == 1 and all(os.path.isfile(os.path.join(plates, n + '.png')) for n in ('name', 'hook', 'ask'))
      and os.path.isfile(os.path.join(plates, 'placeholders-sheet.jpg')) and 'leaves the 9:16 crop' in out, out)

b = open(os.path.join(J, 'beats.yaml'), encoding='utf-8').read()
for sid in ('name', 'hook', 'ask'):
    i = b.index('  - id: %s\n' % sid); j = b.index('# bg: assets/your-ai-footage.mp4', i)
    b = b[:j] + 'bg: assets/plates/%s.png' % sid + b[j + len('# bg: assets/your-ai-footage.mp4'):]
open(os.path.join(J, 'beats.yaml'), 'w', encoding='utf-8').write(b)
rc, out = ph(['status'], J)
check('F2a status before --grid: no timeline, refused (exit 2)', rc == 2 and '--grid' in out, out)
rc, out = run(['node', LV, '--job', J, '--storyboard', '--aspect', 'all'])
check('F2b lv.mjs --storyboard --aspect all on the plates', rc == 0 and all(os.path.isfile(os.path.join(J, 'plate-test-storyboard-%s.pdf' % a)) for a in ('16x9', '9x16', '1x1')), out[-600:])
rc, out = ph(['status'], J)
check('F2c status lists the 3 shots on placeholders (exit 1)', rc == 1 and all(re.search(r'^\s+%s\s' % s, out, re.M) for s in ('name', 'hook', 'ask')), out)
check('F2d status names the plate shots the engine would zoom and dim, and the fields', 'engine moves, dims or covers these plates' in out and all('%s (bgMove, bgDim, push' % s in out for s in ('name', 'hook', 'ask')), out)
b = open(os.path.join(J, 'beats.yaml'), encoding='utf-8').read()
for sid in ('name', 'hook', 'ask'):
    a = b.index('bg: assets/plates/%s.png' % sid); e = b.index('\n', a)
    b = b[:e] + '\n    bgMove: none\n    bgDim: 0\n    push: 0' + b[e:]
open(os.path.join(J, 'beats.yaml'), 'w', encoding='utf-8').write(b)
rc, out = ph(['status'], J)
check('F2e status refuses a timeline older than beats.yaml (exit 2)', rc == 2 and '--grid' in out, out)
rc, out = run(['node', LV, '--job', J, '--storyboard', '--aspect', 'all'])
rc2, out2 = ph(['status'], J)
check('F2f with bgMove none / bgDim 0 / push 0 set, the board re-renders and status stops warning', rc == 0 and rc2 == 1 and 'engine moves' not in out2, out[-300:] + out2)

# cover + card pages; since the motion kit (2026-10-27) the board's notes ("Notes before the film") add pages after them
pages = {'16x9': 6, '9x16': 11, '1x1': 11}
for a, n in pages.items():
    rc, out = phone(['--job', J, '--aspect', a])
    pdf = os.path.join(J, 'plate-test-storyboard-%s-phone.pdf' % a)
    info = subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout
    pj = json.load(open(os.path.join(J, 'out', 'main', a, 'board-phone', 'pages.json')))
    got = int(re.search(r'Pages:\s+(\d+)', info).group(1)) if re.search(r'Pages:\s+(\d+)', info) else 0
    check('F3 %s phone edition: %d pages + any notes pages, 540x960 pt, 3 placeholders found' % (a, n), rc == 0
          and 1 + len(pj['shots_per_page']) == n and (got > n if pj.get('notes') else got == n) and '540 x 960' in info
          and pj['placeholders'] == ['name', 'hook', 'ask'] and pj['aspect'] == a, out + info)
from PIL import Image
pg = Image.open(os.path.join(J, 'out', 'main', '9x16', 'board-phone', 'page-03.jpg'))
check('F3d a 9:16 page is 1620x2880', pg.size == (1620, 2880), str(pg.size))

cover = os.path.join(F, 'cover.yaml')
open(cover, 'w', encoding='utf-8').write(
    'title: Plate Test — review\nline: DRAFT v0.2 for the team\nlogline: >-\n  A runner, a phone, a kitchen table: one evening, three shots.\n'
    'table:\n  title: The three footage shots\n  rows:\n    - [1, name, harbour wall]\n    - [2, hook, phone at dusk]\n    - [3, ask, kitchen table]\n'
    'read:\n  - "Plates are stand-ins: composition only."\nfooter: DRAFT v0.2 · team review\n')
rc, out = phone(['--job', J, '--cover', cover])
info = subprocess.run(['pdfinfo', os.path.join(J, 'plate-test-storyboard-16x9-phone.pdf')], capture_output=True, text=True).stdout
check('F4a a custom cover (title, table, read, footer) builds', rc == 0 and 'Plate Test — review: storyboard, phone edition' in info, out + info)
txt = subprocess.run(['pdftotext', '-l', '1', os.path.join(J, 'plate-test-storyboard-16x9-phone.pdf'), '-'], capture_output=True, text=True)
check('F4b the PDF is images only (no text layer to leak)', txt.returncode == 0 and not txt.stdout.strip(), txt.stdout[:200])

# swap plates for "real" stills (same pixels, no marker), as footage replaces them
strip_marker(os.path.join(plates, 'hook.png'))
rc, out = run(['node', LV, '--job', J, '--grid'])
rc, out = ph(['status'], J)
check('F5a after hook gets real footage, status lists 2 (exit 1)', rc == 1 and '2 shots' in out and 'hook' not in out.split('\n', 1)[1], out)
rc, out = ph(['draw'], J)
check('F5b draw now refuses to replace the real hook still (exit 2), and leaves it', rc == 2 and 'hook.png' in out and 'lv-placeholder' not in Image.open(os.path.join(plates, 'hook.png')).text, out)
rc, out = ph(['draw', 'name', 'ask'], J)
check('F5c draw of the other two still works', rc in (0, 1) and 'name.png' in out and 'ask.png' in out, out)
rc0, out0 = phone(['--job', J])
check('F5c2 a plate swapped after the storyboard makes the board stale: refused', rc0 == 2 and 'hook: assets/plates/hook.png' in out0, out0)
rc, out = run(['node', LV, '--job', J, '--storyboard'])
rc2, out2 = phone(['--job', J])
pj = json.load(open(os.path.join(J, 'out', 'main', '16x9', 'board-phone', 'pages.json')))
check('F5d the phone edition now counts 2 placeholders', rc == 0 and rc2 == 0 and pj['placeholders'] == ['name', 'ask'] and '2 shots on placeholder plates' in out2, out2)
for n in ('name', 'ask'):
    strip_marker(os.path.join(plates, n + '.png'))
rc, out = ph(['status'], J)
check('F5e with every plate replaced, status finds none, but still names the film kit\'s own stand-in cards (exit 1)', rc == 1 and 'no shot' in out and "starter kit's own stand-in stills" in out and 'placeholder-clip' in out, out)
rc, out = run(['node', LV, '--job', J, '--storyboard'])
rc2, out2 = phone(['--job', J])
pj = json.load(open(os.path.join(J, 'out', 'main', '16x9', 'board-phone', 'pages.json')))
check('F5f with none left the cover drops the placeholder tag', rc2 == 0 and pj['placeholders'] == [] and 'placeholder' not in out2, out2)
done('QA 2 flow')
