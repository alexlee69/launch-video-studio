---
name: Prefer post-processor over prompt mandates for deterministic output
description: When LLM compliance for a specific output pattern is critical AND the desired transformation can be expressed deterministically, prefer a Python post-processor over more prompt rules. Reason: prompt rules are probabilistic; post-processors are deterministic. Established 2026-05-10 fixing h2d Figma truncation.
type: feedback
originSessionId: 55194387-402a-4246-afd5-37afd3838540
---
When LLM output must conform to a specific deterministic pattern for a downstream
system to work, prefer a Python post-processor over adding more rules to the
prompt.

**Why:** Prompt rules are probabilistic — even with strong language ("MANDATORY",
"verified", "do NOT use"), the LLM may comply 95% of the time and drift on the
remaining 5%. Drift is silent and hard to detect. Post-processors are
deterministic and run every time.

**How to apply:** When you find yourself adding the third or fourth round of
"do not use X" / "use Y instead" rules to a prompt to satisfy a downstream
system's constraints, stop and ask whether the constraint can be enforced as a
Python transformation step in the pipeline. If yes, build that. The prompt can
still RECOMMEND the canonical pattern (so the post-processor has predictable
selectors / structure to target), but the actual cure is in code.

**Concrete instance (2026-05-10, commit a79f7dc):** Spent hours adding CSS-mandate
prompt rules to fix h2d Figma truncation (rules forbidding tables, mandating
per-section class names, requiring specific hero markup, etc.). The LLM followed
every rule. The bug persisted because the LLM was still emitting offending CSS
properties (text-overflow:ellipsis, display:grid on .podium, etc.) that the
prompt didn't anticipate. Codex flagged this with "Do not ship this as a fix
... enforce the proven result deterministically with a post-processor."

The actual fix: a `pipeline/h2d_css_normalizer.py` that appends an !important
CSS override block right before h2d export. Wired in at the file-write points
in handlers/campaign.py + handlers/non_campaign.py. Idempotent under feedback
iteration via BEGIN/END markers + strip-and-reappend. The override !important
declarations win the cascade against whatever the LLM emitted. Live-tested
end-to-end on both campaign and non-campaign flows.

**Cost of NOT applying this principle:** the table-fix attempt (stash from
earlier the same day) added 7 files / +516 lines of prompt rules and didn't
fix the bug. The post-processor approach was ~250 lines + 200 lines of tests
and fixed it deterministically.

**Caveat:** post-processors only work when the desired transformation is
mechanically expressible. For genuinely creative output (text content, design
choices), prompt-based steering remains the right tool.
