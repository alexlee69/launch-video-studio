// Storyboard sheet: one real still per shot (rendered at its hero frame) with timing, copy, transition and SFX notes,
// laid out as an HTML page and saved as PNG + PDF for review. Also: thumbnail + captions extras.
import { writeFileSync, copyFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { ASPECTS, fmtT, ff } from './common.mjs';
import { launch } from './render.mjs';
import { serve } from './server.mjs';
import { copyOf } from './timeline.mjs';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function buildBoard({ job, tl, aspect, dir, stills, audits, warns = [] }) {
  const { W, H } = ASPECTS[aspect];
  const cols = aspect === '9x16' ? 5 : aspect === '1x1' ? 4 : 3, cw = Math.floor((1800 - 60 - (cols - 1) * 28) / cols), ch = Math.round(cw * H / W);
  const cueSum = s => { const m = {}; for (const c of tl.cues.filter(c => c.shot === s.id)) m[c.kind] = (m[c.kind] || 0) + 1; return Object.entries(m).map(([k, n]) => `${k}×${n}`).join(' '); };
  const textNote = s => { const a = audits.find(x => x.shot === s.id); if (!a) return ''; const off = a.boxes.filter(b => b.x0 < -1 || b.y0 < -1 || b.x1 > W + 1 || b.y1 > H + 1); return off.length ? `<div class="warn">text clipped: ${esc(off.map(b => b.text).join(' / '))}</div>` : ''; };
  const cards = tl.shots.map((s, i) => `
    <div class="card"><img src="${basename(stills[i])}" style="width:${cw}px;height:${ch}px">
      <div class="meta"><b>${i + 1} · ${esc(s.id)}</b><span>${esc(s.block)}</span><span>${fmtT(s.start)}–${fmtT(s.end)}</span><span>${((s.end - s.start) / tl.beat).toFixed(1).replace(/\.0$/, '')} beats</span></div>
      <div class="copy">${esc(copyOf(s)) || '<i>no copy</i>'}</div>
      <div class="foot">${i < tl.shots.length - 1 ? `out → <b>${esc(s.out)}</b>` : 'end'}${cueSum(s) ? ` · SFX ${esc(cueSum(s))}` : ''}</div>
      ${s.cause ? `<div class="cause"><b>cause</b> ${esc(s.cause)}</div>` : ''}
      ${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}${textNote(s)}</div>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:Inter;font-weight:400;src:url(/skill/node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2)}
    @font-face{font-family:Inter;font-weight:600;src:url(/skill/node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2)}
    @font-face{font-family:Inter;font-weight:700;src:url(/skill/node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2)}
    body{margin:0;background:#F4F4F6;font-family:Inter,sans-serif;color:#111114;width:1800px}
    header{padding:36px 30px 18px;display:flex;align-items:baseline;gap:24px}h1{margin:0;font-size:38px;letter-spacing:-.02em}
    header span{color:#6B6B75;font-size:20px}.grid{display:grid;grid-template-columns:repeat(${cols},${cw}px);gap:28px;padding:10px 30px 40px}
    .card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 0 rgba(0,0,0,.05),0 8px 24px rgba(20,24,40,.06)}
    .card img{display:block;object-fit:cover;background:#ddd}.meta{display:flex;gap:12px;flex-wrap:wrap;padding:14px 16px 4px;font-size:17px;color:#55555E}.meta b{color:#111114}
    .copy{padding:4px 16px 8px;font-size:19px;line-height:1.35;font-weight:600}.foot{padding:0 16px 14px;font-size:15px;color:#6B6B75}
    .note{margin:0 16px 14px;padding:8px 10px;border-radius:8px;background:#F1F5FF;font-size:15px;color:#2B4B8A}
    .cause{margin:0 16px 14px;padding:8px 10px;border-radius:8px;background:#F4F1FF;font-size:15px;color:#4A3A8A}.cause b{font-weight:600;margin-right:4px}
    .warn{margin:0 16px 14px;padding:8px 10px;border-radius:8px;background:#FFF1F0;font-size:15px;color:#A12A1F}
    .warns{margin:0 30px 30px;padding:14px 18px;border-radius:12px;background:#FFF8E6;color:#7A5300;font-size:16px;line-height:1.5}
  </style></head><body><header><h1>${esc(tl.title)}</h1><span>${aspect.replace('x', ':')} · ${tl.dur.toFixed(1)} s · ${tl.bpm} BPM · ${tl.music.style} · ${tl.shots.length} shots${tl.id !== 'main' ? ` · cutdown "${esc(tl.id)}"` : ''}</span></header>
  <div class="grid">${cards}</div>${warns.length ? `<div class="warns"><b>Notes before the film</b><br>${warns.map(esc).join('<br>')}</div>` : ''}</body></html>`;
  writeFileSync(join(dir, 'board.html'), html);
  const server = await serve(job), browser = await launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: 1 })).newPage();
    const rel = join(dir).slice(job.length).split('\\').join('/');
    await page.goto(`${server.base}/job${rel}/board.html`);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => null))));
    const png = join(dir, 'storyboard.png'), pdf = join(dir, 'storyboard.pdf');
    const h = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
    await page.setViewportSize({ width: 1800, height: h });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: png });
    await page.pdf({ path: pdf, width: '1800px', height: `${h + 2}px`, printBackground: true, pageRanges: '1' });
    return { png, pdf };
  } finally { await browser.close(); await server.close(); }
}

// SRT of the on-screen copy (for platforms that want a caption file; the words are already on screen)
export function captions(tl, path) {
  const ts = s => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
  const rows = tl.shots.filter(s => copyOf(s)).map((s, i) => `${i + 1}\n${ts(s.start)} --> ${ts(s.end)}\n${copyOf(s).replace(/ · /g, '\n')}\n`);
  writeFileSync(path, rows.join('\n'));
  return rows.length;
}
export function thumbnail(png, out, W) { ff(['-i', png, '-vf', `scale=${Math.min(W, 1920)}:-2:flags=lanczos`, '-q:v', '2', out], 'thumbnail'); }
export { copyFileSync };
