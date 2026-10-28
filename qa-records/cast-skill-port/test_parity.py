# -*- coding: utf-8 -*-
# QA 1 — parity with The Lull. (a) Every paid request the skill's casting.py would send from the worked example equals
# what the job sent (endpoint, references, prompt, n, size, model, quality), read from the job's *.req.json. (b) The free
# steps rebuild the job's files pixel for pixel from the job's own inputs: face restore, grey pin (given and auto-found
# gutters), tile paste, the three key-frame patch pastes. (c) The quote vs the ledger's real cost per call.
# Prints PASS/FAIL lines; exit 1 on any FAIL. Writes only into OUT (argv[1]).
import glob, json, os, re, shutil, sys
import numpy as np
from PIL import Image
J = os.path.expanduser('~/Downloads/launch-videos/manus2-space')
V = os.path.expanduser('~/.claude/skills/product-launch-sting/video/casting')
sys.path.insert(0, V); sys.dont_write_bytecode = True
import casting as C                                                  # noqa: E402
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
SPEC = os.path.join(J, 'tools', 'casting.json')
src = os.path.join(V, "examples", "manus2-space-casting.json")
if not os.path.exists(SPEC) or open(SPEC, "rb").read() != open(src, "rb").read():
    shutil.copyfile(src, SPEC); print("     the job's tools/casting.json updated from the worked example")
S = C.Spec(SPEC)
fails = []
def check(ok, what):
    print(('PASS ' if ok else 'FAIL ') + what)
    if not ok: fails.append(what)
rd = lambda p: json.load(open(os.path.join(J, p), encoding='utf-8'))
def latest(folder, sid):
    vs = [(int(m.group(1)), f) for f in glob.glob(os.path.join(J, folder, sid + '-v*.req.json'))
          for m in [re.search(re.escape(sid) + r'-v(\d+)\.req\.json$', f)] if m]
    return json.load(open(max(vs)[1], encoding='utf-8'))
def same(req, rec, what):
    ep = rec.get('endpoint') or ('edits' if rec.get('refs') else 'generations')
    diffs = []
    if req['endpoint'] != ep: diffs.append('endpoint %s vs %s' % (req['endpoint'], ep))
    if [S.name(r) for r in req['refs']] != list(rec.get('refs') or []): diffs.append('refs %s vs %s' % ([S.name(r) for r in req['refs']], rec.get('refs')))
    if req['prompt'] != rec['prompt']: diffs.append('prompt differs at char %d' % next((i for i, (x, y) in enumerate(zip(req['prompt'], rec['prompt'])) if x != y), min(len(req['prompt']), len(rec['prompt']))))
    if req['n'] != (rec.get('n') or 1): diffs.append('n %s vs %s' % (req['n'], rec.get('n')))
    if S.sizes[0] != rec['size'] or S.model != rec['model'] or S.quality != rec['quality']: diffs.append('size/model/quality')
    check(not diffs, 'request %-28s %s' % (what, '; '.join(diffs)))

# (a) requests
R = {r['id']: r for r in C.requests(S, 'candidates')}
same(R['from-A'], rd('cast/round1/candidates/cand-01.req.json'), 'candidate from-A = cand-01')
same(R['asian'], rd('cast/round1/candidates/cand-02.req.json'), 'candidate asian = cand-02')
same(C.requests(S, 'lock', pick='cand-02')[0], rd('cast/locked/eva-edit.req.json'), 'lock eva')
for sid, raw in (('helmet-off', 'helmet-off-gen'), ('costume', 'costume-gen'), ('props', 'props-ball')):
    same({r['id']: r for r in C.requests(S, 'states')}[sid], rd('cast/locked/%s.req.json' % raw), 'state ' + sid)
for r in C.requests(S, 'locations'):
    for v in (1, 2):
        same(r, rd('stills/locations/%s-v%d.req.json' % (r['id'], v)), 'location %s v%d' % (r['id'], v))
for r in C.requests(S, 'stills', batch='all'):
    same(r, latest('stills/' + os.path.basename(r['folder']), r['id']), 'still ' + r['id'])
fx = {r['id']: r for r in C.requests(S, 'fixes')}
same(fx['props-capsule'], rd('cast/locked/props-capsule-edit.req.json'), 'fix props-capsule')
for k, edit in (('S22-22-v1f', 'S22-22-v1-patchfix-edit'), ('S14-14A-v1f', 'S14-14A-v1-patchoff-edit'), ('S04-4A-v4f', 'S04-4A-v4-patchoff-edit')):
    same(fx[k], rd('stills/keys/%s.req.json' % edit), 'fix ' + k)
check(not [r for g in ('candidates', 'states', 'locations', 'fixes') for r in C.requests(S, g) if C.problems(S, r)]
      and not [r for r in C.requests(S, 'stills', batch='all') if C.problems(S, r)], 'no request has a ban word, placeholder or missing ref')

# (b) free steps, pixel for pixel
def px(a, b):
    x = np.asarray(Image.open(a).convert('RGB')).astype(int); y = np.asarray(Image.open(b).convert('RGB')).astype(int)
    return x.shape == y.shape and int((x != y).any(2).sum()) == 0
L = os.path.join(J, 'cast/locked'); K = os.path.join(J, 'stills/keys')
C.restore_face(os.path.join(L, 'eva-edit.png'), os.path.join(J, 'cast/round1/candidates/cand-02.png'), os.path.join(OUT, 'eva-composite.png'), [480, 545, 235, 290], 28)
check(px(os.path.join(OUT, 'eva-composite.png'), os.path.join(L, 'eva-composite.png')), 'restore: eva-composite.png pixel-identical')
for src, dst, sid in (('eva-composite', 'eva', 'eva'), ('helmet-off-gen', 'helmet-off', 'helmet-off'), ('costume-gen', 'costume', 'costume'), ('props-composite', 'props', 'props')):
    pn = (S.group('lock').get(sid) or S.group('states').get(sid))['pin']
    C.pin_grey(os.path.join(L, src + '.png'), os.path.join(OUT, dst + '.png'), pn['cols'], pn['rows'], '#8a8a8a')
    check(px(os.path.join(OUT, dst + '.png'), os.path.join(L, dst + '.png')), 'pin: %s.png pixel-identical (cols %s rows %s)' % (dst, pn['cols'], pn['rows']))
    rec = C.pin_grey(os.path.join(L, src + '.png'), os.path.join(OUT, dst + '-auto.png'), None, None, '#8a8a8a')
    g = np.asarray(Image.open(os.path.join(L, src + '.png')).convert('L')).astype(float) > 200
    inside = all(g[:, x].mean() > 0.9 for x in rec['cols']) and all(g[y, :].mean() > 0.9 for y in rec['rows'])
    d = np.abs(np.asarray(Image.open(os.path.join(OUT, dst + '-auto.png')).convert('RGB')).astype(float) - np.asarray(Image.open(os.path.join(L, dst + '.png')).convert('RGB')).astype(float)).mean()
    check(inside and len(rec['cols']) == len(pn['cols']) and len(rec['rows']) == len(pn['rows']) and abs(rec['bg_after_mean'] - 138) <= 1.5 and rec['bg_after_std'] <= json.load(open(os.path.join(L, 'pin-%s.json' % dst)))['bg_after_std'] + 0.3 and d < 0.5,
          'pin auto-gutters %s: cols %s rows %s inside the gutters, background %.1f±%.1f, mean |Δ| vs the job\'s %.3f' % (dst, rec['cols'], rec['rows'], rec['bg_after_mean'], rec['bg_after_std'], d))
C.paste_region(os.path.join(L, 'props-ball.png'), os.path.join(L, 'props-capsule-edit.png'), os.path.join(OUT, 'props-composite.png'), [1283, 723, 2560, 1440], 0)
check(px(os.path.join(OUT, 'props-composite.png'), os.path.join(L, 'props-composite.png')), 'paste (hard): props-composite.png pixel-identical')
for k in ('S22-22-v1f', 'S14-14A-v1f', 'S04-4A-v4f'):
    e = S.group('fixes')[k]
    C.paste_region(S.rel(e['src']), S.rel(e['edit']), os.path.join(OUT, k + '.png'), e['box'], e['feather'], e['why'])
    check(px(os.path.join(OUT, k + '.png'), os.path.join(K, k + '.png')), 'paste (feather %d): %s.png pixel-identical' % (e['feather'], k))

# (c) quote vs the ledger
rows = [json.loads(l) for l in open(os.path.join(J, 'stills/ledger.jsonl')) if l.strip()]
byid = {}
for r in rows:
    m = re.match(r'(key|ad|location) (\S+)(?: (\S+))?$', r['label'])
    if m and r['status'] == 200:
        byid[m.group(2) + ('-' + m.group(3) if m.group(3) else '') if m.group(1) == 'key' else m.group(2)] = r['usd']
errs = []
for g, rs in (('locations', C.requests(S, 'locations')), ('stills', C.requests(S, 'stills', batch='all'))):
    for r in rs:
        if r['id'] in byid:
            e = C.estimate(S, '2560x1440', r['prompt'], r['refs'], r['n'])
            errs.append((abs(e - byid[r['id']]) / byid[r['id']], r['id'], e, byid[r['id']]))
worst = max(errs)
tot_e, tot_a = sum(x[2] for x in errs), sum(x[3] for x in errs)
check(worst[0] < 0.02, 'quote within 2%% of the ledger on %d calls (worst %s: $%.4f vs $%.4f; total $%.2f vs $%.2f)' % (len(errs), worst[1], worst[2], worst[3], tot_e, tot_a))
print('%d FAIL' % len(fails) if fails else 'ALL PASS')
sys.exit(1 if fails else 0)
