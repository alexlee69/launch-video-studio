# QA pass 1 (round 2): the merged motion kit after the qa1 fixes, end to end (2026-10-27)

**Verdict: PASS.** Every automated check passes and I found no HIGH visual defect.
- **Films:** all 18 films (6 jobs × 3 aspects) say **QA PASSED**.
- **Layers and clip:** all 6 `--layers` exports pass layer QA, and `--clips --alpha` passes.
- **Review sheet:** it builds its 10 cut stills, and 41 / 41 images load.
- **Last round's HIGH findings are fixed in fresh films:** the flood pop (H1/H3) and the launch30 carry jump (H2).

The previous round's report is kept as `reports/qa1-round1.md`.

**The unflattering part.** M7, which the fixer marked "not reproduced", **reproduces**:
- **What it is:** kit-dev's `fan` first frame (f138) gets `WARN purity` on 16:9 and on 9:16.
- **16:9:** max Δ 19, 328 px.
- **9:16:** max Δ 14, 343 px.
- **Why it matters:** it still differs when the frame is replayed in order, so Rule 2 (pure frames) is broken for a fan with footage cards. It can't be seen in the film.

Three other findings are MEDIUM, and five are LOW. They are listed under Findings below.

**Shorthands**
- `M = /Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit`
- `J = $M/jobs`
- `LV = node $M/stage/product-launch-sting/video/lv.mjs`
- `PY = /Users/bytedance/Downloads/Design-AutoPilot-stable/.venv/bin/python3 -I`

## Priorities

| # | Finding | Priority |
|---|---|---|
| M7 | The fan with footage cards has an impure first frame (`WARN purity`, f138, 16:9 + 9:16). It reproduces on full kit-dev films. | MEDIUM: fix before promoting purity to FAIL |
| M8 | The prv-combo `brief → grid` carry box stays landscape and overhangs two tiles for ≥ 8 frames after the cut. | MEDIUM (known, fixed in part) |
| M3 | 9:16 exploded stacks still fill about a third of the frame's height. | MEDIUM (known, fixed in part) |
| L1–L5 | Empty dive frames, an empty grid clearing, a 2-frame text ghost in a carry, a sparse wall birth, and `--clips`/`--layers` ignoring `--workers` | LOW |

## Decisions I took (no questions asked)

- **Fresh clones under a new prefix.** The `qa1-*` folders from round 1 aren't mine, so I didn't touch them. Mine are `qa1-v2-*`:

  | Job | Made from |
  |---|---|
  | `$J/qa1-v2-kit-dev` | `$J/kit-dev` |
  | `$J/qa1-v2-r2-dev` | `$J/r2-dev` |
  | `$J/qa1-v2-prv-combo` | `$J/prv-combo` |
  | `$J/qa1-v2-sample` | `~/Downloads/launch-videos/motion-kit-sample` |
  | `$J/qa1-v2-l15` | `--init` |
  | `$J/qa1-v2-l30` | `--init` |
  | `$J/qa1-v2-zoom-kit-dev` | `$J/kit-dev`, for one zoom slice |

  The clones were made with `cp -cR` of `beats.yaml`, `assets/` and `brief.md` / `tools/` where present, and no `out/`.
- **I used `$J/r2-dev` as the task named it.** Its `scan` still has `count: 8`. The M5 job fix (`count: 5`) was applied only to `prv-r2-dev` and `qf1-r2`. That's why r2-dev 1:1 reports flash at the limit (L5).
- **Fictional names:** "Lanternfish Notes" (launch15) and "Mossgate Planner" (launch30).
- **Films one aspect at a time, except l15.**
  - l15 ran `--film --aspect all` in one command, to prove the user path (frames are about 250 MB per aspect at 15 s).
  - Every other film ran 16x9, then 9x16, then 1x1, as separate commands at `--workers 2`.
  - After each aspect, `post.sh` saved the stills and then deleted `frames/`, `bgref/`, `textless/` and `purity/`.
  - Each aspect runs its own audio, mux and QA, so the verdicts equal those of `--aspect all`.
- **Cut frames saved before cleanup.**
  - Before deleting a film's frames I saved half-size JPEGs of every 60-fps frame from c−6 to c+8 around every cut, in `stills/<aspect>/cutframes/<cut>/`.
  - Later zooms were built from those (`zoomcf.py`), so only one re-render was needed (the kit-dev grid slice).
- **Hero stills for 9:16 and 1:1.**
  - I read the storyboard hero sheets of every job and the film hero sheets of sample, prv-combo and kit-dev.
  - `sheets.py --heroes` diffs each film hero frame (60-fps index `(f0 + heroF) × 2`) against `board/NN-id.png`. Every hero matches at max Δ ≤ 6, except:
    - the 3-D fan heroes (antialiasing and footage-frame variance, judged identical by eye: L7 from round 1);
    - r2-dev `wall` (max 42, 16 px);
    - l30 `many` on 9:16 (max 32).
- **Python.** `/usr/bin/python3` has no PIL, so the still tools run on the repo `.venv` Python with `-I`. The tools are my own, in `$J/qa1-v2-tools/` (`sheets.py` is adapted from round 1's).
- **Shots for the six layer exports:**

  | Type | Shot |
  |---|---|
  | press | l15 `ask` (the starter users will export) |
  | fan | kit-dev `fan` (footage cards) |
  | particles | sample `globe` |
  | map | sample `route` |
  | exploded stack | sample `booked` |
  | carry | l30 `result` (`carry: {el: card, to: after}`, in clean mode) |

  The `--clips --alpha` shot is l15 `scale`: a fan with `from: card`, in clean mode with no origin.

## Commands and results

Logs are in `$J/qa1-v2-logs/<step>.log`. `summary.txt` holds the rc, time and free GiB for each step.

The runner `$J/qa1-v2-tools/run.sh` runs one step at a time, waits 180 s while `pmset -g therm` reports a warning, and skips a step under 25 GiB free.

### Setup (rc 0)

```
LV --job $J/qa1-v2-l15 --init --kit launch15 --title "Lanternfish Notes"   # brief.md, beats.yaml, 5 placeholder SVGs (incl. placeholder-screen.svg)
LV --job $J/qa1-v2-l30 --init --kit launch30 --title "Mossgate Planner"    # + placeholder-wipe-before/after.svg (7 SVGs)
LV --blocks                                                                 # rc 0: press, fan, particles, map + wall grid, type words, stack exploded with every field
```

### `--grid` (all rc 0, about 1 s each)

| Job | `!` lines |
|---|---|
| kit-dev | 1:1 fan bleed note; reading time for map (4.00 s vs 4.05 s), pr-send and pr-toggle; no cause on sphere, grid and wall-grid |
| r2-dev | reading time for ask, go and end; "4 transition types" |
| prv-combo | fan bleed note; reading time for route and end |
| sample | fan bleed note; "3 transition types" (deliberate) |
| l15 | **none** |
| l30 | **none** (round 1's L3 reading-time warning is gone) |

### `--storyboard --aspect all` (all rc 0)

| Job | Time | Hero sheets |
|---|---|---|
| l15 | 26 s | `$J/qa1-v2-l15/stills/{16x9,9x16,1x1}/board-heroes.png` |
| l30 | 34 s | `$J/qa1-v2-l30/stills/*/board-heroes.png` |
| sample | 29 s | `$J/qa1-v2-sample/stills/*/board-heroes.png` |
| prv-combo | 29 s | `$J/qa1-v2-prv-combo/stills/*/board-heroes.png` |
| r2-dev | 39 s | `$J/qa1-v2-r2-dev/stills/*/board-heroes.png` |
| kit-dev | 47 s | `$J/qa1-v2-kit-dev/stills/*/board-heroes.png` |

The notes print only the known text-floor lines: the 31 px URL, 33–36 px capitals tags, and 35 px kit chips.

### `--film` (`--workers 2`): every aspect QA PASSED

| Job | 16:9 | 9:16 | 1:1 | WARN lines |
|---|---|---|---|---|
| l15 (`--aspect all`, 486 s) | PASSED (17) | PASSED (17) | PASSED (17) | text (URL 31 px; "Output" caps); contrast (URL 3.7:1; "Output" Lc 54) |
| sample | PASSED (16), 320 s | PASSED (16), 312 s | PASSED (16), 243 s | text (35 px chips, "Day 4", URL); contrast (URL Lc 51) |
| prv-combo | PASSED (16), 344 s | PASSED (16), 357 s | PASSED (16), 261 s | text; contrast (end card Lc 51 / 53). Deadair is only INFO now: `meet` 0.92 s, was WARN 1.62 s |
| r2-dev | PASSED (16), 411 s | PASSED (16), 418 s | PASSED (16), 288 s | text; contrast (`POSTED` / `TEASER 1` Lc 54). The 1:1 flash is INFO "at most 3 flashes in any second" (L5) |
| l30 | PASSED (20), 353 s | PASSED (20), 340 s | PASSED (20), 257 s | text (Before / After 33 px caps, URL); contrast (Output / After Lc 54, URL Lc 51) |
| kit-dev | PASSED (20), 623 s | PASSED (20), 624 s | PASSED (20), 442 s | 16:9: text (35 px chips) + **purity fan f138**. 9:16: **purity fan f138**. 1:1: none. Contrast is only INFO (worst "Generate" 4.6:1 Lc 77), so the grid headline WARN (round 1's M6) is gone |

- **Continuity:** INFO "all hold" on every film. Speed ratios are 1.0–2.24×, and the highest is kit-dev `grid → terrain`, a whip.
- **Purity:** sample, prv-combo and kit-dev 1:1 give INFO "differs only out of order" on a fan frame (Chrome raster history, as before).

**Stills I read, per job:**
- **Cuts:** `stills/16x9/cuts-NN.png`, one row per cut showing c−8, c−3, c−1, c, c+1, c+2 and c+8.
- **Heroes:** `stills/<aspect>/heroes.png` (film) and `stills/<aspect>/board-heroes.png` (storyboard), with `hero-vs-board.txt` in each aspect folder.
- **Zooms:** `stills/<aspect>/zoom-<cut>.png` (c−6 … c+8 from the saved cut frames).

| Job | Cuts (16:9) | Cut sheets |
|---|---|---|
| l15 | 7 | `$J/qa1-v2-l15/stills/16x9/cuts-01..03.png`; zooms `zoom-360.png`, `zoom-480.png`, `9x16/zoom-480.png` |
| sample | 10 | `$J/qa1-v2-sample/stills/16x9/cuts-01..04.png`; zooms `zoom-540.png`, `zoom-900.png`, `9x16/zoom-360.png` |
| prv-combo | 9 | `$J/qa1-v2-prv-combo/stills/16x9/cuts-01..03.png`; zooms `zoom-900.png`, `zoom-900-landing.png`, `zoom-1080.png`, `zoom-1260.png`, `9x16/zoom-180.png`, `9x16/zoom-900.png`, `1x1/zoom-1080.png` |
| r2-dev | 9 | `$J/qa1-v2-r2-dev/stills/16x9/cuts-01..03.png`; zooms `zoom-435.png`, `zoom-784.png` |
| l30 | 14 | `$J/qa1-v2-l30/stills/16x9/cuts-01..05.png`; zooms `zoom-630.png`, `9x16/zoom-630.png`, `9x16/zoom-960.png` |
| kit-dev | 14 | `$J/qa1-v2-kit-dev/stills/16x9/cuts-01..05.png`; slice `$J/qa1-v2-zoom-kit-dev/stills/16x9/zoom-{712,740,766}.png` |

### Review sheet

`LV --job $J/qa1-v2-sample --sheet --aspect 16x9` gives rc 0 in 5 s and writes `$J/qa1-v2-sample/review/wayfinch-16x9/`:
- 11 shot thumbs.
- 10 cut stills `thumbs/cut.<f>.jpg`, at cut−1 / cut / cut+1.
- Each `sheet.json` row carries `cut.stills`.

A full-page screenshot via system Chrome (`$J/qa1-v2-tools/shot-sheet.mjs`) loaded **41 / 41 images, 30 of them cut-still tiles**. It's in `$J/qa1-v2-sample/stills/sheet/sheet-preview-16x9.png`, and in parts at `part-00..03.png`.

What I checked on the sheet:
- **Continuity lines read correctly:**
  - "camera: speed 14608 → 12001 px/s (1.22×) · fastest on the cut"
  - "1 carried object, continuous"
- **The shot strip's labels are truncated** ("gl…", "na…"), which is round 1's L5 fix.

### Layers (16:9): all pass layer QA

Each run's movs and work folder were deleted afterwards. The manifest, the contact sheet and the .jsx are kept in `stills/layers/<id>/`.

| Shot (block) | Layers, back to front | Restack worst | Time |
|---|---|---|---|
| l15 `ask` (press) | backdrop, control, label, rings, cursor | max Δ 4, 0 px > 16 | 51 s |
| kit-dev `fan` (fan, footage) | text, cards, labels | max Δ 48, 15 px > 16 (limit 64) | 87 s |
| sample `globe` (particles sphere + orbits) | particles, orbits | max Δ 4 | 36 s |
| sample `route` (map) | map, route, pins, labels, text | max Δ 4 | 53 s |
| sample `booked` (stack exploded) | text, planes, leaders, labels | max Δ 5 | 38 s |
| l30 `result` (float with `carry`, clean) | streak, card, brackets, label | max Δ 4 | 48 s |

Every layer export also passes the order, format (ProRes 4444 alpha, 1920×1080), nonempty and opaque-background checks.

I read two contact sheets, and both are correct:
- `$J/qa1-v2-sample/stills/layers/route/wayfinch-route-16x9-layers.png`
- `$J/qa1-v2-l15/stills/layers/ask/lanternfish-notes-ask-16x9-layers.png`

### Clip

`LV --job $J/qa1-v2-l15 --clips scale --alpha --aspect 16x9` gives rc 0 in 18 s:
- **PASS clip:** ProRes 1920×1080 yuva444p12le, 45 / 45 frames.
- **PASS content** and **PASS freeze**.
- **Files:** `$J/qa1-v2-l15/clips/lanternfish-notes-scale-16x9-alpha.mov`, `-16x9-preview.mp4` and `-sfx.wav`.
- **Preview stills:** `$J/qa1-v2-l15/stills/clips/scale-preview-strip.png`. In clean mode the hero grows from the centre, then the deal spreads. Fine.

### Zoom slice (separate clone)

`LV --job $J/qa1-v2-zoom-kit-dev --film --aspect 16x9 --range 700,780 --no-purity --workers 2` wrote its 81 frames in 25 s and ended rc 1 by design ("81/2664 on disk"). Its sheets are `zoom-712.png`, `zoom-740.png` and `zoom-766.png`.

## Round 1 findings re-checked in fresh films

| Round 1 | Now | Evidence |
|---|---|---|
| H1 / H3: flood → `from: <box>` pop | **fixed.** prv-combo f180 and r2-dev f145 are born as a speck at the send spot and grow over about 6 frames, on 16:9 and 9:16 | prv-combo `cuts-01.png` row 1, `9x16/zoom-180.png`; r2-dev `cuts-01.png` row 1 |
| H2: launch30 carry shape jump | **fixed.** The card's outline goes from landscape to square continuously across f625–636 (16:9 and 9:16). See L3 for the remaining 2-frame text ghost | l30 `zoom-630.png`, `9x16/zoom-630.png` |
| M1: launch15 `result → scale` | **fixed.** It re-crops over f480–485, with no jump | l15 `zoom-480.png`, `9x16/zoom-480.png` |
| M2: starter placeholders on 9:16 | **fixed.** "YOUR SCREEN / a screenshot or screen recording" reads whole, and BEFORE / AFTER sit by the divider | l15 / l30 `9x16/board-heroes.png` |
| M4: dives landing near empty | **mostly fixed.** The sphere is about 500 px on the cut (`zoom-1080.png`), and the panel is readable at +8. See L1 for the prv-combo dive into a point | |
| M5: r2-dev 1:1 flash | **fixed only in `prv-r2-dev`.** The `$J/r2-dev` source still has count 8, so it measures INFO "at most 3 flashes" (L5) | |
| M6: grid headline contrast | **fixed.** INFO in all aspects | kit-dev logs |
| M9: prv-combo `meet` deadair | **fixed (job).** INFO 0.88–0.95 s | prv-combo logs |
| L1: terrain hard edge on whip-in | **fixed.** It fills to the left edge | kit-dev `cuts-02.png` row 2 |
| L2: end card fades in by opacity | **fixed.** It rises after a morph | sample `cuts-04.png`, r2-dev `cuts-03.png` |
| L3: launch30 grid warning | **fixed.** No `!` lines | `l30-grid.log` |
| L5: sheet strip overlap | **fixed** | `sheet/part-00.png` |
| M7, M8, M3 | **still open**, see Findings | |

## Findings

### HIGH

None. Nothing I saw is clipped, empty for longer than a blink, or pops in at full size out of a flat frame, and none of the new devices jumps across a cut.

### MEDIUM

| # | What | Repro / evidence | Suggested fix |
|---|---|---|---|
| **M7** | **The fan with footage cards has an impure first frame. It reproduces.** In the kit-dev film, `fan` f138 differs from its in-order replay: 16:9 max Δ 19, 328 px (share 0.016 %); 9:16 max Δ 14, 343 px. 1:1 passed (only frame 292, out of order, INFO). This is `WARN purity` ("something on the page isn't a function of t … a footage frame that wasn't ready"). It can't be seen, but it breaks Rule 2 on a new block. | `LV --job $J/qa1-v2-kit-dev --film --aspect 16x9 --workers 2` (a full film; shorter slices didn't show it for the fixer). `$J/qa1-v2-kit-dev/out/main/16x9/purity.json` → `replay` entry `i: 138`, `again: {max: 19, over: 328}`. Same in `9x16/purity.json`. | Await the first footage frame decode in the fan's card set-up (as stack and wall do), or pre-seek the card videos before the shot's first frame is drawn. |
| **M8** | **The prv-combo `brief → grid` carry still reads as a foreign box.** The landscape prompt box lands on a near-square tile. From f900 to at least f908 it overhangs the neighbouring tiles at landscape shape. f898–899 show a frosted pink blend of the two looks while still on the light background. This is known and fixed in part. | `$J/qa1-v2-prv-combo/stills/16x9/zoom-900.png`, `zoom-900-landing.png`, `9x16/zoom-900.png` | Morph the box's aspect to the tile's in the flight (before the cut), not after landing, or carry onto a box of a similar shape. |
| **M3** | **9:16 exploded stacks still under-fill.** kit-dev `exploded-low` uses about 31 % of the height on a dark frame, and sample `booked` leaves the lower third empty. This is known and fixed in part. | `$J/qa1-v2-kit-dev/stills/9x16/board-heroes.png`, `$J/qa1-v2-sample/stills/9x16/heroes.png` | As GUIDE Limits says: a vertical layout for 9:16 (labels under the planes, not beside them). |

### LOW

| # | What | Repro / evidence |
|---|---|---|
| L1 | **The prv-combo `orbit → words` dive at `[0.5, 0.32]` passes through empty space.** f1257–1259 are near-flat (luma sd 3.3–5.0, p99 ≤ 43), then f1260 shows a small blurred "Brief." on black. That's about 0.05 s of nothing at the dive's peak. | `$J/qa1-v2-prv-combo/stills/16x9/zoom-1260.png`; frames `stills/16x9/cutframes/01260/`. Fix: dive with `el:` into the dot cluster, or aim the point at the sphere's dense band. |
| L2 | **The particles `mode: grid` headline clearing is there from frame 0, but the headline starts at `textAt` = 8 (30 fps).** For about 0.27 s (f702–f716) the frame shows an empty white oval in the dot field before the text starts to blur in. | `$J/qa1-v2-zoom-kit-dev/stills/16x9/zoom-712.png` (re-render: `--range 700,780`). In `engine/blocks/particles.js`, `hole()` (about l.137) is not tied to `tIn`. Fix: scale `hb.rx` / `hb.ry` by the text's entrance progress. |
| L3 | **The H2 fix leaves a 2-frame text ghost.** In the l30 `result → inout` carry, "YOUR SCREEN" double-exposes at two scales on f628–629 (the blend under the blur). It's 33 ms with heavy motion blur, so barely visible, but it's there. | `$J/qa1-v2-l30/stills/16x9/zoom-630.png`, `9x16/zoom-630.png` |
| L4 | **r2-dev dev-job choices read weakly.** In `again → wall` (`from: card`), f785–790 show one shrinking card on an almost empty white frame before the wall gathers. Dives `pick → teaser` (pink → navy) and `wall → plan` (white → black) jump colour across the cut. | `$J/qa1-v2-r2-dev/stills/16x9/zoom-784.png`, `zoom-435.png`, `cuts-03.png`. These are job content, not engine. |
| L5 | **Two job and tooling items:** (a) the `$J/r2-dev` source didn't get the M5 fix, so its 1:1 film sits at the WCAG 2.3.1 limit ("at most 3 flashes in any second"); (b) `--clips` and `--layers` ignore `--workers` (always 4: `lv.mjs` l.293, 305, 337), which matters under the heat rule. | `$J/qa1-v2-logs/r2-dev-film-1x1.log`; `diff $J/r2-dev/beats.yaml $J/prv-r2-dev/beats.yaml` |

### INFO (by design or unchanged)

- **Pre-rolled entrances on a hard cut.** The wall grid lands about 60 % built (`wall.js` l.82), and the fan hero about 90 % grown (`fan.js` l.24): sample f900, l30 f1050 and 9:16 f960. They read as cuts, not pops.
- **3-D fan heroes differ from the storyboard only in antialiasing or a footage frame** (max Δ up to 230 on 9:16 prv-combo `formats`). They are visually identical.
- **Old blocks.** `stat` opens on "0×" before counting, and `split` / `endcard` enter by scale and opacity. These are old blocks, not kit items.
- **The known WARN set:** 31 px URL, 33–36 px capitals tags, 35 px kit chips, end card and tagline at Lc 50–54.

### Looked at, judged fine

These were checked and are not defects:
- **The flood cuts:** born small at the pressed spot (l15, l30, sample, prv-combo, r2-dev).
- **The carries:**
  - sample `spots → day`: same place and size.
  - r2-dev `teaser → post` and the needle `post → again`.
  - prv-combo `meet → end`: a needle on the logo.
- **The morphs:**
  - r2-dev `plan → go`.
  - `go → end` to the frame, where the end card rises.
- **The dives:**
  - sample `globe → name`.
  - sample `day → words`: the cove image carries through.
  - prv-combo `grid → orbit` and r2-dev `wall → plan`.
- **Every press, fan, particles, map, wall grid, words and exploded entrance in kit-dev.**
- **The press label roll** "Generate → Generating…".

## Heat, disk, hygiene

- **Heat.**
  - Every render ran alone through `run.sh`, which runs the steps in order: grids → storyboards → 16 film commands → 6 layers → 1 clip → 1 slice.
  - `pmset -g therm` never reported a warning; it said "No thermal / performance warning level has been recorded" throughout.
- **Disk.**
  - Free space started at 30.3 GiB and stayed at 27–29 GiB. It is 28.2 GiB (30.3 GB) at the end.
  - Deleted, for every qa1-v2 job and aspect: frames/, bgref/, textless/ and purity/ (by `post.sh`, right after its stills); the layer movs and work folders (`layclean.sh`); the clip frames; and the zoom slice's frames and bgref.
  - Kept: mp4s, qa.json, purity.json, cams.json, logs, stills, cut-frame JPEGs, the alpha clip and the review sheet.
- **Untouched.**
  - **Stage:** the sorted shasum of 123 files is identical at start and end (`$J/qa1-v2-logs/stage-sha-{start,end}.txt`).
  - **Live skill:** `shasum -c live-before.sha1` gives 867 OK.
  - **0 files newer than this pass's start** in `base/`, `live-before/`, `~/Downloads/launch-videos/` and the source jobs `kit-dev`, `r2-dev` and `prv-combo`. The sample was only copied.
- **Not done.** No commit or push, no paid API, no `--go`, nothing run under `qa/video-skill-learnings/skills/`, and no research frames or private footage copied. The astronaut clips are kit-dev's own dev assets and stayed in the dev clones.
- **Files.** I overwrote `reports/qa1.md` as the task asked, after copying round 1's report to `reports/qa1-round1.md`.

## Ask

1. **Fix M7 in `fan.js`'s footage set-up**, then re-run the kit-dev 16:9 film. This is a full film, since the slices hide it.
2. **Decide whether the M8 carry and the L2 grid clearing are worth a pass before the sample is re-rendered.** Both show in the sample's sibling jobs, not in the sample itself.
3. **Mirror the M5 `count: 5` into `$J/r2-dev`** (or retire it in favour of `prv-r2-dev`), so the next QA clones the fixed job.
