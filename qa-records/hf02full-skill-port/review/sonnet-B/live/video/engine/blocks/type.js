// type — kinetic lockup type: a big 1–2 line name settles in (tracking closes, scale and blur settle, a glint), with an
// optional small co-brand line above and an accent pill under it; optional footage behind (the shot's `bg`, drawn by the
// engine). With `through: true` the whole lockup zooms THROUGH the camera over the shot's last ~10 frames with a heavy
// zoom blur (trailing ghosts), and the footage pushes in with it (bgMotion).
import { F } from './_film.js';

// serif = a system serif (macOS: Bodoni 72 / Didot; else Georgia) — no font file ships with the kit
const FACES = { sans: null, brand: null, serif: '"Bodoni 72", Didot, Georgia, "Times New Roman", serif' };
const thr = s => s.through === true ? 10 : Math.max(0, Number(s.through) || 0);

// every line a viewer reads, in order (timeline: captions SRT, reading time, storyboard, review sheet)
const copyOf = s => [s.over, s.text, s.pill].filter(x => x != null && String(x).trim() !== '').map(String);

export default {
  name: 'type',
  doc: 'Kinetic lockup type: a big 1–2 line name settles (tracking, scale, blur, a glint) with an optional co-brand line above and an accent pill under; optional footage behind; through: true zooms it through the camera with heavy blur at the end.',
  layers: 'over · headline · pill (the engine adds footage under them and letterbox on top)',
  media: [],
  bgDefaults: { bgDim: .15, bgMove: 'in' },
  copy: copyOf,
  // the footage pushes in with the zoom-through (extra scale on top of its own move; pure in t)
  bgMotion: (ctx, s) => (t, D) => { const TH = thr(s), z = TH ? ctx.K.u01(t, D - TH, D) : 0; return { s: 1 + .14 * z * z }; },
  params: {
    text: '1–2 lines (| breaks, *accent* ok)', face: 'sans (default) | serif (system serif: Bodoni 72 / Didot / Georgia) | brand (brand.font)',
    over: 'small co-brand line above, e.g. "Orbit × Acme" (the brand logo leads it; overLogo: false to drop it)', pill: 'accent pill under the text (*word* = italic)',
    through: 'true (last 10 frames) or a frame count: the lockup zooms through the camera (cut to the next shot after it)', bg: '(any shot) footage or an image behind the type (bgDim default .15, bgMove default in, letterbox)',
  },
  required: ['text'],
  validate: (s, D) => thr(s) && D - thr(s) < 28 ? [`type ${s.id}: the zoom-through takes ${thr(s)} of ${D} frames — the type barely settles; lengthen the shot`] : [],
  cues: (s, D) => [{ t: 0, kind: 'hit', note: 86, gain: .7 }, ...(s.pill ? [{ t: 11, kind: 'pop', note: 84, gain: .7 }] : [])],
  hero: (s, D) => Math.max(8, Math.min(D - thr(s) - 2, 34)),
  async build(ctx, s) {
    const { W, H, u, K, A, safe, portrait } = ctx, B = ctx.brand.colors;
    const light = !ctx.dark, ink = light ? B.ink : '#FFFFFF', acc = light ? B.accent : (B.accentOnDark || B.accent);
    const face = s.face || 'sans', fam = FACES[face] || ctx.font, serif = face === 'serif';
    const lines = String(s.text || '').split('|').length;
    const size = (serif ? (lines > 1 ? 168 : 224) : (lines > 1 ? 150 : 196)) * (lines > 1 ? (portrait ? .64 : ctx.square ? .7 : 1) : (portrait ? .82 : ctx.square ? .92 : 1));
    const ls0 = serif ? '-.025em' : '-.045em';
    // a tagged wrapper per element: the tracking animates, so After Effects gets the baked text (live text can't key tracking)
    const wrap = name => ctx.el('', 'left:0;top:0;width:0;height:0', name);
    const overW = s.over ? wrap('over') : null, headW = wrap('headline'), pillW = s.pill ? wrap('pill') : null;
    const head = ctx.text(s.text, { size, weight: serif ? 400 : 700, align: 'center', maxW: safe.w * .94, lines: 2, min: 70, ls: ls0, lh: serif ? 1 : .98, color: ink, accent: acc, parent: headW,
      style: `font-family:${fam};${serif ? 'font-weight:400;' : ''}` });
    head.style.width = safe.w + 'px'; head.style.left = safe.x0 + 'px';
    // zoom-blur ghosts (plain copies, not text boxes): only visible during the zoom-through
    const ghosts = thr(s) ? [1, 2, 3].map(() => { const g = head.cloneNode(true); g.className = ''; g.style.opacity = 0; headW.appendChild(g); return g; }) : [];
    let over = null, pill = null;
    if (s.over) {
      over = document.createElement('div');
      over.style.cssText = `position:absolute;left:0;top:0;width:${W}px;display:flex;justify-content:center;align-items:center;gap:${14 * u}px`;
      overW.appendChild(over);
      if (s.overLogo !== false) { const lg = document.createElement('div'); lg.style.cssText = 'position:relative;flex:none'; lg.innerHTML = ctx.logo(54 * u, !light); over.appendChild(lg); }
      const ot = ctx.text(s.over, { size: 46, weight: 600, nowrap: true, ls: '-.01em', color: ink, accent: acc, parent: over, style: light ? '' : 'text-shadow:0 2px 14px rgba(0,0,0,.35);' });
      ot.style.position = 'relative';
    }
    if (s.pill) {
      const pfs = (portrait ? 50 : 56) * u;
      pill = document.createElement('div');
      pill.className = 'lv-txt';
      pill.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;padding:${pfs * .16}px ${pfs * .62}px ${pfs * .2}px;border-radius:${pfs * .34}px;background:${B.accent};color:#fff;font:600 ${pfs}px ${ctx.font};letter-spacing:-.01em;
        box-shadow:0 ${10 * u}px ${36 * u}px ${A.hexA(B.accent, .4)}`;
      pill.innerHTML = K.parseCopy(s.pill).map(p => p.br ? ' ' : p.accent ? `<span style="font-family:${FACES.serif};font-style:italic;font-weight:400">${A.esc(p.text)}</span>` : A.esc(p.text)).join('');
      pillW.appendChild(pill);
    }
    // stack: over · headline · pill, centred
    const gap1 = 22 * u, gap2 = (serif ? 18 : 26) * u;
    const hh = head.offsetHeight, oh = over ? over.offsetHeight : 0, ph = pill ? pill.offsetHeight : 0;
    const total = oh + (over ? gap1 : 0) + hh + (pill ? gap2 + ph : 0);
    let y = H / 2 - total / 2;
    if (over) { over.style.top = y + 'px'; y += oh + gap1; }
    head.style.top = y + 'px'; ghosts.forEach(g => { g.style.top = y + 'px'; g.style.left = head.style.left; g.style.width = head.style.width; }); y += hh + gap2;
    if (pill) { pill.style.left = (W / 2 - pill.offsetWidth / 2) + 'px'; pill.style.top = y + 'px'; }
    // the opening tracking is clamped so the widest (first) frame still fits the safe width
    const glyphW = () => { const rg = document.createRange(); rg.selectNodeContents(head); return rg.getBoundingClientRect().width; };
    let ls1 = serif ? .3 : .26;
    for (let i = 0; i < 12; i++) { head.style.letterSpacing = ls1 + 'em'; if (glyphW() <= safe.w * .98 || ls1 <= parseFloat(ls0)) break; ls1 = Math.max(parseFloat(ls0), ls1 - .03); }
    head.style.letterSpacing = ls0;
    const cy = H / 2, cx = W / 2;
    const origin = el => { el.style.transformOrigin = `${cx - el.offsetLeft}px ${cy - el.offsetTop}px`; };
    [head, ...ghosts, over, pill].filter(Boolean).forEach(origin);
    const pblur = F.dirBlur(`fk-ty-${s.id}`);
    await document.fonts.ready;
    return {
      async render(t, D) {
        const TH = thr(s), z = TH ? K.u01(t, D - TH, D) : 0, zz = z * z;
        const zoom = Math.pow(9, zz), push = 1 + .035 * K.u01(t, 14, D - TH), dy = 2 * u * Math.sin(t * .06);
        const k = K.outExpo(K.u01(t, -2, 17));
        const ls = K.lerp(ls1, parseFloat(ls0), k);
        head.style.letterSpacing = ls.toFixed(4) + 'em';
        const g = Math.sin(Math.PI * K.u01(t, 7, 28));
        head.style.textShadow = g > .01 ? `0 0 ${(46 * u * g).toFixed(1)}px ${light ? A.hexA(B.accent, .35 * g) : `rgba(255,255,255,${(.6 * g).toFixed(3)})`}` : (light ? 'none' : '0 2px 24px rgba(0,0,0,.25)');
        const hs = K.lerp(1.16, 1, k) * push * zoom;
        head.style.opacity = (K.clamp(K.u01(t, -2, 5)) * (1 - .55 * K.u01(z, .55, 1))).toFixed(3);
        // CSS blur runs in the element's own (pre-scale) space: divide by the scale so the zoom blur stays ~26 px on screen
        // (unscaled it would grow ×9 with the zoom — 230 px blurs on a 9× raster, slow enough to time out a render)
        head.style.filter = F.filt(F.blur(((1 - k) * 14 * u + 26 * u * zz) / hs));
        head.style.transform = `translateY(${dy.toFixed(2)}px) scale(${hs.toFixed(5)})`;
        ghosts.forEach((gh, j) => {
          gh.style.letterSpacing = head.style.letterSpacing;
          gh.style.opacity = z > 0 ? (.34 * Math.sin(Math.PI * K.clamp(z * 1.15)) / (j + 1)).toFixed(3) : 0;
          const gs = hs * (1 - .14 * (j + 1) * z);
          gh.style.filter = z > 0 ? F.blur((10 * u + 16 * u * zz) / gs) : 'none';
          gh.style.transform = z > 0 ? `translateY(${dy.toFixed(2)}px) scale(${gs.toFixed(5)})` : 'none';
        });
        if (over) {
          const k2 = K.outExpo(K.u01(t, 3, 19));
          over.style.opacity = (K.clamp(K.u01(t, 3, 9)) * (1 - K.u01(z, .2, .7))).toFixed(3);
          over.style.filter = F.filt(F.blur(((1 - k2) * 8 * u + 20 * u * zz) / (push * zoom)));
          over.style.transform = `translateY(${((1 - k2) * -26 * u + dy).toFixed(2)}px) scale(${(push * zoom).toFixed(5)})`;
        }
        if (pill) {
          const c = K.outExpo(K.u01(t, 10, 23));
          pill.style.clipPath = c < .999 ? `inset(0 ${((1 - c) * 100).toFixed(2)}% 0 0 round ${pill.offsetHeight / 2}px)` : 'none';
          pill.style.opacity = (K.clamp(K.u01(t, 10, 13)) * (1 - K.u01(z, .2, .75))).toFixed(3);
          pill.style.filter = F.filt(pblur((1 - c) * 18 * u, 0), F.blur(20 * u * zz / (push * zoom)));
          pill.style.transform = `translateX(${((1 - c) * -40 * u).toFixed(2)}px) translateY(${dy.toFixed(2)}px) scale(${(push * zoom).toFixed(5)})`;
        }
      },
    };
  },
};
