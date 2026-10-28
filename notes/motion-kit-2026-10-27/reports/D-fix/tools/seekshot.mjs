// click each still of one cut strip, then screenshot the video element (what the reviewer sees): node seekshot.mjs <html> <shot> <outPrefix>
import { createRequire } from 'node:module';
const require = createRequire('/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit/stageD/product-launch-sting/video/lib/');
const { chromium } = require('playwright-core');
const [html, shot, out] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })).newPage();
await p.goto('file://' + html); await p.waitForTimeout(1200);
const bs = p.locator(`.cutstills button[aria-label*="(${shot})"]`).first().locator('xpath=..').locator('button');
for (let i = 0; i < await bs.count(); i++) {
  await bs.nth(i).click(); await p.waitForTimeout(900); await p.mouse.move(5, 990); await p.waitForTimeout(600);
  await p.locator('#film').screenshot({ path: `${out}-${i}.png` });
  console.log(await bs.nth(i).getAttribute('aria-label'), (await p.evaluate(() => document.getElementById('film').currentTime)).toFixed(4));
}
await b.close();
