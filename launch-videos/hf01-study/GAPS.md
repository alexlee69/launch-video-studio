# GAPS — can product-launch-sting make a higgsfield01-style film for Manus 2.0?

DRAFT v0.1 · 2026-10-23 · built from the verified six-area audit in `gaps/` (footage, overlay, screens, edit, title,
sound). Evidence for every row (file:line in the skill, or the scratch run and its output) is in `gaps/<area>.md` and its
`scratch-<area>*/` folder. The top table of each `gaps/<area>.md` shows first-pass verdicts; the verified verdicts are in
its "overturned" section and in this file. Regenerate this file with `/usr/bin/python3 -B gaps/build_gaps_md.py`.

Row IDs: FT = footage, OV = overlay (agent UI over footage), SC = editor screens, ED = edit grammar, TI = title / end
card / brand, SN = sound. The number is the audit's own row number in that area. Unit trap: rates are per 30p output
frame (f, f30), per 24p master frame (mf) or per content frame (cf); positions are 1080p unless marked [608].

## 1. Verdict

> 📌 **TL;DR.** The skill has the plumbing for this film and little of its vocabulary. **Of 124 capabilities measured
> against higgsfield01, 8 are there today (6 %), 83 are partial and 33 are missing.**
> 114 matter for the Manus film, and 24 of those are missing outright. The spine works: frame-exact
> 30p cuts (26/26), MiniMax H3 plates conformed 24→30 under UI overlays with QA passing, look measurement, the 87.01 BPM
> grid with the end sting in its silence, voice with no ducking, and custom job blocks that reach footage, assets and cue
> timing. What makes a film read as higgsfield01 is mostly absent: the gpt-image-2 stills route exists outside the skill
> (the key works; pipeline/image_gen.py) but isn't wired into it (the skill's only still route is FLUX), no editor or timeline block, no 24p film master or the
> reference's {5,10,14} cadence, cuts that always add a −4 % zoom or a whoosh, a score with one drop, major keys only, an
> arpeggio over the intro and forced risers, and a Manus logo that renders invisible when tinted while QA passes. Every
> gap has a custom-block or premix workaround, so a DRAFT v0.1 can be cut by hand now (§4). A faithful film needs the
> five work packages in §3. The engine (WP-B) and the UI kit (WP-C) are the long poles, and nothing should start before
> the 10-21 fix round is merged (WP-0), because it changes the same files and some of the numbers measured here.

| Area | Capabilities | have | partial | missing | not needed for Manus |
|---|---|---|---|---|---|
| AI footage & the actor (FT) | 20 | 4 | 13 | 3 | 0 |
| Agent UI over footage (OV) | 20 | 0 | 15 | 5 | 3 |
| Editor screens & the deliverables (SC) | 20 | 0 | 10 | 10 | 4 |
| Edit grammar, transitions & camera (ED) | 20 | 1 | 18 | 1 | 0 |
| Title, end card & brand (TI) | 20 | 1 | 13 | 6 | 1 |
| Score, sound design & voice (SN) | 24 | 2 | 14 | 8 | 2 |
| **All** | **124** | **8** | **83** | **33** | **10** |

Effort of the 106 gaps the Manus film needs: 62 S and 44 M; every L row is parked (S ≈ half a day, M ≈ 1–2
days, L ≈ 3+ days of builder time including QA — an estimate). Rows overlap (24p shows up in five areas, the cursor and
the pixel burst in two), so the sum overstates the work: §3 folds the 116 rows into 28 fixes.

## 2. Every partial and missing capability

Fix types: **new block**, **block option**, **helper** (shared code inside engine/blocks), **engine** (runtime, timeline,
QA, CLI), **tool** (footage/, recreate/, voice/), **doc**, **park** (not needed for the Manus film; don't build). WP = the
work package in §3 that owns the fix; the code in brackets (B3, C4 …) is the fix inside that package.

### AI footage & the actor (FT)

| ID | Need | Now | What's missing | Manus | Effort | Proposed fix | WP |
|---|---|---|---|---|---|---|---|
| FT-1 | Character sheet of one actor (gpt-image-2) | partial | API access confirmed 2026-10-23 (the key in Design-AutoPilot-stable/.env lists gpt-image-2) and working client code exists (pipeline/image_gen.py: generations + multi-reference edits); the footage tools in the skill do not call it yet, and `gen.mjs still` is FLUX only (gen.mjs:44,116); `--image` is dropped silently | yes | S | tool: `footage/still.mjs sheet` (gpt-image-2 generations, dry run + estimate + `--go`, key read from .env and never printed, .json logs + seeds) and a sheet prompt template | A |
| FT-2 | ~15 per-shot key frames with several references | missing | No multi-reference edits; no 3:2 → 16:9 crop/pad (1536x1024 loses 15.6 % of H); no brand-mark check | yes | M | tool: `still.mjs edit --ref …` (multipart image[]), a per-shot ref list, crop/pad to 16:9 before i2v, a logo/mark check | A |
| FT-3 | Identity + wardrobe continuity QA across stills and clips | missing | No continuity check or guidance; the @file → data-URI route for R2V refs (gen.mjs:144-152) is undocumented and unverified on fal | yes | M | tool: `footage/continuity.py` (face crops, jacket-mask hue/share on first/mid/last frames, drift flags); doc the raw R2V route once fal field names are confirmed | A |
| FT-6 | Long takes: 9.3 s shots, the 11.6 s FPV opening | partial | gen.mjs clamps i2v to 5–10 s (gen.mjs:128); fal duration range and end-frame field unverified offline | yes | S | tool + doc: raise the clamp to the confirmed range, `--last` end frame, a seam check for chained clips; fallback split S01 at n88-101 | A |
| FT-7 | Batch ~15 plates with one estimate and approval | partial | One request per command; two approvals per plate (FOOTAGE.md:49-51) | yes | M | tool: `footage/plates.mjs plates.yaml` (refs, prompts, sec, seed per shot; one total; background run + fetch; status table) | A |
| FT-8 | A camera move per plate on the measured grammar | partial | i2v takes no camera field (gen.mjs:128); nothing compares our track with the reference within a tolerance | yes | S | doc + tool: motion-brief recipes per move with paid test rolls; `track.py --vs ref.json --tol`; slow moves via WP-B camera keys | A |
| FT-9 | Crash-zoom ×5.6 and pull-backs ×0.41 inside one plate | partial | `push` is linear, so the rate falls (18.8 → 10.3 %/mf vs +1.7 → +13.5); WP-0 caps push at ±0.5, which kills the push 4.6 / −0.59 routes | yes | S | engine: a scale term on `pan` (tanh/expo curve) so the camera blur follows an accelerating zoom (B4) | B |
| FT-10 | Overlays locked to moves made inside the clip | partial | Only via a custom block (trackpin.mjs); no `track:` field; track.py pixels are not stage coordinates | yes | M | block option: `track: file.json` on scene overlays via `ctx.track()` (B1); `track.py --stage` output (A) | C |
| FT-11 | Landing events inside a clip on the edit frames | partial | Breakdown finds flashes only, misses in-clip zooms, and exits 1 before breakdown.json (breakdown.mjs:1004-1008) | yes | S | tool: `recreate/events.py` (scale-step + luma-ramp over track/look output); fix breakdown's exit order | A |
| FT-13 | Grade each plate to looks A–H | partial | Starting grades exist for three hf02 looks only (FOOTAGE.md:92-96) | yes | S | tool: `footage/looks.json` (8 targets + starting grades) or `look.py --fit` | A |
| FT-14 | Motivated light change (fire relight, temple drop) | partial | Time-keyed grade works but is global, undocumented and has no keyframe helper | yes | S | tool + doc: `conform.py --grade-keys` (keyframed eq/colorbalance) and a FOOTAGE.md recipe | A |
| FT-15 | In-shot VFX: arrow, impact, light shaft, fire | missing | No VFX recipes; additive light only in a custom block (shaft.mjs); blend modes unchecked under --layers | yes | M | doc + template: H3 VFX prompt recipes (paid test rolls); ship shaft.mjs and trackpin.mjs as `templates/blocks/` | A |
| FT-16 | 24 fps footage on the reference repeat phase {5,10,14} | partial | A uniform cadence hits 2 of 3; the 5/4/6 spacing needs an index map | yes | S | tool: `conform.py --map cadence.json` (out[n] = master[m(n)]); document the sub-frame `--start` phase trick now | A |
| FT-17 | 24p edit master delivered at 30 | partial | `--film` is 60 fps only; per-shot rounding gives 95 frames for a 96-frame film | yes | M | engine: `fps: 24` film on global 24 fps slots, QA at 24, index-map mux (B6) | B |
| FT-18 | Phone shot with a pinned email screen, low-key plate | partial | pin.py `--dark` advice is backwards for low-key plates (pin.py:118); no steep angles; no blur/grain/glow on the screen | yes | S | tool: `pin.py --dark auto`, fix FOOTAGE.md:132, `--blur/--grain/--glow` | A |
| FT-20 | Diegetic audio (beds, foley) + the character's lines | partial | conform/pin drop audio (`-an`); no `sfx:` file field; no beds | yes | M | tool + audio: `conform.py --keep-audio` (A); beds, foley and lines placed by the score (E2, E3) | E |

### Agent UI over footage (OV)

| ID | Need | Now | What's missing | Manus | Effort | Proposed fix | WP |
|---|---|---|---|---|---|---|---|
| OV-1 | Prompt bar static look (glass, coral rim, armed send) | partial | Opaque .86 fill, no backdrop blur; send not armed on entry; caret always on; `size` undocumented | yes | S | block option (scene bar): `glass: {blur, alpha}` with a --layers-safe fallback, `armed: true`, `caret: false`, document `size` | C |
| OV-2 | Bar entry: smear-grow, then a scale spring | partial | Fade + outExpo rise, no overshoot; K.spring unused (scene.js:231-233) | yes | S | block option: `enter: spring {w, z}` + x-only smear-grow from an origin + rim flash on the pop | C |
| OV-3 | Typing: fast prompts from the pop, human pauses, coral tail | partial | Pauses only via a zero-width-space hack that ticks; starts 4-5 f late; no tail colour | yes | S | block option: `typing: {cps, start: pop, pauses: [[i, f]], tail}` with silent pauses | C |
| OV-4 | Outline glow breathing (~21 f period) | missing | Static glow and edge (scene.js:116-117, 142-148) | yes | S | block option: `glow: {period, amp, peakOnPop, travel}` | C |
| OV-5 | Send arm + white-hot press with halo | partial | A 1→2.3 ring instead of a halo; send fixed at last char + 8 f | yes | S | block option: `send: {hold, press: hot, halo}` | C |
| OV-6 | Send pixel burst | missing | No pixel-block primitive in the engine | yes | M | helper: `_pixels.js` (seeded block field on the measured path/curve) + `burst:` on the bar (C4) | C |
| OV-7 | Bar exit collapse | partial | `until` only fades (scene.js:224) | yes | S | block option: `exit: collapse {sx, sy, frames}` | C |
| OV-8 | Overlays screen-fixed (no bob) | partial | Bar and bubble bob 3-4u on a sine | yes | S | block option: `bob: 0` per overlay | C |
| OV-9 | Full-frame light status screen | partial | No glyph beside the lines, tool line, weight, flat ground (radial highlight, runtime.js:397), wipe reveal or export card | yes | M | block options (agent title mode): `glyph`, `tool: {icon, text}`, `weight`, `reveal: wipe`; shot `ground: flat` (B3); export card = SC-18 | C |
| OV-10 | Status plate cut in already rising, fast exit | partial | After a cut the entry is a scale settle; a drift entrance needs a drift exit and plays a whoosh | yes | S | engine: shot `enter: {dy, decay}` independent of the previous exit, no whoosh (B3) | B |
| OV-11 | Soft gradient wipe text reveal | partial | wipe() is private to agent (agent.js:120-124); bubbles fade, replies stream words | yes | S | helper: `reveal: wipe {pxPerF, edge, lineDelay}` for status lines and bubbles | C |
| OV-12 | One-shot shimmer + colour arrive/drain | partial | Shimmer only loops; no left-to-right drain | yes | S | helper: `F.sweep({at, speed, depth})` + `colour: {arrive, hold, drain}` | C |
| OV-13 | Agent glyph rays + tool icon spring pop | partial | 8 fixed-sine rays; no icon-square primitive | yes | S | helper: `F.spark({rays, noise})` + `F.iconSquare({fill, glyph, r})` with spring pop and entry blur | C |
| OV-14 | Message bubble / email card over footage | partial | outBack pop, fixed width, `\|` printed literally, sender right only, bob | yes | M | block option (scene bubble): `enter: grow`, wipe text, `width`, `\|` breaks, `side`, radius, fill, sink-fade exit, `kind: email` | C |
| OV-15 | Floating dialogue words | partial | Golden-angle scatter, dim exit, radial per-word drift | yes | S | block option (scene words): `layout: stack\|[pos]`, `exit: blur`, `drift: [dx, dy]`, `sharp`, `weight`, `opacity` | C |
| OV-16 | Watermark / corner bug on its own clock | missing | No stage-level overlay track | no | M | park (a stage `bug:` layer only if we keep a bug) | park |
| OV-17 | Pixel-art sprite mascot | missing | No sprite overlay kind | no | M | park | park |
| OV-18 | Shape-swap morph chain | missing | No swap/ghost primitive, no pixel dissolve | no | L | park | park |
| OV-19 | Free cursor in any shot | partial | Arrow only with `tap:` in phone/browser/panel; outCubic approach and press | yes | M | helper: `_cursor.js` (waypoints {at, x, y, hold}, drift/hop/hold, no click) + a `cursor` scene overlay (C4) | C |
| OV-20 | 24 fps content stepping in the 30p film | partial | The film pass renders blocks and camera at continuous t, 60 fps | yes | M | engine: `fps: 24` quantises block and camera time (B6) | B |

### Editor screens & the deliverables (SC)

| ID | Need | Now | What's missing | Manus | Effort | Proposed fix | WP |
|---|---|---|---|---|---|---|---|
| SC-1 | Editor window shell (our design) | missing | No editor block; entrance decay and zoom-settle amplitude fixed | yes | M | new block: `editor` (shell, panels, title bar, tabs, toolbar, effects list, viewer row, wallpaper edges); decay via `drift.decay` from WP-0 | C |
| SC-2 | Timeline panel (ruler, layers, named clips, score track) | missing | No track or layer element; no ruler/playhead | yes | M | new block part: `editor.timeline` (ruler, playhead + timecode, layers, bar stagger, named clips, waveform, reorder drag + ghost) | C |
| SC-3 | Keyframe diamonds popping | partial | kit.spring fits; only the diamond element and its 24p schedule are missing | yes | S | part of `editor.timeline`: `keys: [...]` | C |
| SC-4 | Project panel folder tree | missing | No tree element | yes | S | part of `editor`: `tree: [...]` (chevrons, chips, typed names, search) | C |
| SC-5 | Comp viewer playing footage | partial | No viewer chrome or transform handles | yes | S | part of `editor`: `viewer: {clip, toolbar, zoom, timecode, handles}` | C |
| SC-6 | In-screen re-frames: bell pans, keyed zooms | partial | Symmetric tanh pans, constant zoom, linear push; no 24p camera step; job blocks lack dirBlur | yes | M | engine: camera keys (`zoom: [{at, to, len, curve}]`, pan shape {in, out}), `ctx.dirBlur` (B1, B4) | B |
| SC-7 | Screen-to-screen momentum cuts | partial | Fixed whip/zoom amplitudes and entrance decays; no diagonal exit | yes | M | engine: per-cut `strength` / `decay` for every `out:` type + a diagonal zoom-pan exit (B3) | B |
| SC-8 | Screen-recorded cursor in the editor | partial | Only in browser/panel with `tap:`; drop shadow, fade, press | yes | S | `_cursor.js` track or a pasted ae-cursor.json, with drags tied to marquees (C4) | C |
| SC-9 | "Made live" UI: marquee, handles, text box, ghost | missing | Only float.js focus brackets and type.js zoom ghosts | yes | M | helper: `_marks.js` (marquee, handles, text box, placeholder, ghost frame) | C |
| SC-10 | Type-on into comp text with a caret | partial | Caret typing exists only in prompt bars | yes | S | helper: `typeOn({perMf, caret, box, deselect})` in `_marks.js` | C |
| SC-11 | Pop and drag curves (overshoot + undershoot, beziers) | partial | outBack never undershoots; no K.bezier; no 24p quantise | yes | S | engine kit: `K.bezier(x1,y1,x2,y2)`, `K.quant24(t)` (B1, day 1) | B |
| SC-12 | Mascot badge build + cartoon bubble | missing | — | no | L | park | park |
| SC-13 | Brand-pieces board + sunburst grounds | missing | — | no | M | park | park |
| SC-14 | Illustrated trail map | missing | — | no | L | park | park |
| SC-15 | Photo cards + lime pixel-ring reveal | missing | Only linear-gradient wipe masks | yes | M | helper: `ringReveal({seed, radii, width, sparkle, glowFade})` in `_pixels.js`, fed by ae-reveal.json (C4) | C |
| SC-16 | Pixel-burst reveal (the ring's sparkle edge) | missing | No particle or dissolve helper | yes | S | the same `_pixels.js` sparkle as OV-6 / SC-15 | C |
| SC-17 | Poster build ("Sun Gate") | missing | — | no | L | park | park |
| SC-18 | Render/download card | partial | Items fade in from local f10; a 24 px outBack rise vs 95 [169] px with blur; no split button | yes | S | block option (ui card): `kind: export` (file tile, split button + chevron, content on f0, rise-with-blur) | C |
| SC-19 | Deliverable art via gpt-image-2 | partial | API + client code exist (see FT-1); the skill has no route and no transparent output | yes | S | same tool as FT-1/FT-2: `still.mjs` with `--transparent` | A |
| SC-20 | Finished promo full-bleed, match-cut from the viewer | partial | Media `move` collision (fixed by WP-0, ENG-1); a hard cut enters at 0.96, so brand bg shows in the outer 12 px | yes | S | engine: `enter: none` (B3); scene + `bg:` with `bgMove: none` until then | B |

### Edit grammar, transitions & camera (ED)

| ID | Need | Now | What's missing | Manus | Effort | Proposed fix | WP |
|---|---|---|---|---|---|---|---|
| ED-2 | Shot lengths in 24p master frames | partial | No `mf` unit or absolute cut list; `sec: mf/24` lands 0/26 cuts exact | yes | M | engine: `cuts:` absolute frame list or an `mf:` length unit (B6) | B |
| ED-3 | Render the film on a 24 fps clock | partial | `--film` fixed at 60; clip rounding is 1 mf off in 5/27 shots | yes | M | engine: `fps: 24` film (B6) | B |
| ED-4 | 30p delivery with the {5,10,14} cadence | missing | No fps filter or `--start` gives the 5/4/6 spacing (2000 phases swept) | yes | M | engine + tool: index-map delivery from the 24p master (B6 + `conform.py --map`) | B |
| ED-5 | Hard cut with no added move | partial | The drift-0 trick works but adds a whoosh and QA INFO; the first shot's −.06 can't go | yes | S | engine: shot `enter: none` + `whoosh: false` (B3) | B |
| ED-6 | card-in / card-out | partial | Entrance decay fixed; a whoosh per cut; cut-frame σ ≈ 2.4 vs 10 | yes | S | engine: `enter: {dy, decay}` + cut-frame blur (B3, B5) | B |
| ED-7 | card-out-up | partial | Entrance decay fixed (0.64/mf vs 0.78); no snap-up smear frame | yes | S | engine: `drift.decay` (WP-0) + exit build + smear frame (B3, B5) | B |
| ED-8 | whip-left n776 | partial | Whip amplitude 5× the reference and not scalable | yes | S | engine: whip `strength` + entrance decay (B3) | B |
| ED-9 | zoom-in n807 | partial | Starts at 82 % vs 92.2 %; exit +35 % in-cubic vs +13 % expo | yes | S | engine: zoom-cut `{amount, curve, start}` (B3) | B |
| ED-10 | zoom-out n994 | partial | Starts at 130 % vs 116 %; exit −19 % vs −7 % | yes | S | engine: same zoom-cut fields (B3) | B |
| ED-11 | zoom-in-diag n1035 | partial | Translation capped at W/2 (focus 0–1); fixed amounts and decay | yes | M | engine: diagonal exit `{dx, dy, ds, build}` + entrance decay (B3) | B |
| ED-12 | Arrow whip snap-stop | partial | The cut adds the entrance zoom or a whoosh; 22 px blur cap | yes | S | engine: `enter: none` + blur cap (B3, B5); the whip itself from H3 (WP-A) | B |
| ED-13 | Cut to the dimmed frozen end card | partial | No freeze of the previous shot; lockup at 75 %/97 % on the cut frame; logo wobble | yes | M | engine: `bg: {freeze: prev}` two-pass (B7); endcard `in: cut`, `wobble: 0` (D4) | B |
| ED-14 | Title flash-in with expo decay | partial | No in-shot flash pulse | yes | S | block option (type): `flash: {at, decay, tint}` (D2) | D |
| ED-15 | Title zoom-through over a continuing plate | partial | type's bgMotion ×1.14 can't be turned off; curve not ×1.33/mf; the seam plays a whoosh | yes | M | block option (type): `bgMotion: none`, `through: {curve, end}` (D2) + `enter: none`, `whoosh: false` (B3) | D |
| ED-16 | Momentum grammar across screen cuts | partial | Constant entrance decays; whip/zoom amplitudes fixed; a whoosh on every moving out | yes | S | engine: per-cut strength/decay + `whoosh:` (B3) | B |
| ED-17 | Motion blur grammar + smear frames | partial | Cap 22 px; zoom blur isotropic ≤ 12 px; half blur on entrance cut frames; no smear frame | yes | M | engine: `blur: {cap, zoom: radial, cutFrame: full}`, `smear: 1` (B5) | B |
| ED-18 | In-screen re-frames: asymmetric bells | partial | Symmetric tanh pans only; no scale bells or keys | yes | M | engine: camera keys on `K.pulse` (B4) | B |
| ED-19 | Holds and dead-still stretches | partial | One hold per shot; FREEZE_RUN = 3 fails every held 24p master frame | yes | S | engine: `hold: [[a, b], …]`; freeze QA aware of 24p repeats (B6) | B |
| ED-20 | One shot per frame: content across cuts | partial | A type title can't share a shot with scene overlays; the seam plays a whoosh | yes | M | engine: shot-level `overlays:` on any block (B8) | B |

### Title, end card & brand (TI)

| ID | Need | Now | What's missing | Manus | Effort | Proposed fix | WP |
|---|---|---|---|---|---|---|---|
| TI-1 | Official Manus master SVG as the logo | partial | The var(--logo-color) masters paint nothing in an <img>; brand.logo takes one file | yes | S | engine: `brand.logoDark`; inline the master with currentColor; doc the -dark/-white files (B2) | B |
| TI-2 | Mark #34322D on light, white on dark | missing | The tint style breaks at `url(` (runtime.js:276): logo invisible, QA PASSED with 0 logo px; lockup/title never pass onDark | yes | S | engine: fix the quoting, onDark from ctx.dark, a QA check that a declared logo has ink (B2) | B |
| TI-3 | Mark + serif wordmark lockup (~30 % W) | partial | Static only, via a hand-built bg SVG; no brand.wordmark; endcard sets the name in Inter | yes | M | helper: `_brand.js` lockup (mark ≈ 2.7× wordmark x-height) for type, lockup and endcard; `brand.wordmark` field (B2) | D |
| TI-4 | Serif brand face (Libre Baskerville kind) | partial | One brand.font for everything; `face: serif` is hard-coded Bodoni/Didot | yes | S | engine: `brand.serif {family, files}` used by `face: serif` (B2); the OFL woff2 needs a download | B |
| TI-5 | Title over footage with its own hold push | partial | Title push hard-coded 1 → 1.035 (type.js:86); shot push also pushes the plate | yes | S | block option (type): `holdPush: rate` | D |
| TI-6 | Hero-word slam | partial | Fixed 1.16 → 1 outExpo; no smear, decaying coloured glow or dot develop | yes | M | block option (type): `slam: {from, frames, power, at}`, `smear`, `glow: {color, decay}`, `develop` | D |
| TI-7 | Two-stage lockup: big drop, then small glide up | missing | The over line is small from the start, moves down, no overshoot | yes | M | block option (type): `lockup: {drop: spring, then: {scale, glide}}` | D |
| TI-8 | Lockup pieces in mixed faces, white over footage | partial | Names Inter 700 in ink, × muted, logo L×L, no onDark (WP-0 d3f9f08 makes names light-on-dark) | yes | M | block option (lockup): per-piece face/size/weight, superscript, wide logos; re-check after WP-0 | D |
| TI-9 | Pill squash-in with gradient fill | partial | Clip-path wipe, solid accent fill | yes | M | block option (type pill): `enter: squash {sx, rise}`, `fill: gradient`, `border`, `color` | D |
| TI-10 | Zoom-through exit to ×4.7, plate continuing | partial | 9^(z²) to ×9; the next Ken Burns restarts; the cut entrance adds −4 % | yes | S | block option (type): `through: {end, curve}` (D2) + `enter: none`, `whoosh: false` (B3) | D |
| TI-11 | Title decor (glass chips, sparkle pops) | missing | One block per shot; type carries no decor | yes | M | engine: `overlays:` on any shot (B8) + chip/sparkle overlay kinds (C) | B |
| TI-12 | 24 fps steps on the title and end card | partial | The film path is 60p only | yes | M | engine: `fps: 24` film (B6) | B |
| TI-13 | End caption: one static caps line, cut on | partial | Words rack-focus in, drift and grow; weight 600 fixed; `at` must be ≥ 0 | yes | S | block option (scene): a `line` overlay kind (cut-on, static, weight, pos) | C |
| TI-14 | End-card ground: last frame frozen ×0.23 | partial | The cut entrance zooms the ground; drift-0 adds a whoosh; no freeze-previous; QA needs holds | yes | S | engine: `bg: {freeze: prev}` (B7) + `enter: none`, `whoosh: false` (B3) | B |
| TI-15 | Glyph over handle, swell/snap/recover | missing | endcard is a horizontal row, fade + scale, ±4° wobble | yes | M | block option (endcard): `layout: stacked`, `track: swell`, `wobble: 0`, `in: cut` | D |
| TI-16 | Rotating gradient ring on the glyph | missing | Only a linear text shimmer (_film.js:108-109) | yes | S | helper: conic sweep in `_brand.js` ({rate, satIn, satOut}) used by endcard | D |
| TI-17 | Social handle line under the glyph | partial | Tagline/url are brand-face text that fade in | yes | S | block option (endcard): `handle: {text, face, scaleWithGlyph, at}` | D |
| TI-18 | The Manus end card: mark + serif wordmark, our reveal | partial | Name set in Inter (endcard.js:18); fade + scale only; cast defaults to 7 | yes | M | block option (endcard): `lockup: wordmark`, `reveal: [dot, mark, wordmark]`, films default `cast: 0` (needs TI-2/3/4) | D |
| TI-20 | Film-wide corner bug | missing | No global overlay track | no | M | park (same as OV-16) | park |

### Score, sound design & voice (SN)

| ID | Need | Now | What's missing | Manus | Effort | Proposed fix | WP |
|---|---|---|---|---|---|---|---|
| SN-2 | Unpulsed opening: drone + pad, no arp/shaker | missing | Arp and shaker run from bar 0; breaks only work after the drop (audio.mjs:89-91, 113-128) | yes | M | audio: `intro: drone {key, until}` at body level (E1) | E |
| SN-3 | F-minor harmony, ostinato, separate intro key | missing | KEYS are pitch classes only; FILM_PROG is major 9ths; the key check can't see mode | yes | M | audio: `mode: minor` progressions, `ostinato:` table, `introKey` (E1) | E |
| SN-4 | Two levels: sparse build, then the full drop | missing | One drop, one groove level | yes | M | audio: `build: <shot>` + `drop:` arrangement tiers (E1) | E |
| SN-5 | Break shape: hats kept, 808 hits inside, quiet return | partial | The dip drops the hats, has no hits, and returns with a forced riser + crash | yes | S | audio: `breaks: [{shot\|span, hats: keep, hits: [beats], rise: false}]` (E1) | E |
| SN-6 | Arrangement variations: lead, mini-break, stutters | missing | Breaks only, and whole shots only | yes | M | audio: `lead: [spans]`, `stutter: [{at, len}]`, breaks as time spans (E1) | E |
| SN-7 | Half-time 808 groove | missing | Pattern hard-coded: kick 1+3, clap 2+4 (audio.mjs:135-148) | yes | M | audio + voices: `groove: halftime` table + a tuned 808 voice with glide (E1) | E |
| SN-8 | Outro: groove stops on bar 25, sub tail, no lift | partial | Needs a shot split; pad + shaker pulse stay; no sub tail; the lift still runs | yes | S | audio: `outro: <shot\|s>` + `lift: false` (E1) | E |
| SN-9 | 0.518 s silence before the sting | partial | FILM_SILENCE is a constant .44 (audio.mjs:35) | yes | S | audio: `music.silence` (E1) | E |
| SN-10 | Ambience beds (water, birds, rapids) | partial | Only a premix in the voiceover slot; no bed voices | yes | M | audio + voices: `ambience: [{file\|synth, from, to, gain, fade}]`, water/bird synths, H3 clip audio (E2) | E |
| SN-11 | Diegetic foley one-shots | partial | Only pop/tick/click/chime/hit; placement needs a custom block | yes | M | voices: scrape, whoomp, thunk, steps, whoosh-as-cue; per-shot `sfx: [{t, kind\|file, gain}]` (B3 plumbs, E2 renders) | E |
| SN-12 | Silent transitions | partial | Every moving `out:` gets a whoosh; only the global `music.level` hack hides it | yes | S | engine: shot `whoosh: false\|gain` (B3); audio honours the cue gain (E2) | B |
| SN-13 | Interface silent (no ticks, pops, clicks) | partial | prompt/ui/scene/agent cues can't be muted per shot | yes | S | engine: shot `sfx: off\|gain` (B3) | B |
| SN-14 | Spoken character line + shout: a voice source | missing | No TTS in the skill; the OpenAI key is approved for gpt-image-2 only | yes | M | tool: `voice/tts.mjs` (OpenAI speech, dry run, `--go`, per-line instructions) + a `say` draft mode (E3) | E |
| SN-15 | Several voice lines at their own times | partial | `voiceover` takes one file and one start | yes | S | audio: `voiceover.lines: [{file, at, gain}]` (E3) | E |
| SN-17 | Voice level against the local bed | partial | The voice file is fixed at integrated music + 6 LU | yes | S | audio: `voiceover.level` (dB) and per-line gain (E3) | E |
| SN-18 | Mascot chirps | missing | No voiced/formant voice | no | S | park | park |
| SN-19 | Mix: LRA ~3.5 LU, mono lows | partial | LRA 12.2 LU vs 3.5; no mono below 150 Hz | yes | S | audio: body-level intro (SN-2) + `monoBelow: 150` (E4) | E |
| SN-20 | Verification against the reference | partial | compare's verdict ignores groove, key and sections; it passed a score wrong five ways | yes | S | tool: `music.py compare --from/--to`, judged groove r per band, section-entry lags, quiet stretches, top-N hits (E4) | E |
| SN-21 | Fallback: whole score from a job script | partial | In track style the end card's hit sounds inside the silence | no | S | park (track-style end-card mute) | park |
| SN-22 | No risers or crashes at section changes | missing | Forced risers + crashes into the drop, out of breaks and at the lift (audio.mjs:159-165) | yes | S | audio: `marks: false` (E1) | E |
| SN-23 | Sting voicing (C/G) and digital zero after | partial | F-major tonic stab + bells + a pad to the end | yes | S | audio: `sting: {chord, ring, tail: zero}` (E1) | E |
| SN-24 | Title static bursts + sub thumps | partial | No static voice; the hit's bell doesn't fit | yes | S | voices: a `static` cue kind (gated broadband burst) (E2) | E |

## 3. Build order

Each package is one opus worker plus a monitor; review runs sonnet → codex → opus; three QA runs, then Alex's test; no
commit without Alex's approval. Packages own their files outright. The two shared files are `lib/spec.mjs` (each package
validates only its own fields, in its own block of the file) and `GUIDE.md` (each package writes only its own section);
they merge in the order WP-B → WP-C → WP-D → WP-E → WP-A, the "keep both" pattern the fix round used. Option for WP-0:
split `spec.mjs` mechanically into `lib/spec/{shot,brand,blocks,music}.mjs` first (same behaviour, proven by `--grid` on
every old job), which removes the main merge conflict.

| Tier | Fixes | Why / dependency |
|---|---|---|
| **Gate** (before anything) | WP-0: merge the 10-21 fix round | Touches lv.mjs, runtime.js, kit.js, spec.mjs, timeline.mjs, qa.mjs, scene.js, agent.js, type.js, lockup.js; changes drift, push and media numbers this audit measured |
| **Unblocks the Manus draft** (no in-skill route today) | A1 stills, B1 helpers, B2 logo + brand fonts, B3 cut control + `whoosh:`/`sfx:`, C1 prompt bar, C5 editor shell + timeline, D4 end card, E1 intro + no risers + silence | Every plate needs a gpt-image-2 key frame; the logo is invisible when tinted; every cut adds a zoom or a whoosh; Loops 1–3 need the editor |
| **Makes it read like higgsfield01** | B4 camera keys, B5 blur, B7 frozen ground, C2–C4 status screens, bubbles, cursor, pixels, D2 type, D3 lockup, E2 beds + foley, E3 voice, A2–A5 batch, continuity, looks | The measured grammar: momentum cuts, crash-zooms, status cards, the end card's ground, diegetic sound |
| **Frame-exact polish** | B6 24p master + cadence, B8 overlays on any shot, A6–A7 events + index map, E4 mix + compare | Matters for a side-by-side with the reference; the draft can live at 30p |
| **Park** | OV-16, OV-17, OV-18, SC-12, SC-13, SC-14, SC-17, TI-20, SN-18, SN-21 | Not in the Manus Option A beat sheet (PITCH.md:267-280) |

### WP-0 — Merge the 10-21 fix round first (serial; gates every package)

- **What.** Merge `fix/engine` (cbe583f), `fix/film` (df65a81 plus its uncommitted edits to GUIDE.md, scene.js, wall.js,
  lv.mjs), `fix/reel` (9276475 + `wip-2026-10-22/reel-uncommitted.patch`) and `fix/tools` (1d37bfb +
  `tools-uncommitted.patch`) from `Design-AutoPilot-stable/qa/launch-video-skill-review/fix/` onto **live**, never onto
  `snap/`; then re-apply the port with `qa/hf02full-skill-port/lead/apply_pointers.py`.
- **Files.** lv.mjs; engine/runtime.js, kit.js; lib/spec, timeline, qa, render, layers, sheet, fingerprint, breakdown;
  blocks scene, agent, roster, stack, wall, type, lockup, _film, _reel, cta, float, media, split, sticker; GUIDE.md;
  templates.
- **Re-measure after.** Re-run the scratch probes whose numbers move: the push routes (FT-9: push 4.6 and −0.59 become
  rc-2 errors at ±0.5), the drift entrance/exit rates (now ×0.65 and ×1.40/f30, with `drift.decay` 0.3–0.95), media
  `move: none` (closes half of SC-20), lockup over footage (TI-8) and the prompt-bar geometry (OV-1, scene.js changed).
- **Done when.** NOTE-hf02-port-merged.md's re-test list passes, plus `fix/regress/` and the acceptance harness.

### WP-A — Footage, stills and recreate tools — 13 rows (9 S, 4 M)

- **Files (exclusive).** footage/gen.mjs, new footage/still.mjs, plates.mjs, continuity.py, looks.json; footage/conform.py,
  pin.py, _media.py, look.py; recreate/track.py, new recreate/events.py; lib/breakdown.mjs; FOOTAGE.md, RECREATE.md,
  templates/footage-prompts.md, new templates/blocks/ (trackpin, shaft, badgecam, foley from the scratch runs).
- **Order (Manus first).**
  - **A1. `still.mjs`** (FT-1, FT-2, SC-19): port `Design-AutoPilot-stable/pipeline/image_gen.py:275-400` (generations +
    multi-reference edits), add `--transparent`, crop/pad to 16:9, the gen.mjs-style dry run, estimate and `--go`.
    The key comes from `.env` and is never printed. It lives inside footage/, not in a parallel skill.
  - **A2. `plates.mjs`** (FT-7): one manifest, one total, one approval, a status table.
  - **A3. `continuity.py`** (FT-3).
  - **A4. Long takes and moves** (FT-6, FT-8): the clamp, the end frame, the raw recipes and `track.py --vs/--tol`.
    The paid test rolls need Alex's OK.
  - **A5. Looks, light and VFX** (FT-13, FT-14, FT-15): looks.json, `--grade-keys`, the VFX recipes and the block
    templates.
  - **A6. `events.py`** + the breakdown exit fix (FT-11).
  - **A7. Delivery helpers** (FT-16, FT-18, FT-20, ED-4): `conform.py --map cadence.json`, `--keep-audio`,
    `pin.py --dark auto`, `track.py --stage`.
- **Depends on.** Nothing in the engine. A7's `cadence.json` format is shared with B6.

### WP-B — Engine: cuts, camera, 24p, stage — 33 rows (19 S, 14 M)

- **Files (exclusive).** engine/runtime.js, engine/kit.js, lib/timeline.mjs, lib/qa.mjs, lib/render.mjs, lib/common.mjs,
  lib/deliver.mjs, lib/fingerprint.mjs, lv.mjs; the shot and brand sections of lib/spec.mjs.
- **Order (Manus first).**
  - **B1. Day-1 helpers** (SC-11, and for FT-10, SC-6): `K.bezier`, `K.quant24`, `ctx.dirBlur`, `ctx.track(json, t)`.
    WP-C and WP-D build on these, so they land first.
  - **B2. Brand plumbing** (TI-1, TI-2, TI-4): fix the logo-tint quoting at runtime.js:276; add `brand.logoDark`,
    `brand.wordmark` and `brand.serif`; onDark follows `ctx.dark`; a QA check that a declared logo has ink.
  - **B3. Cut control** (ED-5…12, ED-16, OV-10, SC-7, SC-20, TI-14, SN-12, SN-13):
    - shot `enter: none | {s, x, y, decay}`, so the first shot's −.06 can go too;
    - per-cut strength and decay for every `out:` type, plus a diagonal exit;
    - shot `whoosh: false|gain`, `sfx: off|gain` and `sfx: [{t, kind|file, gain}]`. Cues gain `gain` and `file` fields,
      which WP-E renders;
    - shot `ground: flat`.
  - **B4. Camera keys** (FT-9, SC-6, ED-18): a scale term on `pan`, zoom keys and asymmetric bells on `K.pulse`, with
    an exception to GUIDE.md:281 for editor screens.
  - **B5. Blur** (ED-17): the cap, radial zoom blur, full blur on the cut frame, a one-frame smear.
  - **B6. 24p film** (FT-17, OV-20, ED-2, ED-3, ED-4, ED-19, TI-12): `fps: 24` on global slots, `mf:` units or an
    absolute `cuts:` list, the index-map mux, QA at 24, several holds per shot, a freeze rule that knows 24p repeats.
  - **B7. Frozen ground** (ED-13, TI-14): `bg: {freeze: prev}`, a two-pass render of the previous shot's last
    composited frame.
  - **B8. Overlays on any shot** (ED-20, TI-11): shot-level `overlays:` drawn over any block. It needs WP-C's overlay
    renderers split out of scene.js into `_overlays.js`.
- **Rule.** Every new field defaults off, and the old jobs must stay pixel-identical (§5).

### WP-C — UI kit: prompt bar, status cards, bubbles, cursor, editor — 28 rows (19 S, 9 M)

- **Files (exclusive).** engine/blocks/scene.js, _film.js, agent.js, ui.js, panel.js, index.js; new editor.js, _editor.js,
  _pixels.js, _cursor.js, _marks.js, _overlays.js; templates/film.yaml; the film-block section of lib/spec.mjs.
- **Order (Manus first).**
  - **C1. Prompt bar** (OV-1…8), used in the Problem act and the Loop 3 prompt.
  - **C5. Editor shell + timeline** (SC-1…5, SC-18), for Loops 1–3 and the export card. It is ours, built from
    higgsfield01's generic timeline vocabulary and never Manus's Video Editor (PITCH.md:370).
  - **C2. Status screens + text helpers** (OV-9, OV-11, OV-12, OV-13, TI-13): wipe, sweep, icon square, the `line`
    overlay.
  - **C3. Bubbles, words and tracked overlays** (OV-14, OV-15, FT-10): the Brief card and the email.
  - **C4. `_pixels.js` and `_cursor.js`** (OV-6, OV-19, SC-8, SC-15, SC-16), then `_marks.js` (SC-9, SC-10).
  - **Last.** Split the overlays out into `_overlays.js` for B8.
- **Split option.** Two workers can share this package along file lines: scene.js, _film.js and agent.js vs editor.js,
  ui.js and panel.js. `_pixels.js` and `_cursor.js` belong to the first; the second imports them.

### WP-D — Title, end card and brand — 13 rows (5 S, 8 M)

- **Files (exclusive).** engine/blocks/type.js, lockup.js, endcard.js, title.js; new _brand.js; the job-side font files;
  the type/lockup/endcard section of lib/spec.mjs.
- **Order (Manus first).**
  - **D4. End card** (TI-15, TI-17, TI-18, part of ED-13): mark + serif wordmark, our reveal, `in: cut`, no wobble,
    `cast: 0`.
  - **D1. `_brand.js` lockup + conic sweep** (TI-3, TI-16).
  - **D2. type** (TI-5, TI-6, TI-7, TI-9, TI-10, ED-14, ED-15): hold push, slam, flash, two-stage lockup, pill squash,
    `through:` curve, `bgMotion: none`.
  - **D3. lockup pieces** (TI-8).
- **Depends on.** B2 (logo, wordmark, serif) and B3 (`enter: none`, `whoosh: false`).

### WP-E — Score, sound effects and voice — 19 rows (10 S, 9 M)

- **Files (exclusive).** lib/audio.mjs, lib/voices.mjs, recreate/music.py, new voice/tts.mjs; the music/voiceover section
  of lib/spec.mjs.
- **Order (Manus first).**
  - **E1. Form** (SN-2…9, SN-22, SN-23): intro drone, `marks: false`, `music.silence`, minor mode + ostinato,
    build/drop, break options, lead/stutter, half-time 808, outro, sting.
  - **E3. Voice** (SN-14, SN-15, SN-17): `tts.mjs` (dry run, `--go`) plus a `say` draft mode; `voiceover.lines` and
    `level`.
  - **E2. Beds, foley, static** (FT-20, SN-10, SN-11, SN-24): new voices, file cues, H3 clip audio from A7.
  - **E4. Mix + verification** (SN-19, SN-20): mono lows, and a `compare` that judges groove, sections and quiet
    stretches.
- **Depends on.** B3's cue `gain`/`file` fields for E2. Until then, test through a custom block's `cues()`.
- **Two Alex decisions come first.** The tempo (87.01 vs Manus's 128 BPM) decides whether E1's F-minor work at 87 BPM is
  wanted. VO or type-only for the Problem act decides E3.

## 4. What the skill already does well for this film

- **Have.**
  - **FT-4.** Graded, conformed plates as full-bleed backgrounds under UI overlays: a 9.4 s 24→30 plate passed `--film` QA, all 8 checks.
  - **FT-5.** MiniMax H3 image-to-video on fal with the cost gate, background run and paid-request resume (real paid log in hf02-full).
  - **FT-12.** `footage/look.py` measures every SHOTS.md §4 look target (p2, p50, deep shadow, saturation, R−B) on the reference and on ours.
  - **FT-19.** Footage inside a masked viewer badge via a declared media field + `ctx.footage` (`--clips` PASS).
  - **ED-1.** Frame-exact 30p cuts: 26/26 cut frames == 2·n of cuts.txt, and QA proves every cut.
  - **TI-19.** `music: {style: film, hit: 0.368}` lands the end sting 0.368 s after the end-card cut, inside a silence.
  - **SN-1.** The 87.01 BPM grid from 0.1107 s with the groove on beat 32: phase 1.8 ms, onsets +2 ms against the reference.
  - **SN-16.** Voice without ducking: `duck: 0` gives a floor of 1 (no drop under the voice), as in the reference.
- **Proven workarounds (a DRAFT v0.1 can use these today).**
  - **Prompt bar.** `width: 844` + the undocumented `size: 37` lands 843x236 against the film's 844x224;
    `placeholder: " "` blanks the field.
  - **Status screen.** An `agent` shot with only `title:` is already a full-frame light card of large grotesk.
  - **Seamless cut.** Out `drift-*` with `drift: {out: 0}`, the next shot `drift: {in: 0}`, `push: 0`. It costs a whoosh.
  - **Snap-stop.** `offset` + `pan` at 0 reproduces the arrow whip's 67/13/5 px/mf stop.
  - **Static Manus lockup.** An official-paths SVG as `bg:` on a scene shot, plus `hold:`
    (`gaps/scratch-title-skeptic/compose_lockup.py`). Use the -dark/-white files, never `logoTint`.
  - **Overlays riding a crash-zoom.** Shot `push` + `focus`. This route dies at WP-0 (push ±0.5), so B4 replaces it.
  - **24p UI.** `--clips <id> --fps 24` → `conform.py` → `bg:`.
  - **Muted UI and whooshes.** `music.level: 30`. QA still passes; it's a stopgap.
  - **Custom job blocks.** Plate-tracked overlays (`scratch-footage-skeptic/job/blocks/trackpin.mjs`), screen-blend light
    (`shaft.mjs`), footage in a badge (`badgecam.mjs`), a table-driven editor zoom
    (`scratch-screens-skeptic/job/blocks/edrise.mjs`) and foley cues from beats.yaml
    (`scratch-sound-skeptic/blocks/foley.mjs`).
  - **Stills.** `Design-AutoPilot-stable/pipeline/image_gen.py` outside the skill feeds `gen.mjs video --image` (PITCH's
    own fallback).
  - **Voice.** A macOS `say` line as a timing stand-in (`scratch-sound-skeptic/say-line.wav`).

## 5. Risks

- **The unmerged fix round touches the same files.** The four branches change lv.mjs, runtime.js, kit.js, spec.mjs,
  timeline.mjs, qa.mjs, render.mjs, layers.mjs, breakdown.mjs, GUIDE.md and 14 block files. `fix/film` has uncommitted edits,
  and reel and tools have uncommitted patches. Mitigation: WP-0 runs first and alone, onto live and never onto `snap/`
  (that would delete the hf02 port), followed by `apply_pointers.py`.
- **WP-0 invalidates some audit numbers.** Push is bounded to ±0.5 (fix/film df65a81, spec.mjs:184), so FT-9's ×5.6
  crash-zoom (push 4.6) and ×0.41 pull-back (push −0.59) stop at `--grid`. Drift defaults become .10 W / .085 H ×0.65 in,
  ×1.40/f30 out (b1186dc, kit.js:81). ENG-1 fixes media `move`. FILM-6 makes lockup light-on-dark over footage. Mitigation:
  re-run those probes after WP-0 and before any package fits a curve.
- **Engine and audio changes stale every job.** Shot prints hash the engine and `audioPrint` hashes audio.mjs
  (lib/fingerprint.mjs:29, 38). Every old job re-renders, and `--qa` fails its audio check until `--audio` runs once.
  Mitigation: default-off fields. Regression = pixel-identical frames on steady-sample, edge-test, cue, cue-overlays,
  dark-ui-check, qa-probe, qa-probe2, layers-probe, reel-sample, film-sample, hf02-skill and hf02-full, plus
  `fix/regress/`. The wall block renders nondeterministically (fix round finding), so exclude its frames from
  bit-exact checks.
- **Two shared hot files.** spec.mjs and GUIDE.md are touched by WP-B to WP-E. Mitigation: section ownership plus the
  fixed merge order in §3, or WP-0's mechanical spec split.
- **QA passes broken films today.** A tinted logo rendered 0 px and QA PASSED (TI-2). `compare` said ON THEIR BEAT for a
  score with the wrong groove (kick r −0.16) and no build (SN-20). The key check reads F minor as F major. `--layers`
  doesn't check blend modes (FT-15), and backdrop-filter fails its stack check (OV-1). Mitigation: B2's logo-ink check and
  E4's judged compare ship in the same packages as the features.
- **The audit mixes per-f30 and per-mf rates.** SC-1 calls drift-up's ×1.31/f "the card-out-up rate", but card-out-up is
  ×1.31/mf. ED-7 converts it correctly (×1.306/f30 = ×1.40/mf). After WP-0 the exit is ×1.40/f30 ≈ ×1.52/mf, further from
  the reference. Mitigation: convert to one unit before fitting.
- **Paid calls and the key.** The OpenAI key is approved for gpt-image-2 stills only. TTS on it needs Alex's OK. H3 test
  rolls (camera moves, VFX, 12–15 s takes, end frames) cost money, and fal's field names are unverified offline.
  Mitigation: one `plates.yaml` estimate and one `--go` per batch; the key is never printed.
- **Must-not-copy.** The editor, status cards and Brief card must be our own design. PITCH flags Option A's Brief card,
  editor run and fjord plates as too close to Manus's own film (PITCH.md:369-371). Brand marks come only from the
  manus.im kit in `manus2/brand/`. Mitigation: re-plate and redesign those three before C5 and A1 start.
- **Scope creep.** The audit marks TI-7 and TI-8 (a two-part co-brand lockup) and TI-15 to TI-17 (higgsfield01's social end
  card) as needed. Option A's title is "Manus 2.0" and its end card is mark + wordmark held still (PITCH.md:271, 280).
  Mitigation: confirm with Alex before WP-D builds them; the parked rows stay parked.
- **Disk and render time.** A footage frame is about 840 KB, so 37.75 s at 16:9 takes 1.9 GB. A 76.5 s footage film is
  about 3.9 GB per aspect (estimate), and the 24p comparison renders double that while B6 is tested.

## Ask

1. Approve WP-0: merge the 10-21 fix round onto live before any package starts.
2. Make the PITCH calls that gate packages: tempo (87.01 vs 128 BPM), VO or type-only for the Problem act, and whether the
   title and end card keep higgsfield01's co-brand/social structure or Option A's mark + wordmark.
3. Approve the spend: TTS on the OpenAI key, and a budget for H3 test rolls (camera moves, VFX, long takes).
