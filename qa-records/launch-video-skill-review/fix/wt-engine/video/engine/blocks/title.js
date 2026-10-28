import * as K from '../kit.js';

export default {
  name: 'title',
  doc: 'Opener lockup "<pre> [logo] <name>": the words slide in, the logo springs, an optional badge bubble pops, a sub line fades in.',
  layers: 'pre · logo · badge · name · sub',   // --layers export, back to front
  params: { pre: 'word before the logo, e.g. "Meet" (optional)', name: 'product name (default brand.name)', badge: 'small bubble on the logo, e.g. "Hi!"', sub: 'line under the lockup, e.g. "by Acme"' },
  cues: (s) => [{ t: 1, kind: 'pop', note: 79 }, ...(s.badge ? [{ t: 22, kind: 'pop', note: 86 }] : [])],
  hero: (s, D) => Math.min(D - 6, 46),
  build(ctx, s) {
    const { W, H, u, safe, C } = ctx;
    const row = ctx.el('', `left:0;top:0;width:${W}px;display:flex;justify-content:center;align-items:center;gap:${34 * u}px`);
    const pre = s.pre ? ctx.text(s.pre, { size: 150, nowrap: true, parent: row, layer: 'pre' }) : null;
    const L = 170 * u;
    const logo = document.createElement('div');
    logo.style.cssText = `position:relative;width:${L}px;height:${L}px;flex:none;transform-origin:50% 60%`;
    logo.innerHTML = ctx.logo(L);
    ctx.layer(logo, 'logo');
    row.appendChild(logo);
    const name = ctx.text(s.name || ctx.brand.name, { size: 150, nowrap: true, parent: row, layer: 'name' });
    for (const e of [pre, name]) if (e) { e.style.position = 'relative'; e.style.flex = 'none'; }
    let badge = null;
    if (s.badge) {
      badge = document.createElement('div');
      badge.className = 'lv-txt';
      badge.style.cssText = `position:absolute;left:${L * .76}px;top:${-L * .3}px;padding:${10 * u}px ${22 * u}px;border-radius:${22 * u}px ${22 * u}px ${22 * u}px ${6 * u}px;background:#fff;box-shadow:0 ${8 * u}px ${24 * u}px rgba(20,20,30,.12);font:700 ${34 * u}px ${ctx.font};color:${C.ink};white-space:nowrap;transform-origin:0 100%`;
      badge.textContent = s.badge;
      ctx.layer(badge, 'badge');
      logo.appendChild(badge);
    }
    // fit: scale the lockup down to the safe width; stack it on narrow (portrait) frames
    const kids = [...row.children], gapPx = 34 * u;
    let k = Math.min(1, safe.w / (kids.reduce((a, c) => a + c.offsetWidth, 0) + gapPx * (kids.length - 1)));
    if (k < .7) {                                     // too wide for one row: stack pre / logo / name
      row.style.flexDirection = 'column'; row.style.gap = `${18 * u}px`;
      k = Math.min(1, safe.w / Math.max(...kids.map(c => c.offsetWidth)), safe.h * .7 / row.scrollHeight);
    }
    row.style.transformOrigin = '50% 50%';
    const rh = row.offsetHeight * k;
    const cy = H / 2 - (s.sub ? 40 * u : 0);
    row.style.top = (cy - row.offsetHeight / 2) + 'px';
    row.style.transform = `scale(${k.toFixed(4)})`;
    const sub = s.sub ? ctx.text(s.sub, { size: 32, weight: 500, color: C.muted, align: 'center', maxW: safe.w, lines: 2, ls: '0', layer: 'sub' }) : null;
    if (sub) { sub.style.left = safe.x0 + 'px'; sub.style.top = (cy + rh / 2 + 34 * u) + 'px'; }
    return {
      render(t) {
        const w = K.outExpo(K.u01(t, -4, 20)), m = K.outBack(K.u01(t, -1, 17));
        if (pre) { pre.style.transform = `translateX(${(-80 * u * (1 - w)).toFixed(2)}px)`; pre.style.opacity = w.toFixed(3); }
        name.style.transform = `translateX(${(80 * u * (1 - w)).toFixed(2)}px)`; name.style.opacity = w.toFixed(3);
        logo.style.transform = `scale(${m.toFixed(4)}) rotate(${((1 - m) * -40 + 5 * Math.sin(t * .17) * K.u01(t, 22, 34)).toFixed(2)}deg)`;
        if (badge) { const b = K.outBack(K.u01(t, 22, 34)); badge.style.transform = `translateY(${(-6 * u * Math.sin(t * .2) * K.u01(t, 30, 40)).toFixed(2)}px) scale(${b.toFixed(4)})`; }
        if (sub) sub.style.opacity = K.outExpo(K.u01(t, 30, 46)).toFixed(3);
      },
    };
  },
};
