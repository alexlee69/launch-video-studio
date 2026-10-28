// stack — a deep 3D card stack: cards (images or footage) in a receding perspective row; they cycle to the
// front one by one (fast at first, then slower), the last one turns to face the camera and settles while the rest fall
// back, and an optional status pill with a mascot lands over the front card. Real CSS 3D (one shared perspective on
// the stack; the layer wrapper isolates the cards' z-order).
import { F } from './_film.js';


const cardsOf = s => [].concat(s.cards || []).map(String);
// cycle schedule: the queue moves one card forward at each T[k] (decelerating cadence), the last card settles at end
function plan(s, D) {
  const n = Math.max(2, Math.min(14, Number(s.count) || Math.max(8, cardsOf(s).length)));
  const t0 = 6, settle = Math.min(D * .62, D - 30), span = settle - t0;
  const T = Array.from({ length: n - 1 }, (_, k) => t0 + span * Math.pow((k + 1) / (n - 1), 1.45));
  return { n, T, settle: T[T.length - 1], mv: Math.max(5, Math.min(9, span / (n - 1) * .9)), pillAt: s.pillAt != null ? F.at(s.pillAt) : T[T.length - 1] + 6 };
}
export default {
  name: 'stack',
  doc: 'A deep 3D card stack: cards recede in perspective, cycle to the front one by one (fast, then slower), the last one turns to face the camera and settles; an optional status pill with a mascot lands over it.',
  layers: 'cards · pill',
  // card footage is extracted at a reduced size (the plate's longer side = .75 × the frame's): the front card is ≤ 78 % of H
  media: [{ field: 'cards', fit: 'contain', scale: .75 }],
  copy: s => [s.pill].filter(x => x != null && String(x).trim() !== '').map(String),
  params: { cards: 'list of images or footage (cardsFrom: seconds into each), repeated to fill the stack', count: 'cards in the stack (default 8, max 14)', pill: 'status text over the settled front card (optional)', mascot: 'pill avatar: cast index | logo | spark (default 0)', chrome: 'post (default: a dark social-post frame around each image) | none', pillAt: 'local frame for the pill (default: just after the front card settles)' },
  required: ['cards'],
  validate: (s, D) => D < 70 ? [`stack ${s.id}: ${D} frames is tight for a card cycle + settle; give it ≥ 2.5 s`] : [],
  cues: (s, D) => { const p = plan(s, D); return [...p.T.map((t, k) => ({ t: t - 2, kind: 'tick', gain: .55 + .04 * k })), { t: p.settle, kind: 'pop', note: 79 }, ...(s.pill ? [{ t: p.pillAt + 1, kind: 'pop', note: 86, gain: .8 }] : [])]; },
  hero: (s, D) => { const p = plan(s, D); return Math.min(D - 8, Math.round((s.pill ? p.pillAt + 16 : p.settle + 14))); },
  async build(ctx, s) {
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
          const ein = K.outExpo(K.u01(t, -8 + Math.max(0, q) * 1.6, 12 + Math.max(0, q) * 1.6));     // the stack slides in from the right, front card first
          x += (1 - ein) * W * .55; z += (1 - ein) * 120 * u;
          c.d.style.zIndex = String(q < 0 ? 3000 : 1000 - Math.round(q * 10));
          c.d.style.opacity = op.toFixed(3);
          c.d.style.filter = F.filt(F.blur(bl), q > .05 ? `brightness(${(1 - Math.min(.5, q * .07)).toFixed(3)})` : '');
          c.d.style.transform = `translate3d(${(x - fx).toFixed(2)}px,${(y - fy).toFixed(2)}px,${z.toFixed(2)}px) rotateY(${(-ry).toFixed(3)}deg) scale(${sc.toFixed(4)})`;
        });
        if (pill) { F.pillAt(K, pill, pm, t, P.pillAt); pill.style.transform = `translateY(${(3 * u * Math.sin(t * .09)).toFixed(2)}px)`; }
      },
    };
  },
};
