# the tracker's blur reading on our render vs the σ the engine applied (camera filter, + block motion blur is not counted)
import json, os
C = os.path.dirname(os.path.abspath(__file__)); R = os.path.expanduser('~/Downloads/launch-videos/hf02-skill/ref/curves')
app = {}
for l in open(os.path.join(C, 'blur-applied.jsonl')):
    if not l.startswith('{'): continue
    r = json.loads(l); sd = (r.get('val') or {}).get('sd')
    sx, sy = (map(float, sd.split()) if sd and r['val']['f'] != 'none' and 'lvB' in r['val']['f'] else (0, 0))
    k = r['s'] * 1080 / 1920            # camera-local px → 1080-wide screen px
    app[r['f'] + 270] = (sx * k, sy * k)
def logf(p):
    if p.endswith('.json'): return {r['n']: r for r in json.load(open(p))}
    return {r['n']: r for r in (json.loads(l) for l in open(p) if l.strip().startswith('{'))}
rows = []
for k in ['A', 'B1f', 'B1r', 'B2f', 'B2r', 'C0f', 'C0r', 'D1f', 'D1r', 'D2f', 'D2r']:
    o = logf(os.path.join(C, f'trk-{k}.json')); rf = logf(os.path.join(R, 'trackA.json' if k == 'A' else f'{k}.log'))
    for n, r in sorted(o.items()):
        ax, ay = app.get(n, (0, 0))
        rows.append((n, k, ax, ay, r['bx'], r['by'], rf.get(n, {}).get('bx'), rf.get(n, {}).get('by')))
rows.sort()
print(' n    track  applied σx σy | tracked ours σx σy | ratio | reference read σx σy')
for n, k, ax, ay, bx, by, rx, ry in rows:
    a, b = max(ax, ay), (bx if ax >= ay else by)
    if a > .5 or max(bx, by) > 1:
        ratio = b / a if a > .3 else float('nan')
        print(f'{n} {k:4s}  {ax:5.2f} {ay:5.2f} | {bx:5.2f} {by:5.2f} | {ratio:4.2f} | {rx if rx is not None else "":>5} {ry if ry is not None else "":>5}')
