// Where Inter's baseline and cap top sit in a line-height:1 box (fractions of font-size), measured in Chrome.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
const F = w => pathToFileURL(resolve('node_modules/@fontsource/inter/files', `inter-latin-${w}-normal.woff2`)).href;
const html = resolve('tools/metrics.html');
writeFileSync(html, `<!doctype html><style>${[400, 500, 600].map(w => `@font-face{font-family:Inter;font-weight:${w};src:url(${F(w)}) format('woff2')}`).join('')}
body{margin:0} .t{position:absolute;left:0;top:0;font:400 100px/1 Inter;white-space:nowrap}</style>
<div class="t" id="t">H<span id="b" style="display:inline-block;width:1px;height:0;vertical-align:baseline"></span></div>`);
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const p = await b.newPage(); await p.goto(pathToFileURL(html).href); await p.evaluate(() => document.fonts.ready);
const r = await p.evaluate(() => {
  const box = document.getElementById('t').getBoundingClientRect(), base = document.getElementById('b').getBoundingClientRect().top;
  const c = document.createElement('canvas').getContext('2d'); c.font = '400 100px Inter'; const m = c.measureText('H');
  return { boxH: box.height, baseline: base - box.top, capH: m.actualBoundingBoxAscent };
});
console.log(r); await b.close();
