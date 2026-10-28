from h import *
import hashlib
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()[:10]
job = newjob('p3', fixes={'props-tile': {'sheet': 'props', 'prompt': 'Change ONLY the right tile.', 'box': [1280, 0, 2560, 1440], 'feather': 0, 'pin': {}},
                          'hero-fix': {'sheet': 'hero', 'prompt': 'Move the patch.', 'box': [1000, 300, 1400, 700], 'feather': 18}})
P = lambda *a: os.path.join(job, 'cast', 'locked', *a)
for a in (('candidates', '--go'), ('lock', '--pick', 'cand-01', '--go'), ('states', '--only', 'props', '--go')):
    assert run(job, *a)[0] == 0, a
print('props.png after states      :', sha(P('props.png')))
print(run(job, 'fix', 'props-tile', '--go')[1].strip().splitlines()[-1][:110])
fixed = sha(P('props.png')); print('props.png after sheet fix   :', fixed, '(before kept as', sha(P('props-before-props-tile.png')) + ')')
rc, out = run(job, 'states', '--only', 'props', '--rebuild')
print('states --only props --rebuild -> exit', rc, '|', out.strip().splitlines()[-1][:100])
print('props.png after --rebuild   :', sha(P('props.png')), '<- fix reverted' if sha(P('props.png')) != fixed else '(fix kept)')
print('mock calls:', len(M.STATE['log']), '(rebuild is free)')
# same for the locked face sheet
h0 = sha(P('hero.png')); run(job, 'fix', 'hero-fix', '--go'); h1 = sha(P('hero.png'))
rc, out = run(job, 'lock', '--pick', 'cand-01', '--rebuild')
print('hero.png: locked', h0, '-> fixed', h1, '-> lock --rebuild', sha(P('hero.png')), 'exit', rc, '(fix reverted, no warning)' if sha(P('hero.png')) != h1 else '')
print(out.strip())
