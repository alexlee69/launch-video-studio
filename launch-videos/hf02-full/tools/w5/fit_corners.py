import sys, json, numpy as np
sys.path.insert(0, sys.path[0])
from fan import card_quad
from nm import nm_restart
# manual corner readings at n1080 (frame px): (card index, corner 0=TL 1=TR 2=BR 3=BL, x, y)
R = [(0, 0, 236.0, 237.3), (0, 3, 246.7, 390.0), (0, 2, 366.7, 485.0),
     (1, 0, 286.0, 231.7), (2, 0, 333.3, 220.7), (3, 0, 385.0, 214.3), (4, 0, 435.0, 207.3),
     (1, 2, 418.3, 471.7), (2, 2, 470.0, 458.3), (3, 2, 525.0, 443.3)]
best = None
for P in (500, 700, 900, 1200, 1600, 2400, 4000):
    def f(p):
        e = 0
        for i, c, x, y in R:
            q = card_quad(p, i, P)[c]; e += (q[0] - x) ** 2 + (q[1] - y) ** 2
        return e
    for ay0 in (-50, -65, -75):
        for z0 in (-800, -1500):
            p, v = nm_restart(f, [-200, 60, z0, -10, ay0, 10, 150], [100, 50, 300, 10, 10, 10, 50], rounds=5, iters=2000)
            rms = (v / len(R)) ** 0.5
            if best is None or rms < best[0]: best = (rms, P, p)
            print('P', P, 'rms %.2f' % rms, np.round(p, 2).tolist())
print('BEST', best[0], best[1], np.round(best[2], 3).tolist())
