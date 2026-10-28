import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
const job = resolve(process.argv[2]);
const out = {};
for (const [name, V] of [['live', '/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/review/sonnet-B/live/video'], ['stage', '/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/review/sonnet-B/stage/video']]) {
  const imp = f => import(pathToFileURL(join(V, 'lib', f)).href);
  const { loadSpec } = await imp('spec.mjs'), { compile } = await imp('timeline.mjs'), { audioPrint, shotPrints } = await imp('fingerprint.mjs');
  const tl = compile(await loadSpec(job), 'main');
  out[name] = { audioPrint: audioPrint(job, tl), shot0: Object.values(shotPrints(job, tl, '16x9'))[0] };
}
console.log(JSON.stringify(out), out.live.audioPrint === out.stage.audioPrint ? 'AUDIO PRINT SAME' : 'AUDIO PRINT DIFFERS', out.live.shot0 === out.stage.shot0 ? 'shot print same' : 'shot print differs');
