// cue.js: the Cue agent family (Cue by Manus), painted in watercolour and ink with this kit.
//
// Reference: shapes, colours and faces follow the "Give it a cue." line-up in Cue's launch film (@CueAgents, 2026-09-28).
// This is a painted REINTERPRETATION for internal concept work. Swap in Manus's official character art (or get the brand
// team's sign-off) before anything is shown publicly.
//
// Every agent is a limbless flat shape with two big round eyes (white, black pupils) that nearly touch, and at most a tiny
// mouth. With no arms or legs they act with the whole body: squash and stretch, hops, leans, tilts and the eyes. Props
// ride on the head (o.carry) or float beside them; nothing is "held".
//
// cue(x, y, u, o): (x, y) = the ground point under the body; u = size unit (bodies are about 9u wide, 8-9u tall).
// Body-local coordinates: x right, ground at y = 0, up is negative y. It reads the same pose/face fields as clawd()
// (dx, dy, sq, rot, flip, sx, sy, view, smear, eyes, mouth, lookX, lookY, squint, blush, gloom, tint, emote, hat, draw,
// boilKey), so feel(), move(), jump(), take(), turn() and spinView() all work. For acted emotion changes use
// cueEmotions(t, agent, keys): it is emotions() with the agent's own colour fed in, so tints cross-fade from it.

//         colour      body w × h    eye y   mouth y   signature face
const CUE = {
  tri:   { col: '#459BF2', w: 9.8, h: 8.4, ey: -3.1, my: -1.5, mouth: 'smile' },                 // blue triangle: a personal agent ("Christine")
  drop:  { col: '#E63E4F', w: 7.8, h: 9.0, ey: -3.8, my: -2.2, brow: ['flat', 'tilt'] },          // red drop
  star:  { col: '#F6BD0E', w: 9.6, h: 9.2, ey: -4.3, my: -2.9 },                                  // yellow star
  heart: { col: '#8954ED', w: 9.6, h: 8.2, ey: -4.7, my: -3.1, eyes: 'wink' },                    // purple heart, winking
  cog:   { col: '#898989', w: 9.2, h: 9.2, ey: -4.6, my: -3.0, eyes: 'wink' },                    // grey cog: the Cue logo
  mint:  { col: '#1BF0C0', w: 10,  h: 7.4, ey: -3.9, my: -2.3, brow: ['angry', 'angry'] },        // mint round, stern brows
  brief: { col: '#AB6C49', w: 9.4, h: 7.4, ey: -3.6, my: -2.1, brow: ['tilt', 'flat'], top: -9.0 },// brown briefcase (handle above)
  ghost: { col: '#D1473D', w: 9.0, h: 8.6, ey: -5.0, my: -3.5, mouth: 'smile' },                 // red ghost ("Lucky Dumpling")
  blob:  { col: '#439CF0', w: 8.2, h: 9.6, ey: -6.0, my: -4.3, mouth: 'open', float: 1.4 },      // blue blob, floats
};
const CUE_NAMES = Object.keys(CUE);
const CUE_WHITE = '#FCFAF5';

// ---------- shapes (built once, unit-free, then fitted to w × h with the base on the ground) ----------
function roundPoly(V, r, seg = 6) {   // a polygon with every corner rounded (quadratic, radius r along each edge)
  const out = [];
  V.forEach((v, i) => {
    const a = V[(i + V.length - 1) % V.length], b = V[(i + 1) % V.length];
    const da = Math.hypot(a[0] - v[0], a[1] - v[1]), db = Math.hypot(b[0] - v[0], b[1] - v[1]);
    const ra = Math.min(r, da * .45), rb = Math.min(r, db * .45);
    const p0 = [v[0] + (a[0] - v[0]) / da * ra, v[1] + (a[1] - v[1]) / da * ra], p1 = [v[0] + (b[0] - v[0]) / db * rb, v[1] + (b[1] - v[1]) / db * rb];
    for (let k = 0; k <= seg; k++) { const s = k / seg, q = 1 - s; out.push([q * q * p0[0] + 2 * q * s * v[0] + s * s * p1[0], q * q * p0[1] + 2 * q * s * v[1] + s * s * p1[1]]); }
  });
  return out;
}
function loopSmooth(P, n = 6) {       // closed Catmull-Rom through the points
  const N = P.length, out = [];
  for (let i = 0; i < N; i++) {
    const p0 = P[(i + N - 1) % N], p1 = P[i], p2 = P[(i + 1) % N], p3 = P[(i + 2) % N];
    for (let k = 0; k < n; k++) {
      const u = k / n, u2 = u * u, u3 = u2 * u;
      out.push([0, 1].map(d => .5 * (2 * p1[d] + (p2[d] - p0[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * u3)));
    }
  }
  return out;
}
const mirrorHalf = R => R.concat(R.slice(1, -1).reverse().map(([x, y]) => [-x, y]));   // right half (top → bottom centre) → closed
function fitPts(P, w, h) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return P.map(([x, y]) => [(x - (x0 + x1) / 2) * w / (x1 - x0), (y - y1) * h / (y1 - y0)]);
}
const CUE_SHAPES = {};
function cueShape(name) {
  if (CUE_SHAPES[name]) return CUE_SHAPES[name];
  let P;
  switch (name) {
    case 'tri': P = roundPoly([[-1, 0], [1, 0], [0, -1.7]], .34); break;
    case 'drop': P = loopSmooth([[0, 0], [-.72, -.22], [-1, -.95], [-.8, -1.62], [-.36, -2.14], [.2, -2.66], [.2, -2.66], [.27, -2.22], [.52, -2.02], [.86, -1.58], [1, -.95], [.72, -.22]], 7); break;
    case 'star': P = roundPoly(starPts(0, 0, 1, .56, 5), .13, 5); break;
    case 'heart': P = heartPts(0, 0, 1, 48); break;
    case 'cog': P = []; for (let i = 0; i < 90; i++) { const a = i / 90 * TAU, r = 1 + .1 * Math.cos(9 * a + Math.PI / 2); P.push([Math.cos(a) * r, Math.sin(a) * r]); } break;
    case 'mint': P = ellPts(0, 0, 1.35, 1, 48); break;
    case 'brief': P = rrPts(-1.27, -1, 2.54, 2, .3); break;
    case 'ghost': P = loopSmooth(mirrorHalf([[0, -2.1], [.62, -1.98], [.95, -1.55], [.98, -1.05], [1.2, -.62], [1.06, -.2], [.64, -.26], [.34, -.04], [0, 0]]), 6); break;
    case 'blob': P = []; for (let i = 0; i < 48; i++) { const a = i / 48 * TAU, r = 1 + .05 * Math.sin(2 * a + 1) + .035 * Math.cos(3 * a + .5), x = .85 * r * Math.cos(a), y = r * Math.sin(a), c = Math.cos(-.12), s = Math.sin(-.12); P.push([x * c - y * s, x * s + y * c]); } break;
    default: P = ellPts(0, 0, 1, 1, 40);
  }
  const A = CUE[name] || CUE.tri;
  return (CUE_SHAPES[name] = fitPts(P, A.w, A.h));
}
// Clip a polygon to one side of a horizontal line (keepBelow: the part with y >= yc, nearer the ground).
function clipY(P, yc, keepBelow = true) {
  const inside = p => keepBelow ? p[1] >= yc : p[1] <= yc, out = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) { const k = (yc - a[1]) / (b[1] - a[1]); out.push([lerp(a[0], b[0], k), yc]); }
  }
  return out;
}

// ---------- views ----------
// Flat shapes turn by sliding the face toward the heading, like a drawn model sheet: no 3D. sx narrows the body a touch.
const CUE_VIEWS = {
  front: { face: { cx: 0, fw: 1, sides: [-1, 1] }, sx: 1 },
  q:     { face: { cx: 1.5, fw: .8, sides: [-1, 1] }, sx: .96 },
  side:  { face: { cx: 2.3, fw: .62, sides: [1] }, sx: .86 },
  qback: { face: null, sx: .96 },
  back:  { face: null, sx: 1 },
};

// ---------- the agent ----------
function cue(x, y, u, o = {}) {
  const name = CUE[o.agent] ? o.agent : 'tri', A = CUE[name];
  const id = o.boilKey ?? ++CLAWD_N, rs = part => boilSeed(`cue ${id} ${part}`);
  const V = CUE_VIEWS[o.view] || CUE_VIEWS.front;
  const fl = A.float ? -A.float - .25 * Math.sin(T * 2.2 + id) : 0;
  x += (o.dx || 0) * u;
  const dy = ((o.dy || 0) + fl) * u, sq = (o.sq || 0) + (o.take || 0), sm = clamp(o.smear || 0);
  const sw = clamp(u / 15, .45, 2.4) * (o.swMul || 1), J = u * .06;
  const base = { col: o.col || A.col, dk: o.dk || mixCol(A.col, PAL.ink, .32), lt: o.lt || mixCol(A.col, '#FFFFFF', .5) };
  const { col, dk, lt } = tintCols({ ...base, tint: o.tint, tintK: o.tintK }), line = mixCol(dk, PAL.ink, .45);
  const top = (A.top ?? -A.h);

  rs('shadow');
  if (!o.noShadow) {
    const f = 1 - Math.min(.55, Math.abs(dy / u) * .07);
    paint(ellPts(x, y + u * .15, u * A.w * .5 * f, u * .85 * f, 22), { fill: PAL.ink, fillOp: 80, bleed: .25, tex: .3, border: .1, ink: null });
  }
  if (sm > .05) smearTrail(x, y + dy, u, { R: A.w / 2 }, sm, o.smearDir ?? (o.flip ? -1 : 1), col);

  push();
  translate(x, y + dy);
  if (o.rot) rotate(o.rot);
  scale((o.flip ? -1 : 1) * (o.sx ?? 1) * V.sx * (1 + sq * .6) * (1 + sm * .35), (o.sy ?? 1) * (1 - sq));

  rs('shape'); const body = cueShape(name).map(([px, py]) => [px * u + jit(J), py * u + jit(J)]);
  if (name === 'brief') {   // the handle: one arch behind the case
    rs('handle');
    paint(ribbon([[-1.9 * u, -7.0 * u], [-1.75 * u, -8.5 * u], [0, -8.75 * u], [1.75 * u, -8.5 * u], [1.9 * u, -7.0 * u]], .95 * u, .95 * u), { wash: dk, washOp: 255, ink: line, sw: sw * .7 });
  }
  rs('body');
  paint(body, { wash: col, washOp: 255, ink: null });
  // a soft highlight: the body shrunk toward a point up and left of its middle (always inside the silhouette)
  const hc = [-.12 * A.w * u, -.6 * A.h * u];
  paint(body.map(([px, py]) => [lerp(hc[0], px, .48), lerp(hc[1], py, .42)]), { fill: lt, fillOp: 110, bleed: .18, tex: .85, border: .8, ink: null });
  // shade along the base
  paint(clipY(body, -.3 * A.h * u), { fill: dk, fillOp: 110, bleed: .04, tex: .7, border: .5, ink: null });
  if (o.gloom > .02) paint(clipY(body, -.62 * A.h * u, false), { fill: PAL.indigo, fillOp: 150 * o.gloom, bleed: .08, tex: .5, border: .6, ink: null });
  paint(body, { ink: line, sw: sw * .9, curv: 0 });

  if (V.face) {
    const F = V.face;
    push(); translate(F.cx * u, 0); scale(F.fw, 1);
    if (o.blush) { rs('blush'); for (const s of F.sides) paint(ellPts(s * 2.1 * u, (A.ey + 1.25) * u, .8 * u, .38 * u, 14), { fill: PAL.rose, fillOp: 170 * clamp(o.blush === true ? 1 : o.blush), bleed: .2, ink: null }); }
    rs('eyes'); cueEyes(u, o, A, sw, F.sides, col, sm);
    const m = o.mouth === undefined ? A.mouth : o.mouth;
    if (m) { rs('mouth'); push(); translate(0, A.my * u); scale(.55); translate(0, 4.3 * u); mouth(u, m, sw / .55); pop(); }
    pop();
  }
  if (o.hat) { rs('hat'); const hs = .78; push(); translate(0, top * u); scale(hs); translate(0, 8 * u); hat(u, o.hat, sw / hs); pop(); }
  if (o.carry) { rs('carry'); push(); translate(0, top * u); o.carry(u, sw); pop(); }
  rs('draw'); if (o.draw) o.draw(u, sw);
  pop();

  rs('emote');
  if (o.emote) {
    const isTop = EMOTE_TOP.includes(o.emote), dir = o.flip ? -1 : 1;
    const ex = isTop ? x : x + dir * (A.w / 2 + .3) * u, ey = y + dy + (isTop ? top - 2.4 : top - .4) * u * (1 - sq);
    emote(o.emote, ex, ey, u * .9, o.emoteK ?? 1, o.emoteAge ?? T);
  }
  rs('after');
}

// ---------- eyes ----------
// Cue eyes: two white ovals that nearly touch, with round black pupils. Kinds follow clawd's list (normal, look, wide,
// happy, closed, sleepy, wink, narrow, angry, determined, sad, teary, cry, squeeze, shine, scared, blank, spark, red,
// heart, x, swirl, dot, shades) plus 'chev' (the logo's "<" wink). 'wink' = one open eye and one chev, as on the logo.
const BROWED = ['normal', 'look', 'wide', 'narrow', 'shine', 'scared', 'blank', 'dot', 'red'];
function cueEyes(u, o, A, sw, sides, col, smear = 0) {
  const req = o.eyes && o.eyes !== 'normal' ? o.eyes : (A.eyes || 'normal');
  const kinds = Array.isArray(req) ? req : req === 'wink' ? ['normal', 'chev'] : [req, req];
  const sqz = clamp(o.squint || 0), ey = A.ey * u, gap = 1.0 * u;
  if (smear > .5 || sqz > .8) { for (const s of sides) inkLine([[s * gap - .8 * u, ey], [s * gap + .8 * u, ey]], sw * 1.2, PAL.ink, 'ink', 0); return; }
  if (kinds[0] === 'shades') {
    for (const s of sides) paint(rrPts(s * gap - 1.05 * u, ey - .85 * u, 2.1 * u, 1.55 * u, .55 * u), { wash: '#2A2740', ink: PAL.ink, sw: sw * .7 });
    if (sides.length > 1) inkLine([[-.2 * u, ey - .45 * u], [.2 * u, ey - .45 * u]], sw * .9, PAL.ink, 'ink', 0);
    for (const s of sides) inkLine([[s * gap - .6 * u, ey - .3 * u], [s * gap - .15 * u, ey - .65 * u]], sw * .4, PAL.cream, 'inkfine', 0);
    return;
  }
  if (sqz > 0) { push(); translate(0, ey); scale(1 + sqz * .15, 1 - sqz); translate(0, -ey); }
  for (const s of sides) {
    const k = kinds[s < 0 ? 0 : 1];
    push(); translate(s * gap, ey); cueEye(k, s, u, o, sw, col);
    const br = A.brow && BROWED.includes(k) ? A.brow[s < 0 ? 0 : 1] : null;
    if (br) cueBrow(br, s, u, sw, col);
    pop();
  }
  if (sqz > 0) pop();
}
function cueBrow(kind, s, u, sw, col) {   // s = -1 left eye, 1 right; the face's middle is toward -s
  const bar = (o, i) => inkLine([[s * .95 * u, o * u], [-s * .1 * u, lerp(o, i, .55) * u], [-s * .95 * u, i * u]], sw * 1.9, PAL.ink, 'ink', .3);
  if (kind === 'flat') bar(-1.65, -1.6);
  else if (kind === 'tilt') bar(-1.45, -1.9);
  else if (kind === 'angry') {   // slants DOWN toward the middle and cuts the top of the eye
    paint([[s * 1.2 * u, -1.6 * u], [-s * 1.2 * u, -1.6 * u], [-s * 1.2 * u, -.55 * u], [s * 1.2 * u, -1.35 * u]], { wash: col, washOp: 255, ink: null });
    bar(-1.4, -.6);
  } else if (kind === 'sad') {   // slants UP toward the middle (worried)
    paint([[s * 1.2 * u, -1.6 * u], [-s * 1.2 * u, -1.6 * u], [-s * 1.2 * u, -1.3 * u], [s * 1.2 * u, -.75 * u]], { wash: col, washOp: 255, ink: null });
    bar(-.8, -1.45);
  }
}
function cueEye(e, s, u, o, sw, col) {
  const lx = (o.lookX || 0) * .36 * u, ly = (o.lookY || 0) * .45 * u;
  const sclera = (rx = .95, ry = 1.18, cy = 0) => paint(ellPts(0, cy * u, rx * u, ry * u, 20), { wash: CUE_WHITE, ink: null });
  const pupil = (r = .55, px = lx, py = ly, c = PAL.ink) => paint(ellPts(px, py, r * u, r * 1.08 * u, 14), { wash: c, ink: null });
  const glint = (px = lx, py = ly, r = .15) => { if (u > 7) paint(ellPts(px - .2 * u, py - .27 * u, r * u, r * 1.15 * u, 8), { wash: CUE_WHITE, ink: null }); };
  const blinkOn = ['normal', 'look', 'wide'].includes(e) && ((T * .9 + (o.seed || 0) * 1.7) % 3.3) < .12;
  if (blinkOn) { inkLine([[-.8 * u, .15 * u], [0, .4 * u], [.8 * u, .15 * u]], sw * 1.2, PAL.ink, 'ink', .4); return; }
  switch (e) {
    case 'normal': case 'look': sclera(); pupil(); glint(); break;
    case 'wide': sclera(1.05, 1.34); pupil(.45); glint(); break;
    case 'narrow': sclera(.95, .62, .3); pupil(.42, lx, .32 * u + ly * .4); break;
    case 'sleepy':
      sclera(); pupil(.5, lx, .4 * u);
      paint(clipY(ellPts(0, 0, 1 * u, 1.24 * u, 20), .1 * u, false), { wash: col, washOp: 255, ink: null });
      inkLine([[-.95 * u, .1 * u], [0, .2 * u], [.95 * u, .1 * u]], sw * 1.1, PAL.ink, 'ink', .4); break;
    case 'angry': case 'determined':
      sclera(); pupil(.5, lx, .2 * u + ly); cueBrow(e === 'angry' ? 'angry' : 'tilt', s, u, sw, col); break;
    case 'sad': case 'teary':
      sclera(); pupil(.5, lx, .35 * u + Math.max(0, ly)); glint(lx, .35 * u); cueBrow('sad', s, u, sw, col);
      if (e === 'teary') { const w = Math.sin(T * 9 + s) * .06 * u; paint(ellPts(0, 1.05 * u + w, .95 * u, .35 * u, 14), { wash: PAL.sky, washOp: 210, ink: PAL.ink, sw: sw * .4 }); }
      break;
    case 'chev':   // "<" on the right eye, ">" on the left: the point faces the middle
      inkLine([[s * .55 * u, -.7 * u], [-s * .45 * u, 0], [s * .55 * u, .7 * u]], sw * 1.9, PAL.ink, 'ink', 0); break;
    case 'scared': sclera(1.05, 1.3); pupil(.28, lx * .3 + Math.sin(T * 40) * .04 * u, .1 * u); break;
    case 'blank': sclera(); break;
    case 'dot': pupil(.45); break;
    case 'shine': sclera(); pupil(.66); glint(lx, ly, .22); paint(ellPts(lx + .25 * u, ly + .3 * u, .1 * u, .1 * u, 8), { wash: CUE_WHITE, ink: null }); break;
    case 'red': sclera(); glow(lx, ly, 2.2 * u, '#FF4A5A', .5); pupil(.55, lx, ly, '#E0283F'); break;
    case 'happy': case 'closed': case 'heart': case 'spark': case 'x': case 'swirl': case 'cry': case 'squeeze':
      push(); scale(.95); eye(e, s, u, o, sw); pop(); break;
    default: sclera(); pupil(); glint();
  }
}

// ---------- acting ----------
// cueFeel(agent, name, t, over): feel() for an agent. cueEmotions(t, agent, keys, opt): emotions() with the agent's own
// colours, so mood tints cross-fade from its body colour instead of clawd's clay. Spread either into cue():
//   cue(x, y, u, { agent: 'star', ...cueEmotions(t, 'star', [[0, 'sleepy'], [1.2, 'surprised'], [1.8, 'excited']]) })
function cueCols(agent) { const A = CUE[agent] || CUE.tri; return { col: A.col, dk: mixCol(A.col, PAL.ink, .32), lt: mixCol(A.col, '#FFFFFF', .5) }; }
function cueFeel(agent, name, t, over = {}) { return { agent, ...feel(name, t, over) }; }
function cueEmotions(t, agent, keys, opt = {}) {
  const c = cueCols(agent);
  return { agent, ...emotions(t, keys.map(([k, n, ov]) => [k, n, { ...c, ...(ov || {}) }]), opt) };
}
