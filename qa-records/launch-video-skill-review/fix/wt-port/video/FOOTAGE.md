# AI footage: generate, measure, grade, conform, pin (mode B)

Photoreal live-action footage made through the **user's own fal.ai key**: a FLUX 1.1 Pro Ultra key frame, animated by
MiniMax H3 image-to-video, graded to a reference's measured look, conformed to the film's frame grid, with the app's
screen pinned onto phones held in the shot. The motion design stays code on top (`bg:` and the blocks' footage fields).
Tools in `$V/footage/`; prompts in `templates/footage-prompts.md`. Worked example: `~/Downloads/launch-videos/hf02-full/`
(the Cue film, 2026-10-22: 2 plates + 6 selfie cards, `out/fal/v2`, `out/fal/v3`).
**Needs**, besides the skill's Node, ffmpeg and Chrome: `curl` for `gen.mjs`, and `python3` with numpy and Pillow for
`look.py`, `conform.py` and `pin.py` (`pip3 install numpy pillow` once; without them the tools say so and stop).
**Run every command from the job folder** (`cd DIR`, the folder that holds `beats.yaml`): the paths below (`out/fal/…`,
`assets/…`, `@key.txt`) are relative to it. From anywhere else, paid downloads land outside the job.

```bash
cd DIR                                                                                         # the job folder, first
node $V/footage/gen.mjs still --prompt @key.txt --out out/fal/plate1-key --aspect 16:9          # dry run: request + cost
node $V/footage/gen.mjs still --prompt @key.txt --out out/fal/plate1-key --aspect 16:9 --go     # after the user's yes, in the background
node $V/footage/gen.mjs video --image out/fal/plate1-key_1.jpg --prompt @motion.txt --out out/fal/plate1-i2v.mp4 --sec 6 [--go]
node $V/footage/gen.mjs video --guide guide.mp4 --prompt @guide.txt --out out/fal/x.mp4 [--go]   # timing from a guide clip (≤ 15 s)
node $V/footage/gen.mjs raw <endpoint> input.json --out out/fal/x.mp4 [--go]                     # any other fal model
node $V/footage/gen.mjs fetch <request_id> --endpoint <endpoint> --out <same --out>             # resume a cut-off run
python3 $V/footage/look.py out/fal/plate1-i2v.mp4 --ref ~/Downloads/ref.mp4 --ref-from 130f --ref-to 260f --ref-crop 0,0,760,400
python3 $V/footage/conform.py out/fal/plate1-i2v.mp4 assets/plate1.mp4 --frames 88 --start 0.9 --size 1920x1080 --grade "curves=all='0/0 0.03/0.03 0.137/0.27 0.4/0.58 0.68/0.82 1/1',eq=saturation=1.25,colorbalance=rs=-0.04:bs=0.05:rh=0.08:gh=0.02:bh=-0.06,gblur=sigma=1.4"
python3 $V/footage/pin.py out/fal/card-i2v.mp4 assets/screen.png assets/card.mp4 --frames 69 --start 0.2 --grade "curves=all='0/0 0.516/0.49 1/1',eq=saturation=0.75,colorbalance=rh=0.04:bh=-0.04,gblur=sigma=0.8"
node $V/footage/screen.mjs --job . --shot s3 --out assets/screen.png                          # stand-in screen from a phone shot (none? below)
```

## When to generate here

- **Generate here** when the user has a fal.ai key and needs live action that doesn't exist yet: plates behind UI
  moments, people holding a phone with the product on it, a moment timed to a cut. No shoot, no stock search.
- **Use their own clips** when they have them (Higgsfield / Veo / Kling exports, filmed shots): skip `gen.mjs`; `look.py`,
  `conform.py` and `pin.py` work the same on any clip.
- **Never generate** product UI, text, logos, brand characters or a mascot: UI is code (or the official screenshot,
  pinned), brand art comes only from the official kit. AI video won't hold exact UI text or frame-exact UI motion.

## The approval gate — nothing is spent without the user's yes

1. Write the prompts (`templates/footage-prompts.md`). Run each command **without `--go`**: it prints the endpoint,
   the full input (local files by name and size), the estimate and "dry run — show the user the prompt and the
   estimate; add --go once they approve the spend". No network, no files.
2. Show the user the prompts, the count and the total, quoting each plate up front as an estimate: **≈ $1.08 a plate**
   (2 stills $0.12 + 6 s of 1080P video $0.96). Generate on their "yes".
3. **Run `--go` and `fetch` in the background** (Claude Code: the Bash tool's `run_in_background`): a run takes 1–11 min,
   longer than the 2 min a foreground command gets in Claude Code. A run cut off anyway is resumed with the `fetch`
   command it printed, **never by running `--go` again** (the request is paid; that pays twice). Running the same
   command again stops (exit 2) and prints "request <id> is paid but not downloaded — resume it: <the fetch command>"; a
   submit cut off midway stops it too, with "check fal.ai/dashboard/requests, then fetch it by id". One `gen.mjs` per
   `--out` at a time: a second one (a `fetch` while the `--go` still downloads) stops (exit 2) and names the first's pid.
4. **Two approval rounds per plate.** Round 1, the stills: 2 per shot (`--n 2`, $0.12), dry run, the user's yes, `--go`,
   then pick one together. Round 2, the video from the picked still (5–6 s, $0.80–0.96): its dry run needs that still on
   disk, so it can only come after round 1 — show its motion prompt and estimate, and `--go` on a second yes.
5. The key lives in `~/Downloads/launch-videos/.env` (`FAL_KEY=…`, `chmod 600`); the user pastes it there themselves,
   never into the chat. Without it `--go` stops (exit 3) and says so. `gen.mjs` never prints or writes it.

Prices checked 2026-10-22: FLUX 1.1 Pro Ultra **$0.06 per image**; MiniMax H3 Max **$0.16 per second at 1080P** (480P /
768P: unknown, the estimate shows the 1080P price as a ceiling); other endpoints "unknown — check fal.ai/models".
**One plate ≈ $1.08** (2 stills $0.12 + 6 s at 1080P $0.96). The Cue film: 18 stills + 47 s of video ≈ $8.60 for 8 finished clips.
fal finished each request in 12–30 s; whole runs took 1–11 min, nearly all of it the download (fal's CDN stalls on this
network; `gen.mjs` resumes every drop).

## The realism recipe

Measured with `look.py` against the reference's own live-action plates (the frames used: reference plate 1 `n130–260`, 11
frames, `--crop 0,0,760,400`, and plate 2 `n1560–1625`, 6 frames, `--crop 260,0,820,380`; the draft 6 grabs at 0.5–5.5 s;
the raw clip 9 grabs at 0–6.4 s; the graded clip — the conform below, with `--size 1920x1080` — frames `10f–160f`.
look.py's default, 12 frames over the whole clip, lands within a few points: graded p50 72 instead of 69.5). look.py
decodes exactly (BT.709), so a clip measures the same at any size; these numbers are about 2 points brighter than the
first ones, which went through ffmpeg's own conversion (darker at 1928 / 1080 px wide):

| | p50 luma | deep shadow (< 40) | saturation | sharpness | shadows / highlights |
|---|---|---|---|---|---|
| Reference plates (Higgsfield film 02) | 65–82 | ~29 % | 40–45 | 3–5 | cool / warm |
| Our vector draft as `--guide` (reference-to-video) | 129 | 8.5 % | 31 | 10 | flat warm — "looks so fake" |
| Photo key frame → image-to-video, raw | 36 | 54 % | 35 | 13 | warm / neutral |
| …graded (below) | 69.5 | 35 % | 39 | 9.4 | neutral / warm |

1. **A photo key frame sets the look**: FLUX `raw: true`, written like a cinematographer's brief — motivated,
   mixed-temperature, low-key light; a lived-in set; a real lens close to the subject; specific wardrobe; grain.
2. **Image-to-video from it** (`--image`), with a motion brief: handheld, one camera move, a performance beat by beat,
   "keep the lighting, colours, depth of field and film grain of the first frame", no text.
3. **Never the vector draft as the look.** A guide clip (`--guide`, reference-to-video) only when the timing must
   follow it; it copies the draft's flatness and its drawn details literally (an illustrated skyline, a drawn finger).

## Measure the reference, grade to it — `look.py`

Measure the reference's footage frames, cropped to the picture (`--ref-crop x,y,w,h`: no UI, watermark or prompt
bar), and ours; the table flags "◂ outside" where our mean leaves the reference's frame-to-frame range. Frames: `--from /
--to` in seconds (a still export's grab) or as indices (`130f`, for a breakdown's frame numbers). Grade with ffmpeg
filters in `--grade` and re-measure until the flags are gone (sharpness excepted: generated footage stays at ~9 against
the reference's 3–5, and more blur reads as defocus — accept it). Today's grades, as starting points:

| Footage | Raw → target | `--grade` |
|---|---|---|
| Low-key interior (plate 1) | p50 36 → 69.5, sat 35 → 39 | `curves=all='0/0 0.03/0.03 0.137/0.27 0.4/0.58 0.68/0.82 1/1',eq=saturation=1.25,colorbalance=rs=-0.04:bs=0.05:rh=0.08:gh=0.02:bh=-0.06,gblur=sigma=1.4` |
| Golden-hour interior (plate 2) | p50 73 → 62 | `curves=all='0/0 0.282/0.25 1/1',eq=saturation=1.05,colorbalance=rs=-0.05:bs=0.06:rh=0.08:gh=0.02:bh=-0.06,gblur=sigma=1.4` |
| Daylight selfie card (UGC: p50 127, sat 21) | e.g. p50 134 → 128 | `curves=all='0/0 0.516/0.49 1/1',eq=saturation=0.75,colorbalance=rh=0.04:bh=-0.04,gblur=sigma=0.8` — the card grade everywhere; per card, move the curve's midpoint to land p50 ≈ 127 |

The cool-shadow / warm-highlight split comes from `colorbalance` (shadows blue, highlights red); `gblur` takes the AI
crispness off. Results (plates conformed with `--size 1920x1080`): plate 2 graded p50 62, saturation 51; the six cards
p50 114–135 and saturation 23–34 with the pinned screen in the frame (over the reference's 21 — lower `eq=saturation`
further for a closer match). **Measure a card with the pinned screen cropped out** — `--crop` boxes around it (above,
below, left, right of the screen) — because the screen's own brightness moves p50: QA1's car0, the same grade with a
brighter screen, measured 138.
**Grade and measure at the film's size.** The same `--grade` lands differently without `--size` (plate 1: p50 66,
saturation 43 at 1928 px wide, against 69.5 and 39 at 1920): ffmpeg's conversion to RGB for `curves` / `colorbalance`
depends on the frame width. Conform with the `--size` the film uses, then measure that file.

## Conform to the film — `conform.py`

- `--frames`: the shot's length from `--grid` (the next shot's start minus this one's, in 30-fps frames), **rounded
  up**: an 87.5-frame shot needs 88 — one frame short and `--film` / `--storyboard` refuse the clip.
- **Native speed**: 24 fps onto 30 by repeating one frame in five (`fps=30:round=near`), the cadence the reference films'
  own footage has (21 of 117 frames repeat in its plate 1, about one in five); never `minterpolate`. lv.mjs's 60 fps master shows each
  30 fps frame twice: the same cadence.
- `--start`: clips come back longer than asked (6 s → 6.58 s, 5 s → 5.17 s) with the action stretched: pick the start
  so the action lands on the shot's beats (plate 1: 0.9 s). It refuses a start that leaves too few frames and names one
  that works.
- `--size 1920x1080` cover-crops to the film's frame (1080P clips are 1928×1076); the grade is baked in; the model's
  audio is dropped (mix sound with `music` / `voiceover`); BT.709 tags, yuv420p.
- **The user's own phone clips** work too: HDR (HLG / PQ) is converted to SDR with the film engine's own conversion
  (`lib/hdr.mjs`, the same one `bg:` footage gets), a rotation tag is honoured (portrait stays portrait), and an odd
  width or height loses its last column / row (no resampling). `look.py` measures them the same way.

## Pin the app onto a phone — `pin.py`

Generate the phone **with a black screen** ("the screen completely black and switched off" in the still, "the screen
stays completely black the whole time" in the motion), upright, facing the camera, one phone in frame, 2–30 % of the
picture. `pin.py` finds the black screen in the first frame, tracks it (corners pushed out 4 % over the rounded corners,
smoothed over 3 frames), warps the screen PNG onto it, composites it only where the phone is black (fingers over the
glass stay in front), then grades and conforms like `conform.py`. Check `<out>-track.png`: the red quad must hug the
screen on the first, middle and last frame. No phone found (exit 3): re-roll with the black-screen line, try a later
`--start`, or `--dark 40` for a dark-grey screen.

The screen PNG: the product's **official screenshot** (portrait, the phone's shape ≈ 1 : 2.15), or a stand-in rendered
from one of the job's own `phone` shots: `node $V/footage/screen.mjs --job . --shot s3 --out assets/screen.png` (from
the job folder; 3×, its storyboard frame by default, `--at F` for another moment). It never replaces an existing
`--out` (an official screenshot) without `--force`. Flag stand-in screens to the user before delivery.

**No `phone` shot in the job** (the film kit and film-sample have none; screen.mjs says so and stops): use the official
screenshot, or render the stand-in from a one-shot side job next to this one:
1. `mkdir -p ../<name>-screen/assets` and copy the files the job's `brand:` uses (its logo) into that `assets/`.
2. Write `../<name>-screen/beats.yaml`: a `title`, a `slug`, `aspects: [16x9]`, `music: none`, this job's `brand:` block
   copied verbatim, and one shot — `- id: app`, `block: phone`, `beats: 10`, `items:` the app's moments (a `header`,
   `msg` lines, `steps`, a `card`), as any phone shot.
3. From this job's folder: `node $V/footage/screen.mjs --job ../<name>-screen --shot app --out assets/screen.png`
   (QA1: a 1236×2655 PNG, 3×). Flag it as a stand-in.

## Into the job

```yaml
  - id: hook
    block: scene
    beats: 6                     # --grid: 87.5 frames → conform --frames 88
    bg: assets/plate1.mp4        # conform.py output: graded, 30 fps, starts on the shot's first frame
    bgMove: none                 # the footage carries its own camera move; no Ken Burns on top
    bgDim: 0                     # no scrim unless copy sits on it
    overlays: [...]
```

- `bg:` on any shot (`bgFrom: 0` — the conform already chose the start), or the blocks' own footage fields: `float`
  `card`, `split` `before` / `after`, `stack` / `wall` `cards` (pinned selfie cards go here), `media` `src`.
- **`wall` / `stack`: the pinned card goes first in `cards:`.** Index 0 is the featured, crisp card; index 1 can land in
  the blurred tier behind the headline. Check the storyboard.
- **Footage enlarges the frame cache**: about 0.8 MB a frame at 16:9 (QA1: 1.9 GB for a 38 s film). Check the free disk
  before `--film`.
- Generate at the shot's aspect (16:9 plates, 9:16 cards); a 16:9 clip in a 9:16 film is cover-cropped to its middle.
- **CapCut instead**: conform the clips at the edit's frame rate (`--fps 30`), lay them on the main track, and export
  the motion design as overlays (`--clips … --alpha`).
- Re-generating means new files and a new estimate: `gen.mjs` stops on any existing output name unless `--force`. With it,
  nothing moves until fal has accepted the new request and its id is printed and saved; then the whole older generation
  (every file its log lists, the log, strays at those names, earlier runs' pending logs and `submit:` logs) is kept as
  `<name>.prev-<id>.<ext>` — it still plays, its log points at the kept files, and no generation ever overwrites another.

## Traps

- **Brand marks in FLUX**: "a silver laptop" came back a MacBook with the Apple logo — ask for "an unbranded …", or fill
  the logo out of the key frame before animating (hf02-full's `out/fal/v2/plate1-key_1-clean.jpg`).
- **Two phones**: "hold a second phone up" drew two in one card; "only this one phone is visible in the frame" fixed it.
- **Downloads stall** on this network: `gen.mjs` downloads into `<file>.part-<id>` and resumes after every drop (fresh
  `curl -C -` per try, 30 tries); the real name only ever holds a whole file. If it still stops (exit 5) it prints the URL
  and the `fetch` command, which re-polls, skips the files its log already proves complete and resumes the rest.
- **Any failure once fal has the request** (exit 4 or 5) prints the request id and the `fetch` command: the request is
  paid, so never submit it again — fetch it.
- **fal errors** (exit 4: a validation message, a content-checker refusal, a timeout) print fal's message and the
  request id; a request that is still running is picked up later with `fetch`, never re-submitted (that pays twice).
- **The model's audio** is on every clip; `conform.py` / `pin.py` drop it.
- **Stretched timing**: never speed the clip up to fit; choose `--start` (and generate a second longer or shorter).
- **Seeds**: pass `--seed` (it is logged in the `.fal.json`) so a run can be repeated exactly; FLUX also reports the
  seed it picked when none was given.
- **Originality**: prompts describe our scenes; the reference film is analysed locally and never uploaded; logos,
  characters and screens come only from the official kit (or are flagged stand-ins).
