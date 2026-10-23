'use strict';
// W5 — "the crew compares other apps" (reference frames 999–1259). Motion measured on the reference (motion/w5.js);
// every picture, word and layout here is ours: the screens are lib/art.js appScreen()/cover() compositions, the labels
// and caption come from STORY.fan, the chats from STORY.chat.plan / STORY.chat.build.
//   w5-fan   999–1209  a full-screen app rises in and shrinks into a card that opens into an 11-card 3D fan (CSS
//                      perspective, one measured pose per frame); agent labels pop on leader lines; the camera dives
//                      through the front screen and pans down to the "plan ready" chat, which whips up and out
//   w5-build 1209–1259  the "building" chat rises in, streams, dissolves; the builder flies off into W6's close-up
(() => {
  const M = window.MW5 || {};
  const NC = 11, PERSP = M.P || 2060, W = 1080, H = 608;
  const INK = '#16151B', INK2 = '#6E6B73', INK3 = '#A29FA8';
  const crewTint = id => STORY.crew.find(c => c.id === id).tint;
  const crewName = id => STORY.crew.find(c => c.id === id).name;
  const deep = (hex, t = 0.42) => mixHex(hex, '#16151B', t);
  const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
  const tb = (tab, n, d = 0) => (tab ? trk(tab, n) : d);
  // dense per-frame rows {from, rows: [[...], ...]}, linearly interpolated
  function rowAt(tab, n) {
    const f = n - tab.from, i = Math.floor(f), t = f - i, L = tab.rows.length - 1;
    const a = tab.rows[clamp(i, 0, L)], b = tab.rows[clamp(i + 1, 0, L)];
    return a.map((v, k) => v + (b[k] - v) * t);
  }

  // ───────────── projection: identical to the CSS transform on each card ─────────────
  function rotM(ax, ay, az) {
    const r = Math.PI / 180, ca = Math.cos(ax * r), sa = Math.sin(ax * r), cb = Math.cos(ay * r), sb = Math.sin(ay * r), cc = Math.cos(az * r), sc = Math.sin(az * r);
    const Rx = [[1, 0, 0], [0, ca, -sa], [0, sa, ca]], Ry = [[cb, 0, sb], [0, 1, 0], [-sb, 0, cb]], Rz = [[cc, -sc, 0], [sc, cc, 0], [0, 0, 1]];
    const mul = (A, B) => A.map(row => [0, 1, 2].map(j => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
    return mul(mul(Rx, Ry), Rz);
  }
  // point (u, v) on card i (native px from its centre) → frame px [x, y, scale]
  function project(p, i, u, v) {
    const [X, Y, Z, ax, ay, az, g] = p, R = rotM(ax, ay, az), z0 = -i * g;
    const x = R[0][0] * u + R[0][1] * v + R[0][2] * z0 + X, y = R[1][0] * u + R[1][1] * v + R[1][2] * z0 + Y, z = R[2][0] * u + R[2][1] * v + R[2][2] * z0 + Z;
    const w = 1 - z / PERSP; return [W / 2 + x / w, H / 2 + y / w, 1 / w];
  }
  const cardCss = (p, i) => `perspective(${PERSP}px) translate3d(${p[0].toFixed(3)}px, ${p[1].toFixed(3)}px, ${p[2].toFixed(2)}px) ` +
    `rotateX(${p[3].toFixed(4)}deg) rotateY(${p[4].toFixed(4)}deg) rotateZ(${p[5].toFixed(4)}deg) translateZ(${(-i * p[6]).toFixed(2)}px)`;

  // ───────────── our app screens (native 1080×608; each card is drawn at this size and projected) ─────────────
  const T = (s, str, x, base, size, wgt, col, ls = -0.02) => text(s, str, { x, base, size, weight: wgt, color: col, ls });
  const bar = (s, x, y, w, h, col, r = h / 2, op = 1) => el(s, 'abs', { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', background: col, borderRadius: r + 'px', opacity: op });
  function nav(s, P, active) {
    bar(s, 44, 34, 34, 34, P.ac, 11);
    ['Places', 'Book', 'Reviews', 'Map'].forEach((wd, i) => {
      const x = 104 + i * 118;
      if (i === active) bar(s, x - 16, 32, 104, 38, P.card, 19);
      T(s, wd, x, 57, 19, i === active ? 600 : 500, i === active ? P.fg : P.mu);
    });
    bar(s, W - 128, 32, 38, 38, P.card, 19); bar(s, W - 80, 32, 38, 38, P.mu, 19, 0.55);
  }
  function playPill(s, x, y, ac) {
    const p = bar(s, x, y, 164, 50, ac, 25);
    el(p, 'abs', { left: '24px', top: '15px', width: 0, height: 0, borderLeft: '16px solid #fff', borderTop: '10px solid transparent', borderBottom: '10px solid transparent' });
    bar(p, 54, 20, 84, 10, '#fff', 5, 0.9);
    return p;
  }
  function wideApp(parent, seed, kind) {
    const P = APP_PAL[seed % APP_PAL.length], shows = STORY.shows;
    const s = el(parent, 'abs', { left: 0, top: 0, width: W + 'px', height: H + 'px', background: P.bg, overflow: 'hidden' });
    if (kind === 'grid') {
      nav(s, P, 1);
      T(s, ['Book', 'Reviews', 'Places', 'Tonight'][seed % 4], 44, 150, 50, 800, P.fg, -0.03);
      for (let i = 0; i < 3; i++) bar(s, 44 + i * 132, 176, 118, 34, i ? P.card : P.ac, 17);
      for (let i = 0; i < 6; i++) {
        const x = 44 + i * 168;
        cover(s, seed * 13 + i, { x, y: 236, w: 150, h: 150, r: 16 });
        T(s, shows[(seed + i) % shows.length], x, 418, 16, 600, P.fg, -0.01);
        bar(s, x, 432, 90, 9, P.mu, 4.5, 0.6);
      }
      for (let i = 0; i < 2; i++) { cover(s, seed * 17 + i, { x: 44 + i * 504, y: 470, w: 64, h: 64, r: 12 }); bar(s, 124 + i * 504, 484, 220, 12, P.fg, 6, 0.85); bar(s, 124 + i * 504, 508, 150, 9, P.mu, 4.5, 0.6); }
    } else if (kind === 'phone') {
      nav(s, P, 0);
      appScreen(s, seed + 2, { x: 64, y: 96, w: 220, h: 476, r: 28 });
      T(s, shows[seed % shows.length], 340, 166, 40, 800, P.fg, -0.03);
      bar(s, 342, 186, 300, 11, P.mu, 5.5, 0.7); bar(s, 342, 206, 220, 11, P.mu, 5.5, 0.5);
      for (let i = 0; i < 4; i++) {
        const y = 250 + i * 80; cover(s, seed * 7 + 3 + i, { x: 340, y, w: 62, h: 62, r: 12 });
        bar(s, 420, y + 12, 260 - i * 30, 13, P.fg, 6.5, 0.85); bar(s, 420, y + 36, 170, 10, P.mu, 5, 0.6);
        bar(s, 970, y + 18, 66, 26, i === 0 ? P.ac : P.card, 13);
      }
    } else if (kind === 'player') {
      cover(s, seed * 19 + 5, { x: 0, y: 0, w: W, h: H, r: 0 });
      el(s, 'abs', { left: 0, top: 0, width: W + 'px', height: H + 'px', background: `linear-gradient(180deg, ${rgba(P.bg, 0.15)} 0%, ${rgba(P.bg, 0.55)} 55%, ${rgba(P.bg, 0.96)} 100%)` });
      nav(s, P, 3);
      T(s, shows[(seed + 3) % shows.length], 44, 470, 48, 800, P.fg, -0.03);
      bar(s, 44, 500, 992, 6, rgba(P.fg, 0.25), 3); bar(s, 44, 500, 420, 6, P.ac, 3);
      for (let i = 0; i < 5; i++) bar(s, 44 + i * 150, 530, 132, 40, i === 1 ? P.ac : rgba(P.fg, 0.14), 20);
    } else { // 'hero'
      nav(s, P, 2);
      cover(s, seed * 23 + 7, { x: 500, y: 92, w: 536, h: 330, r: 22 });
      T(s, shows[(seed + 5) % shows.length].split(' ').slice(0, 2).join(' '), 44, 186, 54, 800, P.fg, -0.03);
      bar(s, 46, 214, 340, 12, P.mu, 6, 0.7); bar(s, 46, 236, 260, 12, P.mu, 6, 0.5);
      playPill(s, 44, 274, P.ac); bar(s, 220, 274, 50, 50, P.card, 25);
      for (let i = 0; i < 7; i++) cover(s, seed * 29 + i, { x: 44 + i * 142, y: 460, w: 128, h: 100, r: 14 });
    }
    return s;
  }
  // screen A: the full-screen app that opens the shot (dark navy)
  function screenA(parent) {
    const P = APP_PAL[0];
    const s = el(parent, 'abs', { left: 0, top: 0, width: W + 'px', height: H + 'px', background: P.bg, overflow: 'hidden' });
    cover(s, 41, { x: 360, y: 0, w: 720, h: 452, r: 0 });
    el(s, 'abs', { left: '360px', top: 0, width: '720px', height: '452px', background: `linear-gradient(90deg, ${P.bg} 0%, ${rgba(P.bg, 0.6)} 30%, ${rgba(P.bg, 0)} 62%), linear-gradient(0deg, ${P.bg} 0%, ${rgba(P.bg, 0)} 40%)` });
    nav(s, P, 0);
    T(s, 'Saturday', 48, 182, 66, 800, P.fg, -0.035); T(s, 'Dinner', 48, 250, 66, 800, P.fg, -0.035);
    bar(s, 50, 278, 300, 12, P.mu, 6, 0.8); bar(s, 50, 300, 230, 12, P.mu, 6, 0.55);
    playPill(s, 48, 334, P.ac); bar(s, 224, 334, 50, 50, P.card, 25);
    appScreen(s, 6, { x: 846, y: 92, w: 176, h: 340, r: 24 });
    T(s, 'Places', 48, 482, 20, 700, P.fg);
    for (let i = 0; i < 7; i++) cover(s, 60 + i, { x: 48 + i * 142, y: 498, w: 128, h: 84, r: 12 });
    return s;
  }
  // screen B: the screen the camera dives into; its lower shelf is the banner over the plan chat (dark teal)
  function screenB(parent) {
    const P = APP_PAL[6];
    const s = el(parent, 'abs', { left: 0, top: 0, width: W + 'px', height: H + 'px', background: P.bg, overflow: 'hidden' });
    cover(s, 57, { x: 0, y: 0, w: W, h: 470, r: 0 });
    el(s, 'abs', { left: 0, top: 0, width: W + 'px', height: '470px', background: `linear-gradient(90deg, ${rgba(P.bg, 0.95)} 0%, ${rgba(P.bg, 0.55)} 38%, ${rgba(P.bg, 0.05)} 70%), linear-gradient(0deg, ${P.bg} 0%, ${rgba(P.bg, 0)} 45%)` });
    nav(s, P, 1);
    T(s, 'Casa', 48, 190, 70, 800, P.fg, -0.035); T(s, 'Verde', 48, 262, 70, 800, P.fg, -0.035);
    bar(s, 50, 290, 320, 12, P.mu, 6, 0.85); bar(s, 50, 312, 240, 12, P.mu, 6, 0.6);
    playPill(s, 48, 344, P.ac);
    appScreen(s, 2, { x: 852, y: 96, w: 172, h: 330, r: 24 });
    T(s, 'Places', 48, 470, 20, 700, P.fg); bar(s, 940, 458, 92, 14, P.mu, 7, 0.5);
    const shelf = STORY.shows.slice(0, 5);
    for (let i = 0; i < 5; i++) {
      const card = bar(s, 48 + i * 198, 490, 186, 92, P.card, 16);
      cover(card, 70 + i, { x: 10, y: 10, w: 72, h: 72, r: 10 });
      T(card, shelf[i], 94, 38, 15, 700, P.fg, -0.01);
      bar(card, 94, 52, 56, 8, P.mu, 4, 0.7); bar(card, 94, 66, 36, 8, i === 1 ? P.ac : P.mu, 4, i === 1 ? 1 : 0.45);
    }
    return s;
  }
  const CARD_KINDS = [null, ['grid', 1], ['phone', 4], ['hero', 2], ['grid', 3], ['player', 7], ['phone', 5], ['grid', 0], ['hero', 6], ['player', 1], ['grid', 4]];

  // ───────────── chat block (plan and build chats share it) ─────────────
  // origin (0,0) = top of the name row
  function chatBlock(parent, cfg) {
    const g = el(parent, 'abs', { left: 0, top: 0, width: W + 'px', height: '420px' });
    const tint = crewTint(cfg.agent);
    const avBox = el(g, 'abs', { left: '114px', top: '24px', width: 0, height: 0 });
    const av = crew(avBox, cfg.agent, 'happy', 46); placeCrew(av, 0, 0, 'happy');
    const nm = text(g, crewName(cfg.agent), { x: 158, base: 20, size: 20, weight: 600, color: INK, ls: -0.01 });
    const nmW = nm.getBoundingClientRect().width;
    const chip = el(g, 'abs', { left: (158 + nmW + 12) + 'px', top: '-1px', height: '28px', borderRadius: '14px', background: rgba(tint, 0.14), padding: '0 12px', display: 'flex', alignItems: 'center',
      font: '600 14.5px/1 Inter', color: deep(tint, 0.38), letterSpacing: '-0.005em', whiteSpace: 'nowrap' }, cfg.status);
    const head = charText(g, cfg.head, { x: 158, base: 76, size: 34, weight: 600, color: INK, ls: -0.022 });
    const lines = (cfg.lines || []).map((ln, i) => charText(g, ln, { x: 158, base: 122 + i * 42, size: 20, weight: 400, color: INK2, ls: -0.01 }));
    const edges = ct => { const x0 = ct.node.getBoundingClientRect().left; return ct.chars.map(c => c.getBoundingClientRect().right - x0); };
    return { g, av, avBox, nm, chip, head, lines, headR: edges(head), lineR: lines.map(edges), tint };
  }
  function docCard(parent, doc, kind, tint, x, y) {
    const c = el(parent, 'abs', { left: x + 'px', top: y + 'px', width: '540px', height: '90px', background: '#FFFFFF', borderRadius: '20px',
      boxShadow: '0 10px 30px rgba(22,21,27,.10), 0 0 0 1px rgba(22,21,27,.06)', overflow: 'hidden' });
    const tile = el(c, 'abs', { left: '18px', top: '17px', width: '56px', height: '56px', borderRadius: '16px', background: rgba(tint, 0.16) });
    el(tile, 'abs', { left: '17px', top: '12px', width: '22px', height: '30px', borderRadius: '4px', background: '#fff', boxShadow: `0 0 0 1.5px ${deep(tint, 0.25)}` });
    [0, 1, 2].forEach(i => bar(tile, 21, 19 + i * 7, i === 2 ? 9 : 14, 2.4, deep(tint, 0.25), 1.2));
    text(c, doc, { x: 92, base: 42, size: 19, weight: 600, color: INK, ls: -0.015 });
    text(c, kind, { x: 92, base: 67, size: 15, weight: 500, color: INK3, ls: -0.005 });
    const go = el(c, 'abs', { left: '478px', top: '27px', width: '36px', height: '36px', borderRadius: '18px', background: '#F1EEE9' });
    el(go, 'abs', { left: '11px', top: '12.5px', width: '9px', height: '9px', borderTop: `2.4px solid ${INK}`, borderRight: `2.4px solid ${INK}`, transform: 'rotate(45deg)', borderRadius: '1px' });
    const shine = el(c, 'abs', { left: '-200px', top: 0, width: '170px', height: '90px', background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(244,240,234,.95) 50%, rgba(255,255,255,0) 100%)' });
    return { c, shine };
  }
  // mean glyph opacity E(f) of the dissolve clamp((f - 0.8u)/0.2), u ~ U[0,1): inverted so a row's level follows the table
  function dissolveMean(f) {
    if (f <= 0) return 0; if (f <= 0.2) return 3.125 * f * f; if (f <= 0.8) return 1.25 * f - 0.125;
    const a = (f - 0.2) / 0.8; return a + (f - 0.4 - f * a + 0.4 * a * a) / 0.2;
  }
  function invE(t) { let lo = 0, hi = 1; for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (dissolveMean(m) < t) lo = m; else hi = m; } return (lo + hi) / 2; }
  // hard type-on by width fraction (the reference types its headline glyph by glyph)
  function typeFrac(ct, R, f) { const w = R[R.length - 1] * f + 0.5; ct.chars.forEach((c, i) => { c.style.opacity = R[i] <= w ? 1 : 0; }); }
  // soft stream by width fraction: the leading (faint) glyph edge sits at f of the row's width, glyphs reach full opacity
  // `tail` px behind it (the reference's streamed ink mass tracks its leading edge, so the tail is short)
  function streamFrac(ct, R, f, tail = 24) { const head = R[R.length - 1] * f; ct.chars.forEach((c, i) => { c.style.opacity = f <= 0 ? 0 : clamp((head - R[i]) / tail + 0.12).toFixed(3); }); }

  // ───────────── floating agent labels on leader lines ─────────────
  // The reference's labels ride one flat layer that drifts and shrinks over the deck (measured: motion/w5.js labLayer).
  // Our own arrangement on that layer, given at n1060: pill centre x, attach edge y (up: pill bottom, down: pill top), dot y.
  const LAYOUT = [
    { x: 260, y: 500, dot: 420, up: false },
    { x: 800, y: 470, dot: 412, up: false },
    { x: 420, y: 146, dot: 226, up: true },
    { x: 730, y: 92, dot: 218, up: true },
    { x: 650, y: 520, dot: 440, up: false },
    { x: 490, y: 64, dot: 222, up: true },
    { x: 450, y: 520, dot: 470, up: false },
  ];
  function buildLabel(parent, lab, i) {
    const L = LAYOUT[i];
    const line = el(parent, 'abs', { width: '1.5px', background: 'rgba(22,21,27,.28)' });
    const dot = el(parent, 'abs', { width: '9px', height: '9px', borderRadius: '50%', background: '#fff', boxShadow: '0 0 0 1.5px rgba(22,21,27,.30), 0 2px 6px rgba(22,21,27,.18)' });
    const pill = el(parent, 'abs', { height: '40px', borderRadius: '20px', background: '#FFFFFF', boxShadow: '0 8px 24px rgba(22,21,27,.13), 0 0 0 1px rgba(22,21,27,.06)' });
    const avBox = el(pill, 'abs', { left: '22px', top: '21px', width: 0, height: 0 });
    const av = crew(avBox, lab.agent, 'happy', 25); placeCrew(av, 0, 0, 'happy');
    const t = text(pill, lab.text, { x: 44, base: 25.5, size: 15.5, weight: 500, color: INK, ls: -0.012 });
    const w = 44 + t.getBoundingClientRect().width + 18; pill.style.width = w + 'px';
    blurrable(pill, '-30%', '160%');
    return { L, line, dot, pill, w, h: 40 };
  }
  // layer transform at frame n: p = C + S (q - C) + t
  const layerAt = (n, x, y) => { const [tx, ty, S] = rowAt(M.labLayer, n); return [540 + S * (x - 540) + tx, 304 + S * (y - 304) + ty, S]; };

  // ───────────── scene 1: rise → shrink → fan → dive → plan chat → whip out ─────────────
  scene({
    id: 'w5-fan', from: 999, to: 1209, z: 50,
    build(S) {
      S.root.style.display = 'block';           // text is measured during build (label widths, glyph edges)
      const cam = S.cam;
      const cap = text(cam, STORY.fan.caption, { x: 56, base: 50, size: 22, weight: 500, color: INK, ls: -0.022 });
      blurrable(cap, '-20%', '140%'); S.cap = cap;
      const fan = el(cam, 'abs', { left: 0, top: 0, width: W + 'px', height: H + 'px' });
      blurrable(fan, '-25%', '150%'); S.fan = fan;
      S.glow = el(fan, 'abs', { left: 0, top: 0, width: '900px', height: '420px', borderRadius: '50%', opacity: 0,
        background: 'radial-gradient(closest-side, rgba(255,178,134,.9) 0%, rgba(206,186,252,.85) 42%, rgba(186,222,206,.55) 68%, rgba(245,243,239,0) 100%)' });
      S.cards = [];
      for (let i = NC - 1; i >= 0; i--) {
        const c = el(fan, 'abs', { left: 0, top: 0, width: W + 'px', height: H + 'px', transformOrigin: '540px 304px', borderRadius: '18px', overflow: 'hidden',
          backfaceVisibility: 'hidden', boxShadow: '0 16px 40px rgba(22,21,27,.16), 0 0 0 1.5px rgba(22,21,27,.07)' });
        if (i === 0) { S.A = screenA(c); S.B = screenB(c); S.B.style.opacity = 0; }
        else wideApp(c, CARD_KINDS[i][1] + i * 8, CARD_KINDS[i][0]);
        S.cards[i] = c;
      }
      const labs = el(cam, 'abs', { left: 0, top: 0, width: W + 'px', height: H + 'px' });
      S.labels = STORY.fan.labels.map((lab, i) => buildLabel(labs, lab, i));
      const chat = el(cam, 'abs', { left: 0, top: 0, width: W + 'px', height: '440px' }); blurrable(chat, '-10%', '120%'); S.chat = chat;
      const pl = STORY.chat.plan;
      S.plan = chatBlock(chat, { agent: pl.agent, status: pl.status, head: pl.head, lines: [pl.sub] });
      S.doc = docCard(S.plan.g, pl.doc, pl.docKind, S.plan.tint, 158, 150);
      S.root.style.display = 'none';
    },
    seek(n, S) {
      if (!M.pose) return;
      const pose = rowAt(M.pose, n);
      const deckOn = n < 1138;                 // after the dive only the banner card is left
      for (let i = 0; i < NC; i++) {
        const c = S.cards[i], show = i === 0 || (deckOn && pose[6] > 0.6);
        c.style.display = show ? 'block' : 'none';
        if (show) c.style.transform = cardCss(pose, i);
      }
      S.B.style.opacity = tb(M.mixB, n);
      const fb = M.fanBlur ? rowAt(M.fanBlur, n) : [0, 0];
      S.fan._blur(fb[0], fb[1]);
      const cen = project(pose, (NC - 1) / 2, 0, 0), k = clamp(cen[2] / 0.28, 0.6, 2.4);
      Object.assign(S.glow.style, { left: (cen[0] - 520 * k) + 'px', top: (cen[1] - 250 * k) + 'px', width: 1040 * k + 'px', height: 500 * k + 'px', opacity: tb(M.glow, n) });
      // caption: centre-out reveal + opacity ramp + blur on arrival; fades out on the dive
      const cr = tb(M.capReveal, n), co = tb(M.capOp, n);
      S.cap.style.display = co > 0.002 ? 'block' : 'none';
      S.cap.style.opacity = co; S.cap._blur(tb(M.capBlur, n));
      if (cr >= 1) { S.cap.style.webkitMaskImage = 'none'; S.cap.style.maskImage = 'none'; }
      else {
        const c0 = 50 - cr * 50, c1 = 50 + cr * 50;
        const m = `linear-gradient(90deg, transparent ${(c0 - 7).toFixed(2)}%, #000 ${c0.toFixed(2)}%, #000 ${c1.toFixed(2)}%, transparent ${(c1 + 7).toFixed(2)}%)`;
        S.cap.style.webkitMaskImage = m; S.cap.style.maskImage = m;
      }
      // labels: pop in / out about the pill's bottom centre, riding the measured label layer
      (M.labels || []).forEach((lt, i) => {
        const lb = S.labels[i], L = lb.L;
        if (n < lt.tin - 1 || n >= lt.tout || !deckOn) { lb.pill.style.display = lb.line.style.display = lb.dot.style.display = 'none'; return; }
        const kin = n - lt.tin, kout = lt.tout - n;
        let s = trk(M.popS, kin), o = trk(M.popO, kin), bl = trk(M.popB, kin);
        if (kout <= 14) { s = Math.min(s, trk(M.outS, kout)); o = Math.min(o, trk(M.outO, kout)); bl = Math.max(bl, trk(M.outB, kout)); }
        const yb = L.up ? L.y : L.y + lb.h;
        const B = layerAt(n, L.x, yb), D = layerAt(n, L.x, L.dot), k = B[2] * s, dy = 4 * (1 - s);
        Object.assign(lb.pill.style, { display: 'block', left: (B[0] - lb.w / 2) + 'px', top: (B[1] - lb.h + dy) + 'px', transformOrigin: '50% 100%',
          transform: `scale(${k.toFixed(4)})`, opacity: o.toFixed(3) });
        lb.pill._blur(bl, bl * 0.3);
        const edge = L.up ? B[1] + dy : B[1] + dy - lb.h * k;
        const y0 = Math.min(edge, D[1]), y1 = Math.max(edge, D[1]);
        Object.assign(lb.line.style, { display: 'block', left: (D[0] - 0.75) + 'px', top: y0 + 'px', height: (y1 - y0) + 'px', opacity: (o * clamp(s * 1.3)).toFixed(3) });
        Object.assign(lb.dot.style, { display: 'block', left: (D[0] - 4.5) + 'px', top: (D[1] - 4.5) + 'px', transform: `scale(${(B[2] * clamp(s * 1.2)).toFixed(3)})`, opacity: (o * clamp(s * 1.4)).toFixed(3) });
      });
      // plan chat, hung under the banner card's bottom edge
      const on = n >= 1136;
      S.chat.style.display = on ? 'block' : 'none';
      if (on) {
        S.chat.style.transform = `translateY(${tb(M.chatY, n).toFixed(3)}px)`;
        const cb = tb(M.chatBlur, n); S.chat._blur(0, cb);
        const P = S.plan;
        typeFrac(P.head, P.headR, tb(M.planHead, n));
        streamFrac(P.lines[0], P.lineR[0], tb(M.planSub, n));
        const isc = tb(M.planIcon, n); P.avBox.style.transform = `scale(${isc.toFixed(4)})`; P.avBox.style.opacity = isc > 0.01 ? 1 : 0;
        const nw = tb(M.planNameWipe, n), no = tb(M.planNameOp, n);
        [P.nm, P.chip].forEach(e => { e.style.opacity = no; wipe(e, nw, 0.4); });
        S.doc.c.style.opacity = tb(M.planDocOp, n); wipe(S.doc.c, tb(M.planDocWipe, n), 0.3);
        const sh = tb(M.planShine, n, -1);
        S.doc.shine.style.left = (sh < 0 || sh > 1 ? -400 : -170 + sh * 710) + 'px';
      }
    },
  });

  // ───────────── scene 2: the building chat ─────────────
  scene({
    id: 'w5-build', from: 1209, to: 1259, z: 51,
    build(S) {
      S.root.style.display = 'block';
      const b = STORY.chat.build;
      const chat = el(S.cam, 'abs', { left: 0, top: 0, width: W + 'px', height: '440px' }); blurrable(chat, '-10%', '120%'); S.chat = chat;
      S.blk = chatBlock(chat, { agent: b.agent, status: b.status, head: b.head, lines: b.lines });
      S.blk.avBox.style.display = 'none';      // the builder lives on its own layer: it leaves the chat at the end
      S.flyBox = el(S.cam, 'abs', { left: 0, top: 0, width: 0, height: 0 }); blurrable(S.flyBox, '-60%', '220%');
      S.fly = crew(S.flyBox, b.agent, 'happy', 46); placeCrew(S.fly, 0, 0, 'happy');
      const R = rng(1259); S.order = [S.blk.head, ...S.blk.lines].map(ct => ct.chars.map(() => R()));
      S.root.style.display = 'none';
    },
    seek(n, S) {
      if (!M.buildTy) return;
      const B = S.blk, ty = tb(M.buildTy, n);
      S.chat.style.transform = `translateY(${(190 + ty).toFixed(3)}px)`;
      S.chat._blur(0, tb(M.buildBlur, n));
      typeFrac(B.head, B.headR, tb(M.buildHead, n));
      B.lines.forEach((ln, i) => streamFrac(ln, B.lineR[i], tb(i ? M.buildL2 : M.buildL1, n)));
      // the end: a per-glyph dissolve whose overall level follows each row's measured fade
      // each glyph fades over 0.2 of the level at a random point; invE maps the measured row level to that control value
      const fades = [tb(M.fadeHead, n, 1), tb(M.fadeL1, n, 1), tb(M.fadeL2, n, 1)];
      [B.head, ...B.lines].forEach((ct, r) => {
        const t = fades[r]; if (t >= 0.999) return; const f = invE(t);
        ct.chars.forEach((c, i) => { c.style.opacity = Math.min(+c.style.opacity, clamp((f - S.order[r][i] * 0.8) / 0.2)).toFixed(3); });
      });
      B.nm.style.opacity = B.chip.style.opacity = Math.min(tb(M.buildName, n), tb(M.fadeName, n, 1));
      // the builder: pops in with the chat, rides it, then flies into the close-up
      const av = rowAt(M.buildAv, n), pop = tb(M.buildAvPop, n);
      S.flyBox.style.transform = `translate(${av[0].toFixed(2)}px, ${av[1].toFixed(2)}px) scale(${(av[2] * pop).toFixed(4)})`;
      S.flyBox.style.opacity = clamp(pop * 1.6);
      S.flyBox._blur(av[3], av[4]);
    },
  });
})();
