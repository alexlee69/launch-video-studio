// QA for a rendered film (one cut × one aspect) and for clips. Every check prints PASS/FAIL (INFO/WARN never fail);
// film results go to out/<cut>/<aspect>/qa.json. Never ship a FAIL and never loosen a threshold to get a pass.
//   video     W×H, 60 fps, frame count, h264 yuv420p, bt709 primaries/transfer/matrix, tv range
//   shots     the renderer's log: the shot behind every frame changes exactly at the timeline's cut indices
//   cut       hard cuts ("out: cut") are one-frame spikes in luma difference (≥ 1.25× every neighbour within 3 frames);
//             moving transitions (whip/zoom/blur/drift and the cross-cuts) are INFO — their boundary is proven by the shot log
//   fresh     mux.json (written at mux time) says the mp4 holds the current frames (render.json prints) and master;
//   audio     the soundtrack muxed into the mp4 was built from this timeline + audio code (its fingerprint)
//   freeze    no run of ≥ 4 identical PNG frames outside declared holds. One Chrome page draws a contiguous run of
//             frames, so inside a page a frozen frame is bit-identical; across a page seam (worker hand-over, or a --range
//             render meeting older frames) raster noise is ±1–2, so a seam pair counts as still at ≤ 2. Holds are
//             reported as verified still
//   content   every frame differs from a background-only render of its own shot in ≥ CONTENT_PX thumbnail pixels
//             (1/10 scale, by more than CONTENT_DELTA luma) — a blank frame can't pass on a busy (grid/dark) background
//             (the reference hides block content AND bg footage: footage is picture content; bars and transitions stay)
//   text      at every shot's hero frame: no text clipped by the frame, none under 18 px (UI mocks exempt);
//             WARN outside the safe area (9:16: platform-UI-safe) or under 26 px
//   loudness  the mp4's audio: −14 ± 0.2 LUFS, true peak ≤ −1 dBTP (INFO when the soundtrack is deliberately silent)
//   duration  master.wav has exactly the timeline's samples; the mp4's audio matches
//   sfx       every cue's onset within 1.5 ms (ticks, clicks) or 3 ms (pops, chimes, hits — 2 ms attack), measured on its
//             QA lane (a stem where the previous cue has finished ringing); cues buried in the full SFX mix are INFO
//   whoosh    on the whoosh stem: each whoosh envelope peaks within 12 ms of its cut (20 ms window)
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ASPECTS, SR, sh, measureLoudness } from './common.mjs';
import { fileSha } from './fingerprint.mjs';
import { letterboxBar } from '../engine/kit.js';

export const FREEZE_RUN = 3;          // ≥ 3 identical pairs in a row = 4 identical frames (~1/15 s at 60 fps)
export const CONTENT_DELTA = 12;      // thumbnail luma difference from the bg-only render that counts as "something there"
export const CONTENT_PX = 3;          // … in at least this many thumbnail pixels (a 40 px logo is ~16 of them)

function frameStats(input, vf, keys) {
  const tmp = mkdtempSync(join(tmpdir(), 'lv-qa-')), f = join(tmp, 'm.txt');
  try {
    const r = sh('ffmpeg', ['-hide_banner', '-v', 'error', ...input, '-vf', `${vf},metadata=mode=print:file=${f}`, '-f', 'null', '-']);
    if (r.status) throw new Error(r.stderr);
    const rows = []; let cur = null;
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^frame:(\d+)/);
      if (m) { cur = { n: Number(m[1]) }; rows.push(cur); continue; }
      const a = line.match(/lavfi\.signalstats\.(\w+)=([\d.]+)/);
      if (a && cur && keys.includes(a[1])) cur[a[1]] = Number(a[2]);
    }
    return rows;
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
// runs [first, last] of ≥ FREEZE_RUN consecutive still pairs (index k = pair frame k-1 → frame k). Still = pixel-identical
// when both frames came from the same Chrome page; across a page seam (pages[k] ≠ pages[k-1]) Chrome's raster noise is
// ±1–2 code values, so a seam pair counts as still at YMAX ≤ 2 — a short freeze straddling a seam is still one run.
function freezeRuns(input, pages = null) {
  const rows = frameStats(input, 'tblend=all_mode=difference,signalstats', ['YMAX']);
  const seam = k => !!pages && pages[k] !== pages[k - 1];
  const stillIdx = rows.filter(r => r.YMAX === 0 || (seam(r.n + 1) && r.YMAX <= 2)).map(r => r.n + 1), runs = [];
  let a = null, prev = null;
  for (const k of [...stillIdx, Infinity]) {
    if (a !== null && k === prev + 1) { prev = k; continue; }
    if (a !== null && prev - a + 1 >= FREEZE_RUN) runs.push([a, prev]);
    a = k; prev = k;
  }
  return { runs, stillIdx };
}
// 1/10-scale grey thumbnails as one buffer (frames × w × h)
function thumbs(input, W, H) {
  const w = Math.round(W / 10), h = Math.round(H / 10);
  const r = sh('ffmpeg', ['-hide_banner', '-v', 'error', ...input, '-vf', `scale=${w}:${h}:flags=area,format=gray`, '-f', 'rawvideo', '-'], { encoding: 'buffer' });
  if (r.status) throw new Error(String(r.stderr));
  return { buf: r.stdout, w, h, n: r.stdout.length / (w * h) };
}
// every frame against the background-only render of the same frame (same camera state); refsInput is that sequence
export function contentCheck({ framesInput, refsInput, W, H }) {
  const T = thumbs(framesInput, W, H), R = thumbs(refsInput, W, H), px = T.w * T.h;
  if (R.n !== T.n) return { empty: [`background references: ${R.n} frames for ${T.n} — re-run --film`], minCount: 0, n: T.n };
  const empty = [];
  let minCount = Infinity;
  for (let i = 0; i < T.n; i++) {
    let c = 0;
    for (let p = 0, o = i * px; p < px; p++) if (Math.abs(T.buf[o + p] - R.buf[o + p]) > CONTENT_DELTA) c++;
    minCount = Math.min(minCount, c);
    if (c < CONTENT_PX) empty.push(i);
  }
  return { empty, minCount, n: T.n };
}
function readStem(path) {
  const buf = readFileSync(path), n = (buf.length - 44) / 8, x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = (buf.readFloatLE(44 + i * 8) + buf.readFloatLE(44 + i * 8 + 4)) * .5;
  return x;
}
// 4th-order high-pass (two RBJ biquads): ticks and clicks live at 2.5–4.5 kHz
function highpass(x, fc = 2000) {
  const w = 2 * Math.PI * fc / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * .7071), a0 = 1 + al;
  const b0 = (1 + cs) / 2 / a0, b1 = -(1 + cs) / a0, a1 = -2 * cs / a0, a2 = (1 - al) / a0;
  let cur = x;
  for (let pass = 0; pass < 2; pass++) {
    const y = new Float32Array(cur.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < cur.length; i++) { const v = b0 * cur[i] + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = cur[i]; y2 = y1; y1 = v; y[i] = v; }
    cur = y;
  }
  return cur;
}
// onset near t: local peaks of (forward 1.5 ms RMS / trailing 20 ms RMS) ≥ 2; returns [ratio, time] of the nearest one
function onsetFinder(x) {
  const rms = (i0, i1) => { let s = 0; const a0 = Math.max(0, i0); for (let i = a0; i < i1; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, i1 - a0)) + 1e-9; };
  return (t, w = .02) => {
    const pts = []; for (let i = Math.round((t - w) * SR); i < (t + w) * SR; i += 6) pts.push([rms(i, i + 72) / rms(i - 960, i - 24), i / SR]);
    const peaks = pts.filter((p, k) => p[0] >= 2 && p[0] >= (pts[k - 1]?.[0] ?? 0) && p[0] >= (pts[k + 1]?.[0] ?? 0));
    if (!peaks.length) return [Math.max(...pts.map(p => p[0])), NaN];
    return peaks.reduce((a, p) => Math.abs(p[1] - t) < Math.abs(a[1] - t) ? p : a);
  };
}
const TOL = { tick: .0015, click: .0015, pop: .003, chime: .003, hit: .003 };

// shared by film QA and the storyboard: frame-clipped / tiny text are errors, unsafe / small are warnings. bars: shot id
// → letterbox bar height in px (kit.letterboxBar): text under a bar is clipped by it (UI mocks too), and the safe area
// starts 2 % of the height inside the picture
export function textIssues(audits, W, H, bars = {}) {
  const portrait = H > W, safe0 = portrait ? { x0: .1 * W, y0: .1 * H, x1: .9 * W, y1: .8 * H } : { x0: .05 * W, y0: .05 * H, x1: .95 * W, y1: .95 * H };
  const clipped = [], tiny = [], unsafe = [], small = [], barred = [];
  for (const a of audits) for (const b of a.boxes) {
    const tag = `${a.shot} "${b.text.slice(0, 24)}"`, bar = bars[a.shot] || 0;
    const safe = bar ? { ...safe0, y0: Math.max(safe0.y0, bar + .02 * H), y1: Math.min(safe0.y1, H - bar - .02 * H) } : safe0;
    if (b.x0 < -1 || b.y0 < -1 || b.x1 > W + 1 || b.y1 > H + 1) clipped.push(tag);
    else if (bar && (b.y0 < bar - 1 || b.y1 > H - bar + 1)) { clipped.push(`${tag} (under the letterbox bar)`); barred.push(tag); }
    else if (!b.ui && (b.x0 < safe.x0 - 2 || b.y0 < safe.y0 - 2 || b.x1 > safe.x1 + 2 || b.y1 > safe.y1 + 2)) unsafe.push(tag);
    if (!b.ui && b.px < 18) tiny.push(`${tag} ${b.px.toFixed(0)}px`); else if (!b.ui && b.px < 26) small.push(`${tag} ${b.px.toFixed(0)}px`);
  }
  return { clipped, tiny, unsafe, small, barred, portrait, boxes: audits.reduce((a, x) => a + x.boxes.length, 0) };
}
// shot id → letterbox bar px, for the shots that have bars
export const barsOf = (tl, W, H) => Object.fromEntries(tl.shots.map(s => [s.id, letterboxBar(s.letterbox, W, H)]).filter(([, b]) => b));

export function qaFilm({ tl, aspect, dir, audioDir, mp4, shotLog, audits, pages = null, audioPrint = null, log = console.log }) {
  const { W, H } = ASPECTS[aspect], results = [];
  const check = (name, pass, detail, level = pass ? 'PASS' : 'FAIL') => { results.push({ name, level, pass: level !== 'FAIL', detail }); log(`${level.padEnd(4)}  ${name.padEnd(8)} ${detail}`); };
  const finish = () => {
    const fails = results.filter(r => r.level === 'FAIL');
    writeFileSync(join(dir, 'qa.json'), JSON.stringify({ aspect, cut: tl.id, passed: !fails.length, results }, null, 1));
    log(fails.length ? `QA FAILED (${fails.length})` : `QA PASSED (${results.filter(r => r.level === 'PASS').length} checks)`);
    return { passed: !fails.length, results };
  };
  const framesDir = join(dir, 'frames'), n = tl.frames;
  if (!existsSync(mp4)) { check('video', false, `${mp4} is missing — run --film (or --audio to re-mux)`); return finish(); }
  const probe = sel => (JSON.parse(sh('ffprobe', ['-v', 'error', '-select_streams', sel, '-show_entries', 'stream=codec_name,width,height,r_frame_rate,nb_frames,pix_fmt,color_space,color_primaries,color_transfer,color_range,duration,duration_ts', '-of', 'json', mp4]).stdout || '{}').streams || [])[0] || {};
  // what went into the mp4 (mux.json, written at mux time) must be the current frames and the current master
  const J = f => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
  const mux = J(join(dir, 'mux.json')), rj = J(join(dir, 'render.json')), mj0 = J(join(audioDir, 'master.json'));
  const sameFile = !!mux && !!mux.mp4 && mux.mp4.size === statSync(mp4).size && mux.mp4.sha === fileSha(mp4);   // content, not timestamps
  const muxOk = sameFile && !!rj && JSON.stringify(mux.frames) === JSON.stringify(rj.prints) && !!mj0 && mux.audio === mj0.print;
  check('fresh', muxOk, muxOk ? 'the mp4 holds the current frames and master' : 'the mp4 was muxed from other frames or another master — run --audio to re-mux');
  const v = probe('v:0');
  const want = { codec_name: 'h264', width: W, height: H, r_frame_rate: '60/1', nb_frames: n, pix_fmt: 'yuv420p', color_space: 'bt709', color_primaries: 'bt709', color_transfer: 'bt709', color_range: 'tv' };
  const bad = Object.entries(want).filter(([k, x]) => String(v[k]) !== String(x)).map(([k, x]) => `${k}=${v[k]} (want ${x})`);
  check('video', !bad.length, bad.length ? bad.join(', ') : `${n} frames, ${W}×${H}, 60 fps, h264 yuv420p, bt709 tv`);
  const bounds = []; for (let i = 1; i < shotLog.length; i++) if (shotLog[i] !== shotLog[i - 1]) bounds.push(i);
  const okLog = shotLog.length === n && !shotLog.some(x => !x) && bounds.join() === tl.cuts.join();
  check('shots', okLog, okLog ? `shot changes at ${bounds.join(', ') || '—'} = timeline cuts` : `log has ${shotLog.filter(Boolean).length}/${n} frames; changes at ${bounds.join(', ')} (want ${tl.cuts.join(', ')})`);
  const pngs = existsSync(framesDir) ? readdirSync(framesDir).filter(f => f.endsWith('.png')).length : 0;
  if (pngs !== n) { check('frames', false, `${pngs} PNG frames in ${framesDir}, want ${n} — re-run --film`); return finish(); }
  const input = ['-framerate', '60', '-i', join(framesDir, '%05d.png')];
  const rows = frameStats(input, 'tblend=all_mode=difference,signalstats', ['YAVG']);
  const by = Object.fromEntries(rows.map(r => [r.n + 1, r]));          // tblend output k = |frame k+1 − frame k|
  tl.shots.slice(0, -1).forEach((s, k) => {
    const c = tl.cuts[k], d = by[c]?.YAVG ?? 0, nb = Math.max(...[-3, -2, -1, 1, 2, 3].map(o => by[c + o]?.YAVG ?? 0));
    const msg = `${s.id}→${tl.shots[k + 1].id} at ${c}: change ${d.toFixed(2)}, neighbours ≤ ${nb.toFixed(2)} (${(d / Math.max(nb, 1e-6)).toFixed(2)}×)`;
    if (s.out === 'cut') check('cut', d >= 1.25 * nb && d > 1, msg);
    else check('cut', true, `${msg} — ${s.out}, boundary proven by the shot log`, 'INFO');
  });
  const { runs, stillIdx } = freezeRuns(input, pages);
  const held = i => tl.holds.some(([a, b]) => i >= a && i <= b);
  const badRuns = runs.filter(r => !(held(r[0]) && held(r[1])));
  const holdPairs = tl.holds.reduce((a, [x, y]) => a + (y - x + 1), 0), heldStill = stillIdx.filter(held).length;
  check('freeze', !badRuns.length, badRuns.length ? `frozen (≥ 4 identical frames) at ${badRuns.slice(0, 8).map(([a, b]) => `${a - 1}–${b}`).join(', ')}${badRuns.length > 8 ? ` … (${badRuns.length} runs)` : ''}`
    : `no frozen runs${holdPairs ? `; holds verified still for ${heldStill}/${holdPairs} frame pairs` : ''}`);
  const refDir = join(dir, 'bgref'), nRefs = existsSync(refDir) ? readdirSync(refDir).filter(f => f.endsWith('.png')).length : 0;
  if (nRefs !== n) check('content', false, `background references: ${nRefs}/${n} — re-run --film`);
  else {
    const c = contentCheck({ framesInput: input, refsInput: ['-framerate', '60', '-i', join(refDir, '%05d.png')], W, H });
    check('content', !c.empty.length, c.empty.length ? `near-empty frames (look like the bare background): ${c.empty.slice(0, 12).join(', ')}${c.empty.length > 12 ? ` … (${c.empty.length})` : ''}`
      : `every frame has content beyond its background (min ${c.minCount} differing thumbnail px)`);
  }
  const bars = barsOf(tl, W, H), T = textIssues(audits, W, H, bars);
  check('text', !T.clipped.length && !T.tiny.length, T.clipped.length || T.tiny.length ? [T.clipped.length && `clipped by the frame: ${T.clipped.join('; ')}`, T.tiny.length && `too small: ${T.tiny.join('; ')}`].filter(Boolean).join(' | ')
    : `${T.boxes} text boxes across ${audits.length} hero frames, none clipped or tiny${Object.keys(bars).length ? `, none under a letterbox bar (${Object.entries(bars).map(([id, b]) => `${id} ${b}px`).join(', ')})` : ''}`);
  if (T.unsafe.length) check('text', true, `outside the ${T.portrait ? 'platform-UI' : 'title'}-safe area: ${T.unsafe.slice(0, 6).join('; ')}`, 'WARN');
  if (T.small.length) check('text', true, `small (< 26 px): ${T.small.slice(0, 6).join('; ')}`, 'WARN');
  // audio
  const mj = existsSync(join(audioDir, 'master.json')) ? JSON.parse(readFileSync(join(audioDir, 'master.json'), 'utf8')) : {};
  if (mj.silent) check('loudness', true, 'silent soundtrack (music: none and no SFX cues) — loudness not applicable', 'INFO');
  else { const L = measureLoudness(mp4); check('loudness', Math.abs(L.I + 14) <= .2 && L.TP <= -1, `${L.I} LUFS, true peak ${L.TP} dBTP (mp4 audio)`); }
  const a = probe('a:0');
  const mw = existsSync(join(audioDir, 'master.wav')) ? (JSON.parse(sh('ffprobe', ['-v', 'error', '-show_entries', 'stream=duration_ts', '-of', 'json', join(audioDir, 'master.wav')]).stdout).streams || [])[0] || {} : {};
  const wantN = Math.round(tl.dur * SR);
  check('duration', Number(mw.duration_ts) === wantN && Math.abs(Number(a.duration) - tl.dur) < .03, `master ${mw.duration_ts}/${wantN} samples, mp4 audio ${a.duration} s (want ${tl.dur.toFixed(3)})`);
  // the audio must have been built from this timeline (cue times, kinds, music, VO, code)
  if (audioPrint) { const ok = !!mux && mux.audio === audioPrint; check('audio', ok, ok ? 'the mp4\'s soundtrack was built from this timeline and audio code' : 'the mp4\'s soundtrack was built from a different timeline or code — run --audio'); }
  // SFX timing on the QA lanes
  if (tl.cues.length) {
    const lanesInfo = existsSync(join(audioDir, 'qa-lanes.json')) ? JSON.parse(readFileSync(join(audioDir, 'qa-lanes.json'), 'utf8')) : null;
    if (!lanesInfo || lanesInfo.assign.length !== tl.cues.length) check('sfx', false, 'QA lanes missing or stale — re-run --audio');
    else {
      const finders = {};
      const finder = (lane, hp) => finders[`${lane}${hp}`] ||= onsetFinder(hp ? highpass(readStem(join(audioDir, `qa-lane-${lane}.wav`))) : readStem(join(audioDir, `qa-lane-${lane}.wav`)));
      const misses = [];
      tl.cues.forEach((c, i) => {
        const hp = c.kind === 'tick' || c.kind === 'click', [r, o] = finder(lanesInfo.assign[i], hp)(c.t);
        if (!(Math.abs(o - c.t) <= TOL[c.kind]) || r < 2) misses.push(`${c.kind}@${c.t.toFixed(3)}→${Number.isNaN(o) ? 'none' : o.toFixed(4)} (×${r.toFixed(1)})`);
      });
      check('sfx', !misses.length, misses.length ? `${misses.length}/${tl.cues.length} cues off: ${misses.slice(0, 6).join(', ')}` : `${tl.cues.length} cue onsets on their frames (${lanesInfo.lanes} QA lane${lanesInfo.lanes === 1 ? '' : 's'})`);
      // design hint: cues that barely stand out in the full SFX mix (they land in another sound's tail)
      const fullF = onsetFinder(readStem(join(audioDir, 'points.wav'))), fullHP = onsetFinder(highpass(readStem(join(audioDir, 'points.wav'))));
      const buried = tl.cues.filter(c => { const [r, o] = ((c.kind === 'tick' || c.kind === 'click') ? fullHP : fullF)(c.t); return !(Math.abs(o - c.t) <= TOL[c.kind]) || r < 2; });
      if (buried.length) check('sfx', true, `${buried.length} cue(s) are buried in the mix (they land in another sound's tail): ${buried.slice(0, 6).map(c => `${c.kind}@${c.t.toFixed(2)} (${c.shot})`).join(', ')} — space those UI items further apart if they should read`, 'INFO');
    }
  } else check('sfx', true, 'no SFX cues in this timeline', 'INFO');
  if (tl.whooshes.length) {
    const y = readStem(join(audioDir, 'whoosh.wav'));
    const peak = t => { let best = [0, 0]; for (let s = t - .25; s < t + .1; s += .001) { const i0 = Math.round((s - .01) * SR), i1 = Math.round((s + .01) * SR); let e = 0; for (let i = Math.max(0, i0); i < i1; i++) e += y[i] * y[i]; if (e > best[0]) best = [e, s]; } return best[1]; };
    const off = tl.whooshes.map(w => ({ t: w.t, p: peak(w.t) })), worst = Math.max(...off.map(o => Math.abs(o.p - o.t)));
    check('whoosh', worst <= .012, off.map(o => `${o.t.toFixed(3)}→${o.p.toFixed(3)}`).join(', '));
  }
  return finish();
}

// clips: count + format (alpha plane when asked), content (alpha coverage for transparent clips, the shot's bg-only
// reference otherwise), no frozen runs outside holds. A clip is an overlay for the user's edit, so empty frames at its
// very start (≤ 1 s, the UI animating in) or end (≤ 0.5 s) are reported, not failed; longer empty edges, an empty gap
// in between, or a clip that is never filled, fail. Frozen runs inside allowed empty edges are the same empty frame
// repeated and don't count.
export function qaClip({ mov, framesDir, n, fps, alpha, W, H, held = [], refsDir = null, pages = null, bar = 0, log = console.log }) {
  const out = [];
  const check = (name, pass, detail) => { out.push({ name, pass, detail }); log(`${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(8)} ${detail}`); };
  const v = (JSON.parse(sh('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,pix_fmt,nb_frames,r_frame_rate', '-of', 'json', mov]).stdout || '{}').streams || [])[0] || {};
  // ProRes 4444 decodes as yuva444p10le or …12le depending on the decoder; what matters is that the alpha plane exists
  const pfOk = alpha ? /^yuva444p1[02]le$/.test(v.pix_fmt) : v.pix_fmt === 'yuv420p';
  check('clip', v.width === W && v.height === H && Number(v.nb_frames) === n && pfOk, `${v.codec_name} ${v.width}×${v.height} ${v.pix_fmt} ${v.nb_frames}/${n} frames @ ${v.r_frame_rate}`);
  const input = ['-framerate', String(fps), '-i', join(framesDir, '%05d.png')];
  let empty = null;
  // transparent clips: alpha coverage, measured inside the picture (letterbox bars are opaque in every frame); format=rgba
  // first: a clip that is opaque in every pixel (full-bleed media) is saved as RGB PNGs, which alphaextract can't read
  if (alpha) empty = frameStats(input, `format=rgba,alphaextract,${bar ? `crop=${W}:${H - 2 * bar}:0:${bar},` : ''}scale=${Math.round(W / 10)}:${Math.round((H - 2 * bar) / 10)}:flags=area,signalstats`, ['YMAX']).filter(r => r.YMAX < 40).map(r => r.n);
  else if (refsDir) {
    const c = contentCheck({ framesInput: input, refsInput: ['-framerate', String(fps), '-i', join(refsDir, '%05d.png')], W, H });
    if (c.n !== n) empty = Array.from({ length: n }, (_, i) => i); else empty = c.empty;
  }
  let lead = 0, tail = n;                                    // frames [0, lead) and [tail, n) are the empty edges
  if (empty) {
    const E = new Set(empty);
    while (lead < n && E.has(lead)) lead++;
    while (tail > lead && E.has(tail - 1)) tail--;
    const gaps = empty.filter(i => i >= lead && i < tail), what = alpha ? 'fully transparent' : 'near-empty';
    const sec = k => (k / fps).toFixed(2) + ' s';
    const longEdge = lead > Math.round(fps * 1) ? `the first ${lead} frames (${sec(lead)}) are ${what} — the UI arrives late (pin the first item earlier with at:)`
      : n - tail > Math.round(fps * .5) ? `the last ${n - tail} frames (${sec(n - tail)}) are ${what} — the content disappears before the clip ends` : null;
    if (lead === n) check('content', false, `every frame is ${what} — nothing in this clip`);
    else if (longEdge) check('content', false, longEdge);
    else check('content', !gaps.length, gaps.length ? `${what} frames in the middle of the clip: ${gaps.slice(0, 10).join(', ')}`
      : `content in every frame${lead || tail < n ? ` except the edges (${[lead && `first ${lead} frames / ${sec(lead)} while it animates in`, tail < n && `last ${n - tail} frames`].filter(Boolean).join(', ')} — trim them in your edit if you like)` : ''}`);
  }
  const { runs } = freezeRuns(input, pages);
  const edge = ([a, b]) => b < lead || a - 1 >= tail;        // a run of pairs inside an empty edge: the same empty frame
  const fz = runs.filter(([a, b]) => !held.some(([x, y]) => a >= x && b <= y) && !edge([a, b]));
  check('freeze', !fz.length, fz.length ? `frozen runs at ${fz.slice(0, 8).map(([a, b]) => `${a - 1}–${b}`).join(', ')}` : 'no frozen runs');
  return out;
}
