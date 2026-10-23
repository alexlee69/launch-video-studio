// Render the stage: every reference frame n (300..509 = 10.000–16.967 s) at 1920x1080, then encode.
//   node render.mjs                     all frames → out/frames → out/hf02-recreate-silent.mp4 (+ re-mux hf02-recreate.mp4 if
//                                       the sound master exists; `node audio.mjs` builds it)
//   node render.mjs --stills 300,345    just those frames → out/stills/n0300.png …
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname);
const FIRST = 300, LAST = 509;
const args = process.argv.slice(2);
const stills = args.includes('--stills') ? args[args.indexOf('--stills') + 1].split(',').map(Number) : null;
const outDir = join(ROOT, 'out', stills ? 'stills' : 'frames');
if (!stills && existsSync(outDir)) rmSync(outDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const CLIP = { x: 0, y: 0, width: 1080, height: 608 };   // 1920 x 1080 at this scale (bottom 0.9 px row is dropped)
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 608 }, deviceScaleFactor: 1920 / 1080 });
page.on('console', m => { if (m.type() === 'error') console.error('[stage]', m.text()); });
page.on('pageerror', e => { console.error('[stage error]', e.message); process.exitCode = 1; });
await page.goto(pathToFileURL(join(ROOT, 'stage.html')).href);
await page.evaluate(() => window.ready);
const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
// warm-up: the very first capture after load can catch half-rastered tiles
await page.evaluate(n => window.seek(n), FIRST); await settle(); await page.waitForTimeout(300);
await page.screenshot({ clip: CLIP });

const list = stills || Array.from({ length: LAST - FIRST + 1 }, (_, i) => FIRST + i);
const t0 = Date.now();
for (const n of list) {
  await page.evaluate(n => window.seek(n), n);
  await settle();
  await page.screenshot({ path: join(outDir, `n${String(n).padStart(4, '0')}.png`), clip: CLIP });
}
await browser.close();
console.log(`rendered ${list.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s → ${outDir}`);

if (!stills) {
  const mp4 = join(ROOT, 'out', 'hf02-recreate-silent.mp4');
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '30', '-start_number', String(FIRST), '-i', join(outDir, 'n%04d.png'),
    '-vf', 'crop=1920:1080:0:0,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
  if (r.status !== 0) { console.error('ffmpeg failed'); process.exit(1); }
  console.log('wrote', mp4);
  const master = join(ROOT, 'out', 'audio', 'master.wav');
  if (existsSync(master)) {
    const m = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', mp4, '-i', master, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
      '-shortest', '-movflags', '+faststart', join(ROOT, 'hf02-recreate.mp4')], { stdio: 'inherit' });
    if (m.status !== 0) { console.error('mux failed'); process.exit(1); }
    console.log('re-muxed hf02-recreate.mp4 with out/audio/master.wav');
  } else console.log('no sound yet: node audio.mjs');
}
