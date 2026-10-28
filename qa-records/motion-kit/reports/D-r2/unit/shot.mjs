// screenshot a local HTML page (full page) — usage: node shot.mjs <html> <png> [width] [scrollToId]
import { createRequire } from 'node:module';
const require = createRequire('/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit/stageD/product-launch-sting/video/lib/');
const { chromium } = require('playwright-core');
const [html, png, w = '1440', id] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await (await b.newContext({ viewport: { width: Number(w), height: 1000 }, deviceScaleFactor: 1 })).newPage();
await p.goto('file://' + html); await p.waitForTimeout(1500);
await p.evaluate(() => Promise.all([...document.images].map(i => { i.loading = 'eager'; return i.decode().catch(() => null); })));
if (id) { await p.evaluate(x => document.getElementById(x).scrollIntoView(), id); await p.waitForTimeout(300); await p.screenshot({ path: png }); }
else await p.screenshot({ path: png, fullPage: true });
await b.close();
