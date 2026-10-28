# Codex review (round 1 code), 2026-10-26: did not complete

The Codex run (read-only) read the brief, the Sonnet report and the round-1 files (about 30 read-only commands), then
stopped on its usage limit: "You've hit your usage limit … try again at 8:15 AM." No report body survived. Its last
progress note, verbatim: "The second-order pass is complete. I found several round-1 fixes that are only partial—
especially the output ownership guard, temp cleanup, staleness checks, and the 'three background settings' rule—and
separated those from genuinely new defects. No file under the skill or repository was modified."

That note is a pointer, not a set of findings: no file:line, repro or fix. The author examined the four named areas
against the code and found a real gap in each, fixed as round 2 (planted as C1–C4 in `test_review_fixes.py`; each but
C3a fails on the round-1 code):

- **"three background settings" rule (C1):** the engine also re-frames a `bg:` with the shot's camera fields (`zoom`,
  `offset`, `pan`, `move`; `engine/runtime.js` buildFoot + the camera). `status` and `phone.mjs` now flag those too and
  name the field; STORYBOARD.md says to leave them out and that a block's own motion (a `type` zoom-through, a sticker
  shake) still applies.
- **output ownership (C2):** the temp file was opened by name, so a link already sitting at the temp path was written
  through. Both tools now remove whatever is at the temp path and create it exclusively (`'xb'` / `flag: 'wx'`).
- **temp cleanup (C3):** `phone.mjs` had no Ctrl-C handler of its own and never swept a killed run's temp PDF; it now
  handles SIGINT / SIGTERM / SIGHUP and sweeps `<pdf>.tmp-<pid>` files whose process is gone. (C3a is a behaviour check:
  Playwright's own SIGINT handler already exited 130; C3b is the regression check.)
- **staleness (C4):** the board check ignored brand files (logo, font, cast art) and custom blocks; both now count.
  STORYBOARD.md notes the limit of an mtime check (a copy that keeps its old timestamp can slip past).

The "genuinely new defects" Codex mentioned are unknown. The final Opus review covers the round-2 code; a Codex re-run
is owed once its limit resets.
