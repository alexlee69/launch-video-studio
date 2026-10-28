// Layout helpers shared by blocks. "split" = headline beside a visual on landscape, above it on portrait.
export function split(ctx, { side = 'left', stackSquare = true, hasText = true } = {}) {
  const { W, H, safe, portrait, square } = ctx;
  if (!hasText) return { mode: 'center', text: null, vis: { cx: W / 2, cy: H / 2, w: safe.w, h: safe.h } };   // overlay clips: the visual alone, centred
  if (portrait || (square && stackSquare)) {
    return {
      mode: 'stack', text: { x: safe.x0, y: safe.y0 + (portrait ? .01 * H : 0), w: safe.w, align: 'center' },
      vis: { cx: W / 2, cy: portrait ? H * .57 : H * .64, w: safe.w, h: portrait ? H * .52 : H * .55 },
    };
  }
  const tw = (square ? .44 : .38) * W, left = side !== 'right';
  const tx = left ? safe.x0 + .03 * W : W - safe.x0 - .03 * W - tw;
  return {
    mode: 'split', text: { x: tx, w: tw, align: 'left', vcenter: true },
    vis: { cx: left ? W * (square ? .75 : .71) : W * (square ? .25 : .29), cy: H / 2, w: W * (square ? .44 : .5), h: safe.h },
  };
}
export function placeText(ctx, el, spec) {
  el.style.left = spec.x + 'px';
  el.style.width = spec.w + 'px';
  el.style.textAlign = spec.align;
  el.style.top = (spec.vcenter ? ctx.H / 2 - el.offsetHeight / 2 : spec.y) + 'px';
}
// headline sized for the layout: big on its own, smaller next to a visual
export const headSize = (ctx, mode) => mode === 'split' ? (ctx.square ? 66 : 84) : ctx.portrait ? 88 : 76;
export const headLines = (ctx, mode) => mode === 'split' ? 3 : ctx.portrait ? 3 : 2;
// a tiny continuous drift so text-only frames are never pixel-identical (QA forbids frozen frames)
export const drift = (t, i = 0, u = 1) => (1.2 * u * Math.sin(t * .07 + i * 1.7)).toFixed(3);
