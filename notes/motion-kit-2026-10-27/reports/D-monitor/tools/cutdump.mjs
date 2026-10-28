// print cutContinuity per-cut numbers for a cams file: STAGE=… node cutdump.mjs <job> <aspect> <cams.json> [cutIndexOrId]
import { readFileSync } from 'node:fs';
const V = process.env.STAGE + '/video';
const { loadSpec } = await import(V + '/lib/spec.mjs'); const { compile } = await import(V + '/lib/timeline.mjs');
const { cutContinuity } = await import(V + '/lib/qa.mjs'); const { ASPECTS } = await import(V + '/lib/common.mjs');
const [job, aspect, f, which] = process.argv.slice(2);
const tl = compile(await loadSpec(job), 'main'), { W, H } = ASPECTS[aspect];
const C = cutContinuity({ tl, cams: JSON.parse(readFileSync(f, 'utf8')), W, H });
for (const x of C.cuts) if (!which || x.cut.includes(which)) console.log(JSON.stringify(x));
