// PROBE: a moving headline that disappears for the shot's last 12 frames (60 fps), i.e. during the camera's exit
export default {
  name: 'blankexit', doc: 'probe: blank during the exit move', params: {},
  cues: () => [], hero: (s, D) => Math.round(D * .4),
  build(ctx) {
    const el = ctx.text('Gone before the cut.', { size: 90, align: 'center', nowrap: true });
    el.style.left = (ctx.W / 2 - el.offsetWidth / 2) + 'px'; el.style.top = (ctx.H / 2 - 50) + 'px';
    return { render(t, D) { el.style.opacity = t >= D - 6 ? 0 : 1; el.style.transform = `translateY(${Math.sin(t * .3).toFixed(3)}px)`; } };
  },
};
