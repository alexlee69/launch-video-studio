# reference vs ours — cuts

higgsfield02.mp4 (reference, 1909 frames) vs film.mp4 (ours, 1909 frames) at 30 fps, frames 0–1908. Reference cuts: the list in /Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/work-B/compare/hand-cuts-22.txt.

**cuts: 22 in the reference — 19 exact, 2 within 1 f, 1 off (n75 +4 f — curves line up at +0 f, check by eye)**

| # | ref frame | time | label | ours | offset | curves | status | note |
|---|---|---|---|---|---|---|---|---|
| 1 | n75 | 0:02.50 | lockup > corridor | n79 | +4 f | +0 f (r 0.82) | off | check by eye: cuts/cut-n0075.png |
| 2 | n96 (listed n97) | 0:03.20 | corridor > plate 1 | n96 | +0 f | +0 f (r 0.82) | exact |  |
| 3 | n231 | 0:07.70 | plate cut | n231 | +0 f | +0 f (r 0.79) | exact |  |
| 4 | n264 | 0:08.80 | plate > chat | n264 | +0 f | +0 f (r 0.98) | exact |  |
| 5 | n312 | 0:10.40 | chat | n312 | +0 f | +0 f (r 0.99) | exact |  |
| 6 | n359 (listed n357) | 0:11.97 | dissolve | n358 | -1 f | +0 f (r 0.94) | ±1 | cuts/cut-n0359.png |
| 7 | n465 | 0:15.50 | chat | n465 | +0 f | +0 f (r 0.96) | exact |  |
| 8 | n510 | 0:17.00 | chat > review card | n510 | +0 f | +0 f (r 0.98) | exact |  |
| 9 | n641 | 0:21.37 | card > close-up | n641 | +0 f | +0 f (r 0.94) | exact |  |
| 10 | n671 | 0:22.37 | close-up > research | n671 | +0 f | +0 f (r 0.83) | exact |  |
| 11 | n719 | 0:23.97 | research > big type | n719 | +0 f | +0 f (r 1.00) | exact |  |
| 12 | n743 | 0:24.77 | big type > thread | n743 | +0 f | +0 f (r 0.99) | exact |  |
| 13 | n845 (listed n843) | 0:28.17 | whip > wall | n846 | +1 f | +1 f (r 0.91) | ±1 | cuts/cut-n0845.png |
| 14 | n922 | 0:30.73 | wall > featured | n922 | +0 f | +0 f (r 0.98) | exact |  |
| 15 | n971 (listed n972) | 0:32.37 | featured > insights | n971 | +0 f | +0 f (r 1.00) | exact |  |
| 16 | n1002 (listed n1000) | 0:33.40 | insights > fan | n1002 | +0 f | +0 f (r 0.91) | exact |  |
| 17 | n1260 | 0:42.00 | fan > cast | n1260 | +0 f | +0 f (r 0.95) | exact |  |
| 18 | n1281 | 0:42.70 | cast > burst | n1281 | +0 f | +0 f (r 1.00) | exact |  |
| 19 | n1531 (listed n1530) | 0:51.03 | phone > plate 2 | n1531 | +0 f | +0 f (r 0.99) | exact |  |
| 20 | n1629 | 0:54.30 | plate 2 > carousel | n1629 | +0 f | +0 f (r 1.00) | exact |  |
| 21 | n1698 | 0:56.60 | carousel > outro | n1698 | +0 f | +0 f (r 0.80) | exact |  |
| 22 | n1787 | 0:59.57 | outro > end card | n1787 | +0 f | +0 f (r 1.00) | exact |  |

Offset = our biggest picture change within ±4 frames minus the reference's; curves = the shift that best lines up the two change curves (a second opinion: when motion next to a cut wins the peak, the curves still line up).
sheet.png and sbs.mp4 show the reference's own frames: private review only.
