# Round 2 build spec: cross-cut transitions + cut checks (2026-10-26, approved by Alex)

Source plan: `qa/video-skill-learnings/TAKE-AND-HOW-2026-10-26.md` §3 "Round 2". Research: `qa/video-skill-learnings/readers/saas-skill.md`
(§1 transition vocabulary, §2 ease maths — paraphrased; never copy or run anything under `qa/video-skill-learnings/skills/`).
Read `SPEC-R1.md` first: its "Where to work", hard rules and "Rules for every change" (1–13) all apply here too.

Round 2 is built **at the same time as round 1**, from the same pre-round base (`qa/motion-kit/base/product-launch-sting`), and
merged with round 1 afterwards by a three-way merge. So: keep edits local and surgical (no reformatting, no moving code
around), so the merge stays clean. Round 1 adds blocks press/fan/particles/map and modes to wall/type/stack; round 2 must not
depend on them (a later merge step wires `from:` into `fan`).

## The core rule (why)

Speed is never zero at an event and peaks on the cut; the direction of motion survives the cut; one thing stays continuous
across the cut (geometry, direction/relative speed, UI state or a colour) while the rest hard-cuts; nothing important appears
or leaves by opacity alone; every transition has an on-screen cause. The engine today draws one shot at a time, so anything
that must persist across a cut lives in a new stage-level layer.

## Worker C — the engine transitions

Owns: `engine/runtime.js`, `engine/kit.js`, `lib/spec.mjs` (new fields), `lib/timeline.mjs` (new fields/plan + the transition
lint), `engine/blocks/float.js`, `stack.js`, `wall.js` (only the `from:` origin entrance, in their existing default modes),
a new helper file if needed. All of it opt-in: a timeline without the new fields builds exactly the old page and renders
byte-identical frames (create the new stage layers only when used, as OVL/LBOX are).

### 1 · Carry (`carry:` on the outgoing shot) — an object handed from shot A to shot B

```yaml
- id: s3
  block: prompt
  out: whip-left            # the rest of A leaves as usual
  carry: {el: prompt-box, to: panel, ease: smooth}   # el = a layer name in this shot, to = a layer name in the next
```
- `el`: a layer name the block tags (the names `--blocks` lists, e.g. prompt's `prompt-box`, cta's `word`, panel's `panel`,
  float's `card`, endcard's `cta`); `to`: a layer in the next shot (default = `el`); `ease: smooth (default) | needle`;
  `pre` / `post` frames (smooth: 8 / 14; needle: 6 / 6); `lift` (smooth 1.08, needle 1); `arc` (fraction of the chord, .1).
- Mechanism: a stage-level `CARRY` layer (above the shots, below the transition overlay and the letterbox). From
  `cut − pre` on, A's element is hidden and a **clone** of it (taken from A's DOM rendered at that same frame, so its own
  animation keeps playing until the cut; after the cut, from A rendered at its last frame) is drawn in CARRY at a path that
  starts at the element's screen rectangle at `cut − pre` and lands on B's `to` element's screen rectangle at `cut + post`
  (measured with B's camera at that frame). Until `cut + post` B's `to` element is hidden; at landing the clone hands over
  to B's real element (a 3–4 frame crossfade when they don't look the same). Screen rectangles are measured by rendering
  the shot at that frame (pure: memoise per carry, same result whatever order frames are drawn in — prove it).
- Path: centre on a gentle arc (`arc` × chord, bell-shaped speed), size log-interpolated, the lift (×`lift`, up over the
  first 0.1 s, back down by landing), with the camera of neither shot applied (screen space). `ease: needle` = the
  "needle zoom": the size change follows bezier(.95,0,.05,1) across the cut window, so the fastest frame is the cut
  (the backgrounds hard-cut under a persistent object; make B's `to` element ~1.10–1.15× A's for the classic pulse).
- Errors at build (clear one-liners, they fail the render): unknown layer in A or B, the B element is invisible (opacity
  < .9) at landing ("land later with post: N or carry another element"), `carry` on the last shot. Warnings at `--grid`:
  carry onto a shot whose block has no such layer name.
- Clean renders (`--clips`, `--layers` without `--with-transitions`) have no carry: each shot draws its own element.
  bg-only (QA content reference) renders hide CARRY (it is content).

### 2 · Morph (`carry: {…, mode: morph}`) — a box becomes the next box

- The CARRY clone is replaced by a box that interpolates rectangle (size, not scale), corner radius, background colour and
  shadow from A's element box to B's element box (read from computed styles of the named element or its first painting
  descendant), with the two contents (A's element at detach, B's at landing, each scaled to fit) crossfading through a
  ~6 px blur at mid-way. Timing: A grows ~+18 % on one axis into the cut on an accelerating curve (cusp), B starts ~−18 %
  and decelerates (match relative speed (dH/dt)/H within 0.97–1.03 at the cut).
- `to: frame` = morph into the whole frame: radius → 0, colour → the next shot's background colour (or `color:`), filling
  the frame exactly on the cut so the next shot (e.g. an end card) starts on that solid colour — the "CTA fills the frame
  into the end card" move.

### 3 · Dive (`out: dive`) — fly through a target into the next shot

```yaml
- id: s5
  block: wall
  out: dive
  dive: {el: lit, zoom: 8}      # or {at: [0.62, 0.4]} — a point as fractions of the frame
```
- A's camera zooms in **log space** about the target over its last 14 frames (pivot = the target's screen centre measured
  at the start of the dive, fixed during the zoom; ln s on an expo-in), up to `zoom` (default 8, max 16).
- B enters already moving forward: from ×0.3 (default `dive.from`), growing to 1 on an out-curve whose starting log-speed
  is 0.5–1× A's final log-speed (choose B's entrance length to match, clamped 8–30 frames). It must never start zoomed in
  and shrink. Whoosh at the cut (timeline already adds whooshes for moving outs; add `dive` to the transition list).
- Motion blur: the existing scale blur applies; make sure huge zooms stay fast to render (clip margins; the type block's
  note about blur at 9× applies).

### 4 · Grow from a point (`from:` on the incoming shot)

- `from: <layer name in the previous shot>` or `from: [x, y]` (fractions of the frame). The engine resolves it to a screen
  point (the element's centre at the previous shot's last frame) and gives the block `ctx.origin` = that point in the
  block's own coordinates at its first frame (undo the entering camera), or null.
- `float`, `stack`, `wall` (default layouts) use it: their cards are born at the origin (scale ~.06), travel on gentle arcs
  to their places (position out(3), scale soft, a slight bank −6…+5° → 0, opacity up within 2–3 frames), centre/first card
  first, others +2–4 frames. Without `from:` they behave exactly as today.
- Expose a small documented helper so other blocks (round 1's `fan`) can adopt it in one line later.

### 5 · Background flood (`out: flood`) — the next background pours out of what was pressed

```yaml
- id: s3
  block: prompt
  out: flood
  flood: {from: prompt-box, color: "#0E0E12"}    # from: a layer name or [x, y]; color default = the next shot's background
```
- A cross-cut overlay (like flash/tunnel in `K.XFX`): over the last ~14 frames of A, three wobbling soft-edged circles
  (≈ 420 px feather at 1080p, scaled with u) grow from the origin until they cover the farthest corner + ~25 % by the cut;
  an iridescent fringe rides the front (alpha .55·sin(πp), screen blend on dark). After the cut the overlay holds the
  colour for 0–2 frames and fades over ~6 frames when the next shot isn't that same flat colour (footage, a different bg).
- Text in A is covered by the front (fine); never let the front leave A's text dark-on-dark half-covered for more than
  2 frames (fade A's text under the front if needed — engine-side, via the overlay's opacity mask, not by editing blocks).

### 6 · Transition lint (`--grid` warnings, `lib/timeline.mjs`)

- More than 2 transition types in a cut (not counting `cut`, `drift-*` and one declared top-level `signature: <type>`):
  warn with the list.
- A moving transition (`whip-*`, `smear-*`, `zoom-*`, `tunnel`, `flash`, `glitch`, `dive`, `flood`) with no `cause:` on
  that shot ("cause: the cursor clicks Generate"): warn once per film with the shot list (not per shot).
- `cause:` and `signature:` are new allowed fields (cause is storyboard-only, like `note:` — it must not change pixels or
  fingerprints: add it to the not-pixels list).

## Worker D — the cut checks

Owns: `lib/render.mjs`, `lib/qa.mjs`, `lib/sheet.mjs`, `lib/board.mjs`, `lv.mjs`. All new QA lines are WARN/INFO in round 2;
existing PASS/FAIL logic unchanged.

- **Camera log per frame.** `renderFrames` records `LV.camera()` (`{s, x, y, blur}`) for every frame it draws; `--film`
  writes `cams.json` next to `shots.json` (merged correctly for `--range` renders like `shots.json`/`pages.json`). If
  Worker C's carry/dive need more per-frame data (e.g. the carry clone's rectangle), C exposes it in `LV.camera()` under a
  new key — agree via the spec, not by editing each other's files: D reads `cam.carry` = `{x, y, w, h}` when present.
- **Cut continuity** (`continuity`, WARN). For every cut with motion on either side (|Δ ln s| or |Δx|,|Δy| above a small
  threshold): (1) direction: log-scale velocity and screen-translation velocity keep their sign across the cut (a dive
  followed by a shot that starts zoomed in and shrinks = WARN, naming both shots); (2) speed ratio ≤ 2× between the last
  frame-step before and the first after; (3) the fastest step within ±6 frames is a step touching the cut frame. For a
  carry, apply (1)–(3) to the clone's rectangle centre/size too. Report the numbers per cut in qa.json. Prove it FIRES on a
  planted bad job (e.g. a zoom-in exit into a shot whose camera field starts at `zoom: 2` and settles to 1 — or a custom
  block — whatever reproduces "flies in, then shrinks") and stays quiet on film-sample / steady-sample.
- **Cut stills on the review sheet** (`lib/sheet.mjs`): for each cut, the frames cut−1, cut, cut+1 (60-fps frame indices
  from the film's frames, half-size JPEGs) shown with the shot row they belong to; works when the film exists, says so when
  only storyboard stills exist.
- **Storyboard**: prints a shot's `cause:` under its frame like `note:`.

## Done means

- Worker C: a dev job `qa/motion-kit/jobs/r2-dev/` exercising carry (smooth + needle), morph (box → box and `to: frame`
  into an endcard), dive (into a layer and into a point), `from:` on float/stack/wall, flood, in 16x9 + 9x16 + 1x1;
  `--film --aspect all` → QA PASSED each; frames inspected around every cut (Read the stills at cut−4…cut+6 — judge it
  like a motion designer: is the object truly continuous, any pop, any jump, any ghost/double?); purity proven (a shuffled
  re-render of 30 frames inside the transition windows on a fresh page is identical); old jobs byte-identical with the
  live engine (storyboard hero PNGs of film-sample, steady-sample, reel-sample clones + a 120-frame `--film --range`
  slice of film-sample 16x9); `--clips`/`--layers` of a carry shot still pass (clean mode = no carry).
- Worker D: every check proven both ways (planted bad job WARNs, good jobs quiet), the review sheet with cut stills
  rendered for a real film (Read the sheet's HTML/PNG), no change to existing PASS/FAIL on old jobs.
- Reports: `qa/motion-kit/reports/C-build-r2.md`, `D-build-r2.md` — as SPEC-R1 asks (changes per file, commands +
  results, stills to look at, open issues, the GUIDE text you'd add).
