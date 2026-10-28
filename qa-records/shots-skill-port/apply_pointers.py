# -*- coding: utf-8 -*-
"""The shot-writer port's doc edits (2026-10-26). They sit on top of the storyboard port's pointers (kept as they are).
Idempotent: an edit whose marker is already in the file is skipped; otherwise its anchor must appear exactly once.
  /usr/bin/python3 apply_pointers.py [SKILL_DIR]     (default ~/.claude/skills/product-launch-sting)
Prints one line per edit: APPLIED, SKIP (already there) or NO ANCHOR (the file was reworded: re-apply that pair by hand).
"""
import os, sys

S = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/.claude/skills/product-launch-sting')

EDITS = [
    # ---- GUIDE.md
    ('video/GUIDE.md', '**writes every footage shot\'s prompts**',
     "with a phone edition of the board (`STORYBOARD.md`), and **recreates a reference film frame for frame**",
     "with a phone edition of the board (`STORYBOARD.md`), **writes every footage shot's prompts** from any brief, for the\n"
     "model Alex picks (H3 or Seedance 2.5), checked before any spend (`SHOTS.md`), and **recreates a reference film frame for frame**"),
    ('video/GUIDE.md', 'story and edit rules (product features',
     "then the chosen one as `beats.yaml` | lock the words |",
     "then the chosen one as `beats.yaml`; story and edit rules (product features → beats, the hook, an arc, warm/cold contrast): `SHOTS.md` | lock the words |"),
    ('video/GUIDE.md', 'its prompts written and checked by `SHOTS.md`',
     "footage generated here: `FOOTAGE.md` (prompts and cost approved first);",
     "footage generated here: `FOOTAGE.md`, its prompts written and checked by `SHOTS.md` for the model Alex picks each time (prompts and cost approved first);"),
    ('video/GUIDE.md', '**Ask which video model every time.**',
     "  approved (`STORYBOARD.md`); casting and generation come after, each quoted first.\n",
     "  approved (`STORYBOARD.md`); casting and generation come after, each quoted first.\n"
     "- **Ask which video model every time.** Before writing any footage prompt and again before generating: H3 (sharp,\n"
     "  silent) or Seedance 2.5 (people talk, lip-synced). Nothing assumes one (`SHOTS.md`).\n"),
    ('video/GUIDE.md', 'shots/shots.py init|check|show',
     "# the storyboard as a phone-sized PDF; A: the film's first aspect (STORYBOARD.md)\n",
     "# the storyboard as a phone-sized PDF; A: the film's first aspect (STORYBOARD.md)\n"
     "python3 $V/shots/shots.py init|check|show|confirm|build|emit-casting …   # every footage shot's prompts, for H3 or Seedance, checked (SHOTS.md)\n"),
    ('video/GUIDE.md', 'init|check|draw|sketch|status',
     "python3 $V/storyboard/placeholders.py init|check|draw|status …   # labelled placeholder plates for footage shots, free (STORYBOARD.md)\n",
     "python3 $V/storyboard/placeholders.py init|check|draw|sketch|status …   # labelled placeholder plates for footage shots, and pencil sketches of them for key frames, free (STORYBOARD.md)\n"),
    ('video/GUIDE.md', 'placed by its plate\'s pencil sketch',
     "and the key frames made from those sheets: `CASTING.md` |",
     "and the key frames made from those sheets, each placed by its plate's pencil sketch: `CASTING.md`, `STORYBOARD.md` |"),
    # ---- FOOTAGE.md
    ('video/FOOTAGE.md', '**Prompts come from the shot writer**',
     "  exactly which shots to generate.\n",
     "  exactly which shots to generate.\n"
     "- **Prompts come from the shot writer** (`SHOTS.md`): ask Alex which model first, H3 or Seedance 2.5 (people talking,\n"
     "  lip-synced; `gen.mjs video --endpoint bytedance/seedance-2.5/image-to-video`). Both run through `gen.mjs`, quoted first.\n"),
    # ---- SKILL.md
    ('SKILL.md', '**Shot prompts written and checked**',
     "  shots, and a phone edition of the board for review. **A reference\n",
     "  shots, and a phone edition of the board for review. **Shot prompts written and checked** (`video/SHOTS.md`): any\n"
     "  brief into key-frame and video prompts for H3 or Seedance 2.5 (asked each time), linted before any spend. **A reference\n"),
    # ---- templates
    ('video/templates/footage-prompts.md', 'The shot writer (`SHOTS.md`',
     "# Footage prompts — key frame, motion, checklist, worked examples\n\n",
     "# Footage prompts — key frame, motion, checklist, worked examples\n\n"
     "The shot writer (`SHOTS.md`, `shots/shots.py`) now compiles these prompts from a spec and checks them; this page stays\n"
     "the reference for the H3 recipe's wording and its worked examples.\n\n"),
    ('video/templates/brief.md', '**Your input:**',
     "- **Deadline:**\n",
     "- **Deadline:**\n"
     "- **Your input:** a few sentences / a brief or script / a rough storyboard / let's write it together (any is fine; your words are kept as you wrote them).\n"
     "- **Product features to show:** from the product's own page; each one gets a moment in the film.\n"
     "- **The hook:** the most striking image to open on (a reference photo is fine).\n"
     "- **The arc:** launch / SaaS / journey / life moments (`SHOTS.md` → Story and edit rules).\n"
     "- **AI footage model:** H3 (sharp, silent) or Seedance 2.5 (people talk, lip-synced, 720p): asked every time.\n"),
]

status = 0
for rel, marker, anchor, new in EDITS:
    p = os.path.join(S, rel)
    t = open(p, encoding='utf-8').read()
    if marker in t:
        print('SKIP      %s: %s' % (rel, marker)); continue
    if t.count(anchor) != 1:
        print('NO ANCHOR %s: %s (found %d)' % (rel, marker, t.count(anchor))); status = 1; continue
    assert marker in new, marker
    t = t.replace(anchor, new)
    open(p, 'w', encoding='utf-8').write(t)
    print('APPLIED   %s: %s' % (rel, marker))
sys.exit(status)
