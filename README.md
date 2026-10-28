# launch-video-studio

My launch-video toolkit and the Cue launch video work, saved from the old laptop on 2026-10-20 and moved to my
personal GitHub (`alexlee69`) on 2026-10-21. Updated on 2026-10-23 with the skill as it is installed today and the
Higgsfield-recreation jobs.

**Skill state (2026-10-23):** `skill/` is the live copy of the skill, which includes:
- **The 2026-10-21 work:** the reel and film kits, the review sheet (`--sheet`), the hf02 motion upgrade of the film
  blocks, and the `--layers` export speed-up.
  - It was reviewed on 2026-10-22, with 57 confirmed findings, 3 of them high.
  - Their fix round was staged on the old Mac and is **not merged**. Its worktrees, findings and patches are in
    `qa-records/launch-video-skill-review/fix/` (code and text only).
- **The 2026-10-22 port:**
  - photoreal AI footage through my own fal.ai key (`video/FOOTAGE.md`);
  - a reference film recreated frame for frame, with proofs (`video/RECREATE.md`);
  - the `music: film` score style.

  It passed five review-and-fix rounds, 3 QA runs and an 87-check acceptance harness. Its record, including
  `PATCHES.md` for re-applying it, is in `qa-records/hf02full-skill-port/`.

- **The 2026-10-23 port (from the Manus 2.0 film):** the plate builder (`video/footage/plates.py`), the 24p-in-30p
  finisher with shot-anchored frame picks, the corner bug and the music + SFX mix (`video/recreate/finish.py`), and the
  synthesized SFX layer (`video/recreate/sfx.py`), with worked examples in `video/recreate/examples/`. It passed a
  35-check test run (`RECREATE.md` §8).
- **The casting lane (2026-10-23):** `video/casting/casting.py` and `video/CASTING.md`.
  - **What it makes:** character sheets built Higgsfield's "one face per sheet" way (close-up + front + back on
    #8a8a8a, the body's face erased, each state its own sheet, faceless costume and prop sheets), empty location
    plates, and every film key frame made from the locked sheets on gpt-image-2.
  - **Spending:** every paid step is a dry run with a quote until `--go`, against a cap and a ledger.
  - **Worked example:** `video/casting/examples/manus2-space-casting.json` reproduces The Lull's 35 sent requests
    byte for byte.
  - **Testing:** three review rounds and 4 test suites (223 checks, against a local mock API). Their record is on the
    Mac in `Design-AutoPilot-stable/qa/cast-skill-port/`.
- **The storyboard lane (2026-10-26):** `video/storyboard/` and `video/STORYBOARD.md`.
  - **What it makes:** labelled placeholder plates for AI-footage shots, drawn in code for free, so a film is
    storyboarded and approved before anything is generated; and a phone edition of the storyboard (a PDF a phone
    opens, with a cover page).
  - **The story rule:** `video/RECREATE.md` → "The story: keep its engine, change its world" (when recreating a
    reference that tells a story: keep its genre jump, running joke, set pieces and punchline in a new world, and judge
    the premises on fun).
  - **Worked example:** `video/storyboard/examples/manus2-space-cover.yaml` rebuilds The Lull's 10-23 phone storyboard,
    every page byte-identical.
  - **Testing:** three review rounds (the Codex one cut short by its usage limit) and 4 test suites (156 checks, no
    key, nothing spent). Their record is on the Mac in `Design-AutoPilot-stable/qa/storyboard-skill-port/`.
- **The shot writer (2026-10-26):** `video/shots/` and `video/SHOTS.md`, from two Higgsfield guides (kaye.creatives'
  Oakley × Meta ad and the Claude Motion guide), paraphrased.
  - **What it makes:** any brief (a few sentences, a script, a rough storyboard) becomes every AI-footage shot's
    key-frame and video prompts, checked before any spend. Alex's words stay verbatim, and Claude's additions wait for
    his OK.
  - **The model is asked every time:** H3 (a short motion brief) or Seedance 2.5 (a block prompt with lip-synced
    lines). `video/footage/gen.mjs` now calls Seedance 2.5 image-to-video, quoted first (480p drafts, the final at
    720p; fal's fields and prices unconfirmed from the Mac).
  - **Also in it:**
    - shot recipes and story and edit rules;
    - casting upgrades (`CASTING.md` rules 13–17: a sheet for every character, pose panels, a proportion lock, product
      sheets per colourway, lens-matched plates);
    - pencil position sketches of the storyboard plates (`placeholders.py sketch`), sent with each key frame.
  - **Worked example:** `video/shots/examples/manus2-space-shots.json` compiles to The Lull's 20 H3 prompts, byte for
    byte.
  - **Testing:**
    - two review rounds: Sonnet, then Opus (Codex skipped at Alex's word), 38 findings, all fixed;
    - 5 test suites, 228 checks plus the casting and storyboard suites, with no key and nothing spent.

    Their record is on the Mac in `Design-AutoPilot-stable/qa/shots-skill-port/`.

- **The tool:** `skill/product-launch-sting/` is a Claude Code skill.
  - Mode A: a fixed 12 s square launch sting.
  - Mode B (`video/`) covers:
    - launch videos designed from scratch (brief → beats.yaml → storyboard → film in 16:9 / 9:16 / 1:1 with QA);
    - reels and Higgsfield-style launch films on AI footage;
    - AI footage made through fal;
    - frame-for-frame recreations;
    - transparent UI clips and per-element layers for my own edits.
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
| `launch-videos/film-sample/`, `reel-sample/` | Sample jobs for the film kit (Orbit launch film) and the reel kit (Popframe reel): beats.yaml, assets, films, storyboards, captions, master WAVs |
| `launch-videos/hf02-full/` | The 63.6 s Cue film: Higgsfield film 02's motion, frame for frame, with our own story, copy, cast and score. Hand-built (`story.js`, `scenes/`, `motion/`, `lib/`, `audio.mjs`, `render.mjs`, `tools/`; start with `BRIEF.md`). `film.mp4` is the shareable master with our score. `out/fal/v2` and `v3` hold the paid fal footage: the 8 `*-fit.mp4` clips the film plays, plus the raw generations, key stills and request logs. `ref/` keeps only the measurements (cut list, breakdown JSON) |
| `launch-videos/hf02-recreate/` | The approved 7 s motion test (`MOTION-SPEC.md`) |
| `launch-videos/manus2-space/` | "The Lull", the 76.5 s Manus 2.0 launch film: Higgsfield film 01's cuts, cadence, beat and sound grammar, with our own astronaut story, cast and score. Start with `brief.md`. `cast/locked/` holds her one-face character sheets, `stills/` the gpt-image-2 key frames and her film's stills (`picks.json`, `ledger.jsonl`), `footage/fal/` the 20 paid H3 clips with their inputs and logs, `assets/footage-graded/` the plates the film plays, `tools/` the job's build tools (`finish.py` makes the final cut; `casting.json` is its spec for the skill's casting lane). `manus2-space-firstcut-16x9.mp4` is the current cut (first cut v2, lifted opening) and `-v2-phone.mp4` its phone copy. Not yet approved |
| `launch-videos/hf01-study/` | The text and numbers from the hf01 study that the Manus 2.0 job reads: the story, shot list and copy (`storyboard-space/final/`), the cut list (`cuts/`), and the sound and overlay measurements. No frames or audio |
| `launch-videos/hf02-skill/` | Proof job for the hf02 motion upgrade of the film blocks: proof films, storyboards, the measured curves and `ANSWERS-measurements.md` |
| `launch-videos/motion-kit-sample/` | "Wayfinch", the 28 s motion-kit sample (a made-up trip planner): every new block (press, fan, particles, map, wall grid, type words, exploded stack) and every move across the cut (carry, morph, dive, flood, `from:`). Films in 3 aspects, storyboards, drawn art (`tools/make_art.py`) |
| `notes/motion-kit-2026-10-27/` | How the motion kit was built and tested: `MORNING.md` (the summary, open items, deferred list) and `reports/` (each worker's build, review and verify reports, the Opus review, QA1–3, stills), and `test-films/`: the best test films on the final code, 3 aspects each, with their `beats.yaml` (`kit-dev` every new block, `prv-combo` blocks + moves, `r2-dev` every move across the cut, the 15 s and 30 s starters as they come) |
| `qa-records/` | The record of each build lane, from the old Mac's `Design-AutoPilot-stable/qa/`: tests (`run_all.sh`, parity, flow, failure and review-fix suites), reviews, QA reports, design notes, `PATCHES.md`, rollback fingerprints, the 10-22 review's unmerged fix round (`launch-video-skill-review/fix/`: the worktrees as they were, and `fix-round-2026-10-22.bundle`, its git history with the `main`, `port` and four `fix/*` branches; `git clone fix-round-2026-10-22.bundle` restores it), and the 10-26 plan (`video-skill-learnings/TAKE-AND-HOW-2026-10-26.md`, `BREAKDOWN-2026-10-26.md`). Text and code only. The scripts hard-code the old Mac's paths |
| `setup.sh`, `restore/` | Sets up a new Mac and checks that it renders the same (see below). `restore/toolchain.txt` is the tool versions the shipped films were made with |
| `CLAUDE.md` | The rules and pointers Claude reads when it is opened in this folder |
| `HANDOVER-hf02-motion.md` | Handover for the hf02 motion work |
| `launch-stings/design-autopilot-test/` | Mode A test job |
| `experiments/cue-painted/` | "Saturday", a 34 s hand-painted Cue short on JohnHeibel/ClaudeAnimationBase (MIT, licence kept). Share-size MP4s are in `out/` |
| `experiments/cue-launch/` | Early Cue proof cut |
| `experiments/product-sting/` | The original "Frame by Frame" sting rebuild that became mode A |
| `memory/` | My Claude memory notes for this work (rules and traps) |

**Left out on purpose:**
- **Anything that regenerates from the job:**
  - the jobs' render frames and output (`out/`). The experiments keep their share-size MP4s in `out/`.
    hf02-full keeps `out/fal/v2` and `v3`, while its first, draft-guided generation (`plate1-h3max*`) stays on the Mac.
  - the test jobs' clips, layers and review sheets;
  - audio stems and run logs (`*.log`). The measurement logs under `hf02-full/tools/*/logs` and the fal request
    records (`.fal.json`, `.input.json`) are kept.
- **Anything that carries another film's frames or audio.** It stays on the Mac:
  - the Higgsfield reference videos;
  - `ref/` frames, sheets and audio;
  - comparison sheets and side-by-sides;
  - the PRIVATE temp-track copies.
- **Scratch jobs:** `breakdown-qa`, plus `film-kit-dev` and `reel-dev`, which the two sample jobs superseded, and
  `manus2-film`, the rejected first take of The Lull (`manus2-space` replaced it).
- **In `qa-records/`:** the lanes' renders, frames, images, old-skill snapshots and scratch job runs, the third-party
  Higgsfield `.skill` files and their readers' notes, and the reel frame sheets. Only text and code are kept.
- **The rest of `hf01-study`:** its `ref/`, frames, sheets, audio and the side-by-sides (`build-compare/`) are reference
  media. Only its text and numbers are here.
- **manus2-space's heavy regenerables:** `out/` (renders, the PRIVATE temp track), `audio/`, the ungraded plates
  (`tools/plates.py` rebuilds them from `footage/fal/`), the review sheets, the engine master, cut v0.1, the v1 phone copy
  and the full-size storyboard PDF.
- **`hf02-skill/baseline`:** a tarball of the old skill.
- **Secrets:** the fal key lives in `~/Downloads/launch-videos/.env`, never here.

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

**With Claude:** paste this into Claude Code on the new Mac:

> Set up my video studio from my private GitHub repo alexlee69/launch-video-studio. If you can't read it yet, install the
> GitHub CLI (`brew install gh`), have me sign in as alexlee69, clone it to ~/launch-video-studio, then follow its NEW-MAC.md
> exactly.

`NEW-MAC.md` is the full step-by-step that Claude follows. You only type the Mac password, approve the GitHub sign-in and
paste the two keys.

**By hand:**

Install Node 18+, ffmpeg 8 (`brew install ffmpeg`), Google Chrome, the GitHub CLI (`brew install gh`, then `gh auth login`
as `alexlee69`) and the Xcode command line tools (`xcode-select --install`, for python3 and git). Then:

```bash
gh repo clone alexlee69/launch-video-studio ~/launch-video-studio
```

```bash
bash ~/launch-video-studio/setup.sh --film-check
```

`setup.sh` does the rest and never overwrites an existing job file or writes a key:
- **The skill** goes to `~/.claude/skills/product-launch-sting`, with its node packages (`npm ci` from the lockfiles).
- **The jobs** go to `~/Downloads/launch-videos` and `~/Downloads/launch-stings`. The two hand-built hf02 jobs get their
  `node_modules` link, and the experiments get their packages.
- **numpy and Pillow** are installed for python3 (the versions used here, `restore/toolchain.txt`).
- **The keys file:** an empty `~/Downloads/launch-videos/.env` (chmod 600). Paste your own keys after `FAL_KEY=`
  (fal.ai/dashboard/keys) and `OPENAI_API_KEY=` yourself, never into a chat.
- **Claude's notes:** `memory/` is copied into Claude Code's memory for this folder, and `CLAUDE.md` gives Claude the
  rules. Open Claude Code in `~/launch-video-studio`.
- **The check:** it renders the Wayfinch sample's three storyboards and compares them with the shipped ones pixel for
  pixel. `--film-check` also re-renders its 16:9 film and compares it frame by frame (PSNR) with the shipped
  `wayfinch-16x9.mp4`, plus the master WAV. It ends with READY or NOT READY. A newer Chrome or ffmpeg than the
  versions in `restore/toolchain.txt` is noted, as pixels may then differ slightly.

Options: `--check` (change nothing, just check), `--force` (replace an installed skill that differs; the old one is kept
as a `.bak` folder), `--releases` (also download and unpack the heavy renders from the two GitHub Releases, about 1.15 GB).

**Known limits:**
- A full `--film` of any other job re-renders its frames, because `out/` isn't saved.
- A few hf02-full measurement tools (`tools/progress_sheet.py`, `tools/fal/look_stats.py`) read `ref/frames`, which isn't
  saved here.
- The scripts in `qa-records/` hard-code the old Mac's paths. They are a record, not tools to run.

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
4. **The 2026-10-21 review's fix round** (57 findings) is staged on the Mac and not yet merged into the skill. When it
   merges, re-apply the hf02 port's edits as the port's `PATCHES.md` says.
5. **hf02-full stand-ins:** the mascots (our own crew) and the app screens stay until Manus's official kit arrives. The
   Cue claims in `story.js` need Manus to confirm them.

The Cue logos, characters, fonts and screens in these files are stand-ins or painted reinterpretations, with one
exception: hf02-full uses two official files as supplied, the Cue app icon and the Manus hand mark
(`brand/cue/official/`). Swap in the official brand-kit assets before anything goes public, and keep this repo private:
it holds Manus brand files.
