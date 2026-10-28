// per-cut continuity numbers from a saved camera log: STAGE=<skill dir> node cutnums.mjs <job> <aspect> <cams.json>
import { readFileSync } from 'node:fs';
const V = process.env.STAGE + '/video';
const { cutContinuity } = await import(V + '/lib/qa.mjs'), { loadSpec } = await import(V + '/lib/spec.mjs'), { compile } = await import(V + '/lib/timeline.mjs'), { ASPECTS } = await import(V + '/lib/common.mjs');
const [job, aspect, f] = process.argv.slice(2), tl = compile(await loadSpec(job), 'main'), { W, H } = ASPECTS[aspect];
const C = cutContinuity({ tl, cams: JSON.parse(readFileSync(f, 'utf8')), W, H });
const fmt = r => !r ? '—' : !r.moving ? `still (${r.before?.v}→${r.after?.v ?? '·'})` : `${r.half ? 'half ' : ''}${r.before.v}→${r.after?.v ?? '·'} px/s ratio ${r.ratio === undefined ? 'n/a' : r.ratio ?? 'rest'} (limit ${r.limit ?? '·'}) peak ${r.peak.step}${r.peak.off ? ` off ${r.peak.off}` : ''}${r.peak.settle ? ' settle' : ''}${r.tuned ? ' tuned' : ''} warn [${r.warn}]`;
for (const x of C.cuts) console.log(`${x.cut.padEnd(16)} ${String(x.at).padStart(5)} ${x.out.padEnd(11)} cam: ${fmt(x.camera)}${(x.carry || []).map(q => ` | carry#${q.j}: ${fmt(q)}`).join('')}${x.carrySkipped ? ` | ${x.carrySkipped} carry unchecked` : ''}`);
