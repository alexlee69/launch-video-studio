// Render the stage at 1920×1080: frame n of the film = reference frame n (0..1908, 30 fps).
//   node render.mjs                         every frame → out/frames → out/film-silent.mp4 (+ film.mp4 if out/audio/master.wav exists)
//   node render.mjs --from 510 --to 670 --out out/w4   a range into its own folder (no encode unless --mp4 path)
//   node render.mjs --stills 300,345 --out out/w3s      just those frames
//   --jobs N   parallel browser pages (default 4)
import { chromium } from '../../node_modules/playwright-core/index.mjs';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..', '..'); const STAGE = resolve(import.meta.dirname, 'stage-w5.html');
const LAST_FRAME = 1908;
const args = process.argv.slice(2);
const opt = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const stills = opt('--stills') ? opt('--stills').split(',').map(Number) : null;
const from = +opt('--from', 0), to = +opt('--to', LAST_FRAME);
const full = !stills && !args.includes('--from') && !args.includes('--to');
const outDir = resolve(ROOT, opt('--out', join('out', 'frames')));
const jobs = +opt('--jobs', 4);
if (!stills && existsSync(outDir) && !args.includes('--keep')) rmSync(outDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const CLIP = { x: 0, y: 0, width: 1080, height: 608 };   // 1920 x 1081 at this scale; ffmpeg crops to 1080
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none', '--allow-file-access-from-files'] });
const list = stills || Array.from({ length: to - from + 1 }, (_, i) => from + i);
let failed = false;
async function worker(part) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 608 }, deviceScaleFactor: 1920 / 1080 });
  page.on('console', m => { if (m.type() === 'error') console.error('[stage]', m.text()); });
  page.on('pageerror', e => { console.error('[stage error]', e.message); failed = true; });
  await page.goto(pathToFileURL(process.argv.includes('--shared') ? join(ROOT, 'stage.html') : STAGE).href);
  await page.evaluate(() => window.ready);
  const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  // warm-up: the very first capture after load can catch half-rastered tiles
  await page.evaluate(n => window.seek(n), part[0]); await settle(); await page.waitForTimeout(300);
  await page.screenshot({ clip: CLIP });
  for (const n of part) {
    await page.evaluate(n => window.seek(n), n);
    await settle();
    await page.screenshot({ path: join(outDir, `n${String(n).padStart(4, '0')}.png`), clip: CLIP });
  }
  await page.close();
}
const t0 = Date.now();
const k = Math.max(1, Math.min(jobs, list.length));
const parts = Array.from({ length: k }, (_, i) => list.slice(Math.floor(i * list.length / k), Math.floor((i + 1) * list.length / k))).filter(p => p.length);
await Promise.all(parts.map(worker));
await browser.close();
console.log(`rendered ${list.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s → ${outDir}`);
if (failed) { console.error('page errors during render'); process.exit(1); }

function encode(first, mp4) {
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '30', '-start_number', String(first), '-i', join(outDir, 'n%04d.png'),
    '-vf', 'crop=1920:1080:0:0,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
  if (r.status !== 0) { console.error('ffmpeg failed'); process.exit(1); }
  console.log('wrote', mp4);
}
if (!stills && opt('--mp4')) encode(from, resolve(ROOT, opt('--mp4')));
if (full) {
  const mp4 = join(ROOT, 'out', 'film-silent.mp4');
  encode(0, mp4);
  const master = join(ROOT, 'out', 'audio', 'master.wav');
  if (existsSync(master)) {
    const m = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', mp4, '-i', master, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
      '-shortest', '-movflags', '+faststart', join(ROOT, 'film.mp4')], { stdio: 'inherit' });
    if (m.status !== 0) { console.error('mux failed'); process.exit(1); }
    console.log('muxed film.mp4 with out/audio/master.wav');
  } else console.log('no sound yet: node audio.mjs');
}
