// Synthesize the sting's soundtrack: an original 124 BPM house cue + SFX, all on the film's timeline.
//   node audio.mjs --job DIR             → DIR/out/audio/raw.wav (48 kHz stereo float, exactly 12.075 s, unmastered)
//   STEM=sfx node audio.mjs --job DIR    → DIR/out/audio/sfx-stem.wav (SFX only — timing QA, and the bed for track/none music)
//   STEM=music node audio.mjs --job DIR  → DIR/out/audio/music-stem.wav (music only)
//   TRANSPOSE=n                          → shift every pitched voice by n semitones (timing is untouched)
// Beat k sits at 0.048 + 0.4838·k s. The drop is beat 5 (2.467 s); the f72 cut leads it by 2 frames.
// Typing ticks come from DIR/out/timeline.json (written by render.mjs --film).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { jobDir } from './brand.mjs';

const job = jobDir();
const SR = 48000, DUR = 12.075, N = Math.round(DUR * SR);
const FPS = 30000 / 1001, BEAT = 0.4838;
const beat = k => 0.048 + BEAT * k;
const ft = f => f / FPS;

const L = new Float64Array(N), R = new Float64Array(N);         // dry bus
const RVL = new Float64Array(N), RVR = new Float64Array(N);     // reverb send
const DLY = new Float64Array(N);                                // delay send (mono in, ping-pong out)
const duck = new Float64Array(N).fill(1);                       // kick sidechain for music voices

function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const TR = Number(process.env.TRANSPOSE || 0);
const mtof = m => 440 * Math.pow(2, (m + TR - 69) / 12);
const at = t => Math.round(t * SR);
const pan = p => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];
function put(i, l, r, rv = 0, dl = 0) {
  if (i < 0 || i >= N) return;
  L[i] += l; R[i] += r;
  if (rv) { RVL[i] += l * rv; RVR[i] += r * rv; }
  if (dl) DLY[i] += (l + r) * 0.5 * dl;
}

class Biquad {
  constructor() { this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set('lp', 1000, .707); }
  set(type, f, Q) {
    const w = 2 * Math.PI * Math.min(Math.max(f, 10), SR * .45) / SR, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * Q);
    let b0, b1, b2; const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
    if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
    else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
    else { b0 = al; b1 = 0; b2 = -al; }                        // band-pass, 0 dB peak
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    return this;
  }
  p(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y;
  }
}
// band-limited saw (polyBLEP)
function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
class Saw {
  constructor(f, ph) { this.dt = f / SR; this.ph = ph; }
  next() { const v = 2 * this.ph - 1 - blep(this.ph, this.dt); this.ph += this.dt; if (this.ph >= 1) this.ph -= 1; return v; }
}

// ───────────────────────────── drums ─────────────────────────────
function kick(t0, g = 1, depth = .62) {
  const i0 = at(t0), n = Math.round(.5 * SR), r = rng(i0), hp = new Biquad().set('hp', 1800, .7);
  let ph = 0;
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    const f = 44 + 92 * Math.exp(-t / .032) + 170 * Math.exp(-t / .004);
    ph += 2 * Math.PI * f / SR;
    const env = Math.min(1, t / .0008) * Math.exp(-t / .2) * (t > .34 ? Math.max(0, 1 - (t - .34) / .1) : 1);
    const body = Math.tanh(Math.sin(ph) * env * 1.7) / Math.tanh(1.7);
    const click = hp.p(r() * 2 - 1) * Math.exp(-t / .0022) * .28;
    const s = (body + click) * g;
    put(i0 + j, s, s);
    if (depth && t < .42) {
      const d = 1 - depth * (t < .004 ? t / .004 : Math.exp(-(t - .004) / .11));
      if (i0 + j < N) duck[i0 + j] = Math.min(duck[i0 + j], d);
    }
  }
}
function clap(t0, g = 1) {
  const i0 = at(t0), n = Math.round(.4 * SR), r = rng(i0 + 7);
  const bp = new Biquad().set('bp', 1150, .85), hp = new Biquad().set('hp', 520, .7);
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    let env = 0;
    for (const o of [0, .0105, .021]) if (t >= o) env = Math.max(env, Math.exp(-(t - o) / .0075));
    if (t >= .021) env = Math.max(env, .5 * Math.exp(-(t - .021) / .12));
    const v = hp.p(bp.p(r() * 2 - 1)) * env * g * 2.4;
    put(i0 + j, v * .94, v, .32);
  }
}
function hat(t0, g, open, p = 0) {
  const i0 = at(t0), dec = open ? .15 : .028, n = Math.round((open ? .5 : .12) * SR), r = rng(i0 + 3);
  const hp = new Biquad().set('hp', open ? 7000 : 8200, .7), bp = new Biquad().set('bp', 10500, .6);
  const [pl, pr] = pan(p);
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    const env = Math.min(1, t / .0006) * Math.exp(-t / dec);
    const x = r() * 2 - 1, v = (hp.p(x) * .7 + bp.p(x) * .5) * env * g;
    put(i0 + j, v * pl, v * pr, open ? .12 : .04);
  }
}
function crash(t0, g) {
  const i0 = at(t0), n = Math.round(2.2 * SR), rl = rng(i0 + 11), rr = rng(i0 + 12);
  const hl = new Biquad().set('hp', 4200, .7), hr = new Biquad().set('hp', 4200, .7);
  for (let j = 0; j < n; j++) {
    const t = j / SR, env = Math.min(1, t / .002) * (Math.exp(-t / .55) * .8 + Math.exp(-t / .05) * .4) * g;
    put(i0 + j, hl.p(rl() * 2 - 1) * env, hr.p(rr() * 2 - 1) * env, .25);
  }
}

// ───────────────────────────── music voices ─────────────────────────────
function bass(t0, dur, m, g) {
  const i0 = at(t0), n = Math.round((dur + .03) * SR), f = mtof(m), lp = new Biquad().set('lp', 520, .8);
  let ph = 0;
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    ph += 2 * Math.PI * f / SR;
    const env = Math.min(1, t / .004) * (.68 + .32 * Math.exp(-t / .07)) * (t > dur ? Math.max(0, 1 - (t - dur) / .03) : 1);
    const x = Math.sin(ph) + .32 * Math.sin(2 * ph) + .12 * Math.sin(3 * ph);
    const v = lp.p(Math.tanh(x * 1.3)) * env * g * (i0 + j < N ? duck[i0 + j] : 1);
    put(i0 + j, v, v);
  }
}
function stab(t0, notes, g, decay = .2, cut = 3800, len = .34) {
  const i0 = at(t0), n = Math.round((len + .05) * SR);
  const vs = [];
  for (const m of notes) for (const [c, p] of [[-7, -.55], [0, 0], [7, .55]]) {
    const [pl, pr] = pan(p); vs.push({ o: new Saw(mtof(m) * Math.pow(2, c / 1200), (m * 0.137 + c * .01) % 1), pl, pr });
  }
  const fl = new Biquad(), fr = new Biquad();
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    if (j % 16 === 0) { const fc = 340 + cut * Math.exp(-t / .075); fl.set('lp', fc, .9); fr.set('lp', fc, .9); }
    let l = 0, r = 0;
    for (const v of vs) { const s = v.o.next(); l += s * v.pl; r += s * v.pr; }
    const env = Math.min(1, t / .002) * Math.exp(-t / decay) * (t > len ? Math.max(0, 1 - (t - len) / .05) : 1) * g;
    const d = i0 + j < N ? duck[i0 + j] : 1;
    put(i0 + j, fl.p(l) * env * d, fr.p(r) * env * d, .34, .26);
  }
}
function pad(t0, t1, notes, g, att = .7, rel = .5) {
  const i0 = at(t0), n = Math.round((t1 - t0 + rel) * SR);
  const vs = [];
  for (const m of notes) for (const [c, p] of [[-9, -.7], [9, .7]]) {
    const [pl, pr] = pan(p); vs.push({ o: new Saw(mtof(m) * Math.pow(2, c / 1200), (m * .31 + c * .05 + 1) % 1), pl, pr });
  }
  const fl = new Biquad(), fr = new Biquad(), span = t1 - t0;
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    if (j % 32 === 0) { const fc = 1150 + 380 * Math.sin(2 * Math.PI * .23 * (t0 + t)); fl.set('lp', fc, .6); fr.set('lp', fc, .6); }
    let l = 0, r = 0;
    for (const v of vs) { const s = v.o.next(); l += s * v.pl; r += s * v.pr; }
    const env = Math.min(1, t / att) * (t > span ? Math.max(0, 1 - (t - span) / rel) : 1) * g;
    const d = i0 + j < N ? duck[i0 + j] : 1;
    put(i0 + j, fl.p(l) * env * d, fr.p(r) * env * d, .45);
  }
}
function pluck(t0, m, g, p = 0) {
  const i0 = at(t0), n = Math.round(.5 * SR), f = mtof(m), [pl, pr] = pan(p);
  let pc = 0, pm = 0;
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    pm += 2 * Math.PI * f * 2 / SR;
    pc += 2 * Math.PI * f / SR + 1.1 * Math.exp(-t / .045) * Math.sin(pm) * .02;
    const env = Math.min(1, t / .002) * Math.exp(-t / .15) * g;
    const v = Math.sin(pc + 1.2 * Math.exp(-t / .05) * Math.sin(pm)) * env;
    put(i0 + j, v * pl, v * pr, .2, .42);
  }
}

// ───────────────────────────── SFX ─────────────────────────────
function whoosh(tp, g, pre = .5, post = .2, p0 = -.6, p1 = .6) {
  const ts = tp - pre, i0 = at(ts), n = Math.round((pre + post + .1) * SR), rl = rng(i0 + 21), rr = rng(i0 + 22);
  const bl = new Biquad(), br = new Biquad(), ll = new Biquad().set('lp', 220, .7);
  for (let j = 0; j < n; j++) {
    const t = ts + j / SR;
    const u = Math.min(1, (t - ts) / pre);
    const fc = t < tp ? 300 * Math.pow(3400 / 300, Math.pow(u, 1.5)) : 3400 * Math.pow(800 / 3400, Math.min(1, (t - tp) / post));
    if (j % 16 === 0) { bl.set('bp', fc, .95); br.set('bp', fc * 1.06, .95); }
    const env = (t < tp ? Math.pow(u, 2.6) : Math.exp(-(t - tp) / .065)) * g;
    const pp = p0 + (p1 - p0) * Math.min(1, (t - ts) / (pre + post * .5));
    const [pl, pr] = pan(pp);
    const xl = rl() * 2 - 1, xr = rr() * 2 - 1, low = ll.p((xl + xr) * .5) * 1.6;
    put(i0 + j, (bl.p(xl) * 1.5 + low) * env * pl * 1.3, (br.p(xr) * 1.5 + low) * env * pr * 1.3, .22);
  }
}
function impact(t0, g) {
  const i0 = at(t0), n = Math.round(1.4 * SR), r = rng(i0 + 31), lp = new Biquad().set('lp', 260, .7);
  let ph = 0;
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    ph += 2 * Math.PI * (48 + 46 * Math.exp(-t / .06)) / SR;
    const tail = t > 1.1 ? Math.max(0, 1 - (t - 1.1) / .3) : 1;
    const v = (Math.sin(ph) * Math.min(1, t / .003) * Math.exp(-t / .2) + lp.p(r() * 2 - 1) * Math.exp(-t / .07) * 1.4) * g * tail;
    put(i0 + j, v, v, .5);
  }
}
function hit(t0, g, note) {
  const i0 = at(t0), n = Math.round(1.6 * SR), r = rng(i0 + 41), bp = new Biquad().set('bp', 2300, 1.1);
  let ph = 0, pc = 0, pm = 0;
  const f = mtof(note);
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    ph += 2 * Math.PI * (54 + 50 * Math.exp(-t / .04)) / SR;
    pm += 2 * Math.PI * f * 3.5 / SR; pc += 2 * Math.PI * f / SR;
    const thump = Math.sin(ph) * Math.min(1, t / .002) * Math.exp(-t / .2);
    const snap = bp.p(r() * 2 - 1) * Math.exp(-t / .028) * 1.6;
    const ping = Math.sin(pc + 2.2 * Math.exp(-t / .12) * Math.sin(pm)) * Math.min(1, t / .002) * Math.exp(-t / .55) * .55;
    const v = (thump + snap) * g, w = ping * g;
    put(i0 + j, v + w * .8, v + w, .45);
  }
}
function click(t0, g) {
  for (const [o, k] of [[0, 1], [.072, .55]]) {
    const i0 = at(t0 + o), n = Math.round(.02 * SR), r = rng(i0 + 51), bp = new Biquad().set('bp', 3300, 2.8);
    let ph = 0;
    for (let j = 0; j < n; j++) {
      const t = j / SR;
      ph += 2 * Math.PI * 1850 / SR;
      const v = (bp.p(r() * 2 - 1) * Math.exp(-t / .0018) * 2.2 + Math.sin(ph) * Math.exp(-t / .0028) * .35) * g * k;
      put(i0 + j, v * .9, v, .06);
    }
  }
}
function tick(t0, g, k) {
  const i0 = at(t0), n = Math.round(.012 * SR), r = rng(i0 + 61), h = rng(k * 97 + 5)();
  const bp = new Biquad().set('bp', 2600 + 1700 * h, 2.2);
  const [pl, pr] = pan(-.25 + .5 * h);
  for (let j = 0; j < n; j++) {
    const t = j / SR, v = bp.p(r() * 2 - 1) * Math.exp(-t / .0013) * g * (0.75 + .5 * h);
    put(i0 + j, v * pl, v * pr, .05);
  }
}
function shimmer(t0, g) {
  const parts = [86, 90, 93, 97, 98, 100, 105, 102], R = rng(909);
  parts.forEach((m, k) => {
    const on = t0 + k * .05 + R() * .03, i0 = at(on), n = Math.round(2.2 * SR), f = mtof(m), [pl, pr] = pan(k % 2 ? .55 : -.55);
    let ph = R() * 6;
    for (let j = 0; j < n; j++) {
      const t = j / SR;
      ph += 2 * Math.PI * f / SR;
      const env = Math.min(1, t / .015) * Math.exp(-t / 1.1) * (1 + .35 * Math.sin(2 * Math.PI * (6.5 + k * .4) * t)) * g;
      const v = Math.sin(ph) * env;
      put(i0 + j, v * pl, v * pr, .6, .2);
    }
  });
  const i0 = at(t0), n = Math.round(1.6 * SR), rl = rng(71), rr = rng(72), hl = new Biquad().set('hp', 9000, .7), hr = new Biquad().set('hp', 9000, .7);
  for (let j = 0; j < n; j++) {
    const t = j / SR, env = Math.min(1, t / .12) * Math.exp(-t / .5) * g * 1.2;
    put(i0 + j, hl.p(rl() * 2 - 1) * env, hr.p(rr() * 2 - 1) * env, .5);
  }
}
function riser(t0, t1, g, f0 = 400, f1 = 7000) {
  const i0 = at(t0), n = Math.round((t1 - t0) * SR), rl = rng(i0 + 81), rr = rng(i0 + 82), bl = new Biquad(), br = new Biquad();
  for (let j = 0; j < n; j++) {
    const u = j / n;
    if (j % 16 === 0) { const fc = f0 * Math.pow(f1 / f0, u); bl.set('bp', fc, 1.6); br.set('bp', fc * 1.04, 1.6); }
    const env = Math.pow(u, 2.2) * Math.min(1, (n - j) / (SR * .008)) * g;
    put(i0 + j, bl.p(rl() * 2 - 1) * env, br.p(rr() * 2 - 1) * env, .3);
  }
}

// ───────────────────────────── effects ─────────────────────────────
function freeverb(inL, inR, room = .84, damp = .32) {
  const sc = SR / 44100, combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map(x => Math.round(x * sc));
  const apT = [556, 441, 341, 225].map(x => Math.round(x * sc)), spread = Math.round(23 * sc);
  const fb = room * .28 + .7, d = damp * .4;
  const mk = len => ({ b: new Float64Array(len), i: 0, s: 0 });
  const cl = combT.map(mk), cr = combT.map(t => mk(t + spread)), al = apT.map(mk), ar = apT.map(t => mk(t + spread));
  const oL = new Float64Array(N), oR = new Float64Array(N);
  const comb = (c, x) => { const y = c.b[c.i]; c.s = y * (1 - d) + c.s * d; c.b[c.i] = x + c.s * fb; if (++c.i >= c.b.length) c.i = 0; return y; };
  const ap = (a, x) => { const bo = a.b[a.i], y = -x + bo; a.b[a.i] = x + bo * .5; if (++a.i >= a.b.length) a.i = 0; return y; };
  for (let i = 0; i < N; i++) {
    const x = (inL[i] + inR[i]) * .015;
    let l = 0, r = 0;
    for (let k = 0; k < 8; k++) { l += comb(cl[k], x); r += comb(cr[k], x); }
    for (let k = 0; k < 4; k++) { l = ap(al[k], l); r = ap(ar[k], r); }
    oL[i] = l; oR[i] = r;
  }
  return [oL, oR];
}
function pingpong(inp, delayS, fbk = .36) {
  const D = Math.round(delayS * SR), oL = new Float64Array(N), oR = new Float64Array(N), lp = new Biquad().set('lp', 3200, .7), lp2 = new Biquad().set('lp', 3200, .7);
  for (let i = 0; i < N; i++) {
    const a = i >= D ? i - D : -1;
    oL[i] = (a >= 0 ? inp[a] + lp.p(oR[a]) * fbk : 0);
    oR[i] = (a >= 0 ? lp2.p(oL[a]) * fbk : 0);
  }
  return [oL, oR];
}

// ───────────────────────────── arrangement ─────────────────────────────
const CH = {
  G: { b: 31, v: [57, 59, 62, 66] },   // Gmaj9 (A B D F#)
  A: { b: 33, v: [57, 59, 62, 64] },   // Asus (A B D E)
  D: { b: 38, v: [57, 61, 64, 66] },   // Dmaj9 (A C# E F#)
  Bm: { b: 35, v: [57, 61, 62, 66] },  // Bm9 (A C# D F#)
};
const END = ft(301);                    // 10.043 s, hard cut to the end card
// bars: [startBeat, chord]
const BARS = [[5, 'D'], [9, 'Bm'], [13, 'G'], [17, 'A']];
const chordAt = b => b < 4 ? 'G' : b < 5 ? 'A' : BARS.filter(x => x[0] <= b).pop()[1];

// kick first: it writes the sidechain envelope the music voices read
const MUSIC = process.env.STEM !== 'sfx';           // STEM=sfx renders only the SFX layer (timing QA)
const SFX = process.env.STEM !== 'music';           // STEM=music renders only the music layer
if (MUSIC) {
for (let k = 5; k <= 20; k++) kick(beat(k), .72);
for (let k = 21; k <= 24; k++) if (beat(k) < DUR) kick(beat(k), .42, .35);     // soft pulse under the end card

// intro (beats 0–5): pad swell, plucked arp opening up, light shaker, riser into the drop
pad(.02, beat(4), CH.G.v, .085, 1.2, .25);
pad(beat(4), beat(5), CH.A.v, .085, .08, .2);
for (let s = 0; s < 10; s++) {
  const b = s * .5, ch = CH[chordAt(b)], notes = ch.v.map(m => m + 12), seq = [0, 2, 1, 3, 2, 0, 3, 1, 2, 3];
  pluck(beat(b), notes[seq[s]], .13 + .1 * s / 9, s % 2 ? .35 : -.35);
}
for (let b = 2; b < 5; b += .5) hat(beat(b + .25), .1 + .06 * (b - 2) / 3, false, .3);
riser(beat(2.6), ft(72) - .002, .34);

// drop (beat 5 → the end-card cut)
crash(beat(5), .2);
for (let k = 5; k <= 20; k++) {
  if (k % 2 === 0) clap(beat(k), .72);
  if (beat(k + .5) < END - .02) hat(beat(k + .5), .3, true, .2);
  for (const q of [.25, .75]) if (beat(k + q) < END - .02) hat(beat(k + q), .14 + (q === .75 ? .04 : 0), false, -.25);
}
for (const [b0, name] of BARS) {
  const ch = CH[name];
  for (const [o, len, oct, g] of [[.5, .19, 0, .3], [1.5, .19, 0, .3], [2.5, .19, 0, .3], [3.5, .14, 12, .24], [3.75, .1, 0, .2]]) {
    if (beat(b0 + o) < END - .03) bass(beat(b0 + o), len, ch.b + oct, g);
  }
  for (const [o, g] of [[.5, .17], [1.25, .105], [2.5, .17], [3.25, .105], [3.75, .135]]) {
    if (beat(b0 + o) < END - .05) stab(beat(b0 + o), ch.v, g, .2, 4800);
  }
  pad(beat(b0), Math.min(beat(b0 + 4), END), ch.v, .04, .08, .12);
  for (let s = 0; s < 16; s++) {
    const t = beat(b0 + s * .25);
    if (t >= END - .03) break;
    const seq = [0, 1, 2, 3, 2, 1, 3, 0, 1, 2, 3, 2, 0, 3, 1, 2];
    pluck(t, ch.v[seq[s]] + 24, s % 4 === 0 ? .065 : .04, s % 2 ? .5 : -.5);
  }
}
riser(beat(18.6), END - .002, .14, 600, 9000);

// end card: one held Dmaj9 with a sub, crash and shimmer; a reverse swell into the collapse
crash(END, .22);
stab(END, [...CH.D.v, 69], .13, .7, 3200, 1.6);
bass(END, 1.6, 26, .34);
pad(END, DUR, [...CH.D.v, 74], .05, .05, .1);
shimmer(ft(301.2), .045);
riser(ft(338), DUR, .12, 500, 6000);
}

// SFX on the cut list
let ticks = 0;
if (SFX) {
impact(.10, .55);
whoosh(ft(72), .34);                    // 2.402
whoosh(ft(101), .3, .42, .18, .5, -.5); // 3.370
whoosh(ft(159), .36, .5, .2, -.3, .3);  // 5.305
whoosh(END, .38, .55, .22, .6, -.6);    // 10.043
hit(6.240, .42, 90);                    // card rises
hit(8.175, .42, 93);                    // logo disc
click(2.33, .6);                        // sits under the rising f72 whoosh, so it needs more level
click(3.83, .3);
const tl = join(job, 'out', 'timeline.json');
if (!existsSync(tl)) console.warn('warning: no out/timeline.json — render the film first, or the key ticks are missing');
const typing = existsSync(tl) ? JSON.parse(readFileSync(tl, 'utf8')).typing : [];
typing.forEach((f, k) => {             // two keys in one frame → second tick 14 ms later, like a fast pair
  const t = ft(f) + (k && typing[k - 1] === f ? .014 : 0);
  if (t >= 4.035 && t <= 5.03) { tick(t, .05, k); ticks++; }
});
}

// ───────────────────────────── mix ─────────────────────────────
// keep lows out of the effect returns, or the reverb rings as a sub rumble
const hpf = (x, fc) => { const a = new Biquad().set('hp', fc, .7), b = new Biquad().set('hp', fc, .7); for (let i = 0; i < N; i++) x[i] = b.p(a.p(x[i])); return x; };
const [rvL, rvR] = freeverb(hpf(RVL, 280), hpf(RVR, 280));
const [dlL, dlR] = pingpong(hpf(DLY, 220), .75 * BEAT);
const hpL = new Biquad().set('hp', 28, .7), hpR = new Biquad().set('hp', 28, .7);
const outL = new Float32Array(N), outR = new Float32Array(N);
let peak = 0;
for (let i = 0; i < N; i++) {
  const l = hpL.p(L[i] + rvL[i] * 1.1 + dlL[i] * .55), r = hpR.p(R[i] + rvR[i] * 1.1 + dlR[i] * .55);
  outL[i] = l; outR[i] = r; peak = Math.max(peak, Math.abs(l), Math.abs(r));
  if (!Number.isFinite(l) || !Number.isFinite(r)) throw new Error('non-finite sample at ' + i);
}
const norm = Math.pow(10, -3 / 20) / peak;           // leave headroom; mastering sets loudness
for (let i = 0; i < N; i++) { outL[i] *= norm; outR[i] *= norm; }

function wavFloat(path, chL, chR) {
  const n = chL.length, data = Buffer.alloc(n * 8), hdr = Buffer.alloc(44);
  for (let i = 0; i < n; i++) { data.writeFloatLE(chL[i], i * 8); data.writeFloatLE(chR[i], i * 8 + 4); }
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12);
  hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(3, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(SR, 24);
  hdr.writeUInt32LE(SR * 8, 28); hdr.writeUInt16LE(8, 32); hdr.writeUInt16LE(32, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([hdr, data]));
}
const name = MUSIC && SFX ? 'raw.wav' : MUSIC ? 'music-stem.wav' : 'sfx-stem.wav';
mkdirSync(join(job, 'out', 'audio'), { recursive: true });
wavFloat(join(job, 'out', 'audio', name), outL, outR);
console.log(`${name} ${N} samples (${(N / SR).toFixed(3)} s), pre-norm peak ${peak.toFixed(4)}, ${ticks} key ticks${TR ? `, transposed ${TR > 0 ? '+' : ''}${TR}` : ''}`);
