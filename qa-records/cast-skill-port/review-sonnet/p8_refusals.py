from h import *
def go(job, *a):
    n = len(M.STATE['log']); L = len(ledger(job)); rc, out = run(job, *a); return rc, len(M.STATE['log']) - n, len(ledger(job)) - L, out
# batch of 3 locations, the LAST one has a placeholder: nothing may be sent for the first two
job = newjob('p8a', locations={'a': {'prompt': 'plate a'}, 'b': {'prompt': 'plate b'}, 'c': {'prompt': 'plate <fill me>'}})
print('last-request placeholder:', go(job, 'locations', '--go')[:3])
job = newjob('p8b', locations={'a': {'prompt': 'plate a'}, 'b': {'prompt': 'plate b'}}, cap=0.5)
print('batch quote > cap (0.5):', go(job, 'locations', '--go')[:3])
# ledger already holds spend, quote alone fits but total does not
job = newjob('p8c', cap=0.5); run(job, 'candidates', '--go'); print('spent', round(sum(r['usd'] for r in ledger(job)), 2)); print('ledger+quote > cap:', go(job, 'candidates', '--go')[:3])
# states: second --go with one state already made
job = newjob('p8d'); run(job, 'candidates', '--go'); run(job, 'lock', '--pick', 'cand-01', '--go'); run(job, 'states', '--only', 'props', '--go')
print('states --go, one of two exists:', go(job, 'states', '--go')[:3])
# n edge cases
for n in (0, -2, 'two', 11):
    job = newjob('p8n', candidates={'look-1': {'n': n, 'prompt': '{SHEET} {WHO}'}})
    rc, calls, rows, out = go(job, 'candidates', '--go'); print('n=%r' % (n,), '-> exit', rc, 'calls', calls, '|', out.strip().splitlines()[-1][:110])
# cap NaN
job = newjob('p8e'); s = json.load(open(os.path.join(job, 'tools/casting.json'))); s['cap'] = 'nan'; json.dump(s, open(os.path.join(job, 'tools/casting.json'), 'w'))
print('cap "nan":', go(job, 'candidates', '--go')[:3])
