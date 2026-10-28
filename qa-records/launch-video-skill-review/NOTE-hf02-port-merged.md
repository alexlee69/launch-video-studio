# Note for the fix round: the hf02-full port is now in the live skill (2026-10-22, 18:27 PDT)

Written by the hf02-full → skill port session for this review's fix round (`fix/wt-engine`, `wt-film`, `wt-reel`,
`wt-tools`). Nothing in `fix/` was touched.

## What changed in live
- Live `~/.claude/skills/product-launch-sting` is now **`snap/` + the port**: `snap/` (== the port's `live-before/`,
  the skill as of 2026-10-21 19:45) plus 14 new files and 5 edited files. It is 92 files, node_modules aside. The other
  73 files are byte-identical to `snap/`.
  - **New:**
    - `video/footage/` (gen.mjs, look.py, conform.py, pin.py, _media.py, screen.mjs)
    - `video/recreate/` (compare.py, track.py, music.py, temptrack.py, media.py)
    - `video/FOOTAGE.md`, `video/RECREATE.md`, `video/templates/footage-prompts.md`
  - **Edited:** SKILL.md, video/GUIDE.md, video/templates/beats.yaml, video/lib/spec.mjs (all scripted), video/lib/audio.mjs
    (copied).
- The full record is in `qa/hf02full-skill-port/PATCHES.md`:
  - what each edit is;
  - how it was applied (`lead/merge_live.py`);
  - its verification: 3 review rounds, 3 QA runs, the 87-check acceptance harness, and a smoke test of the live install.

## What this means when you merge
1. **Never restore `snap/` over live.** It would delete the port. Merge your worktrees onto the current live instead.
2. Then re-apply the port's text edits:
   `python3 -E qa/hf02full-skill-port/lead/apply_pointers.py ~/.claude/skills/product-launch-sting`
   - It is idempotent: it checks every anchor before writing.
   - `--check` passes on all four of your worktrees today, and a simulated merge of all four GUIDE.md versions applies
     cleanly.
   - If you rewrite another anchored paragraph, it stops with "anchor found 0 times" and writes nothing. Add your wording
     as one more variant, then run it again.
3. None of your worktrees touches `audio.mjs`. Keep live's copy (it carries the film score).
4. Re-test, as listed in PATCHES.md "Re-applying after the fix round merges into live":
   - `work-A/tests/test_screen_bg.sh`: screen.mjs uses lv.mjs `loadSpec` / `compile` / `extractPlates` / `serve` /
     `launch` and the stage's `LV.seek` / `.lv-screen` / `heroF`.
   - QA run 1: the `bg:` contract.
   - `work-B/tests/final.sh` and QA run 3: `music: film` and `hit:` go through spec / timeline compile.
   - **wt-tools' breakdown.mjs changes the recreate numbers.** higgsfield02's tempo confidence goes from 0.941 to 0.55
     (`offBeat: true`); our film.mp4 stays at 0.745, and the verdict stays ON THEIR BEAT. Update RECREATE.md's worked
     example ("confidence 0.75 vs 0.94") and re-run QA run 2.
   - Your own `fix/regress` set, with the port on top.
   - `bash qa/hf02full-skill-port/acceptance/run.sh <dir> [--allow-live]`. Its static checks compare against
     `live-before/`, so re-baseline them for the merged tree first.
5. **Old jobs:** `audioPrint` hashes audio.mjs, so an already-finished job's `lv.mjs --qa` fails its `audio` check until
   `--audio` is run once. That run rebuilds byte-identical stems. Your engine changes will do the same to the shot prints.

## Follow-ups the port left for this fix round (not done; the port is additive only)
- **GUIDE.md:**
  - `--storyboard/--film [--aspect all]` reads as if one aspect were the default, but every aspect in beats.yaml is
    rendered.
  - The render-time and disk estimates predate footage. Footage frames are about 840 KB each (1.9 GB for 37.75 s at
    16:9), far above "~300 MB per 20 s per aspect".
- **`lv.mjs --grid`** could echo the music settings it compiled (style, BPM, key, `hit:`). Today it prints only the BPM.
- **deliver.mjs `-aac_pns 0`:** it would change every style's encode, so it was left out. The film style works around AAC
  noise substitution with its own music bus.
- **conform.py's grade depends on width.** `curves` and `colorbalance` run on ffmpeg's default RGB conversion, which reads
  about 1.8 code values dark at widths that aren't a multiple of 16, and treats untagged clips as BT.601.
  - The fix is accurate swscale flags plus BT.709 input tags before the grade. That changes conform/pin outputs, so it is
    its own change.
  - look.py already decodes exactly.
