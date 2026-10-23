// Font calibration: which Inter size/weight reproduces each measured ink width in the reference (source px, 1080x608).
// Only used to size our own copy; the reference strings never reach the stage.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const FONT = w => pathToFileURL(resolve('node_modules/@fontsource/inter/files', `inter-latin-${w}-normal.woff2`)).href;
const items = JSON.parse(process.argv[2]);   // [{id, text, ink, cap}]  ink = measured ink width, cap = measured cap height (optional)
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage();
import { writeFileSync } from 'node:fs';
const html = resolve('tools/calib.html');
writeFileSync(html, `<!doctype html><style>${[400, 500, 600, 700].map(w => `@font-face{font-family:Inter;font-weight:${w};src:url(${FONT(w)}) format('woff2')}`).join('')}</style>
  <div style="font-family:Inter">${[400, 500, 600, 700].map(w => `<span style="font-weight:${w}">x</span>`).join('')}</div>`);
await page.goto(pathToFileURL(html).href);
await page.evaluate(() => document.fonts.ready);
const ok = await page.evaluate(() => [400, 500, 600, 700].map(w => document.fonts.check(`${w} 16px Inter`) && [...document.fonts].some(f => f.weight == String(w) && f.status === 'loaded')));
console.log('fonts loaded', ok);
const res = await page.evaluate(items => {
  const c = document.createElement('canvas').getContext('2d');
  return items.map(it => {
    const row = { id: it.id };
    for (const w of [400, 500, 600, 700]) {
      c.font = `${w} 100px Inter`;
      const m = c.measureText(it.text);
      const ink = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      const size = 100 * it.ink / ink;
      row[w] = { size: +size.toFixed(2), cap: +(0.727 * size).toFixed(1), adv: +(m.width * size / 100).toFixed(1) };
    }
    return row;
  });
}, items);
for (const r of res) console.log(r.id.padEnd(14), [400, 500, 600, 700].map(w => `${w}: ${r[w].size}px cap ${r[w].cap}`).join(' | '),
  items.find(i => i.id === r.id).cap ? `  (measured cap ${items.find(i => i.id === r.id).cap})` : '');
await browser.close();
