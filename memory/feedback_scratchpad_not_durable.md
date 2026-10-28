---
name: scratchpad-not-durable
description: "The session scratchpad under /private/tmp/claude-501/… is WIPED when the Claude session restarts — never keep rollback snapshots, agent reports or review baselines only there"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 8e1137f0-9b19-4ad0-89b9-c5eeba56cfdd
  modified: 2026-10-22T06:19:02.210Z
---

2026-10-21 23:16: a session restart recreated `/private/tmp/claude-501/<project>/<session>/scratchpad/` EMPTY. Lost: the pre-merge rollback snapshot of the live launch-video skill, the staging copies, PORT-REPORT.md, HF02-UPGRADE-REPORT.md, every monitor findings log, probe jobs, and the frozen review snapshot a running review workflow pointed at (the workflow was stopped too).

**Why:** multi-hour agent work (porter, hf02 upgrade, monitors) wrote its only evidence there; the only surviving copies were the agents' hand-back summaries in the conversation.

**How to apply:**
- Anything that must outlive the session (rollback snapshots of a skill before a merge, reports, findings logs, review baselines, probe jobs) goes in a durable folder, e.g. `Design-AutoPilot-stable/qa/<lane>/` or the job folder in `~/Downloads/launch-videos/`; brief agents to write there, not to the scratchpad.
- Scratchpad = throwaway intermediates only.
- The launch-video skill's last-known-good baseline outside live is the backup clone `~/Downloads/launch-video-studio/skill/product-launch-sting` (state 2026-10-20 23:58) — see [[launch-video-mode-b]].
