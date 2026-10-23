---
name: hf02-motion-recreation
description: "Higgsfield film 02 rebuilt frame-for-frame: 7 s motion test (approved) + the full 63.6 s Cue film in ~/Downloads/launch-videos/hf02-full/ (finished 2026-10-22; film.mp4 = our score, private temp-track copies in out/); its tools ported into the skill 2026-10-22"
metadata:
  node_type: memory
  type: project
  originSessionId: db3322f5-f4cf-44bc-bee5-82db478af53f
  modified: 2026-10-23T01:35:00.000Z
---

2026-10-21: Alex asked to recreate `~/Downloads/higgsfield02.mp4` focusing on the motion design 00:10–00:17 (frames 300–509 @30 fps). Delivered `hf02-recreate.mp4` (1920×1080, 210 frames) plus frame-exact side-by-sides (normal + half speed) and `MOTION-SPEC.md`. Alex: "Motion looks right." Same day, sound was added via `node audio.mjs`: an original 120 BPM bed phased onto the list steps, plus whooshes, pops and ticks cued one line per motion event. Master −14.1 LUFS / −1.3 dBTP after AAC; stems are in `audio/`. Checked by meters only (`tools/audio_qa.py`); Alex: "Sound works". Alex then approved upgrading the skill's film blocks with this motion (drift cuts, camera zoom/offset/pan, agent and roster upgrades, rebuilding the 7 s from a beats.yaml as proof). It was designed but NOT started, and no skill file was edited. The full design, numbers, tools, staged job `launch-videos/hf02-skill/` (reference frames, curves, a baseline tar of the skill) and open items (film-sample QA `content` FAIL at hook's opening; film-sample copy reuses Higgsfield lines) are in `Design-AutoPilot-stable/HANDOVER-hf02-motion.md`. Only one session should edit the skill at a time. Alex's decision (2026-10-21): the film/reel-kit session ("Motion design skills for content role") builds the upgrade from the handover; the hf02 session only answers measurement questions. **UPGRADE BUILT + merged into live 2026-10-21 19:43** (15 files; old jobs pixel-identical; proof `hf02-skill/hf02-proof-*.mp4` QA PASSED ×3; A 2.67 / B 4.79 / D 5.2 px max, C 10–17 px = one-rule slot model; roster param `start` renamed `first` (reserved field)). Open measurement questions sent to the hf02 session 10-21 ~21:50 (entrance strengths ×1.7–6.5 above the handover's E, blur .25 vs .2, per-step slot nudges); answers expected in `hf02-skill/ANSWERS-measurements.md`.

**Full film (started 2026-10-21):** Alex then asked to copy the whole 63.6 s video frame by frame. Scope set and told to Alex: the motion matches frame for frame (cuts, transitions, camera, easing, blur, event timings, beat grid). Every scene's composition, story (the crew builds "Hush", a podcast app), copy, cast, pictures, lockup and music is ORIGINAL, with no traced layouts. Swapping names into their scenes would just be their film again.
- **Job:** `launch-videos/hf02-full/`. `BRIEF.md` is the builder brief; `story.js` holds all copy; shared parts are in `lib/` (core, cast, art, app).
- **Builders:** six parallel opus builders W1–W6, each owning one `scenes/wN-*.js` + `motion/wN.js` + `notes/wN.md`.
- **Score:** `audio.mjs` is our own composition on the reference's 87.46 BPM grid (first beat 0.3905 s) and its energy section map.
  - **Re-measured 2026-10-22** on the decoded reference (`tools/beat_check.py`): the drop fades from 57.1 s into a −30…−36 dB bed, silence starts at 59.5 s, and the hit is at **59.939 s** (n1798.2). The earlier "59.75–60.0 / n1801.5" was wrong.
  - The score is fixed to match, and its onset cross-correlation with the reference is 0 ms.
- **Music decision (2026-10-22):** Alex asked several times to put Higgsfield's own BGM under the film ("private testing", "won't be shared"). I first declined and wrote an original F-major score, `audio.mjs`, matched to the reference's measured profile (`tools/music_profile.py`: 16th density, band balance, centroid ~3.2 kHz).
  - **Reversed on the next ask ("bgm"):** a temp track from Alex's own copy, for private review, is standard editing practice.
  - `out/film-tempmusic-PRIVATE.mp4` and `out/film-share-tempmusic-PRIVATE.mp4` carry the reference's audio, stream-copied. Verified: decoded PCM bit-identical, same 2112-sample priming, hit on n1798 like theirs. The file metadata marks them private.
  - `film.mp4` keeps our score and is the shareable master. Send the temp copies to Alex only.
  - Verified "on beat" with the skill's tracker (`node lib/breakdown.mjs --tempo`): ours reads 87.45 BPM, first beat 0.3913 s; theirs 87.46 BPM, first beat 0.3905 s. Our confidence is 0.74 against their 0.94.
  - Trap: flattening the 16ths killed the pulse (confidence 0.16), and off-beat stabs flipped the tracked phase half a beat. Accent the beats.
  - A track Alex licenses can be synced in.
- **Cue rebrand (2026-10-22):** Alex asked to replace the mockups with Manus's Cue.
  - **Copy:** `story.js` now tells a Cue story ("Plan Saturday dinner for six": agents research, review, rank, plan, call, email, and only spend after approval). The claims are flagged for Manus to confirm.
  - **Art:** mascots, logo, font and screens may only come from Manus's official kit, which isn't on this Mac. Our original crew stays as stand-ins. `STORY.brandArt.cast` plus `crewArt()` in `lib/cast.js` will show official files as supplied.
  - **Cue installer:** the DMG (`~/Downloads/Cue-1.0.7-mac-arm64.dmg`, read-only mount, no SLA) has small official UI assets (cueLogo, app icon, agent icons) but not the mascot line-up. Not used without Alex's OK.
  - **Fixes made while swapping:** W1's lockup letter table assumed the old sub-line length (now resampled); W5 had hard-coded podcast titles (now Cue story). `tools/stage_errors.mjs` prints page errors with file:line.
- **Footage v3 (2026-10-22):** plate 2 and six carousel clips, each a FLUX raw key frame then `h3-max/image-to-video`, in `out/fal/v3/`.
  - Grade targets measured on the reference: carousel cards are bright, soft daylight UGC (p50 125, saturation 21); plate 2 is low-key (p50 63, saturation 46).
  - Carousel phones were generated with black screens. `tools/fal/carousel_pin.py` tracks each screen (numpy union-find + geodesic regrow, diagonal-extreme corners) and pins our own `ui_home.png` (`tools/fal/ui_screen.mjs`) behind the fingers, then grades and conforms.
- **Logos (2026-10-22):** both are official files from the Cue app, used as supplied and only in logo positions, never redrawn or cast as agents:
  - the Cue app icon (`brand/cue/official/cue-icon.png`, which shows the grey "Cue!" character) in the lockup mark, the end card and the app header, after Alex said the stand-in mark was "not accurate";
  - Manus's hand mark (`logo.webp`) in the "by Manus" tile.
  - Hook: `STORY.brandArt.logo` + `logoInset` (the icon's transparent margin, 100/1024).
- **Finished film 2026-10-22:** `film.mp4` (35 MB, desktop only) and `out/film-share.mp4` (16 MB, sent).
  - Verified: 22/22 cuts (19 exact, 2 within 1 f); hit at 59.939 s; tracker grid 87.45 BPM, first beat 0.3912 s.
  - Still stand-ins: the mascots (our crew), the Cue mark and the app screens, until Manus's official kit arrives.
- **Full render 2026-10-22:** all 22 cuts built; 19 exact, 2 within 1 f (dissolve, whip).
  - Plate 1 is real footage (`STORY.footage.plate1` = `out/fal/v2/plate1-v2-fit.mp4`, see [[reference-minimax-h3-video-api]]).
  - Plate 2 and the carousel are still illustrated.
  - `film.mp4` is about 30 MiB; send `out/film-share.mp4` (crf 21) to Remote Control viewers.
- **Copy trap (fixed 2026-10-21):** my first `story.js` swapped nouns into the source's sentences ("Viewers keep asking for the same three things" → "Listeners…", "Your app blueprint is ready." → "Your Hush plan is ready."). That is substitution, not original copy. Write each line fresh, then compare it with the source line shown at the same moment.
- **WIP check (2026-10-21, ~21:00):** rough cut + side-by-side in `out/wip/`; 15 of 21 real cuts had both sides built, all on the source's exact frame (the n357 dissolve within 1 f); the other 6 touch W4's unbuilt shots (n641–670, n743–971), the long pole. A cut next to a blank shot "matches" trivially, so don't count it. Progress tools: `tools/progress_sheet.py`, `tools/cutcheck.py`, `tools/verify_sbs.py`.

**Why:** Alex wants Higgsfield-grade motion for Manus films (see [[manus-reel-style-gap]]); the film-kit blocks were approximations, so this one was measured, not eyeballed.

**How to apply:**
- Job layout: `stage.html` (pure `seek(n)`, copy/cast at the top: `PROMPT`, `CREW`) + `motion.js` (every measured curve) → `node render.mjs` (~25 s) → `python3 tools/qa.py hf02-recreate.mp4`.
- Cast is six ORIGINAL characters (Scout, Critic, Analyst, Director, Builder, Writer); never redraw the source's mascots, copy or watermark.
- The grammar worth porting into [[launch-video-mode-b]] blocks: every cut is a **momentum cut** (each shot drifts, accelerates into the cut at peak blur, the next shot enters moving the same way and eases out). Blur ≈ 0.2 × px/frame. A list scrolls behind a fixed highlight slot and never stops (min ~4 px/f), with fly-ins from the left and pale-tint text reveals.
- Port it as a mode or blocks of product-launch-sting, never a new skill ([[feedback-one-skill-per-domain]]).
- Measurement method and its traps: [[reference-video-motion-measurement]].

**Ported into the skill (merged 2026-10-22 18:27 PDT):** the fal footage tools, look/conform/pin, the compare/cut/beat proofs, the temp track and the score (as `music: film`) are now tools in [[launch-video-mode-b]]. The job's own `tools/` stay as they are. Two number caveats:
- **Look numbers:** every look number above came from ffmpeg's default decode, which reads ~1.8 code values dark at 1928 and 1080 px wide ([[reference-ffmpeg8-mux-traps]]). The skill's exact decode reads the reference about 2 higher: plate 1 p50 82.2, plate 2 65.1, cards 127.1. The gaps between ours and theirs barely moved.
- **Tracker confidence:** the fix round's wt-tools `breakdown.mjs` (still unmerged) reads higgsfield02's tempo confidence as 0.55 instead of 0.94 (`offBeat: true`). Ours stays 0.745, and the verdict is still ON THEIR BEAT.
