# Worker S · build report: shot writer phase 2, brief passport, 15 s / 30 s skeletons (2026-10-26, overnight)

**TL;DR.** SPEC-S §1–3 are built in `qa/motion-kit/stageS/product-launch-sting` and tested.
- **Old shots are untouched.** 118 old specs (272 shots) compile to byte-identical prompts through the pre-phase-2
  shots.py and the new one. 369 `check`/`show` runs print the same, apart from a new `i` info line. The Lull still
  builds 20/20 prompts byte for byte.
- **The new fields work.** Each one lands where SHOTS.md says, 28 bad inputs are each refused in exactly one line,
  and negatives stay out of every prompt until `confirm`. `test_phase2.py`: 43/43 PASS.
- **Both skeletons pass.** They run `--grid` with no warnings, lay out in all three aspects, and a real 16:9 film of
  each says **QA PASSED** (15 s: 15 checks; 30 s: 18 checks).
- **The unflattering part.** The full `run_all.sh` on stageS doesn't say ALL SUITES PASS, and it didn't before I
  started either. Parity P4 and P4b fail on stageS for reasons outside my files (the lead's round-1 stubs; live paths
  hard-coded in a fingerprint file), and P8 now fails because `brief.md` changed on purpose. I prove all three another
  way below.
- **Nothing committed, pushed, paid or installed.** The live skill is unchanged: all 867 files in `live-before.sha1`
  are OK.

## Decisions I took (Alex was asleep; each one is easy to reverse)

| Decision | Why |
|---|---|
| `refs` is a new **shot-level** list `[{ref, dont}]`; `ref` names one of the shot's people, its place, its products, `position`, or `first` | `key.refs` is a list of paths that only works with a hand-written `key.prompt`, so it can't carry "don't" lines. Naming references by id lets the tool put each "don't" line right after that image's line in the key frame. |
| The "don't take" lines for people, places, products and the sketch go **in the key frame only**. Only `first` (the input image) goes in Seedance's REFERENCES | Seedance runs image-to-video on the key frame and never sees the sheets. Telling it what not to take from images it doesn't receive is noise. The reference-to-video route (not wired yet) would carry them all. |
| `must`, `task`, `acting` and `negatives` reach **Seedance only**; H3 gains the trick plus the fail lines that fit within **120 words** | This is what SPEC-S says. 120 is my budget: The Lull's sent H3 prompts run 32–131 words (median about 66). A warning names any fail line left out, and any Seedance-only field on an H3 shot. |
| Where each field goes inside the existing blocks (no new blocks) | The trick opens the ACTION, then the must rules, then the task. The acting follows the timed beats. Sizes go into BODY AND PHYSICS. Fail lines and confirmed negatives go into LOCKS. In the key frame, sizes follow the first-frame line. |
| Negatives reach a prompt **only when `negatives` is in `confirmed` and not in `proposed`** | If negatives are written but listed in neither, they still stay out, and a warning says to list them in `proposed`. Without this, a build with nothing pending would let Claude's negatives through. |
| The vague-word lint runs **only on shots that use a phase-2 field**, and only on the shot's own prompt text | The Lull's own text has 20 "slightly" and 10 "very". Linting every shot would add 30 warnings to an old spec and break parity P1b ("its only warnings are the two camera-move ones"). The lint skips Alex's brief and script, spoken lines, ids, the recipe's text and our snippets. |
| The "people but no task" note is an **info line** (`i …`), on **Seedance shots only**, and it never changes the exit code | A task can't reach an H3 prompt. On old Seedance specs the note appears, but exit codes and warnings stay as they were (Q1b). |
| A `fail` entry is written as a condition and printed as "If …, the shot is wrong." | A line that already says "wrong" stays as written. A leading article or pronoun ("The …") is lowercased after "If"; names keep their capital. |
| `recipes.json` and `starter.json` are unchanged | A trick in a recipe default would change the prompts of every old shot that uses that recipe. |
| The brief's new parts are applied by a script, `apply_phase2_brief.py` | It is idempotent and works like the port's `apply_pointers.py`, so the brief can be rebuilt from the rollback copy, the same way parity P8 does. |
| The skeletons are 120 BPM, light world, existing blocks only, and reuse the existing placeholder SVGs | No new placeholder files were needed. Each place where a round-1 block fits better carries a `# round 1:` comment. |
| launch15 has **8 shots**, not "about 10" | The end card has to hold for at least 2 s. The `endcard` block's lockup, URL and tagline only settle at about 1.07 s, so a 2-beat end card would hold for 0.9 s. The CTA therefore lives on a 4 s end card (11–15 s), which settles by about 12 s. Every other timing is as specified. |
| Dark title cards (`theme: dark`) in both skeletons | The first 16:9 film failed QA's cut check. A light title zooming through into a light shot didn't read as a cut (0.87×). On dark it reads at 5.06×. It is also the bookend in launch30. |
| launch30's action shot exits on `zoom-in` | The macro bar's last frame and the float's first frame are both mostly background, so the hard cut measured 0.63× (FAIL). A punch-in on the send now registers as INFO, with the boundary proven by the shot log. |

## What changed, file by file

All edits are in the staging copy `qa/motion-kit/stageS/product-launch-sting/video/` (`$S`) or in new files under
`qa/shots-skill-port/`. The manifest diff against my pre-edit snapshot
(`reports/S-rollback/stageS-pre.sha1` → `stageS-post.sha1`) lists exactly these six skill files:

| File | Change |
|---|---|
| `$S/shots/shots.py` (+372 / −9 lines) | **Fields.** Eight new optional shot fields: `trick` (text or `{rule, so}`), `must`, `fail`, `refs` (`[{ref, dont}]`), `task`, `acting` (`{who, direction, motive, goal, obstacle, tactic, eyes:[{t,do}], restrained, lens:[[a,b]]}`), `sizes` (`{thing: {frame, body, hand}}`), `negatives`. Each one is type-checked through `typed()`, which gains two type tokens (`a list of objects`, `text, or {rule, so}`), and each refusal is one line. **Compiling.** `_phase2()` parses the fields and the `*_text()` helpers write them. `key_prompt`, `h3_prompt` (with `h3_fails()` for the budget) and `seedance_prompt` each slot them in. A shot without the fields compiles exactly as before. **Lint and info.** `lint2()` holds the new warnings and errors; `own_text()` collects what the vague-word lint reads. `Spec.infos` and an `i ` line are added to `report()` and `show`. **Show.** `show` lists proposed negatives separately. |
| `$S/SHOTS.md` (+75 lines) | A table row for the new fields; one paragraph under the Seedance block order; a new section, **Phase 2: one trick, the rules that can't break, the acting**, with a field and placement table, the H3 rule, the checks and the worked example (the spec cut down, plus 9 compiled lines a test keeps honest); and a line saying info lines never change the exit code. The voiceover route that test S11b checks is untouched. |
| `$S/shots/examples/phase2-band-shots.json` (new) | The worked example: a fictional fitness band. K01 (Seedance, 8 s) uses every field, with its negatives still proposed. K02 (H3, 6 s) shows the trick and fail lines in a short prompt. |
| `$S/templates/brief.md` | **Pacing targets** bullet: a surprise by 2 s, the product by 3 s, the brand by 5 s; one idea per 2–4 s; something new about every 0.5 s. **§6 Passport**: a 12-row table, one value per row. **§7 Trigger map**: one row per cut: cause in A → effect in B → how the camera follows; it goes in `note:` until round 2's `cause:` lands. Insertions only. |
| `$S/templates/launch15.yaml` (new) | **15 s at 120 BPM, 30 beats, 8 shots.** hook (media, no words) 0–1 → name (type, dark, zoom-through) 1–3 → ask (scene macro bar, 22 characters) 3–5.5 → click (panel card + tap on Generate) 5.5–6.5 → result (float, OUTPUT) 6.5–8.5, with the music `drop` here → scale (wall) 8.5–9.5 → proof (stat 10× faster) 9.5–11 → end card with the CTA 11–15. 14 must-read words. |
| `$S/templates/launch30.yaml` (new) | **30 s at 120 BPM, 60 beats, 14 shots.** hook → title (dark) → feature → action (macro bar, zoom-in) → result → inputs→output (split side) → before→after (split wipe) → punctuation ("Done.", `music.breaks` dips under it) → one (stack) → many (wall) → proof → summary → title again (dark) → end card with the CTA. 31 must-read words. |
| `qa/shots-skill-port/test_phase2.py` (new) | QA 5, 43 checks: Q1 byte identity, Q2–Q4 placement and negatives, Q5 refusals, Q6 lint, Q7 docs example, Q8 brief, Q9 skeletons. |
| `qa/shots-skill-port/apply_phase2_brief.py` (new) | The brief edits (2), idempotent. |
| `qa/shots-skill-port/rollback/shots_shots.py.pre-phase2`, `SHOTS.md.pre-phase2` (new) | The pre-phase-2 files (sha of shots.py = live's, `360a350…`); Q1 runs the old tool from here. |
| `qa/shots-skill-port/run_all.sh` | `test_phase2.py` added to the list; nothing else. A pre-edit copy is in `reports/S-rollback/run_all.sh.pre-phase2`. |

Rollback copies of every file I edited are in `qa/motion-kit/reports/S-rollback/files/`, along with the before and after
logs.

## Commands and results

**Does each suite run against the stage copy when `SHOTS_QA_VIDEO` is set?**
- `qa_lib.py` reads `SHOTS_QA_VIDEO`, and test_flow, test_casting_mock, test_failures, test_review_fixes and
  test_phase2 take every path from it. Those suites genuinely run against stageS.
- `test_parity.py` doesn't, in four places:
  - **P3:** `make_example.py` hard-codes the live skill. It rebuilds the Lull example from live and compares the result
    with stageS's copy. I didn't change that example, so it passes either way.
  - **P4b:** `rollback/pre.sha1` lists live paths, so it fingerprints the live skill. It fails only because the
    expected path is built from V.
  - **P8:** compares stageS's docs with the pointer-rebuilt rollback copies.
  - **P9:** runs the casting and storyboard suites, which hard-code live (`SB_QA_VIDEO` aside).
- How I covered them on stageS:
  - Byte identity is test_phase2 Q1/Q1b/Q1c: the old tool against the new tool, on the same 118 specs.
  - The P8 equivalent is Q8: the rollback brief, then `apply_pointers.py`, then `apply_phase2_brief.py`, equals
    stageS's brief exactly, and the change is insertions only.
  - The P4/P4b equivalent is the stageS manifest diff above: only my six files changed. On top of that, live matches
    `live-before.sha1` (867/867 OK).

```text
# BEFORE (stageS untouched; reports/S-rollback/run_all-before.log)
SHOTS_QA_VIDEO=$S bash qa/shots-skill-port/run_all.sh
FAIL  P4 lv.mjs, lib/ and engine/ are byte-identical to the pushed backup   (lead's round-1 spec.mjs/timeline.mjs/blocks)
FAIL  P4b of the 18 fingerprinted files only footage/gen.mjs changed        (pre.sha1 holds live paths)
QA 1 parity: 15/17 · QA 2 flow: 48/48 · QA 2b casting mock: 16/16 · QA 3 failures: 57/57 · QA 4 review fixes: 90/90

# AFTER (reports/S-rollback/run_all-after.log)
FAIL  P4  (same as before: lead's round-1 files)
FAIL  P4b (same as before: live paths in pre.sha1)
FAIL  P8 apply_pointers.py on the rollback copies rebuilds all 5 live docs exactly   ← intended: brief.md gained the passport
      (checked: of the 5 rebuilt docs, SKILL.md, GUIDE.md, FOOTAGE.md, footage-prompts.md are identical; only brief.md differs)
PASS  P1 The Lull: 20 of 20 H3 prompts compile byte for byte · P1b only the two camera-move warnings · P2/P2b/P3/P5–P7/P8b/P8c/P9/P9b
QA 1 parity: 14/17 · QA 2 flow: 48/48 · QA 2b casting mock: 16/16 · QA 3 failures: 57/57 · QA 4 review fixes: 90/90 · QA 5 phase 2: 43/43
```
So every check that ran clean before still runs clean, apart from P8. P8 fails only because `brief.md` changed on
purpose, and test_phase2 Q8a proves the new brief is exactly the rollback copy plus `apply_pointers.py` plus
`apply_phase2_brief.py`.

```text
# test_phase2.py on its own (after the other suites had filled out/)
PASS  Q1 118 old specs (272 shots) compile the same through the pre-phase-2 shots.py and this one: refusals, warnings, video, key and emit prompts, plan rows
PASS  Q1b 369 check/show runs print the same as before (new "i" info lines aside) with the same exit codes
PASS  Q1c The Lull: build + emit-casting write the same 42 files, byte for byte
PASS  Q2a–Q2i  trick / must / task / acting / fail / sizes / refs first / key-frame don't + sizes / block order unchanged
PASS  Q3a–Q3d  H3: trick then beats then fail lines; key frame gains sizes; must/task/acting left out with a warning; 120-word budget
PASS  Q4a–Q4g  negatives: out of show's prompts while proposed, build refuses, unlisted → still out + warning, after confirm → LOCKS
PASS  Q5 28 bad inputs: each refused (exit 2) in exactly one line naming the field
PASS  Q6a–Q6i  lint: vague words (not Alex's brief, not our snippets), task info line (exit 0, Seedance only), shape warnings, hand-written prompts
PASS  Q7 SHOTS.md's 9 compiled example lines appear word for word in show K01 / show K02 · Q7b one warning only
PASS  Q8a–Q8d  brief rebuilt exactly from rollback + both pointer scripts; idempotent; 12 passport rows; insertions only
PASS  Q9 launch15: --grid exits 0 with no warnings; 15 s at 120 BPM (30 beats), 8 shots, 12 words on screen (cap 16)
PASS  Q9 launch30: --grid exits 0 with no warnings; 30 s at 120 BPM (60 beats), 14 shots, 30 words on screen (cap 31)
QA 5 phase 2: 43/43 PASS
```

**Skeletons.** Jobs: `qa/motion-kit/jobs/S-launch15/`, `qa/motion-kit/jobs/S-launch30/`. Each `beats.yaml` is a copy of the
template; the placeholder SVGs went into `assets/` by hand, since `--init --kit` isn't wired yet.
```text
node $S/video/lv.mjs --job jobs/S-launch15 --grid              → 9→8 shots, no warnings (after fixes)
node $S/video/lv.mjs --job jobs/S-launch15 --storyboard --aspect all   → 16x9 / 9x16 / 1x1, no notes
node $S/video/lv.mjs --job jobs/S-launch15 --film --aspect 16x9 --workers 2
  1st run: QA FAILED (2): cut name→ask 0.87× (light zoom-through into a light shot); content: frame 330 near-empty (the click card popped from nothing)
  fixed (dark title card; the click card sits in its panel from frame 0) → QA PASSED (15 checks); --qa re-run on the final template: QA PASSED
node $S/video/lv.mjs --job jobs/S-launch30 --grid / --storyboard --aspect all  → no warnings, no notes
node $S/video/lv.mjs --job jobs/S-launch30 --film --aspect 16x9 --workers 2
  1st run: QA FAILED (1): cut action→result 0.63× (macro bar → float, both mostly background)
  fixed (out: zoom-in on the send) → QA PASSED (18 checks)
```
**Two-line `--kit` change, tested on a throwaway clone.** I applied the change below to a `cp -c` clone in my scratchpad,
not to stageS. `--init --kit launch15|launch30 --title "Acme Notes"` writes the starter, sets the title, slug, brand
name and mono, and copies the placeholders (5 and 7 files). The result passes `--grid`, and a bad `--kit` is refused
with the new message.

## The `lv.mjs` change for the lead (lines 440 and 443)

```js
const KITS = { reel: ['card', 'before', 'after'], film: ['clip-1', 'clip-2', 'clip-3', 'clip-4'], launch15: ['clip-1', 'clip-2', 'clip-3', 'clip-4', 'card'], launch30: ['clip-1', 'clip-2', 'clip-3', 'clip-4', 'card', 'before', 'after'] };
  if (kit != null && !Object.hasOwn(KITS, String(kit))) die(`--kit must be ${Object.keys(KITS).join(', ')} (a reel of AI footage + stickers, a launch film with UI over AI footage, or a 15 s / 30 s launch skeleton)`, 2);
```
Optional extras:
- **Header comment:** line 5 becomes `[--kit reel|film|launch15|launch30]`.
- **Product name:** `--title` sets only the brand, as with the film kit. The `text: Product` lines in the type shots
  stay literal, and a comment says so. A third line could replace `^(    text: )Product\b` for these two kits.

## GUIDE text I'd add (the lead writes the docs)

- **GUIDE.md → "Reels and launch films"**, in the code block beside the reel and film kits:
  ```
  node $V/lv.mjs --job DIR --init --kit launch15  # 15 s at 120 BPM, 8 shots: hook · name · prompt · click · result (the drop) · scale · proof · end card
  node $V/lv.mjs --job DIR --init --kit launch30  # 30 s at 120 BPM, 14 shots: the full arc, title bookends, the music dips on the punctuation beat
  ```
  Add one sentence after it: "Both are built to the brief's pacing targets (a surprise by 2 s, the product by 3 s, the
  brand by 5 s) and mark with `# round 1:` where a motion-kit block fits better."
- **GUIDE.md → workflow step 1 (brief):** "Fill the brief's passport (§6) and trigger map (§7) before the first frame;
  the trigger map's causes go into each shot's `note:` (round 2: `cause:`)."
- **GUIDE.md → beats.yaml**, after the reel and film starters: "`templates/launch15.yaml` and `launch30.yaml` are the
  15 s / 30 s skeletons (`--init --kit launch15|launch30`)."
- **SKILL.md:** the shot-writer line gains "one trick per shot, the rules that can't break, failure lines, what not to
  take from each reference, a task, acting and sizes three ways (SHOTS.md → Phase 2)".
- **Two lessons from QA worth one line in GUIDE → Limits:**
  - A `through: true` zoom-through cut into a shot on the same background fails QA's cut check. Change the register
    across that cut, or use a moving exit.
  - A shot whose only content pops in at frame 0 fails the content check. Keep something on screen from the first
    frame.

## Open issues (none of them blocks the merge)

1. **Suite wiring for the lead at merge:**
   - **P8:** once `brief.md` ships, parity P8 compares live's brief with `apply_pointers.py` alone. Add a call to
     `apply_phase2_brief.py` to P8 after `apply_pointers.py`, as test_phase2 Q8 does, or P8 will fail on live.
   - **P4/P4b:** these will fail on any staging copy. They need a staging-aware reference (a V-relative `pre.sha1`).
2. **Small end-card text.** The `endcard` block draws the tagline and URL small: the URL is about 27 px at 9:16 by
   eye, and film QA's `text` check passed at 16:9. Now that the end card carries the CTA, a bigger tagline would help.
   That is a block option for a later round; I didn't touch blocks.
3. **The click shot is a stand-in.** It is a `panel` card with a tap. The cursor lands on the button's centre and
   covers part of "Generate", and the button is about 1.5× normal size. Round 1's `press` block is meant to replace
   it; the template's comment says so.
4. **Film QA only at 16:9.** The 9:16 and 1:1 films weren't rendered, because the Mac was shared (load average about
   70). Their storyboards are clean: no clipping notes after a per-aspect `zoom` on the click shot.
5. **Not yet checked against Worker B's new checks.** These skeletons haven't been run through dead air, contrast,
   flash safety or purity, which don't exist in this copy. The reading time is built to B's formula (each text shot is
   at least `0.4 + max(1, 0.35·words + 0.5)` s). Risk: the 4 s end card, which is settled from about 12 s with only
   the logo's wobble and the push moving, might trip dead air.
6. **Two heuristics to know about:**
   - The one-sentence check on `trick.rule` splits on ". ", so an abbreviation can trip it.
   - The vague-word list is exactly the spec's seven words.
7. **Q1 depends on run order.** Q1 needs at least 100 specs, read from what the other suites leave in `out/`. Run
   `test_phase2.py` after them, as run_all.sh does. Run on its own, in a fresh checkout, it fails Q1 by design.

## Stills to look at

- **Storyboards:** `qa/motion-kit/jobs/S-launch15/launch-15-storyboard-{16x9,9x16,1x1}.png` and
  `qa/motion-kit/jobs/S-launch30/launch-30-storyboard-{16x9,9x16,1x1}.png`.
- **Films (16:9):** `qa/motion-kit/jobs/S-launch15/launch-15-16x9.mp4` and
  `qa/motion-kit/jobs/S-launch30/launch-30-16x9.mp4`.
- **Film frame sheets:** `qa/motion-kit/reports/S-stills/launch30-16x9-film-frames.png` (final), and
  `launch15-16x9-film-frames-v1.png` (the passing render, before a comment-only template edit).
- **Phase-2 prompts:** `cd` to a job with the example, then `shots.py show K01`. test_phase2 builds one at
  `qa/shots-skill-port/out/phase2/example/`.

## Fix pass (2026-10-26, after `reports/S-monitor.md`)

**TL;DR.** The monitor found 2 HIGH, 8 MEDIUM and 13 LOW. All 23 are dealt with:
- **20 fixed** in my files.
- **M7 fixed in a tested patch**; the lead applies it, because it is in `lv.mjs`.
- **M5 handed to the lead with a tested patch**, because it is in `test_parity.py`.
- **L9 partly fixed.**

What is left sits in a block or the engine, which I may not edit: the end card's URL and the labels' sizes (M8), the
cursor and the `tap` purity bug (L9), and notes 1–2.
- **Both starters now pass film QA in all three aspects.** 6 of 6 films say QA PASSED. The 9:16 failure is gone.
- **Old shots still compile byte for byte.** Q1, Q1b, Q1c and parity P1 pass after the fix.
- **The suites.** test_phase2 is 47/47; `run_all.sh` fails the same three parity checks it failed before (P4, P4b, P8, none of them in my files; see M5), and every other suite passes.
- **The live skill is unchanged:** 867 of 867 files OK. Nothing was committed, pushed, paid for or installed.

This section supersedes the earlier sections above wherever the two differ (shot counts, the end card, the example,
the brief's pacing line). A rollback copy of every file this pass touched, as it was before the pass, is in
`reports/S-rollback/fixpass-pre/`.

### Per finding

| # | Verdict | What I did | Proof |
|---|---|---|---|
| **H1** launch15 fails QA at 9:16 | **fixed** | The `scale` shot is now `block: field`: the logo with your results flying out round it in three rings, and a camera `zoom` so the rings fill the frame. I didn't use the stack the monitor tried, because `stack` warns under 2.5 s (`! stack scale: 30 frames is tight … give it ≥ 2.5 s`) and the slot is 1 s. Today's wall builds up from an empty frame. Its id-seeded layout passed by luck in launch30, so a renamed shot could fail. launch30 keeps its wall after a drift exit, with a comment on the wall shot saying why. | launch15 `--film` 16x9 / 9x16 / 1x1: **QA PASSED (17 checks)** each. Content minimum 85 / 52 / 51 thumbnail px. launch30 `--film` 16x9 / 9x16 / 1x1: **QA PASSED (19 checks)** each. Content minimum 75 / 46 / 39 thumbnail px. |
| **H2** a failure line containing "wrong" became an instruction | **fixed** | `fail_line` keeps a line as written only when it is already a whole verdict, matched by `VERDICT`: "if/when …, the shot (take, frame, clip) is wrong", "…, it's wrong", or "the shot is wrong if …". Every other line gets "If …, the shot is wrong." | Old → new: `she grabs the wrong cup` gave "She grabs the wrong cup." and now gives "If she grabs the wrong cup, the shot is wrong."; `the band is the wrong colour` likewise. A verdict that was already written stays verbatim. New test **Q2j** checks 7 forms. |
| **M1** the click is 89 ms off the beat | **fixed** | `tap … at: 6`. The press now lands on the 6 s downbeat (a bar line at 120 BPM), and the result arrives on the drop at 6.5 s. | `timeline.json` cue: `(5.98933, 'click')`, 11 ms before the beat, within a frame. |
| **M2** the result held for 1.2 s, not 1.5 s | **fixed** | launch15 `result` now exits on `out: cut`. In launch30, `result` is 5 beats. | The mean pixel change over every 3rd frame drops below 1.3 at f417, and the float only bobs until the cut at f510: **1.55 s** (before: the drift exit started at f489, 1.2 s). launch30: settled at f537, drift starts at f639: **1.7 s**. |
| **M3** launch30 showed no product until 6.5 s | **fixed** | `feature` is now `block: media, device: browser`: the product screen in a browser window, under the feature line. It starts at 3.0 s because the hook is now 2 beats (0–1 s) and the title runs 1–3 s. | `--grid`: `feature media 0:03.00–0:06.00`. Storyboard and film frames: the line rises in word by word over the window. |
| **M4** the vague-word lint was silent on most shots | **fixed** | On a shot that uses none of the new fields, the same text now prints as an `i` line, which never changes the exit code. It stays a `!` warning on shots that use the new fields. | The Lull: 18 `i … vague words` lines; every non-`i` line and the exit code are the same as before. Q6c is updated. Q1b (which strips `i` lines) and P1b (which counts only `!` lines) pass. |
| **M5** P8 breaks once brief.md ships | **lead (not my file)**, patch tested | `test_parity.py` P8 needs 2 lines: run `apply_phase2_brief.py t` after `apply_pointers.py t`, and require `rc2 == 0 and out2.count('APPLIED') == 2`. P4 and P4b still need a V-relative fingerprint (the lead's round-1 files). | A copy of P8 with the patch, `reports/S-rollback/p8_patched.py` (logic quoted below): on stageS `PASS … 11 + 2 applied, 5/5 docs rebuilt exactly`; on base `FAIL … 4/5 (brief.md)`. |
| **M6** fixed prompt text sat too close to the cinedance source | **fixed** | I rewrote every flagged string in our own register (the strings are below). The worked example now runs on a different trick: a locked frame in which the crossing's countdown is the clock the runner races. The source has no such block. K02's trick is now a shadow's edge reaching the band. | An n-gram scan of everything I added against the source shows no shared 6-word runs except "what not to take from each/it", which is SPEC-S's own wording. The shared 4–5-word runs are generic ("never looks into the lens", "the shot is wrong" (SPEC-S), "of the frame width"). The sentence "Her reaction to the event…" no longer matches anything. |
| **M7** the `--kit` change left "Product" under `--title` | **fixed in the proposed patch** (lead applies it) | `reports/S-lvmjs-kit.patch`: `KIT_NAME` gives "Acme Notes 15 s launch" and "… 30 s launch". For the launch kits only, the `text: Product` name cards and `url: product.app` are replaced as well. | Applied to a scratchpad clone: `--init --kit launch15|launch30 --title "Acme Notes"` writes the name and `acme-notes.app` on every line, and `--grid` is clean. `--kit film` and `--kit reel` write files identical to the unpatched tool's. `patch -p1 --dry-run` on stageS's lv.mjs applies cleanly. |
| **M8** the CTA was the smallest text, and the end card was dead air | **fixed in the templates; the block sizes go to the lead** | The CTA now has its own shot, "Try it free.": a dark serif `type` card in launch15 and a `headline` in launch30. The end card is 4 beats (lockup + address). launch30's end card is dark, as a bookend. | Audit px: the CTA is now **232 / 190 / 213** (16x9 / 9x16 / 1x1); it was 44.3. Monitor's dead-air re-implementation on the end card: **1.80 s** (it was 3.78). Left for the lead: endcard `url` at 31 px and the float/split labels at 31–36 px are block sizes. B's 8/255 threshold also flags almost every settled hold of every existing block (headline, stat, type: 1.0–2.2 s runs, the same before and after); that is a calibration matter for B. |
| **L1** three refusals took two lines | **fixed** | A `ref` or `who` of the wrong type, and a size with only unknown keys, now give one line. | Q5 gains `refs-refnum`, `sizes-onlybadkey` and `acting-whonum-two`: 32/32 bad inputs are refused in exactly one line each. |
| **L2** "If When …" / "If Camera …" | **fixed** | A leading if / when / whenever / once is dropped. A capitalised first word is lowercased unless it names one of the spec's people, products or places. | Q2j: "If the band slides, …", "If camera shakes, …", "If Maya trips, …" (Maya is a person in the spec). |
| **L3** `acting: {}` was silent | **fixed** | It now warns: "acting: none of direction, motive, goal, obstacle, tactic or eyes, so it adds only the gaze line". | Q6j. |
| **L4** the H3 budget was unwarned, and the lead-in was long | **fixed** | The H3 lead-in is now "Rule of the shot: " (4 words, was 12). A trick that pushes the H3 prompt past 120 words warns with the count. | Q3e: a 4-sentence trick gives `the H3 prompt is N words, over its 120-word budget`. |
| **L5** an empty `dont` entry was dropped silently | **fixed** | It is refused like an empty `must` / `fail` entry, and the rest are kept. | Q5 `refs-dontempty`. |
| **L6** `apply_phase2_brief.py` defaulted to the live skill | **fixed** | The path is required. Without it the script prints usage and exits 2. | `apply_phase2_brief.py` → rc 2; `apply_phase2_brief.py /nonexistent` → rc 2. |
| **L7** the brief contradicted itself | **fixed** | The pacing bullet no longer repeats "one idea per 2–4 s". The starters now use exactly cut + drift + one signature, and the Transitions row says so. | Q8a: the brief is still rebuilt exactly from the rollback copy by both scripts, and it is insertions only (Q8d). |
| **L8** the word counts disagreed | **fixed** | The headers state `--grid`'s count: launch15 has 12 words (the typed prompt included; the card's 2 aren't counted), launch30 has 31, which is the cap. | Q9: launch15 12 words, cap 16; launch30 31, cap 31. |
| **L9** the click shot is weak | **partly** | Fixed: the press is on the beat (M1). The comment now says the card fills the panel within 0.1 s, and that the cursor covers part of the label because `tap` aims at the button's centre with no offset (ui.js). The `tap` purity bug (note 2) is also in ui.js. Round 1's `press` block replaces this shot, as the comment says. | Engine and block code are outside my files. |
| **L10** "Phase 2" in user docs | **fixed** | The section is now "One trick, unbreakable rules, failure lines, acting"; the table row and the block-order paragraph point to it. | `grep -n "hase 2" SHOTS.md` finds nothing. |
| **L11** Q1 depended on run order | **fixed** | A run with `PHASE2_SAVE_CORPUS=1` saves the 117 specs and their JSON neighbours to `qa/shots-skill-port/parity/phase2-corpus.json.gz` (37 KB). A run with too few specs in out/ unpacks that file instead. | I ran test_phase2.py alone, in a copy of the suite folder with an empty out/. It printed `(Q1: 117 specs from parity/phase2-corpus.json.gz …)`, then Q1 118 specs / 272 shots, Q1b 369 runs: 47/47 PASS. |
| **L12** the task info line is Seedance-only | **fixed (documented)** | SHOTS.md: "H3 can't carry a task, so H3 shots don't get it". | — |
| **L13** (a) a hand measure in a still life; (b) `first`; (c) claims | **fixed** | (a) A body or hand measure on a shot without people warns, and the 3-measure rule applies only to shots with people. K02 is now sized against the frame and the cup, and the text reads "The band: …" (not "three ways"). (b) `first` now prints "From it, let none of this carry on into the motion or build up: …", and SHOTS.md explains why. (c) `# your claim, as approved by legal` sits on "10×" and "120 films studied". | Q6k, Q3b, Q2g. |
| Notes 1–2 (wall determinism; the `tap` purity bug in ui.js) | **lead** | Engine code. L9 above is the visible part of note 2. | — |

**M6: the rewritten strings** (shots.py, the prompt text Claude adds):
- **Trick:** "Rule of the shot, and everything in it follows from this: … It follows that: …". On H3: "Rule of the shot: …".
- **Task:** "All through the shot, first frame to last, they keep at one ordinary job: … The event does not stop it and the camera does not feature it; whatever the event stirs in them stays smaller than this."
- **Acting:**
  - "Acting notes for …, an inner life that is never shown off to the camera; the thinking shows in the eyes first, and the face catches up."
  - Labels: "Direction (what they are after)", "Motive (why it matters now)", "Tactic (the visible part: how they get round it)".
- **Restrained:** "Keep it understated: the strong moments land in the hands, the breath and the footing, not in the face; …".
- **Gaze:** "… Head and eyes always turn the same way; the blinks keep no rhythm; the eyes keep working and never park on one point."
- **Sizes:** "…, sized three ways that must match: …". The vague-word warning's examples are now "5 % of the frame width, as wide as two fingers, knee-high".

### The starters after the fix

| | launch15 (9 shots, 30 beats) | launch30 (15 shots, 60 beats) |
|---|---|---|
| Order | hook 0–1 · name 1–3 (dark, zoom-through) · ask 3–5.5 · click 5.5–6.5 (press on 6.0) · result 6.5–8.5 (the drop) · scale 8.5–9.5 (`field`) · proof 9.5–11 · CTA 11–13 (dark type) · end card 13–15 | hook 0–1 · title 1–3 · feature 3–6 (the product in a browser frame) · action 6–8.5 · result 8.5–11 · inputs → output · before → after · punctuation · one (stack) · many (wall) · proof · summary · title again (dark) · CTA 26–28 · end card 28–30 (dark) |
| Transitions | cut + drift, plus the zoom-through | cut + drift, plus the zoom-through |
| `--grid` | rc 0, no warnings; stageB's `--grid` (B's reading formula) no warnings | the same |
| `--storyboard --aspect all` | no notes | no notes |
| `--film` 16x9 / 9x16 / 1x1 | QA PASSED (17) / (17) / (17) | QA PASSED (19) / (19) / (19) |

**What I'd still look at** (judged on the film frames; none of these fails a check):
- **The end card.** It is on screen for 2.0 s; its lockup lands in about 0.5 s and the address in 1.07 s. SPEC-S asks
  for "CTA + end card 11–15 s held ≥ 2 s": the CTA and the end card together fill 11–15 s, and the end card is
  readable for about 1.5–1.9 s of its 2 s. Making the CTA its own big shot cost the end card half its length. I judged
  a CTA you can read worth more than a longer still lockup.
- **launch30's feature shot at 9:16.** The browser frame is about 65 % of the width, with space above and below.
  `media` can't pick a device per aspect, so a phone frame for 9:16 would need a separate cut.
- **The `field` tiles in the scale shot are small** (about 50–90 px at 16:9, even with `zoom: 1.5`). It reads as a burst
  round the mark, not as legible results. Round 1's `fan` is the better block here, as the comment says.
- **The macro prompt bar is about 40 % of the width at 16:9** (unchanged from before). A `zoom` on `ask` would make it
  feel more like a close-up, but I didn't change what the monitor didn't flag.

Jobs: `qa/motion-kit/jobs/S-fix-launch15/`, `qa/motion-kit/jobs/S-fix-launch30/`. Their `beats.yaml` is the final template,
and the films are `launch-15-{16x9,9x16,1x1}.mp4` and `launch-30-*.mp4` beside it. Contact sheets: `reports/S-stills/fix-launch15-{16x9,9x16}-film-frames.png` and `fix-launch30-{16x9,9x16}-film-frames.png`.

**The two-line change for the lead** is now the patch `reports/S-lvmjs-kit.patch`, which replaces the snippet higher up:
- the header comment;
- `KITS` gains `launch15` and `launch30`;
- `KIT_NAME`;
- the `--kit` refusal message;
- the kit title;
- one line that, for the launch kits, sets their name cards and address.

**P8 for the lead** (`test_parity.py`, M5):
```python
rc2, out2 = run([PY, '-B', os.path.join(QA, 'apply_phase2_brief.py'), t])        # after apply_pointers.py
# and in the P8 check: rc == 0 and rc2 == 0 and len(rebuilt) == 5 and out.count('APPLIED') == 11 and out2.count('APPLIED') == 2
```

**GUIDE text, updated:**
- **The kit lines:** `--kit launch15` is "15 s at 120 BPM, 9 shots: hook · name · prompt · click · result (the drop) · scale · proof · call to action · end card". `--kit launch30` is "30 s at 120 BPM, 15 shots: the full arc, the product by 3 s, title bookends, the call to action said big".
- **One more Limits line:** today's `wall` builds up from an empty frame over about 0.4 s. In a short slot after a hard cut, its first frame can fail QA's content check, so put it after a moving exit.

### Commands run in this pass (results)

```text
# templates ($S = qa/motion-kit/stageS/product-launch-sting/video; jobs = template + placeholder SVGs)
node $S/lv.mjs --job jobs/S-fix-launch15 --grid                 → 9 shots, rc 0, no warnings
node $S/lv.mjs --job jobs/S-fix-launch30 --grid                 → 15 shots, rc 0, no warnings
node stageB/…/lv.mjs --job jobs/S-fix-bgrid{15,30} --grid       → no warnings under B's reading formula either
node $S/lv.mjs --job jobs/S-fix-<k> --storyboard --aspect all   → no notes (both)
jobs/S-fix-films.sh (one aspect at a time, --workers 2):
  launch15 16x9  QA PASSED (17 checks)  167 s   content min 85
  launch15 9x16  QA PASSED (17 checks)  149 s   content min 52    ← was QA FAILED (content @510)
  launch15 1x1   QA PASSED (17 checks)  161 s   content min 51
  launch30 16x9  QA PASSED (19 checks)  408 s   content min 75
  launch30 9x16  QA PASSED (19 checks)  371 s   content min 46
  launch30 1x1   QA PASSED (19 checks)  266 s   content min 39
after the last comment-only template edit: cp template → job beats.yaml; --qa --aspect each → all six QA PASSED again
timeline.json: click cue (5.98933 s) · audits.json: CTA 231.9 / 189.8 / 213.4 px · endcard url 31.0 px · Output 31.4–35.5 px
mon-S-logs/tools/deadair.py (read only): end card run 1.80 s (launch15 16x9) / 1.80 s (launch30 16x9), was 3.78 s

# shot writer
SHOTS_QA_VIDEO=$S bash qa/shots-skill-port/run_all.sh   (reports/S-rollback/run_all-fixpass.log)
  QA 1 parity 14/17 (FAIL P4, P4b, P8: the same three as before this pass, none in my files) · QA 2 48/48 · QA 2b 16/16
  QA 3 57/57 · QA 4 90/90 · QA 5 phase 2 47/47 · P1 20/20 Lull prompts byte for byte · P1b warnings unchanged
PHASE2_SAVE_CORPUS=1 … test_phase2.py                    → 47/47, wrote parity/phase2-corpus.json.gz (37 KB)
test_phase2.py alone, in a copy of the suite dir with no out/ → "(Q1: 117 specs from parity/phase2-corpus.json.gz …)", 47/47
reports/S-rollback/p8_patched.py <stageS> → PASS P8 (patched): 11 + 2 applied, 5/5 · <base> → FAIL 4/5 (brief.md)
The Lull check, new vs pre-fix shots.py: every non-"i" line identical, same exit code; 18 new "i … vague words" lines
n-gram scan of everything added vs the cinedance SKILL.md (read only): 6-word runs shared: "what not to take from each/it"
  (SPEC-S's own words); 5-word: "a number or a comparison", "at any point in the", "never looks into the lens"

# kit patch (scratchpad clone of stageS; stageS's lv.mjs untouched, cmp-verified)
--init --kit launch15|launch30 --title "Acme Notes" → title "Acme Notes 15 s launch" / "… 30 s launch", text: Acme Notes,
  url: acme-notes.app, 5 / 7 placeholders, --grid clean · --kit launch20 → refused · --kit film / reel: identical files
  to the unpatched tool · patch -p1 --dry-run on stageS's lv.mjs: applies

# hygiene
diff -rq base stageS → the same 6 paths as before (SHOTS.md, shots.py, brief.md + 3 new files)
shasum -c live-before.sha1 in ~/.claude/skills/product-launch-sting → 867 OK, 0 failed
stageS manifest after the pass: reports/S-rollback/stageS-postfix.sha1 (119 files)
```

### Files changed in this pass

All inside my file list. stageS against base still differs in exactly the same six paths: `SHOTS.md`,
`shots/shots.py`, `templates/brief.md`, plus the new files `shots/examples/phase2-band-shots.json`,
`templates/launch15.yaml` and `templates/launch30.yaml`.
- **`shots/shots.py`:** `VERDICT` / `COND` / `fail_line(x, names)`; `names()`; `trick_text(short)`; reworded task / acting / gaze / size / `first` text; one-line refusals for `ref`, `who` and unknown size keys; empty `dont`; `lint2`: vague words as `i` lines on other shots, empty acting, body or hand sizes without people, the H3 budget.
- **`SHOTS.md`:** the renamed section; the new example, its spec and compiled lines; the checks.
- **`phase2-band-shots.json`:** the new K01 and K02.
- **Templates:** `brief.md` (rebuilt by the scripts); `launch15.yaml` and `launch30.yaml`.
- **Under `qa/shots-skill-port/`:** `test_phase2.py` (Q2j, Q3e, Q6j, Q6k, four Q5 cases, the corpus fallback, updated expectations); `apply_phase2_brief.py` (path required, pacing line, Transitions row); the new `parity/phase2-corpus.json.gz`.
- **Under `reports/`:** the new `S-lvmjs-kit.patch`.
