# Merge report: motion kit rounds 1 + 2 + small items → `qa/motion-kit/stage` (2026-10-27)

**Bottom line.** The five worker copies are merged into `qa/motion-kit/stage/product-launch-sting`. Every lead decision is applied with its proof, except **d** (the `ui.js` purity fixes), which I measured and **reverted**: it moved every old phone / panel / browser hero by up to 238 code values.
- **Templates.** Both skeletons now use the kit, and all six films say **QA PASSED** on the final engine.
  - Both: `press` (send), `out: flood` and `from:`.
  - launch15 adds a `fan`; launch30 adds `fan`, `wall layout: grid` and a `carry`.
  - Every moving cut has a `cause:` line.
- **Old jobs.** `--grid` is identical on all 16 original jobs apart from new warning lines. dark-ui-check's full 16:9 film is byte-identical live vs stage, frames and bgref. Old storyboard heroes match too, apart from the known wall noise.
- **Shot-writer suites.** `SHOTS_QA_VIDEO=$S bash qa/shots-skill-port/run_all.sh` → **ALL SUITES PASS** (17 / 48 / 16 / 57 / 90 / 48). The live run gives the same check results as with the pre-merge test files.
- **The unflattering part.**
  - **Decision d is not in.** C-verify V7 (frame 956 after a dive) and the panel-tap raster effect stay open.
  - **Decision e changed an old job.** Its first version altered film-sample's "Orbit 2" opening on 9:16 / 1:1 (33 frames, max 165). I refined it, and now those frames are byte-identical.
  - **Template WARNs remain.** Both skeletons still WARN on block-level text: the end card's URL at 31 px and the orange `Output` / `After` tags at APCA Lc 54.

Nothing was committed or pushed, and no paid call or `--go` was run. I did not touch the live skill, `live-before/`, `base/` or the original jobs (`shasum -c` results are at the end). Every render ran alone, at `--workers` ≤ 2. `pmset -g therm` was checked before each one and never reported a warning.

Shorthands:
- `M = qa/motion-kit`
- `S = $M/stage/product-launch-sting/video`
- `L = ~/.claude/skills/product-launch-sting/video`

Logs are in `$M/merge/logs/`, stills in `$M/merge/stills/`, and tools in `$M/merge/` (`sheet.sh`, `cmpdirs.mjs`, `freshdraw.mjs`, `purity-stub/`).

---

## Step 1 · What I merged (PASS)

`$M/merge/worker-{A,B,C,D,S}.sha1` hold the shasum of every file under `video/` (node_modules excluded) in each worker copy. There are 105 / 104 / 104 / 104 / 107 files, and `base.sha1` covers the base. Before I started, `diff -rq -x node_modules base stage` reported no differences.

Each worker copy differs from base in exactly the files its report lists:

| Worker | Files changed |
|---|---|
| A | `_motion.js` (new), `press.js`, `fan.js`, `particles.js`, `map.js`, `stack.js`, `type.js`, `wall.js`, `index.js`, `spec.mjs` |
| B | `runtime.js`, `board.mjs`, `qa.mjs`, `render.mjs`, `timeline.mjs`, `lv.mjs` |
| C | `runtime.js`, `kit.js`, `float.js`, `stack.js`, `wall.js`, `fingerprint.mjs`, `spec.mjs`, `timeline.mjs` |
| D | `board.mjs`, `qa.mjs`, `render.mjs`, `sheet.html`, `sheet.mjs`, `lv.mjs` |
| S | `SHOTS.md`, `shots.py`, `phase2-band-shots.json` (new), `brief.md`, `launch15.yaml` (new), `launch30.yaml` (new) |

Every worker copy's newest file is older than its verify report (B's last edit 00:00 vs B-verify 00:54; C's before 15:00 vs C-verify 02:15), so the verify passes' last fixes came in with the copies: B's `purityRun` `workers`, D's V1 in `qa.mjs` and S's N2.

## Step 2 · The merge (PASS)

**Copied (one owner each):**
- A: `_motion.js`, `press.js`, `fan.js`, `particles.js`, `map.js`, `type.js`, `index.js`
- C: `float.js`, `kit.js`, `fingerprint.mjs`
- D: `sheet.html`, `sheet.mjs`
- S: all six of its files

**Three-way merges.** Each one ran `git merge-file <X> <base> <Y>`. The conflict counts match the trial: stack 2, wall 3, spec 1, runtime 1, timeline 1, render 1, and board / qa / lv 0.

| File | Conflict | Resolution (both behaviours kept) |
|---|---|---|
| `stack.js` | imports | Both: `import { M } from './_motion.js'` (A) and `import { originOf } from '../kit.js'` (C). |
| `stack.js` | the block header | A's mode-aware `doc` / `layers` / `copy` / `read` / `validate` / `cues` / `hero` / `required: []`, plus C's `origin: true` and C's `from:` param (worded "(default cycle mode)"). C's `born()` / t0 18 lives in `plan()`, which only the cycle mode calls; `buildExploded` returns before the cycle code, so exploded ignores `ctx.origin`. C's `--grid` warning "from: only works in stack's default mode" covers it. |
| `wall.js` | imports | Both, as in `stack.js`. |
| `wall.js` | `doc` / `layers` | A's text + C's `origin: true`. |
| `wall.js` | params / validate / cues / hero | A's (grid mode, `validate`) + C's `from:` param. The default-layout branch of `cues` / `hero` takes C's `CHIP0(s)` expressions, which equal the old 12 / 14 without `from:`. The grid branch keeps `GRID_LIT`, so the grid ignores `from:`, as C's warning says. |
| `spec.mjs` | ENUMS | C's float line (`from:` left out of ENUMS: left \| right \| a layer \| [x, y] are checked in `crossCut`) + A's type / stack / wall / press / particles enums. |
| `runtime.js` | the `LV` export | B's `hideText` + C's `crossCuts` line. |
| `timeline.mjs` | the return | B's `reading` + C's `...(signature)` spread. |
| `render.mjs` | the return | `return { log, pages, audits, fit, layers, probes, composited, cams, sigs, sigs2, anims }`. This is the known resolution plus B's `anims`, which B added in its fix pass after the trial. |

**Checks.**
- `node --check` passes on all 20 touched `.js` / `.mjs` files, and `py_compile` on `shots.py`.
- **Per-worker diff**, on the merge snapshot before the decisions (`git merge-file -p merged base X` + a line census): every worker's edits are contained in the stage. The lines that differ between a worker copy and the stage all come from another worker. The only exceptions are the hand-resolved lines in the table above: A's stack / wall `params` lines and C's `origin` comments, and the `render.mjs` / `timeline.mjs` returns. **No surprises.**
- Snapshot of the merge before any decision: `$M/merge/stage-after-merge/` (`stage-after-merge.sha1`).
- **Smoke test.** `--grid` on clones of kit-dev and r2-dev compiles with only the expected warnings (below).

## Step 3 · The lead's decisions

### a · Fan grows from a point (PASS)
- **`fan.js`.**
  - `origin: true` and a `from` param.
  - `born(s)` (as in stack / wall) delays the deal 4.5 frames when `from:` is set. The hero then leaves half a frame before the cut, C's convention.
  - In `render`, `const g = og && ctx.K.grow(og, rest, t, {t0: P.deal(k), len: 16, bank, w, h, lead: !tier})` overrides position, scale, opacity and bank while `g.k < 1`. Depth, rotateY and blur keep the deal's own easing, which runs in the same window.
- **Two refinements, only with `from:`**, after reading the cut frames. The hero takes the source's place, so it is born sharp and level: no deal blur, bank 0. The born-blurred, tilted version showed a visible softening on the cut (`stills/l15-16x9-fan-from.png` before, `-v2.png` after).
- **`spec.mjs`.** No change was needed for `from:` itself: `originOf` accepts it once the block says `origin: true`. The "from: does nothing on …" message now lists "float, stack, wall and fan", and the `kit.js` comment does too.
- **With `from:`.** launch15's `scale` fan grows out of the result card: the hero takes its size and place on the cut, then the tiers deal out (`stills/l15-16x9-fan-from-v2.png`). Six films QA PASSED (below).
- **Without `from:`.** kit-dev's fan, `--film --range 138,353` 16:9: **stage = a second stageA run, 216 / 216 frames byte-identical.**
  - Two stageA runs differ from each other on 211 / 216 frames: max 2, plus f138 at max 19 on 786 channels, A's known 3D-card raster noise. Stage against the first A run differs the same way.
  - Storyboard heroes, stage vs stageA: 15 / 15 identical on 16:9 and 1:1. On 9:16 the fan is max 2, A's known noise.

### b · `--init --kit launch15|launch30` + the `--blocks` line (PASS)
- `S-lvmjs-kit.patch` applied cleanly with `patch -p1`; the pre-patch copy is at `merge/lv.mjs.prekit`.
- **`--init --kit launch15 --title "Acme Notes"`** writes the title "Acme Notes 15 s launch" and slug `acme-notes`, sets `name` / `mono` and `text: Acme Notes` on the name cards and `url: acme-notes.app`, and copies 5 placeholders. `--grid` is clean.
- **launch30** copies 7 placeholders. `--grid` gives one honest warning: a two-word product name makes the 3-beat `again` card need 1.6 s.
- `--kit launch20` → rc 2 with the new message.
- **`--blocks`.** "Common to every shot" now adds:
  - `carry {el, to, ease (smooth|needle), pre, post, lift, arc, mode (carry|morph), color}`
  - `dive {el | at [x,y], zoom, from} (with out: dive)`
  - `flood {from (layer | [x,y]), spot [x,y], color} (with out: flood)`
  - `from (layer of the previous shot | [x,y]: cards grow out of it on float, stack, wall, fan)`
  - `cause`
  - top level: `signature`, `delivery (web|feed|tv)`

  The wording is from C-build-r2 and B-build-r1.

### c · Shot-writer tests (PASS)
- **P8.** `qa/shots-skill-port/test_parity.py` applies `apply_phase2_brief.py` after `apply_pointers.py` when the copy's `brief.md` has the phase-2 passport. It then expects 11 + 2 APPLIED and 5 / 5 docs rebuilt, and P8b expects 11 + 2 SKIP. The live brief has no passport, so live runs P8 exactly as before.
- **P4 / P4b honour `SHOTS_QA_VIDEO`.**
  - `STAGED` = V isn't the live skill.
  - P4 allows the engine files listed in the new `qa/shots-skill-port/engine-allow.txt` (21 paths: the merge's engine changes, each a worker's or a decision's).
  - P4b maps `pre.sha1`'s live paths onto V and ignores the allowed files.
  - Live (no env var) takes exactly the old code path.
- **Rollback copies** of all three test files are in `merge/shots-port-rollback/`.
- **Runs:** 

  | Run | Result |
  |---|---|
  | Stage (`SHOTS_QA_VIDEO=$S`), final | **ALL SUITES PASS**: QA 1 parity 17 / 17 (P4 "apart from the 21 staged engine changes", P4b, P8 "11 + 2 applied", P8b "11 SKIP + 2 SKIP", P9, P9b), QA 2 48 / 48, 2b 16 / 16, 3 57 / 57, 4 90 / 90, QA 5 48 / 48 (incl. the new Q2k, and Q9 / Q9b on the new skeletons: 8 shots / 12 words, 15 shots / 31 words, no warnings). Logs: `merge/logs/suites-stage2.log` + `suites-stage2-out/`. |
  | Live, patched test files | Parity 17 / 17, 48, 16, 57, 90, then `test_phase2.py` stops on FileNotFoundError (the live skill has no phase-2 example) → SOME SUITES FAILED. `merge/logs/suites-live.log` + `suites-live-out/`. |
  | Live, pre-merge test files (a temporary sibling copy of the suite, deleted after) | **The same**: 17 / 48 / 16 / 57 / 90, then the same FileNotFoundError. Every check has the same PASS / FAIL; the only text difference is P8's label ("all 5 live docs" → "all 5 docs"). `merge/logs/suites-live-orig.log` + `suites-live-orig-out/`. The live failure predates this merge: S added `test_phase2.py` to `run_all.sh`. |

  - **My own slip, fixed.** The first stage run failed P4 (16 / 17): my allow-list check mishandled P4's relative path for `lv.mjs`. I fixed it in one line (`rel()`) and re-ran the whole suite.

### d · `ui.js` purity fixes (MEASURED → REVERTED)
- **Both fixes in.** Old heroes, live vs stage on clones: film-sample and reel-sample are unchanged (no `ui.js`). **Every phone / panel / browser hero moved:**

  | Hero | Max change |
  |---|---|
  | steady-sample `s3` 16:9 / 9:16 | 238 / 171 (12.7 k / 26.4 k channels > 2) |
  | dark-ui-check `p` / `r` | 238 / 238 |
  | edge-test `c` | 239 |
  | r2-dev `plan` vs stageC | 238 |

  The cause is the item entrance's `rotate(.001deg)`, which is always on. It re-rasterises the UI text a sub-pixel off: invisible by eye (`stills/steady-s3-live-vs-d.png`), but far more than "a few code values", so by the rule **d goes**.
- **Tap-target half only.** I also tried it alone: resting at `none` instead of `scale(1)`.
  - The heroes are byte-identical with live (steady 7 / 7, dark-ui-check 3 / 3, edge-test 7 / 7).
  - dark-ui-check's full film changes 28 frames, 82–109 (the Approve tap window, max 238).
  - **Those frames do not equal a fresh-page draw.** I drew 82 / 90 / 96 / 100 / 105 / 109 alone on fresh pages (`merge/freshdraw.mjs`). Stage: max 225–238 vs its film. Live: max 225–238 vs its film. The phone's text keeps its own raster history (B's frame-208 effect), so the half-fix buys no proven purity on old jobs and only breaks byte-identity.
- **Reverted:** `ui.js` = base (cmp-equal). Kept for the lead: `merge/ui.js.d-full` (both fixes) and `merge/ui.js.d-tap-only`.
- **Final engine.** dark-ui-check's full 16:9 film: **630 / 630 frames and 630 / 630 bgref byte-identical** with live. The PASS / FAIL lines are identical (QA PASSED, 12 checks), and the only additions are B's / D's WARN / INFO lines. Heroes of steady (7 / 7), dark-ui-check (3 / 3) and edge-test (7 / 7) are byte-identical.

### e · Type opening tracking keeps a one-line head on one line (PASS)
- **Version 1** (as written in S-verify N1: `head.offsetHeight <= hh * 1.2` at the widest tracking `ls1`) **broke rule 1.** film-sample's "Orbit 2" wraps at `ls1`, but the film never shows `ls1`: at t 0 the tracking is already 52 % closed. So v1 narrowed its opening on 9:16 and 1:1, with 33 frames different (145–177, max 165).
- **Version 2 (shipped).** The one-line test runs at the tracking of the first frame the shot shows, `lerp(ls1, ls0, outExpo(u01(0, −2, 17)))`, which is the widest the viewer can see. A head that is two lines in its final layout is untouched.
- **Old jobs.** film-sample is the only original job with `type` text shots. `--film --range 145,180` and `2119,2154` live vs stage, every aspect: 16:9 72 / 72 and, after v2, 9:16 72 / 72 and 1:1 72 / 72 byte-identical. The 2119 range (a two-line head, which the test skips) and 16:9 were already identical under v1, and v2 only ever changes a subset of what v1 changes: a head that wraps at the first frame's tracking also wraps at the wider `ls1`. Storyboard heroes on the final engine match too.
- **launch15's CTA.**
  - Before (stage + the pre-e `type.js`, `--range 660,680`): "Try it / free." sits on two lines for frames 660–664, then jumps to one line, on 9:16 and 1:1 (`stills/l15-{9x16,1x1}-cta-open-pre-e.png`).
  - After: one line from the first frame (`…-cta-open-e2.png`).
  - The final films re-ran QA (below).

### f · Shot writer N4 + launch30 N3 (PASS)
- **N4.**
  - **Rule.** `shots.py` `VERDICT` accepts "the frame / the clip … is wrong" as a whole verdict only after a comma (`, the frame is wrong`); shot / take / it are as before.
  - **Behaviour.** "if the light in the frame is wrong" now becomes "If the light in the frame is wrong, the shot is wrong.", while "If she stops, the frame is wrong." is kept as written. The old outputs are unchanged on the other 9 probe forms.
  - **Test.** New check `Q2k` in `test_phase2.py`.
- **N3.** The "120 films studied" claim left the stack's UI pill. It is now the headline on the `many` shot's band (`wall layout: grid`, must-read, not `.lv-ui`), with `# your claim, as approved by legal` on it.
- **Suites:** see c.

### g · The skeletons use the kit (PASS)
Both stay asset-free, at 120 BPM and within SPEC-S §3. `--grid`: launch15 12 words, launch30 31 words (cap), no warnings.

**launch15: 8 shots, 30 beats, 0:15**

| Time | Shot | What it is now |
|---|---|---|
| 0–1 | hook | `media`, as before (see the note) |
| 1–3 | name | `type`, dark, zoom-through: the signature |
| 3–6 | ask | **`press control: send`** with the prompt, the press `at: 75` = 5.5 s on a beat, **`out: flood` from the send button**, `cause: the cursor presses send` |
| 6–8 | result | `float`, **dark** (the flood pours its colour), **`from: control`**: the card grows out of the pressed bar on the drop and bar line |
| 8–9.5 | scale | **`fan` `from: card`**: the result card splits into the fan |
| 9.5–11 | proof | `stat` |
| 11–13 | cta | `type` |
| 13–15 | end | `endcard` |

- **Click → press.** The press needs ≥ 1.5 s and ≥ 35 frames before the press (A's travel check), and the flood starts 14 frames before the cut. A separate 1-s click shot can't hold that, and at 30 beats the tail after the result (fan 3 + proof 3 + CTA 4 + end card 4 beats) leaves 6 s for everything before it. So the prompt and the click share one press shot, 3–6 s. The prompt is on screen from 3 s (the product by 3 s), the click lands on a beat at 5.5 s, and the result lands on the 6 s bar line with the drop. Everything after the result moved 0.5 s earlier.

**launch30: 15 shots, 60 beats, 0:30**
- **action:** **`press send`**, the press on the 8 s bar line, `out: flood`, with a cause.
- **result:** dark, `from: control`, then a **`carry: {el: card, to: after}`** into the split's Output half under its drift-left, with a cause. inout's `after` is now the same card picture.
- **one:** **`fan`** (3 beats, no headline).
- **many:** **`wall layout: grid`** (4 beats) with the claim on its band.
- **The rest** is as S built it.

**Not switched.**
- **The `particles` hooks.** The block warns under 1.5 s and the hook target is 0–1 s, so both hooks stay `media`, with a comment pointing to particles for a longer hook.
- **A CTA → end-card carry in launch15.** I tried it (the endcard's `cta` layer; it needs `post: 20`, since the button fades in at 14–28) and dropped it. The button's text is 29 px on 16:9, under the 47 px web floor, so the big CTA would land in an unreadable pill.

**Also changed.**
- `brief.md`'s Transitions row now reads "the starters: hard cuts and drifts, a flood out of the pressed button, a carry, and a zoom-through as the signature".
- The trigger map's "until round 2 lands, use `note:`" now reads "shot A's `cause:` … the storyboard prints it".
- Both edits are mirrored in `qa/shots-skill-port/apply_phase2_brief.py`, so Q8 / P8 rebuild it exactly (`p8_patched.py` → PASS 11 + 2, 5 / 5).

**QA on the final engine** (`--film --aspect <a> --workers 2`, one at a time):

| Film | 16:9 | 9:16 | 1:1 |
|---|---|---|---|
| launch15 | **QA PASSED (17)**, 174 s | **QA PASSED (17)**, 162 s | **QA PASSED (17)**, 130 s |
| launch30 | **QA PASSED (20)**, 335 s | **QA PASSED (20)**, 324 s | **QA PASSED (20)**, 245 s |

Cut and continuity lines:
- **launch15.** `INFO cut ask→result at 360 … (8.61× / 6.07× / 8.76×) — soft cut by design (flood)`. Continuity: 7 cuts, all hold. Purity: 24 shuffled frames match (max Δ 1–2), 1 seam matches.
- **launch30.** `soft cut by design (flood)` at 510. The carry result→inout is a moving cut at 660 (10.4–13.7×). Continuity: "14 cuts, 4 with camera motion + 1 carried object … all hold; speed ratios 1.0–2.0×".

**WARN lines read.** None is caused by the templates' edits.
- **End card.** `product.app` is 31 px, at 3.7–7.0:1 / Lc 51–64 (the endcard block's muted URL; "endcard colour contrast" is in Deferred).
- **Float / split tags.** The orange `OUTPUT` / `INPUT` / `BEFORE` / `AFTER` tags are 31–36 px caps: black on orange, WCAG 7.5:1 but APCA Lc 54, and under B's 9:16 / 1:1 caps floor. They are block styling (S-verify M8 already listed their sizes for the lead).
- **Purity INFO.** It names `change` f822 (the split wipe) as raster history, reproduced in order.

**By eye** (`stills/l15-16x9-film.png`, `l15-16x9-flood-v2.png`, `l15-16x9-fan-from-v2.png`, `l15-9x16-film.png`, `l30-16x9-carry.png`, `l30-16x9-fan-wall.png`, `l30-9x16-film.png`):
- **The flood** pours from the send button with its iridescent front and covers the frame on the cut. The result card is already there on the cut frame, at the bar's place, then settles. No empty frame.
- **The carry** moves the result card into the Output half while the brackets stay behind, and lands exactly.
- **The wall grid** opens ~60 % built and lights the card, with the claim on its band.
- **Weak spots.** The 9:16 fan's portrait hero crops the landscape placeholder's text ("OUR SCREEN"); real 9:16 clips won't. On 1:1, launch15's CTA opens with ~2 % margins.

### h · Soft cuts by design are INFO (PASS)
- **`qa.mjs` `softCut(A, B)`.**
  - **What counts:** `out: flood`; a carry / morph with `to: frame`; a carry or morph onto the same plain background. That is C's own "flat" test: no `bg`, not cta / scene, same theme.
  - **What QA prints:** `INFO cut … — soft cut by design (<device>), boundary proven by the shot log`.
  - **`--grid`.** Its two C warnings no longer promise a FAIL ("QA reports it as a soft cut by design, INFO").
- **Probe** `jobs/mrg-h-probe` (prompt carry → prompt on the same light background, then a morph `to: frame` → endcard, both `out: cut`), with the same frames:

  | Tool | `--qa` result |
  |---|---|
  | Pre-h tool (scratch copy, old `qa.mjs`) | `FAIL cut a→b … (1.02×)`, `FAIL cut b→c … (1.23×)`, **QA FAILED (2)** |
  | Stage | `INFO … soft cut by design (carry onto the same light background)` / `(morph to: frame)`, **QA PASSED (10)** |

- The template floods print `soft cut by design (flood)`.
- **Old jobs unchanged.** `softCut` is null on all 134 cuts of the 15 compiling old jobs, so they take the old branch, whose text is unchanged. dark-ui-check's full film gives identical PASS / FAIL lines live vs stage.

### i · Purity re-renders before warning (PASS)
- **`purityRun`.** Every replay or seam frame that differs from the film is drawn **once more** on a fresh page with the same predecessors: the same group, the same first frame and the same warm-up. One that then matches is marked `oneOff`, its replay counts as reproduced, and a seam is no longer a glitch.
- **`qaFilm`.** It prints `INFO purity N frame(s) … differed once and matched when drawn again … a one-off raster glitch in the check's own render`. Only a repeatable difference WARNs.
- **Cost.** Nothing extra when nothing differs; all six template films ran it.
- **Proof both ways**, with a stub renderer and no Chrome: `merge/purity-stub/stub.mjs`, on launch15's timeline, with a planted bottom band.

  | Case | What the stub does | Result |
  |---|---|---|
  | **One-off** | the replay and the seam glitch once, the re-render is clean | `replay oneOff:true`, `seam oneOff:true` → **0 WARN lines**, 2 INFO one-off |
  | **Repeatable** | the re-render glitches too | `lag 1`, `seam 1` → **the two WARNs** |

### j · Accepted as built (recorded, no change)
- C's `fingerprint.mjs`: `cause` not pixels, cross-cut links, `linksPrev` only for blocks that read `from:`.
- D's speed-ratio limits (3× built-in, 2× after a dive and for carries) and hand-tuned drift → INFO.
- `sheet.html` as D's file.
- C's continuous-box morph timing.
- The fan headline's `translate3d(0,0,0)`.
- Particles as SVG.
- 16:9 fan chips at 34 px.

### k · Deferred for Alex (not done)
- B's snap-worker-seams-to-cuts: it changes old frames.
- Endcard / steady muted-grey colour contrast. The same family covers the orange tag APCA and the 31 px URL the templates WARN on.
- The wall's run-to-run raster noise (max 2–3 again here, on film-sample `10-wall` and r2-dev `07-wall`).
- The spec's two-box ±18 % morph alternative.
- Faster particles.
- **Added by this pass:** decision d (see above). The two `ui.js` variants are kept, with the measurements, for a deliberate re-baseline of old jobs if Alex wants purity over byte-identity.

### l · `cause:` under the storyboard frame (PASS, already built)
D's `board.mjs` prints it, in violet and labelled **cause**. It is visible on the merged storyboards (`jobs/mrg-launch15/launch-15-storyboard-16x9.png`, ask: "cause the cursor presses send") alongside B's floor notes, so both board edits survive. No change was needed.

## Step 4 · Sanity (PASS)
- **`--grid`, all 16 original jobs** with a beats.yaml, as clones: `jobs/mrg-old-<name>` for the stage tool and `mrg-old-<name>-live` for the live tool. Outputs are in `merge/grids/`, the summary in `merge/grids-summary.txt`.
  - Every non-warning line (the shot table, frames, BPM, cue counts, errors) is **identical**.
  - Each `timeline.json` differs only in the top-level `delivery` (the lead's base), `reading` (B) and `warns`; shots and cuts are identical.

  New warning lines per job (reading = B's new formula, types / cause = C's lint):

  | Job | Live → stage warnings | New lines |
  |---|---|---|
  | cue-overlays, dark-ui-check, qa-probe, shots-demo | 0 → 0 | none (shots-demo exits 2 in both: no shots) |
  | cue | 0 → 5 | reading 3, transition types 1, no cause 1 |
  | edge-test | 2 → 6 | reading 3 (one replaces the old ≈4 words/s line), types 1, cause 1 |
  | film-kit-dev | 0 → 3 | reading 1, types 1, cause 1 |
  | film-sample | 0 → 8 | reading 6, types 1, cause 1 |
  | hf02-skill | 4 → 4 | the 4 reading lines reworded (new formula) |
  | layers-probe | 1 → 3 | reading 2 (one reworded), cause 1 |
  | manus2-film | 9 → 15 | reading 14 (9 reworded), cause 1 |
  | manus2-space | 0 → 17 | reading 16, cause 1 |
  | qa-probe2 | 0 → 1 | cause 1 |
  | reel-dev | 0 → 8 | reading 7, cause 1 |
  | reel-sample | 0 → 8 | reading 7, cause 1 |
  | steady-sample | 0 → 5 | reading 4, cause 1 |

- **Storyboards** `--aspect all` on clones `jobs/mrg-kit-dev` and `jobs/mrg-r2-dev`: no errors in any aspect. The only notes are expected: the fan's 1:1 bleed note, the reading-time / cause / transition-types warnings and B's floor notes.
  - kit-dev heroes vs a stageA render of the same clone: 15 / 15 identical on 16:9 and 1:1; on 9:16 only the fan differs, max 2 (A's raster noise).
  - r2-dev heroes vs a stageC render: 9 / 10 identical in each aspect; the other is `07-wall`, max 1–2 (the known wall noise).
  - I read the sheets. kit-dev: all 15 new looks are composed and none is empty. r2-dev 9:16 shows each cause line under its frame. The exploded 9:16 chip defect (A-verify N1) is still there: see open items.
- **Old-job heroes, live vs stage, final engine:** film-sample 11 / 12 per aspect (only `10-wall`, max 2–3), steady-sample 7 / 7 ×2, reel-sample 8 / 8 ×3, dark-ui-check 3 / 3, edge-test 7 / 7. The composite `storyboard.png` sheets differ by design: B's floor notes and D's cause line.

## Could not resolve / still open
- **A-verify N1 (MEDIUM, Worker A).** 9:16 `stack mode: exploded` chips sit on their own anchors, and the leaders run backwards. It was not fixed in stageA and is not in my decisions, so it is merged as built. It also closes #10 / #18 when fixed.
- **C-verify, open.**
  - V1: the wall `from:` lead card can be another picture.
  - V2: the point dive arrives on an empty panel.
  - V3: the caret under the flood mask.
  - V5: the same-colour morph fill fades in by opacity.
  - V7: `ui.js` 956 after a dive. It is exactly the reverted half of d.
- **B-verify N1.** The flash check counts motion as flashing (hf02 1:1).
- **B #11.** Reading-time volume: the new formula warns on most old jobs (table above).
- **The P4 allow-list.** `engine-allow.txt` must be emptied (and the backup re-fingerprinted) when the kit ships live.

## Files
- **Merged copy:** `qa/motion-kit/stage/product-launch-sting` (final manifest `merge/stage-final.sha1`).
- **Pre-decision snapshots:** `merge/stage-after-merge/`, `merge/*.pre-*`.
- **Shot-writer suite edits:** `qa/shots-skill-port/test_parity.py`, `test_phase2.py`, `apply_phase2_brief.py`, `engine-allow.txt` (rollback in `merge/shots-port-rollback/`).
- **Jobs:** `jobs/mrg-*`. Frames of measured jobs are deleted; mp4s, `qa.json`, boards and logs are kept.

## Hygiene
| Check | Result |
|---|---|
| Live skill | `shasum -c live-before.sha1`: 867 OK, 0 failed (after all runs) |
| `live-before/` | 0 not OK |
| `base/` | `stage-r1-base.sha1` 871 OK, `merge/base.sha1` 0 not OK |
| Original jobs | 0 files under `~/Downloads/launch-videos` newer than the start of this pass. They were read and cloned with `cp -c`, never run with `--job`. |
| Stage | Unchanged by the test suites (`merge/stage-final.sha1`, 120 files, 0 not OK after the last run). It differs from base in exactly the files listed in step 1, plus decision e (`type.js`), h / i (`qa.mjs`, `timeline.mjs` wording), b (`lv.mjs`), f (`shots.py`), g (`brief.md`, `launch15.yaml`, `launch30.yaml`) and a (`fan.js`, `spec.mjs`, the `kit.js` comment). `ui.js` = base. |
| Outside the skill | I edited only `qa/shots-skill-port/{test_parity.py, test_phase2.py, apply_phase2_brief.py}` and added `engine-allow.txt`; rollbacks are in `merge/shots-port-rollback/`. The temporary suite copy `qa/shots-skill-port-orig-mrg/` was deleted after its run, with its logs kept in `merge/logs/`. Scratch engines (stage + the pre-e `type.js`; stage + the pre-h `qa.mjs`) are in this session's scratchpad. |
| Disk | 47 GB free at the end. I deleted the frames, bgref, textless and purity folders of my own `mrg-*` jobs after measuring them; mp4s, `qa.json`, boards and logs are kept. |
| Heat | `pmset -g therm` never recorded a warning. Renders ran one at a time at `--workers` ≤ 2. |

## m · Flash check: net share (Alex 10-27) (PASS)

- **The rule.** In `video/lib/qa.mjs` `flashCheck`, a leg now counts when its **net** share reaches 25 %: pixels changing ≥ 0.1 its way minus pixels changing ≥ 0.1 the other way. The check is still WARN only.
- **Strobes still caught.** B's synthetic table is reproduced exactly: 3 Hz quiet; 3.5, 4 and 10 Hz WARN; 300 px WARN; 220 and 200 px quiet. The planted probes' QA lines are identical before and after. The new `jobs/fl-strobe-motion` (a 4 Hz full-frame strobe under a sweeping, whipping or scrolling card) WARNs at 4 in all 25 windows, and its motion-only control went from WARN 3.5 to quiet.
- **Motion no longer counted.**
  - hf02-skill 1:1: `WARN 4.80–6.48 s (4 flashes)` → `INFO at most 1 flash`.
  - film-sample `scan`, per aspect (16:9 / 9:16 / 1:1): 3 / 2 / WARN 4.
  - film-sample 16:9, steady-sample 16:9 and hf02 1:1, all full films, before vs after on the same frames: only the flash line changed, and PASS/FAIL counts are unchanged.
- **This closes B-verify N1.** `qa.mjs` is now `1f78b9e8…` and no longer matches `merge/stage-final.sha1`. Two open points for Alex: the 1:1 `scan` WARN is real card-swap luminance, and net misses flashes going opposite ways in the same window. Details are in `reports/flash.md`.
