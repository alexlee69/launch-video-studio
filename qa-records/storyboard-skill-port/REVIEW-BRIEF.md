# Review brief: the storyboard port (product-launch-sting skill, 2026-10-25)

You are reviewing new code and docs added to a video-making skill. Find real defects; do not edit any skill file.

## What was added

- `~/.claude/skills/product-launch-sting/video/storyboard/placeholders.py`: draws labelled placeholder "plates"
  (stand-in PNG stills) for AI-footage shots that don't exist yet, from a JSON spec, so a film can be storyboarded
  before anything is generated. Commands `init`, `check`, `draw`, `status`.
- `~/.claude/skills/product-launch-sting/video/storyboard/phone.mjs`: turns the storyboard board that
  `lv.mjs --storyboard` already wrote (`out/<cut>/<aspect>/board/board.html`) into a phone-sized PDF of JPEG pages.
- `storyboard/starter.json` (what `init` writes), `storyboard/examples/manus2-space-cover.yaml` (a worked cover).
- `~/.claude/skills/product-launch-sting/video/STORYBOARD.md`: the user guide for both tools.
- Doc edits to `SKILL.md`, `video/GUIDE.md`, `video/RECREATE.md`, `video/FOOTAGE.md`; the exact edits are in
  `qa/storyboard-skill-port/apply_pointers.py`, the pre-edit copies in `qa/storyboard-skill-port/rollback/`.
  The RECREATE.md section "The story: keep its engine, change its world" encodes a user's feedback; its source is
  `~/.claude/projects/-Users-bytedance-Downloads-Design-AutoPilot/memory/feedback_keep_reference_story_engine.md`.

Context you may read (do not edit): `video/lv.mjs`, `video/lib/board.mjs` (writes board.html), `video/lib/server.mjs`,
`video/lib/render.mjs`, `video/lib/common.mjs`, `video/engine/runtime.js` (how a shot's `bg:` image is drawn: object-fit
cover, centred), `video/CASTING.md` and `video/casting/casting.py` (a sibling tool: the house style for specs, refusals
and exit codes), and the job tool phone.mjs was generalised from:
`~/Downloads/launch-videos/manus2-space/tools/phone_storyboard.mjs`.

## What the tools must guarantee

placeholders.py
1. No network, no paid call, no image read except its own output and fonts. Same spec → byte-identical PNGs.
2. The whole spec is validated before anything is drawn; every problem is listed at once; unknown keys and unfilled
   `<placeholder>` text are refused. Exit codes: 0 done, 1 done with warnings / `status` found placeholders, 2 refused,
   5 unexpected, 130 Ctrl-C.
3. It never replaces a file that is not one of its own plates (PNG text chunk `lv-placeholder`), never writes through
   a symlink, never writes outside the job folder (`root`), writes atomically and leaves no temp file.
4. `status` reports exactly the shots in `out/<cut>/timeline.json` whose image fields still point at a marked plate.
5. Crop guides match how the engine cover-crops a `bg:` image for another aspect; the label and the END inset stay
   inside every crop; it warns when a person or prop leaves one.
6. Runs on macOS `/usr/bin/python3` (3.9) with numpy and Pillow only.

phone.mjs
7. Reads the board as written; never re-renders. Refuses (exit 2) a missing timeline or board, a board older than
   `beats.yaml`, a board whose card count differs from the timeline, a bad flag, a bad cover file, a card that cannot
   fit a page even with its still halved. Exit 1 only when the PDF is over `--max-mb` (still written). 5 unexpected.
8. Writes only `out/<cut>/<aspect>/board-phone/` and `<slug>[-<cut>]-storyboard-<aspect>-phone.pdf` (atomically); the
   PDF is valid and embeds the JPEGs untouched; no text layer.
9. For 16:9 with the worked cover it reproduces the job tool's pages byte for byte (QA proves this today).
10. Works for 16:9, 9:16 and 1:1 boards and for cutdowns (`--cut`).

Docs
11. STORYBOARD.md matches the code (commands, keys, defaults, ranges, exit codes, file paths); the GUIDE / RECREATE /
    FOOTAGE / SKILL edits are accurate, consistent with each other and don't contradict the rest of those docs.
12. The story-engine section is faithful to its source memory note and doesn't overstate it.

Constraints the port chose on purpose (not defects): `lv.mjs`, `lib/**` and `engine/**` are untouched (a separate
merge depends on it); the plates are simple framing guides, not art.

## How to work

- Read the code first. You may run the tools, but only inside your own folder
  `qa/storyboard-skill-port/review-<you>/work/` (make a job there with `node ~/.claude/skills/product-launch-sting/video/lv.mjs --job <dir> --init`).
  Do NOT run `qa/storyboard-skill-port/run_all.sh` or the test_*.py suites (they share output folders with the author).
  Python: `/usr/bin/python3 -B`. Nothing you need costs money; never call a paid API.
- Write your report to `qa/storyboard-skill-port/review-<you>/REPORT.md`: one numbered finding per defect with
  severity (high / medium / low), file:line, what goes wrong, a concrete repro (input → wrong output), and a suggested
  fix. Mark what you verified by running vs. by reading. Skip style nits unless they mislead a user.
- End your reply with the number of findings by severity.
