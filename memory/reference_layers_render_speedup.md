---
name: reference-layers-render-speedup
description: "What speeds up headless-Chrome layer/clip renders without changing pixels, and what silently changes them (mode B --layers, measured 2026-10-21)"
metadata:
  node_type: memory
  type: reference
  originSessionId: 9c762f9b-f379-42e6-9001-0bfe49356c93
  modified: 2026-10-21T08:55:48.524Z
---

Measured while making product-launch-sting `lv.mjs --layers` 1.86× faster with byte-identical output (2026-10-21):
- **One Chrome = one 60 Hz frame clock for all its pages.** Passes run concurrently inside one browser take as long as sequential; separate Chrome instances scale (6 passes: 19.7 s → 11.3 s with 3), then the CPU is the limit. ~3 GB peak per Chrome.
- **Reusing a page for the next pass is pixel-identical** if it repeats the full warm-up (seek every shot's hero + screenshot) and the same per-page frame runs. **Warming up only the target shot is NOT** — Chrome composites some runs differently (will-change card, field tiles). Never trim the warm-up.
- Node QA on 16-bit frames was **pipe-bound on the main thread** (64 KB pipe reads), not compute-bound: move pipe reading into worker threads.
- ffmpeg 8 decoders blocked on a pipe hold their **scheduler queues** (~0.3–0.5 GB each); `-threads 1` + output `-thread_queue_size 1` → ~0.2 GB, same bytes. ProRes encode/decode bytes don't depend on thread count.
- **WebM (libvpx) file bytes differ on every encode** (Matroska random IDs); compare decoded framemd5, never file hashes.
- Some frames are run-to-run unstable in Chrome itself (2–5 px, ≤ 8 code values) — before blaming a change, re-run the OLD code and compare.
- A Chrome launch can wake Google's updater + crashpad handler, which inherit Chrome's stdout/stderr: Node then waits minutes after finishing. `--layers` exits explicitly; `--film`/`--clips` still exposed.
- Lid-close sleep stalls long renders ([[project-bot-mac-sleep-freezes]]): run sweeps under `caffeinate -s` (keeps a clamshell Mac on AC in DarkWake).

Related: [[reference-chrome-layer-separation-traps]], [[project-launch-video-mode-b]], [[reference-ffmpeg8-mux-traps]].
