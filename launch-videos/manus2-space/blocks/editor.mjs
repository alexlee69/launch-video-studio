// STORYBOARD STAND-IN (job-local custom block, manus2-space "The Lull"). Our video editor: ONE master window laid out at
// 1080x608 design px (kit "editor": title bar, Project panel, viewer + transport, Alchemy panel, timeline with a ruler,
// layer list and staircase bars), shown through a virtual camera framing (cx, cy, s) per shot:
// screen = ((p - c) * s + (540, 304)) * W/1080. Reused from manus2-film's editor.mjs (same window, same framings);
// changed per the final kit: no greek bars, no wireframe look, and no words but the ones the plot needs. Layer and bin
// rows are poster-frame thumbnails and icon chips (a 'T' chip for type, The Lull mark chip, a wave / muted-speaker glyph
// for audio); tabs, aspect switch, search and transport are icons; the ruler has no numbers; names are set in type only
// where a row's `name` is given. Planned rows are 1 px dashed with a small grey '?' glyph (the plan has holes; her day
// fills them). Never Manus's editor (dark window, amber glow, status pill, Save / Export, Media / Text / Graphics tabs,
// filmstrips, green waveform) or their dark Alchemy UI. The viewer's comp shows HER film, The Lull (the client's own
// look: night navy, moon white, soft gold, lull red; a light geometric sans for its type): `clip` (a plate revealed by a
// ring + The Lull mark building + a typed super), `play` (her clips playing, with supers), `board` (Alchemy's direction
// board), `map` (the ONE ORBIT guest map) and `poster` (the hero frame). n fields are hf01 frames (n0 = the shot's
// first); heroAt picks the storyboard frame. hf01's camera moves on top of each framing are listed in the notes only.
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const lerp = (a, b, k) => a + (b - a) * k;
const u01 = (t, a, b) => b === a ? (t >= b ? 1 : 0) : Math.max(0, Math.min(1, (t - a) / (b - a)));
const ease = k => k * k * (3 - 2 * k);
const outCubic = k => 1 - Math.pow(1 - k, 3);
const INK = '#1F1F1F', BLUE = '#33ABFB', ICON = '#2CB4F3', GREY = '#8A8A8A', LINE = '#EEEEEE';
const NAVY = '#0E1A2B', MOON = '#F4F1EA', GOLD = '#E8C27A', LRED = '#D9544D', EBLUE = '#6FA8DC';
const AD = "'Jost', 'Avenir Next', 'Futura', sans-serif";    // The Lull's face (client brand; Jost class stand-in)
const PX = 24.8, X0 = 300;                                     // ruler: 0:00 at x 300, 24.8 px per second

// The Lull mark (the client's, fictional): a thin moon-white crescent cradling a small circle (the module's round
// window) with three star dots, on a night-navy disc. Parts carry classes so the S06 build can cut them on one by one.
const lull = (cls = '') => `<svg class="${cls}" viewBox="0 0 100 100" width="100%" height="100%" style="display:block;overflow:visible">
  <circle cx="50" cy="50" r="48" fill="${NAVY}"/><circle class="lm-rim" cx="50" cy="50" r="46" fill="none" stroke="${MOON}" stroke-width="2.2"/>
  <path class="lm-cres" d="M72.2 64.4A30 30 0 1 1 38.9 24.4A26 26 0 0 0 72.2 64.4Z" fill="${MOON}"/>
  <circle class="lm-win" cx="57" cy="43" r="8.5" fill="none" stroke="${MOON}" stroke-width="2.6"/>
  <g class="lm-stars" fill="${MOON}"><circle cx="75" cy="21" r="2.2"/><circle cx="84" cy="33" r="1.6"/><circle cx="64" cy="14" r="1.7"/></g></svg>`;
const sunIcon = (c = GOLD) => `<svg viewBox="0 0 20 20" width="100%" height="100%"><circle cx="10" cy="10" r="4" fill="${c}"/>${Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return `<path d="M${10 + 6 * Math.cos(a)} ${10 + 6 * Math.sin(a)}L${10 + 8.6 * Math.cos(a)} ${10 + 8.6 * Math.sin(a)}" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/>`; }).join('')}</svg>`;
const thumb = (src, w, h, extra = '') => `<div style="width:${w}px;height:${h}px;border-radius:2.5px;overflow:hidden;flex:none;background:#ccc;${extra}"><img src="${src}" style="width:100%;height:100%;object-fit:cover;display:block"></div>`;
const aspectIcons = (active = 0, c = GREY) => `<svg width="62" height="12" viewBox="0 0 62 12" style="display:block">${[[1, 2, 16, 9], [26, 1, 6, 10], [41, 1.5, 9, 9]].map(([x, y, w, h], i) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="none" stroke="${i === active ? INK : c}" stroke-width="1.1"/>`).join('')}</svg>`;
const waveGlyph = (c = GREY, w = 20) => `<svg width="${w}" height="11" viewBox="0 0 20 11"><path d="M1 5.5h2M4 3v5M7 1v9M10 3.5v4M13 2v7M16 4v3M19 5.5h-1" stroke="${c}" stroke-width="1.2" stroke-linecap="round"/></svg>`;
const mutedGlyph = (c = INK) => `<svg width="14" height="11" viewBox="0 0 14 11" fill="none" stroke="${c}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"><path d="M1 4h2.5L6.5 1.5v8L3.5 7H1z"/><path d="M9 3.5l3.5 4M12.5 3.5L9 7.5"/></svg>`;
const bellX = (c = ICON) => `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="${c}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/><path d="M3.5 3.5l17 17"/></svg>`;

function chipFor(r, A) {          // the layer list's row art: thumbnail, 'T' chip, mark chip or an audio glyph
  if (r.img) return thumb(A(r.img), 26, 15);
  if (r.kind === 'text') return `<div style="width:26px;height:15px;border-radius:2.5px;background:#F2F2F2;font:700 9px/15px Inter;text-align:center;color:${INK}">T</div>`;
  if (r.kind === 'mark') return `<div style="width:15px;height:15px;margin:0 5.5px">${lull()}</div>`;
  if (r.kind === 'audio') return `<div style="width:26px;height:15px;display:flex;align-items:center;justify-content:center;gap:2px">${r.muted ? mutedGlyph(r.state === 'selected' ? INK : GREY) : ''}${waveGlyph(GREY, 12)}</div>`;
  return `<div style="width:26px;height:15px;border-radius:2.5px;border:1px dashed #BDBDB8;box-sizing:border-box"></div>`;
}
function treeArt(r, A) {
  const chev = r.kind === 'folder' ? `<svg width="7" height="7" viewBox="0 0 7 7"><path d="${r.open !== false ? 'M1 2l2.5 3 2.5-3' : 'M2 1l3 2.5-3 2.5'}" fill="none" stroke="${GREY}" stroke-width="1"/></svg>` : '<span style="width:7px"></span>';
  const glyph = r.kind === 'folder' ? `<svg width="12" height="10" viewBox="0 0 11 9"><path d="M.5 1.5h3.2l1 1.2h5.8v5.8H.5z" fill="none" stroke="${GREY}" stroke-width=".9"/></svg>`
    : r.kind === 'seq' ? `<svg width="11" height="9" viewBox="0 0 11 9"><rect x=".5" y=".5" width="10" height="8" rx="1" fill="none" stroke="${GREY}" stroke-width=".9"/><path d="M2.5 3h4M2.5 5h6" stroke="${GREY}" stroke-width=".9"/></svg>`
    : r.kind === 'clip' ? `<svg width="11" height="9" viewBox="0 0 11 9"><rect x=".5" y=".5" width="10" height="8" rx="1" fill="none" stroke="${GREY}" stroke-width=".9"/><path d="M4.3 2.8l3 1.7-3 1.7z" fill="${GREY}"/></svg>`
    : r.kind === 'audio' ? waveGlyph(GREY, 11)
    : `<svg width="11" height="9" viewBox="0 0 11 9"><rect x=".5" y=".5" width="10" height="8" rx="1" fill="none" stroke="${GREY}" stroke-width=".9"/><path d="M1.5 7l3-3 2 2 1.5-1.5 2 2.5" stroke="${GREY}" stroke-width=".9" fill="none"/></svg>`;
  const art = r.name ? `<span class="t-tx" style="font:400 11px Inter;color:${INK};white-space:nowrap">${esc(r.name)}</span>`
    : r.img ? thumb(A(r.img), 35, 20, r.blue ? `box-shadow:0 0 0 1.4px ${BLUE}` : '')
    : r.kind === 'seq' ? `<div style="width:16px;height:16px">${lull()}</div>` : r.kind === 'audio' ? `<div style="width:35px;height:14px;border-radius:3px;background:#F2F2F2;display:flex;align-items:center;justify-content:center">${waveGlyph(GREY, 20)}</div>` : '';
  return `${chev}${glyph}${art}`;
}

export default {
  name: 'editor',
  doc: 'STORYBOARD STAND-IN: our master editor window at a framing (cx, cy, s): icon title bar + project name + run chip, Project panel (thumbnail rows), viewer (comp: clip · play · board · map · poster, her film The Lull), Alchemy panel (header + picture tiles), timeline with thumbnail rows (names only where given) and dashed planned rows; hf01 frame numbers via n0; heroAt picks the storyboard frame.',
  layers: 'window · cursor',
  // her helmet-cam clips playing in the viewer: shot field `film: [clip.mp4, …]` (+ `filmFrom: [s, …]`); a comp (or a
  // play clip) names one with `video: k` and plays it at `rate` (S13 half speed, S17 quarter speed)
  media: ['film'],
  params: {
    n0: 'first hf01 frame', heroAt: 'hf01 frame for the storyboard still', framing: '[cx, cy, s] on the 1080x608 master',
    comp: '{type: clip|play|board|map|poster, …}', layers: '[{in, out, kind, img, name, state, muted, n}]', props: '{after, rows: [{name, keys: [[t, n], …]}]}',
    tree: '[{kind, name, img, blue, depth, n}]', playhead: 'seconds, or [nA, secA, nB, secB]', cursor: '[[n, x, y], …] master px',
    onscreen: 'every readable string in the framing (storyboard copy line + reading time)',
    projectX: 'master x of the title-bar project name (default 40, the kit\'s position; S06 sets 286 so its framing shows the name it counts)',
  },
  copy: s => [].concat(s.onscreen || []).map(String),
  cues: () => [],
  hero: (s, D) => s.heroAt != null ? Math.max(0, Math.min(D - 1, s.heroAt - (s.n0 || 0))) : Math.round(D * .7),
  async build(ctx, s) {
    const { W } = ctx, K = W / 1080, n0 = s.n0 || 0, [fcx, fcy, fsc] = s.framing || [540, 304, 1];
    const comp = s.comp || {}, A = p => ctx.asset(p);
    // poster boxes are SHOTLIST screen px (1080x608) at this shot's framing -> comp px (the comp is x 286-794, y 51-337)
    const cx_ = xs => (xs - 540) / fsc + fcx - 286, cy_ = ys => (ys - 304) / fsc + fcy - 51;
    const box = (x0, x1, y0, y1) => `left:${cx_(x0).toFixed(2)}px;top:${cy_(y0).toFixed(2)}px;width:${((x1 - x0) / fsc).toFixed(2)}px;height:${((y1 - y0) / fsc).toFixed(2)}px`;
    const fz = px => (px / fsc).toFixed(2);
    const supHTML = (p, i, cls) => `<div class="${cls} ${cls}${i}" style="position:absolute;left:${p.x ?? 14}px;top:${p.y ?? 158}px;font:400 ${p.size || 14}px/1.1 ${AD};letter-spacing:.01em;color:${MOON};white-space:nowrap;text-shadow:0 1px 4px rgba(0,0,0,.55)">${esc(p.text)}</div>`;
    const bugHTML = b => b ? `<div style="position:absolute;left:${b[0] - b[2] / 2}px;top:${b[1] - b[2] / 2}px;width:${b[2]}px;height:${b[2]}px;opacity:.95">${lull()}</div>` : '';

    // ── the comp (508 x 286) ──
    let compHTML = '';
    if (comp.type === 'clip') {
      const M = comp.mark;
      compHTML = `<div style="position:absolute;inset:0;background:${NAVY}"><div style="position:absolute;left:10%;top:10%;right:10%;bottom:10%;border:1px dashed rgba(244,241,234,.35)"></div></div>
        <img class="c-img" src="${A(comp.img)}" style="position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover">
        <div class="c-ring" style="position:absolute;border-radius:50%;box-shadow:0 0 0 1.4px ${BLUE},0 0 7px 3px rgba(255,255,255,.75);opacity:0"></div>
        ${M ? `<div class="c-mk" style="position:absolute;border-radius:50%">${lull('c-svg')}</div><div class="c-word" style="position:absolute;transform:translateX(-50%);font:400 9px ${AD};letter-spacing:.32em;color:${MOON};white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,.4)">${esc(M.word || 'THE LULL')}</div>` : ''}
        ${bugHTML(comp.bug)}
        ${comp.super ? `<div class="c-sup" style="position:absolute;left:${comp.super.x}px;top:${comp.super.y}px;font:400 ${comp.super.size || 14}px/1.1 ${AD};color:${MOON};white-space:nowrap;text-shadow:0 1px 4px rgba(0,0,0,.5)"><span class="c-sut"></span><span class="c-car" style="display:inline-block;width:.8px;height:1em;background:#fff;vertical-align:-.12em"></span></div>
          <div class="c-fld" style="position:absolute;left:${comp.super.x - 3}px;top:${comp.super.y - 3}px;width:${comp.super.w}px;height:${(comp.super.size || 14) * 1.1 + 6}px;border:.8px solid rgba(255,255,255,.7)">${[[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => `<span style="position:absolute;${a ? 'right' : 'left'}:-2px;${b ? 'bottom' : 'top'}:-2px;width:3px;height:3px;background:#fff"></span>`).join('')}</div>` : ''}`;
    }
    if (comp.type === 'play') {
      compHTML = `${[].concat(comp.clips).map((c, i) => `<img class="p-img p${i}" src="${A(c.img)}" style="position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;transform-origin:50% 50%;${c.warm ? 'filter:sepia(.25) saturate(1.2) brightness(1.04)' : ''}">`).join('')}
        ${bugHTML(comp.bug)}${[].concat(comp.supers || []).map((p, i) => supHTML(p, i, 'p-sup')).join('')}`;
    }
    if (comp.type === 'board') {
      const tile = (x, y, w, h, inner, cls = '') => `<div class="b-tile ${cls}" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:7px;background:#fff;box-shadow:0 0 0 .7px #E2DED5;overflow:hidden">${inner}</div>`;
      const w4 = (508 - 32 - 30) / 4, w3 = (508 - 32 - 20) / 3;
      const sw = [NAVY, MOON, GOLD, LRED].map((c, i) => `<div class="${i === 3 ? 'b-red' : ''}" style="position:absolute;left:${10 + i * 24}px;top:34px;width:20px;height:44px;border-radius:4px;background:${c};${c === MOON ? 'box-shadow:inset 0 0 0 .7px #D9D4C8;' : ''}transform-origin:50% 50%"></div>`).join('');
      const wave = `<svg viewBox="0 0 112 110" width="100%" height="100%"><path class="b-wave" d="M6 58 ${Array.from({ length: 51 }, (_, i) => `L${6 + i * 2} ${58 + Math.sin(i * .2) * 14}`).join(' ')}" fill="none" stroke="${NAVY}" stroke-width="1.6" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1"/></svg>`;
      const typeTile = `<div style="position:absolute;left:16px;top:44px;width:62%;height:7px;border-radius:4px;background:#CFC8BA"></div><div style="position:absolute;left:16px;top:58px;width:40%;height:5px;border-radius:3px;background:#DDD7CB"></div>`;
      compHTML = `<div style="position:absolute;inset:0;background:${MOON}"></div><div class="b-scroll" style="position:absolute;left:0;top:0;width:508px;height:460px">
        <div style="position:absolute;left:16px;top:11px;font:500 8px Inter;letter-spacing:.02em;color:#8C877C">${esc(comp.eyebrow || 'Alchemy')}</div>
        ${tile(16, 30, w4, 110, `<div style="position:absolute;left:12px;top:18px;width:22px;height:22px">${bellX()}</div><div style="position:absolute;left:12px;top:56px;font:600 11px/1.1 Inter;color:${INK};white-space:nowrap">${esc(comp.sound)}</div>`)}
        ${tile(16 + (w4 + 10), 30, w4, 110, sw)}
        ${tile(16 + 2 * (w4 + 10), 30, w4, 110, `<img src="${A(comp.sunrise)}" style="width:100%;height:100%;object-fit:cover">`)}
        ${tile(16 + 3 * (w4 + 10), 30, w4, 110, wave)}
        ${tile(16, 152, w3, 110, `<img src="${A(comp.drift)}" style="width:100%;height:100%;object-fit:cover;opacity:.75"><div style="position:absolute;inset:4px;border:1.2px dashed ${MOON};border-radius:4px"></div>`)}
        ${tile(16 + (w3 + 10), 152, w3, 110, typeTile)}
        ${tile(16 + 2 * (w3 + 10), 152, w3, 110, `<img src="${A(comp.end)}" style="width:100%;height:100%;object-fit:cover">`, 'b-end')}
        <div class="b-hdl" style="position:absolute;left:${16 + 2 * (w3 + 10) - 2}px;top:150px;width:${w3 + 4}px;height:114px;opacity:0">${[[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => `<span style="position:absolute;${a ? 'right' : 'left'}:-3px;${b ? 'bottom' : 'top'}:-3px;width:6px;height:6px;background:#fff;box-shadow:0 0 0 1.2px ${BLUE}"></span>`).join('')}</div>
        <div class="b-dot" style="position:absolute;left:${16 + 2 * (w3 + 10) - 3}px;top:149px;width:${w3 + 6}px;height:116px;border:1.2px dotted ${BLUE};box-sizing:border-box;border-radius:8px;opacity:0"></div></div>`;
    }
    if (comp.type === 'map') {
      const M = comp;
      // isometric station (moon-white lines): the truss from the capsule port (lower left) to The Lull (upper right)
      const iso = (x, y) => [M.origin[0] + x * .87 - y * .87, M.origin[1] - x * .5 - y * .5];
      const P = (x, y) => iso(x, y).map(v => v.toFixed(1)).join(' ');
      const blockPath = (x, y, w, d, h) => { const a = iso(x, y), b = iso(x + w, y), c = iso(x + w, y + d), e = iso(x, y + d);
        return `M${a[0]} ${a[1]} L${b[0]} ${b[1]} L${c[0]} ${c[1]} L${e[0]} ${e[1]}Z M${a[0]} ${a[1]} L${a[0]} ${a[1] - h} L${b[0]} ${b[1] - h} L${b[0]} ${b[1]} M${b[0]} ${b[1] - h} L${c[0]} ${c[1] - h} L${c[0]} ${c[1]} M${a[0]} ${a[1] - h} L${e[0]} ${e[1] - h} L${c[0]} ${c[1] - h}`; };
      const lines = [
        `M${P(0, 0)} L${P(250, 0)}`, `M${P(0, 14)} L${P(250, 14)}`, ...Array.from({ length: 17 }, (_, i) => `M${P(i * 15, 0)} L${P(i * 15 + 15, 14)}`),
        blockPath(60, -6, 40, 26, 14), blockPath(130, -6, 34, 26, 14),
        `M${P(95, -10)} L${P(95, -70)} L${P(135, -70)} L${P(135, -10)}Z`, `M${P(95, 24)} L${P(95, 84)} L${P(135, 84)} L${P(135, 24)}Z`,
        `M${P(180, -10)} L${P(180, -60)} L${P(214, -60)} L${P(214, -10)}Z`, `M${P(180, 24)} L${P(180, 74)} L${P(214, 74)} L${P(214, 24)}Z`,
      ].join(' ');
      const lc = iso(272, 7), cap = iso(-14, 7);
      const pins = M.pins.map(p => ({ ...p, xy: iso(p.at[0], p.at[1]) }));
      const route = `M${pins.map(p => `${p.xy[0].toFixed(1)} ${(p.xy[1] - 6).toFixed(1)}`).join(' L')}`;
      const stars = Array.from({ length: 70 }, (_, i) => `<circle cx="${((Math.sin(i * 91.7) * .5 + .5) * 508).toFixed(1)}" cy="${((Math.sin(i * 37.3 + 1) * .5 + .5) * 286).toFixed(1)}" r="${(.4 + (i % 3) * .25).toFixed(2)}" fill="${MOON}" opacity=".5"/>`).join('');
      compHTML = `<div style="position:absolute;inset:0;background:${NAVY}"></div>
        <svg viewBox="0 0 508 286" width="508" height="286" style="position:absolute;left:0;top:0;overflow:visible">${stars}
          <path d="${lines}" fill="none" stroke="${MOON}" stroke-width=".8" stroke-linejoin="round" opacity=".9"/>
          <ellipse cx="${lc[0]}" cy="${lc[1] - 8}" rx="22" ry="14" fill="${GOLD}" fill-opacity=".9" stroke="${MOON}" stroke-width=".8"/><circle cx="${lc[0] + 6}" cy="${lc[1] - 10}" r="4.5" fill="${NAVY}" stroke="${MOON}" stroke-width=".9"/>
          <path d="M${cap[0] - 8} ${cap[1] + 3} L${cap[0] - 4} ${cap[1] - 9} L${cap[0] + 4} ${cap[1] - 9} L${cap[0] + 8} ${cap[1] + 3}Z" fill="none" stroke="${MOON}" stroke-width=".9"/>
          <path d="${route}" fill="none" stroke="${GOLD}" stroke-width="1.3" stroke-dasharray="2 2.4" stroke-linecap="round"/>
          ${M.cards.map((c, i) => { const p = pins[c.pin].xy; return `<path class="m-lead m${i}" d="M${p[0]} ${p[1] - 8} L${c.box[0] + c.box[2] / 2} ${c.box[1] + c.box[3]}" stroke="${GOLD}" stroke-width=".7" fill="none"/>`; }).join('')}
          ${pins.map((p, i) => `<g class="m-pin q${i}"><circle cx="${p.xy[0]}" cy="${p.xy[1] - 6}" r="4.2" fill="${p.open ? 'none' : GOLD}" stroke="${p.open ? MOON : GOLD}" stroke-width="1" ${p.open ? 'stroke-dasharray="1.6 1.4"' : ''}/><path d="M${p.xy[0]} ${p.xy[1] - 1.8} L${p.xy[0]} ${p.xy[1] + 2}" stroke="${p.open ? MOON : GOLD}" stroke-width="1"/></g>`).join('')}</svg>
        <div style="position:absolute;left:18px;top:14px;display:flex;align-items:center;gap:9px">
          <div style="font:400 15px/1 ${AD};letter-spacing:.24em;color:${GOLD};white-space:nowrap">${esc(M.title)}</div>
          <div style="padding:2.5px 6px;border-radius:7px;background:${MOON};font:500 7.5px/1 ${AD};letter-spacing:.12em;color:${NAVY};white-space:nowrap">${esc(M.chip)}</div></div>
        ${M.cards.map((c, i) => `<div class="m-card m${i}" style="position:absolute;left:${c.box[0]}px;top:${c.box[1]}px;width:${c.box[2]}px;height:${c.box[3]}px;border-radius:4px;box-shadow:0 0 0 1.4px ${MOON},0 3px 8px rgba(0,0,0,.4);overflow:hidden;background:#333"><img src="${A(c.img)}" style="width:100%;height:100%;object-fit:cover;display:block"></div>
          <div class="m-mq m${i}" style="position:absolute;left:${c.box[0] - 3}px;top:${c.box[1] - 3}px;width:${c.box[2] + 6}px;height:${c.box[3] + 6}px;border:1px dotted ${BLUE};box-sizing:border-box"></div>`).join('')}
        <div style="position:absolute;left:${M.suns[0]}px;top:${M.suns[1]}px;display:flex;gap:4px">${Array.from({ length: 16 }, () => `<div style="width:9px;height:9px">${sunIcon()}</div>`).join('')}</div>
        <div class="m-rules" style="position:absolute;left:${M.rules[0]}px;top:${M.rules[1]}px;width:${M.rules[2]}px;box-sizing:border-box;padding:6px 7px;border:1px solid ${MOON};border-radius:4px;display:flex;align-items:center;gap:5px">
          <svg width="9" height="9" viewBox="0 0 12 12" style="flex:none"><circle cx="6" cy="6" r="5.2" fill="none" stroke="${MOON}" stroke-width="1"/><path d="M6 5.2v3.4M6 3.3v.3" stroke="${MOON}" stroke-width="1.1" stroke-linecap="round"/></svg>
          <div class="m-bul" style="font:400 8px/1.15 ${AD};letter-spacing:.02em;color:${MOON};white-space:nowrap">${esc(M.rule)}</div></div>`;
    }
    if (comp.type === 'poster') {
      const P = comp;
      compHTML = `<div style="position:absolute;inset:0;background:${NAVY}"></div>
        <div class="q-photo" style="position:absolute;${box(...P.photoBox)};border-radius:${fz(8)}px;overflow:hidden;box-shadow:0 0 0 ${fz(3)}px ${MOON},0 ${fz(6)}px ${fz(16)}px rgba(0,0,0,.35);transform-origin:50% 50%"><img class="q-img" src="${A(P.photo)}" style="width:100%;height:100%;object-fit:cover;display:block"></div>
        <div class="q-mark" style="position:absolute;left:${(cx_(P.mark[0]) - P.mark[2] / fsc / 2).toFixed(1)}px;top:${(cy_(P.mark[1]) - P.mark[2] / fsc / 2).toFixed(1)}px;width:${fz(P.mark[2])}px;height:${fz(P.mark[2])}px">${lull()}</div>
        <div class="q-head" style="position:absolute;left:${cx_(P.headBox[0])}px;top:${cy_(P.headBox[2])}px;font:400 ${fz(P.headSize)}px/1 ${AD};letter-spacing:.2em;color:${MOON};white-space:nowrap"><span class="q-ht"></span></div>
        <div class="q-body" style="position:absolute;${box(...P.bodyBox)};font:400 ${fz(P.bodySize)}px/1.3 ${AD};color:${MOON}"><span class="q-bt"></span></div>
        <div class="q-pill" style="position:absolute;left:${cx_(P.pillBox[0])}px;top:${cy_(P.pillBox[2])}px;height:${fz(P.pillBox[3] - P.pillBox[2])}px;padding:0 ${fz(10)}px;border-radius:${fz(13)}px;background:${LRED};display:flex;align-items:center;font:500 ${fz(P.pillSize)}px/1 ${AD};letter-spacing:.04em;color:${MOON};white-space:nowrap;transform-origin:0 50%">${esc(P.pill)}</div>
        ${P.thumbs.map((t, i) => `<div class="q-th q${i}" style="position:absolute;${box(P.thumbX[i], P.thumbX[i] + P.thumbD, P.thumbY, P.thumbY + P.thumbD)};border-radius:50%;overflow:hidden;box-shadow:0 0 0 ${fz(2.5)}px ${MOON}"><img src="${A(t)}" style="width:100%;height:100%;object-fit:cover;display:block"></div>`).join('')}
        <div class="q-tag" style="position:absolute;${box(...P.tagBox)};transform-origin:0 0"><svg viewBox="0 0 112 84" width="100%" height="100%" preserveAspectRatio="none"><path d="M6 2h100a4 4 0 0 1 4 4v24a12 12 0 0 0 0 24v24a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V54a12 12 0 0 0 0-24V6a4 4 0 0 1 4-4z" fill="${MOON}"/><g transform="translate(34 20) scale(.44)"><path d="M72.2 64.4A30 30 0 1 1 38.9 24.4A26 26 0 0 0 72.2 64.4Z" fill="${NAVY}"/><circle cx="57" cy="43" r="8.5" fill="none" stroke="${NAVY}" stroke-width="4"/></g></svg></div>`;
    }

    // ── timeline rows ──
    const L = [].concat(s.layers || []), props = s.props;
    let rowsHTML = '', y = 4;
    L.forEach((l, i) => {
      const x0 = X0 + l.in * PX, x1 = X0 + l.out * PX, planned = l.state === 'planned';
      const bar = planned ? `border:1px dashed #BDBDB8;background:rgba(255,255,255,.6)` : `background:#D9D9D5;box-shadow:inset 0 0 0 1px #C9C9C4${l.state === 'selected' ? `,0 0 0 2px ${BLUE}` : ''}`;
      rowsHTML += `<div class="t-row r${i}" style="position:absolute;left:20px;top:${y}px;width:1040px;height:21px;border-bottom:1px solid #F4F4F4">
          <div style="position:absolute;right:${1040 - 268}px;top:3px;display:flex;align-items:center;gap:8px;white-space:nowrap">${l.name ? `<span style="font:500 10.5px Inter;color:${INK}">${esc(l.name)}</span>` : ''}${chipFor(l, A)}</div>
          <div class="t-bar" style="position:absolute;left:${x0 - 20}px;top:4px;width:${x1 - x0}px;height:13px;border-radius:3px;box-sizing:border-box;${bar};display:flex;align-items:center;justify-content:center">${planned ? `<span style="font:600 8px/1 Inter;color:#A8A8A2">?</span>` : ''}</div></div>`;
      y += 21;
      if (props && props.after === i) props.rows.forEach(p => {
        rowsHTML += `<div class="t-prop" style="position:absolute;left:20px;top:${y}px;width:1040px;height:21px;border-bottom:1px solid #F7F7F7">
            <div style="position:absolute;right:${1040 - 268 + 34}px;top:5px;font:500 9.5px Inter;color:#6B6B6B;white-space:nowrap">${esc(p.name)}</div>
            ${(p.keys || []).map(([t, kn]) => `<div class="t-key" data-n="${kn}" style="position:absolute;left:${X0 + t * PX - 20 - 3.5}px;top:6.5px;width:7px;height:7px;transform:rotate(45deg);background:#fff;box-shadow:inset 0 0 0 1.2px ${INK}"></div>`).join('')}</div>`;
        y += 21;
      });
    });
    const ruler = Array.from({ length: 61 }, (_, i) => `<div style="position:absolute;left:${X0 + i * PX / 2}px;top:${i % 10 ? 386 : 382}px;width:1px;height:${i % 10 ? 5 : 9}px;background:#C9C9C4"></div>`).join('');
    const tree = [].concat(s.tree || []).map((r, i) => `<div class="t-tree tr${i}" style="position:absolute;left:${34 + (r.depth || 0) * 12}px;top:${96 + i * 22}px;height:20px;display:flex;align-items:center;gap:6px">${treeArt(r, A)}</div>`).join('');
    const alch = `<div style="position:absolute;left:846px;top:76px;display:flex;gap:4px">${[NAVY, MOON, GOLD, LRED].map(c => `<div style="width:16px;height:16px;border-radius:3px;background:${c};box-shadow:inset 0 0 0 .6px #D9D4C8"></div>`).join('')}</div>
      <div style="position:absolute;left:846px;top:100px;display:flex;gap:5px">${thumb(A(s.alchThumbs ? s.alchThumbs[0] : 'assets/plates/A1-sunrise.png'), 40, 23)}${thumb(A(s.alchThumbs ? s.alchThumbs[1] : 'assets/plates/A4-lull.png'), 40, 23)}</div>
      <div style="position:absolute;left:846px;top:130px;width:85px;height:20px;border-radius:4px;background:#F4F4F4;display:flex;align-items:center;justify-content:center"><svg width="70" height="12" viewBox="0 0 70 12"><path d="M0 6 ${Array.from({ length: 35 }, (_, i) => `L${i * 2} ${6 + Math.sin(i * .35) * 4}`).join(' ')}" fill="none" stroke="${GREY}" stroke-width="1"/></svg></div>
      <div style="position:absolute;left:846px;top:156px;width:20px;height:20px;border-radius:4px;background:#F4F4F4;padding:3px;box-sizing:border-box">${bellX(GREY)}</div>`;
    const master = `
      <div style="position:absolute;left:-1200px;top:-800px;width:3480px;height:2208px;background:radial-gradient(#E3E3E3 .75px,transparent .95px) 0 0/9px 9px,#F7F7F7"></div>
      <div style="position:absolute;left:20px;top:16px;width:1040px;height:576px;border-radius:16px;background:#fff;box-shadow:0 0 0 1px #E6E6E6,0 12px 40px rgba(0,0,0,.10)"></div>
      <div style="position:absolute;left:20px;top:44px;width:1040px;height:1px;background:${LINE}"></div>
      <div style="position:absolute;left:${s.projectX ?? 40}px;top:24px;font:500 11px Inter;color:${INK};white-space:nowrap">${esc(s.project || 'The Lull')}</div>
      <div style="position:absolute;left:470px;top:21px;width:140px;height:18px;border-radius:9px;background:#F2F2F2;display:flex;align-items:center;justify-content:center">${aspectIcons(0)}</div>
      ${s.cloudChip === false ? '' : `<div style="position:absolute;left:862px;top:21px;width:98px;height:18px;border-radius:9px;background:#F2F2F2;display:flex;align-items:center;justify-content:center;gap:5px;font:500 9px Inter;color:${INK};white-space:nowrap"><svg width="12" height="9" viewBox="0 0 24 18" fill="none" stroke="${ICON}" stroke-width="2" stroke-linejoin="round"><path d="M7 16h11a4.5 4.5 0 0 0 .6-9 6.5 6.5 0 0 0-12.4 1.6A3.8 3.8 0 0 0 7 16z"/></svg>Cloud Computer</div>`}
      <div style="position:absolute;left:270px;top:44px;width:1px;height:314px;background:${LINE}"></div>
      <div style="position:absolute;left:34px;top:50px;padding-bottom:2px;box-shadow:inset 0 -1.5px 0 ${INK}"><svg width="13" height="11" viewBox="0 0 11 9"><path d="M.5 1.5h3.2l1 1.2h5.8v5.8H.5z" fill="none" stroke="${INK}" stroke-width=".9"/></svg></div>
      <div style="position:absolute;left:58px;top:50px"><svg width="13" height="11" viewBox="0 0 13 11" fill="none" stroke="${GREY}" stroke-width=".9" stroke-linecap="round"><path d="M1 2.5h11M1 5.5h11M1 8.5h11"/><circle cx="4" cy="2.5" r="1.3" fill="#fff"/><circle cx="9" cy="5.5" r="1.3" fill="#fff"/><circle cx="5.5" cy="8.5" r="1.3" fill="#fff"/></svg></div>
      <div style="position:absolute;left:32px;top:68px;width:226px;height:16px;border-radius:5px;background:#F4F4F4;display:flex;align-items:center;padding-left:7px;box-sizing:border-box"><svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="${GREY}" stroke-width="1.3"><circle cx="4.2" cy="4.2" r="3.2"/><path d="M6.6 6.6L9 9"/></svg></div>
      ${tree}
      <div style="position:absolute;left:276px;top:44px;width:528px;height:300px;background:#EEEEEE"></div>
      <div class="v-comp" style="position:absolute;left:286px;top:51px;width:508px;height:286px;overflow:hidden;background:#fff">${compHTML}</div>
      <svg style="position:absolute;left:290px;top:347px" width="9" height="10" viewBox="0 0 9 10"><path d="M1 1l7 4-7 4z" fill="${INK}"/></svg>
      <div style="position:absolute;left:306px;top:351px;width:480px;height:2px;border-radius:1px;background:#E3E3E3"></div><div class="v-knob" style="position:absolute;top:349px;width:6px;height:6px;border-radius:50%;background:${INK}"></div>
      <div style="position:absolute;left:804px;top:44px;width:1px;height:314px;background:${LINE}"></div>
      <div style="position:absolute;left:846px;top:54px;font:600 11px Inter;color:${INK}">Alchemy</div>${alch}
      <div style="position:absolute;left:20px;top:358px;width:1040px;height:1px;background:${LINE}"></div>
      <div style="position:absolute;left:300px;top:363px">${aspectIcons(0)}</div>
      <div style="position:absolute;left:20px;top:378px;width:1040px;height:14px;background:#FAFAFA"></div>${ruler}
      <div style="position:absolute;left:294px;top:378px;width:1px;height:214px;background:${LINE}"></div>
      <div style="position:absolute;left:0;top:392px;width:1080px;height:200px;overflow:hidden"><div class="t-rows" style="position:absolute;left:0;top:0;width:1080px;transform:translateY(${-(s.rowScroll || 0) * 21}px)">${rowsHTML}</div></div>
      <div class="t-ph" style="position:absolute;top:378px;width:1.5px;height:214px;background:${BLUE}"><div style="position:absolute;left:-3.5px;top:0;width:8px;height:6px;border-radius:1px;background:${BLUE}"></div></div>
      <div style="position:absolute;left:20px;top:16px;width:1040px;height:576px;border-radius:16px;box-shadow:0 0 0 1px #E6E6E6;pointer-events:none"></div>`;
    const m = ctx.el(master, `left:0;top:0;width:1080px;height:608px;transform-origin:0 0`, 'window');
    m.classList.add('lv-ui');
    const cur = ctx.el(`<svg width="${30 * K / 1.7778}" height="${37 * K / 1.7778}" viewBox="0 0 32 39" style="display:block;overflow:visible;filter:drop-shadow(0 1.6px 2.4px rgba(0,0,0,.3))"><path d="M3.5 2.5V30.6L9.9 24.6L14.6 35.4L19.6 33.3L14.9 22.7H23.8Z" fill="#050505" stroke="#fff" stroke-width="2.6" stroke-linejoin="round" paint-order="stroke"/></svg>`, 'left:0;top:0;opacity:0', 'cursor');
    await Promise.all([...ctx.root.querySelectorAll('img')].map(im => im.decode().catch(() => null)));
    const q = sel => m.querySelector(sel), qa = sel => [...m.querySelectorAll(sel)];
    // footage in the viewer: swap the still for the clip's frame element, keeping its class and style
    const FILM = await Promise.all([].concat(s.film || []).map((_, i) => ctx.footage('film', { i })));
    const vids = [];
    const toVideo = (el, k, rate) => {
      const v = FILM[k];
      if (!v || !el) return;
      v.img.className = el.className; v.img.style.cssText = el.style.cssText;
      el.replaceWith(v.img); vids.push({ v, rate: rate ?? 1 });
    };
    if (comp.type === 'clip' && comp.video != null) toVideo(q('.c-img'), comp.video, comp.rate);
    if (comp.type === 'play') [].concat(comp.clips).forEach((c, i) => { if (c.video != null) toVideo(q(`.p${i}`), c.video, c.rate); });
    const rows = qa('.t-row'), keys = qa('.t-key'), trees = qa('.t-tree');
    const span = (v, n) => Array.isArray(v) ? lerp(v[1], v[3], u01(n, v[0], v[2])) : v;
    // poster: fit the headline to its box width
    if (comp.type === 'poster') { const hd = q('.q-head'), ht = q('.q-ht'); ht.textContent = comp.headline; const want = (comp.headBox[1] - comp.headBox[0]) / fsc; if (hd.offsetWidth > want) hd.style.fontSize = `${parseFloat(hd.style.fontSize) * want / hd.offsetWidth}px`; ht.textContent = ''; }
    return {
      async render(t) {
        const n = n0 + t;
        for (const { v, rate } of vids) await v.frame(t * rate);
        let [cx, cy, sc] = [fcx, fcy, fsc];
        if (s.cam) {
          const ks = s.cam; let a = ks[0], b = ks[ks.length - 1];
          for (let i = 0; i < ks.length - 1; i++) if (n >= ks[i][0] && n <= ks[i + 1][0]) { a = ks[i]; b = ks[i + 1]; }
          const e = ease(u01(n, a[0], b[0])); cx = lerp(a[1], b[1], e); cy = lerp(a[2], b[2], e); sc = lerp(a[3], b[3], e);
        }
        const a = K * sc;
        m.style.transform = `matrix(${a.toFixed(5)},0,0,${a.toFixed(5)},${(K * (540 - cx * sc)).toFixed(2)},${(K * (304 - cy * sc)).toFixed(2)})`;
        rows.forEach((r, i) => { const l = L[i], on = l.n == null || n >= l.n, ap = l.n != null ? u01(n, l.n, l.n + 1.5) : 1; r.style.opacity = on ? lerp(.5, 1, ap).toFixed(3) : 0; r.style.transform = `translateY(${((1 - ap) * 7).toFixed(2)}px)`; });
        keys.forEach(kd => { const kn = Number(kd.dataset.n); const p = u01(n, kn, kn + 3); kd.style.opacity = n >= kn ? 1 : 0; kd.style.transform = `rotate(45deg) scale(${lerp(1.4, 1, p).toFixed(3)})`; });
        trees.forEach((r, i) => { const tr = s.tree[i]; const ap = tr.n != null ? u01(n, tr.n, tr.n + 3) : 1; r.style.opacity = ap > 0 ? 1 : 0; r.style.transform = `translateX(${((1 - ap) * -12).toFixed(2)}px)`; });
        const ph = span(s.playhead ?? 0, n);
        q('.t-ph').style.left = `${X0 + ph * PX - .75}px`;
        q('.v-knob').style.left = `${306 + 480 * ph / 30 - 3}px`;
        if (comp.type === 'clip') {
          const R = comp.reveal, img = q('.c-img'), ring = q('.c-ring');
          if (R) {
            const g = u01(n, R.n, R.n1), rad = n < R.n ? 0 : lerp(R.r0, R.r1, g), fade = u01(n, R.n1, R.n1 + 8);
            img.style.clipPath = fade >= 1 ? 'none' : `circle(${(n < R.n ? 0 : rad + fade * 200).toFixed(1)}px at ${R.at[0]}px ${R.at[1]}px)`;
            ring.style.opacity = n >= R.n && fade < 1 ? (1 - fade).toFixed(3) : 0;
            ring.style.left = `${R.at[0] - rad}px`; ring.style.top = `${R.at[1] - rad}px`; ring.style.width = ring.style.height = `${2 * rad}px`;
          }
          const M = comp.mark;
          if (M) {
            const mk = q('.c-mk'), mv = outCubic(u01(n, M.move[0], M.move[1])), d = lerp(M.from[2], M.to[2], mv), x = lerp(M.from[0], M.to[0], mv), yy = lerp(M.from[1], M.to[1], mv);
            mk.style.left = `${x - d / 2}px`; mk.style.top = `${yy - d / 2}px`; mk.style.width = mk.style.height = `${d}px`;
            const P = M.parts || {}, on = (sel, nn) => { const e = q(sel); if (e) e.style.opacity = nn == null || n >= nn ? 1 : 0; };
            on('.c-svg .lm-cres', P.cres); on('.c-svg .lm-win', P.win); on('.c-svg .lm-stars', P.stars);
            q('.c-svg .lm-rim').setAttribute('stroke-width', P.rim != null && n >= P.rim ? 3.2 : 2.2);
            mk.style.boxShadow = P.glow != null && n >= P.glow ? `0 0 ${(d * .25).toFixed(1)}px ${(d * .06).toFixed(1)}px rgba(232,194,122,${(.55 * u01(n, P.glow, P.glow + 2)).toFixed(2)})` : 'none';
            const wd = q('.c-word'); wd.style.left = `${x}px`; wd.style.top = `${yy + d / 2 + 6}px`; wd.style.opacity = P.word != null && n >= P.word ? 1 : 0;
          }
          if (comp.super) {
            const S = comp.super, ch = Array.from(S.text), kk = Math.round(ch.length * u01(n, S.typed[0], S.typed[1]));
            q('.c-sut').textContent = ch.slice(0, kk).join('');
            q('.c-car').style.opacity = n < S.deselect ? 1 : 0; q('.c-fld').style.opacity = n >= S.typed[0] - 1 && n < S.deselect ? 1 : 0;
          }
        }
        if (comp.type === 'play') {
          [].concat(comp.clips).forEach((c, i) => { const on = n >= (c.from ?? -1e9) && n < (c.until ?? 1e9); const im = q(`.p${i}`); im.style.opacity = on ? 1 : 0; im.style.transform = `scale(${(1.02 + .0015 * (n - n0)).toFixed(4)})`; });
          [].concat(comp.supers || []).forEach((p, i) => { q(`.p-sup${i}`).style.opacity = n < p.n ? 0 : n >= (p.end ?? 1e9) ? 0 : u01(n, p.n, p.n + (p.fade || 1)).toFixed(3); });
        }
        if (comp.type === 'board') {
          const sc2 = ease(u01(n, comp.whip[0], comp.whip[1]));
          q('.b-scroll').style.transform = `translate(0px,${(-comp.whipBy * sc2).toFixed(2)}px)`;
          const pp = u01(n, comp.redPop, comp.redPop + 9); q('.b-red').style.transform = `scale(${(n < comp.redPop ? .62 : 1 + .37 * Math.sin(Math.PI * Math.min(1, pp * 1.4)) * (1 - pp)).toFixed(3)})`;
          q('.b-wave').setAttribute('stroke-dashoffset', (1 - u01(n, comp.wave[0], comp.wave[1])).toFixed(4));
          q('.b-hdl').style.opacity = n >= comp.handles[0] && n < comp.handles[1] + 4 ? 1 : 0;
          q('.b-dot').style.opacity = n >= comp.dotted ? 1 : 0;
        }
        if (comp.type === 'map') {
          comp.cards.forEach((c, i) => { const done = n >= c.at[1]; qa(`.m-card.m${i}, .m-lead.m${i}`).forEach(e => { e.style.opacity = done ? 1 : n >= c.at[0] ? .35 : 0; }); qa(`.m-mq.m${i}`).forEach(e => { e.style.opacity = n >= c.at[0] && n < c.at[1] + 2 ? 1 : 0; }); });
          comp.pins.forEach((p, i) => { const g = q(`.m-pin.q${i}`); const pu = p.pulse != null ? Math.max(0, 1 - Math.abs(n - p.pulse - 2) / 3) : 0; g.style.transformOrigin = 'center'; g.style.transformBox = 'fill-box'; g.style.transform = `scale(${(1 + .5 * pu).toFixed(3)})`; });
          const rp = u01(n, comp.rulesAt[0], comp.rulesAt[1]); const rb = q('.m-rules'); rb.style.opacity = n >= comp.rulesAt[0] ? 1 : 0; rb.style.transform = `scale(${lerp(.7, 1, outCubic(rp)).toFixed(3)})`;
          const bt = q('.m-bul'); bt.style.clipPath = `inset(0 ${(100 * (1 - u01(n, comp.ruleType[0], comp.ruleType[1]))).toFixed(1)}% 0 0)`;
        }
        if (comp.type === 'poster') {
          const P = comp, at = P.at, show = (sel, nn) => { const e = q(sel); if (e) e.style.opacity = n >= nn ? 1 : 0; };
          const ph2 = q('.q-photo'), gk = u01(n, at.photo, at.photo + 6); ph2.style.opacity = n >= at.photo ? 1 : 0; ph2.style.transform = `scale(${lerp(.38, 1, outCubic(gk)).toFixed(3)})`;
          const rr = lerp(10.5, 335, u01(n, at.photo, at.photoFull)) / fsc; q('.q-img').style.clipPath = n >= at.photoFull ? 'none' : `circle(${rr.toFixed(1)}px at ${(cx_(620) - cx_(P.photoBox[0])).toFixed(1)}px ${(cy_(234) - cy_(P.photoBox[2])).toFixed(1)}px)`;
          show('.q-mark', at.mark);
          const hc = Array.from(P.headline), hk = Math.round(hc.length * u01(n, at.headline[0], at.headline[1])); q('.q-ht').textContent = hc.slice(0, hk).join('');
          const bc = Array.from(P.body), bk = Math.round(bc.length * u01(n, at.body[0], at.body[1])); q('.q-bt').textContent = bc.slice(0, bk).join('');
          const pl = q('.q-pill'), pp = u01(n, at.pill[0], at.pill[1]); pl.style.opacity = n >= at.pill[0] ? 1 : 0; pl.style.transform = `scale(${(n < at.pill[0] ? .5 : pp < .7 ? lerp(.5, 1.08, pp / .7) : lerp(1.08, 1, (pp - .7) / .3)).toFixed(3)})`;
          at.thumbs.forEach((nn, i) => show(`.q-th.q${i}`, nn));
          const tg = q('.q-tag'), rs = u01(n, at.tag[0] + 2, at.tag[1]); tg.style.opacity = n >= at.tag[0] ? 1 : 0; tg.style.transform = `scale(${lerp(.3, 1, outCubic(rs)).toFixed(3)})`;
        }
        if (s.cursor && s.cursor.length) {
          const C = s.cursor; let p = C[0];
          for (let i = 0; i < C.length; i++) if (n >= C[i][0]) p = C[i];
          const nx = C.find(c => c[0] > n), hop = nx ? u01(n, nx[0] - 2, nx[0]) : 0;
          const x = lerp(p[1], nx ? nx[1] : p[1], hop), yv = lerp(p[2], nx ? nx[2] : p[2], hop);
          cur.style.opacity = n >= C[0][0] - 2 && n <= (s.cursorEnd ?? 1e9) ? 1 : 0;
          cur.style.transform = `translate(${(K * ((x - cx) * sc + 540)).toFixed(2)}px,${(K * ((yv - cy) * sc + 304)).toFixed(2)}px)`;
        }
      },
    };
  },
};
