// Worker D fix pass: cutContinuity before (OLD stage) vs after (NEW stage) on saved camera logs.
// usage: OLD=<skill dir> NEW=<skill dir> node recheck.mjs <job>::<aspect>::<cams.json> ...   (prints NEW's INFO + WARNs)
import { readFileSync } from 'node:fs';
const load = async S => ({ ...(await import(S + '/video/lib/qa.mjs')), ...(await import(S + '/video/lib/spec.mjs')), ...(await import(S + '/video/lib/timeline.mjs')), ...(await import(S + '/video/lib/common.mjs')) });
const O = await load(process.env.OLD), N = await load(process.env.NEW);
for (const arg of process.argv.slice(2)) {
  const [job, aspect, f] = arg.split('::');
  const tl = N.compile(await N.loadSpec(job), 'main'), { W, H } = N.ASPECTS[aspect], cams = JSON.parse(readFileSync(f, 'utf8'));
  const a = O.cutContinuity({ tl, cams, W, H }), b = N.cutContinuity({ tl, cams, W, H });
  console.log(`== ${job.split('/').pop()} ${aspect}: ${a.warns.length} WARN → ${b.warns.length} WARN`);
  console.log('   INFO ' + N.continuitySummary(b));
  for (const w of b.warns) console.log('   WARN ' + w);
  if (process.env.SHOW) { console.log("   (old) INFO " + O.continuitySummary(a)); for (const w of a.warns) console.log("   (old) WARN " + w); }
}
