# Compare two per-frame curves {n: value}: per-frame values, speeds, peak speed frame (sub-frame, parabolic), peak speed,
# and the max speed difference in slow stretches. usage (as a module): cmp(name, ref, ours, frames)
import math
def speeds(c, frames):
    return {n + 0.5: c[n + 1] - c[n] for n in frames if n in c and n + 1 in c}
def peak(v):
    if not v: return None, None
    k = max(v, key=lambda t: abs(v[t]))
    a, b = v.get(k - 1), v.get(k + 1)
    if a is None or b is None: return k, v[k]
    y0, y1, y2 = abs(a), abs(v[k]), abs(b); den = y0 - 2 * y1 + y2
    off = 0.5 * (y0 - y2) / den if den < 0 else 0
    return k + off, v[k]
def cmp(name, ref, ours, frames, slow=4.0, show=True):
    vr, vo = speeds(ref, frames), speeds(ours, frames)
    pr, po = peak(vr), peak(vo)
    rows = []
    worst_slow = 0
    for t in sorted(vr):
        if t not in vo: continue
        d = vo[t] - vr[t]
        if abs(vr[t]) < slow: worst_slow = max(worst_slow, abs(d))
        rows.append((t, vr[t], vo[t], d))
    if show:
        print(f'── {name}: peak ref n{pr[0]:.2f} {pr[1]:+.2f}/f  ours n{po[0]:.2f} {po[1]:+.2f}/f  '
              f'Δpeak {po[0] - pr[0]:+.2f} f, speed {100 * (abs(po[1]) / abs(pr[1]) - 1) if pr[1] else 0:+.1f}%  worst slow-drift Δ {worst_slow:.2f}/f')
    return dict(name=name, ref_peak=pr, ours_peak=po, worst_slow=worst_slow, rows=rows)
