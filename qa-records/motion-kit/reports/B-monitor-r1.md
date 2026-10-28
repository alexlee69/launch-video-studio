# Monitor report: Worker B (frame checks), round 1 (2026-10-26)

**Bottom line.** Worker B's build is safe to integrate:

- Its edits stay inside its own files.
- Old jobs still render byte-identical.
- Every existing PASS/FAIL line is unchanged.

It still has **1 HIGH, 3 MEDIUM and 9 LOW** findings.

- **The HIGH one is purity.** It files real impurity under the "Chrome raster history" INFO bucket. I planted a CSS transition, which rule 2 forbids. It was reported as INFO with Δ 206 on up to 4,584 px, and nothing WARNed.
- **The three MEDIUM ones:**
  - Purity's frame sample skips shots' last frames on films with 12 or more shots.
  - A broken textless PNG crashes `--qa` and leaves the old qa.json in place.
  - Dead air WARNs on stock blocks held for an ordinary 3 s.

Source under test: `qa/motion-kit/stageB/product-launch-sting/video` (`$S` below). Baseline: `qa/motion-kit/stage/…`.

All my jobs are `jobs/mon-B-*`. My logs, scripts and stills are in `runs/monB/`.

Commands use:

- `S=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit/stageB/product-launch-sting/video/lv.mjs`
- `L=~/.claude/skills/product-launch-sting/video/lv.mjs`

Run them from `qa/motion-kit/jobs`.

---

## Findings

### 1. HIGH: purity calls a real impurity "Chrome raster history" (INFO), so the check misses the bug class it exists for

- **Where.**
  - `lib/qa.mjs:307` (`PURITY_RASTER = .005`) and `lib/qa.mjs:432-439` (the `raster` / `bigRaster` split).
  - `lib/render.mjs:100-118` (`domSig`): it only hashes DOM attributes, text and canvas pixels.
- **What.** A frame whose pixels go past the spec's tolerance but whose DOM signature matches is treated as follows:
  - It is **INFO** whenever under 0.5 % of the frame (≈10,400 px at 1080p) differs.
  - Above that, it WARNs with the wrong cause: "an image or footage frame that wasn't ready?".
  - The spec says a frame beyond the tolerance is a WARN that names the frames.
- **Why the signature can't catch it.** State that lives outside the attributes is invisible to the signature:
  - CSS transitions and animations, Web Animations;
  - a `<video>`'s `currentTime`;
  - styles on elements outside the visible `.lv-shot`.

  Rule 2 explicitly forbids CSS transitions and animations.
- **Reproduce.**
  - Small chip (80×36 px with `transition: transform 300ms`): `node $S --job mon-B-purity-css2 --film --aspect 16x9 --workers 3` gives
    `INFO purity 7/24 frames (s2) have the same page state in any order but Chrome rasterised them differently … frame 133 (s2) max Δ 203, 4584 px …`. No WARN at all. Log: `runs/monB/film-mon-B-purity-css2.log`.
  - Bigger elements (150×56 chip, 900×420 card): `mon-B-purity-css` gives 6 WARN frames, all labelled "footage frame that wasn't ready?", plus 9 more frames filed as INFO raster. Log: `runs/monB/purity-css.log`.
- **Fix.**
  1. In `domSig`, append `document.getAnimations().map(a => a.animationName || a.transitionProperty || a.constructor.name)` and their `currentTime`. Also add a dedicated WARN: "CSS transition/animation running at frame N (rule 2: derive from t)". That catches the transition case directly.
  2. Downgrade to INFO only what is *proven* to be history. Re-draw the frame on the purity page right after seeking the film's own predecessor (f − 0.5) and compare with the film frame. A byte match means history (INFO); anything else WARNs.
  3. Keep the spec's literal tolerance as the WARN line. The old-job raster cases (Δ up to 238 on UI text) are themselves shimmer viewers can see, so they deserve at least a WARN naming the shot until the engine is fixed.

### 2. MEDIUM: purity's frame sample skips first and last frames on films of 12 or more shots

- **Where.** `lib/qa.mjs:310-332`. The queue per shot is `[inside, first, last]`, taken round-robin until `want = max(24, shots)`.
- **What happens.**
  - 12 shots: pass 0 takes the inside frames, pass 1 the first frames, and the sample is full, so **no last frame** is ever sampled.
  - 24 or more shots: only one inside frame per shot. Neither the first nor the last frame of any shot is sampled.

  The spec asks for "incl. first/last frames of shots". Last frames are where exit whips and zooms run, which is where order-dependent state shows.
- **Reproduce.** `node runs/monB/pf.mjs jobs/B-film-sample jobs/B-reel-sample` (run from `qa/motion-kit`) gives:
  - film-sample: `shots 12 frames 24 first-frames 12 last-frames 0`.
  - manus2-film clone: `shots 27 frames 27 first-frames 0 last-frames 0`.
- **Fix.** Use `want = clamp(3 × shots, 24, 96)`, or rank the queue by kind: every shot's first and last frame before any second inside frame. Only seed the order inside each rank.

### 3. MEDIUM: a WARN-only check can abort QA, and the stale qa.json stays

- **Where.**
  - `lib/qa.mjs:246` (`rgbOf` throws), called from `contrastCheck` at `lib/qa.mjs:264` with no try/catch.
  - The same `rgbOf` is used by `purityCompare`, called from `lv.mjs:229`.
  - The purity render at `lv.mjs:228` has no try/catch either.
- **What happens.**
  - One unreadable textless or ink PNG makes `--qa` exit 1 with a stack trace. Causes include an interrupted render, a full disk (this Mac is at 94–98 %) or hand pruning.
  - The previous `qa.json` is left as it was, so it reports a result that is no longer current.
  - A purity page error, or an unreadable purity PNG, aborts `--film` after a full render.

  Round-1 checks must never FAIL. A crash is worse than a FAIL.
- **Reproduce.** Run in `jobs/`:

  ```
  cp mon-B-contrast/out/main/16x9/textless/00060.png /tmp/k.png
  head -c 5000 /tmp/k.png > mon-B-contrast/out/main/16x9/textless/00060.png
  node $S --job mon-B-contrast --qa --aspect 16x9   # exit 1, "at rgbOf … at contrastCheck … at qaFilm"
  cp /tmp/k.png mon-B-contrast/out/main/16x9/textless/00060.png
  ```

  Log: `runs/monB/qa-contrast-corrupt.log`.
- **Fix.**
  - Wrap each hero's decode in try/catch, giving `contrast INFO not measured for <shot>: <file> unreadable — re-run --film`.
  - Wrap the purity render and compare in try/catch, giving `purity INFO not measured: <error>`. Write no `purity.json`.
  - Write `qa.json` from a `finally` path, or delete it before QA starts, so a crash never leaves an old verdict behind.

### 4. MEDIUM: dead air is not quiet on good input; stock blocks at ordinary lengths WARN

- **Where.** `lib/qa.mjs:158` (`DEADAIR_ACT = 8`) and `lib/qa.mjs:178` (the allowance).
- **What happens.** The slow camera push that rule 11 prescribes for holds scores 6–7 activity, which counts as "still". Ordinary stock shots therefore WARN:
  - In my calibration film (nothing planted), 3 of the 4 three-second holds fire:
    - `headline` 4 words, 3 s: 0.40 s over;
    - `type` 3 s: 0.18 s over;
    - `endcard` 3 s: 0.80 s over.
  - The probes' own *control* shots fire as well:
    - probe-purity s3, probe-flash s3/s4 and probe-contrast s5/s6 (2-word headline, 2 s);
    - mon-B-purity-css2 s3.

  Worker B's "silent on good input" evidence is the five old samples only.
- **Is it a real stall?** Looking at the frames (`runs/monB/calib-h-and-e-strip.png`), the headline does sit almost still from 0.5 s to 2.9 s. You can argue it either way, which makes it the lead's call. But the line will appear on most new films, and people learn to ignore a line that always appears.
- **Reproduce.** `node $S --job mon-B-calib --film --aspect 16x9 --workers 3`. Log: `runs/monB/film-mon-B-calib.log`.
- **Fix (pick per the lead's intent).**
  - Measure the activity of each stock block's push and set `DEADAIR_ACT` just under it. Or compute activity against the bgref (camera-compensated) so a push isn't "still".
  - Add the +0.5 s grace Worker B proposed.
  - Exempt the last shot or `endcard`, or require `hold:` there.
  - Report how many stock-block shots fire before the check is ever promoted.

### 5. LOW: flash counts half a flash too many; an allowed 3 Hz strobe WARNs

- **Where.** `lib/qa.mjs:214-219`. A transition's time `k1` is the frame where the zig-zag's extreme was reached. On plateaus that aren't flat (moving copy in the window), the extreme jumps between the start and the end of a plateau. That lets 7 transitions fit inside 60 frames.
- **Reproduce.** `node $S --job mon-B-flash --film --aspect 16x9 --workers 3`. Shot s2 is a full-frame black/white strobe at exactly 3 Hz (6 transitions a second; WCAG 2.3.1 allows it). It gives `WARN flash … 1.65–4.33 s (3.5 flashes)`. On a slice of s2 only (no cuts), `node ../runs/monB/fl2.mjs mon-B-flash/out/main/16x9` also gives 3.5.
- **Fix.** Time each transition where it crosses its midpoint (or consistently at `k0`). Count the transitions whose midpoints fall in [t, t + 1 s).

### 6. LOW: flash's area rule is about 2.5× stricter than WCAG

- **Where.** `lib/qa.mjs:200-212`: mean luminance over a W/3 × H/3 window.
- **What happens.** A full black/white flash of about 23k px (1.1 % of a 1080p frame) already moves a window's mean by 0.1. WCAG's "25 % of a 10° field" is about 2.8 % of the screen, roughly 57k px at 1080p. In mon-B-flash s6, a 200×200 px square (40k px) at 5 Hz WARNs `(5.5 flashes)`, though it is under the WCAG area.
- **Fix.** Count, per window, the pixels that make the same ≥ 0.1 transition in the same frame. Treat it as a flash only when that area is ≥ 2.8 % of the frame. Pixel-wise, as PEAT does.

### 7. LOW: contrast false positive on haloed or shadowed text

- **Where.**
  - `engine/runtime.js:712`: hiding the text removes `text-shadow`.
  - `lib/qa.mjs` contrastCheck: the background is measured without the halo.
- **What happens.** White text with a dark halo on white is readable (`runs/monB/contrast-halo-covered.png`, left), but it WARNs `halo "White with a halo" 1.0:1 Lc 0`. Built-in reel stickers have a stroke too, so they get INFO. Custom blocks and future caption styles with shadow only will WARN falsely.
- **Reproduce.** `node $S --job mon-B-contrast --film --aspect 16x9 --workers 3`. Log: `runs/monB/film-mon-B-contrast.log`.
- **Fix.** Add a `shadowed` flag to the audit (text-shadow blur ≥ 0.04 em, or several shadows) and report it as INFO "shadowed: check by eye", like `outlined`.

### 8. LOW: contrast reports fully covered text as "1.0:1"

- **Where.** `lib/qa.mjs:283`. When the ink pass finds no glyph and the diff pass finds no difference, the fallback pushes ratio 1 and Lc 0.
- **What happens.** In mon-B-contrast `covered`, the headline sits wholly behind an opaque card at its hero frame. It reports `covered "Hidden behind a card" 1.0:1 Lc 0`, which says "low contrast" when the problem is "not visible at its hero frame".
- **Fix.** When no glyph pixels are found, emit a separate WARN or INFO: "must-read text not visible at its hero frame (covered or off-frame)".

### 9. LOW: the floor note's "delivery: feed raises it" is wrong on 9:16 and 1:1

- **Where.** `lib/qa.mjs:150` (`floorNote`). The hint is added whenever delivery is `web`, but feed's 9:16 and 1:1 floors are the same as web's (40/36).
- **Seen in.** `jobs/probe-floors/out/main/9x16/qa.json`, `jobs/B-reel-sample/out/main/{9x16,1x1}/qa.json`, and the 9:16 storyboard notes (`runs/monB/probe-floors-board-9x16.png`).
- **Fix.** Add the hint only when `FLOORS.feed[key] > FLOORS[delivery][key]`.

### 10. LOW: the reading-time message can contradict itself after rounding

- **Where.** `lib/timeline.mjs:117`.
- **Reproduce.** `node $S --job mon-B-reading --grid` prints `round: 5 words on screen for 2.6 s — viewers need ~2.6 s …`. The real numbers are 2.60 s against a need of 2.65 s.
- **Fix.** Print 2 decimals when the rounded values are equal, or round the need up and the length down.

### 11. LOW: the reading-time rule's volume (spec formula, flagged for the lead)

- **What happens.** The 1.4 s minimum means every 1-second punch shot of one word WARNs. In `mon-B-calib`, f1, f2 and f3 ("Fast." / "Faster." / "Fastest.", 1 s each) all warn. Worker B's own counts:
  - 6 of 12 film-sample shots;
  - 7 of 8 reel shots;
  - 4 of 7 steady shots;
  - 4 of 7 edge-test shots.

  The old rule warned on 1.
- **Fix (lead).** Consider an exemption for 1–2-word beats of 0.5 s or more, or count only `read()` copy as Worker B suggested, before anyone relies on this warning.

### 12. LOW: comments and messages drift from the code

- **Where and what.**
  - `lib/qa.mjs:25-26` header: the dead-air allowance is described as "max(0.6 s, the reading hold)". The code uses *need* (0.4 s + hold, `lib/qa.mjs:178`).
  - `lib/qa.mjs:31-32` header: purity's INFO raster class isn't mentioned.
  - A shot with no copy prints "its copy needs 0.60 s", but that is the floor, not its copy.
- **Fix.** Bring the header in line with the code. Print "(floor 0.6 s, no read copy)" for shots with no copy.

### 13. LOW: outside Worker B's files; for the lead

- **`delivery:` validation.** `delivery: [web]` passes the lead's spec validation (an array). It only works because `floorsFor` coerces the array to the string "web". `delivery: phone`, `5` and `TV` all give the clear error `delivery must be one of web, feed, tv`. Fix: require a string in `lib/spec.mjs`.
- **film-kit-dev storyboard.** `film-kit-dev` fails `--storyboard` in **both** the live and the stageB engines: `layer name "footage" is the engine's own layer in this shot`. This is pre-existing (`runs/monB/board-film-kit-dev-{L,S}.log`) and not Worker B's.

---

## SPEC-R1, Worker B items: met or not

| Item | Verdict | Evidence |
|---|---|---|
| **File ownership** | Met | `diff -rq -x node_modules stage stageB` lists only `engine/runtime.js`, `lib/{board,qa,render,timeline}.mjs` and `lv.mjs`; no new files. `stage/` still matches `stage-r1-base.sha1`. The live skill still matches `live-before.sha1`. |
| **runtime.js scope** | Met | `hideText` and the audit fields only. `caps` was added for the floors, a small stretch of "audit data for the contrast check". |
| **New lines are WARN/INFO only; existing PASS/FAIL unchanged** | Met for lines; not met for robustness (#3) | On qa-probe2 `--cut seam` and `--cut whip`, live vs stageB, the existing lines are identical; only new INFO/WARN lines are added (`runs/monB/probe2-*.log`). The `QA PASSED (N)` counts are unchanged. |
| **Dead air** | Built as specified (two documented deviations: allowance = need, runs split at holds); fires on the planted stall; **not quiet on stock blocks (#4)** | probe-deadair `s2 … 2.18 s over`; mon-B-calib |
| **Floors by delivery** | Met (wording #9) | Floors check out: web 47/35 and 40/36, feed 64/48, tv 27/21; `<18` FAIL and `<26` WARN untouched (diff). probe-floors and probe-floors-feed in both aspects. |
| **Contrast** | Met, and improved (the coverage method is a real fix) | Fires: grad 1.4:1, faded 2.0:1, probe s2/s3/s6. Quiet: control, emoji. Textless frames saved and byte-identity holds. False positives #7 and #8. Textless visuals check out (`runs/monB/reel-9x16-225-textless.png`: glyphs gone, chips and plates kept; text inside a jpg screenshot correctly stays). |
| **Flash** | Mostly met | Fires at 4 Hz (4.5) and on probe-flash (5.5). Quiet with flash transitions at 1/s (calib: 1.5). Wrong at exactly 3 Hz (#5) and on small areas (#6). |
| **Reading time** | Met (rounding #10) | `mon-B-reading --grid`: Japanese 16 chars → 3.3 s; Korean counts Hangul at 9/s; mixed "2 words + 3 characters"; emoji-only and numbers OK; ×1.3 applies with the default bgDim .15 and not with sticker .25 or an image bg. |
| **Purity** | **Not met**: verdict split (#1), frame spread (#2) | purity.json written; `--qa` re-run gives an identical qa.json (checked on mon-B-calib); the counter probe WARNs; the CSS transition is missed. |
| **Storyboard notes** | Met | `! text under the web floor …` in the console and on the cards (`runs/monB/probe-floors-board-9x16.png`) |
| **Byte-identical, switch invisible when off** | Met; independently re-verified (next section) | |
| **Numbers in qa.json** | Met | each new result has `data` |
| **Report** | Met | changes, commands, numbers, stills, open issues, GUIDE text |

## What I verified independently (no findings)

- **Storyboard heroes, live vs stageB, on 7 old jobs Worker B didn't cover.** All hero PNGs are identical on:
  - hf02-skill ×3 aspects;
  - reel-dev ×3;
  - cue ×2;
  - qa-probe2, layers-probe, cue-overlays.

  The board composite `storyboard.png` differs, as expected: it has the new notes, and it isn't stable even live vs live.
- **The one exception: manus2-film `04-S04.png`.** 30 px differ (max Δ 5) in the attachment thumbnail. I traced it to pre-existing nondeterminism, not Worker B's code:
  - Two stageB runs gave hash `bfb1…` and a third gave the live hash `6f46…`.
  - Live ×2, the baseline stage, and copies with only runtime.js, only timeline.mjs, both, only render.mjs, and all six B files all gave `6f46…`.
  - Stills: `runs/monB/manus2-S04-*.png`.
- **`--film --range` slices, live vs stageB, frames and bgref byte-identical.** Both slices include a hero frame whose textless and ink captures ran:
  - hf02-skill 9x16 260–330 (hero 297): 71/71;
  - reel-dev 1x1 400–470 (hero 413): 71/71.
- **Full films of the failure fixture qa-probe2, live vs stageB.**
  - `seam`: 240/240 frames and 240/240 bgref identical.
  - `whip`: 360/360 and 360/360.
  - The FAIL lines are identical.
- **`--layers q --aspect 16x9` on dark-ui-check.** The layer QA lines are identical, live vs stageB, all PASS.
- **`--clips r --alpha`.** PASS.
- **Performance** (load average ~30, `runs/monB/perf.mjs` on the 1,080-frame calibration film):
  - shared thumbnails 4.0 s (the content check already paid this);
  - dead air 61 ms;
  - flash 153 ms;
  - contrast 2.9 s for 8 heroes;
  - the purity render about 30 s per aspect;
  - textless capture: 4 screenshots per hero.

  Disk: about 24 purity PNGs plus 4 textless PNGs per hero, per aspect. Worth knowing on this 94–98 % full disk.

## Housekeeping

- **Disk.** I deleted my CoW old-job clones (`mon-B-old-*`) and pruned the non-hero frames and bgref of my rendered probes. Kept: `mon-B-{calib,contrast,flash,purity-css,purity-css2}` with their hero, textless and purity frames, `qa.json` and `purity.json`; `mon-B-reading` and `mon-B-bad` are `--grid` only. A `--qa` re-run there needs `--film` first.
- **Edits.** No edits to Worker B's files, `stage/`, `live-before/`, the live skill or the original jobs. The live engine only ran on clones.
