import * as K from '../kit.js';
import * as A from '../art.js';
import { reelFonts, reelPal, reelCaption, reelCapPlan, reelWarn } from './_reel.js';

// Video sources are pre-extracted by lv.mjs into JPEG frames at 60 fps (timeline.plates[shot.id]); images are used as-is.
const isVideo = p => /\.(mp4|mov|m4v|webm|mkv)$/i.test(p || '');
export default {
  name: 'media',
  doc: 'Your own image or footage (live action, screen recording) full-bleed or in a phone/browser frame, with a slow Ken Burns move and an optional headline over a soft scrim.',
  layers: 'media · scrim · headline · caption',   // --layers export, back to front (caption only with caption:)
  params: { src: 'asset path: .png/.jpg/.webp or .mp4/.mov (footage is cut from `from` for the shot length)', from: 'seconds into the footage (default 0)', device: 'none (default, full-bleed) | phone | browser', move: 'in (default) | out | left | right | none — the Ken Burns (a list [x, y] is the camera\'s drift on any shot, over the default in)', text: 'optional headline', pos: 'bottom (default) | top | center — where the headline sits', url: 'address-bar text when device: browser',
    caption: 'optional reel caption: words pop one at a time, the newest on an accent plate (+ captionAt: start frame, default 4)' },
  // every line a viewer reads (captions SRT, reading time, storyboard): only with a caption — otherwise the fixed fields
  copy: s => s.caption ? [s.text, s.caption].filter(x => x != null && String(x).trim() !== '').map(String) : null,
  validate: (s, D) => s.caption ? reelWarn(s, D) : [],
  cues: () => [],
  hero: (s, D) => { const c = s.caption ? reelCapPlan(s, D) : null; return c ? Math.min(D - 2, Math.max(Math.round(D * .6), Math.ceil(c.end) + 2)) : Math.round(D * .6); },
  async build(ctx, s) {
    const { W, H, u, safe, C, portrait } = ctx;
    const video = isVideo(s.src), plate = video ? (ctx.plates || {})[s.id] : null;
    if (video && !plate) throw new Error(`media ${s.id}: footage frames missing (run lv.mjs, which extracts them)`);
    const img = document.createElement('img');
    img.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;display:block';
    img.src = video ? plate.url(0) : ctx.asset(s.src);
    let frame;
    if (!s.device || s.device === 'none') {
      frame = ctx.el('', `left:0;top:0;width:${W}px;height:${H}px;overflow:hidden`, 'media');
      frame.appendChild(img);
    } else {
      const pw = s.device === 'phone' ? Math.min(safe.h * .9 / 2.08, safe.w * (portrait ? .7 : .3)) : Math.min(safe.w * .82, safe.h * .78 * 16 / 10);
      const html = s.device === 'phone' ? A.phoneFrame('', pw, ctx.font, { clock: false }) : A.browserFrame('', pw, pw * 10 / 16, s.url || '', ctx.font);
      frame = ctx.el(html, `left:${W / 2 - pw / 2}px;top:${H / 2 - (s.device === 'phone' ? pw * 2.08 : pw * 10 / 16) / 2 + (s.text ? 40 * u : 0)}px`, 'media');
      frame.querySelector('.lv-screen').prepend(img);
    }
    // a reel caption (built first so a bottom headline can sit above it; drawn last)
    const cap = s.caption ? reelCaption(ctx, await reelFonts(ctx), reelPal(ctx), s) : null;
    let head = null, scrim = null;
    if (s.text) {
      const pos = s.pos || 'bottom';
      if (!s.device || s.device === 'none') {
        scrim = ctx.el('', `left:0;top:0;width:${W}px;height:${H}px;background:linear-gradient(${pos === 'top' ? '180deg' : '0deg'},rgba(0,0,0,.55),rgba(0,0,0,0) 45%)`, 'scrim');
        if (pos === 'center') scrim.style.background = 'rgba(0,0,0,.35)';
      }
      const onPhoto = !s.device || s.device === 'none';
      head = ctx.text(s.text, { size: portrait ? 84 : 80, maxW: safe.w * (pos === 'center' ? 1 : .8), lines: portrait ? 3 : 2, color: onPhoto ? '#fff' : C.ink, accent: onPhoto ? (C.accentOnDark || C.accent) : C.accent, align: pos === 'center' || s.device ? 'center' : 'left', layer: 'headline' });
      head.style.left = (pos === 'center' || s.device ? W / 2 - head.offsetWidth / 2 : safe.x0) + 'px';
      head.style.top = (s.device ? safe.y0 : pos === 'top' ? safe.y0 : pos === 'center' ? H / 2 - head.offsetHeight / 2 : (cap ? Math.min(safe.y1, cap.top - 30 * u) : safe.y1) - head.offsetHeight) + 'px';
    }
    if (cap) cap.front();
    const move = typeof s.move === 'string' && s.move ? s.move : 'in';     // a list `move: [x, y]` is the camera's drift (on top)
    let lastSrc = img.src;
    return {
      async render(t, D) {
        const p = K.clamp(t / D);
        const sc = move === 'none' ? 1 : move === 'out' ? 1.12 - .1 * p : move === 'in' ? 1.02 + .1 * p : 1.1;
        const dx = move === 'left' ? (.04 - .08 * p) * W : move === 'right' ? (-.04 + .08 * p) * W : 0;
        img.style.transform = `translateX(${dx.toFixed(2)}px) scale(${sc.toFixed(5)})`;
        if (head) ctx.reveal(head, t, 4, 2.2);
        if (cap) cap.render(t);
        if (video) {
          const want = plate.url(Math.min(plate.n - 1, Math.max(0, Math.round(t * 2))));
          if (want !== lastSrc) { img.src = want; lastSrc = want; await img.decode().catch(() => null); }
        } else if (!img.complete) await img.decode().catch(() => null);
      },
    };
  },
};
