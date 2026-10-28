# Monitor report: Worker D, round 2 (cut checks)

2026-10-26, independent monitor. I checked the build in `qa/motion-kit/stageD/product-launch-sting` against SPEC-R2
§ "Worker D" and SPEC-R1's rules, and I re-ran every claim in `reports/D-build-r2.md`. I did not edit Worker D's files,
the live skill, `base/`, `live-before/`, `stage/` or any other worker's copy. I did not render any original job. All my
jobs are `qa/motion-kit/jobs/mon-D-*`. Logs are in `jobs/mon-D-logs/`. Tools, survey output and stills are in
`reports/D-monitor/`.

**Verdict.** The build is small, additive and mergeable. Frames stay byte-identical with the live engine, and the camera
log is pure. The sheet and the storyboard work in all three aspects. One logic bug needs fixing before merge:
continuity WARNs misattribute a short shot's own exit to the cut before it (finding 1). That bug fires on two real
Manus films. I wrote a 3-line fix and tested it: it removes every false WARN and keeps every planted one.

**Counts:** 1 HIGH · 3 MEDIUM · 9 LOW.

Shorthand used in the repro commands:

```
M=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit
S=$M/stageD/product-launch-sting/video/lv.mjs
J=$M/jobs
T=$M/reports/D-monitor/tools
```

---

## Findings

### 1 · HIGH: the continuity window crosses into the next cut's transition, so short inserts get false WARNs

**Where:** `video/lib/qa.mjs:170`. The `win` range runs to `c + CONT.win` and `b1`. The moving gate and the peak
rule in `judge` (qa.mjs:155-163) then use that window.

**What happens:** shot B can be shorter than about 0.3 s plus its exit. Then the ±6-frame window after the A→B cut
contains B's own exit ramp, which belongs to the B→C cut. That ramp does two things:

- It opens the "moving" gate, so the ratio rule compares A's last step with B's default 4 % settle. Both are below
  the 400 px/s gate, and the result is "438.58×".
- It is reported as "the fastest step is 5 frames after the cut".

Both WARNs tell the user to change the wrong cut ("give S20 a move into the cut"). I looked at frames 58–69 of the
repro (`reports/D-monitor/stills/fp-p1p2.png`): p1→p2 is a clean hard cut, and the whip that follows is p2's exit.

**Real jobs hit:** `manus2-film` and `manus2-space`, cut S20→S21 at 3046. S21 is a 0.27 s insert that whips out.

**Repro** (QA PASSED, plus 2 false WARNs at p1→p2):
```
node $S --job $J/mon-D-fp --film --aspect all --workers 2     # or: --qa --aspect all (already rendered)
STAGE=$M/stageD/product-launch-sting node $T/camsurvey.mjs $J/mon-D-old-manus2-film 16x9 /tmp/x.json
```

**Fix** (`reports/D-monitor/tools/proposed-fix-qa.mjs.diff`, 3 lines):
- End B's side of the window where B's own exit ramp starts:
  `bx = B.out === 'cut' ? b1 : min(b1, B.f1·2 − 2·exitLen(B.out))`, with `exitLen` imported from `engine/kit.js`, which
  qa.mjs already imports.
- Judge the ratio only when the faster adjacent step is actually moving (`max(before.v, after.v) ≥ CONT.moving`).

**Fix tested** on all 33 surveyed logs plus the 5 probe logs (`node $T/compare.mjs …`):
- manus2-film, manus2-space and mon-D-fp (16x9 and 1x1): 2 → 0 WARNs on each of the four.
- D-probe-cont (4 WARNs, both aspects) and D-probe-flip (6 WARNs): unchanged.
- D's unit test output: byte-identical.
- No other log changed.

### 2 · MEDIUM: the speed-ratio WARN is set at 3×; the spec says 2× (contract change, needs the lead's sign-off)

**Where:** `video/lib/qa.mjs:129` (`CONT.ratio: 3`). The spec line is SPEC-R2:127.

**D's reason holds up.** The engine's own pairs come out above 2× by construction. For a whip:
- the exit is inCubic over 7 frames, giving 9850 px/s on the last step;
- the entrance decays ×0.8 per frame, giving 4378 px/s on the first step;
- so the ratio is 2.25×.

At 2×, every moving cut in every old film would WARN. That conflicts with the spec's own "stays quiet on
film-sample / steady-sample". It is still a contract change, and the report calls it a decision.

**Suggestion:** apply 2× to the new round-2 moves only (`out: dive` and `carry`), and keep 3× for the legacy
transitions. In my merged C+D snapshot on r2-dev, dives measure 1.21–1.22× and carries 1.00–1.07×. A 2× limit there
stays quiet today and would catch a regression in C's speed matching.

**Repro:**
```
STAGE=/tmp/mergedCD node $T/camsurvey.mjs $J/mon-D-old-r2-dev 16x9 /tmp/x.json
```
The merged copy is stageC plus D's 6 files.

### 3 · MEDIUM: calibration skipped tuned drift cuts; the hf02 proof WARNs in all 3 aspects

**What happens:** `hf02-skill` sets `drift: {in: 1.68}` and `{in: 6.5}`, values taken from the measured reference.
The check WARNs on it:
- a→b drift-right: 3.15×
- b→c drift-down: 14.07×

D calibrated on three films that have no tuned drift cuts.

By the rule this is a true WARN. In practice it fires on a recreation built from Alex's own measurements of the
reference film, and every re-render will show it.

**Fix (lead decides):** either accept it and document that `drift.in/out` above ~1.5 trips the ratio rule, or treat
explicitly set drift strengths as intentional and report them as INFO.

**Repro:**
```
STAGE=$M/stageD/product-launch-sting node $T/camsurvey.mjs $J/mon-D-old-hf02-skill 16x9 /tmp/x.json
```
Same 2 WARNs on 9x16 and 1x1.

### 4 · MEDIUM: a sheet published by the current GUIDE recipe shows broken cut stills

**Where:** `video/lib/sheet.html:322-327` adds `<img src="cuts/NNNNN.jpg">`. `video/GUIDE.md:426-428` says to publish
`index.html`, `film.mp4` and `thumbs/`, "every thumb + film.mp4 in files".

**What happens:** the published sheet, which is the user's phone review path, shows broken images. D's lv.mjs message
and D's proposed GUIDE text mention `cuts/`, but nothing enforces it.

There is also a file-count limit: 3 files per cut, plus thumbs, plus film. A film with more than about 60 cuts exceeds
the Artifact limit of 255 files per publish.

**Fix:**
- Make the GUIDE update a merge blocker.
- Add `img.onerror = () => b.remove()` so missing stills degrade cleanly.
- Better: write one JPEG per cut (the three frames side by side) instead of three files.

### 5 · LOW: the ratio maths and wording for near-still sides

**Where:** `video/lib/qa.mjs:159`, `:192-196`.

**What happens:** when one side is ~0 px/s, the ratio is `max/lo` with lo ≈ 1. Examples:
- "speed 1 → 290 px/s (438.58×)";
- "speed 0 → 201 px/s (438.58×)" on 1x1, where the rounded number contradicts the ratio;
- an INFO range of "1.5–438.6×".

The WARN also says "p2 starts moving on the cut" when the only motion at that point is the engine's default settle.

**Fix:** floor the denominator at `CONT.moving/4` (or print "from rest"), and skip the ratio when neither side
reaches `CONT.moving`. The second part is in the finding-1 diff.

**Repro:** finding 1's `mon-D-fp` job.

### 6 · LOW: `lib/sheet.html` is outside Worker D's file list

**Where:** SPEC-R2:117 lists `render.mjs, qa.mjs, sheet.mjs, board.mjs, lv.mjs`.

The edit is necessary for the cut strip and no other worker touches the file (A, B, C and S verified by diff), so it is
merge-safe. Record it in the merge plan.

### 7 · LOW: the "moving" gate depends on the aspect

**Where:** `video/lib/qa.mjs:131`. `R` is the half diagonal: 1101 on 16:9 and 9:16, 764 on 1:1. Zoom speed is `|z|·R`.

**What happens:** the same film-sample blur cuts (scan→edge, wall→voice) are checked on 16:9 and 9:16 (450 / 427 px/s)
but skipped on 1:1 (312 / 296 px/s). The ratios are aspect-independent, as D says, but the gate isn't.

**Fix:** use a fixed reference radius (1101) on every aspect, or gate zoom by `|z|` directly.

**Repro:**
```
STAGE=… node $T/cutdump.mjs $J/mon-D-old-film-sample 1x1 $M/reports/D-monitor/survey/…
```
Or compare `survey/D-film-sample-16x9.txt` with `-1x1.txt`: 6 moving cuts against 4.

### 8 · LOW: clicking a cut still seeks the 30-fps proxy to the wrong frame on odd cuts

**Where:** `video/lib/sheet.html:329` (`currentTime = (x.f + .5) / 60`).

**What happens:** the proxy holds only even 60-fps frames. For an odd cut, the "cut" still shows A's last frame.
Measured on film-sample open→name (cut 145): proxy frame 72 matches `cuts/00144.jpg` at 48.7 dB and `00145.jpg` at
only 6.9 dB. Film-sample has 6 odd cuts out of 11.

**Fix:** use `(Math.floor(f/2) + .25)/30` for stills of the outgoing shot and `(Math.ceil(f/2) + .25)/30` for stills of
the incoming shot. Each click then lands in the right shot.

### 9 · LOW: carries with no rectangle after the cut are skipped silently

**Where:** `video/lib/qa.mjs:173`. `judge` returns null when the step `c→c+1` has no rectangle.

**What happens:** C's morph `to: frame` (r2-dev go→end, carry frames 1132–1160) is never checked, and the INFO line
does not mention it.

**Fix:** for such a carry, check the pre-cut half (accelerating, with the peak on `c−1→c`) and say "1 carry ends on
the cut (pre-cut half checked)".

### 10 · LOW: short inserts that arrive on a moving transition get a "peak before the cut" WARN

This is the A-side version of finding 1.

**Where:** mon-D-fp p3→p4: a 0.4 s insert after whip-left that hard-cuts out (760 vs 474 px/s, 5 frames before).

It is consistent with rule (3), since the insert decelerates into the cut, but in a fast montage it reads as noise.

**Fix (optional):** report an A-side off-cut peak that lies inside the previous transition's decaying entrance as
INFO, not WARN.

### 11 · LOW: performance, the camera is logged on every pass

**Where:** `video/lib/render.mjs:146`.

**What happens:** one extra `page.evaluate` per frame in every `renderFrames` call: frames, bgref, clips, layers and
heroes. Only `--film`'s frames pass uses the result.
- Measured 0.4–3.1 ms per call under load ~28 (median ~1.5 ms).
- For film-sample that is ≈ 7 s serial (≈ 3.4 s wall at 2 workers) per aspect.
- A 121-frame range render took 44.2 s against 44.6 s on the live engine, which is within noise.

**Fix:** add an opt-in `camLog` flag that only `--film`'s frames pass sets, or fold the camera into the `LV.seek`
evaluate. The second option touches the B merge hotspot.

### 12 · LOW: test coverage gaps in D's report (I covered them; no defect found)

- D rendered no 1x1 film and no film-sample 9x16, and calibrated on 3 films.
- The "flies in, then shrinks" flip is proven only on a hand-edited `cams.json`. I confirmed that no current field can
  produce it: camera `zoom` is static, and C's `dive.from` is validated to 0.1–0.9. Block-internal motion (custom
  blocks, `type through`, the `from:` card flights) is invisible to the camera log, so the spec's "or a custom block"
  route can never fire. D's report says so.
- I covered 1x1: `mon-D-fp` 1x1 film gives QA PASSED with the continuity lines. Its sheet at 1440 px and 390 px has no
  horizontal scroll and no page errors (`stills/sheet-1x1-*.png`).
- I also ran a camera survey on 13 old jobs, the two S templates, a 17-transition matrix and C's r2-dev, all aspects
  (table below).

### 13 · LOW: merge and hygiene notes

- **Trial three-way merge with Worker B's current copy** (`git merge-file`, base/stageD/stageB, output in scratch only):
  - qa.mjs, lv.mjs and board.mjs merge clean;
  - render.mjs has one trivial conflict on the `return {…}` line (B adds `sigs, sigs2`), which D predicted.
- **Duplicated WARN predicate:** `video/lib/sheet.mjs:181` restates qa.mjs's WARN predicate, so the two can drift.
  Export one `contWarn(r, cam)` from qa.mjs and use it in both.
- **Stray whitespace:** the board template adds a whitespace-only line per card when there is no `cause`. It is
  harmless: storyboard pixels match.

---

## Requirements, item by item

| SPEC-R2 Worker D item | State | Evidence (mine) |
|---|---|---|
| `renderFrames` records `LV.camera()` per frame; `--film` writes `cams.json` | met | `mon-D-fp` 16x9 / 1x1 `cams.json`, 180 entries |
| merged for `--range` like shots/pages | met | `--range 0,99` leaves `cams.json` byte-identical; a range over a film with no log gives "no camera data at p1→p2, p3→p4" |
| reads `cam.carry {x,y,w,h}` | met | C's `runtime.js:875` emits exactly that shape after the CAM reset; merged C+D r2-dev checks 3 carries |
| continuity (1) direction, (2) ratio ≤ 2×, (3) peak on the cut, numbers in qa.json | partly met | (2) is set at 3× (finding 2); window bug (finding 1); morph-to-frame skipped (finding 9) |
| fires on a planted bad job | met (planted log) | `mon-D-probe-cont` 4 WARN, `mon-D-probe-flip` 6 WARN (re-run with `--qa`) |
| quiet on film-sample / steady-sample | met | QA quiet on all aspects (survey); not quiet on hf02-skill / manus2 (findings 1, 3) |
| cut stills cut−1 · cut · cut+1, half-size, per row; says so without a film | met | 16x9 and 1x1 sheets; mp4 fallback 48–51 dB against the PNG path |
| storyboard prints `cause:` | met | `jobs/mon-D-fp/cont-fp-storyboard-16x9.png` |
| WARN/INFO only, existing PASS/FAIL unchanged | met | base `--qa` vs stageD `--qa` on the same frames: every existing line identical; PASS counts equal |
| old jobs byte-identical | met | see next section |
| file ownership | not met (LOW) | `sheet.html` (finding 6) |

## Byte-identity against the live engine

I used an unmodified `cp -c` copy of `~/.claude/skills/product-launch-sting`. It is identical to the live skill
(`diff -rq` clean).

| Clone | Render | Result |
|---|---|---|
| film-sample 16x9 | `--film --range 1130,1250` (team→scan whip-up) | 121/121 frames + 121/121 bgref `cmp`-identical |
| reel-sample 9x16 | `--range 540,640` (s4 zoom-in) | 101 + 101 identical |
| manus2-space 16x9 | `--range 690,770` (mp4 footage plates, 2 cuts) | 81 + 81 identical |
| film-sample, all aspects | `--storyboard` | 12/13 hero PNGs identical (see below) |

On the storyboard, `10-wall.png` differs by ≤ 2 code values, but it also differs between two live runs. Live against a
second stageD run is identical, so this is pre-existing raster noise in the wall hero, not D. The assembled
`storyboard.png` differs in the same 16 header rows by ≤ 8 code values for every pair, including live against live.

The `shots.json` and `audits.json` written by live and stageD are identical.

## Purity of the camera log

`tools/camsurvey.mjs` seeks every frame on one fresh page and calls `LV.camera()` with no screenshot. Run sequentially
and in a seeded shuffled order on steady-sample 16x9, it gives 1200/1200 entries equal to the `cams.json` from a real
`--film`. CAM is computed analytically in `seek`, before the block draws, so the order never matters.

## Camera-continuity survey

Every result below is from the seek-only log, which I validated as identical to the rendered one.

| Job (aspects) | stageD continuity | Note |
|---|---|---|
| steady-sample (16x9, 9x16), film-sample (3), reel-sample (3), reel-dev (3), cue (2), edge-test, dark-ui-check, cue-overlays, layers-probe, qa-probe, qa-probe2 | all hold | ratios 1.8–2.6× |
| S-launch15 (3), S-launch30 (3) (Worker S templates) | all hold | 1.1–2.1× |
| transition matrix, 17 built-in outs × 3 aspects (`jobs/mon-D-matrix`) | all hold | 1.1–2.6× |
| r2-dev × 3 aspects, merged C+D snapshot (stageC as of 10:48 + D's 6 files) | all hold | dives 1.21–1.22×, carries 1.00–1.07× with the peak on `c−1→c` |
| hf02-skill (3) | 2 WARN each | finding 3 |
| manus2-film, manus2-space (16x9) | 2 WARN each | finding 1 (false) |
| film-kit-dev | not runnable | pre-existing engine error, "layer name footage" in its custom block; the job is SUPERSEDED |
| shots-demo | not runnable | no shots |

## Other checks that passed

- `--clips p4 --alpha` on `mon-D-fp`: clip QA PASS (prores, content, freeze).
- The sheet with `--stills`, and the mp4 fallback with the frames folder hidden: work.
- D's unit test re-run: output byte-identical to `reports/D-r2/unit/cont-unit.out.txt`.
- `node --check` passes on all five edited `.mjs` files.
- Diff size: 6 files, ~180 added lines, 12 changed. The long lines match the existing style in qa.mjs.

## Files

- **Repro jobs:**
  - `jobs/mon-D-fp/` (false-positive probe, 16x9 and 1x1, rendered, sheets built)
  - `jobs/mon-D-fp-base/` (same frames, sheet built with the base tool)
  - `jobs/mon-D-matrix/`
  - `jobs/mon-D-old-*` (input-only clones of the old jobs, the S templates and r2-dev)
  - `jobs/mon-D-bytes-*` (byte-identity clones)
  - `jobs/mon-D-steady`, `mon-D-probe-cont`, `mon-D-probe-flip` (clones of D's jobs)
- **Tools** (`reports/D-monitor/tools/`):
  - `camsurvey.mjs` (seek-only camera log + continuity; `STAGE=<skill dir>`)
  - `cutdump.mjs` (per-cut numbers)
  - `compare.mjs` (WARNs from stageD against a patched copy)
  - `survey.sh`
  - `shot.mjs` (page screenshot)
  - `proposed-fix-qa.mjs.diff`
- **Stills** (`reports/D-monitor/stills/`):
  - `fp-p1p2.png` (frames 58–69 around the falsely flagged cut)
  - `fp-p3p4.png`
  - `sheet-1x1-1440.png`, `sheet-1x1-390-crop.png`, `sheet-D-16x9-row.png`
- **Logs:** `jobs/mon-D-logs/*.log`, `reports/D-monitor/survey/*.txt`.
