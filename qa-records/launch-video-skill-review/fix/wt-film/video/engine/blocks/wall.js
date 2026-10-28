// wall — a floating video wall: tilted phone-ratio cards (images or footage; repeated to fill) at three
// depths on a light background, drifting with parallax (far slow and soft, near fast and out of focus) under a slow
// camera dolly; colourful label chips ride on some cards; an optional centre headline sits on a soft glow.
// Real CSS 3D tilt per card.
import { F } from './_film.js';
import * as K from '../kit.js';

const cardsOf = s => [].concat(s.cards || []).map(String);
const chipsOf = s => [].concat(s.chips || []).map(String);
const CHIP_COLS = [['#FF4FA3', '#fff'], ['#1FC0EE', '#fff'], ['#B5EC3C', '#14210A'], ['#5747F2', '#fff'], ['#FF8A3D', '#fff']];
// a label's width in em, per glyph (Inter's advances, measured in Chrome): CJK, kana, hangul, full-width forms and emoji
// 1 (a system font draws them), M W @ % 1, m w .88, other capitals and digits .74, narrow glyphs and the space .3, the
// rest .6 — and never under `flat` a glyph (the estimate the Latin layouts were tuned on)
const WIDE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303F\uFF01-\uFF60\uFFE0-\uFFE6\p{Extended_Pictographic}MW@%]/u;
const ems = (str, flat) => Math.max(flat * str.length, [...str].reduce((a, ch) => a + (WIDE.test(ch) ? 1 : /[mw]/.test(ch) ? .88 : /[ijltfrI .,:;'!|()[\]]/.test(ch) ? .3 : /[A-Z0-9]/.test(ch) ? .74 : .6), 0));
const TIERS = { far: { k: .6, v: .45, blur: 2.4, op: .82 }, mid: { k: .88, v: .9, blur: 0, op: 1 }, near: { k: 1.22, v: 1.7, blur: 3.2, op: 1 } };
// the engine's ctx.safe for a frame (platform-safe in portrait, inside letterbox bars) — validate runs in Node
const safeOf = (s, W, H) => {
  const m = H > W ? { x0: .12 * W, y0: .12 * H, x1: .88 * W, y1: .78 * H } : { x0: .07 * W, y0: .09 * H, x1: .93 * W, y1: .91 * H }, bar = K.letterboxBar(s.letterbox, W, H);
  if (bar) { m.y0 = Math.max(m.y0, bar + .04 * H); m.y1 = Math.min(m.y1, H - bar - .04 * H); }
  return { ...m, w: m.x1 - m.x0, h: m.y1 - m.y0 };
};
// the wall's layout, pure (validate runs it in Node for every aspect; build draws it): the slots; every card's dice in
// slot order (shape, overlay bars, tilt, wobble, entrance), so editing the chips never re-deals the cards; and the chips
function layout(s, W, H, D, safe) {
  const portrait = H > W, square = W === H, u = Math.min(W, H) / 1080, chips = chipsOf(s), ugc = s.chrome !== 'none', r = F.rng(F.hash('wall:' + s.id));
  const cols = portrait ? 4 : square ? 5 : 7, rows = portrait ? 6 : square ? 4 : 4;
  const RW = W * (portrait ? 1.3 : 1.22), RH = H * (portrait ? 1.36 : 1.5), cellW = RW / cols, cellH = RH / rows;
  const base = H * (portrait ? .235 : square ? .36 : .4);
  const dir = typeof s.drift === 'string' ? s.drift || 'up' : 'up',     // (a map is the shot's drift-cut strengths)
    dvx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0, dvy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
  const slots = [];
  for (let rr = 0; rr < rows; rr++) for (let c = 0; c < cols; c++) {
    const cx = W / 2 - RW / 2 + (c + .5) * cellW + (r() - .5) * cellW * .42 + (rr % 2 ? cellW * .22 : 0), cy = H / 2 - RH * (dvy < 0 ? .36 : .5) + (rr + .5) * cellH + (r() - .5) * cellH * .3;
    const central = s.text && Math.abs(cx - W / 2) < W * (portrait ? .36 : .27) && Math.abs(cy - H / 2) < H * (portrait ? .12 : .2);
    const x = r(), tier = central ? 'far' : x < .28 ? 'far' : x < .78 ? 'mid' : 'near';
    slots.push({ cx, cy, tier, central, d: Math.hypot((cx - W / 2) / W, (cy - H / 2) / H) });
  }
  const cards = slots.map(sl => ({ sl, land: r() < .16, bars: ugc ? [r(), r(), r()] : null, ry: (r() < .5 ? -1 : 1) * (10 + r() * 14), rx: (r() - .5) * 14, rz: (r() - .5) * 6, ph: r() * 6, delay: sl.d * 18 + r() * 4 }));
  // where a slot's card centre is at local frame t (drift + dolly) — shared by the chip choice and render
  const at = (sl, t, ph = 0) => {
    const T = TIERS[sl.tier], dolly = 1 + .085 * K.ioCubic(K.clamp(t / D));
    const dx = dvx * T.v * t * u + 6 * u * Math.sin(t * .03 + ph), dy = dvy * T.v * t * u + 4 * u * Math.cos(t * .027 + ph);
    return { X: W / 2 + (sl.cx + dx - W / 2) * dolly, Y: H / 2 + (sl.cy + dy - H / 2) * dolly, dolly };
  };
  const size = (c, chip) => { const land = c.land && !chip, h = base * TIERS[c.sl.tier].k * (land ? .56 : 1); return { w: land ? h * 1.6 : h * 9 / 16, h }; };
  // the screen box of a box [x0, y0, x1, y1] in a card's own px at local frame t: drift, dolly, entrance scale and the
  // CSS 3D tilt (perspective · rotateY · rotateX · rotateZ · scale about the card's centre, as render writes it)
  const screen = (c, w, h, b, t) => {
    const { X, Y, dolly } = at(c.sl, t, c.ph), sc = dolly * K.lerp(c.sl.tier === 'near' ? 1.5 : .7, 1, K.outExpo(K.u01(t, c.delay - 6, c.delay + 14)));
    const ay = (c.ry + 3 * Math.sin(t * .02 + c.ph)) * Math.PI / 180, ax = (c.rx + 2 * Math.cos(t * .018 + c.ph)) * Math.PI / 180, az = c.rz * Math.PI / 180, P = 1500 * u;
    const o = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [px, py] of [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]]) {
      let x = (px - w / 2) * sc, y = (py - h / 2) * sc, z;
      [x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)];
      [y, z] = [y * Math.cos(ax), y * Math.sin(ax)];
      [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
      const k = P / (P - z);
      o[0] = Math.min(o[0], X + x * k); o[1] = Math.min(o[1], Y + y * k); o[2] = Math.max(o[2], X + x * k); o[3] = Math.max(o[3], Y + y * k);
    }
    return o;
  };
  const hit = (a, b, m) => a[0] < b[2] + m && b[0] < a[2] + m && a[1] < b[3] + m && b[1] < a[3] + m;
  // chips: each label in turn takes the first card — crisp mid-depth ones nearest the centre first, then a far or near
  // one (off the headline), which then moves to the mid depth — where its chip (right of the card, else left of it) is
  // inside the frame from its pop, inside the safe area at the hero frame, and clear of every nearer card, of the
  // headline's glow and of the chips placed before it until ~half a second after the hero frame (chip cards paint above
  // the other mid cards); a label with no such card is left out (validate says so per aspect)
  const heroF = Math.min(D - 8, Math.max(40, 14 + chips.length * 5 + 10)), cfs = (portrait ? 26 : 24) * u, ch = cfs * 1.9, gap = 6 * u, rc = F.rng(F.hash('wall-chips:' + s.id));
  let glow = null;
  if (s.text) {     // the glow: 1.5 × the headline's box (maxW wide) by 2.4 × its lines (estimated a little wide: ≥ .6 em a glyph;
    //                  a word wider than the box — CJK copy has no spaces — wraps by the glyph)
    const maxW = safe.w * (portrait ? 1 : .62), fs = (portrait ? 88 : 96) * u, most = portrait ? 3 : 2;
    let n = 1, x = 0;
    for (const p of K.parseCopy(String(s.text))) {
      if (p.br) { n++; x = 0; continue; }
      for (const wd of p.text.split(/\s+/).filter(Boolean)) {
        const ww = ems(wd, .6) * fs;
        if (ww > maxW) { n += (x ? 1 : 0) + Math.ceil(ww / maxW) - 1; x = ww - (Math.ceil(ww / maxW) - 1) * maxW; } else if (x && x + .25 * fs + ww > maxW) { n++; x = ww; } else x += (x ? .25 * fs : 0) + ww;
      }
    }
    const gw = 1.5 * maxW, gh = 2.4 * Math.min(n, most) * fs * 1.04;
    glow = [W / 2 - gw / 2, H / 2 - gh / 2, W / 2 + gw / 2, H / 2 + gh / 2];
  }
  const placed = [], byD = (a, b) => a.sl.d - b.sl.d;
  const free = [...cards.filter(c => c.sl.tier === 'mid').sort(byD), ...cards.filter(c => c.sl.tier !== 'mid' && !c.sl.central).sort(byD)];
  chips.forEach((label, j) => {
    const pop = 12 + j * 5, top = .34 + rc() * .18, cwid = ems(label, .56) * cfs + cfs * 1.3 + 26 * u;
    const ts = []; for (let t = pop; t < Math.min(D, heroF + 16); t += 4) ts.push(t); ts.push(heroF);
    for (const c of free) for (const tp of [top, .14, .7]) {      // its own height on the card first, then high, then low
      const was = c.sl.tier; c.sl.tier = 'mid';                       // (tried at the mid depth)
      const near = cards.filter(n => n.sl.tier === 'near'), i = cards.indexOf(c), { w, h } = size(c, true), y0 = h * tp;
      const side = ['right', 'left'].find(sd => {
        const b = sd === 'right' ? [w - 6 * u, y0, w - 6 * u + cwid, y0 + ch] : [6 * u - cwid, y0, 6 * u, y0 + ch];
        return ts.every(t => {
          const cb = screen(c, w, h, b, t);
          if (t === heroF ? cb[0] < safe.x0 || cb[2] > safe.x1 || cb[1] < safe.y0 || cb[3] > safe.y1 : t < heroF && (cb[0] < 0 || cb[2] > W || cb[1] < 0 || cb[3] > H)) return false;
          if (glow && hit(cb, glow, gap)) return false;
          if (near.some(n => t >= n.delay - 6 && hit(cb, screen(n, size(n).w, size(n).h, [0, 0, size(n).w, size(n).h], t), gap))) return false;
          const card = screen(c, w, h, [0, 0, w, h], t);
          // (chip cards paint in slot order: the later card covers the earlier one's chip)
          return placed.every(p => t < p.pop || (!hit(cb, p.at(t), gap) && !(p.i > i ? hit(cb, p.cardAt(t), gap) : hit(card, p.at(t), gap))));
        });
      });
      if (!side) { c.sl.tier = was; continue; }
      const b = side === 'right' ? [w - 6 * u, y0, w - 6 * u + cwid, y0 + ch] : [6 * u - cwid, y0, 6 * u, y0 + ch];
      placed.push({ c, i, j, label, side, top: tp, pop, at: t => screen(c, w, h, b, t), cardAt: t => screen(c, w, h, [0, 0, w, h], t) });
      free.splice(free.indexOf(c), 1);
      return;
    }
  });
  return { cards, at, size, cfs, chips: placed };
}

export default {
  name: 'wall',
  doc: 'A floating video wall: tilted phone-ratio cards at three depths drifting with parallax under a slow camera dolly, colourful label chips on some cards, an optional centre headline on a soft glow.',
  layers: 'far · mid · near · glow · headline',
  // card footage is extracted at half size (the plate's longer side = .5 × the frame's): the biggest card is ~half the height
  media: [{ field: 'cards', fit: 'contain', scale: .5 }],
  copy: s => [s.text, ...chipsOf(s)].filter(x => x != null && String(x).trim() !== '').map(String),
  read: s => [s.text].filter(x => x != null && String(x).trim() !== '').map(String),
  params: { cards: 'list of images or footage (cardsFrom: seconds into each), repeated to fill the wall', chips: 'labels for the chips, e.g. [Hook in 1s, Product close-up] (colours cycle; a label that can\'t ride clear of the other cards in an aspect is left out there — --grid says so)', text: 'optional centre headline (*accent* ok)', chrome: 'ugc (default: a faint social-video overlay on each card) | none', drift: 'up (default) | down | left | right' },
  required: ['cards'],
  // the chips that fit, per aspect of the job (the layout is pure arithmetic)
  validate(s, D, o = {}) {
    const n = chipsOf(s).length, w = [];
    if (n) for (const [a, { W, H }] of Object.entries(o.aspects || {})) {
      const L = layout(s, W, H, D, safeOf(s, W, H));
      if (L.chips.length < n) w.push(`wall ${s.id}: only ${L.chips.length} of ${n} chips fit in ${a} (left out: ${chipsOf(s).filter((_, j) => !L.chips.some(c => c.j === j)).join(', ')}) — use fewer or shorter labels`);
    }
    return w;
  },
  cues: s => [{ t: 0, kind: 'hit', note: 84, gain: .5 }, ...chipsOf(s).slice(0, 6).map((_, j) => ({ t: 12 + j * 5, kind: 'pop', note: [81, 84, 86, 88, 91, 93][j], gain: .55 }))],
  hero: (s, D) => Math.min(D - 8, Math.max(40, 14 + chipsOf(s).length * 5 + 10)),
  async build(ctx, s) {
    const { W, H, u, A, safe, portrait } = ctx, B = ctx.brand.colors;
    const srcs = cardsOf(s), ugc = s.chrome !== 'none', L = layout(s, W, H, ctx.D, safe), at = L.at;
    const groups = Object.fromEntries(Object.keys(TIERS).map(k => [k, ctx.el('', `left:0;top:0;width:${W}px;height:${H}px;isolation:isolate`, k)]));
    // a card shows clip (i·STR + 3) mod n: a stride with no common factor with n, so every clip appears (7, unless 7 divides n)
    const NS = srcs.length, STR = [7, 5, 11, 13, 3, 1].find(q => q === 1 || NS % q !== 0);
    const cards = L.cards.map((c, i) => {
      const { sl } = c, T = TIERS[sl.tier], chipOn = L.chips.find(p => p.c === c), { w, h } = L.size(c, !!chipOn);
      const src = srcs[(i * STR + 3) % NS], field = `cards.${(i * STR + 3) % NS}`;
      const card = document.createElement('div');
      card.style.cssText = `position:absolute;left:${sl.cx - w / 2}px;top:${sl.cy - h / 2}px;width:${w}px;height:${h}px${chipOn ? ';z-index:1' : ''}`;     // a chip's card paints above the other mid cards
      const box = document.createElement('div');
      box.style.cssText = `position:absolute;inset:0;border-radius:${Math.min(w, h) * .09}px;overflow:hidden;background:#D8DAE2;box-shadow:0 ${h * .05}px ${h * .14}px rgba(20,24,40,.18)`;
      const m = F.media(ctx, s, field, src);
      box.appendChild(m.img);
      if (ugc) {
        const g = document.createElement('div'), [b1, b2, b3] = c.bars;
        g.style.cssText = `position:absolute;left:0;right:0;bottom:0;height:42%;background:linear-gradient(0deg,rgba(0,0,0,.5),rgba(0,0,0,0))`;
        const f = h / 400;
        g.innerHTML = `<div style="position:absolute;left:${14 * f * 1.6}px;bottom:${46 * f * 1.6}px;width:${16 * f * 1.6}px;height:${16 * f * 1.6}px;border-radius:50%;background:#fff;opacity:.9"></div>
          <div style="position:absolute;left:${36 * f * 1.6}px;bottom:${50 * f * 1.6}px;width:${(60 + b1 * 50) * f}px;height:${7 * f * 1.6}px;border-radius:9px;background:rgba(255,255,255,.85)"></div>
          <div style="position:absolute;left:${14 * f * 1.6}px;bottom:${26 * f * 1.6}px;width:${(110 + b2 * 60) * f}px;height:${6 * f * 1.6}px;border-radius:9px;background:rgba(255,255,255,.55)"></div>
          <div style="position:absolute;left:${14 * f * 1.6}px;bottom:${12 * f * 1.6}px;width:${(70 + b3 * 50) * f}px;height:${6 * f * 1.6}px;border-radius:9px;background:rgba(255,255,255,.4)"></div>
          ${[0, 1, 2].map(j => `<div style="position:absolute;right:${12 * f * 1.6}px;bottom:${(60 + j * 30) * f * 1.6}px;width:${14 * f * 1.6}px;height:${14 * f * 1.6}px;border-radius:50%;box-shadow:inset 0 0 0 ${2 * f * 1.6}px rgba(255,255,255,.8)"></div>`).join('')}`;
        box.appendChild(g);
      }
      card.appendChild(box);
      let chip = null;
      if (chipOn) {     // right of the card (dot · line · label) or, where that side runs out, left of it (label · line · dot)
        const [bg, fg] = CHIP_COLS[chipOn.j % CHIP_COLS.length], fs = L.cfs, right = chipOn.side === 'right';
        const dot = `<i style="display:block;width:${10 * u}px;height:${10 * u}px;border-radius:50%;background:${bg};box-shadow:0 0 0 ${3 * u}px rgba(255,255,255,.9);flex:none"></i>`, line = `<i style="display:block;width:${14 * u}px;height:${2 * u}px;background:${bg};flex:none"></i>`;
        const label = `<span class="lv-txt" style="position:relative;padding:${fs * .3}px ${fs * .62}px;border-radius:99px;background:${bg};color:${fg};font-size:${fs}px;font-weight:600;white-space:nowrap;box-shadow:0 ${4 * u}px ${14 * u}px ${A.hexA(bg, .35)}">${A.esc(chipOn.label)}</span>`;
        chip = document.createElement('div');
        chip.className = 'lv-ui';
        chip.style.cssText = `position:absolute;${right ? 'left' : 'right'}:${w - 6 * u}px;top:${h * chipOn.top}px;display:flex;align-items:center;transform-origin:${right ? 0 : 100}% 50%;font-family:${ctx.font}`;
        chip.innerHTML = right ? `${dot}${line}\n          ${label}` : `${label}${line}${dot}`;
        chip.dataset.at = String(chipOn.pop);
        card.appendChild(chip);
      }
      groups[sl.tier].appendChild(card);
      return { card, chip, m, sl, T, w, h, ry: c.ry, rx: c.rx, rz: c.rz, ph: c.ph, delay: c.delay };
    });
    await Promise.all(cards.map(c => c.m.ready()));
    let glow = null, head = null;
    if (s.text) {
      // the wall's own light glow behind the headline, so its ink stays the brand's dark ink (over bg or theme: dark too)
      head = ctx.text(s.text, { size: portrait ? 88 : 96, align: 'center', maxW: safe.w * (portrait ? 1 : .62), lines: portrait ? 3 : 2, color: B.ink, accent: B.accent, layer: 'headline' });
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
