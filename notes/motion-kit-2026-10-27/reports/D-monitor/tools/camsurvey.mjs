// Monitor tool (not part of any worker's build): log LV.camera() for every 60-fps frame of a job WITHOUT screenshots
// (CAM is computed analytically inside LV.seek before the block draws), then run the stage's cutContinuity on it.
// usage: STAGE=<skill dir> node camsurvey.mjs <job> <aspect> <out.json> [--shuffle <seed>] [--cut <name>] [--frames a,b]
import { writeFileSync } from 'node:fs';
const STAGE = process.env.STAGE;
const V = STAGE + '/video';
const { loadSpec } = await import(V + '/lib/spec.mjs');
const { compile } = await import(V + '/lib/timeline.mjs');
const { launch, extractPlates } = await import(V + '/lib/render.mjs');
const { serve } = await import(V + '/lib/server.mjs');
const { cutContinuity, continuitySummary } = await import(V + '/lib/qa.mjs');
const { ASPECTS } = await import(V + '/lib/common.mjs');
const [job, aspect, out, ...rest] = process.argv.slice(2);
const opt = k => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : null; };
const spec = await loadSpec(job), tl = compile(spec, opt('--cut') || 'main');
const { W, H } = ASPECTS[aspect];
const plates = extractPlates(job, tl, aspect);
const server = await serve(job), browser = await launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await ctx.addInitScript({ content: `window.__LV__ = ${JSON.stringify({ timeline: tl, aspect, plates, alpha: false, clean: false, bgOnly: false, layer: null })};` });
const page = await ctx.newPage(), errs = [];
page.on('pageerror', e => errs.push(String(e)));
await page.goto(`${server.base}/skill/video/engine/stage.html`);
await page.evaluate(() => window.LV.ready);
let idx = Array.from({ length: tl.frames }, (_, i) => i);
if (opt('--frames')) { const [a, b] = opt('--frames').split(',').map(Number); idx = idx.filter(i => i >= a && i <= b); }
if (opt('--shuffle') != null) { let s = Number(opt('--shuffle')) >>> 0 || 1; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; } }
const cams = new Array(tl.frames).fill(null), t0 = Date.now();
let tEval = 0;
for (const i of idx) {
  await page.evaluate(x => window.LV.seek(x), i / 2);
  const t1 = performance.now();
  cams[i] = await page.evaluate(() => window.LV.camera());
  tEval += performance.now() - t1;
}
await browser.close(); await server.close();
writeFileSync(out, JSON.stringify(cams));
const C = cutContinuity({ tl, cams, W, H });
console.log(`${job.split('/').pop()} ${aspect}: ${idx.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s (camera() evaluate avg ${(tEval / idx.length).toFixed(2)} ms)${errs.length ? ' PAGE ERRORS: ' + errs.join(' | ') : ''}`);
console.log('INFO ' + continuitySummary(C));
for (const w of C.warns) console.log('WARN ' + w);
