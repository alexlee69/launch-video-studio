// Phone edition of the skill's storyboard sheet (job-local tool; the skill is only imported, never edited).
//
// The skill's `--storyboard` writes one tall 1800 px page with every still as a lossless PNG, which can pass the 30 MB a
// phone will open. This tool reads the SAME board.html the skill wrote (same cards, same stills, same captions), lays the
// cards out in one column on 1080 x 1920 portrait pages with a cover page, screenshots each page as a JPEG and writes a
// PDF that embeds those JPEGs untouched (DCTDecode, no re-encode).
//
//   node tools/phone_storyboard.mjs [--dpr 1.5] [--quality 80] [--max-mb 25]
//   → manus2-space-storyboard-16x9-phone.pdf (job root) + out/main/16x9/board-phone/page-NN.jpg
// Exits 1 if a card does not fit a page, a card or still is missing, or the PDF is over --max-mb.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const LIB = join(homedir(), '.claude/skills/product-launch-sting/video/lib');
const { serve } = await import(pathToFileURL(join(LIB, 'server.mjs')).href);
const { launch } = await import(pathToFileURL(join(LIB, 'render.mjs')).href);

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const DPR = arg('--dpr', 1.5), QUALITY = arg('--quality', 80), MAX_MB = arg('--max-mb', 25);
const JOB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BOARD = join(JOB, 'out/main/16x9/board');
const OUT = join(JOB, 'out/main/16x9/board-phone');
const PDF = join(JOB, 'manus2-space-storyboard-16x9-phone.pdf');
const PW = 1080, PH = 1920;                       // CSS px per page (portrait phone)
const die = m => { console.error('FAIL ' + m); process.exit(1); };

if (!existsSync(join(BOARD, 'board.html'))) die('no board.html: run lv.mjs --storyboard first');
const tl = JSON.parse(readFileSync(join(JOB, 'out/main/timeline.json'), 'utf8'));

// Cover-page facts (from the job's own timeline and the final story; nothing invented here)
const cover = {
  title: tl.title,
  line: 'Astronaut storyboard · DRAFT v0.1 for Alex’s review · 2026-10-23',
  logline: 'Mid-spacewalk, an astronaut gets Marketing’s email: the launch moved up, the film is due tonight. With five deadpan prompts from her wrist display she has Manus 2.0 recast every disaster that follows as a serene launch film for the station’s new guest module, and it ships while she is in radio blackout. Then, bobbing on the ocean, she gets the next brief.',
  prompts: [
    ['P1', 'S04', '0:21.73', 'Lull launch film. 30s. Make it calm.'],
    ['P2', 'S09', '0:30.43', 'Open on this drift.'],
    ['P3', 'S14', '0:39.37', 'Call it shooting stars.'],
    ['P4', 'S22', '0:54.70', 'Red alarm? Mood lighting.'],
    ['P5', 'S24', '1:03.17', 'End on this glow. Ship it.'],
  ],
  read: [
    '27 panels, one still per shot, on higgsfield01’s cut frames (76.53 s, 30 fps).',
    'Bold line under each still = every word on screen in that shot. Blue box = what happens, the motion, and any “Check with Manus” flag.',
    '“AI FOOTAGE · Sxx” plates are code-drawn placeholders: no image or video has been generated yet. They show composition, not her face, light or weather.',
    'Prompt bar, status cards, editor, bubbles and end card are built as they would ship; the Manus marks are the official files, unaltered.',
    'No reference frames are in this file. Full-resolution sheet for desktop: manus2-space-storyboard-16x9.pdf.',
  ],
};

const server = await serve(JOB), browser = await launch();
let pages = [];
try {
  const ctx = await browser.newContext({ viewport: { width: PW, height: PH }, deviceScaleFactor: DPR });
  const page = await ctx.newPage();
  await page.goto(`${server.base}/job/out/main/16x9/board/board.html`);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => null))));
  const res = await page.evaluate(({ PW, PH, cover, nShots }) => {
    const css = `
      body{width:${PW}px!important;margin:0;background:#E9E9EE}
      body>header,body>.grid,body>.warns{display:none!important}
      .pp{position:relative;width:${PW}px;height:${PH}px;overflow:hidden;background:#F4F4F6;font-family:Inter,sans-serif;color:#111114}
      .pp-h{position:absolute;left:0;right:0;top:0;height:84px;display:flex;align-items:center;justify-content:space-between;padding:0 40px;background:#111114;color:#fff;font-size:26px;font-weight:600}
      .pp-h span{font-weight:400;color:#C9C9D1;font-size:22px}
      .pp-f{position:absolute;left:0;right:0;bottom:0;height:52px;display:flex;align-items:center;justify-content:center;color:#6B6B75;font-size:19px;border-top:1px solid #DDDDE3}
      .pp-b{position:absolute;left:40px;right:40px;top:108px;display:flex;flex-direction:column;gap:28px}
      .col{width:${PW - 80}px;display:flex;flex-direction:column;gap:28px}
      .card{width:${PW - 80}px}
      .card img{width:${PW - 80}px!important;height:${Math.round((PW - 80) * 9 / 16)}px!important}
      .card .meta{font-size:25px;gap:16px;padding:18px 22px 4px}
      .card .copy{font-size:31px;padding:6px 22px 10px;line-height:1.3}
      .card .foot{font-size:21px;padding:0 22px 16px}
      .card .note{font-size:24px;line-height:1.42;margin:0 22px 20px;padding:12px 16px;border-radius:10px}
      .card .warn{font-size:22px;margin:0 22px 20px}
      .cv h1{font-size:64px;letter-spacing:-.02em;margin:0 0 10px}
      .cv .ln{font-size:26px;color:#6B6B75;margin-bottom:6px}
      .cv .tag{display:inline-block;margin:18px 0 26px;padding:8px 14px;border-radius:8px;background:#FFF1F0;color:#A12A1F;font-size:23px;font-weight:600}
      .cv h2{font-size:28px;margin:34px 0 14px}
      .cv p{font-size:27px;line-height:1.45;margin:0}
      .cv table{border-collapse:collapse;width:100%;font-size:25px}
      .cv td{padding:11px 10px;border-bottom:1px solid #DDDDE3;vertical-align:top}
      .cv td.k{font-weight:700;width:60px}.cv td.s{color:#6B6B75;width:200px}
      .cv td.p{font-weight:600}
      .cv ul{margin:0;padding-left:30px}.cv li{font-size:24px;line-height:1.45;margin-bottom:10px;color:#2B2B33}`;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const cards = [...document.querySelectorAll('.grid > .card')];
    if (cards.length !== nShots) return { error: `board has ${cards.length} cards, timeline ${nShots} shots` };
    // measure each card in a one-column layout
    const meas = document.createElement('div'); meas.className = 'col'; document.body.appendChild(meas);
    cards.forEach(c => meas.appendChild(c));
    const hs = cards.map(c => c.getBoundingClientRect().height);
    const AVAIL = PH - 108 - 52 - 24, GAP = 28;
    const big = hs.findIndex(h => h > AVAIL);
    if (big >= 0) return { error: `card ${big + 1} is ${Math.ceil(hs[big])} px, a page holds ${AVAIL}` };
    const groups = []; let cur = [], used = 0;
    hs.forEach((h, i) => {
      const need = cur.length ? used + GAP + h : h;
      if (need > AVAIL) { groups.push(cur); cur = [i]; used = h; } else { cur.push(i); used = need; }
    });
    if (cur.length) groups.push(cur);
    const total = groups.length + 1;
    const mk = (k, label) => {
      const pp = document.createElement('div'); pp.className = 'pp';
      pp.innerHTML = `<div class="pp-h">${cover.title}<span>${label} · page ${k} of ${total}</span></div>
        <div class="pp-f">DRAFT v0.1 for Alex · placeholder plates, nothing generated · no reference frames</div>`;
      const b = document.createElement('div'); b.className = 'pp-b'; pp.appendChild(b); document.body.appendChild(pp); return b;
    };
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const cb = mk(1, 'cover'); cb.classList.add('cv');
    cb.innerHTML = `<h1>${esc(cover.title)}</h1><div class="ln">${esc(cover.line)}</div>
      <div class="ln">${esc(document.querySelector('body>header span')?.textContent || '')}</div>
      <div class="tag">Storyboard only: every live-action plate is a labelled placeholder</div>
      <p>${esc(cover.logline)}</p>
      <h2>The five prompts (the plot), each sent on higgsfield01’s send frame</h2>
      <table>${cover.prompts.map(r => `<tr><td class="k">${r[0]}</td><td class="s">${r[1]} · ${r[2]}</td><td class="p">${esc(r[3])}</td></tr>`).join('')}</table>
      <h2>How to read it</h2><ul>${cover.read.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
    const map = [];
    groups.forEach((g, j) => {
      const ids = g.map(i => cards[i].querySelector('.meta b').textContent.split('·')[1].trim());
      const b = mk(j + 2, ids.length > 1 ? `${ids[0]}–${ids[ids.length - 1]}` : ids[0]);
      g.forEach(i => b.appendChild(cards[i]));
      map.push(ids);
    });
    meas.remove();
    const over = [...document.querySelectorAll('.pp-b')].map((b, k) => b.getBoundingClientRect().bottom - b.parentElement.getBoundingClientRect().top).findIndex(y => y > PH - 52);
    if (over >= 0) return { error: `page ${over + 1} content runs into the footer` };
    return { pages: total, map };
  }, { PW, PH, cover, nShots: tl.shots.length });
  if (res.error) die(res.error);
  await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => null))));
  if (existsSync(OUT)) rmSync(OUT, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  const els = await page.$$('.pp');
  for (let k = 0; k < els.length; k++) {
    const p = join(OUT, `page-${String(k + 1).padStart(2, '0')}.jpg`);
    await els[k].screenshot({ path: p, type: 'jpeg', quality: QUALITY });
    pages.push(p);
  }
  writeFileSync(join(OUT, 'pages.json'), JSON.stringify({ dpr: DPR, quality: QUALITY, page_px: [PW * DPR, PH * DPR], cover: 1, shots_per_page: res.map }, null, 1));
} finally { await browser.close(); await server.close(); }

// Minimal PDF: one JPEG per page, embedded as-is (DCTDecode), drawn full-page at 540 x 960 pt.
const jpegSize = buf => {                                   // read SOF0/SOF2 for width / height / components
  for (let i = 2; i < buf.length;) {
    if (buf[i] !== 0xFF) die('bad JPEG marker');
    const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (m >= 0xC0 && m <= 0xC3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7), c: buf[i + 9] };
    i += 2 + len;
  }
  die('no SOF in JPEG');
};
const PTW = PW / 2, PTH = PH / 2, chunks = [], offs = [];
let pos = 0;
const put = b => { const x = Buffer.isBuffer(b) ? b : Buffer.from(b, 'binary'); chunks.push(x); pos += x.length; };
const obj = (n, body) => { offs[n] = pos; put(`${n} 0 obj\n`); for (const b of [].concat(body)) put(b); put('\nendobj\n'); };
put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
const N = pages.length, kids = pages.map((_, k) => `${3 + 3 * k} 0 R`).join(' ');
obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
obj(2, `<< /Type /Pages /Count ${N} /Kids [${kids}] >>`);
pages.forEach((p, k) => {
  const img = readFileSync(p), { w, h, c } = jpegSize(img), n = 3 + 3 * k;
  if (c !== 3) die(`${p}: expected an RGB JPEG, got ${c} components`);
  const cs = `q ${PTW} 0 0 ${PTH} 0 0 cm /Im0 Do Q`;
  obj(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PTW} ${PTH}] /Resources << /XObject << /Im0 ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`);
  obj(n + 1, [`<< /Length ${cs.length} >>\nstream\n`, cs, '\nendstream']);
  obj(n + 2, [`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`, img, '\nendstream']);
});
const info = 3 + 3 * N;
obj(info, '<< /Title (Manus 2.0 - The Lull: storyboard, phone edition, DRAFT v0.1) /Creator (manus2-space tools/phone_storyboard.mjs) >>');
const xref = pos;
put(`xref\n0 ${info + 1}\n0000000000 65535 f \n`);
for (let n = 1; n <= info; n++) put(`${String(offs[n]).padStart(10, '0')} 00000 n \n`);
put(`trailer\n<< /Size ${info + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
writeFileSync(PDF, Buffer.concat(chunks));
const mb = statSync(PDF).size / 1e6;
console.log(`→ ${PDF}: ${N} pages (cover + ${N - 1}), ${mb.toFixed(2)} MB, JPEG q${QUALITY} at ${PW * DPR}x${PH * DPR}`);
if (mb > MAX_MB) die(`PDF is ${mb.toFixed(2)} MB, over ${MAX_MB} MB`);
