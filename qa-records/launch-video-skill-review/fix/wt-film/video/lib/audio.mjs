// Timeline → stems → raw mix.
//   music.wav  : the arranged cue (style playful | keynote | calm), or the user's track, or silence (none)
//   points.wav : every point SFX (pops, ticks, clicks, chimes, hits) — QA times onsets on this stem
//   whoosh.wav : the transition whooshes — QA times their peaks on this stem
//   raw.wav    : music + SFX (+ voiceover, with the music ducked under it), peak-normalised to −3 dBFS
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SR, ff, sh, measureLoudness, UserError } from './common.mjs';
import { makeEngine, writeWav } from './voices.mjs';
import { KEYS } from './spec.mjs';
import { audioPrint } from './fingerprint.mjs';

const SCALE = [0, 2, 4, 5, 7, 9, 11];
const chordPcs = (keyPc, deg, n = 4) => Array.from({ length: n }, (_, i) => (keyPc + SCALE[(deg + 2 * i) % 7]) % 12);
const voice = (pcs, lo) => pcs.map(pc => lo + ((pc - lo) % 12 + 12) % 12).sort((a, b) => a - b);
const rootOf = (keyPc, deg, lo = 36) => lo + (((keyPc + SCALE[deg]) - lo) % 12 + 12) % 12;
const PROG = { playful: [0, 5, 3, 4], keynote: [0, 5, 3, 4], calm: [0, 4, 5, 3] };

function arrange(tl, E) {
  const m = tl.music, style = m.style, beat = tl.beat, dur = tl.dur, keyPc = KEYS[m.key] ?? 0, bar = 4 * beat;
  const dropShot = tl.shots.find(s => s.id === m.drop) || tl.shots[1] || tl.shots[0];
  const dropT = dropShot.start, endT = tl.endcard != null && tl.endcard > dropT ? tl.endcard : dur;
  const breaks = tl.shots.filter(s => m.breaks.includes(s.id)).map(s => [s.start, s.end]);
  const inBreak = t => breaks.some(([a, b]) => t >= a - .001 && t < b - .001);
  const degAt = t => t < dropT ? ((dropT - t <= bar && dropT >= 1.5 * bar) ? 4 : 0) : PROG[style][Math.floor((t - dropT + 1e-6) / bar) % 4];
  const chord = (t, lo = 53) => voice(chordPcs(keyPc, degAt(t)), lo);
  const P = { // per-style knobs
    playful: { kick: .62, kickDepth: .5, clap: .6, oh: .2, ch: [.1, .12], bass: .34, padG: .04, introPad: .085, arp: 'mallet', arpG: [.1, .15], mel: [.2, .12] },
    keynote: { kick: .72, kickDepth: .62, clap: .72, oh: .3, ch: [.14, .18], bass: .3, padG: .04, introPad: .085, arp: 'pluck', arpG: [.13, .23], mel: [.065, .04] },
    calm: { kick: .5, kickDepth: .35, clap: 0, oh: 0, ch: [.06, .06], bass: .3, padG: .06, introPad: .09, arp: 'pluck', arpG: [.08, .12], mel: [.07, .05] },
  }[style];

  // ── intro: pad + arpeggio, light time-keeping, a riser into the drop ──
  if (dropT > .2) {
    E.pad(0, dropT, chord(0), P.introPad, Math.min(1.2, dropT * .6), .25);
    const n = Math.floor(dropT / (beat / 2));
    for (let k = 0; k < n; k++) {
      const t = k * beat / 2, notes = chord(t).map(x => x + 12), seq = [0, 2, 1, 3, 2, 1, 3, 0];
      E[P.arp](t, notes[seq[k % 8]] + (P.arp === 'mallet' ? 12 : 0), P.arpG[0] + (P.arpG[1] - P.arpG[0]) * k / Math.max(1, n - 1), k % 2 ? .4 : -.4);
    }
    if (style === 'playful') for (let t = beat; t < dropT - .05; t += 2 * beat) E.clap(t, .28);
    if (style === 'keynote') for (let t = 2 * beat; t < dropT - .05; t += beat / 2) E.hat(t + beat / 4, .1, false, .3);
    E.riser(Math.max(.1, dropT - Math.min(1.4, dropT - .2)), dropT - .005, .3);
  }
  // ── groove: drop → end card ──
  for (let t = dropT, k = 0; t < endT - 1e-6; t += beat, k++) {
    if (inBreak(t)) continue;
    if (style !== 'calm' || k % 2 === 0) E.kick(t, P.kick, P.kickDepth);
    if (P.clap && k % 2 === 1) E.clap(t, P.clap);
    if (P.oh && t + beat / 2 < endT - .02) E.hat(t + beat / 2, P.oh, true, .2);
    for (const [q, g] of [[.25, P.ch[0]], [.75, P.ch[1]]]) if (t + q * beat < endT - .02) E.hat(t + q * beat, g, false, -.3);
  }
  for (let b0 = dropT; b0 < endT - 1e-6; b0 += bar) {
    const len = Math.min(bar, endT - b0), deg = degAt(b0 + .001), root = rootOf(keyPc, deg), ch = voice(chordPcs(keyPc, deg), 53);
    const quiet = inBreak(b0);
    if (style === 'calm') E.bass(b0, Math.max(.2, len - .15), root, quiet ? P.bass * .5 : P.bass);
    else for (const [o, l, oct] of style === 'playful' ? [[0, .4, 0], [1.5, .28, 12], [2, .4, 0], [3, .28, 0], [3.5, .24, 12]] : [[.5, .38, 0], [1.5, .38, 0], [2.5, .38, 0], [3.5, .28, 12], [3.75, .2, 0]])
      if (o * beat < len - .03 && !quiet) E.bass(b0 + o * beat, l * beat, root + oct, P.bass);
    E.pad(b0, b0 + len, ch, P.padG * (quiet ? 1.6 : 1), .06, .1);
    if (style === 'playful') {
      for (const [o, g] of [[.5, .12], [1.5, .09], [2.5, .12], [3.25, .08]]) if (o * beat < len - .05) for (const n of ch.slice(1)) E.mallet(b0 + o * beat, n + 12, g * .8, 0);
      const mel = [3, 2, 1, 2, 3, 3, 2, 0];
      for (let s = 0; s < len / (beat / 2); s++) E.mallet(b0 + s * beat / 2, ch[mel[s % 8]] + 24, s % 2 ? P.mel[1] : P.mel[0], s % 2 ? .45 : -.45);
    } else if (style === 'keynote') {
      if (!quiet) for (const [o, g] of [[.5, .17], [1.25, .105], [2.5, .17], [3.25, .105], [3.75, .135]]) if (o * beat < len - .05) E.stab(b0 + o * beat, ch, g, .2, 4800);
      const seq = [0, 1, 2, 3, 2, 1, 3, 0, 1, 2, 3, 2, 0, 3, 1, 2];
      for (let s = 0; s < len / (beat / 4); s++) E.pluck(b0 + s * beat / 4, ch[seq[s % 16]] + 24, s % 4 === 0 ? P.mel[0] : P.mel[1], s % 2 ? .5 : -.5);
    } else {
      for (let s = 0; s < len / (beat / 2); s++) E.pluck(b0 + s * beat / 2, ch[[0, 2, 1, 3][s % 4]] + 12, s % 4 === 0 ? P.mel[0] : P.mel[1], s % 2 ? .4 : -.4);
      if (3 * beat < len) E.mallet(b0 + 3 * beat, ch[3] + 24, .06, .3);
    }
  }
  // drops back in after each break: a short riser into the next shot
  for (const [, b] of breaks) if (b < endT - .2) E.riser(Math.max(0, b - Math.min(1.2, 2 * beat)), b - .005, .2, 600, 9000);
  // ── end card: crash + a held tonic chord ringing out ──
  if (endT < dur - .05) {
    const tonic = voice(chordPcs(keyPc, 0, 5), 53);
    E.crash(endT, .22);
    E.stab(endT, tonic, style === 'calm' ? .08 : .12, .8, style === 'calm' ? 2200 : 3200, Math.min(1.8, dur - endT));
    E.bass(endT, Math.max(.3, dur - endT - .2), rootOf(keyPc, 0, 28), .3);
    E.pad(endT, dur, [...tonic, tonic[0] + 12], .05, .05, .1);
    if (style !== 'calm') [0, 2, 4, 7, 9, 12].forEach((d, i) => E.mallet(endT + .1 + i * .09, tonic[0] + 12 + d, .1, i % 2 ? .4 : -.4));
    if (style === 'playful') for (let t = endT; t < dur - .1; t += 2 * beat) E.kick(t, .45, .3);
  }
}

function sfx(tl, E, { points = true, whooshes = true, only = null } = {}) {
  if (points) tl.cues.forEach((c, k) => {
    if (only && !only.has(k)) return;
    const g = c.gain ?? 1, p = ((k % 5) - 2) * .2;
    if (c.kind === 'pop') E.pop(c.t, c.note ?? 79, .28 * g, p);
    else if (c.kind === 'tick') E.tick(c.t, .07 * g, k);
    else if (c.kind === 'click') E.click(c.t, .32 * g);
    else if (c.kind === 'chime') E.chime(c.t, .22 * g);
    else if (c.kind === 'hit') E.hit(c.t, .38 * g, c.note ?? 89);
  });
  if (whooshes) tl.whooshes.forEach((w, i) => {
    const dir = { 'whip-left': [.5, -.5], 'whip-right': [-.5, .5], 'smear-left': [.6, -.6], 'smear-right': [-.6, .6] }[w.out] || (i % 2 ? [.4, -.4] : [-.4, .4]);
    // the cross-cut transitions get their own flavour (each still peaks on its cut — QA times them like any whoosh)
    if (w.out === 'glitch') { E.glitch(w.t, .13, i + 1); E.sweep(w.t, .1, { pre: .22, post: .08, f0: 900, fp: 5200, f2: 2400, q: 1.4, low: .3, tail: .03 }); }
    else if (w.out === 'smear-left' || w.out === 'smear-right') E.sweep(w.t, .3, { pre: .34, post: .14, f0: 500, fp: 5200, f2: 1300, q: .8, low: 1.1, p0: dir[0], p1: dir[1] });
    else if (w.out === 'tunnel') E.sweep(w.t, .34, { pre: .62, post: .24, f0: 120, fp: 2600, f2: 260, q: .7, low: 2.6, tail: .09, p0: dir[0] * .5, p1: dir[1] * .5 });
    else if (w.out === 'flash') E.sweep(w.t, .26, { pre: .3, post: .2, f0: 1500, fp: 9000, f2: 4200, q: .7, low: .25, tail: .08, p0: dir[0] * .4, p1: dir[1] * .4 });
    // a drift cut is a camera drift, not a whip: a lighter, shorter whoosh (still peaking on the cut)
    else if (/^drift-/.test(w.out)) { const d = { 'drift-left': [.4, -.4], 'drift-right': [-.4, .4] }[w.out] || dir; E.whoosh(w.t, .22, .36, .14, d[0], d[1]); }
    else E.whoosh(w.t, .3, .42, .16, dir[0], dir[1]);
  });
}

function readF32(path) {                       // my own float WAVs (44-byte header) or ffmpeg raw .f32
  const buf = readFileSync(path), off = path.endsWith('.wav') ? 44 : 0, n = (buf.length - off) / 8;
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = buf.readFloatLE(off + i * 8); R[i] = buf.readFloatLE(off + i * 8 + 4); }
  return [L, R];
}
const toF32 = (job, src, out, dur, start = 0, pad = 0) => ff(['-ss', String(start), '-i', join(job, src), '-t', String(dur), '-ac', '2', '-ar', String(SR),
  '-af', `adelay=${Math.round(pad * 1000)}|${Math.round(pad * 1000)},apad=whole_dur=${dur},atrim=end=${dur}`, '-f', 'f32le', out], `decode ${src}`);

// problems with the job's own audio files for this timeline: a track that runs out before the film ends (errors), a
// voiceover that runs past the end (warns). lv.mjs prints both at --grid / --storyboard; buildAudio refuses errors.
const durCache = new Map();
const fileDur = p => { if (!durCache.has(p)) durCache.set(p, Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p]).stdout.trim())); return durCache.get(p); };
export function audioIssues(job, tl) {
  const errors = [], warns = [];
  if (tl.music.style === 'track' && tl.music.file) {
    const len = fileDur(join(job, tl.music.file)), avail = len - tl.music.start;
    if (Number.isFinite(len) && avail < tl.dur - .05) errors.push(`music.file ${tl.music.file} is ${len.toFixed(2)} s long: from music.start ${tl.music.start} s it covers ${Math.max(0, avail).toFixed(2)} s of this ${tl.dur.toFixed(2)} s cut, so the music would stop early — lower music.start, use a longer track, or shorten the video`);
  }
  if (tl.vo) {
    const len = fileDur(join(job, tl.vo.file)), over = tl.vo.start + len - tl.dur;
    if (tl.vo.start >= tl.dur) errors.push(`voiceover ${tl.vo.file} starts at ${tl.vo.start} s, after this ${tl.dur.toFixed(2)} s cut ends`);
    else if (Number.isFinite(len) && over > .05) warns.push(`voiceover ${tl.vo.file} runs ${over.toFixed(2)} s past the end of this cut and gets cut off — trim the read or lower voiceover.start`);
  }
  return { errors, warns };
}

export function buildAudio(job, tl, dir, { check = true } = {}) {
  const issues = check ? audioIssues(job, tl) : { errors: [] };
  if (issues.errors.length) throw new UserError(issues.errors.join('\n'));
  mkdirSync(dir, { recursive: true });
  const N = Math.round(tl.dur * SR);
  const stem = (name, fn) => { const E = makeEngine(tl.dur); fn(E); const [l, r] = E.mixdown(tl.beat); writeWav(join(dir, name), l, r); return [l, r]; };
  const points = stem('points.wav', E => sfx(tl, E, { whooshes: false }));
  const whoosh = stem('whoosh.wav', E => sfx(tl, E, { points: false }));
  // QA lanes: each cue goes to the first lane whose previous cue has finished ringing, so QA can time every onset on a
  // quiet background (in the mix a pop can sit inside a chime's tail; that's a mix question, not a timing one)
  const TAIL = { tick: .02, click: .1, pop: .2, chime: .75, hit: 1.6 };
  const laneEnd = [], assign = [];
  tl.cues.forEach(c => {
    let k = laneEnd.findIndex(e => e <= c.t - .005);
    if (k < 0) { k = laneEnd.length; laneEnd.push(0); }
    laneEnd[k] = c.t + (TAIL[c.kind] ?? .3); assign.push(k);
  });
  laneEnd.forEach((_, k) => stem(`qa-lane-${k}.wav`, E => sfx(tl, E, { whooshes: false, only: new Set(assign.flatMap((a, i) => a === k ? [i] : [])) })));
  writeFileSync(join(dir, 'qa-lanes.json'), JSON.stringify({ lanes: laneEnd.length, assign }));
  let music;
  const style = tl.music.style;
  if (style === 'track') {
    toF32(job, tl.music.file, join(dir, 'track.f32'), tl.dur, tl.music.start);
    music = readF32(join(dir, 'track.f32'));
    for (let i = 0; i < N; i++) {                               // 30 ms in, 1.5 s out
      const t = i / SR, g = Math.min(1, t / .03) * Math.min(1, (tl.dur - t) / 1.5);
      music[0][i] *= g; music[1][i] *= g;
    }
    writeWav(join(dir, 'music.wav'), music[0], music[1]);
  } else if (style === 'none') music = [new Float32Array(N), new Float32Array(N)];
  else music = stem('music.wav', E => arrange(tl, E));
  // level the music against the SFX: a track sits where the synth cue would (music ≈ 8 LU above the SFX)
  let mg = 1;
  if (style === 'track') {
    writeWav(join(dir, 'sfx-tmp.wav'), points[0].map((x, i) => x + whoosh[0][i]), points[1].map((x, i) => x + whoosh[1][i]));
    mg = Math.pow(10, (measureLoudness(join(dir, 'sfx-tmp.wav')).I + 8 + (tl.music.level || 0) - measureLoudness(join(dir, 'music.wav')).I) / 20);
  } else if (tl.music.level) mg = Math.pow(10, tl.music.level / 20);
  let vo = null, duck = null;
  if (tl.vo) {
    toF32(job, tl.vo.file, join(dir, 'vo.f32'), tl.dur, 0, tl.vo.start);
    vo = readF32(join(dir, 'vo.f32'));
    writeWav(join(dir, 'vo.wav'), vo[0], vo[1]);
    // VO sits 6 LU above the music; the music ducks by `duck` dB under it (20 ms attack, 300 ms release)
    if (style !== 'none') {
      writeWav(join(dir, 'music-lev.wav'), music[0].map(x => x * mg), music[1].map(x => x * mg));
      const vg = Math.pow(10, (measureLoudness(join(dir, 'music-lev.wav')).I + 6 - measureLoudness(join(dir, 'vo.wav')).I) / 20);
      for (let i = 0; i < N; i++) { vo[0][i] *= vg; vo[1][i] *= vg; }
    }
    duck = new Float32Array(N);
    const a = Math.exp(-1 / (.02 * SR)), r = Math.exp(-1 / (.3 * SR)), floor = Math.pow(10, -tl.vo.duck / 20);
    let env = 0;
    for (let i = 0; i < N; i++) { const x = Math.min(1, Math.abs(vo[0][i] + vo[1][i]) * 8); env = x > env ? a * env + (1 - a) * x : r * env + (1 - r) * x; duck[i] = 1 - (1 - floor) * Math.min(1, env * 1.5); }
  }
  const L = new Float32Array(N), R = new Float32Array(N);
  let peak = 0;
  for (let i = 0; i < N; i++) {
    const d = duck ? duck[i] : 1;
    L[i] = music[0][i] * mg * d + points[0][i] + whoosh[0][i] + (vo ? vo[0][i] : 0);
    R[i] = music[1][i] * mg * d + points[1][i] + whoosh[1][i] + (vo ? vo[1][i] : 0);
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const k = peak > 0 ? Math.pow(10, -3 / 20) / peak : 1;
  for (let i = 0; i < N; i++) { L[i] *= k; R[i] *= k; }
  writeWav(join(dir, 'raw.wav'), L, R);
  writeFileSync(join(dir, 'audio.json'), JSON.stringify({ print: audioPrint(job, tl) }));   // QA refuses a soundtrack from another timeline
  return { samples: N, peak };
}
