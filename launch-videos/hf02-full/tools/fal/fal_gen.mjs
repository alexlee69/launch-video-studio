// Run one fal.ai model request through fal's REST queue and download the video.
//   node tools/fal/fal_gen.mjs <endpoint> <input.json> <out.mp4>
// In input.json, any string starting with "@" (in a field or list ending in _url / _urls) is a local file sent as a base64
// data URI. The key is read from ~/Downloads/launch-videos/.env (FAL_KEY) and is never printed or logged.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const [endpoint, inputPath, outPath] = process.argv.slice(2);
if (!endpoint || !inputPath || !outPath) { console.error('usage: fal_gen.mjs <endpoint> <input.json> <out.mp4>'); process.exit(2); }
const envFile = resolve(import.meta.dirname, '..', '..', '..', '.env');
const KEY = (readFileSync(envFile, 'utf8').match(/^FAL_KEY=(.+)$/m) || [])[1]?.trim();
if (!KEY) { console.error('FAL_KEY missing in', envFile); process.exit(2); }
const H = { Authorization: `Key ${KEY}`, 'Content-Type': 'application/json' };
const MIME = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
const dataUri = p => `data:${MIME[extname(p).toLowerCase()] || 'application/octet-stream'};base64,${readFileSync(resolve(dirname(resolve(inputPath)), p)).toString('base64')}`;
const input = JSON.parse(readFileSync(inputPath, 'utf8'));
const shown = JSON.parse(JSON.stringify(input));
for (const [k, v] of Object.entries(input)) {
  if (!/_urls?$/.test(k)) continue;
  if (typeof v === 'string' && v.startsWith('@')) { input[k] = dataUri(v.slice(1)); shown[k] = `<file ${v.slice(1)}>`; }
  if (Array.isArray(v)) { input[k] = v.map(x => typeof x === 'string' && x.startsWith('@') ? dataUri(x.slice(1)) : x); shown[k] = v.map(x => x.startsWith('@') ? `<file ${x.slice(1)}>` : x); }
}
const log = { endpoint, input: shown, submitted: new Date().toISOString(), status: [] };
const logPath = outPath.replace(/\.mp4$/, '') + '.fal.json';
mkdirSync(dirname(resolve(outPath)), { recursive: true });
const save = () => writeFileSync(logPath, JSON.stringify(log, null, 2));
const call = async (url, opt = {}) => {
  const r = await fetch(url, { headers: H, ...opt }); const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = { raw: t.slice(0, 500) }; }
  if (!r.ok && r.status !== 202) { log.error = { http: r.status, body: j }; save(); throw new Error(`HTTP ${r.status}: ${JSON.stringify(j).slice(0, 600)}`); }
  return j;
};
const sub = await call(`https://queue.fal.run/${endpoint}`, { method: 'POST', body: JSON.stringify(input) });
log.request_id = sub.request_id; save();
console.log('submitted', endpoint, 'request', sub.request_id);
const t0 = Date.now(); let last = '';
while (true) {
  await new Promise(r => setTimeout(r, 5000));
  const s = await call(sub.status_url);
  if (s.status !== last) { last = s.status; log.status.push({ t: Math.round((Date.now() - t0) / 1000), status: s.status, queue_position: s.queue_position }); save(); console.log(`${Math.round((Date.now() - t0) / 1000)} s  ${s.status}${s.queue_position != null ? ' (queue ' + s.queue_position + ')' : ''}`); }
  if (s.status === 'COMPLETED') break;
  if (Date.now() - t0 > 30 * 60 * 1000) { console.error('gave up after 30 min; request', sub.request_id); process.exit(1); }
}
const res = await call(sub.response_url);
log.result = res; log.finished = new Date().toISOString(); save();
// a video result goes to outPath; image results go to outPath with _0, _1, … before the extension
const urls = res?.video?.url ? [res.video.url] : (res?.images || []).map(i => i.url);
if (!urls.length) { console.error('no video or images in result:', JSON.stringify(res).slice(0, 600)); process.exit(1); }
for (const [i, url] of urls.entries()) {
  const dest = res?.video?.url ? resolve(outPath) : resolve(outPath).replace(/(\.[a-z0-9]+)$/i, `_${i}$1`);
  // fal's CDN can stall from this network: curl with resume and retries instead of a bare fetch
  // no speed cutoff (it killed slow-but-alive transfers); IPv4 + HTTP/1.1, resuming after every drop, up to 30 tries
  let ok = false;
  for (let i = 0; i < 30 && !ok; i++) {
    ok = spawnSync('curl', ['-4', '--http1.1', '-sS', '-L', '-C', '-', '--connect-timeout', '20', '--max-time', '300', '-o', dest, url], { stdio: 'inherit' }).status === 0;
    if (!ok) await new Promise(r => setTimeout(r, 2000));
  }
  if (!ok) { console.error('download failed; resume it with: curl -4 --http1.1 -C - -o', dest, url); process.exit(1); }
  console.log('wrote', dest);
}
console.log(`done in ${Math.round((Date.now() - t0) / 1000)} s; log ${logPath}`);
