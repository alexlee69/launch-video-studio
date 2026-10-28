// Render the stage with headless system Chrome (playwright-core, channel 'chrome' — nothing is downloaded).
//   node render.mjs --job DIR [--stills 40,86,150,230]   → DIR/out/stills/f040.png … + DIR/out/stills/sheet.png
//   node render.mjs --job DIR --film [--workers 4]       → DIR/out/frames/00000.png … (720 @ 59.94 = f0..f359.5)
//                                                           + DIR/out/timeline.json (typing frames for audio.mjs)
// Frames are in 29.97-fps units; half frames are fine. Set CHROME_PATH to use a Chrome binary that isn't installed
// in the standard place.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SKILL, arg, jobDir, loadBrand } from './brand.mjs';

const argv = process.argv.slice(2);
const job = jobDir(argv);
const film = !!arg(argv, '--film', false);
const stills = String(arg(argv, '--stills', '40,86,150,230'));
const out = join(job, 'out', film ? 'frames' : 'stills');
const workers = Number(arg(argv, '--workers', 4));
const debug = !!arg(argv, '--debug', false);
const { inject } = loadBrand(job, { allowPalette: !!arg(argv, '--allow-palette', false) });
mkdirSync(out, { recursive: true });

const SHOT_NAME = { s1: 'S1 lockup + hub', s2: 'S2 app icon', s3: 'S3 menu bar + prompt', s4: 'S4/S5 answer page + card',
  s6: 'S6 feature cards', s7: 'S7 logo disc', s8: 'S8 end card' };
const frames = film
  ? Array.from({ length: 720 }, (_, i) => ({ f: i / 2, name: `${String(i).padStart(5, '0')}.png` }))
  : stills.split(',').map(s => ({ f: Number(s), name: `f${String(s).replace('.', '_').padStart(3, '0')}.png` }));
if (frames.some(x => !(x.f >= 0 && x.f < 360))) { console.error('stills must be frame numbers in 0–359.5'); process.exit(2); }

let browser;
try {
  browser = await chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }), headless: true,
    args: ['--force-color-profile=srgb', '--hide-scrollbars', '--disable-lcd-text', '--font-render-hinting=none'],
  });
} catch (e) {
  console.error('Could not start Google Chrome (playwright-core channel "chrome"). Install Chrome, or set CHROME_PATH.\n' + e.message);
  process.exit(1);
}
const url = pathToFileURL(join(SKILL, 'stage.html')).href + (debug ? '?debug=1' : '');
const errors = [];
let layout = null;

async function openPage() {
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
  await ctx.addInitScript({ content: `window.BRAND = ${JSON.stringify(inject)};` });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  try { await page.evaluate(() => window.stageReady); }
  catch (e) { console.error('stage failed to build: ' + e.message.split('\n')[0]); await browser.close(); process.exit(1); }
  layout = layout || await page.evaluate(() => window.LAYOUT);
  // warm every shot once so decoded images and filters are cached before real captures
  for (const f of [10, 80, 130, 170, 200, 230, 280, 320]) {
    await page.evaluate(x => window.seek(x), f);
    await page.screenshot({ clip: { x: 0, y: 0, width: 1080, height: 1080 } });
  }
  return page;
}

const t0 = Date.now();
const pages = await Promise.all(Array.from({ length: film ? workers : 1 }, openPage));
for (const w of layout.warnings) console.log('  layout: ' + w);
if (film) {
  const typing = await pages[0].evaluate(() => window.TYPING);
  writeFileSync(join(job, 'out', 'timeline.json'), JSON.stringify({ typing, layout }, null, 1));
}
let next = 0, done = 0;
await Promise.all(pages.map(async page => {
  while (next < frames.length) {
    const fr = frames[next++];
    fr.shot = await page.evaluate(x => window.seek(x), fr.f);
    await page.screenshot({ path: join(out, fr.name), clip: { x: 0, y: 0, width: 1080, height: 1080 } });
    if (++done % 60 === 0) process.stdout.write(`  ${done}/${frames.length} frames  ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
  }
}));

if (!film) {   // review sheet: the stills on a grid, each captioned with its frame and shot
  const cols = frames.length <= 4 ? 2 : 3, rows = Math.ceil(frames.length / cols), CAP = 64;
  const cells = frames.map(fr => `<figure><img src="data:image/png;base64,${readFileSync(join(out, fr.name)).toString('base64')}">
    <figcaption><b>f${fr.f}</b> · ${SHOT_NAME[fr.shot] || fr.shot}</figcaption></figure>`).join('');
  const page = await (await browser.newContext({ viewport: { width: 1080 * cols, height: (1080 + CAP) * rows }, deviceScaleFactor: 1 })).newPage();
  await page.setContent(`<style>
    @font-face{font-family:Inter;font-weight:500;src:url(data:font/woff2;base64,${readFileSync(join(SKILL, 'node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2')).toString('base64')})}
    body{margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},1080px)}
    figure{margin:0}img{display:block;width:1080px;height:1080px}
    figcaption{height:${CAP}px;line-height:${CAP}px;padding-left:28px;font:500 30px Inter,sans-serif;color:#ddd;background:#111}
    b{color:#fff;font-weight:500}</style>${cells}`);
  await page.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
  await page.screenshot({ path: join(out, 'sheet.png'), fullPage: true });
}
await browser.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exitCode = 1; }
console.log(`rendered ${frames.length} frame(s) → ${out} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
