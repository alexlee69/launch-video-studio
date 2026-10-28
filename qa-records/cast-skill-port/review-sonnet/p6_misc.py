from h import *
# (1) the spec's lock.pick is documented as "optional; --pick wins", but --pick is required
job = newjob('p6a'); s = json.load(open(os.path.join(job, 'tools/casting.json'))); s['lock']['hero']['pick'] = 'cand-01'
json.dump(s, open(os.path.join(job, 'tools/casting.json'), 'w')); run(job, 'candidates', '--go')
rc, out = run(job, 'lock', '--go'); print('(1) lock --go with spec pick=cand-01, no --pick -> exit', rc, '|', out.strip().splitlines()[-1][:120])
# (2) a dry run that would be refused at --go reports "ok, exit 0"
run(job, 'lock', '--pick', 'cand-01', '--go')
before = tree(job); n = len(M.STATE['log'])
rc, out = run(job, 'lock', '--pick', 'cand-01'); print('(2) second lock, dry run -> exit', rc, '|', out.strip().splitlines()[-1][:110])
rc, out = run(job, 'lock', '--pick', 'cand-01', '--go'); print('    same with --go -> exit', rc, '|', out.strip().splitlines()[-1][:100])
rc, out = run(job, 'states', '--only', 'props', '--go'); rc, out = run(job, 'states', '--only', 'props')
print('    states --only props (made already), dry run -> exit', rc, '(and --go would be refused)', '| tree unchanged:', before == tree(job) or 'only states files added')
# (3) --spec after the subcommand
rc, out = run(job, 'plan', '--spec', 'tools/casting.json'); print('(3) plan --spec X -> exit', rc, '|', out.strip().splitlines()[-1][:100])
