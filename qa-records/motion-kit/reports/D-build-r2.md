# Worker D, round 2: cut checks (build report)

2026-10-26, overnight build. Staging copy: `qa/motion-kit/stageD/product-launch-sting` (pre-round-1 base). Nothing was
committed or pushed. The live skill, `base/`, `live-before/`, `stage/` and the other workers' copies were not touched, and
no original job was rendered. No paid API calls.

## Status

All four pieces work and are proven both ways:

| Piece | State |
|---|---|
| Camera log per frame → `cams.json` | Done. Merges on `--range`. Frames and storyboard heroes are byte-identical to the base engine. |
| `continuity` QA check (WARN / INFO) | Done. Quiet on film-sample, steady-sample and reel-sample. Fires on a planted probe film and on a planted `cams.json`, including the "pushes in, then starts zoomed in and pulls back" flip and the `cam.carry` path. |
| Cut stills on the review sheet | Done. Frames cut−1 · cut · cut+1 per cut, with the continuity verdict. Built from the PNG frames, or from the mp4 when the frames are gone. Stills-only sheets say why there are none. |
| `cause:` under the storyboard frame | Done (also shown in the review sheet's facts). |

**The number to know first:** the engine's own exit → entrance pairs slow down **1.9–2.6×** across the cut, which is
over the research's "about 2×". Whips measure 2.0–2.2×, zoom-in 2.1×, zoom-out 2.6× and blur 1.9–2.0×. Every moving cut
in every old film is over 2×. So I put the WARN at **3×** and the INFO line names each cut over 2× (decision 1 below).

## What changed, file by file

Every diff is additive and local, to keep the three-way merge clean.

| File | Change |
|---|---|
| `video/lib/render.mjs` | `renderFrames` calls `LV.camera()` right after every `LV.seek` and returns `cams[]` (3 lines). It passes through whatever `camera()` returns, so a future `carry` key comes along without further changes. |
| `video/lv.mjs` | `--film` writes `out/<cut>/<aspect>/cams.json` (one entry per 60-fps frame) next to `shots.json`. It is merged for `--range` exactly like `shots.json` / `pages.json` (4 inserted lines after the `shots.json` write). The `--sheet` message now lists `cuts/` among the files to publish. The `qaFilm(...)` call and the `P()` paths line are **not** touched: qa.mjs reads `cams.json` from `dir` itself. |
| `video/lib/qa.mjs` | New `CONT` constants, plus `cutContinuity({tl, cams, W, H})` and `continuitySummary(C)`. They are inserted between `onsetFinder` and `const TOL`. `qaFilm` gets 4 lines after the `cut` loop: one INFO summary (the per-cut numbers go to `qa.json` as `results[].cuts`), then one WARN per problem. The header comment gains 2 lines. No existing check, threshold or PASS count changed. |
| `video/lib/sheet.mjs` | New `cutStills()`. For each cut it writes half-size JPEGs of frames cut−1, cut, cut+1 to `review/<base>/cuts/<frame>.jpg`. The source is the film's PNG frames when `mux.json`'s prints equal `render.json`'s; otherwise the frames are decoded from the mp4 (frame-exact, see below). A one-line continuity verdict comes from `qa.json`. Each row also gets `cause` and `cut: {at, into, out, stills, cont}` in `sheet.json`. Stills mode deletes `cuts/` and sets `stills: null`. |
| `video/lib/sheet.html` | (the sheet's template; nobody else owns it) Adds CSS for `.cutrow` / `.cutstills`. Each non-last shot row gets a full-width "Cut into X · exit · frame N (60 fps)" strip of 3 stills, each captioned `cut−1 · 986 · brief`. Clicking a still seeks the proxy to that frame. Below the strip sits the verdict line, in the mark colour when QA warned. Without a film the strip says "Cut stills … come with the film: run --film, then --sheet." The row also gets a `Cause` fact. 9:16 strips are capped at 480 px wide. Checked at 1440 px and 390 px wide: no horizontal scroll. |
| `video/lib/board.mjs` | The storyboard card prints `cause` under the `out →` line, styled like `note` but in a violet tint and labelled **cause** (1 template line + 1 CSS line). |

## How the continuity check measures

- **Camera log.** `cams.json[i]` = `LV.camera()` at 60-fps frame `i` = `{blur, s, x, y}`: the shot camera's scale and its
  translation about the frame centre (`transform-origin` is the centre). It is a pure function of `f`, and the order frames
  are drawn in doesn't matter.
- **Per camera step** (frames `i−1 → i` of one shot), with `q = s_i / s_{i−1}`:
  - zoom `z = ln q · 60` (per second);
  - pan `v = (x_i − q·x_{i−1}, y_i − q·y_{i−1}) · 60 / u`: how far the content under the frame centre moved, in px at a
    1080-px short side;
  - speed = |pan| + |z| × the half diagonal: the frame's fastest point.
- **Per cut** (60-fps index `c` = the first frame of the incoming shot):
  - **(1) Direction.** Zoom, x and y keep their sign between the outgoing shot's last step (`c−2→c−1`) and the incoming
    shot's first step (`c→c+1`). Each component counts only when both sides pass 0.3/s (zoom; the research's own
    threshold) or 120 px/s (pan).
  - **(2) Speed.** The ratio of those two speeds is ≤ `CONT.ratio` = 3. When one side stands still, the WARN shows `∞`.
  - **(3) Peak.** No step within ±6 frames (inside each shot) is more than 5 % faster than those two.
  - A cut is checked only when some step within ±6 frames reaches 400 px/s. A plain `cut` into the engine's default 4 %
    settle measures 300 px/s and stays out.
- **Carry** (`cam.carry`, read when present; `cams[c]` may hold an object or a list of objects):
  - The same three rules apply to the clone's centre (`x + w/2`, `y + h/2`) and to its size (`ln w`, `ln h`, signs per
    axis). The speed adds half its size change.
  - Because the clone is one object on both sides, before/after are `c−2→c−1` and `c→c+1`. The step that ends on the cut
    (`c−1→c`) must be the fastest, which is the research's needle (peak on (T−1,T)).
  - A needle one frame late gives one peak WARN ("1 frame late"), not a second ratio WARN.
  - Unit test with the research's exact shape (keys at cut−0.2 s / cut+0.2 s−1f, bezier(.95,0,.05,1), ×1.12): speeds
    `…90 183 659 183 90…` with the peak on `59→60`. Result: holds. With the keys moved +1 f or +2 f it warns.
- **Output.**
  - One INFO line per film: cuts, how many moved, ratio range, the cuts over 2×, and any cuts with no camera data (a
    `--range` over a film rendered before this feature).
  - One WARN per problem, naming both shots, the numbers and the fix.
  - Per cut, `qa.json` holds before/after `{z, vx, vy, v}`, flips, ratio, peak `{step, v, onCut, off}`, and the speed list
    over ±6 steps (the research's "speed lists").
  - With no `cams.json` the INFO line reads "no camera log … re-run --film".

## Decisions I made (Alex asleep; please confirm or overrule)

1. **Ratio WARN at 3×, not 2×.** Measured from the logged camera:

   | Pair | Ratio |
   |---|---|
   | whip-left / right | 2.24× |
   | whip-up | 2.01× |
   | zoom-in | 2.07–2.08× |
   | zoom-out | 2.62× |
   | blur | 1.87–1.99× |

   - A 2× WARN would fire on nearly every moving cut of every approved film and would teach users to ignore the check.
   - At 3× the check catches stalls (a hold from frame 0 shows ∞), mismatched pans (3.1×) and still-to-moving jumps (31×).
   - The INFO line keeps the "over 2×" list visible.
   - If C's new transitions are speed-matched by design, the lead could apply 2× to `dive` / `carry` cuts only. It is one
     constant (`CONT.ratio`).
2. **Speed = the frame's fastest point** (|pan| + |zoom| × half diagonal), so zoom and pan compare in one unit. The
   direction signs are checked per component.
3. **"Moving" means any step within ±6 frames ≥ 400 px/s.** I first gated on the two steps beside the cut, but a needle 2
   frames late then slipped through (unit test case 6), so I widened the gate.
4. **"A step touching the cut":**
   - For the camera, these are the outgoing shot's last step and the incoming shot's first step. The step across the cut
     joins two different cameras and means nothing.
   - For a carry, it is the step that ends on the cut (the research's needle rule). That is stricter than "either step
     touching the cut frame", but a needle peaking on `c→c+1` reads one frame late.
5. **`cam.carry` contract (assumed):** `{x, y, w, h}` = the clone's screen rectangle in stage px, top-left + size
   (DOMRect-style), or a list of them, present on the frames the clone is drawn. Worker C's copy had no carry code yet when
   I looked. If C emits a centre instead of the top-left, change `carryStep` in qa.mjs (2 expressions).

## Commands and results

All runs used `node …/stageD/product-launch-sting/video/lv.mjs` with `--workers 2`. Jobs are in `qa/motion-kit/jobs/`
(clones made with `cp -c`, beats.yaml + assets only). Logs are in `jobs/D-logs/`, and every job's final `--qa` output
is in `jobs/D-logs/final-qa.txt`.

### Good jobs stay quiet: QA PASSED, no continuity WARN

```
D-steady 16x9 (steady-sample)  INFO continuity 6 cuts, 5 with camera motion … — all hold; speed ratios 2.0–2.6× (over 2×: s1→s2 2.07×, s2→s3 2.24×, s3→s4 2.01×, s5→s6 2.62×, s6→s7 2.63×)   QA PASSED (12 checks)
D-steady 9x16                  (same numbers)                                                                                                                QA PASSED (12 checks)
D-film 16x9 (film-sample)      INFO continuity 11 cuts, 6 with camera motion … — all hold; speed ratios 1.9–2.6× (over 2×: open→name 2.08×, brief→team 2.62×, team→scan 2.02×, command→wall 2.62×)   QA PASSED (16 checks)
D-reel 9x16 (reel-sample)      INFO continuity 7 cuts, 5 with camera motion … — all hold; speed ratios 2.0–2.2× (over 2×: s1→s2 2.23×, s2→s3 2.24×, s4→s5 2.08×, s5→s6 2.01×, s7→s8 2.24×)   QA PASSED (13 checks)
```

Other film-sample aspects (9x16, 1x1) were not rendered. The machine was shared (load ~22), and the ratios are
aspect-independent (moves are fractions of W/H): steady 16x9 = 9x16 to the hundredth.

### Bad jobs fire, part 1: real renders

`jobs/D-probe-cont/` has 6 headline shots, 16x9 + 9x16, and `cause:` on two shots. Each pair plants one fault through
existing fields only:

| Plant | Fields |
|---|---|
| a1→a2: direction flip | a1 `out: whip-left`; a2 `pan: [{at: 0, by: [0.3, 0], len: 8}]` (pans right from its first frame) |
| a2→a3: move dies on the cut | a2 `out: zoom-in`; a3 `hold: [0, 20]` (camera frozen from frame 0) |
| a4→a5: peak off the cut | both `move: [-0.3, 0]`; a5 also has `pan: [{at: 2, by: [-0.12, 0], len: 8}]`, which peaks 4 frames in |

`--film --aspect all` gives QA PASSED (13 checks) on both aspects, so no existing check fails. The 16x9 run:

```
INFO  continuity 5 cuts, 5 with camera motion checked for direction, speed (≤ 3× across the cut) and the fastest step on the cut — 4 WARN; speed ratios 1.8–3.1× (over 2×: a4→a5 2.63×)
WARN  continuity a1→a2 at 120 (whip-left): the move flips direction on the cut — x −9835 px/s → +3169 px/s; keep the sign across the cut
WARN  continuity a1→a2 at 120 (whip-left): speed 9853 → 3189 px/s across the cut (3.09×, over 3×) — a2 starts 3.09× slower than a1 leaves
WARN  continuity a2→a3 at 240 (zoom-in): speed 3181 → 0 px/s across the cut (∞×, over 3×) — a3 stands still on its first frames (a hold from its first frame, or a camera move that starts later?)
WARN  continuity a4→a5 at 480 (cut): the fastest step is 3 frames after the cut (frames 483→484, 3940 px/s vs 1538 px/s on the cut) — a move across a cut peaks on the cut
QA PASSED (13 checks)
```

9x16 shows the same 4 WARNs (x −5532 → +1783 px/s, 3.08×, ∞×, peak +3 f).

The first version of this probe used much bigger pans. That pushed the text off-frame and made the existing `content` /
`text` checks FAIL. I shrank the pans and added `offset:` so the probe trips only the new WARNs.

### Bad jobs fire, part 2: planted `cams.json`

The "push-in, then starts zoomed in and pulls back" flip can't be built from today's fields. Camera `zoom` is static,
`push` and `drift` can't reverse an entrance, and C's dive isn't in this copy. Carries don't exist here either. So:

- `jobs/D-probe-flip/` is a `cp -c -R -p` copy of D-probe-cont, so the prints still match and `--qa` runs. The renderer's
  own log is kept as `out/main/16x9/cams.rendered.json`.
- In `out/main/16x9/cams.json`:
  - a3's first 60 frames get `s = 1 + 0.8^(t/2)` (starts ×2, settles to 1). This is the dive flip.
  - A carry rectangle is planted around cut 480: a good needle, steepest on `479→480`.
  - A carry rectangle is planted around cut 120: a bad one, with the centre peaking 3 frames late and the size growing
    into the cut and shrinking after it.

`--qa --aspect 16x9` gives:

```
INFO  continuity 5 cuts, 5 with camera motion + 2 carried objects checked … — 6 WARN; speed ratios 1.0–3.1×
WARN  … a1→a2 at 120 (whip-left): the carried object's move flips direction on the cut — width +1.20/s → −1.80/s, height +1.20/s → −1.80/s; keep the sign across the cut
WARN  … a1→a2 at 120 (whip-left): the carried object's fastest step is 3 frames late (frames 122→123, 7058 px/s vs 3731 px/s on the cut) — a move across a cut peaks on the cut
WARN  … a2→a3 at 240 (zoom-in): the move flips direction on the cut — zoom +2.89/s → −3.25/s (a2 pushes in, a3 starts zoomed in and pulls back); keep the sign across the cut
(+ the 3 camera WARNs at 120 / 480 from the probe; the good needle carry at 480 adds nothing)   QA PASSED (13 checks)
```

Also proven:

- **No `cams.json`** (9x16 log hidden): "INFO continuity no camera log … re-run --film", QA PASSED.
- **`--range` merge:** `--film --range 120,239` on D-probe-cont leaves `cams.json` byte-identical to the full render's,
  with the same WARNs.
- **Unit test:** `reports/D-r2/unit/cont-unit.mjs`, output in `cont-unit.out.txt`. It covers the zoom flip, a matched
  push-through (holds), good and bad carries, the research needle at 0 / +1 / +2 frames, a partial log, and no log.

### Old renders unchanged

- **Frames byte-identical.** `--film --range 150,330 --aspect 16x9` (two cuts) ran in two fresh steady clones, once with
  the base tool (`D-bytes-base`) and once with stageD (`D-bytes-stage`).
  - 181/181 frame PNGs and 181/181 bgref PNGs are `cmp`-identical.
  - `--storyboard --aspect all` hero PNGs (`out/main/<aspect>/board/0N-*.png`) are identical, 14/14.
  - The assembled `storyboard.png` differs by ≤ 7 code values in 16 rows. That is page-raster noise: base against base,
    run twice, differs as well.
- **Existing QA lines identical.**
  - The base tool's `--qa` and stageD's `--qa` were run on the same rendered frames of D-steady 16x9 and 9x16, D-film
    16x9 and D-reel 9x16.
  - Every PASS / FAIL / INFO / WARN line matches (18, 18, 24 and 20 lines). The only addition is the `continuity` INFO
    line.
  - QA PASSED counts are unchanged.
- **Other modes.**
  - `--clips a6 --alpha` on the probe passes clip QA.
  - `--layers a6` passes layer QA (stack 0 px > 16).
  - `--storyboard` notes are identical between base and stage.

### Cut stills and the mp4 fallback

- `--sheet --aspect 16x9` on D-film writes 33 stills (632 KB) to `review/orbit-film-16x9/cuts/`. D-steady, the probe
  16x9 / 9x16 and a `--stills` sheet were built too.
- **mp4 fallback.**
  - I hid the frames folder of D-probe-flip and rebuilt its sheet.
  - The stills decoded from the mp4 match the PNG-path stills at PSNR 48–52 dB, which is compression only.
  - A wrong frame scores ~25 dB. My first version seeked to `(i + 0.5)/60` and got frame `i+1`; it now seeks to
    `(i − 0.5)/60`.

## Stills for the lead to look at

All are in `qa/motion-kit/reports/D-r2/`. The scratchpad copies will be wiped.

- `film-sample-sheet-brief-team.png`: the real film's sheet, rows brief → team (zoom-out, 2.62×) and team → scan
  (whip-up, 2.02×). `film-sample-sheet-full.png` is the whole page.
- `probe-sheet-16x9-a1.png`, `probe-sheet-16x9-a4.png`: flagged cuts in the mark colour, with the `Cause` fact.
- `probe-sheet-9x16-phone-a4.png`: 390 px wide, 9:16 stills.
- `probe-sheet-9x16-stills-only.png`: the no-film message.
- `probe-storyboard-16x9-cause.png`: the cause line under the storyboard frame.
- `steady-s2-s3-whip-cut-triptych.jpg`, `film-open-name-zoomin-cut-triptych.jpg`: cut−1 · cut · cut+1 side by side.

## What the cut stills show

These are design observations, not bugs in this build:

- **steady-sample s2→s3 (whip-left):**
  - The cut frame (300) is almost empty: only the left edge of s3's phone shows at ~96 % of the width.
  - Frame 301 is the same.
  - The research's "the incoming content must be on screen from the cut frame" fails here. The camera continuity holds
    (same direction, 2.24×), so this is a different defect.
  - A future "empty after the cut" check could compare the cut frame's content area to the hero frame's.
- **film-sample brief→team (zoom-out):** at the cut frame team's header is up but its roster card is still empty. It is
  the same class of issue, milder.
- **film-sample open→name (zoom-in):** a clean hard change of look. B starts at ×0.82 and grows, so it reads as one push.

## Open issues

- **Blind spots of the camera log:**
  - Motion inside a block is invisible to the log: `type through: true`, a custom block's own zoom, footage motion,
    stack / wall card flights.
  - So "flies in, then shrinks" built inside a block won't be caught.
  - A pixel-flow measure on the thumbnails could cover it later.
  - C's carry and dive are visible (the camera / `cam.carry`).
- **C's smooth carry will WARN** if its bell-shaped speed is centred mid-window. pre 8 / post 14 puts the peak about 3
  frames (30 fps) after the cut. C should centre the bell's peak on the cut, or the lead can exempt `ease: smooth` from
  rule 3 (one condition in `judge`).
- **Still → moving hard cuts WARN.** A hard `cut` from a still shot into one with a fast `move` / `pan` warns, e.g. 31×
  on an earlier probe version. That follows the rule ("speed is never zero at an event"), but editors do it on purpose.
  None of the three sample films has one. Watch for noise.
- **Pre-existing, not changed:**
  - The sheet's per-shot thumbnails seek to `(f0 + heroF)/30 + 0.5/30`, which lands on 60-fps frame `2·hero + 1`, one
    60-fps frame after the hero.
  - With `--stills` while a film exists, the stillnote still says "the film isn't rendered yet".
- **Merge hotspots with round-1 Worker B,** who edits the same files:
  - render.mjs: the `cams[k] = …` line right after `log[k] = …`, and the `return {…}` line (B may add keys there).
  - qa.mjs: the 4 lines after the `cut` forEach, the 2 header-comment lines, and the block before `const TOL`.
  - lv.mjs: the 4 lines after the `shots.json` / `pages.json` write.
  - board.mjs: the card template line before `note`.
  - All of them are additions; any conflict resolves by keeping both sides.
- **Jobs on disk:** `jobs/D-film` (2.2 GB), `D-reel` (1.3 GB), `D-steady` (0.6 GB), `D-probe-cont`, `D-probe-flip`,
  `D-bytes-*`. They are safe to delete once reviewed. Keep `D-probe-cont` + `D-probe-flip` as regression probes.

## GUIDE text I'd add (the lead writes the docs)

**QA → `continuity` (WARN/INFO).**

> Every `--film` logs the camera on every frame (`out/<cut>/<aspect>/cams.json`). For each cut where something moves
> (≥ 400 px/s within 0.1 s of it), QA checks three things:
>
> - the zoom and the pan keep their direction across the cut, so a push-in never meets a shot that starts zoomed in and
>   pulls back;
> - the speed changes ≤ 3× from the outgoing shot's last frame to the incoming shot's first;
> - the fastest frame is on the cut.
>
> A carried object (`carry:`) is checked the same way on its own rectangle, and its fastest step must be the one that ends
> on the cut. The INFO line lists every cut over 2× (the built-in whips and zooms sit at 2.0–2.6×); the numbers per cut,
> with a speed list over ±6 frames, are in `qa.json`. A WARN names both shots and the fix:
>
> - **"stands still on its first frames":** a `hold:` from frame 0, or a camera move that starts late;
> - **"flips direction":** a `pan:` against the exit;
> - **"fastest step N frames after the cut":** a `pan` whose `at:` is past the cut.
>
> Moves inside a block (`type through`, a custom block's own zoom) aren't in the camera log; judge those on the cut stills.

**Review sheet.**

> Each shot's row now ends with the cut into the next shot: frames cut−1, cut and cut+1 from the film (60-fps indices,
> half size, click to seek), each tagged with its shot, and the continuity verdict (orange when QA warned). Publish
> `cuts/` with `index.html`, `film.mp4` and `thumbs/`. A `--stills` sheet has no cut stills: it says so in each row.

**Storyboard / beats.yaml (`cause:`, field from C).**

> `cause: the cursor clicks Generate` names what on screen makes the transition happen. It prints under the shot's
> storyboard frame and in the review sheet, and never changes a pixel.

---

## Fix pass (2026-10-26, after the monitor's report `reports/D-monitor.md`)

Same rules as the build: only `stageD/product-launch-sting` was edited, nothing committed, no original job rendered, no
paid calls. Pre-fix copies of my six files are in `reports/D-fix/pre/`. New evidence is in `reports/D-fix/` (tools, unit
cases, camera logs, stills) and `jobs/D-logs/fix/` (every run's log).

**Counts:** 13 findings. HIGH 1/1 fixed. MEDIUM 3/3 fixed (2 and 3 are contract choices the lead should confirm). LOW:
7 fixed (5, 7, 8, 9, 10, 11, and 13's predicate and whitespace parts), 1 recorded only (6: file ownership), 1 needed no
fix (12: coverage, extended), 1 part kept on purpose (13: the one-line merge conflict with B).

### Per finding

| # | Sev | State | How | Proof |
|---|---|---|---|---|
| 1 | HIGH | fixed | The incoming shot's ±6-frame window now stops where its own exit ramp starts (`bx = B.f1·2 − 2·exitLen(B.out)`, `exitLen` from kit.js, so C's `DIVE_LEN` applies after the merge). The ratio rule runs only when one side of the cut moves (≥ 400 px/s). This is the monitor's diff. | manus2-film and manus2-space S20→S21: 2 → 0 WARN. `D-fp` (my clone of the monitor's probe) `--qa`: 16x9 and 1x1 both 0 WARN, QA PASSED. Unit case 9. The planted probes keep every WARN (table below). |
| 2 | MED | fixed | The ratio limit now depends on the move. Speed-matched moves get 2× (`CONT.matched`): `out: dive` and every carried object. The built-in whips, zooms, blur, drifts and cross-cuts keep 3×. Each judged record stores its `limit` in qa.json, and a WARN reads "(2.5×, limit 2×)". | Unit 1: a dive with a 2.5× drop WARNs. Unit 2: the same speeds after `zoom-in` hold. Unit 3: a carry at 2.5× WARNs. Unit 4: a carry at 1.4× holds. Merged C+D r2-dev, all 3 aspects: dives 1.21–1.22× and carries 1.01–1.07× hold. **Lead:** 3× for the legacy transitions is still a deviation from SPEC-R2's "≤ 2×". |
| 3 | MED | fixed (option b) | When the cut is a drift and the shot sets `drift.out` (A) or `drift.in` (B), the speed change is the author's choice. It moves to the INFO line, for example "set by tuned drift strengths (drift: in/out), not warned: a→b 3.15×, b→c 14.07×". Direction flips and off-cut peaks on those cuts still WARN. | hf02-skill, all 3 aspects: 2 → 0 WARN, both cuts named in INFO. Unit 10: tuned, quiet. Unit 11: the same cut at default strengths WARNs. Unit 12: a tuned drift that flips still WARNs. |
| 4 | MED | fixed differently | Each cut now writes **one** JPEG holding the three half-size frames side by side, 8 px apart, saved as `thumbs/cut.<frame>.jpg`. A shot id can't contain a dot, so it never collides with `thumbs/<id>.jpg`. The GUIDE's current publish recipe ("index.html, film.mp4, every thumb") therefore ships them unchanged, and the GUIDE is no longer a merge blocker. Each tile shows its third with `object-fit: cover` plus `object-position` 0 / 50 / 100 %. The tile outline is a 1 px ring (`box-shadow`), not a border. With a border, the page's `box-sizing: border-box` skewed the aspect ratio and showed a 1–2 px sliver of the next frame; I saw it on the first screenshot and fixed it (`stills/open-row-edge-zoom.png`). If the file is missing, `onerror` removes the strip and the verdict line stays. The `--sheet` message is back to the base wording. File count per sheet is now shots + cuts + 2, where it used to be shots + 3·cuts + 2. | Published-files simulation (preview + film.mp4 + thumbs/ only, in a fresh folder): 15/15 cut tiles load, 0 broken, no page errors. With the cut files left out: 0 strips, 0 broken images, all 3 WARN verdict lines kept. Film-sample sheet: 11 cut files (was 33), 33/33 tiles loaded, no horizontal scroll at 1440 px. A 9:16 sheet at 390 px also has no horizontal scroll. |
| 5 | LOW | fixed | A side under 100 px/s (`moving/4`) counts as at rest. It gets no ratio, and the text reads "from rest" / "to rest". When neither side reaches 400 px/s, no ratio is judged (part of fix 1). The INFO range only uses real ratios. | Unit 13: 1 → 450 px/s reads "(from rest, limit 3×)" and shows no ratio. manus2 INFO range went from 1.1–438.6× to 1.1–2.6×. The D-probe-cont hold WARN now reads "3181 → 0 px/s (to rest, limit 3×)". |
| 6 | LOW | recorded | `lib/sheet.html` has to change for the cut strip. No other copy edits it: stage, stageA, stageB, stageC and stageS are byte-equal to base for sheet.html, and for render/qa/board/lv everywhere except B. | Add it to Worker D's file list in the merge plan. |
| 7 | LOW | fixed | The zoom term uses one reference radius on every aspect: `CONT.R` = half-diagonal of a 16:9 frame (1101.4 px at a 1080 short side). A pure zoom now measures and gates the same on 16:9, 9:16 and 1:1. Pans stay in px, because they are fractions of W/H and really differ by aspect. | film-sample 1x1: 4 → 6 cuts checked, now equal to 16x9 and 9x16. No WARN appears on any of the 33 old logs. |
| 8 | LOW | fixed | A still from the outgoing shot seeks to `(floor(f/2)+.25)/30`; one from the incoming shot seeks to `(ceil(f/2)+.25)/30`. | Real browser clicks on film-sample open→name (odd cut 145): cut−1 → 2.4083 s = proxy frame 72 = 60-fps frame 144 (open). cut and cut+1 → 2.4417 s = proxy frame 73 = frame 146 (name). Screenshots of the video element: `reports/D-fix/stills/seek-open-name-cut145.png`. By ffmpeg frame index, proxy 72 matches frame 144 at 44.7 dB and proxy 73 matches frame 146 at 46.3 dB. |
| 9 | LOW | fixed | A carry is now listed when it has a rectangle at cut−1 **or** at the cut. One that ends on the cut gets the half-before check: its last measured step must be its fastest. The record is `half: 'before'`, and INFO says "ends on the cut (the half before it checked)". A carry too short to check either way is named in INFO, so it is never skipped silently. | Merged C+D r2-dev go→end (`to: frame`, rectangle until 1160) is now checked on all 3 aspects and holds: accelerating, peak on 1159→1160. Unit 5: accelerating, holds. Unit 6: peaking 4 frames early, WARNs. |
| 10 | LOW | fixed | When the peak falls before the cut, and the outgoing shot only slows down from its first frame (every step ≤ the previous one, with 2 % slack), that is its entrance still settling. It gets `peak.settle` and goes to INFO ("still settling from its entrance (fastest 5 f before p3→p4), not warned"). The sheet says "(its entrance settling)". | D-fp p3→p4 (16x9 and 1x1): INFO, not WARN. Unit 7: quiet. Unit 8: the same shot with a pan bump still WARNs. |
| 11 | LOW | fixed | The camera is logged only on full-picture passes: `!bgOnly && !clean && !layer && !layerTree && !probe`. The film frames pass is still logged; bg-only references, clean clips and layer passes skip the evaluate. Only my own two added lines changed, so B's signature line and B's film-call line in lv.mjs stay untouched (no new conflicts). | `--film` on D-fp 16x9: cams.json byte-identical to the all-pass version, and 180/180 frames + 180/180 bgref `cmp`-identical to the **base** tool's render with the same page split (`D-fp-base`). `--range 120,239` on D-probe-cont: cams.json byte-identical after the merge. `--clips p3 --alpha` and `--layers p3` pass (the null-log paths). |
| 12 | LOW | no defect | Coverage added: a 1x1 film QA and sheet (D-fp), a 9:16 sheet at 390 px, all 33 saved camera logs rechecked, a merged C+D r2-dev survey on 3 aspects, and 13 synthetic cases. | `reports/D-fix/recheck-old-jobs.txt`, `reports/D-fix/unit/` |
| 13 | LOW | 2 of 3 fixed | **Predicate:** qa.mjs now writes `warn: ['direction' / 'speed' / 'peak']` on every judged record in qa.json. The sheet reads that list, so the verdict on the sheet is exactly what QA printed; sheet.mjs no longer imports `CONT`. **Whitespace:** `cause` sits on the note's template line, and board.html has 0 whitespace-only lines (was 4). **render.mjs `return` conflict with B:** kept. The only alternatives are changing the signature (also B's line) or mutating the caller's `frames`. Resolution: `return { log, pages, audits, fit, layers, probes, composited, cams, sigs, sigs2 };` | Trial `git merge-file` (base / stageD / stageB, scratch only): qa.mjs, lv.mjs, board.mjs, sheet.mjs, sheet.html clean; render.mjs has 1 conflict, that return line. Storyboard hero PNGs are identical before and after (6/6). |

### Re-run done criteria (after the fixes)

- **Good jobs quiet** (`--qa` with the fixed tool, on the existing frames):

  | Job | Result |
  |---|---|
  | D-steady 16x9 / 9x16 | QA PASSED (12) |
  | D-film 16x9 | QA PASSED (16) |
  | D-reel 9x16 | QA PASSED (13) |

  - The INFO numbers are unchanged from the build: film-sample 1.9–2.6×, steady 2.0–2.6×, reel 2.0–2.2×.
  - Every existing PASS/FAIL/INFO/WARN line is identical to the base tool's output for the same frames: 17, 17, 23 and 19 lines. Logs are in `jobs/D-logs/fix/*.lines` / `*.base`.
- **Bad jobs fire.**
  - `D-probe-cont` 16x9 and 9x16: the same 4 WARNs each.
  - `D-probe-flip` 16x9: the same 6 WARNs.
  - QA PASSED on all three.
  - Only the wording of the speed WARN changed: "(3.09×, limit 3×)", "(to rest, limit 3×)".
- **Old jobs** (`tools/recheck.mjs` on the 33 saved camera logs: 13 jobs, the S templates and the 17-transition matrix, every aspect):
  - 0 new WARNs anywhere.
  - Removed: hf02-skill 6 (tuned) and manus2-film / manus2-space 2 each (finding 1).
- **Unit tests.**
  - The round-2 cases (`reports/D-r2/unit/cont-unit.mjs`): every WARN line is identical; 5 INFO lines changed wording only.
  - The 13 new cases (`reports/D-fix/unit/cont-unit-fix.mjs`) all behave. 10 of them misbehave on the pre-fix code (`cont-unit-fix.pre-fix.out.txt`), so every rule is proven both ways.
- **Merged C+D** (stageC as of 12:00 + my six files, scratch copy):
  - Seek-only camera survey on r2-dev, 3 aspects: all hold.
  - Dives are judged at 2× (1.21–1.22×); carries at 1.01–1.07×; go→end's morph-to-frame is half-checked.
  - Real render: `--film --aspect 16x9` of a clone (`jobs/D-cd-r2dev`) gives QA PASSED (16 checks) with the same
    INFO line, 4 carried objects included.
  - The rendered `cams.json` is byte-identical to the seek-only survey log.
  - A `--range 1100,1200` re-render with the final (gated) render.mjs leaves that `cams.json` byte-identical, carry
    rectangles included.
    - Its mux step refuses to run because the range only partly covers go/end. That is the tool's existing
      partial-shot guard, not a fault.
    - `--range 1045,1276` restored the shots, and QA PASSED.
  - The sheet shows all 8 cuts with the carry verdicts ("1 carried object, continuous").
  - Stills: `stills/r2dev-merged-carry-and-morph-cuts.jpg` shows teaser→post (the carried card holds still across the
    cut) and go→end.
  - A design note for C / the lead: at go→end cut−1 the morph box covers ~96 % of the frame, so a light rim of the go
    background shows for one frame before the dark end card. That matches the spec ("fills the frame exactly on the
    cut").
- **Sheets rebuilt** with the new layout: D-film 16x9, D-steady 16x9, D-probe-cont 16x9 / 9x16, D-probe-flip 16x9, D-fp 16x9 / 1x1, plus a `--stills` sheet. The stale `cuts/` folders from the build were removed (my own outputs only).

### Stills to look at (`reports/D-fix/stills/`)

- `film-sample-sheet-full.png`: the whole film-sample sheet, with one triptych per cut.
- `film-sample-sheet-open-row.png`: the open→name row (zoom-in, odd cut 145). `open-row-edge-zoom.png` is a zoom on its
  tile edges, which are clean after the ring fix.
- `fp-1x1-sheet-full.png`: a 1:1 sheet.
- `seek-open-name-cut145.png`: what the player shows after clicking cut−1 (open) and cut (name).
- `probe-16x9-a1-row.png`: a flagged cut, verdict in the mark colour.
- `probe-9x16-phone-a4-row.png`: the 390 px phone layout.
- `probe-sheet-no-cut-files.png`: the sheet when the cut files weren't published (no strips, verdicts kept).
- `probe-storyboard-16x9-cause-row1.png`: `cause` under the frame.
- `fp-16x9-stills-only.png`: a `--stills` sheet.

### What the cut stills show (design notes, unchanged)

The film-sample brief→team triptych (`jobs/D-film/review/orbit-film-16x9/thumbs/cut.00987.jpg`) still shows the defect
noted in the build. On the cut frame, team's header is up but its roster card is empty. The camera continuity holds
(2.62×, zoom-out), so this is the "content must be on screen from the cut frame" rule. The camera log can't see it.

### GUIDE text (replaces the build's "Review sheet" paragraph)

> Each shot's row ends with the cut into the next shot: frames cut−1, cut and cut+1 from the film (60-fps indices, half
> size, side by side in one file per cut, `thumbs/cut.<frame>.jpg`; click one to seek the player into that frame's shot),
> each tagged with its shot, and the continuity verdict (orange when QA warned). They publish with the thumbs. A
> `--stills` sheet has no cut stills and says so in each row.

Add to the QA → continuity paragraph:

> The speed limit is 3× for the built-in transitions (their own exit → entrance pairs measure 1.9–2.6×) and 2× after
> `out: dive` and for a carried object. A drift cut whose `drift: {in, out}` is set by hand is reported, not warned, on
> speed. An insert still settling from its entrance and a carry that ends on the cut (a morph into the frame) are named in
> the INFO line.
