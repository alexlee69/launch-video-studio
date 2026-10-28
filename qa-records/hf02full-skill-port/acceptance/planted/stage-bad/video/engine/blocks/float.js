// float: a floating UI card (or a phone) over footage. The card flies in from the side with a (2-D) perspective swing and an
// accent speed streak, settles with a pop, corner focus brackets snap around it with a small label tag (INPUT), then
// it bobs gently. Optional sticker headline and caption. Over the shot's footage (bg, drawn by the engine) or over nothing.
import { reelF, reelFonts, reelPal, reelHexA, reelSticker, reelXf, reelImg, reelCapPlan, reelCaption, reelArea, reelNudge, reelChip, reelWarn } from './_reel.js';

const FT = { fly: -1, land: 12, head: 3, br: 13, tag: 16 };   // the card is on screen from frame 0

// every line a viewer reads, in order (timeline: captions SRT, reading time, storyboard, review sheet)
const ftCopy = s => [s.text, s.label, s.caption].filter(Boolean).map(String);

export default {
  name: 'float',
  doc: 'A floating card (an image, or a phone showing it) over the shot\'s dimmed footage (bg) or over nothing: flies in with a perspective swing and a speed streak, focus brackets snap around it with a label tag, then it bobs; optional sticker headline and caption.',
  layers: 'streak · headline · card · brackets · label · caption',   // back to front, tree order (the engine adds footage under them with bg:)
  bgDefaults: { bgDim: .45 },   // the footage sits well back behind the card
  // the card's footage is extracted whole (contain: its shape decides the layout), plate `${id}:card`
  media: [{ field: 'card', fit: 'contain' }],
  required: ['card'],
  params: {
    card: 'image or footage shown in the card / on the phone screen (a screenshot, a screen recording, a generated clip; cardFrom: seconds into it)',
    bg: '(any shot) AI footage or an image behind (bgDim default .45 here); without it the card floats over nothing (an overlay)',
    device: 'card (default: rounded white card) | phone',
    label: 'tag on the focus brackets, e.g. INPUT (no label = no brackets)',
    streak: 'accent speed streak behind the entrance (default true)',
    from: 'left (default) | right — where the card flies in from',
    text: 'optional sticker headline (beside the card on landscape, above it otherwise)',
    caption: 'word-pop caption (+ captionAt: start frame, default 4)',
  },
  copy: ftCopy,
  validate: (s, D) => reelWarn(s, D),
  cues: (s, D) => [{ t: FT.fly + .4 * (FT.land - FT.fly), kind: 'pop', note: 74 },   // outBack(1.5) first reaches the rest pose at 40 %
    ...(s.text ? [{ t: FT.head + 2, kind: 'hit', note: 86, gain: .7 }] : []), ...(s.label ? [{ t: FT.br + 1, kind: 'tick', gain: 1.2 }, { t: FT.tag + 1, kind: 'tick' }] : [])],
  hero: (s, D) => { const c = reelCapPlan(s, D); return Math.min(D - 2, Math.max(28, c ? Math.ceil(c.end) + 2 : 0)); },
  async build(ctx, s) {
    const F = await reelFonts(ctx), P = reelPal(ctx), { W, H, u, portrait, square, K } = ctx, D = ctx.D;
    const phone = s.device === 'phone', dir = s.from === 'right' ? 1 : -1;
    const cap = reelCaption(ctx, F, P, s), A = reelArea(ctx, cap);
    // the streak: soft bars (violet halo, pink core, lime / white speed lines) fading out away from the card. It is sized
    // by layout (left / width) every frame, never scaled by a transform: a 100-px element stretched ×8 made Chrome
    // composite the streak on its own in its layer pass (--layers stack FAIL at f3, measured)
    const sEdge = s.from === 'right' ? 'right' : 'left', sDeg = s.from === 'right' ? 270 : 90;   // the bars fade away from the card
    const bars = [[0, 6, 100, 88, P.acc, 0, .16, .34], [0, 22, 100, 56, P.acc, 0, .4, .8], [10, 36, 90, 28, P.acc3 || P.acc, 0, .45, .9],
      [24, 14, 76, 5, P.acc2, 0, .5, .95], [40, 82, 60, 4, '#FFFFFF', 0, .45, .9], [4, 48, 96, 3, '#FFFFFF', 0, .38, .75]];
    const streak = s.streak === false ? null : ctx.el(bars.map(([x, y, w, h, c, a0, a1, a2]) =>
      `<div style="position:absolute;${sEdge}:${x}%;top:${y}%;width:${w}%;height:${h}%;border-radius:999px;background:linear-gradient(${sDeg}deg,${reelHexA(c, a0)},${reelHexA(c, a1)} 50%,${reelHexA(c, a2)})"></div>`).join(''),
      'left:0;top:0;width:0;height:10px;opacity:0', 'streak');
    // where things go: headline beside the card on landscape (when there is one), above it otherwise
    let head = null, box = { x0: A.x0, x1: A.x1, y0: A.y0, y1: A.y1 };
    // the card image first (its shape decides the layout): a wide card stacks under the headline, a tall one (or a phone)
    // sits beside it on landscape (and a phone beside it on square)
    const src = reelImg(ctx, s, 'card', '');
    await src.img.decode().catch(() => null);
    const ar = (src.img.naturalWidth || 16) / (src.img.naturalHeight || 10);
    const side = !!s.text && !portrait && (phone || (!square && ar < 1.6));
    if (s.text) {
      const hw = side ? A.w * .4 : A.w * (portrait ? .96 : .86);
      head = reelSticker(ctx, F, P, s.text, { look: 'outline', size: (side ? (square ? 120 : 150) : portrait ? 130 : 110) * u, min: 56 * u, maxW: hw, maxH: side ? A.h * .7 : A.h * .26, maxLines: side ? 3 : 2, layer: 'headline' });
      if (side) { reelNudge(head.place(dir < 0 ? A.x1 - head.w : A.x0, A.cy - head.h / 2), A, -4); box = dir < 0 ? { x0: A.x0, x1: A.x1 - head.w - .04 * W, y0: A.y0, y1: A.y1 } : { x0: A.x0 + head.w + .04 * W, x1: A.x1, y0: A.y0, y1: A.y1 }; }
      else { reelNudge(head.place(A.cx - head.w / 2, A.y0), A, -4); box.y0 = head.y + head.h + 46 * u; }
    }
    const bw = box.x1 - box.x0, bh = box.y1 - box.y0, label = s.label ? String(s.label) : null, m = label ? (portrait || square ? 34 : 40) * u : 0;   // bracket margin
    // the card isn't text: on portrait / square (no headline beside it) it may run wider than the text-safe band
    const room = { w: side ? bw - 2 * m : Math.max(bw, .88 * W) - 2 * m, h: bh - 2 * m - (label ? 50 * u : 0) };
    // the card: image in a white rounded card (its own aspect), or a phone frame
    let cw, ch, card;
    if (phone) {
      cw = Math.min(room.h * .96 / 2.08, room.w * (portrait ? .7 : .62)); ch = cw * 2.08;
      card = ctx.el(ctx.A.phoneFrame('', cw, ctx.font, { clock: false }), `left:0;top:0;width:${cw}px;height:${ch}px;opacity:0`, 'card');
      src.img.style.cssText += 'left:0;top:0;width:100%;height:100%';
      card.querySelector('.lv-screen').prepend(src.img);
      card.firstElementChild.style.boxShadow = `0 ${40 * u}px ${90 * u}px rgba(0,0,0,.55)`;
    } else {
      const pad = 12 * u;
      const maxW = room.w * (portrait || square || side ? 1 : .86), maxH = room.h * (portrait ? .8 : .94);
      const iw = Math.min(maxW - 2 * pad, (maxH - 2 * pad) * ar);
      cw = iw + 2 * pad; ch = iw / ar + 2 * pad;
      card = ctx.el('', `left:0;top:0;width:${cw}px;height:${ch}px;border-radius:${30 * u}px;background:${P.paper};box-shadow:0 ${40 * u}px ${90 * u}px rgba(0,0,0,.5),0 0 0 ${1.5 * u}px rgba(0,0,0,.06);opacity:0`, 'card');
      src.img.style.cssText += `left:${pad}px;top:${pad}px;width:${iw}px;height:${iw / ar}px;border-radius:${20 * u}px`;
      card.appendChild(src.img);
    }
    const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2 + (label ? 25 * u : 0);
    const C0 = { x: cx - cw / 2, y: cy - ch / 2 };
    card.style.left = C0.x + 'px'; card.style.top = C0.y + 'px';
    // focus brackets (one element, four corner arms) + the label tag above the top-left arm
    let br = null, tag = null;
    if (label) {
      const bx = C0.x - m, by = C0.y - m, bW = cw + 2 * m, bH = ch + 2 * m, a = Math.min(72 * u, bW * .22, bH * .22), sw = 8 * u, i = sw / 2;
      const d = `M${i} ${a}V${i}H${a}M${bW - a} ${i}H${bW - i}V${a}M${bW - i} ${bH - a}V${bH - i}H${bW - a}M${a} ${bH - i}H${i}V${bH - a}`;
      br = ctx.el(`<svg width="${bW}" height="${bH}" viewBox="0 0 ${bW} ${bH}" style="display:block;overflow:visible"><path d="${d}" fill="none" stroke="${reelHexA(P.ink, .35)}" stroke-width="${sw + 5 * u}" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 ${2 * u})"/><path d="${d}" fill="none" stroke="${P.paper}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        `left:${bx}px;top:${by}px;width:${bW}px;height:${bH}px;opacity:0`, 'brackets');
      br._ = { x: bx, y: by, w: bW, h: bH };
      tag = reelChip(ctx, F, P, label, 'lime', (square ? 30 : 34) * u, 'label');
      tag.place(Math.max(bx, A.x0), by - tag.h - 12 * u);   // text stays in the safe band even when the card runs wider
    }
    if (cap) cap.front();
    const ph = (K.hashStr(s.id) % 628) / 100, travel = dir < 0 ? -(C0.x + cw + .08 * W) : W - C0.x + .08 * W;   // starts fully off-frame
    return {
      async render(t) {
        // entrance: from off-frame with a perspective swing, overshoot, settle; then a gentle bob
        const kk = K.u01(t, FT.fly, FT.land), e = K.outBack(kk, 1.5), q = 1 - K.outCubic(kk);
        const ex = (1 - e) * travel, swing = q * dir * 55, roll = q * dir * -10;
        const idle = K.u01(t, FT.land, FT.land + 14), bob = { dx: 0, dy: idle * 9 * u * Math.sin(t * .1 + ph), rot: idle * (.6 * Math.sin(t * .07 + ph) + .2 * Math.sin(t * .19)), s: 1 + idle * .006 * Math.sin(t * .13) };
        const g = { cx, cy, ...bob };
        card.style.opacity = K.clamp(kk * 4).toFixed(3);
        // the swing is a 2-D stand-in for perspective (narrowed + sheared like a card turning on its vertical axis): a real
        // perspective()/rotateY() makes Chrome composite the card on its own while it is partly off-frame, and the layer
        // pass then rasterises it differently from the full frame (--layers stack FAIL on the first frames, measured)
        const sc = K.lerp(.72, 1, K.clamp(e, 0, 1.1)), turn = Math.cos(swing * Math.PI / 180);
        reelXf(card, C0.x, C0.y, cw, ch, g, { dx: ex, rot: roll, sx: sc * turn, sy: sc, p: kk < 1 ? `skewY(${reelF(-swing * .28)}deg)` : '' });
        if (streak) {
          // a smear trailing the card's back edge, as long as the card is fast, gone shortly after it lands
          const v = Math.abs(K.outBack(K.u01(t + .5, FT.fly, FT.land), 1.5) - K.outBack(K.u01(t - .5, FT.fly, FT.land), 1.5)) * Math.abs(travel);
          const len = Math.min(.75 * W, v * 9 + (1 - K.u01(t, FT.land - 2, FT.land + 8)) * .12 * W), hgt = ch * .7;
          const edge = C0.x + (dir < 0 ? 0 : cw) + ex;
          // only the part inside the frame is drawn: a streak lying (almost) wholly off-frame was composited on its own in
          // its layer pass (--layers stack FAIL at 9:16 f3, where the card's back edge is still left of the frame)
          let x0 = dir < 0 ? edge - len + .05 * cw : edge - .05 * cw, x1 = dir < 0 ? edge + .05 * cw : edge + len - .05 * cw;
          x0 = Math.max(x0, -.01 * W); x1 = Math.min(x1, 1.01 * W);
          const vis = x1 - x0 > 60 * u;
          streak.style.left = reelF(vis ? x0 : 0) + 'px'; streak.style.width = reelF(vis ? x1 - x0 : 0) + 'px';
          streak.style.top = reelF(cy - hgt / 2 + bob.dy) + 'px'; streak.style.height = reelF(hgt) + 'px';
          streak.style.opacity = vis ? (K.clamp(K.u01(t, -1, 2)) * (1 - K.u01(t, FT.land, FT.land + 9))).toFixed(3) : '0';
        }
        if (br) {
          const a = br._, k2 = K.u01(t, FT.br, FT.br + 5);
          br.style.opacity = K.clamp(k2 * 3).toFixed(3);
          reelXf(br, a.x, a.y, a.w, a.h, g, { s: K.lerp(1.28, 1, K.outBack(k2, 2.2)) });
          const k3 = K.u01(t, FT.tag, FT.tag + 5);
          tag.lines.forEach(l => { l.el.style.opacity = K.clamp(k3 * 3).toFixed(3); reelXf(l.el, l.x, l.y, l.w, l.h, g, { s: K.lerp(.4, 1, K.outBack(k3, 2.4)), dy: (1 - K.outCubic(k3)) * 14 * u }); });
        }
        if (head) head.lines.forEach((l, i) => {
          const a = FT.head + i * 3, k4 = K.u01(t, a, a + 5);
          l.el.style.opacity = K.clamp(k4 * 3.5).toFixed(3);
          reelXf(l.el, l.x, l.y, l.w, l.h, { cx: head.x + head.w / 2, cy: head.y + head.h / 2, rot: -4 + .5 * Math.sin(t * .09 + ph) * K.u01(t, 12, 22) }, { s: K.lerp(1.4, 1, K.outBack(k4, 1.9)), rot: (1 - K.outCubic(k4)) * -8 });
        });
        if (cap) cap.render(t);
        await src.frame(t);
      },
    };
  },
};
