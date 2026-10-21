---
name: reference-chrome-layer-separation-traps
description: Why a Chrome element renders differently alone than in the full frame (layer exports) — compositing triggers found in mode B and the fixes
metadata:
  type: reference
---

Rendering each layer alone (others `visibility: hidden`) only restacks exactly if Chrome rasterises the same way in every pass. It doesn't whenever it decides to composite part of the page on its own (then rasterises it separately and resamples it, depending on what else is visible and on the frames rendered before — history-dependent). Triggers found 2026-10-20, all fixed in the product-launch-sting mode B engine:
- `will-change: transform` on children (the clipped phone composited only while items were visible; once even cropped).
- A transformed element (even `rotate(0deg)`) or a rotating spinner inside a container with opacity < 1 or a changing scale → spinner rewritten as SVG stroke-dashoffset, endcard logo `transform: none` until its fade ends.
- Content overflowing its box / outside the frame under the moving camera (field tiles flung out) → `.lv-content` gets a transparent 3W×3H border AND a per-frame `overflow: clip` + `overflow-clip-margin` = what the camera sees. Still composites in a field zoom-out exit with --with-transitions (documented limit).
- Little or no text in a pass rasterises differently → a full-stage transparent text block (`.lv-anchor`) in every render.
- `backdrop-filter` (glass) can't be split exactly. Chrome flags (--disable-gpu*, msaa, low-res tiling, partial raster) change nothing.
Diagnose with DevTools `LayerTree.layerTreeDidChange` (count drawing layers; enable AFTER the page loads, not before goto). Harness trap: jumping seeks (frame 60 → 70) changes output; only contiguous frames are comparable.
