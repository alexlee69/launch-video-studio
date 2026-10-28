// Verify-pass tool: open a review sheet, report layout/broken images/cut strips, optionally click the stills of one cut
// and report where the proxy lands. usage: node sheetcheck.mjs <html> <png|-> <width> [--click <cut frame>] [--clip <selector>]
import { createRequire } from 'node:module';
const require = createRequire('/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit/stageD/product-launch-sting/video/lib/');
const { chromium } = require('playwright-core');
const [html, png, w = '1440', ...rest] = process.argv.slice(2);
const opt = k => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : null; };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await (await b.newContext({ viewport: { width: Number(w), height: 1000 }, deviceScaleFactor: 1 })).newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('file://' + html); await p.waitForTimeout(1200);
await p.evaluate(() => Promise.all([...document.images].map(i => { i.loading = 'eager'; return i.decode().catch(() => null); })));
await p.waitForTimeout(400);
const m = await p.evaluate(() => ({
  sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h: document.documentElement.scrollHeight,
  imgs: document.images.length, broken: [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src')),
  strips: document.querySelectorAll('.cutstills').length, tiles: document.querySelectorAll('.cutstills img').length,
  rows: document.querySelectorAll('.cutrow').length,
  cont: [...document.querySelectorAll('.cutcont')].map(e => (e.classList.contains('warn') ? '[warn] ' : '') + e.textContent),
  notes: [...document.querySelectorAll('.cutnote')].length,
  tileBox: (() => { const i = document.querySelector('.cutstills img'); if (!i) return null; const r = i.getBoundingClientRect(); return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), nat: [i.naturalWidth, i.naturalHeight] }; })(),
}));
console.log(JSON.stringify(m, null, 1)); console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no page errors');
if (opt('--click')) {
  const f = Number(opt('--click'));
  const btns = await p.$$(`.cutstills button[aria-label]`);
  for (const bt of btns) {
    const lab = await bt.getAttribute('aria-label'), fm = Number(lab.match(/frame (\d+)/)[1]);
    if (Math.abs(fm - f) > 1) continue;
    await bt.scrollIntoViewIfNeeded(); await bt.click(); await p.waitForTimeout(700);
    const t = await p.evaluate(() => document.getElementById('film').currentTime);
    console.log(`click ${lab} → currentTime ${t.toFixed(4)} s = proxy frame ${Math.floor(t * 30 + 1e-6)} = 60-fps frame ${2 * Math.floor(t * 30 + 1e-6)}`);
  }
}
if (png !== '-') {
  const sel = opt('--clip');
  if (sel) { const el = await p.$(sel); await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: png }); }
  else await p.screenshot({ path: png, fullPage: true });
}
await b.close();
