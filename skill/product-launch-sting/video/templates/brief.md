# Launch video brief — Steady

Fill this in (or answer in chat and Claude fills it). Every line changes what gets made; "not sure" is a fine answer.

## 1. The video
- **Product, in one line:** what it does, for whom.
- **Goal:** launch / new feature / teaser / UI clips for my own edit.
- **The one thing a viewer should remember:**
- **Call to action:** download / waitlist / try it / none.
- **Where it runs:** X, LinkedIn, App Store, TikTok/Reels/Shorts, a keynote, a website hero → sets the aspect ratios (16:9, 9:16, 1:1).
- **Length:** 6 / 15 / 20 / 30 / 60 s. Rule of thumb: one idea per 2–4 s.
- **Pacing targets:** a surprise by 2 s, the product by 3 s, the brand by 5 s, and something new on screen about
  every 0.5 s (a word lands, a card moves, a cut). The 15 s and 30 s starters (`templates/launch15.yaml`,
  `launch30.yaml`) are built to these.
- **Deadline:**
- **Your input:** a few sentences / a brief or script / a rough storyboard / let's write it together (any is fine; your words are kept as you wrote them).
- **Product features to show:** from the product's own page; each one gets a moment in the film.
- **The hook:** the most striking image to open on (a reference photo is fine).
- **The arc:** launch / SaaS / journey / life moments (`SHOTS.md` → Story and edit rules).
- **AI footage model:** H3 (sharp, silent) or Seedance 2.5 (people talk, lip-synced, 720p): asked every time.

## 2. Words
- **Must say:** (claims, features, names — exactly as legal/brand allows)
- **Must not say:**
- **Tone:** playful / confident / calm / technical.

## 3. References (2–3)
For each: link + **what to borrow** (pacing, type scale, transitions, colour, sound) — not "make it like this".
Visuals, characters, copy and music are always built original; references only inform style.

## 4. Assets you have
- Logo (SVG best; PNG ≥ 512 px with transparency):
- Brand colours (hex) and fonts (files or names):
- Product UI: Figma link or high-res screenshots (phone 1170×2532, desktop 2560×1600 or similar):
- Characters / illustrations (SVG or layered files):
- Footage (live action, screen recordings):
- Music: let Claude compose (playful / keynote / calm) or your licensed track (file + where to start):
- Voiceover: none / we'll record (script + file) / captions only.

## 5. Deliverables
- Full film(s): which aspects?
- Cutdowns: e.g. 6 s, 15 s.
- UI clips for your own edit: which moments, transparent (ProRes 4444) or on background, frame rate of your edit (24/25/30/60).

## 6. Passport (one value per row, settled before the first frame is drawn)
The film's fixed choices. Every shot follows them, so changing a row later means checking every shot again.

| Row | Value (one each) |
|---|---|
| **Register** | a dark or a light world, and where it switches (e.g. dark footage until the click, light UI after) |
| **Accent colour** | one hex and the one thing it means (e.g. #5747F2 = "the product is working"); nothing else wears it |
| **Display type** | one face and weight for every headline |
| **Type scale** | headline / label / caption, as % of the frame height (e.g. 14 / 4 / 3.5) |
| **Margins and axis** | the safe margin, and the line the layout hangs on (the centre, the left third …) |
| **Transitions** | at most two kinds, plus one signature move kept for the key cut (the starters: hard cuts and drifts, a flood out of the pressed button, a carry, and a zoom-through as the signature) |
| **Camera verb** | the one way the camera moves in this film (push in, drift, orbit …) |
| **Hero motif** | the shape or object seen in at least 60 % of the beats |
| **Travelling object** | the one thing that crosses the cuts (a cursor, a card, a ring of light) |
| **Light model** | where the light comes from and its colour temperature, in every shot |
| **Sound** | the music's character, and the family of effects (clicks, pops, whooshes) |
| **Bookend** | how the film opens and how it closes (often one image, changed by what happened) |

## 7. Trigger map (one row per cut)
Every cut has a cause the viewer can see in shot A; shot B starts with its effect, and the camera follows it across.
A row becomes shot A's `cause:` in beats.yaml (the shot whose `out:` makes the cut); the storyboard prints it under
the frame, and `--grid` names the moving cuts that have none.

| Cut | Cause in shot A | Effect in shot B | How the camera follows |
|---|---|---|---|
| e.g. click → result | the cursor presses Generate | the result card grows out of the button | pushes in on the button, then rides with the card |
| | | | |
