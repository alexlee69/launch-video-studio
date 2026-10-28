// Stage runtime: builds every shot of a compiled timeline and renders any frame as a pure function of f.
// f is in 30-fps units (half frames allowed). The renderer injects window.__LV__ = {timeline, aspect} before load;
// without it, ?tl=<url>&aspect=16x9 fetches the timeline (used by the scrub preview).
import * as K from './kit.js';
import * as A from './art.js';
import { BLOCKS } from './blocks/index.js';

const SIZES = { '16x9': [1920, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080] };
const $ = (sel, root = document) => root.querySelector(sel);
const jobURL = p => '/job/' + String(p).split(/[\\/]/).map(encodeURIComponent).join('/');   // job asset path → URL (spaces, #, ?, % safe)

// ── directional blur (SVG feGaussianBlur with separate x/y) ──
const FX = {};
function dblur(id, sx, sy) {
  if (sx < .05 && sy < .05) return '';
  if (!FX[id]) {
    const ns = 'http://www.w3.org/2000/svg', fl = document.createElementNS(ns, 'filter');
    for (const [k, v] of [['id', id], ['filterUnits', 'userSpaceOnUse'], ['x', -1200], ['y', -1200], ['width', 4400], ['height', 4400], ['color-interpolation-filters', 'sRGB']]) fl.setAttribute(k, v);
    const g = document.createElementNS(ns, 'feGaussianBlur'); fl.appendChild(g); $('#lv-fx defs').appendChild(fl); FX[id] = g;
  }
  FX[id].setAttribute('stdDeviation', `${sx.toFixed(3)} ${sy.toFixed(3)}`);
  return `url(#${id})`;
}
const blurCss = px => px > .05 ? `blur(${px.toFixed(3)}px)` : '';
const filt = (...p) => p.filter(Boolean).join(' ') || 'none';

// ── camera: every shot enters already moving and leaves on an accelerating move ──
// exit = the shot's own `out` transition (reached over its last 7 frames, 12 for a drift); enter = continues the previous
// shot's exit. Drift cuts (momentum cuts, measured on a launch film): an expo-in exit of 5 % of the width / 10 % of the
// height whose speed builds ×1.4 a frame up to the cut, and an entrance of 10 % of the width / 8.5 % of the height
// decaying ×0.65 per frame; a shot that keeps drifting after the cut does so through its own camera fields (`move:`,
// `pan:`), not a stronger entrance (every other entrance decays ×0.8)
function exitFor(type, W, H) {
  return ({ 'whip-left': { dx: -.5 * W }, 'whip-right': { dx: .5 * W }, 'whip-up': { dy: -.45 * H }, 'whip-down': { dy: .45 * H },
    'zoom-in': { s: .35 }, 'zoom-out': { s: -.3 }, blur: { blur: 10, s: .04 },
    glitch: { s: .03 }, 'smear-left': { dx: -.5 * W }, 'smear-right': { dx: .5 * W }, tunnel: { s: 1.4 }, flash: { s: .07 },
    'drift-left': { dx: -.05 * W }, 'drift-right': { dx: .05 * W }, 'drift-up': { dy: -.1 * H }, 'drift-down': { dy: .1 * H } })[type] || {};
}
function enterFor(prevOut, W, H, first) {
  if (first) return { s: -.06 };                     // opening: grows into the slow push (same direction, never cancels)
  return ({ 'whip-left': { dx: .36 * W }, 'whip-right': { dx: -.36 * W }, 'whip-up': { dy: .36 * H }, 'whip-down': { dy: -.36 * H },
    'zoom-in': { s: -.18 }, 'zoom-out': { s: .3 }, blur: { blur: 10, s: -.03 },
    // tunnel: the incoming shot starts small at the corridor's vanishing point (its frame = the opening) and flies up
    glitch: { s: -.03 }, 'smear-left': { dx: .36 * W }, 'smear-right': { dx: -.36 * W }, tunnel: { s: -.72 }, flash: { s: -.05 },
    'drift-left': { dx: .1 * W, decay: .65 }, 'drift-right': { dx: -.1 * W, decay: .65 }, 'drift-up': { dy: .085 * H, decay: .65 }, 'drift-down': { dy: -.085 * H, decay: .65 } })[prevOut] || { s: -.04 };
}
// a move's amplitudes × k (a shot's `drift: {in, out}` strength); the decay stays
const scaleMove = (m, k) => Object.fromEntries(Object.entries(m).map(([key, v]) => [key, key === 'decay' ? v : v * k]));
// camera fields on any shot, applied on top of the moves: `zoom` (base scale) about `focus: [x, y]` (fractions of the
// frame; that point stays put), `offset: [x, y]` (fractions of W / H) and `pan: [{at, by: [x, y], len}]` — each pan a
// tanh move of `by` centred on local frame `at` (its fastest frame), τ = len / 7.5 — and `move: [x, y]`, a constant
// drift (fractions of W / H per second) so a shot never holds still. Returns t → {x, y, z} or null.
// `move` is the camera's only as a list: a word (media's `move: left`, a custom block's own) stays the block's
const CAM_FIELDS = ['zoom', 'focus', 'offset', 'pan', 'move'];
const hasView = s => CAM_FIELDS.some(k => k === 'move' ? Array.isArray(s.move) : s[k] != null);
// any camera field may be given per aspect: `zoom: {16x9: 1.2, 9x16: 1}` (an aspect it leaves out gets no value)
const perAspect = v => v != null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).some(k => /^\d+x\d+$/.test(k)) ? v[ASPECT] : v;
const camFields = s => CAM_FIELDS.some(k => s[k] != null && typeof s[k] === 'object' && !Array.isArray(s[k]) && Object.keys(s[k]).some(a => /^\d+x\d+$/.test(a)))
  ? { ...s, ...Object.fromEntries(CAM_FIELDS.map(k => [k, perAspect(s[k])])) } : s;
function viewFor(s0, W, H) {
  const s = camFields(s0);
  if (!hasView(s)) return null;
  const z = s.zoom != null ? Number(s.zoom) : 1, f = s.focus || [.5, .5], o = s.offset || [0, 0];
  const pans = [].concat(s.pan || []).map(q => ({ at: K.frameAt(q.at) ?? 0, bx: Number((q.by || [])[0]) || 0, by: Number((q.by || [])[1]) || 0, tau: Math.max(.25, (K.frameAt(q.len) ?? 20) / 7.5) }));
  // fx, fy: the focus from the frame centre — cameraAt keeps it in place under the whole scale (zoom × push × moves)
  const fx = Number(f[0]) * W - W / 2, fy = Number(f[1]) * H - H / 2, x0 = (Number(o[0]) || 0) * W, y0 = (Number(o[1]) || 0) * H;
  const mv = Array.isArray(s.move) ? s.move : [0, 0], mx = (Number(mv[0]) || 0) * W / 30, my = (Number(mv[1]) || 0) * H / 30;
  return t => {
    let x = x0 + mx * t, y = y0 + my * t;
    for (const q of pans) { const k = (1 + Math.tanh((t - q.at) / q.tau)) / 2; x += q.bx * W * k; y += q.by * H * k; }
    return { x, y, z, fx, fy };
  };
}
// t = held shot time (entrance, push and camera fields freeze during a hold); tr = real shot time (the exit always lands
// on the cut)
function cameraAt(cam, t, D, tr = t, Db = D) {
  const e = { dx: 0, dy: 0, s: 0, blur: 0, ...cam.enter }, x = { dx: 0, dy: 0, s: 0, blur: 0, ...cam.exit };
  const ek = Math.pow(cam.enter.decay ?? .8, Math.max(0, t));
  const xu = cam.exitLen ? (tr - (D - cam.exitLen)) / cam.exitLen : 0;
  const xk = !cam.exitLen ? 0 : cam.expo ? K.expoIn(K.clamp(xu, 0, 1.08), K.DRIFT_BUILD) : K.inCubic(K.clamp(xu, 0, 1.08));
  const p = cam.push * K.clamp(t / Db, 0, 1.2);
  const c = { x: e.dx * ek + x.dx * xk, y: e.dy * ek + x.dy * xk, s: (1 + p) * (1 + e.s * ek) * (1 + x.s * xk), blur: e.blur * ek + x.blur * xk };
  if (cam.view) { const v = cam.view(t); c.s *= v.z; c.x += v.x + v.fx * (1 - c.s); c.y += v.y + v.fy * (1 - c.s); }
  return c;
}

let TL, W, H, ASPECT, stage, shots = [], current = null, PLATES = {}, ALPHA = false, CLEAN = false, BG_ONLY = false, CAM = { blur: 0 };
let LAYER = null, OVL = null, LBOX = null;      // current --layers layer; the stage-level transition overlay and cinema bars
const isVideo = p => /\.(mp4|mov|m4v|webm|mkv)$/i.test(p || '');
const bgOf = s => s.bg != null && s.bg !== false && String(s.bg).trim() && String(s.bg).toLowerCase() !== 'none' ? String(s.bg) : null;
// footage plates: lv.mjs extracts every footage field into 60-fps JPEGs (PNGs for a clip with transparency: ext) keyed
// `${id}` (media.src), `${id}:bg` (the universal bg), `${id}:${field}` / `${id}:${field}.${i}` (a block's declared
// `media:` fields; a custom block's own `src` field is `${id}:src` like any other, as timeline.mjs platePlan keys it)
const plateKey = (s, field, i = null) => field === 'src' && s.block === 'media' ? s.id : `${s.id}:${field}${i == null ? '' : '.' + i}`;
const plateURL = (p, i) => `${p.url}/${String(i).padStart(5, '0')}.${p.ext || 'jpg'}`;

// ── layers: every element a block creates belongs to a named layer (data-lv-layer on it or on its nearest tagged
// ancestor; untagged elements fall back to `content`). Layer mode hides every other layer by *visibility* — layout,
// transforms, clipping and the camera stay exactly as in the full render — so the layer exports restack to the clip.
// The engine's own layers sit outside the content: `footage` (a shot's universal bg, inside the camera), `transition`
// (the cross-cut overlay, stage level) and `letterbox` (the bars, fixed to the frame) — a block can't use those names
// in a shot that has them.
const LAYER_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
function tagLayer(el, name, taken = null) {
  if (!LAYER_RE.test(String(name)) || name === 'background' || name === 'constructor') throw new Error(`layer name "${name}" must be lower-case letters, digits or - (it names a file; "background" and "constructor" are reserved)`);
  if (taken && taken.has(name)) throw new Error(`layer name "${name}" is the engine's own layer in this shot (its ${name === 'footage' ? 'bg footage' : name === 'letterbox' ? 'cinema bars' : 'transition overlay'}) — name the block's element something else`);
  el.dataset.lvLayer = name;
  return el;
}
let LAYER_CSS = null;
function setLayer(name) {
  LAYER_CSS ||= document.head.appendChild(document.createElement('style'));
  const q = name == null ? null : CSS.escape(String(name));
  LAYER_CSS.textContent = q == null ? '' : `.lv-content[data-lv-layer], .lv-content [data-lv-layer] { visibility: hidden; }
    .lv-content[data-lv-layer="${q}"], .lv-content [data-lv-layer="${q}"] { visibility: visible; }`;
  LAYER = name == null ? null : String(name);
  engineVis();
}
// what the engine's own layers show in this pass: bg footage is left out of transparent renders (like the brand
// background) unless its own layer is being drawn, and out of every background-only render — footage is picture
// content (the user's AI footage), so the QA reference is what the frame shows without it and without the block;
// bgOnly 'brand' (the --layers background pass) is the brand background alone; a layer pass shows only its layer.
// Inline visibility, so nothing else about the page changes.
function engineVis() {
  const vis = (el, show) => { if (el) el.style.visibility = show ? '' : 'hidden'; };
  const solo = name => LAYER == null || LAYER === name;
  for (const sh of shots) vis(sh.foot && sh.foot.el, !BG_ONLY && (LAYER == null ? !ALPHA : LAYER === 'footage'));
  vis(OVL, BG_ONLY !== 'brand' && solo('transition'));
  vis(LBOX, BG_ONLY !== 'brand' && solo('letterbox'));
}
// background-only renders: true = what a frame shows with neither block content nor footage — the brand background (the
// plain underlay under a bg shot) with the camera, letterbox bars and any transition overlay — the film / clip QA's
// content reference; 'brand' = the brand background alone (--layers 00-background, under the footage layer)
function setBgOnly(x) {
  BG_ONLY = x === 'brand' ? 'brand' : !!x;
  for (const c of document.querySelectorAll('.lv-content')) c.style.visibility = BG_ONLY ? 'hidden' : '';
  engineVis();
}
// does this element put pixels on screen by itself (not counting its children)?
function paints(el) {
  if (el instanceof SVGElement || /^(IMG|CANVAS|VIDEO|IFRAME|INPUT)$/.test(el.tagName)) return true;
  for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true;
  const cs = getComputedStyle(el), clear = c => !c || c === 'transparent' || /^rgba\(.*,\s*0\)$/.test(c);
  return !clear(cs.backgroundColor) || cs.backgroundImage !== 'none' || cs.boxShadow !== 'none' || (cs.webkitMaskImage || 'none') !== 'none'
    || ['Top', 'Right', 'Bottom', 'Left'].some(k => parseFloat(cs[`border${k}Width`]) > 0 && cs[`border${k}Style`] !== 'none' && !clear(cs[`border${k}Color`]))
    || (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0);
}
// a shot's layers back to front (tree order = paint order for these absolutely positioned elements). Per layer:
// roots = separately tagged elements, text = every root is a ctx.text() box (a live-text candidate for After Effects).
// elements = how many separate things paint: a tagged element or a ctx.text box counts once, otherwise the top-most
// painting nodes at any depth (an unpainted wrapper counts its painting children) — 1 = a single-element shot.
function layerList(content) {
  const order = [], info = Object.create(null);
  const eff = el => { for (let n = el; n && n !== content; n = n.parentElement) if (n.dataset && n.dataset.lvLayer) return n.dataset.lvLayer; return 'content'; };
  const add = name => { if (!info[name]) { info[name] = { name, roots: 0, text: name !== 'content' }; order.push(name); } return info[name]; };
  for (const el of content.querySelectorAll('*')) {
    const own = el.dataset && el.dataset.lvLayer;
    if (own) {
      const L = add(own);
      if (eff(el.parentElement) !== own) { L.roots++; if (!(el.classList.contains('lv-txt') && el.querySelector('.lv-w'))) L.text = false; }
    } else if (eff(el) === 'content' && paints(el)) add('content');
  }
  const draws = el => el.classList.contains('lv-txt') || paints(el);
  let elements = 0;
  const walk = el => { for (const ch of el.children) { if (ch.dataset.lvLayer || draws(ch)) elements++; else walk(ch); } };
  walk(content);
  return { layers: order.map(n => info[n]), elements };
}
// live-text samples for every word of the current shot's text layers: its baseline origin in stage px, scale and
// effective opacity now, plus (once per word) the copy and type style. The renderer calls it after a frame's screenshot.
const BASE = new WeakMap();
function textProbe() {
  if (!current) return null;
  const sr = stage.getBoundingClientRect(), out = {};
  for (const L of current.layers.layers.filter(l => l.text)) {
    const roots = [...current.ctx.root.querySelectorAll(`[data-lv-layer="${CSS.escape(L.name)}"]`)].filter(e => e.classList.contains('lv-txt'));
    out[L.name] = roots.flatMap(r => [...r.querySelectorAll('.lv-w')]).map(w => {
      // scale = drawn width / laid-out width (computed style keeps the fraction; offsetWidth would round it); the text
      // colour's own alpha (dark-theme muted text is rgba) goes into the opacity, since the live text is filled opaque
      const r = w.getBoundingClientRect(), lw = parseFloat(getComputedStyle(w).width), s = lw ? r.width / lw : 1;
      let o = 1; for (let n = w; n && n !== stage; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity);
      const ca = getComputedStyle(w).color.match(/rgba\([^)]*,\s*([\d.]+)\)/); if (ca) o *= Number(ca[1]);
      let b = BASE.get(w);
      if (!b) {          // a zero-size inline-block at the baseline marks the glyph origin (removed again at once)
        const m = document.createElement('i'); m.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
        w.prepend(m); const mr = m.getBoundingClientRect(); m.remove();
        const cs = getComputedStyle(w), fs = parseFloat(cs.fontSize);
        b = { dx: (mr.left - r.left) / s, dy: (mr.top - r.top) / s, style: { text: cs.textTransform === 'uppercase' ? w.textContent.toUpperCase() : w.textContent,
          size: fs, weight: Number(cs.fontWeight), family: cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim(), color: cs.color,
          tracking: cs.letterSpacing === 'normal' ? 0 : Math.round(parseFloat(cs.letterSpacing) / fs * 1000) } };
        BASE.set(w, b);
      }
      return { x: +(r.left - sr.left + b.dx * s).toFixed(3), y: +(r.top - sr.top + b.dy * s).toFixed(3), s: +s.toFixed(5), o: +o.toFixed(4), style: b.style };
    });
  }
  return out;
}

function loadFonts(brand) {
  const css = [], inter = '/skill/node_modules/@fontsource/inter/files/inter-latin-';
  for (const w of [400, 500, 600, 700]) css.push(`@font-face{font-family:Inter;font-weight:${w};src:url(${inter}${w}-normal.woff2) format('woff2');}`);
  const st = document.createElement('style'); st.textContent = css.join('\n'); document.head.appendChild(st);
  const bf = brand.font;
  // brand faces go through the FontFace API: a file the browser can't decode fails the render instead of quietly
  // falling back to Inter
  const faces = bf && bf.files ? Object.entries(bf.files).map(([w, f]) => new FontFace(bf.family, `url("${jobURL(f)}")`, { weight: String(w) }).load()
    .then(face => document.fonts.add(face), () => { throw new Error(`brand font ${bf.family} ${w}: ${f} could not be loaded — use a real .woff2 / .woff / .ttf / .otf file`); })) : [];
  const fam = bf && bf.files ? `'${bf.family}'` : 'Inter';
  return Promise.all(faces).then(() => Promise.all([400, 500, 600, 700].map(w => document.fonts.load(`${w} 40px Inter`).catch(() => null)))).then(() => document.fonts.ready).then(() => fam);
}

function makeCtx(shot, content, fam, dark = false, taken = null) {
  const b = TL.brand, u = Math.min(W, H) / 1080, portrait = H > W, square = W === H;
  // portrait = platform-UI-safe (feeds put buttons on the right and captions at the bottom); QA checks the same box
  // landscape/square leave ~2 % beyond QA's title-safe 5 % so the camera's slow push (≈3.5 %) never carries text past it
  const m = portrait ? { x0: .12 * W, y0: .12 * H, x1: .88 * W, y1: .78 * H } : { x0: .07 * W, y0: .09 * H, x1: .93 * W, y1: .91 * H };
  // cinema bars: text stays 4 % of the height inside the picture (the push can't carry it under a bar)
  const bar = K.letterboxBar(shot.letterbox, W, H);
  if (bar) { m.y0 = Math.max(m.y0, bar + .04 * H); m.y1 = Math.min(m.y1, H - bar - .04 * H); }
  const safe = { ...m, w: m.x1 - m.x0, h: m.y1 - m.y0 };
  // the picture box (inside the bars; the whole frame without letterbox) — lay out anything that must stay visible in it
  const picture = { x0: 0, y0: bar, x1: W, y1: bar ? H - bar : H, w: W, h: bar ? H - 2 * bar : H, bar };
  const C = dark ? { ...b.colors, ink: '#FFFFFF', muted: 'rgba(255,255,255,.62)', card: '#1C1C21', accent: b.colors.accentOnDark } : b.colors;
  // view: the part of the frame the camera's base framing shows (zoom about focus + offset, in stage px of the block's
  // own layout) — the whole frame without camera fields; a block can keep what matters inside it (agent's scroll)
  let view = { x0: 0, y0: 0, x1: W, y1: H };
  const cs = camFields(shot);
  if (hasView(cs)) {
    const z = cs.zoom != null ? Number(cs.zoom) : 1, f = cs.focus || [.5, .5], o = cs.offset || [0, 0];
    const tx = (Number(f[0]) * W - W / 2) * (1 - z) + (Number(o[0]) || 0) * W, ty = (Number(f[1]) * H - H / 2) * (1 - z) + (Number(o[1]) || 0) * H;
    view = { x0: W / 2 + (-W / 2 - tx) / z, x1: W / 2 + (W / 2 - tx) / z, y0: H / 2 + (-H / 2 - ty) / z, y1: H / 2 + (H / 2 - ty) / z };
  }
  const ctx = {
    K, A, W, H, u, portrait, square, aspect: ASPECT, safe, picture, shot, D: shot.Db ?? shot.D, brand: b, C, font: `${fam}, Inter, sans-serif`,
    // hasBg: the engine draws this shot's `bg` footage/image full-bleed behind the block (on the `footage` layer, left out
    // of --alpha renders); dark: the shot uses light-on-dark copy (theme: dark, or a bg shot without theme: light);
    // picture: the box inside letterbox bars ({x0, y0, x1, y1, w, h, bar}; the frame without bars) — safe is clipped to it
    hasBg: !!bgOf(shot), dark, view,
    root: content,
    el(html, style = '', layer = null) { const d = document.createElement('div'); d.className = 'lv-abs'; d.style.cssText = 'position:absolute;' + style; d.innerHTML = html; content.appendChild(d); return layer ? tagLayer(d, layer, taken) : d; },
    // put an element (and everything inside it that isn't tagged itself) on a named layer for --layers exports
    layer: (el, name) => tagLayer(el, name, taken),
    // copy with *accent* markup; returns a div with .lv-txt; words are wrapped for reveal() (a CJK word a span per piece,
    // K.wordPieces: it reveals a character at a time and wraps between them); o.layer names its layer
    text(copy, o = {}) {
      const d = document.createElement('div'); d.className = 'lv-txt' + (o.cls ? ' ' + o.cls : '');
      const size = (o.size || 84) * u;
      d.style.cssText = `position:absolute;font-family:${ctx.font};font-weight:${o.weight || 700};font-size:${size}px;line-height:${o.lh || 1.04};letter-spacing:${o.ls ?? '-.035em'};
        color:${o.color || C.ink};text-align:${o.align || 'left'};white-space:${o.nowrap ? 'nowrap' : 'normal'};${o.maxW ? `width:${o.maxW}px;` : ''}${o.style || ''}`;
      d.dataset.size0 = size.toFixed(1);
      const st = { q: 0 };       // K.wordPieces: a straight " opens and closes in turn through the copy
      d.innerHTML = K.parseCopy(copy).map(p => p.br ? '<br>' : p.text.split(/(\s+)/).map(w => /^\s+$/.test(w) ? w : K.wordPieces(w, st).map(c => `<span class="lv-w" style="display:inline-block;${p.accent ? `color:${o.accent || C.accent}` : ''}">${A.esc(c)}</span>`).join('')).join('')).join('');
      if (o.layer) tagLayer(d, o.layer, taken);
      (o.parent || content).appendChild(d);
      if (o.maxW) ctx.fit(d, { maxW: o.maxW, lines: o.lines || 2, min: (o.min || 36) * u });
      return d;
    },
    // shrink font-size until the box fits maxW (no word overflow) and the line count is ≤ lines
    fit(d, { maxW, lines = 2, min = 28 }) {
      let fs = parseFloat(d.style.fontSize);
      const lh = parseFloat(d.style.lineHeight) || 1.04;
      for (let i = 0; i < 40; i++) {
        const tooWide = d.scrollWidth > maxW + 1 || [...d.querySelectorAll('.lv-w')].some(w => w.offsetWidth > maxW + 1);
        const tooTall = d.offsetHeight > fs * lh * lines + 2;
        if ((!tooWide && !tooTall) || fs <= min) break;
        fs = Math.max(min, fs * .95); d.style.fontSize = fs + 'px';
      }
      d.dataset.fit = fs.toFixed(1);
      return fs;
    },
    // staggered word rise: call each frame; start/per in local frames
    reveal(d, t, start = 0, per = 2.2, rise = 34) {
      const ws = d.querySelectorAll('.lv-w'), plan = K.revealPlan(ws.length, shot.Db ?? shot.D, start, per);   // compresses in short shots
      ws.forEach((w, i) => {
        const k = K.outExpo(K.u01(t, start + i * plan.per, start + i * plan.per + 14));
        w.style.opacity = K.clamp(k * 1.4); w.style.transform = `translateY(${((1 - k) * rise * u).toFixed(2)}px)`;
      });
    },
    logo(size, onDark = false) {
      if (b.logo) {
        const tint = onDark ? (b.logoTintDark || null) : (b.logoTint || null);
        return tint ? `<div style="width:${size}px;height:${size}px;background:${tint};-webkit-mask:url("${jobURL(b.logo)}") center/contain no-repeat;mask:url("${jobURL(b.logo)}") center/contain no-repeat"></div>`
          : `<img src="${jobURL(b.logo)}" style="display:block;width:${size}px;height:${size}px;object-fit:contain">`;
      }
      // onDark=false means a light surface (a light shot, or a UI card inside a dark shot): always the light palette
      return b.mark === 'bubble' ? A.bubbleMark(size, onDark ? '#fff' : b.colors.ink) : A.monogram(b.mono, size, onDark ? (b.colors.accentOnDark || b.colors.accent) : b.colors.accent, '#fff', ctx.font);
    },
    cast(i) { const c = (b.cast && b.cast.length ? b.cast : A.CAST)[i % (b.cast && b.cast.length ? b.cast.length : A.CAST.length)]; return c.src ? { src: jobURL(c.src) } : c; },
    plates: Object.fromEntries(Object.entries(PLATES).map(([id, p]) => [id, { n: p.n, url: i => plateURL(p, i) }])),
    // this shot's footage frames for a field the block declares in `media:` (i = list index), or null (not footage)
    plate: (field, i = null) => ctx.plates[plateKey(shot, field, i)] || null,
    // an <img> for a declared media field (image asset or footage); `await m.frame(t)` in render swaps footage frames
    footage(field, { i = null, css = '' } = {}) {
      const src = i == null ? shot[field] : [].concat(shot[field])[i];
      const img = document.createElement('img');
      img.style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;display:block;${css}`;
      const video = isVideo(src), p = video ? ctx.plate(field, i) : null;
      if (video && !p) throw new Error(`${shot.block} ${shot.id}: ${field}${i == null ? '' : `[${i}]`} is footage (${src}) but no frames were extracted — declare the field in the block's media: list`);
      img.src = video ? p.url(0) : jobURL(src);
      let last = img.src;
      return { img, video, plate: p, ready: () => img.decode().catch(() => null),
        async frame(t) {
          if (video) { const want = p.url(Math.min(p.n - 1, Math.max(0, Math.round(t * 2)))); if (want !== last) { img.src = want; last = want; await img.decode().catch(() => null); } }
          else if (!img.complete) await img.decode().catch(() => null);
        } };
    },
    asset: p => jobURL(p),
  };
  return ctx;
}

// ── universal footage background: `bg` (image or footage), `bgFrom`, `bgDim`, `bgMove` on any shot. Full-bleed inside
// the camera (it moves with the push and every whip/zoom) and replaces the brand background for that shot (a plain
// underlay stays under it as the --layers background). The plate is mirror-extended one frame on every side (8 flipped
// copies of the same frame, like an editor's "mirror edges"), so a whip or zoom-out shows more picture, not a hard edge.
// Compositing-safe: the element is clipped each frame to what the camera can see (as the content is), and there is no
// CSS transform inside it — the nine tiles are <image>s of ONE inline SVG, flipped and Ken-Burns-moved by SVG transform
// attributes (painted as part of the SVG); each footage frame is decoded off-DOM first, so the swap is synchronous.
// Its scrim is part of the footage layer. bgDefaults: the block's own defaults for bgDim / bgMove (bgFrom: at extraction).
// bgMotion: a block's own move on top of the Ken Burns — block.bgMotion(ctx, shot) → null or (t, D) → {x, y, s} (px, px,
// extra scale; a pure function of t), e.g. a sticker's impact shake or a zoom-through pushing the footage with it.
async function buildFoot(s, dark, defs = {}) {
  const src = bgOf(s), video = isVideo(src), plate = video ? PLATES[plateKey(s, 'bg')] : null;
  if (video && !plate) throw new Error(`shot ${s.id}: bg footage frames missing (run lv.mjs, which extracts them)`);
  const ns = 'http://www.w3.org/2000/svg', el = document.createElement('div'); el.className = 'lv-foot';
  el.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:clip;overflow-clip-margin:0px`;
  const svg = document.createElementNS(ns, 'svg');
  for (const [a, v] of [['width', 3 * W], ['height', 3 * H], ['viewBox', `0 0 ${3 * W} ${3 * H}`]]) svg.setAttribute(a, v);
  svg.style.cssText = `position:absolute;left:${-W}px;top:${-H}px;display:block`;
  const g = document.createElementNS(ns, 'g'), tiles = [];
  // the 8 mirrored tiles reach 1 px into their neighbours and the centre tile is drawn last, over them: abutting tiles
  // at fractional positions (a total scale below 1 — the opening, entrances, zoom-outs) left a hairline of the underlay
  for (const [i, j] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [0, 0]]) {
    const im = document.createElementNS(ns, 'image'), x = (i + 1) * W, y = (j + 1) * H, e = i || j ? 1 : 0;
    for (const [a, v] of [['x', x - e], ['y', y - e], ['width', W + 2 * e], ['height', H + 2 * e], ['preserveAspectRatio', 'xMidYMid slice']]) im.setAttribute(a, v);
    if (i || j) im.setAttribute('transform', `matrix(${i ? -1 : 1} 0 0 ${j ? -1 : 1} ${i ? 2 * x + W : 0} ${j ? 2 * y + H : 0})`);   // flipped about its own centre
    g.appendChild(im); tiles.push(im);
  }
  svg.appendChild(g); el.appendChild(svg);
  const dim = K.clamp(Number(s.bgDim ?? defs.bgDim ?? .15));
  if (dim > 0) {          // a dark scrim under light copy; theme: light (dark copy) gets a light one
    const scrim = document.createElement('div');
    scrim.style.cssText = `position:absolute;left:${-W}px;top:${-H}px;width:${3 * W}px;height:${3 * H}px;background:${dark ? `rgba(0,0,0,${dim})` : `rgba(255,255,255,${dim})`}`;
    el.appendChild(scrim);
  }
  const pre = new Image();        // decodes a frame before the tiles point at it (a cached image loads synchronously)
  let lastSrc = null;
  const show = async url => {
    if (url === lastSrc) return true;
    pre.src = url; const ok = await pre.decode().then(() => true, () => false);
    for (const im of tiles) im.setAttribute('href', url);
    lastSrc = url;
    return ok;
  };
  // an undecodable file (an HTML page or a HEIC saved as .jpg) stops the build: footage counts as picture content in QA,
  // so a broken image must never reach a frame. A download cut short still decodes here (its top part), so --grid has
  // ffmpeg decode every image first (spec.mjs imageProblem)
  if (!(await show(video ? plateURL(plate, 0) : jobURL(src)))) throw new Error(`shot ${s.id}: bg ${src} could not be decoded as ${video ? 'footage (its first extracted frame)' : 'an image'} — re-export it as .jpg/.png/.webp or .mp4`);
  const move = s.bgMove || defs.bgMove || 'in', cx = 1.5 * W, cy = 1.5 * H;
  const foot = { el, motion: null, async render(t, D) {
    const p = K.clamp(t / D);          // Ken Burns, as the media block
    const sc = move === 'none' ? 1 : move === 'out' ? 1.12 - .1 * p : move === 'in' ? 1.02 + .1 * p : 1.1;
    const dx = move === 'left' ? (.04 - .08 * p) * W : move === 'right' ? (-.04 + .08 * p) * W : 0;
    const m = foot.motion ? foot.motion(t, D) || {} : null;      // the block's own bgMotion on top
    g.setAttribute('transform', m ? `translate(${(dx + cx + (Number(m.x) || 0)).toFixed(2)} ${(cy + (Number(m.y) || 0)).toFixed(2)}) scale(${(sc * (m.s ?? 1)).toFixed(5)}) translate(${-cx} ${-cy})`
      : `translate(${(dx + cx).toFixed(2)} ${cy}) scale(${sc.toFixed(5)}) translate(${-cx} ${-cy})`);
    if (video) await show(plateURL(plate, Math.min(plate.n - 1, Math.max(0, Math.round(t * 2)))));
  } };
  return foot;
}
async function build() {
  const inj = window.__LV__ || {};
  const q = new URLSearchParams(location.search);
  TL = inj.timeline || await (await fetch(q.get('tl'))).json();
  ASPECT = inj.aspect || q.get('aspect') || TL.aspects[0];
  PLATES = inj.plates || (q.get('plates') ? await (await fetch(q.get('plates'))).json() : {});   // --serve passes footage frames by URL
  ALPHA = !!(inj.alpha || q.has('alpha'));
  CLEAN = !!(inj.clean || q.has('clean'));
  BG_ONLY = inj.bgOnly === 'brand' ? 'brand' : !!inj.bgOnly;   // QA reference: background + camera + bars + overlays, no content, no footage (see setBgOnly)
  const layer0 = inj.layer ?? null;               // --layers: draw only this layer (everything else hidden by visibility)
  if (ALPHA) document.documentElement.classList.add('lv-alpha');
  [W, H] = SIZES[ASPECT];
  document.body.style.margin = '0';
  stage = $('#lv-stage');
  Object.assign(stage.style, { width: W + 'px', height: H + 'px' });
  // the view clip (seek) needs overflow-clip-margin; without it content would be cut at the frame edge in every whip/zoom-out
  if (!CSS.supports('overflow-clip-margin', '1px')) throw new Error('this Chrome has no overflow-clip-margin (Chrome 90+ needed) — update Chrome or point CHROME_PATH at a newer one');
  const fam = await loadFonts(TL.brand);
  const C = TL.brand.colors;
  stage.style.background = ALPHA ? 'transparent' : C.bg;
  const custom = {};
  for (const [name, url] of Object.entries(TL.customBlocks || {})) custom[name] = (await import(url)).default;
  for (let i = 0; i < TL.shots.length; i++) {
    const s = TL.shots[i], hasBg = !!bgOf(s);
    const dark = hasBg ? s.theme !== 'light' : s.theme === 'dark';     // copy over footage is light-on-dark unless theme: light
    const el = document.createElement('div'); el.className = 'lv-shot'; el.dataset.id = s.id;
    el.style.cssText = `position:absolute;inset:0;display:none;overflow:hidden;color:${dark ? '#fff' : C.ink}`;
    const cam = document.createElement('div'); cam.className = 'lv-cam';
    cam.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:${W / 2}px ${H / 2}px`;
    const bg = document.createElement('div');
    const bgc = dark ? C.dark : C.bg;
    const grid = TL.brand.bg === 'plain' ? '' : TL.brand.bg === 'dots'
      ? `radial-gradient(${dark ? 'rgba(255,255,255,.07)' : 'rgba(17,17,20,.07)'} 1.4px,transparent 1.6px) 0 0/${36 * Math.min(W, H) / 1080}px ${36 * Math.min(W, H) / 1080}px,`
      : `linear-gradient(${dark ? 'rgba(255,255,255,.05)' : 'rgba(17,17,20,.045)'} 1px,transparent 1px) -1px -1px/${60 * Math.min(W, H) / 1080}px ${60 * Math.min(W, H) / 1080}px,linear-gradient(90deg,${dark ? 'rgba(255,255,255,.05)' : 'rgba(17,17,20,.045)'} 1px,transparent 1px) -1px -1px/${60 * Math.min(W, H) / 1080}px ${60 * Math.min(W, H) / 1080}px,`;
    bg.style.cssText = `position:absolute;left:${-.5 * W}px;top:${-.5 * H}px;width:${2 * W}px;height:${2 * H}px;
      background:radial-gradient(ellipse ${.47 * Math.max(W, H)}px ${.33 * Math.max(W, H)}px at 50% 50%,${dark ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.95)'},rgba(255,255,255,0) 70%),${grid}${bgc}`;
    if (hasBg) bg.style.background = bgc;         // bg footage replaces the brand background: a plain underlay for the moves
    const content = document.createElement('div'); content.className = 'lv-content';
    // a transparent border makes the content box 3W × 3H around the frame while children keep frame coordinates
    // (absolute children sit inside the border): content that overflows its box under the moving camera (tiles flung
    // out, a phone sliding in from below) makes Chrome start compositing the camera after a few frames and resample it —
    // history-dependent, so a layer pass could rasterise differently from the full frame
    content.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;border:solid transparent;border-width:${H}px ${W}px;margin:${-H}px 0 0 ${-W}px`;
    content.dataset.lvLayer = 'content';          // untagged elements inherit this fallback layer
    content.style.overflow = 'clip';              // and clipped each frame to what the camera can see (seek)
    if (!ALPHA) cam.appendChild(bg);
    const block = custom[s.block] || BLOCKS[s.block];
    if (!block) throw new Error(`unknown block "${s.block}" in shot ${s.id}`);
    const foot = hasBg ? await buildFoot(s, dark, block.bgDefaults || {}) : null;
    if (foot) cam.appendChild(foot.el);           // built in transparent renders too (hidden), for the `footage` layer pass
    cam.appendChild(content);
    if (BG_ONLY) content.style.visibility = 'hidden';
    el.appendChild(cam); stage.appendChild(el);
    const bar = K.letterboxBar(s.letterbox, W, H);
    // cross-cut overlays this shot takes part in (its exit, or the previous shot's into it)
    const xIn = i && K.XFX[TL.shots[i - 1].out] && TL.shots[i - 1].out, xOut = i < TL.shots.length - 1 && K.XFX[s.out] && s.out;
    const overlay = !CLEAN && [xIn, xOut].some(x => x && K.XFX[x].overlay);
    const taken = new Set([...(hasBg ? ['footage'] : []), ...(bar ? ['letterbox'] : []), ...([xIn, xOut].some(x => x && K.XFX[x].overlay) ? ['transition'] : [])]);
    const prevOut = i ? TL.shots[i - 1].out : null;
    // the slow push keeps going the way the entrance zoom was going (a shrinking zoom-out entrance keeps shrinking):
    // an entrance zoom and a push in opposite directions cancel a few frames in and the shot stands still (QA: freeze)
    const dr = s.drift && typeof s.drift === 'object' ? s.drift : {}, enter0 = CLEAN ? { s: -.03 } : enterFor(prevOut, W, H, i === 0);
    // drift: {in, decay} — this shot's drift entrance: its strength, and how fast it settles (a drop, not momentum)
    const enter = !CLEAN && K.isDrift(prevOut) && (dr.in != null || dr.decay != null) ? { ...scaleMove(enter0, Number(dr.in ?? 1)), ...(dr.decay != null ? { decay: Number(dr.decay) } : {}) } : enter0;
    const ctx = makeCtx(s, content, fam, dark, taken);
    // enter: how the camera arrives (px offsets in the block's own coordinates, decaying × decay per frame; s = scale)
    const z0 = perAspect(s.zoom) != null ? Number(perAspect(s.zoom)) : 1;
    ctx.enter = { dx: (enter.dx || 0) / z0, dy: (enter.dy || 0) / z0, s: enter.s || 0, decay: enter.decay ?? .8 };
    if (foot && block.bgMotion) foot.motion = block.bgMotion(ctx, s) || null;
    el.style.display = 'block';
    const inst = await block.build(ctx, s);
    // every image the block placed must decode (a broken file would otherwise render as Chrome's broken-image icon)
    const broken = (await Promise.all([...content.querySelectorAll('img')].filter(im => im.getAttribute('src'))
      .map(im => im.decode().then(() => null, () => { const u = im.getAttribute('src').replace(/^\/job\//, ''); try { return decodeURIComponent(u); } catch { return u; } })))).filter(Boolean);
    if (broken.length) throw new Error(`shot ${s.id}: ${[...new Set(broken)].join(', ')} could not be decoded as an image — re-export it as .jpg/.png/.webp/.svg`);
    const layers = layerList(content);            // measured while the shot is laid out
    // the engine's own front layers (the footage layer goes under the content: lv.mjs adds it to opaque exports)
    if (overlay) layers.layers.push({ name: 'transition', roots: 1, text: false });
    if (bar) layers.layers.push({ name: 'letterbox', roots: 1, text: false });
    // raster anchor: transparent text over the whole stage, in every render and every layer pass. Chrome rasterises a
    // frame that holds (enough) text differently from one that holds little or none — scaled SVG art came out softer —
    // so a layer pass without text would no longer match the full frame. It draws no pixels; QA and layers skip it.
    const anchor = document.createElement('div'); anchor.className = 'lv-anchor';
    anchor.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden;visibility:visible;color:transparent;font:400 ${Math.round(Math.min(W, H) / 10)}px Inter;line-height:1;word-break:break-all;pointer-events:none`;
    anchor.textContent = 'Ag'.repeat(400);
    content.appendChild(anchor);
    el.style.display = 'none';
    const push = (s.push ?? .035) * ((enter.s || 0) > 0 ? -1 : 1);
    // new camera model (opt-in): a drift exit or entrance, or camera fields — expo exit, velocity motion blur (below)
    const view = viewFor(s, W, H), drifts = K.isDrift(s.out) && i < TL.shots.length - 1, v2 = !!view || (!CLEAN && (drifts || K.isDrift(prevOut)));
    const opt = { ...(view ? { view } : {}), ...(v2 ? { v2 } : {}) };
    const camSpec = CLEAN ? { enter, exit: {}, exitLen: 0, push, ...opt }
      : { enter, exit: drifts && dr.out != null ? scaleMove(exitFor(s.out, W, H), Number(dr.out)) : exitFor(s.out, W, H),
        exitLen: s.out && s.out !== 'cut' && i < TL.shots.length - 1 ? K.exitLen(s.out) : 0, push, ...(drifts ? { expo: true } : {}), ...opt };
    shots.push({ s, el, cam, inst, camSpec, ctx, layers, foot, bar, dark, hasBg });
  }
  // stage-level layers, created only when a shot uses them (a timeline without them builds exactly the old page)
  if (!CLEAN && TL.shots.some((s, i) => i < TL.shots.length - 1 && K.XFX[s.out] && K.XFX[s.out].overlay)) {
    OVL = document.createElement('div'); OVL.className = 'lv-ovl';
    OVL.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden;pointer-events:none;display:none`;
    stage.appendChild(OVL);
  }
  if (shots.some(sh => sh.bar)) {
    LBOX = document.createElement('div'); LBOX.className = 'lv-lbox';
    LBOX.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;display:none`;
    LBOX.innerHTML = `<div style="position:absolute;left:0;top:0;width:${W}px;background:#000"></div><div style="position:absolute;left:0;bottom:0;width:${W}px;background:#000"></div>`;
    stage.appendChild(LBOX);
  }
  if (layer0 != null) setLayer(layer0); else engineVis();
}

// hold: [a, b] in local frames freezes block + camera time between a and b (the only way to get identical frames); the
// block then runs on with its time b − a behind (it planned itself for Db = D − (b − a) frames), the exit stays on the cut
const holdMap = (s, t) => !s.hold ? t : t < s.hold[0] ? t : t <= s.hold[1] ? s.hold[0] : t - (s.hold[1] - s.hold[0]);

// ── cross-cut transitions (glitch · smear-left/right · tunnel · flash): timed off the cut, pure functions of f. The
// camera does the shot's own exit/entrance move as for every transition; on top, glitch filters the camera and the
// others draw a stage-level overlay above both shots (the `transition` layer). Off in clean renders (--clips/--layers).
// fx.d = frames from the cut (< 0 in the outgoing shot's last frames, ≥ 0 in the incoming shot's first ones).
function xfxAt(k, f) {
  if (CLEAN) return null;
  const s = shots[k].s, out = k < shots.length - 1 && K.XFX[s.out];
  if (out && f >= s.f1 - out.pre) return { type: s.out, d: f - s.f1, from: k, to: k + 1, seed: K.hashStr(`${s.id}>${s.out}`) };
  const prev = k > 0 ? shots[k - 1].s : null, inn = prev && K.XFX[prev.out];
  if (inn && f < s.f0 + inn.post) return { type: prev.out, d: f - s.f0, from: k - 1, to: k, seed: K.hashStr(`${prev.id}>${prev.out}`) };
  return null;
}
// envelope 0 → 1 at the cut → 0: power ramps over the pre / post frames
const xEnv = (fx, a = 1.6, b = 1.4) => { const x = K.XFX[fx.type]; return fx.d < 0 ? Math.pow(K.clamp(1 + fx.d / x.pre), a) : Math.pow(K.clamp(1 - fx.d / x.post), b); };

// glitch: horizontal slice displacement (banded noise → feDisplacementMap), a vertical pixel-streak smear in a band or
// two, and an RGB split — reseeded on every rendered frame, strongest on the cut (~4 frames out, ~3 in)
let GL = null;
function glitchFilter(fx, f) {
  const ns = 'http://www.w3.org/2000/svg', u = Math.min(W, H) / 1080;
  if (!GL) {
    const fl = document.createElementNS(ns, 'filter');
    for (const [a, v] of [['id', 'lvGlitch'], ['filterUnits', 'userSpaceOnUse'], ['primitiveUnits', 'userSpaceOnUse'], ['x', -.25 * W], ['y', -.25 * H], ['width', 1.5 * W], ['height', 1.5 * H], ['color-interpolation-filters', 'sRGB']]) fl.setAttribute(a, v);
    fl.innerHTML = `<feTurbulence type="fractalNoise" numOctaves="1" result="n"/>
      <feComponentTransfer in="n" result="m"><feFuncR type="discrete"/><feFuncG type="linear" slope="0" intercept=".5"/><feFuncB type="linear" slope="0" intercept=".5"/><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer>
      <feDisplacementMap in="SourceGraphic" in2="m" xChannelSelector="R" yChannelSelector="G" result="sl"/>
      <feTurbulence type="fractalNoise" numOctaves="1" result="cn"/>
      <feComponentTransfer in="cn" result="cm"><feFuncR type="linear" slope="0" intercept=".5"/><feFuncG type="discrete"/><feFuncB type="linear" slope="0" intercept=".5"/><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer>
      <feDisplacementMap in="sl" in2="cm" xChannelSelector="R" yChannelSelector="G" result="col"/>
      <feGaussianBlur in="col" result="st1"/><feGaussianBlur in="col" result="st2"/>
      <feMerge result="sm"><feMergeNode in="sl"/><feMergeNode in="st1"/><feMergeNode in="st2"/></feMerge>
      <feColorMatrix in="sm" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/><feOffset in="r" result="r2"/>
      <feColorMatrix in="sm" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>
      <feColorMatrix in="sm" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/><feOffset in="b" result="b2"/>
      <feBlend in="r2" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b2" mode="screen"/>`;
    $('#lv-fx defs').appendChild(fl);
    const q = sel => [...fl.querySelectorAll(sel)];
    const [tu1, tu2] = q('feTurbulence'), [d1, d2] = q('feDisplacementMap'), [b1, b2] = q('feGaussianBlur'), [o1, o2] = q('feOffset');
    GL = { tu1, tu2, d1, d2, b1, b2, o1, o2, fr: fl.querySelector('feFuncR[type="discrete"]'), fg: fl.querySelector('feFuncG[type="discrete"]') };
  }
  const amt = fx.d < 0 ? .45 + .55 * K.clamp(1 + fx.d / (K.XFX.glitch.pre + .5)) : 1 - .7 * K.clamp(fx.d / K.XFX.glitch.post);
  const fi = Math.round(f * 2), r = K.rng(fx.seed ^ Math.imul(fi + 1, 0x9E3779B1));
  // slices: noise that varies only down the frame, quantised into bands; a share of the bands jump sideways
  GL.tu1.setAttribute('baseFrequency', `0 ${(.004 + .01 * r()) / u}`); GL.tu1.setAttribute('seed', String(1 + (fi * 13 + (fx.seed & 1023)) % 9973));
  GL.fr.setAttribute('tableValues', Array.from({ length: 18 }, () => r() < .5 * amt ? (.5 + (r() - .5) * (.5 + .5 * r())).toFixed(3) : '0.5').join(' '));
  GL.d1.setAttribute('scale', (W * .32 * amt).toFixed(1));
  // streaks: columns pushed up/down by different amounts, smeared vertically, kept to one or two horizontal bands
  GL.tu2.setAttribute('baseFrequency', `${(.06 + .08 * r()) / u} 0`); GL.tu2.setAttribute('seed', String(1 + (fi * 7 + 5) % 9973));
  GL.fg.setAttribute('tableValues', Array.from({ length: 24 }, () => r().toFixed(3)).join(' '));
  GL.d2.setAttribute('scale', (H * .05 * amt).toFixed(1));
  [GL.b1, GL.b2].forEach((b, j) => {
    const on = j === 0 ? amt > .35 : amt > .7 && r() < .6, h = H * (.06 + .14 * r()), y = H * (-.05 + r() * .95);
    b.setAttribute('stdDeviation', `0 ${(on ? 10 + 24 * amt : 0).toFixed(1)}`);
    for (const [a, v] of [['x', -.25 * W], ['y', on ? y : -10 * H], ['width', 1.5 * W], ['height', on ? h : 1]]) b.setAttribute(a, v.toFixed ? v.toFixed(1) : v);
  });
  const rs = (5 + 9 * r()) * u * amt;
  GL.o1.setAttribute('dx', (-rs).toFixed(2)); GL.o2.setAttribute('dx', rs.toFixed(2));
  return 'url(#lvGlitch)';
}

// overlays: one SVG per frame (a few dozen elements), above both shots
const f1 = x => x.toFixed(1);
function smearSVG(fx) {
  const x = K.XFX[fx.type], C = TL.brand.colors, u = Math.min(W, H) / 1080, r = K.rng(fx.seed);
  const p = (fx.d + x.pre) / (x.pre + x.post), env = Math.pow(Math.sin(Math.PI * K.clamp(p)), .7);
  const sgn = fx.type === 'smear-left' ? -1 : 1;       // the streaks travel the way the picture whips
  const yc = H * (.34 + .32 * r()), band = H * (.3 + .14 * r()), cols = [C.accent, C.accent2 || C.accent, C.accent3 || C.accent, C.accent];
  // a broad accent smear (a long soft blob racing across), then bright streaks of different lengths and speeds inside
  // and around it, white-hot at their leading ends — all motion-blurred sideways
  const xb = W / 2 + sgn * (p - .5) * W * 2.2;
  let lines = `<rect x="${f1(xb - W * .95)}" y="${f1(yc - band / 2)}" width="${f1(W * 1.9)}" height="${f1(band)}" fill="url(#lvSmB)" opacity=".62"/>`;
  for (let i = 0; i < 18; i++) {
    const y = yc + (r() - .5) * band * 1.5, h = (3 + 30 * r() * r()) * u, L = W * (.35 + .75 * r()), sp = .75 + 1 * r(), off = (r() - .5) * W * .7;
    const xc = W / 2 + sgn * (p - .5) * W * 2.6 * sp + off;
    lines += `<rect x="${f1(xc - L / 2)}" y="${f1(y - h / 2)}" width="${f1(L)}" height="${f1(h)}" rx="${f1(h / 2)}" fill="url(#lvSm${i % 4})" opacity="${(.6 + .4 * r()).toFixed(2)}"/>`;
  }
  const grad = (id, c) => `<linearGradient id="${id}" x1="${sgn < 0 ? 1 : 0}" x2="${sgn < 0 ? 0 : 1}"><stop offset="0" stop-color="${c}" stop-opacity="0"/><stop offset=".5" stop-color="${c}" stop-opacity=".95"/><stop offset=".84" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
  return `<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;opacity:${(.92 * env).toFixed(3)}"><defs>${cols.map((c, i) => grad(`lvSm${i}`, c)).join('')}
    <linearGradient id="lvSmB" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${C.accent}" stop-opacity="0"/><stop offset=".5" stop-color="${C.accent}" stop-opacity=".85"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></linearGradient>
    <filter id="lvSmF" filterUnits="userSpaceOnUse" x="${-W}" y="${-H}" width="${3 * W}" height="${3 * H}"><feGaussianBlur stdDeviation="${f1(60 * u)} ${f1(2 * u)}"/></filter></defs>
    <g filter="url(#lvSmF)">${lines}</g></svg>`;
}
// flash: the whole exposure lives in the overlay — a lerp towards white (white core, accent rim) is exact as a layer over
// the others, where a camera brightness() would clip highlights per layer and the --layers stack couldn't add up.
// A hot core (≤ 81 % white at the very centre, so the frame never goes solid) fading to the accent at the edges, plus an
// anamorphic lens streak through the middle.
function flashSVG(fx) {
  const C = TL.brand.colors, e = xEnv(fx, 2, 1.6), u = Math.min(W, H) / 1080;
  return `<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0"><defs>
    <radialGradient id="lvFl" cx=".5" cy=".5" r=".72"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".22" stop-color="#fff" stop-opacity=".9"/><stop offset=".55" stop-color="${C.accent}" stop-opacity=".55"/><stop offset="1" stop-color="${C.accent}" stop-opacity=".3"/></radialGradient>
    <radialGradient id="lvFlC" cx=".5" cy=".5" r=".3"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <linearGradient id="lvFlS" x1="0" x2="1"><stop offset="0" stop-color="${C.accent}" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></linearGradient>
    <filter id="lvFlB" filterUnits="userSpaceOnUse" x="${-W}" y="${-H}" width="${3 * W}" height="${3 * H}"><feGaussianBlur stdDeviation="${f1(30 * u)} ${f1(6 * u)}"/></filter></defs>
    <rect width="${W}" height="${H}" fill="url(#lvFl)" opacity="${(.66 * e).toFixed(3)}"/>
    <rect width="${W}" height="${H}" fill="url(#lvFlC)" opacity="${(.5 * Math.pow(e, 1.5)).toFixed(3)}"/>
    <rect x="${f1(-W * .1)}" y="${f1(H / 2 - 9 * u)}" width="${f1(W * 1.2)}" height="${f1(18 * u)}" fill="url(#lvFlS)" filter="url(#lvFlB)" opacity="${(.9 * Math.pow(e, .7)).toFixed(3)}"/></svg>`;
}
// tunnel: a perspective corridor whose far end is the incoming shot's frame — walls (fogged towards the vanishing point),
// rings and long lines in the brand line colour, and slabs streaking past on the walls. Before the cut it fades in over
// the outgoing shot as the camera rushes into it; after the cut its opening is the incoming shot, growing as it flies up.
function tunnelSVG(fx) {
  const C = TL.brand.colors, u = Math.min(W, H) / 1080, to = shots[fx.to], dark = to.dark, r = K.rng(fx.seed);
  const a = xEnv(fx, 1.7, 1.15);
  const s0 = 1 + enterFor('tunnel', W, H, false).s, c = fx.d >= 0 ? CAM : { s: s0, x: 0, y: 0 };
  const I = { x0: W / 2 + c.x - W / 2 * c.s, y0: H / 2 + c.y - H / 2 * c.s, x1: W / 2 + c.x + W / 2 * c.s, y1: H / 2 + c.y + H / 2 * c.s };
  const O = { x0: -2, y0: -2, x1: W + 2, y1: H + 2 }, Z = 1 / Math.max(.05, Math.min(.95, c.s));   // far end's depth (near = 1)
  const ring = z => { const q = K.clamp((1 / z - 1 / Z) / (1 - 1 / Z)); return { q, x0: K.lerp(I.x0, O.x0, q), y0: K.lerp(I.y0, O.y0, q), x1: K.lerp(I.x1, O.x1, q), y1: K.lerp(I.y1, O.y1, q) }; };
  const pt = (R, wall, l) => wall === 0 ? [K.lerp(R.x0, R.x1, l), R.y0] : wall === 1 ? [R.x1, K.lerp(R.y0, R.y1, l)] : wall === 2 ? [K.lerp(R.x1, R.x0, l), R.y1] : [R.x0, K.lerp(R.y1, R.y0, l)];
  const poly = (pts, attrs) => `<polygon points="${pts.map(p => `${f1(p[0])},${f1(p[1])}`).join(' ')}" ${attrs}/>`;
  const wallC = dark ? C.dark : '#FFFFFF', fogC = dark ? (C.accentOnDark || C.accent) : '#FFFFFF', lineC = dark ? 'rgba(255,255,255,.34)' : C.line, slabC = dark ? 'rgba(255,255,255,.16)' : C.ink;
  const phase = fx.d * .55;                              // rings per frame flying past (constant speed through the cut)
  let g = '';
  // walls: each from the frame edge to the opening, fogged
  const Rw = [[O.x0, O.y0, O.x1, O.y0, I.x1, I.y0, I.x0, I.y0, 0, O.y0, 0, I.y0], [O.x1, O.y0, O.x1, O.y1, I.x1, I.y1, I.x1, I.y0, O.x1, 0, I.x1, 0],
    [O.x1, O.y1, O.x0, O.y1, I.x0, I.y1, I.x1, I.y1, 0, O.y1, 0, I.y1], [O.x0, O.y1, O.x0, O.y0, I.x0, I.y0, I.x0, I.y1, O.x0, 0, I.x0, 0]];
  let defs = '';
  Rw.forEach((w, k) => {
    const hz = k % 2 === 0, [ga, gb] = hz ? [w[9], w[11]] : [w[8], w[10]];
    defs += `<linearGradient id="lvTw${k}" gradientUnits="userSpaceOnUse" ${hz ? `x1="0" x2="0" y1="${f1(ga)}" y2="${f1(gb)}"` : `y1="0" y2="0" x1="${f1(ga)}" x2="${f1(gb)}"`}><stop offset="0" stop-color="${wallC}" stop-opacity=".93"/><stop offset="1" stop-color="${fogC}" stop-opacity="${dark ? .5 : .72}"/></linearGradient>`;
    g += poly([[w[0], w[1]], [w[2], w[3]], [w[4], w[5]], [w[6], w[7]]], `fill="url(#lvTw${k})"`);
  });
  // slabs streaking along the walls (each with a short trail towards the vanishing point)
  for (let i = 0; i < 14; i++) {
    const wall = i % 4, l0 = .06 + .7 * r(), l1 = Math.min(.95, l0 + .08 + .2 * r()), len = .25 + .6 * r(), span = Z - 1 + len + .5;
    const zA = 1 - len + (((r() * span - phase * .45) % span) + span) % span;
    for (const [dz, op] of [[.32, .18], [.16, .38], [0, dark ? .9 : .82]]) {
      const A = ring(Math.max(1.001, zA + dz)), B = ring(Math.max(1.001, Math.min(Z, zA + len + dz)));
      if (zA + dz >= Z || B.q >= A.q) continue;
      g += poly([pt(A, wall, l0), pt(A, wall, l1), pt(B, wall, l1), pt(B, wall, l0)], `fill="${slabC}" opacity="${(op * (.35 + .65 * A.q)).toFixed(3)}"`);
    }
  }
  // rings flying towards the camera, and the long lines (corners + three per wall) converging on the far end
  const nR = 9, dZ = (Z - 1) / nR;
  for (let j = 0; j < nR; j++) {
    const z = 1 + dZ * (j + 1 - (((phase % 1) + 1) % 1));
    const R = ring(z), sw = (1 + 4 * R.q) * u;
    g += `<rect x="${f1(R.x0)}" y="${f1(R.y0)}" width="${f1(R.x1 - R.x0)}" height="${f1(R.y1 - R.y0)}" fill="none" stroke="${lineC}" stroke-width="${f1(sw)}" opacity="${(.25 + .75 * R.q).toFixed(3)}"/>`;
  }
  const Rf = ring(Z), Rn = ring(1);
  let ls = '';
  for (let wall = 0; wall < 4; wall++) for (const l of [0, .25, .5, .75]) { const p0 = pt(Rn, wall, l), p1 = pt(Rf, wall, l); ls += `M${f1(p0[0])} ${f1(p0[1])}L${f1(p1[0])} ${f1(p1[1])}`; }
  g += `<path d="${ls}" stroke="${lineC}" stroke-width="${f1(2 * u)}" fill="none"/>`;
  // the opening's rim + a glow at the vanishing point
  g += `<rect x="${f1(I.x0)}" y="${f1(I.y0)}" width="${f1(I.x1 - I.x0)}" height="${f1(I.y1 - I.y0)}" fill="none" stroke="${dark ? 'rgba(255,255,255,.55)' : '#fff'}" stroke-width="${f1(3 * u)}"/>`;
  defs += `<radialGradient id="lvTg" gradientUnits="userSpaceOnUse" cx="${f1((I.x0 + I.x1) / 2)}" cy="${f1((I.y0 + I.y1) / 2)}" r="${f1(Math.max(I.x1 - I.x0, I.y1 - I.y0) * 1.1)}"><stop offset=".4" stop-color="${fogC}" stop-opacity="0"/><stop offset=".55" stop-color="${fogC}" stop-opacity="${dark ? .28 : .5}"/><stop offset="1" stop-color="${fogC}" stop-opacity="0"/></radialGradient>`;
  g += `<rect width="${W}" height="${H}" fill="url(#lvTg)"/>`;
  return `<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;opacity:${(.88 * a).toFixed(3)}"><defs>${defs}</defs>${g}</svg>`;
}

async function seek(f) {
  const i = TL.shots.findIndex(s => f >= s.f0 && f < s.f1);
  const k = i < 0 ? TL.shots.length - 1 : i;
  const sh = shots[k];
  if (current !== sh) { if (current) current.el.style.display = 'none'; sh.el.style.display = 'block'; current = sh; }
  const D = sh.s.D, Db = sh.s.Db ?? D, t = holdMap(sh.s, f - sh.s.f0), tv = g => cameraAt(sh.camSpec, holdMap(sh.s, g - sh.s.f0), D, g - sh.s.f0, Db);
  const c = tv(f), c1 = tv(f + .25), c0 = tv(f - .25);
  const vx = Math.abs(c1.x - c0.x) * 2, vy = Math.abs(c1.y - c0.y) * 2, vs = Math.abs(c1.s - c0.s) * 2 * Math.max(W, H) / 2;
  const mb = v => .28 * v * Math.min(1, v / 20);
  // v2 (drift cuts, camera fields): σ = 0.2 × speed along the travel, fading in from 2 to 8 px/frame of the measured
  // 1080 × 608 film (scaled to this stage's short side); the filter sits in the camera's own (scaled) space, so ÷ scale
  const k6 = Math.min(W, H) / 608, mb2 = v => .2 * v * K.smoothstep(2 * k6, 8 * k6, v), v2 = !!sh.camSpec.v2;
  const bx = Math.min(22, v2 ? mb2(vx) : mb(vx)), by = Math.min(22, v2 ? mb2(vy) : mb(vy)), bs = Math.min(12, mb(vs) * .5 + c.blur);
  const fx = xfxAt(k, f);              // glitch filters the camera; smear / tunnel / flash draw the overlay (below)
  sh.cam.style.transform = `translate(${c.x.toFixed(2)}px,${c.y.toFixed(2)}px) scale(${c.s.toFixed(5)})`;
  sh.cam.style.filter = filt(fx && fx.type === 'glitch' ? glitchFilter(fx, f) : '', v2 ? dblur('lvB' + k, bx / c.s, by / c.s) : dblur('lvB' + k, bx, by), blurCss(v2 ? bs / c.s : bs));
  CAM = { blur: +Math.max(bx, by, bs).toFixed(3), s: +c.s.toFixed(5), x: +c.x.toFixed(2), y: +c.y.toFixed(2) };   // layer QA diagnostics
  // the content is clipped to what the camera can see now (the frame mapped back through the camera, + the blur's reach),
  // relative to its padding box = the frame: content left outside the frame (tiles flung out, a phone sliding in) makes
  // Chrome start compositing the camera when little else is on screen (a single layer pass) — nothing visible is clipped
  const vl = W / 2 - (W / 2 + c.x) / c.s, vr = W / 2 + (W / 2 - c.x) / c.s, vt = H / 2 - (H / 2 + c.y) / c.s, vb = H / 2 + (H / 2 - c.y) / c.s;
  sh.ctx.root.style.overflowClipMargin = Math.ceil(Math.max(0, -vl, vr - W, -vt, vb - H) + 3 * Math.max(bx, by, bs) / c.s + 2) + 'px';
  if (sh.foot) sh.foot.el.style.overflowClipMargin = sh.ctx.root.style.overflowClipMargin;
  if (OVL) {
    const html = fx && K.XFX[fx.type].overlay ? (fx.type === 'tunnel' ? tunnelSVG(fx) : fx.type === 'flash' ? flashSVG(fx) : smearSVG(fx)) : '';
    OVL.style.display = html ? 'block' : 'none';
    if (OVL.innerHTML !== html) OVL.innerHTML = html;
  }
  if (LBOX) {
    LBOX.style.display = sh.bar ? 'block' : 'none';
    for (const b of LBOX.children) b.style.height = sh.bar + 'px';
  }
  const fr = sh.foot ? sh.foot.render(t, Db) : null;
  const r = sh.inst.render(t, Db);
  if (fr) await fr;
  if (r && r.then) await r;
  if (window.__LV_DEBUG__) { const d = $('#lv-dbg'); d.style.display = 'block'; d.textContent = `${sh.s.id} f${f}`; }
  return sh.s.id;
}

// Text audit for QA: every .lv-txt box on screen now, in stage pixels, with its effective font size.
function audit() {
  if (!current) return [];
  const sr = stage.getBoundingClientRect();
  return [...current.el.querySelectorAll('.lv-txt')].filter(e => {
    const cs = getComputedStyle(e);
    return cs.visibility !== 'hidden' && e.offsetParent !== null && parseFloat(getComputedStyle(e).opacity) > .01;
  }).map(e => {
    // the glyphs' extent (a centred short line in a wide box only occupies its middle), not the element box
    const rg = document.createRange(); rg.selectNodeContents(e);
    const r = rg.getBoundingClientRect().width ? rg.getBoundingClientRect() : e.getBoundingClientRect(), scale = e.offsetHeight ? e.getBoundingClientRect().height / e.offsetHeight : 1;
    let op = 1; for (let n = e; n && n !== stage; n = n.parentElement) op *= parseFloat(getComputedStyle(n).opacity);
    return { text: e.textContent.trim().slice(0, 60), x0: r.left - sr.left, y0: r.top - sr.top, x1: r.right - sr.left, y1: r.bottom - sr.top,
      px: parseFloat(getComputedStyle(e).fontSize) * scale, ui: !!e.closest('.lv-ui'), opacity: op };
  }).filter(b => b.opacity > .5);
}

// optional scrub UI for humans: ?ui=1
function scrubber() {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;padding:10px 16px;background:#111;color:#eee;font:13px Inter,sans-serif;display:flex;gap:12px;align-items:center;z-index:9';
  const total = TL.shots[TL.shots.length - 1].f1;
  box.innerHTML = `<button id="lv-play" style="font:inherit">▶︎</button><input id="lv-range" type="range" min="0" max="${total - .5}" step=".5" value="0" style="flex:1"><span id="lv-t" style="width:150px"></span>`;
  document.body.appendChild(box);
  const range = $('#lv-range'), lab = $('#lv-t');
  const fit = () => { const s = Math.min(innerWidth / W, (innerHeight - 50) / H); stage.style.transform = `scale(${s})`; stage.style.transformOrigin = '0 0'; };
  addEventListener('resize', fit); fit();
  let playing = false, t0 = 0, f0 = 0;
  const show = async f => { const id = await seek(f); range.value = f; lab.textContent = `${id} · f${f.toFixed(1)} · ${(f / 30).toFixed(2)}s`; };
  range.oninput = () => { playing = false; show(Number(range.value)); };
  $('#lv-play').onclick = () => { playing = !playing; t0 = performance.now(); f0 = Number(range.value); if (playing) loop(); };
  const loop = async () => { if (!playing) return; let f = f0 + (performance.now() - t0) / 1000 * 30; if (f >= total) { f = 0; f0 = 0; t0 = performance.now(); } await show(Math.round(f * 2) / 2); requestAnimationFrame(loop); };
  show(0);
}

window.LV = {
  ready: build().then(async () => { await seek(0); if (new URLSearchParams(location.search).has('ui')) scrubber(); return { W, H, aspect: ASPECT, shots: TL.shots.length }; }),
  seek, audit, setLayer, setBgOnly, textProbe, camera: () => CAM,
  layers: () => Object.fromEntries(shots.map(sh => [sh.s.id, sh.layers])),
  info: () => ({ W, H, aspect: ASPECT, fit: [...document.querySelectorAll('.lv-txt')].filter(e => e.dataset.fit).map(e => ({ text: e.textContent.trim().slice(0, 40), size: Number(e.dataset.fit), size0: Number(e.dataset.size0) })) }),
};
