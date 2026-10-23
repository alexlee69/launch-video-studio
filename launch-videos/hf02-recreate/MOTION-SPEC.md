# Higgsfield film 02, 00:10–00:17: motion breakdown and recreation

**Source**: `~/Downloads/higgsfield02.mp4`, 1080×608 @ 30 fps. The window is frames 300–509 (10.000–16.967 s, 210 frames); the cut to the next shot lands on frame 510 (17.000 s).
**Recreation**: `hf02-recreate.mp4`, 1920×1080 @ 30 fps, 7.0 s, frame-for-frame with the source window. The motion, timing, layout and blur are matched; the characters, copy, colours of the cast and the type are ours. There is no Higgsfield logo or watermark. The sound is original and synthesized (see Sound below).

All numbers below are in source pixels (1080-wide frame) and source frames (n). Multiply px by 1.778 for 1080p.

## Shot list

| Shot | Frames | Time | What it shows | In | Out |
|---|---|---|---|---|---|
| A | 300–311 | 10.00–10.37 | Chat close-up: prompt bubble and one agent reply | (mid-shot) | momentum cut, panning right |
| B | 312–356 | 10.40–11.87 | Whole app window: header, chat, input bar; pans to reveal the sidebar | momentum cut | 1-frame dissolve, tilting down |
| C | 357–464 | 11.90–15.47 | Agent list zoomed in: a fixed highlight slot, six agents step through it | dissolve | momentum cut, moving up |
| D | 465–509 | 15.50–16.97 | Chat close-up again: a second agent joins and its reply streams in | momentum cut | momentum cut, moving up |

## Cut grammar (the main idea)

- **Every cut is a momentum cut.** Each shot is one continuous drift that eases out after a cut and speeds up into the next one. Cuts land on the fastest frame, at peak motion blur, and the incoming shot starts already moving in the same direction and decelerates. Nothing ever holds still: the slowest camera speed anywhere in the 7 s is about 0.4 px/frame.
- **Blur is motion blur.** Roughly σ ≈ 0.2 × speed (px/frame) along the direction of travel, plus a little extra on the first 2–4 frames after a cut.
- **The one exception is B→C**: a single 50 % frame (n357) between the window and the zoomed list, both moving down.

## Camera curves

| Shot | Move | Profile |
|---|---|---|
| A | pan right (content moves right) | 1.0 → 13.9 px/f over 11 frames, ×1.3 per frame (expo-in). Blur appears at about 8 px/f, σx 0.5 → 3.6 |
| B, part 1 | pan right, continued from A | enters at 32 px/f (n312), eases out to ~1.1 px/f by n323 |
| B, part 2 | pan right again to reveal the sidebar | ~1.2 → 29 px/f peak at n333.5, eases out to 0 by n344 (ease-in-out, ~21 frames) |
| B, part 3 | tilt (content moves down) | 0.5 → 10 px/f n345–n357, accelerating into the dissolve |
| C | slot glides down into place | enters at ~45 px/f (n358), eases out to 0 by n371, then drifts up ~1.5 px/f |
| C, exit | content up | accelerates to 21 px/f at n464, σy up to 4.6 |
| D | content up | enters at 15.6 px/f (n465), eases to 0.8 px/f by n476. A new message scrolls the chat 174 px up with a 44 px/f peak at n485.5, eases out, then accelerates up into the exit cut (22 px/f at n509) |

## Element animations (by frame)

**Window chrome (B)**: the chat carries over from A at full opacity, while the header, rules and divider fade in over n312–n316.
- **Input bar**: the outline fades in n313–n318. The black send button grows from a dot (scale 0 → 1, n319–n328, ease-out). The placeholder wipes in left to right n320–n324 and reaches full opacity by n328. The `+` and mic glyphs appear n329–n331.
- **Sidebar reveal**: the header and search icon fade and unblur n337–n339. The skeleton slot follows one frame later (n339–n340).
- **Peek**: at n353–n357 the first agent starts dropping into the small skeleton slot from above, clipped by the slot's top edge. It sells the zoom that follows.

**Agent list (C)**: the list sits behind a fixed highlight slot (712 × 159, radius 29). Rows are 174 px apart.
- **First agent drops in**: it lands from the upper right into the slot, clipped by the slot until n362. It falls at 85 px/f, decelerating to 0 by n369. It overshoots about 28 px left and 11 px down relative to the slot, then settles by n377.
- **List steps**: peaks at n394.5, n409.5 and n424.5 (35 px/f), then a fast three-row run that peaks at n439.5 (~100 px/f). Between steps the list never stops (minimum ~4 px/f). Each step nudges the slot down ~14 px, and it drifts back up.
- **Fly-ins**: agents 2–6 slide in from the left edge in about 3 frames. They land at n397, n411, n427, n434 and n438, overshoot +7 px and settle over 6 frames. Agents 5 and 6 land in the rows below the slot, just before the fast run.
- **Row reveal**: starts 1 frame after the agent lands.
  - Soft left-to-right wipe over 3 f.
  - Blur 2.6 → 0 over ~4.5 f.
  - Starts in a pale tint of the agent's colour and cools to neutral grey by ~6 f.
  - Opacity 0.35 → 1 over 6 f.
  - Slow glide in from −14 px over ~22 f.
  - Rows that have moved above the slot settle one step dimmer.
- **Expressions**: each agent arrives with a happy squint, blinks as its text lands (Scout at n379), opens its eyes ~9 frames later (n388) and changes expression as it moves up out of the slot. The swaps are instant, with no tween.
- **"View all"**: the text wipes in n447.5–n451 and develops from faint. The 2×2 grid icon builds one square at a time (bottom-left n449, bottom-right n451, top-right n453, top-left n455), each popping from a dot in 2 frames with a small overshoot.

**Second chat (D)**
- **Status label**: the green status beside the first agent's name wipes in slowly over ~22 frames (n465–n487), with a soft trailing edge.
- **Second agent**: as the chat scrolls up, it slides in from the left with a long ease-out (x 36 → 112 over n485–n499). Its name row fades in n485–n488.
- **Streaming reply**: n487–n503, characters arriving left to right with a ~9-character soft tail. The source does 78 characters in 16.5 frames (~140 characters per second).

## Look

- **Colours**: page #F6F4F9, highlight slot #E7E5E9, chat bubble #ECEEF2, rules #ECEAEF, input outline 1.4 px #E2E0E5, status green #5B9488.
- **Type**: the source face looks like SF Pro. We use Inter at −0.01 em, sized so line widths match (titles 500 weight, names 600, body 400).
- **Cast**: six original characters, so nothing is copied from the source's mascots: Scout (blue, antenna), Critic (orange, ears), Analyst (graphite, glasses), Director (white, beret), Builder (green, sprout) and Writer (violet, curl). They share four eye states: happy, blink, open and dots.

## Sound

The sound is original and synthesized with the product-launch-sting voice engine; nothing is taken from the source audio. The source window is a steady music bed (−14 LUFS, 0.4 LU of range) with few distinct effects. Ours keeps the bed, and lets effects carry the motion.

- **Bed**: F major, 120 BPM, phased so the four list steps (3.15 / 3.65 / 4.15 / 4.65 s into the clip) land on beats.
  - The progression is Fmaj7, Dm7, B♭maj7, C7sus.
  - A pad and an eighth-note pluck arpeggio run throughout.
  - The groove is light through the window shots (kick on 1 and 3) and full from the list on (kick, clap, hats, pulsing bass).
  - A riser lifts into the exit cut.
- **Whooshes**: they build with each acceleration and peak on the fastest frame: both momentum cuts, the dissolve, the sidebar pan, the fast three-row run, the chat scroll, and the exit.
- **Pops**: on the send button, Scout's landing, and each fly-in landing (pitch rises agent by agent: 76, 79, 81, 83, 84). Tiny pops build the View-all grid square by square, and a blip marks Scout opening its eyes.
- **Ticks**: on the sidebar appearing, each row reveal, the View-all reveal, and a light typing texture under the streamed reply.
- **Levels**:
  - The master is −14.1 LUFS and −1.3 dBTP after AAC.
  - Pops sit +5–10 dB over the bed and whooshes +3–16 dB.
  - The music and effects stems are within 1.3 LU of each other.
  - Levels are set by meters only, so the final judgement is by ear.

## Files

- **`stage.html`**: the whole scene; `seek(n)` is a pure function of the frame. The copy and the cast are at the top (`PROMPT`, `CREW`).
- **`motion.js`**: every measured curve (camera tracks, blur, list offset, slot position, drop and fly-in paths, fades, wipes).
- **`node render.mjs`**: renders frames 300–509 (about 25 s) to `out/frames` and `out/hf02-recreate-silent.mp4`. Once the sound master exists, it re-muxes `hf02-recreate.mp4` too. `--stills 345,420` renders single frames.
- **`node audio.mjs`**: builds the bed, the effects (the cue sheet is at its top, one line per motion event), the master and the stems. Then it muxes `hf02-recreate.mp4`. It takes about 3 s.
- **Stems for an editor**: `audio/hf02-music.wav` and `audio/hf02-sfx.wav` (48 kHz, 24-bit, at master gain, before the limiter).
- **`python3 tools/qa.py hf02-recreate.mp4`**: checks format, colour tags, 210 frames, and no blank or frozen frames.
- **`python3 tools/audio_qa.py`**: checks audio stream and loudness, each cue's attack on its own isolated render, whoosh peaks, picture events found in the video's own frames versus whoosh peaks, and that the bed never drops out.
- **Comparisons**: `out/compare-side-by-side.mp4` (source | ours, frame-exact, with our sound) and `out/compare-side-by-side-half-speed.mp4` (silent).

## How the match was checked

- **Camera curves**: the same tracker was run on the source and on our render (similarity transform plus blur, per frame). Every reliably tracked frame is within 1.53 px at worst (mean ≤ 0.5 px) and within 0.3 % in scale. List offset and slot position in C are within 0.9 px.
- **Frame by frame**: every transition was checked side by side against the source: the cuts at 10.40, 11.90, 15.50 and 16.97 s, the drop, the steps, the fly-ins, the reveals and the stream.
- **Integrity**: qa.py passes on the render, and fails as it should on planted broken copies (a frozen frame, a blank frame, a truncated file). Re-rendered frames are bit-identical.
- **Sound sync**: audio_qa.py passes.
  - All 31 point cues are within 1.4 ms and whoosh peaks within 5.6 ms.
  - The picture events found in the final video are each within 21 ms of a whoosh peak: the hard cuts at 0.383 and 5.483 s, the dissolve at 1.917 s, and the chat scroll at 6.183 s.
  - It fails as it should on planted copies with every cue 20 ms late, or with the whooshes 60 ms late.
- **Known differences**:
  - The source repeats one frame at 16.40 s (n492 = n493, a frame-rate conversion artifact). Ours keeps moving through it.
  - The type, the characters and the soundtrack are different by design.
