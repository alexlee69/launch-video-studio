# 3D fan model shared by the W5 fan measurements. CSS-exact: each card is a W×H element centred on the frame centre
# with transform-origin at its centre and
#   transform: perspective(P) translate3d(X,Y,Z) rotateX(ax) rotateY(ay) rotateZ(az) translateZ(-i*g)
import math, numpy as np
W, H, CX, CY = 1080.0, 608.0, 540.0, 304.0
def rot(ax, ay, az):
    a, b, c = math.radians(ax), math.radians(ay), math.radians(az)
    Rx = np.array([[1, 0, 0], [0, math.cos(a), -math.sin(a)], [0, math.sin(a), math.cos(a)]])
    Ry = np.array([[math.cos(b), 0, math.sin(b)], [0, 1, 0], [-math.sin(b), 0, math.cos(b)]])
    Rz = np.array([[math.cos(c), -math.sin(c), 0], [math.sin(c), math.cos(c), 0], [0, 0, 1]])
    return Rx @ Ry @ Rz
LOCAL = np.array([[-W / 2, -H / 2, 0], [W / 2, -H / 2, 0], [W / 2, H / 2, 0], [-W / 2, H / 2, 0]])  # TL TR BR BL
def project_pts(p, pts, P):
    X, Y, Z, ax, ay, az = p[:6]
    q = pts @ rot(ax, ay, az).T + np.array([X, Y, Z])
    w = 1 - q[:, 2] / P
    return np.stack([CX + q[:, 0] / w, CY + q[:, 1] / w], axis=1), w
def card_quad(p, i, P, sx=1.0, sy=1.0):
    g = p[6]
    loc = LOCAL * np.array([sx, sy, 1]) + np.array([0, 0, -i * g])
    xy, w = project_pts(p, loc, P)
    return xy
