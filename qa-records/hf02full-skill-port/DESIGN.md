# Port the hf02-full work (2026-10-22) into product-launch-sting, mode B

Alex: "what we have done today is amazing. update this to our product launch skill". Today's job
`~/Downloads/launch-videos/hf02-full/` recreated a 63.6 s Higgsfield launch film frame for frame (motion = theirs, all
content = ours/Manus Cue), with photoreal AI footage generated through fal.ai, UI pinned onto phones in that footage, grades
matched to the reference's measured look, an original score on the reference's beat grid, and frame-exact proofs. The
skill can't do most of that yet; its GUIDE even says "nothing is generated here". This port makes it reusable.

## Ground rules (every agent)

- **Live skill** `~/.claude/skills/product-launch-sting` is READ-ONLY for you. A separate fix round for the skill is
  staged (unmerged, paused) in `Design-AutoPilot-stable/qa/launch-video-skill-review/` — never touch that folder either.
- **Edit only the staging copy**: `S=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/stage/product-launch-sting`
  (an exact copy of live; `$S/video` is what the docs call `$V`). Only the files your role owns (below).
- **Additive.** New files in new folders. Existing files change only where this spec says; keep those edits small and
  self-contained (they must be re-applied on top of the fix round later).
- **Durable output only**: reports, logs, probe jobs and test media go under
  `P=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/` (your `work-*` folder). The session
  scratchpad (/private/tmp/claude-*) is wiped on restart — never keep anything only there.
- **Read-only inputs**: `~/Downloads/higgsfield02.mp4` (the reference, Alex's own copy — local analysis only, never
  uploaded anywhere), `~/Downloads/launch-videos/hf02-full/**` (today's job: tools/, audio.mjs, out/fal/**, film.mp4,
  out/film-share.mp4, out/*tempmusic-PRIVATE.mp4), and every other job under `~/Downloads/launch-videos/`. Copy a job into
  your work folder before running anything that writes into it.
- **Money and secrets**: `FAL_KEY` is in `~/Downloads/launch-videos/.env` (chmod 600). Never print, log, copy or upload
  it; never call the real fal API (no spending) — test against a local mock queue server. Never sign up for anything.
- **No commits, no pushes**, nothing to the alexlee69 backup.
- Runtimes: Node 25 (no new npm packages), `/usr/bin/python3` 3.9 with numpy 2.0 + Pillow 11 (no cv2, no scipy; write
  3.9-compatible code: no `match`, no `X | Y` annotations evaluated at runtime), ffmpeg/ffprobe 8.1 (no drawtext/libfreetype:
  draw labels with PIL; colour tags after -vf get dropped, use `setparams`). Every Python file starts with
  `# -*- coding: utf-8 -*-` and opens text files with `encoding='utf-8'` (C-locale trap). A script that imports a sibling
  module inserts its own folder into sys.path first (works under `python3 -I`).
- House style: match the skill's existing code (dense, few but precise comments, plain-English user messages that say what
  to do next, exit codes documented at the top of each tool). Docs follow GUIDE.md's voice: short, concrete, numbers.
- Context worth reading: memory notes in `/Users/bytedance/.claude/projects/-Users-bytedance-Downloads-Design-AutoPilot/memory/`:
  `reference_minimax_h3_video_api.md`, `project_hf02_motion_recreation.md`, `reference_video_motion_measurement.md`,
  `reference_ffmpeg8_mux_traps.md`, `project_launch_video_mode_b.md`; the skill's `SKILL.md` and `video/GUIDE.md`
  ("Reels and launch films", "Reference breakdown", beats.yaml `music:`).

## Roles and file ownership

| Role | Owns (in `$S`) | Work folder |
|---|---|---|
| Worker A — footage | `video/footage/**` (new), `video/templates/footage-prompts.md` (new), `video/FOOTAGE.md` (new) | `$P/work-A/` |
| Worker B — recreate + score | `video/recreate/**` (new), `video/lib/audio.mjs` (film style), `video/lib/spec.mjs` (3 small edits), `video/RECREATE.md` (new) | `$P/work-B/` |
| Monitor — acceptance tests | nothing in `$S` | `$P/acceptance/` |
| Lead | `SKILL.md`, `video/GUIDE.md` (pointer lines only), `$P/PATCHES.md` | — |

Each worker ends with `$P/work-X/REPORT.md`: files added/changed, every command run with its result (PASS/FAIL lines),
known limits, and open questions. Never claim a check you didn't run.

## A. `video/footage/` — generate and finish AI footage (Worker A)

Port and generalise `hf02-full/tools/fal/{fal_gen.mjs, conform.py, look_stats.py, carousel_pin.py}`. Known-good request
shapes are today's `out/fal/v2/*.input.json`, `out/fal/v3/*.input.json`, `out/fal/plate1-h3max.input.json`, with their
`.fal.json` logs — use exactly those field names; don't invent API fields.

### `gen.mjs` (fal.ai REST queue client, no npm deps; curl for downloads)
```
node $V/footage/gen.mjs still --prompt <text|@file.txt> --out <prefix> [--n 1-4] [--aspect 9:16|16:9|1:1|4:3|3:4|21:9|9:21] [--seed N] [--raw true|false] [--endpoint fal-ai/flux-pro/v1.1-ultra] [--go]
node $V/footage/gen.mjs video --image <key.jpg|.png> --prompt <text|@file> --out <file.mp4> [--sec 5-10] [--res 480P|768P|1080P] [--seed N] [--endpoint minimax/h3-max/image-to-video] [--go]
node $V/footage/gen.mjs video --guide <guide.mp4, ≤15 s> --prompt <…> --out <file.mp4> [--aspect 16:9|9:16|1:1] [...] (endpoint minimax/h3-max/reference-to-video)
node $V/footage/gen.mjs raw <endpoint> <input.json> --out <path> [--go]       # any endpoint; "@file" strings in *_url / *_urls fields → data URIs
node $V/footage/gen.mjs fetch <request_id> --endpoint <endpoint> --out <path>  # re-poll / re-download a request that was cut off
```
- Defaults from today: stills `raw: true`, `output_format: jpeg`, `num_images` from `--n` (default 2); video
  `prompt_expansion_mode: disabled`, `enable_safety_checker: true`, `resolution: 1080P`, `duration` 5 (reference-to-video:
  the guide's length rounded up, min 5).
- **Dry run unless `--go`**: print endpoint, the input JSON with data URIs shown as `<file NAME, N KB>`, the estimated cost,
  and `dry run — show the user the prompt and the estimate; add --go once they approve the spend`. No network, no files.
- **Cost table** (dated "checked 2026-10-22", printed with the estimate): `fal-ai/flux-pro/v1.1-ultra` $0.06/image;
  `minimax/h3-max/*` $0.16/s at 1080P; anything else "unknown — check fal.ai/models". `--go` prints the estimate again.
- **Key** (order changed by the lead 2026-10-22, after the build): an explicit `--env FILE` first (if that file has no
  key line → exit 3, no fallback to an exported key), else the `FAL_KEY` env var, else `~/Downloads/launch-videos/.env`
  (`FAL_KEY=…`, optional `export ` and quotes). Missing → exit 3 with: the user pastes their own key into that file (never into chat). The key must never
  appear in stdout, stderr or any file written (logs keep `"auth": "Key ****"` at most).
- **Queue**: base `FAL_QUEUE_URL` env (default `https://queue.fal.run`): POST `<base>/<endpoint>` with
  `Authorization: Key <key>` → `{request_id, status_url, response_url}`; poll `status_url` (every 3 s; `--timeout`, default
  900 s) until `COMPLETED`; GET `response_url`; outputs = every URL under `images[].url`, `image.url`, `video.url` (and
  any other `{url}` leaf). Errors (HTTP ≥ 400, status `FAILED`/`ERROR`, a response `detail`) → exit 4 printing fal's message
  and the request_id (so `fetch` can pick it up).
- **Downloads** (as built: a fresh `curl -C -` per try, no `--retry` — measured: curl's `--retry` restarts from the try's
  first byte; spec text was:) `curl -4 --http1.1 -L --fail -C - --retry 5 --retry-all-errors` in a loop of up to 30 attempts
  (fal's CDN stalls on this network — no `--speed-limit` cut-off), then check the size against Content-Length when known
  and that ffprobe can read it. Still outputs: `<prefix>_0.jpg`, `_1.jpg`… Video: `<out>`. Exit 5 if a download never
  completes (print the URL so the user can fetch it).
- **Log**: `<out-without-ext>.fal.json` (stills: `<prefix>.fal.json`): endpoint, input (data URIs → `<file NAME>`),
  request_id, submitted/finished times, estimate, output URLs, local files with sizes. Re-running never overwrites an
  existing output: it stops (exit 2) unless `--force`.
- Video outputs come with the model's own audio track and at 24 fps — say so in the success line (conform drops the audio).

### `look.py` — measure a look, compare it with a reference
```
python3 $V/footage/look.py <clip|image> [--from S] [--to S] [--frames 12] [--ref <clip|image> [--ref-from S] [--ref-to S]] [--json OUT]
```
Exactly today's `look_stats.py` measures (so the targets in the docs stay comparable): p10/p50/p90 luma, deep shadow %
(luma < 40), saturation, sharpness, grain, shadow vs highlight warmth. With `--ref`: both columns, the delta, and a flag on
each measure where ours falls outside the reference's frame-to-frame range. Today's numbers to reproduce on the same input:
plates p50 63–80, sat 42–46, sharpness 3–5; carousel UGC p50 125, sat 21; raw plate-1 i2v p50 35 / 55 % shadow;
graded plate 1 p50 64, sat 46, sharpness 9.5.

### `conform.py` — drop a generated clip into the film's frame grid
```
python3 $V/footage/conform.py <in> <out.mp4> --frames N [--fps 30] [--start S] [--size WxH] [--grade "<ffmpeg filters>"] [--crf 15]
```
Native speed, `fps=<fps>:round=near` (24 → 30 = one repeated frame every 5, never interpolation), scale-to-cover + centre
crop when `--size`, grade appended, `setparams` bt709, yuv420p, no audio, exactly N frames. Refuses (exit 2) when the clip
can't cover N frames from `--start` and says how much is missing. Prints the cadence ("24 → 30 fps: 1 repeat every 5").
Must reproduce today's `out/fal/v2/plate1-v2-fit.mp4` from `plate1-i2v.mp4` with today's grade/start/frames
(pixel-close; record the max abs diff).

### `pin.py` — put the app screen on a phone held in the footage
```
python3 $V/footage/pin.py <in> <screen.png> <out.mp4> --frames N [--fps 30] [--start S] [--size WxH] [--grade "…"] [--dark 24] [--track-png PATH]
```
Today's `carousel_pin.py` generalised (any clip size/orientation; processing size from the clip; same tracking: dark mask,
union-find pick of the phone-like region, geodesic regrow, diagonal-extreme corners pushed out 4 %, 3-frame smoothing,
PIL PERSPECTIVE warp, composited only where the phone is black so fingers stay in front), then conformed like conform.py.
Exit 3 with advice when frame 0 has no phone-like black region (prompt the model for "the screen stays completely black").
Must reproduce today's `out/fal/v3/car0-fit.mp4` from `car0-i2v.mp4` + `ui_home.png` (pixel-close).

### Optional: `screen.mjs` — a stand-in app screen PNG for pinning
Only if the engine makes it simple (e.g. render one `phone` shot's screen at 3× via the existing stage). Otherwise the docs
say: pin the product's real screenshot (official), or a still of a `phone` / `panel` shot.

### `templates/footage-prompts.md` and `FOOTAGE.md`
- footage-prompts.md: the key-frame brief (written like a cinematographer: lens, distance, motivated mixed-temperature
  low-key light, lived-in set, wardrobe, grain; unbranded devices; "the screen is completely black" for pinning), the motion
  brief (real-time, handheld sway, performance, "keep the lighting… of the first frame", no text/captions/logos), a
  checklist against the fake look, and today's prompts as worked examples (from the input.json files).
- FOOTAGE.md: when to generate here vs the user's own clips; the approval gate (show prompts + count + estimate, generate on
  "yes"; stills first, pick, then video); the realism recipe (photo key frame → image-to-video, never the vector draft as the
  look — a vector/guide clip only via reference-to-video for timing, and it copies drawn details literally); measure the
  reference's look (`look.py --ref`) and grade to it (today's grades as starting points); conform (24p cadence, start offset
  so the action lands on the shot's beats, durations come back stretched); pin UI; drop the result in via `bg:` / block
  footage fields; traps (Apple/brand logos in FLUX → ask for unbranded or fill out; CDN stalls; the model's audio; brand
  assets only from the official kit); costs (today: ~$1.10 per plate incl. 2 stills + 6 s at 1080P).

## B. `video/recreate/` + `music: film` — recreate a film frame for frame, score it, prove it (Worker B)

Port and generalise `hf02-full/tools/{sbs_full.py, verify_sbs.py, cutcheck.py, cuts.py, progress_sheet.py, track.py,
music_profile.py, beat_check.py}` and today's score `hf02-full/audio.mjs`.

### `compare.py` — side-by-side, cut report, sheet
```
python3 $V/recreate/compare.py --ref REF.mp4 --ours OURS.mp4 --out DIR [--from S] [--to S] [--half] [--audio ref|ours|none] [--label-ref TEXT] [--label-ours TEXT] [--cuts-from breakdown.json] [--no-video]
```
- `sbs.mp4` (`sbs-half.mp4` with `--half`): output frame i = reference frame i | our frame i, decoded **by frame index**
  (never ffmpeg hstack — it re-times irregular timestamps and slips frames), both scaled to one height, PIL labels. After
  encoding, decode it back and check every frame's halves against the source thumbnails of i vs i±1; print
  `verify: N/N frames exact` and exit 1 on any mismatch.
- `cuts.json` + `cuts.md`: reference cuts (shot boundaries from `--cuts-from` = the skill's `--breakdown` output if given,
  else detected), per cut our biggest picture change within ±4 frames and its offset; status exact / ±1 / off / missing; a
  `trivial` flag when either neighbouring shot of ours is near-blank (a cut next to a blank shot "matches" for free). Summary
  line like `cuts: 22 in the reference — 19 exact, 2 within 1 f, 1 off (n1234 +3 f)`.
- `sheet.png`: every reference shot's middle frame, reference over ours, with shot number + timecode.
- Same fps required (exit 2 otherwise); differing lengths → compare the overlap and say so.
- Acceptance: on `--ref ~/Downloads/higgsfield02.mp4 --ours ~/Downloads/launch-videos/hf02-full/film.mp4` it reproduces
  today's result (19 exact + 2 within 1 f of 22; the n75 corridor and n231 whip were false alarms of the old detector —
  report what the new one finds and explain any difference).

### `track.py` — measure a reference's motion
```
python3 $V/recreate/track.py <video> --key N --from A --to B [--roi x,y,w,h] [--scale-to WxH] [--half] [--init s,tx,ty] --out track.json
```
Today's similarity + blur registration (frame n ≈ blur(R((x − t)/s)) against sharp key frame N), reading frames from the
video by index; per frame scale, tx, ty, blur σ, speed in px/frame normalised to a 1080-wide frame; summary (peak speed and
its frame, decay ratio per frame). Read `reference_video_motion_measurement.md` for its traps (cut-frame blur over-reads
~2×: calibrate on our own render).

### `music.py` — style profile and "is ours on their beat?"
```
python3 $V/recreate/music.py profile <audio|video> [--bpm B --first-beat T] [--json OUT]
python3 $V/recreate/music.py compare <ref> <ours> [--json OUT]
```
- profile: today's music_profile.py (groove = onset strength per 16th of the bar by band, band balance, centroid, key
  guess) on the track's grid (from `--bpm/--first-beat`, else from the skill's tracker `node $V/lib/breakdown.mjs --tempo`).
- compare: both tracks' bpm / first beat / confidence (the skill's tracker), onset cross-correlation lag (ms), quiet
  stretches (≥ 0.25 s under −45 dBFS RMS) and the biggest hit with their times, profile deltas; a verdict line. Acceptance:
  reference vs today's `film.mp4` → lag 0 ms, 87.46 vs 87.45 BPM, first beat 0.3905 vs ~0.391 s, hit 59.94 s in both.

### `temptrack.py` — the private temp track
```
python3 $V/recreate/temptrack.py --film OURS.mp4 --ref REF.mp4 --out NAME[-tempmusic-PRIVATE.mp4]
```
Our picture + the reference's own audio stream-copied, for private review only (never a deliverable, never sent beyond the
user). Forces the `-tempmusic-PRIVATE.mp4` suffix, refuses when the two videos' durations differ by > 1 frame, writes
title/comment metadata saying so, then verifies decoded PCM == the reference's, video packets == ours, same audio priming
(start pts) → `PASS` + the reminder; exit 1 on any mismatch. Acceptance: reproduces today's
`out/film-tempmusic-PRIVATE.mp4` checks (md5 486aab4c…, video packets 80d435ae…).

### `music: film` — today's score as a composed style (`video/lib/audio.mjs`, `video/lib/spec.mjs`)
- spec.mjs, exactly three edits: `STYLES` gains `'film'`; the default key for film is `F`; a default bpm of 87 for film
  (wherever `STYLE_BPM` lives — if it's in a file outside your ownership, say so in the report instead of editing it).
- audio.mjs: a `film` arrangement built from today's `hf02-full/audio.mjs` (its instruments, MIX balance, 16th shaker with
  accents, stabs on beats 1 and 3 + a light pickup on the "and" of 4, the bass pattern, kick/clap, hats, I·vi·IV·Vsus2
  9th-chord progression in the job's key), generalised to any film:
  - the grid is beat k at `music.downbeat + k·beat` for every film-style event (intro included), so a film scored to a
    reference's grid can match its first beat (today: bpm 87.46, downbeat 0.3905);
  - intro (0 → the `drop` shot): pad swell + shaker pickup, riser into the drop; groove from the drop; each `breaks:` shot
    is a dip (pad + shaker only) with a short riser back in;
  - the end: a lift over the last two bars before the end card, the music silent for the last ~0.44 s before it, then the
    hit on the end card (bass + stab chord + crash + a bell bed ringing out). No end card → ring out on the last bar.
  - Everything else in audio.mjs (playful / keynote / calm / track / none, SFX, mixing) must stay byte-identical in output:
    prove it by building music.wav for old jobs before/after (one job per style) and comparing md5.
- Acceptance: a 16:9 film job with `music: {style: film}` (try the `--init --kit film` starter, and a 40–60 s job copied from
  `film-sample` with `breaks`/`drop`/`downbeat` set) passes `--film` (or `--audio`) QA; `lv.mjs --tempo` on its master reads
  the bpm within ±0.15 and the first beat within 35 ms of the grid with confidence ≥ 0.6; the music stem is below −50 dBFS
  RMS in the 0.40 s before the end card. The user will listen — say so.

### `RECREATE.md`
"Make ours move exactly like this film": what is borrowed (cut points, camera, easing, blur, event timings, beat grid) and
what never is (footage, frames, copy, characters, logos, music — the copy trap: write each line fresh, never swap nouns into
their sentence); measuring (`--breakdown`, `track.py`, `look.py`, `music.py profile`); building (shot lengths in frames
from the reference; drift cuts + camera fields; custom blocks for bespoke shots; official brand files only — an app icon
PNG has a transparent margin, trim it); footage (→ FOOTAGE.md); score (`music: {style: film, bpm, downbeat}` from the
reference's tracker reading, breaks/drop from its energy map; `music.py compare`; traps: flattening the 16ths killed the
pulse, off-beat stabs flipped the tracked phase half a beat); proofs (`compare.py`); the temp track (private review only);
delivery (master with our score; flag stand-ins and unconfirmed claims; the user listens); the worked example
(`~/Downloads/launch-videos/hf02-full/`, with today's numbers).

## Monitor — acceptance harness (test-first, black-box)

Build `$P/acceptance/` from this spec alone (not from the workers' code): a mock fal queue server (Node http; submit →
status IN_QUEUE/IN_PROGRESS/COMPLETED → response with image/video URLs; file downloads with Range support and an optional
mid-file stall/disconnect; an error mode; it records the Authorization header so tests can check it); synthetic fixtures
made with ffmpeg + PIL (a 24 fps clip with a black portrait "phone" rectangle that moves and is partly occluded by a moving
"finger"; a 30 fps video with cuts at known frames and one cut next to a black shot; a click track at a known bpm/phase;
two copies of a film where one is shifted by one frame); regression baselines with the LIVE skill (music.wav md5 for one old
job per style — copy the jobs into `$P/acceptance/jobs/` first). Then one runner `run.sh STAGE_DIR` that exercises every
command above against the staging copy and prints PASS/FAIL per check, including: the key never appears in any output or
written file; dry run makes no connection; exit codes; resume after a stalled download; conform frame counts/cadence;
pin's composite only inside the phone; compare's verify catches a deliberately slipped side-by-side; temptrack refuses a
mismatched film and verifies a good one; film style reads on the grid; old styles unchanged. Prove each check can FAIL
(plant one bad input per check) as well as PASS. Write `$P/acceptance/README.md`. Don't wait for the workers — the lead
will ask you to run it when they are done.
