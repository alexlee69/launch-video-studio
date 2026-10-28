# -*- coding: utf-8 -*-
# QA 4 — the review rounds' findings, each planted again and each required to stay fixed (against the local mock API):
# a 200 cut off mid-body and a Ctrl-C mid-call stay in the ledger at their estimate; a key straddling the truncation
# point never leaks a prefix; spec mistakes (a fix box of 3 numbers, a box too small for its feather, a lock restore
# with no mask, a misspelt sheet:/loc:, a ban word in the lock prompt before the pick) are refused before any spend;
# --rebuild refuses to undo a sheet fix; a non-neutral sheet says its grey is NOT pinned (exit 1); a batch cut off by an
# error resumes without re-paying the stills it made; lock asks for the pick's own size; free tools never overwrite;
# bad n / cap / a non-https OPENAI_BASE_URL are refused; --spec works after the subcommand.
import hashlib, json, os, shutil, signal, subprocess, sys, time
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.dont_write_bytecode = True
import mock_openai as M                                                         # noqa: E402
from PIL import Image                                                           # noqa: E402
CAST = os.path.expanduser('~/.claude/skills/product-launch-sting/video/casting/casting.py')
JOB = os.path.abspath(sys.argv[1]); shutil.rmtree(JOB, ignore_errors=True); os.makedirs(JOB)
srv, URL = M.start()
KEYV = 'sk-test-' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcd'
fails = []
def check(ok, what):
    print(('PASS ' if ok else 'FAIL ') + what)
    if not ok: fails.append(what)
def env(url=URL):
    e = dict(os.environ, OPENAI_BASE_URL=url, OPENAI_API_KEY=KEYV); return e
def run(*args, url=URL):
    p = subprocess.run([sys.executable, CAST] + list(args), cwd=JOB, env=env(url), capture_output=True, text=True)
    return p.returncode, p.stdout + p.stderr
P = lambda *a: os.path.join(JOB, *a)
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
def rows():
    return [json.loads(l) for l in open(P('cast/ledger.jsonl'))] if os.path.exists(P('cast/ledger.jsonl')) else []
def calls():
    out, at = [], {}
    for r in rows():
        c = r.get('call')
        if c and c in at: out[at[c]] = r
        else:
            if c: at[c] = len(out)
            out.append(r)
    return out
BASE = {'cap': 50, 'text': {'WHO': 'a white woman of about 40'},
        'candidates': {'look-1': {'n': 1, 'prompt': '{SHEET} The person is {WHO}. {TAIL}'}},
        'lock': {'hero': {'prompt': '{LOCK} {KEEP}', 'restore': {'ellipse': [480, 545, 235, 290], 'feather': 28}}},
        'states': {'props': {'refs': ['sheet:hero'], 'prompt': 'A faceless props sheet: {FACELESS} 1 a mug. {TAIL}'}},
        'locations': {'place-1': {'prompt': 'An empty office plate. {PLATE_TAIL}'}},
        'stills': {'S01': {'batch': 'identity', 'refs': ['sheet:hero', 'loc:place-1'], 'prompt': '{PRE_FACE}{PRE_LOC}Frame one.'},
                   'S02': {'batch': 'identity', 'refs': ['sheet:hero', 'loc:place-1'], 'prompt': '{PRE_FACE}{PRE_LOC}Frame two.'}},
        'fixes': {}}
def spec(**over):
    s = json.loads(json.dumps(BASE)); s.update(over)
    os.makedirs(P('tools'), exist_ok=True); json.dump(s, open(P('tools/casting.json'), 'w'), indent=1)
    return s
spec()
n0 = len(M.STATE['log'])
M.STATE['script'] = ['truncate']
c0 = len(M.STATE['log'])
code, o = run('candidates', '--go', '--backoff', '0.05')
c = calls()
check(code == 4 and [x['status'] for x in c] == ['neterr'] and c[0]['usd'] > 0 and 'may be billed' in c[0]['usd_from'] and len(M.STATE['log']) == c0 + 1,
      'a 200 cut off mid-body: counted at its estimate ($%.3f) as maybe billed, and NOT retried' % c[0]['usd'])
M.STATE['script'] = []
run('candidates', '--go')
M.STATE['script'] = ['slow']
before = len(calls())
p = subprocess.Popen([sys.executable, CAST, 'candidates', '--go'], cwd=JOB, env=env(), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
time.sleep(2.0); p.send_signal(signal.SIGINT); out = p.communicate()[0]
last = calls()[-1]
check(p.returncode == 130 and len(calls()) == before + 1 and last['status'] == 'sent' and last['usd'] > 0 and 'in flight' in out,
      'Ctrl-C mid-call: exit 130, the request stays counted at its estimate')
time.sleep(4)
M.STATE['script'] = ['401long']
code, o = run('candidates', '--go')
led = open(P('cast/ledger.jsonl')).read()
check(code == 4 and KEYV[:12] not in o and KEYV[:12] not in led, 'a 401 echoing the key past the cut: no prefix of the key in the message or the ledger')
M.STATE['script'] = []
code, o = run('lock', '--pick', 'cand-01', '--go')
check(code == 0 and os.path.exists(P('cast/locked/hero.png')), 'lock on the candidate')
spec(fixes={'bad3': {'sheet': 'hero', 'prompt': 'Fix.', 'box': [1, 2, 3]}})
n0 = len(M.STATE['log']); h0 = sha(P('cast/locked/hero.png'))
code, o = run('fix', 'bad3', '--go')
check(code == 2 and 'x0, y0, x1, y1' in o and len(M.STATE['log']) == n0 and sha(P('cast/locked/hero.png')) == h0 and not any(f.startswith('hero-before') for f in os.listdir(P('cast/locked'))),
      'a fix box of 3 numbers: refused before the spend, the sheet untouched')
spec(fixes={'tiny': {'sheet': 'hero', 'prompt': 'Fix.', 'box': [10, 10, 40, 40], 'feather': 18}})
code, o = run('fix', 'tiny', '--go'); check(code == 2 and 'twice its feather' in o and len(M.STATE['log']) == n0, 'a box smaller than twice its feather: refused before the spend')
spec(fixes={'out': {'src': '../cast/locked/hero.png', 'prompt': 'Fix.', 'box': [0, 0, 9000, 100]}})
code, o = run('fix', 'out', '--go'); check(code == 2 and 'outside' in o and len(M.STATE['log']) == n0, 'a box outside the image: refused before the spend')
s = spec(); s['lock']['hero']['restore'] = {'feather': 28}; json.dump(s, open(P('tools/casting.json'), 'w'))
code, o = run('plan'); check(code == 2 and 'restore' in o, 'a lock restore with no mask: plan flags it')
s = spec(stills={'S01': {'batch': 'identity', 'refs': ['sheet:heroo', 'loc:plce-1'], 'prompt': 'x'}})
code, o = run('plan'); check(code == 2 and 'sheet:heroo is no sheet' in o and 'loc:plce-1 is no location' in o, 'misspelt sheet:/loc: names: plan refuses')
s = spec(ban=['jungle']); s['lock']['hero']['prompt'] = '{LOCK} In a jungle. <fill>'; json.dump(s, open(P('tools/casting.json'), 'w'))
code, o = run('plan'); check(code == 2 and 'ban-list words: jungle' in o, 'a ban word in the lock prompt before the pick: plan flags it')
spec(fixes={'tile': {'sheet': 'props', 'prompt': 'Change ONLY the right tile.', 'box': [1280, 0, 2560, 1440], 'feather': 0}})
code, o = run('states', '--go'); check(code == 0, 'states')
code, o = run('fix', 'tile', '--go'); check(code == 0 and os.path.exists(P('cast/locked/props-before-tile.png')), 'a sheet fix (props)')
h1 = sha(P('cast/locked/props.png'))
code, o = run('states', '--only', 'props', '--rebuild')
check(code == 2 and 'would undo it' in o and sha(P('cast/locked/props.png')) == h1, 'states --rebuild over a sheet fix: refused, the fixed sheet kept')
code, o = run('fix', 'tile', '--rebuild'); check(code == 0 and sha(P('cast/locked/props.png')) == h1, 'fix --rebuild: the same fixed sheet, free')
# non-neutral grey: a light candidate, locked
spec()
M.STATE['script'] = ['light']
run('candidates', '--go')
light = sorted(f for f in os.listdir(P('cast/candidates')) if f.endswith('.png') and f.startswith('cand-'))[-1][:-4]
os.rename(P('cast/locked'), P('cast/locked-1'))
code, o = run('lock', '--pick', light, '--go')
check(code == 1 and 'grey NOT pinned' in o and os.path.exists(P('cast/locked/hero.png')), 'a light-grey sheet: saved, but exit 1 and "grey NOT pinned"')
if not (code == 1 and "grey NOT pinned" in o): print("code", code, o[-1800:])
shutil.rmtree(P('cast/locked')); os.rename(P('cast/locked-1'), P('cast/locked'))
# resume a cut-off batch
run('locations', '--go'); run('pick', 'place-1', 'v1')
M.STATE['script'] = ['ok', 500, 500]
code, o = run('stills', '--batch', 'identity', '--go', '--backoff', '0.05')
check(code == 4 and os.path.exists(P('stills/keys/S01-v1.png')) and not os.path.exists(P('stills/keys/S02-v1.png')), 'a batch cut off on its 2nd still: exit 4, S01 made')
n0 = len(M.STATE['log'])
code, o = run('stills', '--batch', 'identity', '--go')
check(code == 0 and 'skipped S01' in o and len(M.STATE['log']) == n0 + 1 and os.path.exists(P('stills/keys/S02-v1.png')) and not os.path.exists(P('stills/keys/S01-v3.png')),
      'the re-run resumes: S01 skipped (not re-paid), only S02 requested')
# lock asks for the pick's own size
Image.new('RGB', (1920, 1080), (138, 138, 138)).save(P('cast/candidates/cand-90.png'))
os.rename(P('cast/locked'), P('cast/locked-2'))
s = spec(); s['lock']['hero']['restore'] = {'ellipse': [300, 400, 150, 200], 'feather': 20}; json.dump(s, open(P('tools/casting.json'), 'w'))
n0 = len(M.STATE['log'])
code, o = run('lock', '--pick', 'cand-90', '--go')
check(M.STATE['log'][n0]['fields']['size'] == '1920x1080' and os.path.exists(P('cast/locked/hero-composite.png')), 'lock of a 1920x1080 pick asks for 1920x1080, so the face restore fits (exit %d)' % code)
shutil.rmtree(P('cast/locked')); os.rename(P('cast/locked-2'), P('cast/locked'))
# free tools
a = P('cast/locked/hero.png'); h = sha(a)
code, o = run('pin', a, a); check(code == 2 and sha(a) == h, 'pin A A: refused, A untouched')
code, o = run('paste', a, a, P('cast/locked/props.png'), '--box', '0,0,100,100', '--feather', '0')
check(code == 2 and 'never overwritten' in o, 'paste onto an existing file without --force: refused')
code, o = run('paste', P('nope.png'), a, P('x.png'), '--box', '0,0,100,100'); check(code == 2 and 'no such image' in o, 'a free tool with a missing input: exit 2, no traceback')
# spec validation
spec(candidates={'look-1': {'n': 0, 'prompt': '{SHEET}'}}); code, o = run('plan'); check(code == 2 and '1–10' in o, 'n: 0 refused')
spec(candidates={'look-1': {'n': 'two', 'prompt': '{SHEET}'}}); code, o = run('plan'); check(code == 2 and 'Traceback' not in o, 'n: "two" refused, no traceback')
open(P('tools/casting.json'), 'w').write(json.dumps(dict(BASE, cap='nan'))); code, o = run('candidates', '--go'); check(code == 2 and 'cap' in o, 'cap "nan" refused')
open(P('tools/casting.json'), 'w').write(json.dumps(BASE).replace('"cap": 50', '"cap": NaN')); code, o = run('plan'); check(code == 2 and 'cap' in o, 'cap NaN refused')
spec(); n0 = len(M.STATE['log'])
code, o = run('candidates', '--go', url='http://example.com/v1'); check(code == 2 and 'not https' in o and len(M.STATE['log']) == n0, 'a non-https OPENAI_BASE_URL: refused before the key is read')
code, o = run('plan', '--spec', P('tools/casting.json')); check(code == 0, '--spec after the subcommand works')
check(not any(KEYV[:12] in open(os.path.join(dp, f), errors='ignore').read() for dp, _, fs in os.walk(JOB) for f in fs if f.endswith(('.json', '.jsonl'))), 'no prefix of the key in any file written')
# ---- round 2 (Codex) findings
spec()
srv2, URL2 = M.start(); M2LOG = []
import mock_openai as MM
M.STATE['redirect_to'] = URL2.replace('/v1', '') + '/steal'
n_before = len(M.STATE['log'])
M.STATE['script'] = ['redirect']
code, o = run('candidates', '--go')
stolen = [r for r in M.STATE['log'][n_before:] if r['path'] == '/steal']
check(code == 4 and not stolen, 'a 307 redirect: not followed (exit %d), the key never reaches the redirect target' % code)
M.STATE['script'] = ['partialusage']
code, o = run('candidates', '--go')
last = calls()[-1]
check(code == 0 and last['usd'] > 0.2 and 'estimate' in last['usd_from'], 'usage without token counts: billed at the estimate ($%.3f), not $0' % last['usd'])
M.STATE['script'] = ['empty']
nf = len(os.listdir(P('cast/candidates')))
code, o = run('candidates', '--go')
check(code == 4 and calls()[-1]['usd'] > 0 and len(os.listdir(P('cast/candidates'))) == nf, 'a 200 with no images: exit 4, billed in the ledger, nothing saved')
s = spec(); s['candidates']['look-1']['n'] = 2; json.dump(s, open(P('tools/casting.json'), 'w'))
M.STATE['script'] = ['short']
code, o = run('candidates', '--go')
check(code == 1 and 'asked for 2 images, got 1' in o, 'a short answer (1 of 2): the one saved, exit 1 with the warning')
spec()
led_path = P('cast/ledger.jsonl'); keep = open(led_path).read()
open(led_path, 'a').write('{"label": "x", "usd": NaN}\n')
code, o = run('plan'); check(code == 2 and 'not a finite amount' in o, 'a NaN in the ledger: refused (the cap can not be disabled)')
open(led_path, 'w').write(keep)
# concurrency: a cap that holds one call; two runs at once
sp = sum(float(r.get('usd', 0)) for r in calls())
s = spec(cap=round(sp + 0.30, 4)); json.dump(s, open(P('tools/casting.json'), 'w'))
M.STATE['script'] = ['slow', 'slow']
procs = [subprocess.Popen([sys.executable, CAST, 'candidates', '--go'], cwd=JOB, env=env(), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True) for _ in range(2)]
outs = [p.communicate()[0] for p in procs]
codes = sorted(p.returncode for p in procs)
sp2 = sum(float(r.get('usd', 0)) for r in calls())
check(codes == [0, 2] and sp2 <= s['cap'] + 1e-9 and any('REFUSED' in x for x in outs), 'two runs at once under a one-call cap: one spends, one is refused; spent $%.2f ≤ cap $%.2f' % (sp2, s['cap']))
spec()
M.STATE['script'] = []
n0 = len(M.STATE['log'])
code, o = run('candidates', '--g')
check(code == 2 and len(M.STATE['log']) == n0 and 'spent so far' not in o, '"--g" is not --go (no abbreviations): exit 2, no request')
spec(fixes={'alias': {'src': '../cast/locked/hero.png', 'out': '../cast/locked/hero-x.png', 'edit': '../cast/locked/hero-x.png', 'prompt': 'Fix.', 'box': [0, 0, 400, 400]}})
code, o = run('fix', 'alias', '--go'); check(code == 2 and 'are one file' in o and len(M.STATE['log']) == n0, 'a fix whose edit is its output: refused before the spend')
orig = P('cast/locked/hero.png'); ho = sha(orig)
os.symlink(orig, P('o2.json'))
code, o = run('paste', orig, orig, P('o2.png'), '--box', '0,0,100,100', '--feather', '0')
check(code == 2 and sha(orig) == ho, 'paste whose .json record is a symlink to the original: refused, the original untouched')
code, o = run('paste', orig, orig, P('o2.png'), '--box', '0,0,100,100', '--feather', '0', '--force')
check(code == 2 and sha(orig) == ho and os.path.islink(P('o2.json')), 'with --force too: refused, since the record IS the input (the original untouched)')
os.unlink(P('o2.json')); os.symlink(P('elsewhere.png'), P('o2.json')); open(P('elsewhere.png'), 'w').write('keep')
code, o = run('paste', orig, orig, P('o2.png'), '--box', '0,0,100,100', '--feather', '0', '--force')
check(code == 0 and open(P('elsewhere.png')).read() == 'keep' and not os.path.islink(P('o2.json')), 'with --force over a link to an unrelated file: the link replaced, the file it pointed at kept')
# rebuild with a corrupt saved edit keeps the good sheet
hf = sha(P('cast/locked/hero.png')); ed = P('cast/locked/hero-edit.png'); good = open(ed, 'rb').read()
open(ed, 'wb').write(b'not a png')
spec(); code, o = run('lock', '--rebuild', '--pick', 'cand-01')
check(code == 2 and sha(P('cast/locked/hero.png')) == hf, 'lock --rebuild from a corrupt saved edit: refused, the locked sheet kept')
open(ed, 'wb').write(good)
s = spec(); s['lock']['hero']['pin'] = {'cols': 123}; json.dump(s, open(P('tools/casting.json'), 'w'))
code, o = run('plan'); check(code == 2 and 'pin' in o, 'pin.cols not a list: plan refuses (before any spend)')
s = spec(); s['stills']['S01']['meta'] = 5; json.dump(s, open(P('tools/casting.json'), 'w'))
code, o = run('plan'); check(code == 2 and 'meta' in o, 'meta not an object: plan refuses')
s = spec(); s['lock']['hero']['restore'] = {'ellipse': [10, 10, 9999, 9999], 'feather': 28}; json.dump(s, open(P('tools/casting.json'), 'w'))
code, o = run('lock', '--pick', 'cand-01', '--rebuild'); check(code == 2 and 'does not fit' in o, 'an ellipse bigger than the sheet: refused')
s = spec(); s['states']['../victim'] = {'refs': ['sheet:hero'], 'prompt': 'x'}; json.dump(s, open(P('tools/casting.json'), 'w'))
code, o = run('plan'); check(code == 2 and 'entry id' in o, 'an entry id with ../: refused')
s = spec(); s['stills']['S01']['dir'] = '../../x'; json.dump(s, open(P('tools/casting.json'), 'w'))
code, o = run('plan'); check(code == 2 and 'dir' in o, 'a stills dir with ../: refused')
# ---- round 3 (Opus) findings
spec()
M.STATE['script'] = []
# 1 the same batch twice at once: nothing replaced, every paid image kept
s = spec(); s['locations']['place-2'] = {'prompt': 'An empty hall plate. {PLATE_TAIL}'}; json.dump(s, open(P('tools/casting.json'), 'w'))
M.STATE['script'] = ['slow', 'slow']
procs = [subprocess.Popen([sys.executable, CAST, 'locations', '--only', 'place-2', '--go'], cwd=JOB, env=env(), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True) for _ in range(2)]
n_req0 = len([r for r in M.STATE['log'] if 'hall' in str(r['fields'].get('prompt', ''))])
for p in procs: p.communicate()
vs = sorted(f for f in os.listdir(P('stills/locations')) if f.startswith('place-2-v') and f.endswith('.png'))
n_req = len([r for r in M.STATE['log'] if 'hall' in str(r['fields'].get('prompt', ''))])
check(n_req == 2 and len(vs) == 4 and all(os.path.exists(P('stills/locations', f[:-4] + '.req.json')) for f in vs),
      'the same batch twice at once: 2 paid calls = 4 images, 4 files with their records, none replaced (%s)' % vs)
M.STATE['script'] = []
# 2 states n > 1 refused
s = spec(); s['states']['props']['n'] = 2; json.dump(s, open(P('tools/casting.json'), 'w'))
code, o = run('plan'); check(code == 2 and 'one sheet per state' in o, 'a state with n: 2: refused before any spend')
# 3 lock --rebuild takes the edit's own pick, refuses another
spec()
code, o = run('lock', '--rebuild')
check(code == 0, 'lock --rebuild with no --pick: the pick read from the edit\'s req.json (exit %d)' % code)
other = sorted(f[:-4] for f in os.listdir(P('cast/candidates')) if f.startswith('cand-') and f.endswith('.png') and f != 'cand-01.png')[0]
h = sha(P('cast/locked/hero.png'))
code, o = run('lock', '--rebuild', '--pick', other)
check(code == 2 and 'was made from' in o and sha(P('cast/locked/hero.png')) == h, 'lock --rebuild --pick <another candidate>: refused, the sheet kept')
# 5 a stranded sheet-fix edit (saved, never pasted) is applied by --rebuild
spec(fixes={'tile': {'sheet': 'props', 'prompt': 'Change ONLY the right tile.', 'box': [1280, 0, 2560, 1440], 'feather': 0},
            'tile2': {'sheet': 'props', 'prompt': 'Change ONLY the left tile.', 'box': [0, 0, 1280, 1440], 'feather': 0}})
shutil.copyfile(P('cast/locked/props.png'), P('cast/locked/props-tile2-edit.png'))
hp = sha(P('cast/locked/props.png'))
code, o = run('fix', 'tile2', '--go'); check(code == 2 and '--rebuild' in o, 'a fix whose edit was saved: --go points to --rebuild (no second payment)')
code, o = run('fix', 'tile2', '--rebuild')
check(code == 0 and os.path.exists(P('cast/locked/props-before-tile2.png')) and sha(P('cast/locked/props-before-tile2.png')) == hp, 'fix --rebuild of a stranded edit: applied, the sheet before it kept')
# 6 a malformed usage block never loses the paid images
M.STATE['script'] = ['ok']
spec()
import mock_openai as MM
orig_send = MM.H.send
def bad_usage(self, code, obj=None, raw=None):
    if obj and 'usage' in obj and obj.get('data'):
        obj = dict(obj, usage={'input_tokens_details': 'x', 'output_tokens': 7370})
    return orig_send(self, code, obj, raw)
MM.H.send = bad_usage
nf = len([f for f in os.listdir(P('cast/candidates')) if f.endswith('.png')])
code, o = run('candidates', '--go')
MM.H.send = orig_send
check(code == 0 and len([f for f in os.listdir(P('cast/candidates')) if f.endswith('.png')]) == nf + 1 and calls()[-1]['usd'] > 0,
      'usage with a malformed details block: the image saved, billed at the estimate (exit %d)' % code)
# 7 an uneven background is not "pinned"
from PIL import ImageDraw
im = Image.new('RGB', (1200, 800), (138, 138, 138)); d = ImageDraw.Draw(im); d.rectangle([0, 600, 1200, 800], fill=(115, 115, 115))
im.save(P('floor.png'))
code, o = run('pin', P('floor.png'), P('floor-pinned.png'))
check(code == 1 and 'NOT pinned' in o, 'a sheet whose background still steps after the pin: exit 1, NOT pinned')
# 8 fix --rebuild never writes over a file that is not its own output
spec(fixes={'f1': {'src': '../stills/keys/S01-v1.png', 'out': '../stills/keys/S02-v1.png', 'edit': '../stills/keys/S01-f1-edit.png', 'prompt': 'Fix.', 'box': [0, 0, 400, 400]}})
shutil.copyfile(P('stills/keys/S01-v1.png'), P('stills/keys/S01-f1-edit.png'))
h2 = sha(P('stills/keys/S02-v1.png'))
code, o = run('fix', 'f1', '--rebuild')
check(code == 2 and 'not this fix' in o and sha(P('stills/keys/S02-v1.png')) == h2, 'fix --rebuild with out = another paid still: refused, the still kept')
# 9 one fix id at a time
code, o = run('fix', 'f1,tile', '--go'); check(code == 2 and 'one fix id' in o, 'fix A,B: refused')
code, o = run('fix', '', '--go'); check(code == 2, 'fix "": refused')
# 12 free tools: negative feather, negative radius, non-png output
a = P('cast/locked/hero.png')
code, o = run('paste', a, a, P('neg.png'), '--box', '0,0,100,100', '--feather', '-5'); check(code == 2 and 'feather' in o, 'paste --feather -5: refused')
code, o = run('restore', a, a, P('r.png'), '--ellipse', '100,100,-5,20'); check(code == 2 and 'Traceback' not in o, 'restore with a negative radius: refused, no traceback')
code, o = run('paste', a, a, P('out.jpg'), '--box', '0,0,100,100'); check(code == 2 and '.png' in o and not [f for f in os.listdir(JOB) if '.tmp' in f], 'a non-.png output: refused, no stray temp file')
# usability: a misspelt batch; a dry run over the cap
code, o = run('stills', '--batch', 'identiy'); check(code == 2 and 'no stills in that batch' in o, 'a misspelt batch: exit 2 with the batch names')
s = spec(cap=0.01); json.dump(s, open(P('tools/casting.json'), 'w'))
code, o = run('candidates'); check(code == 2 and 'passes the cap' in o, 'a dry run over the cap: exit 2, not "add --go"')
spec()
code, o = run('lock'); check(code == 2 and 'the lock is made' in o, 'a dry run of a lock already made: says so (exit 2), no quote to approve')
print('%d FAIL' % len(fails) if fails else 'ALL PASS')
sys.exit(1 if fails else 0)
