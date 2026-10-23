// A guide ("vector draft") clip for one footage plate: the plate's picture only, with its measured camera and live parts,
// and none of the vector UI drawn over it (card frame, prompt bar, bubbles). It goes to the video model as Video 1.
//   node tools/fal/guide_clip.mjs <sceneId> <from> <to> <out.mp4> [--width 1280]
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve, join, dirname } from 'node:path';
import { mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..', '..');
const [sceneId, a, b, outMp4] = process.argv.slice(2);
const width = +(process.argv.includes('--width') ? process.argv[process.argv.indexOf('--width') + 1] : 1280);
const frames = join(ROOT, 'out', 'fal', 'guide_' + sceneId);
rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 608 }, deviceScaleFactor: 1920 / 1080 });
page.on('pageerror', e => { console.error('[stage error]', e.message); process.exitCode = 1; });
await page.goto(pathToFileURL(join(ROOT, 'stage.html')).href);
await page.evaluate(() => window.ready);
const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
async function show(n) {
  await page.evaluate(async ([n, id]) => {
    await window.seek(n);
    const d = SCENES.find(s => s.id === id), S = d.S;
    for (const s of SCENES) if (s !== d) s.S.root.style.display = 'none';
    S.root.style.display = 'block'; S.root.style.opacity = '1';
    // keep only the picture's card wrapper; the card itself goes full-bleed and sharp
    for (const c of S.cam.children) c.style.visibility = c === S.cw ? '' : 'hidden';
    if (S.card) Object.assign(S.card.style, { transform: 'none', borderRadius: '0', boxShadow: 'none' });
    if (S.cw && S.cw._blur) S.cw._blur(0, 0);
    S.cam.style.transform = 'none';
    if (S.root._blur) S.root._blur(0, 0);
  }, [n, sceneId]);
  await settle();
}
await show(+a); await page.waitForTimeout(300);
for (let n = +a; n <= +b; n++) {
  await show(n);
  await page.screenshot({ path: join(frames, `n${String(n).padStart(4, '0')}.png`), clip: { x: 0, y: 0, width: 1080, height: 608 } });
}
await browser.close();
mkdirSync(dirname(resolve(outMp4)), { recursive: true });
const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '30', '-start_number', a, '-i', join(frames, 'n%04d.png'),
  '-vf', `crop=1920:1080:0:0,scale=${width}:-2:flags=lanczos,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', resolve(outMp4)], { stdio: 'inherit' });
if (r.status) process.exit(1);
console.log('wrote', resolve(outMp4), `(${+b - +a + 1} frames)`);
