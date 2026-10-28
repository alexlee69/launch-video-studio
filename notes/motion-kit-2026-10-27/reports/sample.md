# Sample job: Wayfinch, the motion-kit showcase (2026-10-27)

**Bottom line.** `~/Downloads/launch-videos/motion-kit-sample` is a 28 s launch film (11 shots, 56 beats at 120 BPM) for a
fictional AI trip planner. Every film says **QA PASSED (16 checks)**: 16:9, 9:16 and 1:1. All 7 motion-kit pieces are in it
(press, fan, particles, map, wall `layout: grid`, type `words`, stack `mode: exploded`). So are all 5 round-2 devices:
a flood from the pressed button, a carry, a `morph to: frame` into the end card, two dives (`signature: dive`) and `from:`
on the fan. Every moving cut has a `cause:`, and music runs on the beat grid with a drop and a break. It started from
`--init --kit launch30` and carries a filled `brief.md` passport and trigger map.
- **The unflattering part.**
  - **QA was silent on all four problems I fixed by eye.** I fixed six problems after reading cut stills; the first 16:9
    film already said QA PASSED, and QA said nothing about four of them (QA's near dead air and contrast lines pointed at
    the other two).
  - **Four engine or doc defects**, each with a repro.
    - **The morph.** A `press` button can't be a morph's box: the morph takes the button's soft halo. So the call to
      action is a `prompt` composer, not the big press button I designed first.
    - **SVG backgrounds.** An SVG `bg:` letterboxes on every aspect but its own.
    - **The exploded stack, 16:9.** Its headline runs under the top plane.
    - **Dives into `type`.** A dive into a `type` shot lands on an almost empty frame.
  - **One `--grid` WARN on purpose.** "3 transition types (flood, carry, morph) besides the signature dive" stays: the task
    asks for all of them. A client film keeps two plus the signature; the brief's passport says so.
  - **Five WARN lines remain per film, all block styling.** They are the text floor (labels 35 px, the float tag 31–35 px
    caps, the end card URL 31 px) and the end card URL's contrast (Lc 51). None comes from a choice made in this job
    (merge k, deferred).

I didn't edit the stage, the live skill, `base/`, `live-before/` or any original job. I made no commit, no paid call and
no `--go`, and copied no research frames or private footage. Renders ran one at a time at `--workers 2`; `pmset -g therm`
never reported a warning. All frame folders are deleted, and 40 GB is free.

Shorthands:
- `J = ~/Downloads/launch-videos/motion-kit-sample`
- `M = qa/motion-kit`
- `S = $M/stage/product-launch-sting/video` (the tool: `node $S/lv.mjs`)

---

## The film, shot by shot

| # | Time (60-fps frames) | Shot · block | What you see | Out → next · `cause:` | Why this choice |
|---|---|---|---|---|---|
| 1 | 0–1.5 s (0–89) | `globe` · particles sphere, 1 400 dots, orbits, dark | A swirl of coral dots pulls into a turning globe. | **dive** `at [.5,.5] zoom 9` (signature) · "the globe turns towards us and the camera falls into it" | The surprise by 2 s, and the world before one trip. Particles arrive whole after a dive, so the dive goes *out* of them. |
| 2 | 1.5–3 s (90–179) | `name` · type, serif, `bg: night-wide.svg`, `through: true` | It lands still flying forward on a starry night sea (the dots become stars). "Wayfinch" settles, then zooms through the camera. | cut | The brand by 1.5 s. The bg makes the dive land on a full frame (r1 landed on empty navy). The zoom-through puts speed on the cut. |
| 3 | 3–6 s (180–359) | `ask` · press `send` "Plan 4 days by the sea", `at: 75`, `push: .07` | The product by 3 s. The cursor arcs in and presses send on the 5.5 s beat; rings burst. | **flood** from `control`, spot `[.9,.5]` · "the cursor presses send" | Cause → effect in one frame: the night pours out of the send button and covers the frame on the 6 s bar line (the drop). |
| 4 | 6–9 s (360–539) | `trips` · fan, 5 drawn trips, `pick: 2`, chips, "One ask. *Five trips.*", dark, **`from: cursor`** | The hero trip grows out of the cursor's tip on the send button, the others deal out of it, then the fan pushes into the hero. | cut | `from: control` (the template's way) made the hero pop in full size at the bar's centre after the flood's solid frames. The cursor's tip is the pressed point in every aspect. |
| 5 | 9–12.5 s (540–749) | `route` · map, 4 stops Harbour → Market → Cliffs → **Cove**, "Four days, *mapped.*" | The route draws itself; pins drop on beats. | **drift-left** · "the route runs on to the right" | One-word labels keep the reading time inside 3.5 s. Day 4 = Cove sets up shots 7–9. |
| 6 | 12.5–15 s (750–899) | `booked` · stack exploded, **`tilt: low`**, 4 labels, "All *booked.*" | Four drawn UI planes separate; labels on leaders. | cut | `tilt: low` because the iso view is broken on 9:16 (A-verify N1). The short headline because of B3. 5 beats because 6 left 1.7 s still (near dead air INFO in r1). |
| 7 | 15–17.5 s (900–1049) | `spots` · wall `layout: grid`, 8 drawn places, the cove first (lit), "Hidden spots, *found.*", dark | The mosaic cascades in, the cove tile lights, the rest dims. | **carry** `{el: lit, to: card}` · "the lit tile lifts off the wall" | The lit tile and the next card show the same picture, so the carry reads as one object travelling, not two blended. |
| 8 | 17.5–20 s (1050–1199) | `day` · float, card = cove, `bg: night-wide.svg`, label "Day 4" | The tile lands as a postcard glowing against the night sea; brackets snap, the tag pops. | **dive** `{el: card, zoom: 8}` (signature) · "the postcard settles and the camera falls into it" | A sunset postcard against the night is the film's warmest contrast, and it sets up falling into it. |
| 9 | 20–23 s (1200–1379) | `words` · type words "Pick." "Pack." "Go." over **`bg: cove-wide.svg`, `bgDim: .45`** | We are inside the postcard: the cove at sunset, the words bold sans / italic serif, one per two beats; the music breaks. | cut | The dive lands in the picture it entered (r1 landed in a navy void). No accent word: coral "Go." over the sunset measured 2.3:1, Lc 32. |
| 10 | 23–26 s (1380–1559) | `go` · prompt, "Your turn.", types "Plan my trip" (`speed: .4`), `zoom: {16x9: 1.3}` | The composer types and sends; then the box grows into the whole frame in the end card's navy. | **morph** `{el: prompt-box, to: frame}`, `out: drift-up` · "Send is pressed" | It bookends the ask. A prompt box because a press button can't morph (B1). `drift-up` gives the morph a moving out without adding a 4th lint type. The zoom makes the UI-sized box read on 16:9. |
| 11 | 26–28 s (1560–1679) | `end` · endcard dark, the mark, Wayfinch, wayfinch.app | The lockup lands on the morph's navy and holds. | — | It closes on the night it opened on, now with one coral mark. |

**Music.** `{style: keynote, bpm: 120, drop: trips, breaks: [words]}`: it builds to the press, drops as the trips fan
out, and dips under the word beats. All 47 cue onsets land on their frames, and the 5 whooshes peak within 7 ms of
their cuts.

**Pictures.** `$J/tools/make_art.py` draws all 11 SVGs: a logo (a route writing a W, ending on a destination dot),
eight square postcards, `cove-wide` and `night-wide`. They are shapes and gradients only, with no real place or brand.
Every SVG root has `preserveAspectRatio="xMidYMid slice"` (B2).

**Files in `$J`.**
- `beats.yaml`, with every choice commented.
- `brief.md`, with the passport and the trigger map filled in.
- `tools/`: `make_art.py`, `cutsheet.mjs` (labelled cut sheets from the film frames), `films.sh` (one aspect at a
  time with a thermal check) and `typescale.py`.

## Decisions (no questions asked: decided and recorded)

- **The product.** "Wayfinch", a fictional trip planner, chosen because the `map` block needs a reason to exist and a
  trip gives every kit piece a job: ask, options, route, bookings, places, the day, the call to action.
- **The transition-type WARN is kept.** It is the only `--grid` warning besides the fan's informational 1:1 bleed note.
- **The CTA moved from a press button to the composer.** The first design was a press button morphing into the frame;
  B1 made that box a translucent halo. I also built and rejected a `panel` + `tap` CTA (`$M/jobs/smp-lab2`): its last
  1.5 s were static, its UI was small, and no cursor showed in those frames.
- **No tagline on the end card.** The endcard tagline renders 45 px on 16:9, under the 47 px web floor. The film's
  promise is already said by "One ask. Five trips." The URL stays; its 31 px / Lc 51 WARN is the known endcard styling.
- **`delivery: web`** (the default). I didn't raise or lower the floor to quiet the label WARNs.

## How it got here (each change came from reading frames, not from QA)

| Round | What I saw | Change | Evidence |
|---|---|---|---|
| Storyboard 0 | On 16:9 the top exploded plane covers "booked." of "All of it, booked." | Headline "All *booked.*" (B3) | `$M/jobs/smp-bug-exploded-head/out/main/16x9/board/01-booked.png` |
| Storyboard 0 | On 9:16 and 1:1 the day's panorama is a letterboxed band with black above and below | Every SVG gets `preserveAspectRatio="xMidYMid slice"` (B2) | `$M/jobs/smp-bug-svg-bg/out/main/16x9/board/01-a.png` (the same bug, pillarboxed) |
| Storyboard 0 | On 9:16 the iso stack's top plane is clipped at the left, the chips sit over the planes and the leaders run backwards | `tilt: low` (clean in all three aspects) | `$M/jobs/smp-evidence/storyboard/exploded-9x16-iso-low-3planes.png` (iso / low / 3 planes), `exploded-low-16x9-1x1.png` |
| Film r1 16:9 (QA PASSED 16) | globe → name: on the cut a navy frame with a faint 0.3× name (`type` ignores a dive) | Name over `night-wide.svg`, plus `through: true` | `$M/jobs/smp-evidence/r1-16x9/r1-16x9-cut-90.png` → final `$J/stills/16x9/wayfinch-16x9-cut-90.png` |
| r1 | ask → trips: 2 solid frames, then the hero pops in full size at the bar's centre (`from: control` under a flood) | `from: cursor` | `smp-evidence/r1-16x9/r1-16x9-cut-360.png` → `$J/stills/16x9/wayfinch-16x9-cut-360.png` |
| r1 | day → words: we fly into the bright postcard and land on navy | Words over `cove-wide.svg` | `smp-evidence/r1-16x9/r1-16x9-cut-1200.png` → `$J/stills/16x9/wayfinch-16x9-cut-1200.png` |
| r1 | The morph's first frame: a translucent coral box ~1.5× the button pops over it and hides the label (B1) | The CTA becomes a `prompt` composer | `smp-evidence/r1-16x9/r1-16x9-pre-cut-1560.png` |
| r1 | `INFO deadair near` on booked (1.70 s still, 0.10 s over) | booked 6 → 5 beats, day 4 → 5 | `smp-evidence/film-16x9-r1.log` |
| Lab (`smp-lab`, 19.5 s, QA PASSED 14) | "Go." in coral over the cove: `WARN contrast 2.3:1 Lc 32` | No accent in the word beats | `$M/jobs/smp-lab/logs/film-16x9.log` |
| Lab | The crescent moon drawn as a dark disc over its glow read as an eclipse | Crescent drawn with a mask | `$M/jobs/smp-lab/stills/lab-cut-90.png` |
| Film r2 16:9 (QA PASSED 16) | The ask's bar sits alone for 1.5 s before the cursor comes; the composer box is UI-small on 16:9 | `push: .07` on ask, `zoom: {16x9: 1.3}` on go (a 1:1 zoom clipped the box, so I dropped it) | `smp-evidence/r2-16x9/r2-16x9-strip-cut-0.png` |
| Films r3 16:9 + 9:16 (QA PASSED 16 each) | On 9:16 the dimmed sun is a grey disc beside "Go.", and the dive lands much darker than the postcard | The sun half set on the horizon in the art; `bgDim .55 → .45` | `smp-evidence/r3-9x16/` |

## QA (final films, logs `$J/logs/film-<aspect>-final.log`)

| | 16:9 | 9:16 | 1:1 |
|---|---|---|---|
| Verdict | **QA PASSED (16 checks)** | **QA PASSED (16 checks)** | **QA PASSED (16 checks)** |
| Hard cuts (PASS) | 4.84× · 11.46× · 9.60× · 8.16× · 129.79× | 11.5× · 10.8× · 9.4× · 5.2× · 229.4× | 5.8× · 11.5× · 9.1× · 4.4× · 122.6× |
| Moving / soft cuts (INFO) | dive 4.04×, flood 0.36× (soft by design), drift 2.82×, dive 2.76×, morph to: frame 1.22× (soft by design) | dive 4.24×, flood 0.46×, drift 3.08×, dive 3.61×, morph 1.25× | dive 5.12×, flood 0.43×, drift 2.79×, dive 8.76×, morph 1.22× |
| Continuity | 10 cuts, 4 with camera motion and 2 carried objects; all hold, ratios 1.1–2.0× | same | same |
| Content minimum | 396 thumbnail px | 425 px | 408 px |
| Dead air | INFO: closest is the end card, 1.72 s of 2.00 s | INFO: closest is trips, 2.20 s of 2.30 s | INFO: closest is trips, 1.97 s of 2.30 s |
| Purity | INFO: 1 of 33 frames (trips f505, the fan's 3-D cards) differs only out of order and matches in order | same (max Δ 123, 4 359 px, in order = match) | same |
| Flash | INFO: at most 1.5 a second | same | same |
| Loudness / sfx / whoosh | −14 LUFS, −1.4 dBTP; 47 onsets on their frames; whooshes ≤ 7 ms | same | same |

**Every WARN, judged.**
- **`WARN text` floors.**
  - **16:9.** Fan chips, map labels and exploded labels at 35 px; the float tag "Day 4" at 35 px caps; the end card URL
    at 31 px.
  - **9:16.** Tag 35 px caps, URL 31 px.
  - **1:1.** Tag 31 px caps, URL 31 px.
  - **Verdict.** True by B's floor and all block sizes: the kit's 34–35 px chips are merge decision j, and the float
    tag and URL are merge k (deferred). None is caused by this job's copy.
- **`WARN contrast` end card "wayfinch.app" 6.8–6.9:1, Lc 51.** True and known: the endcard's 60 % white URL (merge k).
- **`--grid`: 3 transition types.** Deliberate (see above).
- **`--grid`: the fan count-5 bleed note on 1:1.** Informational: the outer cards bleed off and their chips drop.
- **`INFO sfx` 6 buried cues.** The exploded labels' ticks are 0.13 s apart, a known kit trait. The fan's first pop
  lands in the drop.

## Engine bugs and gaps found (none fixed in the stage; worked around in the job)

| # | Sev | What breaks | Repro | Suggested fix |
|---|---|---|---|---|
| **B1** | MEDIUM | **A morph out of any `press` control is wrong.** `boxOf()` (`$S/engine/runtime.js` ~757) takes the first descendant with a background, which in press's `control` layer is its soft halo (`data-lv-soft`, a radial gradient 1.8× the face). On the morph's first frame a translucent coral box ~1.5× the button pops over it and covers the label. QA is silent: soft cut by design (INFO), continuity holds. | `$M/jobs/smp-bug-press-morph/beats.yaml` (press button → endcard, `carry: {el: control, to: frame, mode: morph}`). Frames: `$M/jobs/smp-evidence/r1-16x9/r1-16x9-pre-cut-1560.png` (f1532 on). | In `boxOf`, skip `[data-lv-soft]` (and SVG no-draw tags) with the same test `visualRect` got in prove fix 3. |
| **B2** | MEDIUM (it is in the live engine too) | **An SVG `bg:` letterboxes instead of cover-cropping** on any aspect but its own. `buildFoot` draws `<image preserveAspectRatio="xMidYMid slice">`, but an SVG file keeps its own root `preserveAspectRatio` (default `meet`). The skill's own placeholders are SVGs. QA is silent: the bars are brand background, and content passes. | `$M/jobs/smp-bug-svg-bg/` (the portrait `clip-1.svg` placeholder as a 16:9 bg) → `out/main/16x9/board/01-a.png`, pillarboxed. | Rasterise SVG bgs at extraction, or rewrite the root's `preserveAspectRatio` when serving. At least add a GUIDE line ("SVG bg: put `preserveAspectRatio="xMidYMid slice"` on its root"). |
| **B3** | LOW–MEDIUM | **The exploded stack on 16:9:** a one-line headline wider than ~550 px runs under the top plane. The headline may be `.34 W` wide from `safe.x0`, but the iso planes' projected left corner reaches ~`.35 W`. QA is silent: nothing is clipped. | `$M/jobs/smp-bug-exploded-head/` ("All of it, *booked.*") → `out/main/16x9/board/01-booked.png` | Measure the projected planes' left extent and cap the headline's `maxW` to it (or move `sx` right). |
| B4 | MEDIUM, already known | **A-verify N1** is still open: 9:16 iso exploded clips the top plane, the chips sit over the planes and the leaders run backwards. | `$M/jobs/smp-evidence/storyboard/exploded-9x16-iso-low-3planes.png` (left panel) | Owner A. The workaround is `tilt: low`. |
| F5 | LOW | **A dive into `type`** (name or word beats) lands on an almost empty frame: `type` doesn't honour `ctx.entered === 'dive'`, so its own fade and tracking play under the ×0.3. The GUIDE warns about this in general terms; `--grid` says nothing. | `smp-evidence/r1-16x9/r1-16x9-cut-90.png`, `…-cut-1200.png` | Have `type` skip its entrance after a dive, as float and particles do. Or add a `--grid` INFO when a dive flies into a type, title or headline shot without `bg`. |
| F6 | LOW | **`flood` + `from: control`**: the hero is born at the bar's size and centre while the flood still covers everything, so it pops in. This is prove F4, now seen on screen. | `smp-evidence/r1-16x9/r1-16x9-cut-360.png` | `from: cursor` (the press's cursor tip is the pressed point in every aspect). Worth switching launch15 / launch30 too; float takes it, since the cursor is a layer of the previous shot. |
| F7 | INFO | **The review sheet's text.** The day row says the card "flies in from the left with a speed streak"; it is carried in, with no fly-in or streak. The trips row doesn't say the fan grows out of the cursor. `lib/sheet.mjs` `onScreen` doesn't read carry, dive or `from:`. | `$J/review/wayfinch-16x9/sheet.json` (rows `day`, `trips`) | Describe the landing ("carried in from <shot>", "grows out of <layer>"). |

## Stills to look at

- **Films:** `$J/wayfinch-16x9.mp4`, `wayfinch-9x16.mp4`, `wayfinch-1x1.mp4` (with `wayfinch-master.wav`,
  `wayfinch-captions.srt` and thumbnails).
- **Storyboards:** `$J/wayfinch-storyboard-{16x9,9x16,1x1}.png` (+ PDF); hero frames in `$J/out/main/<aspect>/board/`.
- **Cut sheets** (60-fps cut−8 … cut+12):
  - `$J/stills/16x9/wayfinch-16x9-cut-{90,180,360,540,750,900,1050,1200,1380,1560}.png`
  - `$J/stills/9x16/wayfinch-9x16-cut-*.png` and `$J/stills/1x1/wayfinch-1x1-cut-*.png`, at cut−8 … cut+24
- **Whole-film strips:** `$J/stills/16x9/wayfinch-16x9-strip-every-0.4s.png`, `$J/stills/9x16/…-every-0.5s.png`,
  `$J/stills/1x1/…-every-0.5s.png`.
- **Review sheet:** `$J/review/wayfinch-16x9/`, with `preview.html` to open locally and `index.html` + `film.mp4` +
  `thumbs/` (11 shot thumbs + 10 cut stills) to publish. A full-page screenshot is `$J/stills/sheet-preview-16x9.png`;
  its later cut stills are grey only because the page lazy-loads them, and the files in `thumbs/` are complete.
- **Before / after evidence:** `$M/jobs/smp-evidence/` (r1–r3 sheets and logs, plus `storyboard/` for the storyboard-stage
  sheets), `$M/jobs/smp-lab/stills/`, `$M/jobs/smp-lab2/stills/`.

## Hygiene

| Check | Result |
|---|---|
| Stage, `base/`, `live-before/` | `find -newer` (session start 08:19) finds no file in any of them |
| Live skill | `shasum -c live-before.sha1`: 867 OK, 0 not OK |
| Original jobs | Nothing under `~/Downloads/launch-videos` is newer apart from the new `motion-kit-sample/` (and the folder's own mtime) |
| Paid calls / `--go` / research files | none; no frame, still or audio from the reels, hf01 or manus2-space was used |
| Heat | `pmset -g therm` before every render: no warning level was ever recorded. Renders ran one at a time, at `--workers 2`. |
| Disk | Frames, bgref, textless and purity folders deleted for all three aspects of the sample and both labs. The sample is 190 MB (mp4s, qa.json, stills, sheet, logs). 40 GB free at the end. |
| Jobs I created | `$J`, plus `$M/jobs/smp-lab`, `smp-lab2`, `smp-evidence`, `smp-bug-press-morph`, `smp-bug-svg-bg`, `smp-bug-exploded-head` |
