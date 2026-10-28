// type — kinetic lockup type: a big 1–2 line name settles in (tracking closes, scale and blur settle, a glint), with an
// optional small co-brand line above and an accent pill under it; optional footage behind (the shot's `bg`, drawn by the
// engine). With `through: true` the whole lockup zooms THROUGH the camera over the shot's last ~10 frames with a heavy
// zoom blur (trailing ghosts), and the footage pushes in with it (bgMotion).
import { F } from './_film.js';
import * as K0 from '../kit.js';

// serif = a system serif (macOS: Bodoni 72 / Didot; else Georgia) — no font file ships with the kit
const FACES = { sans: null, brand: null, serif: '"Bodoni 72", Didot, Georgia, "Times New Roman", serif' };
const thr = s => s.through === true ? 10 : Math.max(0, Number(s.through) || 0);

// every line a viewer reads, in order (timeline: captions SRT, reading time, storyboard, review sheet)
const copyOf = s => [s.over, s.text, s.pill].filter(x => x != null && String(x).trim() !== '').map(String);
// ── word beats (round 1 of the motion kit; `text` mode above is untouched): `words: [Generate., chaos., loud.]` — one
// word per beat filling the frame, alternating bold sans and italic serif, each landing from scale 1.08 + 8 px blur over
// 6 frames, holding with a slow push, then pushed out over its last 2.5 frames into the next (a hard swap)
const wordsOf = s => Array.isArray(s.words) ? s.words.filter(x => x != null && String(x).trim() !== '').map(String) : [];
const isWords = s => wordsOf(s).length > 0;
const FACE_MODES = ['alternate', 'sans', 'serif'];
function wordPlan(s, D) {
  const n = wordsOf(s).length, ev = s.every != null && s.every !== '' ? F.at(s.every, 0, 'type every') : D / n;
  const every = Math.max(1, ev), starts = Array.from({ length: n }, (_, k) => Math.round(k * every * 2) / 2);
  return { n, every, starts, end: k => k < n - 1 ? starts[k + 1] : D };
}
const wordCopy = s => [s.over, ...wordsOf(s).map(w => w.replace(/\|/g, ''))].filter(x => x != null && String(x).trim() !== '').map(String);
// a long word may break onto two lines with a hyphen: where the word marks it (Extra|ordinary.), else at a common prefix /
// suffix, else between syllables (V|CV or VC|CV, never inside th/ch/sh/ph/ck/ng/qu)
const PREFIX = ['extra', 'inter', 'super', 'under', 'over', 'trans', 'multi', 'hyper', 'counter', 'out', 'over', 'un', 're', 'pre', 'dis'];
const SUFFIX = ['ability', 'ibility', 'ation', 'ition', 'ment', 'ness', 'able', 'ible', 'tion', 'sion', 'less', 'ful', 'ous', 'ive', 'ing', 'ary', 'ery', 'ity', 'ally', 'ize', 'ise'];
const DIGRAPH = new Set(['th', 'ch', 'sh', 'ph', 'ck', 'ng', 'qu', 'wh', 'gh']);
export function wordSplits(word) {
  const acc = /^\*.*\*$/.test(word), w = acc ? word.slice(1, -1) : word;
  const wrap = (a, b) => acc ? `*${a}-*|*${b}*` : `${a}-|${b}`;
  if (w.includes('|')) { const i = w.indexOf('|'); return [{ copy: wrap(w.slice(0, i), w.slice(i + 1).replace(/\|/g, '')), a: w.slice(0, i), b: w.slice(i + 1), marked: true }]; }
  const m = w.match(/^([^A-Za-z]*)([A-Za-z]+)([^A-Za-z]*)$/);
  if (!m || m[2].length < 9) return [];
  const [, pre, L, post] = m, low = L.toLowerCase(), V = c => 'aeiouy'.includes(c), out = new Map();
  const add = (i, affix) => { if (i < 3 || L.length - i < 3) return; const a = pre + L.slice(0, i), b = L.slice(i) + post; if (!out.has(i)) out.set(i, { copy: wrap(a, b), a, b, affix }); else if (affix) out.get(i).affix = true; };
  for (const p of PREFIX) if (low.startsWith(p)) add(p.length, true);
  for (const x of SUFFIX) if (low.endsWith(x)) add(L.length - x.length, true);
  // syllable breaks: V|CV (before a single consonant between vowels) and VC|CV (between two consonants, not a digraph)
  for (let i = 3; i <= L.length - 3; i++) {
    const cm = low[i - 2], c0 = low[i - 1], c1 = low[i], c2 = low[i + 1];
    if ((V(c0) && !V(c1) && V(c2)) || (V(cm) && !V(c0) && !V(c1) && V(c2) && !DIGRAPH.has(c0 + c1))) add(i, false);
  }
  return [...out.values()];
}

export default {
  name: 'type',
  doc: 'Kinetic lockup type: a big 1–2 line name settles (tracking, scale, blur, a glint) with an optional co-brand line above and an accent pill under; optional footage behind; through: true zooms it through the camera with heavy blur at the end. words: one word per beat filling the frame, bold sans and italic serif alternating.',
  layers: 'over · headline · pill (the engine adds footage under them and letterbox on top; words: over · headline)',
  media: [],
  bgDefaults: { bgDim: .15, bgMove: 'in' },
  copy: s => isWords(s) ? wordCopy(s) : copyOf(s),
  // word beats: the words are read (one per beat; `over` too); the text mode keeps reading its copy
  read: s => isWords(s) ? wordCopy(s) : null,
  // the footage pushes in with the zoom-through (extra scale on top of its own move; pure in t)
  bgMotion: (ctx, s) => (t, D) => { const TH = thr(s), z = TH ? ctx.K.u01(t, D - TH, D) : 0; return { s: 1 + .14 * z * z }; },
  params: {
    text: '1–2 lines (| breaks, *accent* ok)', face: 'sans (default) | serif (system serif: Bodoni 72 / Didot / Georgia) | brand (brand.font)',
    over: 'small co-brand line above, e.g. "Orbit × Acme" (the brand logo leads it; overLogo: false to drop it)', pill: 'accent pill under the text (*word* = italic)',
    through: 'true (last 10 frames) or a frame count: the lockup zooms through the camera (cut to the next shot after it)', bg: '(any shot) footage or an image behind the type (bgDim default .15, bgMove default in, letterbox)',
    words: 'word beats instead of text: [Generate., chaos., loud., Animate.] — one word per beat, each filling the frame (*accent* ok); a long word breaks onto two lines with a hyphen (mark where: Extra|ordinary.)',
    faces: 'word beats: alternate (default: bold sans, then italic serif, …) | sans | serif',
    every: 'word beats: frames per word (or seconds, "0.8s"; default the shot length ÷ the words, ≥ 20 frames reads)',
  },
  required: [],
  validate(s, D) {
    if (!isWords(s)) return thr(s) && D - thr(s) < 28 ? [`type ${s.id}: the zoom-through takes ${thr(s)} of ${D} frames — the type barely settles; lengthen the shot`] : [];
    const w = [], P = wordPlan(s, D);
    if (P.every < 20) w.push(`type ${s.id}: ${P.n} word beats at ${P.every.toFixed(1)} frames each — under 20 frames a word doesn't read; give the shot ≥ ${(P.n * 20 / 30).toFixed(1)} s or fewer words`);
    if (P.starts[P.n - 1] > D - 12) w.push(`type ${s.id}: the last word lands at frame ${P.starts[P.n - 1]} of ${D} — every × words runs past the shot`);
    if (s.text != null && String(s.text).trim() !== '') w.push(`type ${s.id}: text is ignored when words are given`);
    if (s.pill != null) w.push(`type ${s.id}: pill is not shown with word beats`);
    if (thr(s) && D - P.starts[P.n - 1] - thr(s) < 8) w.push(`type ${s.id}: the zoom-through starts before the last word has landed — lengthen the shot`);
    // a word too long to fill the frame even on two lines (estimated: bold sans ≈ .6 em a letter, the serif ≈ .5)
    const faces = FACE_MODES.includes(s.faces) ? s.faces : 'alternate', small = [];
    wordsOf(s).forEach((wd, k) => {
      const serif = faces === 'serif' || (faces === 'alternate' && k % 2 === 1), em = serif ? .5 : .6;
      for (const [a, [W, H]] of Object.entries({ '16x9': [1920, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080] })) {
        const target = (H > W ? .2 * W : W === H ? .2 * H : .24 * H) / (serif ? .68 : .73), sw = (H > W ? .76 : .86) * W * .96;
        const len = x => String(x).replace(/[*|]/g, '').length, one = Math.min(target, sw / (len(wd) * em));
        const two = Math.max(0, ...wordSplits(wd).map(sp => Math.min(target, sw / (Math.max(len(sp.a) + 1, len(sp.b)) * em))));
        if (Math.max(one, two) < target * .45) { small.push(`"${wd.replace(/\|/g, '')}" on ${a}`); break; }
      }
    });
    if (small.length) w.push(`type ${s.id}: ${small.join(', ')} can't fill the frame (under half the size of a short word) — use a shorter word, or mark a break: Extra|ordinary.`);
    if (s.face != null) w.push(`type ${s.id}: face does nothing with words — use faces: alternate | sans | serif`);
    return w;
  },
  cues: (s, D) => isWords(s) ? wordPlan(s, D).starts.filter(t => t < D).map((t, k) => ({ t, kind: 'hit', note: [86, 89, 84, 91, 88, 93][k % 6], gain: .65 }))
    : [{ t: 0, kind: 'hit', note: 86, gain: .7 }, ...(s.pill ? [{ t: 11, kind: 'pop', note: 84, gain: .7 }] : [])],
  hero: (s, D) => { if (!isWords(s)) return Math.max(8, Math.min(D - thr(s) - 2, 34)); const P = wordPlan(s, D), a = P.starts[P.n - 1], b = Math.min(D, D - thr(s)); return Math.max(0, Math.min(D - 8, Math.round(Math.max(a + 7, (a + b) / 2)))); },
  async build(ctx, s) {
    if (isWords(s)) return buildWords(ctx, s);
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

async function buildWords(ctx, s) {
  const { W, H, u, safe, portrait, square } = ctx, B = ctx.brand.colors;
  const light = !ctx.dark, ink = light ? B.ink : '#FFFFFF', acc = light ? B.accent : (B.accentOnDark || B.accent);
  const words = wordsOf(s), faces = FACE_MODES.includes(s.faces) ? s.faces : 'alternate', P = wordPlan(s, ctx.D);
  const wrap = name => ctx.el('', `left:0;top:0;width:${W}px;height:${H}px`, name);
  const overW = s.over ? wrap('over') : null, headW = wrap('headline');
  // cap height ≈ 24 % of H on 16:9 (Inter caps ≈ .73 em; the serif's ≈ .68 em), then each word is fitted to the safe width
  const target = (portrait ? .2 * W : square ? .2 * H : .24 * H);
  const boxes = words.map((wd, k) => {
    const serif = faces === 'serif' || (faces === 'alternate' && k % 2 === 1);
    const size = target / (serif ? .68 : .73) / u;
    const mk = copy => ctx.text(copy, { size, weight: serif ? 400 : 700, align: 'center', nowrap: true, ls: serif ? '-.02em' : '-.045em', lh: 1, color: ink, accent: acc, parent: headW,
      style: serif ? `font-family:${FACES.serif};font-style:italic;font-weight:400;` : '' });
    // a word fills the frame: its cap-height target, or the safe width (by design — not a "shrunk" line), never < 48 px
    const fitW = el => { const rg = document.createRange(); rg.selectNodeContents(el); const fs = parseFloat(el.style.fontSize), gw = rg.getBoundingClientRect().width; return gw > safe.w * .96 ? Math.max(48 * u, fs * safe.w * .96 / gw) : fs; };
    const splits = wordSplits(wd), marked = splits.length === 1 && splits[0].marked;
    let d = mk(marked ? wd.replace(/\|/g, '') : wd), fs1 = fitW(d);
    d.style.fontSize = fs1.toFixed(2) + 'px';
    // a long word that had to shrink a lot (or one the copy marks) breaks onto two lines when that makes it ≥ 20 % bigger
    if (splits.length && (marked || fs1 < size * u * .62)) {
      // the biggest two-line size wins; a prefix / suffix break wins when it is within 15 % of that (it reads as two parts)
      const tried = splits.map(sp => { const t2 = mk(sp.copy), f2 = Math.min(fitW(t2), size * u, H * (portrait ? .27 : .34)); t2.remove(); return { sp, f2 }; });
      const top = Math.max(...tried.map(x => x.f2)), aff = tried.filter(x => x.sp.affix && x.f2 >= top * .85).sort((p, q) => q.f2 - p.f2)[0];
      const best = aff || tried.sort((p, q) => q.f2 - p.f2)[0];
      if (best && (marked || best.f2 > fs1 * 1.2)) { d.remove(); d = mk(best.sp.copy); d.style.fontSize = best.f2.toFixed(2) + 'px'; }
    }
    d.style.left = (W / 2 - d.offsetWidth / 2) + 'px';
    d.style.top = (H / 2 - d.offsetHeight / 2) + 'px';
    d.style.transformOrigin = '50% 50%';
    d.style.opacity = 0;
    return d;
  });
  const tallest = Math.max(...boxes.map(d => d.offsetHeight));
  let over = null;
  if (s.over) {
    over = document.createElement('div');
    over.style.cssText = `position:absolute;left:0;top:0;width:${W}px;display:flex;justify-content:center;align-items:center;gap:${14 * u}px`;
    overW.appendChild(over);
    if (s.overLogo !== false) { const lg = document.createElement('div'); lg.style.cssText = 'position:relative;flex:none'; lg.innerHTML = ctx.logo(54 * u, !light); over.appendChild(lg); }
    const ot = ctx.text(s.over, { size: 46, weight: 600, nowrap: true, ls: '-.01em', color: ink, accent: acc, parent: over, style: light ? '' : 'text-shadow:0 2px 14px rgba(0,0,0,.35);' });
    ot.style.position = 'relative';
    over.style.top = Math.max(safe.y0, H / 2 - tallest / 2 - over.offsetHeight - 30 * u) + 'px';
  }
  await document.fonts.ready;
  return {
    render(t, D) {
      const TH = thr(s), z = TH ? K0.u01(t, D - TH, D) : 0, zz = z * z, zoom = Math.pow(9, zz);
      let k = 0; for (let j = 0; j < P.n; j++) if (t >= P.starts[j]) k = j;
      boxes.forEach((d, j) => {
        if (j !== k) { d.style.opacity = 0; d.style.transform = 'none'; d.style.filter = 'none'; return; }
        const a = t - P.starts[j], e = K0.outExpo(K0.u01(a, 0, 6));
        const out = j < P.n - 1 ? K0.u01(t, P.end(j) - 2.5, P.end(j)) : 0, oe = out * out;
        const hold = 1 + .025 * K0.u01(a, 6, Math.max(7, P.end(j) - P.starts[j]));
        const sc = (1.08 - .08 * e) * hold * (1 + .12 * oe) * (j === P.n - 1 ? zoom : 1);
        d.style.opacity = (1 - .55 * K0.u01(z, .55, 1)).toFixed(3);
        d.style.filter = F.filt(F.blur((8 * u * (1 - e) + 10 * u * oe + 26 * u * zz) / sc));
        d.style.transform = `translateY(${(1.5 * u * Math.sin(t * .07)).toFixed(2)}px) scale(${sc.toFixed(5)})`;
      });
      if (over) {
        const e = K0.outExpo(K0.u01(t, 2, 18));
        over.style.opacity = (K0.clamp(K0.u01(t, 2, 7)) * (1 - K0.u01(z, .2, .7))).toFixed(3);
        over.style.filter = F.filt(F.blur(((1 - e) * 8 * u + 20 * u * zz) / zoom));
        over.style.transform = e < 1 || zoom !== 1 ? `translateY(${((1 - e) * -24 * u).toFixed(2)}px) scale(${zoom.toFixed(5)})` : 'none';
      }
    },
  };
}
