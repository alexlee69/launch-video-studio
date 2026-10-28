// particles — a seeded dot field painted as SVG paths (one path per colour × opacity step, rebuilt each frame — no
// <canvas>: a composited canvas raced Chrome's tile raster on shot switches and left unpainted bands): a rotating, breathing Fibonacci sphere that assembles from a swirl
// (and bursts at `burstAt`), a burst (the sphere blows apart early into streaks, then drifts as a star field), a halftone
// dot grid with travelling waves, or a perspective terrain of dots with sine swells flowing towards the camera.
// Optional thin orbits round the sphere and a headline over a soft vignette. Every dot is a closed-form function of
// (seed, t): pure, whatever order frames are drawn in.
import { F } from './_film.js';
import { M } from './_motion.js';

const MODES = ['sphere', 'burst', 'grid', 'terrain'];
const modeOf = s => MODES.includes(s.mode) ? s.mode : 'sphere';
const burstOf = (s, D) => {
  const m = modeOf(s);
  if (s.burstAt != null && s.burstAt !== '') return F.at(s.burstAt, 0, 'particles burstAt');
  return m === 'burst' ? Math.min(12, Math.round(D * .2)) : null;
};
const textAt = (s, D) => { const b = burstOf(s, D); return modeOf(s) === 'burst' ? (b ?? 10) + 8 : 8; };
export default {
  name: 'particles',
  doc: 'A seeded dot field: a rotating, breathing sphere that assembles and can burst into streaks (burstAt), a burst into a drifting star field, a halftone grid with travelling waves, or a dot terrain flowing towards the camera; optional orbits and a headline over a soft vignette.',
  layers: 'particles · orbits · text',
  media: [],
  copy: s => [s.text].filter(x => x != null && String(x).trim() !== '').map(String),
  read: s => [s.text].filter(x => x != null && String(x).trim() !== '').map(String),
  params: {
    mode: 'sphere (default) | burst | grid | terrain',
    count: 'dots (sphere / burst, default 900; 100–4000); grid and terrain take their count from spacing',
    spacing: 'grid / terrain: dot spacing in px at 1080 (default 34 for grid, 30 for terrain; smaller = denser)',
    color: 'dot colour #RRGGBB (default: the brand accent on dark, ink on light)',
    orbits: 'true: 2–3 thin orbit rings with satellites round the sphere',
    text: 'optional headline over a soft vignette (*accent* ok)',
    burstAt: 'sphere: local frame (or "1.2s") it bursts; burst mode bursts early by default (frame ≈ 12)',
    theme: '(any shot) dark reads best: glowing dots on the dark background',
  },
  required: [],
  validate(s, D) {
    const w = [], b = burstOf(s, D), m = modeOf(s);
    if (b != null && b > D - 10) w.push(`particles ${s.id}: burstAt ${b} is past the shot's frame ${D - 10} — the burst would not read before the cut`);
    if (s.burstAt != null && (m === 'grid' || m === 'terrain')) w.push(`particles ${s.id}: burstAt does nothing in mode ${m}`);
    if (s.orbits && (m === 'grid' || m === 'terrain')) w.push(`particles ${s.id}: orbits ring the sphere — they do nothing in mode ${m}`);
    if (D < 40) w.push(`particles ${s.id}: ${D} frames is short for a dot field to read; give it ≥ 1.5 s`);
    return w;
  },
  cues: (s, D) => { const b = burstOf(s, D); return [{ t: 0, kind: 'hit', note: 82, gain: .55 }, ...(b != null && b < D ? [{ t: b, kind: 'hit', note: 89, gain: .8 }] : [])]; },
  // the sphere whole (just before a burst, after the text lands); a burst mid-flight; fields once the wave has spread
  // (never before the headline has landed: it enters over 15 frames from textAt)
  hero: (s, D) => {
    const b = burstOf(s, D), m = modeOf(s), base = m === 'burst' ? (b ?? 10) + 12 : b != null ? Math.max(Math.min(30, b - 2), b - 3) : Math.round(D * .6);
    return Math.max(8, Math.min(D - 8, s.text ? Math.max(base, textAt(s, D) + 15) : base));
  },
  async build(ctx, s) {
    const { W, H, u, safe, portrait, square } = ctx, C = ctx.C, dark = ctx.dark;
    const mode = modeOf(s), burst = burstOf(s, ctx.D), seed = F.hash('particles:' + s.id);
    const col = /^#[0-9a-f]{6}$/i.test(String(s.color || '')) ? String(s.color) : dark ? (C.accent || '#8FA8FF') : C.ink;
    const hot = dark ? '#FFFFFF' : C.accent;                 // sparkle colour (a share of the dots)
    const layer = ctx.el('', `left:0;top:0;width:${W}px;height:${H}px`, 'particles');
    const cx = W / 2, cy = H * .5;
    const R0 = Math.min(W, H) * (portrait ? .4 : .38);
    // a soft core glow behind the sphere (dark themes)
    const glow = (mode === 'sphere' || mode === 'burst') && dark ? layer.appendChild(Object.assign(document.createElement('div'), { style: `position:absolute;left:${cx - R0 * 1.6}px;top:${cy - R0 * 1.6}px;width:${R0 * 3.2}px;height:${R0 * 3.2}px;border-radius:50%;background:radial-gradient(closest-side,${M.rgba(col, .2)},${M.rgba(col, .06)} 60%,${M.rgba(col, 0)});opacity:0` })) : null;
    // the painter: dots and streaks go into buckets by colour and opacity step; each bucket is one <path>
    const ns = 'http://www.w3.org/2000/svg', LV = 20, svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', W); svg.setAttribute('height', H); svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible;display:block';
    layer.appendChild(svg);
    const paths = [col, hot].map(c => Array.from({ length: LV }, (_, k) => { const el = document.createElementNS(ns, 'path'); el.setAttribute('fill', c); el.setAttribute('fill-opacity', ((k + 1) / LV).toFixed(3)); svg.appendChild(el); return { el, d: '' }; }));
    const buf = paths.map(row => row.map(() => []));
    const slot = (a, ci) => { const k = Math.round(a * LV) - 1; return k < 0 ? null : buf[ci][Math.min(LV - 1, k)]; };
    const f1 = v => v.toFixed(1), f2 = v => v.toFixed(2);
    const dot = (x, y, r, a, ci) => { const b = slot(a, ci); if (b) b.push(`M${f1(x - r)} ${f1(y)}a${f2(r)} ${f2(r)} 0 1 0 ${f2(2 * r)} 0a${f2(r)} ${f2(r)} 0 1 0 ${f2(-2 * r)} 0`); };
    const streak = (x0, y0, x1, y1, w, a, ci) => {
      const b = slot(a, ci); if (!b) return;
      const L = Math.hypot(x1 - x0, y1 - y0) || 1, h = w / 2, nx = -(y1 - y0) / L * h, ny = (x1 - x0) / L * h;
      b.push(`M${f1(x0 + nx * .3)} ${f1(y0 + ny * .3)}L${f1(x1 + nx)} ${f1(y1 + ny)}L${f1(x1 - nx)} ${f1(y1 - ny)}L${f1(x0 - nx * .3)} ${f1(y0 - ny * .3)}Z`);
      b.push(`M${f1(x1 - h)} ${f1(y1)}a${f2(h)} ${f2(h)} 0 1 0 ${f2(2 * h)} 0a${f2(h)} ${f2(h)} 0 1 0 ${f2(-2 * h)} 0`);
    };
    const flush = () => paths.forEach((row, ci) => row.forEach((pth, k) => { const d = buf[ci][k].join(''); buf[ci][k].length = 0; if (d !== pth.d) { pth.el.setAttribute('d', d); pth.d = d; } }));
    const rng = M.rng(seed);
    // ── the dots (seeded once; everything per frame is closed-form in t)
    const N = Math.max(100, Math.min(4000, Math.round(Number(s.count) || 900)));
    const pts = [];
    if (mode === 'sphere' || mode === 'burst') {
      const ga = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < N; i++) {
        const y = 1 - 2 * (i + .5) / N, r = Math.sqrt(1 - y * y), ph = i * ga;
        const dx = rng() - .5, dy = rng() - .5, dz = rng() - .5;
        pts.push({ x: Math.cos(ph) * r, y, z: Math.sin(ph) * r, sz: .6 + .8 * rng(), hot: rng() < .09, d: rng() * 9, far: 1.2 + 2.8 * Math.pow(rng(), .7), fly: .45 + 2.6 * Math.pow(rng(), 1.8), sw: (rng() - .5) * 1.4, ph: rng() * 6.28, sx: dx, sy: dy, sz2: dz });
      }
    }
    const sp = Math.max(14, Number(s.spacing) || (mode === 'terrain' ? 30 : 34)) * u;
    const blur = F.dirBlur(`mk-pt-${s.id}`);
    // orbits (sphere / burst): thin ellipses with a satellite each, painted in one SVG (attributes, never transforms)
    let orb = null;
    if (s.orbits && (mode === 'sphere' || mode === 'burst')) {
      const oc = dark ? M.rgba(col, .7) : M.rgba(C.ink, .32);
      const defs = [[1.32, .24, -16], [1.55, .3, 14], [1.18, .42, 38]];
      orb = { defs, el: ctx.el(`<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;overflow:visible"><g class="mk-orb">${defs.map(([k, q, rot]) => `<ellipse cx="${cx}" cy="${cy}" rx="${R0 * k}" ry="${R0 * k * q}" transform="rotate(${rot} ${cx} ${cy})" pathLength="1" fill="none" stroke="${oc}" stroke-width="${(2.4 * u).toFixed(2)}" stroke-dasharray="1 1" stroke-dashoffset="1"/>`).join('')}${defs.map(() => `<circle r="${(7 * u).toFixed(2)}" fill="${dark ? '#FFFFFF' : C.accent}" opacity="0"/>`).join('')}</g></svg>`, `left:0;top:0;width:${W}px;height:${H}px`, 'orbits') };
      orb.ell = [...orb.el.querySelectorAll('ellipse')]; orb.dot = [...orb.el.querySelectorAll('circle')];
    }
    // headline over a soft vignette
    let head = null, vig = null;
    if (s.text) {
      const size = portrait ? 84 : square ? 88 : 104;
      head = ctx.text(s.text, { size, align: 'center', style: 'text-wrap:balance;',  maxW: safe.w * (portrait ? 1 : .8), lines: 2, min: 64, layer: 'text', color: dark ? '#FFFFFF' : C.ink, accent: dark ? C.accent : C.accent });
      head.style.width = safe.w * (portrait ? 1 : .8) + 'px';
      const ty = mode === 'terrain' ? H * (portrait ? .33 : .3) : cy;
      head.style.left = (W / 2 - head.offsetWidth / 2) + 'px'; head.style.top = (ty - head.offsetHeight / 2) + 'px';
      const vw = head.offsetWidth * 1.35, vh = head.offsetHeight * 2.6;
      vig = ctx.el('', `left:${W / 2 - vw / 2}px;top:${ty - vh / 2}px;width:${vw}px;height:${vh}px;border-radius:50%;background:radial-gradient(closest-side,${M.rgba(dark ? C.dark : C.bg, .82)},${M.rgba(dark ? C.dark : C.bg, .5)} 55%,${M.rgba(dark ? C.dark : C.bg, 0)})`, 'text');
      ctx.root.appendChild(head);
      // the orbits fade out under the line (a feathered elliptical hole in their mask) instead of running through it
      if (orb) {
        const mid = `mk-pto-${String(s.id).replace(/[^\w-]/g, '_')}`, svg0 = orb.el.querySelector('svg'), rg = document.createRange();
        rg.selectNodeContents(head); const gr = rg.getBoundingClientRect(), hr = head.getBoundingClientRect(), gk = hr.width ? head.offsetWidth / hr.width : 1, gw = gr.width * gk, gh = gr.height * gk;
        svg0.insertAdjacentHTML('afterbegin', `<defs><filter id="${mid}-f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(22 * u).toFixed(2)}"/></filter><mask id="${mid}" maskUnits="userSpaceOnUse" x="${-W}" y="${-H}" width="${3 * W}" height="${3 * H}"><rect x="${-W}" y="${-H}" width="${3 * W}" height="${3 * H}" fill="#fff"/><ellipse cx="${W / 2}" cy="${ty.toFixed(1)}" rx="${(gw * .5 + 40 * u).toFixed(1)}" ry="${(gh * .5 + 30 * u).toFixed(1)}" fill="#000" filter="url(#${mid}-f)"/></mask></defs>`);
        orb.el.querySelector('.mk-orb').setAttribute('mask', `url(#${mid})`);
      }
    }
    const tIn = textAt(s, ctx.D);

    // sphere / burst: position of dot p at time t (unit-sphere coords → world px, before projection)
    const rot = (x, y, z, a, b) => { const ca = Math.cos(a), sa = Math.sin(a), x1 = x * ca + z * sa, z1 = -x * sa + z * ca, cb = Math.cos(b), sb = Math.sin(b); return [x1, y * cb - z1 * sb, y * sb + z1 * cb]; };
    const sphereAt = (p, t, D) => {
      const R = R0 * (1 + .025 * Math.sin(t * .09));
      // pre-rolled ~3 frames: the cut lands mid-assembly (most dots in, the shell still swirling inwards)
      const a = mode === 'burst' ? M.outExpo(M.u01(t, p.d * .3 - 5, p.d * .3 + 5)) : M.outExpo(M.u01(t, p.d - 11, p.d + 13));
      // assembly: from a wider swirling shell (sphere) or from the centre outwards (burst)
      let k = mode === 'burst' ? .05 + .95 * a : 1 + (p.far * .9) * (1 - a);
      const sw = (1 - a) * p.sw * 2.2;
      let [x, y, z] = rot(p.x * k, p.y * k, p.z * k, .55 + t * .016 + sw, -.34);
      if (burst != null && t > burst) {        // the burst: expo-out flight outwards with a swirl, then a slow drift
        const bu = t - burst, e = M.outExpo(M.clamp(bu / 26)), go = 1 + p.fly * e + .007 * Math.max(0, bu - 26) * (.5 + p.fly);
        [x, y, z] = rot(x * go + p.sx * e * .5, y * go + p.sy * e * .5, z * go + p.sz2 * e * .5, .7 * e * p.sw, 0);
      }
      return [x * R, y * R, z * R];
    };
    const project = ([x, y, z]) => { const d = R0 * 3.4, f = d / Math.max(R0 * 1.4, d - z); return [cx + x * f, cy + y * f, f]; };

    return {
      render(t, D) {
        if (mode === 'sphere' || mode === 'burst') {
          const bk = burst != null ? M.u01(t, burst, burst + 20) : 0;
          if (glow) glow.style.opacity = ((.35 + .65 * M.u01(t, 0, 22)) * (1 - .7 * bk)).toFixed(3);
          const bursting = burst != null && t > burst && t < burst + 30;
          for (const p of pts) {
            const w0 = sphereAt(p, t, D), [X, Y, f] = project(w0);
            const depth = M.clamp((w0[2] / R0 + 1) / 2);
            const show = mode === 'burst' ? M.u01(t, p.d * .3 - 6, p.d * .3 - 3) : M.u01(t, p.d - 11, p.d - 5);
            const fade = burst != null ? 1 - .4 * M.u01(t, burst + 20, D) * (p.fly > 2 ? 1 : .4) : 1;
            const a = (.36 + .64 * depth) * show * fade * (.78 + .22 * Math.sin(t * .2 + p.ph));
            if (a <= .02 || X < -40 || X > W + 40 || Y < -40 || Y > H + 40) continue;
            const r = Math.max(.8, (dark ? 2.6 : 2.8) * u * p.sz * Math.pow(f, 1.6)), ci = p.hot ? 1 : 0;
            if (bursting) {               // streaks: a tapered line along the velocity
              const [X0, Y0] = project(sphereAt(p, t - 1.4, D));
              if (Math.hypot(X - X0, Y - Y0) > r * 1.5) { streak(X0, Y0, X, Y, r * 1.5, a, ci); continue; }
            }
            dot(X, Y, r, a, ci);
            if (dark && depth > .82 && p.sz > 1.05) dot(X, Y, r * 3.2, a * .14, ci);
          }
        } else if (mode === 'grid') {
          // halftone grid: a diagonal travelling wave × a ring that pulses out from the centre every 1.6 s
          const cols = Math.ceil(W / sp) + 1, rows = Math.ceil(H / sp) + 1, ox = (W - (cols - 1) * sp) / 2, oy = (H - (rows - 1) * sp) / 2, maxD = Math.hypot(W, H) / 2;
          for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
            const x = ox + i * sp, y = oy + j * sp, rr = Math.hypot(x - cx, y - cy) / maxD;
            const inn = M.outExpo(M.u01(t, rr * 16 - 14, rr * 16 - 2));          // pre-rolled: ~70 % of the field in on the cut
            if (inn <= 0) continue;
            const wave = .5 + .5 * Math.sin((x * .9 + y * .55) / (sp * 5.5) - t * .11);
            const ring = Math.exp(-Math.pow((rr - ((t / 48) % 1.25)) / .07, 2));
            const w = M.clamp(.12 + .55 * wave * (1 - .5 * rr) + .75 * ring);
            dot(x, y, sp * (.06 + .3 * w) * inn, (.18 + .82 * w) * inn, ring > .5 ? 1 : 0);
          }
        } else {
          // terrain: a plane of dots (x across, z into the screen) moving towards the camera, sine swells in world space
          const dens = 30 * u / sp, nx = Math.round((portrait ? 46 : 74) * dens), nz = Math.round(54 * dens), near = .7, depth = 8, span = portrait ? 2.4 : 3.8, camH = .8, f = H * (portrait ? .5 : .62);
          const hy = H * (portrait ? .44 : .42), v = .05;
          for (let j = 0; j < nz; j++) {
            const zw = ((j / nz) * depth - t * v) % depth, z = near + (zw < 0 ? zw + depth : zw);
            const zr = z + t * v;            // the terrain's own z (fixed to the ground), for its waves
            const fog = M.clamp((near + depth - z) / (depth * .5)) * M.clamp((z - near) / .7);
            for (let i = 0; i < nx; i++) {
              const xw = (i / (nx - 1) - .5) * span * (1 + z * .5);
              const hgt = .3 * Math.sin(xw * 1.7 + zr * 1.15) * .6 + .3 * Math.sin(xw * .6 - zr * .7 + 1.3) * .4 + .08 * Math.sin(zr * 2.4 + xw * 3.1);
              const X = cx + (xw / z) * f, Y = hy + ((camH - hgt) / z) * f;
              if (X < -10 || X > W + 10 || Y > H + 10 || Y < -10) continue;
              const crest = M.clamp((hgt + .3) / .6), inn = M.outExpo(M.u01(t, (z - near) * 2 - 14, (z - near) * 2));     // pre-rolled
              const a = fog * inn * (.55 + .45 * crest);
              if (a <= .02) continue;
              dot(X, Y, Math.max(1, (portrait ? 8 : 6.5) * u * (.5 + .6 * crest) / Math.pow(z, .9)), a, crest > .85 ? 1 : 0);
            }
          }
        }
        flush();
        // a whisper of motion blur on the field while the burst flies
        if (burst != null) { const k = Math.sin(Math.PI * M.u01(t, burst, burst + 16)); layer.style.filter = F.filt(blur(2.2 * u * k, 2.2 * u * k)); }
        if (orb) {
          const bk = burst != null ? M.u01(t, burst - 2, burst + 10) : 0;
          orb.ell.forEach((el, k) => {
            const d = M.outExpo(M.u01(t, 10 + k * 4, 34 + k * 4));
            el.setAttribute('stroke-dashoffset', (1 - d).toFixed(4));
            el.setAttribute('opacity', (1 - bk).toFixed(3));
          });
          orb.dot.forEach((el, k) => {
            const [kk, q, deg] = orb.defs[k], a = 1.3 + k * 2.1 + t * (.035 + .012 * k), rx = R0 * kk, ry = rx * q, rr = deg * Math.PI / 180;
            const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
            el.setAttribute('cx', (cx + ex * Math.cos(rr) - ey * Math.sin(rr)).toFixed(2)); el.setAttribute('cy', (cy + ex * Math.sin(rr) + ey * Math.cos(rr)).toFixed(2));
            el.setAttribute('opacity', (M.u01(t, 24 + k * 4, 30 + k * 4) * (1 - bk) * (Math.sin(a) > 0 ? 1 : .35)).toFixed(3));
          });
        }
        if (head) {
          const e = M.enter(t, tIn, 15, u);
          head.style.opacity = e.o.toFixed(3);
          head.style.filter = F.filt(F.blur(e.blur));
          // landed: transform none (a held or drifting transform on text renders differently depending on the frames drawn
          // before it — the camera's push keeps the frame moving)
          head.style.transform = e.k < 1 ? `translateY(${((1 - e.k) * 30 * u).toFixed(2)}px) scale(${e.s.toFixed(5)})` : 'none';
          vig.style.opacity = M.u01(t, tIn - 6, tIn + 8).toFixed(3);
        }
      },
    };
  },
};
