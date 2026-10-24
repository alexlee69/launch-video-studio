# higgsfield01 — cuts, transitions and camera, frame-exact (study agent A)

**Source**: `~/Downloads/higgsfield01.mp4`, 1080×608, 30 fps CFR, 2296 frames (n0–n2295), 76.533 s.
**Deliverables**: `cuts/cuts.txt` (the cut list for `compare.py --cuts-from`), `cuts/cuts.json` (shot list: first/last
frame, frames, seconds, 24p master frames, content, transition in/out, camera), and the per-frame JSON in `cuts/data/`:
`series.json` (every frame: luma, RGB, sharpness, change), `cadence.json`, `momentum.json` (both sides of every cut),
`transitions.json` (per-frame records ±8 f around every cut and in-shot event), `fits.json` (fitted curves),
`segments.json` (camera phases per shot), `card_n*.jsonl` (white-card copy block per frame), `subject_blue.json`
(the adventurer's jacket: position/size per frame), `frame_tables.md` (the per-frame tables for all 26 cuts).
`cuts/track/*.json` are the track.py runs, `cuts/chain/*.json` the frame-to-frame camera per shot, `cuts/sheets/*.png`
the contact sheets every claim was checked on, `cuts/tools/*.py` how each number was made.

**Units.** px on the 1080×608 reference (×1.7778 for 1920×1080). Frames are 0-based output frames `nNNNN`.
**Speeds are px per 24p master frame (px/mf)** unless marked /f30, because the film is a 24 fps edit (§1): the picture
changes 24 times a second. ×0.8 → px per 30 fps output frame; ×24 → px/s. Zoom = % scale change per mf. Exponential
curves are written v_k = v0·r^k with k in mf: r < 1 ease-out, r > 1 ease-in (r per 30p frame = r^0.8).

**How it was measured.**
- `track.py` (the skill's, unmodified, `--half`) on both sides of every cut against a sharp key frame of each shot, and on
  the in-shot events: scale, shift, Gaussian blur, ncc. Blur is quoted only where ncc ≥ 0.9.
- `tools/chain.py` (track.py's model, adapted): each distinct frame registered to the previous distinct frame
  (phase-correlation start, so whips are followed), with the overlays masked (IG watermark in both of its positions,
  prompt bars, title, tagline). It has no blur model, so on smeared transition frames the landmarks below win.
- Landmarks where a global fit can't hold: the white-card copy block (`tools/card_ink.py`), window edges (`tools/edge.py`),
  the yellow cat mascot in the S13 viewer, the blue jacket (`subject_blue.json`), luma/sharpness from `series.json`.
- ✗ = ncc < 0.9 (subject motion, parallax or smear beyond the model): read as an estimate. "estimated" = read off sheets.

## 0 · Headlines

- **27 shots, 26 cuts** (breakdown: 28 shots). Its n66 "zoom-in" is the title zooming through the camera over a
  continuous plate and its n1009 "fx" is a pan inside the same comp board: both removed. A hard cut at **n364**
  (backpack → zipper close-up) was missed: added. Its n1532 is **n1531**, the first frame of the wall shot.
- **24p in a 30p file**: output frames n%15 = 5, 10, 14 repeat the previous frame (all 459 slots). No cut lands on one.
  Shot lengths are whole 24p frames; three of the five status cards are exactly 30 mf (1.25 s).
- **Transitions (26)**: 10 hard cut · 5 card-in · 4 card-out-up · 1 card-out · 1 whip-left · 1 zoom-in · 1 zoom-out ·
  1 zoom-in-diag · 1 whip (live action) · 1 end-card dim. Plus 3 transitions inside shot 1 (title flash-in, title
  zoom-through, foliage wipe) and 4 in-screen whips. No dissolves, no flash frames between shots, no RGB split.
- **Grammar**: live action is cut hard and keeps its own camera; the screen side (cards, AE panels, comps) is joined by
  momentum cuts — the outgoing move accelerates exponentially into the cut, the incoming shot starts already moving the
  same way and eases out exponentially — and in-screen re-frames are asymmetric bells (build ×1.75/mf, stop ×0.57/mf).

## 1 · Frame grid: a 24 fps edit shown at 30 fps

- Output frame n repeats n−1 when **n % 15 ∈ {5, 10, 14}**; the pattern starts at n0. 455 of 459 slots are near-exact
  (frame MAD < 0.3 levels), the other 4 (n1460, n1484, n2180, n2189) repeat the plate while an overlay changes < 1 level.
  Graphics, cards and live action all follow it: the whole film was finished at 24p and converted (`data/cadence.json`).
- **Master index m(n) = 12·(n div 15) + r − [r≥5] − [r≥10] − [r≥14]**, r = n mod 15; n2295 = m1836 → 1837 master
  frames. Within every 12 master frames, the 5th, 9th and 12th (m mod 12 = 4, 8, 11) are shown twice.
- Extra (off-phase) repeats are holds in the master: n271, n301 (S01), n468, n618 (S04), n852 (S09), n1132, n1162, n1222
  (S14), n1252 (S15), n1363 (S18), n1503 (S20), n1579 (S22), n1740, n1777, n1778, n1781, n1788, n1796–n1798 (the
  finished poster), n1827, n1857 (S24), and
  the end card from n2176.
- **For a frame-exact rebuild** animate on a 24 fps clock, render 24p, then build the 30p file by index:
  `out[n] = master[m(n)]`. (ffmpeg's `fps=30` filter repeats a different phase — n%15 = 2, 7, 12, tested on a 24p
  testsrc2 — so don't use it.)
  Every cut and every judder step then lands on the reference's frame. A true-30p render keeps the cuts on their frames
  but is smoother inside moves.

## 2 · Verified shot table

mf = 24p master frames. "in"/"out" = transition (types in §4). Camera details in §5.

| # | frames | f30 | mf | sec | content | in | out | camera |
|---|---|---|---|---|---|---|---|---|
| 1 | n0–n347 | 348 | 279 | 11.600 | FPV jungle → waterfall climber → reads the brief on his phone (title over n0–n68) | start | cut | FPV push: creep → flight → orbit down → settle |
| 2 | n348–n363 | 16 | 13 | 0.533 | backpack dropped on the forest floor | cut | cut | near-static |
| 3 | n364–n381 | 18 | 14 | 0.600 | hand opening the zipper (CU) | cut | cut | static (hands move) |
| 4 | n382–n660 | 279 | 223 | 9.300 | sits in ferns; pixel cat, pixel-fire VFX, prompt bar | cut | card-in | tilt up n390–396, slow push +0.34 %/mf, hold |
| 5 | n661–n697 | 37 | 30 | 1.233 | card "Promo brief received…" | card-in | card-out-up | card copy: slide up → drift → expo-in out |
| 6 | n698–n775 | 78 | 62 | 2.600 | AE window over hills: badge comp builds | card-out-up | whip-left | window snap-up; hold; drift R, whip L |
| 7 | n776–n806 | 31 | 25 | 1.033 | AE timeline, layers build | whip-left | zoom-in | whip-in decay r 0.80; push-in build |
| 8 | n807–n846 | 40 | 32 | 1.333 | AE UI: "HI, I'M ARA!" comp | zoom-in | cut | push-in decay r 0.79; hold |
| 9 | n847–n927 | 81 | 65 | 2.700 | runs through jungle with laptop; prompt | cut | card-in | handheld tracking run (✗ parallax) |
| 10 | n928–n972 | 45 | 36 | 1.500 | card "Creating photos, pins, and badges…" | card-in | card-out-up | card copy: slide up → drift → expo-in out |
| 11 | n973–n993 | 21 | 17 | 0.700 | AE project panel populates | card-out-up | zoom-out | window snap-up r 0.78; pull-out build |
| 12 | n994–n1034 | 41 | 32 | 1.367 | AE comp board (badge, rays, photo frame) | zoom-out | zoom-in-diag | pull-out settle r 0.73; in-viewer whip; diagonal push build |
| 13 | n1035–n1102 | 68 | 55 | 2.267 | AE timeline + viewer (cat) | zoom-in-diag | cut | push decay r 0.35; whips L (186 px/mf) and R |
| 14 | n1103–n1233 | 131 | 105 | 4.367 | rope bridge wide → push to his face | cut | cut | truck + push ×1.4; crash push-in ×5.6; running bob |
| 15 | n1234–n1256 | 23 | 18 | 0.767 | feet on the bridge planks | cut | card-in | feet tracking (✗); fast move out |
| 16 | n1257–n1293 | 37 | 30 | 1.233 | card "Mapped. Five stops…" | card-in | card-out-up | card copy: slide up → drift → expo-in out |
| 17 | n1294–n1361 | 68 | 54 | 2.267 | island map comp builds | card-out-up | card-in | slide-up in; bell pans L/R/up; ease-in up out |
| 18 | n1362–n1398 | 37 | 30 | 1.233 | card "Generating photos of the trail stops…" | card-in | card-out-up | chip pop, copy slide → expo-in out |
| 19 | n1399–n1486 | 88 | 70 | 2.933 | "SUN GATE TRAIL" map, photo pins pop | card-out-up | cut | bell re-frames; whip L 48 px/mf; settles |
| 20 | n1487–n1522 | 36 | 29 | 1.200 | collapses against the stone wall | cut | cut | handheld collapse (✗) |
| 21 | n1523–n1530 | 8 | 6 | 0.267 | arrow in flight (ECU) | cut | whip | locked on the arrow, background streak (✗) |
| 22 | n1531–n1650 | 120 | 96 | 4.000 | arrow lands above his head; opens laptop; prompt | whip | cut | whip-in snap stop; static |
| 23 | n1651–n1799 | 149 | 119 | 4.967 | "THE SUN GATE" poster builds | cut | cut | static comp, bell re-frames; dead still at the end |
| 24 | n1800–n1904 | 105 | 84 | 3.500 | cave, stone sphere; prompt; scream | cut | card-in | slow pull-back ×0.41 |
| 25 | n1905–n1932 | 28 | 23 | 0.933 | card: AE file chip "Download" | card-in | card-out | chip slide-up, hold |
| 26 | n1933–n2174 | 242 | 193 | 8.067 | looks up, walks away reading his phone; cat, tagline | card-out | endcard-dim | ease-out pan; tilt down; pull-back ×0.45 |
| 27 | n2175–n2295 | 121 | 97 | 4.033 | end card: IG icon + handle over the dimmed plate | endcard-dim | end | frozen dimmed plate |

Shot lengths: 6–279 mf, median 45 f30 = 1.5 s, mean 2.83 s. `compare.py --ref ref.mp4 --ours ref.mp4 --cuts-from
cuts/cuts.txt --no-video` (and `--cuts-from cuts/cuts.json`) accepts the list: 26/26 exact. It prints n1531 as
`n1532 (listed n1531)` because the whip's second frame is the bigger change; n1531 is the first frame of the new shot.
Fail path checked too: against a copy of the reference with its first 2 frames dropped, the same list reports all 26
cuts `off` at −2 f.

## 3 · Momentum at every cut

Out = the last distinct frame before the cut, in = the first steps after it (px/mf; + = content moves right/down; zoom
%/mf, + = in). Sources: masked chain on sharp frames, track.py on blurred ones, landmarks where noted (`data/momentum.json`,
`data/segments.json`).

| cut | type | out of A | into B | across the cut |
|---|---|---|---|---|
| n348 | cut | drift (+1.3…+1.7, 0), push +0.3 %/mf | near-static, ≤ 0.7 px/mf | unmatched |
| n364 | cut | static (~1 px/mf) | static; the hands move (✗) | unmatched |
| n382 | cut | the hand fills the frame (✗) | wobble up −10 px/mf (n383–384) | unmatched |
| n661 | card-in | static (−0.7…−1.3 px/mf) | copy up 25 px/mf, blur-in | — |
| n698 | card-out-up | copy up **−17.5** px/mf, σy 3.8 | window up ~−60 (smear frame), then −27, −19.5, −13 (edge) | same direction, B faster |
| n776 | whip-left | **−32** px/mf, σx 28 | smear frame, then −24.2, −15.6, −11.5 | ≈ matched |
| n807 | zoom-in | **+8.6…9.4 %/mf** | +3.0 %/mf, then ×0.79/mf | same direction, B slower |
| n847 | cut | drift down +3.5 px/mf | foreground trunk wipes off left (~−67 px/mf, ✗); background −7…−17 | unmatched |
| n928 | card-in | run (✗, ~−3…−5 px/mf, −1 %/mf) | copy up −26.9 px/mf | — |
| n973 | card-out-up | copy up −17.5, σy 3.8 | window up ~−91…−108 (smear), then −38.6, −24.9, −18.4 | same direction, B faster |
| n994 | zoom-out | **−4.0 %/mf** (n993, smeared σy ≈ 25) | starts at 116 %, −6.6 %/mf, ×0.73/mf | same direction |
| n1035 | zoom-in-diag | **(+116, −71) px/mf + 5.0 %/mf** | (+30, −25) px/mf + 9.8 %/mf, ×0.35/mf | same direction |
| n1103 | cut | −1.6 px/mf | truck: content −13 px/mf | unmatched |
| n1234 | cut | running bob (vy −22 px/mf) | feet (✗) | unmatched |
| n1257 | card-in | fast blurred move ~40–53 px/mf (✗) | copy up 25 px/mf | — |
| n1294 | card-out-up | copy up −17.5 | map up **−18.0**, then −10.2, −7.4, −5.3 | **velocity-matched** |
| n1362 | card-in | map accelerating up −3.4 → −6.3 → −12.4 (×1.78/mf) | chip pops; copy up −11.1 from n1366 | same direction |
| n1399 | card-out-up | copy up −17.5 | map up −2.0, −1.8, −1.3 | same direction, B much slower |
| n1487 | cut | static | he collapses (✗) | unmatched |
| n1523 | cut | drift −5…−7 px/mf (✗) | arrow ECU, background streaking (✗) | unmatched |
| n1531 | whip | arrow-locked, background streak | offset −84 → 0 px in 4 mf (67, 13, 5 px/mf) | arrow's direction kept |
| n1651 | cut | static (0.0) | static | — |
| n1800 | cut | static | pull-back −5.8 %/mf (first step) | unmatched |
| n1905 | card-in | pull −1 %/mf, drift +2 px/mf | chip up −22.6 px/mf | — |
| n1933 | card-out | card drift −0.8 px/mf | pan −7.8 px/mf, ×0.70/mf | unmatched |
| n2175 | endcard-dim | pull-back −0.6 %/mf | frozen | — |

## 4 · Transitions, frame by frame

Per-frame tables for all 26 cuts (luma, sharpness, track.py fit on each side, repeats) are in `cuts/data/frame_tables.md`;
the JSON is `cuts/data/transitions.json`; curve fits `cuts/data/fits.json`.

### 4.1 Hard cut (10: n348, n364, n382, n847, n1103, n1234, n1487, n1523, n1651, n1800)

Frame n−1 is the last of A, n the first of B: no transition frames, no dissolve, flash or blur ramp (luma and sharpness
step in one frame). The editor doesn't match motion across these; each side keeps its own camera:
- live → live (n348, n364, n382, n1234, n1523): the AI clips' own moves; B is still or drifting ≤ 7 px/mf, except n1523
  (into the arrow ECU, background already at whip speed) and n1234 (feet, subject blur).
- screen → live (n847, n1103, n1487, n1800): the screen side is static (≤ 3.5 px/mf); the live side opens on motion —
  n847 a dark foreground trunk covers the left and bottom and wipes off left (dark bottom rows 144 → 58 → 23 → 7 → 0
  over n847–n853, runner revealed right), n1487 he is already collapsing (subject blur), n1800 the cave opens on a
  pull-back (−5.8 %/mf first step), n1103 the bridge wide trucks at ~13 px/mf.
- live → screen (n1651): a held plate to a static comp (the poster starts empty; cursor; the cat drops in n1652–n1653).

### 4.2 card-in: hard cut to a white status card (5: n661, n928, n1257, n1362, n1905)

Full-frame card, flat **#F3F0F5** (243, 240, 245), Y ≈ 241, IG watermark faint on it. One preset, measured on the copy
block (top edge and darkest ink, `data/card_n*.jsonl`) and track.py (vertical blur, key frame 15–18 f after the cut):

| mf after the cut | 0 (cut) | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|---|
| frame (n928 card) | n928 | n930 | n931 | n932 | n933 | n934 | n936 | n937 | n938 |
| copy top y, n928 | 345 | 320 | 306 | 297 | 290 | 286 | 282 | 278 | 275 |
| step (px/mf) | — | 25 | 14 | 9 | 7 | 4 | 4 | 4 | 3 |
| darkest ink Y (241 = invisible, 0 = black) | 123 | 86 | 83 | 70 | 73 | 47 | 0 | 0 | 0 |
| vertical blur σy (track.py) | 9.7 | 3.5 | 2.4 | 1.6 | 1.4 | 1.4 | 0.7 | 0.5 | 0.8 |
| copy top y, n661 | 332 | 307 | 295 | 287 | 282 | 276 | 272 | 268 | 265 |
| copy top y, n1257 | 343 | 318 | 304 | 295 | 289 | 285 | 281 | 278 | 274 |
| chip top y, n1905 | 342 | 322 | 310 | 301 | 294 | 288 | 283 | 279 | 275 |

- **Cut frame**: hard cut to the card. The copy is already there, ~25 px below where it will be one mf later, blurred
  vertically (σy ≈ 10, σx ≈ 1.5) at about half contrast, only its first word(s) typed (typing: agent C).
- **Next 8 mf**: slides up 25, 14, 9, 7, 4, 4, 4, 3 px — **expo ease-out, r = 0.76–0.80/mf** after the first step
  (centre fits r² 0.96–0.99: S05 0.766, S10 0.759, S16 0.759, S18 0.778 from n1366, S25 0.805), while the blur falls
  to 0 and the ink reaches full black in 6 mf (0.25 s).
- It never settles: the block keeps drifting up 3 → ~0.6 px/mf through the hold, then leaves (4.3).
- Variants: n661 also scales ~103.6 % → 100 % on the first step (✗, estimated); **n1362** cuts to the card with only the
  green Higgsfield chip (pops n1362–n1364), the copy slides in from n1365 (11.1, 8.4, 6.6, 5.1 … px/mf, r 0.78);
  n1905 (download chip, a filled grey bar) has the same slide with a softer start (σy 7.4 → 0 in 4 mf).
- What precedes it: held live plates (n661, n1905), the running shot (n928), **a whip** (n1257: the feet shot ends on a
  ~40–53 px/mf blurred move, ✗) and **an upward ease-in** (n1362: the map accelerates up 3.4 → 6.3 → 12.4 px/mf).

### 4.3 card-out-up: the card leaves upward, the next shot arrives moving up (4: n698, n973, n1294, n1399)

**Card side** — identical on all four cards (ncc 0.99, the cleanest numbers in the film). Copy-block centre velocity:

| mf before the cut | −8 | −7 | −6 | −5 | −4 | −3 | −2 | −1 (last frame) |
|---|---|---|---|---|---|---|---|---|
| frame (S05) | n688 | n690 | n691 | n692 | n693 | n694 | n696 | n697 |
| vy up (px/mf) | 2.7 | 3.3 | 4.2 | 5.5 | 6.9 | 8.8 | 12.2 | **17.5** |
| σy (track.py) | 0 | 0 | 0 | 0 | 1.1 | 1.0 | 1.9 | **3.8** |

- **Expo ease-in, ≈ ×1.31/mf** (fits 1.308–1.322, r² 0.985–0.993), steepening to ×1.4 on the last two mf; x and
  scale untouched; 61 px of travel over the last 8 mf. Paste the table rather than the fit. Motion blur σy = 0.21 × speed
  on the last frame (a clean frame: no cut-frame over-read).
- **Incoming shot** — its first frame is the cut frame, already moving up, then an expo ease-out:
  - **n698** (→ AE window over a hills wallpaper): n698 is a *snap-up smear* — the window streaked vertically ~120 px,
    the wallpaper's hill tops visible above it. Window top edge 79.5 (n699; n700 repeat), 52.5 (n701), ~33 (n702),
    20 (n703), 9.5 (n705), ~2 (n706): steps ~60–70 (smear → n699), 27, 19.5, 13, 10.5, 7.5, then 5.9, 4.7, 4.0, 3.0,
    2.6 px/mf (chain) — **r ≈ 0.79/mf** (fit, r² 0.99).
  - **n973** (→ AE project window over sky): same snap-up smear (toolbar icons streaked ~120 px); window top 112 (n975),
    72.5, 46.5, 28.5, 14.5, ~4 (n981): steps ~91–108 (smear → n975), 39.5, 26, 18, 14, 10.5, then 9.1, 7.1, 5.8 …
    0.9 px/mf — **r = 0.78/mf** (r² 0.99). Left edge stays at x ≈ 262–266.
  - **n1294** (→ island map): **velocity-matched** — 18.0 px/mf up on the first step (the card left at 17.5), then 10.2,
    7.4, 5.3, 4.1, 3.1, 2.5 (r ≈ 0.62–0.75); σy 3.5–7.8 on the first frames.
  - **n1399** (→ trail map): soft, 2.0, 1.8, 1.3, 0.9 px/mf.
- **No RGB split anywhere** (R and B registered to G: 0.0 px on n698, n776, n973 and the title flash; `tools/rgbsplit.py`).
  The breakdown's "fx / glitch" on n698 and n973 is pure vertical motion smear on the new shot's first frame.

**card-out (n1933)**: the download card holds (0.7–1.0 px/mf up, no ease-in) and cuts hard to the walk-out, which opens
on a pan already under way: content left 7.8, 7.2, 5.5, 3.2, 3.1, 1.7 px/mf, σx 15 → 0 (r ≈ 0.70).

### 4.4 whip-left (n776: AE comp preview → AE timeline)

| frame | n762 | n766 | n768 | n769 | n771 | n772 | n773 | n774 | n775 | **n776** | n777 | n778 | n780 | n781 | n782 | n783 | n784 | n786 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| vx px/mf | +6.7 | +3.1 | +0.1 | +0.2 | −4.5 | −1.9 | −5.7 | **−33** | repeat | smear | ✗ | −24.2 | −15.6 | −11.5 | −9.2 | −6.8 | −6.3 | −4.7 |
| σx (track.py) | | | | 5.8 | 4.8 | 8.8 | 16.2 | 28.2 ✗ | | streaked | | | | | | | | |

- **Anticipation**: the preview drifts right (+1.3 → +6.7 px/mf, n756–n762), eases to a dead stop (n768–n769), then
  whips left: −4.5, −1.9, −5.7, −33 px/mf (n771–n774); n775 is a cadence repeat.
- **Cut frame n776**: the timeline panel streaked horizontally (rows smeared into lines); a strip of the jungle comp at
  the far left (x 0–~120) belongs to the new framing and slides out: its edge at x 28.5 (n778), 12 (n780), gone n781.
- **In**: content keeps moving left, **expo ease-out r = 0.80/mf** (r² 0.97) from 24 px/mf (n778), ~2 px/mf by n791.
  No zoom (|zoom| < 0.4 %/mf once the static watermark is masked; unmasked fits invent +2–7 %).

### 4.5 zoom-in (n807: AE timeline → AE full UI with the "HI, I'M ARA!" comp)

- **Out** (S07): push-in about the frame centre (fixed point x 548, y 301): +0.38, +0.60, +1.06, +2.18, **+8.6 %/mf**
  (n801–n806) — expo build ×1.8/mf (r² 0.92). n806 is sharp (pushed-in timeline text; Laplacian sharpness 457).
- **Cut frame n807**: the new UI at 92.2 % of its n814 size, heavily blurred (sharpness 28 vs 126–184 after; track σ ≈ 4
  px, ncc 0.92).
- **In** (S08): keeps pushing in, decaying +3.1 (n808), +1.8, +1.2, +0.9, +0.7, +0.6, +0.5, +0.4 … %/mf — **r = 0.79/mf** (r² 0.93);
  scale vs n814: 0.922, 0.950, 0.966, 0.978, 0.987, 0.995, 1.000. Speed drops ×0.35 across the cut, direction kept.

### 4.6 zoom-out (n994: AE project panel → AE comp board)

- **Out** (S11): after the snap-up the window creeps up and starts shrinking about x ≈ 532. Window width (left edge to
  the Project/Composition divider, `data/landmarks.json`): 543, 541, 539, 537, 532, 527, 506 px over n986–n993 (n989
  a repeat) = **−0.4, −0.4, −0.4, −0.9, −0.9, −4.0 %/mf** — an expo build (chain ×1.4/mf, r² 0.95) with a jump on the
  last frame. n993 is smeared vertically (σy ≈ 25, sharpness 322 → 62). (track.py reads n993 as +5.5 % with ncc 0.96 —
  a blur misfit; the edges are unambiguous.)
- **Cut frame n994** (+ n995 repeat): the comp board at **116 % of its settled size** (fixed point = frame centre:
  531, 306), blurred σ ≈ 5.5/2.4, sharpness 101.
- **In** (S12): keeps shrinking to 100 %: −6.6 (n996), −2.9, −1.85, −1.3, −0.9, −0.75, −0.6, −0.45, −0.35 %/mf —
  **expo ease-out r = 0.73/mf** (r² 0.94); scale 1.160, 1.083, 1.052, 1.033, 1.019, 1.008, 1.000 (n1002). Sharpness
  recovers 101 → 196 → 257 → 339 → 373 → 432.

### 4.7 zoom-in-diag (n1035: AE comp board → AE timeline with viewer) — the fastest move in the film

- **Out** (S12, track key n1027): content moves right and up while pushing in: (+25, −17), (+48, −30), **(+116, −71)
  px/mf = 136 px/mf on n1033** (n1034 repeat); zoom +1.0, +1.9, +5.0 %/mf — expo build ×2.7–2.9/mf. Blur σ (4.8, 1.9)
  → (6.7, 3.5) → (14.6, 12.2) ≈ 0.11 × speed (✗ on the last two).
- **Cut frame n1035**: timeline + viewer at 86.6 % scale (vs n1044), smeared horizontally (σx ≈ 120, ✗).
- **In** (S13, the cat landmark in the viewer, x/y): 553/76 (n1036) → 583/51 → 601/45 → 614/43 → 619/42 → 620/42
  (n1042): content right +30, +18, +13, +5, +1 and up −25, −6, −3 px/mf; zoom +9.8, +2.8, +1.4, +0.9 %/mf; σx 41 → 21
  → 5 → 4. **Snappy expo ease-out, r ≈ 0.34–0.36/mf** (fits on zoom and x). Same direction on both sides.

### 4.8 whip (n1531: arrow in flight → the arrow lands above his head)

- **Out** (S21, n1523–n1530, 6 mf): camera locked on the arrow — tip at x ≈ 183, 168, 165, 158, 172, 222 and y ≈ 235–255
  on n1523–n1530 (read off `sheets/d-1523.png`, `d-1531.png`; held within ±30 px), the arrow growing ~+2 %/mf (✗);
  the stone background is a horizontal streak, blur length ≈ 2 × autocorrelation
  half-width ≈ 100 px (n1524) → 140 (n1526) → ~370 (n1528–29) — background speed estimated 200–700 px/f30. Luma falls
  72 → 60 → 49 → 36 (n1526 → n1530): the shot darkens into the cut.
- **Cut frame n1531**: the wall shot's first frame, mid-whip: the arrow (now tilted ~4°, upper left → right) streaks
  across the top third, wall and blue jacket smeared horizontally (autocorrelation half-width 73 px x / 46 px y; ✗).
- **In** (S22, key n1538): frame offset −84 px (n1532, σx 17), −17 (n1533, σx 4), −4 (n1534), +1 (n1536), 0 (n1538):
  steps 67, 13, 5 px/mf — **a snap stop (×0.2/mf)**. Content moves right = the camera pans left, the arrow's direction
  of flight; the shaft keeps vibrating n1533–n1537.

### 4.9 endcard-dim (n2175)

- n2174: last walk-out frame (luma 53.5, camera pulling back −0.6 %/mf).
- **n2175**: the plate frozen and **dimmed to ~24 %** in one frame (per-channel fit against n2174: R ×0.242, G ×0.235,
  B ×0.242, offset −0.3, residual 0.6 levels — the frozen frame is n2174 or the plate's next frame; ≈ a black layer at
  76 %, faintly magenta), luma 53.5 → 14.8, no fade. The tagline and cat stay, dimmed with the plate. The white IG icon
  appears at full size on the same frame. From n2176 the plate is static (left-third MAD 0.00 to n2295); only the icon
  and the "@HIGGSFIELD.AI" handle animate (agent C).

### 4.10 Transitions inside shot 1 (the opening FPV plate)

- **Title flash-in (n16)**: frame luma 35 (n15) → **68.5 (n16)** → 59.0 → 51.6 → 47.5 (n19; n20 repeat) → 45 → 43 → 42.
  The excess over the new 42 base decays **×0.57/mf** (26.5, 17, 9.6, 5.5, 3, 0.9): an orange glow/smear on the
  "OPUS 5.5" line, no RGB offset. The plate is unaffected.
- **Title zoom-through (n60–n68)**: track.py on the title (ROI 160,180,760×320, key n58): scale ×1.069 (n60), 1.171,
  1.319, 1.544, 1.887 (n64; n65 repeat), 2.523 (n66), ~2.9 (n67 ✗), ~3.8 (n68 ✗) — per mf ×1.069, 1.095, 1.127, 1.170,
  1.222, 1.337: **the log-scale rate grows ×1.33 per mf (exponential ease-in on scale)**, about the frame centre
  (539.7, 303.8). Blur σx 0.6 → 1.0 → 2.0 → 3.7 → 5.5 → 11.7 (n66). Frame luma 47.5 → 79.2 (n64) as the white letters
  fill the frame, 74 (n66–67), 56 (n68), **36 at n69: the title has passed the camera**. The plate under it is the same
  shot (canopy and big leaf before and after, `sheets/c-0064-full.png`) and was already accelerating its own push:
  +1.1 → +4.7 %/mf over n53–n60 (masked chain). Not a picture cut.
- **Foliage wipe (n88–n101)**: the drone flies through foliage; dark leaves cross the lens (bottom rows black n88–n93,
  frame luma 16–27), the pool appears by n102. Natural wipe inside one shot.

### 4.11 In-screen moves (inside a shot: the AE frame or the comp re-frames)

Re-frames on comps are **asymmetric bells**: expo build ×1.70–1.75/mf, expo stop ×0.56–0.61/mf (S17 and S23 fits,
r² 0.94–0.99), peak ~60 % through the move. Whips are the same shape, harder (build ×2.0, stop ×0.53).

| event | frames | path | speed (px/mf) | ease |
|---|---|---|---|---|
| comp-board pan (S12) | n1008–n1014 | ≈ (−405, −327) px, from the "PHOTO FRAME" label (estimated) | ~87 mean; n1009–n1012 smeared | too blurred to fit |
| screen whip left (S13) | n1043–n1062 | cat x 618 → 32 (~590 px) | −2, −5, −8, −12, −18.5, −28, −46, −95, **−186 (n1053)**, −89, −44, −27, −15, −6, −4, −2.5 | build ×1.5–2.0, stop ×0.5 |
| screen whip right (S13) | n1087–n1097 | ~135 px right | peak ~65 px/mf at n1092 (x-smear) | settles n1093–n1097 |
| map pan right + push (S19) | n1412–n1421 | ~76 px, +8.5 % | peak 35.4 px/mf, +4.0 %/mf (n1417) | bell |
| map whip left (S19) | n1437–n1453 | ~137 px left | −0.5, −1.4, −2.7, −4.9, −8.6, −17.7, **−48.4 (n1444)**, −28.1, −11.3, −6.2, −3.6, −2.2, −1.0 | build ×2.04 (r² 0.99), stop ×0.53 (r² 0.99); σx 7.8–8.6 at the peak (0.16 × speed) |
| map pans (S17) | n1305–n1350 | left, then right, then up-left | peaks −24 (n1312, +2 %/mf), +34.4 (n1329), (−10, −16) (n1344) | build ×1.70/×1.75, stop ×0.61/×0.57 |
| poster pan right (S23) | n1669–n1691 | ~106 px | 0.6, 0.9, 1.6, 2.8, 4.5, 7.0, 13.5, **30.9 (n1678)**, 20.0, 9.4, 5.3, 3.8, 2.5, 1.6, 0.9, 0.5, 0.1 | build ×1.75, stop ×0.56 |

## 5 · Camera per shot

Phases from `data/segments.json` (masked chain; scale = product over the phase, d = centre travel of the content in px).
Shake = rms of the path residual after a 9-mf moving average (> ~2.7 Hz), on the long live shots.

- **S01 n0–n347 FPV plate** (279 mf, one continuous drone move): creep push +0.39 %/mf, drift < 1 px/mf (n0–n52, ×1.18)
  → push builds +1.1 → +4.7 %/mf (n53–n60) → covered by the title zoom (n61–n69) → fast flight +4.6 %/mf (n70–n87,
  ×1.88; on n71–n75 the fit follows a near leaf leaving left at −11…−24 px/mf while the far canopy barely moves, then
  push + tilt, content up −4…−17 px/mf) → through foliage (n88–n111, ✗,
  ×2.06) → over the pool +2.75 %/mf easing to +1.6 (n112–n140, ×1.87) → descends/orbits to the climber +0.77 %/mf, d
  (+199, −176) (n141–n250, ×1.96) → settles while he reads (1.7 px/mf, n251–n270) → drifts right/down (+1.1, +0.8)
  px/mf with +0.18 %/mf to the cut (n271–n347). Shake rms 2.5/2.9 px: gimbal-smooth. Out: (+1.2, +0.5) px/mf, +0.25 %/mf.
- **S02 n348–n363 backpack**: near-static, drift ≤ 2.5 px/mf, scale 0.994. No repeats beyond cadence.
- **S03 n364–n381 zipper CU**: the frame looks locked; the hands move (fits follow the hands, ✗).
- **S04 n382–n660 sitting wide**: opening wobble up −10 px/mf (n383–n389); **quick tilt up to his face** n390–n396
  (content down +19 → +35 → +22 px/mf, peak n393, with a lateral jerk at n391–n392 ✗); **slow push-in +0.34 %/mf**
  n397–n497 (×1.32, subject jacket 211 → 234 px); pixel-fire VFX n498–n530 (not measurable); hold/drift ≤ 0.5 px/mf to
  n660. Shake rms 4.1/4.1 px. Holds at n468, n618.
- **S05 n661–n697 card**: copy block only — entry 22.7 px/mf up (r 0.77), drift, exit expo-in to 17.5 (4.2, 4.3).
- **S06 n698–n775 AE window**: snap-up (smear on n698, then window-edge steps 27, 19.5, 13, 10.5, 7.5 … px/mf, r 0.79),
  the UI holds while the comp
  animates (its zoom readings ✗ are the badge, not the camera), drift right +1.3 → +6.7 px/mf (n756–n762), stop
  (n768–n769), whip left (−4.5, −1.9, −5.7, −33 px/mf, n771–n774).
- **S07 n776–n806 AE timeline**: whip-in decay −24.2 → −2.7 px/mf (r 0.80); drift ~2 px/mf; push-in build +0.4, +0.6,
  +1.1, +2.2, +8.6 %/mf (n801–n806).
- **S08 n807–n846 AE UI**: push-in decays +3.1 → +0.1 %/mf (r 0.79, ×1.10 total); hold with a drift down building to
  +2.8 px/mf at n846.
- **S09 n847–n927 jungle run**: handheld tracking (parallax: 48/61 steps ✗). Foreground trunk wipes off left (n847–n860,
  −17 px/mf avg), background flows left ~7 px/mf (n861–n900), the runner drifts in frame x 741 → 529 → 650 and leaves
  right at n919–n927 (jacket centroid). Shake rms 4.9/2.8 px. Hold at n852.
- **S10 n928–n972 card**: entry 26.9 px/mf (r 0.76), drift 0.6 px/mf, exit expo-in to 17.5.
- **S11 n973–n993 AE project window**: snap-up (smear, then 38.6, 24.9, 18.4, 14.2, 10.8 … px/mf, r 0.78, 237 px in
  total), then the pull-out builds −0.4 → −0.9 → −4.0 %/mf into the cut (window width, n986–n993).
- **S12 n994–n1034 AE comp board**: pull-out settle 116 % → 100 % (r 0.73, n994–n1002); in-viewer whip n1008–n1014
  (≈ −405, −327 px, estimated; frames smeared); hold (≤ 0.7 px/mf, n1015–n1027); diagonal push build to 136 px/mf +5 %/mf
  (n1028–n1033).
- **S13 n1035–n1102 AE timeline + viewer**: diagonal push decay (r 0.35, n1036–n1042); screen whip left n1043–n1062
  (~590 px, peak 186 px/mf at n1053, cat landmark); slow drift −1.8 px/mf (n1063–n1080); the viewer plays the sticker comp
  (n1081–n1086, not a camera move); whip right n1087–n1097 (~135 px, peak ~65 px/mf); hold.
- **S14 n1103–n1233 rope bridge**: wide — the camera trucks with the runner, content left ~9 px/mf (13 → 3 px/mf), slow
  push +0.54 %/mf (n1104–n1181, ×1.40, jacket held at x ≈ 360–440); **crash push-in to his face** n1182–n1208: +1.7 →
  +13.5 %/mf (peak n1191–n1198), content (+13, +13) px/mf, **×5.6 in 23 mf (0.96 s)**, jacket size 84 → 335 px; then a
  handheld close-up with a **running bob**: y path 0, +12, +31, +36, +16, −14, −37, −33, −13, +8, +15, +7, 0, −24,
  −33, −14, +31, +71, +71, +58, +36 px (n1209–n1233): p2p ~80 px y at ~3.4 Hz, ~50 px x. Holds at n1132, n1162, n1222.
- **S15 n1234–n1256 feet**: low tracking shot, subject motion blur (✗); ends on a fast move (~40–53 px/mf, n1254–n1256).
- **S16 n1257–n1293 card**: entry 20.2 px/mf (r 0.76), drift, exit expo-in to 17.6.
- **S17 n1294–n1361 island map**: enters sliding up (18 → 2.5 px/mf, r ≈ 0.62–0.75), bell re-frames — pan left peak −24
  px/mf with +2 %/mf push (n1312), pan right peak +34.4 (n1329), up-left (−10, −16) (n1344) — then ease-in up into the
  card (−0.1 → −12.4 px/mf over n1351–n1361, ×1.78/mf). ncc ≥ 0.99 throughout.
- **S18 n1362–n1398 card**: chip pop, copy entry 11.1 px/mf (r 0.78), drift, exit expo-in to 17.5.
- **S19 n1399–n1486 trail map**: enters drifting up 2 px/mf; bell re-frames — pan right + push (35.4 px/mf, +4.0 %/mf,
  n1417), tilt (content down 14.6 px/mf + 2.8 %/mf, n1429), **whip left** (48.4 px/mf, n1444), pull-out bump (content
  up −12.3 px/mf n1459, −5.6 %/mf n1462), pan right (17.6 px/mf, n1476); settles to 0.3 px/mf. ncc ≥ 0.97.
- **S20 n1487–n1522 collapse**: handheld while he slumps (✗): drift right ~4.6 px/mf, shake rms 6.3/3.9 px. Hold n1503.
- **S21 n1523–n1530 arrow ECU**: locked on the arrow (tip held within ±30 px, grows ~+2 %/mf, ✗); background a pure streak.
- **S22 n1531–n1650 arrow in the wall**: whip-in snap stop (−84 → 0 px in 4 mf), then static (0.4–1.6 px/mf; he flinches
  and opens the laptop, ✗ on 22/47 steps n1539–n1600); dead still n1601–n1650 (0.4 px/mf). Hold n1579.
- **S23 n1651–n1799 Sun Gate poster**: static comp with bell re-frames — content left −8.9 px/mf + glow pop (n1657–n1662,
  ✗), **pan right peak 30.9 px/mf (n1678)**, push bump +1 %/mf (n1701), tilt/pull (content up −8.9 px/mf, −1.5 %/mf,
  n1726), content down +7.6 (n1747), pan left −13.3 (n1767); camera dead still n1774–n1799 (≤ 0.01 px/mf; off-phase
  repeats n1777, n1778, n1781, n1788, n1796–n1798 while the last badge pops).
- **S24 n1800–n1904 cave**: slow pull-back ×0.41 over the shot: −5.8 %/mf on the first step, −1.9 %/mf average
  n1801–n1830 (×0.63), −0.7 %/mf after (×0.65); content drifts down +2…+5 px/mf (camera rising). Shake rms 1.5/2.2 px.
  Holds n1827, n1857.
- **S25 n1905–n1932 download card**: chip entry 22.6 px/mf (r 0.81), then holds drifting 0.9 px/mf; no exit move.
- **S26 n1933–n2174 walk-out**: opens on an ease-out pan (content left 6.7 → 0 px/mf by n1943, r 0.70), tilt down
  (content up −4…−8 px/mf, n1946–n2000, 171 px), then a **steady pull-back −0.5…−0.65 %/mf for 140 mf** (×0.45) as he
  walks away (jacket 251 → 47 px). Shake rms 1.6/1.2 px.
- **S27 n2175–n2295 end card**: static.

Letterboxing / aspect: none — every shot fills 1080×608 (the dark bottom rows at n847–n853 and the dark top rows on the
end card are picture content, not bars). No speed ramps were found inside the live shots (no frame-rate changes other
than the global 24→30 cadence and the holds listed in §1).

## 6 · The editor's grammar

1. **24p, cut on whole master frames.** Cards last 30 mf (1.25 s; the two-line card 36 mf, the download card 23 mf).
   Shots run 6 mf (the arrow) to 279 mf (the opening plate); the median is 1.5 s.
2. **Live action is cut hard.** No dissolves, flashes or blur ramps on live ↔ live or live ↔ screen cuts. Each AI clip
   keeps its own camera (smooth: shake rms 1.5–6 px; the bridge close-up's running bob, ~80 px p2p at 3.4 Hz, is the
   one rough move), and the cut lands where the incoming clip already moves (a
   foreground wipe, a truck, a collapse, a whip with the arrow).
3. **Screen-side cuts are momentum cuts, and the direction is kept**: up (cards), left (whip), in (n807, n1035) or out
   (n994). Out: exponential ease-in to a peak on the last frame (×1.3/mf for cards, ×1.4–2.9 for zooms, ×3–6 on the
   last two frames of the whip-left). In:
   the new shot starts at speed in the same direction and eases out (×0.73–0.80/mf for slides and pushes, ×0.35 for the
   diagonal push, ×0.2 for the arrow whip). Incoming is often faster than outgoing (n698, n973 snap-ups), once exactly
   matched (n1294).
4. **Cards are a preset**: hard cut in, copy ~25 px low, σy ≈ 10, half contrast, slides up (r ≈ 0.77/mf) and sharpens in
   6 mf, drifts up the whole time, leaves at 17.5 px/mf with σy 3.8. The shot after a card arrives moving up.
5. **In-screen re-frames are asymmetric bells** (build ×1.75, stop ×0.57 per mf), peaks 18–48 px/mf on comps and
   186 px/mf on the timeline whip — they read as "screen recording zoom/pan" moves.
6. **Blur is motion blur**: σ ≈ 0.2 × speed along the move on clean frames (card exit 0.21, map whip 0.16); the heaviest
   blur sits on the **first frame after** a zoom/whip cut (n807, n994, n1035, n1531) or on a single smeared frame
   (n698, n776, n973, n993); the outgoing frame before a push (n806) is sharp.
7. **No RGB split, slice glitch, flash frame or light leak between shots.** All the "fx" is motion smear.
8. **Screens never hold still** until the payoff: cards drift ≥ 0.6 px/mf, comps keep re-framing; only the finished
   Sun Gate poster (n1774–n1799) and the end-card plate are dead still.

## 7 · What could not be measured, and why

- **Camera vs subject in close live action**: S03, S04 n382–n396, S15, S20, S21 and S22 n1539–n1600 are dominated by the
  person moving; the similarity fit (✗) mixes camera and subject. The subject path (`data/subject_blue.json`) is given
  instead where it helps; the camera there is estimated as near-static from the sheets.
- **S09 (jungle run)**: strong foreground parallax — 48/61 steps ✗; only the background flow direction and rough speed
  (~7 px/mf left) are trustworthy.
- **The arrow shot's background speed** (S21): a pure streak; only blur length (≈100–370 px) is measurable, so the
  speed (200–700 px/f30) assumes a 180° shutter.
- **Blur on smeared frames**: track.py fits an isotropic Gaussian; zoom (radial) blur and the smears on n698, n776,
  n807, n973, n993/n994, n1035, n1531 are beyond the model. Its fits there can be confidently wrong (n993: +5.5 % at ncc
  0.96 while the window edges show −4.0 %). Laplacian sharpness and edge positions are given as the reliable measures.
- **Title zoom-through after n66** (letters bigger than the frame) and the plate's own motion under the title (n61–n69).
- **Horizontal pans over the AE timeline**: the colour bars are horizontally uniform, so frame registration can't see x
  motion there (the chain reports a false −184 → +1.6 px/mf stop at n1054–n1056); the cat landmark was used instead.
  The n1009 in-viewer pan is too smeared for any fit: its path is estimated from one label.
- **The comp content inside AE windows** (S06 badge growth, S23 glow pops) moves on its own; those readings are not
  camera and are marked ✗.
- **Overlay timing** (typing, pops, mascots, the IG watermark jumping between top-right and left, e.g. around n275,
  n1620, n1890): agent C's; masked out of the camera fits here.
