// synthetic cams → cutContinuity (stageD): zoom flip, good needle carry, bad carry
import { cutContinuity, continuitySummary } from '/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit/stageD/product-launch-sting/video/lib/qa.mjs';
const c = 60, N = 120, tl = { frames: N, cuts: [c], shots: [{ id: 'A', out: 'zoom-in' }, { id: 'B', out: 'cut' }] };
const sig = x => 1 / (1 + Math.exp(-x));
const run = (name, cams) => { const C = cutContinuity({ tl, cams, W: 1920, H: 1080 }); console.log(`\n# ${name}\nINFO ${continuitySummary(C)}`); for (const w of C.warns) console.log('WARN ' + w); return C; };
// 1 · dive-like push-in (log zoom accelerating into the cut), then B starts zoomed in ×2 and settles to 1
run('zoom flip', Array.from({ length: N }, (_, i) => i < c ? { s: Math.exp(.0009 * Math.max(0, i - 40) ** 2), x: 0, y: 0 } : { s: 1 + Math.pow(.8, (i - c) / 2), x: 0, y: 0 }));
// 1b · same push-in, B grows from ×0.4 (continues forward) — must hold
run('zoom kept', Array.from({ length: N }, (_, i) => i < c ? { s: Math.exp(.0009 * Math.max(0, i - 40) ** 2), x: 0, y: 0 } : { s: 1 - .6 * Math.pow(.97, i - c), x: 0, y: 0 }));
const still = i => ({ s: 1, x: 0, y: 0 });
// 2 · good needle carry: centre slides 400→1500 and size ×1.12, both logistic, steepest on the step ending on the cut
run('carry good', Array.from({ length: N }, (_, i) => { const k = sig((i - (c - .5)) / 3), z = Math.pow(1.12, k); return { ...still(i), carry: { x: 400 + 1100 * k - 150 * z, y: 540 - 100 * z, w: 300 * z, h: 200 * z } }; }));
// 3 · bad carry: centre peaks 3 frames after the cut, size grows into the cut and shrinks after it
run('carry bad', Array.from({ length: N }, (_, i) => { const k = sig((i - (c + 3)) / 2), z = Math.exp(i <= c ? .02 * Math.max(0, i - c + 10) : .2 - .03 * (i - c)); return { ...still(i), carry: { x: 400 + 1100 * k - 150 * z, y: 540 - 100 * z, w: 300 * z, h: 200 * z } }; }));
// 4 · missing log
run('no cams', null);
// 5 · the research's needle: keys at cut−0.2 s and cut+0.2 s−1f, bezier(.95,0,.05,1), ×1.12 size, centre still — must hold
const bez = (x1, y1, x2, y2) => u => { let lo = 0, hi = 1; for (let k = 0; k < 60; k++) { const t = (lo + hi) / 2, x = 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3; if (x < u) lo = t; else hi = t; } const t = (lo + hi) / 2; return 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3; };
const nd = bez(.95, 0, .05, 1), k0 = c - 12, k1 = c + 11;
const needle = Array.from({ length: N }, (_, i) => { const p = Math.min(1, Math.max(0, (i - k0) / (k1 - k0))), z = 1 + .12 * nd(p); return { ...still(i), carry: { x: 960 - 210 * z, y: 540 - 60 * z, w: 420 * z, h: 120 * z } }; });
const Cn = run('needle carry (research shape)', needle);
console.log('speeds', JSON.stringify(Cn.cuts[0].carry[0].speeds), 'peak', JSON.stringify(Cn.cuts[0].carry[0].peak));
// 6 · the same needle one frame late (keys shifted +1): the peak lands on cut→cut+1? and +2: off the cut
for (const sh of [1, 2]) run(`needle carry keys +${sh} f`, Array.from({ length: N }, (_, i) => { const p = Math.min(1, Math.max(0, (i - k0 - sh) / (k1 - k0))), z = 1 + .12 * nd(p); return { ...still(i), carry: { x: 960 - 210 * z, y: 540 - 60 * z, w: 420 * z, h: 120 * z } }; }));
// 7 · partial log (a --range render over a film rendered before cams.json): cut without data
run('partial log', Array.from({ length: N }, (_, i) => i < 70 ? null : still(i)));
