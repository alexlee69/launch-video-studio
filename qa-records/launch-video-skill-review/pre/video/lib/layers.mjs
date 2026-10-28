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
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sh } from './common.mjs';

export const STACK_DELTA = 16;     // still frames: per frame ≤ STACK_PX pixels off by more than STACK_DELTA
export const STACK_PX = 64;
export const BLUR_MIN = 1;         // a frame is motion-blurred when the camera blur is at least this many px
export const BLUR_DELTA = 64;      // motion-blurred frames: per frame ≤ BLUR_PX pixels off by more than BLUR_DELTA
export const BLUR_PX = 64;
export const STACK_LEVELS = [4, 8, 16, 32, 64];   // per-frame counts kept in the stats (noise measurements)
export const VISIBLE_A = .1;       // a layer pixel counts as visible above 10 % alpha
export const VISIBLE_PX = 4;       // … and a frame as non-empty with at least this many of them

// one ProRes layer → 16-bit RGBA frames (BT.709 limited → full-range RGB, straight alpha), streamed
async function* rawFrames(file, W, H) {
  const size = W * H * 8;
  const p = spawn('ffmpeg', ['-hide_banner', '-v', 'error', '-i', file, '-vf', 'scale=in_color_matrix=bt709:in_range=tv,format=rgba64le', '-f', 'rawvideo', 'pipe:1'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let err = ''; p.stderr.on('data', d => { err += d; });
  const closed = new Promise(r => p.on('close', code => r(code)));
  let frame = Buffer.allocUnsafe(size), off = 0;
  try {
    for await (const chunk of p.stdout) {
      for (let c = 0; c < chunk.length;) {
        const k = Math.min(size - off, chunk.length - c);
        chunk.copy(frame, off, c, c + k); off += k; c += k;
        if (off === size) { yield new Uint16Array(frame.buffer, frame.byteOffset, size / 2); frame = Buffer.allocUnsafe(size); off = 0; }
      }
    }
    const code = await closed;
    if (code !== 0) throw new Error(`decoding ${file} failed: ${err.trim()}`);
    if (off) throw new Error(`decoding ${file}: ${off} stray bytes after the last whole frame`);
  } finally { p.kill(); }
}

// a WebM twin decoded with libvpx (the native VP9 decoder drops the alpha side channel): frames read, and how many of
// them have visible alpha (> 10 %)
function webmAlpha(file) {
  const tmp = mkdtempSync(join(tmpdir(), 'lv-webm-')), f = join(tmp, 'a.txt');
  try {
    const r = sh('ffmpeg', ['-hide_banner', '-v', 'error', '-c:v', 'libvpx-vp9', '-i', file, '-vf', `alphaextract,signalstats,metadata=mode=print:key=lavfi.signalstats.YMAX:file=${f}`, '-f', 'null', '-']);
    if (r.status) return { frames: 0, visible: 0, err: r.stderr.trim().split('\n')[0] };
    const v = [...readFileSync(f, 'utf8').matchAll(/YMAX=(\d+)/g)].map(m => Number(m[1]));
    return { frames: v.length, visible: v.filter(x => x > 25).length };
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
function probe(file) {
  return (JSON.parse(sh('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,profile,width,height,pix_fmt,nb_frames,r_frame_rate', '-of', 'json', file]).stdout || '{}').streams || [])[0] || {};
}

// manifest: the delivered manifest.json (its `layers` order is what QA restacks — the same order an editor follows)
// frameInfo (optional): per frame {cam: {blur}, composited} from the flattened render (renderFrames probe)
export async function qaLayers({ dir, manifest, refAlpha, refOpaque = null, frameInfo = null, log = console.log }) {
  const { width: W, height: H, frames: n } = manifest, N = W * H;
  const results = [], stats = { layers: {}, checks: {} };   // per layer / per stack check (layer names can't collide with checks)
  const check = (name, pass, detail) => { results.push({ name, pass, detail }); log(`${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(8)} ${detail}`); };
  const finish = () => ({ passed: results.every(r => r.pass), results, stats });
  const bgL = manifest.layers.filter(l => l.name === 'background'), content = manifest.layers.filter(l => l.name !== 'background');
  // order: file names carry the stack position (NN-…; editors that stack by name follow it) — must match the manifest
  const misnamed = manifest.layers.map((l, i) => [l, String(manifest.alpha ? i + 1 : i).padStart(2, '0') + '-']).filter(([l, want]) => !String(l.file).startsWith(want));
  check('order', !misnamed.length, misnamed.length ? `file names don't match the stack order: ${misnamed.map(([l, want]) => `${l.file} should start with ${want}`).join('; ')}` : `file names number the layers back to front (${manifest.layers[0].file} … ${manifest.layers.at(-1).file})`);
  // format (and the WebM twins when there are any: VP9 with its alpha side channel, same size and rate)
  const bad = [], rate = r => { const [a, b] = String(r).split('/').map(Number); return a / (b || 1); };
  for (const l of manifest.layers) {
    const v = probe(join(dir, l.file));
    if (!(v.codec_name === 'prores' && v.width === W && v.height === H && Number(v.nb_frames) === n && /^yuva444p1[02]le$/.test(v.pix_fmt) && Math.abs(rate(v.r_frame_rate) - manifest.fps) < 1e-6))
      bad.push(`${l.file}: ${v.codec_name} ${v.width}×${v.height} ${v.pix_fmt} ${v.nb_frames}/${n} frames @ ${v.r_frame_rate} (want ${manifest.fps})`);
    if (l.webm) {
      const w = (JSON.parse(sh('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,r_frame_rate:stream_tags=alpha_mode', '-of', 'json', join(dir, l.webm)]).stdout || '{}').streams || [])[0] || {};
      const wa = webmAlpha(join(dir, l.webm));
      if (!(w.codec_name === 'vp9' && w.width === W && w.height === H && (w.tags || {}).alpha_mode === '1' && Math.abs(rate(w.r_frame_rate) - manifest.fps) < 1e-6 && wa.frames === n && wa.visible > 0))
        bad.push(`${l.webm}: ${w.codec_name} ${w.width}×${w.height} alpha_mode=${(w.tags || {}).alpha_mode} @ ${w.r_frame_rate}, ${wa.frames}/${n} frames decoded, ${wa.visible} with visible alpha${wa.err ? ` (${wa.err})` : ''}`);
    }
  }
  check('format', !bad.length, bad.length ? bad.join('; ') : `${manifest.layers.length} layers, ProRes 4444 with alpha, ${W}×${H}, ${n} frames each at ${manifest.fps} fps${manifest.layers.some(l => l.webm) ? ' (+ VP9 alpha WebM)' : ''}`);
  if (bad.length) return finish();
  // layers
  const single = manifest.elements <= 1;
  check('layers', content.length > 1 || single, content.length > 1 ? `${content.length} content layers: ${content.map(l => l.name).join(', ')}`
    : single ? `1 content layer (${content.map(l => l.name).join('')}) — the shot has a single element, nothing to separate`
      : `everything landed in one layer (${content.map(l => l.name).join('') || 'none'}) although the shot has ${manifest.elements} elements — tag them (ctx.layer / ctx.el(html, css, layer) / ctx.text(copy, {layer}))`);
  if ((manifest.alpha && bgL.length) || (!manifest.alpha && bgL.length !== 1)) check('bg', false, manifest.alpha ? 'a transparent (--alpha) export has a background layer' : `want exactly one background layer, found ${bgL.length}`);
  else if (bgL.length && manifest.layers[0].name !== 'background') check('bg', false, `the background layer must be the bottom of the stack (layers[0]); it is at position ${manifest.layers.findIndex(l => l.name === 'background')}`);
  // one lockstep pass over every layer and the references
  const files = [...content.map(l => join(dir, l.file)), ...bgL.map(l => join(dir, l.file)), refAlpha, ...(refOpaque && bgL.length ? [refOpaque] : [])];
  const its = files.map(f => rawFrames(f, W, H)[Symbol.asyncIterator]());
  const C = content.length, hasBg = bgL.length === 1 && !!refOpaque;
  const vis = content.map(() => ({ frames: 0, first: -1, last: -1, x0: W, y0: H, x1: -1, y1: -1 }));
  const histA = [], histO = [];
  let bgMinA = 65535;
  const acc = new Float32Array(N * 4), VA = VISIBLE_A * 65535;
  try {
    for (let f = 0; ; f++) {
      const rs = await Promise.all(its.map(i => i.next()));
      if (rs.every(r => r.done)) { if (f !== n) throw new Error(`decoded ${f} frames, want ${n}`); break; }
      if (rs.some(r => r.done)) throw new Error(`frame ${f}: some inputs ended early (${files.filter((_, i) => rs[i].done).join(', ')})`);
      const L = rs.map(r => r.value);
      acc.fill(0);
      for (let l = 0; l < C; l++) {
        const d = L[l], V = vis[l];
        let cnt = 0;
        for (let p = 0, x = 0, y = 0; p < N * 4; p += 4) {
          const a = d[p + 3];
          if (a !== 0) {
            const k = a / 65535, inv = 1 - k;
            acc[p] = d[p] * k + acc[p] * inv; acc[p + 1] = d[p + 1] * k + acc[p + 1] * inv; acc[p + 2] = d[p + 2] * k + acc[p + 2] * inv; acc[p + 3] = a + acc[p + 3] * inv;
            if (a > VA) { cnt++; if (x < V.x0) V.x0 = x; if (x > V.x1) V.x1 = x; if (y < V.y0) V.y0 = y; if (y > V.y1) V.y1 = y; }
          }
          if (++x === W) { x = 0; y++; }
        }
        if (cnt >= VISIBLE_PX) { V.frames++; if (V.first < 0) V.first = f; V.last = f; }
      }
      // content stack vs the flattened transparent render
      const ref = L[C + bgL.length], hA = new Uint32Array(256);
      for (let p = 0; p < N * 4; p += 4) {
        const k = ref[p + 3] / 65535;
        let e = Math.abs(acc[p + 3] - ref[p + 3]);
        e = Math.max(e, Math.abs(acc[p] - ref[p] * k), Math.abs(acc[p + 1] - ref[p + 1] * k), Math.abs(acc[p + 2] - ref[p + 2] * k));
        hA[Math.min(255, Math.floor(e / 257))]++;
      }
      histA.push(hA);
      if (hasBg) {        // background under the stack vs the flattened render on its background
        const bg = L[C], refO = L[C + 2], hO = new Uint32Array(256);
        for (let p = 0; p < N * 4; p += 4) {
          if (bg[p + 3] < bgMinA) bgMinA = bg[p + 3];
          const inv = 1 - acc[p + 3] / 65535;
          const e = Math.max(Math.abs(acc[p] + bg[p] * inv - refO[p]), Math.abs(acc[p + 1] + bg[p + 1] * inv - refO[p + 1]), Math.abs(acc[p + 2] + bg[p + 2] * inv - refO[p + 2]));
          hO[Math.min(255, Math.floor(e / 257))]++;
        }
        histO.push(hO);
      }
    }
  } catch (e) { check('stack', false, String(e.message || e)); await Promise.allSettled(its.map(i => i.return())); return finish(); }
  // nonempty
  const empty = content.filter((_, i) => !vis[i].frames).map(l => l.name);
  check('nonempty', !empty.length, empty.length ? `never visible in any frame: ${empty.join(', ')}` : `every layer is visible somewhere (${content.map((l, i) => `${l.name} ${vis[i].first}–${vis[i].last}`).join(', ')})`);
  content.forEach((l, i) => { stats.layers[l.name] = { visibleFrames: vis[i].frames, first: vis[i].first, last: vis[i].last, bbox: vis[i].x1 < 0 ? null : [vis[i].x0, vis[i].y0, vis[i].x1 + 1, vis[i].y1 + 1] }; });
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
export function stackPreview({ dir, manifest, bg, out }) {
  const ins = manifest.layers.flatMap(l => ['-i', join(dir, l.file)]);
  const { width: W, height: H, fps } = manifest, hasBg = manifest.layers[0] && manifest.layers[0].name === 'background';
  const parts = [`color=c=${bg.replace('#', '0x')}:s=${W}x${H}:r=${fps}[b0]`];
  manifest.layers.forEach((_, i) => parts.push(`[b${i}][${i}:v]overlay=shortest=1:format=auto[b${i + 1}]`));
  parts.push(`[b${manifest.layers.length}]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v]`);
  const r = sh('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...ins, '-filter_complex', parts.join(';'), '-map', '[v]', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
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
