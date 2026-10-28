# -*- coding: utf-8 -*-
"""QA 4 · review fixes. Each finding of the review chain, planted again: every check here passes on the fixed code and
fails on the code before its fix (prove_round0.sh runs this file against rollback/*.round0 to show it). Sonnet's
findings are S1–S22, two of its observations O1–O2; Opus's come after (P…)."""
import copy, json, os, re, shutil, subprocess
from qa_lib import (QA, V, PY, GEN, SHOTS, run, shots, ph, cast, check, fresh, write_json, read, load, done, png, jpg, plate_job,
                    casting_job, shots_spec)

X = fresh(os.path.join(QA, 'out', 'review-fixes'))
B = plate_job(fresh(os.path.join(X, 'base')))
casting_job(B)
ph(['draw'], B)
ph(['sketch'], B)
GOOD = shots_spec(shots={
    'S01': {'brief': 'she walks in', 'sec': 5, 'people': ['hero'], 'place': 'office', 'temp': 'cold', 'position': {'plate': 'S01'},
            'key': {'frame': 'Wide: she walks in.'}, 'motion': {'camera': 'The camera pushes in slowly.', 'beats': ['She walks in.']}},
    'S02': {'brief': 'they talk', 'model': 'seedance', 'sec': 6, 'people': ['hero', 'friend'], 'count': 2, 'place': 'office', 'temp': 'warm',
            'scene': 'Two founders talk.', 'first': 'Both by the window.', 'key': {'frame': 'Both by the window.'}, 'audio': ['his laugh'],
            'motion': {'camera': 'Locked off.', 'beats': [{'t': [0, 3], 'do': 'She turns.', 'say': {'who': 'hero', 'line': 'We made it.'}},
                                                          {'t': [3, 6], 'do': 'He laughs.'}]}}})


def job(name, mutate=None, base=None):
    d = os.path.join(X, name)
    shutil.rmtree(d, ignore_errors=True)
    shutil.copytree(base or B, d)
    s = copy.deepcopy(GOOD)
    if mutate:
        mutate(s)
    write_json(os.path.join(d, 'tools', 'shots.json'), s)
    return d


def compiled(d, sid, kind):
    shots(['build', sid], d)
    p = os.path.join(d, 'shots', '%s.%s.txt' % (sid, kind))
    return read(p) if os.path.exists(p) else ''


S1 = lambda s: s['shots']['S01']
S2 = lambda s: s['shots']['S02']
rc, out = shots(['check'], job('base0'))
check('C0 control: the base spec is clean (exit 0)', rc == 0, out)

# ---- S1 a speaker is never guessed
d = job('s1a', lambda s: S2(s)['motion']['beats'][0]['say'].pop('who'))
rc, out = shots(['check'], d)
check('S1a a line with no who in a two-person shot is refused, not given to "She"', rc == 2 and 'say.who is missing and the shot has 2 people' in out, out)
for nm, who in (('s1b', 'heroo'), ('s1c', 'Narrator')):
    rc, out = shots(['check'], job(nm, lambda s, w=who: S2(s)['motion']['beats'][0]['say'].update(who=w)))
    check('S1%s say.who "%s" (no one in the shot) is refused' % (nm[-1], who), rc == 2 and 'say.who "%s": whose line?' % who in out, out)
rc, out = shots(['check'], job('s1d', lambda s: (S2(s).update(people=['hero'], count=1), S2(s)['motion']['beats'][0]['say'].update(who='friend'))))
check('S1d a person in the spec but not in this shot is refused', rc == 2 and 'say.who "friend": whose line?' in out, out)
d = job('s1e', lambda s: (S2(s).update(people=['hero'], count=1), S2(s)['motion']['beats'][0]['say'].pop('who')))
p = compiled(d, 'S02', 'seedance')
check('S1e with one person and no who, the line is that person\'s, lip-synced (never "She")',
      'The founder says, lip-synced and word for word: "We made it."' in p and 'She says' not in p, p[-600:])
d = job('s1f', lambda s: S2(s)['motion']['beats'][0]['say'].update(who='voiceover'))
p = compiled(d, 'S02', 'seedance')
check('S1f "voiceover" is a voice from no one in the frame, with no lip-sync', 'A voice-over, from no one in the frame, says, word for word: "We made it."' in p
      and 'lip-synced and word for word: "We made it."' not in p, p[-600:])
png(os.path.join(X, 'glasses.png'))


def prod(s):
    s['products'] = {'glasses': {'ref': '../glasses.png'}}
    S2(s)['products'] = ['glasses']
    S2(s)['motion']['beats'][0]['say'].update(who='glasses')
d = job('s1g', prod)
p = compiled(d, 'S02', 'seedance')
check('S1g a product in the shot speaks as "From the glasses, a voice says" (its default name)', 'From the glasses, a voice says, word for word: "We made it."' in p, p[-600:])

# ---- S2 whole seconds on Seedance too
rc, out = shots(['check'], job('s2', lambda s: (S2(s).update(sec=6.5), S2(s)['motion']['beats'][1].update(t=[3, 6.5]))))
check('S2 a 6.5 s Seedance shot is refused (gen.mjs sends whole seconds; never rounded down onto the last beat)',
      rc == 2 and 'shots.S02.sec: whole seconds' in out, out)

# ---- S3 casting defaults to casting.json
rc, out = shots(['check'], job('s3', lambda s: (s.pop('casting'), s['people']['hero'].update(sheet='nobody'))))
check('S3 a spec without "casting" checks sheets against casting.json beside it', rc == 2 and 'has no sheet in casting.json' in out, out)

# ---- S4 proposals block build and emit
d = job('s4', lambda s: S1(s).update(proposed=['recipe', 'lens']))
rc, out = shots(['build'], d)
rc2, out2 = shots(['emit-casting'], d)
check('S4 build and emit-casting refuse a shot still only proposed, and write nothing', rc == 2 and rc2 == 2 and 'still only proposed' in out
      and not os.path.exists(os.path.join(d, 'shots')) and not load(os.path.join(d, 'tools', 'casting.json'))['stills'], out + out2)

# ---- S5 key ids
rc, out = shots(['check'], job('s5a', lambda s: (S1(s)['key'].update(id='X'), S2(s)['key'].update(id='X'))))
check('S5a two shots with one key id are refused', rc == 2 and 'key id "X" is used by S01, S02' in out, out)
rc, out = shots(['check'], job('s5b', lambda s: (S1(s)['key'].update(id='../evil'), S2(s)['key'].update(dir='../../etc'))))
check('S5b an unsafe key.id or key.dir is refused before it reaches casting.json', rc == 2 and 'key.id "../evil"' in out and 'key.dir "../../etc"' in out, out)

# ---- S6 the pre-pick lock quote of an old spec
c = fresh(os.path.join(X, 's6'))
casting_job(c)
cs = load(os.path.join(c, 'tools', 'casting.json'))
cs['lock']['hero']['prompt'] = 'Image 1 is the picked candidate sheet. {LOCK} {KEEP}'
write_json(os.path.join(c, 'tools', 'casting.json'), cs)
rc, out = cast(['plan', 'lock'], c)
check('S6 casting plan quotes the lock before the pick of a prompt naming Image 1 (it sends one image)', rc == 0 and '✗' not in out, out[-400:])

# ---- S7 braces left over
cs = load(os.path.join(c, 'tools', 'casting.json'))
cs['locations']['office']['prompt'] = 'An empty office. LENS GATE: one metre high; {FOV:35mm}. {PLATE_TAIL}'
write_json(os.path.join(c, 'tools', 'casting.json'), cs)
rc, out = cast(['plan', 'locations'], c)
check('S7a casting refuses a malformed {FOV:35mm} instead of sending the braces', rc == 2 and 'a brace left in the prompt' in out and '{FOV:35mm}' in out, out[-400:])
d = job('s7b', lambda s: S1(s)['key'].update(frame='Wide, {FOV:35}.'))
p = compiled(d, 'S01', 'key')
check('S7b build writes a key frame\'s {FOV:35} expanded, as casting will send it', '35 mm full-frame look, about 54 degrees horizontal field of view' in p
      and '{FOV' not in p, p[-300:])
rc, out = shots(['check'], job('s7c', lambda s: S1(s)['key'].update(frame='Wide, {fov:35}.')))
check('S7c shots check refuses {fov:35} (an unexpanded brace)', rc == 2 and 'has a brace left in it' in out and '{fov:35}' in out, out)

# ---- S8 words per second in any language
rc, out = shots(['check'], job('s8a', lambda s: S2(s)['motion']['beats'][0]['say'].update(line="C'était déjà très éblouissant, mais génial.")))
check('S8a a six-word French line fits a 3 s beat', rc == 0, out)
rc, out = shots(['check'], job('s8b', lambda s: S2(s)['motion']['beats'][0]['say'].update(line='我们终于做到了这个产品今天正式发布感谢所有一路支持我们的朋友和家人')))
check('S8b a long Chinese line is refused for a 3 s beat (4 characters a second)', rc == 2 and 'needs about' in out, out)

# ---- S9 the soundtrack
p = compiled(job('s9a', lambda s: S2(s).pop('audio')), 'S02', 'seedance')
rc, out = shots(['check'], job('s9a2', lambda s: S2(s).pop('audio')))
check('S9a no audio list: "No music." is still locked, and it warns', 'LOCKS:' in p and 'No music.' in p.split('LOCKS:')[1] and rc == 1
      and 'shots.S02.audio' in out, (p[-300:], out))
p = compiled(job('s9b'), 'S02', 'seedance')
check('S9b an audio list names the spoken lines first when anyone speaks', 'nothing else: the spoken lines above; his laugh. No music.' in p, p[-500:])

# ---- S10 no "straight lines" for a fisheye
p = compiled(job('s10', lambda s: S2(s).update(recipe='pov-action-cam')), 'S02', 'seedance')
check('S10 a distorting lens is not told "straight lines stay straight"', 'OPTICS:' in p and 'straight lines stay straight' not in p, p[:900])

# ---- S11 dialogue on H3 stays out; the doc's route is real
p = compiled(job('s11', lambda s: S1(s)['motion'].update(beats=[{'do': 'She turns', 'say': 'We made it.'}])), 'S01', 'h3')
check('S11a an H3 prompt carries no spoken line', p and 'We made it' not in p and 'She turns.' in p, p)
sd = read(os.path.join(V, 'SHOTS.md'))
check('S11b SHOTS.md gives a real route for the generated lines (voiceover:), not "use the clip\'s own audio"',
      "Use the clip's own audio" not in sd and 'voiceover: {file: assets/S02-lines.wav' in sd)

# ---- S12 Alex's words are his
rc, out = shots(['check'], job('s12a', lambda s: S1(s).update(script='She walks in. <beat> Then she laughs <laughs>.')))
check('S12a a script with <beat> is not mistaken for an unfilled hint', rc == 0, out)
rc, out = shots(['check'], job('s12b', lambda s: S1(s).update(brief='A quiet office at dawn, in the style of Wes Anderson.')))
check('S12b "in the style of" in the brief alone (never compiled) doesn\'t warn', rc == 0 and 'style of' not in out, out)

# ---- S13 a sketch goes stale only when what it draws changes
d = job('s13')
P = os.path.join(d, 'tools', 'placeholders.json')


def stale(fn):
    pj = load(P)
    fn(pj)
    write_json(P, pj)
    return 'was drawn before plate S01' in shots(['check'], d)[1]
a1 = stale(lambda pj: pj['plates']['S01']['props'][0].update(color='#ff0000'))
a2 = stale(lambda pj: pj['plates']['S01']['fx'][0].update(strength=0.2, color='#00ff00'))
a3 = stale(lambda pj: pj['plates']['S01']['horizon'].update(color2='#123456', line=True))
a4 = stale(lambda pj: pj['plates']['S01']['shapes'][0].update(alpha=1))
check('S13a a prop colour, a glow\'s colour or strength, the horizon\'s second colour and line, or a default spelled out leave a sketch current',
      not (a1 or a2 or a3 or a4), (a1, a2, a3, a4))
check('S13b control: a shape\'s colour (its hatching tone) makes it stale', stale(lambda pj: pj['plates']['S01']['shapes'][0].update(color='#eeeeee')))

# ---- S14 a product with no photo; a key with no frame
def noref(s):
    s['products'] = {'glasses': {'anatomy': 'Wraparound black frames with two small lenses at the temples.', 'colourway': 'gold lenses'}}
    S1(s)['products'] = ['glasses']
d = job('s14a', noref)
p = compiled(d, 'S01', 'key')
rc, out = shots(['check'], d)
check('S14a a product with no ref stays in the key prompt in words, and it warns', 'The product, from these words alone: Wraparound black frames' in p
      and 'Its colours: gold lenses.' in p and 'product glasses has no ref' in out, (p[-400:], out))
rc, out = shots(['check'], job('s14b', lambda s: S1(s).update(key={})))
check('S14b a key that says nothing about its frame is refused', rc == 2 and 'shots.S01.key: what the first frame shows' in out, out)

# ---- S15 the head count
rc, out = shots(['check'], job('s15', lambda s: S2(s).update(count=1)))
check('S15 count 1 with two people listed is refused', rc == 2 and 'shots.S02.count: 1, but the shot lists 2 people' in out, out)

# ---- S16 distances
p = compiled(job('s16', lambda s: S1(s).update(recipe='side-track-slowmo')), 'S01', 'key')
check('S16 "about 40 m to the side" reads once, never "from about about"', 'about about' not in p and 'about 40 m to the side' in p, p[-300:])

# ---- S17 sentences and the hold
p = compiled(job('s17', lambda s: S2(s)['motion']['beats'][0].update(do='She turns to him')), 'S02', 'seedance')
check('S17a a beat without a full stop gets one before the line', '0:00-0:03. She turns to him. The founder says' in p, p[-700:])
check('S17b a locked-off camera gets no "the move eases in" hold', 'CAMERA: Locked off.' in p and 'eases in' not in p.split('CAMERA:')[1].split('\n')[0], p[:900])

# ---- S18 plan.json keeps every shot
d = job('s18')
shots(['build'], d)
shots(['build', 'S02'], d)
check('S18 build S02 after a full build keeps S01\'s plan row', [r['shot'] for r in load(os.path.join(d, 'shots', 'plan.json'))['shots']] == ['S01', 'S02'])

# ---- S19 robustness
for nm, fn, must in (('s19a', lambda s: S1(s)['motion'].update(camera=5), 'shots.S01.motion.camera: text (got 5)'),
                     ('s19b', lambda s: s.update(text='x'), 'spec.text: an object'),
                     ('s19c', lambda s: S1(s).update(sec=10 ** 400), 'shots.S01.sec: a number from 5 to 10'),
                     ('s19d', lambda s: s['products'].update(g={'ref': 'x.png', 'colourway': 5}), 'products.g.colourway: text (got 5)')):
    rc, out = shots(['check'], job(nm, fn))
    check('S19 %s a wrong type is refused by name, never a crash' % nm, rc == 2 and must in out and 'Traceback' not in out, out[-300:])
d = job('s19e')
t = read(os.path.join(d, 'tools', 'shots.json')).replace('"S02": {', '"S01": {', 1)
open(os.path.join(d, 'tools', 'shots.json'), 'w', encoding='utf-8').write(t)
rc, out = shots(['check'], d)
check('S19e a duplicate key in shots.json is refused (never a silent last-one-wins)', rc == 2 and 'duplicate key "S01"' in out, out)
d = job('s19f', lambda s: (s['shots'].update(S1=copy.deepcopy(S1(s)), S10=dict(copy.deepcopy(S1(s)), extras='a crowd')),
                           s['shots']['S1']['key'].update(id='K1'), s['shots']['S10']['key'].update(id='K10')))
rc, out = shots(['show', 'S1'], d)
check('S19f show S1 lists only S1\'s messages, never S10\'s', 'S10' not in out and rc == 0, out[-300:])

# ---- S20 fields that did nothing; the legend's red cross; aspect; re-emit
rc, out = shots(['check'], job('s20a', lambda s: S2(s).update(links={'from': 'S09', 'via': 'the flyer'})))
check('S20a links.from that isn\'t a shot is refused', rc == 2 and 'links.from: "S09" is no shot' in out, out)
rc, out = shots(['check'], job('s20b', lambda s: S2(s).update(links={'from': 'S01', 'via': 'the flyer'})))
check('S20b a linked element neither prompt names warns', rc == 1 and '"the flyer" crosses from S01' in out, out)
rc, out = shots(['check'], job('s20c', lambda s: s.update(fps=24)))
check('S20c "fps", which nothing read, is refused as an unknown key', rc == 2 and 'unknown key fps' in out, out)
lg = load(os.path.join(B, 'assets', 'plates', 'S01-sketch.json'))['legend']['yellow']
check('S20d the legend calls the cross red, as it is drawn', 'the red cross on a head shows which way the face looks' in lg, lg)
rc, out = shots(['check'], job('s20e', lambda s: S1(s).update(aspect='9:16')))
check('S20e a key frame asked for 9:16 while casting makes 2560x1440 warns', rc == 1 and 'asked for 9:16, but casting.json makes 2560x1440' in out, out)
d = job('s20f')
shots(['emit-casting'], d)
cj = os.path.join(d, 'tools', 'casting.json')
cs = load(cj)
cs['stills']['S01']['prompt'] += ' A hand edit.'
write_json(cj, cs)
rc, out = shots(['emit-casting'], d)
check('S20f a still hand-edited in casting.json is not replaced (refused, nothing written)', rc == 2 and 'edited there since' in out
      and load(cj)['stills']['S01']['prompt'].endswith('A hand edit.'), out)
rc, out = shots(['emit-casting', '--force'], d)
check('S20g --force replaces it', rc == 0 and not load(cj)['stills']['S01']['prompt'].endswith('A hand edit.'), out)
png(os.path.join(d, 'stills', 'keys', 'S01-v1.png'))
s = load(os.path.join(d, 'tools', 'shots.json'))
s['shots']['S01']['key']['frame'] = 'Wide: she walks in, slower.'
write_json(os.path.join(d, 'tools', 'shots.json'), s)
rc, out = shots(['emit-casting'], d)
check('S20h a changed still that was already made says how to make the new one (--redo)', 'already made: S01' in out and '--redo' in out, out)

# ---- S21 gen.mjs
g = fresh(os.path.join(X, 'gen'))
home = fresh(os.path.join(X, 'home'))
env = dict(os.environ, HOME=home)
env.pop('FAL_KEY', None)
rc, out = run(['node', GEN, 'still', '--prompt', 'x', '--out', 'st', '--audio', 'off'], cwd=g, env=env)
check('S21a --audio (or --end) on a still is refused, as before the port', rc == 2 and '--end and --audio are for video' in out, out[-200:])
check('S21b gen.mjs no longer claims fal refuses a wrong field before charging', 'refused by fal before any charge' not in read(GEN))

# ---- S22 casting.json's own snippet names win in key frames
d = job('s22')
cj = os.path.join(d, 'tools', 'casting.json')
cs = load(cj)
cs['text']['BODY'] = 'She wears a white suit with a round mission patch.'
write_json(cj, cs)
s = load(os.path.join(d, 'tools', 'shots.json'))
s['shots']['S01']['key']['frame'] = 'Wide: she walks in. {BODY}'
write_json(os.path.join(d, 'tools', 'shots.json'), s)
shots(['emit-casting', 'S01'], d)
rc, out = cast(['plan', 'stills', '--show', 'S01'], d)
check('S22 a casting.json BODY wins in the key frame casting sends', 'She wears a white suit with a round mission patch.' in out
      and 'limb lengths' not in out, out[-500:])

# ---- the reviewer's observations
d = job('o1')
cj = os.path.join(d, 'tools', 'casting.json')
cs = load(cj)
cs['ban'] = ['laughs']
write_json(cj, cs)
rc, out = shots(['check'], d)
check('O1 casting.json\'s ban list is checked in the video prompts too', rc == 2 and 'names laughs (in the ban list)' in out, out)
d = fresh(os.path.join(X, 'o2'))
shots(['init', '--model', 'seedance'], d)
s = load(os.path.join(d, 'tools', 'shots.json'))['shots']['S01']
check('O2 init --model seedance writes a Seedance-shaped starter: timed beats, a scene, the sounds',
      all('t' in b for b in s['motion']['beats']) and 'scene' in s and 'audio' in s, s)

# ==================================================================== Opus (final review): P1–P16
# ---- P1 ids that differ only by case are one file on macOS
rc, out = shots(['check'], job('p1a', lambda s: s['shots'].update(s01=dict(copy.deepcopy(S1(s)), key={'frame': 'Wide.', 'id': 'other'}))))
check('P1a shots S01 and s01 are refused (one file on macOS)', rc == 2 and 'shots.s01: differs from S01 only by case' in out, out)
rc, out = shots(['check'], job('p1b', lambda s: (S1(s)['key'].update(id='K1'), S2(s)['key'].update(id='k1'))))
check('P1b key ids K1 and k1 are refused', rc == 2 and 'differ only by case' in out, out)
rc, out = shots(['check'], job('p1c', lambda s: S1(s)['key'].update(id='K1\n')))
check('P1c a key id with a trailing newline is refused', rc == 2 and 'key.id' in out, out)
c1 = fresh(os.path.join(X, 'p1d'))
casting_job(c1)
cs = load(os.path.join(c1, 'tools', 'casting.json'))
cs['stills'] = {'S01': {'batch': 'rest', 'refs': [], 'prompt': 'A frame. No text.', 'meta': {}},
                's01': {'batch': 'rest', 'refs': [], 'prompt': 'Another frame. No text.', 'meta': {}}}
write_json(os.path.join(c1, 'tools', 'casting.json'), cs)
rc, out = cast(['plan', 'stills'], c1)
check('P1d casting.py refuses stills S01 and s01 (one file on macOS)', rc == 2 and 'differ only by case' in out, out[-300:])
d = job('p1e')
cj = os.path.join(d, 'tools', 'casting.json')
cs = load(cj)
cs['stills']['s01'] = {'batch': 'rest', 'refs': [], 'prompt': 'theirs. No text.', 'meta': {}}
write_json(cj, cs)
rc, out = shots(['emit-casting'], d)
check('P1e emit refuses to write S01 beside a still s01 already in casting.json', rc == 2 and 'differ only by case' in out and 'S01' not in load(cj)['stills'], out)

# ---- P2 the key frame shown is the one casting sends
def prec(s):
    s['text'] = {'SUIT': 'a plain white suit'}
    S1(s)['key']['frame'] = 'Wide: {EVA} walks in.'
d = job('p2a', prec)
cj = os.path.join(d, 'tools', 'casting.json')
cs = load(cj)
cs['text'].update(SUIT='a white suit with a round mission patch', EVA='the astronaut in {SUIT}')
write_json(cj, cs)
p = compiled(d, 'S01', 'key')
rc, out = shots(['check'], d)
check('P2a a casting.json snippet nesting {SUIT} is shown with casting.json\'s SUIT, as it is sent',
      'the astronaut in a white suit with a round mission patch' in p and 'a plain white suit' not in p, p[-300:])
check('P2b the warning says which one a key frame gets where', 'a casting.json snippet that names it gets casting.json\'s' in out, out)
d = job('p2c', lambda s: S1(s)['key'].update(frame='Wide: {LOOK}.'))
cj = os.path.join(d, 'tools', 'casting.json')
cs = load(cj)
cs['text']['LOOK'] = 'shot as {MEDIUM}'
write_json(cj, cs)
rc, out = shots(['check'], d)
check('P2c a casting.json snippet naming a shots.py built-in is refused by check, as casting.py would', rc == 2 and 'unknown snippet {MEDIUM}' in out, out)

# ---- P3 / P4 / P5 emit-casting's hand-edit protection and its advice
d = job('p3')
shots(['emit-casting'], d)
cj = os.path.join(d, 'tools', 'casting.json')
cs = load(cj)
cs['stills']['S01']['n'] = 4
write_json(cj, cs)
rc, out = shots(['emit-casting'], d)
check('P3a an n set in casting.json survives a re-emit', rc == 0 and load(cj)['stills']['S01'].get('n') == 4, out)
cs = load(cj)
cs['stills']['S01']['dir'] = 'hero-keys'
write_json(cj, cs)
rc, out = shots(['emit-casting'], d)
check('P3b a dir edited in casting.json is protected like the prompt (refused, kept)', rc == 2 and 'edited there since' in out
      and load(cj)['stills']['S01']['dir'] == 'hero-keys', out)
d = job('p4')
shots(['emit-casting'], d)
cj = os.path.join(d, 'tools', 'casting.json')
cs = load(cj)
cs['stills']['S01']['prompt'] += ' A hand edit.'
write_json(cj, cs)
s = load(os.path.join(d, 'tools', 'shots.json'))
s['shots']['S01']['key']['prompt'] = cs['stills']['S01']['prompt']
write_json(os.path.join(d, 'tools', 'shots.json'), s)
rc, out = shots(['emit-casting'], d)
check('P4 once the edit is moved into key.prompt, emit goes through (nothing would be lost)', rc == 0
      and load(cj)['stills']['S01']['prompt'].endswith('A hand edit.'), out)
d = job('p5')
shots(['emit-casting'], d)
png(os.path.join(d, 'stills', 'keys', 'S01-v1.png'))
png(os.path.join(d, 'stills', 'keys', 'S02-v1.png'))
s = load(os.path.join(d, 'tools', 'shots.json'))
s['shots']['S01']['key']['frame'] = 'Wide: she walks in, slower.'
write_json(os.path.join(d, 'tools', 'shots.json'), s)
rc, out = shots(['emit-casting'], d)
check('P5 the re-make advice names only the changed still (--only S01), not its whole batch', 'stills --only S01 --go --redo' in out
      and '--batch B' not in out, out)

# ---- P6 confirm refuses a duplicate key instead of erasing one
d = job('p6')
sp = os.path.join(d, 'tools', 'shots.json')
txt = read(sp).replace('"S02": {', '"S02": {"brief": "ALEX ORIGINAL", "sec": 6, "motion": {"beats": ["x"]}}, "S02": {', 1)
open(sp, 'w', encoding='utf-8').write(txt)
rc, out = shots(['confirm', 'S01'], d)
check('P6 confirm refuses a spec with a duplicate key and leaves the file as it was', rc == 2 and 'duplicate key "S02"' in out and read(sp) == txt, out)

# ---- P7 words with combining marks; scripts without spaces
import unicodedata
nfd = unicodedata.normalize('NFD', "C'était déjà très éblouissant, mais génial.")
rc, out = shots(['check'], job('p7a', lambda s: S2(s)['motion']['beats'][0]['say'].update(line=nfd)))
check('P7a the six-word French line typed in NFD (as macOS pastes it) fits a 3 s beat', rc == 0, out)
rc, out = shots(['check'], job('p7b', lambda s: S2(s)['motion']['beats'][0]['say'].update(line='मैंने आज बाज़ार से फल खरीदे')))
check('P7b a six-word Hindi line fits a 3 s beat (vowel signs stay in their word)', rc == 0, out)
rc, out = shots(['check'], job('p7c', lambda s: S2(s)['motion']['beats'][0]['say'].update(line='วันนี้เราทำสำเร็จแล้วขอบคุณทุกคนมาก')))
check('P7c a Thai line (no spaces) is not timed: it warns instead of passing silently', rc == 1 and 'without spaces between words' in out, out)

# ---- P8 no beat past the end of the shot
rc, out = shots(['check'], job('p8', lambda s: (S2(s)['motion']['beats'][0].update(t=[0, 3]), S2(s)['motion']['beats'][1].update(
    t=[3, 9], say={'who': 'friend', 'line': 'We really did it, after all those long nights.'}))))
check('P8 a Seedance beat ending at 9 s in a 6 s shot is refused', rc == 2 and 'a beat ends at 9 s, after the shot\'s 6 s' in out, out)

# ---- P9 Seedance drafts at 480p; res validated
d = job('p9a')
shots(['build', 'S02'], d)
row = {r['shot']: r for r in load(os.path.join(d, 'shots', 'plan.json'))['shots']}['S02']
check('P9a the Seedance plan line drafts at 480p, with the final at 720p beside it', row['gen'].endswith('--res 480p')
      and row.get('final', '').endswith('S02-720p.mp4 --sec 6 --res 720p'), row)
rc, out = shots(['check'], job('p9b', lambda s: s.update(res='480P')))
check('P9b res "480P" (an H3 size) is refused for Seedance', rc == 2 and 'res: Seedance\'s draft resolution' in out, out)

# ---- P10 crash paths
for nm, fn, must in (('p10a', lambda s: S1(s).update(aspect='16:0'), 'shots.S01.aspect: W:H'),
                     ('p10b', lambda s: S2(s)['motion']['beats'][1].update(t=[3, float('inf')]), 'shots.S02.motion.beats[1].t'),
                     ('p10c', lambda s: S2(s)['motion']['beats'][1].update(t=[3, 10 ** 400]), 'shots.S02.motion.beats[1].t'),
                     ('p10d', lambda s: S2(s).update(count=10 ** 400), 'shots.S02.count')):
    rc, out = shots(['check'], job(nm, fn))
    check('P10 %s refused by name, never a crash' % nm, rc == 2 and must in out and 'Traceback' not in out, out[-300:])
for nm, fn, cmd, ok_rc in (('p10e', lambda cs: cs.update(lock=[{'prompt': 'x'}]), 'check', (2,)),
                           ('p10f', lambda cs: cs.update(dirs=['x']), 'emit-casting', (2,)),
                           ('p10g', lambda cs: cs.update(sizes=5), 'check', (0, 1)),
                           ('p10h', lambda cs: cs['stills'].update(S01={'batch': 'rest', 'refs': [], 'prompt': 'x', 'meta': 'note'}), 'emit-casting', (2,))):
    d = job(nm)
    cj = os.path.join(d, 'tools', 'casting.json')
    cs = load(cj)
    fn(cs)
    write_json(cj, cs)
    rc, out = shots([cmd], d)
    check('P10 %s a malformed casting.json field: %s exits %s, never a crash' % (nm, cmd, '/'.join(map(str, ok_rc))), rc in ok_rc and 'Traceback' not in out, out[-300:])

# ---- P11 any brace left is refused, in both tools
rc, out = shots(['check'], job('p11a', lambda s: S1(s)['key'].update(frame='Wide, {FOV:35. She walks in.')))
check('P11a an unbalanced {FOV:35. is refused by shots check', rc == 2 and 'has a brace left in it' in out, out)
c2 = fresh(os.path.join(X, 'p11b'))
casting_job(c2)
cs = load(os.path.join(c2, 'tools', 'casting.json'))
cs['stills'] = {'S01': {'batch': 'rest', 'refs': [], 'prompt': 'A frame. {KEY_TAIL No text.', 'meta': {}}}
write_json(os.path.join(c2, 'tools', 'casting.json'), cs)
rc, out = cast(['plan', 'stills'], c2)
check('P11b casting.py refuses an unbalanced {KEY_TAIL', rc == 2 and 'a brace left in the prompt' in out, out[-300:])

# ---- P12 plan.json drops a row whose shot changed since it was built
d = job('p12')
shots(['build'], d)
s = load(os.path.join(d, 'tools', 'shots.json'))
s['shots']['S01']['motion']['beats'] = ['She sits down.']
write_json(os.path.join(d, 'tools', 'shots.json'), s)
rc, out = shots(['build', 'S02'], d)
check('P12 build S02 drops S01\'s row once S01 changed, and says so', [r['shot'] for r in load(os.path.join(d, 'shots', 'plan.json'))['shots']] == ['S02']
      and 'dropped from plan.json, changed since they were built: S01' in out, out)

# ---- P13 H3 and spoken lines
rc, out = shots(['check'], job('p13a', lambda s: S1(s).update(people=['hero', 'friend'], motion={'camera': 'Locked off.',
                                                                                                  'beats': [{'do': 'She turns.', 'say': 'Hello.'}]})))
check('P13a on H3 a line\'s speaker isn\'t demanded (the line never reaches the prompt)', rc in (0, 1) and 'say.who' not in out, out)
rc, out = shots(['check'], job('p13b', lambda s: S1(s)['motion'].update(beats=['She walks in.', {'say': 'Hello.'}])))
check('P13b an H3 beat that is only a line is refused (it would add nothing to the prompt)', rc == 2 and 'an H3 beat needs its action' in out, out)

# ---- P14 show never exits 0 while the spec has an error
rc, out = shots(['show', 'S01'], job('p14', lambda s: (s.pop('model'), S2(s).pop('model'))))
check('P14 show S01 exits 2 and prints "no model for S01"', rc == 2 and 'no model for S01' in out, out[-300:])

# ---- P15 hand key.refs are job-relative, like every path in the spec
def handrefs(s):
    S1(s)['key'] = {'prompt': 'Image 1 is the position reference only. Wide: she walks in. No text.',
                    'refs': ['assets/plates/S01-sketch.png']}
    S1(s).pop('position')
d = job('p15', handrefs)
shots(['emit-casting', 'S01'], d)
st = load(os.path.join(d, 'tools', 'casting.json'))['stills']['S01']
check('P15 hand key.refs are rewritten for casting.json (../assets/…), as the computed ones are', st['refs'] == ['../assets/plates/S01-sketch.png'], st)

# ---- P16 the legend says only what the sketch drew
pj = plate_job(fresh(os.path.join(X, 'p16')))
pl = load(os.path.join(pj, 'tools', 'placeholders.json'))
pl['plates'] = {'A': {'line': 'Two backs', 'figures': [{'x': .4, 'feet': .9, 'height': .5, 'pose': 'stand', 'facing': 'away'},
                                                       {'x': .6, 'feet': .9, 'height': .5, 'pose': 'stand', 'facing': 'away'}]},
                'B': {'line': 'A phone', 'props': [{'kind': 'phone', 'x': .5, 'y': .5, 'w': .05}],
                      'fx': [{'kind': 'glow', 'x': 1.3, 'y': .2, 'r': .2}]}}
write_json(os.path.join(pj, 'tools', 'placeholders.json'), pl)
ph(['sketch'], pj)
la = load(os.path.join(pj, 'assets', 'plates', 'A-sketch.json'))['legend']
lb = load(os.path.join(pj, 'assets', 'plates', 'B-sketch.json'))['legend']
check('P16a two heads facing away: no red cross is promised', 'red cross' not in la.get('yellow', '') and 'faces away' in la.get('yellow', ''), la)
check('P16b a glow off the frame draws no place, so the legend has no grey', 'grey' not in lb, lb)

done('QA 4 review fixes')
