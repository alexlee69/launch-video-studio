# Review (opus): the merged motion kit in `qa/motion-kit/stage` (2026-10-27)

**Bottom line.** The kit is mostly sound. Old jobs stay byte-identical, `shots.py` is robust, and the sample film reads well in all three aspects. I found **3 HIGH, 8 MEDIUM and 10 LOW** problems, and every one comes from a run, not from reading a report.
- **The three HIGH problems.**
  - A stray label chip stays pinned in the frame's corner for the whole shot.
  - The plan's own "button → CTA → end card" morph can't start from the kit's `press` button.
  - Any `cutdowns:` entry that ends on a `carry:` shot stops the **main** film from compiling.
- **Film QA passes every visible defect below.** Only the storyboard's safe-area note touches two of them (#1, #15), as a WARN. Cut stills and storyboards are still the only way to catch them.
- **The suites are red on the stage today.** `SHOTS_QA_VIDEO=$S run_all.sh` gives SOME SUITES FAILED (P8 and P8c), after the docs pass. The merge's "ALL SUITES PASS" no longer holds.

I edited nothing in the stage, the live skill, `base/`, `live-before/`, the original jobs or any test file. `shasum -c live-before.sha1` gives 0 not OK, and `find -newer reports/sample.md` finds no file in the stage, `base/`, `live-before/` or `~/Downloads/launch-videos`. I made no commit, no paid call and no `--go`. Every render ran alone, at `--workers` ≤ 2 (mostly 1). `pmset -g therm` recorded no warning all session. 39.5 GB is free at the end; I deleted the `frames/`, `bgref/`, `textless/` and `purity/` folders of my own jobs after measuring them.

Shorthands:
- `M = qa/motion-kit`, `J = $M/jobs`
- `S = $M/stage/product-launch-sting/video` (the tool is `node $S/lv.mjs`)
- `T = $J/rvo-tools`

`bash $T/mk.sh <name> $T/<file>.yaml` writes `$J/rvo-<name>/beats.yaml` (Orbit brand, 3 aspects, `film-sample` cards) and runs `--grid`. The shot lists are `$T/s1.yaml … s10.yaml`. Cut sheets are in `$J/rvo-stills/`, made with `.venv/bin/python3 -I $T/cutsheet.py`. Logs are in `$J/rvo-logs/`.

---

## Findings

### 1 · HIGH · `stack mode: exploded`: a label beyond the plane count sticks to the top-left corner for the whole shot
- **Where.** `engine/blocks/stack.js:91` builds a chip for every label (`labelsOf` = up to 4). `:133` (`const L = chips.map(… if (k >= n) return null …)`) never positions, fades or hides the chips past `n` planes. So they stay at `left:0;top:0`, opacity 1.
- **Repro.** `bash $T/mk.sh xlabels $T/s1.yaml` (`count: 3`, 4 labels), then `cd $J/rvo-xlabels && node $S/lv.mjs --job . --storyboard --aspect 16x9`.
- **Seen.** `out/main/16x9/board/01-layers.png`: the chip "Sound" sits at (0, 0), clipped by the frame corner, for the whole shot.
  - `--grid` says nothing.
  - The storyboard only notes "text outside the title-safe area", and film QA would only WARN.
  - The same happens with 3 `cards`, no `count`, and 4 labels.
  - The GUIDE and `--blocks` both promise "one per plane … at most 4 shown".
- **Fix.**
  - In `buildExploded`, cap the labels at the plane count: `labels = labelsOf(s).slice(0, n)`. Do the same in `copy` and `read`, since they currently list the dropped label as on-screen copy.
  - Add a `validate` warning: "N labels for M planes — the extra labels are not shown".

### 2 · HIGH · A morph or carry out of `press`'s `control` uses its soft halo as the box and leaves the label behind
- **Where.**
  - `engine/runtime.js:757–761` `boxOf()` takes the first descendant with a background. Press's first child is the glow (`press.js:149–151`, a radial gradient 1.8× the face, marked `data-lv-soft`). `boxOf` doesn't skip `data-lv-soft`, which only `visualRect` was taught in prove fix 3.
  - Separately, press keeps its label on its own `label` layer (`press.js:147`). A carry or morph of `control` takes the face without its text.
- **Repro.** `$J/rvo-pressmorph/beats.yaml`, a `cp -c` of the sample agent's `smp-bug-press-morph`: press → endcard with `carry: {el: control, to: frame, mode: morph}`. Run `cd $J/rvo-pressmorph && node $S/lv.mjs --job . --film --aspect 16x9 --range 140,190 --workers 1`. Sheet: `$J/rvo-stills/pressmorph-cut180.jpg`.
- **Seen.** At f152 (cut−28) a translucent coral slab about 1.5× the button pops over it in one frame. "Plan my trip" vanishes, and the slab darkens into the end card. This is the sample's B1, still unfixed on the final stage.
  - QA calls it "soft cut by design (INFO)", and continuity "holds".
  - This is the plan's named UI-morph move ("button → CTA → end card"). The GUIDE lists press's `control` among the carry/morph layer names.
  - The sample film had to swap its CTA to a `prompt` composer to avoid it.
- **Fix.**
  - In `boxOf`, skip `[data-lv-soft]` elements and SVG no-draw tags, with the same test as `visualRect`.
  - In press, wrap the face and the label in one tagged element (e.g. `button`). Or make a carry or morph of `control` take `label` along.
  - Until then, have `--grid` warn on `carry.el: control` for press.

### 3 · HIGH · A cutdown that ends on a `carry:` shot breaks the whole job, main film included
- **Where.** `lib/timeline.mjs:185` throws "carry on the last shot" whenever the carry's shot is last *in the cut being compiled*. `compile` runs for every cutdown, so `--grid` of the main cut dies too. A cutdown that skips the carry's target only warns "the stage build will fail".
- **Repro.** `bash $T/mk.sh cutdown $T/s7.yaml`. The main film carries `brief → res`; the cutdowns are `short: [a, brief]` and `skip: [brief, end]`.
- **Seen.**
  - `--grid` (main) prints `✗ beats.yaml: brief: carry on the last shot … (move it to the shot before a cut)`. It doesn't name the cutdown, and the main film is fine on its own.
  - `--grid --cut skip` warns `carry.to "card" — end's endcard block has no such layer … the stage build will fail`.
  - There is no way to say "carry only in main".
- **Fix.**
  - Treat `carry` like `out:` on a cutdown's last shot: drop it silently. Today `out` is already forced to `cut` there.
  - In a cutdown whose next shot isn't the main film's next shot, drop the carry with an INFO. The same rule fits `from:` when the previous shot changes.
  - Say "in cutdown <name>" in every cross-cut message.

### 4 · MEDIUM · `out: dive` or `out: flood` on a shot shorter than 14 frames crashes the build, or measures the wrong shot
- **Where.**
  - `engine/runtime.js:938` `await seek(a.f1 - K.DIVE_LEN)` and `:956` `seek(a.f1 - K.XFX.flood.pre)`.
  - `lib/timeline.mjs` `crossCutChecks` has no minimum length for a dive or flood. It has one for `carry.pre`.
- **Repro.** `bash $T/mk.sh shortdive $T/s2.yaml` (a 0.4 s prompt shot with `out: dive, dive: {el: prompt-box}`), then `--storyboard --aspect 16x9`.
- **Seen.**
  - `--grid` passes.
  - The storyboard gives `✗ stage failed to build: page.evaluate: TypeError: Cannot read properties of undefined (reading 'el')`: the seek lands before frame 0 on the first shot.
  - On a later shot it lands in the shot before. That shot's DOM is hidden, so `visualRect` falls back to a 1 × 1 box at the frame centre: a silently wrong pivot and a zoom clamped by a bogus `fill`.
- **Fix.** A `--grid` error, like the carry's: "`out: dive` needs ≥ 16 frames (the dive takes the last 14)". Also `Math.max(a.f0, …)` in both seeks.

### 5 · MEDIUM · A morph onto an element with no box (a text layer) becomes a grey slab, then vanishes by opacity
- **Where.** `engine/runtime.js` `boxOf()` (`:757–770`): with no painting descendant it falls back to `roots[0]`, colour `rgba(0,0,0,0)`. `carryAt`'s morph then interpolates A's colour toward transparent black, and the box "lands exactly on B's box", which is invisible.
- **Repro.** `bash $T/mk.sh morphtext $T/s10.yaml` (prompt → headline, `carry: {el: prompt-box, to: headline, mode: morph}`), then `cd $J/rvo-morphtext && node $S/lv.mjs --job . --film --aspect 16x9 --range 120,190 --workers 1`. Sheet: `$J/rvo-stills/morphtext-cut150.jpg`.
- **Seen.**
  - From cut−12 to cut−1 the white composer turns into a translucent mid-grey slab: the "loading placeholder" look the code comment itself warns about.
  - From cut to cut+2 a dark box behind "Every post." fades out by opacity.
  - Also seen with a flood on the same cut (finding 10): `$J/rvo-stills/combo1-cut300.jpg`, f300–f304.
  - No `--grid` or build warning.
- **Fix.** In `carryPrep`, when the B box has no paint (alpha < .01 and no background-image), stop with "a morph needs a box on both sides — use a carry, or `to:` a card / pill / button". Or keep A's colour and fade only the content.

### 6 · MEDIUM · `map`: a stop near an edge puts its label on the headline and its pin off the frame, and `--grid` says nothing
- **Where.**
  - `engine/blocks/map.js:43–49`: the "under the headline" check only flags a pin inside a box that starts at the safe edge. A stop left of or above the safe box escapes it.
  - `:185`: the chosen chip is clamped into `safe` *after* scoring, so it can land on the headline.
- **Repro.** `bash $T/mk.sh iso $T/s5.yaml` (shot `m`: stops `[0.03, 0.05]`, `[0.5, 0.5]`, `[0.97, 0.95]`, with a headline), then `--storyboard --aspect all`.
- **Seen.** `$J/rvo-iso/out/main/16x9/board/03-m.png`:
  - The chip "Corner" sits on "Every" of the headline.
  - The corner pin is cut off the top-left, and the "Far" pin is half off the bottom-right.
  - 9:16 is the same (`rvo-iso-storyboard-9x16.png`).
  - `--grid` and the storyboard print no warning. The GUIDE says "keep stops out of that corner (`--grid` warns)".
- **Fix.**
  - In `validate`, warn on a stop outside the title-safe box (pins are ~70 px tall above their tip). Test the estimated chip box against the headline, not just the pin.
  - In `build`, re-test the clamped chip against `hb` and the pins, and fall to the next candidate when it hits.

### 7 · MEDIUM · The shot-writer suites fail on the stage
- **Repro.** A sibling copy of `qa/shots-skill-port`, run with `SHOTS_QA_VIDEO=$S bash run_all.sh` (copy since deleted). Logs: `$J/rvo-logs/suites.log`, `$J/rvo-logs/suites/`.
- **Seen.**
  - QA 1 parity is 15 / 17: `FAIL P8 … rebuilds all 5 docs exactly (11 + 2 applied)` and `FAIL P8c SKILL.md's description line is the same as before the port`.
  - The other suites pass: 48 / 16 / 57 / 90 / 48.
  - The verdict is SOME SUITES FAILED. The merge's ALL SUITES PASS predates the docs pass. The docs agent predicted this (its Ask 1), and nobody patched it.
- **Fix.**
  - Add `apply_motion_kit_docs.py` (doc patch pairs) after the pointer scripts in P8 and the storyboard port's P3b, and let P8c compare against the new description.
  - On ship, empty `engine-allow.txt` and re-fingerprint, as the merge notes.

### 8 · MEDIUM · A dive into almost any block lands on a near-empty frame
- **Where.** Only `float` and `particles` read `ctx.entered === 'dive'`: `grep -l ctx.entered $S/engine/blocks/*.js`. Every other block (type, headline, title, stat, prompt …) plays its own fade or rise *under* the dive's ×`from` entrance.
- **Repro.** `bash $T/mk.sh dive01 $T/s9.yaml` (stat → headline with `dive: {at: [.5, .5], zoom: 16, from: 0.1}`), then `--film --aspect 16x9 --range 100,150 --workers 1`. Sheet: `$J/rvo-stills/dive01-cut120.jpg`.
- **Seen.** From cut to cut+8 the frame is blank light grey with a speck; "Every post." is readable only from about +16. The sample hit the same thing with `type` (its F5) and patched round it with a `bg:`. `--grid` is silent, and content QA passes on a few pixels.
- **Fix.**
  - In the engine: when `ctx.entered === 'dive'`, pre-roll the block's time by its entrance length, as particles' `PRE` does, unless the block opts out.
  - At least, a `--grid` WARN: "dive into <block> — it builds up from empty; the dive will land on nothing".

### 9 · MEDIUM · 9:16 `stack mode: exploded` with the default `tilt: iso` is still broken (A-verify N1, open)
- **Repro.** `cd $J/rvo-iso && node $S/lv.mjs --job . --storyboard --aspect 9x16`, then look at `rvo-iso-storyboard-9x16.png`. Also `$J/mrg-kit-dev/kit-dev-storyboard-9x16.png`, shot 11.
- **Seen.**
  - The planes run into the left frame edge (clipped).
  - The chips sit over the planes' right edges.
  - The stack fills one band, leaving the lower ~40 % of the frame empty.
  - It's the block's default on the reel aspect. The GUIDE's Limits mention it, but QA can't see it.
  - On 16:9 the iso planes also touch the headline (kit-dev shot 11; the sample's B3).
- **Fix.**
  - Fit the projected quads (already computed: `quad(k)`) into the safe box per aspect: scale `pw`, move `sx`.
  - Pick the label column from the fitted right edge.
  - Cap the 16:9 headline's `maxW` at the planes' projected left corner.
  - Until then, default to `tilt: low` on 9:16.

### 10 · MEDIUM · Every `--film` now costs ~30 % more, with no opt-out, and leaves `purity/` PNGs behind
- **Where.**
  - `lv.mjs:231–232` always runs `purityRun`: 24–120 frames on a fresh page, plus a replay from the shot's first frame for every difference, plus an "again" pass.
  - The textless and ink shots add 4–5 screenshots per hero frame.
  - `qa.mjs` `purityRun` leaves `out/<cut>/<aspect>/purity/*.png` (and `replay/`, `again/`) on disk. The GUIDE's disk line doesn't mention them.
- **Measured** (prove's logs, `$J/prv-logs/film-steady-{L,S}.log`): steady-sample 16:9 went from **148 s → 194 s (+31 %)**. Purity alone is 109 → 150 s, because three raster-history frames forced replays.
  - kit-dev runs 586 s per aspect.
  - My 205-frame slice left 6 MB in `purity/`.
  - On this laptop, which overheated, it applies to every iteration render, `--range` included.
- **Fix.**
  - Add `--no-purity` (or run purity only without `--range` / on the final pass).
  - Delete `purity/` PNGs once `purity.json` is written, keeping only the differing ones.
  - Add `purity/` to the GUIDE's disk line.

### 11 · MEDIUM · The sample still holds much longer than the reels the plan measured (visual)
- **Measured** (`~/Downloads/launch-videos/motion-kit-sample/out/main/<aspect>/qa.json`, deadair `data.longest`): per aspect, 7–9 shots have a near-still stretch of ≥ 0.6 s.
  - ask: 1.75 / 1.72 / 1.87 s
  - trips: 1.73 / 2.20 / 1.97 s
  - end: 1.72 s
  - day 1.37 s; go 1.0–1.2 s
- **Against the reels.** The plan measured four Higgsfield reels with no whole-frame still longer than 0.57 s ("nothing stalls"). The metrics differ: ours counts a slow push as still.
- **By eye.** The strips show it:
  - `stills/16x9/wayfinch-16x9-strip-every-0.4s.png` f192–f288: the send bar sits unchanged for ~1.6 s before the cursor arrives.
  - The fan and the exploded stack barely move once landed.
- **Why it passes QA.** QA calls these INFO, because the dead-air allowance is the reading time (2.3 s for the fan).
- **Fix.**
  - press: give the wait a job: type the `send` label in, move the cursor in earlier, or set `at` from the shot start. Its default (`D − 10`) leaves ~55 % of a 3 s shot idle.
  - fan, exploded: a second beat in the hold (chip pulse, slow orbit ≥ 2 %/s).
  - deadair: report "longest still" against 0.6 s as well as the reading allowance.

---

### 12 · LOW · A carry combined with a flood or dive on the same cut isn't linted, and the carried box pops
- **Repro.** `bash $T/mk.sh combo1 $T/s4.yaml` (prompt: `out: dive` + `carry`; float: `out: flood` + morph), then `--film --aspect 16x9 --range 126,330 --workers 2`. Sheets: `$J/rvo-stills/combo1-cut150.jpg` and `combo1-cut300.jpg`.
- **Seen.**
  - The flood (OVL is above CARRY) hides the source card from cut−14. At the cut a grey morph box appears from nothing (see finding 5).
  - On the dive cut, the dive is invisible under the screen-space carry, and the two looks are stretched onto one box (prove F1).
  - `--grid` only says "4 transition types".
- **Fix.** `crossCutChecks`: warn on `carry` + `out: dive|flood` on one shot, or draw CARRY above OVL during a flood.

### 13 · LOW · `press at:` past the shot is clamped silently, and the warning quotes the clamped frame
- **Where.** `engine/blocks/press.js:13–14` (`at = min(D − 4, …)`), `:67`.
- **Repro.** `bash $T/mk.sh bad1 $T/s3.yaml` (shot `p`: `at: 500` in a 6-beat shot).
- **Seen.** `! press p: the press at 86 leaves no frames for the rings before the cut`. The user wrote 500.
- **Fix.** "press at 500 is past the shot (90 frames): pressing at 86".

### 14 · LOW · `--init --kit launch15|launch30` tells the user to "un-comment the bg: lines"; the launch templates have none
- **Where.** `lv.mjs:490`. The header help (`lv.mjs:5–8`) still explains only reel / film.
- **Repro.** `node $S/lv.mjs --job $J/rvo-init15 --init --kit launch15 --title 'Zoë & Co: "Notes"'`. The title quoting itself works.
- **Fix.** A kit-specific `next:` line and a header line (docs report §3, items 1–2).

### 15 · LOW · The GUIDE's needle example pushes the float tag out of the 9:16 safe area
- **Where.** `GUIDE.md` → Transitions that cross the cut → **Needle**: `zoom: 1.15` on the `again` shot.
- **Repro.** `/usr/bin/python3 -I $T/guide-sb.py 9x16` (every GUIDE example → `$J/rvo-guide-NN`, storyboard 9:16). All 5 build (rc 0).
- **Seen.** Example 04: `! text outside the platform-UI-safe area: again "POSTED"`. In `$J/rvo-guide-04/out/main/9x16/board/02-again.png` the card spans the full width and the brackets are clipped at both edges.
- **Fix.** `zoom: {16x9: 1.15, 1x1: 1.1}` in the example, or a note.

### 16 · LOW · The templates and the GUIDE keep the `out: flood` + `from: control` pairing the sample replaced
- **Seen.**
  - `$J/prv-stills/launch15-16x9-flood-final.jpg`: cut−4 … cut−1 are solid black, then the card pops in full-size at the bar's centre. The source is under the flood, so "grows out of the bar" can't be seen (prove F4, sample F6).
  - The sample switched to `from: cursor`. `templates/launch15.yaml` / `launch30.yaml` and the GUIDE's "Flood, and growing from a point" example still use `from: control`.
- **Fix.** Use `from: cursor` in both templates and the GUIDE example, or have `--grid` give an INFO on `from:` after `out: flood`.

### 17 · LOW · Fan: SFX pops for cards 9:16 never draws
- **Where.** `engine/blocks/fan.js:70–75`: `cues` uses the full `count`, while `build` shows only the middle 3 on 9:16 (`half = min(1, …)`).
- **Repro.** `node -e "import('$S/engine/blocks/fan.js').then(m=>console.log(JSON.stringify(m.default.cues({id:'f',i:1,cards:[1,2,3,4,5,6,7],count:7},180))))"` prints pops at 7, 10 and 13 (tiers 1–3). On 9:16, tiers 2 and 3 don't exist.
- **Fix.** The soundtrack is shared across aspects, so either drop the outer-tier pops when the film has a 9:16 aspect, or keep them only for tiers ≤ 1.

### 18 · LOW · Fan with fewer distinct cards than its count repeats one picture side by side, with no warning
- **Repro.** `bash $T/mk.sh bad1 $T/s3.yaml`, shot `f`: 1 card, `count: 9`.
- **Seen.** No warning: all nine cards show the same picture. `wall layout: grid` warns on the same case.
- **Fix.** Warn when the distinct cards are fewer than the cards visible (3 on 9:16, `count` elsewhere).

### 19 · LOW · Plan items delivered only in part (deferred, but not called out as gaps)
- **Frame checks.** The plan says "WARN first, then FAIL once calibrated on our sample films and **these reels**". No report ran them on the four reels, and none is promoted. B-verify #11 still holds (reading time warns on 34 / 63 old-job shots).
- **Grow from a point.** It doesn't work on the round-1 modes: `wall layout: grid` and `stack mode: exploded` warn "from: does nothing". Those are exactly the "pick the winner" and "how it's built" results.
- **`ctx.origin` in clean `--clips` / `--layers`.** Cards still grow out of the previous shot's element, which isn't in the clip (docs Ask 2, undecided).

### 20 · LOW · The review sheet doesn't describe cross-cut arrivals
- **Where.** `lib/sheet.mjs` `onScreen` (sample F7). The `day` row says the card "flies in from the left with a speed streak", but it is carried in with no streak. The `trips` row doesn't say the fan grows out of the cursor.
- **Fix.** Read `carry`, `from:` and dive entry when describing the landing shot.

### 21 · LOW · The 16:9 exploded headline touches the iso planes (sample B3)
- **Where.** `engine/blocks/stack.js` `buildExploded`: headline `maxW: W * .34` vs the planes' projected left corner at ~.35 W.
- **Seen.** In `$J/mrg-kit-dev/kit-dev-storyboard-16x9.png`, shot 11, "layers." ends at the top plane's corner. The sample had to shorten its headline.
- **Fix.** Covered by finding 9's fix: cap `maxW` at the planes' projected left corner.

---

## What I checked and found sound

- **Old jobs vs the live tool, cloned.**
  - `reel-dev`: storyboard heroes 24 / 24 byte-identical across 16:9, 9:16 and 1:1. The composite `storyboard.png` differs by design.
  - `--clips s3 --alpha --aspect 9x16`: the ProRes `.mov` is byte-identical (`cmp`), and so is the framemd5.
  - `film-kit-dev` fails identically on both tools (a pre-existing custom-block layer clash).
  - Logs: `$J/rvo-old-*/sb.log`, `clips.log`.
- **`shots.py` phase 2.** 20 adversarial specs (`scratchpad/shotprobe/probe.py`): wrong types, empty entries, eye beats backwards, a string where a list belongs, CJK and all-caps fail lines, negatives confirmed without being proposed. Each wrong type is refused in one clear line and the prompt keeps the rest. The only odd output is `fail: ["when"]` → "If when, the shot is wrong." (harmless). QA 5 passes 48 / 48.
- **Validation.**
  - Enums, `carry` / `dive` / `flood` keys, `signature`, `cause` types and `type every: 0` all give clear one-liners.
  - Missing optional layers (`dive: {el: text}` on a press without text) stop the storyboard build with a clear message.
- **GUIDE examples.** All 5 build storyboards on 9:16 (`$T/guide-sb.py`; the docs agent only ran `--grid` and 16:9).
- **Performance of the new blocks** (`--workers 1`, screenshots included):
  - particles: 4000 dots 0.27 s/frame, 900 dots 0.22 s
  - wall grid: 12 × 12 0.42 s/frame, 6 × 4 0.45 s
  - Screenshot encoding dominates, so no block-level trap. `$J/rvo-perf/film.log`.
- **Hygiene.**
  - No key or secret in the stage.
  - No 8-word sequence shared between the stage's docs, blocks, `runtime.js`, `qa.mjs` or `shots.py` and the cinedance SKILL.md or `readers/*.md`.
  - The sample's assets are its own generated SVGs; no reel stills and no private footage.
  - Two notes:
    - `kit-dev` / `prv-kit-dev` (test jobs only, not the skill or the sample) use astronaut stills.
    - My own GUIDE storyboards read the docs agent's `doc-kit` assets.

## Plan coverage (TAKE-AND-HOW §3), item by item

| Item | Delivered | Notes |
|---|---|---|
| press · fan · particles · map | yes | #2, #6, #11, #17, #18 |
| wall `layout: grid` + clash warning | yes | |
| type word beats | yes | Words don't snap to the beat grid when `every` is left at D/n with an odd split |
| stack exploded | yes, broken on 9:16 | #1, #9, #21 |
| Defaults (expo-out .5 s from .96 + 8 px; staggers 2–4 f; overshoot on chips only) | yes | |
| Dead air · readable text (floors + `delivery:`) · contrast (WCAG + APCA) · flash · reading time · purity | yes, all WARN | #10, #11, #19 |
| Carry · needle · dive · morph · `from:` · flood | yes | #2–#5, #8, #12, #16 |
| Cut continuity · cut stills · transition lint (types + `cause:` on the storyboard) | yes | #20 |
| Shot writer phase 2 · brief passport + trigger map · 15 s / 30 s skeletons as `--init --kit` | yes | Suites red on parity (#7); #14 |
