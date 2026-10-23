// camera state per frame (no screenshots): node camdump.mjs <video dir> <job> <aspect> <f0> <f1> [step=1] [expr]
// expr: extra JS evaluated in the page after each seek (its value is printed as "x")
import { join } from 'node:path';
const [V, job, aspect, a, b, step = '1', expr = ''] = process.argv.slice(2);
const { loadSpec } = await import(join(V, 'lib/spec.mjs'));
const { compile } = await import(join(V, 'lib/timeline.mjs'));
const { launch, extractPlates } = await import(join(V, 'lib/render.mjs'));
const { serve } = await import(join(V, 'lib/server.mjs'));
const { ASPECTS } = await import(join(V, 'lib/common.mjs'));
const spec = await loadSpec(job), tl = compile(spec, 'main'), { W, H } = ASPECTS[aspect];
const plates = extractPlates(job, tl, aspect), server = await serve(job), browser = await launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
await ctx.addInitScript({ content: `window.__LV__ = ${JSON.stringify({ timeline: tl, aspect, plates })};` });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto(`${server.base}/skill/video/engine/stage.html`); await page.evaluate(() => window.LV.ready);
for (let f = Number(a); f <= Number(b); f += Number(step)) {
  const r = await page.evaluate(async ([f, expr]) => { const id = await window.LV.seek(f); const c = window.LV.camera(); let x = null; if (expr) x = eval(expr); return { f, id, ...c, val: x }; }, [f, expr]);
  console.log(JSON.stringify(r));
}
if (errs.length) console.error(errs.join('\n'));
await browser.close(); await server.close();
