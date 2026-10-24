// STORYBOARD STAND-IN (job-local custom block, manus2-space "The Lull"). Our overlays on a live-action plate, drawn at
// the 1920x1080 boxes of SHOTLIST.md (hf01's positions, our designs from the kit). The engine draws the plate (`bg:`).
// Reused from manus2-film's plate.mjs; changed per the final shot list's kit:
// - prompt bar: row 2 = '+' · a helmet-cam thumbnail chip (no label) · the small Manus mark (official file, never
//   recoloured) · a 3-bar signal glyph (bars drop to hollow outlines; 'x' = a crossed antenna, loss of signal) · mic ·
//   send disc. No words in the bar but the prompt. The newest 1-2 characters arrive #33ABFB and settle to ink. Press =
//   the disc flashes #33ABFB peaking on hf01's send frame; then a sky-blue sweep; optional collapse (S14) and jolt (S09).
// - bubble: two stacked one-line bubbles (the second a follow-up message) under one timestamp line (optional
//   envelope-and-bolt icon) and one sender label; white meta with a soft dark halo over space / the sea.
// - floating words: rack focus in and out, drift, plus a zero-G turn (each phrase rotates a few degrees over its life).
// - glyph: S04's thought glyph, white line icons with a soft halo (film frame, orbit, helmet, capsule, flare disc),
//   hard swaps on hf01's frames (chain), each swap with one ghost frame at ~1.2x; a jolt list (the helmet bonk).
// - count: S04's mono countdown with a small capsule icon (values tick on given frames).
// - title: S01's title group (white lockup files over black space, '2.0', a wordless 3-icon feature card, two decor
//   chips, our text-free mission patch + a star patch, glints), hf01's title motion and zoom-through.
// - grade: comp light events the video model can't place on a frame: 'red' (radiation-alarm pulse), 'sparkle'
//   (sensor hits), 'lamp' (helmet caution lamp).
// Timing fields are hf01 frame numbers (n), converted with the shot's `n0` (its first hf01 frame); heroAt picks the
// storyboard still. The film build replaces these stand-ins with the finished kit blocks.
const KINDS = ['bar', 'bubble', 'words', 'glyph', 'count', 'line', 'title', 'grade'];
const kindOf = o => KINDS.find(k => o && Object.prototype.hasOwnProperty.call(o, k));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const lerp = (a, b, k) => a + (b - a) * k;
const u01 = (t, a, b) => b === a ? (t >= b ? 1 : 0) : Math.max(0, Math.min(1, (t - a) / (b - a)));
const outCubic = k => 1 - Math.pow(1 - k, 3);
const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
const INK = '#1F1F1F', BLUE = '#33ABFB', ICON = '#2CB4F3', MOON = '#F4F1EA', NAVY = '#0E1A2B', GOLDT = '#E8C27A';
const HALO = k => `text-shadow:0 0 ${14 * k}px rgba(0,0,0,.6),0 ${2 * k}px ${8 * k}px rgba(0,0,0,.45);`;

function copyOf(s) {
  const out = [];
  for (const o of [].concat(s.overlays || [])) {
    const k = kindOf(o);
    if (k === 'title' && o.title.big) out.push(o.title.big);
    if (k === 'words') out.push(o.words);
    if (k === 'count') out.push(String([].concat(o.count)[0][1]));
    if (k === 'bar') out.push(o.bar);
    if (k === 'bubble') out.push(...[o.time, ...[].concat(o.bubble), o.from].filter(Boolean));
    if (k === 'line') out.push(o.line);
  }
  return out.map(String);
}

// the typed prompt: [[nFrom, nTo, charsTypedAtNTo], ...] (hf01's human beats); chars typed by hf01 frame n
function typedAt(o, n) {
  const total = Array.from(String(o.bar)).length, beats = o.type || [[o.n + 3, (o.send ?? o.n + 30) - 4, total]];
  let prev = 0;
  for (const [a, b, c] of beats) {
    if (n < a) return prev;
    if (n <= b) return Math.round(lerp(prev, c, u01(n, a, b)));
    prev = c;
  }
  return Math.min(total, prev);
}
const signalAt = (o, n) => { const sg = o.signal ?? 3; if (!Array.isArray(sg)) return sg; let v = sg[0][1]; for (const [m, b] of sg) if (n >= m) v = b; return v; };

const SW = 5;   // glyph stroke (white line icons)
const ICONS = {
  frame: `<svg viewBox="0 0 228 128" width="100%" height="100%" fill="none" stroke="#fff" stroke-width="${SW}" stroke-linecap="round"><rect x="10" y="10" width="208" height="108" rx="14"/><path d="M30 34v-8h14M198 102v8h-14"/></svg>`,
  orbit: `<svg viewBox="0 0 200 200" width="100%" height="100%" fill="none" stroke="#fff" stroke-width="${SW}" stroke-linecap="round"><circle cx="100" cy="100" r="46"/><ellipse cx="100" cy="104" rx="92" ry="26" transform="rotate(-14 100 104)"/></svg>`,
  helmet: `<svg viewBox="0 0 200 200" width="100%" height="100%" fill="none" stroke="#fff" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round"><circle cx="100" cy="92" r="70"/><path d="M52 80q48-26 96 0"/><path d="M48 148q52 22 104 0v18H48z"/><circle cx="62" cy="62" r="6"/></svg>`,
  capsule: `<svg viewBox="0 0 100 100" width="100%" height="100%" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round"><path d="M14 86L34 18h32l20 68z"/><path d="M22 62h56"/></svg>`,
  // a line-art sun like the rest of the chain (the footage carries the real sunrise; a filled disc read as a second sun)
  flare: `<svg viewBox="0 0 200 200" width="100%" height="100%" fill="none" stroke="#fff" stroke-width="${SW}" stroke-linecap="round"><circle cx="100" cy="100" r="34"/>${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6, r0 = i % 2 ? 50 : 48, r1 = i % 2 ? 66 : 84; return `<path d="M${(100 + r0 * Math.cos(a)).toFixed(1)} ${(100 + r0 * Math.sin(a)).toFixed(1)}L${(100 + r1 * Math.cos(a)).toFixed(1)} ${(100 + r1 * Math.sin(a)).toFixed(1)}"/>`; }).join('')}</svg>`,
};
// line icons for the title card (2 px #2CB4F3 at 1080 → ~3.5 at 1920)
const icn = {
  mailBolt: (sz, c = ICON) => `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><rect x="2.5" y="5" width="15" height="11" rx="1.8"/><path d="M3 6l7.5 5.5L18 6"/><path d="M20.5 12l-2.5 4h3l-2.5 4"/></svg>`,
  mail: (sz, c = ICON) => `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.7" stroke-linejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/></svg>`,
  film: (sz, c = ICON) => `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/><path d="M10.5 9.8l3.6 2.2-3.6 2.2z" fill="${c}"/></svg>`,
  cloud: (sz, c = ICON) => `<svg width="${sz}" height="${sz * .75}" viewBox="0 0 24 18" fill="none" stroke="${c}" stroke-width="1.7" stroke-linejoin="round"><path d="M7 16h11a4.5 4.5 0 0 0 .6-9 6.5 6.5 0 0 0-12.4 1.6A3.8 3.8 0 0 0 7 16z"/></svg>`,
};
// our text-free mission patch (navy twill, gold border, moon-white crescent cradling a small circle, three gold stars)
const patch = `<svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx="50" cy="50" r="47" fill="${NAVY}" stroke="${GOLDT}" stroke-width="5"/>
  <circle cx="50" cy="50" r="40" fill="none" stroke="${GOLDT}" stroke-width="1" stroke-dasharray="2 2" opacity=".7"/>
  <path d="M72.2 64.4A30 30 0 1 1 38.9 24.4A26 26 0 0 0 72.2 64.4Z" fill="${MOON}"/><circle cx="57" cy="43" r="8.5" fill="none" stroke="${MOON}" stroke-width="2.6"/>
  ${[[74, 22], [83, 34], [63, 15]].map(([x, y]) => `<path d="M${x} ${y - 4}l1.2 2.8 3 .2-2.3 1.9.8 2.9-2.7-1.6-2.7 1.6.8-2.9-2.3-1.9 3-.2z" fill="${GOLDT}"/>`).join('')}</svg>`;
const starPatch = `<svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx="50" cy="50" r="46" fill="${NAVY}" stroke="${GOLDT}" stroke-width="4"/><path d="M50 18l8.5 19.5 21 1.8-16 14 4.8 20.7L50 63 31.7 74l4.8-20.7-16-14 21-1.8z" fill="${GOLDT}"/></svg>`;
const glint = `<svg viewBox="0 0 40 40" width="100%" height="100%"><path d="M20 0C21 15 25 19 40 20 25 21 21 25 20 40 19 25 15 21 0 20 15 19 19 15 20 0z" fill="#fff"/></svg>`;

export default {
  name: 'plate',
  doc: 'STORYBOARD STAND-IN: our overlays on a live-action plate at SHOTLIST.md boxes (prompt bar with chip, Manus mark icon and signal glyph; two-message bubble; zero-G words; thought-glyph chain; countdown; product line; S01 title group; comp grades); hf01 frame numbers via n0; heroAt picks the storyboard frame.',
  layers: 'one per overlay in order: <kind>-N',
  params: {
    n0: 'the shot\'s first hf01 frame (all n fields are hf01 frames)',
    heroAt: 'hf01 frame for the storyboard still',
    overlays: 'list of {bar|bubble|words|glyph|count|line|title|grade, n (first frame), end (last frame), box: [x0, x1, y0, y1] at 1920x1080, …}',
  },
  bgDefaults: { bgDim: 0, bgMove: 'none' },
  copy: copyOf,
  validate(s) {
    const w = [];
    [].concat(s.overlays || []).forEach((o, i) => {
      if (!kindOf(o)) w.push(`plate ${s.id}: overlay #${i + 1} needs one of ${KINDS.join(', ')}`);
      if (kindOf(o) !== 'grade' && (!Array.isArray(o.box) || o.box.length !== 4)) w.push(`plate ${s.id}: overlay #${i + 1} needs box: [x0, x1, y0, y1]`);
    });
    if (s.n0 == null) w.push(`plate ${s.id}: n0 (first hf01 frame) is missing`);
    return w;
  },
  cues(s, D) {
    const c = [], n0 = s.n0 || 0;
    for (const o of [].concat(s.overlays || [])) {
      const k = kindOf(o);
      if (k === 'bar' && o.send != null) c.push({ t: o.send - n0, kind: 'click' });
      if (k === 'bubble') c.push({ t: Math.max(0, o.n - n0), kind: 'chime' });
    }
    return c.filter(x => x.t >= 0 && x.t < D);
  },
  hero: (s, D) => s.heroAt != null ? Math.max(0, Math.min(D - 1, s.heroAt - (s.n0 || 0))) : Math.round(D * .7),
  async build(ctx, s) {
    const { W, H } = ctx, k = W / 1920, n0 = s.n0 || 0, items = [];
    const img = p => ctx.asset(p);
    [].concat(s.overlays || []).forEach((o, i) => {
      const kind = kindOf(o), name = `${kind}-${i + 1}`;
      const [x0, x1, y0, y1] = (o.box || [0, 1920, 0, 1080]).map(v => v * k), w = x1 - x0, h = y1 - y0;
      if (kind === 'bar') {
        const fs = (o.size || 38) * k, r2 = h * .69;
        const chip = o.chip ? `<div class="fb-chip" style="position:relative;width:${50 * k}px;height:${28 * k}px;border-radius:${6 * k}px;overflow:hidden;background:#ccc;flex:none;box-shadow:0 0 0 ${1.2 * k}px rgba(31,31,31,.12)"><img src="${img(o.chip.thumb)}" style="width:100%;height:100%;object-fit:cover;display:block">${o.chip.live ? `<span style="position:absolute;right:${3 * k}px;top:${3 * k}px;width:${6 * k}px;height:${6 * k}px;border-radius:50%;background:#fff;box-shadow:0 0 ${3 * k}px rgba(0,0,0,.4)"></span>` : ''}</div>` : '';
        const el = ctx.el(`<div class="fb lv-ui" style="position:absolute;left:0;top:0;width:${w}px;height:${h}px;border-radius:${36 * k}px;background:rgba(255,255,255,.86);backdrop-filter:blur(${20 * k}px);-webkit-backdrop-filter:blur(${20 * k}px);
            box-shadow:0 ${14 * k}px ${43 * k}px rgba(0,0,0,.12),inset 0 0 0 ${1.5 * k}px rgba(255,255,255,.6);transform-origin:50% 50%">
            <div class="fb-t" style="position:absolute;left:${48 * k}px;right:${44 * k}px;top:${Math.max(22 * k, r2 - 34 * k - fs * 2.5)}px;font:400 ${fs}px/${1.24} ${ctx.font};color:${INK};word-break:break-word"><span class="fb-ty"></span><span class="fb-new" style="color:${BLUE}"></span><span class="fb-car" style="display:inline-block;width:${3 * k}px;height:${fs * 1.05}px;vertical-align:${-fs * .18}px;margin-left:${2 * k}px;background:${BLUE}"></span></div>
            <div style="position:absolute;left:${40 * k}px;right:${34 * k}px;top:${r2 - 30 * k}px;height:${60 * k}px;display:flex;align-items:center;gap:${18 * k}px">
              <svg width="${30 * k}" height="${30 * k}" viewBox="0 0 20 20" style="flex:none"><path d="M10 3v14M3 10h14" stroke="rgba(31,31,31,.6)" stroke-width="2" stroke-linecap="round"/></svg>
              ${chip}<div style="flex:1"></div>
              <img src="${img(o.mark || 'assets/manus-mark-dark.svg')}" style="height:${21 * k}px;width:auto;display:block;flex:none;opacity:.9">
              <div class="fb-sigw" style="position:relative;width:${30 * k}px;height:${24 * k}px;flex:none">
                <svg class="fb-sig" width="${30 * k}" height="${24 * k}" viewBox="0 0 15 12" style="position:absolute;left:0;top:0">${[0, 1, 2].map(j => `<rect class="fb-b${j}" x="${1 + j * 5}" y="${8 - j * 3.3}" width="3" height="${3.5 + j * 3.3}" rx=".6"/>`).join('')}</svg>
                <svg class="fb-x" width="${30 * k}" height="${24 * k}" viewBox="0 0 15 12" style="position:absolute;left:0;top:0;opacity:0" fill="none" stroke="#8A8A8A" stroke-width="1.1" stroke-linecap="round"><path d="M7.5 4v7.5M5 2.5a3.5 3.5 0 0 1 5 0M3.2.8a6 6 0 0 1 8.6 0"/><path d="M2 11.5L13 .8"/></svg></div>
              <svg width="${30 * k}" height="${30 * k}" viewBox="0 0 24 24" fill="none" stroke="#8A8A8A" stroke-width="2" stroke-linecap="round" style="flex:none"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>
              <div class="fb-send" style="position:relative;width:${60 * k}px;height:${60 * k}px;border-radius:50%;background:${INK};display:flex;align-items:center;justify-content:center;flex:none">
                <svg width="${28 * k}" height="${28 * k}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></div></div>
            <div class="fb-sw" style="position:absolute;top:0;bottom:0;width:${71 * k}px;opacity:0;background:linear-gradient(90deg,rgba(51,171,251,0),rgba(51,171,251,.6),rgba(51,171,251,0))"></div></div>`,
          `left:${x0}px;top:${y0}px;width:${w}px;height:${h}px`, name);
        { const tx = el.querySelector('.fb-t'), ty = el.querySelector('.fb-ty'), room = r2 - 30 * k - 12 * k - 16 * k;
          ty.textContent = String(o.bar); let f = fs;
          while (tx.offsetHeight > room && f > 22 * k) { f *= .95; tx.style.fontSize = f + 'px'; }
          tx.style.top = Math.max(16 * k, Math.min(36 * k, r2 - 30 * k - 12 * k - tx.offsetHeight)) + 'px'; ty.textContent = ''; }
        items.push({ o, kind, el, chipEl: el.querySelector('.fb-chip'), fb: el.querySelector('.fb'), ty: el.querySelector('.fb-ty'), nw: el.querySelector('.fb-new'), car: el.querySelector('.fb-car'), txt: el.querySelector('.fb-t'), send: el.querySelector('.fb-send'), sw: el.querySelector('.fb-sw'), bars: [0, 1, 2].map(j => el.querySelector(`.fb-b${j}`)), sig: el.querySelector('.fb-sig'), sx: el.querySelector('.fb-x'), chars: Array.from(String(o.bar)), w });
      }
      if (kind === 'bubble') {
        const lines = [].concat(o.bubble), boxes = [o.box, o.boxB || [o.box[0], o.box[1], o.box[3] + 14, o.box[3] + 14 + (o.box[3] - o.box[2])]];
        const meta = `font:500 ${23 * k}px ${ctx.font};color:#fff;white-space:nowrap;${HALO(k)}`;
        const bA = boxes[0].map(v => v * k), bB = boxes[1].map(v => v * k);
        const el = ctx.el(`<div style="position:absolute;left:0;top:0;width:${W}px;height:${H}px">
            <div class="bb-t" style="position:absolute;left:${bA[0]}px;width:${bA[1] - bA[0]}px;top:${bA[2] - 56 * k}px;display:flex;justify-content:center;align-items:center;gap:${10 * k}px;${meta}">${o.timeIcon ? icn.mailBolt(28 * k, '#fff') : ''}<span>${esc(o.time)}</span></div>
            ${lines.map((l, j) => { const b = j ? bB : bA; return `<div class="bb bb${j}" style="position:absolute;left:${b[0]}px;top:${b[2]}px;min-width:${b[1] - b[0]}px;height:${b[3] - b[2]}px;box-sizing:border-box;padding:0 ${26 * k}px;display:flex;align-items:center;border-radius:${25 * k}px;background:#FFFFFF;box-shadow:0 ${11 * k}px ${36 * k}px rgba(0,0,0,.14);transform-origin:20% 100%">
              <div class="bb-x" style="font:400 ${38 * k}px/1 ${ctx.font};color:${INK};white-space:nowrap">${esc(l)}</div></div>`; }).join('')}
            <div class="bb-f" style="position:absolute;${o.fromAlign === 'left' ? `left:${bB[0]}px` : `right:${W - bB[1]}px`};top:${bB[3] + 16 * k}px;${meta}">${esc(o.from)}</div></div>`,
          `left:0;top:0;width:${W}px;height:${H}px`, name);
        items.push({ o, kind, el, bs: [...el.querySelectorAll('.bb')], xs: [...el.querySelectorAll('.bb-x')], t: el.querySelector('.bb-t'), f: el.querySelector('.bb-f') });
      }
      if (kind === 'words' || kind === 'line' || kind === 'count') {
        const light = o.light ?? (kind !== 'line'), size = (o.size || (kind === 'line' ? 34 : kind === 'count' ? 64 : 72)) * k;
        const col = o.color || (light ? '#FFFFFF' : '#1D2126');
        const halo = kind === 'line' && !light ? '' : HALO(k);   // white type over footage keeps hf01's soft halo
        const face = kind === 'count' ? `500 ${size}px/1.1 Menlo, 'JetBrains Mono', monospace` : `${o.weight || 500} ${size}px/1.15 ${ctx.font}`;
        const vals = kind === 'count' ? [].concat(o.count) : null;
        const text = kind === 'count' ? `<span class="ct">${esc(vals[0][1])}</span><span style="display:inline-block;width:${size * .62}px;height:${size * .62}px;margin-left:${22 * k}px;vertical-align:${-size * .06}px;filter:drop-shadow(0 0 ${6 * k}px rgba(0,0,0,.6))">${ICONS.capsule}</span>`
          : esc(kind === 'words' ? o.words : o.line);
        const el = ctx.el(`<div class="wd" style="display:inline-block;font:${face};color:${col};letter-spacing:${kind === 'count' ? '0' : '-.01em'};white-space:nowrap;${halo};transform-origin:50% 50%">${text}</div>`,
          kind === 'line' ? `left:${x0}px;top:${y0}px;width:${w}px;text-align:center` : `left:${x0}px;top:${y0}px`, name);
        items.push({ o, kind, el, ct: el.querySelector('.ct'), vals });
      }
      if (kind === 'glyph') {
        const chain = [].concat(o.chain || [[o.n, o.glyph]]);
        const kinds = [...new Set(chain.map(c => c[1]).filter(Boolean))];
        const el = ctx.el(`<div class="gw" style="position:absolute;left:0;top:0;width:${w}px;height:${h}px;filter:drop-shadow(0 0 ${7 * k}px rgba(0,0,0,.55)) drop-shadow(0 0 ${2 * k}px rgba(0,0,0,.6))">${kinds.map(g => `<div class="g-${g}" style="position:absolute;inset:0;opacity:0">${ICONS[g]}</div>`).join('')}</div>`,
          `left:${x0}px;top:${y0}px;width:${w}px;height:${h}px`, name);
        items.push({ o, kind, el, chain, boxes: chain.map(c => (c[2] || o.box).map(v => v * k)), parts: Object.fromEntries(kinds.map(g => [g, el.querySelector(`.g-${g}`)])), gw: el.querySelector('.gw') });
      }
      if (kind === 'grade') {
        if (o.grade === 'red') {
          const el = ctx.el('', `left:${-W * .1}px;top:${-H * .1}px;width:${W * 1.2}px;height:${H * 1.2}px;background:radial-gradient(ellipse at 50% 45%,rgba(255,60,50,.55),rgba(200,20,20,.75));opacity:0`, name);
          items.push({ o, kind, el });
        }
        if (o.grade === 'sparkle') {
          const N = o.max || 120;
          const el = ctx.el(`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block">${Array.from({ length: N }, () => `<rect class="sp" width="${2.5 * k}" height="${2.5 * k}" fill="#fff"/>`).join('')}</svg>`, `left:0;top:0;width:${W}px;height:${H}px`, name);
          items.push({ o, kind, el, sp: [...el.querySelectorAll('.sp')] });
        }
        if (o.grade === 'lamp') {
          const el = ctx.el('', `left:${x0}px;top:${y0}px;width:${w}px;height:${h}px;border-radius:50%;background:radial-gradient(circle,rgba(255,170,40,.95),rgba(255,140,20,.4) 40%,rgba(255,140,20,0) 70%);opacity:0`, name);
          items.push({ o, kind, el });
        }
      }
      if (kind === 'title') {
        const T = o.title, B = T.boxes;
        const bx = b => { const [a, c, d, e] = b.map(v => v * k); return `left:${a}px;top:${d}px;width:${c - a}px;height:${e - d}px`; };
        const ch = (B.card[3] - B.card[2]) * k;
        const el = ctx.el(`<div class="tg" style="position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:${960 * k}px ${540 * k}px">
            <div class="tg-lock" style="position:absolute;${bx(B.lockup)};display:flex;align-items:center;justify-content:center;gap:${(B.lockup[1] - B.lockup[0]) * 8 / 524 * k}px">
              <img src="${img(T.mark)}" style="height:${(B.lockup[1] - B.lockup[0]) * 170 / 524 * k}px;width:auto;display:block;flex:none"><img src="${img(T.wordmark)}" style="width:${(B.lockup[1] - B.lockup[0]) * 391 / 524 * k}px;height:auto;display:block;flex:none"></div>
            <div class="tg-big" style="position:absolute;${bx(B.big)};display:flex;align-items:center;justify-content:center;font:600 ${283 * k}px/1 ${ctx.font};letter-spacing:-.03em;color:#fff;${HALO(k * 1.6)}">${esc(T.big)}</div>
            <div class="tg-card" style="position:absolute;${bx(B.card)};border-radius:${21 * k}px;background:rgba(255,255,255,.92);box-shadow:0 ${10 * k}px ${30 * k}px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;gap:${60 * k}px">${icn.mailBolt(ch * .52)}${icn.film(ch * .52)}${icn.cloud(ch * .56)}</div>
            <div class="tg-a" style="position:absolute;${bx(B.chipA)};transform:rotate(3deg);border-radius:${18 * k}px;background:rgba(255,255,255,.9);box-shadow:0 ${8 * k}px ${24 * k}px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">
              <div style="position:relative;width:${58 * k}px;height:${58 * k}px">${icn.mail(58 * k, '#6B6B6B')}<span class="tg-dot" style="position:absolute;right:${-4 * k}px;top:${4 * k}px;width:${16 * k}px;height:${16 * k}px;border-radius:50%;background:${BLUE}"></span></div></div>
            <div class="tg-b" style="position:absolute;${bx(B.chipB)};transform:rotate(-8deg);border-radius:${16 * k}px;background:rgba(255,255,255,.9);box-shadow:0 ${8 * k}px ${24 * k}px rgba(0,0,0,.3)">
              <svg viewBox="0 0 261 115" width="100%" height="100%">${[0, 1, 2].map(j => `<rect x="${34 + j * 26}" y="${30 + j * 20}" width="${120 - j * 18}" height="11" rx="3" fill="#C9C9C4"/>`).join('')}<rect x="104" y="20" width="4" height="78" rx="2" fill="#8A8A8A"/></svg></div>
            <div class="tg-p" style="position:absolute;${bx(B.patch)};transform:rotate(12deg);filter:drop-shadow(0 ${6 * k}px ${10 * k}px rgba(0,0,0,.45))">${patch}</div>
            <div class="tg-s" style="position:absolute;${bx(B.star)};transform:rotate(-10deg);filter:drop-shadow(0 ${6 * k}px ${10 * k}px rgba(0,0,0,.45))">${starPatch}</div>
            <div class="tg-g1" style="position:absolute;${bx(B.glint)}">${glint}</div>
            <div class="tg-g2" style="position:absolute;${bx([B.glint[0] - 600, B.glint[1] - 600, B.glint[2] + 260, B.glint[3] + 260])}">${glint}</div></div>`,
          `left:0;top:0;width:${W}px;height:${H}px`, name);
        const q = c => el.querySelector(c);
        items.push({ o, kind, el, g: q('.tg'), lock: q('.tg-lock'), big: q('.tg-big'), card: q('.tg-card'), a: q('.tg-a'), dot: q('.tg-dot'), b: q('.tg-b'), p: q('.tg-p'), st: q('.tg-s'), g1: q('.tg-g1'), g2: q('.tg-g2') });
      }
    });
    await Promise.all([...ctx.root.querySelectorAll('img')].map(im => im.decode().catch(() => null)));
    const pop = (p0, n) => { const p = u01(n, p0, p0 + 3); return n < p0 ? .7 : p < .67 ? lerp(.7, 1.05, p / .67) : lerp(1.05, 1, (p - .67) / .33); };
    return {
      render(t) {
        const n = n0 + t;
        for (const it of items) {
          const { o } = it, end = o.end ?? 1e9, a = o.n ?? n0;
          const vis = n >= a - .5 && n <= end + .5;
          if (it.kind === 'bar') {
            const e = u01(n, a, a + 4), sp = n < a + 4 ? 1 : 1 + .09 * Math.exp(-(n - a - 4) * .45) * Math.cos((n - a - 4) * 1.0);
            const col = o.collapse ? u01(n, o.collapse[0], o.collapse[1]) : 0;
            it.el.style.opacity = vis ? (Math.min(1, e * 1.5) * (1 - col)).toFixed(3) : 0;
            const jx = o.jolt && n >= o.jolt[0] && n <= o.jolt[1] ? (o.jolt[2] || 12) * k * (n % 2 ? 1 : -1) : 0;
            it.fb.style.transform = vis ? `translate(${jx.toFixed(2)}px,${(jx * .5).toFixed(2)}px) scale(${(lerp(.15, 1, outCubic(e)) * (n < a + 4 ? 1 : sp) * (1 - .55 * col)).toFixed(4)},${((n < a + 4 ? lerp(.35, 1, outCubic(e)) : sp) * (1 - .6 * col)).toFixed(4)})` : 'none';
            const typed = typedAt(o, n), settled = typedAt(o, n - 2);
            it.ty.textContent = it.chars.slice(0, settled).join('');
            it.nw.textContent = it.chars.slice(settled, typed).join('');
            const sent = o.send != null && n > o.send;
            it.car.style.opacity = sent ? 0 : (.55 + .45 * Math.cos(n * .42)).toFixed(3);
            // press: the disc flashes #33ABFB with a soft halo, peaking on hf01's send frame
            const pk = o.send == null ? 0 : n < o.send - 4 ? 0 : n <= o.send ? u01(n, o.send - 4, o.send) : 1 - u01(n, o.send, o.send + 2);
            it.send.style.background = pk > .25 ? BLUE : INK;
            it.send.style.boxShadow = pk > 0 ? `0 0 0 ${(10 * pk) * k}px rgba(51,171,251,${(.3 * pk).toFixed(2)})` : 'none';
            if (it.chipEl) { const cp = o.chip.n != null ? u01(n, o.chip.n, o.chip.n + 3) : 1; it.chipEl.style.opacity = cp > 0 ? 1 : 0; it.chipEl.style.transform = `scale(${(cp <= 0 ? .6 : cp < .67 ? lerp(.6, 1.06, cp / .67) : lerp(1.06, 1, (cp - .67) / .33)).toFixed(3)})`; }
            const sb = signalAt(o, n), lost = sb === 'x';
            it.sig.style.opacity = lost ? 0 : 1; it.sx.style.opacity = lost ? 1 : 0;
            it.bars.forEach((r, j) => { const on = !lost && j < Number(sb); r.setAttribute('fill', on ? '#8A8A8A' : 'none'); r.setAttribute('stroke', '#8A8A8A'); r.setAttribute('stroke-width', on ? 0 : .8); });
            const sw = o.sweep != null ? u01(n, o.sweep, o.sweep + 6) : 0;
            it.sw.style.opacity = sw > 0 && sw < 1 ? .9 : 0;
            it.sw.style.left = `${(it.w - 140 * k) - 412 * k * outCubic(sw)}px`;
            it.txt.style.opacity = o.sweep != null && n >= o.sweep + 2 ? .4 : 1;
          }
          if (it.kind === 'bubble') {
            const ns = [o.n, o.nB ?? o.n + 10], rise = (o.rise ?? 100) * k;
            const fade = o.fadeOut ? u01(n, o.fadeOut[0], o.fadeOut[1]) : 0, sink = o.fadeOut ? 11 * 1.7778 * k * u01(n, o.fadeOut[0] - 5, o.fadeOut[1]) : 0;
            it.el.style.opacity = vis ? (1 - fade).toFixed(3) : 0;
            it.bs.forEach((b, j) => {
              const nn = ns[j], g = u01(n, nn, nn + 10), e = 1 - Math.pow(1 - g, 3.2);
              b.style.opacity = n >= nn ? Math.min(1, u01(n, nn, nn + 2) * 1.5).toFixed(3) : 0;
              b.style.transform = `translateY(${((1 - e) * rise + sink).toFixed(2)}px) scale(${lerp(.82, 1, e).toFixed(4)})`;
              b.style.filter = g < .35 ? `blur(${((.35 - g) * 30 * k).toFixed(2)}px)` : 'none';
              it.xs[j].style.clipPath = `inset(0 ${(100 * (1 - u01(n, nn + 1, nn + 5))).toFixed(1)}% 0 0)`;
            });
            it.t.style.opacity = u01(n, ns[0], ns[0] + 2).toFixed(3);
            it.f.style.opacity = u01(n, ns[1] + 2, ns[1] + 5).toFixed(3);
          }
          if (it.kind === 'words' || it.kind === 'count' || it.kind === 'line') {
            const rack = it.kind !== 'line';
            const inK = u01(n, a, a + (rack ? 4 : 1)), outK = o.end != null && rack ? u01(n, end - 4, end + .5) : 0;
            const blur = rack ? (1 - inK) * 14 * k + outK * 14 * k : 0;
            it.el.style.opacity = vis ? (Math.min(1, inK * 1.3) * (1 - outK * .9)).toFixed(3) : 0;
            it.el.style.filter = blur > .2 ? `blur(${blur.toFixed(2)}px)` : 'none';
            const pkN = o.peak ?? (a + end) / 2, dr = o.drift || [0, 0];
            const dx = dr[0] * (n - pkN) * k, dy = dr[1] * (n - pkN) * k;
            const rot = (o.turn || 0) * (u01(n, a, end) - .5);
            it.el.style.transform = vis && rack ? `translate(${dx.toFixed(2)}px,${dy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg)` : 'none';
            if (it.ct) { let v = it.vals[0][1]; for (const [m, x] of it.vals) if (n >= m) v = x; it.ct.textContent = v; }
          }
          if (it.kind === 'glyph') {
            let cur = null, idx = -1;
            it.chain.forEach((c, j) => { if (n >= c[0]) { cur = c[1]; idx = j; } });
            const on = vis && cur;
            for (const [g, el] of Object.entries(it.parts)) el.style.opacity = on && g === cur ? 1 : 0;
            if (on) {
              const b = it.boxes[idx], ghost = n - it.chain[idx][0] < 1 ? 1.22 : 1;
              let jx = 0, jy = 0;
              for (const [jn, ddx, ddy] of [].concat(o.jolts || [])) if (n >= jn && n < jn + 3) { jx = ddx * k; jy = ddy * k; }
              const fl = Math.sin(n * .11) * 6 * k, rot = Math.sin(n * .05) * 3;
              it.el.style.left = `${b[0] + jx}px`; it.el.style.top = `${b[2] + jy + fl}px`; it.el.style.width = `${b[1] - b[0]}px`; it.el.style.height = `${b[3] - b[2]}px`;
              it.gw.style.width = `${b[1] - b[0]}px`; it.gw.style.height = `${b[3] - b[2]}px`;
              it.el.style.transform = `rotate(${rot.toFixed(2)}deg) scale(${ghost})`;
              it.el.style.opacity = ghost > 1 ? .6 : 1;
            } else it.el.style.opacity = 0;
          }
          if (it.kind === 'grade') {
            if (o.grade === 'red') {
              let p = 0;
              for (const pkN of [].concat(o.peaks || [])) { const r = n < pkN ? u01(n, pkN - 6, pkN) : 1 - u01(n, pkN, pkN + 18); p = Math.max(p, r); }
              it.el.style.opacity = vis ? ((o.base ?? .08) + (o.amp ?? .3) * p).toFixed(3) : 0;
            }
            if (o.grade === 'sparkle') {
              const cnt = Math.round(lerp(o.from ?? 20, o.max || 120, u01(n, a, o.full ?? end)));
              const f = Math.floor(n);
              it.sp.forEach((r, j) => {
                r.setAttribute('x', (hash(f, j) * W).toFixed(1)); r.setAttribute('y', (hash(j, f + .37) * H).toFixed(1));
                r.setAttribute('opacity', vis && j < cnt ? (.6 + .4 * hash(f + j, 2)).toFixed(2) : 0);
              });
            }
            if (o.grade === 'lamp') it.el.style.opacity = vis ? (.25 + .75 * Math.max(0, Math.sin((n - a) * 2 * Math.PI * 2 / 30))).toFixed(3) : 0;
          }
          if (it.kind === 'title') {
            const T = o.title, B = T.boxes, thr = u01(n, T.through[0], T.through[1]);
            it.el.style.opacity = vis ? (1 - u01(n, T.through[1] - 4, T.through[1])).toFixed(3) : 0;
            it.g.style.transform = `scale(${(1 + .0026 * Math.max(0, Math.min(n, T.through[0]) - 26) + 3.7 * Math.pow(thr, 3)).toFixed(4)})`;
            it.g.style.filter = thr > .5 ? `blur(${(20 * k * (thr - .5)).toFixed(2)}px)` : 'none';
            const sh = u01(n, 16, 36), big = B.lockupBig;
            const cx = lerp((big[0] + big[1]) / 2, (B.lockup[0] + B.lockup[1]) / 2, outCubic(sh)) * k, cy = lerp((big[2] + big[3]) / 2, (B.lockup[2] + B.lockup[3]) / 2, outCubic(sh)) * k;
            const sc = lerp((big[1] - big[0]) / (B.lockup[1] - B.lockup[0]), 1, outCubic(sh));
            const drop = n < 9 ? (n < 4 ? lerp(-55, 11.5, n / 4) : lerp(11.5, 0, (n - 4) / 5)) * 1.7778 * k : 0;
            it.lock.style.transform = `translate(${(cx - (B.lockup[0] + B.lockup[1]) / 2 * k).toFixed(2)}px,${(cy - (B.lockup[2] + B.lockup[3]) / 2 * k + drop).toFixed(2)}px) scale(${sc.toFixed(4)})`;
            it.lock.style.opacity = u01(n, 0, 2).toFixed(3);
            const bk = u01(n, 15, 24);
            it.big.style.opacity = n >= 15 ? 1 : 0;
            it.big.style.transform = `translateY(${(-9 * 1.7778 * k * u01(n, 27, 33)).toFixed(2)}px) scale(${lerp(1.6, 1, 1 - Math.pow(1 - bk, 2.8)).toFixed(4)})`;
            it.big.style.filter = bk < .8 ? `blur(${((1 - bk) * 10 * k).toFixed(2)}px)` : 'none';
            it.card.style.opacity = u01(n, 26, 31).toFixed(3);
            it.card.style.transform = `scaleX(${lerp(2.2, 1, outCubic(u01(n, 26, 32))).toFixed(4)})`;
            it.a.style.opacity = u01(n, 33, 35).toFixed(3); it.dot.style.opacity = n >= 39 ? 1 : 0;
            it.b.style.opacity = u01(n, 42, 45).toFixed(3);
            it.p.style.opacity = n >= 6 ? 1 : 0; it.p.style.transform = `rotate(12deg) scale(${pop(6, n).toFixed(3)})`;
            it.st.style.opacity = n >= 10 ? 1 : 0; it.st.style.transform = `rotate(-10deg) scale(${pop(10, n).toFixed(3)})`;
            const g1 = n >= 24 && n <= 27 ? lerp(.6, 1.6, u01(n, 24, 27)) : 0, g2 = n >= 39 && n <= 44 ? lerp(.6, 1.6, u01(n, 39, 44)) : 0;
            it.g1.style.opacity = g1 ? 1 : 0; it.g1.style.transform = `scale(${g1 || 1})`;
            it.g2.style.opacity = g2 ? 1 : 0; it.g2.style.transform = `scale(${g2 || 1})`;
          }
        }
      },
    };
  },
};
