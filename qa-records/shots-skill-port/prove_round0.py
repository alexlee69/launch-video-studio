# -*- coding: utf-8 -*-
"""Proves QA 4's checks are real: runs test_review_fixes.py against a copy of the skill's video/ folder with the files
of a review round put back (rollback/*.<round>, default round0 = before Sonnet's fixes). Every check must FAIL there,
apart from the controls, which pass on both.
  /usr/bin/python3 -B prove_round0.py [round0] [--only S1,S2,…]     exit 0 when every non-control check fails there"""
import os, re, shutil, subprocess, sys

QA = os.path.dirname(os.path.abspath(__file__))
LIVE = os.path.expanduser('~/.claude/skills/product-launch-sting/video')
RND = next((a for a in sys.argv[1:] if not a.startswith('--') and ',' not in a), 'round0')
ONLY = next((sys.argv[i + 1].split(',') for i, a in enumerate(sys.argv) if a == '--only'), None)
CONTROLS = {'C0', 'S13b'}
FILES = {'shots/shots.py': 'shots_shots.py', 'shots/recipes.json': 'shots_recipes.json', 'shots/starter.json': 'shots_starter.json',
         'storyboard/placeholders.py': 'storyboard_placeholders.py', 'casting/casting.py': 'casting_casting.py',
         'footage/gen.mjs': 'footage_gen.mjs', 'SHOTS.md': 'SHOTS.md', 'STORYBOARD.md': 'STORYBOARD.md', 'CASTING.md': 'CASTING.md'}
W = os.path.join(QA, 'out', 'prove-' + RND)
shutil.rmtree(W, ignore_errors=True)
shutil.copytree(LIVE, os.path.join(W, 'video'), ignore=shutil.ignore_patterns('node_modules', '__pycache__'))
for live, rb in FILES.items():
    src = os.path.join(QA, 'rollback', '%s.%s' % (rb, RND))
    if os.path.exists(src):
        shutil.copy(src, os.path.join(W, 'video', live))
env = dict(os.environ, SHOTS_QA_VIDEO=os.path.join(W, 'video'))
p = subprocess.run(['/usr/bin/python3', '-B', os.path.join(QA, 'test_review_fixes.py')], cwd=QA, env=env, capture_output=True, text=True)
rows = [(m.group(1), m.group(2), m.group(3)) for m in re.finditer(r'^(PASS|FAIL)  (\S+) (.*)$', p.stdout, re.M)]
rows = [r for r in rows if ONLY is None or r[1] in ONLY or r[1] in CONTROLS]
held = [r for r in rows if r[0] == 'PASS' and r[1] not in CONTROLS]
ctl = [r for r in rows if r[1] in CONTROLS and r[0] != 'PASS']
for r in rows:
    print('%s on %s  %s %s' % (r[0], RND, r[1], r[2][:110]))
print('\n%d checks on the %s code: %d fail as they should; %d pass that should fail%s; %d control%s failing'
      % (len(rows), RND, sum(1 for r in rows if r[0] == 'FAIL' and r[1] not in CONTROLS), len(held),
         (' (' + ', '.join(r[1] for r in held) + ')') if held else '', len(ctl), '' if len(ctl) == 1 else 's'))
if p.returncode not in (0, 1) or 'Traceback' in p.stderr:
    print('the suite itself stopped early on the %s code:\n%s' % (RND, p.stderr[-1500:]))
    sys.exit(2)
sys.exit(0 if not held and not ctl and rows else 1)
