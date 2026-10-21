// PROBE: three separate words, none tagged → one `content` layer for a 3-element shot → layer QA "layers" must FAIL
export default {
  name: 'multi', doc: 'probe: untagged multi-element block', params: { words: 'list' },
  cues: () => [], hero: (s, D) => D - 4,
  build(ctx, s) {
    const els = (s.words || []).map((w, i) => { const el = ctx.text(w, { size: 110, nowrap: true }); el.style.left = (300 + i * 480) + 'px'; el.style.top = (ctx.H / 2 - 60) + 'px'; return el; });
    return { render(t) { els.forEach((el, i) => { el.style.transform = `translateY(${(4 * Math.sin(t * .2 + i)).toFixed(2)}px)`; }); } };
  },
};
