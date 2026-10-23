# Homography helpers shared by the W4 motion builders (numpy only).
import numpy as np

def sq2quad(q):
    """unit square (0,0),(1,0),(1,1),(0,1) -> quad q = [(x0,y0),(x1,y1),(x2,y2),(x3,y3)]; returns 3x3 H (u,v,1)->(x,y,w)"""
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = q
    sx = x0 - x1 + x2 - x3; sy = y0 - y1 + y2 - y3
    if abs(sx) < 1e-9 and abs(sy) < 1e-9:
        a, b, c, d, e, f, g, h = x1 - x0, x2 - x1, x0, y1 - y0, y2 - y1, y0, 0.0, 0.0
    else:
        dx1, dx2, dy1, dy2 = x1 - x2, x3 - x2, y1 - y2, y3 - y2
        den = dx1 * dy2 - dx2 * dy1
        g = (sx * dy2 - dx2 * sy) / den; h = (dx1 * sy - sx * dy1) / den
        a = x1 - x0 + g * x1; b = x3 - x0 + h * x3; c = x0
        d = y1 - y0 + g * y1; e = y3 - y0 + h * y3; f = y0
    return np.array([[a, b, c], [d, e, f], [g, h, 1.0]])

def rect2quad(W, H, q):
    return sq2quad(q) @ np.diag([1.0 / W, 1.0 / H, 1.0])

def apply(Hm, x, y):
    v = Hm @ np.array([x, y, 1.0]); return v[0] / v[2], v[1] / v[2]

def inv_apply(Hm, x, y):
    return apply(np.linalg.inv(Hm), x, y)
