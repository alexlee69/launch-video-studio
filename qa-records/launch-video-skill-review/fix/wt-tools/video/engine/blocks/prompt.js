import * as K from '../kit.js';
import * as A from '../art.js';
import { drift } from './_layout.js';

// A hero prompt box: the task is typed (≈1 char per frame with natural holds), send is pressed, and optional agent
// steps tick off underneath. Timing is deterministic so the key ticks and the send click land on their frames.
const T0 = 8;
function typing(s) {
  const text = String(s.prompt || ''), chars = Array.from(text), times = [];   // code points: an emoji is one keystroke
  let t = T0;
  for (let i = 0; i < chars.length; i++) { t += (i % 7 === 6 ? 2 : 1) * (s.speed ? 1 / s.speed : 1); times.push(t); }
  const send = t + 6;
  return { text, chars, times, send };
}
const stepPlan = (s, D) => {
  const steps = [].concat(s.steps || []);
  if (!steps.length) return [];
  const a = typing(s).send + 8, per = Math.max(8, Math.min(18, (D - 10 - a) / steps.length));
  return steps.map((x, i) => ({ text: String(x), start: a + i * per, done: a + (i + 1) * per }));
};
export default {
  name: 'prompt',
  doc: 'A big prompt box: placeholder → the task is typed with key ticks → send → optional agent steps tick off below. Headline optional.',
  layers: 'headline · prompt-box · prompt-text · step-1 … step-N',   // --layers export, back to front
  params: { prompt: 'the text typed into the box', placeholder: 'grey text before typing (default "Ask anything…")', text: 'headline above the box (optional)', steps: 'optional list of agent steps shown after send', speed: 'typing speed multiplier (default 1 ≈ 30 chars/s)', mode: 'chip label inside the box (default "Agent")' },
  validate: (s, D) => { const ty = typing(s), st = stepPlan(s, D); const end = st.length ? st[st.length - 1].done : ty.send; return end > D - 4 ? [`prompt ${s.id}: typing + steps need ${Math.ceil(end + 4)} frames but the shot has ${D}; lengthen it, shorten the prompt, or set speed`] : []; },
  cues: (s, D) => { const ty = typing(s); return [...ty.times.map(t => ({ t, kind: 'tick', gain: .8 })), { t: ty.send, kind: 'click' }, ...stepPlan(s, D).map(x => ({ t: x.done, kind: 'tick', gain: 1.3 }))]; },
  hero: (s, D) => { const st = stepPlan(s, D); return Math.min(D - 2, Math.round((st.length ? st[st.length - 1].done : typing(s).send) + 6)); },
  build(ctx, s) {
    const { W, H, u, safe, C, portrait } = ctx, B = ctx.brand.colors;   // B: the box is a light surface even in a dark shot
    const ty = typing(s), st = stepPlan(s, ctx.D);
    const head = s.text ? ctx.text(s.text, { size: portrait ? 84 : 76, align: 'center', maxW: safe.w, lines: 2, layer: 'headline' }) : null;
    const bw = Math.min(safe.w, 1100 * u), fs = (portrait ? 40 : 38) * u;
    const box = ctx.el(`<div class="lv-ui" style="display:flex;flex-direction:column;gap:${fs * .9}px;padding:${fs * .9}px ${fs * .9}px ${fs * .7}px ${fs * 1.05}px;border-radius:${fs * 1.1}px;background:${B.card};
        box-shadow:0 0 0 ${2 * u}px rgba(17,17,20,.08),0 ${30 * u}px ${80 * u}px rgba(20,24,40,.13);font-family:${ctx.font};font-size:${fs}px;color:${ctx.brand.colors.ink}">
      <div class="lv-ptext" style="min-height:${fs * 2.6}px;font-weight:500;line-height:1.3;word-break:break-word"><span class="lv-txt lv-type" style="position:relative"></span><span class="lv-caret" style="display:inline-block;width:${3 * u}px;height:${fs * 1.15}px;background:${B.accent};vertical-align:${-fs * .2}px;margin-left:2px"></span><span class="lv-txt lv-ph" style="position:relative;color:${B.muted}">${A.esc(s.placeholder || 'Ask anything…')}</span></div>
      <div style="display:flex;align-items:center;gap:${fs * .5}px">
        <div style="width:${fs * 1.6}px;height:${fs * 1.6}px;border-radius:50%;box-shadow:inset 0 0 0 ${2 * u}px #D5D8DF;display:flex;align-items:center;justify-content:center;color:#8A8A92;font-weight:500">+</div>
        <div class="lv-txt" style="position:relative;padding:${fs * .25}px ${fs * .6}px;border-radius:99px;background:#F1F2F5;color:#55555E;font-size:${fs * .62}px;font-weight:600">${A.esc(s.mode || 'Agent')}</div>
        <div class="lv-send" style="margin-left:auto;width:${fs * 1.9}px;height:${fs * 1.9}px;border-radius:50%;background:${B.ink};display:flex;align-items:center;justify-content:center">
          <svg width="${fs * .95}" height="${fs * .95}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></div></div></div>`,
      `left:${W / 2 - bw / 2}px;width:${bw}px`, 'prompt-box');
    ctx.layer(box.querySelector('.lv-ptext'), 'prompt-text');
    const stepsEl = st.length ? ctx.el(`<div style="display:flex;flex-direction:column;gap:${fs * .55}px;font-family:${ctx.font};font-size:${fs * .78}px">${st.map(x => `
        <div class="lv-step" style="display:flex;align-items:center;gap:${fs * .5}px;opacity:0">
          <div style="position:relative;width:${fs * .95}px;height:${fs * .95}px;flex:none">
            ${A.spinner(fs * .95, 3 * u, A.hexA(C.accent, .22), C.accent)}
            <svg class="lv-ok" viewBox="0 0 26 26" style="position:absolute;inset:0;width:100%;height:100%;opacity:0"><circle cx="13" cy="13" r="13" fill="${C.accent}"/><path d="M7.5 13.5l4 4 7-8" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <span class="lv-txt" style="position:relative;font-weight:500;color:${C.ink}">${A.esc(x.text)}</span></div>`).join('')}</div>`, `left:${W / 2 - bw / 2 + fs}px;width:${bw - fs * 2}px`) : null;
    const gap = 50 * u, hh = head ? head.offsetHeight + gap : 0, sh = stepsEl ? stepsEl.offsetHeight + gap * .7 : 0;
    let y = H / 2 - (hh + box.offsetHeight + sh) / 2;
    if (head) { head.style.left = safe.x0 + 'px'; head.style.top = y + 'px'; y += hh; }
    box.style.top = y + 'px'; y += box.offsetHeight + gap * .7;
    if (stepsEl) stepsEl.style.top = y + 'px';
    const typeEl = box.querySelector('.lv-type'), ph = box.querySelector('.lv-ph'), send = box.querySelector('.lv-send');
    const rows = stepsEl ? [...stepsEl.querySelectorAll('.lv-step')] : [];
    rows.forEach((row, i) => ctx.layer(row, `step-${i + 1}`));
    return {
      render(t) {
        if (head) { ctx.reveal(head, t, -4, 2); head.style.transform = `translateY(${drift(t, 7, u)}px)`; }
        const p = K.outBack(K.u01(t, -4, 12));
        box.style.transform = `translateY(${((1 - p) * 50 * u).toFixed(2)}px) scale(${K.lerp(.95, 1, K.clamp(p, 0, 1.05)).toFixed(4)})`;
        box.style.opacity = K.clamp(K.u01(t, -4, 2) * 1.5).toFixed(3);
        const n = ty.times.filter(x => x <= t).length;
        typeEl.textContent = ty.chars.slice(0, n).join(''); ph.style.display = n ? 'none' : 'inline';
        send.style.transform = `scale(${(1 - .14 * Math.sin(Math.PI * K.u01(t, ty.send - 2, ty.send + 3))).toFixed(4)})`;
        send.style.background = t >= ty.send ? B.accent : B.ink;
        rows.forEach((row, i) => {
          const x = st[i], a = K.outExpo(K.u01(t, x.start - 2, x.start + 6)), done = t >= x.done;
          row.style.opacity = a.toFixed(3); row.style.transform = `translateY(${((1 - a) * 16 * u).toFixed(2)}px)`;
          row.querySelector('.lv-spin').style.opacity = done ? 0 : 1;
          A.spinAt(row.querySelector('.lv-spin'), t);
          const ok = row.querySelector('.lv-ok'), k = K.outBack(K.u01(t, x.done, x.done + 7));
          ok.style.opacity = done ? 1 : 0; ok.style.transform = `scale(${done ? k.toFixed(4) : 0})`;
        });
      },
    };
  },
};
