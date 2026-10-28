from h import *
from PIL import Image
import numpy as np
def usd(job): return round(sum(r['usd'] for r in ledger(job)), 2)
def tail(o, n=2): return ' | '.join(l.strip() for l in o.strip().splitlines()[-n:])[:230]

print('--- (a) lock from a sheet that is not 2560x1440 (a user-supplied path, or one made after a size step-down)')
job = newjob('p4a'); run(job, 'candidates', '--go')
small = os.path.join(job, 'mine.png'); Image.open(os.path.join(job, 'cast/candidates/cand-01.png')).resize((1920, 1080)).save(small)
rc, out = run(job, 'lock', '--pick', small, '--go')
print('exit', rc, '| spent $%s' % usd(job), '|', tail(out, 1))
print('files:', [f for f in tree(job) if 'locked' in f])
rc2, out2 = run(job, 'lock', '--pick', small, '--rebuild'); print('lock --rebuild afterwards: exit', rc2, '|', tail(out2, 1), '(can never succeed with this pick)')

print('--- (b) fix whose box has 3 numbers (sheet fix)')
job = newjob('p4b', fixes={'f': {'sheet': 'props', 'prompt': 'Change the right tile.', 'box': [1280, 0, 2560], 'feather': 0}})
for a in (('candidates', '--go'), ('lock', '--pick', 'cand-01', '--go'), ('states', '--only', 'props', '--go')): run(job, *a)
s0 = usd(job); rc, out = run(job, 'fix', 'f', '--go')
print('exit', rc, '| spent +$%s' % round(usd(job) - s0, 2), '|', tail(out, 1))
print('props.png exists:', os.path.exists(os.path.join(job, 'cast/locked/props.png')), '| props-before-f.png exists:', os.path.exists(os.path.join(job, 'cast/locked/props-before-f.png')))

print('--- (c) fix whose box is smaller than 2 x feather (default feather 18), a still')
job = newjob('p4c', fixes={'f': {'src': '../stills/keys/S01-v1.png', 'prompt': 'tiny', 'box': [100, 100, 130, 130]}})
for a in (('candidates', '--go'), ('lock', '--pick', 'cand-01', '--go'), ('states', '--only', 'props', '--go'), ('locations', '--go')): run(job, *a)
run(job, 'pick', 'place-1', 'v1'); run(job, 'stills', '--batch', 'identity', '--go')
s0 = usd(job); rc, out = run(job, 'fix', 'f', '--go')
print('exit', rc, '| spent +$%s' % round(usd(job) - s0, 2), '|', tail(out, 1))

print('--- (d) lock entry whose restore has no ellipse')
job = newjob('p4d'); s = json.load(open(os.path.join(job, 'tools/casting.json'))); s['lock']['hero']['restore'] = {'feather': 28}
json.dump(s, open(os.path.join(job, 'tools/casting.json'), 'w')); run(job, 'candidates', '--go')
rc, out = run(job, 'lock', '--pick', 'cand-01', '--go')
print('exit', rc, '| spent $%s' % usd(job), '|', tail(out, 1))

print('--- (e) fix of a sheet that was made at 2048x1152 after a size step-down')
job = newjob('p4e', fixes={'f': {'sheet': 'props', 'prompt': 'Change the right tile.', 'box': [1000, 0, 2000, 1000], 'feather': 0}})
for a in (('candidates', '--go'), ('lock', '--pick', 'cand-01', '--go')): run(job, *a)
M.STATE['script'] = ['400size']; run(job, 'states', '--only', 'props', '--go')
print('props.png size:', Image.open(os.path.join(job, 'cast/locked/props.png')).size)
s0 = usd(job); rc, out = run(job, 'fix', 'f', '--go')
print('exit', rc, '| spent +$%s' % round(usd(job) - s0, 2), '|', tail(out, 1))
print('props.png exists:', os.path.exists(os.path.join(job, 'cast/locked/props.png')))
