// Calibrate applied fan blur vs measured edge sigma: render one frame at several applied sigmas.
import { chromium } from '../../node_modules/playwright-core/index.mjs';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
const n = +process.argv[2], sig = process.argv[3].split(',').map(Number), out = resolve(process.argv[4]);
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none', '--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1080, height: 608 }, deviceScaleFactor: 1920 / 1080 });
await p.goto(pathToFileURL(resolve(import.meta.dirname, 'stage-w5.html')).href); await p.evaluate(() => window.ready);
for (const s of sig) {
  await p.evaluate(([n, s]) => { MW5.fanBlur.rows[n - MW5.fanBlur.from] = [s, s]; return window.seek(n); }, [n, s]);
  await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await p.screenshot({ path: join(out, `s${s}_n${String(n).padStart(4, '0')}.png`), clip: { x: 0, y: 0, width: 1080, height: 608 } });
}
await b.close(); console.log('ok');
