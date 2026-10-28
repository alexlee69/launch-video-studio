// stack — a deep 3D card stack: cards (images or footage) in a receding perspective row; they cycle to the
// front one by one (fast at first, then slower), the last one turns to face the camera and settles while the rest fall
// back, and an optional status pill with a mascot lands over the front card. Real CSS 3D (one shared perspective on
// the stack; the layer wrapper isolates the cards' z-order).
import { F } from './_film.js';
import { M } from './_motion.js';
import { originOf } from '../kit.js';


const cardsOf = s => [].concat(s.cards || []).map(String);
// ── mode: exploded (round 1 of the motion kit; the default cycle mode below is untouched) — 3–5 planes (the cards, or
// drawn UI-skeleton layers) stacked flat, then separating along one diagonal (isometric, or a ≤ 12° tilt with
// tilt: low), 48–96 px apart, scale step .95, opacity by depth 1 / .83 / .6 / .45 / .3, staggered 3.5 frames; labels on
// leader lines (≤ 120 px, drawn on over 12 frames, 4 apart); a slow orbit keeps it alive
const isExploded = s => s.mode === 'exploded';
const labelsOf = s => [].concat(s.labels || []).filter(x => x != null && String(x).trim() !== '').map(String).slice(0, 4);
const planesOf = s => { const c = Number(s.count); return Number.isInteger(c) && c >= 3 && c <= 5 ? c : cardsOf(s).length ? Math.max(3, Math.min(5, cardsOf(s).length)) : 4; };
function xplan(s, D) {
  // pre-rolled: on the cut the top plane is already lifting off (the first separation started 1.5 frames before it)
  const n = planesOf(s), sep = -5, step = 3.5, sepEnd = sep + step * (n - 1) + 16, lab = k => sepEnd - 4 + 4 * k;
  return { n, sep, step, sepEnd, lab, labEnd: lab(Math.max(0, labelsOf(s).length - 1)) + 12 };
}
const DEPTH_OP = [1, .83, .6, .45, .3];
async function buildExploded(ctx, s) {
  const { W, H, u, safe, portrait, square } = ctx, C = ctx.C, dark = ctx.dark;
  const P = xplan(s, ctx.D), n = P.n, srcs = cardsOf(s), labels = labelsOf(s), low = s.tilt === 'low';
  // layout: 16:9 = headline left, stack right of centre; 9:16 / 1:1 = headline on top, stack under it
  let head = null;
  if (s.text) {
    head = ctx.text(s.text, { size: portrait ? 80 : square ? 76 : 88, align: portrait || square ? 'center' : 'left', style: 'text-wrap:balance;',  maxW: portrait || square ? safe.w * .94 : W * .34, lines: 3, min: 56, layer: 'text', color: dark ? '#FFFFFF' : C.ink, accent: C.accent });
    if (portrait || square) { head.style.width = safe.w * .94 + 'px'; head.style.left = (W / 2 - safe.w * .47) + 'px'; head.style.top = safe.y0 + 'px'; }
    else { head.style.left = safe.x0 + 'px'; head.style.top = (H / 2 - head.offsetHeight / 2) + 'px'; }
  }
  const pw = portrait ? W * (low ? .6 : head ? .62 : .7) : square ? W * (head ? .48 : .54) : W * (s.text ? .38 : .42), ph = pw * (srcs.length ? .62 : .66);
  const gap = (low ? 92 : 96) * u, spread = (n - 1) * gap;
  // centre the exploded stack: iso planes step down the frame, low-tilt planes up and to the right
  let sx = (portrait ? W * (low ? .46 : .42) : square ? W * .42 : (s.text ? W * .6 : W * .45)) - (low ? spread * .39 : spread * .16);
  let sy = (portrait ? (head ? Math.max(H * .52, safe.y0 + head.offsetHeight + H * .2) : H * .5) : square ? (head ? H * .58 : H * .5) : H * .52) + (low ? spread * .31 : -spread * .4);
  const rad = d => d * Math.PI / 180, f5 = v => v.toFixed(5);
  // 2D matrix of an orthographic rotateY(ry) rotateX(rx) (low) or rotateX(rx) rotateZ(rz) (iso) of a flat plane
  const tf = (k, e, t) => {
    const bob = 3 * u * Math.sin(t * .06 + k * 1.3), sc = Math.pow(.95, k * e);
    if (low) {
      const ry = rad(-12 + 2.5 * Math.sin(t * .025)), rx = rad(6 + 1.2 * Math.sin(t * .021 + 1));
      return `translate(${(k * gap * .78 * e).toFixed(2)}px,${(-k * gap * .62 * e + bob).toFixed(2)}px) matrix(${f5(Math.cos(ry))},0,${f5(Math.sin(rx) * Math.sin(ry))},${f5(Math.cos(rx))},0,0) scale(${sc.toFixed(5)})`;
    }
    const rz = rad(-38 + 3 * Math.sin(t * .02)), rx = rad(54 + 1.5 * Math.sin(t * .023 + .7));
    // translateZ(-k·gap) before the tilt lands k·gap·sin(rx) lower on screen
    return `translate(${(k * gap * .32 * e).toFixed(2)}px,${(bob + k * gap * Math.sin(rx) * e).toFixed(2)}px) matrix(${f5(Math.cos(rz))},${f5(Math.cos(rx) * Math.sin(rz))},${f5(-Math.sin(rz))},${f5(Math.cos(rx) * Math.cos(rz))},0,0) scale(${sc.toFixed(5)})`;
  };
  const proj = (css, q) => M.project(DOMMatrix, css, { x: sx - pw / 2, y: sy - ph / 2 }, { x: pw / 2, y: ph / 2 }, q, { d: 1e9, ox: sx, oy: sy });
  // the landed pose (the label frame): every plane separated, as the hero frame shows it
  const tRef = P.labEnd + 6, lift0 = 1 + .02 * M.u01(tRef, P.sepEnd, ctx.D);
  const restCss = k => tf(k, 1, tRef) + (lift0 !== 1 ? ` scale(${lift0.toFixed(5)})` : '');
  const quad = k => [[0, 0], [pw, 0], [pw, ph], [0, ph]].map(q => proj(restCss(k), q));
  // 9:16: centre the separated stack in the room under the headline (down to the platform-UI line)
  if (portrait) {
    const ys = Array.from({ length: n }, (_, k) => quad(k)).flat().map(p => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const top = head ? safe.y0 + head.offsetHeight + 70 * u : safe.y0, bot = safe.y1 + .03 * H;
    sy += (top + bot) / 2 - (y0 + y1) / 2;
  }
  // the planes are flat 2D projections (orthographic: an isometric view needs no perspective) — 3D-composited planes made
  // the leaders and chips over them composite by overlap, which a --layers pass can't reproduce exactly
  const wrap = ctx.el('', `left:0;top:0;width:${W}px;height:${H}px;isolation:isolate`, 'planes');
  const surf = dark ? '#1C1D23' : '#FFFFFF', line = dark ? 'rgba(255,255,255,.12)' : M.rgba(C.line, .9), skel = dark ? 'rgba(255,255,255,.12)' : 'rgba(17,17,20,.08)';
  const bar = (x, y, w, h, c, r = h / 2) => `<div style="position:absolute;left:${(x * pw).toFixed(1)}px;top:${(y * ph).toFixed(1)}px;width:${(w * pw).toFixed(1)}px;height:${(h * ph).toFixed(1)}px;border-radius:${(r * ph).toFixed(1)}px;background:${c}"></div>`;
  // drawn layers, top to bottom: the UI, its media, the layout grid, the colour field, the base
  const skins = [
    () => `<div style="position:absolute;inset:0;background:${surf}"></div>${bar(.05, .07, .07, .1, M.rgba(C.accent, .9))}${bar(.15, .08, .3, .045, skel)}${bar(.15, .14, .2, .035, skel)}
      ${bar(.05, .26, .9, .36, `linear-gradient(120deg,${M.rgba(C.accent, .22)},${M.rgba(C.accent2 || C.accent, .22)})`, .04)}${bar(.05, .68, .62, .05, skel)}${bar(.05, .76, .48, .05, skel)}${bar(.66, .82, .29, .11, C.accent)}`,
    () => `<div style="position:absolute;inset:0;background:linear-gradient(135deg,${C.accent},${C.accent2 || C.accent})"></div><div style="position:absolute;left:${.48 * pw}px;top:${-.2 * ph}px;width:${.7 * pw}px;height:${.7 * pw}px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,255,255,.45),rgba(255,255,255,0))"></div>`,
    () => `<div style="position:absolute;inset:0;background:${dark ? '#17181D' : '#F7F8FB'};background-image:linear-gradient(${line} ${1.5 * u}px,transparent ${1.5 * u}px),linear-gradient(90deg,${line} ${1.5 * u}px,transparent ${1.5 * u}px);background-size:${pw / 8}px ${ph / 5}px"></div>${[.05, .53].map(x => `<div style="position:absolute;left:${x * pw}px;top:${.08 * ph}px;width:${.42 * pw}px;height:${.84 * ph}px;border-radius:${.04 * ph}px;box-shadow:inset 0 0 0 ${2 * u}px ${M.rgba(C.accent, .7)}"></div>`).join('')}`,
    () => `<div style="position:absolute;inset:0;background:linear-gradient(160deg,${C.accent3 || C.accent},${M.mix(C.accent3 || C.accent, C.accent2 || C.accent, .5)})"></div>`,
    () => `<div style="position:absolute;inset:0;background:${dark ? '#0E0E12' : '#E9EAF0'};background-image:radial-gradient(${dark ? 'rgba(255,255,255,.14)' : 'rgba(17,17,20,.12)'} ${1.6 * u}px,transparent ${1.9 * u}px);background-size:${22 * u}px ${22 * u}px"></div>`,
  ];
  const planes = Array.from({ length: n }, (_, k) => {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;left:${sx - pw / 2}px;top:${sy - ph / 2}px;width:${pw}px;height:${ph}px;border-radius:${(Math.min(pw, ph) * .045).toFixed(1)}px;overflow:hidden;
      box-shadow:0 0 0 ${(1.2 * u).toFixed(2)}px ${dark ? 'rgba(255,255,255,.12)' : 'rgba(17,17,20,.08)'},0 ${(18 * u).toFixed(1)}px ${(46 * u).toFixed(1)}px ${dark ? 'rgba(0,0,0,.45)' : 'rgba(20,24,40,.14)'}`;
    d.style.zIndex = String(100 - k);
    let m = null;
    if (srcs.length) { m = F.media(ctx, s, `cards.${k % srcs.length}`, srcs[k % srcs.length]); d.appendChild(m.img); }
    else d.innerHTML = skins[Math.min(k, skins.length - 1)]();
    wrap.appendChild(d);
    return { d, m, k };
  });
  await Promise.all(planes.filter(p => p.m).map(p => p.m.ready()));
  // leaders (one SVG) and label chips, laid out per frame from the planes' projected right edges
  const leaders = labels.length ? ctx.el(`<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;overflow:visible">${labels.map(() => `<g><path fill="none" stroke="${dark ? 'rgba(255,255,255,.7)' : M.rgba(C.ink, .55)}" stroke-width="${(2 * u).toFixed(2)}" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/><circle r="${(6 * u).toFixed(2)}" fill="${C.accent}" stroke="${dark ? '#0E0E12' : '#FFFFFF'}" stroke-width="${(3 * u).toFixed(2)}" opacity="0"/></g>`).join('')}</svg>`, `left:0;top:0;width:${W}px;height:${H}px`, 'leaders') : null;
  const lfs = (portrait || square ? 40 : 34) * u;
  const chips = labels.map(text => {
    const el = ctx.el(`<span class="lv-txt" style="position:relative;display:inline-block;white-space:nowrap;padding:${lfs * .3}px ${lfs * .62}px ${lfs * .34}px;border-radius:${lfs * .5}px;font:600 ${lfs}px ${ctx.font};letter-spacing:-.01em;color:${dark ? '#FFFFFF' : C.ink};background:${dark ? 'rgba(36,37,45,.92)' : 'rgba(255,255,255,.94)'};box-shadow:0 ${6 * u}px ${18 * u}px rgba(10,12,30,${dark ? .45 : .12}),0 0 0 ${1.2 * u}px ${dark ? 'rgba(255,255,255,.1)' : 'rgba(17,17,20,.06)'}">${ctx.A.esc(text)}</span>`, 'left:0;top:0', 'labels');
    return { el, w: el.offsetWidth, h: el.offsetHeight };
  });
  const lines = leaders ? [...leaders.querySelectorAll('path')] : [], dots = leaders ? [...leaders.querySelectorAll('circle')] : [];
  // each label's anchor (a point in its plane's own box): on the plane's visible margin at the landed pose — at least
  // 10 px clear of every plane in front of it — the right-most such point (nearest the labels); with no such point, the
  // least covered one. Decided once, then projected every frame
  const clearOf = (pt, poly) => {        // signed distance outside a convex polygon (< 0 inside)
    const o = poly.reduce((a, p, i) => { const q = poly[(i + 1) % poly.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) > 0 ? 1 : -1;
    return -Math.min(...poly.map((p, i) => { const q = poly[(i + 1) % poly.length], ex = q[0] - p[0], ey = q[1] - p[1]; return o * (ex * (pt[1] - p[1]) - ey * (pt[0] - p[0])) / (Math.hypot(ex, ey) || 1); }));
  };
  const quads = Array.from({ length: n }, (_, k) => quad(k));
  const anc = Array.from({ length: n }, (_, k) => {
    const cand = [];
    for (const m of [.025, .045, .07]) for (let i = 0; i <= 16; i++) { const f = m + (1 - 2 * m) * i / 16; cand.push([f * pw, m * ph], [(1 - m) * pw, f * ph], [f * pw, (1 - m) * ph], [m * pw, f * ph]); }
    const cyk = quads[k].reduce((a, p) => a + p[1], 0) / 4;
    let best = null, open = null;
    for (const q of cand) {
      const [x, y] = proj(restCss(k), q), clear = k ? Math.min(...quads.slice(0, k).map(Q => clearOf([x, y], Q))) : Infinity;
      if (clear >= 10 * u) { const score = x - .25 * Math.abs(y - cyk); if (!best || score > best.score) best = { q, score }; }
      if (!open || clear > open.clear) open = { q, clear };
    }
    return best ? best.q : open.q;
  });
  return {
    async render(t, D) {
      await Promise.all(planes.filter(p => p.m).map(p => p.m.frame(t)));
      const en = M.enter(t, -8, 15, u), lift = 1 + .02 * M.u01(t, P.sepEnd, D);     // pre-rolled: mostly arrived on frame 0
      const css = [];
      for (const p of planes) {
        const e = M.outExpo(M.u01(t, P.sep + P.step * p.k, P.sep + P.step * p.k + 16));
        const c = tf(p.k, e, t) + (en.s !== 1 || lift !== 1 ? ` scale(${(en.s * lift).toFixed(5)})` : '');
        css.push(c);
        p.d.style.transform = c;
        p.d.style.opacity = (en.o * M.lerp(1, DEPTH_OP[Math.min(4, p.k)], e)).toFixed(3);
        p.d.style.filter = F.filt(F.blur(en.blur));
      }
      // anchors: each label's point on its own plane (chosen once, clear of the planes in front), projected; the chips
      // are spread so they never overlap (at least their height + 10 px apart), then line up in one column right of
      // the stack — pulled in where a leader would run past 120 px
      const len = 96 * u, maxL = 118 * u;
      const L = chips.map((ch, k) => { if (k >= n) return null; const [ax, ay] = proj(css[k], anc[k]); return { ch, k, ax, ay, by: ay - len * .3 }; }).filter(Boolean);
      const byY = L.slice().sort((a, b) => a.by - b.by);
      for (let i = 1; i < byY.length; i++) { const min = byY[i - 1].by + (byY[i - 1].ch.h + byY[i].ch.h) / 2 + 10 * u; if (byY[i].by < min) byY[i].by = min; }
      const col = Math.max(...L.map(l => l.ax)) + len * .7;
      for (const { ch, k, ax, ay, by } of L) {
        const run = Math.sqrt(Math.max(0, (maxL - 14 * u) ** 2 - (by - ay) ** 2));
        const bx = Math.min(col, ax + 14 * u + run, safe.x1 - ch.w - 10 * u);
        const a = P.lab(k), dr = M.outExpo(M.u01(t, a, a + 12));
        lines[k].setAttribute('d', `M${ax.toFixed(2)} ${ay.toFixed(2)}L${(bx - 14 * u).toFixed(2)} ${by.toFixed(2)}L${bx.toFixed(2)} ${by.toFixed(2)}`);
        lines[k].setAttribute('stroke-dashoffset', (1 - dr).toFixed(4));
        dots[k].setAttribute('cx', ax.toFixed(2)); dots[k].setAttribute('cy', ay.toFixed(2));
        dots[k].setAttribute('opacity', M.u01(t, a - 2, a + 2).toFixed(3));
        // whole pixels: a chip over the 3D planes composites (overlap) in the full frame but not in its --layers pass
        ch.el.style.left = Math.round(bx + 10 * u) + 'px'; ch.el.style.top = Math.round(by - ch.h / 2) + 'px';
        const pk = M.pop(M.u01(t, a + 6, a + 15), .06);
        ch.el.style.opacity = M.u01(t, a + 6, a + 9).toFixed(3);
        M.zoomAt(ch.el.firstElementChild, t >= a + 15 ? 1 : M.clamp(pk, 0, 1.08), 0, .5, ch.w, ch.h);     // the pop by layout (pure in t)
      }
      if (head) {
        const e = M.enter(t, 2, 15, u);
        head.style.opacity = e.o.toFixed(3); head.style.filter = F.filt(F.blur(e.blur));
        head.style.transform = e.k < 1 ? `translateY(${((1 - e.k) * 28 * u).toFixed(2)}px) scale(${e.s.toFixed(5)})` : 'none';     // landed: none (pure in t)
      }
    },
  };
}
// cycle schedule: the queue moves one card forward at each T[k] (decelerating cadence), the last card settles at end
// round 2 `from:` (grow from a point): the cards are born at the origin, front card first, and the cycle starts once
// they have landed (t0 18 instead of 6)
const born = s => s.i > 0 && originOf(s, { origin: true }) != null;
function plan(s, D) {
  const n = Math.max(2, Math.min(14, Number(s.count) || Math.max(8, cardsOf(s).length)));
  const t0 = born(s) ? 18 : 6, settle = Math.min(D * .62, D - 30), span = settle - t0;
  const T = Array.from({ length: n - 1 }, (_, k) => t0 + span * Math.pow((k + 1) / (n - 1), 1.45));
  return { n, T, settle: T[T.length - 1], mv: Math.max(5, Math.min(9, span / (n - 1) * .9)), pillAt: s.pillAt != null ? F.at(s.pillAt) : T[T.length - 1] + 6 };
}
export default {
  name: 'stack',
  doc: 'A deep 3D card stack: cards recede in perspective, cycle to the front one by one (fast, then slower), the last one turns to face the camera and settles; an optional status pill with a mascot lands over it. mode: exploded = 3–5 planes (cards or drawn UI layers) separating along one diagonal with labels on leader lines.',
  layers: 'cards · pill (mode: exploded → text · planes · leaders · labels)',
  origin: true,             // from: <layer of the previous shot> | [x, y] — the cards grow out of that point (default cycle mode)
  // card footage is extracted at a reduced size (the plate's longer side = .75 × the frame's): the front card is ≤ 78 % of H
  media: [{ field: 'cards', fit: 'contain', scale: .75 }],
  copy: s => (isExploded(s) ? [s.text, ...labelsOf(s)] : [s.pill]).filter(x => x != null && String(x).trim() !== '').map(String),
  // exploded: the headline is read; the plane labels are glanced (the default cycle mode keeps reading its copy)
  read: s => isExploded(s) ? [s.text].filter(x => x != null && String(x).trim() !== '').map(String) : null,
  params: { cards: 'list of images or footage (cardsFrom: seconds into each), repeated to fill the stack', count: 'cards in the stack (default 8, max 14)', pill: 'status text over the settled front card (optional)', mascot: 'pill avatar: cast index | logo | spark (default 0)', chrome: 'post (default: a dark social-post frame around each image) | none', pillAt: 'local frame for the pill (default: just after the front card settles)',
    mode: 'cycle (default: the card cycle) | exploded (3–5 planes separating along a diagonal, with labels; cards optional)', tilt: 'exploded: iso (default, an isometric ~30° view) | low (a ≤ 12° tilt)',
    labels: 'exploded: one label per plane, top plane first (≤ 4 shown), on leader lines', text: 'exploded: optional headline (left on 16:9, on top on 9:16 / 1:1)',
    from: 'a layer of the previous shot (e.g. prompt-box) or [x, y]: the cards are born there and fly to the stack, front card first (default cycle mode)' },
  // cards are required in the default cycle mode (lib/spec.mjs checks it; exploded draws UI-skeleton planes without them)
  required: [],
  validate: (s, D) => {
    if (!isExploded(s)) return D < 70 ? [`stack ${s.id}: ${D} frames is tight for a card cycle + settle; give it ≥ 2.5 s`] : [];
    const w = [], P = xplan(s, D);
    if (D < P.labEnd + 12) w.push(`stack ${s.id}: ${D} frames is tight to separate ${P.n} planes and draw their labels; give it ≥ ${((P.labEnd + 12) / 30).toFixed(1)} s`);
    if ([].concat(s.labels || []).length > 4) w.push(`stack ${s.id}: ${[].concat(s.labels).length} labels — exploded shows at most 4 (a frame holds 3–4 callouts)`);
    if (s.pill != null) w.push(`stack ${s.id}: pill is not shown in mode: exploded`);
    return w;
  },
  cues: (s, D) => {
    if (isExploded(s)) { const P = xplan(s, D); return [{ t: 0, kind: 'hit', note: 82, gain: .5 }, ...Array.from({ length: P.n - 1 }, (_, k) => ({ t: P.sep + P.step * (k + 1) + 3, kind: 'pop', note: [79, 83, 86, 88][k], gain: .55 })).filter(c => c.t >= 6), ...labelsOf(s).slice(0, P.n).map((_, k) => ({ t: P.lab(k) + 6, kind: 'tick', gain: .5 }))]; }
    const p = plan(s, D); return [...p.T.map((t, k) => ({ t: t - 2, kind: 'tick', gain: .55 + .04 * k })), { t: p.settle, kind: 'pop', note: 79 }, ...(s.pill ? [{ t: p.pillAt + 1, kind: 'pop', note: 86, gain: .8 }] : [])];
  },
  hero: (s, D) => { if (isExploded(s)) { const P = xplan(s, D); return Math.max(8, Math.min(D - 8, Math.round(P.labEnd + 6))); } const p = plan(s, D); return Math.min(D - 8, Math.round((s.pill ? p.pillAt + 16 : p.settle + 14))); },
  async build(ctx, s) {
    if (isExploded(s)) return buildExploded(ctx, s);
    const { W, H, u, K, A, safe, portrait, square } = ctx, B = ctx.brand.colors;
    const P = plan(s, ctx.D), srcs = cardsOf(s), post = s.chrome !== 'none';
    const ch = portrait ? Math.min(safe.h * .62, safe.w * .9 * 1.25) : square ? H * .62 : H * .72, cw = ch * .8;
    const fx = portrait ? W * .56 : square ? W * .6 : W * .63, fy = portrait ? H * .5 : H * .5;
    const step = portrait ? { x: -30 * u, y: -58 * u } : { x: -118 * u, y: -30 * u };
    const wrap = ctx.el('', `left:0;top:0;width:${W}px;height:${H}px;isolation:isolate;perspective:${2200 * u}px;perspective-origin:${fx - (portrait ? 80 : 260) * u}px ${fy - 60 * u}px`, 'cards');
    const rnd = F.rng(F.hash('stack:' + s.id));
    const cards = Array.from({ length: P.n }, (_, i) => {
      const src = srcs[i % srcs.length], field = `cards.${i % srcs.length}`;
      const d = document.createElement('div');
      d.style.cssText = `position:absolute;left:${fx - cw / 2}px;top:${fy - ch / 2}px;width:${cw}px;height:${ch}px;border-radius:${26 * u}px;overflow:hidden;background:${post ? '#121216' : '#222'};
        box-shadow:0 ${24 * u}px ${70 * u}px rgba(10,12,30,.28),0 0 0 1px rgba(255,255,255,.06)`;
      const m = F.media(ctx, s, field, src, post ? `left:${16 * u}px;top:${78 * u}px;width:${cw - 32 * u}px;height:${ch - 78 * u - 70 * u}px;border-radius:${14 * u}px` : '');
      if (post) {
        const av = ctx.cast(i), bar = (w, h, c, y, x = 78) => `<div style="position:absolute;left:${x * u}px;top:${y * u}px;width:${w * u}px;height:${h * u}px;border-radius:${h * u}px;background:${c}"></div>`;
        d.innerHTML = `<div style="position:absolute;left:${18 * u}px;top:${18 * u}px;width:${44 * u}px;height:${44 * u}px;border-radius:50%;background:${av.col || B.accent}"></div>
          ${bar(120 + rnd() * 80, 12, 'rgba(255,255,255,.85)', 22)}${bar(80 + rnd() * 60, 10, 'rgba(255,255,255,.35)', 44)}
          ${[0, 1, 2, 3].map(j => `<div style="position:absolute;left:${(22 + j * (cw / u - 44) / 4) * u}px;top:${(ch / u - 46)}px;display:flex;gap:${8 * u}px;align-items:center"><div style="width:${18 * u}px;height:${18 * u}px;border-radius:50%;box-shadow:inset 0 0 0 ${2.4 * u}px rgba(255,255,255,.5)"></div><div style="width:${(26 + rnd() * 16) * u}px;height:${9 * u}px;border-radius:9px;background:rgba(255,255,255,.3)"></div></div>`).join('')}`;
      }
      d.prepend(m.img);
      wrap.appendChild(d);
      return { d, m };
    });
    await Promise.all(cards.map(c => c.m.ready()));
    let pill = null, pm = 0;
    if (s.pill) {
      const fs = 30 * u;
      pill = ctx.el(F.pill(ctx, s.pill, s.mascot ?? 0, fs, false), 'left:0;top:0', 'pill');
      pm = fs * 2.6;
      // over the settled front card's lower edge, starting a little in from its left side
      pill.style.left = Math.max(safe.x0, Math.min(safe.x1 - pill.offsetWidth, fx - cw * 1.08 / 2 + cw * .06)) + 'px';
      pill.style.top = Math.min(safe.y1 - pill.offsetHeight, fy + ch * 1.08 / 2 - pill.offsetHeight * .55) + 'px';
    }
    const posAt = t => P.T.reduce((a, T) => a + K.ioCubic(K.u01(t, T - P.mv, T)), 0);
    return {
      async render(t) {
        const pos = posAt(t), v = (posAt(t + .25) - posAt(t - .25)) * 2;        // cards per frame
        const st = K.outExpo(K.u01(t, P.settle, P.settle + 18));
        const sway = Math.sin(t * .045) * 2.2;
        await Promise.all(cards.map(c => c.m.frame(t)));
        cards.forEach((c, i) => {
          let q = i - pos; if (q < -1) q += P.n;          // a card that left the front rejoins the back of the stack (unseen)
          const last = i === P.n - 1;
          let x = fx + q * step.x, y = fy + q * step.y, z = -q * 150 * u, ry = 26 + sway * .4, sc = 1, op = 1, bl = 0;
          if (q < 0) {             // flown out: forward and to the right, turning
            const f = -q;
            x = fx + f * 820 * u; y = fy - f * 40 * u; z = f * 260 * u; ry = 24 - 40 * f; op = K.clamp(1 - f * 1.6);
          }
          if (q >= 0) { op = K.clamp(1 - (q - 8) * .8) * K.clamp(K.u01(t, -8 + q * 1.6, -2 + q * 1.6)); bl = Math.min(3 * u, q * .3 * u); }
          bl += Math.min(10 * u, Math.abs(v) * 14 * u * K.clamp(1.2 - Math.abs(q)));      // motion blur on the cards in transit
          if (last) { x = K.lerp(x, fx - (portrait ? 20 : 60) * u, st); y = K.lerp(y, fy, st); z = K.lerp(z, 70 * u, st); ry = K.lerp(ry, sway * .6, st); sc = K.lerp(1, 1.08, st); }
          else if (q > 0) { z -= 160 * u * st; x -= 60 * u * st; op *= 1 - .3 * st; }
          let bank = 0;
          if (ctx.origin) {        // born at the origin (scale ~.06, depth 0 so the point is on screen where it was), front card first
            const gr = K.grow(ctx.origin, { x, y }, t, { t0: 2 * Math.min(i, 6) - .5, len: 16, bank: i % 2 ? 5 : -6, w: cw, h: ch, lead: !i });
            if (gr.k < 1) { x = gr.x; y = gr.y; z *= K.clamp(gr.k); sc *= gr.s; op *= gr.op; bank = gr.rot; }
          } else {
          const ein = K.outExpo(K.u01(t, -8 + Math.max(0, q) * 1.6, 12 + Math.max(0, q) * 1.6));     // the stack slides in from the right, front card first
          x += (1 - ein) * W * .55; z += (1 - ein) * 120 * u;
          }
          c.d.style.zIndex = String(q < 0 ? 3000 : 1000 - Math.round(q * 10));
          c.d.style.opacity = op.toFixed(3);
          c.d.style.filter = F.filt(F.blur(bl), q > .05 ? `brightness(${(1 - Math.min(.5, q * .07)).toFixed(3)})` : '');
          c.d.style.transform = `translate3d(${(x - fx).toFixed(2)}px,${(y - fy).toFixed(2)}px,${z.toFixed(2)}px) rotateY(${(-ry).toFixed(3)}deg) scale(${sc.toFixed(4)})${bank ? ` rotateZ(${bank.toFixed(3)}deg)` : ''}`;
        });
        if (pill) { F.pillAt(K, pill, pm, t, P.pillAt); pill.style.transform = `translateY(${(3 * u * Math.sin(t * .09)).toFixed(2)}px)`; }
      },
    };
  },
};
