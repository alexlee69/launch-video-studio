// PROBE: the 'card' layer has an untagged, half-transparent child (outside the card) that forces visibility:visible
// inline, so it is drawn in every layer pass — also the 'text' pass. Restacked it is drawn twice (50 % → 75 %)
// → layer QA "stack" must FAIL
export default {
  name: 'leak', doc: 'probe: a child that escapes its layer', params: {},
  cues: () => [], hero: (s, D) => D - 4,
  build(ctx) {
    const txt = ctx.text('Text layer.', { size: 100, nowrap: true, layer: 'text' }); txt.style.left = '200px'; txt.style.top = '200px';
    const card = ctx.el('<div style="width:420px;height:260px;background:#fff;border-radius:30px;box-shadow:0 20px 50px rgba(0,0,0,.15)"></div><div style="visibility:visible;position:absolute;left:-400px;top:40px;width:160px;height:160px;border-radius:50%;background:rgba(242,89,75,.5)"></div>', 'left:1200px;top:500px', 'card');
    return { render(t) { card.style.transform = `translateY(${(4 * Math.sin(t * .2)).toFixed(2)}px)`; txt.style.transform = `translateY(${(4 * Math.cos(t * .2)).toFixed(2)}px)`; } };
  },
};
