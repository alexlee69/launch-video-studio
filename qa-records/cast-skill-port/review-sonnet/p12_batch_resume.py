from h import *
st = {k: {'batch': 'identity', 'refs': ['sheet:hero', 'loc:place-1'], 'prompt': '{PRE_FACE}{PRE_LOC}frame %s.' % k} for k in ('S01', 'S02', 'S03')}
job = newjob('p12', stills=st)
for a in (('candidates', '--go'), ('lock', '--pick', 'cand-01', '--go'), ('locations', '--go')): assert run(job, *a)[0] == 0
run(job, 'pick', 'place-1', 'v1')
M.STATE['script'] = ['ok', 'ok', 500, 500]
rc, out = run(job, 'stills', '--batch', 'identity', '--go'); print('first run -> exit', rc, '| saved:', sorted(f for f in os.listdir(os.path.join(job, 'stills/keys')) if f.endswith('.png')))
rc, out = run(job, 'stills', '--batch', 'identity'); print([l[:120] for l in out.strip().splitlines() if 'quote' in l])
rc, out = run(job, 'stills', '--batch', 'identity', '--go'); print('re-run -> exit', rc, '| files:', sorted(f for f in os.listdir(os.path.join(job, 'stills/keys')) if f.endswith('.png')))
