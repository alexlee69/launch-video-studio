# First review (Sonnet): the shot-writer port, 2026-10-26

Saved by the author from the reviewer's hand-back message (the reviewer's own Write was refused for subagents). The
reviewer's repro script and outputs are real files: `review-sonnet/work/repro/repro_all.py` (one job per finding
under `work/repro/jobs/<ID>/`), its full output `work/repro/OUTPUT.txt` (section `## S<n>`), suite logs
`work/suite_failures.log` and `work/suite_flow.log`, probes in `work/probe/`. The copy it tested is byte-identical to
live at review time (`work/COPY-SHA1.txt`), so every `file:line` below is valid for the round-0 code
(`rollback/*.round0`).

**Rules kept (reviewer's statement):** nothing outside `review-sonnet/` was written; no `--go` on casting.py; gen.mjs
`--go` only against mockfal.mjs with a fake key and an empty HOME; run_all.sh and test_parity.py not run.

## Summary

| Id | Sev | Where | One line |
|---|---|---|---|
| S1 | **high** | shots.py:607-619 | A spoken line's speaker is guessed: no `who` becomes "She"; a typo, an absent person or "Narrator" becomes an on-screen lip-synced speaker; "the founder" becomes a voice from an object. `check` is clean |
| S2 | **high** | shots.py:320-327, 920 | Seedance accepts fractional `sec`; the gen line rounds half-to-even (6.5 s gives `--sec 6`, 4.5 gives 4), so the last beat is cut off in a paid call |
| S3 | medium | shots.py:239-243 | SHOTS.md says `casting` defaults to `casting.json`; the code has no default, so every sheet/location check silently disappears |
| S4 | medium | SHOTS.md:37 | "No prompt goes to a paid call with unconfirmed proposals" is not enforced: `build` and `emit-casting` write everything (exit 1) |
| S5 | medium | shots.py:89, 991-1011 | `emit-casting`: two shots with one `key.id` silently overwrite each other; an unsafe `key.id`/`key.dir` is written and then every casting command exits 2 |
| S6 | medium | casting.py:398-400, 1069-1082 | The new "Image N" check refuses the pre-pick lock quote of an old spec (pre-port exit 0, now exit 2) |
| S7 | medium | casting.py:104, 201-221 | A malformed `{FOV:…}` (`{FOV:35mm}`, `{FOV: 35}`, `{fov:35}`) is neither expanded nor refused and reaches the prompt as literal braces; `build` also leaves a good `{FOV:35}` unexpanded |
| S8 | medium | shots.py:113-114, 726-729 | The words-per-second check counts ASCII words only: a 6-word French line is refused, a 43-character Chinese line passes |
| S9 | medium | shots.py:596-598 | A Seedance shot without `audio` gets no AUDIO block and no "No music" (gen.mjs sends sound on); an `audio` list without the voice contradicts the dialogue |
| S10 | medium | shots.py:554-556 | OPTICS always ends "straight lines stay straight", contradicting the barrel-distortion lens of `pov-action-cam` and `selfie-card` |
| S11 | medium | SHOTS.md:133, 174, 190 | Two dialogue claims the code does not back: "use the clip's own audio" (every conform step drops it) and "on H3 the line becomes a subtitle or a voiceover" (the quoted line is in the H3 prompt) |
| S12 | medium | shots.py:31, 761-780, 705 | Alex's own verbatim words trip the lint: `<beat>` in a script is refused as an "unfilled hint"; "in the style of" in a brief warns for ever |
| S13 | medium | STORYBOARD.md:130; placeholders.py:983, 1464-1470 | "A tag or a colour doesn't count" is false: prop, glow and horizon colours and other never-drawn keys mark a sketch stale |
| S14 | medium | shots.py:434-437, 507 | A listed product with no `ref` vanishes from the key prompt; `key: {}` compiles a key prompt with no description of the frame. Both check clean |
| S15 | medium | shots.py:576-579 | `count: 1` with two people listed compiles "the people in it (A and B)" next to "Exactly one person is visible" |
| S16 | low | shots.py:471; recipes.json | Seven recipe distances produce "from about about 40 m" and "from about at seated eye level" in the key and OPTICS text |
| S17 | low | shots.py:520, 559, 564-570 | A beat without final punctuation runs into the speaker sentence; `{HOLD}` ("The move eases in…") is appended to "Locked off." |
| S18 | low | shots.py:924 | `build S02` rewrites `plan.json` with only S02 |
| S19 | low | shots.py (several) | Type slips crash with a traceback (exit 5); duplicate JSON keys silently drop the first; `show S1` prints and exits 1 for S10's warnings |
| S20 | low | SHOTS.md, placeholders.py:1431 | `links`, `extras` and `fps` do nothing; the legend calls the red cross yellow; the shot aspect is never checked; a re-emit silently overwrites hand edits and a made still is not regenerated |
| S21 | low | gen.mjs:56, 131 | `--end`/`--audio` are now silently accepted by `still`, `raw` and `fetch` (they were "unknown option"); "fal refuses a wrong field before charging" is unverified |
| S22 | low | shots.py:227-237 | shots.py's built-in snippet names (`BODY`, `HOLD`, `MEDIUM`, …) silently shadow same-named snippets in casting.json |

## Findings (as reported)

**S1 · high.** `say` needs no `who`; `speaker()` guesses: no `who` gives "She"; an unmatched `who` (a typo, a person
not in this shot, "Narrator", "VO") compiles as `<who> says, lip-synced …`; a `who` starting with "the " ("the
founder", "the woman by the window") compiles as `From the founder, a voice says …` with no lip-sync. `check` exits 0.
Fix: require `who`, or default to the shot's only person; accept only this shot's people (lip-synced), its products,
or an explicit voice marker; refuse anything else; drop the "the …" heuristic.

**S2 · high.** Only H3 insists on whole seconds; a 6.5 s Seedance shot checks clean and `build` writes
`--sec %d` of `int(round(sec))`: 6.5 → 6, 4.5 → 4 (half to even), 7.5 → 8. gen.mjs takes whole seconds. The last
beat is cut off in a paid call. Fix: refuse a non-integer `sec` on Seedance; never `round()`.

**S3 · medium.** SHOTS.md says `casting` defaults to `casting.json`; the code returns None without the key, so every
sheet and location check disappears (`✓ … exit 0` on a spec naming a sheet that doesn't exist). Fix: default it.

**S4 · medium.** SHOTS.md: "No prompt goes to a paid call with unconfirmed proposals." `build` and `emit-casting`
write everything with exit 1. Fix: refuse in build/emit, or reword.

**S5 · medium.** (a) Two shots with the same `key.id` both pass; emit writes both and the second replaces the first.
(b) `key.id: "../evil"` / `key.dir: "../../etc"` pass check, are written into casting.json, and every casting command
then exits 2. Fix: validate both; refuse duplicate effective ids.

**S6 · medium.** `cmd_plan` quotes the lock before the pick with a pseudo-request of `refs = []`; the new Image-N check
counts 0 images, so an old spec whose lock prompt says "Image 1 is the picked candidate sheet" is refused in `plan`
(pre-port exit 0). Fix: count that request as one image, or skip the check for it.

**S7 · medium.** `{FOV:35mm}`, `{FOV: 35}`, `{fov:35}`, `{FOV:35,5}` are neither expanded nor refused (casting plan
exit 0; a `--go` would send literal braces). shots.py's check passes the literal too, and `build`/`show` never expand a
good `{FOV:35}` (the key text differs from what casting sends). Fix: refuse any leftover `{…}` after expansion; expand
`{FOV:n}` in shots.py.

**S8 · medium.** `words()` counts `[A-Za-z0-9'’]+`: accented words split (a 6-word French line counted as 10 and
refused), CJK counts 0 (a 43-character Chinese line passes). Fix: Unicode words; CJK characters counted separately.

**S9 · medium.** A Seedance shot without `audio` gets no AUDIO block and no "No music" while gen.mjs sends sound on;
an `audio` list without the voice says "exactly these sounds and nothing else: the hum of the city" right after a
lip-synced line. Fix: always "No music"; warn without `audio`; include the voice when there is dialogue.

**S10 · medium.** OPTICS always ends "straight lines stay straight", contradicting `pov-action-cam`'s barrel
distortion and `selfie-card`'s wide-angle distortion. Fix: only for a rectilinear lens.

**S11 · medium.** (a) "Use the clip's own audio for its dialogue": conform.py, pin.py and plates.py drop the audio and
FOOTAGE.md says not to mine it; no step carries the generated dialogue into the film. (b) On H3 "the line becomes a
subtitle or a voiceover", but the quoted line is in the H3 prompt next to "No text". Fix: document a real route for
the dialogue; drop the line from the H3 prompt or say it stays.

**S12 · medium.** (a) `holes()` runs over `brief`/`script` with a pattern flagging any `<lower…>`: a script with
`<beat>` is refused. (b) "in the style of" is checked on the raw spec, brief included, so it warns for ever. Fix: skip
Alex's verbatim fields; run the style test on compiled prompts.

**S13 · medium.** The fingerprint hashes the raw plate minus a few keys: a prop colour, a glow colour or strength,
horizon `color2`/`line`, or an explicit default `alpha: 1` mark a sketch stale though none is drawn. Fix: hash what
the sketch draws, or correct the doc.

**S14 · medium.** (a) A listed product with no `ref` vanishes from the key prompt (no image, no anatomy, no
colourway), silently. (b) `key: {}` compiles a key prompt with nothing describing the frame. Both check clean.

**S15 · medium.** `count: 1` with two people compiles "the people in it (A and B)" beside "Exactly one person is
visible".

**S16 · low.** `lens_text()` writes "from about %s"; seven recipe distances already start "about …" or "at seated eye
level": "from about about 40 m", "from about at seated eye level".

**S17 · low.** (a) A beat `do` without final punctuation runs into "The founder says …". (b) `{HOLD}` is appended to
"Locked off.", and "the final framing" has no referent without `final`.

**S18 · low.** `build S02` rewrites `plan.json` with only S02 while S01/S03's prompt files stay.

**S19 · low.** (a) Wrong-typed values crash with a traceback, exit 5 (26 crash signatures in a fuzz of ~4,500 runs:
`model: []`, `text: "x"`, a 400-digit `sec`, `motion.camera: 5`, `products.X.colourway: 5`, `key.id: [..]`,
`key.meta: 5` in emit). (b) Duplicate JSON keys silently keep the last. (c) `show S1` collects `S10`'s messages by
prefix.

**S20 · low.** (a) `links`, `extras` and `fps` reach no prompt. (b) The legend calls the cross yellow; it is drawn in
red. (c) A shot `aspect: "9:16"` writes "9:16" into the key prompt while casting still makes 2560×1440. (d) A re-emit
silently replaces a hand edit in casting.json, and a still that already has variants is not regenerated without
`--redo`, with no word from emit.

**S21 · low.** (a) `--end`/`--audio` are now accepted and ignored by `still`, `raw` and `fetch` (pre-port: "unknown
option"). (b) "fal refuses a wrong field before charging" is unverified; if fal ignores an unknown field the charge
could differ from the quote.

**S22 · low.** `key_text()` lets shots.py's built-ins (`BODY`, `HOLD`, `MEDIUM`, …) override same-named snippets in
casting.json, in build and emit alike.

## What the reviewer checked and found sound

The author's suites on its copy (57/57, 48/48); The Lull 20/20 and emit 19/19; image numbering with five references
across shots.py and casting.py; Seedance vs gen.mjs (REFERENCES = the key frame, block order, 23 old-vs-new dry runs
identical apart from the price line, usage text and the new message; the mock POST fields; key never printed; resume
via fetch; a second `--go` refused); placeholders.py (`draw --sheet` byte-identical; `status` identical on three
timelines; `sketch` deterministic across PYTHONHASHSEED/cwd/folder names; refusals; plate and sketch agree on
blocking; ~300 random valid plates, 0 crashes); casting.py (The Lull plans identically; `{FOV:35}`; `_` entries
skipped); all 15 recipes compile on both models; refusals write nothing; `init` never overwrites; `confirm` keeps
Alex's words.

## Observations (not defects)

- With two or more people the red mannequins are identical; "the RED marks are the people" can't say which is which
  (the sidecar's `says` is never sent). A hand legend can.
- shots.py's `ban` never reads casting.json's `ban`.
- `init --model seedance` writes an H3-shaped starter (untimed beats, no `scene`), so the first `check` refuses it.
- Unverifiable here: fal's Seedance field names and prices.
