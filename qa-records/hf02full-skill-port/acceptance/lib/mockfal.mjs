#!/usr/bin/env node
// Mock fal.ai queue + CDN for the acceptance harness. Never talks to the network beyond 127.0.0.1, never stores a raw
// Authorization value it doesn't know (unknown keys are logged as length + sha256 prefix only).
//
//   MOCK_KEYS='a=<fake key>,b=<other fake key>' node mockfal.mjs --state DIR --files DIR
//
// Three listeners on 127.0.0.1 (ephemeral ports, written to DIR/ports.json):
//   api  queue.fal.run look-alike: POST /<endpoint> → {request_id, status_url, response_url, cancel_url};
//        GET <app>/requests/<id>/status → IN_QUEUE / IN_PROGRESS / COMPLETED (time-based, per scenario);
//        GET <app>/requests/<id> → the result JSON (or the scenario's error). Every queue call needs "Key <known key>".
//   cdn  file downloads: GET/HEAD /files/<name>, Range (206 / 416), modes ok | cut | stall | fail503 | drop | corrupt | short
//   ctl  harness control: POST /reset · /scenario · /file · /complete · /create · /failnext ; GET /log
// Every request is appended to DIR/log.jsonl (data URIs summarised as {datauri, mime, bytes, md5}).
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
const STATE = opt('--state', null), FILES = opt('--files', null);
if (!STATE) { console.error('mockfal: --state DIR is required'); process.exit(2); }
mkdirSync(STATE, { recursive: true });
const LOG = join(STATE, 'log.jsonl');
const KEYS = Object.fromEntries((process.env.MOCK_KEYS || '').split(',').filter(Boolean).map(kv => { const i = kv.indexOf('='); return [kv.slice(i + 1), kv.slice(0, i)]; }));
const sha = (b, n = 8) => createHash('sha256').update(b).digest('hex').slice(0, n);
const md5 = b => createHash('md5').update(b).digest('hex');
const now = () => Date.now() / 1000;
const T0 = now();

// ── state ──
let S;
const reset = () => {
  S = { requests: new Map(), log: [], conns: { api: 0, cdn: 0 }, scenario: defaultScenario(), files: new Map(), failNext: [] };
  writeFileSync(LOG, '');
};
const defaultScenario = () => ({ timeline: [[0, 'IN_QUEUE'], [1.0, 'IN_PROGRESS'], [4.0, 'COMPLETED']], result: null, submitError: null,
  statusFinal: null, resultError: null, hold: false, pendingCode: 200 });
reset();
const record = e => { e.t = +(now() - T0).toFixed(3); S.log.push(e); appendFileSync(LOG, JSON.stringify(e) + '\n'); };

function authName(h) {
  if (h == null) return 'none';
  const m = /^Key (.+)$/.exec(String(h));
  if (m && Object.hasOwn(KEYS, m[1])) return KEYS[m[1]];
  return `unknown(len=${String(h).length},sha256=${sha(String(h))})`;
}
function summarise(v) {                      // body for the log: data URIs → digest
  if (typeof v === 'string' && v.startsWith('data:')) {
    const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(v);
    if (!m) return { datauri: true, malformed: true, length: v.length };
    const buf = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]));
    return { datauri: true, mime: m[1], bytes: buf.length, md5: md5(buf) };
  }
  if (Array.isArray(v)) return v.map(summarise);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, summarise(x)]));
  return v;
}
const readBody = req => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });
const json = (res, code, obj, extra = {}) => { const b = Buffer.from(JSON.stringify(obj)); res.writeHead(code, { 'content-type': 'application/json', 'content-length': b.length, ...extra }); res.end(b); };

// ── api ──
let API_BASE = '', CDN_BASE = '';
const rid = () => { const h = randomBytes(16).toString('hex'); return `0acc${h.slice(0, 4)}-${h.slice(4, 8)}-7${h.slice(9, 12)}-a${h.slice(13, 16)}-${h.slice(16, 28)}`; };
const appOf = ep => ep.split('/').slice(0, 2).join('/');
const fill = v => typeof v === 'string' ? v.replace(/\$CDN\//g, CDN_BASE + '/files/') : Array.isArray(v) ? v.map(fill) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)])) : v;
function statusOf(r) {
  if (r.done) return 'COMPLETED';
  if (r.sc.hold) return r.sc.timeline.length > 1 ? 'IN_PROGRESS' : 'IN_QUEUE';
  const age = now() - r.created; let st = 'IN_QUEUE';
  for (const [t, s] of r.sc.timeline) if (age >= t) st = s;
  return st;
}
const urls = (ep, id) => { const b = `${API_BASE}/${appOf(ep)}/requests/${id}`; return { response_url: b, status_url: b + '/status', cancel_url: b + '/cancel' }; };
function create(ep, sc) { const id = rid(); S.requests.set(id, { id, ep, sc, created: now(), done: false, polls: 0 }); return id; }

async function api(req, res) {
  const body = await readBody(req), u = new URL(req.url, 'http://x'), path = decodeURIComponent(u.pathname).replace(/^\/+/, '');
  const e = { port: 'api', method: req.method, path, query: u.search, httpVersion: req.httpVersion, ua: req.headers['user-agent'] || '', auth: authName(req.headers.authorization), ctype: req.headers['content-type'] || '', bytes: body.length };
  const forced = S.failNext.length ? S.failNext.shift() : null;
  if (forced) { e.forced = forced; record(e); return json(res, forced.code, forced.body || { detail: 'forced failure' }); }
  if (e.auth === 'none' || e.auth.startsWith('unknown')) { e.status = 401; record(e); return json(res, 401, { detail: 'No user found for Key ID and Secret' }); }
  let m;
  if (req.method === 'POST' && !/\/requests\//.test(path)) {
    let input = null; try { input = JSON.parse(body.toString('utf8')); } catch { e.badJson = true; }
    e.endpoint = path; e.body = summarise(input);
    const sc = { ...S.scenario };
    if (sc.submitError) { e.status = sc.submitError.code; record(e); return json(res, sc.submitError.code, sc.submitError.body); }
    const id = create(path, sc); e.request_id = id; e.status = 200; record(e);
    return json(res, 200, { request_id: id, ...urls(path, id), queue_position: 0 });
  }
  if (req.method === 'GET' && (m = /^(.*)\/requests\/([^/]+)\/status$/.exec(path))) {
    const r = S.requests.get(m[2]); e.kind = 'status'; e.request_id = m[2]; e.prefix = m[1];
    if (!r) { e.status = 404; record(e); return json(res, 404, { detail: `Request ${m[2]} not found` }); }
    r.polls++; const st = statusOf(r); e.reported = st;
    if (st === 'COMPLETED' && r.sc.statusFinal) { e.status = 200; e.reported = r.sc.statusFinal.status; record(e); return json(res, 200, { ...r.sc.statusFinal, ...urls(r.ep, r.id) }); }
    e.status = st === 'COMPLETED' ? 200 : r.sc.pendingCode || 200; record(e);
    return json(res, e.status, { status: st, ...(st === 'IN_QUEUE' ? { queue_position: 0 } : {}), logs: st === 'IN_QUEUE' ? null : [], response_url: urls(r.ep, r.id).response_url });
  }
  if (req.method === 'PUT' && (m = /^(.*)\/requests\/([^/]+)\/cancel$/.exec(path))) { e.kind = 'cancel'; e.request_id = m[2]; e.status = 202; record(e); return json(res, 202, { status: 'CANCELLATION_REQUESTED' }); }
  if (req.method === 'GET' && (m = /^(.*)\/requests\/([^/]+)$/.exec(path))) {
    const r = S.requests.get(m[2]); e.kind = 'result'; e.request_id = m[2]; e.prefix = m[1];
    if (!r) { e.status = 404; record(e); return json(res, 404, { detail: `Request ${m[2]} not found` }); }
    if (statusOf(r) !== 'COMPLETED') { e.status = 400; record(e); return json(res, 400, { detail: 'Request is still in progress' }); }
    if (r.sc.resultError) { e.status = r.sc.resultError.code; record(e); return json(res, r.sc.resultError.code, r.sc.resultError.body); }
    e.status = 200; record(e); return json(res, 200, fill(r.sc.result || {}));
  }
  e.status = 404; record(e); return json(res, 404, { detail: 'Not Found' });
}

// ── cdn ──
// file config: {name, from (path), mode, cutAt (0..1 of the bytes this response would send), stallMs, failTimes, ctype}
function fileBytes(f) { if (!f.buf) f.buf = readFileSync(f.from); return f.buf; }
async function cdn(req, res) {
  const u = new URL(req.url, 'http://x'), m = /^\/files\/(.+)$/.exec(decodeURIComponent(u.pathname));
  const e = { port: 'cdn', method: req.method, path: u.pathname, range: req.headers.range || null, httpVersion: req.httpVersion, ua: req.headers['user-agent'] || '', hasAuth: req.headers.authorization != null, auth: req.headers.authorization != null ? authName(req.headers.authorization) : null };
  const f = m && S.files.get(m[1]);
  if (!f) { e.status = 404; record(e); res.writeHead(404, { 'content-length': 9 }); return res.end('not found'); }
  f.hits = (f.hits || 0) + 1; e.file = f.name; e.hit = f.hits;
  const failing = f.hits <= (f.failTimes ?? 1);
  if (f.mode === 'fail503' || (f.mode === 'fail503-once' && failing)) { e.status = 503; e.outcome = 'fail503'; record(e); res.writeHead(503, { 'content-length': 11, 'retry-after': '0' }); return res.end('unavailable'); }
  if (f.mode === 'drop' && failing) { e.outcome = 'drop'; record(e); return req.socket.destroy(); }
  let buf = fileBytes(f);
  if (f.mode === 'corrupt') { buf = Buffer.from(createHash('sha512').update('corrupt' + f.name).digest()); const big = Buffer.alloc(fileBytes(f).length); for (let i = 0; i < big.length; i += buf.length) buf.copy(big, i); buf = big; }
  const size = buf.length; let a = 0, b = size - 1, code = 200;
  if (e.range) {
    const r = /^bytes=(\d*)-(\d*)$/.exec(e.range);
    if (r) { a = r[1] === '' ? size - Number(r[2]) : Number(r[1]); b = r[1] !== '' && r[2] !== '' ? Math.min(size - 1, Number(r[2])) : size - 1; code = 206; }
    if (a >= size) { e.status = 416; e.outcome = 'unsatisfiable'; record(e); res.writeHead(416, { 'content-range': `bytes */${size}`, 'content-length': 0 }); return res.end(); }
  }
  const part = buf.subarray(a, b + 1);
  const head = { 'content-type': f.ctype || 'application/octet-stream', 'accept-ranges': 'bytes' };
  if (f.mode === 'short' && failing) {            // chunked, no length, ends cleanly early: looks complete to curl
    e.status = code; e.outcome = 'short'; const n = Math.floor(part.length * (f.cutAt ?? .5)); e.bytesSent = n; record(e);
    res.writeHead(code, { ...head, ...(code === 206 ? { 'content-range': `bytes ${a}-${b}/${size}` } : {}) });
    return res.end(part.subarray(0, n));
  }
  head['content-length'] = part.length; if (code === 206) head['content-range'] = `bytes ${a}-${b}/${size}`;
  e.status = code;
  if (req.method === 'HEAD') { e.outcome = 'head'; record(e); res.writeHead(code, head); return res.end(); }
  res.writeHead(code, head);
  // cut: the first failTimes GETs are cut; cut-unless-range: every GET from byte 0 is cut, a resumed (Range) GET is served
  // — curl --retry truncates back to where the invocation started, so only a NEW curl call with -C - can resume
  const cutNow = f.mode === 'cut-always' || ((f.mode === 'cut' || f.mode === 'stall') && failing) || (f.mode === 'cut-unless-range' && !(a > 0));
  if (cutNow) {
    const n = Math.floor(part.length * (f.cutAt ?? .4)); e.bytesSent = n; e.outcome = f.mode === 'stall' ? 'stalled' : 'cut'; record(e);
    res.write(part.subarray(0, n), () => setTimeout(() => {
      if (f.mode === 'stall') res.end(part.subarray(n)); else req.socket.destroy();
    }, f.stallMs ?? 0));
    return;
  }
  e.bytesSent = part.length; e.outcome = 'complete'; record(e); res.end(part);
}

// ── control ──
async function ctl(req, res) {
  const body = await readBody(req), u = new URL(req.url, 'http://x');
  let j = {}; try { j = body.length ? JSON.parse(body.toString('utf8')) : {}; } catch { return json(res, 400, { error: 'bad json' }); }
  const p = u.pathname;
  if (p === '/reset') { reset(); return json(res, 200, { ok: true }); }
  if (p === '/scenario') { S.scenario = { ...defaultScenario(), ...j }; return json(res, 200, { ok: true }); }
  if (p === '/file') { if (!j.from || !existsSync(j.from)) return json(res, 400, { error: 'file.from missing' }); S.files.set(j.name, { ...j, hits: 0, buf: null }); return json(res, 200, { ok: true, url: `${CDN_BASE}/files/${j.name}` }); }
  if (p === '/complete') { const r = S.requests.get(j.id); if (!r) return json(res, 404, { error: 'no such request' }); r.done = true; r.sc = { ...r.sc, hold: false }; return json(res, 200, { ok: true }); }
  if (p === '/create') { const id = create(j.endpoint, { ...defaultScenario(), ...(j.scenario || {}) }); return json(res, 200, { request_id: id, ...urls(j.endpoint, id) }); }
  if (p === '/failnext') { S.failNext.push(...(j.list || [])); return json(res, 200, { ok: true }); }
  if (p === '/log') return json(res, 200, { log: S.log, conns: S.conns, api: API_BASE, cdn: CDN_BASE, files: [...S.files.values()].map(f => ({ name: f.name, hits: f.hits, mode: f.mode })) });
  return json(res, 404, { error: 'unknown control path' });
}

const serve = (name, fn) => new Promise(r => {
  const s = createServer((req, res) => fn(req, res).catch(err => { try { json(res, 500, { detail: 'mock error: ' + err.message }); } catch { } }));
  if (name !== 'ctl') s.on('connection', () => { S.conns[name]++; });
  s.keepAliveTimeout = 2000;
  s.listen(0, '127.0.0.1', () => r(s));
});
const [sApi, sCdn, sCtl] = await Promise.all([serve('api', api), serve('cdn', cdn), serve('ctl', ctl)]);
API_BASE = `http://127.0.0.1:${sApi.address().port}`; CDN_BASE = `http://127.0.0.1:${sCdn.address().port}`;
writeFileSync(join(STATE, 'ports.json'), JSON.stringify({ api: sApi.address().port, cdn: sCdn.address().port, ctl: sCtl.address().port, pid: process.pid, files: FILES }));
const bye = () => { for (const s of [sApi, sCdn, sCtl]) s.close(); process.exit(0); };
process.on('SIGTERM', bye); process.on('SIGINT', bye);
