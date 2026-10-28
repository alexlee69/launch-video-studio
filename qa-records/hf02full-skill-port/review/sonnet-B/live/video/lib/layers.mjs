// Per-element layer exports (lv.mjs --layers): QA that the delivered layer movs restack to the flattened clip, the
// After Effects import script, a stacked preview and a contact sheet of the layers.
//
// QA (every check PASS/FAIL; results also go into manifest.json):
//   order     each file's NN- prefix is its position in the manifest (back to front)
//   format    every layer is a W×H ProRes 4444 with an alpha plane, the clip's frame count and fps (+ WebM twins)
//   layers    more than one content layer, unless the shot has a single element (nothing to separate)
//   nonempty  every layer has visible pixels (alpha > 10 %) in at least one frame
//   bg        (non-alpha exports) the background layer is opaque in every pixel of every frame
//   stack     the content layers composited back to front in manifest order (premultiplied "over", 16-bit decode)
//             match the flattened transparent render of the same shot, frame by frame: per frame at most STACK_PX
//             pixels may differ by more than STACK_DELTA (8-bit code values, worst RGBA channel, premultiplied); in
//             frames where the camera's motion blur is ≥ BLUR_MIN px (whips/zooms, --with-transitions only) at most
//             BLUR_PX pixels by more than BLUR_DELTA — blurring each layer can't equal blurring the stack where layers meet
//   stack+bg  (non-alpha exports) background + content layers match the flattened render on its background, same rule
// Thresholds from measured noise on the final engine (QA run 1: 30 clean exports of every block in 16:9 / 9:16 / 1:1,
// transparent and on the background, and 24 with --with-transitions = 270 motion-blurred frames; an earlier 48-export
// campaign also covered 24 and 60 fps): still frames — worst 18 px > 16 (max 95 on 2 px), in a title whose full frame
// Chrome composites around the user's rotating SVG logo image; typically the worst pixel is 0–4. Motion-blurred frames —
// worst difference 48, none above 64. See GUIDE.md "Layers". Never loosen them to get a pass: a dropped, misordered or
// shifted layer misses by thousands of pixels (launch-videos/layers-probe/probe.mjs proves it).
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir, availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import { join } from 'node:path';

export const STACK_DELTA = 16;     // still frames: per frame ≤ STACK_PX pixels off by more than STACK_DELTA
export const STACK_PX = 64;
export const BLUR_MIN = 1;         // a frame is motion-blurred when the camera blur is at least this many px
export const BLUR_DELTA = 64;      // motion-blurred frames: per frame ≤ BLUR_PX pixels off by more than BLUR_DELTA
export const BLUR_PX = 64;
export const STACK_LEVELS = [4, 8, 16, 32, 64];   // per-frame counts kept in the stats (noise measurements)
export const VISIBLE_A = .1;       // a layer pixel counts as visible above 10 % alpha
export const VISIBLE_PX = 4;       // … and a frame as non-empty with at least this many of them
const QA_WORKERS = Math.max(1, Math.min(8, availableParallelism() - 2));   // stack-compositing threads (bands of rows)
const QA_READERS = 4;              // threads pulling decoded frames out of the decoders' pipes
const FORMAT_JOBS = 4;             // layer files probed at once (a WebM twin is decoded in full)

// a command's exit status and output, without blocking (QA probes every layer file at once)
function run(cmd, args) {
  return new Promise(res => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    p.stdout.setEncoding('utf8').on('data', d => { stdout += d; }); p.stderr.setEncoding('utf8').on('data', d => { stderr += d; });
    p.on('error', e => res({ status: -1, stdout, stderr: String(e.message || e) }));
    p.on('close', status => res({ status, stdout, stderr }));
  });
}
// fn over items, at most n at a time; results in item order
async function mapLimit(items, n, fn) {
  const out = new Array(items.length);
  let k = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (k < items.length) { const i = k++; out[i] = await fn(items[i], i); } }));
  return out;
}
// a WebM twin decoded with libvpx (the native VP9 decoder drops the alpha side channel): frames read, and how many of
// them have visible alpha (> 10 %)
async function webmAlpha(file) {
  const tmp = mkdtempSync(join(tmpdir(), 'lv-webm-')), f = join(tmp, 'a.txt');
  try {
    const r = await run('ffmpeg', ['-hide_banner', '-v', 'error', '-c:v', 'libvpx-vp9', '-i', file, '-vf', `alphaextract,signalstats,metadata=mode=print:key=lavfi.signalstats.YMAX:file=${f}`, '-f', 'null', '-']);
    if (r.status) return { frames: 0, visible: 0, err: r.stderr.trim().split('\n')[0] };
    const v = [...readFileSync(f, 'utf8').matchAll(/YMAX=(\d+)/g)].map(m => Number(m[1]));
    return { frames: v.length, visible: v.filter(x => x > 25).length };
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
async function probe(file, entries = 'stream=codec_name,profile,width,height,pix_fmt,nb_frames,r_frame_rate') {
  return (JSON.parse((await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', entries, '-of', 'json', file])).stdout || '{}').streams || [])[0] || {};
}

// manifest: the delivered manifest.json (its `layers` order is what QA restacks — the same order an editor follows)
// frameInfo (optional): per frame {cam: {blur}, composited} from the flattened render (renderFrames probe)
export async function qaLayers({ dir, manifest, refAlpha, refOpaque = null, frameInfo = null, log = console.log }) {
  const { width: W, height: H, frames: n } = manifest, N = W * H;
  const results = [], stats = { layers: {}, checks: {} };   // per layer / per stack check (layer names can't collide with checks)
  const check = (name, pass, detail) => { results.push({ name, pass, detail }); log(`${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(8)} ${detail}`); };
  const finish = () => ({ passed: results.every(r => r.pass), results, stats });
  // the background group: the brand background and, for a shot with bg footage, the footage layer over it — both are
  // left out of transparent renders, so the content stack is compared without them and stack+bg with them
  const bgL = manifest.layers.filter(l => l.name === 'background'), footL = manifest.layers.filter(l => l.name === 'footage');
  const content = manifest.layers.filter(l => l.name !== 'background' && l.name !== 'footage');
  // order: file names carry the stack position (NN-…; editors that stack by name follow it) — must match the manifest
  const misnamed = manifest.layers.map((l, i) => [l, String(manifest.alpha ? i + 1 : i).padStart(2, '0') + '-']).filter(([l, want]) => !String(l.file).startsWith(want));
  check('order', !misnamed.length, misnamed.length ? `file names don't match the stack order: ${misnamed.map(([l, want]) => `${l.file} should start with ${want}`).join('; ')}` : `file names number the layers back to front (${manifest.layers[0].file} … ${manifest.layers.at(-1).file})`);
  // format (and the WebM twins when there are any: VP9 with its alpha side channel, same size and rate)
  const rate = r => { const [a, b] = String(r).split('/').map(Number); return a / (b || 1); };
  const bad = (await mapLimit(manifest.layers, FORMAT_JOBS, async l => {
    const out = [], v = await probe(join(dir, l.file));
    if (!(v.codec_name === 'prores' && v.width === W && v.height === H && Number(v.nb_frames) === n && /^yuva444p1[02]le$/.test(v.pix_fmt) && Math.abs(rate(v.r_frame_rate) - manifest.fps) < 1e-6))
      out.push(`${l.file}: ${v.codec_name} ${v.width}×${v.height} ${v.pix_fmt} ${v.nb_frames}/${n} frames @ ${v.r_frame_rate} (want ${manifest.fps})`);
    if (l.webm) {
      const [w, wa] = await Promise.all([probe(join(dir, l.webm), 'stream=codec_name,width,height,r_frame_rate:stream_tags=alpha_mode'), webmAlpha(join(dir, l.webm))]);
      if (!(w.codec_name === 'vp9' && w.width === W && w.height === H && (w.tags || {}).alpha_mode === '1' && Math.abs(rate(w.r_frame_rate) - manifest.fps) < 1e-6 && wa.frames === n && wa.visible > 0))
        out.push(`${l.webm}: ${w.codec_name} ${w.width}×${w.height} alpha_mode=${(w.tags || {}).alpha_mode} @ ${w.r_frame_rate}, ${wa.frames}/${n} frames decoded, ${wa.visible} with visible alpha${wa.err ? ` (${wa.err})` : ''}`);
    }
    return out;
  })).flat();
  check('format', !bad.length, bad.length ? bad.join('; ') : `${manifest.layers.length} layers, ProRes 4444 with alpha, ${W}×${H}, ${n} frames each at ${manifest.fps} fps${manifest.layers.some(l => l.webm) ? ' (+ VP9 alpha WebM)' : ''}`);
  if (bad.length) return finish();
  // layers
  const single = manifest.elements <= 1;
  check('layers', content.length > 1 || single, content.length > 1 ? `${content.length} content layers: ${content.map(l => l.name).join(', ')}`
    : single ? `1 content layer (${content.map(l => l.name).join('')}) — the shot has a single element, nothing to separate`
      : `everything landed in one layer (${content.map(l => l.name).join('') || 'none'}) although the shot has ${manifest.elements} elements — tag them (ctx.layer / ctx.el(html, css, layer) / ctx.text(copy, {layer}))`);
  if ((manifest.alpha && bgL.length) || (!manifest.alpha && bgL.length !== 1)) check('bg', false, manifest.alpha ? 'a transparent (--alpha) export has a background layer' : `want exactly one background layer, found ${bgL.length}`);
  else if (bgL.length && manifest.layers[0].name !== 'background') check('bg', false, `the background layer must be the bottom of the stack (layers[0]); it is at position ${manifest.layers.findIndex(l => l.name === 'background')}`);
  else if (footL.length && (manifest.alpha || footL.length > 1 || manifest.layers[1].name !== 'footage')) check('bg', false, manifest.alpha ? 'a transparent (--alpha) export has a footage layer (bg footage is left out of --alpha)' : 'the footage layer must sit right above the background (layers[1]), once');
  // one lockstep pass over every layer and the references (layers-qa-worker.mjs): each input's decoder streams into
  // two shared buffers, read by QA_READERS workers; while they read frame f + 1, QA_WORKERS workers composite frame f,
  // one band of rows each
  const grp = bgL.length === 1 ? [...bgL, ...footL] : [];        // composited back to front under the content for stack+bg
  const files = [...content.map(l => join(dir, l.file)), ...grp.map(l => join(dir, l.file)), refAlpha, ...(refOpaque && grp.length ? [refOpaque] : [])];
  const slots = [0, 1].map(() => files.map(() => new SharedArrayBuffer(N * 8)));
  const C = content.length, nF = grp.length > 1 ? grp.length - 1 : 0, hasBg = grp.length >= 1 && !!refOpaque;
  const vis = [...content, ...grp.slice(1)].map(() => ({ frames: 0, first: -1, last: -1, x0: W, y0: H, x1: -1, y1: -1 }));
  const histA = [], histO = [];
  let bgMinA = 65535;
  const nR = Math.min(QA_READERS, files.length), nW = Math.max(1, Math.min(QA_WORKERS, H)), workers = [];
  const spawnWorker = data => {
    const t = new Worker(new URL('./layers-qa-worker.mjs', import.meta.url), { workerData: { ...data, W, H, slots } });
    let wait = null, dead = null;
    const fail = e => { dead ||= e; if (wait) { wait.rej(dead); wait = null; } };
    t.on('message', m => { const x = wait; wait = null; if (x) x.res(m); });
    t.on('error', fail);
    t.on('exit', code => fail(new Error(`a layer-QA worker stopped (exit code ${code})`)));
    const w = { t, run: msg => new Promise((res, rej) => { if (dead) return rej(dead); wait = { res, rej }; t.postMessage(msg); }) };
    workers.push(w);
    return w;
  };
  const readers = Array.from({ length: nR }, (_, r) => ({ ins: files.map((file, i) => ({ i, file })).filter(x => x.i % nR === r) })).map(r => ({ ...r, w: spawnWorker({ role: 'read', inputs: r.ins }) }));
  const stackers = Array.from({ length: nW }, (_, w) => spawnWorker({ role: 'stack', C, nBg: grp.length, hasBg, row0: Math.floor(H * w / nW), row1: Math.floor(H * (w + 1) / nW), VA: VISIBLE_A * 65535 }));
  // every input's next frame into buffer `slot` → per input: ended (no frame left)?
  const read = async slot => {
    const done = new Array(files.length);
    for (const [r, m] of (await Promise.all(readers.map(r => r.w.run(slot)))).entries()) {
      if (m.err) throw new Error(m.err);
      readers[r].ins.forEach(({ i }, k) => { done[i] = m.done[k]; });
    }
    return done;
  };
  const next = slot => { const p = read(slot); p.catch(() => {}); return p; };   // awaited one frame later
  try {
    let pending = next(0);
    for (let f = 0; ; f++) {
      const done = await pending;
      if (done.every(Boolean)) { if (f !== n) throw new Error(`decoded ${f} frames, want ${n}`); break; }
      if (done.some(Boolean)) throw new Error(`frame ${f}: some inputs ended early (${files.filter((_, i) => done[i]).join(', ')})`);
      const parts = Promise.all(stackers.map(w => w.run(f % 2)));
      pending = next((f + 1) % 2);
      const P = await parts;
      for (let l = 0; l < C + nF; l++) {           // content layers, then the footage layer (visibility stats only)
        const V = vis[l];
        let cnt = 0;
        for (const { cnt: c, box: b } of P) {
          cnt += c[l];
          if (b[l * 4] < V.x0) V.x0 = b[l * 4]; if (b[l * 4 + 1] < V.y0) V.y0 = b[l * 4 + 1]; if (b[l * 4 + 2] > V.x1) V.x1 = b[l * 4 + 2]; if (b[l * 4 + 3] > V.y1) V.y1 = b[l * 4 + 3];
        }
        if (cnt >= VISIBLE_PX) { V.frames++; if (V.first < 0) V.first = f; V.last = f; }
      }
      const hA = new Uint32Array(256), hO = hasBg ? new Uint32Array(256) : null;
      for (const r of P) {
        for (let e = 0; e < 256; e++) hA[e] += r.hA[e];
        if (hO) { for (let e = 0; e < 256; e++) hO[e] += r.hO[e]; if (r.bgMin < bgMinA) bgMinA = r.bgMin; }
      }
      histA.push(hA);
      if (hO) histO.push(hO);
    }
  } catch (e) { check('stack', false, String(e.message || e)); return finish(); }
  finally {      // readers stop their decoders first (a terminated worker would leave ffmpeg blocked on its pipe)
    await Promise.allSettled(readers.map(r => r.w.run('close')));
    await Promise.allSettled(workers.map(w => { w.t.removeAllListeners('exit'); return w.t.terminate(); }));
  }
  // nonempty
  const seen = [...content, ...grp.slice(1)];
  const empty = seen.filter((_, i) => !vis[i].frames).map(l => l.name);
  check('nonempty', !empty.length, empty.length ? `never visible in any frame: ${empty.join(', ')}` : `every layer is visible somewhere (${seen.map((l, i) => `${l.name} ${vis[i].first}–${vis[i].last}`).join(', ')})`);
  seen.forEach((l, i) => { stats.layers[l.name] = { visibleFrames: vis[i].frames, first: vis[i].first, last: vis[i].last, bbox: vis[i].x1 < 0 ? null : [vis[i].x0, vis[i].y0, vis[i].x1 + 1, vis[i].y1 + 1] }; });
  if (hasBg && results.every(r => r.name !== 'bg')) check('bg', bgMinA >= 65535 * .995, `background layer ${bgMinA >= 65535 * .995 ? 'is opaque in every pixel' : `has transparent pixels (min alpha ${(bgMinA / 655.35).toFixed(1)} %)`}`);
  const blurOf = f => (frameInfo && frameInfo[f] && frameInfo[f].cam && frameInfo[f].cam.blur) || 0;
  const compOf = f => (frameInfo && frameInfo[f] && frameInfo[f].composited) || 0;
  const passesOf = f => (frameInfo && frameInfo[f] && frameInfo[f].passes) || [];
  const judge = (name, hists, what) => {
    const over = (h, d) => { let c = 0; for (let e = d + 1; e < 256; e++) c += h[e]; return c; };
    const maxE = h => { for (let e = 255; e >= 0; e--) if (h[e]) return e; return 0; };
    const per = hists.map((h, f) => {
      const blur = blurOf(f), moving = blur >= BLUR_MIN, d = moving ? BLUR_DELTA : STACK_DELTA;
      return { f, d, lim: moving ? BLUR_PX : STACK_PX, moving, over: over(h, d), max: maxE(h), blur, comp: compOf(f), at: STACK_LEVELS.map(x => over(h, x)) };
    });
    const worstOf = list => list.reduce((a, b) => !a || b.over / b.lim > a.over / a.lim || (b.over === a.over && b.max > a.max) ? b : a, null);
    const worst = worstOf(per), badF = per.filter(x => x.over > x.lim), nMoving = per.filter(x => x.moving).length;
    stats.checks[name] = { worstFrame: worst.f, worstOver: worst.over, worstMax: worst.max, maxAll: Math.max(...per.map(x => x.max)), levels: STACK_LEVELS,
      frames: per.map(x => [x.over, x.max, x.blur, x.comp, ...x.at]), hist: hists.reduce((a, h) => { for (let e = 0; e < 256; e++) a[e] += h[e]; return a; }, new Array(256).fill(0)) };
    const comp = badF.filter(x => x.comp > 1);
    check(name, !badF.length, badF.length ? `${badF.length}/${hists.length} frames off ${what}: ${badF.slice(0, 6).map(x => `f${x.f} ${x.over} px > ${x.d}${x.moving ? ' (motion-blurred)' : ''} (max ${x.max})`).join(', ')}${badF.length > 6 ? ' …' : ''}`
      + (comp.length ? ` — Chrome composited part of the frame on its own in ${comp.length} of them (f${comp.slice(0, 4).map(x => x.f).join(', f')}${[...new Set(comp.flatMap(x => passesOf(x.f)))].length ? `; passes: ${[...new Set(comp.flatMap(x => passesOf(x.f)))].join(', ')}` : ''}): see GUIDE.md "Layers" → when the stack check fails` : '')
      : `restacks to ${what} in all ${hists.length} frames (worst f${worst.f}: ${worst.over} px > ${worst.d}, max diff ${worst.max}; limit ${worst.lim} px${nMoving ? `; ${nMoving} motion-blurred frames checked at > ${BLUR_DELTA}` : ''})`);
  };
  judge('stack', histA, 'the flattened transparent clip');
  if (hasBg) judge('stack+bg', histO, 'the flattened clip on its background');
  return finish();
}

// ── After Effects ──
// Ramer–Douglas–Peucker on a per-frame series: the fewest keyframes whose linear interpolation stays within tol
export function simplify(vals, tol) {
  const n = vals.length, keep = new Uint8Array(n);
  if (!n) return [];
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let worst = -1, at = -1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(vals[i] - (vals[a] + (vals[b] - vals[a]) * (i - a) / (b - a))); if (d > worst) { worst = d; at = i; } }
    if (worst > tol) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  const ks = []; for (let i = 0; i < n; i++) if (keep[i]) ks.push([i, +vals[i].toFixed(4)]);
  return ks.length === 2 && ks[0][1] === ks[1][1] ? [ks[0]] : ks;        // a constant → one value, no keyframes
}
const STYLE_NAME = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };
const rgb01 = css => { const m = String(css).match(/[\d.]+/g) || [0, 0, 0]; return m.slice(0, 3).map(v => +(Number(v) / 255).toFixed(4)); };
const hex01 = hex => [1, 3, 5].map(i => +(parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(4));

// per-frame word samples (renderFrames probe) → live-text data for every text layer whose words stay put (same words in
// every frame); keys simplified to within 0.2 px / 0.05 % scale / 0.4 % opacity of the engine's motion
export function liveText(probes, layers) {
  const out = {}, skipped = {};
  for (const name of layers) {
    const fr = probes.map(p => (p && p.text && p.text[name]) || []), words = fr[0];
    if (!words.length || fr.some(w => w.length !== words.length || w.some((x, i) => x.style.text !== words[i].style.text))) { skipped[name] = 'its words change during the shot'; continue; }
    out[name] = words.map((w, i) => ({ w, i })).filter(({ w }) => w.style.text.trim()).map(({ w, i }) => ({
      t: w.style.text, size: +w.style.size.toFixed(2), tracking: w.style.tracking, fill: rgb01(w.style.color),
      font: `${w.style.family.replace(/\s+/g, '')}-${STYLE_NAME[w.style.weight] || 'Regular'}`,
      x: simplify(fr.map(f => f[i].x), .2), y: simplify(fr.map(f => f[i].y), .2), s: simplify(fr.map(f => f[i].s * 100), .05), o: simplify(fr.map(f => f[i].o * 100), .4),
    }));
  }
  return { text: out, skipped };
}

// ExtendScript (ES3: no let/const/arrows/JSON) — data as an object literal, files resolved next to the script. The file
// is pure ASCII (non-ASCII copy as \uXXXX escapes, comments transliterated): ExtendScript may read a UTF-8 file without
// a BOM in the system encoding.
const ascii = s => String(s).replace(/[—–]/g, '-').replace(/[·•]/g, '|').replace(/×/g, 'x').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/[^\x20-\x7e\n]/g, '?');
const jsLiteral = v => JSON.stringify(v).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
// blurred: the shot has camera motion blur (≥ 1 px, --with-transitions) that the live text can't reproduce — the live
// text is then added switched off and the baked (blurred) text stays on
export function writeJsx({ path, manifest, bg, text, blurred = false }) {
  const M = { name: `${manifest.slug} ${manifest.shot} ${manifest.aspect}`, width: manifest.width, height: manifest.height, fps: manifest.fps, frames: manifest.frames,
    bg: hex01(bg), layers: manifest.layers.map(l => ({ name: l.name, file: l.file })), sfx: manifest.sfx || null, text, blurred };
  const js = ascii(`// ${String(manifest.title).replace(/\s+/g, ' ').replace(/__DATA__/g, '')} · shot ${manifest.shot} (${manifest.block}) · ${manifest.aspect} — layer stack for After Effects.
// Made by product-launch-sting (lv.mjs --layers). Run it with File > Scripts > Run Script File… and keep it in the folder
// with the layer .mov files. It builds the comp "${M.name}" (${M.width}×${M.height}, ${M.fps} fps, ${M.frames} frames)
// with every layer back to front as in manifest.json (alpha interpreted as straight), the shot's UI sounds, and — for
// the text layers — a live-text precomp (one text layer per word, keyed like the engine's reveal) above the baked
// text layer, which stays in the comp switched off${blurred ? ` — except here: this export has camera motion blur that live text
// can't reproduce, so the baked text stays on and the live-text precomps are added switched off (turn them on to edit)` : ''}. Live text
// needs the fonts installed (e.g. Inter); a missing font is reported at the end and After Effects substitutes one.
(function () {
  var M = __DATA__;
  var here = File($.fileName).parent;
  function need(name) {
    var f = new File(here.fsName + '/' + name);
    if (!f.exists) throw new Error('Missing ' + f.fsName + ' (keep this script next to the layer files)');
    return f;
  }
  function keyed(prop, ks, pair) {
    var i, t = [], v = [];
    if (ks.length === 1) { prop.setValue(pair ? [ks[0][1], ks[0][1]] : ks[0][1]); return; }
    for (i = 0; i < ks.length; i++) { t.push(ks[i][0] / M.fps); v.push(pair ? [ks[i][1], ks[i][1]] : ks[i][1]); }
    prop.setValuesAtTimes(t, v);
    for (i = 1; i <= prop.numKeys; i++) prop.setInterpolationTypeAtKey(i, KeyframeInterpolationType.LINEAR);
  }
  app.beginUndoGroup('Import ' + M.name);
  try {
    var folder = app.project.items.addFolder(M.name);
    var comp = app.project.items.addComp(M.name, M.width, M.height, 1, M.frames / M.fps, M.fps);
    comp.parentFolder = folder;
    comp.bgColor = M.bg;
    var placed = {}, i, k;
    for (i = 0; i < M.layers.length; i++) {          // back to front: each new layer lands on top
      var item = app.project.importFile(new ImportOptions(need(M.layers[i].file)));
      item.parentFolder = folder;
      if (item.mainSource.hasAlpha) item.mainSource.alphaMode = AlphaMode.STRAIGHT;   // ffmpeg's ProRes 4444 alpha is straight
      item.mainSource.conformFrameRate = M.fps;
      var lay = comp.layers.add(item);
      lay.name = M.layers[i].name;
      lay.startTime = 0;
      placed[M.layers[i].name] = lay;
    }
    if (M.sfx) {
      var snd = app.project.importFile(new ImportOptions(need(M.sfx)));
      snd.parentFolder = folder;
      var sl = comp.layers.add(snd);
      sl.name = 'UI sounds';
      sl.moveToEnd();
    }
    var missing = [], live = 0;
    for (var name in M.text) {
      if (!M.text.hasOwnProperty(name) || !placed.hasOwnProperty(name)) continue;
      var words = M.text[name];
      var pc = app.project.items.addComp(M.name + ' ' + name + ' (live text)', M.width, M.height, 1, M.frames / M.fps, M.fps);
      pc.parentFolder = folder;
      for (k = 0; k < words.length; k++) {
        var w = words[k], tl = pc.layers.addText(w.t);
        var src = tl.property('ADBE Text Properties').property('ADBE Text Document'), td = src.value;
        try { td.resetCharStyle(); } catch (re) {}
        td.fontSize = w.size;
        td.applyFill = true;
        td.fillColor = w.fill;
        td.applyStroke = false;
        td.tracking = w.tracking;
        td.justification = ParagraphJustification.LEFT_JUSTIFY;
        try { td.font = w.font; } catch (fe) {}
        td.text = w.t;
        src.setValue(td);
        if (src.value.font !== w.font) { var seen = false; for (i = 0; i < missing.length; i++) if (missing[i] === w.font) seen = true; if (!seen) missing.push(w.font); }
        tl.name = w.t;
        var tr = tl.property('ADBE Transform Group');
        tr.property('ADBE Anchor Point').setValue([0, 0]);           // point text: the origin is the baseline start
        tr.property('ADBE Position').dimensionsSeparated = true;
        keyed(tr.property('ADBE Position_0'), w.x, false);
        keyed(tr.property('ADBE Position_1'), w.y, false);
        keyed(tr.property('ADBE Scale'), w.s, true);
        keyed(tr.property('ADBE Opacity'), w.o, false);
      }
      var pl = comp.layers.add(pc);
      pl.name = name + ' (live text)';
      pl.moveBefore(placed[name]);
      placed[name].name = name + ' (baked)';
      if (M.blurred) pl.enabled = false; else placed[name].enabled = false;
      live++;
    }
    try { comp.openInViewer(); } catch (ve) {}
    if (missing.length) alert('Live text: install ' + missing.join(', ') + ' to match the render (After Effects substituted a font).');
  } catch (err) {
    alert('Layer import stopped: ' + err.toString());
  }
  app.endUndoGroup();
})();
`).replace('__DATA__', () => jsLiteral(M));
  writeFileSync(path, js);
  return M;
}

// the layers restacked over the brand background (or over their own background layer) as an H.264 preview
export async function stackPreview({ dir, manifest, bg, out }) {
  const ins = manifest.layers.flatMap(l => ['-threads', '1', '-i', join(dir, l.file)]);   // one thread per layer decoder: 1.7 GB instead of 3.8 for 7 layers, same bytes
  const { width: W, height: H, fps } = manifest, hasBg = manifest.layers[0] && manifest.layers[0].name === 'background';
  const parts = [`color=c=${bg.replace('#', '0x')}:s=${W}x${H}:r=${fps}[b0]`];
  manifest.layers.forEach((_, i) => parts.push(`[b${i}][${i}:v]overlay=shortest=1:format=auto[b${i + 1}]`));
  parts.push(`[b${manifest.layers.length}]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v]`);
  const r = await run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...ins, '-filter_complex', parts.join(';'), '-map', '[v]', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  if (r.status !== 0) throw new Error(`stack preview failed:\n${r.stderr}`);
  return hasBg;
}

// contact sheet for a quick look (phone-friendly): the finished frame, then every layer alone on a checkerboard, at the
// shot's hero frame; frames are read from the work folder through the job server
export async function layerSheet({ job, browser, serverBase, manifest, tiles, bg, out }) {
  const { width: W, height: H } = manifest, cols = W > H ? 3 : 5, tw = W > H ? 560 : 300, th = Math.round(tw * H / W);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const url = p => '/job/' + p.slice(job.length + 1).split(/[\\/]/).map(encodeURIComponent).join('/');
  const cards = tiles.map(t => `<div class="c"><div class="im" style="${t.checker ? '' : `background:${bg}`}"><img src="${url(t.png)}"></div><div class="l"><b>${esc(t.tag)}</b> ${esc(t.label)}</div></div>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:Inter;font-weight:400;src:url(/skill/node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2)}
    @font-face{font-family:Inter;font-weight:700;src:url(/skill/node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2)}
    body{margin:0;background:#F4F4F6;font-family:Inter,sans-serif;color:#111114;width:${cols * tw + (cols - 1) * 20 + 60}px}
    h1{margin:0;padding:28px 30px 4px;font-size:30px;letter-spacing:-.02em}p{margin:0;padding:0 30px 16px;color:#6B6B75;font-size:17px}
    .g{display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:20px;padding:0 30px 30px}
    .c{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 0 rgba(0,0,0,.05),0 6px 18px rgba(20,24,40,.06)}
    .im{width:${tw}px;height:${th}px;background:repeating-conic-gradient(#D9DBE1 0 25%,#FFFFFF 0 50%) 0 0/24px 24px}
    .im img{display:block;width:100%;height:100%}.l{padding:10px 12px;font-size:16px}
  </style></head><body><h1>${esc(manifest.title)} · ${esc(manifest.shot)} layers</h1>
  <p>${esc(manifest.aspect.replace('x', ':'))} · ${manifest.fps} fps · ${manifest.frames} frames · back to front · frame ${tiles[0].frame} · checkerboard = transparent</p>
  <div class="g">${cards}</div></body></html>`;
  const htmlPath = out.replace(/\.png$/, '.html');
  writeFileSync(htmlPath, html);
  const ctx = await browser.newContext({ viewport: { width: cols * tw + (cols - 1) * 20 + 60, height: 600 }, deviceScaleFactor: 1 });
  try {
    const page = await ctx.newPage();
    await page.goto(serverBase + url(htmlPath));
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => null))));
    await page.screenshot({ path: out, fullPage: true });
  } finally { await ctx.close(); }
}
