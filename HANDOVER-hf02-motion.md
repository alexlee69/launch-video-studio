# Handover: Higgsfield motion study (film 02, 00:10–00:17) → the launch-video skill

From the "Higgsfield motion design recreation" session, 2026-10-21. Paste this into the session that works on the
`product-launch-sting` skill (the reel kit and film kit). It covers:
- what was measured on a real Higgsfield film;
- what was rebuilt, and how closely it matches;
- the approved next step (upgrading the skill's film blocks with that motion), designed but **not started**.

## Who and why

- **Alex** joins Manus next month and will run their content. He uses CapCut only; he isn't a motion designer.
- **Goal**: Higgsfield-grade launch films and reels for Manus, made with the `product-launch-sting` skill (mode B: `~/.claude/skills/product-launch-sting/video/`).
- **Standing rules** (also in memory):
  - Extend this one skill; never make a parallel one.
  - Use original characters and copy; never Higgsfield's footage, logos, mascots or lines.
  - Manus assets come only from the official brand kit.
  - Audio is checked by meters only, so always ask Alex to listen.
  - Never commit or push without his explicit OK. The backup repo is the private `alexlee69/launch-video-studio`.
- **Work cadence**: an Opus worker plus a parallel Opus monitor; then a Sonnet → Codex → Opus review chain; then three real QA runs; then Alex's own test.

## What this session did

Alex gave `~/Downloads/higgsfield02.mp4` (1080×608, 30 fps) and asked for a frame-by-frame recreation of **00:10–00:17**, with the focus on motion design.

**Delivered** (`~/Downloads/launch-videos/hf02-recreate/`). Alex reviewed both passes: "Motion looks right", then "Sound works".

| What | File |
|---|---|
| Recreation, 1920×1080 @ 30 fps, 7.0 s | `hf02-recreate.mp4` |
| Frame-exact side-by-sides (with our sound; half speed is silent) | `out/compare-side-by-side.mp4`, `out/compare-side-by-side-half-speed.mp4` |
| Full frame-level breakdown (shot list, curves, timings, sound) | `MOTION-SPEC.md` (**read this first**) |
| The scene: pure `seek(n)`, with copy and cast at the top | `stage.html` |
| Every measured curve as per-frame tables | `motion.js` |
| Renderer: Playwright to frames to `out/hf02-recreate-silent.mp4`, re-muxes if sound exists | `render.mjs` |
| Original synthesized bed + motion-cued SFX, master, stems, mux | `audio.mjs` |
| Stems for CapCut | `audio/hf02-music.wav`, `audio/hf02-sfx.wav` |
| QA: format, blank and frozen frames; audio loudness, cue sync, picture-cut ↔ whoosh sync | `tools/qa.py`, `tools/audio_qa.py` |

**Changed from the reference:**
- **Cast**: six original characters (Scout, Critic, Analyst, Director, Builder, Writer) with our own copy.
- **No Higgsfield watermark.**
- **Type**: Inter at −0.01 em. The source face looks like SF Pro.

**How close it is.** The same tracker was run on the reference and on our render:
- Camera within 1.53 px at worst (mean ≤ 0.5 px, in 1080-wide px) and within 0.3% in scale.
- The list offset and slot position within 0.9 px.
- Every cut lands on the same frame.
- QA passes, and fails as it should on planted broken copies.
- Re-renders are bit-identical.

## The measured grammar (the useful part)

All numbers are in 1080-wide source px and 30 fps frames. Multiply px by 1.778 for 1080p. Frame n = source frame (n300 = 10.000 s).

**Shots**

| Shot | Frames | What it shows |
|---|---|---|
| A | n300–311 | chat close-up |
| B | n312–356 | the app window |
| C | n357–464 | agent list behind a fixed highlight slot (B→C is one 50% dissolve frame at n357) |
| D | n465–509 | chat close-up 2 |

The next shot (a 3D post card) starts at n510.

**Momentum cuts, the core idea.** Every shot is one continuous drift. It speeds up into the cut with motion blur, cuts on the fastest frame, and the next shot starts already moving the same way, then eases out. Nothing ever holds still: the slowest camera speed in 7 s is about 0.4 px/f.

**Camera curves**

| Move | Measurement |
|---|---|
| Exit build | ×1.2–1.4 per frame over ~10–12 frames (expo-in) |
| Exit peak speed | A 13.9 px/f (pan right); C 21 px/f (up); D 22 px/f (up); B 10 px/f (tilt down) |
| Exit travel | 5% of the frame width, or 6–13% of its height |
| Entrance | starts at 15–45 px/f and decays ×≈0.70 per frame (B entered at 32 px/f) |
| In-shot pan (B reveals the sidebar) | tanh profile, τ ≈ 2.7 frames, peak 29 px/f at n333.5, travel 154 px (14% W). Sidebar contents then fade and unblur in 2–3 frames, and the skeleton slot follows a frame later |
| Motion blur | σ ≈ 0.2 × speed, along the direction of travel. Visible from about 8 px/f |
| Zoom | none. Scale stays 1.000 within every shot; the UI is reframed by cuts, not zooms |

**Window chrome.** When cutting from close-up to window, the header and rules fade in over 4 frames. In the input bar:
- the outline fades in;
- the send button grows from a dot over about 9 frames;
- the placeholder wipes in left to right;
- the glyphs arrive last.

**Agent list (C)**
- **Scroll**: rows are 174 px apart, and the list never stops.
  - The minimum speed is about 4 px/f, as a base drift.
  - Steps (tanh, τ ≈ 1.84) peak at 35 px/f every 15 frames (0.5 s): n394.5, 409.5, 424.5.
  - Then one fast three-row run (τ ≈ 2.2) peaks at about 100 px/f at n439.5.
- **Slot**: it drifts up about 1.2 px/f. Each step nudges it about 14 px down, peaking roughly 4 frames after the step, and it recovers.
- **First agent**: it drops into the slot from above, clipped by the slot's top edge. It falls at 85 px/f, decelerating to 0 by n369, overshoots about 28 px left and 11 px down, and settles by n377.
- **Fly-ins**: the others fly in from the left edge in about 3 frames and land 2.5 frames after their step peak (n397, 411, 427, 434, 438). Each overshoots 7 px and settles over 6 frames. The last two land in the rows below the slot, just before the fast run.
- **Row reveal**, starting 1 frame after landing:
  - soft left-to-right wipe over 3 f;
  - blur 2.6 → 0 over 4.5 f;
  - a pale tint of the agent colour that cools to grey by about 6 f;
  - opacity 0.35 → 1 over 6 f;
  - a glide in from −14 px over about 22 f.
- **Rows above the slot** settle one step dimmer. The header scrolls away with the list.
- **Expressions** swap instantly, with no tween: happy on arrival, blink as its text lands, eyes open about 9 frames later, then a change as it moves up.
- **"View all"**: the text wipes in n447.5–451. The 2×2 grid icon pops in one square at a time: bottom-left n449, bottom-right 451, top-right 453, top-left 455, each taking 2 frames with a small overshoot.
- **Exit**: accelerates up to 21 px/f, with σy up to 4.6.

**Chat 2 (D)**
- The status label wipes in slowly over about 22 frames (n465–487), with a soft trailing edge.
- **New message**: the chat scrolls 174 px up. It builds ×1.45/f, peaks at 44 px/f at n485.5, then decays ×0.65/f.
- **New agent**: it slides in from the left with a long ease-out, offset ≈ −1.1 × avatar width × 0.74^t, from n485 to n499. Its name row fades in n485–488.
- **Reply**: streams at about 140 characters per second (around 24 words/s) with a soft tail of about 9 characters.

**Look**
- Colours: page #F6F4F9, slot #E7E5E9, bubble #ECEEF2, rules #ECEAEF, input outline 1.4 px #E2E0E5, status green ≈ #5B9488.

**Reference audio**
- −14 LUFS with 0.4 LU of range: a steady bed at about 87.5 / 175 BPM, with few distinct SFX.
- Our version keeps a bed and lets SFX carry the motion: whooshes peak on the fastest frame, pops land with each character with pitch rising, and ticks mark reveals. The master is −14.1 LUFS and −1.3 dBTP after AAC.

## How it was measured (reuse it for other references)

Tools are in `~/Downloads/launch-videos/hf02-skill/tools/`. Python 3.9: run with `python3 -E` from that folder. There's no cv2 or scipy here.

| Script | What it does | Usage |
|---|---|---|
| `track.py` | Per-frame similarity + gaussian-blur fit against a sharp key frame of the same shot; prints s, tx, ty, σx, σy, ncc. Run one process per shot, in parallel (about 10–15 s per frame at `--half`) | `<framesdir> <key> <first> <last> <out.json> --half` (first > last tracks backwards) |
| `listL.py` | List offset via frame-to-frame correlation of the text column, plus slot edges | `<dir> <first> <last> <anchor_n> <anchor_L> <out.json>` |
| `listc.py` | Coloured mascot blob centroids | |
| `cmp.py` | Reference vs ours sheets | `<refdir> <oursdir> <out.png> n,n,… [width] [--blend]` |
| `sheet.py`, `pick.py` | Contact sheets | |
| `sbs.py` | Frame-exact side-by-side, piped to ffmpeg. Don't use hstack/vstack: the source's irregular timestamps inserted frames (217 for 210) | |

Traps worth remembering:
- **Cut-frame blur**: the tracker over-reads blur about 2× when other elements fade in on those frames. Calibrate it on your own render, where the applied σ is known. Chrome applies SVG `feGaussianBlur` stdDeviation in CSS px exactly.
- **Text measurement**: measure ink widths and calibrate font size in Chrome.
- **Playwright**:
  - `page.setContent` can't load file:// fonts; use `goto(file://…)`.
  - Lay out text only after `document.fonts.load()`, or widths come from the fallback font.
  - Warm up before the first screenshot, and double-rAF before each capture.
- **Odd size**: a 1080×608 viewport at DSF 1920/1080 gives 1081 rows; crop in ffmpeg.
- **Reference artifacts**: the reference repeats one frame at n492 = n493 (a frame-rate conversion artifact).
- **QA probes**: prove both ways. Planted freeze, blank, truncation and audio shifts (+20 ms, +60 ms) all fail, as they should.

Staged in `~/Downloads/launch-videos/hf02-skill/`:
- `ref/frames/` (the reference frames n0270–n0540, 1080×608);
- `ref/curves/` (every measured track, plus `motion-measured.js`);
- `tools/`;
- `baseline/` (a tar plus extracted tree of the whole skill taken just before any upgrade, for diffing and rollback; the skill folder is **not** a git repo).

## Next step: upgrade the skill's film blocks with this motion (approved by Alex; not started)

Alex said: "upgrade the skill's film blocks with the measured motion, and prove it by rebuilding this 7 s from a beats.yaml". This session read the engine and designed the change. **No skill file has been edited.** Only one session should edit the skill at a time.

The current engine has whips (half the frame), a 0.8/f entrance decay, a 7-frame inCubic exit and a 3.5% zoom push. The `roster` and `agent` blocks were built from rough frame sheets. The design:

1. **Drift cuts.** New `out:` values `drift-left | drift-right | drift-up | drift-down` (the direction the content moves, as with whips). Files: `engine/runtime.js` (`exitFor` / `enterFor` / `cameraAt`), `engine/kit.js`, `lib/spec.mjs` TRANSITIONS, `lib/timeline.mjs`.
   - **Exit**: expo-in over 12 frames, `A·(e^{k·u}−1)/(e^k−1)` with k ≈ 3.2. A = 0.05 W horizontal or 0.10 H vertical. Peak ≈ 0.28·A per frame.
   - **Entrance**: offset −E·0.7^t, with E = 0.07 W or 0.08 H. This needs a per-type decay; it's 0.8 today.
   - **Exit length per type**: make it a per-type value (`K.exitLen(type)`: 12 for drifts, 7 for the rest). The timeline's hold check and hero frame must use it.
   - **Strength per cut**: an optional shot field `drift: {in, out}` multiplies the amplitudes. The rebuild needs C `in` ≈ 2.6 and B `out` ≈ 0.65.
   - **Whoosh**: lighter for drifts (gain ~.22, pre .36, post .14) in `lib/audio.mjs` `sfx()`.
   - **QA**: the `cut` check treats a drift like the other moving transitions (INFO, not FAIL).
   - **Push**: use `push: 0` on drift shots that should match the reference.
2. **Camera fields on any shot**:
   - `zoom` (base scale) and `focus: [x, y]`. Translate by `(f−c)(1−zoom)` to keep the focus point fixed.
   - `offset: [x, y]` (fractions of W/H).
   - `pan: [{at, by: [x, y], len}]` with a tanh profile, τ = len/7.5, centred on `at` (the fastest frame).
   - Motion blur follows automatically from the camera's velocity.
3. **`agent` block**:
   - Per-row `at:` (negative = already finished when the shot starts) and `statusAt` / `statusLen` (a soft wipe on the status or done label).
   - New rows slide in from the left as in the measurements.
   - Chat scroll on a new row as a double exponential (in τ ≈ 2.7, out τ ≈ 2.3, peak at the row's arrival) instead of outCubic over 14 frames.
   - `rate:` already sets stream speed; the rebuild uses 24.
   - **`frame: window`**: sidebar (title, search icon, skeleton slot fading in at `sidebar.at`), header (avatar, name, sub, rule), the existing `input` bar with the chrome entrance above, and `sidebar.drop` (the first agent drops into the skeleton slot, clipped by it).
   - **Window geometry** from the reference key frame (n345, fractions of the frame):

     | Part | Position |
     |---|---|
     | Sidebar | x 0.078–0.325 |
     | Divider | x 0.347 |
     | Chat pane | x 0.347–0.909 |
     | Header | y 0.074–0.164 |
     | Input bar | y 0.832–0.909 |
     | Body text | ≈ 2.2% of H |
4. **`roster` block**:
   - A never-stopping scroll: base drift 0.024 pitch/f plus tanh steps, with params `beat` (default 15), `start` and `run` (rows in the final fast run).
   - Slot drift and nudge; the header scrolls with the list.
   - Rows below the slot stay invisible until they fly in; row 0 drops in, clipped by the slot.
   - The reveal recipe above; rows above the slot dim; the expression cadence.
   - "View all": the grid builds square by square and the text wipes in.
   - List blur 0.22·v (it's 0.42 today).
   - Cues: pops on landings with pitch rising, ticks on reveals, tiny pops for the grid squares.
   - Keep the layer names (`header · highlight · agent-N · more`), and keep `cues()` pure: it runs in Node.
5. **`engine/art.js`**: add `happy` (^^) and `blink` moods to `bud()`, in the existing original style.
6. **Proof**: a new job `~/Downloads/launch-videos/hf02-skill/beats.yaml`. Use `sec:` lengths (frames / 30) so the film frames line up with n300–509.

   | Shot | Block and length | Settings |
   |---|---|---|
   | a | `agent` close-up, 41.5 f (a 30-frame lead-in, so film frame 30 = n300) | out `drift-right`, push 0 |
   | b | `agent` with `frame: window`, 45 f | offset [−.143, 0]; pan {at: 21.5, by: [.143, 0], len: 20}; sidebar at 25, drop at 41; out `drift-down`, drift {out: .65} |
   | c | `roster`, 108 f | drift {in: 2.6}; 6 agents + more; start 37.5, beat 15, run 3; out `drift-up` |
   | d | `agent` close-up, 45 f | row 1 at −60 (done) with statusAt 0, statusLen 22; row 2 arrives at ~20 with rate 24; out `drift-up` |
   | e | a short tail shot | lets d keep its exit move |

   - **Comparison**: run the tracker on the film's frames 30–239 (downscaled to 1080×608) against `ref/curves`. Targets: within a few px, and landings within ±1 frame.
   - **QA**: `lv.mjs --film` must say **QA PASSED** in 16:9, 9:16 and 1:1.
   - **Known gap**: the B→C one-frame dissolve. The engine draws one shot per frame, so use a hard drift cut.
7. **Regressions**:
   - Re-render `film-sample` in all three aspects; it uses `agent` and `roster`, so its look will change on purpose. Check it by eye and with QA.
   - `--layers` exports of the `roster` and `agent` shots must still restack.
   - Re-run QA on the other samples.
8. **GUIDE.md**:
   - Add the new transitions, shot fields and block params.
   - Rewrite the "grammar" bullets with the measured numbers. In this section the cuts are momentum cuts, not "hard cuts on an action".

## Open items found on disk (2026-10-21)

- **`film-sample` QA reads FAILED in 16:9, 9:16 and 1:1** (renders from 06:28–06:31). It's one check, `content` (near-empty frames), at 60-fps frames ~290–305 = 4.83–5.1 s, the opening of shot `hook`. That shot shows footage only until its bubble at frame 10, so it matches its own background reference. To fix, bring the first overlay in at frame 0, or make the content check treat bg footage shots differently. `reel-sample` passes QA in all three formats.
- **`film-sample` copy reuses Higgsfield's lines**: the roster's "Find the signal" and "Find the right words", and the prompt "Make the launch film. No mistakes." (an echo of their "Make no mistakes"). Replace them with original copy; the guide says never to reuse their copy.
- **Dev videos Alex shared** (dev builds, not the final samples):
  - `~/Downloads/launch-videos/film-kit-dev/orbit-film-16x9.mp4` (37.75 s, 16:9, 60 fps);
  - `~/Downloads/launch-videos/reel-dev/reel-dev-9x16.mp4` (19.7 s, 9:16, 60 fps).
- **Background agents**: the earlier session's last screenshot showed its porter and monitor stopping before it ended. The blocks, the `--kit` starters, the guide section and both samples are on disk now. Check that their own final QA and review chain were actually completed before relying on them.

## Memory notes from this session

- `project_hf02_motion_recreation.md`
- `reference_video_motion_measurement.md`

They're under `~/.claude/projects/-Users-bytedance-Downloads-Design-AutoPilot/memory/`.
