// Render one stand-in app screen (lib/app.js) as a high-res PNG, for pinning onto phones in generated footage.
//   node tools/fal/ui_screen.mjs <kind: home|library|player|chapters> <out.png> [scale]
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { writeFileSync } from 'node:fs';
const ROOT = resolve(import.meta.dirname, '..', '..');
const [kind, out, scale = '4'] = process.argv.slice(2);
const html = `<!doctype html><meta charset="utf-8"><base href="${pathToFileURL(ROOT).href}/"><style>
@font-face{font-family:Inter;font-weight:400;src:url(node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2)}
@font-face{font-family:Inter;font-weight:500;src:url(node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2)}
@font-face{font-family:Inter;font-weight:600;src:url(node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2)}
@font-face{font-family:Inter;font-weight:700;src:url(node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2)}
html,body{margin:0;background:#000} .abs{position:absolute} .abs>svg{display:block}</style><div id="s" style="position:absolute;left:0;top:0;width:180px;height:390px"></div>
<script src="lib/core.js"></script><script src="lib/art.js"></script><script src="lib/app.js"></script><script src="story.js"></script>
<script>window.ready=(async()=>{for(const w of [400,500,600,700]) await document.fonts.load(w+' 12px Inter'); hush(document.getElementById('s'), ${JSON.stringify(kind)}, {w:180,h:390,x:0,y:0,r:0}); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); return true;})();</script>`;
const page_file = join(ROOT, 'out', 'fal', '_ui_screen.html'); writeFileSync(page_file, html);
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--allow-file-access-from-files', '--force-color-profile=srgb'] });
const p = await b.newPage({ viewport: { width: 180, height: 390 }, deviceScaleFactor: +scale });
p.on('pageerror', e => { console.error('[page error]', e.message); process.exitCode = 1; });
await p.goto(pathToFileURL(page_file).href); await p.evaluate(() => window.ready);
await p.screenshot({ path: resolve(out), clip: { x: 0, y: 0, width: 180, height: 390 } });
await b.close(); console.log('wrote', resolve(out));
