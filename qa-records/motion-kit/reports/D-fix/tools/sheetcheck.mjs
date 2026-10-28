// Worker D fix pass: load a review sheet page (file://) like a viewer, report what a reviewer would hit, screenshot it.
// usage: node sheetcheck.mjs <html> <png> [width] [rowShotId] [clickCutOf]
//   prints: page errors, horizontal overflow, cut strips / cut images (loaded vs broken), failed requests;
//   rowShotId: screenshot just that shot's row (else the full page); clickCutOf: click each still of that shot's cut strip
//   and print the proxy time it seeks to (and the 60-fps frame the 30-fps proxy shows there)
import { createRequire } from 'node:module';
const require = createRequire('/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit/stageD/product-launch-sting/video/lib/');
const { chromium } = require('playwright-core');
const [html, png, w = '1440', rowId, clickOf] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await (await b.newContext({ viewport: { width: Number(w), height: 1000 }, deviceScaleFactor: 1 })).newPage();
const errs = [], failed = [];
p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
p.on('requestfailed', r => failed.push(r.url().split('/').slice(-2).join('/') + ' (' + (r.failure()?.errorText || '?') + ')'));
await p.goto('file://' + html); await p.waitForTimeout(1200);
await p.evaluate(() => Promise.all([...document.images].map(i => { i.loading = 'eager'; return i.decode().catch(() => null); })));
await p.waitForTimeout(500);
const m = await p.evaluate(() => {
  const cut = [...document.querySelectorAll('.cutstills img')];
  return { scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth, strips: document.querySelectorAll('.cutstills').length,
    rows: document.querySelectorAll('.cutrow').length, notes: document.querySelectorAll('.cutnote').length, warnLines: document.querySelectorAll('.cutcont.warn').length,
    cutImgs: cut.length, loaded: cut.filter(i => i.complete && i.naturalWidth > 0).length, broken: [...document.images].filter(i => i.complete && !i.naturalWidth).map(i => i.getAttribute('src')),
    tile: cut[0] ? (r => ({ w: Math.round(r.width), h: Math.round(r.height) }))(cut[0].getBoundingClientRect()) : null };
});
console.log(JSON.stringify(m)); console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no page errors'); console.log(failed.length ? 'failed requests: ' + [...new Set(failed)].join(', ') : 'no failed requests');
if (clickOf) {
  const row = p.locator('.shot').filter({ has: p.locator(`text=Cut into`) }).nth(0);
  const btns = await p.evaluate(id => { const D = JSON.parse(document.getElementById('data')?.textContent || 'null'); return null; }, clickOf);
  const strips = p.locator('.cutrow');
  const n = await strips.count();
  for (let k = 0; k < n; k++) {
    const label = await strips.nth(k).locator('.label').textContent();
    if (!label.includes(`Cut into`)) continue;
    const bs = strips.nth(k).locator('.cutstills button');
    const cnt = await bs.count();
    const aria = cnt ? await bs.nth(0).getAttribute('aria-label') : '';
    if (!aria.includes(`(${clickOf})`)) continue;
    for (let i = 0; i < cnt; i++) {
      await bs.nth(i).click(); await p.waitForTimeout(700);
      const t = await p.evaluate(() => document.getElementById('film').currentTime);
      console.log(`click ${await bs.nth(i).getAttribute('aria-label')} → currentTime ${t.toFixed(4)} s = proxy frame ${Math.floor(t * 30)} = 60-fps frame ${2 * Math.floor(t * 30)}`);
    }
  }
}
if (rowId) { const el = p.locator('.shot').filter({ has: p.locator(`.cutstills button[aria-label*="(${rowId})"]`) }).first(); await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: png }); }
else await p.screenshot({ path: png, fullPage: true });
await b.close();
