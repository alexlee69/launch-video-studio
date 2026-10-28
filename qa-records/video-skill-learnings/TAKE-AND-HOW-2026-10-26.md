# The three Higgsfield skills and four reels: what I'd take, and how (draft v0.1, 2026-10-26)

📌 **TL;DR.** I'd take about 25 ideas into our video skill and copy no files. They land in two rounds, in the order you
set: the motion kit, then the cross-cut transitions. Each round brings the checks that guard it. Nothing here costs
money to build.
- **The catch.** The most valuable idea, carrying a cursor or a button from one shot into the next, needs an engine
  change, because today the engine draws one shot at a time.
- **One of the skills' own rules failed against the reels.** My detector flagged 11 "white flashes"; checked frame by
  frame, 9 of them were plain hard cuts into a white UI card.

Sources, all private and never pushed:
- **The skills.** `skills/*/x/`, extracted read-only and never installed or run.
- **The readers' full reports.** `readers/` (handbook parts 10–13; styles, archetypes, taste and lessons; the SaaS skill).
- **The reels.** `reels/reels.json` holds the numbers; `reels/*.jpg` are the contact sheets, one frame a second.

## 1 · The four reels, measured

**Method.** Each reel was stepped through in the built-in browser every 1/30 s and read as a 96×54 luma picture. Cuts
are luma and histogram jumps. A "move" is a run of above-baseline change. Every flagged white frame was re-checked frame
by frame.

| | A · "Original launch video" | B · "Launch 1" (Ads Studio) | C · OpenAI Dots × Higgsfield | D · Higgsfield × Claude Opus 5.5 for Motion Design |
|---|---|---|---|---|
| Post | Dd66aLqCbO6 | DeHzMbDidhx | Dd4VIgTq8e7 | Ddw64rKK6tN |
| Length · fps | 75.5 s · 24 | 75.1 s · 30 | 59.5 s · 30 | 72.5 s · 24 |
| Hard cuts | 23 | 35 | 9 | 23 |
| Median shot | 2.5 s | 1.2 s | 4.4 s | 1.9 s |
| Longest run with no hard cut | 10.7 s | 14.6 s | 18.7 s | 11.1 s |
| Cuts that land on fast motion | 16 of 23 | 14 of 35 | 8 of 9 | 13 of 23 |
| Moves · median length | 50 · 0.37 s | 46 · 0.40 s | 25 · 0.40 s | 52 · 0.37 s |
| Moves that peak in their first third | 42 % | 46 % | 48 % | 50 % |
| Moves into a cut that speed up into it | 5 of 8 | 7 of 12 | 4 of 4 | 2 of 5 |
| Whole-frame stills of 0.5 s or more | 1 | 1 | 3 | 0 |
| Hard cuts from dark footage into a white UI | 0 | 1 | 3 | 5 |
| Real white flashes | 0 | 2 | 0 | 0 |

**What each one shows.**
- **A.** Agent UI on white, pink brand panels, a woman with a laptop in a kitchen, a coffee maker, a car on a road.
- **B.** A fisheye open with the title, a restaurant, a green particle sphere (19–24 s), dark UI, a mosaic of food ads.
- **C.** A white UI world with four blob mascots, chat bubbles, a 3D fan of video cards (34–37 s), a 2×3 grid of
  people, and the co-brand lockup at both ends.
- **D.** An explorer story with stickers on the footage, white prompt cards, a timeline UI, a green map (43–48 s) and
  poster titles.

**What the numbers say.**
- **Moves are short.** The median move is 0.37–0.40 s in all four, and about half peak in their first third: a fast
  start and a soft landing. Our word reveal (14 frames ≈ 0.47 s on expo-out) is already in range.
- **Cuts land on motion.** 51 of 90 cuts land on fast motion, and 18 of the 29 moves that run into a cut speed up into
  it. Our drift cuts already do this; our zooms and object moves don't.
- **Nothing stalls.** There are 5 whole-frame stills of 0.5 s or more in 4.7 minutes of film, none longer than 0.57 s.
- **Pace is a choice.** B cuts every 1.2 s. C goes 18.7 s without a hard cut: its changes are moves through one white
  world.
- **Dark to white is a hard cut, not a flash.** 9 cuts go straight from footage to a white card and stay there (luma 40–175
  → 239–252 in one frame). The two real flashes are both in B: one as the title lands, one on a cut. Each fades in
  0.1–0.17 s.

## 2 · The three skills, one line each

- **higgsfield-motion** (889 KB, 41 files, in Russian). The handbook behind these films: frame layout, type and colour
  floors, six motion personalities, a transition grammar, 34 shot types, QA, and one client's taste.
- **higgsfield-motion-saas** (236 KB, 50 files). A code engine for 15 s SaaS launches. Its rule is that speed is never
  zero at an event and peaks on the cut. Its transitions are needle zoom, object carry, UI morph, fly-through and
  background flood, plus the ease maths, sub-frame motion blur and a lens pass.
- **cinedance-block-library** (17 KB, 1 file). A prompt library for AI video. One trick per shot, fail lines, counts, a
  "don't take" list per reference, an acting task, and negatives written as inversions of the trick.

**Already true of ours, so nothing to take.**
- **Pure frames.** Our frames are a pure function of time.
- **Fonts.** Every brand face is force-loaded before layout, so the skills' `fonts.ready` trap doesn't apply.
- **Exits into entrances.** Each exit hands its direction to the next shot's entrance.
- **Drift cuts.** They speed into the cut.
- **The rest.** Blur scales with speed, sound cues are onset-checked, and the review sheet exists.

## 3 · What I'd take, and how

| Tier | What | Why / dependency |
|---|---|---|
| **Round 1: motion kit + frame checks** (about a day) | `press` · `fan` · `particles` · `map` · `wall` grid mode · `type` word beats · `stack` exploded mode; dead air · readable text · flash safety · reading time · purity | What the reels and video 2 show that we can't draw yet, plus checks that judge every frame. The blocks are new, so old jobs render byte-identical; the checks start as WARN. |
| **Round 2: cross-cut transitions + cut checks** (1–2 days) | carry layer · needle zoom · fly-through · UI morph · grow from a point · background flood; cut continuity · cut stills · transition lint | The biggest gain and the riskiest change: one persistent layer above the shots. The cut checks keep it honest. |
| **Small, any time** | shot writer phase 2 (cinedance) · passport and trigger map in the brief · 15 s and 30 s skeletons | Prompt and planning quality; no engine change. |
| **Later** | one `motion:` personality per film · lens pass · sub-frame motion blur · themes from seed colours | Each touches every block or every frame. Worth it after round 2. |

### Round 1 · Motion kit (new blocks in `engine/blocks/`)

Each block re-lays itself out for 16:9, 9:16 and 1:1, tags its elements for `--layers`, declares its `copy`, and gets a
`--blocks` entry and a GUIDE row.
- **`press`.** The key click, shot close: one control at 1.5–4× size, a large cursor on a curved path (0.5–0.9 s), a
  150–250 ms dwell, a press (button to 0.94, cursor to 0.85), rings expanding, and the cut on the peak. This is the
  handbook's "generate press" beat.
- **`fan`.** An odd number of clip cards fanned on an arc, the hero about 1.25× larger and the others stepping down. One
  pull-back, then a push into the chosen card. Seen in C and in video 2.
- **`particles`.** A seeded dot field: a sphere that bursts, a dot grid, a particle terrain. Seen in B and in video 2.
- **`map`.** A map that draws its route, with pins landing on the beat. A map in D, and a route-drawing one in video 2.
- **`wall` grid mode.** A flat mosaic of footage tiles, one lit and the rest dimmed to about 35 %. `--grid` warns when the
  same clip sits next to itself. Seen in B and C.
- **`type` word beats.** One word per beat with a full stop, alternating bold sans and italic serif. From video 2.
- **`stack` exploded mode.** 3–5 UI planes on one diagonal, 48–96 px apart, with labels. From video 2.
- **Defaults for the new blocks.**
  - Entrances take 0.4–0.6 s on expo-out, from scale 0.96 and 8 px of blur; exits are 50–100 ms shorter.
  - Staggers are 2–4 frames.
  - Overshoot goes only on chips and stickers, never on a headline, a logo or a hero.

### Round 1 · Frame checks (in `--qa`; WARN first, then FAIL once calibrated on our sample films and these reels)

- **Dead air.**
  - **The rule.** Warns when no part of the frame changes for longer than the copy on screen needs to be read (floor
    0.6 s).
  - **How it measures.** It scores the busiest of 144 blocks on the thumbnails the content check already makes, so a
    small moving cursor counts.
  - **Today.** The freeze check only catches 4 or more identical frames.
- **Readable text.**
  - **Size.** Each must-read line is measured at the size it shows on screen, after the camera's zoom. A new
    `delivery:` field sets the floor:
    - `web` (the default): about 47 px mixed case on 16:9 and 40 px on full-screen 9:16;
    - `feed`: a 16:9 film watched in a phone feed needs about 64 px mixed case, 48 px in capitals.
  - **Contrast.** Measured at the worst pixel under the letters, by both WCAG and APCA, with the stricter verdict
    winning. This is the check that matters for captions over AI footage.
  - **Today.** Text under 18 px fails, text under 26 px warns, and there is no contrast check.
- **Flash safety.** At most 3 large brightness jumps a second (WCAG 2.3.1). The cut check already measures every frame's
  luma.
- **Reading time.** The current warning moves to the handbook's formula. A line must hold for 0.35 s a word plus 0.5 s,
  ×1.3 over moving footage, and never less than 1 s. Our `copy`/`read` lists already say which lines count.
- **Purity.** Re-renders 24 random frames in shuffled order on a fresh page and compares them with the film (±2 code
  values). It catches a block that depends on render order before a worker seam does.

### Round 2 · Cross-cut transitions (P9; `engine/runtime.js` + blocks)

- **Carry layer.**
  - **What it is.** One persistent layer above the shots; the engine still draws one shot at a time underneath.
  - **How a hand-off works.** An element (a cursor, a button, a card, a logo) is named by the layer tag its block
    already gives it for `--layers`. At the hand-off frame:
    - shot A hides its copy;
    - the layer draws the element at its exact screen rectangle;
    - shot B takes it over.
  - **beats.yaml.** `carry: {from: s3.cta, to: s4.cta}`.
- **Needle zoom.** The carried object pulses about ×1.12, with its fastest frame on the cut, while the backgrounds hard-cut
  under it.
- **Fly-through.** A dive into any target in shot A: the pivot moves first, then a log-scale zoom. Shot B continues
  forward from ×0.3 and settles. It extends `type through: true` to any target.
- **UI morph.** A card, pill or button changes size and corner radius (never scale) into the next shot's element:
  button → CTA → end card.
- **Grow from a point.** Results are born from the thing that made them: `from: <element>` on `fan`, `stack`, `wall` and
  `float`.
- **Background flood.** The next background floods out from what was just pressed, in 0.3–0.55 s, instead of a fade.

### Round 2 · Cut checks

- **Cut continuity.** At every cut, three things hold:
  - the motion keeps its direction (no dive followed by a shot that starts zoomed in and shrinks, the flip the SaaS
    skill's client caught on sight);
  - the speed changes by at most 2× across the cut;
  - the fastest frame is the cut frame.

  The engine knows the camera exactly, so this is computed, not guessed from pixels. Today moving transitions are INFO
  only.
- **Cut stills.** The review sheet gains the frame before, on and after each cut.
- **Transition lint.** `--grid` warns past 2 transition types per film (cuts and one declared signature don't count). It
  also warns when a moving transition doesn't name the visible cause in shot A: a `cause:` field, printed on the
  storyboard.

### Small, any time

- **Shot writer phase 2 (cinedance).** Optional fields in `shots.json`:
  - the shot's one trick and the 1–2 rules that can't break;
  - fail lines;
  - what not to take from each reference;
  - the character's small task and acting beats;
  - sizes given three ways.

  A lint flags vague words ("slightly", "beautiful"). Negatives written as inversions of the trick stay my proposals
  until you OK them, like every other addition.
- **Brief template.**
  - **A passport.** One value per row: the accent and its one meaning, display type, transitions, camera verb, hero
    motif, bookend.
  - **A trigger map.** Each cut's visible cause → its effect.
- **Skeletons.** 15 s and 30 s beat skeletons as `--init` options ("surprise by 2 s, product by 3 s, brand by 5 s").

## 4 · What I'd leave

- **Their code and scripts.** We have our own engine, renderer, audio and QA; copying theirs would fork the skill. Nothing
  was installed or run.
- **The After Effects library.** We can't run After Effects here, and we already export AE layers.
- **Their 12 style presets and the Higgsfield look** (the lime accent, their fonts, their mascots). Looks come from the
  user's own brand assets.
- **The client-specific taste rules.** I keep the general ones:
  - minimal is not empty;
  - no decoration that doesn't come from the product;
  - take energy and structure from a reference, never its chrome.
- **The handbook's 2-frame white flash between dark and light scenes.** The reels just cut (9 of 11).
- **Animated grain, LED dot-matrix, code rain, SDF characters.** Niche; only when a film asks for them.

## 5 · What this can't see yet

- **Soft transitions.** The detector sees only hard cuts; morphs, carries and camera moves don't register. C's 18.7 s
  without a hard cut is not one continuous shot.
- **Small movers.** Moves are whole-frame change at 96×54, so a cursor can hide under a large slow move.
- **Sound.** The reels' audio wasn't measured.
- **Picture quality.** Instagram serves a compressed 1916×1078 copy, so the blur counts are rough.
- **Faces.** "Never put text on a face" needs face detection, which we don't have.
- **Whose rules.** The skills' numbers come from one studio's films and one client's taste.

## 6 · Time and cost

- **Cost.** No paid generation, tokens only.
- **Time (rough).** Round 1 about a day, round 2 one to two days, each with the usual reviews and three QA runs.
  Multi-agent estimates have run 1.5–2× long before.

✅ **What I need from you**
1. OK round 1 as listed (my order inside it: `press`, `fan`, `particles`, then the rest).
2. OK the engine change in round 2: one persistent carry layer above the shots.
