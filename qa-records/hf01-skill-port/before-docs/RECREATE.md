# Recreate a reference film frame for frame (our content, their motion)

Use this when the user says "make ours move exactly like this film": a saved reference (a Higgsfield launch film, a
competitor's reel) rebuilt so every cut, camera move, ease, blur and event lands on the reference's frame, with our own
story on screen and our own score on the reference's beat grid. It ends with proof: a frame-locked side-by-side, a cut
report, the camera curves and a beat check. The worked example is `~/Downloads/launch-videos/hf02-full/` (numbers at the
end). `$V` = `~/.claude/skills/product-launch-sting/video`. Requirements: `/usr/bin/python3` with numpy and Pillow (missing:
`pip3 install numpy pillow`), ffmpeg/ffprobe, node.

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
  the quiet stretches and the biggest hit of each track). For `style: film` take only the bpm and the first beat from
  `--tempo`: never use the `music: {style: track, file: …}` line it suggests —
  the reference's audio never goes into the job (the private temp track, section 6, is the only place it plays).

## 2 · Build ours

- **Shot lengths in frames, from the reference.** A cut at reference frame `n` is at `n/fps` s, `fps` being the
  reference's own rate: `ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 ref.mp4`
  prints it (`30/1`; `30000/1001` is 29.97, `24/1`, `60/1`), and the breakdown records it (`probe.fps` in
  `breakdown.json`). Most references are 30, the example here: give each shot `sec: <frames>/30` with 4 decimals
  (`sec: 0.7333` for 22 frames; at 24 fps `<frames>/24`, at 60 `<frames>/60`) and check every boundary in `--grid` —
  by its time column; its start column counts the engine's 30-fps frames, so it equals `n` only for a 30 fps
  reference. `beats:` only where the reference cut lands on its beat — the breakdown's `beats-draft.yaml` already does
  this.
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
music: {style: film, bpm: 87.46, downbeat: 0.3905, drop: s2, breaks: [s14, s19], key: F, hit: 0.372}
```

- `style: film` is the hf02 score as a style: an original groove (16th shaker with accents, stabs on 1 and 3 with a
  light pickup on the and of 4, kick + soft clap, syncopated bass, a 16th arpeggio and a motif over rootless 9th chords
  I · vi · IV · Vsus2 in `key`). Every event sits on the grid `downbeat + k·beat`, the intro too, so the score's first
  beat is the reference's. Intro: pad swell, arpeggio, a shaker pickup and a riser into the `drop` shot (default the
  2nd); each `breaks:` shot dips to pad + shaker with a short riser back in (touching breaks are one dip); a lift
  over the last two bars before the hit, the music silent for 0.44 s, then the hit on the `endcard` shot (`hit` s
  into it) ringing out. No end card: the last bar rings out. Default 87 BPM in F; `level:` moves the music against the
  SFX. `music:` scores beats.yaml jobs; a hand-built stage (section 2) keeps its own score script — start from
  hf02-full's `audio.mjs`, the same groove.
- **bpm / downbeat** from the reference's tracker reading (`lv.mjs --tempo ref.mp4`, only its bpm and first beat —
  never its `music: {style: track …}` line): `downbeat` = its first beat (when the bar accent is clear, its first
  downbeat). **drop / breaks** from its energy map: the shot where its groove
  comes in, the shots where it dips. Lay the shots on the same frames as the reference first (section 2), then the dips
  fall where theirs do. A cut up to 35 ms off a grid line counts as on it (frame-cut `sec:` shots land up to ±17 ms off).
- **hit**: when the hit lands, in seconds after the end card's first frame (default 0 = on the cut; −1…2). A reference
  often cuts to its end card in silence and hits later. Measure it: `music.py compare ref.mp4 ours.mp4` prints the
  reference's biggest hit (hf02: 59.939 s); the breakdown gives the end card's first frame (hf02: n1787 = 59.567 s); the
  difference is `hit` (0.372). The silence is the 0.44 s before the hit and the lift counts back from it; the end card's
  own sounds before a later hit stay out of the mix (its stems keep them). Only the music goes silent: a moving
  transition into the end card (zoom, whip, blur) keeps its whoosh tail in the first ~0.2 s of the gap, while a `cut`
  into it leaves true silence. No end card: `hit` does nothing.
- **The end card must be the film's LAST shot** (`block: endcard`): the timeline takes the end card from the last shot
  only, so a `hit` with any other shot last does nothing (`--grid` warns).
- `hit` past the end card is clamped to 0.1 s before the film's end, without a word — keep it inside the card.
- `hit` is for `style: film` only; the other styles ignore it (as they always have).
- The stems are in `DIR/out/<cut>/audio/{music,points,whoosh,raw}.wav` (`<cut>` = `main` or a cutdown's name).
- A `--clips` export of the end card keeps its own landing sound, which the film mutes when `hit > 0`: mute it in an edit
  that lays the film's music under the clip, or the hit sounds twice.
- **Tempo octaves**: a film at 60 BPM reads 120 on the tracker, one at 180 reads 90 (its prior sits at 120): keep
  between ~70 and ~160, or expect compare's half/double-time note.
- Check it: `python3 $V/recreate/music.py compare ref.mp4 ours.mp4` → both tracker readings, the onset lag of ours,
  quiet stretches, the biggest hit, both profiles on the reference's grid, and `verdict: ON THEIR BEAT` (exit 0) or
  `OFF THEIR BEAT — <why>` (exit 1): tempo within 0.15 BPM, beat phase and onsets within 35 ms, the hits within 35 ms,
  our tracker confidence ≥ 0.6.
- Traps (both hit on hf02): **flattening the 16ths killed the pulse** (tracker confidence 0.16) — keep the accents on
  the beats; **off-beat stabs flipped the tracked phase half a beat** — accent 1 and 3, keep pickups light. Match the
  reference's feel (density per 16th, band balance, brightness), never its notes.

## 5 · Proofs

```bash
python3 $V/footage/conform.py DIR/<slug>-16x9.mp4 DIR/proof/ours30.mp4 --frames <ref frames> --fps <ref fps>   # 60 fps master → the reference's rate (30 here)
python3 $V/recreate/compare.py --ref ref.mp4 --ours DIR/<slug>-16x9.mp4 --out DIR/proof --cuts-from DIR/proof/cuts.txt
python3 $V/recreate/compare.py ... --out DIR/proof-slow --from 10 --to 17 --half          # a stretch at half speed
python3 $V/recreate/track.py DIR/proof/ours30.mp4 --key 300 --from 300 --to 311 --half --scale-to 1080x608 --out curves/ours-pan-312.json
```

`lv.mjs --film` masters are 60 fps; the reference is usually 30 (read its rate as in section 2). `compare.py` reads an
exact multiple directly (at 30, ours' frame 2i against the reference's frame i, the same frames `conform.py --fps 30`
keeps; a 60 fps reference pairs 1:1); any other rate (a 24 or 25 fps reference) it refuses with the conform command to
run, `--fps` set to the reference's rate. Rates within 1 % (29.97 vs 30) are paired frame for frame, by index, with a
note on how far their clocks drift. `track.py` numbers frames in its file's own rate, so track the conform at the
reference's rate (no audio: compare it with `--audio ref` or `none`). HDR files (HLG / PQ, as phones record) are
measured after the film engine's own conversion to SDR.

- `sbs.mp4`: frame i = reference i | ours i, decoded **by index** (never ffmpeg hstack: it re-times irregular
  timestamps and slipped 1,411 of 1,909 frames on hf02), then decoded back and checked: `verify: N/N frames exact` or
  exit 1 with the frames that slipped. Same frame rate, or ours an exact multiple of it.
- `cuts.md` / `cuts.json`: per reference cut, our biggest picture change within ±4 frames and its offset; the status is
  one of `exact`, `±1`, `off`, `missing`. Each listed cut is first moved to the reference's own change peak near it, so
  a list one frame early reads `n359 (listed n357)`. Two flags (true/false) ride on a cut, next to its status:
  `trivial` = a neighbouring shot of ours is blank (a cut next to an unbuilt shot matches for free; don't count it);
  `check` = the offset says off but the two change curves line up: motion next to the cut won the peak (hf02's n75 is
  `off` with `check: true`: the corridor read +4 f, its frames match). Look at `cuts/cut-nNNNN.png` before telling
  anyone a cut is off.
  `--cuts-from` takes the breakdown's `breakdown.json`, an earlier `cuts.json` or your own list; without it the cuts are
  detected (a fallback: element whips can read as cuts, a momentum cut between near-identical screens can be missed).
- `sheet.png`: every reference shot's middle frame over ours — read it: the motion should read the same at a glance and
  the picture should be clearly a different film.
- Camera: track ours with the same tool and settings; per move the peak frame within ±0.5 f, peak speed within ±10 %,
  the same ease shape, slow drifts within ±1 px/f.
- `sbs.mp4` and `sheet.png` contain the reference's frames: private review only, never a deliverable. Each says so
  inside the file too (the mp4's title/comment, the PNG's text), whatever it gets renamed to.

## 6 · The temp track (private review only)

```bash
python3 $V/recreate/temptrack.py --film DIR/<slug>-16x9.mp4 --ref ref.mp4 --out DIR/out/<slug>
```

Our picture with the reference's own audio stream-copied under it, so the user can judge the cut against the music it
was timed to. The name always ends `-tempmusic-PRIVATE.mp4` and its title/comment say so. Refused when the two films
differ by more than a frame; then verified: decoded audio bit-identical to the reference's, video packets ours, the
same audio priming. Only for the user's own review of their own copy of the reference — never a deliverable, never
posted, never sent to anyone else. A licensed track the user owns can be synced in as `music: {style: track}` instead.
The reference must be an MP4 or MOV with AAC audio, the kind of file the temp track is, or the bit-for-bit check can't
hold; anything else is refused with the command to run first: `ffmpeg -i ref.mkv -c copy ref.mp4` for AAC in MKV or WebM,
`ffmpeg -i ref.webm -c:v copy -c:a aac -b:a 256k ref.mp4` for Opus or other audio. An MKV or WebM made from an MP4 with
`-c copy` may already have lost the AAC priming (≈2,112 samples = 48 ms): the temp track then sits up to ~48 ms late and
still passes, being compared with that copy — use the original MP4 when there is one.

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
  14.07 px/f at n311, ×1.36. After the cut theirs decays ×0.71 a frame
  (`track.py ref.mp4 --key 325 --from 325 --to 312 --half`; ncc < 0.9 on n312–n321, where the blur takes the picture
  past the model, so read it as an estimate).
- Score (its own `audio.mjs`, the basis of `style: film`): tracker 87.45 BPM vs their 87.46, first beat 0.3912 vs
  0.3905 s, confidence 0.75 vs 0.94; onsets +5 ms behind theirs; the silence before the hit and the hit itself at
  59.939 s in both; key F major in both. Groove on their grid: body r 0.65, hats r 0.55, but **kick r −0.21** — our
  kick pattern runs against theirs (accents on 1 and 3 where theirs spreads over the bar); ours is darker (centroid
  3113 vs 3367 Hz) and heavier below 120 Hz (+2 dB). The end card's hit lands 0.372 s after its cut in both
  (`hit: 0.372` in a beats.yaml rebuild).
- Temp track: `out/film-tempmusic-PRIVATE.mp4`, decoded audio md5 486aab4c… = the reference's, video packets
  80d435ae… = film.mp4's, the same 2,112-sample priming.
