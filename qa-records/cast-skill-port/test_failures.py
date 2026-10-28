# -*- coding: utf-8 -*-
# QA 3 — failure paths, each planted and each required to FAIL the way the tool promises (and to cost nothing): no key;
# the cap; a ban word; a missing reference; a bad spec; an unknown snippet; the size ladder (400 → the next size); a 429
# retried; a 500 twice; a 401 whose body echoes the key (scrubbed); a 200 that isn't JSON; a JPEG instead of a PNG; the
# network dropping twice; a pick over a real file. Then one success after all of it, so the probe's PASS path is proven.
import json, os, re, shutil, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.dont_write_bytecode = True
import mock_openai as M                                                         # noqa: E402
CAST = os.path.expanduser('~/.claude/skills/product-launch-sting/video/casting/casting.py')
JOB = os.path.abspath(sys.argv[1]); shutil.rmtree(JOB, ignore_errors=True); os.makedirs(JOB)
srv, URL = M.start()
KEYV = 'sk-test-' + 'Z' * 40
fails = []
def check(ok, what):
    print(('PASS ' if ok else 'FAIL ') + what)
    if not ok: fails.append(what)
def run(*args, key=True, url=URL, extra=()):
    env = dict(os.environ, OPENAI_BASE_URL=url); env.pop('OPENAI_API_KEY', None)
    if key: env['OPENAI_API_KEY'] = KEYV
    p = subprocess.run([sys.executable, CAST] + list(args) + list(extra), cwd=JOB, env=env, capture_output=True, text=True)
    return p.returncode, p.stdout + p.stderr
P = lambda *a: os.path.join(JOB, *a)
def spec(**over):
    s = {'cap': 5, 'grey': '#8a8a8a', 'ban': ['jungle'], 'text': {'WHO': 'a white woman of about 40'},
         'candidates': {'look-1': {'n': 1, 'prompt': '{SHEET} The person is {WHO}. {TAIL}'}},
         'locations': {'place-1': {'prompt': 'An empty office plate. {PLATE_TAIL}'}},
         'lock': {'hero': {'prompt': '{LOCK} {KEEP}', 'restore': {'ellipse': [480, 545, 235, 290], 'feather': 28}}},
         'stills': {'S01': {'batch': 'identity', 'refs': ['sheet:hero', 'loc:place-1'], 'prompt': '{PRE_FACE}{PRE_LOC}A frame.'}}}
    s.update(over)
    os.makedirs(P('tools'), exist_ok=True)
    json.dump(s, open(P('tools/casting.json'), 'w'), indent=1)
def ledger():
    rows = [json.loads(l) for l in open(P('cast/ledger.jsonl'))] if os.path.exists(P('cast/ledger.jsonl')) else []
    out, at = [], {}
    for r in rows:
        c = r.get('call')
        if c and c in at: out[at[c]] = r
        else:
            if c: at[c] = len(out)
            out.append(r)
    return out
def calls(): return len(M.STATE['log'])

spec()
c0 = calls(); emptyenv = P('empty.env'); open(emptyenv, 'w').write('# nothing\n')
code, o = run('candidates', '--go', key=False, extra=['--env', emptyenv])
check(code == 3 and 'no OpenAI key found' in o and 'OPENAI_API_KEY=' in o and calls() == c0, 'no key: exit 3, the advice, no request')
code, o = run('candidates', '--go', extra=['--env', emptyenv])
check(code == 3, '--env FILE wins over an exported key (exit %d)' % code)
spec(cap=0.1)
code, o = run('candidates', '--go')
check(code == 2 and 'REFUSED' in o and 'cap' in o and calls() == c0 and not ledger(), 'cap: exit 2 before any request')
spec(candidates={'look-1': {'prompt': '{SHEET} The person stands in a JUNGLE clearing. {TAIL}'}})
code, o = run('plan')
check(code == 2 and 'ban-list words: jungle' in o, 'ban word: plan flags it (exit %d)' % code)
code, o = run('candidates', '--go')
check(code == 2 and 'REFUSED' in o and calls() == c0, 'ban word: --go refused before any request')
spec(candidates={'look-1': {'prompt': '{SHEET} The person is <who: fill me>. {TAIL}'}})
code, o = run('candidates', '--go')
check(code == 2 and 'unfilled placeholder' in o and calls() == c0, 'placeholder: --go refused')
spec()
code, o = run('stills', '--batch', 'identity', '--go')
check(code == 2 and 'missing reference' in o and calls() == c0, 'missing reference: --go refused')
code, o = run('plan')
check(code == 0 and 'waits for cast/locked/hero.png' in o, 'plan: a sheet still to be made is "waits for", not a refusal')
open(P('tools/casting.json'), 'w').write('{not json')
code, o = run('plan'); check(code == 2 and 'not valid JSON' in o, 'bad JSON spec: exit 2')
spec(candidates={'look-1': {'prompt': '{SHEET} {NOPE}'}})
code, o = run('plan'); check(code == 2 and 'unknown snippet {NOPE}' in o, 'unknown snippet: exit 2')
spec(candidates={'look-1': {'refs': ['shet:hero'], 'prompt': '{SHEET}'}})
code, o = run('plan'); check(code == 2 and "use sheet:NAME" in o, 'a misspelt reference kind: exit 2')
spec(candidates={'look-1': {'refs': ['sheet:hero'], 'prompt': '{SHEET}'}}, text={'A': '{B}', 'B': '{A}'})
spec(candidates={'look-1': {'prompt': '{A}'}}, text={'A': '{B}', 'B': '{A}'})
code, o = run('plan'); check(code == 2 and 'loop' in o, 'snippets in a loop: exit 2')

spec()
M.STATE['script'] = ['400size']
code, o = run('candidates', '--go', extra=['--backoff', '0.05'])
L = M.STATE['log']; led = ledger()
check(code == 0 and [x['fields']['size'] for x in L[-2:]] == ['2560x1440', '2048x1152'] and [x['status'] for x in led] == [400, 200]
      and json.load(open(P('cast/candidates/cand-01.req.json')))['size'] == '2048x1152', 'size ladder: 400 → 2048x1152, ledger 400 ($0) + 200, req.json records the size used')
M.STATE['script'] = [429]
code, o = run('candidates', '--go', extra=['--backoff', '0.05'])
check(code == 0 and [x['status'] for x in ledger()][-2:] == [429, 200] and os.path.exists(P('cast/candidates/cand-02.png')), '429: retried once, then cand-02')
M.STATE['script'] = [500, 500]
n = len(os.listdir(P('cast/candidates')))
code, o = run('candidates', '--go', extra=['--backoff', '0.05'])
check(code == 4 and [x['status'] for x in ledger()][-2:] == [500, 500] and len(os.listdir(P('cast/candidates'))) == n, '500 twice: exit 4, two $0 rows, no image')
M.STATE['script'] = [401]
code, o = run('candidates', '--go')
check(code == 4 and 'HTTP 401' in o and KEYV not in o and '<key>' in o and KEYV not in open(P('cast/ledger.jsonl')).read(), '401 echoing the key: exit 4, the key scrubbed from the message and the ledger')
M.STATE['script'] = ['badjson']
code, o = run('candidates', '--go')
check(code == 4 and ledger()[-1]['status'] == 'badjson' and ledger()[-1]['usd'] > 0, 'a 200 that is not JSON: exit 4, billed by estimate in the ledger')
M.STATE['script'] = ['jpeg']
n = len(os.listdir(P('cast/candidates')))
code, o = run('candidates', '--go')
check(code == 1 and 'saved as PNG' in o and len(os.listdir(P('cast/candidates'))) == n + 2, 'a JPEG instead of a PNG: converted and saved (paid), exit 1 with the note')
M.STATE['script'] = ['drop', 'drop']
c0 = len(M.STATE['log'])
code, o = run('candidates', '--go', extra=['--backoff', '0.05'])
M.STATE['script'] = []
check(code == 4 and ledger()[-1]['status'] == 'neterr' and ledger()[-1]['usd'] > 0 and 'may be billed' in o and len(M.STATE['log']) == c0 + 1,
      'dropped after sending: exit 4, counted as may-be-billed, NOT retried (a retry could pay twice)')
code, o = run('candidates', '--go', url='http://127.0.0.1:9/v1', extra=['--backoff', '0.05'])
check(code == 4 and 'could not reach the API twice' in o and ledger()[-1]['usd'] == 0, 'nothing listening: retried once (never sent, $0), then exit 4')
M.STATE['script'] = []
code, o = run('locations', '--go')
os.unlink(P('stills/locations/place-1-v1.png.req.json')) if os.path.exists(P('stills/locations/place-1-v1.png.req.json')) else None
open(P('stills/locations/place-1.png'), 'wb').write(b'not a link')
code, o = run('pick', 'place-1', 'v1')
check(code == 2 and 'is a file, not a pick link' in o and open(P('stills/locations/place-1.png'), 'rb').read() == b'not a link', 'pick over a real file: refused, the file kept')
os.unlink(P('stills/locations/place-1.png'))
code, o = run('pick', 'place-1', 'v9'); check(code == 2 and 'no ' in o, 'pick a variant that does not exist: exit 2')
spec(cap=0.5)
code, o = run('locations', '--go', '--redo')
check(code == 2 and 'REFUSED' in o, 'cap reached mid-job (ledger total + quote > cap): refused (exit %d)' % code)
spec(cap=50)
M.STATE['script'] = []
code, o = run('candidates', '--go')
check(code == 0 and 'saved' in o, 'after all of it, a clean call still succeeds (the PASS path)')
tot = sum(float(x.get('usd', 0)) for x in ledger())
code, o = run('cost')
check(code == 0 and ('spent $%.2f' % tot) in o, 'cost agrees with the ledger: $%.2f' % tot)
check(all(KEYV not in open(os.path.join(dp, f), errors='ignore').read() for dp, _, fs in os.walk(JOB) for f in fs if f.endswith(('.json', '.jsonl'))), 'the key is in no file written')
print('%d FAIL' % len(fails) if fails else 'ALL PASS')
sys.exit(1 if fails else 0)
