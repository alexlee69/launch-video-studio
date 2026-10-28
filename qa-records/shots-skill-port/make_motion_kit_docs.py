# -*- coding: utf-8 -*-
"""Builds motion_kit_docs.json: the 2026-10 motion kit's doc edits (the docs pass + the Opus-review fixes) as exact
anchor → new pairs, so test_parity.py P8 (and the storyboard port's P3b) can rebuild SKILL.md and video/GUIDE.md from
the rollback copies + the pointer scripts + apply_motion_kit_docs.py, byte for byte.
  /usr/bin/python3 -I make_motion_kit_docs.py BASE_SKILL_DIR TARGET_SKILL_DIR
BASE = the docs before the kit (the live skill's, which P8 rebuilds exactly from the rollback copies); TARGET = the
staged skill whose docs carry the kit. Re-run it whenever the staged SKILL.md or GUIDE.md change. It proves its own
output: the pairs applied to BASE give TARGET exactly, each anchor is found exactly once when it is applied, and a second
pass skips every pair and changes nothing.
"""
import difflib, json, os, sys

FILES = ['SKILL.md', 'video/GUIDE.md']
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'motion_kit_docs.json')


def pairs_for(base, target, ctx=3):
    a, b = base.splitlines(keepends=True), target.splitlines(keepends=True)
    out = []
    for grp in difflib.SequenceMatcher(None, a, b, autojunk=False).get_grouped_opcodes(ctx):
        i1, i2, j1, j2 = grp[0][1], grp[-1][2], grp[0][3], grp[-1][4]
        out.append((''.join(a[i1:i2]), ''.join(b[j1:j2])))
    return out


def apply(text, pairs):
    """the applier's contract: SKIP when the new text is already there, else the anchor must appear exactly once"""
    log = []
    for anchor, new in pairs:
        if new in text:
            log.append('SKIP')
        elif text.count(anchor) == 1:
            text = text.replace(anchor, new); log.append('APPLIED')
        else:
            log.append('NO ANCHOR %d' % text.count(anchor))
    return text, log


def main():
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr); return 2
    B, T = sys.argv[1], sys.argv[2]
    data = []
    for f in FILES:
        base, target = open(os.path.join(B, f), encoding='utf-8').read(), open(os.path.join(T, f), encoding='utf-8').read()
        for ctx in (3, 5, 8, 12):
            P = pairs_for(base, target, ctx)
            got, log = apply(base, P)
            again, log2 = apply(got, P)
            if got == target and set(log) == {'APPLIED'} and set(log2) <= {'SKIP'} and again == got:
                break
        else:
            print('FAIL %s: no context size rebuilds it exactly' % f); return 1
        print('%s: %d pairs (context %d lines), rebuilds exactly, second pass skips all' % (f, len(P), ctx))
        data += [{'file': f, 'anchor': x, 'new': y} for x, y in P]
    json.dump({'v': 1, 'files': FILES, 'pairs': data}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('→ %s (%d pairs)' % (OUT, len(data)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
