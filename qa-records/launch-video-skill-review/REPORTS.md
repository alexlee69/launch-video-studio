# What was built in the launch-video skill on 2026-10-21 (reconstructed)

The original report files (PORT-REPORT.md, HF02-UPGRADE-REPORT.md, the W4 report, every monitor findings log) were in the session scratchpad, which a session restart wiped at 23:16. This file rebuilds them from the agents' final hand-back summaries. Nothing in the skill changed after the 19:43 merge; `snap/` here is live as of 23:20, and `pre/` is the backup repo's copy (`~/Downloads/launch-video-studio/skill/product-launch-sting`, committed 2026-10-20 23:58).

**Diff scope warning:** `today.diff` (pre → snap) also contains the earlier layers/sheet session's work from the night of 10-20 → 10-21:
- `lib/layers.mjs`, `lib/layers-qa-worker.mjs` (new), `lib/sheet.mjs` + `lib/sheet.html` (new);
- `lib/common.mjs`, `lib/deliver.mjs`;
- parts of `lv.mjs` and `render.mjs`.

That session reviewed and verified its own work, so review those hunks only where they meet today's features: the footage pass in layers, the sheet describe lines, and the footage in clips.

## 1. W4 engine features (merged ~05:00 after a pixel-identical regression)
- **Universal background contract.** Any shot can carry:
  - `bg`, `bgFrom`, `bgDim` (default .15), `bgMove`;
  - `letterbox`: true = 2.39:1 in landscape; in portrait and square, 8 % of H scaled by the ratio.

  It adds a block-level `bgDefaults`, plus `ctx.hasBg`, `ctx.dark`, `ctx.picture={x0,y0,x1,y1,w,h,bar}`, a clipped `ctx.safe`, `ctx.plate()` and `ctx.footage()`.
- **Media fields.** A block's `media: [...]` declares them, with plate keys `${id}:${field}` / `${id}:${field}.${i}` (`~` in directory names).
- **Reserved layers:** `footage`, `letterbox`, `transition`. Footage is left out under `--alpha`.
- **Transitions:** glitch, smear-left, smear-right, tunnel and flash, each with its own whoosh (`E.sweep`, `E.glitch`).
- **Known limit:** glitch fails the `--layers --with-transitions` stack check. `setBgOnly(true | 'brand')`.

## 2. The port: reel kit + film kit into engine/blocks (done 17:04)
- **New blocks:**
  - `_reel.js` and `_film.js` (helpers);
  - reel: `sticker`, `split`, `float`, `cta`;
  - film: `scene`, `agent`, `roster`, `type`, `lockup`, `stack`, `wall`;
  - `media.js` gained `caption` / `captionAt` (without a caption it takes the old path).

  23 built-ins in total.
- **Copy hook.** Blocks may define `copy(s)` / `read(s)`. The timeline stores them as `copy` / `copyRead` (RESERVED), and they feed the SRT, the reading-time check, the storyboard and the sheet.
- **QA content reference.** It is the brand underlay + camera + letterbox bars + transition overlays, with bg footage HIDDEN, so footage counts as content. No threshold moved (still 3 px at > 12 luma).
- **Image byte-sniffing.** `spec.mjs imageProblem()` runs at `--grid` and rejects HTML pages, HEIC, random bytes and empty files. The runtime also refuses to build if a bg or block `<img>` won't decode. No false positives across 83 asset images.
- **Spec checks:**
  - a warning when `framing: macro` lands on dark bars;
  - the lockup partner logo is checked;
  - every declared media field gets an extension check;
  - `.svg` counts as an image.
- **Copy rewritten off Higgsfield's lines** (hf01 "Need a … ASAP", hf02 Research/Script, "Find the signal", "Find the right words", "Make the launch film. No mistakes.", "Always-on agents", and others). It now reads "Launch is Friday. Help?", Scout / Writer, "Digs up what's working", "Writes it in your voice", "Cut our launch film by Friday.", "Your launch crew".
- **CLI.**
  - `--init --kit reel|film`, `--breakdown <file>`, `--tempo <file>`;
  - `--blocks` lists footage fields and bg defaults.
- **Docs.** GUIDE gained a "Reels and launch films" section and a "Reference breakdown" section. SKILL.md is ≤ 1024 characters, and its router sends reels, films, breakdowns and tempo to mode B.
- **Port proofs:**
  - old jobs (steady-sample, edge-test, cue, cue-overlays, dark-ui-check) were pixel-identical to pre-merge;
  - the planted probes (qa-probe, qa-probe2 seam/whip, layers-probe, probe.mjs) fail as labelled;
  - film-sample and reel-sample QA PASSED in 3 aspects, and their layers pass (thinnest margins: 3D stack 18/64, split wipe 27 and 36/64);
  - footage-test QA PASSED.
- **Port monitor findings, all fixed:**
  - **HIGH:** a corrupt bg passed QA as a full-frame broken-image icon;
  - the scene send button had low contrast over footage;
  - macro framing was silently ignored on dark bars;
  - copy echoes;
  - the svg docs, the undocumented copy hook, the sheet bar descriptions and the SKILL length.

## 3. The hf02 motion upgrade (merged 19:43; spec `Design-AutoPilot-stable/HANDOVER-hf02-motion.md`)
Fifteen files changed: SKILL.md, GUIDE.md, lv.mjs, `templates/film.yaml`, `engine/{art,kit,runtime}.js`, `blocks/{_film,agent,roster,wall}.js` and `lib/{audio,qa,spec,timeline}.mjs`.

**Cuts and camera**
- **Drift cuts:** `drift-left|right|up|down`. The exit is an expo-in over 12 frames (`K.exitLen(type)` is 12 for drifts and 7 for the rest; the hold check and the hero frame use it). The entrance is −E·0.7^t. A shot's `drift: {in, out}` multiplies them; custom blocks and wall keep their own string `drift` field.
- **Lighter whoosh** for drifts. The `cut` QA check treats drifts as INFO.
- **Camera fields on any shot:** `zoom`, `focus`, `offset`, `pan: [{at, by, len}]` (tanh, τ = len/7.5), `move: [x, y]` (a constant drift), and per-aspect maps of each. Focus is kept fixed under the total scale.
- **Velocity motion blur**, σ ≈ 0.2 × speed, but ONLY on shots that use these fields or a drift cut.

**agent**
- Rows take `at` (negative = done), `think`, `statusAt` and `statusLen`.
- Rows slide in; the scroll is momentum-based with motion blur.
- New options: `scroll: always`, `dolly: false`, `frame: window` (sidebar with title, search and skeleton slot plus `sidebar.at`/`drop`; header; rules; message bar; a view-aware layout for 9:16 and 1:1).
- The `F.stream` short stall is opt-in, for agent replies only.

**roster** (rebuilt)
- Base drift plus a double-exponential step per beat, and an optional run.
- The list locks once the last row is in. The slot drifts up and the steps drag it.
- Also new: the row-0 drop, fly-ins, the reveal recipe, rows above the slot dimmed, an edge fade, mood cadence, and the "more" grid built square by square.
- Params are `beat` (15), `first` (renamed from `start`, a reserved timeline field) and `run` (0).

**Mascots:** `art.js` gains the `happy` and `blink` moods.

**Proof** (`~/Downloads/launch-videos/hf02-skill/`): QA PASSED in 3 aspects. Max/mean px against `ref/curves`:

| Shot | Max | Mean |
|---|---|---|
| A | 2.67 | 0.47 |
| B | 4.79 | ≈ 1.4 |
| C entrance | 17.2 | 8.0 |
| C list | 10.3 | 2.7 |
| C slot | 10.5 | 3.8 |
| D | 5.2 | 2.3 |

Landings are within ±1 frame.

**Monitor findings, all fixed**
- **HIGH L1:** the faint window rules sat on a layer of their own and failed `nonempty`. Moved onto the `header` layer.
- **HIGH L2:** four Chrome compositing triggers broke the roster and agent layer exports. Fixed by:
  - positioning the roster header with `top` instead of a transform;
  - folding the list blur into each text's own blur;
  - sliding the avatar by `left` inside a widened row box;
  - making the 0×0 chrome wrappers frame-sized.

  GUIDE's traps list now names all four.
- **MEDIUM:**
  - A1: a window with `push: 0` froze;
  - A2: the dropping agent flew back out of the slot;
  - A3: the new params weren't validated (now 14 errors, rc 2);
  - W1: the window had no 9:16 / 1:1 layout;
  - G1: GUIDE claimed every block keeps moving with `push: 0`.
- **LOW:** a few more.
- **Still open:** M5, a cosmetic "got null" in one error message.

**Regressions:** steady-sample, edge-test, cue, cue-overlays, dark-ui-check and reel-sample are pixel-identical PRE vs live. That covers timeline + SRT dumps, every storyboard still, film frames across whips, zooms and footage, the edge-test clips, and all 11 layer passes. film-sample was re-rendered in place (its look changed on purpose): QA PASSED ×3, and its layers restack.

**Open items**
1. C accuracy (one-rule slot model).
2. Entrance strengths: answered, see §4.
3. Blur coefficient: answered, keep 0.2.
4. The B→C one-frame dissolve stays a hard cut.
5. **K1:** `--init --kit film` fails film QA (`cut name→hook` 0.96×; `content` 290–307, the hook opens on footage-less frames). It is identical in PRE and live.
6. Blocks can't emit whoosh cues.
7. film-sample still cuts with whips and zooms (converting it is Alex's call).
8. CapCut alpha import is untested; no live After Effects text; the serif is a system font.

## 4. Measurement answers from the hf02 session (`~/Downloads/launch-videos/hf02-skill/ANSWERS-measurements.md`)
- **Drift entrance default:** E ≈ 0.10 W horizontal and ≈ 0.085 H vertical, decaying ×0.65 per frame, with the shot's base drift as its own term. C's ×6.5 is real, but C is a drop with no carried momentum, so keep it per-cut.
- **Blur:** keep 0.2. Our exits are slower on their LAST frame (n311 ours 14.0 vs ref ≈ 16.4 px/f; n509 19.5 vs ≈ 26.5), so let the expo build continue ×1.38–1.41 through the final frame. Optionally boost the last frame ×1.1–1.2; don't raise the global coefficient.
- **Slot nudges:** they really vary (8.8 / 14.9 / 2.2 / 25.7 px) and look hand-keyed. Keep one rule; optionally add a seeded per-step factor of 0.25–1.7×.

## 5. Review chain result (finished 2026-10-22 01:15; run wf_add4b127-f07)
- **What ran:** Sonnet (5 areas, 48 findings) → Codex → Opus (3 groups). The full result is in `review-chain-result.json` (a copy of the raw output is in `review-chain-result.txt`).
- **Codex gave NO second opinion.** It hit its usage limit, which resets 05:34. Every verdict is Sonnet + Opus only.
- **Opus refuted nothing.** It confirmed all 48 and added 9 of its own, so 57 unique findings, with ENG-1 / REEL-1 / LIB-1 being one bug.
- **HIGH:**
  - the camera `move: [x, y]` field collides with media's Ken Burns `move: in|out|left|right|none`;
  - wall chips are dropped or hidden in every aspect (FILM-1);
  - QA `cut` false-fails the documented `type through: true` + `out: cut` whenever the next shot has no footage (FILM-OP-2, the real cause of K1's cut half).
- **K1 corrected:**
  - the content-empty frames are 290–306 and 465 (ask's first frame), not 290–307;
  - fixing the starter alone can't fix the cut half; the QA cut rule must change for block-drawn exits.
- **Product calls for Alex:** agent / roster over bg footage (honour dark vs a light card); per-aspect bg; film-sample whips/zooms → drift cuts.
- **Housekeeping:** the opus-film reviewer accidentally created `live/node_modules/node_modules` → a self-loop symlink at 00:46. Removed 01:16; live re-verified against `snap.sha1` (78/78 OK, no extra files).

## 6. Fix round (started 2026-10-22 01:20; workflow wf_4b5e8a81-73f)
- **Staging** is a private scratch git repo in `fix/` (no remote): `fix/main` holds the baseline (== live == snap). Worktrees `fix/wt-{engine,film,reel,tools}` sit on branches `fix/<group>`.
- **Inputs and logs:** findings per group are in `fix/findings-<group>.json`; each group's work dir and REPORT.md are in `fix/work-<group>/`.
- **Flow:** per group, Opus worker → Opus monitor → fix-up → re-check. Then merge into `fix/main`, then regression: old jobs pixel identity, probes + starters + reel-sample + xcuts, film-sample + hf02 proof tracker.
- **Also in this round:** the drift refinements from §4 (entrance E .10 W / .085 H ×0.65, with base drift as its own term; the exit build continues through the last frame) and the hf02 proof refit.
- **Rollback:** live is untouched until the merge into live. `snap/` is the exact rollback copy.

## 7. Outage and resume (2026-10-22)
- **03:25 PDT:** the API went unreachable (ENOTFOUND) just before the workers returned, so the first fix-round run (wf_4b5e8a81-73f) ended with 8 of 10 agents failed. Nothing was lost on disk:
  - engine: 9 commits; film: 10; tools: 7 plus an uncommitted breakdown.mjs dip fix;
  - reel: worker and monitor done (4 LOW issues), fix-up half done (uncommitted).
  - The reel round-1 results are in `fix/reel-round1.json`, and the uncommitted diffs are saved in `fix/wip-2026-10-22/`.
- **18:27 PDT:** the hf02-full port went into live (see `NOTE-hf02-port-merged.md`). Staging gained branch `port` (worktree `fix/wt-port`, byte-identical to live and runnable). From now on, PRE for regression = `fix/wt-port`. **Never restore `snap/` over live**: it would delete the port.
- **18:40 PDT:** resumed as wf_72bb8632-4c8.
  - Workers continue from their own transcripts; `fix/tools/transcript_tail.py` prints the tail of a transcript.
  - Each group then goes to a monitor, a fix-up and a re-check.
  - Merge = `port` first, then engine, film, reel, tools, then `apply_pointers.py` and a RECREATE.md tempo-example update.
  - Regression adds a "port" set: test_screen_bg, final.sh, the port's QA runs 1–3 and the acceptance harness.
- **Added to the tools group:** the port session found that fix/tools' tracker drops higgsfield02's tempo confidence from 0.941 to 0.55 and flags it `offBeat`, though its grid is known to be 87.46 BPM with the first beat at 0.3905 s. This is a suspected LIB-7 regression and must be resolved before merging.
