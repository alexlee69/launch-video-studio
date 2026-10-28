// press — the key click, shot close (the "generate press" beat): one control drawn big (a button, a keycap, a toggle row
// or a prompt bar's send button) over a soft depth-of-field UI; a large cursor arrives from off-frame on a curved,
// bell-shaped path, hovers (the control lifts and brightens), presses (cursor .85, control .94 for ~100 ms, released over
// ~220 ms), and on the press 4 rings expand from the control with a glow; the label can switch to a working state
// (`after`). The press lands ~10 frames before the shot ends so the cut falls on the rings.
import { F } from './_film.js';
import { M } from './_motion.js';

const CONTROLS = ['button', 'key', 'toggle', 'send'];
const words = v => String(v ?? '').replace(/[*|]/g, ' ').trim().split(/\s+/).filter(Boolean).length;
// timing (local frames): entrance 0–15; cursor travel → hover (dwell 6 frames = 200 ms) → press at `at`
function plan(s, D) {
  const at0 = s.at != null && s.at !== '' ? F.at(s.at, 0, 'press at') : D - 10;
  const at = Math.max(12, Math.min(D - 4, at0)), dwell = 6, hover = at - dwell;
  const travel = Math.max(10, Math.min(24, hover - 14)), start = hover - travel;
  return { at, hover, travel, start, rings: [0, 1, 2, 3].map(j => at + 1 + j * 2.5), state: at + 2 };
}
// send: the prompt types itself in while the cursor is still away (review fix #11: the bar sat unchanged for ~1.6 s
// before the cursor came) — ~23 characters a second from frame 4, done 2 frames before the cursor sets off; null when
// that leaves under 8 frames (the prompt is then on screen from the first frame, as before) or typed: false
const typeWin = (s, D, n) => {
  if (s.control !== 'send' || s.typed === false || n < 2) return null;
  const p = plan(s, D), t0 = 4, t1 = Math.min(p.start - 2, t0 + n * 1.3);
  return t1 - t0 >= 8 ? { t0, t1 } : null;
};
const labelOf = s => s.label != null && String(s.label).trim() !== '' ? String(s.label) : s.control === 'send' ? 'Make a launch teaser' : s.control === 'key' ? 'Enter' : s.control === 'toggle' ? 'Auto-publish' : 'Generate';
// the face (width as a share of W, height as a share of that width) per control and aspect; the label's size as a share
// of the face height; the label's room inside a face fw × fh, and the face width a label of width w needs
const DIMS = (portrait, square) => ({
  button: [portrait ? .8 : square ? .7 : .5, portrait ? .243 : square ? .25 : .24],
  key: [portrait ? .7 : square ? .6 : .4, .42],
  toggle: [portrait ? .8 : square ? .76 : .56, portrait ? .28 : .23],
  send: [portrait || square ? .8 : .66, portrait || square ? .22 : .19],
});
const LFS = { button: .36, key: .3, toggle: .3, send: .27 };
const RING_Y = .62;          // the rings grow this much less vertically than horizontally
const roomOf = (control, fw, fh) => control === 'toggle' ? fw - fh * .42 - (fh * .5 * 1.78 + fh * .26) - fh * .22 : control === 'send' ? fw - fh * 1.5 : fw * .78;
const fwFor = (control, w, fh) => control === 'toggle' ? w + fh * .42 + (fh * .5 * 1.78 + fh * .26) + fh * .22 : control === 'send' ? w + fh * 1.5 : w / .78;
// Node-side estimate of how the label lays out per aspect (Inter 600 ≈ .55 em a character): 'line' | 'wrap' | 'cut'
const ASPECT_WH = { '16x9': [1920, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080] };
function labelFit(s, aspect) {
  const [W, H] = ASPECT_WH[aspect], u = Math.min(W, H) / 1080, portrait = H > W, square = W === H;
  const control = CONTROLS.includes(s.control) ? s.control : 'button', d = DIMS(portrait, square)[control], fh = W * d[0] * d[1];
  const lfs = LFS[control] * fh, floor = (portrait || square ? 40 : 48) * u, icon = s.icon || (control === 'button' && s.label == null);
  const room = roomOf(control, W * .8, fh), est = (copy, size) => String(copy).replace(/[*|]/g, '').length * .55 * size;
  const iw = size => icon ? size * 1.43 : 0, need = size => Math.max(est(labelOf(s), size) + iw(size), s.after ? est(s.after, size) + size * 1.43 : 0);
  if (need(Math.max(floor, lfs * .72)) <= room) return 'line';
  if (control === 'send') return need(floor) <= room ? 'line' : 'cut';
  // two balanced lines: the longer one ≈ 58 % of the label (word breaks)
  return need(floor) * .58 <= room ? 'wrap' : 'cut';
}

export default {
  name: 'press',
  doc: 'The key click, shot close: one control drawn big (button · key · toggle · send) over a soft depth-of-field UI; a large cursor arrives on a curved path, hovers, presses, and rings burst from the control with a glow — the cut lands on the rings.',
  layers: 'backdrop · control · label · rings · cursor · text',
  media: [],
  copy: s => [s.text, labelOf(s), s.after].filter(x => x != null && String(x).trim() !== '').map(String),
  read: s => [s.text, labelOf(s)].filter(x => x != null && String(x).trim() !== '').map(String),
  params: {
    control: 'button (default) | key | toggle | send — what is pressed (send = a prompt bar with its round send button)',
    label: 'the control\'s text: button text ("Generate"), the key ("Enter"), the toggle\'s setting, or the prompt in the bar',
    icon: 'optional built-in icon beside the label (sparkle, bolt, check, star …; default sparkle on a bare "Generate")',
    text: 'optional 1–3 word line above the control (must-read, *accent* ok)',
    after: 'optional working state the label switches to on the press, e.g. "Generating…" (with a spark spinner)',
    at: 'local frame (or seconds, "1.6s") of the press — default 10 frames before the shot ends, so the cut lands on the rings',
    typed: 'send: the prompt types itself in before the cursor arrives (default); false = on screen from the first frame',
    theme: '(any shot) light (default) or dark; with bg: footage the control floats over it',
  },
  required: [],
  validate(s, D) {
    const w = [], p = plan(s, D);
    if (D < 45) w.push(`press ${s.id}: ${D} frames is tight for entrance + cursor travel + dwell + press; give it ≥ 1.5 s (2–2.5 s reads best)`);
    else if (p.travel < 15) w.push(`press ${s.id}: the cursor has only ${p.travel} frames to travel (0.5–0.9 s reads as a hand) — move \`at\` later or lengthen the shot`);
    if (s.text != null && words(s.text) > 3) w.push(`press ${s.id}: text is ${words(s.text)} words — the press beat holds 1–3 (put the rest in the next shot)`);
    const at0 = s.at != null && s.at !== '' ? F.at(s.at, 0, 'press at') : null;
    if (at0 != null && at0 > D - 4) w.push(`press ${s.id}: press at ${s.at} is past the shot (${D} frames) — pressing at ${p.at}, which leaves no frames for the rings before the cut; set at ≤ ${D - 8}`);
    else if (at0 != null && at0 < 12) w.push(`press ${s.id}: press at ${s.at} is before the control has landed — pressing at ${p.at}`);
    else if (s.at != null && p.at > D - 6) w.push(`press ${s.id}: the press at ${p.at} leaves no frames for the rings before the cut`);
    // a long label: estimated per aspect (the build widens the face, shrinks, wraps, and only then cuts it with "…")
    const fits = Object.keys(ASPECT_WH).map(a => [a, labelFit(s, a)]), cut = fits.filter(([, f]) => f === 'cut').map(([a]) => a), wrap = fits.filter(([, f]) => f === 'wrap').map(([a]) => a);
    const which = s.after && labelOf(s).length < String(s.after).length ? `after "${s.after}"` : `label "${labelOf(s)}"`;
    if (cut.length) w.push(`press ${s.id}: ${which} is too long for the ${CONTROLS.includes(s.control) ? s.control : 'button'} — it is cut short with "…" on ${cut.join(', ')}; keep it to 1–4 words`);
    else if (wrap.length) w.push(`press ${s.id}: ${which} wraps to two lines on ${wrap.join(', ')} — a press reads best with 1–3 words`);
    return w;
  },
  cues: (s, D) => {
    const p = plan(s, D), tw = typeWin(s, D, labelOf(s).length), keys = [];
    if (tw) for (let t = tw.t0 + 1; t < tw.t1; t += 4) keys.push({ t, kind: 'tick', gain: .28 });    // soft key ticks while it types
    return [...keys, { t: p.hover, kind: 'tick', gain: .8 }, { t: p.at, kind: 'click', gain: 1 }, { t: p.at + 2, kind: 'pop', note: 86, gain: .75 }];
  },
  hero: (s, D) => { const p = plan(s, D); return Math.max(0, Math.min(p.at + 3, D - 8)); },
  async build(ctx, s) {
    const { W, H, u, K, A, safe, portrait, square } = ctx, C = ctx.C, dark = ctx.dark;
    const P = plan(s, ctx.D), control = CONTROLS.includes(s.control) ? s.control : 'button';
    const acc = C.accent, ink = dark ? '#FFFFFF' : C.ink, label = labelOf(s);
    const icon = s.icon ? String(s.icon) : control === 'button' && s.label == null ? 'sparkle' : null;
    // ── layout: the control's face (fw × fh) centred at (cx, cy); text above it
    const dims = DIMS(portrait, square)[control];
    const fh = W * dims[0] * dims[1];
    // the label decides the face's width: a label longer than its room first widens the face (up to 80 % of the frame),
    // then shrinks (one line ≥ 48 px on 16:9, ≥ 40 px on 9:16 / 1:1), then wraps to two lines (button, key, toggle), and
    // only then is cut short with "…" (validate warns before it gets there)
    const lfs = LFS[control] * fh, isz = lfs * 1.05, floor = (portrait || square ? 40 : 48) * u;
    const hasIcon = !!icon;
    const measure = (copy, size) => {
      const tmp = ctx.el('', `left:0;top:0;visibility:hidden;white-space:nowrap`);
      const tx = ctx.text(copy, { size: size / u, weight: control === 'send' ? 500 : 600, nowrap: true, ls: '-.02em', parent: tmp });
      const rg = document.createRange(); rg.selectNodeContents(tx); const w = rg.getBoundingClientRect().width; tmp.remove(); return w;
    };
    const needW = Math.max(measure(label, lfs) + (hasIcon ? isz + lfs * .38 : 0), s.after ? measure(String(s.after), lfs) + isz + lfs * .38 : 0);
    const fw = Math.max(W * dims[0], Math.min(W * .8, fwFor(control, needW, fh)));
    const tsize = portrait ? 108 : square ? 96 : 110;
    let head = null;
    if (s.text) {
      head = ctx.text(s.text, { size: tsize, weight: 700, align: 'center', style: 'text-wrap:balance;',  maxW: safe.w * .92, lines: 2, min: 64, layer: 'text', color: ink, accent: acc });
      head.style.width = safe.w * .92 + 'px';
    }
    const hh = head ? head.offsetHeight : 0, gap = (portrait ? 120 : 90) * u;
    const blockH = hh + (head ? gap : 0) + fh, top = (portrait ? H * .53 : H * .53) - blockH / 2;
    const cx = W / 2, cy = head ? top + hh + gap + fh / 2 : H * (portrait ? .52 : .5);
    if (head) { head.style.left = (W / 2 - safe.w * .46) + 'px'; head.style.top = Math.max(safe.y0, top) + 'px'; head.style.transformOrigin = '50% 100%'; }
    const fx0 = cx - fw / 2, fy0 = cy - fh / 2;

    // ── backdrop: the UI around the control, out of focus (two depths of blur), drifting slowly. One SVG whose blur is an
    // SVG filter (painted with the SVG): a CSS filter would give it its own composited layer, and everything over it would
    // then composite by overlap in the full frame but not in a --layers pass (the stack check failed on the press frames)
    let back = null;
    {
      const r = F.rng(F.hash('press:' + s.id)), ext = .12, BW = W * (1 + 2 * ext), BH = H * (1 + 2 * ext), ox = ext * W, oy = ext * H;
      const id = `mk-pr-${String(s.id).replace(/[^\w-]/g, '_')}`, card = dark ? '#1D1E24' : '#FFFFFF', skel = dark ? 'rgba(255,255,255,.10)' : 'rgba(17,17,20,.09)';
      let defs = '', far = '', near = '', ng = 0;
      const radial = (c, a0) => { const gid = `${id}-g${ng++}`; defs += `<radialGradient id="${gid}"><stop offset="0" stop-color="${c}" stop-opacity="${a0}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`; return `url(#${gid})`; };
      const rect = (x, y, w, h, fill, rad) => `<rect x="${(ox + x).toFixed(1)}" y="${(oy + y).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${rad.toFixed(1)}" fill="${fill}"/>`;
      if (!ctx.hasBg) {
        // a wash of brand colour (two soft blooms in opposite corners) under the panels
        far += rect(-.2 * W, -.3 * H, .9 * W, .9 * H, radial(acc, dark ? .28 : .16), 0) + rect(.45 * W, .45 * H, .9 * W, .9 * H, radial(C.accent2 || acc, dark ? .16 : .1), 0);
        // the panel the control sits on (bigger than the frame: macro) and its shadow, with rows of skeleton UI above and below
        const pw = Math.max(fw * 1.5, W * .92), ph = fh * 4.2;
        far += rect(cx - pw / 2, cy - ph / 2 + 30 * u, pw, ph, dark ? 'rgba(0,0,0,.45)' : 'rgba(20,24,40,.07)', 48 * u) + rect(cx - pw / 2, cy - ph / 2, pw, ph, card, 48 * u);
        for (let k = 0; k < 7; k++) {
          const above = k < 4, y = above ? cy - fh * (1.05 + .55 * k) - fh * .18 : cy + fh * (.95 + .6 * (k - 4)), h = fh * (.16 + .1 * r());
          const x = cx - pw * .42 + r() * pw * .25, w = pw * (.18 + .42 * r()), el = rect(x, y, w, h, k === 2 ? M.rgba(acc, dark ? .45 : .3) : skel, h / 2);
          if (k % 2) near += el; else far += el;
        }
        // side controls: a round avatar, a square tool, a pill — the rest of the toolbar, softer
        near += rect(cx - fw / 2 - fh * 1.55, cy - fh * .4, fh * .8, fh * .8, skel, fh * .4) + rect(cx + fw / 2 + fh * .75, cy - fh * .38, fh * .76, fh * .76, skel, fh * .2);
        far += rect(cx + fw / 2 + fh * 1.8, cy - fh * .3, fh * 1.5, fh * .6, M.rgba(acc, dark ? .35 : .22), fh * .3);
      } else {
        // over footage: only a soft haze behind the control (the footage is the depth)
        far += rect(cx - fw * .9, cy - fh * 2.2, fw * 1.8, fh * 4.4, radial('#000000', dark ? .35 : 0), 0);
        near += rect(cx - fw * .7, cy - fh * 1.3, fw * 1.4, fh * 2.6, radial(acc, .22), 0);
      }
      const blur = (n, sd) => `<filter id="${id}-${n}" filterUnits="userSpaceOnUse" x="${-BW}" y="${-BH}" width="${3 * BW}" height="${3 * BH}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${(sd * u).toFixed(2)}"/></filter>`;
      back = ctx.el(`<svg width="${BW.toFixed(1)}" height="${BH.toFixed(1)}" style="position:absolute;left:0;top:0;display:block;overflow:visible"><defs>${defs}${blur('far', 22)}${blur('near', 11)}</defs><g filter="url(#${id}-far)">${far}</g><g filter="url(#${id}-near)">${near}</g></svg>`,
        `left:${-ox}px;top:${-oy}px;width:${BW}px;height:${BH}px`, 'backdrop');
    }

    // ── the control (face + glow) and its label, two layers with identical boxes (2.6 × the face, so the glow and the
    // shadow stay inside the box that scales / blurs)
    const bw = Math.max(fw * 1.7, fw + fh * 3), bh = fh * 3.4, bx = cx - bw / 2, by = cy - bh / 2;
    const wrapCss = `left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px;transform-origin:50% 50%`;
    const ctl = ctx.el('', wrapCss, 'control'), lab = ctx.el('', wrapCss, 'label');
    ctl.dataset.lvWith = 'label';      // a carry or morph of the control takes its label along (review fix #2)
    const lx = (bw - fw) / 2, ly = (bh - fh) / 2;          // face box inside the wrappers
    const glow = document.createElement('div');
    glow.style.cssText = `position:absolute;left:${lx - fh * .9}px;top:${ly - fh * .9}px;width:${fw + fh * 1.8}px;height:${fh * 2.8}px;border-radius:${fh * 1.4}px;background:radial-gradient(closest-side,${M.rgba(acc, .55)},${M.rgba(acc, .18)} 55%,${M.rgba(acc, 0)});opacity:0`;
    glow.dataset.lvSoft = '';          // (a soft halo: carry / dive / flood / from: measure the control by its face, not this)
    ctl.appendChild(glow);
    const face = document.createElement('div');
    let target = face, tgt = { x: cx, y: cy, w: fw, h: fh, r: fh / 2 };        // what is pressed (scales to .94), its box in stage px
    let knob = null, track = null, sheen = null, keyLip = 0;
    const faceShadow = g => `0 ${(fh * (.16 - .05 * g)).toFixed(1)}px ${(fh * .5).toFixed(1)}px ${M.rgba(control === 'button' ? acc : '#141828', control === 'button' ? .34 + .2 * g : dark ? .5 : .14)}`;
    if (control === 'button') {
      face.style.cssText = `position:absolute;left:${lx}px;top:${ly}px;width:${fw}px;height:${fh}px;border-radius:${fh / 2}px;overflow:hidden;
        background:linear-gradient(180deg,${M.mix(acc, '#FFFFFF', .16)} 0%,${acc} 55%,${M.mix(acc, '#000000', .1)} 100%)`;
    } else if (control === 'key') {
      keyLip = fh * .09;
      face.style.cssText = `position:absolute;left:${lx}px;top:${ly}px;width:${fw}px;height:${fh}px;border-radius:${fh * .2}px;overflow:hidden;
        background:linear-gradient(180deg,${dark ? '#34353C' : '#FFFFFF'} 0%,${dark ? '#26272D' : '#F1F2F6'} 100%)`;
      tgt.r = fh * .2;
    } else if (control === 'toggle') {
      face.style.cssText = `position:absolute;left:${lx}px;top:${ly}px;width:${fw}px;height:${fh}px;border-radius:${fh * .28}px;background:${dark ? '#1C1D23' : '#FFFFFF'};box-shadow:0 0 0 ${1.5 * u}px ${dark ? 'rgba(255,255,255,.08)' : 'rgba(17,17,20,.06)'}`;
      const th = fh * .5, tw = th * 1.78;
      track = document.createElement('div');
      track.style.cssText = `position:absolute;left:${fw - tw - fh * .26}px;top:${(fh - th) / 2}px;width:${tw}px;height:${th}px;border-radius:${th / 2}px;background:${dark ? '#3A3B43' : '#DADDE5'}`;
      knob = document.createElement('div');
      const kd = th * .84;
      knob.style.cssText = `position:absolute;left:${(th - kd) / 2}px;top:${(th - kd) / 2}px;width:${kd}px;height:${kd}px;border-radius:50%;background:#FFFFFF;box-shadow:0 ${kd * .08}px ${kd * .2}px rgba(10,12,30,.28)`;
      knob.dataset.x0 = (th - kd) / 2; knob.dataset.x1 = tw - kd - (th - kd) / 2;
      track.appendChild(knob); face.appendChild(track);
      target = track;
      tgt = { x: fx0 + fw - tw - fh * .26 + tw / 2, y: cy, w: tw, h: th, r: th / 2 };
    } else {   // send: a prompt bar with a round send button at its right end
      face.style.cssText = `position:absolute;left:${lx}px;top:${ly}px;width:${fw}px;height:${fh}px;border-radius:${fh / 2}px;background:${dark ? '#1C1D23' : '#FFFFFF'};box-shadow:0 0 0 ${1.5 * u}px ${dark ? 'rgba(255,255,255,.09)' : 'rgba(17,17,20,.07)'}`;
      const d = fh * .68, btn = document.createElement('div');
      btn.style.cssText = `position:absolute;left:${fw - d - (fh - d) / 2}px;top:${(fh - d) / 2}px;width:${d}px;height:${d}px;border-radius:50%;background:linear-gradient(180deg,${M.mix(acc, '#FFFFFF', .14)},${acc});box-shadow:0 ${d * .08}px ${d * .26}px ${M.rgba(acc, .4)}`;
      btn.innerHTML = `<svg width="${d}" height="${d}" viewBox="0 0 100 100" style="display:block"><path d="M50 72V30M32 47l18-18 18 18" fill="none" stroke="#fff" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      face.appendChild(btn);
      target = btn;
      tgt = { x: fx0 + fw - d / 2 - (fh - d) / 2, y: cy, w: d, h: d, r: d / 2 };
    }
    if (control === 'button' || control === 'key') {
      sheen = document.createElement('div');        // a light sweep across the face while it waits (moves by background-position)
      sheen.style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;background:linear-gradient(105deg,rgba(255,255,255,0) 35%,rgba(255,255,255,${control === 'button' ? .34 : dark ? .1 : .7}) 50%,rgba(255,255,255,0) 65%) 0 0/300% 100% no-repeat;opacity:0`;
      face.appendChild(sheen);
    }
    const hi = document.createElement('div');        // hover brightening
    hi.style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;background:rgba(255,255,255,${dark && control !== 'button' ? .07 : .16});opacity:0;border-radius:inherit`;
    face.appendChild(hi);
    ctl.appendChild(face);

    // the label (and icon / spinner) in the label layer, in a box the size of the face (clipped, so states push through it)
    const lbox = document.createElement('div');
    lbox.style.cssText = `position:absolute;left:${lx}px;top:${ly}px;width:${fw}px;height:${fh}px;border-radius:${control === 'key' ? fh * .2 : fh / 2}px;overflow:hidden`;
    lab.appendChild(lbox);
    const lcol = control === 'button' ? '#FFFFFF' : ink;
    // the label's room: the face minus its left padding, the switch / send button and a gap
    const room = roomOf(control, fw, fh);
    const iconHtml = icon ? `<div style="position:relative;flex:none;width:${isz}px;height:${isz}px">${A.icon(icon, lcol, isz)}</div>` : '';
    const mkLine = (copy, withIcon, spin) => {
      const row = document.createElement('div');
      const left = control === 'toggle' || control === 'send';
      row.style.cssText = `position:absolute;left:0;top:0;width:${fw}px;height:${fh}px;display:flex;align-items:center;justify-content:${left ? 'flex-start' : 'center'};gap:${lfs * .38}px;box-sizing:border-box;padding-left:${left ? fh * (control === 'send' ? .5 : .42) : 0}px`;
      if (spin) row.insertAdjacentHTML('beforeend', `<div style="position:relative;flex:none;width:${isz}px;height:${isz}px">${F.spark(isz, lcol)}</div>`);
      else if (withIcon && iconHtml) row.insertAdjacentHTML('beforeend', iconHtml);
      lbox.appendChild(row);
      const iw = (spin || (withIcon && iconHtml)) ? isz + lfs * .38 : 0, maxW = room - iw;
      const mk = c => { const tx = ctx.text(c, { size: lfs / u, weight: control === 'send' ? 500 : 600, nowrap: true, ls: '-.02em', color: lcol, accent: control === 'button' ? '#FFFFFF' : acc, parent: row }); tx.style.position = 'relative'; return tx; };
      let tx = mk(copy);
      // one line, shrunk no further than ~72 % of the face's size (or the floor)
      ctx.fit(tx, { maxW, lines: 1, min: Math.max(floor, lfs * .72) });
      const wide = () => tx.scrollWidth > maxW + 1;
      if (wide() && control !== 'send') {
        // two balanced lines (word breaks), shrunk down to the floor
        tx.style.fontSize = Math.min(lfs, fh * .38) + 'px';
        tx.style.whiteSpace = 'normal'; tx.style.width = maxW + 'px'; tx.style.lineHeight = '1.06'; tx.style.textWrap = 'balance';
        tx.style.textAlign = left ? 'left' : 'center';
        ctx.fit(tx, { maxW, lines: 2, min: floor });
      } else if (wide()) ctx.fit(tx, { maxW, lines: 1, min: floor });
      // last resort: drop words from the end and close with "…" (validate already warned)
      const lines = control === 'send' ? 1 : 2, over = () => tx.scrollWidth > maxW + 1 || tx.offsetHeight > parseFloat(tx.style.fontSize) * (parseFloat(tx.style.lineHeight) || 1.04) * lines + 2;
      if (over()) {
        const ws = String(copy).split(/\s+/);
        for (let k = ws.length - 1; k >= 1 && over(); k--) { const fs = tx.style.cssText; tx.remove(); tx = mk(ws.slice(0, k).join(' ') + '…'); tx.style.cssText = fs; tx.style.position = 'relative'; }
      }
      return { row, tx };
    };
    const L0 = mkLine(label, true, false), L1 = s.after ? mkLine(String(s.after), false, true) : null;
    if (L1) { L1.row.style.top = fh + 'px'; L1.row.style.visibility = 'hidden'; }

    // ── rings (one SVG over the frame; rect attributes per frame — painted, never composited)
    const ns = 'http://www.w3.org/2000/svg';
    // with a line above the control, the rings fade out under it (a feathered mask over the line's glyphs)
    let mask = '', mref = '';
    if (head) {
      const rg = document.createRange(); rg.selectNodeContents(head); const hb = rg.getBoundingClientRect(), z = ctx.el('', `left:0;top:0;width:${W}px;height:1px`), sb = z.getBoundingClientRect(), k = sb.width ? W / sb.width : 1; z.remove();
      const p = 28 * u, mx = (hb.left - sb.left) * k - p, my = (hb.top - sb.top) * k - p, mw = hb.width * k + 2 * p, mh = hb.height * k + 2 * p, mid = `mk-prm-${String(s.id).replace(/[^\w-]/g, '_')}`;
      mask = `<defs><filter id="${mid}-f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(16 * u).toFixed(2)}"/></filter><mask id="${mid}" maskUnits="userSpaceOnUse" x="${-W}" y="${-H}" width="${3 * W}" height="${3 * H}"><rect x="${-W}" y="${-H}" width="${3 * W}" height="${3 * H}" fill="#fff"/><rect x="${mx.toFixed(1)}" y="${my.toFixed(1)}" width="${mw.toFixed(1)}" height="${mh.toFixed(1)}" rx="${(mh / 2).toFixed(1)}" fill="#000" filter="url(#${mid}-f)"/></mask></defs>`;
      mref = ` mask="url(#${mid})"`;
    }
    const rings = ctx.el(`<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;overflow:visible">${mask}<g${mref}>${[0, 1, 2, 3].map(() => `<rect fill="none" stroke="${acc}" opacity="0"/>`).join('')}</g></svg>`, `left:0;top:0;width:${W}px;height:${H}px`, 'rings');
    const ringEls = [...rings.querySelectorAll('g > rect')];

    // ── the cursor: enters from off-frame (bottom-right; bottom on 9:16) on an arc, tip on the target
    const cs = M.cursor(150 * u), cur = ctx.el(cs.html, `left:0;top:0;width:${cs.w}px;height:${cs.h}px;transform-origin:${cs.tx}px ${cs.ty}px`, 'cursor');
    // the click point: right of the label — or, when the label fills the face, under it (the arrow hangs down-right of its
    // tip, so it never covers the label). The label's extent is the union of both states (L1 = `after`, wider or not),
    // measured in the face's own box at rest
    const U = (() => {
      const fb = lbox.getBoundingClientRect(), k = fb.width ? fw / fb.width : 1, out = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      for (const L of [L0, L1].filter(Boolean)) {
        const rb = L.row.getBoundingClientRect(), rg = document.createRange(); rg.selectNodeContents(L.row); const r = rg.getBoundingClientRect();
        out.x0 = Math.min(out.x0, fx0 + (r.left - fb.left) * k); out.x1 = Math.max(out.x1, fx0 + (r.right - fb.left) * k);
        out.y0 = Math.min(out.y0, fy0 + (r.top - rb.top) * k); out.y1 = Math.max(out.y1, fy0 + (r.bottom - rb.top) * k);
      }
      return out;
    })();
    const click = (() => {
      if (control === 'toggle') return [tgt.x - tgt.w * .2, cy + tgt.h * .12];
      if (control === 'send') return [tgt.x + tgt.r * .08, cy + tgt.r * .3];
      const xmax = fx0 + fw - fh * (control === 'key' ? .14 : .24), right = Math.max(U.x1 + fh * .2, cx + fw * .22);
      if (right <= xmax) return [right, cy + fh * .14];
      // under the label, on the face's lower right
      return [Math.min(xmax, cx + fw * .26), Math.min(fy0 + fh * .9, Math.max(cy + fh * .14, U.y1 + 16 * u))];
    })();
    const from = portrait ? [W * .9, H + cs.h * 1.2] : [W + cs.w * 1.3, H * .93];
    if (head) ctx.root.appendChild(head);          // the line paints last (tree order = paint order)
    const pblur = F.dirBlur(`mk-pr-${s.id}`);
    const curAt = t => M.arc(from, click, .1, M.bell(M.u01(t, P.start, P.hover)));
    await document.fonts.ready;
    await Promise.all([...ctl.querySelectorAll('img'), ...lab.querySelectorAll('img')].map(i => i.decode().catch(() => null)));
    const shadow0 = control === 'key' ? (dark ? '#0A0A0D' : '#C9CCD6') : null;
    // send: the typing reveal — the label's character boundaries (its own px), a caret riding the edge, blinking once typed
    let typing = null;
    {
      const tn = L0.tx, txt = tn.textContent, tw = typeWin(s, ctx.D, txt.length);
      if (tw) {
        const tb = tn.getBoundingClientRect(), k = tb.width ? tn.offsetWidth / tb.width : 1, xs = [0];
        const nodes = []; for (const w = document.createTreeWalker(tn, NodeFilter.SHOW_TEXT); w.nextNode();) nodes.push(w.currentNode);
        for (const nd of nodes) for (let j = 0; j < nd.length; j++) { const rg = document.createRange(); rg.setStart(nd, j); rg.setEnd(nd, j + 1); const r = rg.getBoundingClientRect(); xs.push(Math.max(xs[xs.length - 1], r.width ? (r.right - tb.left) * k : xs[xs.length - 1])); }
        const fsz = parseFloat(tn.style.fontSize) || lfs, caret = document.createElement('div');
        caret.style.cssText = `position:absolute;left:0;top:${(tn.offsetTop + (tn.offsetHeight - fsz * 1.1) / 2).toFixed(1)}px;width:${(3.5 * u).toFixed(2)}px;height:${(fsz * 1.1).toFixed(1)}px;border-radius:${(2 * u).toFixed(1)}px;background:${acc}`;
        L0.row.appendChild(caret);
        typing = { tn, xs, n: xs.length - 1, caret, ...tw };
      }
    }

    return {
      render(t, D) {
        // entrance (house: scale .96 → 1, blur 8 → 0, expo-out over 15 frames — already 3 frames in on the cut, so the
        // first frame shows the control; the text 3 frames later)
        const e = M.enter(t, -3, 15, u), et = M.enter(t, 0, 15, u);
        const hov = M.outExpo(M.u01(t, P.hover - 2, P.hover + 5));
        const pr0 = t < P.at ? 0 : t < P.at + 3 ? M.bell((t - P.at) / 3) : 1 - M.bell((t - P.at - 3) / 6.6), pr = pr0 < 1e-3 ? 0 : pr0;
        const lift = -6 * u * hov * (1 - pr);
        const whole = control === 'button' || control === 'key';
        const sc = e.s * (whole ? 1 - .06 * pr : 1);
        // the hover lift moves the boxes by top (a held transform on the label would make it history-dependent); scale only
        // while entering / pressed
        const tf = e.k < 1 || sc !== 1 ? `scale(${sc.toFixed(5)})` : 'none';
        for (const w of [ctl, lab]) { w.style.opacity = e.o.toFixed(3); w.style.filter = F.filt(F.blur(e.blur)); w.style.transform = tf; w.style.top = (by + lift).toFixed(2) + 'px'; }
        if (!whole) target.style.transform = pr > 0 ? `scale(${(1 - .06 * pr).toFixed(5)})` : 'none';
        // glow: up on the press, held ≥ 10 frames, settling to a warm .45
        const g = M.u01(t, P.at, P.at + 2) * (1 - .55 * M.u01(t, P.at + 10, P.at + 24));
        glow.style.opacity = (Math.max(.12 * hov, g)).toFixed(3);
        if (control === 'key') {
          const dn = keyLip * (pr * .8 + .15 * hov * (1 - pr));
          face.style.top = (ly - keyLip + dn).toFixed(2) + 'px';
          face.style.boxShadow = `0 ${(keyLip - dn + 1).toFixed(2)}px 0 ${shadow0},0 ${(keyLip - dn + fh * .12).toFixed(2)}px ${(fh * .45).toFixed(1)}px ${dark ? 'rgba(0,0,0,.55)' : 'rgba(20,24,40,.16)'},inset 0 ${(2 * u).toFixed(1)}px 0 rgba(255,255,255,${dark ? .08 : .9})${g > .01 ? `,0 0 ${(fh * .9 * g).toFixed(1)}px ${M.rgba(acc, .45 * g)}` : ''}`;
          lbox.style.top = (ly - keyLip + dn).toFixed(2) + 'px';
        } else if (control === 'button') face.style.boxShadow = `${faceShadow(g)},inset 0 ${(2.5 * u).toFixed(1)}px 0 rgba(255,255,255,.3),inset 0 ${(-3 * u).toFixed(1)}px 0 rgba(0,0,0,.08)`;
        else face.style.boxShadow = `0 ${(fh * .14).toFixed(1)}px ${(fh * .55).toFixed(1)}px ${dark ? 'rgba(0,0,0,.5)' : 'rgba(20,24,40,.12)'},0 0 0 ${(1.5 * u).toFixed(1)}px ${dark ? 'rgba(255,255,255,.09)' : 'rgba(17,17,20,.07)'}`;
        hi.style.opacity = (hov * (1 - .6 * pr)).toFixed(3);
        if (sheen) { const sp = M.u01(t, 13, Math.max(14, P.start + 4)); sheen.style.opacity = (Math.sin(Math.PI * sp) * .9).toFixed(3); sheen.style.backgroundPosition = `${(100 - 100 * sp).toFixed(2)}% 0`; }
        if (knob) {        // the toggle flips 1 frame after the press: knob slides, track fills with the accent
          const on = M.outExpo(M.u01(t, P.at + 1, P.at + 10));
          knob.style.left = M.lerp(+knob.dataset.x0, +knob.dataset.x1, on).toFixed(2) + 'px';
          track.style.background = on > 0 ? M.mix(dark ? '#3A3B43' : '#DADDE5', acc, on) : (dark ? '#3A3B43' : '#DADDE5');
        }
        // label state: the label pushes up and out, the working state pushes in from below (exit 6 frames, entrance 9)
        if (L1) {
          const xo = M.inCubic(M.u01(t, P.state, P.state + 6)), xi = M.outExpo(M.u01(t, P.state + 1, P.state + 10));
          L0.row.style.top = (-fh * .9 * xo).toFixed(2) + 'px';
          L0.tx.style.filter = F.filt(F.blur(7 * u * xo));
          L1.row.style.top = (fh * .95 * (1 - xi)).toFixed(2) + 'px';
          L1.tx.style.filter = F.filt(F.blur(7 * u * (1 - xi)));
          // a state outside the face box is hidden, not only clipped (the text audit doesn't see overflow clipping). Never
          // 'visible': that would override a --layers pass hiding the label layer (visibility is inherited) — '' inherits
          L0.row.style.visibility = xo >= 1 ? 'hidden' : '';
          L1.row.style.visibility = t > P.state + 1 ? '' : 'hidden';        // xi > 0: the row has started into the face
          F.sparkAt(L1.row, t);
        }
        if (typing) {          // pure in t: the characters typed so far (whole characters), the caret at their edge
          const { tn, xs, n, caret, t0, t1 } = typing, ci = Math.max(0, Math.min(n, Math.floor(n * M.u01(t, t0, t1) + 1e-6)));
          tn.style.clipPath = ci >= n ? 'none' : `inset(-30% ${(tn.offsetWidth - xs[ci] + .5).toFixed(2)}px -30% -30%)`;
          caret.style.left = (tn.offsetLeft + xs[ci] + 3 * u).toFixed(2) + 'px';
          caret.style.opacity = t >= P.at ? '0' : t <= t1 + 4 ? '1' : Math.floor((t - t1 - 4) / 9) % 2 ? '0' : '1';
        }
        // rings: four outlines of the pressed shape grow from it (to ~1.9 × the face width; flatter vertically, so they
        // stay off the line above) and fade, 2.5 frames apart. Every attribute is set on every frame (pure in t)
        ringEls.forEach((rg, j) => {
          const a = M.u01(t, P.rings[j], P.rings[j] + 14);
          const k = 1 - Math.pow(1 - a, 3), grow = (control === 'button' || control === 'key' ? .45 * fw : control === 'toggle' ? 1.2 * tgt.w : 1.5 * tgt.w) * k;
          const w = tgt.w + 2 * grow, h = tgt.h + 2 * grow * RING_Y, ry = Math.min(h / 2, tgt.r + grow * RING_Y);
          for (const [kk, v] of [['x', tgt.x - w / 2], ['y', tgt.y + lift - h / 2], ['width', w], ['height', h], ['rx', ry], ['ry', ry]]) rg.setAttribute(kk, v.toFixed(2));
          rg.setAttribute('stroke-width', ((6 - 4 * k) * u * (1 - .2 * j)).toFixed(2));
          rg.setAttribute('opacity', a <= 0 || a >= 1 ? '0' : (Math.min(1, a * 6) * Math.pow(1 - a, 1.2) * (.85 - .14 * j)).toFixed(3));
        });
        // cursor: arc in with bell speed, hover, press (scale .85 about the tip), then drift on
        const [x, y] = t <= P.hover ? curAt(t) : [click[0] + (t - P.hover) * .35 * u, click[1] + (t - P.hover) * .18 * u + lift * .5];
        const [x1, y1] = curAt(t + .25), [x0, y0] = curAt(t - .25), vx = Math.abs(x1 - x0) * 2, vy = Math.abs(y1 - y0) * 2;
        const mb = t < P.hover ? Math.min(14 * u, .2 * Math.max(0, Math.hypot(vx, vy) - 6 * u)) : 0, nv = Math.hypot(vx, vy) || 1;
        cur.style.transform = `translate(${(x - cs.tx).toFixed(2)}px,${(y - cs.ty).toFixed(2)}px) scale(${(1 - .15 * pr).toFixed(4)})`;
        cur.style.filter = F.filt(pblur(mb * vx / nv, mb * vy / nv), `drop-shadow(0 ${(7 * u).toFixed(1)}px ${(9 * u).toFixed(1)}px rgba(0,0,0,.32))`);
        // text: rises in with the house entrance, then holds at transform: none (a held transform on text renders
        // differently depending on the frames drawn before it; the camera's push keeps the frame moving)
        if (head) {
          head.style.opacity = et.o.toFixed(3);
          head.style.filter = F.filt(F.blur(et.blur));
          head.style.transform = et.k < 1 ? `translateY(${((1 - et.k) * 30 * u).toFixed(2)}px) scale(${et.s.toFixed(5)})` : 'none';
        }
        // backdrop: a slow parallax drift (left/top, no transform) and a breath on the press
        // (whole pixels: the blurred SVG is repainted, never resampled at a sub-pixel offset)
        back.style.left = Math.round(-.12 * W - 22 * u * (t / D) + 5 * u * Math.sin(t * .05)) + 'px';
        back.style.top = Math.round(-.12 * H + 10 * u * (t / D) - 4 * u * g) + 'px';
      },
    };
  },
};
