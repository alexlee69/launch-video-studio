// PROBE: shows nothing for its first 20 frames → QA "content" must FAIL on those frames
export default {
  name: 'blank', doc: 'probe: empty frames', params: {},
  cues: () => [], hero: (s, D) => D - 4,
  build(ctx, s) { const el = ctx.text('Late text.', { size: 90, align: 'center', nowrap: true }); el.style.left = (ctx.W / 2 - el.offsetWidth / 2) + 'px'; el.style.top = (ctx.H / 2 - 50) + 'px';
    return { render(t) { el.style.opacity = t < 20 ? 0 : 1; el.style.transform = `translateY(${Math.sin(t * .3).toFixed(3)}px)`; } }; },
};
