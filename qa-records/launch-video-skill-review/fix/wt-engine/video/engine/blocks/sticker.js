// sticker: the reel title card. A 1–4 word title slams in (scale overshoot, rotation settling to the tilt, an impact
// shake), an optional kicker pill pops above, a ribbon tag slides in below, sparkles twinkle; idle breathing keeps it
// alive. Over the shot's footage (bg: an AI video or an image, drawn by the engine) or over nothing (an overlay for the
// user's own footage: --clips --alpha).
import { reelWords, reelFonts, reelPal, REEL_GEO, reelSticker, reelGloss, reelXf, reelShaker, reelCapPlan, reelCaption, reelArea, reelEnvelope, reelWarn } from './_reel.js';

// timing (block frames) — shared by cues, hero and render
const ST = { slam: -.5, land: 9, kick: 9, rib: 12, spark: 13, shake: 2, shakeLen: 11 };
const stLinesGap = n => n > 1 ? Math.min(4, 5 / (n - 1)) : 0;

// every line a viewer reads, in order (timeline: captions SRT, reading time, storyboard, review sheet)
const stCopy = s => [s.kicker, s.text, s.ribbon, s.caption].filter(Boolean).map(String);

export default {
  name: 'sticker',
  doc: 'Reel title card: 1–4 heavy italic words slam in as a sticker (outline / plate / pill) with an impact shake, an optional kicker pill above and a ribbon tag below, over the shot\'s footage (bg) or over nothing (an overlay).',
  layers: 'sparks · kicker · title · ribbon · caption',   // --layers export, back to front (the engine adds footage under them with bg:)
  bgDefaults: { bgDim: .25 },   // the shot's bg gets a heavier scrim than the engine's .15 under sticker type
  media: [],
  // the footage takes half of the impact shake (pure in t: the same seeded shaker as the title)
  bgMotion: (ctx, s) => { if (s.shake === false) return null; const shk = reelShaker(ctx, s.id); return t => { const j = shk(t, ST.shake, ST.shakeLen, 16 * ctx.u); return { x: j.x * .5, y: j.y * .5 }; }; },
  required: ['text'],
  params: {
    text: '1–4 words; *accent* words take the second colour, | forces a line break (else split for the biggest fit)',
    style: 'outline (default: white, thick ink stroke, accent offset shadow) | plate (ink on a white slanted plate) | pill (white in an ink slanted box)',
    kicker: 'small pill above, e.g. "Popframe × Studio"',
    logo: 'true: the brand logo inside the kicker pill',
    ribbon: 'tag below, e.g. "Free to start"',
    bg: '(any shot) AI footage or an image behind the sticker (bgDim default .25 here, bgFrom, bgMove); omit it for an overlay',
    tilt: 'degrees (default −5)',
    pos: 'center (default) | top | bottom',
    shake: 'impact shake after the slam (default true)',
    sparks: 'sparkles around the title (default true)',
    gloss: 'a light sweep across plates (default true)',
    caption: 'word-pop caption (+ captionAt: start frame, default 4)',
  },
  copy: stCopy,
  validate: (s, D) => [...(reelWords(s.text).length > 4 ? [`sticker ${s.id}: ${reelWords(s.text).length} words — a sticker reads at a glance with 1–4`] : []), ...reelWarn(s, D)],
  cues: (s, D) => [{ t: 1, kind: 'hit', note: 86 }, ...(s.kicker ? [{ t: ST.kick + 1, kind: 'pop', note: 86, gain: .8 }] : []), ...(s.ribbon ? [{ t: ST.rib + 2, kind: 'pop', note: 79 }] : [])],
  hero: (s, D) => { const c = reelCapPlan(s, D); return Math.min(D - 2, Math.max(30, c ? Math.ceil(c.end) + 2 : 0)); },
  async build(ctx, s) {
    const F = await reelFonts(ctx), P = reelPal(ctx), { W, H, u, portrait, square, K } = ctx, D = ctx.D;
    const look = ['outline', 'plate', 'pill'].includes(s.style) ? s.style : 'outline';
    const tilt = Number(s.tilt ?? -5), rad = Math.abs(tilt) * Math.PI / 180, shake = s.shake !== false, pos = s.pos || 'center';
    const cap = reelCaption(ctx, F, P, s), A = reelArea(ctx, cap);
    const sparkEls = s.sparks === false ? [] : [0, 1, 2].map(i => ctx.el(`<svg viewBox="0 0 100 100" width="100%" height="100%" style="display:block;overflow:visible"><path d="M50 2C53 34 66 47 98 50 66 53 53 66 50 98 47 66 34 53 2 50 34 47 47 34 50 2z" fill="${[P.acc2, P.paper, P.acc][i]}" stroke="${P.ink}" stroke-width="5" stroke-linejoin="round"/></svg>`, 'left:0;top:0;width:10px;height:10px;opacity:0', 'sparks'));
    // the kicker: a white pill (logo + words) with a hard ink drop
    let kick = null;
    if (s.kicker) {
      const ks = (square ? 32 : 34) * u, kh = ks * 2;
      const el = ctx.el('', `left:0;top:0;height:${kh}px;display:flex;align-items:center;gap:${.36 * ks}px;padding:0 ${.72 * ks}px 0 ${(s.logo ? .32 : .72) * ks}px;border-radius:${kh / 2}px;background:${P.paper};box-shadow:0 ${.16 * ks}px 0 ${P.ink};white-space:nowrap;opacity:0`, 'kicker');
      if (s.logo) { const lg = document.createElement('div'); lg.style.cssText = `flex:none;width:${kh * .72}px;height:${kh * .72}px`; lg.innerHTML = ctx.logo(kh * .72); el.appendChild(lg); }
      const kt = ctx.text(s.kicker, { parent: el, size: ks / u, weight: 800, lh: 1, ls: '-.01em', color: P.ink, accent: P.acc, nowrap: true, style: `position:relative;font-family:${F.display.family};font-style:${F.display.style}` });
      await Promise.all([...el.querySelectorAll('img')].map(i => i.decode().catch(() => null)));
      kick = { el, w: el.offsetWidth, h: kh, txt: kt };
    }
    // title + ribbon, laid out as a stack (kicker / title / ribbon) and shrunk until the tilted lockup fits the area
    const maxS = (portrait ? 210 : square ? 180 : 240) * u, g1 = 22 * u, g2 = 18 * u;
    let title, rib, G, k = 1;
    const placeAll = (y0, cx) => {
      let y = y0;
      if (kick) { kick.x = cx - kick.w / 2; kick.y = y; kick.el.style.left = kick.x + 'px'; kick.el.style.top = y + 'px'; y += kick.h + g1; }
      title.place(cx - title.w / 2, y); y += title.h;
      if (rib) { y += g2; rib.place(Math.min(A.x1 - rib.w, cx - rib.w / 2 + title.w * .14), y); y += rib.h; }
      G = { cx, cy: (y0 + y) / 2 };
      return [...(kick ? [{ x: kick.x, y: kick.y, w: kick.w, h: kick.h }] : []), ...title.rects(), ...(rib ? rib.rects() : [])];
    };
    let env, y0;
    for (let it = 0; it < 8; it++) {
      const ribS = Math.max(34 * u, Math.min(54 * u, maxS * .28 * k));
      const fixedH = (kick ? kick.h + g1 : 0) + (s.ribbon ? REEL_GEO.ribbon.h * ribS + g2 : 0);
      title = reelSticker(ctx, F, P, s.text, { look, size: maxS * k, min: 56 * u, maxW: A.w * (portrait ? .94 : square ? .9 : .8), maxH: (A.h - fixedH) * .9, maxLines: portrait ? 3 : 2, layer: 'title', stagger: look === 'outline' ? 0 : .22 });
      rib = s.ribbon ? reelSticker(ctx, F, P, s.ribbon, { look: 'ribbon', size: Math.min(ribS, title.size * .34), min: 30 * u, maxW: A.w * .7, maxLines: 1, layer: 'ribbon', ls: '.01em' }) : null;
      const gh = (kick ? kick.h + g1 : 0) + title.h + (rib ? g2 + rib.h : 0);
      y0 = pos === 'top' ? A.y0 : pos === 'bottom' ? A.y1 - gh : A.cy - gh / 2;
      env = reelEnvelope(placeAll(y0, A.cx), { x: G.cx, y: G.cy }, tilt, 1, .02);   // idle wobble ≤ .95°, breathing ≤ 1.8 %
      if ((env.w <= A.w && env.h <= A.h) || it === 7) break;
      title.remove(); if (rib) rib.remove(); k *= .92;
    }
    // nudge the tilted lockup inside the area (top / bottom placement leans past it otherwise)
    const nx = Math.max(A.x0 - env.x0, Math.min(0, A.x1 - env.x1)), ny = Math.max(A.y0 - env.y0, Math.min(0, A.y1 - env.y1));
    if (nx || ny) placeAll(y0 + ny, A.cx + nx);
    const S = title.size, n = title.lines.length, lgap = stLinesGap(n);
    // sparkles: top-right, bottom-left and left of the title (sizes in title em)
    const sp = [[title.x + title.w + .05 * S, title.y - .22 * S, .5], [title.x - .3 * S, title.y + title.h - .25 * S, .34], [title.x + title.w * .08, title.y - .3 * S, .24]].map(([x, yy, sz], i) => {
      const el = sparkEls[i]; if (!el) return null;
      const w = sz * S, px = Math.max(A.x0 - .04 * W, Math.min(A.x1 + .02 * W - w, x)), py = yy;
      el.style.left = px + 'px'; el.style.top = py + 'px'; el.style.width = w + 'px'; el.style.height = w + 'px';
      return { el, x: px, y: py, w };
    }).filter(Boolean);
    const shk = reelShaker(ctx, s.id), ph = (K.hashStr(s.id) % 628) / 100;
    if (cap) cap.front();
    return {
      render(t) {
        const j = shake ? shk(t, ST.shake, ST.shakeLen, 16 * u) : { x: 0, y: 0, r: 0 };
        const idle = K.u01(t, 3, 14);          // breathing starts as soon as the first line lands (shake: false must not freeze)
        const g = { cx: G.cx, cy: G.cy, dx: j.x, dy: j.y, rot: tilt + j.r + idle * (.7 * Math.sin(t * .09 + ph) + .25 * Math.sin(t * .23 + ph * 2)),
          s: 1 + idle * (.014 * Math.sin(t * .17 + ph) + .004 * Math.sin(t * .41)) };
        title.lines.forEach((l, i) => {
          const a = ST.slam + i * lgap, kk = K.u01(t, a, a + 6), e = K.outBack(kk, 1.9);
          l.el.style.opacity = K.clamp(kk * 3.5).toFixed(3);
          reelXf(l.el, l.x, l.y, l.w, l.h, g, { s: K.lerp(1.45, 1, e), rot: (1 - K.outCubic(kk)) * (i % 2 ? 7 : -9) });
          reelGloss(l, s.gloss === false ? 0 : K.u01((t - ST.land - 6) % 54, 0, 16), P);
        });
        if (kick) {
          const kk = K.u01(t, ST.kick, ST.kick + 7), e = K.outBack(kk, 2.6);
          kick.el.style.opacity = K.clamp(kk * 3).toFixed(3);
          reelXf(kick.el, kick.x, kick.y, kick.w, kick.h, g, { s: K.lerp(.3, 1, e), dy: (1 - K.outCubic(kk)) * 20 * u });
        }
        if (rib) rib.lines.forEach(l => {
          const kk = K.u01(t, ST.rib, ST.rib + 7), e = K.outBack(kk, 1.7);
          l.el.style.opacity = K.clamp(kk * 3).toFixed(3);
          reelXf(l.el, l.x, l.y, l.w, l.h, g, { dx: (1 - e) * -.34 * W, sx: K.lerp(1.25, 1, K.clamp(e, 0, 1.2)), sy: 1 });
          reelGloss(l, s.gloss === false ? 0 : K.u01((t - ST.rib - 12) % 54, 0, 16), P);
        });
        sp.forEach((p, i) => {
          const a = ST.spark + i * 2.5, kk = K.u01(t, a, a + 6), e = K.outBack(kk, 2.8);
          p.el.style.opacity = K.clamp(kk * 3).toFixed(3);
          reelXf(p.el, p.x, p.y, p.w, p.w, g, { s: e * (1 + .12 * Math.sin(t * .3 + i * 2.1)), rot: (1 - kk) * -120 + 10 * Math.sin(t * .12 + i) });
        });
        if (cap) cap.render(t);
      },
    };
  },
};
