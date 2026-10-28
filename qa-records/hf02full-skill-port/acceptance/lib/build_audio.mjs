#!/usr/bin/env node
// Build a job's soundtrack stems with a GIVEN skill copy (live or stage) — no frames, no Chrome:
//   node build_audio.mjs <SKILL_DIR> <JOB_DIR> <OUT_DIR> [--cut main] [--master] [--probe]
// --probe: only load + compile the spec and print {music, bpm, beat, dur, endcard, shots} (or {error}) as JSON.
// Writes OUT_DIR/{music,points,whoosh,qa-lane-*,raw}.wav (+ master.wav) and OUT_DIR/tl.json (the compiled timeline).
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const [skill, job, out] = process.argv.slice(2).map(x => x && resolve(x));
const argv = process.argv.slice(2);
const cut = argv.includes('--cut') ? argv[argv.indexOf('--cut') + 1] : 'main';
const V = join(skill, 'video', 'lib');
const imp = f => import(pathToFileURL(join(V, f)).href);
try {
  const { loadSpec } = await imp('spec.mjs'), { compile } = await imp('timeline.mjs');
  const spec = await loadSpec(job), tl = compile(spec, cut);
  const brief = { music: tl.music, bpm: tl.bpm, beat: tl.beat, dur: tl.dur, endcard: tl.endcard, shots: tl.shots.map(s => ({ id: s.id, block: s.block, start: s.start, end: s.end })) };
  if (argv.includes('--probe')) { console.log(JSON.stringify(brief)); process.exit(0); }
  const { buildAudio } = await imp('audio.mjs');
  mkdirSync(out, { recursive: true });
  buildAudio(job, tl, out);
  writeFileSync(join(out, 'tl.json'), JSON.stringify(tl));
  writeFileSync(join(out, 'brief.json'), JSON.stringify(brief, null, 1));
  if (argv.includes('--master')) { const { master } = await imp('deliver.mjs'); master(out, tl.dur, { log: () => {} }); }
  console.log(JSON.stringify({ ok: true, ...brief, shots: brief.shots.length }));
} catch (e) {
  console.log(JSON.stringify({ error: String(e && e.message || e).split('\n').slice(0, 3).join(' ') }));
  process.exit(2);
}
