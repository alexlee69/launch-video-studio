// Motion-kit helpers (round 1), shared by press · fan · particles · map and the new modes of wall (grid), type (word
// beats) and stack (exploded). Planning helpers are pure JS (cues()/hero()/validate() run them in Node); render helpers
// take the engine's K from ctx or import nothing. Nothing touches the DOM at import time.
//
// The motion grammar they encode (measured on four launch reels + the motion handbook): moves ≈ 0.4 s; entrances
// 0.4–0.6 s on expo-out from scale .96 and 8 px blur; exits 50–100 ms shorter; cascades stagger 2–4 frames; overshoot
// (≤ 10 %) only on chips, pills and pins — never on a headline, logo or hero; nothing important arrives by opacity alone.
export const M = {
  clamp: (x, a = 0, b = 1) => x < a ? a : x > b ? b : x,
  lerp: (a, b, t) => a + (b - a) * t,
  u01(f, a, b) { const x = (f - a) / (b - a); return x < 0 ? 0 : x > 1 ? 1 : x; },
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inCubic: t => t * t * t,
  // smootherstep: a move whose speed is bell-shaped (slow out, fastest mid-way, soft landing) — cursor travel
  bell(u) { u = u < 0 ? 0 : u > 1 ? 1 : u; return u * u * u * (u * (u * 6 - 15) + 10); },
  // overshoot that peaks at about `peak` (.06 = 6 %) above 1 — chips, pills, pins only
  pop(u, peak = .07) {
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const c = M.backC(peak);
    return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2);
  },
  // outBack's c for a given peak overshoot p: the peak is 4c³ / (27 (c + 1)²) (c = 1.70158 → 10 %), solved by bisection
  backC(p) {
    if (!(p > 0)) return 0;
    if (M._bc[p] != null) return M._bc[p];
    let lo = 0, hi = 6;
    for (let i = 0; i < 40; i++) { const c = (lo + hi) / 2; if (4 * c * c * c / (27 * (c + 1) * (c + 1)) < p) lo = c; else hi = c; }
    return (M._bc[p] = (lo + hi) / 2);
  },
  _bc: {},
  // the house entrance at local frame t: k = progress, s = scale (.96 → 1), blur px (8 → 0, × u), o = opacity (a fast
  // ramp in the first third — it is carried by the scale/blur/rise, never by opacity alone)
  enter(t, t0, len = 15, u = 1) {
    const k = M.outExpo(M.u01(t, t0, t0 + len));
    return { k, s: .96 + .04 * k, blur: 8 * u * (1 - k), o: M.clamp(M.u01(t, t0, t0 + len * .3)) };
  },
  // a point on a quadratic arc from a to b whose control point sits `bend` × the chord off the midpoint (left of the
  // travel for bend > 0)
  arc(a, b, bend, u) {
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1];
    const cx = mx - dy * bend, cy = my + dx * bend, v = 1 - u;
    return [v * v * a[0] + 2 * v * u * cx + u * u * b[0], v * v * a[1] + 2 * v * u * cy + u * u * b[1]];
  },
  hash(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; },
  rng(seed) { let s = seed | 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; },
  // the big pointer (redrawn from the UI kit's arrow): returns {html, w, h, tx, ty} — tx/ty = the arrow tip inside the box
  cursor(size, { fill = '#0B0B0E', stroke = '#FFFFFF' } = {}) {
    const h = size, w = size * 32 / 39, tx = w * 3.5 / 32, ty = h * 2.5 / 39;
    return { w, h, tx, ty, html: `<svg width="${w.toFixed(2)}" height="${h.toFixed(2)}" viewBox="0 0 32 39" style="display:block;overflow:visible"><path d="M3.5 2.5V30.6L9.9 24.6L14.6 35.4L19.6 33.3L14.9 22.7H23.8Z" fill="${fill}" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round" paint-order="stroke"/></svg>` };
  },
  // rgb helpers
  rgbOf(c) { const s = String(c); if (/^#[0-9a-f]{6}$/i.test(s)) return [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)); const m = s.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : [0, 0, 0]; },
  rgba(c, a) { const [r, g, b] = M.rgbOf(c); return `rgba(${r},${g},${b},${(+a).toFixed(3)})`; },
  mix(c1, c2, k) { const a = M.rgbOf(c1), b = M.rgbOf(c2); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join(''); },
  // a chip's pop by layout, not by transform: CSS zoom k on the chip's inner box about the point (ox, oy) (fractions of
  // its w × h box). Small text under a transform that is not exactly none renders differently depending on the frames
  // drawn before it; zoom re-lays the chip out at its size on every frame, so a frame renders the same whatever came
  // before. The box must be position: relative inside an unzoomed wrapper (its own left/top are zoomed with it)
  zoomAt(el, k, ox, oy, w, h) {
    if (k === 1) { el.style.zoom = ''; el.style.left = '0px'; el.style.top = '0px'; return; }
    const z = Math.max(.02, k);
    el.style.zoom = z.toFixed(4);
    el.style.left = (ox * w * (1 - z) / z).toFixed(3) + 'px'; el.style.top = (oy * h * (1 - z) / z).toFixed(3) + 'px';
  },
  // a list field that may be a list or one value
  list: v => v == null ? [] : [].concat(v),
  // footage path test (images or clips)
  isVideo: p => /\.(mp4|mov|m4v|webm|mkv)$/i.test(String(p || '')),
  // perspective projection of a point given in a 3D-transformed element's own box (CSS semantics): M = the element's
  // transform as a DOMMatrix (browser only), origin = its transform-origin, box = its left/top in the perspective
  // container, persp = {d, ox, oy}. Returns stage px inside the container.
  project(DOMMatrixCtor, css, box, origin, q, persp) {
    const m = new DOMMatrixCtor().translate(box.x + origin.x, box.y + origin.y).multiply(new DOMMatrixCtor(css)).translate(-origin.x, -origin.y);
    const p = m.transformPoint({ x: q[0], y: q[1], z: 0, w: 1 });
    const k = persp.d / Math.max(1, persp.d - p.z);
    return [persp.ox + (p.x - persp.ox) * k, persp.oy + (p.y - persp.oy) * k, p.z];
  },
};
