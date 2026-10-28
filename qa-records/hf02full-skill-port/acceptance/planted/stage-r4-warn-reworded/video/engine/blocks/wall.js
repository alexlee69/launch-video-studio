// wall — a floating video wall: tilted phone-ratio cards (images or footage; repeated to fill) at three
// depths on a light background, drifting with parallax (far slow and soft, near fast and out of focus) under a slow
// camera dolly; colourful label chips ride on some cards; an optional centre headline sits on a soft glow.
// Real CSS 3D tilt per card.
import { F } from './_film.js';


const cardsOf = s => [].concat(s.cards || []).map(String);
const chipsOf = s => [].concat(s.chips || []).map(String);
const CHIP_COLS = [['#FF4FA3', '#fff'], ['#1FC0EE', '#fff'], ['#B5EC3C', '#14210A'], ['#5747F2', '#fff'], ['#FF8A3D', '#fff']];
const TIERS = { far: { k: .6, v: .45, blur: 2.4, op: .82 }, mid: { k: .88, v: .9, blur: 0, op: 1 }, near: { k: 1.22, v: 1.7, blur: 3.2, op: 1 } };
export default {
  name: 'wall',
  doc: 'A floating video wall: tilted phone-ratio cards at three depths drifting with parallax under a slow camera dolly, colourful label chips on some cards, an optional centre headline on a soft glow.',
  layers: 'far · mid · near · glow · headline',
  // card footage is extracted at half size (the plate's longer side = .5 × the frame's): the biggest card is ~half the height
  media: [{ field: 'cards', fit: 'contain', scale: .5 }],
  copy: s => [s.text, ...chipsOf(s)].filter(x => x != null && String(x).trim() !== '').map(String),
  read: s => [s.text].filter(x => x != null && String(x).trim() !== '').map(String),
  params: { cards: 'list of images or footage (cardsFrom: seconds into each), repeated to fill the wall', chips: 'labels for the chips, e.g. [Hook in 1s, Product close-up] (colours cycle)', text: 'optional centre headline (*accent* ok)', chrome: 'ugc (default: a faint social-video overlay on each card) | none', drift: 'up (default) | down | left | right' },
  required: ['cards'],
  cues: s => [{ t: 0, kind: 'hit', note: 84, gain: .5 }, ...chipsOf(s).slice(0, 6).map((_, j) => ({ t: 12 + j * 5, kind: 'pop', note: [81, 84, 86, 88, 91, 93][j], gain: .55 }))],
  hero: (s, D) => Math.min(D - 8, Math.max(40, 14 + chipsOf(s).length * 5 + 10)),
  async build(ctx, s) {
    const { W, H, u, K, A, safe, portrait, square } = ctx, B = ctx.brand.colors;
    const srcs = cardsOf(s), chips = chipsOf(s), ugc = s.chrome !== 'none', r = F.rng(F.hash('wall:' + s.id));
    const cols = portrait ? 4 : square ? 5 : 7, rows = portrait ? 6 : square ? 4 : 4;
    const RW = W * (portrait ? 1.3 : 1.22), RH = H * (portrait ? 1.36 : 1.5), cellW = RW / cols, cellH = RH / rows;
    const base = H * (portrait ? .235 : square ? .36 : .4);
    const dir = typeof s.drift === 'string' ? s.drift || 'up' : 'up',     // (a map is the shot's drift-cut strengths)
      dvx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0, dvy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
    const groups = Object.fromEntries(Object.keys(TIERS).map(k => [k, ctx.el('', `left:0;top:0;width:${W}px;height:${H}px;isolation:isolate`, k)]));
    const slots = [];
    for (let rr = 0; rr < rows; rr++) for (let c = 0; c < cols; c++) {
      const cx = W / 2 - RW / 2 + (c + .5) * cellW + (r() - .5) * cellW * .42 + (rr % 2 ? cellW * .22 : 0), cy = H / 2 - RH * (dvy < 0 ? .36 : .5) + (rr + .5) * cellH + (r() - .5) * cellH * .3;
      const central = s.text && Math.abs(cx - W / 2) < W * (portrait ? .36 : .27) && Math.abs(cy - H / 2) < H * (portrait ? .12 : .2);
      const x = r(), tier = central ? 'far' : x < .28 ? 'far' : x < .78 ? 'mid' : 'near';
      slots.push({ cx, cy, tier, d: Math.hypot((cx - W / 2) / W, (cy - H / 2) / H) });
    }
    // where a slot's card centre is at local frame t (drift + dolly) — shared by the chip choice and render
    const D0 = ctx.D, at = (sl, t, ph = 0) => {
      const T = TIERS[sl.tier], dolly = 1 + .085 * K.ioCubic(K.clamp(t / D0));
      const dx = dvx * T.v * t * u + 6 * u * Math.sin(t * .03 + ph), dy = dvy * T.v * t * u + 4 * u * Math.cos(t * .027 + ph);
      return { X: W / 2 + (sl.cx + dx - W / 2) * dolly, Y: H / 2 + (sl.cy + dy - H / 2) * dolly, dolly };
    };
    // chips ride on crisp mid-depth cards near the centre whose chip stays well inside the frame at the hero frame
    const heroF = Math.min(D0 - 8, Math.max(40, 14 + chips.length * 5 + 10)), cfs = (portrait ? 26 : 24) * u;
    const chipSlots = [];
    for (const sl of slots.filter(x => x.tier === 'mid').sort((a, b) => a.d - b.d)) {
      if (chipSlots.length >= chips.length) break;
      const label = chips[chipSlots.length], cwid = label.length * cfs * .56 + cfs * 1.3 + 26 * u, h = base * TIERS.mid.k, w = h * 9 / 16, { X, Y, dolly } = at(sl, heroF);
      const x1 = X + (w / 2 + cwid) * dolly * 1.06, yc = Y + (h * .1) * dolly;
      if (x1 < safe.x1 - 10 * u && X - w / 2 > safe.x0 - w && yc > safe.y0 + 40 * u && yc < safe.y1 - 40 * u) chipSlots.push(sl);
    }
    let ci = 0;
    const cards = slots.map((sl, i) => {
      const T = TIERS[sl.tier], land = !chipSlots.includes(sl) && r() < .16, h = base * T.k * (land ? .56 : 1), w = land ? h * 1.6 : h * 9 / 16;
      const src = srcs[(i * 7 + 3) % srcs.length], field = `cards.${(i * 7 + 3) % srcs.length}`;
      const card = document.createElement('div');
      card.style.cssText = `position:absolute;left:${sl.cx - w / 2}px;top:${sl.cy - h / 2}px;width:${w}px;height:${h}px`;
      const box = document.createElement('div');
      box.style.cssText = `position:absolute;inset:0;border-radius:${Math.min(w, h) * .09}px;overflow:hidden;background:#D8DAE2;box-shadow:0 ${h * .05}px ${h * .14}px rgba(20,24,40,.18)`;
      const m = F.media(ctx, s, field, src);
      box.appendChild(m.img);
      if (ugc) {
        const g = document.createElement('div');
        g.style.cssText = `position:absolute;left:0;right:0;bottom:0;height:42%;background:linear-gradient(0deg,rgba(0,0,0,.5),rgba(0,0,0,0))`;
        const f = h / 400;
        g.innerHTML = `<div style="position:absolute;left:${14 * f * 1.6}px;bottom:${46 * f * 1.6}px;width:${16 * f * 1.6}px;height:${16 * f * 1.6}px;border-radius:50%;background:#fff;opacity:.9"></div>
          <div style="position:absolute;left:${36 * f * 1.6}px;bottom:${50 * f * 1.6}px;width:${(60 + r() * 50) * f}px;height:${7 * f * 1.6}px;border-radius:9px;background:rgba(255,255,255,.85)"></div>
          <div style="position:absolute;left:${14 * f * 1.6}px;bottom:${26 * f * 1.6}px;width:${(110 + r() * 60) * f}px;height:${6 * f * 1.6}px;border-radius:9px;background:rgba(255,255,255,.55)"></div>
          <div style="position:absolute;left:${14 * f * 1.6}px;bottom:${12 * f * 1.6}px;width:${(70 + r() * 50) * f}px;height:${6 * f * 1.6}px;border-radius:9px;background:rgba(255,255,255,.4)"></div>
          ${[0, 1, 2].map(j => `<div style="position:absolute;right:${12 * f * 1.6}px;bottom:${(60 + j * 30) * f * 1.6}px;width:${14 * f * 1.6}px;height:${14 * f * 1.6}px;border-radius:50%;box-shadow:inset 0 0 0 ${2 * f * 1.6}px rgba(255,255,255,.8)"></div>`).join('')}`;
        box.appendChild(g);
      }
      card.appendChild(box);
      let chip = null;
      if (chipSlots.includes(sl)) {
        const [bg, fg] = CHIP_COLS[ci % CHIP_COLS.length], fs = cfs;
        chip = document.createElement('div');
        chip.className = 'lv-ui';
        chip.style.cssText = `position:absolute;left:${w - 6 * u}px;top:${h * (.34 + r() * .18)}px;display:flex;align-items:center;transform-origin:0 50%;font-family:${ctx.font}`;
        chip.innerHTML = `<i style="display:block;width:${10 * u}px;height:${10 * u}px;border-radius:50%;background:${bg};box-shadow:0 0 0 ${3 * u}px rgba(255,255,255,.9);flex:none"></i><i style="display:block;width:${14 * u}px;height:${2 * u}px;background:${bg};flex:none"></i>
          <span class="lv-txt" style="position:relative;padding:${fs * .3}px ${fs * .62}px;border-radius:99px;background:${bg};color:${fg};font-size:${fs}px;font-weight:600;white-space:nowrap;box-shadow:0 ${4 * u}px ${14 * u}px ${A.hexA(bg, .35)}">${A.esc(chips[ci])}</span>`;
        chip.dataset.at = String(12 + ci * 5);
        card.appendChild(chip);
        ci++;
      }
      groups[sl.tier].appendChild(card);
      return { card, chip, m, sl, T, w, h, ry: (r() < .5 ? -1 : 1) * (10 + r() * 14), rx: (r() - .5) * 14, rz: (r() - .5) * 6, ph: r() * 6, delay: sl.d * 18 + r() * 4 };
    });
    await Promise.all(cards.map(c => c.m.ready()));
    let glow = null, head = null;
    if (s.text) {
      head = ctx.text(s.text, { size: portrait ? 88 : 96, align: 'center', maxW: safe.w * (portrait ? 1 : .62), lines: portrait ? 3 : 2, layer: 'headline' });
      head.style.left = (W / 2 - head.offsetWidth / 2) + 'px'; head.style.top = (H / 2 - head.offsetHeight / 2) + 'px';
      const gw = head.offsetWidth * 1.5, gh = head.offsetHeight * 2.4;
      glow = ctx.el('', `left:${W / 2 - gw / 2}px;top:${H / 2 - gh / 2}px;width:${gw}px;height:${gh}px;border-radius:50%;background:radial-gradient(closest-side,${B.bg} 0%,${A.hexA(B.bg, .92)} 45%,${A.hexA(B.bg, 0)} 100%)`, 'glow');
      ctx.root.appendChild(head);       // headline above the glow (tree order = paint order)
    }
    return {
      async render(t, D) {
        await Promise.all(cards.map(c => c.m.frame(t)));
        const p = K.clamp(t / D);
        for (const c of cards) {
          const { sl, T } = c, e = K.outExpo(K.u01(t, c.delay - 6, c.delay + 14)), a = K.clamp(K.u01(t, c.delay - 6, c.delay + 2));
          const { X, Y, dolly } = at(sl, t, c.ph);
          const sc = dolly * K.lerp(sl.tier === 'near' ? 1.5 : .7, 1, e);
          c.card.style.opacity = (a * T.op).toFixed(3);
          c.card.style.filter = T.blur ? F.blur(T.blur * u * (sl.tier === 'near' ? (.7 + .5 * p) : 1)) : 'none';
          c.card.style.transform = `translate(${(X - sl.cx).toFixed(2)}px,${(Y - sl.cy).toFixed(2)}px) perspective(${1500 * u}px) rotateY(${(c.ry + 3 * Math.sin(t * .02 + c.ph)).toFixed(3)}deg) rotateX(${(c.rx + 2 * Math.cos(t * .018 + c.ph)).toFixed(3)}deg) rotateZ(${c.rz.toFixed(3)}deg) scale(${sc.toFixed(5)})`;
          if (c.chip) {
            const t0 = Number(c.chip.dataset.at), k = K.outBack(K.u01(t, t0, t0 + 10), 1.8);
            c.chip.style.opacity = K.clamp(K.u01(t, t0, t0 + 3)).toFixed(3);
            c.chip.style.transform = t >= t0 + 10 ? 'none' : `scale(${K.clamp(k, 0, 1.15).toFixed(4)})`;     // identity at rest: none (GUIDE trap)
          }
        }
        if (head) { ctx.reveal(head, t, 6, 2.4); head.style.transform = `translateY(${(1.5 * u * Math.sin(t * .07)).toFixed(2)}px)`; }
        if (glow) glow.style.opacity = K.clamp(K.u01(t, 2, 14)).toFixed(3);
      },
    };
  },
};
