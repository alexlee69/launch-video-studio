# Monitor S · verify pass on Worker S's fix pass (2026-10-26, overnight)

Contract: `SPEC-R1.md` (hard rules) + `SPEC-S.md`. Findings checked: `reports/S-monitor.md` (2 HIGH · 8 MEDIUM · 13 LOW).
Worker's notes: "Fix pass" in `reports/S-build.md`. Copy: `qa/motion-kit/stageS/product-launch-sting` (`$S`). I re-ran
every finding and the whole done-criteria list myself, from fresh copies of the templates; nothing below is taken from
S-build.md on trust. My jobs: `qa/motion-kit/jobs/ver-S-*`. Logs and stills: `qa/motion-kit/jobs/ver-S-logs/`.

**Verdict: 22 FIXED · 1 DISPUTED-WORKER-RIGHT · 0 NOT FIXED · 0 DISPUTED-WORKER-WRONG.** Both starters now pass film
QA in all six renders, and the shot writer's old prompts are still byte-identical. Two caveats:
- **M5 and M7 count as fixed because they are tested patches for the lead**, which is what the findings asked for.
  `run_all.sh` on stageS still ends `SOME SUITES FAILED` (P4, P4b, P8) until the lead applies the P8 patch and
  re-fingerprints P4/P4b.
- **The fix pass introduced two new problems.** I fixed one myself (N2: the new worked example contradicted itself).
  The other one (N1: the CTA card's line wrap jumps on 9:16 and 1:1) is in `type.js`, which is engine code and not
  Worker S's file, so it stays open for the lead.

## Hygiene

| Check | Result |
|---|---|
| Live skill untouched | `shasum -c live-before.sha1` in `~/.claude/skills/product-launch-sting`: **867 OK, 0 failed**. I checked it after every run, including parity P9, which runs the storyboard suite against live paths (read only). |
| stageS matched the worker's post-fix manifest when I started | `shasum -c reports/S-rollback/stageS-postfix.sha1`: 119/119 OK, and no file was newer than it. |
| File ownership | `diff -rq base stageS`: the same 6 paths as before (`SHOTS.md`, `shots/shots.py`, `templates/brief.md`, plus new `shots/examples/phase2-band-shots.json`, `templates/launch15.yaml`, `templates/launch30.yaml`). `lv.mjs`, `lib/` and `engine/` are byte-identical to base, so nothing Worker S did can change how an old job renders. |
| My edits | Inside Worker S's files only (listed under N2). Rollback copies: `reports/S-verify-rollback/`. stageS manifests before and after my edits: `jobs/ver-S-logs/stageS-pre-verify.sha1` and `stageS-post-verify.sha1` (3 files differ). |
| No commits, pushes, paid calls or `--go` | None. I never ran `lv.mjs --job` on an original job. I ran nothing under `qa/video-skill-learnings/skills/` (I only read the cinedance SKILL.md for the n-gram scan). |

## Per finding

| # | Verdict | How I reproduced it |
|---|---|---|
| **H1** launch15 failed QA at 9:16 | **FIXED** | Fresh job = template + the 7 placeholder SVGs (`jobs/ver-S-launch15`, `ver-S-launch30`), `--film --aspect A --workers 2`, one aspect at a time: launch15 **9x16 QA PASSED (17)**, content minimum 52 (frame 510 failed before); 16x9 and 1x1 QA PASSED (17). launch30: 9x16, 1x1 and 16x9 QA PASSED (19). By eye: frame 510 is now the logo with the first tiles flying out, a strong first frame (`ver-S-logs/l15-9x16-keyframes.png`). Remaining: launch30's `many` wall still opens on one faint card at 1:1 (frames 1140–1146, `ver-S-logs/l30-1x1-one-many.png`). It reads as a brief flash to white between the dark stack and the wall, but it passes the content check comfortably (minimum 39 against a threshold of 3). This is the wall block's own build-up, and the template's comment says so. |
| **H2** a fail line containing "wrong" became an instruction | **FIXED** | `jobs/ver-S-shots/sem.py`: "she grabs the wrong cup" now gives `If she grabs the wrong cup, the shot is wrong.`, and "the band is the wrong colour" is framed the same way. Extra probes (`extra.py`): "she turns the wrong way" and "The runner looks wrong" are framed too, and the three verdict forms ("If she stops, the shot is wrong.", "the shot is wrong if …", "when she slows, it's wrong") stay as written. A small leftover is logged as N4 (LOW). |
| **M1** the click was 89 ms off the beat | **FIXED** | `out/main/timeline.json`: the click cue is at **5.98933 s**, 11 ms before the 6 s downbeat (a bar line at 120 BPM). |
| **M2** the result held for 1.2 s | **FIXED** | `ver-S-logs/hold.py` (mean \|Δ\| every 3rd frame, 9x16): the card settles at f414 (6.9 s) and holds, with movement ≤ 0.7, until the hard cut at f510: **1.6 s**. |
| **M3** launch30 showed no product until 6.5 s | **FIXED** | `--grid`: `feature media 0:03.00–0:06.00`. The browser frame with the product screen is in frame 180, the first frame at 3.0 s, in all three aspects. This meets "the product by 3 s" exactly on the boundary. At 9:16 the browser is about 60 % of the width, with empty space above and below, as the worker says. |
| **M4** the vague-word lint was silent on most shots | **FIXED** | The Lull, base vs stageS `shots.py check`: **18 `i … vague words` lines**, every non-`i` line identical, exit code 1 in both (`jobs/ver-S-shots/lull-*.txt`). On the real shots-demo spec, `check`, `build` and `shots/` are identical apart from the existing task `i` line. P1 20/20 and P1b pass. |
| **M5** P8 breaks once brief.md ships | **FIXED** (tested lead patch) | `reports/S-rollback/p8_patched.py`: stageS gives `PASS … 11 + 2 applied, 5/5`; base gives `FAIL … 4/5 (brief.md)`, as it should. A second run of `apply_phase2_brief.py` gives 2 SKIP. The tree's `run_all.sh` still fails P4, P4b and P8, the same three as before Worker S started. |
| **M6** prompt text too close to the cinedance source | **FIXED** (I fixed one residue) | I ran the n-gram scan over every line Worker S added (`ver-S-logs/added.txt`, 8.8k words) against the source SKILL.md (read only). There are no 8-word runs. The only 6-word runs are SPEC-S's own "what not to take from each/it", and the 5-word runs are generic ("never looks into the lens", "a number or a comparison", "at any point in the"). `grep` finds none of the flagged phrases ("fixed stare", "short arm", "clamped", "twentieth" …). The new countdown example has no counterpart in the source. **Residue:** SHOTS.md:192 still said "(what we see is the tactic)", the doc copy of the label M6 flagged. I reworded it to "(only the tactic shows on screen)". |
| **M7** `--kit` left "Product" under `--title` | **FIXED** (tested lead patch) | I applied `reports/S-lvmjs-kit.patch` to a throwaway clone (`jobs/ver-S-kitclone`). `--init --kit launch15\|launch30 --title "Acme Notes"` gives `title: Acme Notes 15 s launch` / `30 s launch`, and every `text: Product` and `url: product.app` line (2 + 2 in launch30) becomes the name and `acme-notes.app`. It copies 5 / 7 placeholders, and `--grid` is rc 0 with no warnings. A title with a colon is quoted (`"Acme: Notes"`). `--kit film`, `--kit reel` and no kit write files identical to the unpatched tool. `--kit launch20` gives rc 2 with the new message. `patch --dry-run` applies cleanly to stageA, stageB, stageC and stageD's `lv.mjs`, so it should survive the round-1 merge. |
| **M8** the CTA was the smallest text; end-card dead air | **FIXED** (template part; block sizes stay with the lead) | audits.json: launch15's CTA is **231.9 / 189.8 px** (16x9 / 9x16; the worker's 1x1 figure was 213), and launch30's headline CTA is 106 / 110 px (9x16 / 1x1). Still at block size, for the lead: endcard `url` 31.0 px; `Output`, `Input`, `Before` and `After` 31–36 px; and launch30's `120 films studied` pill at 30.6 px as `.lv-ui` (see N3). Dead-air estimate (the monitor's tool): the end card's still run is **1.80 s** (16x9) and **1.87 s** (9x16), against a reading need of about 1.6 s under B's formula. So B's check will probably still WARN there once it merges, as the worker predicts. The new CTA card also brought N1. |
| **L1** three refusals took two lines | **FIXED** | `adv.py` (33 cases): `refs-refnum`, `sizes-onlybadkey` and `acting-whonum-two` now give one line each. `sizes-allnum` gives two lines, but those are two separate wrong-type fields, which is correct. |
| **L2** "If When …" / "If Camera …" | **FIXED** | "If the band slides, …", "If camera shakes, …", and "If Maya trips, …" (Maya is a person in the spec, so she keeps her capital). "Whenever the cyclist stops" gives "If the cyclist stops, …". |
| **L3** `acting: {}` was silent | **FIXED** | It now warns "acting: none of direction, motive, goal, obstacle, tactic or eyes, so it adds only the gaze line". |
| **L4** H3 budget unwarned; long lead-in | **FIXED** | A 70-word trick gives a 129-word prompt, and it warns `the H3 prompt is 129 words, over its 120-word budget`. The lead-in is now "Rule of the shot: ". |
| **L5** an empty `dont` was dropped silently | **FIXED** | `dont: ["x", ""]` gives `✗ … each entry is a thing not to take, in words (an empty one was given)`, rc 2. |
| **L6** `apply_phase2_brief.py` defaulted to live | **FIXED** | With no argument, or `/nonexistent`, it prints usage and exits rc 2. |
| **L7** the brief contradicted itself | **FIXED** | "2–4 s" appears once (the Length line). The Transitions row reads "the starters: hard cuts and drifts, plus a zoom-through", and both templates use exactly cut + drift-up/left + `through: true`. |
| **L8** header word counts | **FIXED** | `--grid`'s on-screen column: launch15 has 12 words, launch30 has 31, matching both headers. |
| **L9** the click shot is weak | **DISPUTED-WORKER-RIGHT** | The worker fixed what the template can fix: the press lands on the beat (M1), and the comment is honest. `ui.js` has no tap offset: `tap:` takes only a label (`--blocks panel`; ui.js:187 aims at the button's centre). So the cursor covering "Generate" (`ver-S-logs/l15-16x9-click-frames.png`) and the tap purity bug can only be fixed in the engine or by the round-1 `press` block. The empty card at the cut lasts 1 frame at 60 fps (f330), and the card is filled by f336. |
| **L10** "Phase 2" in user docs | **FIXED** | No "Phase 2" heading or row is left in SHOTS.md. The example's file name `phase2-band-shots.json` and some code comments still say it; that is harmless. |
| **L11** Q1 depended on run order | **FIXED** | I copied the suite folder without `out/` to the scratchpad and ran `test_phase2.py` alone: `(Q1: 117 specs from parity/phase2-corpus.json.gz …)`, 47/47 PASS (`ver-S-logs/test_phase2-isolated.log`). |
| **L12** the task info line is Seedance-only | **FIXED** (documented) | SHOTS.md: "H3 can't carry a task, so H3 shots don't get it". |
| **L13** (a) hand size in a still life · (b) `first` · (c) claims | **FIXED** | (a) A `hand` measure on K02 warns "no people in this shot, so "hand" may draw a hand into it". (b) REFERENCES reads "From it, let none of this carry on into the motion or build up: …". (c) `# your claim, as approved by legal` sits on `10×` (both templates) and on `120 films studied`. |
| Notes 1–2 (wall determinism; `tap` purity in ui.js) | not re-tested | These are engine issues for the lead, outside Worker S's diff. |

## Done criteria, re-run

| Criterion (SPEC-S) | Result |
|---|---|
| Parity + all shot-writer suites on stageS | `SHOTS_QA_VIDEO=$S/video bash run_all.sh`, before my edits and after them, gives the same result both times: QA 1 parity 14/17 (P4, P4b, P8, all lead), QA 2 48/48, QA 2b 16/16, QA 3 57/57, QA 4 90/90, **QA 5 47/47**. P1 The Lull: 20/20 H3 prompts byte for byte. P1b: only the two camera-move warnings. Logs: `ver-S-logs/run_all-verify.log`, `run_all-after-edit.log`, `suite-logs*/`. |
| New tests prove each field, bad types, old shots byte-identical, negatives held until confirmed | test_phase2's Q1–Q9 all pass. My own probes agree: `adv.py` (33 bad inputs), `sem.py`, `extra.py`. Confirmed negatives reach LOCKS, and proposed ones stay out of both prompts. |
| Old shots byte-identical | Q1: 118 specs / 272 shots. Q1b: 369 runs. Q1c: The Lull's 42 files. The real shots-demo spec through base vs stageS (after my edit too): `check` and `build` are identical apart from one `i` line, and `shots/` is identical. |
| Brief: passport (12 rows), trigger map, pacing targets | Present, in the template's style, with §6 and §7 numbered after §5. Q8 rebuilds the brief exactly from the rollback copy plus both scripts, and the second run gives 2 SKIP. |
| Skeletons `--grid` / `--storyboard` | Both are rc 0 with no warnings. Worker B's `lv.mjs --grid` (B's reading formula) on copies of my jobs also gives no warnings. `--storyboard --aspect all`: 3 boards each, no notes (`jobs/ver-S-launch30/launch-30-storyboard-16x9.png` looks clean). |
| Skeletons `--film` (beyond the spec, since they declare 3 aspects) | 6/6 QA PASSED (above). Render times at `--workers 2`, Mac load 16–88: 108–810 s. |
| Skeleton shape | launch15: 9 shots, 30 beats, 12 words; hook with no words; name at 1 s; a 22-character prompt; the click on 6.0 s; the result 1.6 s still; proof; CTA; end card 2 s. launch30: 15 shots in the specified order, 31 words; the drop defaults to the title (`audio.mjs:78`, `shots[1]`), so the "drops on the title" comment is true. The `# round 1:` comments name real fields in Worker A's stageA (`press label/after`, `particles mode: burst`, `fan`, `wall layout: grid`). |

## New findings

**N1 · MEDIUM, open (engine: lead).** launch15's CTA card ("Try it free.", `block: type`, serif) jumps between lines
on 9:16 and 1:1.
- **What happens.** On the shot's first ~6 frames at 60 fps (f660–665), the text sits on two lines, "Try it / free.".
  Then it snaps to one line and moves up about 18 px.
- **Where it shows.** It happens while the text is still blurred and fading in, so it is hard to see at speed, but it
  is plain frame by frame. 16:9 doesn't wrap. Frames: `ver-S-logs/l15-1x1-cta-entrance.png`,
  `l15-9x16-cta-entrance.png`.
- **Cause.** `engine/blocks/type.js:74-76` clamps the opening tracking by `glyphW()`, which is a range-rect width. That
  width never exceeds the safe width once the line wraps, so the clamp can't see the wrap. The fix pass made the CTA a
  `type` card (for M8), and that is what exposed it.
- **Engine fix (lead).** In the clamp loop, also require the head to stay one line when its final layout is one line
  (`head.offsetHeight <= hh * 1.2`), or set `white-space: nowrap` in that case.
- **Template workarounds I tested** (`jobs/ver-S-cta-*`, `ver-S-logs/cta-variants-1x1.png`):
  - No-break spaces don't stop the wrap.
  - `text: "Try it|free."` is stable, but sets a two-line lockup at about 118 px, which loses the bookend scale with
    the name card.
  - A `headline` CTA (as in launch30) doesn't wrap.
- I left the template as it is: the right fix is in the engine, and the workarounds are design trade-offs for Alex or
  the lead.

**N2 · MEDIUM, FIXED by me.** The fix pass's new worked example (written for M6) compiled to a prompt that
contradicted itself, in the doc that teaches the fields.
- **The contradictions:**
  - `count: 1` prints "Exactly one person is visible in this shot", but the obstacle was a cyclist drifting into her
    line.
  - `shots.py`'s size sentence printed "Nothing grows or shrinks at any point in the shot." right beside the trick's
    "She grows from a small figure … to the full frame height at the kerb". That sentence would also contradict any
    approaching subject.
  - K02's beat had a window-frame shadow "sweep … as a cloud passes" (a passing cloud dims a shadow; it doesn't sweep
    it).
- **The fix (all inside Worker S's files):**
  - `shots.py` `size_text`: "Nothing changes its real size during the shot: only its distance from the lens makes it
    look bigger or smaller." This only touches shots that use `sizes`, a new field.
  - `phase2-band-shots.json`: the obstacle is now "a wide puddle lies across her line halfway over". The tactic
    "…round it", the eye beat, beat 2 and the 4th audio line ("the hiss of tyres on the far lanes") follow from that.
    K02 reads "The shadow's edge sweeps slowly across the desk toward the band".
  - `SHOTS.md`: the spec excerpt, the two compiled lines, and the sizes row's wording.
  - `test_phase2.py` Q2f/Q2h: the size sentence's new wording.
- **Proof.**
  - test_phase2 47/47, both in the full run and isolated.
  - The full `run_all.sh` is unchanged (P1 20/20, P1b).
  - `adv.py`, `sem.py` and `extra.py` outputs are identical before and after.
  - The real old spec is byte-identical.
  - `show K01` diff: `ver-S-logs/show-example.txt` → `show-example-after.txt`.
- **Rollback:** `reports/S-verify-rollback/`.

**N3 · LOW, open (template, Worker S or lead).** launch30's `one` shot puts a claim ("120 films studied", marked
"your claim, as approved by legal") in the stack's status pill.
- The pill renders as `.lv-ui` at 30.6 px, so it is exempt from the text checks.
- SPEC-R1 rule 5 allows UI texture only "when it isn't the message", and a legal claim is the message.
- Fix: move the claim into a `headline` or `stat` shot, or keep the pill as UI texture without a claim.

**N4 · LOW, open (`shots.py` `VERDICT`).** A condition that only contains "the frame / the clip … is wrong" is kept as
written, with no verdict.
- `fail: ["if the light in the frame is wrong"]` prints "If the light in the frame is wrong." in LOCKS
  (`jobs/ver-S-shots/verdict.py`).
- It is not an inverted instruction like H2, just a dangling condition.
- Fix: for the if/when form, accept the frame/clip nouns only after a comma (`…, the frame is wrong`), as the
  docstring already describes.

## Still open (none of it blocks the merge)

- **Lead, at merge:** apply `reports/S-lvmjs-kit.patch` (M7) and the P8 two-liner (M5); make P4/P4b staging-aware.
- **Lead, engine:**
  - N1 (`type.js` tracking clamp);
  - endcard `url` and float/split label sizes (M8);
  - `tap` aim offset and purity (L9, Note 2);
  - wall determinism (Note 1).
- **Worker S or lead, small:** N3 (the claim in a UI pill), N4 (the `VERDICT` comma rule).
- **Worker B calibration:** the end card's 1.8 s still run and the 0.72 s placeholder-still hook would likely WARN
  under the dead-air check. These are placeholders and a lockup hold, so it is a calibration question, not a template
  bug.

## Stills and logs for the lead

- Film contact sheets:
  - `jobs/ver-S-logs/l15-{16x9,9x16,1x1}-sheet.png`, `l30-{9x16,1x1}-sheet.png`;
  - key frames: `l15-9x16-keyframes.png`;
  - the click: `l15-16x9-click-frames.png`;
  - the wall's start: `l30-1x1-one-many.png`;
  - the CTA wrap: `l15-{1x1,9x16,16x9}-cta-entrance.png`, `cta-variants-1x1.png`.
- Films: `jobs/ver-S-launch15/launch-15-{16x9,9x16,1x1}.mp4`, `jobs/ver-S-launch30/launch-30-{16x9,9x16,1x1}.mp4`.
  Storyboards are beside them.
- Logs: `jobs/ver-S-logs/<kit>-film-<aspect>.log`, `films.done`, `run_all-verify.log`, `run_all-after-edit.log`,
  `adv*.log`, `sem*.log`, `extra*.log`, `test_phase2-isolated.log`.

**Asks:**
1. Lead: apply the kit patch and the P8 two-liner at merge, then re-run `run_all.sh` on the merged tree.
2. Lead: fix the `type.js` wrap clamp (N1) before the starters ship, or swap launch15's CTA to `headline`.
3. Alex: look at the corrected worked example in SHOTS.md (the puddle replaces the cyclist), since it's the doc that
   teaches the new fields.
