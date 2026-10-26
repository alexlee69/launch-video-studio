#!/usr/bin/env node
// Phone edition of the storyboard (STORYBOARD.md). `lv.mjs --storyboard` writes one tall 1800 px page with every still as
// a lossless PNG, which can pass the ~30 MB a phone will open. This reads the SAME board.html that run wrote (same cards,
// stills and captions), lays the cards out one per column on 1080 × 1920 portrait pages after a cover page (and the
// board's "Notes before the film" on the last pages), screenshots each page as a JPEG and writes a PDF that embeds those
// JPEGs untouched (DCTDecode, no re-encode).
//
//   node phone.mjs --job DIR [--aspect A] [--cut main] [--cover cover.yaml] [--dpr 1.5] [--quality 80] [--max-mb 25]
//   → DIR/<slug>[-<cut>]-storyboard-<aspect>-phone.pdf + DIR/out/<cut>/<aspect>/board-phone/page-NN.jpg + pages.json
//   --aspect defaults to the film's first aspect; --dpr 1–3, --quality 30–100, --max-mb 1–500.
//
// --cover (YAML or JSON) sets the cover page: title, line, tag, logline, table {title, rows: [[a, b, c], …]}, read
// [lines], footer. Anything left out gets a default; a shot that still shows a placeholder plate (placeholders.py) is
// noticed and said on the cover and in every page's footer.
// Exit codes: 0 done · 1 the PDF is over --max-mb (written; lower --quality or --dpr) · 2 refused (no board, a stale
// board, a bad cover or flag, a card that cannot fit a page, a PDF another tool made in the way, no Chrome) · 5
// unexpected error · 129 / 143 hang-up or kill (the temp PDF is removed).
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync, renameSync, openSync, readSync, closeSync, readdirSync } from 'node:fs';
import { join, resolve, isAbsolute, basename } from 'node:path';
import YAML from 'yaml';
import { ASPECTS, arg, UserError } from '../lib/common.mjs';
import { serve } from '../lib/server.mjs';
import { launch } from '../lib/render.mjs';

class Refuse extends Error {}
const argv = process.argv.slice(2);
const die = (code, m) => { console.error((code >= 2 ? '✗ ' : '! ') + m); process.exit(code); };
const KNOWN = ['--job', '--aspect', '--cut', '--cover', '--dpr', '--quality', '--max-mb'];
const PW = 1080, PH = 1920;                        // CSS px per page (portrait phone)
const CREATOR = 'product-launch-sting video/storyboard/phone.mjs';
let TMP = null, PAGES_TMP = null, LOCK = null;   // the PDF and page folder being written, and this run's lock: removed if it is killed
const cleanup = () => { for (const p of [TMP, PAGES_TMP]) if (p) rmSync(p, { recursive: true, force: true }); if (LOCK) rmSync(LOCK, { force: true }); };
for (const [sig, n] of [['SIGINT', 2], ['SIGTERM', 15], ['SIGHUP', 1]]) process.on(sig, () => { cleanup(); console.error(`\nstopped by ${sig}`); process.exit(128 + n); });
const q = s => /^[\w@%+=:,./-]+$/.test(s) ? s : `'${String(s).replace(/'/g, `'\\''`)}'`;   // a path as a shell argument
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code !== 'ESRCH'; } };

function numArg(k, d, lo, hi) {
  const v = arg(argv, k, null);
  if (v === null) return d;
  const n = Number(v);
  if (v === true || !Number.isFinite(n) || n < lo || n > hi) throw new Refuse(`${k}: a number from ${lo} to ${hi} (got ${v === true ? 'nothing' : v})`);
  return n;
}

// a placeholder plate is a PNG whose tEXt / iTXt chunk is keyed `lv-placeholder` (placeholders.py writes it)
function placeholderKind(file) {
  let fd;
  try {
    if (!/\.png$/i.test(file) || !statSync(file).isFile()) return null;
    fd = openSync(file, 'r');
    const sig = Buffer.alloc(8); readSync(fd, sig, 0, 8, 0);
    if (sig.toString('hex') !== '89504e470d0a1a0a') return null;
    let pos = 8;
    const head = Buffer.alloc(8);
    for (let k = 0; k < 64; k++) {
      if (readSync(fd, head, 0, 8, pos) < 8) return null;
      const len = head.readUInt32BE(0), type = head.toString('latin1', 4, 8);
      if (type === 'IDAT' || type === 'IEND') return null;
      if ((type === 'tEXt' || type === 'iTXt') && len < 1 << 20) {
        const data = Buffer.alloc(len); readSync(fd, data, 0, len, pos + 8);
        const z = data.indexOf(0);
        if (z > 0 && data.toString('latin1', 0, z) === 'lv-placeholder') {
          let text = '';
          if (type === 'tEXt') text = data.toString('latin1', z + 1);
          else if (data[z + 1] === 0) { const a = data.indexOf(0, z + 3), b = a < 0 ? -1 : data.indexOf(0, a + 1); text = b < 0 ? '' : data.toString('utf8', b + 1); }
          let m = {};
          try { m = JSON.parse(text) || {}; } catch { /* a marker we can't read is still a marker */ }
          return { kind: String(m.kind || 'AI FOOTAGE'), id: m.id ? String(m.id) : null, aspect: m.aspect || null, crops: Array.isArray(m.crops) ? m.crops : [] };
        }
      }
      pos += 12 + len;
    }
    return null;
  } catch { return null; } finally { if (fd !== undefined) closeSync(fd); }
}

// every string in a shot (its note aside) that names a file in the job: what the board's still was drawn from
function shotFiles(job, s) {
  const refs = [];
  const walk = v => { if (typeof v === 'string') { if (v.length < 400 && /[./]/.test(v) && !/[\n*|]/.test(v)) refs.push(v); } else if (v && typeof v === 'object') for (const x of Object.values(v)) walk(x); };
  walk(Object.fromEntries(Object.entries(s).filter(([k]) => k !== 'note')));
  return [...new Set(refs)].map(r => ({ ref: r, path: isAbsolute(r) ? r : join(job, r) })).filter(f => { try { return statSync(f.path).isFile(); } catch { return false; } });
}

// the fields that make the engine move or dim a shot's bg (STORYBOARD.md: a plate shot sets none of them)
function moves(s) {
  const out = [];
  if (s.bgMove !== 'none') out.push('bgMove');
  if (s.bgDim !== 0) out.push('bgDim');
  if (s.push !== 0) out.push('push');
  const z = s.zoom;
  if (z != null && (z && typeof z === 'object' ? Object.values(z).some(v => v !== 1) : z !== 1)) out.push('zoom');
  for (const k of ['offset', 'pan', 'move']) { const v = s[k]; if (v != null && !(Array.isArray(v) && (!v.length || (v.length === 2 && v[0] === 0 && v[1] === 0))) && !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)) out.push(k); }
  if (s.letterbox != null && s.letterbox !== false && s.letterbox !== 0) out.push('letterbox');      // the bars sit over the label
  return out;
}

function shotPlaceholders(job, tl, aspect) {
  const hits = [];
  for (const s of tl.shots) {
    const plates = shotFiles(job, s).map(f => ({ ...f, meta: placeholderKind(f.path) })).filter(f => f.meta);
    if (!plates.length) continue;
    const bg = plates.find(f => f.ref === s.bg), first = bg || plates[0];
    hits.push({ shot: s.id, file: first.ref, kind: first.meta.kind, id: first.meta.id || s.id, moves: bg ? moves(s) : [],
      unfit: bg && bg.meta.aspect && bg.meta.aspect !== aspect && !bg.meta.crops.includes(aspect) });
  }
  return hits;
}

function loadCover(file, tl, aspect, slug, cutName, holders) {
  const date = new Date(), ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const kind = holders.length ? holders[0].kind : null;
  const desktop = `${slug}${cutName}-storyboard-${aspect}.pdf`;
  const cover = {
    title: tl.title,
    line: `Storyboard · ${aspect.replace('x', ':')} · DRAFT · ${ymd}`,
    tag: holders.length ? `Storyboard only: ${holders.length} of ${tl.shots.length} shots show a labelled placeholder plate` : null,
    logline: null, table: null,
    read: [
      `${tl.shots.length} panels, one still per shot (${tl.dur.toFixed(2)} s).`,
      'Bold line under each still = every word on screen in that shot. Blue box = the shot’s note.',
      ...(holders.length ? [`“${kind} · ${holders[0].id}”-style plates are code-drawn placeholders: no image or video has been generated yet. They show composition, not faces, light or weather.`] : []),
      { text: 'Full-resolution sheet for desktop: ', file: desktop, after: '.' },
    ],
    footer: holders.length ? 'DRAFT · placeholder plates, nothing generated' : 'DRAFT',
  };
  if (!file) return cover;
  let raw;
  try { raw = YAML.parse(readFileSync(file, 'utf8')); } catch (e) { throw new Refuse(`--cover ${file}: not readable YAML/JSON (${e.message.split('\n')[0]})`); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Refuse(`--cover ${file}: an object with title, line, tag, logline, table, read, footer`);
  const errs = [], str = (k, v) => { if (v !== null && (typeof v !== 'string' || !v.trim())) errs.push(`${k}: text, or null to leave it out`); };
  for (const [k, v] of Object.entries(raw)) {
    if (k === '_note') continue;
    if (['title', 'line', 'tag', 'logline', 'footer'].includes(k)) str(k, v);
    else if (k === 'read') { if (!Array.isArray(v) || v.some(x => typeof x !== 'string' || !x.trim())) errs.push('read: a list of lines (quote a line that holds ": ", or YAML reads it as a key)'); }
    else if (k === 'table') {
      if (v !== null && (typeof v !== 'object' || Array.isArray(v) || typeof v.title !== 'string' || !Array.isArray(v.rows) || !v.rows.length
        || v.rows.some(r => !Array.isArray(r) || r.length !== 3 || r.some(c => typeof c !== 'string' && typeof c !== 'number'))
        || Object.keys(v).some(x => !['title', 'rows'].includes(x)))) errs.push('table: {title, rows: [[a, b, c], …]} with three cells a row');
    } else errs.push(`unknown key "${k}" (title, line, tag, logline, table, read, footer)`);
  }
  if (errs.length) throw new Refuse(`--cover ${file}:\n  ${errs.join('\n  ')}`);
  for (const [k, v] of Object.entries(raw)) if (k !== '_note') cover[k] = v;
  if (cover.title === null) cover.title = tl.title;
  return cover;
}

// the /Creator of an existing PDF (ours writes it as a literal string), or null
function pdfCreator(file) {
  const t = readFileSync(file).toString('latin1');
  const lit = t.match(/\/Creator\s*\(((?:\\.|[^\\)])*)\)/);
  if (lit) return lit[1].replace(/\\(.)/g, '$1');
  const hex = t.match(/\/Creator\s*<([0-9A-Fa-f\s]*)>/);
  if (!hex) return null;
  const b = Buffer.from(hex[1].replace(/\s/g, ''), 'hex');
  return b[0] === 0xFE && b[1] === 0xFF ? Buffer.from(b.subarray(2)).swap16().toString('utf16le') : b.toString('latin1');
}

// Minimal PDF: one JPEG per page, embedded as-is (DCTDecode), drawn full-page at PW/2 × PH/2 pt.
function writePdf(pages, pdf, title) {
  const jpegSize = buf => {                                   // read SOF0–SOF3 for width / height / components
    for (let i = 2; i + 9 < buf.length;) {
      if (buf[i] !== 0xFF) throw new Error('bad JPEG marker');
      const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
      if (m >= 0xC0 && m <= 0xC3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7), c: buf[i + 9] };
      i += 2 + len;
    }
    throw new Error('no SOF in JPEG');
  };
  const PTW = PW / 2, PTH = PH / 2, chunks = [], offs = [];
  let pos = 0;
  const put = b => { const x = Buffer.isBuffer(b) ? b : Buffer.from(b, 'binary'); chunks.push(x); pos += x.length; };
  const obj = (n, body) => { offs[n] = pos; put(`${n} 0 obj\n`); for (const b of [].concat(body)) put(b); put('\nendobj\n'); };
  const utf16 = s => '<FEFF' + Buffer.from(String(s), 'utf16le').swap16().toString('hex').toUpperCase() + '>';
  put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const N = pages.length, kids = pages.map((_, k) => `${3 + 3 * k} 0 R`).join(' ');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Count ${N} /Kids [${kids}] >>`);
  pages.forEach((p, k) => {
    const img = readFileSync(p), { w, h, c } = jpegSize(img), n = 3 + 3 * k;
    if (c !== 3) throw new Error(`${p}: expected an RGB JPEG, got ${c} components`);
    const cs = `q ${PTW} 0 0 ${PTH} 0 0 cm /Im0 Do Q`;
    obj(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PTW} ${PTH}] /Resources << /XObject << /Im0 ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`);
    obj(n + 1, [`<< /Length ${cs.length} >>\nstream\n`, cs, '\nendstream']);
    obj(n + 2, [`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`, img, '\nendstream']);
  });
  const info = 3 + 3 * N;
  obj(info, `<< /Title ${utf16(`${title}: storyboard, phone edition`)} /Creator (${CREATOR}) >>`);
  const xref = pos;
  put(`xref\n0 ${info + 1}\n0000000000 65535 f \n`);
  for (let n = 1; n <= info; n++) put(`${String(offs[n]).padStart(10, '0')} 00000 n \n`);
  put(`trailer\n<< /Size ${info + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  TMP = `${pdf}.tmp-${process.pid}`;
  rmSync(TMP, { force: true });                    // a leftover (or a link) at the temp path is removed, never written through
  try { writeFileSync(TMP, Buffer.concat(chunks), { flag: 'wx' }); renameSync(TMP, pdf); } finally { rmSync(TMP, { force: true }); TMP = null; }
}

async function main() {
  for (const a of argv) if (a.startsWith('--') && !KNOWN.includes(a)) throw new Refuse(`unknown flag ${a} (${KNOWN.join(', ')})`);
  const j = arg(argv, '--job', null);
  if (!j || j === true) throw new Refuse('missing --job DIR (the folder that holds beats.yaml)');
  const job = resolve(j), cut = String(arg(argv, '--cut', 'main'));
  if (!/^[A-Za-z0-9_-]+$/.test(cut)) throw new Refuse(`--cut: a cut name (got ${cut})`);
  const DPR = numArg('--dpr', 1.5, 1, 3), QUALITY = Math.round(numArg('--quality', 80, 30, 100)), MAX_MB = numArg('--max-mb', 25, 1, 500);
  const tlPath = join(job, 'out', cut, 'timeline.json');
  const lv = `node $V/lv.mjs --job ${q(job)}`;
  if (!existsSync(tlPath)) throw new Refuse(`no ${tlPath}: run ${lv} --storyboard${cut === 'main' ? '' : ' --cut ' + cut} first`);
  let tl;
  try { tl = JSON.parse(readFileSync(tlPath, 'utf8')); } catch (e) { throw new Refuse(`${tlPath} is not readable JSON (${e.message}): run ${lv} --storyboard again`); }
  if (!tl || !Array.isArray(tl.shots)) throw new Refuse(`${tlPath} is not a timeline lv.mjs wrote: run ${lv} --storyboard again`);
  const aspect = String(arg(argv, '--aspect', (tl.aspects || ['16x9'])[0]));
  if (!ASPECTS[aspect]) throw new Refuse(`--aspect: one of ${Object.keys(ASPECTS).join(', ')} (got ${aspect})`);
  const BOARD = join(job, 'out', cut, aspect, 'board'), OUT = join(job, 'out', cut, aspect, 'board-phone');
  const html = join(BOARD, 'board.html');
  if (!existsSync(html)) throw new Refuse(`no ${html}: run ${lv} --storyboard --aspect ${aspect}${cut === 'main' ? '' : ' --cut ' + cut} first`);
  const made = statSync(html).mtimeMs, again = `run ${lv} --storyboard${aspect === (tl.aspects || [])[0] ? '' : ' --aspect ' + aspect}${cut === 'main' ? '' : ' --cut ' + cut} again, so the phone edition shows the board as it is now`;
  const beats = join(job, 'beats.yaml');
  if (existsSync(beats) && statSync(beats).mtimeMs > made) throw new Refuse(`beats.yaml changed after the storyboard was made: ${again}`);
  const brand = { id: 'brand', ...(tl.brand || {}) };                 // the logo, font and cast files every still uses
  const blocks = Object.entries(tl.customBlocks || {}).map(([k, v]) => ({ id: `block ${k}`, file: String(v).replace(/^\/job\//, '') }));
  const newer = [...tl.shots, brand, ...blocks].flatMap(s => shotFiles(job, s).filter(f => statSync(f.path).mtimeMs > made).map(f => `${s.id}: ${f.ref}`));
  if (newer.length) throw new Refuse(`${newer.length} file${newer.length > 1 ? 's' : ''} changed after the storyboard was made (${newer.slice(0, 4).join(', ')}${newer.length > 4 ? ', …' : ''}): ${again}`);
  const coverFile = arg(argv, '--cover', null);
  if (coverFile === true) throw new Refuse('--cover: a YAML or JSON file');
  if (coverFile && !existsSync(coverFile)) throw new Refuse(`--cover: no file ${coverFile}`);
  const cutName = cut === 'main' ? '' : '-' + cut, slug = tl.slug || 'storyboard';
  const PDF = join(job, `${slug}${cutName}-storyboard-${aspect}-phone.pdf`);
  for (const f of readdirSync(job)) {                // a killed run's temp PDF (only when that process is gone)
    const m = f.startsWith(basename(PDF) + '.tmp-') && f.slice(basename(PDF).length + 5);
    if (!m || !/^\d+$/.test(m)) continue;
    try { process.kill(Number(m), 0); continue; } catch (e) { if (e.code !== 'ESRCH') continue; }
    rmSync(join(job, f), { force: true });
  }
  if (existsSync(PDF)) {
    let c = null;
    try { c = pdfCreator(PDF); } catch { /* unreadable: not ours */ }
    if (c !== CREATOR) throw new Refuse(`${PDF} exists and was not made by this tool (Creator: ${c || 'none'}): move or rename it, then run again`);
  }
  // one run per board at a time: a second would overwrite the first's pages mid-build
  LOCK = join(job, 'out', cut, aspect, 'board-phone.lock');
  for (let k = 0; k < 2; k++) {
    try { writeFileSync(LOCK, String(process.pid), { flag: 'wx' }); break; } catch (e) {
      if (e.code !== 'EEXIST') { LOCK = null; throw new Refuse(`cannot write ${join(job, 'out', cut, aspect)} (${e.code})`); }
      const other = Number(readFileSync(LOCK, 'utf8'));
      if (k === 0 && !(other > 0 && alive(other))) { rmSync(LOCK, { force: true }); continue; }   // a killed run's lock
      LOCK = null;
      throw new Refuse(`another phone.mjs run (pid ${other || '?'}) is making this board's phone edition: wait for it, or stop it`);
    }
  }
  for (const f of readdirSync(join(job, 'out', cut, aspect))) {          // a killed run's page folder
    const m = f.match(/^board-phone\.tmp-(\d+)$/);
    if (m && !alive(Number(m[1]))) rmSync(join(job, 'out', cut, aspect, f), { recursive: true, force: true });
  }
  const holders = shotPlaceholders(job, tl, aspect);
  const cover = loadCover(coverFile, tl, aspect, slug, cutName, holders);
  const { W, H } = ASPECTS[aspect];
  const iw = Math.min(PW - 80, Math.round(1100 * W / H)), ih = Math.round(iw * H / W);      // a still on a phone page

  const server = await serve(job), browser = await launch();
  const pages = [];
  let res;
  try {
    const ctx = await browser.newContext({ viewport: { width: PW, height: PH }, deviceScaleFactor: DPR });
    const page = await ctx.newPage();
    await page.goto(`${server.base}/job/out/${cut}/${aspect}/board/board.html`);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => null))));
    res = await page.evaluate(({ PW, PH, cover, nShots, iw, ih }) => {
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
        .card img{width:${iw}px!important;height:${ih}px!important;margin:0 auto}
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
        .cv ul{margin:0;padding-left:30px}.cv li{font-size:24px;line-height:1.45;margin-bottom:10px;color:#2B2B33}
        .cv .fn{font-feature-settings:"calt" 0}`;
      const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
      const cards = [...document.querySelectorAll('.grid > .card')];
      if (cards.length !== nShots) return { error: `the board has ${cards.length} cards but the timeline ${nShots} shots: run lv.mjs --storyboard again` };
      const broken = cards.map((c, i) => [i, c.querySelector('img')]).filter(([, im]) => !im || !im.complete || !im.naturalWidth)
        .map(([i, im]) => `card ${i + 1} (${im ? decodeURIComponent(im.getAttribute('src') || '') : 'no still'})`);
      if (broken.length) return { error: `${broken.length} still${broken.length > 1 ? 's' : ''} did not load: ${broken.slice(0, 5).join(', ')}${broken.length > 5 ? ', …' : ''}: run lv.mjs --storyboard again` };
      const meas = document.createElement('div'); meas.className = 'col'; document.body.appendChild(meas);
      cards.forEach(c => meas.appendChild(c));
      const AVAIL = PH - 108 - 52 - 24, GAP = 28, shrunk = [];
      const hs = cards.map((c, i) => {                // a card taller than a page gives up still height, never its words
        let h = c.getBoundingClientRect().height;
        if (h > AVAIL) {
          const img = c.querySelector('img'), nh = ih - Math.ceil(h - AVAIL);
          if (!img || nh < ih * .5) return -1;
          img.style.setProperty('height', `${nh}px`, 'important'); img.style.setProperty('width', `${Math.round(nh * iw / ih)}px`, 'important');
          h = c.getBoundingClientRect().height;
          shrunk.push({ card: i + 1, pct: Math.round(100 * nh / ih) });
        }
        return h;
      });
      const big = hs.findIndex(h => h < 0 || h > AVAIL);
      if (big >= 0) return { error: `card ${big + 1}'s copy and note are too long for a phone page even with a half-height still: shorten its note` };
      const groups = []; let cur = [], used = 0;
      hs.forEach((h, i) => {
        const need = cur.length ? used + GAP + h : h;
        if (need > AVAIL) { groups.push(cur); cur = [i]; used = h; } else { cur.push(i); used = need; }
      });
      if (cur.length) groups.push(cur);
      // the board's "Notes before the film" (reading time, shrunk or clipped copy …): one list item a note, paged
      const warnsEl = document.querySelector('body>.warns');
      const notes = warnsEl ? warnsEl.innerHTML.split(/<br\s*\/?>/i).slice(1).map(s => s.trim()).filter(Boolean) : [];
      const noteGroups = [];
      if (notes.length) {
        const nm = document.createElement('div'); nm.className = 'col cv'; document.body.appendChild(nm);
        nm.innerHTML = `<h2>Notes before the film</h2><ul>${notes.map(n => `<li>${n}</li>`).join('')}</ul>`;
        const head = nm.querySelector('h2').getBoundingClientRect().height + 48;
        let g = [], u = head;
        [...nm.querySelectorAll('li')].forEach((li, i) => {
          const h = li.getBoundingClientRect().height + 10;
          if (g.length && u + h > AVAIL) { noteGroups.push(g); g = []; u = head; }
          g.push(i); u += h;
        });
        if (g.length) noteGroups.push(g);
        nm.remove();
      }
      const total = groups.length + noteGroups.length + 1;
      const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const mk = (k, label) => {
        const pp = document.createElement('div'); pp.className = 'pp';
        pp.innerHTML = `<div class="pp-h">${esc(cover.title)}<span>${esc(label)} · page ${k} of ${total}</span></div>
          <div class="pp-f">${esc(cover.footer || '')}</div>`;
        const b = document.createElement('div'); b.className = 'pp-b'; pp.appendChild(b); document.body.appendChild(pp); return b;
      };
      const cb = mk(1, 'cover'); cb.classList.add('cv');
      cb.innerHTML = `<h1>${esc(cover.title)}</h1>${cover.line ? `<div class="ln">${esc(cover.line)}</div>` : ''}
        <div class="ln">${esc(document.querySelector('body>header span')?.textContent || '')}</div>
        ${cover.tag ? `<div class="tag">${esc(cover.tag)}</div>` : ''}
        ${cover.logline ? `<p>${esc(cover.logline)}</p>` : ''}
        ${cover.table ? `<h2>${esc(cover.table.title)}</h2><table>${cover.table.rows.map(r => `<tr><td class="k">${esc(r[0])}</td><td class="s">${esc(r[1])}</td><td class="p">${esc(r[2])}</td></tr>`).join('')}</table>` : ''}
        ${cover.read && cover.read.length ? `<h2>How to read it</h2><ul>${cover.read.map(t => `<li>${typeof t === 'string' ? esc(t) : `${esc(t.text)}<span class="fn">${esc(t.file)}</span>${esc(t.after)}`}</li>`).join('')}</ul>` : ''}`;
      const map = [];
      groups.forEach((g, j) => {
        const ids = g.map(i => (cards[i].querySelector('.meta b')?.textContent || '').split('·').slice(1).join('·').trim() || String(i + 1));
        const b = mk(j + 2, ids.length > 1 ? `${ids[0]}–${ids[ids.length - 1]}` : ids[0]);
        g.forEach(i => b.appendChild(cards[i]));
        map.push(ids);
      });
      noteGroups.forEach((g, j) => {                  // the notes came from board.html, already escaped by the board
        const b = mk(groups.length + j + 2, 'notes'); b.classList.add('cv');
        b.innerHTML = `<h2>Notes before the film${noteGroups.length > 1 ? ` (${j + 1} of ${noteGroups.length})` : ''}</h2><ul>${g.map(i => `<li>${notes[i]}</li>`).join('')}</ul>`;
      });
      meas.remove();
      const over = [...document.querySelectorAll('.pp-b')].map(b => b.getBoundingClientRect().bottom - b.parentElement.getBoundingClientRect().top).findIndex(y => y > PH - 52);
      if (over >= 0) return { error: over === 0 ? 'the cover runs into the footer: shorten the cover\'s logline, table or read list' : `page ${over + 1} runs into the footer` };
      return { pages: total, map, shrunk, notes: notes.length };
    }, { PW, PH, cover, nShots: tl.shots.length, iw, ih });
    if (res.error) throw new Refuse(res.error);
    await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => null))));
    PAGES_TMP = `${OUT}.tmp-${process.pid}`;
    rmSync(PAGES_TMP, { recursive: true, force: true });
    mkdirSync(PAGES_TMP, { recursive: true });
    const els = await page.$$('.pp');
    for (let k = 0; k < els.length; k++) {
      const p = join(PAGES_TMP, `page-${String(k + 1).padStart(2, '0')}.jpg`);
      await els[k].screenshot({ path: p, type: 'jpeg', quality: QUALITY });
      pages.push(p);
    }
    writeFileSync(join(PAGES_TMP, 'pages.json'), JSON.stringify({ aspect, dpr: DPR, quality: QUALITY, page_px: [PW * DPR, PH * DPR], cover: 1, shots_per_page: res.map,
      notes: res.notes, placeholders: holders.map(h => h.shot), shrunk: res.shrunk }, null, 1));
  } finally { await browser.close(); await server.close(); }
  writePdf(pages, PDF, cover.title);
  rmSync(OUT, { recursive: true, force: true });        // the finished pages replace the last run's
  renameSync(PAGES_TMP, OUT); PAGES_TMP = null;
  rmSync(LOCK, { force: true }); LOCK = null;
  const mb = statSync(PDF).size / 1e6;
  console.log(`→ ${PDF}: ${pages.length} pages (cover + ${res.map.length}${res.notes ? ` + ${pages.length - 1 - res.map.length} of notes` : ''}), ${mb.toFixed(2)} MB, JPEG q${QUALITY} at ${PW * DPR}x${PH * DPR}`);
  for (const s of res.shrunk) console.log(`  ! card ${s.card}: its still shrunk to ${s.pct}% so its note fits one page`);
  if (holders.length) console.log(`  ${holders.length} shot${holders.length > 1 ? 's' : ''} on placeholder plates: ${holders.map(h => h.shot).join(', ')}`);
  const moving = holders.filter(h => h.moves.length).map(h => `${h.shot} (${h.moves.join(', ')})`);
  if (moving.length) console.log(`  ! the engine moves, dims or covers these plates, so the board cuts their labels: ${moving.join('; ')}. Set bgMove: none, bgDim: 0, push: 0 and leave out zoom / offset / pan / move / letterbox on a plate shot.`);
  const unfit = holders.filter(h => h.unfit).map(h => h.shot);
  if (unfit.length) console.log(`  ! ${unfit.join(', ')}: the plate was drawn with no ${aspect.replace('x', ':')} crop, so its label can be cut here: add "${aspect}" to the spec's crops and draw again.`);
  if (mb > MAX_MB) die(1, `the PDF is ${mb.toFixed(2)} MB, over --max-mb ${MAX_MB}: lower --quality or --dpr`);
}

main().catch(e => {
  cleanup();
  if (e instanceof Refuse || e instanceof UserError) die(2, e.message);
  console.error(e && e.stack || e);
  die(5, `unexpected error: ${e && e.message}`);
});
