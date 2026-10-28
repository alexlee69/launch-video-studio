# -*- coding: utf-8 -*-
"""QA 2b · the casting upgrades through casting.py's real request path, against the casting port's local mock OpenAI
(qa/cast-skill-port/mock_openai.py: no network; a fake OPENAI_API_KEY in the environment, which casting.py uses
before it would ever read ~/Downloads/launch-videos/.env; HOME is left alone, or the user's numpy and Pillow vanish). The starter's templates, renamed as a
user would, reach the API with their new snippets expanded and their references uploaded in order; the LENS GATE's
{FOV:35} reaches the location plate; the image-count check stops a request before anything is sent."""
import hashlib, json, os, re, subprocess, sys
sys.dont_write_bytecode = True
QA = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(QA, '..', 'cast-skill-port'))
import mock_openai as M                                                         # noqa: E402
from qa_lib import V, CAST, PY, check, fresh, write_json, load, done, png      # noqa: E402

J = fresh(os.path.join(QA, 'out', 'casting-mock', 'job'))
srv, URL = M.start()
KEY = 'sk-test-' + 'Q' * 40
L = M.STATE['log']
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
P = lambda *a: os.path.join(J, *a)


def run(*args):
    env = dict(os.environ, OPENAI_BASE_URL=URL, OPENAI_API_KEY=KEY)
    p = subprocess.run([PY, '-B', CAST] + list(args), cwd=J, env=env, capture_output=True, text=True)
    return p.returncode, p.stdout + p.stderr


def builtin(name):
    import ast
    for node in ast.parse(open(CAST, encoding='utf-8').read()).body:
        if isinstance(node, ast.Assign) and any(getattr(t, 'id', '') == 'TEXT' for t in node.targets):
            return ast.literal_eval(node.value)[name]


GREY = '(#8a8a8a)'
PROPS = builtin('PROPORTIONS')
POSE = 'low in an aero tuck on a road bike, hands on the drops'

# ---- a filled starter with every template renamed, as a user would
rc, out = run('init', J)
s = load(P('tools', 'casting.json'))
s['text'].update(WHO='a woman of about 30 with light warm skin and short black hair', WARDROBE='a pink cycling jersey and black shorts', POSE=POSE)
unph = lambda t: re.sub(r'<[a-z][^<>]*>', 'filled in', t)
for g in ('states', 'locations', 'stills'):
    for e in s[g].values():
        e['prompt'] = unph(e['prompt'])
png(P('assets', 'glasses.png'), 1200, 675, (138, 138, 138))                # a product photo on the grey, as the sheet will be
from PIL import Image, ImageDraw
im = Image.open(P('assets', 'glasses.png'))
ImageDraw.Draw(im).rectangle([450, 280, 750, 400], fill=(200, 170, 40))
im.save(P('assets', 'glasses.png'))
for k in ('_pose', '_rider', '_extra-1', '_animal', '_product-gold'):
    s['states'][k.lstrip('_')] = s['states'].pop(k)
s['states']['product-gold']['refs'] = ['../assets/glasses.png']
s['stills'] = {}
write_json(P('tools', 'casting.json'), s)
rc, out = run('plan')
check('M1 the filled starter plans with every template renamed: a quote, nothing refused', rc == 0 and 'total quote $' in out and '✗' not in out, out[-500:])

# ---- the lock, as casting's own flow does it
run('candidates', '--go')
rc, out = run('lock', '--pick', 'cand-02', '--go')
check('M2 candidates and lock run against the mock', rc == 0 and os.path.isfile(P('cast', 'locked', 'hero.png')), out[-300:])
hero = sha(P('cast', 'locked', 'hero.png'))

# ---- states: the five templates' requests
n0 = len(L)
rc, out = run('states', '--go')
got = {}
for r in L[n0:]:
    p = r['fields']['prompt']
    for k, mark in (('pose', POSE), ('rider', 'in all three panels'), ('extra-1', 'The person is filled in'), ('animal', 'A reference sheet for an animal'),
                    ('product-gold', 'A faceless product sheet')):
        if mark in p:
            got[k] = r
check('M3 states --go sends the starter\'s 3 states plus the 5 renamed templates (8 requests)', rc == 0 and len(L) - n0 == 8 and len(got) == 5, (out[-300:], list(got)))
r = got.get('pose') or {'fields': {'prompt': ''}, 'files': []}
check('M4 the pose sheet: its pose, the proportion lock, the locked sheet uploaded as Image 1',
      r.get('endpoint') == 'edits' and POSE in r['fields']['prompt'] and PROPS in r['fields']['prompt'] and [f['sha'] for f in r['files']] == [hero], r['fields']['prompt'][:300])
r = got.get('rider') or {'fields': {'prompt': ''}, 'files': []}
check('M5 the rider sheet: the proportion lock, uploading the locked sheet', r.get('endpoint') == 'edits' and PROPS in r['fields']['prompt']
      and [f['sha'] for f in r['files']] == [hero], r['fields']['prompt'][:300])
r = got.get('product-gold') or {'fields': {'prompt': ''}, 'files': []}
check('M6 the product sheet: the product photo uploaded as Image 1, which "supplies only the product, reproduced 1:1"',
      r.get('endpoint') == 'edits' and [f['sha'] for f in r['files']] == [sha(P('assets', 'glasses.png'))]
      and r['fields']['prompt'].startswith('Image 1 ' + builtin('REF_PRODUCT')) and GREY in r['fields']['prompt'], r['fields']['prompt'][:300])
r = got.get('extra-1') or {'fields': {'prompt': ''}, 'files': []}
check('M7 a second person gets a sheet of their own from words alone (generations): the three panels, the proportions and the closing line',
      r.get('endpoint') == 'generations' and r['fields']['prompt'].startswith('A character reference sheet for a film: ONE image with three side-by-side panels')
      and PROPS in r['fields']['prompt'] and 'Before anything else, this frame reads as: ' in r['fields']['prompt'], r['fields']['prompt'][:300])
r = got.get('animal') or {'fields': {'prompt': ''}, 'files': []}
check('M8 the animal sheet: generations, head close-up, side and front on the grey', r.get('endpoint') == 'generations' and 'LEFT panel: a close-up of the head' in r['fields']['prompt']
      and 'the whole animal from the side' in r['fields']['prompt'] and GREY in r['fields']['prompt'], r['fields']['prompt'][:300])
check('M9 no snippet is left unexpanded in any request', not any(re.search(r'\{[A-Z][A-Z0-9_]*(?::[0-9.]+)?\}', x['fields']['prompt']) for x in L[n0:]))
check('M10 each new sheet landed, pinned to the grey (-gen + sheet)', all(os.path.isfile(P('cast', 'locked', '%s.png' % k)) and os.path.isfile(P('cast', 'locked', '%s-gen.png' % k))
                                                                          for k in ('pose', 'rider', 'extra-1', 'animal', 'product-gold')), os.listdir(P('cast', 'locked')))

# ---- locations: the LENS GATE
n0 = len(L)
rc, out = run('locations', '--go')
p = L[n0]['fields']['prompt'] if len(L) > n0 else ''
check('M11 the location plate\'s LENS GATE reaches the API with the lens and its angle', rc == 0 and 'LENS GATE:' in p
      and '35 mm full-frame look, about 54 degrees horizontal field of view; ready for a performer to be placed' in p, p[:400])

# ---- stills: the new reference phrases, and the image-count check before any request
run('pick', 'place-1', 'v1')
s = load(P('tools', 'casting.json'))
s['stills'] = {'S01': {'batch': 'identity', 'face': 'hero', 'refs': ['sheet:hero', 'loc:place-1', 'sheet:product-gold'],
                       'prompt': 'Image 1 {REF_FACE}. Image 2 {REF_PLACE}. Image 3 {REF_PRODUCT}. {EYES_COVERED} She rides past. {READS}speed. No text.',
                       'meta': {'shot': 'S01'}}}
write_json(P('tools', 'casting.json'), s)
n0 = len(L)
rc, out = run('stills', '--batch', 'identity', '--go')
r = L[n0] if len(L) > n0 else {'fields': {'prompt': ''}, 'files': []}
check('M12 a still with one-job references: three images uploaded in order, each phrase expanded',
      rc == 0 and [f['sha'] for f in r['files']] == [hero, sha(P('stills', 'locations', 'place-1-v1.png')), sha(P('cast', 'locked', 'product-gold.png'))]
      and r['fields']['prompt'].startswith('Image 1 ' + builtin('REF_FACE') + '. Image 2 ' + builtin('REF_PLACE')) and builtin('EYES_COVERED') in r['fields']['prompt'],
      r['fields']['prompt'][:400])
s['stills']['S02'] = {'batch': 'identity', 'face': 'hero', 'refs': ['sheet:hero', 'loc:place-1'], 'prompt': 'Image 1 is her. Image 3 is the sketch. A frame. No text.', 'meta': {}}
write_json(P('tools', 'casting.json'), s)
n0 = len(L)
rc, out = run('stills', '--batch', 'identity', '--go', '--only', 'S02')
check('M13 "Image 3" with two images sent is refused before the API (no request, nothing written)', rc == 2 and 'names Image 3 but sends 2 images' in out
      and len(L) == n0 and not os.path.exists(P('stills', 'keys', 'S02-v1.png')), out[-300:])
rc, out = run('plan', 'states', '--show', 'pose')
check('M14 plan --show prints the expanded prompt, free', rc == 0 and POSE in out and PROPS in out and len(L) == n0, out[-300:])

# ---- hygiene
outs = [o for _, o in [run('cost')]]
check('M15 the key is in no output and no file written', KEY not in ''.join(outs) and all(KEY not in open(os.path.join(dp, f), errors='ignore').read()
      for dp, _, fs in os.walk(J) for f in fs if f.endswith(('.json', '.jsonl'))))
check('M16 no __pycache__ in the skill', not any('__pycache__' in d for d, _, _ in os.walk(V)))
srv.shutdown()
done('QA 2b casting through the mock')
