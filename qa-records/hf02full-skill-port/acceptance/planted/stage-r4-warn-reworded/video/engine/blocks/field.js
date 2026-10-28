import * as K from '../kit.js';
import * as A from '../art.js';
import { split, placeText, headSize, headLines, drift } from './_layout.js';

const RINGS = [8, 10, 8];
export default {
  name: 'field',
  doc: 'Headline beside a hero surrounded by orbiting app tiles in three rings; the tiles fling outward on a zoom-out exit.',
  layers: 'headline · icons · characters (logo with hero: logo)',   // --layers export, back to front
  params: { text: 'headline', hero: 'cast index (default 1) or "logo"', icons: 'optional list of asset paths for the tiles (else generic tiles)', side: 'left (default) | right — where the headline sits on landscape' },
  cues: () => RINGS.flatMap((n, r) => Array.from({ length: n }, (_, k) => ({ t: Math.max(0, r * 5 + k - 4), kind: 'tick', gain: .9 }))),
  hero: (s, D) => Math.min(D - 12, 40),
  build(ctx, s) {
    const { u, C } = ctx;
    const L = split(ctx, { side: s.side, hasText: !!s.text });
    const head = s.text ? ctx.text(s.text, { size: headSize(ctx, L.mode), maxW: L.text.w, lines: headLines(ctx, L.mode), align: L.text.align, layer: 'headline' }) : null;
    if (head) placeText(ctx, head, L.text);
    const cy = L.mode === 'stack' && head ? Math.max(L.vis.cy, head.offsetTop + head.offsetHeight + L.vis.h * .5) : L.vis.cy;
    const cx = L.vis.cx, scale = Math.min(1, L.vis.w / 1000, L.vis.h / 860) * (L.mode === 'stack' ? 1.1 : 1);
    const icons = s.icons || [];
    const tiles = [];
    let i = 0;
    RINGS.forEach((n, r) => { for (let k = 0; k < n; k++, i++) tiles.push({ r, k, n, el: ctx.el(A.appTile(i, 96 * u, icons.length ? ctx.asset(icons[i % icons.length]) : null), `width:${96 * u}px;height:${96 * u}px`, 'icons') }); });
    const hs = 200 * u;
    const hero = ctx.el(s.hero === 'logo' ? `<div style="position:absolute;left:${hs * .1}px;top:${hs * .1}px">${ctx.logo(hs * .8)}</div>` : A.budEl(ctx.cast(s.hero != null ? Number(s.hero) : 1), hs, 'smile'),
      `left:${cx - hs / 2}px;top:${cy - hs / 2}px;width:${hs}px;height:${hs}px`, s.hero === 'logo' ? 'logo' : 'characters');
    const D = ctx.D, flingOut = s.out === 'zoom-out';
    return {
      render(t) {
        if (head) { ctx.reveal(head, t, 0, 2); head.style.transform = `translateY(${drift(t, 2, u)}px)`; }
        hero.style.transform = `scale(${K.outBack(K.u01(t, -5, 12)).toFixed(4)})`;
        A.hop(hero, hs, t, 1, 10 * u);
        const out = flingOut ? K.inQuad(K.clamp((t - (D - 10)) / 10, 0, 1.1)) : 0;
        for (const { r, k, n, el } of tiles) {
          const R = [210, 330, 450][r] * u * scale * (1 + 1.4 * out), a = (k / n) * Math.PI * 2 + r * .35 + t * .012 * (r % 2 ? -1 : 1);
          const p = K.outBack(K.u01(t, r * 5 + k - 4, 14 + r * 5 + k));
          el.style.left = (cx - 48 * u + Math.cos(a) * R * p) + 'px'; el.style.top = (cy - 48 * u + Math.sin(a) * R * .82 * p) + 'px';
          el.style.opacity = (K.clamp(p * 2) * (r === 2 ? .55 : 1)).toFixed(3);
          el.style.transform = `scale(${([1, .8, .62][r] * scale * K.clamp(p, 0, 1.1)).toFixed(4)})`;
        }
      },
    };
  },
};
