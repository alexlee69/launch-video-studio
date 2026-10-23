# hf02-full — builder brief

**Job:** `~/Downloads/launch-videos/hf02-full/`. **Reference:** `~/Downloads/higgsfield02.mp4` (1080×608, 30 fps, 1909 frames, 63.6 s). Every frame is dumped at `ref/frames/n0000.png … n1908.png`; contact sheets are in `ref/sheets/`; frame-to-frame similarity is in `ref/cuts.json` (`ncc` near 0 = hard cut).

## What we are making, and the one hard rule

We are making an **original 63.6 s film whose motion matches the reference frame for frame**. Each shot keeps the reference's timing, cuts, transitions, camera moves, easing, motion blur and event timings (pops, wipes, type-on and streaming rates, bubble in/out). Each shot also does the same job in the edit, for example "a card rushes past in 3D here".

**Hard rule: everything a viewer sees as content is ours.** Never copy any of these from the reference:
- its text or close paraphrases of it,
- logos, wordmarks, watermarks or the social-network icon,
- its mascots or characters,
- its footage, pictures, cards or app screens,
- its layouts. Don't trace where its boxes sit. Compose each shot yourself, in our design language.

Generic UI vocabulary (chat messages, a list, a card, a phone, a pill-shaped bubble) is fine. A recognisable copy of their scene with names swapped is not. When in doubt, change the composition, not the motion.

All copy comes from `story.js`. If you need a line that isn't there, add it to the `NOTES` of your notes file and use a placeholder in your scene file. Don't edit `story.js`.

## Who owns what

| Builder | Reference frames (inclusive) | Shots |
|---|---|---|
| **W1 open/close** | 0–97 and 1698–1908 | lockup build + push-in (0–74), fly-through corridor (75–97), outro lockup (1698–1786), end card (1787–1908) |
| **W2 plates** | 96–263 and 1529–1697 | plate 1: card grows to full-bleed, prompt bar types the prompt, send, bar whips off, plate continues (96–263); plate 2: card grows, push, agent bubble (1529–1628); carousel of portrait cards (1629–1697) |
| **W3 chat** | 264–509, 671–742, 972–1000 | chat opens (264–311); window pan, crew roster with highlight slot, second chat (312–509: motion already measured, see below); research chat close-up (671–718); big-type close-up (719–742); insights chat + whip out (972–1000) |
| **W4 cards** | 510–670, 743–971 | review card + agent bubble, 3D tilt, a deck rushes past, second card (510–640); close-up + bubble (641–670); dark reply thread scrolling, whip (743–842); wall of cards panning (843–921); featured card push-in, blur out (922–971) |
| **W5 fan** | 1001–1259 | full-screen app screen shrinks to a card (1001–1030); 3D fan of app screens + floating agent labels + caption (1015–1125); zoom through the front screen, scroll to the "plan ready" chat + doc (1125–1206); white whip to the "building" chat (1207–1259) |
| **W6 burst/app** | 1260–1530 | cast close-up, zoom out, burst of many characters, collapse (1260–1339); media chat + phone rising (1340–1425); phone app screens: home, library, tab switch, play, "shipping" bubble (1426–1530) |

Check your boundary frames yourself in `ref/cuts.json` and the frames, and adjust a boundary by a frame or two if the cut really sits there.

**Handoffs.** Where two shots share a frame, both scenes are visible and z-ordered. That covers a dissolve, a whip where the next picture enters before the cut, and the fly-through ending on plate 1's card. Each owner animates its own element in the shared frames. The known shared frames:
- **W1→W2** around n94–98: the plate card appears inside the corridor.
- **W3→W5** around n999–1001.
- **W6→W2** around n1528–1532: the phone whips up while plate 2 enters from below.

Set your scene's `z` so the incoming shot is on top unless the reference shows otherwise.

## Files you own (edit nothing else)

- `scenes/wN-*.js`: your scenes. Call `scene({...})` once per shot.
- `motion/wN.js`: your measured tables, as `window.MWN = {...}`.
- `notes/wN.md`: your notes (see Deliverables).
- `out/wN/`: renders and compare sheets.
- `tools/wN/`: any scripts you write.

These are shared and read-only for you: `lib/*.js`, `story.js`, `stage.html`, `render.mjs`, `tools/*.py|mjs`. If you need a helper, write it inside your scene file. If a shared file has a bug, write it in your notes as `INTEGRATOR:` and work around it.

Don't touch `~/.claude/skills/`, don't commit, and don't make network calls. Delete only inside your own `out/wN/` and `tools/wN/`.

## Framework

`stage.html` loads `lib/core.js`, `lib/cast.js`, `lib/art.js`, `lib/app.js`, `story.js`, then `motion/w1…w6.js`, then `scenes/w1…w6.js`. `window.seek(n)` shows every scene with `from <= n <= to` and calls its `seek`.

```js
scene({
  id: 'w4-review', from: 510, to: 640, z: 40,
  build(S) { /* lay out in S.cam (frame space, 1080×608, origin top-left). S.root is the layer, padded 200px each side */ },
  seek(n, S) { S.camera(tx, ty, s, ox, oy, rotDeg); S.blur(sx, sy); S.op(1); /* animate parts */ },   // may return a Promise
});
```

- **`lib/core.js`**:
  - Easing and lookup: `trk(table, n)` (piecewise-linear `{frame: value}`), `vel`, `clamp/lerp/easeOut/easeOut5/easeIn/easeInOut/smooth`, `mbs(v)` (blur σ = 0.2·speed).
  - Colour: `mix/mixHex`.
  - Layout: `el(parent, cls, css, html)`, `text(parent, str, {x, base, size, weight, color, ls, align})` (baseline-positioned), `para`, `charText` + `stream(chars, p, tail=9)` + `typeOn`.
  - Effects: `blurrable(node)` then `node._blur(sx, sy)`, `wipe(node, p, edge, dir)`, `popScale(p)`.
  - UI pieces: `check`, `searchIcon`, `agentLine`.
  - `footagePlate(parent, key)`: returns a node when `STORY.footage[key]` is set, else null.
- **`lib/cast.js`**: our six characters. `crew(parent, id, expr, bodyWidthPx)` and `placeCrew(node, cx, cy, expr)`. Expressions are `open | blink | happy | dots`. For a crowd (W6), reuse them at many sizes and colours.
- **`lib/art.js`**: `cover(parent, seed, {x,y,w,h,r,title})` draws podcast cover art. Also `avatar(parent, name, {x,y,d})`, `stars(parent, k, {...})`, and `appScreen(parent, seed, {x,y,w,h,r})` for "other apps" screens.
- **`lib/app.js`**: the Hush app. `hush(parent, 'home'|'library'|'player'|'chapters', {x,y,w,h,r})` draws a screen. Parts you can animate are on `node.parts`. Also `phone(parent, {x,y,w,h,b,r})` (returns `.screen`), `hushLogo`, and the `HUSH` colours.
- **`story.js`**: all copy, plus footage slots.
- `tools/gallery.html` shows the shared parts: `node tools/shot.mjs tools/gallery.html out/gallery.png`.

Render your range:

```bash
cd ~/Downloads/launch-videos/hf02-full && node render.mjs --from 510 --to 670 --out out/w4 --jobs 3 --mp4 out/w4/w4.mp4
```

Use `--stills 520,560 --out out/w4s` for single frames. Rendered frames are 1920×1081. `tools/cmp.py` and the other tools read 1080-wide reference frames; resize ours as they do.

## Design language (ours)

- **Paper and type**:
  - Page `#F5F3EF` (warm paper); ink `#16151B`; secondary `#6E6B73`; tertiary `#A29FA8`; rules `#E6E2DC`; cards `#FFFFFF` with radius 18–24, shadow `0 10px 30px rgba(22,21,27,.10)` plus a 1px `rgba(22,21,27,.06)` hairline.
  - Type is Inter only (400/500/600/700/800), tight tracking (−0.01 to −0.03 em), sentence case.
- **Chat**:
  - The user's message is a dark ink pill (`#16151B`, white text), right-aligned.
  - An agent message is the agent's character, then its name (600) and a status chip: a rounded pill tinted with the agent colour at about 14%, text in a darker shade of it. The body text sits under the name.
  - Working steps are a quiet list with small dots that turn into checks.
- **Floating agent bubble** (over pictures): a white pill with a soft shadow, the character on its left, one line of text.
- **Dark surfaces** (thread, wall): `#141218` / `#1D1A22`, text `#F2EFF5` / `#9A95A3`.
- **App "Hush"**: dark plum with a coral accent (see `lib/app.js`).
- **Pictures are stand-ins.** Footage slots (plates, carousel) are our own illustrated plates, drawn in SVG/CSS by W2 in a flat, warm editorial style. Make them rich enough to carry a camera move, and support `STORY.footage[...]` (image or video path).

## How to measure (proven on n300–509; read this before you start)

- **Prior work**: `../hf02-recreate/MOTION-SPEC.md`, `../hf02-recreate/motion.js` (every measured curve for n300–509), `../hf02-recreate/stage.html` (how those curves drive a scene), `../hf02-skill/ref/curves/` (raw tracker logs), and `~/Downloads/Design-AutoPilot-stable/HANDOVER-hf02-motion.md` (the grammar and the traps).
- **Camera tracker**: `python3 -E tools/track.py <abs frames dir> <key frame> <first> <last> <out.json> [--half] [--init s,tx,ty]` fits a similarity warp plus Gaussian blur of a sharp key frame to each frame and prints `s, tx, ty, bx, by, ncc`.
  - It takes ~10–15 s per frame at `--half`, so run one process per shot in parallel (`&`) and keep logs.
  - Tracks are only valid while the same picture is on screen; split at cuts.
  - An ncc below ~0.9 means the model is wrong for that frame (3D, parallax, new elements). Don't trust it there.
- **3D moves** (corridor, deck, fan, card tilts): the similarity tracker can't fit them. Measure 3–4 corners or landmarks per frame on contact sheets (`tools/pick.py`, every frame, cropped and zoomed). You can also write a small template tracker. Then fit a CSS perspective transform (perspective, rotateX/Y, translateZ) per frame and check it by overlaying your render.
- **Event timings**: use per-frame sheets (`python3 -E tools/pick.py <dir> <out.png> <cols> <thumbw> <crop|full> n1 n2 …`) to read the frame where a thing starts and ends, and how its opacity, scale or blur ramp.
- **Momentum cuts are the house grammar.**
  - Shots accelerate into a cut (expo-in ×1.2–1.4 per frame) at peak blur.
  - The next shot enters moving the same way and decays (×≈0.7 per frame).
  - Nothing ever fully holds still: there's a slow drift of ~0.3–4 px/f.
  - Blur σ ≈ 0.2 × speed (px/f) along the motion.
- **Traps**:
  - The tracker over-reads blur about 2× on cut frames where other elements fade at the same time. Calibrate by tracking your own render, where you know the applied σ.
  - Python here is 3.9 with no cv2 or scipy. Run your scripts with `python3 -E` from your own folder.
  - macOS has no `timeout`.
  - `page.setContent` can't load fonts; the renderer already uses `goto`.
  - Lay out text only after fonts load; the stage builds after `document.fonts.load`.

## How you know a shot is done (QA)

1. **Cuts and transitions** land on the reference's frames exactly.
2. **Camera and element motion**: track your own render with the same tool you measured the reference with, and compare the two curves.
   - The peak frame must be within ±0.5 f, the peak speed within ±10%, and the ease shape must match.
   - Slow drifts must be within ±1 px/f.
   - Put the table in your notes.
3. **Events** start and end on the same frames as the reference. Ramps (opacity, scale, blur) take the same number of frames.
4. **Blur** at speed is consistent with the reference reading (σ ≈ 0.2·v, minus the cut-frame over-read).
5. **No blank or broken frames**: no missing fonts, nothing outside the padded layer showing, no page errors.
6. **It's ours**: no reference text, logo, mascot, picture or traced layout.

Make a side-by-side sheet of reference vs ours for every ~10th frame plus each cut ±2 frames (`tools/cmp.py` style), and look at it. The motion should read the same at a glance, while the picture is clearly a different film.

## Deliverables (in your notes file, `notes/wN.md`)

- A shot table: frames, what happens, the transition in and out.
- The measured curves, each with how it was measured and where its raw log is.
- Your own render's tracked curves vs the reference, with the numbers.
- What is approximate and why.
- `INTEGRATOR:` requests (shared-file bugs, story lines you need).
- Paths to your compare sheets and your range mp4.
