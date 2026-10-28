# Worker B, round 1: the frame checks (2026-10-26)

**Bottom line.** Every Worker B check from SPEC-R1 is built in the staging copy
`qa/motion-kit/stageB/product-launch-sting` (called `$S` below):

- dead air
- readable-text floors by `delivery:`
- contrast against textless frames
- flash safety
- reading time
- purity
- storyboard notes

All of them are WARN/INFO only, and every existing PASS/FAIL line is unchanged:

- **Old jobs.** All 13 old-job renders still say `QA PASSED`, with the same PASS count as before. The 14th, `qa-probe`, is the failure fixture. It still FAILs exactly as before: `freeze` and `content`, with identical lines.
- **Planted probes.** Each new check WARNs on its planted probe and stays silent or INFO on the control shots.
- **Byte-identical frames.** Every frame I compared with the live engine is byte-identical: 3,442 full-film frames, plus their 3,442 background refs, a 131-frame `--range` slice, and 84 of 88 storyboard hero PNGs. The other 4 hero PNGs are `wall`/`stack` 3D heroes. The live engine doesn't reproduce those between its own runs either (3 live runs gave 3 different hashes).

**What fires on the old jobs.** The new checks flag real things:

- The film-sample `scan` stack strobes. Dark and white cards alternate about 4.5 times a second over about a quarter of the frame, so it trips the WCAG 2.3.1 flash rule.
- Muted greys and accent blues in the samples miss WCAG AA (4.5:1) on lines under 48 px.
- Shot tails in dark-ui-check hold still with nothing moving.
- Secondary lines in every sample sit under the new floors.

**Three changes from the spec's literal method.** Each is backed by a measurement (§2):

- **Contrast.** It finds glyph pixels by coverage, not by difference. The spec's method passed "Overexposed" at 5.8:1 when it is really 1.1:1.
- **Dead air.** The allowance is the copy's full reading time, not just the reading hold.
- **Purity.** It separates a block that keeps state between frames (WARN) from Chrome drawing the same page slightly differently after a different frame history (INFO). On the pixel test alone, 12 of the 14 old-job renders had frames beyond the spec's tolerance. All of those came from that history effect: identical page state, so no block keeps state.

I made no commits or pushes and no paid calls. I did not edit the live skill, `live-before/`, `stage/` or the original jobs. I only ran the live engine, on clones in `jobs/B-live-*`.

---

## 1 · What changed, file by file (all under `$S/video/`)

| File | Change (vs `stage/`) |
|---|---|
| `engine/runtime.js` (+41 −4) | **Text-hiding switch:** `LV.hideText(true \| 'black' \| 'white' \| false)`. `true` hides every glyph and keeps every box, pill, plate and background. It does this with `-webkit-text-fill-color: transparent` (not `color`, so borders and icons that use currentColor keep their colour), no stroke, shadow or decoration, hidden SVG text, and it hides `background-clip:text` elements. `'black'` / `'white'` fill every glyph solid, for glyph coverage. Text that was already invisible (a transparent fill, e.g. the `.lv-anchor` raster anchor) stays invisible. If it is never called, it changes nothing. **Audit data:** each box also reports `caps`, `outlined`, `clip` and `words` (each word's box). The audit runs after the screenshot, as before. |
| `lib/render.mjs` (+53 −4) | `renderFrames({textless})`: after a page has drawn all of its film frames, it goes back to each audited (hero) frame it drew. It re-shoots the frame and checks it byte-for-byte against the saved one (if it doesn't match, it saves `<n>-real.png` and contrast uses that). Then it shoots the frame with glyphs hidden (`textless/<n>.png`), then solid black and solid white (`<n>-ink0/1.png`), then switches the text back on. Film frames are never drawn with the switch on. `renderFrames({sigs})` (purity): records a hash of the page's *visible* DOM state after each frame, then seeks the page's frames again in reverse order and hashes again. Hidden things are skipped: opacity 0 and display:none subtrees, and a visibility:hidden element's own attributes. Only the SVG filters the frame references count. |
| `lib/qa.mjs` (+264 −9) | Shared thumbnails: the frame thumbnails are now computed once, for content, dead air and flash (content output is unchanged). `textIssues(…, delivery)` adds the `floor` list. New `FLOORS`/`floorsFor`/`floorNote`, `activity`/`deadAir`, `flashCheck`, `wcag`/`apca`/`contrastCheck`, `purityFrames`/`purityCompare`. `qaFilm` prints the new lines after the `text` lines: text floor WARN, contrast, deadair, flash, purity. When a new check is clean it prints **INFO, never PASS**, so the existing `QA PASSED (N checks)` counts are identical. Each new result carries its numbers in `qa.json` under `data`. |
| `lib/timeline.mjs` (+26 −3, reading time only) | `readingTime(text, footage)`. The `--grid` warning now uses need = 0.4 + max(1.0, (0.35·words + 0.5)·k), with k = 1.3 when the shot has a video `bg` and an effective bgDim (shot, then block `bgDefaults`, then .15) below .25. Han/kana count at 6.75 chars/s and Hangul at 9/s. Words are tokens with a letter or digit. `tl.reading = {shotId: {words, chars, k, hold, need}}` is a top-level field, so shot fingerprints don't change. |
| `lv.mjs` (+15 −6) | `--film`: passes `textless`, and clears `textless/` on full renders. After each aspect's render it picks the purity frames, renders them shuffled on one fresh page (`out/<cut>/<aspect>/purity/`) and writes `purity.json`. `--storyboard`: passes `delivery` and prints the floor note. |
| `lib/board.mjs` (+6 −2, notes only) | Each storyboard card notes its must-read text that sits under the floor. The floor line is also in the sheet's "Notes before the film". |

Helpers I wrote outside the skill are in `qa/motion-kit/runs/B/`:

- `calib.mjs`: saves thumbnails plus dead-air and purity strips.
- `summarize.mjs`: one table across every `qa.json`.
- `compareqa.mjs`: existing lines vs a reference `qa.json`.
- Runner scripts: `probes*.sh`, `oldjobs.sh`, `final.sh`, `identity-final.sh`, `wallhero.sh`.

All the logs are next to them.

## 2 · The checks as built: decisions and why

1. **Dead air (`deadair`).** As specified, it uses the content check's 1/10 grey thumbnails and a 12 × 12 block grid. Activity(k) is the largest block's mean |Δ| between frames k and k−2, and a frame counts as still when activity < 8. Runs are split at cuts.
   - **Decision 1: the allowance is the full reading time.** I use max(0.6 s, *need*), where need = 0.4 s assembly + reading hold, not the hold alone. The reason: a run starts while the copy is still settling, because the tail of its ease-out is under the threshold. A 3-word headline's run starts about 0.2 s into the shot. With the hold alone, every plain 2-second headline in the probes fired by about 0.2 s. With *need*, the 3-word controls are silent, and the planted stall still fires at 3.78 s against 1.60 s.
   - **Decision 2: declared holds don't count at all.** Runs are split at holds, not only dropped when they lie wholly inside one. A hold is meant to be still; the stillness around it is still judged.
   - **Length.** A run's length is measured from frame a−2 to frame b.
   - **Message.** It names the shot, the start time, the length and the excess.
2. **Readable floors (extra `text` WARN line).**
   - **Floors.** web 47/35 (16:9), 40/36 otherwise; feed 64/48 (16:9); tv 27/21 (16:9), as web otherwise. These apply to non-`.lv-ui` text at its effective px.
   - **Caps.** A line counts as capitals when it has `text-transform: uppercase`, or its copy has capitals and no lowercase.
   - **No double listing.** Text under 26 px is left out of the floor line, because the existing small/tiny lines already report it.
   - **Unchanged.** The existing < 18 FAIL and < 26 WARN are untouched.
3. **Contrast (`contrast`).**
   - **What it measures.** Each must-read box is measured word by word, so an accent word is measured in its own colour. For each word: the text colour is the median of its glyph pixels in the real frame, the contrast is computed at each glyph pixel against the textless pixel there, and the box's worst is the 2nd percentile.
   - **Thresholds.** It WARNs when WCAG < 4.5 (3 at ≥ 48 px) or APCA |Lc| < 60 (45 at ≥ 48 px). Outlined text is INFO ("check by eye").
   - **APCA check.** My APCA code reproduces the reference values: black on white +106.04, white on black −107.88, #888 on white +63.06.
   - **Decision: glyph pixels come from coverage, not difference.** The spec's core rule (pixels differing from the textless frame by ≥ 60 % of the max) drops exactly the glyph pixels that look like their background, i.e. the unreadable ones. So I take two extra screenshots with every glyph solid black and solid white. Their difference is each pixel's glyph coverage, whatever lies behind it. A glyph pixel is one with coverage ≥ 60 % of the word's fullest.
   - **Proof (probe-contrast s6).** One white word, "Overexposed", straddles a plate that is half near-white and half blue. The coverage method gives **1.09:1 and WARNs**. The spec's difference method gives **5.82:1 and would pass**. See `runs/B/stills/contrast-probe-s6-real-textless-coverage.png`.
   - **Spec method kept.** The difference method is still the fallback (when there are no ink frames) and is recorded per box (`data.rows[].diff`). On every other measured box the two methods agree to within 0.05.
4. **Flash (`flash`).**
   - **Regions.** 25 overlapping windows of W/3 × H/3, at half-window steps, on the grey thumbnails. Luminance is linearised from sRGB and averaged per window.
   - **Transitions.** A transition is a zig-zag leg of ≥ 0.1 whose darker end is < 0.8. A flash is two opposing transitions.
   - **Rule.** It WARNs when more than 3 flashes end within any one second, i.e. ≥ 7 transitions (half-flashes count).
   - **Report.** It gives the time spans and the worst window.
   - **Not covered.** Red flash isn't measured.
5. **Reading time (`--grid`).**
   - **Formula and wording.** As specified (§1). The message keeps the old style and gives the numbers, e.g. `s4: 6 words on screen for 3.0 s — viewers need ~3.8 s (0.4 s to build + 0.35 s a word + 0.5 s, ×1.3 over moving footage; at least 1.4 s); cut words or lengthen it`.
   - **Effect.** The new rule is about 30 % stricter than the old ≈4 words/s.
6. **Purity (`purity`).**
   - **Frame choice.** Frames are chosen from a seed of the timeline. Each shot gets an inside frame (a held frame if the shot has a hold), then its first and last frames, round-robin, with at least one per shot and 24 at minimum. They are rendered shuffled on one fresh page and compared with the film within ±2 per channel or 0.01 % of pixels.
   - **Calibration.** On the pixel test alone, 12 of the 14 old-job renders had 1–12 frames beyond tolerance, with max Δ 11–238 on ≤ 0.2 % of the frame. They are always small UI text: phone, panel and browser message bubbles, the title badge, the split handle, the hook overlay.
   - **Why that isn't a block bug.** The page's DOM state for those frames is identical in any draw order. So it is Chrome rasterising the same page differently after a different history of frames. That matches the known "jumping seeks change output" trap.
   - **Decision: split the verdict.**
     - **WARN** when the visible DOM state differs between two draw orders (a block that keeps state). The counter probe and nothing else.
     - **WARN** when pixels differ over more than 0.5 % of the frame with the same state.
     - **INFO** for small raster-only differences.
   - **Signature fixes during calibration.** Two false "state" hits came from things that aren't block state, so the signature now skips them:
     - the engine's lazily grown filter bank (`#lv-fx`): only the filters a frame references count;
     - a cursor that keeps its last transform while it sits at opacity 0 (browser block, edge-test): invisible elements are skipped.
7. **Storyboard.** `--storyboard` prints `text under the web floor for 16:9 (47 px, 35 px in capitals; …): <shot> "<copy>" <px>` and puts the same note on each card. Example: `jobs/B-steady-sample/steady-storyboard-16x9.png`.

Cost on film-sample 16:9 under heavy machine load: purity added 23 s, and the whole QA step took 134 s. The textless capture is 4 screenshots per hero frame, after the run. `--qa` re-runs reproduce `qa.json` exactly (checked on dark-ui-check: identical JSON).

## 3 · Calibration on the old jobs (staging engine, clones `jobs/B-*`)

Every render below is `QA PASSED` with its old PASS count, except `qa-probe`, which keeps its 2 FAILs. Against the live engine's own runs of the same clones (`jobs/B-live-*`), the existing lines are identical down to the detail text (dark-ui-check, qa-probe, edge-test 1x1, steady 16x9). Against the original jobs' last `qa.json` files, from older engine builds of Oct 20–21, the levels are identical. A few INFO `cut` ratios differ in the 2nd decimal, which is engine drift since those dates plus the wall nondeterminism.

| job · cut · aspect | floors | contrast | dead air (longest still / allowed) | flash | purity |
|---|---|---|---|---|---|
| film-sample · main · 16x9 | WARN 2 | INFO 11 boxes, worst 3.35:1 (231 px) / Lc 50 (94 px) | INFO (voice 1.83 / 2.65 s) | **WARN 19.83–20.85 s, 4.5/s** | INFO raster 1 frame (hook, Δ181) |
| film-sample · main · 9x16 | — | INFO 11 boxes | INFO (edge 2.27 / 2.65 s) | **WARN 19.70–20.90 s, 4/s** | INFO raster 1 (Δ154) |
| film-sample · main · 1x1 | — | INFO 11 boxes | INFO (voice 1.83 / 2.65 s) | **WARN 19.83–20.82 s, 4.5/s** | INFO raster 1 (Δ120) |
| reel-sample · main · 9x16 / 16x9 / 1x1 | WARN chips 31–36 px caps | INFO 14 boxes, worst 3.68:1 at 283 px; 12–14 outlined captions INFO | INFO (≤ 1.47 / 2.30 s) | INFO ≤ 2/s (whips) | INFO raster 1 (split handle) |
| steady-sample · main · 16x9 / 9x16 | WARN 8–9 | **WARN 3**: muted #7C7C86 4.0:1, accent 3.8:1 under 48 px | INFO (s3 2.65 / 2.65 s, at the edge) | INFO 1/s | INFO raster 0–4 |
| steady-sample · 10s · 16x9 / 9x16 | WARN | **WARN 3** | INFO (s3 2.65 / 2.65 s) | INFO 1/s | INFO raster 9–12 (Δ ≤ 238) |
| edge-test · main · 1x1 | WARN 7 | **WARN 6**: orbit labels 4.1:1 at 29 px; `fernly.test` Lc 50 on dark | INFO (f 0.60 / 0.60 s) | INFO 1/s | INFO clean (Δ1) |
| edge-test · short · 1x1 | WARN 3 | **WARN 2** | INFO (g 2.25 / 2.30 s) | INFO 0.5/s | INFO raster 3 (browser text) |
| dark-ui-check · main · 16x9 | WARN 2 | INFO 4 boxes, worst 7.0:1 / Lc 52 | **WARN p 2.48/2.30 s, r 1.87/0.60 s** | INFO 1/s | INFO raster 8 (phone/panel text, Δ ≤ 225) |
| qa-probe (failure fixture) | — | INFO | WARN s2–s4 (its frozen and empty shots) | INFO | INFO raster 1 |

Full table with activity statistics: `runs/B/summary-oldjobs.md`.

What fired, and whether it is real (I looked at the frames):

- **Flash, film-sample `scan`, all aspects: real.** The `stack` block cycles 8 cards at 7 beats. Dark footage cards and white UI cards alternate in the bottom-right third about 4–5 times a second. See `runs/B/calib/film-sample-main-16x9/flash-19.8-20.9.png`. By WCAG 2.3.1 that is a large-area dark↔light alternation. I would keep it as a WARN. It is the strongest reason to give `stack`'s cycle a slower rate or a similar-brightness card order.
- **Dead air, dark-ui-check: partly real.**
  - Shot `p`: after the "Booked." toast, about 1.65 s of static phone with only the push.
  - Shot `r` (panel): it has no read copy (`panel` exports no `copy()`), so its allowance is the 0.6 s floor. Its tail is static for about 0.9 s after the check lands.
  - Both runs start early because the toast and the check pop register only 4–6 activity, under 8. The grid doesn't see small, pale UI events.
  - Strips: `runs/B/calib/dark-ui-check-main-16x9/deadair-p-90-239.png` and `deadair-r-517-629.png`.
- **Dead air elsewhere: silent.** Film-sample, reel, steady and edge-test are all silent. The closest calls are steady `s3` (a static phone for exactly its 2.65 s need) and edge-test `f`. In the probes, a 2-word headline held for 2 s with only the camera push goes 0.18–0.25 s over (probe-flash s3/s4, probe-purity s3). That is the rule as written; whether to add a margin is the lead's call (§5).
- **Contrast: real AA misses.** All of them are on secondary lines under 48 px: muted greys (steady #7C7C86 on #F6F6F7, edge-test #6B7A72 at 4.1–4.2:1), the steady accent blue at 3.8:1 in a 43 px tagline, and APCA on a dark-theme URL (Lc 50 at 31 px). No headline is low. Most of film-sample's text lives in `.lv-ui` mocks and is exempt by the spec, so only 11 boxes on 5 hero frames are measured there.
- **Floors: fire on every sample.** They hit sub-lines, badges, step lists, CTA pills and the reel's Input/Output chips (31–36 px caps on 9:16). They are real against the new floors. Most are labels that the old "≥ 30 px" rule allowed.
- **Reading time (`--grid`).** It now warns on 6 of film-sample's 12 shots, 4 of steady's 7, 7 of reel's 8 and 4 of edge-test's 7. Under the old rule, only edge-test `a` warned. The read copy counts every line the block exports, e.g. `type`'s over-line and pill. The probes show the rule itself is right; the volume says some blocks' `read()` lists may be too generous (§5).

## 4 · Probes: every check, both ways (`jobs/probe-*`, final code)

| Check | Planted (must WARN) | Result | Silent / clean on |
|---|---|---|---|
| dead air | `probe-deadair` s2: a 2-word line lands, then only a 1-px flip per frame for ~3.8 s (freeze passes) | **WARN** `s2 at 2.20 s for 3.78 s (its copy needs 1.60 s: 2.18 s over)`; s1 and s3 silent | probe-floors (both aspects), film-sample ×3, reel ×3, steady ×4, edge ×2 |
| floors | `probe-floors`: "LIVE NOW" 30 px caps and "Sign up today" 40 px; `probe-floors-feed` (`delivery: feed`) | **WARN** 16:9: both lines (web 47/35; feed 64/48). 9:16: caps only (40/36). The 110 px headline is never listed. Storyboard notes say the same. | film-sample 9x16 and 1x1, qa-probe |
| contrast | `probe-contrast`: s2 grey #C9C9C9 on white, s3 white over a bright sky (bgDim 0), s6 white word over a half-white plate, s5 outlined | **WARN** s6 1.1:1, s2 1.6:1 Lc 28, s3 2.8:1. **INFO** s5 "outlined, check by eye" | s1 dark on light, s4 the same grey on a dark plate (9.8:1); film-sample ×3, reel ×3, dark-ui-check |
| flash | `probe-flash` s2: the whole frame black/white every 3 frames | **WARN** `2.00–4.03 s (5.5 flashes)`. The s3/s4 dark/light hard cuts don't add a flash warning. | every other job (≤ 2 flashes/s; reel whips reach 2) |
| reading | `probe-reading` (`--grid`): s2 16 words in 2 s, s3 14 Han chars in 2 s, s4 6 words over bgDim .1 video | **WARN** s2 needs 6.5 s; s3 needs 3.0 s (0.15 s a Han/kana character); s4 needs 3.8 s (×1.3 over moving footage) | s1 (3 words in 3 s); s5 (the same 6 words over bgDim .4: no ×1.3) |
| purity | `probe-purity` s2: position set by a counter of render calls | **WARN** `s2: the page's state at 8 frame(s) depends on the order…` (Δ up to 238 on 37k px) | s1/s3 in the same probe; edge-test main (24 frames, Δ ≤ 1, clean); every old job (raster INFO only) |
| storyboard notes | `probe-floors` `--storyboard` | `! text under the web floor for 16:9 …: s2 "LIVE NOW" 31px caps; s2 "Sign up today" 41px (film QA will WARN)` | the B-qa-probe storyboard and film-sample 9x16 / 1x1 storyboards print no floor note |

Full probe table: `runs/B/summary-probes.md`. The probe custom blocks are in each probe's `blocks/` folder. All of them still pass the existing checks; I fixed my first versions, which faded in from opacity 0 and so tripped `content`.

## 5 · Byte-identical proof (runtime switch invisible when off; film frames untouched when on)

| Comparison (live engine vs staging, same clone source) | Result |
|---|---|
| Full `--film` dark-ui-check 16x9 (heroes with textless + ink captures) | **630/630** frames, 630/630 bgref, shot log identical |
| Full `--film` qa-probe 16x9 | **480/480**, 480/480 bgref |
| Full `--film` edge-test 1x1 (footage, browser, custom block, hold) | **1132/1132**, 1132/1132 bgref |
| Full `--film` steady-sample 16x9 | **1200/1200**, 1200/1200 bgref |
| film-sample 16x9 `--film --range 160,290` (includes hero 213 with textless/ink) | **131/131**, bgref 131/131 |
| Storyboard hero PNGs of all 6 cloned jobs, every aspect | **84/88**. The 4 others are film-sample `wall` (16x9, 9x16, 1x1) and `scan` 1x1, with max Δ 2–3 |

The 4 storyboard misses are pre-existing nondeterminism, not mine. I ran 3 live and 3 staging storyboards of film-sample (`runs/B/wallhero.log`):

- Live vs live: the `wall` hero had 3 different hashes in 3 runs on every aspect, and `scan` 1x1 varied too.
- Staging vs live: staging produced some of the same hashes.
- Everything else: all other heroes had one hash across all 6 runs.

## 6 · Commands run (all from `qa/motion-kit/jobs`, `S=$S/video/lv.mjs`, `L=~/.claude/skills/product-launch-sting/video/lv.mjs`)

- **Live baselines:** `node $L --job B-live-<job> --storyboard --aspect all` (6 jobs); `node $L --job B-live-film-sample --film --aspect 16x9 --range 160,290 --workers 3`; `node $L --job B-live-<job> --film --workers 3` (dark-ui-check, qa-probe, edge-test 1x1, steady 16x9). All four `QA PASSED` / qa-probe `FAILED (2)`, as expected.
- **Staging:** `--grid --cut all`, `--storyboard --aspect all` and `--film --aspect <a> --cut <c> --workers 3` on every `B-<job>` (`runs/B/oldjobs.sh`, `final.sh`). Probes: `runs/B/probes*.sh`. Identity: `runs/B/identity-final.sh`. `--qa` re-run on dark-ui-check.
- **QA summary lines (staging):**
  - film-sample main 16x9 / 9x16 / 1x1: `QA PASSED (16 checks)` ×3
  - reel-sample main ×3: `QA PASSED (13 checks)`
  - steady-sample main 16x9 / 9x16: `QA PASSED (12 checks)`; 10s ×2: `QA PASSED (11 checks)`
  - edge-test main: `QA PASSED (13 checks)`; short: `QA PASSED (11 checks)`
  - dark-ui-check: `QA PASSED (12 checks)`
  - qa-probe: `QA FAILED (2)` (freeze + content, as before)
  - probes: all `QA PASSED`
- **Sample new lines (film-sample 16x9):**

  ```
  WARN  text     under the web floor for 16:9 (47 px, 35 px in capitals; delivery: feed raises it): open "Your launch crew" 41px; voice "Three teasers, ready Fri" 45px
  INFO  contrast 11 must-read text boxes at 5 hero frames, worst name "Orbit 2" 3.4:1 Lc 66 (231 px)
  INFO  deadair  no still stretch longer than its copy needs (closest: voice still for 1.83 s of 2.65 s)
  WARN  flash    more than 3 flashes in a second (WCAG 2.3.1): 19.83–20.85 s (4.5 flashes) — slow the strobe or shrink the flashing area
  INFO  purity   1/24 frames (hook) have the same page state in any order but Chrome rasterised them differently after another history of frames (it can show for one frame at a worker seam): frame 376 (hook) max Δ 181, 2344 px
  QA PASSED (16 checks)
  ```

**Stills for the lead:**

- `runs/B/stills/`:
  - `textless-dark-ui-q.png`: real | textless | ink black | ink white
  - `contrast-probe-s6-real-textless-coverage.png`
  - `purity-probe-s2-film-purity-diff.png`
  - `flash-probe-s2.png`
- `runs/B/calib/<job-cut-aspect>/`: dead-air strips, purity diff strips, the film-sample flash strip, and saved thumbnails for re-measuring.
- Storyboards with the floor notes: `jobs/B-*/…-storyboard-*.png` and `jobs/probe-floors*/…`.

**Disk.** The disk reached 96 % full while other workers were rendering. Once all the proofs above were done, I pruned the non-hero film frames and the bgref folders in my clones (`jobs/B-*`, `jobs/probe-*`), freeing about 3 GB. Kept: hero frames, `textless/`, `purity/`, `qa.json`, `purity.json`, the mp4s and the storyboards. A `--qa` re-run there now needs `--film` first.

## 7 · Open issues

1. **Dead-air sensitivity.** With a 12×12 grid at 1/10 scale, a small, pale UI event (a toast or check pop: activity 4–6) counts as still, while a slow push on high-contrast edges reaches 6–7. The threshold can't tell the two apart. A finer grid near text and UI, or a per-block max |Δ|, would. Also, by the rule's letter, a 2-word headline held 2 s goes about 0.2 s over: add a margin (e.g. +0.5 s) before any FAIL.
2. **Raster history in UI-mock text.** In phone, panel and browser bubbles and the title badge, the same DOM can be drawn with Δ up to 238 on ≤ 0.2 % of pixels, depending on frame history. It can show as a one-frame glyph shimmer at a worker seam. This is engine/block territory, not my files; it may be the same compositing trap as in the layer-traps note.
3. **`wall` / `stack` 3D heroes aren't deterministic between runs** of the same engine (±3). The cause is pre-existing.
4. **`ui.js` cursor keeps its last transform while hidden.** It is invisible, so purity now ignores it, but it is order-dependent state; resetting the transform when hidden would make it pure.
5. **Contrast is measured only at hero frames,** one per shot. Text over moving footage that is readable at the hero but not elsewhere isn't seen. Outlined (stroke + fill) captions are INFO only; reel captions are 12–14 boxes per aspect.
6. **Flash limits.** Red flash isn't measured, and the area is approximated by W/3×H/3 windows, not the 10° field.
7. **Volume before promoting anything to FAIL.** Floors and reading time fire on most sample shots. Review each block's `read()` (e.g. `type` over-lines and pills, `panel`/`phone` with no `copy()`), and consider whether floors should apply to badges and step lists, or only to `read()` copy.
8. Small things: `timeline.mjs` still imports `wordCount` (now unused; left alone because the region is shared). Purity adds about 20–40 s per aspect.

## 8 · GUIDE text I'd add (lead writes the docs)

**beats.yaml**: `delivery: web | feed | tv` sets where the film is watched, and so the readable-text floors QA warns at.
`web` (default) is full screen or landscape; `feed` is a 16:9 film watched small in a phone feed; `tv` is a big screen.

**QA table, new rows (round 1: WARN/INFO only, never FAIL):**

| Check | Warns when |
|---|---|
| text (floors) | must-read text (not `.lv-ui`) at its on-screen size, after the camera's scale, is under the floor. Mixed case / capitals: web 47/35 px on 16:9, 40/36 on 9:16 and 1:1; feed 64/48 on 16:9; tv 27/21 on 16:9. Also noted on the storyboard. |
| contrast | at each shot's hero frame, a must-read line's worst glyph pixels (2nd percentile, word by word) are under WCAG 4.5:1 or APCA Lc 60 (3:1 / Lc 45 at ≥ 48 px), measured against the same frame with every glyph hidden. Outlined text is INFO ("check by eye"). Fix with another colour, a plate, or more `bgDim` over footage. |
| deadair | nothing on screen moves (activity < 8 on the busiest of 12×12 thumbnail blocks) for longer than the shot's copy needs to be read: 0.4 s + max(1 s, 0.35 s a word + 0.5 s), ×1.3 over barely-dimmed footage, at least 0.6 s. Declared `hold:` frames don't count. |
| flash | more than 3 flashes (pairs of opposing ≥ 0.1 luminance changes, darker side < 0.8) in any second over a third of the frame (WCAG 2.3.1). A card cycle that alternates dark and white cards counts. |
| purity | after `--film`, 24 seeded frames drawn again in shuffled order on a fresh page differ because the page's visible state depends on draw order. Derive everything from `t`; never keep counters or "last frame" state in a custom block. Same state with a few pixels of different glyph raster is INFO. |

**Reading time (`--grid`)**: a line needs 0.4 s to build, then 0.35 s a word + 0.5 s (at least 1 s), ×1.3 over barely-dimmed moving footage. Chinese or Japanese copy counts 6.75 characters a second, Korean 9. Blocks say what counts with `read(shot)`.

**Custom blocks**: render must be a pure function of `t`. Hidden elements may keep stale values, but anything visible must come from `t`. QA's purity line names the shot when this isn't so.

---

## Fix pass (round 1, after the monitor's review, 2026-10-26 afternoon)

**Bottom line.** Of the monitor's 13 findings, **11 are fixed and 2 are not fixed**. Both unfixed ones belong to the lead: #11 is the spec's reading formula, #13 is in `lib/spec.mjs` and Worker A's job. Every fix was re-run on planted probes, on the old jobs and in the byte-identity proof.

- **HIGH #1 (purity missed a CSS transition): fixed.** The monitor's own probe now gets two WARNs:
  - `CSS transitions / animations run while frames are drawn … s2 transform@chip (237 frames, 121–359)`;
  - `s2: 7/24 frames differ from the film even when drawn again the way the film drew them`.
- **Byte-identity.** Film frames are still byte-identical, live vs staging: dark-ui-check 16:9 630/630 frames + 630/630 bgref, qa-probe 16:9 480/480 + 480/480, edge-test 1:1 1132/1132 + 1132/1132 (full films), film-sample 16:9 `--range 160,290` 131/131, storyboard heroes 84/88 (the same 4 pre-existing `wall` / `scan` misses).
- **Old jobs.** They still say `QA PASSED` with the same PASS counts (10 renders: film-sample 16:9 / 9:16 / 1:1 `QA PASSED (16 checks)`, reel 9:16 (13), steady main (12) and 10s (11), edge-test main (13) and short (11), dark-ui-check (12); the qa-probe fixture still `QA FAILED (2)`, freeze + content).
- **The unflattering numbers.**
  - **Purity costs more.** It now takes about 1–2.5 min per aspect under this machine's load (load average 13–27). The 24 shuffled frames take ~8 s; the rest is drawing each differing or seam-split shot again from its first frame.
  - **New seam WARN on half the old jobs.** It fires on 5 of the 10 old-job renders, and for real: a worker seam inside a shot of UI text shifts the glyph edges for the rest of that shot. The fix belongs in the renderer (see "For the lead").

### Per finding

| # | Sev | Status | How | Proof (command → result) |
|---|---|---|---|---|
| 1 | HIGH | **fixed** | **(a) Running animations.** `render.mjs` lists the CSS transitions / animations still running (`document.getAnimations()`) right after every film frame's seek, before its screenshot. Any → WARN naming shot, property, layer and frames. **(b) Proof instead of an area split.** The 0.5 %-area INFO/WARN split is gone. A frame beyond the tolerance whose DOM state doesn't depend on order is drawn again the way the film drew it: in order from its shot's first frame, or from its page's first frame after a fresh warm-up. Match → INFO (Chrome raster history, proven); no match → WARN. **(c) Worker seams.** Each seam's frame is compared with the same frame drawn in order → WARN when it differs (see #1 note). | `node $S --job probe-purity-css2 --film --aspect 16x9` (the monitor's 80×36 chip) → the 2 WARNs above. `probe-purity-css` (chip + 900×420 card) → WARN s2 and s3 transform@chip (178 / 179 frames); `14/24 frames differ …`. `probe-purity` (counter) → WARN state, 8 frames. Old jobs → INFO with the replay proof (e.g. dark-ui-check: 9/9 frames reproduced). |
| 2 | MED | **fixed** | `purityFrames` ranks its picks: every shot's inside/held frame, then every first frame, then every last frame, then more inside frames. That is 3 per shot, at least 24, at most 120. | `node runs/monB/pf.mjs …` → film-sample `frames 36 first-frames 12 last-frames 12`; manus2-film (27 shots) `frames 81 first-frames 27 last-frames 27`; reel `24 … 8 / 8`. |
| 3 | MED | **fixed** | **qaFilm.** It deletes `qa.json` first, so a crash never leaves an older verdict. Each round-1 check runs guarded: failure → `INFO <check> not measured: …`. **contrastCheck.** It decodes each hero inside try/catch → `INFO contrast not measured for <shot> (could not decode <file>: …) — re-run --film`. **purityRun.** It never throws: a page error or an unreadable PNG → `purity.json {error}` / per-frame `error` → INFO "not measured". **render.mjs.** The textless pass is wrapped (it runs after the page's film frames, so it can't touch them). | Truncated textless PNG → `exit=0`, `INFO contrast not measured for h (could not decode 00068.png: … chunk too big)`, `QA PASSED (15 checks)`. Malformed `qa-lanes.json` (crash in the old sfx check) → exit 1 and `ls qa.json: No such file`. Stub render that throws → `INFO purity not measured: page errors: ReferenceError: boom is not defined — re-run --film`. Stub render that writes nothing → `INFO purity not measured for 24 frame(s): could not decode 00129.png …`. |
| 4 | MED | **fixed** (with a partial disagreement, below) | Two changes. **Severity split.** WARN only when a still run is more than 0.5 s (`DEADAIR_GRACE`) over its allowance; up to 0.5 s over is an INFO "near dead air" line that names the shot. **End lockup.** The film's closing `endcard` / `lockup` may hold at least 2 s (`DEADAIR_LOCKUP`, the handbook's listed read "end lockup ≥ 2 s"). A shot with no read copy now says `no read copy: floor 0.60 s`. | `probe-calib` (clone of mon-B-calib) → `INFO deadair near dead air … h 0.40 s over; t 0.18 s over; e (an end lockup may hold 2.00 s) 0.40 s over`; no WARN. Planted stall `probe-deadair` → still `WARN … s2 … 2.18 s over`. dark-ui-check → `WARN r 1.27 s over` (panel tail, real) + p INFO (0.18 s). Of the other 13 old-job renders, only the qa-probe failure fixture WARNs, on its frozen and empty shots (`runs/B-fix/remeasure-oldjobs.log`, on the saved thumbnails). |
| 5 | LOW | **fixed** | Each transition is timed where the window mean crosses half-way; transitions in [t, t + 1 s) are counted. | `node runs/B-fix/flashslice.mjs …probe-flash-edge… 90 269` (3 Hz) → `worst 3`, no span (was 3.5 WARN); 4 Hz → `4`, WARN. |
| 6 | LOW | **fixed** | Pixel-wise area rule. Candidate legs come from the window mean with hysteresis 0.1 × 25 %. A leg counts only if ≥ 25 % of the window's pixels make the same ≥ 0.1 change between its ends, with a darker state < 0.8. Runs of same-direction transitions merge. | 200 px square at 5 Hz → `worst 0` (was 5.5 WARN). Full-frame 10 Hz `probe-flash` → `WARN 2.00–4.00 s (5 flashes)`. film-sample `scan` → still WARN (5 flashes; real, see below). |
| 7 | LOW | **fixed** | The audit gains `shadowed`. A hero with shadowed must-read text gets one more capture, `hideText('shadow')` (glyphs hidden, text-shadows kept; Chrome paints a shadow under a transparent fill: `runs/B-fix/stills/contrast-halo-real-textless-shadow-ink.png`). Low without its shadow but fine against it → INFO "shadowed text, check by eye" with both numbers; low against both → WARN as before. | `probe-contrast-edge` → `INFO contrast shadowed text, check by eye … halo "White with a halo" 1.0:1 Lc 0 (19.6:1 Lc 108 against its shadow)`. |
| 8 | LOW | **fixed** (and a bug under it) | No glyph coverage anywhere, and the real frame equals the textless one there → a separate WARN, "must-read text not painted at its hero frame". **The bug.** The ink pass marked the word spans inside a `background-clip:text` element as "no ink" (they inherit its transparent fill), so gradient text had no coverage. It was silently measured by the fallback method before. Fixed in `hideText`. | `probe-contrast-edge` → `WARN contrast must-read text not painted at its hero frame …: covered "Hidden behind a card"`. `grad` is measured again by coverage: `1.4:1 Lc 20` WARN. |
| 9 | LOW | **fixed** | The feed hint appears only for `delivery: web` where feed's floor is higher (16:9). `textIssues` also normalises `delivery` (so `[web]` → `web`). | `probe-floors` 9:16 → `under the web floor for 9:16 (40 px, 36 px in capitals): …` (no hint); 16:9 keeps `; delivery: feed raises it`. |
| 10 | LOW | **fixed** | When the rounded numbers are equal, 2 (then 3) decimals are printed. | `node $S --job probe-reading-edge --grid` → `round: 5 words on screen for 2.60 s — viewers need ~2.65 s`. |
| 11 | LOW | **not fixed** (lead) | This is the spec's own formula (`need = 0.4 + max(1.0, …)`). An exemption for 1–2-word punch beats is a rule change. | Still `f1/f2/f3: 1 word on screen for 1.0 s — viewers need ~1.4 s` (`runs/B-fix/qa-robust-corrupt-textless.log`). |
| 12 | LOW | **fixed** | The `lib/qa.mjs` header now matches the code (allowance = need, grace, lockup, flash area, purity classes, "not measured"). The `(no read copy: floor 0.60 s)` wording is in. | `sed -n 23,45p lib/qa.mjs` |
| 13 | LOW | **not fixed** (outside my files) | `delivery: [web]` validation is in `lib/spec.mjs` (lead). On my side, `textIssues` now coerces it. The film-kit-dev storyboard failure is Worker A's, and it fails on live too. | — |

**#1, where I disagree with the monitor's point 3** ("old-job raster cases deserve at least a WARN"). I measured where the difference exists before choosing the level (`node runs/B-fix/history-exp.mjs B-dark-ui-check 16x9 208 0` and `… 524 420`):

```
frame 208 (p): drawn from the page's / shot's first frame  → max Δ 0  (byte-identical to the film)
               after only the 60 / 12 / 1 / 0 frames before → max Δ 225, 8243 values > 2 (all four identical to each other)
frame 524 (r): from the shot's first frame (450) → Δ 0;  60 before → Δ 0;  0 before → Δ 182
frame 230 (p, 20 frames past the worker seam at 210): in order from the shot's start → Δ 225 vs the film
```

The out-of-order differences come from the compositing state a shot builds up from its first frame. A film page always draws a shot in order, so those differences aren't in the film: they stay INFO, and each is now proven by drawing the frame again. Where the film doesn't draw in order (a worker seam inside a shot), the difference is in the film: the rest of that shot is drawn in the other raster state, and the glyph edges shift once at the seam. That part WARNs, names the shot and gives the remedy, `--film --range a,b --workers 1`. Seen at dark-ui-check 210 (`runs/B-fix/stills/seam-dark-ui-zoom.png`: a sub-pixel shift of a whole text line, barely visible at full speed), steady 380/400, edge-test short 388 and reel 788.

**#4, partial disagreement.** The handbook's own metric calls a 2.4 s stretch with only a slow push dead air: "something new every 0.5–0.6 s", stills only as listed reads, and the push scores 6–7 < 8 by the same metric. So I didn't raise the threshold or make pushes count as motion. Near misses stay visible as INFO; WARN is kept for stretches clearly longer than reading needs (a margin of 0.5 s) and for an end card past its listed read. I looked at the frames: the calib headline sits still from 0.5 s to 2.9 s.

### Files changed in this pass (all under `stageB/product-launch-sting/video/`, inside my ownership)

- **`lib/qa.mjs`:**
  - `purityFrames`: ranked picks.
  - New `frameDiff` and `purityRun`: shuffled pass + per-shot replay + seams, never throws. `purityCompare` is gone; `PURITY_RASTER` is gone.
  - `flashCheck`: pixel-wise area rule, midpoint timing.
  - `deadAir`: grace, lockup, `why`.
  - `contrastCheck`: guarded decode, `hidden`, `shadowed`, `unreadable`.
  - `floorNote`: `feedRaises`.
  - `qaFilm`: deletes `qa.json` first, `guard()` around every round-1 check, new purity verdict lines.
  - Header comment updated.
- **`lib/render.mjs`:**
  - `animSig` + `anims` option, called before each screenshot. It doesn't change pixels: dark-ui-check 630/630 frames identical vs live.
  - The textless pass is wrapped in try/catch and takes the `-shadow` capture.
- **`engine/runtime.js`:**
  - audit `shadowed`;
  - `hideText('shadow')`;
  - ink pass: words inside `background-clip:text` get ink.

  Never called, it changes nothing (identity below).
- **`lv.mjs`:** the film render passes `anims: true`; purity is one call, `await purityRun({ …, film: res, idx, render: renderFrames })`.
- **`lib/timeline.mjs`:** the rounding in the reading warning.
- **`lib/board.mjs`:** unchanged in this pass.

Diff vs `stage/` now: runtime.js +48 −4, qa.mjs +408 −9, render.mjs +77 −4, timeline.mjs +27 −3, board.mjs +6 −2, lv.mjs +14 −6. `diff -rq -x node_modules stage stageB` lists only these six files.

### Re-run: done criteria for my area (final code)

Logs are in `qa/motion-kit/runs/B-fix/`. `S=$S/video/lv.mjs`; runs are from `qa/motion-kit/jobs`.

**Byte-identity, live engine vs staging** (`runs/B-fix/oldjobs.sh` → `oldjobs.log`). This is the final render path: animations are queried before each screenshot, and the textless / ink / shadow captures run after the film frames.

```
##### full film dark-ui-check 16x9: 630/630 frames byte-identical live vs staging; bgref 630/630
##### full film qa-probe 16x9: 480/480 frames byte-identical live vs staging; bgref 480/480
##### full film edge-test 1x1: 1132/1132 frames byte-identical live vs staging; bgref 1132/1132
##### range 160-290 frames byte-identical live vs staging: 131/131
##### storyboard heroes byte-identical live vs staging: 84/88   (DIFF film-sample 16x9/10-wall, 1x1/07-scan, 1x1/10-wall, 9x16/10-wall)
```

The 4 misses are the same heroes as in round 1. The monitor confirmed that the live engine itself doesn't reproduce them between runs.

**`stage/` and the live skill are untouched.**

```
stage/: 0 not OK of 871   (shasum -c stage-r1-base.sha1)
live skill: 0 not OK of 867   (shasum -c live-before.sha1)
```

`diff -rq -x node_modules stage stageB` lists 6 files, all mine.

**Old jobs through the staging engine, final code.** `oldjobs.log`, `after.log`, table from each `qa.json`, `runs/B-fix/summary-oldjobs.md`:

| job · cut · aspect | verdict | new WARN lines | dead air | flash | purity (over tol / proven history / seams differing) |
|---|---|---|---|---|---|
| dark-ui-check · main · 16x9 | QA PASSED (12) | deadair, floor, purity | WARN r +1.27 | INFO 0.5/s | 9/24 over · 9 proven · seams 1/2 ok (DIFF 210 p) |
| qa-probe · main · 16x9 | QA FAILED (2: freeze, content) | deadair | WARN s2 +1.30, s3 +0.72, s4 +0.72 | INFO 0.5/s | 0/24 over · 0 proven · seams 2/2 ok |
| edge-test · main · 1x1 | QA PASSED (13) | contrast, floor | INFO | INFO 1/s | 1/24 over · 1 proven · seams 2/2 ok |
| edge-test · short · 1x1 | QA PASSED (11) | contrast, floor, purity | INFO | INFO 1.5/s | 0/24 over · 0 proven · seams 1/2 ok (DIFF 388 c) |
| steady-sample · main · 16x9 | QA PASSED (12) | contrast, floor, purity | INFO | INFO 1/s | 3/24 over · 3 proven · seams 1/2 ok (DIFF 400 s3) |
| steady-sample · 10s · 16x9 | QA PASSED (11) | contrast, floor, purity | INFO | INFO 1.5/s | 11/24 over · 11 proven · seams 1/2 ok (DIFF 380 s3) |
| reel-sample · main · 9x16 | QA PASSED (13) | floor, purity | INFO | INFO 2/s | 1/24 over · 1 proven · seams 1/2 ok (DIFF 788 s6) |
| film-sample · main · 16x9 | QA PASSED (16) | flash, floor | INFO | WARN 5/s | 1/36 over · 1 proven · seams 2/2 ok |
| film-sample · main · 9x16 | QA PASSED (16) | flash | INFO | WARN 5/s | 1/36 over · 1 proven · seams 2/2 ok |
| film-sample · main · 1x1 | QA PASSED (16) | flash | INFO | WARN 5/s | 2/36 over · 2 proven · seams 2/2 ok |

renders with a seam WARN: 5/10

**What the table shows.**

- **Existing levels and PASS counts are unchanged.** The only new lines are WARN/INFO.
- **Dead air.** It WARNs only on dark-ui-check `r` (a 1.87 s still panel tail) and on the qa-probe fixture's frozen and empty shots.
- **Flash.** It WARNs only on film-sample `scan`, which is real: dark and white stack cards alternate.
- **Purity.** Every old-job frame that differed out of order was reproduced when drawn in order from its shot's first frame: 29 frames over 10 renders, 0 not reproduced. Five renders have a seam inside a shot that changes how the rest of that shot is drawn.
- **Measurement aid.** Dead air and flash were also re-measured on the saved round-1 thumbnails of all 14 old-job renders (`node runs/B-fix/remeasure.mjs runs/B/calib/*` → `remeasure-oldjobs.log`): same verdicts.

**Planted probes, both ways, final code.** The probe logs are `film2-*.log` and `film3-*.log`. The monitor's probes were cloned with `cp -c` into my own `jobs/probe-*`; the monitor's `mon-B-*` jobs were not touched.

| Probe | Must say | Says |
|---|---|---|
| `probe-purity-css2` (the monitor's 80×36 chip with a 300 ms transition) | WARN | `WARN purity CSS transitions / animations run … s2 transform@chip (237 frames, 121–359)` + `WARN purity s2: 7/24 frames differ … even when drawn again the way the film drew them` |
| `probe-purity-css` (chip + 900×420 card) | WARN | anims WARN for s2 and s3 (178 / 179 frames) + `14/24 frames differ …` |
| `probe-purity` (a counter of render calls) | WARN | `WARN purity s2: the page's state at 8 frame(s) depends on the order …` |
| `probe-deadair` (planted stall) | WARN, purity clean | `WARN deadair … s2 … 3.78 s (its copy needs 1.60 s: 2.18 s over)`. Purity: `INFO 1/24 frames (s2) differ only when drawn out of order — drawn again in order from their shot's first frame they match it` |
| `probe-calib` (the monitor's stock-block calibration film) | no dead-air WARN | `INFO deadair near dead air … h 0.40 s over; t 0.18 s over; e … an end lockup may hold 2.00 s: 0.40 s over`. Contrast WARN `ft "Shot on anything." 1.8:1` is real: white "Sh" over the test chart's yellow and white bars (`stills/calib-ft-real-textless.png`). |
| `probe-flash-edge` (3 Hz / 4 Hz full frame, 5 Hz 200 px square) | WARN only on 4 Hz | `WARN flash … 6.00–8.88 s (4 flashes)`. Per shot (`flashslice.mjs`): 3 Hz `worst 3`, 4 Hz `worst 4`, square `worst 0` |
| `probe-flash` (full frame, 10 Hz) | WARN | `WARN flash … 2.00–4.00 s (5 flashes)` |
| `probe-contrast-edge` (halo / covered / gradient / faded / emoji / control) | halo INFO, covered "not painted", grad + faded low, emoji + control clean | `INFO … shadowed text, check by eye … halo 1.0:1 Lc 0 (19.6:1 Lc 108 against its shadow)`; `WARN … not painted at its hero frame …: covered "Hidden behind a card"`; `WARN low contrast … grad 1.4:1 Lc 20; faded 2.0:1 Lc 39` |
| `probe-contrast` (round-1 probe) | s6 / s2 / s3 low, s5 outlined | `WARN … s6 "Overexposed" 1.1:1; s2 1.6:1 Lc 28; s3 2.8:1 Lc 59`; `INFO outlined … s5` |
| `probe-floors` / `probe-floors-feed`, film + storyboard | 9:16 note without the feed hint | `under the web floor for 9:16 (40 px, 36 px in capitals): s2 "LIVE NOW" 31px caps` (film and storyboard); 16:9 keeps the hint; feed 64/48 |
| `probe-reading-edge` `--grid` | no self-contradiction | `round: 5 words on screen for 2.60 s — viewers need ~2.65 s` |

**One side effect.** `probe-contrast` s6 now also shows `WARN deadair … s6 … 0.53 s over`. Its custom block barely moves after the word lands, so that is the rule working.

**Stills for the lead.** All under `qa/motion-kit/runs/B-fix/stills/`:

- `contrast-halo-real-textless-shadow-ink.png`: real | textless | shadow kept | ink white.
- `seam-dark-ui-209-210-inorder210-211.png` and `seam-dark-ui-zoom.png`: film 209 | film 210 (seam) | in-order 210 | film 211 | ×4 difference. One text line shifts by a fraction of a pixel.
- `calib-ft-real-textless.png` and `calib-e.png`: the two contrast WARNs on the calibration film, both real.
- History experiment frames: `runs/B-fix/hist/`.

**Cost.** Under load average 13–27:

- the 24 shuffled frames take about 8 s;
- the per-shot replays and the seam checks take 60–150 s per aspect, and only for shots that differ or have a seam;
- `qaFilm` is unchanged apart from the guards.

### For the lead (open issues after this pass)

1. **Snap worker seams to cuts (`render.mjs`).**
   - **The change.** Choose page boundaries at the cut nearest each equal split.
   - **What it fixes.** It would end the seam WARN at the source, and films would no longer depend on `--workers`.
   - **Why it isn't in this pass.** It changes old jobs' frames at the seams, where they currently jump, so it breaks rule 1's byte-identity. It needs your approval.
2. **Reading-time volume (#11).** Decide on a punch-beat exemption, or trim the `read()` lists in the blocks, before promoting the rule.
3. **Endcard / steady colours.** The muted tagline / URL greys and the accent blue at 30–44 px miss AA (3.2–4.0:1) in the endcard and steady samples. That is block styling, not QA.
4. **Purity cost.** About 1–2.5 min per aspect under load. Most of it is the per-shot replay, which only runs on shots that differ or have a seam.

### GUIDE text changes (replace the rows proposed above)

| Check | Warns when |
|---|---|
| deadair | Nothing moves on screen (the busiest of 12×12 thumbnail blocks changes by < 8) for more than 0.5 s longer than the shot's copy needs to be read: 0.4 s + max(1 s, 0.35 s a word + 0.5 s), ×1.3 over barely-dimmed footage, at least 0.6 s. The film's closing end card / lockup may hold at least 2 s. Up to 0.5 s over is INFO ("near dead air"). A slow camera push alone counts as still. Declared `hold:` frames don't count. |
| flash | More than 3 flashes in any second (WCAG 2.3.1). A flash is two opposing ≥ 0.1 luminance changes, darker side < 0.8, made together by ≥ 25 % of a W/3 × H/3 window (25 % of a 10° field). |
| contrast | (as before) … Outlined text, and shadowed / haloed text that only reads against its own shadow, are INFO ("check by eye"). Must-read text that isn't painted at its hero frame (covered, masked) is a WARN of its own. |
| purity | 24–120 seeded frames (every shot's first, last and an inside or held frame) are drawn again in shuffled order on a fresh page. WARN when any of these happens: a block keeps state between frames; a CSS transition or animation runs while frames are drawn; a frame differs even when drawn again the way the film drew it; a worker seam inside a shot changes how the rest of the shot is drawn (remedy: `--film --range a,b --workers 1`). Frames that differ only when drawn out of order, and match when drawn in order from their shot's first frame, are INFO: Chrome's raster history, which the film never shows. |

**Every frame check:** a check that can't run (an unreadable frame, a page error) prints `INFO <check> not measured: …` and never stops QA. QA deletes `qa.json` before it starts.
