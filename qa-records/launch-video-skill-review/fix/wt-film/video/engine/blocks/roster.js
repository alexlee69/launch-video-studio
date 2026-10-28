// roster — "your agents": a list of agents (mascot, name, one-line sub) behind a fixed highlight slot, built on motion
// measured on a launch film (30 fps; lengths in list pitches p):
//   · the list never stops: a base drift (0.0157 p/f relative to the slot) plus one double-exponential step per beat
//     (velocity ×1.9 per frame in, ×0.5 out; each beat moves exactly one row), then optionally one fast run of the last
//     `run` rows; it locks to the slot once the last row is in
//   · the slot drifts up (0.0046 p/f) and is dragged 5.6 % of every step down; the list trails the camera's entrance
//   · row 0 drops into the slot from above (clipped by it), overshoots and settles; the others fly in from the left
//     (from ~1.9 p) 2.2 frames after their step and bounce 0.04 p; rows below the slot stay hidden until they land
//   · a row reveals 1 frame after it lands: soft wipe 3 f, blur → 0 over 4.5 f, a pale tint of its mascot's colour
//     cooling to grey by 6 f, opacity .35 → 1 over 6 f, a 0.08 p glide over 22 f; rows above the slot settle dimmer
//   · expressions swap instantly: happy on arrival, a long blink as its text lands, eyes open 9 f later, happy or
//     open-mouthed once it moves up out of the slot
//   · "more" (e.g. "Meet all 12 agents"): its 2×2 grid builds square by square while the text wipes in
// The header (title + search) scrolls with the list. Motion blur on the list (0.22 × speed) and on each mascot.
import { F } from './_film.js';

const agentsOf = s => [].concat(s.agents || []).map((a, i) => typeof a === 'string' ? { name: a, mascot: i } : { mascot: i, ...a });
const num = (v, d) => v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d;
const atNum = (v, d) => { if (v == null || v === '') return d; const m = String(v).trim().match(/^(\d+(?:\.\d+)?)\s*(s|sec)?$/); return m ? (m[2] ? Number(m[1]) * 30 : Number(m[1])) : d; };
// measured constants (see the header comment)
const M = { base: .01566, tin: 1.514, tout: 1.446, rin: 1.738, rout: 2.484, lead: 8.3, land: 2.2, slotDrift: .00462, drag: .0561, trail: .25, settle: 25 };
// row 0's drop, per frame from the shot's start (t = .5, 1.5 …): centre x from its rest and y from the slot's top, in p
const DROP_X = [.322, .283, .291, .256, .193, .113, .037, -.027, -.081, -.122, -.149, -.162, -.162, -.147, -.113, -.076, -.049, -.030, -.017, -.008, -.001, .003];
const DROP_Y = [-.395, -.158, .035, .213, .348, .444, .484, .515, .527, .539, .542, .540, .537, .525, .506, .494, .483, .478, .476, .477, .476, .477];
// a fly-in from the left, x from rest (p) by frames from landing; held at 0 after
const FLY = [[-4, -1.897], [-3, -1.264], [-2, -.615], [-1, -.328], [0, .040], [1, .0247], [2, .0155], [3, .0086], [4, .004], [5, .0006], [6, 0]];
const tab = (pts, x) => { if (x <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [a, ya] = pts[i - 1], [b, yb] = pts[i]; return ya + (yb - ya) * (x - a) / (b - a); } return pts[pts.length - 1][1]; };
const seq = (arr, t) => { const x = t - .5; if (x <= 0) return arr[0]; const i = Math.floor(x); return i >= arr.length - 1 ? arr[arr.length - 1] : arr[i] + (arr[i + 1] - arr[i]) * (x - i); };
const pulse = (t, c, S, ti, to) => t < c ? S * ti / (ti + to) * Math.exp((t - c) / ti) : S * (1 - to / (ti + to) * Math.exp(-(t - c) / to));
const ramp = (t, a, b, sm = 1.5) => { const sp = x => x / sm > 30 ? x : sm * Math.log1p(Math.exp(x / sm)); return sp(t - a) - sp(t - b); };
// the schedule (pure: cues() runs it in Node). Rows: agents + more; row 0 is in the slot from the start; rows 1 … n−1−run
// step one per beat from `first` (the first step's fastest frame); the last `run` rows go in one fast move a beat later
function plan(s, D) {
  const agents = agentsOf(s), n = agents.length + (s.more ? 1 : 0);
  const run = Math.max(0, Math.min(n - 1, Math.round(num(s.run, 0)))), steps = Math.max(0, n - 1 - run), moves = steps + (run ? 1 : 0);
  let beat = Math.max(4, num(s.beat, 15));
  let start = atNum(s.first, null);
  if (start == null) {
    start = D - M.settle - Math.max(0, moves - 1) * beat;
    if (start < 14 && moves > 1) { beat = Math.max(6, (D - M.settle - 14) / (moves - 1)); start = D - M.settle - (moves - 1) * beat; }
    start = Math.max(8, start);
  }
  const C = Array.from({ length: steps }, (_, k) => start + k * beat), cr = run ? start + steps * beat - .4 : null;
  const S = 1 - M.base * beat, end = run ? cr : C.length ? C[C.length - 1] : start;
  // the list ends with the last row centred in the slot ("more" sits 0.07 p lower in its row than an agent's title)
  const last = n - 1 - (s.more ? .07 : 0), ton = start - M.lead, R = run ? last - steps * S - M.base * Math.max(0, end - ton) : 0;
  const pos = t => (moves ? M.base * ramp(t, ton, end) : 0) + C.reduce((a, c) => a + pulse(t, c, S, M.tin, M.tout), 0) + (run ? pulse(t, cr, R, M.rin, M.rout) : 0);
  // arrivals: row 0's drop settles at 20.5 (reveal 21.5); a stepped row lands 2.2 f after its step; the run's agents land
  // in the rows below the slot just before the run (spaced 4 f, the last 1.5 f before it); "more" wipes in after it lands
  const land = [20.5], hasMore = !!s.more;
  for (let k = 1; k < n; k++) {
    if (k <= steps) land.push(C[k - 1] + M.land);
    else { const j = k - steps - 1, nAg = run - (hasMore ? 1 : 0); land.push(hasMore && k === n - 1 ? cr + 7.5 : cr - 1.5 - 4 * (nAg - 1 - j)); }
  }
  if (hasMore && !run && n > 1) land[n - 1] = C[C.length - 1] + 7.5;
  // when each row moves up out of the slot (the next step), for its last expression
  const leave = Array.from({ length: n }, (_, k) => k < steps ? C[k] + 3 : run && k === steps ? cr + 1 : Infinity);
  return { n, run, steps, moves, beat, start, C, cr, S, R, land, leave, pos, end };
}
export default {
  name: 'roster',
  doc: '"Your agents": a list of agents (mascot, name, sub) scrolling behind a fixed highlight slot — it never stops: one momentum step per beat (optionally a fast run at the end), row 0 drops into the slot, the others fly in from the left and reveal (wipe, unblur, tint → grey), mascots change expression; optional last row ("Meet all 12 agents") with a grid icon built square by square.',
  layers: 'header · highlight · agent-1 … agent-N · more',
  media: [],
  copy: s => [s.title || 'Your agents', ...agentsOf(s).flatMap(a => [a.name, a.sub]), s.more].filter(x => x != null && String(x).trim() !== '').map(String),
  read: s => [s.title || 'Your agents'].filter(x => x != null && String(x).trim() !== '').map(String),
  params: {
    agents: 'list of {name, sub, mascot: cast index}', title: 'header label (default "Your agents")', more: 'optional last row, e.g. "Meet all 12 agents"',
    beat: 'frames per step (default 15 = 0.5 s; each step moves one row)', first: 'local frame (or "1.3s") of the first step\'s fastest moment (default: so the last move settles ~25 frames before the end)',
    run: 'how many of the last rows go in one fast run instead of one step each (default 0)',
  },
  required: ['agents'],
  validate(s, D) {
    const p = plan(s, D), w = [];
    if (p.moves > 1 && p.beat < 8) w.push(`roster ${s.id}: ${p.n} rows in ${D} frames leaves ${p.beat.toFixed(1)} frames a step (under 8) — lengthen the shot, trim agents or set run:`);
    if (p.start < 14 && p.moves) w.push(`roster ${s.id}: the first step at frame ${p.start.toFixed(1)} cuts row 0's drop short (it settles by ~21) — lengthen the shot or set first: later`);
    if (p.moves && p.end + 10 > D) w.push(`roster ${s.id}: the last move (frame ${p.end.toFixed(1)}) runs into the end of the shot (${D}) — lower first or beat, or lengthen the shot`);
    return [...w, ...F.lightOnly(s, 'roster')];
  },
  // pops with rising pitch as each agent lands, a tick as each row reveals, tiny pops building the grid of "more", a blip
  // as row 0 opens its eyes
  cues(s, D) {
    const p = plan(s, D), c = [], notes = [76, 79, 81, 83, 84, 86, 88, 89, 91];
    const nAg = agentsOf(s).length;
    for (let k = 0; k < nAg; k++) { c.push({ t: p.land[k], kind: 'pop', note: notes[Math.min(k, notes.length - 1)], gain: .6 }); c.push({ t: p.land[k] + 1, kind: 'tick', gain: .8 }); }
    if (nAg) c.push({ t: p.land[0] + 11, kind: 'pop', note: 93, gain: .3 });
    if (s.more && p.n > 1) { const m = p.land[p.n - 1]; c.push({ t: m, kind: 'tick', gain: .9 }); for (let q = 0; q < 4; q++) c.push({ t: m + 1.5 + 2 * q, kind: 'pop', note: 96 + q, gain: .25 }); }
    return c;
  },
  hero: (s, D) => { const p = plan(s, D), k = Math.max(0, Math.floor((p.steps - 1) / 2)); return Math.min(D - 4, Math.round(p.C.length ? p.C[k] + 9 : p.land[0] + 8)); },     // mid-list, settled
  async build(ctx, s) {
    const { W, H, u, K, A, safe, portrait, square } = ctx, B = ctx.brand.colors;
    const P = plan(s, ctx.D), agents = agentsOf(s), n = P.n;
    // geometry in list pitches (the measured film's proportions: a close list, the pitch 28.6 % of a 16:9 frame's height,
    // about 2.5 rows in view): slot 4.09 × 0.914 p, title 0.275 p, sub 0.176 p
    const p = portrait ? Math.min(.94 * W / 4.09, .16 * H) : square ? Math.min(.92 * W / 4.09, .26 * H) : Math.min(.286 * H, .92 * W / 4.09);
    // the slot sits a little below the middle in 16:9 (as measured: its centre at 55 % of the height as the shot settles), centred elsewhere
    const pw = 4.09 * p, sh = .914 * p, x0 = W / 2 - pw / 2, slotY0 = (portrait || square ? .5 : .555) * H - .457 * p;
    const tx = x0 + 1.05 * p, mx = x0 + .49 * p, ms = .86 * p, tfs = .275 * p, sfs = .176 * p;
    // a row's title and sub sit on the measured baselines (35.5 and 78.5 px of a 174-px pitch); Inter's baseline is
    // .8636 em down a line-height-1 box, so a box's top = baseline − .8636 × its font size
    const TI_BASE = 35.5 / 174, SU_BASE = 78.5 / 174, baseTop = (b, fs) => b * p - .8636 * fs;
    const font = `font-family:${ctx.font};`, ink = F.rgbOf(F.rgb(B.ink)), bgc = F.rgbOf(F.rgb(B.bg));
    const mix = (a, b, k) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * K.clamp(k))).join(',')})`;
    const titleC = mix(ink, bgc, .22), dimC = mix(ink, bgc, .45), subC = F.rgbOf(F.rgb(B.muted));
    const col = i => { const c = ctx.cast(Number(agents[i].mascot) || 0); return c.col && /^#[0-9a-f]{6}$/i.test(c.col) ? F.rgbOf(c.col) : F.rgbOf(F.rgb(B.accent)); };
    // the camera's entrance (the list trails it by a quarter)
    const en = ctx.enter || { dy: 0, decay: .8 };
    // header: title + search icon, one row above row 0 (scrolls with the list)
    const header = ctx.el(`<div class="lv-ui" style="position:relative;width:${pw}px;height:${.3 * p}px;${font}">
        <span class="lv-txt" style="position:absolute;left:${.01 * p}px;top:0;font-size:${.195 * p}px;line-height:1;font-weight:400;color:${B.muted};white-space:nowrap">${A.esc(s.title || 'Your agents')}</span>
        <svg style="position:absolute;right:${.0 * p}px;top:${-.2 * p}px" width="${.27 * p}" height="${.27 * p}" viewBox="0 0 24 24" fill="none" stroke="${B.ink}" stroke-opacity=".6" stroke-width="2" stroke-linecap="round"><circle cx="10.2" cy="10.2" r="7"/><path d="M15.4 15.4L21.2 21.2"/></svg></div>`,
      `left:${x0}px;top:0`, 'header');
    const hdrT = header.querySelector('.lv-txt'), hdrS = header.querySelector('svg');
    const hl = ctx.el('', `left:${x0}px;top:0;width:${pw}px;height:${sh}px;border-radius:${.167 * p}px;background:#E9E9EF;box-shadow:inset 0 0 0 1px rgba(17,17,20,.04)`, 'highlight');
    // the list: one row element per agent (title + sub), the mascots in their own frame-space wrapper (each on its row's layer)
    const list = ctx.el('', `left:0;top:0;width:${W}px;height:0`);
    const rows = agents.map((a, i) => {
      const el = document.createElement('div');
      el.className = 'lv-ui'; el.style.cssText = `position:absolute;left:${tx}px;top:${i * p}px;${font};display:none`;
      el.innerHTML = `<div class="lv-txt ro-ti" style="position:absolute;left:0;top:${baseTop(TI_BASE, tfs)}px;font-size:${tfs}px;line-height:1;font-weight:600;letter-spacing:-.012em;color:${titleC};white-space:nowrap">${A.esc(a.name || '')}</div>
        ${a.sub ? `<div class="lv-txt ro-su" style="position:absolute;left:0;top:${baseTop(SU_BASE, sfs)}px;font-size:${sfs}px;line-height:1;font-weight:400;color:${mix(subC, bgc, 0)};white-space:nowrap">${A.esc(a.sub)}</div>` : ''}`;
      list.appendChild(el); ctx.layer(el, `agent-${i + 1}`);
      return { el, ti: el.querySelector('.ro-ti'), su: el.querySelector('.ro-su'), bt: F.dirBlur(`ro-t-${s.id}-${i}`), bs: F.dirBlur(`ro-s-${s.id}-${i}`) };
    });
    // long names / subs: every title (and every sub) shrinks by the same factor until the widest ends inside the slot,
    // its baseline kept where it was measured
    await document.fonts.ready;
    const fitAll = (els, fs, base, room) => {
      const wide = Math.max(0, ...els.map(e => { const d = e.closest('.lv-ui'), was = d.style.display; d.style.display = 'block'; const w = e.offsetWidth; d.style.display = was; return w; }));
      if (wide <= room) return;
      const f = fs * room / wide;
      for (const e of els) { e.style.fontSize = f + 'px'; if (base != null) e.style.top = baseTop(base, f) + 'px'; }
    };
    const room = pw - 1.05 * p - .12 * p;       // from the text's left edge to just inside the slot's right end
    fitAll(rows.map(r => r.ti), tfs, TI_BASE, room); fitAll(rows.map(r => r.su).filter(Boolean), sfs, SU_BASE, room);
    let more = null;
    if (s.more) {
      const el = document.createElement('div'), q = .11 * p, g = .144 * p;
      el.className = 'lv-ui'; el.style.cssText = `position:absolute;left:${x0 + .18 * p}px;top:${agents.length * p}px;${font};display:none`;
      el.innerHTML = [[0, 1], [1, 1], [1, 0], [0, 0]].map(([i, j]) => `<div class="ro-sq" style="position:absolute;left:${i * g}px;top:${.04 * p + j * g}px;width:${q}px;height:${q}px;border-radius:${.032 * p}px;box-shadow:inset 0 0 0 ${Math.max(1.5, .017 * p)}px ${B.muted};transform-origin:50% 50%;opacity:0"></div>`).join('')
        + `<div class="lv-txt ro-mt" style="position:absolute;left:${.44 * p}px;top:${.035 * p}px;font-size:${.264 * p}px;line-height:1;font-weight:400;color:${B.muted};white-space:nowrap">${A.esc(s.more)}</div>`;
      list.appendChild(el); ctx.layer(el, 'more');
      more = { el, sq: [...el.querySelectorAll('.ro-sq')], tx: el.querySelector('.ro-mt'), b: F.dirBlur(`ro-m-${s.id}`) };
      fitAll([more.tx], .264 * p, null, pw - .62 * p - .12 * p);
    }
    const mlay = ctx.el('', `left:0;top:0;width:${W}px;height:0`);
    const MOODS = ['happy', 'blink', 'smile', 'open'];
    const masc = agents.map((a, i) => {
      const el = document.createElement('div');
      el.style.cssText = `position:absolute;left:${mx - ms / 2}px;top:0;width:${ms}px;height:${ms}px;display:none`;
      el.innerHTML = MOODS.map(m => `<div class="ro-md" data-m="${m}" style="position:absolute;inset:0;display:${m === 'happy' ? 'block' : 'none'}">${A.bud(ctx.cast(Number(a.mascot) || 0), ms, m)}</div>`).join('');
      mlay.appendChild(el); ctx.layer(el, `agent-${i + 1}`);
      return { el, md: Object.fromEntries([...el.querySelectorAll('.ro-md')].map(x => [x.dataset.m, x])), b: F.dirBlur(`ro-a-${s.id}-${i}`), cur: 'happy', fo: '' };
    });
    // text fades out before it crosses the top of what the camera shows (a zoomed list runs off the frame)
    const vtop = (ctx.view || { y0: 0 }).y0 + 4 * u, edge = y => K.clamp((y - vtop) / (.3 * p));
    const ease = t => 1 - Math.pow(1 - K.clamp(t), 3);
    const at = t => {      // positions at local time t, in stage px
      // the slot's up-drift runs until the list has settled, then creeps on at 8 % of it (≈ .1 px a frame), so a roster
      // whose last step is early (an explicit first:) never stops while a long roster stays centred
      const pos = P.pos(t), slot = slotY0 - M.slotDrift * p * (ramp(t, 0, P.end + 30, 3) + .08 * Math.max(0, t - (P.end + 30))) + M.drag * p * pos;
      const trail = -M.trail * (en.dy || 0) * Math.pow(en.decay ?? .8, Math.max(0, t));
      return { pos, slot, L: slot + .229 * p + trail - pos * p };
    };
    const moodAt = (k, t) => {
      const rv = P.land[k] + 1;
      if (t >= P.leave[k]) return k % 2 ? 'open' : 'happy';
      if (t < rv + 1) return 'happy';
      if (t < rv + 10) return 'blink';
      return 'smile';
    };
    return {
      render(t) {
        const g = at(t), g1 = at(t + .25), g0 = at(t - .25);
        const vL = (g1.L - g0.L) * 2;
        hl.style.transform = `translateY(${g.slot.toFixed(2)}px)`;
        list.style.transform = `translateY(${(g.L).toFixed(2)}px)`;
        const lbl = Math.max(0, Math.abs(vL) * .22 - .4 * u);     // the list's motion blur, folded into each text's own blur
        header.style.top = `${(g.L - .687 * p - .195 * p * .86).toFixed(2)}px`;     // top, not a transform: it fades too (a fading transformed element makes Chrome composite)
        const above = k => K.clamp((g.slot + .229 * p - (g.L + k * p)) / p);           // 0 in the slot … 1 a row above
        // its text and icon fade themselves (an element that both moves and fades makes Chrome composite it)
        { const ho = K.clamp(1 - (above(-1) - 1.6) / 1.2) * edge(g.L - .687 * p - .195 * p * .86 - .2 * p); header.style.display = ho < .002 ? 'none' : 'block'; hdrT.style.opacity = ho.toFixed(3); hdrS.style.opacity = ho.toFixed(3); }
        rows.forEach((r, k) => {
          const u0 = t - (P.land[k] + 1), vis = u0 >= -.5;
          r.el.style.display = vis ? 'block' : 'none';
          if (!vis) return;
          const dim = above(k), far = K.clamp(1 - ((g.slot + .229 * p - (g.L + k * p)) / p - 1.6) / 1.2) * edge(g.L + k * p);
          const tint = 1 - (x => x * x * (3 - 2 * x))(K.clamp((u0 - .8) / 5.2)), pale = mix(col(k), bgc, .38);
          const base = dim > .01 ? mix(F.rgbOf(titleC), F.rgbOf(dimC), dim) : titleC;
          r.ti.style.color = tint > .01 ? mix(F.rgbOf(pale), F.rgbOf(base), 1 - tint) : base;
          if (r.su) r.su.style.color = tint > .01 ? mix(F.rgbOf(pale), subC, 1 - tint * .75) : `rgb(${subC.join(',')})`;
          const w1 = ease((u0 + .5) / 3.2), w2 = ease((u0 - .5) / 3.6);
          for (const [el, w] of [[r.ti, w1], [r.su, w2]]) if (el) { if (w >= 1) { el.style.webkitMaskImage = 'none'; el.style.maskImage = 'none'; } else { const a = (w * 1.45 - .45) * 100, b2 = w * 1.45 * 100, m = `linear-gradient(90deg,#000 ${a.toFixed(2)}%,transparent ${b2.toFixed(2)}%)`; el.style.webkitMaskImage = m; el.style.maskImage = m; } }
          const bl = 2.6 / 174 * p * (1 - ease(u0 / 4.5));
          // one blur per text = its reveal blur combined with the list's motion blur (no filter on the moving row itself:
          // a filtered, moving row around masked, fading text makes Chrome composite it)
          const bx2 = Math.hypot(bl, lbl * .08), by2 = Math.hypot(bl * .6, lbl);
          r.ti.style.filter = F.filt(r.bt(bx2, by2)); if (r.su) r.su.style.filter = F.filt(r.bs(bx2, by2));
          const gx = -.08 * p * (1 - ease(u0 / 22));
          r.el.style.left = `${(tx + gx).toFixed(2)}px`;     // the glide by left, not a transform
          r.ti.style.opacity = ((.35 + .65 * ease((u0 + .5) / 6)) * far).toFixed(3);
          if (r.su) r.su.style.opacity = ((.25 + .75 * ease((u0 - .5) / 6.5)) * far).toFixed(3);
        });
        if (more) {
          const k = n - 1, u0 = t - P.land[k], vis = u0 > -.5;
          more.el.style.display = vis ? 'block' : 'none';
          if (vis) {
            const w = K.clamp((u0 - .5) / 3.5);
            if (w >= 1) { more.tx.style.webkitMaskImage = 'none'; more.tx.style.maskImage = 'none'; } else { const a = (w * 1.5 - .5) * 100, b2 = w * 1.5 * 100, m = `linear-gradient(90deg,#000 ${a.toFixed(2)}%,transparent ${b2.toFixed(2)}%)`; more.tx.style.webkitMaskImage = m; more.tx.style.maskImage = m; }
            const bl = 2.6 / 174 * p * (1 - ease(u0 / 5));
            more.tx.style.filter = F.filt(more.b(Math.hypot(bl, lbl * .08), Math.hypot(bl * .6, lbl))); more.tx.style.opacity = (.3 + .7 * ease(u0 / 7)).toFixed(3);
            more.sq.forEach((q, i) => {
              const pp = K.clamp((u0 - 1.5 - 2 * i + .5) / 2), sc = pp <= 0 ? 0 : .3 + .7 * ease(pp) + .08 * Math.sin(Math.PI * pp);
              q.style.opacity = pp > 0 ? 1 : 0; q.style.transform = pp >= 1 ? 'none' : `scale(${sc.toFixed(3)})`;
            });
          }
        }
        masc.forEach((m, k) => {
          let x, y, vx = 0, vy, clip = 'none';
          const rowY = l => l + k * p + .27 * p;
          if (k === 0 && t < 21.5) {
            const xr = seq(DROP_X, t) * p, yr = seq(DROP_Y, t) * p;
            const xr1 = seq(DROP_X, t + .5) * p, xr0 = seq(DROP_X, t - .5) * p, yr1 = seq(DROP_Y, t + .5) * p, yr0 = seq(DROP_Y, t - .5) * p;
            x = mx + xr; y = g.slot + yr; vx = xr1 - xr0; vy = (g1.slot - g0.slot) * 2 + (yr1 - yr0);
            if (t < 5.5) {        // clipped by the slot's top and left edges until it is inside
              const top = g.slot - (y - ms / 2), left = x0 - (x - ms / 2);
              clip = `inset(${Math.max(0, top).toFixed(2)}px 0 0 ${Math.max(-ms, left).toFixed(2)}px round ${(.167 * p).toFixed(1)}px ${(.167 * p).toFixed(1)}px 0 0)`;
            }
          } else {
            y = rowY(g.L); vy = vL;
            if (k === 0) {        // hand-off from the drop (pinned to the slot) onto row 0 over 6 frames
              const h = ease((t - 21.5) / 6), yd = g.slot + DROP_Y[DROP_Y.length - 1] * p, xd = mx + DROP_X[DROP_X.length - 1] * p;
              y = K.lerp(yd, rowY(g.L), h); x = K.lerp(xd, mx, h);
            } else {
              const rel = t - P.land[k];
              if (rel < -4.5) { m.el.style.display = 'none'; return; }
              x = mx + tab(FLY, rel) * p; vx = (tab(FLY, rel + .5) - tab(FLY, rel - .5)) * p;
            }
          }
          m.el.style.display = 'block';
          // rows well above the slot fade out with their text (1.6 → 2.8 pitches up); the faces fade, not the wrapper,
          // which moves and blurs (a moving, filtered element that fades makes Chrome composite it)
          const far = k === 0 && t < 21.5 ? 1 : K.clamp(1 - ((g.slot + .229 * p - (g.L + k * p)) / p - 1.6) / 1.2), fo = far >= .999 ? '' : far.toFixed(3);
          if (fo !== m.fo) { for (const el of Object.values(m.md)) el.style.opacity = fo; m.fo = fo; }
          m.el.style.transform = `translate(${(x - mx).toFixed(2)}px,${(y - ms / 2).toFixed(2)}px)`;
          m.el.style.clipPath = clip;
          m.el.style.filter = F.filt(m.b(Math.min(20 * u, Math.abs(vx) * .22), Math.min(20 * u, Math.max(0, Math.abs(vy) * .22 - .4 * u))));
          const mood = moodAt(k, t);
          if (mood !== m.cur) { for (const [key, el] of Object.entries(m.md)) el.style.display = key === mood ? 'block' : 'none'; m.cur = mood; }
        });
      },
    };
  },
};
