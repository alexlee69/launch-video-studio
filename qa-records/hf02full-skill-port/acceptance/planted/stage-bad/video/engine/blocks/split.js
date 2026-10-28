// split: before / after. side = two rounded panels that pop in one after the other (left/right on landscape and
// square, stacked on portrait) with label chips and an arrow; wipe = one big frame where a divider with a handle sweeps
// across, revealing `after` over `before`, and settles in the middle.
import { reelF, reelFonts, reelPal, reelSticker, reelXf, reelImg, reelCapPlan, reelCaption, reelArea, reelNudge, reelChip, reelWarn } from './_reel.js';

// timing (block frames), shifted by a headline when there is one
const spT = s => {
  const o = s.text ? 4 : 0;
  return s.mode === 'wipe'
    ? { o, head: -.5, frame: o - 1, labels: o + 7, sweep: o + 10, sweepEnd: o + 26, settle: o + 36 }
    : { o, head: -.5, a: o - 1, b: o + 5, chipA: o + 11, chipB: o + 14, arrow: o + 16 };   // something is on screen from frame 0
};

// every line a viewer reads, in order (timeline: captions SRT, reading time, storyboard, review sheet)
const spCopy = s => [s.text, ...[].concat(s.labels ?? ['Before', 'After']), s.caption].filter(Boolean).map(String);

export default {
  name: 'split',
  doc: 'Before / after: two panels that pop in with label chips and an arrow (side), or one frame where a divider sweeps across to reveal the after image (wipe); optional sticker headline and caption.',
  layers: 'headline · before · after · arrow (side) · divider (wipe) · labels · caption',   // back to front (wipe: `before` = the frame + before image)
  // footage-capable fields: extracted whole (contain), the panel crops once at its own size (plates `${id}:before` …)
  media: [{ field: 'before', fit: 'contain' }, { field: 'after', fit: 'contain' }],
  required: ['before', 'after'],
  params: {
    before: 'image or footage (beforeFrom: seconds into it)',
    after: 'image or footage (afterFrom: seconds into it)',
    labels: 'two chip labels (default [Before, After]), e.g. [Input, Output]',
    mode: 'side (default) | wipe',
    text: 'optional sticker headline above (*accent*, |)',
    arrow: 'side mode: the arrow between the panels (default true)',
    caption: 'word-pop caption (+ captionAt: start frame, default 4)',
  },
  copy: spCopy,
  validate: (s, D) => reelWarn(s, D),
  cues: (s, D) => {
    const T = spT(s), head = s.text ? [{ t: 1, kind: 'hit', note: 84, gain: .8 }] : [];
    if (s.mode === 'wipe') return [...head, { t: T.frame + 2, kind: 'pop', note: 76 }, { t: T.labels, kind: 'tick' }, { t: T.sweep, kind: 'tick', gain: 1.2 }, { t: T.settle - 3, kind: 'pop', note: 84 }];
    return [...head, { t: T.a + 2, kind: 'pop', note: 76 }, { t: T.b + 2, kind: 'pop', note: 81 }, { t: T.chipA, kind: 'tick' }, { t: T.chipB, kind: 'tick' }, ...(s.arrow === false ? [] : [{ t: T.arrow + 2, kind: 'pop', note: 88, gain: .8 }])];
  },
  hero: (s, D) => { const T = spT(s), c = reelCapPlan(s, D), end = s.mode === 'wipe' ? T.settle + 4 : T.arrow + 10; return Math.min(D - 2, Math.max(end, c ? Math.ceil(c.end) + 2 : 0)); },
  async build(ctx, s) {
    const F = await reelFonts(ctx), P = reelPal(ctx), { W, H, u, portrait, square, K } = ctx, D = ctx.D, T = spT(s);
    const wipe = s.mode === 'wipe', labels = [].concat(s.labels ?? ['Before', 'After']).map(String);
    const cap = reelCaption(ctx, F, P, s), A = reelArea(ctx, cap);
    // headline: a pill-look sticker line across the top
    let head = null, top = A.y0;
    if (s.text) {
      head = reelSticker(ctx, F, P, s.text, { look: 'pill', size: (portrait ? 96 : 84) * u, min: 48 * u, maxW: A.w * (portrait ? .96 : .7), maxH: A.h * .2, maxLines: portrait ? 2 : 1, layer: 'headline', stagger: .16 });
      reelNudge(head.place(A.cx - head.w / 2, A.y0), A, -3);
      top = head.y + head.h + 46 * u;
    }
    const box = { x0: A.x0, x1: A.x1, y0: top, y1: A.y1, w: A.w, h: A.y1 - top };
    const R = 30 * u, bw = 6 * u;
    const panel = (f, x, y, w, h, layer) => {
      const el = ctx.el('', `left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${R}px;overflow:hidden;background:${P.ink};box-shadow:0 0 0 ${bw}px ${P.paper},0 ${24 * u}px ${60 * u}px rgba(0,0,0,.45);transform-origin:50% 50%;opacity:0`, layer);
      const im = reelImg(ctx, s, f, `left:0;top:0;width:${w}px;height:${h}px`);
      el.appendChild(im.img);
      return { el, im, x, y, w, h };
    };
    // the push inside a panel is a layout zoom (img size/position, no transform): the panel itself pops and tilts, and
    // a transformed child inside a scaling element would make Chrome composite the panel on its own (--layers)
    const zoom = (p, sc, ox = 0) => { const st = p.im.img.style, w = p.w * sc, h = p.h * sc; st.width = w.toFixed(2) + 'px'; st.height = h.toFixed(2) + 'px'; st.left = ((p.w - w) / 2 + ox).toFixed(2) + 'px'; st.top = ((p.h - h) / 2).toFixed(2) + 'px'; };
    const chipS = 32 * u;
    let pa, pb, frame, arrow = null, divider = null, chips = [], afterBox = null, afterImg = null;
    if (!wipe) {
      const stack = portrait, gap = (stack ? 70 : 110) * u;
      let w, h;
      if (stack) { w = box.w * .96; h = Math.min((box.h - gap) / 2, w * .72); }
      else { w = (box.w * (square ? .98 : .9) - gap) / 2; h = Math.min(box.h, w * (square ? 1.3 : 1.02)); }
      const total = stack ? 2 * h + gap : 2 * w + gap;
      const ax = stack ? box.x0 + (box.w - w) / 2 : A.cx - total / 2, ay = stack ? box.y0 + (box.h - total) / 2 : box.y0 + (box.h - h) / 2;
      pa = panel('before', ax, ay, w, h, 'before'); pa.tilt = stack ? -1.2 : -1.8;
      pb = panel('after', stack ? ax : ax + w + gap, stack ? ay + h + gap : ay, w, h, 'after'); pb.tilt = stack ? 1.2 : 1.8;
      if (s.arrow !== false) {
        const as = Math.min(gap * 1.25, 120 * u), acx = stack ? A.cx : ax + w + gap / 2, acy = stack ? ay + h + gap / 2 : ay + h / 2;
        arrow = ctx.el(`<svg viewBox="0 0 100 100" width="100%" height="100%" style="display:block;overflow:visible"><circle cx="50" cy="50" r="46" fill="${P.acc}" stroke="${P.ink}" stroke-width="6"/><path d="M28 50h40M52 32l18 18-18 18" fill="none" stroke="${P.paper}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" transform="rotate(${stack ? 90 : 0} 50 50)"/></svg>`,
          `left:${acx - as / 2}px;top:${acy - as / 2}px;width:${as}px;height:${as}px;opacity:0`, 'arrow');
        arrow._ = { x: acx - as / 2, y: acy - as / 2, w: as, dir: stack ? [0, 1] : [1, 0] };
      }
    } else {
      const w = portrait ? box.w * .98 : Math.min(box.w * (square ? .96 : .8), box.h * (square ? 1.15 : 1.9)), h = Math.min(box.h, portrait ? w * 1.25 : square ? w * .95 : w * .56);
      const x = A.cx - w / 2, y = box.y0 + (box.h - h) / 2;
      // the frame (ink fill, white ring, shadow) and the before image are ONE layer, `before`: the frame fades and scales
      // in, and an opacity < 1 wrapper around another layer can't be split exactly (--layers); `after` is a child box that
      // stays 0 px wide until the frame is fully opaque and has stopped scaling
      frame = ctx.el('', `left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${R}px;overflow:hidden;background:${P.ink};box-shadow:0 0 0 ${bw}px ${P.paper},0 ${26 * u}px ${70 * u}px rgba(0,0,0,.5);transform-origin:50% 50%;opacity:0`, 'before');
      const bi = reelImg(ctx, s, 'before', `left:0;top:0;width:${w}px;height:${h}px`); frame.appendChild(bi.img);
      afterBox = document.createElement('div'); afterBox.style.cssText = `position:absolute;left:${w}px;top:0;width:0;height:${h}px;overflow:hidden`; ctx.layer(afterBox, 'after'); frame.appendChild(afterBox);
      afterImg = reelImg(ctx, s, 'after', `left:${-w}px;top:0;width:${w}px;height:${h}px`); afterBox.appendChild(afterImg.img);
      pa = { el: frame, im: bi, x, y, w, h, tilt: 0 }; pb = { im: afterImg, x, y, w, h };
      const hs = 92 * u, lw = 7 * u;
      divider = ctx.el(`<div style="position:absolute;left:${(hs - lw) / 2}px;top:0;width:${lw}px;height:${h}px;background:${P.paper};box-shadow:0 0 ${18 * u}px rgba(0,0,0,.45)"></div>
        <div style="position:absolute;left:0;top:${(h - hs) / 2}px;width:${hs}px;height:${hs}px;border-radius:50%;background:${P.paper};box-shadow:0 ${8 * u}px ${24 * u}px rgba(0,0,0,.4),0 0 0 ${5 * u}px ${P.acc}">
        <svg viewBox="0 0 100 100" width="100%" height="100%" style="display:block"><path d="M40 32L22 50l18 18M60 32l18 18-18 18" fill="none" stroke="${P.ink}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`,
        `left:${x - hs / 2}px;top:${y}px;width:${hs}px;height:${h}px;opacity:0`, 'divider');
      divider._ = { x0: x - hs / 2, y, hs, w };
    }
    await Promise.all([pa.im.img, pb.im.img].map(i => i.decode().catch(() => null)));
    // label chips (dark = before, lime = after) at the top-left of each panel, or the two top corners of the wipe frame
    const mk = (i, look) => labels[i] ? reelChip(ctx, F, P, labels[i], look, chipS, 'labels') : null;
    const ca = mk(0, 'dark'), cb = mk(1, 'lime'), inset = 22 * u;
    const corner = (p, ch, right) => {     // a panel corner, rotated with the panel's tilt
      const lx = right ? p.w - inset - ch.w : inset, ly = inset, r = (p.tilt || 0) * Math.PI / 180, cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      const ox = p.x + lx + ch.w / 2 - cx, oy = p.y + ly + ch.h / 2 - cy;
      return { x: cx + ox * Math.cos(r) - oy * Math.sin(r) - ch.w / 2, y: cy + ox * Math.sin(r) + oy * Math.cos(r) - ch.h / 2, rot: p.tilt || 0 };
    };
    if (ca) { const c = corner(pa, ca.lines[0], false); ca.place(c.x, c.y); chips.push({ ch: ca, rot: c.rot, at: wipe ? T.labels : T.chipA }); }
    if (cb) { const c = corner(wipe ? pa : pb, cb.lines[0], wipe); cb.place(c.x, c.y); chips.push({ ch: cb, rot: wipe ? 0 : c.rot, at: wipe ? T.labels + 3 : T.chipB }); }
    if (cap) cap.front();
    const ph = (K.hashStr(s.id) % 628) / 100;
    return {
      async render(t) {
        const p = K.clamp(t / D);
        if (head) head.lines.forEach((l, i) => {
          const kk = K.u01(t, T.head + i * 3, T.head + i * 3 + 6);
          l.el.style.opacity = K.clamp(kk * 3.5).toFixed(3);
          reelXf(l.el, l.x, l.y, l.w, l.h, { cx: A.cx, cy: head.y + head.h / 2, rot: -3 + .5 * Math.sin(t * .1 + ph) * K.u01(t, 6, 16) }, { s: K.lerp(1.45, 1, K.outBack(kk, 1.9)) });
        });
        if (!wipe) {
          [[pa, T.a, -1], [pb, T.b, 1]].forEach(([q, a, side]) => {
            const kk = K.u01(t, a, a + 8), e = K.outBack(kk, 2);
            q.el.style.opacity = K.clamp(kk * 3).toFixed(3);
            const off = (1 - K.outCubic(kk)) * 120 * u;
            q.el.style.transform = `translate(${reelF(portrait ? 0 : side * off * .4)}px,${reelF(portrait ? side * off * .4 : off * .3)}px) rotate(${reelF(q.tilt + (1 - kk) * side * 6)}deg) scale(${reelF(K.lerp(.55, 1, e))})`;
            zoom(q, 1.04 + .09 * p, side * 6 * u * Math.sin(t * .05 + ph));
          });
          if (arrow) {
            const a = arrow._, kk = K.u01(t, T.arrow, T.arrow + 7), nud = 7 * u * Math.sin(t * .32) * K.u01(t, T.arrow + 7, T.arrow + 12);
            arrow.style.opacity = K.clamp(kk * 3).toFixed(3);
            arrow.style.transform = `translate(${reelF(a.dir[0] * nud)}px,${reelF(a.dir[1] * nud)}px) scale(${reelF(K.outBack(kk, 2.6))}) rotate(${reelF((1 - kk) * -90)}deg)`;
          }
        } else {
          const kk = K.u01(t, T.frame, T.frame + 9), e = K.outBack(kk, 1.6);
          frame.style.opacity = K.clamp(kk * 3).toFixed(3);
          frame.style.transform = kk >= 1 ? 'none' : `translateY(${reelF((1 - K.outCubic(kk)) * 60 * u)}px) scale(${reelF(K.lerp(.7, 1, e))})`;
          zoom(pa, 1.03 + .08 * p); afterImg.img.style.width = pa.im.img.style.width; afterImg.img.style.height = pa.im.img.style.height; afterImg.img.style.top = pa.im.img.style.top;
          // divider: off the right edge → sweeps to .16 → settles back to the middle, then drifts
          const sw = K.ioCubic(K.u01(t, T.sweep, T.sweepEnd)), st = K.outBack(K.u01(t, T.sweepEnd, T.settle), 2.2);
          const x = t < T.sweepEnd ? K.lerp(1, .16, sw) : K.lerp(.16, .5, st) + .018 * Math.sin((t - T.settle) * .12) * K.u01(t, T.settle, T.settle + 10);
          const px = pa.w * K.clamp(x, 0, 1);
          afterBox.style.left = px.toFixed(2) + 'px'; afterBox.style.width = (pa.w - px).toFixed(2) + 'px';
          afterImg.img.style.left = (-px + (parseFloat(pa.im.img.style.left) || 0)).toFixed(2) + 'px';
          divider.style.opacity = K.clamp(K.u01(t, T.sweep - 2, T.sweep + 1) * 1.5).toFixed(3);
          divider.style.transform = `translateX(${reelF(px)}px)`;
        }
        chips.forEach(({ ch, rot, at }) => ch.lines.forEach(l => {
          const kk = K.u01(t, at, at + 5);
          l.el.style.opacity = K.clamp(kk * 3).toFixed(3);
          l.el.style.transformOrigin = '50% 50%';
          l.el.style.transform = `rotate(${reelF(rot)}deg) scale(${reelF(K.lerp(1.6, 1, K.outBack(kk, 2)))})`;
        }));
        if (cap) cap.render(t);
        await Promise.all([pa.im.frame(t), pb.im.frame(t)]);
      },
    };
  },
};
