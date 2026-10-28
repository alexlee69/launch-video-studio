# QA pass 2: the old work is unchanged (2026-10-27)

**Verdict: PASS.** The stage tool leaves every old job as the live tool makes it. The only changes are new WARN / INFO lines and run-to-run raster noise, and I proved the noise against the live tool itself.

**The results:**
- **`--grid`, all 16 original jobs:** no non-warning line differs. The stage only adds `!` warnings, and rewords the old "≈4 words/s" reading lines with SPEC-R1's new formula. In `timeline.json` only `delivery`, `reading` and `warns` differ.
- **Storyboard heroes:** **215 / 219 byte-identical** across 14 jobs and every aspect each job declares. 2 jobs fail identically in both tools. The 4 that differ are:
  - **film-sample `10-wall`**, in all 3 aspects, max 2 / 2 / 3. This is the known wall noise: two live runs differ by max 3 / 1 / 3.
  - **manus2-space `06-S06`**, max 15. This one is outside the letter of the allowed exception (it is not a wall/stack hero, and it is above 3). It is the live tool's own flake: across 12 live runs, S06 came out in two variants, 8 × the stage's bytes and 4 × the other one. See F1.
- **Films, `--film --aspect 16x9`, both tools:**
  - **steady-sample, reel-sample, qa-probe, qa-probe2 (seam and whip):** PASS / FAIL lines identical. Frames, bgref, mp4 and master WAV are all **byte-identical**.
  - **film-sample:** PASS lines identical (QA PASSED, 16 checks). **2172 / 2265 frames byte-identical.** The other 93 differ by **max 1–3**: 92 frames in the `wall` shot plus `scan`'s first frame. Two extra live runs on the same draw sequence differ from each other by the same amount (max 3, 200 frames), so this is the documented wall raster noise.
- **qa-probe and qa-probe2** still FAIL with the same lines as the live tool:
  - qa-probe: freeze 181–239 + content 80 frames, QA FAILED (2).
  - seam: freeze 118–121, QA FAILED (1).
  - whip: content 24 frames, QA FAILED (1).
- **Mode A:**
  - Every root file is cmp-identical to the live skill, and so are `brands/` and `node_modules/`. SKILL.md differs only in the mode-B overview; its Mode A section is identical.
  - One build following SKILL.md (`--init` → brand.json from `brands/example-design-autopilot.json` → `--stills` → `--film --workers 2`) ends with **QA PASSED (8/8)**.

**Two things I want you to see:**
- **F1:** manus2-space's custom `editor` block is not deterministic in the **live** tool. A rounded image thumbnail's rim flips between 2–3 raster variants from run to run, up to 21 code values, on S06, S11 and S17. It is the reason one hero falls outside the stated exception.
- **F2:** mode A's frames are not byte-reproducible run to run, even with the live tool against itself. That is 57 / 720 frames, max 68, in the S3 glass / prompt shots. The stage run differs from the live runs the same way, and from both of them by max 111 on frame 220. The code is byte-identical, so this is Chrome, not the stage. QA passes every time.

Shorthands:
- `M = /Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit`
- `J = $M/jobs`
- `LIVE = node /Users/bytedance/.claude/skills/product-launch-sting/video/lv.mjs`
- `STAGE = node $M/stage/product-launch-sting/video/lv.mjs`
- `PY = /Users/bytedance/Downloads/Design-AutoPilot-stable/.venv/bin/python3 -I`

Logs are in `$J/qa2-logs/`. `summary.txt` has every step's rc, time and free disk, and my scripts are in `$J/qa2-tools/`.

## Decisions I took (no questions asked)

- **What counts as an original job.** I took every top-level folder under `~/Downloads/launch-videos` that has a `beats.yaml`, except `motion-kit-sample`. That gives 16 jobs, the same set merge.md used. The 33 nested draft and scratch jobs (`breakdown-qa/draft-jobs/*`, `breakdown-qa/wiring-test/*`, `hf01-study/gaps/*`, `hf01-study/storyboard-space/verify-rollback`) got a **`--grid`-only** comparison as an extra, in `$J/qa2-nested/`.
- **Clones.** Each job became `$J/qa2-live-<name>` and `$J/qa2-stage-<name>`, made with `cp -c -R` of every top-level entry except `out/` (`qa2-tools/clone.sh`). Extra copies for noise proofs are `qa2-live2…6-*` and `qa2-stage2-*`. No tool ever ran with `--job` on an original.
- **Which cuts.** Storyboards and films use the default `main` cut. qa-probe2's own header says "render the two cutdowns, never main", so its films are `--cut seam --workers 2` and `--cut whip`.
- **Comparing the logs.**
  - QA lines: PASS / FAIL lines and the verdict must be identical, every live WARN / INFO must still be there, and stage-only lines must be WARN / INFO (`qa2-tools/qacmp.py`).
  - `--grid`: with `difflib` (`qa2-tools/gridcmp.py`). A removed live line passes only if it is a reading-time `!` line reworded for the same shot.
- **Pixel tool.** `/usr/bin/python3` has no PIL, so the PNG compare (`qa2-tools/cmpdir.py`) uses the repo `.venv` Python. It byte-compares first, and for differing PNGs gives max |Δ|, channels > 2 and the diff's bounding box. qa1 did the same.
- **Noise proofs.** I proved noise against the **live** tool:
  - Storyboard heroes: extra live runs on fresh clones.
  - film-sample film: three `--range 1133,1950 --workers 1` renders, two live and one stage. In the full 2-worker film, 1133 is exactly where the second Chrome page starts, so a 1-worker range from 1133 repeats that page's draw sequence frame for frame. This follows the brief's rule to prefer slices.
- **Mode A.**
  - **Where:** the scratch output folder is `$J/qa2-modeA`. `/private/tmp` is wiped on restart.
  - **Inputs:** brand.json is the `--init` starter, overwritten with `brands/example-design-autopilot.json`, as SKILL.md step 2 says.
  - **The approval stop:** I read the stills and continued, because there is no user to approve them in a QA pass.
  - **Extra runs:** I added two live mode-A builds (`qa2-modeA-live`, `-live2`) to compare frames (F2).
- **My runner.** All renders ran serially through `qa2-tools/run.sh`, which waits 180 s while `pmset` reports a warning and refuses a render below 26 GB free.
  - The first version let an inner ffmpeg read the step file on stdin. It ate the "fi" of one step name (`lm-live-qa-probe`); the command itself was intact.
  - I renamed that log back to `film-live-qa-probe.log` and re-ran its QA comparison into `qa2-logs/qacmp-qa-probe.txt`.
  - Later steps run with `< /dev/null` and `ffmpeg -nostdin`.

## 1 · `--grid` (both tools, 16 jobs)

- **Commands:** `qa2-tools/grid.sh <16 names>` runs `LIVE --job qa2-live-<n> --grid` and `STAGE --job qa2-stage-<n> --grid`, then `qa2-tools/gridcmp.py`.
- **Exit codes** match in every job: rc 0, except shots-demo, which is rc 2 in both (`shots: []`).
- **Outputs:** `qa2-logs/grid-{live,stage}-<n>.log` and `qa2-logs/grid-compare.txt` (every added line, verbatim).

**Every non-warning line is identical in all 16 jobs.** In each `timeline.json`, the only top-level keys that differ are `delivery` and `reading`, plus `warns` where there are new warnings. Shots, cuts, frames and cues are equal.

| Job | Lines live → stage | Added (all `!`) | Reworded (old ≈4 words/s line → new formula) |
|---|---|---|---|
| cue-overlays, dark-ui-check, qa-probe, shots-demo | 5→5, 5→5, 6→6, 3→3 | 0 | 0 |
| cue | 11 → 16 | 5: reading 3, transition types 1, no cause 1 | 0 |
| edge-test | 11 → 15 | 5: reading 3, types 1, cause 1 | 1 (`a`) |
| film-kit-dev | 14 → 17 | 3: reading 1, types 1, cause 1 | 0 |
| film-sample | 14 → 22 | 8: reading 6, types 1, cause 1 | 0 |
| hf02-skill | 11 → 11 | 4: reading 4 | 4 (`a b d e`) |
| layers-probe | 16 → 18 | 3: reading 2, cause 1 | 1 (`p10`) |
| manus2-film | 38 → 44 | 15: reading 14, cause 1 | 9 (S05 S07 S10 S11 S12 S16 S18 S19 S25) |
| manus2-space | 29 → 46 | 17: reading 16, cause 1 | 0 |
| qa-probe2 | 6 → 7 | 1: cause 1 | 0 |
| reel-dev, reel-sample | 10 → 18 each | 8: reading 7, cause 1 | 0 |
| steady-sample | 9 → 14 | 5: reading 4, cause 1 | 0 |

- **The added line types** (example wording, film-sample):
  - `! open: 5 words on screen for 2.4 s — viewers need ~2.6 s (0.4 s to build + 0.35 s a word + 0.5 s; at least 1.4 s); cut words or lengthen it`
  - `! 3 transition types in one film (zoom: …; whip: …; blur: …) — keep it to two plus cuts (or declare the one you repeat as signature: <type>)`
  - `! moving transitions without a visible cause: open (zoom-in), brief (zoom-out), team (whip-up), command (zoom-out) — name what in the shot drives each one with cause: …`
- **The counts match merge.md's step-4 table exactly.**
- **The reworded lines** are SPEC-R1's "Reading time: replace the ≈4 words/s rule". Strictly, that is a changed warning, not only an added one, and it is by design.

**Extra: 33 nested draft/scratch jobs, `--grid` only** (`qa2-logs/ngrid-summary.txt`, `ngrid-compare.txt`):
- **Same rc in all 33** (32 × rc 0, verify-rollback rc 2 in both).
- **No non-warning difference in 32.** Their differences are only added `!` lines and reworded reading lines.
- **`hf01-study/storyboard-space/verify-rollback`** (broken in both: unknown blocks, missing assets) differs only in its error lines' built-in block list, which now ends "…, wall, **press, fan, particles, map**". That is the new blocks, as expected.

## 2 · Storyboard heroes (both tools, every declared aspect)

**Commands** (serial, `qa2-tools/steps-board.txt` via `run.sh`, 13:19–13:28): `LIVE|STAGE --job qa2-{live,stage}-<n> --storyboard --aspect all`.
- **Compare:** `qa2-tools/boardcmp.sh` (heroes `out/main/<aspect>/board/NN-*.png`), output in `qa2-logs/board-compare.txt`.
- **Log diff:** `qa2-tools/boardlogcmp.sh`, output in `qa2-logs/boardlog-compare.txt`.

| Job | Aspects | Heroes identical | Notes |
|---|---|---|---|
| steady-sample | 16x9, 9x16 | 7/7 · 7/7 | |
| film-sample | 16x9, 9x16, 1x1 | 11/12 · 11/12 · 11/12 | `10-wall` max 2 / 2 / 3 (0 / 0 / 1 channels > 2). **Live vs a 2nd live run: max 3 / 1 / 3.** Three different hashes per aspect (live, stage, live2), e.g. 16x9 `a8850a09` / `adfbb690` / `daf7df80`. Known wall noise, within the exception |
| reel-sample | 9x16, 16x9, 1x1 | 8/8 × 3 | |
| dark-ui-check | 16x9 | 3/3 | |
| edge-test | 1x1 | 7/7 | |
| qa-probe, qa-probe2 | 16x9 | 4/4, 4/4 | |
| cue-overlays | 16x9 | 3/3 | |
| cue | 16x9, 9x16 | 9/9 · 9/9 | |
| hf02-skill | 16x9, 9x16, 1x1 | 5/5 × 3 | |
| layers-probe | 16x9 | 13/13 | |
| manus2-film | 16x9 | 27/27 | |
| manus2-space | 16x9 | 26/27 | `06-S06` max 15, 934 channels > 2, only the rim of the 2nd Alchemy thumbnail. **Live flake, F1** |
| reel-dev | 9x16, 16x9, 1x1 | 8/8 × 3 | |
| film-kit-dev | 16x9, 9x16, 1x1 | — | Both tools rc 1, identical error in each aspect: `layer name "footage" is the engine's own layer in this shot` (documented in its SUPERSEDED.md) |
| shots-demo | 16x9 | — | Both rc 2 (no shots) |

- **Total: 215 / 219 heroes byte-identical.**
- **The storyboard logs** differ only by added `!` lines and the reworded reading lines, as in `--grid`. The additions are B's text-floor notes ("text under the web floor for 16:9 …"), reading time, transition types and cause.
- **The composite `storyboard.png`** differs by design, because the notes panel grew.

**Stills I read:**
- `$J/qa2-stage-film-sample/orbit-film-storyboard-16x9.png`: the notes panel carries the new lines, and the 12 heroes are as live.
- manus2-space S06 diff: `$J/qa2-stage-manus2-space/stills/S06-live-stage-diffx16.png` (live crop · stage crop · diff ×16; only the thumbnail's rounded rim) and `S06-live-over-stage.png`.

## 3 · Films, `--film --aspect 16x9 --workers 2`, both tools

**Commands** (`qa2-tools/steps-film.txt` via `run.sh`, 13:28–14:15):
- `LIVE|STAGE --job qa2-{live,stage}-<n> --film --aspect 16x9 --workers 2`
- then `qa2-tools/filmcmp.sh <n> <cut> 16x9`. It runs qacmp, cmpdir on `frames/` and `bgref/`, compares the JSON side files and the mp4 / master, keeps up to 12 differing frame pairs and a contact sheet, then deletes both clones' `frames/ bgref/ textless/ purity/`.
- Results: `qa2-logs/filmcmp-<n>.txt`, `qa2-logs/jsoncmp.txt`.

| Film | Verdict, both tools | PASS / FAIL lines | Stage adds | Frames · bgref | mp4 · master WAV | Time live / stage |
|---|---|---|---|---|---|---|
| steady-sample | QA PASSED (12 checks) | 12 PASS, identical | 7: continuity INFO, text WARN, contrast WARN, deadair INFO ×2, flash INFO, purity INFO (3/24 raster history) | **1200/1200 · 1200/1200** | identical · identical | 152 s / 199 s |
| reel-sample | QA PASSED (13 checks) | 13 PASS, identical | 8: continuity, text WARN (33 px caps), contrast INFO ×2 (incl. "outlined, check by eye"), deadair ×2, flash, purity | **1181/1181 · 1181/1181** | identical · identical | 337 s / 369 s |
| film-sample | QA PASSED (16 checks) | 16 PASS, identical | 7: continuity, text WARN (41 / 45 px), contrast INFO, deadair ×2, flash ("at most 3 flashes"), purity INFO (1/36 raster history) | **2172/2265** (93 differ, max 3, see below) · **2265/2265** | mp4 differs (follows the frames) · WAV identical | 613 s / 732 s |
| qa-probe | **QA FAILED (2)** | 9 PASS + 2 FAIL, identical | 7: continuity, contrast INFO, deadair WARN + INFO ×2, flash, purity | **480/480 · 480/480** | identical · identical | 61 s / 76 s |
| qa-probe2 `--cut seam` | **QA FAILED (1)** | 7 PASS + 1 FAIL, identical | 5 INFO | **240/240 · 240/240** | identical · identical | 36 s / 57 s |
| qa-probe2 `--cut whip` | **QA FAILED (1)** | 9 PASS + 1 FAIL, identical | 6: incl. deadair WARN | **360/360 · 360/360** | identical · identical | 50 s / 72 s |

**Every live WARN / INFO line**, such as the INFO cut lines, is still present in the stage output (qacmp "OK").

**The FAIL lines, identical in both tools:**
- qa-probe: `FAIL freeze frozen (≥ 4 identical frames) at 181–186, 187–200, 201–239` and `FAIL content near-empty frames … 240, 241, … (80)`.
- seam: `FAIL freeze … at 118–121`.
- whip: `FAIL content near-empty frames … 108, 109, … (24)`.

**JSON side files:**
- `shots.json` is identical everywhere.
- `audits.json`: the stage only **adds** keys (boxes `caps/clip/outlined/shadowed/words`; per-frame `frame/ink/textless/real/shadow`), and no existing value changes.
- `render.json` / `mux.json` differ only in the per-shot engine fingerprints. Rule 1 expects this.
- `pages.json` differs only in the Chrome page id.
- `cams.json` is stage-only (D's camera log).

**film-sample's 93 differing frames, quantified:**
- **Frame 1190**, the first frame of `scan` (stack, blur entrance): max 3, 2 channels > 2, all in the bottom 24 rows (y 1056–1080).
  - Diff ×80: `$J/qa2-stage-film-sample/stills/film-sample/frame1190-stage-and-diffx80.png`.
- **92 frames in `wall`** (1743–1933 of 1742–1944): max **1**, 0 channels > 2. Small regions: tile edges and the bottom-right corner.
- **Proof that this is run-to-run noise.** I rendered `--film --aspect 16x9 --range 1133,1950 --workers 1` three times, on fresh clones: live (`qa2-live2-film-sample`), stage with `--no-purity` (`qa2-stage2-film-sample`) and live again (`qa2-live3-film-sample`). Each took ~240 s and ended rc 1, "818/2265 on disk", as a range render does.

| Pair (818 frames) | Differ | Where | Max | Channels > 2 |
|---|---|---|---|---|
| **live2 vs live3 (live vs live)** | **200** | all in `wall` 1745–1944 | **3** | 996 (worst frame 13) |
| live2 vs stage2 | 200 | all in `wall` | 3 | 996 |
| live3 vs stage2 | 196 | all in `wall` | 2 | 0 |

- **The live tool differs from itself** by the same amount the stage differs from it, in the same shot.
- **The full films' kept frames agree:** for frames **1190 and 1743**, the full stage film's frame is byte-identical to **all three** range renders, two of them live. So in those frames the full *live* run was the odd one out.
- **Kept evidence:** `$J/qa2-stage-film-sample/stills/film-sample/{live,stage}-NNNNN.png` (12 pairs) and `…/noise/{live2,live3,stage2}-{01190,01790}.png`.

**Contact sheets I read** (every 30th frame of the stage film, all as live):
- `$J/qa2-stage-steady-sample/stills/steady-sample/contact-every30.png`
- `$J/qa2-stage-reel-sample/stills/reel-sample/contact-every30.png`
- `$J/qa2-stage-film-sample/stills/film-sample/contact-every30.png`

## 4 · Mode A (the 12 s sting)

**Root files** (`cmp`, stage vs `~/.claude/skills/product-launch-sting`):
- **Identical:** `audio.mjs`, `brand.mjs`, `build.mjs`, `master.mjs`, `package.json`, `package-lock.json`, `qa.mjs`, `render.mjs`, `stage.html`, `brands/example-design-autopilot.json` and `brands/reference-frame-by-frame.json`.
- **`node_modules/`:** `diff -rq` is empty.
- **SKILL.md** differs in 28 diff lines, all in the description and the mode-B overview (kit, starters, new QA). The `# Mode A` → `# Mode B` section is **identical**.

**One build, stage copy, per SKILL.md** (`ST = $M/stage/product-launch-sting`):

1. `node $ST/build.mjs --job $J/qa2-modeA --init`: rc 0, "wrote …/brand.json (reference brand …)". The starter is saved as `qa2-logs/modeA-brand-starter.json`.
2. Overwrite the fields with `$ST/brands/example-design-autopilot.json` (same keys).
3. `node $ST/build.mjs --job $J/qa2-modeA --stills`: rc 0, 5 s, one layout line, "S3 prompt: wraps onto 2 lines". That is allowed: SKILL.md says up to ~65 characters wrap onto two lines, and this prompt is 43.
   - I read `$J/qa2-modeA/stills.png`. Name and pill read clearly, the DA monogram is centred in the disc and the icon, the prompt is fully typed inside the glass, and "Visuals" / "Comms" are legible.
4. `node $ST/build.mjs --job $J/qa2-modeA --film --workers 2`: rc 0, 61 s, **QA PASSED (8/8)**:
   - video 720 × 1080², 59.94 fps
   - cuts/png and cuts/mp4 top-6 at 144, 202, 318, 430, 490, 602
   - freeze exactly 539–574
   - loudness −14 LUFS, TP −1.5 dBTP
   - duration 579600 samples
   - sfx and whoosh on time
   - Deliverables: `$J/qa2-modeA/design-autopilot-sting.mp4` and `-master.wav`.
   - Contact sheet read: `$J/qa2-modeA/qa2-stills/contact-every45.png`.
5. **Extra:** the same brand.json built twice with the **live** skill (`qa2-modeA-live`, `qa2-modeA-live2`). Both give QA PASSED (8/8), and the first live run's 8 PASS lines are identical to the stage's. The master WAV is identical in all three. The frames are not identical, even live vs live (F2).

## Findings

| # | Sev | What | Evidence / repro |
|---|---|---|---|
| **F1** | LOW (pre-existing, live) | **manus2-space's custom `editor` block (`blocks/editor.mjs`) is not deterministic.** A rounded image thumbnail's rim rasterises in 2–3 variants, which flip from run to run in the **live** tool. This puts manus2-space `06-S06` outside the stated hero exception: it is not a wall/stack hero, and it is up to 15 code values. | **S06:** 12 live runs give `96f182e4` × 8 and `cba34ce9` × 4. The stage gives `96f182e4` × 2. The live-vs-stage diff equals the live-vs-live diff (max 15, 934 channels, bbox 1710,215–1814,275). **S11:** live `3d4b5f81` × 8, `557032b0` × 3, `89317334` × 1; stage `3d4b5f81`, `557032b0` (max 16–21). **S17:** one live run, max 18. Hashes: `qa2-logs/manus2-S11-extra.txt`. Repro: run `LIVE --job <clone> --storyboard --aspect all` a few times on fresh clones of manus2-space, then `shasum out/main/16x9/board/06-S06.png`. Fix idea (job-side): give the thumbnails integer-pixel boxes or `transform: none` at rest; or accept it as noise. |
| **F2** | INFO (pre-existing) | **Mode A frames aren't byte-reproducible run to run** with identical code. The variance is in the S3 glass / prompt camera move (frames ~200–280) and a few typing frames (430–458). | **live vs live2:** 57/720 differ, max 68. **live vs stage:** 59, max 111. **live2 vs stage:** 54, max 111 (frame 220, 3275 channels). Each pair has frames that only it differs on, so all three runs vary. The root files and `node_modules` are cmp-identical, so it can only be Chrome. QA passes every time, and the master WAV is identical. Logs: `qa2-logs/modeA-*-frames.txt`. |
| **F3** | INFO | **The `--grid` reading lines are reworded, not only added.** The old "≈4 words/s" `!` lines are replaced for the same shots (15 lines across edge-test, hf02-skill, layers-probe and manus2-film). This is SPEC-R1's intended change. | `qa2-logs/grid-compare.txt` (REWORDED- lines) |
| F4 | INFO | **The runner slip:** an ffmpeg in my compare step read the step file on stdin, which truncated one step name. No step or data was lost. | `qa2-logs/summary.txt` line `lm-live-qa-probe`; fixed with `-nostdin` / `< /dev/null` |

## Heat, disk, hygiene

- **Heat.** Every render ran alone, one aspect at a time, at `--workers 2` (`--workers 1` for the range slices). `pmset -g therm` never recorded a warning: the runner logged 0 thermal waits, and a check at the end showed none.
- **Disk.** Free space went from 37 GB at the start to 28–32 GB during the pass, and is **32 GB** at the end.
  - Deleted (my own clones only): every `frames/`, `bgref/`, `textless/` and `purity/` folder after comparison, the range-render frames, the three mode-A `out/frames`, and the storyboard `plates/` caches (8 × 522 MB from manus2-space, 2 × 5 MB from edge-test).
  - Kept: mp4s, qa.json, logs, stills and board PNGs.
- **Untouched:**
  - **Stage:** `stage-sha-start.txt` = `stage-sha-end.txt` (120 files, `cmp` equal), and no stage file is newer than the pass start.
  - **Live skill:** `shasum -c live-before.sha1` gives **867 OK, 0 not OK**, and no file there is newer than the start.
  - **`base/` and `live-before/`:** 0 newer files.
  - **`~/Downloads/launch-videos`:** **0** files newer than this pass's start marker (`$J/qa2-logs/START.marker`).
- **Not done.** No commits or pushes, no paid API calls, no `--go`, nothing run under `qa/video-skill-learnings/skills/`, and no research or private footage copied into the skill or the sample job. manus2-space's footage exists only inside my `$J/qa2-*-manus2-space` clones, made with `cp -c`.

## Ask

1. **Accept F1 as pre-existing live noise**, or have the manus2-space `editor` block fixed job-side. It is the only hero outside the stated exception, and the live tool can't reproduce its own bytes there.
2. If old mode-A stings are ever re-rendered for a byte comparison, **compare QA lines, not frames** (F2).
