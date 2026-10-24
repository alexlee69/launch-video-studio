# SHOTS.md: higgsfield01, shot content, overlays, look and story (agent B)

Reference: `~/Downloads/higgsfield01.mp4`, 2296 frames at 1080×608 and 30 fps. Frame numbers are 0-based (`ref/frames/nNNNN.png`).
Positions are px on 1080×608, with **[1920: …]** = ×1.7778.

**How each kind of number was measured.**
- **Contact sheets:** `shots/sheet-NN.png` uses the breakdown's shot numbers, 8–12 frames per shot. Dense strips and crops are in `shots/check/`. Tools are in `shots/tools/`.
- **Boxes:** read off a 50 px grid (`shots/tools/grid.py`, ±5 px) or from colour-mask bounding boxes (`maskcol.py`, exact px on that frame). Each box says which.
- **Colours:** median of a colour mask, or the median-cut palette of a region.
- **Look:** `look.py`, 12 frames per segment, JSON in `shots/look/`.
- **Cut checks:** `shots/diff.json` is the mean abs RGB difference between consecutive frames at 270×152.
- **First/last frames of text:** read from strips sampled every 2–3 frames, so they are good to about ±2 f. Agent C owns the exact animation curves.

Their copy is quoted here only to time it and count characters. The build writes its own.

---

## 1. Story arc

One adventurer in a cobalt jacket gets a promo brief from a client while in the middle of a jungle expedition. Five times he types a one-line prompt into the bar, hits send, and the agent builds a real After Effects deliverable while he survives an escalating danger. The client's reply then sets up the next brief.

| Act | Frames | Seconds | Share | Beat | What it proves about the product |
|---|---|---|---|---|---|
| 0 Title | 0–68 | 0.00–2.30 (2.30 s) | 3.0 % | Lockup over a jungle "window" plate, then a zoom-through into the world | Names the pairing: Higgsfield MCP × Claude, Opus 5.5, for motion design |
| 1 Setup / the call | 69–381 | 2.30–12.73 (10.43 s) | 13.6 % | Drone dive to a climber by a waterfall; phone message from "Client": "Need a motion promo video. ASAP."; he drops his pack and unzips it | Stakes: an urgent brief, away from a desk |
| 2 The problem | 382–587 | 12.73–19.60 (6.87 s) | 9.0 % | The pixel cat appears and morphs into a cube, a triangle, fire and AE expression code while the floating words ask "What is it this time? Objects? Shapes? VFX? Expression?", then "Wait / No / Let me explain" | Motion design by hand means endless choices. The mascot is the agent's personality |
| 3 Work montage (5 loops) | 588–1932 | 19.60–64.43 (44.83 s) | 58.6 % | Each loop: live-action peril + prompt bar → send → orange pixel dissolve → white status card → AE result | The agent plans, generates, lays out and animates real AE comps |
| ↳ Loop 1 logo | 588–846 | 8.63 s | | "I need a promo. Fast. No mistake." → "Promo brief received. Starting with the reserve logo." → mascot badge builds over footage → named layers → "Ara" speech bubble types itself | Brand mark + character, organised layers |
| ↳ Loop 2 asset kit | 847–1102 | 8.53 s | | Jungle run with laptop → "Create visual assets for Ivayu Reserve." → card with a Higgsfield tool line → AE project bin → brand sticker sheet → keyframed timeline | Asset generation (the Higgsfield tile = image generation), a tidy project, animation |
| ↳ Loop 3 map | 1103–1486 | 12.80 s | | Rope bridge chased by monkeys → "Make a map…" → crash-in "The easy route!" → boots → "Mapped. Five stops…" → island map builds → "Generating photos of the trail stops..." → trail infographic with pins and photo cards | Information design + generated photos |
| ↳ Loop 4 landmark | 1487–1799 | 10.43 s | | Falls against a ruin wall, an arrow thunks above his head, he calmly opens the laptop: "Create a visual of the reserve's landmark." → "The Sun Gate" poster builds | Editorial layout with a hero photo |
| ↳ Loop 5 render | 1800–1932 | 4.43 s | | Temple, giant boulder, light strike: "Render the final and send it to the client!" → AE download card "Ivayu Reserve Promo" | End to end: it delivers a file |
| 4 Payoff + CTA | 1933–2174 | 64.43–72.50 (8.07 s) | 10.5 % | Calm daylight close-up; client: "Looks great! Next brief: a safety video for the reserve."; pull back to a wide with the cat on a branch; CTA line | Client happy, a repeatable workflow, a call to try it |
| 5 End card | 2175–2295 | 72.50–76.53 (4.03 s) | 5.3 % | Frozen last frame dimmed to 23.7 %; Instagram icon + handle | Where to follow |

**When each prompt is sent** (the send button's glow frame): n652 (21.73 s), n913 (30.43 s), n1181 (39.37 s), n1641 (54.70 s), n1895 (63.17 s). The gaps are 8.7, 8.9, 15.3 and 8.5 s, so the product is shown working about every 9 s.

**The danger escalates while the work escalates:** waterfall → jungle run → rope bridge with monkeys → arrow → temple boulder and lightning. Over the same five loops the work goes logo → asset kit → map → poster → final render.

**Bookends:** the same message-bubble template opens act 1 (8.4 s) and closes act 4 (66.8 s), with "Today 10:24" and "Client" both times. The last message sets up a sequel.

### Content mix (every frame classified, totals 2296 f)

| Type | Frames | Seconds | % | Where |
|---|---|---|---|---|
| Footage, clean (watermark only) | 561 | 18.70 | 24.4 | 69–251, 348–384, 847–877, 1103–1140, 1219–1256, 1487–1605, 1800–1835, 1933–2004, 2053–2059 |
| Overlay on footage | 846 | 28.20 | 36.8 | title 0–68; message 252–347; cat/words/objects/prompt 385–660; prompts 878–927, 1141–1218, 1606–1650, 1836–1904; message 2005–2052; cat + CTA 2060–2174 |
| Screen UI (AE panels dominate) | 120 | 4.00 | 5.2 | 776–806 layers, 973–993 project bin, 1035–1102 timeline/keyframes |
| Generated graphics (in the AE viewer) | 464 | 15.47 | 20.2 | 698–775 badge, 807–846 Ara bubble, 994–1034 sticker sheet, 1294–1361 island map, 1399–1486 trail map, 1651–1799 poster |
| White cards | 184 | 6.13 | 8.0 | 661–697, 928–972, 1257–1293, 1362–1398, 1905–1932 (download) |
| End card | 121 | 4.03 | 5.3 | 2175–2295 |

All live-action, with or without overlays, is **61.3 %** (46.9 s). Product UI and graphics (screen + generated + cards) are **33.4 %** (25.6 s). Footage also appears inside the AE viewer in 698–775 and 807–846 (the badge composited over a talking-to-camera clip), counted here as generated graphics.

---

## 2. Per-shot table

The shot numbers follow `breakdown.json`. **Bold** marks where I see the content differently from the breakdown (agent A owns the final cut list).

| # | Frames | Type | Content | Overlays (besides the watermark) | Look |
|---|---|---|---|---|---|
| 1 | 0–65 | Footage + title | Push through dark foliage toward a sky window over a jungle valley | Higgsfield MCP × Claude lockup, OPUS 5.5, "for Motion Design" pill, UI stickers, flowers; zoom-through out 56–68 | A |
| 2 | 66–347 | Footage | **Same plate as #1 (the "zoom-in" at 66 is the title flying past)**: dive down through the canopy to a climber on a dead trunk over a turquoise pool, then a medium close-up of him wet at the waterfall reading his phone | Message bubble 252–347 | A → B |
| 3 | 348–381 | Footage | **Hard cut inside at n364** (diff 26.1, 8× its neighbours): **3a 348–363** ground-level backpack dropped on the forest floor, boots behind; **3b 364–381** CU hands unzipping the pack | none | C |
| 4 | 382–660 | Footage + overlays | One plate: tilt up from the open pack to the man crouched right of frame by a mossy log, god-rays; pixel fire relights him warm at 502–535 | Pixel cat ↔ cube ↔ triangle ↔ fire ↔ code ↔ cat; floating questions; prompt bar 588–660 | C (D at 506–535) |
| 5 | 661–697 | White card | "Promo brief received. / Starting with the reserve logo." | Claude asterisk | — |
| 6 | 698–775 | AE viewer, generated graphics | Green scalloped badge base → yellow pixel ring → footage of the man revealed → macaw badge completes | AE chrome, cursor, pixel cat | — |
| 7 | 776–806 | Screen UI | Composition tabs, timecode, the layer list populating 9 colour-coded layers | — | — |
| 8 | 807–846 | AE viewer | Footage of the man pointing; the Ara badge + speech bubble typing "Ask me about trails, tickets and secret spots." | cursor, text box handles, pixel cat | — |
| 9 | 847–927 | Footage + prompt | Tracking side-on as he runs through buttress-root jungle with an open laptop; macaques on the left | Prompt bar 878–927 | C |
| 10 | 928–972 | White card | "Creating photos, pins, and badges..." + Higgsfield tile line "Generating visuals for "Ivayu" Reserve." | — | — |
| 11 | 973–993 | Screen UI | Sky-blue desktop; AE window slides in; Project panel folders and files populate | — | — |
| 12 | 994–1008 | AE viewer | Brand sticker sheet: badges, sun-ray sticker, photo frame | cursor, pixel cat | — |
| 13 | 1009–1034 | AE viewer | Sheet continues: trail line, island tile, Visitor Center pill, mini houses | cursor, pixel cat | — |
| 14 | 1035–1102 | Screen UI | Whip to the timeline: 9 colour bars, keyframe diamonds appear; tilt up to the sheet (sun coins, feathers, speech bubble, −20 % sticker) | pixel cat falling at the top left | — |
| 15 | 1103–1233 | Footage + prompt + words | One plate: wide of a rope bridge over rapids, him running left→right with a laptop and monkeys behind; **crash-zoom in at 1184–1200 (no cut)** to a shouting MCU | Prompt bar 1141–1192; "The easy route!" 1190–1218 | E → F |
| 16 | 1234–1256 | Footage | Low tracking CU of boots on the bridge planks, white water below | none | E |
| 17 | 1257–1293 | White card | "Mapped. Five stops. One route. Walking times included." | asterisk | — |
| 18 | 1294–1361 | AE viewer | Floating island map builds: river, lake, trees, houses, then the IVAYU logo and title | cursor, pixel cat | — |
| 19 | 1362–1398 | White card | Higgsfield tile + "Generating photos of the trail stops..." | — | — |
| 20 | 1399–1486 | AE viewer | "SUN GATE TRAIL" infographic: pins, distance chips, photo cards popping in with pixel reveals | cursor, pixel cat | — |
| 21 | 1487–1522 | Footage | He tumbles against a carved ruin wall and lands seated | none | G |
| 22 | 1523–1531 | Footage | Macro tracking of an arrow in flight, right→left, heavy motion blur (n1531 is a blurred blend) | none | G |
| 23 | 1532–1650 | Footage + prompt | MCU: the arrow lands in the wall just above his head; he looks right, then opens the laptop on his knees | Prompt bar 1606–1650 | G |
| 24 | 1651–1799 | AE viewer | "THE SUN GATE" poster builds: frame → hero photo → eyebrow → headline → body/pills → 3 thumbnails → logo | cursor, pixel cat | — |
| 25 | 1800–1904 | Footage + prompt | One plate: temple interior, giant stone sphere behind him, laptop open; push-in; a light strike from the ceiling darkens the scene | Prompt bar 1836–1904 | H |
| 26 | 1905–1932 | White card | AE download card "Ivayu Reserve Promo / After Effects / Download" | — | — |
| 27 | 1933–2174 | Footage + overlays | One plate: daylight MCU looking up, then down at his phone; **pull-back 2056–2085 (no cut)** to a wide on a sandy trail under an arching fallen tree | Message 2005–2052; pixel cat 2061→; CTA 2081→ | F → C |
| 28 | 2175–2295 | End card | Last frame of #27, frozen (n2180 vs n2290 MAD 0.9) and dimmed to 23.7 % (measured box ratio, constant 2175–2295, instant at 2175) | Gradient IG icon + "@HIGGSFIELD.AI"; the CTA stays faintly behind | I |

**Frame cadence.** The whole master is **24p delivered at 30p**. Exact repeat frames (diff < 0.05) fall on n ≡ 0 or 4 (mod 5) in 293 of 334 cases: repeat gaps of 4, 5 and 6 frames in white cards, UI and footage alike. Footage moves at 24 fps, and the build should match this (render at 24, or repeat every 5th frame).

---

## 3. Per-shot detail

### Live-action: one actor across 13 plates
**Wardrobe** (identical in every plate):
- cobalt waterproof shell with a hood (median #134D8C, p90 #2D73B5, mask B > R+50, B > G+25; 5–11 % of the frame in MCU/medium shots);
- black technical backpack with olive straps and a carabiner;
- olive cargo trousers, brown leather boots.

**Props:** a smartphone (dark blue back, triple lens) in acts 1 and 4; a silver laptop from shot 9 on.

**The actor:** about 25, tousled brown hair (wet in act 1), thin moustache. His expressions run strained → curious → shouting → calm.

**Shot 1 + 2 (0–347), "Jungle window → waterfall"** (one plate, estimated by eye):
- **0–68:** the camera pushes forward through near-black monstera and philodendron leaves framing a window of blue sky with cumulus clouds over a jungle valley and ridge. About 24 mm (estimated), deep focus, the foreground leaves soft. Daylight, hard contrast: the leaves are silhouettes and the sky is the only bright area.
- **69–105:** the push continues; a tall waterfall drops into the valley. At about n95 the camera tilts down through dark foliage, like a drone dive.
- **105–200:** top-down / high angle on a dead tree trunk leaning across a turquoise plunge pool (#086662); a tiny figure climbs along it as the camera descends.
- **200–347:** the camera reaches a slightly high medium close-up. He clings to mossy rock with his left arm up, the waterfall a bright white strip on the right (p98 228). He pulls out his phone at n248–256 and reads it with a strained face. About 35 mm, mild depth of field, overcast soft light with spray.

**3a (348–363):** ground-level wide (about 24 mm). The black pack thuds onto the leaf litter with ferns around; legs and boots behind. Very dark (p50 17.8, 79 % below luma 40). Barely any camera move.

**3b (364–381):** close-up (about 50 mm) of both hands unzipping the top of the pack: the cuff of the cobalt jacket, an olive strap, a carabiner. Side light, dark green background.

**Shot 4 (382–660), jungle clearing:**
- **Camera:** opens low on the pack and his hands (n384), then tilts up and pushes into a medium-wide (n402–660). He crouches on the right third in three-quarter profile, looking screen left, beside a mossy fallen log, with ferns in the foreground. Haze and god-rays upper left.
- **Lens and light:** about 35–50 mm (estimated), soft background. Cool green ambient; the shadows are cool (R−B −9.5).
- **Fire relight:** at 502–535 a pixel fire sprite appears left of him and the plate relights: an orange key from the left, his cobalt jacket reads magenta (n512), R−B in the highlights +78. This light is in the plate itself, not only in the sprite. He reacts by flinching away (n506–515), then points or gestures toward the objects (n452–n560).

**Shot 9 (847–927):** side-on tracking at mid height (parallel dolly, about 35 mm). He runs screen right through a dim jungle of big buttress roots and arches, holding an open laptop in both hands. Macaques sit on branches at the left edge (about x 60–140, y 140–200 at n915). Dappled, low-key: p98 only 148, no hot highlights. The background is soft and the foreground has motion blur.

**Shot 15 (1103–1233):**
- **Wide (1103–1184):** a wooden suspension bridge over white-water rapids in a forested gorge, about 28 mm. The camera trucks with him as he runs left→right with the laptop, two orange-brown macaques chasing behind him on the planks.
- **Crash-zoom (1184–1200):** the camera accelerates into an MCU. The prompt bar shrinks away with it.
- **MCU (1200–1233):** profile, mouth wide, shouting; laptop in hand; very shallow focus, the background a flat green blur (crop sharpness 3.1). Overcast soft light.

**Shot 16 (1234–1256):** low tracking close-up of his boots striking the planks, white water below. Heavy motion blur, 0.77 s.

**Shot 21 (1487–1522):** medium shot. He tumbles down against an old carved stone wall (moss, ruins; wall colour #4F4D43) and lands seated, with his pack beside him. Flat overcast light, no specular highlights (p98 139).

**Shot 22 (1523–1531):** macro tracking of an arrow, the head leading screen left, against a blurred stone wall. Low contrast (p2 22, p98 122).

**Shot 23 (1532–1650):** MCU (about 50 mm). He sits against the wall; the arrow is horizontal across the frame at y ≈ 105–115, just above his hairline, its fletching right of his face. He looks right, then lifts the laptop onto his knees and types (1580–1650). Flat cool daylight (shadows R−B −12.6).

**Shot 25 (1800–1904):** a temple or cave. He stands centred, holding an open laptop at chest height. Behind him is a giant stone sphere (an "Indiana Jones" boulder, filling about 60 % of the frame width), a carved relief wall, and stone pillars and stairs on both sides.
- **Camera:** low angle (about 24–28 mm) with a slow push-in; the light also changes during the shot.
- **Light, 1800–1862:** soft top light, warm highlights (R−B +29), desaturated (sat 29).
- **Light, from ~1863:** a vertical white bolt or light shaft strikes from the ceiling behind him; dust; the scene drops darker (p50 55 → 35). His face is lit from below and in front by the laptop.

**Shot 27 (1933–2174):**
- **MCU (1933–2056):** a slightly low angle (about 50–85 mm). He looks up, smiling, one hand on a vine, then down at the phone. Behind him, a soft-focus green canopy and an arching fallen trunk; diffuse back and top daylight. The shadows are very cool (R−B −25).
- **Pull-back (2056–2085):** the camera dollies back to a static wide (2085–2174). He stands on a pale sandy trail (#757162) in a hollow under a huge arching fallen tree, with a green canopy behind (#1F3818). The pixel cat sits on the branch to his right.

### Overlays on footage

**Watermark** (not part of the design; drop it or replace it with our own bug):
- An Instagram glyph plus "@HIGGSFIELD.AI" (14 chars) in a condensed bold caps face, with the Threads-style "@".
- The pair **alternates between two corners every 266–275 f (about 9.0 s)** (template-NCC scan, `wm.json`): TR 9–265, LM 272–535, TR 543–807, LM 812–1075, TR 1081–1349, LM 1351–1617, TR 1623–1885, LM 1894–2159, TR 2163–2174. The swaps cross-fade over 2–8 f.
- **TR position** (grid): icon 950–1003 × 77–130 [1920: 1689–1783 × 137–231]; handle 838–1003 × 166–189 [1490–1783 × 295–336].
- **LM position** (grid): icon 77–130 × 338–391 [137–231 × 601–695]; handle 77–241 × 426–450 [137–428 × 757–800].
- **Colour:** the icon is white with a faint shadow, except 70–132, where it is the IG gradient.

**Title (0–68, grid on n50):**
- **"Higgsfield MCP"** (14): a squiggle mark + wordmark with superscript "MCP", white, at 285–575 × 168–205 [507–1022 × 299–364].
- **"×"**, then the **Claude** asterisk (#C87764) + "Claude" (6) in serif at 612–812 × 165–210 [1088–1444 × 293–373].
- **"OPUS 5.5"** (8): a large high-contrast transitional serif in silver-white #E1E1E1 at 245–835 × 245–360 [436–1484 × 436–640], cap height about 110 px [196].
- **"for Motion Design"** (17): "for" in light italic, "Motion Design" in bold geometric sans, lavender #CCB9FD on a purple rounded pill #563C9B with a lighter rim, at 330–772 × 380–447 [587–1372 × 676–795].
- **Decorations:**
  - a tilted dark-glass playback bar (⏮ ◀| ▶ |▶ ■ "Spacebar" ⌄) at 168–445 × 455–515 [299–791 × 809–916];
  - a tilted toolbar (home icon + blue cursor) at 792–935 × 338–397 [1408–1662 × 601–706];
  - embroidered-look pink/red flower stickers at the bottom left and top right;
  - a lime sparkle star beside "Claude".
- **Build order:**
  - "Higgsfield MCP" from n0;
  - "× Claude" n2;
  - "OPUS 5.5" n16 (an orange dot-matrix glow that resolves to solid by n24);
  - the pill wipes in at n28–32;
  - the playback bar from n36;
  - zoom-through from n56, gone after n68.

**Message bubble, shot 2 (252–347) and shot 27 (2005–2052):**
- **Elements:** a centred "Today 10:24" (11) timestamp in small grey; a white rounded bubble (#F6F4F9, radius about 14) with 2 lines of dark grey regular sans; "Client" (6) in small grey under the bubble (right-aligned in shot 2, left-aligned in shot 27).
- **Shot 2 (grid on n300):** bubble 42–368 × 204–280 [75–654 × 363–498]; timestamp at about x 165–245, y 172–184. Text "Need a motion promo video." / "ASAP." (32). The bubble's white bar rises in at n252 and the text is in by n258.
- **Shot 27 (n2050):** bubble 62–403 × 267–337 [110–716 × 475–599]. Text "Looks great! Next brief:" / "a safety video for the reserve." (56). The bar appears at n2005 and is typed by n2014; it greys and fades at 2047–2052.

**Floating words, shot 4 (crop measurements, estimated ±5 px):**
- **Style:** white bold neo-grotesk with a soft shadow, about 22–30 px cap [39–53]. Each word blurs in, drifts slightly in depth, and blurs out, staggered every 2–4 f.
- **Placement:** they sit in the dark negative space between the cat and his face: x 380–740, y 30–200.
- **Sequence:**
  - "What" 414–434, "is it" 418–436, "this" 420–440, "time?" 424–442, together "What is it this time?" (21);
  - "Objects?" 442–466 at about 475–647 × 97–130;
  - "Shapes?" 474–496;
  - "VFX?" 500–516;
  - "Expression?" 530–548 at about 503–737 × 95–131;
  - "Wait" 550–576, "No" 556–580, "Let me explain" 562–586 (a cascading three-line stack at about 387–663 × 38–161).
- **Code:** "time * 60" (9) / "wiggle(2,10)" (12) at 524–564, in a pixel bitmap font (yellow #F4CC48 with a dark outline) at about x 140–560, y 138–245. It bursts out of the fire's pixels.

**Pixel cat and its morph objects:**
- **The cat:** a chunky pixel-art yellow cat (#F4CC48, dark brown outline, dot eyes, ^‿^ mouth).
- **Morph sequence in shot 4:** the cat (385–446; it pops up from the pack at 385–392) → a yellow 3D cube (447–473) → a pixel triangle (474–501) → pixel fire (502–524) → code (524–565) → the cat again (566–660, big: 290–490 × 135–355 on the grid at n655 [516–871 × 240–631]).
- **Elsewhere:** it appears in every AE viewer shot (6, 8, 12–14, 18, 20, 24) and in shot 27 at about 588–672 × 183–268 on the branch (appears 2061–2068).

**Prompt bar (×5):**
- **Glass:** a near-black translucent rounded rectangle (palette #0D0C0D–#161812 with the plate blurred behind it), radius about 16 px, and a thin warm peach/orange rim light that glows brighter along the top and bottom edges.
- **Row 1:** the prompt in white regular neo-grotesk (Inter-like, about 15–17 px cap). Newly typed characters arrive tinted orange-pink, then turn white.
- **Row 2:** "+" at the left; "Opus 5.5" (8) in grey; a mic icon; a round orange send button (#DB745B, 26–34 px).
- **Send:** a white glow flash on the button (2–4 f), then orange pixel blocks spread from the button across the bar (6–10 f) into the cut.
- **Size** (grid ±5 px): about 470 × 120 px [836 × 213], scaled 0.9–1.03 per shot.

| Shot | Bar box (grid) | [1920] | Text (chars) | Bar in | Fully typed | Send glow | Pixel out |
|---|---|---|---|---|---|---|---|
| 4 | 505–972 × 425–548 | 898–1728 × 756–974 | "I need a promo. Fast. No mistake." (33) | 588 | 650, in three beats: "I need a promo." 606, "Fast." 624, "No mistake." 650 | 648–652 | 654–660 |
| 9 | 190–660 × 410–537 | 338–1173 × 729–955 | "Create visual assets for Ivayu Reserve." (39) | 878–880 | 895 | 911–914 | 915–927 |
| 15 | 527–1012 × 377–488 | 937–1799 × 670–868 | "Make a map showing how to get to the reserve." (45) | 1141–1145 | 1163 | 1176–1181 | 1184–1192 (rides the crash-zoom) |
| 23 | 87–555 × 402–525 | 155–987 × 715–933 | "Create a visual of the reserve's landmark." (42) | 1606–1608 | 1623 | 1638–1641 | 1644–1650 |
| 25 | 42–465 × 420–530 | 75–827 × 747–942 | "Render the final and send it to the client!" (43) | 1836–1840 | 1855 | 1893–1895 | 1897–1904 |

- **Placement:** the bar always sits in the lower half, opposite or below the subject's eyeline: bottom right (4), bottom left (9), right (15), bottom left over the jacket (23), bottom left (25).
- **Typing speed:** the first prompt is typed slowly for drama, in three beats over 62 f. The others type at about 2.5–3.5 chars/frame (12–18 f per prompt).

**"The easy route!" (15) in shot 15:** two lines of white bold sans, "The easy" (n1190–1206) over "route!" (n1200–1218), at about 820–1000 × 150–235. It sits upper right, partly behind the TR watermark, and blurs in and out as the crash-zoom lands on his shouting face.

**CTA, shot 27:**
- **Text:** "TRY HIGGSFIELD MCP FOR MOTION DESIGN IN AFTER EFFECTS WITH CLAUDE OPUS 5.5" (74).
- **Style:** one line of white uppercase neo-grotesk (medium), centred across the wide at 146–932 × 297–310 (mask, exact) [260–1657 × 528–551], cap height about 13 px [23], about 10.6 px per character. It is small and quiet.
- **Timing:** first frame n2081; it stays to n2174 and stays visible, dimmed, under the end card.

### White cards

**Template:**
- **Ground:** a flat #F3F0F5 (palette 100 %).
- **Claude cards:** an orange asterisk (#CD745B, about 51–55 px) to the left of 1–2 lines of regular neo-grotesk; line 1 near-black #0F0C11.
- **Higgsfield lines:** a 54 px rounded square in yellow-green #CCE511 with a black squiggle glyph, followed by text in a plum/magenta gradient (#974A68 median), which reads as a "generating…" shimmer.
- **Layout:** left-aligned blocks sitting at about y 240–380, horizontally centred as a group.
- **Motion:** each card drifts or scales slightly and exits by sliding up with blur (agent C measures).
- **Watermark:** it stays on top in light grey-white.

| # | Frames | Text (chars) | Measured boxes (mask, at frame) |
|---|---|---|---|
| 5 | 661–697 | asterisk + "Promo brief received." (21) / "Starting with the reserve logo." (31), both near-black; typed in from n663, complete at about n670 | n680: asterisk 144–199 × 242–295 [256–354 × 430–524]; text 238–~870 × 255–358 [423–1547 × 453–636] |
| 10 | 928–972 | asterisk + "Creating photos, pins, and badges..." (36) in grey #5F5D61 (in-progress); then HF tile + "Generating visuals for "Ivayu" Reserve." (39) in plum, appearing about n940 | n950: line 1 200–927 × 266–312; HF tile 194–248 × 327–381 [345–441 × 581–677]; plum line 264–848 × 342–375 [469–1508 × 608–667] |
| 17 | 1257–1293 | asterisk + "**Mapped.** Five stops. One route. Walking times included." (54); "Mapped." bold near-black, the rest grey; wraps after "Walking" | n1280: asterisk 170–215 × 252–291 [302–382 × 448–517]; text 246–906 × 265–331 [437–1611 × 471–588] |
| 19 | 1362–1398 | HF tile + "Generating photos of the trail stops..." (39) in plum | n1385: tile 182–235 × 276–329 [324–418 × 491–585]; text 278–883 × 290–325 [494–1570 × 516–578] |
| 26 | 1905–1932 | Download card on #F3F0F5: a rounded grey panel #D9D7DB; an AE file icon (navy tile, lavender "Ae"); "Ivayu Reserve Promo" (19) in grey #6x; "After Effects" (13) in light grey; a "Download" button (8) with a divider and a chevron. It blur-zooms in at 1905–1908 | n1920 (grid): panel 117–963 × 247–372 [208–1712 × 439–661]; icon 162–278 × 262–372; title 308–635 × 285–318; button 697–936 × 279–338 |

### Screen UI (After Effects-like)

**Chrome:**
- dark panels #262328 / #1E1B20;
- the comp viewer bar reads "50%", "00:00:00:00" (blue), "Full", "Active Camera", "1 View";
- a timeline ruler 0s–12s with a blue playhead parked at 0s and a green work-area line;
- a right-hand panel listing Properties, Align, Effects & Presets, Animation, Blur & Sharpen, Color Correction, Distort, Generate, Stylize, Tracker, Audio.

The time never moves (the playhead stays at 0). The motion comes from the camera (pushes, whips and tilts across the UI) and from content appearing.

| # | What is shown | What happens |
|---|---|---|
| 6 | Comp viewer over a green-hill desktop wallpaper strip | The badge base drops in (n702) with transform handles and a cursor; a yellow pixel ring flares (714–720); the footage of the man is revealed inside the comp (n726); the badge resolves (735–775). The man in the footage speaks to camera and gestures |
| 7 | Comp tabs "…MAP_16x9 \| IVAYU_RESERVE_MAP_9x16 \| IVAYU_RESERVE_MAP_20x5", a search field, "Source Name" | 9 layers appear one by one, each with a label-colour bar on the timeline (empty at n780, 5 at n795, 9 at n806). The camera pushes in on the panel |
| 8 | Comp viewer: footage + badge + speech bubble | A text box with handles; the body types itself at about 1.6 chars/frame (808 "A" → 835 complete), then deselects (838) |
| 11 | A sky-blue cloud desktop; a macOS window (traffic lights) with the AE toolbar (Snapping) and the Project / Effect Controls / Composition / Footage tabs | The window slides in (973–978). The folder tree populates: 01_REFERENCES, 02_ASSETS (Reserve_flyover.mp4, Sun_Gate_hero.jpg, Jungle_ambience.wav, Trail_notes.txt), 03_PRECOMPS, 04_MASTE[R] (IVAYU_R…). The camera pushes in |
| 12–13 | The brand sticker sheet in the viewer | The camera pans right, then whips (n1009) to the next row. The sun-ray sticker grows its rays (998–1003); the island tile pops; a dashed outline marks the next slot (the pixel reveal is pending) |
| 14 | The timeline with 9 colour bars + property rows | Keyframe diamonds pop in across 3–4 property rows (1060–1102); the camera tilts up to reveal the sheet's top row; the pixel cat falls in from the top left (1035–1060) |

**Layer names and label colours** (shot 7, median of each bar):

| Layer | Colour |
|---|---|
| Line | #459D49 |
| Line 2 | #449E4A |
| Main Logo | #6474DC |
| Main Title | #B23033 |
| Scene Controls | #E68B08 |
| UI Controls | #DEB5C2 |
| CC Layer | #DEB3C1 |
| Generative Video | #4AA451 |
| Music | #DAF4FA |

### Generated motion graphics (the "Ivayu Reserve" brand world)

**Palette** (mask medians):

| Colour | Hex |
|---|---|
| Deep green ground | #0C4529 / #0B512F (ray wedges #1A8A45) |
| Cream type | #F6E9D1 |
| Badge yellow | #EEC438 |
| Chip yellow | #E8C53F |
| Pink | #E84F82 / #E95081 |
| Parrot red | #EF312C |
| Royal blue | #2E56F5 |
| River blue | #3E86E9 |
| Island green | #8AC55D (edge dirt brown) |
| Path cream | #D6E496 |
| Logo orange | #E68827 |
| Map pins | #C85974 |

**Typography:**
- **Headlines** ("SUN GATE TRAIL", "THE SUN GATE", "IVAYU"): a heavy rounded display grotesk with a hard dark drop shadow. The sheet itself names "Gasoek" numerals, so the face is Gasoek One-like (estimated).
- **Small caps labels** ("PHOTO FRAME", "LANDMARK · IVAYU RESERVE"): a squared, pixel-ish heavy face.
- **Body:** a rounded geometric sans (Rubik-like).

**Shapes:**
- a 16-point scalloped sunburst badge;
- stepped "pixel-corner" photo frames with a cream 4 px border;
- pill chips;
- map pins;
- a floating-island map with a brown cliff edge;
- a sun-ray background (light green wedges radiating from behind the content).

**The build grammar:** every new asset appears via the **same yellow pixel-burst reveal** (a ring of yellow pixel squares that dissolves into the object), often pointed at by the cursor, and lands on a dashed or bracketed placeholder.

| # | Asset | Build |
|---|---|---|
| 6 | **Mascot badge "Ara"**: a red macaw with a monocle and a yellow/pink/blue crest inside a pink ring, on a dark green disc, with a yellow 16-point scalloped rim | base disc → pixel ring → parrot and ring resolve (698–775) |
| 8 | **Speech bubble**: a cream (#F9F4E7) cloud-edged bubble, dark green outline (#2E513C), "HI, I'M ARA!" (12) in heavy display + "Ask me about trails, tickets and secret spots." (46) in body | the bubble is present; the body is typed (808–835) |
| 12–14 | **Brand sticker sheet**: a header paragraph (only partly legible: "…real photos, sun rays, pins, labels and a medal. …lows the logo's shape—no stickers for their own sake."); tiles labelled SUN RAYS, PHOTO FRAME, PINS & SERVICES, ISLAND MAP, PLACES, SUN COINS, CREST FEATHERS, SPEECH BUBBLE, DEAL STICKER ("-20%"), each with a one-line rule | pans across; stickers pop |
| 18 | **Island map**: an isometric floating island, river, waterfall, lake, cream paths, about 150 trees, mini houses; the IVAYU logo (orange arch shape, "RESERVE" over "IVAYU", the Ara badge on top) top left with an eyebrow + "IVAYU RESERVE" title; compass + scale bar bottom left | terrain → trees pop → houses → logo and title (1294–1361) |
| 20 | **"SUN GATE TRAIL" infographic**: eyebrow "SELF-GUIDED TRAIL"; chips 2.4 KM / 45 MIN / +220 M / MODERATE / 5 STOPS (pink); a cream trail with arrows and 5 pink pins; place labels (SUNSET RIDGE, PARROT FALLS, SUN BRIDGE, CAFÉ, CANOPY TOWER, SUN GATE, MONOCLE LAKE, FEATHER FOREST, CAMP, VISITOR CENTER); segment chips ("0.3 KM · 7 MIN" style); 6 photo cards with titles and stats (START VISITOR CENTER, 01 FEATHER FOREST, 02 PARROT FALLS, 03 SUN BRIDGE, 05 SUN GATE, 04 MONOCLE LAKE); an "ON THE TRAIL" rules box (4 bullets) | pins and labels are in place at 1399; photo cards pop one by one with pixel reveals (1410 → 1475); the camera pushes in slightly |
| 24 | **"THE SUN GATE" poster**: eyebrow "LANDMARK · IVAYU RESERVE" (24, yellow); headline "THE / SUN / GATE" (12) in cream display; body "The final stop of every trail. An orange arch crowned with the sun, glowing at golden hour." (91); pills STOP 05 (pink) / 2.4 KM (yellow) / SUNSET 18:40 (cream); a hero photo of an orange arch with a sun emblem at golden hour (stepped frame, the Ara badge on its top-left corner, pin + label "05 SUN GATE / 2.4 km · 45 min from the Visitor Center"); "ON THE WAY" with 3 thumbnails (02 PARROT FALLS, 03 SUN BRIDGE, 04 MONOCLE LAKE); the IVAYU logo bottom right | empty green rays (1651) → frame outline + pixel burst (1662) → hero photo + pin (1680) → eyebrow types (1698–1702) → headline typed letter by letter with a text caret and selection handles (1702–1714) → body typed (1714–1728) → pills (about 1730) → "ON THE WAY" placeholders filled one by one (1745–1775) → logo (1790) |

The deliverable photos are photoreal and generated (waterfall with macaws, rope bridge, the orange arch, a lake at sunset, a fern forest, a visitor centre hut). The "Generating photos…" card is what explains them.

---

## 4. Look groups (look.py, 12 frames per segment; full table in `shots/look/table.md`)

| Group | Segments | p2 | p50 | p98 | <40 % | sat | R−B shadows | R−B highlights | grain | sharp |
|---|---|---|---|---|---|---|---|---|---|---|
| **A Jungle window (title plate)** | 0–63 (crop without title), 72–100 | 0.4 | 17–32 | 136–172 | 58–82 | 40–42 | +1.3…+1.9 | −9.6…+1.6 | 0.6–0.8 | 9–11 |
| **B Waterfall day** | 110–200, 205–347 | 10–12 | 44–60 | 178–229 | 37–47 | 40–48 | −0.1…−9.3 | −2…−7 | 0.7–0.9 | 11–15 |
| **C Canopy-filtered jungle (the base look)** | 348–381, 382–500, 545–660, 847–927, 2085–2174 | 0.4–12 | 18–36 | 148–207 | 52–79 | 33–58 | −4…−10 | +2…+29 | 0.4–0.9 | 12–21 |
| **D Fire-lit** | 506–535 | 13.2 | 63.8 | 243.0 | 33.0 | 55.7 | +5.8 | **+77.8** | 0.68 | 12.5 |
| **E Gorge / bridge overcast** | 1103–1184, 1234–1256 | 7–8 | 37–47 | 224–233 | 44–53 | 34–41 | −1…−8 | +15…+18 | 0.7–1.8 | 11–18 |
| **F Shallow-focus close-up, green bokeh** | 1198–1233, 1933–2050 | 4–7 | 48–51 | 145–223 | 42–43 | 46–48 | **−13…−25** | −36…+18 | 0.5–0.6 | 10–14 |
| **G Stone ruins, flat** | 1487–1522, 1523–1530, 1531–1650 | 0.7–22 | 41–64 | 122–142 | 21–50 | 25–43 | −4…−13 | +7…−23 | 0.4–0.9 | 11–13 |
| **H Temple, top-lit, desaturated** | 1800–1862, 1868–1904 | 9–12 | 55 → 35 | 198–204 | 37 → 57 | **27–29** | −2…−3 | +16…+29 | 0.7–0.8 | 12–15 |
| **I End card** | 2176–2295 | 0.0 | 10.4 | 59.7 | 97.0 | 35.8 | 0.0 | +6.8 | 0.62 | 13.7 |

**Notes on groups C and F:**
- **Crop measurements:** shot 4 cropped to the face side (620,0,460,608) reads sharpness 1.7 and R−B highlights −59.7. The 27a background crop reads sharpness 3.1. The backgrounds are strongly defocused: the depth of field is genuinely shallow, not a filter.
- **Hero colour:** cobalt jacket #134D8C (p90 #2D73B5); jungle mid-green #23523B; skin #7B4B3C.

**What all the footage shares:**
- low key (p50 18–50, half the frame below luma 40);
- true blacks (p2 0–12);
- highlights kept but not clipped (p98 140–230);
- rich but not neon saturation (40–58; 27–29 only in the temple);
- cool green-cyan shadows (R−B −4 to −25) with neutral-to-warm highlights;
- very low grain (0.4–1.0; 1.8 on the bridge white water).

**Each set piece has its own motivated light:** sky window, waterfall spray, sun shafts, fire, overcast gorge, flat ruins, top shaft/strike in the temple, soft shade.

---

## 5. Text inventory (in order of first appearance; first/last ±2 f; char counts include spaces)

| # | String | Chars | First | Last | Where |
|---|---|---|---|---|---|
| 1 | Higgsfield MCP (superscript MCP) | 14 | 0 | 68 | title |
| 2 | × Claude (asterisk logo) | 6 + mark | 2 | 68 | title |
| 3 | @HIGGSFIELD.AI (+ IG glyph) | 14 | 6 | 2295 | watermark, alternating corners; end card centre |
| 4 | OPUS 5.5 | 8 | 16 | 68 | title |
| 5 | for Motion Design | 17 | 28 | 68 | title pill |
| 6 | Spacebar | 8 | ~36 | 68 | title playback bar (decor) |
| 7 | Today 10:24 | 11 | 252 | 347 | message, shot 2 |
| 8 | Need a motion promo video. ASAP. | 32 | 255 | 347 | message, shot 2 |
| 9 | Client | 6 | 255 | 347 | message, shot 2 |
| 10 | What / is it / this / time? | 21 | 414 | 442 | floating, shot 4 |
| 11 | Objects? | 8 | 442 | 466 | floating |
| 12 | Shapes? | 7 | 474 | 496 | floating |
| 13 | VFX? | 4 | 500 | 516 | floating |
| 14 | time * 60 | 9 | 524 | 564 | pixel code |
| 15 | wiggle(2,10) | 12 | 524 | 564 | pixel code |
| 16 | Expression? | 11 | 530 | 548 | floating |
| 17 | Wait | 4 | 550 | 576 | floating |
| 18 | No | 2 | 556 | 580 | floating |
| 19 | Let me explain | 14 | 562 | 586 | floating |
| 20 | I need a promo. Fast. No mistake. | 33 | 588 | 660 | prompt bar 1 |
| 21 | Opus 5.5 | 8 | 588 | 1904 | every prompt bar (5×) |
| 22 | Promo brief received. | 21 | 663 | 697 | card |
| 23 | Starting with the reserve logo. | 31 | ~666 | 697 | card |
| 24 | AE UI: 50% · 00:00:00:00 · Full · Active Camera · 1 View · Properties · Align · Effects & Presets · Tracker · Audio · 0s…12s | — | 702 | 1799 | AE chrome (shots 6–8, 12–14, 18, 20, 24) |
| 25 | IVAYU_RESERVE_MAP_16x9 / _9x16 / _20x5 | 22 each | 776 | 806 (also 1045) | comp tabs |
| 26 | Line, Line 2, Main Logo, Main Title, Scene Controls, UI Controls, CC Layer, Generative Video, Music | 4–16 | 780 | 806 (again 1040–1060) | layer list |
| 27 | HI, I'M ARA! | 12 | 808 | 846 | generated bubble |
| 28 | Ask me about trails, tickets and secret spots. | 46 | 808 (typed to 835) | 846 | generated bubble |
| 29 | Create visual assets for Ivayu Reserve. | 39 | 881 | 927 | prompt bar 2 |
| 30 | Creating photos, pins, and badges... | 36 | 930 | 972 | card |
| 31 | Generating visuals for "Ivayu" Reserve. | 39 | ~940 | 972 | card (HF line) |
| 32 | Project · Effect Controls · Composition · Footage · Name · 01_REFERENCES · 02_ASSETS · Reserve_flyover.mp4 · Sun_Gate_hero.jpg · Jungle_ambience.wav · Trail_notes.txt · 03_PRECOMPS · 04_MASTER · IVAYU_R… · Snapping | — | 976 | 993 | project panel |
| 33 | Sticker-sheet labels and rules (SUN RAYS, PHOTO FRAME, PINS & SERVICES, ISLAND MAP, PLACES, VISITOR CENTER, SUN COINS, CREST FEATHERS, SPEECH BUBBLE, DEAL STICKER, -20%; one-line rules, partly legible) | — | 994 | 1102 | generated sheet |
| 34 | Make a map showing how to get to the reserve. | 45 | 1145 | 1192 | prompt bar 3 |
| 35 | The easy route! ("The easy" / "route!") | 15 | 1190 | 1218 | floating, shot 15 |
| 36 | Mapped. Five stops. One route. Walking times included. | 54 | 1259 | 1293 | card |
| 37 | RESERVE · IVAYU (logo), RESERVE MAP, IVAYU RESERVE | 7+5, 11, 13 | 1340 | 1361 (logo to 1799) | island map |
| 38 | Generating photos of the trail stops... | 39 | 1365 | 1398 | card (HF line) |
| 39 | SELF-GUIDED TRAIL · SUN GATE TRAIL · 2.4 KM · 45 MIN · +220 M · MODERATE · 5 STOPS | 17, 14, … | 1399 | 1486 | trail map header |
| 40 | Map place labels, segment chips, 6 photo-card titles + stat lines, ON THE TRAIL + 4 rules ("Stay on marked paths", "Don't feed the macaws", "Carry out your litter", "Rangers on duty 8:00–19:00") | — | 1399–1475 | 1486 | trail map |
| 41 | Create a visual of the reserve's landmark. | 42 | 1611 | 1650 | prompt bar 4 |
| 42 | 05 SUN GATE / 2.4 km · 45 min from the Visitor Center | 11 / 39 | 1680 | 1799 | poster pin label |
| 43 | LANDMARK · IVAYU RESERVE | 24 | 1700 | 1799 | poster eyebrow |
| 44 | THE SUN GATE | 12 | 1702 (typed with a caret, 1 char/f, complete at 1714) | 1799 | poster headline |
| 45 | The final stop of every trail. An orange arch crowned with the sun, glowing at golden hour. | 91 | 1714 (typed to about 1728) | 1799 | poster body |
| 46 | STOP 05 · 2.4 KM · SUNSET 18:40 | 7, 6, 12 | 1730 | 1799 | poster pills |
| 47 | ON THE WAY · 02 PARROT FALLS · 03 SUN BRIDGE · 04 MONOCLE LAKE | 10, 15, 13, 15 | 1745 | 1799 | poster row |
| 48 | Render the final and send it to the client! | 43 | 1840 | 1904 | prompt bar 5 |
| 49 | Ae · Ivayu Reserve Promo · After Effects · Download | 2, 19, 13, 8 | 1905 | 1932 | download card |
| 50 | Today 10:24 | 11 | 2005 | 2052 | message, shot 27 |
| 51 | Looks great! Next brief: a safety video for the reserve. | 56 | 2008 | 2052 | message, shot 27 |
| 52 | Client | 6 | 2008 | 2052 | message, shot 27 |
| 53 | TRY HIGGSFIELD MCP FOR MOTION DESIGN IN AFTER EFFECTS WITH CLAUDE OPUS 5.5 | 74 | 2081 | 2295 (dimmed from 2175) | CTA |

**Copy pattern for the rebuild:**
- **Prompts:** imperative, 33–45 chars, ending with "." or "!".
- **Status cards:** 21–54 chars, with "…" while working and "." when done.
- **Client messages:** 32 and 56 chars, two lines.
- **Floating "inner voice":** 2–14 chars per word, questions.
- **CTA:** one 74-char uppercase line.

---

## 6. What makes it feel premium (measured)

1. **One hero, one colour, 13 plates.** The same face, hair and wardrobe in every live-action plate. The cobalt jacket (#134D8C, 5–11 % of the frame) is the only saturated blue in a world of #23523B greens. The UI accent orange (send button #DB745B, asterisk #CD745B, rim glow) is its complement, so the overlays always pop off the footage.
2. **Low-key grade with real blacks.** Footage p50 sits at 18–50 of 255 and 42–79 % of pixels are below luma 40, yet p98 holds 140–243. Blacks are true (p2 0–12, except the arrow macro). No lifted, milky shadows. Shadows lean cool (R−B −4 to −25) and highlights neutral or warm.
3. **Motivated light changes inside shots.** The fire relight takes R−B in the highlights from +12.5 (n500) to +52.9 (n502), peaks at +93.9 (n530) and is back to +27.8 by n540; p50 rises from 33 to 76 (n520). Per-frame look stats at 960 px. The temple light drop takes p50 from 55 to 35 in one shot. Waterfall spray and god-rays: each set piece has its own light source, giving 8 looks across 13 plates.
4. **The camera never stops on live action.** Every plate has a move: drone dive (2), tilt-up + push (4), parallel tracking (9, 16), crash-zoom (15), push-in (23, 25), pull-back (27). Static frames exist only in the white cards' ground and the frozen end card.
5. **Real optics.** Background sharpness on close-ups measures 1.7–3.1, against 10–21 for full frames. The depth of field is genuinely shallow, so the overlays read crisply in front of soft plates.
6. **24p motion.** The master was cut at 24 fps (a repeat frame on n ≡ 0/4 mod 5 throughout), which gives the film's cadence.
7. **A small, rigorously reused overlay kit.**
   - one prompt-bar component ×5 (about 470×120 px, dark glass, peach rim, "Opus 5.5", orange send);
   - one white-card template ×4 + the download card;
   - one message bubble ×2 (bookends);
   - one floating-word style;
   - one pixel mascot.
   UI type is one neo-grotesk throughout. The title adds one serif ("OPUS 5.5") and one pill.
8. **Two signature transitions bind the film.** Every send ends in the same orange pixel dissolve from the send button (6–12 f) straight into a cut. Every generated asset arrives via the same yellow pixel-burst ring. The pixel language matches the pixel cat.
9. **The semantics are honest.** The asterisk lines are Claude talking (plans, status). The yellow-green tile lines are the Higgsfield MCP generating ("Generating visuals…", "Generating photos…"). The viewer learns who does what without a voice-over.
10. **The deliverables are fully designed and specific.** A named brand (Ivayu Reserve), a named mascot (Ara), 5 named stops with distances and walking times, rules, chips and a poster with a 91-char body: more than 40 legible strings in the generated assets, one palette of about 12 colours and 3 type roles. Nothing is lorem ipsum.
11. **Rhythm.** Live-action holds 2.7–9.4 s; cards 0.9–1.5 s; the arrow 0.3 s. The product works on screen every 8.5–15.3 s (5 sends). The first prompt is typed slowly in three beats (62 f); later prompts snap in at about 3 chars/frame.
12. **A quiet ending.** The CTA is a single 13 px-cap line (74 chars), not a slam. The end card simply dims the last frame to 23.7 % and centres one 138 px icon + handle.

### The 5 things a recreation must get right
1. **One consistent hero across every generated plate:** identity and wardrobe (a saturated jacket against a complementary world). Lock this in the FLUX key frames before MiniMax.
2. **The low-key, cool-shadow grade with true blacks and per-scene motivated light:** target p2 ≤ 12, p50 20–50, <40-luma 45–75 %, sat 40–58, R−B shadows −4…−25, plus at least one in-shot light event (fire, strike).
3. **The prompt → send → pixel dissolve → status card → AE result loop, repeated 5× with escalating stakes**, each send landing on a cut, every 8–15 s.
4. **A single reused overlay kit placed in negative space:** a dark-glass prompt bar about 470×120 px [836×213] with a model label and a warm accent; a white #F3F0F5 card with an agent glyph vs a tool glyph; a bubble with a timestamp and sender, used as bookends.
5. **Generated deliverables that are fully designed, inside a believable AE UI:** a coherent brand world built with one reveal effect, named layers, a tidy project bin and keyframes. Plus 24p cadence and constant camera motion on the live action.

---

## Files
- `shots/sheet-01.png … sheet-28.png`: per-shot contact sheets (breakdown numbering).
- `shots/check/`: dense strips, crops and 50 px grids used for positions and text timing (`r-*`, `d-*`, `t-*`, `c-*`, `grid-*`, `k-live*`).
- `shots/look/*.json|txt`, `shots/look/table.md`: look.py results per segment.
- `shots/diff.json` (per-frame diff/luma/sat) and `shots/wm.json` (watermark corner scan).
- `shots/tools/`: `diffscan.py`, `sheet.py`, `crops.py`, `palette.py`, `maskcol.py`, `grid.py`, `wmscan.py`.
