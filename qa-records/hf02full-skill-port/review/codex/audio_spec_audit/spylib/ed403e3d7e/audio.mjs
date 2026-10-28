// Timeline → stems → raw mix.
//   music.wav  : the arranged cue (style playful | keynote | calm | film), or the user's track, or silence (none)
//   points.wav : every point SFX (pops, ticks, clicks, chimes, hits) — QA times onsets on this stem
//   whoosh.wav : the transition whooshes — QA times their peaks on this stem
//   raw.wav    : music + SFX (+ voiceover, with the music ducked under it), peak-normalised to −3 dBFS
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SR, ff, sh, measureLoudness, UserError } from 'file:///Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/stage-r0-before-review-fixes/product-launch-sting/video/lib/common.mjs';
import { makeEngine, writeWav } from 'file:///Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/stage-r0-before-review-fixes/product-launch-sting/video/lib/voices.mjs';
import { KEYS } from 'file:///Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/stage-r0-before-review-fixes/product-launch-sting/video/lib/spec.mjs';
import { audioPrint } from 'file:///Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/stage-r0-before-review-fixes/product-launch-sting/video/lib/fingerprint.mjs';

const SCALE = [0, 2, 4, 5, 7, 9, 11];
const chordPcs = (keyPc, deg, n = 4) => Array.from({ length: n }, (_, i) => (keyPc + SCALE[(deg + 2 * i) % 7]) % 12);
const voice = (pcs, lo) => pcs.map(pc => lo + ((pc - lo) % 12 + 12) % 12).sort((a, b) => a - b);
const rootOf = (keyPc, deg, lo = 36) => lo + (((keyPc + SCALE[deg]) - lo) % 12 + 12) % 12;
const PROG = { playful: [0, 5, 3, 4], keynote: [0, 5, 3, 4], calm: [0, 4, 5, 3] };

// ── film: the score of the hf02 recreation (2026-10-22) as a style. Every event sits on the beat grid, beat k at
// music.downbeat + k·beat (the intro too), so a film scored to a reference's tempo reading lands on its beat.
// Intro (0 → drop): pad swell, a soft 16th arpeggio, a shaker pickup, a riser. From the drop: kick on 1 and 3 + a ghost,
// a soft clap on 2 and 4, bright stabs on 1 and 3 + a light pickup on the and of 4, a 16th shaker with accents, hats,
// a syncopated bass, the arpeggio, a motif every other bar. Each break: pad + shaker. A lift over the last two bars
// before the end card, the music silent for its last 0.44 s, the hit on the end card ringing out (no end card: the
// last bar rings out). Accent the beats: flattened 16ths killed the tracked pulse (confidence 0.16) and off-beat
// stabs flipped its phase half a beat. The shaker is .9 with a 6 ms attack (the hf02 score: 1.2, 3 ms) — the louder,
// sharper noise bursts made the mux's AAC encode overshoot the −1 dBTP limit by up to 6 dB.
const FILM_MIX = { pad: .02, arp: .12, arpUp: .05, arpHi: .06, stab: .085, hat: .3, shaker: .9, bass: .1, kick: .64, clap: .32, motif: .07, stabCut: 9000 };
const FILM_PROG = {     // rootless 9ths voiced in F (moved to music.key): [pad notes, bass root]
  A: [[[57, 60, 64, 67], 41], [[53, 57, 60, 64], 38], [[57, 60, 62, 65], 46], [[55, 60, 62, 67], 48]],   // Imaj9 · vi9 · IVmaj9 · Vsus2
  B: [[[57, 60, 62, 65], 46], [[58, 62, 65, 69], 43], [[53, 57, 60, 65], 45], [[55, 60, 62, 67], 48]],   // IVmaj9 · ii9 · I/3 · Vsus2 (after the first break)
  L: [[[53, 57, 60, 64], 38], [[57, 60, 62, 65], 46], [[57, 60, 65, 69], 48], [[55, 60, 64, 67], 48]],   // vi9 · IVmaj9 · I/5 · V (the lift)
};
const FILM_SILENCE = .44;                      // the breath before the hit (s)
// band-passed noise around 4.5 kHz: the upper-mid pulse the engine has no voice for
function shaker(E, t0, g, p = 0) {
  const i0 = Math.round(t0 * SR), n = Math.round(.06 * SR), w = 2 * Math.PI * 4500 / SR, al = Math.sin(w) / (2 * .8), a0 = 1 + al;
  const b0 = al / a0, b2 = -al / a0, a1 = -2 * Math.cos(w) / a0, a2 = (1 - al) / a0, pl = Math.cos((p + 1) * Math.PI / 4), pr = Math.sin((p + 1) * Math.PI / 4);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, seed = i0 * 2654435761 >>> 0;
  for (let j = 0; j < n; j++) {
    seed = (seed * 1664525 + 1013904223) >>> 0; const x = seed / 4294967296 * 2 - 1, t = j / SR;
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y;
    const v = y * Math.min(1, t / .006) * Math.exp(-t / .022) * g; E.put(i0 + j, v * pl, v * pr, .06);
  }
}
// the film cue's bus, after the mix: +4.6 dB (the cue then sits over the SFX as the other styles do), a 16 kHz low-pass
// and a true-peak limiter (2 ms lookahead, 60 ms release) 8 dB above the body (the 90th percentile of 400 ms RMS
// windows). Without them this bright, beat-heavy cue needed ~9 dB of master limiting and the AAC encode overshot
// the −1 dBTP limit on what got squashed; with them the master converges in a few passes.
function filmBus(L, R) {
  const n = L.length, w = Math.round(.4 * SR), rms = [], w0 = 2 * Math.PI * 16000 / SR, c = Math.cos(w0), al = Math.sin(w0) / Math.SQRT2;
  const a0 = 1 + al, b0 = (1 - c) / 2 / a0, b1 = (1 - c) / a0, a1 = -2 * c / a0, a2 = (1 - al) / a0;
  for (const X of [L, R]) { let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < n; i++) { const x = X[i] * 1.7, y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; X[i] = y; } }
  for (let i = 0; i + w <= n; i += w) { let e = 0; for (let j = i; j < i + w; j++) e += L[j] * L[j] + R[j] * R[j]; rms.push(Math.sqrt(e / (2 * w))); }
  const T = rms.sort((a, b) => a - b)[Math.floor(rms.length * .9)] * Math.pow(10, 8 / 20);
  if (!(T > 0)) return;
  // detector: the sample and its cubic-interpolated quarter points (inter-sample peaks)
  const cub = (X, i, f) => { const p0 = X[Math.max(0, i - 1)], p1 = X[i], p2 = X[Math.min(n - 1, i + 1)], p3 = X[Math.min(n - 1, i + 2)]; return p1 + .5 * f * (p2 - p0 + f * (2 * p0 - 5 * p1 + 4 * p2 - p3 + f * (3 * (p1 - p2) + p3 - p0))); };
  const tp = (X, i) => Math.max(Math.abs(X[i]), Math.abs(cub(X, i, .25)), Math.abs(cub(X, i, .5)), Math.abs(cub(X, i, .75)));
  const pk = Float32Array.from(L, (x, i) => Math.max(tp(L, i), tp(R, i)));
  const la = Math.round(.002 * SR), atk = Math.exp(-1 / (.0004 * SR)), rel = Math.exp(-1 / (.06 * SR)), q = new Int32Array(n + 1);
  let h = 0, t = 0, g = 1;
  for (let i = 0, k = 0; i < n; i++) {
    for (; k < n && k <= i + la; k++) { while (t > h && pk[q[t - 1]] <= pk[k]) t--; q[t++] = k; }   // max of pk over [i, i + la]
    while (q[h] < i) h++;
    const need = Math.min(1, T / pk[q[h]]);
    g = need < g ? need + (g - need) * atk : need - (need - g) * rel;
    L[i] *= g; R[i] *= g;
  }
}
export function arrangeFilm(tl, E) {
  const m = tl.music, beat = tl.beat, dur = tl.dur, bar = 4 * beat, db = m.downbeat || 0, eps = 1e-6, M = FILM_MIX;
  const tr = (((KEYS[m.key] ?? 5) - 5) % 12 + 18) % 12 - 6;             // semitones from F, −6…+5: the same register in any key
  const bt = k => db + k * beat, kAt = t => (t - db) / beat, j16 = k => ((Math.round(k * 4) % 16) + 16) % 16;   // 16th of the bar
  const barOf = k => k - (((Math.round(k) % 4) + 4) % 4);                  // the bar line at or before beat k
  const onGrid = t => { const k = Math.round(kAt(t)); return Math.abs(bt(k) - t) <= .01 ? bt(k) : t; };   // a cut ≤ 10 ms off a grid line is on it
  const dropShot = tl.shots.find(s => s.id === m.drop) || tl.shots[1] || tl.shots[0];
  const dropT = onGrid(dropShot.start), kDrop = Math.ceil(kAt(dropT) - eps), kBar0 = barOf(kDrop);
  // the end: the hit on the end card's first frame (the cut, within half a 60-fps frame of its grid line), the music
  // silent FILM_SILENCE before it; no end card: a ring-out on the last bar line
  const card = tl.endcard != null && tl.endcard > dropT + FILM_SILENCE + .25 ? tl.endcard : null;
  let hitT = card, end = card != null ? card - FILM_SILENCE : dur;
  if (card == null) { const k = barOf(Math.floor(kAt(dur - bar) + eps)); if (bt(k) >= dropT + bar) hitT = end = bt(k); }
  // the lift: from the bar line two bars before the hit (one bar if that's all there is after a bar of groove)
  let liftT = Infinity;
  if (hitT != null) for (const n of [8, 4]) { const k = barOf(Math.round(kAt(hitT)) - n); if (bt(k) >= dropT + bar - eps) { liftT = bt(k); break; } }
  const breaks = tl.shots.filter(s => m.breaks.includes(s.id)).map(s => [onGrid(s.start), onGrid(s.end)]).filter(([a, b]) => b > dropT && a < end);
  const inDip = t => t >= dropT - eps && breaks.some(([a, b]) => t >= a - .001 && t < b - .001);
  const kB = breaks.length ? barOf(Math.round(kAt(Math.min(...breaks.map(b => b[1]))))) : Infinity;
  const chordAt = t => {                                                   // [pad notes, bass root] at time t
    const k = kAt(t) + eps, tx = ([ns, r]) => [ns.map(x => x + tr), r + tr];
    if (t < dropT - eps) return tx(FILM_PROG.A[dropT - t <= bar + eps && dropT >= 1.5 * bar ? 3 : 0]);   // intro: I, a V bar into the drop
    const [P, k0] = t >= liftT - eps ? [FILM_PROG.L, kAt(liftT)] : k >= kB ? [FILM_PROG.B, kB] : [FILM_PROG.A, kBar0];
    return tx(P[((Math.floor((k - k0) / 4) % 4) + 4) % 4]);
  };
  // pad: the intro swells, then one chord per bar (fuller in a break)
  if (dropT > .2) {
    const pk = dropT >= 1.5 * bar ? dropT - bar : dropT;
    E.pad(0, pk + .05, chordAt(0)[0], M.pad * 1.5, Math.min(2, pk * .6), .3);
    if (pk < dropT) E.pad(pk, dropT + .05, chordAt(pk)[0], M.pad * 1.5, .1, .3);
  }
  const edges = [dropT, end];
  for (let k = kBar0 + 4; bt(k) < end; k += 4) edges.push(bt(k));
  for (const [a, b] of breaks) edges.push(a, b);
  const seg = [...new Set(edges.map(x => +x.toFixed(6)))].filter(x => x >= dropT - eps && x <= end + eps).sort((a, b) => a - b);
  for (let i = 0; i + 1 < seg.length; i++) if (seg[i + 1] - seg[i] > .05) E.pad(seg[i], seg[i + 1] + .05, chordAt(seg[i] + .001)[0], M.pad * (inDip(seg[i] + .001) ? 1.5 : 1), .1, .3);
  // 16th pluck arpeggio from the first beat (softer in the intro, out in the breaks), a top layer on the eighths, a
  // brighter one on the off-16ths in the lift
  const ARP = [0, 2, 1, 3, 2, 0, 3, 1, 0, 3, 2, 1, 3, 1, 2, 0];
  for (let k = Math.ceil(kAt(0) - eps); bt(k) < end - .03; k += .25) {
    const t = bt(k), j = j16(k), intro = t < dropT - eps, lift = t >= liftT - eps;
    if (inDip(t)) continue;
    const [ch] = chordAt(t);
    E.pluck(t, ch[ARP[j]] + 12 + (j % 8 === 6 ? 12 : 0), M.arp * (j % 4 === 0 ? 1 : .6) * (intro ? .7 : 1), j % 2 ? .3 : -.3);
    if (lift && j % 2 === 1) E.pluck(t, ch[ARP[(j + 5) % 16]] + 24, M.arpUp, j % 4 === 1 ? .6 : -.6);
    else if (!intro && j % 2 === 0) E.pluck(t, ch[ARP[(j + 9) % 16]] + 24, M.arpHi, j % 4 === 0 ? .5 : -.5);
  }
  // shaker on every 16th from a bar before the drop (rising in), eighths in a break; hats from the drop, open on the
  // and of 2 and 4
  const HV = [1, .48, .7, .52], kPick = Math.max(Math.ceil(kAt(0) * 4 - eps) / 4, kDrop - 4), tPick = bt(kPick);
  for (let k = kPick; bt(k) < end - .03; k += .25) {
    const t = bt(k), j = j16(k), intro = t < dropT - eps, dip = inDip(t), lift = t >= liftT - eps;
    if (dip && j % 2) continue;
    const rise = intro ? .3 + .7 * Math.min(1, (t - tPick) / Math.max(beat, dropT - tPick)) : 1;
    shaker(E, t, M.shaker * (j % 4 === 0 ? 1 : j % 2 ? .5 : .7) * (dip ? .5 : 1) * rise, j % 2 ? -.3 : .3);
    if (intro || dip) continue;
    const open = j === 6 || j === 14;
    E.hat(t, M.hat * (open ? .4 : 1) * HV[j % 4] * (lift ? 1.15 : 1), open, j % 2 ? .35 : -.2);
  }
  // beats from the drop: bright stabs on 1 and 3 (+ a light pickup on the and of 4), kick on 1 and 3 + a ghost before 4,
  // a soft clap on 2 and 4 — all out in a break
  for (let k = kDrop; bt(k) < end - .05; k++) {
    const t = bt(k), b = j16(k) / 4;
    if (inDip(t)) continue;
    if (b === 0 || b === 2) { E.stab(t, chordAt(t)[0].map(x => x + 12), M.stab, .09, M.stabCut, .16); E.kick(t, M.kick, .22); }
    if (b === 3 && bt(k + .5) < end - .05 && !inDip(bt(k + .5))) E.stab(bt(k + .5), chordAt(bt(k + .5))[0].map(x => x + 12), M.stab * .45, .07, M.stabCut, .12);
    if (b === 2 && bt(k + .75) < end - .05) E.kick(bt(k + .75), M.kick * .38, .1);
    if (b === 1 || b === 3) E.clap(t, M.clap);
  }
  // syncopated bass, one 16th pattern per bar: [16th, length in 16ths, interval]
  const BASS = [[0, 1.5, 0], [2, 1.5, 0], [5, 1, 12], [7, 1.5, 0], [10, 2, 0], [13, 1, 7], [15, 1, 12]];
  for (let b = kBar0; bt(b) < end - .05; b += 4) for (const [p, len, iv] of BASS) {
    const t = bt(b + p / 4);
    if (t >= dropT - eps && t < end - .05 && !inDip(t)) E.bass(t, Math.min(len * beat / 4 - .02, end - t), chordAt(t)[1] + iv, M.bass);
  }
  // a four-note mallet motif from the chord, every other bar
  const MOTIF = [[0, 3], [1.5, 2], [2.5, 1], [3, 3]];
  for (let b = kBar0 + (bt(kBar0) < dropT - eps ? 4 : 0); bt(b) < end - .5; b += 8) {
    if (inDip(bt(b)) || inDip(bt(b + 3))) continue;
    const [ch] = chordAt(bt(b));
    MOTIF.forEach(([o, n], i) => { if (bt(b + o) < end - .05) E.mallet(bt(b + o), ch[n] + 12, M.motif, i % 2 ? .25 : -.25); });
  }
  // section marks: a riser into the drop, each way back from a break and the lift; a crash on each
  if (dropT > .5) E.riser(Math.max(.1, dropT - 1.2), dropT - .02, .1, 500, 8000);
  E.crash(dropT, .12);
  for (const [, b] of breaks) if (b < end - .2) { E.riser(Math.max(0, b - Math.min(1.2, 2 * beat)), b - .02, .08, 400, 6000); E.crash(b, .12); }
  if (liftT < end) { E.riser(Math.max(0, liftT - 1.2), liftT - .02, .1, 500, 8000); E.crash(liftT, .12); }
  // the hit (a low boom on an end card), then a bell bed rings out over a quiet pad
  if (hitT != null && hitT < dur - .05) {
    const rest = dur - hitT;
    if (card != null) E.kick(hitT, 1, .9);
    E.bass(hitT, Math.max(.2, Math.min(1.5, rest - .1)), 41 + tr, .42);
    E.stab(hitT, [53, 60, 65, 69].map(x => x + tr), .3, .5, 2400, Math.min(1.2, rest));
    E.crash(hitT, .22);
    [[65, 69, 72], [64, 67, 72], [65, 69, 74]].forEach((ch, i) => ch.forEach((x, j) => { const t = hitT + .15 + i * .62 + j * .07; if (t < dur - .15) E.mallet(t, x + 12 + tr, .025, j - 1); }));
    E.pad(hitT + .05, dur, [53, 57, 60, 64].map(x => x + tr), .012, .25, .2);
  }
  // after the mix: the bus, then the silence before the hit (a 12 ms fade into it; the reverb and delay tails go too)
  return (L, R) => {
    filmBus(L, R);
    if (card == null) return;
    const a = Math.round(end * SR), b = Math.min(L.length, Math.round(card * SR)), f = Math.round(.012 * SR);
    for (let i = Math.max(0, a - f); i < b; i++) { const g = i < a ? (a - i) / f : 0; L[i] *= g; R[i] *= g; }
  };
}

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
  const stem = (name, fn) => { const E = makeEngine(tl.dur), post = fn(E); const [l, r] = E.mixdown(tl.beat); if (post) post(l, r); writeWav(join(dir, name), l, r); return [l, r]; };
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
  else music = stem('music.wav', E => style === 'film' ? arrangeFilm(tl, E) : arrange(tl, E));
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
