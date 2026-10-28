# -*- coding: utf-8 -*-
"""Phase 2 of the shot writer (2026-10-26): the brief template's new parts — pacing targets, the passport, the trigger
map. They sit on top of apply_pointers.py's edits (which stay as they are). Same contract as that script: idempotent
(an edit whose marker is already in the file is skipped), otherwise its anchor must appear exactly once.
  /usr/bin/python3 apply_phase2_brief.py [SKILL_DIR]     (default ~/.claude/skills/product-launch-sting)
Prints one line per edit: APPLIED, SKIP (already there) or NO ANCHOR (the file was reworded: re-apply that pair by hand).
"""
import os, sys

S = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/.claude/skills/product-launch-sting')
BRIEF = 'video/templates/brief.md'

EDITS = [
    (BRIEF, '**Pacing targets:**',
     "- **Length:** 6 / 15 / 20 / 30 / 60 s. Rule of thumb: one idea per 2–4 s.\n",
     "- **Length:** 6 / 15 / 20 / 30 / 60 s. Rule of thumb: one idea per 2–4 s.\n"
     "- **Pacing targets:** a surprise by 2 s, the product by 3 s, the brand by 5 s; one idea per 2–4 s; something new on\n"
     "  screen about every 0.5 s (a word lands, a card moves, a cut). The 15 s and 30 s starters (`templates/launch15.yaml`,\n"
     "  `launch30.yaml`) are built to these.\n"),
    (BRIEF, '## 6. Passport',
     "- UI clips for your own edit: which moments, transparent (ProRes 4444) or on background, frame rate of your edit (24/25/30/60).\n",
     "- UI clips for your own edit: which moments, transparent (ProRes 4444) or on background, frame rate of your edit (24/25/30/60).\n"
     "\n"
     "## 6. Passport (one value per row, settled before the first frame is drawn)\n"
     "The film's fixed choices. Every shot follows them, so changing a row later means checking every shot again.\n"
     "\n"
     "| Row | Value (one each) |\n"
     "|---|---|\n"
     "| **Register** | a dark or a light world, and where it switches (e.g. dark footage until the click, light UI after) |\n"
     "| **Accent colour** | one hex and the one thing it means (e.g. #5747F2 = \"the product is working\"); nothing else wears it |\n"
     "| **Display type** | one face and weight for every headline |\n"
     "| **Type scale** | headline / label / caption, as % of the frame height (e.g. 14 / 4 / 3.5) |\n"
     "| **Margins and axis** | the safe margin, and the line the layout hangs on (the centre, the left third …) |\n"
     "| **Transitions** | at most two kinds, plus one signature move kept for the key cut |\n"
     "| **Camera verb** | the one way the camera moves in this film (push in, drift, orbit …) |\n"
     "| **Hero motif** | the shape or object seen in at least 60 % of the beats |\n"
     "| **Travelling object** | the one thing that crosses the cuts (a cursor, a card, a ring of light) |\n"
     "| **Light model** | where the light comes from and its colour temperature, in every shot |\n"
     "| **Sound** | the music's character, and the family of effects (clicks, pops, whooshes) |\n"
     "| **Bookend** | how the film opens and how it closes (often one image, changed by what happened) |\n"
     "\n"
     "## 7. Trigger map (one row per cut)\n"
     "Every cut has a cause the viewer can see in shot A; shot B starts with its effect, and the camera follows it across.\n"
     "A row becomes that cut's `cause:` in beats.yaml once the cross-cut transitions land (round 2); until then it goes in\n"
     "shot B's `note:`, which the storyboard prints.\n"
     "\n"
     "| Cut | Cause in shot A | Effect in shot B | How the camera follows |\n"
     "|---|---|---|---|\n"
     "| e.g. click → result | the cursor presses Generate | the result card grows out of the button | pushes in on the button, then rides with the card |\n"
     "| | | | |\n"),
]


def main():
    rc = 0
    for rel, marker, anchor, new in EDITS:
        p = os.path.join(S, rel)
        with open(p, encoding='utf-8') as f:
            t = f.read()
        if marker in t:
            print('SKIP       %s: %s' % (rel, marker))
            continue
        if t.count(anchor) != 1:
            print('NO ANCHOR  %s: %s (found %d times)' % (rel, marker, t.count(anchor)))
            rc = 1
            continue
        with open(p, 'w', encoding='utf-8') as f:
            f.write(t.replace(anchor, new))
        print('APPLIED    %s: %s' % (rel, marker))
    return rc


if __name__ == '__main__':
    sys.exit(main())
