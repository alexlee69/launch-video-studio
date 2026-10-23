// Sound for the recreation: an original 120 BPM bed + SFX cued to the motion (all synthesized, nothing from the source).
//   node audio.mjs        → out/audio/{music,points,whoosh,raw,master}.wav, audio/hf02-{music,sfx}.wav stems,
//                           hf02-recreate.mp4 (out/hf02-recreate-silent.mp4 + master), cues.json for QA
// Voices come from the product-launch-sting engine (imported read-only).
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const ENGINE = join(homedir(), '.claude/skills/product-launch-sting/video/lib');
const { makeEngine, writeWav } = await import(join(ENGINE, 'voices.mjs'));
const { SR } = await import(join(ENGINE, 'common.mjs'));

const ROOT = resolve(import.meta.dirname);
const A = join(ROOT, 'out/audio'), STEMS = join(ROOT, 'audio');
mkdirSync(A, { recursive: true }); mkdirSync(STEMS, { recursive: true });
const DUR = 7.0, TARGET = -14, TP_MAX = -1.0;
const T = n => (n - 300) / 30;                 // source frame → seconds into the clip

// ───────────── cue sheet (every cue is tied to a motion event in motion.js / stage.html) ─────────────
const whooshes = [   // peak on the fastest frame; the build follows the acceleration into it
  { n: 311.5, g: .345, pre: .32, post: .16, p: [-.5, .5], what: 'cut A→B (pan right)' },
  { n: 333.5, g: .172, pre: .34, post: .20, p: [-.3, .3], what: 'pan reveals the sidebar' },
  { n: 357.0, g: .299, pre: .38, post: .18, p: [.1, -.1], what: 'dissolve into the list' },
  { n: 439.5, g: .196, pre: .24, post: .14, p: [0, 0], what: 'fast three-row run' },
  { n: 464.5, g: .322, pre: .36, post: .16, p: [0, 0], what: 'cut C→D (moving up)' },
  { n: 485.5, g: .161, pre: .22, post: .14, p: [0, 0], what: 'new message scrolls the chat' },
  { n: 509.5, g: .345, pre: .40, post: .16, p: [0, 0], what: 'exit cut' },
];
const points = [
  { n: 319.5, kind: 'pop', note: 84, g: .238, p: .45, what: 'send button grows' },
  { n: 337.0, kind: 'tick', g: .23, what: 'sidebar header appears' },
  { n: 339.0, kind: 'tick', g: .19, what: 'skeleton slot appears' },
  { n: 367.5, kind: 'pop', note: 72, g: .351, p: -.2, what: 'Scout lands in the slot' },
  { n: 378.0, kind: 'tick', g: .182, what: 'Scout row reveal' },
  { n: 388.0, kind: 'pop', note: 91, g: .102, p: -.2, what: 'Scout opens its eyes' },
  { n: 397.0, kind: 'pop', note: 76, g: .324, p: -.35, what: 'Critic lands' },
  { n: 398.0, kind: 'tick', g: .156, what: 'Critic row reveal' },
  { n: 411.0, kind: 'pop', note: 79, g: .324, p: -.35, what: 'Analyst lands' },
  { n: 412.0, kind: 'tick', g: .156, what: 'Analyst row reveal' },
  { n: 427.0, kind: 'pop', note: 81, g: .324, p: -.35, what: 'Director lands' },
  { n: 428.0, kind: 'tick', g: .156, what: 'Director row reveal' },
  { n: 433.0, kind: 'tick', g: .13, what: 'Builder row reveal' },
  { n: 434.0, kind: 'pop', note: 83, g: .27, p: -.35, what: 'Builder lands' },
  { n: 438.0, kind: 'pop', note: 84, g: .27, p: -.35, what: 'Writer lands' },
  { n: 441.0, kind: 'tick', g: .13, what: 'Writer row reveal' },
  { n: 447.5, kind: 'tick', g: .182, what: 'View all reveal' },
  { n: 449.0, kind: 'pop', note: 91, g: .119, p: -.15, what: 'grid square 1' },
  { n: 451.0, kind: 'pop', note: 93, g: .119, p: -.05, what: 'grid square 2' },
  { n: 453.0, kind: 'pop', note: 95, g: .119, p: .05, what: 'grid square 3' },
  { n: 455.0, kind: 'pop', note: 96, g: .136, p: .15, what: 'grid square 4' },
  { n: 487.0, kind: 'pop', note: 76, g: .243, p: -.35, what: 'Critic slides in' },
  ...Array.from({ length: 9 }, (_, i) => ({ n: 487 + 2 * i, kind: 'tick', g: .16, k: i, what: `reply streams (${i + 1}/9)` })),
];

// ───────────── music: F major, 120 BPM, beats phased so the list steps (n394.5 + 15k) land on the beat ─────────────
const BEAT = .5, PHASE = T(394.5) % BEAT;     // 0.15 s
const BARS = [   // [start, chord pad notes, bass root]
  [-1.85, [53, 57, 60, 64], 41],               // Fmaj7 (the clip enters mid-bar)
  [PHASE, [53, 57, 60, 64], 41],               // Fmaj7
  [PHASE + 2, [53, 57, 60, 62], 38],           // Dm7
  [PHASE + 4, [53, 57, 58, 62], 46],           // Bbmaj7
  [PHASE + 6, [55, 58, 60, 65], 48],           // C7sus
];
function music(E) {
  BARS.forEach(([b0, ch, root], i) => {
    const b1 = i + 1 < BARS.length ? BARS[i + 1][0] : DUR + .5, s = Math.max(0, b0);
    E.pad(s, Math.min(b1, DUR + .3), ch, .045, i === 0 ? .02 : .06, .3);
    // eighth-note pluck arpeggio on the chord, an octave up
    const seq = [0, 2, 1, 3, 2, 1, 3, 2];
    for (let k = 0; b0 + k * BEAT / 2 < Math.min(b1, DUR); k++) {
      const t = b0 + k * BEAT / 2; if (t < 0) continue;
      E.pluck(t, ch[seq[k % 8]] + 12, k % 2 ? .055 : .085, k % 2 ? .4 : -.4);
    }
    // bass: a held root in the window shots, an eighth pulse once the list starts stepping
    if (b0 < 2) E.bass(s, Math.min(b1, DUR) - s - .05, root, .16);
    else for (let t = b0; t < Math.min(b1, DUR); t += BEAT / 2) E.bass(t, BEAT / 2 - .04, root + (Math.round((t - b0) / (BEAT / 2)) % 4 === 3 ? 12 : 0), .2);
  });
  for (let t = PHASE, k = 0; t < DUR; t += BEAT, k++) {
    const full = t >= PHASE + 2 - .01;                       // light in the window shots, full groove from the list on
    if (full || k % 2 === 0) E.kick(t, full ? .42 : .32, full ? .3 : .2);
    if (full && k % 2 === 1) E.clap(t, .22);
    if (t + BEAT / 2 < DUR) E.hat(t + BEAT / 2, full ? .1 : .07, false, .25);
    if (full) E.hat(t + BEAT / 4, .05, false, -.25);
  }
  E.riser(T(509.5) - .7, T(509.5) - .01, .1, 500, 8000);    // lifts into the exit cut
}
function sfxPoints(E, list = points) {
  for (const c of list) {
    const t = T(c.n);
    if (c.kind === 'pop') E.pop(t, c.note, c.g, c.p ?? 0);
    else if (c.kind === 'tick') E.tick(t, c.g, c.k ?? Math.round(c.n));
  }
}
function sfxWhooshes(E) { for (const w of whooshes) E.whoosh(T(w.n), w.g, w.pre, w.post, w.p[0], w.p[1]); }

const stem = (name, fn) => { const E = makeEngine(DUR); fn(E); const [l, r] = E.mixdown(BEAT); writeWav(join(A, name), l, r); return [l, r]; };
const mus = stem('music.wav', music), pts = stem('points.wav', sfxPoints), wsh = stem('whoosh.wav', sfxWhooshes);
const MUSIC_G = .38, N = mus[0].length, raw = [new Float32Array(N), new Float32Array(N)];
for (let c = 0; c < 2; c++) for (let i = 0; i < N; i++) raw[c][i] = mus[c][i] * MUSIC_G + pts[c][i] + wsh[c][i];
let peak = 0; for (const ch of raw) for (const x of ch) peak = Math.max(peak, Math.abs(x));
const norm = Math.pow(10, -3 / 20) / peak;                  // raw.wav peaks at −3 dBFS
for (const ch of raw) for (let i = 0; i < N; i++) ch[i] *= norm;
writeWav(join(A, 'raw.wav'), raw[0], raw[1]);
// QA: every point cue rendered alone (cues sit 33 ms apart and inside each other's reverb tails in the mix),
// sliced from 0.1 s before its cue; tools/audio_qa.py times each attack on its own slice
const QA = join(A, 'qa'); mkdirSync(QA, { recursive: true });
const qaPoints = points.map((c, i) => {
  const t = T(c.n), E = makeEngine(Math.min(DUR, t + .35));
  sfxPoints(E, [c]);
  const [l, r] = E.mixdown(BEAT), a = Math.max(0, Math.round((t - .1) * SR)), file = `p${String(i).padStart(2, '0')}.wav`;
  writeWav(join(QA, file), l.slice(a), r.slice(a));
  return { ...c, t, qa: file, qaStart: a / SR };
});
writeFileSync(join(A, 'cues.json'), JSON.stringify({ points: qaPoints, whooshes: whooshes.map(w => ({ ...w, t: T(w.n) })) }, null, 1));

// ───────────── master: −14 LUFS, ≤ −1 dBTP after AAC (gain solved against ffmpeg's ebur128) ─────────────
const ff = (args, what) => { const r = spawnSync('ffmpeg', ['-hide_banner', ...args], { encoding: 'utf8' }); if (r.status) throw new Error(`${what}: ${r.stderr}`); return r.stderr; };
function measure(path) {
  const s = ff(['-nostats', '-i', path, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'], 'measure');
  const I = Number(s.match(/I:\s+(-?[\d.]+) LUFS/g).pop().match(/-?[\d.]+/)[0]);
  const tp = s.match(/True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS/);
  return { I, TP: tp ? Number(tp[1]) : NaN };
}
const MASTER = join(A, 'master.wav');
const chain = (gainDb, ceilDb) => [`volume=${gainDb.toFixed(3)}dB`, `alimiter=limit=${Math.pow(10, ceilDb / 20).toFixed(4)}:attack=1.5:release=45:level=false:latency=true`,
  `apad=whole_dur=${DUR}`, `atrim=end=${DUR}`, `afade=t=out:st=${(DUR - .06).toFixed(3)}:d=0.06`].join(',');
function master(gainDb, ceilDb) { ff(['-v', 'error', '-y', '-i', join(A, 'raw.wav'), '-af', chain(gainDb, ceilDb), '-ar', '48000', '-c:a', 'pcm_s24le', MASTER], 'master'); }
function aacPeak() { const tmp = join(A, 'aac-check.m4a'); ff(['-v', 'error', '-y', '-i', MASTER, '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', tmp], 'aac'); return measure(tmp).TP; }
let gain = TARGET - measure(join(A, 'raw.wav')).I, ceil = -1.6, m, aac = NaN;
for (let it = 0; it < 12; it++) {
  master(gain, ceil); m = measure(MASTER);
  const loudOk = Math.abs(m.I - TARGET) <= .1;
  aac = m.TP <= TP_MAX && loudOk ? aacPeak() : NaN;
  if (m.TP > TP_MAX) { ceil -= .3; continue; }
  if (!loudOk) { gain += TARGET - m.I; continue; }
  if (aac > TP_MAX - .05) { ceil -= .2; continue; }
  break;
}
console.log(`master.wav: ${m.I} LUFS, ${m.TP} dBTP (${aac} dBTP after AAC), gain ${gain.toFixed(2)} dB, ceiling ${ceil.toFixed(1)} dBFS`);
if (Math.abs(m.I - TARGET) > .2 || m.TP > TP_MAX || !(aac <= TP_MAX)) { console.error('MASTER OUT OF SPEC'); process.exit(1); }

// stems for an editor (same gain as the master, before its limiter): music and all SFX
const stemOut = (srcs, gains, name) => {
  const inputs = srcs.flatMap(s => ['-i', join(A, s)]);
  const mixf = srcs.length > 1 ? `${srcs.map((_, i) => `[${i}:a]volume=${(gains[i] * norm).toFixed(5)}[s${i}]`).join(';')};${srcs.map((_, i) => `[s${i}]`).join('')}amix=inputs=${srcs.length}:normalize=0,volume=${gain.toFixed(3)}dB`
    : `volume=${(gains[0] * norm).toFixed(5)},volume=${gain.toFixed(3)}dB`;
  ff(['-v', 'error', '-y', ...inputs, srcs.length > 1 ? '-filter_complex' : '-af', mixf, '-ar', '48000', '-c:a', 'pcm_s24le', join(STEMS, name)], 'stem ' + name);
};
stemOut(['music.wav'], [MUSIC_G], 'hf02-music.wav');
stemOut(['points.wav', 'whoosh.wav'], [1, 1], 'hf02-sfx.wav');

// mux onto the silent picture
const silent = join(ROOT, 'out/hf02-recreate-silent.mp4');
if (!existsSync(silent)) { console.error('render the picture first: node render.mjs'); process.exit(1); }
ff(['-v', 'error', '-y', '-i', silent, '-i', MASTER, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-shortest', '-movflags', '+faststart', join(ROOT, 'hf02-recreate.mp4')], 'mux');
console.log('wrote hf02-recreate.mp4 (+ audio/hf02-music.wav, audio/hf02-sfx.wav)');
