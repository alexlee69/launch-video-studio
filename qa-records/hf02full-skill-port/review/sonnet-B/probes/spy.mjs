// Spy harness (scratch only): compile a job, run arrangeFilm against a recording engine, check grid invariants, gating, bus.
//   node spy.mjs <job dir> [--cut NAME] [--json]
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
const V = '/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/review/sonnet-B/stage/video';
const imp = f => import(pathToFileURL(join(V, 'lib', f)).href);
const { loadSpec } = await imp('spec.mjs'), { compile } = await imp('timeline.mjs'), { arrangeFilm } = await imp('audio.mjs'), { makeEngine } = await imp('voices.mjs');
const { SR } = await imp('common.mjs');
const args = process.argv.slice(2);
const job = resolve(args[0]); const cut = args.includes('--cut') ? args[args.indexOf('--cut') + 1] : 'main';
const spec = await loadSpec(job), tl = compile(spec, cut);
const E = makeEngine(tl.dur);
const log = [];
const WRAP = { kick: 0, clap: 0, hat: 0, crash: 0, bass: 0, stab: 0, pad: 0, pluck: 0, mallet: 0, riser: 0 };
for (const k of Object.keys(WRAP)) { const f = E[k]; E[k] = (...a) => { log.push({ k, t: a[0], a }); return f(...a); }; }
// shaker: runs of E.put with rv===.06 (only the shaker uses that send); first index of each run is the event
let lastIdx = -10, runStart = null; const putOrig = E.put;
const shakers = [];
E.put = (i, l, r, rv = 0, dl = 0) => { if (rv === .06) { if (i !== lastIdx + 1) { shakers.push(i / SR); } lastIdx = i; } return putOrig(i, l, r, rv, dl); };
// NOTE: arrangeFilm's shaker() calls E.put on the same object (closure E) so the wrap is seen.
const post = arrangeFilm(tl, E);
const [L, R] = E.mixdown(tl.beat);
const L0 = Float32Array.from(L), R0 = Float32Array.from(R);
if (post) post(L, R);
const beat = tl.beat, db = tl.music.downbeat;
const off = t => { const k = (t - db) / beat * 4; return (k - Math.round(k)) * beat / 4; };   // seconds off the nearest 16th
const bad = [];
const rhythmic = ['kick', 'clap', 'hat', 'bass', 'stab', 'pluck', 'mallet'];
const hitT = tl.endcard;
for (const e of log) if (rhythmic.includes(e.k)) { const o = off(e.t); if (Math.abs(o) > 1e-4) bad.push({ k: e.k, t: +e.t.toFixed(4), off_ms: +(o * 1000).toFixed(2), at_card: hitT != null && Math.abs(e.t - hitT) < 1e-6 }); }
for (const t of shakers) { const o = off(t); if (Math.abs(o) > 1e-4) bad.push({ k: 'shaker', t: +t.toFixed(4), off_ms: +(o * 1000).toFixed(2) }); }
let peak = 0, sum = 0, nan = 0; for (let i = 0; i < L.length; i++) { const a = Math.abs(L[i]), b = Math.abs(R[i]); if (!(a === a) || !(b === b)) nan++; peak = Math.max(peak, a, b); sum += L[i] + R[i]; }
// silence before the card
let sil = null;
if (hitT != null) { const a = Math.round((hitT - .4) * SR), b = Math.round(hitT * SR) - 1; let m = 0; for (let i = a; i < b; i++) m = Math.max(m, Math.abs(L[i]), Math.abs(R[i])); sil = m; }
const out = { job, cut, dur: +tl.dur.toFixed(3), bpm: tl.bpm, key: tl.music.key, downbeat: db, endcard: tl.endcard, shots: tl.shots.map(s => [s.id, +s.start.toFixed(3), +s.end.toFixed(3)]),
  events: log.length + shakers.length, offGrid: bad.length, offGridSample: bad.slice(0, 8), peak: +peak.toFixed(3), dc: +(sum / L.length / 2).toExponential(2), nan, silenceBeforeCard_peak: sil, silDb: sil == null ? null : (sil > 0 ? +(20 * Math.log10(sil)).toFixed(1) : '-inf') };
console.log(JSON.stringify(out, null, args.includes('--json') ? 1 : 0));
