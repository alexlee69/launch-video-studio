// Build one job's soundtrack stems with a given copy of the skill (live or staging), without rendering frames.
//   node build_audio.mjs <skill video dir> <job dir> <out dir> [--cut NAME] [--master]
// → <out>/{music,points,whoosh,raw}.wav (+ master.wav with --master) and prints md5 of each stem.
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [V, job, out] = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !(i && all[i - 1] === '--cut')).map(p => resolve(p));
const cut = process.argv.includes('--cut') ? process.argv[process.argv.indexOf('--cut') + 1] : 'main';
const imp = f => import(pathToFileURL(join(V, 'lib', f)).href);
const { loadSpec } = await imp('spec.mjs'), { compile } = await imp('timeline.mjs'), { buildAudio } = await imp('audio.mjs'), { master } = await imp('deliver.mjs');
const spec = await loadSpec(job), tl = compile(spec, cut);
mkdirSync(out, { recursive: true });
const t0 = Date.now();
buildAudio(job, tl, out);
if (process.argv.includes('--master')) master(out, tl.dur, { log: () => {} });
const md5 = f => createHash('md5').update(readFileSync(f)).digest('hex');
console.log(JSON.stringify({ job, cut, style: tl.music.style, bpm: tl.bpm, downbeat: tl.music.downbeat, dur: tl.dur, endcard: tl.endcard,
  shots: tl.shots.map(s => [s.id, +s.start.toFixed(4), +s.end.toFixed(4)]), seconds: (Date.now() - t0) / 1000,
  md5: Object.fromEntries(['music.wav', 'points.wav', 'whoosh.wav', 'raw.wav', 'master.wav'].filter(f => existsSync(join(out, f))).map(f => [f, md5(join(out, f))])) }));
