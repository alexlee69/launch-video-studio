# -*- coding: utf-8 -*-
"""QA 3 · failure paths. Every refusal names the problem and exits 2 with nothing written; every warning exits 1.
shots.py, placeholders.py sketch, gen.mjs's Seedance arguments, casting.py's new checks."""
import copy, hashlib, json, os, re, shutil
from qa_lib import (QA, V, PY, GEN, run, shots, ph, cast, check, fresh, write_json, read, load, done, png, jpg, plate_job,
                    casting_job, shots_spec, PLATES)

X = fresh(os.path.join(QA, 'out', 'failures'))
sha = lambda p: hashlib.sha1(open(p, 'rb').read()).hexdigest()

# a valid base job: plates + sketches, casting, one H3 shot and one Seedance shot, all clean
B = plate_job(fresh(os.path.join(X, 'base')))
casting_job(B)
ph(['draw'], B)
ph(['sketch'], B)
png(os.path.join(B, 'assets', 'hand.png'))
GOOD = shots_spec(shots={
    'S01': {'brief': 'she walks in', 'sec': 5, 'people': ['hero'], 'place': 'office', 'temp': 'cold', 'position': {'plate': 'S01'},
            'key': {'frame': 'Wide: she walks in.'}, 'motion': {'camera': 'The camera pushes in slowly.', 'beats': ['She walks in.']}},
    'S02': {'brief': 'they talk', 'model': 'seedance', 'sec': 6, 'people': ['hero', 'friend'], 'count': 2, 'place': 'office', 'temp': 'warm',
            'scene': 'Two founders talk.', 'first': 'Both by the window.', 'key': {'frame': 'Both by the window.'}, 'audio': ['his laugh'],
            'motion': {'camera': 'Locked off.', 'beats': [{'t': [0, 3], 'do': 'She turns.', 'say': {'who': 'hero', 'line': 'We made it.'}},
                                                          {'t': [3, 6], 'do': 'He laughs.'}]}}})
write_json(os.path.join(B, 'tools', 'shots.json'), GOOD)
rc, out = shots(['check'], B)
check('X0 the base spec is clean (exit 0)', rc == 0, out)


def case(name, mutate, cmd=('check',), expect=2, must=(), job=None):
    """a copy of the base job with the spec mutated; returns (ok, output)"""
    d = os.path.join(X, name)
    shutil.rmtree(d, ignore_errors=True)
    shutil.copytree(job or B, d)
    s = copy.deepcopy(GOOD)
    mutate(s)
    write_json(os.path.join(d, 'tools', 'shots.json'), s)
    before = sorted(os.listdir(d))
    rc, out = shots(list(cmd), d)
    wrote = sorted(os.listdir(d)) != before or (os.path.isdir(os.path.join(d, 'shots')) and expect == 2)
    return rc == expect and all(m in out for m in must) and not (expect == 2 and wrote), out


S1 = lambda s: s['shots']['S01']
S2 = lambda s: s['shots']['S02']
ok, out = case('nomodel', lambda s: s.pop('model'), must=('no model for S01', 'ask Alex which one'))
check('X1 no model: refused, "ask Alex which one"', ok, out)
ok, out = case('badmodel', lambda s: S1(s).update(model='sora'), must=('model is h3 or seedance',))
check('X2 an unknown model is refused', ok, out)
ok, out = case('typo', lambda s: S1(s).update(camera=S1(s).pop('motion')), must=('unknown key camera',))
check('X3 a typo\'d key is refused (and the missing motion named)', ok and 'shots.S01.motion' in out, out)
ok, out = case('hint', lambda s: S1(s)['key'].update(frame='<FILL: the first frame>'), must=('replace the hint',))
check('X4 an unfilled <FILL: …> hint is refused', ok, out)
ok, out = case('snippet', lambda s: S1(s)['motion'].update(extra='{NOPE}'), must=('unknown snippet {NOPE}',))
check('X5 an unknown snippet is refused', ok, out)
ok, out = case('ban', lambda s: (s.update(ban=['laptop']), S1(s)['motion']['beats'].append('She opens the laptop.')), must=('in the ban list',))
check('X6 a ban word is refused', ok, out)
ok, out = case('notext', lambda s: S1(s)['motion'].update(tail='Natural motion.'), must=('does not say "no text"',))
check('X7 a prompt without "no text" is refused', ok, out)
ok, out = case('sec-h3', lambda s: S1(s).update(sec=11), must=('a number from 5 to 10',))
ok2, out2 = case('sec-frac', lambda s: S1(s).update(sec=5.5), must=('whole seconds (gen.mjs asks the model for whole seconds; got 5.5)',))
ok3, out3 = case('sec-sd', lambda s: S2(s).update(sec=31), must=('a number from 4 to 30',))
check('X8 a length outside the model\'s range, or not whole seconds, is refused', ok and ok2 and ok3, out + out2 + out3)
ok, out = case('nosheet', lambda s: s['people']['hero'].update(sheet='nobody'), must=('has no sheet in casting.json',))
ok2, out2 = case('nosheet2', lambda s: s['people']['hero'].pop('sheet'), must=('every character needs one',))
check('X9 a person without a casting sheet is refused', ok and ok2, out + out2)
ok, out = case('noplace', lambda s: s['places']['office'].update(loc='beach'), must=('not in casting.json\'s locations',))
check('X10 a place that is no casting location is refused', ok, out)
ok, out = case('noref', lambda s: (s['products'].update(glasses={'ref': 'assets/nope.png'}), S1(s).update(products=['glasses'])),
               must=('the product reference assets/nope.png is not a file',))
check('X11 a missing reference file is refused', ok, out)
ok, out = case('keyrefs', lambda s: S1(s)['key'].update(refs=['sheet:hero']), must=('given without key.prompt',))
check('X12 key.refs without key.prompt is refused', ok, out)
ok, out = case('imageN', lambda s: S1(s)['key'].update(prompt='Image 1 is her sheet. Image 3 is the plate. She walks. No text.', refs=['sheet:hero']),
               must=('names Image 3 but sends 1 reference',))
check('X13 "Image 3" with one image sent is refused', ok, out)
ok, out = case('wps', lambda s: S2(s)['motion']['beats'][0]['say'].update(line='We made it here after all those long nights together, finally.'),
               must=('needs about',))
check('X14 a line too long for its beat (over 2.7 words a second) is refused', ok, out)
ok, out = case('untimed', lambda s: S2(s)['motion']['beats'][1].pop('t'), must=('every beat has t: [start, end]',))
check('X15 Seedance: an untimed beat is refused', ok, out)
ok, out = case('noscene', lambda s: (S2(s).pop('scene'), S2(s).pop('first'), S2(s).pop('key')), must=('Seedance needs the whole shot', 'Seedance needs the first frame'))
check('X16 Seedance: a missing scene and first frame are refused', ok, out)
ok, out = case('both', lambda s: S1(s)['position'].update(file='assets/hand.png'), must=('a file or a plate, not both',))
check('X17 a position with both a file and a plate is refused', ok, out)
ok, out = case('noplate', lambda s: S1(s)['position'].update(plate='S99'), must=('no plate "S99"',))
check('X18 a plate the storyboard spec doesn\'t have is refused', ok, out)
ok, out = case('nophspec', lambda s: s.update(placeholders='nowhere.json'), must=('no storyboard spec at tools/nowhere.json',))
check('X19 no storyboard spec for position.plate is refused, with where it looked', ok, out)


def unsketched(s):
    pass
d = os.path.join(X, 'unsketched')
shutil.rmtree(d, ignore_errors=True)
shutil.copytree(B, d)
os.unlink(os.path.join(d, 'assets', 'plates', 'S01-sketch.png'))
rc, out = shots(['check'], d)
check('X20 a plate not sketched yet is refused with the command that draws it (free)', rc == 2
      and 'no sketch at assets/plates/S01-sketch.png yet; draw it (free): python3 $V/storyboard/placeholders.py sketch S01' in out, out)
os.unlink(os.path.join(d, 'assets', 'plates', 'S01-sketch.json'))
ph(['sketch', 'S01'], d)
os.unlink(os.path.join(d, 'assets', 'plates', 'S01-sketch.json'))
rc, out = shots(['check'], d)
check('X21 a sketch without its .json is warned (its legend unknown)', rc == 1 and 'has no record beside it' in out and 'no legend' in out, out)
ok, out = case('nolegend', lambda s: S1(s).update(position={'file': 'assets/hand.png'}), expect=1, must=('no legend, so the key prompt cannot say',))
check('X22 a hand sketch with no legend is warned', ok, out)
ok, out = case('nokey', lambda s: S1(s).pop('key'), expect=1, must=('the sketch only shapes the key frame',))
check('X23 a position on a shot with no key is warned', ok, out)
ok, out = case('legendtype', lambda s: S1(s)['position'].update(legend=['red']), must=('position.legend: an object (got ["red"])',))
ok2, out2 = case('platetype', lambda s: S1(s)['position'].update(plate=1), must=('position.plate: text (got 1)',))
check('X24 a legend that isn\'t {colour: meaning}, or a plate that isn\'t an id, is refused', ok and ok2, out + out2)
ok, out = case('moves', lambda s: S1(s)['motion'].update(camera='The camera pushes in, then tilts up and orbits.'), expect=1, must=('camera moves',))
check('X25 more than one camera move is warned', ok, out)
ok, out = case('style', lambda s: S1(s)['key'].update(frame='Wide, in the style of a famous director.'), expect=1, must=('in the style of',))
check('X26 "in the style of" is warned', ok, out)
ok, out = case('h3say', lambda s: S1(s)['motion'].update(beats=[{'do': 'She speaks.', 'say': 'Hello.'}]), expect=1, must=('no lip-sync',))
check('X27 dialogue on H3 is warned', ok, out)
ok, out = case('temps', lambda s: (S2(s).update(temp='cold'), s['shots'].update(S03=dict(copy.deepcopy(S1(s)), temp='cold'))), expect=1, must=('three cold shots in a row',))
check('X28 three cold shots in a row are warned', ok, out)
ok, out = case('count', lambda s: S2(s).pop('count'), expect=1, must=('how many people are visible',))
check('X29 Seedance without a head count is warned', ok, out)
ok, out = case('extras', lambda s: S1(s).update(extras='a crowd at the back'), expect=1, must=('extras without a sheet',))
check('X30 extras without sheets are warned', ok, out)

# ---- commands
rc, out = shots(['init'], B)
check('X31 init never overwrites a spec', rc == 2 and 'already exists' in out, out)
rc, out = shots(['init', '--shots', 'bad id'], fresh(os.path.join(X, 'init')))
check('X32 init --shots refuses an unsafe id', rc == 2 and '--shots' in out, out)
rc, out = shots(['show', 'S09'], B)
rc2, out2 = shots(['confirm', 'S09'], B)
rc3, out3 = shots(['build', 'S09'], B)
check('X33 show / confirm / build of an unknown shot are refused', rc == 2 and rc2 == 2 and rc3 == 2 and 'not in the spec' in out + out2 + out3, out + out2 + out3)
rc, out = shots(['fov', '3'], B)
rc2, out2 = shots(['fov', '35'], B)
check('X34 fov refuses a focal length outside 4–1200 mm; 35 mm is about 54 degrees', rc == 2 and rc2 == 0 and 'about 54 degrees' in out2, out + out2)
d = os.path.join(X, 'foreign')
shutil.rmtree(d, ignore_errors=True)
shutil.copytree(B, d)
cs = load(os.path.join(d, 'tools', 'casting.json'))
cs['stills']['S01'] = {'batch': 'identity', 'refs': [], 'prompt': 'theirs. No text.', 'meta': {}}
write_json(os.path.join(d, 'tools', 'casting.json'), cs)
h = sha(os.path.join(d, 'tools', 'casting.json'))
rc, out = shots(['emit-casting'], d)
check('X35 emit-casting refuses to replace a still it didn\'t write, and writes nothing', rc == 2 and 'not written by shots.py: S01' in out
      and sha(os.path.join(d, 'tools', 'casting.json')) == h, out)
rc, out = shots(['emit-casting'], B)
rc2, out2 = shots(['emit-casting'], B)
check('X36 its own stills it replaces freely (a second emit is fine)', rc == 0 and rc2 == 0, out + out2)
os.symlink(os.path.join(B, 'tools', 'shots.json'), os.path.join(X, 'link.txt'))
d = os.path.join(X, 'symlink')
shutil.rmtree(d, ignore_errors=True)
shutil.copytree(B, d)
os.makedirs(os.path.join(d, 'shots'), exist_ok=True)
os.symlink('/etc/hosts', os.path.join(d, 'shots', 'S01.h3.txt'))
rc, out = shots(['build', 'S01'], d)
check('X37 build never writes through a symlink', rc == 2 and 'symlink' in out and read('/etc/hosts') == read(os.path.realpath(os.path.join(d, 'shots', 'S01.h3.txt'))), out)

# ---- placeholders.py sketch
P = plate_job(fresh(os.path.join(X, 'sk')))
pl = os.path.join(P, 'assets', 'plates')
os.makedirs(pl)
png(os.path.join(pl, 'S01-sketch.png'))
rc, out = ph(['sketch'], P)
check('X38 sketch refuses to replace a PNG it didn\'t make, and draws nothing', rc == 2 and 'not a file this tool made' in out
      and 'S01-sketch.png' in out and sorted(os.listdir(pl)) == ['S01-sketch.png'], out)
os.unlink(os.path.join(pl, 'S01-sketch.png'))
open(os.path.join(pl, 'S02-sketch.json'), 'w').write('{"mine": true}\n')
rc, out = ph(['sketch'], P)
check('X39 …or a .json it didn\'t make', rc == 2 and 'S02-sketch.json' in out and sorted(os.listdir(pl)) == ['S02-sketch.json'], out)
os.unlink(os.path.join(pl, 'S02-sketch.json'))
os.symlink('/etc/hosts', os.path.join(pl, 'S03-sketch.png'))
rc, out = ph(['sketch'], P)
check('X40 …or a symlink', rc == 2 and 'S03-sketch.png' in out, out)
os.unlink(os.path.join(pl, 'S03-sketch.png'))
open(os.path.join(pl, 'sketches-sheet.jpg'), 'w').write('not mine')
rc, out = ph(['sketch', '--sheet'], P)
check('X41 …or a contact sheet it didn\'t make', rc == 2 and 'sketches-sheet.jpg' in out, out)
os.unlink(os.path.join(pl, 'sketches-sheet.jpg'))
rc, out = ph(['sketch', 'S09'], P)
check('X42 an unknown plate id is refused', rc == 2 and 'not in the spec: S09' in out, out)
bad = json.loads(json.dumps(PLATES))
bad['plates']['S01']['figures'][0]['pose'] = 'kneel'
plate_job(P, bad)
rc, out = ph(['sketch'], P)
check('X43 a spec problem is refused before anything is drawn', rc == 2 and 'pose: one of' in out and not os.listdir(pl), out)
plate_job(P)
png(os.path.join(pl, 'S01.png'))
rc, out = ph(['sketch', 'S01'], P)
check('X44 a sketch never touches the plate beside it (S01.png kept as it was)', rc == 0 and os.path.getsize(os.path.join(pl, 'S01.png')) < 1000, out)
rc, out = ph(['draw', 'S01'], P)
check('X45 …and draw refuses to replace a file that isn\'t a plate (the stand-in S01.png here)', rc == 2 and 'S01.png' in out, out)

# ---- gen.mjs: Seedance arguments
g = fresh(os.path.join(X, 'gen'))
jpg(os.path.join(g, 'key.jpg'))
home = fresh(os.path.join(X, 'home'))
env = dict(os.environ, HOME=home)
env.pop('FAL_KEY', None)
SD = ['--endpoint', 'bytedance/seedance-2.5/image-to-video']
for name, args, must in (
        ('X46 --audio on an H3 call is refused', ['--audio', 'off'], '--end and --audio are for Seedance'),
        ('X47 --end on an H3 call is refused', ['--end', 'key.jpg'], '--end and --audio are for Seedance'),
        ('X48 Seedance at 1080P is refused (480p or 720p)', SD + ['--res', '1080P'], '--res'),
        ('X49 Seedance longer than 30 s is refused', SD + ['--sec', '31'], '--sec'),
        ('X50 Seedance shorter than 4 s is refused', SD + ['--sec', '3'], '--sec'),
        ('X51 Seedance reference-to-video is refused: not wired', ['--endpoint', 'bytedance/seedance-2.5/reference-to-video'], 'image-to-video only'),
        ('X52 Seedance --audio must be on or off', SD + ['--audio', 'loud'], '--audio')):
    rc, out = run(['node', GEN, 'video', '--image', 'key.jpg', '--prompt', 'x. No text.', '--out', 'o.mp4'] + args, cwd=g, env=env)
    check(name, rc == 2 and must in out and sorted(os.listdir(g)) == ['key.jpg'], out[-300:])
rc, out = run(['node', GEN, 'video', '--prompt', 'x', '--out', 'o.mp4'] + SD, cwd=g, env=env)
check('X53 Seedance without a key frame (--image) is refused', rc == 2 and 'video takes one of --image' in out, out[-300:])

# ---- casting.py: the new checks
c = fresh(os.path.join(X, 'cast'))
casting_job(c)
cs = load(os.path.join(c, 'tools', 'casting.json'))
cs['stills'] = {'S01': {'batch': 'rest', 'refs': ['sheet:hero', 'loc:office'], 'prompt': 'Image 1 is her. Image 3 is a sketch. A frame. No text.', 'meta': {}}}
write_json(os.path.join(c, 'tools', 'casting.json'), cs)
rc, out = cast(['plan', 'stills'], c)
check('X54 casting plan refuses a prompt that names Image 3 but sends 2 images', rc == 2 and 'the prompt names Image 3 but sends 2 images' in out, out[-400:])
cs['stills']['S01']['prompt'] = 'A frame. {FOV:2000}. No text.'
write_json(os.path.join(c, 'tools', 'casting.json'), cs)
rc, out = cast(['plan', 'stills'], c)
check('X55 {FOV:2000} is refused (4–1200 mm)', rc == 2 and 'FOV' in out, out[-400:])
cs['stills']['S01']['prompt'] = 'A frame. No text.'
write_json(os.path.join(c, 'tools', 'casting.json'), cs)
rc, out = cast(['plan', 'stills', '--show', 'S99'], c)
check('X56 plan --show of an unknown id is refused, naming the ids there are', rc == 2 and 'no request with that id' in out and 'S01' in out, out[-400:])

done('QA 3 failures')
