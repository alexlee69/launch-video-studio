// PROBE: three painted cards inside ONE unpainted, untagged wrapper → still three elements in one `content` layer
// → layer QA "layers" must FAIL (elements are counted inside unpainted wrappers, not just top-level children)
export default {
  name: 'wrapped', doc: 'probe: several elements in one untagged wrapper', params: {},
  cues: () => [], hero: (s, D) => D - 4,
  build(ctx) {
    const wrap = ctx.el([0, 1, 2].map(i => `<div style="position:absolute;left:${i * 460}px;top:0;width:380px;height:240px;border-radius:30px;background:${['#3E7BFA', '#2FC2A3', '#FFC53D'][i]}"></div>`).join(''), `left:${ctx.W / 2 - 680}px;top:${ctx.H / 2 - 120}px;width:1360px;height:240px`);
    return { render(t) { wrap.style.transform = `translateY(${(4 * Math.sin(t * .2)).toFixed(2)}px)`; } };
  },
};
