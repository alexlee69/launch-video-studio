# -*- coding: utf-8 -*-
"""QA 1 · parity. The skill's phone.mjs against The Lull's own job tool on a copy of the same board; the plates are
deterministic; the doc edits rebuild from the rollback copies; no engine or lv.mjs/lib file changed."""
import hashlib, os, shutil, subprocess
from qa_lib import QA, V, PH, PHONE, PY, run, ph, phone, check, fresh, write_json, done, plates_spec, stub_job

L = os.path.expanduser('~/Downloads/launch-videos/manus2-space')
P = fresh(os.path.join(QA, 'out', 'parity'))
J = os.path.join(P, 'job')
os.makedirs(os.path.join(J, 'out', 'main', '16x9'))
os.makedirs(os.path.join(J, 'tools'))
shutil.copy2(os.path.join(L, 'out', 'main', 'timeline.json'), os.path.join(J, 'out', 'main'))
shutil.copytree(os.path.join(L, 'out', 'main', '16x9', 'board'), os.path.join(J, 'out', 'main', '16x9', 'board'))
shutil.copy2(os.path.join(L, 'tools', 'phone_storyboard.mjs'), os.path.join(J, 'tools'))

rc, out = run(['node', 'tools/phone_storyboard.mjs'], cwd=J)
check('P1a the job tool runs on the copied board', rc == 0, out)
shutil.move(os.path.join(J, 'out', 'main', '16x9', 'board-phone'), os.path.join(P, 'pages-job'))
rc, out = phone(['--job', J, '--cover', os.path.join(V, 'storyboard', 'examples', 'manus2-space-cover.yaml')])
check('P1a2 phone.mjs refuses to replace the job tool\'s PDF (another Creator)', rc == 2 and 'not made by this tool' in out and 'manus2-space tools/phone_storyboard.mjs' in out, out)
shutil.move(os.path.join(J, 'manus2-space-storyboard-16x9-phone.pdf'), os.path.join(P, 'job-tool.pdf'))
rc, out = phone(['--job', J, '--cover', os.path.join(V, 'storyboard', 'examples', 'manus2-space-cover.yaml')])
check('P1b phone.mjs runs on the same board with the worked cover', rc == 0, out)
a = sorted(f for f in os.listdir(os.path.join(P, 'pages-job')) if f.endswith('.jpg'))
b = sorted(f for f in os.listdir(os.path.join(J, 'out', 'main', '16x9', 'board-phone')) if f.endswith('.jpg'))
check('P1c same page count (26)', a == b and len(a) == 26, '%d vs %d' % (len(a), len(b)))
same = sum(open(os.path.join(P, 'pages-job', f), 'rb').read() == open(os.path.join(J, 'out', 'main', '16x9', 'board-phone', f), 'rb').read() for f in a)
check('P1d every page byte-identical to the job tool', same == len(a) == 26, '%d of %d' % (same, len(a)))
shipped = os.path.join(L, 'out', 'main', '16x9', 'board-phone')
same2 = sum(open(os.path.join(shipped, f), 'rb').read() == open(os.path.join(J, 'out', 'main', '16x9', 'board-phone', f), 'rb').read() for f in a)
check('P1e every page byte-identical to the 10-23 review pages', same2 == 26, '%d of 26' % same2)
info = subprocess.run(['pdfinfo', os.path.join(J, 'manus2-space-storyboard-16x9-phone.pdf')], capture_output=True, text=True).stdout
check('P1f the PDF opens: 26 pages at 540 x 960 pt', 'Pages:           26' in info and '540 x 960' in info, info)

# P2 · plates are deterministic, and redrawing replaces only its own plates
D = stub_job(fresh(os.path.join(QA, 'out', 'determinism')))
write_json(os.path.join(D, 'tools', 'placeholders.json'), plates_spec(['9x16', '1x1']))
rc1, o1 = ph(['draw'], D)
h1 = {f: hashlib.sha1(open(os.path.join(D, 'assets', 'plates', f), 'rb').read()).hexdigest() for f in os.listdir(os.path.join(D, 'assets', 'plates')) if not f.startswith('.')}
rc2, o2 = ph(['draw'], D)
h2 = {f: hashlib.sha1(open(os.path.join(D, 'assets', 'plates', f), 'rb').read()).hexdigest() for f in os.listdir(os.path.join(D, 'assets', 'plates')) if not f.startswith('.')}
check('P2a draw runs twice (exit 1: crop warnings)', rc1 == 1 and rc2 == 1, o1 + o2)
check('P2b the same spec draws the same bytes', h1 == h2 and len(h1) == 3, str(len(h1)))
from PIL import Image
im = Image.open(os.path.join(D, 'assets', 'plates', 'ask.png'))
check('P2c a plate is 1920x1080 RGB with its marker', im.size == (1920, 1080) and im.mode == 'RGB' and 'lv-placeholder' in im.text, str((im.size, im.mode, list(im.text))))

# P3 · the doc edits rebuild exactly from the rollback copies, and are idempotent
S = os.path.expanduser('~/.claude/skills/product-launch-sting')
R = fresh(os.path.join(QA, 'out', 'rebuild'))
os.makedirs(os.path.join(R, 'video'))
docs = ['SKILL.md', 'video/GUIDE.md', 'video/RECREATE.md', 'video/FOOTAGE.md']
for d in docs:
    shutil.copy(os.path.join(QA, 'rollback', d.replace('/', '_')), os.path.join(R, d))
rc, out = run([PY, os.path.join(QA, 'apply_pointers.py'), R])
check('P3a apply_pointers applies all 10 edits to the rollback copies', rc == 0 and out.count('APPLIED') == 10, out)
check('P3b the rebuilt docs equal live', all(open(os.path.join(R, d), 'rb').read() == open(os.path.join(S, d), 'rb').read() for d in docs))
rc, out = run([PY, os.path.join(QA, 'apply_pointers.py'), R])
check('P3c a second run skips all 10', rc == 0 and out.count('SKIP') == 10, out)

# P4 · lv.mjs, lib/ and the engine are byte-identical to before the port (render fingerprints don't move)
pre = dict(reversed(l.split(None, 1)) for l in open(os.path.join(QA, 'rollback', 'pre.sha1')).read().splitlines())
now_ok = all(hashlib.sha1(open(os.path.join(S, f.strip()), 'rb').read()).hexdigest() == h for f, h in pre.items() if f.strip().startswith('video/l'))
check('P4a lv.mjs and lib/*.mjs unchanged', now_ok and sum(1 for f in pre if f.strip().startswith('video/l')) >= 17)
eng = subprocess.run(['git', '-C', os.path.expanduser('~/Downloads/launch-video-studio'), 'diff', '--quiet', 'HEAD', '--', 'skill/product-launch-sting/video/engine'], capture_output=True)
src = subprocess.run(['diff', '-rq', os.path.join(S, 'video', 'engine'), os.path.expanduser('~/Downloads/launch-video-studio/skill/product-launch-sting/video/engine')], capture_output=True, text=True)
check('P4b engine/ matches the pushed backup (63fc29f)', src.returncode == 0, src.stdout)
done('QA 1 parity')
