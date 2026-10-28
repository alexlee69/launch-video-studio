// summarise the event log of one job: groove span, dips, risers/crashes, hit, gating
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
const V = '/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/review/sonnet-B/stage/video';
const imp = f => import(pathToFileURL(join(V, 'lib', f)).href);
const { loadSpec } = await imp('spec.mjs'), { compile } = await imp('timeline.mjs'), { arrangeFilm } = await imp('audio.mjs'), { makeEngine } = await imp('voices.mjs');
const job = resolve(process.argv[2]); const cut = process.argv[3] || 'main';
const spec = await loadSpec(job), tl = compile(spec, cut);
const E = makeEngine(tl.dur); const log = [];
for (const k of ['kick', 'clap', 'hat', 'crash', 'bass', 'stab', 'pad', 'pluck', 'mallet', 'riser']) { const f = E[k]; E[k] = (...a) => { log.push({ k, t: a[0], a }); return f(...a); }; }
arrangeFilm(tl, E);
const f = x => +x.toFixed(3), beat = tl.beat, db = tl.music.downbeat;
const kk = t => +(((t - db) / beat)).toFixed(2);
console.log(`job ${job.split('/').pop()} cut ${cut}: dur ${f(tl.dur)} bpm ${tl.bpm} beat ${f(beat)} db ${db} endcard ${tl.endcard && f(tl.endcard)} drop ${tl.music.drop} breaks ${tl.music.breaks}`);
console.log(' shots', tl.shots.map(s => `${s.id}[${f(s.start)}-${f(s.end)}] k${kk(s.start)}`).join(' '));
const kicks = log.filter(e => e.k === 'kick'); console.log(' kicks', kicks.length, 'first', kicks[0] && f(kicks[0].t), 'last', kicks.length && f(kicks.at(-1).t), 'depths', [...new Set(kicks.map(e => e.a[2]))]);
const gaps = []; for (let i = 1; i < kicks.length; i++) if (kicks[i].t - kicks[i - 1].t > beat * 2.6) gaps.push([f(kicks[i - 1].t), f(kicks[i].t)]); console.log(' kick gaps (dips)', JSON.stringify(gaps));
console.log(' risers', log.filter(e => e.k === 'riser').map(e => `${f(e.a[0])}->${f(e.a[1])}`).join(' '), '| crashes', log.filter(e => e.k === 'crash').map(e => f(e.t)).join(' '));
const pads = log.filter(e => e.k === 'pad').map(e => `${f(e.a[0])}-${f(e.a[1])}`); console.log(' pads', pads.length, pads.slice(0, 3).join(' '), '...', pads.slice(-3).join(' '));
const hit = log.filter(e => e.k === 'stab' && e.a[2] === .3); console.log(' hit stab', hit.map(e => f(e.t)));
const lastRhythm = log.filter(e => ['kick', 'clap', 'hat', 'pluck', 'bass'].includes(e.k) && (tl.endcard == null || e.t < tl.endcard - 0.01)); console.log(' last rhythmic event before card/end', lastRhythm.length && f(Math.max(...lastRhythm.map(e => e.t))), ' (card-0.44 =', tl.endcard && f(tl.endcard - .44) + ')');
