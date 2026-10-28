# Review round 2 (Codex), 2026-10-22: findings and the lead's decisions

Codex reviewed the code after Sonnet's round had been fixed, i.e. `stage-r1-after-sonnet-fixes/`. Its scratch folder is
`review/codex/`, and all of its probes ran against local mocks on ports 19700–19799.

Codex confirmed:
- Dry runs make no network calls and write no files, and `--go` is still required.
- Fake keys never appear in any output. Cross-origin redirects strip the Authorization header.
- Old styles stay byte-identical, including VO, SFX, clips, layers and cutdowns. The stem hook and the quiet-SFX block
  affect film only.
- The film `hit`, its clamp, the 440 ms window, the merged breaks and the lift suppression are correct.
- The 60→30 path, rotation, footage HDR, py3.9 / C locale and UTF-8 handling are all correct.

Every item is ACCEPTED except C11, which becomes a printed note. Codex's own severity is shown; where the lead disagrees,
the lead's rating follows in brackets.

## Worker A (footage)
- **C1 HIGH [lead: MED]**: `fetch()` follows a 307/308 on the submit POST and sends the request again
  (gen.mjs:208).
  - It needs a broken server to trigger, but the fix is cheap.
  - Fix: use `redirect: 'error'` or `'manual'` on the POST. Treat any redirect as an ambiguous submission: exit 4, say
    "the request may not have been created — check fal.ai/dashboard/requests", and never replay it.
- **C2 HIGH**: on a forced run, the old outputs are archived *before* the new paid request id is saved or printed
  (gen.mjs:318). If the archive rename throws (for example EISDIR because a `.prev` directory exists), the new id is lost.
  - Fix: print the request id and save it right after the POST, before archiving anything. Make archiving
    collision-safe. If archiving still fails, write the new log under a unique name and exit 4 with the id and the
    fetch command.
- **C3 HIGH [lead: MED]**: the single `.prev` slot is overwritten. Generate A, force B, force C, and A is gone
  (gen.mjs:198).
  - Fix: versioned archives that never overwrite, e.g. `x.prev-<id8>.mp4` and `x.prev-<id8>.fal.json`, keeping the
    real extension last so the file still plays.
- **C4 HIGH [lead: MED]**, look.py part: `--json` can point at an input file and destroy it (look.py:146).
  - Fix: resolve every output before any work starts. Refuse `samefile`/realpath collisions with any input. Write
    through a temp file and an atomic rename.
- **C5 HIGH [lead: MED]**, conform/pin part: the same-path guard compares strings, so a hardlink or symlink output
  overwrites the source (conform.py:31, pin.py:39).
  - Fix: `os.path.samefile` when the output exists, realpath otherwise, and temp + atomic replace.
- **C6 MED**: resume always retries output 0, even when it is complete.
  - A 416 or curl 33 then stops the run before output 1. The curl-33 path also unlinks a valid paid output 0
    (gen.mjs:265).
  - Fix: skip outputs already proven complete, and treat 416-at-EOF as complete. Resume into a temp file without
    unlinking an established output.
- **C7 MED**: raw's preflight checks only the nominal `--out`, so surviving `_0`/`_1` files mean a second paid request
  and collisions after the POST (gen.mjs:142).
  - Fix: before the POST, refuse when any `<stem>_<n>.*` exists, unless `--force` is given.
- **C8 MED**: forced archiving only covers the *new* expected names. After `--n 2`, a `--n 1 --force` run leaves the old
  `_1` looking current, and the archived log names the wrong paths (gen.mjs:318).
  - Fix: archive every output the old log records, as one coherent generation, and keep the archived log's paths correct.

## Worker B (recreate + film)
- **C4**, track/music/compare part: the output can resolve to an input.
  - `track.py --out source.mp4` replaces the video, and music.py `--json` behaves the same way.
  - With compare.py, a reference inside `--out` (e.g. `proof/sbs.mp4` as the ref, output to `proof`) is overwritten.
  - Fix: the same as above, a samefile/realpath refusal plus temp + atomic writes.
- **C5**, temptrack part: a symlink or hardlink output overwrites the film source (temptrack.py:57). Fix: samefile/realpath.
- **C9 MED**: `music.hit` is validated for every style, so a legacy playful job with an ignored `hit:` now exits 2
  (spec.mjs:109).
  - Fix: read and validate `hit` only when the style is `film`. Ignore it for the others, with at most a warning.
- **C10 MED**: break muting tests loop placement, not every emitted onset. At 60 BPM, break 6.5–7.5 still emits a kick
  at 6.75, and break 5.4–6.6 emits motif notes at 5.5 and 6.5 (audio.mjs:138).
  - Fix: apply the merged-break test to every final event onset.
- **C11 MED [lead: by design → note only]**: the 1 % fps tolerance treats 29.97 and 30 as the same grid.
  - For a frame-for-frame recreation, pairing by frame index is exactly what's wanted. Refusing would push the user into a
    conform that repeats or drops frames.
  - Instead, print a note when the rates differ slightly: "29.97 vs 30 fps: compared frame for frame, by index; their
    times differ by 0.1 %".
- **C12 MED [lead: LOW]**: `--verify` ignores the candidate's declared rate, so a 30 fps proof passes a `--half`
  verify (compare.py:338).
  - Fix: check its exact fps (the ref's, or half with `--half`) and its frame count.
- **C13 MED**: recreate decoding doesn't tone-map HDR. Both sides decode wrong in the same way, so verify still says
  exact (media.py:46, compare.py:353).
  - Fix: apply the engine's `hdrFilter(trc)`, as `footage/_media.py`'s `hdr_prefix` does. Or refuse HDR, with advice.
- **C14 MED**: frame iteration ignores ffmpeg's exit code, and compare seeds a first score before any frame has decoded.
  A corrupt input gives exit 0 and a one-frame proof (media.py:94, compare.py:48).
  - Fix: check the decoder's exit, refuse zero frames, and initialise only after the first real frame.
- **C15 MED**: RECREATE.md hard-codes 30 fps (`n/30`, `conform --fps 30`). A 24 or 60 fps reference gets the wrong cut
  times (RECREATE.md:54, :113).
  - Fix: use the reference's own fps (`n/fps`, `conform --fps <ref fps>`, probed), with 30 as the example.
- **C16 LOW**: snapping both break edges within 35 ms can collapse a short break to zero length, so the music plays
  through it (audio.mjs:76).
  - Fix: snap the interval as a whole, and keep the original if snapping would make end ≤ start.
- **C17 LOW**: degenerate audio. A 50 ms WAV gives a traceback, and 10 s of silence gives `NaN` in the JSON
  (music.py:44, :184).
  - Fix: enforce a minimum length, handle zero energy with exit 2, and serialise with `allow_nan=False`.
