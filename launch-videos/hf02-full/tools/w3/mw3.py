# helpers: read motion/w3.js tables (dumped to tools/w3/mw3.json by node) and evaluate them like core.js trk()/vel()
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
def load():
    os.system("cd '%s/../..' && node -e \"global.window={}; require('./motion/w3.js'); require('fs').writeFileSync('tools/w3/mw3.json', JSON.stringify(window.MW3))\"" % HERE)
    return json.load(open(os.path.join(HERE, 'mw3.json')))
def trk(t, n):
    ks = sorted((float(k), v) for k, v in t.items())
    if n <= ks[0][0]: return ks[0][1]
    if n >= ks[-1][0]: return ks[-1][1]
    for i in range(1, len(ks)):
        if n <= ks[i][0]:
            (a, va), (b, vb) = ks[i - 1], ks[i]; return va + (vb - va) * (n - a) / (b - a)
def vel(t, n): return trk(t, n + 0.5) - trk(t, n - 0.5)
