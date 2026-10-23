# fly-in landings from the coloured-mascot tracks (listc): the first frame a blob arriving from the left is within 8 px
# of where it rests; the drop's lowest frame. Reference = ref/curves/listc.json, ours = listc-ours.json (+ a green mask)
import json, os
C = os.path.dirname(os.path.abspath(__file__)); R = os.path.expanduser('~/Downloads/launch-videos/hf02-skill/ref/curves')
def land(track, col, lo, hi):
    pts = [(r['n'], r['blobs'][col]['cx']) for r in track if lo <= r['n'] <= hi and col in r['blobs']]
    if not pts: return None
    first = pts[0][0]
    rest = dict(pts).get(first + 10) or pts[-1][1]
    for n, x in pts:
        if x >= rest - 8: return n
def bottom(track, col, lo, hi):
    pts = [(r['blobs'][col]['cy'], r['n']) for r in track if lo <= r['n'] <= hi and col in r['blobs']]
    return max(pts)[1] if pts else None
ref = json.load(open(os.path.join(R, 'listc.json'))); ours = json.load(open(os.path.join(C, 'listc-ours.json')))
res = {
  'row 0 drop, lowest frame (blue)': (bottom(ref, 'blue', 358, 378), bottom(ours, 'blue', 358, 378)),
  'row 1 lands (orange)': (land(ref, 'orange', 393, 405), land(ours, 'orange', 393, 405)),
  'row 4 lands (ref blue / ours green)': (land(ref, 'blue', 431, 437), land(ours, 'green', 429, 437)),
  'row 5 lands (purple)': (land(ref, 'purple', 435, 442), land(ours, 'purple', 433, 442)),
}
for k, (a, b) in res.items(): print(f'{k:40s} ref n{a}  ours n{b}  Δ {b - a:+d}' if a and b else f'{k}: ref {a} ours {b}')
json.dump(res, open(os.path.join(C, 'landings.json'), 'w'))
