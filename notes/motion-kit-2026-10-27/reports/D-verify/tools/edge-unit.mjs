// Verify-pass edge cases for stageD's cutContinuity (synthetic camera logs). Prints INFO/WARN per case.
const { cutContinuity, continuitySummary } = await import((process.env.STAGE || '/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/motion-kit/stageD/product-launch-sting') + '/video/lib/qa.mjs');
const N = 120;
const run = (name, tl, cams, W = 1920, H = 1080) => { let C; try { C = cutContinuity({ tl, cams, W, H }); } catch (e) { console.log(`\n# ${name}\nTHROWS ${e.stack.split('\n').slice(0, 2).join(' ')}`); return; }
  console.log(`\n# ${name}\nINFO ${continuitySummary(C)}`); for (const w of C.warns) console.log('WARN ' + w); return C; };
const log = (cuts, vx) => { let x = 0; return Array.from({ length: N }, (_, i) => { if (i === 0 || cuts.includes(i)) x = 0; else x += (vx(i) || 0) / 60; return { s: 1, x, y: 0, blur: 0 }; }); };
// 1 · an insert SHORTER than its own drift exit (0.2 s = 12 frames @60 < 24): window logic must not throw or invert
run('insert shorter than its drift exit', { frames: N, cuts: [60, 72], shots: [{ id: 'P', out: 'cut', f1: 30 }, { id: 'Q', out: 'drift-left', f1: 36 }, { id: 'S', out: 'cut', f1: 60 }] },
  log([60, 72], i => i >= 60 && i < 72 ? -200 * (i - 59) : i >= 72 ? -1500 * 0.7 ** (i - 72) : 0));
// 2 · two shots only, the incoming one is the last: bx = b1 path
run('last shot incoming, whip', { frames: N, cuts: [60], shots: [{ id: 'A', out: 'whip-left', f1: 30 }, { id: 'B', out: 'cut', f1: 60 }] },
  log([60], i => i < 60 ? (i > 46 ? -9800 * ((i - 46) / 14) ** 3 : 0) : -4400 * 0.8 ** ((i - 61) / 2)));
// 3 · a cams log with nulls in the middle (a --range over an old film): no throw, INFO names it
const c3 = log([60], i => i < 60 ? (i > 46 ? -9800 * ((i - 46) / 14) ** 3 : 0) : -4400 * 0.8 ** ((i - 61) / 2)); for (let i = 55; i < 66; i++) c3[i] = null;
run('nulls around the cut', { frames: N, cuts: [60], shots: [{ id: 'A', out: 'whip-left', f1: 30 }, { id: 'B', out: 'cut', f1: 60 }] }, c3);
// 4 · a carry present only AFTER the cut (starts on the cut): named as too short, never silent
const c4 = Array.from({ length: N }, (_, i) => ({ s: 1, x: 0, y: 0, blur: 0, ...(i >= 60 && i < 70 ? { carry: { x: 100 + 10 * i, y: 100, w: 200, h: 100 } } : {}) }));
run('carry only after the cut', { frames: N, cuts: [60], shots: [{ id: 'A', out: 'cut', f1: 30 }, { id: 'B', out: 'cut', f1: 60 }] }, c4);
// 5 · drift cut, tuned strengths AND a peak off the cut: the peak still WARNs, the ratio does not
run('tuned drift with a late peak', { frames: N, cuts: [60], shots: [{ id: 'A', out: 'drift-left', f1: 30 }, { id: 'B', out: 'cut', f1: 60, drift: { in: 6 } }] },
  log([60], i => i < 60 ? (i > 36 ? -300 * ((i - 36) / 24) : 0) : -(3000 + 2500 * Math.exp(-(((i - 64) / 1.5) ** 2)))));
// 6 · a whip-left exit into an insert shorter than its own whip-RIGHT exit: the speed is not judged, the flip still WARNs
run('flip into an insert shorter than its exit', { frames: N, cuts: [60, 72], shots: [{ id: 'P', out: 'whip-left', f1: 30 }, { id: 'Q', out: 'whip-right', f1: 36 }, { id: 'S', out: 'cut', f1: 60 }] },
  log([60, 72], i => i < 60 ? (i > 46 ? -9800 * ((i - 46) / 14) ** 3 : 0) : i < 72 ? 700 * (i - 59) : 4400 * 0.8 ** ((i - 73) / 2)));
