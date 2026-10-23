// Screenshot one frame after running an optional JS snippet (debug only).
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
const ROOT = resolve(import.meta.dirname, '..', '..');
const [n, out, js] = [+process.argv[2], process.argv[3], process.argv[4] || ''];
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--force-color-profile=srgb', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 608 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('[pageerror]', e.message));
await page.goto(pathToFileURL(join(ROOT, 'stage.html')).href);
await page.evaluate(() => window.ready);
await page.evaluate(n => window.seek(n), n);
if (js) await page.evaluate(js);
await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1080, height: 608 } });
await browser.close();
