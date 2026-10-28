// map — a map that draws its route: an abstract city generated from the seed (no real geography: land, a river, parks,
// a rotated street grid with avenues and blocks, in the brand's line colour; light by default, dark with theme: dark).
// A route curve draws itself through 2–6 stops (a faint planned path under it, a travelling head at its tip); a pin
// drops at each stop as the head arrives (≤ 8 % overshoot, a pulse ring) and its label chip pops beside it; the block's
// own camera follows the head (≤ 6 % of the frame). Optional headline.
import { F } from './_film.js';
import { M } from './_motion.js';

// the headline's zone per aspect for validate: [W, H, font px, safe x0, y0, x1, y1, share of the safe width it may take]
const HEAD_BOX = { '16x9': [1920, 1080, 84, .07, .09, .93, .91, .62], '9x16': [1080, 1920, 76, .12, .12, .88, .78, 1], '1x1': [1080, 1080, 72, .07, .09, .93, .91, .62] };
const DEFAULT_STOPS = [{ pos: [.24, .72], label: 'Pickup' }, { pos: [.52, .46], label: 'Studio' }, { pos: [.79, .63], label: 'Launch' }];
const stopsOf = s => Array.isArray(s.stops) && s.stops.length ? s.stops.map((x, i) => ({ pos: Array.isArray(x && x.pos) ? x.pos.map(Number) : [.5, .5], label: x && x.label != null ? String(x.label) : '' })) : DEFAULT_STOPS;
// the route schedule (aspect-independent, so cues match every aspect): pin 0 at frame 8, the route draws from 14 to
// ~70 % of the shot, each leg's time ∝ its length, a 3-frame dwell at each middle stop
function plan(s, D) {
  const st = stopsOf(s), n = st.length, dwell = 3;
  const len = st.slice(1).map((p, j) => Math.hypot((p.pos[0] - st[j].pos[0]) * 1.6, p.pos[1] - st[j].pos[1]) || .01), L = len.reduce((a, b) => a + b, 0);
  const t0 = 14, tEnd = Math.max(t0 + 12 * (n - 1), Math.min(D - 14, Math.round(D * .7)));
  const span = Math.max(6 * (n - 1), tEnd - t0 - dwell * (n - 2));
  const legs = [], arrive = [8];
  let t = t0;
  len.forEach((l, j) => { const d = span * l / L; legs.push({ a: t, b: t + d }); arrive.push(t + d); t += d + dwell; });
  return { st, n, legs, arrive, t0, end: arrive[n - 1], len, L };
}
export default {
  name: 'map',
  doc: 'A map that draws its route: an abstract generated city (land, river, parks, street grid; light or theme: dark), a route curve drawn through 2–6 stops with a travelling head, pins dropping on arrival with a pulse, label chips, the camera following the head; optional headline.',
  layers: 'map · route · pins · labels · text',
  media: [],
  copy: s => [s.text, ...stopsOf(s).map(x => x.label)].filter(x => x != null && String(x).trim() !== '').map(String),
  read: s => [s.text, ...stopsOf(s).map(x => x.label)].filter(x => x != null && String(x).trim() !== '').map(String),
  params: {
    stops: 'list of 2–6 {pos: [x, y] (fractions of the frame), label} — the route runs through them in order (default: a 3-stop route)',
    text: 'optional headline (top left; *accent* ok)',
    theme: '(any shot) light (default) or dark',
  },
  required: [],
  validate(s, D) {
    const w = [], P = plan(s, D);
    if (D < 60) w.push(`map ${s.id}: ${D} frames is short for a route to draw and its pins to land; give it ≥ 2 s (3–4 s reads best)`);
    for (let j = 1; j < P.n; j++) if (P.legs[j - 1].b - P.legs[j - 1].a < 8) w.push(`map ${s.id}: leg ${j} → ${j + 1} draws in ${(P.legs[j - 1].b - P.legs[j - 1].a).toFixed(0)} frames — too fast to follow; lengthen the shot or drop a stop`);
    // a stop under the headline (top left): its pin would sit under the line (an estimate of the headline's box per aspect)
    if (s.text) for (const [j, st] of P.st.entries()) {
      const under = Object.entries(HEAD_BOX).filter(([, [W, H, size, x0, y0, x1, y1, wf]]) => {
        const sw = (x1 - x0) * W, maxW = sw * wf, est = String(s.text).replace(/[*|]/g, '').length * .52 * size, lines = est > maxW ? 2 : 1;
        const hx1 = x0 * W + Math.min(est, maxW) + 20, hy1 = y0 * H + lines * size * 1.04 + 24, px = st.pos[0] * W, py = st.pos[1] * H;
        return px + 26 > x0 * W - 20 && px - 26 < hx1 && py > y0 * H - 20 && py - 70 < hy1;
      }).map(([a]) => a);
      if (under.length) w.push(`map ${s.id}: stop ${j + 1}${st.label ? ` (${st.label})` : ''} sits under the headline on ${under.join(', ')} — move it lower or right, or drop the text`);
    }
    // a stop whose pin (≈ 70 px tall above its tip, 50 px wide) leaves the safe box is cut off or runs under the platform's
    // UI (review fix #6): safe = 7–93 % × 9–91 % on 16:9 / 1:1, 12–88 % × 12–78 % on 9:16
    for (const [j, st] of P.st.entries()) {
      const off = Object.entries({ '16x9': [1920, 1080, .07, .09, .93, .91], '9x16': [1080, 1920, .12, .12, .88, .78], '1x1': [1080, 1080, .07, .09, .93, .91] }).filter(([, [W, H, x0, y0, x1, y1]]) => {
        const u = Math.min(W, H) / 1080, px = st.pos[0] * W, py = st.pos[1] * H;
        return px - 26 * u < x0 * W || px + 26 * u > x1 * W || py - 70 * u < y0 * H || py > y1 * H;
      }).map(([a]) => a);
      if (off.length) w.push(`map ${s.id}: stop ${j + 1}${st.label ? ` (${st.label})` : ''} at [${st.pos.join(', ')}] is outside the safe area on ${off.join(', ')} — its pin is cut off or under the platform's buttons; keep stops within x .12–.88, y .16–.78 (all aspects)`);
    }
    return w;
  },
  cues(s, D) {
    const P = plan(s, D), out = P.arrive.map((t, j) => ({ t, kind: 'pop', note: [79, 83, 86, 88, 91, 93][j] || 93, gain: .7 }));
    for (let t = P.t0 + 4; t < P.end - 3; t += 9) out.push({ t, kind: 'tick', gain: .35 });
    return out;
  },
  hero: (s, D) => { const P = plan(s, D); return Math.max(8, Math.min(D - 8, Math.round(P.end + 12))); },
  async build(ctx, s) {
    const { W, H, u, safe, portrait, square } = ctx, C = ctx.C, dark = ctx.dark;
    const P = plan(s, ctx.D), r = F.rng(F.hash('map:' + s.id));
    const pal = dark
      ? { land: '#15161B', block: '#1A1B21', park: '#15281E', parkEdge: '#1C3426', water: '#0D1A29', shore: '#11243A', minor: 'rgba(255,255,255,.07)', major: '#2A2C35', majorCase: '#0F1014' }
      : { land: M.mix(C.bg, '#EEEDE8', .55), block: M.mix(C.bg, '#E4E3DE', .6), park: '#D3EBCB', parkEdge: '#C2E0B8', water: M.mix('#BCD8F1', C.accent, .1), shore: M.mix('#A9CBEA', C.accent, .1), minor: M.rgba(C.line, .55), major: '#FFFFFF', majorCase: M.rgba(C.line, .9) };
    // ── the city (one SVG, bigger than the frame by m on each side so the follow-pan never shows an edge)
    const m = .1, MW = W * (1 + 2 * m), MH = H * (1 + 2 * m), ox = m * W, oy = m * H;
    const ang = (r() < .5 ? -1 : 1) * (9 + 12 * r()) * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang);
    const gs = (portrait ? 74 : 68) * u, ext = Math.hypot(MW, MH);
    const R2 = (x, y) => [MW / 2 + x * ca - y * sa, MH / 2 + x * sa + y * ca];          // grid space → map px
    const seg = (a, b) => `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
    let blocks = '', minor = '', major = '';
    const nG = Math.ceil(ext / gs / 2) + 1;
    for (let k = -nG; k <= nG; k++) {
      const big = ((k % 4) + 4) % 4 === 0;
      (big ? (x => { major += x; }) : (x => { minor += x; }))(seg(R2(k * gs, -ext / 2), R2(k * gs, ext / 2)) + seg(R2(-ext / 2, k * gs), R2(ext / 2, k * gs)));
    }
    // blocks: building footprints inside some cells (rotated with the grid)
    const inset = gs * .16;
    for (let i = -nG; i < nG; i++) for (let j = -nG; j < nG; j++) {
      const q = r();
      if (q < .35) continue;
      const [x, y] = R2((i + .5) * gs, (j + .5) * gs);
      if (x < -gs || y < -gs || x > MW + gs || y > MH + gs) continue;
      const sub = q > .8 ? 2 : 1, w = (gs - 2 * inset) / sub;
      for (let a = 0; a < sub; a++) for (let b = 0; b < sub; b++) {
        const [bx, by] = R2(i * gs + inset + a * w + (sub > 1 ? 2 * u : 0), j * gs + inset + b * w + (sub > 1 ? 2 * u : 0));
        blocks += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${(w - (sub > 1 ? 4 * u : 0)).toFixed(1)}" height="${(w - (sub > 1 ? 4 * u : 0)).toFixed(1)}" rx="${(3 * u).toFixed(1)}" transform="rotate(${(ang * 180 / Math.PI).toFixed(3)} ${bx.toFixed(1)} ${by.toFixed(1)})"/>`;
      }
    }
    // a diagonal avenue
    const av = [R2(-ext / 2, -ext * .18 + r() * gs), R2(ext / 2, ext * .3 - r() * gs)];
    // the river: a smooth band across the map (left → right, or top → bottom on 9:16), clear of the stops' middle
    const rv = portrait ? [[MW * (.15 + .2 * r()), -40 * u], [MW * (.9 - .2 * r()), MH * .3], [MW * (.1 + .25 * r()), MH * .62], [MW * (.75 + .2 * r()), MH + 40 * u]]
      : [[-40 * u, MH * (.12 + .15 * r())], [MW * .35, MH * (.05 + .2 * r())], [MW * .62, MH * (.95 - .2 * r())], [MW + 40 * u, MH * (.86 - .15 * r())]];
    const rpath = `M${rv[0][0].toFixed(1)} ${rv[0][1].toFixed(1)}C${rv[1][0].toFixed(1)} ${rv[1][1].toFixed(1)} ${rv[2][0].toFixed(1)} ${rv[2][1].toFixed(1)} ${rv[3][0].toFixed(1)} ${rv[3][1].toFixed(1)}`;
    const rw = Math.min(W, H) * (.1 + .03 * r());
    // parks: soft blobs
    const blob = (cxp, cyp, rad) => {
      const k = 9, pts = Array.from({ length: k }, (_, i) => { const a = i / k * Math.PI * 2, rr = rad * (.78 + .38 * r()); return [cxp + Math.cos(a) * rr * 1.25, cyp + Math.sin(a) * rr]; });
      let d = '';
      for (let i = 0; i < k; i++) {
        const p0 = pts[(i - 1 + k) % k], p1 = pts[i], p2 = pts[(i + 1) % k], p3 = pts[(i + 2) % k];
        if (!i) d += `M${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
        d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
      }
      return d + 'Z';
    };
    const parks = [blob(MW * (portrait ? .7 : .78), MH * (portrait ? .2 : .26), Math.min(W, H) * .14), blob(MW * (portrait ? .22 : .16), MH * (portrait ? .86 : .82), Math.min(W, H) * .11)];
    const sw = { minor: 3 * u, major: 13 * u, avenue: 17 * u };
    const mapSvg = `<svg width="${MW}" height="${MH}" viewBox="0 0 ${MW} ${MH}" style="position:absolute;left:0;top:0;display:block">
      <rect width="${MW}" height="${MH}" fill="${pal.land}"/>
      <g fill="${pal.block}">${blocks}</g>
      <path d="${minor}" stroke="${pal.minor}" stroke-width="${sw.minor}" fill="none"/>
      ${parks.map(d => `<path d="${d}" fill="${pal.park}" stroke="${pal.parkEdge}" stroke-width="${2 * u}"/>`).join('')}
      <path d="${rpath}" stroke="${pal.shore}" stroke-width="${rw + 8 * u}" fill="none"/>
      <path d="${rpath}" stroke="${pal.water}" stroke-width="${rw}" fill="none"/>
      <path d="${major}${seg(av[0], av[1])}" stroke="${pal.majorCase}" stroke-width="${sw.major + 3 * u}" fill="none"/>
      <path d="${major}" stroke="${pal.major}" stroke-width="${sw.major}" fill="none"/>
      <path d="${seg(av[0], av[1])}" stroke="${pal.major}" stroke-width="${sw.avenue}" fill="none"/>
    </svg>`;
    const mapEl = ctx.el(mapSvg, `left:${-ox}px;top:${-oy}px;width:${MW}px;height:${MH}px;transform-origin:${MW / 2}px ${MH / 2}px`, 'map');
    // ── headline, top-left, over a soft land-coloured fade that belongs to the map (under the route, pins and chips);
    // the chips keep clear of the headline's box and the follow-pan never carries one into it
    let text = null, scrim = null, hb = null;
    if (s.text) {
      const size = portrait ? 76 : square ? 72 : 84;
      text = ctx.text(s.text, { size, align: 'left', style: 'text-wrap:balance;',  maxW: safe.w * (portrait ? 1 : .62), lines: 2, min: 60, layer: 'text', color: dark ? '#FFFFFF' : C.ink, accent: C.accent });
      text.style.left = safe.x0 + 'px'; text.style.top = safe.y0 + 'px';
      const rg = document.createRange(); rg.selectNodeContents(text); const r = rg.getBoundingClientRect(), z = ctx.el('', `left:0;top:0;width:${W}px;height:1px`), sb = z.getBoundingClientRect(), k = sb.width ? W / sb.width : 1; z.remove();
      hb = { x0: (r.left - sb.left) * k, y0: (r.top - sb.top) * k, x1: (r.right - sb.left) * k, y1: (r.bottom - sb.top) * k };
      const sh = Math.min(H * (portrait ? .3 : .42), hb.y1 + H * .14), mid = (hb.y1 / sh * 100).toFixed(1);
      scrim = ctx.el('', `left:0;top:0;width:${W}px;height:${sh}px;background:linear-gradient(180deg,${M.rgba(pal.land, .94)} 0%,${M.rgba(pal.land, .8)} ${mid}%,${M.rgba(pal.land, 0)} 100%)`, 'map');
    }

    // ── the route: a Catmull-Rom curve through the stops (stage px), a faint planned path + the drawn accent route
    const pts = P.st.map(x => [x.pos[0] * W, x.pos[1] * H]);
    const legD = j => { const p0 = pts[Math.max(0, j - 1)], p1 = pts[j], p2 = pts[j + 1], p3 = pts[Math.min(pts.length - 1, j + 2)]; return `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(2)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(2)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(2)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`; };
    const full = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}` + pts.slice(1).map((_, j) => legD(j)).join('');
    const acc = C.accent, rwid = 9 * u;
    const route = ctx.el(`<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;overflow:visible">
      <path class="mk-plan" d="${full}" fill="none" stroke="${dark ? 'rgba(255,255,255,.32)' : M.rgba(C.ink, .28)}" stroke-width="${(4 * u).toFixed(2)}" stroke-linecap="round" stroke-dasharray="${(2 * u).toFixed(2)} ${(13 * u).toFixed(2)}" opacity="0"/>
      <path class="mk-case" d="${full}" fill="none" stroke="${dark ? '#0B0B0E' : '#FFFFFF'}" stroke-width="${(rwid + 7 * u).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>
      <path class="mk-route" d="${full}" fill="none" stroke="${acc}" stroke-width="${rwid.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>
      <circle class="mk-halo" r="${(26 * u).toFixed(2)}" fill="${acc}" opacity="0"/>
      <circle class="mk-head" r="${(11 * u).toFixed(2)}" fill="${acc}" stroke="#FFFFFF" stroke-width="${(5 * u).toFixed(2)}" opacity="0"/></svg>`, `left:0;top:0;width:${W}px;height:${H}px`, 'route');
    const q = sel => route.querySelector(sel), rPath = q('.mk-route'), rCase = q('.mk-case'), rPlan = q('.mk-plan'), head = q('.mk-head'), halo = q('.mk-halo');
    const Ltot = rPath.getTotalLength();
    const legLen = pts.slice(1).map((_, j) => { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', `M${pts[j][0]} ${pts[j][1]}` + legD(j)); route.firstElementChild.appendChild(p); const l = p.getTotalLength(); p.remove(); return l; });
    const cum = legLen.reduce((a, l) => (a.push(a[a.length - 1] + l), a), [0]);
    for (const p of [rPath, rCase]) p.setAttribute('stroke-dasharray', `${Ltot.toFixed(2)} ${(Ltot + 10).toFixed(2)}`);
    // where the route's tip is at t (stage px along the path)
    const lenAt = t => {
      let L = 0;
      P.legs.forEach((lg, j) => { if (t >= lg.b) L = cum[j + 1]; else if (t > lg.a) L = cum[j] + legLen[j] * M.bell((t - lg.a) / (lg.b - lg.a)); });
      return L;
    };

    // ── pins (teardrops, tip on the stop) with a pulse ring each, and their label chips
    const ph = 70 * u, pw = ph * .72;
    const pinSvg = `<svg width="${pw}" height="${ph}" viewBox="0 0 72 100" style="display:block;overflow:visible"><path d="M36 98C36 98 6 58 6 36a30 30 0 0 1 60 0c0 22-30 62-30 62z" fill="${acc}" stroke="${M.mix(acc, '#000000', .2)}" stroke-width="3"/><circle cx="36" cy="36" r="12" fill="#FFFFFF"/></svg>`;
    const pinsLayer = ctx.el(`<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;overflow:visible">${pts.map(() => `<ellipse fill="none" stroke="${acc}" stroke-width="${(3 * u).toFixed(2)}" opacity="0"/>`).join('')}</svg>`, `left:0;top:0;width:${W}px;height:${H}px`, 'pins');
    const rings = [...pinsLayer.querySelectorAll('ellipse')];
    const pins = pts.map(p => {
      const d = document.createElement('div');
      d.style.cssText = `position:absolute;left:${p[0] - pw / 2}px;top:${p[1] - ph}px;width:${pw}px;height:${ph}px;transform-origin:50% 100%;filter:drop-shadow(0 ${4 * u}px ${6 * u}px rgba(10,12,30,.3))`;
      d.innerHTML = pinSvg; pinsLayer.appendChild(d); return d;
    });
    const lfs = (portrait || square ? 40 : 34) * u;
    // chip placement: right, left, above or below its pin — whichever keeps clear of the route, the pins and the other
    // chips, inside the safe area (a slight preference for the right)
    const samples = Array.from({ length: Math.ceil(Ltot / (8 * u)) + 1 }, (_, i) => rPath.getPointAtLength(Math.min(Ltot, i * 8 * u)));
    const taken = pts.map(p => ({ x0: p[0] - pw / 2, y0: p[1] - ph, x1: p[0] + pw / 2, y1: p[1] }));
    if (hb) taken.push({ x0: hb.x0 - 14 * u, y0: hb.y0 - 14 * u, x1: hb.x1 + 14 * u, y1: hb.y1 + 22 * u });
    const clear = r => Math.min(...samples.map(q => Math.hypot(Math.max(r.x0 - q.x, 0, q.x - r.x1), Math.max(r.y0 - q.y, 0, q.y - r.y1))));
    const hits = r => taken.some(o => r.x0 < o.x1 + 6 * u && r.x1 > o.x0 - 6 * u && r.y0 < o.y1 + 6 * u && r.y1 > o.y0 - 6 * u);
    const chips = P.st.map((st, j) => {
      if (!st.label || !st.label.trim()) return null;
      const el = ctx.el(`<span class="lv-txt" style="position:relative;display:inline-block;white-space:nowrap;padding:${lfs * .34}px ${lfs * .7}px ${lfs * .38}px;border-radius:99px;font:600 ${lfs}px ${ctx.font};letter-spacing:-.01em;color:${dark ? '#FFFFFF' : C.ink};background:${dark ? '#24252D' : '#FFFFFF'};box-shadow:0 ${8 * u}px ${24 * u}px rgba(10,12,30,${dark ? .5 : .16}),0 0 0 ${1.2 * u}px ${dark ? 'rgba(255,255,255,.1)' : 'rgba(17,17,20,.06)'}">${ctx.A.esc(st.label)}</span>`, 'left:0;top:0', 'labels');
      const w = el.offsetWidth, h = el.offsetHeight, p = pts[j], hy = p[1] - ph * .64;
      const cand = [['right', p[0] + pw * .55 + 10 * u, hy - h / 2, '0 50%'], ['left', p[0] - pw * .55 - 10 * u - w, hy - h / 2, '100% 50%'],
        ['above', p[0] - w / 2, p[1] - ph - 12 * u - h, '50% 100%'], ['below', p[0] - w / 2, p[1] + 16 * u, '50% 0']].map(([side, x, y, o]) => {
        const r = { x0: x, y0: y, x1: x + w, y1: y + h }, out = x < safe.x0 || y < safe.y0 || x + w > safe.x1 || y + h > safe.y1;
        return { x, y, o, r, score: Math.min(clear(r), 60 * u) - (out ? 1e4 : 0) - (hits(r) ? 1e3 : 0) + (side === 'right' ? 4 * u : 0) };
      }).sort((a, b) => b.score - a.score);
      // clamped into the safe box, a side can land on the headline or a pin: take the best side that stays clear once
      // clamped (review fix #6: a corner stop's chip landed on the headline's first word)
      const at = cd => { const x = Math.max(safe.x0, Math.min(safe.x1 - w, cd.x)), y = Math.max(safe.y0, Math.min(safe.y1 - h, cd.y)); return { x, y, r: { x0: x, y0: y, x1: x + w, y1: y + h } }; };
      // none clear: one that at least keeps off the headline; a chip that can only sit on the headline is left out
      // (validate warns about the stop)
      const onHead = r => hb && r.x0 < hb.x1 + 14 * u && r.x1 > hb.x0 - 14 * u && r.y0 < hb.y1 + 22 * u && r.y1 > hb.y0 - 14 * u;
      const c = cand.find(cd => !hits(at(cd).r)) || cand.find(cd => !onHead(at(cd).r));
      if (!c) { el.remove(); return null; }
      const { x, y } = at(c);
      taken.push({ x0: x, y0: y, x1: x + w, y1: y + h });
      el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transformOrigin = c.o;
      return { el, j, sp: el.firstElementChild, w, h, o: c.o.split(' ').map(v => parseFloat(v) / 100) };
    });
    if (text) ctx.root.appendChild(text);           // the line paints last (tree order = paint order = layer order)
    const layers = [route, pinsLayer, ...chips.filter(Boolean).map(c => c.el)];
    const base = layers.map(el => [parseFloat(el.style.left) || 0, parseFloat(el.style.top) || 0]);
    // the follow-pan never carries a label out of the title-safe box QA checks (portrait .1 / .8, else .05 / .95)
    const qa = portrait ? { x0: .12 * W, y0: .12 * H, x1: .88 * W, y1: .78 * H } : { x0: .07 * W, y0: .07 * H, x1: .93 * W, y1: .93 * H };   // 2 % inside it: the camera push
    const cr = chips.filter(Boolean).map(c => ({ x0: parseFloat(c.el.style.left), y0: parseFloat(c.el.style.top), x1: parseFloat(c.el.style.left) + c.el.offsetWidth, y1: parseFloat(c.el.style.top) + c.el.offsetHeight }));
    const lim = { x0: Math.max(-.06 * W, ...cr.map(r => qa.x0 + 4 * u - r.x0)), x1: Math.min(.06 * W, ...cr.map(r => qa.x1 - 4 * u - r.x1)), y0: Math.max(-.06 * H, ...cr.map(r => qa.y0 + 4 * u - r.y0)), y1: Math.min(.06 * H, ...cr.map(r => qa.y1 - 4 * u - r.y1)) };
    if (hb) for (const r of cr) {
      if (r.y0 >= hb.y1 && r.x1 > hb.x0 - .06 * W && r.x0 < hb.x1 + .06 * W) lim.y0 = Math.max(lim.y0, hb.y1 + 16 * u - r.y0);
      else if (r.x0 >= hb.x1 && r.y1 > hb.y0 - .06 * H && r.y0 < hb.y1 + .06 * H) lim.x0 = Math.max(lim.x0, hb.x1 + 16 * u - r.x0);
    }
    const panX = v => lim.x0 > lim.x1 ? 0 : M.clamp(v, Math.min(0, lim.x0), Math.max(0, lim.x1)), panY = v => lim.y0 > lim.y1 ? 0 : M.clamp(v, Math.min(0, lim.y0), Math.max(0, lim.y1));
    return {
      render(t, D) {
        // the follow-pan: towards the route's head, ≤ 6 % of the frame (a pure function of t through lenAt)
        const L = lenAt(t), hp = rPath.getPointAtLength(Math.max(0, Math.min(Ltot, L)));
        const px = panX(-M.clamp((hp.x - W / 2) * .14, -.06 * W, .06 * W)), py = panY(-M.clamp((hp.y - H / 2) * .14, -.06 * H, .06 * H));
        const e = M.enter(t, -5, 16, u);           // the map is already arriving on frame 0
        mapEl.style.left = (-ox + px).toFixed(2) + 'px'; mapEl.style.top = (-oy + py).toFixed(2) + 'px';
        mapEl.style.opacity = e.o.toFixed(3); mapEl.style.filter = F.filt(F.blur(e.blur));
        mapEl.style.transform = e.k < 1 ? `scale(${(1.04 - .04 * e.k).toFixed(5)})` : 'none';
        layers.forEach((el, k) => { el.style.left = (base[k][0] + px).toFixed(2) + 'px'; el.style.top = (base[k][1] + py).toFixed(2) + 'px'; });
        // the route draws on (dash offset), its casing with it; the planned path dots in first
        rPlan.setAttribute('opacity', (.9 * M.u01(t, 6, 14)).toFixed(3));
        rPlan.setAttribute('stroke-dashoffset', (-t * 1.2 * u).toFixed(2));
        for (const p of [rPath, rCase]) p.setAttribute('stroke-dashoffset', (Ltot - L).toFixed(2));
        const live = t >= P.t0 - 1;
        head.setAttribute('cx', hp.x.toFixed(2)); head.setAttribute('cy', hp.y.toFixed(2)); halo.setAttribute('cx', hp.x.toFixed(2)); halo.setAttribute('cy', hp.y.toFixed(2));
        head.setAttribute('opacity', live ? '1' : '0');
        const hb = .5 + .5 * Math.sin(t * .25);
        halo.setAttribute('r', ((20 + 10 * hb) * u).toFixed(2)); halo.setAttribute('opacity', live ? (.18 + .12 * hb).toFixed(3) : '0');
        // pins: drop in (rise 40 px → 0 on expo-out, scale with ≤ 8 % overshoot from the tip), a pulse ring on arrival + every 1.5 s
        pins.forEach((pin, j) => {
          const t0 = P.arrive[j], k = M.pop(M.u01(t, t0, t0 + 11), .07), dy = -40 * u * (1 - M.outExpo(M.u01(t, t0, t0 + 10)));
          pin.style.opacity = M.u01(t, t0, t0 + 2).toFixed(3);
          pin.style.transform = t >= t0 + 11 ? 'none' : `translateY(${dy.toFixed(2)}px) scale(${M.clamp(k, 0, 1.08).toFixed(4)})`;
          const pu = t < t0 ? -1 : ((t - t0) % 45) / 26, rg = rings[j];
          if (pu < 0 || pu > 1) { rg.setAttribute('opacity', '0'); return; }
          rg.setAttribute('cx', pts[j][0].toFixed(2)); rg.setAttribute('cy', pts[j][1].toFixed(2));
          rg.setAttribute('rx', (8 * u + 46 * u * M.outExpo(pu)).toFixed(2)); rg.setAttribute('ry', (3 * u + 17 * u * M.outExpo(pu)).toFixed(2));
          rg.setAttribute('opacity', (.7 * Math.pow(1 - pu, 1.4) * (t - t0 < 45 ? 1 : .6)).toFixed(3));
        });
        for (const c of chips) {
          if (!c) continue;
          const t0 = P.arrive[c.j] + 3, k = M.pop(M.u01(t, t0, t0 + 10), .08);
          c.el.style.opacity = M.u01(t, t0, t0 + 3).toFixed(3);
          M.zoomAt(c.sp, t >= t0 + 10 ? 1 : M.clamp(k, 0, 1.1), c.o[0], c.o[1], c.w, c.h);       // the pop by layout (pure in t)
        }
        if (text) {
          const et = M.enter(t, 2, 15, u);
          text.style.opacity = et.o.toFixed(3); text.style.filter = F.filt(F.blur(et.blur));
          text.style.transform = et.k < 1 ? `translateY(${((1 - et.k) * 28 * u).toFixed(2)}px) scale(${et.s.toFixed(5)})` : 'none';     // landed: none (pure in t)
          scrim.style.opacity = M.u01(t, 0, 10).toFixed(3);
        }
      },
    };
  },
};
