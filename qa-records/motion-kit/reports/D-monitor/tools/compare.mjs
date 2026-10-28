// cutContinuity WARN counts: stageD vs the scratch patch, for every cams file given as job:aspect:cams.json
import { readFileSync } from 'node:fs';
const load = async S => ({ ...(await import(S + '/video/lib/qa.mjs')), ...(await import(S + '/video/lib/spec.mjs')), ...(await import(S + '/video/lib/timeline.mjs')), ...(await import(S + '/video/lib/common.mjs')) });
const D = await load(process.env.STAGE), P = await load(process.env.PATCH);
for (const arg of process.argv.slice(2)) {
  const [job, aspect, f] = arg.split('::');
  const tl = D.compile(await D.loadSpec(job), 'main'), { W, H } = D.ASPECTS[aspect], cams = JSON.parse(readFileSync(f, 'utf8'));
  const a = D.cutContinuity({ tl, cams, W, H }), b = P.cutContinuity({ tl, cams, W, H });
  console.log(`${job.split('/').pop()} ${aspect}: stageD ${a.warns.length} WARN → patched ${b.warns.length} WARN`);
  for (const w of b.warns) console.log('   kept: ' + w.slice(0, 150));
}
