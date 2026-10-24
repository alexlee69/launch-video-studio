---
name: hf01-manus2-recreation
description: "higgsfield01 → Manus 2.0 film + skill upgrade (started 2026-10-23); Alex's rules: gpt-image-2 stills via the OpenAI key, fal for video only, Manus logo from manus.im"
metadata:
  node_type: memory
  type: project
  originSessionId: db3322f5-f4cf-44bc-bee5-82db478af53f
  modified: 2026-10-23T18:50:55.041Z
---

On 2026-10-23 Alex asked for four things:
1. Break down `~/Downloads/higgsfield01.mp4` frame by frame. It is Higgsfield's "Higgsfield MCP × Claude Opus 5.5 for Motion Design", 76.53 s, 2296 frames, 1080×608 at 30 fps.
2. Make product-launch-sting able to make this kind of film for Manus.
3. List what the skill is missing.
4. Recreate the film for **Manus 2.0**. The source for Manus 2.0 is its launch post: @ManusAI on X, 2026-09-28, a 166.5 s video.

**Alex's rules for this lane (2026-10-23):**
- **Stills and character sheets** use the OpenAI key with the newest GPT image model.
  - The key is `OPENAI_API_KEY` in `Design-AutoPilot-stable/.env`. Never print it.
  - The model is `gpt-image-2`. Text-to-image goes through `/v1/images/generations`. A consistent character goes through `/v1/images/edits` with multiple reference images (`image[]`), as `pipeline/image_gen.py` does.
  - This approval is for image generation only. Ask before using the key for anything else, such as transcription.
- **fal is for video only** (MiniMax H3 image-to-video). No FLUX stills on this lane.
- **Manus logo:** Alex has no brand kit yet and said to get it online or from the launch video.
  - The official files come from manus.im itself: the hand mark and the serif "manus" wordmark are inline SVGs on the homepage, plus `/icon.svg` and the banner "The general AI agent".
  - The SVGs fill with `var(--logo-color)`. Dark = #34322D (from the app icon); a white version was made too.
  - Saved in `~/Downloads/launch-videos/hf01-study/manus2/brand/`.
  - Never redraw them. Never copy Manus's UI screens from the video.

**Where things are:** `~/Downloads/launch-videos/hf01-study/`.
- `ref/frames` (2296 PNGs) and `ref/audio` hold the reference. They stay local.
- `STUDY-BRIEF.md` is the brief the study agents follow.
- The agents' outputs are `CUTS-MOTION.md`, `SHOTS.md`, `OVERLAY-SPEC.md` and `SOUND.md`.
- `manus2/` holds the launch video, its skill breakdown (`job/reference/`, 58 shots, 128 BPM in parts), `frames2fps/`, and `study/PITCH.md` from workflow `manus2-pitch-study`.
- The 10-21 film kit's blocks (`scene`, `agent`, `roster`, `type`, `lockup`, `stack`, `wall`) came partly from hf01. Only the coarse breakdown (`breakdown-qa/hf01`) existed before this.

**Gaps already confirmed in the skill:**
- `gen.mjs` stills are FLUX text-only, so the skill itself has no consistent-actor route. That is NOT a missing
  capability: the key's access to `gpt-image-2` was verified on 2026-10-23 (`GET /v1/models/gpt-image-2` → 200), and
  working client code exists in `Design-AutoPilot-stable/pipeline/image_gen.py` (generations, plus multi-reference
  `/v1/images/edits`). The gap is only wiring it into the skill (GAPS FT-1 / SC-19, effort S). Alex, 10-23: "we already have
  GPT API".
- There is no persistent corner watermark or handle.
- Footage is picture-only, so there is no ambience or foley.
- The `film` score style is a groove. hf01 opens unpulsed for 22.18 s, then plays an 87.01 BPM half-time groove in F
  minor (SOUND.md; the first-pass "no pulse until 51 s" was wrong).
- The full verified list is `hf01-study/GAPS.md`: 124 rows, 8 have / 83 partial / 33 missing after the gpt-image fix. It
  has a WP-0 gate (merge the 10-21 fix round first) and five work packages, A–E.

**Why:** Alex starts at Manus in Nov 2026 and wants Higgsfield-grade launch films in-house. See [[manus-reel-style-gap]] and [[hf02-motion-recreation]].

**How to apply:**
- Same method as hf02-full (measure, then our own story and copy with their motion), but the film should be built with the skill (beats.yaml plus new blocks) so the skill demonstrably makes it.
- Quote footage spend before generating.
- The 10-21 fix round (57 findings) is still unmerged, so merge it before deep engine work.
- Related: [[launch-video-mode-b]], [[reference-minimax-h3-video-api]].

**Story history:**
- v1.0, 2026-10-23: "Out of office", a founder on a fog-ridge trail run. Storyboard in job `launch-videos/manus2-film/` and
  `hf01-study/storyboard/`. Alex rejected it as boring.
- Then: the astronaut story. A spacewalk, a set-piece loop each, a re-entry radio blackout while the Cloud Computer
  finishes the job, and a "next brief" punchline (never hf01's "safety video").
  - New job: `launch-videos/manus2-space/`; storyboard work in `hf01-study/storyboard-space/`.
  - See [[keep-reference-story-engine]].
- Storyboard DRAFT v0.1 "The Lull" sent to Alex 2026-10-23. Of three drafts, comedy won (291, vs heart 269 and spectacle 244; excitement weighted 1.5×).
  - Engine: P1 "Lull launch film. 30s. Make it calm.", and every later disaster gets recast as calm luxury.
  - Punchline: "Undersea next?"
  - End card: "Out of office. / Out of range. / Still shipping."
  - Phone PDF: `manus2-space/manus2-space-storyboard-16x9-phone.pdf`, built by `tools/phone_storyboard.mjs`.
  - Plan, decisions and the "Check with Manus" list (7 blocking): `hf01-study/storyboard-space/STORYBOARD.md`.
  - Full pass estimated at ~$43–48. Round 1, the character sheet, is ~$6–7.50; Alex approved it.
- Round 1 (character sheet), 2026-10-23. Method: [[character-sheet-one-face]].
  - **Casting:** Alex wants an Asian or white actor, not Black, and asked for ONE character: an East Asian woman of about 40.
  - **LOCKED 10-23:** `manus2-space/cast/locked/{eva,helmet-off,costume,props}.png`, with a README holding each sheet's chain.
    - `final_data.CHAR` and `CHAR_OFF`, CAST.md and STORYBOARD.md were rewritten to her. SHOTLIST.md and shotlist.json were rebuilt.
    - The storyboard's drawn plates still show the old stand-in figure.
  - **Rebuild traps in `final/tools/build.py`:**
    - Always run it with `--selftest`, or the docs record "selftest: not run".
    - Every rebuild deletes the hand-appended "## Storyboard build" section at the end of COPY.md, so re-append it from `recast-rollback/COPY.md`.
  - **Round 1 total:** 9 calls, $2.23, against the ~$6–7.50 approved.
- **Round 2, 10-23** (Alex: "quote the exact cost before each batch"; every quote landed within ±$0.08):
  - **Tool:** `manus2-space/tools/keyframes.py` (plan / locations / pick-location / keys; ledger in `stills/ledger.jsonl`).
  - **Outputs:** locations in `stills/locations/` (symlinked picks), keys in `stills/keys/`, picks in `stills/picks.json`, phone sheets in `stills/review/`.
  - **Total:** $10.88 for 4 location plates and 16 key frames (two variants each), plus fixes.
  - **Real rate at 2K:** 7.4k output tokens per image, and a 2560×1440 reference costs ~3,016 input tokens (not 1,024).
  - **Side errors:** about half the frames mirror her "left" items (patch and display together) while the camera stays right.
    - A "move the patch" edit FAILED: it put the patch on her thigh.
    - The reliable fix is a removal edit plus `tools/region_paste.py` on the shoulder box only.
  - **4A** came back in daylight twice, so `EXTRA['4A']` forces dawn darkness.
  - **Picks and her film's stills:**
    - Alex approved the 16 key-frame picks.
    - Her film's stills A1–A5 are done for $2.36 (`keyframes.py ad`; picks in `stills/picks.json` under "ad").
    - Round 2 total is $13.24, against the plan's $12.80–16.00.
- **Round 3, 10-23:** the 7 identity legs on fal H3 cost exactly $6.40.
  - **Risk accepted:** Alex said he accepts the risk on the open "Check with Manus" items.
  - **Files:** clips in `manus2-space/footage/fal/*.mp4`; inputs are 1920×1080 JPEGs plus prompt files in `footage/fal/in/`.
  - **Review:** reel `footage/review/identity-legs-take1.mp4`; strips from `tools/review_clips.py`.
  - **Identity held in all 7.**
  - **S01 1c missed its beat:** the wrench never leaves her glove, and that is the setup for the S22 payoff. A retake costs $0.80.
  - **Tooling traps:**
    - This Mac's ffmpeg has NO drawtext, so labels are rendered as PNGs and overlaid.
    - A seek at the clip's last frame writes an empty PNG, so step back.
  - **Footage complete, 10-23:** all 16 legs, the 1c retake and A1–A3 cost $10.72, for $17.12 of video so far.
    - Alex said "you make the call: as good as hf01, on beat, transitions, editing style".
- **Film build:** `manus2-space`, `beats.yaml` (the storyboard backup is `beats-storyboard-v0.1.yaml`).
  - **Plates:** `tools/plates.py` builds one native-24 fps plate per live-action shot in `assets/footage/`, with the legs joined inside wipes, blooms or blurs (`xfade`). Each shot has `bg:` with `bgMove: none` and `bgDim: 0`.
  - **Editor block:** it gained `media: ['film']` with `ctx.footage` frame swaps, so her clips play in the viewer at a `rate`.
  - **Thumbnails:** the files in `assets/plates/*.png` were rebuilt from the real stills (backup in `plates-storyboard/`).
  - **Overlays** were re-placed off her helmet (S04 words), with a line-art flare glyph and a light S26 product line.
  - **Sound:**
    - `tools/sfx.py` synthesizes 44 events in hf01's SOUND.md §3 slots.
    - The mix is the music stem plus the sfx. hf01 has NO transition whooshes and NO UI sounds, so the whoosh and points stems are dropped.
    - The H3 clips' own audio is tonal music beds, so it isn't used.
  - **`tools/finish.py` (the job's copy):**
    - Builds hf01's 24p-in-30p cadence with repeats at n%15 ∈ {5,10,14}. Each shot is picked on its OWN clock, `j = 2N_k + ceil(2.5(m(n) − m(N_k)))`, then clamped inside the shot. The plain `ceil(2.5·m)` is WRONG: it gives early cuts and 12 fps judder.
    - The corner bug exists but is OFF for this film (`--no-wm`).
    - Its own mix lands at -14.5 LUFS and -2.0 dBTP after AAC.
  - **The skill's generic version** is `video/recreate/finish.py`, with the same clocks.
    - Shot starts come from `out/main/timeline.json` by default.
    - It masters like the engine: -14.0 LUFS, -1.1 dBTP.
    - Ported 10-23, with 35/35 tests (`qa/hf01-skill-port/lead/tests.sh`).
    - Fix-round note: `qa/launch-video-skill-review/NOTE-hf01-port.md`. Run its `apply_pointers.py` after the hf02 one.
  - **Baseline proofs:** cuts 25/26 exact plus 1 within ±1; `music.py` "ON THEIR BEAT" (Δ 0.00 BPM, 1.1 ms). Private compares are in `hf01-study/build-compare/`.
  - **Traps:**
    - qlmanage renders SVGs at their intrinsic size and crops them, so render marks with headless Chrome instead.
    - Editing `beats.yaml` or blocks during a `--film` render stales its own QA; wait, then use `--range`.
    - Plain `ceil(2.5m)` 60→24p sampling put 6/26 cuts one frame early. `finish.py need_index()` clamps each sample inside its shot's span; after the fix 25 exact + 1 ±1.
  - **v0.2 → first cut:**
    - Plates are graded to hf01's measured look: `assets/footage-graded/` and `GRADES.txt`, eased so her face isn't crushed.
    - S04's glyphs and words were re-anchored off her body; the final frame glyph boxes the real sun (`tools/fix_s04_glyphs.py`).
    - S18's icon pop starts at n1361 (fixes QA near-empty 2724–2726, as hf01).
    - The corner bug is OFF: it wasn't in the approved storyboard and it collided with the bars and bubbles.
    - Open choice for Alex: hf01's first 22 s are an unpulsed drone, while our `film` intro has an on-grid arpeggio.
  - **FIRST CUT sent 10-23:**
    - Files: `manus2-space-firstcut-16x9.mp4` (73 MB master); the phone copy `-firstcut-phone.mp4` is 25.6 MiB.
    - The private side-by-side is `hf01-study/build-compare/firstcut/sbs-PRIVATE-phone.mp4`.
    - **Proofs:** engine QA PASSED 28/28; cuts 25 exact + 1 ±1 with 2296/2296 verified; ON THEIR BEAT (Δ 0.00 BPM, 3.7 ms, sting 5 ms); 454/459 repeat slots, the other 5 being encoder noise.
    - **The app's phone/web upload limit is 30 MiB:** make two-pass copies at ~2.6 Mbps for 76 s at 1080p.
    - **24p sampling must be SHOT-anchored:** `j = 2N_k + ceil(2.5(m(n) − m(N_k)))`, then clamped. Anchoring to the film's grid made shots that start on n%15=4 cuts judder at 12 fps (S03, S12, S15, S17, S19; the fork found it).
    - **End-card hold:** the engine maps a hold to 60 fps as `[2(f0+a)+1, 2(f0+b)]`, so a final hold needs `b = X.5` to cover the last frame.
  - **"add the bgm in there" (10-23):** read as the hf02 precedent, i.e. the private temp track.
    - Files: `out/manus2-space-firstcut-tempmusic-PRIVATE.mp4` and the phone copy `-PRIVATE-phone.mp4` (24.8 MiB, with hf01's audio md5-identical).
    - **Found:** our first 20 s are -22 dBFS RMS against hf01's -13 to -15. hf01 opens on drone + ambience + VO; ours opens on a thin pad, so the opening reads as "no BGM".
    - Offered: lift our own opening. Alex said "lift it" (10-23): `tools/opening_bed.py` adds an unpulsed F drone at 0-22.18 s, mixed in `finish.py` as a third input. The opening is now -13..-15 dBFS like hf01, still ON THEIR BEAT. The cut is `manus2-space-firstcut-16x9.mp4` (v2); the quiet-opening v1 is kept in `out/v0.1/`.
  - **Tool:** `manus2-space/tools/cast_sheet.py` (plan / candidates / lock / states / cost). Every call goes to `cast/round1/ledger.jsonl`, with a hard cap of $8.50.
  - **The sheet:** `cast/round1/candidates/cand-02.png`, 2560×1440. Cost $0.22; the round so far is $1.05.
  - **Known misses on cand-02:** the back view has the patch on the wrong shoulder, the helmet camera is on her left, and the grey is #848483 rather than #8a8a8a.
  - **Price facts:**
    - gpt-image-2 has no `input_fidelity`.
    - 2K (2560×1440) is accepted, at ~7.4k output tokens ≈ $0.23.
    - A 1024² high-quality image is ~7k tokens. A reference image costs ~1,024 input tokens.
