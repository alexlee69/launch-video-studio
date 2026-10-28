#!/usr/bin/env node
// A stand-in app screen for pin.py: one `phone` shot's screen from the job's own beats.yaml (its items, brand colours and
// font, the status bar and notch the engine draws), rendered on the stage at --scale × as an opaque PNG in the phone's
// screen shape (≈ 1 : 2.15). For the real product, pin its official screenshot instead (FOOTAGE.md).
//   node screen.mjs --job DIR --shot ID --out screen.png [--at F] [--aspect 16x9|9x16|1x1] [--scale 3] [--force]
// --at = a local frame of the shot (default: its storyboard frame, once the UI has built up). An existing --out (an
// official screenshot in assets/, say) is never replaced without --force; the PNG is written whole (a temp file beside
// it, then one rename), so --out is always the old file or the new one.
// A job with no phone shot (the film kit has none) gets the fallbacks instead: the official screenshot, or a one-shot side
// job with the job's brand and one phone shot (FOOTAGE.md, "No phone shot in the job").
// Exit codes: 0 written · 2 bad arguments, --out exists (no --force), beats.yaml or footage problems (as --storyboard
// reports them), no phone shot in the job, or not a phone shot · 1 the stage or Chrome failed. Every failure is one plain
// message, no stack.
import { mkdirSync, readFileSync, lstatSync, statSync, renameSync, unlinkSync } from 'node:fs';
import { resolve, dirname, relative, basename, extname, join } from 'node:path';
import { ASPECTS, arg, jobDir, UserError } from '../lib/common.mjs';
import { loadSpec } from '../lib/spec.mjs';
import { compile } from '../lib/timeline.mjs';
import { launch, extractPlates } from '../lib/render.mjs';
import { serve } from '../lib/server.mjs';

const argv = process.argv.slice(2), die = (m, c = 2) => { console.error(m); process.exit(c); };
const job = jobDir(argv), id = arg(argv, '--shot'), out = arg(argv, '--out'), scale = Number(arg(argv, '--scale', 3)), at = arg(argv, '--at');
if (!id || id === true || !out || out === true) die('usage: node screen.mjs --job DIR --shot ID --out screen.png [--at F] [--aspect 16x9] [--scale 3] [--force]');
if (!(scale >= 1 && scale <= 6)) die('--scale must be 1–6');
const dest = resolve(out), force = argv.includes('--force');
let taken = false; try { lstatSync(dest); taken = true; } catch { /* free */ }
if (taken && (() => { try { return statSync(dest).isDirectory(); } catch { return false; } })()) die(`--out ${out} is a folder — give the screenshot a file name`);
if (taken && !force) die(`--out ${out} already exists — pick another --out, or add --force to replace it`);
const tmp = join(dirname(dest), `.${basename(dest)}.tmp-${process.pid}${extname(dest) || '.png'}`);   // the screenshot's own name until it is whole
process.on('exit', () => { try { unlinkSync(tmp); } catch { /* published, or never written */ } });
let spec, tl;
try { spec = await loadSpec(job); tl = compile(spec, 'main'); } catch (e) { die(`beats.yaml: ${e.message}`); }
const s = tl.shots.find(x => x.id === String(id)), phones = tl.shots.filter(x => x.block === 'phone').map(x => x.id).join(', ');
if (!phones) die(`this job has no \`phone\` shot, so it has no app screen to render. Pin the product's official screenshot instead\n` +
  `(portrait, the phone's shape ≈ 1 : 2.15), or render a stand-in from a one-shot side job: a folder with this job's brand:\n` +
  `block and one phone shot (FOOTAGE.md, "No phone shot in the job"), then\n` +
  `  node ${relative(process.cwd(), process.argv[1]) || 'screen.mjs'} --job ../<name>-screen --shot app --out ${out}\nand flag it to the user as a stand-in.`);
if (!s) die(`no shot ${id} in beats.yaml (phone shots: ${phones})`);
if (s.block !== 'phone') die(`${id} is a ${s.block} shot; screen.mjs renders a phone shot's screen (phone shots: ${phones})`);
const aspect = String(arg(argv, '--aspect', spec.aspects[0]));
if (!ASPECTS[aspect]) die(`--aspect ${aspect}: one of ${Object.keys(ASPECTS).join(', ')}`);
const local = at == null || at === true ? s.heroF : Number(at);
if (!(local >= 0 && local < s.D)) die(`--at ${at}: a local frame of ${id}, 0–${Math.floor(s.D) - 1}`);
try { mkdirSync(dirname(dest), { recursive: true }); } catch (e) { die(`can't create the folder for ${out}: ${e.message}`); }   // before the work
const { W, H } = ASPECTS[aspect];
let plates; try { plates = extractPlates(job, tl, aspect); } catch (e) { die(`✗ ${e.message}`, e instanceof UserError ? 2 : 1); }   // footage the job's shots use
let server, browser;
try { server = await serve(job); browser = await launch(); } catch (e) { if (server) await server.close(); die(`✗ ${e.message}`, 1); }
const errors = [];
let box;
try {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: scale });
  await ctx.addInitScript({ content: `window.__LV__ = ${JSON.stringify({ timeline: tl, aspect, plates, alpha: false, clean: true, bgOnly: false, layer: null })};` });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${server.base}/skill/video/engine/stage.html`);
  try { await page.evaluate(() => window.LV.ready); } catch (e) { die(`stage failed to build: ${String(e.message).split('\n')[0]}\n${errors.join('\n')}`, 1); }
  await page.evaluate(x => window.LV.seek(x), s.f0 + local); await page.screenshot();   // warm fonts and images, as renders do
  await page.evaluate(x => window.LV.seek(x), s.f0 + local);
  box = await page.evaluate(([w, h]) => {
    const e = [...document.querySelectorAll('.lv-screen')].find(x => x.offsetParent !== null);
    if (!e) return null;
    const r = e.getBoundingClientRect(), x0 = Math.max(0, r.left), y0 = Math.max(0, r.top), x1 = Math.min(w, r.right), y1 = Math.min(h, r.bottom);
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0, cut: x0 > r.left || y0 > r.top || x1 < r.right || y1 < r.bottom };
  }, [W, H]);
  if (!box || box.width < 20 || box.height < 20) die(`${id}: no phone screen on the stage at local frame ${local} (try another --at)`, 1);
  await page.screenshot({ path: tmp, clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
  if (errors.length) die('page errors while rendering the screen:\n' + errors.join('\n'), 1);
  renameSync(tmp, dest);                                  // replaces a file (or a symlink itself) at --out in one step
} catch (e) { await browser.close().catch(() => null); await server.close(); die(`✗ screen.mjs: ${e instanceof UserError ? '' : 'the stage failed: '}${String(e.message).split('\n')[0]}`, e instanceof UserError ? 2 : 1); }
await browser.close().catch(() => null); await server.close();
const png = readFileSync(dest);                           // the size as written (IHDR), not the CSS box × scale
console.log(`wrote ${relative(process.cwd(), dest)} (${png.readUInt32BE(16)}×${png.readUInt32BE(20)}): ${id}'s phone screen at local frame ${local}, ${aspect}` +
  (box.cut ? ' — the phone runs off the frame at this moment, so its screen is cut: try another --at or --aspect' : ''));
