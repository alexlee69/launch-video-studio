// Render a frame range with one footage slot pointed at a generated clip, without touching story.js:
// an init script intercepts window.STORY as story.js assigns it and sets the slot before the scenes mount.
//   node tools/fal/render_with_footage.mjs <slot> <clip path, relative to hf02-full> <from> <to> <out.mp4>
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..', '..');
const [slot, clip, a, b, outMp4] = process.argv.slice(2);
const frames = join(ROOT, 'out', 'fal', 'frames_' + slot);
rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 608 }, deviceScaleFactor: 1920 / 1080 });
page.on('pageerror', e => { console.error('[stage error]', e.message); process.exitCode = 1; });
page.on('console', m => { if (m.type() === 'error') console.error('[stage]', m.text()); });
await page.addInitScript(([slot, clip]) => {
  let v; Object.defineProperty(window, 'STORY', { configurable: true, get: () => v,
    set: s => { v = s; if (s && s.footage) { if (/^carousel(\d)$/.test(slot)) s.footage.carousel[+slot.slice(8)] = clip; else s.footage[slot] = clip; } } });
}, [slot, clip]);
await page.goto(pathToFileURL(join(ROOT, 'stage.html')).href);
await page.evaluate(() => window.ready);
const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
await page.evaluate(n => window.seek(n), +a); await settle(); await page.waitForTimeout(500);
for (let n = +a; n <= +b; n++) {
  await page.evaluate(n => window.seek(n), n); await settle();
  await page.screenshot({ path: join(frames, `n${String(n).padStart(4, '0')}.png`), clip: { x: 0, y: 0, width: 1080, height: 608 } });
}
const used = await page.evaluate(slot => !!document.querySelector('video'), slot);
await browser.close();
if (!used) { console.error('no <video> element was mounted: the slot override did not take'); process.exit(1); }
const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '30', '-start_number', a, '-i', join(frames, 'n%04d.png'),
  '-vf', 'crop=1920:1080:0:0,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', resolve(ROOT, outMp4)], { stdio: 'inherit' });
if (r.status) process.exit(1);
console.log('wrote', resolve(ROOT, outMp4));
