// Label layout check over the fan: pill overlaps, pills/lines leaving the frame, at every frame 1026..1125
import { chromium } from '../../node_modules/playwright-core/index.mjs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--force-color-profile=srgb'] });
const p = await b.newPage({ viewport: { width: 1080, height: 608 }, deviceScaleFactor: 1 });
p.on('pageerror', e => console.error('err', e.message));
await p.goto(pathToFileURL(resolve(import.meta.dirname, 'stage-w5.html')).href); await p.evaluate(() => window.ready);
const issues = []; const boxes = {};
for (let n = 1026; n <= 1125; n++) {
  await p.evaluate(n => window.seek(n), n);
  const r = await p.evaluate(() => {
    const S = SCENES.find(d => d.id === 'w5-fan').S;
    return S.labels.map(l => { const q = l.pill.getBoundingClientRect(); return l.pill.style.display === 'none' ? null : [q.left, q.top, q.right, q.bottom]; });
  });
  boxes[n] = r;
  r.forEach((a, i) => {
    if (!a) return;
    if (a[0] < 8 || a[1] < 8 || a[2] > 1072 || a[3] > 600) issues.push(`n${n} label${i} near/outside frame ${a.map(v => v.toFixed(0))}`);
    r.forEach((c, j) => { if (j <= i || !c) return; const ox = Math.min(a[2], c[2]) - Math.max(a[0], c[0]), oy = Math.min(a[3], c[3]) - Math.max(a[1], c[1]); if (ox > 0 && oy > 0) issues.push(`n${n} labels ${i}&${j} overlap ${ox.toFixed(0)}x${oy.toFixed(0)}`); });
  });
}
console.log(issues.length ? issues.join('\n') : 'no label issues');
console.log('BOXES', JSON.stringify({ 1040: boxes[1040], 1050: boxes[1050], 1055: boxes[1055], 1060: boxes[1060], 1090: boxes[1090] }));
await b.close();
