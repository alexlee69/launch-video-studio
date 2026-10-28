import * as K from '../kit.js';
import * as A from '../art.js';

const castN = s => s.cast === false ? 0 : Math.max(0, Math.min(9, Number(s.cast ?? 7)));
export default {
  name: 'endcard',
  doc: 'Closing lockup: logo + name, a tagline, CTA buttons, an optional URL and an optional row of characters hopping in.',
  layers: 'logo · name · tagline · cta · url · character-1 … character-N',   // --layers export, back to front
  params: { name: 'default brand.name', tagline: 'line under the lockup (*accent* ok)', cta: 'list of button labels, e.g. [Get it on iOS, Get it on Android]', url: 'e.g. steady.app', cast: 'number of characters in the row (0 = none, default 7)', theme: 'light (default) | dark' },
  cues: (s) => [{ t: 0, kind: 'hit', note: 89 }, ...Array.from({ length: castN(s) }, (_, i) => ({ t: 21 + i * 2, kind: 'pop', note: 72 + [0, 2, 4, 5, 7, 9, 12, 14, 16][i], gain: .7 }))],
  hero: (s, D) => Math.min(D - 4, 46),
  build(ctx, s) {
    const { W, H, u, safe, C, portrait } = ctx;
    const dark = ctx.dark ?? s.theme === 'dark';      // ctx.dark: theme: dark, or over bg footage
    const L = 180 * u;
    const lock = ctx.el('', `left:0;top:0;width:${W}px;display:flex;justify-content:center;align-items:center;gap:${26 * u}px`);
    const mk = document.createElement('div'); mk.innerHTML = ctx.logo(L, dark); mk.style.flex = 'none'; lock.appendChild(ctx.layer(mk, 'logo'));
    const name = ctx.text(s.name || ctx.brand.name, { size: 190, nowrap: true, parent: lock, color: dark ? '#fff' : C.ink, layer: 'name' });
    name.style.position = 'relative'; name.style.flex = 'none';
    const k = Math.min(1, safe.w / (mk.offsetWidth + name.offsetWidth + 26 * u));
    lock.style.transformOrigin = '50% 50%';
    const tag = s.tagline ? ctx.text(s.tagline, { size: 44, weight: 600, align: 'center', maxW: safe.w * .9, lines: 2, color: dark ? 'rgba(255,255,255,.75)' : C.muted, ls: '-.02em', layer: 'tagline' }) : null;
    const ctas = [].concat(s.cta || []).map(String);
    const cta = ctas.length ? ctx.el(ctas.map(c => `<div class="lv-txt" style="position:relative;padding:${16 * u}px ${34 * u}px;border-radius:99px;background:${dark ? '#fff' : C.ink};color:${dark ? ctx.brand.colors.ink : '#fff'};font:600 ${28 * u}px ${ctx.font};white-space:nowrap">${A.esc(c)}</div>`).join(''),
      `left:0;width:${W}px;display:flex;justify-content:center;gap:${18 * u}px;flex-wrap:wrap`, 'cta') : null;
    const url = s.url ? ctx.text(s.url, { size: 30, weight: 500, align: 'center', maxW: safe.w, lines: 1, color: dark ? 'rgba(255,255,255,.6)' : C.muted, ls: '0', layer: 'url' }) : null;
    const n = castN(s), cs = Math.min(96 * u, safe.w / Math.max(1, n) * .8);
    const lockH = lock.offsetHeight * k, gap = 34 * u;
    const parts = [{ h: lockH }, tag && { el: tag }, cta && { el: cta }, url && { el: url }, n && { h: cs }].filter(Boolean);
    const total = parts.reduce((a, p) => a + (p.h ?? p.el.offsetHeight), 0) + gap * (parts.length - 1);
    let y = H / 2 - total / 2;
    lock.style.top = (y - (lock.offsetHeight - lockH) / 2) + 'px'; y += lockH + gap;
    for (const e of [tag, cta, url]) if (e) { if (e !== cta) e.style.left = (W / 2 - e.offsetWidth / 2) + 'px'; e.style.top = y + 'px'; y += e.offsetHeight + gap; }
    const castY = y;
    const chars = Array.from({ length: n }, (_, i) => ctx.el(A.budEl(ctx.cast(i), cs, i % 2 ? 'smile' : 'open'), `left:${W / 2 - n * cs * 1.22 / 2 + i * cs * 1.22 + cs * .11}px;top:${castY}px;width:${cs}px;height:${cs}px`, `character-${i + 1}`));
    return {
      render(t) {
        // out of a morph to: frame (ctx.entered 'frame') the lockup rises out of the colour on its own clock from the cut,
        // and its lines rise too: there the pre-rolled lockup was ~75 % in on the first frame and faded in by opacity alone
        // as the colour lifted (qa1 L2); every other entrance is unchanged
        // (pre-rolled 2 frames: half in on the cut frame, so the shot's first frame is never the bare background — QA content)
        const rise = ctx.entered === 'frame', l = K.outExpo(rise ? K.u01(t, -2, 18) : K.u01(t, -4, 16));
        const ry = (k0, k1, d) => rise && K.u01(t, k0, k1) < 1 ? `translateY(${((1 - K.outExpo(K.u01(t, k0, k1))) * d * u).toFixed(2)}px) ` : '';   // (landed: the old transform exactly)
        lock.style.opacity = l.toFixed(3); lock.style.transform = `${ry(-2, 18, 64)}scale(${(k * K.lerp(.88, 1, l)).toFixed(4)})`;
        if (rise) for (const [e, k0, k1] of [[tag, 8, 22], [cta, 14, 28], [url, 18, 32]]) if (e) e.style.transform = ry(k0, k1, 36).trim() || 'none';
        // the wobble starts once the lockup has faded and scaled in (t ≥ 16), and the logo has no transform at all
        // before that: a transformed, shadowed logo inside the fading, scaling lockup makes Chrome composite the lockup
        // on its own (rasterised at a lagging scale), so the frame would no longer match its layers (--layers QA)
        const wob = rise ? K.u01(t, 18, 30) : K.u01(t, 16, 28);      // (after a rise: once the lockup has landed)
        mk.style.transform = wob > 0 ? `rotate(${(4 * Math.sin(t * .14) * wob).toFixed(2)}deg)` : 'none';
        if (tag) { tag.style.opacity = K.outExpo(K.u01(t, 8, 22)).toFixed(3); }
        if (cta) cta.style.opacity = K.outExpo(K.u01(t, 14, 28)).toFixed(3);
        if (url) url.style.opacity = K.outExpo(K.u01(t, 18, 32)).toFixed(3);
        chars.forEach((el, i) => {
          const p = K.outBack(K.u01(t, 21 + i * 2, 33 + i * 2));
          el.style.transform = `translateY(${((1 - p) * 70 * u).toFixed(2)}px)`; el.style.opacity = K.clamp(p * 2).toFixed(3);
          A.hop(el, cs, t, i * .9, 8 * u * K.u01(t, 33 + i * 2, 45 + i * 2));
        });
      },
    };
  },
};
