# Worker A · round 1 build report: the motion-kit blocks (2026-10-26)

> **Updated after the monitor's review.** The "Fix pass" section at the end supersedes §1–§6 wherever they differ.

📌 **TL;DR.** All seven blocks and modes are built in the staging copy `qa/motion-kit/stageA/product-launch-sting/`.
They are **press · fan · particles**, then **map · wall `layout: grid` · type `words` · stack `mode: exploded`**.
- **Dev job.** `qa/motion-kit/jobs/kit-dev/` has 15 shots, 44.4 s in three aspects, with stills and real clips as footage cards.
- **QA.** Storyboards are clean in every aspect, and all three films say **QA PASSED**. All 15 new-block shots pass layer
  QA on 16:9, and `--clips fan --alpha` passes.
- **Old samples.** Their stills are byte-identical between the live and staging engines (34 of 37). The other 3 are
  film-sample's default-layout `wall` still, which is not byte-stable even between two live runs (≤ 2 code values).
- **Not touched.** The live skill, `live-before/`, `stage/` and the original jobs. No commits, no paid calls.

## 1 · What changed, file by file (all under `$S/video/`, `$S` = `qa/motion-kit/stageA/product-launch-sting`)

| File | Change |
|---|---|
| `engine/blocks/_motion.js` (new, 68 lines) | Helpers shared by the new blocks. `enter` is the house entrance: expo-out from scale .96 and 8 px blur, with opacity only as a fast ramp. `bell` (smootherstep) gives bell-shaped speed. `pop(u, peak)` is outBack solved for an exact overshoot peak (≤ 10 %), and `arc` is a quadratic arc with the bend as a share of the chord. Also seeded `hash` / `rng`, the big cursor (the UI kit's arrow redrawn; returns the tip offset), colour helpers, and `project`, a CSS-exact projection of a point on a transformed element through `DOMMatrix`. |
| `engine/blocks/press.js` (stub replaced, 271) | Fields `control: button \| key \| toggle \| send`, `label`, `icon`, `text`, `after`, `at`. |
| `engine/blocks/fan.js` (stub replaced, 143) | Fields `cards`, `count`, `pick`, `labels`, `text`. |
| `engine/blocks/particles.js` (stub replaced, 205) | Fields `mode: sphere \| burst \| grid \| terrain`, `count`, `spacing`, `color`, `orbits`, `text`, `burstAt`. |
| `engine/blocks/map.js` (stub replaced, 226) | Fields `stops [{pos, label}]` and `text`; light by default, dark with `theme: dark`. |
| `engine/blocks/wall.js` (+136 / −6) | Adds `layout: grid` with `cols`, `rows`, `pick`, and exports `gridAssign`. The default layout's `build` body is untouched; one early `if (isGrid(s)) return buildGrid(...)` line is added. `copy`, `cues` and `hero` keep their exact old expressions in the default branch. The new `validate` returns `[]` for the default layout. |
| `engine/blocks/type.js` (+93 / −7) | Adds `words`, `faces`, `every` (word beats). `required: ['text']` becomes `[]`, because the lead's spec check ("text or words") now carries it. The `text` path is untouched apart from one early `return buildWords(...)`. Imports `../kit.js` as `K0`. |
| `engine/blocks/stack.js` (+138 / −8) | Adds `mode: exploded` with `tilt`, `labels`, `text`. `required: ['cards']` becomes `[]`, and a spec check keeps the exact old error ("stack needs \`cards\`") in cycle mode. The cycle `build` is untouched apart from one early return. |
| `engine/blocks/index.js` | One comment line. The lead had already registered the four blocks. |
| `lib/spec.mjs` (+55 / −3) | `ENUMS` for press `control`, particles `mode`, wall `layout`, type `faces`, stack `mode` / `tilt`. List, range and `at`-style checks for every new field. Warnings when a mode-only field is used without its mode (`cols` without grid, `tilt` without exploded, `faces` without words). |

No other file was edited: `kit.js`, `art.js`, `ui.js`, `runtime.js`, `qa.mjs`, `render.mjs`, `timeline.mjs`, `lv.mjs`.
Base copies are in `qa/motion-kit/runs/A-base/` and final hashes in `qa/motion-kit/runs/A-final-code.sha1`. The code
was unchanged across the whole final render chain (`shasum -c` clean).

## 2 · The blocks as built, and the decisions I took without asking

**press.** One control drawn macro. A button is .5 W on 16:9, .8 W on 9:16 and .7 W on 1:1. The other controls are a
keycap, a settings row with a switch, and a prompt bar with a round send button; all stay ≤ 80 % of the width.
- **Backdrop.** The UI around the control, out of focus: a panel, skeleton rows, side controls and two brand-colour
  blooms, at blur depths of 22 and 11 px, drifting slowly. Over `bg:` footage there is only a soft haze.
- **Cursor.** 150 px × u, arriving from off-frame (bottom-right; from below on 9:16) on an arc of 10 % of the chord with
  bell-shaped speed. Travel takes 10–24 frames, and `validate` warns under 15.
- **Hover and press.** It dwells 6 frames while the face lifts 6 px and brightens. On the press the cursor scales to .85
  about its tip and the control to .94 for 3 frames, then both release over 6.6 frames. The tip lands right of the
  label, so the arrow never covers it.
- **On the press.** 4 outlines of the pressed shape grow to 1.9 × the face width over 14 frames (467 ms), 2.5 frames
  apart. An accent glow holds ≥ 10 frames and settles to 45 %. With `after`, the label pushes up and out over 6 frames
  while the working state pushes in from below with the spark spinner over 9.
- *Decision.* The default `at` is D − 10, not "~8". The hero frame (press + 3) must stay out of the last 7 frames, and
  at D − 10 the cut still lands on the ring cascade (ring 1 at 70 %, ring 4 just starting). Hero = min(at + 3, D − 8).
- *Decision.* The control's entrance starts 3 frames before the cut, so the first frame already shows it. A hard cut
  into only a blurred backdrop read as a soft start.
- *Decision.* With no `label`, each control gets a default: "Generate" with a sparkle icon, "Enter" on a key,
  "Auto-publish" on a toggle, and a prompt line on send.
- *Decision (layers).* The backdrop is one SVG whose blur is an SVG filter, and it moves in whole pixels. With a CSS
  `filter: blur`, the backdrop became its own composited layer and the control composited by overlap. `pr-key` then
  failed the stack check on 6 press frames.

**fan.** An odd number of cards on a concave arc in real CSS 3D under one perspective (2200 px × u).
- **Layout.** The hero is 1.28 × and in front. Each tier is ×.8, turned inward (rotateY up to 50°) with a small
  in-plane tilt (≤ 4.4°) and a drop, like a hand of cards. Cards have a 4.5 % radius, a soft shadow and a glass sheen.
- **Motion.** Cards are dealt out of the hero's centre: scale .06 → 1 on rising arcs, with 8 px of blur, hero first and
  +3 frames per tier. The hero is already growing on frame 0. The hold pulls back 3 %. Over the last 10 frames an
  ease-in push zooms ×1.26 about the hero while the others spread ×1.55 and blur, so the next shot can cut in close.
- **9:16.** Three taller cards: the hero is up to 889 px tall and the sides bleed off both edges.
- **Chips.** Flat and readable, placed each frame from the card's projected bottom edge (whole pixels), popping with
  ≤ 8 % overshoot.
- *Decision.* `pick` is the index into `cards` of the card that takes the centre (hero) slot. The other cards go round
  the arc from it. The default is the middle card of the list.
- *Decision (layers).* The headline sits on its own always-composited layer (`translate3d(0,0,0)` at rest, after a
  normal entrance). See §5, issue 1: this is against the letter of SPEC rule 6, and it is measured.

**particles.** Dots are painted as SVG paths, one `<path>` per colour × 20 opacity steps, rebuilt each frame. The first
version used a `<canvas>`. Its composited layer raced Chrome's tile raster on shot switches and left an unpainted 56 px
band at the bottom of a shot's first frame in probe renders, depending on history. SVG paths are also correct at any
DPR. Every mode has dots from frame 0.
- **sphere.** 900 Fibonacci points rotate about 27°/s with a tilt and breathe 2.5 %; depth drives size and alpha. The
  sphere assembles from a swirling outer shell. At `burstAt`, the dots fly out on an expo-out with a swirl and velocity
  streaks (tapered quads), then drift slowly.
- **burst.** Assembles from the centre and blows apart at about frame 12 into a star field. The headline enters after
  the burst.
- **grid.** A halftone field with a diagonal travelling wave and a ring pulse from the centre every 1.6 s.
- **terrain.** A dot plane with sine swells fixed to the ground, flowing towards the camera, fogged at both ends.
- **Orbits.** 3 SVG ellipses draw on. Their satellites dim on the far side, and the orbits vanish in the burst.
- **Text.** The headline sits over a soft vignette.
- *Decision.* The sphere's hero frame is just before the burst, where the sphere is whole. Mid-burst read as noise
  on a still.

**map.** A seeded, generated city with no real geography.
- **The city.** Land, a river with a shore, two parks and building blocks. A rotated street grid has minor streets in
  the brand line colour and an avenue with casing every 4th line. One diagonal avenue doubles as a bridge over the river.
  `theme: dark` swaps the palette.
- **Route.** A Catmull-Rom curve through the stops. A dotted planned path appears first; then the accent route and its
  casing draw on (dash offset) with a pulsing head. Each leg is timed by its length (aspect-independent, so the cues
  match every aspect), with a 3-frame dwell per stop.
- **Pins and chips.** A pin drops on arrival (−40 px → 0 on expo-out, scale pop ≤ 7 %) with a pulse ring, repeated every
  1.5 s. Its chip pops 3 frames later.
- **Follow-pan.** 0.14 × the head's offset, at most 6 %. It is clamped so no chip leaves the title-safe box QA checks,
  the camera push included.
- *Decision.* Each chip goes right, left, above or below its pin, whichever is farthest from the sampled route, the
  other chips and the pins, inside the safe area (with a slight preference for the right).

**wall `layout: grid`.** A flat mosaic, laid out entirely with left/top/width/height and no transforms, which keeps it
layer-safe.
- **Grid.** Tiles fill the frame with 3.5 % overscan, 10 px gutters and a 4.5 % radius: 6 × 4 on 16:9, 3 × 5 on 9:16,
  4 × 4 on 1:1 (`cols` / `rows` override).
- **Motion.** Tiles cascade in by ring from the centre (≤ 2 frames per ring; the centre is in on frame 0). The lit tile
  lands at frame 22: a 3.5 px accent stroke draws on, it scales ×1.12, and an accent glow pulses. The other tiles dim to
  35 % from frame 24. Then the grid pushes ×1.075 into the lit tile.
- **Headline.** It sits on a band that wipes open, in the lower third, or the upper third when the lit tile sits low.
- *Decision.* The lit tile always shows **the first card** (`cards[0]`, the hero). It is assigned first, and its
  neighbours avoid it.
- *Decision.* Cards are assigned by a bounded depth-first search (least-used card first, seeded), so no tile shows the
  same card as any of its 8 neighbours. Five or more distinct cards always solve; 4 usually do. `validate` names the
  clashing pairs per aspect when it can't: 3 cards give 13 pairs on 16:9, 7 on 9:16 and 6 on 1:1.
- *Decision.* `chips`, `chrome` and `drift` are not used in grid. Chips get a warning.

**type `words`.** One word per beat.
- **Size.** Each word is sized to a cap height of 24 % H on 16:9 (20 % of W on 9:16, 20 % of H on 1:1), then fitted to
  the safe width, never below 48 px. This fit is by design, so it does not raise the "copy shrunk" storyboard note.
- **Faces.** The default alternates bold sans and italic serif. `faces: sans | serif` picks one face; serif is italic.
- **Motion.** A word lands from 1.08 with 8 px of blur over 6 frames and holds with a 2.5 % push. Over its last 2.5
  frames it is pushed out (scale up, blur) into a hard swap.
- **Other fields.** `over` works as today and `through` zooms the last word through. `pill` and `text` are ignored,
  with a warning.

**stack `mode: exploded`.** 3–5 planes: the cards, or drawn layers (UI, a media gradient, a layout grid, a colour field,
a dotted base).
- **Separation.** The planes start flat and separate from frame 12, 3.5 frames apart, each over a 16-frame expo-out.
  `tilt: iso` (the default) uses rotateX 54° / rotateZ −38° at about 96 px apart. `tilt: low` is a ≤ 12° tilt, about
  92 px apart, up and to the right.
- **Depth.** Scale steps .95 and opacity runs 1 / .83 / .6 / .45 / .3, with a slow orbit and bob.
- **Labels.** At most 4 labels sit on leader lines that draw on over 12 frames, 4 apart. The chips line up in one
  column right of the stack and are spread so they never overlap.
- *Decision (layers).* Planes are **2D affine matrices**, an orthographic projection of the same rotations, not CSS 3D.
  With 3D-composited planes, the leaders and chips over them composited by overlap in the full frame but not in their
  `--layers` pass, and 34 of 96 frames failed the stack check. Now the worst stack error is 3 code values. The iso view
  needs no perspective; `tilt: low` loses only a hint of trapezoid.

**Motion grammar (SPEC rule 11).**
- **Entrances and exits.** Entrances take 15 frames on expo-out from .96 and 8 px blur. Exits are shorter (label
  push-out 6 vs 9 frames, word push-out 2.5).
- **Cascades.** Steps are 2–4 frames: rings 2.5, fan tiers 3, planes 3.5, leaders 4, grid rings ≤ 2.
- **Overshoot.** ≤ 8 %, and only on chips and pins, never on a headline, logo or hero card.
- **Arrivals.** Nothing important arrives by opacity alone: things grow, rise, push, draw on or are dealt.
- **Holds.** Every hold drifts: backdrop parallax, fan pull-back, orbits, map follow-pan, grid push, exploded orbit,
  word push.

**Speed.** `qa/motion-kit/runs/A-tools/timing.mjs` times `LV.seek` plus two rAFs in headless Chrome. The median is
33 ms for every shot, which is the two-vsync floor. The worst is 115 ms on `pr-send`, the first decode of a footage
frame. The films still took 6–14 min per aspect because about 5 other agents were rendering on this Mac at the same time.

## 3 · Commands and results

The tool is `node $S/video/lv.mjs`. All logs are in `qa/motion-kit/runs/`.

### 3.1 · `--grid` validation (`runs/A-grid-bad.log`, `A-grid-warn.log`, `A-grid-kitdev.log`)

- **`jobs/A-bad` (planted bad input).** Exits 2 with 34 one-line errors, for example:
  - `shots[0] (p1): press control must be one of button, key, toggle, send (got "lever")`
  - `press icon must be a built-in icon: mail, … sparkle (got "rocket")`
  - `fan count must be odd: 3, 5, 7 or 9 (got 4)`
  - `fan pick must be a card index 0–1 (got 7)`
  - `particles color must be a #RRGGBB hex (got "purple")`
  - `map stops must be a list of 2–6 stops … (got 1 stops)`
  - `wall layout must be one of float, grid (got "mosaic")`
  - `type words must be a list of word beats … (got "chaos")`
  - `stack count must be 3–5 planes in mode: exploded (got 7)`
  - `stack needs \`cards\`` (cycle mode, the old message)
- **`jobs/A-warn` (planted soft problems).** Exits 0 with 18 warnings, for example:
  - `press p1: text is 5 words — the press beat holds 1–3`
  - `particles q2: burstAt 58 is past the shot's frame 50`
  - `wall w1: layout grid shows the same card next to itself (13 pairs on 16x9, 7 pairs on 9x16, 6 pairs on 1x1) — give it ≥ 5 different cards`
  - `type t1: 4 word beats at 15.0 frames each — under 20 frames a word doesn't read`
  - `stack s1: 5 labels — exploded shows at most 4`
  - `wall cols only work with layout: grid`
- **`kit-dev`.** Compiles with no warnings.
- **`--blocks`** lists every new field and the layers of each mode (`runs/A-blocks.txt`).

### 3.2 · kit-dev

- **Storyboards.** `--storyboard --aspect all` is clean in all three aspects, with no warnings.
- **Films.** `--film --aspect A --workers 3` for each aspect (`runs/A-final-film-<aspect>.log`):

| Aspect | Result | Notes |
|---|---|---|
| 16x9 | **QA PASSED (20 checks)** | Hard cuts 2.19–178×, freeze none, content min 372 px, text 37 boxes none clipped or tiny, −14 LUFS / −1.6 dBTP, 64 cue onsets, whooshes on their cuts |
| 9x16 | **QA PASSED (20 checks)** | content min 379 px, text 35 boxes |
| 1x1 | **QA PASSED (20 checks)** | content min 256 px, text 37 boxes |

All three carry one INFO: 5 cues are buried in another sound's tail (fan pop at 2.57 s, map tick at 19.00 s, two in
exploded, one in exploded-low). This is a design hint, not a failure.

- **Layers.** `--layers <all 15 shots> --aspect 16x9` (`runs/A-final-layers.log`): **every shot passes every line**.
  `exploded-low` has no headline, so it has no text layer.

| Shot | Layers | Worst stack error |
|---|---|---|
| pr-gen, pr-key, pr-toggle | backdrop · control · label · rings · cursor · text | 0 px > 16, max 3–4 |
| pr-send | footage · backdrop · control · label · rings · cursor | 0 px > 16, max 3 |
| fan | text · cards · labels | **16 px > 16** (of 64 allowed), max 40; on its background 13 px, max 49 |
| sphere, burst, grid, terrain | particles · (orbits) · text | 0 px > 16, max 1–4 |
| map, map-dark | map · route · pins · labels · (text) | 0 px > 16, max 3–4 |
| wall-grid | tiles · lit · band · headline | 0 px > 16, max 4 |
| words | headline (a single element) | 0 |
| exploded, exploded-low | (text) · planes · leaders · labels | 0 px > 16, max 3 (8 on its background) |

- **Clip.** `--clips fan --alpha`: `PASS clip prores 1920×1080 yuva444p12le 108/108 frames`, `PASS content`,
  `PASS freeze`, written to `jobs/kit-dev/clips/kit-dev-fan-16x9-alpha.mov` (+ preview and SFX WAV).

### 3.3 · Old blocks untouched (`runs/A-old-compare.txt`)

I cloned film-sample and steady-sample with `cp -c` (beats.yaml, brief, assets only). The live tool rendered
`A-old-film-live` and `A-old-steady-live`; the staging tool, with the final code, rendered `A-old-film` and
`A-old-steady`. Each ran `--storyboard --aspect all`. I compared `out/main/<aspect>/board/NN-*.png` with `shasum`.
Steady-sample is 16:9 and 9:16 only.

| Job | Result |
|---|---|
| steady 16x9, 9x16 | 7 / 7 and 7 / 7 byte-identical |
| film 16x9, 9x16, 1x1 | 11 / 12 byte-identical each. Only `10-wall.png` differs: max 2 code values, 0 pixels > 2 |

**The wall difference is the engine, not this change.** Two runs of the *live* tool (`A-old-film-live` and
`A-old-film-live2`) also differ on that same still: max 2 code values, 18k–230k pixels at ≤ 2, in all three aspects. It
is raster noise on the blurred 3D tier cards of the default wall. The default layout's `build` code is byte-for-byte the
original; the diff in §1 shows only metadata lines, branched with their old expressions. Worker B's purity check
should expect ±2 on `wall`.

## 4 · Stills to look at

- **Per shot.** `qa/motion-kit/jobs/kit-dev/out/main/<aspect>/board/NN-<id>.png`, where `<aspect>` is 16x9, 9x16 or 1x1:

| Block or mode | Stills |
|---|---|
| press | `01-pr-gen`, `13-pr-key`, `14-pr-send`, `15-pr-toggle` |
| fan | `02-fan` |
| particles | `03-sphere`, `04-burst`, `05-grid`, `06-terrain` |
| map | `07-map`, `08-map-dark` |
| wall grid | `09-wall-grid` |
| type words | `10-words` |
| stack exploded | `11-exploded`, `12-exploded-low` |

- **Contact sheets.** `qa/motion-kit/runs/A-tools/final-board-16x9.png`, `final-board-9x16.png`, `final-board-1x1.png`.
- **Film sheets.** One frame every 0.5 s: `qa/motion-kit/runs/A-tools/film16-sheet.png` and `film916-sheet.png`.
  Motion strips per block are `m-press.png`, `m-fan.png`, `m-mapwall.png`, `m-wordsx.png` and `part2.png` in the same
  folder.
- **Films.** `qa/motion-kit/jobs/kit-dev/kit-dev-16x9.mp4`, `kit-dev-9x16.mp4`, `kit-dev-1x1.mp4`, and the storyboards
  `kit-dev-storyboard-<aspect>.png/.pdf` in the same folder.
- **Layers.** `qa/motion-kit/jobs/kit-dev/layers/kit-dev-<id>-16x9/`; each folder has a `…-layers.png` contact sheet.

## 5 · Open issues

1. **The fan's headline is on its own composited layer (`translate3d(0,0,0)` at rest).** SPEC rule 6 asks for
   `transform: none`. With `none`, frame 57 of the fan failed the stack check (206 px > 16), and so did a sub-pixel
   drift. The camera re-rastered the headline in the text pass but reused the previous frame's raster in the
   flattened reference. The glyph pixels are hash-identical to f56 in `ref-alpha` only. Keeping the headline always
   composited makes every pass treat it the same: it passes at 16 of 64 px. This is the only shot that relies on it.
   The lead may prefer a different engine-level fix.
2. **The default wall is not byte-stable run to run, in the live engine too** (≤ 2 code values; see §3.3).
3. **The footage cards are our own generated astronaut clips**, `manus2-space/assets/footage-graded/S{09,14,22,24}.mp4`
   copied as `kit-dev/assets/clips/space-*.mp4`. No logo or brand name is visible. They are fine for a local dev job,
   but should not go into a published sample.
4. **9:16 word beats are limited by width.** "Generate." is about 180 px in an 864 px safe width, small on a tall
   frame. A future option would be a two-line split for long words.
5. **9:16 `terrain` and `burst` fields are sparse in the lower half.** They are acceptable, but a denser portrait
   default would be better.
6. **Particle density.** `particles` with `mode: grid, spacing: 14` would draw about 10k dots per frame. It is not
   timed, so the default spacing of 34 is the safe range.
7. **The reading-time numbers in my `--grid` probes use the old ≈ 4 words/s rule.** Worker B is replacing it; press
   counts `text` + `label`, map counts `text` + stop labels.
8. **Disk.** `kit-dev/out` is 11 GB and `kit-dev/layers` 3.3 GB. Delete `out/*/*/frames` and `out/main/16x9/layers`
   once the lead has looked.
9. **Not done here (Worker B's scope).** Contrast, dead-air and purity runs on kit-dev. Expected risks: chips at
   30–36 px over footage (backed by solid pills), and the map headline over its scrim.

## 6 · GUIDE text I'd add (the lead writes the docs)

**Blocks table (new rows):**

| Block | What it is | Key fields |
|---|---|---|
| press | The key click, shot close: one control drawn big (button · key · toggle · send) over a soft depth-of-field UI. A big cursor arcs in, hovers and presses; rings and a glow burst from the control; the cut lands on the rings. | control, label, icon, text, after, at |
| fan | One → many: an odd number of clip cards dealt onto a concave 3D arc, the hero 1.28 × and in front; a slow pull-back, then a push into the hero for the cut. 9:16 shows 3 taller cards. | cards, count, pick, labels, text |
| particles | A seeded dot field: a sphere that assembles, turns and bursts at `burstAt`; a burst into a star field; a halftone grid with a travelling wave; a dot terrain flowing towards you. Optional orbits; a headline over a vignette. | mode, count, spacing, color, orbits, text, burstAt |
| map | An abstract city (no real geography). A route draws through 2–6 stops, pins drop with a pulse, label chips pop, and the camera follows the head. | stops [{pos, label}], text, theme |
| wall `layout: grid` | A flat mosaic of footage tiles cascading in from the centre. One tile is lit (the first card: accent stroke, ×1.12, glow); the rest dim to 35 %; a push into it; an optional headline on a band. | layout, cols, rows, pick |
| type `words` | Word beats: one word per beat filling the frame, bold sans and italic serif alternating, each pushed out into the next. | words, faces, every |
| stack `mode: exploded` | 3–5 planes (your cards, or drawn UI layers) separate along one diagonal (iso, or a low tilt), with up to 4 labels on leader lines. | mode, tilt, labels, text, cards (optional) |

**Which block for which moment (new rows):**

| Moment | Block |
|---|---|
| The press that ends a beat ("Generate", Enter, send) | `press` (`at` on the beat, `out: cut`) |
| One prompt → many outputs | `fan` (`pick` = the hero; cut close into it next) |
| Energy or scale, a "thinking" bridge, the drop | `particles` (sphere with `burstAt` on the drop) |
| Where, deliveries, a journey | `map` |
| Pick the winner from many | `wall` `layout: grid` (put the winner first in `cards`) |
| A manifesto in single words | `type` `words` |
| How it's built, the mechanism | `stack` `mode: exploded` |

**Layers line.**
- press `backdrop · control · label · rings · cursor · text`
- fan `cards · labels · text`
- particles `particles · orbits · text`
- map `map · route · pins · labels · text`
- wall grid `tiles · lit · band · headline`
- type words `over · headline` (baked)
- stack exploded `planes · leaders · labels · text`

**Field notes.**
- **press.** `at` defaults to 10 frames before the shot ends: the cut lands on the rings. Give a press shot ≥ 1.5 s
  (2–2.5 s reads best), and keep `text` to 1–3 words.
- **fan.** `count` is odd, 3–9. `pick` is the index in `cards` of the hero. Cards take footage (`cardsFrom`).
- **particles.** `burstAt` takes frames or seconds. The default colour is the accent on dark and ink on light, and
  `theme: dark` reads best.
- **map.** `stops` positions are fractions of the frame, shared by every aspect. Chips pick their side by themselves.
- **wall grid.** Give ≥ 5 different cards so no card sits next to itself; `--grid` names the clashes per aspect.
- **type words.** `every` is frames per word, and ≥ 20 reads.
- **stack exploded.** `tilt: iso | low`. With no `cards` it draws UI / media / layout / colour / base planes.

**Limits (additions).**
- **Exploded planes are orthographic.** Same look, no perspective trapezoid.
- **The fan is real CSS 3D.** Its layer stack passes with less margin (16 of 64 px); its headline stays on its own
  composited layer.
- **The map is abstract only.** Never real streets or tiles.
- **Particles are SVG paths.** Up to about 4k dots per frame.
- **Word beats use the same system serif as `type` `face: serif`.**

---

## Fix pass (round 1, after the monitor's report `reports/A-monitor-r1.md`)

📌 **Result.** Of the 20 findings, **16 are fixed, 3 partly fixed (#16, #17, #18) and 1 not fixed (#20)**.
- **Fixed.** All 3 HIGH, all 8 MEDIUM and 5 of the 9 LOW findings. The fan headline's share of #7 is still open;
  that is the same trade-off as #20.
- **Disagreements.** I did not adopt two suggestions: one word size per shot (#9), and 47 px chips on 16:9 (#17). The
  reasons are under those findings.
- **What I touched.** Only my own files under SPEC-R1: `engine/blocks/press.js`, `fan.js`, `particles.js`, `map.js`,
  `wall.js`, `type.js`, `stack.js`, `_motion.js` (one helper added) and `lib/spec.mjs`. A run of
  `shasum -c stage-r1-base.sha1` from inside `stageA/product-launch-sting` lists only the eight edited files plus
  `index.js` (the one comment line from round 1).
- **Where things are.**
  - The pre-fix code and kit-dev stills are in `runs/A-prefix/`.
  - Logs, probes and stills are in `runs/A-fix/`.
  - Tools are in `runs/A-tools/`: `contig.sh` (new), `anchors2.js`, `firstframes.py`, `chipsizes.py` and `frames.mjs`.
- **My probe jobs** (all `cp -c`):
  - `jobs/A-fix-stress`: the monitor's soft and failing inputs plus light-theme variants, in 3 aspects.
  - `jobs/A-fix-fail`: fan count 9 with labels, and the long press labels. Films in 3 aspects.
  - `jobs/A-fix-warn`: soft problems for `--grid`.
  - `jobs/A-fix-purity`: kit-dev at 16:9 only.
  - `jobs/A-fix-perf`: the monitor's stress shots.
  - `jobs/A-fix-grids/*`: input-only clones of all 16 original jobs.

### A rule I learned, which drives #7 (for the lead's GUIDE: layers and purity)

**Text that has landed must hold at `transform: none`.** Some text keeps a transform after its entrance: a sub-pixel
drift, an identity `translateY(0) scale(1.00000)`, a `translate3d(0,0,0)`, or a chip's `scale()` pop. That text renders
differently depending on which frames the page drew before. Two cases render the same whatever came before:
- text under a transform whose scale changes every frame (the word beats, at 300–400 px);
- text with no transform of its own under the moving camera.

Pops on small text now go through layout (`M.zoomAt`: CSS `zoom` about a point), not a transform.

**Proof.** `runs/A-tools/contig.sh JOB ASPECT OUT "shot:F …"` renders local frames 0 … F of a shot on one page, as
the film does. It renders F alone on a fresh page, as a purity re-render does, then diffs the two. On
`jobs/A-fix-purity` 16:9 (`runs/A-fix/contig1.log`; the chip rows are in `contig2.log`):

| Shot · frame | Before (monitor's bisect / purity log) | After |
|---|---|---|
| pr-gen 61 | 3098 px > 2, max 170, in the "One click." box | 0 px, max 0 |
| words 20, map 90, sphere 40, wall-grid 80, exploded 70, pr-send 71, pr-key 50, burst 40 | (purity log: diffs in every new block) | 0 px, max 0 each |
| map-dark 79, map 96 (chips mid-pop) | 1331 px max 110; 957 px max 238 | 0 px, max 0 (after the zoom pop) |
| fan 54 | 1765 px, max 58 | 791 px, max 58 (the headline; see #20) |

### Per finding

#### 1 · HIGH · press: a long label was cut off and covered by the cursor → **fixed**
- **How the label fits.** The label now decides the face's width.
  1. The face widens, up to 80 % of the frame.
  2. The label shrinks on one line, to 72 % of its size or the floor (48 px on 16:9, 40 px on 9:16 and 1:1).
  3. Button, key and toggle labels wrap to two balanced lines, down to the floor.
  4. Only then are words dropped from the end and the line closed with "…" (`send` stays on one line).
- **Cursor.** The click point comes from the measured box of both label states (see #5). It sits right of the label, or
  under it on the face's lower right when the label fills the face.
- **Validate.** `validate` estimates the fit per aspect and warns in one line:
  - `press pr-long: label "Generate a cinematic launch teaser for Friday" wraps to two lines on 16x9, 9x16, 1x1 — a press reads best with 1–3 words`
  - `press pr-send-long: label "…" is too long for the send — it is cut short with "…" on 16x9, 9x16, 1x1; keep it to 1–4 words`
- **Proof.** The `jobs/A-fix-fail` films, which hold the monitor's pr-long, give **`QA PASSED` in all three aspects, text `none clipped or tiny`** (16:9 14 boxes, 9:16 6, 1:1 8). On 1:1 the long label audits at 60.4 px on two lines. Before, the monitor's
  1:1 film gave `FAIL text clipped by the frame: pr-long "Generate a cinematic lau"`.
- **Stills.**
  - `runs/A-fix/press-16x9.png` and `press-9x16.png`.
  - The `pr-*` cards in `jobs/A-fix-stress/a-fix-stress-storyboard-{16x9,9x16,1x1}.png`. The storyboards have no clip notes.

#### 2 · HIGH · fan: with count 7 or 9 and labels, chips went off the frame → **fixed**
- **Drop.** A chip is dropped when its box would leave the box QA checks text in, at the landed pose and at either end of
  the sway. That box is the platform-UI-safe box on 9:16, and 7–93 % of the frame on 16:9 and 1:1 (QA's 5 % title-safe
  minus 2 % for the push). The decision is made once, in `build`, so a chip never blinks.
- **Hero chip.** On 16:9 and 1:1, with chips, the fan sits so that its foot chip ends above 93 % of H. On 9:16 the chip
  rides inside the card's foot.
- **Validate.** `validate` estimates where the outer tiers bleed: `fan fan9: count 9 — the outer cards bleed off the
  frame on 1x1; a label whose chip would leave the frame is dropped there (9:16 shows the middle 3)`. kit-dev's 5-card
  fan gets the same note for 1:1, where "Posts" is dropped.
- **Proof.** The A-fix-fail films above (fan9 with 9 labels).
- **Stills.**
  - `runs/A-fix/fan9-169.png`: all 9 chips.
  - `runs/A-fix/fan9-11b.png`: D, E and F on 1:1.
  - `runs/A-fix/fan916.png`: the hero chip inside the foot.

#### 3 · HIGH · exploded leaders pointed at the plane in front → **fixed**
- **How the anchor is chosen.** Once, at the landed pose:
  1. Sample points on three inset rings of the plane's own box (2.5, 4.5 and 7 % in) and project each one.
  2. Keep the points at least 10 px clear of every plane in front, by the signed distance to each projected quad.
  3. Take the right-most of them, nearest the plane's middle.
- **Every frame.** The chosen point is projected every frame, so it follows the orbit.
- **Proof.** `node jobs/mon-A-tools/probe.mjs jobs/kit-dev <aspect> <shot> 48,90 @runs/A-tools/anchors2.js` tests each
  dot with `elementsFromPoint`. Label k's top plane is now plane k for every label, in both shots, all 3 aspects, at the
  hero frame and 42 frames later:

  | Aspect | exploded (labels 0–3) | exploded-low (labels 0–3) |
  |---|---|---|
  | 16:9 | planes 0, 1, 2, 3 | planes 0, 1, 2, 3 |
  | 9:16 | planes 0, 1, 2, 3 | planes 0, 1, 2, 3 |
  | 1:1 | planes 0, 1, 2, 3 | planes 0, 1, 2, 3 |

  Before: 3 of 4 wrong on iso 16:9 and 9:16, and label 1 → plane 0 on exploded-low.

#### 4 · MEDIUM · map: the headline scrim washed out the route, pins and chips → **fixed**
- **Scrim.** The headline is laid out first. Its fade is now part of the map: it sits on the `map` layer, right after the
  city, under the route, pins and chips. It is sized to the line: 94 % land colour at the top, 80 % at the line's foot,
  gone 14 % of H below it.
- **Headline.** The line moves last in the tree, so it still paints on top on the `text` layer.
- **Chips.** They treat the headline's glyph box (plus 14–22 px) as taken. The follow-pan can't carry a chip that sits
  under or right of the line into it.
- **Validate.** `validate` warns when a stop's pin falls in the estimated headline zone of an aspect: `map m1: stop 1
  (Start) sits under the headline on 16x9, 9x16, 1x1 — move it lower or right, or drop the text`.
- **Proof.**
  - kit-dev `07-map.png` in every aspect: the Launch chip reads #111 on white.
  - A-fix-stress `map6` (the monitor's Two/Four case) is clean in all 3 aspects.
  - map and map-dark pass layer QA (the table below).

#### 5 · MEDIUM · press: with `after`, the cursor tip landed on the working-state label → **fixed**
- **How.** The click point uses the union of both labels' measured boxes, not the first label's width.
- **Proof.** `runs/A-fix/press-16x9.png`: in pr-gen frames 61, 66 and 68, and pr-long-after frame 70, the tip sits right
  of "Generating…" and of "Generating your teaser…".

#### 6 · MEDIUM · press: the hidden `after` label was audited as visible → **fixed**
- **How.** A label row outside the face is now `visibility: hidden`, not only clipped.
  - The working state shows only once it has started into the face (`t > state + 1`).
  - The first label hides once its exit ends.
  - Both switch on whole frames, so they are pure in t.
  - The visible state is `''` (inherit), never `'visible'`: an explicit `visible` overrode a `--layers` pass that hides
    the label layer. The final layer run caught this as a pr-gen stack FAIL; it is fixed and re-run (see the done
    criteria).
- **Proof.** `node jobs/mon-A-tools/probe.mjs jobs/A-fix-purity 16x9 pr-gen 59,60,61,62,66
  "window.LV.audit().map(b=>[b.text,Math.round(b.y0),Math.round(b.y1),+b.opacity.toFixed(2)])"`.
  - Frames 59–62 (the hero is 61) list only `Generate` and `One click.`.
  - `Generating…` first appears at 66, inside the face (y 634–735).

#### 7 · MEDIUM · purity: frames depended on the frames drawn before them → **fixed for every new block except the fan headline**
- **What changed.**
  - Every landed headline holds at `transform: none`: press, particles, map, wall grid, stack exploded, and the words'
    `over` line. The drift is gone; the camera's push keeps the frame moving.
  - The press label's hover lift moves its boxes by `top`.
  - Chip pops (map, fan, exploded) use `M.zoomAt` (CSS zoom), not `scale()`.
  - The press rings set every attribute on every frame (before, an invisible ring kept the last frame's geometry).
  - The press scale snaps to exactly `none` below 1e-3.
- **Proof.**
  - The contiguous-vs-fresh table above.
  - The monitor's purity probe on the new 16:9 film: `node jobs/mon-A-tools/purity.mjs jobs/kit-dev 16x9 <out> all <film
    frames>` (`runs/A-fix/purity-16x9.log`). **Results:**
    - **4 of 135 frames** differ from the film, all in the fan. Before: 47 of 135, across all 12 new-block shots.
    - The fan headline frames are 54 / 54.5 / 67.5 (max 58–59).
    - The fan's frame 0 (max 19, 786 px) is the 3D cards mid-deal, and it also differs between sorted and reversed fresh
      pages: composited 3D layers, the same engine-level cause as #20.
    - Every other sampled frame (press ×4, particles ×4, map ×2, wall grid, words, exploded ×2) matches the film at max ≤ 2.
    - The first run, before the zoom pops, still had map 94.5 / 96 (max 238) and map-dark 79 (max 110) on chips mid-pop
      (`runs/A-fix/purity-16x9-run1.log`).
- **Not fixed: the fan headline.** It keeps `translate3d(0,0,0)`. With `none` the fan fails its layer QA (#20), and a
  layer FAIL is worse than a purity WARN.

#### 8 · MEDIUM · 6 of the 7 new looks cut in on a nearly empty frame → **fixed**
- **How.** Every build is pre-rolled, so the cut lands about 60 % built and still moving:
  - fan deal −5 frames (the hero ~90 %, the first tier half-way);
  - particles assembly: sphere and burst −3, grid −6 (~70 % of the field), terrain −6;
  - wall grid tiles −5;
  - stack exploded: entrance −8, separation −5.
- **Proof.** `runs/A-fix/first-frames-16x9.png` (local frame 0 of all 15 shots from the new film) against the monitor's
  `jobs/mon-A-logs/stills/first-frames-16x9.png`.
- **Side effect.** The earlier landings put the first fan and exploded pops inside each shot's opening hit. Those pops
  are now left out, because the hit carries them (`t < 6`). The film's `sfx` INFO lists 8 buried cues (round 1: 5),
  mostly exploded's label ticks, 4 frames apart as before.

#### 9 · MEDIUM · word beats were small on 9:16 for long words → **fixed with a two-line break; one size per shot not adopted**
- **When a word breaks.** It breaks onto two lines with a hyphen when it had to shrink below 62 % of its target and the
  break makes it at least 20 % bigger. A word can also mark its own break: `Extra|ordinary.`.
- **Candidate breaks:**
  - the marked point;
  - a common prefix or suffix (extra-, super-, trans-, un-…; -able, -tion, -ment, -ness, -ing…);
  - syllable breaks (V|CV, VC|CV), never inside th, ch, sh, ph, ck, ng or qu.
- **How one is picked.** The biggest two-line size wins, but a prefix or suffix break wins when it is within 15 % of it.
  - `wordSplits('Unbelievable.')` → `Unbeliev-|able.`
  - `Extraordinary.` → `Extra-|ordinary.`
  - `Storytelling.` → `Story-|telling.`
  - Copy and reading time keep the plain word.
- **Validate.** It warns when a word can't reach half the size of a short word even on two lines:
  `type t2: "Supercalifragilisticexpialidocious." on 16x9 can't fill the frame (under half the size of a short word) — use
  a shorter word, or mark a break: Extra|ordinary.`
- **Not adopted: one size per shot.** "Each word fills the frame" is the look the spec asks for, and the break removes
  most of the jump.
- **Proof.** `runs/A-fix/words-916.png` shows "Unbeliev-/able." and "Extra-/ordinary." on 9:16, about 2× the one-line
  130 / 149 px. 16:9 keeps one line (`words-169.png`).

#### 10 · MEDIUM · exploded leaders ran past 120 px → **fixed**
- **How.** The chips still line up in one column. Each chip is pulled in to where its leader (both segments) stays
  ≤ 118 px, and inside the safe box.
- **Proof.** `probe.mjs … @jobs/mon-A-tools/leaders.js`. Max over the hero frame and frame 90:

  | Shot | 16:9 | 9:16 | 1:1 |
  |---|---|---|---|
  | exploded | 95 | 107 | 105 |
  | exploded-low | 118 | 105 | 118 |

  Before: up to 242.

#### 11 · MEDIUM · the light-theme wall grid dimmed by opacity into pastel → **fixed**
- **How.** The dim is now a flat overlay per tile:
  - on dark: the background colour (`C.dark`) at 65 % × dim, which is the old look;
  - on light: #0C0C10 at 58 % × dim.
  - The tile's opacity is used only for its entrance.
- **Proof.** The `wl` cards in `jobs/A-fix-stress/a-fix-stress-storyboard-*.png`. kit-dev's dark `09-wall-grid.png` reads
  as before.

#### 12 · LOW · gaps in bad-input validation → **fixed (all five)**
Proof: `node $S/lv.mjs --job jobs/mon-A-warn --grid` and `--job jobs/A-fix-warn --grid`. A-fix-warn is mon-A-warn without
the object label, plus 4 probes.
- **fan labels.** An object label is now an error: `fan labels[0] must be text, e.g. Clips (got {"x":1})`.
- **wall pick.** An off-grid pick warns per aspect, in one line: `wall w2: pick [9,9] is outside the grid on 16x9
  (6 × 4: lights [5, 3]), 9x16 (3 × 5: lights [2, 4]), 1x1 (4 × 4: lights [3, 3])`. The same goes for a wrapping index
  (`pick 40`).
- **wall duplicates.** Cards are de-duplicated by file plus `cardsFrom` before the assignment, so a repeated file never
  sits next to itself, and the clash warning counts distinct cards: `wall w1: 1 card is listed twice — layout grid uses
  4 different cards`.
- **Ignored fields:**
  - `type t1: face does nothing with words — use faces: alternate | sans | serif`
  - `particles count does nothing in mode grid — its density comes from spacing`
  - `particles spacing does nothing in mode sphere` / `burst`
- **Double error.** stack exploded `count: 1` now gives one error, because the cycle mode's 2–14 rule skips
  `mode: exploded`. mon-A-bad b8 → `stack count must be 3–5 planes in mode: exploded (got 1)`.

#### 13 · LOW · the declared layer order did not match the export → **fixed**
- **How.** The strings follow the tree order:
  - fan: `text · cards · labels`
  - stack exploded: `text · planes · leaders · labels`
  - map's scrim is now on `map`, so `map · route · pins · labels · text` holds.
- **Proof.** The "back to front:" lines in `runs/A-fix/layers-16x9.log`.

#### 14 · LOW · `read()` was missing on particles, type words and stack exploded → **fixed**
- **New exports.**
  - particles → `[text]`
  - type words → `over` plus the plain words
  - stack exploded → `[text]` (the plane labels are glanced, not read)
- **Old modes.** The cycle mode and type's text mode return `null`, so old timelines are unchanged.
- **Proof.** All 16 original jobs give the same `--grid` output on live and staging. Their `timeline.json` differs only
  by the lead's single `"delivery": "web"` line (`runs/A-fix/grids/`, 16/16 and 15/15).

#### 15 · LOW · the burst hero landed mid-headline → **fixed**
- **How.** With text, `hero = max(base, textAt + 15)`, capped at D − 8. kit-dev burst's hero is now frame 35, and the
  line lands at 34.

#### 16 · LOW · particles are SVG, not canvas, and the speed figure didn't measure painting → **partly fixed (documented, warned, measured; not made faster)**
- **Kept SVG.** The round-1 reason stands: a composited `<canvas>` raced Chrome's tile raster on shot switches and left
  an unpainted band.
- **New warnings.** `count` above 2000 warns, and so does `spacing` under 20 (`particles spacing 16 draws ~8k dots a
  frame on 16:9 …`). The hard cap stays at 4000.
- **Measured.** The monitor's `timing2.mjs` (seek + PNG screenshot, median of 16 half-frames), on `jobs/A-fix-perf`
  16:9, at load 11–13 with my film chain running beside it (`runs/A-fix/timing-16x9.log`):

  | Shot | seek + PNG, median | seek alone |
  |---|---|---|
  | headline (baseline) | 106 ms | — |
  | sphere 900 + orbits | 449 ms | 1.8 ms |
  | sphere 2000 | 448 ms | — |
  | sphere 4000 | 403 ms | — |
  | grid 34 | 215 ms | — |
  | grid 14 | 291 ms | — |
  | terrain 14 | 234 ms | — |
  | wall 12×12 | 596 ms | — |
  | fan 9 | 497 ms | — |
  | map 6 | 192 ms | — |
  | exploded 5 | 352 ms | — |
  | press | 191 ms | — |
  | words | 155 ms | — |

  The sphere's cost hardly moves with its count (900 → 2000 dots), so it is painting and PNG-encoding a busy frame, not
  the dot count. The new blocks are within the old footage blocks' 400–600 ms.
- **For the lead.** SPEC rule 12 ("well under 100 ms") is not met by any footage or particle block once painting is
  counted.
- **Text fix.** The count warning no longer claims a time: `particles count 3000 — above ~2000 dots the field reads no
  denser and only paints slower; 900–2000 is the useful range`.

#### 17 · LOW · chips and the 1:1 send label were under Worker B's floors → **partly fixed (the 16:9 floor is the lead's call)**
- **Raised.** Chips on 9:16 and 1:1 are now 40 px (fan, map, exploded). The 1:1 send bar uses the 9:16 size (.8 W ×
  .22), so its label is 53 px.
- **Kept: 16:9 chips at 34 px.** SPEC rule 5 asks labels ≥ 30 px, and B's `web` floor (47 px) would turn map and fan
  chips into oversized callouts.
- **Lead's call.** Either chips count as "labels ≥ 30" (B's check would need a label class), or 16:9 chips go to 47 px.
- **Sizes.** From the films' `audits.json` (`python3 -I runs/A-tools/chipsizes.py jobs/kit-dev <aspect>`):
  the chips measure 34.4–35.7 px on 16:9, and 40.4–41.8 px on 9:16 and 1:1. pr-send is 66.6 px on 16:9 and 53.3 px on
  9:16 and 1:1 (round 1: 44.5 px on 1:1).

#### 18 · LOW · 9:16 composition → **partly fixed (improved)**
- **fan.** The hero grows to 1120 px tall on 9:16 and runs down to the platform-UI line. Its chip sits inside the foot.
- **stack exploded.** On 9:16 the separated stack is measured, then centred in the room under the headline, down to the
  UI line.
- **Not changed.**
  - The bottom ~20 % of 9:16 stays clear. It is the platform-UI zone, where text never goes.
  - Plane size is bounded by the 48–96 px gap rule and the label column on the right.
- **Proof.** `jobs/kit-dev/kit-dev-storyboard-9x16.png`.

#### 19 · LOW · lines ran through headlines → **fixed**
- **press.** The rings grow 0.62 × as much vertically. With a line above the control, they also sit under a feathered
  mask over the line's glyph box (28 px padding, 16 px blur), so they fade out under the text.
- **sphere.** The orbit group has a feathered elliptical hole around the headline's glyphs.
- **Proof.** `runs/A-fix/press-16x9.png` (pr-gen frames 66 and 68) and kit-dev `03-sphere.png`.

#### 20 · LOW · the fan headline keeps `translate3d(0,0,0)` at rest → **not fixed**
- **What I tried.** `transform: none` again, after this pass's other changes:
  `node $S/lv.mjs --job jobs/A-fix-purity --layers fan --aspect 16x9` → `FAIL stack 1/108 frames … f57 209 px > 16
  (max 64)` (`runs/A-fix/layers-fan-none.log`). That is the same frame and size as in round 1.
- **Why it fails.** `runs/A-tools/whycomp.mjs` shows the chips over the 3D cards composite by overlap, and one squashes
  into a 1920 × 1080 layer. The headline's raster then depends on what each pass draws.
- **The trade-off.**
  - With `translate3d`, the layer QA passes.
  - But a purity re-render differs on the headline: fan 54, 791 px, max 58.
- **Lead's call.** This is an engine-level compositing interaction (3D cards plus overlapping chips). I reverted to
  `translate3d` and left the decision to the lead (with Worker B's purity tolerance).

### The done criteria, re-run on the final code
Two chains ran on the final code.
- **`runs/A-fix/chain.sh`** (log `chain.log`) did the storyboards, three films, purity, the 15 layer exports and the clip.
  Its layer run found one regression of this pass: the pr-gen stack FAIL (#6).
- **`runs/A-fix/chain2.sh`** (log `chain2.log`) ran after that fix and the count-warning text, which are the only code
  changes since chain 1. It re-did the steps those can touch, and its code-hash check says `code unchanged during
  chain2`. It shows that the fix changes no full frame: the kit-dev storyboard stills are byte-identical to chain 1's in
  44 of 45. The one exception is the 9:16 fan, max 2 code values on the blurred 3D cards; it is raster noise, and the fan
  doesn't use the fixed code.

- **`--grid`.**
  - kit-dev compiles with one note: the fan's 1:1 bleed warning (#2).
  - Bad input fails with one-line messages: 15 errors in `mon-A-bad`, 34 in `A-bad`, and 1 in `mon-A-warn` (the object
    label).
  - Soft input warns: 11 warnings in `A-fix-warn`, 16 in `A-warn`. `A-warn`'s two "tight" notes from round 1 are gone,
    because the pre-rolls shortened the fan and exploded schedules.
- **Storyboards.** `--storyboard --aspect all` exit 0, with no notes beyond that grid warning. Sheets:
  `jobs/kit-dev/kit-dev-storyboard-{16x9,9x16,1x1}.png`.
- **Films.** `--film --aspect <a> --workers 3`:

  | Aspect | Result |
  |---|---|
  | 16x9 | **QA PASSED (20 checks)**. 36 text boxes, none clipped or tiny; content min 523 px; freeze none; 59 cue onsets on their frames; INFO: 8 buried cues |
  | 9x16 | **QA PASSED (20 checks)**. 32 text boxes; content min 434 px |
  | 1x1 | **QA PASSED (20 checks)**. 35 text boxes; content min 411 px |

- **Layers.** `--layers <all 15 shots> --aspect 16x9`: 14 of 15 pass every line in chain 1 (`runs/A-fix/layers-16x9.log`).
  pr-gen passes after the fix (`runs/A-fix/layers-prgen-2.log`: 7 PASS, `stack … worst f66: 0 px > 16, max diff 5`).

  | Shot | Worst stack error |
  |---|---|
  | fan | 15 px > 16, max 48 (limit 64; the translate3d headline) |
  | pr-gen, pr-key, pr-send, pr-toggle, sphere, burst, grid, terrain, map, map-dark, wall-grid, words, exploded, exploded-low | 0 px > 16, max 0–5 |
- **Clip.** `--clips fan --alpha` gives `PASS clip prores 1920×1080 yuva444p12le 108/108 frames`, `PASS content`, `PASS freeze` (`runs/A-fix/clips.log`).
- **Old samples.** The storyboard stills of `A-old-film` and `A-old-steady`, staging (final code) against live, are
  byte-identical in 35 of 37. The other 2 are film-sample's default `10-wall.png` on 16:9 and 9:16 (6 and 2 px > 2,
  max 3). Two live runs differ from each other on that still by the same amount, as in round 1.
- **Old jobs' `--grid`.** All 16 original jobs give identical `--grid` output on live and staging
  (`runs/A-fix/grids/*.live|.stage`). Their `timeline.json` differs only by the lead's `"delivery": "web"` line.

### GUIDE text to add (on top of round 1's)
- **Layers / purity trap.** "Text that has landed holds at `transform: none`. Pop small text by layout (`M.zoomAt`),
  not `scale()`. A held or translation-only transform on text, even `translate3d(0,0,0)`, makes the frame depend on the
  frames drawn before it." The fan headline is the one exception (layer QA).
- **press.** A long label widens the button (to 80 % of the frame), then shrinks, then wraps to two lines, then is cut
  with "…". `--grid` says which. 1–3 words read best.
- **fan.** A chip whose card bleeds off the frame is dropped. On 9:16 the chip rides inside the card's foot.
- **map.** Keep stops out of the headline's top-left zone; `--grid` warns. Chips keep clear of the line by themselves.
- **wall grid.** A file listed twice counts once. On a light theme the dimmed tiles darken; they don't fade.
- **type words.** A long word breaks onto two lines with a hyphen at a prefix, suffix or syllable. Mark your own
  break with `|`: `Extra|ordinary.`.
- **particles (Limits).** Painted as SVG paths (a canvas raced Chrome's tile raster). A sphere frame costs ~0.45 s with
  its PNG; 900–2000 dots reads best.

### Open issues after the fix pass
1. **#20 and the fan's part of #7.** The fan headline (engine-level compositing; the lead and B decide the purity
   tolerance).
2. **#17.** The 16:9 chip floor: SPEC rule 5 or B's `web` floor.
3. **#16.** Particle and footage frames cost 200–600 ms with their PNG; SPEC rule 12 can't be met as worded.
4. **Disk.** The disk was at 98 % (12 GB free), so I deleted my own intermediates: kit-dev's 9:16 / 1:1 film frames,
   its 16:9 layer passes (6.3 GB), my scratch purity renders, and the probe jobs' frames. I kept
   `jobs/kit-dev/out/main/16x9/frames` (1.7 GB, for the next purity check), the films and `jobs/kit-dev/layers/`
   (3 GB of exports). Delete those once the lead has looked.
