---
name: product-sting-recreation
description: "12s \"Frame by Frame\" product sting rebuilt from @notdwd's X prompt — lives in Design-AutoPilot-stable/product-sting/, delivered 2026-10-19, uncommitted"
metadata:
  node_type: memory
  type: project
  originSessionId: 27298075-5641-4a31-9fd2-82e27fc1cc9c
  modified: 2026-10-20T07:03:26.206Z
---

Recreated the X-post (x.com/notdwd/status/2104401208958230764) product-sting prompt with its defaults ("Frame by Frame" on Whop, FF viewfinder mark) and a synthesized 124 BPM soundtrack (user picked synth over the Mixkit download). Delivered `product-sting/out/frame-by-frame-sting.mp4` on 2026-10-19; nothing committed.

Pipeline: `stage.html` (seek(f) pure function, shots S1–S8) → `node render.mjs --film` (playwright-core + system Chrome, 720 frames @59.94 in ~40s) → `node audio.mjs` (+ `STEM=sfx` for a timing-QA stem) → `node master.mjs` (ebur128-solved gain + alimiter, −14 LUFS/≤−1 dBTP) → ffmpeg mux.

**Why:** user wants to reuse the prompt for their own brands with minimal effort.
**How to apply:** since 2026-10-20 the pipeline is packaged as the user-level skill `~/.claude/skills/product-launch-sting` (brand.json per job folder under `~/Downloads/launch-stings/<slug>/`, `build.mjs --init|--stills|--film|--audio`, `qa.mjs` 8 checks; reference brand reproduces the original). Use the skill for rebrands; never edit product-sting/ (kept untouched as the original). Test job: `~/Downloads/launch-stings/design-autopilot-test/`. The original mp4 lacks bt709 primaries/transfer tags (the skill's mux fixes it) — see [[reference-ffmpeg8-mux-traps]]. The mix was verified by meters only (band RMS, onset timing), never by ear — ask the user how it sounds before polishing audio. See [[feedback-qa-after-changes]].
