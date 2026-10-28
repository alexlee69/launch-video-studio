# Recreate a reference film frame for frame (our content, their motion)

Use this when the user says "make ours move exactly like this film": a saved reference (a Higgsfield launch film, a
competitor's reel) rebuilt so every cut, camera move, ease, blur and event lands on the reference's frame, with our own
story on screen and our own score on the reference's beat grid. It ends with proof: a frame-locked side-by-side, a cut
report, the camera curves and a beat check. The worked example is `~/Downloads/launch-videos/hf02-full/` (numbers at the
end). `$V` = `~/.claude/skills/product-launch-sting/video`. Python tools run with `/usr/bin/python3` (numpy, Pillow).

## What we borrow, what we never do

| Borrowed (measured, then matched) | Never taken |
|---|---|
| cut points (frame numbers), transition types, shot lengths | their footage, frames, stills or thumbnails in a deliverable |
| camera: scale, shift, easing, the momentum into and out of every cut, motion blur | their copy, or a close paraphrase of it |
| event timings: when a bubble pops, a word types, a list steps, a card lands | their characters, mascots, logos, watermark, social icons |
| the beat grid (bpm, first beat), where the energy dips and hits | their music or audio (except the private temp track below) |
| the job a shot does in the edit ("a card rushes past in 3D here") | their layouts traced box for box |

**The copy trap**: swapping our nouns into their sentences ("Viewers keep asking…" → "Listeners keep asking…") is still
their film. Write every line fresh from our story, then put it next to the reference line shown at the same moment and
check it doesn't read as a rewrite. When in doubt, change the composition, never the motion.

## 1 · Measure the reference

```bash
node $V/lv.mjs --job DIR --breakdown ~/Downloads/ref.mp4            # shots, cut frames, transitions, tempo → DIR/reference/ref/
python3 $V/recreate/track.py ref.mp4 --key 300 --from 300 --to 311 --half --out curves/pan-312.json
python3 $V/footage/look.py ref.mp4 --from 3.3 --to 8.7               # the look of a footage shot (FOOTAGE.md)
python3 $V/recreate/music.py profile ref.mp4                          # the score's feel on its own beat grid
```

- **Cuts**: `breakdown.json` lists every shot's first frame (`startFrame`). Check each against its sheet: a whip or a
  zoom can hide a cut, an element whipping over a held picture can fake one. Keep your final list (one frame and a label
  per line, `75 lockup > corridor`): it drives the proofs.
- **Camera** (`track.py`): fits each frame of one shot to a sharp key frame of the same shot (scale, shift, Gaussian
  blur), frames read by index. It prints per frame `s, tx, ty, bx, by, ncc` and the speed in px/frame on a 1080-wide
  frame, then the peak speed and frame, the build ratio into it and the decay ratio after it. ~3 s a frame at `--half`
  on a 1080-wide reference: run one process per shot in parallel. Start at the key frame (`--from` > `--to` tracks
  backwards). Split at cuts; `ncc` under 0.9 means the model doesn't hold there (3D, parallax, new elements): measure
  those shots from corner landmarks on per-frame sheets instead. `--roi x,y,w,h` fits only the part that moves as one
  picture.
- **Blur on a cut frame over-reads about 2×** when other elements fade in at the same time. Calibrate: track your own
  render of the shot, where you know the σ you applied (`--scale-to 1080x608` measures a 1920×1080 render at the
  reference's size, so the readings compare 1:1).
- **Look** of footage shots: `look.py --ref` (FOOTAGE.md).
- **Score**: `lv.mjs --tempo ref.mp4` gives bpm, first beat, first downbeat and a confidence; `music.py profile` gives
  the groove (onset strength on each 16th of the bar per band), band balance, brightness and a key guess. Note where its
  energy thins out (dips), where it lifts, where it goes silent and where the big hit lands (`music.py compare` prints
  the quiet stretches and the biggest hit of each track).

## 2 · Build ours

- **Shot lengths in frames, from the reference.** A cut at reference frame `n` (30 fps) is at `n/30` s: give each shot
  `sec: <frames>/30` with 4 decimals (`sec: 0.7333` for 22 frames) and check every boundary in `--grid` (the start column
  is in 30-fps frames). `beats:` only where the reference cut lands on its beat — the breakdown's `beats-draft.yaml`
  already does this.
- **Momentum cuts** are the house grammar of these films: `out: drift-left|right|up|down` with `push: 0`, strengths
  per cut with `drift: {in, out}`, measured on hf02 (into the cut ×1.35 a frame, out of it ×0.7 a frame, blur ≈ 0.2 ×
  speed; GUIDE → Reels and launch films). Framing and in-shot moves: `zoom`, `focus`, `offset`, `pan`, `move`.
- **Bespoke shots** (a 3D corridor, a fan of screens, a burst of characters) are custom blocks in `blocks/*.mjs`
  (GUIDE → Custom blocks), driven by the measured curves — paste the tables in as data, don't eyeball them. When most
  of a film is bespoke, a hand-built stage is fine (hf02-full is one: `stage.html`, one scene file per builder,
  `motion/*.js` tables); the proofs below work on any MP4.
- **Brand art only from the official kit** (logo, app icon, mascots, fonts, screens). Never redraw them, never cast a
  logo as a character, never take them from the reference or a public video. An app icon PNG carries a transparent
  margin (the Cue icon: 100/1024 per side): trim it, or the mark sits small and off-centre in a lockup. Stand-ins stay
  generic and are listed at delivery.

## 3 · Footage

Photoreal plates, the reference's grade measured and matched, the app's screen pinned onto phones held in the shot:
`FOOTAGE.md` (`gen.mjs`, `look.py`, `conform.py`, `pin.py`). Generated clips come back at 24 fps; conform them to the
film's frame grid before they go into a shot.

## 4 · Score: our own music on their beat

```yaml
music: {style: film, bpm: 87.46, downbeat: 0.3905, drop: s2, breaks: [s14, s19], key: F}
```

- `style: film` is the hf02 score as a style: an original groove (16th shaker with accents, stabs on 1 and 3 with a
  light pickup on the and of 4, kick + soft clap, syncopated bass, a 16th arpeggio and a motif over rootless 9th chords
  I · vi · IV · Vsus2 in `key`). Every event sits on the grid `downbeat + k·beat`, the intro too, so the score's first
  beat is the reference's. Intro: pad swell, arpeggio, a shaker pickup and a riser into the `drop` shot (default the
  2nd); each `breaks:` shot dips to pad + shaker with a short riser back in; a lift over the last two bars before an
  `endcard` shot, the music silent for its last 0.44 s, then the hit on the end card ringing out. No end card: the last
  bar rings out. Default 87 BPM in F; `level:` moves the music against the SFX. `music:` scores beats.yaml jobs; a
  hand-built stage (section 2) keeps its own score script — start from hf02-full's `audio.mjs`, the same groove.
- **bpm / downbeat** from the reference's tracker reading (`lv.mjs --tempo ref.mp4`): `downbeat` = its first beat
  (when the bar accent is clear, its first downbeat). **drop / breaks** from its energy map: the shot where its groove
  comes in, the shots where it dips. Lay the shots on the same frames as the reference first (section 2), then the dips
  and the hit fall where theirs do.
- Check it: `python3 $V/recreate/music.py compare ref.mp4 ours.mp4` → both tracker readings, the onset lag of ours,
  quiet stretches, the biggest hit, both profiles on the reference's grid, and `verdict: ON THEIR BEAT` (exit 0) or
  `OFF THEIR BEAT — <why>` (exit 1): tempo within 0.15 BPM, beat phase and onsets within 35 ms, the hits within 35 ms,
  our tracker confidence ≥ 0.6.
- Traps (both hit on hf02): **flattening the 16ths killed the pulse** (tracker confidence 0.16) — keep the accents on
  the beats; **off-beat stabs flipped the tracked phase half a beat** — accent 1 and 3, keep pickups light. Match the
  reference's feel (density per 16th, band balance, brightness), never its notes.

## 5 · Proofs

```bash
python3 $V/recreate/compare.py --ref ref.mp4 --ours DIR/<slug>-16x9.mp4 --out DIR/proof --cuts-from DIR/proof/cuts.txt
python3 $V/recreate/compare.py ... --out DIR/proof-slow --from 10 --to 17 --half          # a stretch at half speed
python3 $V/recreate/track.py DIR/<slug>-16x9.mp4 --key 300 --from 300 --to 311 --half --scale-to 1080x608 --out curves/ours-pan-312.json
```

- `sbs.mp4`: frame i = reference i | ours i, decoded **by index** (never ffmpeg hstack: it re-times irregular
  timestamps and slipped 1,411 of 1,909 frames on hf02), then decoded back and checked: `verify: N/N frames exact` or
  exit 1 with the frames that slipped. Same frame rate required (conform first).
- `cuts.md` / `cuts.json`: per reference cut, our biggest picture change within ±4 frames and its offset — `exact`,
  `±1`, `off`, `missing`. `trivial` = a neighbouring shot of ours is blank (a cut next to an unbuilt shot matches for
  free; don't count it). `check` = the offset says off but the two change curves line up: motion next to the cut won the
  peak (hf02's corridor read +4 f, its frames match). Look at `cuts/cut-nNNNN.png` before telling anyone a cut is off.
  `--cuts-from` takes the breakdown's `breakdown.json`, an earlier `cuts.json` or your own list; without it the cuts are
  detected (a fallback: element whips can read as cuts, a momentum cut between near-identical screens can be missed).
- `sheet.png`: every reference shot's middle frame over ours — read it: the motion should read the same at a glance and
  the picture should be clearly a different film.
- Camera: track ours with the same tool and settings; per move the peak frame within ±0.5 f, peak speed within ±10 %,
  the same ease shape, slow drifts within ±1 px/f.
- `sbs.mp4` and `sheet.png` contain the reference's frames: private review only, never a deliverable.

## 6 · The temp track (private review only)

```bash
python3 $V/recreate/temptrack.py --film DIR/<slug>-16x9.mp4 --ref ref.mp4 --out DIR/out/<slug>
```

Our picture with the reference's own audio stream-copied under it, so the user can judge the cut against the music it
was timed to. The name always ends `-tempmusic-PRIVATE.mp4` and its title/comment say so. Refused when the two films
differ by more than a frame; then verified: decoded audio bit-identical to the reference's, video packets ours, the
same audio priming. Only for the user's own review of their own copy of the reference — never a deliverable, never
posted, never sent to anyone else. A licensed track the user owns can be synced in as `music: {style: track}` instead.

## 7 · Deliver

- The master is our film with our score (`<slug>-16x9.mp4`, QA PASSED). Never ship the temp track or a side-by-side.
- List what is still a stand-in (mascots, marks, screens awaiting the official kit) and every product claim the client
  must confirm.
- **The user listens.** The score is checked by meters and the tracker only: say so, and ask them to listen.

## Worked example: hf02-full (2026-10-22)

`~/Downloads/launch-videos/hf02-full/` — the 63.6 s Higgsfield film 02 (1080×608, 30 fps, 1,909 frames) rebuilt as a
Manus Cue film (1920×1080): a new story ("Plan Saturday dinner for six"), our crew as stand-ins for the official
mascots, the official Cue icon, plate 1 real AI footage.
- Cuts (`compare.py --cuts-from` the 22-cut list): **19 exact, 2 within 1 f** (n359 dissolve −1, n845 whip +1), n75 read
  +4 f — the corridor's moving lines win the peak; the curves line up at 0 f and the frames show the cut on n76 in
  both. The skill's breakdown found 19 cuts (16 exact, 3 within 1 f); the built-in detector 25 (20 exact, 4 within
  1 f, the same n75). `sbs.mp4` verify: 1,909/1,909 frames exact.
- Camera, n300–311 (the window pan into the n312 momentum cut): theirs 13.87 px/f at n311, building ×1.35 a frame; ours
  14.07 px/f at n311, ×1.36. After the cut theirs decays ×0.71 a frame.
- Score (its own `audio.mjs`, the basis of `style: film`): tracker 87.45 BPM vs their 87.46, first beat 0.3912 vs
  0.3905 s, confidence 0.75 vs 0.94; onsets +5 ms behind theirs; the silence before the hit and the hit itself at
  59.939 s in both; key F major in both. Groove on their grid: body r 0.65, hats r 0.55; ours is darker (centroid 3113
  vs 3367 Hz) and heavier below 120 Hz (+2 dB).
- Temp track: `out/film-tempmusic-PRIVATE.mp4`, decoded audio md5 486aab4c… = the reference's, video packets
  80d435ae… = film.mp4's, the same 2,112-sample priming.
