// PROBE: one untagged element → a single `content` layer for a single-element shot → layer QA must PASS
export default {
  name: 'single', doc: 'probe: single-element block', params: {},
  cues: () => [], hero: (s, D) => D - 4,
  build(ctx) {
    const el = ctx.text('Just me.', { size: 120, nowrap: true }); el.style.left = (ctx.W / 2 - el.offsetWidth / 2) + 'px'; el.style.top = (ctx.H / 2 - 60) + 'px';
    return { render(t) { el.style.transform = `translateY(${(4 * Math.sin(t * .2)).toFixed(2)}px)`; } };
  },
};
