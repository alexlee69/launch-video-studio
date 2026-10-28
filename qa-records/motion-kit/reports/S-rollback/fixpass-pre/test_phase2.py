# -*- coding: utf-8 -*-
"""QA 5 · shot writer phase 2 (2026-10-26). Each new field renders where SHOTS.md says, a wrong type is refused in one
line, old shots compile byte for byte (every spec the other suites left in out/, through the pre-phase-2 shots.py and
this one), negatives stay out of every prompt until confirmed, the lint, the worked example in SHOTS.md, the brief's
new parts (rebuilt from the rollback copy), and the 15 s / 30 s starters (--grid). No network, no keys, nothing spent.
Run it after the other suites (run_all.sh does): it reads the specs they leave in out/.
  SHOTS_QA_VIDEO=<a copy of the skill>/video /usr/bin/python3 -B test_phase2.py"""
import copy, glob, importlib.util, json, os, re, shutil, subprocess, sys
from qa_lib import QA, V, PY, SHOTS, run, shots, check, fresh, write_json, read, load, done, jpg, png

X = fresh(os.path.join(QA, 'out', 'phase2'))
OLD = os.path.join(QA, 'rollback', 'shots_shots.py.pre-phase2')
SKILL = os.path.dirname(V)
EX = os.path.join(V, 'shots', 'examples', 'phase2-band-shots.json')
sys.dont_write_bytecode = True

# ---- the pre-phase-2 tool beside this copy's own helpers (recipes, casting.py, placeholders.py)
OV = fresh(os.path.join(X, 'oldv'))
os.makedirs(os.path.join(OV, 'shots'))
shutil.copy(OLD, os.path.join(OV, 'shots', 'shots.py'))
for f in ('recipes.json', 'starter.json'):
    shutil.copy(os.path.join(V, 'shots', f), os.path.join(OV, 'shots', f))
shutil.copytree(os.path.join(V, 'casting'), os.path.join(OV, 'casting'), ignore=shutil.ignore_patterns('examples'))
shutil.copytree(os.path.join(V, 'storyboard'), os.path.join(OV, 'storyboard'), ignore=shutil.ignore_patterns('examples'))
OLD_PY = os.path.join(OV, 'shots', 'shots.py')


def module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


old_m, new_m = module(OLD_PY, 'shots_old'), module(SHOTS, 'shots_new')
ALLOWED = re.compile(r' \(allowed: [^)]*\)')


def snapshot(m, path):
    """everything a spec compiles to, without writing: refusals, warnings, and per shot its video and key prompts and
    plan row (or the exception), so two tools can be compared"""
    try:
        S, out = m.load(path)
    except Exception as e:                      # noqa: BLE001  (a Refuse: unreadable spec)
        return {'refused': str(e)}
    snap = {'errs': [ALLOWED.sub('', x) for x in S.errs], 'warns': list(S.warns), 'shots': {}}
    for s in out:
        r = {}
        for k, f in (('video', lambda: m.expand(s.video_prompt(), S.text)), ('key', lambda: s.key_final() if s.key is not None else None),
                     ('emit', lambda: s.key_prompt() if s.key is not None else None), ('row', lambda: m.plan_row(S, s)[0])):
            try:
                r[k] = f()
            except Exception as e:              # noqa: BLE001
                r[k] = 'EXC %s: %s' % (type(e).__name__, e)
        snap['shots'][s.id] = r
    return snap


# ---- Q1 old shots compile byte for byte: every spec the other suites left behind, plus The Lull and the starters
specs = sorted(p for p in glob.glob(os.path.join(QA, 'out', '*', '**', 'tools', '*.json'), recursive=True)
               if os.sep + 'phase2' + os.sep not in p)
corpus = []
for p in specs:
    try:
        d = json.load(open(p, encoding='utf-8'))
    except (OSError, ValueError):
        continue
    if isinstance(d, dict) and isinstance(d.get('shots'), dict):
        corpus.append(p)
lull = fresh(os.path.join(X, 'lull'))
os.makedirs(os.path.join(lull, 'tools'))
shutil.copy(os.path.join(V, 'shots', 'examples', 'manus2-space-shots.json'), os.path.join(lull, 'tools', 'shots.json'))
shutil.copy(os.path.join(V, 'casting', 'examples', 'manus2-space-casting.json'), os.path.join(lull, 'tools', 'casting.json'))
corpus.append(os.path.join(lull, 'tools', 'shots.json'))
same, diff, nshots, allowed = 0, [], 0, 0
for p in corpus:
    a, b = snapshot(old_m, p), snapshot(new_m, p)
    nshots += len(b.get('shots', {}))
    if a == b:
        same += 1
    else:
        diff.append(os.path.relpath(p, QA))
check('Q1 %d old specs (%d shots) compile the same through the pre-phase-2 shots.py and this one: refusals, warnings, '
      'video, key and emit prompts, plan rows' % (len(corpus), nshots), len(corpus) >= 100 and not diff, diff[:5])

# ---- Q1b the CLI: check and show print the same (bar the new info lines), with the same exit codes
cli_diff, ncalls = [], 0
strip_i = lambda o: '\n'.join(l for l in o.splitlines() if not l.startswith('i '))
for p in corpus:
    job, rel = os.path.dirname(os.path.dirname(p)), os.path.relpath(p, os.path.dirname(os.path.dirname(p)))
    calls = [['check', '--spec', rel]]
    try:
        ids = [k for k in json.load(open(p, encoding='utf-8'))['shots'] if not str(k).startswith('_')][:6]
    except Exception:                           # noqa: BLE001
        ids = []
    calls += [['show', i, '--spec', rel] for i in ids]
    for c in calls:
        a = run([PY, '-B', OLD_PY] + c, cwd=job)
        b = run([PY, '-B', SHOTS] + c, cwd=job)
        ncalls += 1
        if a[0] != b[0] or ALLOWED.sub('', strip_i(a[1])) != ALLOWED.sub('', strip_i(b[1])):
            cli_diff.append((os.path.relpath(p, QA), c[0], a[1][-200:], b[1][-200:]))
check('Q1b %d check/show runs print the same as before (new "i" info lines aside) with the same exit codes' % ncalls,
      ncalls >= 200 and not cli_diff, cli_diff[:2])

# ---- Q1c The Lull: build and emit-casting write byte-identical files through both tools
la, lb = fresh(os.path.join(X, 'lull-old')), fresh(os.path.join(X, 'lull-new'))
for j, tool in ((la, OLD_PY), (lb, SHOTS)):
    shutil.copytree(os.path.join(lull, 'tools'), os.path.join(j, 'tools'))
    run([PY, '-B', tool, 'build'], cwd=j)
    cs = load(os.path.join(j, 'tools', 'casting.json'))
    cs.pop('stills', None)
    write_json(os.path.join(j, 'tools', 'casting.json'), cs)
    run([PY, '-B', tool, 'emit-casting'], cwd=j)
files = sorted(os.path.relpath(f, la) for f in glob.glob(os.path.join(la, '**', '*'), recursive=True) if os.path.isfile(f))
same_f = [f for f in files if os.path.isfile(os.path.join(lb, f)) and read(os.path.join(la, f), 'rb') == read(os.path.join(lb, f), 'rb')]
check('Q1c The Lull: build + emit-casting write the same %d files, byte for byte' % len(files), len(files) >= 40 and same_f == files,
      sorted(set(files) - set(same_f))[:5])


# ---- a job for the new fields: the worked example, a casting with its sheet and location, the band's photo
def job(name, edit=None, spec=None):
    j = fresh(os.path.join(X, name))
    write_json(os.path.join(j, 'tools', 'casting.json'), {'lock': {'runner': {}, 'friend': {}}, 'locations': {'bridge': {}}, 'stills': {}})
    jpg(os.path.join(j, 'assets', 'band.jpg'))
    d = copy.deepcopy(spec or load(EX))
    d['people']['friend'] = {'sheet': 'friend', 'is': 'her friend'}
    if edit:
        edit(d)
    write_json(os.path.join(j, 'tools', 'shots.json'), d)
    return j


def prompts(j, sid):
    """(rc, show's output, the video prompt, the key prompt) of one shot"""
    rc, out = shots(['show', sid], j)
    vid = re.search(r'\n-- (?:h3|seedance) prompt --\n(.*?)(?:\n[✗!i] |\Z)', out, re.S)
    key = re.search(r'\n-- key frame prompt --\n(.*?)\n\n-- ', out, re.S)
    return rc, out, vid.group(1) if vid else '', key.group(1) if key else ''


def block(p, name):
    m = re.search(r'(?:^|\n\n)%s:\s?(.*?)(?=\n\n[A-Z ]+:|\Z)' % re.escape(name), p, re.S)
    return m.group(1) if m else ''


K01 = lambda d: d['shots']['K01']
K02 = lambda d: d['shots']['K02']

# ---- Q2 each field where it belongs (Seedance K01)
J = job('fields')
rc, out, vid, key = prompts(J, 'K01')
act, locks, body, refs = block(vid, 'ACTION'), block(vid, 'LOCKS'), block(vid, 'BODY AND PHYSICS'), block(vid, 'REFERENCES')
lines = act.split('\n')
check('Q2a trick: the first line of the ACTION, with its 3 consequences', lines[0].startswith('The idea this whole shot is built on')
      and 'so the band stays put in the frame' in lines[0] and lines[0].count('. ') >= 3 and 'Because of it:' in lines[0], act[:400])
check('Q2b must: the second line, marked as coming first', lines[1].startswith('These two rules come before everything else')
      and 'The band never moves within the frame' in lines[1], lines[1:2])
check('Q2c task: the third line, never dropped', lines[2].startswith('Under the whole shot') and 'checking the time on the band' in lines[2], lines[2:3])
beat_i = [i for i, l in enumerate(lines) if re.match(r'\d:\d\d-\d:\d\d\. ', l)]
act_i = [i for i, l in enumerate(lines) if l.startswith('Acting for the runner')]
check('Q2d acting: after the timed beats: direction … tactic, eye beats on the timecodes, restrained, never into the lens',
      beat_i == [3, 4, 5] and act_i == [6] and 'Tactic (this is what we see): she cuts round' in lines[6]
      and lines[7].startswith("The runner's eyes, moment by moment: 0:00-0:03 on the light") and lines[8].startswith('The register stays restrained')
      and lines[9].startswith('The runner never looks into the lens.'), act[-900:])
check('Q2e fail lines: in LOCKS, written as "If …, the shot is wrong."', 'If the band slides, turns or changes size in the frame, the shot is wrong.' in locks
      and 'If the street stands still while her arm swings, the shot is wrong.' in locks, locks)
check('Q2f sizes: in BODY AND PHYSICS, three measures, nothing grows or shrinks', 'The band, measured three ways that agree: in the frame, a sixth'
      in body and 'against the body, as wide as two of her fingers' in body and 'Nothing grows or shrinks' in body, body)
check('Q2g refs "first": in REFERENCES, right after what to keep', 'describes changes. Take nothing else from it: not the lens flare in its top-right corner.' in refs, refs)
check('Q2h key frame: each reference\'s don\'t-take line right after its image, and the sizes after the first frame',
      "the wardrobe. Take nothing else from Image 1: not the grey backdrop, the flat studio light or the sheet's layout. Image 2" in key
      and 'and light. Take nothing else from Image 2: not the people on the pavement or its midday light. Image 3' in key
      and 'running away behind it. The band, measured three ways that agree' in key and 'Nothing grows or shrinks' not in key, key[:900])
order = [vid.find(x) for x in ('REFERENCES:', 'SCENE:', 'FIRST FRAME:', 'OPTICS:', 'CAMERA:', 'ACTION:', 'BODY AND PHYSICS:', 'LIGHT:', 'REALISM:', 'AUDIO:', 'LOCKS:')]
check('Q2i the block order is unchanged (REFERENCES … LOCKS), no new blocks', order == sorted(order) and -1 not in order
      and not re.search(r'\n\n(?!REFERENCES|SCENE|FIRST FRAME|OPTICS|CAMERA|FINAL FRAMING|ACTION|BODY AND PHYSICS|LIGHT|COLOUR|REALISM|AUDIO|LOCKS)[A-Z ]+:', vid), order)

# ---- Q3 the short H3 prompt: the trick and the fail lines that fit, nothing else
rc, out, h3, key2 = prompts(J, 'K02')
check('Q3a H3: the camera, then the trick, then the beats, then the fail lines, then the tail', h3.startswith('Straight down, locked off. The idea this whole shot')
      and h3.index('travel across the desk.') < h3.index('Window light sweeps') < h3.index('If the band moves') < h3.index('Real-time, natural'), h3)
check('Q3b the H3 key frame gains the sizes', 'The band, measured three ways that agree: in the frame, a fifth of the frame width' in key2, key2)
J3 = job('h3-extra', lambda d: K02(d).update(must=['The band stays at the centre.'], task='she taps the band', people=['runner'],
                                              acting={'goal': 'see her time'}))
rc, out, h3x, _ = prompts(J3, 'K02')
check('Q3c H3 leaves must, task and acting out, and says so', 'stays at the centre' not in h3x and 'taps the band' not in h3x and 'see her time' not in h3x
      and 'on H3 the short prompt carries only the trick and the fail lines that fit; must, task and acting reach a Seedance prompt only' in out, out[-600:])
LONG = ['the band %s while %s' % (a, b) for a in ('moves', 'turns over', 'slides left', 'slides right', 'lifts up') for b in
        ('the shadows travel across the whole desk from the window side', 'the coffee cup at the top edge of the frame stays exactly where it is')]
J4 = job('h3-budget', lambda d: K02(d).update(fail=LONG))
rc, out, h3b, _ = prompts(J4, 'K02')
nkept = h3b.count('the shot is wrong')
check('Q3d H3 budget: fail lines go in while the prompt stays within 120 words; the rest are named in a warning',
      0 < nkept < len(LONG) and len(re.findall(r"[\w'’]+", h3b)) <= 125 and '%d fail lines left out of the H3 prompt to keep it within 120 words' % (len(LONG) - nkept) in out,
      (nkept, len(h3b.split()), out[-400:]))

# ---- Q4 negatives: Claude's, so out of every prompt until Alex confirms them
rc, out, vid, key = prompts(J, 'K01')
check('Q4a proposed negatives: show lists them apart; neither prompt has them', 'Negatives proposed by Claude (in no prompt until `shots.py confirm K01`): the band drifts' in out
      and 'None of these may happen' not in vid and 'drifts or turns' not in vid and 'drifts or turns' not in key, out[:600])
rc, out = shots(['build', 'K01'], J)
check('Q4b build refuses while they are only proposed', rc == 2 and 'still only proposed' in out and not os.path.exists(os.path.join(J, 'shots', 'K01.seedance.txt')), out)
J5 = job('neg-unlisted', lambda d: K01(d).update(proposed=[]))
rc, out, vid, _ = prompts(J5, 'K01')
check('Q4c negatives listed in neither proposed nor confirmed: still out of the prompt, and a warning says why',
      'None of these may happen' not in vid and 'they stay out of every prompt until `shots.py confirm K01`' in out, out[-500:])
rc, out = shots(['build', 'K01'], J5)
built = read(os.path.join(J5, 'shots', 'K01.seedance.txt')) if os.path.exists(os.path.join(J5, 'shots', 'K01.seedance.txt')) else ''
check('Q4d …so a build that runs (nothing proposed) still writes no negatives', rc == 1 and built and 'None of these may happen' not in built, out[-300:])
rc, out = shots(['confirm', 'K01'], J)
rc2, out2, vid, _ = prompts(J, 'K01')
locks = block(vid, 'LOCKS')
check('Q4e after confirm: in LOCKS, after the fail lines, before the no-text line', rc == 0 and 'Negatives proposed' not in out2
      and locks.index('the shot is wrong.') < locks.index('None of these may happen: the band drifts or turns within the frame; the camera films her from outside') < locks.index('No text'), locks)
rc, out = shots(['build', 'K01'], J)
check('Q4f and build writes them', rc in (0, 1) and 'None of these may happen' in read(os.path.join(J, 'shots', 'K01.seedance.txt')), out[-300:])
J6 = job('neg-reproposed', lambda d: K01(d).update(proposed=['negatives'], confirmed=['negatives', 'trick']))
rc, out, vid, _ = prompts(J6, 'K01')
check('Q4g negatives both confirmed and proposed again (edited since): out until confirmed again', 'None of these may happen' not in vid, vid[-300:])

# ---- Q5 refusals: a wrong type or shape is one clear line naming the field
BAD = [
    ('trick-num', lambda s: s.update(trick=5), 'shots.K01.trick: text, or {rule, so} (got 5)'),
    ('trick-norule', lambda s: s.update(trick={'so': ['a', 'b', 'c']}), 'shots.K01.trick: the one idea the shot is built on'),
    ('trick-key', lambda s: s.update(trick={'rule': 'The band stays.', 'why': 'x'}), 'shots.K01.trick: unknown key why'),
    ('must-str', lambda s: s.update(must='The band stays.'), 'shots.K01.must: a list of text (got "The band stays.")'),
    ('fail-num', lambda s: s.update(fail=[1]), 'shots.K01.fail: a list of text (got [1])'),
    ('fail-empty', lambda s: s.update(fail=['  ']), 'shots.K01.fail: each entry is a failure line in words'),
    ('refs-str', lambda s: s.update(refs='runner'), 'shots.K01.refs: a list of objects (got "runner")'),
    ('refs-who', lambda s: s.update(refs=[{'ref': 'nobody', 'dont': ['x']}]), 'shots.K01.refs[0].ref: "nobody" is none of this shot\'s references (runner, bridge, band, first)'),
    ('refs-nodont', lambda s: s.update(refs=[{'ref': 'runner'}]), 'shots.K01.refs[0].dont: what NOT to take from runner'),
    ('refs-twice', lambda s: s.update(refs=[{'ref': 'runner', 'dont': ['a']}, {'ref': 'runner', 'dont': ['b']}]), 'shots.K01.refs[1].ref: "runner" is listed twice'),
    ('refs-dontstr', lambda s: s.update(refs=[{'ref': 'runner', 'dont': 'the light'}]), 'shots.K01.refs[0].dont: a list of text'),
    ('task-list', lambda s: s.update(task=['x']), 'shots.K01.task: text (got ["x"])'),
    ('acting-str', lambda s: s.update(acting='calm'), 'shots.K01.acting: an object (got "calm")'),
    ('acting-eyes', lambda s: s['acting'].update(eyes=[{'t': [3, 1], 'do': 'x'}]), 'shots.K01.acting.eyes[0].t: [start, end] in seconds'),
    ('acting-late', lambda s: s['acting'].update(eyes=[{'t': [6, 9], 'do': 'x'}]), 'shots.K01.acting.eyes: an eye beat ends at 9 s, after the shot\'s 8 s'),
    ('acting-lens', lambda s: s['acting'].update(lens=[3]), 'shots.K01.acting.lens: the moments the person may look into the lens'),
    ('acting-who', lambda s: s['acting'].update(who='friend'), 'shots.K01.acting.who: "friend" is not one of this shot\'s people (runner)'),
    ('acting-two', lambda s: s.update(people=['runner', 'friend'], count=2), "shots.K01.acting: whose acting? Set acting.who to one of this shot's people (runner, friend)"),
    ('acting-nobody', lambda s: s.update(people=[], count=0, refs=[]), 'shots.K01.acting: acting needs a person in the shot (people)'),
    ('acting-restr', lambda s: s['acting'].update(restrained='yes'), 'shots.K01.acting.restrained: true or false (got "yes")'),
    ('sizes-list', lambda s: s.update(sizes=['a']), 'shots.K01.sizes: an object (got ["a"])'),
    ('sizes-str', lambda s: s.update(sizes={'the band': 'small'}), 'shots.K01.sizes.the band: {frame, body, hand}'),
    ('sizes-empty', lambda s: s.update(sizes={'the band': {}}), 'shots.K01.sizes.the band: {frame, body, hand}'),
    ('sizes-key', lambda s: s.update(sizes={'the band': {'frame': 'a sixth', 'width': 'x'}}), 'shots.K01.sizes.the band: unknown key width'),
    ('neg-str', lambda s: s.update(negatives='none'), 'shots.K01.negatives: a list of text (got "none")'),
    ('trick-rulenum', lambda s: s.update(trick={'rule': 5}), 'shots.K01.trick.rule: text (got 5)'),
    ('eyes-donum', lambda s: s['acting'].update(eyes=[{'t': [0, 2], 'do': 3}]), 'shots.K01.acting.eyes[0].do: text (got 3)'),
    ('sizes-num', lambda s: s.update(sizes={'the band': {'frame': 6}}), 'shots.K01.sizes.the band.frame: text (got 6)'),
]
bad = []
for name, edit, want in BAD:
    j = job('bad-' + name, lambda d, e=edit: e(K01(d)))
    rc, out = shots(['check'], j)
    errs = [l for l in out.splitlines() if l.startswith('✗ ') and not re.match(r'✗ tools/shots\.json: \d+ problem', l)]
    if rc != 2 or len(errs) != 1 or want not in errs[0]:
        bad.append((name, rc, errs))
check('Q5 %d bad inputs: each refused (exit 2) in exactly one line naming the field' % len(BAD), not bad, bad[:3])

# ---- Q6 the lint
J7 = job('vague', lambda d: (K01(d).update(task='she keeps a very light grip on the band'),
                             K01(d)['motion']['beats'][0].update(do='She runs slightly faster onto the bridge'),
                             K01(d).update(brief='A beautiful morning, slightly misty.')))
rc, out = shots(['check'], J7)
vw = [l for l in out.splitlines() if 'vague words' in l]
check('Q6a vague words in a phase-2 shot\'s own text warn once, naming each and where, and suggest a number or a body comparison',
      len(vw) == 1 and '"very" (task)' in vw[0] and '"slightly" (motion.beats[0].do)' in vw[0] and 'beautiful' not in vw[0]
      and 'give a number or a comparison with the body' in vw[0], vw or out[-500:])
check('Q6b …but not in Alex\'s brief, nor in the built-in snippets ("slightly soft focus" is ours)', vw and 'brief' not in vw[0] and 'KEY_TAIL' not in vw[0], vw)
# The Lull has 20 "slightly" and 10 "very" in its own text and no phase-2 field: its check stays as it was (Q1b)
spec = {'root': '..', 'casting': 'casting.json', 'model': 'seedance', 'aspect': '16:9',
        'people': {'runner': {'sheet': 'runner', 'is': 'the runner'}}, 'places': {'bridge': {'loc': 'bridge'}}, 'products': {},
        'shots': {'P1': {'sec': 5, 'people': ['runner'], 'place': 'bridge', 'count': 1, 'scene': 'She runs.', 'first': 'She runs.',
                         'audio': ['her steps'], 'motion': {'camera': 'Locked off.', 'beats': [{'t': [0, 5], 'do': 'She runs very fast'}]}}}}
J8 = job('task-info', spec=spec)
rc, out = shots(['check'], J8)
check('Q6c a Seedance shot with people and no task: an info line, the exit code unchanged (0), no vague-word lint on an old-style shot',
      rc == 0 and re.search(r'^i shots\.P1: people, but no task', out, re.M) and 'vague' not in out, out)
rc, out = shots(['show', 'P1'], J8)
check('Q6d show prints that info line for its shot (exit 0)', rc == 0 and '\ni shots.P1: people, but no task' in out, out[-300:])
spec_h3 = copy.deepcopy(spec)
spec_h3['model'] = 'h3'
rc, out = shots(['check'], job('task-info-h3', spec=spec_h3))
check('Q6e …not on H3, where a task can\'t reach the prompt', 'no task' not in out, out)
J9 = job('lint-shape', lambda d: K01(d).update(trick={'rule': 'The band stays. The city moves.', 'so': ['a', 'b']},
                                               must=['a', 'b', 'c'], sizes={'the band': {'frame': 'a sixth of the frame'}}))
rc, out = shots(['check'], J9)
check('Q6f warns: a two-sentence trick, 2 consequences, 3 must rules, a size measured one way',
      'trick.rule: 2 sentences' in out and 'trick.so: 2 consequences; derive 3–4' in out and 'must: 3 rules' in out
      and 'sizes.the band: 1 of the 3 measures' in out, out[-800:])
J10 = job('hand-prompt', lambda d: K01(d)['motion'].update(prompt='She runs. No text.'))
rc, out = shots(['check'], J10)
check('Q6g a hand-written motion.prompt: the phase-2 fields never reach it, and it says which',
      'motion.prompt: written by hand, so trick, must, fail, task, acting, refs first and sizes never reach the video prompt' in out, out[-500:])
J11 = job('neg-notrick', lambda d: K01(d).pop('trick'))
rc, out = shots(['check'], J11)
check('Q6h negatives with no trick warn (they are its inversions)', 'negatives: negatives are the trick turned inside out, and this shot has no trick' in out, out[-400:])
J12 = job('first-h3', lambda d: K02(d).update(refs=[{'ref': 'first', 'dont': ['its glare']}]))
rc, out = shots(['check'], J12)
check('Q6i refs "first" on H3 warns (only a Seedance prompt has a REFERENCES block)', '"first" (the input image) is for a Seedance prompt' in out, out[-400:])

# ---- Q7 the worked example in SHOTS.md is what the tool prints
sm = read(os.path.join(V, 'SHOTS.md'))
m = re.search(r'<!-- phase2-example -->\n```text\n(.*?)\n```\n<!-- /phase2-example -->', sm, re.S)
J13 = job('example')
both = prompts(J13, 'K01')[1] + '\n' + prompts(J13, 'K02')[1]
doc_lines = [l for l in (m.group(1).splitlines() if m else []) if l.strip()]
missing = [l[:80] for l in doc_lines if l not in both]
check('Q7 SHOTS.md\'s %d compiled example lines appear word for word in show K01 / show K02' % len(doc_lines), m and len(doc_lines) >= 8 and not missing, missing)
rc, out = shots(['check'], J13)
check('Q7b the example checks with one warning only: its negatives are still proposed',
      rc == 1 and [l for l in out.splitlines() if l.startswith('! ')] == ["! shots.K01: still only proposed, not yet OK'd by Alex: negatives (show it, then `shots.py confirm K01`)"], out)

# ---- Q8 the brief: rebuilt from the rollback copy with both pointer scripts, idempotent
t = fresh(os.path.join(X, 'brief'))
for src, dst in (('SKILL.md', 'SKILL.md'), ('video_GUIDE.md', 'video/GUIDE.md'), ('video_FOOTAGE.md', 'video/FOOTAGE.md'),
                 ('video_templates_footage-prompts.md', 'video/templates/footage-prompts.md'), ('video_templates_brief.md', 'video/templates/brief.md')):
    os.makedirs(os.path.dirname(os.path.join(t, dst)), exist_ok=True)       # as test_parity P8: the port's pointers need all five
    shutil.copy(os.path.join(QA, 'rollback', src), os.path.join(t, dst))
rc0, out0 = run([PY, '-B', os.path.join(QA, 'apply_pointers.py'), t])
before = read(os.path.join(t, 'video', 'templates', 'brief.md'))          # the brief as the shot-writer port left it
rc, out = run([PY, '-B', os.path.join(QA, 'apply_phase2_brief.py'), t])
rebuilt = read(os.path.join(t, 'video', 'templates', 'brief.md'))
check('Q8a apply_phase2_brief.py on the pointer-rebuilt rollback brief gives this copy\'s brief.md exactly (2 applied)',
      rc0 == 0 and out0.count('APPLIED') == 11 and rc == 0 and out.count('APPLIED') == 2
      and rebuilt == read(os.path.join(V, 'templates', 'brief.md')), out0 + out)
rc, out = run([PY, '-B', os.path.join(QA, 'apply_phase2_brief.py'), t])
check('Q8b a second run changes nothing (2 SKIP)', rc == 0 and out.count('SKIP') == 2, out)
br = read(os.path.join(V, 'templates', 'brief.md'))
rows = re.findall(r'^\| \*\*([^*]+)\*\* \|', br, re.M)
check('Q8c the passport has its 12 rows, one value each; the trigger map and the pacing targets are there',
      rows == ['Register', 'Accent colour', 'Display type', 'Type scale', 'Margins and axis', 'Transitions', 'Camera verb', 'Hero motif',
               'Travelling object', 'Light model', 'Sound', 'Bookend']
      and '| Cut | Cause in shot A | Effect in shot B | How the camera follows |' in br and 'a surprise by 2 s, the product by 3 s, the brand by 5 s' in br, rows)
import difflib  # noqa: E402
ops = [o[0] for o in difflib.SequenceMatcher(None, before.splitlines(), br.splitlines(), autojunk=False).get_opcodes()]
check('Q8d the new parts are insertions only: every line the brief had stays, in order', set(ops) == {'equal', 'insert'}, ops)

# ---- Q9 the starters: --grid clean, 120 BPM, their lengths and word caps
GRID_ROW = re.compile(r'^  (\S+)\s+(\S+)\s+(\d+:\d\d\.\d\d)–(\d+:\d\d\.\d\d)\s+f\d+\s+(\d+) beats\s+(\S+)\s*(.*)$')
for kit, sec, cap, nshot in (('launch15', 15, 16, (8, 10)), ('launch30', 30, 31, (12, 15))):
    j = fresh(os.path.join(X, kit))
    os.makedirs(os.path.join(j, 'assets'))
    shutil.copy(os.path.join(V, 'templates', kit + '.yaml'), os.path.join(j, 'beats.yaml'))
    for ph in glob.glob(os.path.join(V, 'templates', 'placeholders', '*.svg')):
        shutil.copy(ph, os.path.join(j, 'assets', 'placeholder-' + os.path.basename(ph)))
    rc, out = run(['node', os.path.join(V, 'lv.mjs'), '--job', j, '--grid'], cwd=j)
    rows = [GRID_ROW.match(l) for l in out.splitlines()]
    rows = [r for r in rows if r]
    words = sum(len([w for w in re.split(r'\s+|\s·\s', r.group(7)) if w.strip() and w != '·']) for r in rows)
    beats = sum(int(r.group(5)) for r in rows)
    check('Q9 %s: --grid exits 0 with no warnings; %d s at 120 BPM (%d beats), %d shots, %d words on screen (cap %d)'
          % (kit, sec, beats, len(rows), words, cap),
          rc == 0 and '!' not in out and ('timeline "main": %d.00 s' % sec) in out and '120 BPM' in out and beats == sec * 2
          and nshot[0] <= len(rows) <= nshot[1] and words <= cap, out[-900:])
    first = rows[0] if rows else None
    check('Q9b %s: the hook has no words; the name lands by 2 s; it ends on the end card, at least 2 s long' % kit,
          first and not first.group(7).strip() and rows[1].group(3) <= '0:02.00' and rows[-1].group(2) == 'endcard'
          and int(rows[-1].group(5)) >= 4, [r.groups() for r in rows][:3])

done('QA 5 phase 2')
