# Set up the video studio on a new Mac

Written for Claude (Claude Code on Alex's new laptop), step by step. Alex: paste this into Claude Code on the new Mac,
in any folder:

> Set up my video studio from my private GitHub repo alexlee69/launch-video-studio. If you can't read it yet, install the
> GitHub CLI (`brew install gh`), have me sign in as alexlee69, clone it to ~/launch-video-studio, then follow its NEW-MAC.md
> exactly.

**Done means:** `bash ~/launch-video-studio/setup.sh --film-check` ends with `READY`, both keys show `is set`, and
Claude Code is reopened in `~/launch-video-studio`.

**Only the video studio.** The TikTok/Discord work (Design-AutoPilot, the bots, AIGC-PK, PromoStudio) is not in this repo.
Don't look for it or rebuild it.

## Who does what

Claude runs every command it can. Alex does only these:
- typing the Mac password (Homebrew asks for it);
- clicking Install on the Xcode command line tools pop-up;
- approving the GitHub sign-in in the browser;
- pasting the two keys into the keys file.

Claude never asks for a password or a key in the chat.

## Steps

### 1. Check what's already there

```bash
sw_vers -productVersion; uname -m; xcode-select -p; command -v brew node ffmpeg gh git python3; ls /Applications | grep -i chrome
```

Skip any step below whose tool is already there.

### 2. Command line tools (git, python3)

If `xcode-select -p` failed, run `xcode-select --install`. Alex clicks Install in the pop-up. Wait until `xcode-select -p`
prints a path.

### 3. Homebrew

If `brew` is missing, Alex runs this in their own Terminal, because it asks for the Mac password:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Then put brew on the PATH (Apple silicon):

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile && eval "$(/opt/homebrew/bin/brew shellenv)"
```

### 4. The tools

```bash
brew install node ffmpeg gh
```

```bash
brew install --cask google-chrome
```

Skip the second line if Chrome is already in /Applications. The films were made with the versions in
`restore/toolchain.txt`: Node 25, ffmpeg 8.1, Chrome 156, python 3.9 with numpy 2.0.2 and Pillow 11.3.0. Newer versions
are fine; the check at the end says if they change the pixels.

### 5. Sign in to GitHub as alexlee69

```bash
gh auth login -h github.com -p https -w
```

Give Alex the one-time code it prints. Alex opens github.com/login/device, signs in as **alexlee69** (never the old
alexxxlitiktok account) and approves. Then check:

```bash
gh api user -q .login
```

It must print `alexlee69`.

```bash
gh auth setup-git
```

### 6. Get the repo

```bash
gh repo clone alexlee69/launch-video-studio ~/launch-video-studio
```

It's about 1.7 GB, so it can take a while on a slow network. If it's already there, run
`git -C ~/launch-video-studio pull` instead.

### 7. Install and check

```bash
bash ~/launch-video-studio/setup.sh --film-check
```

It takes 5–10 minutes. It installs:
- the skill, in `~/.claude/skills/product-launch-sting`, with its node packages;
- the jobs, in `~/Downloads/launch-videos` and `~/Downloads/launch-stings`;
- numpy and Pillow;
- an empty keys file;
- Claude's notes.

It then renders the Wayfinch sample and compares it with the shipped one, and ends with `READY` or `NOT READY`.

**If it says NOT READY:**
- **A `MISSING` line:** install what it names, then run it again.
- **A `DIFFERENT` storyboard or film:**
  1. Compare the tool versions it printed with `restore/toolchain.txt`.
  2. A newer Chrome or ffmpeg can shift pixels. Show Alex the new storyboard (the path is on the last line) next to
     `launch-videos/motion-kit-sample/wayfinch-storyboard-16x9.png` and let Alex judge.
  3. Don't change the skill or `restore/compare.py` to make it pass.
- **An installed skill differs:** only run `--force` if Alex agrees. It keeps the old copy as a `.bak` folder.

### 8. Keys

Alex opens `~/Downloads/launch-videos/.env` and pastes the two keys after the `=` signs:
- `FAL_KEY=` from fal.ai/dashboard/keys (AI footage);
- `OPENAI_API_KEY=` from platform.openai.com (gpt-image-2 stills only).

Then:

```bash
chmod 600 ~/Downloads/launch-videos/.env && bash ~/launch-video-studio/setup.sh --check
```

Both keys should show `is set`. Never print, echo or cat the file.

### 9. Optional: the heavy renders

These are the Cue clips and After Effects layers, about 1.15 GB:

```bash
bash ~/launch-video-studio/setup.sh --releases
```

### 10. Finish

Tell Alex to quit Claude Code and open it again in `~/launch-video-studio`. There it reads `CLAUDE.md` (the rules) and
loads the notes from `memory/` as its memory. Then run one last check:

```bash
bash ~/launch-video-studio/setup.sh --check
```

It should end with `READY`. Report the versions it printed and the result to Alex in two or three lines.
