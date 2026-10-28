# hf02-full → product-launch-sting port: what changes, and how to apply or re-apply it

**Applied to live 2026-10-22 at 18:27 PDT** with `lead/merge_live.py --go`. Live == `stage-r5-final/` (92 files) after
review rounds 1–5, 3 QA runs and the 87-check acceptance harness. Checks on live after the merge:
- `lead/smoke_live.sh`: 15/15.
- The harness's 78 functional checks, run with `--allow-live`: `lead/accept-live.out` has 76, and
  `lead/accept-live-gen.out` has the 2 slow download checks. Those two needed a harness fix first (`acceptance/RESULT-r0.md`).
- Live still matched `stage-r5-final/` byte for byte after each run.
- On 2026-10-23, after the listening test, RECREATE.md §4 gained one sentence on the pre-hit whoosh. It went into live and
  `stage/` alike, while `stage-r5-final/` keeps the merged version. Worker B's RECREATE checks Q2a–Q2e and `static.docs`
  still pass.

The fix round's session was told (`qa/launch-video-skill-review/NOTE-hf02-port-merged.md`).

## Baseline
- `live-before/` is an exact `cp -a` of the live skill taken before the port. `live-before.sha1` covers its 78 files
  (node_modules excluded).
- Live == the fix round's `snap/`, which is the skill as of 2026-10-21 19:45.
- The other session's fix round is staged but unmerged. Its worktrees' last commits: wt-engine `b1186dc`, wt-film
  `7a6981a`, wt-reel `0adac5f` (+ uncommitted), wt-tools `85cddeb` (+ uncommitted).
- Snapshots of the port:
  - `stage-r0-before-review-fixes/`
  - `stage-r1-after-sonnet-fixes/`
  - `stage-r2-after-codex-fixes/`
  - `stage-r3-after-opus-fixes/`
  - `stage-r4-final-candidate/`
  - `stage-r5-final/` (after the QA run 1 fixes; this is what was merged)

## New files (copied as they are; no existing file depends on them)
| Path in the skill | Owner |
|---|---|
| `video/footage/gen.mjs`, `look.py`, `conform.py`, `pin.py`, `_media.py`, `screen.mjs` | Worker A |
| `video/FOOTAGE.md`, `video/templates/footage-prompts.md` | Worker A |
| `video/recreate/compare.py`, `track.py`, `music.py`, `temptrack.py`, `media.py` | Worker B |
| `video/RECREATE.md` | Worker B |

## Edited existing files
| File | Edits | How |
|---|---|---|
| `SKILL.md` | 3: the description (1019 of 1024 chars), one router paragraph, the mode-B line in "Which mode" | `lead/apply_pointers.py` |
| `video/GUIDE.md` | 10: intro, requirements line, workflow rows 3 and 5, two command lines, music style list, `film`/`hit:` sentence, "Bringing the AI footage in" (two variants: live wording and the fix round's), originality, Limits | `lead/apply_pointers.py` |
| `video/templates/beats.yaml` | 1: the style comment lists `film (groove, 87)` | `lead/apply_pointers.py` |
| `video/lib/spec.mjs` | 5: `STYLES` + `film`, `STYLE_BPM` + `film: 87`, the default key `film: 'F'`, the `music.hit` block (style film only), and a one-line `--grid` warning when a film's `hit:` can't apply (its last shot isn't an `endcard`) | `lead/apply_pointers.py` |
| `video/lib/audio.mjs` | the film block after `PROG`, plus three non-film hunks (header line, `stem()` post hook, the quiet-SFX mute used only by film with `hit > 0`) | copy staging's file; see below |

`apply_pointers.py <skill dir> [--check]`:
- checks every anchor before it writes anything (each must match exactly once);
- skips an edit whose new text is already there, so it can be re-run;
- fails if the description is over 1024 chars.

Verified 2026-10-22:
- From `live-before/`, it rebuilds staging's four files byte for byte. A second run reports every edit "already applied".
- `--check` passes on live and on each of the fix round's four worktrees. A simulated merge of all four worktrees' GUIDE
  changes applies cleanly too.

**audio.mjs** is untouched by every fix-round worktree, as are hdr.mjs, common.mjs, server.mjs, stage.html and
deliver.mjs. Copy staging's file only if live's audio.mjs still matches its `live-before.sha1` line. If it doesn't,
re-apply `work-B/r2/patches/audio.mjs.diff` by hand; the film block is self-contained.

## Applying now (onto live == live-before)
1. `cd ~/.claude/skills/product-launch-sting && shasum -c <port>/live-before.sha1` must report 78/78 OK.
2. Copy the new files above from `stage/product-launch-sting/`.
3. Run `python3 -E lead/apply_pointers.py ~/.claude/skills/product-launch-sting`, then copy staging's audio.mjs.
4. Verify:
   - every untouched file still matches `live-before.sha1`;
   - every new or edited file matches staging (sha1);
   - `apply_pointers.py --check` says "already applied" for every edit;
   - there is no `__pycache__` in the skill.
5. Smoke run on live:
   - `lv.mjs --job <a copy of steady-sample> --grid`;
   - `gen.mjs still --prompt x --out /tmp/x` as a dry run, which must print the estimate and write nothing;
   - `compare.py --help`.

## Re-applying after the fix round merges into live
The fix round touches GUIDE.md, spec.mjs, lv.mjs, qa.mjs, breakdown.mjs, timeline.mjs, render.mjs, layers.mjs,
sheet.mjs, fingerprint.mjs, runtime.js, kit.js, blocks and templates. It doesn't touch SKILL.md, audio.mjs, voices.mjs,
common.mjs or hdr.mjs.
1. Copy back any new file that is missing; none is in the fix round's tree.
2. Run `apply_pointers.py` on the merged live. If the fix round rewrote another anchored paragraph, the script stops with
   "anchor found 0 times" and writes nothing. In that case, add that wording as one more variant and run it again.
3. audio.mjs: as above (copy only if live's still matches `live-before`).
4. Re-test what leans on code the fix round changes:
   - `screen.mjs` uses lv.mjs `loadSpec`/`compile`/`extractPlates`/`serve`/`launch` and the stage's `LV.seek` /
     `.lv-screen` / `heroF`. Re-run `work-A/tests/test_screen_bg.sh`.
   - The `bg:` contract (`bg`, `bgFrom`, `bgDim`, `bgMove: none`) is unchanged in their worktrees. Their `--grid` only
     warns about a clip too short for its shot; `--film` still refuses it. Re-run QA run 1.
   - `music: film` and `hit:` depend on spec/timeline compile. Re-run `work-B/tests/final.sh` (E1, R1*, R3*) and QA run 3.
   - **The tracker changes the recreate numbers.** wt-tools' new `breakdown.mjs` drops higgsfield02's tempo confidence
     from 0.941 to 0.55 (`offBeat: true`). Our film.mp4 stays at 0.745, and the film-87 and film-init masters are unchanged.
     - The verdict stays ON THEIR BEAT.
     - RECREATE.md's worked example ("confidence 0.75 vs 0.94") and `music.py compare`'s printout will change. Update the
       example, and re-run QA run 2.
   - The fix round's own regression set (`qa/launch-video-skill-review/fix/regress`) must still pass with the port on top.
   - The 87-check acceptance harness: `bash acceptance/run.sh ~/.claude/skills/product-launch-sting --allow-live` (its
     static checks compare against `live-before`, so re-baseline them for the merged tree first).

## What changes for existing jobs once the port is installed
- **Output:** byte-identical for the playful, keynote, calm, track and none styles: stems, master, SFX, VO, cutdowns,
  clips, layers. Proven on 9 old jobs, plus the reviewers' own builds.
- **Fingerprint:** `audioPrint` hashes audio.mjs. So an already-finished job's `lv.mjs --qa` fails its `audio` check
  ("built from a different timeline or code — run --audio") until `--audio` is run once, which rebuilds byte-identical
  stems. The fix round's engine changes will do the same to the shot prints. Tell the user.
- **`music: film`:** new, so no existing job uses it.

## Decisions taken during the port
- **fal key order:** an explicit `--env FILE` first, with no fallback when it has no key line. Then `FAL_KEY` in the
  environment, then `~/Downloads/launch-videos/.env`.
- **Paid results:** never lost. The request id is printed and saved right after the POST. `--force` archives the old
  generation under versioned names (`x.prev-<id8>.mp4`).
  - Downloads go into `.part-<id8>` and only a whole, readable file takes the real name.
  - A cut-off run is resumed with `fetch`, never re-submitted (round 3 adds the classify step and the pre-POST stub).
- **Downloads:** a fresh `curl -C -` per try, up to 30 (`FAL_DL_ATTEMPTS` / `FAL_DL_TIMEOUT`). `curl --retry` restarts
  from the first byte, so it isn't used.
- **conform:** the default `--crf` is 15. HDR goes through the engine's `hdrFilter`. Rotation tags are honoured.
  Odd sizes are cropped to even.
- **look.py:** prints p2/p10/p50/p90/p98. The docs' targets are today's p2/p50/p98.
- **film style:**
  - shaker 0.9 / 6 ms, plus a film music bus (AAC noise substitution pushed peaks over the limit);
  - breaks are pad + shaker only, and touching breaks merge;
  - cuts within 35 ms of a grid line snap to it;
  - `hit:` is the hit's offset from the end card's first frame (−1…2 s), and the end card's own pre-hit SFX are muted in
    the mix only.
- **compare.py:** pairs frames by index. It reads 60 fps ours against a 30 fps reference as frame 2i. It notes 29.97 vs
  30. The built-in cut detector is a fallback; use `--cuts-from`.
- **Not in this port:** `-aac_pns 0` in deliver.mjs (it would change every style's encode); `lv.mjs --score` for hand-built
  films; one shared Python module (each folder stays self-contained, with a parity test); the gen.mjs "request id in every
  name" simplification (after QA, as its own change).

## Known limits (not blocking)
- gen.mjs lock: a double holder is theoretically possible with a dead claim file plus ≥ 3 runs starting within
  microseconds (not reproduced in 25 + 10 + 60 race trials; the first run's stub would still stop a second submit). A run
  killed between writing `<lock>.<pid>` and linking it leaves that temp file (harmless; not cleaned up).
- gen.mjs: a fetch of an unrelated request onto an `--out` holding a stub keeps the stub as `.prev-submit.fal.json`
  (by design); the reminder to look that earlier submit up is then only in that file's name and the printed note.
- The film style's pre-hit silence is music-only (measured after the merge):
  - Entered with a cut, the end card gets true silence before the hit: film-87-hit is digitally silent for ≈ 0.4 s, from
    53.8 s to 54.17 s.
  - Entered with a moving transition, the end card hears its whoosh tail through the first ≈ 0.2 s of the gap. In QA run
    3's zoom-out it plays from 22.9 s to 23.1 s at about −28 dBFS RMS. True silence follows until the hit at 23.3 s.
  - **Alex decided on 2026-10-23 to keep the whoosh**, so no code changed. RECREATE.md §4 now says so in one sentence.
    That sentence went into live and `stage/` after the merge; `lead/RECREATE.md.pre-whoosh-note` is the copy before it. The float music stem can peak over 0 dBFS (normalise before using it in another editor).
- compare.py's built-in cut detector is a fallback; `--cuts-from` a checked list is the definitive route.

## Not verified by a real paid call
gen.mjs is tested against mock fal queues only (four independent mocks). Its field names come from today's real request
logs. One real FLUX still with `--go` ($0.06) would prove the live path; that is Alex's call.
