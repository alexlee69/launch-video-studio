from h import *
import re
# 401 body: the key starts ~30 chars before the 300-char cut (ledger) / the 500-char cut (stderr)
for cut, label in ((460, "401: text[:500] into the ledger AND stderr"),):
    job = newjob('p2_%d' % cut)
    M.STATE['script'] = [('echo', cut)] if cut == 480 else [('echo', cut), 'ok']
    # for the 429/5xx/400 rows the status must be one of them; the mock's 'echo' answers 401, which uses text[:500]. Use 401 for both.
    M.STATE['script'] = [('echo', cut)]
    rc, out = run(job, 'candidates', '--go')
    led = open(os.path.join(job, 'cast', 'ledger.jsonl')).read()
    leaked = [m for m in (KEYV[:k] for k in range(len(KEYV) - 1, 8, -1)) if m in out or m in led]
    print(label, 'exit', rc, '| longest KEY prefix found in stderr/ledger:', len(leaked[0]) if leaked else 0, 'of', len(KEYV),
          '| full key present:', KEYV in out or KEYV in led)
    if leaked: print('   prefix:', leaked[0], ' in stderr:', leaked[0] in out, ' in ledger:', leaked[0] in led)
