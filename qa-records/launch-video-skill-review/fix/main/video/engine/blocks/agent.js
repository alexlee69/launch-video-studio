// agent — a light agent-at-work UI: an optional user message (top right), agent rows that each think (shimmering
// status), stream a reply word by word like a real LLM (chunks, grey → ink, a soft caret) and tick ✓, then an
// optional bold streamed title with progress steps ticking underneath. The column scrolls (and fades at the top)
// when it outgrows the frame. `frame: window` puts it in an app window: a sidebar (title, search, a skeleton slot an
// agent drops into), a header with the agent's avatar and name, rules, and the message bar, each chrome part arriving
// on the measured beats of a launch film's window shot.
//
// Motion measured on a launch film (30 fps): a row arriving mid-shot slides its avatar in from the left (−1.1 avatar
// widths × 0.74 per frame) while its name line fades in over 3 frames and its status wipes in; a new message scrolls
// the chat with a double-exponential move (velocity ×1.9 per frame in, ×0.57 out, peaking as the row arrives).
import { F } from './_film.js';

const rowsOf = s => [].concat(s.rows || []).map((r, i) => (typeof r === 'string' ? { reply: r } : r || {}));
const stepsOf = s => [].concat(s.steps || []).map(String);
// a local frame (45), seconds ("1.5s") or a negative frame (−60 = that long before the shot starts: already there)
const atOf = (v, what) => {
  if (v == null || v === '') return null;
  const m = String(v).trim().match(/^(-?\d+(?:\.\d+)?)\s*(s|sec)?$/);
  if (!m) throw new Error(`${what} must be a frame number (30 per second; negative = before the shot starts) or seconds like 1.5s (got ${JSON.stringify(v)})`);
  return m[2] ? Number(m[1]) * 30 : Number(m[1]);
};
const SCROLL = { tin: 1.5, tout: 1.8 }, SLIDE = { k: 1.1, decay: .74 };
// piecewise-linear lookup in [[x, y], …] (held flat outside)
const tab = (pts, x) => { if (x <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [a, ya] = pts[i - 1], [b, yb] = pts[i]; return ya + (yb - ya) * (x - a) / (b - a); } return pts[pts.length - 1][1]; };
// the window chrome's entrance after the cut, in local frames (measured): rules + header, the bar's outline, the send
// button growing from a dot, the placeholder wiping in, the + and mic glyphs last; the sidebar fades and unblurs at
// sidebar.at, its skeleton slot one frame later
const CHROME = {
  head: [[0, .04], [.5, .1], [1.5, .32], [2.5, .62], [3.5, .85], [4.5, 1]],
  bar: [[.5, 0], [1.5, .15], [2.5, .35], [3.5, .55], [4.5, .7], [5.5, .85], [6.5, 1]],
  send: [[7.5, 0], [8.5, .25], [9.5, .45], [10.5, .62], [11.5, .75], [12.5, .85], [13.5, .92], [14.5, .96], [15.5, .99], [16.5, 1]],
  wipe: [[8, 0], [8.5, .15], [9.5, .42], [10.5, .66], [11.5, .85], [12.5, 1]], ph: [[8.5, .35], [12.5, .7], [16.5, 1]],
  plus: [[9, 0], [9.5, .2], [11.5, .6], [14.5, 1]], glyph: [[17, 0], [17.5, .3], [18.5, .7], [19.5, 1]],
  side: [[-.5, 0], [.5, .4], [1.5, .75], [2.5, 1]], sideBlur: [[-.5, 3], [.5, 2.5], [1.5, 1.2], [2.5, 0]],
  slot: [[1.5, 0], [2.5, .7], [3.5, 1]], slotBlur: [[1.5, 2], [2.5, 1], [3.5, 0]],
  name: [[0, 0], [.5, .1], [1.5, .6], [2.5, .9], [3.5, 1]], status: [[0, 0], [.5, .15], [2.5, .6], [4.5, .85], [6.5, 1]],
};
const sidebarOf = s => s.sidebar && typeof s.sidebar === 'object' ? s.sidebar : {};
// the whole schedule in local frames (cues, hero and render share it); compressed evenly when it can't fit — unless a
// row is pinned with `at:`, which keeps every time as written
function plan(s, D) {
  const rows = rowsOf(s), steps = stepsOf(s), rate = Number(s.rate) || 10;
  const pins = rows.map((r, i) => atOf(r.at, `agent ${s.id} row ${i + 1} at`)), pinned = pins.some(x => x != null);
  let t = s.user ? 16 : 0;
  const R = rows.map((r, i) => {
    const at = pins[i] ?? t, think = r.think != null && Number.isFinite(Number(r.think)) ? Math.max(0, Number(r.think)) : 12;
    const st = F.stream(r.reply || '', at + think, rate, true), done = (r.reply ? st.end : at + 14) + 6;
    t = (r.reply ? st.end : at + 14) + 4;
    return { at, st, done, statusAt: atOf(r.statusAt, `agent ${s.id} row ${i + 1} statusAt`), statusLen: Math.max(1, Number(r.statusLen) || 22) };
  });
  // the user's message: 14 frames before a pinned first row (so it is already there when that row is), else at frame 2
  const user = s.user ? { at: R.length && pins[0] != null ? R[0].at - 14 : 2 } : null;
  const title = s.title ? (() => { const at = t + (rows.length ? 4 : 2); const st = F.stream(s.title, at, Number(s.titleRate) || 6.5); t = st.end + 8; return { at, st }; })() : null;
  const S = steps.map((x, i) => { const at = t + i * 11, st = F.stream(x, at + 2, 14); return { at, st, done: Math.max(st.end + 6, at + 14) }; });
  if (S.length) t = S[S.length - 1].done;
  const end = t, budget = D * .86;
  const k = !pinned && end > budget ? budget / end : 1;
  const sc = v => v * k, scSt = st => ({ ...st, times: st.times.map(sc), end: sc(st.end) });
  return { k, pinned, end: sc(end), user: user && { at: sc(user.at) }, rows: R.map(r => ({ ...r, at: sc(r.at), st: scSt(r.st), done: sc(r.done) })), title: title && { at: sc(title.at), st: scSt(title.st) }, steps: S.map(x => ({ at: sc(x.at), st: scSt(x.st), done: sc(x.done) })) };
}

export default {
  name: 'agent',
  doc: 'A light agent-at-work UI: optional user message, agent rows (avatar sliding in, name, shimmering status → ✓, a reply streamed like an LLM; the chat scrolls with a momentum move), then an optional bold streamed title with steps ticking off. frame: window = inside an app window (sidebar, header, message bar).',
  layers: 'user · row-1 … row-N · title · step-1 … step-N · input (frame: window adds sidebar · header — the header layer holds the rules too)',
  media: [],
  // every line on screen, in order (captions SRT, storyboard, review sheet); read = what the reading-time check counts
  // (the replies stream as UI, like a phone's messages, so only the user's message and the title must be read in time)
  copy: s => [s.user, ...rowsOf(s).map(r => r.reply), s.title, ...stepsOf(s)].filter(x => x != null && String(x).trim() !== '').map(String),
  read: s => [s.user, s.title].filter(x => x != null && String(x).trim() !== '').map(String),
  params: {
    user: 'the user\'s message (top right, optional)',
    rows: 'list of {avatar: cast index | spark | logo, name: "Scout", status: "Scouting", done: "Done", reply: "streamed text", at: local frame it arrives (negative = already there, done), think: frames of shimmering status before the reply streams (default 12), statusAt / statusLen: re-wipe its status (or done) label from that frame over statusLen frames}',
    title: 'bold streamed heading after the rows (optional, *accent* ok)', steps: 'progress lines under the title, each spinner → ✓ (optional)',
    input: 'placeholder for a message bar pinned at the bottom (optional; frame: window always has one, default "Message <first agent>")', rate: 'reply speed in words per second (default 10)',
    dolly: 'false = no open-close-and-settle zoom on the UI (default true; never with frame: window)',
    frame: 'window = the UI inside an app window: sidebar, header, rules and message bar arrive in the first 20 frames',
    sidebar: '(frame: window) {title: "Your agents", at: frame the sidebar fades in, drop: frame the first agent drops into its skeleton slot}',
    header: '(frame: window) {name, sub, avatar} — defaults: the first row\'s name and avatar',
    scroll: 'auto (default: the chat scrolls only when the newest message would leave the view) | always (every row arriving mid-shot pushes the chat up by its own height, like a busy chat)',
  },
  required: [],
  validate(s, D) {
    let p; const w = [];
    try { p = plan(s, D); } catch (e) { return [e.message]; }
    if (!s.user && !rowsOf(s).length && !s.title && !stepsOf(s).length && s.frame !== 'window') w.push(`agent ${s.id}: give at least one of user, rows, title, steps`);
    if (p.k < .75) w.push(`agent ${s.id}: the messages need ~${Math.round(100 / p.k)}% of the shot; they will stream ${Math.round((1 / p.k - 1) * 100)}% faster — lengthen the shot or trim copy`);
    const last = Math.max(...p.rows.map(r => r.st.end), p.title ? p.title.st.end : -Infinity, ...p.steps.map(x => x.st.end));
    if (p.pinned && last > D) w.push(`agent ${s.id}: with the rows pinned (at:) the last words arrive at frame ${Math.ceil(last)} of ${D} — move them earlier, raise rate, or lengthen the shot`);
    return w;
  },
  cues(s, D) {
    const p = plan(s, D), c = [];
    if (p.user) c.push({ t: p.user.at, kind: 'pop', note: 84, gain: .8 });
    p.rows.forEach((r, i) => { c.push({ t: r.at + 1, kind: 'pop', note: [76, 79, 81, 83][i % 4], gain: .7 }); c.push({ t: r.done, kind: 'pop', note: 93, gain: .75 }); });
    p.steps.forEach(x => c.push({ t: x.done, kind: 'tick', gain: 1.2 }));
    if (s.frame === 'window') {      // the send button pops out of its dot; a tick as the sidebar appears
      c.push({ t: 8, kind: 'pop', note: 88, gain: .45 });
      const sb = sidebarOf(s), sa = atOf(sb.at, 'sidebar.at');
      if (sa != null) c.push({ t: sa, kind: 'tick', gain: 1 });
    }
    return c;
  },
  hero: (s, D) => { const sa = s.frame === 'window' ? atOf(sidebarOf(s).at, 'sidebar.at') : null; return Math.max(10, sa != null ? sa + 6 : 0, Math.min(D - 6, Math.round(plan(s, D).end + 8))); },
  async build(ctx, s) {
    const { W, H, u, K, A, safe, portrait, square } = ctx, B = ctx.brand.colors;
    const P = plan(s, ctx.D), rows = rowsOf(s), steps = stepsOf(s), win = s.frame === 'window';
    const ink = F.rgb(B.ink), grey = 'rgb(190,191,200)', green = '#14A66B';
    const font = `font-family:${ctx.font};`;
    // what the camera's base framing shows (zoom / focus / offset): a close-up scrolls to keep the newest row in it
    const view = ctx.view || { x0: 0, y0: 0, x1: W, y1: H };
    // ── layout: the standalone column (centred) or the app window (a 1920-wide design scaled to the frame's width;
    // header from the top, message bar from the bottom)
    // window: a 1920 × 1080 design at the frame's short side (16:9 = as designed); positions across are fractions of the
    // width, the header hangs from the window's top and the bar from its bottom: the full frame in 16:9 and 1:1, the
    // platform-safe band (9 %–82 % of the height) in 9:16
    const dw = Math.min(W, H) / 1080, d = v => v * dw, wy0 = portrait ? .09 * H : 0, wy1 = portrait ? .82 * H : H;
    const cw = win ? .533 * W : portrait ? safe.w : square ? safe.w * .96 : Math.min(safe.w * .76, 1360 * u);
    const x0 = win ? .373 * W : W / 2 - cw / 2, fs = win ? d(24.5) : (portrait ? 40 : square ? 38 : 42) * u, av = win ? d(62) : 78 * u, ind = av + (win ? d(22) : 24 * u);
    const wipe = (el, p, edge = .4) => {           // soft left → right reveal (a mask; none once complete)
      if (p >= 1) { el.style.webkitMaskImage = 'none'; el.style.maskImage = 'none'; return; }
      const a = (p * (1 + edge) - edge) * 100, b = p * (1 + edge) * 100, m = `linear-gradient(90deg,#000 ${a.toFixed(2)}%,transparent ${b.toFixed(2)}%)`;
      el.style.webkitMaskImage = m; el.style.maskImage = m;
    };
    const blurOf = F.dirBlur, scrollBlur = F.dirBlur(`ag-sc-${s.id}`);
    // ── window chrome
    // chrome parts are frame-sized boxes (children absolutely placed inside them): a fading or blurred box whose
    // children hang outside it makes Chrome composite it
    const chrome = {};
    if (win) {
      const sb = sidebarOf(s), hd = s.header && typeof s.header === 'object' ? s.header : {}, r0 = rows[0] || {};
      const rule = 'rgba(17,17,20,.07)';
      chrome.rules = ctx.el(`<div style="position:absolute;left:${.347 * W}px;top:${wy0 + d(85)}px;width:${Math.max(1, d(1.8))}px;height:${wy1 - wy0 - d(85) - d(108)}px;background:${rule}"></div>
        <div style="position:absolute;left:${.347 * W}px;top:${wy0 + d(177.6)}px;width:${.562 * W}px;height:${Math.max(1, d(1.8))}px;background:${rule}"></div>`, `left:0;top:0;width:${W}px;height:${H}px`, 'header');
      const hav = d(74), hname = hd.name ?? r0.name ?? ctx.brand.name;
      chrome.head = ctx.el(`<div style="position:absolute;left:${.401 * W - hav / 2}px;top:${wy0 + d(116) - hav / 2}px;width:${hav}px;height:${hav}px">${F.mascot(ctx, hd.avatar ?? r0.avatar ?? 0, hav, 'smile')}</div>
        <span class="lv-txt lv-ui" style="position:absolute;left:${.436 * W}px;top:${wy0 + d(114) - d(32.5) * .86}px;${font}font-size:${d(32.5)}px;line-height:1;font-weight:600;letter-spacing:-.01em;color:${B.ink};white-space:nowrap">${A.esc(hname)}</span>
        ${hd.sub ? `<span class="lv-txt lv-ui" style="position:absolute;left:${.436 * W}px;top:${wy0 + d(147) - d(23.6) * .86}px;${font}font-size:${d(23.6)}px;line-height:1;font-weight:400;color:${B.muted};white-space:nowrap">${A.esc(hd.sub)}</span>` : ''}`,
        `left:0;top:0;width:${W}px;height:${H}px`, 'header');
      chrome.sa = atOf(sb.at, 'sidebar.at'); chrome.da = atOf(sb.drop, 'sidebar.drop');
      chrome.side = ctx.el(`<span class="lv-txt lv-ui" style="position:absolute;left:${.078 * W}px;top:${wy0 + d(133) - d(23) * .86}px;${font}font-size:${d(23)}px;line-height:1;font-weight:400;color:${B.muted};white-space:nowrap">${A.esc(sb.title ?? 'Your agents')}</span>
        <svg style="position:absolute;left:${.311 * W}px;top:${wy0 + d(107)}px" width="${d(33)}" height="${d(33)}" viewBox="0 0 24 24" fill="none" stroke="${B.muted}" stroke-width="2.1" stroke-linecap="round"><circle cx="10.2" cy="10.2" r="7"/><path d="M15.4 15.4L21.2 21.2"/></svg>`,
        `left:0;top:0;width:${W}px;height:${H}px;opacity:0`, 'sidebar');
      const sw = .248 * W, sh = d(107);
      chrome.slot = ctx.el('', `left:${.078 * W}px;top:${wy0 + d(188)}px;width:${sw}px;height:${sh}px;border-radius:${d(19.5)}px;background:#E9E9EF;overflow:hidden;opacity:0`, 'sidebar');
      chrome.sw = sw; chrome.sh = sh;
      if (chrome.da != null) {       // the first agent drops into the slot from above, clipped by it
        const m = d(96);
        chrome.drop = document.createElement('div');
        chrome.drop.style.cssText = `position:absolute;left:${.188 * sw - m / 2}px;top:0;width:${m}px;height:${m}px;display:none`;
        chrome.drop.innerHTML = F.mascot(ctx, r0.avatar ?? 0, m, 'happy'); chrome.dropM = m;
        chrome.slot.appendChild(chrome.drop);
      }
      chrome.sideBlur = blurOf(`ag-side-${s.id}`); chrome.slotBlur = blurOf(`ag-slot-${s.id}`);
      // the message bar: outline, + button, placeholder, send button with a mic glyph
      const bh = d(83.5), bx = .376 * W, bw = .541 * W, ph = s.input || `Message ${hname}`;
      chrome.bar = ctx.el(`<div class="ag-bo" style="position:absolute;inset:0;border-radius:${bh / 2}px;box-shadow:inset 0 0 0 ${Math.max(1, d(2.5))}px rgba(17,17,20,.09)"></div>
        <div class="ag-plus" style="position:absolute;left:${d(21)}px;top:${(bh - d(39)) / 2}px;width:${d(39)}px;height:${d(39)}px;border-radius:50%;background:rgba(17,17,20,.04)"></div>
        <svg class="ag-pg" style="position:absolute;left:${d(21)}px;top:${(bh - d(39)) / 2}px" width="${d(39)}" height="${d(39)}" viewBox="0 0 22 22"><path d="M11 6.5V15.5M6.5 11H15.5" stroke="${B.muted}" stroke-width="1.4" stroke-linecap="round"/></svg>
        <span class="lv-txt ag-ph" style="position:absolute;left:${d(87)}px;top:${bh / 2 - d(23.6) * .6}px;${font}font-size:${d(23.6)}px;line-height:1.2;color:${B.muted};white-space:nowrap">${A.esc(ph)}</span>
        <div class="ag-send" style="position:absolute;left:${bw - d(17) - d(57)}px;top:${(bh - d(57)) / 2}px;width:${d(57)}px;height:${d(57)}px;border-radius:50%;background:${B.ink}"></div>
        <svg class="ag-sg" style="position:absolute;left:${bw - d(17) - d(57)}px;top:${(bh - d(57)) / 2}px" width="${d(57)}" height="${d(57)}" viewBox="0 0 32 32"><rect x="13.2" y="8.5" width="5.6" height="10" rx="2.8" fill="#fff"/><path d="M10.5 15.5C10.5 19 13 21 16 21C19 21 21.5 19 21.5 15.5M16 21V23.8" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>`,
        `left:${bx}px;top:${wy1 - d(181.2)}px;width:${bw}px;height:${bh}px;opacity:0`, 'input');
      chrome.bar.classList.add('lv-ui');
      for (const k of ['bo', 'plus', 'pg', 'ph', 'send', 'sg']) chrome[k] = chrome.bar.querySelector('.ag-' + k);
    }
    const flow = ctx.el('', `left:${x0}px;top:0;width:${cw}px;height:0`);
    const add = (html, css, layer) => { const el = document.createElement('div'); el.className = 'lv-ui'; el.style.cssText = `position:absolute;left:0;width:${cw}px;${font}${css}`; el.innerHTML = html; flow.appendChild(el); return ctx.layer(el, layer); };
    const caretHTML = `<i class="ag-caret" style="position:absolute;left:0;top:0;width:${fs * .5}px;height:${fs * .5}px;border-radius:50%;background:${B.ink};opacity:0"></i>`;
    // a row's box reaches 1.6 avatars left of the column, so the avatar sliding in never leaves it (a child outside a
    // scaling box makes Chrome composite the row, and --layers could not restack it)
    const slideBox = 1.6 * av;
    const els = [];   // {el, top, h, at, kind}
    let y = 0;
    if (s.user) {
      const ufs = win ? d(25) : fs, pad = win ? `${d(37)}px ${d(34)}px` : `${fs * .55}px ${fs * .85}px`, rad = win ? `${d(34)}px` : `${fs * .9}px ${fs * .9}px ${fs * .25}px ${fs * .9}px`;
      const el = add(`<div style="display:flex;justify-content:flex-end"><div class="ag-ub" style="max-width:78%;padding:${pad};border-radius:${rad};background:${win ? '#ECEEF2' : '#E9E9EF'};transform-origin:100% 100%">
        <span class="lv-txt" style="position:relative;font-size:${ufs}px;font-weight:${win ? 400 : 500};line-height:1.35;color:${B.ink}">${A.esc(F.plain(s.user))}</span></div></div>`, `top:${y}px`, 'user');
      els.push({ el, top: y, h: el.offsetHeight, at: P.user.at, kind: 'user', ub: el.querySelector('.ag-ub') }); y += el.offsetHeight + (win ? d(70) : 46 * u);
    }
    rows.forEach((r, i) => {
      const status = r.status || 'Working', done = r.done || 'Done';
      const el = add(`<div style="display:flex;align-items:center;gap:${win ? d(22) : 22 * u}px;height:${av}px">
          <div class="ag-av" style="position:relative;width:${av}px;height:${av}px;flex:none">${F.mascot(ctx, r.avatar ?? i, av, 'smile')}</div>
          <div class="ag-hd" style="display:flex;align-items:center;gap:${fs * .55}px;white-space:nowrap">
            <span class="lv-txt" style="position:relative;font-size:${fs}px;font-weight:600;color:${B.ink}">${A.esc(r.name || ctx.brand.name)}</span>
            <span style="position:relative;display:inline-flex;align-items:center;gap:${fs * .3}px">
              <span class="ag-ok" style="position:relative;width:${fs * .78}px;height:${fs * .78}px;opacity:0">${F.check(fs * .78, green)}</span>
              <span class="ag-dot" style="position:absolute;left:${fs * .2}px;top:${fs * .2}px;width:${fs * .38}px;height:${fs * .38}px;border-radius:50%;background:${B.accent}"></span>
              <span class="ag-lb" style="position:relative;display:inline-grid">
                <span class="lv-txt ag-st" style="grid-area:1/1;position:relative;font-size:${fs * .84}px;font-weight:500;${F.shimmerCss(F.rgb(B.muted), '#E2E3EA')}">${A.esc(status)}</span>
                <span class="lv-txt ag-dn" style="grid-area:1/1;position:relative;font-size:${fs * .84}px;font-weight:500;color:${green};opacity:0">${A.esc(done)}</span></span></span></div></div>
        ${r.reply ? `<div class="ag-rp" style="position:relative;margin:${fs * .45}px 0 0 ${ind}px;font-size:${win ? d(23.8) : fs}px;line-height:${win ? 1.32 : 1.42};color:${grey}"><span class="lv-txt" style="position:relative">${F.streamHTML(ctx, r.reply, B.accent)}</span>${caretHTML}</div>` : ''}`, `top:${y}px;left:${-slideBox}px;width:${cw + slideBox}px;padding-left:${slideBox}px;box-sizing:border-box`, `row-${i + 1}`);
      els.push({ el, top: y, h: el.offsetHeight, at: P.rows[i].at, kind: 'row', r: P.rows[i], avEl: el.querySelector('.ag-av'), hd: el.querySelector('.ag-hd'), lb: el.querySelector('.ag-lb'), ok: el.querySelector('.ag-ok'), dot: el.querySelector('.ag-dot'), stEl: el.querySelector('.ag-st'), dn: el.querySelector('.ag-dn'),
        spans: [...el.querySelectorAll('.ag-rp .fw')], caret: el.querySelector('.ag-caret'), blur: blurOf(`ag-av-${s.id}-${i}`) });
      y += el.offsetHeight + (win ? d(40) : 44 * u);
    });
    if (s.title) {
      const tfs = (portrait ? 74 : square ? 70 : 84) * u * (win ? .6 : 1);
      const el = add(`<div class="ag-ti" style="position:relative;margin-left:${rows.length ? ind : 0}px;font-size:${tfs}px;font-weight:700;letter-spacing:-.03em;line-height:1.1;color:${grey}"><span class="lv-txt" style="position:relative">${F.streamHTML(ctx, s.title, B.accent)}</span>${caretHTML.replace(`${fs * .5}px;height:${fs * .5}px`, `${tfs * .36}px;height:${tfs * .36}px`)}</div>`, `top:${y}px`, 'title');
      els.push({ el, top: y, h: el.offsetHeight, at: P.title.at, kind: 'title', spans: [...el.querySelectorAll('.fw')], caret: el.querySelector('.ag-caret'), st: P.title.st, cs: tfs * .36 });
      y += el.offsetHeight + 30 * u;
    }
    steps.forEach((x, i) => {
      const sz = fs * .95, el = add(`<div style="display:flex;align-items:flex-start;gap:${fs * .55}px;margin-left:${rows.length ? ind : 0}px">
          <div style="position:relative;width:${sz}px;height:${sz}px;flex:none;margin-top:${fs * .2}px">${A.spinner(sz, 3 * u, A.hexA(B.accent, .2), B.accent)}<div class="ag-sok" style="position:absolute;inset:0;opacity:0">${F.check(sz, B.accent)}</div></div>
          <div style="position:relative;font-size:${fs * .94}px;line-height:1.42;color:${grey}"><span class="lv-txt" style="position:relative">${F.streamHTML(ctx, x, B.accent)}</span></div></div>`, `top:${y}px`, `step-${i + 1}`);
      els.push({ el, top: y, h: el.offsetHeight, at: P.steps[i].at, kind: 'step', x: P.steps[i], spin: el.querySelector('.lv-spin'), ok: el.querySelector('.ag-sok'), spans: [...el.querySelectorAll('.fw')] });
      y += el.offsetHeight + 16 * u;
    });
    // optional message bar pinned to the bottom of the frame (frame: window has its own, built above)
    let input = null, viewBottom = Math.min(safe.y1, view.y1 - 40 * u), viewTop = Math.max(safe.y0, view.y0 + 40 * u);
    if (win) { viewTop = wy0 + d(225); viewBottom = wy1 - d(181.2) - d(46); }
    else if (s.input) {
      const ifs = fs * .95;
      input = ctx.el(`<div class="lv-ui" style="display:flex;align-items:center;gap:${ifs * .6}px;height:${ifs * 2.6}px;padding:0 ${ifs * .5}px 0 ${ifs * .9}px;border-radius:99px;background:#fff;box-shadow:0 0 0 ${1.5 * u}px rgba(17,17,20,.07),0 ${14 * u}px ${40 * u}px rgba(20,24,40,.1);${font}font-size:${ifs}px">
          <span class="lv-txt" style="position:relative;flex:1;color:${B.muted};white-space:nowrap">${A.esc(s.input)}</span>
          <div style="width:${ifs * 1.8}px;height:${ifs * 1.8}px;border-radius:50%;background:${B.ink};display:flex;align-items:center;justify-content:center"><svg width="${ifs * .85}" height="${ifs * .85}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></div></div>`,
        `left:${x0}px;width:${cw}px;top:${Math.min(safe.y1, view.y1 - 40 * u) - fs * 2.6 * .95}px`, 'input');
      viewBottom = Math.min(safe.y1, view.y1 - 40 * u) - input.offsetHeight - 40 * u;
    }
    // vertical placement: centred while it fits, otherwise top-aligned and scrolling as it grows (window: always top).
    // scroll: always — what is on screen at the start is placed that way, and each row arriving mid-shot pushes the chat
    // up by its own height (it enters below)
    const always = s.scroll === 'always' && !win, early = els.filter(e => e.kind !== 'row' || e.at <= 0), lastE = early[early.length - 1];
    const total = always ? (lastE ? lastE.top + lastE.h : 0) : y - (els.length ? (els[els.length - 1].kind === 'step' ? 16 : 30) * u : 0), viewH = viewBottom - viewTop;
    const top0 = win || total > viewH ? viewTop : viewTop + (viewH - total) / 2;
    flow.style.top = top0 + 'px';
    // the scroll: each element that needs room scrolls the chat by its share with a momentum move peaking as it arrives
    const order = [...els].sort((a, b) => a.at - b.at), moves = [];
    let want0 = 0;
    for (const e of order) {
      const want = always && e.kind === 'row' && e.at > 0 ? want0 + e.h + (els[els.indexOf(e) - 1] ? e.top - (els[els.indexOf(e) - 1].top + els[els.indexOf(e) - 1].h) : 0) : Math.max(want0, top0 + e.top + e.h - viewBottom);
      if (want > want0) { moves.push({ c: e.at, S: want - want0 }); want0 = want; }
    }
    const scrollAt = t => moves.reduce((a, m) => a + K.pulse(t, m.c, m.S, SCROLL.tin, SCROLL.tout), 0);
    const caretAt = (e, last, t, endT, size) => {
      if (!e.caret) return;
      const on = last && t < endT + 8;
      e.caret.style.opacity = on ? ((.55 + .45 * Math.sin(t * .5)) * K.clamp(1 - K.u01(t, endT, endT + 8))).toFixed(3) : 0;
      if (last) { e.caret.style.left = (last.offsetLeft + last.offsetWidth + size * .45) + 'px'; e.caret.style.top = (last.offsetTop + last.offsetHeight * .52 - size / 2) + 'px'; e.caret.style.transform = `scale(${(.8 + .2 * Math.sin(t * .5)).toFixed(4)})`; }
    };
    const dollyOn = !win && s.dolly !== false;
    return {
      render(t) {
        const sc = scrollAt(t), vsc = Math.abs(scrollAt(t + .25) - scrollAt(t - .25)) * 2;
        // the scroll's motion blur (σ ≈ 0.22 × speed, as the measured chat), per element: a filtered wrapper would span layers
        const sblur = Math.max(0, .22 * vsc - .4 * u), sf = F.filt(scrollBlur(sblur * .08, sblur));
        flow.style.transform = `translateY(${(-sc).toFixed(2)}px)`;
        // dolly: the UI opens close (×1.09) and pulls back while it settles, then creeps in; applied per element
        // around the frame centre (a scaling wrapper around differently-layered children would make Chrome composite it).
        // Without it (dolly: false, frame: window) the messages still creep in by 0.3 % a second, so a shot with push: 0
        // never holds still once every row is done
        const dolly = dollyOn ? K.lerp(1.09, 1, K.outCubic(K.u01(t, -4, 40))) * (1 + .018 * K.u01(t, 40, ctx.D)) : 1 + .0001 * Math.max(0, t);
        for (const e of els) {
          const yy = top0 + e.top - sc, topFade = K.clamp(1 - (viewTop + 4 * u - yy) / (46 * u));     // scrolled off the top: gone before it leaves the frame
          if (e.kind === 'row') {
            // a row arriving: its avatar slides in from the left (−1.1 avatars × 0.74^t) with motion blur, the name line
            // fades in over 3 frames, the status wipes in; rows already there (at ≤ −7) carry over as they are
            const r = e.r, isDone = t >= r.done, a = t - r.at, vis = a >= -1;
            e.el.style.opacity = vis ? topFade.toFixed(3) : 0; e.el.style.filter = sf;
            e.el.style.transformOrigin = `${(W / 2 - x0 + slideBox).toFixed(1)}px ${(H / 2 - top0 - e.top + sc).toFixed(1)}px`;     // (its box starts slideBox left of the column)
            e.el.style.transform = dolly !== 1 ? `scale(${dolly.toFixed(5)})` : 'none';
            const off = vis ? -SLIDE.k * av * Math.pow(SLIDE.decay, Math.max(-1, a)) : 0, v = Math.abs(off * (1 - SLIDE.decay));
            e.avEl.style.left = `${off.toFixed(2)}px`;     // by left, not a transform: the row may scale (dolly) and Chrome composites a transformed child of a scaling box
            e.avEl.style.filter = F.filt(e.blur(Math.min(14 * u, .22 * v), 0));
            const bud = e.avEl.querySelector('svg');
            if (bud && !e.avEl.querySelector('.fs-spark')) bud.style.transform = t > r.at + 11 && !isDone ? `translateY(${(-3 * u * Math.abs(Math.sin((t - r.at) * .2))).toFixed(2)}px)` : 'none';
            F.sparkAt(e.avEl, isDone ? r.done + (t - r.done) * .35 : t);
            e.hd.style.opacity = tab(CHROME.name, a).toFixed(3);
            wipe(e.lb, r.statusAt != null ? K.clamp((t - r.statusAt) / r.statusLen) : tab(CHROME.status, a));
            F.shimmerAt(e.stEl, t - r.at, 30);
            const ok = K.outBack(K.u01(t, r.done, r.done + 8), 2);
            e.ok.style.opacity = isDone ? 1 : 0; e.ok.style.transform = isDone && ok < 1 ? `scale(${ok.toFixed(4)})` : isDone ? 'none' : 'scale(0)';
            e.dot.style.opacity = isDone ? 0 : (.45 + .55 * Math.abs(Math.sin((t - r.at) * .16))).toFixed(3);
            e.stEl.style.opacity = isDone ? 0 : 1; e.dn.style.opacity = isDone ? K.clamp(K.u01(t, r.done, r.done + 5)).toFixed(3) : 0;
            const last = F.streamAt(K, e.spans, r.st.times, t, 'rgb(186,187,197)', ink);
            caretAt(e, last, t, r.st.end, fs * .5);
            continue;
          }
          const k = K.outExpo(K.u01(t, e.at - 4, e.at + 10)), a = K.clamp(K.u01(t, e.at - 4, e.at + 2));     // entrances lead by 4 frames: an element at 0 is on screen in frame 0
          e.el.style.opacity = (a * topFade).toFixed(3); e.el.style.filter = sf;
          e.el.style.transformOrigin = `${(W / 2 - x0).toFixed(1)}px ${(H / 2 - top0 - e.top + sc).toFixed(1)}px`;
          const ty = (1 - k) * 26 * u;
          e.el.style.transform = ty > .005 || dolly !== 1 ? `translateY(${ty.toFixed(2)}px) scale(${dolly.toFixed(5)})` : 'none';
          if (e.kind === 'user') { const sb = K.lerp(.85, 1, K.clamp(K.outBack(K.u01(t, e.at - 4, e.at + 8)), 0, 1.05)); e.ub.style.transform = Math.abs(sb - 1) > 1e-4 ? `scale(${sb.toFixed(4)})` : 'none'; }
          if (e.kind === 'title') { const last = F.streamAt(K, e.spans, e.st.times, t, 'rgb(186,187,197)', ink); caretAt(e, last, t, e.st.end, e.cs); }
          if (e.kind === 'step') {
            const x = e.x, isDone = t >= x.done;
            e.spin.style.opacity = isDone ? 0 : 1; A.spinAt(e.spin, t);
            const ok = K.outBack(K.u01(t, x.done, x.done + 7));
            e.ok.style.opacity = isDone ? 1 : 0; e.ok.style.transform = `scale(${isDone ? ok.toFixed(4) : 0})`;
            F.streamAt(K, e.spans, x.st.times, t, 'rgb(186,187,197)', isDone ? ink : 'rgb(96,97,108)');
          }
        }
        if (input) { input.style.opacity = K.clamp(K.u01(t, -8, 2)).toFixed(3); input.style.transformOrigin = `${(W / 2 - x0).toFixed(1)}px ${(H / 2 - input.offsetTop).toFixed(1)}px`; input.style.transform = `translateY(${((1 - K.outExpo(K.u01(t, -8, 10))) * 30 * u + 2 * u * Math.sin(t * .08)).toFixed(2)}px) scale(${dolly.toFixed(5)})`; }
        if (win) {
          const c = chrome, hop = tab(CHROME.head, t);
          c.rules.style.opacity = hop.toFixed(3); c.head.style.opacity = hop.toFixed(3);
          c.bar.style.opacity = '1';
          c.bo.style.opacity = tab(CHROME.bar, t).toFixed(3);
          const ss = tab(CHROME.send, t);
          c.send.style.opacity = ss > .01 ? 1 : 0; c.send.style.transform = ss < 1 ? `scale(${ss.toFixed(4)})` : 'none';
          wipe(c.ph, tab(CHROME.wipe, t)); c.ph.style.opacity = (t < 8 ? 0 : tab(CHROME.ph, t)).toFixed(3);
          c.plus.style.opacity = tab(CHROME.plus, t).toFixed(3);
          c.pg.style.opacity = c.sg.style.opacity = tab(CHROME.glyph, t).toFixed(3);
          {                       // no sidebar.at: the sidebar is there from the start
            const st = c.sa != null ? t - c.sa : 99;
            c.side.style.opacity = tab(CHROME.side, st).toFixed(3); const sbl = tab(CHROME.sideBlur, st) * dw * 1.78; c.side.style.filter = F.filt(c.sideBlur(sbl, sbl));
            c.slot.style.opacity = tab(CHROME.slot, st).toFixed(3); const slb = tab(CHROME.slotBlur, st) * dw * 1.78; c.slot.style.filter = F.filt(c.slotBlur(slb, slb));
          }
          if (c.drop) {           // falling into the slot: centre from 0.87 slot heights above its top, slowing (measured)
            const tau = t - c.da;
            if (tau < -.5) c.drop.style.display = 'none';
            else {
              // the measured peek (4.5 frames), then it settles into the slot's middle (no bounce back out)
              const d0 = tau - 4.5, yc = (tau <= 4.5 ? -.872 + .213 * tau - .0117 * tau * tau : .5 + (-.653 - .153 * d0) * Math.exp(-d0 / 2.5)) * c.sh;
              c.drop.style.display = 'block'; c.drop.style.transform = `translateY(${(yc - c.dropM / 2).toFixed(2)}px)`;
            }
          }
        }
      },
    };
  },
};
