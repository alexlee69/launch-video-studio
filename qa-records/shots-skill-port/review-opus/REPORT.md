# Final review (Opus): the shot-writer port after the Sonnet fix round, 2026-10-26

Saved by the author from the reviewer's hand-back message (subagents can't write report files). The reviewer tested a
copy of live `video/` taken at 06:28, re-checked byte-identical to live at 07:03 (`work/COPY-SHA1.txt` vs
`work/LIVE-SHA1-now.txt`), so every file:line is valid for the round-1 code (`rollback/*.round1`). Repro scripts:
`review-opus/work/repro/` (helper `rp.py` points qa_lib at the copy; jobs land in `repro/jobs/<name>`; run with
`cd …/review-opus/work/repro && /usr/bin/python3 -B <script>.py`, or `./lull.sh`, `./gen.sh`).

**Rules kept (reviewer's statement):** wrote only under `review-opus/work`; never touched `~/.claude/skills`; never
ran `casting.py --go`; its own gen.mjs runs were dry runs (test_flow F8's `--go` only against mockfal.mjs with a fake
key and a temporary HOME); did not run run_all.sh or test_parity.py.

## Summary

| Id | Sev | Where | One line |
|---|---|---|---|
| P1 | high | shots.py:961, 971-977 | Shot or key ids that differ only by case pass `check`; on macOS they share files: S01's prompt file ends up holding s01's prompt (exit 0), and casting.py would loop forever after paying for still s01 |
| P2 | medium | shots.py:310-329, 949-952; SHOTS.md:156 | `key_text()` merges the two snippet namespaces: (a) a casting.json snippet nesting a name both specs define is shown with this spec's wording but sent with casting.json's, and the warning says the opposite; (b) a casting.json snippet naming a shots.py built-in passes `check`, then casting.py refuses it |
| P3 | medium | shots.py:1162-1164, 1205-1212; SHOTS.md:238-240 | Hand-edit protection hashes only prompt+refs: an `n`, `dir` or `meta` edited in casting.json is silently replaced (exit 0), and `n` can only be set there |
| P4 | medium | shots.py:1207-1209, 1213-1217 | The "edited there since" refusal can't be cleared by its own advice: after the edit is moved into key.prompt (identical text) it still refuses |
| P5 | medium | shots.py:1221-1223; SHOTS.md:240-241 | The `--redo` advice (`stills --batch B --go --redo`) re-makes every still in the batch: 2 calls, $1.03, versus `--only S01` at 1 call, $0.52 |
| P6 | medium | shots.py:1143-1159 | `confirm` reads the spec without the duplicate-key guard and rewrites it: the first duplicate (Alex's verbatim brief) is lost, and `check` then passes |
| P7 | medium | shots.py:140-147; SHOTS.md:140 | S8 half fixed: combining marks split words (French in NFD form refused; a 6-word Hindi line counts 11, a 5-word Arabic line with vowel marks 20; Thai under-counted) |
| P8 | medium | shots.py:841-843, 859-862 | A Seedance beat timed past the shot's end only warns, and its line is measured against the whole beat: a 4.4 s line at 0:03-0:09 passes in a 6 s clip |
| P9 | medium | shots.py:1101-1104, 109; SHOTS.md:63-82, 196 | plan.json's Seedance line is `--res 720p` though SHOTS.md says drafts go at 480p first; `res` is missing from the key table and unvalidated ("480P" builds; H3 ignores it) |
| P10 | low | shots.py:206, 346, 841, 861, 870, 872, 1181, 1188 | Crash paths remain (exit 5): aspect "16:0", `t` with Infinity or a 400-digit integer, malformed casting.json fields (lock as a list, a still's meta as text, `dirs` or `sizes` of the wrong type); a 400-digit `count` compiles |
| P11 | low | shots.py:37, 887; casting.py:106, 402; CASTING.md:160-162 | The leftover-brace check misses unbalanced braces (`{FOV:35.`, `FOV:35}`, `{KEY_TAIL`) and any `{…}` over 80 characters, in both tools |
| P12 | low | shots.py:1083-1108 | plan.json keeps the rows of shots not rebuilt, unmarked, even after their spec changed (S01 switched to Seedance 8 s; its row still says H3 5 s) |
| P13 | low | shots.py:632, 765-771, 832-836 | On H3, a plain `say` in a two-person shot is refused although the line never reaches the H3 prompt; a beat that is only a line leaves the prompt with no action |
| P14 | low | shots.py:1133-1140 | `show S01` exits 0 with no ✗ for errors that block S01 but aren't prefixed `shots.S01` (the duplicate key-id error, "no model for S01", `people.hero: no sheet`) |
| P15 | low | shots.py:1193-1194; SHOTS.md:59, 77 | Hand-written `key.refs` are copied verbatim into casting.json, which resolves them from tools/; SHOTS.md says paths are job-relative, so `check` passes and `casting plan` then reports a missing reference |
| P16 | low | placeholders.py:1420-1438 | The legend promises a red cross even when every head faces away (none drawn); an off-frame glow alone adds "the GREY marks are the place…" with no place drawn |

## Sonnet's findings, as the reviewer judged the fixes

S1 fixed · S2 fixed · S3 fixed · S4 fixed · S5 partly (case-only ids and a trailing newline still pass: P1) · S6 fixed ·
S7 partly (unbalanced and long braces: P11; build/show expand `{FOV:n}` exactly as casting.py, 616 values, 0 diffs) ·
S8 partly (combining marks: P7) · S9 fixed · S10 fixed · S11 fixed (the `voiceover:` route is real, lib/spec.mjs:112-130)
· S12 fixed · S13 fixed (50 single-field plate edits: the hash changes exactly when pixels, legend or description
change) · S14 fixed · S15 fixed · S16 fixed · S17 partly (`{HOLD}` still names "the final framing" with no FINAL
FRAMING block: harmless) · S18 fixed (but stale rows: P12) · S19 partly (7 crash causes: P10; `confirm`: P6; `show`:
P14) · S20 partly ((a)–(c) fixed; (d) P3, P4, P5) · S21 fixed · S22 fixed for direct names (nested: P2) · O1 fixed ·
O2 fixed.

## Checked and found sound (reviewer)

The author's suites on its copy (48/48, 57/57, 54/54) and its own fresh probes (20/20); The Lull (20 H3 prompts
identical apart from the trailing newline gen.mjs trims; emit 19/19; casting `plan stills` exit 0; only the two
camera-move warnings); 61 old casting specs plan identically before and after (two expected exceptions); placeholders
`draw` byte-identical across pre-port, round 0 and fixed, sketch pixels unchanged; importing placeholders.py into
shots.py has no side effects; plain snippet names display exactly what is sent; gen.mjs's refusals and dry runs; all
15 recipes consistent on HOLD and "straight lines"; a 37,929-run fuzz found no other crash signature.
