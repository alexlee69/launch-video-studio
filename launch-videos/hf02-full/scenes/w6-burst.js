'use strict';
// W6 — burst + app (reference frames n1260–1531). Motion is measured (motion/w6.js, notes/w6.md); every picture is ours:
// our six crew characters, STORY.chat.media in our chat language, the Hush phone (lib/app.js), STORY.bubbles.ship.
(() => {
const M = () => window.MW6;
const CX = 540, CY = 304;
const at = (tab, n) => trk(tab, n);
// speed for motion blur: the slower of the two neighbouring frame steps (measured on the reference: entries blur with the
// forward step, exits with the backward one)
function mspd(f, n, lo = -1e9, hi = 1e9) {
  const b = n - 1 >= lo ? f(n) - f(n - 1) : null, a = n + 1 <= hi ? f(n + 1) - f(n) : null;
  if (b === null) return a || 0; if (a === null) return b;
  return Math.abs(a) < Math.abs(b) ? a : b;
}

// A crew member that can carry a blur along any direction: an outer box rotated to the blur axis holds the filter
// (filters apply in the element's local space, before its transform), an inner box counter-rotates the character upright.
function mover(parent, id, expr, w, z = 0) {
  const B = Math.ceil(w * 110 / 80) + 8;
  const o = el(parent, 'abs', { left: -B / 2 + 'px', top: -B / 2 + 'px', width: B + 'px', height: B + 'px', zIndex: z });
  blurrable(o, '-200%', '500%');
  const i = el(o, 'abs', { left: 0, top: 0, width: B + 'px', height: B + 'px' });
  const c = crew(i, id, expr, w); placeCrew(c, B / 2, B / 2);
  return {
    o, i, c, w, expr,
    // centre (x, y) in frame px, scale k (of body width w), blur sigma along angle ang (deg) and across it, opacity
    set(x, y, k, ang = 0, sAlong = 0, sAcross = 0, op = 1, ex) {
      o.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${ang.toFixed(2)}deg)`;
      i.style.transform = `rotate(${(-ang).toFixed(2)}deg) scale(${k.toFixed(4)})`;
      o._blur(sAlong, sAcross); o.style.opacity = op;
      if (ex && ex !== c._expr) placeCrew(c, B / 2, B / 2, ex);
    },
  };
}

// ───────────── shot A (n1260–1280): one close-up, then two characters part from one and fly apart ─────────────
// n1260 is the Builder (the agent of the W5 "building" chat) arriving in close-up; from n1261 the Writer emerges from behind it.
scene({
  id: 'w6-split', from: 1260, to: 1280, z: 60,
  build(S) {
    S.L = mover(S.cam, 'writer', 'open', 170, 1);
    S.R = mover(S.cam, 'builder', 'happy', 170, 2);
  },
  seek(n, S) {
    const T = M().split, d = at(T.d, n), s = at(T.s, n);
    // blur from the outer edge's speed (centre separation + half-width growth), the slower neighbouring step (see notes)
    const edge = m => at(T.d, m) + at(T.s, m) * T.w / 2;
    // (the entry n1261–1266 reads ~20 % softer on the reference than 0.2·v of the forward step: factor 0.24 there)
    const kb = n <= 1266 ? 1.2 : 1;
    const bx = kb * mbs(mspd(edge, n, 1261, 1280)), by = kb * mbs(mspd(m => at(T.s, m) * T.w / 2, n, 1261, 1280));
    if (n < 1261) {   // the close-up: the Builder alone, still settling from W5's push (soft)
      S.L.set(T.cx, T.cy, s, 0, 0, 0, 0);
      S.R.set(T.cx - 1.3, T.cy, s, 0, 2.4, 2.4, 1, 'happy');
      return;
    }
    S.L.set(T.cx - d, T.cy, s, 0, bx, by, 1);
    S.R.set(T.cx + d, T.cy, s, 0, bx, by, 1, 'open');
  },
});

// ───────────── the constellation (ours): rest positions relative to the frame centre ─────────────
// Burst 1 has 10 characters in four motion groups (measured on the reference: each group moves along its own radial
// curve). Burst 2 keeps those 10 at the same angles further out and adds 12 more. Angles and casting are our own layout.
const polar = (r, deg) => [r * Math.cos(deg * Math.PI / 180), r * Math.sin(deg * Math.PI / 180)];
const B1 = [   // id, expr, group, angle, burst-2 group
  ['writer', 'open', 'horiz', 180, 'g455'], ['builder', 'open', 'horiz', 0, 'g455'],
  ['scout', 'open', 'diag', -34, 'g424'], ['critic', 'blink', 'diag', 21, 'g424'], ['director', 'open', 'diag', 158, 'g424'], ['analyst', 'open', 'diag', -148, 'g424'],
  ['critic', 'open', 'vert', -76, 'g221'], ['scout', 'dots', 'vert', 100, 'g221'],
  ['director', 'blink', 'inner', -120, 'g99'], ['analyst', 'dots', 'inner', 60, 'g99'],
];
const R1 = { inner: 39, vert: 179, diag: 231, horiz: 370 };
const R2 = { g21: 21.7, g99: 99.3, g128: 128.7, g205: 205.4, g221: 221, g253: 253.2, g424: 424.4, g455: 455 };
const B2new = [   // id, expr, group, angle
  ['builder', 'happy', 'g21', 149], ['scout', 'open', 'g21', -31],
  ['writer', 'open', 'g128', -165], ['critic', 'dots', 'g128', -55], ['analyst', 'open', 'g128', 15], ['director', 'open', 'g128', 125],
  ['scout', 'blink', 'g205', -160], ['builder', 'open', 'g205', 20],
  ['critic', 'open', 'g253', 50], ['writer', 'dots', 'g253', 130], ['director', 'open', 'g253', -58], ['analyst', 'blink', 'g253', -122],
];
// body widths (px at rest): sized to the reference's per-burst footprint
const W1 = { writer: 66, builder: 64, scout: 62, critic: 64, director: 64, analyst: 62 };
const W2 = 38;
// radial blur factor for the crowd: 0.22·v reads as the reference's 0.2·v on the blob tool (threshold-cut tails; see notes)
const BK = 1.1;

// ───────────── shot B (n1281–1299): burst 1 ─────────────
scene({
  id: 'w6-burst1', from: 1281, to: 1299, z: 60,
  build(S) {
    S.m = B1.map(([id, ex, g, a], i) => Object.assign(mover(S.cam, id, ex, W1[id], i), { g, a }));
  },
  seek(n, S) {
    const T = M().b1, k = at(T.S, n), dk = mspd(m => at(T.S, m), n, 1281, 1299);
    // the cut frame is soft all over on the reference: sigma ~3 isotropic plus a ~4.5 px radial smear on every character
    const cut = n < 1281.5 ? 3.2 : 0, cutR = n < 1281.5 ? 4.4 : 0;
    for (const m of S.m) {
      const r = R1[m.g] + at(T.dr[m.g], n), v = mspd(mm => at(T.dr[m.g], mm), n, 1281, 1299);
      const [x, y] = polar(r, m.a);
      const sA = Math.hypot(BK * mbs(v), cutR), sX = Math.hypot(mbs(dk * m.w / 2), cut);
      m.set(CX + x, CY + y, k, m.a, Math.hypot(sA, sX), sX, 1);
    }
  },
});

// ───────────── shot C (n1300–1323): burst 2, the collapse, the cluster ─────────────
scene({
  id: 'w6-burst2', from: 1300, to: 1323, z: 60,
  build(S) {
    const all = B1.map(([id, ex, g, a, g2]) => [id, ex, g2, a]).concat(B2new);
    S.m = all.map(([id, ex, g, a], i) => Object.assign(mover(S.cam, id, ex, W2 * (W1[id] / 64), 40 - i), { g, a }));
  },
  seek(n, S) {
    const T = M().b2, k = at(T.S, n), dk = mspd(m => at(T.S, m), n, 1300, 1323);
    for (const m of S.m) {
      const qf = mm => at(mm < 1309 ? T.ent[m.g] : T.R, mm);
      const q = qf(n), dq = mspd(qf, n, 1300, 1323);
      const r = R2[m.g] * q, v = R2[m.g] * dq;
      const [x, y] = polar(r, m.a);
      const sA = Math.hypot(BK * mbs(v), n < 1300.5 ? 1.6 : 0), sX = mbs(dk * m.w / 2);
      m.set(CX + x, CY + y, k, m.a, Math.hypot(sA, sX), sX, 1);
    }
  },
});

// ───────────── shots D–F (n1324–1531): the Writer lands in the media chat; the Hush phone rises, grows, plays; the ship bubble ─────────────
const INK = '#16151B', INK2 = '#6E6B73', PAPER = '#F5F3EF';
const WR = (STORY.crew.find(c => c.id === STORY.chat.media.agent) || {}).tint || '#8B5CF6';
const WR_DK = mixHex(WR, '#16151B', 0.28), WR_TAIL = mixHex(WR, '#FFFFFF', 0.45);
const PH = { W: 362.35, H: 643.9, b: 7, r: 30 };           // the phone at scale 1 (reference geometry: width 362.35, height 643.9)
const TX = 196;                                             // our chat's text edge (key space)
const AV = { x: TX - 60, y: 98, w: 46 };                    // the chat avatar slot (key space)
// streamed text with a tinted tail: each character appears at start + i/rate and cools from `tail` to its own colour over tau frames
function streamLine(parent, parts, opts) {
  const host = text(parent, '', opts); const chars = [];
  for (const [str, color, weight] of parts) for (const ch of str) {
    const sp = document.createElement('span'); sp.textContent = ch; sp.style.opacity = 0; sp._c = color;
    if (weight) sp.style.fontWeight = weight; host.appendChild(sp); chars.push(sp);
  }
  return { host, chars };
}
function streamSet(L, n, start, rate, tail, tau = 0.8, shimmer = null) {
  L.chars.forEach((sp, i) => {
    const age = n - (start + i / rate);
    if (age < 0) { sp.style.opacity = 0; return; }
    sp.style.opacity = 1;
    let c = mix(tail, sp._c, age / tau);
    if (shimmer) { const w = clamp(1 - Math.abs(i - shimmer.c) / shimmer.w) * shimmer.a; if (w > 0) c = mix(sp._c, tail, 0.9 * w); }
    sp.style.color = c;
  });
}
// a Hush screen sized for our phone: drawn at the app's natural 180:390 proportions, then fitted to the phone's taller-than-wide
// window by lifting the tab bar (the last 9 nodes hush() draws) to the window's bottom; the player hides it.
function hushFit(parent, kind, w, h) {
  const k = w / 180, H0 = Math.round(w * 390 / 180);
  const s = hush(parent, kind, { w, h: H0, x: 0, y: 0, r: PH.r - PH.b });
  s.style.height = h + 'px';
  const kids = [...s.children], tabs = kids.slice(-9);
  for (const t of tabs) { if (kind === 'player') t.style.display = 'none'; else t.style.top = (parseFloat(t.style.top) - (H0 - h)) + 'px'; }
  s._k = k; s._kids = kids.slice(0, -9); s._tabs = tabs;
  return s;
}

scene({
  id: 'w6-app', from: 1324, to: 1531, z: 60,
  build(S) {
    S.root.style.display = 'block';   // laid out while visible so text widths are real (mountScenes hides layers before build)
    const c = STORY.chat.media;
    // chat (key space = the reference's n1395 framing; scrolls with MW6.chat.ty)
    S.chat = el(S.cam, 'abs', { left: 0, top: 0, width: '1080px', height: '608px' }); blurrable(S.chat, '-10%', '120%');
    const agent = STORY.crew.find(x => x.id === c.agent);
    S.name = charText(S.chat, agent.name, { x: TX, base: 88, size: 17, weight: 600, color: INK, ls: -0.01 });
    const nw = S.name.node.getBoundingClientRect().width;
    S.chip = el(S.chat, 'abs', { left: (TX + nw + 10) + 'px', top: '68px', height: '24px', padding: '0 10px', borderRadius: '12px',
      background: mixHex(PAPER, WR, 0.14), color: WR_DK, font: '500 13px/24px Inter', letterSpacing: '-0.005em', whiteSpace: 'nowrap' }, c.status);
    // our composition: a two-line headline, a tight list of working steps (dots that turn into checks), a footer line
    // (break at the word boundary closest to the middle of the line)
    const words = c.head.split(' '); let cut = 1, best = 1e9;
    for (let i = 1, pos = 0; i < words.length; i++) { pos += words[i - 1].length + 1; if (Math.abs(pos - c.head.length / 2) < best) { best = Math.abs(pos - c.head.length / 2); cut = i; } }
    S.head = [words.slice(0, cut).join(' ') + ' ', words.slice(cut).join(' ')].map((str, i) =>
      streamLine(S.chat, [[str, INK]], { x: TX, base: 140 + i * 36, size: 30, weight: 700, color: INK, ls: -0.025 }));
    S.steps = c.lines.map(([lead, rest], i) => {
      const base = 213 + i * 25;
      const dot = el(S.chat, 'abs', { left: (TX + 1) + 'px', top: (base - 10) + 'px', width: '7px', height: '7px', borderRadius: '50%', background: mixHex(PAPER, WR, 0.45), opacity: 0 });
      const chk = check(S.chat, TX - 1, base - 13, 12, WR_DK); chk.style.opacity = 0;
      const L = streamLine(S.chat, [[lead + ' ', INK, 600], [rest, INK2, 400]], { x: TX + 19, base, size: 18, weight: 400, color: INK2, ls: -0.01 });
      return { dot, chk, L };
    });
    S.foot = streamLine(S.chat, [[c.foot, INK2]], { x: TX, base: 301, size: 18, weight: 500, color: INK2, ls: -0.01 });
    // the Writer: a tiny figure after the collapse, then the chat's avatar
    S.av = mover(S.cam, c.agent, 'happy', AV.w, 5);
    // the Hush phone (built at full size, scaled down into the chat)
    S.ph = el(S.cam, 'abs', { left: 0, top: 0, width: PH.W + 'px', height: PH.H + 'px', transformOrigin: '0 0', zIndex: 10 });
    blurrable(S.ph, '-20%', '140%');
    const p = phone(S.ph, { x: 0, y: 0, w: PH.W - 2 * PH.b, h: PH.H - 2 * PH.b, b: PH.b, r: PH.r });
    const sw = PH.W - 2 * PH.b, sh = PH.H - 2 * PH.b;
    p.screen.style.background = HUSH.bg;
    S.scr = {};
    for (const kind of ['home', 'library', 'player']) { S.scr[kind] = hushFit(p.screen, kind, sw, sh); S.scr[kind].style.opacity = 0; }
    // library: group the four rows (5 nodes each, drawn after the 6 chip nodes) so the filter switch can clear and refill them
    const lib = S.scr.library, k = lib._k, rowNodes = lib._kids.filter(e => parseFloat(e.style.top) >= 120 * k - 1);
    S.rowsA = el(lib, 'abs', { left: 0, top: 0, width: sw + 'px', height: sh + 'px' });
    rowNodes.forEach(e => S.rowsA.appendChild(e));
    for (const t of lib._tabs) lib.appendChild(t);
    // the filtered list ("Unfinished"): three other shows, each row its own sliding group
    S.rowsB = [0, 1, 2].map(i => {
      const yy = 124 + i * 52, g = el(lib, 'abs', { left: 0, top: yy * k + 'px', width: sw + 'px', height: 46 * k + 'px', transformOrigin: '20% 50%' });
      blurrable(g, '-30%', '160%');
      cover(g, 44 + i * 3, { x: 12 * k, y: 0, w: 44 * k, h: 44 * k, r: 8 * k });
      el(g, 'abs', { left: 64 * k + 'px', top: 6 * k + 'px', font: `600 ${8 * k}px/1.15 Inter`, color: HUSH.fg, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }, STORY.shows[6 + i]);
      el(g, 'abs', { left: 64 * k + 'px', top: 20 * k + 'px', font: `400 ${6 * k}px/1.15 Inter`, color: HUSH.mu, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }, `${2 + i} chapters left`);
      el(g, 'abs', { left: 64 * k + 'px', top: 33 * k + 'px', width: 96 * k + 'px', height: 3 * k + 'px', borderRadius: 2 * k + 'px', background: HUSH.surf2 });
      el(g, 'abs', { left: 64 * k + 'px', top: 33 * k + 'px', width: (70 - i * 16) * k + 'px', height: 3 * k + 'px', borderRadius: 2 * k + 'px', background: HUSH.ac });
      for (const t of lib._tabs) lib.appendChild(t);
      return g;
    });
    // tap ring on the "Unfinished" chip
    const ch1 = lib.parts.chips[1];
    S.ring = el(lib, 'abs', { left: (parseFloat(ch1.style.left) + 21 * k - 9 * k) + 'px', top: (parseFloat(ch1.style.top) + 7 * k - 9 * k) + 'px',
      width: 18 * k + 'px', height: 18 * k + 'px', borderRadius: '50%', border: `${1.2 * k}px solid ${HUSH.ac2}`, boxSizing: 'border-box', opacity: 0 });
    // player: our phone shows its lower half under the ship bubble, so the transport sits at the left under the progress bar;
    // it reads "play" until it is pressed (n1518), then "pause"
    const pl = S.scr.player, pk = pl._k;
    for (const e of pl._kids) if (/^(Recap|Sleep)$/.test(e.textContent) || (Math.abs(parseFloat(e.style.width) - 36 * pk) < 0.05 && Math.abs(parseFloat(e.style.top) - 262 * pk) < 0.05)) e.style.display = 'none';
    const btn = el(pl, 'abs', { left: 22 * pk + 'px', top: 256 * pk + 'px', width: 32 * pk + 'px', height: 32 * pk + 'px', borderRadius: '50%', background: HUSH.ac });
    S.playBtn = el(btn, 'abs', { inset: 0 }, `<svg viewBox="0 0 36 36" width="100%" height="100%"><path d="M11.5 18 H24 M18.5 12.5 L24 18 L18.5 23.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`);   // approve →
    S.pauseBtn = el(btn, 'abs', { inset: 0 }, `<svg viewBox="0 0 36 36" width="100%" height="100%"><path d="M11 18.5 L16 23.5 L25.5 12.5" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`);   // … approved ✓
    el(pl, 'abs', { left: 62 * pk + 'px', top: 262 * pk + 'px', font: `600 ${7.5 * pk}px/1.15 Inter`, color: HUSH.fg, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }, STORY.chat.insights.items[2][0]);
    el(pl, 'abs', { left: 62 * pk + 'px', top: 274 * pk + 'px', font: `400 ${6 * pk}px/1.15 Inter`, color: HUSH.mu, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }, STORY.chat.insights.items[2][1]);
    // the floating ship bubble (frame space, over everything)
    const sb = STORY.bubbles.ship;
    S.bub = el(S.cam, 'abs', { left: 0, top: 0, zIndex: 20 });
    S.pill = el(S.bub, 'abs', { left: 0, top: '-42px', height: '84px', borderRadius: '42px', background: '#FFFFFF',
      boxShadow: '0 10px 30px rgba(22,21,27,.10), 0 0 0 1px rgba(22,21,27,.06)', overflow: 'hidden', transformOrigin: '42px 42px' });
    blurrable(S.pill, '-30%', '160%');
    S.btxt = streamLine(S.pill, [[sb.text, INK]], { x: 34, base: 50, size: 23, weight: 500, color: INK, ls: -0.015 });
    S.btxtW = S.btxt.host.getBoundingClientRect().width;
    S.bchar = mover(S.cam, sb.agent, 'open', 76, 21);
    S.root.style.display = 'none';
  },
  seek(n, S) {
    const W = M(), c = STORY.chat.media;
    // ── chat
    const tyf = m => trk(W.chat.ty, m), ty = tyf(n);
    const chatOn = n >= 1331.5 && n <= 1425;
    S.chat.style.display = chatOn ? 'block' : 'none';
    if (chatOn) {
      S.chat.style.transform = `translate(0px, ${ty.toFixed(2)}px)`;
      S.chat._blur(0, mbs(mspd(tyf, n, 1332, 1425)));   // 0.2·v reads as the reference's ~0.18·v on the tracker
      typeOn(S.name.chars, Math.floor(n - 1331));
      S.name.chars.forEach((sp, i) => { sp.style.color = i === Math.floor(n - 1332) && n < 1338 ? WR_TAIL : INK; });
      S.chip.style.opacity = clamp((n - 1349.5) / 3.5);
      const sh = n >= 1344 && n <= 1361 ? { c: 2 + 1.5 * (n - 1344), w: 3, a: clamp((1361 - n) / 3) * clamp((n - 1343) / 1.5) } : null;
      const h0 = S.head[0].chars.length;
      streamSet(S.head[0], n, 1337.9, 7.5, WR_TAIL, 0.8, sh);
      streamSet(S.head[1], n, 1337.9 + h0 / 7.5, 7.5, WR_TAIL, 0.8, sh && { ...sh, c: sh.c - h0 });
      S.steps.forEach((st, i) => {
        const s0 = [1340.02, 1341.33, 1342.38][i], done = s0 + st.L.chars.length / 21;
        streamSet(st.L, n, s0, 21, WR_TAIL, 0.8);
        st.dot.style.opacity = n >= s0 && n < done + 1 ? 1 : 0;
        st.chk.style.opacity = n >= done + 1 ? 1 : 0;
      });
      streamSet(S.foot, n, 1343.86, 28, WR_TAIL, 1.0);
    }
    // ── the Writer: tiny figure → flies into the avatar slot → rides the chat
    if (n <= 1425) {
      if (!W.chat.ax) for (const [j, key] of [[0, 'ax'], [1, 'ay'], [2, 'aa']]) W.chat[key] = Object.fromEntries(Object.entries(W.chat.av).map(([f, v]) => [f, v[j]]));
      let x, y, k, ang = 0, sA = 0, sX = 0;
      const fx = m => trk(W.chat.ax, m), fy = m => trk(W.chat.ay, m);
      const p = m => clamp((537 - fx(m)) / (537 - 116));
      const X = m => fx(m) + (AV.x - 116) * p(m), Y = m => (m <= 1352 ? fy(m) : 204) + (AV.y - 98.1) * p(m) + (m > 1352 ? ty - trk(W.chat.ty, 1352) : 0);
      x = X(n); y = Y(n); k = Math.sqrt(trk(W.chat.aa, Math.min(n, 1352)) / 1880);
      if (n <= 1352) {
        const vx = mspd(X, n, 1324, 1352), vy = mspd(Y, n, 1324, 1352), v = Math.hypot(vx, vy);
        ang = Math.atan2(vy, vx) * 180 / Math.PI; sA = mbs(v);
      } else { sA = mbs(mspd(tyf, n, 1332, 1425)); ang = 90; }
      S.av.o.style.display = 'block';
      S.av.set(x, y, k, ang, sA, sX, 1);
    } else S.av.o.style.display = 'none';
    // ── the phone
    const P = W.phone, on = n >= 1359.5;
    S.ph.style.display = on ? 'block' : 'none';
    if (on) {
      const sf = m => trk(P.s, m), cxf = m => trk(P.cx, m), Tf = m => trk(P.T, m);
      // our card sits on our chat's text edge, 21 px right of the reference's; the offset melts away as the card flies to the centre
      const prog = m => m < 1408 ? 0 : m >= 1443 ? 1 : clamp((cxf(m) - 265.6) / (539.59 - 265.6));
      const X = m => cxf(m) + (TX - 175) * (1 - prog(m)) - sf(m) * PH.W / 2, Yc = m => Tf(m) + sf(m) * PH.H / 2;
      const s = sf(n);
      S.ph.style.transform = `translate(${X(n).toFixed(2)}px, ${Tf(n).toFixed(2)}px) scale(${s.toFixed(5)})`;
      S.ph.style.opacity = clamp((n - 1359) / 10);
      // no motion blur: the reference phone's edges stay sharp (sigma ~0.6 px) through the rise, the push and the whip
      S.ph._blur(0, 0);
      // screens
      const op = { home: 0, library: 0, player: 0 };
      if (n >= 1373 && n < 1408) {
        const h = clamp((n - 1373) / 10), l = clamp((n - 1399.5) / 1.5);
        op.home = h * (1 - l); op.library = l;
      } else if (n >= 1416.5 && n < 1494) {
        const h = trk({ 1416.5: 0, 1417: 0.15, 1418: 0.26, 1419: 0.33, 1420: 0.46, 1421: 0.52, 1422: 0.64, 1423: 0.7, 1424: 0.81, 1425: 0.9, 1427: 0.93, 1428: 1 }, n);
        const l = clamp((n - 1442.5) / 1.5);
        op.home = h * (1 - l); op.library = l;
      } else if (n >= 1494) { const pl = clamp((n - 1494) / 2); op.library = 1 - pl; op.player = pl; }
      for (const k of Object.keys(op)) { S.scr[k].style.opacity = op[k].toFixed(3); S.scr[k].style.visibility = op[k] > 0 ? 'visible' : 'hidden'; }
      // the library slides up ~14 px inside the phone as it takes over (n1443–1449, read off the reference's header and search bar)
      const lslide = n >= 1442.5 && n < 1449 ? trk({ 1442.5: 16, 1444: 13.6, 1445: 11.0, 1446: 5.1, 1447: 2.6, 1448: 0.9, 1449: 0 }, n) : 0;
      S.scr.library.style.transform = lslide ? `translateY(${lslide.toFixed(2)}px)` : 'none';
      // library filter: tap (n1468–1469), switch (n1470), the filtered rows fly up from below, staggered 2 f
      const chips = S.scr.library.parts.chips, sw = n >= 1470;
      chips[0].style.background = sw ? HUSH.surf2 : HUSH.ac; chips[1].style.background = sw ? HUSH.ac : HUSH.surf2;
      S.ring.style.opacity = n >= 1467.5 && n < 1470 ? (n < 1469 ? 0.5 : 0.9) : 0;
      S.ring.style.transform = `scale(${n < 1469 ? 0.75 : 1})`;
      S.rowsA.style.opacity = sw ? 0 : 1;
      const RISE = { 1470: 200, 1471: 190, 1472: 181, 1473: 169, 1474: 144, 1475: 78, 1476: 34, 1477: 17, 1478: 7, 1479: 2, 1480: 0 };
      S.rowsB.forEach((g, i) => {
        const m = n - 2 * i, k = S.scr.library._k;
        if (!sw || m < 1471.5) { g.style.opacity = 0; return; }
        // the reference's rise curve (its first card's top edge, phone-local), scaled ×1.43 so our first row also peeks in at the
        // frame's bottom edge on n1472 (our rows rest higher than the reference's cards)
        const KR = 1.43, off = KR * trk(RISE, m), v = KR * Math.abs(mspd(mm => trk(RISE, mm), m, 1470, 1490));
        g.style.opacity = 1;
        g.style.transform = `translateY(${off.toFixed(2)}px) rotate(${(-16 * clamp(off / (KR * 144)) ** 1.5).toFixed(2)}deg)`;
        g._blur(v * 0.05, v * 0.17);
      });
      S.playBtn.style.opacity = n < 1518 ? 1 : 0; S.pauseBtn.style.opacity = n < 1518 ? 0 : 1;
    }
    // ── the ship bubble
    const B = W.bub, bOn = n >= 1479.5;
    S.bub.style.display = bOn ? 'block' : 'none'; S.bchar.o.style.display = bOn ? 'block' : 'none';
    if (bOn) {
      const bx = m => trk(B.x, m), by = m => trk(B.y, m);
      const vx = mspd(bx, n, 1480, 1531), vy = mspd(by, n, 1480, 1531), v = Math.hypot(vx, vy);
      const tilt = n < 1489 ? -16 * clamp((1489 - n) / 7) : 0;
      S.bchar.set(bx(n), by(n), 1, v > 0.5 ? Math.atan2(vy, vx) * 180 / Math.PI : 0, mbs(v) * 0.85, 0, 1);
      S.bchar.i.style.transform += ` rotate(${tilt.toFixed(2)}deg)`;
      // pill: pops as a circle at n1490, then widens to fit the line (the reference's growth curve, normalised)
      const g = clamp((trk(B.R, n) - (bx(n) + 66) - 84) / (986 - 385 - 66 - 84), 0, 1.02);
      const wFull = S.btxtW + 34 + 40, w = 84 + g * (wFull - 84);
      S.pill.style.display = n >= 1489.6 ? 'block' : 'none';
      S.bub.style.transform = `translate(${(bx(n) + 66).toFixed(2)}px, ${by(n).toFixed(2)}px)`;
      S.pill.style.width = w.toFixed(2) + 'px';
      S.pill.style.transform = `scale(${n < 1490 ? 0.6 : 1})`;
      const exitX = trk({ 1525: 0, 1526: 0.6, 1527: 1.5, 1528: 2.6, 1529: 4.2, 1530: 14 }, n);
      S.pill._blur(Math.hypot(mbs(vx) + (n < 1493 ? mbs((trk(B.R, n + 0.5) - trk(B.R, n - 0.5)) * 0.4) : 0), exitX), mbs(vy));
      S.bub.style.opacity = n > 1530.5 ? 0 : 1; S.bchar.o.style.opacity = n > 1530.5 ? 0 : 1;
      streamSet(S.btxt, n, 1490.15, 3.5, WR_TAIL, 0.8);
    }
  },
});
})();
