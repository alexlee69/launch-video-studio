// Custom block (no imports — helpers come in through ctx): words slam in one after another, centred.
const per = (s, D) => Math.max(6, Math.floor((D - 8) / Math.max(1, (s.words || []).length)));
export default {
  name: 'ticker',
  doc: 'Words slam in one after another, centred.',
  params: { words: 'list of short words' },
  cues: (s, D) => (s.words || []).map((_, i) => ({ t: i * per(s, D), kind: 'pop', note: 80 + i * 3 })),
  hero: (s, D) => D - 6,
  build(ctx, s) {
    const words = s.words || [], p = per(s, ctx.D);
    const els = words.map(w => {
      const el = ctx.text(w, { size: 150, align: 'center', nowrap: true });
      el.style.left = (ctx.W / 2 - el.offsetWidth / 2) + 'px'; el.style.top = (ctx.H / 2 - el.offsetHeight / 2) + 'px';
      return el;
    });
    return {
      render(t) {
        els.forEach((el, i) => {
          const a = i * p, on = t >= a && (i === els.length - 1 || t < a + p), k = ctx.K.outBack(ctx.K.u01(t, a, a + 8));
          el.style.opacity = on ? 1 : 0;
          el.style.transform = `scale(${(.6 + .4 * k).toFixed(4)}) translateY(${(1.5 * Math.sin(t * .2)).toFixed(2)}px)`;
        });
      },
    };
  },
};
