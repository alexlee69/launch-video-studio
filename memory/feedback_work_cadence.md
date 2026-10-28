---
name: Work cadence — multi-agent worker + review chain + 3 QA tests + user-only test/commit
description: Default cadence for any non-trivial implementation work in Design-AutoPilot. Applies to feature builds, refactors, and bug fixes — not one-line edits.
type: feedback
originSessionId: 4d35e56d-90bb-4619-ada9-14bb6941f502
---
For any non-trivial implementation in this project, follow this five-stage cadence:

1. **Implementation:** 1 Opus worker agent doing the edits, 1 Opus monitor/review agent running concurrently to watch and review the worker's output.
2. **Review chain (after implementation):** 1 Sonnet review pass → 1 Codex review pass (via `codex:rescue` or `codex:codex-rescue`) → 1 final Opus deep review/rescue pass. In that order, sequential.
3. **3 QA tests:** Run three real end-to-end QA tests (not static checks — real behavior runs) to confirm everything works.
4. **User live test:** STOP. The user runs their own live test before any further action.
5. **No commit/push without explicit approval:** Even after QA + user test, do not commit or push until the user explicitly says go.

**Why:** The user wants high-confidence work and treats memory/tests/static-checks as insufficient on their own. The Sonnet→Codex→Opus chain catches different classes of issues (Sonnet for general review, Codex for second-implementation diagnosis, Opus for deep root-cause/rescue). Three QA tests catch flakes and untested edge cases that one run misses. The user is the final gate — they have prod context the agents don't.

**How to apply:**
- Show the cadence in any plan for non-trivial work so the user can adjust before execution.
- During implementation: spawn the Opus worker and Opus monitor as parallel Agent calls (single message, two tool uses).
- During review chain: run sequentially — each reviewer needs the prior reviewer's findings as context.
- For QA: pick three distinct real-behavior scenarios (e.g., happy path + two edge cases) and actually execute them, capturing outputs.
- Pause before commit/push every single time, even if the user said "go" on a related earlier task — authorization is per-action.
- Skip for trivial edits (typo fix, single-line config change, rename) — the cadence is overhead that only pays off on substantive work.

This supersedes the older, narrower `feedback_no_commit_until_asked.md` (which only covered step 5).
