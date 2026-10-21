// UI mini-language shared by the phone / browser / panel / prompt blocks.
// beats.yaml lists items; schedule() (isomorphic) decides when each appears, cues() turns that into SFX, and
// mountUI() (browser) draws and animates them inside a device screen or a floating panel.
//
//   items:
//     - header: {title: Bea, sub: Your dinner agent, avatar: 3}     # avatar = cast index, or "logo"
//     - msg: Found a table for 2 at 7:30.                           # from: agent (default) | user
//     - typing: 16                                                  # agent typing dots for N frames
//     - input: Book dinner for Friday                               # typed into an input bar, then sent
//     - card: {title: Approve payment?, sub: Card ending 4021, value: $40.00, icon: $, actions: [Decline, Approve]}
//     - tap: Approve                                                # finger tap (phone) or cursor click (browser/panel)
//     - toast: Booked. Deposit paid.                                # success banner
//     - row: {title: Morning run, sub: 6:30 AM, icon: bolt, check: true}
//     - steps: [Searching flights, Comparing prices, Booking]       # agent progress: spinner → check, one by one
//     - notif: {app: Steady, title: 7-day streak!, body: Keep it going}
//     - image: assets/screens/home.png                              # a real screenshot (scroll: 400 to pan it)
//     - chips: [Today, This week, Custom]
//     - space: 24
//   Any item can take at: <local frame> to pin its start; otherwise items follow each other.
import * as K from './kit.js';
import * as A from './art.js';

export const ITEM_TYPES = ['header', 'msg', 'typing', 'input', 'card', 'tap', 'toast', 'row', 'steps', 'notif', 'image', 'chips', 'space'];

export function normItems(items = []) {
  return (items || []).map((it, i) => {
    if (typeof it === 'string') return { type: 'msg', text: it, from: 'agent', i };
    const type = ITEM_TYPES.find(k => Object.prototype.hasOwnProperty.call(it, k));
    if (!type) throw new Error(`unknown UI item #${i + 1}: ${JSON.stringify(it)} (use one of ${ITEM_TYPES.join(', ')})`);
    const v = it[type], base = { ...it, type, i };
    delete base[type];
    if (it.at != null) {                                     // at: 45 (local 30-fps frames) or at: 1.5s
      const m = String(it.at).trim().match(/^(\d+(?:\.\d+)?)\s*(s|sec)?$/);
      if (!m) throw new Error(`UI item #${i + 1}: at must be a frame number (30 per second) or seconds like 1.5s (got ${JSON.stringify(it.at)})`);
      base.at = m[2] ? Number(m[1]) * 30 : Number(m[1]);
    }
    if (['msg', 'input', 'toast', 'tap'].includes(type) && (v == null || typeof v === 'object'))
      throw new Error(`UI item #${i + 1}: \`${type}\` needs text (got ${JSON.stringify(v)}) — e.g. "- ${type}: Hello"${type === 'msg' ? ', with "from: user" as a sibling key' : ''}`);
    if (type === 'msg') return { ...base, text: String(v), from: it.from || 'agent' };
    if (['input', 'toast', 'tap'].includes(type)) return { ...base, text: String(v) };
    if (type === 'steps') return { ...base, steps: [].concat(v).map(String) };
    if (type === 'chips') return { ...base, chips: [].concat(v).map(String) };
    if (type === 'image') return { ...base, src: String(v) };
    if (type === 'space') return { ...base, size: Number(v) || 16 };
    if (type === 'typing') return { ...base, dur: v === true ? 18 : Number(v) || 18 };
    const obj = { ...base, ...(v && typeof v === 'object' ? v : { title: String(v) }) };      // header, card, row, notif
    if (type === 'card') obj.actions = [].concat(obj.actions || []).map(String);
    return obj;
  });
}

const BASE = { header: 3, msg: 11, typing: 18, card: 13, tap: 14, toast: 10, row: 6, notif: 10, image: 12, chips: 8, space: 0 };
const natural = it => it.type === 'input' ? Array.from(it.text).length + 12 : it.type === 'steps' ? it.steps.length * (it.per || 15) + 4 : it.type === 'typing' ? it.dur : BASE[it.type];
// returns [{it, t0, t1}] in local frames; compresses evenly when the list doesn't fit in ~85 % of the shot
export function schedule(items, D, start = 8) {
  const list = normItems(items);
  const need = list.reduce((a, it) => a + (it.at != null ? 0 : natural(it)), 0);
  const budget = Math.max(1, D * .85 - start);
  const k = need > budget ? budget / need : 1;
  let t = start;
  return list.map(it => {
    if (it.at != null) t = Number(it.at);
    const L = natural(it) * k;
    const r = { it, t0: t, t1: t + L };
    t += L;
    return r;
  });
}
export function overBudget(items, D, start = 8) {
  const list = normItems(items), need = list.reduce((a, it) => a + (it.at != null ? 0 : natural(it)), 0);
  return need > D * .85 - start ? need / (D * .85 - start) : 0;
}
// typing: chars appear evenly over [t0, t1 - 8]; send at t1 - 5
export const typeTimes = (r) => { const n = Array.from(r.it.text).length, span = Math.max(1, r.t1 - 8 - r.t0); return Array.from({ length: n }, (_, i) => r.t0 + span * (i + 1) / n); };
export const stepTimes = (r) => { const n = r.it.steps.length, per = (r.t1 - 4 - r.t0) / n; return r.it.steps.map((_, i) => ({ start: r.t0 + i * per, done: r.t0 + (i + 1) * per })); };
const TAP_AT = r => r.t0 + (r.t1 - r.t0) * .62;
// a row's check lands 10 frames after the row appears (rows arrive ~6 frames apart, so a check never collides with the next row's pop)
const CHECK_AT = r => r.t0 + 10;

export function uiCues(items, D, start) {
  const cues = [];
  for (const r of schedule(items, D, start)) {
    const { it } = r;
    if (it.type === 'msg') cues.push({ t: r.t0, kind: 'pop', note: it.from === 'user' ? 84 : 79, gain: .8 });
    else if (it.type === 'card' || it.type === 'image') cues.push({ t: r.t0, kind: 'pop', note: 76 });
    else if (it.type === 'notif') cues.push({ t: r.t0, kind: 'pop', note: 88 });
    else if (it.type === 'row') { cues.push({ t: r.t0, kind: 'pop', note: 81, gain: .6 }); if (it.check) cues.push({ t: CHECK_AT(r), kind: 'pop', note: 93, gain: .9 }); }   // a bright 'done' blip, audible over the next row's pop
    else if (it.type === 'chips') cues.push({ t: r.t0, kind: 'pop', note: 86, gain: .6 });
    else if (it.type === 'toast') cues.push({ t: r.t0, kind: 'chime' });
    else if (it.type === 'tap') cues.push({ t: TAP_AT(r), kind: 'click' });
    else if (it.type === 'input') { typeTimes(r).forEach(t => cues.push({ t, kind: 'tick', gain: .7 })); cues.push({ t: r.t1 - 5, kind: 'click' }); }
    else if (it.type === 'steps') stepTimes(r).forEach(s => cues.push({ t: s.done, kind: 'tick', gain: 1.3 }));
  }
  return cues;
}

// ── browser side ──
const ICON_GLYPH = v => A.ICON_NAMES.includes(v) ? null : String(v || '').slice(0, 2);
const isPath = v => /[./]/.test(String(v || '')) && v !== 'logo';
// an icon field: a built-in icon name, an asset path (your own icon), or 1–2 characters
const iconHTML = (ctx, v, col, size) => isPath(v) ? `<img src="${ctx.asset(v)}" style="width:${size}px;height:${size}px;object-fit:contain;display:block">` : A.ICON_NAMES.includes(v) ? A.icon(v, col, size) : null;
export function mountUI(ctx, screen, items, o = {}) {
  const { K: k } = ctx, C = ctx.brand.colors;     // UI mocks are light surfaces even in a dark shot: always the light palette
  const sw = o.width, fs = o.fontSize || sw * .052, pad = o.pad ?? sw * .06, topPad = o.top ?? sw * .14, accent = C.accent;
  const sched = schedule(items, ctx.D, o.start ?? 8);
  const flow = document.createElement('div');
  flow.style.cssText = `position:absolute;left:${pad}px;right:${pad}px;top:${topPad}px;display:flex;flex-direction:column;gap:${fs * .7}px;font-family:${ctx.font};font-size:${fs}px;color:${o.ink || C.ink}`;
  flow.className = 'lv-ui';
  screen.appendChild(flow);
  const rad = fs * 1.05, cardBg = o.cardBg || C.card || '#fff', soft = o.soft || '#F1F2F5', muted = o.muted || '#8A8A92';
  const nodes = sched.map(r => {
    const it = r.it, d = document.createElement('div');
    // no will-change: it made Chrome draw the device as a separately composited (resampled, sometimes cropped) bitmap
    // only while items were visible, so the device looked different alone than in the full frame (--layers QA)
    d.style.cssText = 'position:relative;opacity:0';
    const txt = (s, st = '') => `<span class="lv-txt" style="position:relative;${st}">${A.esc(s)}</span>`;
    if (it.type === 'header') {
      const av = it.avatar === 'logo' ? ctx.logo(fs * 2.4) : it.avatar != null ? A.bud(ctx.cast(Number(it.avatar)), fs * 2.4, 'smile') : '';
      d.innerHTML = `<div style="display:flex;align-items:center;gap:${fs * .6}px">${av}<div><div style="font-weight:700;font-size:${fs * 1.25}px">${txt(it.title || '')}</div>${it.sub ? `<div style="color:${muted};font-size:${fs * .86}px">${txt(it.sub)}</div>` : ''}</div></div>`;
    } else if (it.type === 'msg') {
      const user = it.from === 'user';
      d.style.alignSelf = user ? 'flex-end' : 'flex-start'; d.style.maxWidth = '82%';
      d.innerHTML = `<div style="padding:${fs * .75}px ${fs * .9}px;border-radius:${rad}px ${rad}px ${user ? fs * .3 : rad}px ${user ? rad : fs * .3}px;background:${user ? accent : soft};color:${user ? '#fff' : 'inherit'};font-weight:500;line-height:1.36">${txt(it.text)}</div>`;
    } else if (it.type === 'typing') {
      d.style.alignSelf = 'flex-start';
      d.innerHTML = `<div style="padding:${fs * .8}px ${fs}px;border-radius:${rad}px;background:${soft};display:flex;gap:${fs * .35}px">${[0, 1, 2].map(() => `<i class="lv-dot" style="width:${fs * .45}px;height:${fs * .45}px;border-radius:50%;background:${muted}"></i>`).join('')}</div>`;
    } else if (it.type === 'input') {
      d.innerHTML = `<div style="display:flex;align-items:center;gap:${fs * .5}px;padding:${fs * .55}px ${fs * .55}px ${fs * .55}px ${fs}px;border-radius:${fs * 1.6}px;background:${cardBg};box-shadow:0 0 0 1.5px rgba(17,17,20,.10),0 ${fs * .4}px ${fs * 1.2}px rgba(20,24,40,.08)">
        <div style="flex:1;min-height:${fs * 1.4}px;font-weight:500;white-space:pre-wrap;word-break:break-word"><span class="lv-type lv-txt" style="position:relative"></span><span class="lv-caret" style="display:inline-block;width:${Math.max(2, fs * .1)}px;height:${fs * 1.15}px;vertical-align:${-fs * .2}px;background:${accent};margin-left:2px"></span><span class="lv-ph" style="color:${muted}">${A.esc(it.placeholder || 'Ask anything…')}</span></div>
        <div class="lv-send" style="width:${fs * 2}px;height:${fs * 2}px;border-radius:50%;background:${accent};display:flex;align-items:center;justify-content:center;flex:none">
          <svg width="${fs}" height="${fs}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></div></div>`;
    } else if (it.type === 'card') {
      const ic = it.icon ? `<div style="width:${fs * 2.3}px;height:${fs * 2.3}px;border-radius:${fs * .6}px;background:${A.hexA(accent, .12)};display:flex;align-items:center;justify-content:center;font-weight:700;color:${accent};flex:none">${iconHTML(ctx, it.icon, accent, fs * 1.3) ?? A.esc(ICON_GLYPH(it.icon))}</div>` : '';
      const acts = (it.actions || []).map((a, j, all) => `<div class="lv-act" data-label="${A.esc(a)}" style="position:relative;flex:1;height:${fs * 2.5}px;border-radius:${fs * .7}px;display:flex;align-items:center;justify-content:center;font-weight:600;${j === all.length - 1 ? `background:${o.ink || C.ink};color:${cardBg}` : `background:${soft}`}">${txt(a)}</div>`).join('');
      d.innerHTML = `<div style="border-radius:${fs * 1.1}px;background:${cardBg};box-shadow:0 ${fs * .6}px ${fs * 1.8}px rgba(20,24,40,.13),0 0 0 1px rgba(17,17,20,.06);padding:${fs}px">
        <div style="display:flex;align-items:center;gap:${fs * .6}px">${ic}<div style="min-width:0"><div style="font-weight:700">${txt(it.title || '')}</div>${it.sub ? `<div style="color:${muted};font-size:${fs * .82}px">${txt(it.sub)}</div>` : ''}</div>${it.value ? `<div style="margin-left:auto;font-weight:700;font-size:${fs * 1.25}px">${txt(it.value)}</div>` : ''}</div>
        ${acts ? `<div style="display:flex;gap:${fs * .5}px;margin-top:${fs * .9}px">${acts}</div>` : ''}</div>`;
    } else if (it.type === 'toast') {
      d.innerHTML = `<div style="padding:${fs * .7}px ${fs * .85}px;border-radius:${fs * .8}px;background:#E9FBF3;color:#0E8A5F;font-weight:600;display:flex;gap:${fs * .45}px;align-items:center">
        <svg width="${fs * 1.15}" height="${fs * 1.15}" viewBox="0 0 26 26" style="flex:none"><circle cx="13" cy="13" r="12" fill="#18B87A"/><path d="M7.5 13.5l4 4 7-8" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>${txt(it.text)}</div>`;
    } else if (it.type === 'row') {
      const ic = it.icon ? `<div style="width:${fs * 2}px;height:${fs * 2}px;border-radius:${fs * .55}px;background:${A.hexA(accent, .12)};display:flex;align-items:center;justify-content:center;flex:none">${iconHTML(ctx, it.icon, accent, fs * 1.1) ?? A.icon('sparkle', accent, fs * 1.1)}</div>` : '';
      d.innerHTML = `<div style="display:flex;align-items:center;gap:${fs * .6}px;padding:${fs * .7}px ${fs * .8}px;border-radius:${fs * .9}px;background:${cardBg};box-shadow:0 0 0 1px rgba(17,17,20,.07)">${ic}
        <div style="min-width:0;flex:1"><div style="font-weight:600">${txt(it.title || '')}</div>${it.sub ? `<div style="color:${muted};font-size:${fs * .8}px">${txt(it.sub)}</div>` : ''}</div>
        ${it.value ? `<div style="font-weight:700">${txt(it.value)}</div>` : ''}
        ${it.check != null ? `<div class="lv-check" style="width:${fs * 1.5}px;height:${fs * 1.5}px;border-radius:50%;border:${Math.max(2, fs * .1)}px solid #C9CDD6;box-sizing:border-box;position:relative;flex:none"><svg class="lv-ck" viewBox="0 0 26 26" style="position:absolute;inset:-${fs * .1}px;width:${fs * 1.5}px;height:${fs * 1.5}px;opacity:0"><circle cx="13" cy="13" r="13" fill="#18B87A"/><path d="M7.5 13.5l4 4 7-8" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>` : ''}</div>`;
    } else if (it.type === 'steps') {
      d.innerHTML = `<div style="border-radius:${fs * 1.1}px;background:${cardBg};box-shadow:0 0 0 1px rgba(17,17,20,.07),0 ${fs * .4}px ${fs * 1.4}px rgba(20,24,40,.08);padding:${fs * .5}px ${fs}px">${it.steps.map(s => `
        <div class="lv-step" style="display:flex;align-items:center;gap:${fs * .6}px;padding:${fs * .45}px 0">
          <div style="position:relative;width:${fs * 1.3}px;height:${fs * 1.3}px;flex:none">
            ${A.spinner(fs * 1.3, Math.max(2, fs * .12), A.hexA(accent, .2), accent)}
            <svg class="lv-ok" viewBox="0 0 26 26" style="position:absolute;inset:0;width:100%;height:100%;opacity:0"><circle cx="13" cy="13" r="13" fill="${accent}"/><path d="M7.5 13.5l4 4 7-8" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <div class="lv-stxt" style="font-weight:500">${txt(s)}</div></div>`).join('')}</div>`;
    } else if (it.type === 'notif') {
      const av = it.icon === 'logo' || !it.icon ? ctx.logo(fs * 1.9) : (iconHTML(ctx, it.icon, accent, fs * 1.9) ?? A.icon('sparkle', accent, fs * 1.9));
      d.innerHTML = `<div style="display:flex;gap:${fs * .6}px;padding:${fs * .75}px ${fs * .85}px;border-radius:${fs * 1.1}px;background:${o.glass ? 'rgba(255,255,255,.78)' : cardBg};${o.glass ? 'backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);' : ''}box-shadow:0 ${fs * .5}px ${fs * 1.6}px rgba(20,24,40,.14),0 0 0 1px rgba(17,17,20,.05)">
        <div style="flex:none">${av}</div><div style="min-width:0;flex:1"><div style="display:flex;justify-content:space-between;color:${muted};font-size:${fs * .72}px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">${txt(it.app || ctx.brand.name)}<span>${A.esc(it.time || 'now')}</span></div>
        <div style="font-weight:700">${txt(it.title || '')}</div>${it.body ? `<div style="color:${o.muted2 || '#55555E'};font-size:${fs * .9}px">${txt(it.body)}</div>` : ''}</div></div>`;
    } else if (it.type === 'image') {
      const h = it.height ? it.height * sw / 470 : sw * 1.2;
      d.innerHTML = `<div style="position:relative;height:${h}px;border-radius:${fs * .8}px;overflow:hidden;background:${soft}"><img class="lv-img" src="${ctx.asset(it.src)}" style="position:absolute;left:0;top:0;width:100%;display:block"></div>`;
    } else if (it.type === 'chips') {
      d.innerHTML = `<div style="display:flex;gap:${fs * .45}px;flex-wrap:wrap">${it.chips.map(c => `<div style="padding:${fs * .4}px ${fs * .8}px;border-radius:99px;background:${soft};font-weight:600;font-size:${fs * .86}px">${txt(c)}</div>`).join('')}</div>`;
    } else if (it.type === 'space') d.style.height = it.size + 'px';
    else if (it.type === 'tap') d.style.display = 'none';
    if (it.type !== 'tap' && it.type !== 'space') ctx.layer(d, `${it.type}-${it.i + 1}`);   // one layer per UI item (beats.yaml order)
    flow.appendChild(d);
    return { r, d };
  });
  // the tap indicator: a finger ripple on phones, a cursor elsewhere — only when there is a tap (an element that never
  // shows would be an empty, untagged layer for --layers)
  const pointer = sched.some(r => r.it.type === 'tap') ? document.createElement('div') : null;
  if (pointer) {
    pointer.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;opacity:0;z-index:5';
    pointer.innerHTML = o.cursor
      ? `<svg width="${fs * 1.6}" height="${fs * 1.95}" viewBox="0 0 32 39" style="display:block;overflow:visible;filter:drop-shadow(0 1.6px 2.4px rgba(0,0,0,.3))"><path d="M3.5 2.5V30.6L9.9 24.6L14.6 35.4L19.6 33.3L14.9 22.7H23.8Z" fill="#050505" stroke="#fff" stroke-width="2.6" stroke-linejoin="round" paint-order="stroke"/></svg>`
      : `<div style="width:${fs * 3.2}px;height:${fs * 3.2}px;margin:-${fs * 1.6}px 0 0 -${fs * 1.6}px;border-radius:50%;background:${A.hexA(accent, .35)};box-shadow:0 0 0 ${fs * .25}px ${A.hexA(accent, .18)}"></div>`;
    screen.appendChild(pointer);
    ctx.layer(pointer, 'cursor');
  }
  const H = screen.clientHeight, bottomPad = o.bottom ?? sw * .08;
  let geo = null;
  const measure = () => {
    if (geo) return geo;
    const sr = screen.getBoundingClientRect(), scale = sr.width / screen.offsetWidth || 1;
    geo = nodes.map(({ d }) => ({ top: d.offsetTop + topPad, bottom: d.offsetTop + topPad + d.offsetHeight }));
    // tap targets: the button with that label in the closest card above it
    nodes.forEach(({ r }, i) => {
      if (r.it.type !== 'tap') return;
      for (let j = i - 1; j >= 0; j--) {
        const b = [...nodes[j].d.querySelectorAll('.lv-act')].find(x => x.dataset.label === r.it.text) || (j === 0 ? null : null);
        if (b) { const br = b.getBoundingClientRect(); r.target = { x: (br.left - sr.left + br.width / 2) / scale, y: (br.top - sr.top + br.height / 2) / scale, el: b, node: j }; break; }
      }
    });
    return geo;
  };
  const scrollAt = (t) => {           // keep the newest visible item on screen
    const g = measure(); let prev = 0, cur = 0, since = -1e9;
    nodes.forEach(({ r }, i) => {
      if (r.it.type === 'tap' || t < r.t0) return;
      const want = Math.max(0, g[i].bottom - (H - bottomPad));
      if (want !== cur) { prev = cur; cur = want; since = r.t0; }
    });
    return prev + (cur - prev) * k.outCubic(k.u01(t, since, since + 10));
  };
  return {
    sched, flow,
    render(t) {
      measure();
      for (const { r } of nodes) if (r.target) r.target.el.style.transform = 'none';   // reset; an active tap re-applies below
      const sc = o.scroll === false ? 0 : scrollAt(t);
      flow.style.transform = `translateY(${(-sc).toFixed(2)}px)`;
      let pointerOn = 0;
      nodes.forEach(({ r, d }) => {
        const it = r.it, p = k.outBack(k.u01(t, r.t0, r.t0 + 9)), e = k.clamp(k.u01(t, r.t0, r.t0 + 5) * 1.6);
        if (it.type !== 'tap') { d.style.opacity = e.toFixed(3); d.style.transform = `translateY(${((1 - p) * fs * 1.4).toFixed(2)}px) scale(${k.lerp(.96, 1, k.clamp(p, 0, 1)).toFixed(4)})`; }
        if (it.type === 'typing') d.querySelectorAll('.lv-dot').forEach((dot, j) => { dot.style.transform = `translateY(${(-fs * .22 * Math.max(0, Math.sin(t * .45 - j * .9))).toFixed(2)}px)`; });
        if (it.type === 'input') {
          const times = typeTimes(r), n = times.filter(x => x <= t).length;
          d.querySelector('.lv-type').textContent = Array.from(it.text).slice(0, n).join('');
          d.querySelector('.lv-ph').style.display = n ? 'none' : 'inline';
          const press = 1 - .12 * Math.sin(Math.PI * k.u01(t, r.t1 - 6, r.t1 - 2));
          d.querySelector('.lv-send').style.transform = `scale(${press.toFixed(4)})`;
        }
        if (it.type === 'steps') {
          const st = stepTimes(r);
          d.querySelectorAll('.lv-step').forEach((row, j) => {
            const s = st[j], running = t >= s.start && t < s.done, done = t >= s.done;
            const spin = row.querySelector('.lv-spin'), ok = row.querySelector('.lv-ok');
            spin.style.opacity = done ? 0 : t >= s.start ? 1 : .35;
            A.spinAt(spin, t);
            const okp = k.outBack(k.u01(t, s.done, s.done + 7));
            ok.style.opacity = done ? 1 : 0; ok.style.transform = `scale(${done ? okp.toFixed(4) : 0})`;
            row.querySelector('.lv-stxt').style.opacity = done ? 1 : running ? .95 : .45;
          });
        }
        if (it.type === 'row' && it.check) {
          const ck = d.querySelector('.lv-ck'), cp = k.outBack(k.u01(t, CHECK_AT(r), CHECK_AT(r) + 7));
          ck.style.opacity = cp > 0 ? 1 : 0; ck.style.transform = `scale(${cp.toFixed(4)})`;
        }
        if (it.type === 'image' && it.scroll) {
          const img = d.querySelector('.lv-img'), sp = k.ioCubic(k.u01(t, r.t0 + 6, r.t1 + (ctx.D - r.t1) * .6));
          img.style.transform = `translateY(${(-it.scroll * sp * sw / 470).toFixed(2)}px)`;
        }
        if (it.type === 'tap' && t >= r.t0 - 2 && t < r.t1 + 8) {
          measure();
          if (r.target) {
            pointerOn = 1;
            const at = TAP_AT(r), arrive = k.outCubic(k.u01(t, r.t0, at - 1));
            const x0 = r.target.x + sw * .25, y0 = r.target.y + sw * .35;
            const x = k.lerp(x0, r.target.x, arrive), y = k.lerp(y0, r.target.y, arrive) - sc;
            const press = Math.sin(Math.PI * k.u01(t, at - 2, at + 3));
            pointer.style.opacity = (k.clamp(k.u01(t, r.t0 - 2, r.t0 + 2)) * (1 - k.u01(t, r.t1 + 2, r.t1 + 8))).toFixed(3);
            pointer.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) scale(${(1 - .15 * press).toFixed(4)})`;
            r.target.el.style.transform = `scale(${(1 - .07 * press).toFixed(4)})`;
          }
        }
      });
      if (pointer && !pointerOn) pointer.style.opacity = 0;
    },
  };
}
