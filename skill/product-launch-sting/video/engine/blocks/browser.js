import * as K from '../kit.js';
import * as A from '../art.js';
import { drift } from './_layout.js';
import { uiCues, mountUI, overBudget } from '../ui.js';

export default {
  name: 'browser',
  doc: 'A desktop browser / app window running a UI flow (with a mouse cursor for taps), headline above it.',
  layers: 'headline · window · one per UI item (<type>-<n>) · cursor (with a tap)',   // --layers export, back to front
  params: { text: 'headline (optional)', items: 'UI items (see engine/ui.js header)', url: 'address-bar text, e.g. app.steady.com', column: 'content column width as a fraction of the window (default .56)' },
  validate: (s, D) => { const k = overBudget(s.items, D, 24); return k ? [`browser ${s.id}: the UI items need ~${Math.round(k * 100)}% of the shot; they will be sped up — lengthen the shot or trim items`] : []; },
  cues: (s, D) => [{ t: 0, kind: 'pop', note: 72, gain: .6 }, ...uiCues(s.items, D, 24)],
  hero: (s, D) => Math.round(D * .86),
  build(ctx, s) {
    const { W, H, u, safe, portrait } = ctx;
    const head = s.text ? ctx.text(s.text, { size: portrait ? 84 : 68, align: 'center', maxW: safe.w, lines: portrait ? 3 : 1, layer: 'headline' }) : null;
    if (head) { head.style.left = safe.x0 + 'px'; head.style.top = safe.y0 + 'px'; }
    const top0 = head ? head.offsetTop + head.offsetHeight + 46 * u : safe.y0;
    const bw = Math.min(safe.w, (H - top0 - H * .03) * 16 / 10.5), bh = Math.min(H - top0 - H * .03, bw * 10.5 / 16);
    const top = head ? top0 : (H - bh) / 2;                    // no headline: centre the window (overlay clips)
    const wrap = ctx.el(A.browserFrame('', bw, bh, s.url || '', ctx.font), `left:${W / 2 - bw / 2}px;top:${top}px`, 'window');
    const screen = wrap.querySelector('.lv-screen');
    screen.classList.add('lv-ui');
    const col = Math.min(bw * (s.column || .56), bw - 40 * u);
    const inner = document.createElement('div');
    inner.style.cssText = `position:absolute;left:${(bw - col) / 2}px;top:0;width:${col}px;height:100%`;
    screen.appendChild(inner);
    const fs = Math.max(18 * u, Math.min(26 * u, col * .036));
    const ui = mountUI(ctx, inner, s.items, { width: col, fontSize: fs, pad: 0, top: fs * 1.6, start: 24, cursor: true, bottom: fs * 2 });
    return {
      render(t) {
        const p = K.outExpo(K.u01(t, -6, 20));
        wrap.style.transform = `translateY(${((1 - p) * 300 * u + 6 * u * Math.sin(t * .09)).toFixed(2)}px) scale(${K.lerp(.94, 1, p).toFixed(4)})`;
        if (head) { ctx.reveal(head, t, -2, 2); head.style.transform = `translateY(${drift(t, 5, u)}px)`; }
        ui.render(t);
      },
    };
  },
};
