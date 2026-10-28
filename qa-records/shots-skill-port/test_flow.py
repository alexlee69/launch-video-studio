# -*- coding: utf-8 -*-
"""QA 2 · flow. Each kind of input into a spec and through both models; storyboard plate → pencil sketch → shot →
key prompt → casting plan; Seedance through gen.mjs against a mock fal (fake key, temporary HOME); the casting
upgrades; the sketches themselves (legend, determinism, aspects, staleness, status)."""
import json, os, re, shutil, subprocess, time
from qa_lib import (QA, V, PY, GEN, run, shots, ph, cast, check, fresh, write_json, read, load, done, png, jpg, plate_job,
                    casting_job, shots_spec, PLATES, Mock)

X = fresh(os.path.join(QA, 'out', 'flow'))
SP = lambda j: os.path.join(j, 'tools', 'shots.json')

# ---- F1 init
j0 = fresh(os.path.join(X, 'init'))
rc, out = shots(['init'], j0)
st = load(SP(j0))
check('F1 init writes the starter, with no model in it', rc == 0 and 'model' not in st and 'Ask Alex which model' in out, out)
rc, out = shots(['check'], j0)
check('F1b check refuses the starter: no model ("ask Alex which one") and the unfilled hints', rc == 2 and 'ask Alex which one' in out
      and 'replace the hint' in out, out)
rc, out = shots(['init', '--spec', 'tools/s2.json', '--model', 'seedance', '--shots', 'A1,A2'], j0)
s2 = load(os.path.join(j0, 'tools', 's2.json'))
check('F1c init --model seedance --shots A1,A2: both shots, the model set', rc == 0 and s2.get('model') == 'seedance' and list(s2['shots']) == ['A1', 'A2'], out)

# ---- the job used from here on: plates, casting, shots
J = plate_job(fresh(os.path.join(X, 'job')))
casting_job(J)

# ---- F2 a few sentences: Claude proposes, Alex confirms
BRIEF = 'A founder walks into her empty office at dawn and opens the laptop. Keep it quiet.'
PROPOSED = ['recipe', 'lens', 'motion', 'key.frame', 'light']
spec = shots_spec(shots={'S01': {
    'brief': BRIEF, 'proposed': list(PROPOSED), 'recipe': 'reveal-pullback', 'sec': 5, 'people': ['hero'], 'place': 'office',
    'temp': 'cold', 'key': {'frame': 'Wide: the founder steps in from the right, the laptop on the desk.',
                            'light': 'Grey dawn light from the windows.'},
    'motion': {'beats': ['She walks to the desk.', 'She opens the laptop.']}}})
write_json(SP(J), spec)
rc, out = shots(['check'], J)
check('F2 a few sentences: check warns while Claude\'s additions are only proposed', rc == 1 and 'still only proposed' in out, out)
rc, out = shots(['show', 'S01'], J)
check('F2b show prints Alex\'s words verbatim and lists what is only proposed', BRIEF in out and ', '.join(PROPOSED) in out, out)
rc, out = shots(['confirm', 'S01'], J)
s = load(SP(J))['shots']['S01']
check('F2c confirm records his OK; his words are untouched', rc == 0 and s['proposed'] == [] and sorted(s['confirmed']) == sorted(PROPOSED)
      and s['brief'] == BRIEF, out)
rc, out = shots(['check'], J)
check('F2d then check is clean', rc == 0 and '!' not in out, out)
rc, out = shots(['build', 'S01'], J)
h3 = read(os.path.join(J, 'shots', 'S01.h3.txt'))
recipe_cam = load(os.path.join(V, 'shots', 'recipes.json'))['recipes']['reveal-pullback']['camera']
check('F2e the H3 prompt: the recipe\'s camera, the beats, then the tail', h3.startswith(recipe_cam) and 'She walks to the desk. She opens the laptop.' in h3
      and h3.rstrip().endswith('No text, no captions, no logos.'), h3)
plan = load(os.path.join(J, 'shots', 'plan.json'))
check('F2f plan.json: a dry-run H3 gen.mjs line', plan['shots'][0]['gen'] == 'node $V/footage/gen.mjs video --image <the picked key frame> '
      '--prompt @shots/S01.h3.txt --out footage/fal/S01.mp4 --sec 5', plan)

# ---- F3 a detailed script, on Seedance
SCRIPT = 'She turns to him: "We made it." He laughs.'
spec = load(SP(J))
spec['shots']['S02'] = {
    'script': SCRIPT, 'model': 'seedance', 'sec': 6, 'people': ['hero', 'friend'], 'count': 2, 'place': 'office', 'temp': 'warm',
    'scene': 'Two founders in the empty office at dawn.', 'first': 'Both stand by the window.', 'final': 'Both in a medium shot, laughing.',
    'key': {'frame': 'Medium-wide: the two founders by the window.'}, 'lens': {'mm': 35, 'distance': 'three metres'},
    'light': 'Soft dawn light.', 'palette': {'only': ['the blue of the dawn sky'], 'accent': 'orange'}, 'realism': '{REAL_FILM}',
    'audio': ['her voice', 'his laugh', 'the hum of the city'],
    'motion': {'camera': 'The camera pushes in slowly.', 'beats': [
        {'t': [0, 3], 'do': 'She turns to him.', 'say': {'who': 'hero', 'line': 'We made it.'}}, {'t': [3, 6], 'do': 'He laughs.'}]}}
write_json(SP(J), spec)
rc, out = shots(['build', 'S02'], J)
sd = read(os.path.join(J, 'shots', 'S02.seedance.txt'))
order = ['REFERENCES:', 'SCENE:', 'FIRST FRAME:', 'OPTICS:', 'CAMERA:', 'FINAL FRAMING:', 'ACTION:', 'BODY AND PHYSICS:', 'LIGHT:',
         'COLOUR:', 'REALISM:', 'AUDIO:', 'LOCKS:']
pos = [sd.find(('' if i == 0 else '\n\n') + b) for i, b in enumerate(order)]
check('F3 Seedance: the 13 blocks, each on its own paragraph, in order', rc == 0 and all(p >= 0 for p in pos) and pos == sorted(pos), (pos, sd[:300]))
check('F3b the line is verbatim and lip-synced, and locked as the only words', '0:00-0:03. She turns to him. The founder says, lip-synced and word for word: "We made it."' in sd
      and 'The only spoken words are "We made it." No text' in sd, sd)
check('F3c REFERENCES describes the one image Seedance gets (the key frame); no @Image tags, no MAP LEGEND',
      sd.startswith('REFERENCES: The input image is the first frame of this shot. Keep exactly as they are: the people in it (the founder and her co-founder) with their faces, bodies and wardrobe; the place; the light.')
      and '@Image' not in sd and 'MAP LEGEND' not in sd, sd[:400])
check('F3d OPTICS gives the angle; AUDIO lists exactly the sounds, no music', 'OPTICS: 35 mm full-frame look, about 54 degrees horizontal field of view, from about three metres.' in sd
      and 'AUDIO: The soundtrack holds exactly these sounds and nothing else: the spoken lines above; her voice; his laugh; the hum of the city. No music.' in sd, sd)
plan = {r['shot']: r for r in load(os.path.join(J, 'shots', 'plan.json'))['shots']}
check('F3e plan.json: the Seedance draft at 480p and the final line at 720p (S01\'s row kept beside it)', list(plan) == ['S01', 'S02']
      and plan['S02']['gen'] == 'node $V/footage/gen.mjs video --endpoint bytedance/seedance-2.5/image-to-video --image <the picked key frame> '
      '--prompt @shots/S02.seedance.txt --out footage/fal/S02.mp4 --sec 6 --res 480p'
      and plan['S02']['final'] == 'node $V/footage/gen.mjs video --endpoint bytedance/seedance-2.5/image-to-video --image <the picked key frame> '
      '--prompt @shots/S02.seedance.txt --out footage/fal/S02-720p.mp4 --sec 6 --res 720p', plan)
check('F3f the script is kept as written', load(SP(J))['shots']['S02']['script'] == SCRIPT)
spec = load(SP(J))
spec['res'] = '720p'
write_json(SP(J), spec)
shots(['build', 'S02'], J)
row = {r['shot']: r for r in load(os.path.join(J, 'shots', 'plan.json'))['shots']}['S02']
check('F3g a film-wide "res": "720p" drafts at 720p, with no separate final line', '--res 720p' in row['gen'] and 'final' not in row, row)
spec['res'] = '480p'
write_json(SP(J), spec)
shots(['build', 'S02'], J)

# ---- F4 a rough storyboard: Alex's own drawing as the position reference
png(os.path.join(J, 'assets', 'sketches', 'S03.png'), 320, 180)
spec = load(SP(J))
spec['shots']['S03'] = {'brief': 'his drawing: she sits at the desk', 'sec': 5, 'people': ['hero'], 'place': 'office', 'temp': 'cold',
                        'position': {'file': 'assets/sketches/S03.png', 'legend': {'red': 'her', 'blue': 'the desk'}},
                        'key': {'frame': 'She sits at the desk.'}, 'motion': {'camera': 'Locked off.', 'beats': ['She types.']}}
write_json(SP(J), spec)
rc, out = shots(['build', 'S03'], J)
kp = read(os.path.join(J, 'shots', 'S03.key.txt'))
check('F4 his drawing is Image 3 (after her sheet and the place), with his legend and "none of its lines appear"',
      'Image 3 is the position reference only: it gives the pose and the composition, nothing else. In it, the RED marks are her; '
      'the BLUE marks are the desk. None of its lines, colours or paper appear in the frame.' in kp, kp)

# ---- F5 the storyboard chain: plate → pencil sketch → shot → key prompt → casting plan
rc, out = ph(['draw'], J)
rc2, out2 = ph(['sketch', '--sheet'], J)
pl = os.path.join(J, 'assets', 'plates')
ids = list(PLATES['plates'])
check('F5 the plates and their sketches draw (a PNG + its .json each, and the sheet)', rc == 0 and rc2 == 0
      and all(os.path.isfile(os.path.join(pl, '%s-sketch.%s' % (i, e))) for i in ids for e in ('png', 'json'))
      and os.path.isfile(os.path.join(pl, 'sketches-sheet.jpg')), out + out2)
spec = load(SP(J))
spec['shots']['S04'] = {'brief': 'she walks in', 'sec': 5, 'people': ['hero'], 'place': 'office', 'temp': 'warm', 'position': {'plate': 'S01'},
                        'key': {'frame': 'Wide: she walks in.'}, 'motion': {'camera': 'The camera pushes in slowly.', 'beats': ['She walks in.']}}
write_json(SP(J), spec)
rc, out = shots(['check'], J)
check('F5b position.plate finds the sketch: check is clean', rc == 0, out)
shots(['build', 'S04'], J)
kp = read(os.path.join(J, 'shots', 'S04.key.txt'))
lg = load(os.path.join(pl, 'S01-sketch.json'))['legend']
want = 'In it, ' + '; '.join('the %s marks are %s' % (c.upper(), v) for c, v in lg.items()) + '.'
check('F5c the key prompt sends it as Image 3 and carries the sketch\'s own legend', 'Image 3 is the position reference only' in kp and want in kp
      and list(lg) == ['red', 'yellow', 'green', 'grey'], (want, kp))
rc, out = shots(['show', 'S04'], J)
check('F5d show names the sketch and what it shows', 'Position reference: assets/plates/S01-sketch.png (plate S01)' in out
      and 'it shows: Figure 1 (hero) walks in the centre, about 60% of the frame tall, facing left, feet near the bottom; prop 1 (phone) in the centre, at mid height.' in out, out)
rc, out = shots(['emit-casting', 'S04'], J)
cs = load(os.path.join(J, 'tools', 'casting.json'))
e = cs['stills'].get('S04') or {}
check('F5e emit-casting: the sketch rides as a ref relative to casting.json, and it is there',
      rc == 0 and e.get('refs') == ['sheet:hero', 'loc:office', '../assets/plates/S01-sketch.png']
      and os.path.isfile(os.path.join(J, 'tools', '../assets/plates/S01-sketch.png')) and e['meta'].get('from') == 'shots', (out, e))
rc, out = cast(['plan', 'stills', '--show', 'S04'], J)
check('F5f casting.py plan quotes it (no refusal) and --show prints the prompt with the legend', rc == 0 and 'Image 3 is the position reference only' in out
      and 'the RED marks are the people' in out and '✗' not in out, out[-600:])

# ---- F6 the sketches themselves
rc, out = ph(['sketch'], J)
check('F6 a second sketch run leaves every file as it was (deterministic)', rc == 0 and out.count('(unchanged)') == len(ids), out)
L = {i: load(os.path.join(pl, '%s-sketch.json' % i))['legend'] for i in ids}
check('F6b each legend names only the colours its sketch uses', list(L['S03']) == ['grey'] and list(L['S02']) == ['red', 'yellow', 'green', 'grey']
      and list(L['S04']) == ['red', 'yellow', 'green', 'grey'], L)
check('F6c "faces away" is explained only where a head faces away; props only where there are props',
      'faces away' in L['S04']['yellow'] and 'faces away' not in L['S02']['yellow'] and 'product or prop' in L['S01']['yellow']
      and 'product or prop' not in L['S02']['yellow'], L)
from PIL import Image
im = Image.open(os.path.join(pl, 'S01-sketch.png'))
meta = json.loads(im.text.get('lv-position', '{}'))
side = load(os.path.join(pl, 'S01-sketch.json'))
check('F6d the PNG carries lv-position (id, aspect, plate hash), the .json the same hash, the legend and a description',
      im.size == (1920, 1080) and list(im.text) == ['lv-position'] and meta.get('id') == 'S01' and meta.get('plate_hash') == side.get('plate_hash')
      and side.get('lv') == 'position' and side.get('says', '').startswith('Figure 1 (hero) walks'), (meta, side))
for asp, size in (('9x16', (1080, 1920)), ('1x1', (1080, 1080))):
    a = plate_job(fresh(os.path.join(X, 'asp-' + asp)), dict(json.loads(json.dumps(PLATES)), aspect=asp))
    rc, out = ph(['sketch', 'S02'], a)
    check('F6e a %s spec sketches at %dx%d' % (asp, size[0], size[1]), rc == 0 and Image.open(os.path.join(a, 'assets', 'plates', 'S02-sketch.png')).size == size, out)
# status names a sketch used as a shot's still
os.makedirs(os.path.join(J, 'out', 'main'), exist_ok=True)
write_json(os.path.join(J, 'out', 'main', 'timeline.json'), {'aspects': ['16x9'], 'shots': [{'id': 'S01', 'bg': 'assets/plates/S01-sketch.png'},
                                                                                         {'id': 'S02', 'bg': 'assets/plates/S02.png'}]})
rc, out = ph(['status'], J)
check('F6f status names a shot that shows a pencil sketch (exit 1)', rc == 1 and 'pencil position sketch' in out and 'S01 (assets/plates/S01-sketch.png)' in out
      and 'S02  assets/plates/S02.png' in out, out)

# ---- F7 a sketch older than its plate
P = os.path.join(J, 'tools', 'placeholders.json')
orig = read(P)


def edit(fn):
    d = load(P)
    fn(d)
    write_json(P, d)
    return shots(['check'], J)


rc, out = edit(lambda d: d['plates']['S01']['figures'][0].update(tag='a new tag'))
rc2, out2 = edit(lambda d: d['plates']['S01'].update(look='night', line='a new line', lens='24 mm'))
rc3, out3 = edit(lambda d: d['defaults'].update(grain=9))
check('F7 a new tag, look, line, lens or grain leaves the sketch current', rc == 0 and rc2 == 0 and rc3 == 0, out + out2 + out3)
rc, out = edit(lambda d: d['plates']['S01']['figures'][0].update(x=0.3))
check('F7b moving the person makes the sketch stale: warned, with the command', rc == 1 and 'was drawn before plate S01 last changed' in out
      and 'placeholders.py sketch S01' in out, out)
rc, out = edit(lambda d: (d['plates']['S01'].pop('horizon'), d['defaults'].update(horizon={'y': 0.5, 'color': '#333333'})))
check('F7c a horizon now coming from "defaults" counts too', rc == 1 and 'drawn before plate S01' in out, out)
ph(['sketch', 'S01'], J)
rc, out = shots(['check'], J)
check('F7d drawing it again clears the warning', rc == 0, out)
open(P, 'w', encoding='utf-8').write(orig)
ph(['sketch', 'S01'], J)

# ---- F8 Seedance through gen.mjs, against the mock
g = fresh(os.path.join(X, 'gen'))
jpg(os.path.join(g, 'key.jpg'), 320, 180)
jpg(os.path.join(g, 'last.jpg'), 320, 180, (10, 20, 30))
shutil.copy(os.path.join(J, 'shots', 'S02.seedance.txt'), os.path.join(g, 'p.txt'))
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=24', '-t', '1', '-pix_fmt', 'yuv420p',
                os.path.join(g, 'clip.mp4')], check=True)
m = Mock(os.path.join(X, 'mock'))
try:
    env = m.env(fresh(os.path.join(X, 'home')))
    base = ['node', GEN, 'video', '--endpoint', 'bytedance/seedance-2.5/image-to-video', '--image', 'key.jpg', '--prompt', '@p.txt']
    rc, out = run(base + ['--out', 'S02.mp4', '--sec', '6', '--res', '480p'], cwd=g, env=env)
    check('F8 the Seedance dry run quotes 6 s at 480p (about $1.32) and sends nothing', rc == 0 and '$1.32' in out and not m.log(), out[-400:])
    m.post('/file', {'name': 'clip.mp4', 'from': os.path.join(g, 'clip.mp4'), 'mode': 'ok', 'ctype': 'video/mp4'})
    m.post('/scenario', {'timeline': [[0, 'COMPLETED']], 'result': {'video': {'url': '$CDN/clip.mp4', 'content_type': 'video/mp4'}}})
    rc, out = run(base + ['--out', 'S02.mp4', '--sec', '6', '--res', '480p', '--go'], cwd=g, env=env, timeout=300)
    posts = [x for x in m.log() if x.get('port') == 'api' and x.get('method') == 'POST']
    b = posts[0].get('body') if posts else {}
    check('F8b --go sends one request, to the Seedance image-to-video endpoint, with the key', rc == 0 and len(posts) == 1
          and posts[0].get('endpoint') == 'bytedance/seedance-2.5/image-to-video' and posts[0].get('auth') == 'a', out[-400:])
    check('F8c its fields: the prompt with its line breaks, the key frame as a JPEG data URI, "6", 480p, sound on, nothing else',
          b.get('prompt') == read(os.path.join(g, 'p.txt')).strip() and '\n\nSCENE:' in b.get('prompt', '') and (b.get('image_url') or {}).get('mime') == 'image/jpeg'
          and b.get('duration') == '6' and b.get('resolution') == '480p' and b.get('generate_audio') is True
          and set(b) == {'prompt', 'image_url', 'duration', 'resolution', 'generate_audio'}, json.dumps(b)[:400])
    check('F8d the clip is downloaded and the run logged', os.path.getsize(os.path.join(g, 'S02.mp4')) == os.path.getsize(os.path.join(g, 'clip.mp4'))
          and os.path.isfile(os.path.join(g, 'S02.fal.json')), os.listdir(g))
    check('F8e the key never appears in the output or the log', Mock.KEY not in out and Mock.KEY not in read(os.path.join(g, 'S02.fal.json')))
    rc, out = run(base + ['--out', 'S02b.mp4', '--end', 'last.jpg', '--audio', 'off', '--seed', '11', '--go'], cwd=g, env=env, timeout=300)
    posts = [x for x in m.log() if x.get('port') == 'api' and x.get('method') == 'POST']
    b2 = posts[-1].get('body') if posts else {}
    check('F8f --end, --audio off and --seed: end_image_url, generate_audio false, seed 11; 5 s and 720p by default',
          rc == 0 and len(posts) == 2 and (b2.get('end_image_url') or {}).get('mime') == 'image/jpeg' and b2.get('generate_audio') is False
          and b2.get('seed') == 11 and b2.get('duration') == '5' and b2.get('resolution') == '720p', json.dumps(b2)[:400])
    h3p = os.path.join(g, 'h3.txt')
    open(h3p, 'w').write('The camera pushes in.\nShe turns.\n')
    m.post('/scenario', {'timeline': [[0, 'COMPLETED']], 'result': {'video': {'url': '$CDN/clip.mp4', 'content_type': 'video/mp4'}}})
    rc, out = run(['node', GEN, 'video', '--image', 'key.jpg', '--prompt', '@h3.txt', '--out', 'h3.mp4', '--go'], cwd=g, env=env, timeout=300)
    posts = [x for x in m.log() if x.get('port') == 'api' and x.get('method') == 'POST']
    b3 = posts[-1].get('body') if posts else {}
    check('F8g an H3 prompt file is still joined into one line, with H3\'s own fields', rc == 0 and b3.get('prompt') == 'The camera pushes in. She turns.'
          and posts[-1].get('endpoint') == 'minimax/h3-max/image-to-video' and 'generate_audio' not in b3, json.dumps(b3)[:300])
finally:
    m.stop()

# ---- F9 the casting upgrades
c = fresh(os.path.join(X, 'cast2'))
cs = casting_job(c)
rc, out = cast(['plan'], c)
check('F9 the starter\'s templates (ids starting with _) are skipped by plan', not re.search(r'\b_(pose|product-gold|rider|extra-1|animal)\b', out), out[-400:])
rc, out = cast(['plan', 'locations', '--show', 'office'], c)
check('F9b {FOV:35} in a LENS GATE expands to the lens and its angle', '35 mm full-frame look, about 54 degrees horizontal field of view' in out, out[-400:])
png(os.path.join(c, 'assets', 'glasses.png'))
cs = load(os.path.join(c, 'tools', 'casting.json'))
cs['text']['POSE'] = 'low in an aero tuck on a road bike'
cs['states']['pose'] = cs['states'].pop('_pose')
cs['states']['product-gold'] = dict(cs['states'].pop('_product-gold'), refs=['../assets/glasses.png'])
cs['states']['animal'] = cs['states'].pop('_animal')
write_json(os.path.join(c, 'tools', 'casting.json'), cs)
rc, out = cast(['plan', 'states', '--show', 'pose', '--show', 'product-gold', '--show', 'animal'], c)
check('F9c renamed templates plan: the pose and the proportion lock; the product 1:1; the animal\'s three panels',
      rc == 0 and 'low in an aero tuck on a road bike' in out and 'about seven heads tall' in out and 'supplies only the product, reproduced 1:1' in out
      and 'LEFT panel: a close-up of the head' in out, out[-800:])
rc, out = cast(['plan', 'states', '--show', 'friend'], c)
check('F9d a second person is a states entry with no refs: a sheet of their own, with the proportion lock', rc == 0 and 'The person is a man of about 60' in out
      and 'about seven heads tall' in out and 'three side-by-side panels' in out, out[-500:])

# ---- F10 recipes
spec = load(SP(J))
spec['shots']['S05'] = {'brief': 'the glasses come off', 'sec': 5, 'recipe': 'natural-packshot', 'temp': 'cold', 'key': {'frame': 'Close on her hand.'},
                        'motion': {'beats': ['She takes the glasses off.']}}
spec['shots']['S06'] = {'brief': 'her face, slowed', 'sec': 5, 'recipe': 'telephoto-face-slowmo', 'temp': 'warm', 'people': ['hero'],
                        'motion': {'beats': ['She breathes out.']}}
write_json(SP(J), spec)
rc, out = shots(['check'], J)
check('F10 a recipe\'s expectations are checked: a packshot needs a product; slow motion should give its capture rate (the preset does)',
      'the natural-packshot recipe needs a product' in out and 'slow motion should give the capture rate' not in out, out)
rc, out = shots(['build', 'S05'], J)
h = read(os.path.join(J, 'shots', 'S05.h3.txt'))
rec = load(os.path.join(V, 'shots', 'recipes.json'))['recipes']['natural-packshot']
check('F10b the recipe fills the camera; its lock waits for Seedance (H3 is a motion brief)', h.startswith(rec['camera']), h)
rc, out = shots(['build', 'S06'], J)
h = read(os.path.join(J, 'shots', 'S06.h3.txt'))
check('F10c a slow-motion recipe on H3 says so before the tail, and the tail drops "real-time"',
      'Slow motion, constant for the whole shot: filmed at 120 fps, so everything moves at about a quarter of real speed. Natural, candid motion.' in h
      and 'Real-time' not in h and 'Shot on a cinema camera' not in h, h)

done('QA 2 flow')
