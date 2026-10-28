# Monitor S · independent check of Worker S (shot writer phase 2, brief passport, 15 s / 30 s skeletons)

2026-10-26, overnight. Contract: `SPEC-R1.md` (hard rules) + `SPEC-S.md`. Built copy: `qa/motion-kit/stageS/product-launch-sting`
(`$S`), baseline `qa/motion-kit/base/product-launch-sting`. Everything below was re-run by me; nothing taken from
`S-build.md` on trust. My jobs and logs: `qa/motion-kit/jobs/mon-S-*` (logs in `jobs/mon-S-logs/`). I edited none of
Worker S's files; the live skill is byte-identical before and after my runs (867/867, `jobs/mon-S-logs/live-pre-monitor.sha1`),
and stageS still matches Worker S's `reports/S-rollback/stageS-post.sha1` (119/119). Relative paths are under `qa/motion-kit/`;
`$S` = `qa/motion-kit/stageS/product-launch-sting`.

**Counts: 2 HIGH · 8 MEDIUM · 13 LOW** (+ 2 notes for the lead, outside Worker S's scope).

**Verdict.** The shot-writer code is careful and old prompts really are byte-identical. But one starter fails film QA
as shipped, and one helper can silently turn a failure line into an instruction. Fix both HIGHs before the merge. The
MEDIUMs are mostly template timing claims that don't hold, and wording that sits too close to the cinedance source.

## What I verified (met / not met)

| Requirement | Result | Evidence |
|---|---|---|
| File ownership | **met** | `diff -rq -x node_modules base/… stageS/…`: only `video/SHOTS.md`, `video/shots/shots.py`, `video/templates/brief.md`, plus new `shots/examples/phase2-band-shots.json`, `templates/launch15.yaml`, `templates/launch30.yaml`. Under `qa/shots-skill-port/`: new `test_phase2.py`, `apply_phase2_brief.py` and `rollback/*.pre-phase2`, and one line in `run_all.sh` (diffed against `reports/S-rollback/run_all.sh.pre-phase2`). Nothing in `lv.mjs`, `lib/`, `engine/`, `recipes.json` or `starter.json`. |
| Live skill / originals untouched | **met** | `shasum -c live-before.sha1` gives 867 OK, before and after my runs. |
| Old prompts byte-identical | **met** | I ran `run_all.sh` myself: Q1 118 specs / 272 shots same, Q1b 369 check/show runs same, Q1c Lull 42 files same, P1 20/20 Lull H3 prompts byte for byte, P1b warnings unchanged. Separately, the real `~/Downloads/launch-videos/shots-demo` spec (copied) through base vs stageS `shots.py`: `check` and `build` output identical apart from one new `i` line, `shots/` files identical, `show S01–S03` identical. |
| Full suites on stageS | **not met** (see M5) | `SHOTS_QA_VIDEO=$S/video bash qa/shots-skill-port/run_all.sh` → QA1 parity 14/17 (P4, P4b, P8 FAIL), QA2 48/48, QA2b 16/16, QA3 57/57, QA4 90/90, QA5 43/43; `SOME SUITES FAILED`. Same as the worker's after-log. |
| New fields render where they belong | **met** | `show K01/K02` on the worked example (`jobs/mon-S-shots/cases/show-example`). The order matches SHOTS.md. |
| Negatives out of prompts until confirmed | **met** | Proposed: absent from both prompts, and build refuses. Unlisted: absent, with a warning. Confirmed: in LOCKS (`sem-neg-confirm`). |
| Bad input → one clear line | **mostly** (L1) | 33 extra malformed cases of my own (`jobs/mon-S-shots/adv.py`): 30 give exactly one line; 3 give two lines. |
| Cinedance not copied verbatim | **mostly** (M6) | No shared run of 5+ words beyond generic phrases (n-gram scan). But there are close paraphrases, and one exact 4-word phrase in built-in prompt text. |
| Brief: passport (12 rows), trigger map, pacing targets | **met** | `templates/brief.md` §6/§7 and the pacing bullet; `apply_phase2_brief.py` is idempotent. |
| Skeletons `--grid` / `--storyboard --aspect all` | **met** | Both: grid rc 0, no warnings; storyboards for all 3 aspects with no notes. |
| Skeletons `--film`, all three aspects (template declares all three) | **not met** (H1) | launch15: 16x9 PASSED(15), 1x1 PASSED(15), **9x16 FAILED(1)**. launch30: 16x9 PASSED(18), 9x16 PASSED(18), 1x1 PASSED(18). |
| Regressions on old jobs | **met** (nothing in S's diff reaches the renderer) | Storyboard of a `film-sample` clone, live vs stageS: 12/13 hero PNGs byte-identical. The 13th (`10-wall.png`, max Δ3) also differs between two live runs, so the live engine itself isn't deterministic there (Note 1). |
| Purity (fresh page, other order) | **not met, but pre-existing engine bug** (Note 2) | `--film --aspect 16x9 --range 320,420` on fresh pages (launch15) against the full-film frames: 100/101 byte-identical. Frame 371 (the click's cursor) differs in 2,582 px, max Δ238 (`jobs/mon-S-logs/purity-371-full-vs-range.png`). The cause is `engine/ui.js` (identical to live), not Worker S's files. |
| Performance | **met** | `shots.py check` on the example takes about 0.1 s. Films at `--workers 2` under load 20–118: 153–593 s per aspect. |
| Diff hygiene | **met, with notes** | shots.py +372/−9, local (constants, `typed()` +2 types, `_phase2`, text helpers, 3 insertion points, `lint2`, report/show). It merges cleanly: no other worker owns these files. "Phase 2" roadmap naming leaks into user docs (L10). |

## Findings

### HIGH

**H1 · launch15 fails film QA at 9:16 as shipped.** `video/templates/launch15.yaml:74-78` (the `scale` wall shot after
`result`'s `out: drift-up`, lines 66-71).
- The template declares `aspects: [16x9, 9x16, 1x1]` and says "It runs as is". But `--film --aspect 9x16` →
  `FAIL content near-empty frames (look like the bare background): 510` → `QA FAILED (1)`.
- Frame 510 is the wall's first frame. At 9:16 its cards are still blurred and faint, and the result card has just
  drifted out. Contact sheet: `jobs/mon-S-logs/launch15-9x16-sheet.png`, frame 510.
- I reproduced it in isolation: a 3-shot job float → wall → stat at 9x16 fails on the wall's first frame
  (`jobs/mon-S-wallfix-a`). The same job with the scale shot as `block: stack, count: 8` passes, `QA PASSED (11 checks)`
  (`jobs/mon-S-wallfix-b`).
- launch30 has the same hole without failing: its `many` wall opens on a near-blank frame at 1:1 (frame 1140, one
  faint card). It squeaks past the content threshold; strip in `jobs/mon-S-logs/launch30-1x1-many-cut.png`.
- Worker S only filmed 16:9 (their open issue 4).
- Repro:
  `node $S/video/lv.mjs --job qa/motion-kit/jobs/mon-S-launch15 --film --aspect 9x16 --workers 2`
  (the job = the template + the 5 placeholder SVGs as `assets/placeholder-*.svg`).
- Fix: make `scale` a `block: stack` (`count: 8`, same cards; the `# round 1:` comment can stay pointing at
  `wall layout: grid` / `fan`), or start the wall from a populated frame. Then re-film all three aspects.

**H2 · A failure line that contains "wrong" is printed as a plain statement, so LOCKS tells the model to do the
failure.** `video/shots/shots.py:263-264` (`fail_line`: `if re.search(r'\bwrong\b', x, re.I): return end(cap(x))`).
- The test for "already says wrong" matches the word anywhere. A failure condition that names a wrong thing loses its
  "If …, the shot is wrong" frame:
  - `fail: ["she grabs the wrong cup", "the band is the wrong colour"]` → LOCKS reads
    `She grabs the wrong cup. … The band is the wrong colour.`
  - That is an instruction to the paid video model to produce exactly the failure, with no warning.
- Plausible inputs: continuity failure lines naturally say "wrong wrist", "wrong side", "wrong hand".
- Repro: `cd qa/motion-kit/jobs/mon-S-shots && /usr/bin/python3 -B sem.py` (section "fail lines"), or put that `fail`
  on K01 of `shots/examples/phase2-band-shots.json` and run `shots.py show K01`.
- Fix: keep a line verbatim only when it already ends with the verdict, e.g.
  `re.search(r'\b(the )?shot is wrong[.!]?$|\bis wrong[.!]?$', x, re.I)`. Otherwise always wrap it in
  `If …, the shot is wrong.` Add the two lines above to test_phase2 Q2e.

### MEDIUM

**M1 · The click doesn't land on a beat.** `video/templates/launch15.yaml:61-62` (`tap: Generate`, `at: 9`).
- SPEC-S asks for "the click 5.5–6.5 s on the strongest beat".
- The press cue lands at 6.089 s (`out/main/timeline.json` cues: `{'t': 6.08933, 'kind': 'click'}`).
- That is 89 ms after the 6.0 s beat. It isn't on any 8th of the intro arpeggio (6.0 / 6.25) and is 0.41 s before the
  drop (6.5 s). So the click SFX flams against the music.
- Repro: `node $S/video/lv.mjs --job jobs/mon-S-launch15 --grid`, then read `out/main/timeline.json` cues 5–7 s.
- Fix: `at: 6`. The press is `t0 + 0.62·14` (ui.js `TAP_AT`), which lands at 5.99 s. Or move `drop: click` and land
  the press on the drop. Re-check that the cut to `result` still reads.

**M2 · The result holds still for about 1.2 s, not 1.5 s.** `video/templates/launch15.yaml:66-71` and
`launch30.yaml` `result`.
- SPEC-S: "result 6.5–8.5 s (reveal + hold ≥ 1.5 s)". The comments say "stays readable for 1.5 s".
- Measured on the 9:16 and the 16:9 frames, with the same result (mean |Δ| per 3 frames): the card settles at about frame 417 (6.95 s), and the
  `drift-up` exit starts moving at frame 489 (8.15 s). That is a still hold of about 1.2 s; the exit eats about 0.35 s.
- Repro: a PIL loop (mean |Δ| of 192×108 grey frames, every 3rd frame) over
  `jobs/mon-S-launch15/out/main/16x9/frames/00390–00510.png`.
- Fix: `out: cut` on `result` (the next shot's entrance carries the energy), or give `result` 5 beats and take one from
  the end card (it holds 3.8 s, see M8).

**M3 · launch30 shows no product until 6.5 s.** `video/templates/launch30.yaml:1-3` (claim) vs `:45-49` (`feature` is a
bare `headline`).
- The header says "The brief's pacing targets are built in: … the product by 3 s".
- The first product picture (the prompt bar) arrives at 6.5 s (`action`). 0–6.5 s is a placeholder clip, the name and
  a sentence.
- Repro: `node $S/video/lv.mjs --job jobs/mon-S-launch30 --grid` (shot table).
- Fix: show the product in `feature` (e.g. a `scene` with the bar/UI and the line as its headline, or `panel` with a
  card), or move `action` before `feature`. Otherwise drop the claim from the header.

**M4 · The vague-word lint stays silent on almost every real shot.** `video/shots/shots.py:1241` (`if not self.uses2:
return`, before the lint).
- SPEC-S: vague words in Alex-facing prompt text → a warning. The lint runs only on shots that use a phase-2 field.
- So The Lull's own 20 "slightly" and 10 "very", and every new spec written without phase-2 fields, never hear about
  it (test Q6c asserts this).
- The parity reason is real: P1b checks `!` lines. But an `i` info line wouldn't break P1b or Q1b, since Q1b strips
  `i` lines.
- Repro: `shots.py check` on any old spec containing "very" → no lint.
- Fix: on shots without phase-2 fields, emit the same text as an `i` line (no exit-code change). Keep it a `!` warning
  on phase-2 shots. Update Q6c.

**M5 · "All suites pass" isn't met, and live's parity will break at merge.** `qa/shots-skill-port/test_parity.py:119-130`
(P8; Worker S may not edit it).
- `run_all.sh` on stageS ends `SOME SUITES FAILED` (P4, P4b, P8).
- P4/P4b are the lead's stubs and live-path fingerprints, not Worker S.
- P8 fails because `brief.md` changed on purpose. Once `brief.md` ships, P8 fails on live too, unless the lead adds
  `apply_phase2_brief.py` after `apply_pointers.py` in P8 (as test_phase2 Q8 does).
- Repro: `SHOTS_QA_VIDEO=$S/video bash qa/shots-skill-port/run_all.sh` (log: `jobs/mon-S-logs/run_all-monitor.log`).
- Fix (lead, at merge): in P8, run `apply_phase2_brief.py t` after `apply_pointers.py t` and expect 2 APPLIED. Make
  P4/P4b reference V-relative paths so a staging copy can pass.

**M6 · Built-in prompt text sits too close to the cinedance source.** One exact phrase, and a worked example that
transposes one of its blocks. Alex's rule: own words, never its phrases.
- **Exact phrase:** `video/shots/shots.py:819-820` prints "never a fixed stare." The source's gaze block says
  "Never a fixed stare." This goes into every prompt with `acting`.
- **Near-verbatim labels and lists in the tool's fixed text:**
  - `:806` "Tactic (this is what we see)" ← source "TACTIC: … this is what we actually see".
  - `:810` "played for no one but themselves" ← "played for herself".
  - `:816` "a grip tightens, a step catches, a breath is held" ← "a tightened grip, a caught step, … a held
    stillness".
  - `:797` "it is never what the shot is about" ← "it is never the subject of the shot".
  - `:819` "blinks come at uneven moments" ← "irregular blinks at uneven intervals".
  - `:1249` "a twentieth of the frame width" ← "one-twentieth of the frame width".
- **The worked example** (`shots/examples/phase2-band-shots.json` K01 + the SHOTS.md excerpt) is the source's camera-rig
  block with the nouns swapped:
  - camera "clamped to a short arm … wide-angle" ← "CLAMPED PHYSICALLY TO [OBJECT] … on a short arm, WIDE-ANGLE";
  - "the street wheeling past behind the band" ← "the environment SWINGING … behind the stationary object … WHEELS";
  - negatives "drifts … within the frame / films her from outside / the street holds still" ← "no object drifting in
    frame / no camera following the object from outside / the world does not stay still".
- Repro: the n-gram scan (`jobs/mon-S-logs/tools/ngram.py <cinedance SKILL.md> jobs/mon-S-logs/tools/added.txt`) plus `grep -n -i "fixed stare\|what we actually see\|short
  arm\|tightened grip" qa/video-skill-learnings/skills/cinedance-block-library/x/cinedance-block-library/SKILL.md`.
  Read only; nothing there was run.
- Fix:
  - Rewrite those fixed strings in our own register, e.g. "Their eyes keep working, never parked on one point";
    "Tactic (the part the camera sees)"; "the body carries the peaks: hands, breath, footing, not the face".
  - Base the worked example on a different trick (e.g. a match-cut, a rack focus, a locked frame with a moving
    shadow), so it doesn't look like a re-skin of the source's showcase.

**M7 · The proposed `--kit` two-line change leaves the old names on screen under `--title`.** It also calls a 15 s
starter a "launch film". Applies to `video/lv.mjs:448-450` once the lead adds the kits.
- Tested on a patched throwaway clone (`jobs/mon-S-kitclone`):
  `--init --kit launch15 --title "Acme Notes"` writes `title: Acme Notes launch film`. The title card still reads
  `text: Product` (twice in launch30), and the end card shows `url: product.app` under the "Acme Notes" lockup.
- A first-run user gets two different product names in one film.
- Repro: `node jobs/mon-S-kitclone/product-launch-sting/video/lv.mjs --job jobs/mon-S-kit15 --init --kit launch15
  --title "Acme Notes"; grep -n "^title\|text: Product\|url:" jobs/mon-S-kit15/beats.yaml`.
- Fix (lead, 3 more lines in `init()`): for `launch15|launch30`, set `title: <T> launch`; replace
  `^(    text: )Product\b` with `T`; replace `url: product.app` with `${slug}.app`. The non-kit path already does
  `steady.app → slug.app`.

**M8 · The starters' end cards and labels will trip the round-1 checks.** The CTA is the smallest text in the film.
`launch15.yaml:90-95`, `launch30.yaml:134-140` (CTA as the endcard `tagline` + `url`); labels `Output` / `Input` /
`Before` / `After`.
- Audit sizes (`out/main/<aspect>/audits.json`; the same px in every aspect, since u = 1):
  - "Try it free." 44.3 px, "product.app" 30.6 px.
  - `OUTPUT` 31.4–36.9 px, `INPUT` 34.7–35.8, `BEFORE` / `AFTER` 32.7 (shown all caps).
- Against SPEC-R1's new floors (web: 16:9 47 mixed / 35 caps; 9:16 and 1:1 40 / 36):
  - At 16:9, the CTA line (44.3), the URL and BEFORE/AFTER WARN.
  - At 9:16 and 1:1, the URL and every label WARN.
- The end card holds 3.8 s nearly still. An independent re-implementation of B's dead-air recipe
  (`jobs/mon-S-logs/tools/deadair.py`: 1/10 grey thumbs, 12×12 blocks, Δ over 2 frames, < 8) finds a run at 11.22–15.00 s (16:9)
  and 11.17–15.00 s (9:16). That is more than the end card's reading allowance of about 2.65 s. The placeholder hook is
  also a still: 0.7 s (launch15) and 1.2 s (launch30) against a 0.6 s allowance. These are estimates: B's checks
  aren't merged, and B's `--qa` refuses frames from another engine.
- Worker S couldn't change block sizes (blocks are out of scope). But the template chose to put the CTA in the
  endcard's small tagline, rather than a `cta` shot or a bigger line.
- Repro: the audits.json dump in "Commands"; `jobs/mon-S-logs/tools/deadair.py` on `jobs/mon-S-launch15/out/main/9x16/frames`.
- Fix:
  - Template: a 2-beat `cta` shot ("Try it free.") before a 6-beat end card. Or drop the URL line and use
    `cta: [Try it free]`.
  - Lead, for round 1: raise the endcard tagline/url and the float/split label sizes so they clear the floors, and give
    the end card a slow drift (SPEC-R1 rule 11).

### LOW

**L1 · Three malformed inputs are refused in two lines, not one.** SHOTS.md:200 says "Refused, one line each".
- `refs: [{ref: 5, dont: [x]}]` → `refs[0].ref: text (got 5)` + `refs[0].ref: which reference (…)`
  (`shots.py:601-605`).
- `sizes: {"the band": {"width": "x"}}` → `unknown key width` + `{frame, body, hand}: …` (`:655-664`).
- `acting.who: 5` with two people → `acting.who: text (got 5)` + `whose acting? …` (`:619-626`).
- Repro: `/usr/bin/python3 -B qa/motion-kit/jobs/mon-S-shots/adv.py` (rows `refs-refnum`, `sizes-onlybadkey`,
  `acting-whonum-two`).
- Fix: remember whether `ref` / `who` was present and of the wrong type (as done for `dont`), and skip the follow-up
  line. In sizes, skip the generic line when `keys()` already reported unknown keys and nothing valid is left.

**L2 · The fail-line lead-word heuristic misfires.** `shots.py:110-111, 266-268`.
- `"When the band slides"` → "If When the band slides, the shot is wrong."
- `"Camera shakes"` → "If Camera shakes, the shot is wrong."
- Repro: `sem.py`, "fail lines".
- Fix: strip a leading `When|Whenever|Once|If` the same way `If` is stripped, and lowercase any capitalised first word
  that isn't a proper noun of the spec (people `is` / ids, product names).

**L3 · `acting: {}` is accepted silently.** `shots.py:614-649`. It adds only the gaze line, and there is no hint that
direction / motive / goal / obstacle / tactic are all missing.
- Repro: `adv.py` row `acting-empty-onebody` (rc 1, no line about it).
- Fix: warn "acting: none of direction, motive, goal, obstacle, tactic, eyes".

**L4 · On H3 the trick itself can blow the 120-word budget unwarned.** `shots.py:897-917`.
- A 70-word trick gave a 136-word H3 prompt. The only warning was that both fail lines were left out.
- Also, the 12-word preamble "The idea this whole shot is built on, which every moment obeys:" is spent from H3's small
  budget on every shot.
- Repro: `sem.py` "H3 long trick".
- Fix: warn when `words(h3) > H3_WORDS`. Use a shorter H3-only lead-in (e.g. "Rule of the shot:").

**L5 · Empty `dont` entries are dropped silently.** `shots.py:601`. `must` / `fail` / `negatives` refuse an empty entry,
and `refs[].dont: ["x", ""]` silently drops it. Fix: the same "each entry … in words" refusal.

**L6 · `apply_phase2_brief.py` writes to the live skill by default.**
`qa/shots-skill-port/apply_phase2_brief.py:10`: `S = … else os.path.expanduser('~/.claude/skills/product-launch-sting')`.
Run without an argument, it edits live `brief.md`. It copies `apply_pointers.py`'s precedent, but tonight's rule is
never touch live. Fix: require the path argument (exit 2 without it).

**L7 · The brief contradicts itself, and the starters break the passport.** `templates/brief.md:11-12`.
- "one idea per 2–4 s" now appears twice, on adjacent lines.
- Passport row "Transitions: at most two kinds, plus one signature" (`:55`). The starters use cut + drift + zoom-in +
  the zoom-through signature (3 kinds + 1), and launch30's header lists them.
- Fix: delete the duplicate. Either allow "a punch-in on the send" explicitly, or drop the `zoom-in` exits (the QA
  cut-check reason is noted in the template).

**L8 · launch15 shape and word counts.**
- 8 shots instead of "about 10" (decision documented; acceptable).
- The header word counts disagree with the tool: launch15 says 14 must-read words (grid "on screen" count = 12),
  launch30 says 31 (grid count 30).
- Fix: state which count is meant (e.g. "12 on-screen words + 2 UI words").

**L9 · The click shot, the starter's money shot, is weak in close-up.** `launch15.yaml:54-63`.
- The cursor sits on "Generate" and covers its "e" (documented).
- At 9:16 the panel shows as an empty white card for the first frames of the 1 s shot (frame 330), and the card
  arrives blurred (16:9 frame 5.6 s in the worker's sheet).
- It also inherits the `tap` purity bug (Note 2), so Worker B's purity check will likely WARN on launch15's click.
- Fix: until `press` replaces this shot, offset the tap so the arrow doesn't cover the label. Avoid an empty panel on
  the cut: let the card arrive during `ask`'s zoom-in exit, or accept the gap and say so in the comment.

**L10 · "Phase 2" roadmap naming in user docs.** SHOTS.md:177 "## Phase 2: …" and the table row "phase 2, all
optional". A reader after the merge won't know what phase 1 was. Fix: name the section by what it does ("One trick,
unbreakable rules, failure lines, acting").

**L11 · test_phase2 Q1 depends on run order.** `test_phase2.py:60-84` reads the other suites' `out/` and needs at least
100 specs, so it fails when run alone (documented). Fix: fall back to a fixed corpus checked in under
`qa/shots-skill-port/parity/`.

**L12 · The people-without-task info line is Seedance-only.** `shots.py:1238`. SPEC-S says any shot with people;
Worker S restricted it because H3 can't carry a task (documented). Acceptable; mention it in SHOTS.md, which already
says "a Seedance shot".

**L13 · Example and prompt semantics.**
- (a) K02 (no people) sizes the band "as long as her index finger / across her palm". In the key-frame prompt this
  invites a hand into a still life (`phase2-band-shots.json:91`). Suggest a lint: `sizes.body` / `hand` on a shot with
  no `people` → warn.
- (b) `refs: [{ref: first, dont: …}]` prints "Take nothing else from it: not the lens flare …" right after "Keep exactly
  as they are". For image-to-video, the flare is in frame 1 whatever the prompt says. The useful place for that line is
  the key-frame prompt, before the frame exists. Fix: document that `first` is for things to not propagate, or move it.
- (c) The starters' placeholder claims ("10× faster", "120 films studied") carry no "replace me" comment, unlike the
  footage lines. Fix: add `# your claim (legal-approved)` comments.

## Notes for the lead (outside Worker S's scope)

1. The live engine's `wall` storyboard hero isn't deterministic: two live runs of the same `film-sample` clone differ in
   `10-wall.png` (185k px, max Δ3). Any byte-identity proof on boards needs a tolerance there, or `wall` has an
   order/timing dependence worth a look (`jobs/mon-S-old-film-live` vs `mon-S-old-film-live2`).
2. **Purity bug in `engine/ui.js` (live code).** The panel/phone `tap` measures its target once per page:
   `measure()` caches `geo` and `r.target` from `getBoundingClientRect()` at the first `render(t)` on that page. The
   DOM still holds whatever transforms were there before, so the cursor position depends on which frame the page drew
   first.
   - Repro:
     `node $S/video/lv.mjs --job jobs/mon-S-launch15 --film --aspect 16x9 --range 320,420 --workers 2`, then `cmp`
     against the backed-up full-film frames in `jobs/mon-S-logs/purity-backup-l15-16x9/`. Frame 371 differs, max Δ238.
   - Worker B's purity check should flag this. Fix: measure with every transform reset to its rest state (or in layout
     units, `offsetLeft`/`offsetTop` up the tree), not from the live rects.
   - Side effect: a `--range` that cuts through shots leaves those shots marked stale ("re-render with --film, or per
     shot …"), and the job is left un-muxed.

## Commands run (results)

```text
# ownership / diff
diff -rq -x node_modules qa/motion-kit/base/product-launch-sting qa/motion-kit/stageS/product-launch-sting   → 6 paths (above)
shasum -c qa/motion-kit/live-before.sha1 (in ~/.claude/skills/product-launch-sting)                          → 867 OK, before and after

# suites (jobs/mon-S-logs/run_all-monitor.log, suite logs in jobs/mon-S-logs/suite-logs/)
SHOTS_QA_VIDEO=$S/video bash qa/shots-skill-port/run_all.sh
  QA 1 parity 14/17 (FAIL P4, P4b, P8) · QA 2 48/48 · QA 2b 16/16 · QA 3 57/57 · QA 4 90/90 · QA 5 phase 2 43/43 · exit 1

# old real spec, base vs stageS shots.py (jobs/mon-S-shots/real)
check / build: identical apart from one "i shots.S02: people, but no task" line · shots/ files identical · show S01–S03 identical

# malformed + semantic probes
/usr/bin/python3 -B jobs/mon-S-shots/adv.py   → 33 cases: 30 one-line refusals, 3 two-line (L1), acting {} silent (L3)
/usr/bin/python3 -B jobs/mon-S-shots/sem.py   → H2, L2, L4 outputs; vague lint covers trick.so/must/fail/refs.dont/eyes/sizes

# skeletons (jobs/mon-S-launch15, jobs/mon-S-launch30 = template + placeholder SVGs)
--grid → rc 0, no warnings (both) · --storyboard --aspect all → rc 0, no notes (both)
--film --aspect A --workers 2 (jobs/mon-S-logs/<job>-film-<A>.log):
  launch15 9x16  QA FAILED (1)  FAIL content near-empty frames: 510                         195 s
  launch15 1x1   QA PASSED (15 checks)                                                     153 s
  launch15 16x9  QA PASSED (15 checks)  (same numbers as the worker's: cut 79.47×/5.06×/…)   180 s
  launch30 9x16  QA PASSED (18 checks)  + INFO sfx tick@20.13 buried                        593 s
  launch30 1x1   QA PASSED (18 checks)                                                     269 s
  launch30 16x9  QA PASSED (18 checks)                                                     386 s
isolation: float→wall→stat at 9x16 → QA FAILED content @120 (jobs/mon-S-wallfix-a); with stack → QA PASSED (11) (wallfix-b)
cue timing: click cue t=6.08933 s (timeline.json) · result still hold: settles f417, exit moves from f489 (16x9 and 9x16)
purity: --range 320,420 → 100/101 frames byte-identical; f371 differs (Note 2)
contact sheets: jobs/mon-S-logs/launch15-9x16-sheet.png, launch30-9x16-sheet.png, launch30-1x1-sheet.png

# kit change on a throwaway clone (jobs/mon-S-kitclone): --init --kit launch15|launch30 --title … → writes starter + 5/7 placeholders, --grid rc 0;
#   --kit launch20 → "✗ --kit must be reel, film, launch15, launch30 (…)" rc 2

# old job regression: film-sample clone storyboard 16x9, live vs stageS → 12/13 board PNGs byte-identical; 10-wall.png Δ≤3 (also live vs live)
```
