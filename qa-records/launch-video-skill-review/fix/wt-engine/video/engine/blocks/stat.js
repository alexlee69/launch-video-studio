import * as K from '../kit.js';
import { drift } from './_layout.js';
import { wordCount, revealPlan } from '../kit.js';

const COUNT = [4, 26];     // local frames: the number counts over this span
export default {
  name: 'stat',
  doc: 'A big number that counts up (with ticks) and lands with a pop, a label under it and an optional sub line.',
  layers: 'number · label · sub',   // --layers export, back to front
  params: { value: 'final number', from: 'start number (default 0)', decimals: 'digits after the point (default 0)', prefix: 'e.g. "$"', suffix: 'e.g. "×", "%", " days"', label: 'line under the number (*accent* ok)', sub: 'small line under the label' },
  cues: (s) => [...Array.from({ length: 6 }, (_, i) => ({ t: COUNT[0] + (COUNT[1] - COUNT[0]) * (i / 6), kind: 'tick', gain: .6 + i * .1 })), { t: COUNT[1], kind: 'pop', note: 84 }],
  hero: (s, D) => Math.min(D - 2, Math.max(Math.min(COUNT[1] + 14, D - 2), Math.ceil(revealPlan(wordCount(s.label || ''), D, 10).end + 4))),   // label fully revealed
  build(ctx, s) {
    const { W, H, u, safe, C, portrait } = ctx;
    const to = Number(s.value ?? 100), from = Number(s.from ?? 0), dec = Number(s.decimals ?? 0);
    const fmt = v => `${s.prefix || ''}${v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}${s.suffix || ''}`;
    const num = ctx.text(fmt(to), { size: portrait ? 260 : 280, align: 'center', nowrap: true, color: C.accent, ls: '-.05em', style: 'font-variant-numeric:tabular-nums;', layer: 'number' });
    const fitK = Math.min(1, safe.w / num.offsetWidth);
    num.style.fontSize = parseFloat(num.style.fontSize) * fitK + 'px';
    const label = s.label ? ctx.text(s.label, { size: portrait ? 64 : 60, align: 'center', maxW: safe.w * .9, lines: 2, layer: 'label' }) : null;
    const sub = s.sub ? ctx.text(s.sub, { size: 32, weight: 500, color: C.muted, align: 'center', maxW: safe.w * .8, lines: 2, ls: '-.01em', layer: 'sub' }) : null;
    const parts = [num, label, sub].filter(Boolean), gap = 24 * u;
    let y = H / 2 - (parts.reduce((a, e) => a + e.offsetHeight, 0) + gap * (parts.length - 1)) / 2;
    for (const e of parts) { e.style.left = (W / 2 - e.offsetWidth / 2) + 'px'; e.style.top = y + 'px'; y += e.offsetHeight + gap; }
    // the count-up changes the number's width: give it the full safe width, centred, so it never drifts sideways
    num.style.left = safe.x0 + 'px'; num.style.width = safe.w + 'px'; num.style.textAlign = 'center';
    num.style.transformOrigin = '50% 60%';
    return {
      render(t) {
        const p = K.outCubic(K.u01(t, COUNT[0], COUNT[1]));
        const v = from + (to - from) * p;
        num.textContent = fmt(dec ? Math.round(v * 10 ** dec) / 10 ** dec : Math.round(v));
        const land = K.outBack(K.u01(t, COUNT[1], COUNT[1] + 10));
        num.style.opacity = K.clamp(K.u01(t, -4, 4) * 1.5).toFixed(3);
        num.style.transform = `scale(${(K.lerp(.9, 1, K.outExpo(K.u01(t, -4, 12))) * (1 + .06 * Math.sin(Math.PI * K.clamp(land)))).toFixed(4)}) translateY(${drift(t, 3, u)}px)`;
        if (label) ctx.reveal(label, t, 10, 2);
        if (sub) sub.style.opacity = K.outExpo(K.u01(t, COUNT[1], COUNT[1] + 14)).toFixed(3);
      },
    };
  },
};
