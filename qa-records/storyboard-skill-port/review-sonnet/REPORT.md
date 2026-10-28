# Review of the storyboard port (reviewer: sonnet, 2026-10-26)

The reviewer's tool refused to write this file, so the author saved its returned report here. 17 findings: 1 high,
7 medium, 9 low. Runs were in `review-sonnet/work/`; nothing paid was called; no skill file was edited.
`PH` = `video/storyboard/placeholders.py`, `PM` = `video/storyboard/phone.mjs` (line numbers are round 0).

## High
1. **A plate's label, END inset and crop captions get clipped on the board**, because the engine's defaults move every
   `bg:` (`bgMove: in` Ken Burns ~1.02→1.12, `bgDim` .15, `push` .035; `engine/runtime.js:306-358`), cutting ~65 px off
   the top and ~115 px off each side of a 1920×1080 plate at the hero frame; the label sits 40 px in. STORYBOARD.md says
   only `bg: assets/plates/<ID>.png`; The Lull set `bgMove: none, bgDim: 0, push: 0` on every plate shot. Repro: a
   16:9 plate with no crops on a shot with only `bg:` → storyboard → the label loses "AI" and its top line. Fix: document
   the three fields (STORYBOARD step 2, starter `_note`, `draw`'s hint), draw with margins that survive the default move,
   and flag such shots in `status` / `phone.mjs`. Verified by running.

## Medium
2. **`draw --sheet` overwrites a file that isn't its own, writes through a symlink, not atomically** (`PH:807-828`): a
   user file or a symlink at `placeholders-sheet.jpg` is replaced / written through. Fix: same guard + temp/replace as
   plates, a marker on the sheet. Verified by running.
3. **The END inset leaves a crop for a portrait plate with a 16:9 crop, unwarned** (`PH:696-703`): sized from the safe
   width with the plate's aspect, it rises above the crop and over the label. Fix: size from both safe dimensions, keep
   clear of the label, warn when it can't fit. Verified by running.
4. **A spec outside `<job>/tools/` with the default `"root": ".."` writes outside the job, silently** (`PH:282-289,
   748-764`): `draw --spec p.json` in the job folder writes to the job's parent; the printed path looks local. Fix: `init`
   writes root relative to the cwd; refuse a root with no `beats.yaml`; print cwd-relative paths. Verified by running.
5. **Several bad inputs crash (exit 5) instead of being listed (exit 2); `check` passes what `draw` crashes on**: a list
   for `aspect`, `crops` items or `who` (unhashable), a 400-digit integer (`math.isfinite` OverflowError), a `font` that
   is a text file (check ✓, draw crashes), `out` that is a file or under a file, Pillow/numpy missing. Fix: type checks,
   catch OverflowError, load the font in check, refuse makedirs failures, import the libraries early with the pip hint.
   Verified by running.
6. **`phone.mjs` drops the board's "Notes before the film" block** (`PM:193` hides `body>.warns`) though STORYBOARD.md
   says the phone edition carries the same warnings. Fix: carry them (a last page) or change the doc. Verified by running.
7. **GUIDE.md step 5 still schedules footage and casting in parallel with steps 2–4**, contradicting the new rule
   "Storyboard before any footage is generated". Fix: footage and casting only after the step-4 gate. Verified by reading.
8. **Non-Latin text renders as empty boxes with no warning; one long unbroken word overflows the plate** (Arial Bold /
   DejaVu have no CJK). Fix: warn on .notdef glyphs and suggest `font`; break a word wider than the label. Verified by
   running.

## Low
9. **SIGTERM / SIGHUP leave temp files** (`PH:734-744`, `PM:149-150`); a later `draw` doesn't clean them. Fix: a
   handler that cleans up, or sweep stale temps at start. Verified by running.
10. **`status` can print "none" on a stale timeline; `phone.mjs` can't see a plate redrawn after the board.** Fix:
    `status` refuses when `beats.yaml` is newer than the timeline; `phone.mjs` compares referenced files' mtimes with
    the board. Verified by running (status), reading (phone).
11. **`phone.mjs` overwrites a PDF it did not write**, including The Lull's shipped 10-23 review PDF (same name), and
    wipes `board-phone/`. Fix: check the existing PDF's `/Creator`; refuse if it isn't ours. Verified by reading.
12. **A missing Chrome is "unexpected error" with a stack, exit 5** (`PM:290-294`; `UserError` not handled). Fix: exit 2
    with the message. Verified by running.
13. **Validation looser than "a typo never drops silently"**: any `<…>` text is taken for an unfilled placeholder
    ("he says <wow>"); booleans unchecked (`"thirds": "false"` → true); per-kind keys unchecked (a vignette's `color`,
    `x`, `n` ignored); the id rule needs a leading letter/digit but the message says "letters, digits, - or _", while
    beats.yaml ids may start with `_`. Fix: strict bools, per-kind key sets, a placeholder pattern only for the starter's
    hints, an accurate id rule. Verified by running.
14. **Ids differing only by case collide on macOS** (case-insensitive APFS): two `→` lines, one file. Fix: refuse.
    Verified by running.
15. **A `bust` always trips the crop warning; the doc's `feet` meaning for a bust is wrong** (shoulders are drawn
    0.96 × height wide and run 0.2 × height below `feet`); an unnamed figure is reported as "figure figure". Fix: check
    the head for a bust; correct the doc. Verified by running.
16. **STORYBOARD.md omits options and misstates a default**: `--cut`, `--spec`, `status --job`, `--dpr` / `--quality` /
    `--max-mb` ranges and defaults; `[--aspect 16x9]` reads as the default (it is the film's first aspect); a 1:1 still is
    1000 px, not 1100; "plate" now means four things (placeholder, footage, casting location, kit placeholder stills).
    Verified by reading.
17. **RECREATE.md "The story" is stronger than its source note**: "a heightened genre swapped for a grounded one kills
    the fun" generalises one rejection; "never lock the premise from a features-first pitch" hardens a cause into a
    rule; "writers" / "story panel" / "judges" describe an orchestration the skill doesn't define; the table row lists "a
    heightened genre" as borrowed while the section says to change the genre. Fix: soften, phrase as steps, fix the row.
    Verified by reading.

## Checked and holds
Determinism (byte-identical PNGs across folders); no network; plate-file guard (symlink / non-plate refused, `out`
through a symlink refused, temp + replace, SIGINT clean); crop geometry matches the engine's centred cover crop; label
inside every crop for 16:9 and 9:16 plates; 120 random in-range specs render without an exception on Python 3.9.6;
phone PDFs valid for 16:9, 9:16, 1:1 and a cutdown; every documented phone refusal; the shrink path; `--max-mb` exit 1;
cover text escaped; the doc edits equal `apply_pointers.py`.
