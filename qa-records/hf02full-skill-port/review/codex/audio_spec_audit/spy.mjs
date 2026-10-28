// Scratch-only event recorder for the staged film arranger.
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const [treeArg, jobArg] = process.argv.slice(2);
const V = resolve(treeArg), job = resolve(jobArg), L = join(V, 'lib');
const src = readFileSync(join(L, 'audio.mjs'), 'utf8');
const dir = join(import.meta.dirname, 'spylib', createHash('sha1').update(V + src).digest('hex').slice(0, 10));
if (!existsSync(join(dir, 'audio.mjs'))) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'audio.mjs'), src.replace(/from '\.\/(\w+)\.mjs'/g, (_, f) => `from '${pathToFileURL(join(L, f + '.mjs')).href}'`)
    .replace(/^function arrangeFilm\(/m, 'export function arrangeFilm('));
}
const imp = f => import(pathToFileURL(join(L, f)).href);
const { loadSpec } = await imp('spec.mjs');
const { compile } = await imp('timeline.mjs');
const { makeEngine } = await imp('voices.mjs');
const { SR } = await imp('common.mjs');
const { arrangeFilm } = await import(pathToFileURL(join(dir, 'audio.mjs')).href);
const tl = compile(await loadSpec(job));
const E = makeEngine(tl.dur), events = {};
for (const k of ['kick', 'clap', 'hat', 'crash', 'bass', 'stab', 'pad', 'pluck', 'mallet', 'riser']) {
  const f = E[k]; events[k] = []; E[k] = (...a) => { events[k].push(a); return f(...a); };
}
const post = arrangeFilm(tl, E);
const [mixL, mixR] = E.mixdown(tl.beat);
if (post) post(mixL, mixR);
const breaks = tl.shots.filter(s => tl.music.breaks.includes(s.id)).map(s => [s.start, s.end]);
const inside = t => breaks.some(([a, b]) => t >= a && t < b);
const unexpected = Object.fromEntries(Object.entries(events).filter(([k]) => !['pad', 'riser', 'crash'].includes(k))
  .map(([k, rows]) => [k, rows.map(a => a[0]).filter(inside).map(t => +t.toFixed(4))]).filter(([, a]) => a.length));
const hit = (events.stab.find(a => a[2] === .3) || [null])[0];
let silencePeak = null;
if (hit != null && tl.endcard != null) {
  silencePeak = 0;
  for (let i = Math.max(0, Math.round((hit - .44) * SR)); i < Math.round(hit * SR); i++) silencePeak = Math.max(silencePeak, Math.abs(mixL[i]), Math.abs(mixR[i]));
}
console.log(JSON.stringify({ dur: tl.dur, endcard: tl.endcard, hit, silencePeak, breaks, unexpected,
  events: Object.fromEntries(Object.entries(events).map(([k, rows]) => [k, rows.map(a => +a[0].toFixed(4))])) }));
