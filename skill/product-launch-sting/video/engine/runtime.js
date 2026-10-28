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
// height and an entrance of 7 % / 8 % decaying ×0.7 per frame (every other entrance decays ×0.8)
function exitFor(type, W, H) {
  if (type === 'flood') return { s: .04 };          // round 2: a slight push into what was pressed while the colour pours out (dive: cameraAt)
  return ({ 'whip-left': { dx: -.5 * W }, 'whip-right': { dx: .5 * W }, 'whip-up': { dy: -.45 * H }, 'whip-down': { dy: .45 * H },
    'zoom-in': { s: .35 }, 'zoom-out': { s: -.3 }, blur: { blur: 10, s: .04 },
    glitch: { s: .03 }, 'smear-left': { dx: -.5 * W }, 'smear-right': { dx: .5 * W }, tunnel: { s: 1.4 }, flash: { s: .07 },
    'drift-left': { dx: -.05 * W }, 'drift-right': { dx: .05 * W }, 'drift-up': { dy: -.1 * H }, 'drift-down': { dy: .1 * H } })[type] || {};
}
function enterFor(prevOut, W, H, first) {
  if (first) return { s: -.06 };                     // opening: grows into the slow push (same direction, never cancels)
  if (prevOut === 'dive') return { s: 0 };          // round 2: the dive's own entrance (cameraAt: cam.dive.in) carries the shot in
  return ({ 'whip-left': { dx: .36 * W }, 'whip-right': { dx: -.36 * W }, 'whip-up': { dy: .36 * H }, 'whip-down': { dy: -.36 * H },
    'zoom-in': { s: -.18 }, 'zoom-out': { s: .3 }, blur: { blur: 10, s: -.03 },
    // tunnel: the incoming shot starts small at the corridor's vanishing point (its frame = the opening) and flies up
    glitch: { s: -.03 }, 'smear-left': { dx: .36 * W }, 'smear-right': { dx: -.36 * W }, tunnel: { s: -.72 }, flash: { s: -.05 },
    'drift-left': { dx: .07 * W, decay: .7 }, 'drift-right': { dx: -.07 * W, decay: .7 }, 'drift-up': { dy: .08 * H, decay: .7 }, 'drift-down': { dy: -.08 * H, decay: .7 } })[prevOut] || { s: -.04 };
}
// a move's amplitudes × k (a shot's `drift: {in, out}` strength); the decay stays
const scaleMove = (m, k) => Object.fromEntries(Object.entries(m).map(([key, v]) => [key, key === 'decay' ? v : v * k]));
// camera fields on any shot, applied on top of the moves: `zoom` (base scale) about `focus: [x, y]` (fractions of the
// frame; that point stays put), `offset: [x, y]` (fractions of W / H) and `pan: [{at, by: [x, y], len}]` — each pan a
// tanh move of `by` centred on local frame `at` (its fastest frame), τ = len / 7.5 — and `move: [x, y]`, a constant
// drift (fractions of W / H per second) so a shot never holds still. Returns t → {x, y, z} or null.
const CAM_FIELDS = ['zoom', 'focus', 'offset', 'pan', 'move'];
const hasView = s => CAM_FIELDS.some(k => s[k] != null);
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
  const mv = s.move || [0, 0], mx = (Number(mv[0]) || 0) * W / 30, my = (Number(mv[1]) || 0) * H / 30;
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
  const xk = !cam.exitLen ? 0 : cam.expo ? K.expoIn(K.clamp(xu, 0, 1.08)) : K.inCubic(K.clamp(xu, 0, 1.08));
  const p = cam.push * K.clamp(t / Db, 0, 1.2);
  const c = { x: e.dx * ek + x.dx * xk, y: e.dy * ek + x.dy * xk, s: (1 + p) * (1 + e.s * ek) * (1 + x.s * xk), blur: e.blur * ek + x.blur * xk };
  if (cam.view) { const v = cam.view(t); c.s *= v.z; c.x += v.x + v.fx * (1 - c.s); c.y += v.y + v.fy * (1 - c.s); }
  if (cam.dive) diveCam(c, cam.dive, t, D, tr);
  return c;
}

let TL, W, H, ASPECT, stage, shots = [], current = null, PLATES = {}, ALPHA = false, CLEAN = false, BG_ONLY = false, CAM = { blur: 0 };
let LAYER = null, OVL = null, LBOX = null;      // current --layers layer; the stage-level transition overlay and cinema bars
let CARRY = null, CARRIES = [], CARRY_ON = false, DIVES = {}, FLOODS = {};   // round 2: the carry layer (above the shots), its prepared hand-offs; dives and floods by outgoing shot index
const isVideo = p => /\.(mp4|mov|m4v|webm|mkv)$/i.test(p || '');
const bgOf = s => s.bg != null && s.bg !== false && String(s.bg).trim() && String(s.bg).toLowerCase() !== 'none' ? String(s.bg) : null;
// footage plates: lv.mjs extracts every footage field into 60-fps JPEGs keyed `${id}` (media.src), `${id}:bg` (the
// universal bg), `${id}:${field}` / `${id}:${field}.${i}` (a block's declared `media:` fields)
const plateKey = (id, field, i = null) => field === 'src' ? id : `${id}:${field}${i == null ? '' : '.' + i}`;
const plateURL = (p, i) => `${p.url}/${String(i).padStart(5, '0')}.jpg`;

// ── layers: every element a block creates belongs to a named layer (data-lv-layer on it or on its nearest tagged
// ancestor; untagged elements fall back to `content`). Layer mode hides every other layer by *visibility* — layout,
// transforms, clipping and the camera stay exactly as in the full render — so the layer exports restack to the clip.
// The engine's own layers sit outside the content: `footage` (a shot's universal bg, inside the camera), `transition`
// (the cross-cut overlay, stage level) and `letterbox` (the bars, fixed to the frame) — a block can't use those names
// in a shot that has them.
const LAYER_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
function tagLayer(el, name, taken = null) {
  if (!LAYER_RE.test(String(name)) || name === 'background' || name === 'constructor') throw new Error(`layer name "${name}" must be lower-case letters, digits or - (it names a file; "background" and "constructor" are reserved)`);
  if (taken && taken.has(name)) throw new Error(`layer name "${name}" is the engine's own layer in this shot (its ${name === 'footage' ? 'bg footage' : name === 'letterbox' ? 'cinema bars' : name === 'carry' ? 'carried element' : 'transition overlay'}) — name the block's element something else`);
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
  vis(CARRY, !BG_ONLY && solo('carry'));            // a carried element is content: never in a background-only render
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
    // copy with *accent* markup; returns a div with .lv-txt; words are wrapped for reveal(); o.layer names its layer
    text(copy, o = {}) {
      const d = document.createElement('div'); d.className = 'lv-txt' + (o.cls ? ' ' + o.cls : '');
      const size = (o.size || 84) * u;
      d.style.cssText = `position:absolute;font-family:${ctx.font};font-weight:${o.weight || 700};font-size:${size}px;line-height:${o.lh || 1.04};letter-spacing:${o.ls ?? '-.035em'};
        color:${o.color || C.ink};text-align:${o.align || 'left'};white-space:${o.nowrap ? 'nowrap' : 'normal'};${o.maxW ? `width:${o.maxW}px;` : ''}${o.style || ''}`;
      d.dataset.size0 = size.toFixed(1);
      d.innerHTML = K.parseCopy(copy).map(p => p.br ? '<br>' : p.text.split(/(\s+)/).map(w => /^\s+$/.test(w) ? w : `<span class="lv-w" style="display:inline-block;${p.accent ? `color:${o.accent || C.accent}` : ''}">${A.esc(w)}</span>`).join('')).join('');
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
    reveal(d, t0, start = 0, per = 2.2, rise = 34) {
      const ws = d.querySelectorAll('.lv-w'), plan = K.revealPlan(ws.length, shot.Db ?? shot.D, start, per);   // compresses in short shots
      const t = ctx.entered === 'dive' ? K.diveTime(t0) : t0;      // after a dive the words arrive with it (K.diveTime)
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
    plates: Object.fromEntries(Object.entries(PLATES).map(([id, p]) => [id, { n: p.n, url: i => `${p.url}/${String(i).padStart(5, '0')}.jpg` }])),
    // this shot's footage frames for a field the block declares in `media:` (i = list index), or null (not footage)
    plate: (field, i = null) => ctx.plates[plateKey(shot.id, field, i)] || null,
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
  const src = bgOf(s), video = isVideo(src), plate = video ? PLATES[plateKey(s.id, 'bg')] : null;
  if (video && !plate) throw new Error(`shot ${s.id}: bg footage frames missing (run lv.mjs, which extracts them)`);
  const ns = 'http://www.w3.org/2000/svg', el = document.createElement('div'); el.className = 'lv-foot';
  el.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:clip;overflow-clip-margin:0px`;
  const svg = document.createElementNS(ns, 'svg');
  for (const [a, v] of [['width', 3 * W], ['height', 3 * H], ['viewBox', `0 0 ${3 * W} ${3 * H}`]]) svg.setAttribute(a, v);
  svg.style.cssText = `position:absolute;left:${-W}px;top:${-H}px;display:block`;
  const g = document.createElementNS(ns, 'g'), tiles = [];
  for (const j of [-1, 0, 1]) for (const i of [-1, 0, 1]) {
    const im = document.createElementNS(ns, 'image'), x = (i + 1) * W, y = (j + 1) * H;
    for (const [a, v] of [['x', x], ['y', y], ['width', W], ['height', H], ['preserveAspectRatio', 'xMidYMid slice']]) im.setAttribute(a, v);
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
  // an undecodable file (a truncated download, an HTML page or a HEIC saved as .jpg) stops the build: footage counts as
  // picture content in QA, so a broken image must never reach a frame
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
    if (i) await cutPrep(i);                       // round 2: the dive / flood of the cut into this shot, measured on the shot before
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
    if (!ALPHA && diveFrom(s)) {                   // a dive entrance starts at ×0.3: the background reaches past the frame (whole grid tiles)
      el.style.background = bgc;
      const T = (TL.brand.bg === 'dots' ? 36 : 60) * Math.min(W, H) / 1080, n = Math.ceil(1.5 * Math.max(W, H) / (diveFrom(s) * T));
      Object.assign(bg.style, { left: `${-.5 * W - n * T}px`, top: `${-.5 * H - n * T}px`, width: `${2 * W + 2 * n * T}px`, height: `${2 * H + 2 * n * T}px` });
    }
    const content = document.createElement('div'); content.className = 'lv-content';
    // a transparent border makes the content box 3W × 3H around the frame while children keep frame coordinates
    // (absolute children sit inside the border): content that overflows its box under the moving camera (tiles flung
    // out, a phone sliding in from below) makes Chrome start compositing the camera after a few frames and resample it —
    // history-dependent, so a layer pass could rasterise differently from the full frame
    content.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;border:solid transparent;border-width:${H}px ${W}px;margin:${-H}px 0 0 ${-W}px`;
    content.dataset.lvLayer = 'content';          // untagged elements inherit this fallback layer
    content.style.overflow = 'clip';              // and clipped each frame to what the camera can see (seek)
    if (!ALPHA && !(hasBg && diveFrom(s))) cam.appendChild(bg);     // (round 2: under a dive entrance the shot's colour is the underlay)
    const block = custom[s.block] || BLOCKS[s.block];
    if (!block) throw new Error(`unknown block "${s.block}" in shot ${s.id}`);
    const foot = hasBg ? await buildFoot(s, dark, block.bgDefaults || {}) : null;
    // round 2: under a dive entrance the footage gets its own camera, outside the dive's blur wrapper (seek: plateCam)
    const pcam = foot && diveFrom(s) ? el.appendChild(Object.assign(document.createElement('div'), { className: 'lv-pcam' })) : null;
    if (pcam) { pcam.style.cssText = cam.style.cssText; pcam.appendChild(foot.el); }
    else if (foot) cam.appendChild(foot.el);           // built in transparent renders too (hidden), for the `footage` layer pass
    cam.appendChild(content);
    if (BG_ONLY) content.style.visibility = 'hidden';
    el.appendChild(cam); stage.appendChild(el);
    if (!CLEAN && ((s.out === 'dive' && i < TL.shots.length - 1) || diveFrom(s))) {   // round 2: a dive's blur wrapper (seek)
      const dw = document.createElement('div'); dw.className = 'lv-dive';
      dw.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:clip`;
      el.insertBefore(dw, cam); dw.appendChild(cam);
    }
    const bar = K.letterboxBar(s.letterbox, W, H);
    // cross-cut overlays this shot takes part in (its exit, or the previous shot's into it)
    const xIn = i && K.XFX[TL.shots[i - 1].out] && TL.shots[i - 1].out, xOut = i < TL.shots.length - 1 && K.XFX[s.out] && s.out;
    const overlay = !CLEAN && [xIn, xOut].some(x => x && K.XFX[x].overlay);
    const taken = new Set([...(hasBg ? ['footage'] : []), ...(bar ? ['letterbox'] : []), ...([xIn, xOut].some(x => x && K.XFX[x].overlay) ? ['transition'] : [])]);
    if (carryTouches(i)) taken.add('carry');
    const prevOut = i ? TL.shots[i - 1].out : null;
    // the slow push keeps going the way the entrance zoom was going (a shrinking zoom-out entrance keeps shrinking):
    // an entrance zoom and a push in opposite directions cancel a few frames in and the shot stands still (QA: freeze)
    const dr = s.drift && typeof s.drift === 'object' ? s.drift : {}, enter0 = CLEAN ? { s: -.03 } : enterFor(prevOut, W, H, i === 0);
    const enter = !CLEAN && K.isDrift(prevOut) && dr.in != null ? scaleMove(enter0, Number(dr.in)) : enter0;
    const ctx = makeCtx(s, content, fam, dark, taken);
    // enter: how the camera arrives (px offsets in the block's own coordinates, decaying × decay per frame; s = scale)
    const z0 = perAspect(s.zoom) != null ? Number(perAspect(s.zoom)) : 1;
    ctx.enter = { dx: (enter.dx || 0) / z0, dy: (enter.dy || 0) / z0, s: enter.s || 0, decay: enter.decay ?? .8 };
    if (foot && block.bgMotion) foot.motion = block.bgMotion(ctx, s) || null;
    ctx.origin = await originFor(i, s, block, enter);   // round 2 `from:`: where this shot's cards are born (block px), or null
    // round 2: the layer a carry from the previous shot lands on (hidden until it lands) — a block may skip its own entrance
    ctx.carried = !CLEAN && i && TL.shots[i - 1].carry != null && !K.carryPlan(TL.shots[i - 1].carry).frame ? K.carryPlan(TL.shots[i - 1].carry).to : null;
    ctx.entered = !CLEAN && i && prevOut === 'dive' ? 'dive' : null;   // round 2: the dive flies this shot in (a block may skip its own entrance)
    // ('frame': the previous shot's morph to: frame filled the frame with this shot's colour — the end card rises out of it)
    if (!CLEAN && i && !ctx.entered && TL.shots[i - 1].carry != null && K.carryPlan(TL.shots[i - 1].carry).frame) ctx.entered = 'frame';
    el.style.display = 'block';
    const inst = await block.build(ctx, s);
    // every image the block placed must decode (a broken file would otherwise render as Chrome's broken-image icon)
    const broken = (await Promise.all([...content.querySelectorAll('img')].filter(im => im.getAttribute('src'))
      .map(im => im.decode().then(() => null, () => { const u = im.getAttribute('src').replace(/^\/job\//, ''); try { return decodeURIComponent(u); } catch { return u; } })))).filter(Boolean);
    if (broken.length) throw new Error(`shot ${s.id}: ${[...new Set(broken)].join(', ')} could not be decoded as an image — re-export it as .jpg/.png/.webp/.svg`);
    const layers = layerList(content);            // measured while the shot is laid out
    // the engine's own front layers (the footage layer goes under the content: lv.mjs adds it to opaque exports)
    if (carryTouches(i)) layers.layers.push({ name: 'carry', roots: 1, text: false });
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
    if (!CLEAN && i && prevOut === 'dive' && DIVES[i - 1]) camSpec.dive = { in: DIVES[i - 1] };   // (the out side is set once the pivot is measured)
    shots.push({ s, el, cam, inst, camSpec, ctx, layers, foot, bar, dark, hasBg, ...(pcam ? { pcam } : {}) });
  }
  // stage-level layers, created only when a shot uses them (a timeline without them builds exactly the old page)
  if (TL.shots.some((s, i) => carryTouches(i))) await carryPrep();     // round 2: CARRY goes above the shots, below the overlay and bars
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

// ── round 2: cross-cut continuity — dive · carry / morph · grow from a point · flood ─────────────────────────────────
// All opt-in: a timeline without carry / dive / flood / from: never reaches this code (no CARRY layer, no extra seeks).
// Pure in f: whatever a hand-off needs from other frames (the element's rectangle where a carry starts, the next shot's
// element where it lands, the outgoing shot's look at its last frame, a dive's pivot, a flood's origin, a from: origin)
// is measured ONCE at build by seeking those frames — the same sequence on every page, whatever order frames are drawn in.
const g2 = x => +Number(x).toFixed(2);
const stageXY = () => stage.getBoundingClientRect();
 // a shot entered by a dive: its starting scale (dive.from), else 0
const diveFrom = s => !CLEAN && s.i > 0 && TL.shots[s.i - 1].out === 'dive' ? K.clamp(Number((TL.shots[s.i - 1].dive || {}).from ?? .3), .1, .9) : 0;
const carryTouches = i => !CLEAN && ((i < TL.shots.length - 1 && TL.shots[i].carry != null) || (i > 0 && TL.shots[i - 1].carry != null));
// colours: '#RRGGBB' | 'rgb(…)' | 'rgba(…)' → [r, g, b, a]
function rgbaOf(c) {
  const s = String(c || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)).concat(1);
  const m = s.match(/rgba?\(([^)]*)\)/i); if (!m) return [0, 0, 0, 0];
  const v = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return [v[0] || 0, v[1] || 0, v[2] || 0, v.length > 3 ? v[3] : 1];
}
const relLum = ([r, g, b]) => { const f = x => { x /= 255; return x <= .04045 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
const contrast = (a, b) => { const x = relLum(a), y = relLum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const css = c => `rgba(${c.slice(0, 3).map(v => Math.round(v)).join(',')},${(+c[3]).toFixed(3)})`;
// the elements a layer name tags in a shot (its roots: tagged elements not inside another element of that layer)
function rootsOf(sh, name, what) {
  const all = [...sh.ctx.root.querySelectorAll(`[data-lv-layer="${CSS.escape(name)}"]`)];
  const roots = all.filter(e => { for (let n = e.parentElement; n && n !== sh.ctx.root; n = n.parentElement) if (n.dataset.lvLayer === name) return false; return true; });
  if (!roots.length) throw new Error(`${what} "${name}" — shot ${sh.s.id} (${sh.s.block}) has no layer of that name (its layers: ${sh.layers.layers.map(l => l.name).filter(n => !['content', 'carry', 'transition', 'letterbox'].includes(n)).join(', ') || 'none'})`);
  return roots;
}
// what the roots draw on screen now (stage px): the union of every painting element under them (a full-width flex row
// of buttons measures as its buttons), skipping hidden and fully transparent parts. An <svg> viewport or <g> with shapes
// in it measures as its shapes (a full-frame overlay svg — the wall grid's lit stroke, the particles' orbits, the map's
// route — would otherwise measure as the whole frame); defs, masks, clips, filters and gradients draw nothing themselves.
// A soft glow a block marks data-lv-soft (its box fades to nothing well inside its edges: press's halo, the particles'
// core glow) doesn't count either — measured, it put a flood's spot and a from: card off the pressed control
const SVG_NODRAW = /^(defs|mask|clippath|filter|lineargradient|radialgradient|pattern|symbol|marker|style|title|desc|metadata|script)$/;
function visualRect(roots) {
  const sr = stageXY(); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const cut = (r, c) => ({ left: Math.max(r.left, c.left), top: Math.max(r.top, c.top), right: Math.min(r.right, c.right), bottom: Math.min(r.bottom, c.bottom) });
  const add = r => { if (r.right - r.left < .5 || r.bottom - r.top < .5) return; x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); };
  const walk = (el, clip) => {           // clip: what overflow: hidden / clip ancestors (inside the roots) let show
    const svgTag = el instanceof SVGElement ? el.localName.toLowerCase() : null;
    if (svgTag && SVG_NODRAW.test(svgTag)) return;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (cs.display === 'none' || Number(cs.opacity) === 0) return;
    const group = (svgTag === 'svg' || svgTag === 'g') && el.children.length > 0;
    if (!group && !el.hasAttribute('data-lv-soft') && cs.visibility !== 'hidden' && (el.classList.contains('lv-txt') || paints(el))) add(cut(r, clip));
    const inner = cs.overflowX !== 'visible' || cs.overflowY !== 'visible' ? cut(r, clip) : clip;
    for (const ch of el.children) walk(ch, inner);
  };
  roots.forEach(r => walk(r, { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity }));
  if (!Number.isFinite(x0)) for (const r of roots) add(r.getBoundingClientRect());
  if (!Number.isFinite(x0)) return { x: W / 2, y: H / 2, w: 1, h: 1 };
  return { x: g2(x0 - sr.left), y: g2(y0 - sr.top), w: g2(x1 - x0), h: g2(y1 - y0) };
}
const effOpacity = el => { if (getComputedStyle(el).visibility === 'hidden') return 0; let o = 1; for (let n = el; n && n !== stage; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; };
// a copy of the roots as they look now, inside shallow copies of their ancestors (shot, camera, wrappers), so every
// transform, perspective and inherited style is exactly the original's; no camera blur, no clips, ids renamed (a copy's
// url(#…) must not resolve to the original's defs), no layer tags (the copy is drawn on the carry layer)
function ghostOf(sh, roots, tag) {
  const map = new Map(), top = sh.el.cloneNode(false);
  top.className = 'lv-ghost'; top.style.display = 'block'; top.style.overflow = 'visible'; top.style.background = 'none';
  map.set(sh.el, top);
  const up = el => { if (map.has(el)) return map.get(el); const pc = el.cloneNode(false); up(el.parentElement).appendChild(pc); map.set(el, pc); return pc; };
  const clones = roots.map(r => {
    const rc = r.cloneNode(true); up(r.parentElement).appendChild(rc);
    const oc = [r, ...r.querySelectorAll('canvas')].filter(e => e.tagName === 'CANVAS'), cc = [rc, ...rc.querySelectorAll('canvas')].filter(e => e.tagName === 'CANVAS');
    oc.forEach((c, j) => { try { cc[j].getContext('2d').drawImage(c, 0, 0); } catch { /* a tainted or empty canvas stays blank */ } });
    return rc;
  });
  // an element laid out in flow (a flex lockup's logo or name: title, endcard) keeps its place in the copy: its in-flow
  // siblings come along, invisible — a shallow copy of the row with the element alone re-centred it there, so the copy
  // drew off its rectangle (title → endcard logo: ~225 px, then a jump on landing). Absolutely placed elements (most
  // blocks' carried layers) have no in-flow siblings to keep: their copies are unchanged.
  const cloneOf = new Map([...map, ...roots.map((r, k) => [r, clones[k]])]);
  const flowing = e => { const cs = getComputedStyle(e); return cs.display !== 'none' && cs.position !== 'absolute' && cs.position !== 'fixed'; };
  const rows = new Set([...cloneOf.keys()].filter(e => e !== sh.el && e.parentElement && cloneOf.has(e.parentElement) && flowing(e)).map(e => e.parentElement));
  for (const P of rows) cloneOf.get(P).replaceChildren(...[...P.children].flatMap(c => {
    if (cloneOf.has(c)) return [cloneOf.get(c)];
    if (!flowing(c)) return [];
    const h = c.cloneNode(true); h.style.visibility = 'hidden'; h.style.opacity = '0'; return [h];
  }));
  if (map.get(sh.cam)) map.get(sh.cam).style.filter = 'none';
  const dwc = map.get(sh.cam.parentElement); if (dwc && dwc !== top) { dwc.style.filter = 'none'; dwc.style.overflow = 'visible'; }
  const cont = map.get(sh.ctx.root);
  // (no 3W × 3H transparent border either: the copy's box is the frame, so a lift shadow filters a frame, not 9)
  if (cont) { cont.classList.remove('lv-content'); Object.assign(cont.style, { overflow: 'visible', visibility: '', border: '0', margin: '0' }); }
  const ids = new Map();
  for (const e of top.querySelectorAll('[id]')) { const n = `${e.id}-lvc${tag}`; ids.set(e.id, n); e.id = n; }
  const idRe = ids.size ? new RegExp(`#(${[...ids.keys()].map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?=[)"'\\s]|$)`, 'g') : null;
  for (const e of [top, ...top.querySelectorAll('*')]) {
    for (const a of ['data-lv-layer', 'data-lv-carried', 'data-id', 'data-fit', 'data-size0']) e.removeAttribute(a);
    if (idRe) for (const a of [...e.attributes]) if (a.value.includes('#')) { const v = a.value.replace(idRe, (_, id) => '#' + ids.get(id)); if (v !== a.value) e.setAttribute(a.name, v); }
  }
  return { node: top, roots: clones };
}
// the copy of `el` (a descendant of one of `roots`) inside a ghost
function twin(g, roots, el) {
  const ri = roots.findIndex(r => r === el || r.contains(el)); if (ri < 0) return null;
  const path = []; for (let n = el; n !== roots[ri]; n = n.parentElement) path.unshift([...n.parentElement.children].indexOf(n));
  let t = g.roots[ri]; for (const j of path) t = t && t.children[j]; return t || null;
}
// what an element shows (its pictures and text): two carried things with the same key look the same
const lookKey = roots => JSON.stringify(roots.map(r => [r.textContent.replace(/\s+/g, ' ').trim(), [...r.querySelectorAll('img, image')].map(e => e.getAttribute('src') || e.getAttribute('href') || '')]));
// a morph's box: the element itself or its first painting descendant — rectangle (stage px), radius, colour, and its whole
// box-shadow (every layer, lengths × its on-screen scale) — 'none' when it has none. A soft glow (data-lv-soft: press's
// halo) and SVG defs / masks / gradients are never the box (the same test visualRect uses): press's halo, 1.8 × the
// button, became a translucent slab over it on the morph's first frame (review fix #2). paint: false = nothing under the
// roots draws a box (a text layer) — carryPrep refuses such a morph
function boxOf(roots) {
  const clear = c => rgbaOf(c)[3] < .01, skip = e => e.closest('[data-lv-soft]') || (e instanceof SVGElement && SVG_NODRAW.test(e.localName.toLowerCase()));
  let el = null;
  for (const r of roots) { for (const e of [r, ...r.querySelectorAll('*')]) { if (skip(e)) continue; const cs = getComputedStyle(e); if (cs.display !== 'none' && (!clear(cs.backgroundColor) || cs.backgroundImage !== 'none')) { el = e; break; } } if (el) break; }
  const paint = !!el;
  el ||= roots[0];
  const cs = getComputedStyle(el), sr = stageXY(), r = el.getBoundingClientRect(), k = el.offsetWidth ? r.width / el.offsetWidth : 1;
  const rad = (v, size) => /%$/.test(v) ? parseFloat(v) / 100 * size : parseFloat(v) || 0;
  const radius = Math.min(rad(cs.borderTopLeftRadius, el.offsetWidth) * k, r.width / 2, r.height / 2);
  let color = rgbaOf(cs.backgroundColor);
  // a gradient box: the mean of its stops (its first stop alone — a button's light top edge — made the morph's box pale)
  if (color[3] < .01 && cs.backgroundImage !== 'none') { const st = (cs.backgroundImage.match(/rgba?\([^)]*\)/g) || ['rgba(255,255,255,1)']).map(rgbaOf); color = [0, 1, 2, 3].map(j => st.reduce((a, c) => a + c[j], 0) / st.length); }
  const shadow = cs.boxShadow === 'none' ? 'none' : cs.boxShadow.replace(/(-?\d*\.?\d+)px/g, (_, v) => `${(v * k).toFixed(2)}px`);
  return { el, paint, rect: { x: g2(r.left - sr.left), y: g2(r.top - sr.top), w: g2(r.width), h: g2(r.height) }, radius, color, shadow };
}
// a carried layer's companions: a block can tag a layer root data-lv-with="label" when that layer only reads with another
// (press: the control's face and its label are two layers with one box) — a carry or morph of it takes both along, so the
// label never stays behind (review fix #2)
const withRoots = (sh, roots) => [...roots, ...roots.flatMap(r => String(r.dataset.lvWith || '').split(/\s+/).filter(Boolean)).flatMap(n => {
  const all = [...sh.ctx.root.querySelectorAll(`[data-lv-layer="${CSS.escape(n)}"]`)];
  return all.filter(e => !roots.includes(e) && !all.some(o => o !== e && o.contains(e)));
})];
// a morph's content copies show the element's content, not its soft glow (the box is the morph's own); the glow gets a
// copy of its own (everything else hidden), drawn under the box and faded out as the morph starts — removed in one
// frame, press's halo popped off the button the moment the morph took over
const hideSoft = g => { for (const e of g.node.querySelectorAll('[data-lv-soft]')) e.style.display = 'none'; };
function softGhost(sh, roots, tag) {
  if (!roots.some(r => r.matches('[data-lv-soft]') || r.querySelector('[data-lv-soft]'))) return null;
  const g = ghostOf(sh, roots, tag);
  for (const e of [g.node, ...g.node.querySelectorAll('*')]) e.style.visibility = 'hidden';
  for (const e of g.node.querySelectorAll('[data-lv-soft], [data-lv-soft] *')) e.style.visibility = 'visible';
  return g;
}
// a morph's content copies leave the box itself to the morph (no second background, shadow or border inside it)
function stripBox(g, roots, el) { const t = twin(g, roots, el); if (t) Object.assign(t.style, { background: 'none', boxShadow: 'none', borderColor: 'transparent', backdropFilter: 'none', webkitBackdropFilter: 'none' }); }
// the next shot's element measured where the carry lands, with that shot's camera then; the outgoing one where it leaves
async function carryPrep() {
  if (CLEAN || BG_ONLY) return;
  CARRY = document.createElement('div'); CARRY.className = 'lv-carry';
  CARRY.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden;pointer-events:none;display:none`;
  stage.appendChild(CARRY);
  document.head.appendChild(document.createElement('style')).textContent = '[data-lv-carried], [data-lv-carried] * { visibility: hidden !important; }';
  for (let k = 0; k < shots.length - 1; k++) {
    const s = shots[k].s; if (s.carry == null) continue;
    const A = shots[k], B = shots[k + 1], P = K.carryPlan(s.carry), cut = s.f1, n = CARRIES.length;
    const c = { k, A, B, P, n, cut, a0: cut - P.pre - .5, fc: cut - .25, fL: cut + P.post };
    c.ease = peakOn(P.needle ? K.needle : K.smooth, (c.fc - c.a0) / (c.fL - c.a0));   // its fastest frame on the cut, whatever pre / post
    c.rootsA = withRoots(A, rootsOf(A, P.el, `carry from ${A.s.id}: el`));
    c.rootsB = P.frame ? [] : withRoots(B, rootsOf(B, P.to, `carry ${A.s.id} → ${B.s.id}: to`));
    await seek(c.a0); c.R0 = visualRect(c.rootsA);
    // a morph needs a box on both sides: from a text layer the box is transparent, so the morph drew a grey slab that then
    // faded out by opacity (review fix #5)
    const noBox = (sh, name) => new Error(`carry ${A.s.id} → ${B.s.id}: a morph needs a box on both sides — "${name}" in ${sh.s.id} (${sh.s.block}) draws none (text only); use mode: carry, or morph ${sh === A ? 'from' : 'to:'} a card, pill, button, panel or prompt-box${sh === A ? '' : ' (or to: frame)'}`);
    if (P.morph) { c.boxA = boxOf(c.rootsA); if (!c.boxA.paint) throw noBox(A, P.el); c.gA = ghostOf(A, c.rootsA, `${n}a`); stripBox(c.gA, c.rootsA, c.boxA.el); hideSoft(c.gA); c.gAs = softGhost(A, c.rootsA, `${n}s`); }
    await seek(cut - .5); c.Rlast = visualRect(c.rootsA); c.keyA = lookKey(c.rootsA);
    if (!P.morph) c.gZ = ghostOf(A, c.rootsA, `${n}z`);
    if (!P.frame) {
      await seek(c.fL); c.R1 = visualRect(c.rootsB);
      const op = Math.min(...c.rootsB.map(effOpacity));
      if (op < .9) throw new Error(`carry ${A.s.id} → ${B.s.id}: "${P.to}" is only ${Math.round(op * 100)} % visible where the carry lands (${P.post} frames into ${B.s.id}) — land later with post: N or carry another element`);
      if (P.morph) { c.boxB = boxOf(c.rootsB); if (!c.boxB.paint) throw noBox(B, P.to); c.gB = ghostOf(B, c.rootsB, `${n}b`); stripBox(c.gB, c.rootsB, c.boxB.el); hideSoft(c.gB); }
      else c.gL = ghostOf(B, c.rootsB, `${n}L`);     // B's element as it looks where it lands: the copy after the cut
      c.keyB = lookKey(c.rootsB);
    } else {
      c.R1 = { x: 0, y: 0, w: W, h: H };
      c.boxB = { rect: c.R1, radius: 0, color: rgbaOf(s.carry.color || (B.dark ? TL.brand.colors.dark : TL.brand.colors.bg)), shadow: 'none' };
    }
    // a carry: A's element until the cut, then B's as it looks where it lands — so the landing is exact and the real
    // element simply takes over (no crossfade, no double). The same thing on both sides (same pictures and text, in a box
    // of the same shape) switches on the cut frame; two different things blend through a blur peak on the cut while the
    // path's box goes from A's shape to B's. The same picture in a box of another shape is another look (qa1 H2: launch30's
    // landscape result card → the split's square, tilted after card switched shape and crop in one frame): it blends too.
    // A morph lands on B's box exactly too.
    const aspect = R => Math.log(Math.max(1e-6, R.w) / Math.max(1e-6, R.h));
    c.same = c.keyA === c.keyB && Math.abs(aspect(c.Rlast) - aspect(c.R1)) < Math.log(1.1);
    CARRIES.push(c);
  }
  await Promise.all(CARRIES.flatMap(c => [c.gA, c.gAs, c.gB, c.gZ, c.gL].filter(Boolean)).flatMap(g => [...g.node.querySelectorAll('img')].map(im => im.decode().catch(() => null))));
  CARRY_ON = true;
}
// a carry's path at progress e: the centre on a gentle arc (bowing up), width and height each log-interpolated (A's box
// → B's), × the lift (eased up over the first ~5 frames, back down by landing)
function carryRect(c, e, f) {
  const { R0, R1, P } = c, x0 = R0.x + R0.w / 2, y0 = R0.y + R0.h / 2, dx = R1.x + R1.w / 2 - x0, dy = R1.y + R1.h / 2 - y0, L = Math.hypot(dx, dy) || 1;
  let nx = -dy / L, ny = dx / L; if (ny > 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }
  const up = Math.min(5, (c.fL - c.a0) / 3), b = P.arc * L * 4 * e * (1 - e), lift = 1 + (P.lift - 1) * K.smoothstep(c.a0, c.a0 + up, f) * (1 - K.smoothstep(c.fL - 6, c.fL, f));
  const w = Math.exp(K.lerp(Math.log(R0.w), Math.log(R1.w), e)) * lift, h = Math.exp(K.lerp(Math.log(R0.h), Math.log(R1.h), e)) * lift;
  return { x: x0 + dx * e + nx * b - w / 2, y: y0 + dy * e + ny * b - h / 2, w, h, lift };
}
// a morph's progress: a cusp — accelerating (in(3)) into the cut, decelerating (out(3)) after, the same speed on both sides
// of the joint (cut − ¼: half-way between the last frame before the cut and the first after it, as 60-fps frames sit)
function cusp(c, f) {
  const A = (c.fc - c.a0) / (c.fL - c.a0);
  if (f < c.fc) { const p = K.clamp((f - c.a0) / (c.fc - c.a0)); return A * p * p * p; }
  const q = K.clamp((f - c.fc) / (c.fL - c.fc)); return A + (1 - A) * (1 - Math.pow(1 - q, 3));
}
// an easing re-timed (τ → τ^p) so its fastest moment falls at τc (the cut's place in the carry window): a carry's speed
// peaks on the cut for any pre / post. p by bisection on the sampled peak — deterministic, computed once per carry
function peakOn(ease, tc) {
  const peak = p => { let best = -1, at = 0; for (let j = 1; j < 1000; j++) { const a = Math.pow((j - .5) / 1000, p), b = Math.pow((j + .5) / 1000, p), v = ease(b) - ease(a); if (v > best) { best = v; at = j / 1000; } } return at; };
  let lo = .25, hi = 4; for (let i = 0; i < 30; i++) { const m = Math.sqrt(lo * hi); if (peak(m) < tc) lo = m; else hi = m; }
  const p = Math.sqrt(lo * hi);
  return x => ease(Math.pow(K.clamp(x), p));
}
// a ghost drawn so that its rectangle R lands on rectangle P (uniform scale about the centres, same area) on the carry
// layer; stretch: width and height each (the two looks of a carry between different things share one outline)
function placed(g, R, P, { x = 0, y = 0, extra = '', stretch = false } = {}) {
  const w = document.createElement('div'), k = Math.sqrt((P.w * P.h) / Math.max(1e-6, R.w * R.h));
  const kx = stretch ? P.w / Math.max(1e-6, R.w) : k, ky = stretch ? P.h / Math.max(1e-6, R.h) : k;
  const tx = P.x + P.w / 2 - kx * (R.x + R.w / 2) - x, ty = P.y + P.h / 2 - ky * (R.y + R.h / 2) - y;
  w.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0;transform:translate(${tx.toFixed(3)}px,${ty.toFixed(3)}px) scale(${stretch ? `${kx.toFixed(6)},${ky.toFixed(6)}` : k.toFixed(6)});${extra}`;
  w.appendChild(g.node);
  return { w, k };
}
async function carryAt(f, k) {
  for (const e of shots[k].el.querySelectorAll('[data-lv-carried]')) delete e.dataset.lvCarried;   // every frame decides afresh
  const c = CARRY_ON ? CARRIES.find(x => f >= x.a0 && f < x.fL) : null;
  if (!c) { if (CARRY.firstChild) CARRY.replaceChildren(); CARRY.style.display = 'none'; return; }
  const P = c.P, inA = k === c.k, u = Math.min(W, H) / 1080;
  let out, rect, alpha = 1;
  if (!P.morph) {
    // A's element (live before the cut, its last frame after) and B's as it lands, each placed on the path's box; the same
    // thing (uniform scale, same area) switches on the cut; two different things are each stretched onto the box (one
    // outline whose shape goes from A's to B's — no double edges) and blend through a blur peak on the cut
    rect = carryRect(c, c.ease(K.clamp((f - c.a0) / (c.fL - c.a0))), f);
    // (the blend sits on the blur peak, B whole under A from half a frame before the cut and A gone half a frame after
    // it: a 3.5-frame blend left A's text ghosting over B's picture for two frames after the cut — qa1 M8)
    const wA = c.same ? (inA ? 1 : 0) : 1 - K.smoothstep(c.cut - 1.5, c.cut + .5, f), wB = c.same ? (inA ? 0 : 1) : K.smoothstep(c.cut - 2, c.cut - .5, f);
    const lk = K.clamp((rect.lift - 1) / Math.max(1e-6, P.lift - 1)), sig = c.same ? 0 : 6 * u * Math.exp(-Math.pow((f - c.fc) / 1.6, 2));
    const fl = [sig > .05 ? `blur(${sig.toFixed(3)}px)` : '', lk > .001 ? `drop-shadow(0 ${(18 * u * lk).toFixed(2)}px ${(30 * u * lk).toFixed(2)}px rgba(10,12,24,${(.3 * lk).toFixed(3)}))` : ''].filter(Boolean).join(' ');
    out = document.createElement('div');
    out.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px${fl ? `;filter:${fl}` : ''}`;
    const st = !c.same;
    if (wB > .002) out.appendChild(placed(c.gL, c.R1, rect, { stretch: st, extra: wB < .998 ? `opacity:${wB.toFixed(3)}` : '' }).w);
    if (wA > .002) out.appendChild(inA ? placed(ghostOf(c.A, c.rootsA, `${c.n}l`), visualRect(c.rootsA), rect, { stretch: st, extra: wA < .998 ? `opacity:${wA.toFixed(3)}` : '' }).w
      : placed(c.gZ, c.Rlast, rect, { stretch: st, extra: `opacity:${wA.toFixed(3)}` }).w);
  } else {
    // morph: one box whose rectangle (size, not scale), radius and colour go from A's box to B's, the two boxes' own shadows
    // (every layer) crossfading under it; the two contents (A's at its first frame, B's where it lands), each scaled to fit,
    // crossfade through a soft blur half-way. At landing the box is B's box exactly, shadow included: the real element
    // takes over on the next frame (a crossfade there doubled a caret that keeps typing, a ring shadow, the box edge)
    const A0 = c.boxA, B1 = c.boxB;
    const lam = P.frame ? (f >= c.cut ? 1 : K.inQuad(K.clamp((f - c.a0) / (c.cut - c.a0)))) : cusp(c, f);
    if (P.frame && f >= c.cut) alpha = K.clamp(1 - (f - c.cut + 1) / (P.post + 1));
    const ra = A0.rect, rb = B1.rect, x0 = ra.x + ra.w / 2, y0 = ra.y + ra.h / 2, dx = rb.x + rb.w / 2 - x0, dy = rb.y + rb.h / 2 - y0, L = Math.hypot(dx, dy) || 1;
    let nx = -dy / L, ny = dx / L; if (ny > 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }
    const bow = (P.frame ? 0 : P.arc) * L * 4 * lam * (1 - lam);
    const w = Math.exp(K.lerp(Math.log(ra.w), Math.log(rb.w), lam)), h = Math.exp(K.lerp(Math.log(ra.h), Math.log(rb.h), lam));   // log size: its relative speed peaks on the cut
    // the colour leads the size a little; into the frame the box takes the next colour while it is still small (a fill
    // grows in its own colour — a large mid-grey slab read as a loading placeholder)
    const lc = P.frame ? K.smoothstep(.02, .3, lam) : K.clamp(lam * 1.2), color = A0.color.map((v, j) => K.lerp(v, B1.color[j], lc));
    rect = { x: x0 + dx * lam + nx * bow - w / 2, y: y0 + dy * lam + ny * bow - h / 2, w, h };
    const pos = `position:absolute;left:${rect.x.toFixed(2)}px;top:${rect.y.toFixed(2)}px;width:${rect.w.toFixed(2)}px;height:${rect.h.toFixed(2)}px;border-radius:${K.lerp(A0.radius, B1.radius, lam).toFixed(2)}px`;
    out = document.createElement('div');
    out.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px${alpha < .999 ? `;opacity:${alpha.toFixed(3)}` : ''}`;
    for (const [sh, o] of [[A0.shadow, 1 - lam], [B1.shadow, lam]]) if (sh !== 'none' && o > .002) out.appendChild(Object.assign(document.createElement('div'), { style: `${pos};box-shadow:${sh}${o < .998 ? `;opacity:${o.toFixed(3)}` : ''}` }));
    const d = out.appendChild(document.createElement('div'));
    d.style.cssText = `${pos};overflow:hidden;background:${css(color)}`;
    const blur = 6 * u * Math.exp(-Math.pow((lam - .5) / .17, 2));
    const content = (g, S, op) => {
      if (!g || op < .002) return;
      const kf = Math.min(rect.w / S.w, rect.h / S.h), Pf = { x: rect.x + rect.w / 2 - S.w * kf / 2, y: rect.y + rect.h / 2 - S.h * kf / 2, w: S.w * kf, h: S.h * kf };
      const p = placed(g, S, Pf, { x: rect.x, y: rect.y });
      p.w.style.opacity = op.toFixed(3); if (blur > .05) p.w.style.filter = `blur(${(blur / p.k).toFixed(3)}px)`;
      d.appendChild(p.w);
    };
    content(c.gA, A0.rect, P.frame ? 1 - K.smoothstep(.02, .28, lam) : 1 - K.smoothstep(.3, .6, lam));
    const so = c.gAs ? 1 - K.smoothstep(0, .3, lam) : 0;
    if (so > .002) {         // A's soft glow, unclipped under the box, riding with A's content and fading out
      const S = A0.rect, kf = Math.min(rect.w / S.w, rect.h / S.h), p = placed(c.gAs, S, { x: rect.x + rect.w / 2 - S.w * kf / 2, y: rect.y + rect.h / 2 - S.h * kf / 2, w: S.w * kf, h: S.h * kf });
      p.w.style.opacity = so.toFixed(3); out.insertBefore(p.w, out.firstChild);
    }
    if (!P.frame) content(c.gB, B1.rect, K.smoothstep(.4, .7, lam));
  }
  if (inA) for (const e of c.rootsA) e.dataset.lvCarried = '';
  else for (const e of c.rootsB) e.dataset.lvCarried = '';
  CARRY.style.display = 'block';
  CARRY.replaceChildren(out);
  await Promise.all([...CARRY.querySelectorAll('img')].map(im => im.complete ? null : im.decode().catch(() => null)));
  // the carried thing's screen rectangle (cut checks); a morph that has filled the frame is the next shot's background now
  if (!(P.frame && f >= c.cut)) CAM.carry = { x: g2(rect.x), y: g2(rect.y), w: g2(rect.w), h: g2(rect.h) };
}
// a dive: a screen-space zoom about the pivot P after the shot's own camera (P stays put). out = the last DIVE_LEN frames
// zoom ×1 → ×Z in log space on an expo-in (fastest on the cut); in = the next shot starts at ×s0 and grows to ×1 over
// L frames on an expo-out whose first log-speed is ~0.75 × the dive's last (it keeps flying forward, never shrinks)
const diveIn = v => (1 - Math.pow(2, -10 * v)) / (1 - Math.pow(2, -10));
function diveCam(c, dv, t, D, tr) {
  for (const side of ['in', 'out']) {              // a shot can arrive on a dive and leave on another
    const d = dv[side]; if (!d) continue;
    const P = d.P || { x: W / 2, y: H / 2 };
    const z = side === 'out' ? Math.exp(Math.log(d.Z) * K.expoIn(K.clamp((tr - (D - K.DIVE_LEN)) / K.DIVE_LEN, 0, 1.08)))
      : t < d.L ? Math.exp(Math.log(d.s0) * (1 - diveIn(K.clamp(t / d.L)))) : 1;
    c.x = c.x * z + (P.x - W / 2) * (1 - z); c.y = c.y * z + (P.y - H / 2) * (1 - z); c.s *= z;
  }
}
// the footage camera of a shot entered by a dive: the shot's camera without the dive, pushed ×1 → ×PLATE_PUSH about the
// dive's pivot on the dive entrance's out-curve — the plate keeps flying forward with the rest, slower (it is far); a
// plate at the UI's ×0.3 would show its edges (a picture in a picture), one held at ×1 stopped the move dead on the cut
const PLATE_PUSH = 1.15;
function plateCam(sh, g) {
  const D = sh.s.D, Db = sh.s.Db ?? D, t = holdMap(sh.s, g - sh.s.f0), d = sh.camSpec.dive.in, P = d.P;
  const c = cameraAt({ ...sh.camSpec, dive: null }, t, D, g - sh.s.f0, Db), z = Math.exp(Math.log(PLATE_PUSH) * diveIn(K.clamp(t / d.L)));
  c.x = c.x * z + (P.x - W / 2) * (1 - z); c.y = c.y * z + (P.y - H / 2) * (1 - z); c.s *= z;
  return c;
}
// the cut into shot i, measured on shot i − 1 before shot i is built: a dive's pivot (its target where the zoom starts)
// and the next shot's entrance length; a flood's origin (what was pressed, where the flood starts) and colour
async function cutPrep(i) {
  if (CLEAN) return;
  const A = shots[i - 1], a = A.s, B = TL.shots[i];
  if (a.out === 'dive') {
    // (a block may ask for a bigger first scale when from: isn't set — particles: thin dots at ×.3 under the dive's blur
    // landed as a dim blob on a near-black frame, qa1 M4)
    const d = a.dive || {}, s0u = K.clamp(Number(d.from ?? (BLOCKS[B.block] || {}).diveFrom ?? .3), .1, .9);
    let P, Z = K.clamp(Number(d.zoom ?? 8), 1.5, 16), fill = null;
    if (d.el != null) {
      await seek(Math.max(a.f0, a.f1 - K.DIVE_LEN)); const R = visualRect(rootsOf(A, String(d.el), `dive from ${a.id}: el`)); P = { x: R.x + R.w / 2, y: R.y + R.h / 2 };
      // into an element the camera stops at 1.3 × the zoom where it covers the frame (about its centre, which stays put):
      // deeper only flies through a featureless blur of its middle
      fill = Math.max(2 * Math.max(P.x, W - P.x) / Math.max(1, R.w), 2 * Math.max(P.y, H - P.y) / Math.max(1, R.h));
      Z = K.clamp(Math.min(Z, 1.3 * fill), 1.5, 16);
    }
    else { const at = d.at || [.5, .5]; P = { x: Number(at[0]) * W, y: Number(at[1]) * H }; }
    const kk = 3.2, vA = Math.log(Z) * kk * Math.exp(kk) / (Math.exp(kk) - 1) / K.DIVE_LEN, g0 = 10 * Math.LN2 / (1 - Math.pow(2, -10));
    // B's entrance lasts as long as its first log-speed needs to be .75 × A's last (8–30 frames); a shallow dive that
    // would need longer starts B nearer ×1 instead (its first step never faster than A's last)
    const s0 = g2(Math.max(s0u, Math.exp(-.75 * vA * 30 / g0))), L = K.clamp(g0 * Math.abs(Math.log(s0)) / (.75 * vA), 8, 30);
    DIVES[i - 1] = { Z: g2(Z), s0, L: g2(L), P: { x: g2(P.x), y: g2(P.y) }, speedRatio: g2(g0 * Math.abs(Math.log(s0)) / L / vA), ...(fill ? { fill: g2(fill) } : {}) };
    A.camSpec.dive = { ...(A.camSpec.dive || {}), out: DIVES[i - 1] };
  }
  if (a.out === 'flood') {
    const d = a.flood || {};
    let O;
    // from a layer: its centre, or `spot` = a point inside it (fractions of its box, e.g. the Send button at [0.93, 0.78])
    if (d.from != null && !Array.isArray(d.from)) { await seek(Math.max(a.f0, a.f1 - K.XFX.flood.pre)); const R = visualRect(rootsOf(A, String(d.from), `flood from ${a.id}: from`)), sp = d.spot || [.5, .5]; O = { x: R.x + R.w * Number(sp[0]), y: R.y + R.h * Number(sp[1]) }; }
    else { const at = d.from || [.5, .5]; O = { x: Number(at[0]) * W, y: Number(at[1]) * H }; }
    const Bdark = bgOf(B) ? B.theme !== 'light' : B.theme === 'dark', Bc = Bdark ? TL.brand.colors.dark : TL.brand.colors.bg, color = String(d.color || Bc);
    FLOODS[i - 1] = { O: { x: g2(O.x), y: g2(O.y) }, color, rgb: rgbaOf(color), flat: !bgOf(B) && color.toLowerCase() === Bc.toLowerCase() };
  }
}
// `from:` → ctx.origin: the previous shot's element centre at its last frame (or [x, y] of the frame), in this shot's own
// coordinates at its first frame (the entering camera undone: entrance move, camera fields, a dive's ×0.3)
async function originFor(i, s, block, enter) {
  const o = K.originOf(s, block);
  // (the first shot has nothing to grow out of: --grid warns). Clean --clips / --layers exports draw no cross-cut device
  // (no carry, dive or flood), so no from: either — the element it grew out of isn't in the clip; the block makes its own
  // entrance there (docs pass Ask 2, decided in the review fixes)
  if (o == null || !i || CLEAN) return null;
  let P;
  if (Array.isArray(o)) P = { x: Number(o[0]) * W, y: Number(o[1]) * H };
  else {
    const A = shots[i - 1]; await seek(A.s.f1 - .5); const R = visualRect(rootsOf(A, String(o), `${s.id} from:`)), F = FLOODS[i - 1];
    // after a flood the layer is under the colour by the cut (the last frames before it are solid): a card born at its
    // size and place popped in whole out of a flat frame (qa1 H1: from: control / prompt-box). There the cards are born
    // at a point — the flood's origin, where the colour poured from and the eye still is — and grow as from [x, y]
    P = F ? { x: F.O.x, y: F.O.y } : { x: R.x + R.w / 2, y: R.y + R.h / 2, w: R.w, h: R.h };
  }
  const view = viewFor(s, W, H), dv = !CLEAN && i && TL.shots[i - 1].out === 'dive' && DIVES[i - 1] ? { in: DIVES[i - 1] } : null;
  const c = cameraAt({ enter, exit: {}, exitLen: 0, push: 0, ...(view ? { view } : {}), ...(dv ? { dive: dv } : {}) }, 0, s.D);
  // (w, h: the element's size there, in block px — K.grow starts cards born out of a big element big)
  return { x: g2(W / 2 + (P.x - W / 2 - c.x) / c.s), y: g2(H / 2 + (P.y - H / 2 - c.y) / c.s), ...(P.w ? { w: g2(P.w / c.s), h: g2(P.h / c.s) } : {}), screen: { x: g2(P.x), y: g2(P.y) } };
}
// flood: three wobbling soft-edged circles (420 px feather at 1080) of the next background's colour grow from the origin
// (r ∝ p²: fastest on the cut) so that the visible front (the solid core + about half the feather) reaches the farthest
// corner exactly on the cut — the picture keeps changing up to the cut, which completes the cover; an iridescent fringe
// rides the front; after the cut the colour fades over the next shot unless it is that same flat colour. A's text that
// would read dark-on-dark under the half-covering front is masked by the front itself (floodMask): it goes exactly where
// the colour arrives — no patches, no boxes.
const MASK_PROPS = ['maskImage', 'maskSize', 'maskPosition', 'maskRepeat', 'maskClip'];
let FMASK = [];                                      // [element, its mask styles before] — restored at the next seek
function unmaskFlood() { for (const [e, v] of FMASK) Object.assign(e.style, v); FMASK = []; }
function floodHTML(fx, sh) {
  if (BG_ONLY) return '';                            // the flood is picture (the next background), not part of the QA reference
  const F = FLOODS[fx.from]; if (!F) return '';
  const x = K.XFX.flood, u = Math.min(W, H) / 1080, fe = 420 * u, col = a => css([...F.rgb.slice(0, 3), a]);
  const far = Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([px, py]) => Math.hypot(px - F.O.x, py - F.O.y)));
  if (fx.d >= 0) {
    if (F.flat) return '';
    const a = Math.pow(K.clamp(1 - (fx.d + 1) / (x.post + 1)), 1.4);
    return a > .002 ? `<div style="position:absolute;left:0;top:0;width:${W}px;height:${H}px;background:${col(1)};opacity:${a.toFixed(3)}"></div>` : '';
  }
  const p = K.clamp(1 + fx.d / x.pre), Rp = q => (far * 1.03 + .6 * fe) * Math.pow(K.clamp(q), 2), R = Rp(p), rnd = K.rng(fx.seed), t = fx.d;
  let html = '';
  const circ = [];
  for (let j = 0; j < 3; j++) {
    const ph = rnd() * 6.283, ang = rnd() * 6.283, off = .06 * R * (j ? 1 : .5);     // (∝ the radius: a round drop at first)
    const cx = F.O.x + Math.cos(ang + t * .07) * off, cy = F.O.y + Math.sin(ang + t * .07) * off, rr = R * [1, .965, .93][j] * (1 + .04 * Math.sin(t * .6 + ph));
    circ.push({ cx, cy, rr });
    if (rr < 1) continue;
    const s0 = Math.max(0, 1 - fe / rr) * 100;
    html += `<div style="position:absolute;left:${f1(cx - rr)}px;top:${f1(cy - rr)}px;width:${f1(2 * rr)}px;height:${f1(2 * rr)}px;border-radius:50%;background:radial-gradient(closest-side,${col(1)} ${s0.toFixed(2)}%,${col(.55)} ${(s0 + (100 - s0) * .45).toFixed(2)}%,${col(0)} 100%)"></div>`;
  }
  const C0 = circ[0], fa = .55 * Math.sin(Math.PI * p);
  if (fa > .01 && C0.rr > fe * .6) {           // the fringe: a thin rainbow ring just inside the front (screen blend on a dark flood)
    const ro = C0.rr - fe * .2, wd = fe * .45, hue = ((t * 9 + fx.seed % 360) % 360 + 360) % 360, dark = relLum(F.rgb) < .4;
    const m = `radial-gradient(closest-side,transparent ${(100 * (1 - wd / ro)).toFixed(2)}%,#000 ${(100 * (1 - wd / ro / 2)).toFixed(2)}%,transparent 100%)`;
    html += `<div style="position:absolute;left:${f1(C0.cx - ro)}px;top:${f1(C0.cy - ro)}px;width:${f1(2 * ro)}px;height:${f1(2 * ro)}px;border-radius:50%;background:conic-gradient(from ${hue.toFixed(1)}deg,#FF6BD0,#8C7BFF,#45D4FF,#7DFFC0,#FFE680,#FF6BD0);-webkit-mask:${m};mask:${m};opacity:${(dark ? fa : fa * .6).toFixed(3)}${dark ? ';mix-blend-mode:screen' : ''}"></div>`;
  }
  floodMask(sh, F, C0, fe, u);
  return html;
}
// A's dark-on-dark text (contrast < 3:1 with the flood colour) under the front: its own mask, a radial gradient on circle
// 0's centre in the element's coordinates — transparent where the flood is ≥ 50 % (r ≤ rr − .5·fe), opaque where it is
// ≤ 20 % (r ≥ rr − .2·fe), reaching past the box (glyph overhangs, outlines). Text the block masks itself is left alone.
function floodMask(sh, F, C0, fe, u) {
  const sr = stageXY(), rin = Math.max(0, C0.rr - .5 * fe), rout = Math.max(1, C0.rr - .2 * fe);
  for (const e of sh.el.querySelectorAll('.lv-txt')) {
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || e.offsetParent === null || !e.offsetWidth || effOpacity(e) < .3 || contrast(rgbaOf(cs.color), F.rgb) >= 3) continue;
    if (e.style.maskImage && e.style.maskImage !== 'none') continue;
    const r = e.getBoundingClientRect(), k = r.width / e.offsetWidth, bx0 = r.left - sr.left, by0 = r.top - sr.top;
    const dmin = Math.hypot(Math.max(bx0 - C0.cx, 0, C0.cx - bx0 - r.width), Math.max(by0 - C0.cy, 0, C0.cy - by0 - r.height));
    if (rout <= dmin) continue;                      // the front hasn't reached it
    const mg = e.offsetHeight + 40 * u / k;
    FMASK.push([e, Object.fromEntries(MASK_PROPS.map(q => [q, e.style[q]]))]);
    Object.assign(e.style, { maskImage: `radial-gradient(circle at ${f1((C0.cx - bx0) / k + mg)}px ${f1((C0.cy - by0) / k + mg)}px,transparent ${f1(rin / k)}px,#000 ${f1(rout / k)}px)`,
      maskSize: `${f1(e.offsetWidth + 2 * mg)}px ${f1(e.offsetHeight + 2 * mg)}px`, maskPosition: `${f1(-mg)}px ${f1(-mg)}px`, maskRepeat: 'no-repeat', maskClip: 'no-clip' });
  }
}

async function seek(f) {
  const i = TL.shots.findIndex(s => f >= s.f0 && f < s.f1);
  const k = i < 0 ? TL.shots.length - 1 : i;
  const sh = shots[k];
  if (FMASK.length) unmaskFlood();                  // round 2: the flood's text masks belong to the frame that set them
  if (current !== sh) { if (current) current.el.style.display = 'none'; sh.el.style.display = 'block'; current = sh; }
  const D = sh.s.D, Db = sh.s.Db ?? D, t = holdMap(sh.s, f - sh.s.f0), tv = g => cameraAt(sh.camSpec, holdMap(sh.s, g - sh.s.f0), D, g - sh.s.f0, Db);
  const c = tv(f), c1 = tv(f + .25), c0 = tv(f - .25), dv = !!sh.camSpec.dive;
  // a dive's zoom about its pivot shifts the camera without moving the picture at the pivot: its velocity blur is the scale's
  const cr = dv ? [f + .25, f - .25].map(g => cameraAt({ ...sh.camSpec, dive: null }, holdMap(sh.s, g - sh.s.f0), D, g - sh.s.f0, Db)) : null;
  const vx = Math.abs(cr ? cr[0].x - cr[1].x : c1.x - c0.x) * 2, vy = Math.abs(cr ? cr[0].y - cr[1].y : c1.y - c0.y) * 2, vs = Math.abs(c1.s - c0.s) * 2 * Math.max(W, H) / 2;
  const mb = v => .28 * v * Math.min(1, v / 20);
  // v2 (drift cuts, camera fields): σ = 0.2 × speed along the travel, fading in from 2 to 8 px/frame of the measured
  // 1080 × 608 film (scaled to this stage's short side); the filter sits in the camera's own (scaled) space, so ÷ scale
  const k6 = Math.min(W, H) / 608, mb2 = v => .2 * v * K.smoothstep(2 * k6, 8 * k6, v), v2 = !!sh.camSpec.v2;
  const bx = Math.min(22, v2 ? mb2(vx) : mb(vx)), by = Math.min(22, v2 ? mb2(vy) : mb(vy)), bs = Math.min(12, mb(vs) * .5 + c.blur);
  const fx = xfxAt(k, f);              // glitch filters the camera; smear / tunnel / flash draw the overlay (below)
  sh.cam.style.transform = `translate(${c.x.toFixed(2)}px,${c.y.toFixed(2)}px) scale(${c.s.toFixed(5)})`;
  sh.cam.style.filter = filt(fx && fx.type === 'glitch' ? glitchFilter(fx, f) : '', dv ? '' : v2 ? dblur('lvB' + k, bx / c.s, by / c.s) : dblur('lvB' + k, bx, by), dv ? '' : blurCss(v2 ? bs / c.s : bs));
  // a dive's motion blur runs in screen space on a frame-sized wrapper (clipped just past the frame): inside a ×8 camera it
  // would run on a ×8 raster (or, at ×0.3, on the whole oversized background)
  if (dv) { const w = sh.cam.parentElement; w.style.overflowClipMargin = Math.ceil(3 * Math.max(bx, by, bs) + 2) + 'px'; w.style.filter = filt(dblur('lvB' + k, bx, by), blurCss(bs)); }
  CAM = { blur: +Math.max(bx, by, bs).toFixed(3), s: +c.s.toFixed(5), x: +c.x.toFixed(2), y: +c.y.toFixed(2) };   // layer QA diagnostics
  // the content is clipped to what the camera can see now (the frame mapped back through the camera, + the blur's reach),
  // relative to its padding box = the frame: content left outside the frame (tiles flung out, a phone sliding in) makes
  // Chrome start compositing the camera when little else is on screen (a single layer pass) — nothing visible is clipped
  const vl = W / 2 - (W / 2 + c.x) / c.s, vr = W / 2 + (W / 2 - c.x) / c.s, vt = H / 2 - (H / 2 + c.y) / c.s, vb = H / 2 + (H / 2 - c.y) / c.s;
  sh.ctx.root.style.overflowClipMargin = Math.ceil(Math.max(0, -vl, vr - W, -vt, vb - H) + 3 * Math.max(bx, by, bs) / c.s + 2) + 'px';
  if (sh.foot) sh.foot.el.style.overflowClipMargin = sh.ctx.root.style.overflowClipMargin;
  if (OVL && !(fx && fx.type === 'flood')) {        // a flood is drawn after the block (it reads the block's text boxes)
    const html = fx && K.XFX[fx.type].overlay ? (fx.type === 'tunnel' ? tunnelSVG(fx) : fx.type === 'flash' ? flashSVG(fx) : smearSVG(fx)) : '';
    OVL.style.display = html ? 'block' : 'none';
    if (OVL.innerHTML !== html) OVL.innerHTML = html;
  }
  if (LBOX) {
    LBOX.style.display = sh.bar ? 'block' : 'none';
    for (const b of LBOX.children) b.style.height = sh.bar + 'px';
  }
  if (sh.pcam) {          // round 2: footage under a dive entrance keeps flying forward, slower (it is far), blurred by its own motion
    const p = plateCam(sh, f), p1 = plateCam(sh, f + .25), p0 = plateCam(sh, f - .25), pb = Math.min(12, mb(Math.abs(p1.s - p0.s) * Math.max(W, H)) * .5);
    sh.pcam.style.transform = `translate(${p.x.toFixed(2)}px,${p.y.toFixed(2)}px) scale(${p.s.toFixed(5)})`;
    sh.pcam.style.filter = filt(blurCss(pb));
  }
  const fr = sh.foot ? sh.foot.render(t, Db) : null;
  const r = sh.inst.render(t, Db);
  if (fr) await fr;
  if (r && r.then) await r;
  if (OVL && fx && fx.type === 'flood') { const html = floodHTML(fx, sh); OVL.style.display = html ? 'block' : 'none'; if (OVL.innerHTML !== html) OVL.innerHTML = html; }
  if (CARRY) await carryAt(f, k);
  if (window.__LV_DEBUG__) { const d = $('#lv-dbg'); d.style.display = 'block'; d.textContent = `${sh.s.id} f${f}`; }
  return sh.s.id;
}

// Text audit for QA: every .lv-txt box on screen now, in stage pixels, with its effective font size. For the readable-
// text floors and the contrast check also: caps (set in capitals: text-transform or the copy itself), outlined (a text
// stroke: judged by eye, not measured), clip (painted by background-clip: text) and words (each word's box, stage px —
// the contrast check finds each word's glyph pixels on its own, so an accent word is measured in its own colour).
const isCaps = (e, txt) => { const up = n => getComputedStyle(n).textTransform === 'uppercase', ws = [...e.querySelectorAll('.lv-w')];
  return up(e) || (ws.length > 0 && ws.every(up)) || (/\p{Lu}/u.test(txt) && !/\p{Ll}/u.test(txt)); };
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
    const txt = e.textContent.trim(), sub = [e, ...e.querySelectorAll('*')].map(n => getComputedStyle(n));
    const box = q => [+(q.left - sr.left).toFixed(1), +(q.top - sr.top).toFixed(1), +(q.right - sr.left).toFixed(1), +(q.bottom - sr.top).toFixed(1)];
    return { text: txt.slice(0, 60), x0: r.left - sr.left, y0: r.top - sr.top, x1: r.right - sr.left, y1: r.bottom - sr.top,
      px: parseFloat(getComputedStyle(e).fontSize) * scale, ui: !!e.closest('.lv-ui'), opacity: op,
      caps: isCaps(e, txt), outlined: sub.some(c => parseFloat(c.webkitTextStrokeWidth) > 0), clip: sub.some(c => c.webkitBackgroundClip === 'text' || c.backgroundClip === 'text'),
      shadowed: sub.some(c => c.textShadow && c.textShadow !== 'none'),
      words: [...e.querySelectorAll('.lv-w')].map(w => w.getBoundingClientRect()).filter(q => q.width > 0 && q.height > 0).map(box) };
  }).filter(b => b.opacity > .5);
}

// Contrast QA: hideText(true) makes every glyph invisible — fill, stroke, shadow and decoration — while every box, pill,
// card, plate and background stays exactly as drawn (text-fill-color, not color: borders and icons that use currentColor
// keep theirs); elements painted by background-clip: text are hidden. hideText('black') / ('white') instead fill every
// glyph solid black / white (no stroke, no shadow): the difference of those two frames is each pixel's glyph coverage,
// whatever lies behind the text; text that was invisible to begin with (a transparent fill: the raster anchor, layout
// placeholders) stays invisible. hideText('shadow') is hideText(true) with every text-shadow kept (the background a
// haloed or shadowed line is read against). lv.mjs --film takes these extra screenshots per audited (hero) frame after
// the page has drawn all of its film frames, then switches it off again. Never called, it changes nothing on the page.
let HIDE_CSS = null;
function hideText(on) {
  HIDE_CSS ||= document.head.appendChild(document.createElement('style'));
  HIDE_CSS.textContent = '';                      // read the page's own styles, not the previous mode's
  for (const el of stage.querySelectorAll('[data-lv-hide-text], [data-lv-no-ink]')) { el.removeAttribute('data-lv-hide-text'); el.removeAttribute('data-lv-no-ink'); }
  if (!on) return false;
  const clear = c => /^rgba\(.*,\s*0\)$/.test(c) || c === 'transparent', clips = new Set();
  // (the words inside a background-clip: text element inherit its transparent fill but are painted by its background:
  // they get ink like any visible text)
  const inClip = el => { for (let n = el.parentElement; n && n !== stage; n = n.parentElement) if (clips.has(n)) return true; return false; };
  for (const el of stage.querySelectorAll('*')) {
    const c = getComputedStyle(el), clip = c.webkitBackgroundClip === 'text' || c.backgroundClip === 'text';
    const hide = on === true || on === 'shadow';
    if (clip) clips.add(el);
    if (hide && clip) el.setAttribute('data-lv-hide-text', '');
    else if (!hide && !clip && clear(c.webkitTextFillColor) && !inClip(el)) el.setAttribute('data-lv-no-ink', '');
  }
  const fill = on === 'black' ? '#000' : on === 'white' ? '#fff' : 'transparent';
  HIDE_CSS.textContent = `#lv-stage, #lv-stage * { -webkit-text-fill-color: ${fill} !important; -webkit-text-stroke-color: transparent !important;
      ${on === 'shadow' ? '' : 'text-shadow: none !important; '}text-decoration-color: transparent !important; caret-color: transparent !important; }
    #lv-stage [data-lv-no-ink] { -webkit-text-fill-color: transparent !important; }
    #lv-stage svg text, #lv-stage svg tspan { fill-opacity: 0 !important; stroke-opacity: 0 !important; }
    #lv-stage [data-lv-hide-text] { visibility: hidden !important; }`;
  return on;
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
  seek, audit, setLayer, setBgOnly, textProbe, hideText, camera: () => CAM,
  crossCuts: () => ({ carries: CARRIES.map(c => ({ from: c.A.s.id, to: c.B.s.id, mode: c.P.morph ? 'morph' : c.P.needle ? 'needle' : 'smooth', a0: c.a0, cut: c.cut, land: c.fL, R0: c.R0, R1: c.R1 })), dives: DIVES, floods: Object.fromEntries(Object.entries(FLOODS).map(([k, v]) => [k, { O: v.O, color: v.color, flat: v.flat }])) }),
  layers: () => Object.fromEntries(shots.map(sh => [sh.s.id, sh.layers])),
  info: () => ({ W, H, aspect: ASPECT, fit: [...document.querySelectorAll('.lv-txt')].filter(e => e.dataset.fit).map(e => ({ text: e.textContent.trim().slice(0, 40), size: Number(e.dataset.fit), size0: Number(e.dataset.size0) })) }),
};
