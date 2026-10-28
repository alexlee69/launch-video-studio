# Review brief: the shot-writer port (2026-10-26)

You are reviewing an uncommitted change to a video-making skill at `~/.claude/skills/product-launch-sting/` (below,
`$V` = its `video/` folder). Find **real defects**: things that would make a wrong prompt, a wrong or lost file, a
refusal that should have happened and didn't (or one that fires wrongly), a spend without a quote, or a doc that says
something the code doesn't do. Style opinions are not findings.

## What the change is meant to do (Alex's approved plan, in short)

1. **A shot writer** (`$V/shots/shots.py`, new): any input (a few sentences, a script, a rough storyboard) becomes
   `tools/shots.json`; it compiles each AI-footage shot's key-frame prompt (a still made by `casting.py` from
   character sheets) and video prompt, for the model Alex picks each time: **H3** (a short motion brief) or
   **Seedance 2.5** (a long block prompt: REFERENCES, SCENE, FIRST FRAME, OPTICS, CAMERA, FINAL FRAMING, timed ACTION
   with lip-synced dialogue, BODY AND PHYSICS, LIGHT, COLOUR, REALISM, AUDIO, LOCKS), and lints both before any spend.
   Alex's own words stay verbatim (`brief`, `script`); Claude's additions are listed in `proposed` until `confirm`.
   Recipes in `$V/shots/recipes.json`. Proof: The Lull's 19 sent H3 prompts compile byte for byte
   (`$V/shots/examples/manus2-space-shots.json`).
2. **Seedance through `gen.mjs`** (`$V/footage/gen.mjs`, edited): `--endpoint bytedance/seedance-2.5/image-to-video`
   with `--res 480p|720p`, `--sec 4-30`, `--end`, `--audio on|off`; a dry-run quote until `--go`; the prompt keeps its
   line breaks for Seedance only. The H3 and still paths must be unchanged.
3. **Casting upgrades** (`$V/casting/casting.py`, `starter.json`, `CASTING.md` rules 13–17): opt-in snippets
   (`SHEET_POSE`, `PROPORTIONS`, `EYES_COVERED`, `READS`, `REF_*`), `{FOV:mm}`, a check that a prompt never names
   "Image N" beyond the images sent, `plan --show ID`, starter templates whose ids start with `_` (skipped).
   Old specs must plan exactly as before.
4. **Pencil position sketches** (`$V/storyboard/placeholders.py sketch`, edited; `STORYBOARD.md`): each storyboard
   plate drawn again as a hand pencil sketch with no text (red people, yellow heads and props, green ground line,
   grey place), `<ID>-sketch.png` + `<ID>-sketch.json` (legend, description, plate fingerprint). A shot uses one with
   `"position": {"plate": "S01"}`; `shots.py` sends it with the key frame, writes its legend into the key prompt and
   warns when the plate changed after the sketch. Plates (`draw`) must be byte-identical to before.
5. **Story and edit rules** and doc pointers (`SHOTS.md`, `GUIDE.md`, `FOOTAGE.md`, `SKILL.md`, templates).

## Where to look

- New: `$V/shots/` (shots.py, recipes.json, starter.json, examples/), `$V/SHOTS.md`.
- Edited (the pre-port copy of each is in `qa/shots-skill-port/rollback/`, so `diff` shows the change):
  `$V/footage/gen.mjs` (rollback/gen.mjs), `$V/casting/casting.py` (rollback/casting.py), `$V/casting/starter.json`
  (rollback/casting_starter.json), `$V/CASTING.md` (rollback/CASTING.md), `$V/storyboard/placeholders.py`
  (rollback/placeholders.py), `$V/STORYBOARD.md` (rollback/STORYBOARD.md), `$V/SHOTS.md` (rollback/SHOTS.md.pre-sketch
  is a mid-port copy), docs via `qa/shots-skill-port/apply_pointers.py`.
- Tests: `qa/shots-skill-port/test_flow.py`, `test_failures.py`, `test_parity.py`, `qa_lib.py`.
- Background: `qa/video-skill-learnings/BREAKDOWN-2026-10-26.md` (the two guides the plan came from).

Paths are under `/Users/bytedance/Downloads/Design-AutoPilot-stable/` unless they start with `~` or `$V`.

## Rules (hard)

- **Never edit the live skill** (`~/.claude/skills/…`) or anything outside your own work folder. Copy what you need:
  `cp -R ~/.claude/skills/product-launch-sting/video WORK/video`, and the QA folder without its `out/`.
- **Spend nothing, send nothing.** No `--go` on `gen.mjs` or `casting.py`, except `gen.mjs --go` against the mock
  (`qa/shots-skill-port/mockfal.mjs`) exactly as `test_flow.py` F8 does it: `FAL_QUEUE_URL` set to the mock, a fake
  `FAL_KEY`, and `HOME` set to an empty temporary folder. `casting.py --go` calls OpenAI: never run it.
- Run tools in scratch job folders inside your work folder; `/usr/bin/python3` (3.9, numpy and Pillow) and `node`.
- To run the suites on your copy: copy `qa/shots-skill-port` (without `out/`) into your work folder and run
  `SHOTS_QA_VIDEO=WORK/video /usr/bin/python3 -B test_flow.py` (and `test_failures.py`) from there. Don't run
  `run_all.sh` or `test_parity.py` (they run other ports' suites and would collide with the author's runs).
- Reproduce every finding before reporting it: the exact commands and what they print, against your copy.

## Report

Write `REPORT.md` in your work folder's parent (`qa/shots-skill-port/review-<you>/REPORT.md`): one entry per finding
with an id (your initial + number), severity (high: wrong prompt / lost file / spend / silent wrong result; medium: a
refusal or warning that misfires, a doc claim that's false; low: the rest), `file:line`, what goes wrong, the repro,
and a suggested fix. End with what you checked and found sound. Your final message: a short list of the findings
(id, severity, one line each).
