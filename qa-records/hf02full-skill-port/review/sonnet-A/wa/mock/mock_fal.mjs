// A local stand-in for fal.ai's queue and CDN, for testing gen.mjs without spending: submit → IN_QUEUE → IN_PROGRESS →
// COMPLETED → a result whose image / video URLs point back at this server; downloads honour Range and can drop, stall or
// 404 for the first N tries of each file. Nothing is written to disk (the Authorization headers it saw stay in memory).
//   node mock_fal.mjs --port 18765 --files DIR      (DIR holds still_0.jpg, still_1.jpg …, clip.mp4)
// Control: POST /__mode {submit, status, result, download, fails, dropFrac, stallMs, polls} · GET /__log · POST /__reset
//   submit: ok | 422 | 500 · status: ok | failed | error | stuck · result: ok | detail | 422 | empty
//   download: ok | drop | stall | hang | 404 | norange (fails = how many tries per file misbehave; 1e9 = always)
import http from 'node:http';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('--port', 18765), FILES = arg('--files', '.');
const DEFAULT = { submit: 'ok', status: 'ok', result: 'ok', download: 'ok', fails: 1, dropFrac: 0.3, stallMs: 8000, polls: 3 };
let mode = { ...DEFAULT }, log = [], reqs = new Map(), tries = {};
const MIME = { '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4' };
const base = () => `http://127.0.0.1:${PORT}`;
const json = (res, code, body) => { const b = JSON.stringify(body); res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) }); res.end(b); };
const body = req => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c).toString('utf8'))); });
// what a data URI carried: mime, size, sha1 (so a test can check the file arrived whole)
const peek = v => Array.isArray(v) ? v.map(peek) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, peek(x)]))
  : typeof v === 'string' && v.startsWith('data:') ? (() => { const m = /^data:([^;]+);base64,(.*)$/s.exec(v); const b = Buffer.from(m ? m[2] : '', 'base64'); return { dataUri: m ? m[1] : '?', bytes: b.length, sha1: createHash('sha1').update(b).digest('hex') }; })() : v;

function result(r) {
  const stills = readdirSync(FILES).filter(f => /^still_\d+\.jpg$/.test(f)).sort();
  if (mode.result === 'empty') return { timings: {} };
  if (r.endpoint.startsWith('fal-ai/flux')) {
    const n = Math.max(1, r.input.num_images || 1);
    return { images: Array.from({ length: n }, (_, i) => ({ url: `${base()}/files/${stills[i % stills.length]}`, width: 2752, height: 1536, content_type: 'image/jpeg' })),
      timings: {}, seed: r.input.seed ?? 1234, has_nsfw_concepts: Array(n).fill(false), prompt: r.input.prompt };
  }
  if (r.endpoint.startsWith('minimax/')) {
    const size = statSync(join(FILES, 'clip.mp4')).size;
    return { video: { url: `${base()}/files/clip.mp4`, content_type: 'video/mp4', file_name: 'abc_minimax-h3.mp4', file_size: size }, expanded_prompt: null, timings: { inference: 3.1 } };
  }
  return { image: { url: `${base()}/files/${stills[0]}`, content_type: 'image/jpeg' }, extra: { thumb: { url: `${base()}/files/${stills[1 % stills.length]}` } } };
}

function serveFile(req, res, name) {
  const p = join(FILES, name);
  let st; try { st = statSync(p); } catch { res.writeHead(404); return res.end('no such file'); }
  const nr = mode.download === 'norange';
  let start = 0, end = st.size - 1, code = 200;
  const m = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
  if (m && !nr) {
    start = +m[1]; if (m[2]) end = Math.min(+m[2], st.size - 1);
    if (start >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
    code = 206;
  }
  const headers = { 'Content-Type': MIME[extname(p)] || 'application/octet-stream', 'Content-Length': end - start + 1, 'Accept-Ranges': nr ? 'none' : 'bytes',
    ...(code === 206 ? { 'Content-Range': `bytes ${start}-${end}/${st.size}` } : {}) };
  if (req.method === 'HEAD') { res.writeHead(code, headers); return res.end(); }
  const k = (tries[name] = (tries[name] || 0) + 1), bad = k <= mode.fails && mode.download !== 'ok';
  log[log.length - 1].try = k; log[log.length - 1].bad = bad;
  if (bad && mode.download === '404') { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not Found'); }
  res.writeHead(code, headers);
  const buf = readFileSync(p).subarray(start, end + 1);
  if (bad && mode.download === 'hang') { setTimeout(() => req.socket.destroy(), mode.stallMs); return; }          // headers, then nothing
  if (bad && (mode.download === 'drop' || mode.download === 'stall')) {
    res.write(buf.subarray(0, Math.floor(buf.length * mode.dropFrac)));
    setTimeout(() => req.socket.destroy(), mode.download === 'drop' ? 30 : mode.stallMs);   // drop: cut at once · stall: open, silent
    return;
  }
  res.end(buf);
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, base()), path = decodeURIComponent(u.pathname);
  const raw = req.method === 'POST' || req.method === 'PUT' ? await body(req) : '';
  if (!['/__mode', '/__reset', '/__log'].includes(path)) log.push({ t: Date.now(), method: req.method, path, auth: req.headers.authorization ?? null, range: req.headers.range ?? null, bytes: raw.length });
  if (path === '/__mode' && req.method === 'POST') { mode = { ...mode, ...JSON.parse(raw || '{}') }; return json(res, 200, mode); }
  if (path === '/__reset' && req.method === 'POST') { mode = { ...DEFAULT }; log = []; reqs = new Map(); tries = {}; return json(res, 200, { ok: true }); }
  if (path === '/__log') return json(res, 200, { mode, log, requests: [...reqs.values()].map(r => ({ id: r.id, endpoint: r.endpoint, polls: r.polls, input: peek(r.input) })) });
  if (path.startsWith('/files/')) return serveFile(req, res, path.slice(7));
  const seg = path.split('/').filter(Boolean), ri = seg.indexOf('requests');
  if (ri >= 0) {                                     // status / result / cancel: owner/app only, like fal (the sub-path → 405)
    if (ri !== 2) return json(res, 405, { detail: 'Method Not Allowed (status/result URLs use only owner/app)' });
    if (req.headers.authorization?.startsWith('Key ') !== true) return json(res, 401, { detail: 'No authorization header' });
    const r = reqs.get(seg[3]);
    if (!r) return json(res, 404, { detail: `Request ${seg[3]} not found` });
    if (seg[4] === 'cancel') return json(res, 200, { status: 'OK' });
    if (seg[4] === 'status') {
      const k = r.polls++;
      if (mode.status === 'stuck' || k < mode.polls - 1) return json(res, 202, k === 0 && mode.status !== 'stuck' ? { status: 'IN_QUEUE', queue_position: 1, request_id: r.id } : { status: 'IN_PROGRESS', request_id: r.id, logs: null });
      if (mode.status === 'failed') return json(res, 200, { status: 'FAILED', request_id: r.id });
      if (mode.status === 'error') return json(res, 200, { status: 'COMPLETED', request_id: r.id, error: 'Generation failed: the content checker flagged the input image', error_type: 'content_policy_violation' });
      return json(res, 200, { status: 'COMPLETED', request_id: r.id, metrics: { inference_time: 3.2 } });
    }
    if (mode.result === 'detail') return json(res, 200, { detail: 'Internal error while generating (mock)' });
    if (mode.result === '422') return json(res, 422, { detail: [{ loc: ['body', 'duration'], msg: "Input should be '5' or '6'", type: 'literal_error' }] });
    return json(res, 200, result(r));
  }
  if (req.method === 'POST' && seg.length >= 2) {   // submit
    if (req.headers.authorization?.startsWith('Key ') !== true) return json(res, 401, { detail: 'No authorization header' });
    if (mode.submit === '422') return json(res, 422, { detail: [{ loc: ['body', 'image_url'], msg: 'field required', type: 'missing' }] });
    if (mode.submit === '500') return json(res, 500, { detail: 'Internal Server Error' });
    let input; try { input = JSON.parse(raw); } catch { return json(res, 400, { detail: 'body is not JSON' }); }
    const id = randomUUID(), app = seg.slice(0, 2).join('/');
    reqs.set(id, { id, endpoint: seg.join('/'), input, polls: 0 });
    return json(res, 200, { request_id: id, status_url: `${base()}/${app}/requests/${id}/status`, response_url: `${base()}/${app}/requests/${id}`,
      cancel_url: `${base()}/${app}/requests/${id}/cancel`, queue_position: 0 });
  }
  json(res, 404, { detail: 'not found' });
});
server.keepAliveTimeout = 0;                     // idle sockets stay open: no close racing a test that was blocked in spawnSync
server.listen(PORT, '127.0.0.1', () => console.log(`mock fal listening on ${base()}`));
