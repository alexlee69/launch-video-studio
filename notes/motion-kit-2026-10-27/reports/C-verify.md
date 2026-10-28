# Verify pass: Worker C, round 2 engine transitions, after the fix pass (2026-10-27, 01:00–02:15)

This pass re-checks every finding in `reports/C-monitor.md` against Worker C's "Fix pass" section of `reports/C-build-r2.md`. I reproduced each finding again on fresh clones and read the frames around every cut in all three aspects. I re-ran every done criterion myself.

- **Engine under test:** `qa/motion-kit/stageC/product-launch-sting` (`runtime.js` sha1 `03f7bcd4…`). It did not change while this pass ran. Every hashed file is the same one the first, network-killed attempt saw (`jobs/ver-C-logs/stageC-start.sha1`).
- **Live skill:** `~/.claude/skills/product-launch-sting` matches `live-before.sha1` (0 mismatches). It was only run on clones.
- **What I touched:**
  - I edited none of Worker C's files.
  - I made no commits and no paid calls, and ran nothing under `qa/video-skill-learnings/skills/`.
  - I ran `lv.mjs --job` only on clones under `jobs/ver-C-v3-*`.
- **Heat and disk:**
  - One render at a time, `--workers 2`, with `pmset -g therm` checked before every render. No thermal or performance warning was ever recorded.
  - Disk free was 50.6 GB at the end. I deleted the frames, bgref and layers of my own jobs after measuring them.
- **First attempt's leftovers (`jobs/ver-C-*`):** I reused its read-only tools (`jobs/ver-C-tools/`). I read its r2-whip frames for the whip contact sheets, which is valid because my fresh whip films are byte-identical to it in all 3 aspects. I deleted nothing of it.

## Verdict

**The fix pass is real.** All 3 HIGH findings are fixed. The dev films pass QA in every aspect. The old jobs are byte-identical with the live engine, apart from the known wall noise. Carry shots pass `--clips` and `--layers`.

| Verdict | Count | Findings |
|---|---|---|
| FIXED | 16 | 1, 2, 3, 4, 5, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19 |
| NOT FIXED | 1 | 6 (partly: the footage dive is fixed; the point dive into `plan` is unchanged) |
| DISPUTED-WORKER-RIGHT | 2 | 10 (the morph timing is the lead's call), 15 (the cause warning stays, as SPEC-R2 §6 asks) |
| DISPUTED-WORKER-WRONG | 0 | — |

**New in this pass:**
- **2 MEDIUM:**
  - V1: the wall `from:` lead card can be another picture and another shape.
  - V2: the rest of finding 6.
- **3 LOW:** V3–V5.
- **3 INFO:** V6–V8.

**I fixed nothing myself.** Nothing still open is both small and obvious inside Worker C's files:
- V1 and V2 are design work.
- V3 and V5 change the dev film's pixels and would need a full re-verify.

**Done criteria (SPEC-R2 "Done means", Worker C):**

| Criterion | Result |
|---|---|
| r2-dev `--film`, 16x9 / 9x16 / 1x1 | **QA PASSED (16 checks)** ×3. Content min 190 / 190 / 176. |
| r2-whip `--film`, 3 aspects | **QA PASSED (12 checks)** ×3 |
| Frames inspected around every cut, every aspect | Done. The judgement on each cut is in the per-finding sections below. |
| Purity | **Met for Worker C's devices.** Every frame of both dev films was re-rendered in seeded shuffled order (seeds 29 and 31) on one fresh page and compared with my own contiguous film. The only frames outside Worker B's tolerance are `ui.js`'s pre-existing panel effects, plus 3 one-off tile glitches that do not reproduce (V6, V7). |
| Old jobs byte-identical with live | **Met.** 72 / 74 storyboard heroes are byte-identical; the 2 that differ are `10-wall.png`, max \|Δ\| 2–3, the known wall noise. The film-sample `--range 100,219` is 120/120 frames and 120/120 bgref byte-identical. 15 / 15 timelines are identical; shots-demo errors in both engines. |
| `--clips` / `--layers` of a carry shot (clean = no carry) | **Met.** Every run passes (list below). |

## Per finding

### 1 · HIGH · the flood's redaction bars → **FIXED**
- **Read:** 30-fps frames −15…−½ and −4…+6 around the cut at 145, all 3 aspects (`ver-C-v3-strips/dev/flood-early-{16x9,9x16,1x1}.jpg`, `cut0-ask-scan-*.jpg`).
- **What I saw:**
  - No rectangle anywhere.
  - "What shi…", "Cut three Friday te…" and the "Agent" chip are eaten exactly by the soft circular front.
  - The flood starts as a dark drop on the Send button (`spot`) and pours outward.
- **Residual (V3, LOW):** the prompt's purple caret is not a `.lv-txt` element, so `floodMask` skips it. It stays visible for 2–3 frames inside the half-covered front after "teasers" has gone. Example: 1x1 / 16x9 frames 133–137.

### 2 · HIGH · a carry between two different-looking elements lands as a double → **FIXED**
- **Read:**
  - r2-whip (prompt-box → panel under `whip-left`), 3 aspects: `whip/carry-whip-*.jpg`.
  - The monitor's own probe, cloned to `ver-C-v3-mwhip` and rendered fresh: `mwhip/mwhip-carry-16x9.jpg`.
  - Full-size close-up of frames 143–149: `whip/whip-cut-closeup-16x9.png`.
- **What I saw:**
  - One outline whose width and height go from the prompt box to the panel.
  - No second card at landing.
- **Landing (frame 173), mean change per 60-fps step:**

  | Aspect | 171→172 | 172→173 | 173→174 |
  |---|---|---|---|
  | 16x9 | 0.44 | 0.30 | 0.18 |
  | 9x16 | 0.46 | 0.33 | 0.16 |
  | 1x1 | 0.83 | 0.57 | 0.29 |

  No spike in any aspect.
- **Taste note:** the two contents double-expose under the blur for about four 60-fps frames on the cut (144–147). "Plan the Friday launch" ghosts over "Plan ready". It reads as a quick dissolve inside one box, not a double card. A swap with A out by cut + ½ would be crisper. GUIDE already says `mode: morph` reads better between two boxes.

### 3 · HIGH · purity of the shot that receives a carry → **FIXED**

**Full-film shuffled purity:**
- Every 60-fps frame was re-rendered in shuffled order on one fresh page and compared with my own fresh film.
- "Tol" is Worker B's tolerance: max \|Δ\| ≤ 2, or ≤ 0.01 % of channels above 2.

| Film | Identical | Within tol | Outside | Which outside |
|---|---|---|---|---|
| r2-dev 16x9 (seed 29) | 911 | 351 | 15 | `plan` 956 + 989–998 (`ui.js`); 365, 841, 875, 838 (V6, one-off) |
| r2-dev 9x16 | 931 | 335 | 11 | `plan` 956 + 989–998 only |
| r2-dev 1x1 | 923 | 343 | 11 | `plan` 956 + 989–998 only |
| r2-whip 16x9 / 9x16 / 1x1 (seed 31) | 528 / 531 / 524 | 14 / 11 / 18 | 10 / 10 / 10 | `plan` 205–214 only (the panel's Schedule press, `ui.js`) |

**The `again` shot:**
- Frames 668–697: 30 identical. Frames 698–783: 86 within tolerance, in every aspect.
- The worst frame has a few dozen pixels off, at most 0.004 % of channels. Before the fix it was 86–92 k channels per frame, max 255.
- **Control:** frame 740 drawn alone vs the film is max \|Δ\| 2, with 0 channels above 2. The same frame in a copy without the needle carry (`ver-C-v3-nocarry`), drawn alone vs contiguous, is max 1. So what is left is ordinary raster noise, the same with or without the carry.

**The monitor's bisection case is gone.**

### 4 · MED · a typo in float's `from:` → **FIXED**
`--grid` on the monitor's and C's probes (`ver-C-v3-logs/grid-probes.log`):

| Probe | Result |
|---|---|
| `float-typo-first` | ✗ `s1: float from "rigth" must be left \| right …, or a layer of the previous shot — this is the first shot` |
| `float-typo` | ✗ the same message, naming the previous shot's layers: `(s1, headline: kicker · headline · sub)` |
| `float-caps` | ✗ `… (got "Left")` |
| `float-ok-layer` (`from: headline`, `from: right`) | Clean |
| `float-point-first` | Warning only, which is correct |

### 5 · MED · the flood's motion dies before the cut → **FIXED**
Mean change per 60-fps frame on my fresh films:

| Aspect | 140 | 141 | 142 | 143 | 144 | cut (145) |
|---|---|---|---|---|---|---|
| 16x9 | 13.4 | 13.6 | 12.6 | 8.5 | 3.8 | 15.8 |
| 9x16 | 19.6 | 14.5 | 9.8 | 5.3 | 2.1 | 13.4 |
| 1x1 | 20.1 | 15.8 | 11.3 | 6.3 | 2.3 | 21.8 |

- Before the fix: 0.05 at 142 and **0.0** at 143→144, in identical frames.
- In every aspect the top-left corner is still lightly uncovered on cut−1 (strips). The cut no longer lands on a dead frame.
- The visible change still tapers over the last 3 frames because less picture is left to cover. That is inherent to a cover, not a stall.

### 6 · MED · the dive's arrival loses the forward motion → **NOT FIXED (partly fixed)**

**Pick → teaser (dive into the card, footage after): fixed.**
- After the cut: 16x9 1.96, 1.70, 1.76, 1.80…; 9x16 1.96, 1.61, 1.66…; 1x1 2.09, 1.85, 1.94…
- Before the fix: 0.56, 0.32, 0.60.
- The plate keeps pushing on its own camera; it is no longer frozen and blurred.
- The float doesn't fly in sideways and has no streak (`cut2-pick-teaser-*.jpg`, `whip/dive-teaser-*.jpg`).
- The dive into the card / panel stops while the card's detail and the "Schedule" label are still readable, not on a featureless fill.

**Wall → plan (dive into a point): unchanged.**
- Change after the cut, frames 930–940:

  | Aspect | Change per frame |
  |---|---|
  | 16x9 | 0.70, 0.81, 0.94, 1.00, 1.06, 1.10 … 0.88 |
  | 9x16 | the same, 0.70–1.10 |
  | 1x1 | 1.17–1.86 |

  This is the monitor's "0.7–1.1", unchanged, after 23–62 per frame going in.
- **What I saw (`cut6-wall-plan-*.jpg`, `plan-arrival-16x9.jpg`):**
  - The first ~20 sixty-fps frames (⅓ s) of `plan` are one empty white rounded slab growing on a flat black field.
  - The panel's own entrance fades its title and "Schedule" button in around +24, so the dive arrives on nothing.
- **Who owns the fix:**
  - The panel's entrance is in the panel / `ui.js` block, not Worker C's file. That block ignores `ctx.entered`, which C added for exactly this.
  - The plain dark background gives the zoom nothing to read either.
- C's fix pass reported finding 6 as fixed, citing only the pick→teaser numbers.
- **Fix:**
  - The panel block should honour `ctx.entered === 'dive'` the way float does: content ready on frame 0. That is the panel owner's change.
  - Or the dev job dives into a shot whose first frame is populated.
  - Add one GUIDE line: "dive into a shot that is already full on its first frame".

### 7 · MED · the needle hand-over snaps → **FIXED**
- **Landing (frame 680), change per frame:**

  | Aspect | 678 | 679 | 680 | 681 |
  |---|---|---|---|---|
  | 16x9 | 0.27 | 0.20 | 0.23 | 0.39 |
  | 9x16 | 0.55 | 0.44 | 0.43 | 0.75 |
  | 1x1 | 0.33 | 0.28 | 0.31 | 0.73 |

  Before the fix: 3.02.
- **Carry rectangle (`cam.carry` per frame, `ver-C-v3-logs/cam-needle.txt`):**
  - Centre fixed at (960, 570–573).
  - ln-size step: +0.0101 → **+0.0350 on the cut** → +0.0099.
  - Nothing after landing.
- **Look:** the card holds its place while the plates hard-cut under it (`needle-carry-*.jpg`).

### 8 · MED · `from:` ignores the size of what the cards come out of; `from:` after a dive → **FIXED**
- **The speck is gone:**
  - The first wall card is born at about the posted card's size, not ×0.06 (`cut5-again-wall-*.jpg`).
  - Scan's front card is born at the prompt box's size.
- **From after a dive:** `--grid` warns (`from-dive` probe and `ver-C-v3-mwhip`: `! s3: from: on a shot the dive flies in …`). The monitor's probe still renders its speck frames (`mwhip/mwhip-dive-from-16x9.jpg`), which is now a warned, unsupported combination.
- **New problem with the fix: V1.**

### 9 · MED · `morph to: frame` passes through a muddy grey slab → **FIXED**
- Box colour sampled at the box centre, 16x9 frames 1137–1148: 254 → 243 → 211 → 155 → 83 → 23 → 14.
- That is about 4 sixty-fps frames of grey (#BA–#53, 2 thirty-fps frames) while the box is still about the prompt box's size, then the end colour (`fill-early-16x9.jpg`). Before the fix: 3–4 thirty-fps frames of grey on a large box.
- The box fills the frame exactly on the cut in all aspects (`fill-*.jpg`).
- **Residual (V5, LOW):** the end card's logo appears through the box's 3-frame post fade.

### 10 · LOW · the morph timing deviates from the spec → **DISPUTED-WORKER-RIGHT (the lead's call)**
- **Unchanged.** C keeps one continuous cusp box. The measurable part of the spec holds: relative speed on the cut 1.00, inside 0.97–1.03.
- **Visually** the box → box morph is clean, with no double and no shadow doubling (`morph-*.jpg`, all aspects). It is subtler than the reference's "stretch then settle".
- The monitor also left this to the lead.

### 11 · LOW · the carry take-off jolts → **FIXED**
- **Change per frame, frames 534–538:**

  | Aspect | 534 | 535 | 536 | 537 | 538 |
  |---|---|---|---|---|---|
  | 16x9 | 0.32 | 0.34 | 0.81 | 1.61 | 2.22 |
  | 9x16 | 0.38 | 0.39 | 0.81 | 1.48 | 1.97 |
  | 1x1 | 0.32 | 0.34 | 0.71 | 1.43 | 1.97 |

  Before the fix: 0.42 → **6.66**.
- **`cam.carry` ln-size steps (`cam-smooth.txt`):** +0.0059, +0.0085, +0.0101, +0.0106, then easing. The move peaks at **30.95 px/step on the cut step (551→552)**. The size step peaks at −0.0148 on the same step.

### 12 · LOW · `fingerprint.mjs` ownership → **FIXED (narrowed)**; the lead still has to accept the file
- **Real-link probe:** a dummy field planted on the neighbour shot. Does this shot's print change? (`ver-C-v3-tools/linkprobe.mjs`)

  | Job | Links |
  |---|---|
  | 15 original jobs | none |
  | shots-demo | can't compile in either engine |
  | r2-dev | `ask:next · scan:prev · pick:prev+next · teaser:prev+next · post:prev+next · again:prev · wall:prev+next · plan:prev+next · go:prev+next · end:prev` |
  | r2-whip | `ask:next · plan:prev+next · teaser:prev` |

- Editing `cause:` changes no print on any job.
- The diff is still outside Worker C's R2 file list, so the lead has to accept it.

### 13 · LOW · a comment moved onto the wrong line → **FIXED**
The opening comment is back on `if (first)` (`runtime.js:39`). The dive line is a separate added line.

### 14 · LOW · the merge with round 1 → **FIXED** (the part inside C's files)
- `wall-grid-from` warns for `wall layout: grid` and `stack mode: exploded`.
- The trial-merge notes (spec ENUMS, wall CHIP0, stack hunks) still stand for the lead.

### 15 · LOW · transition-lint inconsistency and noise → **DISPUTED-WORKER-RIGHT**
- **Zoom family fixed:** `lint-zoom` (zoom-in, zoom-out, whip) gives no types warning. film-sample now counts 3 types.
- **The cause warning stays.** SPEC-R2 §6 says to warn once per film on any moving transition without `cause:`. C followed the spec.
- **Visible effect:** old jobs' composite `storyboard.png` gains a "Notes before the film" box (the composite PNGs differ in size, live vs stage). Every per-shot still is unchanged.

### 16 · LOW · two loose validations → **FIXED**
`sig-cause`:
- ✗ `cause must be text … (it is blank)`
- ✗ `signature must be one of … (got ["dive"])`

### 17 · LOW · the wall's hero frame isn't moved → **FIXED**
- `hero` and the chip-slot `heroF` both use `CHIP0(s) + 2 + chips·5 + 10`. That is 14 without `from:`, unchanged.
- r2-dev's wall storyboard frame shows its chips.
- Old jobs' wall stills match live (max 2–3, the noise).

### 18 · LOW · the dev job and the report's artifacts → **FIXED**
- **Storyboards** (13:54–13:55) postdate the final `beats.yaml` (12:37) and the final engine (13:13). `plan` is dark.
- **`flood.spot`** pours from the Send button.
- **Needle pulse:** `cam.carry` R1/R0 = 1.084 wide × 1.098 tall (√area 1.091). That sits at the bottom of the spec's 1.10–1.15. Acceptable: the pulse is visible on the cut, and C showed 1.18 pushes "POSTED" out of title-safe.
- **The whip carry** is a dev job (`r2-whip`).

### 19 · LOW · the morph's hand-over shows a doubled shadow → **FIXED**
- **Morph landing (1067), change per frame:**

  | Aspect | 1065 | 1066 | 1067 | 1068 |
  |---|---|---|---|---|
  | 16x9 | 0.014 | 0.007 | 0.049 | 0.056 |
  | 9x16 | 0.009 | 0.005 | 0.041 | 0.081 |
  | 1x1 | 0.014 | 0.009 | 0.107 | 0.107 |

- No double edge or double caret is visible (`morph-*.jpg`).

## New in this pass

### V1 · MEDIUM · `from:` on wall: the lead card can be another picture, another shape and blurred
**File:** `engine/blocks/wall.js:97-101`. The lead is `cards.find(c => dist(c) === dmin)`; the near tier always blurs; non-lead cards are born at opacity .4.

**What happens on `again → wall`:**

| Aspect | Lead card | Read |
|---|---|---|
| 16x9 | The same blue night card | The split reads |
| 9x16 | A different picture (a red dusk card) at the same size | A match cut on shape only |
| 1x1 | A **landscape**, blurred sky card replaces the **portrait** night card | Does not read as the same object (`wall-birth-1x1.jpg`) |

- In 1x1 the lead then shrinks about 2.5× over ~8 sixty-fps frames.
- For about 0.2 s (+2…+12) the frame is one small blurred card on an empty light field.
- The next cards come out translucent (opacity .4 → 1 and the tier blur). They read as ghosts for 3–6 frames.

**Fix (design work, not a one-liner):**
- Pick the lead among the nearest few cards by the closest aspect ratio, and the same image when the source is a picture card (`ctx.origin` could carry the source's `src`).
- Draw the lead without its tier blur until it lands.
- Start the second and third cards within 1–2 frames of the lead, at full opacity, since they come out from under it.
- Re-check `cut5-again-wall` in all 3 aspects.

### V2 · MEDIUM · the point dive arrives on an empty slab
This is the rest of finding 6, described there. Owner: the panel / `ui.js` block (honour `ctx.entered`), or the dev job and GUIDE.

### V3 · LOW · the flood mask doesn't cover the prompt caret
- **File:** `runtime.js` `floodMask`, which only masks `.lv-txt`.
- **What happens:** the purple caret stays sharp inside the half-covered front for 2–3 frames after its text is masked (16x9 / 1x1 around 133–137).
- **Fix:** also mask the caret, or mask the text layer's root element (`prompt-text`).

### V4 · LOW · double exposure on a different-look carry
This is the 4-frame dissolve at the cut described in finding 2. It is optional polish.

### V5 · LOW · `morph to: frame` into an end card of the same colour
- **File:** `runtime.js` `carryAt`, `if (P.frame && f >= c.cut) alpha = …`.
- **What happens:** the post fade is a 3-frame fade of a box that is exactly the end card's background. All the viewer sees is the logo fading in by opacity (`fill-*.jpg`, cut … +6), against rule 11.
- **Fix:** skip the fade when the fill colour equals B's flat background, as `flood` already does with `F.flat`, and let the end card's own entrance carry it. This changes r2-dev's last 3 frames, so re-verify.

### V6 · INFO · one-off tile glitches in shuffled re-renders (the render pipeline, not Worker C)
- **16x9 seed-29 run:**
  - Frame 365 lost its bottom 63 px of footage: a flat dark band (`purity/p365-bottom.png`).
  - Frames 841 and 875 lost a bottom-left tile of a 3-D wall card (`purity/p841-875-corner.png`).
- **They don't reproduce.**
  - 365, re-rendered alone and after its exact 792-frame shuffled prefix: max \|Δ\| 2.
  - 841: max 15 on 10–16 channels. 875: max 54 on 45–55 channels. Both within tolerance.
- **Earlier occurrences:**
  - The first attempt's "frame 138 outside" (16x9 and 1x1) also doesn't reproduce. I replayed 138 with the exact 148-frame prefix: byte-identical.
  - These are C's open issue 2. This run had no other render running, so it is not only "under heavy load".
- **The films are clean:**
  - My three films match Worker C's at max \|Δ\| ≤ 5.
  - `spike.py` finds no bottom-band frame outside transition motion.
- **What matters:** a glitch like this landing in a film frame would be a one-frame flash that QA can't see.
- **Suggestion for B and D:**
  - The purity WARN re-renders once before warning.
  - QA gains a one-frame band check.

### V7 · INFO · the `ui.js` raster-history effects (C's open issue 1): confirmed, not Worker C's file
- **Live engine, old fields only (`ver-C-v3-paneltap`):** frame 209 drawn alone vs after 190–208 differs, max 224 on 2,534 channels. The panel-tap effect is pre-existing.
- **Stage C, r2-dev:** frame 956 drawn alone differs from the film (max 238, 9,459 channels). Drawn after 930–955 it is **byte-identical** with the film.
- 956 only appears after a **dive** entrance (C's report: not with a zoom-in entrance). Worker C's new path exposes this latent `ui.js` bug.
- **Fix before the dive ships:** apply C's tested one-liners in `ui.js` (`:216` `rotate(.001deg)`, `:255` `'none'` at rest). Then prove old jobs byte-identical again.

### V8 · INFO · run-to-run raster noise in footage shots
My fresh r2-dev films differ from Worker C's in `teaser` / `post` (435–638) by at most \|Δ\| 3 (≤ 10 channels above 2) in 16x9 and 9x16. Elsewhere they are byte-identical (16x9 also 319–421 max 3, one frame 786 max 5; 1x1 1276 / 1277 identical). The first attempt's 9x16 film was byte-identical to C's. My r2-whip films are byte-identical to the first attempt's in all 3 aspects. This is harmless, but "a re-render is byte-identical" isn't guaranteed for footage shots under a dive / carry.

## Re-run commands and results

```
S=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit/stageC/product-launch-sting/video
J=/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit/jobs
```
- **Background scripts:**
  - `jobs/ver-C-v3-logs/run.sh`: films → QA → frames vs C's film → spike check → full shuffled purity, per aspect; the monitor probe; layers/clips; old jobs.
  - `run2.sh`: the live panel tap, 956, `cam.carry` tracks.
  - `run3.sh`: replays of the 365 / 841 / 875 outliers.
  - `run4.sh`: the `again` small-difference control.
  - Logs: `run*.log` in the same folder.
- **Films:** `node $S/lv.mjs --job $J/ver-C-v3-{dev,whip} --film --aspect <a> --workers 2`. All QA PASSED, numbers above. The monitor probe `ver-C-v3-mwhip` 16x9: QA PASSED (12).
- **Purity:** `node $J/ver-C-tools/purity-all.mjs $S $J/<job> <a> $J/ver-C-v3-purity/<job>-<a> 1 <seed>`. Frames outside tolerance are kept as PNGs in `ver-C-v3-purity/`.
- **Layers / clips:**

  | Command | Result |
  |---|---|
  | dev `--layers post,again --with-transitions` | PASS 7/7 each; `carry` layer 0–57 / 0–5 |
  | dev `--layers teaser,post,again` (clean) | PASS 7/7 each; no carry layer |
  | dev `--clips again --alpha`, `--clips teaser --alpha`, `--clips post` | PASS clip / content / freeze |
  | whip 9x16 `--layers ask,plan --with-transitions` | PASS 7/7 each; carry 64–72 / 0–13 |
  | whip 16x9 `--layers ask` (clean) | PASS 7/7; no carry |

  The first attempt's `--clips` crash (`qa.mjs:38`, ffmpeg killed during the 21:03 outage) does not reproduce.
- **Old jobs:**
  - Storyboards `--aspect all`, stage vs live clones of film-sample, steady-sample and reel-sample: 72 / 74 heroes byte-identical (the wall still in 9x16 / 1x1, max 2 / 3).
  - `--range 100,219` film-sample 16x9: 120/120 frames and bgref byte-identical. The exit 1 is expected: the mux refuses a partial film.
  - Live vs stage timelines (`ver-C-tools/tlcmp.mjs`): identical on all 15 jobs that compile. The only additions are the lint warnings.
- **`--grid` probes** (17 monitor + 11 C fix probes, `grid-probes.log`): every bad input fails with one clear line, and every soft case warns.
  - **The exception, `carry-invisible-a`, is not bad input.** A's `sub` isn't visible yet where the carry leaves, and that renders correctly. The copy is A's live element, so it fades in with its own entrance (`ver-C-v3-strips/purity/carry-invisible-a.jpg`).
- **Build-time carry errors** (`--storyboard`), each one clear line:
  - `carry s1 → s2: "cta" is only 0 % visible where the carry lands …`
  - `carry from s1: el "nope" — shot s1 (prompt) has no layer of that name (its layers: prompt-box, prompt-text)`
  - `… to "nothing-here" …`
  - `--grid`: `s2: carry on the last shot …`

## Still open, for the lead
1. **V1:** wall `from:` lead-card picture, shape and blur (Worker C, design work).
2. **Finding 6 / V2:** the point dive arrives on an empty panel. Panel owner: `ctx.entered`. Or the dev job and GUIDE.
3. **V7:** the `ui.js` fixes for frames 956 and 205–214 / 989–998, with a byte-identical proof on old jobs. They're not Worker C's file, and the dive exposes 956.
4. **Finding 10:** the morph timing choice. **Finding 12:** accept `fingerprint.mjs`. **Finding 14:** the merge notes.
5. **Small polish:** V3 (caret), V5 (same-colour fill fade), V4 (dissolve length).
6. **V6:** the pipeline's one-off tile glitches. Suggest a re-render-once in B's purity WARN and a band check in QA.

## Where everything is
- **Contact sheets (30-fps frames around every cut, red = first frame after the cut, all 3 aspects):**
  - `jobs/ver-C-v3-strips/dev/`, built from Worker C's film frames, which my films match.
  - `jobs/ver-C-v3-strips/whip/` and `mwhip/`.
  - `jobs/ver-C-v3-strips/purity/` holds the V6 glitches.
- **Close-ups and extra sheets:** `flood-early-*`, `smooth-carry-*`, `needle-carry-*`, `morph-*`, `fill-*`, `fill-early-16x9`, `plan-arrival-16x9`, `wall-birth-1x1`, `whip/whip-cut-closeup-16x9.png`.
- **Films (mp4 kept):** `jobs/ver-C-v3-dev/r2-dev-{16x9,9x16,1x1}.mp4`, `jobs/ver-C-v3-whip/r2-whip-*.mp4`, `jobs/ver-C-v3-mwhip/mon-c-whip-16x9.mp4`. Clips are in `jobs/ver-C-v3-dev/clips/`.
- **Logs and measurements:** `jobs/ver-C-v3-logs/`, including `fdiff-*.txt`, `cam-*.txt`, `oldjobs-boards.txt`, `tlcmp-oldjobs.txt` and `whip-vs-prior.txt`.
- **Probes:**
  - `jobs/ver-C-v3-probes/{bad,fix}/*` (bad input).
  - `ver-C-v3-paneltap` (the live `ui.js` control).
  - `ver-C-v3-nocarry` (the purity control).
  - `ver-C-v3-tools/linkprobe.mjs` (real fingerprint links).
