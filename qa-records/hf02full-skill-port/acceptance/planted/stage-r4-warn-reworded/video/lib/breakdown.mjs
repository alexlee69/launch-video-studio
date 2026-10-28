#!/usr/bin/env node
// Reference breakdown: a reel the user saved (this tool never downloads anything) → its anatomy, for "ours, but like
// this": every shot with timecodes and thumbnails, pacing stats, tempo and whether the cuts land on the beat, contact
// sheets Claude reads as images, and a draft beats.yaml timing skeleton. Pacing and structure only — never the
// reference's footage, audio or copy.
//
//   node lib/breakdown.mjs <video> --out <dir> [--threshold 0.3] [--min-shot 0.2] [--per-page 8]
//   node lib/breakdown.mjs --tempo <audio-or-video>            bpm / first downbeat / confidence + a music: snippet
//
// <dir> gets breakdown.json, breakdown.md, breakdown.html, sheet-NN.png, overview.png, thumbs/ and beats-draft.yaml
// (re-running replaces exactly these; nothing else in <dir> is touched, and a folder holding a beats.yaml is refused).
//
// Shot detection works on every decoded frame at its own pts (VFR-safe): ffmpeg's scene score per frame, plus a
// 128-px luma copy of every frame for a motion-compensated difference (global shift search), so a camera move or a
// whip's blur isn't a cut but the content switch inside it is. A cut is a frame whose compensated difference stands
// out from the local median (×2 when the scene score passes --threshold, ×3 below it — those also need a frame-wide
// change, or a big change inside a moving/blurred transition). Spikes ≤ 0.1 s apart are one event: content that
// comes back afterwards is a flash, not a cut. Cross-dissolves / fades are found by a blend test (the middle frame is a
// mix of the two ends), slow pushes and zooms fail it. Audio: spectral-flux onsets (own radix-2 FFT) → autocorrelation
// tempo with a 120 BPM prior → comb/phase search for the beat grid → cut-to-beat alignment.
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync, mkdtempSync, copyFileSync, realpathSync } from 'node:fs';
import { join, resolve, basename, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sh, slugify, UserError } from './common.mjs';

const AN = 128;              // analysis frame: long side (px), luma
const SCENE_SIDE = 320;      // ffmpeg scene score computed on this size (yuv420p)
const ASR = 11025;           // audio analysis sample rate
const MC_FLOOR = 0.012;      // a spike must change ≥ ~3 luma levels on average after motion compensation
const MED_FLOOR = 0.003;
const RET = 0.35;            // content "returned" after a spike run (flash) when before↔after differ < 35 % of the spike
const EXT_MIN = 0.06, EXT_BIG = 0.35, EXT_T = 12;   // block-change extent (fraction of 8×8 blocks changing > 12 levels)
const NCC_CUT = 0.45;        // before↔after structural correlation at or below which a sub-threshold change is a cut
const NCC_MOVE = 0.75;       // a moving (whip / zoom / blur) change still has to decorrelate this far
const SHARP_MIN = 3;         // mean |gradient| (levels, 128-px frame) a shot needs before a blur dip in it counts
const DEBUG = !!process.env.BD_DEBUG;
const dbg = (...a) => { if (DEBUG) console.error('[bd]', ...a); };

// ─────────────────────────────── helpers ───────────────────────────────
const even = x => Math.max(2, Math.round(x / 2) * 2);
const pad2 = x => String(x).padStart(2, '0');
const r3 = x => Math.round(x * 1000) / 1000;
const r4 = x => Math.round(x * 10000) / 10000;
const median = a => { if (!a.length) return NaN; const s = Float64Array.from(a).sort(); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// MM:SS:FF at the source's frame rate (HH: past an hour)
export function timecode(t, fr) {
  const F = Math.max(0, Math.round(t * fr)), s = Math.floor(F / fr), h = Math.floor(s / 3600);
  return `${h ? pad2(h) + ':' : ''}${pad2(Math.floor(s / 60) % 60)}:${pad2(s % 60)}:${pad2(F % fr)}`;
}
function run(cmd, args) {                       // async, arg array (never a shell string), stdout as one Buffer
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const out = []; let len = 0, err = '';
    p.stdout.on('data', d => { out.push(d); len += d.length; });
    p.stderr.on('data', d => { if (err.length < 1 << 20) err += d; });
    p.on('error', e => rej(e.code === 'ENOENT' ? new UserError(`${cmd} not found — install ffmpeg (it includes ffprobe)`) : e));
    p.on('close', code => res({ code, stdout: Buffer.concat(out, len), stderr: err }));
  });
}
// ffmpeg filter-option paths: only our own temp files go into filter strings, and only when their path is plain
const plainPath = p => /^[\w/.\-]+$/.test(p);
function makeTmp() {
  for (const base of [tmpdir(), '/tmp']) { const d = mkdtempSync(join(base, 'lv-breakdown-')); if (plainPath(d)) return d; rmSync(d, { recursive: true, force: true }); }
  throw new Error('no temp folder with a plain path (letters, digits, / . _ -) for ffmpeg filter files');
}

// ─────────────────────────────── probe ───────────────────────────────
export function probeMedia(file) {
  if (!existsSync(file)) throw new UserError(`file not found: ${file}`);
  if (statSync(file).isDirectory()) throw new UserError(`${file} is a folder — pass the video file itself`);
  const r = sh('ffprobe', ['-v', 'error', '-show_entries',
    'format=duration,start_time,format_name:stream=index,codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,duration,start_time,sample_aspect_ratio,sample_rate,channels:stream_disposition=attached_pic:stream_tags=rotate:stream_side_data=rotation',
    '-of', 'json', file]);
  if (r.error && r.error.code === 'ENOENT') throw new UserError('ffprobe not found — install ffmpeg (it includes ffprobe)');
  if (r.status !== 0) throw new UserError(`can't read ${basename(file)} as a video or audio file (ffprobe: ${String(r.stderr || '').trim().split('\n').pop()})`);
  let j; try { j = JSON.parse(r.stdout); } catch { throw new UserError(`can't read ${basename(file)}: ffprobe gave no stream info`); }
  const num = x => (x == null || x === '' || x === 'N/A' || !Number.isFinite(Number(x))) ? null : Number(x);
  const rate = x => { const [p, q] = String(x || '').split('/').map(Number); const v = q ? p / q : p; return Number.isFinite(v) && v > 0 ? v : null; };
  const streams = j.streams || [];
  const v = streams.find(s => s.codec_type === 'video' && !(s.disposition && s.disposition.attached_pic));
  const a = streams.find(s => s.codec_type === 'audio');
  const fmtStart = num(j.format && j.format.start_time) ?? 0;
  let video = null;
  if (v && v.width && v.height) {
    let rot = 0;
    for (const sd of v.side_data_list || []) if (sd.rotation != null) rot = Number(sd.rotation) || 0;
    if (!rot && v.tags && v.tags.rotate) rot = Number(v.tags.rotate) || 0;
    rot = ((Math.round(rot / 90) * 90) % 360 + 360) % 360;
    let W = v.width, H = v.height;
    const sar = String(v.sample_aspect_ratio || '1:1').split(':').map(Number);
    if (sar[0] > 0 && sar[1] > 0 && sar[0] !== sar[1]) W = Math.round(W * sar[0] / sar[1]);
    if (rot % 180) [W, H] = [H, W];
    video = { index: v.index, codec: v.codec_name, codedW: v.width, codedH: v.height, W, H, rotation: rot, rFps: rate(v.r_frame_rate), avgFps: rate(v.avg_frame_rate), start: num(v.start_time) ?? fmtStart };
  }
  const audio = a ? { index: a.index, codec: a.codec_name, sampleRate: num(a.sample_rate), channels: a.channels, start: num(a.start_time) ?? fmtStart } : null;
  const duration = num(j.format && j.format.duration) ?? num(v && v.duration) ?? num(a && a.duration);
  return { file, size: statSync(file).size, format: j.format && j.format.format_name, duration, fmtStart, video, audio };
}
export function aspectClass(W, H) {             // nearest of the skill's aspects on a log scale
  const r = W / H, c = [['16x9', 16 / 9], ['1x1', 1], ['9x16', 9 / 16]];
  return c.reduce((b, x) => Math.abs(Math.log(r / x[1])) < Math.abs(Math.log(r / b[1])) ? x : b)[0];
}

// ─────────────────────────────── video analysis ───────────────────────────────
async function decodeVideo(P, tmp) {
  const { W, H } = P.video;
  const fit = L => { const s = L / Math.max(W, H); return [even(W * s), even(H * s)]; };
  const [AW, AH] = fit(AN), [SW, SH] = fit(SCENE_SIDE);
  const scoreFile = join(tmp, 'scene.txt');
  const vf = `scale=${SW}:${SH}:flags=area,format=yuv420p,select=gte(scene\\,0),metadata=print:file=${scoreFile},scale=${AW}:${AH}:flags=area,format=gray`;
  const r = await run('ffmpeg', ['-hide_banner', '-v', 'error', '-nostdin', '-i', P.file, '-map', `0:${P.video.index}`, '-an', '-sn', '-dn',
    '-vf', vf, '-fps_mode', 'passthrough', '-f', 'rawvideo', 'pipe:1']);
  if (r.code !== 0) throw new UserError(`ffmpeg could not decode the video of ${basename(P.file)}:\n${r.stderr.trim()}`);
  const px = AW * AH, nRaw = Math.floor(r.stdout.length / px);
  const pts = [], scene = [];
  for (const line of (existsSync(scoreFile) ? readFileSync(scoreFile, 'utf8') : '').split('\n')) {
    const m = line.match(/pts_time:\s*(\S+)/);
    if (m) { pts.push(parseFloat(m[1])); scene.push(0); continue; }
    const s = line.match(/lavfi\.scene_score=([-\d.eE+]+)/);
    if (s && scene.length) scene[scene.length - 1] = Number(s[1]);
  }
  const n = Math.min(nRaw, pts.length);
  if (!n) throw new UserError(`${basename(P.file)}: no video frames could be decoded`);
  // missing pts (rare): interpolate from neighbours at the nominal rate
  const fr0 = P.video.rFps || P.video.avgFps || 30;
  for (let k = 0; k < n; k++) if (!Number.isFinite(pts[k])) pts[k] = k ? pts[k - 1] + 1 / fr0 : 0;
  const t0 = pts[0], t = Float64Array.from(pts.slice(0, n), x => x - t0);
  return { G: r.stdout.subarray(0, n * px), n, AW, AH, t, pts0: t0, scene: Float32Array.from(scene.slice(0, n)) };
}

// per-frame stats + per-pair (k-1 → k) motion-compensated differences
function analyzeFrames(V) {
  const { G, n, AW, AH } = V, px = AW * AH, HW = AW >> 1, HH = AH >> 1, hpx = HW * HH;
  const half = new Uint8Array(n * hpx), mean_ = new Float32Array(n), std = new Float32Array(n), sharp = new Float32Array(n), hist = new Float32Array(n * 16);
  const col = new Float32Array(n * AW), row = new Float32Array(n * AH);
  for (let k = 0; k < n; k++) {
    const f = G.subarray(k * px, (k + 1) * px);
    let s = 0, s2 = 0, g = 0;
    const c = col.subarray(k * AW, (k + 1) * AW), rw = row.subarray(k * AH, (k + 1) * AH);
    for (let y = 0; y < AH; y++) {
      let rs = 0;
      for (let x = 0; x < AW; x++) {
        const i = y * AW + x, v = f[i];
        s += v; s2 += v * v; rs += v; c[x] += v; hist[k * 16 + (v >> 4)]++;
        if (x + 1 < AW) g += Math.abs(f[i + 1] - v);
        if (y + 1 < AH) g += Math.abs(f[i + AW] - v);
      }
      rw[y] = rs / AW;
    }
    for (let x = 0; x < AW; x++) c[x] /= AH;
    mean_[k] = s / px; std[k] = Math.sqrt(Math.max(0, s2 / px - mean_[k] ** 2)); sharp[k] = g / px;
    for (let q = 0; q < 16; q++) hist[k * 16 + q] /= px;
    const h = half.subarray(k * hpx, (k + 1) * hpx);
    for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) { const i = 2 * y * AW + 2 * x; h[y * HW + x] = (f[i] + f[i + 1] + f[i + AW] + f[i + AW + 1] + 2) >> 2; }
  }
  const frame = k => G.subarray(k * px, (k + 1) * px), halfF = k => half.subarray(k * hpx, (k + 1) * hpx);
  // mean |b(x,y) − a(x−dx, y−dy)| over the overlap (b = a moved by dx,dy)
  function sad(a, b, w, h, dx, dy) {
    const x0 = Math.max(0, dx), x1 = Math.min(w, w + dx), y0 = Math.max(0, dy), y1 = Math.min(h, h + dy);
    let s = 0, c = 0;
    for (let y = y0; y < y1; y++) { const rb = y * w, ra = (y - dy) * w - dx; for (let x = x0; x < x1; x++) { const d = b[rb + x] - a[ra + x]; s += d < 0 ? -d : d; } c += x1 - x0; }
    return c > 0 ? s / c : Infinity;
  }
  // 1-D shift of the column / row profiles, up to 35 % of the frame (whips move fast)
  function shift1(p, q, L) {
    const R = Math.round(L * .35);
    let best = Infinity, bd = 0;
    for (let d = -R; d <= R; d++) {
      let s = 0, c = 0;
      for (let x = Math.max(0, d); x < Math.min(L, L + d); x++) { s += Math.abs(q[x] - p[x - d]); c++; }
      const v = s / c + .002 * Math.abs(d);          // ties go to the smaller move
      if (v < best) { best = v; bd = d; }
    }
    return bd;
  }
  const proj = (i, j) => [shift1(col.subarray(i * AW, (i + 1) * AW), col.subarray(j * AW, (j + 1) * AW), AW), shift1(row.subarray(i * AH, (i + 1) * AH), row.subarray(j * AH, (j + 1) * AH), AH)];
  // motion-compensated difference between frames i and j. The same central window of j (inner 70 %) is always compared,
  // against i shifted by up to 15 % of the frame — so a big shift never wins by comparing a sliver of plain background.
  // Full search at half size, refined ±1 px at full size; ext = share of 8×8 blocks in the window still changing > EXT_T.
  const MX = Math.ceil(AW * .15), MY = Math.ceil(AH * .15), hMX = Math.ceil(HW * .15), hMY = Math.ceil(HH * .15);
  function sadC(a, b, w, h, mx, my, dx, dy) {
    if (Math.abs(dx) > mx || Math.abs(dy) > my) return Infinity;
    let s = 0;
    for (let y = my; y < h - my; y++) { const rb = y * w, ra = (y - dy) * w - dx; for (let x = mx; x < w - mx; x++) { const d = b[rb + x] - a[ra + x]; s += d < 0 ? -d : d; } }
    return s / ((w - 2 * mx) * (h - 2 * my));
  }
  // structural similarity of the central window after the shift: ~1 when most of the picture stays (an overlay, a UI
  // build, a move inside the shot), low after a real cut (contrast-invariant, so dark shots count too)
  function ncc(a, b, dx, dy) {
    let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, c = 0;
    for (let y = MY; y < AH - MY; y++) for (let x = MX; x < AW - MX; x++) {
      const u = a[(y - dy) * AW + x - dx], v = b[y * AW + x];
      sa += u; sb += v; saa += u * u; sbb += v * v; sab += u * v; c++;
    }
    const va = saa - sa * sa / c, vb = sbb - sb * sb / c;
    return va > 1e-6 * c && vb > 1e-6 * c ? (sab - sa * sb / c) / Math.sqrt(va * vb) : (Math.abs(sa - sb) / c < 8 ? 1 : 0);
  }
  // the same on gradient magnitude (edges): stays high under a light change or a fading overlay, low after a real switch
  function gncc(a, b, dx, dy) {
    let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, c = 0;
    for (let y = MY; y < AH - MY - 1; y++) for (let x = MX; x < AW - MX - 1; x++) {
      const ia = (y - dy) * AW + x - dx, ib = y * AW + x;
      const u = Math.abs(a[ia + 1] - a[ia]) + Math.abs(a[ia + AW] - a[ia]), v = Math.abs(b[ib + 1] - b[ib]) + Math.abs(b[ib + AW] - b[ib]);
      sa += u; sb += v; saa += u * u; sbb += v * v; sab += u * v; c++;
    }
    const va = saa - sa * sa / c, vb = sbb - sb * sb / c;
    return va > 1e-6 * c && vb > 1e-6 * c ? (sab - sa * sb / c) / Math.sqrt(va * vb) : 0;
  }
  function align(i, j, withExt = true) {
    const a = frame(i), b = frame(j), ah = halfF(i), bh = halfF(j);
    const s0h = sadC(ah, bh, HW, HH, hMX, hMY, 0, 0);
    let hb = { s: s0h, dx: 0, dy: 0 };
    for (let dy = -hMY; dy <= hMY; dy++) for (let dx = -hMX; dx <= hMX; dx++) {
      if (!dx && !dy) continue;
      const v = sadC(ah, bh, HW, HH, hMX, hMY, dx, dy) * (1 + .004 * (Math.abs(dx) + Math.abs(dy)));   // ties → smaller moves
      if (v < hb.s * .98) hb = { s: v, dx, dy };
    }
    const s0 = sadC(a, b, AW, AH, MX, MY, 0, 0);
    let fb = { s: s0, dx: 0, dy: 0 };
    for (let dy = 2 * hb.dy - 1; dy <= 2 * hb.dy + 1; dy++) for (let dx = 2 * hb.dx - 1; dx <= 2 * hb.dx + 1; dx++) {
      if (!dx && !dy) continue;
      const v = sadC(a, b, AW, AH, MX, MY, dx, dy); if (v < fb.s * .98) fb = { s: v, dx, dy };
    }
    let ext = 0;
    if (withExt) {
      const { dx, dy } = fb; let c = 0, tot = 0;
      for (let by = MY; by + 8 <= AH - MY; by += 8) for (let bx = MX; bx + 8 <= AW - MX; bx += 8) {
        let s = 0;
        for (let y = by; y < by + 8; y++) for (let x = bx; x < bx + 8; x++) s += Math.abs(b[y * AW + x] - a[(y - dy) * AW + x - dx]);
        tot++; if (s / 64 > EXT_T) c++;
      }
      ext = tot ? c / tot : 0;
    }
    const [pdx, pdy] = withExt ? proj(i, j) : [0, 0];
    return { m: fb.s / 255, raw: s0 / 255, dx: fb.dx, dy: fb.dy, pdx, pdy, ext, sat: Math.abs(fb.dx) >= MX - 1 || Math.abs(fb.dy) >= MY - 1, ncc: () => ncc(a, b, fb.dx, fb.dy), gncc: () => gncc(a, b, fb.dx, fb.dy) };
  }
  // can j be explained as i moved by a big shift (a whip pan, up to 60 % of the frame along one axis)? Compared over a
  // full-height (or full-width) band of ≥ 40 % of the frame, so a sliver of background can't win. → {s, zero, d, axis}
  function wideLink(i, j) {
    const a = frame(i), b = frame(j), zero = sad(a, b, AW, AH, 0, 0);
    let best = { s: zero, d: 0, axis: 'x' };
    for (const [axis, L] of [['x', AW], ['y', AH]]) for (let d = -Math.round(L * .6); d <= Math.round(L * .6); d++) {
      if (!d) continue;
      const v = axis === 'x' ? sad(a, b, AW, AH, d, 0) : sad(a, b, AW, AH, 0, d);
      if (v < best.s) best = { s: v, d, axis };
    }
    const L = best.axis === 'x' ? AW : AH;
    return { s: best.s / 255, zero: zero / 255, d: best.d, axis: best.axis, frac: best.d / L, edge: Math.abs(best.d) >= Math.round(L * .6) };   // edge: the search bound won — no link
  }
  // zoom between two frames: best centred scale in 0.8–1.25 (content bigger in j → s > 1), its residual and the
  // zero-zoom residual; `edge` when the best is the search bound (heavy blur pins it there — no estimate)
  function scaleLink(i, j) {
    const a = frame(i), b = frame(j), cx = (AW - 1) / 2, cy = (AH - 1) / 2, mx = Math.round(AW * .15), my = Math.round(AH * .15);
    let best = Infinity, bs = 1, bq = 0, br = 0, zero = 0;
    for (let q = -10; q <= 10; q++) {
      const s = Math.exp(q * .022);
      let e = 0, c = 0;
      for (let y = my; y < AH - my; y += 2) for (let x = mx; x < AW - mx; x += 2) {
        const sx = cx + (x - cx) / s, sy = cy + (y - cy) / s, x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
        if (x0 < 0 || y0 < 0 || x0 + 1 >= AW || y0 + 1 >= AH) continue;
        const i0 = y0 * AW + x0, v = (a[i0] * (1 - fx) + a[i0 + 1] * fx) * (1 - fy) + (a[i0 + AW] * (1 - fx) + a[i0 + AW + 1] * fx) * fy;
        e += Math.abs(b[y * AW + x] - v); c++;
      }
      if (!q) zero = e / c;
      const v = e / c + Math.abs(q) * .01;
      if (v < best) { best = v; bs = s; bq = q; br = e / c; }
    }
    return { s: bs, r: br / 255, zero: zero / 255, edge: Math.abs(bq) >= 10 };
  }
  const scaleOf = (i, j) => { const L = scaleLink(i, j); return L.edge ? null : L.s; };
  const flatShare = k => { let m = 0; for (let q = 0; q < 16; q++) m = Math.max(m, hist[k * 16 + q]); return m; };
  const histDist = (i, j) => { let d = 0; for (let q = 0; q < 16; q++) d += Math.abs(hist[i * 16 + q] - hist[j * 16 + q]); return d / 2; };
  // least-squares blend of the two ends: residual of frame k against α·A + (1−α)·B
  function blend(ia, ib, k) {
    const A = frame(ia), B = frame(ib), F = frame(k);
    let num = 0, den = 0;
    for (let i = 0; i < px; i++) { const d = A[i] - B[i]; num += (F[i] - B[i]) * d; den += d * d; }
    const al = den > 0 ? Math.max(0, Math.min(1, num / den)) : .5;
    let r = 0;
    for (let i = 0; i < px; i++) r += Math.abs(F[i] - (al * A[i] + (1 - al) * B[i]));
    return { al, r: r / px / 255 };
  }
  const rawMad = (i, j) => sad(frame(i), frame(j), AW, AH, 0, 0) / 255;
  const mc = new Float32Array(n), mad = new Float32Array(n), madC = new Float32Array(n), ext = new Float32Array(n), dx = new Int16Array(n), dy = new Int16Array(n), pdx = new Int16Array(n), pdy = new Int16Array(n), sat = new Uint8Array(n);
  for (let k = 1; k < n; k++) {
    const al = align(k - 1, k);
    mc[k] = al.m; madC[k] = al.raw; mad[k] = rawMad(k - 1, k); ext[k] = al.ext; dx[k] = al.dx; dy[k] = al.dy; pdx[k] = al.pdx; pdy[k] = al.pdy; sat[k] = al.sat ? 1 : 0;
  }
  return { ...V, mean: mean_, std, sharp, mc, mad, madC, ext, dx, dy, pdx, pdy, sat, align, scaleOf, scaleLink, histDist, flatShare, blend, frame, rawMad, wideLink };
}

function runningMedian(a, W) {
  const n = a.length, out = new Float32Array(n), buf = [];
  for (let k = 0; k < n; k++) {
    buf.length = 0;
    for (let j = Math.max(1, k - W); j <= Math.min(n - 1, k + W); j++) buf.push(a[j]);
    out[k] = median(buf);
  }
  return out;
}

// ─────────────────────────────── shot detection ───────────────────────────────
function detect(F, { threshold, minShot }) {
  const { n, t, scene, mc, ext, mean: lum, sharp } = F;
  const fps = F.fps, AW = F.AW, AH = F.AH;
  const W = Math.max(3, Math.round(.5 * fps)), G = Math.max(1, Math.round(.1 * fps)), c = Math.max(2, Math.round(.15 * fps));
  const med = runningMedian(mc, W);
  const spikes = [];
  for (let k = 1; k < n; k++) {
    const rho = scene[k] >= threshold ? 2 : 3;
    if (mc[k] >= MC_FLOOR && mc[k] >= rho * Math.max(med[k], MED_FLOOR)) spikes.push(k);
  }
  const groups = [];
  for (const k of spikes) { const g = groups[groups.length - 1]; if (g && k - g.k1 <= G) { g.k1 = k; g.ks.push(k); } else groups.push({ k0: k, k1: k, ks: [k] }); }
  const flashes = [], cuts = [], pans = [];
  for (const g of groups) {
    g.peak = g.ks.reduce((a, b) => mc[b] > mc[a] ? b : a);
    g.scene = Math.max(...g.ks.map(k => scene[k]));
    g.rho = mc[g.peak] / Math.max(med[g.peak], MED_FLOOR);
    // a run of ≥ 3 changed frames: a whip pan if every pair links by a big shift (no cut — the camera just moved);
    // otherwise the pair that won't link is where the picture switched
    if (g.ks.length >= 3) {
      const links = [];
      for (let j = g.k0; j <= g.k1; j++) {
        const L = F.wideLink(j - 1, j), Z = F.scaleLink(j - 1, j);
        const okW = !L.edge && L.s <= Math.max(.012, .5 * L.zero), okZ = !Z.edge && Z.r <= Math.max(.012, .5 * Z.zero);
        // a pair "moves" only when the shift/zoom beats standing still outright (on a flat white frame any shift fits)
        const movW = okW && Math.abs(L.frac) >= .08 && L.s <= .5 * L.zero, movZ = okZ && Math.abs(Math.log(Z.s)) >= .04 && Z.r <= .5 * Z.zero;
        links.push({ j, ...L, ok: okW || okZ, movW, movZ, zs: Z.s });
      }
      const moving = links.filter(l => l.movW || l.movZ), isMov = j => moving.some(l => l.j === j);
      // an unlinked pair is the switch when it sits inside the fast part (moving pairs both sides), or when its picture
      // really changes (an unlinked pair where the blur starts or stops still correlates with its neighbour)
      for (const l of links) if (!l.ok) l.switch = (isMov(l.j - 1) && isMov(l.j + 1)) || F.align(l.j - 1, l.j, false).ncc() <= NCC_CUT;
      g.links = links;
      // direction of the move; for a transition the outgoing shot's (the engine's `out:` names the exit move)
      const mw = moving.filter(l => l.movW), dirOf = (before = Infinity) => {
        const use = mw.some(l => l.j < before) ? mw.filter(l => l.j < before) : mw;
        const ax = use.filter(l => l.axis === 'x').length >= use.length / 2 ? 'x' : 'y', sg = Math.sign(mean(use.filter(l => l.axis === ax).map(l => l.d)));
        return ax === 'x' ? (sg < 0 ? 'left' : 'right') : (sg < 0 ? 'up' : 'down');
      };
      const zoomDir = () => mean(moving.filter(l => l.movZ).map(l => Math.log(l.zs))) > 0 ? 'in' : 'out';
      const show = () => links.map(l => `${l.j}:${l.movZ && !l.movW ? 'z' + l.zs.toFixed(2) : l.frac.toFixed(2)}${l.ok ? '' : l.switch ? '✗' : '~'}`).join(' ');
      if (links.every(l => l.ok || !l.switch) && moving.length >= 2) {
        // one picture moving all the way: no cut. (A push — both shots sliding together — links the same way and lands
        // here too; it shows as an in-shot "whip pan" on the sheet, and the frames either side tell them apart.)
        const zoomOnly = !mw.length;
        pans.push({ k: g.k0, t: r3(t[g.k0]), dur: r3(t[g.k1] - t[g.k0 - 1]), kind: zoomOnly ? 'zoom' : 'whip pan', dir: zoomOnly ? zoomDir() : dirOf(), picture: r3(F.histDist(g.k0 - 1, g.k1)) });
        dbg('pan ', t[g.k0].toFixed(3), `span=${g.k0}-${g.k1} links ${show()}`);
        continue;
      } else {
        const bad = links.filter(l => !l.ok && l.switch);
        if (bad.length && moving.length >= 2) {                           // a whip / zoom transition: the switch is the unlinked pair
          g.peak = bad.reduce((a, b) => b.s / Math.max(b.zero, 1e-4) > a.s / Math.max(a.zero, 1e-4) ? b : a).j;
          if (mw.length >= 2) g.whipDir = dirOf(g.peak); else g.zoomDir = zoomDir();
        }
        dbg('chain', t[g.k0].toFixed(3), `span=${g.k0}-${g.k1} links ${show()} → ${g.whipDir ? 'whip ' + g.whipDir + ' at ' + g.peak : g.zoomDir ? 'zoom ' + g.zoomDir + ' at ' + g.peak : 'no move'}`);
      }
    }
    const before = g.k0 - 1, after = g.k1;                                  // frames on either side of the run
    g.ret = g.k0 === g.k1 ? 1 : F.align(before, after, false).m / mc[g.peak];
    // the frames inside the run (empty for a one-frame change) vs both sides
    const inside = []; for (let k = g.k0; k < g.k1; k++) inside.push(k);
    const lumIn = inside.length ? mean(inside.map(k => lum[k])) : null, lumOut = Math.max(lum[before], lum[after]), lumOutMin = Math.min(lum[before], lum[after]);
    g.flash = lumIn == null ? null : lumIn > lumOut + 30 ? 'white' : lumIn < lumOutMin - 30 ? 'black' : null;
    if (g.ret < RET) {                                                     // content came back: no cut
      // a flash when the frames in between are much brighter/darker, or change the whole frame (a colour/glitch frame);
      // anything smaller is the shot's own animation (a pop, a blink)
      if (g.flash || ext[g.peak] >= EXT_BIG) flashes.push({ k: g.k0, t: r3(t[g.k0]), frames: g.k1 - g.k0, dur: r3(t[g.k1] - t[g.k0]), color: g.flash || 'colour', strength: r3(mc[g.peak]) });
      dbg(g.flash || ext[g.peak] >= EXT_BIG ? 'flash' : 'in-place', t[g.k0].toFixed(3), `span=${g.k0}-${g.k1} ret=${g.ret.toFixed(2)} ext=${ext[g.peak].toFixed(2)} flash=${g.flash}`);
      continue;
    }
    // context either side of the change, never reaching past the neighbouring spike runs (other shots)
    const kb = g.flash ? g.k0 : g.peak;
    const gi = groups.indexOf(g), lo = gi > 0 ? groups[gi - 1].k1 + 1 : 1, hi = gi + 1 < groups.length ? groups[gi + 1].k0 - 1 : n - 1;
    const preJ = [], postJ = [];
    for (let j = Math.max(lo, g.k0 - c); j < g.k0; j++) preJ.push(j);
    for (let j = g.k1 + 1; j <= Math.min(hi, g.k1 + c); j++) postJ.push(j);
    // global motion per pair, counted only where the shift really explains the change (a pan, not a flicker)
    const vel = j => {
      if (F.sat[j] && Math.sign(F.pdx[j]) === Math.sign(F.dx[j]) && Math.sign(F.pdy[j]) === Math.sign(F.dy[j])) return [F.pdx[j] / AW * fps / 30, F.pdy[j] / AH * fps / 30];
      return F.madC[j] >= .01 && F.mc[j] <= .7 * F.madC[j] ? [F.dx[j] / AW * fps / 30, F.dy[j] / AH * fps / 30] : [0, 0];
    };
    const vmed = js => { if (!js.length) return { m: 0, x: 0, y: 0 }; const vs = js.map(vel); return { m: median(vs.map(([x, y]) => Math.hypot(x, y))), x: mean(vs.map(v => v[0])), y: mean(vs.map(v => v[1])) }; };
    const vp = vmed(preJ), vq = vmed(postJ);
    // blur dip per side: the frame at the change vs the same shot further away
    const sideMed = (j0, j1) => { const a = []; for (let j = Math.max(lo - 1, j0); j <= Math.min(hi, j1); j++) if (j >= 0 && j < n) a.push(sharp[j]); return a.length >= 2 ? median(a) : null; };
    const fa = sideMed(g.k0 - 3 * c, g.k0 - c - 1), fb = sideMed(g.k1 + c + 1, g.k1 + 3 * c);
    // (only where the shot has texture to blur: on a flat white UI a 'dip' of 1–2 levels is noise)
    const dipA = fa != null && fa >= SHARP_MIN && sharp[g.k0 - 1] <= .7 * fa, dipB = fb != null && fb >= SHARP_MIN && sharp[g.k1] <= .7 * fb;
    const blurDip = dipA || dipB, blurBoth = dipA && dipB;                // one side alone can be the shot's own look
    const zs = js => { const v = js.map(j => F.scaleOf(j - 1, j)).filter(x => x != null).map(x => Math.log(x) * fps / 30); return v.length ? median(v) : 0; };
    const zp = zs(preJ.slice(-3)), zq = zs(postJ.slice(0, 3));
    const sameDir = vp.x * vq.x + vp.y * vq.y > 0;
    const whip = (vp.m >= .03 && vq.m >= .03 && sameDir) || ((vp.m >= .05 || vq.m >= .05) && blurDip);
    const zoom = (Math.abs(zp) >= .025 && Math.abs(zq) >= .025 && zp * zq > 0) || ((Math.abs(zp) >= .04 || Math.abs(zq) >= .04) && blurDip);
    const moving = whip || zoom || blurDip || !!g.whipDir || !!g.zoomDir;
    const strong = g.scene >= threshold;
    const alBA = F.align(g.k0 - 1, g.k1, false), nccBA = alBA.ncc();
    const e = ext[g.peak];
    // below the threshold a change must be a moving transition (whip / zoom / blur around it), or a frame-wide change
    // whose picture no longer correlates with the one before (an overlay, a UI build or a fast arm keeps ~0.5–0.9)
    const accept = strong || (moving && e >= EXT_MIN && nccBA <= NCC_MOVE) || (g.scene >= threshold / 3 && nccBA <= NCC_CUT && e >= EXT_BIG);
    dbg(accept ? 'CUT ' : 'skip', t[kb].toFixed(3), `k=${kb} span=${g.k0}-${g.k1} scene=${g.scene.toFixed(3)} mc=${mc[g.peak].toFixed(3)} rho=${g.rho.toFixed(1)} ext=${e.toFixed(2)} ncc=${nccBA.toFixed(2)} edges=${DEBUG ? alBA.gncc().toFixed(2) : ""} ret=${g.ret.toFixed(2)} v=${vp.m.toFixed(3)}/${vq.m.toFixed(3)} z=${zp.toFixed(3)}/${zq.toFixed(3)} blur=${dipA ? 'A' : ''}${dipB ? 'B' : ''} sharp=${sharp[g.k0 - 1].toFixed(1)}/${sharp[g.k1].toFixed(1)} vs ${fa && fa.toFixed(1)}/${fb && fb.toFixed(1)} flash=${g.flash}`);
    if (!accept) continue;
    let type = 'cut', detail = null;
    if (g.flash) { type = 'flash'; detail = `${g.flash} flash, ${g.k1 - g.k0} frame${g.k1 - g.k0 > 1 ? 's' : ''}`; }
    else if (g.whipDir) { type = `whip-${g.whipDir}`; detail = `${r3(t[g.k1] - t[g.k0 - 1])} s of motion blur`; }
    else if (g.zoomDir) { type = `zoom-${g.zoomDir}`; detail = `${r3(t[g.k1] - t[g.k0 - 1])} s zoom-through`; }
    else if (whip) {
      const X = vp.x + vq.x, Y = vp.y + vq.y;
      type = Math.abs(X) * AW >= Math.abs(Y) * AH ? (X < 0 ? 'whip-left' : 'whip-right') : (Y < 0 ? 'whip-up' : 'whip-down');
    } else if (zoom) type = (zp + zq) > 0 ? 'zoom-in' : 'zoom-out';
    else if (blurBoth) type = 'blur';
    else if (g.ks.length >= 2) { type = 'fx'; detail = `${g.ks.length} jumps over ${r3(t[g.k1] - t[g.k0])} s (glitch / effect)`; }
    // on a mostly flat picture (a white UI, sparse graphics) a few small things moving decorrelate it as much as a new
    // screen does — a sub-threshold change there is marked low (a "?" on the sheet) for Claude to judge from the frames
    const flat = Math.max(F.flatShare(g.k0 - 1), F.flatShare(g.k1)) >= .6;
    // (a whip / zoom measured on the whole frame on both sides — the camera itself moving — still counts there)
    const conf = strong && g.rho >= 4 ? 'high' : strong || ((whip || zoom) && e >= EXT_MIN) ? 'medium' : flat ? 'low' : (moving && e >= EXT_MIN) || nccBA <= .2 ? 'medium' : 'low';
    cuts.push({ k: kb, k0: g.k0, k1: g.k1, type, detail, conf, scene: r3(g.scene), diff: r3(mc[g.peak]), rho: Math.round(g.rho * 10) / 10, ext: r3(e), ncc: r3(nccBA), weight: mc[g.peak] });
  }
  // ── gradual transitions: dissolves and fades (blend test), never across an accepted cut ──
  const near = (a, b) => cuts.some(x => x.k1 + 2 >= a && x.k0 - 2 <= b);
  const hs = [...new Set([.15, .3, .5, .8].map(s => Math.max(2, Math.round(s * fps))))];
  const cand = [];
  for (const h of hs) for (let k = h; k + h < n; k++) {
    const a = k - h, b = k + h;
    if (near(a, b)) continue;
    const raw = F.rawMad(a, b);                                       // cheap tests first
    if (raw < .06) continue;                                          // the ends barely differ
    let maxStep = 0; for (let j = a + 1; j <= b; j++) maxStep = Math.max(maxStep, F.mad[j]);
    if (maxStep > .4 * raw) continue;                                 // one frame carries it: a cut's job, not a blend
    // the change is bounded: quieter just outside the window than inside it
    const inside = mean(Array.from({ length: b - a }, (_, i) => F.mad[a + 1 + i]));
    const out = []; for (let j = a - h; j <= a; j++) if (j >= 1) out.push(F.mad[j]); for (let j = b + 1; j <= b + h; j++) if (j < n) out.push(F.mad[j]);
    if (out.length && median(out) > .6 * inside) continue;
    const m0 = F.blend(a, b, k);
    // a blend of the two ends explains the middle almost entirely (a light change or a 3-D move leaves 25–30 % unexplained)
    if (m0.r > .2 * raw || m0.al < .2 || m0.al > .8) continue;
    const q1 = F.blend(a, b, k - (h >> 1)), q2 = F.blend(a, b, k + (h >> 1));
    if (!(q1.al > m0.al && m0.al > q2.al) || q1.r > .3 * raw || q2.r > .3 * raw) continue;
    const al = F.align(a, b, false);
    if (al.m < .6 * raw) continue;                                    // a move explains it (pan / push), not a blend
    const nc = al.ncc();
    if (nc > NCC_CUT) continue;                                       // same picture at both ends: a light change or an overlay fading, not a dissolve
    cand.push({ k, h, a, b, D: raw, r: m0.r, ncc: nc, score: raw - m0.r });
  }
  cand.sort((x, y) => y.score - x.score);
  const grads = [];
  for (const x of cand) if (!grads.some(g => x.a <= g.b && x.b >= g.a)) grads.push(x);
  const fades = [], dissolves = [];
  for (const g of grads) {
    const uni = k => F.std[k] < 10 && (F.mean[k] < 40 || F.mean[k] > 215);
    const kind = uni(g.a) ? 'fade-in' : uni(g.b) ? 'fade-out' : 'dissolve';
    const ev = { k: g.k, k0: g.a, k1: g.b, t: r3(t[g.k]), span: [r3(t[g.a]), r3(t[g.b])], kind, strength: r3(g.D), residual: r3(g.r), ncc: r3(g.ncc) };
    (kind === 'dissolve' ? dissolves : fades).push(ev);
    dbg(kind, ev);
  }
  // a fade-out then a fade-in within 2 s, with different content either side, is one dip transition
  fades.sort((a, b) => a.k - b.k);
  for (let i = 0; i + 1 < fades.length; i++) {
    const o = fades[i], q = fades[i + 1];
    if (o.kind === 'fade-out' && q.kind === 'fade-in' && t[q.k0] - t[o.k1] <= 2 && F.align(o.k0, q.k1, false).m >= .06) {
      const k = Math.round((o.k1 + q.k0) / 2);
      cuts.push({ k, k0: o.k0, k1: q.k1, type: 'fade', detail: 'dip to black/white', conf: 'medium', scene: r3(scene[k]), diff: r3(o.strength), weight: o.strength });
      o.dip = q.dip = true;
    }
  }
  for (const d of dissolves) cuts.push({ k: d.k, k0: d.k0, k1: d.k1, type: 'dissolve', detail: `${r3(d.span[1] - d.span[0])} s blend`, conf: d.residual < .15 * d.strength ? 'high' : 'medium', scene: r3(scene[d.k]), diff: r3(d.strength), weight: d.strength });
  // ── merge boundaries closer than minShot (keep the stronger), and none within minShot of either end ──
  cuts.sort((a, b) => a.k - b.k);
  const end = t[n - 1] + F.frameDur, tol = .5 / fps, merged = [];
  for (const x of cuts) {
    if (t[x.k] < minShot - tol || end - t[x.k] < minShot - tol) { dbg('drop (edge)', t[x.k]); continue; }
    const p = merged[merged.length - 1];
    if (p && t[x.k] - t[p.k] < minShot - tol) {
      const keep = x.weight > p.weight ? x : p;
      merged[merged.length - 1] = { ...keep, k0: Math.min(p.k0, x.k0), k1: Math.max(p.k1, x.k1), merged: (p.merged || 1) + 1 };
      dbg('merge', t[p.k], t[x.k]);
    } else merged.push(x);
  }
  return { cuts: merged, flashes, pans, fades: fades.filter(f => !f.dip) };
}

// ─────────────────────────────── audio + tempo ───────────────────────────────
async function decodeAudio(file, aIndex) {
  const r = await run('ffmpeg', ['-hide_banner', '-v', 'error', '-nostdin', '-i', file, '-map', `0:${aIndex}`, '-vn', '-sn', '-dn', '-ac', '1', '-ar', String(ASR), '-f', 'f32le', 'pipe:1']);
  if (r.code !== 0) throw new UserError(`ffmpeg could not decode the audio of ${basename(file)}:\n${r.stderr.trim()}`);
  const b = r.stdout, x = new Float32Array(Math.floor(b.length / 4));
  for (let i = 0; i < x.length; i++) x[i] = b.readFloatLE(i * 4);
  return x;
}
async function loudness(file, aIndex) {        // EBU R128 integrated loudness + true peak (as common.measureLoudness, audio only)
  const r = await run('ffmpeg', ['-hide_banner', '-nostats', '-nostdin', '-i', file, '-map', `0:${aIndex}`, '-vn', '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-']);
  const s = r.stderr, I = (s.match(/I:\s+(-?[\d.]+|-inf) LUFS/g) || []).pop(), tp = s.match(/True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS/), lra = s.match(/LRA:\s+([\d.]+) LU/);
  const v = x => { const m = x && String(x).match(/-?[\d.]+/); return m && Number.isFinite(Number(m[0])) && Number(m[0]) > -70 ? Number(m[0]) : null; };
  return { I: v(I), TP: tp && tp[1] !== '-inf' ? Number(tp[1]) : null, LRA: lra ? Number(lra[1]) : null };
}
// iterative radix-2 FFT, in place
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { let q = re[i]; re[i] = re[j]; re[j] = q; q = im[i]; im[i] = im[j]; im[j] = q; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, h = len >> 1;
    for (let k = 0; k < h; k++) {
      const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
      for (let i = k; i < n; i += len) {
        const b = i + h, tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[i] - tr; im[b] = im[i] - ti; re[i] += tr; im[i] += ti;
      }
    }
  }
}
// 46 ms window, 5.8 ms hop. An envelope frame is stamped at its window centre + ONSET_LAG: spectral flux peaks before
// the window centre reaches the attack; measured −6…−10 ms (mean −8.2) on clicks, kicks, a hip-hop, DnB and trap loop,
// the skill's own composed music (cue) — so 8.2 ms is added back.
const FFT_N = 512, HOP = 64, ONSET_LAG = .0082;
function onsets(x, sr) {
  const N = FFT_N, nb = N / 2, T = Math.max(0, Math.floor((x.length - N) / HOP) + 1);
  const win = Float64Array.from({ length: N }, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / N));
  const re = new Float64Array(N), im = new Float64Array(N), prev = new Float64Array(nb + 1);
  const flux = new Float32Array(T), low = new Float32Array(T), rms = new Float32Array(T);
  const lowBins = Math.max(2, Math.round(200 / (sr / N)));
  for (let t = 0; t < T; t++) {
    let e = 0;
    for (let i = 0; i < N; i++) { const v = x[t * HOP + i]; re[i] = v * win[i]; im[i] = 0; e += v * v; }
    rms[t] = Math.sqrt(e / N);
    fft(re, im);
    let f = 0, l = 0;
    for (let b = 1; b <= nb; b++) {
      const y = Math.log1p(100 * Math.hypot(re[b], im[b]) / (N / 4)), d = y - prev[b];
      if (d > 0 && t) { f += d; if (b < lowBins) l += d; }
      prev[b] = y;
    }
    flux[t] = f; low[t] = l;
  }
  return { flux, low, rms, er: sr / HOP, t0: N / 2 / sr + ONSET_LAG };
}
function movingAvg(a, w) {
  const n = a.length, out = new Float32Array(n); let s = 0;
  const pre = new Float64Array(n + 1); for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + a[i];
  for (let i = 0; i < n; i++) { const lo = Math.max(0, i - w), hi = Math.min(n, i + w + 1); out[i] = (pre[hi] - pre[lo]) / (hi - lo); }
  return out;
}
// tempo + beat grid from a mono signal. Returns {bpm|null, reason, confidence, phase, firstBeat, downbeat, beats, alternates}
export function analyzeTempo(x, sr = ASR) {
  const dur = x.length / sr;
  let peak = 0, e = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; e += x[i] * x[i]; }
  const rmsDb = 10 * Math.log10(e / Math.max(1, x.length) + 1e-20);
  if (peak < 1e-3 || rmsDb < -60) return { bpm: null, reason: `the audio is silent (peak ${peak > 0 ? (20 * Math.log10(peak)).toFixed(0) : '-inf'} dBFS)`, confidence: 0 };
  if (dur < 4) return { bpm: null, reason: `too little audio for a tempo (${dur.toFixed(1)} s; need ≥ 4 s)`, confidence: 0 };
  const O = onsets(x, sr), er = O.er, T = O.flux.length;
  const loc = movingAvg(O.flux, Math.round(.25 * er));
  const nov = Float32Array.from(O.flux, (v, i) => Math.max(0, v - loc[i]));
  const nm = mean(nov); const z = Float32Array.from(nov, v => v - nm);
  const lagMin = Math.floor(er * 60 / 240), lagMax = Math.min(T - 2, Math.ceil(er * 60 / 40));
  let r0 = 0; for (let i = 0; i < T; i++) r0 += z[i] * z[i]; r0 /= T;
  if (!(r0 > 0) || lagMax <= lagMin + 2) return { bpm: null, reason: 'no onsets in the audio', confidence: 0 };
  const acf = new Float64Array(lagMax + 2);
  for (let L = lagMin - 1; L <= lagMax + 1; L++) { let s = 0; for (let i = 0; i + L < T; i++) s += z[i] * z[i + L]; acf[L] = s / (T - L) / r0; }
  const prior = L => Math.exp(-.5 * (Math.log2((L / er) / .5) / .9) ** 2);     // log-normal around 120 BPM
  let bestL = -1, bestS = -Infinity;
  for (let L = lagMin; L <= lagMax; L++) if (acf[L] >= acf[L - 1] && acf[L] >= acf[L + 1] && acf[L] * prior(L) > bestS) { bestS = acf[L] * prior(L); bestL = L; }
  if (bestL < 0 || acf[bestL] <= 0) return { bpm: null, reason: 'no periodic pulse in the onsets', confidence: 0 };
  const y0 = acf[bestL - 1], y1 = acf[bestL], y2 = acf[bestL + 1], dd = y0 - 2 * y1 + y2;
  const Lhat = bestL + (dd < 0 ? .5 * (y0 - y2) / dd : 0);
  // comb / phase search on a lightly smoothed novelty, over ±3 % around the autocorrelation tempo
  const ns = new Float32Array(T);
  for (let i = 0; i < T; i++) { let s = 0, w = 0; for (let d = -2; d <= 2; d++) { const j = i + d; if (j >= 0 && j < T) { const g = Math.exp(-d * d / 2); s += nov[j] * g; w += g; } } ns[i] = s / w; }
  const at = p => { const i = Math.floor(p), f = p - i; return i + 1 < T ? ns[i] * (1 - f) + ns[i + 1] * f : 0; };
  const comb = P => {
    const scores = [];
    for (let ph = 0; ph < P; ph += .5) { let s = 0, c = 0; for (let p = ph; p < T - 1; p += P) { s += at(p); c++; } scores.push(c ? s / c : 0); }
    let bi = 0; for (let i = 1; i < scores.length; i++) if (scores[i] > scores[bi]) bi = i;
    return { best: scores[bi], ph: bi * .5, scores, bi };
  };
  const bpm0 = 60 * er / Lhat;
  let best = null;
  for (let b = bpm0 * .97; b <= bpm0 * 1.03; b += .02) { const P = 60 * er / b, C = comb(P); if (!best || C.best > best.C.best) best = { bpm: b, P, C }; }
  const { P, C } = best;
  // sub-step phase (parabolic) and confidence: comb peak vs. all phases, beat strength vs. mean, autocorrelation height
  const sc = C.scores, i = C.bi, m1 = sc[(i - 1 + sc.length) % sc.length], p1 = sc[(i + 1) % sc.length], den = m1 - 2 * sc[i] + p1;
  const ph = ((C.ph + (den < 0 ? .5 * .5 * (m1 - p1) / den : 0)) % P + P) % P;
  const zc = (C.best - mean(sc)) / (Math.sqrt(mean(sc.map(v => (v - mean(sc)) ** 2))) || 1);
  const B = C.best / (mean(Array.from(ns)) || 1);
  const rPk = acf[Math.round(Lhat)] || 0;
  // all three must agree; speech (a VO) scores ~0.25 here, steady music ≥ 0.9, a beat-less section ≤ 0.35
  const confidence = Math.max(0, Math.min(1, Math.min((zc - 3) / 2, (B - 2) / 4, rPk / .4)));
  const toSec = p => p / er + O.t0;                                        // envelope frame → seconds
  const bpm = best.bpm, beat = 60 / bpm;
  // music start: first envelope frame above 10 % of the loud level
  const loud = Float64Array.from(O.rms).sort()[Math.floor(T * .95)] || 0;
  let first = 0; while (first < T && O.rms[first] < loud * .1) first++;
  // the grid from its earliest beat ≥ 0 (the envelope's first stamp is ~31 ms in, so a beat at 0 needs extending back)
  const beats = [], ph0 = ((toSec(ph) % beat) + beat) % beat;
  for (let s = ph0; s < dur; s += beat) if (s >= toSec(first) - beat / 4) beats.push(r4(s));
  // downbeat: which of 4 beat positions carries the most low-band accent (kicks)
  const acc = [0, 0, 0, 0], cnt = [0, 0, 0, 0];
  beats.forEach((s, j) => { const c0 = Math.round((s - O.t0) * er); let a = 0; for (let d = -2; d <= 2; d++) { const q = c0 + d; if (q >= 0 && q < T) a = Math.max(a, O.low[q] + .5 * O.flux[q]); } acc[j % 4] += a; cnt[j % 4]++; });
  const av = acc.map((a, j) => cnt[j] ? a / cnt[j] : 0), order = [0, 1, 2, 3].sort((a, b) => av[b] - av[a]);
  const dbConf = av[order[0]] > 0 ? (av[order[0]] - av[order[1]]) / av[order[0]] : 0;
  // octave evidence: onsets on the half-beats (→ double time) and alternate beats much stronger than the others (→ half time)
  const strengthAt = sec => { const c0 = Math.round((sec - O.t0) * er); let a = 0; for (let d = -2; d <= 2; d++) { const q = c0 + d; if (q >= 0 && q < T) a = Math.max(a, ns[q]); } return a; };
  const onB = mean(beats.map(strengthAt)), midB = mean(beats.map(b => strengthAt(b + beat / 2)));
  const evenB = mean(beats.filter((_, j) => j % 2 === 0).map(strengthAt)), oddB = mean(beats.filter((_, j) => j % 2).map(strengthAt));
  const dblSupport = onB > 0 ? midB / onB : 0, halfSupport = Math.max(evenB, oddB) > 0 ? 1 - Math.min(evenB, oddB) / Math.max(evenB, oddB) : 0;
  const alternates = [[.5, 'half'], [2, 'double'], [2 / 3, '2/3'], [1.5, '3/2']].flatMap(([f, name]) => {
    const L = Lhat / f; if (L < lagMin * .5 || L > (lagMax + 1)) return [];
    const Li = Math.round(L), a = Li >= 1 && Li < acf.length ? acf[Li] : null;
    if (a == null) return [];
    return [{ bpm: Math.round(bpm * f * 10) / 10, rel: name, acf: r3(a), weighted: r3(a * prior(L) / bestS) }];
  });
  // octave: between ~100 and 145 BPM a pulse is rarely felt at half/double; below 100 double time is a real reading
  // (85 hip-hop with 16th hats, DnB / trap counted half-time), above 145 half time is — offer the other octave there
  let octave = null;
  if (bpm < 100 && bpm * 2 <= 200 && (dblSupport >= .15 || (acf[Math.round(Lhat / 2)] || 0) >= .2)) octave = { bpm: Math.round(bpm * 2 * 10) / 10, rel: 'double' };
  if (bpm > 145 && (halfSupport >= .15 || (acf[Math.round(Lhat * 2)] || 0) >= .2)) octave = { bpm: Math.round(bpm / 2 * 10) / 10, rel: 'half' };
  const ambiguous = !!octave || alternates.some(a => (a.rel === 'half' || a.rel === 'double') && a.weighted >= .85);
  const res = { bpm: Math.round(bpm * 100) / 100, beat: r4(beat), confidence: r3(confidence), phase: r4(toSec(ph) % beat), firstBeat: beats[0] ?? null,
    downbeat: beats[order[0]] ?? null, downbeatConfidence: r3(dbConf), musicStart: r3(toSec(first)), beats, alternates, ambiguous, octave,
    metrics: { combZ: r3(zc), beatStrength: r3(B), acfPeak: r3(rPk), dblSupport: r3(dblSupport), halfSupport: r3(halfSupport) } };
  if (confidence < .35) return { bpm: null, reason: `no clear pulse (confidence ${confidence.toFixed(2)})`, confidence: r3(confidence), rejected: { bpm: res.bpm, metrics: res.metrics } };
  return res;
}

// the pulse per section (thirds of anything ≥ 24 s): a confident whole can hide a beat-less intro or a dialogue stretch
function sections(x, sr = ASR) {
  const dur = x.length / sr;
  if (dur < 24) return null;
  return [0, 1, 2].map(i => {
    const a = Math.floor(i * x.length / 3), b = Math.floor((i + 1) * x.length / 3), T = analyzeTempo(x.subarray(a, b), sr);
    return { from: r3(a / sr), to: r3(b / sr), bpm: T.bpm, confidence: T.confidence };
  });
}

// ─────────────────────────────── thumbnails ───────────────────────────────
// exact frames by decode index (the same index the analysis used): one decode pass per ≤ 48 frames (ffmpeg's expression
// parser stops at ~100 terms), at most 4 passes at a time
async function grabFrames(P, idx, size, tmp) {
  const want = [...new Set(idx)].sort((a, b) => a - b), chunks = [];
  for (let i = 0; i < want.length; i += 48) chunks.push(want.slice(i, i + 48));
  const files = new Map();
  let next = 0;
  const worker = async () => { while (next < chunks.length) { const ci = next++; await grab(chunks[ci], ci); } };
  await Promise.all(Array.from({ length: Math.min(4, chunks.length) }, worker));
  return idx.map(k => files.get(k));
  async function grab(ch, ci) {
    const dir = join(tmp, `grab${ci}`); mkdirSync(dir, { recursive: true });
    const sel = ch.map(k => `eq(n\\,${k})`).join('+');
    const r = await run('ffmpeg', ['-hide_banner', '-v', 'error', '-nostdin', '-i', P.file, '-map', `0:${P.video.index}`, '-an', '-sn', '-dn',
      '-vf', `select=${sel},scale=${size[0]}:${size[1]}:flags=bicubic,setsar=1`, '-fps_mode', 'passthrough', '-q:v', '3', join(dir, '%05d.jpg')]);
    if (r.code !== 0) throw new Error(`thumbnail extraction failed:\n${r.stderr}`);
    const got = readdirSync(dir).filter(f => f.endsWith('.jpg')).sort();
    if (got.length !== ch.length) throw new Error(`thumbnail extraction: wanted ${ch.length} frames, got ${got.length}`);
    ch.forEach((k, i) => files.set(k, join(dir, got[i])));
  }
}

// ─────────────────────────────── outputs ───────────────────────────────
// "87.01 BPM" — or "87.01 BPM in 51.0–76.5 s (no steady pulse elsewhere)" when the beat doesn't run through the reel
const tempoWhere = Tm => !Tm.pulsed || Tm.coverage >= .99 ? '' : ` in ${Tm.pulsed.map(([a, b]) => `${a.toFixed(1)}–${b.toFixed(1)} s`).join(', ')} (no steady pulse elsewhere)`;
const TR_COLOR = { start: '#6B6B76', cut: '#4A4A55', 'whip-left': '#2F6BE0', 'whip-right': '#2F6BE0', 'whip-up': '#2F6BE0', 'whip-down': '#2F6BE0', 'zoom-in': '#7A4BD6', 'zoom-out': '#7A4BD6', blur: '#1E8F8A', dissolve: '#0E8F6A', fade: '#5D6B7A', flash: '#C98400', fx: '#C43C3C' };
function layoutFor(aspect, r) {                   // contact-sheet geometry per source shape (all px at device scale 1)
  if (aspect === '9x16') { const TH = 280, TW = Math.round(TH * r); return { cols: 2, TW, TH, info: 230 }; }
  if (aspect === '1x1') { const TH = 200, TW = Math.round(TH * r); return { cols: 2, TW, TH, info: 230 }; }
  const TW = 360, TH = Math.round(TW / r); return { cols: 1, TW, TH, info: 300 };
}
const pageWidth = L => L.cols * (L.info + 3 * L.TW + 2 * 8 + 12 + 22) + (L.cols - 1) * 14 + 56;
// one self-contained page: every shot (breakdown.html), one sheet's shots, or the overview grid. Each sheet is its own
// page holding only its rows — a long page of hidden rows makes Chrome's full-page capture repeat tiles.
function sheetHtml(B, thumbData, { rows = null, label = null, overview = false } = {}) {
  const L = B.layout, cellW = L.info + 3 * L.TW + 2 * 8 + 12 + 22, PW = pageWidth(L);
  const S = B.stats, A = B.audio, Tm = A && A.tempo, dur = B.probe.duration, idx = rows || B.shots.map((_, i) => i), on = new Set(rows || []);
  const statLine = [
    `${B.probe.W}×${B.probe.H} (${B.probe.aspect})`, `${B.probe.fps.toFixed(2).replace(/\.00$/, '')} fps${B.probe.vfr ? ' VFR' : ''}`, `${dur.toFixed(2)} s`,
    `<b>${S.shots} shots</b>`, `median ${S.median.toFixed(2)} s`, `mean ${S.mean.toFixed(2)} s`, `${S.cutsPerSec.toFixed(2)} cuts/s`, `${Math.round(S.shortShare * 100)} % under 0.5 s`,
  ].join(' · ');
  const audioLine = !A || !A.present ? 'no audio stream' : !Tm || Tm.bpm == null ? `tempo: none — ${esc((Tm && Tm.reason) || A.reason || '')}${A.loudness && A.loudness.I != null ? ` · ${A.loudness.I} LUFS` : ''}`
    : [`<b>${Tm.bpm} BPM</b>${esc(tempoWhere(Tm))} (confidence ${Tm.confidence}${Tm.octave ? `; or ${Tm.octave.bpm} ${Tm.octave.rel} time` : Tm.ambiguous ? '; half/double ambiguous' : ''})`, `first beat ${Tm.firstBeat.toFixed(3)} s`,
      B.alignment ? `<b>${B.alignment.onBeat} of ${B.alignment.cuts} cuts on the beat</b> (±1 frame; chance ≈ ${Math.round(B.alignment.chance * 100)} %)${B.alignment.onHalf ? `, ${B.alignment.onHalf} on a half-beat` : ''}${B.alignment.outside ? `; ${B.alignment.outside} cuts where there's no pulse: n/a` : ''}` : '',
      A.loudness && A.loudness.I != null ? `${A.loudness.I} LUFS, TP ${A.loudness.TP ?? '–'} dBTP` : ''].filter(Boolean).join(' · ');
  const inShot = [B.flashes.length && `${B.flashes.length} flash${B.flashes.length > 1 ? 'es' : ''}`, B.pans.length && `${B.pans.length} camera move${B.pans.length > 1 ? "s" : ""} (whip pan / zoom)`, B.fades.length && `${B.fades.length} fade${B.fades.length > 1 ? 's' : ''}`].filter(Boolean).join(', ');
  const trCount = (Object.entries(S.transitions).map(([k, v]) => `${v} ${k}`).join(' · ') || 'no cuts') + (inShot ? ` · inside shots: ${inShot}` : '');
  // pacing strip: shots as blocks, beat ticks above, this page's shots highlighted
  const SW = PW - 56, x = s => (s / dur * SW).toFixed(1);
  const blocks = B.shots.map((s, i) => `<rect x="${x(s.start)}" y="18" width="${Math.max(1, s.dur / dur * SW - 1).toFixed(1)}" height="34" rx="2" fill="${on.has(i) ? '#2F6BE0' : i % 2 ? '#B9BCC8' : '#9EA2B1'}"/>`).join('');
  const ticks = Tm && Tm.beats ? Tm.beats.filter(b => b <= dur).map(b => `<line x1="${x(b)}" x2="${x(b)}" y1="4" y2="14" stroke="#C98400" stroke-width="1"/>`).join('') : '';
  const strip = `<svg width="${SW}" height="70" viewBox="0 0 ${SW} 70">${ticks}${blocks}<text x="0" y="68" font-size="13" fill="#6B6B76">0 s</text><text x="${SW}" y="68" font-size="13" fill="#6B6B76" text-anchor="end">${dur.toFixed(1)} s</text></svg>`;
  const row = i => {
    const s = B.shots[i], tr = s.in, col = TR_COLOR[tr.type] || '#4A4A55';
    const th = ['start', 'mid', 'end'].map((w, j) => `<div class="thumb"><img src="${thumbData[i][j]}" width="${L.TW}" height="${L.TH}"><span>${['+2f', 'mid', '−2f'][j]} ${esc(s.thumbs[w].tc)}</span></div>`).join('');
    return `<div class="row" data-i="${i}"><div class="info"><div class="num">#${pad2(i + 1)}</div>
      <div class="tc">${esc(s.tcIn)}</div><div class="tc arrow">→ ${esc(s.tcOut)}</div>
      <div class="sec">${s.start.toFixed(3)}–${s.end.toFixed(3)} s</div>
      <div class="dur"><b>${s.dur.toFixed(2)} s</b> · ${s.frames} fr${s.beats != null ? ` · ${s.beats.toFixed(2)} beats` : ''}</div>
      <div><span class="tr" style="background:${col}">in: ${esc(tr.type)}${tr.conf === 'low' ? ' ?' : ''}</span>${s.onBeat ? `<span class="beat">${esc(s.onBeat)}</span>` : ''}</div>
      ${tr.detail ? `<div class="det">${esc(tr.detail)}</div>` : ''}${s.events.length ? `<div class="det ev">${esc(s.events.map(e => e.label).join('; '))}</div>` : ''}
      </div><div class="thumbs">${th}</div></div>`;
  };
  const OW = B.probe.aspect === '9x16' ? 150 : B.probe.aspect === '1x1' ? 190 : 240, OH = Math.round(OW / L.r), ocols = Math.max(1, Math.floor((PW - 56 + 10) / (OW + 10)));
  const body = overview
    ? `<div class="ovs" style="width:${ocols * (OW + 10)}px">${B.shots.map((s, i) => `<div class="ov"><img src="${thumbData[i][1]}" width="${OW}" height="${OH}"><div><b>#${pad2(i + 1)}</b> ${esc(s.tcIn)} · ${s.dur.toFixed(2)} s · ${esc(s.in.type)}</div></div>`).join('')}</div>`
    : `<div class="rows">${idx.map(row).join('')}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Breakdown — ${esc(B.source.name)}</title><style>
:root{--bg:#F4F4F6;--ink:#111114;--muted:#5C5C66;--line:#D8D8DE}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font:18px/1.35 -apple-system,"Helvetica Neue",Arial,sans-serif}
.wrap{width:${PW}px;padding:22px 28px 26px}h1{font-size:28px;margin:0 0 6px}h1 small{font-weight:500;color:var(--muted);font-size:20px}
.stats{font-size:19px;margin:2px 0}.stats b{font-weight:700}.page{font:700 20px Menlo,ui-monospace,monospace;color:#2F6BE0;margin:6px 0 4px}
.rows{display:grid;grid-template-columns:repeat(${L.cols},${cellW}px);gap:14px;margin-top:10px}
.row{display:flex;gap:12px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px}
.info{width:${L.info}px;flex:none;display:flex;flex-direction:column;gap:3px}.num{font:800 32px/1 -apple-system,Arial,sans-serif}
.tc{font:700 25px/1.1 Menlo,ui-monospace,monospace}.tc.arrow{color:#333}.sec{font:15px Menlo,ui-monospace,monospace;color:var(--muted)}
.dur{font-size:19px}.tr{display:inline-block;color:#fff;font-weight:700;font-size:17px;padding:2px 8px;border-radius:6px;margin-top:2px}
.beat{display:inline-block;margin-left:6px;font-size:15px;color:#8A5A00;font-weight:700}.det{font-size:15px;color:var(--muted)}.ev{color:#8A5A00}
.thumbs{display:flex;gap:8px;align-items:flex-start}.thumb{position:relative}.thumb img{display:block;border-radius:4px;background:#000}
.thumb span{position:absolute;left:4px;bottom:4px;background:rgba(0,0,0,.75);color:#fff;font:600 14px Menlo,monospace;padding:2px 5px;border-radius:3px}
.ovs{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}.ov{width:${OW}px;font-size:13px}.ov img{display:block;border-radius:3px;background:#000}
</style></head><body><div class="wrap">
<h1>Reference breakdown <small>${esc(B.source.name)}</small></h1>
<div class="stats">${statLine}</div><div class="stats">${trCount}</div><div class="stats">${audioLine}</div>
${strip}<div class="page">${esc(label || (overview ? 'overview · middle frame of every shot' : `all ${S.shots} shots`))}</div>
${body}
<div class="stats" style="margin-top:10px;color:#5C5C66;font-size:15px">Pacing and structure only — never the reference's footage, audio or copy.</div>
</div></body></html>`;
}

// 8×8 grey fingerprint of an image region (ffmpeg), for the render check
async function fingerprint(file, crop) {
  const r = await run('ffmpeg', ['-hide_banner', '-v', 'error', '-nostdin', '-i', file, '-vf', `${crop ? `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},` : ''}scale=8:8:flags=area,format=gray`, '-frames:v', '1', '-f', 'rawvideo', 'pipe:1']);
  if (r.code !== 0 || r.stdout.length !== 64) throw new Error(`render check: could not read ${basename(file)}: ${r.stderr}`);
  return r.stdout;
}
async function screenshotSheets(out, B, thumbData, tmp) {
  const { launch } = await import('./render.mjs');
  const PW = pageWidth(B.layout), per = B.params.perPage, n = B.shots.length, pages = Math.ceil(n / per), files = [], checks = {};
  const jobs = Array.from({ length: pages }, (_, p) => {
    const rows = Array.from({ length: Math.min(per, n - p * per) }, (_, i) => p * per + i);
    return { file: `sheet-${pad2(p + 1)}.png`, rows, html: sheetHtml(B, thumbData, { rows, label: `sheet ${p + 1}/${pages} · shots ${rows[0] + 1}–${rows[rows.length - 1] + 1} of ${n}` }) };
  });
  jobs.push({ file: 'overview.png', rows: null, html: sheetHtml(B, thumbData, { overview: true }) });
  const browser = await launch();
  try {
    const load = async (html, h) => {
      const ctx = await browser.newContext({ viewport: { width: PW, height: h }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => null))));
      return { ctx, page };
    };
    for (const j of jobs) {
      // measure, then draw on a fresh page created at the final size: growing a viewport and capturing at once makes
      // headless Chrome reuse stale tiles (the header repeats at the bottom)
      let { ctx, page } = await load(j.html, 800);
      const h = Math.ceil(await page.evaluate(() => document.querySelector('.wrap').getBoundingClientRect().height));
      await ctx.close();
      ({ ctx, page } = await load(j.html, h));
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      // the first and last rows' thumbnails, for the check below
      const probes = j.rows ? await page.evaluate(ids => ids.flatMap(i => [...document.querySelectorAll(`.row[data-i="${i}"] .thumb img`)].map((im, k) => { const r = im.getBoundingClientRect(); return { i, k, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })), [...new Set([j.rows[0], j.rows[j.rows.length - 1]])]) : [];
      const path = join(tmp, j.file);
      dbg('sheet', j.file, `${PW}x${h}`, JSON.stringify(probes));
      await page.screenshot({ path, clip: { x: 0, y: 0, width: PW, height: h } });
      await ctx.close();
      await checkSheet(path, probes, B, out, { width: PW, height: h, name: j.file });
      checks[j.file] = { width: PW, height: h, probes };
      files.push(j.file);
    }
  } finally { await browser.close().catch(() => null); }
  for (const f of files) copyFileSync(join(tmp, f), join(out, f));
  return checks;
}
// render check (exported for QA): every probed thumbnail in the PNG looks like its source frame over its full height
// (right part, clear of the timecode label), and the page ends on the plain footer — a repeated or shifted tile throws
export async function checkSheet(path, probes, B, out, { width, height, name }) {
  for (const pr of probes) {
    const inset = { x: pr.x + Math.round(pr.w * .55), y: pr.y + 3, w: Math.round(pr.w * .4), h: pr.h - 6 };
    const src = join(out, B.shots[pr.i].thumbs[['start', 'mid', 'end'][pr.k]].file);
    const a = await fingerprint(path, inset), b = await fingerprint(src, srcCrop(B.thumbSize, pr, inset));
    let d = 0; for (let q = 0; q < 64; q++) d += Math.abs(a[q] - b[q]);
    if (d / 64 > 18) throw new Error(`contact sheet ${name}: shot #${pr.i + 1}'s thumbnail is not where the page put it (render check: mean difference ${(d / 64).toFixed(1)} levels) — not written`);
  }
  const foot = await fingerprint(path, { x: 0, y: height - 14, w: width, h: 12 });
  if (Math.min(...foot) < 150) throw new Error(`contact sheet ${name}: the bottom of the page isn't the footer (render check) — not written`);
}
// the same inset region in the source thumbnail's own pixels ([tw, th] = the JPEG's size)
function srcCrop([tw, th], pr, inset) {
  const sx = tw / pr.w, sy = th / pr.h;
  return { x: Math.round((inset.x - pr.x) * sx), y: Math.round((inset.y - pr.y) * sy), w: Math.round(inset.w * sx), h: Math.round(inset.h * sy) };
}

// beats.yaml skeleton: one headline placeholder per reference shot, on our own composed music at the reference tempo
const TO_OUT = { 'whip-left': 'whip-left', 'whip-right': 'whip-right', 'whip-up': 'whip-up', 'whip-down': 'whip-down', 'zoom-in': 'zoom-in', 'zoom-out': 'zoom-out', blur: 'blur' };
function draftTiming(B) {
  // beats: lengths only on a pulse that is confident and runs through most of the reel (≥ 2 of 3 sections)
  const Tm = B.audio && B.audio.tempo, confident = !!(Tm && Tm.bpm != null && Tm.confidence >= .6);
  let bpm = confident ? Tm.bpm : 120;
  while (bpm > 180) bpm /= 2; while (bpm < 60) bpm *= 2;
  bpm = Math.abs(bpm - Math.round(bpm)) < .15 ? Math.round(bpm) : Math.round(bpm * 10) / 10;
  const beat = 60 / bpm;
  // the draft's grid starts at 0; shift the reference so its beats land on our grid lines (|shift| ≤ half a beat)
  const shift = confident ? ((((Tm.phase % beat) + beat * 1.5) % beat) - beat / 2) : 0;
  const snap = s => Math.round(s * 60) / 60, half = .5 / 60;
  let t = 0; const rows = [];
  B.shots.forEach((s, i) => {
    const target = (i === B.shots.length - 1 ? B.probe.duration : B.shots[i + 1].start) - shift;
    // beats: only where the reference cut itself lands on the beat (±1 frame) — an off-beat cut keeps its exact time as sec:
    const endT = i === B.shots.length - 1 ? B.probe.duration : B.shots[i + 1].start, tol = 1 / B.probe.fps + 1e-6;
    const inPulse = (Tm && Tm.pulsed || [[0, Infinity]]).some(([a, b]) => endT >= a - .01 && endT <= b + .01);
    const onBeat = confident && inPulse && Math.abs(((endT - Tm.phase) / Tm.beat - Math.round((endT - Tm.phase) / Tm.beat)) * Tm.beat) <= tol;
    let len = null;
    if (onBeat) {
      const g0 = Math.max(0, Math.ceil((t - half) / beat)) * beat, N = Math.round((target - g0) / beat), end = snap(g0 + N * beat);
      if (N >= 1 && Math.abs((end - t) - s.dur) <= .15 * s.dur) { len = { beats: N }; t = end; }
    }
    if (!len) { let sec = r3(target - t); if (!(sec >= 2 / 30)) sec = r3(s.dur); len = { sec }; t = snap(t + sec); }
    rows.push({ ...len, end: t, target: r3(target) });
  });
  let octave = confident && Tm.octave ? Tm.octave.bpm : null;
  if (octave != null) { while (octave > 180) octave /= 2; while (octave < 60) octave *= 2; octave = Math.round(octave * 10) / 10; if (octave === bpm) octave = null; }
  return { bpm, beat, shift: r3(shift), confident, rows, octave, octaveRel: confident && Tm.octave ? Tm.octave.rel : null };
}
function draftYaml(B, D) {
  const lines = [
    `# DRAFT timing skeleton from the reference "${B.source.name}" — a starting point to EDIT, not a copy.`,
    `# Borrow pacing and structure only: never the reference's footage, audio, music or copy (see breakdown.md).`,
    `# One placeholder headline per reference shot: give each a real block + our own copy ("Recreate with" in breakdown.md),`,
    `# merge or drop shots freely, then save it as the job's beats.yaml (this file is never used as one by itself).`,
    D.confident ? `# Lengths: beats: N where the reference cut lands on its beat (±1 frame) at ${D.bpm} BPM (its grid shifted ${D.shift} s onto ours), else the exact sec:.`
      : `# Lengths in sec: — the reference has no confident tempo all the way through, so ${D.bpm} BPM is a placeholder; set ours, then convert to beats:.`,
    `title: ${JSON.stringify('Draft from ' + B.source.stem)}`,
    `slug: ${JSON.stringify(('ref-' + slugify(B.source.stem)).slice(0, 40))}`,
    `aspects: [${B.probe.aspect}]`,
    `brand: {name: TODO}            # copy brand: from the job's real beats.yaml`,
    `music: {style: playful, bpm: ${D.bpm}}   # our own composed music${D.confident ? ' at the reference tempo' : ''} — never the reference's audio${D.octave ? ` (or ${D.octave} if it feels ${D.octaveRel} time)` : ''}`,
    `shots:`,
  ];
  B.shots.forEach((s, i) => {
    const id = `r${pad2(i + 1)}`, nxt = B.shots[i + 1], ref = nxt ? nxt.in.type : 'cut', out = TO_OUT[ref] || 'cut';
    const len = D.rows[i].beats != null ? `beats: ${D.rows[i].beats}` : `sec: ${D.rows[i].sec}`;
    const note = `ref ${s.tcIn}–${s.tcOut} — describe & pick a block`;
    const cmt = nxt && !TO_OUT[ref] && ref !== 'cut' ? `   # reference: ${ref}${nxt.in.detail ? ` (${nxt.in.detail})` : ''} → cut` : '';
    lines.push(`  - {id: ${id}, block: headline, ${len}, text: ${JSON.stringify(`TODO ${id}`)}, out: ${out}, note: ${JSON.stringify(note)}}${cmt}`);
  });
  return lines.join('\n') + '\n';
}
// compile the draft with the skill itself (read-only import) and measure how far its cuts sit from the reference's
async function checkDraft(yamlText, D, tmp) {
  const job = join(tmp, 'draft-job'); mkdirSync(job, { recursive: true });
  writeFileSync(join(job, 'beats.yaml'), yamlText);
  try {
    const { loadSpec } = await import('./spec.mjs'), { compile } = await import('./timeline.mjs');
    const tl = compile(await loadSpec(job));
    const drift = tl.shots.map((s, i) => Math.abs(s.end - D.rows[i].target));
    return { ok: true, shots: tl.shots.length, dur: r3(tl.dur), maxDriftMs: Math.round(Math.max(...drift.slice(0, -1), 0) * 1000), warnings: tl.warns.length };
  } catch (e) { return { ok: false, error: String(e.message || e).split('\n').slice(0, 6).join('\n') }; }
}

function mdReport(B) {
  const S = B.stats, A = B.audio, Tm = A && A.tempo, P = B.probe;
  const L = [`# Reference breakdown — ${B.source.name}`, '',
    `> Pacing and structure only: never the reference's footage, audio, music or copy. Fill **What happens** and **Recreate with** after reading the sheets, then **What to borrow**.`, '',
    `- **Source**: \`${B.source.file}\` · ${P.W}×${P.H} (${P.aspect}${P.rotation ? `, rotated ${P.rotation}°` : ''}) · ${P.fps.toFixed(3).replace(/\.?0+$/, '')} fps${P.vfr ? ' (VFR)' : ''} · ${P.duration.toFixed(2)} s · ${P.frames} frames · audio: ${P.hasAudio ? 'yes' : 'none'}`,
    `- **Shots**: ${S.shots} · median ${S.median.toFixed(2)} s · mean ${S.mean.toFixed(2)} s · shortest ${S.min.toFixed(2)} s (#${S.shortest}) · longest ${S.max.toFixed(2)} s (#${S.longest}) · ${S.cutsPerSec.toFixed(2)} cuts/s · ${Math.round(S.shortShare * 100)} % of shots under 0.5 s`,
    `- **Transitions**: ${Object.entries(S.transitions).map(([k, v]) => `${v} ${k}`).join(' · ') || 'none (one shot)'}${B.flashes.length ? ` · flashes inside shots: ${B.flashes.map(f => `${f.t.toFixed(2)} s (${f.color}, ${f.frames} fr)`).join(', ')}` : ''}${B.fades.length ? ` · fades: ${B.fades.map(f => `${f.kind} ${f.span[0].toFixed(2)}–${f.span[1].toFixed(2)} s`).join(', ')}` : ''}${B.pans.length ? ` · in-shot camera moves: ${B.pans.map(f => `${f.kind} ${f.dir} ${f.t.toFixed(2)} s`).join(', ')}` : ''}`,
    !A || !A.present ? '- **Music**: no audio stream' : Tm && Tm.bpm != null
      ? `- **Music**: ${Tm.bpm} BPM${tempoWhere(Tm)} (confidence ${Tm.confidence}${Tm.octave ? `; **or ${Tm.octave.bpm} if it's felt in ${Tm.octave.rel} time** — listen and pick` : Tm.ambiguous ? '; half/double ambiguous — listen and pick' : ''}) · first beat ${Tm.firstBeat.toFixed(3)} s · ${A.loudness.I != null ? `${A.loudness.I} LUFS integrated, true peak ${A.loudness.TP} dBTP` : 'loudness n/a'}${Tm.sections && Tm.sections.some(x => x.bpm == null) ? ` · pulse by section: ${Tm.sections.map(x => `${x.from}–${x.to} s ${x.bpm ?? 'none'}`).join(', ')}` : ''}`
      : `- **Music**: tempo none — ${Tm ? Tm.reason : A.reason}${A.loudness && A.loudness.I != null ? ` · ${A.loudness.I} LUFS` : ''}`,
    B.alignment ? `- **Cuts on the beat**: ${B.alignment.cuts ? `${B.alignment.onBeat} of ${B.alignment.cuts} cuts${B.alignment.outside ? ' inside the pulsed stretch' : ''} land within one frame (±${Math.round(1000 / P.fps)} ms) of a beat — chance alone would give ≈ ${Math.round(B.alignment.chance * 100)} %${B.alignment.onHalf ? `; ${B.alignment.onHalf} more on a half-beat` : ''}; median distance ${B.alignment.medianMs} ms` : 'none of the cuts fall where there is a pulse'}${B.alignment.outside ? `; the other ${B.alignment.outside} cuts are where there's no steady pulse — n/a` : ''}` : '- **Cuts on the beat**: n/a (no tempo)',
    `- **Files**: ${B.outputs.sheets.join(', ')} (${B.params.perPage} shots per sheet) · overview.png · thumbs/ · breakdown.json · beats-draft.yaml (${B.draft.check.ok ? `${B.draft.check.shots} shots, compiles; ${B.draft.confident ? `beats at ${B.draft.bpm} BPM` : 'sec lengths'}, max drift ${B.draft.check.maxDriftMs} ms from the reference cuts` : `DOES NOT COMPILE: ${B.draft.check.error}`})`,
    '', '## Shots', '', '| # | In → out | Dur | In | Beat | What happens | Recreate with (block) |', '|---|---|---|---|---|---|---|'];
  B.shots.forEach((s, i) => L.push(`| ${i + 1} | ${s.tcIn} → ${s.tcOut} | ${s.dur.toFixed(2)} s | ${s.in.type}${s.in.conf === 'low' ? ' (?)' : ''}${s.events.length ? ` · ${s.events.map(e => e.label).join('; ')}` : ''} | ${s.onBeat || '–'} |  |  |`));
  L.push('', '## What to borrow', '', '_Claude fills this after reading the sheets: 3–5 bullets on pacing, structure and transition grammar (what we keep, what we change). Nothing of their footage, audio or copy._', '');
  return L.join('\n');
}

// ─────────────────────────────── entry points ───────────────────────────────
const OWN = ['breakdown.json', 'breakdown.md', 'breakdown.html', 'overview.png', 'beats-draft.yaml'];
export async function breakdown({ file, out, threshold = .3, minShot = .2, perPage = 8 }) {
  if (!file) throw new UserError('breakdown: give the video file');
  if (!out) throw new UserError('breakdown: give an output folder (--out DIR)');
  file = resolve(String(file)); out = resolve(String(out));
  threshold = Number(threshold); minShot = Number(minShot); perPage = Math.round(Number(perPage));
  if (!(threshold > 0 && threshold < 1)) throw new UserError('--threshold must be between 0 and 1 (ffmpeg scene score; default 0.3)');
  if (!(minShot >= 0 && minShot <= 5)) throw new UserError('--min-shot must be 0–5 seconds (default 0.2)');
  if (!(perPage >= 1 && perPage <= 40)) throw new UserError('--per-page must be 1–40 (default 8)');
  const P = probeMedia(file);
  if (!P.video) throw new UserError(`${basename(file)} has no video stream${P.audio ? ' (it is audio only — for a music track use --tempo)' : ''}`);
  if (existsSync(out) && existsSync(join(out, 'beats.yaml'))) throw new UserError(`${out} holds a beats.yaml — that's a job folder; write the breakdown to its reference/<name>/ subfolder instead`);
  if (resolve(out) === resolve(file) || (existsSync(out) && !statSync(out).isDirectory())) throw new UserError(`--out must be a folder (got ${out})`);
  const tmp = makeTmp(), t0 = Date.now();
  const onSig = sig => { rmSync(tmp, { recursive: true, force: true }); process.exit(sig === 'SIGINT' ? 130 : 143); };   // Ctrl-C leaves no temp folder
  process.once('SIGINT', onSig); process.once('SIGTERM', onSig);
  try {
    const [V, x] = await Promise.all([decodeVideo(P, tmp), P.audio ? decodeAudio(file, P.audio.index).catch(e => ({ error: e })) : null]);
    const span = V.t[V.n - 1];
    const dts = []; for (let k = 1; k < V.n; k++) if (V.t[k] > V.t[k - 1]) dts.push(V.t[k] - V.t[k - 1]);
    const frameDur = median(dts) || 1 / (P.video.rFps || 30), fpsM = 1 / frameDur;
    const vfr = dts.filter(d => Math.abs(d - frameDur) > .1 * frameDur).length > .02 * dts.length;
    // frames per second: the nominal rate when it matches, else (VFR) the average over the file — the rate that turns
    // seconds into frame counts for every window below
    const fps = !vfr && P.video.rFps && Math.abs(P.video.rFps - fpsM) / fpsM < .05 ? P.video.rFps : vfr && span > 0 ? (V.n - 1) / span : fpsM;
    const duration = span + frameDur;
    if (V.n < 10 || duration < 1) throw new UserError(`${basename(file)} is too short for a breakdown (${duration.toFixed(2)} s, ${V.n} frame${V.n === 1 ? '' : 's'}; need ≥ 1 s and ≥ 10 frames)`);
    const F = analyzeFrames(V); F.fps = fps; F.frameDur = frameDur;
    const det = detect(F, { threshold, minShot });
    // timecodes count frames at the nominal rate (an editor's timeline), also for VFR sources; seconds stay the truth
    // (ffprobe's r_frame_rate can be a guess like 45 for jittered stamps, the average can be 20 after dropped frames:
    // take whichever sits on a standard rate, r_frame_rate first)
    const STD = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 120], isStd = x => x && STD.some(r => Math.abs(x - r) / r < .01);
    const nominal = !vfr ? fps : [P.video.rFps, P.video.avgFps, fps].find(isStd) || fps;
    const fr = Math.round(vfr ? nominal : fps), tAt = k => k >= V.n ? duration : V.t[k];
    // shots
    const bounds = [0, ...det.cuts.map(c => c.k), V.n];
    const shots = [];
    for (let i = 0; i + 1 < bounds.length; i++) {
      const a = bounds[i], b = bounds[i + 1], start = tAt(a), end = tAt(b), c = i ? det.cuts[i - 1] : null;
      const tr = c ? { type: c.type, conf: c.conf, detail: c.detail, scene: c.scene, diff: c.diff, ext: c.ext, ncc: c.ncc, span: c.k1 > c.k0 ? [r3(tAt(c.k0)), r3(tAt(c.k1))] : null, ...(c.merged ? { merged: c.merged } : {}) } : { type: 'start', conf: 'high', detail: null };
      const evs = [...det.flashes.filter(f => f.k >= a && f.k < b).map(f => ({ type: 'flash', t: f.t, label: `${f.color} flash ${f.t.toFixed(2)} s (${f.frames} fr)` })),
        ...det.fades.filter(f => f.k >= a && f.k < b).map(f => ({ type: f.kind, t: f.t, span: f.span, label: `${f.kind} ${f.span[0].toFixed(2)}–${f.span[1].toFixed(2)} s` })),
        ...det.pans.filter(f => f.k >= a && f.k < b).map(f => ({ type: f.kind === 'zoom' ? 'zoom-move' : 'whip-pan', t: f.t, dir: f.dir, label: `${f.kind} ${f.dir} ${f.t.toFixed(2)} s (${f.dur.toFixed(2)} s, in-shot)` }))].sort((x, y) => x.t - y.t);
      const mid = (() => { const tm = (start + end) / 2; let k = a; while (k + 1 < b && V.t[k + 1] <= tm) k++; return k; })();
      const ks = { start: Math.min(b - 1, a + 2), mid, end: Math.max(a, b - 3) };
      shots.push({ i: i + 1, start: r4(start), end: r4(end), dur: r4(end - start), frames: b - a, startFrame: a, endFrame: b - 1, tcIn: timecode(start, fr), tcOut: timecode(end, fr), in: tr, events: evs,
        thumbs: Object.fromEntries(Object.entries(ks).map(([w, k]) => [w, { frame: k, t: r4(V.t[k]), tc: timecode(V.t[k], fr), file: `thumbs/${pad2(i + 1)}-${w}.jpg` }])) });
    }
    // audio: tempo, loudness, alignment
    let audio = { present: !!P.audio };
    if (P.audio) {
      if (x && x.error) audio = { present: true, reason: `audio could not be decoded: ${x.error.message.split('\n')[0]}`, tempo: null };
      else {
        const aOff = (P.audio.start - P.fmtStart) - V.pts0;                  // audio sample 0 on the video timeline
        const tempo = analyzeTempo(x, ASR);
        if (tempo.bpm != null) {
          const z = sections(x); tempo.sections = z && z.map(q => ({ ...q, from: r3(q.from + aOff), to: r3(q.to + aOff) }));
          // where the beat grid holds: the sections whose own tempo is this one (or its octave); all of it when the reel
          // is too short for sections or no section agrees on its own
          const same = b => b != null && [1, 2, .5].some(f => Math.abs(b * f - tempo.bpm) / tempo.bpm < .04);
          const secs = tempo.sections || [], ps = secs.map((q, i) => same(q.bpm) ? [i ? q.from : 0, i === secs.length - 1 ? duration : q.to] : null).filter(Boolean);
          const pulsed = []; for (const r of ps.length ? ps : [[0, duration]]) { const l = pulsed[pulsed.length - 1]; if (l && r[0] <= l[1] + .05) l[1] = r[1]; else pulsed.push([...r]); }
          tempo.pulsed = pulsed.map(r => r.map(r3)); tempo.coverage = r3(pulsed.reduce((a, r) => a + r[1] - r[0], 0) / duration);
        }
        if (tempo.bpm != null) { tempo.beats = tempo.beats.map(b => r4(b + aOff)); for (const k of ['phase', 'firstBeat', 'downbeat', 'musicStart']) if (tempo[k] != null) tempo[k] = r4(tempo[k] + aOff); tempo.phase = r4(((tempo.phase % tempo.beat) + tempo.beat) % tempo.beat); }
        audio = { present: true, offset: r4(aOff), silent: /silent/.test(tempo.reason || ''), tempo, loudness: tempo.reason && /silent/.test(tempo.reason) ? { I: null, TP: null, LRA: null } : await loudness(file, P.audio.index) };
      }
    }
    const Tm = audio.tempo;
    let alignment = null;
    if (Tm && Tm.bpm != null && shots.length > 1) {
      const beat = Tm.beat, tol = 1 / fps + 1e-6;
      const inPulse = t => (Tm.pulsed || [[0, Infinity]]).some(([a, b]) => t >= a - .01 && t <= b + .01);
      const all = shots.slice(1).map(s => {
        const u = (s.start - Tm.phase) / beat, db = (u - Math.round(u)) * beat, dh = (u - Math.floor(u) - .5) * beat;
        return { t: s.start, pulse: inPulse(s.start), beatMs: Math.round(db * 1000), halfMs: Math.round(dh * 1000), onBeat: Math.abs(db) <= tol, onHalf: Math.abs(db) > tol && Math.abs(dh) <= tol };
      });
      all.forEach((r, i) => {
        const s = shots[i + 1];
        if (!r.pulse) { s.onBeat = 'no pulse'; return; }                           // no grid to measure against there
        s.beat = { distMs: r.beatMs, halfMs: r.halfMs }; s.onBeat = r.onBeat ? 'on beat' : r.onHalf ? 'half-beat' : `${r.beatMs > 0 ? '+' : ''}${r.beatMs} ms`;
      });
      shots.forEach(s => { if (inPulse(s.start)) s.beats = r3(s.dur / beat); });
      const rows = all.filter(r => r.pulse);
      alignment = { cuts: rows.length, outside: all.length - rows.length, onBeat: rows.filter(r => r.onBeat).length, onHalf: rows.filter(r => r.onHalf).length, toleranceMs: Math.round(tol * 1000), chance: r3(Math.min(1, 2 * tol / beat)), medianMs: rows.length ? Math.round(median(rows.map(r => Math.abs(r.beatMs)))) : null, pulsed: Tm.pulsed, cutsDetail: all };
    }
    // stats
    const durs = shots.map(s => s.dur), trs = {};
    for (const s of shots.slice(1)) trs[s.in.type] = (trs[s.in.type] || 0) + 1;
    const iMin = durs.indexOf(Math.min(...durs)), iMax = durs.indexOf(Math.max(...durs));
    const stats = { shots: shots.length, median: r3(median(durs)), mean: r3(mean(durs)), min: r3(durs[iMin]), max: r3(durs[iMax]), shortest: iMin + 1, longest: iMax + 1,
      cutsPerSec: r3((shots.length - 1) / duration), shortShare: r3(durs.filter(d => d < .5).length / durs.length), transitions: trs };
    const aspect = aspectClass(P.video.W, P.video.H);
    const B = {
      version: 1, generatedAt: new Date().toISOString(), tool: 'product-launch-sting/video/lib/breakdown.mjs',
      source: { file, name: basename(file), stem: basename(file, extname(file)), bytes: P.size },
      params: { threshold, minShot, perPage },
      probe: { W: P.video.W, H: P.video.H, codedW: P.video.codedW, codedH: P.video.codedH, rotation: P.video.rotation, aspect, ratio: r4(P.video.W / P.video.H), fps: r4(fps), rFps: P.video.rFps, avgFps: P.video.avgFps && r4(P.video.avgFps), vfr, tcFps: fr, duration: r4(duration), frames: V.n, hasAudio: !!P.audio, codec: P.video.codec },
      stats, shots, flashes: det.flashes, fades: det.fades, pans: det.pans, audio, alignment,
      layout: { ...layoutFor(aspect, P.video.W / P.video.H), r: P.video.W / P.video.H },
      frames: { note: 'per frame: t (s), ffmpeg scene score, motion-compensated luma difference to the previous frame (0–1)', t: Array.from(V.t, r4), scene: Array.from(F.scene, r3), diff: Array.from(F.mc, r3) },
    };
    // files: clear what a previous run left, then write
    mkdirSync(out, { recursive: true });
    for (const f of readdirSync(out)) if (OWN.includes(f) || /^sheet-\d+\.png$/.test(f)) rmSync(join(out, f), { force: true });
    rmSync(join(out, 'thumbs'), { recursive: true, force: true }); mkdirSync(join(out, 'thumbs'));
    const r = B.layout.r, TS = r >= 1 ? [480, even(480 / r)] : [even(480 * r), 480];
    B.thumbSize = TS;
    const want = shots.flatMap(s => ['start', 'mid', 'end'].map(w => s.thumbs[w].frame));
    const got = await grabFrames(P, want, TS, tmp);
    shots.forEach((s, i) => ['start', 'mid', 'end'].forEach((w, j) => copyFileSync(got[i * 3 + j], join(out, s.thumbs[w].file))));
    // draft beats.yaml (compiled by the skill for a check)
    const D = draftTiming(B), yamlText = draftYaml(B, D);
    B.draft = { file: 'beats-draft.yaml', bpm: D.bpm, confident: D.confident, shift: D.shift, check: await checkDraft(yamlText, D, tmp) };
    writeFileSync(join(out, 'beats-draft.yaml'), yamlText);
    const sheets = Array.from({ length: Math.ceil(shots.length / perPage) }, (_, p) => `sheet-${pad2(p + 1)}.png`);
    B.outputs = { json: 'breakdown.json', md: 'breakdown.md', html: 'breakdown.html', sheets, overview: 'overview.png', thumbs: 'thumbs/', draft: 'beats-draft.yaml' };
    const thumbData = shots.map(s => ['start', 'mid', 'end'].map(w => 'data:image/jpeg;base64,' + readFileSync(join(out, s.thumbs[w].file)).toString('base64')));
    writeFileSync(join(out, 'breakdown.html'), sheetHtml(B, thumbData));
    B.outputs.renderCheck = await screenshotSheets(out, B, thumbData, tmp);   // where each sheet's probed thumbnails sit (QA replays it)
    B.seconds = r3((Date.now() - t0) / 1000);
    writeFileSync(join(out, 'breakdown.json'), JSON.stringify(B, null, 1));
    writeFileSync(join(out, 'breakdown.md'), mdReport(B));
    return B;
  } finally { process.off('SIGINT', onSig); process.off('SIGTERM', onSig); rmSync(tmp, { recursive: true, force: true }); }
}

export async function tempo(file) {
  file = resolve(String(file));
  const P = probeMedia(file);
  if (!P.audio) throw new UserError(`${basename(file)} has no audio stream`);
  const x = await decodeAudio(file, P.audio.index);
  const T = analyzeTempo(x, ASR), len = x.length / ASR;
  if (T.bpm != null) T.sections = sections(x);
  const res = { file, name: basename(file), duration: r3(len), ...T };
  if (T.bpm == null) return { ...res, snippet: null };
  let bpm = T.bpm; const notes = [];
  if (bpm > 180 || bpm < 60) { const b0 = bpm; while (bpm > 180) bpm /= 2; while (bpm < 60) bpm *= 2; notes.push(`${b0} BPM folded to ${bpm} for the skill's 60–180 range`); }
  bpm = Math.abs(bpm - Math.round(bpm)) < .08 ? Math.round(bpm) : Math.round(bpm * 100) / 100;
  // start on the first downbeat when the bar accent is clear, else on the first beat (the bar is then a guess)
  const sureBar = T.downbeatConfidence >= .1, start = sureBar ? T.downbeat : T.firstBeat;
  // music.start = seconds into the file at film time 0; music.downbeat = film time of the first downbeat (GUIDE: beats.yaml)
  res.snippet = `music: {style: track, file: assets/${basename(file)}, bpm: ${bpm}, start: ${start}, downbeat: 0}`;
  res.alternative = start >= .25 && start <= 30 ? `music: {style: track, file: assets/${basename(file)}, bpm: ${bpm}, start: 0, downbeat: ${start}}   # keeps the ${start} s intro` : null;
  res.covers = r3(len - start);
  res.start = start;
  res.notes = [...notes, `the film opens on the track's first ${sureBar ? 'downbeat' : 'beat'} (${start} s into the file); from there the track covers ${r3(len - start)} s — a cut must not be longer`,
    !sureBar ? `the bar's downbeat isn't clear (accent confidence ${T.downbeatConfidence}); if the bar feels shifted, add one beat (${T.beat} s) to start — up to three times` : null,
    T.ambiguous ? 'half/double tempo is ambiguous — listen and pick' : null, 'copy the track into the job\'s assets/ first'].filter(Boolean);
  return res;
}

// ─────────────────────────────── printing (shared with lv.mjs) ───────────────────────────────
// where lv.mjs --job DIR --breakdown FILE writes: DIR/reference/<file name, slugified>/
export const referenceDir = (job, file) => join(resolve(String(job)), 'reference', slugify(basename(String(file), extname(String(file)))) || 'reel');
export function formatBreakdown(B, out) {
  const S = B.stats, Tm = B.audio.tempo, P = B.probe;
  return [`${B.source.name}: ${P.duration.toFixed(2)} s · ${P.W}×${P.H} (${P.aspect}) · ${P.fps.toFixed(2)} fps${P.vfr ? ' VFR' : ''}`,
    `  ${S.shots} shots · median ${S.median.toFixed(2)} s · ${S.cutsPerSec.toFixed(2)} cuts/s · ${Math.round(S.shortShare * 100)} % under 0.5 s · ${Object.entries(S.transitions).map(([k, v]) => `${v} ${k}`).join(', ') || 'no cuts'}${B.flashes.length ? ` · ${B.flashes.length} flash(es)` : ''}${B.pans.length ? ` · ${B.pans.length} in-shot move(s)` : ''}`,
    `  ${!B.audio.present ? 'no audio' : Tm && Tm.bpm != null ? `${Tm.bpm} BPM${tempoWhere(Tm)} (confidence ${Tm.confidence}${Tm.octave ? `; or ${Tm.octave.bpm} in ${Tm.octave.rel} time` : ''})${B.alignment ? ` · ${B.alignment.onBeat}/${B.alignment.cuts} cuts on the beat (chance ${Math.round(B.alignment.chance * 100)} %)${B.alignment.outside ? `, ${B.alignment.outside} more where there's no pulse` : ''}` : ''}` : `tempo none — ${(Tm && Tm.reason) || B.audio.reason}`}`,
    `  draft: ${B.draft.check.ok ? `beats-draft.yaml compiles (${B.draft.check.shots} shots, max drift ${B.draft.check.maxDriftMs} ms)` : `beats-draft.yaml FAILED to compile: ${B.draft.check.error}`}`,
    `→ ${out}/breakdown.md · ${B.outputs.sheets.join(' ')} · overview.png (${B.seconds} s) — Read the sheets, fill breakdown.md`].join('\n');
}
export function formatTempo(r) {
  if (r.bpm == null) return `${r.name}: tempo none — ${r.reason}`;
  return [`${r.name}: ${r.bpm} BPM (confidence ${r.confidence}${r.octave ? `; or ${r.octave.bpm} in ${r.octave.rel} time` : r.ambiguous ? ', half/double ambiguous' : ''}) · beat ${r.beat} s · first beat ${r.firstBeat} s · first downbeat ${r.downbeat} s (bar confidence ${r.downbeatConfidence})`,
    ...(r.sections ? [`  pulse by section: ${r.sections.map(x => `${x.from}–${x.to} s ${x.bpm ?? 'none'}`).join(' · ')}`] : []),
    ...(r.alternates.length ? [`  alternates: ${r.alternates.map(a => `${a.bpm} (${a.rel}, acf ${a.acf})`).join(' · ')}`] : []),
    '', r.snippet, ...(r.alternative ? [r.alternative] : []), '', ...r.notes.map(n => '  · ' + n)].join('\n');
}

// ─────────────────────────────── CLI ───────────────────────────────
const isMain = (() => { try { return process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) {
  const argv = process.argv.slice(2);
  const opt = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
  const die = (m, code = 1) => { console.error('\n✗ ' + m); process.exit(code); };
  (async () => {
    if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
      console.log('node breakdown.mjs <video> --out <dir> [--threshold 0.3] [--min-shot 0.2] [--per-page 8]\nnode breakdown.mjs --tempo <audio-or-video> [--json]'); return;
    }
    if (argv.includes('--tempo')) {
      const f = opt('--tempo'); if (!f || f.startsWith('--')) die('--tempo needs a file', 2);
      const r = await tempo(f);
      console.log(argv.includes('--json') ? JSON.stringify(r, null, 1) : formatTempo(r));
      return;
    }
    const known = new Set(['--out', '--threshold', '--min-shot', '--per-page']);
    const file = argv.find((a, i) => !a.startsWith('--') && !(i && known.has(argv[i - 1])));
    const B = await breakdown({ file, out: opt('--out'), threshold: opt('--threshold', .3), minShot: opt('--min-shot', .2), perPage: opt('--per-page', 8) });
    console.log(formatBreakdown(B, resolve(opt('--out'))));
  })().catch(e => die(e instanceof UserError ? e.message : (e.stack || String(e))));
}
