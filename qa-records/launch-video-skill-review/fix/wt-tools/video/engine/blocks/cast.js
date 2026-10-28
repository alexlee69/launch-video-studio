import * as K from '../kit.js';
import * as A from '../art.js';

const N = s => Math.max(1, Math.min(12, Number(s.count) || 7));
export default {
  name: 'cast',
  doc: 'Headline over a row of characters that spring up one after another and keep hopping (two rows on portrait).',
  layers: 'headline · character-1 … character-N',   // --layers export, back to front
  params: { text: 'headline', count: 'number of characters (1–12, default 7; cycles through brand.cast or the built-in cast)' },
  cues: (s) => Array.from({ length: N(s) }, (_, i) => ({ t: Math.max(0, i * 3 - 1), kind: 'pop', note: [72, 74, 76, 77, 79, 81, 84, 86, 88, 89, 91, 93][i] })),
  hero: (s, D) => Math.min(D - 4, N(s) * 3 + 26),
  build(ctx, s) {
    const { W, H, u, safe, portrait, C } = ctx;
    const n = N(s), rows = portrait && n > 4 ? 2 : 1, perRow = Math.ceil(n / rows);
    const size = Math.min(180 * u, (safe.w / perRow) * .86);
    const head = s.text ? ctx.text(s.text, { size: portrait ? 84 : 76, align: 'center', maxW: safe.w, lines: portrait ? 3 : 2, layer: 'headline' }) : null;
    const blockH = rows * size * 1.15;
    const total = (head ? head.offsetHeight + 90 * u : 0) + blockH;
    const top = H / 2 - total / 2;
    if (head) { head.style.left = safe.x0 + 'px'; head.style.top = top + 'px'; }
    const y0 = top + (head ? head.offsetHeight + 90 * u : 0);
    const chars = Array.from({ length: n }, (_, i) => {
      const r = Math.floor(i / perRow), inRow = r === rows - 1 ? n - perRow * (rows - 1) : perRow, j = i - r * perRow;
      const step = size * 1.12, x = W / 2 - (inRow * step) / 2 + j * step + (step - size) / 2;
      const el = ctx.el(A.budEl(ctx.cast(i), size, ['smile', 'open', 'wink'][i % 3]), `left:${x}px;top:${y0 + r * size * 1.15}px;width:${size}px;height:${size}px`, `character-${i + 1}`);
      return el;
    });
    return {
      render(t) {
        if (head) ctx.reveal(head, t, -4, 2);
        chars.forEach((el, i) => {
          const s1 = K.spring(t + 3 - i * 3, .5, .34);
          el.style.opacity = K.clamp((t + 3 - i * 3) / 3).toFixed(3);
          el.style.transform = `translateY(${(160 * u * (1 - s1)).toFixed(2)}px) scale(${K.lerp(.55, 1, K.clamp(s1, 0, 1.2)).toFixed(4)})`;
          A.hop(el, size, t, i * .9, 12 * u * K.u01(t, 20 + i * 3, 34 + i * 3));
        });
      },
    };
  },
};
