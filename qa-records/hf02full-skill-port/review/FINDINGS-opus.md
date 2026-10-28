# Review round 3 (Opus, final), 2026-10-22: findings and the lead's decisions

Opus reviewed the code after round 2, i.e. `stage-r2-after-codex-fixes`. Its evidence is in `review/opus/`
(`gen/runs/{e1,e2,e3,e4,e15,happy,dry}`, `merge/`, `tt/`, `stems/`). The mock ran on port 19950 with a fake key and a
fake HOME.

**Verdict: NOT READY for end-to-end QA until O1 is fixed.** O2 must be done before the merge. O3–O9 should follow.

What Opus confirmed:
- Dry runs write nothing and connect to nothing. `--go` can't be swallowed by a value flag.
- The Authorization header goes only to the queue. The key appears in 0 files.
- Old styles are byte-identical: film-sample (keynote, drop + breaks), edge-test main and the `short` cutdown (track +
  VO), and cue (playful).
- The fix round leaves untouched everything screen.mjs, the film style and the bg contract depend on.
- Every documented command uses real flags, and the description is 1019 chars.

## Worker A
- **O1 HIGH (accepted): a cut-off paid run steers the next run into paying again.** gen.mjs:221–224 and :371–379;
  FOOTAGE.md.
  - (a) The preflight ignores the existing log. After Claude Code's 2-minute shell timeout kills a `--go`, the same command
    says "already exists — pick another --out, or add --force (pays again)". It never offers `fetch` for the request id
    the log already holds as paid. The same happens with a `submit: unknown` stub and a pending log.
  - (b) A kill during the submit leaves no trace, so a plain re-run submits again: 2 requests on the mock.
  - (c) FOOTAGE.md never says to run `--go` or `fetch` in the background.
  - Fix:
    - (a) One `classify()` over the existing log and any pending logs, shared by the preflight and `fetch`:
      - a paid request not fully downloaded → "request <id> is paid but not downloaded — resume it: <fetch cmd>; --force
        starts a NEW paid generation";
      - a stub → "check fal.ai/dashboard/requests, then fetch it by id";
      - otherwise the existing message, with "(pays again)" on both options.
    - (b) Write the stub *before* the POST: at logPath if it's free, else at `<base>.pending-submit.fal.json`. Delete it on
      a definite 4xx; the pending log replaces it on success.
    - (c) Docs: run `--go` and `fetch` in the background (they take 1–11 min). A cut-off run is fetched, never re-run.
- **O3 LOW-MED (accepted): a forced still run sweeps a sibling video into `.prev-stray`.**
  - Example: stills `plate1-key` alongside a video `plate1-key_1.mp4`. `numbered()` matches any extension.
  - Fix: match only the extensions this run can write (raw with an extension: that one only), and skip files that
    another sibling log lists.
- **O4 LOW (accepted): two processes on one request** (e.g. `fetch` while `--go` is still downloading) append to the same
  `.part-<id>`, so one can accept a corrupt copy.
  - Fix: an O_EXCL `<log>.lock` holding the pid, for `--go` and `fetch`. A stale lock (dead pid) is taken over, with a note.
- **O6 LOW (accepted): screen.mjs `--out` has no guard** (it overwrites e.g. `assets/screen.png`, an official screenshot).
  - Fix: refuse an existing `--out` unless `--force`, and write through a temp file and a rename.
- **O7 LOW (accepted): FOOTAGE.md's commands are relative to the current folder** without saying so. From anywhere else,
  paid files land outside the job.
  - Fix: say "run from the job folder (`cd DIR`)", or prefix every path with `DIR/`.
- **O8 LOW (accepted): footage tools trace back (exit 1) when ffprobe is missing, or when node is missing for an HDR
  clip.** The recreate tools say it plainly (exit 2).
  - Fix: catch FileNotFoundError in `footage/_media.py` (:93–99, :132) and print a plain message, exit 2.
  - Also: `probe` should skip attached cover pictures, and the numpy message should name the interpreter, as recreate's does.

## Worker B
- **O5 LOW (accepted): temptrack fails a good temp track from an MKV or WebM reference.**
  - The priming time bases differ (1/44100 vs 1/1000), and Opus in WebM fails both the PCM and the priming checks.
  - Fix:
    - compare priming as pts × time_base in seconds;
    - refuse non-MP4/MOV (or non-AAC) references up front with "remux to .mp4 first";
    - add one line to RECREATE.md §6.
- **O8 (accepted), recreate part:** the HDR "can't convert" message recommends conform.py, which needs the same node.
  Advise installing Node or exporting an SDR copy.
- **O9 LOW (accepted): compare.py `match_cuts` reuses `lo`/`hi`** (:157 vs :180–181). From the second cut on, the curve
  window is truncated for cuts under ~9 frames apart. Fix: rename the inner variables.
- **Helper parity (Opus simplification, accepted in this form):** the two output-safety copies have already drifted. Only
  footage checks one output against another, and the umask reads and messages differ.
  - Each folder keeps its own module, with no cross-folder import.
  - recreate/media.py's guard must behave like footage/_media.py's: input/output and output/output collisions via
    samefile and realpath; a symlink to an unrelated file is replaced, not written through; temp + rename; normal
    permissions (0666 & ~umask); the same message wording.
  - Add a parity test that runs both modules' guards on the same cases.

## Lead
- **O2 MED (accepted): the merge plan is stale.**
  - Add the 4 spec.mjs edits to `apply_pointers.py` as anchored edits. Each target line exists exactly once in live and
    in all four fix-round worktrees. wt-film rejects a plain diff, because its `RESERVED` line is trailing context.
  - audio.mjs is untouched by every worktree, as are hdr.mjs, common.mjs, server.mjs, stage.html and deliver.mjs. It can
    be copied as is.
  - Rewrite PATCHES.md:
    - spec.mjs has 4 edits;
    - audio.mjs has non-film hunks (the stem `post` hook, quiet-SFX);
    - GUIDE has 10 edits;
    - `templates/beats.yaml` is now edited too;
    - Worker B's file list;
    - the B8 fingerprint note;
    - re-test items for after the fix-round merge.
  - Note that wt-tools' new breakdown.mjs tracker changes recreate numbers. higgsfield02 drops from confidence 0.941 to
    0.55 (`offBeat: true`). Our film stays at 0.745, and the film-87 and film-init masters are unchanged.
    - RECREATE.md's worked example ("0.94") and `music.py compare`'s printout change after their merge, but the verdict
      doesn't.
    - Add this to the re-test list.

## Deferred (not in this port)
**gen.mjs long-term simplification:** put the request id in every output name and log, with a "current" pointer. That
removes archive, archivePlan, archiveName, strays and the pending→rename dance (about 60 lines), and makes the whole
name-collision class (C3, C7, C8, O3) impossible by construction. Worth doing after QA, as its own change.

## Re-verification on `stage-r3-after-opus-fixes` (Opus, 2026-10-22): READY for end-to-end QA
- **O1–O9: all FIXED**, by replaying e1, e2, e3, e4, e15, tt/ and merge/.
  - e1: a re-run prints the fetch command, the mock still holds 1 request, and the fetch completes byte-exact.
  - e2: a kill during the submit leaves a stub, and the re-run is refused with the dashboard advice (1 request, against
    2 before).
  - e15: a 500 leaves a stub; a 422 leaves nothing.
- **The invariants hold.** 60 racing `--go` pairs gave 0 double submissions. A dry run with `--force`, a stale lock and a
  stub present changes no file.
- **Interplay cases are correct:**
  - a stale lock, plus a stub, plus `--force`;
  - a kill between writing the stub and the POST;
  - a pending log saved before its stub was removed;
  - a complete A, plus B's stub and B's pending log.
- **Worker A's four extras are correct and worth their cost.** gen.mjs is now 509 lines, up from 419.
- **New, LOW:**
  - **N1 (accepted):** the lock is briefly empty between `openSync` and `writeSync`. In 7 of 60 simultaneous starts a
    second process judged it stale and took it over. The stub still prevented any double submit, but the second
    process's exit deleted the lock while the first was still downloading.
    - Fix: create the lock with its content in one step (write `<lock>.<pid>`, `linkSync` it to the lock name, unlink the
      temp), or treat an empty lock under ~10 s old as live.
  - **N2 (accepted):** a `fetch` of an unrelated id onto an `--out` that holds a stub silently takes the stub over. The new
    log keeps the stub's input (the wrong prompt), and the stub, the only local trace of that earlier submit, is gone.
    - Fix: rename the stub to `.prev-submit…` instead of merging it, and say so.
  - **N3 nits (accepted):**
    - a stub at the main name is archived as `.prev-old.fal.json`, but the header says `.prev-submit.fal.json`;
    - "--force starts a NEW paid generation" follows a fetch command that itself has `--force`; say "--force on the
      --go command";
    - "paid but not downloaded" also fires after the user deletes a downloaded file (e.g. the still they didn't pick).
      Fetch just re-downloads it; say so, or treat it as done.

## Independent check of N1–N3 on `stage-r4-final-candidate` (Opus, 2026-10-22): READY
- **N1, the lock: OK.**
  - 60 pairs of simultaneous `--go` runs gave 60 submissions in total. 0 takeovers (r3 had 7 of 60), 0 double submits,
    0 leftover lock files.
  - 6 runs released at once over a dead run's lock, 25 trials: exactly 1 submission and 1 takeover each time.
  - A takeover file left by a killed taker, 10 trials: exactly 1 submission each time, and the claim is cleared.
  - A holder killed before the POST: the next run takes over and submits once.
  - A holder killed mid-POST: the stale lock plus the stub mean the next run is refused with the dashboard advice
    (1 request at the mock).
  - A lock folder that isn't writable: exit 2 before anything is sent.
- **N2: OK.** A fetch onto an `--out` holding a stub keeps the stub as `.prev-submit.fal.json`, with its prompt, and
  merges nothing into the new log.
- **N3: OK.** The archive tag, the "(no new charge)" and "--force on the --go command" wording, and the deleted-after-
  download path all work: the fetch restores only the deleted still, and the mock still holds 1 request.
- **Also confirmed:** apply_pointers.py rebuilds r4's four edited files byte for byte, and `--check` passes on all four
  worktrees. Old-job stems (film-sample, cue) are md5-identical, live vs r4.
- **Known limits, not blocking, recorded in PATCHES.md:**
  - A double holder is theoretically possible with a dead claim file plus at least 3 runs starting within microseconds.
    It was not reproduced, and the first run's stub would still stop a second submit.
  - A run killed between writing `<lock>.<pid>` and linking it leaves that temp file behind. It is harmless, but nothing
    cleans it up.
