# higgsfield01 study — shared brief for every study agent

**Goal.** Alex wants product-launch-sting to make films like Higgsfield's `~/Downloads/higgsfield01.mp4` for Manus, and a
Manus 2.0 version of this film. This study measures the reference so precisely that a builder can match every cut,
camera move, overlay animation, transition and sound event to its frame, with our own story, copy, footage and music.
It is the same method as the hf02 recreation (`~/Downloads/launch-videos/hf02-full/`, `hf02-recreate/MOTION-SPEC.md`).

**The film** (76.53 s, 2296 frames, 1080×608, 30 fps CFR, AAC 44.1 kHz stereo): "Higgsfield MCP × Claude Opus 5.5 for
Motion Design". An adventurer (AI live-action) in a jungle gets a promo brief. The film shows:
- the agent working: white status cards with an asterisk icon, and a prompt bar over the footage;
- After Effects-style screens: timeline, project panel, render/download;
- the motion graphics it makes for "Ivayu Reserve": a mascot badge, an animated trail map with pins, a "Sun Gate" poster;
- live-action beats: a rope bridge, fire, an arrow, a cave with a laptop;
- an Instagram-handle end card.

## Rules
- **Study only.** Their footage, frames, copy, characters, logos and audio never go into our film. Frames and crops stay
  in this folder, on this Mac. You may quote their on-screen text here verbatim, to time it and count characters; the
  build writes its own copy.
- **Write only inside `~/Downloads/launch-videos/hf01-study/`**, in your own subfolder plus your one top-level report.
  - `ref/` is read-only (shared).
  - Never edit the skill (`~/.claude/skills/product-launch-sting`), other jobs, or anything outside this folder.
- **No network, no paid calls, no git.** Don't start long-lived servers.
- `/usr/bin/python3` has numpy and Pillow. Use `-B` so it writes no `__pycache__` into the skill. ffmpeg/ffprobe and node
  are available.
- **Be exact.** Frame numbers are 0-based, matching `ref/frames/nNNNN.png` (n = round(t × 30)). Give positions in px on
  the 1080×608 reference, and also scaled ×1.7778 to 1920×1080. Say how each number was measured; say "estimated" when
  it is a judgement.
- **Look at the frames.** Read PNGs and the contact sheets you make; the automatic tools miss things. Use contact sheets
  (several frames per image) rather than single frames, to save effort.

## Shared inputs (`ref/`)
- `ref/frames/n0000.png … n2295.png`: every frame, PNG.
- `ref/audio/ref.wav` (stereo 44.1 kHz) and `ref/audio/mono.wav` (48 kHz mono).
- `ref/breakdown/`: the skill's automatic first pass (28 shots; `breakdown.json` has `startFrame` per shot and the
  transition guesses; `overview.png` and `sheet-01…04.png`). It is approximate: verify everything.

## Tools
`$V` = `~/.claude/skills/product-launch-sting/video`.

| Tool | What it does |
|---|---|
| `python3 -B $V/recreate/track.py ref.mp4 --key K --from A --to B [--half] [--roi x,y,w,h] --out f.json` | camera fit per frame: s, tx, ty, blur, ncc |
| `python3 -B $V/recreate/compare.py` | cut detector, `--cuts-from` list format; see `$V/RECREATE.md` §5 |
| `python3 -B $V/recreate/music.py profile ref.mp4` | groove, bands, key; `node $V/lv.mjs --tempo ref.mp4` gives the tempo |
| `python3 -B $V/footage/look.py ref.mp4 --from S --to E [--crop x,y,w,h]` | the look of a footage shot |
| `~/Downloads/launch-videos/hf02-full/tools/*.py` | the hf02 study's own helpers (cutcheck, sheet, music_profile, beat_check, track); copy and adapt them |
| `~/Downloads/launch-videos/hf02-recreate/MOTION-SPEC.md` | the depth expected for motion: per-event frame numbers, fitted curves, blur |

**Measurement traps:**
- Read `~/.claude/projects/-Users-bytedance-Downloads-Design-AutoPilot/memory/reference_video_motion_measurement.md`.
- Blur on a cut frame over-reads about 2×.
- `ncc` < 0.9 means the fit doesn't hold.
- Never trust a cut detector without checking the frames either side.

## Output layout
- `cuts/`, `CUTS-MOTION.md`: agent A.
- `shots/`, `SHOTS.md`: agent B.
- `overlay/`, `OVERLAY-SPEC.md`: agent C.
- `sound/`, `SOUND.md`: agent D.

The lead merges them into `BREAKDOWN.md`, then the gap analysis and the build plan.
