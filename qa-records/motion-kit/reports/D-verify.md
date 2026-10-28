# Verify pass: Worker D, round 2 (cut checks)

2026-10-26, monitor's second pass over `qa/motion-kit/stageD/product-launch-sting`, against SPEC-R1 + SPEC-R2 § Worker D,
the 13 findings in `reports/D-monitor.md` and the "Fix pass" section of `reports/D-build-r2.md`.

**Rules kept.** I edited one file in Worker D's copy (`video/lib/qa.mjs`, a 6-line fix, V1 below). I did not touch the live
skill, `base/`, `live-before/`, `stage/` or the other workers' copies, and I rendered no original job. My jobs are
`jobs/V-D-*`; tool copies (live, base, merged C+D) were `cp -c` clones in the scratchpad. No commits, pushes, paid calls
or `--go`.

## Verdict

**The fix pass holds.** I reproduced every finding again, and none of them fires any more.

- **Byte-identical:** a fresh stageD render is byte-identical to the live skill. That covers 180/180 frames and 180/180
  bgref per aspect, plus both mp4s.
- **Old QA lines:** every existing QA line on old films matches the base tool exactly.
- **Planted probes:** they keep all their WARNs.

**One gap left by the finding-1 fix, now fixed.** A cut into an insert *shorter than its own exit* (under 0.23 s for a
whip, 0.4 s for a drift) still got the false "from rest" WARN. I fixed it in `qa.mjs` (V1), proved it both ways, and
confirmed it changes nothing else.

| Verdict | Count | Findings |
|---|---|---|
| FIXED | 12 | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 |
| DISPUTED-WORKER-RIGHT | 1 | 13: one part only. The one-line `render.mjs` merge conflict with B is unavoidable. Its other two parts are fixed. |
| NOT FIXED | 0 | |
| DISPUTED-WORKER-WRONG | 0 | |
| New in this pass | 1 fixed by me + 3 notes | V1 fixed; V2–V4 are notes, none of them in D's code |

Shorthand: `M=qa/motion-kit`, `S=$M/stageD/product-launch-sting/video/lv.mjs`, logs in `$M/reports/D-verify/logs/`.

## Each finding, reproduced again

| # | Sev | Verdict | What I ran and saw |
|---|---|---|---|
| 1 | HIGH | **FIXED** (+V1) | <ul><li>A fresh `--film --aspect all` of the monitor's probe (`jobs/V-D-fp-stage`): p1→p2 has 0 WARN on 16x9 and 1x1, and QA PASSED (12).</li><li>Saved manus2-film and manus2-space logs: the pre-fix code gives 2 WARN each; stageD gives 0 (`logs/recheck-{prefix,stageD}-manus2-*.txt`).</li><li>I re-made the manus2-film log seek-only. It is byte-identical to the worker's saved one, so the inputs are genuine.</li><li>Residual: inserts shorter than their exit still got the WARN. Fixed as V1.</li></ul> |
| 2 | MED | **FIXED** (contract still open) | <ul><li>`CONT.matched = 2` applies after `out: dive` and to every carry.</li><li>Merged C+D (stageC as of 12:19 + D's files): a real `--film 16x9` of r2-dev gives QA PASSED (16). Dives are judged at a 2× limit and measure 1.20× / 1.21×. Carries measure 1.01× / 1.07×, plus one at 396 px/s, which is under the moving gate.</li><li>Unit cases 1–4 behave.</li><li>The built-in transitions keep 3×. That still deviates from SPEC-R2's "≤ 2×" and needs the lead's call. The case for it is unchanged: the engine's own pairs measure 1.9–2.6×.</li></ul> |
| 3 | MED | **FIXED** (option b, lead to confirm) | <ul><li>hf02-skill on 3 aspects: the pre-fix code gives 2 WARN; stageD gives 0, and INFO reads "set by tuned drift strengths … a→b 3.15×, b→c 14.07×".</li><li>I re-made the 1x1 log seek-only: identical.</li><li>A tuned drift with a late peak still WARNs on the peak (my `tools/edge-unit.mjs` case 5). A tuned drift that flips still WARNs (worker's unit 12).</li></ul> |
| 4 | MED | **FIXED** (the monitor's "better" option) | <ul><li>One file per cut, `thumbs/cut.<frame>.jpg` (2896×540 for 16:9), so the GUIDE recipe ("index.html, film.mp4, thumbs/") ships them.</li><li>Shot ids are `[\w-]+` (spec.mjs:146), so `cut.*` can't collide with a shot's thumb.</li><li>Published-set simulation (preview + film.mp4 + thumbs only, fresh folder): 13/13 images, 0 broken.</li><li>With the cut files deleted: 0 strips and 0 broken images; all 3 verdict lines stay, and no page errors.</li><li>Tile edges at full resolution are clean, with no sliver of the next frame (`stills/fp-16x9-p2-strip.png`).</li><li>Publish count: shots + cuts + 2 files.</li></ul> |
| 5 | LOW | **FIXED** | <ul><li>D-probe-cont now reads "3181 → 0 px/s (to rest, limit 3×)". The manus2 INFO range went from 1.1–438.6× to 1.1–2.6×.</li><li>No "438×" figures remain anywhere in the 33 logs.</li></ul> |
| 6 | LOW | **FIXED** (recorded) | <ul><li>`sheet.html` is still outside D's file list.</li><li>No other copy edits it: stageA, stageB, stageC, stageS and stage are byte-equal to base (I checked).</li><li>Add it to D's list in the merge plan.</li></ul> |
| 7 | LOW | **FIXED** | <ul><li>`CONT.R` is one radius on every aspect.</li><li>film-sample 1x1: pre-fix 4 moving cuts → stageD 6, the same as 16x9 and 9x16.</li></ul> |
| 8 | LOW | **FIXED** | <ul><li>Real headless-Chrome clicks on film-sample's odd cut 145 (`tools/seekshot.mjs`), then a screenshot of the player with its controls off:</li><li>cut−1 → 2.4083 s. The player matches frame 144 (open) at 38.8 dB and frame 146 at 2.1 dB.</li><li>cut and cut+1 → 2.4417 s. The player shows the name shot, best match frame 146.</li><li>Picture: `stills/seek-odd-cut145-player-vs-frames.png`.</li></ul> |
| 9 | LOW | **FIXED** | <ul><li>The real merged render's go→end morph-to-frame is listed: "ends on the cut (the half before it checked): go→end carry", with its peak on 1159→1160.</li><li>A carry that starts only after the cut is named "too short to check" (edge case 4), never skipped silently.</li></ul> |
| 10 | LOW | **FIXED** | <ul><li>Fresh fp render, 16x9 and 1x1: p3→p4 goes to INFO ("still settling from its entrance (fastest 5 f before p3→p4), not warned").</li><li>On the sheet: "(its entrance settling)".</li><li>Worker's unit 8 (a real bump) still WARNs.</li></ul> |
| 11 | LOW | **FIXED** | <ul><li>Logging is gated: `!bgOnly && !clean && !layer && !layerTree && !probe`.</li><li>The fresh fp render with the gated tool is byte-identical to the live skill's render: frames, bgref, shots.json, audits.json and both mp4s. pages.json differs only by pid.</li><li>cams.json = a shuffled seek-only log (seed 7), byte for byte.</li><li>`--range 60,99` leaves cams.json byte-identical.</li><li>`--clips p3 --alpha` passes (prores, content, freeze). `--layers p3` passes all 7 layer checks.</li></ul> |
| 12 | LOW | **FIXED** (no defect; coverage re-checked) | <ul><li>1x1 film, 9:16 and 1x1 sheets at 390 px: no horizontal scroll and no page errors.</li><li>The 33 saved logs, the 13 + 9 unit cases, and a merged C+D r2-dev on 3 aspects (seek-only) plus a real 16x9 render.</li></ul> |
| 13 | LOW | **FIXED** 2/3, **DISPUTED-WORKER-RIGHT** 1/3 | <ul><li>The predicate is single-sourced: QA writes `warn: [...]` per record, and the sheet reads only that.</li><li>Board HTML has 0 whitespace-only lines.</li><li>Trial `git merge-file` (base / final stageD / current stageB): 5 of 6 files clean. `render.mjs` has 1 conflict on the `return {…}` line. Resolution: `return { log, pages, audits, fit, layers, probes, composited, cams, sigs, sigs2 };`.</li><li>The merged loop logs `cams[k]` right after `LV.seek`, before B's sigs/textless passes, so the two features don't interact.</li></ul> |

## New in this pass

### V1 · fixed by me: an insert shorter than its own exit still got the "from rest" WARN

**What:** finding 1's fix stops the incoming shot's window where its exit ramp starts. When the shot is shorter than its
exit, the ramp is already running on its first frame (`runtime.js:76` puts `xu > 0` from local frame 0), so step cut+1 is exit
motion and nothing in the window clip helps.

**Repro:** `jobs/V-D-short`: a still q1 hard-cuts into a 0.2 s q2 that whips out.
- Pre-fix stageD gives `WARN … q1→q2 at 60 (cut): speed 1 → 688 px/s across the cut (from rest, limit 3×) — q1 is still and q2 starts moving on the cut`
  (`logs/short-qa-preverify.log`).
- The cut stills show a clean hard cut, with the whip coming after it (`stills/short-insert-cuts-60-72.jpg`).

**Fix:** `video/lib/qa.mjs`, 6 lines; diff in `reports/D-verify/verify-fix-qa.mjs.diff`; pre-edit copy in `reports/D-verify/pre-verify/qa.mjs`.
- When the incoming shot is shorter than its exit and *speeds up* across the cut, the speed limit and ratio are dropped. The
  record gets `short: true`, and the INFO line names it ("the incoming shot is shorter than its own exit and speeds up on it from
  its first frame, not warned: q1→q2").
- Slow-downs and direction flips into such an insert still WARN.
- I first tried dropping the ratio for every short insert. That lost two valid ratio checks on `jobs/V-D-short2` (r1→r2 2.06×,
  r3→r4 2.32×), so I narrowed it to speed-ups.

**Proof both ways:**

| Check | Result |
|---|---|
| `V-D-short` real `--film 16x9` | QA PASSED, 0 WARN, cut named in INFO (`logs/short-film.log`) |
| Same frames, pre-fix tool | 1 WARN (`logs/short-qa-preverify.log`) |
| `tools/edge-unit.mjs` case 1 (synthetic) | WARN → INFO |
| Case 6: whip-left into a short insert that whips right | the flip still WARNs |
| The 33 saved old-job logs | 0 changed |
| r2-dev × 3 aspects (merged C+D) | unchanged |
| D-probe-cont 16x9 / 9x16 and D-probe-flip | every QA line identical before and after (4 / 4 / 6 WARN) |
| fp 16x9 / 1x1 | unchanged |
| Worker's unit outputs (13 fix cases + 9 round-2 cases) | byte-identical |
| `node --check`; trial merge with stageB | still clean |

### V2 · note (engine, pre-existing, not D's code): motion blur dips on every moving cut's first frame

The camera log shows the blur on the cut frame at about half of each neighbour's, for example:

| Cut | Blur at cut−1 · cut · cut+1 |
|---|---|
| team→scan whip-up | 22 · 11.8 · 21.7 |
| brief→team zoom-out | 12 · 4.4 · 8.1 |

The cut still is visibly crisper than the frame after it (`thumbs/cut.00987.jpg` of `jobs/V-D-film`). That is a one-frame
sharpness flicker at the moment speed should peak. It is byte-identical with the live engine, so it is not a regression. It
belongs to `runtime.js` (C / lead). D's `cams.json` already records `blur`, so a later continuity INFO ("blur on the cut <
60 % of its neighbours") would be cheap.

### V3 · note (cosmetic, left as is): the INFO "speed ratios" range includes tuned-drift ratios

hf02 reads "1.1–14.1×; set by tuned drift strengths … b→c 14.07×". The same sentence explains the 14.1×, so I left it.

### V4 · note (C's transition, seen on D's sheet)

At r2-dev go→end, the morph box covers about 96 % of the frame at cut−1, and a light rim of go's background shows for one
frame before the dark end card (`stills/r2dev-merged-carry-morph-cuts.jpg`, bottom row). This is within C's spec ("fills the
frame on the cut"), but a designer will see the rim. The other carries look right:
- the smooth carry moves the card about 7 px per frame across a hard background cut;
- the needle holds its place;
- the box→box morph keeps the box rectangle.

## Done criteria, re-run myself

| SPEC-R2 § Worker D item | Result | Evidence |
|---|---|---|
| Camera log per frame → `cams.json`, merged on `--range` | pass | <ul><li>Fresh fp render: 180 entries, no nulls.</li><li>Equal to a shuffled seek-only log.</li><li>`--range 60,99` leaves it byte-identical.</li><li>Merged r2-dev: rendered cams.json = the seek-only log, carry rectangles included.</li></ul> |
| Reads `cam.carry {x,y,w,h}` | pass | C's `runtime.js:889` emits it. 4 carries are judged in the real merged render. |
| Continuity fires on planted bad jobs | pass | <ul><li>D-probe-cont 16x9 / 9x16: 4 WARN each (flip, 3.09×, to rest, peak +3 f).</li><li>D-probe-flip: 6 WARN (incl. the carry flip, carry 3 f late, and "a2 pushes in, a3 starts zoomed in and pulls back").</li><li>V-D-short with the pre-fix code: 1 WARN.</li></ul> |
| Quiet on good jobs | pass | <ul><li>steady 16x9 / 9x16, reel 9x16 and film-sample 16x9: `--qa` gives QA PASSED with "all hold".</li><li>All 33 old-job logs: 0 WARN.</li></ul> |
| Existing PASS/FAIL unchanged | pass | Base vs stageD `--qa` on the same frames: 17 / 17 / 19 / 23 lines identical. The only addition is the `continuity` INFO line. PASS counts are equal. |
| Old jobs byte-identical | pass | fp probe: stageD vs the live skill. 16x9 and 1x1: 180/180 frames and 180/180 bgref identical, plus shots.json, audits.json and both mp4s. |
| Review sheet with cut stills, real film | pass | <ul><li>film-sample 16x9: 11 strips, 33 tiles, 0 broken, no horizontal scroll at 1440 or 390.</li><li>fp 16x9 / 1x1; merged r2-dev: 9 strips with carry verdicts.</li><li>mp4 fallback (frames folder hidden): cut stills are 49.6–51.3 dB against the PNG path. The middle tile matches frame 76 at 48.8 dB and its neighbours at 22–29 dB, so it is frame-exact.</li></ul> |
| Storyboard prints `cause:` | pass | `jobs/V-D-fp-stage/cont-fp-storyboard-16x9.png` ("cause the spray flies left" under p2) |
| WARN/INFO only | pass | No new FAIL anywhere. Every run ended QA PASSED. |

## Files

- **Tools** (`reports/D-verify/tools/`):
  - `vcheck.mjs` (a stage's `cutContinuity` on a saved log, no browser)
  - `edge-unit.mjs` (6 synthetic edge cases; `STAGE=` selects the copy)
  - `sheetcheck.mjs` (layout, broken images, cut strips, click-to-seek)
  - `seekshot.mjs` (player screenshot after each click)
- **Logs** (`reports/D-verify/logs/`):
  - `recheck-{prefix,stageD,final}-*.txt` (33 old-job logs × 3 code versions)
  - `qa-{base,stage,final}-*.log`
  - `fp-*.log`, `cd-r2dev-*.log`, `short-*.log`
  - `unit-*.txt`, `edge-unit.*.txt`
  - the camera logs I made
- **Stills** (`reports/D-verify/stills/`):
  - `fp-16x9-sheet-1440.png`, `fp-16x9-p2-strip.png`
  - `fp-1x1-390-crop.png`, `fp-16x9-no-cut-files.png`
  - `film-sample-brief-team-cutrow.png`, `film-sample-sheet-1440.png` / `-390.png`
  - `seek-odd-cut145-player-vs-frames.png`
  - `r2dev-merged-carry-morph-cuts.jpg`, `short-insert-cuts-60-72.jpg`
- **My edit:** `reports/D-verify/verify-fix-qa.mjs.diff`; pre-edit copy in `reports/D-verify/pre-verify/qa.mjs`.
- **Jobs:** `jobs/V-D-*`.
  - V-D-film, -reel, -steady and -probe-* are APFS clones of D's renders.
  - Keep `V-D-short` as a regression probe next to D-probe-cont / D-probe-flip.
  - The rest can be deleted after review.

## GUIDE text to add (one sentence on top of D's)

> An insert shorter than its own exit (under 0.23 s before a whip or zoom, 0.4 s before a drift) is already leaving on its first
> frame, so a speed-up into it is named in the INFO line, not warned; a slow-down or a direction flip into it still warns.

## Asks for the lead

1. **Speed-ratio limit:** keep 3× for the built-in transitions (2× after a dive and for carries), or hold the spec's 2×
   everywhere and accept a WARN on nearly every legacy moving cut.
2. **Hand-tuned drift exemption:** confirm that `drift: {in, out}` set by hand moves the speed ratio to INFO (hf02 b→c is
   14×). Direction and peak problems on those cuts still WARN.
3. **Merge plan:**
   - add `lib/sheet.html` to Worker D's files;
   - resolve render.mjs's single conflict by keeping both keys;
   - take `qa.mjs` with V1 (6 lines, already in stageD).
