# Monitor report: Worker A (blocks), round 1 (2026-10-26)

**Verdict.** Not ready to merge as is. I found **3 HIGH, 8 MEDIUM and 9 LOW** issues (20 in total).
- **What holds up.** File ownership is clean. Old jobs are unaffected. Every bad-input case I planted fails `--grid` with a clear message. All 8 layer exports I ran pass.
- **What breaks.** Valid inputs can clip text: one case gives a QA FAIL and another a silent PASS. The exploded view's labels point at the wrong layers. The map headline scrim washes out its own pins and chips.

I checked everything myself and did not trust the build report. I edited none of Worker A's files. My jobs are `jobs/mon-A-*`, my tools are in `jobs/mon-A-tools/` and my logs and stills are in `jobs/mon-A-logs/`.

Shorthands used in the repro commands:

```
S=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit/stageA/product-launch-sting/video
J=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit/jobs
T=$J/mon-A-tools      # purity.mjs, seq.mjs, contig.mjs, probe.mjs, diffmap.mjs, timing2.mjs, gridassign.mjs, anchors.js, leaders.js
```

- `mon-A-kit` is a `cp -c` clone of `kit-dev` (beats.yaml and assets only).
- `mon-A-perf` is a stress job: dense particles, a 12×12 grid, a 9-card fan, a 6-stop map, 5 planes, a long press label and long words.
- `mon-A-fail` holds just fan9 and pr-long, with 16:9 and 1:1 films.
- `mon-A-light` is the light-theme wall grid plus a light burst.
- `mon-A-bad` and `mon-A-warn` are my own bad-input and soft-problem probes.
- `mon-A-grids/*` are clones of every original job, used for the `--grid` and timeline comparison.
- `mon-A-old-{live,stage}{,2}` are film-sample clones for the byte-identical range renders.

---

## Findings (most severe first)

### 1. HIGH: a long press label is cut off inside the control and covered by the cursor; QA passes on 16:9 and FAILs on 9:16 and 1:1
- **Where.** `engine/blocks/press.js:163-176` and `:191-194`. The label is fitted with `ctx.fit(tx, {maxW: room - iw, lines: 1, min: min(lfs, 48u)})` inside an `overflow:hidden` face box that is centred. The click point is clamped to `fx0 + fw - fh*.55`.
- **What happens.** A label longer than the room cannot shrink below its 48 px floor and has nowhere to wrap.
  - The visible text is cut off at both ends: "a cinematic launch teaser" is clipped left and right.
  - The cursor lands on the text.
  - `--grid` gives no warning at all.
  - On 16:9 the film says **QA PASSED** with the label visibly cut (`jobs/mon-A-logs/keep/prlong-16x9-hero.png`, crop at `jobs/mon-A-logs/stills/prlong-crop.png`).
  - On 9:16 and 1:1 the storyboard and film fail: `FAIL text clipped by the frame: pr-long "Generate a cinematic lau"`.
- **Repro.**
  ```
  node $S/lv.mjs --job $J/mon-A-fail --film --aspect 16x9 --workers 3   # QA PASSED, label cut
  node $S/lv.mjs --job $J/mon-A-fail --film --aspect 1x1 --workers 3    # QA FAILED (1): text clipped
  ```
- **Fix.**
  1. In `validate`, measure roughly how wide the label is for the control and aspect. Warn above that (or error, since it is guaranteed to fail).
  2. In `build`, let `button` and `key` labels wrap to 2 lines, or grow `fw` up to the 80 % cap before shrinking. For `send`, shrink to the 30 px label floor or end the line with "…" on purpose.
  3. Compute the click point from the real label box, and never place it inside that box.

### 2. HIGH: `fan` with `count` 7 or 9 and `labels` puts chips off-frame on 1:1, so film QA FAILs on a documented, valid input
- **Where.** `engine/blocks/fan.js:95-131`. Chips are placed on each card's projected bottom edge and are never kept inside the frame or safe area. `:73-77` sets the outer tiers to bleed off-frame by design.
- **What happens.** `count: 9` with 9 labels: the 16:9 storyboard is clean, but 1:1 gives `FAIL text clipped by the frame: fan9 "B"; "H"; "A"; "I"`.
  - `--grid` is silent, even though `params.count` advertises "odd, 3–9".
  - 9:16 escapes only because it shows 3 cards.
- **Repro.** `node $S/lv.mjs --job $J/mon-A-fail --film --aspect 1x1 --workers 3` (log: `jobs/mon-A-logs/fail-film-1x1.log`). The sheet is at `jobs/mon-A-perf/mon-a-perf-storyboard-1x1.png`.
- **Fix.** Hide a card's chip when its chip box leaves `ctx.safe`, which is exactly the cards that bleed. Or keep chips inside safe the way map does. Also warn in `validate` when `labels` meets a tier that will bleed in some aspect.

### 3. HIGH: in `stack mode: exploded` (default `tilt: iso`), most leader anchors land on the plane in front, so the labels point at the wrong layers
- **Where.** `engine/blocks/stack.js:99`: `const q = low ? [pw, ph*.5] : [pw*.96, ph*.62]`. The same local point is used on every plane. Each plane sits 96 px lower and further right, so plane k's anchor falls inside plane k-1, which covers it.
- **What happens.** Hit-testing the anchor dots at the hero frame (`elementsFromPoint`), topPlane by label index is:

  | Aspect | topPlane (label 0, 1, 2, 3) | Wrong labels |
  |---|---|---|
  | 16:9 | 0, **0**, **1**, **2** | 3 of 4 |
  | 9:16 | 0, **0**, **1**, **2** | 3 of 4 |
  | 1:1 | 0, **0**, 2, 3 | 1 of 4 |

  - In the 16:9 still you can see it: "Media" points at the Interface plane's blue button, "Layout" at the Media gradient and "Colour" at the grid plane (`jobs/kit-dev/out/main/16x9/board/11-exploded.png`).
  - `tilt: low` reads correctly by eye: its dots sit on the edges.
- **Repro.** `node $T/probe.mjs $J/mon-A-kit 16x9 exploded 65 @$T/anchors.js`
- **Fix.** For each plane, project a few points along its right and bottom edge. Pick the first one that lies outside the projected shapes of all planes in front of it.

### 4. MEDIUM: the map headline's scrim is painted over the route, pins and chips, and stops are not kept clear of the headline
- **Where.** `engine/blocks/map.js:168-173`. The `scrim` is created after the chips (`:152`) on the `text` layer, so it paints over the labels. It is 42 % of H on 16:9 and 30 % on 9:16, fading from 96 % land colour.
- **What happens.**
  - kit-dev 16:9 map: the "Launch" chip at y ≈ 347 sits under about 34 % land colour. Its ink reads as #555 next to the other chips' #111, and its pin is washed too (`jobs/mon-A-logs/stills/map-launch-zoom.png`).
  - mon-A-perf map6: the "Two" and "Four" chips and pins are nearly invisible on all three aspects, and "Two" collides with the headline. The `--grid` and storyboard notes are silent.
  - The text audit still reports these chips at opacity 1.
- **Repro.** `node $S/lv.mjs --job $J/mon-A-perf --storyboard --aspect all`, then look at shot 7 in `jobs/mon-A-perf/mon-a-perf-storyboard-*.png`.
- **Fix.** Insert the scrim right after `mapEl`, under the route, pins and labels. Also keep chips out of the headline box (add it to `taken` and to the follow-pan limits). Warn when a stop falls inside the headline zone.

### 5. MEDIUM: with `after` set, the cursor tip lands on the working-state label (spec: "never covers the label")
- **Where.** `engine/blocks/press.js:191-194`. The click point is computed from the width of `L0` (the first label) only. "Generating…" is wider, so after the switch the arrow sits on its "…".
- **Evidence.** kit-dev 16:9 film frames 132 and 136 (`jobs/mon-A-logs/stills/prgen-66-68.png`). These are the last 8 frames before the cut, so they are on screen.
- **Repro.** `ffmpeg -i $J/kit-dev/out/main/16x9/frames/00136.png …` (any local frame from 64 to 68 of pr-gen).
- **Fix.** Use `lw = max(width(L0), width(L1))` for the click point. Or drift the cursor 20–30 px down and right after the release, which is natural hand motion.

### 6. MEDIUM: the hidden `after` label is audited as visible text, so QA gets false data
- **Where.** `engine/blocks/press.js:180-181`. `L1.row` waits at `top: fh`, below the face, and is hidden only by `lbox`'s `overflow:hidden`. `LV.audit()` (runtime) ignores clipping by overflow.
- **What happens.** At pr-gen's hero frame the audit lists `["Generating…", y 843–941, opacity 1]`, while the box clipping it spans y 564–790.
  - The storyboard for mon-A-perf prints a false note: `text outside the platform-UI-safe area: pr-long "Generating your teaser…"`.
  - Worker B's contrast and text-floor checks will measure glyphs that are not there.
- **Repro.** `node $T/probe.mjs $J/mon-A-kit 16x9 pr-gen 61 "window.LV.audit().map(b=>[b.text,Math.round(b.y0),Math.round(b.y1),b.opacity])"`
- **Fix.** Set `visibility:hidden` on `L1.row` until `t >= P.state + 1`, and on `L0.row` once its exit ends. Keep both to whole frames so purity is not affected.

### 7. MEDIUM: purity: a frame's pixels depend on which frames the page drew before it
Rendering the same frames in sorted, shuffled and reversed order on one fresh page each mostly agrees. Comparing against the film, which was drawn contiguously, does not.

**Film vs fresh render.** 47 of 135 sampled frames differ in every aspect, with max Δ 52–238 on 0.3–0.9 % of pixels. The differences are always in headline or chip glyphs. Frames 0 and 1 and the last frames of each shot always match.

**Bisected on pr-gen local frame 61.**

| Frames drawn before 61 | Result |
|---|---|
| 0–15 (the headline's entrance: opacity, transform and blur at once) | equals the film |
| 15–30, or just 60.5 | differs from the film: 3098 px, max 170, in the "One click." box |

This is the trap in `reference_chrome_layer_separation_traps.md`: an element "moved by transform AND fading at once". Old jobs show the same mechanism (Worker B's calibration: steady-sample 10s has 12/24 frames beyond tolerance). Every new block with a headline triggers it, so expect Worker B's purity WARN on most kit-dev shots.

There are also two true order effects on fresh pages:

| Shot, frame | Aspects | Difference | How triggered |
|---|---|---|---|
| `pr-send` f71 | 9:16, 1:1 | 315 px, max 161, around the send button and cursor | after drawing f71.5 |
| `exploded` f12 | all | about 1.2–1.5k px, max 5, on the top plane | reversed order |

**Repro.**
```
node $T/purity.mjs $J/mon-A-kit 16x9 /tmp/p all $J/kit-dev/out/main/16x9/frames   # results: jobs/mon-A-logs/purity-<aspect>.log/.json
node $T/seq.mjs $J/mon-A-kit 16x9 /tmp/a pr-gen "$(node -e 'console.log(Array.from({length:31},(_,i)=>i/2).join(","))'),61"
node $T/seq.mjs $J/mon-A-kit 16x9 /tmp/b pr-gen "60.5,61"
node $T/diffmap.mjs /tmp/a/031-pr-gen-61.png /tmp/b/001-pr-gen-61.png /tmp/d.png        # 3098 px > 2, max 170
node $T/seq.mjs $J/mon-A-kit 9x16 /tmp/c pr-send "71.5,71"; node $T/seq.mjs $J/mon-A-kit 9x16 /tmp/e pr-send "71"
```

**Fix.**
- For entrances, move by `top` and fade the children, as the traps note says.
- Once landed, hold text at `transform: none` and drift it in whole pixels (`top`), or not at all. The camera push already keeps the frame alive.
- For pr-send, set the target's transform to exactly `none` once `pr < 1e-3`, and check the ring rects at `a ≥ 1`.
- The lead should decide the tolerance with Worker B, because the engine-wide part is not Worker A's alone.

### 8. MEDIUM: 6 of the 7 new looks cut in on a nearly empty frame
- **Where.**
  - `fan.js:20`: the deal starts at -1, so frame 0 is one small, faint card.
  - `particles.js`: burst is a tiny cluster in black; grid is a centre clump; terrain is near-black fog.
  - `wall.js:74`: the delay of -2 leaves 4 of 24 tiles.
  - `stack.js` exploded: the entrance at -4 shows one small plane.
- **Contrast.** press and map pre-roll their entrances (t0 −3 / −5) and are full on frame 0. Worker A gave press that fix for exactly this reason ("a hard cut into only a blurred backdrop read as a soft start") but did not apply it elsewhere.
- **Evidence.** `jobs/mon-A-logs/stills/first-frames-16x9.png`: local frame 0 of all 15 kit-dev shots, from the film.
- **Fix.** Pre-roll each build by 4–8 frames, so the cut lands on a frame that is 50–70 % built and still moving. QA `content` passes either way, so it will not catch this.

### 9. MEDIUM: word beats are small on 9:16 for anything longer than about 5 letters, which misses "each word fills the frame"
- **Where.** `engine/blocks/type.js:157-166`. On 9:16 the cap target of `.2*W` is then fitted to `safe.w*.96`.
- **Measured** (font px, via `LV.audit`):

  | Word | 9:16 | 16:9 |
  |---|---|---|
  | "Unbelievable." | **130 px** (cap ≈ 95 px, 5 % of H) | 263 px |
  | "Extraordinary." | 149 px | 301 px |
  | kit-dev "Animate." | 253 px | — |
  | "Go." | 307 px | 369 px |

  - On 9:16 the frame is about 85 % empty around the word.
  - On 16:9 the size jumps 263 → 369 px between beats.
- **Repro.** `node $T/probe.mjs $J/mon-A-perf 9x16 words-long 15,45,75 "window.LV.audit().map(b=>b.text+' '+b.px.toFixed(0))"`
- **Fix.** On 9:16, split long words onto 2 lines, e.g. "Extra-/ordinary.", or allow a ±90° rotated beat. Warn in `validate` when the longest word drops below about 12 % of H in cap height in any aspect. Consider one shared size per shot so the beats don't jump.

### 10. MEDIUM: exploded leader lines run past the spec's ≤ 120 px, up to 2×
- **Where.** `engine/blocks/stack.js:103`. The single chip column at `bx = max(ax) + 0.7·len` stretches the leaders from the back planes.
- **Measured** (px, at hero frame 65):

  | Shot | 16:9 | 9:16 | 1:1 |
  |---|---|---|---|
  | exploded | [119, 105, 90, 74] | [123, 107, 91, 74] | [132, 113, 93, 74] |
  | exploded-low | [**227**, 174, 121, 74] | [**239**, 182, 125, 74] | [**242**, 184, 126, 74] |

- **Repro.** `node $T/probe.mjs $J/mon-A-kit 16x9 exploded-low 65 @$T/leaders.js`
- **Fix.** Cap each leader at 120 px. Per label, put the chip at `min(bx, ax + 104 px)`. Or anchor `tilt: low` on the visible right edge nearest the chip column.

### 11. MEDIUM: on the default light theme, wall `layout: grid` dims the tiles with opacity, so they wash out to milky pastel
- **Where.** `engine/blocks/wall.js:108`: `opacity = 1 - .65*dim`, laid over `C.bg`.
- **What happens.** On a dark job (kit-dev) it reads as dimming. On light, the frame turns low-contrast and faded (`jobs/mon-A-logs/stills/light.png`, left). kit-dev only tested dark.
- **Repro.** `node $S/lv.mjs --job $J/mon-A-light --storyboard --aspect 16x9`
- **Fix.** Dim with a per-tile overlay div, `rgba(0,0,0,.6)` or `C.dark` at about 60 %, and keep tile opacity at 1 once landed. A plain colour overlay adds no compositing trigger.

### 12. LOW: gaps in bad-input validation (spec: bad input fails `--grid` with a clear message)
Source: `jobs/mon-A-bad` and `jobs/mon-A-warn` (all 16 of my hard errors fire correctly; these are the misses):
- **fan labels.** `labels: [{x: 1}, …]` is accepted and puts "[object Object]" on screen. `lib/spec.mjs:242` only checks that it is a list.
- **wall pick.** `pick: [9, 9]` on a 6×4 grid is clamped silently, and `pick: 40` wraps silently (modulo). `lib/spec.mjs:267` / `wall.js gridPick`.
- **wall grid duplicates.** Cards listed twice (`[a, b, a, c, d]`) count as distinct, so the same file sits next to itself with no warning: 7, 4 and 6 such pairs on 16:9, 9:16 and 1:1 in `$T/gridassign.mjs`. `wall.js:20` and `:146`.
- **Ignored fields.** `face: serif` with `words`, and `count` with particles grid/terrain, are dropped without a warning.
- **Double error.** stack exploded `count: 1` gives two errors (the 2–14 rule and the 3–5 rule).
- **Repro.** `node $S/lv.mjs --job $J/mon-A-warn --grid` and `node $T/gridassign.mjs`
- **Fix.** Add a type check on each label, a range warning for pick, a dedupe by path before `gridAssign` and the clash warning, and "X does nothing with Y" warnings.

### 13. LOW: the declared `layers:` order does not match the export for fan and stack exploded
- **Where.** `fan.js:26` says `cards · labels · text`, but the export runs `01-text, 02-cards, 03-labels`. `stack.js:135` says `planes · leaders · labels · text`, but the export runs `01-text.mov, 02-planes…`.
- **Why.** The headline is created first, so it sits at the back. Spec rule 6 says to list layers back to front.
- **Repro.** `node $S/lv.mjs --job $J/mon-A-kit --layers fan,exploded --aspect 16x9` (`jobs/mon-A-logs/kit-layers-16x9.log`: "3 content layers: text, cards, labels").
- **Fix.** Correct the strings, or append the headline last. Fan relies on the headline being out of the cards' bounds, so changing the strings is the safer fix.

### 14. LOW: `read()` is missing on particles, type `words` and stack `exploded` (spec rule 7)
- **Where.** `particles.js:23` exports only `copy`. type and stack fall back to `copy`, so the 4 exploded labels count as reading time.
- **Fix.** Export `read` explicitly: exploded → `[text]`, words → the words, particles → `[text]`.

### 15. LOW: the particles `burst` hero frame lands mid-entrance of the headline
- **Where.** `particles.js:45`. The hero is `b + 12` and the headline enters at `b + 8`, so the audit catches it at opacity 0.889 with about 1.3 px of blur. The storyboard still is soft (`jobs/mon-A-logs/stills/169-b.png`, top right), and B's contrast check will measure an unsettled frame.
- **Fix.** `hero = max(b + 12, textAt + 15)`, capped at D − 8.

### 16. LOW: particles use SVG rather than the spec's `<canvas>`, and the build report's speed figure does not measure painting
- **The method.** `runs/A-tools/timing.mjs` times `LV.seek` plus 2×rAF. That reads the 33 ms vsync floor for every shot, because raster cost lands in the screenshot.
- **My numbers.** Seek plus PNG, with load average around 22:

  | Shot | Median | Max |
  |---|---|---|
  | headline (baseline) | 91 ms | — |
  | kit-dev sphere | 270 ms | — |
  | burst | 201 ms | — |
  | sphere `count: 4000` | 280 ms | 473 ms |
  | grid `spacing: 14` | 238 ms | — |
  | wall 12×12 with clips | 423 ms | — |

  Old footage blocks measure 400–600 ms under heavier load (film-sample), so this is not a regression.
- **Repro.** `node $T/timing2.mjs $J/mon-A-perf 16x9`
- **Fix.** Document the SVG choice in Limits (the canvas tile-raster race is a valid reason). Lower the cap from 4000 to about 2000, or warn above 2000 dots. Measure speed with a screenshot.

### 17. LOW: integration: chips and the 1:1 send label fall below Worker B's new must-read floors
- **The text.** fan, map and exploded chips are 32.6–36.9 px and not `.lv-ui`. The pr-send label is 44.5 px on 1:1. Sizes are from `jobs/kit-dev/out/main/*/audits.json`.
- **The floors.** B's `web` floors are 47 px on 16:9 and 40 px on 9:16 and 1:1, and rule 5 asks ≥ 48 px for a 1:1 headline. Once B merges, expect a WARN on every chip shot of kit-dev.
- **Decide.** The lead should decide whether chips are "labels ≥ 30" (and mark them for B's check) or must-read text. Raising press `send` to `.22` on 1:1 (as on 9:16) takes the label to about 49 px.

### 18. LOW: 9:16 composition
Measured at the 9:16 hero frames, as a share of the frame height:
- **exploded.** The bottom ~35 % is empty.
- **exploded-low.** The top ~33 % and the bottom ~40 % are empty dark.
- **fan.** The bottom ~25 % is empty.
- **Chips.** They read small on the tall frame (36 px).

See `jobs/mon-A-logs/stills/916-a.png`. **Fix:** on 9:16, scale the plane width toward safe.w, centre the stack in the space left under the headline, and use larger chips.

### 19. LOW: lines run through headlines
- **press.** The rings grow uniformly to 1824 × 1094 px, so they cross "One click." during the last 8 frames (`jobs/mon-A-logs/stills/prgen-66-68.png`).
- **sphere.** The orbit ellipses run behind the headline letters (`jobs/mon-A-logs/stills/169-b.png`).
- **Fix.** Grow the rings with a vertical factor of about 0.6, or mask them under the text box. Fade the orbits inside the vignette.

### 20. LOW: the fan headline keeps `translate3d(0,0,0)` at rest, and fan has the thinnest layer margin
- **Where.** `fan.js:138` departs from rule 6 (Worker A reported this themselves).
- **Margin.** fan passes the stack check at 15 px > 16 on 16:9 and 17 px on 9:16, against a limit of 64. Every other block is at 0. A future engine change could tip it.
- **Fix.** The lead should choose an engine-level fix, or keep the headline out of the camera push in fan.

---

## SPEC-R1 checklist for Worker A

| Item | Status | Evidence |
|---|---|---|
| File ownership | **met** | `diff -rq` shows only press, fan, particles, map, `_motion` (new), wall, type, stack, index and spec.mjs; no other file changed. |
| Rule 1: old jobs byte-identical | **met** | film-sample `--film --range` live vs staging: type 145–289 (145/145) and 2119–2264 (146/146) identical; stack 1190–1393 (204/204) identical. Default wall 1742–1944 differs by ≤ 3 code values, but live vs live2 differs by the same amount (wall is not byte-stable on the live engine either). All 16 original jobs: `--grid` output identical and `timeline.json` identical except the lead's `"delivery": "web"`. |
| Rule 2: pure frames | **partly** | No Math.random, Date or rAF, and positions are closed-form. History-dependent raster: see #7. |
| Rule 3: never still | **met** | Film QA `freeze` PASS in all three aspects (Worker A's films; I did not re-render the whole film). |
| Rule 4: every aspect laid out | **partly** | Clean for kit-dev. Valid stress inputs clip (#1, #2), and 9:16 type and composition are weak (#9, #18). |
| Rule 5: text sizes | **partly** | Headlines are 73–114 px. Chips are 32–37 px. 1:1 send label 44.5 px (#17). |
| Rule 6: layers | **met / partly** | 8 exports passed in my runs: 16:9 fan, exploded, pr-gen, map, sphere; 9:16 fan, exploded, wall-grid. Order strings wrong (#13), fan margin (#20). |
| Rule 7: copy / read | **partly** | `read` missing on 3 (#14). |
| Rule 8: cues | **met** | Kinds pop, tick, click and hit are on their frames; QA `sfx` PASS. |
| Rule 9: hero | **met** | Never in the last 7 frames. press uses press + 2, not + 3 (a decision Worker A recorded). Burst is soft (#15). |
| Rule 10: footage | **met** | fan, wall grid and stack exploded take clips through `F.media`. |
| Rule 11: motion grammar | **mostly** | Expo-out entrances at .96 and 8 px; overshoot only on chips and pins (≤ 8 %); cascades of 2–4 frames. Cut-in frames empty (#8). |
| Rule 12: speed | **partly** | #16. |
| Rule 13: no real brands | **met** | Grep is clean. The astronaut clips are our own footage (dev job only). |
| press spec | **partly** | Controls, sizes 36–80 %, cursor 150·u, 10 % arc, bell speed, 24-frame travel, 200 ms dwell, .85 / .94 press, 4 rings to 1.9×, glow ≥ 10 frames, after spinner, cues and layers are all met. Cursor covers the label (#1, #5); default `at` is D−10, not ~8 (recorded). |
| fan spec | **mostly** | Arc in 3D, hero 1.28×, tiers ×.8, deal from a point, pull-back of 3 %, push ×1.26, 9:16 hero 500 × 889. Chips clip (#2). |
| particles spec | **partly** | All 4 modes, closed-form and seeded. SVG instead of canvas (#16), no `read`. |
| map spec | **mostly** | Generated city, Catmull-Rom route drawing on, pins with 7 % pop and pulse, chips, follow-pan ≤ 6 %. Scrim (#4). |
| wall grid spec | **mostly** | Grid sizes per aspect, ring cascade, lit tile 3.5 px, ×1.12, glow, 35 % dim, push, no clash for ≥ 5 cards (stress: 0 clashes over 1–12 × 1–12 grids × 4 seeds, ≤ 15 ms). Duplicate paths (#12); light wash-out (#11). |
| type words spec | **partly** | Faces, 1.08 → 1 landing over 6 frames, push-out, `every` warning, cues and hero are met. 9:16 size (#9). |
| stack exploded spec | **partly** | Planes, iso and low, opacity by depth, staggers, orbit. Leaders > 120 px (#10), anchors wrong (#3). |
| `--blocks` lists every field | **met** | `runs/A-blocks.txt`, and re-run by me. |
| `--grid` bad input | **mostly** | Worker A's 34 errors and my 16 all fire with clear one-line messages. Gaps in #12. |
| Storyboard clean, 3 aspects (kit-dev) | **met** | My clone re-rendered `--storyboard --aspect all` with no notes, and all 45 stills are byte-identical to Worker A's. |
| `--clips <one> --alpha` | **met** | Worker A's fan; my `--clips pr-gen --alpha` gives PASS clip 69/69, content and freeze. |

## Logs and stills to look at

- **Logs.** `jobs/mon-A-logs/`: `purity-{16x9,9x16,1x1}.log/.json`, `kit-layers-{16x9,9x16}.log`, `fail-film-{16x9,1x1}.log`, `kit-clips-prgen.log`, `A-bad-grid.log`, `kit-board.log`, `perf-board.log`, `light-board.log` and `old-*.log`.
- **Stills.** `jobs/mon-A-logs/stills/`: `first-frames-16x9.png`, `prgen-66-68.png`, `prlong-crop.png`, `map-launch-zoom.png`, `916-a.png`, `169-b.png`, `light.png`, `prsend71-crops.png`, `xlow-crop.png`.
- **Stress storyboards.** `jobs/mon-A-perf/mon-a-perf-storyboard-{16x9,9x16,1x1}.png`.
- **Clean-up.** My heavy intermediates (layer PNGs and probe frames) are deleted. Worker A's `kit-dev` was read only and never re-rendered.
