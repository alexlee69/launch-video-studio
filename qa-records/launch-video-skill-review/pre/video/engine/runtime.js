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
// exit = the shot's own `out` transition (reached over its last 7 frames); enter = continues the previous shot's exit
function exitFor(type, W, H) {
  return ({ 'whip-left': { dx: -.5 * W }, 'whip-right': { dx: .5 * W }, 'whip-up': { dy: -.45 * H }, 'whip-down': { dy: .45 * H },
    'zoom-in': { s: .35 }, 'zoom-out': { s: -.3 }, blur: { blur: 10, s: .04 } })[type] || {};
}
function enterFor(prevOut, W, H, first) {
  if (first) return { s: -.06 };                     // opening: grows into the slow push (same direction, never cancels)
  return ({ 'whip-left': { dx: .36 * W }, 'whip-right': { dx: -.36 * W }, 'whip-up': { dy: .36 * H }, 'whip-down': { dy: -.36 * H },
    'zoom-in': { s: -.18 }, 'zoom-out': { s: .3 }, blur: { blur: 10, s: -.03 } })[prevOut] || { s: -.04 };
}
// t = held shot time (entrance and push freeze during a hold); tr = real shot time (the exit always lands on the cut)
function cameraAt(cam, t, D, tr = t, Db = D) {
  const e = { dx: 0, dy: 0, s: 0, blur: 0, ...cam.enter }, x = { dx: 0, dy: 0, s: 0, blur: 0, ...cam.exit };
  const ek = Math.pow(.8, Math.max(0, t));
  const xk = cam.exitLen ? K.inCubic(K.clamp((tr - (D - cam.exitLen)) / cam.exitLen, 0, 1.08)) : 0;
  const p = cam.push * K.clamp(t / Db, 0, 1.2);
  return { x: e.dx * ek + x.dx * xk, y: e.dy * ek + x.dy * xk, s: (1 + p) * (1 + e.s * ek) * (1 + x.s * xk), blur: e.blur * ek + x.blur * xk };
}

let TL, W, H, ASPECT, stage, shots = [], current = null, PLATES = {}, ALPHA = false, CLEAN = false, BG_ONLY = false, CAM = { blur: 0 };

// ── layers: every element a block creates belongs to a named layer (data-lv-layer on it or on its nearest tagged
// ancestor; untagged elements fall back to `content`). Layer mode hides every other layer by *visibility* — layout,
// transforms, clipping and the camera stay exactly as in the full render — so the layer exports restack to the clip.
const LAYER_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
function tagLayer(el, name) {
  if (!LAYER_RE.test(String(name)) || name === 'background' || name === 'constructor') throw new Error(`layer name "${name}" must be lower-case letters, digits or - (it names a file; "background" and "constructor" are reserved)`);
  el.dataset.lvLayer = name;
  return el;
}
let LAYER_CSS = null;
function setLayer(name) {
  LAYER_CSS ||= document.head.appendChild(document.createElement('style'));
  const q = name == null ? null : CSS.escape(String(name));
  LAYER_CSS.textContent = q == null ? '' : `.lv-content[data-lv-layer], .lv-content [data-lv-layer] { visibility: hidden; }
    .lv-content[data-lv-layer="${q}"], .lv-content [data-lv-layer="${q}"] { visibility: visible; }`;
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

function makeCtx(shot, content, fam, dark = false) {
  const b = TL.brand, u = Math.min(W, H) / 1080, portrait = H > W, square = W === H;
  // portrait = platform-UI-safe (feeds put buttons on the right and captions at the bottom); QA checks the same box
  // landscape/square leave ~2 % beyond QA's title-safe 5 % so the camera's slow push (≈3.5 %) never carries text past it
  const m = portrait ? { x0: .12 * W, y0: .12 * H, x1: .88 * W, y1: .78 * H } : { x0: .07 * W, y0: .09 * H, x1: .93 * W, y1: .91 * H };
  const safe = { ...m, w: m.x1 - m.x0, h: m.y1 - m.y0 };
  const C = dark ? { ...b.colors, ink: '#FFFFFF', muted: 'rgba(255,255,255,.62)', card: '#1C1C21', accent: b.colors.accentOnDark } : b.colors;
  const ctx = {
    K, A, W, H, u, portrait, square, aspect: ASPECT, safe, shot, D: shot.Db ?? shot.D, brand: b, C, font: `${fam}, Inter, sans-serif`,
    root: content,
    el(html, style = '', layer = null) { const d = document.createElement('div'); d.className = 'lv-abs'; d.style.cssText = 'position:absolute;' + style; d.innerHTML = html; content.appendChild(d); return layer ? tagLayer(d, layer) : d; },
    // put an element (and everything inside it that isn't tagged itself) on a named layer for --layers exports
    layer: (el, name) => tagLayer(el, name),
    // copy with *accent* markup; returns a div with .lv-txt; words are wrapped for reveal(); o.layer names its layer
    text(copy, o = {}) {
      const d = document.createElement('div'); d.className = 'lv-txt' + (o.cls ? ' ' + o.cls : '');
      const size = (o.size || 84) * u;
      d.style.cssText = `position:absolute;font-family:${ctx.font};font-weight:${o.weight || 700};font-size:${size}px;line-height:${o.lh || 1.04};letter-spacing:${o.ls ?? '-.035em'};
        color:${o.color || C.ink};text-align:${o.align || 'left'};white-space:${o.nowrap ? 'nowrap' : 'normal'};${o.maxW ? `width:${o.maxW}px;` : ''}${o.style || ''}`;
      d.dataset.size0 = size.toFixed(1);
      d.innerHTML = K.parseCopy(copy).map(p => p.br ? '<br>' : p.text.split(/(\s+)/).map(w => /^\s+$/.test(w) ? w : `<span class="lv-w" style="display:inline-block;${p.accent ? `color:${o.accent || C.accent}` : ''}">${A.esc(w)}</span>`).join('')).join('');
      if (o.layer) tagLayer(d, o.layer);
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
    plates: Object.fromEntries(Object.entries(PLATES).map(([id, p]) => [id, { n: p.n, url: i => `${p.url}/${String(i).padStart(5, '0')}.jpg` }])),
    asset: p => jobURL(p),
  };
  return ctx;
}

async function build() {
  const inj = window.__LV__ || {};
  const q = new URLSearchParams(location.search);
  TL = inj.timeline || await (await fetch(q.get('tl'))).json();
  ASPECT = inj.aspect || q.get('aspect') || TL.aspects[0];
  PLATES = inj.plates || (q.get('plates') ? await (await fetch(q.get('plates'))).json() : {});   // --serve passes footage frames by URL
  ALPHA = !!(inj.alpha || q.has('alpha'));
  CLEAN = !!(inj.clean || q.has('clean'));
  BG_ONLY = !!inj.bgOnly;                         // QA reference: the shot's background + camera, no content
  const LAYER = inj.layer ?? null;                // --layers: draw only this layer (everything else hidden by visibility)
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
    const s = TL.shots[i];
    const dark = s.theme === 'dark';
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
    const content = document.createElement('div'); content.className = 'lv-content';
    // a transparent border makes the content box 3W × 3H around the frame while children keep frame coordinates
    // (absolute children sit inside the border): content that overflows its box under the moving camera (tiles flung
    // out, a phone sliding in from below) makes Chrome start compositing the camera after a few frames and resample it —
    // history-dependent, so a layer pass could rasterise differently from the full frame
    content.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;border:solid transparent;border-width:${H}px ${W}px;margin:${-H}px 0 0 ${-W}px`;
    content.dataset.lvLayer = 'content';          // untagged elements inherit this fallback layer
    content.style.overflow = 'clip';              // and clipped each frame to what the camera can see (seek)
    if (!ALPHA) cam.appendChild(bg);
    cam.appendChild(content);
    if (BG_ONLY) content.style.visibility = 'hidden';
    el.appendChild(cam); stage.appendChild(el);
    const ctx = makeCtx(s, content, fam, dark);
    const block = custom[s.block] || BLOCKS[s.block];
    if (!block) throw new Error(`unknown block "${s.block}" in shot ${s.id}`);
    el.style.display = 'block';
    const inst = await block.build(ctx, s);
    const layers = layerList(content);            // measured while the shot is laid out
    // raster anchor: transparent text over the whole stage, in every render and every layer pass. Chrome rasterises a
    // frame that holds (enough) text differently from one that holds little or none — scaled SVG art came out softer —
    // so a layer pass without text would no longer match the full frame. It draws no pixels; QA and layers skip it.
    const anchor = document.createElement('div'); anchor.className = 'lv-anchor';
    anchor.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden;visibility:visible;color:transparent;font:400 ${Math.round(Math.min(W, H) / 10)}px Inter;line-height:1;word-break:break-all;pointer-events:none`;
    anchor.textContent = 'Ag'.repeat(400);
    content.appendChild(anchor);
    el.style.display = 'none';
    const prevOut = i ? TL.shots[i - 1].out : null;
    // the slow push keeps going the way the entrance zoom was going (a shrinking zoom-out entrance keeps shrinking):
    // an entrance zoom and a push in opposite directions cancel a few frames in and the shot stands still (QA: freeze)
    const enter = CLEAN ? { s: -.03 } : enterFor(prevOut, W, H, i === 0);
    const push = (s.push ?? .035) * ((enter.s || 0) > 0 ? -1 : 1);
    const camSpec = CLEAN ? { enter, exit: {}, exitLen: 0, push }
      : { enter, exit: exitFor(s.out, W, H), exitLen: s.out && s.out !== 'cut' && i < TL.shots.length - 1 ? K.EXIT_LEN : 0, push };
    shots.push({ s, el, cam, inst, camSpec, ctx, layers });
  }
  if (LAYER != null) setLayer(LAYER);
}

// hold: [a, b] in local frames freezes block + camera time between a and b (the only way to get identical frames); the
// block then runs on with its time b − a behind (it planned itself for Db = D − (b − a) frames), the exit stays on the cut
const holdMap = (s, t) => !s.hold ? t : t < s.hold[0] ? t : t <= s.hold[1] ? s.hold[0] : t - (s.hold[1] - s.hold[0]);

async function seek(f) {
  const i = TL.shots.findIndex(s => f >= s.f0 && f < s.f1);
  const k = i < 0 ? TL.shots.length - 1 : i;
  const sh = shots[k];
  if (current !== sh) { if (current) current.el.style.display = 'none'; sh.el.style.display = 'block'; current = sh; }
  const D = sh.s.D, Db = sh.s.Db ?? D, t = holdMap(sh.s, f - sh.s.f0), tv = g => cameraAt(sh.camSpec, holdMap(sh.s, g - sh.s.f0), D, g - sh.s.f0, Db);
  const c = tv(f), c1 = tv(f + .25), c0 = tv(f - .25);
  const vx = Math.abs(c1.x - c0.x) * 2, vy = Math.abs(c1.y - c0.y) * 2, vs = Math.abs(c1.s - c0.s) * 2 * Math.max(W, H) / 2;
  const mb = v => .28 * v * Math.min(1, v / 20), bx = Math.min(22, mb(vx)), by = Math.min(22, mb(vy)), bs = Math.min(12, mb(vs) * .5 + c.blur);
  sh.cam.style.transform = `translate(${c.x.toFixed(2)}px,${c.y.toFixed(2)}px) scale(${c.s.toFixed(5)})`;
  sh.cam.style.filter = filt(dblur('lvB' + k, bx, by), blurCss(bs));
  CAM = { blur: +Math.max(bx, by, bs).toFixed(3), s: +c.s.toFixed(5), x: +c.x.toFixed(2), y: +c.y.toFixed(2) };   // layer QA diagnostics
  // the content is clipped to what the camera can see now (the frame mapped back through the camera, + the blur's reach),
  // relative to its padding box = the frame: content left outside the frame (tiles flung out, a phone sliding in) makes
  // Chrome start compositing the camera when little else is on screen (a single layer pass) — nothing visible is clipped
  const vl = W / 2 - (W / 2 + c.x) / c.s, vr = W / 2 + (W / 2 - c.x) / c.s, vt = H / 2 - (H / 2 + c.y) / c.s, vb = H / 2 + (H / 2 - c.y) / c.s;
  sh.ctx.root.style.overflowClipMargin = Math.ceil(Math.max(0, -vl, vr - W, -vt, vb - H) + 3 * Math.max(bx, by, bs) / c.s + 2) + 'px';
  const r = sh.inst.render(t, Db);
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
  seek, audit, setLayer, textProbe, camera: () => CAM,
  layers: () => Object.fromEntries(shots.map(sh => [sh.s.id, sh.layers])),
  info: () => ({ W, H, aspect: ASPECT, fit: [...document.querySelectorAll('.lv-txt')].filter(e => e.dataset.fit).map(e => ({ text: e.textContent.trim().slice(0, 40), size: Number(e.dataset.fit), size0: Number(e.dataset.size0) })) }),
};
