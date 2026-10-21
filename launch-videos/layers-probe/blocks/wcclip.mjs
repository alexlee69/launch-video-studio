// PROBE: an item with will-change:transform inside a card that clips with rounded corners. Chrome composites the card
// (and resamples it at fractional offsets) only while the item is visible, so the card's own layer pass rasterises
// differently from the full frame → layer QA "stack" must FAIL (this is why ui.js items have no will-change)
export default {
  name: 'wcclip', doc: 'probe: compositing that depends on what is visible', params: {},
  cues: () => [], hero: (s, D) => D - 4,
  build(ctx) {
    const card = ctx.el('<div class="in" style="position:absolute;left:30px;top:30px;width:300px;height:80px;border-radius:16px;background:#3E7BFA;will-change:transform"></div>',
      'left:760px;top:380px;width:420px;height:300px;border-radius:40px;overflow:hidden;background:#fff;box-shadow:0 20px 50px rgba(0,0,0,.15)', 'card');
    const item = ctx.layer(card.querySelector('.in'), 'item');
    return { render(t) { card.style.transform = `translateY(${(30 * Math.sin(t * .05) + .37).toFixed(3)}px)`; item.style.transform = `translateX(${(20 * Math.sin(t * .1)).toFixed(3)}px)`; } };
  },
};
