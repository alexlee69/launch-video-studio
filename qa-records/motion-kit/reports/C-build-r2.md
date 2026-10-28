# Worker C — round 2 build: the engine transitions (2026-10-26, overnight)

Staging copy: `qa/motion-kit/stageC/product-launch-sting` (`$S`). Built SPEC-R2 §1–6 — carry, morph, dive, grow from a
point (`from:` on float / stack / wall + a one-line helper), flood, transition lint — plus `cam.carry` in `LV.camera()`
for Worker D. Everything is opt-in: a timeline without the new fields never reaches the new code (no extra layer, no
extra seeks), and old jobs render byte-identical with the live engine (one known exception, the wall hero, which is
nondeterministic run-to-run in the live engine too — numbers below). No commits, no paid calls, nothing under
`qa/video-skill-learnings/skills/` run, the live skill and every original job untouched (clones only, under `jobs/`).

**Result:** the dev job `jobs/r2-dev/` (10 shots, 21.3 s, every device, 16x9 + 9x16 + 1x1) → `QA PASSED` on all three
aspects (16 PASS checks each, the four dive/flood/zoom-in cuts INFO as moving transitions). Purity: frames are a pure function of f — a shuffled and a time-ordered re-render of the same 30 transition
frames agree byte for byte except the wall's raster noise (§ Purity, incl. one Chrome raster-history effect I could not
remove). `--clips` / `--layers` of the carry shots and of the three
`from:` shots pass (clean mode = no carry).

## What changed, file by file (diff vs `qa/motion-kit/base`)

| File | ± lines | What |
|---|---|---|
| `video/engine/runtime.js` | +369 −8 | the carry layer, morph, dive camera, `ctx.origin` / `ctx.carried`, flood overlay, `cam.carry`, `LV.crossCuts()` |
| `video/engine/kit.js` | +48 −1 | `DIVE_LEN`, `exitLen` for dive/flood, `XFX.flood`, `bezier()` + `smooth` / `needle` / `soft`, `grow()` + `growAt()` (the from: helper), `carryPlan()`, `originOf()` |
| `video/lib/spec.mjs` | +74 −3 | `dive`, `flood` in TRANSITIONS; validation of `carry`, `dive`, `flood`, `from`, `cause`; top-level `signature`; float's `from` moved out of ENUMS (still accepts left/right) |
| `video/lib/timeline.mjs` | +62 −3 | carry/dive/flood/from checks (errors + warnings), hero frame kept before a carry, the transition lint, `tl.signature` |
| `video/lib/fingerprint.mjs` | +9 −2 | `cause` is not pixels; a cross-cut links the two shots' prints (see below — not in my R2 file list, but the spec asks for the not-pixels change and it lives here) |
| `video/engine/blocks/float.js` | +20 −6 | `origin: true`, the grow entrance, `ctx.carried` (a card a carry lands on doesn't fly in) |
| `video/engine/blocks/stack.js` | +14 −3 | `origin: true`, the grow entrance (front card first; the cycle waits for it: t0 18 instead of 6) |
| `video/engine/blocks/wall.js` | +16 −7 | `origin: true`, the grow entrance (nearest the origin first; chips +12) |

### `engine/runtime.js`
- **New section** (before `seek`): helpers (`rootsOf` — a layer name's root elements; `visualRect` — what they paint on
  screen, clipped by their own `overflow` ancestors; `ghostOf` — a copy of the roots inside shallow copies of their
  ancestors (shot, camera, wrappers) so every transform/perspective/inherited style is exact, camera blur off, ids
  renamed, layer tags stripped, the content's 3W×3H border dropped; `boxOf` — a morph box's rect/radius/colour/shadow from
  the element or its first painting descendant; `lookKey` — same pictures + text?), `carryPrep`, `carryRect`, `cusp`,
  `peakOn`, `placed`, `carryAt`, `diveCam`, `cutPrep`, `originFor`, `floodHTML`.
- **Hooks in existing code** (small, local): `exitFor('flood')` = `{s: .04}`; `enterFor('dive')` = `{s: 0}`; `cameraAt`
  calls `diveCam` when `cam.dive`; `engineVis` shows/hides `CARRY`; build loop: `cutPrep(i)` at the top, a dive
  entrance's background reaching past the frame (whole grid tiles, phase kept) + the shot's own colour behind it, a
  `lv-dive` blur wrapper around the camera of dive shots, `taken.add('carry')`, `ctx.origin` / `ctx.carried` before
  `block.build`, the `carry` layer in the layer list, `camSpec.dive = {in}`; after the loop `carryPrep()` (before
  OVL/LBOX, so CARRY sits above the shots and below the overlay and bars); `buildFoot`: footage SVG `overflow: visible`
  + an oversized scrim under a dive entrance, a counter-scale prefix on the plate transform; `seek`: velocity blur of a
  dive from the camera without its pivot shift, a dive's blur on the screen-space wrapper, the footage counter-scale,
  flood drawn after the block (it reads the block's text), then `carryAt`; `LV.crossCuts()` (diagnostics);
  `tagLayer`'s message knows `carry`.

### How each device works (and the decisions I made)
1. **Carry** (`carry: {el, to, ease, pre, post, lift, arc}` on the outgoing shot). Window: the element leaves at
   `cut − pre − ½` and lands at `cut + post` (smooth 8/14, needle 6/6). At build, `carryPrep` seeks: the leave frame
   (A's rect R0), A's last frame (A's look + rect, memoised copy), the landing frame (B's `to` rect R1 with B's camera
   then, B's opacity, B's look). Per frame: before the cut the copy is taken from A's DOM *at that frame* (its own
   animation keeps playing), after the cut it is A's last-frame copy; it is drawn on `CARRY` at a screen-space path —
   centre on an arc (`arc` × chord, bowing up), size log-interpolated (uniform scale: a carry is the same object),
   ×`lift` up over 3 frames and down by landing with a drop shadow. A's element is hidden from the leave frame, B's
   until landing (`data-lv-carried` + one `visibility: hidden !important` rule; every frame first clears the shot's
   flags, so it's pure). **Hand-over:** when A's and B's elements show the same pictures and text (`lookKey`) the copy
   simply becomes the real element at landing (a crossfade of two identical things showed a faint double edge from the
   float's bob rotation); otherwise a 4-frame crossfade while the copy tracks B's live rect. **Speed on the cut:** the
   easing is re-timed (`peakOn`: τ → τ^p, p by bisection) so its fastest frame is the cut for any pre/post — measured,
   the fastest size and move step is the one touching the cut on every carry (§ Continuity numbers).
   `ease: needle` = bezier(.95,0,.05,1) on size and position, lift 1, ±6 frames: the peak step is on the cut
   (+0.024 ln-size, neighbours +0.007).
   Errors at build (one line, the render fails): unknown layer in A or B, B's element < 90 % visible at landing
   ("land later with post: N or carry another element"). `carry` on the last shot fails at `--grid`.
2. **Morph** (`mode: morph`). One box (a div: left/top/width/height — size, never scale — radius, colour, first box
   shadow) from A's box to B's box, log size, colour leading the size a little; the two contents (A's at the leave
   frame, B's at landing, each fitted inside, the painting box stripped from the copies) crossfade through a ~6 px blur
   half-way. **Interpretation:** the spec's "A grows ~+18 % into the cut, B starts ~−18 %" is the reference's two-box cut;
   I built one continuous box on a cusp — in(3) into the cut, out(3) after, joint at `cut − ¼` (half-way between the two
   60-fps frames around the cut) — so the box never jumps and the relative speed (dH/dt)/H is the same on both sides
   (measured ratio 1.00, within 0.97–1.03). If you want the literal ±18 % two-box version it's a small change in
   `carryAt`. `to: frame`: radius → 0, colour → the next shot's background (or `color:`), log size on in(2) so it fills
   the frame exactly on the cut (the box blooms white first: colour on smoothstep(.25, .95)), then fades over `post` (3)
   frames over the next shot. `cam.carry` stops at the cut for `to: frame` (the box is the next background now).
3. **Dive** (`out: dive`, `dive: {el | at, zoom, from}`). A's last 14 frames: a screen-space zoom ×1 → ×`zoom` in log
   space on expo-in about the pivot (the target's centre measured where the dive starts, fixed). B: starts at ×`from`
   (0.3) about the same pivot and grows to 1 on an expo-out of length L chosen so its first log-speed is 0.75 × A's last
   (L clamped 8–30; zoom 8 → L 22.5, zoom 10 → 20.3). Measured: A's last step +0.23 ln/step, B's first +0.19 (ratio
   0.82); never starts zoomed in. Whoosh at the cut (timeline: every non-cut out). Decisions: **footage holds ×1** under
   a dive entrance (the plate is counter-scaled inside the camera; at ×0.3 the mirrored edge tiles read as a kaleidoscope
   and the bare plate as a picture-in-picture) — the UI flies forward, the plate stays; the brand background *does*
   zoom (it's extended in whole grid tiles so the grid never ends). **Speed:** a blur filter inside a ×8 camera ran on
   a ×8 raster (and at ×0.3 on the whole oversized background: 1.3 s/frame) — a dive shot's camera blur now runs in
   screen space on a frame-sized wrapper clipped just past the frame: dive frames 120–390 ms incl. a PNG screenshot on a
   load-34 Mac, the same as the shots' own calm frames (the float-over-footage shots cost ~500–600 ms either way).
4. **Grow from a point** (`from: <layer of the previous shot> | [x, y]`). The engine resolves it at build (seek the
   previous shot's last frame, the element's centre) and hands the block `ctx.origin` in the block's own coordinates
   at its first frame (the entering camera undone: entrance, zoom fields, a dive's ×0.3), or null; only for blocks that
   declare `origin: true` (float's `from: left|right` keeps its meaning). The helper: `K.grow(origin, rest, t, {t0, len,
   s0, bank, arc})` → `{x, y, s, rot, op, k}` (position out(3) on a gentle arc, scale soft from .06, bank → 0, opacity .4
   at birth → 1 in 2.5 frames). **The first element leaves half a frame before the cut**, so the shot's first frame
   already shows it (born at exactly ×0.06 the first frame was near-empty and failed QA content). For round 1's `fan`:
   add `origin: true` and, per card, `const g = ctx.origin && K.grow(ctx.origin, {x: cx, y: cy}, t, {t0: K.growAt(rank, n) - .5, bank})`.
   Also `ctx.carried` = the layer a carry lands on in this shot (float uses it: no fly-in, no streak behind a card that
   is hidden until it lands — a carried-in float otherwise showed its own speed streak flying in empty).
5. **Flood** (`out: flood`, `flood: {from, color}`; `XFX.flood` = pre 14 / post 7, overlay). Three wobbling soft circles
   (420 px feather at 1080) grow ∝ p^1.5 from the origin (measured where the flood starts) to the farthest corner
   + 25 % on the cut, a conic rainbow fringe on the front (α .55·sin πp, screen blend on a dark flood), then the colour
   fades over the next shot unless it is that same flat colour. Text the front would leave dark-on-dark (contrast < 3:1
   with the flood colour) gets a soft patch of the colour that goes opaque within 2 frames of the *visible* front
   (20 % flood) reaching it (first version triggered on the invisible outer feather — a grey pill popped over the text
   ahead of the flood; fixed). The flood is picture: hidden in the QA background reference (like footage), so the solid
   frames on the cut pass the content check.
6. **Transition lint** (`--grid`): > 2 transition types per film (cut and drift-* never count; whip-left/right are one
   type; a carry / morph counts as one; `signature:` excluded) → one warning with the list; moving transitions without
   `cause:` → one warning per film with the shot list. `cause:` / `signature:` are new fields; `cause` is in
   `NOT_PIXELS` (proved: changing it changes no print).

Extra checks I added at `--grid` (warnings unless noted): carry/dive/flood/from layer names the block's `layers:` doc
doesn't list; `dive`/`flood` without the matching `out`; `from:` on a block that can't grow / on the first shot;
**morph `to: frame` on `out: cut`** and **a carry on a hard cut between two shots on the same plain background** —
both hide the cut, so QA's hard-cut check FAILs (I hit both in the dev job; the second one cost a 16x9 render). Errors:
carry on the last shot; `pre`/`post` that don't fit the shots (incl. a shot that receives one carry and sends another).
**Fingerprints:** a cross-cut links its two shots' prints (the next shot's fields + assets for carry/dive/flood, the
previous shot's for a shot that receives one or has `from:`) — proved: changing `post`'s card re-prints teaser, post,
again.

## Commands run and results

Dev job: `jobs/r2-dev/beats.yaml` (assets copied with `cp -c` from film-sample and edge-test):
`ask →flood→ scan(stack, from: prompt-box) → pick(float, from: pill) →dive (layer: card)→ teaser →carry smooth→ post
→carry needle→ again(zoom 1.12) → wall(from: card) →dive (point)→ plan →morph→ go →morph to: frame (out: zoom-in)→ end`.

```
node $S/video/lv.mjs --job jobs/r2-dev --grid
  ! 4 transition types in one film (flood: ask; carry: teaser, post; morph: plan, go; zoom-in: go) — keep it to two plus cuts and the signature dive
node $S/video/lv.mjs --job jobs/r2-dev --storyboard --aspect all            → clean (only the lint line)
node $S/video/lv.mjs --job jobs/r2-dev --film --aspect 16x9|9x16|1x1 --workers 2
```
16x9 QA (final engine):
```
PASS  shots    shot changes at 145, 319, 435, 552, 668, 784, 929, 1045, 1161 = timeline cuts
INFO  cut      ask→scan at 145: change 2.04, neighbours ≤ 2.21 (0.92×) — flood, boundary proven by the shot log
PASS  cut      scan→pick at 319: change 20.51, neighbours ≤ 2.64 (7.76×)
INFO  cut      pick→teaser at 435: change 138.55, neighbours ≤ 21.11 (6.56×) — dive, boundary proven by the shot log
PASS  cut      teaser→post at 552: change 30.59, neighbours ≤ 7.05 (4.34×)          (smooth carry across a hard cut)
PASS  cut      post→again at 668: change 25.18, neighbours ≤ 1.53 (16.42×)          (needle)
PASS  cut      again→wall at 784: change 167.61, neighbours ≤ 0.65 (257.67×)
INFO  cut      wall→plan at 929: change 167.41, neighbours ≤ 30.30 (5.52×) — dive, boundary proven by the shot log
PASS  cut      plan→go at 1045: change 178.33, neighbours ≤ 2.01 (88.52×)           (morph, dark → light under the box)
INFO  cut      go→end at 1161: change 24.63, neighbours ≤ 27.87 (0.88×) — zoom-in, boundary proven by the shot log
PASS  freeze   no frozen runs
PASS  content  every frame has content beyond its background (min 28 differing thumbnail px)
PASS  text     19 text boxes across 10 hero frames, none clipped or tiny
PASS  whoosh   2.417→2.419, 7.250→7.244, 15.483→15.482, 19.350→19.347
QA PASSED (16 checks)
```
9x16 and 1x1 (same timeline, same cuts):
```
9x16  INFO cut ask→scan 0.91× flood · PASS scan→pick 7.61× · INFO pick→teaser 10.50× dive · PASS teaser→post 6.49× ·
      PASS post→again 12.42× · PASS again→wall 78.61× · INFO wall→plan 6.57× dive · PASS plan→go 102.84× · INFO go→end 0.96× zoom-in
      PASS freeze · PASS content (min 97 differing thumbnail px) · PASS text 16 boxes · PASS loudness/duration/audio/sfx/whoosh
      QA PASSED (16 checks)
1x1   INFO ask→scan 0.52× · PASS scan→pick 5.69× · INFO pick→teaser 13.74× · PASS teaser→post 5.20× · PASS post→again 10.76× ·
      PASS again→wall 191.49× · INFO wall→plan 2.65× · PASS plan→go 51.52× · INFO go→end 0.77×
      PASS freeze · PASS content (min 17) · PASS text 18 boxes · PASS loudness/duration/audio/sfx/whoosh
      QA PASSED (16 checks)
```
Films: `jobs/r2-dev/r2-dev-{16x9,9x16,1x1}.mp4` (21.3 s each). Logs: `runs/C/film-r2dev-final.log`.

Earlier 16x9 run (before two fixes), kept because it shows what QA catches: `FAIL cut plan→go (1.10×)` (a morph
between two light shots hides the cut → plan made `theme: dark` + the new grid warning) and `FAIL content 930` (a white
panel on a light background at ×0.3 after a dive — same fix).

Planted probes (`jobs/C-probe-r2/*`):
```
carry-last --grid      ✗ beats.yaml: s2: carry on the last shot — there is no next shot to hand "prompt-box" to (move it to the shot before a cut)
bad-fields --grid      ✗ 12 one-liners: carry unknown key / bad el name / ease / lift; dive el+at / zoom 40; cause not text;
                         flood.from [0.5] / color red; from [2,2]; signature spin (lists the allowed ones)
soft-warnings --grid   ! dive / flood without their out; from: on headline / prompt; morph to: frame on a hard cut;
                         carry.to "panel" not a stat layer; 5 types; 3 moving transitions without cause
carry-same-bg --grid   ! s1: carry on a hard cut between two shots on the same light background — … QA's hard-cut check can't find the cut (FAIL) …
carry-unknown-a --storyboard  ✗ stage failed to build: … carry from s1: el "nope" — shot s1 (prompt) has no layer of that name (its layers: prompt-box, prompt-text)
carry-unknown-b --storyboard  ✗ … carry s1 → s2: to "nothing-here" — shot s2 (prompt) has no layer of that name (its layers: prompt-box, prompt-text)
carry-invisible --storyboard  ✗ … carry s1 → s2: "cta" is only 0 % visible where the carry lands (6 frames into s2) — land later with post: N or carry another element
```
Old jobs at `--grid` now also print the lint (film-sample: 4 types + 4 moving transitions without cause; steady: 3
types; reel: no types warning, 5 without cause) — warnings only.

Clips / layers (clean mode, 16x9):
```
--clips teaser --alpha   PASS clip / content / freeze        --clips post   PASS clip / content / freeze
--layers teaser,post     PASS order/format/layers/nonempty/bg/stack/stack+bg (worst max diff 4)
--layers pick,scan,wall  PASS all (pick worst max 3; wall worst max 4; scan worst f86: 41 px > 16, max 59 of the 64 limit —
                          the stack's own settled 3D at its last frame, not the grow, which is over by frame ~20)
```

### Old jobs byte-identical with the live engine
Clones `jobs/C-old-{film,steady,reel}` (stage C) vs `jobs/C-old-*-live` (live skill, same inputs):
```
storyboard hero PNGs, all aspects (film-sample 3×12, steady 2×7, reel 3×8 = 74 stills): 71 byte-identical;
  the 3 that differ are film-sample's 10-wall.png (16x9 / 9x16 / 1x1, max 2–3 code values — see below)
--film --range 100,219 film-sample 16x9 (open→name zoom-in cut):  120/120 frames byte-identical, bgref 120/120
```
(run twice: once mid-build and again with the final engine — same result; logs `runs/C/oldjobs-stageC.log`,
`runs/C/after-films.log`.)

The wall hero is nondeterministic in the **live** engine too: five 1x1 storyboard runs (`runs/C/wallnoise/`) —
stage C run-to-run max 3 (7.8–8.9 % of channels), live run-to-run max 3 (6.1–7.8 %), stage C vs live max 3 — and live
(Worker A's run) vs live (mine) on 16x9 max 3 / 2.9 %. Same size, so it's raster noise (3D-tilted footage cards), not
my edit; the wall's old code path is unchanged (`bank` 0, `op = a`, same transform string).

### Purity
`runs/C/tools/purity.mjs`: 30 frames picked (seeded) inside every round-2 window (carry ×4 incl. hand-overs, dive ×2
both sides, flood, `from:` entrances), re-rendered in **shuffled** order on **one fresh page**:
- shuffled vs time-ordered re-render (both fresh pages) — 16x9: **27/30 byte-identical**, the other 3 are wall frames
  (max 2–3: the wall noise above). So no frame depends on the order frames are drawn in.
- vs the film's frames — 16x9: 23/30 identical; besides the wall, teaser 444/445 (max 1), 457 (max 8, 8.7 %) and post
  584 (max 4, 0.07 %) differ **identically in both orders**, and a contiguous re-render of 430–470 on a fresh page is
  41/41 byte-identical with the film. So it's Chrome's raster history (a frame drawn right after its neighbour vs after
  a jump), not engine state — and it happens in the live engine on old jobs too: film-sample frames rendered sparsely
  with the live skill, frame 119 max 9 (0.08 %) vs the live film (`runs/C/tools/sparse.mjs`). Worker B's purity WARN
  will see this kind of difference; its tolerance needs it.
- 9x16: 22/30 vs the film (the same frames: teaser 444/445/457 max 1–7, post 584 max 2, wall ×4); 1x1: 23/30 (teaser
  457 max 9, post 584 max 2, wall ×3) — and on 1x1 shuffled vs time-ordered again **27/30, only the wall** differs.
- One thing I could not remove: on 1x1 a contiguous re-render of 440–460 (the teaser's dive entrance, camera ×0.3 → 1
  over held footage) differs from the film by max 1–14 (3–10 % of channels) for the whole run, while 470–480 and 16x9's
  430–470 are identical and frames 400–406 differ only at the start of a run (max 2–4, 0.17 %). Between two fresh pages
  the same frames differ far less: 440–456 contiguous vs shuffled = 6/17 identical, the rest max 1–2 (≈0.06 %), inside
  B's ±2 tolerance (`runs/C/tools/histtest.mjs`). So the dive entrance's raster depends on the page's history (the film
  page had drawn 0–439 before; compositing / image-quality / raster-scale history), not on DOM state —
  the same class as the live engine's sparse-render difference on film-sample's zoom-in (frame 119 max 9). Visually
  nil; but Worker B's purity check (tolerance max |Δ| ≤ 2 or ≤ 0.01 % of pixels) will WARN on such frames. Candidates to
  try later: keep a filter on the dive wrapper at all times (no filter ↔ none toggling), or no camera blur under ×1.
- Results: `runs/C/purity/{16x9,9x16,1x1}/purity.json` (+ `-sorted`, `-shuffled2`, `-contig*` folders).

### Continuity numbers (for Worker D; `runs/C/tools/cutcams.sh`, LV.camera() per 60-fps frame, same on all aspects)
| cut | device | camera ln-scale step: last before → first after | carried rect |
|---|---|---|---|
| 145 | flood | +0.0039 → +0.0046 (1.16×) | — |
| 435 | dive into a layer (zoom 10) | +0.2315 → +0.1894 (0.82×) | — |
| 552 | carry smooth | +0.0003 → +0.0047 | move 29.3 → 29.2 px/step, size −0.0139 → −0.0140; fastest step −1→0 (touches the cut) |
| 668 | carry needle | +0.0003 → +0.0047 | size +0.0071 → **+0.0244 on the cut** → +0.0069 |
| 929 | dive into a point (zoom 8) | +0.2091 → +0.1725 (0.83×) | — |
| 1045 | morph box → box | +0.0003 → +0.0047 | size +0.0185 → +0.0185 (1.00×), fastest −1→0 |
| 1161 | morph to: frame + zoom-in | +0.0481 → +0.0232 (0.48×: the existing zoom-in) | size accelerating into the cut (+0.053 … +0.062); no rect after the cut |

`cam.carry = {x, y, w, h}` (screen px) is in `LV.camera()` on every frame a carry/morph is drawn (incl. the hand-over).
The step across the cut itself is a camera discontinuity by design (A at ×6.3, B at ×0.3 after a dive).

## Stills to look at
- Cut strips, 30-fps frames −4…+6 around every cut (row-major; red border = first frame after the cut):
  `runs/C/strips/16x9-v3/` (all cuts) + `16x9-v4`/`16x9-v5`/`16x9-v6` (after fixes), `runs/C/strips/9x16-final/`,
  `runs/C/strips/1x1-v1/`. `-early` = the 15…4 frames before the cut (flood growth, carry take-off), `-late` = +6…+18
  (carry landing / hand-over), `-fill` = the morph to: frame.
- Storyboards: `jobs/r2-dev/r2-dev-storyboard-{16x9,9x16,1x1}.png`; films `jobs/r2-dev/r2-dev-{16x9,9x16,1x1}.mp4`.
- Layer sheets: `jobs/r2-dev/layers/r2-dev-{teaser,post,pick,scan,wall}-16x9/*-layers.png`.

## Open issues / notes for the lead
1. **QA's hard-cut check vs soft cuts.** A morph `to: frame` and a carry between same-background shots hide the cut, so
   `out: cut` FAILs `cut` (the grid now warns). A better long-term fix is QA treating a shot with `carry` as a soft cut
   (INFO) — that's Worker D's / QA's file, not changed here.
2. **Morph timing** is a continuous cusp, not the reference's ±18 % two-box cut (see 2.). Easy to switch.
3. **Dive entrance over footage**: the plate holds ×1 (only the UI flies in). The brand background zooms. A dive into a
   light shot whose first element is white on the light background is nearly empty at ×0.3 (QA content FAILs) — the dev
   job uses dark there; maybe worth a grid hint later.
4. **Grow after a dive** (from: on a shot entered by a dive) → the first frames are ×0.3 × ×0.06: avoided in the dev job;
   not blocked.
5. **"Looks the same"** for the hard hand-over = same text + same image/footage-frame URLs. Footage cards always crossfade
   (their frames differ).
6. `--layers --with-transitions` of a carry shot (the `carry` engine layer) is wired but not tested.
7. **Merge with round 1:** runtime.js hunks are all local (see the hunk list: 18 hunks, one big insert before `seek`); the
   `LV` export gets one line after `seek, audit, …` (Worker B adds `hideText` near there — trivial conflict if any).
   `wall.js`/`stack.js` render loops are where Worker A's grid / exploded modes also go — my hunks are the card
   transform lines (wall: `let {X, Y, dolly}`, `rotateZ(c.rz + bank)`; stack: the entrance block + the `rotateZ` suffix).
   spec.mjs: I touched only TRANSITIONS, the float ENUMS line, one call line in the shot loop, the return line and
   appended functions. timeline.mjs: one line after `heroF`, one before `dur`, the `delivery` return line, appended functions.
8. Not done (not mine): `lv.mjs --blocks` "Common to every shot" line should list the new fields (proposed text below).
9. The wall hero's raster noise (max 3) makes "byte-identical" impossible for that one still even live-vs-live.

## GUIDE text I'd add (lead writes the docs)

**Cross-cut continuity (any shot).** One thing stays continuous across a cut; the rest hard-cuts.
- `carry: {el: prompt-box, to: panel}` on the outgoing shot — that element lifts off, travels (an arc, its fastest frame
  on the cut) and lands on the next shot's `to` element (default: the same name). `ease: needle` keeps it in place and
  pulses its size on the cut while the backgrounds hard-cut under it (make the next element ~1.1× for the classic pulse).
  `pre`/`post` frames (smooth 8/14, needle 6/6), `lift` (1.08), `arc` (.1). Names are the `(layers)` `--blocks` lists.
  Needs the backgrounds to change on a hard cut (theme, footage) — or a moving `out`.
- `carry: {el: panel, to: prompt-box, mode: morph}` — the box itself becomes the next box (size, corners, colour,
  shadow), contents crossfading. `to: frame` fills the frame with the next shot's background colour (or `color:`) on the
  cut — give that shot `out: zoom-in` and a `cause:`.
- `out: dive` + `dive: {el: card, zoom: 8}` or `{at: [0.6, 0.5]}` — the camera flies into the target in its last 14
  frames; the next shot keeps flying in from ×0.3 (`from:`); footage holds the frame, the UI flies.
- `from: prompt-box` (or `[x, y]`) on float / stack / wall — the cards are born at that element of the previous shot
  and fly to their places. Not after a dive.
- `out: flood` + `flood: {from: prompt-box, color: "#0E0E12"}` — the next background pours out of what was pressed.
- `cause: "Send is pressed"` — what on screen drives a moving transition (storyboard only). `signature: dive` (top level)
  — the one transition the film repeats; the lint allows two more types plus cuts.
- Custom blocks: declare `origin: true` and use `ctx.origin` with `K.grow(...)`; `ctx.carried` names the layer a carry
  lands on in this shot (skip its own entrance).

**`--blocks` "Common to every shot" addition:** `carry {el, to, ease, pre, post, lift, arc, mode, color}, dive {el|at,
zoom, from} (out: dive), flood {from, color} (out: flood), from (float/stack/wall), cause; top level: signature`.

## Tools (all under `qa/motion-kit/runs/C/tools/`, stage-C engine, nothing installed)
`cutstrip.mjs` (cut contact sheets + per-frame camera), `cutcams.sh` (continuity numbers), `purity.mjs` (shuffled
re-render), `contig.mjs` / `sparse.mjs` (raster-history checks), `probe.mjs` (evaluate in a stage page), `frametime.mjs`
/ `speed.mjs` (per-frame cost), `pxdiff.py`. Logs: `runs/C/*.log`.
---

## Fix pass (2026-10-26, after `reports/C-monitor.md`)

Same copy (`qa/motion-kit/stageC/product-launch-sting`), same file ownership, plus nothing new outside it. No commits, no paid calls, nothing under `qa/video-skill-learnings/skills/` run, the live skill and the original jobs untouched (clones only). Work files: `runs/C/fix/` (strips, purity runs, experiments, logs), tools `runs/C/tools/{purity-all,layerhist,domhist,linkcheck,strip2}.mjs`, `regmatch.py`, `fdiff.py`, `where.py` (the last two copied from the monitor's tools).

**Result: 3 / 3 HIGH fixed, 6 / 6 MEDIUM fixed, 8 of 10 LOW fixed.**
- **Not changed (1):** finding 10, the morph's two-box timing. It's a design call for the lead.
- **Partly changed (1):** finding 15. The zoom family is fixed; the cause line stays a warning, which is what the plan and the spec ask for.
- **Still needs the lead (1):** finding 12, the `fingerprint.mjs` ownership. It's tightened and proven, but the lead has to accept the file.
- **Purity:** every frame of both dev films was re-rendered in a shuffled order on one fresh page, in all 3 aspects (numbers in the table below). The whole-shot drift after a carry lands is gone.
- **What still fails purity:** two pre-existing Chrome effects in `ui.js`. One also shows in the live engine. I verified one-line fixes in a scratch copy, but `ui.js` is not my file.

### Per finding

| # | Sev | Status | How | Proof |
|---|---|---|---|---|
| 1 | HIGH | **fixed** | No more patches. The flood masks A's dark-on-dark text with the front itself (`floodMask`). The mask is a radial gradient on circle 0's centre, in the element's own coordinates: transparent where the flood is ≥ 50 %, opaque where it is ≤ 20 %. It reaches past the box (`mask-clip: no-clip`, a margin of one line height) so glyph overhangs are never cut. It is restored at the next seek (`unmaskFlood`). Text the block masks itself (agent / roster typing) is left alone. | Strips: `runs/C/fix/final-strips/r2-dev-{16x9,9x16,1x1}/cut0-ask-scan-*.jpg` (close-up: `dev-9x16-flood/cut0-ask-scan-9x16.jpg`). "What shi…" / "Cut three Friday t…" are eaten by the front, with no box in any aspect. Purity on `ask`: 0 frames outside tolerance in all 3 aspects (16x9: 126 identical + 19 within tolerance) |
| 2 | HIGH | **fixed** | A carry now shows A's element until the cut and **B's element as it looks where it lands** after it (`c.gL`), so the landing is exact and the real element takes over with no crossfade. When A's and B's elements differ (`lookKey`), both looks are **stretched onto the path's box**: one outline whose width and height go from A's shape to B's. The two looks blend through a 6 px blur peak on the cut (B under A from cut−2, A out by cut+1.5). The flagship case is a new dev job, `jobs/r2-whip` (prompt-box → panel under `whip-left`, then a dive into the panel and into footage). | `runs/C/fix/final-strips/r2-whip-{16x9,9x16,1x1}/cut0-ask-plan-*.jpg` show one box morphing, no double. `fdiff` on the film (mean abs. change per 60-fps step, landing at 173): 171→172 0.30, **172→173 0.18**, 173→174 0.60 (the panel's own animation). Before: two overlapping cards for 4 frames. |
| 3 | HIGH | **fixed** for round 2 | Root cause, **bisected**. The DOM state is identical across histories (`domhist.mjs`: 0 of 29 elements differ, and only one layer composites). But Chrome keeps what it rasterised for an element drawn with a **pure 2-D translation** transform and reuses it after. The carried-in card is `rotate(0) scale(1)` from landing until its bob starts (t 7–12), so frame 767 matched the film only if one of frames 682–692 had been drawn first. 681 doesn't count: the camera blur filter is still on there. 694+ doesn't count either: the bob's rotation is on. Fix in `float.js`: a landed card is never a pure translation (`rotate(.001deg)`). A scratch-copy experiment made 767 match from every history (`runs/C/fix/lh5`). | Full-film purity (every frame, shuffled, one fresh page): `again` 30 identical + 86 within tolerance, **0 outside**, in all 3 aspects; before, 86–92 k channels per frame, max 255. All results are in the purity table below. |
| 4 | MED | **fixed** | `spec.mjs`: a float `from:` that isn't a layer-name-shaped string fails with "left \| right (the side it flies in from), a layer of the previous shot, or [x, y]". `timeline.mjs`: a float string `from:` on the first shot, or one that is no layer of the previous shot (when its block lists them), is an error naming both. | `jobs/C-probe-r2fix/float-typo-first`: ✗ `s1: float from "rigth" must be left \| right …— this is the first shot`. `float-typo`: ✗ `… (s1, headline: kicker · headline · sub)`. `float-caps`: ✗ `… (got "Left")`. `float-ok-layer` (`from: headline`, `from: right`) is clean. |
| 5 | MED | **fixed** | Growth `r = (1.03·far + .6·fe)·p²`: the visible front (core + ~half the feather) reaches the farthest corner on the cut. The circles' offsets ∝ the radius, so the flood starts as a round drop, not a lumpy blob. | 16x9 change per frame: 140 13.4 · 141 13.6 · 142 12.6 · 143 8.5 · **144 3.8** · cut 15.8. Before: 1.8 · 0.05 · **0.0** · 0.0. The last uncovered corner leaves on the cut in all aspects (strips). |
| 6 | MED | **fixed** | (a) Footage under a dive entrance gets its own camera (`lv-pcam`, outside the dive's blur wrapper). It runs on the shot's camera without the dive, pushed ×1 → ×1.15 about the pivot on the dive's out-curve, blurred only by its own motion. The old counter-scale and `buildFoot` edits are reverted, so `buildFoot` is byte-identical to base. (b) `ctx.entered = 'dive'`: float skips its lateral fly-in and streak. (c) Into an element, the zoom stops at 1.3 × the zoom where the element covers the frame about its centre. (d) A shallow dive that would need L > 30 starts B nearer ×1, so its first log step stays 0.75 × A's last. Before, 9x16 was 1.1×, outside the spec. | 16x9 `pick→teaser` after the cut: **1.96, 1.70, 1.76, 1.80, 1.86, 1.98** (before 0.56, 0.32, 0.60, 1.08). Calm teaser hold: 0.6–0.9. No sideways fly-in: `final-strips/r2-dev-*/cut2-pick-teaser-*.jpg`, `final-strips/r2-whip-*/cut1-plan-teaser-*.jpg`. Dives: 16x9 Z 5.94 (fill 4.57), 9x16 Z 2.88 → s0 0.44, 1x1 Z 3.29, all at a 0.75 speed ratio. |
| 7 | MED | **fixed** | By the redesign in 2: the copy after the cut is B at landing, so the landing is exact. The same card switches looks on the cut frame, where the plates hard-cut anyway. | Needle landing (680), change per frame: 678 0.27 · 679 0.20 · **680 0.23** · 681 0.39. Before: **3.02** against 0.20–0.43. |
| 8 | MED | **fixed** | `ctx.origin` carries the source element's size (`w, h`, block px). `K.grow` starts at √(area ratio), clamped .06–.6, and `lead: true` (the first card out) takes the source's size whole, up to ×3, at full opacity. So the source splits into the cards. Float, stack (front card) and wall (nearest card) pass `lead`. `--grid` warns on `from:` in a shot a dive flies in. | `again→wall`: the first wall card is about A's card size on the cut (`final-strips/r2-dev-*/cut5-again-wall-*.jpg`). Before, a ×0.06 speck. Probe `from-dive`: `! s2: from: on a shot the dive flies in …`. |
| 9 | MED | **fixed** | `to: frame`: the box takes the next colour while still small (smoothstep .02–.3 of the growth), and A's content fades over the same span. | The grey phase is now 2 thirty-fps frames on a small box (`final-strips/r2-dev-*/cut8-go-end-*.jpg`). Before, 3–4 frames on a large one. |
| 10 | LOW | not changed | The continuous cusp box (relative-speed ratio 1.00 on the cut) versus the reference's ±18 % two-box cut is a design choice. Switching is a contained change in `carryAt`'s morph branch. | Lead's call. |
| 11 | LOW | **fixed** | The lift eases in with a smoothstep over min(5, window/3) frames, and the shadow follows the lift. | Take-off (a0 535): 534 0.32 · 535 0.34 · **536 0.81** · 537 1.61 · 538 2.22. Before: 0.42 → **6.66**. |
| 12 | LOW | tightened; **lead to accept** | `fingerprint.mjs` is needed for `cause` in `NOT_PIXELS`. `linksPrev` now links only when the block really reads `from:` (`originOf(s, BLOCKS[s.block])`). Before, it linked any string `from` (media `from: 0.5`, etc.). | `runs/C/tools/linkcheck.mjs` on all 16 original jobs: no links (edge-test media `from: 0.5`, reel float `from: right` included). |
| 13 | LOW | **fixed** | The opening comment is back on the `if (first)` line. | `diff` against base: that hunk now adds one line only. |
| 14 | LOW | partly (merge-side) | `--grid` warns on `from:` with `wall layout:` ≠ float or `stack mode:` ≠ cycle (round 1's names, read from stageA). The remaining merge notes stand for the lead. | `C-probe-r2fix/wall-grid-from`: both warnings. |
| 15 | LOW | partly | `zoom-*` is one family (`TRANSITION_FAMILY`), so film-sample counts 3 types. The "moving transitions without a visible cause" line **stays a warning**: TAKE-AND-HOW §3 and SPEC-R2 §6 ask for it on every film, and old films really do lack causes. | `lint-zoom` (zoom-in, zoom-out, whip): no types warning. |
| 16 | LOW | **fixed** | `signature:` must be a string; `cause:` must not be blank. | `sig-cause`: ✗ `cause must be text … (it is blank)` and ✗ `signature must be one of … (got ["dive"])`. |
| 17 | LOW | **fixed** | Wall `hero` and its chip-slot `heroF` use `CHIP0(s) + 2 + chips·5 + 10`. This is unchanged without `from:` (12 + 2 = 14). | Old jobs' wall stills are unchanged against live (max 3, the known noise). |
| 18 | LOW | **fixed** | Storyboards re-rendered. New `flood.spot: [x, y]` = a point inside the `from` element (the dev job pours from the Send button `[0.93, 0.76]`; I measured the button at 0.936 / 0.91 / 0.924 × 0.764 in the three aspects). Needle pulse: `again` zoom 1.15 gives 1.098×. At 1.18 the "POSTED" tag left the title-safe area (WARN). Whip carry: new dev job `r2-whip`. | `LV.crossCuts()`: needle R1/R0 = 1.098 in all aspects (was 1.055 / 1.069). |
| 19 | LOW | **fixed** (and more) | The morph box draws **every layer** of A's and B's own box-shadows, crossfading under it; `boxOf` used to keep only the first layer, which is the prompt box's 2-px ring. It lands on B's box exactly and hands over hard: the 4-frame crossfade also doubled a caret that keeps typing. | Morph landing (1067), change per frame: 1065 0.014 · 1066 0.007 · **1067 0.049** · 1068 0.056. With the first fix it was **0.70** (`runs/C/fix/morph-handover.png` shows the double caret). |

### What changed in the fix pass, file by file (all inside my list)

**`engine/runtime.js`:**
- The carry path is redesigned: `c.gL` (B at landing), `c.same`, look-switch and blend weights, a blur peak on the cut, `placed(…, {stretch})`, and a smoothstep lift.
- **Morph:** every shadow layer (`boxOf().shadow` is the whole scaled `box-shadow` string), exact landing, no `HAND` or `NOSHADOW` any more. For `to: frame`, early colour and early content fade.
- **Flood:** `p²` growth to `1.03·far + .6·fe`, offsets ∝ radius, `floodMask` / `unmaskFlood` in place of the patches, and the `spot` origin.
- **Dive:** the 1.3 × cover-zoom clamp; a shallow dive raises B's start scale; `plateCam` + `lv-pcam` (footage camera); `ctx.entered`.
- **`from:`:** `ctx.origin` carries the source size; `originFor` returns null on the first shot.
- `buildFoot` is reverted to base, the comment is restored, and the build loop keeps the plain underlay off the camera only when footage sits under a dive entrance.

**Other files:**
- `engine/kit.js`: `grow` gains `w`, `h` (size-aware `s0`) and `lead`.
- `engine/blocks/float.js`: `landed` also on `ctx.entered === 'dive'`; landed card `rotate(.001deg)`; grow passes `w, h, lead`.
- `engine/blocks/stack.js`: grow passes `w, h, lead` (front card).
- `engine/blocks/wall.js`: nearest card is `lead`; grow passes `w, h`; `hero` and chip `heroF` follow `CHIP0`.
- `lib/spec.mjs`: `zoom-*` family; `signature` must be a string; `cause` not blank; `flood.spot`; float `from:` message.
- `lib/timeline.mjs`: float `from:` typo errors; `from:` after a dive and on round-1 modes warn; the carry `post` check has no hand-over margin.
- `lib/fingerprint.mjs`: `linksPrev` only for blocks that read `from:`.

**Diff against base:** runtime +410 −8 · kit +53 −1 · spec +78 −3 · timeline +68 −3 · fingerprint +11 −2 · float +23 −6 · stack +14 −3 · wall +19 −9.

**Jobs:**
- `jobs/r2-dev/beats.yaml`: `flood.spot`, `again` zoom 1.15. The old copy is at `runs/C/fix/r2-dev-beats.before.yaml`.
- New dev job: `jobs/r2-whip`.
- New controls and probes: `jobs/C-probe-r2fix/*`, `jobs/C-panel-tap`, `jobs/C-dev-oldfields`, `jobs/C-old-ovl(-live)`.

### Commands and results (final engine)

**Films:** `node $S/video/lv.mjs --job jobs/<job> --film --aspect <a> --workers 2`, one aspect at a time (`runs/C/fix/final.sh`, log `runs/C/fix/final-films.log`). **All 6 films: QA PASSED, 0 WARN, 0 FAIL.**

| Film | Cut checks | content min (thumbnail px) | Result |
|---|---|---|---|
| r2-dev 16x9 | flood 1.26× INFO · scan→pick 5.98× · dive 4.40× INFO · smooth carry 4.05× · needle 13.48× · again→wall 31.42× · dive 5.52× INFO · morph 87.91× · zoom-in 1.21× INFO | 190 (was 28) | **QA PASSED (16 checks)**. The earlier "POSTED outside title-safe" WARN at zoom 1.18 is gone at 1.15. |
| r2-dev 9x16 | flood 1.37× · 6.83× · dive 5.35× · 6.54× · 9.67× · 11.63× · dive 6.57× · 102.37× · 1.21× | 190 | **QA PASSED (16)** |
| r2-dev 1x1 | flood 1.93× · 4.85× · dive 5.12× · 5.48× · 9.01× · 42.51× · dive 2.65× · 51.25× · 1.23× | 176 | **QA PASSED (16)** |
| r2-whip 16x9 | whip-left + carry 47.73× INFO · dive 3.45× INFO · teaser→end 41.01× | 434 | **QA PASSED (12)** |
| r2-whip 9x16 | 66.61× INFO · 2.63× INFO · 47.78× | 355 | **QA PASSED (12)** |
| r2-whip 1x1 | 30.82× INFO · 3.64× INFO · 37.90× | 377 | **QA PASSED (12)** |

**Purity, every frame:** `node runs/C/tools/purity-all.mjs $S/video jobs/<job> <a> runs/C/fix/purity/<job>-<a>` re-renders every 60-fps frame of the film in a seeded shuffled order on one fresh page and compares it with the film. "Tol" is Worker B's tolerance (max |Δ| ≤ 2, or ≤ 0.01 % of pixels above it).

| Film | Identical | Within tol | Outside | Which outside |
|---|---|---|---|---|
| r2-dev 16x9 (seed 7, none of my other renders running) | 703 | 559 | 15 | `plan` 956 + 989–998 (`ui.js`, open issue 1). Wall 841/879/887/888 re-render at 13–22 px (wall noise). |
| r2-dev 16x9 (first run, beside `--layers` exports) | 726 | 536 | 15 | The same 11 `ui.js` frames, plus 4 one-off glitches that don't reproduce (open issue 2). |
| r2-dev 9x16 | 749 | 509 | 19 | The 11 `ui.js` frames, plus 8 one-off glitches: full-width light bands 30–80 px tall at the bottom on 183/216/229/238, and 821/898/903/925. Re-rendered after their **exact** shuffled predecessors (`runs/C/fix/lh-9x16-recheck*`), 7 are byte-identical and 821 is 9 px, max 3. |
| r2-dev 1x1 | 937 | 329 | 11 | The 11 `ui.js` frames only. |
| r2-whip 16x9 / 9x16 / 1x1 | 527 / 530 / 523 | 16 / 13 / 20 | 9 / 9 / 9 | `plan` 205–213 only: the panel's Schedule press (`ui.js:255`). Reproduced on the **live engine** with old fields only (`C-panel-tap`). |

- **`again`** (the monitor's 86–92 k channels, max 255): 30 identical + 86 within tolerance in every aspect, nothing outside.
- **`teaser` / `pick`** (dive entrances): all within tolerance.

**Purity-history experiments** (`runs/C/tools/layerhist.mjs`, a fresh page per sequence, with the renderer's warm-up):
- Frame 767 differed from the film after `660-670` and `681`, and when drawn alone. It matched after `680-690`, `682…692`. Frames 694+ did not help.
- `domhist.mjs`: the DOM is identical either way.
- With `rotate(.001deg)` on the landed card (scratch engine), 767 matches from every history (`lh5`).

**Old jobs byte-identical with the live engine (final engine):**
- `runs/C/oldjobs-stageC.sh` (log `runs/C/fix/oldjobs-final.log`):
  - Storyboard heroes: **71 / 74 byte-identical**. The 3 others are film-sample's `10-wall.png`, max |Δ| 3 on 3–5 px, the known wall noise.
  - `--film --range 100,219` of film-sample 16x9: **120 / 120 frames and 120 / 120 bgref byte-identical**.
- Overlay probe (every old overlay cross-cut, drifts, whips, zooms, blur, letterbox, footage, float `from: right`, stack, wall, media `from:`), `jobs/C-old-ovl` `--range 70,470` against the monitor's live render:
  - 281 / 401 byte-identical. The 120 others (frames 330–449: the wall and the glitch out of it) differ by **max |Δ| 3**.
  - The live engine against itself in the same range is only 11 / 131 identical (max 35, `jobs/C-old-ovl-live`). It's the wall's run-to-run noise, not a change.
- No original job gets a fingerprint link (`linkcheck.mjs`).
- **`--grid` on all 16 original jobs, live against stage C** (`runs/C/tools/gridcmp.mjs`, spec + timeline only, read-only):
  - Every timeline is identical (frames, cuts, errors).
  - The only new lines are the lint: "without a visible cause" on 11 jobs, and "3 transition types" on cue, edge-test, film-kit-dev and film-sample, where zoom-in and zoom-out now count as one type.

**Layers / clips** (16x9; logs in the commands' own output):
```
r2-dev  --layers scan,pick,teaser,post,again,wall            all PASS (stack worst: scan f86 41 px > 16, max 59 < 64 — unchanged from before)
r2-dev  --layers post,again --with-transitions              PASS 7/7 each; layers card · brackets · label · carry (carry 0–57 / 0–5)
r2-dev  --clips again,wall --alpha                          PASS clip / content / freeze
r2-whip --layers teaser --with-transitions                   PASS 7/7 (footage on its own camera under the dive entrance; 13 motion-blurred frames)
r2-whip --layers ask,plan (clean) and --with-transitions     PASS 7/7 each (carry layer: ask 64–72, plan 0–13)
r2-whip --clips plan,teaser --alpha                          PASS clip / content / freeze
```

**`--grid` probes** (`jobs/C-probe-r2fix/*`):
```
float-typo-first  ✗ s1: float from "rigth" must be left | right (the side it flies in from), or a layer of the previous shot — this is the first shot
float-typo        ✗ s2: float from "rigth" must be left | right …, or a layer of the previous shot (s1, headline: kicker · headline · sub)
float-caps        ✗ shots[1] (s2): float from must be left | right (the side it flies in from), a layer of the previous shot, or [x, y] (got "Left")
sig-cause         ✗ cause must be text … (it is blank)   ✗ signature must be one of … (got ["dive"])
from-dive         ! s2: from: on a shot the dive flies in — … cards born at a point start as specks; drop from: or the dive
flood-spot        ! flood.spot does nothing without a layer in flood.from      flood-spot-bad  ✗ flood.spot must be [x, y] … (got [1.4,0.8])
lint-zoom         (zoom-in, zoom-out, whip-left) no types warning
wall-grid-from    ! s2: from: only works in wall's default layout — … layout: grid    ! s3: … stack's default mode — … mode: exploded
float-ok-layer    clean (from: headline, from: right)      float-point-first  ! from: does nothing on the first shot
r2-dev / r2-whip  r2-dev: only the 4-types line (by design: it shows every device); r2-whip: clean
```

### Stills to look at

- **Final-engine contact sheets** (30-fps frames −14…+18 around every cut; red border = the first frame after the cut):
  - `runs/C/fix/final-strips/r2-dev-{16x9,9x16,1x1}/cut*.jpg` (9 cuts each)
  - `runs/C/fix/final-strips/r2-whip-{16x9,9x16,1x1}/cut*.jpg` (3 cuts each)
- **Close-ups for the fixes:**

  | Fix | File |
  |---|---|
  | Flood (round drop, no bars) | `runs/C/fix/dev-9x16-flood/cut0-ask-scan-9x16.jpg` |
  | Different-look carry (one outline) | `whip-16x9b/cut0-ask-plan-16x9.jpg` |
  | Morph landing | `morph-16x9/cut7-plan-go-16x9.jpg` |
  | Split from a big card | `dev-16x9b/cut5-again-wall-16x9.jpg` |

  The `dev-16x9/` sheets are from mid-pass, before the morph, flood-drop and lead fixes.
- **Before / evidence:**

  | What | File |
  |---|---|
  | The 4-frame morph crossfade (double caret) | `runs/C/fix/morph-handover.png` |
  | The 767 history difference | `lh1/cmp767.png` |
  | The pre-existing panel-tap effect | `whip-209.png` |
  | Frame 956 | `dev-956.png` |
  | A one-off band glitch | `p147.png` |
- **Films:** `jobs/r2-dev/r2-dev-{16x9,9x16,1x1}.mp4`, `jobs/r2-whip/r2-whip-{16x9,9x16,1x1}.mp4`
- **Storyboards (fresh):** `jobs/r2-dev/r2-dev-storyboard-*.png`, `jobs/r2-whip/r2-whip-storyboard-*.png`

### Open issues after the fix pass

1. **Two Chrome history effects in `ui.js` are not mine to change; the fixes are verified.** Root cause, same as finding 3: Chrome keeps the raster of an element drawn with an identity or pure 2-D translation transform and reuses it later. A frame then depends on which frames the page drew before. Neither change is applied: `ui.js` isn't in my file list, and it can move old renders' pixels, so it needs the lead and a fresh byte-identical proof.

   | Where | What happens | Proof | Fix (tested in a scratch copy, `runs/C/fix/eng-x`) |
   |---|---|---|---|
   | `ui.js:255`, panel tap target | `scale(1.0000)` at rest. Every frame of a press (r2-dev 989–998, r2-whip 205–213) differs by ~900 px, max ~230, unless a rest frame was drawn just before. | **The live engine does it too:** `jobs/C-panel-tap`, old fields only, `runs/C/fix/lhw-live`. | `press > 1e-4 ? scale(…) : 'none'`. Frame 209 then matches from every history (`lhw-uifix`). |
   | `ui.js:216`, panel item entrance | Lands as `translateY(…) scale(1)`, a pure translation. Its first opaque frame after a dive entrance (r2-dev 956, one frame) differs (3,157 px, max 238). | Not seen with a zoom-in entrance (`C-dev-oldfields`). | Append `rotate(.001deg)`. Frame 956 drops to 4 px, max 6 (`lh956-uifix`). |

   **Worth a line in the compositing-traps memory note:** animated transforms should end on `none`, or on a non-translation, never on `scale(1)` or a bare translate.
2. **Purity outliers under load.** On this shared Mac (load 15–25 from other workers' renders), single re-rendered frames sometimes come back wrong: full-width light bands at the bottom, or a few hundred stray px. It happened 4 times in the 16x9 pass that ran beside my `--layers` exports (147 with a 76-px band, 315, 886, 899) and 8 times in the 9x16 pass. None reproduce: with the exact same predecessors they are byte-identical or inside the tolerance (`runs/C/fix/lh-recheck`, `lh-9x16-recheck*`). The films themselves were clean at those frames: film = clean re-render. The 16x9 re-run with another seed had none.
   - **Suggestion for Worker B's purity WARN:** re-render a differing frame once before warning.
3. **The wall's run-to-run noise is larger than reported.** In the live engine it reaches max 35 on 26 px between two runs: `C-old-ovl-live` against `mon-C-old-ovl-live`, frames 320–450. Only 11 of 131 frames were identical, live against live. Stage C against the monitor's live run: max 3.
4. **The footage push after a dive is a taste call.** `PLATE_PUSH` 1.15: the picture keeps changing at about 2× the shot's calm hold, while the UI flies in faster (parallax). Raising it crops the footage harder for the rest of the shot.
5. **Morph two-box timing:** still the lead's decision (finding 10).
6. **A carry between two different things now blends in one outline on the cut.** For two boxes with different colours, `mode: morph` (box, colour, every shadow layer) is still the stronger read, so the GUIDE text below says so.
7. **`fingerprint.mjs` needs the lead's acceptance** (finding 12).
8. **The "without a visible cause" warning stays on old films**, by the plan (finding 15).
9. **`cause:` isn't printed on the storyboard yet.** That's Worker D's `board.mjs`.

### GUIDE text — changes to the round-2 text above

- **`carry`:** after the cut you see the next shot's element as it looks where it lands, so the landing is exact.
  - **The same thing on both sides** (same pictures and text) swaps on the cut frame, the classic needle: make the next element about 1.1× for the pulse. A camera `zoom:` on the next shot does that; post's own push already adds ~5 %.
  - **Two different things** (prompt box → panel) become one box that changes shape from the first to the second, with the two looks blending through a blur on the cut.
  - **Two boxes that should trade colour and corners:** `mode: morph` reads better.
- **`mode: morph`:** the box carries both elements' own shadows (every layer) and lands exactly on the next box.
- **`flood`:**
  - `spot: [x, y]` is a point inside the `from` element, as fractions of its box (the prompt's Send button: `[0.93, 0.76]`).
  - Dark text under the front is masked by the front itself.
  - The last uncovered corner leaves on the cut.
- **`dive`:**
  - Into an element (`el`), the camera stops at 1.3× the zoom where that element covers the frame (`zoom` is the most it goes).
  - A shallow dive starts the next shot nearer ×1, so it never starts faster than the dive ended.
  - Footage in the next shot keeps pushing forward (×1 → ×1.15) while the UI flies in from ×0.3.
  - A float in that shot doesn't fly in sideways.
- **`from:`:**
  - Cards born out of a big element start at its size (the first card takes it whole, as if the element splits into the cards). Out of a point, they start as specks.
  - Not on a shot a dive flies in (`--grid` warns).
  - On float, a name that's no layer of the previous shot is an error, since it's probably a typo of left / right.
- **Custom blocks:**
  - `ctx.origin` also has `w`, `h` (the source's size).
  - Use `K.grow(o, rest, t, {t0, w, h, lead, bank})`.
  - `ctx.entered === 'dive'` means the dive is the entrance, so skip your own fly-in.
  - `ctx.carried` names the layer a carry lands on.
- **Rule for block authors (Chrome):** never let an animated element's own transform settle on `scale(1)` or a bare `translate(…)`. End on `transform: none`, or keep a non-translation term (`rotate(.001deg)`). Chrome reuses what it drew for a pure-translation frame in later frames, and the frames then depend on draw order.
- **`--blocks` "Common to every shot" line:** add `flood {from, spot, color}`.
