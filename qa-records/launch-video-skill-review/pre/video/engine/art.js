// Drawing helpers that return SVG/HTML strings (no DOM access at import time, so Node can import blocks safely).
// Everything here is original: a generic cast of shape characters, a stand-in speech-bubble mark, a monogram tile,
// simple line icons and abstract app tiles (no third-party logos).

const SHAPES = {
  capsule: '<rect x="20" y="8" width="60" height="86" rx="30"/>',
  hex: '<path d="M50 6l38 22v44L50 94 12 72V28z" stroke-linejoin="round"/>',
  cloud: '<path d="M28 88a20 20 0 0 1-6-39 24 24 0 0 1 44-18 20 20 0 0 1 24 22 17 17 0 0 1-6 35z"/>',
  dome: '<path d="M8 88V60a42 42 0 0 1 84 0v28a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6z"/>',
  gem: '<rect x="20" y="20" width="60" height="60" rx="14" transform="rotate(45 50 50)"/>',
  clover: '<circle cx="50" cy="30" r="24"/><circle cx="30" cy="54" r="24"/><circle cx="70" cy="54" r="24"/><circle cx="50" cy="72" r="22"/>',
  bean: '<path d="M26 14c18-10 46-4 56 18 10 22 2 54-22 60-26 6-50-8-52-34-2-20 4-36 18-44z"/>',
};
export const CAST = [
  { shape: 'capsule', col: '#3E7BFA' }, { shape: 'hex', col: '#2FC2A3' }, { shape: 'cloud', col: '#FF8DB0' },
  { shape: 'dome', col: '#FFC53D' }, { shape: 'gem', col: '#F2594B' }, { shape: 'clover', col: '#9C6BFF' }, { shape: 'bean', col: '#62CF6B' }];

export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, n >> 8 & 255, n & 255].map(v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k));
  return `rgb(${c.join(',')})`;
}
export function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; }
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let gid = 0;
// a character: c = {shape, col} or {src} (a user SVG/PNG drawn as-is)
export function bud(c, size, mood = 'smile') {
  if (c.src) return `<img src="${esc(c.src)}" style="display:block;width:${size}px;height:${size}px;object-fit:contain">`;
  const id = 'lvg' + (gid++), eyeY = c.shape === 'dome' ? 58 : 48;
  const mouth = mood === 'open' ? `<path d="M43 ${eyeY + 13}q7 9 14 0z" fill="#2A1A1A"/>`
    : `<path d="M44 ${eyeY + 12}q6 6 12 0" fill="none" stroke="#1B1B1F" stroke-width="3.2" stroke-linecap="round"/>`;
  const eye = x => `<ellipse cx="${x}" cy="${eyeY}" rx="4.6" ry="6.4" fill="#1B1B1F"/><circle cx="${x + 1.6}" cy="${eyeY - 2.4}" r="1.6" fill="#fff"/>`;
  const left = mood === 'wink' ? `<path d="M35 ${eyeY}q5 -5 10 0" fill="none" stroke="#1B1B1F" stroke-width="3.4" stroke-linecap="round"/>` : eye(40);
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" style="display:block;overflow:visible">
   <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c.col, .18)}"/><stop offset="1" stop-color="${shade(c.col, -.12)}"/></linearGradient></defs>
   <g fill="url(#${id})">${SHAPES[c.shape] || SHAPES.capsule}</g>
   <ellipse cx="34" cy="26" rx="10" ry="6" fill="rgba(255,255,255,.28)" transform="rotate(-25 34 26)"/>
   <ellipse cx="31" cy="${eyeY + 10}" rx="5" ry="3" fill="rgba(255,120,140,.35)"/><ellipse cx="69" cy="${eyeY + 10}" rx="5" ry="3" fill="rgba(255,120,140,.35)"/>
   ${left}${eye(60)}${mouth}</svg>`;
}
// character wrapped with a floor shadow; animate with hop()
export function budEl(c, size, mood) {
  return `<div class="lv-bshadow" style="position:absolute;left:${size * .2}px;top:${size * .93}px;width:${size * .6}px;height:${size * .09}px;border-radius:50%;background:rgba(20,20,30,.10)"></div>
    <div class="lv-bbody" style="position:absolute;left:0;top:0;width:${size}px;height:${size}px;transform-origin:50% 100%">${bud(c, size, mood)}</div>`;
}
// idle bob + squash: keeps every frame alive. amp in px, phase in radians, t in local frames.
export function hop(el, size, t, phase, amp = 10) {
  const s = Math.sin(t * .21 + phase), y = -amp * (.5 + .5 * s), sq = 1 + .035 * Math.cos(t * .21 + phase);
  const b = el.querySelector('.lv-bbody'), sh = el.querySelector('.lv-bshadow');
  if (b) b.style.transform = `translateY(${y.toFixed(2)}px) scale(${(2 - sq).toFixed(4)},${sq.toFixed(4)})`;
  if (sh) sh.style.transform = `scale(${(1 + y / (size * .9)).toFixed(4)})`;
}

// stand-in mark (used when beats.yaml has no logo and mark: bubble)
export function bubbleMark(size, col = '#1B1B1F') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" style="display:block"><path d="M50 8c25 0 42 16 42 38S75 84 50 84c-5 0-10-1-14-2L18 92l4-17C13 68 8 58 8 46 8 24 25 8 50 8z" fill="${col}"/>
   <circle cx="38" cy="46" r="6.5" fill="#fff"/><path d="M56 46q6-6 12 0" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/></svg>`;
}
// monogram tile (the default stand-in logo): 1–2 letters on a rounded square in the accent colour
export function monogram(letters, size, bg, fg = '#fff', font = 'inherit') {
  const L = esc(String(letters || '•').slice(0, 2));
  return `<div style="width:${size}px;height:${size}px;border-radius:${size * .28}px;background:linear-gradient(160deg,${shade(bg, .12)},${shade(bg, -.12)});
    box-shadow:0 ${size * .08}px ${size * .2}px ${hexA(bg, .3)};display:flex;align-items:center;justify-content:center;
    font:700 ${size * (L.length > 1 ? .4 : .52)}px ${font};color:${fg};letter-spacing:-.04em">${L}</div>`;
}

const ICONS = {
  mail: '<rect x="12" y="22" width="76" height="56" rx="10"/><path d="M16 28l34 26 34-26" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>',
  phone: '<rect x="28" y="8" width="44" height="84" rx="10"/><rect x="34" y="18" width="32" height="56" rx="3" fill="#fff" opacity=".9"/><circle cx="50" cy="83" r="3.5" fill="#fff"/>',
  computer: '<rect x="10" y="16" width="80" height="54" rx="7"/><rect x="16" y="22" width="68" height="42" rx="3" fill="#fff" opacity=".9"/><path d="M38 70h24l4 14H34z"/>',
  calendar: '<rect x="12" y="18" width="76" height="70" rx="10"/><rect x="12" y="18" width="76" height="18" rx="9"/><rect x="22" y="46" width="14" height="12" rx="3" fill="#fff"/><rect x="43" y="46" width="14" height="12" rx="3" fill="#fff"/><rect x="64" y="46" width="14" height="12" rx="3" fill="#fff"/><rect x="22" y="66" width="14" height="12" rx="3" fill="#fff"/><rect x="43" y="66" width="14" height="12" rx="3" fill="#fff"/><path d="M30 10v16M70 10v16" stroke-width="7" stroke-linecap="round" fill="none"/>',
  chat: '<path d="M14 22a10 10 0 0 1 10-10h52a10 10 0 0 1 10 10v36a10 10 0 0 1-10 10H40L22 84V68h2a10 10 0 0 1-10-10z"/><circle cx="34" cy="40" r="5" fill="#fff"/><circle cx="50" cy="40" r="5" fill="#fff"/><circle cx="66" cy="40" r="5" fill="#fff"/>',
  bell: '<path d="M50 10a28 28 0 0 1 28 28v18l8 14H14l8-14V38a28 28 0 0 1 28-28z"/><circle cx="50" cy="82" r="8"/>',
  chart: '<rect x="12" y="52" width="16" height="36" rx="4"/><rect x="42" y="32" width="16" height="56" rx="4"/><rect x="72" y="14" width="16" height="74" rx="4"/>',
  lock: '<rect x="18" y="42" width="64" height="48" rx="10"/><path d="M32 42V30a18 18 0 0 1 36 0v12" fill="none" stroke-width="9"/><circle cx="50" cy="64" r="7" fill="#fff"/>',
  check: '<circle cx="50" cy="50" r="40"/><path d="M30 51l13 13 27-28" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>',
  star: '<path d="M50 8l12 26 28 3-21 19 6 28-25-14-25 14 6-28-21-19 28-3z" stroke-linejoin="round"/>',
  heart: '<path d="M50 86S10 62 10 34a20 20 0 0 1 40-6 20 20 0 0 1 40 6c0 28-40 52-40 52z"/>',
  bolt: '<path d="M56 6L18 56h26l-6 38 40-52H52z" stroke-linejoin="round"/>',
  globe: '<circle cx="50" cy="50" r="40"/><path d="M10 50h80M50 10c14 14 14 66 0 80M50 10c-14 14-14 66 0 80" fill="none" stroke="#fff" stroke-width="5"/>',
  camera: '<rect x="10" y="26" width="80" height="58" rx="12"/><rect x="34" y="14" width="32" height="16" rx="5"/><circle cx="50" cy="55" r="17" fill="#fff"/><circle cx="50" cy="55" r="10"/>',
  music: '<path d="M38 18l46-8v52" fill="none" stroke-width="9" stroke-linejoin="round"/><circle cx="30" cy="74" r="14"/><circle cx="72" cy="66" r="14"/><path d="M38 18v58" fill="none" stroke-width="9"/>',
  sparkle: '<path d="M50 6c4 26 18 40 44 44-26 4-40 18-44 44-4-26-18-40-44-44 26-4 40-18 44-44z"/>',
};
export const ICON_NAMES = Object.keys(ICONS);
export function icon(kind, col, size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" style="display:block;overflow:visible"><g fill="${col}" stroke="${col}">${ICONS[kind] || ICONS.sparkle}</g></svg>`;
}
const TILES = [['#EA4335', 'M30 34h40v32H30z M30 34l20 16 20-16'], ['#0F9D58', 'M28 30h44v40H28z M28 42h44 M40 30v40'], ['#4285F4', 'M32 26h26l12 12v36H32z M58 26v12h12'],
  ['#611F69', 'M30 50a20 20 0 1 1 40 0a20 20 0 1 1 -40 0 M44 50h12'], ['#24292F', 'M38 36l-12 14 12 14 M62 36l12 14-12 14'], ['#FF9900', 'M28 40h44v26H28z M28 48h44'],
  ['#1DA1F2', 'M50 26a16 16 0 0 1 16 16c0 12-16 30-16 30S34 54 34 42a16 16 0 0 1 16-16z'], ['#7B61FF', 'M30 66V44l20-14 20 14v22z'], ['#00B386', 'M30 50l12 12 28-28'],
  ['#E8590C', 'M34 30h32v40H34z M40 40h20 M40 50h20 M40 60h12'], ['#0A66C2', 'M30 30h40v40H30z M40 44v16 M40 38v1 M50 60V48a6 6 0 0 1 12 0v12'], ['#F4B400', 'M50 28l7 14 15 2-11 11 3 15-14-7-14 7 3-15-11-11 15-2z']];
// abstract app tile (generic glyphs, no real logos); or a user image via {src}
export function appTile(i, size, src = null) {
  if (src) return `<div style="width:${size}px;height:${size}px;border-radius:${size * .24}px;background:#fff;box-shadow:0 0 0 1px rgba(17,17,20,.08);display:flex;align-items:center;justify-content:center"><img src="${esc(src)}" style="width:62%;height:62%;object-fit:contain"></div>`;
  const [c, d] = TILES[i % TILES.length];
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" style="display:block;overflow:visible"><rect x="4" y="4" width="92" height="92" rx="24" fill="#fff" stroke="rgba(17,17,20,.08)"/><path d="${d}" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

// progress spinner: a light ring with a quarter arc in the accent colour that travels round it (spinAt: 22° per frame).
// The arc moves by stroke-dashoffset, never by rotating the element: a rotated element inside a fading container makes
// Chrome composite that container on its own, so a frame would rasterise differently alone than in context (--layers)
export function spinner(size, bw, track, arc) {
  const c = size / 2, r = c - bw / 2, C = 2 * Math.PI * r;
  return `<svg class="lv-spin" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="position:absolute;left:0;top:0;display:block;overflow:visible">
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${track}" stroke-width="${bw}"/>
    <circle class="lv-arc" cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${arc}" stroke-width="${bw}" stroke-dasharray="${C / 4} ${C * 3 / 4}" data-c="${C}"/></svg>`;
}
// the arc starts centred on 12 o'clock (225°–315° clockwise from 3 o'clock, like a top border) and turns clockwise
export function spinAt(svg, t) { const a = svg.querySelector('.lv-arc'), C = Number(a.dataset.c); a.style.strokeDashoffset = (-(((225 + t * 22) % 360 + 360) % 360) / 360 * C).toFixed(3); }

// device frames: inner HTML is placed in a positioned screen box of size w × h
// clock: false for screen recordings / screenshots, which carry their own status bar
export function phoneFrame(inner, w, font = 'inherit', { clock = true } = {}) {
  const h = w * 2.08;
  return `<div style="position:relative;width:${w}px;height:${h}px;border-radius:${w * .15}px;background:#0E0E11;padding:${w * .03}px;box-sizing:border-box;box-shadow:0 ${w * .08}px ${w * .2}px rgba(20,24,40,.18)">
   <div class="lv-screen" style="position:relative;width:100%;height:100%;border-radius:${w * .125}px;background:#fff;overflow:hidden;font-family:${font}">
    ${inner}
    <div style="position:absolute;left:50%;top:${w * .03}px;width:${w * .3}px;height:${w * .075}px;margin-left:-${w * .15}px;border-radius:99px;background:#0E0E11"></div>
    ${clock ? `<div style="position:absolute;left:${w * .08}px;top:${w * .035}px;font:600 ${w * .04}px ${font};color:#111">9:41</div>` : ''}</div></div>`;
}
export function browserFrame(inner, w, h, url = '', font = 'inherit') {
  const bar = Math.round(w * .045);
  return `<div style="position:relative;width:${w}px;height:${h}px;border-radius:${w * .018}px;background:#fff;overflow:hidden;box-shadow:0 ${w * .03}px ${w * .08}px rgba(20,24,40,.18),0 0 0 1px rgba(17,17,20,.08)">
   <div style="position:absolute;left:0;top:0;right:0;height:${bar}px;background:#F1F2F5;display:flex;align-items:center;gap:${bar * .22}px;padding-left:${bar * .5}px">
     <i style="width:${bar * .26}px;height:${bar * .26}px;border-radius:50%;background:#FF5F57"></i><i style="width:${bar * .26}px;height:${bar * .26}px;border-radius:50%;background:#FEBC2E"></i><i style="width:${bar * .26}px;height:${bar * .26}px;border-radius:50%;background:#28C840"></i>
     <div style="margin-left:${bar * .6}px;height:${bar * .58}px;flex:0 1 46%;border-radius:${bar}px;background:#fff;font:500 ${bar * .3}px ${font};color:#8A8A92;display:flex;align-items:center;padding-left:${bar * .4}px">${esc(url)}</div></div>
   <div class="lv-screen" style="position:absolute;left:0;top:${bar}px;right:0;bottom:0;overflow:hidden;font-family:${font}">${inner}</div></div>`;
}
