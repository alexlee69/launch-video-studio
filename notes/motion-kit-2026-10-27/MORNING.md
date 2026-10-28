# Motion kit: morning report (2026-10-27)

**Bottom line.** The motion kit is in the live skill: round 1 (new blocks + frame checks), round 2 (transitions across
the cut + cut checks) and the small items from `qa/video-skill-learnings/TAKE-AND-HOW-2026-10-26.md`. Every QA pass
ends green. **Committed and pushed** to alexlee69/launch-video-studio as `1b80a3a` on 2026-10-27, after Alex reviewed
the results page (https://claude.ai/artifact/TN7PcdJCmdXYCdZa71TCwz).

## What you can do now

- **Four new set pieces:**
  - `press`: a big cursor presses one button and rings burst from it.
  - `fan`: one card deals out into a 3D arc of clips.
  - `particles`: a dot globe, burst, star field, halftone grid or terrain.
  - `map`: a city map draws its route, with pins and labels.
- **Three new modes on old blocks:** `wall layout: grid`, `type words` (word-by-word beats), `stack mode: exploded`.
- **Moves that cross the cut:**
  - `carry`: one card flies from shot A into shot B.
  - `morph to: frame`: a box reshapes into the next shot's frame.
  - `dive`: the camera falls into a point and keeps going.
  - `flood`: colour pours out of the pressed button.
  - `from:`: the next shot grows out of an element in this one.
- **Rules for those moves:**
  - each moving cut names its `cause:`;
  - `--grid` warns past two transition types, unless one is declared `signature:`.
- **New checks in every film's QA (all WARN, none FAIL):**
  - dead air;
  - text too small for the delivery (`delivery: feed` raises it);
  - low contrast;
  - flashing, using your rule from this morning: net change, kept as a warning;
  - purity (the same frame drawn twice gives the same pixels);
  - reading time;
  - cut continuity, with cut stills on the review sheet.
- **Starters:**
  - `lv.mjs --job DIR --init --kit launch15|launch30` writes a 15 s or 30 s launch on the kit;
  - the brief has a passport and a trigger map;
  - the shot writer has phase 2.
- **The sample, "Wayfinch"** (a made-up trip planner): `~/Downloads/launch-videos/motion-kit-sample`.
  - 28 s, 11 shots, all seven new pieces and all five moves.
  - Re-rendered at 20:35 on the final live skill: QA PASSED (16 checks) in 16:9, 9:16 and 1:1.
  - The only WARNs are the 35 px labels and the 31 px end-card URL (size and contrast), which is in the deferred list.

## How it was checked

- **Review:** Opus only (your call for this run). It made 21 findings, 3 of them high: 18 fixed, 3 fixed in part.
- **QA1, the new work:**
  - **Round 1 failed** on 3 visual glitches that no automatic check caught:
    - a card that should grow from a button popped in after a flood;
    - in the 30 s starter, a carried card jumped shape at the cut.
  - **One fix round, then round 2 passed:** 18 films, 6 layer exports and the alpha clip.
- **QA2, old jobs:**
  - Byte-identical to the old skill, apart from new WARN/INFO lines and known run-to-run noise (the wall shot, max 3 in 255).
  - The planted probes still FAIL as before.
- **QA3, the checks:** each new check fires on a planted bad shot and stays quiet on a good one.
- **After the merge, on the live skill:**
  - a fresh `--init --kit launch15` film: QA PASSED (17);
  - the shot-writer, casting and storyboard test suites: ALL SUITES PASS (17 / 48 / 16 / 57 / 90 / 48), after the
    test upkeep below
- **Originals:** no file under `~/Downloads/launch-videos` changed except the new sample job.

## The unflattering part

- **QA is still blind to some glitches.** All three QA1 highs passed every automatic check and `--grid`. Only reading the
  frames caught them. Keep reading cut stills before a film goes out.
- **Films render about 31 % slower** (steady-sample 148 s → 194 s). Most of it is the purity re-draws.
- **The reading-time rule is noisy.**
  - It warns on 34 of 63 shots in the old jobs (the old rule: 5).
  - Even a fresh `--init` starter gets 4–6 "Notes before the film".
- **Partly fixed:**
  - 9:16 `stack mode: exploded` fills only about a third of the frame height.
  - The prompt box in prv-combo's carry hangs over its neighbouring tiles for about 8 frames.
  - The fan gets a purity WARN at frame 138: a footage card isn't ready when the frame is drawn.
- **Small ones (LOW):**
  - a near-flat frame before one dive lands;
  - an empty oval for 0.27 s in particles grid mode;
  - a 2-frame double image in launch30's carry, under the blur;
  - `--clips` and `--layers` ignore `--workers` (always 4).

## Waiting on you (deferred, not built)

- Snapping worker seams to cuts (it changes old frames).
- End card / steady muted-grey contrast and the 31 px URL. The starters WARN on these.
- The wall's run-to-run raster noise.
- The two-box ±18 % morph.
- Faster particles.
- `ui.js` purity fixes. These were measured, then reverted, because they move old heroes by up to 238 code values.
- Calibrating the checks on the four reels before any check becomes a FAIL.
- `from:` on wall grid and exploded stack.
- **Round 3, the plan's "Later" row:**
  - one `motion:` personality per film;
  - a lens pass;
  - sub-frame motion blur;
  - themes from seed colours.

## Files

- **Reports:** `qa/motion-kit/reports/`:
  - `merge.md`, `flash.md`, `prove.md`, `docs.md`, `sample.md`;
  - `review-opus.md`, `fixes.md`;
  - `qa1.md`, `qa2.md`, `qa3.md`.
- **What changed:** 35 files (24 edited, 11 new), listed in `qa/motion-kit/merge/promote-files.txt`.
- **Undo:** `bash qa/motion-kit/merge/rollback.sh` (a dry run), then `--go`. It is proven on a copy of the live skill.
- **Test upkeep at ship:**
  - The shot-writer and storyboard suites' "engine unchanged" fingerprints are re-taken from the kit (old ones are kept as `*.before-motion-kit`).
  - Two storyboard tests now allow the board's own notes pages.
  - The "engine == backup" checks compare against the synced backup folder, so they pass now; keep the backup in step.
- **Backup:** `~/Downloads/launch-video-studio`: skill, sample job and memory note in `1b80a3a`; this report and
  `reports/` in `notes/motion-kit-2026-10-27/`.

## Asks

1. ~~**Commit and push** the backup to alexlee69/launch-video-studio?~~ Done: `1b80a3a`.
2. **Reading time:** loosen the rule (fewer warnings), or keep it strict?
3. **Round 3** (the "Later" row): go, or park?
