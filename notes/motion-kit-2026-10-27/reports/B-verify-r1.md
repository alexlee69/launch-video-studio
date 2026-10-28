# Verify report: Worker B (frame checks), round 1 (2026-10-27)

**Bottom line.** Worker B's fix pass holds up, and nothing in it broke old jobs.

- **Verdicts on my 13 findings:**
  - **11 FIXED:** #1–#10 and #12.
  - **2 NOT FIXED, both correctly handed to the lead:** #11 (the spec's own reading formula) and #13 (`lib/spec.mjs` and Worker A's storyboard).
  - **2 sub-point disputes, worker right in both:** #1 point 3 (raster history stays INFO) and #4 (a slow push still counts as still).
- **Byte-identity, live engine vs staging, on clones:** every compared frame matches. That is 4,012 film frames and their 4,012 background refs, across all three aspects (16:9, 9:16 and 1:1). It also covers 142 of 145 storyboard heroes. The other 3 are film-sample `10-wall` in each aspect, and they also differ between two live runs.
- **Existing QA lines:** every PASS and FAIL line is unchanged on 5 full-film renders (one per job and aspect). The `qa-probe` fixture still `QA FAILED (2)` with the same freeze and content lines.
- **New and still open (MEDIUM): the flash check counts motion as flashing.** Two effects:
  - The old job `hf02-skill` now WARNs at 1:1: `4.80–6.48 s (4 flashes)`. Its frames show a list whipping upward, not a strobe.
  - film-sample `scan` reports "5 flashes a second". Counted by eye, its front card swaps between light and dark about 1.7 times a second.
- **I fixed 2 small things in Worker B's files** (details further down):
  - purity's replays ignored `--workers` and opened up to 3 Chromes at once;
  - an unreadable `purity.json` was reported as missing.
- **The first attempt's fix, verified.** The first attempt of this pass fixed `animSig` so it ignores animations in hidden shots. I checked it works: a Web Animation is now blamed on its own shot only.
- **Unflattering numbers:**
  - **Reading-time volume.** The new rule warns on **34 of 63 shots** across the 9 old jobs' storyboards. The live engine warns on 5.
  - **Render time.** Purity adds 15–30 s per aspect on clean jobs. The hf02 three-aspect film took 221 s in staging against 170 s live (+30 %).

Machine: no thermal or performance warning was recorded at any check. Every render ran alone, at `--workers 2` or fewer. At least 49 GB stayed free.

Commands run from `qa/motion-kit/jobs` with:

- `S=…/stageB/product-launch-sting/video/lv.mjs`
- `L=~/.claude/skills/product-launch-sting/video/lv.mjs`

Logs, scripts and stills are in `qa/motion-kit/runs/verB3/`.

---

## Per finding

| # | Sev | Verdict | Reproduced again (command → result) |
|---|---|---|---|
| 1 | HIGH | **FIXED** | `node $S --job ver-B-purity-css2 --film --aspect 16x9 --workers 2` (my 80×36 chip with a 300 ms transition) gives two WARNs: `CSS transitions / animations run … s2 transform@chip (238 frames, 121–359)` and `s2: 6/24 frames differ from the film even when drawn again the way the film drew them …`. Probe `ver-B-anim2` (a CSS `@keyframes` chip, an `el.animate()` chip and a pure chip): WARN `s2 verBspin@chip (180 frames, 120–299); s3 Animation@chip (180 frames, 300–479)`, plus 7/24 not reproduced; the pure chip in s4 isn't named. Order-dependent state (`ver-B-purity-state`, the counter block) WARNs: `s2: the page's state at 8 frame(s) depends on the order …`. Clean probes give INFO "match the film". |
| 1, point 3 | — | **DISPUTED-WORKER-RIGHT** | dark-ui-check full film in staging: `INFO purity 10/24 frames (r, p) differ only when drawn out of order`. `purity.json` shows all 10 drawn again in order from their shot's first frame at **max Δ 0, 0 px**. A film page always draws a shot in order, so viewers never see the out-of-order raster. The one place the film itself is affected is a seam inside a shot, and that is now a WARN. I reproduced the seam WARN by re-rendering frames 0–449 at `--workers 2` (seam at 225, inside p): `WARN purity a worker seam lands inside a shot … frame 225 (p) max Δ 225, 3065 px … --film --range 0,239 --workers 1 (p)`. Running that remedy cleared it: purity went back to INFO. |
| 2 | MED | **FIXED** | `node runs/verB3/pf.mjs` on clones. film-sample: 12 shots → 36 frames, first 12 / last 12 / inside 12. manus2-film: 27 shots → 81 frames, 27 / 27 / 27, both holds sampled. reel, steady, edge-test, dark-ui: every shot's first and last frame sampled. The pick is deterministic, and `range` keeps every frame inside the range. |
| 3 | MED | **FIXED** | `runs/verB3/robust.sh ver-B-deadair` (a job with audio and a cue): <ul><li>truncated textless PNG → exit 0, `INFO contrast not measured for s1 (could not decode 00068.png: … chunk too big)`;</li><li>truncated ink PNG → same, for `-ink1.png`;</li><li>no `purity.json` → INFO;</li><li>no `textless/` folder → INFO;</li><li>5 purity frames with errors → `INFO purity not measured for 5 frame(s)`;</li><li>malformed `qa-lanes.json`, which crashes the **old** sfx check → exit 1 and **`qa.json` removed**, so no stale verdict is left;</li><li>restored → output identical to the baseline.</li></ul> `runs/verB3/stub.mjs`: `purityRun` with a render that throws, one that writes nothing and one that writes garbage never throws; each saves `{error}` or per-frame errors. Re-running `--qa` on an untouched film gives a byte-identical `qa.json` (reel 9:16). |
| 4 | MED | **FIXED** | `ver-B-calib` (my calibration film, nothing planted) now has no dead-air WARN, only `INFO near dead air … h 0.40 s over; t 0.18 s over; e (an end lockup may hold 2.00 s) 0.40 s over`. The planted stall still WARNs: `ver-B-deadair` `s2 at 2.20 s for 3.78 s (… 2.18 s over)`. |
| 4, threshold | — | **DISPUTED-WORKER-RIGHT** | The worker kept a slow push counting as "still" and added a 0.5 s INFO band instead. This makes stock blocks quiet and leaves real stalls loud. On old jobs, only dark-ui-check `r` (a 1.87 s still panel tail) and the qa-probe fixture WARN. |
| 5 | LOW | **FIXED** | `ver-B-flash`: the only WARN is `6.00–8.88 s (4 flashes)`, which is the 4 Hz shot. The full-frame 3 Hz shot (1.5–4.5 s) is quiet. In a new probe, `ver-B-flasharea`, a 3.5 Hz full-frame strobe WARNs: `10.50–13.50 s (3.5 flashes)`. |
| 6 | LOW | **FIXED** (but see N1) | **The area rule works both ways.** A 300 px square at 5 Hz WARNs (`1.50–4.40 s (5 flashes)`); a 200 px square at 5 Hz stays quiet (worst 0). **My planted 220 px "quiet" square WARNed from 8.20 s.** That is the check being right at its resolution. By the shot's end the camera push has grown it to **226 px on screen**, measured on frame 497. At 1/10 scale its partly covered edge thumbnail pixels count whole, so it covers 24 × 24 = **576 thumbnail px, exactly 25.0 %** of a window. The area rule therefore fires from about 22 % of a field on squares this size. That errs on the safe side. |
| 7 | LOW | **FIXED** | `ver-B-contrast`: `INFO contrast shadowed text, check by eye … halo "White with a halo" 1.0:1 Lc 0 (19.6:1 Lc 108 against its shadow)`. Still `runs/verB3/stills/contrast-halo-grad-covered.png`, left to right: real, textless, shadow kept, ink. The halo shows alone in the shadow capture. |
| 8 | LOW | **FIXED** | Same run: `WARN contrast must-read text not painted at its hero frame …: covered "Hidden behind a card"`. Gradient text is now measured by coverage: `grad 1.4:1 Lc 20` WARN, `faded 2.0:1 Lc 39` WARN. The control and emoji lines stay clean. |
| 9 | LOW | **FIXED** | `node $S --job ver-B-floors --storyboard --aspect all`: 9:16 gives `under the web floor for 9:16 (40 px, 36 px in capitals): s2 "LIVE NOW" 31px caps` with no feed hint; 16:9 keeps `; delivery: feed raises it`. The feed variant gives `under the feed floor for 16:9 (64 px, 48 px …)`. The card note shows on the board (`jobs/ver-B-floors/probe-floors-storyboard-9x16.png`). |
| 10 | LOW | **FIXED** | `node $S --job ver-B-reading --grid` gives `round: 5 words on screen for 2.60 s — viewers need ~2.65 s`. The Japanese, Korean and mixed lines and ×1.3 are as before. |
| 11 | LOW | **NOT FIXED** (lead's call; correctly deferred) | `ver-B-calib --grid`: `f1/f2/f3: 1 word on screen for 1.0 s — viewers need ~1.4 s`. Volume on the old jobs' storyboards, staging vs live: film-sample 6/12 vs 0, reel-sample 7/8 vs 0, steady 4/7 vs 0, edge-test 3/7 vs 1, hf02 4/5 vs 4, reel-dev 7/8 vs 0, cue 3/9 vs 0. That is **34 of 63 shots vs 5**. |
| 12 | LOW | **FIXED** | The `lib/qa.mjs` header matches the code. It covers: allowance = need, grace, lockup, the flash area rule and midpoint timing, the purity classes, and "not measured". `(no read copy: floor 0.60 s)` appears in the qa-probe and dark-ui-check WARN lines. |
| 13 | LOW | **NOT FIXED** (outside Worker B's files; harmless) | **`delivery`.** `spec.mjs` turns `delivery: [web]` into the string `"web"`, so it works. `[phone]`, `phone` and `TV` all give `delivery must be one of web, feed, tv`. **film-kit-dev storyboard.** It still fails in staging with `layer name "footage" is the engine's own layer in this shot`. The cause is pre-existing and belongs to Worker A. |

**Totals: 11 FIXED, 2 NOT FIXED** (both the lead's), **0 DISPUTED-WORKER-WRONG, 2 DISPUTED-WORKER-RIGHT** (sub-points of #1 and #4).

## New findings

### N1. MEDIUM, open: the flash check counts motion as flashing

**Where.** `lib/qa.mjs` `flashCheck`. Candidate legs come from the window mean with a hysteresis of only 0.025. A leg then counts when ≥ 25 % of the window's pixels change by ≥ 0.1 *its* way, however many change the other way at the same moment. A moving high-contrast object meets that bar in both directions: its leading edge darkens pixels while its trailing edge brightens others.

**Origin.** This came in with the fix for #6. Before it, transitions needed a ≥ 0.1 change in the window mean. My #6 fix proposal didn't foresee the motion case.

**Evidence.** Both cases were reproduced in this pass, with live and staging frames byte-identical.

- **hf02-skill 1:1, full film.**
  - **What QA says.** It prints `WARN flash … 4.80–6.48 s (4 flashes)`; the same job is quiet at 16:9 (2) and 9:16 (2.5).
  - **What the frames show.** The top-left window shows a fast upward scroll of an avatar list (`runs/verB3/stills/hf02-1x1-282-396-every6.png` and `hf02-1x1-330-345-topleft.png`).
  - **The counted legs.** `node runs/verB3/fl.mjs …` lists them: `DOWN 334→337 mean 0.738→0.712 share 29.7 % (opposite 19.4 %)`, `UP 337→339 … 30.0 % (opposite 21.2 %)`, … The mean moves 0.03, and a fifth of the window moves the other way.
- **film-sample `scan`, `--range 1180,1370`, all three aspects.**
  - **What QA says.** It prints `WARN 19.84–21.07 s (5 flashes)`.
  - **What the eye sees.** The front card swaps between light and dark about every 18 frames, roughly 1.7 flashes a second, under WCAG's 3 (`stills/film-sample-16x9-scan-1186-1302-every4.png`).
  - **Motion legs.** The stack flying in contributes legs such as `1196→1200` and `1200→1202`, with 21–29 % of pixels moving the other way.
  - **Exit sweeps.** Each swap has a 2-frame dark dip: the outgoing card slides across the light background as it fades (`stills/film-sample-16x9-scan-1226-1233-dip.png`).
  - **What this changes.** Worker B's "real: dark and white cards alternate ~4.5 times a second" is overstated. The scan is borderline at most.

**Measured options** (`runs/verB3/flashproto.mjs`: real frames plus synthetic strobes; all variants agree on the strobes):

| case | staging (now) | **net**: leg share = its way − other way | **pair**: same pixels reverse in the next leg |
|---|---|---|---|
| strobes 3 / 3.5 / 4 / 10 Hz full frame, 300 / 220 / 200 px at 5 Hz (synthetic) | quiet / WARN / WARN / WARN, WARN / quiet / quiet | identical | identical |
| hf02-skill 16:9 / 9:16 / 1:1 | 2 / 2.5 / **WARN 4** | 1 / 1 / **1** | 1.5 / 2 / WARN 3.5 |
| film-sample scan 16:9 / 9:16 / 1:1 | WARN 5 / WARN 5 / WARN 5 | 3 / 2 / WARN 4 | WARN 5 / 5 / 5 |
| qa-probe 16:9 | 0.5 | 0.5 | 0 |

**Why I didn't fix it.**

- **For "net".** It is a one-line change that removes the hf02 false positive.
- **Against "net".** It could under-count a real strobe that coincides with motion in the same window, and missing a seizure risk is worse than a false WARN. It also changes the worker's calibrated verdicts on film-sample.
- **"pair" doesn't help.**

That makes it a design call for Worker B and the lead, not an obvious fix. One more option is to require the leg's *net* share ≥ 25 % only when its gross share is under some higher bar (for example 50 %).

### N2. LOW, fixed by me: purity's replays ignored `--workers`

**Where.** `lib/qa.mjs` `purityRun` drew its replay groups 3 at a time, each `render()` in its own Chrome, whatever `--workers` said. A `--workers 1` or `2` run, meant to keep a hot laptop cool, still opened 3 browsers.

**Fix.** `purityRun` takes `workers` (`lv.mjs` passes the film's `--workers`) and runs `min(3, workers)` groups at a time.

**Proof.**

- `node runs/verB3/par.mjs` uses a stub render that counts renders in flight. With workers 1 / 2 / 3 / default, the peak in flight is **1 / 2 / 3 / 3**, with the same seam results each time.
- Every staging film after the edit ran it: qa-probe, hf02 ×3, reel 9:16, purity-state, dark-ui-check and the ranges. All purity results came out as before.

### N3. LOW, fixed by me: a malformed `purity.json` was reported as missing

**What it said.** `INFO purity not measured (purity.json is written by --film)` — a wrong cause.

**Fix.** It now says `not measured (purity.json is unreadable — re-run --film)` (`runs/verB3/robust/qa-T5b-malformed-after-edit.log`). The INFO level is unchanged.

### N4. Verified: the fix from the first attempt of this pass (`lib/render.mjs` `animSig`)

**The problem.** An `el.animate()` Web Animation keeps "running" while its shot is `display: none`. It would have been blamed on every frame of the film.

**The fix.** Animations whose target sits in a hidden `.lv-shot` (inline `display: none`, the same test `domSig` uses) are skipped. The patch is in `runs/verB3/verify-edit-render-attempt1.patch`.

**Proof.** `ver-B-anim2` names `s3 Animation@chip (180 frames, 300–479)`, its own shot only. Film frames stay byte-identical: every staging film in this pass ran with it.

### Notes (no action)

- **purityFrames.** With more than 40 shots, the 120-frame cap drops some shots' last frames. The ranks are inside, then first, then last. No current job comes close.
- **Mid-shot `--range`.** A `--range` that starts inside a shot correctly makes that shot "partial", so QA can't run on it. `purity.json` still records the seam (dark-ui-check `--range 210,260`: seams at 210 and 236 differ, Δ 225).

## Done criteria for Worker B (SPEC-R1), re-run

| Criterion | Result | Evidence |
|---|---|---|
| **Every new check WARNs on a planted job** | Met | deadair `ver-B-deadair`; floors `ver-B-floors` / `-feed` (board) and calib (film); contrast `ver-B-contrast`; flash `ver-B-flash`, `ver-B-flasharea`; reading `ver-B-reading`; purity `ver-B-purity-css2`, `ver-B-anim2`, `ver-B-purity-state`, seam (dark-ui-check range) |
| **…and stays silent or INFO on good input** | Met, except **N1** | calib: dead air INFO only. contrast control and emoji clean. 3 Hz and 200 px flashes quiet. Purity INFO "match" on 4 clean probes (calib, flash, flasharea, contrast), hf02 ×3 and qa-probe. Flash false WARN on hf02 1:1. |
| **Old jobs: existing PASS/FAIL lines unchanged, only new WARN/INFO lines** | Met | `cmpqa.mjs` on qa-probe 16:9, hf02 16:9 / 9:16 / 1:1 and reel-sample 9:16: existing lines **identical**, same PASS counts (9 / 11 / 11 / 11 / 13). The qa-probe fixture still `QA FAILED (2)` with the same freeze and content lines. The new lines are INFO/WARN only. |
| **Byte-identical, full films** | Met | 539/539 ×3 aspects (hf02), 480/480 (qa-probe), 1181/1181 (reel 9:16); bgref identical too |
| **Byte-identical, `--film --range` slices** | Met | film-sample 1180–1370 at 16:9, 9:16 and 1:1: 191/191 each, bgref too. steady 9:16 480–640: 161/161. Both ranges include a hero frame, so the textless, ink and purity passes ran. |
| **Byte-identical, storyboard heroes** | Met | 142/145 identical across 9 old jobs and 19 job-aspects. The 3 misses are film-sample `10-wall`. A second live run gives a third hash (`adfbb690` / `daf7df80` / `fd6ec7e1`), so the misses are pre-existing. |
| **Storyboard notes** | Met | The only console differences, live vs staging, are the new reading wording and the floor lines (`board-*-{L,S}.log`) |
| **Numbers in qa.json; `--qa` re-runs work** | Met | `--qa` on reel 9:16 reproduces the film's `qa.json` byte for byte |
| **Robustness** | Met | #3 above |
| **Layers / clips untouched** | Met | `--layers q` on dark-ui-check: identical PASS lines live vs staging (7 PASS). `--clips r --alpha`: PASS in both. |
| **File ownership** | Met | `diff -rq -x node_modules stage stageB` lists only Worker B's 6 files. `stage/`: 0 of 871 not OK. Live skill: 0 of 867 not OK. Final hashes are in `runs/verB3/stageB-final-6files.sha1`. |

## What I changed in the staging copy

All changes are inside Worker B's files. The patch is `runs/verB3/verify-edit.patch` and the backup is `runs/verB3/before-edit/`.

- **`lib/qa.mjs`:**
  - `purityRun({ …, workers = 3 })`: replay concurrency `min(3, workers)` (N2);
  - the unreadable-`purity.json` wording (N3).
- **`lv.mjs`:** passes `workers` to `purityRun`.
- **Earlier, in the first attempt of this pass:** `lib/render.mjs` `animSig` (N4).

My edit landed after the first four probe films (css2, anim2, deadair, calib). Every run after that used the final code: the remaining probes, all old-job comparisons, purity-state and dark-ui-check.

## Housekeeping

- **Jobs.** All are `jobs/ver-B-*`:
  - probes: `ver-B-{purity-css2,anim2,purity-state,deadair,calib,flash,flasharea,contrast,floors,floors-feed,reading,deliv}`;
  - old-job clones: `ver-B-old-*-{L,S}`, plus `ver-B-old-film-sample-L2` and `ver-B-pf-*`.
- **Leftovers from the first attempt.** I replaced the `ver-B-*` probe jobs. For both the `ver-B-*` and `ver-B2-*` leftovers, I deleted their frames, bgref, textless, purity and layers.
- **What I kept.** mp4s, `qa.json`, `purity.json`, `audits.json`, boards and logs.
- **Disk.** 51 GB free at the end.
- **Untouched.** The live skill, `live-before/`, `base/`, `stage/` and the original jobs. The live engine ran only on clones. No commits, no paid calls, no `--go`.

## For the lead

1. **Flash rule (N1).** Choose between the current rule, the "net" share and a hybrid before anyone relies on the flash WARN. Right now it WARNs on a list scroll in hf02-skill 1:1. The film-sample `scan` verdict hinges on the same choice.
2. **Reading-time volume (#11).** The new rule warns on 34 of 63 old-job shots (live: 5). Decide on a punch-beat exemption, or trimming blocks' `read()` lists, before the warning is promoted or documented as "fix every one".
3. **Seams (Worker B's open item 1).** The seam WARN is real and its `--range … --workers 1` remedy works (reproduced above). Snapping page boundaries to cuts would remove it at the source, but it changes old jobs' seam frames, so it needs your sign-off.
