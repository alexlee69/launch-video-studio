# Round 1 build spec: the motion kit + frame checks (2026-10-26, approved by Alex)

Source plan: `qa/video-skill-learnings/TAKE-AND-HOW-2026-10-26.md` (read §3 "Round 1"). Research behind the numbers:
`qa/video-skill-learnings/readers/*.md` (paraphrased reports of three Higgsfield skills — never copy their code, never
run anything under `qa/video-skill-learnings/skills/`) and `reels/reels.json` (four reels we measured).

## Where to work

- **Staging copy of the skill:** `/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit/stage/product-launch-sting/`
  (call it `$S`; the video tool is `$S/video/lv.mjs`). Edit ONLY the staging copy.
- **Never touch:** the live skill `~/.claude/skills/product-launch-sting/`, the rollback copy `qa/motion-kit/live-before/`,
  and the original jobs in `~/Downloads/launch-videos/*` (read them; copy what you need with `cp -c` into
  `qa/motion-kit/jobs/`). No git commits, no pushes, no paid API calls (no fal, no OpenAI), no `--go` on any generator.
- **Run the staging tool:** `node $S/video/lv.mjs --job <job> --grid | --storyboard --aspect all | --film --aspect all |
  --layers <ids> --aspect 16x9 | --clips <id> --alpha | --qa`. `--blocks` prints the block catalogue.
- Long renders: run them in the background or with generous timeouts; a 20 s film × 3 aspects takes a few minutes.
  Keep `--workers` at 3 so two agents can render side by side on this 12-core Mac.
- Read first: `$S/video/GUIDE.md` (blocks, beats.yaml, QA, Limits), `$S/video/engine/runtime.js` (ctx API, camera,
  layers, audit), `$S/video/engine/blocks/_film.js` + `stack.js` + `wall.js` + `type.js` (house style for film blocks),
  `$S/video/lib/qa.mjs`, `lib/render.mjs`, `lib/timeline.mjs`, `lib/spec.mjs`, `lv.mjs`. The Chrome compositing traps that
  bite layer exports are in `/Users/bytedance/.claude/projects/-Users-bytedance-Downloads-Design-AutoPilot/memory/reference_chrome_layer_separation_traps.md`.

## File ownership (two workers run at the same time)

| Owner | Files |
|---|---|
| **Worker A — blocks** | new `engine/blocks/press.js`, `fan.js`, `particles.js`, `map.js` (stubs exist; replace them), optional new helper `engine/blocks/_motion.js`; edits to `engine/blocks/wall.js` (grid mode), `type.js` (word beats), `stack.js` (exploded mode); `engine/blocks/index.js`; `lib/spec.mjs` (validation of the new blocks/fields only) |
| **Worker B — frame checks** | `lib/qa.mjs`, `lib/timeline.mjs` (reading time only), `lib/render.mjs`, `lv.mjs`, `engine/runtime.js` (only: a text-hiding switch + audit data for the contrast check), `lib/board.mjs` (storyboard notes only) |
| Lead (already done) | `lib/spec.mjs`: `delivery:` field; `lib/timeline.mjs`: `tl.delivery`; registry + stubs. Docs (GUIDE.md, templates) come later — note what you'd document in your report |

Nobody else edits `engine/kit.js`, `engine/art.js`, `engine/ui.js` or any other block in round 1.

## Rules for every change

1. **Old jobs render byte-identical.** Every existing block, field and default keeps its exact output. New behaviour is
   opt-in through new fields/values. (Engine fingerprints change with any engine edit; that's expected — re-render.)
2. **Pure frames.** `render(t, D)` is a pure function of `t` (half frames happen): no `Math.random`, `Date`, rAF, CSS
   transitions/animations, or state that depends on the order frames are drawn. Seed with `F.rng(F.hash(...))`.
3. **Never still.** Something moves every frame (QA `freeze` fails 4 identical frames).
4. **Every aspect is laid out, not cropped:** 16x9 (1920×1080), 9x16 (1080×1920, keep text inside `ctx.safe`, the
   platform-UI-safe box), 1x1. Sizes scale with `u` (= short side / 1080).
5. **Must-read text sizes** (the effective size on screen): headline ≥ 64 px on 16:9 (the new `web` floor is ~47 px
   mixed case, `feed` 64 px), ≥ 48 px on 9:16 / 1:1. Labels a viewer must read ≥ 30 px. UI texture (chips inside a mock,
   tags) may be `.lv-ui` (exempt from size checks) only when it isn't the message.
6. **Layers:** tag every element (`ctx.el(html, css, 'name')`, `ctx.text(copy, {layer})`, `ctx.layer(el, name)`), list
   them in the block's `layers:` string, back to front. `lv.mjs --layers <shot>` must pass its QA for every new block/mode
   (3D CSS transforms pass with less margin; `transform: none` at rest, not an identity matrix — see the traps note).
7. **Copy:** export `copy(shot)` (every readable line) and `read(shot)` (what the reading-time check counts).
8. **Cues:** sound cues from `cues(shot, D)` with kinds pop/tick/click/chime/hit on the frames things land/click.
9. **Hero frame:** `hero(shot, D)` = the frame that best shows the shot (never inside the last 7 frames).
10. **Footage:** card/tile fields take images or clips — declare them in `media:` and use `F.media(...)` as stack/wall do.
11. **Motion grammar** (measured on four Higgsfield reels + the handbook): moves ~0.4 s; entrances 0.4–0.6 s on expo-out
    from scale 0.96 and 8 px blur (`K.outExpo`), exits 50–100 ms shorter than entrances; cascades stagger 2–4 frames
    (30-fps units); overshoot (`K.outBack`, ≤ 6–10 %) only on chips, pills, stickers — never on a headline, logo or hero;
    nothing important appears by opacity alone (it is carried, grown, wiped, pushed, revealed); a slow camera drift in holds.
12. **Speed**: a frame should render in well under 100 ms; use one `<canvas>` for anything with hundreds of elements.
13. **No real brands** in defaults or samples (no Higgsfield/OpenAI names, logos, lime #D1FE17 look).

## Worker A — the blocks

Shared expectations: each block gets `doc`, `params` (every field with a one-line description), `required`, `validate`
(warnings), `cues`, `hero`, `copy`/`read`, `layers`, `media`. Add field validation in `lib/spec.mjs` (`ENUMS`, list checks,
`at`-style fields) the way stack/wall/agent are validated. Bad input must fail `--grid` with a clear one-line message.

### press — the key click, shot close (the "generate press" beat)
- One control drawn big: `control: button (default) | key | toggle | send`, `label` (button text, e.g. "Generate"),
  optional `icon` (built-in icon name), optional `text` (a 1–3 word line above/beside it, must-read), `theme` aware.
  The control fills 36–80 % of the frame width (macro, 1.4–4.6× a normal UI size), cropped on ≤ 2 sides is fine, with
  soft depth-of-field background (blurred UI shapes / brand grid) — never an empty field.
- A large cursor (128–176 px at 1920 wide, scale with `u`; reuse the arrow from `engine/ui.js` pointer markup, redrawn,
  not imported) enters from off-frame on a curved path (arc 5–15 % of the chord, bell-shaped speed, 0.5–0.9 s), dwells
  150–250 ms on the button (hover state: the button lifts/brightens), presses: cursor scales to 0.85, button to 0.94 for
  ~100 ms, releases over ~220 ms; the click lands on the arrow TIP and never covers the label.
- On press: 3–4 rings expand from the button (to ~1.9× the button width, 400–500 ms, fading), a glow ≥ 10 frames, the
  label may switch to a working state (`after: "Generating…"` with the spark spinner from `_film.js`).
- `at:` = local frame of the press (default: so the press lands ~8 frames before the shot ends — the cut lands on the
  rings' peak). Cues: tick on hover arrival, click on the press, pop on the rings.
- Hero = the press frame + 3. Layers: `backdrop · control · label · rings · cursor · text`.

### fan — one → many: a fan of clip cards
- `cards` (images/clips, like stack), `count` (odd, 3–9, default 5 or the number of cards if odd), `pick` (index of the
  hero card, default centre), optional `labels` (chip per card, e.g. "Clips", "Stills"), optional `text` (headline).
- Cards sit on an arc (concave fan, like a hand of cards), real CSS 3D (rotateY by the arc angle, shared perspective),
  hero card 1.25–1.3× and in front; tiers step ×0.72–0.89 outward; each card a rounded media frame (radius ≈ 4.5 % of its
  short side), soft shadow.
- Motion: cards deal out from the hero's centre (grow from a point: scale 0.06→1 on arcs, centre first, sides +2–4
  frames each), a slow pull-back/drift during the hold (≤ 1.03 scale change per second), then over the last ~10 frames
  a push toward the picked card (scale up ×1.15–1.3 about it, others fan out) so the next shot can cut in close.
- 9:16 gets fewer, taller cards (3 visible, hero 468×832-ish at 1080×1920, sides ±300 px bleeding off-frame).
- Cues: pop per card landing (stagger), hit at start. Layers: `cards · labels · text`.

### particles — a seeded dot field
- `mode: sphere (default) | burst | grid | terrain`. `count` (default ~900 sphere/burst, a grid by spacing), `color`
  (default brand accent on dark, ink-ish on light), optional `orbits: true` (2–3 thin orbit ellipses around a sphere),
  optional `text` (headline over a soft vignette), `burstAt` (sphere: local frame it bursts; burst mode bursts early).
- sphere: points on a Fibonacci sphere, slowly rotating (3D projected, depth → size and alpha), breathing; `burst`: the
  dots fly outward on an expo-out with slight swirl, trails/streaks (draw short lines along velocity), then drift.
  grid: a halftone dot grid with a travelling wave of size/brightness. terrain: a perspective plane of dots with sine
  height waves flowing toward the camera.
- One `<canvas>` sized to the stage (DPR-aware like other elements: the stage renders at deviceScaleFactor 1 except
  bgref thumbnails at .25 — canvas must still render correctly at dpr .25 for the content check).
- Pure in t (positions are closed-form functions of t and the seed). Cues: hit at start, a hit at the burst.
- Layers: `particles · orbits · text`.

### map — a map that draws its route
- An abstract, generated map (no real geography): a stylised city or region from the seed — land/water areas, a park,
  block/street lines in the brand's line colour, light theme by default, dark with `theme: dark`.
- `stops: [{pos: [x, y], label}]` (2–6 stops, fractions of the frame; default a pleasing 3-stop route), the route is a
  smooth curve through them drawn on with an animated stroke (dash offset), pins drop at each stop on arrival
  (pin pop with ≤ 8 % overshoot, a pulse ring), a travelling dot/head at the route's tip, `label` chips by each pin,
  optional `text` headline. The camera inside the block follows the route head slightly (pan ≤ 6 % of the frame).
- Cues: pop per pin, tick while drawing (sparse). Layers: `map · route · pins · labels · text`.

### wall — `layout: grid` (new mode; the default layout stays exactly as it is)
- A flat mosaic of footage tiles (cols × rows by aspect, e.g. 6×4 on 16:9, 3×5 on 9:16, 4×4 on 1:1; `cols`/`rows`
  override), gutter 4–16 px, small radius, one tile lit (`pick`, default nearest the centre): 3–4 px accent stroke,
  scale 1.04–1.175, a soft accent glow; the others dim to ~35 % after the lit tile lands.
- Tiles cascade in by distance from the centre (stagger 1–2 frames per ring), then a slow push toward the lit tile.
  Optional `text` headline over a dimmed band. `chips` behave as today only in the default layout (ignore or reuse).
- Assignment of `cards` to tiles avoids the same clip next to itself (incl. diagonals) whenever the card count allows
  (≥ 5 distinct cards); `validate` warns when it can't (any aspect).

### type — word beats (new; `text` mode unchanged)
- `words: [Generate., chaos., loud., Animate.]` → one word per beat, each with its full stop, alternating faces:
  `faces: alternate (default: bold sans, then italic serif, …) | sans | serif`. Each word fills the frame centre big
  (≈ 20–28 % of H cap height on 16:9), lands with scale 1.08→1 + blur 8→0 over ~6 frames, holds, and is replaced
  (hard swap or a 2–3 frame push out) by the next; `every:` frames per word (default D / n, ≥ 20 frames each, warn
  otherwise). Optional `over` line stays as today. `text` OR `words` is required (lead added the spec check).
- Cues: a hit per word. Hero = mid-way through the last word.

### stack — `mode: exploded` (new; the default cycle mode unchanged)
- 3–5 planes (`cards` as plane images, or none → drawn UI-skeleton planes), stacked flat at first, then separating along
  one diagonal (isometric ~30°, or a ≤ 12° tilt with `tilt: low`), 48–96 px apart, scale step 0.92–0.96, opacity by
  depth 1 / .83 / .6 / .45 / .3, staggered 3–4 frames; `labels` (one per plane, ≤ 4 shown) on leader lines (≤ 120 px,
  drawn on over 0.4 s, staggered 4 frames); optional `text` headline. A slow orbit/drift keeps it alive.
- Layers: `planes · leaders · labels · text`.

## Worker B — the frame checks (WARN first; never loosen an existing check)

New QA lines must be WARN or INFO (never FAIL) in round 1; existing PASS/FAIL logic must not change. Each check
records its numbers in `qa.json`. Prove every check BOTH ways: PASS (or silent) on good input, WARN on a planted bad job.

- **Dead air** (`deadair`, WARN). From the film frames: grey frames at 1/10 scale (the content check's `thumbs()`),
  a 12 × 12 grid of blocks, activity(k) = the largest block's mean |Δ| between frame k and k−2 (1/30 s). Dead air = a
  run where activity < 8 (of 255) lasting longer than the allowance: max(0.6 s, the reading hold of the shot's read copy
  — see reading time) — whole runs inside declared `hold:` ranges are excluded, runs across a cut are split at the cut.
  Report the shot, start time and length of each run. Calibrate: run it on clones of film-sample, steady-sample,
  reel-sample, edge-test, dark-ui-check; report what fires and whether those are real stalls (look at the frames).
- **Readable text** (`text`, extra WARN lines). The audit's `px` is already the size on screen (it includes the
  camera's scale). New beats.yaml field `delivery: web (default) | feed | tv` (lead added it to spec; `tl.delivery`).
  Floors for must-read (non-`.lv-ui`) text, mixed case / all caps: web 16:9 47/35, 9:16 & 1:1 40/36; feed 16:9 64/48,
  9:16 & 1:1 40/36; tv 16:9 27/21, others as web. Keep the existing < 18 FAIL and < 26 WARN exactly.
- **Contrast** (`contrast`, WARN). At each audited (hero) frame, also screenshot the frame with every glyph invisible
  but every box/pill/background kept (a runtime switch, e.g. `LV.hideText(true|false)`: `color` /
  `-webkit-text-fill-color: transparent`, no text-shadow/stroke; elements whose text is painted by
  `background-clip: text` are hidden). Save those frames (e.g. `out/<cut>/<aspect>/textless/`), and in QA compute per
  must-read text box: core glyph pixels (differing from the textless frame by ≥ 60 % of the box's max difference), text
  colour = their median in the real frame, contrast per core pixel against the textless pixel, worst = 2nd percentile.
  WARN when WCAG < 4.5:1 (< 3:1 for text ≥ 48 px) or APCA |Lc| < 60 (< 45 for ≥ 48 px). Outlined/stroked text: report as
  INFO ("outlined: check by eye"). The textless frames must not change the real frames (render them after, on the same
  page, then switch back; prove frames are byte-identical with and without the feature).
- **Flash safety** (`flash`, WARN). WCAG 2.3.1 general flash: relative-luminance changes ≥ 0.1 where the darker state is
  < 0.8, over any region of ≥ 25 % of a 10° field (use overlapping windows ≈ W/3 × H/3 on the thumbnails); a flash = a
  pair of opposing changes; WARN when any 1-second window holds more than 3 flashes. Report times.
- **Reading time** (`--grid` warning, `lib/timeline.mjs`). Replace the ≈4 words/s rule with: need = 0.4 s (assembly)
  + max(1.0, (0.35 × words + 0.5) × k) s, k = 1.3 when the shot's `bg` is footage (a video file) and its bgDim < .25,
  else 1. Scripts without spaces: count Han/kana characters at 6.75 per second and Hangul at 9 instead of words. Keep the
  warning's wording style; say the numbers.
- **Purity** (`purity`, WARN). After `--film` renders an aspect, re-render 24 frames chosen by a seed from the timeline
  (spread over every shot, incl. first/last frames of shots and inside holds) in SHUFFLED order on one fresh page, and
  compare each with the film's frame (tolerance: max |Δ| ≤ 2 per channel, or ≤ 0.01 % of pixels above it — calibrate on
  old jobs, report the actual numbers). Write `purity.json`; QA reports it (so `--qa` re-runs work). A WARN names the
  frames and shots that differ.
- Storyboard (`lv.mjs --storyboard`) prints the new readable-text notes too (not contrast/dead-air: no frames).
- Prove: every old job's frames are byte-identical between the live engine and the staging engine (compare the
  storyboard hero PNGs `out/main/<aspect>/board/*.png` and a `--film --range` slice) — your runtime switch must be
  invisible when off.

## Done means

- `--blocks` lists the new blocks/modes with every field. `--grid` validates bad input with clear messages.
- A dev job `qa/motion-kit/jobs/kit-dev/` (Worker A) with every new block and mode, 3 aspects, footage cards (copy a few
  stills/clips from `~/Downloads/launch-videos/film-sample/assets` or other jobs): `--storyboard --aspect all` clean,
  `--film --aspect all` → `QA PASSED` for every aspect, `--layers <every new shot> --aspect 16x9` passes layer QA,
  `--clips <one> --alpha` passes.
- Worker B: every new check proven both ways on planted jobs under `qa/motion-kit/jobs/probe-*`; old jobs still
  `QA PASSED` with only the new WARN/INFO lines; byte-identical proof.
- A report (`qa/motion-kit/reports/<worker>-r1.md`) with: what changed (file by file), the commands run and their
  results (paste the QA summary lines), contact sheets/stills paths for the lead to look at, open issues, and the GUIDE
  text you'd add (lead writes the docs).
