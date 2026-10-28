# reference vs ours — cuts

ref30.mp4 (reference, 30 frames) vs ours60.mp4 (ours, 30 frames) at 30 fps, frames 0–29. Reference cuts: detected here.

**cuts: none in the reference over this range**

- ours runs at 60 fps, the reference at 30: reference frame i is compared with our frame 2·i (the frames conform.py --fps 30 keeps)

| # | ref frame | time | label | ours | offset | curves | status | note |
|---|---|---|---|---|---|---|---|---|

Offset = our biggest picture change within ±4 frames minus the reference's; curves = the shift that best lines up the two change curves (a second opinion: when motion next to a cut wins the peak, the curves still line up).
sheet.png and sbs.mp4 show the reference's own frames: private review only.
