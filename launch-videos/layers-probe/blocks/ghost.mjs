// PROBE: a tagged 'ghost' layer that stays at opacity 0 the whole shot → layer QA "nonempty" must FAIL
export default {
  name: 'ghost', doc: 'probe: a layer that never shows', params: {},
  cues: () => [], hero: (s, D) => D - 4,
  build(ctx) {
    const real = ctx.text('Visible.', { size: 110, nowrap: true, layer: 'real' }); real.style.left = '300px'; real.style.top = (ctx.H / 2 - 60) + 'px';
    const ghost = ctx.el('<div style="width:300px;height:200px;background:#3E7BFA;border-radius:30px"></div>', 'left:1300px;top:400px;opacity:0', 'ghost');
    return { render(t) { real.style.transform = `translateY(${(4 * Math.sin(t * .2)).toFixed(2)}px)`; ghost.style.opacity = 0; } };
  },
};
