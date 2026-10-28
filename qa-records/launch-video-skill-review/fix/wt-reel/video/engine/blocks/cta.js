// cta: the comment-keyword end card — "Comment WORD to get the link". The keyword slams in as an accent sticker, the
// lines around it slide in, the brand logo pops on top, a chat bubble bounces beside the word; a subtle pulse keeps it
// alive. Over the shot's footage (bg, drawn by the engine), a dark backdrop with drifting accent glows when the shot has
// no bg, or nothing (bg: none — the brand background in the film, transparent in --clips/--layers --alpha).
import { reelWords, reelF, reelFonts, reelPal, reelHexA, reelSticker, reelGloss, reelXf, reelShaker, reelCapPlan, reelCaption, reelArea, reelWarn } from './_reel.js';

const CT = { word: -1, pre: 6, post: 9, logo: 12, icon: 16 };

// every line a viewer reads, in order (timeline: captions SRT, reading time, storyboard, review sheet)
const ctCopy = s => [s.pre ?? 'Comment', s.word, s.post ?? 'to get the link', s.caption].filter(Boolean).map(String);

export default {
  name: 'cta',
  doc: 'Comment-keyword end card ("Comment WORD to get the link"): the keyword slams in as an accent sticker, pre/post lines slide in, the logo pops on top, a chat bubble bounces; over the shot\'s footage (bg), a dark backdrop with drifting glows (no bg), or nothing (bg: none).',
  layers: 'backdrop (no bg) · word · pre · post · logo · icon · caption',   // back to front (tree order; the engine adds footage under them with bg:)
  bgDefaults: { bgDim: .5 },   // the CTA reads over busy footage
  media: [],
  // the footage takes 40 % of the keyword's impact shake (pure in t: the same seeded shaker)
  bgMotion: (ctx, s) => { const shk = reelShaker(ctx, s.id); return t => { const j = shk(t, 2, 10, 14 * ctx.u); return { x: j.x * .4, y: j.y * .4 }; }; },
  required: ['word'],
  params: {
    word: 'the comment keyword, e.g. POPFRAME (one word reads best)',
    pre: 'line above (default "Comment"; "" = none)',
    post: 'line below (default "to get the link"; "" = none)',
    bg: '(any shot) AI footage or an image (dimmed, bgDim default .5 here) | none (no backdrop: the brand background, transparent with --alpha) | omitted: the brand dark with drifting accent glows',
    logo: 'brand logo on top (default true)',
    caption: 'word-pop caption (+ captionAt: its first local frame, or seconds like 0.5s; default 4)',
  },
  copy: ctCopy,
  validate: (s, D) => [...(reelWords(s.word).length > 2 ? [`cta ${s.id}: "${s.word}" — a comment keyword works best as one word`] : []), ...reelWarn(s, D)],
  // a pre / post line set to "" isn't drawn, so it makes no pop either
  cues: (s, D) => [{ t: 1, kind: 'hit', note: 89 }, ...((s.pre ?? 'Comment') ? [{ t: CT.pre + 1, kind: 'pop', note: 79, gain: .8 }] : []), ...((s.post ?? 'to get the link') ? [{ t: CT.post + 1, kind: 'pop', note: 84, gain: .8 }] : []),
    ...(s.logo === false ? [] : [{ t: CT.logo + 2, kind: 'pop', note: 88, gain: .7 }]), { t: CT.icon + 2, kind: 'pop', note: 93, gain: .9 }],
  hero: (s, D) => { const c = reelCapPlan(s, D); return Math.min(D - 2, Math.max(32, c ? Math.ceil(c.end) + 2 : 0)); },
  async build(ctx, s) {
    const F = await reelFonts(ctx), P = reelPal(ctx), { W, H, u, portrait, square, K } = ctx, D = ctx.D;
    let glows = [];
    if (!ctx.hasBg && String(s.bg ?? '').trim().toLowerCase() !== 'none') {   // no bg: the brand dark with drifting accent glows (block content)
      const bgEl = ctx.el('', `left:0;top:0;width:${W}px;height:${H}px;overflow:hidden;background:${P.ink}`, 'backdrop');
      glows = [[P.acc, .55], [P.acc2, .22], [P.acc, .3]].map(([c, a], i) => {
        const g = document.createElement('div'), r = Math.max(W, H) * [.55, .32, .4][i];
        g.style.cssText = `position:absolute;left:0;top:0;width:${2 * r}px;height:${2 * r}px;border-radius:50%;background:radial-gradient(circle,${reelHexA(c, a)},${reelHexA(c, 0)} 70%)`;
        bgEl.appendChild(g); return { g, r, i };
      });
    }
    const cap = reelCaption(ctx, F, P, s), A = reelArea(ctx, cap);
    const pre = s.pre ?? 'Comment', post = s.post ?? 'to get the link';
    // sizes: the word as big as the area allows; pre/post a third of it
    const ws = Math.min((portrait ? 230 : square ? 200 : 230) * u, A.h * .3);
    const word = reelSticker(ctx, F, P, String(s.word), { look: 'word', size: ws, min: 60 * u, maxW: A.w * (portrait || square ? .96 : .72), maxLines: 1, layer: 'word', ls: '-.01em' });
    const ls = Math.max(40 * u, Math.min(92 * u, word.size * (portrait || square ? .5 : .45)));   // pre/post close to the keyword's weight
    const mkLine = (copy, layer) => {
      if (!copy) return null;
      const el = ctx.el('', 'left:0;top:0;opacity:0', layer);
      const tx = ctx.text(copy, { parent: el, size: ls / u, weight: F.display.weight, lh: 1, ls: '.01em', color: P.paper, accent: P.acc2, nowrap: true,
        style: `position:relative;font-family:${F.display.family};font-style:${F.display.style};text-transform:uppercase;-webkit-text-stroke:.12em ${P.ink};paint-order:stroke fill;text-shadow:0 .08em 0 ${P.ink}` });
      const maxW = A.w * .92;          // a long line shrinks to the safe width (never below 30 px at 1080)
      if (tx.offsetWidth > maxW) tx.style.fontSize = Math.max(30 * u, ls * maxW / tx.offsetWidth).toFixed(2) + 'px';
      return { el, tx, w: tx.offsetWidth, h: tx.offsetHeight };
    };
    const lp = mkLine(pre, 'pre'), lq = mkLine(post, 'post');
    let logo = null;
    if (s.logo !== false) {
      const L = Math.min(120 * u, word.size * .62);
      const el = ctx.el(ctx.logo(L, true), `left:0;top:0;width:${L}px;height:${L}px;opacity:0`, 'logo');
      await Promise.all([...el.querySelectorAll('img')].map(i => i.decode().catch(() => null)));
      logo = { el, w: L, h: L };
    }
    const gL = 34 * u, g1 = 20 * u, g2 = 24 * u;
    const parts = [logo && [logo, gL], lp && [lp, g1], [word, g2], lq && [lq, 0]].filter(Boolean);
    const total = parts.reduce((a, [p, g]) => a + p.h + g, 0);
    let y = A.cy - total / 2;
    const cx = A.cx;
    for (const [p, g] of parts) {
      if (p === word) word.place(cx - word.w / 2, y);
      else { p.x = cx - p.w / 2; p.y = y; p.el.style.left = p.x + 'px'; p.el.style.top = y + 'px'; p.el.style.width = p.w + 'px'; p.el.style.height = p.h + 'px'; }
      y += p.h + g;
    }
    // chat bubble beside the word's top-right corner
    const is = Math.min(150 * u, word.size * .78);
    const wl = word.lines[0], ix = Math.min(A.x1 - is * .9, wl.x + wl.w - is * .28), iy = wl.y - is * .78;
    const icon = ctx.el(`<svg viewBox="0 0 100 100" width="100%" height="100%" style="display:block;overflow:visible">
      <path d="M18 14h64a12 12 0 0 1 12 12v38a12 12 0 0 1-12 12H46L26 92V76h-8A12 12 0 0 1 6 64V26a12 12 0 0 1 12-12z" fill="${P.ink}" transform="translate(4 6)"/>
      <path d="M18 14h64a12 12 0 0 1 12 12v38a12 12 0 0 1-12 12H46L26 92V76h-8A12 12 0 0 1 6 64V26a12 12 0 0 1 12-12z" fill="${P.paper}" stroke="${P.ink}" stroke-width="5" stroke-linejoin="round"/>
      <circle cx="30" cy="45" r="7" fill="${P.acc}"/><circle cx="50" cy="45" r="7" fill="${P.acc}"/><circle cx="70" cy="45" r="7" fill="${P.acc}"/></svg>`,
      `left:${ix}px;top:${iy}px;width:${is}px;height:${is}px;opacity:0`, 'icon');
    if (cap) cap.front();
    const shk = reelShaker(ctx, s.id), G = { cx, cy: A.cy };
    return {
      render(t) {
        const j = shk(t, 2, 10, 14 * u);
        const pulse = K.u01(t, 12, 22) * .022 * Math.sin(t * .26);
        word.lines.forEach(l => {
          const kk = K.u01(t, CT.word, CT.word + 7), e = K.outBack(kk, 2);
          l.el.style.opacity = K.clamp(kk * 3.5).toFixed(3);
          reelXf(l.el, l.x, l.y, l.w, l.h, { cx: G.cx, cy: l.y + l.h / 2, dx: j.x, dy: j.y, rot: -4 + j.r + .5 * Math.sin(t * .08) * K.u01(t, 10, 20) }, { s: K.lerp(1.55, 1, e) + pulse, rot: (1 - K.outCubic(kk)) * -10 });
          reelGloss(l, K.u01((t - 14) % 50, 0, 16), P);
        });
        for (const [p, a, d] of [[lp, CT.pre, -1], [lq, CT.post, 1]]) {
          if (!p) continue;
          const kk = K.u01(t, a, a + 7), e = K.outBack(kk, 1.8);
          p.el.style.opacity = K.clamp(kk * 3).toFixed(3);
          reelXf(p.el, p.x, p.y, p.w, p.h, { cx: G.cx, cy: p.y + p.h / 2, dx: j.x * .5, dy: j.y * .5, rot: -4 }, { dx: (1 - e) * d * .45 * W });
        }
        if (logo) {
          const kk = K.u01(t, CT.logo, CT.logo + 7);
          logo.el.style.opacity = K.clamp(kk * 3).toFixed(3);
          logo.el.style.transformOrigin = '50% 50%';
          logo.el.style.transform = `translateY(${reelF(-5 * u * Math.sin(t * .14) * K.u01(t, CT.logo + 7, CT.logo + 14))}px) scale(${reelF(K.outBack(kk, 2.6))}) rotate(${reelF((1 - kk) * 30)}deg)`;
        }
        {
          const kk = K.u01(t, CT.icon, CT.icon + 7), b = Math.abs(Math.sin((t - CT.icon - 7) * .2)) * K.u01(t, CT.icon + 7, CT.icon + 10);
          icon.style.opacity = K.clamp(kk * 3).toFixed(3);
          icon.style.transformOrigin = '30% 90%';
          icon.style.transform = `translateY(${reelF(-b * 22 * u)}px) scale(${reelF(K.outBack(kk, 2.8))},${reelF(K.outBack(kk, 2.8) * (1 - .06 * (1 - b) * K.u01(t, CT.icon + 7, CT.icon + 10)))}) rotate(${reelF(8 + (1 - kk) * 40 - 4 * b)}deg)`;
        }
        glows.forEach(({ g, r, i }) => {
          const x = W * [.25, .78, .6][i] + .1 * W * Math.sin(t * .035 + i * 2), yy = H * [.3, .7, .2][i] + .06 * H * Math.cos(t * .03 + i);
          g.style.transform = `translate(${reelF(x - r)}px,${reelF(yy - r)}px)`;
        });
        if (cap) cap.render(t);
      },
    };
  },
};
