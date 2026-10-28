#!/usr/bin/env node
// ORACLE (harness-only): a fal queue client written from DESIGN.md §A gen.mjs, used to prove the gen checks can PASS —
// and, with ACC_FAULT=<fault>[,<fault>], that each check FAILs on the fault it targets. It refuses to run unless
// FAL_QUEUE_URL points at 127.0.0.1 (the harness's mock): it can never reach fal.ai or spend money.
//   node gen.mjs still|video|raw|fetch …   (same CLI as the spec)
// exit 0 ok · 2 bad input / output exists · 3 no key · 4 fal error · 5 download never completed
import { readFileSync, writeFileSync, existsSync, statSync, rmSync, mkdirSync, renameSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';

const F = new Set((process.env.ACC_FAULT || '').split(',').filter(Boolean));
const BASE = process.env.FAL_QUEUE_URL || '';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(BASE)) { console.error('oracle gen.mjs: FAL_QUEUE_URL must be the local mock (http://127.0.0.1:PORT)'); process.exit(2); }
const argv = process.argv.slice(2), cmd = argv[0];
const opt = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
const has = k => argv.includes(k);
const pos = argv.filter((a, i) => i > 0 && !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--'));
const die = (m, c) => { console.error('✗ ' + m); process.exit(c); };
const GO = has('--go'), FORCE = has('--force');
const COST = { 'fal-ai/flux-pro/v1.1-ultra': ['image', .06], 'minimax/h3-max/*': ['s', .16] };
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.mov': 'video/quicktime' };
const sh = (c, a) => spawnSync(c, a, { encoding: 'utf8' });
const durOf = f => Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout.trim());
const dataUri = f => `data:${MIME[extname(f).toLowerCase()] || 'application/octet-stream'};base64,${readFileSync(f).toString('base64')}`;
const files = new Map();                               // data URI → file, for display
const asData = f => { if (!existsSync(f)) die(`no such file: ${f}`, 2); const u = dataUri(f); files.set(u, f); return u; };
const show = (v, sizes) => JSON.stringify(v, (k, x) => typeof x === 'string' && files.has(x) ? (sizes ? `<file ${basename(files.get(x))}, ${Math.round(statSync(files.get(x)).size / 1024)} KB>` : `<file ${basename(files.get(x))}>`) : x, 2);
const promptOf = p => { if (!p) die('--prompt is required', 2); return p.startsWith('@') ? readFileSync(p.slice(1), 'utf8').trim() : p; };

function estimate(ep, input) {
  const c = COST[ep] || (ep.startsWith('minimax/h3-max/') ? COST['minimax/h3-max/*'] : null);
  if (!c) return { usd: null, text: 'unknown — check fal.ai/models' };
  if (c[0] === 'image') { const n = input.num_images || 1, p = F.has('no-cost') ? .05 : c[1]; return { usd: +(n * p).toFixed(2), text: `$${(n * p).toFixed(2)} (${n} × $${p}/image, checked 2026-10-22)` }; }
  const s = Number(input.duration || 5); return { usd: +(s * c[1]).toFixed(2), text: `$${(s * c[1]).toFixed(2)} (${s} s × $${c[1]}/s at ${input.resolution || '1080P'}, checked 2026-10-22)` };
}
function loadKey() {
  const parse = f => { if (!existsSync(f)) return null; for (const l of readFileSync(f, 'utf8').split('\n')) { const m = /^\s*(?:export\s+)?FAL_KEY\s*=\s*(.*)\s*$/.exec(l); if (m) return m[1].replace(/^(['"])(.*)\1$/, '$2').trim() || null; } return null; };
  // order (DESIGN.md, changed by the lead 2026-10-22): --env FILE (no key line → exit 3, no fallback) > FAL_KEY > ~/Downloads/launch-videos/.env
  const envFile = opt('--env', null), dflt = join(homedir(), 'Downloads', 'launch-videos', '.env');
  if (F.has('env-precedence') && process.env.FAL_KEY) return process.env.FAL_KEY;          // fault: the old order
  if (envFile) {
    const k = parse(envFile); if (k) return k;
    if (!F.has('env-fallback')) { console.error(`✗ ${envFile} has no FAL_KEY= line — paste your own key into it (never into chat)`); process.exit(3); }
  }
  if (process.env.FAL_KEY) return process.env.FAL_KEY;
  if (!F.has('no-env-default')) { const k = parse(dflt); if (k) return k; }
  console.error(`✗ no fal key: paste your own key into ${dflt} as FAL_KEY=… (never into chat), or set FAL_KEY / pass --env FILE`);
  process.exit(F.has('no-exit3') ? 1 : 3);
}
async function call(method, url, key, body) {
  const r = await fetch(url, { method, headers: { authorization: `Key ${key}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch { }
  return { code: r.status, j };
}
const msg = j => !j ? '' : typeof j.detail === 'string' ? j.detail : Array.isArray(j.detail) ? j.detail.map(d => d.msg || JSON.stringify(d)).join('; ') : j.error || j.message || JSON.stringify(j);
const errExit = (m, rid) => { console.error(`✗ fal: ${m}${rid && !F.has('no-rid') ? ` (request ${rid} — node gen.mjs fetch ${rid} --endpoint … to pick it up)` : ''}`); process.exit(F.has('exit1-errors') ? 1 : 4); };
function urlsIn(o, out = []) { if (Array.isArray(o)) o.forEach(x => urlsIn(x, out)); else if (o && typeof o === 'object') { if (typeof o.url === 'string') out.push(o.url); for (const [k, v] of Object.entries(o)) if (k !== 'url') urlsIn(v, out); } return out; }
function download(url, dest) {
  // as built (DESIGN.md): a fresh `curl -C -` per try, no --retry (curl's --retry restarts from the try's first byte)
  const tries = Number(process.env.FAL_DL_ATTEMPTS || process.env.ACC_ATTEMPTS || 30), tmo = process.env.FAL_DL_TIMEOUT;
  for (let a = 1; a <= tries; a++) {
    if (F.has('no-resume')) rmSync(dest, { force: true });
    const args = ['-4', '--http1.1', '-L', '--fail', ...(F.has('no-resume') ? [] : ['-C', '-']), ...(tmo ? ['--max-time', String(tmo)] : []), ...(F.has('speed-limit') ? ['--speed-limit', '50000', '--speed-time', '2'] : []), '-sS', '-o', dest, url];
    if (F.has('node-download')) { const b = spawnSync(process.execPath, ['-e', `fetch(${JSON.stringify(url)}).then(r=>r.arrayBuffer()).then(b=>require('fs').writeFileSync(${JSON.stringify(dest)},Buffer.from(b)))`]); if (b.status === 0) return true; continue; }
    if (F.has('key-to-cdn')) args.unshift('-H', `Authorization: Key ${KEY}`);
    const r = spawnSync('curl', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    if (r.status !== 0) continue;
    if (F.has('no-size-check')) return true;
    const head = sh('curl', ['-4', '--http1.1', '-sSI', '-L', url]).stdout, cl = /content-length:\s*(\d+)/i.exec(head);
    const ok = (!cl || Number(cl[1]) === statSync(dest).size) && sh('ffprobe', ['-v', 'error', dest]).status === 0;
    if (ok) return true;
    rmSync(dest, { force: true });
  }
  return false;
}
let KEY = null;
async function run(ep, input, outs, logBase, kind) {
  const est = estimate(ep, input);
  console.log(F.has('dry-quiet') && !GO ? `estimate: ${est.text}` : `endpoint: ${ep}\ninput: ${F.has('dry-base64') ? JSON.stringify(input, null, 2) : show(input, true)}\nestimate: ${est.text}`);
  if (!GO) {
    if (F.has('dry-connect')) { try { await fetch(BASE + '/'); } catch { } }
    if (F.has('dry-files')) writeFileSync(logBase + '.fal.json', '{}');
    if (!F.has('dry-quiet')) console.log('dry run — show the user the prompt and the estimate; add --go once they approve the spend');
    process.exit(0);
  }
  const existing = outs.filter(o => existsSync(o));
  if (existing.length && !FORCE && !F.has('overwrite')) die(`${existing.join(', ')} exists — pick another --out, or add --force to replace it`, 2);
  if (FORCE && F.has('force-early')) for (const f of [...outs, logBase + '.fal.json']) rmSync(f, { force: true });   // fault: clears before fal accepts
  KEY = loadKey();
  if (F.has('log-early')) writeFileSync(logBase + '.fal.json', JSON.stringify({ endpoint: ep, input: JSON.parse(show(input, false)), auth: 'Key ****' }, null, 2));   // fault: log before a request_id
  console.log(`--go: estimated ${est.text}`);
  const submitted = new Date().toISOString();
  const s = await call('POST', `${BASE}/${ep}`, KEY, input);
  if (s.code >= 400) errExit(`HTTP ${s.code} ${msg(s.j)}`, s.j && s.j.request_id);
  const rid = s.j.request_id; if (!F.has('no-rid') && !F.has('timeout-silent')) console.log(`submitted ${ep} request ${rid}`);
  if (FORCE && !F.has('force-early')) for (const f of [...outs, logBase + '.fal.json']) if (existsSync(f)) renameSync(f, f + '.prev');
  return finish(ep, rid, s.j.status_url, s.j.response_url, input, outs, logBase, kind, est, submitted);
}
async function finish(ep, rid, statusUrl, responseUrl, input, outs, logBase, kind, est, submitted) {
  const t0 = Date.now(), timeout = Number(opt('--timeout', 900)) * 1000, every = F.has('poll-fast') ? 500 : 3000;
  for (;;) {
    const st = await call('GET', statusUrl, KEY);
    if (st.code >= 400) errExit(`status HTTP ${st.code} ${msg(st.j)}`, rid);
    if (st.j.status === 'COMPLETED') break;
    if (st.j.status === 'FAILED' || st.j.status === 'ERROR') errExit(`${st.j.status}: ${msg(st.j)}`, rid);
    if (Date.now() - t0 > timeout) { console.error(`✗ still ${st.j.status} after ${timeout / 1000} s${F.has('timeout-silent') ? '' : ` — request ${rid}: node gen.mjs fetch ${rid} --endpoint ${ep} --out …`}`); process.exit(4); }
    await new Promise(r => setTimeout(r, every));
  }
  const res = await call('GET', responseUrl, KEY);
  if (res.code >= 400) errExit(`HTTP ${res.code} ${msg(res.j)}`, rid);
  if (res.j && res.j.detail) errExit(msg(res.j), rid);
  const urls = urlsIn(res.j);
  const dests = urls.map((u, i) => outs[i] || (() => { const o = outs[0], e = extname(o) || extname(new URL(u).pathname); return `${o.slice(0, o.length - extname(o).length)}_${i}${e}`; })());
  const got = [];
  for (let i = 0; i < urls.length; i++) {
    mkdirSync(dirname(dests[i]), { recursive: true });
    if (FORCE && !F.has('force-resume')) rmSync(dests[i], { force: true });   // curl -C - would append the new file to the old one
    if (!download(urls[i], dests[i])) { console.error(`✗ download never completed: ${urls[i]} — fetch it yourself (curl -C - …) or re-run: node gen.mjs fetch ${rid} --endpoint ${ep} --out ${outs[0]}`); process.exit(F.has('exit1-download') ? 1 : 5); }
    got.push({ path: dests[i], bytes: statSync(dests[i]).size });
  }
  const log = { endpoint: ep, input: JSON.parse(F.has('datauri-log') ? JSON.stringify(input) : show(input, false)), request_id: rid, submitted, finished: new Date().toISOString(),
    estimate: est, outputs: urls, files: got, auth: F.has('leak-log') ? `Key ${KEY}` : 'Key ****' };
  writeFileSync(logBase + '.fal.json', JSON.stringify(log, null, 2));
  const tail = kind === 'video' ? ' — the clip has the model\'s own audio track and runs at 24 fps (conform.py drops the audio, repeats frames to 30)' : '';
  console.log(`wrote ${got.map(g => g.path).join(', ')}${tail}${F.has('leak-stdout') ? ` [key ${KEY}]` : ''}\nlog ${logBase}.fal.json`);
}

const stripExt = p => p.slice(0, p.length - extname(p).length);
const out = opt('--out', null);
if (!['still', 'video', 'raw', 'fetch'].includes(cmd)) die('usage: gen.mjs still|video|raw|fetch …', 2);
const NPOS = { still: 0, video: 0, raw: 2, fetch: 1 }[cmd];
if (pos.length > NPOS && !F.has('stray-ok')) die(`unexpected argument(s): ${pos.slice(NPOS).join(' ')}`, 2);
if (!out) die('--out is required', 2);
if (cmd === 'still') {
  const ep = opt('--endpoint', 'fal-ai/flux-pro/v1.1-ultra'), n = Number(opt('--n', 2));
  if (!(n >= 1 && n <= 4)) die('--n must be 1–4', 2);
  const input = { prompt: promptOf(opt('--prompt')), aspect_ratio: opt('--aspect', '16:9'), raw: opt('--raw', 'true') !== 'false', num_images: n, output_format: 'jpeg' };
  if (opt('--seed')) input.seed = Number(opt('--seed'));
  if (F.has('wrong-fields')) { delete input.output_format; input.format = 'jpeg'; }
  await run(ep, input, Array.from({ length: n }, (_, i) => `${out}_${i}.jpg`), out, 'still');
} else if (cmd === 'video') {
  const guide = opt('--guide', null), image = opt('--image', null);
  if (!!guide === !!image) die('video needs --image <key frame> or --guide <clip ≤ 15 s>', 2);
  const input = { prompt: promptOf(opt('--prompt')) };
  let ep;
  if (image) { ep = opt('--endpoint', 'minimax/h3-max/image-to-video'); input.image_url = asData(image); input.duration = Number(opt('--sec', F.has('default-sec-6') ? 6 : 5)); }
  else {
    const d = durOf(guide);
    if (d > 15.05 && !F.has('guide-no-limit')) die(`${guide} is ${d.toFixed(2)} s — a guide must be 15 s or less: trim it`, 2);
    ep = opt('--endpoint', 'minimax/h3-max/reference-to-video'); input.reference_video_urls = [asData(guide)];
    input.duration = Number(opt('--sec', Math.max(5, Math.ceil(d - 1e-6)))); input.aspect_ratio = opt('--aspect', '16:9');
  }
  input.resolution = opt('--res', '1080P'); input.prompt_expansion_mode = 'disabled';
  if (opt('--seed')) input.seed = Number(opt('--seed'));
  input.enable_safety_checker = true;
  if (F.has('wrong-fields')) { delete input.prompt_expansion_mode; input.prompt_optimizer = false; }
  await run(ep, input, [out], stripExt(out), 'video');
} else if (cmd === 'raw') {
  const ep = pos[0], file = pos[1];
  if (!ep || !file) die('raw <endpoint> <input.json> --out <path>', 2);
  const input = JSON.parse(readFileSync(file, 'utf8')), dir = dirname(resolve(file));
  const conv = (v, k) => typeof v === 'string' && v.startsWith('@') && (F.has('raw-convert-all') || /_urls?$/.test(k)) ? asData(resolve(dir, v.slice(1))) : v;
  for (const [k, v] of Object.entries(input)) input[k] = Array.isArray(v) ? v.map(x => conv(x, k)) : conv(v, k);
  await run(ep, input, [out], stripExt(out), 'raw');
} else {
  const rid = pos[0], ep = opt('--endpoint', null);
  if (!rid || !ep) die('fetch <request_id> --endpoint <endpoint> --out <path>', 2);
  KEY = F.has('fetch-broken') ? '' : loadKey();                       // fault: fetch polls without the key
  const app = ep.split('/').slice(0, 2).join('/'), b = `${BASE}/${app}/requests/${rid}`;
  await finish(ep, rid, b + '/status', b, {}, [out], stripExt(out), 'video', estimate(ep, {}), null);
}
