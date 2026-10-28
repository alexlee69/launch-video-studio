# Note for the fix round: the storyboard port is in the live skill (2026-10-25)

Alex asked for two things to go into the skill: the story-engine rule (from The Lull's story rejection on 10-23) and
the pre-footage storyboard (The Lull's placeholder plates and phone-sized storyboard PDF, made general). Nothing in
`fix/` was touched. **No engine file changed**: `lv.mjs`, `lib/**` and `engine/**` are byte-identical to before the port
(checked against `qa/storyboard-skill-port/rollback/pre.sha1` and the pushed backup), so render fingerprints don't move.

## What changed in live

**New files**, all in a new folder plus one new doc:
- `video/storyboard/placeholders.py`: labelled stand-in stills ("placeholder plates") for AI-footage shots, drawn in
  code from `tools/placeholders.json` (`init`, `check`, `draw`, `status`). Python 3.9, numpy + Pillow, no network.
  Each PNG carries a text chunk `lv-placeholder`; `draw` only ever replaces its own plates.
- `video/storyboard/phone.mjs`: the board `lv.mjs --storyboard` wrote, re-laid as 1080 × 1920 JPEG pages in a PDF.
  It imports `../lib/common.mjs`, `../lib/server.mjs` and `../lib/render.mjs` (read-only use) and the `yaml` package
  from `video/node_modules`.
- `video/storyboard/starter.json` (what `init` writes) and `video/storyboard/examples/manus2-space-cover.yaml` (The
  Lull's phone-storyboard cover, the worked example).
- `video/STORYBOARD.md`: the guide.

**Edited docs**, scripted in `qa/storyboard-skill-port/apply_pointers.py` (each edit has a marker and an anchor; the
script is idempotent and rebuilds live exactly from `qa/storyboard-skill-port/rollback/`):
- `SKILL.md`: one body sentence ("**Storyboarded before any footage**"); the description is unchanged (1,022 chars).
- `video/GUIDE.md`: the intro, workflow steps 2 and 4, two new rules ("Judge stories on fun", "Storyboard before any
  footage is generated"), two lines in the commands block.
- `video/RECREATE.md`: a new section **"The story: keep its engine, change its world"** after the copy trap, and one
  row in the "What we borrow" table.
- `video/FOOTAGE.md`: one bullet at the top of "When to generate here".

## Merging the fix round

1. Merge `fix/` as planned (the hf02 port, the hf01 port's `apply_pointers.py`, then `NOTE-cast-port.md`'s steps).
2. Copy `video/storyboard/` and `video/STORYBOARD.md` across unchanged.
3. Add `video/storyboard/*` and `video/STORYBOARD.md` to the acceptance harness's `ALLOWED_NEW`
   (`qa/hf02full-skill-port/acceptance/lib/suite_static.py`, line 12), next to the casting entries.
4. Run `/usr/bin/python3 qa/storyboard-skill-port/apply_pointers.py`. A `NO ANCHOR` line means the fix round reworded
   that spot: re-apply that pair by hand.
5. If the fix round changed `lib/board.mjs`'s board HTML (the `.grid > .card`, `.meta b`, `body>header span` structure)
   or `lib/server.mjs` / `lib/render.mjs`'s exports, re-run QA 1: `phone.mjs` reads that structure.

**Tests:** `qa/storyboard-skill-port/run_all.sh` (no key, nothing spent; it refuses to start with the lid closed, since
a sleeping Mac stalls Chrome mid-render).
- QA 1 parity: `phone.mjs` vs The Lull's own job tool on a copy of its board, 26 of 26 pages byte-identical (and
  identical to the pages sent on 10-23); plates deterministic; docs rebuild from rollback; no lv.mjs / lib / engine change.
- QA 2 flow: a fresh film job → plates → `bg:` → storyboard in 16:9, 9:16 and 1:1 → phone editions → `status` → plates
  swapped for real stills one by one.
- QA 3 failure paths: every refusal and warning.
- QA 4 review fixes: each review finding, planted again.

At the final run (2026-10-26): 15 + 24 + 51 + 66 checks, all PASS (`out/run_all-final.log`).

**Review chain:** Sonnet (17 findings), then Codex, which stopped on its usage limit before reporting (its last note
named four partly-fixed areas; the author found a real gap in each and fixed them as C1–C4, see
`review-codex/REPORT.md`), then Opus (15). All were fixed and planted in QA 4; each check was run against the code
before its fix and fails there, apart from five setup, control or behaviour checks (S6a, S8b, S11b, C3a, O1b). Reports are in
`qa/storyboard-skill-port/review-*/REPORT.md`; round snapshots in `qa/storyboard-skill-port/rollback/*.round0`–`round3`.
A Codex re-review is still owed.

**Merge traps:**
- `phone.mjs` takes a lock file `out/<cut>/<aspect>/board-phone.lock` and makes pages in `board-phone.tmp-<pid>/`;
  both are cleared by the next run when their process is gone.
- `placeholders.py` reads `aspects` from beats.yaml with a regex (no YAML library on `/usr/bin/python3`): flow style
  `aspects: [16x9, 9x16]` or a block list. If the fix round changes how beats.yaml spells aspects, check `job_aspects()`.
