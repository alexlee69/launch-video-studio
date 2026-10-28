# Verify report: Worker A (blocks), round 1 fix pass (2026-10-26)

**Verdict.** The fix pass holds for **17 of my 20 findings** and is **not ready to merge** until one new 9:16 defect is fixed.

| Verdict | Count | Findings |
|---|---|---|
| FIXED | 17 | #1–#9, #11–#17, #19 |
| NOT FIXED | 2 | #10 (leaders > 120 px, on 9:16), #18 (9:16 exploded composition) |
| DISPUTED-WORKER-RIGHT | 1 | #20 (fan headline `translate3d`) |
| DISPUTED-WORKER-WRONG | 0 | — |

- **New, caused by the fixes for #3, #10 and #18:** on 9:16, `stack mode: exploded` puts each label chip **on top of its own anchor**. The leader runs backwards under the chip and is invisible, and the chips sit on the plane art. It shows on kit-dev's own 9:16 shots (4 of 4 labels in `exploded`, 2 of 4 in `exploded-low`). QA and `--grid` are silent. **MEDIUM** (N1 below). Not a small fix, so I did not touch it.
- **Two LOW new notes**: a map stop in the 9:16 platform-UI zone gets its chip far from its pin (N2); the press label roll shows both labels overlapping for ~4 film frames (N3).
- **What holds.** Old jobs are untouched (byte-identical or same as live's own noise, all three aspects). The kit-dev films pass QA in all three aspects, all 15 layer exports pass, the clip passes, bad input fails `--grid` with one-line messages. Purity is fixed for every new block except the fan headline.

I edited nothing in the staging copy. Code under test: `shasum -c jobs/ver-A-logs/code-at-start.sha1` (53 files) is still all OK, so the earlier, network-killed attempt of this pass rendered the same code. I reuse its films, layer runs and clip (logs named below) and re-ran everything cheap myself.

Shorthands:

```
S=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit/stageA/product-launch-sting/video
J=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit/jobs
T=$J/mon-A-tools ; V=$J/ver-A-tools ; L=$J/ver-A-logs   # my logs this pass: $L/v3/
```

Jobs (all `cp -c` clones, or my own inputs):
- `ver-A-kit` = kit-dev (films, boards, layers, clip). `ver-A-fail` = fan9 + pr-long (films). `ver-A-stress`, `ver-A-perf` = the stress shots. `ver-A-bad`, `ver-A-warn`, `ver-A-fixwarn` = bad/soft input. `ver-A-light` = light-theme wall grid.
- `ver-A-edge` (new): 11 edge shots — a 5-label exploded, the kit exploded without a headline (dark), exploded-low with a headline, a 3-card wall grid, a 2-letter send, 4 words in 1 s, a 3-card fan, a corner-to-corner map, a 3-word key label, a dark toggle with a long label.
- `ver-A-old-live`, `ver-A-old-live2`, `ver-A-old-stage` = film-sample; `ver-A-fkd-live`, `ver-A-fkd-stage` = film-kit-dev; `ver-A-grids/*` = all 16 original jobs.

---

## Per finding

| # | Sev | Finding (round 1) | Verdict |
|---|---|---|---|
| 1 | HIGH | press: long label cut off, cursor on it | **FIXED** |
| 2 | HIGH | fan count 7/9 + labels: chips off-frame on 1:1 | **FIXED** |
| 3 | HIGH | exploded: anchors on the plane in front | **FIXED** (but see N1) |
| 4 | MED | map: scrim over route, pins, chips | **FIXED** |
| 5 | MED | press: cursor tip on the `after` label | **FIXED** |
| 6 | MED | press: hidden `after` label audited | **FIXED** |
| 7 | MED | purity: frames depend on draw history | **FIXED** (fan headline left, = #20) |
| 8 | MED | 6 of 7 looks cut in on an empty frame | **FIXED** |
| 9 | MED | word beats small on 9:16 | **FIXED** |
| 10 | MED | exploded leaders > 120 px | **NOT FIXED** (fixed on kit-dev's inputs only; 9:16 fails, N1) |
| 11 | MED | light wall grid washes out | **FIXED** |
| 12 | LOW | validation gaps | **FIXED** |
| 13 | LOW | `layers:` order wrong | **FIXED** |
| 14 | LOW | `read()` missing | **FIXED** |
| 15 | LOW | burst hero mid-entrance | **FIXED** |
| 16 | LOW | particles SVG, speed not measured | **FIXED** (rule 12 open for the lead) |
| 17 | LOW | chips under B's floors | **FIXED** (16:9 chip floor open for the lead) |
| 18 | LOW | 9:16 composition | **NOT FIXED** (fan fixed; exploded not, N1) |
| 19 | LOW | lines through headlines | **FIXED** |
| 20 | LOW | fan headline `translate3d` | **DISPUTED-WORKER-RIGHT** |

### 1 · HIGH · press long label → FIXED
- **Films.** `ver-A-fail` (fan9, pr-long, pr-long-after), current code: **QA PASSED (12 checks) on 16:9, 9:16 and 1:1**, text `14 / 6 / 8 text boxes … none clipped or tiny` (`$L/fail-film-{16x9,9x16,1x1}.log`). Round 1: 1:1 FAIL `text clipped by the frame`.
- **By eye** (`$L/stills/fail-{169,916,11}.png`): the label wraps to two balanced lines in all aspects, the face widens, nothing is cut. The cursor tip sits right of the label (or on the face's lower right when the label fills it), never on the glyphs. "Generating your teaser…" wraps on 9:16 too.
- **`--grid`** warns in one line per shot: `press pr-long: label "Generate a cinematic launch teaser for Friday" wraps to two lines on 16x9, 9x16, 1x1 — a press reads best with 1–3 words`; the send gets the "cut short with …" line (`$L/v3/grid-ver-A-stress.log`). My edge `e16` (dark toggle, "Auto-publish to every channel") warns for 9:16 and 1:1 only and renders cleanly on two lines.

### 2 · HIGH · fan chips off-frame → FIXED
- `ver-A-fail` 1:1 film passes (above). By eye: 16:9 shows all 9 chips; 1:1 shows only D, E, F (the bleeding cards' chips are dropped, none half-cut); 9:16 shows E inside the hero's foot.
- `--grid`: `fan fan9: count 9 — the outer cards bleed off the frame on 1x1; a label whose chip would leave the frame is dropped there (9:16 shows the middle 3)`. kit-dev's 5-card fan gets the same note for 1:1 (it is by design; fine as a note).

### 3 · HIGH · exploded anchors → FIXED (the anchor), see N1 (the chip)
- `probe.mjs … @anchors.js` over kit-dev `exploded` and `exploded-low`, all 3 aspects, frames 48/65/90/107: label k's dot is on plane k in every case (`$L/anchors-leaders.log`; also the 5-plane stress `x5`, `$L/anchors-x5.log`). The 16:9 still reads right: each dot sits on the right-hand corner of its own plane.
- But on 9:16 the chip now covers that dot — N1.

### 4 · MEDIUM · map scrim → FIXED
- kit-dev map in 3 aspects: "Launch" reads as black on white; the fade sits under the route, pins and chips. Stress `map6` (`$L/stills/map6-3asp.png`): Two and Four are crisp in every aspect and clear of "Six stops.".
- `--grid` warns for a stop under the headline: `map m1: stop 1 (Start) sits under the headline on 16x9, 9x16, 1x1 — move it lower or right, or drop the text`.

### 5 · MEDIUM · cursor on the `after` label → FIXED
- pr-gen 16:9 frames 61–68 (`$L/stills/prgen-61-68.png`): the tip stays right of "Generating…" through the switch.

### 6 · MEDIUM · hidden `after` label audited → FIXED
- `probe.mjs ver-A-kit 16x9 pr-gen 59,61,62,63,64,66 "LV.audit()…"` (`$L/v3/probe-prgen.log`): frames 59–62 (hero 61) list only `Generate` and `One click.`; `Generating…` first appears at 63 as it enters the face.

### 7 · MEDIUM · purity → FIXED (fan headline excepted)
- **16:9, film vs fresh pages** (`$L/purity-16x9.log`, 135 frames × sorted / shuffled / reversed vs the film): **4 of 135 differ, all fan** — f0 reversed (max 19, 786 px: the 3D cards mid-deal) and f54 / 54.5 / 67.5 vs the film (max 58–59, 1765–3998 px, the headline). Round 1: 47 of 135, in every new block. My two true order effects are gone: exploded f12 reversed and pr-send f71 are max 0.
- **9:16 and 1:1, contiguous vs fresh** (`runs/A-tools/contig.sh`: local frames 0…F on one page, as the film draws, vs F alone on a fresh page, as a purity re-render does; `$L/v3/contig-{9x16,1x1}.log`):

  | Shot · frame | 9:16 | 1:1 |
  |---|---|---|
  | pr-gen 61, pr-send 71, map 96, exploded 70 | 0 px, max 0 | pr-send, map, exploded: 0 px, max 0 |
  | wall-grid 80, words 20, sphere 40 | 0 px, max 0 | — |
  | **fan 54** | **7090 px > 2, max 173** | **578 px, max 58** |

  The fan diff is the headline's glyph edges only (a sub-pixel shift of "One prompt. Every format.", `$L/v3/fan916-diff-crop.png`). Invisible by eye, but on 9:16 it is larger than on 16:9, so expect Worker B's purity WARN on the fan in a 9:16 film.
- The fan headline is #20's trade-off, not a new defect.

### 8 · MEDIUM · empty cut-in frames → FIXED
- Local frame 0 of every shot, new film vs round 1 (`$L/stills/first-frames-16x9.png` vs `jobs/mon-A-logs/stills/first-frames-16x9.png`; 9:16 in `first-frames-9x16.png`): the fan opens on a full-size hero card with the sides arriving (was a faint thumbnail), the wall grid on ~20 of 24 tiles (was 4), sphere / burst / grid on a wide field.
- Exploded opens on the flat stack at full size, which the spec asks for ("stacked flat at first"). Terrain is still the dimmest opening (faint, blurred rows) but in kit-dev it sits under the grid→terrain whip. Not worth reopening.

### 9 · MEDIUM · word size on 9:16 → FIXED
- `LV.audit` px (`$L/probe-words.log`): 9:16 "Unbeliev-/able." **185 px** (was 130), "Extra-/ordinary." **239 px** (was 149), "Go." 307; 1:1 209 / 270 / 307; 16:9 keeps one line (263 / 301 / 369). The breaks read naturally (`$L/stills/words-long.png`); my `Extra|ordinary.` mark works (`ver-A-edge e3`).
- One size per shot was not adopted: DISPUTED-WORKER-RIGHT on that sub-point ("each word fills the frame" is the look).

### 10 · MEDIUM · leaders > 120 px → NOT FIXED
- **Holds on kit-dev:** max 95 / 107 / 105 (exploded) and 118 / 105 / 118 (exploded-low) on 16:9 / 9:16 / 1:1.
- **Fails on 9:16 for ordinary inputs** (`$V/xchips.js`, `$L/v3/xchips.log`): kit's exploded with `theme: dark` and no headline (`e11`) 109–153 px; exploded-low with a headline (`e12`) up to **253 px**; 5 planes with a long first label (`x5`) 226 px. The cap is computed, then `bx = min(col, ax + 14u + run, safe.x1 − chip.w − 10u)` lets the safe-box clamp win, so the chip lands left of the anchor and the leader runs backwards. Same root cause as N1.

### 11 · MEDIUM · light wall grid → FIXED
- `ver-A-light` 16:9 still: the dimmed tiles darken (dark overlay), the lit tile and headline band read crisply; no pastel wash.

### 12 · LOW · validation gaps → FIXED
- `--grid` on `ver-A-bad`: 13 one-line errors, one per bad shot; stack `count: 1` gives a single error (`stack count must be 3–5 planes in mode: exploded (got 1)`). `ver-A-warn`: `fan labels[0] must be text, e.g. Clips (got {"x":1})`.
- **Duplicates on screen:** `w1` (`cards: [a, b, a, c, d]`) in the browser, `$V/tilesame.js` over the visible tiles: 4 distinct files, **0 same-file neighbour pairs** on 16:9 (24 tiles), 9:16 (15) and 1:1 (16) (`$L/v3/tilesame.log`). Round 1: 7 / 4 / 6 pairs.
- `ver-A-fixwarn` warns for: count in grid mode, count 3000, spacing 16, a duplicated card (`1 card is listed twice — layout grid uses 4 different cards`), off-grid pick per aspect, wrapping pick 40, `face` with words, a tight press, a word too long to fill, a stop under the headline (`$L/v3/grid-ver-A-*.log`). Spec also warns `count` in terrain and `spacing` in sphere/burst (code read).

### 13 · LOW · layer order → FIXED
- Export lines: fan `text, cards, labels`; exploded `text, planes, leaders, labels`; map `map, route, pins, labels, text` — all match the `layers:` strings (`$L/layers-16x9.log`, `--blocks`).

### 14 · LOW · `read()` → FIXED
- particles `[text]`, fan `[text]`, exploded `[text]`, words `over + words`; old modes return `null` (falls back to copy). All 16 original jobs give identical `--grid` output on live and staging (below), so old reading times are unchanged.

### 15 · LOW · burst hero → FIXED
- kit-dev burst hero = 35 (`$L/v3/kit-heroes.txt`); at 34–35 the headline audits at opacity 1, 105.9 px, no filter (`$L/v3/probe-burst.log`).

### 16 · LOW · particles SVG / speed → FIXED (as far as Worker A can)
- `count` > 2000 and `spacing` < 20 warn (`$L/v3/grid-ver-A-perf.log`). SVG kept for the canvas raster race; GUIDE text supplied for the lead.
- Seek + PNG, median (`$L/timing-16x9.log`): headline 85 ms, map6 148, pr-long 145, x5 241, grid14 242, fan9 291, sphere 4000 367, wall 12×12 463 ms. **For the lead:** SPEC rule 12 ("well under 100 ms") is not met by any footage or particle block once painting is counted; old footage blocks are in the same range.

### 17 · LOW · chips vs B's floors → FIXED (16:9 floor is the lead's call)
- Film audits (`runs/A-tools/chipsizes.py`): chips 40.4–41.8 px on 9:16 and 1:1 (were 32–37), pr-send 53.3 px on 1:1 (was 44.5). 16:9 chips stay 34.4–35.4 px — above SPEC rule 5's 30 px label floor, under B's 47 px `web` must-read floor. Lead decides which floor chips answer to.

### 18 · LOW · 9:16 composition → NOT FIXED
- **fan: fixed.** The hero runs to the UI line (~53 % of the height), the chip rides in its foot.
- **exploded: not.** kit-dev 9:16 `exploded` still leaves the bottom third empty (planes end at y ≈ 1290 of 1920), the top plane touches the left edge, and without a headline (`e5`, `e11`) the stack bleeds ~65 px off the left edge. The widening that was meant to fill the frame pushed the chips onto the planes (N1).

### 19 · LOW · lines through headlines → FIXED
- press rings: masked around the headline glyphs (`$L/stills/prgen-61-68.png`, `fail-11.png`); sphere orbits: a feathered hole round the glyphs (16:9 `03-sphere.png` crop). No line crosses a glyph.

### 20 · LOW · fan headline `translate3d` → DISPUTED-WORKER-RIGHT
- The worker's `runs/A-fix/layers-fan-none.log` shows `transform: none` fails layer QA (`f57 209 px > 16`). With `translate3d` the 16:9 and 9:16 fan exports pass (worst 15 / 16 px > 16, max 48 / 32, limit 64). A layer FAIL is worse than a purity WARN; this is an engine-level compositing interaction for the lead.

---

## New findings

### N1 · MEDIUM · 9:16 exploded: the label chips sit on their own anchors; leaders run backwards and vanish
- **Where.** `engine/blocks/stack.js` `buildExploded`: the 9:16 plane width (`pw = W × .62` with a headline, `.7` without, line 33) plus the chip x `bx = Math.min(col, ax + 14*u + run, safe.x1 - ch.w - 10*u)` (line 138). The anchors sit at x ≈ 780–860; `safe.x1 − chip.w − 10` is smaller, so the chip is placed left of its anchor.
- **What you see.** kit-dev 9:16 `11-exploded.png`: all four chips (Interface, Media, Layout, Colour) cover their dots and the right corners of the planes, "Interface" sits on the blue button, the leaders are 10–20 px stubs pointing left. `12-exploded-low.png`: Footage and Plate the same. With no headline (`e5`, `e11`) the stack also bleeds off the left edge. Contact sheet: `jobs/ver-A-logs/v3/edge916-stacks.png`.
- **Measured** (`node $T/probe.mjs <job> <aspect> <shot> <f> @$V/xchips.js`, `$L/v3/xchips.log`): BACK = chip left of its anchor, COVERED = a chip box over the dot.

  | Shot | 16:9 | 9:16 | 1:1 |
  |---|---|---|---|
  | kit exploded | clean | **4/4 BACK + COVERED** | clean |
  | kit exploded-low | clean | **2/4 BACK + COVERED** | clean |
  | e11 (kit exploded, dark, no text) | clean | **4/4 BACK + COVERED**, leaders 109–153 px | clean |
  | e5 (iso, labels A–D, no text) | clean | 2/4 BACK | clean |
  | e12 (low + headline) | 1 BACK | **4/4 BACK, 3 COVERED**, up to 253 px | 1 BACK + COVERED |
  | x5 (5 planes, long label) | 1 BACK | **4/4 BACK, 3 COVERED**, 226 px | 2 BACK, 1 COVERED |

- **Why QA misses it.** Text is readable and inside safe; nothing checks that a callout is attached to what it labels.
- **Fix (Worker A).** At the landed pose, after the anchors and chip widths are known: if any `ax + 24u + chip.w + 10u > safe.x1`, shrink the stack (scale `pw`, `ph` and `gap` by the shortfall and recompute the quads and anchors, a 2-pass loop) instead of letting the chip slide back. On 9:16 that means a plane width of roughly .5–.55 W with labels; then centre the stack + chip column as one group, which also stops the left-edge bleed. Assert `bx ≥ ax + 24u` for every label. Re-check with `xchips.js` in all 3 aspects and re-run `--layers exploded,exploded-low --aspect 9x16`.

### N2 · LOW · map: a stop in the 9:16 platform-UI zone gets its chip far from its pin
- `ver-A-edge e14` (Home at [0.08, 0.92]) and stress `map6` (Six): on 9:16 the pin sits in the bottom UI zone, the chip is lifted into safe ~250–400 px above it and lands on the route line (`$L/stills/e14-9x16-home.png`, `map6-3asp.png`). `--grid` warns for the headline zone but not for this.
- **Fix.** In `validate`, warn when a stop falls below `safe.y1` on 9:16 ("its chip can't sit by the pin"), like the headline-zone warning.

### N3 · LOW · press: mid-swap, "Generate" and "Generating…" overlap
- pr-gen frames 63.5–65.5 (`$L/stills/prgen-swap-62_5-66.png`): both labels are fully inside the face, one line apart by less than a line height, so their glyphs touch for ~4 film frames. A slot roll reads cleaner with a full line of travel (outgoing clipped at the top while the incoming enters at the bottom). Polish, not a blocker.

---

## SPEC-R1 done criteria, re-run

| Item | Status | Evidence |
|---|---|---|
| File ownership | **met** | `shasum -c stage-r1-base.sha1` in `stageA`: only press, fan, particles, map, stack, type, wall, index, spec.mjs changed, plus the new `_motion.js`. |
| `--blocks` lists every field | **met** | `$L/v3/blocks.txt` (same as the earlier attempt's): every new block and mode with all fields, layers and footage lines. |
| `--grid` bad input | **met** | above (#12). |
| kit-dev `--storyboard --aspect all` clean | **met** | One note: the fan's 1:1 bleed (by design). Boards in `ver-A-kit/kit-dev-storyboard-*.png`. |
| kit-dev `--film --aspect all` | **met** | **QA PASSED (20 checks)** 16:9 / 9:16 / 1:1: 36 / 32 / 35 text boxes none clipped or tiny, content min 523 / 434 / 411, freeze none, 59 cues on their frames, INFO 8 buried cues (`$L/kit-film-*.log`). |
| `--layers` every new shot, 16:9 | **met** | 15/15 PASS every line, worst stack fan 15 px > 16 (max 48), all others 0 px (max ≤ 5) (`$L/layers-16x9.log`). 9:16 exploded, exploded-low, fan also PASS (`$L/layers-9x16.log`). |
| `--clips <one> --alpha` | **met** | `--clips map --alpha`: PASS clip prores 1920×1080 yuva444p12le 120/120, content, freeze (`$L/clips-map.log`). |
| Rule 1: old jobs byte-identical | **met** | Only film-sample and film-kit-dev use the blocks Worker A touched (type, stack, wall). **Film slices, live vs staging, film-sample:** type 145–289 and stack 1190–1393 are byte-identical on **16:9, 9:16 and 1:1** (145/145 and 204/204 each; `$L/oldrange-v2.txt`, `$L/v3/oldrange-v3.txt`), type 2119–2264 on 16:9 (146/146). **Storyboard stills, all 3 aspects:** film-sample live vs staging 35/39 byte-identical, film-kit-dev 33/39; every difference is the default `10-wall.png` (max 2–3) and the composite sheet that contains it. Two live runs differ from each other the same way (live vs live2: 33/39, the same files, max 2–3; `$L/v3/board-*.txt`), and the wall's default code path is untouched (diff: only the new `layout: grid` branch and an import). **All 16 original jobs:** `--grid` output identical on live and staging; `timeline.json` differs only by the lead's `"delivery": "web"` (`$L/v3/old-grids.txt`; shots-demo exits 2 on both, it has no `shots:`). The range renders exit 1 on both engines after writing the frames (`--range` stops at the mux: "145/2265 on disk"), as expected. |
| Rule 2: pure frames | **met but fan** | #7, #20. Grep: no `Math.random`, `Date`, rAF, transitions in the new files. |
| Rule 3: never still | **met** | film `freeze` PASS ×3. |
| Rule 4: every aspect laid out | **not met on 9:16 exploded** | N1. |
| Rule 5: text sizes | **met** | headlines 73–114 px, chips ≥ 34 px, words ≥ 185 px on 9:16; 16:9 chips vs B's floor = lead (#17). |
| Rule 6: layers | **met** | above; fan's translate3d = #20. |
| Rule 7: copy / read | **met** | #14. |
| Rule 8: cues | **met** | `sfx` PASS, 59 onsets. |
| Rule 9: hero | **met** | no hero in the last 7 frames (`$L/v3/kit-heroes.txt`). |
| Rule 10: footage | **met** | fan, wall grid, exploded take clips. |
| Rule 11: motion grammar | **met** | expo-out entrances, chip pops by layout ≤ 8–10 %, cut-ins fixed (#8). |
| Rule 12: speed | **not met (engine-wide)** | #16, for the lead. |
| Rule 13: no real brands | **met** | grep clean in all new/edited files. |

## Open after this pass
1. **N1** (Worker A): 9:16 exploded chips on their own anchors / leaders backwards / left-edge bleed. Also closes #10 and #18.
2. **#20 + the fan part of #7** (lead + Worker B): the fan headline's purity diff vs the layer QA FAIL with `transform: none`.
3. **#17** (lead): which floor 16:9 chips answer to.
4. **#16** (lead): SPEC rule 12 can't be met by footage or particle blocks.
5. N2, N3: LOW polish.

## Files
- Logs: `jobs/ver-A-logs/` (earlier attempt, same code: films, layers, clip, purity 16:9, anchors) and `jobs/ver-A-logs/v3/` (this pass): `grid-*.log`, `xchips.log`, `tilesame.log`, `probe-*.log`, `kit-heroes.txt`, `blocks.txt`, `old-grids.txt`, `contig-{9x16,1x1}.log` (+ diff maps in `contig916/`, `contig11/`), `oldrange-v3.txt`, `board-*.txt`.
- Stills: `jobs/ver-A-logs/stills/` and `jobs/ver-A-logs/v3/{edge916-stacks,fan916-diff-crop,sphere-head}.png`; boards `jobs/ver-A-kit/kit-dev-storyboard-{16x9,9x16,1x1}.png` (N1 shows on the 9:16 sheet, shots 11 and 12), `jobs/ver-A-edge/ver-a-edge-storyboard-*.png`.
- Tools: `jobs/ver-A-tools/` (`xchips.js`, `tilesame.js`, `chipcover.js`, `boarddiff.mjs`, `rangediff.mjs`, `chain3.sh`, `sheet.py`) and `jobs/mon-A-tools/`.
- Clean-up: my range frames and bgref folders are deleted; no frames/layers/textless/bgref folder is left under `jobs/ver-A-*`. Disk 51 GB free.
