// Calibrate: apply a known SVG blur sigma to scene B and measure the spread of the 1px vertical divider in the 1080-wide frame.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const p = await b.newPage({ viewport: { width: 1080, height: 608 }, deviceScaleFactor: 1920 / 1080 });
await p.goto(pathToFileURL(resolve('stage.html')).href); await p.evaluate(() => window.ready);
for (const s of [0, 2, 5, 10]) {
  await p.evaluate(s => { window.seek(345); document.getElementById('B')._blur(s, 0); }, s);
  await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const buf = await p.screenshot({ clip: { x: 300, y: 380, width: 160, height: 4 } });
  const { default: zlib } = await import('node:zlib');
  console.log('sigma', s, 'png bytes', buf.length);
  await import('node:fs').then(fs => fs.writeFileSync(`out/blurcal_${s}.png`, buf));
}
await b.close();
