---
name: reference-video-motion-measurement
description: "How to measure a reference clip's camera/blur curves to rebuild its motion, and the render/compare traps hit doing it (2026-10-21)"
metadata:
  node_type: memory
  type: reference
  originSessionId: db3322f5-f4cf-44bc-bee5-82db478af53f
  modified: 2026-10-22T04:30:11.098Z
---

Used for [[hf02-motion-recreation]]. The scripts live in that session's scratchpad (copy the approach, not the paths):
- **Camera tracker**: per-frame similarity + gaussian-blur fit against a sharp key frame of the same shot. It uses numpy only (no cv2/scipy on this Mac), a bilinear warp, FFT blur and Nelder-Mead on NCC. ~10–15 s/frame at half res, so run one process per shot in parallel.
- **List/slot shots**: track the slot edge from a column profile where no text crosses it, and the list offset from frame-to-frame correlation of the text column's ink profile. Check the result against title tops.
- **Blur at cut frames is over-read ~2×** when other elements fade in at the same time. Calibrate by running the same tracker on your own render, where the applied sigma is known. Chrome applies SVG feGaussianBlur stdDeviation in CSS px, exactly.
- **Python here is 3.9**: no `-P`, and `-I` hides the user-site PIL/numpy. Run your own scripts from your own folder with `-E`.
- **Playwright traps**:
  - `page.setContent` can't load file:// fonts; use `goto(file://…)`.
  - Build text layout only after `document.fonts.load()`, or measured widths are fallback-font widths.
  - The first screenshot after load can catch half-rastered tiles: warm up, and double-rAF before each capture.
  - Fractional DSF 1920/1080 on a 1080×608 viewport gives 1081 rows; crop in ffmpeg.
- **Comparison video**: the source's timestamps are slightly irregular, so ffmpeg hstack/vstack/`-r` inserted or shifted frames (217 for 210). Compose side-by-sides in Python and pipe rawvideo; then verify every frame against both sources. `hf02-full/tools/sbs_full.py` does both in ~2 min. On the full film, ffmpeg hstack slipped 1411 of 1909 frames, and the two halves at different frames.
- **This Mac's ffmpeg has no `drawtext`** (no freetype): draw labels into an RGBA PNG with PIL and `overlay` it.
- **Cut checks give false alarms on our renders** (`hf02-full/tools/cutcheck.py`, NCC peak within ±4 f of each source cut). High-contrast moving content wins the peak: corridor lines read as "+4 f", and a bar whip over a continuous plate read as a "plate cut". Before telling a builder a cut is off, check the frames by eye and diff only the region away from the moving element.
