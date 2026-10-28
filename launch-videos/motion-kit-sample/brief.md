# Launch video brief — Wayfinch (the motion-kit sample)

Wayfinch is **fictional**: a sample product made up to show the video skill's motion kit and its transitions that cross
the cut. Every picture is drawn by `tools/make_art.py` from shapes and gradients: no footage, no generated images, no
real brand or place, nothing paid. Brief filled 2026-10-27 by Claude (sample agent); there was no client to ask, so
every "ask the user" line was decided and is marked as such.

## 1. The video
- **Product, in one line:** an AI trip planner — write the trip in one sentence, get whole trips back, mapped and booked.
- **Goal:** launch (and the skill's showcase: every motion-kit block and every cross-cut transition in one film).
- **The one thing a viewer should remember:** one sentence in, the whole trip out.
- **Call to action:** try it — "Your turn." with "Plan my trip" typed and sent, then the address on the end card.
- **Where it runs:** a website hero and X / LinkedIn (16:9), Reels / TikTok / Shorts (9:16), feed posts (1:1).
- **Length:** 28 s (56 beats at 120 BPM), 11 shots, one idea per 1.5–3.5 s.
- **Pacing targets:** a surprise by 2 s (the globe of dots is moving on frame 0 and the camera falls into it at 1.5 s),
  the product by 3 s (the prompt bar at 3.0 s), the brand by 5 s (the name at 1.5 s, the mark on the end card), and
  something new about every 0.5 s (dots, a dive, a cursor, a flood, cards dealing, pins dropping, planes separating,
  tiles cascading, a carry, word beats, a press, a morph).
- **Deadline:** none (sample).
- **Your input:** decided by Claude (sample).
- **Product features to show:** the one-sentence ask (press) → five trips (fan) → the route, day by day (map) → stays,
  trains, tables, tickets booked (stack, exploded) → hidden spots (wall grid) → a day at the spot (float) → the call to
  action (the composer → morph).
- **The hook:** a swirl of glowing coral dots that pulls together into a turning globe in the first half second.
- **The arc:** launch (ask → result → proof of depth → call to action).
- **AI footage model:** none — no footage in this film (decided: placeholder / in-engine visuals only).

## 2. Words
- **Must say:** Wayfinch · Plan 4 days by the sea · One ask. Five trips. · Four days, mapped. · All booked. ·
  Hidden spots, found. · Pick. Pack. Go. · Your turn. · Plan my trip · wayfinch.app
- **Must not say:** numbers we can't source (no "10× faster", no user counts), any real brand or place name.
- **Tone:** confident and warm; short lines, full stops.

## 3. References (2–3)
- **The four launch reels measured in `qa/video-skill-learnings/reels/`** — borrow the pacing (moves ~0.4 s, cuts on
  motion, nothing still for 0.5 s), the press shot close, the fan of results, the lit tile in a mosaic, word beats.
  Nothing of their look (no lime, no mascots, no fonts, no frames).
- **The skill's own `launch30` starter** — borrow the arc (hook → name → ask → result → proof → CTA → end) and the
  flood out of the pressed button.

## 4. Assets you have
- Logo: `assets/logo.svg` — a coral tile with a white route writing a W, ending on a destination dot.
- Brand colours: bg #F5F2EC (warm paper) · ink #15161B · muted #5F5B66 · accent #E8452C (coral) · accent2 #FFC24B
  (amber: the float's tag) · accent3 #2BB3A8 (sea teal) · dark #0B1020 (night navy) · line #D3CCC0. Fonts: the
  engine's Inter (sans) and the system Didot / Bodoni (serif); no font files.
- Product UI: the engine's own press / map / stack drawings (no screenshots).
- Illustrations: `assets/*.svg` — cove (the hidden spot), cove-wide (its panorama), night-wide (the night sea), cliffs,
  islands, old town, market, beach, lake, table. All cover-crop (`preserveAspectRatio="xMidYMid slice"`).
- Footage: none. Music: composed (keynote, 120 BPM). Voiceover: none, captions SRT only.

## 5. Deliverables
- Full film: 16:9, 9:16, 1:1 (`wayfinch-<aspect>.mp4`), master WAV, captions SRT, thumbnails.
- Cutdowns: none. UI clips: none (`--clips` / `--layers` work on any shot if wanted).
- A review sheet (`--sheet --aspect 16x9`) with the frames either side of every cut.

## 6. Passport (one value per row, settled before the first frame is drawn)
The film's fixed choices. Every shot follows them, so changing a row later means checking every shot again.

| Row | Value (one each) |
|---|---|
| **Register** | two worlds: night (navy #0B1020 and a starry night sea: the globe, the name, the trips, the spots, the postcard, the end card) and day (warm paper #F5F2EC: the product's UI — the ask, the map, the booking, the composer). Every send switches world: the first floods into night, the last morphs into night. One golden exception, earned: the dive into the postcard lands in the sunset cove for the word beats |
| **Accent colour** | coral #E8452C = "where you're going": the send button, the route and its pins, the lit tile's stroke, the button, the mark; the dots of the globe wear its night tint. Nothing else is coral |
| **Display type** | Inter bold for every statement; the serif (Didot, italic in the word beats) only for the name and every second word beat |
| **Type scale** | measured on 16:9 (audit px / % of the frame height): statements 86–101 px (8.0–9.3 %), the prompt in the bar 68 px (6.3 %), the name 237 px (22 %), the word beats 369 px (34 %), labels 35 px (3.2 %: chips, pins, the tag), the address 31 px |
| **Margins and axis** | the engine's safe box (10 % sides / top, 20 % bottom on 9:16); hangs on the centre, except the map and the booking, which hang on the left third |
| **Transitions** | hard cuts and drifts; the signature is the **dive** (into the globe, into the hidden cove's postcard). Because this film is the kit's showcase it also shows a flood, a carry and a morph once each — `--grid` warns "3 transition types" and that is deliberate; a client film keeps two plus the signature |
| **Camera verb** | push in: the dives, the fan's push into its hero, the grid's push into the lit tile, a slow push in every hold |
| **Hero motif** | a coral point (a dot of the globe, the send button, a pin and the route's head, the lit tile's stroke, the composer's send, the mark) — in 45 of 56 beats |
| **Travelling object** | the chosen thing: the point that was pressed becomes the hero trip (from: cursor), the lit tile becomes the postcard (carry), the composer becomes the end card's night (morph) |
| **Light model** | flat, illustrated light: a low golden-hour sun in the pictures; a soft core glow behind dark shots; UI lit from above (soft shadows under every card) |
| **Sound** | keynote groove at 120 BPM: builds to the press, drops as the trips fan out (6 s), dips under the word beats; ticks and clicks on the presses, pops on cards, pins and labels, whooshes on the dives, the flood and the drifts |
| **Bookend** | opens on the whole world as a dark globe of coral dots; closes on one coral mark on the same night |

## 7. Trigger map (one row per cut)
Every cut has a cause the viewer can see in shot A; shot B starts with its effect, and the camera follows it across.

| Cut | Cause in shot A | Effect in shot B | How the camera follows |
|---|---|---|---|
| globe → name (dive, 1.5 s) | the globe turns towards us and the camera falls into it | a starry night sea (the globe's dots become stars); the name arrives at ×0.3, still flying forward | log-zoom into the globe's centre, the speed peaks on the cut and carries into the name |
| name → ask (cut, 3 s) | the name zooms through the camera | the prompt bar, the product, on paper white | the zoom-through peaks on the cut; hard cut night → day |
| ask → trips (flood, 6 s) | the cursor presses send | the night pours out of the send button; the hero trip grows out of the cursor's tip (from: cursor), the other trips deal out of it | leans in on the bar (push .07); the flood covers the frame on the cut, on the drop |
| trips → route (cut, 9 s) | the fan pushes into the hero trip (Cliffs) | that trip's plan: the map draws its route | the fan's push lands on the cut |
| route → booked (drift-left, 12.5 s) | the route runs on to the right | the booking planes arrive still travelling left | drift speeds into the cut and carries on |
| booked → spots (cut, 15.5 s) | the planes have separated and the labels landed | night: a mosaic of places cascades in | hard cut day → night |
| spots → day (carry, 17.5 s) | the lit tile lifts off the wall | it lands as the postcard of the cove, glowing against the night sea (Day 4: the map's last stop) | the tile travels on an arc, fastest on the cut |
| day → words (dive, 20 s) | the postcard settles and the camera falls into it | we are in the cove itself at sunset; "Pick." arrives at ×0.3, still flying forward | the signature again; the cove keeps pushing forward |
| words → go (cut, 23 s) | "Go." | "Your turn." over the composer | hard cut, the sunset → paper white |
| go → end (morph to: frame, 26 s) | "Plan my trip" is typed and Send is pressed | the composer grows into the whole frame in the end card's night; the mark lands on it | a drift up speeds into the cut while the box fills the frame |
