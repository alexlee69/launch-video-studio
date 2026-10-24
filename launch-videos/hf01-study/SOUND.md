# SOUND.md: higgsfield01 soundtrack (agent D)

This is a study of the reference's score, sound design, voice and mix, so that we can compose our own soundtrack on the
same grid and energy map. **None of their audio goes into our film.**

- **Data:** in `sound/`. The curated files are `tempo_map.json`, `sections.json`, `sfx.json`, `voice.json`, `mix.json`
  and `sync.json`. The raw measurements are listed at the end.
- **Images:** the evidence images are in `sound/img/`.
- **Times and frames:** times are seconds from the file start. Frames are 0-based, with n = round(30·t).
- **Grid:** "beat k" means 0.1107 + 0.68958·k s. Bar b starts on beat 4b.
- **Cut frames:** they come from agent A's `cuts/cuts.txt` (26 cuts). The breakdown's 28 shots differ at n66, n1009,
  n364 and n1531/1532.
- **"est":** marks a judgement rather than a measurement.

## 0. The short answer

- **The first 51 s are not one thing.**
  - **0–22.18 s is genuinely unpulsed.** It is a dark E drone (E1/E2 with a B fifth) under nature ambience (waterfall,
    then birds) and the dialogue.
  - **22.18 s onward is a beat on the same 87.01 grid as the end.** The groove enters exactly on bar 8's downbeat
    (beat 32). The tracker missed it because 22–51 s is a sparse, syncopated, half-time 808 ostinato with gated and
    stuttered 16ths. Its 16th lock is only 0.2–0.4, but it has the same phase as the drop (−6…−20 ms).
  - So the tempo map is: none until 22.18 s, then 87.01 BPM to 69.07 s, then an outro, silence and a sting.
- **The score does nearly all the work.**
  - Glitch, zoom-blur, whip and card transitions have **no dedicated whooshes**.
  - The UI is **silent**: no typing clicks, no card pops.
  - The dedicated SFX are few: title static bursts, nature beds, a message tick, the pixel-fire burst, pixel-out
    crackles, the tumble, the arrow whoosh and thunk, mascot chirps and the end sting.
- **There is dialogue.**
  - One male voice speaks the "floating words": "What is it this time? Objects? Shapes? VFX? Expression? Wait. No.
    Let me explain."
  - It runs 13.37–19.95 s. The pitch rises on each question word.
  - Probably also a shout, "The easy route!", at 39.66–40.75 s.
- **The ending is the hf02 house move.**
  - The music drops out on bar 25 (69.07 s).
  - Digital silence starts at 72.35 s.
  - The end card cuts at n2175 (72.500 s, on the grid) inside the silence.
  - The sting hits **0.368 s later** (n2186, 72.868 s). hf02's was 0.372 s.

## 1. Tempo, grid, key and harmony

### 1.1 Tools run

**`node $V/lv.mjs --tempo ~/Downloads/higgsfield01.mp4`** (`sound/tempo.txt`):
- 87.01 BPM, confidence 0.903, first beat 0.1107 s, bar confidence 0.027.
- Pulse by section: 0–25.5 s none, 25.5–51.0 s none, 51.0–76.5 s 86.99.
- Alternates: 43.5 (half, acf 0.404) and 174 (double, acf 0.308).

**`python3 -B $V/recreate/music.py profile`** (`sound/profile.txt`, analysed 4–69 s):
- Key: F major, r 0.87; runner-up D minor, r 0.58.
- Band balance: sub −1.9, low-mid −7.3, mid −9.5, upper-mid −13.7, air −20.2 dB.
- Centroid 2304 Hz.
- The groove over 4–69 s is flat (86–100 % on every 16th), because two thirds of that span has no 16th pattern.

### 1.2 Tempo map

| From → to (s) | Frames | Tempo | What | Evidence |
|---|---|---|---|---|
| 0.000 → 22.181 | n0–n665 | **none** | Rubato drone and ambience; no kick or hat pattern | Per-bar 16th lock of the hats 0.02–0.25 (`bars.json`). The no-pulse baseline (95th percentile) is 0.15–0.28. The bass is an E pedal (§1.4). |
| 18.5 → 22.18 | n555–n665 | ~86–87 BPM, loose | A pulsing pad in 300–2 kHz (modulation peak 1.43 Hz) | Not a beat. Its phase sits +45…+63 ms off the later grid (`tempo.json`, 19–22 s windows) |
| **22.181 → 69.069** | **n665–n2072** | **87.01** | Groove from **beat 32 (bar 8 downbeat)** to **beat 100 (bar 25 downbeat)** | See the list below |
| 69.069 → 72.35 | n2072–n2170 | none | Outro: the groove stops; a sub tail; fade to digital zero | `energy.json` |
| 72.35 → 72.868 | n2170–n2186 | – | Digital silence, 0.518 s | Sample scan |
| 72.868 | n2186.05 | – | Sting onset, on the 8th grid (beat 105.5 + 7 ms) | – |
| 74.52 → 76.533 | n2236–n2295 | – | Digital silence | – |

The evidence for the 87.01 groove (22.181–69.069 s):
- `gridfit.py` fits 86.97 BPM at 25–51 s and 86.91 at 51–72 s, both 16th-subdivided.
- The hats' 16th phase is −10…−17 ms from 54 to 70 s, at a lock of 0.4–0.78.
- Low booms land on the downbeats of bars 10, 12, 14, 16 and 18 (+28…+101 ms; a 30–120 Hz onset reads late).

**Grid**

| Quantity | Value | Frames |
|---|---|---|
| Beat | 0.68958 s | 20.69 |
| Bar (4/4) | 2.7583 s | 82.75 |
| Bar 8 | 22.177 s | n665.3 |
| Bar 17 | 47.004 s | n1410.1 |
| Bar 18 | 49.760 s | n1492.8 |
| Bar 20 | 55.277 s | n1658.3 |
| Bar 22 | 60.793 s | n1823.8 |
| Bar 23 | 63.552 s | n1906.6 |
| Bar 25 | 69.069 s | n2072.1 |
| Beat 105 | 72.516 s | – |

- **Octave.** The quarter note is 87.01 BPM. The drop *feels* half-time (43.5 BPM), because its strongest backbeat is on
  beat 3. The 174 reading comes from the busy 16th hats. For our score: write at 87.01 and keep the half-time feel.

### 1.3 Per-band onset analysis (adapted from hf02's `music_profile.py` and `beat_check.py`)

**Groove on the grid, 52–72 s.** Median positive flux per 16th of a 4-beat bar (`tools/fold.py`; `|` marks a beat):

```
sub 20-60      | 7  4  4 32 | 5  5 25  8 | 7  6  6 24 |29  8 16  5   808 notes on 16ths 3, 6, 11, (12), 14
1-4 kHz        |10  9  7 19 |26  9 14 12 |34  7  7 16 | 9  7  8  7   snare/clap energy on beats 2 and 3 (strongest on 3)
hats 5-14 kHz  |11 23  5 14 |32 20  9 12 | 9  3 10 10 | 8  8  6 16   busy 16ths, uneven accents
```

- **Build, 36.8–51 s** (onset counts in `onsets.json`):
  - Kick-band hits on 16ths 0, 3 and 11.
  - A big low boom on beat 1 every 2 bars: 22.18 (weak), 27.72, 33.27, 38.83, 44.28 and 49.81 s.
- **Cuts vs grid:** see §6.

### 1.4 Key and harmony (est)

All of this is from bass notes per beat (`tools/notes.py` and the per-beat FFT) and whitened chroma.

| Span | Bass | Upper | Reading |
|---|---|---|---|
| 0–2.3 | E/F#/D# moving | B3 B4 E4 F#4 | Esus/B colour, unpulsed |
| 2.3–22.18 | **E pedal**: E1 41 Hz, E2 82 Hz, B1 62 Hz | B, E, A, A#, G, C fragments | Dark E drone with b2/b5 colour (phrygian-ish) |
| 22.18–55.28 | **F with chromatic neighbours**: per 2 bars, F F F# F# \| F# E F# E | Sparse; gated chord "combs" | Tension ostinato a semitone *above* the intro's E |
| 55.28–69.07 | **F (2 beats) – Ab (2) – Bb (4)**, repeating every 2 bars | G, Bb, F, C, A, Ab | **i–bIII–IV in F minor.** The key profile reads "F major" (r 0.87), because F/C/A dominate the chroma. Treat it as F-centred minor with mixture. |
| 60.79–63.55 | F – D# – A | Bouncy pitch-drop lead | Variation (cave) |
| Sting 72.87 | **G** | E, G, C | **C/G**: the dominant of F, a bright open ending |

### 1.5 Instrumentation by section (est, from spectrogram reading)

- **Title:** sustained synth pad/bell tones, sub thumps and digital static bursts.
- **2.3–22.18:** sub drone (sine-like E1/E2), dark pad, sparse synth swells; waterfall wash; birds; voice; a pulsing pad
  from ~18.5 s.
- **22.18–47:**
  - an 808/sub ostinato;
  - big low booms every 2 bars;
  - gated and stuttered 16th hats and clicks;
  - pitch-drop tom-like hits;
  - on the white cards, gated synth plucks (dotted horizontal "combs" in the spectrogram).
- **47–49.8:** break: the low end is out; hats and clicks keep going.
- **55.3–69.1:**
  - full drums;
  - a syncopated 808 with a pitch-drop attack (visible as falling curves at 100–150 Hz);
  - snare/clap and 16th hats;
  - synth chords;
  - 60.8–63.6: a thinner kit plus a bouncy pitch-drop lead;
  - 64.95–66.1: a stutter fill.
- **Outro:** the sub tail plus the mascot chirps.
- **Sting:** a low boom plus a C/G chord, ringing for ~1.6 s.

## 2. Energy map and section map

Loudness is EBU (ffmpeg `ebur128`) on the float AAC decode, per 100 ms (`energy.json`). There is also a per-bar table
(`bars.json`) with the band levels, the 16th lock and the kick on each beat.

| Id | Section | Time (s) | Frames | Bars / beats | What plays | Energy |
|---|---|---|---|---|---|---|
| S0 | Title lockup | 0.000–2.300 | n0–n68 | unpulsed | Pad; static bursts 0.22–0.33 and 0.44–0.60; sub 0.24 and 1.00–1.18; air whoosh 1.74→2.19 into the zoom-through (n56–68) | M −16.6…−14.2 LUFS; widest (corr 0.62) |
| S1 | Descent + waterfall | 2.300–8.27 | n69–n247 | unpulsed | E drone + waterfall wash | S −15.5…−16.4. Drone swell 6.0–7.0 (M −13.5), then the **quietest body stretch 7.1–8.4 (M −18.9…−19.9)** before the phone |
| S2 | Message, clearing, dialogue | 8.27–22.181 | n248–n665 | unpulsed (loose pulse from 18.5) | E pedal + sparse tones; tick 8.30; birds 11.2–13; **voice 13.37–19.95**; pixel fire 17.06; pixel-out crackle 21.37–22.03 | M −12.1…−15.1, S −13.4…−14.7 |
| S3a | Groove A: AE montage | 22.181–36.767 | n665–n1102 | bar 8 → beat 53.2 | F ostinato, booms every 2 bars, gated/stuttered 16ths; white cards thin to a gated comb | S −13.0…−14.5; the mids sit 4–5 dB lower on card bars |
| S3b | Groove A: bridge + map | 36.767–46.75 | n1103–n1401 | → beat 67.6 | Same, plus a rapids bed from the bridge cut | S −12.8…−14.9 |
| S4 | **Break** | 46.75–49.76 | n1402–n1492 | bar 16.7 → 18 | **Low end out** 117 ms after card-out n1399 (fully out 48.17–48.88); 808 hits at 47.53 and 48.02; return 48.90 (n1467) | M down to −20.8 (48.7) |
| S5 | Tumble, arrow, transition | 49.76–55.277 | n1493–n1658 | bars 18–19 | Groove back; tumble 49.35; arrow 50.37–51.14; mini-break 52.49–53.43; music re-enters 53.43; 808 pickup 54.83–55.0 | M −11.5…−14.4 |
| S6 | **Drop 1** (poster) | 55.277–60.793 | n1658–n1823 | bars 20–21 | Fm–Ab–Bb, full 16ths, 808 syncopation | S −13.0…−13.4; lock 0.4–0.58 |
| S7 | Cave lead | 60.793–63.552 | n1824–n1906 | bar 22 | Drums thinned (lock 0.07), pitch-drop lead | **M −11.3 (61.5): the loudest body moment** |
| S8 | **Drop 2** | 63.552–69.069 | n1907–n2071 | bars 23–24 | Drums back on the download card; stutter fill 64.95–66.10 | M −11.9…−16.4 |
| S9 | Outro | 69.069–72.35 | n2072–n2169 | bar 25 | Groove stops; sub tail; mascot chirps 70.62–72.15 | M −14.4 → −27 by 70.1 |
| S10 | Silence | 72.35–72.868 | n2170–n2185 | – | Digital zero; **end card n2175 inside it** | – |
| S11 | Sting | 72.868–74.52 | n2186–n2235 | – | Boom + C/G chord | **M −6.2, +0.2 dBFS**, ~6 LU over the body |
| S12 | Tail | 74.52–76.533 | n2236–n2295 | – | Digital zero | – |

### 2.1 Rises, drops and silences

**Rises:**
- 21.37–22.03: pixel-out crackle into the groove entry. There is no long riser.
- 49.35–50.0: the tumble whoosh into bar 18.
- 50.37–51.0: the arrow whoosh.
- 54.68–55.0: crackle plus the 808 pickup into the drop.

**Drops:**
- 46.75: the break.
- 52.49: a mini-break.
- 64.95: the stutter fill.
- 69.07: the outro.
- 72.35: silence.

**Silences:**
- Digital silence only at 72.35–72.868 and 74.52–76.53.
- Brief 15–70 ms stutter mutes at 33.24–33.27, 35.74–36.30, 47.85–48.99, 52.49–53.27 and 65.47–66.11. These are
  musical gating, not edits.

### 2.2 Biggest hits (50 ms RMS)

| Rank | Time | Frame | 50 ms RMS | What |
|---|---|---|---|---|
| 1 | 72.90 s | n2187 | −3.2 dBFS | The sting |
| 2 | 31.52 | n946 | −9.9 | 808 note |
| 3 | 59.13 | n1774 | −10.0 | 808 note |
| 4 | 42.04 | n1261 | −10.0 | 808 note |
| 5 | 42.55 | n1277 | −10.1 | 808 note |
| 6 | 53.25 | n1598 | −10.1 | Music re-entry after the mini-break |
| 7 | 31.00 | n930 | −10.2 | 808 note |
| 8 | 66.01 | n1980 | −10.2 | 808 note |
| 9 | 48.94 | n1468 | −10.4 | 808 return from the break |

The 808s mostly fall on the "a" or "&" of a beat (beat positions .55–.81), never on a cut.

## 3. SFX inventory

All of these are measured in their own band in 5 ms blocks (`tools/sfxmeasure.py`, `tools/evt.py`), then checked on
spectrogram zooms with frames under them (`img/col1-3.png`, `img/evgrid-1..4.png`, `img/ev/`, `img/av/`). Level is dB
over the local bed in that band.

| Id | Onset s (frame) | Peak s (frame) | Type | Level | Syncs to |
|---|---|---|---|---|---|
| U1 | 0.224 (n6.7) | 0.269 (n8.1) | Digital static burst (1–16 kHz, ~0.1 s) + sub thump 0.244–0.30 | +22 dB in 8–16 kHz | Title lockup ("Higgsfield MCP" n0, "× Claude" n2) |
| U2 | 0.439 (n13.2) | 0.524 (n15.7) | Static burst #2 (4–16 kHz, 0.14 s) | +24 dB | "OPUS 5.5" dot-matrix flash-in, n16 (peaks 0.5 f before) |
| U3 | 1.003 (n30.1) | 1.182 (n35.5) | Soft noise swish + 90 Hz sub hit | Sub +19.7 dB, −16 dBFS band | Pill wipe n28–32; playback bar n36 (0.5 f before) |
| U4 | 1.741 (n52.2) | 2.190 (n65.7) | Soft air whoosh 2–12 kHz | +9.3 dB | Title zoom-through n56–68 |
| A1 | 2.30 (n69) | bed | Waterfall roar, broadband | 2–12 kHz −24 dBFS RMS, level with the drone | Waterfall plate n69–n347 |
| F1 | 8.299 (n249.0) | 8.304 | Notification tick 4–16 kHz + low thump 8.279 | +16.7 dB | Phone out n248; **3 f before** the bubble rises (n252) |
| A2 | ~11.2 | 12.03–12.40 (n361–372) | Jungle birds: whistled arcs 1.2→2→1.2 kHz (est) | +6…+10 dB | Pack drop and unzip shots n348–n400 |
| F2 | 11.489 (n344.7) | 11.564 (n346.9) | Pack-drop swish 4–16 kHz + low 11.46–11.51 | +16 dB | **Pre-lap**: peaks 36 ms before cut n348 |
| F3 | 17.060 (n511.8) | 17.144 (n514.3) | Pixel-fire "whoomp" + crackle (~0.3 s) | +13 dB (1–4 kHz peak 17.33) | Fire sprite 502–524, relight peak n512 |
| U5 | 21.486 (n644.6) | 21.536 (n646.1) | Pixel-out digital crackle + noise wash to 22.03 | +10 dB, centroid 4.5 kHz | Send glow 648–652, pixel-out 654–660 → card-cut n661 |
| A3 | 36.756 (n1102.7) | 37.121 | Rapids/river wash | +8 dB in 2–12 kHz | Bridge cut n1103 (on the cut) |
| U6 | 39.510 (n1185.3) | 39.515 | Pixel-out crackle | +8.3 dB | Pixel-out 1184–1192 on the crash-zoom |
| F4 | ~41.13 (n1234) | 41.49 | Boots on planks? Dense 1–8 kHz transients (est, low confidence) | +3.9 dB; not separable from the hats | Boots CU n1234–n1256 |
| F5 | 49.350 (n1480.5) | 49.754 (n1492.6) | Tumble: broad whoosh/scrape 1–16 kHz, ~0.65 s | +14.5 dB low, +10.6 mid | **Starts 0.22 s (6.5 f) before** cut n1487 |
| F6 | 50.370 (n1511.1) | 50.923 (n1527.7) | Arrow flight whoosh, rising, 8–16 kHz | +16.2 dB | Starts 0.40 s before cut n1523; peaks 0.11 s before n1531 |
| F7 | 51.005 (n1530.1) | 51.065 (n1531.9) | Arrow thunk (broadband transient) + falling "twang" 1 kHz→300 Hz at 51.139 (n1534.2) | +20 dB in 8–16 kHz | **28 ms (0.9 f) before** the whip-cut frame n1531 |
| F8 | 51.059 (n1531.8) | 51.089 | Sub boom under the impact | +7.9 dB, 0.8 s | The impact |
| U8 | 53.425 (n1602.7) | 53.469 | Noise swell + falling blip 1.5 kHz→600 Hz (est: may be the score re-entering) | +14.5 dB | Prompt bar in, 1606–1608 (~4 f before) |
| U7 | 54.676 (n1640.3) | 54.925 (n1647.8) | Pixel-out crackle | +10.1 dB | Pixel-out 1644–1650 → poster cut n1651 |
| V1 | 70.615 (n2118.4) | 71.757 (n2152.7) | Four voiced chirps (f0 130–300 Hz; formants ~0.5/1.5/2.5 kHz): 70.72–70.90, 70.98–71.15, 71.66–71.80, 71.88–72.15 | −17.7 dBFS band; mix peak −8.1 | Pixel cat on the branch sinking out of frame (n2118–2166); uncaptioned |
| E1 | **72.868 (n2186.05)** | **72.951 (n2188.5)** | **End sting**: low boom + C/G chord, rings 1.6 s | **+0.2 dBFS**, M −6.2 LUFS | End-card cut n2175 **+0.368 s**; on the 8th grid |

**Counts:**
- ambience: 3;
- action foley: 8, one of them low-confidence;
- title, UI and transition sounds: 8;
- mascot: 1;
- sting: 1.

**Things that are not in the film:**
- **Transition whooshes on cuts 2–27: none.** I tested the 2–12 kHz rise in the 0.15 s before each cut against the
  0.6–0.3 s before it. On the glitch, zoom-blur, whip and card cuts it is −3…+3 dB. The same test reads +10 dB on the
  arrow cut, so it can find a whoosh where there is one (`evcheck.json`, `img/evgrid-*.png`).
- **UI sounds: none.** The 3–12 kHz onset rate during each typing pass stays within the range of the second before and
  after: 0.0 vs 0.0/2.0 per second for prompt 2, and 2.0 vs 3.0/8.0 for prompt 4 (`typing_test.json`,
  `tools/typing_test.py`). There are no card pops and no cursor clicks.
- **The card cuts carry the score's 808 notes, not SFX.** They land 65–150 ms after the cut: n928 +72, n1257 +149,
  n1294 +124, n1399 +66 ms; n1362 is −83 ms.

## 4. Voice

There is a voice: **character dialogue** from one male voice (f0 115–235 Hz). It is spoken as the floating words of
shot 4. It is not a narrator. We write our own lines.

| Line on screen | Voice (s) | Frames | Caption frames (agent B) | Evidence |
|---|---|---|---|---|
| "What is it this time?" | 13.37–14.70 | n401–n441 | 414–442 | f0 141–230 Hz, "time?" 134–146 |
| "Objects?" | 14.75–15.00 | n443–n450 | 442–466 | **Rises 175 → 224 Hz** |
| "Shapes?" | 15.43–15.63 | n463–n469 | 474–496 | 133 → 185 Hz |
| "VFX?" | 16.37–16.72 | n491–n502 | 500–516 | **Rises 185 → 234 Hz** |
| "Expression?" | 17.50–17.83 | n525–n535 | 530–548 | **Rises 190 → 226 Hz** |
| "Wait" | 18.13–18.39 | n544–n552 | 550–576 | 127–139 Hz |
| "No" | 18.57–18.72 | n557–n562 | 556–580 | 116–118 Hz |
| "Let me explain" | 18.92–19.95 | n568–n599 | 562–586 | 130–141, falls to 118 Hz |
| "The easy route!" (shout, medium-low confidence) | 39.66–40.75 | n1190–n1223 | 1190–1218 | f0 186–202 Hz; shouting MCU 1200–1233 |
| Uncaptioned chirps (identity uncertain) | 70.62–72.15 | n2119–n2165 | – | See V1 above |

- **What the voice does.** It plays the character guessing what the mascot wants. The floating words follow the voice
  within about ±0.3 s.
- **Level.** The voice sits +5.7 dB over the bed in 300–3400 Hz. Loudness is unchanged (S −13.9…−14.6).
- **No ducking.** The score's low band is only −0.9 dB under the lines. The score leaves room by staying an unpulsed
  drone until 22.18 s, after the last line.
- **Not voiced:**
  - the typed prompt texts, the white cards and the client messages;
  - the on-camera mouth movement at 10.7–11.5 s (no speech contours);
  - 23.5–25.4 s, where the man speaks to camera in the badge footage: weak flat contours only, so possible but
    unconfirmed.

How the voice was found:
- f0 contours on the REPET residual (`tools/f0glide.py`). The dialogue window has 3 rising glides at the question
  words. The music-only controls have 0.
- Syllable bursts in the voice band line up with the caption frames (`tools/resid_zoom.py`, `img/rz_a.png`,
  `img/vz_cap.png`).

## 5. Mix

| Measure | Value |
|---|---|
| Integrated | **−14.0 LUFS** |
| LRA | **3.5 LU** |
| True peak / sample peak | **+0.2 dBTP / +0.2 dBFS** (at the sting, 72.95 s) |
| Body ceiling | Per-second sample peaks max −4.2, median −5.9 dBFS over 0–72 s. The body is limited about 6 dB under the sting. |
| Short-term, body | −12.4 … −16.6 LUFS |
| Momentary | Body max −11.3 (61.5 s); body min −20.8 (48.7 s); sting −6.2 |
| Band balance (4–69 s) | Sub −1.9, low-mid −7.3, mid −9.5, upper-mid −13.7, air −20.2 dB re total; centroid 2304 Hz. Bass-heavy and dark. |
| Stereo | L/R correlation 0.88 overall; side/mid −11.8 dB. Below 150 Hz the side is −26…−40 dB in the groove (mono lows); above 2 kHz it is −2.5…−7.8 (wide highs). By section: title 0.62, waterfall 0.69, dialogue 0.78, groove 0.89–0.91, break 0.78, drops 0.94, outro 0.97. L/R balance 0.0 dB. |
| Music vs SFX (est) | The music carries about 90 % of the running time and nearly all the loudness. Ambience leads only at 2.3–13 s, where the waterfall is level with the drone. Action SFX sit +10…+16 dB over the bed in their own band. |
| Ducking | None found: −0.9 dB under the voice; the music holds M −12.2…−12.5 at the arrow. All the dynamics are arrangement: the break 46.75–49.76, the outro −8…−13 LU from 69.07, and the 0.52 s silence before the sting. |

## 6. Sync rules the editor used

1. **Cuts are not on the beat.**
   - Of the 21 cuts inside the groove, 0 land within 35 ms of a beat (chance would give 10 %). The median distance is
     193 ms.
   - On the 16th grid, 6 of 21 land within 35 ms, against 41 % by chance: that is random.
   - The picture cuts on action and story (`sync.json`).
2. **The picture leads, and the music's section changes land 50–250 ms after the cut that motivates them.**

   | Cut / event | Time | Music change | Delay |
   |---|---|---|---|
   | Card-cut n661 | 22.033 | Groove entry, bar 8 | **+144 ms** |
   | Card-out n1399 | 46.633 | Low end out | **+117 ms** |
   | Tumble cut n1487 | 49.567 | Bar 18 return | **+193 ms** |
   | Poster cut n1651 | 55.033 | Drop, bar 20 | **+244 ms**; the 808 pickup peaks 80 ms *before* the cut |
   | Download card n1905 | 63.500 | Drums back, bar 23 | **+52 ms** |
   | CTA n2081 | 69.367 | The groove stops on bar 25 *before* it | −299 ms |

   A lag scan of onset strength around all the cuts peaks weakly at +220…+240 ms (z 2.0–2.5) and is below average at
   0 ms.
3. **End card.** The cut n2175 (72.500 s) is on the grid (beat 105, −16 ms), 0.15 s into a 0.518 s digital silence.
   The sting lands **0.368 s after the cut**, on the next 8th (+7 ms).
4. **Diegetic hits are frame-tight or pre-lapped:**
   - the arrow thunk is −28 ms before whip-cut n1531;
   - the pack swish is −36 ms before cut n348;
   - the tumble whoosh starts −0.22 s before n1487;
   - the arrow whoosh starts −0.40 s before n1523.
5. **Title sounds lead their graphic by about half a frame:**
   - the static peak is 0.5 f before the OPUS flash n16;
   - the sub is 0.5 f before the playback bar n36;
   - the message tick is 3 f before the bubble (n249 vs n252).
6. **Transitions and UI are silent.** The score's own 808 notes and gates fill the cuts.
7. **The dialogue sits in the unpulsed section.** The groove starts 2.2 s after the last line.

## 7. Recipe for our score in the skill's terms

The skill's film style (`RECREATE.md` §4; `lib/audio.mjs` `arrangeFilm`) is the hf02 score as a style:
- an intro (pad swell, a 16th arpeggio from the first beat, a shaker pickup, a riser);
- from the `drop`: kick on 1 and 3, clap on 2 and 4, stabs, a 16th shaker, syncopated bass, an arpeggio and a motif
  over F-major rootless 9ths;
- `breaks:` dip to pad + shaker;
- a lift over the last two bars, 0.44 s of silence, then the `hit`.

**Closest film-style line**, with the shots laid on the reference's frames. The ids are the breakdown's `r` ids,
which match these frames:

```yaml
music: {style: film, bpm: 87.01, downbeat: 0.1107, key: F, drop: r05, breaks: [r20], hit: 0.368}
# r05 = card "brief received", n661 (22.033 s): 144 ms before beat 32 (> 35 ms, so not snapped); the groove's first beat is 22.177 = the reference's
# r20 = trail-map shot, n1399-1486 (46.633-49.567): the dip; the reference's break is 46.75-49.76
# hit 0.368 = sting onset 72.868 - end card 72.500 (the card must be the last shot)
```

**Check the timeline origin.** The line above assumes our shots sit on the reference's frames (shot 1 starts at 0.000).
The breakdown's `beats-draft.yaml` shortens r01 by 0.111 s, so that the reference's first beat lands on our t = 0
(r05 then starts at 21.94 s). If the build uses that draft, set `downbeat: 0` and every time here moves −0.1107 s; the
`hit` stays 0.368.

**What film style already does right here:**
- tempo and phase (87.01 / 0.1107), so every event sits on their grid;
- key F (the right tonic);
- the groove entering on bar 8's downbeat after the card-cut;
- one dip for the break, with a riser and crash back in (the reference returns on an 808 at 48.90 s);
- the end move: music silent before the hit, the hit 0.368 s into the end card. Its silence is 0.44 s against their
  0.52 s.

**What it can't do yet** (in order of audibility):
1. **An unpulsed opening.**
   - The reference has 22 s of drone + ambience + dialogue with no beat.
   - Film style plays a soft 16th arpeggio from beat 0 and a pad swell. With `drop: r05` that would be 22 s of
     arpeggio under the dialogue.
   - Needed: `intro: drone` (a sustained low pedal + pad, no arpeggio or shaker), or `music.from: <shot>` with silence
     or a user drone stem before it.
2. **Mode and key changes.**
   - The intro is an E drone. The groove is F minor: a chromatic F–F#–E 808 ostinato, then i–bIII–IV (F–Ab–Bb).
   - Film style is F-major rootless 9ths only (`key` only transposes).
   - Needed: `mode: minor` (a progression table) and an intro key.
3. **Two intensity levels.**
   - The reference has a sparse build (22–55 s: booms every 2 bars, ostinato, gated 16ths), then a full drop at
     55.28 s (bar 20, the poster).
   - Film style has one groove level after the `drop`.
   - Needed: a `drop2:` shot, or `build:` and `drop:`.
4. **An outro breakdown.**
   - The reference's groove stops 3.8 s before the hit, on bar 25, before the CTA.
   - Film style instead *lifts* over the last two bars (from 66.31 s here) and plays until 0.44 s before the hit.
   - Needed: `outro: <shot or seconds>` (stop the groove, keep a sub tail), and a way to turn off the lift.
5. **The groove's vocabulary.**
   - A pitch-drop 808 on 16ths 3/6/11/14, a half-time backbeat (beat 3), stutter/gate fills (64.95–66.1, 33.24) and
     mini-breaks (52.49–53.43).
   - Film style plays kick 1+3, clap 2+4 and stabs 1+3. The pulse lands right; the feel is brighter and straighter
     (hf02's own note: their kick spread vs ours on 1 and 3).
6. **A lead variation without a dip.** At 60.79–63.55 s the drums thin and a lead plays. A `breaks: [r25]` dip is the
   nearest, but it drops the melody.
7. **Foley and ambience beds.**
   - Waterfall (2.3–11.6), birds, rapids (36.76–41.9), fire burst, tumble, arrow whoosh and thunk with a sub boom.
   - The engine's SFX voices are pop, tick, click, chime and hit, plus transition whooshes. They have no noise beds and
     no recorded foley.
   - Needed: user audio files placed on the timeline (`sfx: [{file, t}]`), or synthesized beds (filtered noise for the
     water, chirps for the birds).
8. **Silent transitions.**
   - The reference has no whooshes on its glitch, zoom-blur, whip or card cuts, and no UI pops.
   - For a faithful match, set the whooshes and cues for those shots to off or very low, and keep pixel-out
     "crackles" (a glitch-like noise burst of ~0.15 s) only on the five prompt sends.
9. **Dialogue without ducking.** The skill ducks the music under a voiceover. The reference never ducks; it writes
   around the voice. Its lines start 9.3 s before the beat.

**Mix targets** (ours, not copied):
- about −14 LUFS integrated, LRA ~3.5 LU;
- mono lows, wide highs;
- a hot sting about 6 LU over the body;
- keep our true peak at the skill's limit. Their +0.2 dBTP is an over.

## Files

**Curated:** `sound/tempo_map.json`, `sound/sections.json`, `sound/sfx.json`, `sound/voice.json`, `sound/mix.json`,
`sound/sync.json`. All are written by `sound/tools/curate.py`.

**Measurements:**

| File | Contents |
|---|---|
| `energy.json` | 100 ms EBU, RMS, bands, width |
| `ebur128.log` | Raw EBU log |
| `bars.json` | Per-bar table |
| `tempo.json` | Tempogram windows and section locks |
| `gridfit.json` | BPM/phase fits per section |
| `onsets.json` | Band onsets with grid offsets |
| `sfx_measure.json` | Per-candidate SFX measurements |
| `evcheck.json` | Picture-anchored checks at 74 events |
| `sfx_candidates.json` | Automatic REPET candidates, unclassified |
| `typing_test.json` | UI-click test |
| `repet.json` | Repeating vs residual levels |
| `voice_frames.json` | Harmonic salience; not discriminative on its own |
| `vis.json` | Per-frame picture change |
| `tempo.txt`, `profile.txt` | Skill tool outputs |

**Tools:** `sound/tools/*.py`, numpy + Pillow, run with `/usr/bin/python3 -B`.

**Images:** `sound/img/`. Key ones:
- `overview.png` and `z6_*.png`: spectrogram strips;
- `tempogram.png` and `raster_87*.png`: beat rasters;
- `av/s00–s23.png`: spectrogram over frames, 3.2 s each;
- `evgrid-1..4.png`: 74 picture events;
- `col1–3.png`: SFX zooms;
- `cutgrid*.png`;
- `vz_*.png`, `rz_*.png`: voice;
- `chirps.png`, `arrow.png`.
