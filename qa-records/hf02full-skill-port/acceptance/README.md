# Acceptance harness — hf02-full port into product-launch-sting

Black-box acceptance tests for `DESIGN.md` §A (`video/footage/`) and §B (`video/recreate/`, `music: film`), built from the
spec alone. It runs the staging copy's tools and judges only what they print, the exit code and the files they write.
It never reads the workers' code for meaning (the static checks only look at line 1–40 headers, imports and diff sizes).

```
bash run.sh /Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/stage/product-launch-sting
```

Prints `PASS` / `FAIL` / `SKIP` per check and a final count. Exit 0 means no FAIL; 1 means at least one FAIL; 2 means it
couldn't run (no sandbox, not a skill copy, or it was pointed at the live skill). Everything goes to
`runs/<YYYYmmdd-HHMMSS>/`: `report.txt` plus every command with its stdout and stderr (`*-runs.log`) and every output it judged.

| Option | Effect |
|---|---|
| `--no-real` | skip the checks that need today's real files (≈ 6 min faster) |
| `--no-slow` | skip the "download never completes → exit 5" and corrupt-video runs (they run in the background by default) |
| `--only static,gen,footage,recreate,film` | run some suites only |
| `--run-dir DIR` | write the run to DIR |
| `--self-test [--only mock,fixtures,baselines,gen,footage,recreate,film,static]` | prove the harness itself (below) |
| `--build` | rebuild the fixtures and the live baselines (already done; deterministic) |

**Runtime:** about 10 min for a full run (measured 9–10 min on 2026-10-22 with another test run sharing the Mac: gen
≈ 4 min, footage ≈ 2, recreate ≈ 3 with the 63.6 s real film and the motion tracker, film ≈ 2 including one `--audio` QA
pass on film-sample's 2,265 real frames). The slow download-failure scenarios run in parallel (the as-built tool gives up
after 30 tries in ≈ 65 s). A busy machine slows the timing checks: re-run before calling `gen.poll.interval`,
`gen.download.stall` or `gen.timeout` a FAIL.

**Last results (2026-10-22):** `runs/staging-2/report.txt` — **79 PASS, 0 FAIL, 0 SKIP** on the staging copy (before the
review round). Review round (85 checks now): static + film on the current stage `runs/staging-review-round-film/` 20/20
PASS; compare.fps-multiple PASS on the current stage; the new gen checks were proven on the oracle and the pre-review
tree only (Worker A was still editing gen.mjs). Every new check FAILs on `stage-r0-before-review-fixes/`. Round 2
(`runs/20261022-123431`, coordinator's run): 83 PASS, 2 SKIP — the two fault-injection checks, because compare.py and
temptrack.py now write a temp beside the output and rename it; the shim now matches those temps
(`runs/shim-r2-proof/`: both PASS on `stage-r2-after-codex-fixes`, both FAIL on temp-writing stubs that never verify).
Round 5 (87 checks; `runs/round5-r4/` on `stage-r4-final-candidate`, static + footage + film): 34 PASS, 2 FAIL — the new
`look.decode-exact` and the now decode-independent `look.real`, both failing by design on r4's look.py (QA1's 1928-px
decode, which Worker A is fixing). The exact decode predicts look.py's fixed numbers on today's clips: plate1-i2v p50 35.8
(sat 35.3), plate1-v2-fit p50 68.0 / sat 42.6 / sharpness 9.5 — FOOTAGE.md's table should land near these.
(`runs/staging-1` had 3 FAILs, all mine: the look/track JSON parsers read per-frame rows instead of the clip mean and
missed `outside` / `bx`,`by`; fixed format-only, thresholds unchanged.) Self-test: `runs/selftest-20261022-083010`
held 228/235 proofs; the 7 misses were bugs in my planted inputs (four oracle faults that didn't bite, one stub, two
synthetic film tracks that let tails into the end-card gap), fixed and re-proven in `runs/selftest-gen-refix/`,
`runs/selftest-refix-2/` and `runs/selftest-final-parts.log`.

## Safety: no spend, no real key, no writes to the originals

- Every staging tool runs under `sandbox-exec`: the real `~/Downloads/launch-videos/.env` can't be opened or even stat'ed,
  only 127.0.0.1 is reachable (the real fal API can't be called), and the live skill, `~/Downloads/launch-videos/**`, the
  reference `higgsfield02.mp4` and the staging copy itself are read-only. If `sandbox-exec` isn't usable, the run stops
  (exit 2): gen.mjs is never run without it.
- `lib/mockfal.mjs` is the fal queue (submit → `IN_QUEUE` / `IN_PROGRESS` / `COMPLETED` → result, `status_url` /
  `response_url` like the real ones, errors on demand, a held request for timeouts) plus a CDN (Range/206/416, mid-file
  stall, cut connection, cut-unless-resumed, 503, corrupt bytes, a clean early end with no Content-Length). It binds
  **ephemeral ports** (49152+), never the 18766/18767/18950 other runs use. It records every request; the
  `Authorization` header is logged as the NAME of a known fake key, any other value only as length + sha256 prefix.
- Three distinctive FAKE keys (`lib/harness.py`). The leak check scans for any 12-character window of them (plus base64 and
  URL-encoded forms) in every stdout/stderr, every file the tool wrote, the fake HOMEs, TMPDIR and new files in /private/tmp.
- Old jobs are copies in `jobs/` (definitions + assets only); the QA job clones film-sample's frames with APFS `cp -c`
  (no space, originals untouched).

## What each check proves

`[real]` = needs today's real files (`~/Downloads/higgsfield02.mp4`, `hf02-full/film.mp4`, `out/fal/v2`, `out/fal/v3`);
everything else uses the synthetic fixtures in `fixtures/` (made by `fixtures/make_fixtures.py`, each with a `truth.json`).
"Planted bad" is the input the self-test feeds the same check to prove it can FAIL; "good" is what proves it can PASS.

### static (staging copy vs `live-before.sha1`)
| Check | Proves | Planted bad (→ FAIL) |
|---|---|---|
| static.live-untouched | the live skill still equals the pre-port snapshot | a copy of live with SKILL.md touched |
| static.ownership | only SKILL.md, GUIDE.md, lib/audio.mjs, lib/spec.mjs and (one line) templates/beats.yaml changed; new files only in footage/, recreate/, the 3 new docs; node_modules unchanged | engine/kit.js edited, a stray file, beats.yaml with 3 changed lines |
| static.spec-edits | spec.mjs: exactly the 5 approved edits — one line each for STYLES, STYLE_BPM and the default key (all `film`), one self-contained `music.hit` block right after the `music` object, and the hit-warning line (exact text, `HIT_WARN_LINE` in suite_static.py) right after the `music.breaks` unknown-id line | a 6th edit; the warning line reworded; stage-r2 (no warning line); the pre-review tree |
| static.py-headers | every new .py starts with the coding line | a .py without it |
| static.py39-c-locale | every new .py parses on /usr/bin/python3 3.9 and runs `--help` under `LC_ALL=C PYTHONUTF8=0` with no traceback | a `match` statement |
| static.sibling-imports | sibling imports come after `sys.path.insert` (works under `python3 -I`) | import before insert |
| static.gen-no-npm | gen.mjs imports only Node built-ins | `import fetch from 'node-fetch'` |
| static.exit-codes-documented | each new tool names its exit codes in its header | a tool without |
| static.docs | FOOTAGE.md / RECREATE.md / footage-prompts.md exist and cover the basics; GUIDE.md and SKILL.md point to them; GUIDE has the requirements line (python3 + numpy + Pillow, curl) and its Limits paragraph points at FOOTAGE.md; templates/beats.yaml lists `film (groove, 87)`; "nothing is generated here" is gone | a two-line FOOTAGE.md; the pre-review tree |

Good: a planted-good stage (live + my own 3 spec edits + minimal new files and docs).

### gen.mjs (mock queue; good = `oracle/gen.mjs`, my client written from the spec; each fault is an `ACC_FAULT` switch in it)
| Check | Proves | Planted fault |
|---|---|---|
| gen.dry.still | dry run prints endpoint, input (raw / jpeg / 2 images / seed / aspect), the dry-run line; exit 0 | `dry-quiet` |
| gen.dry.no-network | 7 dry runs make **0 connections**; a dry run still exits 0 with all network blocked | `dry-connect` |
| gen.dry.no-files | dry runs write nothing | `dry-files` |
| gen.dry.datauri-display | key frame / guide shown as `<file NAME, N KB>`, never base64; `--prompt @file` read | `dry-base64` |
| gen.cost | $0.12 (2 stills), $0.24 (4), $0.96 (6 s), $0.80 (default 5 s), $0.96 (5.4 s guide → 6 s), "unknown — check fal.ai/models", "checked 2026-10-22" | `no-cost` |
| gen.still.go | POST fal-ai/flux-pro/v1.1-ultra with today's field names/values, `Key` auth, `<prefix>_0/_1.jpg` = served bytes, estimate repeated | `wrong-fields` |
| gen.video.i2v | image-to-video: key frame as a data URI (bytes checked), duration/resolution/prompt_expansion_mode/seed/enable_safety_checker; clip = served bytes; success line names the model's audio + 24 fps | `wrong-fields` |
| gen.video.defaults | duration 5, 1080P, disabled, safety on | `default-sec-6` |
| gen.video.r2v | guide as data URI; 5.4 s → 6, 3 s → 5; 16:9; a 16 s guide refused before any request | `guide-no-limit` |
| gen.raw | `@file` → data URI only in `*_url`/`*_urls`; other fields untouched; every `{url}` leaf downloaded | `raw-convert-all` |
| gen.log | `.fal.json`: endpoint, `<file NAME>` (no data URI), request_id, submitted/finished, estimate, output URLs, files + sizes, auth ≤ `Key ****` | `datauri-log`, `leak-log` |
| gen.poll.interval | status polled every ~3 s (median 2.5–4.5 s) | `poll-fast` |
| gen.download.curl | downloads are made by curl | `node-download` |
| gen.overwrite | re-run → exit 2 **before any request**, files untouched; `--force` cleanly replaces (no `curl -C -` onto the old file); `.prev` copies are fine | `overwrite`, `force-resume` |
| gen.force-failure-intact | a `--force` run that fal rejects (422) leaves the old stills and the old log untouched, nothing moved | `force-early`; the pre-review tree (deleted key_0/1.jpg) |
| gen.log-after-accept | no `.fal.json` when fal rejects the submit (422 / 401): the log appears only once there is a request_id | `log-early`; the pre-review tree |
| gen.stray-args-exit2 | stray positional arguments → exit 2 before any request or file (dry run and `--go`) | `stray-ok`; the pre-review tree (submitted 5 requests) |
| gen.key.sources | `--env FILE` > `FAL_KEY` > `~/Downloads/launch-videos/.env` (via `$HOME`), quotes + `export ` parsed | `env-precedence` (old order), `no-env-default` |
| gen.key.envfile-without-key | `--env` file with no key line + `FAL_KEY` exported → exit 3, nothing sent (lead's change) | `env-fallback` |
| gen.key.missing-exit3 | no key anywhere → exit 3, says where the key goes, nothing sent | `no-exit3` |
| gen.key.never-leaks | no window of the fake keys anywhere; downloads carry no Authorization | `leak-stdout`, `leak-log`, `key-to-cdn` |
| gen.errors.exit4 | 422/401 on submit, status FAILED, 422 on the result, a result `detail` → exit 4 + fal's message + request_id | `exit1-errors`, `no-rid` |
| gen.timeout | `--timeout 5` on a held request → gives up, prints the request_id | `timeout-silent` |
| gen.fetch | `fetch <id> --endpoint … --out …` re-polls (with the key) and downloads | `fetch-broken` |
| gen.download.resume | CDN cuts every from-zero GET at 40 % → the next try resumes with `Range: bytes=N-`; bytes exact | `no-resume` |
| gen.download.stall | a 6 s mid-file stall is waited out (1 GET, no speed-limit cut-off) | `speed-limit` |
| gen.download.verify | a clean early end with no Content-Length, and corrupt bytes, are never accepted with exit 0 | `no-size-check` |
| gen.download.exit5 | CDN always 503 → exit 5 with the URL printed (background; default 30 tries) | `exit1-download` |

### footage (good = `oracle/look.py`, `oracle/conform.py`, `oracle/pin.py` — the last wraps today's `carousel_pin.py`)
| Check | Proves | Planted bad |
|---|---|---|
| look.oracle-still | all 9 measures on a still = today's `look_stats.py` formulas (p50 ±1, sat ±0.5, sharpness ±5 %, grain ±10 % …) | p50 +5 |
| look.ref-flags | `--ref`: both columns, a delta, p10/p50/p90 flagged (ours is +50 luma above every reference frame), ≥ 2 measures not flagged | every measure flagged |
| look.decode-exact | five flat stripes with known YUV values (lossless, BT.709 tags) at 1920×1080 **and 1928×1076**: p10/p90 ±0.75, p50 ±1, shadow ±0.5, sat ±4 % of an exact BT.709 decode, and the same at both widths (QA1: 2 code values dark at 1928 px) | stage-r4 (p10 32 vs 34 at 1928 only); planted 1928-only shift |
| look.real `[real]` | decode-independent: plate1-i2v and plate1-v2-fit (both 1928 wide) measured by look.py = today's formulas on an exact BT.709 decode (`lib/exactdecode.py`, raw yuv420p planes → exact matrix) of the same frames — the tool's own sample times when its JSON lists them; p10/p50/p90/shadow/sat ±1, sharpness ±5 %. Today's documented numbers (35 / 55 %, 64 / 46 / 9.5) are printed, not judged | every percentile 2 dark; stage-r4 (34.6 vs exact 35.8, 66.5 vs 68.5, sat 45.6 vs 42.5) |
| conform.cadence | 24→30: N frames, native speed, exactly one repeat in every 5 frame steps, first frame = the `--start` frame, no blended frame (frame-index barcode), no audio, yuv420p, bt709 tags, prints the cadence | minterpolate, setpts 0.8, 61 frames, audio kept, untagged, yuv444, late start |
| conform.size-cover | `--size 360x360` / `1280x720` = scale-to-cover + centre crop | squashed to 360×360 |
| conform.grade | `--grade eq=brightness=0.08` raises luma, same frames | grade ignored |
| conform.30fps | 30 → 30 one-to-one | 61 frames |
| conform.refuse-short | too-short clip → exit 2 and says how much is missing | stub that never refuses |
| conform.real `[real]` | plate1-i2v → 169 f, start 0.9, today's grade, `--crf 14` ≈ today's plate1-v2-fit (per-frame mean ≤ 1; my oracle gets max diff 0) | another grade |
| pin.composite-inside-only | screen goes only where the phone is black: pixels outside the phone, the bezel and the finger over the glass unchanged; the screen filled every frame; the right way up (4 colour quadrants) | no dark mask, +30 px spill, frame-0 track frozen, screen rotated 180° |
| pin.frames-cadence | 90 frames @30, 1 repeat in 5, no audio, bt709 | sped-up clip |
| pin.track-png | `--track-png` writes a PNG | nothing written |
| pin.no-phone-exit3 | no black region in frame 0 → exit 3 + "black" advice | stub exit 0 |
| pin.real `[real]` | car0-i2v + ui_home.png, 69 f, start 0.2, 720×1290, today's carousel grade ≈ car0-fit.mp4 (mean ≤ 1; oracle max diff 0) | start 0.0 |

The phone fixture (`fixtures/phone24`) is a 720×1290 24 fps clip with a near-black rounded screen that drifts and turns,
a lighter bezel, a skin-coloured "finger" crossing the glass, grain, a camera pan and a burnt-in frame-index barcode;
`truth.json` has the screen corners and finger per frame. Today's algorithm passes it (outside Δ ≤ 1.6, finger Δ ≤ 0.7).

### recreate (good = `oracle/compare.py`, `oracle/track.py` (wraps today's `track.py`), `oracle/music.py`, `oracle/temptrack.py`)
| Check | Proves | Planted bad |
|---|---|---|
| compare.sbs-frame-lock | `verify: 300/300 frames exact`, and my own decode-by-index of sbs.mp4: frame i = ref i \| ours i, on a reference with µs-jittered timestamps **on which ffmpeg hstack slips** (fixture self-test shows it) | a slipped side-by-side; an ffmpeg-hstack one |
| compare.verify-catches-slip | a fault-injecting `ffmpeg` on PATH (`lib/shim/`) slips the side-by-side ffmpeg writes — the final sbs.mp4 or any temp beside it in the `--out` folder holding "sbs" (round 2 writes `.sbs.<rand>.tmp.mp4`, then renames) → compare.py's own verify exits 1 (SKIP only if the tool doesn't call ffmpeg via PATH) | a stub that writes through a temp + rename and never verifies |
| compare.cuts-exact / -shift1 / -mixed | summary + cuts.json: 7 exact; 7 within 1 f (+1); 5 exact, 1 off "n104 +3 f", 1 missing | tampered reports |
| compare.cuts-trivial | `trivial` on exactly the two cuts next to our black shot | flags removed |
| compare.cuts-from | `--cuts-from` the live skill's breakdown.json | a cut dropped |
| compare.fps-mismatch-exit2 | 25 vs 30 fps → exit 2, no video | stub exit 0 |
| compare.fps-multiple | ours at 60 fps vs a 30 fps reference: our frame 2i stands against reference frame i on all 300 frames (odd frames carry a different barcode), verify 300/300, 7 exact | side-by-side paired with our odd frames; the pre-review tree (exit 2) |
| compare.overlap | different lengths → compares the overlap, says so, verify 240/240 | silent tool |
| compare.sheet | sheet.png holds every reference shot and every one of ours | ours removed |
| compare.options | `--no-video`, `--half` (half size or half speed both accepted; staging makes half size), `--audio ref/ours/none` (440 / 880 Hz / none), `--from 2 --to 6` (120 frames from ref frame 60) | stub ignoring options |
| compare.real `[real]` | ref vs film.mp4: ≥ 19 exact, exact + within-1 ≥ 21, 20–25 reference cuts; lists differences from today's 22 | a 17-exact summary |
| track.pan | 21 frames of a known pan (peak 24 px/f, ×0.8 decay, blur σ = 0.2 × speed): tx ±1 px, speed ±1.5 normalised to 1080 wide (fixture is 540 wide → ×2), blur ±35 %, peak + frame + decay | speed not normalised; tx sign flipped |
| track.zoom | centre zoom 1.015…1.18: scale ±0.003, translation consistent | scale under-read 20 % |
| music.compare-clicks | click tracks: 100/100 BPM, first beat 0.25/0.29, lag ±40 ms, quiet ≈ 19.6 s, hit ≈ 20.65 s; identical copy → lag 0 | lag reported 0 |
| music.profile-groove | groove fixture: kick on 1+3, snare 2+4, hats on the off-beat 8ths, key F major; tracker grid without `--bpm` | groove shifted an 8th |
| music.real `[real]` | ref vs film: 87.46 vs 87.45 BPM, first beat 0.3905 vs ~0.391, hit 59.94 in both, \|lag\| ≤ 12 ms (settled: ~+5 ms) | loudest moment (50.47 s) as the hit |
| music.real-profile `[real]` | our film: key F major, centroid within 10 % of today's 3116 Hz | wrong key/centroid |
| temptrack.suffix-refuse | suffix forced (`a`, `b.mp4`, `c-tempmusic-PRIVATE.mp4`, no doubles); −2 and +10 frames refused, nothing written | lax stub |
| temptrack.verify-good | decoded PCM = reference, video packets = ours, same audio start, metadata says private, PASS + reminder | lax stub |
| temptrack.verify-catches | the shim re-encodes the audio, then the video of whatever ffmpeg writes beside `--out` holding its name (round 2: `.x-tempmusic-PRIVATE.<rand>.tmp.mp4`) → the tool's verify exits 1 | a stub that writes through a temp + rename and never verifies |
| temptrack.real `[real]` | film.mp4 + higgsfield02.mp4 → PCM md5 486aab4c…, video packets 80d435ae… | re-encoded audio / video |

### film style + regressions (good = a planted-good stage: my 3 spec edits + a toy film arrangement; the synthetic film track)
| Check | Proves | Planted bad |
|---|---|---|
| film.spec-defaults | `style: film` accepted, 87 BPM, key F; bpm/downbeat honoured; unknown styles refused; keynote still 124/D; `--grid` shows 87 BPM | the live skill |
| film.grid | film-sample at 87.46 / 0.3905 + an end card (≈ 58 s): `lv.mjs --tempo` on the master reads ±0.15 BPM, first beat ≤ 35 ms off the grid, confidence ≥ 0.6 | synthetic track shifted half a beat; live skill |
| film.endcard | without `music.hit`: music stem < −50 dBFS RMS in the 0.40 s before the end card, the hit on the card, a ring-out | keynote at the same grid; a synthetic track with no gap |
| film.hit-validation | `music.hit` (lead, review round): 0.372 and −0.5 carried; 59.939 → `lv.mjs` exit 2 naming hit; 2.5 refused; absent → default | the pre-review tree (59.939 accepted, hit not carried) |
| film.hit-offset | `hit: 0.372` on a job with an end card: the hit lands 0.372 s after the card's first frame (±10/+30 ms), < −50 dBFS in the 0.40 s before it, rings out | the pre-review tree; a synthetic track with the hit still on the card |
| film.hit-warning | `hit:` on a film whose last shot isn't an endcard → `--grid` warns "music.hit does nothing here … (end) is a type …"; no warning without hit, with the endcard last, or for keynote | stage-r2 (no warning) |
| film.intro-grid | intro onsets on the 16th grid anchored at the downbeat (median ≤ 8 ms), intro low end ≥ 12 dB under the groove | keynote (intro counted from 0) |
| film.breaks | the `voice` break: low end ≥ 12 dB under the groove | kick kept in the break |
| film.no-endcard | without an end card: no end-card gap, the last bar rings | a gap left in |
| film.starter | `lv.mjs --init --kit film` + `music: {style: film}` → 87 BPM, key F, tempo on the grid | live skill |
| film.qa-audio `[real frames]` | film-sample's 2,265 rendered frames re-scored with `style: film` (same 124 BPM timeline) → `lv.mjs --audio` QA PASSED | live skill (exit 2) |
| film.old-styles-unchanged | 9 old jobs (playful ×3, keynote ×2, calm, track+voiceover, none ×2): every stem + the compiled timeline byte-identical to the live skill's (baselines, built twice: deterministic) | old-cue rebuilt in G |

Baselines: `baselines/live-audio/*.json` (music.wav md5 per style: playful 2a28e796… (cue), keynote 4e01b19e…
(film-sample), calm b700694e… (steady-sample in calm — no calm job existed), track 5f94454c… (edge-test); `none` has no
music stem, so its other stems are compared), `baselines/live-skill.sha1`, `baselines/look-oracle.json`,
`baselines/oracle-real/` (today's plate1 and car0 outputs reproduced bit-exactly by the oracles — proof the real-file
parameters are right), `baselines/music-profile-today.txt`.

## Self-test (`bash run.sh --self-test`, ≈ 25 min)

1. mock + sandbox (25 checks: auth, data-URI digests, status flow, errors, Range/206/416, cut/stall/drop/503/short, the
   sandbox blocks the internet, the real .env and writes); 2. fixture truths (barcodes on every frame, the live breakdown
   finds the 7 planted cuts, irregular µs timestamps, ffmpeg hstack slips, the live tracker reads the click tracks to
   1 ms); 3. baselines rebuild identically; 4. every check above shown to PASS on its good input and FAIL on each planted
   input. It ends with a proof matrix (`proven` / `partial` / `BROKEN`).

## What it can't check

- **Anything about the real fal service**: request shapes are checked against today's logged requests, never against
  fal itself (no spend). Real CDN stalls are simulated, not reproduced.
- **How it looks or sounds**: the film score is judged by meters, tracker, onsets and band energies; the user still has to
  listen. Grade, pin and look are judged by numbers, not taste.
- **look.py's reference-plate and carousel numbers** (p50 63–80, carousel p50 125): today measured them on crops the CLI
  has no option for.
- **compare.py on the real film** is judged against today's counts; a different but correct detector can disagree — read
  the worker's explanation of any difference the check lists.
- **pin.py's tracking on real footage** beyond car0: the fixture is synthetic (clean edges, one finger).
- **Docs quality**: only presence and key terms.
- If a tool writes its output through something other than `ffmpeg` on PATH, the two fault-injection checks SKIP.
- Options never exercised: `track.py --roi/--scale-to/--half/--init`, `pin.py --dark`, `conform.py --fps` other than 30,
  `gen.mjs --raw false/--res`, `compare.py --label-*` (labels are drawn, not read back), the optional `screen.mjs`.
- The film score's riser, the two-bar lift and the bell bed are not measured (only the grid, the intro, breaks, the
  0.40 s gap, the hit and the ring-out).

## Settled spec-vs-built differences (the lead's list, 2026-10-22 — not flagged as bugs)
Key order (`--env FILE` first, no fallback when it lacks the key line) · downloads: a fresh `curl -C -` per try, no
`--retry` (`FAL_DL_ATTEMPTS` / `FAL_DL_TIMEOUT`) · `conform --crf` default 15 (the real-file check passes `--crf 14`) ·
look.py prints p2/p10/p50/p90/p98 · the film style's shaker / music bus · breaks = pad + shaker only · music.py's
onset lag ≈ +5 ms (sub-hop), so the bar is |lag| ≤ 12 ms. Review round: spec.mjs's 4th edit (`music.hit`, −1…2 s,
default 0) · templates/beats.yaml one-line comment · `--force` moves the old outputs + log to `.prev` only after fal
accepts · the log only once there's a request_id · stray positionals exit 2 · compare.py takes ours at an integer
multiple of the reference fps · drop/break cuts snap within 35 ms of a grid line · touching breaks merge into one dip
(the last two are covered only by the existing grid/break checks, not by dedicated ones).

## Layout
```
run.sh                 entry point
lib/run.py             the runner · suite_static / suite_gen / suite_footage / suite_recreate / suite_film
lib/harness.py         paths, fake keys, sandbox, mock control, reporting · evals.py independent evaluators
lib/mockfal.mjs        mock fal queue + CDN · shim/ffmpeg + shim_ffmpeg.py fault injection · build_audio.mjs
lib/selftest.py        the self-test · selftest_mock.py · planted.py · make_baselines.py · barcode.py
oracle/                my spec-following tools (good inputs for the self-test); oracle/today/ = copies of today's tools
fixtures/              synthetic inputs + truth.json (make_fixtures.py) · jobs/ old-job copies + film jobs
baselines/             live-skill baselines · runs/ every run (report.txt, logs, outputs) · planted/ planted stages and stubs
```
