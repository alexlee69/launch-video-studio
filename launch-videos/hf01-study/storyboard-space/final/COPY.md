# The Lull: copy check (final)

**FINAL storyboard v1.0 (astronaut; comedy base + the three judges' grafts), 2026-10-23, storyboard only, for Alex's review.** Every on-screen line of ours, with its readable time and word count, next to the higgsfield01 line on screen at the same frames (SHOTS.md §5, ±2 f; hf01's watermark handle is left out except on the end card, where it is the content) and the nearest Manus line by function (WORDS.md). Their lines are quoted only to prove ours are not rewrites. The test: read each pair side by side; if ours reads as theirs reworded, it fails.

**Automatic checks (tools/build.py, on every build):**
- **Reading rule:** every string, and every group of strings read together, at <= 3 words per readable second (readable = from the first legible frame to the last). **All pass**; the densest string and shot are listed below.
- **Banned Manus UI strings** ('Generating footage', 'Mixing the score', 'Ready ·', 'Exporting', 'On it.', 'Done.', 'Untitled video', 'Made with …', 'Manus 2.0 Max', 'Introducing', 'Run this task on', 'In the cloud', 'Remote control', the Alchemy line, …) and banned names (real agencies, stations, vehicles and hardware, 'safety video'; the list is BANNED_WORLD in tools/final_data.py) on screen: **0 found**.
- **Prompt hygiene:** no generation prompt (16 film legs, 5 ad stills, 3 ad motions) names a real agency, station, vehicle or hf01 / Manus place (BANNED_WORLD + BANNED_PLACES): **0 found**. Prompts say what things are ('blue-black solar arrays', 'one large round window'), never what they are not.
- **Causality:** every shot of her film is captured before the prompt that needs it, and never shown before it exists (A1 n540 < P1 n652; A2 n912 < P2 n913; A3 n1180 < P3 n1181; A4 Marketing's photo < P4 n1641; A5 n1890 < P5 n1895): **pass**.
- **Runs of 3+ consecutive words** shared with any hf01 line (63 hand-listed + the SHOTS.md §5 inventory) or any of Manus's on-screen strings (words.json), product names excepted: **0 found**. Content-word reuse (2+ shared content words covering half of our line): **0 found**.
- **Self-test:** PASS: clean data 0 failures; 18/18 planted errors caught (dense card (S10 tool line made 7 words): 2; rewrite of hf01's punchline in S26: 6; P2 pressed one frame late: 2; second blue word on S05: 2; banned Manus status string: 4; string outside its shot: 1; agency name on screen: 1; two short lines read together too fast (S16): 1; end line before the end card: 3; agency name inside a key-frame prompt (S01 1a): 1; hf01 place inside a motion prompt (S14 14A): 2; real station named in an ad prompt (A1): 1; ad shot captured after the prompt that needs it (A3): 1; S04 glyph swap off hf01's frame (n447 -> n449): 1; S26 reply still legible as the gull lands: 1; S26 reply enters before hf01's bar frame: 1; second blue accent on the title card: 1; 'Make a wish!' back in S14 (2-word run with hf01's P3): 2).
- **2-word shared runs** with a content word (now failures: the comedy draft's 'Make a wish!' / 'Make a map…' is gone):
  - none.

**Form checks (by eye):** no question cascade of categories on hf01's morph beats (ours are statements and one setup / punchline pair); no 'Today hh:mm' timestamp; no 'Client' label; no praise + 'Next brief:' reply (ours is a result, then a separate follow-up question); no bold one-word status opener ('Mapped.'); no 'TRY … FOR … WITH' CTA; no 'for X' title pill; no 'Every X, a Y' tagline; no 'you build / you decide' manifesto; no whole-line blue tool line; no Manus status line that jokes about her danger (the comedy draft's 'Gorgeous drift.' / 'What debris?' are now 'Drift first.' / 'Debris → stars.').

## Every line

| Shot | Visible (legible from) | Ours | Words | Readable s | w/s | hf01 on screen at the same frames | Manus at a similar moment | Longest shared run | Check: not a rewrite because |
|---|---|---|---|---|---|---|---|---|---|
| S01 | n15-n60 (n18) | 2.0 | 1 | 1.43 | 0.7 | Higgsfield MCP (superscript MCP) · × Claude (asterisk logo) · OPUS 5.5 · for Motion Design · Spacebar | Introducing / Manus 2.0 (W01-W03) | '2.0' (Manus, product name) | A version number beside the official lockup; no 'Introducing', no chrome coin. |
| S01 | n252-n347 (n252) | Automation · 09:12 | 2 | 3.2 | 0.62 | Today 10:24 · Need a motion promo video. ASAP. · Client | Automations / Triggered by events (W25-W26) | none | The feature name as a label plus a station time; no 'Today', no 'Triggered by'. |
| S01 | n253-n347 (n256) | Launch moved up. | 3 | 3.07 | 0.98 | Today 10:24 · Need a motion promo video. ASAP. · Client | When a new HubSpot lead is generated. → Send a customized deck to the lead. (W28) | none | A schedule change (the pun: she is already up); not a request, not a when-then rule; no 'Need a', no 'ASAP'. |
| S01 | n262-n347 (n266) | Film by tonight? | 3 | 2.73 | 1.1 | Today 10:24 · Need a motion promo video. ASAP. · Client | - | none | The ask arrives as a second message, a question with a deadline; shares no word with hf01's brief. |
| S01 | n262-n347 (n264) | Marketing | 1 | 2.8 | 0.36 | Today 10:24 · Need a motion promo video. ASAP. · Client | - | none | A department, not 'Client'. |
| S04 | n410-n437 (n414) | Tonight? | 1 | 0.8 | 1.25 | What / is it / this / time? | - | none | One-word echo of the email's ask; not a 'what is it this time' exasperation, no question cascade. |
| S04 | n442-n469 (n446) | From space? | 2 | 0.8 | 2.5 | What / is it / this / time? · Objects? | - | none | Her situation, not a category of motion design ('Objects?'). |
| S04 | n470-n497 (n474) | Nose itches. | 2 | 0.8 | 2.5 | Shapes? | - | none | Bathos: a petty astronaut problem; not 'Shapes?'. |
| S04 | n499-n526 (n503) | Sunrise. Again. | 2 | 0.8 | 2.5 | VFX? · time * 60 · wiggle(2,10) | - | none | Deadpan weariness at the 16-sunrises-a-day orbit; not 'VFX?'. |
| S04 | n523-n565 (n525) | T–09:48:00 | 1 | 1.37 | 0.73 | time * 60 · wiggle(2,10) · Expression? · Wait · No · Let me explain | - | none | A launch-style countdown to the 19:00 deadline, not code; the capsule glyph says, without a word, that 19:00 is also her ride home. |
| S04 | n526-n553 (n530) | Deep breath. | 2 | 0.8 | 2.5 | time * 60 · wiggle(2,10) · Expression? · Wait | - | none | A self-instruction, not a question. |
| S04 | n552-n586 (n556) | Not that deep. | 3 | 1.03 | 2.9 | time * 60 · wiggle(2,10) · Wait · No · Let me explain | Build any game / You Imagine (W24) | none | The punchline to 'Deep breath.' (her air is finite; also 'it's not that deep'); shares no run with either line. |
| S04 | n588-n660 (n588) | Lull launch film. 30s. Make it calm. | 7 | 2.43 | 2.88 | I need a promo. Fast. No mistake. · Opus 5.5 | A car turns into a mech and wins a street fight inthe rain. (W13) | none | Same three-beat typing rhythm as hf01's p1, different content: the product, the length and one creative rule; no 'I need', no urgency words. |
| S05 | n662-n697 (n663) | Keeping it calm. | 3 | 1.17 | 2.57 | Promo brief received. · Starting with the reserve logo. | Untitled video / Generating footage... (W15) | none | An honest statement of the one rule it is applying; no 'received', no 'Starting with', no 'Generating'. |
| S06 | n698-n775 (n704) | The Lull | 2 | 2.4 | 0.83 | AE UI: 50% · 00:00:00:00 · Full · Active Camera · 1 View · Properties · Align · Effects & Presets · Tracker · Audio · 0s…12s | Untitled video (W15) | none | The client's product name; not a file-style comp name (hf01's IVAYU_RESERVE_MAP_16x9). |
| S06 | n698-n775 (n704) | Cloud Computer | 2 | 2.4 | 0.83 | AE UI: 50% · 00:00:00:00 · Full · Active Camera · 1 View · Properties · Align · Effects & Presets · Tracker · Audio · 0s…12s | Give Manus an / Always-on computer (W30) | 'computer' (Manus, product name) | The product name on a chip, no claim sentence. |
| S06 | n698-n775 (n704) | Alchemy | 1 | 2.4 | 0.42 | AE UI: 50% · 00:00:00:00 · Full · Active Camera · 1 View · Properties · Align · Effects & Presets · Tracker · Audio · 0s…12s | Alchemy finds it — story, style, motion and sound. (W14) | 'alchemy' (Manus, product name) | The mode's name only; none of the four category words. |
| S06 | n753-n775 (n753) | THE LULL (ad) | 2 | 0.77 | 2.61 | AE UI: 50% · 00:00:00:00 · Full · Active Camera · 1 View · Properties · Align · Effects & Presets · Tracker · Audio · 0s…12s | - | none | The fictional client's name, built as the film's mark. |
| S07 | n776-n806 (n779) | Alarms: muted | 2 | 0.93 | 2.14 | AE UI: 50% · 00:00:00:00 · Full · Active Camera · 1 View · Properties · Align · Effects & Presets · Tracker · Audio · 0s…12s · IVAYU_RESERVE_MAP_16x9 / _9x16 / _20x5 · Line, Line 2, Main Logo, Main Title, Scene Controls, UI Controls, CC Layer, Generative Video, Music | Mixing the score... (W16) | none | A layer name: the alarm tones muted in her helmet-cam audio for a calm film (an edit, not a mixing status); shares nothing with hf01's layer names. |
| S08 | n808-n846 (n810) | Breathe easy. (ad) | 2 | 1.23 | 1.62 | AE UI: 50% · 00:00:00:00 · Full · Active Camera · 1 View · Properties · Align · Effects & Presets · Tracker · Audio · 0s…12s · HI, I'M ARA! · Ask me about trails, tickets and secret spots. | Every idea has a film in it. (W14) | none | A spa-ad line (and a callback to 'Not that deep.'); not a mascot greeting, not 'Every X has a Y'. |
| S09 | n881-n927 (n881) | Open on this drift. | 4 | 1.57 | 2.55 | Opus 5.5 · Create visual assets for Ivayu Reserve. | Transform the fire beetle into a wind beetle. (W22) | none | A creative note about the disaster happening to her; not a 'create assets' request, not an A-into-B transform. |
| S10 | n928-n972 (n930) | Drift first. | 2 | 1.43 | 1.4 | Creating photos, pins, and badges... · Generating visuals for "Ivayu" Reserve. | Generating footage... (W15) | none | What P2 changes, stated plainly; no 'Creating', no 'Generating'; no praise for her danger. |
| S10 | n938-n972 (n940) | Half speed… | 2 | 1.1 | 1.82 | Creating photos, pins, and badges... · Generating visuals for "Ivayu" Reserve. | Mixing the score... (W16) | none | What the editor is doing to her clip, with '…' and the hairline for in-progress; no 'Generating visuals for'. |
| S11 | n977-n993 (n977) | Spacewalk | 1 | 0.57 | 1.76 | AE UI: 50% · 00:00:00:00 · Full · Active Camera · 1 View · Properties · Align · Effects & Presets · Tracker · Audio · 0s…12s · Project · Effect Controls · Composition · Footage · Name · 01_REFERENCES · 02_ASSETS · Reserve_flyover.mp4 · Sun_Gate_hero.jpg · Jungle_ambience.wav · Trail_notes.txt · 03_PRECOMPS · 04_MASTER · IVAYU_R… · Snapping | - | none | One plain folder word; no numbered folders, nothing like hf01's 01_REFERENCES / Reserve_flyover.mp4. |
| S12 | n994-n1034 (n998) | Alchemy | 1 | 1.23 | 0.81 | AE UI: 50% · 00:00:00:00 · Full · Active Camera · 1 View · Properties · Align · Effects & Presets · Tracker · Audio · 0s…12s · Sticker-sheet labels and rules (SUN RAYS, PHOTO FRAME, PINS & SERVICES, ISLAND MAP, PLACES, VISITOR CENTER, SUN COINS, CREST FEATHERS, SPEECH BUBBLE, DEAL STICKER, -20%; one-line rules, partly legible) | Alchemy finds it — story, style, motion and sound. (W14) | 'alchemy' (Manus, product name) | The mode's name only. |
| S12 | n996-n1034 (n998) | No alarms. (ad) | 2 | 1.23 | 1.62 | AE UI: 50% · 00:00:00:00 · Full · Active Camera · 1 View · Properties · Align · Effects & Presets · Tracker · Audio · 0s…12s · Sticker-sheet labels and rules (SUN RAYS, PHOTO FRAME, PINS & SERVICES, ISLAND MAP, PLACES, VISITOR CENTER, SUN COINS, CREST FEATHERS, SPEECH BUBBLE, DEAL STICKER, -20%; one-line rules, partly legible) | Alchemy finds it — story, style, motion and sound. (W14) | none | One concrete sound rule for this film's mix; avoids the four Alchemy words; nothing like hf01's sticker labels. |
| S13 | n1035-n1102 (n1040) | Drift | 1 | 2.1 | 0.48 | AE UI: 50% · 00:00:00:00 · Full · Active Camera · 1 View · Properties · Align · Effects & Presets · Tracker · Audio · 0s…12s · Sticker-sheet labels and rules (SUN RAYS, PHOTO FRAME, PINS & SERVICES, ISLAND MAP, PLACES, VISITOR CENTER, SUN COINS, CREST FEATHERS, SPEECH BUBBLE, DEAL STICKER, -20%; one-line rules, partly legible) | Ready · 8.0 s (W17) | none | A shot name; no ready state. |
| S13 | n1043-n1102 (n1045) | Speed | 1 | 1.93 | 0.52 | AE UI: 50% · 00:00:00:00 · Full · Active Camera · 1 View · Properties · Align · Effects & Presets · Tracker · Audio · 0s…12s · Sticker-sheet labels and rules (SUN RAYS, PHOTO FRAME, PINS & SERVICES, ISLAND MAP, PLACES, VISITOR CENTER, SUN COINS, CREST FEATHERS, SPEECH BUBBLE, DEAL STICKER, -20%; one-line rules, partly legible) | - | none | A standard property name (no invented capability like the ridge's rejected 'Rain amount'). |
| S13 | n1063-n1086 (n1063) | Breathe easy. (ad) | 2 | 0.8 | 2.5 | AE UI: 50% · 00:00:00:00 · Full · Active Camera · 1 View · Properties · Align · Effects & Presets · Tracker · Audio · 0s…12s · Sticker-sheet labels and rules (SUN RAYS, PHOTO FRAME, PINS & SERVICES, ISLAND MAP, PLACES, VISITOR CENTER, SUN COINS, CREST FEATHERS, SPEECH BUBBLE, DEAL STICKER, -20%; one-line rules, partly legible) | - | none | Our own super, repeated as the film plays. |
| S14 | n1144-n1190 (n1144) | Call it shooting stars. | 4 | 1.57 | 2.55 | Opus 5.5 · Make a map showing how to get to the reserve. · The easy route! ("The easy" / "route!") | Use my computer to test my app on Xcode (W39) | none | A recasting note about the danger she is in; no 'Make a map', no 'showing'. |
| S14 | n1188-n1225 (n1192) | Wish fast! | 2 | 1.13 | 1.76 | Opus 5.5 · Make a map showing how to get to the reserve. · The easy route! ("The easy" / "route!") | - | none | A delighted, urgent shout under the debris (shooting stars, so wish, and fast: they are coming at her); shares no word with hf01's P3 or 'The easy route!'. |
| S16 | n1258-n1293 (n1260) | Debris → stars. | 2 | 1.13 | 1.76 | Mapped. Five stops. One route. Walking times included. | Ready · 8.0 s (W17) | none | A plain result summary (what became what); it names the debris instead of denying it; no bold one-word opener, no list of counts. |
| S17 | n1294-n1361 (n1296) | Stars | 1 | 2.2 | 0.45 | AE UI: 50% · 00:00:00:00 · Full · Active Camera · 1 View · Properties · Align · Effects & Presets · Tracker · Audio · 0s…12s · RESERVE · IVAYU (logo), RESERVE MAP, IVAYU RESERVE | - | none | A shot name. |
| S17 | n1318-n1361 (n1324) | Wish slowly. (ad) | 2 | 1.27 | 1.58 | AE UI: 50% · 00:00:00:00 · Full · Active Camera · 1 View · Properties · Align · Effects & Presets · Tracker · Audio · 0s…12s · RESERVE · IVAYU (logo), RESERVE MAP, IVAYU RESERVE | Every QR code, an agent. (W60) | none | Our own line, the spa-ad answer to her 'Wish fast!'; not an 'Every X, a Y' tagline. |
| S18 | n1365-n1398 (n1367) | Adding whale song… | 3 | 1.07 | 2.81 | Generating photos of the trail stops... | Mixing the score... (W16) | none | A specific (absurd) sound choice, honestly in progress; not 'Mixing', not 'Generating photos of'. |
| S19 | n1399-n1486 (n1401) | ONE ORBIT (ad) | 2 | 2.87 | 0.7 | AE UI: 50% · 00:00:00:00 · Full · Active Camera · 1 View · Properties · Align · Effects & Presets · Tracker · Audio · 0s…12s · SELF-GUIDED TRAIL · SUN GATE TRAIL · 2.4 KM · 45 MIN · +220 M · MODERATE · 5 STOPS · Map place labels, segment chips, 6 photo-card titles + stat lines, ON THE TRAIL + 4 rules ("Stay on marked paths", "Don't feed the macaws", "Carry out your litter", "Rangers on duty 8:00–19:00") | - | none | A two-word title; not hf01's 'SELF-GUIDED TRAIL / SUN GATE TRAIL'; shares only 'one' with hf01's 'One route.' (S16, a different moment). |
| S19 | n1399-n1486 (n1401) | 90 MIN (ad) | 2 | 2.87 | 0.7 | AE UI: 50% · 00:00:00:00 · Full · Active Camera · 1 View · Properties · Align · Effects & Presets · Tracker · Audio · 0s…12s · SELF-GUIDED TRAIL · SUN GATE TRAIL · 2.4 KM · 45 MIN · +220 M · MODERATE · 5 STOPS · Map place labels, segment chips, 6 photo-card titles + stat lines, ON THE TRAIL + 4 rules ("Stay on marked paths", "Don't feed the macaws", "Carry out your litter", "Rangers on duty 8:00–19:00") | - | 'min' (hf01) | One duration chip (shares the unit 'MIN' with hf01's '45 MIN' chip: a unit, not a phrase). |
| S19 | n1449-n1486 (n1452) | Loose items leave. (ad) | 3 | 1.17 | 2.57 | AE UI: 50% · 00:00:00:00 · Full · Active Camera · 1 View · Properties · Align · Effects & Presets · Tracker · Audio · 0s…12s · SELF-GUIDED TRAIL · SUN GATE TRAIL · 2.4 KM · 45 MIN · +220 M · MODERATE · 5 STOPS · Map place labels, segment chips, 6 photo-card titles + stat lines, ON THE TRAIL + 4 rules ("Stay on marked paths", "Don't feed the macaws", "Carry out your litter", "Rangers on duty 8:00–19:00") | - | none | A true zero-G house rule said deadpan (hf01's slot: 'Don't feed the macaws'); a different joke in different words, and a callback to the wrench she lost at 09:12. |
| S22 | n1608-n1650 (n1609) | Red alarm? Mood lighting. | 4 | 1.4 | 2.86 | Opus 5.5 · Create a visual of the reserve's landmark. | Prepare me for tomorrow's sales meeting with Manus. (W50) | none | A recasting note about the alarm on her face; no 'Create a visual of'. |
| S23 | n1690-n1799 (n1696) | THE LULL (ad) | 2 | 3.47 | 0.58 | AE UI: 50% · 00:00:00:00 · Full · Active Camera · 1 View · Properties · Align · Effects & Presets · Tracker · Audio · 0s…12s · 05 SUN GATE / 2.4 km · 45 min from the Visitor Center · LANDMARK · IVAYU RESERVE · THE SUN GATE · The final stop of every trail. An orange arch crowned with the sun, glowing at golden hour. · STOP 05 · 2.4 KM · SUNSET 18:40 · ON THE WAY · 02 PARROT FALLS · 03 SUN BRIDGE · 04 MONOCLE LAKE | Made with Manus (W20) | 'the' (hf01) | The client's name; shares only 'THE' with hf01's 'THE SUN GATE'. |
| S23 | n1704-n1799 (n1712) | The quietest room in orbit. (ad) | 5 | 2.93 | 1.7 | AE UI: 50% · 00:00:00:00 · Full · Active Camera · 1 View · Properties · Align · Effects & Presets · Tracker · Audio · 0s…12s · 05 SUN GATE / 2.4 km · 45 min from the Visitor Center · LANDMARK · IVAYU RESERVE · THE SUN GATE · The final stop of every trail. An orange arch crowned with the sun, glowing at golden hour. · STOP 05 · 2.4 KM · SUNSET 18:40 · ON THE WAY · 02 PARROT FALLS · 03 SUN BRIDGE · 04 MONOCLE LAKE | - | 'the' (hf01) | Sincere luxury copy that the whole film contradicts; nothing like hf01's 91-character landmark description. |
| S23 | n1727-n1799 (n1730) | Mood lighting included. (ad) | 3 | 2.33 | 1.29 | AE UI: 50% · 00:00:00:00 · Full · Active Camera · 1 View · Properties · Align · Effects & Presets · Tracker · Audio · 0s…12s · 05 SUN GATE / 2.4 km · 45 min from the Visitor Center · LANDMARK · IVAYU RESERVE · THE SUN GATE · The final stop of every trail. An orange arch crowned with the sun, glowing at golden hour. · STOP 05 · 2.4 KM · SUNSET 18:40 · ON THE WAY · 02 PARROT FALLS · 03 SUN BRIDGE · 04 MONOCLE LAKE | - | none | The P4 note sold as a feature; not hf01's 'STOP 05 · 2.4 KM · SUNSET 18:40' chips. Shares one word ('included') with hf01's S16 card 'Walking times included.', a different moment 15 s earlier. |
| S24 | n1839-n1904 (n1839) | End on this glow. Ship it. | 6 | 2.2 | 2.73 | Opus 5.5 · Render the final and send it to the client! | The usual, pickup at 7? (prompt 6, ~152.3 s) | 'it' (hf01) | A creative call about the fire outside her window and a go, in two beats; no 'Render', no 'send it to the client', no exclamation. |
| S25 | n1905-n1932 (n1907) | The Lull | 2 | 0.87 | 2.31 | Ae · Ivayu Reserve Promo · After Effects · Download | Ready · 8.0 s / Save / Export (W17) | none | A delivered file with a check, not a download button or an export percentage. |
| S26 | n2004-n2066 (n2005) | 19:47 | 1 | 2.07 | 0.48 | Today 10:24 · Looks great! Next brief: a safety video for the reserve. · Client | Automations / Triggered by events (W25-W26) | none | The S01 bubble template again (bookend), with the time only; not 'Today hh:mm'; no second Automation claim. |
| S26 | n2005-n2066 (n2008) | Booked solid. | 2 | 1.97 | 1.02 | Today 10:24 · Looks great! Next brief: a safety video for the reserve. · Client | Pickup at 7? / Done. (W59) | none | A sales result for a hotel module; no praise word, no 'Looks great!'. |
| S26 | n2016-n2066 (n2021) | Undersea next? | 2 | 1.53 | 1.3 | Today 10:24 · Looks great! Next brief: a safety video for the reserve. · Client | Saved to / your team. (W57) | 'next' (hf01) | The next brief as a two-word question about the place she is literally sitting on; shares only 'next' with hf01's 'Next brief:'; no colon form, no safety video. |
| S26 | n2016-n2066 (n2018) | Marketing | 1 | 1.63 | 0.61 | Today 10:24 · Looks great! Next brief: a safety video for the reserve. · Client | - | none | The S01 sender again (bookend). |
| S26 | n2081-n2174 (n2081) | Manus 2.0 · Automations · Studio Video Editor · Cloud Computer | 8 | 3.13 | 2.55 | TRY HIGGSFIELD MCP FOR MOTION DESIGN IN AFTER EFFECTS WITH CLAUDE OPUS 5.5 | Manus gives you the power to build / You decide what's worth building (W61-W62) | 'manus' (Manus, product name) | A factual list of 2.0 product names, not an imperative 'TRY ... FOR ... IN ... WITH' CTA and not their manifesto. |
| S27 | n2187-n2295 (n2190) | Out of office. | 3 | 3.53 | 0.85 | @HIGGSFIELD.AI (+ IG glyph) · TRY HIGGSFIELD MCP FOR MOTION DESIGN IN AFTER EFFECTS WITH CLAUDE OPUS 5.5 | [hand mark] manus (W63) | none | The auto-reply idiom, now literal twice over (outside the station on a spacewalk; gone from orbit); not a handle, not a manifesto. |
| S27 | n2196-n2295 (n2199) | Out of range. | 3 | 3.23 | 0.93 | @HIGGSFIELD.AI (+ IG glyph) · TRY HIGGSFIELD MCP FOR MOTION DESIGN IN AFTER EFFECTS WITH CLAUDE OPUS 5.5 | - | none | The blackout beat (S24) as an idiom; ours. |
| S27 | n2205-n2295 (n2208) | Still shipping. | 2 | 2.93 | 0.68 | @HIGGSFIELD.AI (+ IG glyph) · TRY HIGGSFIELD MCP FOR MOTION DESIGN IN AFTER EFFECTS WITH CLAUDE OPUS 5.5 | You decide what's worth building (W62) | none | The product truth: the work went out while she could not; P5's 'Ship it.' pays off. |

## The film's own supers (the deliverable)

| Slot | Super | Words | Where it is read |
|---|---|---|---|
| 0:00-0:05 DRIFT | Breathe easy. | 2 | P2 makes it the opener (S09); S10 'Half speed…'; plays in S13 (early payoff 1). |
| 0:10-0:15 STARS | Wish slowly. | 2 | P3 (S14); 'Debris → stars.' (S16); plays in S17 (early payoff 2). |
| 0:15-0:20 GUEST MAP | ONE ORBIT · 90 MIN | 4 | Builds in S19. |
| 0:20-0:26 THE LULL | The quietest room in orbit. | 5 | In the project from the start (S11 bin, S12 tile in neutral light); P4 re-lights it red (S22); the end frame builds in S23. |
| 0:26-0:30 GLOW | THE LULL | 2 | P5 (S24); the S25 file thumbnail. |

Manus's nearest line for the supers is 'Every idea has a film in it.' (W14); none of ours uses the 'Every X' form, and none shares a run with hf01's Ivayu copy.

## Reading budget per shot (densest text moment)

| Shot | Words in shot | Densest moment | Its words | Seconds | Words/s |
|---|---|---|---|---|---|
| S01 | 10 | n252-n347: Automation · 09:12 + Launch moved up. + Marketing + Film by tonight? | 9 | 3.2 | 2.81 |
| S04 | 20 | n588-n660: Lull launch film. 30s. Make it calm. | 7 | 2.43 | 2.88 |
| S05 | 3 | n663-n697: Keeping it calm. | 3 | 1.17 | 2.57 |
| S06 | 7 | n704-n775: The Lull + Cloud Computer + Alchemy + THE LULL | 7 | 2.4 | 2.92 |
| S07 | 2 | n779-n806: Alarms: muted | 2 | 0.93 | 2.14 |
| S08 | 2 | n810-n846: Breathe easy. | 2 | 1.23 | 1.62 |
| S09 | 4 | n881-n927: Open on this drift. | 4 | 1.57 | 2.55 |
| S10 | 4 | n930-n972: Drift first. + Half speed… | 4 | 1.43 | 2.79 |
| S11 | 1 | n977-n993: Spacewalk | 1 | 0.57 | 1.76 |
| S12 | 3 | n998-n1034: Alchemy + No alarms. | 3 | 1.23 | 2.43 |
| S13 | 4 | n1040-n1102: Drift + Speed + Breathe easy. | 4 | 2.1 | 1.9 |
| S14 | 6 | n1144-n1190: Call it shooting stars. | 4 | 1.57 | 2.55 |
| S16 | 2 | n1260-n1293: Debris → stars. | 2 | 1.13 | 1.76 |
| S17 | 3 | n1296-n1361: Stars + Wish slowly. | 3 | 2.2 | 1.36 |
| S18 | 3 | n1367-n1398: Adding whale song… | 3 | 1.07 | 2.81 |
| S19 | 7 | n1401-n1486: ONE ORBIT + 90 MIN + Loose items leave. | 7 | 2.87 | 2.44 |
| S22 | 4 | n1609-n1650: Red alarm? Mood lighting. | 4 | 1.4 | 2.86 |
| S23 | 10 | n1696-n1799: THE LULL + The quietest room in orbit. + Mood lighting included. | 10 | 3.47 | 2.88 |
| S24 | 6 | n1839-n1904: End on this glow. Ship it. | 6 | 2.2 | 2.73 |
| S25 | 2 | n1907-n1932: The Lull | 2 | 0.87 | 2.31 |
| S26 | 14 | n2005-n2066: 19:47 + Booked solid. + Marketing + Undersea next? | 6 | 2.07 | 2.9 |
| S27 | 8 | n2190-n2295: Out of office. + Out of range. + Still shipping. | 8 | 3.53 | 2.26 |

Densest string: S04 'Not that deep.' 3 words in 1.03 s = 2.9 w/s. Densest shot: S06 n704-n775, 7 words over 2.4 s = 2.92 w/s. For comparison, the ridge draft's cards ran up to 16 words/s (S25: 15 words in 0.93 s).

## The prompts next to hf01's

| Slot | hf01 | Ours | What ours does that hf01's does not |
|---|---|---|---|
| P1 n652 | I need a promo. Fast. No mistake. | **Lull launch film. 30s. Make it calm.** | Starts the job: the product (The Lull), the length, and the one creative rule every later disaster will test: calm. |
| P2 n913 | Create visual assets for Ivayu Reserve. | **Open on this drift.** | Re-orders the film: her drift becomes the serene opening shot at half speed (S10-S13); the sunrise moves to 0:05. |
| P3 n1181 | Make a map showing how to get to the reserve. | **Call it shooting stars.** | Recasts the debris as the film's 0:10 shot: her clip slowed to quarter speed and graded warm, so the streaks read as shooting stars (S16-S17). |
| P4 n1641 | Create a visual of the reserve's landmark. | **Red alarm? Mood lighting.** | Sets the grade of the hero frame: Marketing's own interior photo of The Lull (in the project since S11) re-lit soft red, sold as a feature (S23). |
| P5 n1895 | Render the final and send it to the client! | **End on this glow. Ship it.** | Adds the last shot (her own clip of the glow, recorded before the send) and delivers. The signal drops to nothing 0.07 s later; the job finishes without her. |

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

**Borrowed on purpose (structure, not words).** The three-beat human typing of prompt 1, the bubble bookends with a timestamp and a sender, the two-voice status screens (agent mark vs tool tile), the poster's build order, the deadpan bullet hidden in the infographic, the quiet one-line slot at n2081, the next-brief punchline about the hero's new surroundings, and the end card's icon motion sit where hf01's do, because the brief is to recreate hf01's motion and structure. The words in every slot are ours.

## Storyboard build: reading time and trims (manus2-space, 2026-10-23)

Built from this copy into `/Users/bytedance/Downloads/launch-videos/manus2-space` (beats.yaml + job blocks) and rendered with `lv.mjs --storyboard`. Every on-screen string above went into the job unchanged.

**Trims: none.** No line was shortened, because nothing failed.
- **`lv.mjs --grid`:** 0 reading-time warnings across the 27 shots. The skill's rule is 0.4 s + 0.25 s per word, counting every whitespace token.
  - Tightest: S25 (0.90 s needed of 0.93 s), then S05 / S10 / S11 / S16 / S18 (about 93 % of their length).
  - As a positive control, the same grep on the ridge job's `--grid` prints its 9 warnings.
- **`manus2-space/tools/reading_check.py`:** PASS. It applies this file's rule (≤ 3.0 words per readable second, per string and per group read together) to what the rendered panels actually show, using the readable windows from `shotlist.json`. Its selftest catches a planted 8-word S25 card (8.57 w/s).
  - Densest moments: S06 2.92, S26 2.90, S04 / S22 / S23 2.88, S01 / S18 2.81 w/s.

**What rendering the shot list's framings changed (counts and layout, never copy):**
1. **The Alchemy panel header shows in three framings, so its position was set to keep S23 clear.**
   - At the kit's x 822, the header also landed in S23's framing, as a legible clipped "Alch". Counting it would have put S23's group at 11 words in 3.47 s (3.17 w/s).
   - The panel's content now starts at master x 846:
     - S23 shows none of it;
     - S17 shows 'Alchemy' whole (counted: 4 words, 1.76 w/s);
     - S19 shows a clipped "Alche", counted conservatively (8 words, 2.73 w/s in its group);
     - S06 shows it whole, as the reading budget above already counts.
2. **S06: the 'Cloud Computer' chip is moved.** At the kit's x 930-1044, S06's framing (right edge x 972.4) cuts the chip to "Cl", so the legible count from n704 did not hold. Our editor now places the chip at x 862-960. It is whole in S06 and only an icon sliver at the edge of S19. Its words are unchanged.
3. **S14: 'Wish' / 'fast!' are timed as one string.** They are two overlays of the one string 'Wish fast!', so they use that string's window (n1192-1225): 2 words, 1.76 w/s.
4. **The prompt bar has no label.** Its row 2 shows the Manus mark icon, as drafted, so the bar's only words are the prompt.
5. **S06: the project name is moved into frame (verify pass, see `../VERIFY.md`).** At the kit's x 40, 'The Lull' sat outside S06's framing (x 227.6-972.4), so it was counted and captioned but never on screen. S06 now draws it at x 286, above the viewer's left edge. No other framing shows that spot at the title row except S19, where the name stays at x 40, off frame. Its words and S06's count (7 words, 2.92 w/s) are unchanged.
