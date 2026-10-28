// fan — one → many: an odd number of clip cards dealt out of the hero card onto a concave arc (a hand of cards seen
// from the front: the hero big and in front, the tiers stepping down and back, turned towards the centre — real CSS 3D
// under one shared perspective), a slow pull-back while it holds, then a push into the picked card over the last ~10
// frames (the others fan out) so the next shot can cut in close. 9:16 shows three taller cards.
import { F } from './_film.js';
import { M } from './_motion.js';

const cardsOf = s => M.list(s.cards).map(String);
const labelsOf = s => M.list(s.labels).map(x => x == null ? '' : String(x));
// how many cards on the arc (odd, 3–9): `count`, else the number of cards when that is odd and 3–9, else 5
function countOf(s) {
  const n = cardsOf(s).length, c = Number(s.count);
  if (Number.isInteger(c) && c >= 3 && c <= 9 && c % 2) return c;
  return n >= 3 && n <= 9 && n % 2 ? n : 5;
}
const pickOf = s => { const n = Math.max(1, cardsOf(s).length); return s.pick != null && Number.isInteger(Number(s.pick)) ? ((Number(s.pick) % n) + n) % n : Math.floor((n - 1) / 2); };
// deal schedule: the hero first, each tier 3 frames later; the push takes the last 10 frames
function plan(s, D, half = (countOf(s) - 1) / 2) {
  // pre-rolled: the cut lands mid-deal (the hero ~90 % grown, the first tier half-way, the rest still to come)
  const deal = k => -5 + Math.abs(k) * 3, land = k => deal(k) + 16, push = Math.max(land(half) + 6, D - 10);
  return { half, deal, land, push, chips: k => land(k) - 6 };
}
// the first tier (1…) whose chip would leave the title-safe box on a W × H frame (a rough layout estimate for validate):
// the tier's centre ± half a chip outside x0 = 7 % … x1 = 93 %; returns a tier beyond the arc when none bleed
function bleedTier(s, W, H) {
  const u = Math.min(W, H) / 1080, half = (countOf(s) - 1) / 2, heroH = s.text ? H * .62 : H * .66, ratio = 5 / 4;
  let xr = 0, prevW = heroH / ratio;
  for (let a = 1; a <= half; a++) {
    const h = heroH * (1 / 1.28) * Math.pow(.8, a - 1), w = h / ratio;
    xr += (prevW / 2 + w / 2) * .56; prevW = w;
    if (W / 2 + xr * .92 + 60 * u > W * .93) return a;
  }
  return half + 1;
}
export default {
  name: 'fan',
  doc: 'One → many: an odd number of clip cards dealt out of the hero onto a concave 3D arc (hero 1.28× and in front, tiers stepping down), a slow pull-back, then a push into the picked card for the cut; optional chip per card and a headline.',
  layers: 'text · cards · labels',
  // card footage is extracted at .75 of the frame's longer side (the hero card is ≤ 64 % of the height before the push)
  media: [{ field: 'cards', fit: 'contain', scale: .75 }],
  copy: s => [s.text, ...labelsOf(s)].filter(x => x != null && String(x).trim() !== '').map(String),
  read: s => [s.text].filter(x => x != null && String(x).trim() !== '').map(String),
  params: {
    cards: 'list of images or footage (cardsFrom: seconds into each), repeated round the arc',
    count: 'cards on the arc: odd, 3–9 (default: the number of cards when odd, else 5; 9:16 shows the middle 3)',
    pick: 'which card (0-based index into cards) is the hero in the centre — the push ends on it (default: the middle card)',
    labels: 'optional chip per card, in the order of cards, e.g. [Clips, Stills, Captions]',
    text: 'optional headline above the fan (*accent* ok)',
  },
  required: ['cards'],
  validate(s, D) {
    const w = [], P = plan(s, D);
    if (D < P.land(P.half) + 22) w.push(`fan ${s.id}: ${D} frames is tight to deal ${countOf(s)} cards, hold and push in; give it ≥ ${((P.land(P.half) + 22) / 30).toFixed(1)} s`);
    if (s.count != null && !(Number.isInteger(Number(s.count)) && Number(s.count) % 2)) w.push(`fan ${s.id}: count ${s.count} is not odd — using ${countOf(s)}`);
    if (labelsOf(s).length > cardsOf(s).length) w.push(`fan ${s.id}: ${labelsOf(s).length} labels for ${cardsOf(s).length} cards — the extra labels are not shown`);
    // outer tiers bleed off the frame by design: their chips are not shown (the build drops a chip that would leave the
    // title-safe box; 9:16 shows 3 cards). Estimated per aspect from the arc's layout
    if (labelsOf(s).some(x => x.trim())) {
      const off = Object.entries({ '16x9': [1920, 1080], '1x1': [1080, 1080] }).filter(([, [W, H]]) => bleedTier(s, W, H) <= (countOf(s) - 1) / 2).map(([a]) => a);
      if (off.length) w.push(`fan ${s.id}: count ${countOf(s)} — the outer cards bleed off the frame on ${off.join(', ')}; a label whose chip would leave the frame is dropped there (9:16 shows the middle 3)`);
    }
    return w;
  },
  cues(s, D) {
    const P = plan(s, D), out = [{ t: 0, kind: 'hit', note: 84, gain: .55 }];
    // pre-rolled: a card landing in the opening hit's tail (the first 6 frames) gets no pop of its own — the hit carries it
    for (let a = 0; a <= P.half; a++) if (P.land(a) - 7 >= 6) out.push({ t: P.land(a) - 7, kind: 'pop', note: [79, 83, 86, 89, 91][a] || 91, gain: .6 + .05 * a });
    return out;
  },
  hero: (s, D) => { const P = plan(s, D); return Math.max(8, Math.min(D - 12, Math.max(P.land(P.half) + 8, Math.round(D * .5)))); },
  async build(ctx, s) {
    const { W, H, u, safe, portrait, square } = ctx, C = ctx.C, dark = ctx.dark;
    const srcs = cardsOf(s), labels = labelsOf(s), n = srcs.length, pick = pickOf(s);
    const half = portrait ? Math.min(1, (countOf(s) - 1) / 2) : (countOf(s) - 1) / 2;
    const P = plan(s, ctx.D, half);
    // headline above the fan
    let head = null;
    if (s.text) {
      head = ctx.text(s.text, { size: portrait ? 84 : square ? 76 : 88, align: 'center', style: 'text-wrap:balance;',  maxW: safe.w * .9, lines: 2, min: 60, layer: 'text', color: dark ? '#FFFFFF' : C.ink, accent: C.accent });
      head.style.width = safe.w * .9 + 'px'; head.style.left = (W / 2 - safe.w * .45) + 'px'; head.style.top = (safe.y0 + (portrait ? 20 : 4) * u) + 'px';
    }
    // a clear band between the headline and the cards' 3D bounds (shadow included): text whose box meets a composited
    // 3D layer's bounds rasterises differently in the full frame than in its --layers pass
    const top = head ? safe.y0 + head.offsetHeight + (portrait ? 80 : 76) * u : 0;
    // card sizes: hero h, then each tier ×.8 of the tier inside it (tier 1 = hero / 1.28)
    const ratio = portrait ? 16 / 9 : 5 / 4;                 // card height / width
    // 9:16: the hero runs down to the platform-UI line (its chip rides inside the card's foot, above that line)
    const hasChips = labels.some(x => x && String(x).trim()), foot = (hasChips ? safe.y1 + 22 * u : H * .9);
    // 16:9 / 1:1 with chips: the hero's chip (straddling its foot) stays inside the box QA checks text in (.93 H)
    const chipFs = (portrait || square ? 40 : 34) * u, low = H * .93 - chipFs * .86 - 8 * u;
    let heroH = portrait ? Math.min(1120 * u, foot - (head ? top + 10 * u : H * .2)) : head ? Math.min(H * .62, (safe.y1 - top) * .93) : H * .66;
    let cy = portrait ? (head ? top + 10 * u + heroH / 2 : (H * .2 + foot) / 2) : head ? top + (H - top) * .48 : H * .5;
    if (!portrait && hasChips && cy + heroH / 2 > low) { heroH = Math.min(heroH, (low - (head ? top : H * .07)) * .98); cy = low - heroH / 2; }
    const tierS = a => a === 0 ? 1 : (1 / 1.28) * Math.pow(.8, a - 1);
    const slots = [];
    let xr = 0;
    for (let a = 0; a <= half; a++) {
      const h = heroH * tierS(a), w = h / ratio;
      if (a) xr += (slots[slots.length - 1].w / 2 + w / 2) * (portrait ? .9 : .56);
      for (const sg of a ? [-1, 1] : [1]) slots.push({ k: sg * a, a, w, h, x: W / 2 + sg * xr, y: cy + a * a * 7 * u, ry: sg * -Math.min(50, a * 17), rz: sg * a * 2.2, z: -a * 110 * u });
    }
    const P0 = 2200 * u, ox = W / 2, oy = cy;
    const wrap = ctx.el('', `left:0;top:0;width:${W}px;height:${H}px;isolation:isolate;perspective:${P0}px;perspective-origin:${ox}px ${oy}px`, 'cards');
    const cards = slots.map(sl => {
      const ci = ((pick + sl.k) % n + n) % n;
      const d = document.createElement('div');
      d.style.cssText = `position:absolute;left:${sl.x - sl.w / 2}px;top:${sl.y - sl.h / 2}px;width:${sl.w}px;height:${sl.h}px;border-radius:${(Math.min(sl.w, sl.h) * .045).toFixed(2)}px;overflow:hidden;background:${dark ? '#1A1B20' : '#DCDEE6'};
        box-shadow:0 ${(sl.h * .06).toFixed(1)}px ${(sl.h * .1).toFixed(1)}px ${dark ? 'rgba(0,0,0,.55)' : 'rgba(20,24,40,.22)'},0 0 0 ${(1.2 * u).toFixed(2)}px ${dark ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.65)'}`;
      d.style.zIndex = String(100 - sl.a * 10);
      const m = F.media(ctx, s, `cards.${ci}`, srcs[ci]);
      d.appendChild(m.img);
      // a soft top sheen (glass) so stills read as cards
      d.insertAdjacentHTML('beforeend', `<div style="position:absolute;left:0;top:0;width:100%;height:100%;background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,0) 32%,rgba(0,0,0,0) 70%,rgba(0,0,0,.18))"></div>`);
      wrap.appendChild(d);
      return { sl, d, m, ci };
    });
    await Promise.all(cards.map(c => c.m.ready()));
    // chips (flat, readable) ride under their cards: positioned each frame from the card's projected bottom edge
    const chips = cards.map(c => {
      const text = labels[c.ci];
      if (!text || !String(text).trim()) return null;
      const fs = chipFs;
      const el = ctx.el('', 'left:0;top:0', 'labels');
      el.innerHTML = `<span class="lv-txt" style="position:relative;display:inline-block;white-space:nowrap;padding:${fs * .34}px ${fs * .72}px ${fs * .38}px;border-radius:99px;font:600 ${fs}px ${ctx.font};letter-spacing:-.01em;color:${dark ? '#111114' : '#FFFFFF'};background:${dark ? '#FFFFFF' : 'rgba(17,17,22,.88)'};box-shadow:0 ${8 * u}px ${22 * u}px rgba(10,12,30,.25)">${ctx.A.esc(text)}</span>`;
      el.style.transformOrigin = '50% 50%';
      return { el, c, w: el.offsetWidth, h: el.offsetHeight };
    });
    const proj = (css, sl, q) => M.project(DOMMatrix, css, { x: sl.x - sl.w / 2, y: sl.y - sl.h / 2 }, { x: sl.w / 2, y: sl.h / 2 }, q, { d: P0, ox, oy });
    // a chip rides on its card's foot: straddling the bottom edge, or inside the foot on 9:16
    const chipDy = ch => portrait ? -ch.h - 30 * u : -ch.h * .5;
    // the cards that bleed off the frame keep no chip: a chip whose box at the landed pose (± the sway) would leave the
    // box QA checks text in (the platform-UI-safe box on 9:16; else title-safe 5 %, minus 2 % for the camera's push) is
    // dropped — decided once, so it never blinks
    const qa = portrait ? safe : { x0: .07 * W, y0: .07 * H, x1: .93 * W, y1: .93 * H };
    chips.forEach((ch, i) => {
      if (!ch) return;
      const { sl } = ch.c, m = 4 * u;
      const out = [-2.2, 2.2].some(sw => {
        const [x, y] = proj(`translate3d(0px,0px,${sl.z.toFixed(2)}px) rotateY(${(sl.ry + sw * (sl.a ? 1 : .5)).toFixed(3)}deg) rotateZ(${sl.rz.toFixed(3)}deg)`, sl, [sl.w / 2, sl.h]);
        const x0 = x - ch.w / 2, y0 = y + chipDy(ch);
        return x0 < qa.x0 + m || x0 + ch.w > qa.x1 - m || y0 < qa.y0 || y0 + ch.h > qa.y1 + 2 * u;
      });
      if (out) { ch.el.remove(); chips[i] = null; }
    });
    return {
      async render(t, D) {
        await Promise.all(cards.map(c => c.m.frame(t)));
        const settle = M.u01(t, P.land(half), P.push), pull = 1 - .03 * M.bell(settle);         // ≤ 1.03 per second
        const pz = M.inCubic(M.u01(t, P.push, D)), Z = 1 + .26 * pz, spread = 1 + .55 * pz;     // the push into the pick
        const sway = 2.2 * Math.sin(t * .035);
        for (const c of cards) {
          const { sl } = c, e = M.outExpo(M.u01(t, P.deal(sl.k), P.land(sl.k))), o = M.u01(t, P.deal(sl.k), P.deal(sl.k) + 3);
          // dealt from the hero's centre: grows 0.06 → 1 along a rising arc
          const ax = M.lerp(W / 2, sl.x, e), ay = M.lerp(cy, sl.y, e) - Math.sin(Math.PI * e) * 46 * u * sl.a;
          const fx = W / 2 + (ax - W / 2) * pull * Z * (sl.a ? spread : 1), fy = cy + (ay - cy) * pull * Z + 4 * u * Math.sin(t * .06 + sl.k);
          const sc = M.lerp(.06, 1, e) * pull * Z, z = sl.z * e, ry = sl.ry * e + sway * (sl.a ? 1 : .5), rz = sl.rz * e;
          c.d.style.opacity = o.toFixed(3);
          c.d.style.filter = F.filt(F.blur(8 * u * (1 - e) + 6 * u * pz * (sl.a ? 1 : 0)));
          c.css = `translate3d(${(fx - sl.x).toFixed(2)}px,${(fy - sl.y).toFixed(2)}px,${z.toFixed(2)}px) rotateY(${ry.toFixed(3)}deg) rotateZ(${rz.toFixed(3)}deg) scale(${sc.toFixed(5)})`;
          c.d.style.transform = c.css;
        }
        for (const ch of chips) {
          if (!ch) continue;
          const { sl } = ch.c, t0 = P.chips(sl.k);
          const [x, y] = proj(ch.c.css, sl, [sl.w / 2, sl.h]);
          const k = M.pop(M.u01(t, t0, t0 + 10), .08);
          // whole pixels: a chip over the 3D cards composites (overlap) in the full frame but not in its --layers pass
          ch.el.style.left = Math.round(x - ch.w / 2) + 'px'; ch.el.style.top = Math.round(y + chipDy(ch)) + 'px';
          ch.el.style.opacity = (M.u01(t, t0, t0 + 3) * (1 - M.u01(t, P.push, P.push + 5))).toFixed(3);
          M.zoomAt(ch.el.firstElementChild, t >= t0 + 10 ? 1 : M.clamp(k, 0, 1.1), .5, .5, ch.w, ch.h);     // the pop by layout (pure in t)
        }
        if (head) {
          const e = M.enter(t, 1, 15, u);
          head.style.opacity = (e.o * (1 - M.u01(t, P.push, P.push + 6))).toFixed(3);
          head.style.filter = F.filt(F.blur(e.blur));
          // once landed the line stays on its own layer (translate3d(0,0,0)): with transform none it rasterised differently in
          // the full frame than in its --layers pass next to the composited 3D cards and chips (f57: 209 px off). The price:
          // a held transform on text depends on the frames drawn before it (a purity re-render differs on the headline)
          head.style.transform = e.k < 1 ? `translate3d(0px,${((1 - e.k) * 28 * u).toFixed(2)}px,0px) scale(${e.s.toFixed(5)})` : 'translate3d(0px,0px,0px)';
        }
      },
    };
  },
};
