// cutsheet.mjs — labelled contact sheets of the 60-fps film frames around each cut (cut−8 … cut+12, every 2 = 30-fps
// cut−4 … cut+6), one PNG per cut, plus any extra frame list. Uses the skill's playwright-core + Chrome (read-only).
// node tools/cutsheet.mjs <frames dir> <out dir> <label> <cut,cut,...> [offsets e.g. -8,-6,-4,-2,-1,0,1,2,4,6,8,12] [thumb width]
import { createRequire } from 'module';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
const require = createRequire('/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit/stage/product-launch-sting/package.json');
const { chromium } = require('playwright-core');
const [,, dir, out, label, cutsArg, offArg, twArg] = process.argv;
const cuts = cutsArg.split(',').map(Number), offs = (offArg || '-8,-6,-4,-2,-1,0,1,2,4,6,8,12').split(',').map(Number), tw = Number(twArg || 300);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1600, height: 400 } });
for (const c of cuts) {
  const cells = offs.map(o => { const f = c + o, fn = `${dir}/${String(f).padStart(5, '0')}.png`;
    return existsSync(fn) ? `<figure><img src="file://${fn}" style="width:${tw}px"><figcaption>${o >= 0 ? '+' : ''}${o} · f${f}</figcaption></figure>` : ''; }).join('');
  const html = `<html><body style="margin:0;background:#1b1b1f;color:#ddd;font:13px -apple-system;padding:8px"><div>${label} · cut f${c}</div><div style="display:flex;flex-wrap:wrap;gap:6px">${cells}</div><style>figure{margin:0}figcaption{padding:2px 0}</style></body></html>`;
  const h = `${out}/cut-${c}.html`; writeFileSync(h, html);
  await p.setViewportSize({ width: Math.min(1900, (tw + 6) * 6 + 16), height: 300 });
  await p.goto('file://' + h); await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/${label}-cut-${c}.png`, fullPage: true });
}
await b.close();
