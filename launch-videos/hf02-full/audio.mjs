// Sound for the full film: an ORIGINAL score + SFX, all synthesized with the product-launch-sting voice engine.
// From the reference we take timing only: its tempo grid (87.46 BPM, first beat 0.3905 s, `node lib/breakdown.mjs --tempo`)
// and where its energy thins out or hits (ref/audio/beats.json). Chords, voicings, melody, drums and sound design are ours.
//   node audio.mjs   → out/audio/{music,points,whoosh,raw,master}.wav, audio/film-{music,sfx}.wav stems, cues.json,
//                      and film.mp4 (out/film-silent.mp4 + master) when the picture exists
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const ENGINE = join(homedir(), '.claude/skills/product-launch-sting/video/lib');
const { makeEngine, writeWav } = await import(join(ENGINE, 'voices.mjs'));
const { SR } = await import(join(ENGINE, 'common.mjs'));

const ROOT = resolve(import.meta.dirname);
const A = join(ROOT, 'out/audio'), STEMS = join(ROOT, 'audio');
mkdirSync(A, { recursive: true }); mkdirSync(STEMS, { recursive: true });
const DUR = 1909 / 30, TARGET = -14, TP_MAX = -1.0;
const T = n => n / 30;                                   // film frame → seconds

// ───────────── the grid (timing from the reference) ─────────────
const BPM = 87.46, BEAT = 60 / BPM, B0 = 0.3905;          // beat k at B0 + k·BEAT; bars of 4 start on beat 3 (2.449 s)
const bt = k => B0 + k * BEAT;
// section map, in beats (the reference's energy: soft pickup, steady body, two dips, a lift, near-silence, one hit)
// drop / silence / hit re-measured 2026-10-22 on the reference's decoded audio (tools/beat_check.py): it fades from 57.1 s to a
// −30…−36 dB bed, is silent from 59.5 s, and hits at 59.939 s (n1798.2)
const SEC = { grooveIn: 5, full: 7, dip1: [54, 57], dip2: [75, 78], lift: [78, 82.6], drop: B0 + 82.6 * BEAT, silence: [59.5, 59.939], hit: 59.939 };

// ───────────── cues: every SFX is tied to a picture event in our film (frames = the reference's frames) ─────────────
// cues.local.json (written at integration from the builders' notes) overrides this provisional list when present.
let CUES = {
  whooshes: [   // n = fastest frame; pre/post = build and tail (s)
    { n: 74.5, g: .30, pre: .40, post: .2, p: [0, 0], what: 'push-in into the fly-through' },
    { n: 97.5, g: .26, pre: .5, post: .18, p: [0, 0], what: 'corridor ends on the plate card' },
    { n: 231, g: .30, pre: .2, post: .16, p: [.2, -.4], what: 'prompt bar whips off' },
    { n: 311.5, g: .30, pre: .32, post: .16, p: [-.5, .5], what: 'momentum cut, pan right' },
    { n: 333.5, g: .15, pre: .34, post: .2, p: [-.3, .3], what: 'pan reveals the roster' },
    { n: 357, g: .26, pre: .38, post: .18, p: [.1, -.1], what: 'dissolve into the roster' },
    { n: 439.5, g: .17, pre: .24, post: .14, p: [0, 0], what: 'fast three-row run' },
    { n: 464.5, g: .28, pre: .36, post: .16, p: [0, 0], what: 'cut, moving up' },
    { n: 485.5, g: .14, pre: .22, post: .14, p: [0, 0], what: 'new message scrolls' },
    { n: 509.5, g: .30, pre: .40, post: .16, p: [0, 0], what: 'cut into the review card' },
    { n: 580, g: .26, pre: .5, post: .3, p: [-.6, .4], what: 'deck rushes past' },
    { n: 842.5, g: .32, pre: .45, post: .2, p: [0, 0], what: 'thread whips into the wall' },
    { n: 999.5, g: .30, pre: .3, post: .16, p: [0, 0], what: 'whip out of the insights' },
    { n: 1135, g: .26, pre: .45, post: .2, p: [0, 0], what: 'zoom through the front screen' },
    { n: 1208, g: .28, pre: .3, post: .16, p: [0, 0], what: 'white whip into building' },
    { n: 1290, g: .22, pre: .3, post: .25, p: [-.6, .6], what: 'the crew bursts out' },
    { n: 1318, g: .2, pre: .3, post: .12, p: [.5, -.5], what: 'the crew collapses' },
    { n: 1426, g: .28, pre: .3, post: .16, p: [0, 0], what: 'whip to the phone' },
    { n: 1530.5, g: .30, pre: .3, post: .18, p: [0, 0], what: 'phone whips up, plate 2 enters' },
  ],
  points: [],   // {n, kind: 'pop'|'tick'|'click', note, g, p, what}
};
const local = join(ROOT, 'cues.local.json');
if (existsSync(local)) CUES = { ...CUES, ...JSON.parse(readFileSync(local, 'utf8')) };

// ───────────── music (ours): F major at 87.46 BPM, written to the reference's measured feel ─────────────
// tools/music_profile.py on the reference: every 16th busy in the mids and highs (no hard backbeat), a syncopated low end,
// about half the energy below 120 Hz, centroid ~3.4 kHz, tonal centre F major. The chords, patterns and motif are our own.
const PROG_A = [[[57, 60, 64, 67], 41], [[53, 57, 60, 64], 38], [[57, 60, 62, 65], 46], [[55, 60, 62, 67], 48]];   // Fmaj9 · Dm9 · B♭maj9 · Csus2
const PROG_B = [[[57, 60, 62, 65], 46], [[58, 62, 65, 69], 43], [[53, 57, 60, 65], 45], [[55, 60, 62, 67], 48]];   // B♭maj9 · Gm9 · F/A · Csus2
const PROG_L = [[[53, 57, 60, 64], 38], [[57, 60, 62, 65], 46], [[57, 60, 65, 69], 48], [[55, 60, 64, 67], 48]];   // Dm9 · B♭maj9 · F/C · C
const inDip = k => (k >= SEC.dip1[0] && k < SEC.dip1[1]) || (k >= SEC.dip2[0] && k < SEC.dip2[1]);
function chordAt(k) {                                      // beat k → [pad notes, bass root]
  const bar = Math.floor((k - 3) / 4);
  if (k >= SEC.lift[0]) return PROG_L[((bar % 4) + 4) % 4];
  if (k >= SEC.dip1[1]) return PROG_B[((bar % 4) + 4) % 4];
  return PROG_A[((bar % 4) + 4) % 4];
}
const MIX = { pad: .02, arp: .12, arpUp: .05, arpHi: .06, stab: .085, hat: .3, shaker: 1.2, bass: .1, kick: .64, clap: .32, motif: .07, stabCut: 9000 };
// a band-passed noise shaker around 4.5 kHz (the engine has nothing between the clap and the hats): the reference's upper mids
function shaker(E, t0, g, p = 0) {
  const i0 = Math.round(t0 * SR), n = Math.round(.06 * SR), w = 2 * Math.PI * 4500 / SR, al = Math.sin(w) / (2 * .8), a0 = 1 + al;
  const b0 = al / a0, b2 = -al / a0, a1 = -2 * Math.cos(w) / a0, a2 = (1 - al) / a0, pl = Math.cos((p + 1) * Math.PI / 4), pr = Math.sin((p + 1) * Math.PI / 4);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, seed = i0 * 2654435761 >>> 0;
  for (let j = 0; j < n; j++) {
    seed = (seed * 1664525 + 1013904223) >>> 0; const x = seed / 4294967296 * 2 - 1, t = j / SR;
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y;
    const v = y * Math.min(1, t / .003) * Math.exp(-t / .022) * g; E.put(i0 + j, v * pl, v * pr, .06);
  }
}   // tuned against the reference profile
function music(E) {
  const end = SEC.drop, s16 = BEAT / 4, lift = k => k >= SEC.lift[0] && k < SEC.lift[1];
  const barStart = k => k - ((k - 3) % 4 + 4) % 4;                      // bars of 4 start on beat 3
  // warm pad underneath: one chord per bar (the pickup holds the first chord)
  for (let k = 3 - 4; bt(k) < end; k += 4) {
    const [ch] = chordAt(Math.max(k, 3)), s = Math.max(0, bt(k)), e = Math.min(end + .5, bt(k + 4));
    E.pad(s, e, ch, k < SEC.grooveIn ? MIX.pad * 1.5 : MIX.pad, k < 3 ? .5 : .1, .3);
  }
  // 16th pluck arpeggio an octave up: the even mid/high motion; beat accents keep the pulse; a top layer in the lift
  const ARP = [0, 2, 1, 3, 2, 0, 3, 1, 0, 3, 2, 1, 3, 1, 2, 0];
  for (let k = 0, i = 0; bt(k) < end - .03; k += .25, i++) {
    const [ch] = chordAt(k), dip = inDip(k), up = i % 8 === 6 ? 12 : 0;
    const g = MIX.arp * (i % 4 === 0 ? 1 : .6) * (dip ? .6 : 1) * (k < SEC.grooveIn ? .7 : 1);
    E.pluck(bt(k), ch[ARP[i % 16]] + 12 + up, g, i % 2 ? .3 : -.3);
    if (lift(k) && i % 2 === 1) E.pluck(bt(k), ch[ARP[(i + 5) % 16]] + 24, MIX.arpUp, i % 4 === 1 ? .6 : -.6);
    else if (k >= SEC.grooveIn && i % 2 === 0) E.pluck(bt(k), ch[ARP[(i + 9) % 16]] + 24, MIX.arpHi * (dip ? .5 : 1), i % 4 === 0 ? .5 : -.5);
  }
  // bright chord stabs on beats 1 and 3 from the full section (they mark the beat), a light pickup on the and of 4
  for (let k = SEC.full; bt(k) < end - .05; k += 1) {
    if (inDip(k)) continue;
    const pos = ((k - 3) % 4 + 4) % 4;
    if (pos === 0 || pos === 2) { const [ch] = chordAt(k); E.stab(bt(k), ch.map(m => m + 12), MIX.stab, .09, MIX.stabCut, .16); }
    if (pos === 3) { const [ch] = chordAt(k + .5); E.stab(bt(k + .5), ch.map(m => m + 12), MIX.stab * .45, .07, MIX.stabCut, .12); }
  }
  // shaker on every 16th from the groove-in, open hat on the and of 2 and 4; eighths only in the dips
  const HV = [1, .48, .7, .52];
  for (let k = SEC.grooveIn, i = 0; bt(k) < end - .03; k += .25, i++) {
    const dip = inDip(k); if (dip && i % 2) continue;
    const p16 = Math.round((((k - 3) % 4) + 4) % 4 * 4) % 16, open = !dip && (p16 === 6 || p16 === 14);
    E.hat(bt(k), MIX.hat * (open ? .4 : 1) * HV[i % 4] * (dip ? .6 : 1) * (lift(k) ? 1.15 : 1), open, i % 2 ? .35 : -.2);
    shaker(E, bt(k), MIX.shaker * (i % 4 === 0 ? 1 : i % 2 ? .5 : .7) * (dip ? .5 : 1), i % 2 ? -.3 : .3);
  }
  // syncopated bass, our own 16th pattern per bar: [16th, length in 16ths, interval]; held roots in the dips
  const BASS = [[0, 1.5, 0], [2, 1.5, 0], [5, 1, 12], [7, 1.5, 0], [10, 2, 0], [13, 1, 7], [15, 1, 12]];
  for (let b = barStart(SEC.grooveIn); bt(b) < end - .05; b += 4) {
    for (const [p, len, iv] of BASS) {
      const k = b + p / 4; if (k < SEC.grooveIn || bt(k) >= end - .05) continue;
      const [, root] = chordAt(k);
      if (inDip(k)) { if (p === 0) E.bass(bt(k), BEAT * 4 - .08, root, MIX.bass * .7); continue; }
      E.bass(bt(k), len * s16 - .02, root + iv, MIX.bass);
    }
  }
  // kick on 1 and 3 with a ghost before beat 4, light sidechain; a soft clap on 2 and 4 (the reference has no hard backbeat)
  for (let k = SEC.grooveIn; bt(k) < end - .05; k += 1) {
    if (inDip(k)) continue;
    const pos = ((k - 3) % 4 + 4) % 4, full = k >= SEC.full;
    if (pos === 0 || pos === 2) E.kick(bt(k), full ? MIX.kick : MIX.kick * .76, .22);
    if (full && pos === 2) E.kick(bt(k + .75), MIX.kick * .38, .1);
    if (full && (pos === 1 || pos === 3)) E.clap(bt(k), MIX.clap);
  }
  // our motif: four mallet notes from the chord, every other bar in the full sections
  const MOTIF = [[0, 3], [1.5, 2], [2.5, 1], [3, 3]];                     // [beat in the bar, chord tone]
  for (let b = barStart(SEC.full) + (SEC.full === barStart(SEC.full) ? 0 : 4); bt(b) < end - .5; b += 8) {
    if (inDip(b) || inDip(b + 3)) continue;
    const [ch] = chordAt(b);
    MOTIF.forEach(([o, idx], i) => E.mallet(bt(b + o), ch[idx] + 12, MIX.motif, i % 2 ? .25 : -.25));
  }
  // section marks: crashes on the way in/out of the dips and the lift; risers into them
  [SEC.full, SEC.dip1[1], SEC.lift[0]].forEach(k => E.crash(bt(k), .12));
  E.riser(bt(SEC.dip1[1]) - 1.2, bt(SEC.dip1[1]) - .02, .08, 400, 6000);
  E.riser(bt(SEC.lift[0]) - 1.2, bt(SEC.lift[0]) - .02, .1, 500, 8000);
  // the drop (57.06 s): a very quiet bell bed in F, then the breath of silence
  [[65, 69, 72], [64, 67, 72], [65, 69, 74]].forEach((ch, i) => ch.forEach((m, j) => E.mallet(SEC.drop + .15 + i * .62 + j * .07, m + 12, .025, j - 1)));
  E.pad(SEC.drop + .05, SEC.silence[0] - .05, [53, 57, 60, 64], .012, .25, .2);
  // the hit on the end card: a low boom, a stab and a long sub in F
  E.kick(SEC.hit, 1.0, .9); E.bass(SEC.hit, 1.5, 41, .42); E.stab(SEC.hit, [53, 60, 65, 69], .3, .5, 2400, 1.2); E.crash(SEC.hit, .22);
}
function sfxPoints(E, list = CUES.points) {
  for (const c of list) {
    const t = T(c.n);
    if (c.kind === 'pop') E.pop(t, c.note ?? 84, c.g, c.p ?? 0);
    else if (c.kind === 'tick') E.tick(t, c.g, c.k ?? Math.round(c.n));
    else if (c.kind === 'click') E.click(t, c.g);
  }
}
function sfxWhooshes(E) { for (const w of CUES.whooshes) E.whoosh(T(w.n), w.g, w.pre, w.post, w.p[0], w.p[1]); }

const stem = (name, fn) => { const E = makeEngine(DUR); fn(E); const [l, r] = E.mixdown(BEAT); writeWav(join(A, name), l, r); return [l, r]; };
const mus = stem('music.wav', music), pts = stem('points.wav', sfxPoints), wsh = stem('whoosh.wav', sfxWhooshes);
const MUSIC_G = .42, N = mus[0].length, raw = [new Float32Array(N), new Float32Array(N)];
for (let c = 0; c < 2; c++) for (let i = 0; i < N; i++) raw[c][i] = mus[c][i] * MUSIC_G + pts[c][i] + wsh[c][i];
// the breath before the hit is true silence
for (let c = 0; c < 2; c++) for (let i = Math.round(SEC.silence[0] * SR); i < Math.round(SEC.hit * SR) - 32; i++) raw[c][i] = 0;
let peak = 0; for (const ch of raw) for (const x of ch) peak = Math.max(peak, Math.abs(x));
const norm = Math.pow(10, -3 / 20) / peak;
for (const ch of raw) for (let i = 0; i < N; i++) ch[i] *= norm;
writeWav(join(A, 'raw.wav'), raw[0], raw[1]);
const QA = join(A, 'qa'); mkdirSync(QA, { recursive: true });
const qaPoints = CUES.points.map((c, i) => {
  const t = T(c.n), E = makeEngine(Math.min(DUR, t + .35));
  sfxPoints(E, [c]);
  const [l, r] = E.mixdown(BEAT), a = Math.max(0, Math.round((t - .1) * SR)), file = `p${String(i).padStart(3, '0')}.wav`;
  writeWav(join(QA, file), l.slice(a), r.slice(a));
  return { ...c, t, qa: file, qaStart: a / SR };
});
writeFileSync(join(A, 'cues.json'), JSON.stringify({ bpm: BPM, firstBeat: B0, sections: SEC, points: qaPoints, whooshes: CUES.whooshes.map(w => ({ ...w, t: T(w.n) })) }, null, 1));

// ───────────── master: −14 LUFS, ≤ −1 dBTP after AAC ─────────────
const ff = (args, what) => { const r = spawnSync('ffmpeg', ['-hide_banner', ...args], { encoding: 'utf8' }); if (r.status) throw new Error(`${what}: ${r.stderr}`); return r.stderr; };
function measure(path) {
  const s = ff(['-nostats', '-i', path, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'], 'measure');
  const I = Number(s.match(/I:\s+(-?[\d.]+) LUFS/g).pop().match(/-?[\d.]+/)[0]);
  const tp = s.match(/True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS/);
  return { I, TP: tp ? Number(tp[1]) : NaN };
}
const MASTER = join(A, 'master.wav');
const chain = (gainDb, ceilDb) => [`volume=${gainDb.toFixed(3)}dB`, `alimiter=limit=${Math.pow(10, ceilDb / 20).toFixed(4)}:attack=1.5:release=45:level=false:latency=true`,
  `apad=whole_dur=${DUR}`, `atrim=end=${DUR}`].join(',');
function master(gainDb, ceilDb) { ff(['-v', 'error', '-y', '-i', join(A, 'raw.wav'), '-af', chain(gainDb, ceilDb), '-ar', '48000', '-c:a', 'pcm_s24le', MASTER], 'master'); }
function aacPeak() { const tmp = join(A, 'aac-check.m4a'); ff(['-v', 'error', '-y', '-i', MASTER, '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', tmp], 'aac'); return measure(tmp).TP; }
let gain = TARGET - measure(join(A, 'raw.wav')).I, ceil = -1.6, m, aac = NaN;
for (let it = 0; it < 14; it++) {
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

const stemOut = (srcs, gains, name) => {
  const inputs = srcs.flatMap(s => ['-i', join(A, s)]);
  const mixf = srcs.length > 1 ? `${srcs.map((_, i) => `[${i}:a]volume=${(gains[i] * norm).toFixed(5)}[s${i}]`).join(';')};${srcs.map((_, i) => `[s${i}]`).join('')}amix=inputs=${srcs.length}:normalize=0,volume=${gain.toFixed(3)}dB`
    : `volume=${(gains[0] * norm).toFixed(5)},volume=${gain.toFixed(3)}dB`;
  ff(['-v', 'error', '-y', ...inputs, srcs.length > 1 ? '-filter_complex' : '-af', mixf, '-ar', '48000', '-c:a', 'pcm_s24le', join(STEMS, name)], 'stem ' + name);
};
stemOut(['music.wav'], [MUSIC_G], 'film-music.wav');
stemOut(['points.wav', 'whoosh.wav'], [1, 1], 'film-sfx.wav');

const silent = join(ROOT, 'out/film-silent.mp4');
if (!existsSync(silent)) { console.log('no picture yet: node render.mjs, then re-run'); process.exit(0); }
ff(['-v', 'error', '-y', '-i', silent, '-i', MASTER, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-shortest', '-movflags', '+faststart', join(ROOT, 'film.mp4')], 'mux');
console.log('wrote film.mp4 (+ audio/film-music.wav, audio/film-sfx.wav)');
