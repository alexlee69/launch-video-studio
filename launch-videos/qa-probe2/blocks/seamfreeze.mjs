// PROBE: slides steadily, but holds still for local t 59–60.5 (60-fps frames 118–121 of the shot) → one 4-frame freeze
export default {
  name: 'seamfreeze', doc: 'probe: 4-frame freeze across a worker seam', params: {},
  cues: () => [], hero: () => 30,
  build(ctx) {
    const el = ctx.text('Moving, then not.', { size: 90, align: 'center', nowrap: true });
    el.style.left = (ctx.W / 2 - el.offsetWidth / 2) + 'px'; el.style.top = (ctx.H / 2 - 50) + 'px';
    return { render(t) { const tt = t < 59 ? t : t < 61 ? 59 : t - 1.5; el.style.transform = `translateX(${(tt * 4 - 240).toFixed(2)}px)`; } };
  },
};
