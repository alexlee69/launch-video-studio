from h import *
job = newjob('p11', stills={'S01': {'batch': 'identity', 'refs': ['sheet:heroo', 'loc:plce-1'], 'prompt': '{PRE_FACE}{PRE_LOC}A frame.'}})
rc, out = run(job, 'plan'); print('plan -> exit', rc); print([l[:170] for l in out.strip().splitlines() if 'still' in l or 'total' in l])
