# -*- coding: utf-8 -*-
"""The 2026-10 motion kit's doc edits (SKILL.md's description and router, video/GUIDE.md's kit, transitions, starters and
QA sections), on top of apply_pointers.py's edits. Same contract as that script and apply_phase2_brief.py: idempotent
(an edit whose new text is already in the file is skipped), otherwise its anchor must appear exactly once. The pairs live
in motion_kit_docs.json (built and self-checked by make_motion_kit_docs.py).
  /usr/bin/python3 apply_motion_kit_docs.py SKILL_DIR     (required: a copy of the skill, or the live one by its path)
Prints one line per edit: APPLIED, SKIP (already there) or NO ANCHOR (the file was reworded: rebuild the pairs).
"""
import json, os, sys

if len(sys.argv) != 2 or not os.path.isdir(sys.argv[1]):
    print('usage: apply_motion_kit_docs.py SKILL_DIR  (the skill folder to edit; there is no default, so the live skill '
          'is only ever edited by naming it)', file=sys.stderr)
    sys.exit(2)
S = sys.argv[1]
DATA = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'motion_kit_docs.json'), encoding='utf-8'))


def main():
    rc, texts = 0, {}
    for k, e in enumerate(DATA['pairs']):
        rel = e['file']
        if rel not in texts:
            texts[rel] = open(os.path.join(S, rel), encoding='utf-8').read()
        t, tag = texts[rel], '%s #%d' % (rel, k + 1)
        if e['new'] in t:
            print('SKIP       %s' % tag)
        elif t.count(e['anchor']) == 1:
            texts[rel] = t.replace(e['anchor'], e['new'])
            print('APPLIED    %s' % tag)
        else:
            print('NO ANCHOR  %s (found %d times)' % (tag, t.count(e['anchor'])))
            rc = 1
    for rel, t in texts.items():
        p = os.path.join(S, rel)
        if open(p, encoding='utf-8').read() != t:
            open(p, 'w', encoding='utf-8').write(t)
    return rc


if __name__ == '__main__':
    sys.exit(main())
