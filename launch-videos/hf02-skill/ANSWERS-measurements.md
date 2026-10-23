# Answers: hf02 measurement questions

From the hf02 session, 2026-10-21. Every number is re-derived from the reference curves in `hf02-skill/ref/curves/`, which were only read. To re-run:

```bash
python3 -E ~/Downloads/launch-videos/hf02-full/tools/hf02_skill_answers.py
```

Conventions:
- Pixels are 1080-wide: W = 1080, H = 608.
- "At the cut" means t = 0 at the cut instant (n311.5, 356.5, 464.5). That is your convention: B's 42 px residual at n312 is t = 0.5.

## 1. Entrance strength

**Short answer:**
- **C's ×6.5 is real, but it's a different move.** C drops in; it isn't a drift entrance. Keep it per-cut.
- **For the default drift entrance,** use:
  - E ≈ 0.10 W for horizontal entrances and ≈ 0.085 H for vertical ones;
  - decay ×0.65 per frame;
  - the shot's base drift as its own term.
- **Not 0.12.** That number comes from folding B's base drift into the entrance.

| Cut | Offset on the first frame (above the shot's base drift) | Decay per frame | Speed at the cut | E at the cut | E with your fixed ×0.70 |
|---|---|---|---|---|---|
| B: n312, horizontal | 86.6 px | ×0.652 | 45.8 px/f | 107.3 px = **0.099 W** | 0.096 W |
| D: n465, vertical | 42.3 px | ×0.660 | 21.6 px/f | 52.1 px = **0.086 H** | 0.083 H |
| C: n358, vertical, read from the slot top | 189.2 px | ×0.725 | 98.6 px/f | 306.5 px = **0.504 H** | 0.531 H |

**Base drift:**
- B drifts 1.5 px/f (n320–325) and D 0.88 px/f (n475–477).
- Your b ×1.68 (0.118 W) fits B's position relative to its key frame, which includes that drift. With the drift separated, B is ×1.42 of 0.07 W.
- Your d ×1.08 agrees with mine.

**C moves as one rigid layout.** It isn't a slot-only move or a zoom:
- From n360 to n372 the slot top moves 92.1 px and the whole-frame track moves 93.1 px.
- The slot's height holds at 158.94 ± 0.32 px from n358 to n392.
- Over n360–371 the whole-frame tracker (C0r) reads a scale going 0.91 → 1.03 and an x swing of about 100 px. Those are artefacts: the first agent's drop and overshoot pull the similarity fit. Judge C's entrance by the slot top, not by C0r.

**C carries no momentum across its cut:**
- B exits at about 9–10 px/f, and C enters at about 99 px/f. The list falls into place together with the first agent's 85 px/f drop, which is why C is 5–6× the drift default.
- Compare the other cuts:
  - C→D keeps its speed: C exits up at about 21–25 px/f, and D enters at 21.6 px/f.
  - A→B jumps about 2.8×: A is at about 16.4 px/f on its last frame, and B enters at 45.8 px/f.

**Why a decay override gained you only about 3 px:**
- C's entrance has a two-frame cadence: its frame-to-frame ratios alternate between about 0.68 and 0.81 over n358–367, with a geometric mean of 0.73.
- That is probably the source's frame-rate conversion. A smooth exponential can't follow it, so a few px of residual stay whatever the decay.

**Mine to own:** the handover's E = 0.07 W was below my own measured B entrance, and the decay is 0.65–0.66, not 0.70.

**Only two clean samples (B and D).** The full film (`hf02-full`) has about 20 more cuts measured by its builders. When their notes are in, I can tabulate E and decay for every cut, so the default rests on more than two.

## 2. Motion blur

**Short answer:**
- **Keep 0.2.**
- **Your speed definition is already right.** Your engine takes the speed at the frame (a ±0.25 f central difference in `cameraAt`).
- **The gap in your exit-frame table is mostly speed, not the coefficient.** Your camera is slower than the reference on the last frame of each exit.

Reference blur against the speed at each frame. The tracker's σ is divided by 0.93, the tracker's steady-motion bias for σ ≥ 2 px in your `compare/blurcal.txt`.

| Frames | Speed (px/f) | σ (px) | σ / speed |
|---|---|---|---|
| B pan n331, n332 (accelerating) | 10.1, 16.1 | 1.73, 3.12 | 0.172, 0.193 |
| B pan n335, n336 (decelerating) | 20.4, 12.5 | 3.38, 2.02 | 0.165, 0.161 |
| A exit, last frame n311 | ≈16.3 | 3.90 | 0.239 |
| D exit n508 / last frame n509 | 19.0 / ≈26.6 | 4.16 / 5.68 | 0.219 / 0.213 |

**What the reference does:** in-shot camera blur is about 0.17–0.19 × speed, and the last exit frames about 0.21–0.24 × speed. 0.2 sits between them.

**Where your 0.24–0.27 comes from:**
- **One-sided speeds on exit frames.**
  - A's 13.9 px/f is the speed between n310 and n311. On n311 itself it is about 16.4 px/f, because the exit keeps building ×1.38 per frame.
  - D is the same: 22.3 px/f between frames, about 26.5 px/f on n509, building ×1.41.
  - That's my handover's wording: its exit "peaks" were the last inter-frame speeds, not the speed on the final frame.
- **Entrance frames where elements fade or un-blur.**
  - Those frames are B n312–317 (window chrome), C n357–364 (dissolve and drop) and D n465–466 (status-label wipe).
  - The tracker reads that element blur as camera blur, as your own calibration showed on n312–313 (6.9–7.7×).

**Your exits are slower on the last frame:**
- At n311 your σ of 2.8 means 14.0 px/f, against about 16.4 in the reference.
- At n509 your 3.9 means 19.5 px/f, against about 26.5.

**What to do:**
- Let the exit build keep going ×1.38–1.41 through the final frame, and the blur follows.
- If the last exit frame should still read like the reference after that, the faithful knob is a ×1.1–1.2 boost on that one frame.
- Don't raise the global coefficient to 0.25: it would over-blur in-shot pans by about 40 %.

**n465 (D's entrance) I can't clear.** Its σ reads about 0.35 × speed whether you take your speed there (16.5) or the reference's (about 17.6). The status label's soft wipe starts on that frame, so treat the reading as contaminated.

## 3. Roster slot nudges

**Short answer:** the variation is real, not tracker noise. It looks hand-keyed. Keep one rule.

**Noise floor:**
- The slot's top and bottom edges are measured separately. Frame to frame they agree within a median of 0.19 px (max 0.74 px, n373–460).
- The slot's height holds at 159.02 ± 0.29 px.

**Each step:**

| Step | List peak | Slot low → high | Lag after the list peak | Rise | Against a 1 px/f drift line |
|---|---|---|---|---|---|
| 1 | 35.7 px/f at n394.5 | n392 → n397 | 2.5 f | 8.8 px | 13.8 px |
| 2 | 35.3 px/f at n409.5 | n407 → n413 | 3.5 f | 14.9 px | 20.9 px |
| 3 | 35.8 px/f at n424.5 | n423 → n426 | 1.5 f | 2.2 px | 5.2 px |
| 3-row run | 101.9 px/f at n439.5 | n435 → n444 | 4.5 f | 25.7 px | 34.7 px |

**The list moves identically in steps 1–3, but the slot doesn't:**
- The list: one 174 px row each time, peaking at 35.3–35.8 px/f.
- The slot: rises of 2.2 to 14.9 px, with lags from 1.5 to 3.5 frames.
- No rule driven by the list's motion can produce that, so it reads as hand-keyed.

**Steps 1 and 4 fit about 5 % of the list travel:**
- Step 1: 8.8 / 174 = 5.1 %. Step 4 (the 3-row run): 25.7 / 522 = 4.9 %. That is what your 5.6 % drag gives.
- Step 2 is 8.6 % and step 3 is 1.3 %.
- Your residual of about 10 px (aligned) is the expected cost of one rule.

**If you want the irregular, hand-animated feel without per-step keys:** add a seeded per-step factor of about 0.25–1.7× on the drag, or an optional list of per-step overrides.

**Mine to own:** the handover's "about 14 px" was the mean against the drift line (13.8 / 20.9 / 5.2). I should have listed the steps.
