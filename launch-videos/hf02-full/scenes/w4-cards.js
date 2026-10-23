'use strict';
// W4 — the cards. Motion = measured on the reference (motion/w4.js, notes/w4.md); every picture and word is ours (story.js, lib/*).
//   w4-review   n510–640  Theo's review card + Scout bubble → 3D tilt → a deck of reviews rushes past → Mara's card lands, turns face-on
//   w4-close    n641–670  close-up of Mara's card (quote + reviewer) + Critic bubble
//   w4-thread   n743–848  dark reply thread under the review, scrolling, accelerating into a whip up (the wall rises under it)
//   w4-wall     n842–921  wall of show cards, zooming out in steps
//   w4-feature  n922–970  one show card: column whip up, slow push-in, blur out (W3's insights cut in at n971)
(() => {
  const M = window.MW4 || {};
  const QA = /w4qa/.test(location.search);           // geometry-QA renders: card faces flat dark, so tools/w4/quad.py can read them
  const INK = '#16151B', INK2 = '#6E6B73', INK3 = '#A29FA8', RULE = '#E6E2DC', PAPER = '#F5F3EF';
  const DARK = '#141218', DARK2 = '#1D1A22', DFG = '#F2EFF5', DMU = '#9A95A3';
  const SHADOW = '0 10px 30px rgba(22,21,27,.10), 0 0 0 1px rgba(22,21,27,.06)';
  const P2 = v => (+v).toFixed(2) + 'px';
  const building = (S, fn) => { S.root.style.display = 'block'; try { fn(); } finally { S.root.style.display = 'none'; } };
  const wOf = node => node.getBoundingClientRect().width;
  const CW = 582, CH = 505;                          // review card (the reference card's face-on footprint, n524)

  // ───────────── geometry ─────────────
  // rect W×H → quad (TL, TR, BR, BL in frame px) as a CSS matrix3d (transform-origin 0 0)
  function homog(W, H, q) {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
    const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    let a, b, c, d, e, f, g, h;
    if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) { a = x1 - x0; b = x2 - x1; c = x0; d = y1 - y0; e = y2 - y1; f = y0; g = 0; h = 0; }
    else {
      const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, den = dx1 * dy2 - dx2 * dy1;
      g = (sx * dy2 - dx2 * sy) / den; h = (dx1 * sy - sx * dy1) / den;
      a = x1 - x0 + g * x1; b = x3 - x0 + h * x3; c = x0; d = y1 - y0 + g * y1; e = y3 - y0 + h * y3; f = y0;
    }
    a /= W; d /= W; g /= W; b /= H; e /= H; h /= H;
    const v = [a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, 1].map(z => +z.toPrecision(9));
    return `matrix3d(${v.join(',')})`;
  }
  const quadAt = (T, n) => [0, 1, 2, 3].map(i => [trk(T['x' + i], n), trk(T['y' + i], n)]);
  const quadAtB = (T, n) => [0, 1, 2, 3].map(i => [trk(T['qx' + i], n), trk(T['qy' + i], n)]);
  // the reference's 3D card space (measured): CSS-style perspective P about the frame centre, cards turned rotateY(θ)
  function proj3(X, Y, Z, th, h = CH, P = 1680) {
    const c = Math.cos(th * Math.PI / 180), s = Math.sin(th * Math.PI / 180);
    return [[-CW / 2, -h / 2], [CW / 2, -h / 2], [CW / 2, h / 2], [-CW / 2, h / 2]].map(([ox, oy]) => {
      const x = X + ox * c, z = Z - ox * s, y = Y + oy, f = P / (P - z);
      return [540 + x * f, 304 + y * f];
    });
  }
  const exprAt = (tab, n) => { let e = tab[0][1]; for (const [f, x] of tab) if (n >= f) e = x; return e; };

  // ───────────── kit ─────────────
  // wrap a string into lines no wider than maxW at the given font (fonts are loaded before build)
  const _cv = document.createElement('canvas').getContext('2d');
  function wrap(str, font, maxW, ls = 0) {
    _cv.font = font; const words = str.split(' '); const out = []; let cur = '';
    const wd = s => _cv.measureText(s).width + ls * s.length;
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (wd(t) > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur); return out;
  }
  // a review card (ours): cover on top with the show's name, the quote, a hairline, then the reviewer and the stars.
  // h: card height (the lower block is anchored to the bottom, the cover takes the rest); show: cover title override
  function reviewCard(parent, rv, seed, { h = CH, show = rv.show } = {}) {
    const g = el(parent, 'abs', { left: 0, top: 0, width: CW + 'px', height: h + 'px', transformOrigin: '0 0' });
    const face = el(g, 'abs', { left: 0, top: 0, width: CW + 'px', height: h + 'px', borderRadius: '22px', overflow: 'hidden',
      background: QA ? '#121212' : '#FFFFFF', boxShadow: QA ? 'none' : SHADOW });
    g.face = face; g.h = h;
    if (QA) return g;
    const cv = cover(face, seed, { x: 20, y: 20, w: CW - 40, h: h - 202, r: 14 });
    el(cv, 'abs', { left: 0, top: 0, width: '100%', height: '100%', background: 'linear-gradient(180deg, rgba(10,8,14,.42) 0%, rgba(10,8,14,0) 34%)' });
    text(cv, show, { x: 22, base: 44, size: 24, weight: 700, color: '#FFFFFF', ls: -0.025 });
    const qs = wrap('“' + rv.text + '”', '600 21px Inter', CW - 64, -0.015 * 21);
    qs.slice(0, 2).forEach((str, i) => text(face, str, { x: 30, base: h - 140 + i * 28, size: 21, weight: 600, color: INK, ls: -0.015 }));
    el(face, 'abs', { left: '30px', top: (h - 90) + 'px', width: (CW - 60) + 'px', height: '1px', background: RULE });
    avatar(face, rv.who, { x: 30, y: h - 76, d: 42 });
    text(face, rv.who, { x: 84, base: h - 58, size: 16, weight: 600, color: INK, ls: -0.015 });
    text(face, rv.handle, { x: 84, base: h - 39, size: 13.5, weight: 400, color: INK2, ls: -0.01 });
    stars(face, rv.stars, { x: CW - 30 - 5 * 17 - 4 * 3, y: h - 68, size: 17, gap: 3 });
    return g;
  }
  // floating agent bubble (ours): white pill with a soft shadow, the character on its left, one line. (0,0) = character centre
  function bubble(parent, b, { bodyW = 88, h = 82, size = 29 } = {}) {
    const g = el(parent, 'abs', { left: 0, top: 0, width: 0, height: 0, transformOrigin: '0 0' });
    const pill = el(g, 'abs', { left: P2(bodyW * 0.30), top: P2(-h / 2 + 2), height: P2(h), borderRadius: P2(h / 2), background: '#FFFFFF',
      boxShadow: '0 8px 22px rgba(22,21,27,.16), 0 0 0 1px rgba(22,21,27,.05)', transformOrigin: '0% 50%' });
    const t = text(pill, b.text, { x: bodyW * 0.52, base: h / 2 + size * 0.36, size, weight: 500, color: INK, ls: -0.015 });
    pill.style.width = P2(wOf(t) + bodyW * 0.52 + h * 0.42);
    const m = crew(g, b.agent, 'open', bodyW); placeCrew(m, 0, 0, 'open');
    g.pill = pill; g.m = m; g.t = t;
    return g;
  }

  // ═════════════ w4-review  n510–640 ═════════════
  // n510–554  card 0 (Theo's review) by the measured homography; Scout's bubble drops in at n511 and rides on the card
  // n555–594  the deck: card j (1..20) pops in front every 2 frames (n555 + 2(j−1)); front card = its measured 3D pose,
  //           cards behind = the fitted deck (gap g, spacing λ·D0 along φ, height Yd)
  // n595–640  card 21 (Mara's review) lands (measured quads), the deck collapses onto it n619–623, then it rises (C)
  const H21 = (M.B && M.B.H21) || 527.3;
  const frontIdx = n => n <= 594 ? 1 + Math.floor((n - 555) / 2) : 21;
  scene({
    id: 'w4-review', from: 510, to: 640, z: 40,
    build(S) {
      building(S, () => {
        const R = S.R = {};
        R.world = el(S.cam, 'abs', { left: 0, top: 0, width: '1080px', height: '608px' });
        blurrable(R.world, '-20%', '140%');
        R.cards = [];
        for (let j = 0; j <= 20; j++) {
          const rv = STORY.reviews[(j + 1) % 3];
          const c = reviewCard(R.world, rv, j === 0 ? 1 : 5 + j * 7, { show: j === 0 ? rv.show : STORY.shows[(j + 3) % STORY.shows.length] });
          R.cards.push(c);
        }
        R.card21 = reviewCard(R.world, STORY.reviews[0], 3, { h: H21 });
        R.bubA = bubble(R.cards[0], STORY.bubbles.reviews);
        R.bub21 = bubble(R.card21, STORY.bubbles.reviews);
      });
    },
    seek(n, S) {
      const R = S.R, A = M.A, B = M.B;
      S.op(1); S.camera(0, 0, 1);
      const show = (node, on) => { node.style.display = on ? 'block' : 'none'; };
      R.cards.forEach(c => show(c, false)); show(R.card21, false);
      if (n <= 554.5) {
        show(R.cards[0], true);
        R.cards[0].style.transform = homog(CW, CH, quadAt(A, n));
        show(R.bubA, n >= 510.5);
        R.bubA.style.left = P2(trk(A.bx, n)); R.bubA.style.top = P2(trk(A.by, n));
        placeCrew(R.bubA.m, 0, 0, exprAt(B.expr, n));
        // blur-in (n510–513) + horizontal motion blur as the card swings away (σ ≈ 0.2·v)
        const vx = (trk(A.x0, n + 0.5) - trk(A.x0, n - 0.5) + trk(A.x1, n + 0.5) - trk(A.x1, n - 0.5)) / 2;
        const bi = trk(A.blur, n);
        R.world._blur(Math.hypot(bi, n > 536 ? mbs(vx) : 0), bi);
        return;
      }
      show(R.bubA, false);
      const K = frontIdx(n);
      if (n <= 622.5) {
        const X = trk(B.X, n), Y = trk(B.Y, n), Z = trk(B.Z, n), th = trk(B.th, n);
        const g = trk(B.g, n), lam = trk(B.lam, n), Yd = trk(B.Yd, n), phi = trk(B.phi, n) * Math.PI / 180, thd = trk(B.thd, n);
        const col = trk(B.col, n), ddx = B.D0 * Math.sin(phi), ddz = B.D0 * Math.cos(phi);
        const last = n <= 594.5 ? K - 1 : 20;            // cards behind the front one
        for (let j = 0; j <= last; j++) {
          const m = (n <= 594.5 ? K : 21) - j, a = col * (g + (m - 1) * lam);
          if (col <= 0.001) continue;
          show(R.cards[j], true);
          R.cards[j].style.transform = homog(CW, CH, proj3(X - a * ddx, Yd, Z - a * ddz, thd));
        }
        if (n <= 594.5) { show(R.cards[K], true); R.cards[K].style.transform = homog(CW, CH, proj3(X, Y, Z, th)); }
      }
      if (n >= 594.5) {
        show(R.card21, true);
        R.card21.style.transform = homog(CW, H21, quadAtB(B, n));
        show(R.bub21, n >= 595.5);
        R.bub21.style.left = P2(trk(B.bx, n)); R.bub21.style.top = P2(trk(B.by, n));
        placeCrew(R.bub21.m, 0, 0, exprAt(B.expr, n));
      }
      R.world._blur(trk(B.sx, n), trk(B.sy, n));
    },
  });

  // ═════════════ w4-close  n641–670 ═════════════
  // Mara's card at 2.53× (the reference's close-up scale vs. the face-on card), left edge 136.75, bottom edge 402.3 at rest.
  // Card: enters moving up (×0.7/f decay, sharp), holds, exits left accelerating (×1.4/f, sharp). Critic's bubble is a
  // screen-space overlay: drops in from up-right (n641–653, motion-blurred), then drifts up ~0.9 px/f; it does not leave with the card.
  scene({
    id: 'w4-close', from: 641, to: 670, z: 41,
    build(S) {
      building(S, () => {
        const R = S.R = {};
        R.card = reviewCard(S.cam, STORY.reviews[0], 3, { h: H21 });
        R.bub = bubble(S.cam, STORY.bubbles.tagging);
        blurrable(R.bub, '-60%', '220%');
      });
    },
    seek(n, S) {
      const R = S.R, D = M.D;
      S.op(1); S.camera(0, 0, 1);
      const s = D.scale, x = trk(D.xl, n), yb = trk(D.yb, n);
      R.card.style.transform = `translate(${P2(x)}, ${P2(yb - H21 * s)}) scale(${s})`;
      const bx = trk(D.bx, n), by = trk(D.by, n);
      R.bub.style.transform = `translate(${P2(bx)}, ${P2(by)})`;
      const vx = trk(D.bx, n + 0.5) - trk(D.bx, n - 0.5), vy = trk(D.by, n + 0.5) - trk(D.by, n - 0.5);
      R.bub._blur(mbs(Math.hypot(vx, vy)) * 0.72, mbs(Math.hypot(vx, vy)) * 0.72);
      placeCrew(R.bub.m, 0, 0, exprAt(D.expr, n));
    },
  });

  // ═════════════ w4-thread  n743–845 ═════════════
  // The replies under Mara's review, on our dark surface. The content offset is the measured scroll (frame-to-frame
  // correlation of the panel's row profile): whip-in decaying ×0.7/f, two scroll steps (peaks n765, n783) as replies arrive,
  // then one long expo acceleration into the whip up (n796–845). Vertical motion blur σ = 0.2·|v|. Replies stream in.
  const THREAD = { x: 180, w: 720, bottom: 2839,                    // panel (content coords; screen y = content y + offset)
    names: [581.7, 837.7, 1187.4, 1482, 1782, 2082, 2382, 2662] };  // reply name baselines (first four match the reference's rhythm)
  function streamBlock(parent, str, { x, base, size, lh, maxW, weight = 500, color = DFG, ls = -0.015 }) {
    const lines = wrap(str, `${weight} ${size}px Inter`, maxW, ls * size);
    const chars = [];
    lines.forEach((ln, i) => { const r = charText(parent, ln, { x, base: base + i * lh, size, weight, color, ls }); chars.push(...r.chars); });
    return { chars, lines: lines.length };
  }
  function icon(parent, kind, x, y, s, color) {
    const paths = {
      heart: '<path d="M12 20s-7-4.4-7-9.6A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7 2.4C19 15.6 12 20 12 20z" fill="none" stroke="%c" stroke-width="1.8" stroke-linejoin="round"/>',
      reply: '<path d="M5 12h10a4 4 0 0 1 4 4v2M5 12l5-5M5 12l5 5" fill="none" stroke="%c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      share: '<path d="M12 4v11M7 9l5-5 5 5M5 14v5h14v-5" fill="none" stroke="%c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    };
    return el(parent, 'abs', { left: P2(x), top: P2(y), width: P2(s), height: P2(s) }, `<svg viewBox="0 0 24 24" width="100%" height="100%">${paths[kind].replace(/%c/g, color)}</svg>`);
  }
  scene({
    id: 'w4-thread', from: 743, to: 845, z: 44,
    build(S) {
      building(S, () => {
        const T = S.T = {};
        T.panel = el(S.cam, 'abs', { left: THREAD.x + 'px', top: 0, width: THREAD.w + 'px', height: (THREAD.bottom + 400) + 'px',
          background: DARK, borderRadius: '0 0 30px 30px', boxShadow: '0 18px 50px rgba(20,14,30,.22)', transformOrigin: '0 0' });
        blurrable(T.panel, '-10%', '120%');
        const P = el(T.panel, 'abs', { left: 0, top: '400px', width: '100%', height: '100%' });   // content origin = panel top + 400
        const sc = (THREAD.w - 48) / CW, top = P0 => 520 - H21 * sc;
        const rc = reviewCard(P, STORY.reviews[0], 3, { h: H21 });
        rc.style.transform = `translate(24px, ${P2(520 - H21 * sc)}) scale(${sc})`;
        T.rep = THREAD.names.map((nb, i) => {
          const r = STORY.replies[i % STORY.replies.length];
          const head = el(P, 'abs', { left: 0, top: 0, width: '100%', height: '1px' });
          avatar(head, r.who, { x: 28, y: nb - 27, d: 46 });
          text(head, r.who, { x: 90, base: nb, size: 20, weight: 600, color: DFG, ls: -0.015 });
          el(head, 'abs', { left: '50px', top: P2(nb + 26), width: '2px', height: '120px', borderRadius: '1px', background: '#2C2833' });
          const body = streamBlock(P, r.text, { x: 90, base: nb + 46, size: 31, lh: 40, maxW: THREAD.w - 90 - 50, weight: 500 });
          const yAct = nb + 46 + (body.lines - 1) * 40 + 30;
          const act = el(P, 'abs', { left: 0, top: 0, width: '100%', height: '1px' });
          icon(act, 'heart', 90, yAct, 24, DMU); icon(act, 'reply', 152, yAct, 24, DMU); icon(act, 'share', 214, yAct, 24, DMU);
          if (i < THREAD.names.length - 1) el(P, 'abs', { left: '24px', top: P2((nb + THREAD.names[i + 1]) / 2 + 40), width: (THREAD.w - 48) + 'px', height: '1px', background: '#2C2833' });
          return { head, act, chars: body.chars };
        });
      });
    },
    seek(n, S) {
      const T = S.T, E = M.E;
      S.op(1); S.camera(0, 0, 1);
      const off = trk(E.off, n);
      T.panel.style.transform = `translate(0px, ${P2(off - 400)})`;
      T.panel._blur(0, mbs(trk(E.off, n + 0.5) - trk(E.off, n - 0.5)));
      // reply arrivals: header fades in over 3 f, the text streams (soft 9-char tail) between the measured frames
      E.rep.forEach(([h0, s0, s1], i) => {
        const R = T.rep[i]; if (!R) return;
        const a = clamp((n - h0) / 3);
        R.head.style.opacity = a.toFixed(3); R.act.style.opacity = clamp((n - s1 + 2) / 4).toFixed(3);
        stream(R.chars, clamp((n - s0) / (s1 - s0)));
      });
    },
  });

  // ───────────── show tiles (wall + featured card): our dark surface, a show's cover, its name and its rating ─────────────
  function showTile(parent, name, seed, { x = 0, y = 0, w = 223, h = 202, quote = null } = {}) {
    const k = w / 223;
    const t = el(parent, 'abs', { left: P2(x), top: P2(y), width: P2(w), height: P2(h), borderRadius: P2(16 * k), background: DARK2,
      boxShadow: '0 6px 18px rgba(20,14,30,.16)', overflow: 'hidden' });
    if (QA) { t.style.background = '#121212'; return t; }
    const pad = 9 * k, ch = quote ? h * 0.54 : h * 0.6;
    cover(t, seed, { x: pad, y: pad, w: w - 2 * pad, h: ch, r: 10 * k });
    const tb = pad + ch + 23 * k;
    text(t, name, { x: 12 * k, base: tb, size: 15 * k, weight: 650, color: DFG, ls: -0.02 });
    stars(t, 4 + (seed % 2), { x: 12 * k, y: tb + 9 * k, size: 10 * k, gap: 2 * k, color: '#FFB020', off: '#4A4552' });
    if (quote) {
      const ls = wrap('“' + quote + '”', `500 ${12 * k}px Inter`, w - 24 * k, -0.01 * 12 * k).slice(0, 2);
      ls.forEach((str, i) => text(t, str, { x: 12 * k, base: tb + 42 * k + i * 16 * k, size: 12 * k, weight: 500, color: DMU, ls: -0.01 }));
    }
    return t;
  }

  // ═════════════ w4-wall  n842–921 ═════════════
  // A wall of show tiles (covers for STORY.shows). Camera = the measured similarity (relative to key n880): two zoom-out
  // steps (n858–872, n886–896), a slow drift, then an accelerating drop into the cut. The tiles fly up into their slots on entry
  // (n842–851): centre column first, then right, then left; middle row first, the row above a few frames later.
  scene({
    id: 'w4-wall', from: 842, to: 921, z: 43,
    build(S) {
      building(S, () => {
        const W_ = S.W = { tiles: [] }, Gd = M.F.grid;
        W_.layer = el(S.cam, 'abs', { left: 0, top: 0, width: '1px', height: '1px' });
        let i = 0;
        for (let j = -2; j <= 3; j++) for (let k = -2; k <= 5; k++) {
          const hsh = ((k + 7) * 73 + (j + 5) * 151) % 997, nm = STORY.shows[hsh % STORY.shows.length];
          const t = showTile(W_.layer, nm, 40 + (hsh % 89), { x: Gd.x0 + Gd.px * k, y: Gd.y0 + Gd.py * j, w: Gd.w, h: Gd.h });
          blurrable(t, '-30%', '160%');
          const colD = { 1: 0, 2: 1, 0: 2 }[k] ?? 2;
          W_.tiles.push({ t, k, j, d: colD, pop: j < 0 ? 847 + colD + (j < -1 ? 1 : 0) : null });
          i++;
        }
      });
    },
    seek(n, S) {
      const W_ = S.W, F = M.F;
      S.op(1);
      const s = trk(F.s, n), tx = trk(F.tx, n), ty = trk(F.ty, n);
      S.camera(tx, ty, s, 0, 0);
      S.blur(trk(F.bx, n), trk(F.by, n));
      for (const T of W_.tiles) {
        if (T.pop !== null) { T.t.style.display = n >= T.pop ? 'block' : 'none'; T.t.style.transform = 'none'; T.t._blur(0, 0); continue; }
        const t = n - (F.t0 + T.d);
        if (t < 0) { T.t.style.display = 'none'; continue; }
        T.t.style.display = 'block';
        const e = F.entry, i0 = Math.min(Math.floor(t), e.length - 1), f = t - i0;
        const off = i0 >= e.length - 1 ? 0 : lerp(e[i0], e[i0 + 1], f);
        const v = i0 + 1 < e.length ? e[i0] - e[i0 + 1] : 0;
        T.t.style.transform = off ? `translate(0px, ${P2(off / s)})` : 'none';
        T.t._blur(0, off ? mbs(v) / s : 0);
      }
    },
  });

  // ═════════════ w4-feature  n922–970 ═════════════
  // One show tile up close. It arrives in a column moving down (the tile below it passes out of frame first), decelerating
  // ×0.77/f into place (n946), holds, then slides left accelerating into the cut (W3's insights start at n971).
  scene({
    id: 'w4-feature', from: 922, to: 970, z: 45,
    build(S) {
      building(S, () => {
        const G = M.G, [x, y, w, h] = G.rest, rv = STORY.reviews[0];
        S.F = el(S.cam, 'abs', { left: 0, top: 0, width: '1px', height: '1px' });
        showTile(S.F, rv.show, 3, { x, y, w, h, quote: rv.text });
        showTile(S.F, STORY.shows[6], 61, { x, y: y + G.pitch, w, h, quote: STORY.reviews[2].text });
        showTile(S.F, STORY.shows[9], 77, { x, y: y - G.pitch, w, h, quote: STORY.reviews[1].text });
      });
    },
    seek(n, S) {
      const G = M.G;
      S.op(1); S.camera(0, 0, 1);
      S.F.style.transform = `translate(${P2(trk(G.dx, n))}, ${P2(trk(G.dy, n))})`;
      S.blur(n >= 948 ? trk(G.sx, n) : 0, trk(G.sy, n));
    },
  });

  window.W4 = { homog, reviewCard, bubble, wrap };
})();
