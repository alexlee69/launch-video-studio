from h import *
job = newjob('p1')
M.STATE['script'] = ['trunc', 'trunc']
rc, out = run(job, 'candidates', '--go')
print('exit', rc); print(out[-900:])
print('ledger rows:', ledger(job))
print('requests that reached the mock:', len(M.STATE['log']))
