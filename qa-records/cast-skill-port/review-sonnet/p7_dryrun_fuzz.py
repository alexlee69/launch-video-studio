from h import *
import hashlib
def snap(job):
    return {f: hashlib.md5(open(os.path.join(job, f), 'rb').read()).hexdigest() if not os.path.islink(os.path.join(job, f)) else 'link' for f in tree(job)}
job = newjob('p7', fixes={'f1': {'sheet': 'props', 'prompt': 'x', 'box': [1000, 0, 2000, 1000], 'feather': 0},
                          'f2': {'src': '../stills/keys/S01-v1.png', 'prompt': 'y', 'box': [100, 100, 600, 600]}})
for a in (('candidates', '--go'), ('lock', '--pick', 'cand-01', '--go'), ('states', '--go'), ('locations', '--go')): assert run(job, *a)[0] == 0
run(job, 'pick', 'place-1', 'v1'); assert run(job, 'stills', '--batch', 'identity', '--go')[0] == 0
before, n = snap(job), len(M.STATE['log']); L0 = len(ledger(job))
cmds = [('candidates',), ('candidates', '--only', 'look-1'), ('lock', '--pick', 'cand-01'), ('lock', '--pick', 'cand-02'), ('states',), ('states', '--only', 'props'),
        ('locations',), ('stills', '--batch', 'identity'), ('stills', '--batch', 'all'), ('stills', '--only', 'S01'), ('fix', 'f1'), ('fix', 'f2'), ('plan',), ('cost',)]
bad = []
for c in cmds:
    rc, out = run(job, *c)
    if snap(job) != before or len(M.STATE['log']) != n or len(ledger(job)) != L0: bad.append(c)
    print('exit', rc, 'casting.py', ' '.join(c), '| unchanged' if snap(job) == before and len(M.STATE['log']) == n else '| CHANGED')
print('violations:', bad)
