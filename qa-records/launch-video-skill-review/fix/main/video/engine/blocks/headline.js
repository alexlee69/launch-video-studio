import * as K from '../kit.js';
import { drift } from './_layout.js';
import { wordCount, revealPlan } from '../kit.js';

export default {
  name: 'headline',
  doc: 'A big statement: 1–3 lines with an *accent* phrase, optional kicker label above and sub line below; words rise in one by one.',
  layers: 'kicker · headline · sub',   // --layers export, back to front
  params: { text: 'the line, *accent* marks the coloured phrase, | forces a break', kicker: 'small label above (optional)', sub: 'smaller line below (optional)', align: 'center (default) | left' },
  cues: () => [],
  hero: (s, D) => Math.min(D - 2, Math.max(Math.min(34, D - 2), Math.ceil(revealPlan(wordCount(s.text || ''), D, -3).end + 4))),   // every word risen
  build(ctx, s) {
    const { W, H, u, safe, C, portrait } = ctx;
    const align = s.align || 'center';
    const maxW = safe.w * (portrait ? 1 : .86);
    const x = align === 'center' ? (W - maxW) / 2 : safe.x0 + .03 * W;
    const kick = s.kicker ? ctx.text(s.kicker, { size: 28, weight: 600, color: C.accent, ls: '.08em', align, maxW, lines: 1, style: 'text-transform:uppercase;', layer: 'kicker' }) : null;
    const head = ctx.text(s.text || '', { size: portrait ? 104 : 108, align, maxW, lines: portrait ? 4 : 2, min: 44, layer: 'headline' });
    const sub = s.sub ? ctx.text(s.sub, { size: 36, weight: 500, color: C.muted, align, maxW: maxW * .8, lines: 2, ls: '-.01em', layer: 'sub' }) : null;
    const gap = 28 * u, parts = [kick, head, sub].filter(Boolean);
    const total = parts.reduce((a, e) => a + e.offsetHeight, 0) + gap * (parts.length - 1);
    let y = H / 2 - total / 2;
    for (const e of parts) { e.style.left = (e === sub && align === 'center' ? x + maxW * .1 : x) + 'px'; e.style.top = y + 'px'; y += e.offsetHeight + gap; }
    return {
      render(t) {
        if (kick) kick.style.opacity = K.outExpo(K.u01(t, -2, 10)).toFixed(3);
        ctx.reveal(head, t, -3, 2.2);
        head.style.transform = `translateY(${drift(t, 0, u)}px)`;
        if (sub) { const k = K.outExpo(K.u01(t, 12, 26)); sub.style.opacity = k.toFixed(3); sub.style.transform = `translateY(${((1 - k) * 20 * u).toFixed(2)}px)`; }
      },
    };
  },
};
