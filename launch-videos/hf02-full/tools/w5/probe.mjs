// Read element boxes from the W5 stage at given frames: node tools/w5/probe.mjs 1040,1055 → JSON of label pill rects
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
  out[n] = await p.evaluate(() => {
    const S = SCENES.find(d => d.id === 'w5-fan').S;
    return S.labels.map(l => { const r = l.pill.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom, l.pill.style.display]; });
  });
}
console.log(JSON.stringify(out)); await b.close();
