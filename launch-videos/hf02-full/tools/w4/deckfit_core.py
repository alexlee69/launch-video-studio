# The deck model shared by deckfit.py (fit) and deckviz.py (overlay) — keep in sync with the JS in scenes/w4-cards.js.
import math
import numpy as np
W, H = 582.0, 505.0; CX, CY = 540.0, 304.0
def front(n): return 1 + (n - 555) // 2
def rot(ty, tx, tz):
    cy, sy, cx, sx, cz, sz = math.cos(ty), math.sin(ty), math.cos(tx), math.sin(tx), math.cos(tz), math.sin(tz)
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]); Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Ry @ Rx @ Rz
OFF = np.array([[-W / 2, -H / 2, 0], [W / 2, -H / 2, 0], [W / 2, H / 2, 0], [-W / 2, H / 2, 0]]).T
def cards(pose, G, k):
    """screen quads (TL,TR,BR,BL) for cards k..0 (front first) given the front card's pose and globals"""
    X, Y, Z, ty, tx, tz = pose; P, dx, dy, dz = G[:4]
    R = rot(math.radians(ty), math.radians(tx), math.radians(tz))
    C = np.array([X, Y, Z]); D = R @ np.array([dx, dy, dz])
    qs = []
    for m in range(k + 1):
        Cj = C - m * D
        pts = Cj[:, None] + R @ OFF
        z = pts[2]; s = P / (P - z)
        qs.append(np.stack([CX + pts[0] * s, CY + pts[1] * s], 1))
    return qs
