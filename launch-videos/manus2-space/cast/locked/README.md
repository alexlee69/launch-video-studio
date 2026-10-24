# The Lull: locked character sheets (Round 1, 2026-10-23)

**The actor:** an East Asian woman of about 40, Alex's casting. She was picked from `../round1/candidates/cand-02.png`.

**The method:** Higgsfield's "one face per sheet". Memory: `feedback_character_sheet_one_face`. Spec: `hf01-study/storyboard-space/final/CAST.md`.

| File | Use as reference for | How it was made |
|---|---|---|
| `eva.png` | every helmet-on key still | cand-02, then `eva-edit.png` (the lock edit), then her original face restored (`eva-composite.png`, `eva-composite.json`), then the grey pinned (`pin-eva.json`) |
| `helmet-off.png` | S26 | `helmet-off-gen.png` (an edit from eva-composite), then the grey pinned |
| `costume.png` | close-ups of the patch, wrist display, helmet, glove and tether | `costume-gen.png` (an edit from eva-composite plus `../refs/patch.png`), then the grey pinned |
| `props.png` | the bag, wrench, whale and capsule | `props-ball.png`, then one capsule-tile edit (`props-capsule-edit.png`) pasted in (`props-composite.json`), then the grey pinned |

**The lock edit** changed three things:
- It erased the front full body's face.
- It moved the helmet camera to her right.
- It moved the back view's patch to her left shoulder.

The `*-gen`, `*-edit`, `*-composite` and `props-ball` files are the steps before the finals. Keep them: each final can be rebuilt from them.

**Every paid call** is in `../round1/ledger.jsonl`: 9 calls, $2.23. The tools are `../../tools/cast_sheet.py` (generation, with a cap and a ban-list check) and `../../tools/pin_grey.py`.
