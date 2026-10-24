// STORYBOARD STAND-IN (job-local custom block, manus2-space "The Lull"; reused from manus2-film, now three end lines). Overrides the built-in `endcard` for this job only (the
// name keeps the engine's end-card behaviour: `music.hit` lands on the last shot when it is an endcard).
// Default A "endcard-wash": the shot's `bg:` is S26's last picture washed toward #F7F7F7 (plate x 0.24 + #F7F7F7 x 0.76,
// made by tools/make_plates.py) with a faint 16 px dot grid over it; the Manus lockup (official mark + wordmark files,
// centred, ~30 % of the frame width, hf01's icon motion: the mark alone swells, the wordmark cuts on and the mark jumps
// into the lockup, snap 1.10 -> 0.90 -> 1.00; never rotated or morphed); the end line built word by word, each word
// arriving grey #A6A6A4 and settling to ink, 'shipping.' in #33ABFB with a hand-drawn underline drawn left to right.
// SHOTLIST S27: lockup centred on (960, 444); three lines with cap tops at y 565 / 622 / 679 (1920x1080), pitch 57.
// Why not the built-in endcard: it wobbles the logo (rotate ±4°), sets the name as Inter text beside the mark (a fake
// wordmark) and its tagline is a grey 44 px line.
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const lerp = (a, b, k) => a + (b - a) * k;
const u01 = (t, a, b) => b === a ? (t >= b ? 1 : 0) : Math.max(0, Math.min(1, (t - a) / (b - a)));
const parse = line => String(line).split(/\s+/).filter(Boolean).map(w => ({ w: w.replace(/\*/g, ''), blue: /^\*.*\*$/.test(w) }));

export default {
  name: 'endcard',
  doc: 'STORYBOARD STAND-IN (job override of the built-in): end-card wash + the official Manus lockup with hf01\'s icon motion + the end line built word by word (*word* = blue with a hand-drawn underline).',
  layers: 'grid · lockup · line',
  params: { n0: 'first hf01 frame', heroAt: 'hf01 frame for the storyboard still', lines: 'end line, 1-2 lines (*word* = blue)', words: 'hf01 frame each word lands', underline: '[n, n]', mark: '[n alone, n wordmark]' },
  bgDefaults: { bgDim: 0, bgMove: 'none' },
  copy: s => [].concat(s.lines || []).map(l => String(l).replace(/\*/g, '')),
  cues: () => [{ t: 0, kind: 'hit', note: 89 }],
  hero: (s, D) => s.heroAt != null ? Math.max(0, Math.min(D - 1, s.heroAt - (s.n0 || 0))) : Math.min(D - 4, 46),
  async build(ctx, s) {
    const { W, H } = ctx, k = W / 1920, n0 = s.n0 || 0;
    ctx.el('', `left:${-W}px;top:${-H}px;width:${3 * W}px;height:${3 * H}px;background:radial-gradient(rgba(220,220,220,.55) ${1.05 * k}px,transparent ${1.35 * k}px) 0 0/${16 * k}px ${16 * k}px`, 'grid');
    // lockup centred on y 466, sized to PITCH §2.9 / SHOTLIST S27: the visible glyphs span ~30 % of the frame width and
    // the mark is ~2.7x the wordmark's x-height. Measured on the render: at mh 226 / wordmark 422 the mark glyph is ~157 px
    // tall, the 'manus' x-height ~58 px (2.7x) and mark-left to wordmark-right ~584 px (30.4 %). (v0.1 had 170 / 391:
    // 26.7 % and 2.2x.) The files are drawn unaltered (aspect kept, no recolour, no rotation).
    const mh = 226 * k;
    const lock = ctx.el(`<img class="e-mk" src="${ctx.asset('assets/manus-mark-dark.svg')}" style="position:absolute;height:${mh}px;width:${mh}px;object-fit:contain;display:block">
        <img class="e-wm" src="${ctx.asset('assets/manus-wordmark-dark.svg')}" style="position:absolute;width:${422 * k}px;height:auto;display:block">`,
      `left:0;top:0;width:${W}px;height:${H}px`, 'lockup');
    const mk = lock.querySelector('.e-mk'), wm = lock.querySelector('.e-wm');
    await Promise.all([mk, wm].map(im => im.decode().catch(() => null)));
    // the glyphs sit off-centre inside their files (side bearings), so the boxes are shifted 14 px left to centre the
    // visible lockup on x 960 (measured on the render: glyphs 682-1266 -> centre 974 before the shift)
    const wmW = wm.offsetWidth, gap = 8 * k, total = mh + gap + wmW, lx = W / 2 - total / 2 - 14 * k, cyL = (s.lockY || 444) * k;
    mk.style.top = `${cyL - mh / 2}px`; wm.style.top = `${cyL - wm.offsetHeight / 2 + mh * .05}px`;
    const lines = [].concat(s.lines || []).map(parse), fs = 54 * k;
    const lineEls = [], words = [];
    lines.forEach((ln, i) => {
      const el = ctx.el(ln.map(o => `<span class="e-w" style="display:inline-block;margin:0 ${fs * .13}px;${o.blue ? 'position:relative' : ''}">${esc(o.w)}${o.blue ? `<svg class="e-ul" viewBox="0 0 200 16" preserveAspectRatio="none" style="position:absolute;left:-2%;bottom:${-fs * .3}px;width:104%;height:${fs * .28}px;overflow:visible"><path d="M3 10 C 40 4, 90 13, 130 7 S 185 6, 197 9" fill="none" stroke="#33ABFB" stroke-width="5" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1"/></svg>` : ''}</span>`).join(''),
        `left:0;width:${W}px;top:${((s.lineTop || 555) + i * 57) * k}px;text-align:center;font:500 ${fs}px/1.1 ${ctx.font};letter-spacing:-.015em;color:#1F1F1F;white-space:nowrap`, `line-${i + 1}`);
      lineEls.push(el);
      el.querySelectorAll('.e-w').forEach((w, j) => words.push({ el: w, blue: ln[j].blue }));
    });
    const ul = lineEls.flatMap(e => [...e.querySelectorAll('.e-ul path')]);
    const M = s.mark || [n0, n0 + 6];
    return {
      render(t) {
        const n = n0 + t;
        // the mark alone at frame centre (0.99 -> 1.10), then the wordmark cuts on and the mark jumps into the lockup
        const alone = n < M[1];
        const swell = alone ? lerp(.99, 1.10, u01(n, M[0], M[1])) : n < M[1] + 2 ? 1.10 : n < M[1] + 3 ? .90 : lerp(.90, 1.0, 1 - Math.pow(1 - u01(n, M[1] + 3, M[1] + 9), 2));
        const mx = alone ? W / 2 - mh / 2 : lx;
        mk.style.left = `${mx}px`; mk.style.transform = `scale(${swell.toFixed(4)})`;
        mk.style.transformOrigin = alone ? '50% 50%' : `${(W / 2 - lx).toFixed(1)}px 50%`;
        wm.style.left = `${lx + mh + gap}px`; wm.style.opacity = alone ? 0 : 1;
        wm.style.transform = alone ? 'none' : `scale(${swell.toFixed(4)})`; wm.style.transformOrigin = `${(W / 2 - (lx + mh + gap)).toFixed(1)}px 50%`;
        const at = [].concat(s.words || []);
        words.forEach((o, i) => {
          const a = at[i] ?? (n0 + 12 + i * 4), p = u01(n, a, a + 4);
          o.el.style.opacity = n < a ? 0 : Math.min(1, p * 1.6).toFixed(3);
          o.el.style.filter = n >= a && p < 1 ? `blur(${((1 - p) * 8 * k).toFixed(2)}px)` : 'none';
          o.el.style.color = o.blue ? '#33ABFB' : (p < 1 ? (n < a + 2 ? '#A6A6A4' : '#5E5E5D') : '#1F1F1F');
        });
        const U = s.underline || [n0 + 37, n0 + 47];
        ul.forEach(pth => pth.setAttribute('stroke-dashoffset', (1 - u01(n, U[0], U[1])).toFixed(4)));
      },
    };
  },
};
