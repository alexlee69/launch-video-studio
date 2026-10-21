// PROBE: draws a headline and never moves (with push: 0 the camera doesn't either) → QA "freeze" must FAIL
export default {
  name: 'still', doc: 'probe: static frame', params: {},
  cues: () => [], hero: (s, D) => 10,
  build(ctx, s) { const el = ctx.text('Nothing moves here.', { size: 90, align: 'center', nowrap: true }); el.style.left = (ctx.W / 2 - el.offsetWidth / 2) + 'px'; el.style.top = (ctx.H / 2 - 50) + 'px'; return { render() {} }; },
};
