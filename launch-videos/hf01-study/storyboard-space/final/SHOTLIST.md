# The Lull: the astronaut film, final shot list

**FINAL storyboard v1.0 (astronaut; comedy base + the three judges' grafts), 2026-10-23, storyboard only, for Alex's review.** Nothing here was generated: no image, video, audio or network calls. Machine-readable twin: `shotlist.json`. Story: `STORY.md`. Copy check: `COPY.md`. Actor: `CAST.md`. Beat-by-beat against hf01: `VS-HF01.md`. Everything except CAST.md is written in `tools/final_data.py` and rebuilt with `/usr/bin/python3 -B tools/build.py` (add `--selftest` to prove the checks fail on planted errors), which validates it against hf01's verified cut list (`hf01-study/cuts/cuts.json`).

**Conventions.** Frames `nNNNN` are hf01's 0-based 30 fps frames; ours land on the same frames. Boxes are px on the 1080x608 reference with the 1920x1080 value in [brackets]. 'mf' = 24p master frame; 'cf' = content frame (1/24 s). Editor shots give a framing `(cx, cy, s)` of the one master editor window (kit), with hf01's camera on top. Each string has three frames: first visible, first legible, last.

**Logline.** Mid-spacewalk, an astronaut gets Marketing's email: the launch moved up, the film is due tonight. With five deadpan prompts from her wrist display she has Manus 2.0 recast every disaster that follows (a tether that runs out, a debris shower in a solar storm, an airlock that will not seal, a fireball re-entry) as a serene launch film for the station's new guest module, and it ships while she is in radio blackout. Then, bobbing on the ocean, she gets the next brief.

**Checks (build.py):** 27/27 shots on hf01's frames (n0-n2295, 2296 f); 5/5 prompts pressed on hf01's send frames; 52 on-screen strings, every one at <= 3 words per readable second, and every group read together too (densest: S06 n704-n775, 7 words over 2.4 s = 2.92 w/s); <= 1 blue word per card; 0 banned Manus strings; 0 runs of 3+ words shared with hf01 or Manus, and 0 shared 2-word runs with a content word; 0 agency or hf01-place names inside any generation prompt; every ad shot captured before the prompt that needs it; S04's glyph swaps on hf01's n447 / 473 / 503 / 523 / 566; S26's reply entering on hf01's n2004 and gone before the gull lands; one blue accent on the title; self-test PASS: clean data 0 failures; 18/18 planted errors caught (dense card (S10 tool line made 7 words): 2; rewrite of hf01's punchline in S26: 6; P2 pressed one frame late: 2; second blue word on S05: 2; banned Manus status string: 4; string outside its shot: 1; agency name on screen: 1; two short lines read together too fast (S16): 1; end line before the end card: 3; agency name inside a key-frame prompt (S01 1a): 1; hf01 place inside a motion prompt (S14 14A): 2; real station named in an ad prompt (A1): 1; ad shot captured after the prompt that needs it (A3): 1; S04 glyph swap off hf01's frame (n447 -> n449): 1; S26 reply still legible as the gull lands: 1; S26 reply enters before hf01's bar frame: 1; second blue accent on the title card: 1; 'Make a wish!' back in S14 (2-word run with hf01's P3): 2).

## Why it should be funny: hf01's engine, in space

| Engine part | hf01 | Ours |
|---|---|---|
| Heightened genre | Indiana Jones pastiche | Space-disaster film (the Gravity / Apollo 13 register), played straight by the camera, the grade and the danger. |
| Running joke: a desk job inside an action movie | he calmly opens a laptop while an arrow thunks above his head | every loop she gives a calm creative note about the disaster happening to her, and the film she is making recasts it as luxury: her drift becomes the serene opener, debris becomes shooting stars, the radiation alarm becomes mood lighting, the re-entry fire becomes the ending. One rule, set by P1 ('Make it calm.'), that the audience learns and then watches every disaster test. |
| A set piece in every loop, escalating | waterfall, monkeys on a rope bridge, the arrow, the temple boulder | an orbital sunrise blast -> her tether runs out and snaps taut -> a debris shower chases her along the truss over an aurora as a solar storm arrives -> trapped in an airlock that will not seal, radiation alarm, the wrench she lost this morning comes back an inch above her helmet -> re-entry fireball and radio blackout (the peak). |
| Playful self-talk | 'What is it this time? Objects? Shapes? VFX?', a shouted 'The easy route!' | zero-G floating words that literally drift and turn: 'Tonight?' 'From space?' 'Nose itches.' 'Sunrise. Again.' 'Deep breath.' 'Not that deep.'; a delighted shout under the debris: 'Wish fast!' |
| The deliverable is about her world | a promo for the very reserve he is crossing | the launch film for The Lull, the station's new guest module ('the quietest room in orbit'), cut from her own helmet-cam footage of the day going wrong. |
| A punchline ending; the loop starts again | 'Looks great! Next brief: a safety video for the reserve.' | splashdown: 'Booked solid.' then a follow-up, 'Undersea next?', while she sits on the capsule in the open sea. She looks down at the water. A gull lands as the music stops. |

## The film in one table

| Act | Frames (s) | hf01 | Ours |
|---|---|---|---|
| Title | n0-68 (0.00-2.30) | co-brand lockup over a dark jungle window, zoom-through | Manus lockup + '2.0' + three feature icons + our embroidered mission patch, over a dark module framing a round hatch onto Earth; zoom-through |
| Brief | n69-381 (2.30-12.73) | drone dive to a climber at a waterfall; 'Need a motion promo video. ASAP.' | free-flying camera out of the hatch, along the truss past her docked capsule, to an astronaut on a spacewalk; Marketing's email via her Automation: 'Launch moved up.' 'Film by tonight?'; the wrench leaves; the bag that will not drop; she rips open her wrist display |
| Problem | n382-587 (12.73-19.60) | pixel cat morphs, voiced questions, fire relight | type-only zero-G thoughts on a glyph that swaps on hf01's frames: 'Tonight?' 'From space?' 'Nose itches.' 'Sunrise. Again.' a countdown with a capsule, 'Deep breath.' 'Not that deep.'; an orbital sunrise blasts her |
| Loop 1 | n588-846 (19.60-28.23) | prompt 1 -> logo badge, layers, mascot bubble | P1 'Make it calm.' -> 'Keeping it calm.' -> The Lull's mark builds over her sunrise; the timeline with 'Alarms: muted'; the first super 'Breathe easy.' |
| Loop 2 | n847-1102 (28.23-36.77) | jungle run -> asset kit, project bin, sticker sheet, keyframes | she drifts off on her tether -> P2 'Open on this drift.' -> SNAP -> 'Drift first.' / 'Half speed…' -> the Spacewalk bin; Alchemy: 'No alarms.'; EARLY PAYOFF 1: the drift plays at half speed as a spa ad |
| Loop 3 | n1103-1486 (36.77-49.57) | rope bridge + monkeys -> map, photos, trail infographic | debris chases her along the truss over an aurora as a solar storm arrives -> P3 'Call it shooting stars.' + 'Wish fast!' -> 'Debris → stars.' -> EARLY PAYOFF 2: shooting stars under 'Wish slowly.'; whale song; the guest map ('Loose items leave.') |
| Loop 4 | n1487-1799 (49.57-60.00) | tumble, arrow -> the landmark poster | the storm drives her into an airlock that will not seal; radiation alarm; the wrench she lost comes back an inch above her helmet -> P4 'Red alarm? Mood lighting.' -> the hero frame: THE LULL, 'Mood lighting included.' |
| Loop 5 | n1800-1932 (60.00-64.43) | temple boulder + light strike -> render, Download card | THE PEAK: re-entry fireball, the signal falling bar by bar -> P5 'End on this glow. Ship it.' on the last bar -> loss of signal -> the file card, delivered while she is in blackout |
| Payoff | n1933-2174 (64.43-72.50) | client: 'Looks great! Next brief: a safety video…', pull-back, mascot, CTA | splashdown at golden hour: 'Booked solid.' then 'Undersea next?'; she looks down at the sea; pull back; the music stops, a gull lands; the quiet product line |
| End card | n2175-2295 (72.50-76.53) | dimmed frozen frame + IG handle, sting | endcard-wash: the last picture washed to #F7F7F7; Manus lockup; 'Out of office. / Out of range. / Still shipping.'; the sting 0.368 s after the cut |

## The five prompts (the plot)

Each one is pressed on hf01's send frame, reacts to that loop's set piece, and changes the film.

| # | Shot | Send | Prompt | Words | Readable | Attached | Where she is | What it changes | hf01's prompt in this slot |
|---|---|---|---|---|---|---|---|---|---|
| P1 | S04 | n652 (21.73 s) | **Lull launch film. 30s. Make it calm.** | 7 | 2.43 s (2.88 w/s) | helmet-cam thumbnail chip (her sunrise clip, recorded n502-540; no label) | floating at the guest module's hull after the sunrise blast, nose itching, the countdown running | Starts the job: the product (The Lull), the length, and the one creative rule every later disaster will test: calm. | I need a promo. Fast. No mistake. |
| P2 | S09 | n913 (30.43 s) | **Open on this drift.** | 4 | 1.57 s (2.55 w/s) | live helmet-cam thumbnail chip (the station receding behind her; no label) | drifting away from the hull, slowly turning, her tether paying out behind her; it snaps taut 0.13 s after the send (n917) | Re-orders the film: her drift becomes the serene opening shot at half speed (S10-S13); the sunrise moves to 0:05. | Create visual assets for Ivayu Reserve. |
| P3 | S14 | n1181 (39.37 s) | **Call it shooting stars.** | 4 | 1.57 s (2.55 w/s) | live helmet-cam thumbnail chip (the debris streaking over the aurora, as she records it; no label) | hauling herself hand over hand along the truss on the night side while a debris shower streaks past over an aurora | Recasts the debris as the film's 0:10 shot: her clip slowed to quarter speed and graded warm, so the streaks read as shooting stars (S16-S17). | Make a map showing how to get to the reserve. |
| P4 | S22 | n1641 (54.70 s) | **Red alarm? Mood lighting.** | 4 | 1.4 s (2.86 w/s) | - | curled against the inner hatch of an airlock that will not seal, the radiation alarm pulsing red, the wrench she lost this morning just clanged off the rim above her helmet | Sets the grade of the hero frame: Marketing's own interior photo of The Lull (in the project since S11) re-lit soft red, sold as a feature (S23). | Create a visual of the reserve's landmark. |
| P5 | S24 | n1895 (63.17 s) | **End on this glow. Ship it.** | 6 | 2.2 s (2.73 w/s) | live helmet-cam thumbnail chip (the plasma in the window, recorded n1800-1890; no label) | strapped into the capsule during re-entry, plasma glowing in the window, the signal at its last bar | Adds the last shot (her own clip of the glow, recorded before the send) and delivers. The signal drops to nothing 0.07 s later; the job finishes without her. | Render the final and send it to the client! |

**Early payoff.** Two beats before the film's midpoint, so the joke pays off on screen early. (1) S13 n1063-1086 (35.4-36.2 s): her drift plays in the viewer at half speed under 'Breathe easy.': the most alarming moment of her morning is now the calm opener. (2) S17 n1294-1361 (43.1-45.4 s): the debris she was ducking plays slowed and warm as shooting stars under 'Wish slowly.', the spa-ad version of what she shouted 4 s earlier ('Wish fast!'). hf01's playhead never moves; ours moves only in these two shots.

## Where the laughs land

| Shot | Frames | The joke |
|---|---|---|
| S01 | n256-347 | Her long deadpan stare at an email from Marketing, 400 km up; 'Launch moved up.' read by someone already up; the wrench simply leaves her glove and she does not look. |
| S02 | n348-363 | The pack drop in zero G: she lets go of the bag and it just stays there. The thud never comes. |
| S04 | n413-586 | Floating thoughts: 'Tonight?' 'From space?' 'Nose itches.' (the helmet glyph gets bonked) 'Sunrise. Again.' 'Deep breath.' 'Not that deep.' |
| S07 | n779-806 | 'Alarms: muted' in loop 1, before anything has gone wrong (second viewing). |
| S09 | n878-927 | Drifting off the station, she art-directs it ('Open on this drift.'); then the tether runs out and yanks her out of frame. |
| S10 | n928-972 | 'Drift first.': her near-miss, filed as shot one. |
| S13 | n1063-1086 | Her drift plays as a spa ad under 'Breathe easy.' |
| S14 | n1144-1225 | Under a debris shower in a solar storm: 'Call it shooting stars.' then a delighted 'Wish fast!' |
| S16-S17 | n1257-1361 | 'Debris → stars.' Then the debris plays slowed and warm as shooting stars under 'Wish slowly.' |
| S18 | n1362-1398 | 'Adding whale song…' to a space spa film. |
| S19 | n1452-1486 | 'Loose items leave.' in the film's own house rules, 2.6 s before one comes back. |
| S22 | n1531-1650 | The wrench she lost at 09:12 comes back around and clangs off the rim an inch above her helmet; she watches it go; 'Red alarm? Mood lighting.' |
| S23 | n1730-1799 | 'Mood lighting included.' sold in a red pill. |
| S24 | n1839-1895 | In a re-entry fireball, signal dying: 'End on this glow. Ship it.' The plush whale swings. |
| S25 | n1905-1932 | 'No signal' cuts straight to a blue check: shipped while she was unreachable. |
| S26 | n2005-2174 | 'Booked solid.' then 'Undersea next?' She looks down at the sea she is sitting on. Pull back: a lot of sea. The music stops; a gull lands. |
| S27 | n2187-2224 | 'Out of office. / Out of range. / Still shipping.' |

## The deliverable: The Lull, launch film, 30 s (for Arden Station's new guest module; for Marketing)

Sincere luxury-travel film. Every shot is one of her disasters, recast as calm: the irony is the joke. Every shot exists before Manus is asked for it (her helmet cam, or Marketing's own photo), so the film never needs footage that was not there yet. 16:9. Every piece appears in our editor's viewer across the loops.

| Time | Slot | Asset | Picture | Super | Sound | Made / shown in |
|---|---|---|---|---|---|---|
| 0:00-0:05 | DRIFT | A2 | Her helmet-cam POV drifting away from the station: the station slowly shrinking against the blue Earth, her tether paying out in the foreground; slowed to half speed. | Breathe easy. | A soft lullaby motif on felt piano. | P2 makes it the opener (S09); S10 'Half speed…'; plays in S13 (early payoff 1). |
| 0:05-0:10 | SUNRISE | A1 | Her helmet-cam POV of the sun bursting over Earth's limb, the station hull at the frame edge. | - | Whale song enters (Alchemy's pick, S18). | P1 attaches it (S04 chip); revealed S06; the opening super is typed over it in S08 (before P2 moves it to 0:05). |
| 0:10-0:15 | STARS | A3 | Her helmet-cam clip of the debris streaks over the aurora and the night side's city lights, slowed to quarter speed and graded warm: the streaks read as soft shooting stars. | Wish slowly. | A celesta sparkle on each streak. | P3 (S14); 'Debris → stars.' (S16); plays in S17 (early payoff 2). |
| 0:15-0:20 | GUEST MAP | A6 (designed) | Infographic: an isometric line drawing of the station with her route of the day, photo cards on its pins, a strip of 16 sunrises, a rules box. | ONE ORBIT · 90 MIN | Lullaby continues. | Builds in S19. |
| 0:20-0:26 | THE LULL | A4 | Inside The Lull: a soft lounge facing the big round window, Earth outside (Marketing's own photo, re-lit soft red by P4). | The quietest room in orbit. | Score swells. | In the project from the start (S11 bin, S12 tile in neutral light); P4 re-lights it red (S22); the end frame builds in S23. |
| 0:26-0:30 | GLOW | A5 | Re-entry plasma glowing orange-pink in a small round window (her helmet cam); the title THE LULL. | THE LULL | Resolve; one soft bell. | P5 (S24); the S25 file thumbnail. |

- **Palette:** night navy #0E1A2B, moon white #F4F1EA, soft gold #E8C27A, lull red #D9544D, earth blue #6FA8DC.
- **Type:** Name and titles: a light geometric sans in caps, tracked +200 (Jost Light class, OFL). Supers: the same family, Regular, sentence case, moon white with a soft shadow, lower left. Our UI stays Inter; the ad has its own face because it is the client's brand.
- **Mark:** The Lull mark: a thin moon-white crescent cradling a small circle (the module's round window) with three tiny star dots, on a night-navy disc; 'THE LULL' in tracked caps under it only in the S06 build and the S23 headline. Elsewhere a text-free corner bug. Not a Manus logo, not a character.

### Ad assets

| Id | Slot | Kind | sec | Seen in | Image prompt | Motion prompt |
|---|---|---|---|---|---|---|
| A1 | SUNRISE (0:05-0:10) | helmet-cam POV, still + image-to-video | 5 | S04 P1 chip thumbnail; S06 ring reveal; S08 super typed over it; S12 tile; S19 card; S23 thumb | Helmet-camera POV still, 16:9, ultra-wide about 16 mm: from just outside a white space-station module, the sun bursting over the thin blue curve of Earth's horizon, a starburst flare and a gold wash across the frame, the white insulated hull and one white handrail at the lower right edge, black space above. Crisp, slightly HDR highlights, faint curved reflection of a helmet bubble at the frame edge. No people, no flags, no insignia, no text, no logos, no watermark. | 5 s, helmet-camera POV held almost still with a slow weightless drift: the sun clears the horizon and the flare blooms, then settles to hard daylight. No text, no captions, no logos. |
| A2 | DRIFT (0:00-0:05) | helmet-cam POV, still + image-to-video (plays in S13) | 5 | S09 P2 live chip; S11 bin thumbnail (in use, blue outline); S12 dashed tile; S13 plays at half speed; S19 card; S23 thumb | Helmet-camera POV still, 16:9, ultra-wide about 16 mm: drifting away from a fictional white orbital station that floats in the middle distance, a long lattice truss and dark solar arrays, the bright blue-and-white Earth filling the lower half, an orange-sleeved safety tether running from the lens back toward the station in a long loose curve. Hard sunlight, black space. No people, no flags, no insignia, no text, no logos, no watermark. | 5 s, helmet-camera POV slowly turning and drifting backward: the station shrinks gently against the Earth, the tether pays out and curls in front of the lens. Weightless and slow. No text, no captions, no logos. |
| A3 | STARS (0:10-0:15) | helmet-cam clip, still + image-to-video (plays in S17, slowed and graded warm) | 5 | S14 P3 live chip; S17 plays with 'Wish slowly.'; S19 card; S23 thumb | Cinematic still, 16:9: Earth's night side from orbit, rippling green aurora curtains and amber city lights below, a thin blue airglow line on the horizon; a gentle shower of thin, soft, warm-white streaks crossing the black sky diagonally like shooting stars; the edge of a white station truss softly lit at the left. Wide, deep focus. No people, no flags, no insignia, no text, no logos, no watermark. | 5 s, locked-off: soft streaks cross the sky one after another, slow and graceful; the aurora ripples gently and the city lights below drift very slowly. No text, no captions, no logos. |
| A4 | THE LULL (0:20-0:26) | still (Marketing's interior photo; the red is a grade in comp, set by P4) | - | S11 bin thumbnail; S12 end-frame tile (neutral light); S23 hero photo re-lit red (ring reveal n1657-1676) | Interior architecture photograph, 16:9: inside a small luxury guest module in orbit, a curved soft white lounge and two floating cushions facing one large round window filled with the blue Earth; soft cool-white light from hidden strips; calm, spa-like, empty of people. 24 mm, deep focus, soft. No flags, no insignia, no screens with text, no text, no logos, no watermark. | - |
| A5 | GLOW (0:26-0:30) | helmet-cam still + code push (the S25 file thumbnail; S23 thumb) | - | S24 P5 live chip; S25 file-card thumbnail (never shown before it exists; the hero frame's thumbs are the three earlier shots) | Cinematic still, 16:9: a small round capsule window seen from inside, filled with glowing orange-pink plasma streaming past during re-entry, warm light spilling across grey padded panels, the rest of the cabin dark. 50 mm. No people, no text, no logos, no watermark. | - |
| A6 | GUEST MAP (0:15-0:20) | designed in code (no generation) | - | S19 | - | - |

## World

- **Setting:** One working day on a fictional, unbranded orbital station (working name Arden Station, never on screen): white modules in matte white and pale-gold insulation blankets, a long open lattice truss with white handrails, blue-black solar arrays, a small white re-entry capsule (one orange band) docked at a port, and the new guest module, The Lull: a soft, rounded white module with one large round window. Then that capsule's re-entry and the open ocean at golden hour. No real agency's or company's names, flags, logos or insignia; no hardware that copies a real station's signature parts (BANNED_WORLD below lists them for the build check; no generation prompt names them); our own text-free mission patch only.
- **Never:** hf01's world (jungle, waterfall, rope bridge, fire, ruins, arrow, temple, cave, stone sphere) and Manus's plates (waterfall, glacier canyon, salt flat, rock spires, dunes, dumpling shop, shophouse street). Listed here for people and for the build check only, never inside a generation prompt.
- **Astronaut:** Commander Wren Adair (fictional; her name is never on screen; CAST.md).
- **Sender:** Marketing (the station operator's ground marketing team; only the word 'Marketing' is ever shown).
- **Deliverable:** The Lull, a 30 s launch film for the station's new guest module (a product ad, F9), 16:9.
- **Clock:** Station time: the email at 09:12; the countdown T–09:48:00 runs to 19:00, Marketing's deadline and, as a capsule glyph beside it hints (S04), about when her capsule comes home; re-entry and blackout ~18:40 (S24); the reply at 19:47, on the sea (S26).
- **Escalation:**
  - S01-S04 loop 1: the email mid-spacewalk; the wrench drifts off her glove (she lets it go); the bag will not drop; an orbital sunrise blasts her visor.
  - S09 loop 2: she drifts off the hull with her tether paying out behind her; she art-directs it (P2); the tether runs out and snaps taut, yanking her out of frame. Tethered, so nobody is lost: comic peril.
  - S14-S15 loop 3: night side over an aurora, a solar storm arriving (sensor sparkle, the helmet caution lamp); a debris shower chases her hand over hand along the truss (P3: call it shooting stars; 'Wish fast!').
  - S20-S22 loop 4: the storm forces her inside; the airlock will not seal (her tether is caught in the outer hatch); the radiation alarm pulses red; the wrench she lost at 09:12 comes back around and clangs off the rim an inch above her helmet (P4: mood lighting). Trapped, irradiated, nearly hit: worse than loop 3.
  - S24 loop 5, the peak: re-entry; plasma fire in the window, the cabin shaking, the signal dropping bar by bar; P5 goes out on the last bar, then loss of signal. The job finishes without her (S25).
  - S26 the release: splashdown at golden hour; the reply and the next brief.

## Reading budget (every shot, computed)

Rule: at most 3 words per readable second, per string and per text moment (strings whose legible windows overlap are read together, so their words share one span, from the first legible frame to the last). Logos are not counted; greeked UI labels carry no words. The build fails above the rule.

| Shot | Words in shot | Text moments | Densest moment (strings read together) | Its words | Its seconds | Words/s |
|---|---|---|---|---|---|---|
| S01 | 10 | 2 | n252-n347: Automation · 09:12 + Launch moved up. + Marketing + Film by tonight? | 9 | 3.2 | 2.81 |
| S04 | 20 | 5 | n588-n660: Lull launch film. 30s. Make it calm. | 7 | 2.43 | 2.88 |
| S05 | 3 | 1 | n663-n697: Keeping it calm. | 3 | 1.17 | 2.57 |
| S06 | 7 | 1 | n704-n775: The Lull + Cloud Computer + Alchemy + THE LULL | 7 | 2.4 | 2.92 |
| S07 | 2 | 1 | n779-n806: Alarms: muted | 2 | 0.93 | 2.14 |
| S08 | 2 | 1 | n810-n846: Breathe easy. | 2 | 1.23 | 1.62 |
| S09 | 4 | 1 | n881-n927: Open on this drift. | 4 | 1.57 | 2.55 |
| S10 | 4 | 1 | n930-n972: Drift first. + Half speed… | 4 | 1.43 | 2.79 |
| S11 | 1 | 1 | n977-n993: Spacewalk | 1 | 0.57 | 1.76 |
| S12 | 3 | 1 | n998-n1034: Alchemy + No alarms. | 3 | 1.23 | 2.43 |
| S13 | 4 | 1 | n1040-n1102: Drift + Speed + Breathe easy. | 4 | 2.1 | 1.9 |
| S14 | 6 | 2 | n1144-n1190: Call it shooting stars. | 4 | 1.57 | 2.55 |
| S16 | 2 | 1 | n1260-n1293: Debris → stars. | 2 | 1.13 | 1.76 |
| S17 | 3 | 1 | n1296-n1361: Stars + Wish slowly. | 3 | 2.2 | 1.36 |
| S18 | 3 | 1 | n1367-n1398: Adding whale song… | 3 | 1.07 | 2.81 |
| S19 | 7 | 1 | n1401-n1486: ONE ORBIT + 90 MIN + Loose items leave. | 7 | 2.87 | 2.44 |
| S22 | 4 | 1 | n1609-n1650: Red alarm? Mood lighting. | 4 | 1.4 | 2.86 |
| S23 | 10 | 1 | n1696-n1799: THE LULL + The quietest room in orbit. + Mood lighting included. | 10 | 3.47 | 2.88 |
| S24 | 6 | 1 | n1839-n1904: End on this glow. Ship it. | 6 | 2.2 | 2.73 |
| S25 | 2 | 1 | n1907-n1932: The Lull | 2 | 0.87 | 2.31 |
| S26 | 14 | 2 | n2005-n2066: 19:47 + Booked solid. + Marketing + Undersea next? | 6 | 2.07 | 2.9 |
| S27 | 8 | 1 | n2190-n2295: Out of office. + Out of range. + Still shipping. | 8 | 3.53 | 2.26 |

Shots with no words on screen: S02, S03, S15, S20, S21.

## Content mix (frames; same slots as hf01)

| Kind | Frames | Seconds | % |
|---|---|---|---|
| live action (footage, with or without overlays) | 1407 | 46.9 | 61.3 |
| deliverable-in-viewer | 464 | 15.47 | 20.2 |
| white status screen | 184 | 6.13 | 8.0 |
| end card | 121 | 4.03 | 5.3 |
| editor screen | 120 | 4.0 | 5.2 |

## Our design kit (Manus look; our own designs)

- **Reuse:** Reused from the rejected ridge job (/Users/bytedance/Downloads/launch-videos/manus2-film): the job-local blocks blocks/editor.mjs (the one master editor window, framed per shot), blocks/status.mjs (status screens, file card), blocks/plate.mjs (prompt bar, bubbles, floating words, S04 glyphs over plates), blocks/endcard.mjs (the wash end card), tools/make_plates.py (labelled placeholder plates), tools/grid_check.py and tools/verify_storyboard.py, and the five brand files in assets/. Only the story, plates and copy change, plus the job-local block changes below (GUIDE.md 'Custom blocks'; the skill itself is not edited).
- **Block changes for this draft:**
  - plate.mjs prompt bar: row 2 shows the small Manus mark (manus-mark-dark.svg, 12 px [21] tall, never recoloured) where hf01 has 'Opus 5.5' and the ridge had the 'Manus 2.0' label: no words in the bar but the prompt.
  - plate.mjs glyphs: three new line icons in the existing ICONS style (white 5 px strokes, soft white halo): 'orbit' (a planet with a ring), 'helmet' (a round bubble with a visor line), 'capsule' (a gumdrop with one band). The S04 chain hard-swaps on hf01's own frames (n447 / 473 / 503 / 523 / 566), each with one ghost frame at 1.1-1.3x, never a morph; the helmet icon jolts 6 px at n476 (the bonk). 'signalAt' already takes [[frame, bars], ...] for S24.
  - plate.mjs bubble: two stacked one-line bubbles (the second arrives as a follow-up message) under one timestamp line and one sender label (S01, S26).
  - plate.mjs floating words: add a zero-G turn (each phrase rotates 2-4 degrees over its life, about its centre) on top of hf01's drift and rack-focus.
  - editor.mjs: no greek bars and no wireframe look. Layer rows and bin rows are poster-frame thumbnails and icon chips (a 'T' chip for type, the Lull mark chip, a wave glyph for audio); tabs and the title pill are icons; names are set in type only where the plot needs them (S06 project, chip, panel header; S07 'Alarms: muted'; S11 'Spacewalk'; S13 'Drift' / 'Speed'; S17 'Stars'). Planned rows are 1 px dashed with a small grey '?' glyph: the plan has holes, her day fills them. This keeps hf01's 'believable editor' and the 3 words/s rule together.
  - status.mjs: tool lines arrive pale grey #BDBDBD and settle to ink left to right, never a blue band (the ridge's S10 / S18 broke the one-blue-word rule). Under each in-progress tool line ('…') a wordless 2 px #2CB4F3 progress hairline grows but never completes on the card (S10, S18): an honest progress state with no words.
  - Grade layers in comp, not in the plate (light events the video model cannot place on a frame): S14 sensor sparkle (20 -> 120 single-pixel white hits per frame, never on her face) and the helmet caution lamp (amber, ~2 Hz); S20-S22 the red radiation-alarm pulse at ~1 Hz (highlights R-B to ~+60 on each pulse); S23 the soft red re-light of A4.
  - endcard.mjs: three lines instead of two.
  - tools/make_plates.py: still draws the ridge's fog and rocks; it needs the space looks R0-R6 before a storyboard render.
- **Reading rule:** Every string is timed from the frame it becomes legible (r) to its last frame (l). A string may carry at most 3.0 words per readable second, and so may every group of strings read together (strings whose legible windows overlap share one span, first r to last l). Every word on screen counts: labels, repeats and the sender too. Words are whitespace tokens; '·', '/', '→' and '…' are not words; a timecode or file name is one word; logos are not counted. build.py fails the build above 3.0.
- **Grade and cadence:** Animate and cut on a 24 fps master and map to 30 fps by index (out[n] = master[m(n)], m(n) = 12*(n//15) + r - [r>=5] - [r>=10] - [r>=14], r = n % 15), so every cut and judder step lands on hf01's frame (gaps/footage.md items 16-17: a build task; the skill renders 60 fps). Delivery 1920x1080.
- **Brand rules:** Off-white #F7F7F7 grounds with a faint 16 px dot grid; ink #1F1F1F (#1D2126 over bright plates, white with a soft dark halo over space); one sky-blue #33ABFB on at most one word per card, #2CB4F3 on line icons and the progress hairline; Inter for all UI and claims; serif only inside the Manus wordmark file; colour lives in the footage and in the ad, never in our UI. Logos only from manus2/brand/: manus-mark-dark.svg, manus-wordmark-dark.svg, the -white versions, manus-app-icon.svg (the plain .svg files render blank). The mark never rotates, morphs or acts as a character. No status card goes whole-line blue. The title card carries one blue accent only (the unread dot).
- **Watermark:** None. hf01's alternating IG bug is not part of our design.
- **Prompt bar:** Our bar, five times, at hf01's boxes and timings. A white frosted sheet (white 86 %, 20 px backdrop blur at 1080p; never darkens the plate), radius 20 [36], hairline rgba(255,255,255,0.6), soft shadow 0 8 24 rgba(0,0,0,0.12). Row 1: the prompt in Inter Regular ~21 px [38], ink; the newest 1-2 characters arrive #33ABFB and settle to ink within 2 cf (hf01's coral tail). Row 2: '+' (ink 60 %); an attachment chip when there is one (a 28 x 16 px [50 x 28] thumbnail, no label: P1 her sunrise clip; P2, P3 and P5 the live helmet-cam view; the colour comes from the footage); the small Manus mark; a 3-bar signal glyph (grey, 2 px bars: three bars P1-P2, two P3-P4, P5 falls to one and then none); a mic glyph; the send disc O34 [60] in ink with a white up-arrow. Entry: a horizontal streak to full size in 4 frames, then hf01's scale spring (omega 19.5, zeta 0.59, peak 1.09). Breathing rim, ~21 f period. Press: the disc flashes #33ABFB with a soft halo for 4 cf, peaking on hf01's send frame. Send sweep (our replacement for hf01's orange pixel burst): a soft sky-blue light band born at the button sweeps 232 px [412] left in 6 cf; the text dims to 40 % behind it; hard cut 8-13 f after the sweep starts (P3 collapses with the crash zoom instead).
- **Status screen:** Full frame #F7F7F7 + dot grid. Agent voice: the Manus mark (manus-mark-dark.svg) ~56 px [100] left of one line of Inter Medium ink, cap ~38 px [68]; the mark breathes 1.00-1.03 over ~24 f and never morphs. Tool voice: a 55 px [98] white rounded tile (radius 12 [21], hairline #E3E3E3) holding a 2 px #2CB4F3 line icon (film frame for the Video Editor; sound wave for Alchemy's sound pick), then one line that arrives pale grey #BDBDBD and settles to ink left to right, with the progress hairline under it. Motion = hf01's preset: y(t) = 81 e^(-t/0.150) - 89 e^((t-T)/0.150) + c, first frame ~85 px low with sigma_y ~10, soft left-to-right wipe 100-190 px/cf, a contrast shimmer while thinking, exit up at 17.5 px/mf. Manus's voice is honest and plain (what it is doing or what it did), never a joke about her danger: the comedy belongs to her prompts and to the film she directs. Every status line is 2-3 words: the cards are 1.0-1.4 s readable.
- **Bubble:** White sheet radius 14 [25], soft shadow 0 6 20 rgba(0,0,0,0.12); text Inter Regular ~21 px [38] ink; timestamp line centred ~20 px above the first bubble; sender label ~13 px [23] below the last bubble. Over black space and the warm sea the timestamp and label are white with a soft dark halo. hf01's motion: a blank bar with vertical blur, rise and grow over 13 cf (cubic-bezier(0.14, 0.86, 0.39, 0.97)), soft wipe ~7 chars/cf. Two stacked one-line bubbles, the second a follow-up message (our comic beat). S01's timestamp line names the Automation; S26's is the time only (an ordinary email notification). Never Manus's trigger -> action card pair.
- **Floating words:** Inter Medium ~40 px [72], sentence case, white with a soft dark halo over space (S04) and over the night-side MCU (S14). hf01's life: blurred and faint -> sharp over 5-6 f, sharp, out over ~5 f; one drifting layer per phrase (+7.85, -2.7 px/cf; S14 +10.2, -3.5); peaks on or next to hf01's frames (n423 / 452 / 482 / 510 / 537 / 568); plus our zero-G turn: each phrase rotates 2-4 degrees over its life, so the words visibly float. Lives are stretched past hf01's 9-11 f so every phrase reads for >= 0.8 s. Type only, no VO.
- **Reveal ring:** Our replacement for hf01's yellow pixel ring: a 2 px #33ABFB ring with a soft 10 px white glow; inside it the new shot is sharp, outside stays the placeholder; it grows at hf01's measured speeds (badge 14.3 px/f; cards 14-30 px per source frame) and fades over 3-5 f.
- **Editor:** ONE master editor window (the ridge's design; only the copy and the row art change): every hf01 After Effects screen is a virtual-camera framing (cx, cy, s) of one 1080x608 layout, with hf01's measured moves on top. Desktop #F7F7F7 + dot grid. Window x 20-1060, y 16-592: frameless white, radius 16 [28], 1 px #E6E6E6. Title bar y 16-44: project 'The Lull' from x 40; three aspect icons (no numbers) at x 470-610; run chip 'Cloud Computer' at x 930-1044 (pill #F2F2F2 with a #2CB4F3 cloud line icon) [check with Manus]. Left panel x 20-270 (Project: icon tabs, thumbnail rows), viewer x 276-804 on a #EEEEEE matte with the comp at x 286-794, y 51-337, transport row y 346-358 (play glyph and a thin scrub bar, no timecode text); right panel 'Alchemy' x 810-1060 (header in type; rows are small swatch, thumbnail and wave tiles, no words); timeline y 360-592: ruler ticks without numbers, layer list x 20-294 (a poster-frame thumbnail, a 'T' chip, the Lull mark chip or a wave glyph per row; names only where the plot needs them); rows from y 396, pitch 21; bars at their in/out times (made = flat #D9D9D5, planned = 1 px dashed #BDBDB8 with a grey '?' glyph, selected = 2 px #33ABFB outline); playhead a 1.5 px #33ABFB line (parked at 0 except S13 and S17); keyframe diamonds 11 px [20] ink outline on white. Cursor: black arrow, white outline, drift-hop-hold. Never Manus's editor (dark window, amber glow, status pill, Save / Export, Media / Text / Graphics tabs, filmstrips, green waveform) or their dark Alchemy UI.
- **End card:** endcard-wash (the ridge's design): hard cut on beat 105 (n2175); S26's last picture (plate only) freezes and washes toward the Manus ground in one frame: out = 0.24 x frame + 0.76 x #F7F7F7, the dot grid faint over it (hf01 dims to 0.237; Manus never darkens a plate, so we lighten). The Manus lockup with hf01's icon motion; the three-line end line built word by word; declared `hold:` for the freeze QA.
- **Score:** Style B (the ridge's decision table): bright F major on hf01's 87.01 BPM grid (first beat 0.1107 s), every sync point kept: unpulsed to n665; groove in on bar 8 at n665.3 (+144 ms after the S05 cut); break (low end out) n1402.5; bar 18 back n1492.8; drop 1 n1658.3 (+244 ms after n1651; 808 pickup ~80 ms before the cut); drums thin on bar 22 n1823.8; drop 2 n1906.6; groove stops on bar 25 n2072 (the gull lands on it); digital silence n2170-2186; sting n2186 (0.368 s after n2175). The vacuum rule, in order: space is silent, so S01-S22 carry only in-suit sound (breath, suit fans, radio chirps, contact sounds through the suit: the thud that never comes S02, the visor bonk S04, the tether twang S09, the wrench knock S22); the re-entry roar through the hull (S24) is the film's first loud real sound; the waves at splashdown (S26) are its first natural sound. No VO anywhere: type only.

## Looks per plate (grade targets; look.py categories)

- **R0 hatch window:** S01 n0-68: dark module interior silhouettes (handrails, cable bundles, stowage straps) framing an open round hatch filled with black space and Earth's curved blue limb. p2 <= 3, p50 25-45, 55-75 % below luma 40; the hatch is the only bright area.
- **R1 orbital day:** S01 after the title, S02-S03, S04 after n540: one hard sun, true black space (p2 0-3), Earth the big bright area (p98 ~230 on cloud tops, never clipped), the white suit's lit side held at p95 220-235 with deep shadow sides; sat 30-45 in Earth's blues; signal orange the only warm saturated colour; shadows neutral to cool (R-B -4...-12).
- **R1d orbital dawn:** S04 n382-501: Earth's limb a thin bright blue line, the station lit only by the limb glow, her wrist display and her helmet lamps. p50 20-35, 60-75 % below luma 40 (hf01's low-key base look C).
- **R1s sunrise blast:** S04 n502-535: the sun clears the limb behind her: a gold flare floods the frame and relights suit and helmet; highlights R-B +40...+70, p50 up ~30 levels; settles to R1 by n540 (hf01's fire relight). The composited flare disc (n503-522) rides on top, so the beat lands on hf01's frame whatever the take does.
- **R2 drift:** S09: R1 hard daylight, Earth filling the lower half, the station mid-grey behind her; she is the brightest object; the orange tether line the one warm stroke across the frame.
- **R3 night side + aurora:** S14-S15: Earth's night side with green aurora curtains rippling below and amber city lights; the station floodlights and her helmet lamps are the key; debris streaks are the hardest highlights; p50 15-30, true blacks; the MCU background a black-blue-green blur with glint bokeh; comp adds sensor sparkle and the amber caution lamp.
- **R4 airlock:** S20-S22: a cramped white cylinder under steady cool panel light in the plate (the video model is asked for the room only); the red radiation-alarm pulse is a comp grade at ~1 Hz (highlights R-B swing to ~+60 on each pulse); low saturation except the red and her orange; through the outer hatch, the sun's hard white glare.
- **R5 re-entry cabin:** S24: dim cabin; the round window's plasma glows orange-pink and flickers, building n1800-1880 while the cabin lights dim (p50 55 -> 35, hf01's temple light drop); her face warm from the window and cool from the wrist display.
- **R6 golden sea:** S26: low warm sun, gold highlights R-B +30...+45, cool blue shadows; the sea's sparkle the brightest area; her orange bands and the capsule's orange band the only saturated warm colours.
- **ad POV:** A1-A3, A5: helmet-cam POV: ultra-wide (~16 mm), crisp, slightly HDR, the faint curve of the helmet bubble at one edge: it reads as her camera next to Marketing's polished A4.
- **hero colour:** Signal orange on the suit (target #F26A1B, graded median ~#E8611E): arm and thigh bands and the helmet neck ring, 3-8 % of the frame in MCU and medium shots; opposite our sky-blue UI accent (hf01: a cobalt jacket against an orange UI).

## Generation plan (counted by the build; nothing generated)

- **Image-to-video per take:** 16 film legs, 87 s requested (47.24 s on screen) + 3 ad legs, 15 s = **102 s, about $16.32 a take** at $0.16/s (skill FOOTAGE.md: MiniMax H3 Max at 1080P, checked 2026-10-22). Budget re-rolls on the identity keys.
- **Stills:** 16 key stills (one per leg, its first frame) + 5 ad stills, all made from the CAST.md character sheet and the location sheets as image references, never from text alone.
- **Order:** character sheet -> location sheets -> identity-key legs (S01 1c, S04 4A, S09, S14 14B, S22, S24, S26) -> the rest -> ad legs.

| Shot | Leg | sec | Used on screen (s) |
|---|---|---|---|
| S01 | 1a | 5 | 3.2 |
| S01 | 1b | 6 | 5.07 |
| S01 | 1c (identity key) | 5 | 3.4 |
| S02 | 2 | 5 | 0.53 |
| S03 | 3 | 5 | 0.6 |
| S04 | 4A (identity key) | 5 | 4.13 |
| S04 | 4B | 6 | 5.27 |
| S09 | 9 (identity key) | 5 | 2.7 |
| S14 | 14A | 5 | 3.13 |
| S14 | 14B (identity key) | 5 | 1.4 |
| S15 | 15 | 5 | 0.77 |
| S20 | 20 | 5 | 1.2 |
| S21 | 21 | 5 | 0.27 |
| S22 | 22 (identity key) | 5 | 4.0 |
| S24 | 24 (identity key) | 5 | 3.5 |
| S26 | 26 (identity key) | 10 | 8.07 |
| ad | A1 | 5 | (ad asset) |
| ad | A2 | 5 | (ad asset) |
| ad | A3 | 5 | (ad asset) |

## Check with Manus (none of this is stated as a fact on screen)

- S01: An Automation surfacing an email on her wrist display as a notification (F11 is the trigger; this action is not shown officially).
- S04: Starting a Studio Video Editor job from a wrist display (a phone-class device); the only phone flow shown officially is Remote Control of your own Mac.
- S04: Attaching her helmet-cam clip to the job from the wrist display (upload hand-off not shown officially).
- S04: The small Manus mark as a UI icon in the prompt bar (replaces a model label; confirm brand usage).
- S06: The 'Cloud Computer' run chip implies Video Editor jobs run on a Cloud Computer (F10 shows Studio's run picker; a Video Editor job there is not shown). Fallback: remove the chip; S24-S25 still tell the story.
- S09: A follow-up prompt re-ordering shots in a running Video Editor job (PITCH 'Do not state': a re-edit of a finished timeline by prompt; ours is mid-job).
- S09: Tone, for Manus marketing: drifting at the end of a tether is played as comic peril (tethered, unhurt).
- S10: The Video Editor retiming her clip to half speed (F7/F9 cover making videos; the step itself is our depiction).
- S11: Her helmet-cam clips reaching the Video Editor project (nothing on screen says how they got there).
- S12: 'Alchemy' as a direction board in our editor (F8 covers creative direction; the UI is ours).
- S12: Tone, for Manus marketing: the alarm chain ('Alarms: muted' S07, 'No alarms.' S12, 'Mood lighting included.' S23) is the film's sound and light direction, written to her notes; none of it tells guests to ignore an alarm.
- S14: A follow-up prompt recasting a shot in a running Video Editor job (near PITCH 'Do not state'; ours is mid-job).
- S17: The Video Editor slowing and re-grading her debris clip (our depiction of an edit; F7 covers making videos).
- S18: Alchemy picking a sound cue (F8 covers sound direction; the UI and the pick are our depiction).
- S22: A follow-up prompt setting the look (the grade) of a shot in a running Video Editor job.
- S22: Tone, for Manus marketing: a radiation alarm played as a joke ('Mood lighting.'); she is unhurt and the film never claims the alarm is harmless.
- S24: The job finishing while her device has no signal (implies it runs on her always-on Cloud Computer: F12/F14 cover always-on tasks; a Video Editor job there is not shown officially).
- S24: A follow-up prompt adding the ending and asking to ship (sending the film to a contact as an action of the task).
- S24: Her helmet-cam glow clip reaching the job on the last bar (same upload hand-off as S04).
- S25: Same as S24 (the film reaching Marketing while she is offline).
- All: Save the official 2.0 blog post before release: F9 (product ads 30-60 s), the F11 trigger list and F12 rest on the brief's summary (PITCH Critic §2).
- All: The domain for any URL line: the saved site links both manus.im and manus.ai (none drafted).
- All: Clear the fictional names before release: The Lull, Arden Station (never on screen), Commander Wren Adair (never on screen). Check the suit (orange bands), the capsule, the station and the patch against real programmes' hardware.
- All: Not depicted, so nothing to check: an Automation starting a Video Editor job. Her Automation only surfaces the email; she starts the job herself with P1. The S26 reply is an ordinary email notification (no Automation label).

**Claims on screen.** Claims on screen come only from PITCH's 'Facts we may state': F1 (Manus 2.0: title, product line), F11 (Automations triggered by a new email: the S01 bubble label), F5 / F7 / F9 (Manus Studio's Video Editor makes videos, product ads: the editor, the film), F8 (Alchemy creative direction incl. sound: the panel, the board, the whale-song pick), F12 / F14 (Cloud Computer, always on: the chip, the job that finishes during her blackout, the cloud icon). No numbers about Manus appear anywhere; every number on screen belongs to the fictional film or her day (30s, 90 MIN, the countdown, the clock), and 'Booked solid.' is the fictional module's sales, not a Manus result. Manus's own lines are plain progress and results ('Keeping it calm.', 'Drift first.', 'Half speed…', 'Debris → stars.', 'Adding whale song…', the file card): the jokes are hers.

## Decisions for Alex

| Decision | Options | Drafted as |
|---|---|---|
| Score mood / tempo | (A) hf01's own feel: dark E drone, 87.01 BPM half-time 808 groove, cinematic (fits space; PITCH §2.10 says Manus is 'bright and friendly, never dark'); (B) bright F major on hf01's 87.01 BPM grid, every sync point kept (the groove at n665.3, drop +244 ms after n1651, groove stop on bar 25 = the gull, sting +0.368 s after n2175); (C) Manus's 128 BPM (retimes every loop off hf01's frames; not recommended). | B, with the vacuum rule (in-suit sound only until the re-entry roar) |
| VO or type only | Type only, floating in zero G (Manus's own film has no VO; the joke 'words float in space' needs type); or voiced like hf01's problem act (13.37-19.95 s: casting + a VO session, gaps item 20). | Type only |
| URL line | None (Manus used none); or a URL on the end card, which needs Manus to say manus.im or manus.ai (the saved site links both). | None |
| End line | 'Out of office. / Out of range. / Still shipping.' (drafted) or the brief's two lines 'Out of office. / Still shipping.' | Three lines: 'Out of range.' names the blackout, the film's product truth |
| Title card | Three feature icons, no words (drafted: '2.0' is the only title word, 1.4 s); or the worded card 'Automations · Studio · Cloud Computer', which fails the 3 words/s rule (4 words in ~1.1 s readable). | Icons; the names come in S26's product line |
| S26 timestamp line | '19:47' only (drafted: fits hf01's bubble window at 2.9 w/s and drops a second, unshown Automation action) or 'Automation · 19:47' (the S01 label word for word; then 'Booked solid.' has to go). | '19:47' |
| One suit for EVA and re-entry | One suit, backpack removed in the capsule (drafted: one wardrobe for identity, like hf01's jacket) or an entry suit for S24-S26 (accurate, but a second wardrobe sheet and two identity keys in the suit seen least). | One suit |
| S25 thumbnail / last shot | Her own helmet-cam glow (drafted: exists before the send) or her capsule's streak seen from the station (the prettier picture, but recorded after she sent P5: two judges against). | Her glow |
| Same-day spacewalk and re-entry | Keep (heightened genre; planted by the docked capsule in S01, the capsule glyph in S04 and the dashed pin in S19) or move re-entry to the next day (then the 19:00 countdown loses its double meaning). | Keep |
| Tone (Manus marketing) | The peril is slapstick and nobody is hurt: a tether that runs out (S09), a radiation alarm called 'Mood lighting.' (S22), the alarm chain in the film's sound and light direction. Keep, or soften S22 to a plain 'caution' alarm. | Keep; ask Manus marketing |
| Prompt-bar label | The small Manus mark as an icon (drafted: no words in the bar but the prompt) or the ridge's 'Manus 2.0' label (2 more words in every bar shot, and a naming question for Manus). | Mark icon |
| Plush whale (S24, S26) | Keep (a real crew tradition that sets up 'Undersea next?') or drop (one less prop for identity QA; nothing depends on it). | Keep, cut first if a take fails |
| S21 wrench | An AI leg (5 s, 8 frames used) or a 3D wrench sprite over a streak plate (saves 5 s, $0.80 a take). | AI leg |

---

# Shot list

## S01 · n0-n347 · 0.000-11.600 s · 348 f (11.600 s, 279 mf) · title + overlay-on-footage

- **hf01 (cuts S01 'fpv-plate-title-waterfall-climber', SHOTS.md #1 + #2):** Acts 0-1 in one plate: the co-brand title over a dark jungle 'window', a zoom-through into the world, an FPV dive to the hero at a waterfall, and the client's brief arriving on his phone. Stakes: an urgent brief, far from a desk.
- **Ours:** One continuous free-flying camera move: from a dark station module through an open round hatch framing Earth (title: the Manus lockup, '2.0', a card of three 2.0 feature icons, our embroidered mission patch), out along the truss past a small docked capsule (her ride home, planted without a word), down to a tiny white-and-orange astronaut tightening a bolt on the new guest module. She lifts her wrist: Marketing's email, surfaced by her Automation. Launch moved up. Film by tonight? The wrench drifts off her glove and away; she does not even look.
- **In:** start: first frame n0 is already the plate with the lockup sharp at cy 247.
- **Out:** cut (hard) at n348 to the tool-bag release.
- **Subject:** The astronaut (CAST.md) on a spacewalk at the end of the truss, at the new guest module (The Lull); the station; the docked capsule.
- **Action:** n0-68 the camera creeps through a dark module past cable bundles toward an open round hatch, black space and Earth's blue limb in it. n69-87 it bursts out of the hatch into sunlit space. n88-101 a dark solar-array panel slides across the lens (hf01's dark-foliage wipe). n102-140 it glides above the long truss, Earth bright below, passing a small white capsule with one orange band docked at a port (the station's widest frame). n141-250 it descends and orbits to a tiny astronaut at the guest module, working a wrench on a bolt with big slow movements. n248-256 she lifts her left forearm; a small window strip in the wrist display's cover lights. n256-347 she reads it, MCU through the clear helmet, gold visor up: her other glove opens and the wrench drifts off it, turning slowly away into the black, while her face sets into a long, flat, 'you are kidding me' stare.
- **Framing:** FPV wide -> aerial wide -> slightly high MCU (she holds the right third; black space fills the left, where the bubbles go).
- **Lens:** ~18-20 mm for the flight (estimated), settling to a ~35 mm-equivalent MCU with mild depth of field.
- **Light:** R0 (n0-68) then R1: hard orbital daylight, true black space, Earth's blue-white the big bright area; the suit's white held below clipping; signal orange the only warm colour.
- **Camera (matches hf01):** hf01 S01 exactly: creep push +0.39 %/mf (n0-52) -> builds +1.1 -> +4.7 %/mf (n53-60) -> title covers n61-69 -> flight +4.6 %/mf, content -6 px/mf left (n70-87) -> through the array-panel wipe (n88-111) -> over the truss +2.75 easing to +1.6 %/mf (n112-140) -> descend/orbit +0.77 %/mf, content (+2.3, -2.0) px/mf (n141-250) -> settles 1.7 px/mf while she reads (n251-270) -> drift (+1.1, +0.8) px/mf with +0.18 %/mf to the cut. Gimbal-smooth, shake rms ~2.5 px.

**On screen (our copy)**

| Text | Chars | Visible | Legible | Words | Readable s | w/s | Where |
|---|---|---|---|---|---|---|---|
| [Manus mark + 'manus' wordmark, white files] | - | n0-n68 | n0 | logo | - | - | title lockup |
| 2.0 | 3 | n15-n60 | n18 | 1 | 1.43 | 0.7 | title, big |
| Automation · 09:12 | 18 | n252-n347 | n252 | 2 | 3.2 | 0.62 | bubble timestamp line (with the envelope-and-bolt line icon) |
| Launch moved up. | 16 | n253-n347 | n256 | 3 | 3.07 | 0.98 | bubble A |
| Film by tonight? | 16 | n262-n347 | n266 | 3 | 2.73 | 1.1 | bubble B (the follow-up message, 0.3 s later) |
| Marketing | 9 | n262-n347 | n264 | 1 | 2.8 | 0.36 | sender label under bubble B |

**Overlays and elements**

| Element | Box 1080x608 | [1920x1080] | Timing | Motion |
|---|---|---|---|---|
| Lockup: manus-mark-white.svg + manus-wordmark-white.svg (white files: it sits over black space in the hatch) | 330-750 x 269-337 | 587-1333 x 478-599 | n0-9 drop, n16 jumps up and shrinks to 0.65, n19-36 glides up, n52-68 zoom-through | hf01's title motion: starts 55 px high, drops past rest by +11.5 px at n4, settles n9 (spring zeta 0.48, omega 17); small state at n45 x 410-670, y 171-214; glide cy 237 -> 192.5 on n24-36. |
| '2.0', Inter Semibold, white with a soft dark halo, cap ~116 px [206] | 395-685 x 246-362 | 702-1218 x 437-644 | slam n15-17, settle n18-26 | Cuts on at scale >= 1.6 with a horizontal smear and soft defocus, settles 1.32 -> 1.00 by n24 (power-out p 2.8); lifts 9 px as the card arrives (n27-33). |
| Feature card: white 92 % sheet, radius 12 [21]; three 2 px #2CB4F3 line icons, no words: an envelope with a small bolt (Automations), a film frame with a play triangle (Studio Video Editor), a cloud (Cloud Computer) | 420-660 x 382-442 | 747-1173 x 679-786 | n26-33 | hf01's pill stretch-in: a full-width band at y ~495 (n26-27) rises and squashes in x into the card; heavy x blur n27-31; crisp n32. |
| Decor chip a: small white sheet tilted +3 deg; envelope line icon with a #33ABFB unread dot (no text): the title's one blue accent | 170-300 x 455-512 | 302-533 x 809-910 | glass n33-35, icon n36, dot n39 | Cut-ons, left to right. |
| Decor chip b: small white sheet tilted -8 deg; a mini timeline glyph (3 grey bars + a grey #8A8A8A playhead: grey, so the title carries one blue accent only) | 783-930 x 330-395 | 1392-1653 x 587-702 | n42-45 | Fades in over 3 f, glyph on n45. |
| Our embroidered mission patch as a sticker (text-free: navy twill, gold border, crescent + small circle + three stars), tilted +12 deg: hf01's embroidered flower stickers | 860-965 x 50-155 | 1529-1716 x 89-276 | n6-68 | Pops in at n6 (scale 0.7 -> 1.05 -> 1.0 over 3 f), rides the title group. |
| Small embroidered star patch (gold thread on navy), tilted -10 deg | 120-185 x 515-580 | 213-329 x 916-1031 | n10-68 | Pops in at n10, rides the title group. |
| Glints: two white 4-point star glints | 760-790 x 315-345 | 1351-1404 x 560-613 | n24-27, n39-44 | Pop, grow ~2x, gone. |
| Whole title group | 120-965 x 50-580 | 213-1716 x 89-1031 | hold push n26-52; zoom-through n52-68 | Hold: +0.26 %/f about (540, 304). Exit: scale 1 -> 4.7 over 12 cf, cubic-bezier(1.0, 0.03, 0.88, 0.38); radial blur from n61; gone at n69; the plate continues under it. |
| Bubble A 'Launch moved up.' (white sheet); timestamp line centred above it, led by a small white envelope-and-bolt line icon | 44-252 x 204-240 | 78-448 x 363-427 | bar + timestamp n252, wipe n253-256, lands n262, hold to n347, hard cut n348 | A blank 41 px bar with vertical blur cuts on with the timestamp at n252; rises and settles (top 260 -> 204) over 10 cf, cubic-bezier(0.14, 0.86, 0.39, 0.97); soft wipe ~7 chars/cf. Timestamp at y 173-184 centred on x 148, white with a soft dark halo. |
| Bubble B 'Film by tonight?' (the follow-up message); sender 'Marketing' right-aligned below it | 44-252 x 248-284 | 78-448 x 441-505 | bar n262, wipe n263-266, lands n272, hold to n347 | Same bar and rise (top 300 -> 248) 10 f after bubble A, the comic beat of a second message; sender label at y 293-302 ending at x 252. |

**Sound.** Unpulsed until n665. Title: four soft air sounds half a frame ahead of their graphics (a breathy noise burst + sub thump n6.7, a sharper breath + sub n13-16 under the 2.0 slam, a soft swish + 90 Hz sub n30-36, an air whoosh n52-66 into the zoom-through). From n69: no wind, because space is silent: the low hum of suit fans, her slow breathing, a faint radio hiss, under a sustained airy pad on an open F/C fifth; a swell ~n180-210; the quietest stretch n213-248. A soft two-note chime (F -> C) at n249, 3 f before bubble A, and a smaller one at n259 for bubble B. Her single long exhale through the nose at ~n300, as the wrench drifts off.

**Generation plan.**

| Leg | Key still at | sec | Use | Join |
|---|---|---|---|---|
| 1a | n0 | 5 | n0-n95 (3.2 s) | ends inside the dark array-panel wipe n88-101; cut to 1b inside the black |
| 1b | n95 | 6 | n95-n246 (5.07 s) | a white handrail passes close to the lens n240-252 and hides the join to 1c |
| 1c (identity key) | n246 | 5 | n246-n347 (3.4 s) | - |

*Leg 1a, key still (16:9, the leg's first frame n0):*

> Cinematic 16:9 still from inside a dark space-station module: near-black silhouettes of cable bundles, stowage straps and white handrails frame an open round hatch in the centre; through the hatch, black space in the upper half and the bright curved blue limb of Earth across the lower third. 18 mm, deep focus, the interior in deep shadow, the hatch the only bright area. Unbranded and fictional: no logos, no flags, no name tags and no lettering anywhere on the station, suit or capsule. Photoreal cinematic film still, natural skin texture, visible film grain, slightly soft, unretouched, not a stock photo, true blacks, no flags, no insignia, no text, no logos, no watermark.

*Leg 1a, motion (image-to-video, --sec 5):*

> Free-flying camera, FPV feel. It creeps slowly toward the round hatch for two seconds, then accelerates, bursts out through the hatch into sunlit space, and a dark solar-array panel slides across the whole lens at the end. Smooth and steady. Weightless, real-time, natural motion. Keep the lighting, colours, depth of field and film grain of the first frame. No text, no captions, no logos.

*Leg 1b, key still (16:9, the leg's first frame n95):*

> Cinematic 16:9 still in orbit: high above a fictional orbital station of white modules wrapped in matte white and pale-gold insulation blankets, a long open lattice truss with white handrails and blue-black solar arrays, with a small white gumdrop-shaped capsule with one orange band docked at one of the station's ports; the bright blue-and-white Earth filling the lower half of the frame, black space above; far along the truss, at a soft rounded white module with one large round window, one tiny spacewalking astronaut in a white suit with signal-orange bands. Hard sunlight. 24 mm, deep focus. Unbranded and fictional: no logos, no flags, no name tags and no lettering anywhere on the station, suit or capsule. Photoreal cinematic film still, natural skin texture, visible film grain, slightly soft, unretouched, not a stock photo, true blacks, no flags, no insignia, no text, no logos, no watermark.

*Leg 1b, motion (image-to-video, --sec 6):*

> Smooth free-flying camera. It glides forward along the truss, passing over the small docked capsule, then descends in a slow curving orbit toward the tiny astronaut working at the rounded module; at the very end a white handrail passes close across the lens. Weightless, real-time, natural motion. Keep the lighting, colours, depth of field and film grain of the first frame. No text, no captions, no logos.

*Leg 1c (identity key), key still (16:9, the leg's first frame n246):*

> Cinematic 35mm film still, slightly high medium close-up in orbit: an East Asian woman of about 40 with light warm skin, strong expressive dark eyebrows with a small pale scar through the left brow, dark brown eyes and faint laugh lines, wearing a black fabric comms cap with small ear cups inside a clear bubble helmet whose gold sun visor is raised so her whole face is visible, two small lamps at the helmet's temples and a small camera on its right side, and a fictional white spacesuit of matte multi-layer fabric with a hard upper torso, saturated signal-orange bands around both upper arms and both thighs, an orange helmet neck ring, white gloves with orange fingertip grips, a slim dark wrist display under a padded white cover strapped over the left forearm, an embroidered round mission patch on the left shoulder (navy twill, gold border, a crescent cradling a small circle and three stars, no lettering) and a white life-support backpack. She floats beside the white hull of a rounded guest module, one glove on a white handrail, a small silver wrench loosely held in her other glove, her left forearm raised as a small window strip in the wrist display's cover lights up; she reads it with a flat, deadpan stare. Black space fills the left of the frame; the blue Earth curves below. Hard sunlight from the right, deep shadow side, her face clearly visible through the clear helmet bubble with no reflection over the eyes. 35 mm, mild depth of field. Unbranded and fictional: no logos, no flags, no name tags and no lettering anywhere on the station, suit or capsule. Photoreal cinematic film still, natural skin texture, visible film grain, slightly soft, unretouched, not a stock photo, true blacks, no flags, no insignia, no text, no logos, no watermark.

*Leg 1c (identity key), motion (image-to-video, --sec 5):*

> The camera hangs in front of her, then drifts very slowly right and down. She raises her left forearm and reads the wrist display; her other glove opens and the small wrench floats away from it, turning slowly into the black; she keeps staring at the display with a long, flat, unimpressed look; one slow blink. The wrist display glows softly but its screen is never readable. Weightless, real-time, natural motion. Keep the lighting, colours, depth of field and film grain of the first frame. No text, no captions, no logos.

- Note: Comedy: the opener plays completely straight (epic flight, Gravity-scale beauty) so the first laugh is her face: the long deadpan stare at an email from Marketing, 400 km up, while the wrench simply leaves.
- Note: The pun: 'Launch moved up.' read by someone already in orbit. The ask comes as a second, separate message (bubble B), the way bad news does.
- Note: Plants, all wordless: the docked capsule (n102-140) is her ride home (S24); the wrench that drifts off (n256-347) is the one that comes back in S21-S22; 'Loose items leave.' (S19) is the rule it breaks.
- Note: Title: three feature icons instead of words keeps the title at 1 word ('2.0') in 1.4 s; the features are named in S26's product line. hf01's 'for Motion Design' pill structure is not reused. One blue accent only (the unread dot; the timeline chip's playhead is grey).
- Note: Day clock: 09:12 here, a countdown to 19:00 in S04, 19:47 on the reply (S26).
- **Check with Manus:** An Automation surfacing an email on her wrist display as a notification (F11 is the trigger; this action is not shown officially).

## S02 · n348-n363 · 11.600-12.133 s · 16 f (0.533 s, 13 mf) · footage

- **hf01 (cuts S02 'backpack-drop', SHOTS.md #3a):** Commitment insert (0.53 s): the pack drops onto the forest floor; the work starts here, in the field.
- **Ours:** Against the station hull, her glove lets go of the white tool bag. It does not drop. It stays exactly where she left it, floating.
- **In:** cut at n348.
- **Out:** cut at n364 to the thigh-pocket close-up.
- **Subject:** Her white tool bag (orange pull tab, small carabiner), her glove, the white insulated hull with a handrail, Earth soft behind.
- **Action:** Her gloved hand opens and pulls away; the bag hangs in the air, motionless, turning maybe two degrees.
- **Framing:** CU, the bag centre-left, the glove leaving frame right.
- **Lens:** ~35 mm, shallow depth of field.
- **Light:** R1: hard sun, deep shadow side of the hull.
- **Camera (matches hf01):** hf01 S02: near-static, drift <= 2.5 px/mf, scale 0.994 over the shot.

**On screen:** nothing.

**Sound.** hf01's pack thud lands here; ours never comes. A glove creak, then the bed dips for 4 frames where the thud would be (the joke is the missing sound).

**Generation plan.**

| Leg | Key still at | sec | Use | Join |
|---|---|---|---|---|
| 2 | n348 | 5 | n348-n363 (0.53 s) | - |

*Leg 2, key still (16:9, the leg's first frame n348):*

> Cinematic 35mm film still, close-up in orbit: a white spacesuit glove with orange fingertip grips letting go of a small white tool bag with an orange pull tab, which floats in mid-air against the white insulated hull of a space station and a white handrail; the blue Earth soft and out of focus behind. Hard sunlight, deep shadows. Shallow depth of field. Photoreal cinematic film still, natural skin texture, visible film grain, slightly soft, unretouched, not a stock photo, true blacks, no flags, no insignia, no text, no logos, no watermark.

*Leg 2, motion (image-to-video, --sec 5):*

> Near-static camera. The glove opens and pulls away to the right; the tool bag stays exactly where it was, floating motionless in the air, turning very slightly. Weightless, real-time, natural motion. Keep the lighting, colours, depth of field and film grain of the first frame. No text, no captions, no logos.

- Note: Comedy: hf01's pack drop, in zero G. Nothing drops. A 0.53 s sight gag that tells the audience the physics are part of the joke.

## S03 · n364-n381 · 12.133-12.733 s · 18 f (0.600 s, 14 mf) · footage

- **hf01 (cuts S03 'zipper-closeup', SHOTS.md #3b):** Insert: hands unzip the pack, setting up what comes out of it (the mascot).
- **Ours:** Close-up: her glove rips open the padded Velcro cover of her wrist display. Underneath, the full screen glows (never readable). This is where S04's thoughts rise from.
- **In:** cut at n364.
- **Out:** cut at n382 to the low framing on the open display.
- **Subject:** Her left forearm, the wrist display under its padded white cover, her right glove (orange fingertip grips), the orange arm band at the frame edge.
- **Action:** One broad pull rips the Velcro cover back; the screen underneath glows soft blue-white (unreadable).
- **Framing:** CU, the display centre, the orange band across the top.
- **Lens:** ~50 mm, shallow depth of field.
- **Light:** R1d: low side light from Earth's limb; the screen's glow lifts the glove; black behind.
- **Camera (matches hf01):** hf01 S03: static-looking; only the hand moves.

**On screen:** nothing.

**Sound.** A muffled Velcro rasp carried through the suit; one breath; a faint soft tone as the screen wakes.

**Generation plan.**

| Leg | Key still at | sec | Use | Join |
|---|---|---|---|---|
| 3 | n364 | 5 | n364-n381 (0.6 s) | - |

*Leg 3, key still (16:9, the leg's first frame n364):*

> Cinematic 50mm film still, close-up in orbit: a white spacesuit glove with orange fingertip grips gripping the padded white Velcro cover of a slim wrist display strapped to the other forearm, just below a saturated signal-orange arm band; low side light, black space behind, the fabric texture crisp. Shallow depth of field. Unbranded and fictional: no logos, no flags, no name tags and no lettering anywhere on the station, suit or capsule. Photoreal cinematic film still, natural skin texture, visible film grain, slightly soft, unretouched, not a stock photo, true blacks, no flags, no insignia, no text, no logos, no watermark.

*Leg 3, motion (image-to-video, --sec 5):*

> Static close-up. The glove pulls the padded cover back in one broad movement; the slim screen underneath lights up with a soft blue-white glow. The wrist display glows softly but its screen is never readable. Weightless, real-time, natural motion. Keep the lighting, colours, depth of field and film grain of the first frame. No text, no captions, no logos.

- Note: Sets up S04 (hf01: the pack opens, the mascot pops out): the composited glyph rises out of this screen.
- Note: One broad pull, no fine finger work. Her S01 read was on the cover's small window strip; this opens the full screen she will type on (hf01: he reads his phone, then unzips the pack for the laptop).

## S04 · n382-n660 · 12.733-22.033 s · 279 f (9.300 s, 223 mf) · overlay-on-footage

- **hf01 (cuts S04 'sitting-wide-mascot-fx-prompt', SHOTS.md #4):** Act 2, the problem: the mascot pops out of the pack and morphs through motion-design choices while his inner voice asks questions (voiced); a fire relights the plate; prompt 1 is typed slowly in three beats and sent (n652).
- **Ours:** Floating at the guest module's hull, she takes in the brief while her thoughts float out of the wrist display in zero G, as a white glyph that hard-swaps on hf01's own frames: a film frame ('Tonight?'), a planet with a ring ('From space?'), a helmet that gets bonked ('Nose itches.'), the sunrise flare ('Sunrise. Again.'), a countdown with a small capsule beside it, and the film frame again, now framing the sunrise. 'Deep breath.' 'Not that deep.' She taps the first prompt.
- **In:** cut at n382 (opens low on her open wrist display, wobbling up).
- **Out:** card-in at n661: hard cut out of the send sweep to the first status screen.
- **Subject:** The astronaut floating on the right third, one glove on a handrail of the guest module's white hull; her open wrist display; Earth's limb low in frame; black space above and left.
- **Action:** n382-400 the frame opens low on her open wrist display glowing in the dark (its top edge at about (657, 191), where hf01's pack opening sits) and tilts up to her face. n402-470 she reads, sighs, looks out at Earth. n474-496 she lifts her free glove toward her nose: it bonks the helmet bubble; she lowers it, defeated (a plate bonus: the composited helmet glyph carries the beat on n476 either way). n502-535 orbital sunrise: the sun bursts over the limb behind her, a gold flare floods the frame and relights her suit and helmet; she squints and turns her face away; hard daylight from n540. n540-585 a big slow inhale (shoulders rise), a hesitation, and she lets half of it out. n588-650 she taps the wrist display with one gloved finger in three bursts.
- **Framing:** Opens low: the open wrist display across the middle of the frame, her glove below, her helmet in the top quarter; tilts up to a medium-wide. Black space on the left half carries the glyph, the words and the countdown; the bar sits bottom right.
- **Lens:** 35-50 mm (estimated), soft background.
- **Light:** R1d orbital dawn (lit by the limb, the display and her helmet lamps), then R1s at n502-535 (the relight is in the plate; the flare disc is composited on top), then R1 hard daylight.
- **Camera (matches hf01):** hf01 S04: opening wobble up -10 px/mf (n383-389); quick tilt up to her face n390-396 (content down +19 -> +35 -> +22 px/mf, peak n393); slow push-in +0.34 %/mf n397-497 (x1.32); hold/drift <= 0.5 px/mf to n660. Shake rms ~4 px (a free-flying camera's float).

**On screen (our copy)**

| Text | Chars | Visible | Legible | Words | Readable s | w/s | Where |
|---|---|---|---|---|---|---|---|
| Tonight? | 8 | n410-n437 | n414 | 1 | 0.8 | 1.25 | floating word 1 (with the film-frame glyph; peaks ~n423 with hf01's 'What is it this time?') |
| From space? | 11 | n442-n469 | n446 | 2 | 0.8 | 2.5 | floating phrase 2 (with the orbit glyph from n447; peaks ~n452 with hf01's 'Objects?') |
| Nose itches. | 12 | n470-n497 | n474 | 2 | 0.8 | 2.5 | floating phrase 3 (with the helmet glyph from n473 and its bonk at n476; peaks ~n482 with hf01's 'Shapes?') |
| Sunrise. Again. | 15 | n499-n526 | n503 | 2 | 0.8 | 2.5 | floating phrase 4 (rides the flare from n503; peaks ~n510 with hf01's 'VFX?') |
| T–09:48:00 | 10 | n523-n565 | n525 | 1 | 1.37 | 0.73 | countdown, mono (hf01's code-burst slot); counts 09:48:00 -> 09:47:58; a small capsule glyph beside it |
| Deep breath. | 12 | n526-n553 | n530 | 2 | 0.8 | 2.5 | floating phrase 5 (hf01's 'Expression?' slot, peak ~n537) |
| Not that deep. | 14 | n552-n586 | n556 | 3 | 1.03 | 2.9 | floating phrase 6 (hf01's 'Wait / No / Let me explain' slot; the film frame returns n566) |
| Lull launch film. 30s. Make it calm. | 36 | n588-n660 | n588 | 7 | 2.43 | 2.88 | prompt bar 1 (P1) |

**Overlays and elements**

| Element | Box 1080x608 | [1920x1080] | Timing | Motion |
|---|---|---|---|---|
| Thought glyph (plate.mjs glyph, white line icon with a soft white halo; rigid, weightless, never morphs): film frame -> orbit -> helmet -> flare disc -> (countdown) -> film frame | 250-490 x 135-355 | 444-871 x 240-631 | peek n384-385 (its top edge in the open display at (657, 191)); rise n386-390; swoop n391-399; float n399-426; grow n426-437; hard swaps on hf01's frames: n447 orbit, n473 helmet (jolt 6 px down-left at n476 and back by n479: the bonk), n502 one blank frame, n503 flare disc, n523 breaks into specks that form the countdown, n566 the film frame returns big | hf01's cat curves exactly: rise to the apex (575, 35) with motion blur, no stretch; swoop cy 45 -> 264 (cubic-bezier(0.50, 1.10, 0.69, 0.99)) while cx 511 -> 365; then a slow tumble (+/-0.6 deg/cf) instead of hf01's bob; grow x1.14 (n426-437). Each swap: hard cut + one ghost frame at 1.1-1.3x, the new icon keeps the drift vector. n503-522 the flare disc, born at the limb where the sun breaks, grows upward with the plate's starburst (top y 269 -> 208 -> 141 -> 105 -> 49 -> ~19), ~330 px wide [587]. n566 the film frame lands at 1.27x (blurred), 1.04 n567, 1.00 n568 (cubic-bezier(0.17, 1.04, 0.31, 1.0)), 180 x 101 [320 x 180], and floats over the sunrise on the left (x 354 -> 397, y 251 -> 238 -> 248) to n660: her first shot, framed before she asks for it. |
| Floating words (white Inter Medium, soft dark halo; zero-G turn 2-4 deg per phrase) | 380-740 x 26-200 | 676-1316 x 46-356 | 'Tonight?' n410-441; 'From space?' n442-473; 'Nose itches.' n470-501; 'Sunrise. Again.' n499-530; 'Deep breath.' n526-557; 'Not that deep.' n552-590 | Each phrase: focus-in over 4 f before r, sharp, out over 4 f after l. Positions: 'Tonight?' 540-680 x 30-78; 'From space?' 450-660 x 96-144; 'Nose itches.' 520-730 x 120-168 (it drifts toward her helmet); 'Sunrise. Again.' 400-690 x 60-108; 'Deep breath.' 420-640 x 34-82; 'Not that deep.' 390-680 x 118-166. Drift (+7.85, -2.7) px/cf; 'Not that deep.' drifts (-8.7, -1.75) like hf01's stack. Peaks ~5 f after each glyph swap (n452, n482, n508), as hf01's words peak after each morph. |
| Countdown, mono (JetBrains Mono class), white with a soft dark halo, cap ~30 px [53], with a small white capsule line icon (gumdrop, one band; plate.mjs 'capsule' glyph) 12 px to its right | 102-520 x 180-230 | 181-924 x 320-409 | n523-527 forms from the flare's light specks; ticks 09:47:59 at n530, 09:47:58 at n560; holds to n565; breaks into specks n565-570 | hf01's code burst: the flare disc breaks into fine light specks that re-form as the countdown and the capsule icon; specks drift up and fade n526-548; the block drifts right ~0.5 px/f and tumbles 1 deg. |
| Prompt bar 1 (our bar; see kit) with the helmet-cam thumbnail chip and the signal glyph at three bars | 500-975 x 424-550 | 889-1733 x 754-978 | first faint n581, full n585, spring peak n587, settled n601; typing n588-650; chip n640; press n648-652 (glow peak n652); send sweep n653-660; hard cut n661 | Typed in three human beats like hf01's p1: 'Lull launch film.' n588-603, pause 6 f, ' 30s.' n610-617, pause 14 f, ' Make it calm.' n632-648. The chip pops into row 2 at n640 (scale 0.6 -> 1.06 -> 1.0 over 3 f) as she attaches the sunrise clip. Send disc centre (930.5, 511) [(1654, 908)]. |

**Sound.** Still unpulsed: the airy pad, suit fans, breath. The glyph's rise (n386-390): one tuned soft pluck (F); each swap a smaller pluck up the F pentatonic. The visor bonk (n476): a dull plastic knock heard from inside the helmet (the film's first comic SFX), synced to the glyph's jolt. Sunrise n503-512: a warm air-swell bloom in the score (+13 dB at 1-4 kHz, our version of the fire whoomp); no 'real' sound, space is silent. 'Deep breath.': an audible long inhale; 'Not that deep.': a short puff out. The words are silent (type only; hf01 voices its words at 13.37-19.95 s). A pulsing pad from n555 leans into the groove. Send: an air-puff noise wash n645-661 into the card cut.

**Generation plan.**

| Leg | Key still at | sec | Use | Join |
|---|---|---|---|---|
| 4A (identity key) | n383 | 5 | n382-n505 (4.13 s) | ends inside the sunrise flare's white-gold bloom n502-506; 4B starts there |
| 4B | n503 | 6 | n503-n660 (5.27 s) | - |

*Leg 4A (identity key), key still (16:9, the leg's first frame n383):*

> Cinematic 35mm film still, handheld-feel framing low on a floating astronaut at orbital dawn: an East Asian woman of about 40 with light warm skin, strong expressive dark eyebrows with a small pale scar through the left brow, dark brown eyes and faint laugh lines, wearing a black fabric comms cap with small ear cups inside a clear bubble helmet whose gold sun visor is raised so her whole face is visible, two small lamps at the helmet's temples and a small camera on its right side, and a fictional white spacesuit of matte multi-layer fabric with a hard upper torso, saturated signal-orange bands around both upper arms and both thighs, an orange helmet neck ring, white gloves with orange fingertip grips, a slim dark wrist display under a padded white cover strapped over the left forearm, an embroidered round mission patch on the left shoulder (navy twill, gold border, a crescent cradling a small circle and three stars, no lettering) and a white life-support backpack. She floats on the right half of the frame beside the white hull of a rounded space-station module, one glove on a white handrail; her left forearm with the open wrist display glowing soft blue-white fills the middle of the frame, her face in the top quarter in three-quarter profile, looking down at it, clearly visible through the helmet bubble. Earth's curved horizon a thin bright blue line low in the frame, black space filling the left half. Dim dawn light from the limb and the display, deep shadows. 35mm, soft background. Unbranded and fictional: no logos, no flags, no name tags and no lettering anywhere on the station, suit or capsule. Photoreal cinematic film still, natural skin texture, visible film grain, slightly soft, unretouched, not a stock photo, true blacks, no flags, no insignia, no text, no logos, no watermark.

*Leg 4A (identity key), motion (image-to-video, --sec 5):*

> The camera wobbles, tilts up quickly to centre her face, then pushes in very slowly. She reads the wrist display and sighs, looks out at the Earth, then lifts her free glove toward her nose and it bumps against the helmet bubble; she lowers it. At the very end the sun begins to burst over the horizon behind her and a gold flare fills the frame. The wrist display glows softly but its screen is never readable. Weightless, real-time, natural motion. Keep the lighting, colours, depth of field and film grain of the first frame. No text, no captions, no logos.

*Leg 4B, key still (16:9, the leg's first frame n503):*

> Cinematic 35mm film still, medium-wide in orbit at sunrise: an East Asian woman of about 40 with light warm skin, strong expressive dark eyebrows with a small pale scar through the left brow, dark brown eyes and faint laugh lines, wearing a black fabric comms cap with small ear cups inside a clear bubble helmet whose gold sun visor is raised so her whole face is visible, two small lamps at the helmet's temples and a small camera on its right side, and a fictional white spacesuit of matte multi-layer fabric with a hard upper torso, saturated signal-orange bands around both upper arms and both thighs, an orange helmet neck ring, white gloves with orange fingertip grips, a slim dark wrist display under a padded white cover strapped over the left forearm, an embroidered round mission patch on the left shoulder (navy twill, gold border, a crescent cradling a small circle and three stars, no lettering) and a white life-support backpack. She floats on the right third beside the white hull of a rounded module, one glove on a handrail, squinting and turning her face away from a blinding gold sunburst that has just cleared Earth's horizon behind her; gold light floods across her helmet and suit; black space on the left half. 35mm. Unbranded and fictional: no logos, no flags, no name tags and no lettering anywhere on the station, suit or capsule. Photoreal cinematic film still, natural skin texture, visible film grain, slightly soft, unretouched, not a stock photo, true blacks, no flags, no insignia, no text, no logos, no watermark.

*Leg 4B, motion (image-to-video, --sec 6):*

> Nearly still camera. The gold flare fades over one second to hard white daylight; she turns back, takes a big slow breath that lifts her shoulders, hesitates, lets half of it out, then raises her left forearm and taps the wrist display with one gloved finger in three short bursts. The wrist display glows softly but its screen is never readable. Weightless, real-time, natural motion. Keep the lighting, colours, depth of field and film grain of the first frame. No text, no captions, no logos.

- Note: Comedy: hf01's exasperated inner voice, in zero G. Six phrases, one setup-punchline pair ('Deep breath.' / 'Not that deep.') and one physical gag (the bonk, carried by the glyph and the sound on n476; the plate's own bonk is a bonus). The words turn slowly as they drift: they literally float.
- Note: hf01's morph chain kept on hf01's own frames (n447 / 473 / 503 / 523 / 566), composited, so the problem act lands whatever the take does. The glyph is a white line icon (never the Manus mark, never a character): her thoughts, not a mascot.
- Note: The countdown is the launch pun made graphic, and the capsule icon beside it plants, without a word, that 19:00 is about when her capsule goes home (S24).
- Note: Split into two legs joined inside the flare (n502-506): each leg carries half the action, which AI video handles far better than one 10 s take with six beats.
- Note: Reading: 20 words over 8.3 s; every phrase has >= 0.8 s (hf01's single words had 0.3-0.4 s).
- **Check with Manus:** Starting a Studio Video Editor job from a wrist display (a phone-class device); the only phone flow shown officially is Remote Control of your own Mac.
- **Check with Manus:** Attaching her helmet-cam clip to the job from the wrist display (upload hand-off not shown officially).
- **Check with Manus:** The small Manus mark as a UI icon in the prompt bar (replaces a model label; confirm brand usage).

## S05 · n661-n697 · 22.033-23.267 s · 37 f (1.233 s, 30 mf) · white status screen

- **hf01 (cuts S05 'card-brief-received', SHOTS.md #5):** Loop 1 status: the agent acknowledges the brief and says where it begins.
- **Ours:** Manus names the rule it is applying, plainly.
- **In:** card-in at n661 (copy ~25 px low, blurred, half contrast; slides up 25, 14, 9, 7, 4, 4, 4, 3 px per master frame).
- **Out:** card-out-up at n698: the copy accelerates up x1.31/mf to 17.5 px/mf; the editor window arrives already moving up.
- **Screen:** Full-frame #F7F7F7 dot grid; the Manus mark + one line (status screen, kit).
- **Layout:** The group is centred: mark hub (360.5, 290) [(641, 516)], ~56 px [100]; line x 418-748 [743-1330], cap top 271, baseline 309, Inter Medium ink, 'calm.' in #33ABFB.
- **Build:** Plate enters ~85 px low with sigma_y ~10 (n661); the line wipes n662-666 (~185 px/cf); a contrast shimmer (text to ~45 %, a ~180 px band at ~100 px/f) n672-681; exit up from ~n688 (2.7 -> 17.5 px/mf, sigma_y 3.8 on n697). The mark breathes 1.00-1.03.
- **Camera (matches hf01):** hf01 house curve, c = 3.3: y(t) = 81 e^(-t/0.150) - 89 e^((t-1.25)/0.150) + 3.3 px.

**On screen (our copy)**

| Text | Chars | Visible | Legible | Words | Readable s | w/s | Where |
|---|---|---|---|---|---|---|---|
| Keeping it calm. ('calm.' #33ABFB) | 16 | n662-n697 | n663 | 3 | 1.17 | 2.57 | status line (Manus) |

**Overlays and elements**

| Element | Box 1080x608 | [1920x1080] | Timing | Motion |
|---|---|---|---|---|
| Manus mark (manus-mark-dark.svg) | 333-388 x 262-317 | 592-690 x 466-564 | n661-697 | Rides the plate; breathes 1.00-1.03 over ~24 f; never rotates or morphs. |

**Sound.** The groove enters on bar 8's downbeat, n665.3 (+144 ms after the card cut): half-time feel at 87.01 BPM, soft kick and sub on F, a brushed 16th shaker. No UI sounds.

- Note: Manus is as unflappable as she is, and honest: it says what it is doing, never jokes about her danger. 'calm.' is the rule every later loop tests; the blue word marks it.

## S06 · n698-n775 · 23.267-25.867 s · 78 f (2.600 s, 62 mf) · deliverable-in-viewer + editor screen

- **hf01 (cuts S06 'ae-preview-badge', SHOTS.md #6):** Loop 1 result: the mascot badge builds in the AE viewer over his footage: the first deliverable piece.
- **Ours:** Our editor snaps up; in the viewer a ring reveals her helmet-cam sunrise as the film's first shot, and The Lull's mark builds and settles in the corner.
- **In:** card-out-up at n698 (strong variant: the window's first frame is a vertical smear ~120 px; the dot-grid desktop shows above it).
- **Out:** whip-left at n776.
- **Framing (master editor):** centre (600, 226), scale 1.45: shows master x 227.6-972.4, y 16.3-435.7; the comp lands at screen 85-821 x 50-465 [151-1460 x 89-827].
- **Screen:** The master editor (kit) at framing (600, 226, 1.45) over the #F7F7F7 desktop.
- **Layout:** On screen at n740: the comp x 85-821, y 50-466; title bar with 'The Lull', three aspect icons and the 'Cloud Computer' chip (partly in frame at the right); the Alchemy panel from x 845, header in type, rows as small swatch, thumbnail and wave tiles (no words); the transport row a play glyph and a scrub bar; playhead parked at 0.
- **Build:** The comp starts as an empty night-navy 16:9 frame with dashed title-safe guides and The Lull mark's base disc (night navy with a 2 px moon-white rim, 253 px [450], centre (482, 260)). The cursor drifts to it n706-717 and clicks; the reveal ring ignites on the disc edge n711-716 and grows 153 -> 340 px at 14.3 px/f (n716-729), revealing her helmet-cam sunrise (A1) inside; the ring fades n729-737. The disc shrinks x0.61 and moves to (291, 171) n720-733. The mark's parts cut on one at a time, each with one ghost frame at ~1.1x: n726 rim, n727 crescent, n735-736 the small round window, n742 three star dots, n748-750 a soft glow, n753 'THE LULL' caps. The cursor clicks around the mark n741-768.
- **Camera (matches hf01):** hf01 S06 on top of the framing: snap-up (smear n698, window-edge steps ~60-70, 27, 19.5, 13, 10.5, 7.5 px/mf, r 0.79); slow push s 0.972 -> 1.029 (n706-774); drift right +1.3 -> +6.7 px/mf (n756-762), dead stop n768-769, whip left -4.5, -1.9, -5.7, -33 px/mf (n771-774).

**On screen (our copy)**

| Text | Chars | Visible | Legible | Words | Readable s | w/s | Where |
|---|---|---|---|---|---|---|---|
| The Lull | 8 | n698-n775 | n704 | 2 | 2.4 | 0.83 | editor title bar (project) |
| Cloud Computer | 14 | n698-n775 | n704 | 2 | 2.4 | 0.83 | run chip, title bar right |
| Alchemy | 7 | n698-n775 | n704 | 1 | 2.4 | 0.42 | right panel header (rows are pictures, no words) |
| THE LULL (ad) | 8 | n753-n775 | n753 | 2 | 0.77 | 2.61 | under The Lull mark in the comp |

**Overlays and elements**

| Element | Box 1080x608 | [1920x1080] | Timing | Motion |
|---|---|---|---|---|
| Cursor (black arrow, white outline) | 440-520 x 230-300 | 782-924 x 409-533 | n706-768 | Drift 3-10 px/f, hop 41 px/f at n713 and 64 px/f at n738, hold 3-8 f on each target; never eased. |

**Sound.** Groove A, sparse. The ring, the cursor and the mark parts are silent.

- Note: Ad piece shown: the SUNRISE (A1, her own clip) as the first shot + The Lull mark. The sunrise that blinded her in S04 is now the film's first pretty shot.
- **Check with Manus:** The 'Cloud Computer' run chip implies Video Editor jobs run on a Cloud Computer (F10 shows Studio's run picker; a Video Editor job there is not shown). Fallback: remove the chip; S24-S25 still tell the story.

## S07 · n776-n806 · 25.867-26.900 s · 31 f (1.033 s, 25 mf) · editor screen

- **hf01 (cuts S07 'ae-timeline', SHOTS.md #7):** Proof of organisation: nine named, colour-coded layers stack in the timeline.
- **Ours:** The timeline: eight picture rows stack in over the audio row that is already there, selected and legible: 'Alarms: muted'. The planned rows are dashed, each with a small '?'.
- **In:** whip-left at n776 (cut frame streaked horizontally; content keeps moving left, expo ease-out r 0.80).
- **Out:** zoom-in at n807 (push-in about (548, 301) builds x1.8/mf into the cut).
- **Framing (master editor):** centre (392, 382), scale 1.45: shows master x 19.6-764.4, y 172.3-591.7; the comp lands at screen 386-1123 x -176-239 [686-1996 x -313-425].
- **Screen:** The master editor at framing (392, 382, 1.45): the timeline fills the lower two thirds.
- **Layout:** Sequence tabs as three aspect icons; ruler ticks without numbers; layer list at x 0-400 (a poster-frame thumbnail or an icon chip per row, no name bars); rows from y ~323, pitch ~30.5 px [54]. Bars at their in/out times (a staircase): made, filled: sunrise 0:00-0:05, the Lull mark 0:00-0:30, super 0:01-0:04; planned, 1 px dashed, each with a small grey '?' glyph: 0:05-0:10, 0:10-0:15, 0:15-0:20, 0:20-0:26, 0:26-0:30; the audio row at the bottom, 0:00-0:30, made, with a muted-speaker glyph, outlined #33ABFB, its name set in type: 'Alarms: muted' (Inter Medium, cap ~11 px [20] on screen).
- **Build:** The audio row is on screen from the cut (her helmet-cam audio, already processed). The eight picture rows stack in above it at n781, 783, 787, 789, 792, 796, 799, 802: each bar at ~50 % opacity on its first frame, rising 6-8 px into its row over 1-2 f; thumbnails and '?' glyphs arrive with the bars.
- **Camera (matches hf01):** hf01 S07 on top of the framing: whip-in decay -24.2 -> -2.7 px/mf (n778-791, r 0.80); drift ~2 px/mf; push-in build +0.38, +0.60, +1.06, +2.18, +8.6 %/mf (n801-806); n806 sharp.

**On screen (our copy)**

| Text | Chars | Visible | Legible | Words | Readable s | w/s | Where |
|---|---|---|---|---|---|---|---|
| Alarms: muted | 13 | n776-n806 | n779 | 2 | 0.93 | 2.14 | the audio layer's name (selected) |

**Overlays and elements**

| Element | Box 1080x608 | [1920x1080] | Timing | Motion |
|---|---|---|---|---|
| Left edge strip of the previous framing (the viewer) | 0-120 x 0-608 | 0-213 x 0-1081 | n776-780 | Slides out left: edge at x 28.5 (n778), 12 (n780), gone n781. |

**Sound.** Groove A.

- Note: Comedy (a second-viewing gag, 0.93 s): the alarm tones in her audio are already muted in loop 1, before anything has gone wrong. The chain reads without it ('No alarms.' S12 at 1.23 s, the alarm itself S20-S22, 'Mood lighting included.' S23).
- Note: The dashed rows with '?' are the plan; her disasters fill them, one per loop. Only one label is in type (1.03 s shot): the ridge's S07 carried 10 words in it.

## S08 · n807-n846 · 26.900-28.233 s · 40 f (1.333 s, 32 mf) · deliverable-in-viewer + editor screen

- **hf01 (cuts S08 'ae-comp-ara', SHOTS.md #8):** The mascot's speech bubble types itself: the character speaks for the brand.
- **Ours:** Back in the viewer, the film's first super types itself over her sunrise: 'Breathe easy.'
- **In:** zoom-in at n807 (keeps pushing in, decaying r 0.79; speed drops x0.35 across the cut).
- **Out:** cut at n847 to the drift (the screen side is still; the live side opens on motion).
- **Framing (master editor):** centre (540, 196), scale 2.0: shows master x 270.0-810.0, y 44.0-348.0; the comp lands at screen 32-1048 x 14-586 [57-1863 x 25-1042].
- **Screen:** The master editor at framing (540, 196, 2.0): her sunrise clip (A1) with The Lull's corner bug (text-free) fills the frame.
- **Layout:** Comp on screen x 32-1048, y 14-586. Text box lower-left of the comp, ~x 60-330, y 330-380; the ad's super face (Jost Regular class, sentence case, moon white with a soft shadow, cap ~20 px [36]).
- **Build:** Already built on the cut. Type-on from n808 at ~1.7 chars/f (13 chars, complete n815); a 1 px caret; a text field with a 1 px grey outline and corner handles while typing; the cursor leaves n833-838; deselect at n838 (outline and handles vanish, the text settles ~2 px).
- **Camera (matches hf01):** hf01 S08 on top of the framing: zoom-in arrival (n807 at 92.2 % of the n814 size, blurred), push decays +3.1 -> +0.1 %/mf (r 0.79); hold; drift down building to +2.8 px/mf at n846.

**On screen (our copy)**

| Text | Chars | Visible | Legible | Words | Readable s | w/s | Where |
|---|---|---|---|---|---|---|---|
| Breathe easy. (ad) | 13 | n808-n846 | n810 | 2 | 1.23 | 1.62 | the film's opening super, typed in the comp |

**Overlays and elements**

| Element | Box 1080x608 | [1920x1080] | Timing | Motion |
|---|---|---|---|---|
| Cursor | 380-470 x 330-380 | 676-836 x 587-676 | n807-838 | Rests in the field while it types, hops out at n836 (65 px/f), holds. |

**Sound.** Groove A.

- Note: Comedy: the ad tells viewers to breathe easy 20 seconds after she rationed her own breath.

## S09 · n847-n927 · 28.233-30.933 s · 81 f (2.700 s, 65 mf) · overlay-on-footage

- **hf01 (cuts S09 'running-laptop-prompt', SHOTS.md #9):** Loop 2 peril + prompt 2: running through the jungle with an open laptop, macaques at the edge; asks for the asset kit (sent n913).
- **Ours:** She has drifted off the hull. Slowly turning, the station falling behind her, her tether paying out in a long loose curve, she taps a creative note, perfectly calm: open the film on this drift. Then the tether runs out and snaps taut, and she is yanked out of frame.
- **In:** cut at n847 (a dark truss strut close to the lens covers the left and bottom and wipes off left: dark bottom rows 144 -> 58 -> 23 -> 7 -> 0 over n847-853).
- **Out:** card-in at n928 out of the jolt.
- **Subject:** The astronaut adrift beside the station: spread slightly, turning slowly; her orange-sleeved tether running back to a handrail in a long loose curve; the station big behind her at left; Earth filling the lower half.
- **Action:** A dark truss strut very close to the lens wipes off left (n847-853), revealing her. She drifts screen right, turning a few degrees, the tether paying out behind her; she glances back at the station once, looks back at the wrist display and taps it calmly, eyebrows up, unbothered (n878-912). n917-921 the tether runs out: the loose curve snaps into a straight line, her body jolts, and she swings out of frame right on the recoil (n921-927) as the camera takes the shock (a 3-frame shake).
- **Framing:** Side-on medium-wide; she drifts in frame x 741 -> 529 -> 650 and leaves right (hf01's runner path); the tether a long orange stroke from the station to her waist.
- **Lens:** ~35 mm, parallel move, shallow depth of field, foreground motion blur on the strut.
- **Light:** R2: hard daylight, Earth bright below, the station mid-grey behind her; she is the brightest object.
- **Camera (matches hf01):** hf01 S09: handheld tracking (here a free-flying camera matching her drift, with the same float); foreground strut wipes off left (n847-860, ~-17 px/mf); background flows left ~7 px/mf (n861-900); shake rms ~4.9/2.8 px; plus a 3-frame jolt (~12 px) at n917-919 when the tether snaps taut.

**On screen (our copy)**

| Text | Chars | Visible | Legible | Words | Readable s | w/s | Where |
|---|---|---|---|---|---|---|---|
| Open on this drift. | 19 | n881-n927 | n881 | 4 | 1.57 | 2.55 | prompt bar 2 (P2) |

**Overlays and elements**

| Element | Box 1080x608 | [1920x1080] | Timing | Motion |
|---|---|---|---|---|
| Prompt bar 2 (our bar) with the live helmet-cam thumbnail chip (the station receding) and the signal glyph at three bars | 190-662 x 412-535 | 338-1177 x 732-951 | first faint n876, full n879, settled n891; typing n881-893; chip n896; press n909-913 (glow peak n913); sweep n915-927; the bar takes the jolt with the plate n917-919; card-in n928 | Types ~1.6 chars/cf (19 chars by n893); the chip pops at n896 (0.6 -> 1.06 -> 1.0); enters armed; send disc centre (618.5, 498) [(1100, 885)]. |

**Sound.** On the cut: no wind, only her breathing (slow, even: the joke), suit fans, a faint radio chirp; the groove continues underneath; the tether reel's soft ratchet through the suit as it pays out; send air-puff n911-916; then the snap: a taut low twang through the suit and her short 'oof' of breath (n917), the score's 808 landing on the card.

**Generation plan.**

| Leg | Key still at | sec | Use | Join |
|---|---|---|---|---|
| 9 (identity key) | n847 | 5 | n847-n927 (2.7 s) | - |

*Leg 9 (identity key), key still (16:9, the leg's first frame n847):*

> Cinematic 35mm film still in orbit, side-on medium-wide: an East Asian woman of about 40 with light warm skin, strong expressive dark eyebrows with a small pale scar through the left brow, dark brown eyes and faint laugh lines, wearing a black fabric comms cap with small ear cups inside a clear bubble helmet whose gold sun visor is raised so her whole face is visible, two small lamps at the helmet's temples and a small camera on its right side, and a fictional white spacesuit of matte multi-layer fabric with a hard upper torso, saturated signal-orange bands around both upper arms and both thighs, an orange helmet neck ring, white gloves with orange fingertip grips, a slim dark wrist display under a padded white cover strapped over the left forearm, an embroidered round mission patch on the left shoulder (navy twill, gold border, a crescent cradling a small circle and three stars, no lettering) and a white life-support backpack. She drifts away from a fictional orbital station of white modules wrapped in matte white and pale-gold insulation blankets, a long open lattice truss with white handrails and blue-black solar arrays, spread slightly, turning slowly, completely calm, eyebrows raised, looking at the wrist display on her raised left forearm; an orange-sleeved safety tether runs from her waist back to a white handrail on the station in a long loose curve; the station big behind her at the left; the bright blue Earth fills the lower half; a dark truss strut very close to the lens covers the left and bottom edge, out of focus. Hard sunlight. 35mm, shallow depth of field. Unbranded and fictional: no logos, no flags, no name tags and no lettering anywhere on the station, suit or capsule. Photoreal cinematic film still, natural skin texture, visible film grain, slightly soft, unretouched, not a stock photo, true blacks, no flags, no insignia, no text, no logos, no watermark.

*Leg 9 (identity key), motion (image-to-video, --sec 5):*

> The camera drifts sideways with her; the dark strut in the foreground slides off the left of frame in the first moments. She floats away from the station, turning a few degrees, the tether paying out behind her; she glances back at the station once, then calmly taps the wrist display, unbothered. Near the end the tether pulls straight and taut, her body jolts, and she swings out of frame on the right. The wrist display glows softly but its screen is never readable. Weightless, real-time, natural motion. Keep the lighting, colours, depth of field and film grain of the first frame. No text, no captions, no logos.

- Note: Comedy: the desk-job joke at its purest. She is drifting off the station and her note is about the opening shot. Then the snap: physical comedy, and the answer to how she gets back (she is tethered; she reels in).
- Note: Escalation 2, and the lowest-stakes peril on purpose: tethered, so nobody is lost (the excitement judge's out-of-order escalation and the tone risk both go).
- Note: Fallback if the take does not jolt: a 3-frame digital shake on n917-919 plus the twang; she leaves frame right either way.
- **Check with Manus:** A follow-up prompt re-ordering shots in a running Video Editor job (PITCH 'Do not state': a re-edit of a finished timeline by prompt; ours is mid-job).
- **Check with Manus:** Tone, for Manus marketing: drifting at the end of a tether is played as comic peril (tethered, unhurt).

## S10 · n928-n972 · 30.933-32.433 s · 45 f (1.500 s, 36 mf) · white status screen

- **hf01 (cuts S10 'card-creating-photos', SHOTS.md #10):** Loop 2 status in two voices: the agent's plan line + the tool line (Higgsfield generating). Who does what, without a voice-over.
- **Ours:** Manus says what P2 changes (the drift goes first); the Video Editor tool line shows the retime in progress.
- **In:** card-in at n928 (copy up 26.9 px/mf first step, r 0.76).
- **Out:** card-out-up at n973 (strong variant: the project window's first frame is a vertical smear).
- **Screen:** #F7F7F7 dot grid; mark line + tool line (kit).
- **Layout:** Line 1: mark hub (147.5, 277.5) [(262, 493)]; text x 199-470, cap top 264, baseline 299, Inter Medium ink, 'Drift' #33ABFB. Line 2: tool tile 55 px at 194-249 x 327-382 [345-443 x 581-679] with a film-frame line icon; text x 263-500, cap top 340, baseline 366; under it the progress hairline x 263-500, y 376.
- **Build:** Line 1 wipes n928-934 (~102 px/cf); 'Drift' settles to #33ABFB n934-940; the tool tile pops n934-949 from a dot (spring omega 23.2, zeta 0.58, peak 1.11); line 2 wipes n938-947, arriving pale grey #BDBDBD and settling to ink left to right n947-956 (no blue band); the 2 px #2CB4F3 hairline grows under it from n947 to ~60 % by n972 and never completes; exit up.
- **Camera (matches hf01):** House curve, c = 5.1 (T = 1.50 s).

**On screen (our copy)**

| Text | Chars | Visible | Legible | Words | Readable s | w/s | Where |
|---|---|---|---|---|---|---|---|
| Drift first. ('Drift' #33ABFB) | 12 | n928-n972 | n930 | 2 | 1.43 | 1.4 | status line 1 (Manus) |
| Half speed… | 11 | n938-n972 | n940 | 2 | 1.1 | 1.82 | tool line (Video Editor), in progress |

**Overlays and elements**

| Element | Box 1080x608 | [1920x1080] | Timing | Motion |
|---|---|---|---|---|
| Manus mark | 122-173 x 250-305 | 217-308 x 444-542 | n928-972 | Rides the plate; breathes. |
| Tool tile: white rounded square + #2CB4F3 film-frame line icon | 194-249 x 327-382 | 345-443 x 581-679 | pop n934-949 | Spring pop, blurred on its first 2 frames. |
| Progress hairline (2 px #2CB4F3, wordless) | 263-500 x 375-378 | 468-889 x 667-672 | n947-972 | Grows left to right to ~60 % and never completes on the card: an honest in-progress state. |

**Sound.** The score's next 808 note lands ~72 ms after the cut (no UI sound).

- Note: Two voices, as hf01: the mark = Manus planning; the tile = the Studio Video Editor doing. Manus stays honest and dry ('Drift first.'); the joke is that her near-miss is now simply shot one.
- **Check with Manus:** The Video Editor retiming her clip to half speed (F7/F9 cover making videos; the step itself is our depiction).

## S11 · n973-n993 · 32.433-33.133 s · 21 f (0.700 s, 17 mf) · editor screen

- **hf01 (cuts S11 'ae-project-panel', SHOTS.md #11):** A tidy project bin populates: professional organisation.
- **Ours:** The project bin fills with pictures: one folder, 'Spacewalk', holding her helmet-cam clips as thumbnails (the drift outlined blue, in use), and Marketing's interior photo of The Lull.
- **In:** card-out-up at n973 (snap-up smear: the toolbar streaked ~120 px).
- **Out:** zoom-out at n994 (the window shrinks with an expo build; the next frame starts at 116 %).
- **Framing (master editor):** centre (159, 192), scale 2.0: shows master x -111.0-429.0, y 40.0-344.0; the comp lands at screen 794-1810 x 22-594 [1412-3218 x 39-1056].
- **Screen:** The master editor at framing (159, 192, 2.0): the Project panel, the #F7F7F7 desktop visible at screen x 0-262.
- **Layout:** Window left edge x 262 [466]; tabs as icons and a search glyph; tree rows from y 112, pitch 44 px [78]: row 1 a folder chevron + folder icon + 'Spacewalk' set in Inter Regular (22 px on screen); rows 2-5 clip thumbnails (16:9, ~70 x 40 px on screen) with a clip glyph: the sunrise, the drift (2 px #33ABFB outline: in use), the bag floating in place, the wrench drifting away; row 6 an image glyph + a thumbnail of the Lull interior (Marketing's photo, A4); row 7 a sequence glyph + a tiny Lull mark. No file names, no greek bars.
- **Build:** Rows at n977 (folder), n979, n982, n983, n984 (clips), n987 (image), n990 (audio wave chip), n991 (sequence). Each thumbnail slides in from 12 px left over ~3 source frames; chevron and glyph arrive with it.
- **Camera (matches hf01):** hf01 S11 on top of the framing: snap-up (smear n973-974, then 38.6, 24.9, 18.4, 14.2, 10.8 px/mf, r 0.78); pull-out builds -0.4, -0.4, -0.4, -0.9, -0.9, -4.0 %/mf into the cut (n986-993); n993 smeared vertically.

**On screen (our copy)**

| Text | Chars | Visible | Legible | Words | Readable s | w/s | Where |
|---|---|---|---|---|---|---|---|
| Spacewalk | 9 | n977-n993 | n977 | 1 | 0.57 | 1.76 | folder row |

**Sound.** Groove A; a stutter mute ~33.24 s (n997) is musical gating.

- Note: hf01 shows 12 file names in 0.7 s; ours shows one word and pictures: the bin is literally her day (the wrench drifting away is in it, for the second viewing). Marketing's interior photo being here is why P4 can re-light it without new footage.
- **Check with Manus:** Her helmet-cam clips reaching the Video Editor project (nothing on screen says how they got there).

## S12 · n994-n1034 · 33.133-34.500 s · 41 f (1.367 s, 32 mf) · deliverable-in-viewer

- **hf01 (cuts S12 'ae-comp-board', SHOTS.md #12 + #13):** The generated brand sticker sheet (the asset kit) builds and the camera pans across it.
- **Ours:** Alchemy's direction board for the film, in the viewer: one sound rule in type ('No alarms.'), the palette, her sunrise, a slow lullaby wave; then row 2 with the drift (pending) and Marketing's interior photo as the end frame.
- **In:** zoom-out at n994 (cut frame at 116 %, blurred sigma ~5.5/2.4, settling r 0.73).
- **Out:** zoom-in-diag at n1035 (the fastest move in the film).
- **Framing (master editor):** centre (540, 194), scale 2.1: shows master x 282.9-797.1, y 49.2-338.8; the comp lands at screen 7-1073 x 4-604 [12-1908 x 7-1074].
- **Screen:** The master editor at framing (540, 194, 2.1): the viewer shows the Direction board (light, in The Lull's palette; not Manus's dark Alchemy UI).
- **Layout:** Board ground moon white #F4F1EA with white tiles (radius 14 [25], hairline #E2DED5); eyebrow 'Alchemy' (Inter Medium, grey) top-left. Row 1: the sound tile 'No alarms.' (Inter Semibold ~22 px [39] ink, a crossed-out bell line icon #2CB4F3); palette (four swatches: night navy, moon white, soft gold, lull red); a thumbnail of her sunrise (A1); a pace tile (one slow sine wave). Row 2 after the whip: the drift thumbnail with a dashed outline (pending: P2 just asked for it); a type tile (two short lines drawn as soft strokes in the ad face, no letters); an end-frame tile holding Marketing's interior photo of The Lull (A4) in its own neutral, cool-white light.
- **Build:** n997 the lull-red swatch flies in as a streak and pops (scale 0.62, 1.37, 1.37, 1.34, 1.04, 0.94, 0.94, 1.025, 1.02, 1.0) while the other three cut on; n998-1006 the sine wave draws left to right, linear (hf01's ray fan); n1008-1014 in-viewer whip to row 2; n1021-1022 the end-frame tile's corner handles (#33ABFB), ghost n1023, crisp n1024; n1027-1029 its dotted outline.
- **Camera (matches hf01):** hf01 S12 on top of the framing: pull-out settle 116 % -> 100 % (n994-1002, r 0.73); slow zoom-out s 1 -> 0.965 (n999-1007); in-viewer whip n1008-1014 (about -405, -327 px); hold; diagonal push build (+25, -17), (+48, -30), (+116, -71) px/mf with +1.0 / +1.9 / +5.0 %/mf into the cut (n1031-1033).

**On screen (our copy)**

| Text | Chars | Visible | Legible | Words | Readable s | w/s | Where |
|---|---|---|---|---|---|---|---|
| Alchemy | 7 | n994-n1034 | n998 | 1 | 1.23 | 0.81 | board eyebrow |
| No alarms. (ad) | 10 | n996-n1034 | n998 | 2 | 1.23 | 1.62 | row-1 sound tile |

**Overlays and elements**

| Element | Box 1080x608 | [1920x1080] | Timing | Motion |
|---|---|---|---|---|
| Cursor | 470-520 x 300-340 | 836-924 x 533-604 | n1003 | Points at the lull-red swatch as it pops; hops 18 px/f at n1033 with the push. |

**Sound.** Groove A.

- Note: Comedy: Alchemy's sound direction agrees with her: no alarms in the mix. (Callback to 'Alarms: muted', set-up for S20-S22.) It is a rule about the film's soundtrack, not about the station.
- Note: The end-frame tile shows A4 in neutral light: S23 shows the same photo after P4 re-lights it red, so the change is visible.
- Note: F8: Alchemy gives creative direction, including sound.
- **Check with Manus:** 'Alchemy' as a direction board in our editor (F8 covers creative direction; the UI is ours).
- **Check with Manus:** Tone, for Manus marketing: the alarm chain ('Alarms: muted' S07, 'No alarms.' S12, 'Mood lighting included.' S23) is the film's sound and light direction, written to her notes; none of it tells guests to ignore an alarm.

## S13 · n1035-n1102 · 34.500-36.767 s · 68 f (2.267 s, 55 mf) · editor screen + deliverable-in-viewer

- **hf01 (cuts S13 'ae-timeline-mascot', SHOTS.md #14):** Keyframes pop on the timeline: the assets get animated.
- **Ours:** EARLY PAYOFF 1: speed keyframes pop on the 'Drift' layer and the drift plays in the viewer at half speed under 'Breathe easy.' Her scariest moment, now a spa ad.
- **In:** zoom-in-diag at n1035 (cut frame at 86.6 % scale, smeared sigma_x ~120; snappy ease-out r ~0.35).
- **Out:** cut at n1103 to the debris shower.
- **Framing (master editor):** centre (600, 360), scale 1.3: shows master x 184.6-1015.4, y 126.2-593.8; the comp lands at screen 132-792 x -98-274 [235-1408 x -174-487].
- **Screen:** The master editor at framing (600, 360, 1.3): the timeline with the viewer strip on top (hf01's S13 layout).
- **Layout:** 'Drift' now the first row, made and selected (#33ABFB outline), its property row 'Speed' open; the viewer across the top third showing the drift (A2); playhead a moving blue line (no timecode text).
- **Build:** Keyframe diamonds pop on 'Speed' n1062-1078 (count 2, 3, 5, 7, 8, 9, 10, 11), each 1.40 -> 1.10 -> 1.02 -> 1.00 over 3 f (spring zeta 0.28); the track drifts left ~1.5 px/f. n1063-1086 the viewer plays the drift at half speed with 'Breathe easy.' over it; the playhead moves (the first time anything plays in the film).
- **Camera (matches hf01):** hf01 S13 on top of the framing: diagonal push decay (r 0.35, n1036-1042); screen whip left n1043-1062 (~590 px, peak 186 px/mf at n1053) to the property rows; slow drift -1.8 px/mf (n1063-1080); whip right n1087-1097 (~135 px, peak ~65 px/mf) back toward the viewer; hold.

**On screen (our copy)**

| Text | Chars | Visible | Legible | Words | Readable s | w/s | Where |
|---|---|---|---|---|---|---|---|
| Drift | 5 | n1035-n1102 | n1040 | 1 | 2.1 | 0.48 | layer name (selected) |
| Speed | 5 | n1043-n1102 | n1045 | 1 | 1.93 | 0.52 | property row |
| Breathe easy. (ad) | 13 | n1063-n1086 | n1063 | 2 | 0.8 | 2.5 | the film's opening super, playing in the viewer |

**Sound.** Groove A; a stutter mute 35.74-36.30 s (n1072-1089). Under the viewer playback, a felt-piano lullaby phrase (the film's own music, faint) for its 0.8 s.

- Note: Early payoff 1 (hf01's viewer plays its sticker comp for only n1081-1086; ours plays n1063-1086).

## S14 · n1103-n1233 · 36.767-41.133 s · 131 f (4.367 s, 105 mf) · overlay-on-footage

- **hf01 (cuts S14 'bridge-wide-to-face', SHOTS.md #15):** Loop 3 peril + prompt 3: the rope bridge with monkeys behind; the send rides a crash zoom to his shout ('The easy route!').
- **Ours:** Night side, the film's poster frame: green aurora curtains rippling below, a solar storm arriving (sparkle on the lens, her helmet's caution lamp pulsing), and a debris shower streaking past and pinpricking the solar array as she hauls herself hand over hand along the truss. She taps: call it shooting stars. Crash zoom to her face: a delighted shout, 'Wish fast!'
- **In:** cut at n1103 (the live side opens trucking at ~13 px/mf).
- **Out:** cut at n1234 to the gloves on the handrail.
- **Subject:** The astronaut on the truss at night, small against a long run of the station (the truss receding, a solar array behind her); a field of tiny bright debris streaks overtaking her from the left (the chaser: hf01's monkeys); below, Earth's night side under rippling green aurora curtains and amber city lights.
- **Action:** She hauls herself left to right along a white truss handrail, hand over hand, typing one-handed between grabs (n1141-1163); bright debris streaks cross the frame behind her and a few pinprick hits sparkle on the array; at n1182 she ducks as a cluster streaks just past; crash zoom: MCU profile, mouth wide open in a delighted shout, eyebrows up, debris glints and aurora light sliding across the helmet bubble, surging with each pull (n1200-1233).
- **Framing:** Wide (the station, the aurora, her small on the rail) -> crash push to an MCU profile.
- **Lens:** ~28 mm wide; very shallow focus in the MCU (background a black-blue-green blur with glint bokeh).
- **Light:** R3: station floodlights and her helmet lamps; the aurora's green from below; debris streaks the hardest highlights; true blacks. Comp adds the storm: sensor sparkle (20 -> 120 single-pixel white hits per frame, never on her face) and the helmet caution lamp pulsing amber at ~2 Hz.
- **Camera (matches hf01):** hf01 S14: truck with her, content left ~9 px/mf (13 -> 3), slow push +0.54 %/mf n1104-1181 (x1.40, the suit held at x ~360-440); crash push-in n1182-1208 (+1.7 -> +13.5 %/mf, x5.6 in 23 mf); a surging bob in the MCU (y p2p ~80 px at ~3.4 Hz, x ~50 px) n1209-1233: each hand-over-hand pull.

**On screen (our copy)**

| Text | Chars | Visible | Legible | Words | Readable s | w/s | Where |
|---|---|---|---|---|---|---|---|
| Call it shooting stars. | 23 | n1144-n1190 | n1144 | 4 | 1.57 | 2.55 | prompt bar 3 (P3) |
| Wish fast! | 10 | n1188-n1225 | n1192 | 2 | 1.13 | 1.76 | floating shout, two lines 'Wish' / 'fast!' |

**Overlays and elements**

| Element | Box 1080x608 | [1920x1080] | Timing | Motion |
|---|---|---|---|---|
| Prompt bar 3 (our bar) with the live helmet-cam thumbnail chip and the signal glyph at two bars | 526-1011 x 364-487 | 935-1797 x 647-866 | first faint n1140, full n1143, settled n1155; typing n1144-1158; chip n1160; press n1177-1181 (glow peak n1181); sweep n1182-1189; collapse n1184-1191 | Types ~1.6 chars/cf; send disc centre (973.5, 453) [(1731, 805)]. Collapses in shot as the camera crashes in: width 472 -> 452 -> 422 -> 378 -> 312 -> 215 (n1189), height 123 -> 96 -> 85 -> 75 -> 48, centre fixed at x ~770, glass fading; gone n1191. |
| Floating shout 'Wish' / 'fast!' (white Inter Semibold, soft dark halo; zero-G turn) | 800-1010 x 150-235 | 1422-1796 x 267-418 | 'Wish' n1188-1209 (sharpest n1197); 'fast!' n1201-1229 (sharpest n1209-1215); read as one phrase n1192-1225 | Rack-focus passes on a layer drifting (+10.2, -3.5) px/cf, upper right as the crash zoom lands on her face. |
| Storm grade layers (comp): sensor sparkle + helmet caution lamp | 0-1080 x 0-608 | 0-1920 x 0-1081 | sparkle n1103-1233 (20 hits/f rising to 120 by n1180, thinning in the MCU); caution lamp n1120-1233 (~2 Hz) | Single-pixel white hits, 1-2 frames each, random, never on her face; the lamp an amber glow on the helmet rim and the bubble's inner edge. |

**Sound.** On the cut: the bed thins to her quick breathing and the suit's fans; a dosimeter's soft clicks inside the helmet, quickening (the storm arriving); tiny high ticks in the score for the streaks (space is silent, so the debris is scored, not heard); send puff n1185 riding the crash zoom; under 'Wish fast!' a breathy laugh of effort (breath only, no words).

**Generation plan.**

| Leg | Key still at | sec | Use | Join |
|---|---|---|---|---|
| 14A | n1103 | 5 | n1103-n1196 (3.13 s) | ends inside the crash-zoom blur n1192-1200; 14B starts there |
| 14B (identity key) | n1192 | 5 | n1192-n1233 (1.4 s) | - |

*Leg 14A, key still (16:9, the leg's first frame n1103):*

> Cinematic 28mm film still, wide shot in orbit on the night side: an East Asian woman of about 40 with light warm skin, strong expressive dark eyebrows with a small pale scar through the left brow, dark brown eyes and faint laugh lines, wearing a black fabric comms cap with small ear cups inside a clear bubble helmet whose gold sun visor is raised so her whole face is visible, two small lamps at the helmet's temples and a small camera on its right side, and a fictional white spacesuit of matte multi-layer fabric with a hard upper torso, saturated signal-orange bands around both upper arms and both thighs, an orange helmet neck ring, white gloves with orange fingertip grips, a slim dark wrist display under a padded white cover strapped over the left forearm, an embroidered round mission patch on the left shoulder (navy twill, gold border, a crescent cradling a small circle and three stars, no lettering) and a white life-support backpack. She hauls herself left to right along a white handrail on the open lattice truss of a fictional orbital station of white modules wrapped in matte white and pale-gold insulation blankets, a long open lattice truss with white handrails and blue-black solar arrays, the truss receding far behind her, lit by the station's floodlights and her helmet lamps; behind her a large dark solar array; a field of tiny bright debris streaks crosses the black sky diagonally behind her, a few pinpoint sparkles of impacts on the array; below, Earth's night side under rippling green aurora curtains, amber city lights beneath them. 28mm, deep focus. Unbranded and fictional: no logos, no flags, no name tags and no lettering anywhere on the station, suit or capsule. Photoreal cinematic film still, natural skin texture, visible film grain, slightly soft, unretouched, not a stock photo, true blacks, no flags, no insignia, no text, no logos, no watermark.

*Leg 14A, motion (image-to-video, --sec 5):*

> The camera trucks right alongside her, slowly pushing in, as she pulls herself along the handrail hand over hand and taps the wrist display between grabs; bright debris streaks overtake her from behind and a few sparkle against the array; the aurora ripples below; at the end she ducks and the camera starts to rush in toward her face. The wrist display glows softly but its screen is never readable. Weightless, real-time, natural motion. Keep the lighting, colours, depth of field and film grain of the first frame. No text, no captions, no logos.

*Leg 14B (identity key), key still (16:9, the leg's first frame n1192):*

> Cinematic 85mm film still, profile medium close-up in orbit at night: an East Asian woman of about 40 with light warm skin, strong expressive dark eyebrows with a small pale scar through the left brow, dark brown eyes and faint laugh lines, wearing a black fabric comms cap with small ear cups inside a clear bubble helmet whose gold sun visor is raised so her whole face is visible, two small lamps at the helmet's temples and a small camera on its right side, and a fictional white spacesuit of matte multi-layer fabric with a hard upper torso, saturated signal-orange bands around both upper arms and both thighs, an orange helmet neck ring, white gloves with orange fingertip grips, a slim dark wrist display under a padded white cover strapped over the left forearm, an embroidered round mission patch on the left shoulder (navy twill, gold border, a crescent cradling a small circle and three stars, no lettering) and a white life-support backpack. Mouth wide open in a delighted shout, eyebrows up, eyes bright, her face lit by the helmet lamps and a soft green glow from below, tiny glints of light sliding across the clear helmet bubble; the background a soft black-blue-green blur with points of bokeh. 85mm, very shallow depth of field, slight motion blur. Photoreal cinematic film still, natural skin texture, visible film grain, slightly soft, unretouched, not a stock photo, true blacks, no flags, no insignia, no text, no logos, no watermark.

*Leg 14B (identity key), motion (image-to-video, --sec 5):*

> Handheld feel: the camera moves with her as she surges forward with each pull along the rail, shouting happily; glints streak across the background blur. Weightless, real-time, natural motion. Keep the lighting, colours, depth of field and film grain of the first frame. No text, no captions, no logos.

- Note: Comedy: under fire she is delighted, and her shout is the logic of her own note (shooting stars, so make a wish, and fast). The ad answers it in S17 with 'Wish slowly.'
- Note: The poster frame of the film (the excitement judge's graft): aurora + debris + the storm's sparkle + the caution lamp, at no reading cost. The light events (sparkle, lamp) are comp layers, so the plate only needs the scene.
- Note: hf01's monkeys become debris: a chaser that is pure light (AI-friendly) and that the film can recast. The aurora is the solar storm made visible; it sets up loop 4's radiation alarm.
- Note: Escalation 3.
- **Check with Manus:** A follow-up prompt recasting a shot in a running Video Editor job (near PITCH 'Do not state'; ours is mid-job).

## S15 · n1234-n1256 · 41.133-41.900 s · 23 f (0.767 s, 18 mf) · footage

- **hf01 (cuts S15 'bridge-feet', SHOTS.md #16):** Insert: feet on the bridge planks; a kinetic link into the card.
- **Ours:** Low tracking close-up: her gloves grabbing rail after rail at speed, debris glints streaking past.
- **In:** cut at n1234.
- **Out:** card-in at n1257 out of the fast blurred move.
- **Subject:** Her gloves (orange fingertip grips), the white handrail, the orange arm band entering frame.
- **Action:** Hand over hand, fast; glints streak past behind; the camera whips left at the end.
- **Framing:** CU along the rail, tracking.
- **Lens:** ~24 mm, heavy motion blur.
- **Light:** R3.
- **Camera (matches hf01):** hf01 S15: low tracking, subject motion blur; ends on a fast move (~40-53 px/mf, n1254-1256).

**On screen:** nothing.

**Sound.** Glove-on-rail thumps carried through the suit; breath; the score's 808 lands n1261 on the card.

**Generation plan.**

| Leg | Key still at | sec | Use | Join |
|---|---|---|---|---|
| 15 | n1234 | 5 | n1234-n1256 (0.77 s) | - |

*Leg 15, key still (16:9, the leg's first frame n1234):*

> Cinematic 24mm film still, tracking close-up along a white space-station handrail at night: two white spacesuit gloves with orange fingertip grips grabbing the rail hand over hand at speed, an orange arm band at the edge of frame, bright debris streaks blurred in the black behind, floodlight glare. Heavy motion blur. Photoreal cinematic film still, natural skin texture, visible film grain, slightly soft, unretouched, not a stock photo, true blacks, no flags, no insignia, no text, no logos, no watermark.

*Leg 15, motion (image-to-video, --sec 5):*

> The camera races along the rail beside the gloves as they grab hand over hand; at the very end the camera whips quickly to the left. Weightless, real-time, natural motion. Keep the lighting, colours, depth of field and film grain of the first frame. No text, no captions, no logos.

- Note: Hands, broad grabs only (no fine finger work).

## S16 · n1257-n1293 · 41.900-43.133 s · 37 f (1.233 s, 30 mf) · white status screen

- **hf01 (cuts S16 'card-mapped', SHOTS.md #17):** Loop 3 status: a one-sentence summary of the result, with its key facts.
- **Ours:** Manus reports the edit in two words, like a changelog.
- **In:** card-in at n1257 (entry 20.2 px/mf, r 0.76).
- **Out:** card-out-up at n1294 (velocity-matched: the viewer arrives at 18.0 px/mf up).
- **Screen:** #F7F7F7 dot grid; the mark + one line.
- **Layout:** The group is centred: mark hub (385.5, 290), ~43 px; text x 435-695, ~40 px [71] Inter Medium ink, a thin ink arrow between the words, 'stars.' #33ABFB.
- **Build:** Wipe n1258-1264 (~135 px/cf); a stronger shimmer n1268-1277; clear by n1278; exit up.
- **Camera (matches hf01):** House curve, c = -0.4.

**On screen (our copy)**

| Text | Chars | Visible | Legible | Words | Readable s | w/s | Where |
|---|---|---|---|---|---|---|---|
| Debris → stars. ('stars.' #33ABFB) | 15 | n1258-n1293 | n1260 | 2 | 1.13 | 1.76 | status line (Manus) |

**Overlays and elements**

| Element | Box 1080x608 | [1920x1080] | Timing | Motion |
|---|---|---|---|---|
| Manus mark | 364-407 x 267-313 | 647-724 x 475-556 | n1257-1293 | Rides the plate; breathes. |

**Sound.** Groove A; 808 notes ~n1261 and ~n1277.

- Note: Honest and dry: the agent reports exactly what it did. The result is shown 1 s later (S17).

## S17 · n1294-n1361 · 43.133-45.400 s · 68 f (2.267 s, 54 mf) · deliverable-in-viewer + editor screen

- **hf01 (cuts S17 'ae-island-map', SHOTS.md #18):** The island map builds in the comp (a click places a building, a sign is drag-resized, the title types).
- **Ours:** EARLY PAYOFF 2: her debris clip, slowed to quarter speed and graded warm, plays as soft shooting stars over the aurora, and the super answers her shout: 'Wish slowly.'
- **In:** card-out-up at n1294 (velocity-matched slide up).
- **Out:** card-in at n1362 (the viewer accelerates up x1.78/mf into the card).
- **Framing (master editor):** centre (548, 230), scale 1.55: shows master x 199.6-896.4, y 33.9-426.1; the comp lands at screen 134-921 x 27-470 [238-1637 x 48-836].
- **Screen:** The master editor at framing (548, 230, 1.55).
- **Layout:** Viewer x 119-937, y 16-481 (~76 % of the frame): the stars shot (A3) playing, The Lull's corner bug, the super lower-left. Transport a play glyph and scrub bar. Timeline strip at the bottom: the playhead moving; 'Stars' bar made and selected (#33ABFB outline).
- **Build:** Plays in real time n1294-1361; the super 'Wish slowly.' fades up n1318-1324 (the ad's 0:10 super; Jost Regular moon white) and holds. Cursor: n1316 clicks the 'Stars' bar; n1335-1342 drags its in-point onto the brightest streak (a 67 px trim drag, cubic-bezier(0.63, 0.51, 0.19, 1.07)).
- **Camera (matches hf01):** hf01 S17 on top of the framing: enters sliding up (18 -> 2.5 px/mf); bell re-frames: pan left peak -24 px/mf with +2 %/mf push (n1312), pan right +34.4 px/mf (n1329), up-left (-10, -16) (n1344); exit ease-in up into the card (-0.1 -> -12.4 px/mf, x1.78/mf, n1351-1361).

**On screen (our copy)**

| Text | Chars | Visible | Legible | Words | Readable s | w/s | Where |
|---|---|---|---|---|---|---|---|
| Stars | 5 | n1294-n1361 | n1296 | 1 | 2.2 | 0.45 | layer name (selected) |
| Wish slowly. (ad) | 12 | n1318-n1361 | n1324 | 2 | 1.27 | 1.58 | the film's 0:10 super, playing |

**Overlays and elements**

| Element | Box 1080x608 | [1920x1080] | Timing | Motion |
|---|---|---|---|---|
| Cursor | 560-700 x 470-520 | 996-1244 x 836-924 | n1316 click; n1335-1342 drag; n1344 hold | Drift-hop-hold; the trim handle follows it during the drag. |

**Sound.** Groove A; a celesta sparkle on each streak in the viewer (the film's own sound, faint).

- Note: Early payoff 2: the danger from 5 s ago, now the prettiest shot in the film. The edit is ordinary editing (speed and a warm grade), not a restyle.
- **Check with Manus:** The Video Editor slowing and re-grading her debris clip (our depiction of an edit; F7 covers making videos).

## S18 · n1362-n1398 · 45.400-46.633 s · 37 f (1.233 s, 30 mf) · white status screen

- **hf01 (cuts S18 'card-generating-photos', SHOTS.md #19):** Tool line only: generating photos for the map.
- **Ours:** Alchemy's sound pick for the spa film, in progress: whale song. In space.
- **In:** card-in at n1362 (only the tile on the first frames).
- **Out:** card-out-up at n1399 (soft: the infographic drifts up 2.0, 1.8, 1.3, 0.9 px/mf).
- **Screen:** #F7F7F7 dot grid; the tool tile + one line.
- **Layout:** Tile 55 px at 182-237 x 275-329 [324-421 x 489-585] with a sound-wave line icon; text x 255-640, cap top 289, baseline 319, ~41 px [73]; 'whale' #33ABFB; the progress hairline x 255-640, y 330.
- **Build:** Cuts to the card with only the tile popping (n1362-1376, spring); the line slides in from n1365 (11.1, 8.4, 6.6, 5.1 px/mf, r 0.78) and wipes n1365-1371, arriving pale grey and settling to ink n1374-1384 while 'whale' settles to #33ABFB; the hairline grows from n1376 to ~70 % and never completes; exit up.
- **Camera (matches hf01):** House curve, c = -7.9.

**On screen (our copy)**

| Text | Chars | Visible | Legible | Words | Readable s | w/s | Where |
|---|---|---|---|---|---|---|---|
| Adding whale song… ('whale' #33ABFB) | 18 | n1365-n1398 | n1367 | 3 | 1.07 | 2.81 | tool line (Alchemy's sound direction), in progress |

**Overlays and elements**

| Element | Box 1080x608 | [1920x1080] | Timing | Motion |
|---|---|---|---|---|
| Tool tile (sound-wave icon) | 182-237 x 275-329 | 324-421 x 489-585 | n1362-1376 | Spring pop from a dot. |
| Progress hairline (2 px #2CB4F3, wordless) | 255-640 x 329-332 | 453-1138 x 585-590 | n1376-1398 | Grows to ~70 % and never completes on the card. |

**Sound.** Groove A; the card's 808 lands ~83 ms before the cut; one low, soft whale call in F under the card (the joke made audible; it becomes the film's 0:05 bed).

- Note: Comedy: the spa-ad cliché taken to orbit. It also plants the ending: whales, the sea, 'Undersea next?'.
- **Check with Manus:** Alchemy picking a sound cue (F8 covers sound direction; the UI and the pick are our depiction).

## S19 · n1399-n1486 · 46.633-49.567 s · 88 f (2.933 s, 70 mf) · deliverable-in-viewer

- **hf01 (cuts S19 'ae-trail-map', SHOTS.md #20):** The trail infographic: pins and labels drawn, photo cards pop one by one with pixel reveals, a rules box: the most information-dense deliverable.
- **Ours:** The film's 0:15 guest map: an isometric line drawing of the whole station with her route of the day, photo cards popping on its pins (sunrise, drift, stars), dashed pins still waiting at the airlock and at the docked capsule, a strip of 16 tiny suns, and a rules box with one deadpan bullet: 'Loose items leave.'
- **In:** card-out-up at n1399 (soft drift up).
- **Out:** cut at n1487 to the airlock (she is already tumbling).
- **Framing (master editor):** centre (568, 198), scale 1.74: shows master x 257.7-878.3, y 23.3-372.7; the comp lands at screen 49-933 x 48-546 [87-1659 x 85-971].
- **Screen:** The master editor at framing (568, 198, 1.74): the comp at screen x 49-933, y 48-546 (hf01: x 50-935, y 50-548).
- **Layout:** Night-navy ground with faint star specks. Centre-left: an isometric moon-white line drawing of the whole station (truss, modules, arrays), The Lull module filled soft gold, the docked capsule drawn at its port; a dotted soft-gold route line of her day along the truss with five round pins: three filled (the Lull hull: sunrise; the truss end: drift; the night-side truss: stars) and two dashed (the airlock; the capsule): what P4 and P5 will fill. Three photo cards (16:9, ~115 x 64 px, rounded, 2 px moon-white frames) on gold leader lines from the filled pins: sunrise (A1), drift (A2), stars (A3). Top-left: the title 'ONE ORBIT' (tracked light caps, soft gold, ~20 px cap [36]) and a moon-white chip '90 MIN'. Along the bottom: a strip of 16 tiny sun icons (16 sunrises a day: 'Sunrise. Again.' as data). Right: a rules box (1 px moon-white border, an info line icon) with one bullet.
- **Build:** Station drawing, route, title, chip and sun strip are drawn at n1399 (as hf01's base map). Card recipe: marquee (#33ABFB dotted) -> ghost outline 1 f at 1.15x -> crisp frame -> seed spark -> reveal ring 6-8 f -> glow fades. Sunrise marquee n1407, crisp n1411, ring n1413-1416, done n1418; drift n1414 / n1416 / n1422-1428 / n1428; stars n1421 / n1426 / n1428-1434 / n1435; dashed pins pulse once at n1437 (airlock) and n1447 (capsule); the rules box pops n1448-1451, its bullet types n1449-1452.
- **Camera (matches hf01):** hf01 S19 on top of the framing: settle dy 7.7 -> 0 (n1399-1411); push 1 -> 1.088 + pan 78 px (peak 36.5 px/f, n1417); push to 1.164 + tilt 36 px (n1424-1437); pan left 128 px (peak 49 px/f at n1444, blurred); zoom-out 1.18 -> 1.00 + tilt (peak -5.7 %/f at n1462); pan right 51 px (n1468-1480); settles to 0.3 px/mf.

**On screen (our copy)**

| Text | Chars | Visible | Legible | Words | Readable s | w/s | Where |
|---|---|---|---|---|---|---|---|
| ONE ORBIT (ad) | 9 | n1399-n1486 | n1401 | 2 | 2.87 | 0.7 | infographic title |
| 90 MIN (ad) | 6 | n1399-n1486 | n1401 | 2 | 2.87 | 0.7 | chip |
| Loose items leave. (ad) | 18 | n1449-n1486 | n1452 | 3 | 1.17 | 2.57 | rules box, one bullet |

**Overlays and elements**

| Element | Box 1080x608 | [1920x1080] | Timing | Motion |
|---|---|---|---|---|
| Cursor | 130-620 x 80-470 | 231-1102 x 142-836 | marquees at n1407, n1414, n1421; hop 40 px/f at n1449 | Drift-hop-hold to each card. |

**Sound.** The break: low end out 117 ms after the card-out (n1402.5); hats and clicks continue; two 808 hits (~n1426, ~n1440); low end returns ~n1467.

- Note: hf01's map job and hf01's map look in one (the fidelity judge's graft): a piece of her film (its 0:15 slot), drawn as a route map of her day. Rich in pictures, light in words (7 words in 2.9 s; hf01's map has 40+ strings).
- Note: Comedy: the infographic is earnest except for one bullet, as hf01 hides 'Don't feed the macaws'. 'Loose items leave.' is a real zero-G rule, and the wrench that left her glove at 09:12 is about to break it (S21-S22).
- Note: The two dashed pins plant loops 4 and 5: the airlock and the capsule.

## S20 · n1487-n1522 · 49.567-50.767 s · 36 f (1.200 s, 29 mf) · footage

- **hf01 (cuts S20 'wall-collapse', SHOTS.md #21):** Loop 4 peril begins: he tumbles against a carved ruin wall and lands seated.
- **Ours:** The storm drives her inside: she comes through the airlock's round outer hatch in a slow tumble, bumps the far wall and fetches up curled against the inner hatch. The outer hatch will not close: her own tether is caught across its seal. The radiation alarm starts to pulse red.
- **In:** cut at n1487 (she is already tumbling).
- **Out:** cut at n1523 to the flying wrench.
- **Subject:** The astronaut; a cramped white cylindrical airlock; the round outer hatch stuck half-closed behind her on her own orange tether, the sun's hard white glare outside.
- **Action:** She drifts in mid-turn (already inside on the first frame), bumps the far wall with her shoulder and settles curled up, knees to chest, against the inner hatch; behind her the outer hatch sits half-closed on the tether lying across its seal.
- **Framing:** Medium shot, handheld.
- **Lens:** ~24 mm (it is a small room).
- **Light:** R4: steady cool white panel light in the plate; the red radiation-alarm pulse is a comp grade from ~n1505 (~1 Hz); the sun's glare through the hatch.
- **Camera (matches hf01):** hf01 S20: handheld while she settles; drift right ~4.6 px/mf; shake rms ~6.3/3.9 px.

**On screen:** nothing.

**Sound.** A muffled thump through the suit as she hits the wall (pre-lapped 0.22 s, n1480.5, like hf01's tumble whoosh), her grunt-breath; the dosimeter's clicks inside the helmet now fast; the alarm pulse is scored as a soft low beep in key (in-suit radio); the groove's bar 18 returns +193 ms after the cut.

**Generation plan.**

| Leg | Key still at | sec | Use | Join |
|---|---|---|---|---|
| 20 | n1487 | 5 | n1487-n1522 (1.2 s) | - |

*Leg 20, key still (16:9, the leg's first frame n1487):*

> Cinematic 24mm film still inside a cramped white cylindrical spacecraft airlock: an East Asian woman of about 40 with light warm skin, strong expressive dark eyebrows with a small pale scar through the left brow, dark brown eyes and faint laugh lines, wearing a black fabric comms cap with small ear cups inside a clear bubble helmet whose gold sun visor is raised so her whole face is visible, two small lamps at the helmet's temples and a small camera on its right side, and a fictional white spacesuit of matte multi-layer fabric with a hard upper torso, saturated signal-orange bands around both upper arms and both thighs, an orange helmet neck ring, white gloves with orange fingertip grips, a slim dark wrist display under a padded white cover strapped over the left forearm, an embroidered round mission patch on the left shoulder (navy twill, gold border, a crescent cradling a small circle and three stars, no lettering) and a white life-support backpack. She is already inside, turning slowly in mid-air in three-quarter profile, her face visible through the bubble, a shoulder about to touch the padded far wall; behind her a round outer hatch stands half-closed on an orange tether lying across its seal, hard white sunlight glaring through the gap; white padded walls with handholds, steady cool white panel light. 24mm, handheld. Unbranded and fictional: no logos, no flags, no name tags and no lettering anywhere on the station, suit or capsule. Photoreal cinematic film still, natural skin texture, visible film grain, slightly soft, unretouched, not a stock photo, true blacks, no flags, no insignia, no text, no logos, no watermark.

*Leg 20, motion (image-to-video, --sec 5):*

> Handheld camera drifts right as she finishes a slow half-turn, bumps her shoulder against the padded wall and settles curled up, knees to chest, against the closed inner hatch. The light stays steady and cool. Weightless, real-time, natural motion. Keep the lighting, colours, depth of field and film grain of the first frame. No text, no captions, no logos.

- Note: Escalation 4, worse than loop 3: the storm means she must get in, the hatch means she cannot seal it, and the next shot is a projectile. Trapped, irradiated, nearly hit.
- Note: Cheaper than the draft's somersault: she is inside on the key still and only finishes a half-turn (one body move in 1.2 s). The tether across the seal is a background detail, never explained.
- Note: The red pulse is a grade layer in comp (the fidelity judge's graft): the plate asks for the room only.

## S21 · n1523-n1530 · 50.767-51.033 s · 8 f (0.267 s, 6 mf) · footage

- **hf01 (cuts S21 'arrow-flight', SHOTS.md #22):** 0.27 s arrow-in-flight macro: the fastest shot, pure danger.
- **Ours:** Macro tracking: a small silver wrench tumbling end over end through the gap of the outer hatch into the red-lit airlock: the one that left her glove at 09:12, come back around.
- **In:** cut at n1523.
- **Out:** whip at n1531 (the wrench's direction of travel is kept).
- **Subject:** A small silver wrench in flight, alone in frame.
- **Action:** It tumbles right to left; the background is a red-white horizontal streak.
- **Framing:** ECU, the wrench held at x 140-240, y 220-270.
- **Lens:** ~100 mm macro tracking.
- **Light:** Darkening into the cut (luma ~72 -> 36 over n1526-1530) as a red pulse fades (comp).
- **Camera (matches hf01):** hf01 S21: locked on the object, growing ~+2 %/mf; background blur ~100-370 px.

**On screen:** nothing.

**Sound.** A rising whoosh-whir of the spinning wrench (scored, starting 0.40 s before the cut at n1511), peaking 0.11 s before n1531.

**Generation plan.**

| Leg | Key still at | sec | Use | Join |
|---|---|---|---|---|
| 21 | n1523 | 5 | n1523-n1530 (0.27 s) | - |

*Leg 21, key still (16:9, the leg's first frame n1523):*

> Extreme close-up macro tracking still: a small silver wrench tumbling end over end through the air, sharp in the middle of the frame, cool light glinting on its steel; the background a horizontal streak of white padded wall and light blurred into lines. 100mm macro. Visible film grain, realistic, no text, no logos, no watermark.

*Leg 21, motion (image-to-video, --sec 5):*

> The camera races alongside the tumbling wrench from right to left, locked on it; the background is a pure streak of motion blur and grows darker. Weightless, real-time, natural motion. Keep the lighting, colours, depth of field and film grain of the first frame. No text, no captions, no logos.

- Note: 8 frames inside heavy blur: the most forgiving kind of AI object shot. The wrench is the one from S01; objects lost on a spacewalk stay in nearly the same orbit, so 'it came back around' is the heightened version of a real thing.
- Note: Fallback (saves the leg, $0.80 a take): a 3D-rendered wrench sprite over a streaked plate, tinted red in comp.

## S22 · n1531-n1650 · 51.033-55.033 s · 120 f (4.000 s, 96 mf) · overlay-on-footage

- **hf01 (cuts S22 'arrow-in-wall-laptop-prompt', SHOTS.md #23):** The arrow lands just above his head; unflappable, he opens the laptop and types prompt 4 (sent n1641).
- **Ours:** The wrench clangs off the hatch rim an inch above her helmet and spins away. The radiation alarm pulses red across her face. She watches the wrench go, one long blink, then calmly lifts her wrist: red alarm? Mood lighting.
- **In:** whip at n1531 (first frame mid-whip: the wrench streaks across the top third, hatch and suit smeared horizontally).
- **Out:** cut at n1651 to the empty end-frame comp.
- **Subject:** The astronaut curled against the inner hatch, helmet against the rim; the wrench; the red alarm (comp).
- **Action:** The wrench bounces off the hatch rim just above her helmet (on the whip frames) and spins slowly away into the room (n1531-1545); she follows it with her eyes only, deadpan (n1539-1580); a long blink; she lifts her left forearm and taps the wrist display, composed (n1590-1650).
- **Framing:** MCU, her helmet left of centre, the hatch rim above it; the bar bottom-left over her suit.
- **Lens:** ~50 mm.
- **Light:** R4: steady cool white panel light in the plate; the red alarm pulse at ~1 Hz is a comp grade across everything, her face lit red on each pulse (highlights R-B to ~+60).
- **Camera (matches hf01):** hf01 S22: whip-in snap stop (offset -84 -> -17 -> -4 -> 0 px, n1532-1538; the whip is digital); then static 0.4-1.6 px/mf; still camera n1601-1650.

**On screen (our copy)**

| Text | Chars | Visible | Legible | Words | Readable s | w/s | Where |
|---|---|---|---|---|---|---|---|
| Red alarm? Mood lighting. | 25 | n1608-n1650 | n1609 | 4 | 1.4 | 2.86 | prompt bar 4 (P4) |

**Overlays and elements**

| Element | Box 1080x608 | [1920x1080] | Timing | Motion |
|---|---|---|---|---|
| Prompt bar 4 (our bar; signal glyph at two bars) | 85-555 x 402-527 | 151-987 x 715-937 | first faint n1605, full n1608, settled n1620; typing n1609-1621; press n1638-1641 (glow peak n1641); sweep n1643-1650; cut n1651 | Types ~2 chars/cf; send disc centre (513.5, 487.5) [(913, 867)]. The red pulse plays over the frosted bar too (the plate shows through). |
| Red alarm grade (comp) | 0-1080 x 0-608 | 0-1920 x 0-1081 | n1531-1650, ~1 Hz (peaks ~n1540, 1569, 1598, 1627) | A soft red wash on the highlights, rising over 6 f and falling over 18 f each cycle; the plate underneath stays steady. |

**Sound.** The knock: a hard metallic hit carried through her helmet (a contact sound, muffled but sharp: the vacuum rule still holds), 28 ms (0.9 f) before n1531, the score's sub boom under it; the wrench's faint ring through the rim as it spins off; the alarm beep and the dosimeter continue, scored; a mini-break 52.49-53.43 s, the score re-entering with a noise swell ~4 f before the bar arrives (~n1602); send puff n1640-1650; an 808 pickup into the drop.

**Generation plan.**

| Leg | Key still at | sec | Use | Join |
|---|---|---|---|---|
| 22 (identity key) | n1531 | 5 | n1531-n1650 (4.0 s) | - |

*Leg 22 (identity key), key still (16:9, the leg's first frame n1531):*

> Cinematic 50mm film still, medium close-up inside a cramped white airlock: an East Asian woman of about 40 with light warm skin, strong expressive dark eyebrows with a small pale scar through the left brow, dark brown eyes and faint laugh lines, wearing a black fabric comms cap with small ear cups inside a clear bubble helmet whose gold sun visor is raised so her whole face is visible, two small lamps at the helmet's temples and a small camera on its right side, and a fictional white spacesuit of matte multi-layer fabric with a hard upper torso, saturated signal-orange bands around both upper arms and both thighs, an orange helmet neck ring, white gloves with orange fingertip grips, a slim dark wrist display under a padded white cover strapped over the left forearm, an embroidered round mission patch on the left shoulder (navy twill, gold border, a crescent cradling a small circle and three stars, no lettering) and a white life-support backpack. She sits curled against a closed round inner hatch, her helmet just below its metal rim; a small silver wrench is bouncing off the rim just above her helmet; steady cool white panel light on the white padded walls and her face. 50mm. Unbranded and fictional: no logos, no flags, no name tags and no lettering anywhere on the station, suit or capsule. Photoreal cinematic film still, natural skin texture, visible film grain, slightly soft, unretouched, not a stock photo, true blacks, no flags, no insignia, no text, no logos, no watermark.

*Leg 22 (identity key), motion (image-to-video, --sec 5):*

> Static camera. The wrench bounces off the rim and spins slowly away into the room; she follows it with her eyes only, deadpan; a long slow blink; then she calmly lifts her left forearm and taps the wrist display, composed. The light stays steady. The wrist display glows softly but its screen is never readable. Weightless, real-time, natural motion. Keep the lighting, colours, depth of field and film grain of the first frame. No text, no captions, no logos.

- Note: Comedy: hf01's arrow beat exactly (a near-miss above the head, then total calm), with the alarm on her face as the setup for her note.
- Note: Two callback chains pay off at once: 'Alarms: muted' (S07) -> 'No alarms.' (S12) -> the alarm itself, recast as lighting; and the wrench she let go at 09:12 (S01) -> 'Loose items leave.' (S19) -> it comes back.
- Note: A ricochet off the rim on the whip frames is mostly hidden in blur; the plate only has to deliver a wrench spinning away. The red pulse is comp, so it lands on the beat.
- **Check with Manus:** A follow-up prompt setting the look (the grade) of a shot in a running Video Editor job.
- **Check with Manus:** Tone, for Manus marketing: a radiation alarm played as a joke ('Mood lighting.'); she is unhurt and the film never claims the alarm is harmless.

## S23 · n1651-n1799 · 55.033-60.000 s · 149 f (4.967 s, 119 mf) · deliverable-in-viewer

- **hf01 (cuts S23 'ae-sungate-poster', SHOTS.md #24):** The hero deliverable: the landmark poster builds piece by piece (the longest comp build, ~5 s), then holds dead still.
- **Ours:** The film's hero frame builds: Marketing's own photo of The Lull, now re-lit soft red, the big round window, Earth. THE LULL. The quietest room in orbit. Mood lighting included.
- **In:** cut at n1651 (static: the comp starts empty; the cursor is there).
- **Out:** cut at n1800 to the capsule (the frame is dead still before it).
- **Framing (master editor):** centre (559, 202), scale 1.91: shows master x 276.3-841.7, y 42.8-361.2; the comp lands at screen 19-989 x 16-562 [34-1758 x 28-999].
- **Hold:** n1788-n1799 = `hold: [137, 148]` (declare as `hold: [from, to]` (local 30-fps frames) so the freeze QA reports a verified hold).
- **Screen:** The master editor at framing (559, 202, 1.91): the comp at screen x 18-989, y 16-562 (hf01: x 18-990, y 18-562).
- **Layout:** n1790, camera locked: night-navy ground; photo frame x 300-965, y 30-410 (rounded 8 px, 3 px moon-white stroke, soft shadow) holding A4 re-lit soft red (the photo S12 showed in cool light); The Lull mark (no caps) on the photo's top-left corner, centre (330, 65); headline 'THE LULL' x 38-260, y 70-120 (tracked light caps, moon white, cap ~40 px [71]); body 'The quietest room in orbit.' x 38-270, y 150-190 (two lines, ~15 px [27]); pill 'Mood lighting included.' x 38-260, y 215-240 (lull red fill, moon-white text); three round thumbs (sunrise A1, drift A2, stars A3: shots that exist by now) at x 35, 140, 245, y 445-530; a ticket-shaped tag (no text, a crescent) x 834-946, y 459-543.
- **Build:** Marquee dragged by the cursor n1654-1656; the photo frame grows n1657-1663 (0.38, 0.56, 0.82, 0.93, 0.98, 1.0); seed spark at (620, 234) n1657-1660 and the reveal ring r 10.5 -> 335 px (A4 full n1674, glow gone n1676), the photo arriving already red; the mark pops n1668-1677; the headline types n1690-1698 with a caret (hf01's eyebrow slot, earlier than hf01's headline so it can be read); the body types n1704-1716; the pill pops n1727-1732 (back-out); thumbs: rings n1741-1751, n1752-1764, n1758-1772; the ticket tag placed at 0.30 (n1779-1781), drag-resized to 1.0 by n1787; dead still n1788-1799.
- **Camera (matches hf01):** hf01 S23 on top of the framing: content left -8.9 px/mf + glow pop (n1657-1662); pan right peak 30.9 px/mf (n1669-1689, build x1.75, stop x0.56); push bump s 0.957 -> 1.009 (n1694-1708); zoom-out + tilt up (n1720-1740); zoom-in + tilt down (n1740-1757); pan left 66 px (n1757-1776); dead still n1788-1799 (declared hold).

**On screen (our copy)**

| Text | Chars | Visible | Legible | Words | Readable s | w/s | Where |
|---|---|---|---|---|---|---|---|
| THE LULL (ad) | 8 | n1690-n1799 | n1696 | 2 | 3.47 | 0.58 | headline (types) |
| The quietest room in orbit. (ad) | 27 | n1704-n1799 | n1712 | 5 | 2.93 | 1.7 | body (types) |
| Mood lighting included. (ad) | 23 | n1727-n1799 | n1730 | 3 | 2.33 | 1.29 | pill |

**Overlays and elements**

| Element | Box 1080x608 | [1920x1080] | Timing | Motion |
|---|---|---|---|---|
| Cursor | 540-780 x 220-560 | 960-1387 x 391-996 | n1654-1656 marquee drag; n1741 thumb marquee; n1779-1787 drag-resize | Drift-hop-hold. |

**Sound.** Drop 1 on bar 20, n1658.3 (+244 ms after the cut; the 808 pickup peaks ~80 ms before it): the full groove.

- Note: Comedy: the alarm is now a selling point, in a red pill.
- Note: Ad piece shown: 0:20 THE LULL (A4, re-lit by P4: a grade, not new footage) + thumbs of the three shots that exist.

## S24 · n1800-n1904 · 60.000-63.500 s · 105 f (3.500 s, 84 mf) · overlay-on-footage

- **hf01 (cuts S24 'cave-sphere-prompt', SHOTS.md #25):** Loop 5 peril + the final prompt: the temple, the giant stone sphere behind him, a light strike darkens the scene; 'Render the final and send it to the client!' (sent n1895).
- **Ours:** THE PEAK: re-entry. Strapped into the capsule, plasma fire roaring past the round window behind her, the cabin shaking, a plush whale swinging on its cord, the signal dropping bar by bar. On the last bar she sends: end on this glow, ship it. Then loss of signal.
- **In:** cut at n1800 (the live side opens on the pull-back's fastest step).
- **Out:** card-in at n1905 out of the send sweep.
- **Subject:** The astronaut strapped into a reclined seat in a small fictional capsule, helmet on, visor up, in the same suit without its backpack; the round window behind her shoulder (hf01's giant sphere behind the hero); a small plush whale on a cord (the zero-G indicator).
- **Action:** The cabin shakes; through the round window the plasma glow builds from orange to pink-white (n1800-1880) while the cabin lights flicker and dim (n1840-1866: hf01's light strike); the plush whale swings hard on its cord; she lifts her left forearm and taps (n1836-1852), then holds still, watching the display, utterly calm while everything rattles (n1853-1890); one firm tap (n1891).
- **Framing:** Low angle, MCU pulling back to a medium; the window glowing behind her right shoulder; the bar bottom-left.
- **Lens:** ~24-28 mm, low angle.
- **Light:** R5: dim cabin; the window's plasma glow orange-pink and flickering, the scene darkening p50 55 -> 35 as the cabin lights drop; her face warm from the window, cool from the wrist display.
- **Camera (matches hf01):** hf01 S24: slow pull-back x0.41 over the shot (-5.8 %/mf on the first step, -1.9 %/mf avg n1801-1830, -0.7 %/mf after), content drifting down 2-5 px/mf (camera rising); plus a fine re-entry shake (rms ~1.5/2.2 px).

**On screen (our copy)**

| Text | Chars | Visible | Legible | Words | Readable s | w/s | Where |
|---|---|---|---|---|---|---|---|
| End on this glow. Ship it. | 26 | n1839-n1904 | n1839 | 6 | 2.2 | 2.73 | prompt bar 5 (P5) |

**Overlays and elements**

| Element | Box 1080x608 | [1920x1080] | Timing | Motion |
|---|---|---|---|---|
| Prompt bar 5 (our bar, narrower) with the live helmet-cam chip (the plasma in the window) | 42-470 x 422-532 | 75-836 x 750-946 | first faint n1834, full n1838, settled n1854; typing n1839-1852; chip n1853; hold 38 f; press n1891-1895 (glow peak n1895); sweep n1896-1904; card-in n1905 | Types ~2 chars/cf; the chip pops at n1853; send disc centre (428.5, 496.5) [(762, 883)]; the rim breathes with peaks ~n1841, n1862, n1882; the disc stays armed through the hold; the orange glow of the plate shows through the frosted glass. |
| Signal glyph in row 2 (3 bars, 2 px, grey; dropped bars as hollow outlines; a crossed-antenna glyph for no signal) | 388-404 x 488-500 | 690-718 x 868-889 | two bars n1834-1849; one n1850-1861; none n1862-1873; one n1874-1879; none n1880-1885; one, steady, n1886-1895; after the send, no signal from n1897 (crossed antenna) to the cut | Hard swaps, no tween; each drop gets a 1-frame 60 % flash of the bar outline. The flicker happens during her hold: the hold reads as waiting for one bar. |

**Sound.** The vacuum rule breaks here: the re-entry roar through the hull is the film's first loud real sound, rising under everything from the cut. Drums thin on bar 22 (n1823.8) and a bright lead line plays (our answer to hf01's cave lead), thinning to one held note as the light drops (n1845-1866); two soft muted ticks in key on the signal drops (n1850, n1862), the only UI sounds in the film; her slow, even breath; send puff n1891-1904; the radio hiss cuts to silence on loss of signal (n1897), the roar staying.

**Generation plan.**

| Leg | Key still at | sec | Use | Join |
|---|---|---|---|---|
| 24 (identity key) | n1800 | 5 | n1800-n1904 (3.5 s) | - |

*Leg 24 (identity key), key still (16:9, the leg's first frame n1800):*

> Cinematic 24mm film still from a low angle inside a small, dim, fictional re-entry capsule: an East Asian woman of about 40 with light warm skin, strong expressive dark eyebrows with a small pale scar through the left brow, dark brown eyes and faint laugh lines, wearing a black fabric comms cap with small ear cups inside a clear bubble helmet whose gold sun visor is raised so her whole face is visible, two small lamps at the helmet's temples and a small camera on its right side, and a fictional white spacesuit of matte multi-layer fabric with a hard upper torso, saturated signal-orange bands around both upper arms and both thighs, an orange helmet neck ring, white gloves with orange fingertip grips, a slim dark wrist display under a padded white cover strapped over the left forearm, an embroidered round mission patch on the left shoulder (navy twill, gold border, a crescent cradling a small circle and three stars, no lettering); no backpack. She sits strapped into a reclined seat with harness straps, helmet on and gold visor raised, face calm; behind her right shoulder a small round window full of glowing orange-pink plasma streaming past, the warm light spilling across grey padded panels; a small pale-blue plush whale toy dangles on a cord from the ceiling; a few dim indicator lights, no readable screens. Unbranded and fictional: no logos, no flags, no name tags and no lettering anywhere on the station, suit or capsule. Photoreal cinematic film still, natural skin texture, visible film grain, slightly soft, unretouched, not a stock photo, true blacks, no flags, no insignia, no text, no logos, no watermark.

*Leg 24 (identity key), motion (image-to-video, --sec 5):*

> The camera slowly pulls back and rises from a medium close-up to a medium shot while the cabin shakes. The plasma in the window grows brighter and flickers, the cabin lights dim, the plush whale swings hard on its cord. She lifts her left forearm, taps the wrist display, then holds still and watches it, completely calm, and finally taps it firmly once. The wrist display glows softly but its screen is never readable. Keep the colours, depth of field and film grain of the first frame; the light dims once as the plasma builds. No text, no captions, no logos.

- Note: Escalation 5 and the peak: will it go out before blackout? hf01 peaks its danger on loop 5 too. The plasma blackout is real (no radio through the plasma sheath).
- Note: Comedy: a fireball outside, and her note is about using it as the ending.
- Note: Causality: 'this glow' is her helmet-cam clip of the window, recorded n1800-1890, before the send; nothing in her film is shot after she goes silent.
- Note: The plush whale (a real crew tradition: a toy that floats when you reach orbit) swings forward under deceleration; it foreshadows S18's whale song and S26's 'Undersea next?'. If it fails in generation, drop it; nothing depends on it.
- Note: The Cloud Computer's story beat: from the send on she is unreachable, and S25 shows the job finished anyway.
- Note: Realism: one suit for the whole film (identity), here with the backpack removed (CHAR_SEAT) so no life-support pack fights the seat; a real crew changes into an entry suit (Decisions).
- **Check with Manus:** The job finishing while her device has no signal (implies it runs on her always-on Cloud Computer: F12/F14 cover always-on tasks; a Video Editor job there is not shown officially).
- **Check with Manus:** A follow-up prompt adding the ending and asking to ship (sending the film to a contact as an action of the task).
- **Check with Manus:** Her helmet-cam glow clip reaching the job on the last bar (same upload hand-off as S04).

## S25 · n1905-n1932 · 63.500-64.433 s · 28 f (0.933 s, 23 mf) · white status screen

- **hf01 (cuts S25 'card-download', SHOTS.md #26):** Delivery: the AE file card with a Download button. End to end.
- **Ours:** The file card: The Lull, its thumbnail the re-entry glow she asked for; a small cloud icon (it finished on her Cloud Computer) and a blue check (sent). Delivered while she is in blackout: the cut from 'no signal' to the check is the joke.
- **In:** card-in at n1905 (softer start: sigma_y 7.4 -> 0 in 4 mf; 22.6 px/mf, r 0.81).
- **Out:** card-out at n1933: hard cut while still drifting, no momentum.
- **Screen:** #F7F7F7 dot grid; one white file card.
- **Layout:** Card x 117-963, y 247-372 [208-1712 x 439-661], radius 16 [28], white, hairline #E3E3E3, soft shadow. Left: a 110 x 106 file tile at x 166-276 showing the film's last frame (A5, the plasma glow) with a small white play triangle. Title 'The Lull' Inter Medium ~28 px [50] ink from x 308; beside it a 2 px #2CB4F3 cloud line icon (x 455-485). Right: a round status disc x 866-926, y 279-339, fill #F2F2F2, a #33ABFB check (the card's one blue element; no word).
- **Build:** Everything arrives with the card; no reveal (as hf01).
- **Camera (matches hf01):** hf01 S25: y(t) = 72.7 e^(-t/0.154) - 20.6 t + 8.1 (enters +83 px, lands ~n1918, drifts up ~0.9 px/f to -10 px at n1932).

**On screen (our copy)**

| Text | Chars | Visible | Legible | Words | Readable s | w/s | Where |
|---|---|---|---|---|---|---|---|
| The Lull | 8 | n1905-n1932 | n1907 | 2 | 0.87 | 2.31 | file card title |

**Overlays and elements**

| Element | Box 1080x608 | [1920x1080] | Timing | Motion |
|---|---|---|---|---|
| File tile with the A5 glow thumbnail and a play triangle | 166-276 x 262-368 | 295-491 x 466-654 | n1905-1932 | Rides the card. |

**Sound.** Drop 2: drums back on bar 23, n1906.6 (+52 ms after the cut): the answer to the last-bar send.

- Note: Two words in 0.87 s (the ridge's S25 had 15). The cloud icon and the check say 'finished on the Cloud Computer, sent' without words; S26's reply confirms it.
- **Check with Manus:** Same as S24 (the film reaching Marketing while she is offline).

## S26 · n1933-n2174 · 64.433-72.500 s · 242 f (8.067 s, 193 mf) · overlay-on-footage

- **hf01 (cuts S26 'walk-out-phone-tagline', SHOTS.md #27):** Act 4 payoff: calm daylight, the client's happy reply (the bookend bubble) with the next-brief punchline, a pull-back to a wide with the mascot on a branch, the quiet CTA line.
- **Ours:** THE RELEASE: splashdown. Golden hour, open sea; she sits on top of the bobbing capsule, helmet off, face to the sun. 19:47: 'Booked solid.' She smiles. A follow-up: 'Undersea next?' Her smile fades into a slow look down at the water under her boots. Pull back: one small capsule on an enormous sea; the music stops and a gull lands on it. The quiet product line.
- **In:** card-out at n1933 (hard cut; the plate opens on an ease-out pan).
- **Out:** endcard cut at n2175 (hf01 dims a frozen frame; we freeze and wash it toward #F7F7F7: S27).
- **Subject:** The astronaut on top of the bobbing capsule (white, one orange band, hatch open) at golden hour; open sea; a seagull.
- **Action:** MCU: she sits on the capsule top, helmet off on her lap, comms cap off, short wet black hair, face to the low sun, eyes closed, a wide relieved smile, the plush whale tucked under her arm (n1933-1995); she lifts her left forearm and reads, smiling (n1995-2020); the smile stays, then fades into a slow, deadpan look down at the water under her boots (n2025-2055); the camera pulls back as she keeps staring at the sea (from ~n2060): the capsule becomes a small white shape on a vast golden sea, a recovery boat a speck on the horizon; a gull glides in from n2062 and lands on the capsule's top at n2072, as the groove stops (hf01's cat lands n2061-2071), and stays.
- **Framing:** Slightly low MCU -> pull-back to a static-ish wide (n2085-2174).
- **Lens:** ~50-85 mm in the MCU (shallow depth of field), the wide after the pull-back.
- **Light:** R6: warm gold evening sun from the side, cool blue shadows; the sea's sparkle the brightest area.
- **Camera (matches hf01):** hf01 S26: opens on an ease-out pan (content left 6.7 -> 0 px/mf by n1943, r 0.70); tilt down (content up 4-8 px/mf, n1946-2000); steady pull-back -0.5 ... -0.65 %/mf for 140 mf (x0.45); shake rms ~1.6/1.2 px (plus the swell's slow roll).

**On screen (our copy)**

| Text | Chars | Visible | Legible | Words | Readable s | w/s | Where |
|---|---|---|---|---|---|---|---|
| 19:47 | 5 | n2004-n2066 | n2005 | 1 | 2.07 | 0.48 | bubble timestamp line (the time only: an ordinary email notification) |
| Booked solid. | 13 | n2005-n2066 | n2008 | 2 | 1.97 | 1.02 | bubble A (the reply) |
| Undersea next? | 14 | n2016-n2066 | n2021 | 2 | 1.53 | 1.3 | bubble B (the follow-up: the next brief) |
| Marketing | 9 | n2016-n2066 | n2018 | 1 | 1.63 | 0.61 | sender label (left-aligned, under bubble B) |
| Manus 2.0 · Automations · Studio Video Editor · Cloud Computer | 62 | n2081-n2174 | n2081 | 8 | 3.13 | 2.55 | quiet product line, centred (hf01's CTA slot) |

**Overlays and elements**

| Element | Box 1080x608 | [1920x1080] | Timing | Motion |
|---|---|---|---|---|
| Bubble A 'Booked solid.' (same template as S01: the bookend); timestamp line '19:47' centred above it | 63-233 x 246-282 | 112-414 x 437-501 | bar + timestamp n2004 (hf01's b2 frame); top edge rises 266 -> 246 (n2004-2016); wipe n2006-2008; hold; sinks and fades n2067-2071, gone before the gull lands (n2072) | Timestamp at y 215-226 centred on x 148; white with a soft dark halo (warm mid-tone plate). Exit (the film's only faded UI exit, as hf01's b2): top edges sink 11 px (n2062-2071) while opacity 0.95 -> 0.76 -> 0.51 -> 0.26 -> 0.02 (n2067-2071). |
| Bubble B 'Undersea next?' (the follow-up message); sender 'Marketing' left-aligned below | 63-233 x 290-326 | 112-414 x 516-580 | bar n2016 (0.4 s after A: the comic beat), wipe n2017-2020, lands n2026; fades with A n2067-2071 | Same bar and rise as A (top 310 -> 290 over 10 cf); sender at y 335-344 from x 63. |
| Quiet product line: Inter Medium, cap ~14 px [25], dark ink #1D2126 over the bright sea | 211-869 x 295-312 | 375-1545 x 524-555 | hard cut-in n2081, holds to n2174; cut away with the overlays at n2175 (the end card freezes the picture only) | All characters on the first frame, no type-on, no fade (as hf01's CTA); small and quiet. |

**Sound.** The film's first natural sound: gentle waves slapping the capsule, under the groove from the cut; a stutter fill 64.95-66.1 s (n1949-1983); the groove stops on bar 25 (n2072), just after the bubbles clear, so the punchline lands in near-silence: the waves, her short laugh-exhale, and the gull's call as it touches down (n2072) and once more (n2125), in place of hf01's mascot chirps; fade to digital silence by n2170.

**Generation plan.**

| Leg | Key still at | sec | Use | Join |
|---|---|---|---|---|
| 26 (identity key) | n1933 | 10 | n1933-n2174 (8.07 s) | - |

*Leg 26 (identity key), key still (16:9, the leg's first frame n1933):*

> Cinematic 85mm film still, slightly low medium close-up at golden hour on the open sea: the same East Asian woman of about 40 with light warm skin, strong expressive dark eyebrows with a small pale scar through the left brow and short wet straight black hair, helmet and comms cap off, wearing the fictional white spacesuit with no backpack, saturated signal-orange bands around both upper arms and both thighs, an orange neck ring, the slim dark wrist display on her left forearm and an embroidered round mission patch on the left shoulder (no lettering), her helmet resting on her lap, a small pale-blue plush whale toy tucked under one arm, sitting on top of a bobbing white space capsule with one orange band beside its open hatch; face turned up to the low sun, eyes closed, a wide relieved smile; behind her a soft-focus golden sea and a pale sky. Warm low sun from the side, cool shadows. 85mm, shallow depth of field. Unbranded and fictional: no logos, no flags, no name tags and no lettering anywhere on the station, suit or capsule. Photoreal cinematic film still, natural skin texture, visible film grain, slightly soft, unretouched, not a stock photo, true blacks, no flags, no insignia, no text, no logos, no watermark.

*Leg 26 (identity key), motion (image-to-video, --sec 10):*

> The camera eases to a stop from a slow pan, then tilts down gently as she opens her eyes, lifts her left forearm and reads the wrist display, smiling; the smile fades into a slow, deadpan look down at the water below her. Then the camera dollies steadily back and back over the sea as she sits still on the bobbing capsule; a seagull glides in and lands on top of the capsule and stays there; she becomes a small figure on a small white capsule on an enormous golden sea, a tiny boat far away. The wrist display glows softly but its screen is never readable. Weightless, real-time, natural motion. Keep the lighting, colours, depth of field and film grain of the first frame. No text, no captions, no logos.

- Note: The punchline: the next brief is about the world she is in now, as hf01's is. She is sitting on the sea; the follow-up asks for something under it. The laugh is her look down at the water, then the pull-back that shows how much sea there is, then the gull landing into the silence.
- Note: hf01's bubble timing (the fidelity judge's graft): the bar enters on hf01's b2 frame (n2004) and both bubbles clear before the gull lands (n2072). To fit that window at <= 3 words/s the timestamp line carries the time only (6 words in 2.07 s = 2.9 w/s); that also drops the doubled Automation claim the truth judge flagged.
- Note: Bookend: the same bubble template, position and sender as S01; 09:12 -> 19:47.
- Note: If the gull landing fails, generate it already perched (key-frame variant); if a 10 s take drifts her face, generate n1990-2174 and make n1933-1990 a slow digital pan on its first frames.

## S27 · n2175-n2295 · 72.500-76.533 s · 121 f (4.033 s, 97 mf) · end card

- **hf01 (cuts S27 'endcard', SHOTS.md #28):** Act 5 end card: the last frame frozen and dimmed to ~24 %, the IG icon + handle, a sting in silence.
- **Ours:** endcard-wash: S26's last picture freezes and washes to the Manus off-white; the Manus lockup builds with hf01's icon motion; the end line builds word by word: 'Out of office. / Out of range. / Still shipping.' with 'shipping.' in blue; the sting lands 0.368 s after the cut.
- **In:** cut at n2175, on beat 105, 0.15 s into the digital silence (endcard-wash: our variant of hf01's endcard-dim).
- **Out:** end at n2295.
- **Hold:** n2225-n2295 = `hold: [50, 120]` (declare as `hold: [from, to]` (local 30-fps frames) so the freeze QA reports a verified hold).
- **Screen:** Frozen n2174 (picture only: capsule, gull, sea) x 0.24 + #F7F7F7 x 0.76 in one frame at n2175, the dot grid faint over it.
- **Layout:** Lockup centred on (540, 250) [(960, 444)]: mark x ~378-450, wordmark x ~482-702 (~30 % of the frame width, mark height ~2.7x the wordmark's x-height), y ~214-286, dark files. End line centred, three lines, Inter Medium cap ~22 px [39], ink #1F1F1F: 'Out of office.' y 318-340, 'Out of range.' y 350-372, 'Still shipping.' y 382-404 with 'shipping.' #33ABFB and a hand-drawn #33ABFB underline (y 408-412). The group spans y 214-412, centred on the frame.
- **Build:** n2175 the mark alone cuts on at frame centre at 0.99 and swells to 1.10 by n2181; n2181 the wordmark cuts on and the mark jumps left into the lockup (a hard swap: hf01's handle cut-on); snap 1.10 -> 0.90 over n2183-2184; recover to 1.00 by n2190; pivot = the group centre. The end line builds where hf01's gradient sweep starts (n2187): each word blurs in, arrives grey #A6A6A4 and settles to ink: 'Out' n2187, 'of' n2189, 'office.' n2191, 'Out' n2196, 'of' n2198, 'range.' n2200, 'Still' n2205, 'shipping.' n2208 (arrives blue); the underline draws left to right n2214-2224; still hold n2225-2295 (declared `hold:`).
- **Camera (matches hf01):** Static (frozen plate).

**On screen (our copy)**

| Text | Chars | Visible | Legible | Words | Readable s | w/s | Where |
|---|---|---|---|---|---|---|---|
| [Manus mark + 'manus' wordmark, dark files] | - | n2175-n2295 | n2175 | logo | - | - | end lockup (wordmark from n2181) |
| Out of office. | 14 | n2187-n2295 | n2190 | 3 | 3.53 | 0.85 | end line 1 |
| Out of range. | 13 | n2196-n2295 | n2199 | 3 | 3.23 | 0.93 | end line 2 |
| Still shipping. ('shipping.' #33ABFB) | 15 | n2205-n2295 | n2208 | 2 | 2.93 | 0.68 | end line 3 |

**Overlays and elements**

| Element | Box 1080x608 | [1920x1080] | Timing | Motion |
|---|---|---|---|---|
| Wash plate: frozen n2174 picture x 0.24 + #F7F7F7 x 0.76, faint dot grid | 0-1080 x 0-608 | 0-1920 x 0-1081 | n2175-2295 | One-frame change at the cut (hf01's instant dim, inverted to a lighten); static after. |

**Sound.** Digital silence n2170-2186; the sting at n2186.05 (0.368 s after the cut): a bright open F-major (add9) chord on bell and pad with a soft low boom, ringing ~1.6 s, ~6 LU over the body, true peak -1 dBTP; the end line builds under its ring; digital silence n2236-2295.

- Note: 'Out of office' now means three things: the auto-reply, the spacewalk outside the station, and the orbit she has just left. 'Out of range.' is the blackout, the product truth said plainly. 'Still shipping.' is Manus; P5's 'Ship it.' sets it up. The brief's two-line version is kept as the fallback (Decisions).
- Note: No URL or availability line (Manus used none; the domain is manus.im vs manus.ai: Decisions).
