# Note for the fix round: the shot-writer port is in the live skill (2026-10-26)

Alex had two Higgsfield guides studied (kaye.creatives' Oakley × Meta ad and the Claude Motion guide;
`qa/video-skill-learnings/BREAKDOWN-2026-10-26.md`) and approved five no-spend upgrades:
- a shot writer for any brief;
- the video model asked every time, with Seedance 2.5 taught to `gen.mjs`;
- better character sheets;
- pencil position sketches;
- a recipe book with story rules.

Nothing in `fix/` was touched. **No engine file changed**: `lv.mjs`, `lib/**` and `engine/**` are byte-identical to the
pushed backup, so render fingerprints don't move. It builds on the storyboard port (`NOTE-storyboard-port.md`), which
is also in live and uncommitted: merge that one first.

## What changed in live

**New files:**
- `video/shots/shots.py`: the shot writer (`init`, `check`, `build`, `show`, `confirm`, `emit-casting`, `fov`).
  - Python 3.9, no dependencies, no network.
  - It reads `casting.py`'s snippet texts with `ast` (never imports it).
  - It loads `storyboard/placeholders.py` with `importlib` for one function, `plate_hash` (bytecode writing off), so a
    stale sketch is defined in one place.
- `video/shots/recipes.json` (15 shot recipes), `video/shots/starter.json` (no model in it: the model is asked),
  `video/shots/examples/manus2-space-shots.json` (The Lull, built by `qa/shots-skill-port/make_example.py`).
- `video/SHOTS.md`: the guide (the model question, intake, the spec, what gets compiled, checks, recipes, story and
  edit rules, Seedance through `gen.mjs`).

**Edited code** (each pre-port copy is in `qa/shots-skill-port/rollback/`):
- `video/footage/gen.mjs`: Seedance 2.5 image-to-video only, with:
  - `--res 480p|720p`, `--sec 4-30`, `--end`, `--audio on|off`;
  - its quote ($0.2205/s at 480p, $0.473/s at 720p: fal's page as found, unconfirmed from this Mac);
  - a Seedance prompt keeps its line breaks.

  The H3 and still paths print and send exactly what they did before.
- `video/casting/casting.py`:
  - nine new built-in snippets (opt-in), and `{FOV:mm}`;
  - a refusal when a prompt names "Image N" beyond the images sent;
  - `plan --show ID`.

  Every old snippet is unchanged; The Lull's casting example plans byte-identically.
- `video/casting/starter.json`: templates `_pose`, `_product-gold`, `_rider`, `_extra-1`, `_animal` (skipped while
  their id starts with `_`), `text.POSE`, a LENS GATE in the location starter.
- `video/storyboard/placeholders.py`: the new `sketch` command (pencil position sketches: `<ID>-sketch.png`, marker
  `lv-position`, plus `<ID>-sketch.json`).
  - `save()` and `is_sheet()` gained a `mark` parameter.
  - `sweep_temps()` also sweeps `.json` temps.
  - `status` names a shot that shows a sketch.
  - Plates are byte-identical to the pre-port tool's.

**Edited docs:**
- `video/CASTING.md` (rules 13–17, the spec's snippet row, the image-count rule, a trap) and `video/STORYBOARD.md`
  (the "Pencil sketches" section, a commands line, an exit-code cell, a trap): edited directly; diff against
  `rollback/`.
- `SKILL.md` (one body sentence; the description unchanged), `video/GUIDE.md`, `video/FOOTAGE.md`,
  `video/templates/footage-prompts.md`, `video/templates/brief.md`: by `qa/shots-skill-port/apply_pointers.py`.
  - 11 marker + anchor edits on top of the storyboard port's pointers.
  - It is idempotent, and it rebuilds live exactly from the rollback copies.

## Merging the fix round

1. Merge `fix/` and the earlier ports as their notes say (hf02, hf01, `NOTE-cast-port.md`, `NOTE-storyboard-port.md`).
2. Copy `video/shots/` and `video/SHOTS.md` across unchanged.
3. Copy the live `video/footage/gen.mjs`, `video/casting/casting.py`, `video/casting/starter.json`,
   `video/storyboard/placeholders.py`, `video/CASTING.md` and `video/STORYBOARD.md`, unless the fix round changed
   them. If it did, re-apply this port's diff against `qa/shots-skill-port/rollback/` by hand.
4. Add `video/shots/*` and `video/SHOTS.md` to the acceptance harness's `ALLOWED_NEW`
   (`qa/hf02full-skill-port/acceptance/lib/suite_static.py`, line 12), next to the casting and storyboard entries.
5. Run `/usr/bin/python3 qa/storyboard-skill-port/apply_pointers.py`, then `/usr/bin/python3
   qa/shots-skill-port/apply_pointers.py`. A `NO ANCHOR` line means that spot was reworded: re-apply the pair by hand.

**Tests:** `qa/shots-skill-port/run_all.sh` needs no key and spends nothing (`gen.mjs --go` only against
`mockfal.mjs` with a fake key and a temporary HOME). QA 1 renders in Chrome through the storyboard suite, so keep the
lid open.
- QA 1, parity:
  - The Lull's 20 prompts byte for byte, and `emit-casting`'s 19 stills;
  - the example rebuilt;
  - the engine, `gen.mjs`'s H3 and still dry runs, `casting.py plan` and the plates unchanged;
  - the docs rebuilt from rollback;
  - the casting and storyboard suites still pass.
- QA 2, flow: each input form through both models; plate → sketch → shot → key prompt → `casting.py plan`; Seedance
  through `gen.mjs` against the mock; the casting templates; the sketches (legend, determinism, aspects, staleness,
  `status`).
- QA 2b, casting through the mock: the starter's templates renamed as a user would, through `casting.py`'s real
  request path against `qa/cast-skill-port/mock_openai.py`. The new snippets arrive expanded, the references upload
  in order, the LENS GATE reaches the plate, and "Image 3" with two images is stopped before the API.
- QA 3, failure paths: every refusal and warning.
- QA 4, review fixes: each review finding, planted again.

**Review chain:** Sonnet, then Opus (Alex 10-26: skip Codex, Opus for the final review).
- **Sonnet** found 22 (2 high: a guessed speaker; Seedance lengths rounded onto the last beat). All were fixed and
  planted in QA 4 (`test_review_fixes.py`).
- `prove_round0.py` runs QA 4 against the code before the fixes (`rollback/*.round0`): every one of the 52 finding
  checks fails there, and the 2 controls pass on both.
- Its report is `qa/shots-skill-port/review-sonnet/REPORT.md`.

- **Opus** found 16 (1 high: ids that differ only by case share files on macOS, and casting.py would loop forever
  after paying for the second still). It also judged 15 of Sonnet's 22 fixed and 7 partly fixed; the gaps are among
  its 16. All were fixed and planted in QA 4; `prove_round0.py round1 --only P…` shows all 36 of those checks fail
  on the code before them (`rollback/*.round1`). Its report is `qa/shots-skill-port/review-opus/REPORT.md`.
- **The fixes reached past shots.py:**
  - `casting.py`: ids that differ only by case are refused, and so is any brace left after expansion (`\Z` in
    `SAFE_ID`);
  - `placeholders.py`: the legend names only what a sketch drew;
  - The Lull's example: its hand `key.refs` are job-relative now (`make_example.py`).

**At the final run (2026-10-26):** 17 + 48 + 16 + 57 + 90 checks, all PASS (`qa/shots-skill-port/out/run_all-r2.log`).
QA 1's parity includes the casting port's 223 checks and the storyboard port's suites.

**Alex's test:** a demo job is at `~/Downloads/launch-videos/shots-demo` (`TRY-IT.md`; rebuilt by
`qa/shots-skill-port/make_demo.py --fresh`). Every command on that page was run on a copy first.

**Merge traps:**
- **`shots.py` reads two neighbours by path:** `../casting/casting.py` (snippets) and `../storyboard/placeholders.py`
  (`plate_hash`). Moving either breaks a check quietly: the snippets go unexpanded, or the stale-sketch warning is
  skipped. QA 2 F7 catches the second.
- **The storyboard suite's doc check now layers this port's pointers on top.** Its P3b rebuilds GUIDE, FOOTAGE and
  SKILL from its rollback copies, runs its own pointer script and then this one, and compares the result with live.
  The pre-change test is kept as `qa/shots-skill-port/rollback/storyboard_test_parity.py`.
- **`gen.mjs` refuses Seedance reference-to-video.** Seedance animates the approved key frame, so `shots.py` compiles
  its REFERENCES block for that one image (no `@Image` tags). Wiring reference-to-video needs fal's real field names
  first.
