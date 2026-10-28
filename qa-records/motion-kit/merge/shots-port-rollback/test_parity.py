# -*- coding: utf-8 -*-
"""QA 1 · parity. The Lull's prompts compile byte for byte; nothing the port didn't mean to change has changed: the
engine (lv.mjs, lib, engine), gen.mjs's H3 path, casting.py's existing requests, placeholders.py's plates, the docs
the pointer script rebuilds; the casting and storyboard suites still pass."""
import filecmp, hashlib, json, os, shutil, subprocess
from qa_lib import QA, V, ROLL, PY, SHOTS, PH, CAST, GEN, run, shots, check, fresh, write_json, read, load, done, png, jpg, plate_job

X = fresh(os.path.join(QA, 'out', 'parity'))
SKILL = os.path.dirname(V)
LULL_IN = os.path.expanduser('~/Downloads/launch-videos/manus2-space/footage/fal/in')
EX_SHOTS = os.path.join(V, 'shots', 'examples', 'manus2-space-shots.json')
EX_CAST = os.path.join(V, 'casting', 'examples', 'manus2-space-casting.json')
BACKUP = os.path.expanduser('~/Downloads/launch-video-studio/skill/product-launch-sting')
sha = lambda p: hashlib.sha1(open(p, 'rb').read()).hexdigest()

# ---- P1 The Lull: every motion prompt compiles to the text actually sent
job = fresh(os.path.join(X, 'lull'))
os.makedirs(os.path.join(job, 'tools'))
shutil.copy(EX_SHOTS, os.path.join(job, 'tools', 'shots.json'))
shutil.copy(EX_CAST, os.path.join(job, 'tools', 'casting.json'))
rc, out = shots(['build'], job)
built = sorted(f for f in os.listdir(os.path.join(job, 'shots')) if f.endswith('.h3.txt'))
same = [f for f in built if read(os.path.join(job, 'shots', f)).rstrip('\n') == read(os.path.join(LULL_IN, f[:-7] + '.txt')).rstrip('\n')]
check('P1 The Lull: %d of 20 H3 prompts compile byte for byte to what was sent' % len(same), rc == 1 and len(built) == 20 and len(same) == 20,
      '%s; differ: %s' % (out[-300:], sorted(set(built) - set(same))))
check('P1b its only warnings are the two honest camera-move ones (S04-4A, S14-14A)',
      sorted(l.split(':')[0] for l in out.splitlines() if l.startswith('! ')) == ['! shots.S04-4A.motion.camera', '! shots.S14-14A.motion.camera'], out)

# ---- P2 emit-casting rebuilds the casting example's key-frame stills
cs = load(EX_CAST)
want = cs.pop('stills')
write_json(os.path.join(job, 'tools', 'casting.json'), cs)
rc, out = shots(['emit-casting'], job)
got = load(os.path.join(job, 'tools', 'casting.json'))['stills']
strip = lambda e: dict(e, meta={k: v for k, v in (e.get('meta') or {}).items() if k not in ('from', 'sha')})
match = [k for k in got if k in want and strip(got[k]) == strip(want[k])]
check('P2 emit-casting writes 19 stills identical to the casting example (apart from meta.from and meta.sha)', rc in (0, 1) and len(got) == 19 and len(match) == 19,
      '%d/%d; %s' % (len(match), len(got), out[-200:]))
check('P2b every still it wrote carries meta.from = shots', all((e.get('meta') or {}).get('from') == 'shots' for e in got.values()))

# ---- P3 the example rebuilds from the job's own files
tmp = os.path.join(X, 'example-rebuilt.json')
rc, out = run([PY, '-B', os.path.join(QA, 'make_example.py'), tmp])
check('P3 make_example.py rebuilds the shipped example byte for byte', rc == 0 and read(tmp) == read(EX_SHOTS), out)

# ---- P4 the engine is untouched
diffs = []
for rel in ('video/lv.mjs',):
    if read(os.path.join(SKILL, rel), 'rb') != read(os.path.join(BACKUP, rel), 'rb'):
        diffs.append(rel)
for d in ('video/lib', 'video/engine'):
    c = filecmp.dircmp(os.path.join(SKILL, d), os.path.join(BACKUP, d))
    stack = [c]
    while stack:
        c = stack.pop()
        diffs += [os.path.join(c.left, f) for f in c.diff_files + c.left_only + c.right_only]
        stack += c.subdirs.values()
check('P4 lv.mjs, lib/ and engine/ are byte-identical to the pushed backup', not diffs, diffs[:5])
fp = [l.split(None, 1) for l in read(os.path.join(ROLL, 'pre.sha1')).splitlines() if l.strip()]
moved = [p.strip() for h, p in fp if sha(p.strip()) != h]
check('P4b of the %d fingerprinted files only footage/gen.mjs changed' % len(fp), moved == [os.path.join(V, 'footage', 'gen.mjs')], moved)

# ---- P5 gen.mjs: the H3 and still dry runs are unchanged
g = fresh(os.path.join(X, 'gen'))
jpg(os.path.join(g, 'key.jpg'))
open(os.path.join(g, 'p.txt'), 'w').write('The camera pushes in slowly. She turns. No text, no captions, no logos.\n')
home = fresh(os.path.join(X, 'home'))
env = dict(os.environ, HOME=home)
env.pop('FAL_KEY', None)
cases = [['video', '--image', 'key.jpg', '--prompt', 'She turns to the window.', '--out', 'a.mp4'],
         ['video', '--image', 'key.jpg', '--prompt', '@p.txt', '--out', 'b.mp4', '--sec', '10', '--res', '768P', '--seed', '7'],
         ['still', '--prompt', 'An empty office at dawn', '--out', 'st', '--n', '2', '--aspect', '9:16']]
bad = []
SEED_PRICE = (" · bytedance/seedance-2.5/* about $0.2205/s at 480p, $0.473/s at 720p (fal's page as found 2026-10-26, "
              "unconfirmed: check before quoting)")
for c in cases:
    a = run(['node', GEN] + c, cwd=g, env=env)
    b = run(['node', os.path.join(ROLL, 'gen.mjs')] + c, cwd=g, env=env)
    if a[1].count(SEED_PRICE) != 1 or (a[0], a[1].replace(SEED_PRICE, '')) != b:
        bad.append((c[0], c[-1], a[1][-200:], b[1][-200:]))
check('P5 gen.mjs H3 video and still dry runs print exactly what they printed before, apart from Seedance in the price list', not bad, bad)
check('P5b and nothing was written by a dry run', sorted(os.listdir(g)) == ['key.jpg', 'p.txt'], os.listdir(g))

# ---- P6 casting.py: the old requests plan exactly as before (the rollback copy run beside live's own helpers)
old = fresh(os.path.join(X, 'old-video'))
os.makedirs(os.path.join(old, 'casting'))
shutil.copy(os.path.join(ROLL, 'casting.py'), os.path.join(old, 'casting', 'casting.py'))
shutil.copytree(os.path.join(V, 'footage'), os.path.join(old, 'footage'), ignore=shutil.ignore_patterns('node_modules', '*.mjs'))
pj = fresh(os.path.join(X, 'castjob'))
os.makedirs(os.path.join(pj, 'tools'))
shutil.copy(EX_CAST, os.path.join(pj, 'tools', 'casting.json'))
a = run([PY, '-B', CAST, 'plan'], cwd=pj)
b = run([PY, '-B', os.path.join(old, 'casting', 'casting.py'), 'plan'], cwd=pj)
check('P6 casting.py plan on The Lull\'s casting example prints exactly what the pre-port casting.py printed', a == b and 'total quote' in a[1],
      (a[1][-300:], b[1][-300:]))
olds = {}
import ast
for node in ast.parse(read(os.path.join(ROLL, 'casting.py'))).body:
    if isinstance(node, ast.Assign) and any(getattr(t, 'id', '') == 'TEXT' for t in node.targets):
        olds = ast.literal_eval(node.value)
news = {}
for node in ast.parse(read(CAST)).body:
    if isinstance(node, ast.Assign) and any(getattr(t, 'id', '') == 'TEXT' for t in node.targets):
        news = ast.literal_eval(node.value)
check('P6b every built-in snippet casting.py had is unchanged; %d new ones were added' % (len(news) - len(olds)),
      olds and all(news.get(k) == v for k, v in olds.items()) and set(news) - set(olds) == {
          'SHEET_POSE', 'PROPORTIONS', 'EYES_COVERED', 'READS', 'REF_FACE', 'REF_PRODUCT', 'REF_CUT', 'REF_PLACE', 'REF_POSE'})

# ---- P7 placeholders.py: plates are byte-identical to the pre-port tool's
pd = plate_job(fresh(os.path.join(X, 'plates-new')))
po = plate_job(fresh(os.path.join(X, 'plates-old')))
a = run([PY, '-B', PH, 'draw', '--sheet'], cwd=pd)
b = run([PY, '-B', os.path.join(ROLL, 'placeholders.py'), 'draw', '--sheet'], cwd=po)
files = sorted(os.listdir(os.path.join(pd, 'assets', 'plates')))
same = [f for f in files if read(os.path.join(pd, 'assets', 'plates', f), 'rb') == read(os.path.join(po, 'assets', 'plates', f), 'rb')]
check('P7 draw makes the same %d plate files, byte for byte, as before the port' % len(files),
      a[0] == b[0] and files == sorted(os.listdir(os.path.join(po, 'assets', 'plates'))) and same == files and len(files) == 5, (a, b, files, same))

# ---- P8 the docs rebuild from the rollback copies with the pointer script
t = fresh(os.path.join(X, 'docs'))
for src, dst in (('SKILL.md', 'SKILL.md'), ('video_GUIDE.md', 'video/GUIDE.md'), ('video_FOOTAGE.md', 'video/FOOTAGE.md'),
                 ('video_templates_footage-prompts.md', 'video/templates/footage-prompts.md'), ('video_templates_brief.md', 'video/templates/brief.md')):
    os.makedirs(os.path.dirname(os.path.join(t, dst)), exist_ok=True)
    shutil.copy(os.path.join(ROLL, src), os.path.join(t, dst))
rc, out = run([PY, '-B', os.path.join(QA, 'apply_pointers.py'), t])
rebuilt = [d for d in ('SKILL.md', 'video/GUIDE.md', 'video/FOOTAGE.md', 'video/templates/footage-prompts.md', 'video/templates/brief.md')
           if read(os.path.join(t, d)) == read(os.path.join(SKILL, d))]
check('P8 apply_pointers.py on the rollback copies rebuilds all 5 live docs exactly (%d applied)' % out.count('APPLIED'),
      rc == 0 and len(rebuilt) == 5 and out.count('APPLIED') == 11, (out, rebuilt))
rc, out = run([PY, '-B', os.path.join(QA, 'apply_pointers.py'), t])
check('P8b a second run changes nothing (11 SKIP)', rc == 0 and out.count('SKIP') == 11, out)
check('P8c SKILL.md\'s description line is the same as before the port', read(os.path.join(SKILL, 'SKILL.md')).split('\n')[:3] == read(os.path.join(ROLL, 'SKILL.md')).split('\n')[:3])

# ---- P9 the other ports' suites still pass
rc, out = run(['bash', os.path.join(QA, '..', 'cast-skill-port', 'run_all.sh')], timeout=1800)
check('P9 the casting port\'s suites still pass', rc == 0, out[-500:])
rc, out = run(['bash', os.path.join(QA, '..', 'storyboard-skill-port', 'run_all.sh')], timeout=3600)
check('P9b the storyboard port\'s suites still pass', rc == 0 and 'ALL SUITES PASS' in out, out[-500:])

done('QA 1 parity')
