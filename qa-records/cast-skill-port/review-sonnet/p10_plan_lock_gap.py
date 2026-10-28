from h import *
job = newjob('p10', ban=['jungle'], lock={'hero': {'prompt': '{LOCK} {KEEP} Put her in a <where: fill me> JUNGLE.', 'restore': {'ellipse': [480, 545, 235, 290], 'feather': 28}, 'pin': {}}})
rc, out = run(job, 'plan'); print('plan -> exit', rc); print('\n'.join(l[:150] for l in out.strip().splitlines()))
run(job, 'candidates', '--go')
rc, out = run(job, 'lock', '--pick', 'cand-01', '--go'); print('lock --go -> exit', rc, '|', out.strip().splitlines()[-1][:160])
