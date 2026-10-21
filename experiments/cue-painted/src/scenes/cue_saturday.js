// cue_saturday.js: "Saturday", a Cue short. See STORYBOARD.md for the reads and timing.
(() => {
  // ---------- palettes ----------
  const N = { wall: '#2C3363', wall2: '#3D4886', sky: '#191E48', wood: '#946649', woodLt: '#B98B62', woodDk: '#5E3F2E', frame: '#B7A487', lamp: '#E8AA38' };
  const R = { wall: '#E09A58', wall2: '#F0BC7C', sky1: '#F2A38F', sky2: '#7A67A6', cloth: '#F4E7D2', clothDk: '#D9C3A3', frame: '#F3E3C8' };
  const JUN = { shirt: '#7E9670', hair: '#2E2430', skin: '#F0C6A2', style: 'bob' };
  const FRIEND = { shirt: '#D86F86', hair: '#7A4A2E', skin: '#C98E64', style: 'curly' };
  const DESK_Y = 700, JX = 960, JY = 716, JU = 26, PHONE = [800, 748], JAR = [1580, 762], CANDLE_SET = [880, 792];
  const S = (t, a, b) => seg(t, a, b);

  // ---------- people ----------
  // person(x, y, u, o): seated, seen from the waist up; (x, y) = bottom centre of the torso (hidden behind a table).
  // o.layer 'body' draws torso + head, 'arms' draws the arms (so a table can go between). Hands are in local u.
  function person(x, y, u, o = {}) {
    const P = o.who || JUN, key = o.key || 'p', rs = s => boilSeed(`${key} ${s}`), J = u * .05, sw = clamp(u / 15, .5, 2.2);
    const line = mixCol(PAL.ink, P.shirt, .15), sq = o.sq || 0;
    push(); translate(x + (o.dx || 0) * u, y + (o.dy || 0) * u); rotate(o.lean || 0); scale(1 + sq * .4, 1 - sq);
    if (o.layer !== 'arms') {
      rs('torso');
      const torso = roundPoly([[-5.2 * u, 0], [5.2 * u, 0], [4.8 * u, -7.4 * u], [3.2 * u, -9.1 * u], [-3.2 * u, -9.1 * u], [-4.8 * u, -7.4 * u]], 1.3 * u, 5).map(([a, b]) => [a + jit(J), b + jit(J)]);
      paint(torso, { wash: P.shirt, ink: null });
      paint(clipY(torso, -3.6 * u), { fill: mixCol(P.shirt, PAL.ink, .35), fillOp: 100, bleed: .05, tex: .6, border: .5, ink: null });
      paint(torso, { ink: line, sw });
      rs('neck'); paint(rectPts(-1 * u, -10.5 * u, 2 * u, 1.7 * u, J), { wash: mixCol(P.skin, PAL.ink, .15), ink: null });
      push(); translate(0, -10 * u); rotate(o.tilt || 0); translate(0, 10 * u);
      rs('hairback'); hair(P, u, J, line, sw, 'back');
      rs('head'); const head = ellPts(0, -13.3 * u, 3.3 * u, 3.7 * u, 30, J);
      paint(head, { wash: P.skin, ink: null });
      paint(ellPts(-.9 * u, -14.4 * u, 1.6 * u, 1.3 * u, 16), { fill: mixCol(P.skin, '#FFFFFF', .45), fillOp: 90, bleed: .2, tex: .6, ink: null });
      paint(head, { ink: line, sw: sw * .9 });
      rs('face'); face(u, sw, o.face || {}, o.seed || 0);
      rs('hair'); hair(P, u, J, line, sw, 'front');
      pop();
    }
    if (o.layer !== 'body') for (const s of [-1, 1]) {
      rs('arm' + s);
      const h = (s < 0 ? o.hL : o.hR) || [s * 3.4, -.4], Sh = [s * 4.1 * u, -8.3 * u], Hd = [h[0] * u, h[1] * u];
      const El = [lerp(Sh[0], Hd[0], .5) + s * 1.5 * u, lerp(Sh[1], Hd[1], .5) + 1.3 * u];
      paint(ribbon([Sh, El, Hd], 2.1 * u, 1.6 * u), { wash: P.shirt, ink: line, sw: sw * .8 });
      const hold = s < 0 ? o.holdL : o.holdR;
      if (hold) { push(); translate(Hd[0], Hd[1]); hold(u, sw); pop(); }
      rs('hand' + s); paint(ellPts(Hd[0], Hd[1], 1 * u, .9 * u, 14, J), { wash: P.skin, ink: line, sw: sw * .7 });
    }
    pop();
  }
  function hair(P, u, J, line, sw, layer) {
    const H = P.hair;
    if (P.style === 'bob') {
      if (layer === 'back') paint(rrPts(-4.1 * u, -17.5 * u, 8.2 * u, 7.1 * u, 3 * u, J), { wash: H, ink: line, sw: sw * .8 });
      else paint(loopSmooth([[-3.7, -12.4], [-3.5, -15.6], [-2.1, -17.3], [.5, -17.5], [2.7, -16.7], [3.7, -14.8], [3.8, -12.4], [3, -13.9], [1.7, -15.1], [-.4, -15.3], [-2.3, -14.5]].map(([a, b]) => [a * u + jit(J), b * u + jit(J)]), 5), { wash: H, fill: mixCol(H, '#FFFFFF', .2), fillOp: 60, bleed: .1, tex: .5, ink: line, sw: sw * .8 });
    } else {
      const ring = layer === 'back' ? [...Array(11).keys()].map(i => Math.PI * (.95 + i * .11)) : [...Array(7).keys()].map(i => Math.PI * (1.18 + i * .107));
      const rr = layer === 'back' ? 3.9 : 3.3, r0 = layer === 'back' ? 1.6 : 1.15;
      ring.forEach((a, i) => paint(ellPts(Math.cos(a) * rr * u, -13.6 * u + Math.sin(a) * rr * 1.05 * u, r0 * u, r0 * u, 14, J), { wash: H, ink: line, sw: sw * .6 }));
    }
  }
  function face(u, sw, f, seed) {
    const lx = (f.lookX || 0) * .55 * u, ly = (f.lookY || 0) * .35 * u, ey = -13.1 * u, br = f.brow || 0;
    if (f.blush) for (const s of [-1, 1]) paint(ellPts(s * 2.1 * u + lx * .4, -11.9 * u, .8 * u, .4 * u, 12), { fill: PAL.rose, fillOp: 170 * f.blush, bleed: .2, ink: null });
    const blink = ((T * .8 + seed) % 3.7) < .11;
    for (const s of [-1, 1]) {
      let e = f.eyes || 'dot'; if (blink && (e === 'dot' || e === 'wide')) e = 'closed';
      push(); translate(s * 1.3 * u + lx, ey + ly);
      if (e === 'dot') paint(ellPts(0, 0, .36 * u, .46 * u, 10), { wash: PAL.ink, ink: null });
      else if (e === 'wide') { paint(ellPts(0, 0, .66 * u, .76 * u, 14), { wash: CUE_WHITE, ink: PAL.ink, sw: sw * .5 }); paint(ellPts(0, .05 * u, .3 * u, .36 * u, 10), { wash: PAL.ink, ink: null }); }
      else if (e === 'closed') inkLine([[-.5 * u, 0], [0, .3 * u], [.5 * u, 0]], sw, PAL.ink, 'ink', .5);
      else if (e === 'happy') inkLine([[-.5 * u, .2 * u], [0, -.25 * u], [.5 * u, .2 * u]], sw, PAL.ink, 'ink', .5);
      else if (e === 'tired') { paint(ellPts(0, .15 * u, .34 * u, .28 * u, 10), { wash: PAL.ink, ink: null }); inkLine([[-.6 * u, -.08 * u], [.6 * u, -.02 * u]], sw, PAL.ink, 'ink', 0); }
      pop();
      inkLine([[s * .55 * u + lx * .4, (-14.6 + br * .35) * u], [s * 1.9 * u + lx * .4, -14.75 * u]], sw * .9, PAL.ink, 'ink', 0);
    }
    const m = f.mouth || 'flat', my = -11.4 * u, P = pts => pts.map(([a, b]) => [a * u + lx * .3, my + b * u]);
    if (m === 'flat') inkLine(P([[-.6, 0], [.6, 0]]), sw * .8, PAL.ink, 'ink', 0);
    else if (m === 'smile') inkLine(P([[-.85, -.15], [0, .3], [.85, -.15]]), sw * .8, PAL.ink, 'ink', .6);
    else if (m === 'frown') inkLine(P([[-.75, .2], [0, -.15], [.75, .2]]), sw * .8, PAL.ink, 'ink', .6);
    else if (m === 'o') paint(ellPts(lx * .3, my + .1 * u, .34 * u, .42 * u, 12), { wash: '#4A1F2A', ink: PAL.ink, sw: sw * .5 });
    else if (m === 'grin') { paint(P([[-1.1, -.2], [1.1, -.2], [.7, .55], [-.7, .55]]), { wash: '#4A1F2A', ink: PAL.ink, sw: sw * .6, curv: .4 }); paint(ellPts(lx * .3, my + .35 * u, .45 * u, .16 * u, 10), { wash: PAL.rose, ink: null }); }
  }

  // ---------- props ----------
  function phone(x, y, lit = 0, buzz = 0) {
    const sh = buzz ? Math.sin(T * 80) * 3 * buzz : 0;
    boilSeed('phone'); push(); translate(x + sh, y); scale(1.35);
    paint(rrPts(-34, -118, 68, 118, 12), { wash: '#2B2233', ink: PAL.ink, sw: 1 });
    paint(rrPts(-28, -110, 56, 100, 8), { wash: mixCol('#3A4675', '#BFE4F7', lit), ink: null });
    if (lit > .01) glow(0, -60, 200, '#9ED3F0', lit * .9);
    pop();
    if (buzz > .05) for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
      boilSeed('buzz' + s + i); const r = 70 + i * 22, a0 = s < 0 ? Math.PI * .8 : -Math.PI * .2;
      inkLine([0, 1, 2].map(k => [x + Math.cos(a0 + k * .2 * s) * r, y - 81 + Math.sin(a0 + k * .2 * s) * r]), 1.3 * buzz, PAL.cream, 'ink', .5);
    }
  }
  function candle(x, y, lit = 0, s = 1) {
    boilSeed('candle'); push(); translate(x, y); scale(s);
    const body = rrPts(-9, -64, 18, 64, 4);
    paint(body, { wash: PAL.cream, ink: null });
    for (let i = 0; i < 4; i++) paint([[-9, -10 - i * 15], [9, -18 - i * 15], [9, -12 - i * 15], [-9, -4 - i * 15]], { wash: PAL.rose, ink: null });
    paint(body, { ink: PAL.ink, sw: .8 });
    inkLine([[0, -64], [1.5, -73]], .8, PAL.ink, 'inkfine', 0);
    if (lit > .01) {
      const f = lit * (1 + .08 * Math.sin(T * 23) + .05 * Math.sin(T * 37)), fl = pts => pts.map(([a, b]) => [a * f, -74 + (b + 74) * f]);
      glow(0, -86, 150 * lit, '#FFC766', lit);
      paint(fl([[0, -104], [8, -86], [6, -77], [0, -74], [-6, -77], [-8, -86]]), { wash: PAL.ochre, ink: null, curv: .6 });
      paint(fl([[0, -94], [4, -84], [0, -77], [-4, -84]]), { wash: '#FFF0C2', ink: null, curv: .6 });
    }
    pop();
  }
  function jar(x, y, level) {
    boilSeed('jar'); push(); translate(x, y);
    const h = lerp(14, 72, clamp(level));
    paint(rrPts(-42, -h, 84, h - 6, 6), { wash: PAL.ochre, fill: '#C98A1E', fillOp: 90, bleed: .05, tex: .6, ink: null });
    for (let i = 0; i < 5; i++) paint(ellPts(-30 + i * 15, -h + 2, 9, 4, 10), { wash: '#F5CF63', ink: PAL.ink, sw: .4 });
    const glass = rrPts(-48, -120, 96, 120, 16);
    paint(glass, { fill: PAL.sky, fillOp: 55, bleed: .05, tex: .3, ink: PAL.ink, sw: 1.1 });
    paint(rectPts(-40, -134, 80, 16), { wash: N.frame, ink: PAL.ink, sw: .8 });
    const full = level >= .999 ? .5 + .5 * Math.sin(T * 12) : 0;
    inkLine([[-46, -72], [-15, -73], [15, -71], [46, -72]], 2.2 + full, level >= .999 ? '#FF6F7F' : PAL.rose, 'ink', .3);
    inkLine([[-30, -108], [-34, -60]], .8, CUE_WHITE, 'inkfine', .3);
    pop();
  }
  function coin(x, y, r = 9) { paint(ellPts(x, y, r, r * .9, 12), { wash: '#F5C84A', ink: PAL.ink, sw: .6 }); paint(ellPts(x, y, r * .55, r * .5, 10), { fill: PAL.ochre, fillOp: 160, bleed: .05, ink: null }); }
  function plane(x, y, ang, s) {
    push(); translate(x, y); rotate(ang); scale(s);
    paint([[22, 0], [-16, -11], [-9, 0], [-16, 11]], { wash: CUE_WHITE, ink: mixCol(PAL.ink, PAL.sky, .3), sw: .55 });
    inkLine([[22, 0], [-9, 0]], .6, PAL.ink, 'inkfine', 0);
    pop();
  }
  function card(x, y, w, kind, k = 1, lit = 0, rot = 0) {
    if (k <= .01) return;
    const h = w * .78;
    boilSeed('card' + kind); push(); translate(x, y); rotate(rot); scale(k);
    if (lit > .01) glow(0, 0, w * 1.1, '#FFE6A0', lit);
    paint(rrPts(-w / 2, -h / 2, w, h, w * .08), { wash: PAL.cream, ink: PAL.ink, sw: 1.1 });
    const s = w / 160;
    push(); translate(0, -h * .1); scale(s);
    if (kind === 'bowl') {
      for (let i = 0; i < 3; i++) inkLine([[-22 + i * 20, -30], [-28 + i * 20, -44 + Math.sin(T * 4 + i) * 3], [-20 + i * 20, -58]], 1.2, PAL.ink, 'inkfine', .6);
      paint([[-44, -16], [44, -16], [30, 12], [0, 20], [-30, 12]], { wash: PAL.rose, ink: PAL.ink, sw: 1, curv: .5 });
      for (let i = 0; i < 4; i++) inkLine([[-30 + i * 18, -16], [-24 + i * 16, -24]], 1.6, PAL.ochre, 'ink', .4);
    } else if (kind === 'pizza') {
      paint([[0, 22], [-38, -28], [38, -28]], { wash: PAL.ochre, ink: PAL.ink, sw: 1 });
      paint([[-40, -36], [40, -36], [38, -26], [-38, -26]], { wash: '#C98A4E', ink: PAL.ink, sw: .8 });
      for (const [a, b] of [[-12, -14], [10, -6], [-2, 8]]) paint(ellPts(a, b, 6, 6, 10), { wash: '#D8394E', ink: null });
    } else if (kind === 'sushi') {
      for (const s2 of [-1, 1]) { paint(rrPts(s2 * 26 - 22, -10, 44, 26, 10), { wash: CUE_WHITE, ink: PAL.ink, sw: .9 }); paint(rrPts(s2 * 26 - 24, -22, 48, 16, 8), { wash: '#F08A6A', ink: PAL.ink, sw: .9 }); paint(rectPts(s2 * 26 - 5, -22, 10, 42), { wash: '#2E3A2E', ink: null }); }
    } else if (kind === 'summary') {
      inkLine([[-46, -6], [-36, 6], [-18, -18]], 3, PAL.sap, 'ink', 0);
      paint(ellPts(10, -6, 16, 16, 16), { wash: CUE_WHITE, ink: PAL.ink, sw: 1 }); inkLine([[10, -6], [10, -16], [10, -6], [18, -2]], 1.2, PAL.ink, 'inkfine', 0);
      paint(rrPts(34, -6, 22, 14, 3), { wash: PAL.rose, ink: PAL.ink, sw: .8 }); inkLine([[45, -6], [45, -14]], 1, PAL.ochre, 'ink', 0);
    }
    pop();
    if (kind !== 'summary') for (let i = 0; i < 3; i++) paint(starPts((i - 1) * w * .14, h * .3, w * .055, .45, 5), { wash: i < (kind === 'bowl' ? 3 : 2) ? PAL.ochre : '#D9CDB4', ink: PAL.ink, sw: .6 });
    pop();
  }
  function ball(x, y, r) {
    if (r < 1) return;
    glow(x, y, r * 4, '#FFD27A', 1);
    boilSeed('ball'); paint(ellPts(x, y, r, r, 18), { wash: '#FFF0C2', fill: PAL.ochre, fillOp: 90, bleed: .15, tex: .5, ink: PAL.ink, sw: .7 });
  }
  // agent props, drawn on the head top (cue o.carry), popping in with k
  const envelope = k => (u, sw) => { if (k <= .01) return; push(); translate(0, -1.6 * u); scale(backOut(k)); paint(rectPts(-2.3 * u, -1.5 * u, 4.6 * u, 3 * u, .04 * u), { wash: PAL.cream, ink: PAL.ink, sw: sw * .7 }); inkLine([[-2.2 * u, -1.4 * u], [0, .25 * u], [2.2 * u, -1.4 * u]], sw * .6, PAL.ink, 'inkfine', 0); paint(ellPts(0, .15 * u, .42 * u, .42 * u, 10), { wash: '#D8394E', ink: null }); pop(); };
  const handset = (k, ring = 0, side = 0) => (u, sw) => {
    if (k <= .01) return;
    push(); translate(side * 3.6 * u + ring * Math.sin(T * 70) * .25 * u, (-2.4 + side * 3.4) * u); rotate(side * .55 + ring * .12 * Math.sin(T * 55)); scale(backOut(k));
    paint(rrPts(-1.1 * u, -2.1 * u, 2.2 * u, 4.2 * u, .45 * u), { wash: '#2B2233', ink: PAL.ink, sw: sw * .6 });
    paint(rrPts(-.8 * u, -1.75 * u, 1.6 * u, 3.1 * u, .3 * u), { wash: ring > .05 || side > .05 ? '#BFE4F7' : '#3A4675', ink: null });
    pop();
    if (ring > .05) for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { const r = (2.4 + i * .9) * u; inkLine([0, 1, 2].map(j => [Math.cos((s < 0 ? Math.PI * .85 : -Math.PI * .15) + j * .22 * s) * r, -2.4 * u + Math.sin((s < 0 ? Math.PI * .85 : -Math.PI * .15) + j * .22 * s) * r]), sw * .9 * ring, PAL.cream, 'ink', .5); }
  };
  const purse = (k, coinUp = 0) => (u, sw) => {
    if (k <= .01) return;
    if (coinUp > .01) { const c = backOut(coinUp); coin(Math.sin(T * 6) * .3 * u, (-3.9 - 1.6 * c) * u, .95 * u * c); }
    push(); translate(0, -.2 * u); scale(backOut(k));
    paint(loopSmooth([[-2.2, -.1], [2.2, -.1], [2.6, -1.6], [1.6, -2.9], [-1.6, -2.9], [-2.6, -1.6]].map(([a, b]) => [a * u, b * u]), 5), { wash: '#E8B04A', fill: '#C98A1E', fillOp: 80, bleed: .1, tex: .6, ink: PAL.ink, sw: sw * .7 });
    for (const s of [-1, 1]) paint(ellPts(s * .45 * u, -3.1 * u, .38 * u, .38 * u, 10), { wash: '#C9B79A', ink: PAL.ink, sw: sw * .5 });
    pop();
  };
  const land = (t, t0) => t < t0 ? 0 : .26 * Math.exp(-8 * (t - t0)) * Math.cos(20 * (t - t0));
  const agent = (name, x, y, u, o) => cue(x, y, u, { boilKey: name, ...o });

  // ---------- sets ----------
  function nightRoom(t, s) {
    boilSeed('wall'); paint(rectPts(-400, -400, W + 800, H + 800), { wash: N.wall, ink: null });
    for (let i = 0; i < 6; i++) { boilSeed('wallf' + i); paint(ellPts(160 + i * 330, 240 + 200 * hash(i), 300, 220, 22), { fill: N.wall2, fillOp: 60, bleed: .3, tex: .5, ink: null }); }
    // window
    boilSeed('window'); paint(rectPts(110, 120, 460, 450), { wash: N.frame, ink: PAL.ink, sw: 1.2 });
    paint(rectPts(132, 142, 416, 404), { wash: N.sky, fill: N.wall2, fillOp: 50, bleed: .2, tex: .4, ink: null });
    glow(470, 230, 110, '#FFF0C2', .7); paint(ellPts(470, 230, 34, 34, 20), { wash: '#FFF0C2', ink: PAL.ink, sw: .6 });
    for (let i = 0; i < 16; i++) { const sx = 150 + hash(i * 3.1) * 380, sy = 160 + hash(i * 7.7) * 370, tw = .6 + .4 * Math.sin(T * 3 + i); if (Math.hypot(sx - 470, sy - 230) < 60) continue; paint(starPts(sx, sy, 5 * tw, .4, 4), { wash: PAL.cream, ink: null }); }
    boilSeed('panes'); paint(rectPts(334, 142, 12, 404), { wash: N.frame, ink: PAL.ink, sw: .6 }); paint(rectPts(132, 338, 416, 12), { wash: N.frame, ink: PAL.ink, sw: .6 });
    paint(rectPts(92, 562, 496, 20), { wash: N.frame, ink: PAL.ink, sw: .9 });
    glow(1700, 560, 520 * (s.lamp ?? 1), '#FFC766', .85);
  }
  function desk() {
    boilSeed('desk');
    paint([[-400, DESK_Y], [W + 400, DESK_Y], [W + 400, 842], [-400, 842]], { wash: N.wood, fill: N.woodLt, fillOp: 70, bleed: .15, tex: .7, ink: null });
    for (let i = 0; i < 5; i++) { boilSeed('grain' + i); const gy = DESK_Y + 20 + i * 24; for (let k = 0; k < 2; k++) inkLine([[k * 1000 - 100, gy + 3 * hash(i + k)], [k * 1000 + 400, gy + 4], [k * 1000 + 950, gy + 2]], .5, N.woodDk, 'inkfine', .5); }
    paint([[-400, 842], [W + 400, 842], [W + 400, H + 600], [-400, H + 600]], { wash: N.woodDk, ink: null });
    for (let k = 0; k < 3; k++) { inkLine([[k * 900 - 200, DESK_Y], [k * 900 + 750, DESK_Y + 1]], 1, PAL.ink, 'ink', 0); inkLine([[k * 900 - 200, 842], [k * 900 + 750, 843]], 1.2, PAL.ink, 'ink', 0); }
  }
  function papers() {
    for (let i = 0; i < 12; i++) { boilSeed('paper' + i); const dx = (hash(i) - .5) * 26, r = (hash(i + 9) - .5) * .06; push(); translate(1290 + dx, 768 - i * 21); rotate(r); paint(rectPts(-90, -22, 180, 22, 1), { wash: i % 3 ? PAL.cream : '#EFE3C8', ink: PAL.ink, sw: .8 }); pop(); }
    boilSeed('paperTop'); push(); translate(1262, 500); rotate(-.18); paint(rectPts(-70, -40, 140, 40, 1), { wash: PAL.cream, ink: PAL.ink, sw: .8 }); pop();
  }
  function lamp() {
    boilSeed('lamp');
    paint(ellPts(1820, 762, 70, 16, 18), { wash: '#3B3550', ink: PAL.ink, sw: .9 });
    inkLine([[1820, 756], [1800, 640], [1760, 530]], 5, '#3B3550', 'ink', .5);
    paint([[1630, 526], [1770, 526], [1742, 446], [1658, 446]], { wash: N.lamp, fill: '#FFE08A', fillOp: 90, bleed: .1, ink: PAL.ink, sw: 1 });
  }
  // the whole night desk, with Jun; o.jun = person options; o.under(t) draws between Jun's body and arms (desk props)
  function nightSet(t, o) {
    nightRoom(t, o);
    person(JX, JY, JU, { key: 'jun', who: JUN, layer: 'body', ...o.jun });
    desk(); papers(); lamp(); jar(...JAR, o.jar ?? .2);
    phone(...PHONE, o.lit || 0, o.buzz || 0);
    if (o.under) o.under(t);
    person(JX, JY, JU, { key: 'jun', who: JUN, layer: 'arms', ...o.jun });
  }
  const local = (wx, wy) => [(wx - JX) / JU, (wy - JY) / JU];
  const heldCandle = (u, sw) => { push(); scale(26 / u); candle(0, 10, 0, 1); pop(); };

  function whip(k, cols) {
    if (k <= .02) return;
    for (let i = 0; i < 10; i++) { boilSeed('whip' + i); const y = 40 + i * 110 + 50 * hash(i), len = 1500 * k, x0 = (hash(i + 3) - .2) * 700; inkLine([[x0, y], [x0 + len * .5, y + jit(6)], [x0 + len, y]], 30 * k, cols[i % cols.length], 'dry', .3); }
  }

  // ---------- A: the night desk ----------
  function shotA(t, lt, dur) {
    camBegin(lerp(960, 1010, ease(S(t, 0, 4.6))), 470, 1.12 + .05 * ease(S(t, 0, 4.6)));
    const reach = S(t, 1.6, 2.0), lift = S(t, 2.15, 2.7), toPhone = S(t, 4.1, 4.6);
    let hR = [3.4, -.4];
    if (t >= 1.6) hR = t < 2.15 ? kf(t, [[1.6, [3.4, -.4]], [2.0, local(1132, 744)]], ease) : kf(t, [[2.15, local(1132, 744)], [2.7, [3.7, -8.6]]], ease);
    const hL = kf(t, [[4.1, [-3.4, -.4]], [4.6, [-5.6, -1.6]]], easeIn);
    const sigh = S(t, 3.4, 4.1), sighSq = .07 * Math.sin(sigh * Math.PI) - .04 * Math.sin(sigh * Math.PI * .5) + .05;
    const look = t < 1.6 ? { lookX: t > .6 && t < 1.2 ? -.9 : .7, lookY: .3 } : t < 3.4 ? { lookX: .8, lookY: -.3 } : t < 4.1 ? {} : { lookX: -1, lookY: .4 };
    const faceA = t < 2.7 ? { eyes: 'tired', mouth: 'frown', brow: -1, ...look } : t < 3.4 ? { eyes: 'dot', mouth: 'flat', brow: -.6, ...look } : t < 4.1 ? { eyes: 'closed', mouth: 'o', brow: -.8 } : { eyes: 'dot', mouth: 'flat', brow: 0, ...look };
    nightSet(t, {
      buzz: t > .3 && t < 1.7 ? 1 : 0, jar: .2,
      jun: { face: faceA, tilt: t < 2.7 ? .06 : t < 3.4 ? .1 : -.03, sq: t < 3.4 ? .05 : sighSq, hL, hR, holdR: t >= 2.15 ? heldCandle : null, seed: 1 },
      under: () => { if (t < 2.15) candle(1130, 752, 0, 1); },
    });
    camEnd();
    flash(1 - ease(S(t, 0, .6)), PAL.paper);
  }

  // ---------- B: the tap; the agents arrive ----------
  const SPOT = { tri: [360, 794], star: [510, 800], heart: [660, 794] }, OUT = [800, 667], POP = { tri: 5.0, star: 5.3, heart: 5.6 };
  function popAgent(name, t, keys, carry) {
    const t0 = POP[name]; if (t < t0) return;
    const k = S(t, t0, t0 + .45), [x, y] = arcPt(OUT, SPOT[name], 130, easeOut(k));
    agent(name, x, y, lerp(3, 14, easeOut(k)), { ...cueEmotions(t, name, keys), sq: land(t, t0 + .45), carry });
  }
  function shotB(t, lt, dur) {
    const wk = easeIn(S(t, 8.32, 8.6));
    camBegin(lerp(650, 630, S(t, 4.6, 8.3)) + wk * 900, 650, 1.75);
    const tap = S(t, 4.6, 4.85), lit = t < 4.85 ? 0 : .7 * S(t, 4.85, 5.0);
    const hL = t < 7.3 ? kf(t, [[4.6, [-5.6, -1.6]], [4.85, local(802, 682)]], easeOut) : kf(t, [[7.3, local(802, 682)], [7.8, [-3.4, -.4]]], ease);
    const hR = kf(t, [[7.3, [3.7, -8.6]], [7.95, local(CANDLE_SET[0] + 2, CANDLE_SET[1] - 6)], [8.15, local(CANDLE_SET[0] + 2, CANDLE_SET[1] - 6)], [8.5, [3.4, -.4]]], ease);
    const putDown = t >= 8.05;
    const look = t >= 7.9 ? { lookX: 1, lookY: .2 } : {};
    const keysTri = [[0, 'surprised'], [5.45, 'excited'], [6.5, 'happy', look], [8.1, 'determined', { lookX: 1 }]];
    const keysStar = [[0, 'surprised'], [5.75, 'excited'], [6.9, 'happy', look], [8.15, 'determined', { lookX: 1 }]];
    const keysHeart = [[0, 'surprised'], [6.05, 'excited'], [7.35, 'happy', look], [8.2, 'determined', { lookX: 1 }]];
    nightSet(t, {
      lit, jar: .2,
      jun: { face: { eyes: 'dot', mouth: 'flat', lookX: -.8, lookY: .5 }, sq: .02, hL, hR, holdR: putDown ? null : heldCandle, seed: 1 },
      under: () => { if (putDown) candle(...CANDLE_SET, 0, 1); },
    });
    const hop = n => { const h = jump(t, n, n + .32, 1.6); return { dy: h.dy, sq: h.sq }; };
    const withHop = (o, n) => { const h = hop(n); return { ...o, dy: (o.dy || 0) + h.dy, sq: (o.sq || 0) + h.sq }; };
    if (t >= POP.tri) { const k = S(t, 5.0, 5.45), [x, y] = arcPt(OUT, SPOT.tri, 130, easeOut(k)); agent('tri', x, y, lerp(3, 14, easeOut(k)), withHop({ ...cueEmotions(t, 'tri', keysTri), sq: land(t, 5.45), carry: envelope(S(t, 6.25, 6.5)) }, 8.2)); }
    if (t >= POP.star) { const k = S(t, 5.3, 5.75), [x, y] = arcPt(OUT, SPOT.star, 130, easeOut(k)); agent('star', x, y, lerp(3, 14, easeOut(k)), withHop({ ...cueEmotions(t, 'star', keysStar), sq: land(t, 5.75), carry: handset(S(t, 6.7, 6.95)) }, 8.25)); }
    if (t >= POP.heart) { const k = S(t, 5.6, 6.05), [x, y] = arcPt(OUT, SPOT.heart, 130, easeOut(k)); agent('heart', x, y, lerp(3, 14, easeOut(k)), withHop({ ...cueEmotions(t, 'heart', keysHeart), sq: land(t, 6.05), carry: purse(S(t, 7.15, 7.4)) }, 8.3)); }
    // each prop arrives with a spark
    for (const [nm, t0] of [['tri', 6.25], ['star', 6.7], ['heart', 7.15]]) { const a = t - t0; if (a > 0 && a < .5) emote('spark', SPOT[nm][0] + 70, SPOT[nm][1] - 200, 12, seg(a, 0, .15) * (1 - seg(a, .35, .5)), a); }
    if (tap > 0 && tap < 1) { boilSeed('tapring'); paint(ellPts(802, 682, 20 + 50 * tap, 20 + 50 * tap, 20), { ink: CUE_WHITE, sw: 1.5 * (1 - tap) }); }
    camEnd();
    whip(wk, [N.wall2, PAL.cream, N.wood]);
  }

  // ---------- C: the stations ----------
  const ST = { tri: [330, 794], star: [630, 798], heart: [1462, 796] }, SUMMARY = [1112, 712];
  function shotC(t, lt, dur) {
    const cx = kf(t, [[8.6, 410], [10.9, 420], [11.45, 670], [13.55, 690], [13.95, 1000], [14.2, 1010], [14.6, 1470], [16.2, 1490]], ease);
    const cy = kf(t, [[8.6, 610], [13.55, 630], [13.95, 520], [14.2, 520], [14.6, 640]], ease), cz = kf(t, [[8.6, 2.0], [13.55, 2.0], [13.95, 1.7], [14.2, 1.7], [14.6, 2.0]], ease);
    const win = 1 - easeOut(S(t, 8.6, 8.9));
    camBegin(cx - win * 600, cy, cz);
    const level = .2 + .8 * clamp(([14.85, 15.2, 15.55].reduce((s2, l) => s2 + S(t, l, l + .1), 0)) / 3);
    nightSet(t, {
      jar: level, lit: .25,
      jun: { face: { eyes: 'closed', mouth: 'smile', brow: .2 }, lean: -.04, tilt: -.06, sq: -.01, seed: 1 },
      under: () => { candle(...CANDLE_SET, 0, 1); },
    });
    // tri: paper planes out the window
    const launches = [9.1, 9.6, 10.1];
    let triH = { dy: 0, sq: 0 }; for (const l of launches) { const h = jump(t, l - .1, l + .2, 1.2); triH.dy += h.dy; triH.sq += h.sq; }
    const triO = cueEmotions(t, 'tri', [[0, 'determined', { lookX: -.6, lookY: -.8 }], [10.4, 'proud']]);
    agent('tri', ...ST.tri, 14, { ...triO, dy: triO.dy + triH.dy, sq: triO.sq + triH.sq, carry: envelope(1) });
    launches.forEach((l, i) => {
      const k = S(t, l, l + 1.05); if (k <= 0 || k >= 1) return;
      const p0 = [330, 640], p1 = [200 + i * 115, 440 + i * 25], p = arcPt(p0, p1, 70, easeOut(k)), q = arcPt(p0, p1, 70, easeOut(Math.min(1, k + .03)));
      boilSeed('trail' + i); for (let d = 1; d <= 4; d++) { const kk = k - d * .045; if (kk <= 0) break; const r = arcPt(p0, p1, 70, easeOut(kk)); paint(ellPts(r[0], r[1], 3.2 - d * .5, 3.2 - d * .5, 8), { wash: PAL.cream, washOp: 200 - d * 40, ink: null }); }
      boilSeed('plane' + i); plane(p[0], p[1], Math.atan2(q[1] - p[1], q[0] - p[0]), lerp(2.6, .4, ease(S(k, .5, 1))));
      if (k > .85) { boilSeed('twinkle' + i); paint(starPts(p1[0], p1[1], 10 * Math.sin(S(k, .85, 1) * Math.PI), .35, 4), { wash: PAL.cream, ink: null }); }
    });
    // star: the call
    const ring = t > 11.45 && t < 12.1 ? 1 : 0, ans = ease(S(t, 12.1, 12.35)), cardK = S(t, 13.0, 13.25), fly = S(t, 13.2, 13.65);
    let starO = cueEmotions(t, 'star', [[0, 'happy'], [11.6, 'surprised', { lookY: -.8 }], [12.15, 'thinking', { lookX: .8, lookY: -.3 }], [13.05, 'happy']]);
    const nod = t > 12.3 && t < 13 ? .35 * Math.abs(Math.sin((t - 12.3) * TAU * 1.6)) : 0;
    agent('star', ...ST.star, 14, { ...starO, dy: starO.dy + nod, carry: handset(1, ring, ans) });
    if (cardK > 0 && fly < 1) { const p = arcPt([630, 600], SUMMARY, 140, ease(fly)); card(p[0], p[1], lerp(70, 50, fly), 'summary', backOut(cardK), 0, -.1 * fly); }
    if (fly >= 1) card(...SUMMARY, 50, 'summary', 1, 0, -.1);
    // heart: the budget jar
    const coins = [14.5, 14.85, 15.2];
    const heartO = cueEmotions(t, 'heart', [[0, 'determined', { lookX: 1, lookY: -.3 }], [15.45, 'thinking', { lookX: 1, lookY: -.5 }], [15.85, 'proud']]);
    let hH = { dy: 0, sq: 0 }; for (const c of coins) { const h = jump(t, c - .08, c + .12, .7); hH.dy += h.dy; hH.sq += h.sq; }
    const up = t < 15.45 ? 0 : t < 15.7 ? S(t, 15.45, 15.6) : 1 - S(t, 15.7, 15.85);
    agent('heart', ...ST.heart, 14, { ...heartO, dy: heartO.dy + hH.dy, sq: heartO.sq + hH.sq, carry: purse(1, up) });
    coins.forEach((c, i) => { const k = S(t, c, c + .35); if (k <= 0 || k >= 1) return; const p = arcPt([1462, 620], [JAR[0] - 10 + i * 10, JAR[1] - 70], 120, k); boilSeed('coin' + i); coin(p[0], p[1], 9); });
    if (t > 15.3 && t < 15.75) emote('!', JAR[0] + 66, JAR[1] - 130, 9, seg(t, 15.3, 15.4), t - 15.3);
    camEnd();
    whip(win, [N.wall2, PAL.cream, N.wood]);
  }

  // ---------- D + E: the huddle, the cards, the choice ----------
  const HUD = { tri: [660, 794], star: [1000, 800], heart: [1255, 794] };
  const CARDS = [[745, 612, 'pizza'], [960, 592, 'bowl'], [1175, 612, 'sushi']];
  function shotDE(t, lt, dur) {
    const cz = kf(t, [[16.2, 1.55], [16.9, 1.33], [19.6, 1.3], [21.0, 1.36], [24, 1.4]], ease), cy = kf(t, [[16.2, 640], [16.9, 600], [19.6, 580], [21, 530], [24, 520]], ease);
    camBegin(960, cy, cz);
    const choose = S(t, 22.1, 22.55);
    const eyesE = t < 19.6 ? { eyes: t < 17 ? 'wide' : 'dot', mouth: 'smile', lookY: .6, lookX: kf(t, [[16.6, -.6], [17.6, .1], [18.3, .7], [18.7, 0]]) }
      : t < 21.3 ? { eyes: 'dot', mouth: 'flat', lookY: -.2, lookX: t < 20.3 ? -.9 : t < 20.8 ? 0 : .9 }
      : t < 22.1 ? { eyes: 'dot', mouth: 'flat', lookY: -.6, lookX: .2, brow: .3 }
      : t < 22.7 ? { eyes: 'dot', mouth: 'smile', lookY: -.3 } : { eyes: 'happy', mouth: 'grin', blush: .5 };
    const hR = t < 21.3 ? [3.4, -.4] : t < 22.1 ? kf(t, [[21.3, [3.4, -.4]], [21.6, [1.6, -10.6]]], ease) : kf(t, [[22.1, [1.6, -10.6]], [22.45, local(965, 676)], [22.9, local(965, 676)], [23.4, [3.4, -.4]]], ease);
    nightSet(t, {
      jar: 1, lit: .25,
      jun: { face: eyesE, hR, tilt: t > 21.3 && t < 22.1 ? .08 : 0, seed: 1 },
      under: () => { candle(...CANDLE_SET, 0, 1); card(...SUMMARY, 50, 'summary', 1, 0, -.1); },
    });
    if (t > 21.3 && t < 22.15) emote('dots', JX + 120, JY - 15.5 * JU, 8, seg(t, 21.35, 21.5), t - 21.3);
    // the agents
    const pass = [[16.75, 'tri'], [17.35, 'star'], [17.95, 'heart']];
    const cheer = t > 22.7 ? move('hop', t) : null;
    for (const [nm, o0] of [['tri', -260], ['star', 0], ['heart', 260]]) {
      const [x, y] = HUD[nm], arrive = easeOut(S(t, 16.2, 16.55)), hop = pass.find(p => p[1] === nm)[0];
      const h = jump(t, hop, hop + .3, 1.5);
      const o = cueEmotions(t, nm, [[0, 'happy', { lookY: -.6 }], [22.6, 'excited']]);
      const look = t < 18.8 ? { lookX: clamp((960 - x) / 200, -1, 1) * .6, lookY: -.7 } : { lookY: -1, lookX: clamp((960 - x) / 300, -1, 1) };
      const carry = nm === 'tri' ? envelope(1) : nm === 'star' ? handset(1) : purse(1);
      agent(nm, x + o0 * (1 - arrive) * .3, y, 14, { ...o, ...look, dy: o.dy + h.dy + (cheer ? cheer.dy * .6 : 0), sq: o.sq + h.sq + (cheer ? cheer.sq : 0), carry });
    }
    // the glowing hand-off, then the burst
    const bp = (a, b, k) => arcPt(a, b, 90, ease(k));
    const P0 = [660, 610], P1 = [1000, 600], P2 = [1255, 610], P3 = [960, 520];
    let bxy = null, br = 0;
    if (t >= 16.6 && t < 18.85) {
      br = lerp(14, 34, S(t, 16.6, 18.7)) * (1 + .08 * Math.sin(t * 14)) * backOut(S(t, 16.6, 16.75));
      bxy = t < 16.9 ? P0 : t < 17.35 ? bp(P0, P1, S(t, 16.9, 17.3)) : t < 17.5 ? P1 : t < 17.95 ? bp(P1, P2, S(t, 17.5, 17.9)) : t < 18.1 ? P2 : bp(P2, P3, S(t, 18.1, 18.6));
      ball(...bxy, br);
    }
    const burst = S(t, 18.85, 19.25);
    if (burst > 0 && burst < 1) for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, d = 40 + 260 * easeOut(burst); boilSeed('spark' + i); paint(starPts(960 + Math.cos(a) * d, 520 + Math.sin(a) * d * .7, 12 * (1 - burst), .4, 4), { wash: '#FFF0C2', ink: null }); }
    CARDS.forEach(([x, y, kind], i) => {
      const k = S(t, 18.9 + i * .08, 19.3 + i * .08), mine = i === 1;
      const lookAt = t > 19.7 && t < 21.3 && Math.round((t < 20.3 ? -1 : t < 20.8 ? 0 : 1)) === i - 1 ? .5 : 0;
      const fall = mine ? 0 : S(t, 22.45, 23.0);
      const sc = (mine ? 1 + .18 * easeOut(choose) : 1 - fall) * backOut(k);
      card(x, y + Math.sin(t * 2.4 + i) * 6 + fall * 160, 150, kind, sc, mine ? choose : lookAt, (i - 1) * .05);
    });
    camEnd();
    flash(.85 * (1 - S(t, 18.85, 19.2)) * (t > 18.85 ? 1 : 0), '#FFF5E2');
    if (t > dur + 16.2 - .3) brushWipe((t - (dur + 16.2 - .3)) / .6, [N.wall2, R.wall]);
  }

  // ---------- F: Saturday ----------
  function restaurant(t, peek) {
    boilSeed('rwall'); paint(rectPts(-400, -400, W + 800, H + 800), { wash: R.wall, ink: null });
    for (let i = 0; i < 6; i++) { boilSeed('rwallf' + i); paint(ellPts(160 + i * 330, 260 + 220 * hash(i + 4), 320, 230, 22), { fill: R.wall2, fillOp: 70, bleed: .3, tex: .5, ink: null }); }
    // window onto a dusk street, with the agents outside
    boilSeed('rwin'); paint(rectPts(730, 110, 460, 380), { wash: R.frame, ink: PAL.ink, sw: 1.1 });
    paint(rectPts(750, 130, 420, 340), { wash: R.sky2, ink: null }); paint(rectPts(750, 300, 420, 170), { fill: R.sky1, fillOp: 160, bleed: .3, tex: .4, ink: null });
    for (let i = 0; i < 8; i++) { const sx = 770 + hash(i * 5.3) * 380, sy = 145 + hash(i * 2.9) * 120; paint(starPts(sx, sy, 4 * (.6 + .4 * Math.sin(T * 3 + i)), .4, 4), { wash: PAL.cream, ink: null }); }
    peek();
    boilSeed('rwallLow'); paint(rectPts(700, 470, 520, 260), { wash: R.wall, fill: R.wall2, fillOp: 50, bleed: .2, tex: .4, ink: null });
    boilSeed('rframe'); paint(rectPts(955, 130, 10, 340), { wash: R.frame, ink: PAL.ink, sw: .6 });
    paint(rectPts(712, 466, 496, 22), { wash: R.frame, ink: PAL.ink, sw: .9 });
    inkLine([[740, 470], [960, 471], [1180, 470]], 1, PAL.ink, 'ink', 0);
    // string lights
    for (let i = 0; i < 16; i++) { const x = 60 + i * 120, y = 70 + 70 * Math.sin(i / 15 * Math.PI); glow(x, y + 14, 60, '#FFD27A', .6 + .2 * Math.sin(T * 2 + i)); boilSeed('bulb' + i); paint(ellPts(x, y + 14, 8, 11, 10), { wash: '#FFE08A', ink: PAL.ink, sw: .5 }); }
    boilSeed('wire'); for (let k = 0; k < 2; k++) inkLine([...Array(9).keys()].map(j => { const x = 60 + (k * 8 + j) * 120; return [x, 70 + 70 * Math.sin((k * 8 + j) / 15 * Math.PI)]; }), .7, PAL.ink, 'inkfine', .5);
  }
  function table() {
    boilSeed('table');
    paint([[-400, 700], [W + 400, 700], [W + 400, 830], [-400, 830]], { wash: R.cloth, fill: R.clothDk, fillOp: 50, bleed: .2, tex: .5, ink: null });
    paint([[-400, 830], [W + 400, 830], [W + 400, H + 600], [-400, H + 600]], { wash: R.clothDk, ink: null });
    for (let i = 0; i < 9; i++) { boilSeed('fold' + i); inkLine([[60 + i * 230, 840], [50 + i * 230, 1000], [70 + i * 230, 1090]], .6, mixCol(R.clothDk, PAL.ink, .3), 'inkfine', .5); }
    for (let k = 0; k < 3; k++) { inkLine([[k * 900 - 200, 700], [k * 900 + 750, 701]], 1, PAL.ink, 'ink', 0); inkLine([[k * 900 - 200, 830], [k * 900 + 750, 831]], 1, PAL.ink, 'ink', 0); }
  }
  function cake(x, y) {
    boilSeed('cake');
    paint(ellPts(x, y + 6, 150, 22, 24), { wash: CUE_WHITE, ink: PAL.ink, sw: .9 });
    paint(rrPts(x - 105, y - 92, 210, 92, 14), { wash: '#F6E1C6', fill: '#E9C9A0', fillOp: 70, bleed: .1, tex: .5, ink: PAL.ink, sw: 1 });
    paint([[x - 108, y - 96], [x + 108, y - 96], [x + 108, y - 70], [x + 80, y - 58], [x + 55, y - 72], [x + 20, y - 54], [x - 15, y - 70], [x - 50, y - 56], [x - 85, y - 70], [x - 108, y - 62]], { wash: PAL.rose, ink: PAL.ink, sw: .8, curv: .4 });
    for (let i = 0; i < 6; i++) paint(ellPts(x - 80 + i * 32, y - 100, 5, 5, 8), { wash: [PAL.ochre, PAL.sky, CUE_WHITE][i % 3], ink: null });
  }
  function shotF(t, lt, dur) {
    const cxy = kf(t, [[24, [960, 520, 1.05]], [25.9, [960, 520, 1.08]], [27.0, [960, 560, 1.25]], [28.9, [960, 560, 1.27]], [30.0, [960, 640, 1.7]], [31, [960, 640, 1.8]]], ease);
    camBegin(cxy[0], cxy[1], cxy[2]);
    restaurant(t, () => {
      const rise = [['tri', 838, 27.3, 28.95], ['star', 960, 27.5, 29.1], ['heart', 1082, 27.7, 29.25]];
      for (const [nm, x, up, down] of rise) {
        if (t < up - .05 || t > down + .5) continue;
        const k = easeOut(S(t, up, up + .35)) - easeIn(S(t, down, down + .35)), sway = move('sway', t, 1);
        const o = cueEmotions(t, nm, [[0, 'excited'], [up + .5, 'happy', { lookX: -.4, lookY: .4 }]]);
        agent(nm, x + (k > .9 ? sway.dx * 3 : 0), 470 + (1 - k) * 150, 11.5, { ...o, rot: k > .9 ? sway.rot : 0, dy: o.dy, noShadow: true, carry: nm === 'tri' ? envelope(1) : nm === 'star' ? handset(1) : purse(1) });
      }
    });
    const surprise = t < 25.9, fr = { eyes: surprise ? (t < 24.35 ? 'dot' : 'wide') : 'happy', mouth: surprise ? (t < 24.35 ? 'flat' : 'o') : 'grin', blush: surprise ? .3 : .7, lookX: -.6, lookY: .2 };
    const fT = take(t, 24.4, 1.2), cheeks = t > 24.4 && t < 26.2;
    const frO = { key: 'friend', who: FRIEND, face: fr, sq: fT.sq * .4, dy: fT.dy * .3, hL: cheeks ? [-2.6, -11.5] : [-3.2, -.4], hR: cheeks ? [2.6, -11.5] : [3.2, -.4], seed: 2 };
    const junF = { eyes: t > 28.0 && t < 28.9 ? 'dot' : 'happy', mouth: 'smile', blush: .4, lookX: t > 28.0 && t < 28.9 ? .5 : .6, lookY: t > 28.0 && t < 28.9 ? -.8 : 0 };
    const junO = { key: 'jun', who: JUN, face: junF, seed: 1, tilt: .04 };
    person(560, 712, 22, { ...junO, layer: 'body' });
    person(1360, 712, 22, { ...frO, layer: 'body' });
    table(); cake(960, 772);
    candle(960, 680, 1, 1.15);
    person(560, 712, 22, { ...junO, layer: 'arms' });
    person(1360, 712, 22, { ...frO, layer: 'arms' });
    const at = toScreen(960, 590);
    camEnd();
    if (lt < .3) brushWipe(.5 + lt / .6, [N.wall2, R.wall]);
    const ir = S(t, 29.6, 30.7);
    if (ir > 0) iris(...at, lerp(1500, 0, easeIn(ir)), PAL.ink);
  }

  // ---------- G: end card ----------
  function shotG(t, lt, dur) {
    const cx = W / 2 - 170, gy = 700, pop = S(t, 31.2, 31.5);
    if (t >= 31.2) {
      const o = cueEmotions(t, 'cog', [[0, 'hopeful', { eyes: 'look' }], [32.1, 'neutral']], { take: .7 });
      const h = jump(t, 31.25, 31.6, 2);
      agent('cog', cx, gy, 28 * backOut(pop), { ...o, dy: o.dy + h.dy, sq: o.sq + h.sq });
    }
    if (t > 32.4) letter('cue', W / 2 + 190, gy - 125, 230, PAL.ink, { ink: false, pop: (t - 32.4) * 4, font: '800 230px "Helvetica Neue", Helvetica, Arial, sans-serif' });
    const ir = S(t, 31.0, 31.6);
    if (ir < 1) iris(cx, gy - 130, lerp(0, 1400, easeOut(ir)), PAL.ink);
    flushLetters();
    flash(ease(S(t, 33.4, 34.0)), PAL.paper);
  }

  shots([[0, shotA], [4.6, shotB], [8.6, shotC], [16.2, shotDE], [24.0, shotF], [31.0, shotG]]);
})();
