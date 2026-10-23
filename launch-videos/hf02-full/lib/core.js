'use strict';
// Shared helpers and the scene registry for the full-length motion study.
// Space: every scene is laid out in the reference's 1080×608 frame (rendered at 1920×1080). Time: n = reference frame, 30 fps.

// ───────────────────────────── maths ─────────────────────────────
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
const easeOut5 = t => 1 - Math.pow(1 - clamp(t), 5);
const easeIn = t => Math.pow(clamp(t), 3);
const easeInOut = t => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
// piecewise-linear lookup in a {frame: value} table; held flat outside its range
function trk(tab, n) {
  let ks = tab.__k;
  if (!ks) { ks = Object.keys(tab).map(Number).sort((a, b) => a - b); Object.defineProperty(tab, '__k', { value: ks }); }
  if (n <= ks[0]) return tab[ks[0]];
  if (n >= ks[ks.length - 1]) return tab[ks[ks.length - 1]];
  let lo = 0, hi = ks.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ks[m] <= n) lo = m; else hi = m; }
  const a = ks[lo], b = ks[hi]; return lerp(tab[a], tab[b], (n - a) / (b - a));
}
const vel = (tab, n) => (trk(tab, n + 0.5) - trk(tab, n - 0.5));   // units per frame
// motion blur of a moving element: σ ≈ 0.2 × speed (px/frame) along its direction of travel (measured on the reference)
const mbs = v => Math.abs(v) * 0.2;

// ───────────────────────────── colour ─────────────────────────────
function hexToRgb(h) { const v = parseInt(h.slice(1), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; }
function mix(h1, h2, t) { const a = hexToRgb(h1), b = hexToRgb(h2); return `rgb(${a.map((x, i) => Math.round(lerp(x, b[i], clamp(t)))).join(',')})`; }
function mixHex(h1, h2, t) { const a = hexToRgb(h1), b = hexToRgb(h2); return '#' + a.map((x, i) => Math.round(lerp(x, b[i], clamp(t))).toString(16).padStart(2, '0')).join(''); }

// ───────────────────────────── DOM ─────────────────────────────
function el(parent, cls, css = {}, html = '') {
  const e = document.createElement('div'); if (cls) e.className = cls; Object.assign(e.style, css); if (html) e.innerHTML = html; parent.appendChild(e); return e;
}
// single-line text whose baseline sits at `base` (Inter: baseline 0.86em into a line-height:1 box)
function text(parent, s, { x, base, size, weight = 400, color = '#000', ls = -0.01, align = 'left' }) {
  const e = el(parent, 't', { left: x + 'px', top: (base - 0.86 * size) + 'px', font: `${weight} ${size}px/1 Inter`, color, letterSpacing: ls + 'em' }, s);
  if (align === 'right') e.style.translate = '-100% 0';
  else if (align === 'center') e.style.translate = '-50% 0';
  return e;
}
// multi-line text block: first baseline at `base`, line pitch `lh`
function para(parent, lines, { x, base, size, lh, weight = 400, color = '#000', ls = -0.01 }) {
  const e = el(parent, 'ml', { left: x + 'px', top: (base - lh / 2 - 0.36 * size) + 'px', font: `${weight} ${size}px/${lh}px Inter`, color, letterSpacing: ls + 'em' },
    lines.join('<br>'));
  return e;
}
// text split into per-character spans (for type-on / streaming); returns {node, chars}
function charText(parent, s, opts) {
  const t = text(parent, '', opts); const chars = [];
  for (const ch of s) { const sp = document.createElement('span'); sp.textContent = ch; sp.style.opacity = 0; t.appendChild(sp); chars.push(sp); }
  return { node: t, chars };
}
// streaming: p in 0..1 over all chars, with a soft tail of `tail` characters (measured ~9 on the reference)
function stream(chars, p, tail = 9) {
  const head = p * (chars.length + tail);
  for (let i = 0; i < chars.length; i++) chars[i].style.opacity = clamp((head - i) / tail).toFixed(3);
}
// hard type-on (a caret-style reveal, no tail): k characters visible
function typeOn(chars, k) { for (let i = 0; i < chars.length; i++) chars[i].style.opacity = i < k ? 1 : 0; }

// SVG blur filters, one per element so every element can carry its own (x, y) sigma
let fxN = 0;
function blurrable(node, margin = '-60%', size = '220%') {
  const id = 'fb' + (fxN++);
  document.getElementById('fx').insertAdjacentHTML('beforeend',
    `<filter id="${id}" x="${margin}" y="${margin}" width="${size}" height="${size}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0 0"/></filter>`);
  const g = document.getElementById(id).firstChild;
  node._blur = (sx, sy = sx) => {
    sx = Math.max(0, sx || 0); sy = Math.max(0, sy || 0);
    if (sx < 0.08 && sy < 0.08) { node.style.filter = 'none'; return; }
    g.setAttribute('stdDeviation', `${sx.toFixed(2)} ${sy.toFixed(2)}`); node.style.filter = `url(#${id})`;
  };
  return node;
}
// soft left→right wipe: p in 0..1, edge = soft width as a fraction of the element
function wipe(node, p, edge = 0.35, dir = 90) {
  if (p >= 1) { node.style.webkitMaskImage = 'none'; node.style.maskImage = 'none'; return; }
  const a = (p * (1 + edge) - edge) * 100, b = p * (1 + edge) * 100;
  const m = `linear-gradient(${dir}deg, #000 ${a.toFixed(2)}%, transparent ${b.toFixed(2)}%)`;
  node.style.webkitMaskImage = m; node.style.maskImage = m;
}
// pop-in scale with a small overshoot: p 0..1 over the pop
const popScale = (p, over = 0.08) => p <= 0 ? 0 : 0.3 + 0.7 * easeOut(p) + over * Math.sin(Math.PI * clamp(p));

// ───────────────────────────── UI pieces ─────────────────────────────
function check(parent, x, y, w, color) {
  return el(parent, 'abs', { left: x + 'px', top: y + 'px', width: w + 'px', height: w * 0.8 + 'px' },
    `<svg viewBox="0 0 13 11" width="100%" height="100%"><path d="M1.2 6.2 L4.8 9.6 L11.8 1.4" fill="none" stroke="${color}" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
}
function searchIcon(parent, x, y, s, color, sw) {
  return el(parent, 'abs', { left: x + 'px', top: y + 'px', width: s + 'px', height: s + 'px' },
    `<svg viewBox="0 0 24 24" width="100%" height="100%"><circle cx="10.2" cy="10.2" r="7" fill="none" stroke="${color}" stroke-width="${sw}"/><path d="M15.4 15.4 L21.2 21.2" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/></svg>`);
}
// name ✓ status on one baseline; returns {nm, chk, st} (status is wipe-maskable)
function agentLine(parent, { x, base, nameSize, statusSize, statusBase, gap1, chkW, gap2, name, status, nameColor = '#0E0D11', green = '#5B9488', dot = false }) {
  const nm = text(parent, name, { x, base, size: nameSize, weight: 600, color: nameColor });
  const w = nm.getBoundingClientRect().width;
  let chk;
  if (dot) chk = el(parent, 'abs', { left: (x + w + gap1) + 'px', top: (base - nameSize * 0.36 - chkW * 0.25) + 'px', width: chkW * 0.5 + 'px', height: chkW * 0.5 + 'px', borderRadius: '50%', background: '#B8B6BD' });
  else chk = check(parent, x + w + gap1, base - chkW * 0.8 - nameSize * 0.02, chkW, green);
  const st = text(parent, status, { x: x + w + gap1 + chkW + gap2, base: statusBase ?? base, size: statusSize, color: green });
  return { nm, chk, st };
}

// ───────────────────────────── scenes ─────────────────────────────
// scene({ id, from, to, z, build(S), seek(n, S) }): visible for from <= n <= to (inclusive, fractional allowed).
// S.root  — the scene layer, padded 200 px past the frame on every side so a blurred or zoomed scene never shows an edge
// S.cam   — origin at the frame's top-left; put the scene's layout in here and move the camera with S.camera()
// S.blur(sx, sy) — whole-scene motion blur;  S.op(v) — whole-scene opacity
const SCENES = [];
function scene(def) { SCENES.push(def); return def; }
const FRAME_W = 1080, FRAME_H = 608;
function mountScenes() {
  const stage = document.getElementById('stage');
  SCENES.sort((a, b) => (a.z || 0) - (b.z || 0));
  for (const d of SCENES) {
    const root = el(stage, 'scene'); root.dataset.scene = d.id;
    const cam = el(root, 'cam');
    const S = d.S = { root, cam, def: d };
    blurrable(root, '-2%', '104%');
    S.blur = (sx, sy = sx) => root._blur(sx, sy);
    S.op = v => { root.style.opacity = v; };
    // camera: translate by (tx, ty) frame px, scale s about frame point (ox, oy), rotate r degrees
    S.camera = (tx = 0, ty = 0, s = 1, ox = FRAME_W / 2, oy = FRAME_H / 2, r = 0) => {
      cam.style.transformOrigin = `${ox}px ${oy}px`;
      cam.style.transform = `translate(${(+tx).toFixed(3)}px, ${(+ty).toFixed(3)}px) scale(${(+s).toFixed(5)})` + (r ? ` rotate(${r.toFixed(3)}deg)` : '');
    };
    root.style.display = 'none';
    d.build(S);
  }
}
async function seek(n) {
  const work = [];
  for (const d of SCENES) {
    const on = n >= d.from && n <= d.to;
    d.S.root.style.display = on ? 'block' : 'none';
    if (on) { const r = d.seek(n, d.S); if (r && r.then) work.push(r); }
  }
  if (work.length) await Promise.all(work);
}

// ───────────────────────────── footage slots ─────────────────────────────
// A plate is either an original stand-in (built by the scene) or the user's clip/still from STORY.footage[key].
// Video plates are seeked to the frame's time (offset in seconds) and awaited, so renders stay frame-exact.
function footagePlate(parent, key, { w = FRAME_W, h = FRAME_H, fit = 'cover' } = {}) {
  const src = (window.STORY && STORY.footage && STORY.footage[key]) || null;
  if (!src) return null;
  const isVid = /\.(mp4|mov|webm|m4v)$/i.test(src);
  const node = document.createElement(isVid ? 'video' : 'img');
  Object.assign(node.style, { position: 'absolute', left: 0, top: 0, width: w + 'px', height: h + 'px', objectFit: fit });
  node.src = src; if (isVid) { node.muted = true; node.preload = 'auto'; }
  parent.appendChild(node);
  node._seekTo = t => new Promise(res => {
    if (!isVid) return res();
    const target = Math.max(0, Math.min(t, (node.duration || 1e9) - 0.001));
    if (Math.abs(node.currentTime - target) < 1e-4 && node.readyState >= 2) return res();
    node.addEventListener('seeked', () => res(), { once: true }); node.currentTime = target;
  });
  return node;
}

Object.assign(window, { clamp, lerp, easeOut, easeOut5, easeIn, easeInOut, smooth, trk, vel, mbs, hexToRgb, mix, mixHex, el, text, para,
  charText, stream, typeOn, blurrable, wipe, popScale, check, searchIcon, agentLine, scene, SCENES, mountScenes, seek, footagePlate, FRAME_W, FRAME_H });
