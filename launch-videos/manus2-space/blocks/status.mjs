// STORYBOARD STAND-IN (job-local custom block, manus2-space "The Lull"). The white status screens (kit "status_screen")
// and the S25 file card: full-frame #F7F7F7 with a 16 px dot grid. AGENT voice = the official Manus mark (never rotates
// or morphs: it only breathes 1.00-1.03) left of one Inter Medium line; TOOL voice = a white rounded tile with a 2 px
// #2CB4F3 line icon (film frame = Studio's Video Editor, sound wave = Alchemy's sound direction), then one line that
// arrives pale grey #BDBDBD and settles to ink left to right (never a blue band), with a wordless 2 px #2CB4F3 progress
// hairline under it that grows but never completes on the card. `*word*` = the card's one #33ABFB word.
// Reused from manus2-film's status.mjs; changed per the final kit (no whole-line blue: the ridge's S10/S18 broke the
// one-blue-word rule). Motion: hf01's house curve y(t) = 81 e^(-t/0.150) - 89 e^((t-T)/0.150) + c (x1.7778 at 1920),
// entering low and blurred, leaving up. Boxes are SHOTLIST.md's 1920x1080 numbers; n fields are hf01 frames.
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const u01 = (t, a, b) => b === a ? (t >= b ? 1 : 0) : Math.max(0, Math.min(1, (t - a) / (b - a)));
const outBack = (k, s = 1.7) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2);
const INK = '#1F1F1F', BLUE = '#33ABFB', PALE = '#BDBDBD', GREY = '#6B6B6B', ICON = '#2CB4F3';
const plain = s => String(s).replace(/\*/g, '');
const words = s => String(s).split(/\s+/).filter(Boolean).map(w => ({ w: w.replace(/\*/g, ''), blue: /^\*.*\*$/.test(w) }));
const ICONS = {
  film: sz => `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="${ICON}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/><path d="M10.5 9.8l3.6 2.2-3.6 2.2z" fill="${ICON}"/></svg>`,
  wave: sz => `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="${ICON}" stroke-width="1.6" stroke-linecap="round"><path d="M3 12h1.5M6 9v6M9 6v12M12 8.5v7M15 4.5v15M18 9v6M21 12h-1"/></svg>`,
  cloud: sz => `<svg width="${sz}" height="${sz * .75}" viewBox="0 0 24 18" fill="none" stroke="${ICON}" stroke-width="1.7" stroke-linejoin="round"><path d="M7 16h11a4.5 4.5 0 0 0 .6-9 6.5 6.5 0 0 0-12.4 1.6A3.8 3.8 0 0 0 7 16z"/></svg>`,
};
const copyOf = s => [...[].concat(s.lines || []).map(plain), ...(s.tool ? [plain(s.tool.text)] : []), ...(s.card ? [s.card.title] : [])].filter(Boolean).map(String);

export default {
  name: 'status',
  doc: 'STORYBOARD STAND-IN: white status screen (Manus mark + one line; tool tile + a grey-to-ink line + progress hairline) or the S25 file card, on #F7F7F7 with a 16 px dot grid, hf01 house-curve motion; *word* = the one blue word.',
  layers: 'grid · mark · line-N · tool · tool-line · hair · card',
  params: {
    n0: 'first hf01 frame of the shot', heroAt: 'hf01 frame for the storyboard still',
    mark: '{hub: [x, y], size} the agent mark at 1920x1080 (omit for a tool-only screen)',
    lines: 'agent line(s), *word* = blue', lineBox: '[x0, x1, capTop] at 1920 (the line is fitted to x0-x1)', size: 'nominal font px at 1920',
    wipe: '[n, n] line wipe', blueAt: '[n, n] the blue word settles to blue', shimmer: '[n, n] contrast shimmer while thinking',
    tool: '{text, icon: film|wave, tile: [x0, x1, y0, y1], textX, capTop, size, n (tile pop), wipe: [n, n], settle: [n, n], hair: {box: [x0, x1, y0, y1], n, to}}',
    card: '{box, tile, thumb, title, titleX, cloud: [x0, x1], disc: [x0, x1, y0, y1]}', c: 'house-curve offset (px at 1080x608)',
  },
  copy: copyOf,
  cues: (s, D) => { const n0 = s.n0 || 0, c = []; if (s.tool && s.tool.n != null) c.push({ t: s.tool.n - n0, kind: 'pop', note: 86, gain: .5 }); return c.filter(x => x.t >= 0 && x.t < D); },
  hero: (s, D) => s.heroAt != null ? Math.max(0, Math.min(D - 1, s.heroAt - (s.n0 || 0))) : Math.round(D * .6),
  async build(ctx, s) {
    const { W, H } = ctx, k = W / 1920, n0 = s.n0 || 0, D = ctx.D;
    ctx.el('', `left:${-W}px;top:${-H}px;width:${3 * W}px;height:${3 * H}px;background:radial-gradient(#E6E6E6 ${1.05 * k}px,transparent ${1.35 * k}px) 0 0/${16 * k}px ${16 * k}px,#F7F7F7`, 'grid');
    const plate = ctx.el('', `left:0;top:0;width:${W}px;height:${H}px`);
    let mark = null, tool = null, toolTx = null, toolWords = [], hair = null, card = null;
    const lineEls = [], lineWords = [];
    if (s.mark) {
      const sz = (s.mark.size || 100) * k;
      mark = ctx.el(`<img src="${ctx.asset(s.markFile || 'assets/manus-mark-dark.svg')}" style="width:100%;height:100%;object-fit:contain;display:block">`,
        `left:${s.mark.hub[0] * k - sz / 2}px;top:${s.mark.hub[1] * k - sz / 2}px;width:${sz}px;height:${sz}px`, 'mark');
      plate.appendChild(mark);
    }
    const fitLine = (el, x0, x1, fs0) => {     // fit the line's width to its box (SHOTLIST gives x0-x1), within 0.75-1.35x
      const w0 = el.offsetWidth, want = x1 - x0, f = Math.max(.75, Math.min(1.35, want / Math.max(1, w0)));
      el.style.fontSize = `${fs0 * f}px`; return fs0 * f;
    };
    if (s.lines) {
      const [lx0, lx1, cap] = s.lineBox.map(v => v * k), fs0 = (s.size || 70) * k;
      [].concat(s.lines).forEach((l, i) => {
        const ws = words(l);
        const e = ctx.el(ws.map(o => `<span class="w" style="color:${INK}">${esc(o.w)}</span>`).join(' '),
          `left:${lx0}px;top:0;font:500 ${fs0}px/1 ${ctx.font};letter-spacing:-.015em;white-space:nowrap`, `line-${i + 1}`);
        plate.appendChild(e);
        const fs = fitLine(e, lx0, lx1, fs0);
        e.style.top = `${cap + i * fs * 1.3 - fs * .14}px`;
        lineEls.push(e); lineWords.push([...e.querySelectorAll('.w')].map((el, j) => ({ el, blue: ws[j].blue })));
      });
    }
    if (s.tool) {
      const T = s.tool, [a, b, c, d] = T.tile.map(v => v * k), fs0 = (T.size || 64) * k;
      tool = ctx.el(`<div style="width:100%;height:100%;box-sizing:border-box;border-radius:${21 * k}px;background:#fff;box-shadow:inset 0 0 0 ${1.5 * k}px #E3E3E3,0 ${4 * k}px ${14 * k}px rgba(0,0,0,.05);display:flex;align-items:center;justify-content:center">${ICONS[T.icon || 'film']((d - c) * .56)}</div>`,
        `left:${a}px;top:${c}px;width:${b - a}px;height:${d - c}px`, 'tool');
      const ws = words(T.text);
      toolTx = ctx.el(ws.map(o => `<span class="w">${esc(o.w)}</span>`).join(' '),
        `left:${T.textX * k}px;top:0;font:500 ${fs0}px/1 ${ctx.font};letter-spacing:-.01em;white-space:nowrap`, 'tool-line');
      plate.appendChild(tool); plate.appendChild(toolTx);
      const fs = T.textX1 ? fitLine(toolTx, T.textX * k, T.textX1 * k, fs0) : fs0;
      toolTx.style.top = `${T.capTop * k - fs * .14}px`;
      toolWords = [...toolTx.querySelectorAll('.w')].map((el, j) => ({ el, blue: ws[j].blue, at: j / ws.length }));
      if (T.hair) {
        const [h0, h1, hy0, hy1] = T.hair.box.map(v => v * k);
        hair = ctx.el(`<div class="hb" style="position:absolute;left:0;top:0;height:100%;width:0;background:${ICON};border-radius:${2 * k}px"></div>`,
          `left:${h0}px;top:${hy0}px;width:${h1 - h0}px;height:${Math.max(3 * k, hy1 - hy0)}px;background:rgba(44,180,243,.12);border-radius:${2 * k}px`, 'hair');
        plate.appendChild(hair); hair = hair.querySelector('.hb');
      }
    }
    if (s.card) {
      const C = s.card, [a, b, c, d] = C.box.map(v => v * k), [t0, t1, t2, t3] = C.tile.map(v => v * k), [q0, q1, q2, q3] = C.disc.map(v => v * k);
      card = ctx.el(`<div style="position:relative;width:100%;height:100%;box-sizing:border-box;border-radius:${28 * k}px;background:#fff;box-shadow:inset 0 0 0 ${1.5 * k}px #E3E3E3,0 ${18 * k}px ${50 * k}px rgba(0,0,0,.08)">
          <div style="position:absolute;left:${t0 - a}px;top:${t2 - c}px;width:${t1 - t0}px;height:${t3 - t2}px;border-radius:${18 * k}px;overflow:hidden"><img src="${ctx.asset(C.thumb)}" style="width:100%;height:100%;object-fit:cover;display:block">
            <svg viewBox="0 0 10 10" style="position:absolute;left:40%;top:38%;width:22%;height:24%"><path d="M2 1l7 4-7 4z" fill="#fff"/></svg></div>
          <div class="ct" style="position:absolute;left:${C.titleX * k - a}px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:${24 * k}px;font:500 ${(C.size || 50) * k}px/1.15 ${ctx.font};color:${INK};white-space:nowrap">${esc(C.title)}${ICONS.cloud((C.cloud[1] - C.cloud[0]) * k)}</div>
          <div style="position:absolute;left:${q0 - a}px;top:${q2 - c}px;width:${q1 - q0}px;height:${q3 - q2}px;border-radius:50%;background:#F2F2F2;display:flex;align-items:center;justify-content:center">
            <svg width="${(q1 - q0) * .48}" height="${(q1 - q0) * .48}" viewBox="0 0 24 24" fill="none" stroke="${BLUE}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5 10-11"/></svg></div></div>`,
        `left:${a}px;top:${c}px;width:${b - a}px;height:${d - c}px`, 'card');
      plate.appendChild(card);
    }
    await Promise.all([...ctx.root.querySelectorAll('img')].map(im => im.decode().catch(() => null)));
    const T = D / 30, c0 = (s.c || 0);
    return {
      render(t) {
        const n = n0 + t, sec = t / 30;
        // hf01's house curve (px at 1080x608) -> 1920 px; S25 uses its own drift form
        const y = s.card ? (72.7 * Math.exp(-sec / .154) - 20.6 * sec + 8.1) : (81 * Math.exp(-sec / .15) - 89 * Math.exp((sec - T) / .15) + c0);
        const v = s.card ? 0 : Math.abs(-81 / .15 * Math.exp(-sec / .15) - 89 / .15 * Math.exp((sec - T) / .15)) / 30;
        plate.style.transform = `translateY(${(y * 1.7778 * k).toFixed(2)}px)`;
        plate.style.filter = v > 1.5 ? `blur(${Math.min(12, v * .35 * k).toFixed(2)}px)` : 'none';
        if (mark) mark.style.transform = `scale(${(1.015 + .015 * Math.sin(n * 2 * Math.PI / 24)).toFixed(4)})`;
        const W0 = s.wipe || [n0 + 1, n0 + 6], B = s.blueAt, sh = s.shimmer;
        const shim = sh && n >= sh[0] && n <= sh[1] ? .45 + .55 * Math.abs(Math.cos((n - sh[0]) * .5)) : 1;
        lineEls.forEach((e, i) => {
          const w = u01(n, W0[0] + i * 2.5, W0[1] + i * 2.5);
          e.style.clipPath = `inset(-20% ${(100 * (1 - w)).toFixed(1)}% -20% 0)`;
          e.style.opacity = shim.toFixed(3);
          lineWords[i].forEach(o => { o.el.style.color = o.blue && (!B || n >= B[1]) ? BLUE : o.blue && n >= B[0] ? '#7CC6F7' : (s.grey ? GREY : INK); });
        });
        if (tool) {
          const Tt = s.tool, p = Tt.n != null ? u01(n, Tt.n, Tt.n + 7) : 1;
          tool.style.transform = `scale(${Math.max(0, Math.min(1.11, outBack(p, 2.2))).toFixed(4)})`;
          tool.style.opacity = p > 0 ? 1 : 0;
          const wi = u01(n, Tt.wipe[0], Tt.wipe[1]), st = Tt.settle || Tt.wipe;
          toolTx.style.clipPath = `inset(-20% ${(100 * (1 - wi)).toFixed(1)}% -20% 0)`;
          toolWords.forEach(o => { const done = n >= st[0] + (st[1] - st[0]) * o.at; o.el.style.color = done ? (o.blue ? BLUE : INK) : PALE; });
          if (hair) { const H0 = Tt.hair; hair.style.width = `${(100 * (H0.to ?? .6) * u01(n, H0.n, n0 + D - 1)).toFixed(1)}%`; }
        }
      },
    };
  },
};
