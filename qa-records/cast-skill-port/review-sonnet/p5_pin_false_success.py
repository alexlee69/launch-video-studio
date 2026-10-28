from h import *
from PIL import Image
import numpy as np
job = newjob('p5')
# a "candidate" whose background came back light grey (~195) instead of #8a8a8a (138)
im = M.sheet(2560, 1440, 3); a = np.asarray(im).astype(int); a = np.where((a > 100) & (a < 160), a + 60, a)
mine = os.path.join(job, 'light.png'); Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(mine)
rc, out = run(job, 'lock', '--pick', mine, '--go')
print('exit', rc); print(out.strip())
pin = json.load(open(os.path.join(job, 'cast/locked/pin-hero.json')))
print('pin-hero.json panels:', [p[4] for p in pin['panels']], '| bg_after_mean:', pin['bg_after_mean'])
b = np.asarray(Image.open(os.path.join(job, 'cast/locked/hero.png')).convert('L')).astype(float)
print('actual background of the "pinned" hero.png at (200,60):', b[60, 200], '(target 138)')
