// lockup — co-brand card: [logo] Name × [partner logo] Partner, a pill under it, 4–6 blob mascots with faces popping
// in around it and bouncing, on a light gradient. The names type in letter by letter (scattered), the × pops, the pill
// outline draws and its label types.
import { F } from './_film.js';


const nCast = s => s.cast === false ? 0 : Math.max(0, Math.min(6, Number(s.cast ?? 6)));
const T = { logo: -3, name: 3, x: 9, plogo: 9, partner: 12, pill: 19, cast: 6 };
export default {
  name: 'lockup',
  doc: 'Co-brand card: [logo] Name × [partner logo] Partner with a pill under it and 4–6 blob mascots popping in and bouncing around it, on a light gradient; names type in letter by letter, the × pops.',
  layers: 'backdrop · logo · name · x · partner-logo · partner · pill · character-1 … character-N',
  media: [],
  copy: (s, o = {}) => { const p = typeof s.partner === 'object' && s.partner ? s.partner.name : s.partner; return [[s.name || (o.brand && o.brand.name), p].filter(Boolean).join(' × '), s.pill].filter(x => x != null && String(x).trim() !== '').map(String); },
  params: { name: 'default brand.name', partner: '{name, logo: assets/partner.svg} (logo optional: a monogram stands in)', pill: 'label in an outlined pill under the lockup, e.g. "Your launch crew"', cast: 'mascots around it (0–6, default 6; brand.cast or the built-in cast)', backdrop: 'false = the plain brand background instead of the light gradient' },
  required: ['partner'],
  validate: s => (s.partner && (typeof s.partner === 'object' ? s.partner.name : s.partner)) ? [] : [`lockup ${s.id}: partner needs a name ({name: Acme, logo: assets/acme.svg})`],
  cues: s => [{ t: 1, kind: 'pop', note: 76 }, { t: T.x, kind: 'pop', note: 88, gain: .8 }, { t: T.plogo + 1, kind: 'pop', note: 81 },
    ...Array.from({ length: nCast(s) }, (_, i) => ({ t: T.cast + 2 + i * 4, kind: 'pop', note: [72, 76, 79, 83, 86, 91][i], gain: .55 }))],
  hero: (s, D) => Math.min(D - 6, 46),
  async build(ctx, s) {
    const { W, H, u, K, A, safe, portrait, square } = ctx, B = ctx.brand.colors;
    const partner = typeof s.partner === 'object' ? s.partner : { name: String(s.partner) };
    const r = F.rng(F.hash('lockup:' + s.id));
    if (s.backdrop !== false) ctx.el('', `left:${-W * .1}px;top:${-H * .1}px;width:${W * 1.2}px;height:${H * 1.2}px;background:
        radial-gradient(ellipse 46% 52% at 8% 92%,rgba(196,214,255,.95),rgba(196,214,255,0) 70%),radial-gradient(ellipse 42% 48% at 94% 6%,rgba(226,214,255,.9),rgba(226,214,255,0) 70%),
        radial-gradient(ellipse 50% 46% at 50% 48%,#FFFFFF,rgba(255,255,255,0) 72%),#F3F4F8`, 'backdrop');
    const bd = ctx.root.querySelector('[data-lv-layer="backdrop"]');
    const L = 150 * u, nfs = 132, font = ctx.font;
    const row = ctx.el('', `left:0;top:0;width:${W}px;display:flex;justify-content:center;align-items:center;flex-wrap:nowrap`);
    const piece = (html, layer, css = '') => { const d = document.createElement('div'); d.style.cssText = `position:relative;flex:none;${css}`; d.innerHTML = html; row.appendChild(d); return ctx.layer(d, layer); };
    const letters = (text) => [...String(text)].map(c => c === ' ' ? ' ' : `<span class="lk-c" style="display:inline-block;opacity:0">${A.esc(c)}</span>`).join('');
    const nameHTML = t => `<div class="lv-txt" style="position:relative;font:700 ${nfs * u}px ${font};letter-spacing:-.04em;color:${B.ink};white-space:pre;line-height:1.1">${letters(t)}</div>`;
    const mono = (txt, size) => `<div style="width:${size}px;height:${size}px;border-radius:${size * .28}px;background:${B.ink};display:flex;align-items:center;justify-content:center;font:700 ${size * .5}px ${font};color:#fff">${A.esc(String(txt).slice(0, 1).toUpperCase())}</div>`;
    const logo = piece(ctx.logo(L), 'logo', `margin-right:${26 * u}px`);
    const name = piece(nameHTML(s.name || ctx.brand.name), 'name');
    const x = piece(`<div class="lv-txt" style="position:relative;font:300 ${nfs * .62 * u}px ${font};color:${B.muted};line-height:1">×</div>`, 'x', `margin:0 ${34 * u}px`);
    const plogo = piece(partner.logo ? `<img src="${ctx.asset(partner.logo)}" style="display:block;width:${L}px;height:${L}px;object-fit:contain">` : mono(partner.name, L), 'partner-logo', `margin-right:${26 * u}px`);
    const pname = piece(nameHTML(partner.name), 'partner');
    await Promise.all([...row.querySelectorAll('img')].map(i => i.decode().catch(() => null)));
    // fit: one row scaled to the safe width; too narrow (portrait) → name / × / partner stacked. The row is W wide with its
    // pieces centred, so a lockup wider than the frame overflows both sides: measure the pieces themselves
    const kids = [...row.children], cw = kids[kids.length - 1].offsetLeft + kids[kids.length - 1].offsetWidth - kids[0].offsetLeft;
    let k = Math.min(1, safe.w * .92 / Math.max(row.scrollWidth, cw)), stacked = false;
    if (k < .62 || portrait) {
      stacked = true;
      row.style.flexWrap = 'wrap'; row.style.width = `${Math.max(logo.offsetWidth + name.offsetWidth, plogo.offsetWidth + pname.offsetWidth) + 40 * u}px`;
      row.style.rowGap = `${18 * u}px`; x.style.flexBasis = '100%'; x.style.textAlign = 'center'; x.style.margin = '0';
      x.firstElementChild.style.display = 'inline-block';
      k = Math.min(1, safe.w * .94 / row.offsetWidth);
      row.style.left = (W / 2 - row.offsetWidth / 2) + 'px';
    }
    row.style.transformOrigin = '50% 50%';
    const pill = s.pill ? ctx.el(`<div class="lv-txt" style="position:relative;padding:${14 * u}px ${34 * u}px;border-radius:99px;box-shadow:inset 0 0 0 ${2.2 * u}px #CDD0DA;background:rgba(255,255,255,.7);font:600 ${(portrait ? 42 : 40) * u}px ${font};color:${B.ink};white-space:pre;letter-spacing:-.005em">${letters(s.pill)}</div>`, 'left:0;top:0', 'pill') : null;
    const rh = row.offsetHeight * k, gap = 40 * u, total = rh + (pill ? gap + pill.offsetHeight : 0);
    const y0 = H / 2 - total / 2;
    row.style.top = (y0 - (row.offsetHeight - rh) / 2) + 'px';
    row.style.transform = `scale(${k.toFixed(4)})`;
    if (pill) { pill.style.left = (W / 2 - pill.offsetWidth / 2) + 'px'; pill.style.top = (y0 + rh + gap) + 'px'; }
    const cs = [...row.querySelectorAll('.lk-c')], nameCs = [...name.querySelectorAll('.lk-c')], partCs = [...pname.querySelectorAll('.lk-c')], pillCs = pill ? [...pill.querySelectorAll('.lk-c')] : [];
    const delay = list => list.map((_, i) => i / Math.max(1, list.length - 1) * .7 + r() * .3);     // left-to-right with scatter
    const dn = delay(nameCs), dp = delay(partCs);
    // mascots on an ellipse around the lockup, clear of it, jittered; each floats and bounces
    // the lockup's box on screen (row scaled about its centre + the pill): mascots never land on it
    const boxW = (stacked ? row.offsetWidth : cw) * k, LB = { x0: W / 2 - boxW / 2, x1: W / 2 + boxW / 2, y0, y1: y0 + total };
    const n = nCast(s), ang = portrait ? [-.62, -.22, .3, .66, 1.1, 1.52] : [-2.6, -1.85, -.75, .15, .95, 2.25];
    const RX = portrait ? .36 * W : square ? .38 * W : .41 * W, RY = portrait ? .33 * H : square ? .39 * H : .37 * H;
    const chars = Array.from({ length: n }, (_, i) => {
      const a = (portrait ? ang[i] * Math.PI : ang[i]) + (r() - .5) * .25, sz = (portrait ? 150 : 128) * u * (.78 + .44 * r());
      let cx = W / 2 + Math.cos(a) * RX, cy = H / 2 + Math.sin(a) * RY;
      cx = Math.max(sz * .6, Math.min(W - sz * .6, cx)); cy = Math.max(sz * .6, Math.min(H - sz * .6, cy));
      if (cx + sz / 2 > LB.x0 && cx - sz / 2 < LB.x1 && cy + sz / 2 > LB.y0 && cy - sz / 2 < LB.y1) {   // on the lockup: above or below it
        const up = LB.y0 - sz / 2, dn = LB.y1 + sz / 2;
        cy = Math.abs(cy - up) <= Math.abs(dn - cy) && up >= sz * .6 ? up : dn <= H - sz * .6 ? dn : up;
      }
      const el = ctx.el(`<div class="lk-b" style="position:absolute;left:0;top:0;width:${sz}px;height:${sz}px;transform-origin:50% 90%">${A.bud(ctx.cast(i), sz, ['smile', 'open', 'wink'][i % 3])}</div>`,
        `left:${cx - sz / 2}px;top:${cy - sz / 2}px;width:${sz}px;height:${sz}px`, `character-${i + 1}`);
      return { el, b: el.firstElementChild, sz, ph: r() * 6, sp: .16 + r() * .06 };
    });
    return {
      render(t) {
        if (bd) bd.style.transform = `translate(${(10 * u * Math.sin(t * .03)).toFixed(2)}px,${(8 * u * Math.cos(t * .025)).toFixed(2)}px)`;
        const lp = K.outBack(K.u01(t, T.logo, T.logo + 12), 1.8), dy = `translateY(${(2.5 * u * Math.sin(t * .06)).toFixed(2)}px)`;   // the row itself never moves (a scaling wrapper around moving pieces makes Chrome composite it)
        logo.style.transform = `${dy} scale(${K.clamp(lp, 0, 1.2).toFixed(4)})`;
        const w = K.outExpo(K.u01(t, T.name - 2, T.name + 16)), wp = K.outExpo(K.u01(t, T.partner - 2, T.partner + 16));
        name.style.transform = `${dy} translateX(${(-46 * u * (1 - w)).toFixed(2)}px)`;
        pname.style.transform = `${dy} translateX(${(46 * u * (1 - wp)).toFixed(2)}px)`;
        nameCs.forEach((c, i) => { c.style.opacity = K.clamp(K.u01(t, T.name + dn[i] * 10, T.name + dn[i] * 10 + 3)).toFixed(3); });
        partCs.forEach((c, i) => { c.style.opacity = K.clamp(K.u01(t, T.partner + dp[i] * 10, T.partner + dp[i] * 10 + 3)).toFixed(3); });
        const xp = K.outBack(K.u01(t, T.x, T.x + 9), 2.6);
        x.style.transform = `${dy} scale(${K.clamp(xp, 0, 1.4).toFixed(4)})`;
        const pl = K.outBack(K.u01(t, T.plogo, T.plogo + 12), 1.8);
        plogo.style.transform = `${dy} scale(${K.clamp(pl, 0, 1.2).toFixed(4)})`;
        if (pill) {
          pill.style.opacity = K.clamp(K.u01(t, T.pill, T.pill + 6)).toFixed(3);
          pill.style.transform = `translateY(${((1 - K.outExpo(K.u01(t, T.pill, T.pill + 14))) * 16 * u + 1.5 * u * Math.sin(t * .06 + 1)).toFixed(2)}px)`;
          pillCs.forEach((c, i) => { c.style.opacity = t >= T.pill + 4 + i * .9 ? 1 : 0; });
        }
        chars.forEach((c, i) => {
          const t0 = T.cast + i * 4, sp = K.spring(t - t0, .45, .36);
          c.el.style.opacity = K.clamp((t - t0) / 3).toFixed(3);
          const bounce = Math.abs(Math.sin((t - t0) * c.sp + c.ph)), on = K.u01(t, t0 + 10, t0 + 20);
          const y = -18 * u * bounce * on, sq = 1 + .06 * on * (1 - bounce) * (1 - bounce);
          c.el.style.transform = `translate(${(6 * u * Math.sin(t * .05 + c.ph)).toFixed(2)}px,${(y + (1 - K.clamp(sp, 0, 1.2)) * 60 * u).toFixed(2)}px) scale(${K.lerp(.3, 1, K.clamp(sp, 0, 1.15)).toFixed(4)})`;
          c.b.style.transform = `scale(${sq.toFixed(4)},${(2 - sq).toFixed(4)})`;
        });
      },
    };
  },
};
