# Acceptance harness: first run on staging, before the review fixes (2026-10-22)

The lead saved this summary because the harness refuses report files from subagents. The full report is in
`runs/staging-2/report.txt`, and the catalogue of checks is in `README.md`.

- **Result:** staging passed **79 PASS, 0 FAIL, 0 SKIP** in about 9 minutes, exit 0.
- **Command:**
  `bash acceptance/run.sh /Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/stage/product-launch-sting`.
  Exit 0 means no FAIL, 1 means a FAIL, 2 means it couldn't run. `run.sh --self-test` takes about 25 minutes and needs
  no worker code.
- **How the checks were built:** black-box, from DESIGN.md only, including the lead's key-order change. They cover:
  - 9 static checks;
  - 25 for gen.mjs against a mock fal server on random high ports;
  - 14 for look, conform and pin, using frame-index barcode fixtures;
  - 22 for compare, track, music and temptrack, with a tampering `ffmpeg` shim on PATH;
  - 9 for the film style, with 9 old jobs byte-identical to the live skill.
- **Proof the checks can fail:** each check FAILs on at least one planted bad input. The full self-test held 228/235
  proofs; the 7 misses were bugs in the planted inputs, which were fixed and re-proven.
- **Where the monitor saw staging differ from the spec:**
  - compare.py's built-in detector finds 25 cuts on hf02, not today's 22 (20 exact, 4 within 1 f, 1 off at n75). Worker
    B's report explains this: the detector is a fallback, and `--cuts-from` with a checked list is the path to rely on.
  - The monitor said compare.py `--half` gives a half-size side-by-side. **That is wrong.** The code plays it at fps/2
    with `atempo=0.5` (half speed), and B's A5b proves 210 frames at 15 fps.
  - track.py marks some pan frames "unreliable" (ncc < 0.9) that are tracked to within 0.1 px. This is information only.
- **What it can't check:**
  - the real fal service;
  - how the footage looks or the score sounds;
  - look.py's numbers for the reference plate and the carousel, which need crops the CLI doesn't have;
  - whether compare's detector is right where it disagrees with today's list;
  - options never exercised: track `--roi`/`--half`/`--init`, pin `--dark`, conform `--fps` other than 30, compare labels;
  - the riser, lift and bell bed;
  - the docs beyond key terms.

## Harness changes after r0 (2026-10-22, the lead)
- **Round 5 changed the static docs check's literal from `1\.10` to `1\.08`.** FOOTAGE.md now quotes the exact per-plate
  price, $1.08 (two stills at $0.12 plus 6 s at 1080P at $0.96), instead of the rounded $1.10. The new check passes on
  `stage-r5-final` and fails on `stage-r4-final-candidate`. The old runner is kept in `lead/suite_static.py.pre-r5-price`.
- **`run.py` and the slow download checks:**
  - **The bug:** the background `--part gen-slow` sub-run didn't inherit `--allow-live`, so on the live skill it refused to
    start, and the parent dropped `gen.download.exit5` and `gen.download.verify` without a FAIL. That run reported 76/76.
  - **The fix:** the flag is now passed on, and a sub-run that reports nothing counts as FAIL for both checks.
  - **Proof:** `lead/guard-test/guard_test.py` passes on the fixed runner and fails on the pre-fix one
    (`lead/run.py.pre-allow-live`), which exits 0 with both checks dropped.
