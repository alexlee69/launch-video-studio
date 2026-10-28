// Worker D fix pass: synthetic camera logs for the rules the monitor's findings changed (stageD's cutContinuity).
// Each case says what must happen; the script prints the INFO line + WARNs and exits 1 when a case misbehaves.
import { cutContinuity, continuitySummary, CONT } from '/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit/stageD/product-launch-sting/video/lib/qa.mjs';
let bad = 0;
const run = (name, tl, cams, want) => {
  const C = cutContinuity({ tl, cams, W: 1920, H: 1080 }), info = continuitySummary(C);
  const ok = want(C, info);
  console.log(`\n# ${name} — ${ok ? 'ok' : 'MISBEHAVES'}\nINFO ${info}`); for (const w of C.warns) console.log('WARN ' + w);
  if (!ok) bad++;
};
const R = CONT.R, N = 120, c = 60;
// camera log from per-step zoom speeds z[i] (1/s) and pan speeds vx[i] (px/s at 1080), restarting at each cut
const camLog = (cuts, z, vx, s0 = {}) => { let s = 1, x = 0; return Array.from({ length: N }, (_, i) => { if (i === 0 || cuts.includes(i)) { s = s0[i] ?? 1; x = 0; } else { const q = Math.exp((z(i) || 0) / 60); s *= q; x = q * x + (vx(i) || 0) / 60; } return { s, x, y: 0, blur: 0 }; }); };
const two = (outA, extra = {}) => ({ frames: N, cuts: [c], shots: [{ id: 'A', out: outA, ...(extra.A || {}) }, { id: 'B', out: 'cut', ...(extra.B || {}) }] });
// A pushes in, accelerating to 3.0/s on its last step; B keeps pushing in at 1.2/s, decaying → 2.5× across the cut
const push = camLog([c], i => i < c ? 3.0 * (i / (c - 1)) ** 3 : 1.2 * Math.pow(.8, (i - c - 1) / 2), () => 0, { [c]: .3 });
run('1 · dive, B enters 2.5× slower: WARN at the dive limit (2×)', two('dive'), push, C => C.warns.length === 1 && /limit 2×/.test(C.warns[0]) && C.cuts[0].camera.warn.join() === 'speed');
run('2 · the same speeds after zoom-in: hold (3×)', two('zoom-in'), push, C => !C.warns.length && C.cuts[0].camera.ratio === 2.5);
// carries: centre steps (px per frame) around the cut; peak on the step that ends on the cut
const carryLog = (dx, end = N) => { let x = 300; return Array.from({ length: N }, (_, i) => { x += dx(i); return { s: 1, x: 0, y: 0, blur: 0, ...(i < end ? { carry: { x, y: 400, w: 300, h: 200 } } : {}) }; }); };
const steps = { [c - 3]: 8, [c - 2]: 11, [c - 1]: 17, [c]: 26, [c + 1]: 6.8, [c + 2]: 4, [c + 3]: 2 };
run('3 · carry: 1020 → 408 px/s around a peak on the cut (2.5×): WARN (carry limit 2×)', two('cut'), carryLog(i => steps[i] || 0), C => C.warns.length === 1 && /carried object's speed .*limit 2×/.test(C.warns[0]));
const steps2 = { ...steps, [c + 1]: 12 };
run('4 · carry: 1020 → 720 px/s (1.4×), peak on the cut: hold', two('cut'), carryLog(i => steps2[i] || 0), C => !C.warns.length);
// a carry that ends on the cut (a morph into the whole frame): rectangle until cut−1
run('5 · carry ending on the cut, accelerating: hold, named in INFO', two('zoom-in'), carryLog(i => i < c ? 2 ** ((i - 40) / 3) : 0, c), (C, info) => !C.warns.length && /ends on the cut/.test(info) && C.cuts[0].carry[0].half === 'before');
run('6 · carry ending on the cut, peaking 4 frames early: WARN', two('zoom-in'), carryLog(i => i < c ? 30 * Math.exp(-(((i - (c - 5)) / 2) ** 2)) : 0, c), C => C.warns.length === 1 && /fastest step is 4 frames early/.test(C.warns[0]));
// three shots P | A (40–63) | B: A came in on a whip (pan decaying from its first frame) and hard-cuts out
const pOut = i => i > 25 ? -9800 * ((i - 25) / 14) ** 3 : 0;          // P's whip-left exit ramp
const three = { frames: N, cuts: [40, 64], shots: [{ id: 'P', out: 'whip-left' }, { id: 'A', out: 'cut' }, { id: 'B', out: 'cut' }] };
run('7 · A only slows down from its first frame (entrance settling): no WARN, named in INFO', three, camLog([40, 64], () => 0, i => i < 40 ? pOut(i) : i < 64 ? -(400 + 4000 * .85 ** (i - 41)) : -350),
  (C, info) => !C.warns.length && /still settling/.test(info) && C.cuts[1].camera.peak.settle === true);
run('8 · A also has a pan bump peaking on 59→60, 3 steps before its last: WARN', three, camLog([40, 64], () => 0, i => i < 40 ? pOut(i) : i < 64 ? -(400 + 4000 * .85 ** (i - 41) + 1400 * Math.exp(-(((i - 60) / 2) ** 2))) : -600),
  C => C.warns.length === 1 && /fastest step is 3 frames before the cut \(frames 59→60/.test(C.warns[0]));
// a still shot hard-cuts into a short insert (0.25 s) that whips out: the insert's exit ramp belongs to the next cut
const ins = { frames: N, cuts: [60, 75], shots: [{ id: 'P', out: 'cut' }, { id: 'Q', out: 'whip-left', f1: 37.5 }, { id: 'S', out: 'cut' }] };
const whipOut = i => i < 60 ? 0 : i < 75 ? (i > 61 ? -9800 * ((i - 61) / 14) ** 3 : 0) : -4400 * .8 ** ((i - 76) / 2);
run('9 · still → a short insert that whips out: the P→Q cut is quiet', ins, camLog([60, 75], i => i >= 60 && i < 75 ? .26 : 0, whipOut), (C, info) => !C.warns.length && !C.cuts[0].camera.moving);
// tuned drift: hf02's b→c (drift-down, c drift in 6.5): 14× faster after the cut — INFO, not WARN; a flip still WARNs
const drift = (inB) => ({ frames: N, cuts: [c], shots: [{ id: 'A', out: 'drift-down' }, { id: 'B', out: 'cut', ...(inB ? { drift: { in: inB } } : {}) }] });
const dlog = sign => Array.from({ length: N }, (_, i) => ({ s: 1, x: 0, y: i < c ? 391 / 60 * i * (i / c) : sign * 5504 / 60 * (i - c) * Math.pow(.97, i - c), blur: 0 }));
run('10 · drift cut 14× faster, drift.in set: INFO (tuned), no WARN', drift(6.5), dlog(1), (C, info) => !C.warns.length && /tuned drift/.test(info) && C.cuts[0].camera.tuned);
run('11 · the same cut with default strengths: WARN', drift(null), dlog(1), C => C.warns.length === 1 && /limit 3×/.test(C.warns[0]));
run('12 · tuned drift that flips direction: the flip still WARNs', drift(6.5), dlog(-1), C => C.warns.length === 1 && /flips direction/.test(C.warns[0]));
// near-still side: 1 px/s → 450 px/s reads "from rest", never a 400× ratio
run('13 · still → moving (450 px/s): "from rest", no fake ratio', two('cut'), camLog([c], () => 0, i => i < c ? 1 : 450), (C, info) => C.warns.length === 1 && /from rest, limit 3×/.test(C.warns[0]) && !/\d{3}\.\d+×/.test(info + C.warns[0]));
console.log(`\n${bad ? `${bad} case(s) MISBEHAVE` : 'all cases behave'}`);
process.exit(bad ? 1 : 0);
