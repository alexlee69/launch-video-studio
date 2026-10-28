# Writes apply_pointers.py: the casting port's doc edits as idempotent (old block → new block) pairs, cut from
# rollback/ (the docs before) vs live, with one line of context, so the paused fix round can re-apply them after its merge.
import difflib, json, os
L = os.path.expanduser('~/.claude/skills/product-launch-sting')
H = os.path.dirname(os.path.abspath(__file__))
DOCS = {'SKILL.md': 'SKILL.md', 'GUIDE.md': 'video/GUIDE.md', 'FOOTAGE.md': 'video/FOOTAGE.md', 'assets-checklist.md': 'video/templates/assets-checklist.md'}
pairs = []
for rb, live in DOCS.items():
    a = open(os.path.join(H, 'rollback', rb), encoding='utf-8').read().splitlines(True)
    b = open(os.path.join(L, live), encoding='utf-8').read().splitlines(True)
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag == 'equal':
            continue
        k = 1
        while True:                                  # widen the context until the old block occurs once
            c0, c1 = max(0, i1 - k), min(len(a), i2 + k)
            old = ''.join(a[c0:c1])
            if ''.join(a).count(old) == 1 or (c0 == 0 and c1 == len(a)):
                break
            k += 1
        new = ''.join(a[c0:i1] + b[j1:j2] + a[i2:c1])
        pairs.append({'file': live, 'old': old, 'new': new})
open(os.path.join(H, 'apply_pointers.py'), 'w', encoding='utf-8').write(
    '# -*- coding: utf-8 -*-\n# The casting port\'s doc edits (2026-10-23), idempotent: each pair applies only where its old block is found once\n'
    '# and its new block is not yet there. python3 apply_pointers.py [SKILL_DIR]\n'
    'import json, os, sys\nL = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/.claude/skills/product-launch-sting")\n'
    'PAIRS = json.loads(%r)\nbad = 0\nfor p in PAIRS:\n    f = os.path.join(L, p["file"]); t = open(f, encoding="utf-8").read()\n'
    '    if p["new"] in t:\n        print("already  %%s" %% p["file"]); continue\n'
    '    if t.count(p["old"]) != 1:\n        print("NO ANCHOR %%s: %%r" %% (p["file"], p["old"][:80])); bad += 1; continue\n'
    '    open(f, "w", encoding="utf-8").write(t.replace(p["old"], p["new"])); print("applied  %%s" %% p["file"])\nsys.exit(1 if bad else 0)\n' % json.dumps(pairs))
print(len(pairs), 'pairs')
