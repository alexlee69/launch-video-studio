import * as K from '../kit.js';
import { split, placeText, headSize, headLines, drift } from './_layout.js';
import { uiCues, mountUI, overBudget } from '../ui.js';

// No device frame: a floating card (or none) holding UI items. With --alpha this is the overlay workhorse:
// a chat panel, an approval card, a notification stack or agent steps over your own footage.
// A panel the camera dives into (timeline: s.entered = 'dive') arrives built: the box landed and the UI DIVE_PRE frames
// ahead (it starts at frame −4, not 10), so the dive doesn't land on an empty white pill (qa1 M4). The timeline decides
// it, so the sounds, a clean --clips export and the film all keep one schedule
const uiStart = s => s.entered === 'dive' ? 10 - K.DIVE_PRE : 10;
export default {
  name: 'panel',
  doc: 'A floating UI panel (no device) running UI items — chat, approval card, notification stack, agent steps; the best block for transparent overlays.',
  layers: 'headline · panel (none with style: bare) · one per UI item (<type>-<n>) · cursor (with a tap)',   // --layers export, back to front
  params: { text: 'headline (optional; beside the panel on landscape)', items: 'UI items', style: 'card (default, white rounded panel) | glass (frosted; can\'t be split exactly by --layers) | bare (items only, no panel)', width: 'panel width in px at 1080 (default 640)', side: 'left | right — headline side when there is one; without text the panel is centred' },
  diveFrom: .5,             // a dive brings the panel in at ×.5 unless dive.from says otherwise (at ×.3 a speck, qa1 M4)
  validate: (s, D) => { const k = overBudget(s.items, D, uiStart(s)); return k ? [`panel ${s.id}: the UI items need ~${Math.round(k * 100)}% of the shot; they will be sped up — lengthen the shot or trim items`] : []; },
  cues: (s, D) => uiCues(s.items, D, uiStart(s)),
  hero: (s, D) => Math.round(D * .86),
  async build(ctx, s) {
    const { W, H, u, C, safe } = ctx;
    let cx = W / 2, area = { w: safe.w, h: safe.h }, head = null, cy = H / 2;
    if (s.text) {
      const L = split(ctx, { side: s.side, stackSquare: true });
      head = ctx.text(s.text, { size: headSize(ctx, L.mode), maxW: L.text.w, lines: headLines(ctx, L.mode), align: L.text.align, layer: 'headline' });
      placeText(ctx, head, L.text);
      const y1 = ctx.picture ? ctx.picture.y1 : H;                 // the picture's bottom (above a letterbox bar)
      cx = L.vis.cx; area = { w: L.vis.w, h: L.mode === 'stack' ? y1 - (head.offsetTop + head.offsetHeight) - H * .06 : L.vis.h };
      cy = L.mode === 'stack' ? head.offsetTop + head.offsetHeight + 40 * u + area.h / 2 : H / 2;
    }
    const pw = Math.min((s.width || 640) * u, area.w), ph = Math.min(area.h, pw * 1.25);
    const style = s.style || 'card';
    const bg = style === 'card' ? `background:${ctx.brand.colors.card};` + 'box-shadow:0 30px 80px rgba(20,24,40,.16),0 0 0 1px rgba(17,17,20,.05);'
      : style === 'glass' ? 'background:rgba(255,255,255,.72);backdrop-filter:blur(24px) saturate(1.3);-webkit-backdrop-filter:blur(24px) saturate(1.3);box-shadow:0 30px 80px rgba(20,24,40,.16),inset 0 1px 0 rgba(255,255,255,.9);' : '';
    const panel = ctx.el('', `left:${cx - pw / 2}px;top:${cy - ph / 2}px;width:${pw}px;height:${ph}px;border-radius:${40 * u}px;overflow:hidden;${bg}`);
    panel.classList.add('lv-ui');
    if (style !== 'bare') ctx.layer(panel, 'panel');   // bare: no panel of its own, just its items
    const fs = Math.max(20 * u, pw * .042);
    const ui = mountUI(ctx, panel, s.items, { width: pw, fontSize: fs, pad: style === 'bare' ? 0 : fs * 1.1, top: style === 'bare' ? 0 : fs * 1.1, start: uiStart(s), cursor: true, glass: style !== 'card', bottom: fs });
    // the panel hugs its items (centred) when they fit; a longer flow keeps the full height and scrolls
    await Promise.all([...panel.querySelectorAll('img')].map(i => i.decode().catch(() => null)));
    const need = Math.ceil(ui.flow.offsetTop + ui.flow.offsetHeight + (style === 'bare' ? 0 : fs * 1.1));
    if (need < ph) { panel.style.height = need + 'px'; panel.style.top = (cy - need / 2) + 'px'; }
    return {
      render(t) {
        const tb = t + (s.entered === 'dive' ? K.DIVE_PRE : 0), p = K.outBack(K.u01(tb, -4, 14));      // (dived into: landed)
        panel.style.opacity = K.clamp(K.u01(tb, -4, 2) * 1.5).toFixed(3);
        panel.style.transform = `translateY(${((1 - p) * 60 * u + 5 * u * Math.sin(t * .1)).toFixed(2)}px) scale(${K.lerp(.94, 1, K.clamp(p, 0, 1.05)).toFixed(4)})`;
        if (head) { ctx.reveal(head, t, -2, 2); head.style.transform = `translateY(${drift(t, 6, u)}px)`; }
        ui.render(t);
      },
    };
  },
};
