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
export const exitLen = type => isDrift(type) ? 12 : type === 'dive' || type === 'flood' ? DIVE_LEN : EXIT_LEN;
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
  flood: { pre: 14, post: 7, overlay: true },        // round 2: the next background pours out of what was pressed
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

// ── round 2: cross-cut continuity (carry · morph · dive · from: · flood). Timing in 30-fps frames. ──
// dive (and flood) exits take a shot's last DIVE_LEN frames: a log-space zoom about the target, expo-in
export const DIVE_LEN = 14;
// a shot entered by a dive starts at ×from (.3): text that builds up from nothing under it (a word-by-word rise, a name
// tracking in) landed the dive on a near-empty frame (review fix #8). diveTime(t) is the entrance's own clock there:
// DIVE_PRE frames ahead on the cut, caught up by DIVE_CATCH (t + PRE·(1 − t/CATCH), monotonic), so the text arrives
// with the dive and keeps settling; later beats keep their frames. ctx.reveal and type's name use it (ctx.entered)
export const DIVE_PRE = 14, DIVE_CATCH = 36;
export const diveTime = t => t >= DIVE_CATCH ? t : t + DIVE_PRE * (1 - Math.max(0, t) / DIVE_CATCH);
// CSS-style cubic bezier (x1, y1, x2, y2) → an easing t → y (Newton on x, bisection fallback); pure
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = s => ((ax * s + bx) * s + cx) * s, Y = s => ((ay * s + by) * s + cy) * s, dX = s => (3 * ax * s + 2 * bx) * s + cx;
  return x => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let s = x;
    for (let i = 0; i < 8; i++) { const e = X(s) - x, d = dX(s); if (Math.abs(e) < 1e-7 || Math.abs(d) < 1e-6) break; s -= e / d; }
    if (!(Math.abs(X(s) - x) < 1e-6)) { let lo = 0, hi = 1; for (let i = 0; i < 50; i++) { s = (lo + hi) / 2; if (X(s) < x) lo = s; else hi = s; } }
    return Y(s);
  };
}
export const smooth = bezier(.5, 0, .1, 1);       // a carry's travel: bell-shaped speed peaking ~⅓ in (on the cut with pre 8 / post 14)
export const needle = bezier(.95, 0, .05, 1);     // the needle zoom: ~20× the average speed in the middle frame (the cut)
export const soft = bezier(.16, 1, .3, 1);        // a decelerating settle (grow-from-a-point's scale)
// grow from a point (a shot's `from:`): an element born at origin o ({x, y}, block px; ctx.origin) at scale s0 flies on a
// gentle arc (arc × the chord, bowing up) to its resting centre r over len frames from t0 — position out(3), scale
// soft, bank (deg) → 0, opacity up within 2.5 frames (.4 at birth: a born thing is on screen). Returns {x, y, s, rot, op, k}; k ≥ 1 = landed (use the rest
// pose as is). One line in a block: `const g = ctx.origin && K.grow(ctx.origin, {x: cx, y: cy}, t, {t0: i * 3, bank, w, h})`
// then draw the element centred on (g.x, g.y), × g.s, rotated g.rot, opacity × g.op (see float / stack / wall / fan).
// w, h = the element's own size: born out of a layer (ctx.origin.w / .h, its size where it was), it starts at that size
// (s0 = √(area ratio), clamped .06–.6); lead = the element that leaves first takes the source's size whole (up to ×3, at
// full opacity) — the source splits into the cards, so a big card never shrinks to a speck on the cut; out of a point, .06
export function grow(o, r, t, { t0 = 0, len = 16, s0 = null, bank = 0, arc = .12, w = 0, h = 0, lead = false } = {}) {
  if (s0 == null) s0 = o.w && o.h && w && h ? clamp(Math.sqrt((o.w * o.h) / (w * h)), .06, lead ? 3 : .6) : .06;
  const whole = lead && s0 > .3;
  const k = (t - t0) / len, q = clamp(k), e = outCubic(q), dx = r.x - o.x, dy = r.y - o.y, L = Math.hypot(dx, dy) || 1;
  let nx = -dy / L, ny = dx / L; if (ny > 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }     // the normal that bows upward
  const b = arc * L * 4 * e * (1 - e);
  return { x: o.x + dx * e + nx * b, y: o.y + dy * e + ny * b, s: lerp(s0, 1, soft(q)), rot: bank * (1 - e), op: t < t0 ? 0 : whole ? 1 : clamp((t - t0 + 1) / 2.5), k };
}
// the layout box of grow's lead element born whole out of a box of another shape (qa1 M1: launch15's landscape result
// card → the fan's portrait hero jumped shape and crop on the cut): it starts with the source's aspect at its own area —
// × grow's s0 that is the source's box exactly, and a cover-cropped picture shows the source's crop — then eases to its
// own w × h on out(3) over len frames (the picture re-crops as the box changes shape; soft's first step was a third of the
// way on the cut frame, out(3)'s is a sixth). Returns {w, h} (exactly w, h once
// done), or null when grow doesn't take the source whole or the shapes are within 5 %. Draw the element centred on its
// place with that width and height (layout, not scale), the grow's transform unchanged
export function reshape(o, w, h, t, { t0 = 0, len = 9, lead = false } = {}) {
  if (!lead || !o || !o.w || !o.h || !w || !h || clamp(Math.sqrt((o.w * o.h) / (w * h)), .06, 3) <= .3) return null;
  const a0 = Math.log((o.w / o.h) / (w / h));
  if (Math.abs(a0) < Math.log(1.05)) return null;
  const q = clamp((t - t0) / len);
  if (q >= 1) return { w, h };
  const a = Math.exp(a0 * (1 - outCubic(q)));        // the box's aspect over the element's own
  return { w: w * Math.sqrt(a), h: h / Math.sqrt(a) };
}
// a stagger for grow: element i of n leaves `step` frames after the previous one, the whole spread capped at `span`
export const growAt = (i, n, step = 3, span = 18) => n > 1 ? Math.min(step * i, span * i / (n - 1)) : 0;
// a carry's window in 30-fps frames around the cut: the element leaves at cut − pre − ½ and lands at cut + post (Node's
// timeline checks and the stage use the same numbers). morph to: frame fills the frame on the cut, then fades over post
export function carryPlan(c) {
  const morph = String(c.mode) === 'morph', frame = morph && c.to === 'frame', needle = !morph && String(c.ease) === 'needle';
  return { morph, frame, needle, pre: Number(c.pre ?? (frame ? 14 : morph ? 11 : needle ? 6 : 8)), post: Number(c.post ?? (frame ? 3 : morph ? 11 : needle ? 6 : 14)),
    lift: Number(c.lift ?? (morph || needle ? 1 : 1.08)), arc: Number(c.arc ?? .1), el: String(c.el), to: c.to == null ? String(c.el) : String(c.to) };
}
// a shot's `from:` as an origin (grow from a point) — only for blocks that declare origin: true; float keeps its own
// from: left | right (the side it flies in from)
export function originOf(s, blk) {
  if (!blk || !blk.origin || s.from == null) return null;
  if (s.block === 'float' && ['left', 'right'].includes(String(s.from))) return null;
  return s.from;
}
