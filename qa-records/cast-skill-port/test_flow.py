# -*- coding: utf-8 -*-
# QA 2 — the whole flow on a fresh job, against the local mock API (no network, no spend): init → plan → candidates
# (dry run, then --go) → review → lock (edit → face restore → grey pin) → states → locations → pick → identity stills →
# review → re-roll (new variants, nothing overwritten) → a still fix and a locked-sheet fix → cost. Checks what reached
# the API (endpoint, fields, every uploaded file's bytes in order, the key), what landed on disk, and the ledger.
import hashlib, json, os, re, shutil, subprocess, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.dont_write_bytecode = True
import mock_openai as M                                                         # noqa: E402
CAST = os.path.expanduser('~/.claude/skills/product-launch-sting/video/casting/casting.py')
JOB = os.path.abspath(sys.argv[1]); shutil.rmtree(JOB, ignore_errors=True)
srv, URL = M.start()
KEYV = 'sk-test-' + 'Q' * 40
fails = []
def check(ok, what):
    print(('PASS ' if ok else 'FAIL ') + what)
    if not ok: fails.append(what)
def run(*args, key=True, expect=0):
    env = dict(os.environ, OPENAI_BASE_URL=URL); env.pop('OPENAI_API_KEY', None)
    if key: env['OPENAI_API_KEY'] = KEYV
    p = subprocess.run([sys.executable, CAST] + list(args), cwd=JOB, env=env, capture_output=True, text=True)
    out = p.stdout + p.stderr
    if p.returncode != expect:
        print(out)
    check(p.returncode == expect, 'exit %d (want %d): casting.py %s' % (p.returncode, expect, ' '.join(args)))
    check(KEYV not in out, '  key never printed (%s)' % args[0])
    return out
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
def calls_of(rows):
    out, at = [], {}
    for r in rows:
        c = r.get('call')
        if c and c in at: out[at[c]] = r
        else:
            if c: at[c] = len(out)
            out.append(r)
    return out
P = lambda *a: os.path.join(JOB, *a)

os.makedirs(JOB)
run('init', JOB)
check(os.path.exists(P('tools/casting.json')), 'init wrote tools/casting.json')
o = run('plan', expect=2)
check('unfilled placeholder' in o and 'would be refused' in o, 'plan on the starter flags the unfilled placeholders')
# fill the starter as a user would
s = json.load(open(P('tools/casting.json')))
fill = {'WHO': 'a white woman of about 40 with fair skin, short brown hair, grey-blue eyes', 'WARDROBE': 'a navy work jacket, grey T-shirt, dark jeans, white trainers'}
s['text'].update(fill)
def unph(t): return re.sub(r'<[a-z][^<>]*>', 'filled in', t)
for g in ('states', 'locations', 'stills'):
    for e in s[g].values(): e['prompt'] = unph(e['prompt'])
json.dump(s, open(P('tools/casting.json'), 'w'), indent=1)
o = run('plan')
check('total quote $' in o and '✗' not in o, 'plan on the filled spec: quote, no ✗')
o = run('candidates')
check('dry run' in o and not M.STATE['log'] and not os.path.exists(P('cast/candidates')) and not os.path.exists(P('cast/ledger.jsonl')),
      'candidates without --go: dry run, no request, no files, no ledger')
run('candidates', '--go')
L = M.STATE['log']
check(len(L) == 1 and L[0]['endpoint'] == 'generations' and L[0]['fields']['n'] == 2 and L[0]['fields']['size'] == '2560x1440'
      and L[0]['fields']['quality'] == 'high' and L[0]['fields']['model'] == 'gpt-image-2' and 'input_fidelity' not in L[0]['fields'],
      'candidates --go: one generations call, n=2, 2560x1440, high, gpt-image-2, no input_fidelity')
check(L[0]['auth'] == 'Bearer ' + KEYV, 'the key reached the API as a Bearer header')
check(L[0]['fields']['prompt'].startswith('A character reference sheet for a film: ONE image with three side-by-side panels')
      and '(#8a8a8a)' in L[0]['fields']['prompt'] and fill['WHO'] in L[0]['fields']['prompt'], 'the prompt is the expanded {SHEET} + the person')
check(all(os.path.exists(P('cast/candidates/cand-%02d.png' % i)) and os.path.exists(P('cast/candidates/cand-%02d.req.json' % i)) for i in (1, 2)),
      'cand-01 and cand-02 saved with their req.json')
raw = [json.loads(l) for l in open(P('cast/ledger.jsonl'))]
led = calls_of(raw)
check([x['status'] for x in raw] == ['sent', 200] and raw[0]['usd'] > 0, 'ledger: the call was written at its estimate before it was sent, then answered')
check(len(led) == 1 and led[0]['status'] == 200 and led[0]['usd_from'] == 'usage' and abs(led[0]['usd'] - (2 * 7370 * 30 + led[0]['usage']['input_tokens_details']['text_tokens'] * 5) / 1e6) < 1e-4,
      'ledger: one 200 row priced from the usage ($%.4f)' % led[0]['usd'])
check(all(KEYV not in open(f).read() for f in [P('cast/ledger.jsonl'), P('cast/candidates/cand-01.req.json')]), 'the key is in no file written')
run('review', 'candidates')
check(os.path.exists(P('stills/review/candidates.jpg')), 'review candidates → stills/review/candidates.jpg')
n0 = len(L)
run('lock', '--pick', 'cand-02', '--go')
r = L[n0]
check(r['endpoint'] == 'edits' and [f['sha'] for f in r['files']] == [sha(P('cast/candidates/cand-02.png'))] and r['files'][0]['name'] == 'image[]',
      'lock: one edits call uploading cand-02 as image[]')
check(r['fields']['prompt'].startswith('This is a character reference sheet in three panels. Make exactly these changes') and 'erase the face' in r['fields']['prompt']
      and r['fields']['prompt'].endswith('the same framing and layout.'), 'lock prompt = {LOCK} {KEEP}')
for f in ('hero-edit.png', 'hero-composite.png', 'hero-composite.json', 'hero.png', 'pin-hero.json'):
    check(os.path.exists(P('cast/locked', f)), 'lock wrote cast/locked/%s' % f)
c = np.asarray(Image.open(P('cast/locked/hero-composite.png')).convert('RGB')).astype(int)
src = np.asarray(Image.open(P('cast/candidates/cand-02.png')).convert('RGB')).astype(int)
ed = np.asarray(Image.open(P('cast/locked/hero-edit.png')).convert('RGB')).astype(int)
check((c[545, 480] == src[545, 480]).all() and (c[1300, 2000] == ed[1300, 2000]).all(), 'face restore: the close-up centre is the pick, the rest is the edit')
pin = json.load(open(P('cast/locked/pin-hero.json')))
check(len(pin['cols']) == 2 and abs(pin['cols'][0] - 960) <= 2 and abs(pin['cols'][1] - 1706) <= 2 and abs(pin['bg_after_mean'] - 138) <= 1.5,
      'grey pinned on auto-found gutters %s, background %.1f' % (pin['cols'], pin['bg_after_mean']))
n0 = len(L)
run('states', '--go')
check(len(L) == n0 + 3 and all([f['sha'] for f in x['files']] == [sha(P('cast/locked/hero.png'))] for x in L[n0:]), 'states: 3 edits, each uploading the locked hero.png')
check(all(os.path.exists(P('cast/locked/%s.png' % k)) and os.path.exists(P('cast/locked/%s-gen.png' % k)) for k in ('state-2', 'costume', 'props')), 'states: -gen + pinned sheet for each')
run('locations', '--go')
check(os.path.exists(P('stills/locations/place-1-v1.png')) and os.path.exists(P('stills/locations/place-1-v2.png')), 'locations: place-1-v1/v2')
o = run('stills', '--batch', 'identity', expect=2)
check('missing reference' in o and 'place-1.png' in o, 'stills before the pick: dry run flags the missing location')
run('pick', 'place-1', 'v2')
check(os.path.islink(P('stills/locations/place-1.png')) and os.readlink(P('stills/locations/place-1.png')) == 'place-1-v2.png', 'pick: place-1.png → place-1-v2.png')
n0 = len(L)
run('stills', '--batch', 'identity', '--go')
r = L[n0]
check([f['sha'] for f in r['files']] == [sha(P('cast/locked/hero.png')), sha(P('stills/locations/place-1-v2.png'))] and r['fields']['n'] == '2',
      'stills: image[] = hero.png then place-1-v2.png, n=2')
req = json.load(open(P('stills/keys/S01-v1.req.json')))
check(req['refs'] == ['cast/locked/hero.png', 'stills/locations/place-1-v2.png'] and req['shot'] == 'S01', 'still req.json names the refs (the pick resolved) and keeps meta')
run('review', 'stills', '--batch', 'identity')
check(os.path.exists(P('stills/review/stills-identity.jpg')), 'review stills → stills-identity.jpg')
m1 = sha(P('stills/keys/S01-v1.png'))
n0 = len(L)
o = run('stills', '--batch', 'identity', '--go')
check('skipped S01' in o and len(L) == n0, 'a plain re-run skips stills that have variants (no request)')
run('stills', '--batch', 'identity', '--go', '--redo')
check(os.path.exists(P('stills/keys/S01-v3.png')) and os.path.exists(P('stills/keys/S01-v4.png')) and sha(P('stills/keys/S01-v1.png')) == m1, 're-roll: v3/v4 added, v1 untouched')
n0 = len(L)
o = run('lock', '--pick', 'cand-02', '--go', expect=2)
check('never overwritten' in o and len(L) == n0, 'a second lock --go is refused before the API')
h0 = sha(P('cast/locked/hero.png'))
run('lock', '--rebuild', '--pick', 'cand-02')
check(len(L) == n0 and sha(P('cast/locked/hero.png')) == h0, 'lock --rebuild: free, the same locked sheet')
s = json.load(open(P('tools/casting.json')))
s['fixes'] = {'S01-v1f': {'src': '../stills/keys/S01-v1.png', 'prompt': 'Remove the badge from the jacket. Change nothing else.', 'box': [1000, 300, 1400, 700], 'feather': 18, 'why': 'test'},
              'props-tile': {'sheet': 'props', 'prompt': 'Change ONLY the right tile.', 'box': [1280, 0, 2560, 1440], 'feather': 0, 'pin': {}}}
json.dump(s, open(P('tools/casting.json'), 'w'), indent=1)
p0 = sha(P('cast/locked/props.png'))
run('fix', 'S01-v1f', '--go'); run('fix', 'props-tile', '--go')
check(os.path.exists(P('stills/keys/S01-v1f.png')) and os.path.exists(P('stills/keys/S01-v1f-edit.png')) and os.path.exists(P('stills/keys/S01-v1f.json')), 'fix on a still: -edit, the pasted f.png, its json')
a = np.asarray(Image.open(P('stills/keys/S01-v1f.png')).convert('RGB')).astype(int); b = np.asarray(Image.open(P('stills/keys/S01-v1.png')).convert('RGB')).astype(int)
check((a[100, 100] == b[100, 100]).all() and not (a[500, 1200] == b[500, 1200]).all(), 'the still fix touched only its box')
check(sha(P('cast/locked/props-before-props-tile.png')) == p0 and sha(P('cast/locked/props.png')) != p0, 'a locked-sheet fix: the old sheet kept as props-before-props-tile.png, props.png fixed')
o = run('fix', 'props-tile', '--go', expect=2)
check('this fix was made' in o, 'the same sheet fix again is refused')
o = run('cost')
led = calls_of([json.loads(l) for l in open(P('cast/ledger.jsonl'))])
tot = sum(x['usd'] for x in led)
check(('spent $%.2f' % tot) in o and len(led) == len(M.STATE['log']) == 10, 'cost: %d rows = %d API calls, spent $%.2f' % (len(led), len(M.STATE['log']), tot))
check(not os.path.exists(os.path.join(os.path.dirname(CAST), '__pycache__')), 'no __pycache__ in the skill')
print('%d FAIL' % len(fails) if fails else 'ALL PASS')
sys.exit(1 if fails else 0)
