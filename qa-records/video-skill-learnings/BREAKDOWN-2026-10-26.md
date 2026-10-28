# Higgsfield's two guides: what they teach, and what our video skill should take

DRAFT v0.2 for discussion · 2026-10-26 · nothing integrated yet, nothing spent. v0.2 adds Parts E and F (the two videos) and updates the proposals.

**Read in full:**
- **AI clips**: the Oakley × Meta guide by @kaye_creatives on Higgsfield's blog. It belongs to the YouTube video "How I Made a $1M Oakley x Meta Commercial (Full Breakdown)" (kaye.creatives, 21:23). It is ten scenes, each with its character-sheet prompt and every video prompt, written for Seedance 2.5.
- **Motion design**: "I Tested Claude Motion at 3 Difficulty Levels" by @adilinthewildtempo on Higgsfield's blog. It belongs to the YouTube video "Claude Opus 5.5 + Higgsfield Make Insane Motion Graphics! (Claude Motion)" from the Higgsfield AI channel (10:46). It is seven complete briefs, each with its revisions folded in.

**Watched:** both videos, in your signed-in Chrome.
- **Picture only.** YouTube refused the transcript (its own transcript request failed with 400) and rate-limited the caption file (429). So Parts E and F come from the picture: about 220 frames at every 5–6 s, half-second steps through the 18 s intro of video 2, full-size reads of the key UI screens, and the text on screen.
- **Most of the reasoning is still there.** Both videos print their key words on screen, so most of it survives; the spoken asides do not.

**Not seen yet:**
- **The three Claude skills the guides offer:** `cinedance-block-library.skill`, `higgsfield-motion.skill` and `higgsfield-motion-saas.skill`. Each is a download.
- **The four Instagram reels** the motion guide uses as its references.

---

## Part A · Top-tier AI clips (Oakley × Meta, Seedance 2.5)

### What the film is

- **Ten "life moments", each one continuous generated shot of 8–12 s with its own sound:**
  - wingsuit;
  - road cycling;
  - horse racing;
  - a winter climb;
  - surfing;
  - a penguin colony;
  - a speedboat;
  - a route drawn on a map;
  - a campfire evening.

  She cuts them together and adds the music. The guide's scene numbers skip 4.
- **One person, from a selfie.** The product, camera glasses, is worn in every scene, with a different lens colour per scene: gold, red, sapphire blue, yellow.
- **The product is demonstrated by dialogue, not graphics.** She asks the glasses something and a calm voice answers from them:
  - "are you filming?" shows the camera;
  - "how much further?" shows navigation;
  - "what altitude am I at?" shows live info.
- **One brand accent runs through every scene.** A candy pink, given as a hex code, shows up on the wingsuit's lines, the bike, the jockey silks and the surf skirt. In each palette it is one of the only saturated colours, next to the lens.
- **Scenes interlock.** The wingsuit flyer from scene 1 blasts over the cyclist in scene 2.
- **The ending slows down.** She plans a route on a map, laughs with friends at a campfire, then comes the packshot: she takes the glasses off mid-conversation.

### The production order

1. **A character sheet per scene**, made from her selfie. There is a new sheet whenever the wardrobe changes.
2. **Location plates per scene**, generated empty. Anything else that recurs gets its own sheet: a horse, a bike, other people, a dog.
3. **A position sketch** for shots whose end frame matters. It is flat coloured shapes: a red figure for her, a yellow circle for her head and the glasses, a green line for the ridge. The most-asked comment under the video is what software she sketches with.
4. **The video prompt**, written in fixed blocks (below), with every reference tagged by its role.
5. **Generate, re-roll, edit, add music.** Expect retakes. Commenters caught a 3:4 request that came back 16:9, and a prompt on screen that didn't match the shot.

### The character sheet, block by block

| Block | What it pins | Ours today |
|---|---|---|
| Layout | Three studio photos side by side on flat mid-grey: a full-body front, a second full-body view, and a head-and-shoulders close-up at three-quarter angle with the near cheek larger | ✓ The same grey method (close-up + front + back) |
| The second panel is the scene's pose | The middle panel shows the pose the shot needs: an aero tuck on the bike, a jockey crouch, a surf stance, kneeling at a camera. Otherwise it shows the back | ✗ We always use the back |
| One job per reference | The selfie gives identity only, a 100 % match. The product photo gives the glasses 1:1. A third image gives *only* the wingsuit's cut; its colour comes from the text | Partly. `PRE_FACE` names the sheet's role, but there is no "only this, not that" grammar |
| Outfit | Every garment is spelled out, with colour discipline ("one family of blacks; the only colour is the lens and her skin") and the brand accent as a hex code | Partly: the wardrobe text |
| Product, 1:1 | A full anatomy of the product: lens shape, frame band, where the camera lens sits, nose piece, temple arms. A per-scene colourway changes the colour, never the shape | ✗ No physical-product sheet |
| Expression when the eyes are covered | Everything the face says goes to the mouth and jaw | ✗ |
| Light and look | One big soft source from the front-left, the only light; a studio-photo look with real skin texture | ✓ Similar |
| Proportion lock (later scenes) | White seamless background. True adult proportions given as numbers: seven heads tall, legs half the height, knees at a quarter, hands at mid-thigh, elbows at the waist. Camera at waist height, several metres back, normal lens. The third panel is a strict profile, with the head the same size as in the close-up | ✗ This is the fix for big heads and short legs |
| Closing line | One sentence restating what the frame must read as, before anything else | ✗ |
| Other sheets | The bike in all three panels; a horse sheet; an old man and his dog on one sheet | Partly: our faceless prop sheets |

### The video prompt, block by block (in her order)

| Block | What it pins | Her examples, paraphrased |
|---|---|---|
| References | Each tagged image's single job: the **location** plate (rock, weather, light); the **character** sheet (a 100 % match); the **product** (1:1); a **position reference only** (pose and final composition, no looks); a geography or angle reference. Overrides are allowed, e.g. "take its place and light, but make the camera aerial" | The cliff plate, her sheet, the glasses and the blocking sketch |
| Medium claim | Real live-action footage, shot by a real crew on location | Every shot |
| Map legend | What each colour in the position sketch stands for | Red = her; yellow = her head with the glasses; green = the ridge line |
| Scene | One paragraph describing the whole shot | |
| First frame | Frame 0's composition, with sizes as fractions of the frame (her head about a third of the frame's height), where everything sits, and her state (mouth relaxed, ready to speak) | |
| Optics | Focal length, horizontal field of view in degrees, distance to the subject and depth of focus. One constant focal length (no zooms) and straight lines | 35 mm ≈ 54°, 24 mm ≈ 74°, 28 mm ≈ 65°, 16 mm ≈ 96°, 14 mm ≈ 104°, 100 mm ≈ 20°, 300 mm ≈ 7°, action cam ≈ 150° |
| Camera | **One** named move on a physical rig, with speed and easing. It settles on the final framing and holds still to the last frame | A dolly-out on a track pushed by a grip; a ~40° tripod pan; a 180° aerial half orbit; a chase 3 m behind and 2 m above that banks half a beat late; handheld within arm's length; a head-mounted action cam |
| Final framing | The end composition, which is the position sketch | |
| Subject | The body position in detail (the flyer, the rider, the pose) | |
| Distance and scale | Real numbers | 3–5 m from the rock; 2 km of air below |
| Speed | Shown through parallax | The near rock streaks; the far fjord barely moves |
| Slow motion | Capture rate plus fraction of real speed | 120 fps ≈ ¼ speed, so a gallop stride takes ~2 s; 3000 fps ≈ 1/120 speed for hanging surf spray |
| Action | Time-coded beats of 1–3 s, dialogue verbatim in quotes and lip-synced, the product's voice answering, and an empty hold at the end | The ridge stays empty after her fall: a handle for the edit |
| Body and physics | An exact head count; limbs keep their length; joints bend only the way joints bend; gravity; ropes hold and swing like pendulums | |
| Light | One natural source, and how it moves | The daylight breathes as clouds pass |
| Colour | A restrained palette in which the brand accent and the product are the only saturated colours | |
| Realism | Physical imperfection, spelled out: camera body and lens, organic grain, 180° shutter blur, softer frame edges, a live tremor; skin (pores, sheen, dry lips); effort (tendons, tremor); materials (creases, dust, scuffs); the environment's texture | "ARRI Alexa 35 with a spherical prime" |
| Audio | "Exactly this and only this": every diegetic sound in order, both voices, and no music (music is the edit's job) | |
| Locks | The invariants restated at the end: one person, one continuous shot, only these lines, the direction she falls, the frame ends empty | |

### Shot recipes worth keeping as templates

- **Reveal pull-back**: open on a detail (a face, the sky), dolly out to the blocking sketch, hold.
- **Chase**: behind and above the subject at its speed, banking late, rain on the lens.
- **POV action cam**: ~150° fisheye, rolling shutter, exposure dipping in shadow, constant shake, breath on the mic.
- **Pan-to-reveal with a pass-by smear**: a tripod holds on a distant subject, then pans to bystanders. The subject crosses the frame in a few frames as a blur with one flash of the brand colour, and its pressure wave hits the bystanders.
- **Side-tracking slow motion**: centred, 120 fps.
- **Telephoto face in slow motion**: 100 mm, razor-thin focus, sand hitting the face, a grin at the end.
- **Aerial half orbit** at blue hour.
- **Ultra-wide intimate handheld**: 14–16 mm, half a metre from the face, then a swing to the world around.
- **Overhead top shot**: locked off, a hand drawing a route.
- **Telephoto from shore**: 300 mm, the wave compressed behind the subject.
- **Natural packshot**: a ~100 mm macro at 45°, tracking the product through an unposed gesture (she takes the glasses off and folds them while talking to someone off-frame). Reflections show only the environment. No text.

---

## Part B · Motion design for viral launch clips (the Claude Motion guide)

### Their setup, for comparison

- **Claude Opus 5.5 in claude.ai, with a "Motion" artifact.**
- **Two Claude skills:** a core motion skill that learns a brand's style, and a SaaS skill that turns screenshots into UI animation and camera moves.
- **Higgsfield as a connector** for footage, characters, locations and voices.
- **The same split as ours:** the motion is editable code, the media comes from a model service, and the two are kept separate.

### The seven briefs

| # | Brief | Format | What it asks for |
|---|---|---|---|
| 1 | Recreate a launch ad shot by shot, with new footage | Matches the reference | <ul><li>Match the duration, framing, cut points, typing, cursor, camera and transitions; rebuild the UI in code.</li><li>Character and car sheets on grey, plus empty three-quarter location sheets, all reused. The sheets are references; shots needn't start on a sheet frame.</li><li>A continuity list: the laptop stays open, the mug is in the right hand, no extra people, one continuous take.</li><li>A clean, legible logo; footage kept separate from the motion; a comparison at the same absolute timecodes.</li></ul> |
| 2 | Three references become one original launch | 1920×1080, exactly 20 s | <ul><li>Kinetic type, a particle sphere, a moving dot grid and a 3D fan.</li><li>Scenes joined by visible actions, matching shapes and a continuous camera.</li><li>Controls exposed; text boxes resize with the copy; a shared timeline moves the music and SFX cues.</li></ul> |
| 3 | A 3D laptop launch with a product swap | Exactly 30 s | <ul><li>A 3D scene built in code, with crisp 2D UI plates; one desk and one laptop are the whole world.</li><li>Real materials, softbox light, a motivated camera.</li><li>Compositing extras: light streaks, flares, glints, faint dust; hand-drawn transition accents.</li><li>A product assembled from believable parts in order (a bike: frame, fork, wheels, bars, pedals, saddle).</li><li>New shots to reach 30 s; a continuous flip transition with no pause in the middle.</li></ul> |
| 4 | An ASCII journey inside an app | 24 s | <ul><li>Start in a believable UI; a click launches the camera into the app.</li><li>Cards become tunnels, graphs become tracks, files assemble into a timeline.</li><li>Back to the UI to reveal the finished video.</li><li>One glyph set, one particle scale, one palette; each transformation grows out of the previous action.</li></ul> |
| 5 | Invent a product; a 3D launch from six references | 20 s | <ul><li>The arc: an intriguing detail → a reveal through connected shots → the defining feature → a product-and-name lockup.</li><li>Fisheye close-ups and bold light.</li><li>An original score in code, with accents on the camera moves.</li></ul> |
| 6 | A SaaS launch with detailed UI | Exactly 15 s | <ul><li>One believable workspace: sidebar, canvas, toolbar, property panels, rulers, selection frames, cursor.</li><li>The workflow: select → change properties → reveal the better composition → name + call to action.</li><li>Values and names stay the same across shots; every click has its visible result.</li><li>UI morphs, object carries and fly-throughs; direction kept across cuts; overlapping actions; no sudden stops, no floating cards; precise click sounds.</li></ul> |
| 7 | An animated 2D explainer with generated voices | 30 s, 24 fps | <ul><li>Voices first: generate the takes, measure them, build the audio timeline, then animate. Re-take any line that doesn't fit its window.</li><li>Exact dialogue per window.</li><li>Anticipation, follow-through, squash and stretch, pauses before jokes.</li><li>Lip-sync, with closed mouths during silent reactions; grounded steps; props held correctly.</li><li>All text in code, for accuracy; a guard on the facts.</li></ul> |

### The motion grammar under the briefs

1. **References over adjectives, detail over hype**: framing, timing, transitions, hex codes.
2. **Exact format and duration**, always.
3. **Name the fidelity mode**: recreate exactly, combine into an original, or keep the story and rhythm in a new medium.
4. **Name the visual vocabulary and keep it consistent**: one glyph set, one particle scale, one type system.
5. **Connective tissue**: every scene change is a visible action, a match on shape, or one continuous camera move. Direction carries across cuts, actions overlap, nothing stops dead, nothing floats unanchored.
6. **Story arcs**:
   - a launch: detail → reveal → defining feature → lockup;
   - SaaS: select → change → better result → name + call to action;
   - a journey: into the app → transformations → back out to the payoff.
7. **UI truth**: values stay consistent, every cursor action has its effect, and there is time to read each UI state.
8. **Editability**: controls, text boxes that adapt, one shared timeline for picture and sound.
9. **Sound designed to the action**: clicks, selections, transitions, the reveal; music accents on camera moves.
10. **A named QA list per medium**: flicker, overflow, clipping, 3D intersections, broken reflections, sync, continuity, distorted branding.
11. **Briefs that fold in the revision notes**, so a single message gets the final film.
12. **"Don't stop at a storyboard."** That is their autopilot; ours stops at approval gates on purpose.
13. **Precedence statements**: the supplied references and brand assets override the skill's defaults.

---

## Part E · What video 1 adds (Oakley × Meta, watched frame by frame)

### The finished ad (0:00–0:57)

- **The format:** a 4:3 picture inside 16:9, about 14 shots of ~4 s each. The dialogue is burned in as yellow subtitles (clean sans, bottom centre).
- **The shot order:**
  1. "Hey, Meta!" upside down;
  2. the pull-back;
  3. the wingsuit flying at the camera;
  4. the three climbers;
  5. the POV through the rock needles, with her pink-lined gloves in frame;
  6. the cyclist laughing;
  7. the horse wide;
  8. the jockey's face (the brand mark is readable on the lens);
  9. the blue-hour climber, "Hey, Meta!";
  10. the blizzard close-up, "…above sea level";
  11. the filmmaker among the penguins;
  12. the speedboat;
  13. the campfire;
  14. the packshot.
- **The end:** the packshot, then the OAKLEY | Meta lockup inside a camera-viewfinder frame (corner ticks and a red record dot), opening to full 16:9.
- **"Temperature contrast"** (her chapter title): neighbouring shots alternate warm and cold palettes: grey rock → green road → gold desert → blue snow → bright summer lake → campfire orange.

### Her process (what the guide leaves out)

1. **Product research.** She studies the brand's own commercial and product page. The feature list (camera, speakers, action button, battery) becomes what the story must show:
   - the camera: filming, and a POV shot;
   - the speakers: the glasses answer;
   - live info: distance, altitude.
2. **The story from pictures.** Pinterest reference photos go on a moodboard (Higgsfield's Canvas, "an infinite moodboard"), one photo per scene. The most arresting one becomes the hook: a handstand on a cliff edge.
3. **Claude writes every prompt.** She types one or two sentences and attaches the images: selfie + outfit reference + product photo, or sheet + plate + sketch. Her prompt skill expands that into the block prompt. A named style ("in the style of Emmanuel Lubezki, wide lenses, camera super close") comes back as lens, distance and light, without the name.
4. **Character sheets in Seedream 5.0 Pro** (2K, 2.5 credits), one per wardrobe: 11 sheets. They include the three colour-coded climbers, the horse, and later the two friends and the dog.
5. **Location plates in Soul Cinema** (0.125 credits). Each is written with a "LENS GATE": the future shot's camera position, height, distance and lens (35 mm ≈ 54°), and the plate is "ready for a performer to be placed". The plate and the video share one lens.
6. **Every asset locked before any video** ("13 scenes · locked in").
7. **A hand sketch per shot**, drawn on an iPad: a red figure, a yellow head with the product, a green ground line. Some are traced over a reference photo. The hard scenes (the campfire, the packshot) get detailed comic-style frames.
8. **Video in Seedance 2.5, drafts first.** References are named (`@kareema`, `@glasses`, `@image1` for the plate, `@map` for the sketch).
   - **Drafts:** 480p in "Seedance 2.5 Draft", e.g. 10 s, 4:3, 30 credits. She compares six takes.
   - **The final:** the chosen take re-rendered at full quality ("Same take", "Upscale").
   - **"This is why we test in 480p":** a draft that framed the hook wrongly cost little.
9. **Scenes linked inside the generations.** The wingsuit flyer from the first scene passes over the cyclist ("To the ground").
10. **The failure she shows.** The campfire, generated with only her own sheet, invented random strangers, one with a guitar. The fix was a sheet for every character, the dog included, shown as a before/after.
11. **The cost.** Sheets and plates came to 28.6 credits; 480p drafts, iterations and upscales to 1,150; 1,180 in total. **Assets were ~2 % of the spend, video ~98 %.**

**Lessons she puts on screen:**
- "Wide lens = speed".
- "POV from the glasses": the shot that sells a camera product.
- The climbers' pressure-wave gag, credited to *Cars*.
- "Brands don't care how you made it."

**Her own explainer's look (also worth taking):**
- Two-font captions: a small italic serif lead-in over a big bold sans line that types on.
- Glass title bars framed by viewfinder corner ticks, and pill labels ("EPISODE 3").
- Floating phone and stats cards over misty landscape B-roll.
- Each prompt overlaid on its result, with the key phrases highlighted.
- A running credits counter.
- "STEP" chapter cards over a motion-blurred figure.
- Before/after split cards.

## Part F · What video 2 adds (Claude Motion, watched frame by frame)

### How they worked

- **Claude Code with Higgsfield's CLI and skills** (`npm i -g @higgsfield/cli`, `npx skills add higgsfield-ai/skills`). There is also a claude.ai "Motion" artifact with an editor around the code.
- **Two messages per film.** The first is short ("recreate this ad shot by shot, rebuild the UI in code"). The second is the revision: "keep the motion that already works, redo the live-action footage", plus the sheet and continuity notes. Each published brief is those two merged.
- **Run times:** 2 h 7 min with 4 agents for the recreation's fix pass; 6 min 51 s for "make it premium".

**The six motion primitives they name:** Position · Scale · Rotation · Reveal · Rhythm · Path.

### The viral-intro grammar (the video's own first 18 s, at half-second steps)

- **Pace:** about 20 beats in 18 s, a change every 0.5–1 s.
- **Shape morphs carry every change:**
  - a prompt bar types "Anthropic just dropped" and becomes the logo lockup;
  - a toggle ("Challenge mode") becomes a lime ring with words inside;
  - the ring becomes a prompt bar;
  - three level cards appear, and the camera dives into one.
- **One-word type beats with a full stop:** "Generate.", "chaos.", "loud.", "Animate.". They alternate between a bold sans and an italic serif.
- **Textured grounds:**
  - a particle sphere that bursts inside orbit ellipses;
  - halftone dot grids;
  - particle-wave terrain;
  - scribble frames.
- **Depth:**
  - a 3D fan of clip cards with labels ("Seedance 2.5 · clips", "Soul Cinema · stills");
  - an exploded isometric UI stack with layer labels ("DESIGN IN LAYERS.");
  - 3D product objects;
  - a giant glitter cursor that clicks.
- **Speed:** horizontal motion-blur smears and whips.
- **Footage as collage:** a triptych split with a serif title across it; a mosaic grid.
- **The agent as narrator:** a checklist ("Reading the brief… / Developing stills in Soul Cinema… / Rolling clips on Seedance 2.5…"), status pills ("Mapping body and wheel mounts…"), a "Rendering… 60 fps" progress card.
- **The payoff:** a "film.config.js — copy, timing, colours, all editable" card is clicked, and the confetti lockup lands. Its palette is a soft peach-to-lime gradient, a serif display with one italic word, small geometric confetti and a hand-drawn underline flourish.

### The Claude Motion editor

- **A controls panel:** on-screen words, button label, palette. One change recolours the film from peach to mint.
- **An inspector and a timeline:** an inspector on a property (`card.y`) and a keyframe timeline over the code's curves (`pop(t)`).
- **Notes pinned to the player.** Comments are left at timecodes in the player and sent to Claude as fixes, e.g. "replace the floating entrance with one grounded step… pull the camera back when she puts the passport down" at 0:00, and "turn the clipboard so…" at 0:22.

### 3D, exports and the explainer

- **A 3D shot list in code** with camera helpers (`orbit`, `dolly`, `push` toward the laptop screen, `crane`).
  - **It checks itself:** it renders a preview, reads single frames back, edits, and renders again.
  - **Assembly from a sketch:** the product is built up from a sketch (a chassis, then "Mapping body and wheel mounts…").
  - **The swap:** "replace the truck with a bicycle" happens in a browser 3D viewport with gizmos.
- **Exports:**
  - **Blender:** four agents in parallel (baker, exporter, Blender builder, verifier) rebuild the scene there.
  - **After Effects:** rebuilt with editable layers on request.
- **SaaS motifs:** multiplayer cursors with name tags ("DESIGN TOGETHER"), exploded layer stacks, 3D phone turns.
- **The explainer split:** the cartoon characters are generated; every page, label, map route, stamp and check is code. The pet-passport pages are the editable layer.

---

## Part C · Against our skill

| Topic | Ours today | Gap |
|---|---|---|
| Character sheets | One face per sheet on #8a8a8a; states as separate sheets; faceless prop sheets (`CASTING.md`) | The pose panel, the proportion lock, a product sheet with colourways, vehicle and animal sheets, one-job reference grammar, a closing line |
| Location plates | Empty three-quarter plates with the light pinned (`casting.py locations`) | — |
| Footage prompt | `FOOTAGE.md`'s realism recipe and short motion brief: handheld, one move, beat by beat, keep the look, no text | The full block grammar, lens/FOV numbers, physical rigs, first and final frame, locks, counts, physics, audio |
| Footage model | FLUX key frame → MiniMax H3 on fal, $0.16/s at 1080p (`gen.mjs`) | No native audio or lip-sync, no tagged multi-reference. **Seedance 2.5 is on fal**: image-to-video with first and optional end frame plus synced audio, and reference-to-video with up to 50 references tagged @Image1…, 4–30 s, 480p/720p, 24 fps, about $0.47/s at 720p (fal's page, to verify) |
| Position control | None for generated footage. The new placeholder plates (`STORYBOARD.md`) draw blocking for storyboards | Her coloured position sketch with a legend is almost exactly a placeholder plate |
| Packshots | The app's screen pinned onto phones (`pin.py`) | A natural physical-product packshot recipe |
| Motion engine | ~25 blocks; the transitions whip, zoom, blur, glitch, smear, tunnel, flash and drift; a beat grid driving picture and sound; review sheet; AE layers; recreation with proof | Particle sphere, dot grid, 3D fan, an ASCII/glyph world, compositing extras (streaks, flares, glints, dust), hand-drawn accents, fisheye; cross-shot carries and UI morphs (the engine draws one shot at a time); real 3D and Blender export |
| SaaS | `phone`, `browser`, `panel`, `prompt` and `agent` blocks, with cursor clicks | A design-workspace block (canvas, rulers, selection frames, property panels) and a check that UI state stays consistent across shots |
| Voice | Mixes and ducks a recorded voiceover; never synthesises one (Limits). The Cue short placed measured takes in its own mix script | VO-first timing and generated voices |
| Process | Approval gates, review sheet, QA | Folding the notes into a consolidated next-run brief; an optional autopilot |

---

## Part D · Proposals (to discuss; nothing built), updated after the videos

> **Update (2026-10-26, later):** P15 is done and P8/P9 are re-planned from the three `.skill` files and the four reels: see `TAKE-AND-HOW-2026-10-26.md` (numbers in `reels/reels.json`, the readers' reports in `readers/`).

| # | Proposal | What it adds | Size | Cost to run | Needs your call |
|---|---|---|---|---|---|
| P1 | **Shot brief → block prompt compiler + linter** for footage | Her flow exactly: one or two sentences plus the images in, the full block prompt (Part A) out. A named style becomes lens, distance and light, with the name dropped. A lint refuses a missing block, two camera moves, a line too long for its window, unlocked counts or banned words. Built like `casting.py`: a dry run with a quote, a ledger and a cap | M | None by itself | — |
| P2 | **Position references** | From a placeholder plate (a `--legend` mode on `placeholders.py`) or from your own hand sketch (her iPad method), plus the map-legend sentence for the prompt. The storyboard frame becomes the generation's final-frame reference | S | 0 | — |
| P3 | **Casting upgrades** | <ul><li>A sheet for **every** character, extras and animals included (her campfire failure).</li><li>Location plates written with a LENS GATE that matches the shot's lens.</li><li>The pose panel, the proportion lock, product sheets with colourways, one-job reference grammar, the closing line.</li></ul> | S–M | Same as today | — |
| P4 | **Seedance 2.5 on your fal key, drafts first** | <ul><li>Six 480p drafts, then the chosen take re-rendered at 720p (fal's limit; Higgsfield offers 1080p). A first-frame or end-frame route and a tagged-reference route.</li><li>Native audio and lip-sync, so the product can answer.</li><li>The quote splits like hers: assets ~2 %, video ~98 %.</li></ul> | M | ~$0.22/s drafts, ~$0.47/s finals at 720p (fal's page, to verify) | **Yes**: a new paid model |
| P5 | **Shot recipes in `FOOTAGE.md`** | Reveal pull-back, chase, POV action cam, pan-to-reveal with a pass-by smear, telephoto slow motion, aerial half orbit, ultra-wide intimate handheld, top shot, natural packshot; "the product answers" demo; "wide lens = speed"; "POV sells a camera" | S | — | — |
| P6 | **Audio policy** | Generated clips carry diegetic sound only, no music; our score goes on top in the edit, ducking under the dialogue | S | — | — |
| P7 | **VO-first mode** | Lines generated or recorded per shot and measured; shot lengths come from the takes; a take that misses its window is redone | M | Depends on the voice service | **Yes**: which voice provider (your OpenAI key is approved for images only) |
| P8 | **The viral motion kit** | <ul><li>Shape-morph transitions (bar → logo, toggle → ring → bar).</li><li>One-word type beats in bold sans and italic serif.</li><li>A particle sphere and burst; dot-grid and particle-terrain grounds.</li><li>A 3D clip fan, an exploded layer stack, a glitter cursor, a triptych and a mosaic.</li><li>Agent checklists and a render-progress card; a map that draws its route.</li><li>Light streaks, flares, glints, dust, hand-drawn accents.</li><li>The six primitives (position, scale, rotation, reveal, rhythm, path) as the guide's vocabulary.</li></ul> | M–L | 0 | Which first |
| P9 | **Connective transitions across a cut** | Shape morphs and shared-element carries between shots (an engine change: today one shot draws at a time) | L | 0 | — |
| P10 | **SaaS workspace block + a UI-continuity check** | Canvas, rulers, selections, property panels, multiplayer cursors with name tags; QA that names and values match across shots | M | 0 | — |
| P11 | **A real 3D lane** (three.js in our Chrome renderer) | A shot list with camera helpers (orbit, dolly, push, crane); a self-check that reads its own frames; products assembled from parts; Blender export (we already export After Effects) | L | 0 | Whether 3D is worth it now |
| P12 | **Story and edit rules** | <ul><li>Product features become story beats.</li><li>Temperature contrast between neighbouring shots.</li><li>Scenes linked by a shared element (the flyer passes the cyclist).</li><li>A hook picked from the reference photos.</li><li>Arcs: launch, SaaS, journey, and "life moments where the product answers".</li></ul> | S | — | — |
| P13 | **Review upgrades** | Notes pinned to timecodes on the review sheet; after the rounds, one next-run brief with every applied note folded in | S | — | — |
| P14 | **An optional autopilot** | Run to a finished draft without the gates; paid steps still quote first | S | — | Whether you want it |
| P15 | **Study Higgsfield's own reels** | The four referenced reels through `--breakdown` and our motion measurement, turning their grammar into numbers (cut rhythm, morph timings, easing) | S | 0 | — |
| P16 | **Live controls in our preview** | Like the Claude Motion editor: edit copy, palette and shot timing in the `--serve` preview and write them back to `beats.yaml` | M | 0 | — |

## Open questions

1. **Skill files**: download and read the three `.skill` files? They are read-only, never installed and never run. Her prompt skill is the piece behind P1.
2. **Reels**: study the four Instagram reels the motion guide references (P15)? It's reading only, through our frame-capture method.
3. **Priority**: my suggestion is
   - first, prompt quality with no new spend: P1 + P2 + P3 + P5 + P12;
   - then the viral motion look: P15 → P8 → P9;
   - then the new paid models: P4 / P7;
   - P11 (3D) and P16 later.
