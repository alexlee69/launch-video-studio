'use strict';
// W3 — the chat shots. Motion = measured on the reference (motion/w3.js); everything visible is ours (story.js, lib/cast.js).
//   w3-open      n264–311  chat opens: blur-in, the agent row arrives, status chip fills, drift → momentum cut right
//   w3-window    n312–357  the app window: momentum cut in, chrome builds, pan reveals the crew sidebar, tilt down
//   w3-roster    n357–464  the crew roster behind a fixed highlight card (one 50 % dissolve frame at n357)
//   w3-chat2     n465–509  second chat: Critic slides in, the chat scrolls, its reply streams
//   w3-research  n671–718  research close-up: headline, sub line and working steps stream in
//   w3-bigtype   n719–742  big-type close-up: lines push in, ending on "Here’s the pattern."
//   w3-insights  n971–1001 insights chat, then the whip up (W5 takes over at n1001)
(() => {
  const M = window.MW3;
  const INK = '#16151B', INK2 = '#6E6B73', INK3 = '#A29FA8', RULE = '#E6E2DC', PAPER = '#F5F3EF', BODYC = '#3A3840';
  const DESK = '#EAE6DF';
  const SHADOW = '0 10px 30px rgba(22,21,27,.10), 0 0 0 1px rgba(22,21,27,.06)';
  const C_ = id => STORY.crew.find(c => c.id === id);
  const chipBg = tint => mixHex(tint, '#FFFFFF', 0.86);
  const chipFg = tint => mixHex(tint, '#16151B', 0.36);
  const pale = (tint, bg) => mixHex(tint, bg, 0.38);
  const P2 = v => (+v).toFixed(2) + 'px';

  // ───────────── kit ─────────────
  // build-time measuring: scene roots are display:none while they build, so show them for the duration of build()
  const building = (S, fn) => { S.root.style.display = 'block'; try { fn(); } finally { S.root.style.display = 'none'; } };
  const wOf = node => node.getBoundingClientRect().width;
  // the user's message: a dark ink pill, right-aligned at `right`
  function userPill(parent, { right, top, h, size, padX, str = STORY.prompt }) {
    const box = el(parent, 'abs', { top: P2(top), height: P2(h), borderRadius: P2(h / 2), background: INK });
    const t = text(box, str, { x: padX, base: h / 2 + size * 0.36, size, weight: 500, color: '#FFFFFF', ls: -0.012 });
    const w = wOf(t) + 2 * padX; box.style.width = P2(w); box.style.left = P2(right - w);
    return { box, t, w };
  }
  // status chip: rounded pill tinted with the agent colour (~14 %), label in a darker shade; label is wipe-maskable
  function chip(parent, { x, cy, h, size, padX, label, tint }) {
    const box = el(parent, 'abs', { left: P2(x), top: P2(cy - h / 2), height: P2(h), borderRadius: P2(h / 2), background: chipBg(tint), transformOrigin: '0% 50%' });
    const t = text(box, label, { x: padX, base: h / 2 + size * 0.36, size, weight: 600, color: chipFg(tint), ls: -0.005 });
    const w = wOf(t) + 2 * padX; box.style.width = P2(w);
    return { box, t, w };
  }
  // agent head: character + name (600) + status chip on one line; returns parts
  function agentHead(parent, { id, cx, cy, bodyW, x, base, nameSize, chipSize, chipH, chipPad, gap, status, expr = 'open', nameColor = INK }) {
    const c = C_(id);
    const m = crew(parent, id, expr, bodyW); placeCrew(m, cx, cy, expr);
    const nm = text(parent, c.name, { x, base, size: nameSize, weight: 600, color: nameColor, ls: -0.015 });
    const ch = chip(parent, { x: x + wOf(nm) + gap, cy: base - nameSize * 0.36, h: chipH, size: chipSize, padX: chipPad, label: status, tint: c.tint });
    return { m, nm, ch, c };
  }
  const lines = (parent, ls, { x, base, size, lh, color = BODYC, weight = 400 }) =>
    ls.map((s, i) => text(parent, s, { x, base: base + i * lh, size, weight, color, ls: -0.01 }));
  // per-character text for streaming (one span per char), several lines sharing one stream
  function streamLines(parent, ls, { x, base, size, lh, color = BODYC, weight = 400, ls: tr = -0.01 }) {
    const chars = []; const nodes = [];
    ls.forEach((s, i) => { const r = charText(parent, s, { x, base: base + i * lh, size, weight, color, ls: tr }); chars.push(...r.chars); nodes.push(r.node); });
    return { chars, nodes };
  }
  const op = (node, v) => { node.style.opacity = (+v).toFixed(3); };
  const tr = (node, x, y) => { node.style.transform = `translate(${(+x).toFixed(3)}px, ${(+y).toFixed(3)}px)`; };
  // per-character reveal measured on the reference: char i starts at t0 + i/rate and ramps E(u) = 1-(1-u)^k over D frames.
  // When the reference line's length (nRef) is known, the rate is rescaled so our line starts and finishes on its frames.
  const rateFor = (N, rate, nRef) => (nRef && N > 1 ? rate * (N - 1) / (nRef - 1) : rate);
  function reveal(chars, n, { t0, rate, D, k, n: nRef }) {
    const r = rateFor(chars.length, rate, nRef);
    for (let i = 0; i < chars.length; i++) {
      const u = clamp((n - t0 - i / r) / D);
      chars[i].style.opacity = (1 - Math.pow(1 - u, k)).toFixed(3);
    }
  }
  // soft wipe driven by the measured ink fraction f of the finished label: invert wipe()'s covered fraction
  function wipeCover(p, e) {
    const a = p * (1 + e) - e, b = p * (1 + e); let s = 0;
    for (let i = 0; i < 64; i++) { const x = (i + 0.5) / 64; s += x < a ? 1 : x > b ? 0 : (b - x) / (b - a); }
    return s / 64;
  }
  function wipeFrac(node, f, e = 0.4) {
    if (f >= 0.999) { wipe(node, 1, e); return; }
    if (f <= 0.001) { wipe(node, 0, e); return; }
    let lo = 0, hi = 1;
    for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (wipeCover(mid, e) < f) lo = mid; else hi = mid; }
    wipe(node, (lo + hi) / 2, e);
  }

  // ═════════════════════════════ w3-open (n264–311) ═════════════════════════════
  // A close-up of the chat pane. Hard cut at n264 with a blur-in while the camera is still rising; the reply rises into
  // place, the name glides in and darkens, the status chip appears and its label fills slowly; then the camera
  // accelerates right into the momentum cut.
  scene({
    id: 'w3-open', from: 264, to: 311, z: 30,
    build(S) {
      building(S, () => {
        S.root.style.background = '#FFFFFF';
        const c = S.cam, A = S.A = {};
        A.pill = userPill(c, { right: 952, top: 128, h: 62, size: 20.5, padX: 28 });
        A.row = el(c, 'abs', { left: 0, top: 0 });
        A.head = agentHead(A.row, { id: 'scout', cx: 286, cy: 314, bodyW: 56, x: 330, base: 311, nameSize: 21, chipSize: 14.5, chipH: 27, chipPad: 11, gap: 12,
          status: STORY.chat.scout1.status, expr: 'dots' });
        c.appendChild(A.head.m);
        A.reply = el(c, 'abs', { left: 0, top: 0 });
        lines(A.reply, STORY.chat.scout1.reply, { x: 330, base: 352, size: 20.5, lh: 28 });
      });
    },
    seek(n, S) {
      const A = S.A, m = M.A0;
      const early = n < 299.5;
      S.camera(early ? trk(m.tx, n) : trk(M.A.tx, n), early ? trk(m.ty, n) : 0);
      S.blur(early ? trk(m.bx, n) : trk(M.A.bx, n), early ? trk(m.by, n) : trk(M.A.by, n));
      op(A.reply, trk(m.replyOp, n)); tr(A.reply, 0, trk(m.replyRise, n));
      tr(A.row, trk(m.nameGlide, n), 0);
      A.head.nm.style.color = mix('#FFFFFF', INK, trk(m.nameInk, n));
      const cp = trk(m.chipPop, n);
      op(A.head.ch.box, cp);
      A.head.ch.box.style.transform = `scale(${(0.86 + 0.14 * cp).toFixed(4)})`;
      wipeFrac(A.head.ch.t, trk(m.statusFrac, n), 0.4);
    },
  });

  // ═════════════════════════════ w3-window (n312–357) ═════════════════════════════
  scene({
    id: 'w3-window', from: 312, to: 357, z: 31,
    build(S) {
      building(S, () => {
        const c = S.cam, B = S.B = {};
        S.root.style.background = DESK;
        // the white wash: at the cut only the chat reads (as in the close-up); the window around it builds in n312–316
        B.win = el(c, 'abs', { left: '34px', top: '24px', width: '1012px', height: '560px', borderRadius: '22px', background: '#FFFFFF', boxShadow: SHADOW });
        B.sideBg = el(c, 'abs', { left: '34px', top: '24px', width: '314px', height: '560px', borderRadius: '22px 0 0 22px', background: PAPER });
        B.wash = el(S.root, 'abs', { left: 0, top: 0, width: '1480px', height: '1008px', background: '#FFFFFF' });
        S.root.insertBefore(B.wash, S.cam);
        B.chrome = el(c, 'abs', { left: 0, top: 0 });
        el(B.chrome, 'abs', { left: '348px', top: '24px', width: '1px', height: '560px', background: RULE });
        el(B.chrome, 'abs', { left: '349px', top: '100px', width: '697px', height: '1px', background: RULE });
        B.hm = crew(B.chrome, 'scout', 'happy', 34); placeCrew(B.hm, 392, 63, 'happy');
        text(B.chrome, C_('scout').name, { x: 420, base: 61, size: 16, weight: 600, color: INK, ls: -0.015 });
        text(B.chrome, C_('scout').role + '.', { x: 420, base: 79, size: 12.5, color: INK2 });
        // who else is on call: three small crew faces, overlapping, at the header's right
        ['critic', 'analyst', 'builder'].forEach((id, i) => {
          el(B.chrome, 'abs', { left: P2(958 + i * 21 - 15), top: P2(63 - 15), width: '30px', height: '30px', borderRadius: '50%', background: PAPER, boxShadow: '0 0 0 2px #FFFFFF' });
          const f = crew(B.chrome, id, 'open', 20); placeCrew(f, 958 + i * 21, 64, 'open');
        });
        // sidebar: title, search, the skeleton slot the first agent drops into
        B.side = el(c, 'abs', { left: 0, top: 0 });
        text(B.side, STORY.brand.name, { x: 62, base: 69, size: 15, weight: 600, color: INK, ls: -0.015 });
        text(B.side, STORY.brand.tagline, { x: 62, base: 85, size: 11.5, color: INK3 });
        searchIcon(B.side, 308, 55, 17, INK3, 2.1);
        blurrable(B.side, '-30%', '160%');
        B.slot = el(c, 'abs', { left: '56px', top: '104px', width: '268px', height: '62px', borderRadius: '15px', background: '#FFFFFF', boxShadow: SHADOW, overflow: 'hidden' });
        blurrable(B.slot, '-30%', '160%');
        B.peek = crew(B.slot, 'scout', 'happy', 46);
        // the chat (carries over from the close-up)
        userPill(c, { right: 1014, top: 124, h: 42, size: 14, padX: 19 });
        agentHead(c, { id: 'scout', cx: 392, cy: 214, bodyW: 30, x: 420, base: 219, nameSize: 14, chipSize: 10, chipH: 19, chipPad: 8, gap: 8,
          status: STORY.chat.scout1.status, expr: 'dots' });
        lines(c, STORY.chat.scout1.reply, { x: 420, base: 245, size: 13.6, lh: 19 });
        // input bar
        B.bar = el(c, 'abs', { left: '380px', top: '506px', width: '634px', height: '46px', borderRadius: '23px', background: '#FFFFFF', boxShadow: 'inset 0 0 0 1.2px ' + RULE + ', 0 4px 14px rgba(22,21,27,.05)' });
        B.plus = el(B.bar, 'abs', { left: '11px', top: '11.5px', width: '23px', height: '23px', borderRadius: '12px', background: PAPER });
        B.plusG = el(B.plus, 'abs', { left: 0, top: 0, width: '23px', height: '23px' },
          `<svg viewBox="0 0 23 23" width="23" height="23"><path d="M11.5 7 V16 M7 11.5 H16" stroke="${INK2}" stroke-width="1.5" stroke-linecap="round"/></svg>`);
        B.place = text(B.bar, STORY.promptPlaceholder, { x: 46, base: 27.8, size: 13.4, color: INK3 });
        B.send = el(B.bar, 'abs', { left: '596px', top: '7px', width: '32px', height: '32px', borderRadius: '16px', background: INK });
        B.sendG = el(B.send, 'abs', { left: 0, top: 0, width: '32px', height: '32px' },
          `<svg viewBox="0 0 32 32" width="32" height="32"><path d="M16 22 V10.5 M11 15.2 L16 10.2 L21 15.2" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
      });
    },
    seek(n, S) {
      const B = S.B, b = M.B;
      S.camera(trk(b.tx, n), trk(b.ty, n));
      S.blur(trk(b.bx, n), trk(b.by, n));
      const ch = trk(b.chromeOp, n);
      op(B.wash, 1 - ch); op(B.chrome, ch); op(B.sideBg, ch); op(B.win, ch);
      op(B.side, trk(b.sideOp, n)); B.side._blur(trk(b.sideBlur, n), trk(b.sideBlur, n));
      op(B.slot, trk(b.slotOp, n)); B.slot._blur(trk(b.slotBlur, n), trk(b.slotBlur, n));
      op(B.bar, trk(b.barOp, n));
      const s = trk(b.sendScale, n); B.send.style.transform = `scale(${s.toFixed(4)})`; op(B.send, s > 0.01 ? 1 : 0);
      wipe(B.place, trk(b.placeWipe, n), 0.4); op(B.place, trk(b.placeOp, n));
      op(B.plus, trk(b.plusOp, n)); op(B.plusG, trk(b.glyphOp, n)); op(B.sendG, trk(b.glyphOp, n));
      // the first agent peeks into the skeleton slot, clipped by its top edge (slot is 62 tall here; reference 60)
      placeCrew(B.peek, 50, trk(b.peekY, n) * 62 / 60, 'happy');
    },
  });

  // ═════════════════════════════ w3-roster (n357–464) ═════════════════════════════
  const PITCH = 174, SLOT_X = 156, SLOT_W = 768, SLOT_H = 159, SLOT_R = 28;
  const NAME_X = 330, NAME_B = 32, ROLE_B = 70, M_DY = 40, M_REST_X = 246, M_W = 104;
  const REF_REST_X = 266, REF_M_DY = 47;                   // where the reference's drop/fly paths settle (to re-base them)
  const REVEAL = [378, 398, 412, 428, 433, 441];            // name reveal start per row (measured)
  const LAND = [null, 397, 411, 427, 434, 438];             // fly-in landing frame per row (measured)
  function exprC(k, n) {
    if (k === 0) return n < 379 ? 'happy' : n < 388 ? 'blink' : n < 398 ? 'open' : 'happy';
    if (k === 1) return n < 408 ? 'happy' : n < 424 ? 'open' : 'dots';
    if (k === 2) return n < 425 ? 'open' : 'happy';
    if (k === 3) return n < 437 ? 'happy' : 'dots';
    if (k === 4) return n < 446 ? 'happy' : 'dots';
    return n < 445 ? 'dots' : n < 454 ? 'blink' : n < 464 ? 'open' : 'happy';
  }
  scene({
    id: 'w3-roster', from: 357, to: 464, z: 32,
    build(S) {
      building(S, () => {
        const c = S.cam, R = S.R = { rows: [], m: [] };
        S.root.style.background = PAPER;
        R.slot = el(c, 'abs', { left: P2(SLOT_X), top: 0, width: P2(SLOT_W), height: P2(SLOT_H), borderRadius: P2(SLOT_R), background: '#FFFFFF',
          boxShadow: '0 14px 34px rgba(22,21,27,.10), 0 0 0 1px rgba(22,21,27,.06)' });
        R.list = el(c, 'abs', { left: 0, top: 0 });
        blurrable(R.list, '-10%', '120%');
        const hd = text(R.list, STORY.brand.name, { x: 160, base: -118, size: 34, weight: 600, color: INK, ls: -0.02 });
        text(R.list, STORY.brand.tagline, { x: 160 + wOf(hd) + 14, base: -118, size: 22, color: INK3, ls: -0.01 });
        searchIcon(R.list, 876, -150, 40, INK3, 2.0);
        STORY.crew.forEach((r, k) => {
          const g = el(R.list, 'abs', { left: 0, top: (k * PITCH) + 'px' });
          const ti = text(g, r.name, { x: NAME_X, base: NAME_B, size: 44, weight: 600, color: INK, ls: -0.022 });
          const su = text(g, r.role, { x: NAME_X, base: ROLE_B, size: 27, color: INK2, ls: -0.012 });
          blurrable(ti, '-20%', '140%'); blurrable(su, '-20%', '140%');
          R.rows.push({ g, ti, su, r });
        });
        R.view = el(R.list, 'abs', { left: 0, top: (6 * PITCH) + 'px' });
        R.viewT = text(R.view, STORY.crewMore, { x: 262, base: 45, size: 40, weight: 500, color: INK2, ls: -0.018 });
        blurrable(R.viewT, '-20%', '140%');
        // a 2×2 grid of crew-coloured dots builds one at a time (bottom-left, bottom-right, top-right, top-left)
        const dotC = ['scout', 'critic', 'builder', 'writer'].map(id => C_(id).tint);
        R.sq = [[0, 1], [1, 1], [1, 0], [0, 0]].map(([i, j], q) =>
          el(R.view, 'abs', { left: (196 + i * 24) + 'px', top: (8 + j * 24) + 'px', width: '19px', height: '19px', borderRadius: '50%', background: dotC[q], transformOrigin: '50% 50%' }));
        R.mlayer = el(c, 'abs', { left: 0, top: 0 });
        STORY.crew.forEach(r => { const m = crew(R.mlayer, r.id, 'happy', M_W); blurrable(m, '-80%', '260%'); R.m.push(m); });
      });
    },
    seek(n, S) {
      const R = S.R, c = M.C;
      op(S.root, trk(M.cOp, n));
      const P = trk(c.P, n);
      const L = n < 385.5 ? P + trk(c.LminusP, n) : trk(c.L, n);
      const vL = n < 385.5 ? vel(c.P, n) + vel(c.LminusP, n) : vel(c.L, n);
      S.blur(trk(c.bx, n), trk(c.by, n));
      R.slot.style.top = P2(P);
      R.list.style.transform = `translateY(${L.toFixed(3)}px)`;
      const lb = Math.max(0, Math.abs(vL) * 0.22 - 0.4);      // list motion blur (measured 0.22 × speed beyond the slot's)
      R.list._blur(lb * 0.08, lb);
      const slotRest = P + 39.9;
      R.rows.forEach((row, k) => {
        const top = L + k * PITCH, t0 = REVEAL[k], u = n - t0;
        const vis = n >= t0 - 0.5;
        row.g.style.display = vis ? 'block' : 'none';
        if (!vis) return;
        const dim = clamp((slotRest - top) / PITCH);           // rows above the slot settle a step dimmer
        const tint = 1 - smooth(clamp((u - 0.8) / 5.2));
        const pl = pale(row.r.tint, PAPER);
        const nameC = mixHex(INK, '#8F8B95', dim);
        row.ti.style.color = tint > 0.01 ? mix(pl, nameC, 1 - tint) : nameC;
        row.su.style.color = tint > 0.01 ? mix(pl, INK2, 1 - tint * 0.75) : mixHex(INK2, '#A9A5AE', dim);
        wipe(row.ti, easeOut((u + 0.5) / 3.2), 0.45); wipe(row.su, easeOut((u - 0.5) / 3.6), 0.45);
        const bl = 2.6 * (1 - easeOut(u / 4.5));
        row.ti._blur(bl, bl * 0.6); row.su._blur(bl, bl * 0.6);
        row.g.style.transform = `translateX(${(-14 * (1 - easeOut(u / 22))).toFixed(3)}px)`;
        op(row.ti, 0.35 + 0.65 * easeOut((u + 0.5) / 6)); op(row.su, 0.25 + 0.75 * easeOut((u - 0.5) / 6.5));
      });
      { // see the whole crew
        const u = n - 447, vis = u > -0.5;
        R.view.style.display = vis ? 'block' : 'none';
        if (vis) {
          wipe(R.viewT, clamp((u - 0.5) / 3.5), 0.5); R.viewT._blur(2.6 * (1 - easeOut(u / 5)), 1.6 * (1 - easeOut(u / 5)));
          op(R.viewT, 0.3 + 0.7 * easeOut(u / 7));
          [449, 451, 453, 455].forEach((t, i) => {
            const p = clamp((n - t + 0.5) / 2);
            R.sq[i].style.transform = `scale(${popScale(p).toFixed(3)})`; op(R.sq[i], p > 0 ? 1 : 0);
          });
        }
      }
      R.m.forEach((m, k) => {
        let x, y, vx = 0, vy; const ex = exprC(k, n);
        if (k === 0 && n < 378.5) {
          x = trk(c.dropX, n) + (M_REST_X - REF_REST_X); y = trk(c.dropY, n) + (M_DY - REF_M_DY);
          vx = vel(c.dropX, n); vy = vel(c.dropY, n);
          const top = P - (y - m._box * 62 / 110), left = SLOT_X - (x - m._box * 55 / 110);
          m.style.clipPath = n < 362 ? `inset(${Math.max(0, top).toFixed(2)}px 0 0 ${Math.max(-50, left).toFixed(2)}px round ${SLOT_R}px ${SLOT_R}px 0 0)` : 'none';
        } else {
          const rowY = L + k * PITCH + M_DY;
          y = rowY; vy = vL;
          if (k === 0) {
            const hand = clamp((n - 378.5) / 6), yDrop = trk(c.dropY, 378) + (M_DY - REF_M_DY) + (P - trk(c.P, 378));
            y = lerp(yDrop, rowY, easeOut(hand)); x = lerp(266.5 + (M_REST_X - REF_REST_X), M_REST_X + 2, easeOut(hand));
          } else {
            const rel = n - LAND[k];
            if (rel < -4.5) { m.style.display = 'none'; return; }
            x = M_REST_X + trk(c.flyIn, rel); vx = trk(c.flyIn, rel + 0.5) - trk(c.flyIn, rel - 0.5);
          }
          m.style.clipPath = 'none';
        }
        m.style.display = 'block';
        placeCrew(m, x, y, ex);
        m._blur(Math.abs(vx) * 0.22, Math.max(0, Math.abs(vy) * 0.22 - 0.4));
      });
    },
  });

  // ═════════════════════════════ w3-chat2 (n465–509) ═════════════════════════════
  const D_REST = 150, D_REF_REST = 111.6, D_K = D_REST / D_REF_REST;   // Critic's slide is re-based so it still enters from the frame edge
  scene({
    id: 'w3-chat2', from: 465, to: 509, z: 33,
    build(S) {
      building(S, () => {
        const c = S.cam, D = S.D = {};
        S.root.style.background = '#FFFFFF';
        userPill(c, { right: 1112, top: 112, h: 84, size: 28, padX: 38 });
        D.a1 = agentHead(c, { id: 'scout', cx: D_REST, cy: 330, bodyW: 64, x: 206, base: 338, nameSize: 30, chipSize: 20, chipH: 37, chipPad: 15, gap: 14,
          status: STORY.chat.scout2.status, expr: 'dots' });
        lines(c, STORY.chat.scout2.reply, { x: 206, base: 394, size: 27, lh: 37 });
        D.row2 = el(c, 'abs', { left: 0, top: 0 });
        D.a2 = agentHead(D.row2, { id: 'critic', cx: -200, cy: 560, bodyW: 64, x: 206, base: 568, nameSize: 30, chipSize: 20, chipH: 37, chipPad: 15, gap: 14,
          status: STORY.chat.critic1.status, expr: 'dots' });
        D.m2 = D.a2.m; c.appendChild(D.m2); blurrable(D.m2, '-80%', '260%');
        D.st = streamLines(c, STORY.chat.critic1.reply, { x: 206, base: 624, size: 27, lh: 37 });
      });
    },
    seek(n, S) {
      const D = S.D, d = M.D;
      S.camera(0, trk(d.ty, n));
      S.blur(trk(d.bx, n), trk(d.by, n));
      placeCrew(D.a1.m, D_REST, 330, n < 490 ? 'dots' : n < 506 ? 'happy' : 'open');
      wipe(D.a1.ch.t, trk(d.statusWipe, n), 0.4);
      op(D.row2, trk(d.rowOp, n)); wipe(D.a2.ch.t, trk(d.status2Wipe, n), 0.4);
      const ax = D_REST + (trk(d.agent2X, n) - D_REF_REST) * D_K, avx = vel(d.agent2X, n) * D_K;
      D.m2.style.display = n < 484.5 ? 'none' : 'block';
      placeCrew(D.m2, ax, 560, 'dots'); D.m2._blur(Math.abs(avx) * 0.22, 0);
      reveal(D.st.chars, n, d.reveal);
    },
  });

  // ═════════════════════════════ w3-research (n671–718) ═════════════════════════════
  // Scout at work: the character pops in, the text column rises into place, the headline and sub line stream in and the
  // working steps fill a quiet card one by one; then the camera accelerates up into the momentum cut to the big type.
  const RS = STORY.chat.research;
  scene({
    id: 'w3-research', from: 671, to: 718, z: 34,
    build(S) {
      building(S, () => {
        const c = S.cam, Q = S.Q = {};
        S.root.style.background = PAPER;
        Q.col = el(c, 'abs', { left: 0, top: 0 });
        Q.head = agentHead(Q.col, { id: RS.agent, cx: 0, cy: 0, bodyW: 62, x: 246, base: 158, nameSize: 22, chipSize: 15, chipH: 28, chipPad: 11, gap: 12,
          status: RS.status, expr: 'dots' });
        Q.m = Q.head.m; c.appendChild(Q.m); Q.m.style.transformOrigin = '50% 56%';
        blurrable(Q.head.nm, '-20%', '140%');
        Q.h = streamLines(Q.col, [RS.head], { x: 246, base: 226, size: 39, lh: 0, color: INK, weight: 600, ls: -0.026 });
        Q.s = streamLines(Q.col, [RS.sub], { x: 246, base: 270, size: 22, lh: 0, color: INK2 });
        Q.card = el(Q.col, 'abs', { left: '246px', top: '300px', width: '560px', height: '186px', borderRadius: '22px', background: '#FFFFFF', boxShadow: SHADOW });
        const tint = C_(RS.agent).tint;
        Q.steps = RS.steps.map((s, i) => {
          const base = 351 + i * 53;
          const dot = el(Q.col, 'abs', { left: '275px', top: P2(base - 13.5), width: '10px', height: '10px', borderRadius: '50%', background: mixHex(tint, '#FFFFFF', 0.35) });
          const st = streamLines(Q.col, [s], { x: 301, base, size: 22, lh: 0, color: BODYC });
          return { dot, st };
        });
      });
    },
    seek(n, S) {
      const Q = S.Q, r = M.R;
      S.camera(trk(r.tx, n), trk(r.ty, n));
      S.blur(trk(r.bx, n), trk(r.by, n));
      tr(Q.col, 0, trk(r.textRise, n));
      const pop = trk(r.pop, n);
      placeCrew(Q.m, 202, 150, 'dots'); Q.m.style.transform = `scale(${pop.toFixed(4)})`; op(Q.m, pop > 0.001 ? 1 : 0);
      Q.head.nm.style.color = mix(PAPER, INK, trk(r.nameInk, n)); Q.head.nm._blur(trk(r.nameBlur, n), trk(r.nameBlur, n));
      op(Q.head.ch.box, trk(r.chipOp, n));
      const f = trk(r.statusFrac, n);
      wipeFrac(Q.head.ch.t, f, 0.6); op(Q.head.ch.t, clamp(trk(r.statusInk, n) / Math.max(f, 0.05)));
      reveal(Q.h.chars, n, r.head); reveal(Q.s.chars, n, r.sub);
      op(Q.card, easeOut(clamp((n - r.steps[0].t0 - 0.5) / 5)));   // the card arrives with the first step
      Q.steps.forEach((s, i) => { reveal(s.st.chars, n, r.steps[i]); op(s.dot, clamp((n - r.steps[i].t0 - 1.5) / 4)); });
    },
  });

  // ═════════════════════════════ w3-bigtype (n719–742) ═════════════════════════════
  // Very close on the work log: the two running steps (older one fading) and the new line pushing in from below
  // as it streams, with Scout beside it; then the camera accelerates up into the cut.
  const BT = STORY.chat.bigType;
  scene({
    id: 'w3-bigtype', from: 719, to: 742, z: 35,
    build(S) {
      building(S, () => {
        const c = S.cam, G = S.G = {};
        S.root.style.background = PAPER;
        const tint = C_('scout').tint;
        G.up = el(c, 'abs', { left: 0, top: 0 });
        G.l0 = text(G.up, BT[0], { x: 214, base: 96, size: 66, weight: 500, color: INK, ls: -0.032 });
        G.l1 = text(G.up, BT[1], { x: 214, base: 214, size: 66, weight: 500, color: INK, ls: -0.032 });
        G.d0 = el(G.up, 'abs', { left: '170px', top: '64px', width: '16px', height: '16px', borderRadius: '50%', background: mixHex(tint, PAPER, 0.4) });
        G.d1 = el(G.up, 'abs', { left: '170px', top: '182px', width: '16px', height: '16px', borderRadius: '50%', background: mixHex(tint, PAPER, 0.4) });
        G.line = el(c, 'abs', { left: 0, top: 0 });
        blurrable(G.line, '-10%', '120%');
        G.st = streamLines(G.line, [BT[2]], { x: 214, base: 362, size: 70, lh: 0, color: INK, weight: 600, ls: -0.036 });
        // Scout sits at the end of the new line: shrink the line (keeping its baseline) if the copy would push Scout off frame
        let size = 70, w = wOf(G.st.nodes[0]);
        while (214 + w + 78 + 52 > 1056 && size > 50) {
          size -= 2; const t = G.st.nodes[0]; t.style.font = `600 ${size}px/1 Inter`; t.style.top = (362 - 0.86 * size) + 'px'; w = wOf(t);
        }
        G.m = crew(c, 'scout', 'happy', 92); placeCrew(G.m, 214 + w + 78, 338, 'happy');
      });
    },
    seek(n, S) {
      const G = S.G, g = M.G;
      const ty = trk(g.ty, n), vy = vel(g.ty, n);
      S.camera(0, ty);
      S.blur(0, 0.84 * mbs(vy));   // σ/v calibrated on the reference's mascot here (blurfit.py, n719–721 and n741–742): 0.84 × 0.2
      tr(G.up, 0, trk(g.upLead, n));
      // darkness levels at n732 (top line very light, middle mid-grey), scaled by the measured ink curves
      G.l0.style.color = mix(PAPER, INK, 0.11 * trk(g.up0, n)); G.d0.style.opacity = clamp(0.25 * trk(g.up0, n)).toFixed(3);
      G.l1.style.color = mix(PAPER, INK, 0.45 * trk(g.up1, n)); G.d1.style.opacity = clamp(0.8 * trk(g.up1, n)).toFixed(3);
      const rise = trk(g.lineRise, n), vr = vel(g.lineRise, n);
      tr(G.line, 0, rise); G.line._blur(0, Math.sqrt(Math.max(0, mbs(vy + vr) ** 2 - mbs(vy) ** 2)));
      reveal(G.st.chars, n, g.last);
    },
  });

  // ═════════════════════════════ w3-insights (n971–1001) ═════════════════════════════
  // Analyst's findings: the headline streams in as the camera settles from the right, the header row sweeps in from the
  // right, three findings fade up out of a blur (as cards); then the camera accelerates up into the whip (W5 at n1001).
  const IN = STORY.chat.insights;
  scene({
    id: 'w3-insights', from: 971, to: 1001, z: 48,
    build(S) {
      building(S, () => {
        const c = S.cam, I = S.I = {};
        S.root.style.background = PAPER;
        I.row = el(c, 'abs', { left: 0, top: 0 });
        I.head = agentHead(I.row, { id: IN.agent, cx: 0, cy: 0, bodyW: 46, x: 204, base: 154, nameSize: 19, chipSize: 13.5, chipH: 25, chipPad: 10, gap: 11,
          status: IN.status, expr: 'open' });
        I.m = I.head.m; c.appendChild(I.m); blurrable(I.m, '-80%', '260%');
        I.txt = el(I.row, 'abs', { left: 0, top: 0 }); I.txt.appendChild(I.head.nm); I.txt.appendChild(I.head.ch.box);
        blurrable(I.txt, '-20%', '140%');
        I.h = streamLines(c, [IN.head], { x: 150, base: 214, size: 34, lh: 0, color: INK, weight: 600, ls: -0.025 });
        I.s = streamLines(c, [IN.sub], { x: 150, base: 251, size: 20, lh: 0, color: INK2 });
        const tint = C_(IN.agent).tint;
        I.cards = IN.items.map(([title, desc], i) => {
          const x = 150 + i * 262;
          const card = el(c, 'abs', { left: x + 'px', top: '284px', width: '248px', height: '150px', borderRadius: '20px', background: '#FFFFFF', boxShadow: SHADOW });
          const num = text(card, String(i + 1).padStart(2, '0'), { x: 22, base: 36, size: 13.5, weight: 600, color: chipFg(tint), ls: 0.02 });
          const body = el(card, 'abs', { left: 0, top: 0 });
          text(body, title, { x: 22, base: 76, size: 23, weight: 600, color: INK, ls: -0.02 });
          // the description: one line if it fits the card, else the balanced two-line break (no orphans)
          const words = desc.split(' '), probe = text(body, '', { x: 22, base: 0, size: 15.5, color: INK2 });
          const wd = str => { probe.textContent = str; return wOf(probe); };
          let ls = [desc];
          if (wd(desc) > 204) {
            let best = null;
            for (let k = 1; k < words.length; k++) {
              const a = words.slice(0, k).join(' '), b = words.slice(k).join(' '), m = Math.max(wd(a), wd(b));
              if (best === null || m < best[0]) best = [m, [a, b]];
            }
            ls = best[1];
          }
          probe.remove();
          lines(body, ls, { x: 22, base: 104, size: 15.5, lh: 21, color: INK2 });
          blurrable(card, '-20%', '140%');
          return { card, num, body };
        });
      });
    },
    seek(n, S) {
      const I = S.I, q = M.I;
      const tx = trk(q.tx, n), ty = trk(q.ty, n), vx = vel(q.tx, n), vy = vel(q.ty, n);
      S.camera(tx, ty);
      S.blur(mbs(vx), trk(q.by, n));
      const hx = trk(q.header, n), hv = vel(q.header, n);
      tr(I.row, hx, 0);
      placeCrew(I.m, 172 + hx, 147, n < 990 ? 'open' : 'happy'); op(I.m, trk(q.avatarOp, n)); I.m._blur(mbs(hv), 0);
      op(I.txt, trk(q.rowOp, n)); I.txt._blur(Math.hypot(trk(q.rowBlur, n), mbs(hv)), trk(q.rowBlur, n));
      wipeFrac(I.head.ch.t, trk(q.statusFrac, n), 0.4);
      reveal(I.h.chars, n, q.head); reveal(I.s.chars, n, q.sub);
      I.cards.forEach((cd, i) => {
        const o = trk(q.items[i], n);
        op(cd.card, o); cd.card._blur(3.5 * (1 - o), 3.5 * (1 - o));
        op(cd.num, trk(q.nums[i], n));
      });
    },
  });
})();
