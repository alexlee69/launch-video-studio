# Small items spec (2026-10-26, part of the plan Alex approved): shot writer phase 2, brief passport, skeletons

Plan: `qa/video-skill-learnings/TAKE-AND-HOW-2026-10-26.md` §3 "Small, any time". Research: the cinedance reader notes are
not in readers/; the source is `qa/video-skill-learnings/skills/cinedance-block-library/x/cinedance-block-library/SKILL.md`
— READ it as research only (never run/install anything there), take the ideas, and write everything in our own words:
never paste its block texts or phrases verbatim (Alex's rule: paraphrase the guides).
Hard rules from `SPEC-R1.md` ("Where to work" + hard rules) apply. Staging copy: `qa/motion-kit/stageS/product-launch-sting`.
Owns: `video/shots/` (shots.py, recipes.json, examples/), `video/SHOTS.md`, `video/templates/brief.md`, new
`video/templates/launch15.yaml` + `launch30.yaml` (+ any placeholder stills they need under `templates/placeholders/`),
and tests under `qa/shots-skill-port/` (new files only, plus run_all.sh's list). Do not edit `lv.mjs` (the lead wires the
two new `--kit` names in at merge: tell the lead the exact two-line change in your report).

## 1 · Shot writer phase 2 (cinedance ideas → `shots.py`)

Read `video/SHOTS.md` and `shots.py` first; keep every existing behaviour byte-identical (the parity suite rebuilds The
Lull's 20 prompts byte for byte; run `SHOTS_QA_VIDEO=<stageS>/video bash qa/shots-skill-port/run_all.sh` — ALL SUITES PASS
before and after). New, all optional, per shot in `shots.json`:
- **trick** — the one mechanical idea the shot is built on, one sentence (e.g. the camera rides the object while the world
  moves around it), plus its 3–4 consequences if given. Printed first in the action part of the prompt as the governing rule.
- **must** — the 1–2 rules that may not be sacrificed (printed as the shot's most important rules).
- **fail** — failure lines ("if the folder grows while dragged, the shot is wrong"), one per weak point.
- **refs[].dont** — per reference image, what NOT to take from it (people, lighting, grade, depth of field, framing,
  props…); printed in REFERENCES next to what to take.
- **task** — the character's small ongoing task they never abandon during the event.
- **acting** — {direction, motive, goal, obstacle, tactic} + optional eye beats on the timecodes; a restrained register
  option; gaze rules (never into the lens unless listed).
- **sizes** — key objects sized three ways (share of the frame, against the body, against the hand).
- **negatives** — inversions of the trick: written by Claude, so they live in `proposed` and reach the prompt only after
  `confirm` (the existing proposal/confirm mechanism — Alex's words stay verbatim, additions are marked).
Placement: work them into the existing Seedance block order (REFERENCES, SCENE, FIRST FRAME, OPTICS, CAMERA, ACTION, BODY
AND PHYSICS, AUDIO, LOCKS) where each belongs; the short H3 prompt only gains the trick (and fail lines if they fit its word
budget). The key-frame prompt gains sizes and the per-reference "don't take" lines. Lint: vague words in Alex-facing
prompt text ("slightly", "a little", "beautiful", "stunning", "nice", "somewhat", "very") → a warning suggesting a number or
a body comparison; a shot with people but no task → info line. Every new field is type-checked like the existing ones
(`typed()`), refusals are one clear line. SHOTS.md documents the fields with a worked example (our own wording).

## 2 · Brief template (`templates/brief.md`)

Add, in the template's own style:
- **Passport** — one value per row, filled before the first frame: register (dark/light world schedule), accent colour and
  its one meaning, display type, type scale, margins and axis, transitions (≤ 2 + one signature), camera verb, hero motif
  (in ≥ 60 % of beats), the one object that travels across cuts, light model, sound, bookend (how it opens and closes).
- **Trigger map** — per cut: the visible cause in shot A → its effect in shot B → how the camera follows (feeds `cause:`
  in beats.yaml).
- **Pacing targets** — surprise by 2 s, product by 3 s, brand by 5 s; one idea per 2–4 s; something new every ~0.5 s.

## 3 · Skeletons (`templates/launch15.yaml`, `templates/launch30.yaml`)

Commented starters in the house style of `templates/film.yaml` / `reel.yaml` that run with no assets (placeholder stills):
- 15 s at 120 BPM (30 beats, ≤ 16 must-read words): hook 0–1 s (no text) → name 1–3 s → prompt 3–5.5 s (≤ 30 characters) →
  the click 5.5–6.5 s on the strongest beat → result 6.5–8.5 s (reveal + hold ≥ 1.5 s) → scale + proof 8.5–11 s → CTA + end
  card 11–15 s held ≥ 2 s. About 10 shots, varied lengths.
- 30 s (≤ 31 words): hook → title → feature → action → result → inputs → output → before → after → punctuation → one → many
  → proof → summary → title repeat → CTA → end card (13-ish beats).
Use the existing blocks (round 1 adds `press`, `fan`, `particles`, `map`, `wall layout: grid`, `type words`, `stack mode:
exploded` — they exist only in the round-1 staging copy; write the skeletons with existing blocks now and mark in comments
where a round-1 block fits better, e.g. `# round 1: block: press`). Test that each skeleton passes `--grid` and renders
`--storyboard --aspect 16x9` with your staging tool (copy the template into `qa/motion-kit/jobs/S-launch15/beats.yaml` with
the placeholder assets; `lv.mjs --init --kit` can't be used until the lead wires it).

## Done means

- Parity + all shot-writer suites pass on stageS; new tests (`qa/shots-skill-port/test_phase2.py`) prove each new field
  renders where it should, refuses bad types, keeps old shots byte-identical, and that negatives stay out of prompts until
  confirmed.
- Report `qa/motion-kit/reports/S-build.md` (changes per file, commands + results, the lv.mjs two-line change for the lead).
