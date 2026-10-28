// Verify-pass tool (not part of any build): run a stage's cutContinuity on a saved camera log, no browser.
// usage: STAGE=<skill dir> node vcheck.mjs <job> <aspect> <cams.json> [--cut <name>] [--json out.json]
import { readFileSync, writeFileSync } from 'node:fs';
const V = process.env.STAGE + '/video';
const { loadSpec } = await import(V + '/lib/spec.mjs');
const { compile } = await import(V + '/lib/timeline.mjs');
const { cutContinuity, continuitySummary } = await import(V + '/lib/qa.mjs');
const { ASPECTS } = await import(V + '/lib/common.mjs');
const [job, aspect, camsPath, ...rest] = process.argv.slice(2);
const opt = k => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : null; };
const spec = await loadSpec(job), tl = compile(spec, opt('--cut') || 'main');
const { W, H } = ASPECTS[aspect];
const cams = JSON.parse(readFileSync(camsPath, 'utf8'));
const C = cutContinuity({ tl, cams, W, H });
console.log(`${job.split('/').pop()} ${aspect}: ${cams.length} cams, ${tl.frames} frames`);
console.log('INFO ' + continuitySummary(C));
for (const w of C.warns) console.log('WARN ' + w);
if (opt('--json')) writeFileSync(opt('--json'), JSON.stringify(C, null, 1));
