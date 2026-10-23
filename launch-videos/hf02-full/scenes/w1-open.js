'use strict';
// W1 — open (n0–78), fly-through corridor (n76–96), outro lockup (n1698–1786), end card (n1787–1908).
// Motion is measured from the reference (motion/w1.js, notes/w1.md); every picture here is ours:
// the crew mark, "Crew" / "Launch Studio" lockup, the "Agents on call" pill, the follow badge, a corridor hung with our app screens.
(() => {
  const M = window.MW1;
  const P = { paper: '#F5F3EF', ink: '#16151B', ink2: '#6E6B73', ink3: '#A29FA8', rule: '#E6E2DC', card: '#FFFFFF' };
  const TINT = Object.fromEntries(STORY.crew.map(c => [c.id, c.tint]));
  const vel1 = (f, t) => (f(t + 0.25) - f(t - 0.25)) * 2;       // derivative of a frame function, units per frame

  // ───────────────────────── supersampled stacks (true motion blur over a shutter) ─────────────────────────
  // K identical copies of a layer; copy i is drawn with opacity 1/(i+1) over the ones below, so the result is the
  // mean of the K sub-frame renders (exact while every copy is opaque). Sub-frame times spread over SHUTTER frames:
  // the reference's smear is ~0.22 of a frame's travel (zoom-blur fit dlog/Δln s = .20–.24 on n68–74; slide blur σ/v ≈ .10 at its peak, n15).
  const SHUTTER = 0.22;
  function stack(parent, K, make) {
    const copies = [];
    for (let i = 0; i < K; i++) {
      const L = el(parent, 'abs', { left: '-80px', top: '-80px', width: '1240px', height: '768px', overflow: 'hidden' });
      const inner = el(L, 'abs', { left: '80px', top: '80px', width: '1080px', height: '608px' });
      blurrable(L, '-2%', '104%');
      copies.push({ L, h: make(inner, i) });
    }
    return copies;
  }
  function runStack(copies, n, k, fn, smear = 0) {
    k = Math.max(1, Math.min(copies.length, k | 0));
    for (let i = 0; i < copies.length; i++) {
      const c = copies[i];
      if (i >= k) { c.L.style.display = 'none'; continue; }
      c.L.style.display = 'block';
      c.L.style.opacity = (1 / (i + 1)).toFixed(5);
      c.L._blur(smear, smear);
      fn(c.h, k === 1 ? n : n + SHUTTER * (i / (k - 1) - 0.5), i);
    }
  }
  const kFor = (v, cap = 14) => Math.max(1, Math.min(cap, Math.ceil(Math.abs(v) * SHUTTER / 3)));

  // ───────────────────────── our marks ─────────────────────────
  // crew mark: an ink disc carrying the six crew colours as a ring of dots
  function crewMark(parent, d) {
    const A = STORY.brandArt || {};
    if (A.logo) {   // the brand's official icon, as supplied: scaled so its visible square fills the mark slot
      const k = 1 / (1 - 2 * (A.logoInset || 0)), s = d * k, o = (d - s) / 2;
      return el(parent, 'abs', { width: d + 'px', height: d + 'px' },
        `<img src="${A.logo}" alt="" style="position:absolute;left:${o.toFixed(1)}px;top:${o.toFixed(1)}px;width:${s.toFixed(1)}px;height:${s.toFixed(1)}px;filter:drop-shadow(0 3px 8px rgba(22,21,27,.16))">`);
    }
    const dots = STORY.crew.map((c, i) => {
      const a = -Math.PI / 2 + i * Math.PI / 3, r = 0.27 * d;
      return `<circle cx="${(d / 2 + r * Math.cos(a)).toFixed(2)}" cy="${(d / 2 + r * Math.sin(a)).toFixed(2)}" r="${(0.072 * d).toFixed(2)}" fill="${c.tint}"/>`;
    }).join('');
    return el(parent, 'abs', { width: d + 'px', height: d + 'px' },
      `<svg viewBox="0 0 ${d} ${d}" width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}" fill="${P.ink}"/>` +
      `<circle cx="${d / 2}" cy="${d / 2}" r="${(0.105 * d).toFixed(2)}" fill="#F5F3EF"/>${dots}</svg>`);
  }
  // studio tile: a warm squircle with an ink launch arrow (the glyph pops a beat before the tile)
  function studioTile(parent, d) {
    const sub = STORY.brandArt && STORY.brandArt.subLogo;   // the parent brand's official mark, shown exactly as supplied
    const t = el(parent, 'abs', { width: d + 'px', height: d + 'px', borderRadius: (0.3 * d) + 'px', background: sub ? '#FFFFFF' : '#FF7A1F',
      boxShadow: sub ? '0 2px 8px rgba(22,21,27,.12), 0 0 0 1px rgba(22,21,27,.06)' : 'none' });
    const g = el(parent, 'abs', { width: d + 'px', height: d + 'px' }, sub
      ? `<img src="${sub}" alt="" style="display:block;width:${(0.72 * d).toFixed(1)}px;height:${(0.72 * d).toFixed(1)}px;margin:${(0.14 * d).toFixed(1)}px">`
      : `<svg viewBox="0 0 60 60" width="${d}" height="${d}"><g fill="none" stroke="${P.ink}" stroke-width="6.2" stroke-linecap="round" stroke-linejoin="round">` +
        `<path d="M20 40 L39 21"/><path d="M24 20.5 H39.5 V36"/></g></svg>`);
    return { t, g };
  }
  // follow badge (end card): a ring with a bold plus and six tick dots — our own, not any network's icon
  const BADGE_SVG = (d, col) => {
    const ticks = Array.from({ length: 6 }, (_, i) => {
      const a = -Math.PI / 2 + Math.PI / 6 + i * Math.PI / 3, r = d * 0.5 - 6;
      return `<circle cx="${(d / 2 + r * Math.cos(a)).toFixed(2)}" cy="${(d / 2 + r * Math.sin(a)).toFixed(2)}" r="5.2" fill="${col}"/>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d} ${d}" width="${d}" height="${d}">` +
      `<circle cx="${d / 2}" cy="${d / 2}" r="${d * 0.5 - 22}" fill="none" stroke="${col}" stroke-width="11.5"/>` +
      `<path d="M${d / 2} ${d / 2 - 22} V${d / 2 + 22} M${d / 2 - 22} ${d / 2} H${d / 2 + 22}" stroke="${col}" stroke-width="11.5" stroke-linecap="round"/>${ticks}</svg>`;
  };

  // ───────────────────────── lockup layout (measured once, after fonts load) ─────────────────────────
  // [mark] Crew | [tile] Launch Studio, with the pill below. The join (the rule) sits near the measured push-in
  // centre (546, 300) so the push dives into the gap between the two names, as the reference's does.
  const CW = 74;                                   // crew body width (px) in the lockup shots
  let LAY = null;
  function layout() {
    if (LAY) return LAY;
    const probe = el(document.body, 'abs', { left: '-3000px', top: '0' });
    const w = (s, font, ls) => el(probe, 't', { font, letterSpacing: ls + 'em' }, s).getBoundingClientRect().width;
    const crewW = w(STORY.brand.name, '800 86px/1 Inter', -0.04), studioW = w(STORY.brand.sub, '600 36px/1 Inter', -0.02);
    const tagW = w(STORY.brand.tagline, '600 19px/1 Inter', -0.01);
    probe.remove();
    const mark = 76, g1 = 16, g2 = 28, sep = 2, tile = 62, g3 = 15;
    const W = mark + g1 + crewW + g2 + sep + g2 + tile + g3 + studioW;
    const x0 = Math.round(540 - W / 2), rowY = 266;
    const L = { rowY, W, x0, mark, crewW, studioW, tile };
    L.markX = x0; L.crewX = x0 + mark + g1; L.sepX = L.crewX + crewW + g2; L.tileX = L.sepX + sep + g2; L.studioX = L.tileX + tile + g3;
    L.pillH = 40; L.pillW = Math.round(tagW + 18 + 9 + 10 + 22); L.pillCx = 540; L.pillCy = 350;
    L.pillX0 = L.pillCx - L.pillW / 2; L.tagW = tagW;
    // character rest spots (ours: a hexagon ring around the lockup) and converge targets near the join
    L.slots = {
      green: { id: 'builder', rest: [842, 492], to: [L.pillX0 + L.pillW - 40, 352], ex: 'happy' },
      tri: { id: 'analyst', rest: [92, 300], to: [L.pillX0 + 30, 358], ex: 'open' },
      blue: { id: 'scout', rest: [752, 104], to: [L.tileX + 12, 248], ex: 'open', behind: true },
      sq: { id: 'director', rest: [994, 262], to: [L.tileX + 24, 210], ex: 'dots' },
      orange: { id: 'critic', rest: [336, 96], to: [L.sepX - 12, 268], ex: 'happy' },
      purple: { id: 'writer', rest: [262, 496], to: [L.pillCx - 18, 338], ex: 'open' },
    };
    LAY = L; return L;
  }

  // one copy of the lockup + crew on paper
  function buildLockup(parent) {
    const L = layout(), h = {};
    h.bg = el(parent, 'abs', { left: '-80px', top: '-80px', width: '1240px', height: '768px',
      // our paper: light from above, a warm stage glow along the floor, soft falloff to the sides (static: the camera moves the layout, not the paper)
      background: 'radial-gradient(60% 55% at 50% -6%, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%), ' +
        'radial-gradient(42% 36% at 50% 104%, rgba(255,142,88,.32) 0%, rgba(255,142,88,0) 100%), ' +
        'radial-gradient(78% 74% at 50% 44%, #F7F4EF 30%, #E4DDD3 100%)' });
    h.cam = el(parent, 'abs', { left: 0, top: 0, width: '1080px', height: '608px', transformOrigin: '546px 300px' });
    const mk = (id) => { const n = crew(h.cam, id, 'open', CW); n.style.transformOrigin = '50% 56%'; return n; };
    h.chars = {};
    for (const [k, s] of Object.entries(L.slots)) if (s.behind) h.chars[k] = mk(s.id);
    // lockup: icon / word / rest-of-lockup groups, each with its own offset
    h.gIcon = el(h.cam, 'abs', { left: 0, top: 0 }); h.gText = el(h.cam, 'abs', { left: 0, top: 0 }); h.gRest = el(h.cam, 'abs', { left: 0, top: 0 });
    h.mark = crewMark(h.gIcon, L.mark); h.mark.style.left = L.markX + 'px'; h.mark.style.top = (L.rowY - L.mark / 2) + 'px';
    h.word = text(h.gText, STORY.brand.name, { x: L.crewX - 2, base: L.rowY + 31, size: 86, weight: 800, color: P.ink, ls: -0.04 });
    h.sep = el(h.gRest, 'abs', { left: L.sepX + 'px', top: (L.rowY - 22) + 'px', width: '2px', height: '44px', borderRadius: '1px', background: '#CDC8C1' });
    h.tileBox = el(h.gRest, 'abs', { left: L.tileX + 'px', top: (L.rowY - L.tile / 2) + 'px', width: L.tile + 'px', height: L.tile + 'px' });
    const st = studioTile(h.tileBox, L.tile); h.tile = st.t; h.glyph = st.g;
    h.tile.style.transformOrigin = '50% 50%'; h.glyph.style.transformOrigin = '50% 50%';
    const ct = charText(h.gRest, STORY.brand.sub, { x: L.studioX, base: L.rowY + 13, size: 36, weight: 600, color: P.ink, ls: -0.02 });
    ct.chars.forEach(c => { c.style.display = 'inline-block'; c.style.transformOrigin = '50% 80%'; c.style.whiteSpace = 'pre'; });
    h.letters = ct.chars.filter(c => c.textContent.trim());
    // pill: white card + outline drawn in two halves from the left cap + type-on text + live dot
    const pw = L.pillW, ph = L.pillH, r = ph / 2;
    h.pill = el(h.gRest, 'abs', { left: L.pillX0 + 'px', top: (L.pillCy - ph / 2) + 'px', width: pw + 'px', height: ph + 'px' });
    h.pillFill = el(h.pill, 'abs', { left: 0, top: 0, width: pw + 'px', height: ph + 'px', borderRadius: r + 'px', background: P.card, boxShadow: '0 6px 18px rgba(22,21,27,.07)' });
    const o = 0.8, top = `M ${o} ${r} A ${r - o} ${r - o} 0 0 1 ${r} ${o} H ${pw - r} A ${r - o} ${r - o} 0 0 1 ${pw - o} ${r}`;
    const bot = `M ${o} ${r} A ${r - o} ${r - o} 0 0 0 ${r} ${ph - o} H ${pw - r} A ${r - o} ${r - o} 0 0 0 ${pw - o} ${r}`;
    h.pillLine = el(h.pill, 'abs', { left: 0, top: 0, width: pw + 'px', height: ph + 'px' },
      `<svg width="${pw}" height="${ph}" style="overflow:visible"><g fill="none" stroke="#2A2830" stroke-width="1.6" stroke-linecap="round"><path pathLength="1" d="${top}"/><path pathLength="1" d="${bot}"/></g></svg>`);
    h.pillPaths = [...h.pillLine.querySelectorAll('path')];
    h.dot = el(h.pill, 'abs', { left: '18px', top: (ph / 2 - 4.5) + 'px', width: '9px', height: '9px', borderRadius: '50%', background: TINT.builder });
    h.tag = charText(h.pill, STORY.brand.tagline, { x: 18 + 9 + 10, base: ph / 2 + 6.8, size: 19, weight: 600, color: P.ink, ls: -0.01 }).chars;
    for (const [k, s] of Object.entries(L.slots)) if (!s.behind) h.chars[k] = mk(s.id);
    return h;
  }

  // ───────────────────────── per-frame lockup state ─────────────────────────
  // "Crew" colour sweep through the cast's colours (timing and brightness arc of the reference's word shimmer)
  const SH = [['#16151B', 0], [TINT.scout, 0.16], ['#13A3A0', 0.33], [TINT.builder, 0.47], ['#E0A15A', 0.62], [TINT.critic, 0.74], [TINT.writer, 0.88], ['#16151B', 1]];
  function shimmerColour(p) {
    if (p <= 0 || p >= 1) return P.ink;
    for (let i = 1; i < SH.length; i++) if (p <= SH[i][1]) return mix(SH[i - 1][0], SH[i][0], (p - SH[i - 1][1]) / (SH[i][1] - SH[i - 1][1]));
    return P.ink;
  }
  function tagState(h, t, T) {
    stream(h.tag, clamp((t - T.type[0]) / (T.type[1] - T.type[0])), T.tail);
    const op = 1 - Math.pow(1 - clamp((t - T.outline[0]) / (T.outline[1] - T.outline[0])), T.pow || 3);   // ease-out (cubic open, quad outro: fitted)
    for (const p of h.pillPaths) { p.style.strokeDasharray = `${op.toFixed(4)} 2`; p.style.opacity = op > 0.001 ? 1 : 0; }
    h.pillFill.style.opacity = op > 0.001 ? (0.15 + 0.85 * op).toFixed(3) : 0;
    const dp = clamp((t - T.dot[0]) / (T.dot[1] - T.dot[0]));
    h.dot.style.transform = `scale(${dp <= 0 ? 0 : popScale(dp, 0.18).toFixed(3)})`;
  }
  const LASTK = {};
  // slot: pop + pulse + converge (+ a slow float so nothing ever holds still)
  function charState(h, k, t, cfg) {
    const L = layout(), s = L.slots[k], S = M.slots[k], node = h.chars[k];
    let x = s.rest[0], y = s.rest[1], sc = trk(M.pop, t - S.t0 - cfg.shift);
    if (sc > 1) sc = 1 + (sc - 1) * (S.popAmp ?? 1);
    sc *= 1 + (trk(M.pulse, t - S.pulse - cfg.shift) - 1) * S.pulseAmp;
    if (cfg.spread) { x = 546 + (x - 546) * cfg.spread; y = 300 + (y - 300) * (k === 'tri' ? 1.01 : cfg.spread); }
    const ph = { green: 0.3, tri: 1.7, blue: 2.6, sq: 4.1, orange: 5.0, purple: 0.9 }[k];
    x += 1.6 * Math.sin(t / 13 + ph); y += 2.2 * Math.sin(t / 17 + ph * 1.3);
    if (cfg.converge) {
      const C = S.conv, a = trk(C.along, t), q = trk(C.perp, t), kk = trk(C.k, t);
      const dx = s.to[0] - x, dy = s.to[1] - y;
      x += a * dx - q * dy; y += a * dy + q * dx; sc *= kk;
      const last = LASTK[k] ?? (LASTK[k] = Math.max(...Object.keys(C.k).map(Number)));
      if (k !== 'blue' && t > last + 0.5) sc = 0;
    }
    if (sc <= 0.004) { node.style.display = 'none'; return; }
    node.style.display = 'block';
    placeCrew(node, x, y, (cfg.expr && cfg.expr(k, t)) || s.ex);
    node.style.transform = `scale(${sc.toFixed(4)})`;
  }
  // full lockup state at (fractional) time t
  function lockupState(h, t, cfg) {
    const L = layout();
    const [s, ox, oy] = cfg.cam(t);
    h.cam.style.transformOrigin = `${ox}px ${oy}px`; h.cam.style.transform = `scale(${s.toFixed(5)})`;
    const dx = cfg.offX(t), yI = cfg.offY(t), yT = cfg.offY(t - cfg.textDelay);
    h.gIcon.style.transform = `translate(${dx.toFixed(2)}px, ${yI.toFixed(2)}px)`;
    h.gText.style.transform = `translate(${dx.toFixed(2)}px, ${yT.toFixed(2)}px)`;
    h.gRest.style.transform = `translate(${dx.toFixed(2)}px, ${yI.toFixed(2)}px)`;
    const sh = cfg.shift, O = M.open;
    h.word.style.color = shimmerColour((t - sh - O.shimmer[0]) / (O.shimmer[1] - O.shimmer[0]));
    h.sep.style.opacity = clamp((t - sh - O.sep[0]) / (O.sep[1] - O.sep[0]));
    const ts = trk(O.tile, t - sh), gs = trk(O.glyph, t - sh);
    h.tile.style.transform = `scale(${ts.toFixed(4)})`; h.tile.style.display = ts > 0.003 ? 'block' : 'none';
    h.glyph.style.transform = `scale(${(gs * (ts > 1 ? ts : 1)).toFixed(4)})`; h.glyph.style.display = gs > 0.003 ? 'block' : 'none';
    h.tileBox.style.transform = `translateX(${cfg.tileX(t).toFixed(2)}px)`;
    // the measured per-letter onsets, resampled to however many letters the sub-line has (same first and last frames)
    const LT = O.letters, nL = h.letters.length;
    h.letters.forEach((sp, i) => {
      const u = nL > 1 ? i * (LT.length - 1) / (nL - 1) : 0, i0 = Math.floor(u), a = LT[i0] + (LT[Math.min(i0 + 1, LT.length - 1)] - LT[i0]) * (u - i0);
      const p = clamp((t - sh - a) / O.letterLen);
      sp.style.opacity = smooth(p).toFixed(3);
      sp.style.transform = `scale(${(0.5 + 0.5 * easeOut(p) + 0.06 * Math.sin(Math.PI * p)).toFixed(3)})`;
    });
    tagState(h, t, cfg.tag);
    for (const k of Object.keys(L.slots)) charState(h, k, t, cfg);
  }

  // ───────────────────────── shot 1: lockup build + push-in (n0–76), white veil over the corridor (n76–78) ─────────────────────────
  const camOpen = n => trk(M.open.cam, n);
  const OPEN = {
    shift: 0, textDelay: M.open.textDelay, tag: M.open.tag, converge: true,
    offX: t => trk(M.open.offX, t), offY: t => trk(M.open.offY, t), tileX: t => trk(M.open.tileX, t),
    cam: t => [camOpen(t), M.open.O[0], M.open.O[1]],
    expr: (k, t) => (k === 'tri' && t > 50.6 && t < 53.4) || (k === 'blue' && t > 29.2 && t < 31.6) || (k === 'sq' && t > 57 && t < 58.8) ? 'blink' : null,
  };
  function speedOpen(n) {
    const vz = Math.abs(Math.log(camOpen(n + 0.5) / camOpen(n - 0.5))) * 520;
    const vy = Math.max(Math.abs(vel1(OPEN.offY, n)), Math.abs(vel1(OPEN.offY, n - OPEN.textDelay)));
    const vx = Math.abs(vel1(OPEN.offX, n));
    let vc = 0;
    if (n > 55) for (const k of Object.keys(M.slots)) { const C = M.slots[k].conv; vc = Math.max(vc, Math.abs(vel1(t => trk(C.along, t), n)) * 380); }
    return Math.max(vz, vy, vx, vc);
  }
  const CO = M.corr;
  scene({
    id: 'w1-open', from: 0, to: 78, z: 12,
    build(S) {
      S.veil = el(S.cam, 'abs', { left: '-200px', top: '-200px', width: '1480px', height: '1008px', background: P.paper });
      S.copies = stack(S.cam, 14, inner => buildLockup(inner));
    },
    seek(n, S) {
      if (n >= 76) {
        // the corridor shows through: the paper becomes a fading white veil; the last lockup remnants fly past on top (n76 only)
        S.veil.style.display = 'block'; S.veil.style.opacity = trk(CO.veil, n).toFixed(3);
        runStack(S.copies, n, 1, h => { h.bg.style.display = 'none'; h.cam.style.display = n === 76 ? 'block' : 'none'; lockupState(h, n, OPEN); });
        S.blur(n === 76 ? 24 : 0, n === 76 ? 20 : 0);
        return;
      }
      S.veil.style.display = 'none'; S.blur(0, 0);
      const v = speedOpen(n), k = kFor(v), step = v * SHUTTER / Math.max(1, k - 1);
      runStack(S.copies, n, k, (h, t) => { h.bg.style.display = 'block'; h.cam.style.display = 'block'; lockupState(h, t, OPEN); }, k > 1 && step > 2.5 ? 0.45 * step : 0);   // per-copy blur hides the sub-frame steps on the cut frames
    },
  });

  // ───────────────────────── corridor (n76–96): an octagonal hall hung with our app screens and covers ─────────────────────────
  // Drawn on a canvas with our own projection so the motion blur can be a true shutter: K sub-frames (up to 32) are
  // averaged per frame. The camera moves at v = k·P·Ht per frame, k = the reference's measured flow rate
  // (tools/w1/tunnel.py); the end wall is 800 px ahead at n94, so it fills the frame by n96, where W2's plate card sits.
  const PERS = 640, HT = 300, WT = 375, CHF = 112;
  const OCT = [[-WT + CHF, -HT], [WT - CHF, -HT], [WT, -HT + CHF], [WT, HT - CHF], [WT - CHF, HT], [-WT + CHF, HT], [-WT, HT - CHF], [-WT, -HT + CHF]];
  const FACE_COL = ['#FBF9F5', '#F2EEE8', '#EDE9E2', '#E7E1D9', '#E2DCD3', '#E7E1D9', '#EDE9E2', '#F2EEE8'];
  const SEAM = 240, DNEAR = 280;
  const ZC = (() => { const tab = {}; let z = 0; for (let n = 74; n <= 98; n += 0.25) { tab[n] = z; z += CO.gain * trk(CO.k, n + 0.125) * PERS * HT * 0.25; } return n => trk(tab, n); })();
  const S_END = ZC(94) + CO.endDepth94;            // hall position of the end wall (the camera sits at ZC(n))
  const vpx = n => trk(CO.vx, n), VPY = CO.vy;
  // hangings: our app screens on the side walls, covers on the ceiling, floor and bevels; dark slots between wall panels
  const HANG = [];
  {
    const R = rng(4242); let s = ZC(76) + 520, i = 0;
    while (s < S_END - 240) {
      const face = [2, 6, 0, 2, 4, 6, 1, 5, 2, 6, 3, 7][i % 12];
      HANG.push({ s, face, kind: face === 2 || face === 6 ? 'app' : 'cover', seed: 3 + i * 7, frac: 0.5 + (R() - 0.5) * 0.2 });
      s += 140 + R() * 150; i++;
    }
  }
  const SLOTS = []; { const R = rng(99); for (let s = ZC(76) + 400; s < S_END - 200; s += SEAM) for (const f of [2, 6, 0, 4, 1, 3, 5, 7]) if (R() < 0.36) SLOTS.push({ s: s + SEAM * 0.5, f, w: 22 + R() * 30 }); }
  const RINGS = []; for (let s = S_END - 4; s > ZC(76) + 300; s -= 900) RINGS.push(s);
  const IMG = {};                                   // hanging id → decoded image
  function hangImages() {
    if (hangImages.p) return hangImages.p;
    const tmp = el(document.body, 'abs', { left: '-4000px', top: 0 });
    const jobs = HANG.map((g, i) => {
      let svg;
      if (g.kind === 'app') {
        const a = appScreen(tmp, g.seed, { x: 0, y: 0, w: 180, h: 390, r: 18 });
        svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="390"><foreignObject width="180" height="390"><div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:180px;height:390px;font-family:sans-serif">${new XMLSerializer().serializeToString(a).replace(/position: absolute; left: 0px; top: 0px;/, 'position: absolute; left: 0px; top: 0px;')}</div></foreignObject></svg>`;
      } else {
        const c = cover(tmp, g.seed, { x: 0, y: 0, w: 160, h: 160, r: 18 });
        svg = c.innerHTML.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace('width="100%" height="100%"', 'width="160" height="160"');
        svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><clipPath id="r"><rect width="160" height="160" rx="18"/></clipPath><g clip-path="url(#r)">${svg}</g></svg>`;
      }
      const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      IMG[i] = im;
      return im.decode().catch(() => {});
    });
    hangImages.p = Promise.all(jobs).then(() => tmp.remove());
    return hangImages.p;
  }
  function drawHall(g, t, W, H, sc) {
    const zc = ZC(t), ox = vpx(t), oy = VPY, dEnd = S_END - zc;
    const pr = (X, Y, d) => [(ox + X * PERS / d) * sc, (oy + Y * PERS / d) * sc];
    g.fillStyle = P.paper; g.fillRect(0, 0, W, H);
    const poly = (pts, fill) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fillStyle = fill; g.fill(); };
    // walls (convex hall seen from inside: faces never overlap on screen)
    for (let f = 0; f < 8; f++) {
      const Va = OCT[f], Vb = OCT[(f + 1) % 8];
      poly([pr(Va[0], Va[1], DNEAR), pr(Vb[0], Vb[1], DNEAR), pr(Vb[0], Vb[1], dEnd), pr(Va[0], Va[1], dEnd)], FACE_COL[f]);
    }
    // transverse seams (world-fixed every SEAM), tapered with depth
    g.strokeStyle = '#D3CBC0';
    for (let s = Math.ceil((zc + DNEAR) / SEAM) * SEAM; s < zc + dEnd; s += SEAM) {
      const d = s - zc; g.lineWidth = Math.max(0.6, 2.4 * PERS / d) * sc; g.beginPath();
      for (let f = 0; f < 8; f++) { const a = pr(OCT[f][0], OCT[f][1], d); if (f === 0) g.moveTo(a[0], a[1]); else g.lineTo(a[0], a[1]); }
      g.closePath(); g.stroke();
    }
    // dark slots (recessed light slits) across the main faces
    for (const sl of SLOTS) {
      const d0 = sl.s - zc, d1 = d0 + sl.w; if (d0 < DNEAR || d1 > dEnd) continue;
      const Va = OCT[sl.f], Vb = OCT[(sl.f + 1) % 8];
      poly([pr(Va[0], Va[1], d0), pr(Vb[0], Vb[1], d0), pr(Vb[0], Vb[1], d1), pr(Va[0], Va[1], d1)], '#24212A');
    }
    // long edges between faces: ink lines that taper into the distance
    g.fillStyle = '#2A2830';
    for (let f = 0; f < 8; f++) {
      const V = OCT[f], len = Math.hypot(V[0], V[1]), ux = -V[1] / len, uy = V[0] / len, w0 = 2.4;
      const a = pr(V[0] - ux * w0, V[1] - uy * w0, DNEAR), b = pr(V[0] + ux * w0, V[1] + uy * w0, DNEAR), c = pr(V[0] + ux * w0, V[1] + uy * w0, dEnd), e = pr(V[0] - ux * w0, V[1] - uy * w0, dEnd);
      poly([a, b, c, e], '#2A2830');
    }
    // hangings and rings, far to near
    const items = [];
    HANG.forEach((h, i) => { const d = h.s - zc; if (d > DNEAR * 0.6 && d < dEnd - 10) items.push({ d, h, i }); });
    RINGS.forEach(s => { const d = s - zc; if (d > 70 && d <= dEnd + 1) items.push({ d, ring: true }); });
    items.sort((A, B) => B.d - A.d);
    for (const it of items) {
      if (it.ring) {
        g.lineWidth = 9 * PERS / it.d * sc; g.strokeStyle = '#2A2830'; g.lineJoin = 'round'; g.beginPath();
        OCT.forEach((V, i) => { const p = pr(V[0], V[1], it.d); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); g.stroke(); continue;
      }
      const hg = it.h, im = IMG[it.i]; if (!im || !im.complete || !im.naturalWidth) continue;
      const Va = OCT[hg.face], Vb = OCT[(hg.face + 1) % 8], Fw = Math.hypot(Vb[0] - Va[0], Vb[1] - Va[1]);
      const ux = (Vb[0] - Va[0]) / Fw, uy = (Vb[1] - Va[1]) / Fw, nx = -uy, ny = ux, app = hg.kind === 'app';
      const across = app ? 0.86 * Fw : Math.min(0.56 * Fw, 230), along = app ? across * 180 / 390 : across;
      const c0 = hg.frac * Fw - across / 2, X0 = Va[0] + ux * c0 + nx * 3, Y0 = Va[1] + uy * c0 + ny * 3;
      // image corners: (u: image x 0..1, v: image y 0..1) → hall point
      let P3;
      if (app && hg.face === 2) P3 = (u, v) => [X0 + ux * across * v, Y0 + uy * across * v, it.d + along / 2 - along * u];        // right wall, upright
      else if (app) P3 = (u, v) => [X0 + ux * across * (1 - v), Y0 + uy * across * (1 - v), it.d - along / 2 + along * u];      // left wall, upright
      else P3 = (u, v) => [X0 + ux * across * u, Y0 + uy * across * u, it.d + along / 2 - along * v];
      const G = it.d < 900 ? 6 : 3, iw = im.naturalWidth, ih = im.naturalHeight;
      for (let a = 0; a < G; a++) for (let b = 0; b < G; b++) {
        const u0 = a / G, u1 = (a + 1) / G, v0 = b / G, v1 = (b + 1) / G;
        const q = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => { const p = P3(u, v); return p[2] < 20 ? null : pr(p[0], p[1], p[2]); });
        if (q.some(p => !p)) continue;
        // affine map from the image cell (top-left, top-right, bottom-left) to the projected cell; clip to the projected quad
        const [A, B, , D] = q, sx0 = u0 * iw, sy0 = v0 * ih, cw = iw / G, chh = ih / G;
        g.save(); g.beginPath(); const cx = (q[0][0] + q[2][0]) / 2, cy = (q[0][1] + q[2][1]) / 2;
        q.forEach((p, k) => { const ex = p[0] + (p[0] - cx) * 0.04, ey = p[1] + (p[1] - cy) * 0.04; k ? g.lineTo(ex, ey) : g.moveTo(ex, ey); }); g.clip();
        g.setTransform((B[0] - A[0]) / cw, (B[1] - A[1]) / cw, (D[0] - A[0]) / chh, (D[1] - A[1]) / chh, A[0] - (B[0] - A[0]) / cw * sx0 - (D[0] - A[0]) / chh * sy0, A[1] - (B[1] - A[1]) / cw * sx0 - (D[1] - A[1]) / chh * sy0);
        g.drawImage(im, 0, 0); g.restore();
      }
    }
    // end wall (paper) seals the hall
    poly(OCT.map(V => pr(V[0], V[1], dEnd)), P.paper);
  }
  const speedCorr = n => CO.gain * trk(CO.k, n) * 330 * 330;                   // flow speed 330 px from the vanishing point (px/f)
  scene({
    id: 'w1-corridor', from: 76, to: 96, z: 8,
    build(S) {
      const dpr = window.devicePixelRatio || 1, W = Math.round(1080 * dpr), H = Math.round(608 * dpr);
      S.cv = el(S.cam, 'abs', { left: 0, top: 0, width: '1080px', height: '608px' }, `<canvas width="${W}" height="${H}" style="width:1080px;height:608px;display:block"></canvas>`).firstChild;
      S.sub = document.createElement('canvas'); S.sub.width = W; S.sub.height = H; S.W = W; S.H = H; S.dpr = dpr;
      hangImages();
    },
    async seek(n, S) {
      await hangImages();
      const v = speedCorr(n), K = Math.max(1, Math.min(32, Math.ceil(v * SHUTTER / 2.5)));
      const main = S.cv.getContext('2d'), sub = S.sub.getContext('2d');
      main.globalAlpha = 1;
      for (let i = 0; i < K; i++) {
        const t = K === 1 ? n : n + SHUTTER * (i / (K - 1) - 0.5);
        sub.setTransform(1, 0, 0, 1, 0, 0); drawHall(sub, t, S.W, S.H, S.dpr);
        main.globalAlpha = 1 / (i + 1); main.drawImage(S.sub, 0, 0);
      }
      main.globalAlpha = 1;
    },
  });

  // ───────────────────────── the crew flying through the hall (n76–94 under the plate, n95–96 over it) ─────────────────────────
  // Screen-space tracks measured on the reference, each rotated about the vanishing point by M.corr.rot (our composition).
  const CSLOT = { green: ['builder', 'happy'], blue: ['scout', 'open'], orange: ['critic', 'happy'], purple: ['writer', 'open'], tri: ['analyst', 'open'], sq: ['director', 'dots'] };
  const CTR = {};
  for (const [k, tab] of Object.entries(CO.chars)) {
    const X = {}, Y = {}, Wd = {};
    const a = CO.rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    for (const [n, [x, y, w]] of Object.entries(tab)) {
      const cx = trk(CO.vx, +n), dx = x - cx, dy = y - CO.vy;
      X[n] = cx + dx * ca - dy * sa; Y[n] = CO.vy + dx * sa + dy * ca; Wd[n] = w;
    }
    CTR[k] = { X, Y, W: Wd };
  }
  function buildFly(S) {
    S.chars = {};
    for (const [k, [id, ex]] of Object.entries(CSLOT)) {
      const n = crew(S.cam, id, ex, 100); n.style.transformOrigin = '50% 56%'; blurrable(n); S.chars[k] = n;
    }
  }
  function flyState(S, n) {
    for (const [k, node] of Object.entries(S.chars)) {
      const T = CTR[k], x = trk(T.X, n), y = trk(T.Y, n), w = trk(T.W, n);
      const vb = (tab) => { const b = trk(tab, n) - trk(tab, n - 1), f = trk(tab, n + 1) - trk(tab, n); return 1.2 * (Math.abs(b) < Math.abs(f) ? b : f); };
      const bs = n === 95 ? 0.35 : 1;                                // n95: the reference's crew is nearly crisp (σ≈3 px) before the burst
      const vx = vb(T.X) * bs, vy = vb(T.Y) * bs, vw = vb(T.W) * bs;
      placeCrew(node, x, y, (k === 'blue' && n > 85.6 && n < 87.4) || (k === 'sq' && n > 89.5 && n < 91.2) ? 'blink' : CSLOT[k][1]);
      const sc = w / 76 * 1.03;                                      // our crew's blob width matches the reference's blob width (measured: ours/ref = 1.00)
      node.style.transform = `scale(${(sc * 74 / 100).toFixed(4)})`;
      // blur along the motion (σ = shutter·v/√12) + growth smear, in the node's own (unscaled) px
      const g = SHUTTER / Math.sqrt(12), inv = 1 / Math.max(0.05, sc * 0.74);
      node._blur((g * Math.abs(vx) + 0.5 * g * Math.abs(vw)) * inv, (g * Math.abs(vy) + 0.5 * g * Math.abs(vw)) * inv);
    }
  }
  scene({ id: 'w1-crew-in', from: 76, to: 94, z: 10, build: buildFly, seek: (n, S) => flyState(S, n) });
  scene({ id: 'w1-crew-out', from: 95, to: 96, z: 95, build: buildFly, seek: (n, S) => flyState(S, n) });

  // ───────────────────────── outro lockup (n1698–1786) + end card (n1787–1908) ─────────────────────────
  const OUT = M.outro;
  const OUTRO = {
    shift: OUT.shift, textDelay: OUT.textDelay, tag: OUT.tag, converge: false, spread: OUT.spread,
    offX: () => 0, offY: t => trk(OUT.offY, t), tileX: t => trk(OUT.tileX, t),
    cam: t => [1 + OUT.rate * (Math.min(t, 1786) - OUT.n0), OUT.O[0], OUT.O[1]],
    expr: (k, t) => (k === 'tri' && t > 1747.6 && t < 1750.4) || (k === 'blue' && t > 1726.2 && t < 1728.6) || (k === 'sq' && t > 1766 && t < 1768) ? 'blink' : null,
  };
  const speedOutro = n => Math.max(Math.abs(vel1(OUTRO.offY, n)), Math.abs(vel1(OUTRO.offY, n - OUTRO.textDelay)), Math.abs(vel1(OUTRO.tileX, n)));
  const E = M.end;
  const nq20 = n => E.start + Math.ceil((n - E.start) * 2 / 3 - 1e-9) * 1.5;      // the end card runs at 20 fps, as the reference's does
  scene({
    id: 'w1-outro', from: 1698, to: 1908, z: 12,
    build(S) {
      S.copies = stack(S.cam, 12, inner => buildLockup(inner));
      // end card: black frame, dim overlay, then badge (white + a colour layer masked to the badge) and handle on top
      S.black = el(S.root, 'abs', { left: 0, top: 0, width: '1480px', height: '1008px', background: '#000' });
      S.dim = el(S.root, 'abs', { left: 0, top: 0, width: '1480px', height: '1008px', background: '#000', opacity: E.dim });
      const wrap = el(S.root, 'abs', { left: '200px', top: '200px', width: '1080px', height: '608px' });
      S.card = el(wrap, 'abs', { left: 0, top: 0, width: '1080px', height: '608px', transformOrigin: `${E.origin[0]}px ${E.origin[1]}px` });
      const d = 142, bx = 540 - d / 2, by = 262 - d / 2;
      const url = 'url("data:image/svg+xml;utf8,' + encodeURIComponent(BADGE_SVG(d, '#000')) + '")';
      S.badgeW = el(S.card, 'abs', { left: bx + 'px', top: by + 'px', width: d + 'px', height: d + 'px' }, BADGE_SVG(d, '#FFFFFF'));
      S.badgeC = el(S.card, 'abs', { left: bx + 'px', top: by + 'px', width: d + 'px', height: d + 'px', overflow: 'hidden',
        webkitMaskImage: url, maskImage: url, webkitMaskSize: '100% 100%', maskSize: '100% 100%' });
      S.badgeG = el(S.badgeC, 'abs', { left: '-40px', top: '-40px', width: (d + 80) + 'px', height: (d + 80) + 'px', borderRadius: '50%',
        background: `conic-gradient(from 0deg, #2E6BFF, #7C3AED, #FF3D7F, #FF6A00, #FFB300, #00B86B, #2E6BFF)` });
      S.handle = text(S.card, STORY.brand.handle, { x: 540, base: 444, size: 38, weight: 700, color: '#FFFFFF', ls: -0.02, align: 'center' });
    },
    seek(n, S) {
      S.black.style.display = n === E.black ? 'block' : 'none';
      S.dim.style.display = n >= E.start ? 'block' : 'none';
      S.card.parentNode.style.display = n >= E.start ? 'block' : 'none';
      if (n === E.black) return;
      const nl = Math.min(n, 1786);
      const v = n < E.black ? speedOutro(nl) : 0, k = kFor(v), step = v * SHUTTER / Math.max(1, k - 1);
      runStack(S.copies, nl, k, (h, t) => lockupState(h, t, OUTRO), k > 1 && step > 2.5 ? 0.45 * step : 0);   // per-copy blur hides the sub-frame steps on the cut frames
      if (n >= E.start) {
        const q = nq20(n);
        S.card.style.transform = `scale(${trk(E.scale, q).toFixed(4)})`;
        S.handle.style.opacity = q >= E.handleAt ? 1 : 0;
        const cin = clamp((q - E.colourIn[0]) / (E.colourIn[1] - E.colourIn[0])), cout = clamp((q - E.colourOut[0]) / (E.colourOut[1] - E.colourOut[0]));
        const c = cin * (1 - cout);
        S.badgeC.style.opacity = c.toFixed(3); S.badgeC.style.display = c > 0.002 ? 'block' : 'none';
        S.badgeG.style.transform = `rotate(${((q - E.colourIn[0]) * E.spinDegPerFrame).toFixed(2)}deg)`;
      }
    },
  });
})();
