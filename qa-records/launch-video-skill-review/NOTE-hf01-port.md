# Note for the fix round: the hf01 port is in the live skill (2026-10-23)

The hf01 → skill port wrote this for the fix round. The port moved manus2-space's build method into the skill, so the
skill can now finish a recreation the way higgsfield01 was finished. Nothing in `fix/` was touched, and no engine file
changed: lv.mjs, lib/**, blocks/**, kit.js, art.js, _film.js / _reel.js, the audio code, package*.json, node_modules
and templates are byte-identical. Render fingerprints therefore don't move. Everything is uncommitted, like the hf02
port before it.

## What changed in live

**New files.** Each sits in a folder the fix round doesn't have, and the acceptance harness's ALLOWED_NEW covers all
of them. A snapshot of each is in `qa/hf01-skill-port/files/`, with a `SHA1SUMS` that matches live today.
- `video/footage/plates.py`: builds multi-leg footage plates at the clips' native 24 fps from a JSON spec. It checks
  each leg's window against its clip and joins the legs with xfade.
- `video/recreate/finish.py`: rebuilds the reference's 24p-in-30p cadence by index. Each shot runs on its own clock,
  from `out/main/timeline.json` or `--cuts`, clamped inside the shot. It also adds an optional corner bug, re-mixes the
  stems and masters them like the engine (−14 LUFS, TP ≤ −1 after AAC), muxes, and QAs. QA failures exit 1.
- `video/recreate/sfx.py`: a synthesized SFX kit plus an events spec. It is seeded, so the same spec always renders
  the same WAV.
- `video/recreate/corner-bug-hf01.json`: higgsfield01's watermark clock. The bug is optional and off unless `--bug`.
- `video/recreate/examples/manus2-space-plates.json` and `manus2-space-sfx.json`: the worked examples.

**Edited docs.** All of these edits are scripted in `qa/hf01-skill-port/lead/apply_pointers.py`. Each edit has a
marker and an anchor, and the script is idempotent.
- `video/RECREATE.md`:
  - the intro line;
  - pointers in §3, §5 and §7;
  - a new **§8 "Finish like the reference"** covering plates, cadence, per-shot clocks, sound grammar, loudness, the
    corner bug, QA and the traps;
  - a new **"Worked example: manus2-space"**.
- `video/FOOTAGE.md`: a new **"Multi-leg plates — `plates.py`"** section, and the H3-audio trap.
- `video/GUIDE.md`: three command lines after the hf02 `compare.py` line.

## What this means when you merge

1. **Merge onto live.** Never copy `snap/`, or wt-port's RECREATE.md / FOOTAGE.md, over live; the live copies carry the
   hf01 sections.
   - Live's RECREATE.md §4 also has a whoosh-tail sentence ("Only the music goes silent: … keeps its whoosh tail") that
     is not in wt-port's commit e13a024 either. Keep it.
2. **Then run both pointer scripts, hf02 first.** GUIDE.md's anchor is the hf02 compare.py line.

   ```bash
   python3 -E qa/hf02full-skill-port/lead/apply_pointers.py ~/.claude/skills/product-launch-sting
   python3 -E qa/hf01-skill-port/lead/apply_pointers.py ~/.claude/skills/product-launch-sting
   ```

   - Use `--check` to report only. If your round rewrote an anchored paragraph, the script stops with "anchor found 0
     times" and writes nothing.
   - Simulated merges were run in `qa/hf01-skill-port/lead/sim/`. Each fix-round tree took hf02's pointers, then
     hf01's, cleanly; a second run of hf01's reports "already applied" for every edit.
     - wt-engine, wt-film, wt-reel, wt-tools: SKILL.md, GUIDE.md, beats.yaml and spec.mjs.
     - wt-port: also RECREATE.md and FOOTAGE.md.
3. **If a new file went missing**, copy it back from `qa/hf01-skill-port/files/` and run
   `cd ~/.claude/skills/product-launch-sting && shasum -c <that folder>/SHA1SUMS`.
4. **Re-test:** `bash qa/hf01-skill-port/lead/tests.sh <run dir> [skill dir]`.
   - It takes about 15 min, writes `RESULTS.txt`, and exits 0 when every test passes.
   - It reads the manus2-space footage clips, `~/Downloads/higgsfield01.mp4`, hf01-study's `cuts/cuts.txt`, the
     hf01-study brand SVGs, and r1/'s snapshots (the baseline master, the job's stems and sfx.wav, and the plates
     that matched the job's byte for byte).
   - The final run is `qa/hf01-skill-port/r4/`.
5. **The acceptance harness needs no change.** fnmatch's `video/recreate/*` also matches
   `video/recreate/examples/*`, and RECREATE.md still matches every DOCS regex.

## Follow-ups this port left (not done)

- **lv.mjs has no edit grid.** A 24 fps-edit recreation still lays its shots at n/30 s, and finish.py corrects the
  phase per shot. A shot that starts on n % 15 = 0 and is 4 mod 5 frames long still holds its last picture for one
  frame; finish.py lists those frames, and manus2-space has none.
- **conform.py's `fps=30` phase.** Footage conformed to 30 fps repeats on {2, 7, 12}, not a reference's {5, 10, 14}.
  This is fine for the hf02-style 30p films it serves; the 24p route is plates.py plus finish.py.
- **Pick check on near-static frames.** finish.py's picks QA compares each output frame with master frames j ± 1.
  Where a shot is nearly static those frames are ties, so a wrong pick there can't be seen and isn't flagged. Footage
  phase is guaranteed by the index math, and `qa/hf01-skill-port/lead/shots_test.py` tests it end to end.
