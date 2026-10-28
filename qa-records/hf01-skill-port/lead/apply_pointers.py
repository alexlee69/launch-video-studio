# -*- coding: utf-8 -*-
# The hf01 → skill port's text edits to existing skill docs (RECREATE.md §8 + pointers + worked example, FOOTAGE.md's
# multi-leg plates section + H3 audio trap, GUIDE.md's three command lines), as exact anchored insertions, so they can be
# re-applied after the 10-21 fix round merges into live (run the hf02 port's apply_pointers.py first: GUIDE.md's anchor
# is its compare.py line). Each edit carries a marker: present → "already applied", skipped; otherwise its anchor must
# match exactly once, or nothing is written at all.
#   python3 -E apply_pointers.py <skill dir> [--check] [--only video/GUIDE.md,…]     (--check: report only)
import argparse, os, sys

ap = argparse.ArgumentParser()
ap.add_argument('skill'); ap.add_argument('--check', action='store_true'); ap.add_argument('--only', help='e.g. video/GUIDE.md')
A = ap.parse_args()
skill, check, only = A.skill, A.check, set(A.only.split(',')) if A.only else None

SEC8 = """## 8 · Finish like the reference: plates, cadence, sound, corner bug

Some references are finished brand films, and four things beyond the cuts make them read as theirs. higgsfield01
(76.5 s, 30 fps) is a **24 fps edit inside a 30 fps file**; its footage shots are generated legs joined inside moves;
its score carries the sound; a watermark hops between corners on its own clock. Measure each, rebuild them after
sections 1–4, then prove the finished file (section 5).

```bash
python3 $V/recreate/finish.py --measure ref.mp4                   # "15:5,10,14 — 457 of 459 slots repeat …; edit rate 24 fps in 30 fps"
python3 $V/footage/plates.py DIR/tools/plates.json --sheet        # one 24 fps plate per live-action shot, from its legs (FOOTAGE.md)
python3 $V/recreate/sfx.py DIR/tools/sfx.json --out DIR/audio/sfx.wav   # the effects, each in the reference's own slot
python3 $V/recreate/finish.py --master DIR/<slug>-16x9.mp4 --out DIR/<slug>-final-16x9.mp4 --ref ref.mp4 \\
  --keep music --add DIR/audio/sfx.wav                            # cadence + re-mix + master + mux + QA (exit 1 on any ✗)
```

- **Cadence.** Every 15 output frames, 3 repeat the frame before (n % 15 ∈ {5, 10, 14}): 12 new frames in 15, a 24 fps
  edit. That stutter is the film's motion texture; every cut, whip and camera step sits on it. `lv.mjs --film` renders
  60 fps and `finish.py` rebuilds the 30 fps file by index: output frame n shows edit frame m = (n div 15)·12 + r −
  #{slots ≤ r} (r = n mod 15). **Never `fps=30`**: on 24p it repeats at {2, 7, 12} (its own rounding phase), and
  `fps=24,fps=30` from 60 lands there too; `--pattern 15:2,7,12` reproduces it and QA fails it ("measured 5:2 — NOT the
  reference's"). `--pattern P:S…` gives a cadence by hand; a reference with none gets `--cadence none` (a straight
  60 → 30), which `--ref` picks by itself.
- **Every shot on its own clock.** lv.mjs starts a shot's animation and its footage on the shot's first master frame
  f_k: a 24 fps plate shows its frame p from f_k + round(2.5·p) on (measured on manus2-space's master). So finish.py
  takes a shot's edit frame m from master frame f_k + ceil(2.5·(m − m_k)) — every plate frame once, nothing between —
  and keeps it inside the shot. The shot starts come from the master's own `DIR/out/main/timeline.json` (lv.mjs writes
  it; the default), or from `--cuts` for a master without one: the shot starts in output frames (a recreation's are the
  reference's cut list, shots laid at n/30 s as section 2 says: compare.py's `cuts.json`, the breakdown's
  `breakdown.json`, a `cuts.txt`). **One clock for the whole film is wrong twice** (`--cuts none` shows it): with shots
  at n/30 s, every shot that starts on n % 15 = 4 or 9 has its plate out of phase — skip a frame, hold a frame, 12 fps
  judder all shot long (manus2-space's S03 and S15) — and the frame before such a cut reaches into the next shot, so
  the cut lands a frame early (5 of higgsfield01's 26). Each half alone fails: clamping the film's grid into the shots
  puts the cuts back but keeps the judder; each shot's own clock unclamped ends a shot that outlasts its master frames on
  the next shot's first frame. A shot with more edit frames than its master frames hold (one that starts on n % 15 = 0
  and is 4 mod 5 frames long) keeps its last picture for one frame; finish.py lists those frames.
- **Plates** (FOOTAGE.md → Multi-leg plates): a long reference move is several generated legs, joined where the
  reference hides its own joins (a passing panel → `hblur`, a sunrise bloom → `fadewhite`, a crash-zoom → `zoomin`) and
  kept at the clips' 24 fps — the cadence pass shows each plate frame on its own slot.
- **Sound grammar.** Read the reference's inventory before mixing. higgsfield01's score does nearly everything: no
  transition whooshes, a silent UI (no clicks, no pops), a few effects in fixed slots, beds that cut with the picture.
  So `--keep music` (the engine's `whoosh` and `points` stems stay out) `--add sfx.wav`: `recreate/sfx.py` synthesizes
  each effect in the reference's own slot, made true to our story (manus2-space: the vacuum rule — in-suit sound only
  until the re-entry roar), from a seeded kit (`--list`); worked example `recreate/examples/manus2-space-sfx.json`,
  44 events. The generated clips' own audio is a tonal bed, not sound effects: never use it (FOOTAGE.md → Traps).
- **Loudness.** finish.py masters the re-mix like the engine (gain, then a look-ahead limiter, until −14 LUFS ±0.2 with
  the true peak ≤ −1 dBTP measured after the AAC encode): manus2-space −14.0 LUFS / −1.1 dBTP. One pass with a fixed
  limiter landed at −14.5 / −2.0: the end hit's peak holds the gain down.
- **Corner bug (optional, off unless `--bug`).** Only when the storyboard has one, checked against every overlay —
  manus2-space's film leaves it off (it collided with prompt bars and bubbles, and the approved storyboard had none). A
  clock spec places it: boxes per corner on a 1920×1080 frame, the switch frames, fade-out / fade-in tables, the build,
  the end; `recreate/corner-bug-hf01.json` is higgsfield01's (TR ↔ BL every 270 frames, a 9-frame fade out, 11 in). Our
  own mark and wordmark (white, from the official kit; an SVG is rendered with headless Chrome), never the reference's
  watermark: `--bug $V/recreate/corner-bug-hf01.json --bug-glyph mark-white.svg --bug-text wordmark-white.svg`. It runs
  on the edit's clock, so a repeat frame repeats it too.
- **QA** (exit 1 on any ✗): frame count and duration, BT.709 tags, the cadence measured on the output against the
  reference's (on-slot repeats ≥ 98 %), every new frame matching the master frame it was taken from (normalized
  correlation on a centre crop against ±1 frame, ≥ 99.5 %), the AAC's loudness and true peak. Then section 5's
  `compare.py` on the finished file.
- **Traps.**
  - qlmanage renders an SVG at its intrinsic size and crops it: render marks with headless Chrome (finish.py does).
  - Editing beats.yaml, blocks or assets while `--film` renders stales that render's own QA: wait, then `--film --range`.
  - This Mac's ffmpeg has no `drawtext`: labels and marks go in as PNG overlays.
  - ffmpeg 8 drops `-color_*` on untagged raw frames: finish.py stamps BT.709 with `setparams` (QA reads the tags back).
  - x264 shifts a frame's brightness on flashes (S20's red alarm pulse): the pick check uses normalized correlation (a
    lossless `--crf 0` run matched every pick exactly).

"""

WORKED = """
## Worked example: manus2-space (2026-10-23)

`~/Downloads/launch-videos/manus2-space/` — higgsfield01 (76.53 s, 1080×608, 30 fps, 2,296 frames) rebuilt as the
Manus 2.0 film "The Lull": one locked astronaut (gpt-image-2 sheets), 16 MiniMax H3 legs in 12 plates, our UI and
copy. The skill's section 8 tools were checked against the job's own (Design-AutoPilot-stable `qa/hf01-skill-port/`).
- Cadence: higgsfield01 measures `15:5,10,14` — 457 of 459 slots repeat, 105 other repeats (holds).
- The 60 fps master (`compare.py`, frame 2i): cuts 25 of 26 exact, n1532 within 1 f; `music.py compare` ON THEIR BEAT
  (Δ 0.00 BPM, beat phase 1.1 ms, onsets +2 ms, the biggest hit 10 ms apart).
- Finished on one clock, the 30 fps file read 20 exact + 6 within 1 f — the 5 cuts on n % 15 = 4 (n364, n994, n1234,
  n1294, n1399) a frame early — and S03 / S15's footage played every other plate frame twice. On the shots' own clocks
  (`finish.py --master manus2-space-16x9.mp4 --ref higgsfield01.mp4 --keep music --add audio/sfx.wav`, 27 shots from
  its timeline.json): cuts 25 exact + n1532 within 1 (as the master), 459/459 slots, picks 1,836/1,836, −14.0 LUFS /
  −1.1 dBTP, BT.709, no frame clamped — and frame for frame the job's shipped first cut (mean |Δ| ≤ 1.0 at 480×270).
- `plates.py` on the worked spec rebuilt the job's 12 plates byte for byte (281/16/17/226/68/108/21/32/9/99/87/197
  frames); `sfx.py` rendered the job's 44-event `sfx.wav` sample for sample.
"""

FOOT = """## Multi-leg plates — `plates.py`

A shot the reference holds on one long move (higgsfield01's 11.6 s opening fly-through) outlasts a generated clip, or
changes subject mid-move: generate it in legs and join them where the reference hides its own joins — a panel passing
the lens (`hblur`), a bloom of light (`fadewhite`), a crash-zoom (`zoomin`); `fade` is a plain dissolve.

```bash
python3 $V/footage/plates.py DIR/tools/plates.json --dry-run          # every window checked, the plan printed, nothing written
python3 $V/footage/plates.py DIR/tools/plates.json [S01 …] --sheet     # DIR/assets/footage/<SHOT>.mp4 + review/plate-<SHOT>.jpg strips
```

- **The spec** (worked example: `recreate/examples/manus2-space-plates.json`, 12 shots from 16 legs): per shot its
  `first` reference frame and length (`frames`, counted at `ref_fps`), then its legs in order — `clip`, `start` (seconds
  into the clip), `frames` (the reference frames this leg fills; the legs add up to the shot) and an optional `join` into
  the next leg (`kind`: any ffmpeg xfade transition, `frames`: its length in plate frames). `clips` and `out` are relative
  to the spec file; `--clips` / `--out-dir` override them.
- **Native rate.** Plates stay at the clips' own 24 fps (`fps: null`): lv.mjs starts a plate on its shot's first master
  frame and shows its frame p from round(2.5·p) on, and `recreate/finish.py` (RECREATE.md §8) puts every plate frame on
  the reference's own 30 fps slot, each once. For a 30 fps film, `"fps": 30` gives conform.py's one-in-five repeats.
- **Windows.** A leg needs `frames / ref_fps` seconds from `start`, plus its join's overlap and, on the last leg, the
  shot's `tail` (3 frames by default, so the engine never runs off the plate). A short clip is refused (exit 2) with the
  missing time and the latest start that fits; pick each start from the clip's own action on its strip (`--sheet`).
- **Grade.** plates.py doesn't grade. Grade a finished plate frame for frame: `conform.py plate.mp4 graded.mp4 --fps 24
  --frames <its frames> --grade "…"` (`--fps 24` keeps every frame — 226 in, 226 out).
- **Into the job**: `bg: assets/footage/S01.mp4`, `bgFrom: 0`, `bgMove: none`, `bgDim: 0` (t = 0 is the shot's first
  frame). A custom block that shows a clip inside its own UI (a video editor's viewer) declares the field in `media:` and
  plays it through `ctx.footage` (GUIDE → Custom blocks).
- Output: H.264 yuv420p, BT.709, no audio, exactly the shot's plate frames + tail (checked by packet count), written
  through a temp file and one rename. Exit 2: a bad spec, a missing clip, a window the clip can't cover; 1: ffmpeg.

"""

GUIDE_ANCHOR = ("python3 $V/recreate/compare.py --ref REF.mp4 --ours OURS.mp4 --out DIR/compare/NAME   # frame-exact side-by-side "
                "+ cut report vs a reference (RECREATE.md)\n")
GUIDE_LINES = ("python3 $V/footage/plates.py DIR/tools/plates.json [SHOT …] --sheet   # one 24 fps plate per live-action shot from its generated legs (FOOTAGE.md)\n"
               "python3 $V/recreate/sfx.py DIR/tools/sfx.json --out DIR/audio/sfx.wav  # synthesized effects, each in the reference's own sound slot (RECREATE.md §8)\n"
               "python3 $V/recreate/finish.py --master DIR/<slug>-16x9.mp4 --out DIR/<slug>-final-16x9.mp4 --ref REF.mp4   # the reference's 24p-in-30p cadence, re-mix, master, QA (RECREATE.md §8)\n")

HF02_TAIL = ("- Temp track: `out/film-tempmusic-PRIVATE.mp4`, decoded audio md5 486aab4c… = the reference's, video packets\n"
             "  80d435ae… = film.mp4's, the same 2,112-sample priming.\n")

# (marker, anchor, replacement): skipped when the marker is in the file; else the anchor must appear exactly once
EDITS = {
  'video/RECREATE.md': [
    ('and, for section 8, `manus2-space/`',
     "The worked example is `~/Downloads/launch-videos/hf02-full/` (numbers at the\nend).",
     "The worked examples are `~/Downloads/launch-videos/hf02-full/` and, for section 8, `manus2-space/`\n(numbers at the end)."),
    ('keeps them at 24 instead',
     "film's frame grid before they go into a shot.\n",
     "film's frame grid before they go into a shot. A reference that is itself a 24 fps edit in a 30 fps file (`finish.py\n"
     "--measure` prints a cadence such as 15:5,10,14) keeps them at 24 instead, one plate per shot from its legs\n"
     "(`footage/plates.py`), and finishes the film in its cadence (section 8).\n"),
    ('prove the finished file, not the master',
     "measured after the film engine's own conversion to SDR.\n",
     "measured after the film engine's own conversion to SDR. For a reference finished at 24 fps in 30 (section 8),\n"
     "prove the finished file, not the master: `compare.py --ref ref.mp4 --ours DIR/<slug>-final-16x9.mp4` pairs them 1:1\n"
     "and reads every cut where a viewer sees it (the master's frame 2i is not always the frame the finish shows).\n"),
    ('ships `<slug>-final-16x9.mp4`',
     "- The master is our film with our score (`<slug>-16x9.mp4`, QA PASSED). Never ship the temp track or a side-by-side.\n",
     "- The master is our film with our score (`<slug>-16x9.mp4`, QA PASSED). Never ship the temp track or a side-by-side.\n"
     "- A reference finished at 24 fps in 30 (section 8) ships `<slug>-final-16x9.mp4` (finish.py exit 0); the master stays\n"
     "  its source.\n"),
    ('## 8 · Finish like the reference',
     "## Worked example: hf02-full (2026-10-22)\n",
     SEC8 + "## Worked example: hf02-full (2026-10-22)\n"),
    ('## Worked example: manus2-space (2026-10-23)', HF02_TAIL, HF02_TAIL + WORKED),
  ],
  'video/FOOTAGE.md': [
    ('## Multi-leg plates — `plates.py`', "## Pin the app onto a phone — `pin.py`\n", FOOT + "## Pin the app onto a phone — `pin.py`\n"),
    ('/ `plates.py` drop it',
     "- **The model's audio** is on every clip; `conform.py` / `pin.py` drop it.\n",
     "- **The model's audio** is on every clip; `conform.py` / `pin.py` / `plates.py` drop it. Don't mine it for sound\n"
     "  either: MiniMax H3's audio is a generated tonal bed, not the scene's sound — effects come from `recreate/sfx.py`\n"
     "  (RECREATE.md §8).\n"),
  ],
  'video/GUIDE.md': [
    ('recreate/finish.py --master', GUIDE_ANCHOR, GUIDE_ANCHOR + GUIDE_LINES),
  ],
}

bad, outs = 0, {}
for rel, edits in EDITS.items():
    if only and rel not in only:
        continue
    path = os.path.join(skill, rel)
    if not os.path.isfile(path):
        print('%s: missing' % rel); bad += 1; continue
    s = open(path, encoding='utf-8').read()
    for marker, old, new in edits:
        if marker in s:
            print('%s: already applied: %s' % (rel, marker)); continue
        c = s.count(old)
        if c != 1:
            print('%s: anchor found %d times (need 1): %s' % (rel, c, old[:70].replace('\n', ' '))); bad += 1; continue
        s = s.replace(old, new)
        print('%s: %s: %s' % (rel, 'would apply' if check else 'applied', marker))
    outs[path] = s
if not check and not bad:
    for path, s in outs.items():
        open(path, 'w', encoding='utf-8').write(s)
print('FAIL: %d problem(s), nothing written' % bad if bad else ('OK (check only)' if check else 'written'))
sys.exit(1 if bad else 0)
