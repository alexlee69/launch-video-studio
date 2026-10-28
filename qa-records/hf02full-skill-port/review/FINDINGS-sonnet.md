# Review round 1 (Sonnet), 2026-10-22: findings and the lead's decisions

The reviewers returned these findings as text, and the lead saved them here.
- **Scratch folders:** `review/sonnet-A/` (probes, `gen-fixes.diff`, `footage-fixed/_media.py`) and `review/sonnet-B/`
  (probe jobs).
- **Snapshot before the fixes:** `stage-r0-before-review-fixes/`.
- **What the reviewers confirmed:** no key leak and no spend without `--go`. Old music styles are byte-identical on
  100/100 files (13 builds over 6 jobs: cutdowns, `level:`, `downbeat:`, `breaks:`, track + VO). `stem()` callers
  return undefined for the old styles. SFX stems are identical whatever the music style, so clips and layers are unaffected.

## Section A: footage (`video/footage/**`, FOOTAGE.md, footage-prompts.md). Every item is ACCEPTED and fixed by Worker A.

### High and medium
- **A1 HIGH: `--force` destroys a paid result before the new one exists** (gen.mjs:279, 281-282, 298-300).
  - It deletes the old outputs and replaces the old log (losing the paid request id) before fal has accepted the new request.
  - `fetch --force` does the same.
  - Fix: touch nothing before fal returns a `request_id`. Then move the old outputs and log to `.prev`.
- **A2 MED: a $0.00 estimate when the input has no duration** (gen.mjs:146, `raw …h3-max/text-to-video`).
  - Fix: print "unknown — the input has no duration (fal's default applies); check fal.ai/models/<ep>".
- **A3 MED: docs wiring.**
  - GUIDE.md:588 Limits still says AI footage "aren't generated here". The lead fixes this.
  - GUIDE.md:16 requirements leave out python3 with numpy and Pillow, and curl. The lead fixes GUIDE; Worker A adds a line
    to FOOTAGE.md.
  - look.py and pin.py die with a bare ModuleNotFoundError when numpy is missing. They should print
    `pip3 install numpy pillow` (Worker A).
- **A4 MED (L1): stray URLs become outputs** (gen.mjs:223-231).
  - A `{video, thumbnail}` result writes `x_0.mp4` (and `x_1.mp4`, which is a JPEG) and never writes `x.mp4`.
  - Fix: `still` and `video` read only `images[]`, `image` and `video.url`, and a video takes the first URL. Keep the deep
    walk for `raw` only.
- **A5 MED (L2): `fetch B --force` onto request A's log polls A** (gen.mjs:274).
  - Fix: start a fresh log when the ids differ, and spread the old log before `endpoint` / `request_id`.
- **A6 MED: HDR clips are only relabelled BT.709** (conform/pin `setparams`).
  - An HLG patch measures 181 after conform, against 241 from the engine.
  - Fix: probe returns `color_transfer`. For arib-std-b67 or smpte2084, prepend the engine's own `hdrFilter(trc)` from
    `lib/hdr.mjs`, the same conversion `extractPlates` uses.
  - Prove it on a synthetic HLG fixture against the engine. If it can't be made to match the engine, refuse with exit 2
    and advice.
- **A7 MED: probe ignores the Display Matrix rotation** (`_media.py`).
  - look.py prints wrong numbers, and pin.py exits 3 on a rotation-tagged portrait clip.
  - Fix: read `side_data_list` rotation and `tags.rotate`, and swap w/h when `rot % 180 == 90` (prototype in
    `sonnet-A/footage-fixed/_media.py`).

### Low
- **A8: a refused submit (422/401) leaves a stub log that blocks the retry.**
  - Fix: write the log only once there is a `request_id`.
  - An ambiguous failure (≥ 500, a network error) keeps a stub marked `submit: unknown`, so the "may pay twice" guard stays.
- **A9: `fetch` without `--force` can delete or corrupt an unrelated file at `--out`.**
  - Fix: treat an existing `--out` as a conflict unless the log proves it is this request's partial download, or
    `--force` is given.
- **A10: one transient 5xx or 429 on a status or result GET aborts the run.** Fix: retry GETs on 429 and 5xx in the
  existing loop.
- **A11: stray positional arguments are ignored.** `--prompt a woman holding … --go` spends money on the prompt "a".
  Fix: exit 2 on extra positionals (still/video 0, raw 2, fetch 1).
- **A12: dotted still prefixes give the wrong names** (`--out plate.1` writes `plate.1_0.1`; `--out hero.jpg` writes
  `hero_0.jpg`, and then the fetch hint is wrong).
  - Fix: a still is always `${prefix}_${i}${ext}`. `fetch` reuses `log.outputs[].file` when the log belongs to the request.
- **A13: downloads trust `file_size` over curl.**
  - A wrong size gives a false exit 5, or a full re-download on every try.
  - Fix: accept the file after a clean curl exit 0 that ffprobe can read. Warn on a size mismatch.
- **A14: `FAL_KEY="abc"  # note` keeps its quotes.** Fix the .env parsing.
- **A15: fetch hints print `--out` and the script path unquoted.** Fix: shell-quote them.
- **A16: pin.py problems.**
  - It has no same-path guard, so `pin.py same.mp4 screen.png same.mp4` overwrites the paid source.
  - `--track-png newdir/t.png` gives a traceback after the video is written. Fix: create the folder first.
- **A17: look.py path and frame-index problems.**
  - A path containing `[` gets globbed; check `os.path.exists` first.
  - 101 or more frame indices give "Cannot allocate memory" from an over-long `select=`. Fix: chunk it, 48 per pass, as
    breakdown.mjs does.
- **A18: conform.py fails on an odd-sized source without `--size`** (raw ffmpeg error). Fix: crop to even dimensions
  (no resampling), or exit 2 with a hint.
- **A19: screen.mjs prints a raw stack.**
  - `extractPlates` / `launch()` errors print a raw stack and exit 1. Fix: a plain message, exit 2 for beats.yaml
    problems, as `--storyboard` does.
- **A20: doc nits.**
  - footage-prompts.md says "~10 % longer"; the real figure is 3–10 % (6 s → 6.58 s, 5 s → 5.17 s).
  - A literal `--grade "…"` example fails in ffmpeg.
  - The look table differs from look.py's default 12 frames: say "about", or give the frames used.
  - MIME has no `.m4v`.
  - SKILL.md description: 1019 parsed characters (1021 raw), which is within 1024. Note it in PATCHES.md; no change.

## Section B: recreate and `music: film`. Every item is ACCEPTED and fixed by Worker B, except B9, which the lead does.

### Medium
- **B1 MED: the film-style hit is fixed to the end card's first frame.**
  - On hf02, the reference's hit lands 0.372 s after its end-card cut (n1787 = 59.567 s against a hit at 59.939 s). A
    `sec:`-shot rebuild of hf02 therefore reads `OFF THEIR BEAT — the biggest hit 59.565 vs 59.939 s`.
  - Fix (lead's design): `music.hit`, the hit's offset in seconds from the end card's first frame.
    - Default 0; the range is −1…+2. An absolute time like 59.9 fails validation with a message explaining the field.
    - The silence becomes `[hit − 0.44, hit]` and the lift counts back from the hit.
    - It is ignored when there is no end card.
    - This is a 4th spec.mjs edit.
  - RECREATE.md uses the hf02 example: `hit: 0.372`.
- **B2 MED: `--film` masters are 60 fps, but the proofs need the reference's 30.**
  - compare.py exits 2 with a hint that can't be run.
  - track.py measures 60 fps frames 300-311 (5.0-5.18 s) when the reference's are 10.0-10.37 s.
  - Fix:
    - RECREATE.md §5 gets a conform step (`conform.py ours.mp4 ours30.mp4 --frames <ref frames>`, then `--audio ref|none`).
    - compare.py's error prints that full command.
    - track.py prints the video's fps in its summary.
- **B3 MED: `onGrid` tolerance .01 → .035.**
  - A drop or break cut 10–35 ms after a grid line lands a beat late.
  - Three of hf02's 22 cuts sit there: n465 +16.9 ms, n671 +23.3, n1000 +13.5.

### Low
- **B4 (LOW-MED): breaks and risers.** Merge breaks that touch or overlap. Skip the lift's riser and crash when a break
  ends within .02 s of the lift.
- **B5: output folders.** track.py and music.py `--out` / `--json` should create the folder before the work starts.
- **B6: compare.py verify margin.** Add `and other < .8 * own`, so a narrow portrait half doesn't false-alarm.
- **B7: track.py header.** It says "~10–15 s a frame"; the measured figure is about 3 s.
- **B8: audio fingerprint.** `audioPrint` hashes audio.mjs, so once installed, an old finished job's `--qa` fails `audio`
  until `--audio` is run once. The stems and master are identical. The lead documents this in PATCHES.md and the report.
- **B9: GUIDE and template style lists.** The lead fixes GUIDE.md:25 (step 3: playful / keynote / calm) and the
  templates/beats.yaml:24 style list. GUIDE.md:588 is the same as A3.
- **B10: compare.py drops a cut on the `--from` frame.** Allow `n == a` when `a >= 1`.
- **B11: honesty and display.**
  - RECREATE.md's example leaves out kick r −0.21 (ours anti-correlates). Add it.
  - music.py prints "(+180 dB)" after digital silence. Cap it, e.g. "> 60 dB".
  - Also: when the two tempos differ by ×2 or ×0.5, `compare` should say the tracker may have locked to half or double
    time. RECREATE.md should note that 60 and 180 BPM read as 120 and 90.
