# Post-merge fix: text notes in frame order (2026-10-27)

**Found by:** the new-Mac restore test (`launch-video-studio/setup.sh`, run in an empty test home folder). The fresh
install rendered the Wayfinch film identical to the shipped one (PSNR inf, WAV byte-identical), but its 16:9 storyboard
differed. The pixels were the same; the "Notes before the film" box listed the same warnings in a different order.

**Cause:** `renderFrames()` (video/lib/render.mjs) runs two Chrome workers, and each pushes its text audit when its frame
finishes. The audits came back in finish order, so a long note (cut at 8 items, "… (15)") showed different items run to run.

**Fix:** one line before the return: `audits.sort((a, b) => a.k - b.k)` (frame order). Every caller looks audits up by
`k` or iterates them for notes, so only the order of notes changes.

**Checked:**
- three 16:9 storyboards in a row: the same within the wall's known raster noise (max 8 of 255 on 0.001 % of pixels);
- the sample job's storyboards rebuilt (`motion-kit-sample/wayfinch-storyboard-*`); the old ones are in `boards-before/`;
- the shot-writer and storyboard suites' engine fingerprints (`rollback/pre.sha1`) re-taken for render.mjs (old lists kept
  as `pre.sha1.before-audit-order`), then all suites run: `run_all-after-audit-order.txt`.

**Undo:** copy `render.mjs.before-audit-order` back to `~/.claude/skills/product-launch-sting/video/lib/render.mjs`.
The motion-kit `rollback.sh` still works: render.mjs is one of its 35 files, so it goes back to `live-before/` as well.
`live-after.sha1` now differs from live in this one file.
