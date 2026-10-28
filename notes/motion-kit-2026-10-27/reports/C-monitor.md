# Monitor report: Worker C, round 2 engine transitions (2026-10-26, overnight)

I checked Worker C's build adversarially. I re-ran every claim myself and did not take the report's word for anything.
- **Staging copy under review:** `qa/motion-kit/stageC/product-launch-sting` (`$S` = its `video/`)
- **Baseline:** `qa/motion-kit/base/product-launch-sting`
- **Live engine:** `~/.claude/skills/product-launch-sting`. It was only run on clones and never edited.
- **Where my work lives:** every test job, tool, log and still is under `qa/motion-kit/jobs/mon-C-*`. I did not edit Worker C's source, the live skill or any original job. No commits and no paid calls.

Shorthands used in the repro commands:
```
S=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit/stageC/product-launch-sting/video
J=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit/jobs
T=$J/mon-C-tools        # my tools: strip.mjs, sheet.sh, purity.mjs, order.mjs, timing.mjs, xcuts.mjs, fdiff.py, where.py, pair.py
```

## Verdict

**The engine work is real and mostly solid:**
- All three aspects pass QA.
- Frames are deterministic for a given render.
- Old jobs are unchanged.
- The bad-input messages are good.

**Three things block a "done" sign-off:**
1. **The flood paints hard-edged "redaction bars" over the text.**
2. **A carry between two elements that look different shows a visible double at landing.** The spec's own flagship example (prompt-box → panel over `whip-left`) does this, and C never tested it.
3. **The purity proof missed a whole shot.** Frames after a carry lands depend on the page's render history: up to 92 k channels differ, max |Δ| 255. The report's "purity proven" is wrong for those frames.

**Counts:** 3 HIGH, 6 MEDIUM, 10 LOW.

## What I verified (claims that held)

| Claim | My check | Result |
|---|---|---|
| r2-dev 16x9 `QA PASSED` | Fresh clone `jobs/mon-C-dev` (beats + assets only), `node $S/lv.mjs --job $J/mon-C-dev --film --aspect 16x9 --workers 2` | **QA PASSED (16 checks)**, the same numbers as C. All 1277/1277 frames are byte-identical to C's film. |
| 9x16 / 1x1 `QA PASSED` | `--qa --aspect 9x16` and `--qa --aspect 1x1` on a cp-c clone of C's outputs (`jobs/mon-C-dev2`). `fresh` passes. | **QA PASSED** for both (content min 97 / 17 px) |
| Old jobs unchanged at `--grid` | Live engine vs stage C `--grid` on clones of all 16 original jobs (`jobs/mon-C-old/*`, log `mon-C-logs/old-grid-diff.log`) | Exit codes are identical. No new errors. The only change is the new lint lines (see finding 15). |
| Old-field renders are byte-identical | Planted old-style job `jobs/mon-C-old-ovl-{stage,live}`: every overlay cross-cut (smear, tunnel, flash, glitch), drift, whip, zoom, blur, letterbox, bg footage, float `from: right`, stack, wall, media `from:`. No original job uses overlay cuts, so C's own test never reached that path. | Storyboard heroes: 21/24 byte-identical. The 3 that differ are the wall shot, max |Δ| 3, which is the known wall raster noise. `--film --range 70,470`: 400/401 frames byte-identical, the last one max |Δ| 2 (details at the end). |
| Bad input fails `--grid` with one clear line | 17 planted jobs `jobs/mon-C-bad/*` (`mon-C-logs/bad-grid.log`) | Good messages for: carry as a string, missing `el`, `to: frame` without morph, `mode: Morph`, pre/post out of range, pre longer than the shot, carry chain too tight, dive `el` + `at` together, `at` malformed, zoom/from out of range, flood bad colour/key/`from`, `cause` not text, `from` out of range. **Exceptions are findings 4 and 16.** |
| Clean exports have no carry | `--layers post --aspect 16x9` | PASS 7/7, with streak/card/brackets/label layers |
| `--layers --with-transitions` (C left it untested) | `--layers post --aspect 16x9 --with-transitions` | PASS 7/7. The `carry` layer is exported and the card is hidden only while it is carried. |
| Continuity numbers / `cam.carry` for Worker D | `cams.json` from my strips (`jobs/mon-C-strips/9x16/cams.json`) | **Dive:** A's last ln-step +0.232, B's first +0.189 (0.82×). B grows from 0.30 and never shrinks. **Needle:** the size step on the cut is +12 px against +3 / +4 px for its neighbours. **Morph:** the relative height speed matches on both sides. `cam.carry` is present on every carry frame. |
| Speed | `node $T/timing.mjs $S $J/mon-C-dev 16x9`, contiguous frames cut−28…cut+36 | Seek is 1–25 ms on every transition frame. The PNG screenshot dominates: 82–87 ms on plain shots, 190–520 ms on footage shots, the same as calm footage frames. No performance finding. |
| Pivot/origin the same in film and QA-reference builds | `node $T/xcuts.mjs $S $J/mon-C-dev 16x9` (normal, bgOnly at dpr .25, clean) | Identical dive pivots and flood origins. Clean builds have none. |
| Dev job covers every device in 3 aspects | Read `cut*-{16x9,9x16,1x1}.jpg` (30-fps frames −14…+18 around all 9 cuts) | Yes. The judgement on each cut is in the findings below. |

## Findings

### 1. HIGH: the flood's "text protection" paints hard-edged redaction bars over the text

**File:** `stageC/.../video/engine/runtime.js:958-970` (`floodHTML`, the loop over `.lv-txt`).

**What happens:**
- When the front reaches A's dark text, a **rectangle** of the flood colour fades in over each text box, including the headline, the prompt text and the "Agent" chip.
- The rectangle has rounded corners, a short box-shadow and opacity 0→1 within 2 frames.
- It ignores the circular front. The corners stick out past the soft circle onto the still-light frame, and for 1–2 frames they are grey and half-transparent with the text showing through.
- It reads as a censor bar. All three aspects show it: 16x9 frames 125–133, 9x16 and 1x1 the same frames.

**Look:**
- `jobs/mon-C-strips/flood-9x16-125-129.png`
- `jobs/mon-C-strips/16x9/cut0-16x9.jpg` (frame 4 of row 1)
- `jobs/mon-C-strips/1x1/cut0-ask-scan-1x1.jpg` (frames 3–5 of row 1)

**Repro:**
```
node $T/strip.mjs $S $J/mon-C-dev 9x16 $J/mon-C-strips/9x16 -28,-24,-20,-16,-12,-8 0
# open $J/mon-C-strips/9x16/c0/00125.png and 00129.png
```

**Fix:** never draw a rectangle. Do what the spec suggested and mask the text with the flood's own shape.
- **Option A:** draw, per covered text element, a second copy of circle 0's radial gradient with a hard core (feather about 0.15 × `fe`). Clip it to the text box with `clip-path: inset(...)`. Its edge is then the circle's arc, not a box.
- **Option B:** set the text element's own `mask-image: radial-gradient(circle at O, transparent Rv−δ, #000 Rv)` in stage coordinates, translated to the element. The text then disappears exactly where the front is.

Either way the bar can't extend past the front. Re-check frames 121–137 in all three aspects.

### 2. HIGH: a carry between two different-looking elements lands as a visible double

**Files:** `runtime.js:784` (`c.hand`), `runtime.js:828-835` (the non-morph branch: a uniform-scale clone, `placed()` with `k = sqrt(area ratio)`).

**What happens:**
- The clone keeps A's shape and content. It is scaled uniformly so its area matches B's box.
- When A's and B's elements differ (`lookKey`), it crossfades over the real B element for 4 frames.
- With the spec's own example (`block: prompt, out: whip-left, carry: {el: prompt-box, to: panel}`), two boxes of different widths overlap. "Plan the Friday launch" sits on top of "Plan ready", for two different-sized cards.
- C's dev job only carries identical cards (float card → float card), so this was never seen.

**Look:**
- `jobs/mon-C-strips/whip-16x9/whip-landing-178-182.png`
- `jobs/mon-C-strips/whip-16x9/cut0-s1-s2-16x9.jpg` (last row)

**Repro:**
```
node $T/strip.mjs $S $J/mon-C-whip 16x9 $J/mon-C-strips/whip-16x9 -28,-24,-20,-16,-12,-8,-6,-4,-2,-1,0,1,2,4,6,8,10,12,16,20,24,28,32,36 0
# frames c0/00178.png, c0/00182.png
```
(The film of that job passes QA: `node $S/lv.mjs --job $J/mon-C-whip --film --aspect 16x9 --workers 2`.)

**Fix:**
- When `lookKey` differs, land the clone on B's **box**, not B's area: interpolate width and height separately over the last ~40 % of the path.
- Crossfade the contents mid-flight, at a blur peak, as the morph does. Do not crossfade on the landing frame.
- Or treat a carry between boxes whose aspect ratio differs by more than 15 % as `mode: morph` automatically, and warn at `--grid`.
- Add this case (prompt-box → panel over a whip) to the dev job.

### 3. HIGH: purity fails for the shot that receives a carry; C's proof never sampled those frames

**Files:** `runtime.js:822-876` (`carryAt`: B's `to` element is hidden until landing, then shown) and `engine/blocks/float.js:50` (the `landed` path: no entrance).

**What happens:**
- I re-rendered 153 frames inside every transition window in two different seeded shuffles, each on one fresh page.
- The two shuffles agree with each other: identical diff counts.
- **Both disagree with the film for every `again` frame after the needle carry lands.**

| Frames | max |Δ| | Channels with |Δ| > 2 |
|---|---|---|
| 695–783 (`again`, after the landing) | 249–255 | 86 k – 92 k |
| 956 (`plan`, dive entrance) | 238 | 9.5 k |
| 444–464 (teaser) | ≤ 9 | ≤ 541 |
| wall | ≤ 3 | — |

**Bisection: it is page history, not engine state.** For the same frame 767:

| Rendered on one fresh page | Result vs the film |
|---|---|
| 767 alone | 62 458 px > 2, max 254 |
| frames 660–670, then 767 | 62 458 px > 2, max 254 |
| frames **680–690** (the landing, cut+6), then 767 | matches: 28 px of label-tag noise |
| contiguous 639–800, as the film page drew it | byte-identical |
| contiguous vs sparse in a copy **without** the needle carry (`jobs/mon-C-nocarry`) | ≤ 272 px, max 16 |

So the carry makes B's card keep whatever raster state it had on the first frame it was drawn after landing.

**What I ruled out.** In a scratch copy of the engine (`jobs/mon-C-fixtest`) I swapped the hide rule `visibility:hidden` for `opacity:0`, and then for `clip-path: inset(50%)`. Neither changed anything, so the hiding mechanism is not the cause. My best guess is that Chrome keeps the raster scale of the card layer from its first visible draw while the camera then scales it slowly (1.11 → 1.16).

**Why it matters:**
- Worker B/D's purity WARN (tolerance max 2 / 0.01 %) will fire on every film with a carry.
- `--film --range` re-renders of such a shot will not match.
- A worker page seam inside a receiving shot shows a texture tick. A fresh-page frame 732 next to film frame 731 nearly doubles the frame-to-frame change: mean 0.26 → 0.46, px > 8: 8 k → 13.5 k.
- C's report says "purity proven" because its tool (`runs/C/tools/purity.mjs`) only samples carry windows (`cut−pre … cut+post+4`), never the rest of the receiving shot.

**Repro:**
```
node $T/purity.mjs $S $J/mon-C-dev 16x9 $J/mon-C-purity/16x9-s7 7 $J/mon-C-dev/out/main/16x9/frames   # 120/153 identical
node $T/order.mjs  $S $J/mon-C-dev 16x9 $J/mon-C-purity/from680 680-690,767   # 767 matches the film
node $T/order.mjs  $S $J/mon-C-dev 16x9 $J/mon-C-purity/from660 660-670,767   # 767 differs (max 254)
/usr/bin/python3 -I $T/where.py $J/mon-C-dev/out/main/16x9/frames/00767.png $J/mon-C-purity/from660/00767.png
```

**Fix:**
1. Diagnose with DevTools LayerTree (see the compositing-traps memory note): compare the card layer's raster scale at frame 767 in both histories.
2. Make the receiving element's raster independent of history. Candidates:
   - draw a carried-in float without its own compositing triggers (2-D transform only, no `will-change`);
   - or force a re-raster on every frame of a shot that received a carry, for example by toggling a no-op `translateZ(0)` ↔ `none` deterministically by frame parity. That trick is pure only if it is verified.
3. Extend the purity proof to every frame of a receiving shot, and to 1x1 / 9x16.
4. Until fixed, say this plainly in the report and the GUIDE.

### 4. MEDIUM: regression, a typo in float's `from:` is no longer an error

**Files:** `lib/spec.mjs:38` (`from` removed from float's ENUMS), `lib/spec.mjs:383-386` (any lower-case string now validates as a layer name), `lib/timeline.mjs:173-176`.

**Before, in base/live,** `from: rigth` failed `--grid` with `float from must be one of left, right (got "rigth")`. **Now:**
- On a later shot it is only a warning, followed by a stage-build failure that never mentions left/right: `s2 from: "rigth" — shot s1 (headline) has no layer of that name`.
- **On the first shot it renders silently.** It prints a misleading `from: does nothing on the first shot`, and the card flies in from the left.
- `from: Left` gets a "must be a layer name" error that doesn't mention left/right either.

**Repro:**
```
node $S/lv.mjs --job $J/mon-C-bad/float-typo-first --grid    # warning only; --storyboard renders
node ~/.claude/skills/product-launch-sting/video/lv.mjs --job $J/mon-C-bad/float-typo-first --grid   # error (base behaviour)
node $S/lv.mjs --job $J/mon-C-bad/float-typo --storyboard --aspect 16x9
```

**Fix:** in `crossCut`, for a float whose string `from` is not left/right, error when the previous shot's block lists its layers and the name isn't one of them. The timeline's `layerNames()` already has that list. Also error on the first shot. Word every message as "left | right, or a layer of the previous shot (…)".

### 5. MEDIUM: the flood's motion dies before the cut instead of peaking on it

**File:** `runtime.js:940`, `Rp = q => (far * 1.25 + fe) * Math.pow(K.clamp(q), 1.5)`.

**What happens:**
- The circle's radius is fastest on the cut, but by then the front is far off-screen.
- The *visible* change peaks about 6 frames (30 fps) early and then reaches zero before the cut.
- Measured on the 16x9 film, mean |Δ| per 60-fps frame: 23.1 at 134, 10.5 at 138, 1.8 at 140, 0.05 at 142, **0.0 at 143→144** (identical frames), then the cut at 145.
- In 1x1 the frame is flat colour from about cut−12 (60-fps index).
- This breaks the core rule "speed … peaks on the cut". The cut lands on a dead frame, and QA's cut check can't see it (INFO 0.92× / 0.52×).

**Repro:**
```
/usr/bin/python3 -I $T/fdiff.py $J/mon-C-dev/out/main/16x9/frames 120 150
```

**Fix:** size the growth so the **visible** front (the solid core plus about half the 420 px feather) reaches the farthest corner exactly at p = 1. For example `R(1) = far + 0.6·fe`, with p² or an expo-in, so the last uncovered corner disappears on the cut frame. Keep the "+25 %" margin on the outer feather only.

### 6. MEDIUM: the dive's arrival loses the forward motion

**Files:** `runtime.js:1011-1014` (footage counter-scaled to ×1 under a dive entrance), `runtime.js:994` (the screen-space blur wrapper also blurs the held plate), and the blocks, which never learn they were entered by a dive.

**What happens, `pick → teaser` (all aspects):**
- A's frame-to-frame change peaks at 33.9 (frame 431). After the cut it is **0.56, 0.32, 0.60, 1.08…** (frames 436–441). The picture almost stops.
- The footage holds still but is blurred by the dive's blur (blur 12 on a static plate, +1…+6).
- B's float runs its own entrance: a lateral fly-in from the left with an orange speed streak. So the dominant motion after the cut is sideways, not forward.
- `wall → plan` (dive into a point) drops from 35.3 to about 0.7–1.1 per frame. B is a small white bar growing on a flat field.
- The dive into the card also spends its last 3–4 frames on a featureless blurred pink fill: zoom 10 into a card that already fills the frame at about ×3.

**Look:** `jobs/mon-C-strips/16x9/cut2-16x9.jpg`, `9x16/cut2-pick-teaser-9x16.jpg`, `1x1/cut2-pick-teaser-1x1.jpg`.

**Repro:**
```
/usr/bin/python3 -I $T/fdiff.py $J/mon-C-dev/out/main/16x9/frames 418 452
/usr/bin/python3 -I $T/fdiff.py $J/mon-C-dev/out/main/16x9/frames 912 945
```

**Fix:**
- Let the plate keep flying forward from ×1. For example ×1 → ×1.12 on the same out-curve with a matched starting log-speed, instead of holding.
- Exclude the plate from the screen-space blur, or blur it only with its own motion.
- Give blocks `ctx.entered = 'dive'`, like `ctx.carried`, so float skips its lateral fly-in and streak.
- Clamp the default `zoom` so the target just over-fills the frame at the cut, for example ×1.3 its fill zoom, capped by `zoom`.

### 7. MEDIUM: the needle carry's hand-over snaps (rotation and offset tick at landing)

**Files:** `runtime.js:784` (`c.hand = 0` when `lookKey` matches) and `runtime.js:831` (the copy is A's last-frame look, `gZ`, placed by uniform scale).

**What happens:**
- The copy keeps A's last-frame bob tilt and position.
- At landing, B's real card appears upright, about 10 px away.
- 16x9 frame 679→680 change: **3.02** against 0.20–0.43 for its neighbours. The difference image shows a double edge and rotation on the card border.
- The smooth carry's hand-over (579→580) is a 2× spike: 2.08 against about 0.95, partly from the brackets appearing.

**Look:** `jobs/mon-C-strips/needle-handover-679-680.png`, `smooth-handover-diffs-578-581.png`.

**Repro:**
```
/usr/bin/python3 -I $T/fdiff.py $J/mon-C-dev/out/main/16x9/frames 676 686
```

**Fix:**
- Only hand over hard when B's live rect matches the copy within about 1 px and rotation within about 0.2°.
- Otherwise ease the copy onto B's **live** transform (rect *and* rotation) over the last 3–4 frames, as the crossfade path already does with `visualRect(c.rootsB)`.
- Or hold B's idle bob at 0 until landing + N frames for a carried-in float, so both sides match.

### 8. MEDIUM: `from:` ignores the size of what the cards come out of; `from:` after a dive starts on a near-empty frame

**Files:** `engine/kit.js:117` (`grow`: fixed `s0 = .06`), `lib/timeline.mjs:173-176` (no warning for `from:` after a dive).

**What happens:**
- `again → wall` with `from: card`: A's last frame shows a card filling about 55 % of the 9x16 frame. B's first frame is one ×0.06 card at the same centre, a shrink-pop from a big card to a speck (`9x16/cut5-again-wall-9x16.jpg`).
- After a dive (`jobs/mon-C-whip`, panel → wall `from: [0.5, 0.5]`), the cards start at ×0.3 × ×0.06 ≈ ×0.018: a 2-px speck on an empty frame for about 4 frames (`whip-16x9/cut1-s2-s3-16x9.jpg`).
- QA still passes (`content … min 4 differing thumbnail px`).
- C listed this as open issue 4 but added no warning.

**Repro:**
```
node $S/lv.mjs --job $J/mon-C-whip --grid      # no warning
node $S/lv.mjs --job $J/mon-C-whip --film --aspect 16x9 --workers 2   # QA PASSED with content min 4
```

**Fix:**
- Default `s0` to (source element's size / card size), clamped to .06–.6. Cards born out of a big element then start at its size, like a split.
- Warn at `--grid` on `from:` in a shot entered by a dive, or skip the dive's ×`from` for `origin` blocks.

### 9. MEDIUM: `morph to: frame` passes through a muddy grey slab

**File:** `runtime.js:848`. The colour is a linear sRGB `mix` on `smoothstep(.25, .95)`.

**What happens:** a white prompt box morphing into the dark end-card colour is mid-grey (#888 → #444) for 3–4 frames while it is large, with faint ghost text in it. It reads as a loading placeholder, not "the CTA fills the frame" (`16x9/cut8-16x9.jpg`, `9x16/cut8-go-end-9x16.jpg`, `1x1/cut8-go-end-1x1.jpg`).

**Repro:** `$T/sheet.sh $J/mon-C-dev/out/main/16x9/frames 1161 -28,-24,-20,-16,-12,-8,-4,-1,0 /tmp/x.jpg`

**Fix:**
- Interpolate in OKLab, or switch the colour late and fast: `smoothstep(.65, .95)` while the box is still mostly A's colour.
- Better: make the box take the next colour from the start of its growth, with A's content fading out on top. That is how a "fill" reads.

### 10. LOW: the morph timing deviates from the spec (documented by C)

**File:** `runtime.js` `cusp()` (≈ line 801).

The spec asks for A to grow about +18 % **on one axis** into the cut, and for B to start about −18 % and decelerate. C built one continuous box on a cusp, so both axes change together. C documented this as a choice. **The lead should decide:** the literal two-box version gives the reference's "stretch then settle" read. The continuous box looks clean but subtle (`cut7` sheets).

### 11. LOW: the carry take-off jolts

**File:** `runtime.js:795`. The lift ramps on `outCubic` from rest over 3 frames.

At 16x9 frame 536 (take-off) the change jumps from 0.42 to **6.66** in one 60-fps frame: the card visibly pops about 3–4 % bigger and gains a shadow at once (`jobs/mon-C-strips/carry-takeoff-535-536-538.png`).

**Fix:** start the lift with an ease-in-out (smoothstep) over 4–5 frames, and fade the drop shadow in over the same span.

### 12. LOW: file ownership, `lib/fingerprint.mjs` is not in Worker C's list

`fingerprint.mjs:27-31` was edited.
- The spec's "add `cause` to the not-pixels list" needs `NOT_PIXELS`, which lives here, so that part is justified.
- C also added new cross-cut print linking (`linksNext` / `linksPrev`). That logic is outside the brief.
- No other round-1/2 worker owns the file, so it won't conflict.
- **The lead should accept it explicitly.** Note that `linksPrev` treats *any* non-left/right string `from` on any block as a link. This only affects caching.

### 13. LOW: diff hygiene, a comment was moved onto the wrong line

**File:** `runtime.js:40`. The base comment `// opening: grows into the slow push …` was cut from the `if (first)` line and appended after the new `dive` line. That line now carries two comments and is about 180 characters long. Put it back.

### 14. LOW: merge with round 1 needs manual resolution, with one semantic trap

I trial-merged (`git merge-file --diff3`) C against the current stageA/stageB:

| File | Conflict hunks | Notes |
|---|---|---|
| `runtime.js` | 1 | The `LV` export line: B's `hideText` and C's `crossCuts`. Trivial. |
| `timeline.mjs` | 1 | The return line: B's `reading` and C's `signature`. Trivial. |
| `spec.mjs` | 1 | Float `ENUMS`. **Semantic:** take A's new enums but **drop** `from: ['left','right']` for float, or `from: <layer>` errors. |
| `stack.js` | 3 | The import line, the doc/layers line, A's exploded validate/cues/hero vs C's unchanged ones. |
| `wall.js` | 4 | The import, doc/layers, params, cues/hero. A's grid-mode cues still use `12 + j*5` and must take C's `CHIP0(s)`. |

**After the merge:** C's grow code only runs in the default modes. `from:` on `wall layout: grid` or `stack mode: exploded` is silently ignored, so add a warning. `lib/render.mjs` (D) merges cleanly.

### 15. LOW: transition-lint inconsistencies and noise on old jobs

**File:** `lib/spec.mjs:330` (`TRANSITION_FAMILY`), `lib/timeline.mjs:182`.
- `whip-*`, `smear-*` and `drift-*` collapse to one type, but `zoom-in` and `zoom-out` count as two. film-sample is reported as "4 types" (zoom-in, zoom-out, whip, blur); it would be 3 with a zoom family.
- The "moving transitions without a visible cause" warning now fires on 11 of the 16 original jobs, and the storyboard grows a "Notes before the film" box on all of them (`mon-C-logs/old-grid-diff.log`).

**Fix:** treat `zoom-*` as a family. Consider INFO, not a warning, for the cause line on jobs that use no round-2 field.

### 16. LOW: two loose validations

**File:** `lib/spec.mjs:316`, `lib/spec.mjs:387`.
- `signature: [dive]` (a list) is accepted, because `String(['dive'])` is `'dive'`.
- `cause: "  "` passes spec validation, and only the lint catches it.

**Repro:** `node $S/lv.mjs --job $J/mon-C-bad/sig-cause --grid`.

**Fix:** require a string for `signature`, and a non-blank string for `cause`.

### 17. LOW: the wall's hero frame isn't moved when the chips are delayed

**File:** `engine/blocks/wall.js:27`. With `from:`, the chips start at 24 instead of 12 (`CHIP0`), but `hero` still uses `14 + chips·5 + 10`. With 3–6 chips the storyboard/audit frame lands while the chips are still popping.

**Fix:** `hero: … Math.max(40, CHIP0(s) + 2 + chips·5 + 10)`.

### 18. LOW: the dev job and the report's artifacts don't show what they claim

- `jobs/r2-dev/r2-dev-storyboard-*.png` are from 09:53, before the final `beats.yaml` (10:07). They show `plan` light, not dark. The report points the lead at them. Fresh ones: `jobs/mon-C-dev/r2-dev-storyboard-{16x9,9x16,1x1}.png`.
- The flood "pours from the pressed thing" only nominally. It starts at the prompt-box **centre**, under the text. The prompt block has no layer for the Send button the `cause:` names, so a flood can't come from it except via `[x, y]`.
- The needle demo pulses only **1.055×**: carry width 543 → 573 px in 9x16, against the spec's 1.10–1.15×.
- There is no carry over a moving `out`, which is the spec's own example (see finding 2).

**Fix:** re-render the storyboards; give `prompt` a `send` layer, or use `flood.from: [x, y]` on the button; set `again` so its card is about 1.12× post's; add the whip-carry case.

### 19. LOW: the morph's box→box hand-over shows a doubled shadow

**File:** `runtime.js` morph branch (`hand` crossfade, ≈ lines 842-866). During the 4-frame hand-over the morph box (with its interpolated shadow) and B's real prompt box (with its own shadow) overlap. The shadow and edge read darker and doubled for about 2 frames (16x9 `cut7`, +24).

**Fix:** drop the morph box's shadow to 0 over the hand-over, or crossfade only the contents and let the box hand over hard when the rects match.

## Requirement checklist (SPEC-R2 Worker C)

| Item | Status |
|---|---|
| §1 Carry: stage-level CARRY layer above the shots, below the overlay and bars; copy taken from A's DOM (live before the cut, last frame after); screen-space arc path with log size, lift and a bell-shaped speed peaking on the cut; B hidden until landing; needle bezier | **Met, with defects**: findings 2, 7, 11 |
| §1 Hand-over crossfade when the looks differ | **Not met in quality**: finding 2 (a double) |
| §1 Errors: unknown layer A/B, B invisible at landing, carry on the last shot; `--grid` warning for an unknown `to` layer | Met (C's probes plus mine) |
| §1 Clean renders have no carry; bg-only hides CARRY | Met (layers clean and with-transitions pass; xcuts) |
| §2 Morph: size not scale, radius, colour, shadow; contents crossfade through about 6 px blur | Met (box uses left/top/width/height) |
| §2 "A +18 % on one axis, B −18 %" timing | **Deviated** (finding 10, documented) |
| §2 `to: frame` fills the frame on the cut in the next shot's colour | Met; quality finding 9 (grey) |
| §3 Dive: log-space zoom about a fixed pivot over the last 14 frames, max 16; B from ×0.3, growing, starting log-speed 0.5–1× (measured 0.82); never shrinks; whoosh | Met numerically; quality finding 6 |
| §4 `from:` on float/stack/wall, `ctx.origin` with the entering camera undone, `K.grow` helper documented | Met; quality finding 8, regression finding 4 |
| §5 Flood: 3 wobbling soft circles, fringe, colour fade after the cut, text protection | Met structurally; **quality findings 1 and 5** |
| §6 Lint: more than 2 types, cause once per film; `cause` / `signature` fields; `cause` not pixels | Met; findings 15, 16 |
| Opt-in: an old timeline builds the old page, byte-identical | Met (storyboards, `--grid` on 16 jobs, overlay probe; range result below) |
| `cam.carry` for D | Met |
| Done: dev job QA PASSED ×3 aspects | Met (re-verified) |
| Done: purity proven | **Not met**: finding 3 |
| Done: `--clips` / `--layers` of a carry shot pass | Met (`--layers post` clean and with transitions; `--clips again --alpha`) |
| File ownership | Finding 12 (`fingerprint.mjs`) |

## Regression: `--film --range` over the old overlay cross-cuts (live vs stage C)

```
node $S/lv.mjs --job $J/mon-C-old-ovl-stage --film --aspect 16x9 --range 70,470 --workers 2
node ~/.claude/skills/product-launch-sting/video/lv.mjs --job $J/mon-C-old-ovl-live --film --aspect 16x9 --range 70,470 --workers 2
```
Both commands exit 1 at the mux step, as expected for a range on a never-rendered film. The 401 frames are on disk.
- **Film frames:** **400/401 byte-identical.** Frame 338 (wall) differs only by max |Δ| 2, the known wall raster noise.
- **QA background reference (`bgref`):** 13 smear frames (82–96) differ.
- **Re-check of those 13:** a second *live* run (`jobs/mon-C-old-ovl-live2`, `--range 70,110`) differs from the first live run on 6 of them, and stage C matches live2 on those. That smear reference is non-deterministic in the live engine too, so it is not a regression.
- **Conclusion:** the opt-in claim holds for every old path I could reach: overlays, drifts, whips, zooms, blur, letterbox, footage, float/stack/wall/media.

**Clips (added after the checklist):** `node $S/lv.mjs --job $J/mon-C-dev --clips again --alpha --aspect 16x9` passes clip, content and freeze, so a clean alpha clip of a shot that receives a carry is fine.

## Where everything is

- **Tools (read-only on the engine):** `qa/motion-kit/jobs/mon-C-tools/`
- **Cut contact sheets (30-fps frames −14…+18 around every cut, red = first frame after the cut):** `qa/motion-kit/jobs/mon-C-strips/{16x9,9x16,1x1}/cut*.jpg`. 16x9 is built from my film's frames; 9x16 / 1x1 are sparse renders with `cams.json`.
- **Close-ups:** `qa/motion-kit/jobs/mon-C-strips/*.png`
- **Purity runs:** `qa/motion-kit/jobs/mon-C-purity/`
- **Logs:** `qa/motion-kit/jobs/mon-C-logs/`
- **Probe jobs:**
  - `jobs/mon-C-bad/*` (bad input)
  - `jobs/mon-C-whip` (carry over a whip, dive into a panel, `from:` after a dive)
  - `jobs/mon-C-old-ovl-*` (regression)
  - `jobs/mon-C-nocarry` (purity control)
  - `jobs/mon-C-fixtest` (a scratch engine copy for two fix trials; not a deliverable)
