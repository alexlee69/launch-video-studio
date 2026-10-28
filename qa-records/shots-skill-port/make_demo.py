# -*- coding: utf-8 -*-
"""Builds the demo job Alex tests the shot writer with: ~/Downloads/launch-videos/shots-demo (refuses if it exists,
unless --fresh). Two storyboard plates with their pencil sketches, a filled casting spec, and three shots: an H3 reveal
from his words, a Seedance dialogue shot from a short script, and one with Claude's proposals still waiting for his OK.
Free: no network, no key, nothing generated.   /usr/bin/python3 -B make_demo.py [--fresh]"""
import json, os, re, shutil, subprocess, sys

V = os.path.expanduser('~/.claude/skills/product-launch-sting/video')
J = os.path.expanduser('~/Downloads/launch-videos/shots-demo')
PY = '/usr/bin/python3'
if os.path.exists(J):
    if '--fresh' not in sys.argv:
        sys.exit('%s exists; pass --fresh to rebuild it' % J)
    shutil.rmtree(J)
os.makedirs(os.path.join(J, 'tools'))
w = lambda p, o: open(os.path.join(J, p), 'w', encoding='utf-8').write(json.dumps(o, indent=1, ensure_ascii=False) + '\n')
run = lambda *a: subprocess.run([PY, '-B'] + list(a), cwd=J, check=False, capture_output=True, text=True)
open(os.path.join(J, 'beats.yaml'), 'w').write('title: shots demo\naspects: [16x9]\nshots: []\n')

w('tools/placeholders.json', {
    'root': '..', 'out': 'assets/plates', 'aspect': '16x9', 'crops': [], 'kind': 'AI FOOTAGE',
    'cast': {'founder': {'body': '#e6e8eb', 'accent': '#e8611e'}, 'cofounder': {'body': '#2c4a7a'}},
    'defaults': {'grain': 4},
    'plates': {
        'S01': {'line': 'She walks into the empty office at dawn', 'lens': '35 mm', 'move': 'slow dolly-out', 'look': 'dawn',
                'horizon': {'y': 0.72, 'color': '#3a3d44'}, 'fx': [{'kind': 'glow', 'x': 0.82, 'y': 0.3, 'r': 0.3}],
                'shapes': [{'kind': 'rect', 'box': [0.06, 0.2, 0.32, 0.72], 'color': '#2b2f36'}],
                'figures': [{'who': 'founder', 'x': 0.55, 'feet': 0.93, 'height': 0.6, 'pose': 'walk', 'facing': 'left'}],
                'props': [{'kind': 'laptop', 'x': 0.78, 'y': 0.8, 'w': 0.16}]},
        'S02': {'line': 'The two founders at the window', 'lens': '50 mm', 'move': 'locked off', 'look': 'golden',
                'horizon': {'y': 0.66, 'color': '#6a5a48'},
                'figures': [{'who': 'founder', 'x': 0.4, 'feet': 0.9, 'height': 0.52, 'pose': 'stand', 'facing': 'right'},
                            {'who': 'cofounder', 'x': 0.62, 'feet': 0.9, 'height': 0.55, 'pose': 'stand', 'facing': 'left'}]}}})

subprocess.run([PY, '-B', os.path.join(V, 'casting', 'casting.py'), 'init', J], cwd=J, capture_output=True)
cs = json.load(open(os.path.join(J, 'tools', 'casting.json'), encoding='utf-8'))
cs['text'].update(WHO='an East Asian woman of about 35 with short black hair and dark brown eyes',
                  WARDROBE='a navy work jacket over a grey T-shirt, dark jeans and white trainers')
for g in ('states', 'locations', 'stills'):
    for e in cs[g].values():
        e['prompt'] = re.sub(r'<[a-z][^<>]*>', 'as in the brief', e['prompt'])
cs['states']['cofounder'] = {'refs': [], 'pin': {}, 'prompt': '{SHEET} The person is a man of about 40 with a short grey beard, '
                             'in a white shirt and grey trousers. {PROPORTIONS} {READS}her co-founder. {TAIL}'}
cs['locations']['office'] = {'refs': [], 'prompt': 'An empty open-plan office at dawn, three-quarter view, no people: '
                             'concrete floor, long desks, tall windows. Low warm sun from the right. LENS GATE: the camera at '
                             'eye height, five metres back from the windows; {FOV:35}; ready for a performer to be placed. '
                             '{PLATE_TAIL}'}
cs['stills'] = {}
w('tools/casting.json', cs)

w('tools/shots.json', {
    'root': '..', 'casting': 'casting.json', 'model': 'h3', 'aspect': '16:9',
    'people': {'founder': {'sheet': 'hero', 'is': 'the founder'}, 'cofounder': {'sheet': 'cofounder', 'is': 'her co-founder'}},
    'places': {'office': {'loc': 'office'}}, 'products': {},
    'shots': {
        'S01': {'brief': 'Open on her face, then pull back: she has walked into the empty office at dawn.',
                'confirmed': ['recipe', 'key.frame', 'light', 'motion'], 'recipe': 'reveal-pullback', 'sec': 6,
                'people': ['founder'], 'place': 'office', 'temp': 'cold', 'position': {'plate': 'S01'},
                'key': {'frame': 'Close on the founder\'s face, eyes on the windows; the empty office behind her.',
                        'light': 'Low warm dawn sun from the right, cool shadows.'},
                'motion': {'beats': ['She breathes out and looks across the room.', 'She sets her bag down on the desk.']}},
        'S02': {'script': 'She turns to him: "We made it." He laughs.', 'model': 'seedance', 'sec': 6,
                'confirmed': ['scene', 'lens', 'motion', 'audio'],
                'people': ['founder', 'cofounder'], 'count': 2, 'place': 'office', 'temp': 'warm', 'position': {'plate': 'S02'},
                'scene': 'The two founders stand at the office window at golden hour, the city behind them.',
                'first': 'Medium-wide: both at the window, she on the left, he on the right, looking out.',
                'key': {'frame': 'Medium-wide: the two founders at the window, the city behind them.'},
                'lens': {'mm': 50, 'distance': 'three metres'}, 'audio': ['his laugh', 'the hum of the city'],
                'motion': {'camera': 'Locked off.', 'beats': [
                    {'t': [0, 3], 'do': 'She turns to him.', 'say': {'who': 'founder', 'line': 'We made it.'}},
                    {'t': [3, 6], 'do': 'He laughs and puts an arm round her shoulders.'}]}},
        'S03': {'brief': 'Something that shows the laptop, the launch moment.',
                'proposed': ['recipe', 'key.frame', 'motion'], 'recipe': 'top-shot', 'sec': 5, 'people': ['founder'],
                'place': 'office', 'temp': 'cold',
                'key': {'frame': 'Straight down on the desk: her hands on the laptop keyboard, a coffee cup beside it.'},
                'motion': {'beats': ['Her finger hovers over the Enter key, then presses it.']}}}})

shutil.copy(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'demo-TRY-IT.md'), os.path.join(J, 'TRY-IT.md'))
r1 = run(os.path.join(V, 'storyboard', 'placeholders.py'), 'draw', '--sheet')
r2 = run(os.path.join(V, 'storyboard', 'placeholders.py'), 'sketch', '--sheet')
print('→ %s (plates: %s; sketches: %s)' % (J, r1.returncode, r2.returncode))
