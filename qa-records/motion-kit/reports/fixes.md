# Fixes to the merged motion kit (`qa/motion-kit/stage`)

## Opus fixes (2026-10-27, after `reports/review-opus.md`)

**Bottom line.** Of the review's 21 findings, **18 are fixed** and **3 are fixed in part**; none is left untouched. Each fix is proven by a run, and the stills are in `jobs/fx-stills/`.
- **The three HIGH findings are fixed:**
  - A label past the plane count is no longer drawn.
  - A morph or carry out of press's `control` takes the button face plus its label, not the glow.
  - A cutdown no longer breaks the job.
- **Regression:**

  | Check | Result |
  |---|---|
  | `--grid` on clones of film-sample and steady-sample | Identical to the live tool apart from new `!` lines (the same ones the merge listed) |
  | film-sample storyboard heroes | 33 / 36 byte-identical with live; `10-wall` differs by max 2–3 in each aspect, the known wall noise (live run against live run: max 1) |
  | prv-combo `--film --aspect 16x9` | **QA PASSED (16)**, with the same WARN set as prove's run |
  | Shot-writer suites against the stage | **ALL SUITES PASS** |

- **Fixed in part (the unflattering part):**
  - **#8 (dives).** Text now arrives with a dive. A title's spring or an end card still arrives small, and only `dive.from` under .2 warns.
  - **#9 (9:16 iso).** The stack no longer clips, and its chips sit right of the planes. It still uses only ~60 % of the room under the headline, because the frame's width limits its scale.
  - **#19 (plan items delivered in part).** I decided `ctx.origin` for clean exports. I did not calibrate the frame checks on the four reels or promote any to FAIL, and I did not make `from:` work on wall grid or exploded.
- **The sample job wasn't re-rendered.** I'm not the sample agent, so I measured a clone instead (`jobs/fx-sample`). Its mp4s and stills predate these fixes, and its `beats.yaml` comments still name two bugs that are now fixed (the press morph and the 9:16 iso).
- **Six changes alter new-kit output.** Every one is opt-in through new blocks or round-2 fields, and old jobs are untouched (proofs above):
  - press `send` now types its prompt;
  - fan and exploded stacks have a glint in the hold;
  - the exploded layout is fitted, which moves prv-combo's 16:9 `layers` and the sample's 16:9 `booked`;
  - the fan's outer-tier pops are dropped when the film has a 9:16 aspect;
  - text arrives with a dive;
  - templates grow their cards `from: cursor`.

The stage files before this pass are in `jobs/fx-tools/orig-stage/`, and the full diff is `reports/opus-fixes.diff`. The edit pairs are `jobs/fx-tools/p-*.py`, applied with `jobs/fx-tools/patch.py`, which applies all of a file's pairs or none. Logs are in `jobs/fx-logs/`, and the repro jobs are `jobs/fx-*`.

### Per finding

| # | Sev | Status | What changed | Proof |
|---|---|---|---|---|
| 1 | HIGH | **fixed** | **`stack.js`.** The new `shownLabels` = labels capped at the plane count, used in build, `xplan` (labEnd), `copy` and `cues`. `validate` now warns "N labels for M planes — the extra label is not shown". | **`fx-xlabels`** (s1: 3 planes, 4 labels): `--grid` prints the new warning. In the storyboards for all 3 aspects there is no chip at (0, 0) (`fx-stills/xlabels-after.png`). |
| 2 | HIGH | **fixed** | **`runtime.js` `boxOf`.** Skips `[data-lv-soft]` and SVG no-draw tags, as `visualRect` does. A gradient box morphs in the mean of its stops; the first stop alone was pale.<br>**New companion layers.** A layer root tagged `data-lv-with="label"` brings that layer along on carries and morphs; press's `control` is tagged with it.<br>**Morph ghosts.** They hide the soft glow. A separate soft-glow copy fades out under the box over the first 30 % of the morph; removing it in one frame popped the glow off. | **`fx-pressmorph`** (the sample agent's repro). `fx-stills/pressmorph-after2.jpg`, f148–f180:<br>• the morph starts from the button face, with no slab;<br>• "Plan my trip" rides in the box and crossfades out;<br>• the glow fades out;<br>• the box darkens into the end card on the cut.<br>Full 5 s film: **QA PASSED (11)**.<br>**Carry (not morph).** press `control` → float `card` under a whip (`fx-presscarry`, `fx-stills/presscarry.jpg`): "Generate" rides in the lifted button and blends into the card on the cut, instead of staying behind. |
| 3 | HIGH | **fixed** | **`timeline.mjs` `compile`, for a cutdown.**<br>• A `carry` is dropped when the cutdown's next shot differs from the main film's next shot. On the cutdown's last shot this is silent (like `out:`); elsewhere a note says so.<br>• `from: <layer>` is dropped the same way when the previous shot differs.<br>• Every cross-cut warning or error in a cutdown says `in cutdown <name>:`.<br>• "out: dive does nothing on the last shot" now appears only for the main cut. | **`fx-cutdown`** (s7):<br>• `--grid --cut main`, `short`, `skip` and `all` all compile.<br>• `skip` prints `cutdown skip: brief's carry is dropped — it hands "prompt-box" to res in the main film, but end follows it here …`.<br>• `--storyboard --cut all` builds all three cuts. |
| 4 | MED | **fixed** | **`crossCutChecks`.** It stops the build when a shot that leaves on `dive` or `flood` has fewer than 16 frames (DIVE_LEN + 2).<br>**`cutPrep`.** Both seeks are now `Math.max(a.f0, …)`. | **`fx-shortdive`** (s2): `✗ beats.yaml: a: out: dive needs ≥ 16 frames (the dive takes the shot's last 14) — a has 12; …`. Before, it crashed in the stage build with `Cannot read … 'el'`. |
| 5 | MED | **fixed** | **`carryPrep`.** A morph whose box on either side doesn't paint stops the build. The message reads "a morph needs a box on both sides — "headline" in b (headline) draws none (text only); use mode: carry, or morph to: a card, pill, button, panel or prompt-box (or to: frame)". | **`fx-morphtext`** (s10): the storyboard stops with that line. The real morphs still build:<br>• r2-dev's panel → prompt-box and prompt-box → frame (clone `fx-r2dev`, storyboards for all 3 aspects, rc 0);<br>• the sample's prompt-box → frame (the clone's 16:9 film, QA PASSED).<br>The jobs list has no other morph targets. |
| 6 | MED | **fixed** | **`map.js` `validate`.** Warns per aspect when a stop's pin box (±26 px, 70 px tall) leaves the safe area.<br>**`build`.** Each candidate side is re-tested after it is clamped into the safe box. A clear side wins; failing that, a side off the headline; a chip that could only sit on the headline is dropped. | **`fx-iso`** shot `m`:<br>• `--grid` warns for stop 1 (Corner) and stop 3 (Far) on 16:9, 9:16 and 1:1.<br>• `fx-stills/map-after2.png`: no chip on "Every" in any aspect, and "Far" stays in frame. The corner pin is still off-frame; that is what the warning is for. |
| 7 | MED | **fixed** | **New in `qa/shots-skill-port`.** `make_motion_kit_docs.py` builds `motion_kit_docs.json`: 22 anchor → new pairs, 3 for SKILL.md and 19 for GUIDE.md. It checks itself: applied to the live docs the pairs give the stage docs exactly, and a second pass skips them all. `apply_motion_kit_docs.py` applies the pairs, with the same contract as the other pointer scripts.<br>**`test_parity.py` P8 / P8b.** When the copy's GUIDE has the transitions section, they run it after `apply_phase2_brief.py` and expect 22 APPLIED, then 22 SKIP.<br>**P8c.** It now checks the motion kit's description (1020 characters, ≤ 1024) against the rebuild. Live takes the old path unchanged.<br>**The storyboard port's P3b.** It applies the pairs once live's GUIDE carries the kit. | **Simulated P3b against the stage:** all 4 docs rebuild byte for byte (10 + 11 + 22 APPLIED, 0 NO ANCHOR).<br>**Suites:** `SHOTS_QA_VIDEO=$S bash qa/shots-skill-port/run_all.sh` gives **ALL SUITES PASS**: QA 1 parity 17 / 17, and 48 / 16 / 57 / 90 / 48 for the other suites. Logs are in `jobs/fx-logs/suites.log` and `jobs/fx-logs/suites-out/`.<br>**Rollback copies:** `jobs/fx-tools/shots-port-pre/`, `sb-port-pre/`. |
| 8 | MED | **fixed in part** | **New `K.diveTime(t)` in `kit.js`.** An entrance clock that starts 14 frames in and catches up by frame 36; it is monotonic, so later beats keep their frames. `ctx.reveal` (headline, stat, prompt, panel, …) and `type`'s name / over / pill use it when `ctx.entered === 'dive'`.<br>**`--grid`.** It warns on `dive.from` under .2.<br>**The GUIDE** says which blocks arrive whole. | **`fx-dives`** (stat → headline → type → title → prompt → end, all diving), 16:9, old vs new, `fx-stills/dives-ab.jpg`. At the cut, "Every post, planned." and "Orbit" + pill are there whole; before, they were 5 % visible. Title and prompt are unchanged: they arrive small but present. Old jobs: `t0 === t` without a dive (heroes above). |
| 9 | MED | **fixed in part** | **`stack.js` `buildExploded` fit.** It measures the projected planes over the landed pose and the shot's orbit (7 samples), and reserves a label column (the widest chip + leader). The room is the safe box, right of a 16:9 headline's glyphs (+56 px) or under a 9:16 / 1:1 headline (+64 px).<br>• A stack that already fits is untouched.<br>• One that doesn't is scaled (≤ 1) and centred in the room.<br>• 9:16 iso always fits, and its planes spread up to ×3.6 the gap to use the height. | `fx-stills/iso-9x16-before.png` → `iso-9x16-after3.png`: no left clipping, chips right of the planes, leaders forward. 1:1 and 16:9 are clean (`iso-16x9-after.png`). Still open: the 9:16 stack uses ~60 % of the room's height. Below it is mostly the platform-UI zone, but ~15 % of the frame stays empty. |
| 10 | MED | **fixed** | **`lv.mjs --film --no-purity`.** Writes `purity.json {skipped: true}`, and QA says "not measured (--film --no-purity) — run the final --film without --no-purity".<br>**`purityRun`.** Deletes every matching PNG (frames, replays, re-draws) once `purity.json` holds their numbers, and removes the empty folders.<br>**Docs.** The header help and the GUIDE cover both, and the GUIDE disk line now lists `purity/`. | **`fx-pressmorph` full film:** purity INFO "24 frames … match", and **no `purity/` folder is left**.<br>**`--range 0,40 --no-purity`:** prints `purity main 16x9: skipped (--no-purity)`.<br>`--no-purity` was also used for every iteration slice in this pass. |
| 11 | MED | **fixed** | **press `send`.** The prompt types itself in, from frame 4 at ~23 characters a second, with a caret and soft key ticks, finishing before the cursor sets off. `typed: false` keeps the old look. It is done with a pure-in-t clip-path at whole-character boundaries.<br>**fan.** A light sweeps once across the hero in the hold, after the hero frame and before the push.<br>**exploded.** A sweep crosses the top plane after the labels land. It is accent-tinted on a light drawn plane, where white is invisible.<br>**QA `deadair`.** A second INFO line lists the shots with a near-still stretch over 0.6 s. It excludes the closing lockup and names the reels' ~0.57 s. | **Sample clone, 16:9 film: QA PASSED (16)**, with the same WARN set as the sample. Longest still went from the sample's to the clone's:<br>• ask **1.75 → 0.78 s**<br>• trips **1.73 → 0.82 s**<br>• booked **1.20 → 0.80 s**<br>Stills: `sample-ask.jpg` (typing, caret, then the cursor), `sample-trips.jpg` (glint at f456–464), `sample-booked.jpg`.<br>`--layers ask,trips,booked` passes layer QA: ask max diff 4, trips worst 23 px > 16 (limit 64), booked max 5. |
| 12 | LOW | **fixed** | **`crossCutChecks` warns on `carry` with `out: dive` or `out: flood` on the same shot,** saying why each one hides the other. | **`fx-combo1`** (s4): two new warning lines. |
| 13 | LOW | **fixed** | **`press.js validate`.** Quotes the value the user wrote: "press at 500 is past the shot (90 frames) — pressing at 86 …; set at ≤ 82". There is also a new line for `at` < 12. | **`fx-bad1`** (s3). |
| 14 | LOW | **fixed** | **`lv.mjs`.** The header help explains launch15 / launch30. After `--init --kit launch*`, the `next:` line says "swap the placeholder cards in assets/ … or put footage behind any shot with bg: (GUIDE.md → "Launch starters")". | **`fx-init15`** / **`fx-init30`** (title `Zoë & Co: "Notes"`). |
| 15 | LOW | **fixed** | **GUIDE needle example:** `zoom: {16x9: 1.15, 1x1: 1.1}`, so 9:16 stays at 1. | All 5 GUIDE examples build their 9:16 storyboard (rc 0) with `fx-tools/guide-sb.py`. Example 04 no longer prints the safe-area note (`fx-stills/guide-9x16.png`). |
| 16 | LOW | **fixed** | **`launch15.yaml` / `launch30.yaml` and the GUIDE flood example** use `from: cursor`, with the reason in a comment. The GUIDE's From note and the starters paragraph say so too. | **`fx-init15` slice 300–420** (`fx-stills/l15-flood-cursor.jpg`): the card is born small at the pressed point on the cut and grows to the centre, with no pop.<br>Both kits `--grid` with no warnings, except launch30's documented 3-word-title line. |
| 17 | LOW | **fixed** | **`timeline.mjs`.** Passes `{aspects}` as the third argument of `cues()`.<br>**`fan.cues`.** With 9:16 in the film, only the hero and tier 1 pop. | The reviewer's `node -e` call gives pops 7 / 10 / 13 without 9:16, and pop 7 only with it. |
| 18 | LOW | **fixed** | **`fan.js validate`.** Warns when there are fewer different cards than `count`, worded per case. | **`fx-bad1`** shot `f`: "1 different card for 9 on the arc — every card shows the same picture …". |
| 19 | LOW | **fixed in part** | **Decided: `ctx.origin` is null in clean `--clips` / `--layers`**, matching "clean = no carry / dive / flood". The GUIDE hooks paragraph now says so, and documents `data-lv-soft`, `data-lv-with` and `K.diveTime`.<br>**Not done.** Calibrating the frame checks on the four reels and promoting any to FAIL is a measurement round of its own, needing the research reels' frames. `from:` on wall grid and exploded is a feature, not a fix. Both are now listed under Limits as open. | The trips layer export after the change: QA passes. |
| 20 | LOW | **fixed** | **`sheet.mjs`.** New `arrival(s, prev)` opens each row with how the shot arrives: carried or morphed in from X, landing as Y; grows out of X's layer; the camera dives in; X's colour floods in.<br>A float landed by a carry, `from:` or a dive no longer "flies in … with a speed streak". press `send` reads "prompt … types in, the cursor presses send". | **Sample clone's sheet:**<br>• `day`: "lit is carried in from spots, landing as the card · card showing assets/cove.svg"<br>• `trips`: "grows out of ask's cursor"<br>• `end`: "opens on go's prompt-box grown to fill the frame" |
| 21 | LOW | **fixed** (by #9's fit) | **16:9.** The room starts 56 px right of the headline's glyphs. | `fx-stills/combo-layers-ab.png`: prv-combo's "Built in layers." used to touch the top plane's corner, and now clears it by ~75 px. |

### Regression (as asked)

- **`--grid`, old jobs.**
  - Setup: clones `fx-old-film-sample-{stage,live}` and `fx-old-steady-sample-{stage,live}`, run with `--grid --cut all`.
  - Every line other than `!` is identical (`diff` empty).
  - The extra `!` lines are the merge's: reading time, transition types and cause. film-sample shows 8, steady-sample 5 for main plus its cutdown. No new rule from this pass fires on either.
- **film-sample storyboard heroes.** Stage vs live, `--aspect all`:
  - 33 / 36 are byte-identical.
  - `10-wall.png` differs in all 3 aspects: max 3 on 16:9 (3 px > 2), 2 on 9:16 and 1:1.
  - A second live run differs from the stage by max 1: run-to-run wall noise, as the merge and prove found.
- **prv-combo `--film --aspect 16x9`** (clone `fx-combo`): **QA PASSED (16 checks)**, 297 s.
  - **Same WARN set as prove's r3:** text floors, the end card URL contrast, `meet` dead air 1.65 s.
  - **Cut ratios:** the same, except route → layers at 3.10× (was 3.15×), because the exploded fit moved the planes.
  - **Purity:** max Δ 4, ≤ 2 px beyond ±2 (was max Δ 1).
  - **Cue onsets:** 56 (was 49), from the new typing ticks minus 2 fan pops.
- **Shot-writer suites.** `SHOTS_QA_VIDEO=<stage>/video bash qa/shots-skill-port/run_all.sh` gives **ALL SUITES PASS**:
  - QA 1 parity 17 / 17, including P4 (21 staged engine files, all on the allow-list), P4b, P8, P8b, P8c, P9 (casting) and P9b (storyboard);
  - QA 2 48 / 48, 2b 16 / 16, 3 57 / 57, 4 90 / 90, QA 5 48 / 48.

  Q9 / Q9b still find both skeletons free of warnings.

### What other agents should know

- **Engine fingerprints changed** for every job using press, fan, stack exploded, map, type under a dive, carries, dives or floods. Re-render those jobs; old jobs are byte-identical.
- **`engine-allow.txt` needs no change:** every engine file I touched is already listed. When the kit ships live, empty it and re-fingerprint P4's backup, as before.
- **Re-run `make_motion_kit_docs.py` after any further edit to the staged SKILL.md or GUIDE.md**, or P8 goes red again.

### Hygiene

| Check | Result |
|---|---|
| Live skill | `shasum -c live-before.sha1`: 867 OK, 0 not OK |
| `live-before/`, `base/`, live skill, `~/Downloads/launch-videos` | No file modified after 10:00 today (this pass started at 10:00) |
| Commits, pushes, `--go` | No commit, no push, no paid call, no `--go`, nothing under `qa/video-skill-learnings/skills/` run. No research frames or reel stills were copied. |
| Heat | Every render ran alone at `--workers` ≤ 2; `pmset -g therm` never recorded a warning |
| Disk | Frames, bgref, textless, purity and layer folders of my `fx-*` jobs are deleted. 37.2 GB free. |

## QA round 1 fixes (2026-10-27, after `reports/qa1.md`)

**Bottom line.** All 3 HIGH findings are fixed and proven on fresh films. Of the 9 MEDIUM findings, 6 are fixed, 2 are fixed in part (M3, M8), and 1 is open (M7: I could not reproduce it). All 5 LOW findings are fixed. L6–L8 are INFO, and I left them as they were.
- **Fresh films:** 7 films, and every one says **QA PASSED**:

  | Job | 16:9 | 9:16 | 1:1 |
  |---|---|---|---|
  | `jobs/qf1-combo` (prv-combo) | PASSED (16) | PASSED (16) | PASSED (16) |
  | `jobs/qf1-r2` (r2-dev) | PASSED (16) | PASSED (16) | PASSED (16) |
  | `jobs/qf1-n30` (a fresh launch30, "Tidewell Ledger") | PASSED (20) | — | — |

  The only WARN lines left are the known set: kit chips and capitals tags at 31–36 px, and the end card's address or tagline at Lc 50–54.
- **Shot-writer suites, run against the stage:** **ALL SUITES PASS** (17 / 48 / 16 / 57 / 90 / 48), including P4 (23 staged engine files), P8 / P8b (22 APPLIED, then 22 SKIP) and P8c.
- **Old jobs are unchanged.** Clones of dark-ui-check (panel) and steady-sample (endcard), storyboarded with the stage and with the live tool: every per-shot board PNG is byte-identical (3 / 3 and 7 + 7 / 7 + 7). Only the composed `storyboard.png` differs, through its note text, as qa2 found.
- **Each behaviour change is opt-in.** It fires only after a round-2 device (a flood, carry, dive or morph `to: frame`), on a new block or mode, or in the new launch templates. The one exception is the `--clips --alpha` preview colour (L4).
- **The unflattering part:**
  - **M7 (purity on the first frame of a fan with footage cards)** didn't reproduce in 3 focused tries, so I changed nothing.
  - **M3:** a 9:16 exploded stack still fills only about a third of the frame's height.
  - **M8:** the carry blend is shorter, but its box still overhangs the tile while it lands.
  - **New INFO:** a panel that arrives already built now holds still a little longer at its end. r2-dev `plan` reads "near dead air 1.05 s" (INFO, under the WARN line).
  - **r2's 9:16 and 1:1 films** were rendered before the last tweak to the end card's rise (L2). Their QA passed on the earlier version. Only 16:9 was re-filmed with the final code: **QA PASSED**, content min 153 px.
  - **Not re-rendered:** the sample job (`~/Downloads/launch-videos/motion-kit-sample`). I'm not the sample agent, so I didn't touch it. Its mp4s now predate H1 (`trips` is born at the flood's origin), M3 (`booked` on 9:16) and L2 (`go → end`). My clone `jobs/qf1-sample` shows all three.
  - The prv-combo and prv-r2-dev films also predate these fixes. Their fresh films are in `jobs/qf1-combo` and `jobs/qf1-r2`.

Rollback copies:
- The stage before this pass: `jobs/qf1-tools/orig-stage/`. The full diff: `reports/qf1-fixes.diff`.
- The prv jobs' original beats.yaml: `jobs/qf1-tools/prv-beats-orig/`.
- The shot-writer files I changed: `jobs/qf1-tools/shots-port-pre/`.

Logs are in `jobs/qf1-logs/` (`summary.txt` has the rc, time and free disk per step). The tools are in `jobs/qf1-tools/`: `run.sh`, `zoom.py`, `flash.mjs`, `films.sh`, `after-films.sh` and `clean.sh`.

### Per finding

| # | Sev | Status | What changed | Proof |
|---|---|---|---|---|
| H1 | HIGH | **fixed** | **`runtime.js` `originFor`.** When the previous shot leaves on `out: flood`, a `from: <layer>` is born at a point: the flood's origin, where the colour poured from. The layer is under the colour by the cut, and a card born at its size popped in whole out of a flat frame. `from: [x, y]` is unchanged.<br>**Docs.** `sheet.mjs` arrival reads "grows out of the point ask's colour floods from", and the GUIDE From note says so too. | **prv-combo f179 → 180, all 3 aspects of the fresh film** (`qf1-combo/stills/film-{16x9,9x16,1x1}-h1-180.png`): the hero is born ~120 px wide at the send button and grows to the centre by f184.<br>**r2-dev f144 → 145** (`qf1-r2/stills/film-*-h1-145.png`): the stack's front card is born as a speck at the Send spot.<br>**Same cut on the launch15 starter and the sample clone**, both from: cursor (`qf1-n15/stills/h1-360.png`, `qf1-sample/stills/h1-360.png`): born small at the pressed point, with no pop. |
| H2 | HIGH | **fixed** | **`runtime.js` `carryPrep`.** `c.same` now also requires the two boxes' aspect to be within 10 %. The same picture in a box of another shape takes the blend path: one outline changing shape, with the looks crossing under the blur peak. | **launch30 `result → inout`, 16:9 film** (`qf1-n30`, **QA PASSED (20)**; `stills/film-16x9-h2-630.png`): the card's outline goes from landscape to square over the carry. The two crops overlap for ~2 film frames under the blur, with no one-frame shape jump.<br>**The old placeholders show it too** (`qf1-l30/stills/h2-660.png`). |
| H3 | HIGH | **fixed** | **Fixed by H1, with fresh films.** | `qf1-combo/prv-combo-{16x9,9x16,1x1}.mp4` and `qf1-r2/r2-dev-{16x9,9x16,1x1}.mp4`, all **QA PASSED (16)**. |
| M1 | MED | **fixed** | **New `K.reshape(origin, w, h, t, {t0, len, lead})` in `kit.js`.** grow's lead element, born whole out of a box of another shape, starts in that box's aspect at its own area, so × s0 it is the source's box exactly, with a cover crop. It eases to its own shape on out(3) over 9 frames, before its chip arrives.<br>**`fan.js`.** Draws the hero's layout box from it. | **launch15 `result → scale`** (`qf1-n15/stills/m1-480-16x9.png`, `m1b-480-9x16.png`): the aspect runs 1.65 → 1.37 on the cut frame → 1.0 → 0.66 by +4, and the picture re-crops continuously. Before, it went 1.36 → portrait in one frame, with the text 1.6×. |
| M2 | MED | **fixed** | **New launch-only placeholders:** `placeholder-screen.svg` (its words and a dashed drop zone in the middle 300 px), and `placeholder-wipe-before.svg` / `-wipe-after.svg` (their words hug the wipe's divider, each on its own side).<br>**`lv.mjs` KITS and launch15 / launch30** use them. The reel starter's `card`, `before` and `after` are restored byte for byte; they belong to the live reel starter. | **Fresh `--init` of both starters, storyboarded in all aspects** (`qf1-i30/stills/{9x16,16x9,1x1}/board-heroes.png`, `qf1-i15/stills/9x16/board-heroes.png`). "YOUR SCREEN / a screenshot or screen recording" reads whole on the 9:16 fan hero, the grid tile and the landscape card. BEFORE / AFTER and their lines read beside the divider. |
| M3 | MED | **fixed in part** | **`stack.js` exploded on 9:16.** The low tilt now steps up steeply (0.42 / 0.95 of the gap, not 0.78 / 0.62), gets the iso's spread and up-scale fit, and keeps its planes overlapping (each step ≤ .55 of a plane's height). The iso spread cap goes from ×3.6 to ×4.6. 16:9 and 1:1 are untouched. | `qf1-x/stills/9x16/board-heroes-before.png` → `board-heroes.png`:<br>• kit-dev `exploded-low`: **20 % → 31 %** of the frame's height<br>• sample-style `booked`: **20 % → 34 %**<br>• iso: unchanged<br>Still open: the frame's width (planes plus the label column) sets the scale, so the lower third stays empty. The GUIDE Limits section says so. |
| M4 | MED | **fixed** | **Particles.** New `diveFrom: .55` on particles: cutPrep reads a block's `diveFrom` when `dive.from` isn't set. The sphere's dots also start ×2.2 and settle over 14 frames when dived in, because thin dots averaged away under the dive's blur.<br>**Panel.** `panel` gets `diveFrom: .5`. The timeline sets `s.entered = 'dive'` on a dived shot, so the panel starts its UI 14 frames early, with its sounds moved too, and its box has landed. | **prv-combo `grid → orbit`** (`qf1-combo/stills/film-16x9-m4-1080.png`): a bright sphere ~550 px wide on the cut, dots resolved by +8. Before: a ~270 px dim blob.<br>**r2-dev `wall → plan`** (`qf1-r2/stills/m4b-929.png`): the panel arrives with "Ready to post" and Schedule in it, at ×.5. |
| M5 | MED | **fixed (job)** | **r2-dev `scan`: `count: 8 → 5`** (`qf1-r2` and `prv-r2-dev` beats.yaml). An engine change to the stack's cycle cadence would move every old job, so I didn't make one. | **r2-dev 1:1 film:** "at most 2 flashes in any second". It was WARN 3.5 / s.<br>**`flash.mjs` probe on the scan slice:** worst 1.5 / s with 5 cards against 3 / s with 8 (after H1). |
| M6 | MED | **fixed** | **`particles.js` grid mode.** The halftone thins out in an elliptical clearing around the headline's glyphs (smoothstep, inner half empty). No plate. | **`qf1-mini` films, all PASSED:** "Signal, not noise." measures **5.38 / 5.42 / 5.33 : 1, Lc 73 / 73 / 72** (16:9 / 9:16 / 1:1). It was 3.3 / 2.8 / 3.0 : 1, Lc 44 / 35 / 39. Still: `qf1-mini/grid-heroes.png`. |
| M7 | MED | **open (not reproduced)** | **No change.** | **`qf1-m7`** (kit-dev's pr-gen + fan with footage, film 16:9, purity on): f138 matched in both passes. **`qf1-kit`** `--range 128,160`: f138 differed out of order (the same max Δ 19, 328 px) but matched in order (INFO).<br>It looks like Chrome raster or decode history from the earlier shots, which the in-order replay doesn't redraw. A full kit-dev film would tell, or a replay that also redraws the frames before the shot's start. |
| M8 | MED | **fixed in part** | **`runtime.js` `carryAt`.** The blend between two looks is shorter and sits on the blur peak: B is whole under A from half a frame before the cut, and A is gone half a frame after. Before, A faded from cut − 1 to cut + 1.5. | **prv-combo `brief → grid`** (`qf1-combo/stills/m8-900.png`): "Post the best one" ghosts on 2 film frames (f899 at 50 %, f900 at 16 %), not 4. The landscape box still overhangs the tile until it lands (~f910). That is the carry's shape morph, and the GUIDE Limits section names it. |
| M9 | MED | **fixed (job)** | **prv-combo `meet`: `beats: 4 → 2.5`** (`qf1-combo` and `prv-combo`). 3 beats still held it still for 1.17 s, a WARN by 0.07 s. | **Fresh films:** "near dead air: meet 0.92 / 0.95 / 0.88 s" (INFO) in 16:9 / 9:16 / 1:1. It was WARN 1.62–1.70 s. |
| L1 | LOW | **fixed** | **`particles.js`.** The grid and terrain fields reach past the frame by the camera's entrance offset or zoom-out, and by a whip or smear exit. Whole extra columns keep the in-frame dots in place; the dots past the frame come in with the frame's edge. | **kit-dev `grid → terrain`** (`qf1-kit/stills/l1-846.png`): the terrain fills to the left edge on the whip-in, with no hard line. |
| L2 | LOW | **fixed** | **`runtime.js`** sets `ctx.entered = 'frame'` after a morph `to: frame`. **`endcard.js`** then raises the lockup (64 px, on its own clock, pre-rolled 2 frames so the cut frame is never bare) and its lines (36 px). Every other entrance is byte-identical. | **r2-dev `go → end`** (`qf1-r2/stills/film-16x9-end.png`; film **QA PASSED**, content min 153 px) and the sample clone (`qf1-sample/stills/l2-1560.png`). |
| L3 | LOW | **fixed** | **launch30:** `result` 5 → 4 beats, `again` 3 → 4 beats. Still 60 beats, and the time comments are updated. | `--init --kit launch30 --title "Tidewell Ledger"` then `--grid`: **no warnings**. |
| L4 | LOW | **fixed** | **`lv.mjs --clips --alpha`.** The preview sits on the shot's own background: `brand.colors.dark` for `theme: dark`, or for footage unless `theme: light`. | `qf1-sample/stills/trips-preview-1s.png`: the white "One ask." reads on dark. The clip passes QA (prores 90 / 90, content, freeze). |
| L5 | LOW | **fixed** | **`sheet.html`.** `.seg` gets 4 px of padding and `text-overflow: ellipsis`. | `qf1-sample/stills/sheet-strip-crop.png`: "gl…", "na…", with nothing running into the next label. |
| L6–L8 | INFO | **unchanged** | — | As in qa1. |

### Decisions I took

- **H1 grows from the flood's origin, not from the named layer's centre.** The flood radiates from the pressed spot, so the eye is there on the cut. `from: cursor` in the starters lands on nearly the same point.
- **I kept the reel starter's placeholders.** They are the live skill's (the reel starter uses them in a side split and a wipe), so changing them would change a live feature. The launch starters got their own files.
- **M5 and M9 are fixed in the jobs, not the engine.** The stack's cycle and the title block are old blocks (rule 1). I mirrored the two job edits into `prv-combo` and `prv-r2-dev` (the originals are backed up). Their mp4s are stale until they are re-rendered.
- **The shot-writer port.** I added `video/engine/blocks/endcard.js` and `panel.js` to `engine-allow.txt` (both changes are opt-in), and re-ran `make_motion_kit_docs.py` after the GUIDE edits (still 22 pairs).

### Hygiene

| Check | Result |
|---|---|
| Live skill | `shasum -c live-before.sha1`: 867 OK, 0 not OK |
| `base/`, `live-before/`, live skill, `~/Downloads/launch-videos` | 0 files newer than this pass's start. The sample was only copied (`cp -c`), never rendered in place. |
| Commits, paid calls | No commit, no push, no paid call, no `--go`. Nothing under `qa/video-skill-learnings/skills/` was run. No research frames or private footage were copied: the dev jobs' own space clips stayed in the qf1 dev clones. |
| Heat | Every render ran alone at `--workers 2` through `run.sh`, which checks `pmset` before each step. It never recorded a warning. |
| Disk | The frames, bgref, textless, purity and clips folders of every qf1 job are deleted. 30.3 GB free. |
| Leftover process | An orphaned Chrome (pid 38117) from 04:22 isn't mine, and I left it running. |
