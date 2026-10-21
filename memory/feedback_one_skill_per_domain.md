---
name: feedback-one-skill-per-domain
description: Extend the existing skill instead of creating a parallel one for the same domain — Alex objected to a second launch-video skill (2026-10-20)
metadata:
  node_type: memory
  type: feedback
  originSessionId: 27298075-5641-4a31-9fd2-82e27fc1cc9c
  modified: 2026-10-20T07:49:22.296Z
---

When a new capability belongs to a domain that already has a skill, add it as a mode/section of that skill (router at the top of SKILL.md, the new mode's files in a subfolder) — don't create a second skill with overlapping triggers.

**Why:** On 2026-10-20 Alex stopped a planned separate `launch-video` skill: "there was a skill being generated here fyi, dont want to make multiple skills for the same thing". Two skills with overlapping descriptions also make routing ambiguous.
**How to apply:** Before proposing or building a skill, list `~/.claude/skills/` and check descriptions for overlap; if one covers the domain, extend it (coordinate with any session still editing it, and keep its existing files/conventions intact). See [[launch-video-mode-b]].
