# -*- coding: utf-8 -*-
# Build the worked example casting.json from The Lull's own records (2026-10-23): every prompt is the one the job SENT
# (its *.req.json), factored into the job's named snippets; refuses unless each expands back exactly.
import glob, json, os, re, sys
J = os.path.expanduser('~/Downloads/launch-videos/manus2-space')
sys.path.insert(0, os.path.join(J, 'tools')); sys.dont_write_bytecode = True
import cast_sheet as cs, keyframes as kf                                   # noqa: E402  (reads only; no network)
from final_data import NEG, BANNED_WORLD, BANNED_PLACES, STATION          # noqa: E402
sys.path.insert(0, os.path.expanduser('~/.claude/skills/product-launch-sting/video/casting'))
import casting                                                             # noqa: E402

rd = lambda p: json.load(open(os.path.join(J, p), encoding='utf-8'))
text = {
    'NEG': NEG, 'STATION': STATION, 'SIDES': cs.SIDES, 'FROM_MASTER': cs.FROM_MASTER,
    'TAIL': cs.TAIL.replace(NEG, '{NEG}'),
    'LAYOUT': cs.LAYOUT.replace(cs.GREY, '{GREY}').replace(cs.SIDES, '{SIDES}'),
    'PRE_FACE': kf.PRE_FACE, 'PRE_LOC': kf.PRE_LOC, 'PLATE_TAIL': kf.PLATE_TAIL.replace(NEG, '{NEG}'),
    'PRE_FACE_OFF': kf.PRE_FACE.replace('the helmet camera on her right, ', '').replace(
        'from the front and back', 'from the front and back with the helmet off and no backpack'),
}
spec = {
    '_note': ("Worked example: The Lull (manus2-space, 2026-10-23), one East Asian woman of about 40 as a fictional astronaut, "
              "locked the Higgsfield way and every key frame built from her sheets. Every prompt here is the one the job "
              "sent (expanded from these snippets, byte for byte). The job kept two ledgers and caps (cast/round1, "
              "$8.50; stills, $12): $2.23 for 9 sheet calls, $13.24 for 29 still calls. Copy into DIR/tools/casting.json "
              "for a new job only as a pattern: the person, world and ban list are this film's."),
    'root': '..', 'grey': '#8a8a8a', 'cap': 20.5, 'ledger': '../cast/ledger.jsonl',
    'dirs': {'candidates': '../cast/round1/candidates', 'locked': '../cast/locked', 'locations': '../stills/locations',
             'stills': '../stills', 'review': '../stills/review'},
    'ban': list(BANNED_WORLD) + list(BANNED_PLACES), 'text': text,
    'candidates': {}, 'lock': {}, 'states': {}, 'locations': {}, 'stills': {}, 'fixes': {}, 'faces': {},
}
S = casting.Spec.__new__(casting.Spec)               # an in-memory Spec for expand() only
S.text = dict(casting.TEXT, **text); S.text['GREY_HEX'] = '#8a8a8a'


def factor(p):
    order = sorted(S.text, key=lambda k: -len(S.expand('{%s}' % k, k)))
    t = p
    for k in order:
        if k == 'GREY_HEX':
            continue
        t = t.replace(S.expand('{%s}' % k, k), '{%s}' % k)
    assert S.expand(t, 'check') == p, 'factor failed'
    return t


def ref(r):
    m = re.match(r'cast/locked/([\w-]+)\.png$', r)
    if m and m.group(1) in ('eva', 'helmet-off', 'costume', 'props'):
        return 'sheet:' + m.group(1)
    m = re.match(r'stills/locations/([\w-]+)-v\d+\.png$', r)
    if m:
        return 'loc:' + m.group(1)
    return '../' + r


def cols(pin):
    ps = pin['panels']
    xs = sorted({p[2] for p in ps if p[2] < 2560}); ys = sorted({p[3] for p in ps if p[3] < 1440})
    return {'cols': [x + 5 for x in xs], 'rows': [y + 5 for y in ys]}


for f, cid in (('cand-01', 'from-A'), ('cand-02', 'asian')):
    r = rd('cast/round1/candidates/%s.req.json' % f)
    spec['candidates'][cid] = {'n': 1, 'refs': ['../' + x for x in r.get('refs', [])], 'prompt': factor(r['prompt']),
                               'note': 'became %s' % f}
r = rd('cast/locked/eva-edit.req.json'); c = rd('cast/locked/eva-composite.json')
spec['lock']['eva'] = {'pick': 'cand-02', 'prompt': factor(r['prompt']),
                       'restore': {'ellipse': c['center'] + c['radii'], 'feather': c['feather_blur']},
                       'pin': cols(rd('cast/locked/pin-eva.json'))}
for sid, raw in (('helmet-off', 'helmet-off-gen'), ('costume', 'costume-gen'), ('props', 'props-ball')):
    r = rd('cast/locked/%s.req.json' % raw)
    spec['states'][sid] = {'refs': [ref(x) for x in r['refs']], 'prompt': factor(r['prompt']),
                           'pin': cols(rd('cast/locked/pin-%s.json' % sid)), 'note': 'the job named the raw edit %s.png' % raw}
r = rd('cast/locked/props-capsule-edit.req.json'); c = rd('cast/locked/props-composite.json')
spec['fixes']['props-capsule'] = {'sheet': 'props', 'edit': '../cast/locked/props-capsule-edit.png', 'prompt': factor(r['prompt']),
                                  'box': c['box'], 'feather': 0, 'why': c['why'], 'pin': cols(rd('cast/locked/pin-props.json'))}
for name in kf.LOCATIONS:
    r = rd('stills/locations/%s-v1.req.json' % name)
    spec['locations'][name] = {'refs': [ref(x) for x in r['refs']], 'prompt': factor(r['prompt'])}
picks = rd('stills/picks.json')
spec['_picks'] = {'locations': picks['locations']}


def latest(folder, sid):
    vs = [(int(m.group(1)), f) for f in glob.glob(os.path.join(J, folder, sid + '-v*.req.json'))
          for m in [re.search(re.escape(sid) + r'-v(\d+)\.req\.json$', f)] if m]
    return json.load(open(max(vs)[1], encoding='utf-8'))


for key in kf.LEG_LOC:
    L = kf.legs()[key]; sid = '%s-%s' % (L['shot'], key)
    r = latest('stills/keys', sid)
    face = None if key in kf.NO_FACE or key in ('1a', '1b') else ('helmet-off' if key == '26' else 'eva')
    e = {'batch': 'identity' if key in kf.IDENTITY else 'rest', 'dir': 'keys', 'refs': [ref(x) for x in r['refs']],
         'prompt': factor(r['prompt']), 'meta': {'leg': r['leg'], 'use': r['use']}}
    if face:
        e['face'] = face
    spec['stills'][sid] = e
for aid in kf.AD_REFS:
    r = latest('stills/ad', aid)
    spec['stills'][aid] = {'batch': 'ad', 'dir': 'ad', 'refs': [ref(x) for x in r['refs']], 'prompt': factor(r['prompt']),
                           'meta': {'asset': r['asset'], 'slot': r['slot']}}
for fx, edit in (('S22-22-v1f', 'S22-22-v1-patchfix-edit'), ('S14-14A-v1f', 'S14-14A-v1-patchoff-edit'), ('S04-4A-v4f', 'S04-4A-v4-patchoff-edit')):
    c = rd('stills/keys/%s.json' % fx); r = rd('stills/keys/%s.req.json' % edit)
    spec['fixes'][fx] = {'src': '../stills/keys/' + c['original'], 'out': '../stills/keys/%s.png' % fx,
                         'edit': '../stills/keys/%s.png' % edit, 'prompt': factor(r['prompt']), 'box': c['box'],
                         'feather': c['feather'], 'why': c['why']}
spec['faces'] = {'eva': [120, 150, 820, 850], 'helmet-off': [160, 230, 800, 870]}
out = sys.argv[1]
json.dump(spec, open(out, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('wrote %s: %d candidates, %d states, %d locations, %d stills, %d fixes; %d snippets'
      % (out, len(spec['candidates']), len(spec['states']), len(spec['locations']), len(spec['stills']), len(spec['fixes']), len(text)))
