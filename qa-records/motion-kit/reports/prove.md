# Prove report: the merged stage, tested end to end (2026-10-27)

**Bottom line.** All 15 films of step 1 say **QA PASSED** on the final engine: the three dev jobs, plus the two templates re-run because one fix moves them. The combined job `prv-combo` (every round-1 block joined by the round-2 devices) says **QA PASSED (16 checks)** in all three aspects, but only after **seven fixes** in the stage: six in engine / lint code, one in the review sheet's text.
- **Five sit where round 1 meets round 2** (1, 2, 3, 5, 7). One is a round-2 carry meeting an old block's flex layout (4). One is round 1 alone (6).
- **QA was silent on the four that showed on screen** (2–5). I found them by reading cut stills. Old jobs are untouched: every storyboard hero, a 120-frame film slice, and the full steady-sample, qa-probe and qa-probe2 films are **byte-identical** between the live tool and the stage tool.

| Step | Result | One line |
|---|---|---|
| 1 · Dev-job films (kit-dev, r2-dev, r2-whip) | **PASS** | 9 / 9 films **QA PASSED** (kit-dev 20 checks, r2-dev 16, r2-whip 12), plus launch15 / launch30 re-run 6 / 6 (17 / 20). Every WARN line judged below. |
| 2 · Combined job `prv-combo` | **PASS** | 10 shots, 28 s, 3 aspects, each **QA PASSED (16)**. Cut stills read at cut−4 … cut+6 (30-fps) in 16:9, 9:16 and 1:1. Fixes 2–5 came from these stills, each proven below. |
| 3 · Purity in the transition windows | **PASS** | 30 frames inside the 6 cross-cut windows, shuffled on one fresh page: 28 byte-identical + 2 within B's tolerance (max Δ 1), 0 outside, in **both** 16:9 and 9:16. |
| 4 · Layers, alpha clip, review sheet | **PASS** | 8 `--layers` exports (7 new blocks + the carry shot) pass layer QA, plus the carry shot `--with-transitions`. `--clips formats --alpha` passes. `--sheet` renders cut stills for all 9 cuts. |
| 5 · Old jobs | **PASS** | 5 jobs × all aspects: every hero PNG byte-identical, except film-sample `10-wall.png` (max Δ 2), which two live runs also show (max Δ 3). film-sample `--range 100,219`: 120/120 frames + bgref identical. steady-sample 16:9 film: QA PASSED, the same 12 PASS/FAIL lines, 1200/1200 frames identical. qa-probe / qa-probe2: still **QA FAILED (2)** with identical FAIL lines. |

**The unflattering part.**
- **The templates moved.** Fix 3 (soft glows) moves the flood's start point and the `from: control` card in `launch15` / `launch30`. Before, both came from ~180 px right of the Send button on 16:9 (~140 px on 9:16 / 1:1). They now come from the button itself. I re-ran all six template films: each still says QA PASSED with the same check counts (17 / 20) and the same WARN set as the merge's final films.
- **r2-dev's `pick` shot moved 8 px.** Fix 2 (SVG measuring) moves the float card's birth point by 8 px and its birth size by 3 %. It now measures the pill without the mascot's empty SVG margin.
- **Not fixed (design calls for the lead):**
  - A carry between two different things stretches both pictures onto one box. The lit tile's picture is visibly squashed for ~6 frames (finding F1).
  - The particles burst empties the centre before a dive's zoom peaks (F2).
  - Three WARN lines in `prv-combo` are true but by design: 35-px chips, the end card's muted URL, the title card's 1.6-s hold.
- **Other agents shared the engine with me.** I edited stage code while the doc agent and the sample agent were working. Edit times are in the fix table, so anyone who rendered from the stage between 05:40 and 06:37 knows which engine they had. My own renders were restarted after every engine edit; no film in this report mixes two engines.

Nothing was committed or pushed. No paid API call or `--go` was made, and nothing under `qa/video-skill-learnings/skills/` was run. The live skill, `live-before/`, `base/` and every original job were left untouched (see Hygiene). Every render ran alone from my shell, at `--workers` ≤ 2. `pmset -g therm` was checked before each one and never reported a warning.

Shorthands:
- `M = qa/motion-kit`, `J = $M/jobs`
- `S = $M/stage/product-launch-sting/video` (the stage tool `node $S/lv.mjs`)
- `L = ~/.claude/skills/product-launch-sting/video` (the live tool)

Logs are in `$J/prv-logs/`, stills in `$J/prv-stills/` and tools in `$J/prv-tools/`. The full diff of my stage edits is `$M/reports/prove-edits.diff`. The originals sit in `$J/prv-tools/orig/`, and each one's sha1 matches `merge/stage-final.sha1`.

---

## The engine fixes (all in the stage, each proven both ways)

| # | File:line (final) | Time | What was wrong | Fix | Proof |
|---|---|---|---|---|---|
| 1 | `lib/timeline.mjs:164–178` (`layerNames(block, shot)`), callers `:182`, `:205` | 05:40 | **False `--grid` warning.** The round-2 layer lint dropped everything in brackets of a block's `layers` doc. Round 1 put its mode lists in brackets: `(layout: grid → tiles · lit · band · headline)`, `(mode: exploded → …)`. So `carry.to: lit` and `dive.el: lit` on a wall grid warned "has no such layer … the stage build will fail". | A `(field: value → names)` group now *is* the layer list when the shot has that mode. Without a shot, both lists count. | `prv-combo --grid`: the two false warnings are gone. `$J/prv-lint` exercises it both ways. It still warns on `lit` for a default wall, on `planes` for a cycle stack and on `cards` for an exploded stack. It stays quiet on `lit` for a grid, `planes` for exploded and `tiles` for a grid. |
| 2 | `engine/runtime.js:680–697` (`visualRect`, `SVG_NODRAW`) | 05:40 | **Carry / dive / flood / `from:` measured a full-frame SVG as the whole frame.** The wall grid's `lit` layer holds a W × H overlay `<svg>` for its stroke. Carrying the prompt box `to: lit` therefore landed on a 1927 × 1084 box. `dive: {el: lit}` pivoted on the frame centre, and its zoom was clamped to **1.5** (cover zoom 0.97). Map `route` and particles `orbits` have the same problem. | An `<svg>` or `<g>` that holds shapes measures as its shapes. Defs, masks, clips, filters and gradients are skipped. | `prv-combo` 16:9 `LV.crossCuts()`: carry R1 goes from (−3, −2, 1927 × 1084) to **(959, 256, 337 × 285)**, the lit tile. Dive Z goes from 1.5 to **7.15**, pivot (1131, 395). The other aspects are the same. Measurements were compared old vs new on 5 jobs × 3 aspects (`prv-logs/visualrect-cmp/`). r2-whip, launch15 and launch30 are unchanged. r2-dev changes only in `pick`'s origin (8 px; see above). |
| 3 | `engine/runtime.js:684–686, 697` (`data-lv-soft`), `engine/blocks/press.js:151`, `engine/blocks/particles.js:61` | 06:00 | **Press's halo made "the control" 1.4–2.8 × too big.** The halo is a 1823 × 723 radial gradient fading to nothing inside the `control` layer. As a result:<br>• `flood: {from: control, spot: [0.9, 0.5]}` poured from x 1660 on 16:9, outside the bar. The Send button is at 1422–1597.<br>• `from: control` gave the fan's hero a 1899 × 753 source, so it was born **taller than the frame** and shrank: a direction flip on the cut (`prv-stills/combo-r1-16x9/cut0-180.jpg`). | A block marks a soft glow `data-lv-soft`. Measurements skip that element's own paint. Press's halo and the particles' core glow are marked. | Flood origin 1660 → **1482** (on the button) on 16:9, and 1037 → **896** on 9:16 / 1:1. The `from:` source goes from 1899 × 753 to the face, **1415 × 269**. Same numbers in launch15 / launch30 (`prv-logs/visualrect-cmp2/`). Stills: `combo-final-16x9/flood-wide.jpg` (the drop starts inside the Send button) and `combo-final-*/cut0-180.jpg` (the hero is born at a sane size). |
| 4 | `engine/runtime.js:721–733` (`ghostOf`) | 06:09 | **A carried element inside a flex lockup was drawn off its own rectangle.** The copy kept a shallow clone of its parent row with the element alone in it. Flex re-centred it, so the needle-carried title logo sat **~225 px right of where it was**, over the end card's "Or". It then jumped on landing (`combo-r2-16x9/cut8-1560.jpg`). It hits any carry of title / endcard `logo` or `name`, or anything else in a flex row. | The copy keeps the element's in-flow siblings, invisible (`visibility: hidden; opacity: 0`). Absolutely placed carried layers have none and are unchanged. | The logo now holds its slot through the cut (`combo-final-16x9/cut8-1560.jpg`, `combo-final-9x16/cut8-1560.jpg`). Carry windows rendered with the pre-fix and fixed engine (`prv-logs/ghost-cmp/`): r2-dev 154/154, r2-whip 46/46 and launch30 46/46 frames byte-identical. |
| 5 | `engine/blocks/particles.js:119–122` and the 5 `t + PRE` ramps (`:129, 146, 151, 168, 188`) | 05:57 | **A dive into particles landed on a near-empty frame.** The field's own pre-rolled assembly ran under the dive's ×0.3. The first frames after the cut were a dim speck on black, and QA content dropped to **26** differing thumbnail px (`combo-r1-16x9/cut5-1080.jpg`). | With `ctx.entered === 'dive'` (C's hook, as float uses it) the field arrives assembled. The dive's ×0.3 → 1 is then its entrance. `PRE` is 0 otherwise, so old frames are untouched (`t + 0 === t`). | `combo-final-16x9/dive-tile-wide.jpg`: the sphere arrives whole at the tile's place and grows. Content min **267** px on 16:9. kit-dev (no dive) is unaffected by construction (step 1). |
| 6 | `engine/blocks/particles.js:66` | 05:47 | **Purity false alarm.** kit-dev 16:9 printed `WARN purity burst, grid: the page's state at 3 frame(s) depends on the order …` at **max Δ 0, 0 px**. The cause: an emptied path bucket got `d=""`, while a never-used one had no `d`. Same pixels, different DOM. | Every path starts with `d=""`. | `prv-tools/sigdiff.mjs` with the film's exact shuffled and reverse orders: 5 differing DOM lines at frame 702 → 0, and 0 at 558 and 659. The final kit-dev films' purity lines are in step 1. |
| 7 | `lib/sheet.mjs:105–112` (`onScreen`) | 06:37 | **The review sheet described the kit wrongly.** type words showed `“” settles`. An exploded stack showed "8 cards cycle". A wall grid showed "video wall of 8 cards drifting". press, fan, particles and map showed nothing. | Added descriptions of the round-1 blocks and modes. The old blocks' strings are untouched. | `prv-combo` sheet: "word beats “Brief.” · “Cut.” · “Ship.”", "4 UI layers separate on a diagonal", "grid of 8 cards cascades in, one tile lit", "cursor presses the send …, rings burst" … (`prv-stills/sheet-preview.png`). Text only: no pixels. |

Fixes 1–6 are engine or lint code; 7 is the sheet's text. All five touched files are already on the shot-writer suite's `engine-allow.txt`, so its P4 check is unaffected.

---

## Step 1 · Dev-job films on the final engine

All films ran on the final engine, one aspect at a time, with `--workers 2` (`prv-tools/b1f.sh`, logs `prv-logs/film-<job>-<aspect>-final.log`).
- **The dev jobs.** The clones `prv-kit-dev`, `prv-r2-dev` and `prv-r2-whip` hold `beats.yaml` + `assets/`, copied with `cp -c`.
- **The templates.** I added clones of the two templates, `prv-launch15` and `prv-launch30` (from the merge's `mrg-launch15/30`), because fix 3 changes them.
- **An earlier run, stopped.** kit-dev's first 16:9 film (before any fix) said QA PASSED (20) with one `WARN purity … max Δ 0, 0 px`. That led to fix 6. I stopped that run there and re-ran everything on the final engine.

| Job | 16:9 | 9:16 | 1:1 |
|---|---|---|---|
| kit-dev (44.4 s, 15 shots) | **QA PASSED (20)**, 586 s | **QA PASSED (20)**, 569 s | **QA PASSED (20)**, 408 s |
| r2-dev (21.3 s) | **QA PASSED (16)**, 355 s | **QA PASSED (16)**, 368 s | **QA PASSED (16)**, 281 s |
| r2-whip (9.2 s) | **QA PASSED (12)**, 93 s | **QA PASSED (12)**, 94 s | **QA PASSED (12)**, 71 s |
| launch15 (template) | **QA PASSED (17)**, 178 s | **QA PASSED (17)**, 170 s | **QA PASSED (17)**, 134 s |
| launch30 (template) | **QA PASSED (20)**, 357 s | **QA PASSED (20)**, 346 s | **QA PASSED (20)**, 261 s |

**Every WARN / INFO line, judged** (`INFO cut` lines are moving or soft cuts proven by the shot log; continuity holds in all 15 films):

| Job | Line | True problem? |
|---|---|---|
| kit-dev | `WARN text` 16:9: fan chips and map labels 35 px | True by B's floor, accepted by design (merge j; rule 5's 30-px label floor met). |
| kit-dev | `WARN contrast` particles `grid` "Signal, not noise." 3.3:1 Lc 44 (16:9) · 2.8:1 Lc 35 (9:16) · 3.0:1 Lc 39 (1:1) | **True, marginal (F7).** The vignette under the headline doesn't clear the halftone dots, and the accent words sit on grey dots. Readable by eye (`prv-stills/kitdev-16x9-grid-hero.png`, `kitdev-9x16-grid-contrast.png`). |
| kit-dev | `WARN deadair` `exploded-low` 1.85–2.0 s | **True (F5).** The low-tilt planes barely drift for the last 2 s (`kitdev-16x9-exploded-low-hold.png`). |
| kit-dev | `INFO deadair` near: `exploded` 9:16, 0.03 s over | Fine. |
| kit-dev | `INFO purity` fan f292 (raster history, proven in order) · 9:16 f138 one-off (matched when drawn again) | Fine: B's two benign classes. **The first run's `WARN purity burst, grid … state` is gone in all 3 aspects (fix 6).** |
| kit-dev | `INFO continuity` sphere→burst 2.07×, grid→terrain 2.24×, wall-grid→words 2.08× | Fine: built-in zoom / whip, limit 3×. |
| kit-dev | `INFO sfx` 8 buried cues (the exploded labels' ticks 0.13 s apart) | Informational. |
| r2-dev | `WARN text` end tagline 45 px (16:9); the float's `POSTED` / `TEASER 1` tags 31–36 px caps | True, known block styling (merge g/k). |
| r2-dev | `WARN contrast` orange tags Lc 54, tagline Lc 53 | True, known (merge k: muted / orange tag contrast). |
| r2-dev | `INFO contrast` outlined text "Cut for" / "Friday" (check by eye) | Fine: the sticker's outline reads. |
| r2-dev | **1:1 `WARN flash` 3.00–3.88 s, 3.5 flashes** | **True, borderline.** It is `scan`'s stack cycle: the front card swaps bright/dark ~7×/s over ≥ 25 % of the 1:1 frame (`prv-stills/r2dev-1x1-flash-scan.jpg`). It is the same class as the merge's open point (film-sample 1:1 `scan`, §m). It is not from my edits: `stack.js` is untouched, and `scan`'s `from:` origin is unchanged by fixes 2/3 (`visualrect-cmp*`). |
| r2-dev | `INFO purity` max Δ 47 / 16 / 19, ≤ 20 px beyond ±2 | Within tolerance: the wall's raster noise. |
| r2-whip | `WARN text` tagline 45 px (16:9), `TEASER 1` 31–36 px caps; `WARN contrast` tags / tagline Lc 53–54 | True, known (as r2-dev). |
| r2-whip | `INFO deadair` near: `plan` 0.8 s · `INFO continuity` ask→plan 2.24× (whip, limit 3×) | Fine. |
| launch15 / launch30 | `WARN text` end card `product.app` 31 px + `Output` / `Input` / `Before` / `After` tags 31–36 px caps; `WARN contrast` the same | The same WARN set as the merge's final films (merge k). |
| launch15 / launch30 | `INFO cut` flood (soft cut by design) | Now **3.33× / 2.30× / 3.70×** (launch15) and **3.06× / 1.86× / 2.82×** (launch30). In the merge's run they were 6.07–8.76× and 4.50–7.83×, because the card was born at the halo's size, a bright slab on the cut. It is now born at the bar's size and grows (`prv-stills/launch15-16x9-flood-final.jpg`: the drop starts inside the Send button). The carry and drift cut at 660 is identical to the merge's (10.40× / 13.68× / 11.56×). |

**PASS:** every film in every aspect says QA PASSED, and the check counts match the merge's runs and the earlier reports. No new WARN comes from my fixes. The kit-dev purity WARN that the merge would have shipped is gone.

---

## Step 2 · The combined job `prv-combo` (PASS)

**The job.**
- `$J/prv-combo/beats.yaml`: 10 shots, 28 s, 120 BPM, `signature: dive`, `cause:` on every moving cut.
- Assets are film-sample's own plates, cards and logos, copied with `cp -c`. No footage and no private clips.
- Flow: `ask` press send **→flood→** `formats` fan **from: control** → cut → `route` map → drift-left → `layers` stack exploded → cut → `brief` prompt **→carry prompt-box → lit→** `grid` wall layout: grid **→dive (el: lit)→** `orbit` particles sphere (arrives whole, bursts at 2.5 s) **→dive (at [0.5, 0.32])→** `words` type words → cut → `meet` title **→needle carry (logo)→** `end` endcard.
- `--grid`: 3 warnings, all expected: fan 1:1 bleed and two reading times.

**Films** (`--film --aspect <a> --workers 2`, one aspect at a time; logs `prv-logs/film-combo-*-r3.log`):

| Aspect | Result | Cut lines | Continuity | Purity (QA's own 30) | Content min |
|---|---|---|---|---|---|
| 16:9 | **QA PASSED (16)**, 303 s | flood 1.35× INFO soft cut by design · 5 hard cuts PASS (8.4–408×) · drift 3.15× INFO · dives 1.35× / 5.14× INFO | 9 cuts, 3 moving + 2 carried, all hold, ratios 1.0–2.0× | 30/30 match, max Δ 1; 1 seam ok | 267 px |
| 9:16 | **QA PASSED (16)**, 314 s | flood 1.07× INFO · hard cuts PASS · dives 1.42× / 5.22× INFO | all hold, 1.0–2.0× | 30/30, max Δ 1 | 196 px |
| 1:1 | **QA PASSED (16)**, 236 s | flood 1.60× INFO · hard cuts PASS · dives 1.40× / 0.53× INFO | all hold, 1.0–2.0× | 30/30, max Δ 1 | 148 px |

**Every WARN / INFO line, judged:**

| Line | True problem? |
|---|---|
| `WARN text` 16:9: fan chips, map labels and exploded labels at 34–35 px under B's 47-px web floor; 9:16 / 1:1: end card `orbit.app` 31 px | True by the floor, accepted by design. The labels pass rule 5's 30-px label floor, and 16:9 chips at 34 px are merge decision j. The end card URL is the known deferred item (merge k). |
| `WARN contrast` end card URL / tagline 7.0–7.4:1 but APCA Lc 50–53 | True and known: the end card's muted grey (merge k, deferred). |
| `WARN deadair` `meet` still for 1.6 s (title has no read copy, so the floor is 0.6 s) | True. The old `title` block springs in, then only wobbles the logo ±5°. It is a job-level fix (3 beats, or a push), not an engine bug. With `pre: Meet` it was only INFO; I removed `pre` to make the needle work (fix 4 story). |
| `INFO cut` × 4 (flood, drift, 2 dives) | Fine: each is a moving or soft cut proven by the shot log. |
| `INFO continuity`, `INFO purity`, `INFO flash` | Fine. |
| `INFO sfx` 6 buried cues (fan pop, map tick, the exploded stack's label ticks 0.13 s apart) | Informational. The exploded stack's label ticks are spaced closer than the mix can separate. |

**Continuity by eye** (cut sheets at 30-fps cut−4 … cut+6 for every cut, plus wide windows; the frame offsets are in each tile's label):
- **Flood → fan**: `combo-final-16x9/flood-wide.jpg`, `cut0-180.jpg`; 9:16 `combo-final-9x16/cut0-180.jpg`; 1:1 `combo-final-1x1/cut0-180.jpg`.
  - The drop starts inside the Send button under the cursor, an iridescent ring rides the front, and the frame is covered on the cut. The hero card is there on the cut at the bar's centre, then the tiers deal out.
  - **Weak spot:** the flood's last 1–2 sixty-fps frames are solid dark (16:9 f179; 9:16 f178–179). That is the flood as designed ("covered by the cut"): 1/30 s, not a stall.
- **Fan → map** (hard cut): the fan pushes into the hero; the map opens with its headline rising in. Fine.
- **Map → stack exploded** (drift-left):
  - The direction holds (−656 → −1319 px/s on 16:9), peaking on the cut.
  - The stack arrives already drifting, and its headline enters on rise + blur.
  - The map's own out-drift is mostly motion blur, barely any travel: old `drift` behaviour, not the kit.
- **Prompt → wall grid, carry** (`combo-final-16x9/carry-wide.jpg`; 9:16 `cut4-900.jpg`; 1:1 `cut4-900.jpg`): the box lifts, blurs through the cut, travels to the lit tile's slot (upper right of centre on 16:9 / 1:1, the centre tile on 9:16) and lands exactly. The grid cascades in around the gap. See F1 for the stretched look.
- **Grid → particles, dive into the lit tile** (`dive-tile-wide.jpg`; 9:16 `cut5-1080.jpg`): the camera flies into the lit tile, and the sphere is born at the tile's place, whole and still flying forward. Orbits draw on after. Speed 15999 → 13219 px/s (1.21×), fastest on the cut.
- **Particles → words, dive into the burst** (`dive-sphere-wide.jpg`): the burst fires as the zoom starts; we fly over the headline into the dots; "Brief." arrives at ×0.3 and keeps growing. See F2.
- **Words → title** (hard cut): fine.
- **Title → end card, needle** (`cut8-1560.jpg` in all 3 aspects): the logo stays in its slot and pulses (16:9 ≈ 1.0×, 9:16 1.12×) while light hard-cuts to dark. The end card's name appears beside it; tagline and URL fade in after.

**How the job got here (rounds).**
- **r1** found fixes 2, 3, 5 and 4's symptom: the fan hero born oversize, the near-empty dive landing, the logo over "Meet"'s "t" and the end card's "Or".
- **r2** removed `pre: Meet`, still saw the logo over "Or", and that led to fix 4. It also moved the second dive off the headline (`at: [0.5, 0.32]`, `burstAt: 2.5s`).
- **r3** is the final engine, all three aspects. r1 / r2 stills are kept in `prv-stills/combo-r1-16x9/` and `combo-r2-16x9/` as the "before" evidence.

## Step 3 · Purity inside the transition windows (PASS)

`node $J/prv-tools/purity-win.mjs $S $J/prv-combo <a> $J/prv-logs/purity-win-<a> 30 2026102700`:
- **The windows.** The tool takes every cross-cut window from the timeline:
  - flood: A's last 28 + 12 after
  - carry: cut − 2·pre … cut + 2·post
  - dive: A's last 28 + 60 after
  - `from:`: B's first 36
- **The draw.** It spreads 30 frames over them, draws them in a seeded shuffled order on **one** fresh page, and compares each with the film's frame. B's tolerance is max |Δ| ≤ 2, or ≤ 0.01 % of channels above it.

| Aspect | Windows (60-fps) | Result |
|---|---|---|
| 16:9 | flood 152–192 · from: 180–216 · carry 884–928 · dive 1052–1140 · dive 1232–1320 · needle 1548–1572 | **28 byte-identical, 2 within tolerance** (1554, 1550: max Δ 1, 0 channels > 2), **0 outside** |
| 9:16 | the same windows | **28 identical, 2 within tolerance, 0 outside** |

Order and per-frame results: `prv-logs/purity-win-*/result.json`; logs `prv-logs/purity-win-combo-*.log`. On top of this, each film's own QA purity (30 seeded frames) matched at max Δ 1 in all 3 aspects.

## Step 4 · Layers, alpha clip, review sheet (PASS)

`node $S/lv.mjs --job prv-combo --layers ask,formats,route,layers,brief,grid,orbit,words --aspect 16x9` (`prv-logs/layers-combo.log`, 391 s): **8 / 8 pass layer QA** (order, format, layers, nonempty, bg, stack, stack+bg).

| Shot (block) | Layers | Worst restack |
|---|---|---|
| ask (press send) | backdrop · control · label · rings · cursor | 0 px > 16, max 4 |
| formats (fan, `from:`) | text · cards · labels | 34 px > 16, max 78 (limit 64 px): 3-D cards, less margin as SPEC-R1 rule 6 expects |
| route (map) | map · route · pins · labels · text | 0, max 4 |
| layers (stack exploded) | text · planes · leaders · labels | 0, max 3–5 |
| brief (prompt, carry source) | prompt-box · prompt-text | 0, max 2 |
| grid (wall grid, dive source) | tiles · lit · band · headline | 0, max 4 |
| orbit (particles) | particles · orbits · text | 0, max 3–4 |
| words (type words) | headline | 0, max 4 |

- **`--layers brief --with-transitions`**: passes with a 4th layer `carry`, visible 67–74 (the carry's A side). The clean export has no carry, as specified.
- **`--clips formats --alpha`**: `PASS clip prores 1920×1080 yuva444p12le 90/90`, `PASS content`, `PASS freeze`.
- **`--sheet --aspect 16x9`**: `review/prv-combo-16x9/` (10 shots, film bd134a9).
  - Every cut has three half-size stills (cut−1, cut, cut+1) with the shot names and a camera line, e.g. "camera: still on both sides of the cut · 1 carried object, continuous" and "speed 15999 → 13219 px/s (1.21×) · fastest on the cut".
  - Each row also shows its cause.
  - I read `sheet.json` / `index.html`, the strip `thumbs/cut.00900.jpg`, and a full-page screenshot of `preview.html` (`prv-stills/sheet-preview.png`, top in `sheet-preview-top.png`). That reading is where fix 7 came from.

## Step 5 · Old jobs (PASS)

Clones `$J/prv-old-<job>-{L,L2,S}` (`cp -c` of `beats.yaml`, `brief.md`, `assets/` and `blocks/`): two runs with the live tool, one with the stage tool. Batch `prv-tools/b5.sh`; results in `prv-logs/oldjobs-heroes.txt`, `oldjobs-range.txt`, `oldjobs-qa-lines.txt`.

| Job · aspect | Heroes live vs stage | live vs live2 |
|---|---|---|
| film-sample 16:9 | 11 / 12 identical; `10-wall.png` max Δ 2, 0 channels > 2 | `10-wall.png` max Δ 3 (5 channels > 2) |
| film-sample 9:16 | 11 / 12; `10-wall.png` max Δ 2 | `10-wall.png` max Δ 3 |
| film-sample 1:1 | 12 / 12 | 12 / 12 |
| steady-sample 16:9 / 9:16 | 7 / 7 · 7 / 7 | identical |
| reel-sample 16:9 / 9:16 / 1:1 | 8 / 8 each | identical |
| edge-test 1:1 | 7 / 7 | identical |
| dark-ui-check 16:9 | 3 / 3 | identical |

- **The composite sheets.** `storyboard.png` differs by design: B's floor notes and D's cause line. Live vs live2 composites also differ by up to 8 where they embed the noisy wall still.
- **The known exception holds.** The only hero that differs is the wall, ≤ 3 code values, and two live runs differ the same way.

**Films:**
- **film-sample `--range 100,219` 16:9** (open → name zoom-in cut), live vs stage: frames **120/120** and bgref **120/120** byte-identical. Both exit 1 after writing frames ("120/2265 on disk"), as expected for a partial film.
- **steady-sample 16:9 `--film`.** Both say **QA PASSED (12 checks)**, and the 12 PASS/FAIL lines are identical. Frames are **1200/1200** byte-identical. The stage adds only WARN / INFO:
  - continuity INFO (ratios 2.0–2.6×, the built-in zoom / whip limit is 3×)
  - text-floor WARN (31–43 px UI lines)
  - contrast WARN (3.8–4.0:1)
  - dead air, flash and purity INFO (3 frames of raster history, proven)
- **qa-probe / qa-probe2 16:9 `--film`.**
  - Both tools say **QA FAILED (2)** on each probe, with identical FAIL lines:
    - qa-probe: `freeze` at 181–239, `content` 80 near-empty frames
    - qa-probe2: `freeze` at 118–121, `content` 24 frames
  - Frames are 480/480 and 600/600 identical.
  - The stage adds dead-air WARNs and INFO lines only.

## Findings for the lead (not fixed)

| # | Sev | Finding | Suggestion |
|---|---|---|---|
| F1 | LOW | A smooth carry between two different things (prompt box → lit tile) stretches **both pictures** onto one box. The tile's picture is visibly squashed horizontally for ~6 frames after the cut (`combo-final-16x9/carry-wide.jpg`, f906). This is C's design ("one outline, no double"). | In the GUIDE: for two different boxes, prefer `mode: morph` (C already says so). Or crossfade the pictures uniformly scaled inside the stretched box. |
| F2 | LOW | `particles` burst + `out: dive`: the burst throws the dots outward, so the zoom (expo-in, peaking on the cut) flies into an emptied centre. The last ~10 sixty-fps frames are a dark field with a few streaks (`dive-sphere-wide.jpg`). | Job-level: dive into an unburst sphere, or put `burstAt` on the dive's last ~6 frames. A `--grid` hint would help. |
| F3 | LOW | A carried clone is drawn above the next shot, so a carry whose path crosses B's own content covers it. With `pre: Meet`, the logo's path to the end card's slot crossed the end card's name. | GUIDE: carry between matching slots (title without `pre` → end card), or carry the `name`. |
| F8 | INFO | GUIDE text for custom blocks: a decorative glow whose box is much bigger than what it draws should carry `data-lv-soft`, or carry / dive / flood / `from:` will measure the glow (fix 3). | One line in the custom-blocks section (the doc agent's file). |
| F4 | LOW | `--grid` says nothing when `from:` follows `out: flood`. The source is hidden under the flood on the cut, so the "grows out of it" link is invisible; the card simply appears at the source's place. | A one-line INFO, or the GUIDE. |
| F5 | INFO | kit-dev `exploded-low` (stack exploded, `tilt: low`, no `text`) WARNs dead air: 2.0 s with no read copy. The plane labels are "glanced", not read, by A's `read()`. The planes barely drift for the last 2 s (`prv-stills/kitdev-16x9-exploded-low-hold.png`). | A's drift is too small for `tilt: low`, or count the labels as read copy. |
| F7 | LOW | particles `mode: grid` on light: the headline's vignette leaves halftone dots under the accent words, so kit-dev WARNs contrast 3.3 / 2.8 / 3.0:1 (Lc 44 / 35 / 39) by aspect. | A stronger vignette (or no dots) under the line in `grid` mode. |
| F6 | INFO | `--layers` of a fan `from:` shot passes with the least margin of the kit (34 px > 16, max 78 vs limit 64 px). | Watch it when the fan changes. |

Still open from earlier reports (not re-tested here): A-verify N1 (9:16 exploded chips on their anchors), C-verify V3 / V5, the reverted decision d (`ui.js`), and the wall's run-to-run raster noise (seen again: max 2–3).

## Hygiene

| Check | Result |
|---|---|
| Live skill | `shasum -c live-before.sha1` in `~/.claude/skills/product-launch-sting`: **867 OK, 0 not OK** (checked mid-session and at the end). |
| `live-before/`, `base/` | `live-before/` 0 not OK. `base/`: `stage-r1-base.sha1` 871 OK, `merge/base.sha1` 0 not OK. |
| Original jobs | **0** files under `~/Downloads/launch-videos` are newer than this session's first file. Originals were read and cloned with `cp -c` (film-sample's assets into `prv-combo`, the five old jobs + two probes into `prv-old-*`), never run with `--job`. |
| Stage code | Changed only in the files and lines above; `prove-edits.diff` (183 lines) against `prv-tools/orig/` (sha1 = `merge/stage-final.sha1`). `qa.mjs` differs from that manifest by the flash pass (merge §m, before this session). The `.md` files were changed by the doc agent, not me. |
| Heat | `pmset -g therm` checked before every render (`prv-tools/lib.sh` `cool()`): no warning recorded all session. Renders ran one at a time, at `--workers` ≤ 2. Two in-flight renders were stopped and restarted when I changed the engine under them. |
| Disk | 46 GB free at the start, never below 32 GB (`lib.sh` stops a batch under 25 GB; `b1f.sh` prunes under 35 GB), **40 GB** at the end. I deleted the `frames/`, `bgref/`, `textless/`, `purity/` and `layers/` folders (and the alpha `.mov`) of my own jobs once measured. My jobs hold 2.2 GB now: mp4s, `qa.json`, `purity.json`, hero frames in `keep/`, boards, sheet, logs. |
| Private footage | None in `prv-combo` (film-sample plates, cards and logos only). `prv-kit-dev` is a clone of kit-dev, as the task asks. |

## Files
- Jobs: `$J/prv-kit-dev`, `prv-r2-dev`, `prv-r2-whip`, `prv-launch15`, `prv-launch30`, `prv-combo`, `prv-lint`, `prv-old-*`.
- Tools (read-only on the engine):
  - `$J/prv-tools/`: `lib.sh`, `b1f.sh`, `b2.sh`, `b4.sh`, `b5.sh`, `chain.sh`
  - `probe.mjs` (evaluates an expression in a stage page), `sigdiff.mjs` (DOM state after two histories), `frames.mjs`
  - `purity-win.mjs`, `cutsheet.py` (labelled cut sheets; venv PIL), `shot.mjs` (page screenshot)
- Stills: `$J/prv-stills/combo-final-{16x9,9x16,1x1}/` (final), `combo-r1-16x9/`, `combo-r2-16x9/` (before the fixes), `kitdev-*.png`, `sheet-preview*.png`.
- Edits: `$M/reports/prove-edits.diff`.
