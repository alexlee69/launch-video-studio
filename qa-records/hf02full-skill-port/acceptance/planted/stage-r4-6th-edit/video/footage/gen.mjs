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
// endpoint, input (files by name), request id, times, estimate, output URLs, files.
// A paid result and its request id are never lost or overwritten: every output name is checked before anything is sent
// (an existing one stops the run unless --force); the submit never follows a redirect; the request id is printed and
// saved the moment fal returns it; with --force the older generation (every file its log lists, the log itself, strays
// at these names) is then kept as <name>.prev-<id>.<ext>, never overwritten; downloads go through <file>.part-<id> and
// resume; files a log proves complete are never fetched again. Any failure after the submit exits 4 or 5 with the id and
// the fetch command. A run that was cut off (a shell timeout, a closed laptop) is resumed with that fetch command: the
// same command again stops and prints it ("request <id> is paid but not downloaded"), and a submit cut off midway leaves
// a "submit:" log that says to look the request up first (a fetch, or --force, then keeps it as
// <log>.prev-submit.fal.json: nothing says which request that submit made, so it is never merged into another's log).
// One gen.mjs at a time per --out: <log>.lock appears with its pid already in it (a hard link); a lock whose pid has
// gone is taken over by exactly one run, and a download that run left running is waited for.
// Video comes back at 24 fps with the model's own audio (conform.py / pin.py drop it).
// Key: --env FILE if given, else FAL_KEY in the environment, else ~/Downloads/launch-videos/.env (a line FAL_KEY=…).
// It is sent only to the queue (FAL_QUEUE_URL, default https://queue.fal.run) and never printed or written anywhere.
// Downloads: a fresh `curl -C -` per try (curl's own --retry restarts a try from its first byte, so it isn't used), up
// to FAL_DL_ATTEMPTS (30) tries of at most FAL_DL_TIMEOUT (120) s each.
// Exit codes: 0 done, or a dry run · 2 bad arguments, an output already exists, an earlier request at --out still to
// fetch or look up, or another gen.mjs working on it · 3 no FAL_KEY · 4 fal reported an error, the request didn't finish
// within --timeout, or anything else failed once fal had the request (the id and the fetch command are printed) · 5 a
// download never completed (the URL is printed) · 1 an unexpected failure before anything was sent (a bug: the stack
// is printed).
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, lstatSync, unlinkSync, renameSync, readdirSync, linkSync } from 'node:fs';
import { resolve, dirname, extname, basename, join, relative } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';

const STILL = 'fal-ai/flux-pro/v1.1-ultra', I2V = 'minimax/h3-max/image-to-video', R2V = 'minimax/h3-max/reference-to-video';
const PRICES = 'fal prices checked 2026-10-22: fal-ai/flux-pro/v1.1-ultra $0.06 per image · minimax/h3-max/* $0.16 per second at 1080P · anything else: check fal.ai/models';
const ASPECTS = ['9:16', '16:9', '1:1', '4:3', '3:4', '21:9', '9:21'], RES = ['480P', '768P', '1080P'];
const MIME = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm' };
const BASE = (process.env.FAL_QUEUE_URL || 'https://queue.fal.run').replace(/\/+$/, '');
const VALUED = ['prompt', 'out', 'n', 'aspect', 'seed', 'raw', 'endpoint', 'image', 'guide', 'sec', 'res', 'timeout', 'env'];
const IMG_EXT = /\.(jpe?g|png|webp)$/i;              // a still's --out may carry one; the prefix is what comes before it

let KEY = null;                                     // set only for --go / fetch; every line printed or written is scrubbed of it
const scrub = s => KEY ? String(s).split(KEY).join('****') : String(s);
const say = s => console.log(scrub(s)), warn = s => console.error(scrub(s));
const die = (code, msg) => { warn(msg); process.exit(code); };
class FalError extends Error { constructor(m, unsure = false) { super(m); this.unsure = unsure; } }   // unsure: fal may have created it
const q = s => /^[\w@%+=:,./-]+$/.test(String(s)) ? String(s) : `'${String(s).replace(/'/g, `'\\''`)}'`;   // shell-quoted, for printed commands
const rel = p => relative(process.cwd(), p) || '.';
const ctx = { id: null, endpoint: null, out: null, force: false };   // for the "fetch picks it up" hint
const fetchCmd = () => `node ${q(process.argv[1])} fetch ${q(ctx.id)} --endpoint ${q(ctx.endpoint)} --out ${q(ctx.out)}${ctx.force ? ' --force' : ''}`;
const fetchHint = () => ctx.id ? `\n  request ${ctx.id} — once it has finished: ${fetchCmd()}` : '';
const tagOf = id => String(id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'noid';
const there = p => { try { lstatSync(p); return true; } catch { return false; } };   // a dangling symlink counts too
const isDir = p => { try { return statSync(p).isDirectory(); } catch { return false; } };

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
const MAXPOS = { still: 0, video: 0, raw: 2, fetch: 1 }[cmd];   // an unquoted prompt spills words here: never send just its first word
if (pos.length > MAXPOS) die(2, `unexpected argument${pos.length - MAXPOS > 1 ? 's' : ''} ${pos.slice(MAXPOS).map(q).join(' ')} — quote a prompt that has spaces: --prompt "a woman at a kitchen table"`);
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

// kind = how the result is read and named: still (images → <prefix>_<i>.jpg), video (the video → --out), raw (every URL)
let endpoint, input, out, logPath, expect = null, kind = cmd;
if (cmd === 'still') {
  const n = int(o.n ?? 2, 1, 4, '--n'), raw = oneOf(String(o.raw ?? 'true'), ['true', 'false'], '--raw') === 'true';
  endpoint = o.endpoint || STILL;
  input = { prompt: promptOf(o.prompt), aspect_ratio: oneOf(o.aspect || '16:9', ASPECTS, '--aspect'), raw, num_images: n, ...seed(), output_format: 'jpeg' };
  out = resolve(need(o.out, '--out <prefix>')).replace(IMG_EXT, '');
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
  kind = endpoint === STILL ? 'still' : /^minimax\/h3-max\/(image|reference)-to-video$/.test(endpoint) ? 'video' : 'raw';   // as the run that made it
  out = resolve(need(o.out, '--out <path> (the same --out as the original run)'));
  if (kind === 'still') out = out.replace(IMG_EXT, '');
  logPath = (kind === 'still' ? out : stripExt(out)) + '.fal.json';
}
ctx.endpoint = endpoint; ctx.out = o.out;
const timeout = int(o.timeout ?? 900, 1, 86400, '--timeout');
const pendingOf = id => logPath.replace(/\.fal\.json$/, `.pending-${tagOf(id)}.fal.json`);   // a request's log before it takes the log's place

// ---- every name this run could write, checked before anything is sent
const readLog = p => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };
const filesOf = (lg, lp) => (lg && Array.isArray(lg.outputs) ? lg.outputs : []).filter(x => x && typeof x.file === 'string').map(x => resolve(dirname(lp), x.file));
const listDir = d => { try { return readdirSync(d); } catch { return []; } };   // no folder yet: nothing there
const pendPrefix = () => basename(logPath).replace(/\.fal\.json$/, '.pending-');
const pendings = () => listDir(dirname(logPath)).filter(f => f.startsWith(pendPrefix()) && f.endsWith('.fal.json')).sort().map(f => join(dirname(logPath), f));
function owned() {                                   // files another log here lists (a sibling run's, an archived generation's): never ours to move
  const set = new Set(), d = dirname(logPath);
  for (const f of listDir(d)) if (f.endsWith('.fal.json') && join(d, f) !== logPath && !f.startsWith(pendPrefix())) for (const x of filesOf(readLog(join(d, f)), join(d, f))) set.add(x);
  return set;
}
const exts = () => kind === 'still' ? ['.jpg'] : kind === 'raw' && extname(out) ? [extname(out).toLowerCase()] : null;   // what this run can write
const numbered = stem => {                           // <stem>_<n><ext>: this run's numbered outputs — its extensions only, never another log's files
  const b = basename(stem), x = exts(), skip = owned();
  return listDir(dirname(stem)).filter(f => f.startsWith(b + '_') && /^_\d+(\.[A-Za-z0-9]+)?$/.test(f.slice(b.length)) && (!x || x.includes(extname(f).toLowerCase())))
    .map(f => join(dirname(stem), f)).filter(p => !skip.has(p));
};
const possible = () => [...new Set([...(expect || []), ...(kind === 'video' ? [out] : kind === 'still' ? numbered(out) : [out, ...numbered(stripExt(out))])])];
const legacy = lg => !lg.kind && !Array.isArray(lg.outputs);   // a log from before this tool (no kind, no outputs list): judged by the files
const doneAll = lg => Array.isArray(lg.outputs) && lg.outputs.length > 0 && lg.outputs.every(x => x && x.done && typeof x.file === 'string');   // all downloaded once
const missing = lg => legacy(lg) ? (expect || []).filter(p => !there(p)) : filesOf(lg, logPath).filter(p => !there(p));
const whole = lg => legacy(lg) ? (expect || []).length > 0 && !missing(lg).length : doneAll(lg) && !missing(lg).length;
const sameRun = (a, b) => !!(a && b && a.submitted) && a.submitted === b.submitted;   // a submit's stub and the log it became share one time
function classify() {                                // what earlier runs left at this --out: one reading for the preflight and for fetch
  const at = p => ({ path: p, log: readLog(p) }), main = there(logPath) ? at(logPath) : null, pend = pendings().map(at);
  const all = [main, ...pend].filter(e => e && e.log && typeof e.log === 'object'), ids = all.filter(e => e.log.request_id);
  return {
    main, pend,
    paid: ids.filter(e => !e.log.failed && !whole(e.log) && !doneAll(e.log)),   // fal has it (paid), never all downloaded: fetch it
    gone: ids.filter(e => !e.log.failed && doneAll(e.log) && missing(e.log).length),   // downloaded, then files deleted: fetch again, free
    failed: ids.filter(e => e.log.failed && !whole(e.log)),                // fal said it failed: nothing to fetch
    stubs: all.filter(e => !e.log.request_id && e.log.submit && !ids.some(x => sameRun(x.log, e.log))),   // a submit cut off midway
  };
}
const fetchFor = (id, ep, force) => `node ${q(process.argv[1])} fetch ${id === '<request_id>' ? id : q(id)} --endpoint ${q(ep)} --out ${q(o.out)}${force ? ' --force' : ''}`;
function checkOut() {                                // what earlier runs left at --out decides whether this run may pay (again)
  // another run working here right now explains whatever it is writing (a stub, a pending log): say that instead
  const stop = m => { const h = lockHolder(); die(2, h ? busy(h) : m); };
  const c = classify();
  const forceFor = e => e.path !== logPath && !!c.main && !(c.main.log && (c.main.log.request_id === e.log.request_id || sameRun(c.main.log, e.log)));
  if (!o.force && c.paid.length) {                   // a cut-off run: fetch it, never pay for it again
    const e = c.paid[0];
    stop(`request ${e.log.request_id} is paid but not downloaded — resume it: ${fetchFor(e.log.request_id, e.log.endpoint || endpoint, forceFor(e))} (no new charge); --force on the --go command starts a NEW paid generation`);
  }
  if (!o.force && c.stubs.length) {                  // fal may have the request: find its id before paying again
    const e = c.stubs[0];
    stop(`an earlier submit (${rel(e.path)}, ${e.log.submitted || 'time unknown'}) may have created a paid request — check fal.ai/dashboard/requests, then fetch it by id: ${fetchFor('<request_id>', e.log.endpoint || endpoint, forceFor(e))}; --force on the --go command starts a NEW paid generation`);
  }
  if (!o.force && c.gone.length) {                   // downloaded once, files deleted since: fetching them again costs nothing
    const e = c.gone[0], m = missing(e.log), them = m.length > 1 ? 'them' : 'it';
    stop(`request ${e.log.request_id} was downloaded, but ${m.map(rel).join(', ')} ${m.length > 1 ? 'have' : 'has'} been deleted since — fetch downloads ${them} again (no new charge): ${fetchFor(e.log.request_id, e.log.endpoint || endpoint, forceFor(e))}; for a new generation, pick another --out or add --force to the --go command (both pay again)`);
  }
  const taken = [...possible(), logPath].filter(there), dirs = taken.filter(isDir);
  if (dirs.length) stop(`${dirs.map(rel).join(', ')} ${dirs.length > 1 ? 'are folders' : 'is a folder'} where gen.mjs writes a file — rename ${dirs.length > 1 ? 'them' : 'it'}, or pick another --out`);
  const why = c.failed.length ? `request ${c.failed[0].log.request_id} failed at fal (${c.failed[0].log.failed}); there is nothing to fetch. ` : '';
  if (taken.length && !o.force) stop(`${why}${taken.map(rel).join(', ')} already exist${taken.length > 1 ? '' : 's'} — pick another --out (pays again), or add --force (pays again; once fal accepts the new request the older files are kept as *.prev-<id>.*, never overwritten)`);
  return taken;
}
const lockPath = logPath + '.lock';
const raw = p => { try { return readFileSync(p, 'utf8'); } catch { return null; } };   // null: no such file
const drop = p => { try { unlinkSync(p); } catch { /* moved into place, or gone */ } };
const alive = pid => { if (!(pid > 0) || pid === process.pid) return false; try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
function lockHolder() {                              // the live pid in <log>.lock, or null (no lock, or its process has gone)
  const pid = parseInt(raw(lockPath), 10);
  return alive(pid) ? pid : null;
}
const busy = pid => `another gen.mjs (pid ${pid}) is working on ${rel(logPath)} — let it finish (or stop it), then run this again (if pid ${pid} is not a gen.mjs, delete ${rel(lockPath)})`;
function takeLock() {                                // one gen.mjs per --out: two would write into the same .part file
  // The lock never exists empty: our pid goes into <lock>.<pid> first, which is then hard-linked to the lock's name (one
  // step; EEXIST = held). A lock whose pid has gone is replaced only by the run that links <lock>.takeover-<that pid>
  // first, after checking the lock still holds that pid; the others then find the new holder alive.
  const mine = `${lockPath}.${process.pid}`, fail = m => { drop(mine); die(2, m); };
  try { writeFileSync(mine, `${process.pid}\n`); } catch (e) { die(2, `can't create ${rel(lockPath)}: ${e.message}`); }
  for (let k = 0; k < 400; k++) {
    try { linkSync(mine, lockPath); drop(mine); return held(); } catch (e) { if (e.code !== 'EEXIST') fail(`can't create ${rel(lockPath)}: ${e.message}`); }
    const was = raw(lockPath);
    if (was === null) continue;                      // released this moment: try again
    const pid = parseInt(was, 10);
    if (alive(pid)) fail(busy(pid));
    const claim = `${lockPath}.takeover-${pid > 0 ? pid : 'x'}`;
    try { linkSync(mine, claim); } catch (e) {        // another run is replacing that lock right now — unless it died doing so
      if (e.code !== 'EEXIST') fail(`can't create ${rel(claim)}: ${e.message}`);
      if (!alive(parseInt(raw(claim), 10))) drop(claim); else pause(20);
      continue;
    }
    try {
      if (raw(lockPath) !== was) continue;           // replaced meanwhile: look again
      renameSync(mine, lockPath);                    // the dead run's lock becomes ours in one step
    } finally { drop(claim); }
    warn(`note: ${rel(lockPath)} was left by a gen.mjs that is no longer running — taking it over`);
    return held();
  }
  fail(`couldn't take ${rel(lockPath)} — other gen.mjs runs keep starting on ${rel(logPath)}; try again`);
}
function held() {                                    // ours until this process exits; a run that never held it never removes it
  process.on('exit', () => { if (parseInt(raw(lockPath), 10) === process.pid) drop(lockPath); });
}
function archiveName(p, tag) {                       // x.mp4 → x.prev-<tag>.mp4 (the real extension last), never an existing name
  const m = /(\.fal\.json|\.[A-Za-z0-9]{1,5})$/.exec(basename(p)), ext = m ? m[1] : '', stem = p.slice(0, p.length - ext.length);
  for (let k = 1; ; k++) { const n = `${stem}.prev-${tag}${k > 1 ? '-' + k : ''}${ext}`; if (!there(n)) return n; }
}
function archivePlan(oldLog, oldLogPath, extra, withLog = true, logs = []) {   // [[from, to]] for one older generation: its log, every file it lists, strays at our names
  const tag = oldLog && oldLog.request_id ? tagOf(oldLog.request_id) : oldLog && oldLog.submit ? 'submit' : 'old', listed = new Set(filesOf(oldLog, oldLogPath)), plan = [], taken = new Set();
  const name = (p, t) => { let n = archiveName(p, t); for (let k = 2; taken.has(n); k++) n = archiveName(p, `${t}-${k}`); taken.add(n); return n; };
  for (const p of [...listed, ...extra]) if (there(p) && p !== oldLogPath && !plan.some(([a]) => a === p)) plan.push([p, name(p, listed.has(p) ? tag : 'stray')]);
  if (withLog && there(oldLogPath)) plan.push([oldLogPath, name(oldLogPath, oldLog ? tag : 'stray')]);
  for (const p of logs) if (there(p) && !plan.some(([a]) => a === p)) {   // pending logs and stubs: <log>.prev-<id|submit>.fal.json, out of the way
    const lg = readLog(p); plan.push([p, name(oldLogPath, lg && lg.request_id ? tagOf(lg.request_id) : 'submit')]);
  }
  return plan;
}
function archive(plan, oldLog, oldLogPath) {         // files are renamed, the old log is rewritten to point at their new names
  const done = [];
  try { for (const [a, b] of plan) if (a !== oldLogPath) { renameSync(a, b); done.push([a, b]); } }
  catch (e) { for (const [a, b] of done.reverse()) try { renameSync(b, a); } catch { /* left under its .prev name */ } throw e; }   // all or nothing
  const lp = plan.find(([a]) => a === oldLogPath);
  if (!lp) return;
  if (!oldLog) return renameSync(lp[0], lp[1]);      // not a log we can read: kept as it is
  const moved = new Map(plan), d = dirname(oldLogPath);
  const fixed = { ...oldLog, outputs: (oldLog.outputs || []).map(x => moved.has(resolve(d, x.file || '')) ? { ...x, file: relative(d, moved.get(resolve(d, x.file))) } : x),
    archived: { at: new Date().toISOString(), log: basename(oldLogPath) } };
  writeJson(lp[1], fixed);                            // the original stays until the new log replaces it in one rename
}
function writeJson(p, v) { writeFileSync(p + '.tmp', scrub(JSON.stringify(v, null, 2)) + '\n'); renameSync(p + '.tmp', p); }

function estimate(ep, inp) {
  if (ep === STILL) { const n = inp.num_images || 1; return `${n} image${n > 1 ? 's' : ''} × $0.06 = $${(n * .06).toFixed(2)}`; }
  if (/^minimax\/h3-max\//.test(ep)) {
    const s = Number(inp.duration), r = inp.resolution || '1080P';
    if (!(s > 0)) return `unknown — the input has no duration (fal's default applies); check fal.ai/models/${ep}`;
    return r === '1080P' ? `${s} s × $0.16/s at 1080P = $${(s * .16).toFixed(2)}` : `${s} s at ${r}: unknown — at most $${(s * .16).toFixed(2)} (the 1080P price); check fal.ai/models`;
  }
  return `unknown — check fal.ai/models/${ep}`;
}
function loadKey() {
  // an explicit --env FILE wins (no fallback to an exported key), then FAL_KEY in the environment, then the default file
  if (!o.env && process.env.FAL_KEY && process.env.FAL_KEY.trim()) return { key: process.env.FAL_KEY.trim() };
  const f = o.env ? resolve(o.env) : join(homedir(), 'Downloads', 'launch-videos', '.env');
  let t = ''; try { t = readFileSync(f, 'utf8'); } catch { /* no file = no key */ }
  const m = t.match(/^[ \t]*(?:export[ \t]+)?FAL_KEY[ \t]*=[ \t]*(.*)$/m), v = m ? m[1].trim() : '';
  const quoted = /^(["'])(.*?)\1/.exec(v);           // a quoted value ends at its closing quote (a "# note" after it is a comment)
  const k = quoted ? quoted[2].trim() : v.replace(/\s+#.*$/, '').trim();
  return { key: k || null, file: f };
}
const keyAdvice = f => `no fal.ai key found (${o.env ? `--env ${f}` : `FAL_KEY is not set, and ${f}`} has no FAL_KEY line). Ask the user to paste their own key\n` +
  `into ${f} as one line, FAL_KEY=<their key>, then chmod 600 it — never into the chat. Keys: fal.ai/dashboard/keys.`;

// ---- preflight + dry run: nothing leaves this machine, nothing is written
let oldLog = null, plan = [];
if (cmd !== 'fetch') {
  const holder = lockHolder();
  if (holder) die(2, busy(holder));
  const taken = checkOut();
  oldLog = readLog(logPath);
  plan = o.force ? archivePlan(oldLog, logPath, taken, true, pendings()) : [];
  const est = estimate(endpoint, input);
  if (!o.go) {
    say(`endpoint  ${endpoint}`);
    say(`input     ${JSON.stringify(shown(input, true), null, 2).replace(/\n/g, '\n          ')}`);
    say(`estimate  ${est}\n          (${PRICES})`);
    say(`writes    ${expect.map(rel).join(', ')}${kind === 'raw' ? ' (or _0, _1 … for several outputs)' : ''} + ${rel(logPath)}`);
    if (plan.length) say(`--force   once fal accepts the new request, keeps ${plan.map(([a, b]) => `${rel(a)} → ${basename(b)}`).join(', ')}`);
    if (!loadKey().key) say(`note      ${keyAdvice(loadKey().file).replace(/\n/g, '\n          ')}`);
    say('dry run — show the user the prompt and the estimate; add --go once they approve the spend');
    process.exit(0);
  }
}

// ---- --go / fetch
const K = loadKey();
if (!K.key) die(3, keyAdvice(K.file));
KEY = K.key;
try { mkdirSync(dirname(logPath), { recursive: true }); mkdirSync(dirname(out), { recursive: true }); }   // before anything is paid for
catch (e) { die(2, `can't create the folder for ${rel(logPath)}: ${e.message}`); }
const save = (log, p = logPath) => writeJson(p, log);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const detail = j => typeof j?.detail === 'string' ? j.detail : Array.isArray(j?.detail) ? j.detail.map(d => `${(d.loc || []).filter(x => x !== 'body').join('.')}: ${d.msg}`).join('; ')
  : j?.error ? `${j.error}${j.error_type ? ` (${j.error_type})` : ''}` : JSON.stringify(j).slice(0, 600);
async function api(url, opt = {}) {                 // the key goes to the queue only — never to a URL on another host
  if (new URL(url).origin !== new URL(BASE).origin) throw new FalError(`refusing to send the key to ${new URL(url).origin} (the queue is ${new URL(BASE).origin})`);
  const post = opt.method === 'POST';
  for (let i = 0; ; i++) {
    let r, t;
    try {                                            // a submit never follows a redirect: replaying it could create (and charge) a second request
      r = await fetch(url, { ...opt, ...(post ? { redirect: 'manual' } : {}), headers: { Authorization: `Key ${KEY}`, ...(opt.body ? { 'Content-Type': 'application/json' } : {}) }, signal: AbortSignal.timeout(120000) });
      t = await r.text();
    } catch (e) {                                    // a poll survives a network blip; a submit doesn't retry (it could be charged twice)
      if (post) throw new FalError(`couldn't reach fal (${e.cause?.code || e.message}) — the request may or may not have been created; check fal.ai/dashboard/requests before running it again`, true);
      if (i >= 5) throw new FalError(`couldn't reach fal (${e.cause?.code || e.message})`);
      await sleep(3000); continue;
    }
    if (post && r.status >= 300 && r.status < 400) throw new FalError(`fal answered the submit with a redirect (HTTP ${r.status}${r.headers.get('location') ? ` to ${r.headers.get('location')}` : ''}); it was not followed. The request may not have been created — check fal.ai/dashboard/requests before running it again`, true);
    let j; try { j = JSON.parse(t); } catch { j = { raw: t.slice(0, 500) }; }
    if (!post && (r.status === 429 || r.status >= 500) && i < 5) {   // a busy or briefly failing queue: wait, ask again
      const ra = Number(r.headers.get('retry-after'));
      await sleep(Math.min(30, ra > 0 ? ra : 3) * 1000); continue;
    }
    if (r.status >= 400) throw new FalError(`fal answered HTTP ${r.status}: ${detail(j)}${post && r.status >= 500 ? ' — the request may have been created; check fal.ai/dashboard/requests before running it again' : ''}`, post && r.status >= 500);
    return j;
  }
}
const queueUrls = (id, have = {}) => {
  const ok = u => { try { return new URL(u).origin === new URL(BASE).origin; } catch { return false; } };
  const app = `${BASE}/${appOf(endpoint)}/requests/${id}`;
  return { status_url: ok(have.status_url) ? have.status_url : `${app}/status`, response_url: ok(have.response_url) ? have.response_url : app };
};
async function waitFor(urls, log, confirmed = () => {}) {   // confirmed(): once, when fal first answers for this request
  const t0 = Date.now(); let last = '', first = true;
  for (;;) {
    const s = await api(urls.status_url), t = Math.round((Date.now() - t0) / 1000);
    if (first) { first = false; confirmed(); }
    if (s.status !== last) {
      last = s.status; log.status.push({ t, status: s.status, ...(s.queue_position != null ? { queue_position: s.queue_position } : {}) }); save(log);
      say(`${t} s  ${s.status}${s.queue_position != null ? ` (queue ${s.queue_position})` : ''}`);
    }
    if (s.error || /^(FAILED|ERROR)$/i.test(s.status || '')) { log.failed = detail(s.error ? s : { error: s.status }); save(log); throw new FalError(`fal: ${log.failed}`); }
    if (s.status === 'COMPLETED') return;
    if (Date.now() - t0 > timeout * 1000) throw new FalError(`still ${s.status} after ${timeout} s (--timeout)`);
    await sleep(3000);
  }
}
function outputsOf(res) {   // still: images[] / image · video: the video (one file) · raw: also any other {url} leaf
  const list = [], seen = new Set();
  const add = m => { if (m && typeof m.url === 'string' && /^https?:\/\//.test(m.url) && !seen.has(m.url)) { seen.add(m.url); list.push({ url: m.url, size: Number.isFinite(m.file_size) ? m.file_size : null, type: m.content_type || null }); } };
  (Array.isArray(res?.images) ? res.images : []).forEach(add); add(res?.image);
  if (kind !== 'still') add(res?.video);
  if (kind === 'raw') (function deep(v) { if (Array.isArray(v)) v.forEach(deep); else if (v && typeof v === 'object') { add(v); Object.values(v).forEach(deep); } })(res);
  if (kind === 'video') { const v = list.find(m => m.url === res?.video?.url) || list[0]; return v ? [v] : []; }
  return list;
}
const extOf = m => EXT[m.type] || (/\.[a-z0-9]{2,4}$/i.exec(new URL(m.url).pathname) || [''])[0].toLowerCase() || '.bin';
const destsOf = list => kind === 'still' ? list.map((m, i) => `${out}_${i}${extOf(m)}`)
  : list.length === 1 && extname(out) ? [out] : list.map((m, i) => `${stripExt(out)}_${i}${extname(out) || extOf(m)}`);
const mb = n => n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`;
const sizeOf = p => existsSync(p) ? statSync(p).size : 0;
const pause = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const readable = p => spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=format_name', '-of', 'csv=p=0', p], { encoding: 'utf8' }).status === 0;
function contentLength(url) {
  const r = spawnSync('curl', ['-4', '--http1.1', '-sS', '-I', '-L', '--connect-timeout', '20', '--max-time', '60', url], { encoding: 'utf8' });
  const last = (r.stdout || '').split(/\r?\n\r?\n/).filter(b => /^HTTP\//.test(b)).pop() || '';
  return r.status === 0 && /^HTTP\/\S+ 2/.test(last) && /^content-length:\s*(\d+)/im.test(last) ? +/^content-length:\s*(\d+)/im.exec(last)[1] : null;
}
function writersOf(part) {                          // processes whose command line writes <part> (curl -o <part>), not this one
  const r = spawnSync('ps', ['-axww', '-o', 'pid=,command='], { encoding: 'utf8' });
  return (r.stdout || '').split('\n').filter(l => l.includes(` -o ${part} `)).map(l => parseInt(l, 10)).filter(n => n > 0 && n !== process.pid);
}
function download(m, dest) {   // into <dest>.part-<id> (resumable, this request's only), renamed onto dest once curl and ffprobe agree
  const tries = Math.max(1, Math.round(+process.env.FAL_DL_ATTEMPTS || 30)), tmax = Math.max(1, Math.round(+process.env.FAL_DL_TIMEOUT || 120));
  const part = `${dest}.part-${tagOf(ctx.id)}`, want = m.size ?? contentLength(m.url);
  for (let t = 0, w; (w = writersOf(part)).length; t += 2) {   // a killed run's curl goes on writing until its --max-time: wait for it
    if (!t) warn(`  ${basename(dest)}: pid ${w.join(', ')} (a download left running by an earlier run) is still writing ${basename(part)} — waiting for it to stop (at most ${tmax + 10} s)`);
    if (t > tmax + 10) die(5, `pid ${w.join(', ')} is still writing ${rel(part)} — stop it (kill ${w.join(' ')}), then run this again: ${fetchCmd()}`);
    pause(2000);
  }
  let gone = 0, done = false;                        // gone: consecutive 4xx answers (an expired or wrong URL), stop after 3
  for (let i = 1; i <= tries && !done; i++) {
    const r = spawnSync('curl', ['-4', '--http1.1', '-sS', '-L', '--fail', '-C', '-', '--connect-timeout', '20', '--max-time', String(tmax), '-w', '%{http_code}', '-o', part, m.url], { encoding: 'utf8' });
    const code = +(r.stdout || '').trim().slice(-3);
    if (r.status === 0 || (code === 416 && sizeOf(part) > 0)) { done = true; break; }   // 416 on a resume at the end: the part file is whole
    if (r.status === 33) { try { unlinkSync(part); } catch { /* nothing to resume */ } }   // the CDN can't resume: only the part file starts over
    gone = code >= 400 && code < 500 && code !== 408 && code !== 429 ? gone + 1 : 0;
    warn(`  ${basename(dest)}: try ${i}/${tries} stopped at ${mb(sizeOf(part))}${want ? ` of ${mb(want)}` : ''} (${(r.stderr || '').trim().split('\n').pop() || `curl exit ${r.status}`})${gone >= 3 ? '' : ' — resuming'}`);
    if (gone >= 3) break;
    if (i < tries) pause(2000);
  }
  const bytes = sizeOf(part), ok = done && bytes > 0 && readable(part);
  if (ok) {
    if (there(dest)) { const b = archiveName(dest, 'stray'); renameSync(dest, b); warn(`kept the file that was at ${basename(dest)} as ${basename(b)}`); }
    renameSync(part, dest);
    if (want != null && bytes !== want) warn(`  ${basename(dest)}: ${bytes} bytes where fal said ${want} — kept (curl finished cleanly and ffprobe reads it)`);
  }
  return { bytes, want, ok, done, part };
}
function describe(p) {
  const j = probe(p, ['-show_entries', 'stream=codec_type,width,height,r_frame_rate:format=duration']) || {}, st = j.streams || [];
  const v = st.find(s => s.codec_type === 'video'), a = st.some(s => s.codec_type === 'audio');
  if (!v) return `${rel(p)} (${mb(sizeOf(p))})`;
  const [nu, de] = String(v.r_frame_rate || '0/1').split('/').map(Number), fps = de ? +(nu / de).toFixed(3) : 0, dur = Number(j.format?.duration);
  if (!(dur > 0.2) || /^image|_pipe$/.test(j.format?.format_name || '') || /\.(jpe?g|png|webp)$/i.test(p)) return `${rel(p)} (${mb(sizeOf(p))}, ${v.width}×${v.height})`;
  return `${rel(p)} (${mb(sizeOf(p))}, ${v.width}×${v.height}, ${fps} fps, ${dur.toFixed(2)} s${a ? ', with the model\'s own audio track' : ''}) — conform.py / pin.py ${a ? 'drop the audio and ' : ''}put the ${fps} fps picture on the film's frame grid`;
}

async function main() {
  let log, urls, mine = null;
  if (cmd === 'fetch') {
    takeLock();
    const c = classify(), byId = e => !!(e && e.log && e.log.request_id === ctx.id);
    const mineE = (byId(c.main) ? c.main : null) || c.pend.find(byId) || null;   // this request's own log, or its pending log
    mine = mineE ? mineE.log : null;
    // a stub (a submit cut off midway) may or may not have made this request, so it is never merged into this log: the one
    // at the log's name (this log replaces it), or, when this request has no log here, the one the preflight names, is kept
    // as <log>.prev-submit.fal.json
    const stubE = c.stubs.find(e => e.path === logPath) || (mineE ? null : c.stubs[0]) || null, keep = stubE ? [stubE.path] : [];
    const otherE = c.main && c.main !== mineE && c.main !== stubE && !(c.main.log && sameRun(c.main.log, mine)) ? c.main : null, other = otherE ? otherE.log : null, log0 = c.main && c.main.log;
    const spent = [mineE, ...c.pend.filter(e => e.log && !e.log.request_id && sameRun(e.log, mine))].filter(e => e && e.path !== logPath);   // replaced by this log
    if (otherE && !o.force) die(2, `${rel(logPath)} belongs to request ${other?.request_id || '(unknown)'}, not ${ctx.id}${mineE ? ` (this request's log waits in ${rel(mineE.path)})` : ''} — add --force to keep the older files as *.prev-<id>.*, or pick another --out`);
    if (log0 && log0.endpoint && log0.endpoint !== endpoint && !o.force) die(2, `${rel(logPath)} was sent to ${log0.endpoint}, not ${endpoint} — check --endpoint`);
    if (mine && ['still', 'video', 'raw'].includes(mine.kind)) kind = mine.kind;
    const proven = new Set(mine ? filesOf(mine, logPath) : []);
    const strange = possible().filter(p => there(p) && !proven.has(p)), dirs = strange.filter(isDir);
    if (dirs.length) die(2, `${dirs.map(rel).join(', ')} is a folder where gen.mjs writes a file — rename it, or pick another --out`);
    if (strange.length && !o.force) die(2, `${strange.map(rel).join(', ')} exist${strange.length > 1 ? '' : 's'}, and no log shows ${strange.length > 1 ? 'them' : 'it'} as request ${ctx.id}'s download — pick another --out, or --force (kept as *.prev-*)`);
    ctx.force = !!o.force;
    const fplan = o.force ? archivePlan(other, logPath, strange, !!otherE, keep) : keep.length ? archivePlan(null, logPath, [], false, keep) : [];   // this request's own log is never archived
    log = mine ? { status: [], ...mine, endpoint, request_id: ctx.id } : { endpoint, kind, request_id: ctx.id, status: [] };   // another request's log never leaks in
    delete log.submit; delete log.archived; delete log.failed;
    urls = queueUrls(ctx.id, mine || {});
    say(`fetching request ${ctx.id} from ${endpoint}`);
    // nothing on disk changes until fal answers for this request: then the other generation steps aside and this log takes its place
    await waitFor(urls, log, () => {
      try { archive(fplan, other, logPath); } catch (e) { throw new FalError(`fal knows request ${ctx.id}, but the older files at --out couldn't be moved aside (${e.message}); nothing was changed — fix that and run this again`); }
      const kept = stubE && fplan.find(([a]) => a === stubE.path);
      if (kept) say(`kept ${rel(kept[0])} as ${basename(kept[1])}: the log of an earlier submit that may or may not have made request ${ctx.id} (its prompt is in there, not in this request's log)`);
      log.fetched = new Date().toISOString(); save(log);
      for (const e of new Set(spent)) if (there(e.path)) unlinkSync(e.path);   // its pending log or stub has done its job
    });
  } else {
    const est = estimate(endpoint, input);
    log = { endpoint, kind, input: shown(input, false), estimate: est, prices: PRICES, auth: 'Key ****', submitted: new Date().toISOString(), status: [] };
    takeLock();
    const taken = checkOut();                        // again, under the lock: a run that just finished here counts too
    oldLog = readLog(logPath); plan = o.force ? archivePlan(oldLog, logPath, taken, true, pendings()) : [];
    // a stub on disk BEFORE the POST: if this run is killed mid-submit, the next run is told to look the request up, not to pay again
    const stub = (() => { if (!there(logPath)) return logPath; for (let k = 1; ; k++) { const n = logPath.replace(/\.fal\.json$/, `.pending-submit${k > 1 ? '-' + k : ''}.fal.json`); if (!there(n)) return n; } })();
    const mark = why => save({ ...log, submit: `${why} — fal may have created (and will charge) this request: check fal.ai/dashboard/requests, then fetch it by id` }, stub);
    mark('sending');
    say(`estimate ${est} — submitting to ${endpoint}`);
    let sub;
    try { sub = await api(`${BASE}/${endpoint}`, { method: 'POST', body: JSON.stringify(wire(input)) }); }
    catch (e) { if (e.unsure) mark('unknown: the submit failed halfway'); else try { unlinkSync(stub); } catch { /* gone */ } throw e; }   // refused (4xx): no trace, a retry needs no --force
    if (!sub.request_id) { mark('unknown: fal sent no request_id'); throw new FalError(`fal accepted the request but sent no request_id: ${JSON.stringify(sub).slice(0, 300)}`, true); }
    // fal has the request (paid): its id is printed and on disk before anything else can go wrong
    ctx.id = sub.request_id; urls = queueUrls(sub.request_id, sub);
    Object.assign(log, { request_id: sub.request_id, ...urls });
    const pend = pendingOf(sub.request_id);
    say(`submitted — request ${sub.request_id} (if this run stops: ${fetchCmd()})`);
    try { save(log, pend); }
    catch (e) { throw new FalError(`couldn't save request ${sub.request_id}'s log (${e.message}) — note the id above`); }
    try { unlinkSync(stub); } catch { /* gone */ }    // the pending log holds the id now
    try { if (plan.length) archive(archivePlan(oldLog, logPath, possible().filter(there), true, pendings().filter(x => x !== pend)), oldLog, logPath); }   // the older generation steps aside
    catch (e) { ctx.force = true; throw new FalError(`fal accepted request ${sub.request_id} (it is paid), but the older files couldn't be moved aside (${e.message}). Its log is safe as ${rel(pend)}; fix that, then run the fetch command below`); }
    renameSync(pend, logPath);                       // one rename: the log is the old one or the new one, never neither
    await waitFor(urls, log);
  }
  const res = await api(urls.response_url);
  log.result = res; log.finished = new Date().toISOString(); save(log);
  const failed = why => { log.failed = why; save(log); return new FalError(`fal: ${why}`); };
  if (res && res.detail) throw failed(detail(res));
  const list = outputsOf(res);
  if (!list.length) throw failed(`the result has no ${kind === 'still' ? 'image' : kind === 'video' ? 'video' : 'image or video'} URL: ${JSON.stringify(res).slice(0, 400)}`);
  const known = mine && Array.isArray(mine.outputs) && mine.outputs.length === list.length ? mine.outputs : null;
  const dests = known ? filesOf(mine, logPath) : destsOf(list);
  log.outputs = list.map((m, i) => ({ url: m.url, file: relative(dirname(logPath), dests[i]), bytes: known?.[i]?.bytes ?? null, done: !!known?.[i]?.done })); save(log);
  for (const [i, m] of list.entries()) {
    const whole = log.outputs[i].done || (known && sizeOf(dests[i]) === (m.size ?? contentLength(m.url)));   // this request's log (or its size) proves it
    if (there(dests[i]) && whole && readable(dests[i])) {   // a complete paid file is never fetched again
      Object.assign(log.outputs[i], { bytes: sizeOf(dests[i]), done: true }); save(log);
      say(`have ${rel(dests[i])} (complete)`); continue;
    }
    const d = download(m, dests[i]);
    Object.assign(log.outputs[i], { bytes: d.ok ? d.bytes : sizeOf(d.part), done: d.ok }); save(log);
    if (!d.ok) die(5, `download never completed: ${m.url}\n  → ${rel(d.part)} has ${mb(d.bytes)}${d.want ? ` of ${mb(d.want)}` : ''}${d.done ? ' but ffprobe can\'t read it (delete it and fetch again)' : ''}. ` +
      `Resume it later: ${fetchCmd()}\n  (or by hand: curl -4 --http1.1 -L -C - -o ${q(rel(d.part))} ${q(m.url)}, then rename it to ${q(rel(dests[i]))})`);
  }
  for (const p of dests) say(`wrote ${describe(p)}`);
  say(`log ${rel(logPath)}`);
}
main().catch(e => {
  if (e instanceof FalError) die(4, `${e.message}${fetchHint()}`);
  if (ctx.id) die(4, `gen.mjs stopped after fal accepted request ${ctx.id}: ${e.stack || e.message}${fetchHint()}`);   // never exit 1 with a paid id
  die(1, `gen.mjs failed: ${e.stack || e.message}`);
});
