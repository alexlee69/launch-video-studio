# QA pass 3: every guard fires, and stays quiet where it should (2026-10-27)

**Verdict: PASS.** Each new frame check WARNs on a planted bad shot, with the numbers the GUIDE gives. Each new validation stops or warns with a clear line and the right exit code. The shot writer's suites pass on the stage, and the live run gives the same result as before tonight. Nothing I found is a wrong verdict. The open items are four LOW points and two documented blind spots.

**Results:**
- **Frame checks.** All 7 planted probes WARN as documented: dead air, text floors (web / feed / tv), contrast, flash, reading time (CJK included), purity and cut continuity. The dive → "starts zoomed in and shrinks" case WARNs, naming both shots. Their controls stay quiet: a `hold:`, the tv floors, a `.lv-ui` chip, big mid-grey text, a 2.5 / s strobe, Hangul read at 9 a second, dimmed footage and a matched dive.
- **The two samples.** Dead air, flash, purity and continuity are silent (INFO only) on film-sample and on the motion-kit-sample. Three checks are not silent, and each case is documented, not a fault:
  - **Text floors** WARN on both samples.
  - **Contrast** WARNs on the motion-kit-sample's end card URL.
  - **Reading time** WARNs on 6 film-sample shots at `--grid`.
- **Validations.** 15 planted mistakes, plus extra variants:
  - Spec mistakes stop at `--grid` with rc 2 and one line each.
  - Layer mistakes warn at `--grid` (rc 0) and stop the build with rc 1.
  - The valid case (stack exploded with no cards) is silent and renders 4 drawn planes.
  - **Two LOW cosmetic issues:** `words: []` prints two error lines, and the build-time layer errors print their line twice.
- **Transition lint.** It warns on more than 2 types and on missing causes, and it treats the signature and type families as documented.
- **Shot writer.**
  - **Stage:** `run_all.sh` gives **ALL SUITES PASS** (17 / 48 / 16 / 57 / 90 / 48).
  - **Live:** the log is identical to `merge/logs/suites-live.log` from 04:25, ending in the known `test_phase2.py` FileNotFoundError.
  - **The phase-2 example:** shots.py puts each new field in the block SHOTS.md names. The 9 doc lines appear word for word. Negatives stay out of every prompt until `confirm`.
- **`--init --kit launch20`:** rc 2, `✗ --kit must be reel, film, launch15, launch30 (…)`, and nothing is written.

**What I didn't touch:**
- I edited nothing in the stage (120 files hash the same before and after), the live skill (`shasum -c live-before.sha1`: 867 OK), `base/`, `live-before/`, or any original job (0 files newer than my start under `~/Downloads/launch-videos`).
- No commits, no paid calls, no `--go`.
- Every render ran alone at `--workers 2`, and `pmset -g therm` never recorded a warning.
- All `frames/ bgref/ textless/ purity/` folders of my jobs are deleted, and 31.2 GB is free.

Shorthands:
- `M = /Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit`
- `J = $M/jobs`
- `LV = node $M/stage/product-launch-sting/video/lv.mjs`
- Logs: `$J/qa3-logs/` (`summary.txt` = rc, seconds and free disk per render).
- Tools: `$J/qa3-tools/`:
  - `mkval.sh` and `mkframe.sh` build the probe jobs.
  - `run.sh` is the serial runner (it waits 180 s on a thermal warning and refuses to start under 26 GB free).
  - `sheet.sh` tiles frames.
  - `clean.sh` deletes the heavy folders of `qa3-*` jobs only.
  - `shots_neg.py` runs the shot-writer cases.
  - `make_svgs.py` draws the fictional card art.

## Decisions (no questions asked)

- **Probe art.** I drew my own probe art: 9 gradient-and-shape SVG cards (`make_svgs.py`) and a moving-gradient plate from ffmpeg's `gradients` source (`footage-bright.mp4`). There is no research material, no reel stills and no private footage anywhere. The brand is a fictional "Quillo".
- **Custom probe blocks.** Each one is my own, under `<job>/blocks/qa3*.mjs`:
  - `qa3stall`: a line that lands, then stalls.
  - `qa3sizes`: lines at set px, a `.lv-ui` chip and a bare 22 px line.
  - `qa3ink`: colour, size, plate, outline and cover.
  - `qa3strobe`: a full-frame black / white strobe.
  - `qa3vel`, `qa3first`, `qa3css`: three order-dependent styles.
  - `qa3late`: a layer that is invisible until frame 30.
- **"Silent" means no WARN line.** INFO lines are pointers, and the GUIDE says they never fail. Where a sample does WARN, I looked at the frames and judged whether the WARN is true.
- **One aspect per film.** Each film rendered one aspect, mostly 16:9. The floors probes and the motion-kit-sample also ran 9:16, because the floors differ there. Short probes skipped purity (`--no-purity`), except the purity probe itself and the two samples.
- **The dive "starts zoomed in and shrinks" case can't be built from beats.yaml.** Camera `zoom` is static, `dive.from` is limited to 0.1–0.9, and the dive's own entrance always grows. D-monitor found the same. So I rendered a clean dive, copied the job (`cp -c -R`), rewrote the incoming shot's first 40 frames in its `cams.json` (×2 → ×1), and re-ran `--qa`. That is the same method D used.
- **The suites ran in sequence: stage first, then live.** `run_all.sh` writes its logs into `qa/shots-skill-port/out/`, so after each run I copied them to `qa3-logs/suites-{stage,live}-out/`. The live run's logs are the ones now in `out/`.

## 1 · Frame checks on planted probes

Each probe is a `$J/qa3-f-*` job, rendered with `LV --job … --film --aspect A --workers 2`. The logs are `qa3-logs/film-f-*.log`, and `qa-f-*.json` copies of qa.json are kept in `qa3-logs/`.

| Check | Probe · what's planted | Result (verbatim where short) | Controls |
|---|---|---|---|
| **deadair** | `qa3-f-deadair` (16:9): `stall` lands 2 words, then holds for 3.8 s (its copy needs 1.6 s) | **WARN** `stall at 2.22 s for 3.77 s (its copy needs 1.60 s: 2.17 s over)` | `held` (same block, still stretch under `hold: [14, 100]`): silent. `near` (2.3 s shot): **INFO** `near at 10.22 s for 2.07 s (…: 0.47 s over)`, i.e. near dead air under 0.5 s over, as documented. The pace INFO lists the slow holds. `ok1`: silent. |
| **text floors** | `qa3-f-floors-{web,feed,tv}`: caps 30 px, mixed 44 px, a 60 px line, on 16:9 + 9:16 | web 16:9: **WARN** `under the web floor for 16:9 (47 px, 35 px in capitals; delivery: feed raises it): s2 "LIVE NOW" 30px caps; s2 "Sign up today" 44px`. feed 16:9: **WARN** with all three (60 / 30 / 44 against 64 / 48). 9:16 in every delivery: **WARN** on the 30 px caps only (40 / 36). | tv 16:9: **silent** (27 / 21). The 60 px line on web: silent. A 22 px `ctx.text` inside an `.lv-ui` wrapper: exempt from everything; it's counted as a box but in no WARN. A bare 22 px line: the existing `small (< 26 px)` WARN, never the floor line. The storyboard prints the same floor note, with "(film QA will WARN)". |
| **contrast** | `qa3-f-contrast` (16:9), 8 shots | **WARN** low: `c6 "White over a bright plat" 1.1:1 Lc 0 (79 px); c2 "Pale grey line" 1.7:1 Lc 29 (79 px); c3 "Mid grey, small" 4.2:1 Lc 67`. **WARN** `must-read text not painted at its hero frame …: c7 "Hidden at its hero"`. **INFO** `outlined text, check by eye: c5`. | c4, the same `#7A7A7A` at 106 px (4.12:1, over the 3:1 limit for text ≥ 48 px): silent. c8 grey on a dark plate (9.3:1): silent. c1 dark ink: silent. Hero stills: `$J/qa3-stills/contrast-heroes-16x9.png`. Each frame shows the planted case. |
| **flash** | `qa3-f-flash` (16:9): `f2` strobes black / white every 4 frames (3.75 flashes / s) | **WARN** `more than 3 flashes in a second …: 2.00–4.00 s (4 flashes)`, which is exactly f2's span | `f4` strobes every 6 frames (2.5 / s, at most 3 in any second): silent. Light → dark → light hard cuts: silent. Strobe frames: `$J/qa3-stills/flash-16x9.png`. |
| **reading time** (`--grid`) | `qa3-f-reading`: 12 shots | 7 WARN, each with its numbers, e.g. `r3: 14 characters on screen for 2.8 s — viewers need ~3.0 s (0.4 s to build + 0.15 s a Han / kana character + 0.5 s …)`. Also r5 (Japanese, 15 characters, ~3.1 s), r6 (`AI 预告片`: "1 word + 3 characters", ~1.7 s), r7 (1 word, the 1 s floor, ~1.4 s), and r8 / r10 (×1.3 over footage at bgDim .1 and at the default .15, ~3.8 s). | r4 (14 Hangul in 2.75 s, need 2.46 at 9 a second; at 6.75 it would warn): silent. r9 (bgDim .4): silent. r11 (image bg, bgDim 0: no ×1.3): silent. r12 (9 words at exactly its need, 4.05 s): silent. `timeline.json` `reading` holds every number, and all of them match the formula. |
| **purity** | `qa3-f-purity` (16:9, purity on): `vel` takes its streak from the time since the previous render call; `css` has a CSS `transition: transform`; `first` starts its clock at the first render call | `vel`: **WARN** `the page's state at 4 frame(s) depends on the order frames are drawn in …` (max Δ 190). `css`: **WARN** `CSS transitions / animations run … css transform@card (149 frames, 541–689)`, plus **WARN** `3/24 frames differ … even when drawn again the way the film drew them`. | p1, p4, p5 (built-ins): match (max Δ ≤ 1). **`first`: silent, all 4 frames at Δ 0.** This is a blind spot, see F3. |
| **continuity** | `qa3-f-cont` (16:9, real fields) | **WARN** `k1→k2 (whip-up): the move flips direction on the cut — y −4979 → +1783 px/s`. **WARN** `k2→k3 (zoom-in): speed 3181 → 0 px/s (to rest) — k3 stands still on its first frames`. With k5's pan at `at: 2` (`qa3-f-cont-at2`): **WARN** `k4→k5: the fastest step is 3 frames after the cut (483→484, 3813 vs 1805 px/s)`. | k3→k4, a dive into a point: holds at 1.21× (dive limit 2×). k5's pan at `at: 5` peaks 10 frames after the cut. That's outside the documented 0.1 s window, so it's silent; see F4. |
| **continuity: dive → shrink** | `qa3-f-dive` (a panel dives into a headline shot), then `qa3-f-dive-plant` with d2's camera rewritten to ×2 → ×1 | **WARN** `d1→d2 at 150 (dive): the move flips direction on the cut — zoom +9.95/s → −4.68/s (d1 pushes in, d2 starts zoomed in and pulls back)`, plus **WARN** `speed 10967 → 5152 px/s (2.13×, limit 2×)` | The unplanted job: `all hold; speed ratio 1.2×`, both from the film and from a `--qa` re-run. Cut stills: `$J/qa3-stills/dive-cut-16x9.png`. The panel flies in, and d2 arrives already growing. |

**Probe artefacts (expected, not guard faults):**
- **deadair and contrast end `QA FAILED (1)` on the old hard-cut check.** Two near-identical shots cut together don't spike (stall→held 1.16×, c3→c4 1.14×). The check's logic is unchanged (qa2).
- **deadair's `held` shot got a purity seam WARN (max Δ 119).** My `qa3stall` transform settles on `translateY(0) scale(1)` during the hold, which is the GUIDE's Chrome transform rule. The `near` frames' INFO raster-history line has the same cause.
- **The flash strobe's red word gets a contrast WARN (Lc 40).** That one is correct.

## 2 · The same checks on film-sample and the motion-kit-sample

Both are clones (`cp -c -R` of beats.yaml, assets and brief.md; no `out/`): `$J/qa3-s-film-sample` and `$J/qa3-s-mks`. Each ran `LV --job … --film --aspect A --workers 2` with purity on.

| Film | Verdict | deadair | flash | purity | continuity | contrast | text floors | `--grid` |
|---|---|---|---|---|---|---|---|---|
| film-sample 16:9 (712 s) | QA PASSED (16) | INFO (closest: voice 1.83 of 2.65 s) | INFO `at most 3 flashes` | INFO 1/36 raster history | INFO, all hold, 1.9–2.6× | INFO, worst 3.4:1 at 231 px | **WARN** `open "Your launch crew" 41px; voice "Three teasers, ready Fri" 45px` | **6 reading-time WARNs** + "3 transition types" + "no visible cause" |
| motion-kit-sample 16:9 (323 s) | QA PASSED (16) | INFO | INFO, at most 2 | INFO 1/33 | INFO, all hold, incl. 2 carried objects | **WARN** `end "wayfinch.app" 6.8:1 Lc 51` | **WARN** 15 kit labels at 35 px | fan bleed note + "3 transition types … and the signature dive" (deliberate, sample.md) |
| motion-kit-sample 9:16 (320 s) | QA PASSED (16) | INFO | INFO, at most 1.5 | INFO 1/33 | INFO, all hold | **WARN** the same URL | **WARN** `day "Day 4" 35px caps; end "wayfinch.app" 31px` | as above |

**How I judged these WARNs (by eye):**
- **film-sample's 3 flashes in one second (19.95 s)** are real. The `scan` stack cycles dark and light cards (`$J/qa3-stills/film-sample-flash-window.png`). That is at the WCAG limit, so it is correctly not a WARN.
- **The film-sample floor WARNs are true:**
  - The pill under the opening lockup is 41 px.
  - The voice line is 45 px.
  - Both are must-read text under the 47 px web floor (`$J/qa3-stills/film-sample-floors-heroes.png`).
  - film-sample predates the floors, and qa2 recorded the same two lines.
- **The motion-kit-sample WARNs are true and documented:**
  - The 35 px kit chips are in GUIDE → Limits, "Kit chips on 16:9 … film QA WARNs", whose floor is "still open".
  - The float tag and the end card URL are in sample.md's "Five WARN lines remain per film, all block styling".
  - The frames look as designed (`$J/qa3-stills/mks-16x9-heroes.png`).
- **film-sample's reading-time WARNs come from the stricter SPEC-R1 formula.** For example, name has 7 words in 2.4 s and needs ~3.4 s. qa2 already listed them.

So deadair, flash, purity and continuity are silent on both samples, as the task asks. Floors, contrast and reading time fire on real, documented cases. See F6.

## 3 · Validations: one line each, and the right rc

Each case is a `$J/qa3-v-<name>` job built by `qa3-tools/mkval.sh` from a valid 3-shot base. `qa3-v-base` compiles silently, rc 0. The commands are `LV --job $J/qa3-v-<name> --grid` and, for build-time cases, `--storyboard --aspect 16x9`. Logs are `qa3-logs/vgrid-*.log` and `sb-v-*.log`; all of them are in `vgrid-summary.txt`.

| Mistake | rc | The line |
|---|---|---|
| carry: unknown layer (A side, `el: promptbox`) | `--grid` 0 · build **1** | grid: `! ask: carry.el "promptbox" — ask's prompt block has no such layer (its layers: …); the stage build will fail if it doesn't tag one`. Build: `✗ stage failed to build: page.evaluate: Error: carry from ask: el "promptbox" — shot ask (prompt) has no layer of that name (its layers: prompt-box, prompt-text)`, **printed twice** (F2) |
| carry: unknown layer (B side, `to: pannel`) | 0 · **1** | the same, as `carry ask → plan: to "pannel" — shot plan (panel) has no layer …`, printed twice |
| carry on the last shot | **2** | `✗ beats.yaml: end: carry on the last shot — there is no next shot to hand "cta" to (move it to the shot before a cut)` |
| carry lands on an invisible element (`to: late, post: 4`; the layer fades in at frame 30) | 0 · **1** | `✗ stage failed to build: … carry ask → hidden: "late" is only 0 % visible where the carry lands (4 frames into hidden) — land later with post: N or carry another element`. Following the advice (`post: 42`, `qa3-v-carry-invisible-fix`) builds, rc 0. |
| dive into a missing layer (`el: prompt-boxx`) | 0 · **1** | grid `! ask: dive.el "prompt-boxx" — … no such layer`; build `dive from ask: el "prompt-boxx" — shot ask (prompt) has no layer of that name …` (printed twice) |
| `from:` typo on float (`lefft`) | **2** | `✗ beats.yaml: card: float from "lefft" must be left \| right (the side it flies in from), or a layer of the previous shot (ask, prompt: headline · prompt-box · …)`. Also `"Left"` gives rc 2 (`… (got "Left")`), `[1.2, 0.5]` gives rc 2 (`from must be [x, y] fractions 0–1 …`), and `right` gives rc 0. |
| bad flood colour (`navy`, `"#FFF"`) | **2** | `- shots[0] (ask): flood.color must be a #RRGGBB hex (got "navy")` / `(got "#FFF")` |
| press with a very long label (13 words, 3 aspects) | 0 | `! press go: label "Generate every launch asset …" is too long for the button — it is cut short with "…" on 9x16, 1x1; keep it to 1–4 words`, plus the reading-time line. Stills: 16:9 wraps onto two lines, and 9:16 / 1:1 end in "…". The cursor tip sits off the label (`$J/qa3-v-press-long/out/main/{16x9,9x16,1x1}/board/01-go.png`). |
| fan count 9 with labels, 1:1 | 0 | `! fan fan: count 9 — the outer cards bleed off the frame on 1x1; a label whose chip would leave the frame is dropped there (9:16 shows the middle 3)`. Still: 4 of 9 chips shown, none clipped (`$J/qa3-v-fan9/out/main/1x1/board/01-fan.png`). |
| particles bad mode (`galaxy`) | **2** | `- shots[0] (dots): particles mode must be one of sphere, burst, grid, terrain (got "galaxy")` |
| wall grid bad cols (13, 2.5) | **2** | `- shots[0] (wall): wall cols must be a whole number 1–12 (got 13)` / `(got 2.5)` |
| type words empty (`[]`) | **2** | **two lines** (F1): `type needs \`text\` (a name) or \`words\` (a list of word beats)` and `type words must be a list of word beats, e.g. […] (got [])`. A blank word gives one line: `type words[1] must be a word (got "")`. |
| stack exploded with no cards (valid) | 0 | silent. It renders 4 drawn UI planes with labels on all 3 aspects (`$J/qa3-v-stack-nocards/out/main/*/board/01-layers.png`). 9:16 has small planes, which is in the GUIDE's Limits. |
| invalid delivery (`phone`) | **2** | `- delivery must be one of web, feed, tv (got "phone")` |
| signature as a list | **2** | `- signature must be one of whip-left, whip, …, carry, morph (got ["dive","flood"]) — the transition the film repeats as its signature` |
| blank cause (`"   "`, `""`, `42`) | **2** | `- shots[0] (ask): cause must be text — the on-screen reason for the transition, e.g. "the cursor clicks Generate" (it is blank)`. The number gets the same line without "(it is blank)". |

**Transition lint (`--grid`, rc 0):**
- `qa3-v-lint-types` (5 types; b, c and d have no cause) gives:
  - `! 5 transition types in one film (whip: a; zoom: b; glitch: c; flood: d; smear: e) — keep it to two plus cuts (or declare …)`
  - once per film: `! moving transitions without a visible cause: b (zoom-in), c (glitch), d (flood) — …`
- `qa3-v-lint-sig3` (`signature: whip-left`) gives `! 4 transition types … (zoom: c; glitch: d; tunnel: e; blur: f) — keep it to two plus cuts and the signature whip-left`:
  - whip-right falls under the signature's family;
  - the cause line names only c, because blur isn't a moving type.
- Silent, as they should be:
  - `qa3-v-lint-sig` (signature zoom-in, so whip + glitch are left);
  - `qa3-v-lint-ok` (whip + zoom, dive as the signature, drift not counted).

## 4 · Shot writer, and `--init --kit launch20`

- **Stage:**
  - Command: `SHOTS_QA_VIDEO=$M/stage/product-launch-sting/video bash qa/shots-skill-port/run_all.sh`.
  - Result: QA 1 parity 17/17, QA 2 48/48, 2b 16/16, 3 57/57, 4 90/90, QA 5 phase 2 48/48, **ALL SUITES PASS**, rc 0 (14:45–14:57).
  - Logs: `qa3-logs/suites-stage.log` and `suites-stage-out/`.
- **Live:**
  - Command: `bash qa/shots-skill-port/run_all.sh`.
  - Result: 17/17, 48, 16, 57, 90, then `FileNotFoundError: … phase2-band-shots.json` → **SOME SUITES FAILED**, rc 1.
  - `diff` against `$M/merge/logs/suites-live.log` (04:25, before tonight's work) is **empty** apart from timestamps. It behaves as before.
  - Logs: `qa3-logs/suites-live.log` and `suites-live-out/`.
- **The phase-2 example:**
  - **Setup.** I copied `shots/examples/phase2-band-shots.json` to `$J/qa3-shots/tools/shots.json`, beside a casting.json with sheet `runner` and location `bridge` and a placeholder `assets/band.jpg`. Every command is `/usr/bin/python3 -I -B $S/video/shots/shots.py …` run from that folder.
  - **Commands and results:**

    | Command | Result |
    |---|---|
    | `check` | rc 1: `! shots.K01: still only proposed …: negatives` |
    | `show K01` | rc 1 |
    | `show K02` | rc 0 |
    | `build` | rc 2: `✗ build: still only proposed …; nothing written` |
    | `build K02` | rc 1; wrote K02.h3.txt (101 words) and K02.key.txt |
    | `confirm K01` | rc 0 |
    | `show K01` again | rc 0 |
    | `build` | rc 0; K01.seedance.txt (950 words), K01.key.txt |

  - **Placement, checked in code** (`qa3-logs/shots-show-*.log`):
    - **ACTION order:** trick (first) < must < task < timed beats < acting < eye beats < gaze line.
    - **REFERENCES:** "Keep exactly as they are" < `first`'s "let none of this carry on" line.
    - **Key frame:** each "Take nothing else from Image N" follows its image line, and the sizes follow the first-frame line.
    - **BODY AND PHYSICS:** head count < the sizes three ways < "Nothing changes its real size".
    - **LOCKS:** fail lines < (after confirm) "None of these may happen: …" < the no-text line, word for word as SHOTS.md says.
    - **H3:** camera < "Rule of the shot:" < beats < both fail lines < tail. It carries no must, task, acting or negatives.
    - **K02:** the band is sized against the frame and the cup only.
  - **The doc example.** All 9 lines of SHOTS.md's `<!-- phase2-example -->` block appear verbatim in `show K01` / `show K02`.
  - **Negatives.** Before `confirm`, none of the 4 negatives is in any prompt. `show` lists them apart ("in no prompt until `shots.py confirm K01`").
- **Refusals and warnings** (`qa3-tools/shots_neg.py`, log `qa3-logs/shots-neg.log`):

  | Case | rc | Result |
  |---|---|---|
  | trick a number | 2 | `✗ shots.K01.trick: text, or {rule, so} (got 42)` |
  | trick without its rule | 2 | `✗` (refused) |
  | an empty `must` entry | 2 | `✗` (refused) |
  | 3 must rules | 1 | `!` |
  | refs with an unknown ref | 2 | `✗ … "ghost" is none of this shot's references (runner, bridge, band, first)` |
  | refs without `dont` | 2 | `✗` (refused) |
  | acting on a shot without people | 2 | `✗` (refused) |
  | a size with no measures | 2 | `✗` (refused) |
  | "slightly" in the trick | 1 | `! vague words …` |
  | negatives without a trick | 1 | `!` |
  | a Seedance shot with people but no task | 0 | `i` |
  | the example with negatives confirmed | 0 | clean |

- **`--init --kit launch20`:**
  - rc **2**: `✗ --kit must be reel, film, launch15, launch30 (a reel of AI footage + stickers, a launch film with UI over AI footage, or a 15 s / 30 s launch starter)`. No folder is written.
  - A bare `--kit` gives the same line and rc 2.
  - `--kit launch15` writes the starter, rc 0, and its `--grid` is clean.
  - Live, for comparison: rc 2, `--kit must be reel or film`.

## Findings

| # | Sev | What | Exact repro | Suggested fix |
|---|---|---|---|---|
| F1 | LOW | `type` with `words: []` prints **two** error lines for one mistake. Both are right; the first is redundant. | `LV --job $J/qa3-v-type-words --grid` → rc 2, two `- shots[0] (words): …` lines | `lib/spec.mjs` ~l.179: only say "type needs text or words" when `s.words == null` |
| F2 | LOW | Build-time layer errors print their message **twice**, prefixed with `page.evaluate: Error:` (carry el / to, dive el). The invisible-landing error prints once. | `LV --job $J/qa3-v-carry-el --storyboard --aspect 16x9` (also `qa3-v-carry-to`, `qa3-v-dive-el`) → rc 1, `✗ stage failed to build: page.evaluate: Error: carry from ask: …`, then `Error: carry from ask: …` | `lib/render.mjs` `openPage`: the `UserError('stage failed to build: ' + …)` appends the page's own `pageerror` text, which repeats the evaluate message. Drop the duplicate and the `page.evaluate: Error:` prefix |
| F3 | LOW (blind spot) | Purity can't see a block whose clock starts at its **first render call** (`if (t0 == null) t0 = t`). Its 4 seeded frames match at Δ 0, and no line names the shot. Every page (film, the shuffled page, the replays) warms up first by seeking each shot's hero frame (`lib/render.mjs:149`), so `t0` is always that frame. The film is reproducible, so no viewer sees a jump. But rule 2 is broken without a word, and the motion is offset by the hero time. By my reading of the code, the shot's first call is at its hero frame (t 65), so the card starts ~585 px left of where its code means it to. I inferred this from the code and didn't measure it on a frame. | `LV --job $J/qa3-f-purity --film --aspect 16x9 --workers 2`, block `$J/qa3-f-purity/blocks/qa3first.mjs`; `qa3-logs/purity-f-purity-16x9.json` frames 120 / 195 / 196 / 269 `pass`, Δ 0 | Add to GUIDE's purity row: state captured on a shot's first draw is invisible (every page draws the hero first). Or take the DOM signature once more on a page that skips the warm-up |
| F4 | LOW (documented scope) | Continuity only looks at steps within ±6 frames (0.1 s) of the cut. A pan that peaks 10 frames after a drift cut stays silent, though the camera log shows a stutter, then a lurch: the drift dies to 12 px/step at +5, then the pan lurches to 55 px/step at +10. At `at: 2` it WARNs. | `qa3-f-cont` (k5 `pan: [{at: 5, …}]`) silent vs `qa3-f-cont-at2` WARN; camera numbers in `qa3-logs/cams-f-cont-16x9.json`, frames 480–496 | Widen only the peak search, to ~0.2 s |
| F5 | INFO | "A dive into a shot that starts zoomed in and shrinks" can't be built from beats.yaml (camera `zoom` static, `dive.from` 0.1–0.9), so the WARN is proven only on a planted `cams.json`. A block's own zoom isn't in the camera log (the GUIDE says so). | `$J/qa3-f-dive-plant`, `LV --job … --qa --aspect 16x9` | none needed |
| F6 | INFO (an expectation, not a fault) | The two samples aren't silent on text floors, contrast (mks) and reading time (film-sample). Each WARN is true (I checked the frames) and documented (GUIDE Limits "Kit chips on 16:9", sample.md's five WARN lines, the stricter reading formula). | section 2 | Lead's call: which floor chips answer to (the GUIDE's open item). Or make film-sample meet the new floors and reading times |
| F7 | cosmetic | The flash INFO can say "at most 1.5 flashes in any second". It counts half flashes. | mks 9:16 film log | Print transitions, or round |

## Stills to look at

- **Dead air:** `$J/qa3-stills/deadair-16x9.png`. The stall really is still: frames 100–860.
- **Contrast:** `$J/qa3-stills/contrast-heroes-16x9.png`, the 8 hero frames, c1 → c8.
- **Flash:** `$J/qa3-stills/flash-16x9.png`, f2 and f4 strobing.
- **Dive cut:** `$J/qa3-stills/dive-cut-16x9.png`, frames 122–230 around the dive.
- **film-sample:**
  - `$J/qa3-stills/film-sample-floors-heroes.png`: the two floor WARNs.
  - `$J/qa3-stills/film-sample-flash-window.png`: the 3-flash card cycle.
- **motion-kit-sample:** `$J/qa3-stills/mks-16x9-heroes.png`, all 11 heroes plus the last frame.
- **Floors:** `$J/qa3-f-floors-web/out/main/16x9/board/02-s2.png`.
- **Validation stills:**
  - press (3 aspects): `$J/qa3-v-press-long/out/main/{16x9,9x16,1x1}/board/01-go.png`
  - fan 9 on 1:1: `$J/qa3-v-fan9/out/main/1x1/board/01-fan.png`
  - stack with no cards (3 aspects): `$J/qa3-v-stack-nocards/out/main/{16x9,9x16,1x1}/board/01-layers.png`

## Hygiene

| Check | Result |
|---|---|
| **Stage** | 120 files hash the same before and after (`qa3-logs/stage-start.sha1` = `stage-end.sha1`). No file in `stage/`, `base/` or `live-before/` is newer than my start. |
| **Live skill** | `shasum -c live-before.sha1`: 867 OK, at the start and the end. |
| **Originals** | `~/Downloads/launch-videos`: 0 files newer than my start. Both samples were rendered only as clones in `$J/qa3-s-*`. |
| **Commits, calls, research** | No commit or push, no paid call, no `--go`. Nothing under `qa/video-skill-learnings/skills/` was run. |
| **Heat** | Every render ran alone through `run.sh` at `--workers 2`; `pmset -g therm` never recorded a warning. |
| **Disk** | All `frames/ bgref/ textless/ purity/ layers/` folders of `qa3-*` are deleted. 31.2 GB is free. |
