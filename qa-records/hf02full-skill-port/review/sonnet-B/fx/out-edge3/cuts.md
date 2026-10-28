# reference vs ours — cuts

ref-edge.mp4 (reference, 120 frames) vs ours-late-edge.mp4 (ours, 120 frames) at 30 fps, frames 0–119. Reference cuts: detected here.

**cuts: 2 in the reference — 0 exact, 1 within 1 f, 1 missing (n119 no change in ours)**

| # | ref frame | time | label | ours | offset | curves | status | note |
|---|---|---|---|---|---|---|---|---|
| 1 | n1 | 0:00.03 | — | n2 | +1 f | +1 f (r 1.00) | ±1 | cuts/cut-n0001.png |
| 2 | n119 | 0:03.97 | — | n116 | -3 f | +0 f (r 0.34) | missing | cuts/cut-n0119.png |

Offset = our biggest picture change within ±4 frames minus the reference's; curves = the shift that best lines up the two change curves (a second opinion: when motion next to a cut wins the peak, the curves still line up).
sheet.png and sbs.mp4 show the reference's own frames: private review only.
