// Reel helpers, shared by the reel blocks (sticker · split · float · cta) and the media block's caption: display font,
// palette, sticker type, image/footage sources, lockup transforms, impact shake, word-pop caption. Browser-side helpers
// take ctx (ctx.K = kit math, ctx.A = art); the timing helpers (reelWords, reelCapPlan) are plain math so cues()/hero()
// can use them in Node. Nothing touches the DOM at import time.
const REEL_INTER = '/skill/node_modules/@fontsource/inter/files/inter-latin-';
const REEL_FACES = [[900, 'italic'], [800, 'italic'], [900, 'normal']];
export const REEL_VIDEO = p => /\.(mp4|mov|m4v|webm|mkv)$/i.test(String(p || ''));
export const reelWords = c => String(c ?? '').replace(/[*|]/g, ' ').split(/\s+/).filter(Boolean);
export const reelF = v => (+v).toFixed(3);

// Inter Black Italic (display) + Black upright (captions), loaded once per page through the FontFace API and awaited
// before anything is measured. A brand font with an 800 or 900 file is used instead (its upright file; the display face
// is slanted by the browser).
export async function reelFonts(ctx) {
  const bf = ctx.brand.font, files = (bf && bf.files) || {};
  const bw = [900, 800].find(w => files[w] != null);
  if (bf && bw) {
    await document.fonts.load(`${bw} 100px '${bf.family}'`);
    const family = `'${bf.family}', Inter, sans-serif`;
    return { display: { family, weight: bw, style: 'italic' }, caption: { family, weight: bw, style: 'normal' } };
  }
  const have = (w, st) => [...document.fonts].some(f => f.family.replace(/["']/g, '') === 'Inter' && String(f.weight) === String(w) && f.style === st && f.status === 'loaded');
  for (const [w, st] of REEL_FACES) if (!have(w, st)) {
    const face = new FontFace('Inter', `url("${REEL_INTER}${w}-${st}.woff2") format("woff2")`, { weight: String(w), style: st });
    try { document.fonts.add(await face.load()); } catch { throw new Error(`reel blocks: Inter ${w} ${st} could not be loaded from ${REEL_INTER}${w}-${st}.woff2`); }
  }
  return { display: { family: 'Inter, sans-serif', weight: 900, style: 'italic' }, caption: { family: 'Inter, sans-serif', weight: 900, style: 'normal' } };
}

// the brand's own colours, unlifted (a dark shot's ctx.C.accent is the lightened accentOnDark; sticker plates carry
// their own contrast, so the vivid brand accent is what they want)
export const reelPal = ctx => { const c = ctx.brand.colors; return { acc: c.accent, acc2: c.accent2, acc3: c.accent3, ink: c.dark, paper: '#FFFFFF' }; };
export const reelHexA = (hex, a) => { const n = parseInt(String(hex).slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; };

// sticker looks: text fill / accent-word fill / stroke / hard offset shadow, or a slanted plate + offset block behind
export const REEL_LOOKS = P => ({
  outline: { fill: P.paper, acc: P.acc2, stroke: P.ink, shadow: P.acc },
  plate: { fill: P.ink, acc: P.acc, plate: P.paper, block: P.acc, edge: P.ink },
  pill: { fill: P.paper, acc: P.acc2, plate: P.ink, block: P.acc, edge: P.paper },
  word: { fill: P.paper, acc: P.acc2, plate: P.acc, block: P.acc2, stroke: P.ink, edge: P.ink },
  ribbon: { fill: P.ink, acc: P.acc, plate: P.acc2, block: P.ink, edge: P.ink },
  dark: { fill: P.paper, acc: P.acc2, plate: P.ink },
  lime: { fill: P.ink, acc: P.ink, plate: P.acc2 },
  light: { fill: P.ink, acc: P.acc, plate: P.paper },
});
// geometry per look, in em of the type size: side padding, box height (caps .727 em + padding), line gap, plate slant
// (fraction of the box height ≈ the italic angle), offset block (dx, dy), stroke width, and the die-cut edge round the
// plate (so an ink box still reads on dark footage and a white one on bright footage)
export const REEL_GEO = {
  outline: { padX: .12, h: .94, gap: -.04, slant: 0, stroke: .13 },
  plate: { padX: .28, h: 1.07, gap: .14, slant: .19, block: [.07, .09], edge: .045 },
  pill: { padX: .28, h: 1.07, gap: .14, slant: .19, block: [.07, .09], edge: .045 },
  word: { padX: .26, h: 1.1, gap: .1, slant: .19, block: [.06, .08], stroke: .1, edge: .04 },
  ribbon: { padX: .34, h: 1.32, gap: .1, slant: .19, block: [.08, .1], edge: .06 },
  chip: { padX: .42, h: 1.5, gap: .1, slant: .19 },
};

// all ways to cut a word list into 1 … maxLines contiguous lines
function reelSplits(words, maxLines) {
  const out = [], n = words.length;
  const rec = (i, acc) => { if (i === n) { out.push(acc); return; } if (acc.length >= maxLines) return; for (let j = i + 1; j <= n; j++) rec(j, [...acc, words.slice(i, j)]); };
  rec(0, []);
  return out;
}

// Sticker type: copy (*accent*, | breaks) → one element per line on layer o.layer (plate looks: a slanted plate and an
// offset block behind the words, all children of the line element, which alone moves). Without | the words are split
// into ≤ o.maxLines lines, whichever split sets them biggest within o.maxW × o.maxH (≤ o.size px). Elements start at
// (0, 0); place(x, y) puts the block's top-left there. o.stagger shifts the lines sideways (em per line).
export function reelSticker(ctx, F, P, copy, o) {
  const look = o.look || 'outline', L = REEL_LOOKS(P)[look] || REEL_LOOKS(P).dark, G = REEL_GEO[look] || REEL_GEO.chip, font = o.font || F.display;
  const ls = o.ls ?? '-.012em', up = o.upper !== false;
  const lines0 = [[]];
  for (const p of ctx.K.parseCopy(String(copy ?? ''))) {
    if (p.br) { lines0.push([]); continue; }
    for (const w of p.text.split(/\s+/).filter(Boolean)) lines0[lines0.length - 1].push({ w, acc: p.accent });
  }
  const explicit = lines0.filter(l => l.length);
  if (!explicit.length) explicit.push([{ w: ' ', acc: false }]);
  const m = document.createElement('span');
  m.style.cssText = `position:absolute;left:0;top:0;visibility:hidden;white-space:pre;font-family:${font.family};font-weight:${font.weight};font-style:${font.style};font-size:1000px;letter-spacing:${ls};${up ? 'text-transform:uppercase;' : ''}`;
  ctx.root.appendChild(m);
  const mw = s => { m.textContent = s; return m.offsetWidth / 1000; };
  const lineEm = line => mw(line.map(t => t.w).join(' '));
  const stag = o.stagger || 0;
  const cands = explicit.length > 1 ? [explicit] : reelSplits(explicit[0], Math.max(1, o.maxLines || 2));
  let best = null;
  for (const c of cands) {
    const wEm = Math.max(...c.map(l => lineEm(l) + 2 * G.padX + G.slant * G.h)) + stag * (c.length - 1);
    const hEm = c.length * G.h + (c.length - 1) * G.gap;
    const size = Math.min(o.size, o.maxW / wEm, (o.maxH || 1e9) / hEm);
    const widths = c.map(lineEm), bal = Math.min(...widths) / Math.max(...widths);   // ragged splits read worse
    const score = size * (1 - .03 * (c.length - 1)) * (.9 + .1 * bal);
    if (!best || score > best.score) best = { c, size, score };
  }
  const lineW = best.c.map(lineEm);
  m.remove();
  const S = Math.max(o.min || 0, best.size), lines = [];
  best.c.forEach((line, i) => {
    const h = G.h * S, sl = G.slant * h, w = lineW[i] * S + 2 * G.padX * S + sl;
    const el = ctx.el('', `left:0;top:0;width:${w.toFixed(2)}px;height:${h.toFixed(2)}px;transform-origin:0 0;opacity:0`, o.layer);
    const poly = `clip-path:polygon(${sl.toFixed(2)}px 0,${w.toFixed(2)}px 0,${(w - sl).toFixed(2)}px ${h.toFixed(2)}px,0 ${h.toFixed(2)}px)`;
    let plate = null;
    if (L.edge && G.edge) {           // the die-cut edge: the plate grown by e on every side, behind the offset block
      const e = G.edge * S, ew = w + 2 * e, eh = h + 2 * e, es = sl * eh / h;
      el.insertAdjacentHTML('beforeend', `<div style="position:absolute;left:${(-e).toFixed(2)}px;top:${(-e).toFixed(2)}px;width:${ew.toFixed(2)}px;height:${eh.toFixed(2)}px;background:${L.edge};clip-path:polygon(${es.toFixed(2)}px 0,${ew.toFixed(2)}px 0,${(ew - es).toFixed(2)}px ${eh.toFixed(2)}px,0 ${eh.toFixed(2)}px)"></div>`);
      if (L.block && G.block) el.insertAdjacentHTML('beforeend', `<div style="position:absolute;left:${(G.block[0] * S - e).toFixed(2)}px;top:${(G.block[1] * S - e).toFixed(2)}px;width:${ew.toFixed(2)}px;height:${eh.toFixed(2)}px;background:${L.edge};clip-path:polygon(${es.toFixed(2)}px 0,${ew.toFixed(2)}px 0,${(ew - es).toFixed(2)}px ${eh.toFixed(2)}px,0 ${eh.toFixed(2)}px)"></div>`);
    }
    if (L.block && G.block) el.insertAdjacentHTML('beforeend', `<div style="position:absolute;left:${(G.block[0] * S).toFixed(2)}px;top:${(G.block[1] * S).toFixed(2)}px;width:${w.toFixed(2)}px;height:${h.toFixed(2)}px;background:${L.block};${poly}"></div>`);
    if (L.plate) { plate = document.createElement('div'); plate.style.cssText = `position:absolute;left:0;top:0;width:${w.toFixed(2)}px;height:${h.toFixed(2)}px;background-color:${L.plate};${poly}`; el.appendChild(plate); }
    const copyLine = line.map(t => t.acc ? `*${t.w}*` : t.w).join(' ');
    const fx = (L.stroke && G.stroke ? `-webkit-text-stroke:${G.stroke}em ${L.stroke};paint-order:stroke fill;` : '') + (L.shadow ? `text-shadow:.05em .065em 0 ${L.shadow};` : '');
    const txt = ctx.text(copyLine, { parent: el, size: S / ctx.u, weight: font.weight, lh: 1, ls, color: L.fill, accent: L.acc, nowrap: true,
      style: `font-family:${font.family};font-style:${font.style};${up ? 'text-transform:uppercase;' : ''}${fx}` });
    txt.style.left = (G.padX * S + sl / 2).toFixed(2) + 'px';
    txt.style.top = ((h - S) / 2).toFixed(2) + 'px';
    // the text box's font content area (ascent .969 + descent .242 em, Inter) overhangs a 1-em line by ~.105 em: that is
    // what the text audit measures, so layout checks use the line box grown to it (gy = how far it reaches past top/bottom)
    const gy = Math.max(0, .11 * S - (h - S) / 2);
    lines.push({ el, txt, plate, w, h, gy, dx: 0, dy: 0, light: L.plate === P.paper });
  });
  const pitch = (G.h + G.gap) * S, n = lines.length;
  const W0 = Math.max(...lines.map((l, i) => l.w + Math.abs(stag * S * (i - (n - 1) / 2)) * 2)), H0 = n * G.h * S + (n - 1) * G.gap * S;
  const align = o.align || 'center';
  const out = {
    lines, w: W0, h: H0, size: S, x: 0, y: 0, els: lines.map(l => l.el),
    place(x, y) {
      out.x = x; out.y = y;
      lines.forEach((l, i) => {
        const off = -stag * S * (i - (n - 1) / 2);
        l.x = align === 'left' ? x : align === 'right' ? x + W0 - l.w : x + (W0 - l.w) / 2 + off; l.y = y + i * pitch;
        l.el.style.left = l.x.toFixed(2) + 'px'; l.el.style.top = l.y.toFixed(2) + 'px';
      });
      return out;
    },
    remove() { for (const l of lines) l.el.remove(); },
    rects() { return lines.map(l => ({ x: l.x, y: l.y - l.gy, w: l.w, h: l.h + 2 * l.gy })); },   // as the text audit sees them
  };
  return out;
}

// a plate's gloss: a soft light band sweeping across it (paint only); k = 0…1 across, outside = off
export function reelGloss(line, k, P) {
  if (!line.plate) return;
  if (k <= 0 || k >= 1) { line.plate.style.backgroundImage = 'none'; return; }
  const p = -25 + 150 * k, band = line.light ? reelHexA(P.acc, .2) : 'rgba(255,255,255,.42)';
  line.plate.style.backgroundImage = `linear-gradient(105deg,rgba(255,255,255,0) ${(p - 14).toFixed(1)}%,${band} ${p.toFixed(1)}%,rgba(255,255,255,0) ${(p + 14).toFixed(1)}%)`;
}

// One transform for an element of a lockup: the group's move (shake, tilt, breathing: g = {cx, cy, dx, dy, rot, s})
// about the group centre, then the element's own move (l = {dx, dy, rot, s | sx, sy, p}) about its own centre.
// Every moving element is a direct child of the shot and moves itself (never a transformed child inside a moving or
// fading wrapper: --layers would see Chrome composite the wrapper on its own).
export function reelXf(el, x0, y0, w, h, g, l = {}) {
  const gx = g.cx - x0, gy = g.cy - y0, lx = w / 2, ly = h / 2, f = reelF;
  el.style.transformOrigin = '0 0';
  el.style.transform = `translate(${f((g.dx || 0) + gx)}px,${f((g.dy || 0) + gy)}px) rotate(${f(g.rot || 0)}deg) scale(${f(g.s ?? 1)}) `
    + `translate(${f((l.dx || 0) - gx + lx)}px,${f((l.dy || 0) - gy + ly)}px)${l.p ? ' ' + l.p : ''} rotate(${f(l.rot || 0)}deg) scale(${f(l.sx ?? l.s ?? 1)},${f(l.sy ?? l.s ?? 1)}) translate(${f(-lx)}px,${f(-ly)}px)`;
}

// seeded impact shake: jitter from frame t0 for len frames, decaying; {x, y, r} in px / deg (amp px at full)
export function reelShaker(ctx, seed) {
  const r = ctx.K.rng(ctx.K.hashStr(String(seed))), J = Array.from({ length: 64 }, () => [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1]);
  return (t, t0, len, amp) => {
    const k = t - t0;
    if (k < 0 || k >= len) return { x: 0, y: 0, r: 0 };
    const i = Math.floor(k), fr = k - i, a = J[i % 64], b = J[(i + 1) % 64], d = Math.pow(1 - k / len, 2) * amp;
    return { x: (a[0] + (b[0] - a[0]) * fr) * d, y: (a[1] + (b[1] - a[1]) * fr) * d, r: (a[2] + (b[2] - a[2]) * fr) * d * .1 };
  };
}

// a footage field's frames (lib/render.mjs extracts every declared media: field into 60-fps JPEGs, keyed `${id}:${field}`)
export const reelFrames = (ctx, s, f) => (ctx.plates || {})[f === 'src' ? s.id : `${s.id}:${f}`] || null;
// an <img> for image field f of shot s; frame(t) swaps in the footage frame when one exists (as media.js does)
export function reelImg(ctx, s, f, css = '') {
  const src = s[f], plate = reelFrames(ctx, s, f);
  if (REEL_VIDEO(src) && !plate) throw new Error(`${s.block} ${s.id}: ${f}: ${src} is footage but no frames were extracted — declare the field in the block's media: list`);
  const img = document.createElement('img');
  img.style.cssText = 'position:absolute;display:block;object-fit:cover;' + css;
  let last = plate ? plate.url(0) : ctx.asset(src);
  img.src = last;
  return {
    img,
    async frame(t) {
      if (plate) { const want = plate.url(Math.min(plate.n - 1, Math.max(0, Math.round(t * 2)))); if (want !== last) { img.src = want; last = want; await img.decode().catch(() => null); } }
      else if (!img.complete) await img.decode().catch(() => null);
    },
  };
}

// caption timing (plain math, used by cues/hero in Node too): ~3 words/s from captionAt (default 4), compressed so the
// last word lands by ~72 % of the shot
export function reelCapPlan(s, D) {
  const n = reelWords(s.caption).length, start = Number(s.captionAt ?? 4);
  if (!n) return null;
  const last = Math.max(start, .72 * D - 6);
  const per = n > 1 ? Math.min(10, Math.max(2.5, (last - start) / (n - 1))) : 10;
  return { n, start, per, end: start + per * (n - 1) + 6 };
}

// word-pop caption (layer `caption`): white heavy type with an ink stroke and drop, max 2 lines, centred low in the safe
// area; words pop in one at a time, the newest on an accent plate. Returns {top, bottom, render(t)} or null.
export function reelCaption(ctx, F, P, s) {
  const plan = reelCapPlan(s, ctx.D);
  if (!plan) return null;
  const { W, H, u, portrait, square, safe, K } = ctx;
  const size = (portrait ? 60 : square ? 50 : 50) * u, maxW = portrait ? safe.w : square ? safe.w * .9 : W * .62;
  const cy = H * (portrait ? .7 : square ? .83 : .845);
  const wrap = ctx.el('', `left:${((W - maxW) / 2).toFixed(2)}px;top:0;width:${maxW.toFixed(2)}px`, 'caption');
  const hi = document.createElement('div');
  hi.style.cssText = `position:absolute;left:0;top:0;width:0;height:0;background:${P.acc};transform:skewX(-9deg);opacity:0;box-shadow:.06em .08em 0 ${P.ink}`;
  wrap.appendChild(hi);
  const txt = ctx.text(s.caption, { parent: wrap, size: size / u, weight: F.caption.weight, lh: 1.14, ls: '.01em', color: P.paper, accent: P.acc2, align: 'center', maxW, lines: 2, min: 30,
    style: `font-family:${F.caption.family};font-style:${F.caption.style};text-transform:uppercase;-webkit-text-stroke:.15em ${P.ink};paint-order:stroke fill;text-shadow:0 .07em 0 ${P.ink}` });
  txt.style.left = '0px'; txt.style.top = '0px';
  const fs = parseFloat(txt.style.fontSize), h = txt.offsetHeight, top = Math.min(cy - h / 2, safe.y1 - h);
  wrap.style.top = top.toFixed(2) + 'px'; wrap.style.height = h + 'px';
  hi.style.fontSize = fs + 'px';
  const words = [...txt.querySelectorAll('.lv-w')].filter(w => w.textContent.trim());   // ctx.text leaves empty spans at spaces
  if (words.length !== plan.n) throw new Error(`${s.block} ${s.id}: caption has ${words.length} words on screen but ${plan.n} in its timing — report this caption`);
  const box = words.map(w => ({ x: w.offsetLeft, y: w.offsetTop, w: w.offsetWidth, h: w.offsetHeight }));
  const cap = (.5 * (1.14 - 1.21) + .969 - .727) * fs;          // cap-top offset inside a word box (Inter metrics, lh 1.14)
  return {
    top, bottom: top + h, el: wrap,
    front() { ctx.root.appendChild(wrap); },              // the caption is built first (blocks lay out above it), drawn last
    render(t) {
      let cur = -1;
      words.forEach((w, i) => {
        const a = plan.start + i * plan.per, k = K.u01(t, a, a + 6);
        if (t >= a) cur = i;
        w.style.opacity = K.clamp(k * 3).toFixed(3);
        w.style.transform = k >= 1 ? 'none' : `translateY(${((1 - K.outCubic(k)) * .22 * fs).toFixed(2)}px) scale(${K.lerp(.5, 1, K.outBack(k, 2.4)).toFixed(4)})`;
      });
      if (cur < 0) { hi.style.opacity = '0'; return; }
      const a = plan.start + cur * plan.per, k = K.outCubic(K.u01(t, a, a + 3)), b = box[cur], p = box[Math.max(0, cur - 1)];
      const from = cur > 0 && Math.abs(p.y - b.y) < 2 ? p : b, lerp = (x, y) => x + (y - x) * k;
      const x = lerp(from.x, b.x), w = lerp(from.w, b.w);
      hi.style.opacity = K.clamp(K.u01(t, plan.start, plan.start + 2) * 1.5).toFixed(3);
      hi.style.left = (x - .14 * fs).toFixed(2) + 'px'; hi.style.width = (w + .28 * fs).toFixed(2) + 'px';
      hi.style.top = (b.y + cap - .13 * fs).toFixed(2) + 'px'; hi.style.height = (.727 * fs + .26 * fs).toFixed(2) + 'px';
    },
  };
}

// the box a block lays itself out in: the safe area above the caption
// (inset a little at the top: tilted type and the camera's slow push carry the corners outward)
export function reelArea(ctx, cap) {
  const { safe, u, H, portrait } = ctx, y0 = safe.y0 + (portrait ? .014 : .008) * H, y1 = cap ? Math.min(safe.y1, cap.top - 30 * u) : safe.y1;
  return { x0: safe.x0, x1: safe.x1, y0, y1, w: safe.w, h: y1 - y0, cx: (safe.x0 + safe.x1) / 2, cy: (y0 + y1) / 2 };
}

// the bounding box of rects {x, y, w, h} rotated by deg about c = {x, y} — over the idle wobble too (deg ± wob) and
// grown by `grow` (a fraction) about c for the breathing scale, so the moving lockup stays where the still one was checked
export function reelEnvelope(rects, c, deg, wob = 0, grow = 0) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const d of wob ? [deg - wob, deg + wob] : [deg]) {
    const r = d * Math.PI / 180, co = Math.cos(r), si = Math.sin(r);
    for (const q of rects) for (const [x, y] of [[q.x, q.y], [q.x + q.w, q.y], [q.x, q.y + q.h], [q.x + q.w, q.y + q.h]]) {
      const dx = (x - c.x) * (1 + grow), dy = (y - c.y) * (1 + grow), X = c.x + dx * co - dy * si, Y = c.y + dx * si + dy * co;
      x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y);
    }
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

// shift a placed sticker so its envelope, tilted by deg about its centre, sits inside the area box A
export function reelNudge(st, A, deg, wob = .6) {
  const e = reelEnvelope(st.rects(), { x: st.x + st.w / 2, y: st.y + st.h / 2 }, deg, wob, .006);
  const dx = Math.max(A.x0 - e.x0, Math.min(0, A.x1 - e.x1)), dy = Math.max(A.y0 - e.y0, Math.min(0, A.y1 - e.y1));
  if (dx || dy) st.place(st.x + dx, st.y + dy);
  return st;
}

// small slanted label chip (Before / INPUT …): a one-line sticker in the `dark` / `lime` / `light` look
export const reelChip = (ctx, F, P, copy, look, size, layer) => reelSticker(ctx, F, P, copy, { look, size, maxW: 1e5, maxLines: 1, layer, ls: '.02em', font: { ...F.display, weight: Math.min(900, F.display.weight) } });

// --grid warning shared by the reel blocks (Node side): a caption faster than ~5 words/s. (Reading time over all of a
// shot's copy is the timeline's own check — it reads every block's copy(s).)
export function reelWarn(s, D) {
  const out = [], p = reelCapPlan(s, D);
  if (p && p.n > 1 && p.per < 6) out.push(`${s.block} ${s.id}: caption "${s.caption}" pops ${(30 / p.per).toFixed(1)} words/s — cut words or lengthen the shot`);
  return out;
}
