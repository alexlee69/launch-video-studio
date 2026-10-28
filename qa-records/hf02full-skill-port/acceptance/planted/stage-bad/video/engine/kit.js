// Isomorphic helpers (Node + browser): math, easing, springs, seeded random, copy markup.
// Nothing here touches the DOM, so blocks can import it for both their cue lists (Node) and their rendering (browser).
export const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
export const lerp = (a, b, t) => a + (b - a) * t;
export const u01 = (f, a, b) => clamp((f - a) / (b - a));
export const outExpo = t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
export const outCubic = t => 1 - Math.pow(1 - t, 3);
export const outBack = (t, c = 1.6) => 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
export const inQuad = t => t * t;
export const inCubic = t => t * t * t;
export const ioCubic = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export function spring(t, z = .5, w = .34) {
  if (t <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
}
export function rng(seed) {
  let s = seed | 0;
  return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function hashStr(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// Copy markup: "Small habits. *Big streaks.*"  →  *…* is the accent phrase, "|" forces a line break.
export function parseCopy(text = '') {
  const out = [];
  String(text).split('|').forEach((line, li) => {
    if (li) out.push({ br: true });
    line.split(/(\*[^*]+\*)/).filter(Boolean).forEach(part => {
      const acc = part.startsWith('*') && part.endsWith('*');
      out.push({ text: acc ? part.slice(1, -1) : part, accent: acc });
    });
  });
  return out;
}
export const plainCopy = text => parseCopy(text).map(p => p.br ? ' ' : p.text).join('').replace(/\s+/g, ' ').trim();
export const wordCount = text => plainCopy(text).split(/\s+/).filter(Boolean).length;

// Word-by-word reveal: each word rises over 14 frames, starting `per` frames after the previous one. In a short shot the
// spacing compresses (down to 0.3) so the last word lands by ~72 % of the shot; returns the spacing and the finish frame.
export function revealPlan(nWords, D, start = 0, per = 2.2) {
  const n = Math.max(1, nWords), room = .72 * D - 14 - start;
  const p = n > 1 ? Math.min(per, Math.max(.3, room / (n - 1))) : per;
  return { per: p, end: start + p * (n - 1) + 14 };
}
// Entrance schedule helper shared by cue lists and renders: n items spread over [a, b] local frames.
// a moving exit (whip / zoom / blur) takes a shot's last EXIT_LEN local frames; no hero/storyboard frame is picked inside it
export const EXIT_LEN = 7;
export const stagger = (n, a, b) => Array.from({ length: n }, (_, i) => n === 1 ? a : a + (b - a) * i / (n - 1));

// Drift cuts (momentum cuts, measured on a launch film): the camera speeds up into the cut (expo-in over the shot's last
// 12 frames) and the next shot enters still moving the same way, decaying ×0.7 per frame. `drift-left` etc. name the way
// the content moves, as whips do. Every other moving exit (whips, zooms, blur, the cross-cuts) takes the last 7 frames.
export const DRIFTS = ['drift-left', 'drift-right', 'drift-up', 'drift-down'];
export const isDrift = o => DRIFTS.includes(o);
export const exitLen = type => isDrift(type) ? 12 : EXIT_LEN;
export const expoIn = (u, k = 3.2) => (Math.exp(k * u) - 1) / (Math.exp(k) - 1);
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
// a momentum move of total `S` whose velocity rises ×e^(1/tin) per frame into its peak at `c` and decays ×e^(-1/tout)
// after it (a double exponential: a chat scrolling to a new message, a list stepping); returns the displacement at t
export function pulse(t, c, S, tin, tout) {
  if (t < c) return S * tin / (tin + tout) * Math.exp((t - c) / tin);
  return S * (1 - tout / (tin + tout) * Math.exp(-(t - c) / tout));
}
// `at:`-style values: a local 30-fps frame (45) or seconds ("1.5s"); null when it isn't one
export function frameAt(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const m = String(v ?? '').trim().match(/^(-?\d+(?:\.\d+)?)\s*(s|sec)?$/);
  return m ? (m[2] ? Number(m[1]) * 30 : Number(m[1])) : null;
}

// Cross-cut transitions drawn by the stage (not just a camera move): how far each reaches into the outgoing shot (pre,
// its last frames) and the incoming one (post, its first frames), in 30-fps frames. `overlay` = it draws a stage-level
// overlay above both shots (the `transition` layer in --layers); glitch only filters the camera.
export const XFX = {
  glitch: { pre: 4, post: 3, overlay: false },
  'smear-left': { pre: 6, post: 5, overlay: true },
  'smear-right': { pre: 6, post: 5, overlay: true },
  tunnel: { pre: 7, post: 10, overlay: true },
  flash: { pre: 5, post: 6, overlay: true },
};
// cinema bars (shot field `letterbox: true | 2.39 | 2.0`), px per bar, fixed to the frame. Landscape: the real bars for
// that picture ratio. Portrait / square (where 2.39:1 would leave a sliver): 8 % of the height each at 2.39, scaled with
// the ratio's bar share (2.0 → 3.5 %). Whole pixels, so the bar edge is crisp.
export function letterboxBar(v, W, H) {
  if (v == null || v === false || v === 'none') return 0;
  const R = v === true ? 2.39 : Number(v);
  if (!(R > 1)) return 0;
  if (W > H) return Math.max(0, Math.round((H - W / R) / 2));
  const share = r => Math.max(0, 1 - (16 / 9) / r);
  return Math.round(.08 * H * share(R) / share(2.39));
}

// stray edit
