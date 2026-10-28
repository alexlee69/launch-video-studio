// Worker A — gen.mjs against a local mock of fal's queue + CDN (work-A/mock/mock_fal.mjs). Never touches the real API:
// FAL_QUEUE_URL points at the mock, FAL_KEY / --env / HOME carry fake keys made up at run time, and every file written
// plus every line printed is scanned for them at the end.
//   node tests/test_gen.mjs [GEN]    (GEN defaults to the staging copy's video/footage/gen.mjs)
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, statSync, readdirSync, copyFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';

const WA = resolve(dirname(new URL(import.meta.url).pathname), '..');
const GEN = resolve(process.argv[2] || join(WA, '..', 'stage', 'product-launch-sting', 'video', 'footage', 'gen.mjs'));
const TAG = process.env.TEST_TAG ? '-' + process.env.TEST_TAG : '';
const PORT = +(process.env.MOCK_PORT || 18766), BASE = `http://127.0.0.1:${PORT}`, CDN = join(WA, 'media', 'cdn'), MEDIA = join(WA, 'media');
const OUT = join(WA, 'out', 'gen' + TAG), ENVD = join(WA, 'tests', 'env' + TAG);
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
rmSync(ENVD, { recursive: true, force: true }); mkdirSync(ENVD, { recursive: true });
const KEY = `FAKEKEY-wA-${randomBytes(9).toString('hex')}:${randomBytes(12).toString('hex')}`;
const KEY2 = `FAKEKEY-envfile-${randomBytes(10).toString('hex')}`, KEY3 = `FAKEKEY-home-${randomBytes(10).toString('hex')}`;
const KEYS = [KEY, KEY2, KEY3];
writeFileSync(join(ENVD, 'fake.env'), `# test only\nOTHER=1\nFAL_KEY=${KEY2}\n`);
writeFileSync(join(ENVD, 'nokey.env'), '# test only\nOTHER=1\n');
mkdirSync(join(ENVD, 'home', 'Downloads', 'launch-videos'), { recursive: true });
writeFileSync(join(ENVD, 'home', 'Downloads', 'launch-videos', '.env'), `export FAL_KEY="${KEY3}"\n`);
mkdirSync(join(ENVD, 'nohome'), { recursive: true });
const md5 = p => createHash('md5').update(readFileSync(p)).digest('hex');
const sha1 = p => createHash('sha1').update(readFileSync(p)).digest('hex');
const logLines = [], outputs = [];
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; const l = `${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`; console.log(l); logLines.push(l); };
const CURL_LOG = join(OUT, 'curl-argv.log');
const baseEnv = { PATH: `${join(WA, 'tests', 'shim')}:${process.env.PATH}`, CURL_ARGV_LOG: CURL_LOG, HOME: join(ENVD, 'nohome'), FAL_QUEUE_URL: BASE, LANG: 'C', LC_ALL: 'C' };
const SPY = 'file://' + join(WA, 'tests', 'netspy.mjs'), SPYLOG = join(OUT, 'netspy.log'), TRIPLOG = join(OUT, 'tripwire.log'), TRIP = PORT + 1;
function gen(args, { env = {}, cwd = OUT, sandbox = null, spy = false } = {}) {
  const e = { ...baseEnv, FAL_KEY: KEY, ...(spy ? { NETSPY_LOG: SPYLOG } : {}), ...env }; for (const [k, v] of Object.entries(e)) if (v === null) delete e[k];
  const cmd = sandbox ? 'sandbox-exec' : 'node', a = sandbox ? ['-p', sandbox, 'node', GEN, ...args] : [...(spy ? ['--import', SPY] : []), GEN, ...args];
  const t0 = Date.now(), r = spawnSync(cmd, a, { cwd, env: e, encoding: 'utf8', timeout: 600000 });
  const res = { code: r.status, out: r.stdout || '', err: r.stderr || '', s: ((Date.now() - t0) / 1000).toFixed(1) };
  outputs.push(res.out, res.err);
  logLines.push(`\n$ ${Object.entries(env).map(([k, v]) => `${k}=${v === null ? '(unset)' : KEYS.includes(v) ? '<fake key>' : v}`).join(' ')} ${sandbox ? 'sandbox-exec -p <profile> ' : ''}node gen.mjs ${args.join(' ')}\n[exit ${res.code}, ${res.s} s]\n${res.out}${res.err ? '[stderr]\n' + res.err : ''}`);
  return res;
}
const mock = async (path, body) => { for (let i = 0; ; i++) { try { return await (await fetch(BASE + path, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) })).json(); } catch (e) { if (i > 3) throw e; await new Promise(r => setTimeout(r, 300)); } } };
const files = d => existsSync(d) ? readdirSync(d, { recursive: true }).filter(f => statSync(join(d, f)).isFile()).sort() : [];
const caseDir = name => { const d = join(OUT, name); mkdirSync(d, { recursive: true }); return d; };

const srv = spawn('node', [join(WA, 'mock', 'mock_fal.mjs'), '--port', String(PORT), '--files', CDN], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
const trip = spawn('node', [join(WA, 'tests', 'tripwire.mjs'), TRIPLOG, String(TRIP)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => trip.stdout.once('data', r));
const lines = p => existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean).length : 0;
const PROMPT = 'Handheld camera, slightly unsteady. She types, pauses, lifts the mug. Keep the lighting, colours and grain of the first frame. No text, no captions, no logos.';
writeFileSync(join(OUT, 'motion.txt'), PROMPT + '\n');
try {
  // ---- dry runs: no network, no files (also proven with network + file writes denied by sandbox-exec)
  await mock('/__reset', {});
  const curl0 = lines(CURL_LOG), DRY = { spy: true, env: { FAL_QUEUE_URL: `http://127.0.0.1:${TRIP}` } };
  let d = caseDir('dry'), r = gen(['still', '--prompt', '@../motion.txt', '--out', 'keys/plate1-key', '--aspect', '16:9', '--seed', '4127'], { cwd: d, ...DRY });
  check('dry still: exit 0', r.code === 0, `exit ${r.code}`);
  check('dry still: prints endpoint, input, estimate and the approval line', /endpoint  fal-ai\/flux-pro\/v1\.1-ultra/.test(r.out) && /"num_images": 2/.test(r.out) && /"raw": true/.test(r.out) && /"output_format": "jpeg"/.test(r.out)
    && /2 images × \$0\.06 = \$0\.12/.test(r.out) && /checked 2026-10-22/.test(r.out) && r.out.includes('dry run — show the user the prompt and the estimate; add --go once they approve the spend'));
  r = gen(['video', '--image', join(MEDIA, 'key.png'), '--prompt', '@../motion.txt', '--out', 'plate1-i2v.mp4', '--sec', '6', '--seed', '5309'], { cwd: d, ...DRY });
  check('dry video --image: data URI shown as <file NAME, N KB>, 6 s × $0.16 = $0.96', r.code === 0 && /"image_url": "<file key\.png, \d+ KB>"/.test(r.out) && /\$0\.96/.test(r.out) && /"prompt_expansion_mode": "disabled"/.test(r.out) && /"enable_safety_checker": true/.test(r.out) && /"resolution": "1080P"/.test(r.out), r.out.split('\n').find(l => /image_url/.test(l)));
  r = gen(['video', '--guide', join(MEDIA, 'guide-5.6s.mp4'), '--prompt', PROMPT, '--out', 'plate1-r2v.mp4'], { cwd: d, ...DRY });
  check('dry video --guide 5.63 s: duration 6 (rounded up), aspect 16:9, endpoint reference-to-video', r.code === 0 && /"duration": 6/.test(r.out) && /"aspect_ratio": "16:9"/.test(r.out) && /minimax\/h3-max\/reference-to-video/.test(r.out) && /"reference_video_urls": \[\s*"<file guide-5\.6s\.mp4, \d+ KB>"/.test(r.out));
  r = gen(['video', '--image', join(MEDIA, 'key.png'), '--prompt', PROMPT, '--out', 'x.mp4', '--res', '768P'], { cwd: d, ...DRY });
  check('dry video at 768P: price marked unknown (upper bound only)', r.code === 0 && /unknown — at most \$0\.80/.test(r.out));
  r = gen(['raw', 'fal-ai/some-model', join(d, '..', 'raw-in.json'), '--out', 'r.jpg'], { cwd: d, ...DRY });
  check('dry raw with a missing input.json: exit 2', r.code === 2, r.err.trim());
  const mlog = await mock('/__log');
  check('dry runs made no request to the queue', mlog.log.length === 0, `${mlog.log.length} requests`);
  check('dry runs: the tripwire standing in as FAL_QUEUE_URL got no connection', lines(TRIPLOG) === 0, `${lines(TRIPLOG)} connections`);
  check('dry runs: no fetch / socket / http / dns call at all inside gen.mjs (node --import netspy)', lines(SPYLOG) === 0, existsSync(SPYLOG) ? readFileSync(SPYLOG, 'utf8').split('\n')[0] : '');
  check('dry runs: curl never started (PATH shim log unchanged)', lines(CURL_LOG) === curl0, `${lines(CURL_LOG) - curl0} curl runs`);
  check('dry runs wrote no files', files(d).length === 0, files(d).join(', '));
  const SB = '(version 1)(allow default)(deny network*)(deny file-write* (subpath "/Users") (subpath "/private") (subpath "/tmp"))';
  r = gen(['video', '--image', join(MEDIA, 'key.png'), '--prompt', PROMPT, '--out', 'sb.mp4'], { cwd: d, sandbox: SB });
  check('dry run works with all network and file writes denied (sandbox-exec)', r.code === 0 && r.out.includes('dry run — show the user'), `exit ${r.code} ${r.err.slice(0, 200)}`);
  r = gen(['video', '--image', join(MEDIA, 'key.png'), '--prompt', PROMPT, '--out', 'sb.mp4', '--go'], { cwd: d, sandbox: SB });
  check('control: the same command with --go fails under that sandbox (the sandbox really blocks)', r.code !== 0, `exit ${r.code}`);
  r = gen(['video', '--image', join(MEDIA, 'key.png'), '--prompt', PROMPT, '--out', 'x.mp4'], { cwd: d, spy: true, env: { FAL_KEY: null, FAL_QUEUE_URL: `http://127.0.0.1:${TRIP}` } });
  check('dry run without any key: exit 0 + a note on where the user puts their own key', r.code === 0 && /note .*no fal\.ai key found/s.test(r.out) && /never into the chat/.test(r.out));

  // ---- argument errors: exit 2
  const bad = [
    [['still', '--prompt', 'x', '--out', 'a', '--n', '5'], '--n 5'],
    [['still', '--prompt', 'x', '--out', 'a', '--aspect', '2:1'], '--aspect 2:1'],
    [['still', '--prompt', 'x', '--out', 'a', '--seconds', '6'], 'unknown option'],
    [['still', '--out', 'a'], 'no prompt'],
    [['video', '--image', join(MEDIA, 'key.png'), '--guide', join(MEDIA, 'guide-5.6s.mp4'), '--prompt', 'x', '--out', 'a.mp4'], 'both --image and --guide'],
    [['video', '--image', join(MEDIA, 'key.png'), '--prompt', 'x', '--out', 'a.mp4', '--aspect', '16:9'], '--aspect with --image'],
    [['video', '--image', join(MEDIA, 'key.png'), '--prompt', 'x', '--out', 'a.mov'], '--out not .mp4'],
    [['video', '--image', join(MEDIA, 'key.png'), '--prompt', 'x', '--out', 'a.mp4', '--sec', '11'], '--sec 11'],
    [['video', '--image', join(MEDIA, 'nope.png'), '--prompt', 'x', '--out', 'a.mp4'], 'missing image'],
    [['video', '--guide', join(MEDIA, 'guide-16s.mp4'), '--prompt', 'x', '--out', 'a.mp4'], 'guide 16.2 s'],
    [['fetch', 'abc'], 'fetch without --endpoint'],
    [['frobnicate'], 'unknown command'],
  ];
  for (const [a, what] of bad) { r = gen(a, { cwd: d }); check(`bad arguments (${what}): exit 2 with a message`, r.code === 2 && r.err.trim().length > 0, r.err.trim().split('\n')[0]); }

  // ---- key lookup: none → exit 3; --env FILE; default ~/Downloads/launch-videos/.env (export + quotes)
  await mock('/__reset', {});
  d = caseDir('nokey');
  r = gen(['still', '--prompt', PROMPT, '--out', 'k', '--go'], { cwd: d, env: { FAL_KEY: null } });
  check('--go without a key anywhere: exit 3, says where the user pastes their own key', r.code === 3 && /nohome\/Downloads\/launch-videos\/\.env/.test(r.err) && /never into the chat/.test(r.err), r.err.split('\n')[0]);
  check('--go without a key: nothing sent, nothing written', (await mock('/__log')).log.length === 0 && files(d).length === 0);
  d = caseDir('envfile');
  r = gen(['still', '--prompt', PROMPT, '--out', 'k', '--n', '1', '--go', '--env', join(ENVD, 'fake.env')], { cwd: d, env: { FAL_KEY: null } });
  let ml = await mock('/__log');
  check('--env FILE: the key from that file is used', r.code === 0 && ml.log.filter(x => !x.path.startsWith('/files')).every(x => x.auth === `Key ${KEY2}`), `exit ${r.code}`);
  await mock('/__reset', {});
  d = caseDir('homeenv');
  r = gen(['still', '--prompt', PROMPT, '--out', 'k', '--n', '1', '--go'], { cwd: d, env: { FAL_KEY: null, HOME: join(ENVD, 'home') } });
  ml = await mock('/__log');
  check('default ~/Downloads/launch-videos/.env with `export FAL_KEY="…"`: used', r.code === 0 && ml.log.filter(x => !x.path.startsWith('/files')).every(x => x.auth === `Key ${KEY3}`) && ml.log.length > 0, `exit ${r.code}`);
  await mock('/__reset', {});
  r = gen(['still', '--prompt', PROMPT, '--out', 'k2', '--n', '1', '--go', '--env', join(ENVD, 'fake.env')], { cwd: d, env: { HOME: join(ENVD, 'home') } });
  ml = await mock('/__log');
  check('an explicit --env FILE wins over FAL_KEY in the environment and the default file', r.code === 0 && ml.log.length > 0 && ml.log.filter(x => !x.path.startsWith('/files')).every(x => x.auth === `Key ${KEY2}`), `exit ${r.code}`);
  await mock('/__reset', {});
  r = gen(['still', '--prompt', PROMPT, '--out', 'k3', '--n', '1', '--go'], { cwd: d, env: { HOME: join(ENVD, 'home') } });
  ml = await mock('/__log');
  check('FAL_KEY in the environment wins over the default file', r.code === 0 && ml.log.length > 0 && ml.log.filter(x => !x.path.startsWith('/files')).every(x => x.auth === `Key ${KEY}`), `exit ${r.code}`);
  await mock('/__reset', {});
  r = gen(['still', '--prompt', PROMPT, '--out', 'k4', '--n', '1', '--go', '--env', join(ENVD, 'nokey.env')], { cwd: d, env: { HOME: join(ENVD, 'home') } });
  check('--env FILE with no FAL_KEY line: exit 3 although FAL_KEY is exported (no silent fallback), nothing sent', r.code === 3 && /--env \S*nokey\.env has no FAL_KEY line/.test(r.err) && (await mock('/__log')).log.length === 0, r.err.split('\n')[0]);

  // ---- still --go: two key frames + log; never overwrite; --force
  await mock('/__reset', {});
  d = caseDir('still');
  const spy0 = lines(SPYLOG);
  r = gen(['still', '--prompt', '@../motion.txt', '--out', 'v2/plate1-key', '--seed', '4127', '--go'], { cwd: d, spy: true });
  check('control: the network spy does record a --go run (so its silence on dry runs means something)', lines(SPYLOG) > spy0 && readFileSync(SPYLOG, 'utf8').includes('fetch http://127.0.0.1:'), `${lines(SPYLOG) - spy0} calls`);
  const k0 = join(d, 'v2', 'plate1-key_0.jpg'), k1 = join(d, 'v2', 'plate1-key_1.jpg'), klog = join(d, 'v2', 'plate1-key.fal.json');
  check('still --go: exit 0, <prefix>_0.jpg and _1.jpg arrive byte-exact', r.code === 0 && existsSync(k0) && existsSync(k1) && md5(k0) === md5(join(CDN, 'still_0.jpg')) && md5(k1) === md5(join(CDN, 'still_1.jpg')), `exit ${r.code} ${r.err.slice(0, 300)}`);
  let L = existsSync(klog) ? JSON.parse(readFileSync(klog, 'utf8')) : {};
  ml = await mock('/__log');
  const req = ml.requests[0] || {};
  check('still --go: the request carried today\'s fields (prompt, aspect_ratio, raw, num_images, seed, output_format)', JSON.stringify(Object.keys(req.input || {})) === JSON.stringify(['prompt', 'aspect_ratio', 'raw', 'num_images', 'seed', 'output_format']) && req.input.raw === true && req.input.num_images === 2 && req.input.prompt === PROMPT, JSON.stringify(Object.keys(req.input || {})));
  check('still log <prefix>.fal.json: endpoint, input, request_id, submitted/finished, estimate, status, output URLs + files + sizes, auth "Key ****"',
    L.endpoint === 'fal-ai/flux-pro/v1.1-ultra' && L.input?.prompt === PROMPT && L.request_id === req.id && L.submitted && L.finished && /\$0\.12/.test(L.estimate || '') && L.auth === 'Key ****'
    && L.status?.map(s => s.status).join(',') === 'IN_QUEUE,IN_PROGRESS,COMPLETED' && L.outputs?.length === 2 && L.outputs[0].file === 'plate1-key_0.jpg' && L.outputs[0].bytes === statSync(k0).size && /^http:\/\/127\.0\.0\.1/.test(L.outputs[0].url));
  check('API calls carried Authorization: Key <key>; CDN downloads carried no Authorization at all',
    ml.log.filter(x => !x.path.startsWith('/files')).every(x => x.auth === `Key ${KEY}`) && ml.log.filter(x => x.path.startsWith('/files')).every(x => x.auth === null) && ml.log.some(x => x.path.startsWith('/files')));
  check('status/result were polled on owner/app URLs (the sub-path URL would 405)', ml.log.some(x => x.path === `/fal-ai/flux-pro/requests/${req.id}/status`) && ml.log.some(x => x.path === `/fal-ai/flux-pro/requests/${req.id}`));
  const before = [md5(k0), statSync(k0).mtimeMs];
  r = gen(['still', '--prompt', PROMPT, '--out', 'v2/plate1-key', '--go'], { cwd: d });
  check('re-run onto existing outputs: exit 2, files untouched, nothing sent', r.code === 2 && md5(k0) === before[0] && statSync(k0).mtimeMs === before[1] && (await mock('/__log')).log.length === ml.log.length, r.err.trim());
  r = gen(['still', '--prompt', PROMPT, '--out', 'v2/plate1-key'], { cwd: d });
  check('dry run onto existing outputs: exit 2 as well', r.code === 2);
  r = gen(['still', '--prompt', PROMPT, '--out', 'v2/plate1-key', '--n', '1', '--go', '--force'], { cwd: d });
  L = JSON.parse(readFileSync(klog, 'utf8'));
  check('--force replaces them', r.code === 0 && L.outputs.length === 1 && existsSync(k0), `exit ${r.code}`);

  // ---- video --image (i2v) and --guide (r2v)
  await mock('/__reset', {});
  d = caseDir('i2v');
  copyFileSync(join(MEDIA, 'key.png'), join(d, 'plate1-key_1-clean.png'));
  r = gen(['video', '--image', 'plate1-key_1-clean.png', '--prompt', '@../motion.txt', '--out', 'v2/plate1-i2v.mp4', '--sec', '6', '--seed', '5309', '--go'], { cwd: d });
  const vout = join(d, 'v2', 'plate1-i2v.mp4');
  ml = await mock('/__log');
  const vin = ml.requests[0]?.input || {};
  check('video --image --go: exit 0, the mp4 arrives byte-exact', r.code === 0 && existsSync(vout) && md5(vout) === md5(join(CDN, 'clip.mp4')), `exit ${r.code} ${r.err.slice(0, 300)}`);
  check('i2v request = today\'s fields; image_url is a data URI of the key frame (same bytes)', JSON.stringify(Object.keys(vin)) === JSON.stringify(['prompt', 'image_url', 'duration', 'resolution', 'prompt_expansion_mode', 'seed', 'enable_safety_checker'])
    && vin.image_url?.dataUri === 'image/png' && vin.image_url?.sha1 === sha1(join(MEDIA, 'key.png')) && vin.duration === 6 && vin.resolution === '1080P' && vin.prompt_expansion_mode === 'disabled' && vin.enable_safety_checker === true, JSON.stringify(Object.keys(vin)));
  L = JSON.parse(readFileSync(join(d, 'v2', 'plate1-i2v.fal.json'), 'utf8'));
  check('i2v log keeps the file by name only: "<file plate1-key_1-clean.png>"', L.input.image_url === '<file plate1-key_1-clean.png>' && !JSON.stringify(L).includes('base64'));
  check('success line says 24 fps + the model\'s own audio track', /24 fps/.test(r.out) && /own audio track/.test(r.out), r.out.split('\n').find(l => l.startsWith('wrote')));
  await mock('/__reset', {});
  r = gen(['video', '--guide', join(MEDIA, 'guide-5.6s.mp4'), '--prompt', PROMPT, '--out', 'plate1-h3max.mp4', '--aspect', '16:9', '--seed', '2117', '--go'], { cwd: d });
  ml = await mock('/__log');
  const gin = ml.requests[0]?.input || {};
  check('video --guide --go: reference_video_urls = [data URI of the guide], duration 6, aspect_ratio, endpoint r2v', r.code === 0 && ml.requests[0]?.endpoint === 'minimax/h3-max/reference-to-video'
    && gin.reference_video_urls?.[0]?.sha1 === sha1(join(MEDIA, 'guide-5.6s.mp4')) && gin.duration === 6 && gin.aspect_ratio === '16:9'
    && JSON.stringify(Object.keys(gin)) === JSON.stringify(['prompt', 'reference_video_urls', 'duration', 'resolution', 'aspect_ratio', 'prompt_expansion_mode', 'seed', 'enable_safety_checker']), `exit ${r.code}`);

  // ---- raw: any endpoint, @file in *_url(s) fields (nested too) → data URIs; several outputs → _0, _1
  await mock('/__reset', {});
  d = caseDir('raw');
  copyFileSync(join(MEDIA, 'key.png'), join(d, 'mask.png'));
  writeFileSync(join(d, 'in.json'), JSON.stringify({ prompt: 'x', image_url: '@mask.png', extra: { mask_urls: ['@mask.png', 'https://example.com/a.png'] }, note: '@not-a-url-field' }));
  r = gen(['raw', 'fal-ai/some-model/v2', 'in.json', '--out', 'res/r.jpg'], { cwd: d });
  check('raw dry run: <file mask.png, N KB> in url fields only, estimate unknown', r.code === 0 && /"image_url": "<file mask\.png, \d+ KB>"/.test(r.out) && /"note": "@not-a-url-field"/.test(r.out) && /unknown — check fal\.ai\/models\/fal-ai\/some-model\/v2/.test(r.out));
  r = gen(['raw', 'fal-ai/some-model/v2', 'in.json', '--out', 'res/r.jpg', '--go'], { cwd: d });
  ml = await mock('/__log');
  const rin = ml.requests[0]?.input || {};
  check('raw --go: image_url + nested mask_urls[0] sent as data URIs, plain strings untouched', rin.image_url?.sha1 === sha1(join(MEDIA, 'key.png')) && rin.extra?.mask_urls?.[0]?.dataUri === 'image/png' && rin.extra?.mask_urls?.[1] === 'https://example.com/a.png' && rin.note === '@not-a-url-field');
  check('raw --go: image.url + any other {url} leaf → r_0.jpg, r_1.jpg', r.code === 0 && existsSync(join(d, 'res', 'r_0.jpg')) && existsSync(join(d, 'res', 'r_1.jpg')) && md5(join(d, 'res', 'r_1.jpg')) === md5(join(CDN, 'still_1.jpg')), `exit ${r.code} ${r.err.slice(0, 200)}`);

  // ---- fal errors → exit 4 with fal's message and the request id
  const errCase = async (modeSet, name, re, wantId = true) => {
    await mock('/__reset', {}); await mock('/__mode', modeSet);
    const dd = caseDir('err-' + name);
    const rr = gen(['video', '--image', join(MEDIA, 'key.png'), '--prompt', PROMPT, '--out', 'e.mp4', '--go'], { cwd: dd });
    const id = (await mock('/__log')).requests[0]?.id;
    check(`fal error (${name}): exit 4 with fal's message${wantId ? ' + the request id + a fetch command' : ''}`, rr.code === 4 && re.test(rr.err) && (!wantId || (rr.err.includes(id) && /fetch /.test(rr.err))), rr.err.trim().split('\n')[0]);
  };
  await errCase({ submit: '422' }, 'submit 422', /image_url: field required/, false);
  await errCase({ submit: '500' }, 'submit 500', /HTTP 500/, false);
  await errCase({ status: 'failed' }, 'status FAILED', /FAILED/);
  await errCase({ status: 'error' }, 'COMPLETED with error', /content checker flagged.*content_policy_violation/);
  await errCase({ result: 'detail' }, 'result detail', /Internal error while generating/);
  await errCase({ result: '422' }, 'result HTTP 422', /duration: Input should be/);
  await errCase({ result: 'empty' }, 'result without URLs', /no image or video URL/);
  await mock('/__reset', {}); await mock('/__mode', { status: 'stuck' });
  d = caseDir('timeout');
  r = gen(['video', '--image', join(MEDIA, 'key.png'), '--prompt', PROMPT, '--out', 't.mp4', '--go', '--timeout', '4'], { cwd: d });
  check('--timeout 4 while stuck IN_PROGRESS: exit 4 + request id + fetch command', r.code === 4 && /still IN_PROGRESS after 4 s/.test(r.err) && /fetch \S+ --endpoint minimax\/h3-max\/image-to-video --out t\.mp4/.test(r.err), r.err.trim().split('\n')[0]);

  // ---- downloads: drop / stall → resume; never completes → exit 5; fetch resumes a cut-off download
  await mock('/__reset', {}); await mock('/__mode', { download: 'drop', fails: 3, dropFrac: 0.3 });
  d = caseDir('dl-drop');
  r = gen(['video', '--image', join(MEDIA, 'key.png'), '--prompt', PROMPT, '--out', 'v.mp4', '--go'], { cwd: d });
  ml = await mock('/__log');
  const ranges = ml.log.filter(x => x.method === 'GET' && x.path === '/files/clip.mp4').map(x => x.range);
  check('3 dropped connections: resumed each time with Range from the bytes already there, file byte-exact', r.code === 0 && md5(join(d, 'v.mp4')) === md5(join(CDN, 'clip.mp4')) && ranges.length === 4 && ranges[0] === null && ranges.slice(1).every(x => /^bytes=\d+-$/.test(x))
    && new Set(ranges.slice(1)).size === 3, `ranges ${JSON.stringify(ranges)}`);
  await mock('/__reset', {}); await mock('/__mode', { download: 'stall', fails: 1, dropFrac: 0.4, stallMs: 60000 });
  d = caseDir('dl-stall');
  r = gen(['video', '--image', join(MEDIA, 'key.png'), '--prompt', PROMPT, '--out', 'v.mp4', '--go'], { cwd: d, env: { FAL_DL_TIMEOUT: '3' } });
  ml = await mock('/__log');
  check('a stalled download (connection open, no data) is cut after FAL_DL_TIMEOUT and resumed, byte-exact', r.code === 0 && md5(join(d, 'v.mp4')) === md5(join(CDN, 'clip.mp4')) && ml.log.filter(x => x.path === '/files/clip.mp4' && x.method === 'GET').map(x => x.range)[1]?.startsWith('bytes='), `exit ${r.code} ${r.s} s`);
  await mock('/__reset', {}); await mock('/__mode', { download: '404', fails: 1e9 });
  d = caseDir('dl-404');
  r = gen(['still', '--prompt', PROMPT, '--out', 'k', '--n', '1', '--go'], { cwd: d });
  check('a URL that keeps answering 404: stops after 3 tries, exit 5, prints the URL + a resume command', r.code === 5 && /download never completed: http:\/\/127\.0\.0\.1:\d+\/files\/still_0\.jpg/.test(r.err) && /fetch /.test(r.err) && (r.err.match(/try \d+\/30/g) || []).length === 3, `exit ${r.code} ${r.s} s`);
  await mock('/__reset', {}); await mock('/__mode', { download: 'stall', fails: 1e9, dropFrac: 0.4, stallMs: 60000 });
  d = caseDir('dl-cut');
  r = gen(['video', '--image', join(MEDIA, 'key.png'), '--prompt', PROMPT, '--out', 'cut.mp4', '--go'], { cwd: d, env: { FAL_DL_ATTEMPTS: '2', FAL_DL_TIMEOUT: '2' } });
  const id = (await mock('/__log')).requests[0]?.id, part = existsSync(join(d, 'cut.mp4')) ? statSync(join(d, 'cut.mp4')).size : 0;
  check('download that keeps stalling: exit 5 after FAL_DL_ATTEMPTS tries, partial file kept', r.code === 5 && part > 0 && part < statSync(join(CDN, 'clip.mp4')).size, `exit ${r.code}, ${part} bytes`);
  await mock('/__mode', { download: 'ok' });
  const nBefore = (await mock('/__log')).log.length;
  r = gen(['fetch', id, '--endpoint', 'minimax/h3-max/image-to-video', '--out', 'cut.mp4'], { cwd: d });
  ml = await mock('/__log');
  const fl = ml.log.slice(nBefore);
  check('fetch <id>: re-polls, re-reads the result and resumes the partial file (Range from its size), byte-exact', r.code === 0 && md5(join(d, 'cut.mp4')) === md5(join(CDN, 'clip.mp4')) && fl.some(x => x.path.endsWith('/status')) && fl.find(x => x.path === '/files/clip.mp4' && x.method === 'GET')?.range === `bytes=${part}-`, `exit ${r.code} ${r.err.slice(0, 200)}`);
  L = JSON.parse(readFileSync(join(d, 'cut.fal.json'), 'utf8'));
  check('fetch updates the log (fetched time, outputs with the full size)', L.fetched && L.outputs?.[0]?.bytes === statSync(join(CDN, 'clip.mp4')).size && L.request_id === id);
  rmSync(join(d, 'cut.fal.json')); rmSync(join(d, 'cut.mp4'));
  r = gen(['fetch', id, '--endpoint', 'minimax/h3-max/image-to-video', '--out', 'cut.mp4'], { cwd: d });
  check('fetch with no log: builds the owner/app queue URLs itself and downloads', r.code === 0 && md5(join(d, 'cut.mp4')) === md5(join(CDN, 'clip.mp4')), `exit ${r.code} ${r.err.slice(0, 200)}`);
  r = gen(['fetch', 'not-a-request', '--endpoint', 'minimax/h3-max/image-to-video', '--out', 'other.mp4'], { cwd: d });
  check('fetch of an unknown request id: exit 4 with fal\'s message', r.code === 4 && /not found/.test(r.err), r.err.trim().split('\n')[0]);
  r = gen(['fetch', 'another-id', '--endpoint', 'minimax/h3-max/image-to-video', '--out', 'cut.mp4'], { cwd: d });
  check('fetch onto a log that belongs to another request: exit 2', r.code === 2, r.err.trim().split('\n')[0]);
} finally {
  srv.kill(); trip.kill();
}
// ---- the fake keys never appear in anything printed or written (the fake .env files themselves excepted)
const scan = [...files(OUT).map(f => join(OUT, f))];
let leaks = scan.filter(p => { const b = readFileSync(p); return KEYS.some(k => b.includes(k)); });
check(`no fake key in any of the ${scan.length} files gen.mjs wrote`, leaks.length === 0, leaks.join(', '));
const printed = outputs.join('\n');
check(`no fake key in ${outputs.length / 2} runs' stdout/stderr`, !KEYS.some(k => printed.includes(k)));
const curlRuns = existsSync(CURL_LOG) ? readFileSync(CURL_LOG, 'utf8').trim().split('\n').length : 0;
check(`no fake key on any of the ${curlRuns} curl command lines gen.mjs ran (logged by a PATH shim), and no auth header passed to curl`, curlRuns > 10 && !KEYS.some(k => readFileSync(CURL_LOG, 'utf8').includes(k)) && !/authorization/i.test(readFileSync(CURL_LOG, 'utf8')));
const logFile = join(WA, 'logs', `test_gen${TAG}.log`);
writeFileSync(logFile, logLines.join('\n') + `\n\n${pass} passed, ${fail} failed\n`);
const after = KEYS.some(k => readFileSync(logFile).includes(k));
console.log(`${after ? 'FAIL' : 'PASS'}  the test log itself holds no key`);
console.log(`\n${pass + (after ? 0 : 1)} passed, ${fail + (after ? 1 : 0)} failed — log ${logFile}`);
process.exit(fail || after ? 1 : 0);
