// Front-card and back-card projected boxes from the live DOM at given frames (checks the CSS transform against fan.py)
import { chromium } from '../../node_modules/playwright-core/index.mjs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const ns = process.argv[2].split(',').map(Number);
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--force-color-profile=srgb'] });
const p = await b.newPage({ viewport: { width: 1080, height: 608 }, deviceScaleFactor: 1 });
p.on('pageerror', e => console.error('err', e.message));
await p.goto(pathToFileURL(resolve(import.meta.dirname, 'stage-w5.html')).href); await p.evaluate(() => window.ready);
const out = {};
for (const n of ns) {
  await p.evaluate(n => window.seek(n), n);
  out[n] = await p.evaluate(n => {
    const S = SCENES.find(d => d.id === 'w5-fan').S; const row = MW5.pose.rows[Math.round(n) - MW5.pose.from];
    const r0 = S.cards[0].getBoundingClientRect(), r10 = S.cards[10].getBoundingClientRect();
    return { pose: row, front: [r0.left, r0.top, r0.right, r0.bottom], back: [r10.left, r10.top, r10.right, r10.bottom], tf: S.cards[0].style.transform };
  }, n);
}
console.log(JSON.stringify(out)); await b.close();
