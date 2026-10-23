// Debug: load the stage, seek a frame, dump the scene's children rects + any errors.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const [n, scene] = [Number(process.argv[2] || 300), process.argv[3] || 'A'];
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const p = await b.newPage({ viewport: { width: 1080, height: 608 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message)); p.on('console', m => console.log('console', m.type(), m.text()));
await p.goto(pathToFileURL(resolve('stage.html')).href); await p.evaluate(() => window.ready);
const r = await p.evaluate(([n, scene]) => {
  window.seek(n);
  const cam = document.getElementById(scene + 'cam');
  return { display: ['A', 'B', 'C', 'D'].map(id => id + ':' + getComputedStyle(document.getElementById(id)).display), cam: cam.style.transform,
    kids: [...cam.children].map(k => { const r = k.getBoundingClientRect(); return `${k.className.padEnd(6)} ${(k.textContent || '').slice(0, 28).padEnd(28)} x${Math.round(r.left)} y${Math.round(r.top)} w${Math.round(r.width)} h${Math.round(r.height)}`; }) };
}, [n, scene]);
console.log(JSON.stringify(r, null, 1)); await b.close();
