import * as K from '../kit.js';
import * as A from '../art.js';
import { drift } from './_layout.js';

// items: [{icon, label, color}] or plain names ("Mail", "Calendar" → that built-in icon, labelled as written; an asset path → that icon)
const items = s => [].concat(s.items || [{ icon: 'mail', label: 'Email' }, { icon: 'phone', label: 'Phone' }, { icon: 'computer', label: 'Computer' }]).slice(0, 5)
  .map(it => typeof it !== 'string' ? it : /[./]/.test(it) ? { icon: it, label: '' } : { icon: A.ICON_NAMES.includes(it.toLowerCase()) ? it.toLowerCase() : 'sparkle', label: it });
export default {
  name: 'orbit',
  doc: 'A hero (character or logo) with 2–5 satellites (icon + label) flying out to it, joined by moving dotted lines; headline above.',
  layers: 'headline · characters (logo with hero: logo) · lines · icons',   // --layers export, back to front
  params: { text: 'headline', hero: 'cast index (default 0) or "logo"', items: '[{icon, label, color}] — icon is a built-in name (mail, phone, computer, calendar, chat, bell, chart, lock, check, star, heart, bolt, globe, camera, music, sparkle) or an asset path' },
  cues: (s) => [{ t: 2, kind: 'pop', note: 77 }, ...items(s).map((_, i) => ({ t: 10 + i * 5, kind: 'pop', note: [84, 88, 91, 93, 96][i] }))],
  hero: (s, D) => Math.min(D - 4, 10 + items(s).length * 5 + 18),
  build(ctx, s) {
    const { W, H, u, safe, portrait, C } = ctx;
    const its = items(s), n = its.length;
    const head = s.text ? ctx.text(s.text, { size: portrait ? 84 : 76, align: 'center', maxW: safe.w, lines: portrait ? 3 : 2, layer: 'headline' }) : null;
    if (head) { head.style.left = safe.x0 + 'px'; head.style.top = (safe.y0 + (portrait ? .04 * H : .06 * H)) + 'px'; }
    const top = head ? head.offsetTop + head.offsetHeight + 60 * u : safe.y0;
    const cx = W / 2, cy = top + (safe.y1 - top) * .45;
    const hs = (portrait ? 220 : 240) * u;
    const hero = ctx.el(s.hero === 'logo' ? `<div style="position:absolute;left:${hs * .1}px;top:${hs * .1}px">${ctx.logo(hs * .8)}</div>` : A.budEl(ctx.cast(Number(s.hero) || 0), hs, 'open'),
      `left:${cx - hs / 2}px;top:${cy - hs / 2}px;width:${hs}px;height:${hs}px`, s.hero === 'logo' ? 'logo' : 'characters');
    const rx = Math.min(safe.w * .42, 420 * u), ry = Math.min((safe.y1 - top) * .42, 300 * u);
    // satellites spread on an arc around the hero (left, right, below …)
    const angles = { 1: [0], 2: [180, 0], 3: [200, 340, 90], 4: [210, 330, 120, 60], 5: [180, 0, 225, 315, 90] }[n];
    const lines = !n ? null : ctx.el(`<svg width="${W}" height="${H}" style="overflow:visible" fill="none" stroke="${C.line}" stroke-width="${3 * u}" stroke-dasharray="${2 * u} ${14 * u}" stroke-linecap="round">${its.map((_, i) => `<path class="lv-ln"/>`).join('')}</svg>`, 'left:0;top:0', 'lines');
    const paths = lines ? [...lines.querySelectorAll('.lv-ln')] : [];   // items: [] → no satellites, no lines
    const iconS = 120 * u;
    const sats = its.map((it, i) => {
      const a = angles[i] * Math.PI / 180, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      const col = it.color || [C.accent, C.accent2, C.accent3, C.accent, C.accent2][i];
      const ic = it.icon && !A.ICON_NAMES.includes(it.icon) ? `<img src="${ctx.asset(it.icon)}" style="width:${iconS}px;height:${iconS}px;object-fit:contain;display:block">` : A.icon(it.icon || 'sparkle', col, iconS);
      const el = ctx.el(`<div style="display:inline-block">${ic}</div>${it.label ? `<div class="lv-txt" style="position:relative;font:600 ${28 * u}px ${ctx.font};color:${C.muted};margin-top:${6 * u}px;white-space:nowrap">${A.esc(it.label)}</div>` : ''}`,
        `width:${160 * u}px;text-align:center`, 'icons');
      return { el, x, y };
    });
    return {
      render(t) {
        if (head) ctx.reveal(head, t, -5, 2);
        hero.style.transform = `scale(${K.outBack(K.u01(t, -4, 14)).toFixed(4)})`;
        A.hop(hero, hs, t, 0, 10 * u);
        sats.forEach(({ el, x, y }, i) => {
          const k = K.outBack(K.u01(t, 10 + i * 5, 26 + i * 5)), fy = 6 * u * Math.sin(t * .15 + i * 2);
          el.style.left = (K.lerp(cx, x, k) - 80 * u) + 'px'; el.style.top = (K.lerp(cy, y, k) - 64 * u + fy) + 'px';
          el.style.opacity = K.clamp(k * 2).toFixed(3); el.style.transform = `scale(${K.lerp(.4, 1, K.clamp(k, 0, 1.1)).toFixed(4)})`;
          const c = K.clamp(k);
          paths[i].setAttribute('d', `M${cx} ${cy}L${K.lerp(cx, x, c * .74)} ${K.lerp(cy, y + fy, c * .74)}`);
          paths[i].style.strokeDashoffset = (-t * 1.6 * u).toFixed(2); paths[i].style.opacity = c.toFixed(3);
        });
        if (head) head.style.transform = `translateY(${drift(t, 1, u)}px)`;
      },
    };
  },
};
