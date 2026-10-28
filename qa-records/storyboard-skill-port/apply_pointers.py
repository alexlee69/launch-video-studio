# -*- coding: utf-8 -*-
"""The storyboard port's doc edits (2026-10-25): the story-engine rule and the pre-footage storyboard pointers.
Idempotent: an edit whose marker is already in the file is skipped; otherwise its anchor must appear exactly once.
  /usr/bin/python3 apply_pointers.py [SKILL_DIR]     (default ~/.claude/skills/product-launch-sting)
Prints one line per edit: APPLIED, SKIP (already there) or NO ANCHOR (the file was reworded: re-apply that pair by hand).
"""
import os, sys

S = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/.claude/skills/product-launch-sting')

EDITS = [
    # ---- GUIDE.md
    ('video/GUIDE.md', 'storyboards a footage film before any footage exists',
     "on the user's OpenAI key (`CASTING.md`), and **recreates a reference film frame for frame**",
     "on the user's OpenAI key (`CASTING.md`), **storyboards a footage film before any footage exists** on labelled placeholder\n"
     "plates, with a phone edition of the board (`STORYBOARD.md`), and **recreates a reference film frame for frame**"),
    ('video/GUIDE.md', 'for a recreation: loglines first',
     "| 2–3 directions in a few lines each; then the chosen one as `beats.yaml` |",
     "| 2–3 directions in a few lines each (for a recreation: loglines first, judged on fun as well as fit, keeping the reference's story engine: `RECREATE.md` → The story); then the chosen one as `beats.yaml` |"),
    ('video/GUIDE.md', 'stand on labelled placeholder plates',
     "| `lv.mjs --storyboard`: one **real** still per shot (not a sketch), PNG + PDF per aspect |",
     "| `lv.mjs --storyboard`: one **real** still per shot (not a sketch), PNG + PDF per aspect; AI-footage shots that don't exist yet stand on labelled placeholder plates, drawn free (`STORYBOARD.md`); `storyboard/phone.mjs` adds a phone edition of the board |"),
    ('video/GUIDE.md', '**When a story recreates a reference, judge it on fun',
     "- **Never render the film before the storyboard is approved.** Iterate on stills (seconds) instead of films (minutes).\n",
     "- **Never render the film before the storyboard is approved.** Iterate on stills (seconds) instead of films (minutes).\n"
     "- **When a story recreates a reference, judge it on fun, not only on fit.** Show loglines before any storyboard and\n"
     "  score each premise on excitement and humour against the reference, as well as brand, copy and feasibility\n"
     "  (`RECREATE.md` → The story).\n"
     "- **Storyboard before any footage is generated.** Footage shots stand on free placeholder plates until the board is\n"
     "  approved (`STORYBOARD.md`); casting and generation come after, each quoted first.\n"),
    ('video/GUIDE.md', 'storyboard/placeholders.py init|check',
     "python3 $V/casting/casting.py plan|candidates|lock|states|locations|stills|fix … [--go]   # one-face character sheets + key frames on gpt-image-2 (CASTING.md)\n",
     "python3 $V/casting/casting.py plan|candidates|lock|states|locations|stills|fix … [--go]   # one-face character sheets + key frames on gpt-image-2 (CASTING.md)\n"
     "python3 $V/storyboard/placeholders.py init|check|draw|status …   # labelled placeholder plates for footage shots, free (STORYBOARD.md)\n"
     "node $V/storyboard/phone.mjs --job DIR [--aspect A] [--cut NAME] [--cover cover.yaml]   # the storyboard as a phone-sized PDF; A: the film's first aspect (STORYBOARD.md)\n"),
    # ---- GUIDE.md step 5: footage and casting wait for the storyboard gate
    ('video/GUIDE.md', 'footage and casting only after the step 4 gate',
     "| 5 | Assets (in parallel with 2–4) | logo SVG, colours, fonts, Figma/screenshots, characters, footage, VO | `templates/assets-checklist.md`; a live-action shot list (`templates/live-action-shotlist.md`) when footage is needed; footage generated here: `FOOTAGE.md` (prompts and cost approved first); a recurring person cast and locked first, one face per sheet, and the key frames made from those sheets: `CASTING.md` | the locked character sheets |",
     "| 5 | Assets (in parallel with 2–4; footage and casting only after the step 4 gate) | logo SVG, colours, fonts, Figma/screenshots, characters, footage, VO | `templates/assets-checklist.md`; a live-action shot list (`templates/live-action-shotlist.md`) when footage is needed; once the storyboard is approved, footage generated here: `FOOTAGE.md` (prompts and cost approved first); a recurring person cast and locked first, one face per sheet, and the key frames made from those sheets: `CASTING.md` | the locked character sheets |"),
    # ---- RECREATE.md
    ('video/RECREATE.md', "the story's engine: a heightened genre",
     "| the job a shot does in the edit (\"a card rushes past in 3D here\") | their layouts traced box for box |\n",
     "| the job a shot does in the edit (\"a card rushes past in 3D here\") | their layouts traced box for box |\n"
     "| the story's engine: a heightened genre of our own, a running joke, a set piece per loop, a punchline (see The story) | their plot, or their jokes as written |\n"),
    ('video/RECREATE.md', '## The story: keep its engine, change its world',
     "check it doesn't read as a rewrite. When in doubt, change the composition, never the motion.\n\n## 1 · Measure the reference\n",
     "check it doesn't read as a rewrite. When in doubt, change the composition, never the motion.\n\n"
     "## The story: keep its engine, change its world\n\n"
     "When the reference tells a story (higgsfield01 does; a UI-only reference like hf02 doesn't), it works because of its\n"
     "story's engine, not its setting. Keep the engine; build a new world on it.\n"
     "- **The engine has four parts.** higgsfield01: a heightened genre (an Indiana Jones pastiche); a running joke tied to\n"
     "  the work (a desk job inside an action movie: he opens a laptop under fire); a set piece in every loop (monkeys, an\n"
     "  arrow, a boulder); a punchline ending (\"Next brief: …\"). It even ties the deliverable to its world: the promo is for\n"
     "  the reserve he runs through.\n"
     "- **Change the genre and the world, keep the engine.** A nouns-only swap is the copy trap above. A story with no\n"
     "  heightened genre, running joke, set pieces or punchline reads flat next to the reference: for manus2-space the first\n"
     "  story, a founder on a foggy ridge run making an ad for her own shoe, was turned down as \"more boring, just a founder\n"
     "  making an ad for her own product\"; the astronaut on a spacewalk, with a re-entry blackout and a \"next brief\"\n"
     "  punchline, was picked. What went wrong was the process: the premise was locked early from a features-first pitch,\n"
     "  only the setting was varied, and nobody scored the fun.\n"
     "- **Vary the premise and the tone, not only the setting.** Write two or three premises that differ in genre, world and\n"
     "  tone, each on the same engine.\n"
     "- **Score the fun.** Judge each premise on excitement and humour against the reference, next to fidelity,\n"
     "  feasibility, brand and copy safety.\n"
     "- **Loglines before storyboards.** Show the user the loglines and premises first; storyboard only the one they pick, on\n"
     "  placeholder plates before any footage exists (`STORYBOARD.md`).\n\n"
     "## 1 · Measure the reference\n"),
    # ---- FOOTAGE.md
    ('video/FOOTAGE.md', '**Not before the storyboard is approved**',
     "## When to generate here\n\n",
     "## When to generate here\n\n"
     "- **Not before the storyboard is approved**: until then each footage shot stands on a placeholder plate, a labelled\n"
     "  still drawn free (`STORYBOARD.md`; not the footage plates `plates.py` builds below); the approved board then says\n"
     "  exactly which shots to generate.\n"),
    # ---- SKILL.md
    ('SKILL.md', '**Storyboarded before any footage**',
     "from those sheets on the user's OpenAI key (gpt-image-2), identity shots first, quoted before any spend. **A reference\n",
     "from those sheets on the user's OpenAI key (gpt-image-2), identity shots first, quoted before any spend.\n"
     "  **Storyboarded before any footage** (`video/STORYBOARD.md`): labelled placeholder plates drawn free for the footage\n"
     "  shots, and a phone edition of the board for review. **A reference\n"),
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
