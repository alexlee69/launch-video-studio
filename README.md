# launch-video-studio

My launch-video toolkit and the Cue launch video work, saved from the old laptop on 2026-10-20 and moved to my
personal GitHub (`alexlee69`) on 2026-10-21.

**Not included yet:** a speed-up for layer export (`--layers` QA in parallel workers) that was still being built on
2026-10-21. This repo has the last version of the skill that passed its reviews and QA.

- **The tool:** `skill/product-launch-sting/` is a Claude Code skill.
  - Mode A: a fixed 12 s square launch sting.
  - Mode B (`video/`): launch videos designed from scratch (brief → beats.yaml → storyboard → film in 16:9 / 9:16 / 1:1 with QA), plus transparent UI clips and per-element layers for my own edits.
  - Start with `video/GUIDE.md`.
- **The Cue job:** `launch-videos/cue/` (30 s film + 16.45 s cutdown, all QA PASSED) and `launch-videos/cue-overlays/` (UI-only s5–s7).
  - **Status and rules:** `HANDOVER-cue-video.md`. Paste it into a new Claude session to pick up where I left off.

## What's where

| Path | What it is |
|---|---|
| `skill/product-launch-sting/` | The skill, without `node_modules` |
| `launch-videos/cue/`, `cue-overlays/` | Cue jobs: brief, beats.yaml, films, storyboards, captions, master WAVs, thumbnails |
| `launch-videos/steady-sample/`, `edge-test/`, `dark-ui-check/`, `layers-probe/` | Test jobs for the 3 QA runs after any change to the tool |
| `launch-videos/qa-probe/`, `qa-probe2/` | Deliberately broken jobs that **must FAIL** QA |
| `launch-stings/design-autopilot-test/` | Mode A test job |
| `experiments/cue-painted/` | "Saturday", a 34 s hand-painted Cue short on JohnHeibel/ClaudeAnimationBase (MIT, licence kept). Share-size MP4s are in `out/` |
| `experiments/cue-launch/` | Early Cue proof cut |
| `experiments/product-sting/` | The original "Frame by Frame" sting rebuild that became mode A |
| `memory/` | My Claude memory notes for this work (rules and traps) |

**Left out on purpose**, because each one regenerates from the job: render frames (`out/`), the test jobs' clips and layers, and audio stems.

**Heavy files** are in two GitHub Releases (about 1.15 GB), rebuilt from the local job folders on 2026-10-21.

**GitHub Release `renders-2026-10-20`** holds:
- `cue-clips-layers.zip`: Cue ProRes 4444 clips, WebM files, SFX WAVs and per-element layers.
- `cue-overlays-clips-layers.zip`: the same for the overlays job.
- `cue_saturday.mp4` and `cue_saturday_sound.mp4`: full-size masters of the painted short.
- `SHA256SUMS`: checksums for the four files.

**GitHub Release `layers-2026-10-20`** holds the Cue s5, s6 and s7 layers (16:9) re-exported with the final layer engine. Each passed layer QA.
- `cue-s5-16x9.zip`, `cue-s6-16x9.zip`, `cue-s7-16x9.zip`: one folder per shot. Each has the background and one ProRes 4444 `.mov` per element, the SFX WAV, an After Effects `.jsx`, a preview MP4, a contact sheet and `manifest.json`.
- They are identical to the s5–s7 16:9 folders inside `cue-clips-layers.zip` (checked file by file); this release is just a smaller download of the three most-used shots.
- `SHA256SUMS`: checksums for the three zips.

## Restore on a new Mac

You need Node ≥ 18, ffmpeg 8 + ffprobe (`brew install ffmpeg`), Google Chrome and the GitHub CLI.

```bash
git clone https://github.com/alexlee69/launch-video-studio.git ~/launch-video-studio
```

```bash
mkdir -p ~/.claude/skills && cp -R ~/launch-video-studio/skill/product-launch-sting ~/.claude/skills/
```

```bash
cd ~/.claude/skills/product-launch-sting && npm ci && cd video && npm ci
```

```bash
mkdir -p ~/Downloads/launch-videos ~/Downloads/launch-stings && cp -R ~/launch-video-studio/launch-videos/* ~/Downloads/launch-videos/ && cp -R ~/launch-video-studio/launch-stings/* ~/Downloads/launch-stings/
```

```bash
cd ~/Downloads/launch-videos && gh release download renders-2026-10-20 -R alexlee69/launch-video-studio -p '*.zip' && unzip -o cue-clips-layers.zip && unzip -o cue-overlays-clips-layers.zip
```

Then, after the step above, unpack the newer s5–s7 layers over the older ones:

```bash
mkdir -p ~/Downloads/launch-videos/cue/layers && cd ~/Downloads/launch-videos/cue/layers && gh release download layers-2026-10-20 -R alexlee69/launch-video-studio -p '*.zip' && for z in cue-s*-16x9.zip; do unzip -o "$z"; done
```

To run the experiments, run `npm ci` in `experiments/cue-painted/` (and in `experiments/product-sting/`).

**Claude memory:** copy `memory/*.md` into the new project's memory folder (`~/.claude/projects/<project-path>/memory/`) and add the lines from `memory/MEMORY.md` to its index. Alternatively, ask Claude to read `memory/` at the start of a session.

**Check after restoring:**
1. Run `node ~/.claude/skills/product-launch-sting/video/lv.mjs --job ~/Downloads/launch-videos/steady-sample --storyboard`. It should write the storyboard PNG + PDF in a few seconds.
2. A full `--film` re-renders frames, because `out/` wasn't saved.
3. `launch-videos/layers-probe/probe.mjs` imports the skill from the absolute path `/Users/bytedance/.claude/...`. Edit that line if your home folder has a different name.

## Still open (from the handover)

1. **Swap the stand-ins** for the official Manus brand kit, in both Cue jobs' beats.yaml:
   - "C" monogram → logo
   - built-in characters → cast
   - Inter → brand font
   - `#3E7BFA` → brand colours

   Then re-run `--storyboard`, get approval, run `--film --cut all --aspect all`, then `--clips`.
2. **Claims to confirm with Manus:**
   - each agent has its own email and phone number
   - it only spends after you approve
   - a team of agents splits one job
   - the app-store buttons and URL
3. **Optional polish:** the phone screens in s3–s5 only fill their top ~40 %.

The Cue logos, characters, fonts and screens in these files are stand-ins or painted reinterpretations. Swap in the official brand-kit assets before anything goes public.
