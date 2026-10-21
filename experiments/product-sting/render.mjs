// Render the stage with headless Chrome.
//   node render.mjs --stills 40,86,150,230 [--out out/stills] [--debug]
//   node render.mjs --film [--workers 4] [--out out/frames]      (720 frames @ 59.94 = f0..f359.5)
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
const film = !!opt('--film', false);
const stills = opt('--stills', '40,86,150,230');
const out = resolve(here, opt('--out', film ? 'out/frames' : 'out/stills'));
const workers = Number(opt('--workers', 4));
const debug = !!opt('--debug', false);
mkdirSync(out, { recursive: true });

const frames = film
  ? Array.from({ length: 720 }, (_, i) => ({ f: i / 2, name: `${String(i).padStart(5, '0')}.png` }))
  : String(stills).split(',').map(s => ({ f: Number(s), name: `f${String(s).replace('.', '_').padStart(3, '0')}.png` }));

const browser = await chromium.launch({
  channel: 'chrome', headless: true,
  args: ['--force-color-profile=srgb', '--hide-scrollbars', '--disable-lcd-text', '--font-render-hinting=none'],
});
const url = pathToFileURL(join(here, 'stage.html')).href + (debug ? '?debug=1' : '');
const errors = [];

async function openPage() {
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.evaluate(() => window.stageReady);
  // warm every shot once so decoded images and filters are cached before real captures
  for (const f of [10, 80, 130, 170, 200, 230, 280, 320]) {
    await page.evaluate(x => window.seek(x), f);
    await page.screenshot({ clip: { x: 0, y: 0, width: 1080, height: 1080 } });
  }
  return page;
}

const t0 = Date.now();
const pages = await Promise.all(Array.from({ length: film ? workers : 1 }, openPage));
if (film) {
  const typing = await pages[0].evaluate(() => window.TYPING);
  writeFileSync(join(here, 'out', 'timeline.json'), JSON.stringify({ typing }, null, 1));
}
let next = 0, done = 0;
await Promise.all(pages.map(async page => {
  while (next < frames.length) {
    const fr = frames[next++];
    await page.evaluate(x => window.seek(x), fr.f);
    await page.screenshot({ path: join(out, fr.name), clip: { x: 0, y: 0, width: 1080, height: 1080 } });
    if (++done % 60 === 0) process.stdout.write(`  ${done}/${frames.length} frames  ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
  }
}));
await browser.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exitCode = 1; }
console.log(`rendered ${frames.length} frame(s) → ${out} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
