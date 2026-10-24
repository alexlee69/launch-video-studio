# The Lull: cast (final)

**FINAL storyboard v1.0 (astronaut), 2026-10-23, for Alex's review.** Recast and locked the same day:
- Alex asked for an Asian or white actor and chose one East Asian woman of about 40.
- Her character sheets are generated and locked on gpt-image-2. See "The locked character sheets" below.
- No key still or video has been generated yet.

One actor across the film's 12 live-action shots: S01-S04, S09, S14, S15, S20-S22, S24 and S26.
- She appears in 11 of them and her face in 8 (S01, S04, S09, S14, S20, S22, S24, S26).
- S02, S03 and S15 show only her gloves, the tool bag and the wrist display. S21 is the wrench in flight, with no one in it.

hf01's adventurer is one face in one jacket across 13 plates. She must be the same person in the same suit in every generated plate, so we lock her in a character sheet first. Every key still is built from that sheet as an image reference, never from text alone.

The prompt strings live in `tools/final_data.py` and are pasted into every key-still prompt:
- `CHAR`: the EVA suit;
- `CHAR_SEAT`: the same suit with the backpack removed, for the capsule;
- `CHAR_OFF`: helmet and cap off, for the sea.

**Changes from the comedy draft:**
- **The suit:** the backpack comes off in the capsule (`CHAR_SEAT`). The thigh pocket, the tape roll and the rescue jet are gone.
- **The wrench:** it is not tethered. It leaves her glove in S01 and comes back in S21-S22.
- **The wrist display:** it has a padded cover, which she rips open in S03.
- **The tether:** it runs out and snaps taut in S09.
- **Prompt wording:** no generation prompt names what it forbids.

## Who she is

- **Character:** Commander Wren Adair (fictional). Her name never appears on screen. She is the mission specialist on a fictional, unbranded commercial station. She is out on a routine spacewalk at the new guest module on the day Marketing needs its launch film, and it is also the day her capsule takes her home.
- **The comic persona:** the calmest person in every frame. She never panics and never raises her voice, and she treats every disaster as footage. The comedy needs a face that can do four things:
  - a long, flat, unimpressed stare (S01);
  - a weary sigh (S04);
  - real delight (S14);
  - a slow deadpan look down (S26).

  Cast for eyebrows: through a helmet bubble they carry most of the jokes.
- **Age range:** 38-44; reads about 40.
- **Build:** athletic, about 170 cm, strong shoulders. She hauls herself along a truss in S14-S15.
- **Face:**
  - East Asian, light warm skin (the locked face: `manus2-space/cast/locked/eva.png`, left panel);
  - strong, expressive dark eyebrows with a small pale scar through the left brow (the continuity anchor in every close-up);
  - dark brown eyes, faint laugh lines;
  - no make-up look, no retouching.
- **Hair under the helmet:** short straight black hair, cropped close at the sides. Whenever the helmet is on, it sits fully under a black fabric comms cap (a soft skullcap with small ear cups). In S26 the cap is off and the hair is short and wet (`cast/locked/helmet-off.png`).
- **Never on her:** sunglasses, a lowered gold visor in a hero shot, jewellery, visible logos, a name tag, a flag.

## The suit

One fictional suit for the whole film, EVA and re-entry alike. Only the backpack, the helmet, the cap and the wet state change. A real crew changes into an entry suit for S24. We keep one wardrobe for identity, as hf01 keeps one jacket (STORY.md, open choices).

| Item | Look | Why |
|---|---|---|
| **Suit body** | Matte white multi-layer fabric: a hard upper torso with soft quilted arms and legs. No flags, logos, name tags or lettering anywhere | Reads as "spacesuit" at once without being any real programme's suit |
| **Backpack** | A white life-support backpack, on for EVA (S01-S22). **Removed** in the capsule and on the sea (S24, S26), so no pack fights the seat | The fidelity judge's S24 note: an EVA pack does not fit a reclined couch |
| **Hero colour accent** | **Signal orange** (target #F26A1B; graded median ~#E8611E): one wide band around each upper arm and each thigh, and the helmet's neck ring | The only saturated warm colour in a world of black space, white hardware and blue Earth: 3-8 % of the frame in MCU and medium shots. It sits opposite our sky-blue #33ABFB UI accent, as hf01's cobalt jacket sat opposite its orange UI. The capsule's band uses the same colour (S24-S26) |
| **Mission patch (ours)** | An embroidered roundel on the left shoulder: navy twill, a gold border, a moon-white crescent cradling a small circle (The Lull's round window) and three gold stars. **No lettering** | Our own patch and the only insignia. The same patch is the title's embroidered sticker (S01) |
| **Helmet** | A clear bubble helmet with two small lamps at the temples and a small helmet camera on the right side. Its **gold sun visor is always raised** in the hero shots | Her face must be fully visible through the bubble, with no reflection across the eyes. The helmet camera records the film's own footage (A1, A2, A3, A5) |
| **Wrist display** | A slim dark screen in a white rugged bezel, strapped over the left forearm cuff, under a **padded white Velcro cover** with a small window strip. The strip lights for notifications (S01). She rips the cover open to work (S03). The screen is **never readable** in any plate | Every prompt, bubble and signal glyph is our composited overlay, so the plate never has to match the UI. She taps it with one gloved finger, a broad gesture with no fine finger work |
| **Gloves** | White, with orange fingertip grips | The orange tips make the taps read at a distance |
| **Safety tether** | An orange-sleeved line on a small reel at the waist, ending in a steel hook clipped to a handrail | It pays out and snaps taut in S09. It lies across the outer hatch's seal in S20, which is why that hatch will not close |

## Props, animals and places

**Props and animals**
- **Tool bag:** small and white, with an orange pull tab and a carabiner. In S02 she lets go of it and it stays put.
- **Wrench:** small, silver, **not tethered**. It drifts off her glove in S01 while she reads the email. It comes back in S21 (tumbling through the gap of the outer hatch) and clangs off the rim above her helmet in S22. The S19 house rule 'Loose items leave.' sets this up.
- **Plush whale:** a small, pale blue-grey plush whale on a cord in the capsule (S24). Crews really do fly a small toy as a zero-G indicator: it starts floating when you reach orbit. It swings forward under deceleration, and on the sea it is tucked under her arm (S26). Optional; nothing depends on it.
- **Seagull (S26):** one ordinary gull. It glides in and lands on top of the capsule as the camera pulls back, in hf01's cat slot, on n2072 with the groove stop. A real bird, not a mascot.

**Location sheets.** Generate each once and reuse it as a reference, so the places stay the same.
- **The station exterior** (S01, S02-S04, S09, S14-S15):
  - white modules in matte white and pale-gold insulation;
  - a long open lattice truss with **white** handrails;
  - **blue-black** solar arrays;
  - a small white gumdrop capsule with one orange band, docked at a port (her ride home, planted in S01);
  - the new guest module, **The Lull**: a soft, rounded white module with **one large round window**.
- **The airlock** (S20-S22): a cramped white cylinder with padded walls and handholds and steady cool panel light.
  - The round outer hatch stands half-closed on her tether, with the sun's hard white glare in the gap.
  - The round inner hatch has a metal rim.
  - The red alarm is a comp grade, not part of the location.
- **The capsule interior** (S24): small and dim, with grey padded panels, reclined seats with harness straps, a few dim indicator lights (no readable screens) and one small round window.
- **The capsule on the sea** (S26): the same white gumdrop with one orange band, hatch open on top, bobbing on an open golden-hour sea. A recovery boat is a speck on the horizon.

**Prompt hygiene (the fidelity judge's fix).** No generation prompt names what it forbids, because naming a thing pulls the model toward it. Prompts describe what things are: "blue-black solar arrays", "one large round window", "unbranded and fictional: no logos, no flags, no name tags and no lettering". The ban list is a build check, never prompt text:
- **Real hardware:** real agencies, stations, vehicles and their signature parts (BANNED_WORLD in `tools/final_data.py`).
- **hf01's world:** jungle, waterfall, rope bridge, temple, cave, ruins, boulder, monkeys, macaws, arrow.
- **Manus's plates:** waterfall, glacier canyon, salt flat, rock spires, dunes, dumpling shop, shophouse street.

`tools/build.py` fails if any of them appears in any key-still, motion or ad prompt. So far 0 have appeared, and the fidelity judge's own scan agrees.

## State per plate (continuity)

| Shot | Where / light | Variant | Helmet | Cap | Expression | Wrist display | Hands |
|---|---|---|---|---|---|---|---|
| S01 | truss end at the Lull module, hard orbital daylight | CHAR | on, visor up | on | working, then reading: a long flat 'you are kidding me' stare | cover's window strip lights at n248-256, read | the wrench in one glove, then it drifts off, untethered |
| S02 | station hull | (glove only) | | | | | lets go of the tool bag; it stays |
| S03 | station hull, dawn side light | (gloves, forearm) | | | | rips the padded cover open; the screen glows | one broad pull |
| S04 | the Lull module's hull, orbital dawn -> sunrise blast -> day | CHAR | on, visor up | on | weary sigh; nose-itch frustration (glove bonks the bubble); squint and turn from the sun; big breath, hesitation | open, read, then tapped in three bursts | one glove on a handrail |
| S09 | adrift beside the station, hard daylight | CHAR | on, visor up | on | serene, eyebrows up, unbothered; a jolt at the snap | tapped calmly | free; the tether paying out from her waist, then snapping taut |
| S14 | the truss at night over an aurora, floodlights + helmet lamps | CHAR | on, visor up | on | focused while hauling, then a **delighted open-mouthed shout** in profile | tapped one-handed between grabs | hand over hand on the rail |
| S15 | (gloves only) | | | | | | grabbing rail after rail |
| S20 | the airlock, steady cool light (red pulse in comp) | CHAR | on, visor up | on | effort, a half-turn, then breathless | | tucked |
| S22 | the airlock, steady cool light (red pulse in comp) | CHAR | on, visor up | on | eyes tracking the wrench, deadpan; a long blink; composed | lifted and tapped | curled against the inner hatch |
| S24 | the capsule, plasma glow + dim cabin | **CHAR_SEAT** (no backpack) | on, visor up | on | completely calm while everything shakes; patient; one firm tap | tapped, held, tapped | strapped in |
| S26 | on top of the capsule, golden-hour sea | **CHAR_OFF** (no backpack) | **off**, on her lap | **off**, wet black hair | eyes closed, relieved smile at the sun; reads and smiles; the smile fades into a slow deadpan look down at the water | read | the plush whale under one arm |

## The locked character sheets (Round 1, 2026-10-23)

Built the Higgsfield way:
- Academy, "One face per character sheet".
- OSideMedia `ad-asset-prep`, "Design for win rate".

Each sheet is ONE image: a close-up, a full body front and a full body back, on a flat solid neutral grey #8a8a8a. Every
sheet carries exactly one readable face, because a reference with several faces gets averaged into a generic one. Each
state is its own sheet. Costume details and props are on faceless sheets.

| Sheet (`manus2-space/cast/locked/`) | What it is | The reference for |
|---|---|---|
| `eva.png` | Close-up (helmet on, visor up), full body front (face erased), full body back. EVA suit with backpack | Every helmet-on still: S01, S04, S09, S14, S20, S22; S24 with "backpack removed" |
| `helmet-off.png` | Close-up (helmet and cap off, wet short black hair), front (face erased, helmet under her arm), back. No backpack | S26 |
| `costume.png` | Faceless: the patch, the wrist display covered and open, the empty helmet (camera on its right), a glove, the tether reel and hook | Any shot showing these up close (S02, S03, S15) |
| `props.png` | Faceless: the tool bag, the wrench, the plush whale, the gumdrop capsule | S01, S02, S21, S22, S24, S26 |

**How they were made** (`manus2-space/tools/cast_sheet.py` and `pin_grey.py`; every call is in `cast/round1/ledger.jsonl`):
1. **Candidate sheet:** `cast/round1/candidates/cand-02.png`, 2560x1440 on gpt-image-2 at high quality. Alex picked it.
2. **Lock edit:** one edit erased the face on the front full body. It also moved the helmet camera to her right and the back view's patch to her left shoulder.
3. **Face restore:** her untouched close-up face was masked back onto the edit (`eva-composite.json`), because edits soften skin.
4. **State sheets:** the three state sheets were built with `eva.png` as the reference. The props capsule came out as a ball, so it was fixed with one tile edit and pasted onto the sheet (`props-composite.json`).
5. **Grey:** every background was pinned to #8a8a8a with `pin_grey.py`, which leaves the subject untouched.

**Not on the sheets, by design:** the expression strip, the light variants and the poses carried extra faces, so they were
dropped. They belong in the screen test, a cheap audition video in motion before any scene spend.

**Identity QA before any video.** Check every key still against the left panel of `eva.png` (`helmet-off.png` for S26):
- the brow scar on the left;
- the eyebrows' shape;
- the skin tone;
- the orange bands on both arms and both thighs;
- the patch on the left shoulder only;
- the visor raised;
- the helmet camera on her right;
- the wrist display on the left forearm;
- the backpack on for EVA and off in S24 / S26.

Re-roll on any miss.

**Identity-critical shots:** S01 leg 1c, S04 leg 4A, S09, S14 leg 14B, S22, S24 and S26. Her face is largest in these, so generate them first and budget re-rolls on them. The order is: character sheet, then location sheets, then these seven, then the rest, then the ad legs (SHOTLIST.md, generation plan).
