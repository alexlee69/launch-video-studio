// Film helpers, shared by the film-kit blocks (scene · agent · roster · type · lockup · stack · wall). Planning helpers
// (at, rng, hash, plain, stream) are pure JS so cues() can run them in Node; render helpers take the engine's K / A from
// ctx. Nothing touches the DOM at import time.
export const F = {
  // `at:` fields: a local 30-fps frame (45) or seconds ("1.5s")
  at(v, fallback = 0, what = 'at') {
    if (v == null || v === '') return fallback;
    const m = String(v).trim().match(/^(\d+(?:\.\d+)?)\s*(s|sec)?$/);
    if (!m) throw new Error(`${what} must be a frame number (30 per second) or seconds like 1.5s (got ${JSON.stringify(v)})`);
    return m[2] ? Number(m[1]) * 30 : Number(m[1]);
  },
  hash(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; },
  rng(seed) { let s = seed | 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; },
  plain: text => String(text ?? '').replace(/\|/g, ' ').replace(/\*/g, '').replace(/\s+/g, ' ').trim(),
  clamp: (x, a = 0, b = 1) => x < a ? a : x > b ? b : x,
  isVideo: p => /\.(mp4|mov|m4v|webm|mkv)$/i.test(String(p || '')),
  hasBg: s => s.bg != null && s.bg !== false && String(s.bg).trim() !== '' && String(s.bg).toLowerCase() !== 'none',
  // agent / roster draw light UI in dark ink: over bg footage or on a theme: dark shot it doesn't read (a --grid warning
  // until they get a dark treatment)
  lightOnly: (s, what) => F.hasBg(s) || s.theme === 'dark' ? [`${what} ${s.id}: ${what} is light UI in dark ink and doesn't turn light-on-dark yet — ${F.hasBg(s) ? 'over bg footage' : 'on a theme: dark shot'} its copy won't read; leave ${F.hasBg(s) ? 'bg' : 'theme: dark'} off this shot`] : [],
  // footage frames the engine extracted for a field (60 fps JPEGs): `src` → plates[shot id] (the media block),
  // any other declared media: field → plates[`${id}:${field}`] (list items: `${id}:cards.3`)
  plate: (ctx, s, field) => (ctx.plates || {})[field === 'src' ? s.id : `${s.id}:${field}`],
  // an <img> for an image asset or footage; frame(t) swaps the footage frame (await it in render)
  media(ctx, s, field, src, css = '') {
    const img = document.createElement('img');
    img.style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;display:block;${css}`;
    const video = F.isVideo(src), plate = video ? F.plate(ctx, s, field) : null;
    if (video && !plate) throw new Error(`${s.block} ${s.id}: ${field} is footage (${src}) but no frames were extracted for it — declare the field in the block's media: list`);
    img.src = video ? plate.url(0) : ctx.asset(src);
    let last = img.src;
    return {
      img, video,
      ready: () => img.decode().catch(() => null),
      async frame(t) {
        if (video) {
          const want = plate.url(Math.min(plate.n - 1, Math.max(0, Math.round(t * 2))));
          if (want !== last) { img.src = want; last = want; await img.decode().catch(() => null); }
        } else if (!img.complete) await img.decode().catch(() => null);
      },
    };
  },
  // place a w×h box at a named position (top-left … bottom-right) inside area (default ctx.safe), or centred on [x, y]
  // (fractions of the frame, clamped inside the area); returns its top-left corner
  POS: ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'],
  place(ctx, pos, w, h, area = ctx.safe) {
    if (Array.isArray(pos)) {
      const x = Number(pos[0]) * ctx.W - w / 2, y = Number(pos[1]) * ctx.H - h / 2;
      return { x: Math.max(area.x0, Math.min(area.x1 - w, x)), y: Math.max(area.y0, Math.min(area.y1 - h, y)) };
    }
    const p = String(pos || 'center'), hx = /left/.test(p) ? 0 : /right/.test(p) ? 1 : .5, vy = /^top/.test(p) ? 0 : /^bottom/.test(p) ? 1 : .5;
    return { x: area.x0 + (area.x1 - area.x0 - w) * hx, y: area.y0 + (area.y1 - area.y0 - h) * vy };
  },
  // LLM-style stream: words arrive in chunks of 1–3 with uneven gaps (and a short stall now and then), deterministic
  // per text; rate = words per second; fast: a fast stream's stalls shrink with its rate (agent replies). Returns the
  // arrival frame of every word and the frame the last one lands.
  stream(text, t0, rate = 9, fast = false) {
    const words = F.plain(text).split(/\s+/).filter(Boolean), r = F.rng(F.hash(String(text)) ^ 0x51ed);
    const times = [];
    let t = t0, i = 0;
    while (i < words.length) {
      const n = Math.min(words.length - i, 1 + Math.floor(r() * 3));
      for (let k = 0; k < n; k++) times.push(t);
      i += n;
      t += n * 30 / rate * (.55 + r() * .9) + (r() < .12 ? (fast ? 5 * Math.min(1, 10 / rate) : 5) : 0);
    }
    return { words, times, end: times.length ? times[times.length - 1] : t0 };
  },
  // markup for streamed copy: one span per word (*accent* words take the accent colour); spaces stay text
  streamHTML(ctx, text, accent) {
    return ctx.K.parseCopy(String(text || '')).map(p => p.br ? '<br>' : p.text.split(/(\s+)/).map(w => /^\s+$/.test(w) ? w : w ? `<span class="fw"${p.accent ? ` data-acc="1" style="color:${accent}"` : ''}>${ctx.A.esc(w)}</span>` : '').join('')).join('');
  },
  // drive streamed spans: an arrived word fades in light grey and darkens to ink over ~10 frames; returns the last arrived span
  streamAt(K, spans, times, t, grey, ink) {
    let last = null;
    const g = F.rgbOf(grey), k0 = F.rgbOf(ink);
    spans.forEach((sp, i) => {
      const a = t - times[i];
      if (a < 0) { sp.style.opacity = 0; return; }
      last = sp;
      const k = K.outCubic(K.clamp(a / 10));
      sp.style.opacity = K.clamp(.2 + a / 3).toFixed(3);
      if (!sp.dataset.acc) sp.style.color = `rgb(${g.map((v, j) => Math.round(v + (k0[j] - v) * k)).join(',')})`;
    });
    return last;
  },
  rgb(hex) { const n = parseInt(String(hex).slice(1), 16); return `rgb(${n >> 16},${n >> 8 & 255},${n & 255})`; },
  rgbOf: c => /^#/.test(c) ? [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)) : c.match(/[\d.]+/g).slice(0, 3).map(Number),
  // avatar for a mascot field: cast index → blob character with a face; 'logo' → the brand logo; 'spark' → spark spinner
  mascot(ctx, v, size, mood = 'smile') {
    if (v === 'logo') return ctx.logo(size);
    if (v === 'spark') return F.spark(size, ctx.brand.colors.accent);
    return ctx.A.bud(ctx.cast(Number(v) || 0), size, mood);
  },
  // spark spinner: 8 rays that breathe in sequence (animated by length, never by rotating the element)
  spark(size, col) {
    const c = size / 2, rays = Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4 - Math.PI / 2; return `<line class="fs-ray" data-a="${a.toFixed(4)}" x1="${c}" y1="${c}" x2="${c}" y2="${c}" stroke="${col}" stroke-width="${(size * .12).toFixed(2)}" stroke-linecap="round"/>`; }).join('');
    return `<svg class="fs-spark" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;overflow:visible" data-s="${size}">${rays}<circle cx="${c}" cy="${c}" r="${(size * .08).toFixed(2)}" fill="${col}"/></svg>`;
  },
  sparkAt(root, t) {
    for (const svg of root.querySelectorAll('.fs-spark')) {
      const s = Number(svg.dataset.s), c = s / 2;
      svg.querySelectorAll('.fs-ray').forEach((ln, i) => {
        const a = Number(ln.dataset.a), k = .5 + .5 * Math.sin(t * .32 - i * .785), r0 = s * .2, r1 = s * (.3 + .2 * k);
        ln.setAttribute('x1', (c + Math.cos(a) * r0).toFixed(2)); ln.setAttribute('y1', (c + Math.sin(a) * r0).toFixed(2));
        ln.setAttribute('x2', (c + Math.cos(a) * r1).toFixed(2)); ln.setAttribute('y2', (c + Math.sin(a) * r1).toFixed(2));
        ln.style.opacity = (.45 + .55 * k).toFixed(3);
      });
    }
  },
  // shimmering status text (a light band sweeps across the glyphs)
  shimmerCss: (base, hi) => `background:linear-gradient(100deg,${base} 0%,${base} 38%,${hi} 50%,${base} 62%,${base} 100%);background-size:280% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;`,
  shimmerAt(el, t, period = 34) { el.style.backgroundPosition = `${(130 - ((((t % period) + period) % period) / period) * 160).toFixed(2)}% 0`; },
  check: (size, col) => `<svg width="${size}" height="${size}" viewBox="0 0 26 26" style="display:block"><circle cx="13" cy="13" r="13" fill="${col}"/><path d="M7.5 13.5l4 4 7-8" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  // a status pill: a mascot avatar overlapping its left end, shimmering text (scene / stack). fs = text size in px
  pill(ctx, text, mascot, fs, dark = false) {
    const m = fs * 2.6, ink = dark ? '#FFFFFF' : '#1A1A20', hi = dark ? 'rgba(255,255,255,.32)' : '#B4B7C4';
    return `<div class="lv-ui" style="position:relative;display:flex;align-items:center;font-family:${ctx.font}">
      ${mascot != null ? `<div class="fp-m" style="position:relative;width:${m}px;height:${m}px;flex:none;z-index:1">${F.mascot(ctx, mascot, m, 'open')}</div>` : ''}
      <div class="fp-b" style="margin-left:${mascot != null ? -m * .3 : 0}px;padding:${fs * .62}px ${fs * 1.05}px ${fs * .62}px ${mascot != null ? m * .44 : fs * 1.05}px;border-radius:99px;background:${dark ? 'rgba(22,22,28,.88)' : '#FFFFFF'};box-shadow:0 ${fs * .5}px ${fs * 1.6}px rgba(10,12,30,.22),0 0 0 1px ${dark ? 'rgba(255,255,255,.12)' : 'rgba(17,17,20,.06)'};transform-origin:0 50%">
        <span class="lv-txt fp-t" style="position:relative;display:inline-block;white-space:nowrap;font-weight:600;font-size:${fs}px;line-height:1.25;${F.shimmerCss(ink, hi)}">${ctx.A.esc(text)}</span></div></div>`;
  },
  // pill entrance at t0 (mascot pops, the pill stretches out of it, the text shimmers); m = mascot size
  pillAt(K, el, m, t, t0, out = 1) {
    const mk = el.querySelector('.fp-m'), b = el.querySelector('.fp-b'), tx = el.querySelector('.fp-t');
    const pb = K.outBack(K.u01(t, t0 + 2, t0 + 13), 1.2);
    if (mk) {
      const pm = K.outBack(K.u01(t, t0, t0 + 10)), bob = t >= t0 + 10 ? -m * .05 * (.5 + .5 * Math.sin((t - t0 - 10) * .22)) : 0;
      mk.style.opacity = (K.clamp(K.u01(t, t0, t0 + 3)) * out).toFixed(3);
      mk.style.transform = `translateY(${bob.toFixed(2)}px) scale(${pm.toFixed(4)})`;
    }
    b.style.transform = pb >= 1 && t > t0 + 14 ? 'none' : `scale(${K.lerp(.55, 1, K.clamp(pb, 0, 1.05)).toFixed(4)},${K.lerp(.8, 1, K.clamp(pb, 0, 1.05)).toFixed(4)})`;
    b.style.opacity = (K.clamp(K.u01(t, t0 + 2, t0 + 6)) * out).toFixed(3);
    tx.style.opacity = K.clamp(K.u01(t, t0 + 5, t0 + 10)).toFixed(3);
    F.shimmerAt(tx, t - t0);
    F.sparkAt(el, t);
  },
  // directional (motion) blur: an SVG filter kept in the stage's #lv-fx defs (outside every layer, like the camera's own);
  // returns set(sx, sy) → the CSS filter value ('' when still)
  dirBlur(id) {
    const ns = 'http://www.w3.org/2000/svg', host = document.querySelector('#lv-fx defs') || document.body.appendChild(document.createElementNS(ns, 'svg')).appendChild(document.createElementNS(ns, 'defs'));
    let g = document.getElementById(id) && document.getElementById(id).firstChild;
    if (!g) {
      const fl = document.createElementNS(ns, 'filter');
      for (const [k, v] of [['id', id], ['filterUnits', 'userSpaceOnUse'], ['x', -2000], ['y', -2000], ['width', 6000], ['height', 6000], ['color-interpolation-filters', 'sRGB']]) fl.setAttribute(k, v);
      g = document.createElementNS(ns, 'feGaussianBlur'); fl.appendChild(g); host.appendChild(fl);
    }
    return (sx, sy) => { if (sx < .05 && sy < .05) return ''; g.setAttribute('stdDeviation', `${sx.toFixed(3)} ${sy.toFixed(3)}`); return `url(#${id})`; };
  },
  blur: px => px > .05 ? `blur(${px.toFixed(2)}px)` : '',
  filt: (...p) => p.filter(Boolean).join(' ') || 'none',
};
