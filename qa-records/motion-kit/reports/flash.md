# Flash fix: the "net" share (Alex 10-27)

**Bottom line.** The flash check now uses the net share, and that one change does what Alex asked. Every strobe B measured is still caught, and the motion false positives are gone. Only flash lines changed in any `qa.json`.

| Step | Result | Proof in one line |
|---|---|---|
| 1 · The rule | **PASS** | 2 code lines in `flashCheck` plus the two comments that describe it; `node --check` OK |
| 2 · Strobes still caught | **PASS** | B's table is reproduced exactly. The planted probes give identical QA lines before and after. The new probe `fl-strobe-motion` WARNs (4 flashes) in all 25 windows with a card sweeping, whipping or scrolling across them |
| 3 · Motion no longer counted | **PASS** | hf02-skill 1:1 goes from `WARN 4.80–6.48 s (4 flashes)` to `INFO at most 1 flash`. film-sample `scan` per aspect is now **3 / 2 / WARN 4** (16:9 / 9:16 / 1:1), exactly as B predicted. Old jobs keep every PASS and FAIL line |

**Unflattering numbers.**
- **film-sample 1:1 `scan` still WARNs, at exactly 4 flashes.** That is real luminance swapping, not motion (finding F1).
- **The net rule has one blind spot the old rule didn't.** A strobe split into flashes going opposite ways in the same window goes quiet once the two halves are within 25 % of each other (finding F2). I did not change the rule for it, as instructed.
- **Probe artifact.** The new probe itself `QA FAILED (1)` on a cut line, the same before and after (F3).

Machine: `pmset -g therm` never recorded a thermal or performance warning (checked before every queued step). Renders ran one at a time at `--workers 2`. Free disk never went below 42 GB.

---

## Step 1 · The rule (PASS)

**What changed.** The file is `qa/motion-kit/stage/product-launch-sting/video/lib/qa.mjs`. A candidate leg used to count when ≥ 25 % of the window's pixels changed by ≥ 0.1 its way. It now counts when **(pixels changing by ≥ 0.1 its way) − (pixels changing by ≥ 0.1 the other way)**, between the same two frames, reaches 25 %. Both counts keep the existing "darker state < 0.8" condition.

**What did not change:**
- the 3-flashes-a-second limit (`FLASH_MAX`);
- the window layout: W/3 × H/3, overlapping by half, 5 × 5;
- the candidate legs on the mean, with hysteresis `FLASH_DL × FLASH_AREA`;
- `FLASH_DL`, `FLASH_DARK` and `FLASH_AREA`;
- merging same-direction transitions, and midpoint timing;
- the span merge, and the WARN and INFO wording.

The check is still WARN at most and never FAIL.

**Hashes.** `qa.mjs` before: `79c3202d…`; after: `1f78b9e8…`. The patch is `runs/fl/flash-net.patch`; the backup is `runs/fl/before-edit/qa.mjs`. 14 insertions and 10 deletions, of which the code is 2 lines.

```diff
@@ header (lines 33–36)
-//             ≥ 0.1 relative-luminance change whose darker state is < 0.8, made by ≥ 25 % of the pixels of a W/3 × H/3
-//             window of the thumbnails — 25 % of a 10° field — in the same frames), timed where they cross half-way
+//             ≥ 0.1 relative-luminance change whose darker state is < 0.8, made by a net ≥ 25 % of the pixels of a
+//             W/3 × H/3 window of the thumbnails — 25 % of a 10° field — in the same frames: those changing ≥ 0.1 its
+//             way minus those changing ≥ 0.1 the other way, so a moving edge cancels), timed where they cross half-way
@@ flash section comment (lines 372–380)
-// the smallest mean change a qualifying flash makes); a leg is a transition when ≥ FLASH_AREA of the window's pixels
-// change by ≥ FLASH_DL in its direction between its two ends with their darker state < FLASH_DARK (pixel-wise, so a
-// small full-contrast flash doesn't count as a big faint one); runs of same-direction transitions merge; each is timed
-// where the window's mean crosses half-way; a flash = two opposing transitions; more than 3 flashes (≥ 7 transitions)
-// within any 1 s = WARN. Red flashes aren't measured (grey thumbnails).
+// the smallest mean change a qualifying flash makes); a leg is a transition when its NET share reaches FLASH_AREA: the
+// window's pixels changing by ≥ FLASH_DL in its direction between its two ends, minus those changing by ≥ FLASH_DL the
+// other way between the same two frames, each with their darker state < FLASH_DARK (pixel-wise, so a small
+// full-contrast flash doesn't count as a big faint one; net, so motion isn't a flash — a moving high-contrast object
+// darkens pixels at one edge while it brightens others at the other: Alex 10-27); runs of same-direction transitions
+// merge; each is timed where the window's mean crosses half-way; a flash = two opposing transitions; more than 3
+// flashes (≥ 7 transitions) within any 1 s = WARN. Red flashes aren't measured (grey thumbnails).
@@ flashCheck → share()
-    // pixel-wise: the share of the window's pixels that make this transition between the leg's two ends
+    // pixel-wise: the net share of the window's pixels that make this transition between the leg's two ends (its way
+    // minus the other way)
     const share = l => {
       const up = l.b > l.a; let c = 0;
       for (let y = y0; y < y0 + wh; y++) for (let x = x0, o = y * w + x0; x < x0 + ww; x++, o++) {
-        const p = LIN[buf[l.k0 * px + o]], q = LIN[buf[l.k1 * px + o]];
-        if ((up ? q - p : p - q) >= FLASH_DL && Math.min(p, q) < FLASH_DARK) c++;
+        const p = LIN[buf[l.k0 * px + o]], q = LIN[buf[l.k1 * px + o]], d = up ? q - p : p - q;
+        if (Math.min(p, q) < FLASH_DARK) c += d >= FLASH_DL ? 1 : d <= -FLASH_DL ? -1 : 0;
       }
```

`node --check …/stage/product-launch-sting/video/lib/qa.mjs` → OK. No doc in the skill describes the flash rule (`grep -rn "WCAG\|2\.3\.1" --include=*.md stage/product-launch-sting` finds nothing), so nothing else needed editing.

**How before and after were compared on the same frames:**
- **`runs/fl/eng-pre/`** is a `cp -c` copy of the stage skill with the pre-edit `qa.mjs` put back. `diff -rq -x node_modules` against stage lists only `video/lib/qa.mjs`. The engine fingerprint covers `engine/` only, so `lv.mjs --qa` from either copy accepts the same frames.
- **`runs/fl/fcmp.mjs`** runs both `flashCheck`s on thumbnails made exactly as QA's `thumbs()` makes them. It also runs a per-window copy of the same algorithm in both modes. Its maximum matched both imported functions on every case: a mismatch would print `!!`, and none did.
- **`runs/fl/qadiff.mjs`** matches `qa.json` lines by check name and occurrence. It lists every changed line, and compares the `data` of every non-flash check.

## Step 2 · Strobes still caught (PASS)

### B-verify-r1's table, reproduced

`node runs/fl/fcmp.mjs synth` (`runs/fl/synth.log`) uses the same synthetic 192 × 108 thumbnails as B's `flashproto.mjs`, 3 s each.

| case | B's table (staging / net) | before (gross) | after (net) |
|---|---|---|---|
| 3 Hz full frame | quiet / quiet | quiet (worst 3) | **quiet (worst 3)** |
| 3.5 Hz full frame | WARN / WARN | WARN 3.5 | **WARN 3.5** |
| 4 Hz full frame | WARN / WARN | WARN 4 | **WARN 4** |
| 10 Hz full frame | WARN / WARN | WARN 10 | **WARN 10** |
| 300 px at 5 Hz | WARN / WARN | WARN 5 | **WARN 5** |
| 220 px at 5 Hz | quiet / quiet | quiet (0) | **quiet (0)** |
| 200 px at 5 Hz | quiet / quiet | quiet (0) | **quiet (0)** |
| 2 Hz full frame (extra) | — | quiet (2) | quiet (2) |

### Planted probes

These are `cp -c` clones of `ver-B-flash` and `ver-B-flasharea`: inputs only, re-rendered at 16:9 with the stage engine, because their frames had been deleted. QA ran from the pre-edit engine and from the stage engine on the same frames.

| probe | before (eng-pre `--qa`) | after (stage `--film` and `--qa`) |
|---|---|---|
| `fl-flash` (3 Hz full · 4 Hz full · 200 px at 5 Hz) | `WARN 6.00–8.88 s (4 flashes)` | **identical**. 3 Hz and 200 px quiet; the 4 Hz shot WARNs in all 25 windows (4 → 4) |
| `fl-flasharea` (300 px at 5 Hz · 220 px at 5 Hz · 3.5 Hz full) | `WARN 1.50–4.40 s (5), 8.20–8.90 s (4), 10.50–13.50 s (3.5)` | **identical**. The `qa.json`s match line for line, data too |

**The 220 px planted square.** It WARNs at 8.20–8.90 s before **and** after, exactly as in B's QA run (B-verify-r1 #6). The camera push grows it to about 226 px on screen, which is 25.0 % of a window at thumbnail resolution. A square that grows outward makes all its pixels change the same way, so the net share equals the gross share and the result can't move. The synthetic 220 px case, the one in B's table, stays quiet in both.

### New probe `jobs/fl-strobe-motion` (16:9, 18 s)

**What it is.** A custom block, `blocks/strobemove.mjs`, draws a full-frame black/white strobe. Over it move high-contrast cards: white, with a black header band and three black bars, 420 × 240 px. The cards cross the same windows the strobe fills.

| shot | what moves | before | after |
|---|---|---|---|
| `sweep` (1.5–4.5 s), 4 Hz | one card crosses the middle row once, ~780 px/s | WARN 4, 25 / 25 windows at 4 | **WARN 4, 25 / 25 windows at 4** |
| `whip` (5.5–8.5 s), 4 Hz | the card crosses back and forth 3 times, ~2340 px/s | WARN 4, 25 / 25 | **WARN 4, 25 / 25** |
| `list` (9.5–12.5 s), 4 Hz | 4 columns of cards scroll up at 1500 px/s (about half the frame is card) | WARN 4.5 (motion added half a flash) | **WARN 4, 25 / 25** (the strobe's true rate) |
| `ctrl` (13.5–16.5 s), no strobe | the same list over steady black | **WARN 3.5** (a false positive) | **quiet, all windows 0** |

**What QA prints.**
- Before: `WARN flash … 1.50–4.38 s (4 flashes), 5.50–8.38 s (4 flashes), 9.50–12.50 s (4.5 flashes), 14.77–15.73 s (3.5 flashes)`.
- After: `WARN flash … 1.50–4.38 s (4 flashes), 5.50–8.38 s (4 flashes), 9.50–12.38 s (4 flashes)`.

**Per window.** Every window the card crosses keeps exactly 4 flashes (rows 1–3, all columns: `runs/fl/logs/fc-motion.log`). Motion does not cancel a real strobe, because the strobe moves every uncovered pixel the same way. The card's own pixels change both ways about equally, so they net to roughly zero instead of going negative.

**Synthetic stress.** Denser lists over a 4 Hz strobe, at 70 % and 83 % card cover: before 7.5 / 8.5, after exactly 4. The same lists with no strobe: before WARN 5.5 / 6, after quiet.

**Stills.** I read them and they show what the probe is meant to show.
- `runs/fl/stills/motion-sweep-120-every8-4x4.png`: the card crosses the middle on alternating black and white frames, and the label is readable.
- `motion-list-600-every4.png` and `motion-ctrl-840-every4.png`: the scrolling list over the strobe, and over steady black.

## Step 3 · Motion no longer counted (PASS)

### hf02-skill

- **1:1.** I re-rendered it on the clone `jobs/fl-hf02`. The stage frames are **539 / 539 byte-identical** to the live original's.
- **16:9 and 9:16.** I measured these on `cp -c` copies of the live frames (`jobs/fl-hf02-live`, since deleted).

| aspect | B (staging) | before | after | QA line after |
|---|---|---|---|---|
| 16:9 | 2 | 2 | **1** | (not re-rendered) |
| 9:16 | 2.5 | 2.5 | **1** | (not re-rendered) |
| 1:1 | WARN 4 | `WARN 4.80–6.48 s (4 flashes)` | **1** | `INFO flash at most 1 flash in any second (WCAG 2.3.1 allows 3)` |

In 1:1 the top-left window (the list whip) drops from 4 to 0.5.

### film-sample `scan` (`--range 1180,1370` on the clone `jobs/fl-film`)

| aspect | B (staging → net predicted) | before | **after** |
|---|---|---|---|
| 16:9 | WARN 5 → 3 | WARN 19.84–21.07 (5) | **quiet, worst 3** (full-film QA: `INFO flash at most 3 flashes in any second`) |
| 9:16 | WARN 5 → 2 | WARN 19.84–21.05 (5) | **quiet, worst 2** |
| 1:1 | WARN 5 → WARN 4 | WARN 19.84–21.07 (5) | **WARN 19.84–21.05 (4)**: see F1 |

How each aspect was measured:
- **9:16 and 1:1.** `--film --range 1180,1370` renders the 191 frames, then stops by design: `✗ frames … 191/2265 on disk`, as in B's run. I measured those frames with `fcmp.mjs`.
- **16:9.** I rendered the full film, so the frames include the range and QA ran end to end.

### Old jobs' `qa.json`: every line that changed

Each job was rendered once with the stage engine, then given `--qa` from eng-pre (before) and from stage (after) on the same frames. The stage `--film` `qa.json` and the stage `--qa` `qa.json` are byte-identical in every job.

| job (clone) | lines | changed lines | PASS / FAIL before → after | non-flash `data` |
|---|---|---|---|---|
| film-sample 16:9 (`fl-film`, full film) | 29 / 29 | **1, flash only** | 16 / 0 → 16 / 0 | identical |
| steady-sample 16:9 main (`fl-steady`, full film) | 23 / 23 | **0** (flash was already `INFO at most 1 flash`) | 12 / 0 → 12 / 0 | identical |
| hf02-skill 1:1 (`fl-hf02`, full film) | 21 / 21 | **1, flash only** | 11 / 0 → 11 / 0 | identical |
| probes `fl-flash` / `fl-flasharea` | 21 / 21 | 0 | 14 / 0 → 14 / 0 | identical |
| probe `fl-strobe-motion` | 23 / 23 | 1, flash only (above) | 15 / 1 → 15 / 1 (F3) | identical |

The changed lines, in full:

- **film-sample 16:9.**
  - Before: `WARN flash more than 3 flashes in a second over ≥ 25 % of a 10° field (WCAG 2.3.1): 19.83–21.07 s (5 flashes) — slow the strobe or shrink the flashing area`.
  - After: `INFO flash at most 3 flashes in any second (WCAG 2.3.1 allows 3)`.
- **hf02-skill 1:1.**
  - Before: `WARN flash more than 3 flashes in a second over ≥ 25 % of a 10° field (WCAG 2.3.1): 4.80–6.48 s (4 flashes) — slow the strobe or shrink the flashing area`.
  - After: `INFO flash at most 1 flash in any second (WCAG 2.3.1 allows 3)`.

**Against the live originals.** These are the `qa.json`s in `~/Downloads/launch-videos`, which I read but never ran. film-sample 16:9 has 16 / 16 PASS/FAIL lines, identical. steady-sample 16:9 has 12 / 12, identical. hf02 1:1 has 11 PASS and 0 FAIL on both sides. The differences are only the round-1/2 INFO and WARN lines, which merge.md already accounts for.

## Findings for Alex

**F1 · film-sample 1:1 `scan` still WARNs (4 flashes). This is real luminance, not motion.**
- **Where.** `node runs/fl/legs.mjs … 4 3` (`runs/fl/logs/legs-film-1x1-w43.log`) lists the legs in the bottom-right window. Net drops the two stack-fly-in legs (1196→1199 net 7 %, 1199→1202 net 12 %) and the 1311→1318 tail. It keeps the card swaps: blue → white → green → orange → white, each 31–80 % net.
- **The extra flashes.** The outgoing card fades and slides off before the next dark card lands, and that opens a 2–3-frame light gap (1230→1232 up, net 48 %).
- **The count.** Within 1191–1251 that makes 8 transitions, so 4 flashes. The contact sheet is `runs/fl/stills/film-1x1-scan-1186-1252-every3-w43.png`, with window 4,3 boxed.
- **Why it can still be right.** Under WCAG's definition this is a borderline true positive: whole-area light/dark swaps faster than 3 a second, in one window. It is a WARN, so nothing fails.
- **If Alex wants it quiet.** The fix is in the scan's swap cadence (fewer swaps a second, or no light gap between dark cards), not in the check.

**F2 · The net rule's blind spot: opposite flashes in the same window.**
- **The weakness.** A strobe whose area is split into two parts flashing against each other cancels itself. Examples are an inverting checker or stripe glitch, or a two-tone card that inverts on the beat.
- **Synthetic 4 Hz full-frame stripes** (`synth.log`):

  | split, with phase / against | before | after |
  |---|---|---|
  | 70 / 30 | WARN | WARN |
  | 60 / 40 | WARN | WARN (window boundaries tip it to ≥ 25 %) |
  | 55 / 45 | WARN | **quiet** |
  | 50 / 50 | WARN | **quiet** |

- **Was the old rule safe?** Only partly. At an exact 50 / 50 the window mean doesn't move, so it found no candidate legs either. Here it caught 50 / 50 only because the window edges cut the stripes unevenly.
- **What I did.** Per the instructions, I left the rule at "net". If Alex wants this covered, the lever is B's hybrid: use net only when the gross share is under ~50 %. That is not built.

**F3 · Probe-only: `fl-strobe-motion` fails `cut list→s7 at 750` (change 57.74, neighbours ≤ 59.46).**
- **Cause.** The strobe's own toggles sit within 3 frames of the hard cut, so the cut isn't a spike.
- **Scope.** It is identical before and after, and it comes from the probe's design, not the flash change. I didn't redesign the probe, because the flash proof doesn't depend on that cut.

## Commands (from `qa/motion-kit/jobs`)

**Engines:**
- `S=…/qa/motion-kit/stage/product-launch-sting/video/lv.mjs`
- `P=…/qa/motion-kit/runs/fl/eng-pre/product-launch-sting/video/lv.mjs`

**Runners.** Both queues ran through `runs/fl/q.sh`. It runs one step at a time, waits out any `pmset -g therm` warning, and skips a step under 26 GB free. Queue files: `runs/fl/q1`, `runs/fl/q2`. Per-step logs: `runs/fl/logs/`. Exits and times: `runs/fl/q1.done`, `runs/fl/q2.done`.

| step | command | result |
|---|---|---|
| syntax | `node --check stage/…/video/lib/qa.mjs` | OK |
| synthetic | `node runs/fl/fcmp.mjs synth` | table above; per-window = imported on all 22 cases |
| hf02 live 16:9 / 9:16 | `node runs/fl/fcmp.mjs frames fl-hf02-live/{16x9,9x16}/frames W H 0 538 … --win` | 2 → 1, 2.5 → 1 |
| probe flash | `node $S --job fl-flash --film --aspect 16x9 --workers 2`; `node $P … --qa`; `node $S … --qa`; `fcmp frames … 0 899` | 124 s; identical QA |
| probe flasharea | same commands, on `fl-flasharea` | 129 s; identical QA |
| probe motion | same commands, on `fl-strobe-motion`; `fcmp` per shot | 127 s; WARN kept, control quiet |
| hf02 1:1 | `node $S --job fl-hf02 --film --aspect 1x1 --workers 2`; `$P` and `$S --qa`; `fcmp … 1080 1080 0 538` | 64 s; WARN 4 → INFO 1; 539/539 frames = live |
| scan 9:16 | `node $S --job fl-film --film --range 1180,1370 --aspect 9x16 --workers 2`; `fcmp … 1180 1370` | 109 s (exit 1 by design); 5 → 2 |
| scan 1:1 | the same command at `--aspect 1x1` | 90 s (exit 1 by design); 5 → 4 |
| film-sample 16:9 | `node $S --job fl-film --film --aspect 16x9 --workers 2`; `$P` and `$S --qa`; `fcmp … 1180 1370` and `0 2264` | 646 s; 5 → 3; only the flash line changed |
| steady-sample 16:9 | `node $S --job fl-steady --film --cut main --aspect 16x9 --workers 2`; `$P` and `$S --qa`; `fcmp … 0 1199` | 190 s; no line changed (worst 1 → 1) |
| qa diffs | `node runs/fl/qadiff.mjs runs/fl/qa/<job>-pre.json runs/fl/qa/<job>-post.json` | table above |
| legs | `node runs/fl/legs.mjs fl-film/out/main/1x1/frames 1080 1080 1180 1370 4 3` | F1 |

## Files

| what | where |
|---|---|
| The edit | `stage/product-launch-sting/video/lib/qa.mjs` (sha1 `1f78b9e8…`). It no longer matches `merge/stage-final.sha1` (`79c3202d…`); no other stage file differs from that manifest. |
| Patch and backup | `runs/fl/flash-net.patch`, `runs/fl/before-edit/qa.mjs` |
| Tools | `runs/fl/{fcmp.mjs, qadiff.mjs, legs.mjs, q.sh}` and `runs/fl/eng-pre/` (stage with the pre-edit `qa.mjs`, for before-runs only) |
| `qa.json` copies | `runs/fl/qa/<job>-{pre,post,post-film}.json` |
| Stills | `runs/fl/stills/` |
| Jobs | `jobs/fl-{flash,flasharea,strobe-motion,hf02,film,steady}`: inputs plus mp4s, `qa.json`, `purity.json` and logs |

## Hygiene

| check | result |
|---|---|
| Live skill | `shasum -c live-before.sha1`: 0 not OK (live `qa.mjs` is still `04c8d995…`) |
| `live-before/`, `base/` | 0 files newer than the start of this pass |
| Original jobs | 0 files under `~/Downloads/launch-videos` newer than the start of this pass. They were cloned with `cp -c` and never run with `--job`. |
| Stage | Only `video/lib/qa.mjs` differs from `merge/stage-final.sha1` |
| Disk | I deleted `frames/`, `bgref/`, `textless/`, `purity/` and `layers/` of all my `fl-*` jobs, and `fl-hf02-live/`, after measuring. 44 GB free at the end. |
| Heat | No `pmset` warning at any check; one render at a time, `--workers 2` |
| Rules | No commits, no paid calls, no `--go`. Nothing under `qa/video-skill-learnings/skills/` was run, and no reference or private footage was copied. |

## Asks for Alex
1. **F1:** keep film-sample 1:1 `scan` as a WARN (a real borderline flash), or slow its card swaps.
2. **F2:** accept the net rule's blind spot for opposite flashes in one window, or ask for B's hybrid (net only when the gross share is under ~50 %).
3. **Lead:** re-fingerprint `merge/stage-final.sha1` for `video/lib/qa.mjs`, and close B-verify N1 in merge.md's open list (section m below).
