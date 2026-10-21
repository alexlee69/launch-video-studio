I'm continuing work on my Cue launch video, made with the `product-launch-sting` skill (mode B). Read this, then wait for my next instruction.

**The tool**
- Skill: `~/.claude/skills/product-launch-sting/`. Mode B lives in `video/`. Read `video/GUIDE.md` first.
- CLI: `node ~/.claude/skills/product-launch-sting/video/lv.mjs --job DIR <command>`
- Commands: `--grid`, `--storyboard`, `--film`, `--audio`, `--qa`, `--clips … --alpha --webm --fps N`, `--blocks`
- Status: built and reviewed (Sonnet → Codex → Opus). All findings are fixed, and three final QA runs passed.
- Memory note: `project_launch_video_mode_b.md`

**The Cue job** (`~/Downloads/launch-videos/cue/`)
- `brief.md` v0.2: defaults approved, direction B "A day, handled"
- `beats.yaml`: 9 shots, 30 s, 124 BPM, 16:9 + 9:16. The shots run s1 Meet Cue → s2 the team → s3 8 AM inbox → s4 11 AM call → s5 1 PM dinner with approval tap → s6 4 PM trip prompt → s7 7 PM pickup → s8 dark "Your day. Handled." → s9 end card.
- Films, all QA PASSED:
  - `cue-16x9.mp4` and `cue-9x16.mp4` (30 s)
  - `cue-short-16x9.mp4` and `cue-short-9x16.mp4` (16.45 s cutdown: s1, s3, s5, s8, s9)
- Clips with headlines: `cue/clips/` has s5, s6 and s7 as transparent ProRes 4444 + WebM + SFX WAV at 30 fps.
- UI-only overlays: `~/Downloads/launch-videos/cue-overlays/clips/` has the same three shots with no headline, centred. Its s6 has white step labels (theme: dark), so they vanish over light footage; use the `cue/clips` s6 for light edits.

**Still open**
1. **Stand-ins** to swap once I have the official Manus brand kit:
   - "C" monogram → `brand.logo`
   - built-in characters → `brand.cast`
   - Inter → `brand.font`
   - accent `#3E7BFA` → brand colours
   Update both jobs' beats.yaml, then re-run `--storyboard` → my approval → `--film --cut all --aspect all` → `--clips`.
2. **Claims to confirm with Manus** (flagged in the shot notes):
   - each agent has its own email and phone number
   - it only spends after you approve
   - a team of agents splits one job
   - app-store buttons and URL
3. **Optional polish:** the phone screens in s3–s5 only fill their top ~40 %.

**Rules**
- Storyboard approval comes before any film render.
- Never ship a QA FAIL, and never loosen a QA threshold.
- Audio is checked by meters only: tell me to listen.
- Cue/Manus logos, mascots, fonts and screens come only from the official brand kit. Never recreate them from public videos.
- Extend this skill; don't create a second one for the same thing.
- Changes to the tool itself get the review chain and 3 QA runs. Test jobs are in `~/Downloads/launch-videos/`: steady-sample, edge-test, dark-ui-check, and qa-probe / qa-probe2, which must FAIL.
- No commit or push without my approval.
- I'm often on my phone via Remote Control: send deliverables with SendUserFile.
