// Inspect the stage at a frame: evaluate a JS expression after seek(n).
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
const ROOT = resolve(import.meta.dirname, '..', '..');
const [n, expr] = [+process.argv[2], process.argv[3]];
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 608 } });
page.on('pageerror', e => console.error('[pageerror]', e.message));
page.on('console', m => console.log('[console]', m.text()));
await page.goto(pathToFileURL(join(ROOT, 'stage.html')).href);
await page.evaluate(() => window.ready);
await page.evaluate(n => window.seek(n), n);
console.log(JSON.stringify(await page.evaluate(expr), null, 1));
await browser.close();
