// Synthesize the Cue proof cut's soundtrack: an original 120 BPM playful pop/house cue + SFX on the cut list.
//   node audio.mjs            → out/audio/raw.wav (48 kHz stereo float, exactly 20.0 s, unmastered)
// Beat = 0.5 s; bars start on odd seconds so the drop (3 s) and the cuts at 9/13/17 s sit on bar lines.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SR = 48000, DUR = 20.0, N = Math.round(DUR * SR);
const FPS = 30, BEAT = 0.5;
const beat = k => BEAT * k;
const ft = f => f / FPS;

const L = new Float64Array(N), R = new Float64Array(N);         // dry bus
const RVL = new Float64Array(N), RVR = new Float64Array(N);     // reverb send
const DLY = new Float64Array(N);                                // delay send (mono in, ping-pong out)
const duck = new Float64Array(N).fill(1);                       // kick sidechain for music voices

function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
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

// ───────────────────────────── extra voices ─────────────────────────────
function mallet(t0, m, g, p = 0) {                       // wooden FM mallet (marimba-ish)
  const i0 = at(t0), n = Math.round(.6 * SR), f = mtof(m), [pl, pr] = pan(p);
  let pc = 0, pm = 0;
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    pm += 2 * Math.PI * f * 4 / SR; pc += 2 * Math.PI * f / SR;
    const env = Math.min(1, t / .0015) * Math.exp(-t / .2) * g;
    const v = (Math.sin(pc + 1.6 * Math.exp(-t / .012) * Math.sin(pm)) + .25 * Math.sin(pc * 2) * Math.exp(-t / .05)) * env;
    put(i0 + j, v * pl, v * pr, .22, .3);
  }
}
function pop(t0, m, g, p = 0) {                          // bubbly UI pop: quick upward glide
  const i0 = at(t0), n = Math.round(.16 * SR), f = mtof(m), [pl, pr] = pan(p);
  let ph = 0;
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    ph += 2 * Math.PI * f * (.55 + .45 * Math.min(1, t / .018)) / SR;
    const env = Math.min(1, t / .002) * Math.exp(-t / .045) * g;
    const v = Math.sin(ph) * env;
    put(i0 + j, v * pl, v * pr, .15);
  }
}
function chime(t0, g) { mallet(t0, 84, g * 1.3, -.3); mallet(t0 + .07, 89, g * 1.4, .3); pop(t0, 96, g * .5); }

// ───────────────────────────── arrangement (120 BPM, beat = 0.5 s, bars start on odd seconds) ─────────────────────────────
const MUSIC = !process.env.STEM;                    // STEM=sfx / STEM=whoosh render QA stems without the music
let ticks = 0;
const CUTS = [3, 6, 9, 13, 17];
const CH = {
  F: { b: 41, v: [53, 57, 60, 64] },   // Fmaj7
  Dm: { b: 38, v: [50, 57, 60, 65] },  // Dm7
  Bb: { b: 34, v: [53, 57, 58, 62] },  // Bbmaj7/F
  C: { b: 36, v: [52, 55, 60, 62] },   // Csus2/E
};
// [bar start s, chord]; the drop is the bar at 3 s
const BARS = [[-1, 'F'], [1, 'F'], [3, 'F'], [5, 'Dm'], [7, 'Bb'], [9, 'C'], [11, 'F'], [13, 'Dm'], [15, 'Bb'], [16, 'C'], [17, 'F']];
const barAt = t => BARS.filter(b => b[0] <= t + 1e-9).pop();
if (MUSIC) {
  // kick first: it writes the sidechain envelope the music voices read
  for (let t = 3; t < 17 - 1e-6; t += BEAT) kick(t, .62, .5);
  for (let t = 17; t < DUR - .1; t += BEAT * 2) kick(t, .45, .3);           // half-time under the end card
  // intro: pad + mallet arpeggio + snaps on 2 and 4
  pad(0, 3, CH.F.v, .07, .8, .3);
  const arp = [0, 2, 1, 3, 2, 1, 3, 0];
  for (let k = 0; k < 12; k++) { const t = k * .25; mallet(t, CH.F.v[arp[k % 8]] + 24, .1 + .05 * k / 11, k % 2 ? .4 : -.4); }
  for (let t = 1.5; t < 3; t += 1) clap(t, .28);
  riser(1.6, 2.995, .22, 500, 7000);
  // groove from the drop
  for (let t = 3; t < 17 - 1e-6; t += BEAT) {
    const k = Math.round((t - 3) / BEAT);
    if (k % 2 === 1) clap(t, .6);
    hat(t + .25, .2, true, .2);
    hat(t + .125, .1, false, -.3); hat(t + .375, .12, false, -.3);
  }
  for (const [b0, name] of BARS) {
    if (b0 < 3 || b0 >= 17) continue;
    const ch = CH[name], len = (BARS.find(b => b[0] > b0) || [17])[0] - b0;
    for (const [o, l, oct, g] of [[0, .2, 0, .34], [.75, .14, 12, .26], [1, .2, 0, .34], [1.5, .14, 0, .28], [1.75, .12, 12, .22]]) if (o < len) bass(b0 + o, l, ch.b + oct, g);
    for (const [o, g] of [[.25, .12], [.75, .09], [1.25, .12], [1.625, .08]]) if (o < len) for (const m of ch.v.slice(1)) mallet(b0 + o, m + 12, g * .8, 0);
    pad(b0, b0 + len, ch.v, .04, .06, .1);
    const mel = [3, 2, 1, 2, 3, 3, 2, 0];
    for (let s = 0; s < len / .25; s++) if (s % 2 === 0 || s % 8 === 7) mallet(b0 + s * .25, ch.v[mel[s % 8]] + 24, s % 4 === 0 ? .2 : .12, s % 2 ? .45 : -.45);
  }
  riser(15.5, 16.995, .16, 600, 9000);
  // end card: crash + held Fmaj9 + mallet roll up
  crash(17, .22);
  stab(17, [...CH.F.v, 67], .1, .8, 3000, 1.8);
  bass(17, 2.6, 29, .3);
  pad(17, DUR, [...CH.F.v, 72], .05, .05, .1);
  [65, 69, 72, 76, 77, 81].forEach((m, i) => mallet(17.1 + i * .09, m, .1, i % 2 ? .4 : -.4));
}
// SFX on the cut list and the on-screen events (frames are 30 fps)
const fs = f => f / 30;
pop(fs(1), 79, .32);                                      // logo mark springs in
pop(fs(22), 86, .26, .3);                                 // "Hi!" bubble
CUTS.forEach((c, i) => whoosh(c, [.26, .3, .28, .3, .32][i], .42, .16, i % 2 ? .5 : -.5, i % 2 ? -.5 : .5));
if (process.env.STEM !== 'whoosh') {   // STEM=whoosh isolates the whooshes for peak-timing QA
[65, 67, 69, 72, 74, 77, 79].forEach((m, i) => pop(fs(92 + i * 3), m + 7, .24, -.6 + i * .2));   // cast hops up
[0, 1, 2].forEach(i => pop(fs(190 + i * 5), [84, 88, 91][i], .24, [-.5, .5, 0][i]));          // email / phone / computer
pop(fs(300), 81, .26, .3);                                // approval card
click(fs(337), .32);                                      // tap Approve
chime(fs(346), .22);                                      // booked
for (let r = 0; r < 3; r++) for (let k = 0; k < [8, 10, 8][r]; k++) { const t = fs(390 + r * 5 + k); if (t >= 13.02) { tick(t, .07, r * 10 + k); ticks++; } }  // app tiles
hit(17, .38, 89);                                         // logo lands
for (let i = 0; i < 7; i++) pop(fs(531 + i * 2), 72 + [0, 2, 4, 5, 7, 9, 12][i], .2, -.6 + i * .2);
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
mkdirSync(join(here, 'out', 'audio'), { recursive: true });
const STEMFILE = MUSIC ? 'raw.wav' : process.env.STEM === 'whoosh' ? 'whoosh-stem.wav' : 'sfx-stem.wav';
wavFloat(join(here, 'out', 'audio', STEMFILE), outL, outR);
console.log(`${STEMFILE} ${N} samples (${(N / SR).toFixed(3)} s), pre-norm peak ${peak.toFixed(3)}, ${ticks} tile ticks`);
