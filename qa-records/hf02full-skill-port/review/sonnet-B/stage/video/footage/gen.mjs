#!/usr/bin/env node
// AI footage through the user's own fal.ai key: fal's REST queue (no npm packages), downloads with curl. A dry run — no
// network, no files — until --go: show the user the request and the cost, generate once they approve the spend.
//
//   node gen.mjs still --prompt <text|@file.txt> --out <prefix> [--n 1-4] [--aspect 16:9|9:16|1:1|4:3|3:4|21:9|9:21]
//                [--seed N] [--raw true|false] [--endpoint fal-ai/flux-pro/v1.1-ultra]   key frames → <prefix>_0.jpg, _1.jpg …
//   node gen.mjs video --image <key.jpg|.png> --prompt <text|@file> --out <file.mp4> [--sec 5-10] [--res 480P|768P|1080P]
//                [--seed N] [--endpoint minimax/h3-max/image-to-video]                  image-to-video from a key frame
//   node gen.mjs video --guide <guide.mp4, ≤ 15 s> --prompt <…> --out <file.mp4> [--aspect 16:9|9:16|1:1] [--sec 5-15]
//                [--res …] [--seed N]       minimax/h3-max/reference-to-video: the guide sets timing and framing, not the look
//   node gen.mjs raw <endpoint> <input.json> --out <path>     any endpoint; "@file" strings in *_url / *_urls fields → data
//                                                             URIs (paths relative to input.json)
//   node gen.mjs fetch <request_id> --endpoint <endpoint> --out <path>   re-poll / re-download (resuming) a cut-off request
//   still / video / raw also take [--go] [--force] [--timeout 900] [--env FILE]; fetch [--timeout] [--env] [--force]
// Defaults: stills raw, jpeg, 2 images, 16:9; video 1080P, 5 s (reference-to-video: the guide's length rounded up, min 5),
// prompt expansion off, safety checker on. Each run logs to <out without extension>.fal.json (stills: <prefix>.fal.json):
// endpoint, input (files by name), request id, times, estimate, output URLs, files. Outputs are never overwritten
// without --force. Video comes back at 24 fps with the model's own audio (conform.py / pin.py drop it).
// Key: --env FILE if given, else FAL_KEY in the environment, else ~/Downloads/launch-videos/.env (a line FAL_KEY=…).
// It is sent only to the queue (FAL_QUEUE_URL, default https://queue.fal.run) and never printed or written anywhere.
// Downloads: a fresh `curl -C -` per try (resumes after every drop or stall; curl's own --retry restarts a try from its
// first byte, so it isn't used), up to FAL_DL_ATTEMPTS (30) tries of at most FAL_DL_TIMEOUT (120) s each.
// Exit codes: 0 done, or a dry run · 2 bad arguments, or an output already exists · 3 no FAL_KEY · 4 fal reported an
// error, or the request didn't finish within --timeout (the request id is printed; fetch picks it up) · 5 a download
// never completed (the URL is printed) · 1 an unexpected failure (a bug: the stack is printed).
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, unlinkSync, renameSync } from 'node:fs';
import { resolve, dirname, extname, basename, join, relative } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';

const STILL = 'fal-ai/flux-pro/v1.1-ultra', I2V = 'minimax/h3-max/image-to-video', R2V = 'minimax/h3-max/reference-to-video';
const PRICES = 'fal prices checked 2026-10-22: fal-ai/flux-pro/v1.1-ultra $0.06 per image · minimax/h3-max/* $0.16 per second at 1080P · anything else: check fal.ai/models';
const ASPECTS = ['9:16', '16:9', '1:1', '4:3', '3:4', '21:9', '9:21'], RES = ['480P', '768P', '1080P'];
const MIME = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm' };
const BASE = (process.env.FAL_QUEUE_URL || 'https://queue.fal.run').replace(/\/+$/, '');
const VALUED = ['prompt', 'out', 'n', 'aspect', 'seed', 'raw', 'endpoint', 'image', 'guide', 'sec', 'res', 'timeout', 'env'];

let KEY = null;                                     // set only for --go / fetch; every line printed or written is scrubbed of it
const scrub = s => KEY ? String(s).split(KEY).join('****') : String(s);
const say = s => console.log(scrub(s)), warn = s => console.error(scrub(s));
const die = (code, msg) => { warn(msg); process.exit(code); };
class FalError extends Error {}
const ctx = { id: null, endpoint: null, out: null };   // for the "fetch picks it up" hint
const fetchHint = () => ctx.id ? `\n  request ${ctx.id} — once it has finished: node ${process.argv[1]} fetch ${ctx.id} --endpoint ${ctx.endpoint} --out ${ctx.out}` : '';

// ---- arguments
const argv = process.argv.slice(2), cmd = argv[0], pos = [], o = {};
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) { pos.push(a); continue; }
  const k = a.slice(2);
  if (k === 'go' || k === 'force') { o[k] = true; continue; }
  if (!VALUED.includes(k)) die(2, `unknown option ${a} — see the usage at the top of ${process.argv[1]}`);
  if (i + 1 >= argv.length) die(2, `${a} needs a value`);
  o[k] = argv[++i];
}
if (!['still', 'video', 'raw', 'fetch'].includes(cmd)) die(2, readFileSync(process.argv[1], 'utf8').split('\nimport ')[0].split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n'));
const int = (v, lo, hi, name) => { const n = Number(v); if (!Number.isInteger(n) || n < lo || n > hi) die(2, `${name} must be a whole number from ${lo} to ${hi} (got ${v})`); return n; };
const oneOf = (v, list, name) => { if (!list.includes(v)) die(2, `${name} must be one of ${list.join(' | ')} (got ${v})`); return v; };
const need = (v, what) => { if (v == null || v === '') die(2, `${what} is required`); return v; };
const file = (p, what, exts) => {
  const f = resolve(need(p, what));
  if (!existsSync(f) || !statSync(f).isFile()) die(2, `${what} ${p}: no such file (${f})`);
  if (exts && !exts.includes(extname(f).toLowerCase())) die(2, `${what} ${p}: expected ${exts.join(' / ')}`);
  return f;
};
const promptOf = p => {
  need(p, '--prompt (the text, or @file.txt)');
  const t = p.startsWith('@') ? readFileSync(file(p.slice(1), '--prompt'), 'utf8') : p;
  if (!t.trim()) die(2, '--prompt is empty');
  return t.trim().replace(/\s*\n\s*/g, ' ');
};
const probe = (f, entries) => {
  const r = spawnSync('ffprobe', ['-v', 'error', ...entries, '-of', 'json', f], { encoding: 'utf8' });
  try { return r.status === 0 ? JSON.parse(r.stdout) : null; } catch { return null; }
};
const appOf = ep => { const s = ep.split('/').filter(Boolean); if (s.length < 2) die(2, `${ep}: a fal endpoint looks like owner/app[/path], e.g. ${I2V}`); return s.slice(0, 2).join('/'); };

// ---- the request: local files stay {__file} placeholders until --go turns them into data URIs
const isFile = v => v && typeof v === 'object' && typeof v.__file === 'string';
const walk = (v, f) => Array.isArray(v) ? v.map(x => walk(x, f)) : isFile(v) ? f(v.__file) : v && typeof v === 'object'
  ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, f)])) : v;
const shown = (input, sizes) => walk(input, p => sizes ? `<file ${basename(p)}, ${Math.max(1, Math.round(statSync(p).size / 1024))} KB>` : `<file ${basename(p)}>`);
const wire = input => walk(input, p => `data:${MIME[extname(p).toLowerCase()] || 'application/octet-stream'};base64,${readFileSync(p).toString('base64')}`);
const seed = () => o.seed == null ? {} : { seed: int(o.seed, 0, 2 ** 31 - 1, '--seed') };
const stripExt = p => p.replace(/\.[a-z0-9]{2,5}$/i, '');

let endpoint, input, out, logPath, expect = null, kind = cmd;
if (cmd === 'still') {
  const n = int(o.n ?? 2, 1, 4, '--n'), raw = oneOf(String(o.raw ?? 'true'), ['true', 'false'], '--raw') === 'true';
  endpoint = o.endpoint || STILL;
  input = { prompt: promptOf(o.prompt), aspect_ratio: oneOf(o.aspect || '16:9', ASPECTS, '--aspect'), raw, num_images: n, ...seed(), output_format: 'jpeg' };
  out = stripExt(resolve(need(o.out, '--out <prefix>')));
  logPath = out + '.fal.json';
  expect = Array.from({ length: n }, (_, i) => `${out}_${i}.jpg`);
} else if (cmd === 'video') {
  if (!o.image === !o.guide) die(2, 'video takes one of --image <key frame> (image-to-video) or --guide <clip> (reference-to-video)');
  out = resolve(need(o.out, '--out <file.mp4>'));
  if (extname(out).toLowerCase() !== '.mp4') die(2, `--out ${o.out}: give the video file's name, ending in .mp4`);
  const res = oneOf(o.res || '1080P', RES, '--res'), prompt = promptOf(o.prompt);
  if (o.image) {
    if (o.aspect) die(2, '--aspect is for --guide; image-to-video takes the key frame\'s shape (generate the still at the aspect you need)');
    endpoint = o.endpoint || I2V;
    input = { prompt, image_url: { __file: file(o.image, '--image', ['.jpg', '.jpeg', '.png', '.webp']) }, duration: int(o.sec ?? 5, 5, 10, '--sec'), resolution: res,
      prompt_expansion_mode: 'disabled', ...seed(), enable_safety_checker: true };
  } else {
    const g = file(o.guide, '--guide', ['.mp4', '.mov', '.webm', '.m4v']), len = Number(probe(g, ['-show_entries', 'format=duration'])?.format?.duration);
    if (!(len > 0)) die(2, `--guide ${o.guide}: ffprobe can't read its length — is it a video?`);
    if (len > 15.01) die(2, `--guide ${o.guide} is ${len.toFixed(2)} s; MiniMax takes at most 15 s per request — cut it (ffmpeg -t 15) or split the shot`);
    endpoint = o.endpoint || R2V;
    input = { prompt, reference_video_urls: [{ __file: g }], duration: o.sec != null ? int(o.sec, 5, 15, '--sec') : Math.max(5, Math.ceil(len - 0.01)), resolution: res,
      aspect_ratio: oneOf(o.aspect || '16:9', ['16:9', '9:16', '1:1'], '--aspect'), prompt_expansion_mode: 'disabled', ...seed(), enable_safety_checker: true };
  }
  logPath = stripExt(out) + '.fal.json';
  expect = [out];
} else if (cmd === 'raw') {
  endpoint = need(pos[0], 'raw <endpoint> <input.json>'); appOf(endpoint);
  const jf = file(pos[1], 'raw <endpoint> <input.json>: the input file');
  try { input = JSON.parse(readFileSync(jf, 'utf8')); } catch (e) { die(2, `${pos[1]} is not valid JSON: ${e.message}`); }
  const at = (v, key) => {                              // "@file" in a *_url / *_urls field → a local file, relative to input.json
    if (typeof v === 'string' && v.startsWith('@') && /_urls?$/.test(key)) {
      const f = resolve(dirname(jf), v.slice(1));
      if (!existsSync(f)) die(2, `${pos[1]}: ${key} points at ${v}, but ${f} doesn't exist`);
      return { __file: f };
    }
    if (Array.isArray(v)) return v.map(x => at(x, key));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, at(x, k)]));
    return v;
  };
  input = at(input, '');
  out = resolve(need(o.out, '--out <path>'));
  logPath = stripExt(out) + '.fal.json';
  expect = [out];
} else {
  ctx.id = need(pos[0], 'fetch <request_id>'); endpoint = need(o.endpoint, '--endpoint (the model the request went to)'); appOf(endpoint);
  out = resolve(need(o.out, '--out <path> (the same --out as the original run)'));
  logPath = stripExt(out) + '.fal.json';
}
ctx.endpoint = endpoint; ctx.out = o.out;
const timeout = int(o.timeout ?? 900, 1, 86400, '--timeout');

function estimate(ep, inp) {
  if (ep === STILL) { const n = inp.num_images || 1; return `${n} image${n > 1 ? 's' : ''} × $0.06 = $${(n * .06).toFixed(2)}`; }
  if (/^minimax\/h3-max\//.test(ep)) {
    const s = Number(inp.duration) || 0, r = inp.resolution || '1080P';
    return r === '1080P' ? `${s} s × $0.16/s at 1080P = $${(s * .16).toFixed(2)}` : `${s} s at ${r}: unknown — at most $${(s * .16).toFixed(2)} (the 1080P price); check fal.ai/models`;
  }
  return `unknown — check fal.ai/models/${ep}`;
}
function loadKey() {
  // an explicit --env FILE wins (no fallback to an exported key), then FAL_KEY in the environment, then the default file
  if (!o.env && process.env.FAL_KEY && process.env.FAL_KEY.trim()) return { key: process.env.FAL_KEY.trim() };
  const f = o.env ? resolve(o.env) : join(homedir(), 'Downloads', 'launch-videos', '.env');
  let t = ''; try { t = readFileSync(f, 'utf8'); } catch { /* no file = no key */ }
  const m = t.match(/^[ \t]*(?:export[ \t]+)?FAL_KEY[ \t]*=[ \t]*(.*)$/m);
  let k = m ? m[1].trim() : '';
  if (/^(["']).*\1$/.test(k)) k = k.slice(1, -1).trim(); else k = k.replace(/\s+#.*$/, '');
  return { key: k || null, file: f };
}
const keyAdvice = f => `no fal.ai key found (${o.env ? `--env ${f}` : `FAL_KEY is not set, and ${f}`} has no FAL_KEY line). Ask the user to paste their own key\n` +
  `into ${f} as one line, FAL_KEY=<their key>, then chmod 600 it — never into the chat. Keys: fal.ai/dashboard/keys.`;

// ---- dry run: nothing leaves this machine, nothing is written
if (cmd !== 'fetch') {
  const exists = [...expect, logPath].filter(p => existsSync(p));
  if (exists.length && !o.force) die(2, `${exists.map(p => relative(process.cwd(), p)).join(', ')} already exist${exists.length > 1 ? '' : 's'} — pick another --out, or add --force to replace ${exists.length > 1 ? 'them' : 'it'} (and pay again)`);
  const est = estimate(endpoint, input);
  if (!o.go) {
    say(`endpoint  ${endpoint}`);
    say(`input     ${JSON.stringify(shown(input, true), null, 2).replace(/\n/g, '\n          ')}`);
    say(`estimate  ${est}\n          (${PRICES})`);
    say(`writes    ${expect.map(p => relative(process.cwd(), p)).join(', ')}${kind === 'raw' ? ' (or _0, _1 … for several outputs)' : ''} + ${relative(process.cwd(), logPath)}`);
    if (!loadKey().key) say(`note      ${keyAdvice(loadKey().file).replace(/\n/g, '\n          ')}`);
    say('dry run — show the user the prompt and the estimate; add --go once they approve the spend');
    process.exit(0);
  }
}

// ---- --go / fetch
const K = loadKey();
if (!K.key) die(3, keyAdvice(K.file));
KEY = K.key;
const save = log => { mkdirSync(dirname(logPath), { recursive: true }); writeFileSync(logPath + '.tmp', scrub(JSON.stringify(log, null, 2)) + '\n'); renameSync(logPath + '.tmp', logPath); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const detail = j => typeof j?.detail === 'string' ? j.detail : Array.isArray(j?.detail) ? j.detail.map(d => `${(d.loc || []).filter(x => x !== 'body').join('.')}: ${d.msg}`).join('; ')
  : j?.error ? `${j.error}${j.error_type ? ` (${j.error_type})` : ''}` : JSON.stringify(j).slice(0, 600);
async function api(url, opt = {}) {                 // the key goes to the queue only — never to a URL on another host
  if (new URL(url).origin !== new URL(BASE).origin) throw new FalError(`refusing to send the key to ${new URL(url).origin} (the queue is ${new URL(BASE).origin})`);
  let r, t;
  for (let i = 0; ; i++) {
    try {
      r = await fetch(url, { ...opt, headers: { Authorization: `Key ${KEY}`, ...(opt.body ? { 'Content-Type': 'application/json' } : {}) }, signal: AbortSignal.timeout(120000) });
      t = await r.text(); break;
    } catch (e) {                                    // a poll survives a network blip; a submit doesn't retry (it could be charged twice)
      if (opt.method === 'POST' || i >= 5) throw new FalError(`couldn't reach fal (${e.cause?.code || e.message})${opt.method === 'POST' ? ' — the request may not have been created; check fal.ai/dashboard/requests before running it again' : ''}`);
      await sleep(3000);
    }
  }
  let j; try { j = JSON.parse(t); } catch { j = { raw: t.slice(0, 500) }; }
  if (r.status >= 400) throw new FalError(`fal answered HTTP ${r.status}: ${detail(j)}`);
  return j;
}
const queueUrls = (id, have = {}) => {
  const ok = u => { try { return new URL(u).origin === new URL(BASE).origin; } catch { return false; } };
  const app = `${BASE}/${appOf(endpoint)}/requests/${id}`;
  return { status_url: ok(have.status_url) ? have.status_url : `${app}/status`, response_url: ok(have.response_url) ? have.response_url : app };
};
async function waitFor(urls, log) {
  const t0 = Date.now(); let last = '';
  for (;;) {
    const s = await api(urls.status_url), t = Math.round((Date.now() - t0) / 1000);
    if (s.status !== last) {
      last = s.status; log.status.push({ t, status: s.status, ...(s.queue_position != null ? { queue_position: s.queue_position } : {}) }); save(log);
      say(`${t} s  ${s.status}${s.queue_position != null ? ` (queue ${s.queue_position})` : ''}`);
    }
    if (s.error || /^(FAILED|ERROR)$/i.test(s.status || '')) throw new FalError(`fal: ${detail(s.error ? s : { error: s.status })}`);
    if (s.status === 'COMPLETED') return;
    if (Date.now() - t0 > timeout * 1000) throw new FalError(`still ${s.status} after ${timeout} s (--timeout)`);
    await sleep(3000);
  }
}
function outputsOf(res) {                           // images[].url, image.url, video.url, then any other {url} leaf, in that order
  const list = [], seen = new Set();
  const add = m => { if (m && typeof m.url === 'string' && /^https?:\/\//.test(m.url) && !seen.has(m.url)) { seen.add(m.url); list.push({ url: m.url, size: Number.isFinite(m.file_size) ? m.file_size : null, type: m.content_type || null }); } };
  (Array.isArray(res?.images) ? res.images : []).forEach(add); add(res?.image); add(res?.video);
  (function deep(v) { if (Array.isArray(v)) v.forEach(deep); else if (v && typeof v === 'object') { add(v); Object.values(v).forEach(deep); } })(res);
  return list;
}
const extOf = m => EXT[m.type] || (/\.[a-z0-9]{2,4}$/i.exec(new URL(m.url).pathname) || [''])[0].toLowerCase() || '.bin';
const destsOf = list => list.length === 1 && extname(out) ? [out] : list.map((m, i) => `${stripExt(out)}_${i}${extname(out) || extOf(m)}`);
const mb = n => n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`;
const sizeOf = p => existsSync(p) ? statSync(p).size : 0;
const pause = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const readable = p => spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=format_name', '-of', 'csv=p=0', p], { encoding: 'utf8' }).status === 0;
function contentLength(url) {
  const r = spawnSync('curl', ['-4', '--http1.1', '-sS', '-I', '-L', '--connect-timeout', '20', '--max-time', '60', url], { encoding: 'utf8' });
  const last = (r.stdout || '').split(/\r?\n\r?\n/).filter(b => /^HTTP\//.test(b)).pop() || '';
  return r.status === 0 && /^HTTP\/\S+ 2/.test(last) && /^content-length:\s*(\d+)/im.test(last) ? +/^content-length:\s*(\d+)/im.exec(last)[1] : null;
}
function download(m, dest) {
  const tries = Math.max(1, Math.round(+process.env.FAL_DL_ATTEMPTS || 30)), tmax = Math.max(1, Math.round(+process.env.FAL_DL_TIMEOUT || 120));
  const want = m.size ?? contentLength(m.url);
  let gone = 0;                                      // consecutive 4xx answers (an expired or wrong URL): stop after 3
  for (let i = 1; i <= tries; i++) {
    if (want != null && sizeOf(dest) === want) break;
    if (want != null && sizeOf(dest) > want) unlinkSync(dest);           // not this file: start over
    const r = spawnSync('curl', ['-4', '--http1.1', '-sS', '-L', '--fail', '-C', '-', '--connect-timeout', '20', '--max-time', String(tmax), '-w', '%{http_code}', '-o', dest, m.url], { encoding: 'utf8' });
    if (r.status === 0 && (want == null || sizeOf(dest) === want)) break;
    if (r.status === 33) { try { unlinkSync(dest); } catch { /* nothing to resume */ } }   // the CDN ignores Range: start over
    const code = +(r.stdout || '').trim().slice(-3);
    gone = code >= 400 && code < 500 && code !== 408 && code !== 429 ? gone + 1 : 0;
    warn(`  ${basename(dest)}: try ${i}/${tries} stopped at ${mb(sizeOf(dest))}${want ? ` of ${mb(want)}` : ''} (${(r.stderr || '').trim().split('\n').pop() || `curl exit ${r.status}`})${gone >= 3 ? '' : ' — resuming'}`);
    if (gone >= 3) break;
    if (i < tries) pause(2000);
  }
  return { bytes: sizeOf(dest), want, ok: (want == null ? sizeOf(dest) > 0 : sizeOf(dest) === want) && readable(dest) };
}
function describe(p) {
  const j = probe(p, ['-show_entries', 'stream=codec_type,width,height,r_frame_rate:format=duration']) || {}, st = j.streams || [];
  const v = st.find(s => s.codec_type === 'video'), a = st.some(s => s.codec_type === 'audio');
  if (!v) return `${relative(process.cwd(), p)} (${mb(sizeOf(p))})`;
  const [nu, de] = String(v.r_frame_rate || '0/1').split('/').map(Number), fps = de ? +(nu / de).toFixed(3) : 0, dur = Number(j.format?.duration);
  if (!(dur > 0.2) || /^image|_pipe$/.test(j.format?.format_name || '') || /\.(jpe?g|png|webp)$/i.test(p)) return `${relative(process.cwd(), p)} (${mb(sizeOf(p))}, ${v.width}×${v.height})`;
  return `${relative(process.cwd(), p)} (${mb(sizeOf(p))}, ${v.width}×${v.height}, ${fps} fps, ${dur.toFixed(2)} s${a ? ', with the model\'s own audio track' : ''}) — conform.py / pin.py ${a ? 'drop the audio and ' : ''}put the ${fps} fps picture on the film's frame grid`;
}

async function main() {
  let log, urls;
  if (cmd === 'fetch') {
    try { log = JSON.parse(readFileSync(logPath, 'utf8')); } catch { log = null; }
    if (log && log.request_id && log.request_id !== ctx.id && !o.force) die(2, `${relative(process.cwd(), logPath)} belongs to request ${log.request_id}, not ${ctx.id} — pick another --out, or --force`);
    if (log && log.endpoint && log.endpoint !== endpoint && !o.force) die(2, `${relative(process.cwd(), logPath)} was sent to ${log.endpoint}, not ${endpoint} — check --endpoint`);
    log = { endpoint, request_id: ctx.id, status: [], ...(log || {}) };
    urls = queueUrls(ctx.id, log);
    log.fetched = new Date().toISOString(); save(log);
    say(`fetching request ${ctx.id} from ${endpoint}`);
  } else {
    if (o.force) for (const p of expect) if (existsSync(p)) unlinkSync(p);   // a resumed download must never continue an old file
    const est = estimate(endpoint, input);
    log = { endpoint, input: shown(input, false), estimate: est, prices: PRICES, auth: 'Key ****', submitted: new Date().toISOString(), status: [] };
    save(log);
    say(`estimate ${est} — submitting to ${endpoint}`);
    const sub = await api(`${BASE}/${endpoint}`, { method: 'POST', body: JSON.stringify(wire(input)) });
    if (!sub.request_id) throw new FalError(`fal accepted the request but sent no request_id: ${JSON.stringify(sub).slice(0, 300)}`);
    ctx.id = sub.request_id; urls = queueUrls(sub.request_id, sub);
    Object.assign(log, { request_id: sub.request_id, ...urls }); save(log);
    say(`submitted — request ${sub.request_id}`);
  }
  await waitFor(urls, log);
  const res = await api(urls.response_url);
  log.result = res; log.finished = new Date().toISOString(); save(log);
  if (res && res.detail) throw new FalError(`fal: ${detail(res)}`);
  const list = outputsOf(res);
  if (!list.length) throw new FalError(`fal's result has no image or video URL: ${JSON.stringify(res).slice(0, 400)}`);
  const dests = destsOf(list);
  log.outputs = list.map((m, i) => ({ url: m.url, file: relative(dirname(logPath), dests[i]), bytes: null })); save(log);
  for (const p of dests) if (existsSync(p) && (cmd !== 'fetch' || o.force)) {      // only fetch resumes a file that is already there
    if (o.force) unlinkSync(p); else { renameSync(p, p + '.prev'); warn(`moved the older ${basename(p)} aside to ${basename(p)}.prev`); }
  }
  mkdirSync(dirname(dests[0]), { recursive: true });
  for (const [i, m] of list.entries()) {
    const d = download(m, dests[i]);
    log.outputs[i].bytes = d.bytes; save(log);
    if (!d.ok) die(5, `download never completed: ${m.url}\n  → ${relative(process.cwd(), dests[i])} has ${mb(d.bytes)}${d.want ? ` of ${mb(d.want)}` : ''}${d.bytes && d.want === d.bytes ? ' but ffprobe can\'t read it' : ''}. ` +
      `Resume it later: node ${process.argv[1]} fetch ${ctx.id} --endpoint ${endpoint} --out ${o.out}\n  (or by hand: curl -4 --http1.1 -L -C - -o ${relative(process.cwd(), dests[i])} '${m.url}')`);
  }
  for (const p of dests) say(`wrote ${describe(p)}`);
  say(`log ${relative(process.cwd(), logPath)}`);
}
main().catch(e => {
  if (e instanceof FalError) die(4, `${e.message}${fetchHint()}`);
  die(1, `gen.mjs failed: ${e.stack || e.message}${fetchHint()}`);
});
