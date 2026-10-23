# Front card of the deck (n555-622), per frame, using the reference's own geometry: every card turns about Y only and the
# horizon sits at the frame centre (y = 304; verified: top and bottom edges of the front card meet at y = 304.0-305 in B1).
# So: left/right edges are vertical-ish lines, and for any column, (y_bot - 304) = k * (y_top - 304) with one k per frame.
#   right edge: quad.py R line;  top edge: robust line left of the right edge (deckmeas ct);  left edge x: deckmeas TL x;
#   k: from the bottom profile just right of the left edge (where the bubble never reaches), else interpolated in time.
# usage: deckfront.py <sil.jsonl> <deckm.json> <out.json> <qB.json>
import sys, json
import numpy as np
CY = 304.0
sil = {}
for l in open(sys.argv[1]):
    r = json.loads(l); sil[r['n']] = r
D = {int(k): v for k, v in json.load(open(sys.argv[2])).items()}
QB = {r['n']: r for r in json.load(open(sys.argv[4]))}
def arr(v): return np.array([np.nan if x is None else x for x in v])
res = {}
for n in sorted(D):
    d = D[n]; R = QB[n]['R']; ct = d['ct']
    if ct is None or d['TL'] is None: continue
    xl = d['TL'][0]
    ytop = lambda x: ct[0] * x + ct[1]
    TR = d['TR']
    b = arr(sil[n]['bot'])
    xs = np.arange(int(xl + 6), int(xl + 36))
    yb = b[xs]; ok = np.isfinite(yb) & (yb > 2) & (yb < 605)
    k = None
    if ok.sum() >= 10:
        ks = (yb[ok] - CY) / (ytop(xs[ok]) - CY); k = float(np.median(ks))
    res[n] = dict(xl=xl, TR=TR, ct=ct, R=R, k=k)
# k over time: measured where available; check B1 consistency against the deckmeas bottom line, interpolate the gaps
ns = sorted(res)
for n in ns:
    d = D[n]; cb = d['cb']
    if cb is not None and n <= 592:
        x = (res[n]['xl'] + res[n]['TR'][0]) / 2
        res[n]['k_line'] = float((cb[0] * x + cb[1] - CY) / (res[n]['ct'][0] * x + res[n]['ct'][1] - CY))
out = {}
for n in ns:
    r = res[n]; print(n, 'xl %.1f' % r['xl'], 'k %s' % (None if r['k'] is None else round(r['k'], 4)), 'k_line %s' % (round(r['k_line'], 4) if 'k_line' in r else '-'))
json.dump({str(n): res[n] for n in ns}, open(sys.argv[3], 'w'))
