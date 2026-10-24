# Launch film brief: Manus 2.0, "The Lull" (the astronaut film)

STORYBOARD STAGE, DRAFT v0.1 (2026-10-23). Built from the final story (`hf01-study/storyboard-space/final/STORY.md`,
`SHOTLIST.md` / `shotlist.json`, `CAST.md`, `COPY.md`). Nothing has been generated: every footage shot is a labelled
placeholder plate (`assets/plates/`, drawn by `tools/make_plates.py` from shapes only), every screen is a code stand-in
(`blocks/`). Alex reviews the storyboard before any generation. This job replaces the rejected ridge job
(`launch-videos/manus2-film`, left untouched); its editor, status cards, prompt bar, end card and tools are reused.

## 1. The video

- **Product, in one line:** Manus 2.0: an Automation surfaces the email, Manus Studio's Video Editor (with Alchemy
  creative direction) makes the film, and the always-on Cloud Computer finishes it while she is out of reach.
- **Goal:** a Manus 2.0 launch film that recreates higgsfield01 ("hf01") frame for frame in motion and structure
  (27 shots, 26 cuts on hf01's frames, 76.533 s, 2,296 frames at 30 fps), with our own story, copy, actor, footage and
  music.
- **Logline:** mid-spacewalk, an astronaut gets Marketing's email: the launch moved up, the film is due tonight. With
  five deadpan prompts from her wrist display she has Manus 2.0 recast every disaster that follows (a tether that runs
  out, a debris shower in a solar storm, an airlock that won't seal, a fireball re-entry) as a serene launch film for the
  station's new guest module, and it ships while she is in radio blackout. Then, bobbing on the ocean, she gets the next
  brief.
- **The engine (kept from hf01, in our genre):** a heightened genre (the space-disaster film, played straight); a running
  joke (a calm creative note about the disaster happening to her); a set piece in every loop, escalating; zero-G
  self-talk that literally floats; a deliverable about her own world (the launch film for the module she is working on);
  a punchline ending that starts the loop again ("Undersea next?").
- **The one thing a viewer should remember:** she was out of range, and the film still shipped.
- **Call to action:** none (Manus's own 2.0 film has none). S26 carries a quiet product line; the end card carries the
  end line only. URL line: none until Manus confirms the domain (manus.im vs manus.ai).
- **Where it runs / aspects:** 16:9 first (X, LinkedIn, YouTube, site hero). Cutdowns later.
- **Length:** 76.533 s, locked to hf01's cut frames.

## 2. Story (10 beats, from STORY.md)

1. 09:12, on a spacewalk at the end of the station's truss: her Manus Automation surfaces Marketing's email. Launch
   moved up. Film by tonight? The wrench drifts off her glove; she does not look.
2. The tool bag she lets go of just stays there. She rips open her wrist display; her thoughts float off in zero G
   ('Tonight?' 'From space?' 'Nose itches.' 'Sunrise. Again.' 'Deep breath.' 'Not that deep.'); a T–09:48:00 countdown
   with a capsule glyph (19:00 is also her ride home). She sends P1 with her sunrise clip.
3. Manus keeps it calm; in Studio's Video Editor her sunrise becomes the first shot of The Lull's film, under
   'Breathe easy.' ('Alarms: muted' in the audio row, before anything has gone wrong).
4. Drifting off the hull on a tether that is running out, she sends P2 'Open on this drift.'; it snaps taut and yanks
   her out of frame. 'Drift first.' The drift plays at half speed under 'Breathe easy.' (early payoff 1).
5. Night side, aurora, a solar storm: a debris shower chases her along the truss. P3 'Call it shooting stars.'
   'Wish fast!' 'Debris → stars.' The debris plays slowed and warm under 'Wish slowly.' (early payoff 2). Alchemy adds
   whale song; the guest map builds: 'Loose items leave.'
6. The storm drives her into an airlock that won't seal; the radiation alarm pulses red; the wrench from 09:12 comes
   back and clangs off the rim above her helmet. P4 'Red alarm? Mood lighting.' The hero frame: THE LULL. The quietest
   room in orbit. Mood lighting included.
7. Re-entry: plasma in the window, the plush whale swinging, the signal falling bar by bar. On the last bar:
   P5 'End on this glow. Ship it.' Loss of signal.
8. The file card arrives with a cloud icon and a blue check while she is unreachable.
9. 19:47, splashdown at golden hour: 'Booked solid.' then 'Undersea next?' She looks down at the sea under her boots;
   pull back; the music stops; a gull lands.
10. End card: Out of office. / Out of range. / Still shipping.

## 3. Words

**The five prompts (the plot, sent on hf01's send frames n652 / 913 / 1181 / 1641 / 1895, from her wrist display):**
- P1 S04: Lull launch film. 30s. Make it calm. (+ her sunrise clip chip)
- P2 S09: Open on this drift. (+ live helmet-cam chip)
- P3 S14: Call it shooting stars. (+ live helmet-cam chip)
- P4 S22: Red alarm? Mood lighting.
- P5 S24: End on this glow. Ship it. (+ her glow clip chip; signal 2 → 1 → none → 1 → none → 1 → lost)

**Must say (claims only from PITCH "Facts we may state"):** F1 Manus 2.0, F11 Automations triggered by an email (the
S01 label), F5 / F7 / F9 Manus Studio's Video Editor makes product videos, F8 Alchemy creative direction incl. sound,
F12 / F14 an always-on Cloud Computer. No numbers about Manus anywhere; every number on screen belongs to her day or her
fictional film (09:12, T–09:48:00, 30s, 90 MIN, 19:47). Every line on screen is in `beats.yaml` and checked in the
study's `COPY.md`.

**Must not say:** Manus's UI strings ("Generating footage…", "Mixing the score…", "Ready · …", "Exporting …%",
"Introducing", "Manus 2.0 Max", "Run this task on", the Alchemy line); hf01's lines or a close paraphrase ("safety
video", "Next brief:"); any benchmark, price, availability date or platform; real agencies, stations, vehicles,
insignia; any hand-off nobody has shown, stated as fact (see "Check with Manus" in STORY.md: every such shot carries a
"Check with Manus" note on the board).

**Tone:** a space-disaster film played straight; she is the calmest person in every frame; Manus is honest and plain
('Keeping it calm.', 'Drift first.'), never a joke about her danger. No VO: problem-act words are type only and float.

## 4. Look (Manus brand look, PITCH §2)

- Off-white #F7F7F7 grounds with a 16 px dot grid; ink #1F1F1F (#1D2126 over bright plates, white with a soft dark
  halo over space); one sky-blue #33ABFB on at most one word per card (#2CB4F3 on line icons and the progress
  hairline); Inter for all UI and claims; serif only inside the Manus wordmark file; colour lives in the footage and in
  her film, never in our UI. No status card goes whole-line blue.
- Logos only from `assets/`: `manus-mark-dark.svg`, `manus-wordmark-dark.svg`, the `-white` versions,
  `manus-app-icon.svg` (byte-identical to `hf01-study/manus2/brand/`). The mark never rotates, morphs or acts as a
  character; in the prompt bar it is a small icon in place of a model label (check with Manus).
- Her film, The Lull, has its own look (the client's brand): night navy #0E1A2B, moon white #F4F1EA, soft gold #E8C27A,
  lull red #D9544D, earth blue #6FA8DC; a light geometric sans in tracked caps (Jost Light class; the storyboard uses
  Avenir Next as a stand-in); The Lull mark (crescent cradling a round window, three star dots, night-navy disc).
- World: a fictional, unbranded orbital station (white modules, pale-gold blankets, an open lattice truss with white
  handrails, blue-black arrays, a small white capsule with one orange band, the round-windowed guest module), then
  re-entry and the open ocean at golden hour. Our text-free mission patch is the only insignia.
- One actor (CAST.md): matte white suit, signal-orange bands, clear bubble helmet with the gold visor up (her face
  visible), wrist display under a padded cover.

## 5. Reference (motion and structure only)

- **higgsfield01** (1080×608, 30 fps; a 24p edit delivered at 30): cut points, transitions, camera grammar, overlay
  positions and timings, the beat grid (87.01 BPM, first beat 0.1107 s). Never its frames, copy, characters, UI or
  audio. Study: `hf01-study/` (CUTS-MOTION.md, OVERLAY-SPEC.md, SHOTS.md, SOUND.md).

## 6. Assets

- Brand: the five official SVGs in `assets/`.
- Footage: 12 live-action shots and 5 pieces of her film (A1 sunrise, A2 drift, A3 stars, A4 Marketing's photo of The
  Lull (+ P4's red grade), A5 glow) and two helmet-cam clips for the S11 bin: all PLACEHOLDER PLATES now; the generation
  plan (key stills + image-to-video legs, prompts, cost) is in SHOTLIST.md and waits for Alex's storyboard approval.
- Score: option B, our own `film` groove on hf01's 87.01 BPM grid in F (not rendered at the storyboard stage; the user
  listens). Vacuum rule: in-suit sound only until the re-entry roar.
