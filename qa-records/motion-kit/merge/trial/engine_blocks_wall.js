// wall — a floating video wall: tilted phone-ratio cards (images or footage; repeated to fill) at three
// depths on a light background, drifting with parallax (far slow and soft, near fast and out of focus) under a slow
// camera dolly; colourful label chips ride on some cards; an optional centre headline sits on a soft glow.
// Real CSS 3D tilt per card.
import { F } from './_film.js';
<<<<<<< A
import { M } from './_motion.js';
=======
import { originOf } from '../kit.js';
>>>>>>> C


const cardsOf = s => [].concat(s.cards || []).map(String);
const chipsOf = s => [].concat(s.chips || []).map(String);
// ── layout: grid (round 1 of the motion kit; the default floating layout below is untouched) — a flat mosaic of footage
// tiles, cols × rows by aspect, cascading in from the centre, one tile lit (accent stroke, scale, glow) while the others
// dim to ~35 %, then a slow push into the lit tile; optional headline on a dimmed band
const isGrid = s => s.layout === 'grid';
const GRID_DIMS = { '16x9': [6, 4], '9x16': [3, 5], '1x1': [4, 4] };
const gridDims = (s, aspect) => { const [c, r] = GRID_DIMS[aspect] || GRID_DIMS['16x9']; return [Number.isInteger(Number(s.cols)) && Number(s.cols) > 0 ? Number(s.cols) : c, Number.isInteger(Number(s.rows)) && Number(s.rows) > 0 ? Number(s.rows) : r]; };
const GRID_LIT = 22;          // the lit tile lands here (aspect-independent, so the cues match every aspect)
// which card each tile shows: seeded, least-used first, never the same card as a neighbour (incl. diagonals) when it
// can be helped (≥ 5 different cards always can; 4 use a 2 × 2 pattern); returns {grid[row][col], clashes}
export function gridAssign(n, cols, rows, seed, fixed = null) {
  const r = M.rng(seed), order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const clashes = g => { let k = 0; for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) { const X = x + dx, Y = y + dy; if (X >= 0 && X < cols && Y < rows && g[y][x] === g[Y][X]) k++; } return k; };
  const used = new Array(n).fill(0), g = Array.from({ length: rows }, () => new Array(cols).fill(-1));
  // fixed = [col, row]: that tile (the lit one) shows card 0, the hero; its neighbours avoid it
  if (fixed) { g[fixed[1]][fixed[0]] = 0; used[0]++; }
  const cells = []; for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (!(fixed && x === fixed[0] && y === fixed[1])) cells.push([x, y]);
  const nearOf = (x, y) => new Set([[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [-1, 1], [0, 1], [1, 1]].map(([dx, dy]) => [x + dx, y + dy]).filter(([X, Y]) => X >= 0 && Y >= 0 && X < cols && Y < rows).map(([X, Y]) => g[Y][X]).filter(v => v >= 0));
  const rank = () => order.slice().sort((a, b) => used[a] - used[b] || order.indexOf(a) - order.indexOf(b));
  // depth-first, least-used first, a bounded number of steps (then the greedy fill below)
  let steps = 0;
  const dfs = k => {
    if (k === cells.length) return true;
    if (++steps > 20000) return false;
    const [x, y] = cells[k], near = nearOf(x, y);
    for (const c of rank()) { if (near.has(c)) continue; g[y][x] = c; used[c]++; if (dfs(k + 1)) return true; g[y][x] = -1; used[c]--; }
    return false;
  };
  if (!dfs(0)) for (const [x, y] of cells) if (g[y][x] < 0) { const near = nearOf(x, y), cand = rank(), c = cand.find(i => !near.has(i)) ?? cand[0]; g[y][x] = c; used[c]++; }
  let best = { grid: g, clashes: clashes(g) };
  if (best.clashes && n >= 4 && !fixed) {
    const p = Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => order[(y % 2) * 2 + (x % 2)]));
    if (clashes(p) < best.clashes) best = { grid: p, clashes: clashes(p) };
  }
  return best;
}
const gridSeed = s => F.hash('wall-grid:' + s.id);
// the distinct cards (a file listed twice — at the same cardsFrom — is one card): [{i: first index in cards, key}]
const gridCards = s => { const cs = cardsOf(s), seen = new Map(); cs.forEach((c, i) => { const k = `${c}@${JSON.stringify(Array.isArray(s.cardsFrom) ? s.cardsFrom[i] ?? null : s.cardsFrom ?? null)}`; if (!seen.has(k)) seen.set(k, i); }); return [...seen.values()]; };
// the lit tile: pick = [col, row] or a tile index (row by row), default the tile nearest the centre (upper-right of a tie)
function gridPick(s, cols, rows) {
  if (Array.isArray(s.pick) && s.pick.length === 2) return [Math.max(0, Math.min(cols - 1, Number(s.pick[0]) | 0)), Math.max(0, Math.min(rows - 1, Number(s.pick[1]) | 0))];
  if (s.pick != null && Number.isInteger(Number(s.pick))) { const i = ((Number(s.pick) % (cols * rows)) + cols * rows) % (cols * rows); return [i % cols, Math.floor(i / cols)]; }
  let best = null;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const d = Math.hypot(x - (cols - 1) / 2, y - (rows - 1) / 2) - x * 1e-6 + y * 1e-6; if (!best || d < best.d) best = { d, x, y }; }
  return [best.x, best.y];
}
async function buildGrid(ctx, s) {
  const { W, H, u, safe, portrait } = ctx, C = ctx.C, dark = ctx.dark;
  const srcs = cardsOf(s), uniq = gridCards(s), [cols, rows] = gridDims(s, ctx.aspect), [lx, ly] = gridPick(s, cols, rows);
  const { grid } = gridAssign(uniq.length, cols, rows, gridSeed(s), [lx, ly]);
  const gut = 10 * u, ov = 1.035, GW = W * ov, GH = H * ov, tw = (GW - (cols - 1) * gut) / cols, th = (GH - (rows - 1) * gut) / rows;
  const x0 = (W - GW) / 2, y0 = (H - GH) / 2, rad = Math.min(tw, th) * .045;
  const maxRing = Math.max(1, Math.floor(Math.max((cols - 1) / 2, (rows - 1) / 2) + .01)), per = Math.min(2, 6 / maxRing), jit = F.rng(gridSeed(s) ^ 0x5bd1);
  const tilesLayer = ctx.el('', `left:0;top:0;width:${W}px;height:${H}px`, 'tiles');
  const litLayer = ctx.el('', `left:0;top:0;width:${W}px;height:${H}px`, 'lit');
  const tiles = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const lit = x === lx && y === ly, idx = uniq[grid[y][x]];
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;border-radius:${rad.toFixed(2)}px;overflow:hidden;background:${dark ? '#1A1B20' : '#D8DAE2'}`;
    const m = F.media(ctx, s, `cards.${idx}`, srcs[idx]);
    d.appendChild(m.img);
    // the dim: a flat overlay (the bg's own colour on dark, near-black on light), never the tile's opacity — fading a
    // tile over a light background washes it out to pastel
    const ov = document.createElement('div');
    ov.style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;background:${dark ? C.dark || '#0E0E12' : '#0C0C10'};opacity:0`;
    if (!lit) d.appendChild(ov);
    const ring = Math.floor(Math.max(Math.abs(x - (cols - 1) / 2), Math.abs(y - (rows - 1) / 2)) + .01);
    (lit ? litLayer : tilesLayer).appendChild(d);
    // pre-rolled: the cut lands with the centre in and the outer ring still arriving (~60 % built)
    tiles.push({ d, m, ov, lit, cx: x0 + x * (tw + gut) + tw / 2, cy: y0 + y * (th + gut) + th / 2, delay: -5 + ring * per + jit() * .9 });
  }
  const L = tiles.find(t => t.lit);
  // the lit tile's frame: an accent stroke that draws on (SVG rect, pathLength 1) and a soft accent glow under it
  const glow = document.createElement('div');
  glow.style.cssText = `position:absolute;border-radius:${(rad * 1.6).toFixed(2)}px;background:${M.rgba(C.accent, .0)};box-shadow:0 0 ${(60 * u).toFixed(1)}px ${(14 * u).toFixed(1)}px ${M.rgba(C.accent, .55)};opacity:0`;
  litLayer.insertBefore(glow, L.d);
  const stroke = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  stroke.setAttribute('width', W); stroke.setAttribute('height', H); stroke.style.cssText = 'position:absolute;left:0;top:0;overflow:visible';
  stroke.innerHTML = `<rect pathLength="1" fill="none" stroke="${C.accent}" stroke-width="${(3.5 * u).toFixed(2)}" stroke-dasharray="1 1" stroke-dashoffset="1"/>`;
  litLayer.appendChild(stroke);
  const srect = stroke.firstElementChild;
  await Promise.all(tiles.map(t => t.m.ready()));
  // headline on a dimmed band (lower third, or upper when the lit tile sits low)
  let band = null, head = null;
  if (s.text) {
    const low = L.cy < H * .55, bh = (portrait ? .17 : .22) * H;
    const by = low ? (portrait ? safe.y1 - bh - .02 * H : H * .7 - bh / 2) : (portrait ? safe.y0 : H * .28 - bh / 2);
    band = ctx.el('', `left:0;top:${by}px;width:${W}px;height:${bh}px;background:${dark ? M.rgba(C.dark, .74) : M.rgba(C.bg, .84)}`, 'band');
    head = ctx.text(s.text, { size: portrait ? 72 : ctx.square ? 72 : 84, align: 'center', style: 'text-wrap:balance;',  maxW: safe.w * .94, lines: 2, min: 56, layer: 'headline', color: dark ? '#FFFFFF' : C.ink, accent: C.accent });
    head.style.width = safe.w * .94 + 'px'; head.style.left = (W / 2 - safe.w * .47) + 'px'; head.style.top = (by + bh / 2 - head.offsetHeight / 2) + 'px';
  }
  return {
    async render(t, D) {
      await Promise.all(tiles.map(x => x.m.frame(t)));
      const lit = M.outExpo(M.u01(t, GRID_LIT, GRID_LIT + 14)), dim = M.u01(t, GRID_LIT + 2, GRID_LIT + 12);
      const Z = 1 + .075 * M.u01(t, GRID_LIT, D) + .012 * M.u01(t, 0, GRID_LIT);          // a slow push into the lit tile
      for (const x of tiles) {
        const e = M.outExpo(M.u01(t, x.delay, x.delay + 12)), sc = (.9 + .1 * e) * (x.lit ? 1 + .12 * lit : 1) * Z;
        const X = L.cx + (x.cx - L.cx) * Z, Y = L.cy + (x.cy - L.cy) * Z, w = tw * sc, h = th * sc;
        x.d.style.left = (X - w / 2).toFixed(2) + 'px'; x.d.style.top = (Y - h / 2).toFixed(2) + 'px';
        x.d.style.width = w.toFixed(2) + 'px'; x.d.style.height = h.toFixed(2) + 'px';
        x.d.style.borderRadius = (rad * sc).toFixed(2) + 'px';
        x.d.style.filter = F.filt(F.blur(8 * u * (1 - e)));
        x.d.style.opacity = M.u01(t, x.delay, x.delay + 3).toFixed(3);
        if (!x.lit) x.ov.style.opacity = ((dark ? .65 : .58) * dim).toFixed(3);
        if (x.lit) {
          const pad = 5 * u * sc;
          for (const [k, v] of [['x', X - w / 2 - pad], ['y', Y - h / 2 - pad], ['width', w + 2 * pad], ['height', h + 2 * pad], ['rx', rad * sc + pad], ['ry', rad * sc + pad]]) srect.setAttribute(k, v.toFixed(2));
          srect.setAttribute('stroke-dashoffset', (1 - M.outExpo(M.u01(t, GRID_LIT + 1, GRID_LIT + 13))).toFixed(4));
          glow.style.left = (X - w / 2).toFixed(2) + 'px'; glow.style.top = (Y - h / 2).toFixed(2) + 'px'; glow.style.width = w.toFixed(2) + 'px'; glow.style.height = h.toFixed(2) + 'px';
          glow.style.opacity = (lit * (.75 + .25 * Math.sin((t - GRID_LIT) * .12))).toFixed(3);
        }
      }
      if (band) {
        const bw = M.outExpo(M.u01(t, GRID_LIT + 4, GRID_LIT + 16));
        band.style.clipPath = bw < .999 ? `inset(0 ${((1 - bw) * 50).toFixed(2)}% 0 ${((1 - bw) * 50).toFixed(2)}%)` : 'none';
        const e = M.enter(t, GRID_LIT + 7, 15, u);
        head.style.opacity = e.o.toFixed(3); head.style.filter = F.filt(F.blur(e.blur));
        head.style.transform = e.k < 1 ? `translateY(${((1 - e.k) * 26 * u).toFixed(2)}px) scale(${e.s.toFixed(5)})` : 'none';     // landed: none (pure in t)
      }
    },
  };
}
const CHIP_COLS = [['#FF4FA3', '#fff'], ['#1FC0EE', '#fff'], ['#B5EC3C', '#14210A'], ['#5747F2', '#fff'], ['#FF8A3D', '#fff']];
// round 2 `from:` (grow from a point): the cards are born at the origin, nearest first, and the chips wait for them (+12)
const born = s => s.i > 0 && originOf(s, { origin: true }) != null, CHIP0 = s => born(s) ? 24 : 12;
const TIERS = { far: { k: .6, v: .45, blur: 2.4, op: .82 }, mid: { k: .88, v: .9, blur: 0, op: 1 }, near: { k: 1.22, v: 1.7, blur: 3.2, op: 1 } };
export default {
  name: 'wall',
<<<<<<< A
  doc: 'A floating video wall: tilted phone-ratio cards at three depths drifting with parallax under a slow camera dolly, colourful label chips on some cards, an optional centre headline on a soft glow. layout: grid = a flat mosaic of footage tiles cascading in from the centre, one tile lit (accent stroke, scale, glow) and the rest dimmed to ~35 %, a slow push into it, an optional headline on a dimmed band.',
  layers: 'far · mid · near · glow · headline (layout: grid → tiles · lit · band · headline)',
=======
  doc: 'A floating video wall: tilted phone-ratio cards at three depths drifting with parallax under a slow camera dolly, colourful label chips on some cards, an optional centre headline on a soft glow.',
  layers: 'far · mid · near · glow · headline',
  origin: true,             // from: <layer of the previous shot> | [x, y] — the cards grow out of that point
>>>>>>> C
  // card footage is extracted at half size (the plate's longer side = .5 × the frame's): the biggest card is ~half the height
  media: [{ field: 'cards', fit: 'contain', scale: .5 }],
  copy: s => [s.text, ...(isGrid(s) ? [] : chipsOf(s))].filter(x => x != null && String(x).trim() !== '').map(String),
  read: s => [s.text].filter(x => x != null && String(x).trim() !== '').map(String),
<<<<<<< A
  params: { cards: 'list of images or footage (cardsFrom: seconds into each), repeated to fill the wall', chips: 'labels for the chips, e.g. [Hook in 1s, Product close-up] (colours cycle)', text: 'optional centre headline (*accent* ok)', chrome: 'ugc (default: a faint social-video overlay on each card) | none', drift: 'up (default) | down | left | right',
    layout: 'float (default: the floating wall) | grid (a flat mosaic, one tile lit; chips, chrome and drift are not used)', cols: 'grid: columns (default 6 on 16:9, 3 on 9:16, 4 on 1:1)', rows: 'grid: rows (default 4 on 16:9, 5 on 9:16, 4 on 1:1)',
    pick: 'grid: the lit tile, [col, row] from 0 or a tile index row by row (default: the tile nearest the centre); it shows the first card' },
  required: ['cards'],
  validate(s, D) {
    if (!isGrid(s)) return [];
    const w = [], n = gridCards(s).length;
    if (chipsOf(s).length) w.push(`wall ${s.id}: chips are not shown in layout: grid (the lit tile and the headline carry the shot)`);
    if (n < cardsOf(s).length) w.push(`wall ${s.id}: ${cardsOf(s).length - n} card${cardsOf(s).length - n > 1 ? 's are' : ' is'} listed twice — layout grid uses ${n} different card${n > 1 ? 's' : ''}`);
    const bad = Object.keys(GRID_DIMS).map(a => { const [c, r] = gridDims(s, a); return [a, gridAssign(n, c, r, gridSeed(s), gridPick(s, c, r)).clashes]; }).filter(([, k]) => k);
    if (bad.length) w.push(`wall ${s.id}: layout grid shows the same card next to itself (${bad.map(([a, k]) => `${k} pair${k > 1 ? 's' : ''} on ${a}`).join(', ')}) — give it ≥ 5 different cards`);
    // a pick outside an aspect's grid is clamped ([col, row]) or wraps (an index) — say where it lands
    if (s.pick != null) {
      const off = Object.keys(GRID_DIMS).map(a => { const [c, r] = gridDims(s, a), [px, py] = gridPick(s, c, r); return (Array.isArray(s.pick) ? Number(s.pick[0]) >= c || Number(s.pick[1]) >= r : Number(s.pick) >= c * r) ? `${a} (${c} × ${r}: lights [${px}, ${py}])` : null; }).filter(Boolean);
      if (off.length) w.push(`wall ${s.id}: pick ${JSON.stringify(s.pick)} is outside the grid on ${off.join(', ')}`);
    }
    if (D < GRID_LIT + 30) w.push(`wall ${s.id}: ${D} frames is tight for the grid to cascade in, light a tile and hold; give it ≥ ${((GRID_LIT + 30) / 30).toFixed(1)} s`);
    return w;
  },
  cues: s => isGrid(s) ? [{ t: 0, kind: 'hit', note: 84, gain: .5 }, { t: GRID_LIT, kind: 'pop', note: 88, gain: .7 }]
    : [{ t: 0, kind: 'hit', note: 84, gain: .5 }, ...chipsOf(s).slice(0, 6).map((_, j) => ({ t: 12 + j * 5, kind: 'pop', note: [81, 84, 86, 88, 91, 93][j], gain: .55 }))],
  hero: (s, D) => isGrid(s) ? Math.min(D - 8, GRID_LIT + (s.text ? 24 : 16)) : Math.min(D - 8, Math.max(40, 14 + chipsOf(s).length * 5 + 10)),
=======
  params: { cards: 'list of images or footage (cardsFrom: seconds into each), repeated to fill the wall', chips: 'labels for the chips, e.g. [Hook in 1s, Product close-up] (colours cycle)', text: 'optional centre headline (*accent* ok)', chrome: 'ugc (default: a faint social-video overlay on each card) | none', drift: 'up (default) | down | left | right', from: 'a layer of the previous shot (e.g. card) or [x, y]: the cards are born there and fly to their places, nearest first' },
  required: ['cards'],
  cues: s => [{ t: 0, kind: 'hit', note: 84, gain: .5 }, ...chipsOf(s).slice(0, 6).map((_, j) => ({ t: CHIP0(s) + j * 5, kind: 'pop', note: [81, 84, 86, 88, 91, 93][j], gain: .55 }))],
  hero: (s, D) => Math.min(D - 8, Math.max(40, CHIP0(s) + 2 + chipsOf(s).length * 5 + 10)),
>>>>>>> C
  async build(ctx, s) {
    if (isGrid(s)) return buildGrid(ctx, s);
    const { W, H, u, K, A, safe, portrait, square } = ctx, B = ctx.brand.colors;
    const srcs = cardsOf(s), chips = chipsOf(s), ugc = s.chrome !== 'none', r = F.rng(F.hash('wall:' + s.id));
    const cols = portrait ? 4 : square ? 5 : 7, rows = portrait ? 6 : square ? 4 : 4;
    const RW = W * (portrait ? 1.3 : 1.22), RH = H * (portrait ? 1.36 : 1.5), cellW = RW / cols, cellH = RH / rows;
    const base = H * (portrait ? .235 : square ? .36 : .4);
    const dir = typeof s.drift === 'string' ? s.drift || 'up' : 'up',     // (a map is the shot's drift-cut strengths)
      dvx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0, dvy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
    const groups = Object.fromEntries(Object.keys(TIERS).map(k => [k, ctx.el('', `left:0;top:0;width:${W}px;height:${H}px;isolation:isolate`, k)]));
    const slots = [];
    for (let rr = 0; rr < rows; rr++) for (let c = 0; c < cols; c++) {
      const cx = W / 2 - RW / 2 + (c + .5) * cellW + (r() - .5) * cellW * .42 + (rr % 2 ? cellW * .22 : 0), cy = H / 2 - RH * (dvy < 0 ? .36 : .5) + (rr + .5) * cellH + (r() - .5) * cellH * .3;
      const central = s.text && Math.abs(cx - W / 2) < W * (portrait ? .36 : .27) && Math.abs(cy - H / 2) < H * (portrait ? .12 : .2);
      const x = r(), tier = central ? 'far' : x < .28 ? 'far' : x < .78 ? 'mid' : 'near';
      slots.push({ cx, cy, tier, d: Math.hypot((cx - W / 2) / W, (cy - H / 2) / H) });
    }
    // where a slot's card centre is at local frame t (drift + dolly) — shared by the chip choice and render
    const D0 = ctx.D, at = (sl, t, ph = 0) => {
      const T = TIERS[sl.tier], dolly = 1 + .085 * K.ioCubic(K.clamp(t / D0));
      const dx = dvx * T.v * t * u + 6 * u * Math.sin(t * .03 + ph), dy = dvy * T.v * t * u + 4 * u * Math.cos(t * .027 + ph);
      return { X: W / 2 + (sl.cx + dx - W / 2) * dolly, Y: H / 2 + (sl.cy + dy - H / 2) * dolly, dolly };
    };
    // chips ride on crisp mid-depth cards near the centre whose chip stays well inside the frame at the hero frame
    const heroF = Math.min(D0 - 8, Math.max(40, CHIP0(s) + 2 + chips.length * 5 + 10)), cfs = (portrait ? 26 : 24) * u;
    const chipSlots = [];
    for (const sl of slots.filter(x => x.tier === 'mid').sort((a, b) => a.d - b.d)) {
      if (chipSlots.length >= chips.length) break;
      const label = chips[chipSlots.length], cwid = label.length * cfs * .56 + cfs * 1.3 + 26 * u, h = base * TIERS.mid.k, w = h * 9 / 16, { X, Y, dolly } = at(sl, heroF);
      const x1 = X + (w / 2 + cwid) * dolly * 1.06, yc = Y + (h * .1) * dolly;
      if (x1 < safe.x1 - 10 * u && X - w / 2 > safe.x0 - w && yc > safe.y0 + 40 * u && yc < safe.y1 - 40 * u) chipSlots.push(sl);
    }
    let ci = 0;
    const cards = slots.map((sl, i) => {
      const T = TIERS[sl.tier], land = !chipSlots.includes(sl) && r() < .16, h = base * T.k * (land ? .56 : 1), w = land ? h * 1.6 : h * 9 / 16;
      const src = srcs[(i * 7 + 3) % srcs.length], field = `cards.${(i * 7 + 3) % srcs.length}`;
      const card = document.createElement('div');
      card.style.cssText = `position:absolute;left:${sl.cx - w / 2}px;top:${sl.cy - h / 2}px;width:${w}px;height:${h}px`;
      const box = document.createElement('div');
      box.style.cssText = `position:absolute;inset:0;border-radius:${Math.min(w, h) * .09}px;overflow:hidden;background:#D8DAE2;box-shadow:0 ${h * .05}px ${h * .14}px rgba(20,24,40,.18)`;
      const m = F.media(ctx, s, field, src);
      box.appendChild(m.img);
      if (ugc) {
        const g = document.createElement('div');
        g.style.cssText = `position:absolute;left:0;right:0;bottom:0;height:42%;background:linear-gradient(0deg,rgba(0,0,0,.5),rgba(0,0,0,0))`;
        const f = h / 400;
        g.innerHTML = `<div style="position:absolute;left:${14 * f * 1.6}px;bottom:${46 * f * 1.6}px;width:${16 * f * 1.6}px;height:${16 * f * 1.6}px;border-radius:50%;background:#fff;opacity:.9"></div>
          <div style="position:absolute;left:${36 * f * 1.6}px;bottom:${50 * f * 1.6}px;width:${(60 + r() * 50) * f}px;height:${7 * f * 1.6}px;border-radius:9px;background:rgba(255,255,255,.85)"></div>
          <div style="position:absolute;left:${14 * f * 1.6}px;bottom:${26 * f * 1.6}px;width:${(110 + r() * 60) * f}px;height:${6 * f * 1.6}px;border-radius:9px;background:rgba(255,255,255,.55)"></div>
          <div style="position:absolute;left:${14 * f * 1.6}px;bottom:${12 * f * 1.6}px;width:${(70 + r() * 50) * f}px;height:${6 * f * 1.6}px;border-radius:9px;background:rgba(255,255,255,.4)"></div>
          ${[0, 1, 2].map(j => `<div style="position:absolute;right:${12 * f * 1.6}px;bottom:${(60 + j * 30) * f * 1.6}px;width:${14 * f * 1.6}px;height:${14 * f * 1.6}px;border-radius:50%;box-shadow:inset 0 0 0 ${2 * f * 1.6}px rgba(255,255,255,.8)"></div>`).join('')}`;
        box.appendChild(g);
      }
      card.appendChild(box);
      let chip = null;
      if (chipSlots.includes(sl)) {
        const [bg, fg] = CHIP_COLS[ci % CHIP_COLS.length], fs = cfs;
        chip = document.createElement('div');
        chip.className = 'lv-ui';
        chip.style.cssText = `position:absolute;left:${w - 6 * u}px;top:${h * (.34 + r() * .18)}px;display:flex;align-items:center;transform-origin:0 50%;font-family:${ctx.font}`;
        chip.innerHTML = `<i style="display:block;width:${10 * u}px;height:${10 * u}px;border-radius:50%;background:${bg};box-shadow:0 0 0 ${3 * u}px rgba(255,255,255,.9);flex:none"></i><i style="display:block;width:${14 * u}px;height:${2 * u}px;background:${bg};flex:none"></i>
          <span class="lv-txt" style="position:relative;padding:${fs * .3}px ${fs * .62}px;border-radius:99px;background:${bg};color:${fg};font-size:${fs}px;font-weight:600;white-space:nowrap;box-shadow:0 ${4 * u}px ${14 * u}px ${A.hexA(bg, .35)}">${A.esc(chips[ci])}</span>`;
        chip.dataset.at = String(CHIP0(s) + ci * 5);
        card.appendChild(chip);
        ci++;
      }
      groups[sl.tier].appendChild(card);
      return { card, chip, m, sl, T, w, h, ry: (r() < .5 ? -1 : 1) * (10 + r() * 14), rx: (r() - .5) * 14, rz: (r() - .5) * 6, ph: r() * 6, delay: sl.d * 18 + r() * 4 };
    });
    await Promise.all(cards.map(c => c.m.ready()));
    const og = ctx.origin || null;
    if (og) {                 // nearest the origin first (it leaves just before the cut), the farthest ~16 frames later, alternating banks
      const ro = F.rng(F.hash('wall-from:' + s.id)), dist = c => Math.hypot(c.sl.cx - og.x, c.sl.cy - og.y), dmin = Math.min(...cards.map(dist)), dmax = Math.max(...cards.map(dist)) || 1;
      cards.forEach((c, j) => { const q = (dist(c) - dmin) / Math.max(1, dmax - dmin); c.g0 = -.5 + 14 * Math.pow(q, .8) + ro() * 2 * q; c.bank = j % 2 ? 5 : -6; });
      cards.find(c => dist(c) === dmin).lead = true;     // the nearest card takes the source's size (K.grow lead)
    }
    let glow = null, head = null;
    if (s.text) {
      head = ctx.text(s.text, { size: portrait ? 88 : 96, align: 'center', maxW: safe.w * (portrait ? 1 : .62), lines: portrait ? 3 : 2, layer: 'headline' });
      head.style.left = (W / 2 - head.offsetWidth / 2) + 'px'; head.style.top = (H / 2 - head.offsetHeight / 2) + 'px';
      const gw = head.offsetWidth * 1.5, gh = head.offsetHeight * 2.4;
      glow = ctx.el('', `left:${W / 2 - gw / 2}px;top:${H / 2 - gh / 2}px;width:${gw}px;height:${gh}px;border-radius:50%;background:radial-gradient(closest-side,${B.bg} 0%,${A.hexA(B.bg, .92)} 45%,${A.hexA(B.bg, 0)} 100%)`, 'glow');
      ctx.root.appendChild(head);       // headline above the glow (tree order = paint order)
    }
    return {
      async render(t, D) {
        await Promise.all(cards.map(c => c.m.frame(t)));
        const p = K.clamp(t / D);
        for (const c of cards) {
          const { sl, T } = c, e = K.outExpo(K.u01(t, c.delay - 6, c.delay + 14)), a = K.clamp(K.u01(t, c.delay - 6, c.delay + 2));
          let { X, Y, dolly } = at(sl, t, c.ph), sc = dolly * K.lerp(sl.tier === 'near' ? 1.5 : .7, 1, e), op = a, bank = 0;
          if (og) { const gr = K.grow(og, { x: X, y: Y }, t, { t0: c.g0, len: 16, bank: c.bank, w: c.w, h: c.h, lead: !!c.lead }); X = gr.x; Y = gr.y; sc = dolly * gr.s; op = gr.op; bank = gr.k < 1 ? gr.rot : 0; }
          c.card.style.opacity = (op * T.op).toFixed(3);
          c.card.style.filter = T.blur ? F.blur(T.blur * u * (sl.tier === 'near' ? (.7 + .5 * p) : 1)) : 'none';
          c.card.style.transform = `translate(${(X - sl.cx).toFixed(2)}px,${(Y - sl.cy).toFixed(2)}px) perspective(${1500 * u}px) rotateY(${(c.ry + 3 * Math.sin(t * .02 + c.ph)).toFixed(3)}deg) rotateX(${(c.rx + 2 * Math.cos(t * .018 + c.ph)).toFixed(3)}deg) rotateZ(${(c.rz + bank).toFixed(3)}deg) scale(${sc.toFixed(5)})`;
          if (c.chip) {
            const t0 = Number(c.chip.dataset.at), k = K.outBack(K.u01(t, t0, t0 + 10), 1.8);
            c.chip.style.opacity = K.clamp(K.u01(t, t0, t0 + 3)).toFixed(3);
            c.chip.style.transform = t >= t0 + 10 ? 'none' : `scale(${K.clamp(k, 0, 1.15).toFixed(4)})`;     // identity at rest: none (GUIDE trap)
          }
        }
        if (head) { ctx.reveal(head, t, 6, 2.4); head.style.transform = `translateY(${(1.5 * u * Math.sin(t * .07)).toFixed(2)}px)`; }
        if (glow) glow.style.opacity = K.clamp(K.u01(t, 2, 14)).toFixed(3);
      },
    };
  },
};
