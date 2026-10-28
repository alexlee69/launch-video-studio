import * as K from '../kit.js';
import * as A from '../art.js';
import { split, placeText, headSize, headLines, drift } from './_layout.js';
import { uiCues, mountUI, overBudget } from '../ui.js';

export default {
  name: 'phone',
  doc: 'A phone running a UI flow (chat, cards, taps, toasts, agent steps, screenshots) beside a headline (above it on portrait).',
  layers: 'headline · phone · one per UI item, named <type>-<n> by its place in items (msg-1, card-2 …) · cursor (with a tap)',   // --layers export, back to front
  params: { text: 'headline (optional)', items: 'UI items (see engine/ui.js header)', side: 'left (default) | right: where the headline sits on landscape' },
  validate: (s, D) => { const k = overBudget(s.items, D, 16); return k ? [`phone ${s.id}: the UI items need ~${Math.round(k * 100)}% of the shot; they will be sped up — lengthen the shot or trim items`] : []; },
  cues: (s, D) => [{ t: 0, kind: 'pop', note: 74, gain: .6 }, ...uiCues(s.items, D, 16)],
  hero: (s, D) => Math.round(D * .86),
  build(ctx, s) {
    const { u, C, portrait } = ctx;
    const L = split(ctx, { side: s.side, stackSquare: false, hasText: !!s.text });
    const head = s.text ? ctx.text(s.text, { size: headSize(ctx, L.mode), maxW: L.text.w, lines: headLines(ctx, L.mode), align: L.text.align, layer: 'headline' }) : null;
    if (head) placeText(ctx, head, L.text);
    // stacked (portrait): headline + phone as one group, centred in the platform-safe band; the phone grows to fill it
    const gap = 50 * u, hh = head ? head.offsetHeight + gap : 0;
    const availH = L.mode === 'stack' ? ctx.safe.h - hh : L.vis.h;
    const pw = Math.min((portrait ? 600 : 470) * u, availH / 2.08, L.vis.w * .9);
    let top = ctx.H / 2 - pw * 1.04;
    if (L.mode === 'stack') {
      const y0 = ctx.safe.y0 + Math.max(0, (ctx.safe.h - hh - pw * 2.08) / 2);
      if (head) head.style.top = y0 + 'px';
      top = y0 + hh;
    }
    const wrap = ctx.el(A.phoneFrame('', pw, ctx.font), `left:${L.vis.cx - pw / 2}px;top:${top}px`, 'phone');
    const screen = wrap.querySelector('.lv-screen');
    screen.classList.add('lv-ui');
    const ui = mountUI(ctx, screen, s.items, { width: pw - pw * .06, start: 16, top: pw * .16 });   // items start as the phone settles
    return {
      render(t) {
        const ph = K.outExpo(K.u01(t, -6, 22));
        wrap.style.transform = `translateY(${((1 - ph) * 520 * u + 8 * u * Math.sin(t * .1)).toFixed(2)}px)`;
        if (head) { const h = K.outExpo(K.u01(t, 2, 18)); head.style.opacity = h.toFixed(3); head.style.transform = `translateY(${((1 - h) * 30 * u).toFixed(2)}px) translateY(${drift(t, 4, u)}px)`; }
        ui.render(t);
      },
    };
  },
};
