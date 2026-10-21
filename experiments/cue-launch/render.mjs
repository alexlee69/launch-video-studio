// node render.mjs --stills 60,160,250 [--out out/stills] [--debug]
// node render.mjs --film [--workers 4]        → out/frames/00000.png … 01199.png (f0..f599.5 at 60 fps)
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(pathToFileURL(join(here, '../product-sting/node_modules/playwright-core/index.mjs')).href);
const argv = process.argv.slice(2), has = k => argv.includes(k), opt = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
const film = has('--film');
const out = resolve(here, opt('--out', film ? 'out/frames' : 'out/stills')); mkdirSync(out, { recursive: true });
const range = opt('--range', null)?.split(',').map(Number);           // --range 330,380 re-renders only those 60-fps indices
const frames = film ? Array.from({ length: 1200 }, (_, i) => ({ f: i / 2, i, name: `${String(i).padStart(5, '0')}.png` })).filter(x => !range || (x.i >= range[0] && x.i <= range[1]))
  : String(opt('--stills', '60,160,250,360,480,570')).split(',').map(s => ({ f: Number(s), name: `f${String(s).replace('.', '_').padStart(3, '0')}.png` }));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--force-color-profile=srgb', '--hide-scrollbars', '--font-render-hinting=none'] });
const url = pathToFileURL(join(here, 'stage.html')).href + (has('--debug') ? '?debug=1' : '');
const errs = [];
async function open() {
  const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(url); await page.evaluate(() => window.stageReady);
  for (const f of [40, 130, 220, 330, 450, 560]) { await page.evaluate(x => window.seek(x), f); await page.screenshot(); }
  return page;
}
const t0 = Date.now();
const pages = await Promise.all(Array.from({ length: film ? Number(opt('--workers', 4)) : 1 }, open));
const logPath = join(here, 'out', 'shots.json');                 // which shot produced each written frame
const shotLog = film && existsSync(logPath) ? JSON.parse(readFileSync(logPath, 'utf8')) : [];
let next = 0, done = 0;
await Promise.all(pages.map(async page => {
  while (next < frames.length) {
    const fr = frames[next++];
    const shotId = await page.evaluate(x => window.seek(x), fr.f);
    await page.screenshot({ path: join(out, fr.name) });
    if (film) shotLog[fr.i] = shotId;
    if (++done % 120 === 0) console.log(`  ${done}/${frames.length}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
}));
await browser.close();
if (film) writeFileSync(logPath, JSON.stringify(shotLog));
if (errs.length) { console.error('PAGE ERRORS:\n' + errs.join('\n')); process.exitCode = 1; }
console.log(`rendered ${frames.length} → ${out} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
