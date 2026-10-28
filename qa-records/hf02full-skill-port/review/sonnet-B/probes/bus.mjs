import { pathToFileURL } from 'node:url';
const V = '/Users/bytedance/Downloads/Design-AutoPilot-stable/qa/hf02full-skill-port/review/sonnet-B/stage/video';
const { filmBus } = await import(pathToFileURL(V + '/lib/audio.mjs').href);
const SR = 48000, n = SR * 6;
const mk = () => { const L = new Float32Array(n), R = new Float32Array(n); let s = 1;
  for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; const x = (s / 4294967296 * 2 - 1) * 0.02; L[i] = x + 0.05 * Math.sin(2 * Math.PI * 220 * i / SR); R[i] = -x + 0.05 * Math.sin(2 * Math.PI * 330 * i / SR); }
  // loud transients: a click train at 2.5 s (3 clicks, ascending), and a DC-ish bass burst
  for (const [t, a] of [[2.5, 1.0], [2.6, 1.5], [2.7, 3.0]]) { const i = Math.round(t * SR); for (let j = 0; j < 40; j++) { L[i + j] += a * Math.exp(-j / 8) * (j % 2 ? -1 : 1); R[i + j] += a * Math.exp(-j / 8) * (j % 2 ? 1 : -1); } }
  return [L, R]; };
const mx = X => { let m = 0; for (let i = 0; i < X.length; i++) m = Math.max(m, Math.abs(X[i])); return m; };
const [L, R] = mk(); const pre = Math.max(mx(L), mx(R));
// replicate: T = p90 of 0.4 s RMS windows (after 1.7x gain + LPF) x 8 dB; print ratio of output peak to the quiet body
filmBus(L, R);
const pk = Math.max(mx(L), mx(R));
let e = 0; const a = Math.round(0.5 * SR), b = Math.round(2.0 * SR); for (let i = a; i < b; i++) e += L[i] * L[i] + R[i] * R[i]; const body = Math.sqrt(e / (2 * (b - a)));
console.log({ pre: +pre.toFixed(3), outPeak: +pk.toFixed(3), bodyRms: +body.toFixed(4), peakOverBody_dB: +(20 * Math.log10(pk / body)).toFixed(2), expected_ceiling_dB: 8 });
let s = 0; for (let i = 0; i < n; i++) s += L[i] + R[i]; console.log('dc', (s / n / 2).toExponential(2));
