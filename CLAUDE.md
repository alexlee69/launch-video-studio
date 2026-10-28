# launch-video-studio: notes for Claude

Alex's launch-video toolkit: the `product-launch-sting` skill (mode A stings, mode B videos and films), its jobs, and the
record of how it was built. Only the video work is here. The TikTok/Discord work (Design-AutoPilot and the rest) is not in
this repo; don't recreate it.

## Set up or check a Mac

- `bash setup.sh` installs everything a new Mac needs and checks it: the skill in `~/.claude/skills/product-launch-sting`,
  the jobs in `~/Downloads/launch-videos` and `~/Downloads/launch-stings`, an empty keys file, these notes as memory, and a
  render check against the shipped Wayfinch storyboards. `--film-check` also re-renders a film and compares it.
  `--check` changes nothing. It ends with READY or NOT READY.
- The skill's guide is `skill/product-launch-sting/SKILL.md` (installed copy: `~/.claude/skills/product-launch-sting`).
  Edit the installed copy, then sync it back into `skill/` before a commit.
- `memory/` holds my notes for this work: read `memory/MEMORY.md` first, then the notes it points to.
- `qa-records/` is the record of each build lane (tests, reviews, reports, patches, the unmerged 10-22 fix worktrees). Its
  scripts hard-code the old Mac's paths (`/Users/bytedance/...`), so read them, don't run them as they are.

## Rules Alex set

- **Keys:** the fal and OpenAI keys live only in `~/Downloads/launch-videos/.env` (`FAL_KEY=`, `OPENAI_API_KEY=`, chmod 600).
  Alex pastes them in by hand. Never print a key, never ask for one in the chat, and read `.env` with Python, not sed.
  The OpenAI key is for image generation only.
- **Money:** no paid generation (fal footage, gpt-image-2 stills) without a price quote Alex approves first. Every paid
  step in the skill is a dry run with a quote until `--go`.
- **Video model:** ask every time, before writing prompts and again before generating: H3 (cheaper, 1080p, no talking)
  or Seedance 2.5 (lip-sync and sound, at most 720p, about 3× the price per second).
- **Brand:** Manus logos only from the official manus.im files.
- **Private media:** reference videos and their frames and audio (the Higgsfield films, `hf01-study` frames, `ref/`
  folders, temp tracks) stay on the Mac and are never pushed.
- **Third-party skills:** the Higgsfield `.skill` files are read-only. Never install or run them, and paraphrase guides
  rather than copying their prompts.
- **Audio:** check sound by meters only.
- **Jobs:** never run `lv.mjs` on the original jobs in `~/Downloads/launch-videos` except `motion-kit-sample`. Copy a job first.
- **One skill per domain:** extend `product-launch-sting` with a mode and a router; never start a parallel skill.
- **QA:** read the cut stills before a film goes out. Some glitches pass every automatic check.
- **Disk:** keep at least 25 GB free.
- **Git:** GitHub is `alexlee69` only. Commit or push only when Alex says so, each time. Before a push, check
  `gh api user -q .login` says `alexlee69`.
- **Working style:** Alex wants short, plain answers, often on a phone. Ship a usable draft first, then improve it.
