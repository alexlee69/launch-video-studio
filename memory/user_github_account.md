---
name: user-github-account
description: "Alex's GitHub from 2026-10-21 = alexlee69 (personal); stop using alexxxlitiktok for anything new"
metadata:
  node_type: memory
  type: user
  originSessionId: 27298075-5641-4a31-9fd2-82e27fc1cc9c
  modified: 2026-10-21T06:35:02.906Z
---

Alex's GitHub account is **alexlee69** (Personal, email alexlee846123145@gmail.com). Alex, 2026-10-21: "forget about the previous github account, alexlee69 is the one we are using from now on."

**Why:** the old account `alexxxlitiktok` dates from the TikTok job (it hosts Design-AutoPilot, twitch-scout, aigc-pk, the for-you site and the first launch-video-studio backup). Alex offboards TikTok on 2026-10-30.

**How to apply:**
- New repos, pushes and backups go to `alexlee69` only. Never push, transfer or delete anything on `alexxxlitiktok` again.
- Existing repos there stay as they are. Ask before moving any of them. Don't copy TikTok work (Design-AutoPilot etc.) to the personal account unless Alex says so.
- Since 2026-10-20 23:47 PDT (2026-10-21 06:47 UTC), this Mac's `gh` has `alexlee69` as the ACTIVE account (`alexxxlitiktok` is still logged in but inactive). Still check `gh auth status` before any push. A browser login to github.com does NOT sign in `gh`: run `gh auth login -h github.com -p https -w < /dev/null` in the background and give Alex the one-time code for github.com/login/device; he approves it himself.
- git has no global credential helper (Apple git may fall back to osxkeychain = old account). Push with a one-off helper so the right account is used: `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push`.
- The claude.ai GitHub Integration is connected to alexlee69. The Claude GitHub App was "Not installed" there, so cloud sessions can't see its repos until Alex clicks Fix. Local sessions don't get this integration as a tool.

Related: [[launch-video-mode-b]], [[project-gz-date-invite-site]].
