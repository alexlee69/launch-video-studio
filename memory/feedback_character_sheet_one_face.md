---
name: character-sheet-one-face
description: "Character sheets follow Higgsfield's one-face-per-sheet method (Alex 2026-10-23); never a pile of separate multi-face views"
metadata:
  node_type: memory
  type: feedback
  originSessionId: db3322f5-f4cf-44bc-bee5-82db478af53f
  modified: 2026-10-23T15:04:26.548Z
---

On 2026-10-23 Alex stopped my 15-separate-views character-sheet plan for The Lull's astronaut. He pointed me to two sources:
- Higgsfield Academy's lesson "One face per character sheet": https://higgsfield.ai/academy/courses/ai-ad-3-step/one-face-per-character-sheet. It is a 42 s video at a public cloudfront mp4.
- The OSideMedia `higgsfield-character-design` skill: https://www.skillsdirectory.com/skills/osidemedia-higgsfield-character-design. Its canonical file is `templates/ad-asset-prep.md` § Design for win rate, in the GitHub repo OSideMedia/higgsfield-ai-prompt-skill.

**The method:**
1. A sheet is ONE image: a close-up portrait, a full-body front and a full-body back.
   - Background: "flat solid neutral grey background (#8a8a8a), seamless, no gradient", with no floor and no contact shadow.
   - Use one grey hex per project: #8a8a8a for humans, #7f7f7f for creatures.
2. Generate many candidate sheets and pick one.
3. Lock one face with a GPT Image 2 edit at High quality and 2K: "Erase the face from the full-body shot on the right panel."
   - Full-body panels only carry build, silhouette and wardrobe; the close-up is the single source of truth for the face.
   - Several faces in one reference get averaged into a generic face.
4. Each state is its own sheet, built up front (e.g. helmet off and soaked), not asked for later in prompts.
5. Props and costume details go on faceless studio sheets.
6. Fix a flawed sheet with a one-line edit; don't rebuild it.
7. Before scenes, run a "screen test": a cheap audition video in motion.

**Why:** the sheet is the reference every key still and video leg reads. Expression strips, lighting grids and profiles with faces all feed the model extra faces and drift the identity.

**How to apply:**
- Never build a character from a single image, and never as separate per-view images with faces.
- Expression and light tests belong in the screen test, not on the reference sheet.
- Related: [[hf01-manus2-recreation]], [[keep-reference-story-engine]].
- Since 2026-10-23 the product-launch-sting skill builds this in: `video/casting/casting.py`, documented in `video/CASTING.md` and linked from [[launch-video-mode-b]]. Use it instead of hand-writing new sheet tools.
