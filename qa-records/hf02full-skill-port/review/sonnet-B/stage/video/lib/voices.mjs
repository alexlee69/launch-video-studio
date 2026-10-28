// Synth engine: a stereo bus + reverb/delay sends + kick sidechain, and every instrument / SFX voice as a method.
// All randomness is seeded, so a timeline always renders the same audio. Ported from the sting and the Cue proof cut.
import { writeFileSync } from 'node:fs';
import { SR } from './common.mjs';

export function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const pan = p => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];

class Biquad {
  constructor() { this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set('lp', 1000, .707); }
  set(type, f, Q) {
    const w = 2 * Math.PI * Math.min(Math.max(f, 10), SR * .45) / SR, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * Q);
    let b0, b1, b2; const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
    if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; } else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; } else { b0 = al; b1 = 0; b2 = -al; }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0; return this;
  }
  p(x) { const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
}
function blep(t, dt) { if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; }
class Saw { constructor(f, ph) { this.dt = f / SR; this.ph = ph; } next() { const v = 2 * this.ph - 1 - blep(this.ph, this.dt); this.ph += this.dt; if (this.ph >= 1) this.ph -= 1; return v; } }

export function makeEngine(DUR) {
  const N = Math.round(DUR * SR);
  const L = new Float64Array(N), R = new Float64Array(N), RVL = new Float64Array(N), RVR = new Float64Array(N), DLY = new Float64Array(N), duck = new Float64Array(N).fill(1);
  const at = t => Math.round(t * SR);
  function put(i, l, r, rv = 0, dl = 0) { if (i < 0 || i >= N) return; L[i] += l; R[i] += r; if (rv) { RVL[i] += l * rv; RVR[i] += r * rv; } if (dl) DLY[i] += (l + r) * .5 * dl; }
  const dk = i => (i >= 0 && i < N ? duck[i] : 1);
  const E = {
    N, put,
    kick(t0, g = 1, depth = .62) {
      const i0 = at(t0), n = Math.round(.5 * SR), r = rng(i0), hp = new Biquad().set('hp', 1800, .7); let ph = 0;
      for (let j = 0; j < n; j++) {
        const t = j / SR, f = 44 + 92 * Math.exp(-t / .032) + 170 * Math.exp(-t / .004); ph += 2 * Math.PI * f / SR;
        const env = Math.min(1, t / .0008) * Math.exp(-t / .2) * (t > .34 ? Math.max(0, 1 - (t - .34) / .1) : 1);
        const s = (Math.tanh(Math.sin(ph) * env * 1.7) / Math.tanh(1.7) + hp.p(r() * 2 - 1) * Math.exp(-t / .0022) * .28) * g;
        put(i0 + j, s, s);
        if (depth && t < .42 && i0 + j < N) duck[i0 + j] = Math.min(duck[i0 + j], 1 - depth * (t < .004 ? t / .004 : Math.exp(-(t - .004) / .11)));
      }
    },
    clap(t0, g = 1) {
      const i0 = at(t0), n = Math.round(.4 * SR), r = rng(i0 + 7), bp = new Biquad().set('bp', 1150, .85), hp = new Biquad().set('hp', 520, .7);
      for (let j = 0; j < n; j++) {
        const t = j / SR; let env = 0;
        for (const o of [0, .0105, .021]) if (t >= o) env = Math.max(env, Math.exp(-(t - o) / .0075));
        if (t >= .021) env = Math.max(env, .5 * Math.exp(-(t - .021) / .12));
        const v = hp.p(bp.p(r() * 2 - 1)) * env * g * 2.4; put(i0 + j, v * .94, v, .32);
      }
    },
    hat(t0, g, open, p = 0) {
      const i0 = at(t0), dec = open ? .15 : .028, n = Math.round((open ? .5 : .12) * SR), r = rng(i0 + 3), hp = new Biquad().set('hp', open ? 7000 : 8200, .7), bp = new Biquad().set('bp', 10500, .6), [pl, pr] = pan(p);
      for (let j = 0; j < n; j++) { const t = j / SR, env = Math.min(1, t / .0006) * Math.exp(-t / dec), x = r() * 2 - 1, v = (hp.p(x) * .7 + bp.p(x) * .5) * env * g; put(i0 + j, v * pl, v * pr, open ? .12 : .04); }
    },
    crash(t0, g) {
      const i0 = at(t0), n = Math.round(2.2 * SR), rl = rng(i0 + 11), rr = rng(i0 + 12), hl = new Biquad().set('hp', 4200, .7), hr = new Biquad().set('hp', 4200, .7);
      for (let j = 0; j < n; j++) { const t = j / SR, env = Math.min(1, t / .002) * (Math.exp(-t / .55) * .8 + Math.exp(-t / .05) * .4) * g; put(i0 + j, hl.p(rl() * 2 - 1) * env, hr.p(rr() * 2 - 1) * env, .25); }
    },
    bass(t0, dur, m, g) {
      const i0 = at(t0), n = Math.round((dur + .03) * SR), f = mtof(m), lp = new Biquad().set('lp', 520, .8); let ph = 0;
      for (let j = 0; j < n; j++) {
        const t = j / SR; ph += 2 * Math.PI * f / SR;
        const env = Math.min(1, t / .004) * (.68 + .32 * Math.exp(-t / .07)) * (t > dur ? Math.max(0, 1 - (t - dur) / .03) : 1);
        const v = lp.p(Math.tanh((Math.sin(ph) + .32 * Math.sin(2 * ph) + .12 * Math.sin(3 * ph)) * 1.3)) * env * g * dk(i0 + j); put(i0 + j, v, v);
      }
    },
    stab(t0, notes, g, decay = .2, cut = 3800, len = .34) {
      const i0 = at(t0), n = Math.round((len + .05) * SR), vs = [];
      for (const m of notes) for (const [c, p] of [[-7, -.55], [0, 0], [7, .55]]) { const [pl, pr] = pan(p); vs.push({ o: new Saw(mtof(m) * Math.pow(2, c / 1200), (m * .137 + c * .01 + 1) % 1), pl, pr }); }
      const fl = new Biquad(), fr = new Biquad();
      for (let j = 0; j < n; j++) {
        const t = j / SR; if (j % 16 === 0) { const fc = 340 + cut * Math.exp(-t / .075); fl.set('lp', fc, .9); fr.set('lp', fc, .9); }
        let l = 0, r = 0; for (const v of vs) { const s = v.o.next(); l += s * v.pl; r += s * v.pr; }
        const env = Math.min(1, t / .002) * Math.exp(-t / decay) * (t > len ? Math.max(0, 1 - (t - len) / .05) : 1) * g * dk(i0 + j);
        put(i0 + j, fl.p(l) * env, fr.p(r) * env, .34, .26);
      }
    },
    pad(t0, t1, notes, g, att = .7, rel = .5) {
      const i0 = at(t0), n = Math.round((t1 - t0 + rel) * SR), vs = [], span = t1 - t0;
      for (const m of notes) for (const [c, p] of [[-9, -.7], [9, .7]]) { const [pl, pr] = pan(p); vs.push({ o: new Saw(mtof(m) * Math.pow(2, c / 1200), (m * .31 + c * .05 + 1) % 1), pl, pr }); }
      const fl = new Biquad(), fr = new Biquad();
      for (let j = 0; j < n; j++) {
        const t = j / SR; if (j % 32 === 0) { const fc = 1150 + 380 * Math.sin(2 * Math.PI * .23 * (t0 + t)); fl.set('lp', fc, .6); fr.set('lp', fc, .6); }
        let l = 0, r = 0; for (const v of vs) { const s = v.o.next(); l += s * v.pl; r += s * v.pr; }
        const env = Math.min(1, t / att) * (t > span ? Math.max(0, 1 - (t - span) / rel) : 1) * g * dk(i0 + j);
        put(i0 + j, fl.p(l) * env, fr.p(r) * env, .45);
      }
    },
    pluck(t0, m, g, p = 0) {
      const i0 = at(t0), n = Math.round(.5 * SR), f = mtof(m), [pl, pr] = pan(p); let pc = 0, pm = 0;
      for (let j = 0; j < n; j++) { const t = j / SR; pm += 2 * Math.PI * f * 2 / SR; pc += 2 * Math.PI * f / SR; const v = Math.sin(pc + 1.2 * Math.exp(-t / .05) * Math.sin(pm)) * Math.min(1, t / .002) * Math.exp(-t / .15) * g; put(i0 + j, v * pl, v * pr, .2, .42); }
    },
    mallet(t0, m, g, p = 0) {
      const i0 = at(t0), n = Math.round(.6 * SR), f = mtof(m), [pl, pr] = pan(p); let pc = 0, pm = 0;
      for (let j = 0; j < n; j++) { const t = j / SR; pm += 2 * Math.PI * f * 4 / SR; pc += 2 * Math.PI * f / SR; const v = (Math.sin(pc + 1.6 * Math.exp(-t / .012) * Math.sin(pm)) + .25 * Math.sin(pc * 2) * Math.exp(-t / .05)) * Math.min(1, t / .0015) * Math.exp(-t / .2) * g; put(i0 + j, v * pl, v * pr, .22, .3); }
    },
    // ── SFX ──
    pop(t0, m, g, p = 0) {
      const i0 = at(t0), n = Math.round(.16 * SR), f = mtof(m), [pl, pr] = pan(p); let ph = 0;
      for (let j = 0; j < n; j++) { const t = j / SR; ph += 2 * Math.PI * f * (.55 + .45 * Math.min(1, t / .018)) / SR; const v = Math.sin(ph) * Math.min(1, t / .002) * Math.exp(-t / .045) * g; put(i0 + j, v * pl, v * pr, .15); }
    },
    tick(t0, g, k = 0) {
      const i0 = at(t0), n = Math.round(.012 * SR), r = rng(i0 + 61), h = rng(k * 97 + 5)(), bp = new Biquad().set('bp', 2600 + 1700 * h, 2.2), [pl, pr] = pan(-.25 + .5 * h);
      for (let j = 0; j < n; j++) { const v = bp.p(r() * 2 - 1) * Math.exp(-(j / SR) / .0013) * g * (.75 + .5 * h); put(i0 + j, v * pl, v * pr, .05); }
    },
    click(t0, g) {
      for (const [o, k] of [[0, 1], [.072, .55]]) {
        const i0 = at(t0 + o), n = Math.round(.02 * SR), r = rng(i0 + 51), bp = new Biquad().set('bp', 3300, 2.8); let ph = 0;
        for (let j = 0; j < n; j++) { const t = j / SR; ph += 2 * Math.PI * 1850 / SR; const v = (bp.p(r() * 2 - 1) * Math.exp(-t / .0018) * 2.2 + Math.sin(ph) * Math.exp(-t / .0028) * .35) * g * k; put(i0 + j, v * .9, v, .06); }
      }
    },
    chime(t0, g) { E.mallet(t0, 84, g * 1.3, -.3); E.mallet(t0 + .07, 89, g * 1.4, .3); E.pop(t0, 96, g * .5); },
    hit(t0, g, note) {
      const i0 = at(t0), n = Math.round(1.6 * SR), r = rng(i0 + 41), bp = new Biquad().set('bp', 2300, 1.1), f = mtof(note); let ph = 0, pc = 0, pm = 0;
      for (let j = 0; j < n; j++) {
        const t = j / SR; ph += 2 * Math.PI * (54 + 50 * Math.exp(-t / .04)) / SR; pm += 2 * Math.PI * f * 3.5 / SR; pc += 2 * Math.PI * f / SR;
        const v = (Math.sin(ph) * Math.min(1, t / .002) * Math.exp(-t / .2) + bp.p(r() * 2 - 1) * Math.exp(-t / .028) * 1.6) * g;
        const w = Math.sin(pc + 2.2 * Math.exp(-t / .12) * Math.sin(pm)) * Math.min(1, t / .002) * Math.exp(-t / .55) * .55 * g;
        put(i0 + j, v + w * .8, v + w, .45);
      }
    },
    whoosh(tp, g, pre = .42, post = .16, p0 = -.5, p1 = .5) {
      const ts = tp - pre, i0 = at(ts), n = Math.round((pre + post + .1) * SR), rl = rng(i0 + 21), rr = rng(i0 + 22), bl = new Biquad(), br = new Biquad(), ll = new Biquad().set('lp', 220, .7);
      for (let j = 0; j < n; j++) {
        const t = ts + j / SR, u = Math.min(1, (t - ts) / pre);
        const fc = t < tp ? 300 * Math.pow(3400 / 300, Math.pow(u, 1.5)) : 3400 * Math.pow(800 / 3400, Math.min(1, (t - tp) / post));
        if (j % 16 === 0) { bl.set('bp', fc, .95); br.set('bp', fc * 1.06, .95); }
        const env = (t < tp ? Math.pow(u, 2.6) : Math.exp(-(t - tp) / .065)) * g, [pl, pr] = pan(p0 + (p1 - p0) * Math.min(1, (t - ts) / (pre + post * .5)));
        const xl = rl() * 2 - 1, xr = rr() * 2 - 1, low = ll.p((xl + xr) * .5) * 1.6;
        put(i0 + j, (bl.p(xl) * 1.5 + low) * env * pl * 1.3, (br.p(xr) * 1.5 + low) * env * pr * 1.3, .22);
      }
    },
    // a whoosh with its own band sweep (f0 → fp at the peak tp → f2), Q and low-end share: the cross-cut transitions'
    // flavours (whoosh above stays exactly as it was for the camera moves). Peaks on tp like whoosh.
    sweep(tp, g, { pre = .42, post = .16, f0 = 300, fp = 3400, f2 = 800, q = .95, low = 1.6, p0 = -.5, p1 = .5, tail = .065 } = {}) {
      const ts = tp - pre, i0 = at(ts), n = Math.round((pre + post + .1) * SR), rl = rng(i0 + 23), rr = rng(i0 + 24), bl = new Biquad(), br = new Biquad(), ll = new Biquad().set('lp', 220, .7);
      for (let j = 0; j < n; j++) {
        const t = ts + j / SR, u = Math.min(1, (t - ts) / pre);
        const fc = t < tp ? f0 * Math.pow(fp / f0, Math.pow(u, 1.5)) : fp * Math.pow(f2 / fp, Math.min(1, (t - tp) / post));
        if (j % 16 === 0) { bl.set('bp', fc, q); br.set('bp', fc * 1.06, q); }
        const env = (t < tp ? Math.pow(u, 2.6) : Math.exp(-(t - tp) / tail)) * g, [pl, pr] = pan(p0 + (p1 - p0) * Math.min(1, (t - ts) / (pre + post * .5)));
        const xl = rl() * 2 - 1, xr = rr() * 2 - 1, lo = ll.p((xl + xr) * .5) * low;
        put(i0 + j, (bl.p(xl) * 1.5 + lo) * env * pl * 1.3, (br.p(xr) * 1.5 + lo) * env * pr * 1.3, .22);
      }
    },
    // glitch: a digital stutter into the cut — gated, bit-crushed and sample-held noise over a square buzz, the gate
    // fully open around tp so the burst peaks on it, then a quick decay
    glitch(tp, g, seed = 1) {
      const ts = tp - .2, i0 = at(ts), n = Math.round(.34 * SR), r = rng(i0 + 91 + seed), gr = rng(seed * 31 + 7), bp = new Biquad().set('bp', 2400, .8);
      const gates = []; for (let t = 0; t < .34; t += .012 + .02 * gr()) gates.push([t, gr() < .62]);
      let hold = 0, hv = 0, ph = 0;
      for (let j = 0; j < n; j++) {
        const t = j / SR, tt = ts + t, near = Math.abs(tt - tp) < .011;
        let on = near; for (let k = gates.length - 1; k >= 0; k--) if (gates[k][0] <= t) { on = on || gates[k][1]; break; }
        if (!on) continue;
        if (--hold <= 0) { hold = 6 + Math.floor(10 * r()); hv = Math.round((r() * 2 - 1) * 4) / 4; }   // sample-hold + 3-bit crush
        ph += 2 * Math.PI * (180 + 420 * ((tt * 37) % 1)) / SR;
        const env = (tt < tp ? Math.pow(Math.min(1, t / .2), 2.2) : Math.exp(-(tt - tp) / .045)) * g;
        const v = (bp.p(hv) * 1.6 + Math.sign(Math.sin(ph)) * .22) * env;
        put(i0 + j, v * (j % 2 ? .9 : 1), v * (j % 2 ? 1 : .9), .1);
      }
    },
    riser(t0, t1, g, f0 = 400, f1 = 7000) {
      if (t1 - t0 < .2) return;
      const i0 = at(t0), n = Math.round((t1 - t0) * SR), rl = rng(i0 + 81), rr = rng(i0 + 82), bl = new Biquad(), br = new Biquad();
      for (let j = 0; j < n; j++) { const u = j / n; if (j % 16 === 0) { const fc = f0 * Math.pow(f1 / f0, u); bl.set('bp', fc, 1.6); br.set('bp', fc * 1.04, 1.6); } const env = Math.pow(u, 2.2) * Math.min(1, (n - j) / (SR * .008)) * g; put(i0 + j, bl.p(rl() * 2 - 1) * env, br.p(rr() * 2 - 1) * env, .3); }
    },
    // reverb + ping-pong delay (sends high-passed, or the reverb rings as a sub rumble), then the dry+wet stereo pair
    mixdown(BEAT) {
      const hpf = (x, fc) => { const a = new Biquad().set('hp', fc, .7), b = new Biquad().set('hp', fc, .7); for (let i = 0; i < N; i++) x[i] = b.p(a.p(x[i])); return x; };
      const [rvL, rvR] = freeverb(hpf(RVL, 280), hpf(RVR, 280), N), [dlL, dlR] = pingpong(hpf(DLY, 220), .75 * BEAT, N);
      const hpL = new Biquad().set('hp', 28, .7), hpR = new Biquad().set('hp', 28, .7), oL = new Float32Array(N), oR = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        oL[i] = hpL.p(L[i] + rvL[i] * 1.1 + dlL[i] * .55); oR[i] = hpR.p(R[i] + rvR[i] * 1.1 + dlR[i] * .55);
        if (!Number.isFinite(oL[i]) || !Number.isFinite(oR[i])) throw new Error('non-finite audio sample at ' + i);
      }
      return [oL, oR];
    },
  };
  return E;
}

function freeverb(inL, inR, N, room = .84, damp = .32) {
  const sc = SR / 44100, combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map(x => Math.round(x * sc)), apT = [556, 441, 341, 225].map(x => Math.round(x * sc)), spread = Math.round(23 * sc);
  const fb = room * .28 + .7, d = damp * .4, mk = len => ({ b: new Float64Array(len), i: 0, s: 0 });
  const cl = combT.map(mk), cr = combT.map(t => mk(t + spread)), al = apT.map(mk), ar = apT.map(t => mk(t + spread));
  const oL = new Float64Array(N), oR = new Float64Array(N);
  const comb = (c, x) => { const y = c.b[c.i]; c.s = y * (1 - d) + c.s * d; c.b[c.i] = x + c.s * fb; if (++c.i >= c.b.length) c.i = 0; return y; };
  const ap = (a, x) => { const bo = a.b[a.i], y = -x + bo; a.b[a.i] = x + bo * .5; if (++a.i >= a.b.length) a.i = 0; return y; };
  for (let i = 0; i < N; i++) {
    const x = (inL[i] + inR[i]) * .015; let l = 0, r = 0;
    for (let k = 0; k < 8; k++) { l += comb(cl[k], x); r += comb(cr[k], x); }
    for (let k = 0; k < 4; k++) { l = ap(al[k], l); r = ap(ar[k], r); }
    oL[i] = l; oR[i] = r;
  }
  return [oL, oR];
}
function pingpong(inp, delayS, N, fbk = .36) {
  const D = Math.round(delayS * SR), oL = new Float64Array(N), oR = new Float64Array(N), lp = new Biquad().set('lp', 3200, .7), lp2 = new Biquad().set('lp', 3200, .7);
  for (let i = 0; i < N; i++) { const a = i >= D ? i - D : -1; oL[i] = a >= 0 ? inp[a] + lp.p(oR[a]) * fbk : 0; oR[i] = a >= 0 ? lp2.p(oL[a]) * fbk : 0; }
  return [oL, oR];
}

// float32 stereo WAV (IEEE, format 3) — unnormalised stems keep their relative levels
export function writeWav(path, chL, chR) {
  const n = chL.length, data = Buffer.alloc(n * 8), hdr = Buffer.alloc(44);
  for (let i = 0; i < n; i++) { data.writeFloatLE(chL[i], i * 8); data.writeFloatLE(chR[i], i * 8 + 4); }
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(3, 20); hdr.writeUInt16LE(2, 22);
  hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 8, 28); hdr.writeUInt16LE(8, 32); hdr.writeUInt16LE(32, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([hdr, data]));
}
