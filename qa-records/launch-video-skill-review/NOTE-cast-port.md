# Note for the fix round: the casting port is in the live skill (2026-10-23)

Alex asked for The Lull's casting and key-frame tools to become part of the skill, together with how to make a proper character sheet (Higgsfield's one face per sheet). Nothing in `fix/` was touched. No engine file changed, so render fingerprints don't move.

## What changed in live

**New files.** All of them are in a new folder, `video/casting/`, plus one new doc.
- `video/casting/casting.py`: one CLI for the whole lane: `init`, `plan`, `candidates`, `review`, `lock`, `states`, `locations`, `pick`, `stills`, `fix`, `cost`, plus the free `pin`, `paste` and `restore`.
  - It runs on gpt-image-2 through the user's OpenAI key.
  - Every paid command is a dry run until `--go`.
  - Before any network call it refuses on the cap, a ban word, a placeholder, a missing reference or an existing output.
  - It keeps a ledger.
  - It imports `../footage/_media.py`.
- `video/casting/starter.json`: what `init` writes.
- `video/casting/examples/manus2-space-casting.json`: the worked example, built from the job's own sent requests.
- `video/CASTING.md`: the method, the steps and gates, the spec, cost, traps and the worked example.

**Edited docs.** These are in `qa/cast-skill-port/apply_pointers.py`, which is idempotent and was checked to rebuild live from `qa/cast-skill-port/rollback/`:
- `SKILL.md`: the description, still ≤ 1,024 characters, and one body sentence;
- `video/GUIDE.md`: the intro, step 5 of the workflow table and one line in the commands block;
- `video/FOOTAGE.md`: one paragraph before "When to generate here";
- `video/templates/assets-checklist.md`: one row.

## Merging the fix round

1. Merge `fix/` as planned. That means the hf02 port and then the hf01 port's `apply_pointers.py` (see `NOTE-hf02-port-merged.md` and `NOTE-hf01-port.md`).
2. Copy `video/casting/` and `video/CASTING.md` across unchanged.
3. Run `python3 qa/cast-skill-port/apply_pointers.py`. A NO ANCHOR line means the fix round reworded that spot, so re-apply that pair by hand.

**Tests:** `qa/cast-skill-port/run_all.sh` runs four suites; it needs no key and spends nothing.
- QA 1: parity with the job.
- QA 2: the flow, against a local mock API.
- QA 3: failure paths.
- QA 4: the review rounds' findings, each planted again.

At the 2026-10-23 push: 54 + 81 + 26 + 62 checks, all PASS.

**Review chain:** Sonnet (10 findings), then Codex (11), then Opus (12 plus doc notes). All were fixed and planted in QA 4. The round snapshots are `qa/cast-skill-port/rollback/casting.py.round0`–`round2`.
