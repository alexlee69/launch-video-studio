// scene — UI composited INTO footage: timed overlays pinned to the frame while the shot's footage (its `bg`, drawn by the
// engine full-bleed with a slow push, optional cinema bars) drifts behind them: a chat/prompt bar that types and sends,
// a message bubble that pops, floating kinetic words, a status pill with a mascot, a glowing voice orb. Without bg the
// overlays sit on the brand background — or on nothing in --clips/--layers --alpha (overlays for your own footage).
import { F } from './_film.js';

const KINDS = ['bar', 'bubble', 'words', 'pill', 'orb'];
const kindOf = o => KINDS.find(k => o && Object.prototype.hasOwnProperty.call(o, k));
// typing rhythm for a bar: ~19 chars/s with jitter, a beat after punctuation, a short one after spaces
function typing(o, a) {
  const text = String(o.bar ?? ''), chars = Array.from(text), r = F.rng(F.hash(text)), sp = Number(o.speed) || 1, times = [];
  let t = a + 9;
  for (let i = 0; i < chars.length; i++) {
    const prev = chars[i - 1];
    t += (1.15 + r() * .9) / sp + (/[.,!?]/.test(prev || '') ? 5 / sp : prev === ' ' ? .5 / sp : 0);
    times.push(t);
  }
  return { chars, times, send: (times.length ? times[times.length - 1] : a + 9) + 8 };
}
const captionLines = o => o.caption == null ? [] : [].concat(o.caption).map(String);
// every overlay's schedule in local frames (shared by cues, hero, validate and render)
function plan(s) {
  return [].concat(s.overlays || []).map((o, i) => {
    const kind = kindOf(o);
    if (!kind) throw new Error(`scene ${s.id}: overlay #${i + 1} needs one of ${KINDS.join(', ')} (got ${JSON.stringify(o)})`);
    const at = F.at(o.at, 0, `scene ${s.id} overlay #${i + 1} at`), until = o.until != null ? F.at(o.until, 0, 'until') : null;
    const p = { o, kind, i, n: i + 1, at, until };
    if (kind === 'bar') { Object.assign(p, typing(o, at)); p.settle = p.send + 4; p.heroAt = p.send + 16; }
    if (kind === 'bubble') p.settle = at + 14;
    if (kind === 'pill') p.settle = at + 16;
    if (kind === 'words') { p.words = [].concat(o.words || []).map(String); p.every = Number(o.every) || 9; p.wt = p.words.map((_, j) => at + j * p.every); p.settle = at + (p.words.length - 1) * p.every + 10; }
    if (kind === 'orb') {
      let t = at + 12; p.lines = captionLines(o).map(line => { const st = F.stream(line, t, Number(o.rate) || 6); t = st.end + 16; return st; });
      p.settle = p.lines.length ? p.lines[p.lines.length - 1].end + 8 : at + 20;
    }
    return p;
  });
}

const hasBg = s => s.bg != null && s.bg !== false && String(s.bg).trim() !== '' && String(s.bg).toLowerCase() !== 'none';
// every line a viewer reads, in overlay order (timeline: captions SRT, reading time, storyboard, review sheet)
const copyOf = s => [].concat(s.overlays || []).flatMap(o => {
  const k = kindOf(o);
  return k === 'bar' ? [o.bar] : k === 'bubble' ? [o.bubble] : k === 'words' ? [[].concat(o.words || []).join(' ')] : k === 'pill' ? [o.pill] : k === 'orb' ? captionLines(o) : [];
}).filter(x => x != null && String(x).trim() !== '').map(String);

export default {
  name: 'scene',
  doc: 'UI composited into footage: timed overlays pinned to the frame over the shot\'s bg (footage or an image, with optional cinema bars) — a prompt bar that types and sends (inline or a macro close-up that tracks the caret), a message bubble, floating kinetic words, a status pill with a mascot, a glowing voice orb with captions.',
  layers: 'one per overlay in order: bar-N · bubble-N · words-N · pill-N · orb-N (+ caption-N); the engine adds footage under them and letterbox on top',
  media: [],
  bgDefaults: { bgDim: .15, bgMove: 'in' },
  copy: copyOf,
  params: {
    bg: '(any shot) the footage or image behind the overlays (bgFrom, bgDim default .15, bgMove default in, letterbox); leave it off for overlays on the brand background (transparent with --clips --alpha)',
    overlays: 'list, each with at (local frame or "1.5s"), pos (top-left|top|top-right|left|center|right|bottom-left|bottom|bottom-right or [x, y] fractions), optional until, and ONE of: ' +
      'bar: "typed text" {theme: dark|light, framing: inline|macro (a close-up wider than the frame that follows the caret), chip: "model", tag: "Orbit", placeholder, speed, width} · bubble: "text" {time: "Today 9:41", from: "Maya", theme} · ' +
      'words: [a, b, c] {every: frames, size} · pill: "text" {mascot: N|logo|spark, theme} · orb: true {caption: "line" | [lines], size, color2}',
  },
  required: [],
  validate(s, D) {
    const w = [];
    let pl; try { pl = plan(s); } catch (e) { return [e.message]; }
    if (!pl.length && !hasBg(s)) w.push(`scene ${s.id}: no bg and no overlays — the shot would be empty`);
    for (const p of pl) {
      if (p.o.pos != null && !Array.isArray(p.o.pos) && !F.POS.includes(String(p.o.pos))) w.push(`scene ${s.id} overlay #${p.n}: pos "${p.o.pos}" is not one of ${F.POS.join(', ')} or [x, y]`);
      if (p.settle > D - 4) w.push(`scene ${s.id} overlay #${p.n} (${p.kind}) needs ${Math.ceil(p.settle + 4)} frames but the shot has ${D}; lengthen it, move \`at\` earlier or shorten the copy`);
    }
    return w;
  },
  cues(s, D) {
    const c = [];
    for (const p of plan(s)) {
      if (p.kind === 'bar') { p.times.forEach(t => c.push({ t, kind: 'tick', gain: .65 })); c.push({ t: p.send, kind: 'click' }); }
      if (p.kind === 'bubble') c.push({ t: p.at + 1, kind: 'pop', note: 84 });
      if (p.kind === 'pill') c.push({ t: p.at + 1, kind: 'pop', note: 79, gain: .8 });
      if (p.kind === 'words') p.wt.forEach((t, j) => c.push({ t: t + 1, kind: 'pop', note: [76, 79, 83, 86, 88, 91][j % 6], gain: .55 }));
      if (p.kind === 'orb') c.push({ t: p.at + 2, kind: 'chime' });
    }
    return c;
  },
  hero(s, D) { const pl = plan(s); return Math.max(8, Math.min(D - 9, Math.round(Math.max(D * .45, ...pl.filter(p => p.until == null || p.until > p.settle).map(p => p.heroAt ? (p.heroAt <= D - 9 ? p.heroAt : p.send - 1) : p.settle))))); },
  async build(ctx, s) {
    const { W, H, u, K, A, safe, C, portrait } = ctx, B = ctx.brand.colors;
    const pic = ctx.picture;                                    // inside the letterbox bars (the frame without them)
    const onPlate = ctx.dark;                                   // copy over footage is white (theme: light keeps it dark)
    const area = { x0: Math.max(safe.x0, pic.x0 + 40 * u), y0: Math.max(safe.y0, pic.y0 + 36 * u), x1: Math.min(safe.x1, pic.x1 - 40 * u), y1: Math.min(safe.y1, pic.y1 - 36 * u) };
    area.w = area.x1 - area.x0; area.h = area.y1 - area.y0;
    const items = [];
    for (const p of plan(s)) {
      const o = p.o, name = `${p.kind}-${p.n}`;
      if (p.kind === 'bar') {
        const dark = (o.theme || (onPlate ? 'dark' : 'light')) === 'dark', macro = o.framing === 'macro' && !dark;
        const narrow = W <= H;     // narrow frames: a macro without chip / mic
        let fs = (Number(o.size) || (macro ? (narrow ? 64 : 60) : dark ? (portrait ? 38 : 34) : 38)) * u;
        if (macro && !narrow) {   // the whole prompt + the send button must fit the frame once it glides to the end: shrink the macro if not
          const m = document.createElement('span'); m.style.cssText = `position:absolute;white-space:pre;font:500 100px ${ctx.font}`; m.textContent = p.chars.join(''); ctx.root.appendChild(m);
          const per = m.offsetWidth / 100; m.remove();
          fs = Math.min(fs, (W - 2 * Math.max(area.x0, 70 * u) - 12 * u) / (per + 9.6));
        }
        const bw = macro ? 0 : Math.min(area.w, (Number(o.width) || (dark ? (portrait ? 900 : 980) : 1240)) * u);
        const barHTML = fs => {
          const ink = dark ? '#FFFFFF' : B.ink, mute = dark ? 'rgba(255,255,255,.45)' : B.muted, line = dark ? 'rgba(255,255,255,.16)' : 'rgba(17,17,20,.12)';
          // macro framing crops the bar's chrome at the frame edge by design: its labels are chrome, not copy (no text box)
          const lab = macro ? 'sb-lab' : 'lv-txt';
          const plus = `<div style="width:${fs * 1.55}px;height:${fs * 1.55}px;border-radius:50%;box-shadow:inset 0 0 0 ${1.6 * u}px ${line};display:flex;align-items:center;justify-content:center;flex:none"><svg width="${fs * .7}" height="${fs * .7}" viewBox="0 0 20 20"><path d="M10 3v14M3 10h14" stroke="${mute}" stroke-width="2.2" stroke-linecap="round"/></svg></div>`;
          const mic = macro && narrow ? '' : `<svg width="${fs * .95}" height="${fs * .95}" viewBox="0 0 24 24" fill="none" stroke="${mute}" stroke-width="2" stroke-linecap="round" style="flex:none"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>`;
          const chip = o.chip && !(macro && narrow) ? `<div class="${lab}" style="position:relative;flex:none;padding:${fs * .22}px ${fs * .55}px;border-radius:99px;background:${dark ? 'rgba(255,255,255,.09)' : '#F1F2F5'};color:${dark ? 'rgba(255,255,255,.78)' : '#55555E'};font-size:${fs * .68}px;font-weight:600;white-space:nowrap">${A.esc(o.chip)}</div>` : '';
          const send = `<div class="sb-send" style="position:relative;width:${fs * 1.75}px;height:${fs * 1.75}px;border-radius:50%;background:${dark ? 'rgba(255,255,255,.14)' : B.ink};display:flex;align-items:center;justify-content:center;flex:none">
              <div class="sb-ring" style="position:absolute;inset:0;border-radius:50%;box-shadow:0 0 0 ${3 * u}px ${B.accent};opacity:0"></div>
              <svg width="${fs * .85}" height="${fs * .85}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></div>`;
          const tag = o.tag ? `<div class="${lab}" style="position:relative;flex:none;display:flex;align-items:center;gap:${fs * .3}px;padding:${fs * .2}px ${fs * .5}px ${fs * .2}px ${fs * .22}px;border-radius:${fs * .4}px;background:${A.hexA(B.accent, .1)};color:${B.accent};font-weight:600;font-size:${fs * .8}px;white-space:nowrap">${ctx.logo(fs * 1.05)}${A.esc(o.tag)}</div>` : '';
          const textRow = `<div class="sb-tx" style="position:relative;${macro ? 'flex:none' : 'flex:1;min-width:0'};overflow:hidden;${dark ? `min-height:${fs * 2.7}px` : 'white-space:nowrap'}">
              <div class="sb-in" style="position:relative;display:inline-block;${dark ? 'white-space:pre-wrap;word-break:break-word;width:100%' : 'white-space:pre'}"><span class="lv-txt sb-type" style="position:relative;color:${ink};font-weight:500"></span><span class="sb-caret" style="display:inline-block;width:${Math.max(2.5 * u, fs * .07)}px;height:${fs * 1.12}px;vertical-align:${-fs * .2}px;margin-left:${2 * u}px;background:${dark ? '#fff' : B.accent};border-radius:2px"></span><span class="lv-txt sb-ph" style="position:relative;color:${mute}">${A.esc(o.placeholder || 'Ask anything…')}</span></div></div>`;
          return dark
            ? `<div class="lv-ui sb" style="position:relative;display:flex;flex-direction:column;gap:${fs * .5}px;padding:${fs * .8}px ${fs * .75}px ${fs * .6}px ${fs * .95}px;border-radius:${fs * 1.05}px;background:rgba(16,16,20,.86);
                box-shadow:0 0 ${54 * u}px ${A.hexA(B.accent, .34)},${18 * u}px ${16 * u}px ${60 * u}px ${A.hexA(B.accent2 || B.accent, .22)},0 ${24 * u}px ${70 * u}px rgba(0,0,0,.45);font-family:${ctx.font};font-size:${fs}px;line-height:1.35">
                <svg class="sb-edge" style="position:absolute;left:0;top:0;overflow:visible;pointer-events:none"></svg>
                <div style="display:flex">${textRow}</div><div style="display:flex;align-items:center;gap:${fs * .45}px">${plus}<div style="flex:1"></div>${chip}${mic}${send}</div></div>`
            : `<div class="lv-ui sb" style="position:relative;display:flex;align-items:center;gap:${fs * .5}px;height:${fs * 2.9}px;padding:0 ${fs * .55}px 0 ${fs * .5}px;border-radius:99px;background:#fff;${macro ? 'width:max-content;' : ''}
                box-shadow:0 0 0 ${1.5 * u}px rgba(17,17,20,.07),0 ${20 * u}px ${60 * u}px rgba(20,24,40,.14),0 ${4 * u}px ${12 * u}px rgba(20,24,40,.05);font-family:${ctx.font};font-size:${fs}px">
                ${plus}${tag}${textRow}${chip}${mic}${send}</div>`;
        };
        let html = barHTML(fs);
        if (macro) {   // a bar that nearly fits (always on narrow frames) is fitted whole and centred: it crops neither end
          const probe = ctx.el(html, 'left:0;top:0;visibility:hidden'), pb = probe.querySelector('.sb'), tx = probe.querySelector('.sb-type');
          tx.textContent = p.chars.join(''); probe.querySelector('.sb-ph').style.display = 'none';
          const k = Math.min(1, (W - 2 * Math.max(area.x0, 70 * u)) / pb.offsetWidth); probe.remove();
          if (k < 1 && (narrow || k > .8)) { fs *= k * .985; html = barHTML(fs); }
        }
        const el = ctx.el(html, `left:0;top:0;${macro ? '' : `width:${bw}px`}`, name);
        const sb = el.querySelector('.sb'), typeEl = el.querySelector('.sb-type'), box = el.querySelector('.sb-tx'), inner = el.querySelector('.sb-in');
        // macro: the text box holds the whole prompt; prefix widths give a smooth caret position for the follow move
        let widths = null;
        if (macro) {
          widths = p.chars.map((_, n) => { typeEl.textContent = p.chars.slice(0, n).join(''); return typeEl.offsetWidth; });
          typeEl.textContent = p.chars.join(''); widths.push(typeEl.offsetWidth);
          box.style.width = (widths[widths.length - 1] + fs * .4) + 'px'; typeEl.textContent = '';
        }
        const at = F.place(ctx, o.pos || (macro ? 'center' : 'bottom'), macro ? Math.min(sb.offsetWidth, area.w) : bw, el.offsetHeight, area);
        el.style.left = (macro ? 0 : at.x) + 'px'; el.style.top = at.y + 'px';
        const edge = el.querySelector('.sb-edge');
        if (edge) {     // a gradient hairline round the dark composer (accent → accent2), like a lit glass edge
          const w = sb.offsetWidth, h = sb.offsetHeight, rr = fs * 1.05, gid = `sbg-${s.id}-${p.n}`;
          edge.setAttribute('width', w); edge.setAttribute('height', h);
          edge.innerHTML = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${A.hexA(B.accentOnDark || B.accent, .45)}"/><stop offset=".6" stop-color="${A.hexA(B.accent, .9)}"/><stop offset="1" stop-color="${B.accent2 || B.accent}"/></linearGradient></defs>
            <rect x="${.75 * u}" y="${.75 * u}" width="${w - 1.5 * u}" height="${h - 1.5 * u}" rx="${rr}" fill="none" stroke="url(#${gid})" stroke-width="${1.6 * u}"/>`;
        }
        const it = { p, el, sb, typeEl, ph: el.querySelector('.sb-ph'), caret: el.querySelector('.sb-caret'), inner, box, sendEl: el.querySelector('.sb-send'), ring: el.querySelector('.sb-ring'), dark, macro, widths };
        if (macro) {   // the follow move: keep the caret at ~62 % of the frame, then glide to show the send button
          const bwm = sb.offsetWidth, txL = box.offsetLeft, margin = Math.max(area.x0, 70 * u);
          it.fits = bwm <= W - 2 * margin;
          it.xStart = it.fits ? W / 2 - bwm / 2 : margin;
          it.xEnd = it.fits ? it.xStart : W - margin - bwm;
          it.caretX = t => { const ts = p.times; let k = 0; while (k < ts.length && ts[k] <= t) k++; const f = k < ts.length ? K.clamp((t - (k ? ts[k - 1] : p.at + 9)) / Math.max(1, ts[k] - (k ? ts[k - 1] : p.at + 9))) : 0; return txL + K.lerp(widths[k], widths[Math.min(widths.length - 1, k + 1)], k < ts.length ? K.outCubic(f) : 0); };
          it.xAt = t => {
            if (it.fits) return it.xStart - 18 * u * K.ioCubic(K.u01(t, p.at, p.send + 12));
            const follow = Math.max(it.xEnd, Math.min(it.xStart, W * .62 - it.caretX(t))), last = p.times.length ? p.times[p.times.length - 1] : p.at;
            return K.lerp(follow, it.xEnd, K.ioCubic(K.u01(t, last, p.send - 1)));       // never past the end position: the whole prompt + send show at the end
          };
        }
        items.push(it);
      }
      if (p.kind === 'bubble') {
        const fs = (portrait ? 40 : 34) * u, mw = Math.min(area.w * .86, 640 * u), dark = o.theme === 'dark';
        const meta = c => `color:${onPlate ? 'rgba(255,255,255,.8)' : B.muted};font-size:${fs * .58}px;font-weight:600;letter-spacing:.01em;${onPlate ? 'text-shadow:0 1px 6px rgba(0,0,0,.45);' : ''}${c}`;
        const el = ctx.el(`<div class="lv-ui" style="font-family:${ctx.font};display:flex;flex-direction:column;align-items:flex-start;gap:${fs * .3}px">
            <div class="lv-txt sbb-t" style="position:relative;align-self:center;${meta('')}">${A.esc(o.time || 'Today 9:41')}</div>
            <div class="sbb" style="position:relative;max-width:${mw}px;padding:${fs * .62}px ${fs * .85}px;border-radius:${fs * .95}px ${fs * .95}px ${fs * .95}px ${fs * .28}px;background:${dark ? 'rgba(22,22,28,.9)' : '#FFFFFF'};
              box-shadow:0 ${14 * u}px ${44 * u}px rgba(0,0,0,.28),0 0 0 1px rgba(17,17,20,.05);transform-origin:0 100%">
              <div class="lv-txt sbb-x" style="position:relative;color:${dark ? '#fff' : B.ink};font-size:${fs}px;font-weight:500;line-height:1.3">${A.esc(o.bubble)}</div></div>
            ${o.from ? `<div class="lv-txt sbb-f" style="position:relative;align-self:flex-end;${meta('')}">${A.esc(o.from)}</div>` : ''}</div>`, 'left:0;top:0', name);
        const at = F.place(ctx, o.pos || 'left', el.offsetWidth, el.offsetHeight, area);
        el.style.left = at.x + 'px'; el.style.top = at.y + 'px';
        items.push({ p, el, b: el.querySelector('.sbb'), x: el.querySelector('.sbb-x'), meta: [...el.querySelectorAll('.sbb-t,.sbb-f')] });
      }
      if (p.kind === 'words') {
        const fs = (Number(o.size) || (portrait ? 80 : 88)) * u, wrap = ctx.el('', 'left:0;top:0;width:0;height:0', name);
        const box = F.place(ctx, o.pos || 'center', 0, 0, area), r = F.rng(F.hash(s.id + ':' + p.n));
        const R = Math.min(area.w, area.h) * .3, ga = 2.39996;
        const placed = [], hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        const els = p.words.map((w, j) => {
          const e = ctx.text(w, { size: fs / u, weight: 600, nowrap: true, ls: '-.025em', color: onPlate ? '#FFFFFF' : B.ink, accent: onPlate ? (B.accentOnDark || B.accent) : B.accent, parent: wrap, style: onPlate ? 'text-shadow:0 3px 26px rgba(0,0,0,.35);' : '' });
          // golden-angle scatter round the anchor; a word never lands on the two before it (they are still fading out)
          let ang = j * ga + r() * .6 - .3 + 1.1, rad = (j === 0 ? .2 : .5 + .5 * r()) * R, x, y;
          for (let tries = 0; tries < 14; tries++) {
            x = box.x + Math.cos(ang) * rad * (portrait ? 1 : 1.5) - e.offsetWidth / 2; y = box.y + Math.sin(ang) * rad - e.offsetHeight / 2;
            x = Math.max(area.x0, Math.min(area.x1 - e.offsetWidth, x)); y = Math.max(area.y0, Math.min(area.y1 - e.offsetHeight, y));
            const me = { x: x - fs * .2, y: y - fs * .15, w: e.offsetWidth + fs * .4, h: e.offsetHeight + fs * .3 };
            if (!placed.slice(-2).some(b => hit(me, b))) break;
            ang += .9; rad = Math.min(R * 1.25, rad + R * .12);
          }
          placed.push({ x, y, w: e.offsetWidth, h: e.offsetHeight });
          e.style.left = x + 'px'; e.style.top = y + 'px'; e.style.transformOrigin = '50% 60%';
          return { e, ang, depth: .8 + r() * .5 };
        });
        items.push({ p, el: wrap, els });
      }
      if (p.kind === 'pill') {
        const fs = (portrait ? 34 : 30) * u, el = ctx.el(F.pill(ctx, o.pill, o.mascot ?? 0, fs, o.theme === 'dark'), 'left:0;top:0', name);
        const at = F.place(ctx, o.pos || 'bottom-left', el.offsetWidth, el.offsetHeight, area);
        el.style.left = at.x + 'px'; el.style.top = at.y + 'px';
        items.push({ p, el, m: fs * 2.6 });     // m = the pill's mascot size (F.pill)
      }
      if (p.kind === 'orb') {
        const os = (Number(o.size) || 160) * u, fs = 44 * u, lines = p.lines, cw = Math.min(area.w, 1000 * u), acc = B.accent, acc2 = o.color2 || '#3C6BFF';
        const orb = ctx.el(`<div class="so-halo" style="position:absolute;left:${-os}px;top:${-os}px;width:${os * 3}px;height:${os * 3}px;border-radius:50%;background:radial-gradient(circle,${A.hexA(acc, .75)} 0%,${A.hexA(acc, .34)} 30%,${A.hexA(acc2, .12)} 50%,${A.hexA(acc2, 0)} 68%)"></div>
          <div class="so-ball" style="position:absolute;left:0;top:0;width:${os}px;height:${os}px;border-radius:50%;
            background:radial-gradient(circle at 34% 30%,${A.shade(acc, .7)} 0%,${A.shade(acc, .28)} 26%,${acc} 50%,${A.shade(acc2, -.25)} 86%);
            box-shadow:0 0 ${os * .4}px ${A.hexA(acc, .95)},0 0 ${os * .9}px ${A.hexA(acc2, .45)},inset ${-os * .08}px ${-os * .1}px ${os * .2}px rgba(0,0,0,.28),inset ${os * .06}px ${os * .07}px ${os * .18}px rgba(255,255,255,.4)">
            <svg width="${os}" height="${os}" viewBox="0 0 100 100" style="position:absolute;left:0;top:0;overflow:visible"><path class="so-w" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`,
          `left:0;top:0;width:${os}px;height:${os}px`, name);
        const capWrap = lines.length ? ctx.el('', 'left:0;top:0;width:0;height:0', `caption-${p.n}`) : null;
        const caps = lines.map(st => ctx.text(st.words.join(' '), { size: fs / u, weight: 600, align: 'center', maxW: cw, lines: 2, color: onPlate ? '#FFFFFF' : B.ink, accent: onPlate ? (B.accentOnDark || B.accent) : B.accent, parent: capWrap, style: onPlate ? 'text-shadow:0 2px 16px rgba(0,0,0,.4);' : '' }));
        const lineH = fs * 1.1, gap = 34 * u + lineH, capH = caps.reduce((a, e) => Math.max(a, e.offsetHeight), 0), gh = os + (caps.length ? gap + capH : 0);
        const at = F.place(ctx, o.pos || 'center', Math.max(os, cw), gh, area), cx = at.x + Math.max(os, cw) / 2;
        orb.style.left = (cx - os / 2) + 'px'; orb.style.top = at.y + 'px';
        caps.forEach(e => { e.style.left = (cx - cw / 2) + 'px'; e.style.width = cw + 'px'; e.style.top = (at.y + os + gap) + 'px'; e.style.transformOrigin = '50% 100%'; });
        items.push({ p, el: orb, ball: orb.querySelector('.so-ball'), halo: orb.querySelector('.so-halo'), wave: orb.querySelector('.so-w'), caps, os, capH, lineH });
      }
    }
    await Promise.all([...ctx.root.querySelectorAll('img')].map(i => i.decode().catch(() => null)));
    // `until`: each painted part fades itself (never a wrapper around transformed children: GUIDE compositing trap)
    const fade = (p, t) => p.until == null ? 1 : 1 - K.u01(t, p.until - 6, p.until);
    const tf = (v, rest) => v === rest ? 'none' : v;       // identity transforms are written as none
    return {
      async render(t, D) {
        for (const it of items) {
          const { p } = it, out = fade(p, t), a0 = p.at - 3;      // entrances lead by 3 frames: an overlay at 0 is on screen in frame 0
          if (p.kind === 'bar') {
            const k = K.outExpo(K.u01(t, a0, a0 + 12)), bob = 3 * u * Math.sin(t * .09);
            it.sb.style.opacity = (K.clamp(K.u01(t, a0, a0 + 5)) * out).toFixed(3);
            it.sb.style.transform = k < .999 ? `translateY(${((1 - k) * 46 * u + bob).toFixed(2)}px) scale(${K.lerp(.96, 1, k).toFixed(4)})` : `translateY(${bob.toFixed(2)}px)`;
            if (it.macro) it.el.style.left = it.xAt(t).toFixed(2) + 'px';
            const n = p.times.filter(x => x <= t).length;
            it.typeEl.textContent = p.chars.slice(0, n).join(''); it.ph.style.display = n ? 'none' : 'inline';
            it.caret.style.opacity = t >= p.send + 2 ? 0 : (.55 + .45 * Math.cos(t * .42)).toFixed(3);
            if (!it.dark && !it.macro) { const over = Math.max(0, it.inner.offsetWidth - it.box.clientWidth + 6 * u); it.inner.style.transform = over > 0 ? `translateX(${(-over).toFixed(2)}px)` : 'none'; }
            const press = Math.sin(Math.PI * K.u01(t, p.send - 2, p.send + 4));
            it.sendEl.style.transform = press > 0 ? `scale(${(1 - .14 * press).toFixed(4)})` : 'none';
            it.sendEl.style.background = t >= p.send ? B.accent : it.dark ? 'rgba(255,255,255,.14)' : B.ink;   // the brand accent: a dark shot's lifted accent is too pale under the white arrow
            const rg = K.u01(t, p.send, p.send + 14), ringOn = rg > 0 && rg < 1;
            it.ring.style.opacity = ringOn ? (1 - rg).toFixed(3) : 0;
            it.ring.style.transform = ringOn ? `scale(${(1 + 1.3 * K.outCubic(rg)).toFixed(4)})` : 'none';
          }
          if (p.kind === 'bubble') {
            const k = K.outBack(K.u01(t, a0, a0 + 10), 1.4), e = K.clamp(K.u01(t, a0, a0 + 3));
            it.b.style.opacity = (e * out).toFixed(3);
            it.b.style.transform = `translateY(${(4 * u * Math.sin(t * .08)).toFixed(2)}px) scale(${K.lerp(.4, 1, K.clamp(k, 0, 1.08)).toFixed(4)})`;
            it.x.style.opacity = K.clamp(K.u01(t, a0 + 3, a0 + 8)).toFixed(3);
            for (const m of it.meta) m.style.opacity = (K.clamp(K.u01(t, a0 + 6, a0 + 12)) * out).toFixed(3);
          }
          if (p.kind === 'words') {
            const n = p.words.length;
            it.els.forEach(({ e, ang, depth }, j) => {
              const t0 = p.wt[j], a = t - t0, k = K.outExpo(K.u01(t, t0, t0 + 8));
              const dim = j < n - 1 ? K.outCubic(K.u01(t, p.wt[j + 1], p.wt[j + 1] + 6)) : 0, gone = j < n - 1 ? K.u01(t, p.wt[j + 1] + 4, p.wt[j + 1] + 4 + p.every) : 0;
              const op = a < 0 ? 0 : K.clamp(K.u01(t, t0, t0 + 4)) * (1 - .6 * dim) * (1 - gone) * out;
              const drift = Math.max(0, a) * .7 * u * depth;
              e.style.opacity = op.toFixed(3);
              e.style.filter = a < 0 || op <= 0 ? 'none' : F.filt(F.blur((1 - k) * 12 * u + dim * 5 * u));
              e.style.transform = a < 0 ? 'none' : `translate(${(Math.cos(ang) * drift).toFixed(2)}px,${(Math.sin(ang) * drift * .6 - drift * .3).toFixed(2)}px) scale(${((1.4 - .4 * k) * (1 - .1 * dim) * (1 + .0018 * Math.max(0, a) * depth)).toFixed(4)})`;
            });
          }
          if (p.kind === 'pill') {
            it.el.style.transform = `translateY(${(4 * u * Math.sin(t * .1 + 1)).toFixed(2)}px)`;
            F.pillAt(K, it.el, it.m, t, a0, out);
          }
          if (p.kind === 'orb') {
            const k = K.outBack(K.u01(t, a0, a0 + 12), 1.3), e = K.clamp(K.u01(t, a0, a0 + 4));
            const env = .3 + .7 * Math.abs(Math.sin(t * .13) * Math.sin(t * .29 + 1.3)) * K.u01(t, p.at + 6, p.at + 14);
            it.ball.style.opacity = (e * out).toFixed(3);
            it.ball.style.transform = `translateY(${(5 * u * Math.sin(t * .07)).toFixed(2)}px) scale(${(K.lerp(.3, 1, K.clamp(k, 0, 1.1)) * (1 + .045 * env)).toFixed(4)})`;
            it.halo.style.opacity = (e * out * (.55 + .45 * env)).toFixed(3);
            it.halo.style.transform = `translateY(${(5 * u * Math.sin(t * .07)).toFixed(2)}px) scale(${(K.lerp(.4, 1, K.clamp(k, 0, 1.1)) * (.92 + .16 * env)).toFixed(4)})`;
            const pts = []; for (let i = 0; i <= 24; i++) { const x = 22 + i * 56 / 24, wnd = Math.sin(Math.PI * i / 24); pts.push(`${x.toFixed(2)} ${(50 + Math.sin(i * .62 + t * .55) * 17 * env * wnd * wnd).toFixed(2)}`); }
            it.wave.setAttribute('d', 'M' + pts.join('L'));
            it.caps.forEach((c, j) => {
              const st = p.lines[j], next = p.lines[j + 1], ws = c.querySelectorAll('.lv-w');
              ws.forEach((w, q) => { const a = t - st.times[q]; w.style.opacity = a < 0 ? 0 : K.clamp(.15 + a / 6).toFixed(3); });
              const up = next ? K.outCubic(K.u01(t, next.times[0] - 2, next.times[0] + 8)) : 0, gone = p.lines[j + 2] ? K.u01(t, p.lines[j + 2].times[0], p.lines[j + 2].times[0] + 8) : 0;
              c.style.opacity = ((1 - .7 * up) * (1 - gone) * out).toFixed(3);
              c.style.transform = `translateY(${(-up * (it.lineH + 14 * u) + 2 * u * Math.sin(t * .07)).toFixed(2)}px) scale(${(1 - .2 * up).toFixed(4)})`;
            });
          }
        }
      },
    };
  },
};
