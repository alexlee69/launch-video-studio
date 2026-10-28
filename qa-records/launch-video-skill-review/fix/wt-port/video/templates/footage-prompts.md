# Footage prompts — key frame, motion, checklist, worked examples

The recipe in `FOOTAGE.md`, in words: a **photo key frame** (FLUX 1.1 Pro Ultra, `raw: true`) written like a
cinematographer's brief, then **image-to-video** (MiniMax H3) with a motion brief that keeps the first frame's look.
Write both fresh for every shot, in plain sentences, most important first. Never describe the reference's frames,
characters, logos or copy — only the kind of shot it is.

## 1. The key-frame brief (`gen.mjs still`)

Build it in this order (each part is one or two sentences):

| Part | Write | Example (plate 1, the kitchen) |
|---|---|---|
| Medium + framing | what kind of picture, how wide, from where | "Candid 35mm film still, wide shot from across a long kitchen table" |
| Time + place, lived in | when, where, how used it looks | "early morning in a small lived-in apartment kitchen before the lights are fully on" |
| The person | age, hair, small accessories, wardrobe with colour + pattern + material, the action | "a woman in her late twenties with dark hair in a loose low bun and small gold earrings, wearing a cream and navy Breton-striped long-sleeve top, … typing on a silver laptop" |
| Props | foreground (out of focus) and background, specific and slightly messy | "a plate with a half-eaten slice of toast, a folded newspaper, a phone charging cable, a set of keys … mismatched jars, a kettle, dishes drying in a rack" |
| Light | motivated sources, mixed temperatures, low key | "Cool blue-grey daylight from a window on the left, warm light from an under-cabinet strip and a small lamp …, deep soft shadows, most of the room falling into shadow" |
| Lens + camera | focal length, height, depth of field, handheld | "28mm lens at seated eye level, shallow depth of field, slightly tilted handheld framing" |
| Texture tail | always the same | "natural skin texture, visible film grain, slightly soft focus, unretouched, realistic, not a stock photo, no text, no logos, no watermark" |

Devices: **unbranded** ("an unbranded silver laptop", "a plain black phone") — FLUX draws an Apple logo on any
laptop otherwise. A phone whose screen gets the app later (`pin.py`): "the screen completely black and switched off",
facing the camera, and "only this one phone is visible in the frame" (asking for "a second phone" drew two).
Aspect = the shot's: `--aspect 16:9` for plates, `9:16` for vertical cards. Two stills per shot (`--n 2`) to pick from.

## 2. The motion brief (`gen.mjs video --image`)

Four to six sentences, in this order:

1. **Camera**: "Handheld camera, slightly unsteady and organic, like a documentary operator." (cards: "Natural
   handheld selfie video." / "Slight handheld sway")
2. **Move over the shot**: "Over the shot the camera pushes in from this wide view across the kitchen table toward her,
   ending on a close-up of her hands typing on the laptop keyboard beside the red mug."
3. **Performance, beat by beat**: "She types quickly, pauses for a beat, presses one key firmly with her right index
   finger, then reaches for the mug with her left hand and lifts it toward her lips." — 2–4 concrete actions in order;
   the clip comes back 3–10 % longer than asked at 24 fps (6 s → 6.58 s, 5 s → 5.17 s), so pick where the shot starts with
   `conform.py --start`.
4. "Real-time, natural, candid motion."
5. "Keep the lighting, colours, depth of field and film grain of the first frame."
6. "No text, no captions, no logos." (phones to pin: "…the screen stays completely black the whole time.")

## 3. Reference-to-video (`gen.mjs video --guide`) — timing only

When a shot's timing must follow a guide clip (our animated draft, ≤ 15 s): "Video 1 is an animated storyboard for
this shot. Recreate it as photorealistic live-action footage that follows Video 1 closely: the same composition, the
same continuous camera push-in …, and the same timing and action." + the person, set and light as in a key-frame brief
+ "No text, no captions, no logos, no on-screen interface, not animated, not illustrated, not cartoon." It copies the
draft's flat light and drawn details literally (an illustrated skyline, a stray drawn finger): measured p50 127 and 9 %
deep shadow against the reference's 63–80 and ~30 % — "looks so fake". Prefer a key frame + `--image`.

## 4. Checklist against the fake look (before showing the estimate)

- [ ] The look comes from a photo key frame, not the vector draft.
- [ ] Light is motivated and mixed (a window + a practical lamp or strip), low key: most of the room in shadow.
- [ ] The set is lived in: clutter in the foreground, mismatched things behind, nothing staged or symmetrical.
- [ ] A real lens close to the subject (28–35 mm, shallow depth of field), handheld framing.
- [ ] Wardrobe and props are specific (colour + pattern + material), not "a woman in a shirt".
- [ ] A performance: concrete actions in order, sized to the shot (5–6 s).
- [ ] The texture tail is there ("visible film grain … not a stock photo").
- [ ] Devices unbranded; screens black where the app gets pinned; one phone.
- [ ] No text, captions, logos, watermarks, brand characters, or anything lifted from the reference.
- [ ] The still's aspect is the shot's; the seed is noted (it is in the `.fal.json`) for a re-roll.

## 5. Worked examples — the Cue film, 2026-10-22

All from `~/Downloads/launch-videos/hf02-full/out/fal/` (each `*.input.json` + `.fal.json` log). Grades and numbers:
`FOOTAGE.md`.

**Plate 1 — kitchen, low key** (`v2/plate1-key`, `v2/plate1-i2v`). Key frame, 16:9, `--seed 4127`, 2 stills ($0.12):

> Candid 35mm film still, wide shot from across a long kitchen table, early morning in a small lived-in apartment
> kitchen before the lights are fully on. A woman in her late twenties with dark hair in a loose low bun and small gold
> earrings, wearing a cream and navy Breton-striped long-sleeve top, sits at the far side of the worn oak table typing
> on a silver laptop, a red ceramic mug of coffee steaming beside her. Cool blue-grey daylight from a window on the
> left, warm light from an under-cabinet strip and a small lamp on the counter behind her, deep soft shadows, most of
> the room falling into shadow. On the table in the foreground, out of focus: a plate with a half-eaten slice of toast,
> a folded newspaper, a phone charging cable, a set of keys. Behind her: open shelves with mismatched jars, a kettle,
> dishes drying in a rack, a plant on the windowsill. 28mm lens at seated eye level, shallow depth of field, slightly
> tilted handheld framing, natural skin texture, visible film grain, slightly soft focus, unretouched, realistic, not a
> stock photo, no text.

The prompt said "a silver laptop", so FLUX drew a MacBook with its Apple logo: the logo was filled out of still 1 before
the video (a harmonic fill over an ellipse with the lid's grain added back, `plate1-key_1-clean.jpg`) — say "an
unbranded silver laptop" instead. Motion, 6 s, `--seed 5309` ($0.96):

> Handheld camera, slightly unsteady and organic, like a documentary operator. Over the shot the camera pushes in from
> this wide view across the kitchen table toward her, ending on a close-up of her hands typing on the laptop keyboard
> beside the red mug. She types quickly, pauses for a beat, presses one key firmly with her right index finger, then
> reaches for the mug with her left hand and lifts it toward her lips. Real-time, natural, candid motion. Keep the
> lighting, colours, depth of field and film grain of the first frame. No text, no captions, no logos.

```bash
cd DIR                     # the job folder (FOOTAGE.md): every path here is relative to it; dry runs first, --go after the yes
node $V/footage/gen.mjs still --prompt @plate1-key.txt --out out/fal/plate1-key --aspect 16:9 --seed 4127
node $V/footage/gen.mjs video --image out/fal/plate1-key_1-clean.jpg --prompt @plate1-motion.txt --out out/fal/plate1-i2v.mp4 --sec 6 --seed 5309
```

**Plate 2 — on a bus, golden hour** (`v3/plate2-key`, `v3/plate2-i2v`; 16:9, seeds 7762 / 6584, 5 s):

> Candid 35mm film still inside a city bus in late-afternoon light. A woman in her twenties with dark curly hair and
> small white wireless earbuds, wearing a sage-green hooded jacket over a white tee, sits by the window holding her
> phone in both hands at chest height, reading it with a small smile; the phone screen faces her, away from the camera.
> Low golden sun through the bus windows flaring across her face, the city blurring past outside, a yellow handrail
> pole in the right foreground, scuffed seat backs, other passengers soft and out of focus. 35mm lens at seat height,
> shallow depth of field, natural skin texture, visible film grain, slightly soft, unretouched, realistic, not a stock
> photo, no text, no logos, no watermark.

> Handheld camera slowly pushes in toward her as she reads her phone and breaks into a wide smile; the bus sways gently
> and sunlight flickers through the windows as the city slides past outside. Real-time, natural, candid motion. Keep the
> lighting, colours, depth of field and film grain of the first frame. No text, no captions, no logos.

**Carousel card — selfie with a black phone to pin** (`v3/car0-key`, `v3/car0-i2v`; 9:16, seeds 7510 / 6358, 5 s).
Six cards, one sentence of person + place each, the rest identical:

> Vertical selfie-style video still from a phone front camera held at arm's length, slight wide-angle distortion,
> handheld. A young man with dark curly hair and over-ear headphones around his neck, mustard-yellow sweatshirt, in a
> city park on a bright morning, trees and a path behind him, talking to the camera mid-sentence. With the other hand
> they hold a second phone up toward the camera, screen facing the camera, the screen completely black and switched
> off. natural skin texture, visible film grain, slightly soft, unretouched, realistic, not a stock photo, no text, no
> logos, no watermark.

The others swapped only the middle sentence: "A young woman with red hair in a loose braid, purple knit sweater, in a
small home kitchen with morning window light" · "A young Black man in a backwards cap and white earbuds, bright orange
running top, at an outdoor running track at golden hour, slightly out of breath, grinning at the camera" · "A young man
in a knit beanie and a striped scarf, green parka, on a train platform on an overcast morning, a train blurred behind
him" · "An older woman with short silver-blonde hair and round glasses, navy cardigan, at a window table in a busy café,
a coffee cup beside her". One card drew two phones; its re-roll (`v3/car3-key2`, seed 7391) said "With her free hand
she holds up one phone toward the camera, … only this one phone is visible in the frame."

Motion, shared by all six:

> Natural handheld selfie video. They talk to the camera with natural expressions and blinks, holding the phone up
> steadily toward the lens with the screen facing the camera; the screen stays completely black the whole time. Slight
> handheld sway, real-time, candid. Keep the lighting, colours, depth of field and film grain of the first frame. No
> text, no captions, no logos.

**What not to do for the look** (`plate1-h3max`, reference-to-video from the vector draft, 6 s, seed 2117): the guide
prompt in §3 with "a bright, sunny apartment kitchen … warm morning sunlight, soft natural shadows" — it followed the
draft's composition and timing closely but came out flat and staged (p50 127, 9 % deep shadow, saturation 30,
sharpness 10). The photo key frame + image-to-video above replaced it.
