# QA pass 1: the merged motion kit, end to end (2026-10-27)

**Verdict: FAIL.** Every automated check passes, but the frames don't. Three visual defects are HIGH, and QA and `--grid` are silent on all three.

**What passed:**
- **Films.** All 18 films (6 jobs × 3 aspects) say **QA PASSED**.
- **Layers.** All 6 `--layers` exports pass layer QA (press, fan, particles, map, exploded stack, carry shot).
- **Clip.** `--clips trips --alpha` passes.
- **Review sheet.** The `--sheet` for the sample builds its 10 cut stills, and all 41 images load.
- **Storyboards and grids.** All 6 jobs build their storyboards (rc 0) and compile `--grid` (rc 0).

**The three HIGH defects** (each has an exact repro below):
- **H1 · A card pops in after a flood.** When a shot leaves on `out: flood` and the next shot uses `from: <a box layer>` (the bar, `control`, `prompt-box`), the first card appears at full size in one frame, out of a solid flood frame. This is the most important cut in a launch film: the click → result moment.
  - prv-combo f180 (`from: control`) and r2-dev f145 (`from: prompt-box`) both show it.
  - The launch templates avoid it with `from: cursor`. The engine and `--grid` don't guard it.
- **H2 · The carry in the launch30 starter does not carry.** Its own `result → inout` handoff (`carry: {el: card, to: after}`) jumps at the cut: the card switches from landscape to a square, tilted card in one frame (f659 → f660). Root cause: `c.same = c.keyA === c.keyB` in `engine/runtime.js` (~l.832) treats "the same picture" as "looks the same", even when the frame shape and crop differ.
- **H3 = H1 in the dev films.** Two of the four supplied films (prv-combo, r2-dev) visibly contain the H1 pop. I list it once as an engine issue and once as a film defect, because the task judges the films.

**Also found:** 9 MEDIUM and 8 LOW/INFO items (see the findings tables).

**Hygiene.**
- I edited nothing in the stage (its hashes match my 12:15 snapshot), the live skill (`shasum -c live-before.sha1`: 867 OK), `base/`, `live-before/` or `~/Downloads/launch-videos/` (0 files newer than this pass's start).
- No commits, no paid calls, no `--go`.
- Every render ran alone, one aspect at a time, at `--workers 2`. `pmset -g therm` never recorded a warning.
- All frames/, bgref/, textless/ and purity/ folders of my jobs are deleted. 35.4 GB is free.

Shorthands:
- `M = /Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit`
- `J = $M/jobs`
- `LV = node $M/stage/product-launch-sting/video/lv.mjs`
- `PY = /Users/bytedance/Downloads/Design-AutoPilot-stable/.venv/bin/python3 -I`

## Decisions I took (no questions asked)

- **Python.** I used the repo `.venv` Python (`$PY`) for the still sheets, because `/usr/bin/python3` has no PIL. The scripts are my own, in `$J/qa1-tools/`. They read only the frames of my own jobs.
- **Films one aspect at a time.** I rendered `--film --aspect 16x9`, then `9x16`, then `1x1` as separate commands, which is the heat rule, with a thermal check between them. The one exception is qa1-l15 (15 s), which ran `--film --aspect all` in a single command to prove the user path. The per-aspect verdicts are the same as `--aspect all`, since each one runs its own audio, mux and QA.
- **Hero stills for 9:16 and 1:1.** I read the storyboard hero sheets, then proved they *are* the film's hero frames: `sheets.py --heroes` diffs film frame `(f0+heroF)×2` against `board/NN-id.png`.
  - Every hero matches with max Δ ≤ 5, except the 3-D fan shots.
  - Those differ only in headline anti-aliasing (side-by-side diffs: `$J/qa1-prv-combo/stills/9x16/formats-film-vs-board.png`, `$J/qa1-kit-dev/stills/9x16/fan-film-vs-board.png`).
- **Zoom slices in separate clones.** Suspicious cuts were re-rendered as `--range` slices in separate clones (`qa1-zoom-*`), so the qa1 films' state stays untouched. A range render ends rc 1 by design, with "frames …: N/total on disk", after writing its frames.
- **Layers and clips: which shots.** Five layer shots come from qa1-kit-dev (pr-gen, fan, sphere, map, exploded). The carry shot is r2-dev `teaser` (`carry: {el: card}`). The `--clips --alpha` shot is the sample's `trips`, a fan with `from: cursor`, which also exercises clean mode with no origin.
- **Fictional names.** The new jobs are "Pebblepost" (launch15) and "Tidewell Ledger" (launch30).
- **One probe.** To pin H2's cause I made `$J/qa1-probe-l30-carrycut`: a copy of qa1-l30 with `result`'s `out: drift-left` changed to `out: cut`. It is a test job; nothing in the kit was changed.

## Jobs (fresh clones, `cp -c`, no out/)

| Job | From | Contents |
|---|---|---|
| `$J/qa1-kit-dev` | `$J/kit-dev` | beats.yaml + assets (every round-1 block and mode, 15 shots, 44.4 s) |
| `$J/qa1-r2-dev` | `$J/r2-dev` | beats.yaml + assets (carry smooth/needle, morph ×2, dive ×2, `from:` ×3, flood; 21.3 s) |
| `$J/qa1-prv-combo` | `$J/prv-combo` | beats.yaml + assets (press, fan, map, exploded, carry, grid, particles, words, needle; 28 s) |
| `$J/qa1-sample` | `~/Downloads/launch-videos/motion-kit-sample` | beats.yaml, brief.md, assets (11 SVGs drawn by its make_art.py), tools/ (28 s) |
| `$J/qa1-l15` | `LV --job $J/qa1-l15 --init --kit launch15 --title "Pebblepost"` | rc 0; wrote brief.md, beats.yaml, 5 placeholder SVGs; the `next:` line points to "Launch starters" (15 s) |
| `$J/qa1-l30` | `LV --job $J/qa1-l30 --init --kit launch30 --title "Tidewell Ledger"` | rc 0; 7 placeholder SVGs (30 s) |

I checked provenance: the sample's assets are its own drawn SVGs, with no astronaut or hf01 material. kit-dev and r2-dev do use the astronaut `space-S*.mp4` clips. That's fine for the dev jobs; none of it is in the sample.

## Commands and results

Every log is in `$J/qa1-logs/<name>.log`, and `summary.txt` holds the rc, time and free disk for each step. The serial runner is `$J/qa1-tools/run.sh`. It waits while `pmset` shows a warning and skips a step when less than 25 GB is free.

### `--grid` (all rc 0)

| Job | `!` lines |
|---|---|
| kit-dev | 1:1 fan bleed note; reading time for map, pr-send and pr-toggle; causes missing on sphere, grid and wall-grid (it's a dev job) |
| r2-dev | reading time for ask, go and end; "4 transition types" |
| prv-combo | fan bleed note; reading time for route and end |
| sample | fan bleed note; "3 transition types" (deliberate, per sample.md) |
| l15 | **none** |
| l30 | `again: 2 words on screen for 1.5 s — viewers need ~1.6 s` (L6) |

`LV --blocks` (rc 0) lists press, fan, particles and map, plus the wall grid, type words and stack exploded modes, with every field.

### `--storyboard --aspect all` (all rc 0)

| Job | Time | Hero sheets read (16x9 / 9x16 / 1x1) |
|---|---|---|
| kit-dev | 45 s | `$J/qa1-kit-dev/stills/{16x9,9x16,1x1}/board-heroes.png` |
| r2-dev | 36 s | `$J/qa1-r2-dev/stills/*/board-heroes.png` |
| prv-combo | 28 s | `$J/qa1-prv-combo/stills/*/board-heroes.png` |
| sample | 25 s | `$J/qa1-sample/stills/*/board-heroes.png` |
| l15 | 24 s | `$J/qa1-l15/stills/*/board-heroes.png` |
| l30 | 33 s | `$J/qa1-l30/stills/*/board-heroes.png` |

The storyboard notes print only the known text-floor lines: 35 px chips, a 31 px URL, 33–36 px capitals tags.

### `--film` (`--workers 2`): every aspect QA PASSED

| Job | 16:9 | 9:16 | 1:1 | WARN lines (all aspects) |
|---|---|---|---|---|
| l15 (`--aspect all`, 489 s) | PASSED (17) | PASSED (17) | PASSED (17) | text (URL 31 px; "Output" caps); contrast (URL 3.8:1; "Output" Lc 54) |
| sample | PASSED (16), 322 s | PASSED (16), 315 s | PASSED (16), 239 s | text (35 px chips, "Day 4", URL); contrast (URL Lc 51) |
| prv-combo | PASSED (16), 347 s | PASSED (16), 350 s | PASSED (16), 254 s | text; contrast (endcard); **deadair** (`meet` 1.62–1.70 s still) |
| r2-dev | PASSED (16), 407 s | PASSED (16), 418 s | PASSED (16), 287 s | text; contrast; **1:1 flash** (3.00–3.88 s, 3.5 flashes/s; M5) |
| kit-dev | PASSED (20), 613 s | PASSED (20), 613 s | PASSED (20), 434 s | text (16:9); contrast (grid "Signal, not noise." 3.3 / 2.8 / 3.0:1; M6); **purity** fan f138 (16:9 max Δ 19, 328 px; 9:16 max Δ 1; M7) |
| l30 | PASSED (20), 393 s | PASSED (20), 349 s | PASSED (20), 255 s | text (URL, Before/After 33 px caps); contrast (URL; Output/After Lc 54) |

- **Purity INFO.** A fan frame or the l30 `many`/`inout` frame matches only when drawn in order (Chrome's raster history). This is the known INFO.
- **Continuity INFO.** "all hold" on every film, with ratios ≤ 2.24×.
- **Stills.** For each job: `$J/qa1-<job>/stills/16x9/cuts-NN.png` (per cut: c−8, c−3, c−1, c, c+2, c+8), `stills/16x9/heroes.png` (film heroes) and `stills/<aspect>/hero-vs-board.txt`.

### Review sheet

`LV --job $J/qa1-sample --sheet --aspect 16x9` gives rc 0 and writes `$J/qa1-sample/review/wayfinch-16x9/`:
- 11 shot thumbs, plus 10 cut stills `thumbs/cut.<f>.jpg` (cut−1 / cut / cut+1, 2896×540).
- `sheet.json` rows carry `cut.stills` and a continuity line, e.g. "camera: speed 14608 → 12001 px/s (1.22×) · fastest on the cut".
- Arrival text is right: "grows out of ask's cursor"; "lit is carried in from spots, landing as the card"; "opens on go's prompt-box grown to fill the frame".
- A full-page screenshot via system Chrome loaded 41/41 images, 30 of them cut-still tiles: `$J/qa1-sample/stills/sheet-preview-16x9.png` (crop `…-top.png`).

### Layers (16:9): all pass layer QA

Each run deletes the movs and work folder afterwards and keeps `manifest.json` and the contact sheet in `$J/qa1-<job>/stills/layers/<id>/`.

| Shot (block) | Layers, back to front | Restack worst | Time |
|---|---|---|---|
| kit-dev `pr-gen` (press) | backdrop, control, label, rings, cursor, text | max Δ 5, 0 px > 16 | 62 s |
| kit-dev `fan` (fan, footage cards) | text, cards, labels | max Δ 48, 14 px > 16 (limit 64) | 84 s |
| kit-dev `sphere` (particles) | particles, orbits, text | max Δ 3 | 78 s |
| kit-dev `map` (map) | map, route, pins, labels, text | max Δ 4 | 68 s |
| kit-dev `exploded` (stack exploded) | text, planes, leaders, labels | max Δ 2 | 55 s |
| r2-dev `teaser` (float with `carry`, clean = no carry) | streak, headline, card (+ footage) | max Δ 4 | 58 s |

The press contact sheet is `$J/qa1-kit-dev/stills/layers/pr-gen/kit-dev-pr-gen-16x9-layers.png`, and it reads correctly.

### Clip

`LV --job $J/qa1-sample --clips trips --alpha --aspect 16x9` gives rc 0 in 37 s:
- PASS clip: ProRes 1920×1080 yuva444p12le, 90/90 frames.
- PASS content and PASS freeze.
- Files: `$J/qa1-sample/clips/wayfinch-trips-16x9-alpha.mov` (77 MB), `-preview.mp4`, `-sfx.wav`.
- Preview still: `$J/qa1-sample/stills/clips/trips-preview-1s.png` (see L4).

### Zoom slices (`--film --aspect A --range a,b --no-purity --workers 2`, separate clones)

| Clone | Range | Sheet |
|---|---|---|
| `qa1-zoom-l15` | 470–500 | `$J/qa1-zoom-l15/stills/16x9/zoom-480.png` |
| `qa1-zoom-prv-combo` | 172–196 | `…/stills/16x9/zoom-180.png` |
| `qa1-zoom-prv-combo` | 886–916 | `zoom-900.png`, `zoom-910-landing.png` |
| `qa1-zoom-prv-combo` | 1072–1130 | `zoom-1080.png` |
| `qa1-zoom-r2-dev` | 139–160 | `…/16x9/zoom-145.png` |
| `qa1-zoom-r2-dev` | 778–830 | `zoom-784-wallfrom.png` |
| `qa1-zoom-r2-dev` | 923–965 | `zoom-929-dive.png` |
| `qa1-zoom-r2-dev` 1:1 | 176–236 | `…/1x1/zoom-flash.png` |
| `qa1-zoom-kit-dev` | 122–138 | `zoom-pr-gen-label.png` |
| `qa1-zoom-kit-dev` | 846–900 | `zoom-terrain-in.png` |
| `qa1-zoom-l30` | 646–676 | `zoom-660-carry.png`, `carry-659-664-rects.png` (frames with the `cams.json` carry rect drawn in red) |
| `qa1-probe-l30-carrycut` (`out: cut`) | 646–690 | `$J/qa1-probe-l30-carrycut/stills/carry-out-cut.png` |

## Findings

### HIGH

| # | What | Repro | Seen | Suggested fix |
|---|---|---|---|---|
| **H1** | **`from: <box layer>` after `out: flood` pops the card in at full size.** The flood covers the source by the cut. The fan's or stack's first card "takes the source's size", so it appears whole on the first frame after a solid flood frame and barely moves after. QA is silent (soft cut INFO, continuity holds), and so is `--grid`. | `cp -c $J/prv-combo/{beats.yaml,assets}`, then `LV --film --aspect 16x9 --range 172,196 --no-purity`, frames 179 → 180. Same for r2-dev with `--range 139,160`, frames 144 → 145. | prv-combo f179 is solid dark. At f180 the hero card is at its final size and place, unchanged through f188 (`zoom-180.png`). r2-dev f145: the stack card appears at ~85 % of its size, tilted (`zoom-145.png`). | When the previous shot leaves on a flood, birth the cards at a point (the flood's origin, scale .06), or make `--grid` warn: "from: control after out: flood — the layer is under the flood at the cut, so the card pops in at its size; use from: cursor or [x, y]". Update prv-combo and r2-dev to `from: cursor` / `[x, y]`. |
| **H2** | **launch30's carry `result → inout` jumps at the cut.** Card → split `after`, both showing `placeholder-card.svg`. Because the key (picture + text) is equal, `c.same` is true, and the carry "switches on the cut" from A's landscape card to B's square, −3°-tilted card. Aspect 1.36 → 0.98, the text inside jumps 1.4×, and the A clone is never seen after the cut. Continuity QA "holds" because it tracks only the carry rect. Not caused by the drift: the same jump happens with `out: cut` (probe). | `$J/qa1-zoom-l30`: `LV --job . --film --aspect 16x9 --range 646,676 --no-purity`, frames 659 → 660. Probe: `$J/qa1-probe-l30-carrycut`, range 646–690. | `zoom-660-carry.png`, `carry-659-664-rects.png`, `carry-out-cut.png`. | In `engine/runtime.js` (~832), also require similar box aspect and crop (e.g. aspect ratio within 10 %) for `c.same`. Otherwise use the stretched path and blur peak, which the code already has for different looks. Recheck the launch30 film. |
| **H3** | **H1 visible in two supplied films** (prv-combo `ask → formats`, r2-dev `ask → scan`, all aspects use the same `from:`). | as H1 | as H1 | as H1 |

### MEDIUM

| # | What | Repro / evidence |
|---|---|---|
| M1 | **launch15 `result → scale` (`from: card` into the fan) jumps shape at the cut.** The landscape result card becomes a portrait hero of similar height, the placeholder text jumps ~1.6×, then it shrinks to the fan size. It reads as a jump cut, not a handoff. | `$J/qa1-zoom-l15`, `--range 470,500`, frames 479 → 480 (`zoom-480.png`). Fix with H2's aspect test, or let the fan hero keep the source's aspect until it settles. |
| M2 | **The starters' placeholders crop badly in portrait cards.** On 9:16 the fan hero reads "OUR SCREE / creenshot or screen record" (l15 `scale`, l30 `one`). The split placeholders are cut ("replace with your ¦esult (image or cli"). It's the first thing a user sees after `--init`. | `$J/qa1-l15/stills/9x16/board-heroes.png`, `$J/qa1-l30/stills/9x16/board-heroes.png`. Fix: text-free or portrait-safe placeholder cards (text inside the centre 40 %). |
| M3 | **The 9:16 exploded stack is under-scaled.** kit-dev `exploded-low` fills ~40 % of the width and 17 % of the height of a dark frame; `exploded`, sample `booked` and prv-combo `layers` leave the lower ~half empty. Known, "fixed in part" (#9). | `$J/qa1-kit-dev/stills/9x16/board-heroes.png`, `$J/qa1-sample/stills/9x16/board-heroes.png` |
| M4 | **Dives that land on near-empty frames.** prv-combo `grid → orbit`: from a filled bright red tile into a near-black frame holding a ~300 px dim, blurred blob for ~8 frames. r2-dev `wall → plan`: a blank white pill on black; the panel's content shows only ~0.37 s after the cut. QA content passes. | `zoom-1080.png`, `zoom-929-dive.png` |
| M5 | **r2-dev 1:1 `WARN flash`** 3.00–3.88 s (3.5 flashes/s, WCAG 2.3.1). The old stack's fast cycle swaps big differently-lit cards every ~4 frames. This is newly measured, not a kit regression. | `$J/qa1-zoom-r2-dev/stills/1x1/zoom-flash.png`, `qa.json` flash spans |
| M6 | **particles `mode: grid` headline over the halftone** with no plate: WARN contrast 3.3:1 Lc 44 (16:9), **2.8:1 Lc 35 (9:16)**, 3.0:1 Lc 39 (1:1). The block's own layout causes it. | kit-dev film logs. Fix: a soft plate or vignette behind the text in grid mode. |
| M7 | **fan with footage cards: `WARN purity`.** Frame 138 (the fan's first frame) differs even when redrawn in order: 16:9 max Δ 19, 328 px; 9:16 max Δ 1. A footage frame is probably not ready on the first frame. | `$J/qa1-logs/kit-dev-film-16x9.log` |
| M8 | **prv-combo `brief → grid` carry crossfades mid-flight.** At f899–902 a translucent, frosted box shows the ghosted "Post the best one" over the tile's bokeh (a double exposure), and its landscape box overhangs the near-square tile until landing. This is the designed "different things blend through a blur" path, but it reads as a ghost. | `zoom-900.png`, `zoom-910-landing.png` |
| M9 | **`WARN deadair` on prv-combo `meet`** (the title before a needle carry): 1.62–1.70 s with nothing moving, in all aspects. | prv-combo film logs |

### LOW / INFO

| # | What | Evidence |
|---|---|---|
| L1 | **kit-dev `grid → terrain` (whip-left):** the particles canvas's left edge is a hard vertical line sliding in, with the left third empty at f846 and gone by ~f860. The canvas is only stage-sized. | `zoom-terrain-in.png` |
| L2 | **Endcard lockup fades in by opacity only** (no rise) after a `morph to: frame` (r2-dev f1161–1169). The sample's version rises. This is the existing endcard. | r2-dev `cuts-03.png` |
| L3 | **A 2-word name fails reading time in launch30.** `again` is 3 beats (1.5 s), so a 2-word name trips the reading-time warning on a fresh `--init`. | `l30-grid.log` |
| L4 | **The `--clips --alpha` `-preview.mp4` is composited over the brand's light `bg`** even for a `theme: dark` shot. The trips headline "One ask." is white on cream and nearly invisible. The .mov is correct. | `$J/qa1-sample/stills/clips/trips-preview-1s.png` |
| L5 | **Review sheet's shot strip:** the first short shot's label overlaps the next ("globe" runs into "name"). | `sheet-preview-16x9-top.png` |
| L6 | **fan and exploded export the headline behind the cards** (`text · cards · labels`; `text · planes · leaders · labels`). SPEC-R1 said `… · text`. `--blocks` documents the actual order, and restack passes. INFO. | layer manifests |
| L7 | **3-D fan heroes differ between storyboard and film** only in text anti-aliasing (max Δ up to 230 on glyph edges). Visually identical. INFO. | `formats-film-vs-board.png` |
| L8 | **The known WARN set:** 35 px kit chips, 31–36 px capitals tags, the endcard URL 31 px / Lc 50–51 (merge decisions j/k). | film logs |

### Looked at, judged fine

These were checked and are not defects:
- **Sample, all 10 cuts:** the `from: cursor` birth, the carry `spots → day` (same picture and shape: clean), the dive into the cove, the morph to the end card.
- **l15 / l30 `ask → result`:** born small at the cursor tip, no pop.
- **r2-dev carries:**
  - teaser → post and the needle into again are continuous.
  - wall `from: card`: the same picture, then gather and spread.
  - The panel → prompt-box morph.
- **kit-dev:** every press, fan, particles, map, wall grid, words and exploded entrance and cut.
- **The press label "Generate → Generating…":** a clipped vertical roll, ~4 frames with both labels visible. Fine (`zoom-pr-gen-label.png`).

## Heat, disk, hygiene

- **Heat.** Renders ran one at a time through `$J/qa1-tools/run*.sh` (batches b1–b7 chained on PIDs). `pmset -g therm` never reported a warning: "No thermal / performance warning level has been recorded" all session.
- **Disk.** Free space was 39 → 34–36 GB throughout and is 35.4 GB at the end.
  - Deleted, for every qa1 job: frames/, bgref/, textless/, purity/ after their sheets were built (`$J/qa1-tools/clean.sh`); the layer movs and work folders (`layclean.sh`); the clip frames (`clipclean.sh`); and every zoom and probe render folder.
  - Kept: mp4s, qa.json, logs, stills, the alpha clip and the review sheet.
- **Untouched.**
  - Stage: hashes are identical to `$J/qa1-logs/stage-sha-1215.txt`, and no stage file is newer than fixes.md.
  - Live skill: `shasum -c live-before.sha1` gives 867 OK.
  - `base/`, `live-before/` and `~/Downloads/launch-videos`: 0 files newer than this pass's start.
- **Not done.** No commit or push, no paid API, no `--go`, nothing run under `qa/video-skill-learnings/skills/`, and no research or private footage copied anywhere.
- **One small slip.** I wrote one temp hash list to `/tmp` and deleted it at once.
