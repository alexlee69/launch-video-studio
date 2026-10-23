// screenshot any local html page at 1920x1080 (1080x608 css): node tools/shot.mjs page.html out.png
import { chromium } from 'playwright-core'; import { pathToFileURL } from 'node:url'; import { resolve } from 'node:path';
const [pg, out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--force-color-profile=srgb'] });
const p = await b.newPage({ viewport: { width: 1080, height: 608 }, deviceScaleFactor: 1920 / 1080 });
p.on('pageerror', e => console.error('err', e.message));
await p.goto(pathToFileURL(resolve(pg)).href); await p.evaluate(() => window.ready); await p.waitForTimeout(300);
await p.screenshot({ path: out, clip: { x: 0, y: 0, width: 1080, height: 608 } }); await b.close(); console.log(out);
