// Verify-pass tool: click each still of one cut on a review sheet, then screenshot the player (controls off) so the
// shown frame can be compared with the film's PNG frames. usage: node seekshot.mjs <html> <cut frame> <outdir>
import { createRequire } from 'node:module';
const require = createRequire('/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit/stageD/product-launch-sting/video/lib/');
const { chromium } = require('playwright-core');
const [html, cutF, out] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })).newPage();
await p.goto('file://' + html); await p.waitForTimeout(1500);
for (const bt of await p.$$('.cutstills button[aria-label]')) {
  const lab = await bt.getAttribute('aria-label'), f = Number(lab.match(/frame (\d+)/)[1]);
  if (Math.abs(f - Number(cutF)) > 1) continue;
  await bt.scrollIntoViewIfNeeded(); await bt.click();
  await p.waitForFunction(() => { const v = document.getElementById('film'); return !v.seeking && v.readyState >= 2; }); await p.waitForTimeout(500);
  const t = await p.evaluate(() => { const v = document.getElementById('film'); v.controls = false; return v.currentTime; });
  await p.waitForTimeout(200);
  await (await p.$('#film')).screenshot({ path: `${out}/seek-${f}.png` });
  const sz = await p.evaluate(() => { const r = document.getElementById('film').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
  console.log(`${lab} → ${t.toFixed(4)} s, player ${sz.join('×')} → ${out}/seek-${f}.png`);
  await p.evaluate(() => { document.getElementById('film').controls = true; });
}
await b.close();
