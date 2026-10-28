// QA for a rendered film (one cut × one aspect) and for clips. Every check prints PASS/FAIL (INFO/WARN never fail);
// film results go to out/<cut>/<aspect>/qa.json. Never ship a FAIL and never loosen a threshold to get a pass.
//   video     W×H, 60 fps, frame count, h264 yuv420p, bt709 primaries/transfer/matrix, tv range
//   shots     the renderer's log: the shot behind every frame changes exactly at the timeline's cut indices
//   cut       hard cuts ("out: cut") are one-frame spikes in luma difference (≥ 1.25× every neighbour within 3 frames);
//             moving transitions (whip/zoom/blur/drift and the cross-cuts) are INFO — their boundary is proven by the shot log;
//             so are cuts soft by design (a morph to: frame, a carry onto the same plain background, a flood)
//   continuity  (WARN/INFO) from the logged camera (cams.json): across every moving cut the zoom / pan keeps its sign, the
//             speed changes ≤ 3× (≤ 2× for a dive or a carried object), the fastest step is on the cut — see cutContinuity
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
// Frame checks (round 1: WARN or INFO only — they never fail a film, and a check that can't run says "not measured"
// instead of stopping QA; INFO = measured and fine or a near miss, numbers in qa.json `data`):
//   text      + readable floors by delivery (web / feed / tv): must-read text under the floor for its aspect and case
//   deadair   the busiest of 12 × 12 thumbnail blocks changes by < 8 (mean |Δ|, frame k vs k − 2) for longer than the
//             shot's allowance: max(0.6 s, the reading time its read copy needs — timeline.reading need = 0.4 s
//             assembly + the reading hold; the film's closing endcard / lockup at least 2 s); WARN when a run is more
//             than 0.5 s over it, INFO up to 0.5 s; declared holds don't count, cuts and holds split runs
//   flash     WCAG 2.3.1 general flash: > 3 flashes in any second (a flash = a pair of opposing transitions, each a
//             ≥ 0.1 relative-luminance change whose darker state is < 0.8, made by a net ≥ 25 % of the pixels of a
//             W/3 × H/3 window of the thumbnails — 25 % of a 10° field — in the same frames: those changing ≥ 0.1 its
//             way minus those changing ≥ 0.1 the other way, so a moving edge cancels), timed where they cross half-way
//   contrast  every must-read text box at the hero frames against the same frame with every glyph hidden: worst (2nd
//             percentile) WCAG ratio < 4.5 (< 3 at ≥ 48 px) or APCA |Lc| < 60 (< 45 at ≥ 48 px); outlined text, and
//             shadowed text that only reads against its own shadow, are INFO (check by eye); must-read text that
//             isn't painted at its hero frame (covered, masked) is a WARN of its own
//   purity    seeded frames (every shot's first, last and an inside or held frame; 24–120) re-rendered in shuffled
//             order on one fresh page (purity.json, written by --film) match the film's within ±2 per channel (or ≤
//             0.01 % of pixels beyond it). WARN: the page's visible state depends on draw order; a CSS transition or
//             animation runs while the film is drawn; a frame that differs even when drawn again the way the film drew
//             it (in order from its shot's first frame); a worker seam inside a shot whose frame differs from the
//             same frame drawn in order (the rest of the shot is drawn differently: a small jump at the seam). INFO: frames that differ only when drawn out of order —
//             drawn in order from their shot's first frame they match (Chrome's raster history: the compositing
//             state a shot builds up from its first frame; the film draws its frames in order)
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ASPECTS, SR, sh, measureLoudness } from './common.mjs';
import { fileSha } from './fingerprint.mjs';
import { letterboxBar } from '../engine/kit.js';
import { exitLen, isDrift, carryPlan } from '../engine/kit.js';
// a cut the timeline declares soft by design (round 2): a morph that fills the frame on the cut, a carry or morph onto
// the same plain background, a flood — its frames can't spike like a hard cut, so the cut check reports it as INFO
const plainBg = x => !(x.bg != null && x.bg !== false && String(x.bg).trim() !== '' && String(x.bg).toLowerCase() !== 'none') && !['cta', 'scene'].includes(x.block) ? (x.theme === 'dark' ? 'dark' : 'light') : null;
export function softCut(A, B) {
  if (A.out === 'flood') return 'flood';
  if (!A.carry || typeof A.carry !== 'object' || !B) return null;
  const P = carryPlan(A.carry), what = P.morph ? 'morph' : 'carry';
  if (P.frame) return 'morph to: frame';
  return plainBg(A) && plainBg(A) === plainBg(B) ? `${what} onto the same ${plainBg(A)} background` : null;
}

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
// (T: the frames' thumbnails when the caller already has them)
export function contentCheck({ framesInput, refsInput, W, H, T: T0 = null }) {
  const T = T0 || thumbs(framesInput, W, H), R = thumbs(refsInput, W, H), px = T.w * T.h;
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

// cut continuity (WARN / INFO only), from the camera the renderer logged on every frame (cams.json: LV.camera() per 60-fps
// frame, {s, x, y} = the shot camera's scale and translation about the frame centre). A cut is checked when anything moves
// near it (a step within ±CONT.win frames reaches CONT.moving px/s): (1) direction — the zoom (d ln s/dt) and the
// translation of whatever sits under the frame centre keep their sign across the cut (a push-in into a shot that starts
// zoomed in and shrinks is the flip), counted when both sides pass CONT.zoomSign / CONT.panSign; (2) speed — when either
// side moves (≥ CONT.moving), the fastest point's speed on the outgoing shot's last frame-step and the incoming shot's
// first differ ≤ CONT.ratio× (≤ CONT.matched× after `out: dive` and for carried objects, which are speed-matched by
// design); a side under CONT.moving / 4 is at rest (no ratio: "from rest" / "to rest"); (3) peak — no step within
// ±CONT.win frames (inside each shot) is faster than those two. The incoming shot's window stops where its own exit ramp
// starts (that motion belongs to the next cut: a short insert that whips out). Not warned, named in the INFO line: an
// incoming shot shorter than its own exit that speeds up on that exit from its first frame (its ramp is the next cut's;
// a slow-down or a flip there still warns), an
// outgoing shot that only slows down from its first frame (its entrance still settling: a short insert), and a speed
// change set by hand-tuned drift strengths (`drift: {in, out}` on a drift cut, e.g. fitted to a reference film).
// A carried object (cam.carry = its screen rectangle {x, y, w, h} — top-left + size, stage px — or a list of them) gets
// the same three on its centre and size, across the cut itself (it is one object on both sides): the steps cut−2→cut−1
// and cut→cut+1 either side of the step that ends on the cut, which must be the fastest (a needle zoom peaks there; a
// peak one frame late is one WARN, not two); one that ends on the cut (a morph into the whole frame) gets the half before
// it: its fastest step is its last. Speeds are per second in px of a 1080-px short side; fastest point = centre speed +
// |zoom| × CONT.R (a 16:9 frame's half diagonal on every aspect, so a zoom is gated alike in each); a carry: + half its
// size change. Calibrated on film-sample / steady-sample / reel-sample + 13 more jobs (reports/D-build-r2.md): the
// engine's own exit → entrance pairs slow down 1.9–2.6× across the cut (whips 2.0–2.2×, zoom-in 2.1×, zoom-out 2.6×,
// blur 1.9–2.0×), so their WARN sits at 3× and the INFO line names the cuts over 2×; dives measure 1.2×, carries 1.0–1.1×.
export const CONT = { zoomSign: .3, panSign: 120, moving: 400, ratio: 3, matched: 2, near: 2, win: 6, peakTol: 1.05, R: Math.hypot(1920, 1080) / 2 };
export function cutContinuity({ tl, cams, W, H }) {
  const u = Math.min(W, H) / 1080, R = CONT.R, n = tl.shots.length;
  if (!Array.isArray(cams) || cams.length !== tl.frames) return { missing: true, cuts: [], warns: [] };
  const ok = c => !!c && [c.s, c.x, c.y].every(Number.isFinite) && c.s > 0;
  const camStep = i => {                           // frames i−1 → i of one shot
    const a = cams[i - 1], b = cams[i];
    if (!ok(a) || !ok(b)) return null;
    const q = b.s / a.s, z = Math.log(q) * 60, vx = (b.x - q * a.x) / u * 60, vy = (b.y - q * a.y) / u * 60;
    return { z, vx, vy, v: Math.hypot(vx, vy) + Math.abs(z) * R };
  };
  const rects = c => c && c.carry ? [].concat(c.carry) : [];
  const rectOk = r => !!r && [r.x, r.y, r.w, r.h].every(Number.isFinite) && r.w > 0 && r.h > 0;
  const carryStep = j => i => {
    const a = rects(cams[i - 1])[j], b = rects(cams[i])[j];
    if (!rectOk(a) || !rectOk(b)) return null;
    const vx = (b.x + b.w / 2 - a.x - a.w / 2) / u * 60, vy = (b.y + b.h / 2 - a.y - a.h / 2) / u * 60;
    return { vx, vy, zw: Math.log(b.w / a.w) * 60, zh: Math.log(b.h / a.h) * 60, v: Math.hypot(vx, vy) + Math.hypot(b.w - a.w, b.h - a.h) / 2 / u * 60 };
  };
  const rnd = s => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, k.startsWith('z') ? +v.toFixed(3) : Math.round(v)]));
  // one moving thing across one cut: iB / iA = the steps either side of it (the camera: the outgoing shot's last step and
  // the incoming one's first; a carry: cut−2→cut−1 and cut→cut+1, around the step that ends on the cut), touch = the steps
  // the fastest one may be (they touch the cut), win = every step within ±CONT.win frames, limit = the speed ratio allowed
  const judge = (st, iB, iA, touch, win, axes, limit) => {
    const b = st(iB), a = st(iA);
    if (!b || !a) return null;
    const top = Math.max(...touch.map(i => st(i)?.v ?? 0)), lo = Math.min(b.v, a.v), hi = Math.max(b.v, a.v);
    const r = { before: rnd(b), after: rnd(a), moving: Math.max(hi, top, ...win.map(i => st(i)?.v ?? 0)) >= CONT.moving };   // motion anywhere within ±CONT.win
    if (!r.moving) return r;
    r.flips = axes.filter(([k, th]) => Math.abs(b[k]) >= th && Math.abs(a[k]) >= th && Math.sign(b[k]) !== Math.sign(a[k])).map(([k]) => k);
    if (hi >= CONT.moving) { r.limit = limit; r.ratio = lo >= CONT.moving / 4 ? +(hi / lo).toFixed(2) : null; }   // null = one side at rest
    const steps = win.map(i => [i, st(i)]).filter(([, s]) => s), [pi, ps] = steps.reduce((m, x) => x[1].v > m[1].v ? x : m, [iB, b]);
    const near = touch.reduce((m, i) => Math.abs(pi - i) < Math.abs(pi - m) ? i : m, touch[0]);
    r.peak = { step: `${pi - 1}→${pi}`, v: Math.round(ps.v), onCut: Math.round(top), off: !touch.includes(pi) && ps.v > CONT.peakTol * top ? pi - near : 0 };
    r.speeds = Object.fromEntries(win.map(i => [i, st(i) ? Math.round(st(i).v) : null]));
    return r;
  };
  // a carried object that ends on the cut (no rectangle after it): the half before the cut — its last step is the fastest
  const ending = (st, c, win) => {
    const L = st(c) ? c : c - 1, last = st(L), steps = win.filter(i => i <= L && st(i));
    const [pi, ps] = steps.reduce((m, i) => st(i).v > m[1].v ? [i, st(i)] : m, [L, last]);
    return { half: 'before', before: rnd(last), moving: ps.v >= CONT.moving, flips: [],
      peak: { step: `${pi - 1}→${pi}`, v: Math.round(ps.v), onCut: Math.round(last.v), off: pi !== L && ps.v > CONT.peakTol * last.v ? pi - L : 0 },
      speeds: Object.fromEntries(steps.map(i => [i, Math.round(st(i).v)])) };
  };
  const drift = s => s.drift && typeof s.drift === 'object' ? s.drift : {};
  const cuts = [];
  for (let k = 0; k < n - 1; k++) {
    const A = tl.shots[k], B = tl.shots[k + 1], c = tl.cuts[k], a0 = k ? tl.cuts[k - 1] : 0, b1 = (k + 2 < n ? tl.cuts[k + 1] : tl.frames) - 1;
    const range = (x, y) => Array.from({ length: Math.max(0, y - x + 1) }, (_, i) => x + i);
    const bx = B.out === 'cut' || k + 2 >= n ? b1 : Math.min(b1, Math.round(B.f1 * 2) - 2 * exitLen(B.out));   // B's own exit ramp belongs to the next cut
    const win = [...range(Math.max(a0 + 1, c - CONT.win), c - 1), ...range(c + 1, Math.min(bx, c + CONT.win))];
    const cam = c - 2 >= a0 && c + 1 <= b1 ? judge(camStep, c - 1, c + 1, [c - 1, c + 1], win, [['z', CONT.zoomSign], ['vx', CONT.panSign], ['vy', CONT.panSign]], A.out === 'dive' ? CONT.matched : CONT.ratio) : null;
    if (B.out !== 'cut' && k + 2 < n && bx <= c && cam?.limit && cam.after.v > cam.before.v) { delete cam.limit; delete cam.ratio; cam.short = true; }   // B is shorter than its exit: that ramp speeds it up
    if (cam?.peak?.off < 0) {                      // A only slows down from its first frame: its entrance still settling
      const sp = range(a0 + 1, c - 1).map(i => camStep(i)?.v);
      if (sp.every((v, i) => v != null && (!i || v <= sp[i - 1] * 1.02 + 1))) cam.peak.settle = true;
    }
    if (cam?.limit && isDrift(A.out) && (drift(A).out != null || drift(B).in != null)) cam.tuned = true;   // the drift strengths set this ratio
    const carry = [], cwin = range(Math.max(1, c - CONT.win), Math.min(tl.frames - 1, c + CONT.win));
    let skipped = 0;
    for (let j = 0; j < Math.max(rects(cams[c - 1]).length, rects(cams[c]).length); j++) {
      const st = carryStep(j), r = judge(st, c - 1, c + 1, [c], cwin, [['vx', CONT.panSign], ['vy', CONT.panSign], ['zw', CONT.zoomSign], ['zh', CONT.zoomSign]], CONT.matched)
        || (st(c - 1) && !st(c + 1) ? ending(st, c, cwin) : null);
      if (r) carry.push({ j, ...r }); else skipped++;
    }
    cuts.push({ cut: `${A.id}→${B.id}`, at: c, out: A.out, camera: cam, ...(carry.length ? { carry } : {}), ...(skipped ? { carrySkipped: skipped } : {}) });
  }
  // WARN lines, one per problem; each judged record keeps the problems it was warned for (warn: [...]) for the sheet
  const z = v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}/s`, px = v => `${v >= 0 ? '+' : '−'}${Math.round(Math.abs(v))} px/s`;
  const AX = { z: ['zoom', z], vx: ['x', px], vy: ['y', px], zw: ['width', z], zh: ['height', z] };
  const warns = [];
  for (const x of cuts) {
    const [ida, idb] = x.cut.split('→'), head = `${x.cut} at ${x.at} (${x.out})`;
    for (const [what, r] of [['camera', x.camera], ...(x.carry || []).map(q => [`carried object${q.j ? ` #${q.j + 1}` : ''}`, q])]) {
      if (!r || !r.moving) continue;
      const cam = what === 'camera';
      r.warn = [];
      if (r.flips.length) {
        const why = r.flips.includes('z') ? r.before.z > 0 ? ` (${ida} pushes in, ${idb} starts zoomed in and pulls back)` : ` (${ida} pulls back, ${idb} starts small and pushes in)` : '';
        r.warn.push('direction');
        warns.push(`${head}: the ${cam ? '' : what + "'s "}move flips direction on the cut — ${r.flips.map(k => `${AX[k][0]} ${AX[k][1](r.before[k])} → ${AX[k][1](r.after[k])}`).join(', ')}${why}; keep the sign across the cut`);
      }
      if (r.limit && (r.ratio == null || r.ratio > r.limit) && (cam || !r.peak.off) && !r.tuned) {
        const slow = r.after.v < r.before.v, still = r.ratio == null, rx = still ? (slow ? 'to rest' : 'from rest') : `${r.ratio}×`;
        const why = !cam ? `the ${what} ${slow ? (still ? 'stops on the cut' : `slows ${rx} through the cut`) : (still ? 'starts from rest on the cut' : `speeds up ${rx} through the cut`)}`
          : slow ? (still ? `${idb} stands still on its first frames (a hold from its first frame, or a camera move that starts later?)` : `${idb} starts ${rx} slower than ${ida} leaves`)
          : still ? `${ida} is still and ${idb} starts moving on the cut (give ${ida} a move into the cut, or start ${idb}'s move after it)` : `${idb} starts ${rx} faster than ${ida} leaves`;
        r.warn.push('speed');
        warns.push(`${head}: ${cam ? 'speed' : `${what}'s speed`} ${Math.round(r.before.v)} → ${Math.round(r.after.v)} px/s across the cut (${rx}, limit ${r.limit}×) — ${why}`);
      }
      if (r.peak.off && !r.peak.settle) {
        r.warn.push('peak');
        warns.push(`${head}: the ${cam ? '' : what + "'s "}fastest step is ${Math.abs(r.peak.off)} frame${Math.abs(r.peak.off) > 1 ? 's' : ''} ${cam ? (r.peak.off > 0 ? 'after' : 'before') + ' the cut' : r.peak.off > 0 ? 'late' : 'early'} (frames ${r.peak.step}, ${r.peak.v} px/s vs ${r.peak.onCut} px/s on the cut) — a move across a cut peaks on the cut`);
      }
    }
  }
  return { cuts, warns };
}
// the INFO summary line for the continuity check
export function continuitySummary(C) {
  if (C.missing) return 'no camera log for this render (out/<cut>/<aspect>/cams.json) — re-run --film to check cut continuity';
  const all = C.cuts.flatMap(x => [x.camera && { cut: x.cut, ...x.camera }, ...(x.carry || []).map(q => ({ cut: `${x.cut} carry`, ...q }))]).filter(Boolean);
  const moving = all.filter(r => r.moving), rs = moving.map(r => r.ratio).filter(Number.isFinite), unknown = C.cuts.filter(x => !x.camera).map(x => x.cut);
  const over = r => !!r.limit && (r.ratio == null || r.ratio > r.limit);
  const near = moving.filter(r => Number.isFinite(r.ratio) && r.ratio > CONT.near && !over(r));
  const tuned = moving.filter(r => r.tuned && over(r)), settle = moving.filter(r => r.peak?.settle), ending = moving.filter(r => r.half), short = moving.filter(r => r.short);
  const skipped = C.cuts.filter(x => x.carrySkipped).map(x => x.cut);
  const span = rs.length ? [Math.min(...rs).toFixed(1), Math.max(...rs).toFixed(1)] : null;
  const nCam = moving.filter(r => r.j == null).length, nCarry = moving.length - nCam;
  return `${C.cuts.length} cuts, ${nCam} with camera motion${nCarry ? ` + ${nCarry} carried object${nCarry > 1 ? 's' : ''}` : ''} checked for direction, speed (≤ ${CONT.ratio}× across the cut${moving.some(r => r.limit === CONT.matched) ? `, ≤ ${CONT.matched}× after a dive and for a carry` : ''}) and the fastest step on the cut${C.warns.length ? ` — ${C.warns.length} WARN` : ' — all hold'}` +
    `${span ? `; speed ratio${span[0] === span[1] ? ` ${span[0]}×` : `s ${span[0]}–${span[1]}×`}` : ''}${near.length ? ` (over ${CONT.near}×: ${near.map(r => `${r.cut} ${r.ratio}×`).join(', ')})` : ''}` +
    `${tuned.length ? `; set by tuned drift strengths (drift: in/out), not warned: ${tuned.map(r => `${r.cut} ${r.ratio == null ? 'at rest on one side' : `${r.ratio}×`}`).join(', ')}` : ''}` +
    `${settle.length ? `; still settling from its entrance (fastest ${settle.map(r => `${-r.peak.off} f before ${r.cut}`).join(', ')}), not warned` : ''}` +
    `${ending.length ? `; ends on the cut (the half before it checked): ${ending.map(r => r.cut).join(', ')}` : ''}` +
    `${short.length ? `; the incoming shot is shorter than its own exit and speeds up on it from its first frame, not warned: ${short.map(r => r.cut).join(', ')}` : ''}` +
    `${skipped.length ? `; a carried object too short to check at ${skipped.join(', ')}` : ''}` +
    `${unknown.length ? `; no camera data at ${unknown.join(', ')} (re-run --film)` : ''} — numbers per cut in qa.json`;
}
const TOL = { tick: .0015, click: .0015, pop: .003, chime: .003, hit: .003 };

// readable-text floors (px on screen, after the camera's scale) for must-read text (not .lv-ui), [mixed case, capitals],
// by beats.yaml `delivery:` — web (default: watched full-screen or landscape), feed (a 16:9 film watched small in a phone
// feed), tv (a big screen); 9:16 and 1:1 are watched full-screen on a phone in every delivery
export const FLOORS = { web: { '16x9': [47, 35], other: [40, 36] }, feed: { '16x9': [64, 48], other: [40, 36] }, tv: { '16x9': [27, 21], other: [40, 36] } };
export const floorsFor = (delivery, W, H) => (FLOORS[delivery] || FLOORS.web)[W > H ? '16x9' : 'other'];

// shared by film QA and the storyboard: frame-clipped / tiny text are errors, unsafe / small are warnings. bars: shot id
// → letterbox bar height in px (kit.letterboxBar): text under a bar is clipped by it (UI mocks too), and the safe area
// starts 2 % of the height inside the picture. floor: must-read text at ≥ 26 px that is still under the delivery's floor
// (text under 26 px is already reported as small / tiny)
export function textIssues(audits, W, H, bars = {}, delivery = 'web') {
  delivery = FLOORS[String(delivery)] ? String(delivery) : 'web';
  const portrait = H > W, safe0 = portrait ? { x0: .1 * W, y0: .1 * H, x1: .9 * W, y1: .8 * H } : { x0: .05 * W, y0: .05 * H, x1: .95 * W, y1: .95 * H };
  const clipped = [], tiny = [], unsafe = [], small = [], barred = [], floor = [], [fMixed, fCaps] = floorsFor(delivery, W, H);
  for (const a of audits) for (const b of a.boxes) {
    const tag = `${a.shot} "${b.text.slice(0, 24)}"`, bar = bars[a.shot] || 0;
    const safe = bar ? { ...safe0, y0: Math.max(safe0.y0, bar + .02 * H), y1: Math.min(safe0.y1, H - bar - .02 * H) } : safe0;
    if (b.x0 < -1 || b.y0 < -1 || b.x1 > W + 1 || b.y1 > H + 1) clipped.push(tag);
    else if (bar && (b.y0 < bar - 1 || b.y1 > H - bar + 1)) { clipped.push(`${tag} (under the letterbox bar)`); barred.push(tag); }
    else if (!b.ui && (b.x0 < safe.x0 - 2 || b.y0 < safe.y0 - 2 || b.x1 > safe.x1 + 2 || b.y1 > safe.y1 + 2)) unsafe.push(tag);
    if (!b.ui && b.px < 18) tiny.push(`${tag} ${b.px.toFixed(0)}px`); else if (!b.ui && b.px < 26) small.push(`${tag} ${b.px.toFixed(0)}px`);
    else if (!b.ui && b.px < (b.caps ? fCaps : fMixed)) floor.push(`${tag} ${b.px.toFixed(0)}px${b.caps ? ' caps' : ''}`);
  }
  const feed = floorsFor('feed', W, H);
  return { clipped, tiny, unsafe, small, barred, floor, floors: { delivery, mixed: fMixed, caps: fCaps, feedRaises: delivery === 'web' && (feed[0] > fMixed || feed[1] > fCaps) }, portrait, boxes: audits.reduce((a, x) => a + x.boxes.length, 0) };
}
// the readable-floor note (film QA WARN, storyboard note); the feed hint only where feed's floors are higher (16:9)
export const floorNote = (T, aspect) => `under the ${T.floors.delivery} floor for ${aspect.replace('x', ':')} (${T.floors.mixed} px, ${T.floors.caps} px in capitals${T.floors.feedRaises ? '; delivery: feed raises it' : ''}): ${T.floor.slice(0, 8).join('; ')}${T.floor.length > 8 ? ` … (${T.floor.length})` : ''}`;

// ── dead air: activity(k) = the largest mean |Δ| of 12 × 12 blocks of the grey thumbnails between frames k and k − 2
// (1/30 s), so a small moving cursor counts; a run of activity < DEADAIR_ACT longer than the shot's allowance —
// max(DEADAIR_MIN, the reading time of its read copy: timeline.reading need = 0.4 s assembly + the reading hold) — is
// dead air. The assembly counts because a run starts while the copy is still settling (the tail of its ease-out is under
// the threshold: a 3-word headline's run starts ~0.2 s into the shot). The film's closing endcard / lockup may sit still
// for at least DEADAIR_LOCKUP (the handbook's listed read "end lockup ≥ 2 s"). A run up to DEADAIR_GRACE over its
// allowance is a near miss (INFO: a stock block's 3 s hold with only the camera's slow push lands there — the push
// scores 6–7, under the threshold), more is dead air (WARN). Frames inside a declared hold don't count (the hold is
// meant to be still); runs are split at cuts and at holds.
export const DEADAIR_ACT = 8, DEADAIR_MIN = .6, DEADAIR_GRACE = .5, DEADAIR_LOCKUP = 2, DEADAIR_PACE = .6;
export function activity(T) {
  const { w, h, n, buf } = T, px = w * h, act = new Float32Array(n).fill(Infinity);
  const gx = Array.from({ length: 13 }, (_, j) => Math.round(j * w / 12)), gy = Array.from({ length: 13 }, (_, j) => Math.round(j * h / 12));
  for (let k = 2; k < n; k++) {
    const a = k * px, b = (k - 2) * px;
    let best = 0;
    for (let by = 0; by < 12; by++) for (let bx = 0; bx < 12; bx++) {
      let s = 0;
      for (let y = gy[by]; y < gy[by + 1]; y++) for (let x = gx[bx], o = y * w + gx[bx]; x < gx[bx + 1]; x++, o++) s += Math.abs(buf[a + o] - buf[b + o]);
      const m = s / ((gy[by + 1] - gy[by]) * (gx[bx + 1] - gx[bx]));
      if (m > best) best = m;
    }
    act[k] = best;
  }
  return act;
}
export function deadAir({ T, tl }) {
  const act = activity(T), n = T.n, starts = [0, ...tl.cuts], shotAt = k => { let i = 0; while (i + 1 < starts.length && k >= starts[i + 1]) i++; return i; };
  const held = k => tl.holds.some(([a, b]) => k >= a && k <= b);
  const need = tl.shots.map(s => (tl.reading && tl.reading[s.id] ? tl.reading[s.id].need : 0)), last = tl.shots.length - 1;
  const lockup = tl.shots.map((s, i) => i === last && (s.block === 'endcard' || s.block === 'lockup'));
  const allow = tl.shots.map((s, i) => Math.max(DEADAIR_MIN, need[i], lockup[i] ? DEADAIR_LOCKUP : 0));
  const why = i => lockup[i] && allow[i] === DEADAIR_LOCKUP ? 'end lockup' : need[i] ? 'copy' : 'floor';   // what sets the allowance
  const runs = [], longest = tl.shots.map(() => 0);
  let a = -1;
  const close = (b) => { if (a < 0) return; const i = shotAt(a), len = (b - a + 2) / 60; longest[i] = Math.max(longest[i], len); runs.push({ shot: tl.shots[i].id, i, k0: a - 2, k1: b, t: +((a - 2) / 60).toFixed(2), len: +len.toFixed(2), allow: +allow[i].toFixed(2), why: why(i) }); a = -1; };
  for (let k = 0; k < n; k++) {
    const still = act[k] < DEADAIR_ACT && !held(k);
    if (a >= 0 && (!still || shotAt(k) !== shotAt(a))) close(k - 1);
    if (still && a < 0) a = k;
  }
  close(n - 1);
  const dead = runs.filter(r => r.len > r.allow + DEADAIR_GRACE), near = runs.filter(r => r.len > r.allow && r.len <= r.allow + DEADAIR_GRACE);
  const sorted = [...act].filter(Number.isFinite).sort((x, y) => x - y);
  return { dead, near, grace: DEADAIR_GRACE, runs: runs.filter(r => r.len >= .25), longest: tl.shots.map((s, i) => ({ shot: s.id, still: +longest[i].toFixed(2), allow: +allow[i].toFixed(2), why: why(i) })),
    act: { p10: +(sorted[Math.floor(sorted.length * .1)] ?? 0).toFixed(2), median: +(sorted[Math.floor(sorted.length / 2)] ?? 0).toFixed(2), stillFrames: sorted.filter(x => x < DEADAIR_ACT).length, n } };
}

// ── flash (WCAG 2.3.1 general flash, ~ PEAT): per window (W/3 × H/3 — a 10° field — overlapping by half: 5 × 5) the
// mean relative luminance of the thumbnail pixels finds candidate legs (a zig-zag with hysteresis FLASH_DL × FLASH_AREA:
// the smallest mean change a qualifying flash makes); a leg is a transition when its NET share reaches FLASH_AREA: the
// window's pixels changing by ≥ FLASH_DL in its direction between its two ends, minus those changing by ≥ FLASH_DL the
// other way between the same two frames, each with their darker state < FLASH_DARK (pixel-wise, so a small
// full-contrast flash doesn't count as a big faint one; net, so motion isn't a flash — a moving high-contrast object
// darkens pixels at one edge while it brightens others at the other: Alex 10-27); runs of same-direction transitions
// merge; each is timed where the window's mean crosses half-way; a flash = two opposing transitions; more than 3
// flashes (≥ 7 transitions) within any 1 s = WARN. Red flashes aren't measured (grey thumbnails).
export const FLASH_DL = .1, FLASH_DARK = .8, FLASH_MAX = 3, FLASH_AREA = .25;
const LIN = Float64Array.from({ length: 256 }, (_, v) => { const c = v / 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); });
export function flashCheck({ T, fps = 60 }) {
  const { w, h, n, buf } = T, px = w * h, ww = Math.round(w / 3), wh = Math.round(h / 3), out = [], hy = FLASH_DL * FLASH_AREA;
  let worst = { flashes: 0 };
  for (let wy = 0; wy < 5; wy++) for (let wx = 0; wx < 5; wx++) {
    const x0 = Math.min(w - ww, Math.round(wx * w / 6)), y0 = Math.min(h - wh, Math.round(wy * h / 6)), L = new Float64Array(n);
    for (let k = 0; k < n; k++) { let s = 0; for (let y = y0; y < y0 + wh; y++) for (let x = x0, o = k * px + y * w + x0; x < x0 + ww; x++, o++) s += LIN[buf[o]]; L[k] = s / (ww * wh); }
    // candidate legs on the mean
    const legs = []; let dir = 0, pv = L[0], pk = 0, ev = L[0], ek = 0, mn = L[0], mnk = 0, mx = L[0], mxk = 0;
    for (let k = 1; k < n; k++) {
      const v = L[k];
      if (!dir) {
        if (v > mx) { mx = v; mxk = k; } if (v < mn) { mn = v; mnk = k; }
        if (mx - mn >= hy) { if (mxk > mnk) { dir = 1; pv = mn; pk = mnk; ev = mx; ek = mxk; } else { dir = -1; pv = mx; pk = mxk; ev = mn; ek = mnk; } }
      } else if (dir > 0 ? v > ev : v < ev) { ev = v; ek = k; }
      else if (Math.abs(ev - v) >= hy) { legs.push({ k0: pk, k1: ek, a: pv, b: ev }); pv = ev; pk = ek; dir = -dir; ev = v; ek = k; }
    }
    if (dir && Math.abs(ev - pv) >= hy) legs.push({ k0: pk, k1: ek, a: pv, b: ev });
    // pixel-wise: the net share of the window's pixels that make this transition between the leg's two ends (its way
    // minus the other way)
    const share = l => {
      const up = l.b > l.a; let c = 0;
      for (let y = y0; y < y0 + wh; y++) for (let x = x0, o = y * w + x0; x < x0 + ww; x++, o++) {
        const p = LIN[buf[l.k0 * px + o]], q = LIN[buf[l.k1 * px + o]], d = up ? q - p : p - q;
        if (Math.min(p, q) < FLASH_DARK) c += d >= FLASH_DL ? 1 : d <= -FLASH_DL ? -1 : 0;
      }
      return c / (ww * wh);
    };
    const tr = [];
    for (const l of legs) {
      if (share(l) < FLASH_AREA) continue;
      const prev = tr[tr.length - 1];
      if (prev && (prev.b > prev.a) === (l.b > l.a)) Object.assign(prev, { k1: l.k1, b: l.b });   // the same transition, continued
      else tr.push({ ...l });
    }
    for (const l of tr) { const mid = (l.a + l.b) / 2, up = l.b > l.a; let k = l.k0 + 1; while (k < l.k1 && (up ? L[k] < mid : L[k] > mid)) k++; l.km = k; }
    for (let i = 0; i < tr.length; i++) {
      let j = i; while (j + 1 < tr.length && tr[j + 1].km < tr[i].km + fps) j++;
      const flashes = (j - i + 1) / 2;
      if (flashes > worst.flashes) worst = { flashes, t: +(tr[i].km / fps).toFixed(2), win: [wx, wy] };
      if (flashes > FLASH_MAX) out.push({ t0: tr[i].km / fps, t1: tr[j].km / fps, flashes, win: [wx, wy] });
    }
  }
  // merge overlapping bad seconds (any window) into spans
  out.sort((a, b) => a.t0 - b.t0);
  const spans = [];
  for (const o of out) { const s = spans[spans.length - 1]; if (s && o.t0 <= s.t1 + .05) { s.t1 = Math.max(s.t1, o.t1); s.flashes = Math.max(s.flashes, o.flashes); } else spans.push({ ...o }); }
  return { spans: spans.map(s => ({ t0: +s.t0.toFixed(2), t1: +s.t1.toFixed(2), flashes: s.flashes })), worst };
}

// ── contrast: WCAG 2.x ratio and APCA-W3 (0.0.98G-4g constants) between a text colour and a background pixel (sRGB 0-255)
const lin = c => { c /= 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
const relLum = (r, g, b) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
export const wcag = (t, b) => { const L1 = relLum(...t), L2 = relLum(...b); return (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); };
export function apca(t, b) {
  const Y = ([r, g, bl]) => { const y = .2126729 * Math.pow(r / 255, 2.4) + .7151522 * Math.pow(g / 255, 2.4) + .072175 * Math.pow(bl / 255, 2.4); return y < .022 ? y + Math.pow(.022 - y, 1.414) : y; };
  const yt = Y(t), yb = Y(b);
  if (Math.abs(yb - yt) < .0005) return 0;
  if (yb > yt) { const s = (Math.pow(yb, .56) - Math.pow(yt, .57)) * 1.14; return s < .1 ? 0 : (s - .027) * 100; }
  const s = (Math.pow(yb, .65) - Math.pow(yt, .62)) * 1.14; return s > -.1 ? 0 : (s + .027) * 100;
}
export const CONTRAST = { wcag: 4.5, wcagBig: 3, apca: 60, apcaBig: 45, big: 48, core: .6, pct: .02 };
function rgbOf(png, W, H) {
  const r = sh('ffmpeg', ['-hide_banner', '-v', 'error', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { encoding: 'buffer' });
  if (r.status || r.stdout.length !== W * H * 3) throw new Error(`could not decode ${png}: ${String(r.stderr).slice(0, 200)}`);
  return r.stdout;
}
// per must-read box, word by word (an accent word is measured in its own colour): the word's glyph pixels, its text
// colour = their median in the real frame, the contrast of that colour against the textless frame at each glyph pixel;
// the box's worst = the 2nd percentile over all its glyph pixels. Glyph pixels ("core"):
//   ink  (when -ink0/-ink1 exist): glyph coverage ≥ 60 % of the word's fullest — the solid-white minus solid-black glyph
//        frames, so a glyph pixel counts whatever lies behind it (white copy over a white patch of sky is found)
//   diff (the fallback, and recorded alongside): real vs textless difference ≥ 60 % of the word's largest — misses the
//        glyph pixels that look like their background, i.e. exactly the unreadable ones
// The verdict uses ink when it is there. With ink frames, a box none of whose glyphs is painted (coverage < 20 %
// everywhere: under an opaque card, masked away) is `hidden` — must-read text that can't be seen at its hero frame, not
// a contrast of 1:1. Shadowed / haloed text (a text-shadow) is also measured against the -shadow frame (glyphs hidden,
// shadows kept): low without its shadow but fine against it = INFO "check by eye" (`shadowed`), not a WARN. A frame
// that can't be decoded is `unreadable` (INFO, never a crash).
export function contrastCheck({ dir, audits, W, H }) {
  const tdir = join(dir, 'textless'), rows = [], outlined = [], missing = [], hidden = [], shadowed = [], unreadable = [];
  const p2 = v => v.length ? v.sort((p, q) => p - q)[Math.floor((v.length - 1) * CONTRAST.pct)] : null;
  const lowOf = (w2, a2, big) => w2 < (big ? CONTRAST.wcagBig : CONTRAST.wcag) || a2 < (big ? CONTRAST.apcaBig : CONTRAST.apca);
  for (const a of audits) {
    if (!a.boxes.some(b => !b.ui)) continue;
    if (a.textlessError) { unreadable.push({ shot: a.shot, file: 'textless frames', why: a.textlessError }); continue; }
    if (!a.textless || !existsSync(join(tdir, a.textless))) { missing.push(a.shot); continue; }
    const realPath = a.real ? join(tdir, a.real) : join(dir, 'frames', a.frame);
    if (!existsSync(realPath)) { missing.push(a.shot); continue; }
    let R, B, K0 = null, K1 = null, S = null, file = realPath;
    const inkOk = Array.isArray(a.ink) && a.ink.every(f => existsSync(join(tdir, f)));
    try {
      R = rgbOf(realPath, W, H); file = a.textless; B = rgbOf(join(tdir, a.textless), W, H);
      if (inkOk) { file = a.ink[0]; K0 = rgbOf(join(tdir, a.ink[0]), W, H); file = a.ink[1]; K1 = rgbOf(join(tdir, a.ink[1]), W, H); }
      if (a.shadow && existsSync(join(tdir, a.shadow))) { file = a.shadow; S = rgbOf(join(tdir, a.shadow), W, H); }
    } catch (e) { unreadable.push({ shot: a.shot, file: String(file).split('/').pop(), why: String(e.message || e).split('\n')[0].replace(/\S*\//g, '').slice(0, 120) }); continue; }
    for (const b of a.boxes) {
      if (b.ui) continue;
      const tag = `${a.shot} "${b.text.slice(0, 24)}"`;
      if (b.outlined) { outlined.push(tag); continue; }
      const pad = Math.max(2, b.px * .12), regions = b.words && b.words.length ? b.words : [[b.x0, b.y0, b.x1, b.y1]];
      const M = { diff: { w: [], a: [] }, ink: { w: [], a: [] }, shadow: { w: [], a: [] } };
      let maxd = 0, glyphPx = 0;
      const d = o => Math.max(Math.abs(R[o] - B[o]), Math.abs(R[o + 1] - B[o + 1]), Math.abs(R[o + 2] - B[o + 2]));
      const cov = o => Math.max(0, K1[o] - K0[o], K1[o + 1] - K0[o + 1], K1[o + 2] - K0[o + 2]);
      for (const [x0, y0, x1, y1] of regions) {
        const X0 = Math.max(0, Math.floor(x0 - pad)), Y0 = Math.max(0, Math.floor(y0 - pad)), X1 = Math.min(W, Math.ceil(x1 + pad)), Y1 = Math.min(H, Math.ceil(y1 + pad));
        if (X1 <= X0 || Y1 <= Y0) continue;
        const px = []; for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) px.push((y * W + x) * 3);
        const measure = (m, score) => {
          let top = 0; for (const o of px) { const v = score(o); if (v > top) top = v; }
          if (m === 'diff') maxd = Math.max(maxd, top);
          if (top < (m === 'ink' ? 51 : 4)) { if (m === 'diff') { M.diff.w.push(1); M.diff.a.push(0); } return; }   // nothing drawn here
          const core = px.filter(o => score(o) >= CONTRAST.core * top);
          if (m === 'ink') glyphPx += core.length;
          const med = c => { const v = core.map(o => R[o + c]).sort((p, q) => p - q); return v[v.length >> 1]; };
          const txt = [med(0), med(1), med(2)];
          for (const o of core) { const bg = [B[o], B[o + 1], B[o + 2]]; M[m].w.push(wcag(txt, bg)); M[m].a.push(Math.abs(apca(txt, bg))); }
          // the same glyph pixels against the frame that keeps the text's shadows (b.shadowed only)
          if (m === 'ink' && S && b.shadowed) for (const o of core) { const bg = [S[o], S[o + 1], S[o + 2]]; M.shadow.w.push(wcag(txt, bg)); M.shadow.a.push(Math.abs(apca(txt, bg))); }
        };
        measure('diff', d);
        if (inkOk) measure('ink', cov);
      }
      // not one glyph painted at its hero frame: no glyph coverage AND the real frame equals the textless one there
      if (inkOk && !M.ink.w.length && maxd < 4) { hidden.push(tag); continue; }
      const m = inkOk && M.ink.w.length ? 'ink' : 'diff';
      if (!M[m].w.length) continue;
      const big = b.px >= CONTRAST.big, w2 = p2(M[m].w), a2 = p2(M[m].a), dw = p2(M.diff.w), dap = p2(M.diff.a);
      const sw = M.shadow.w.length ? p2(M.shadow.w) : null, sa = M.shadow.w.length ? p2(M.shadow.a) : null;
      let low = lowOf(w2, a2, big), shade = null;
      if (low && b.shadowed) { shade = sw != null ? { wcag: +sw.toFixed(2), apca: +sa.toFixed(1), low: lowOf(sw, sa, big) } : { low: null }; if (!shade.low) { low = false; shadowed.push({ tag, wcag: w2, apca: a2, against: shade }); } }
      rows.push({ shot: a.shot, text: b.text.slice(0, 40), px: +b.px.toFixed(1), wcag: +w2.toFixed(2), apca: +a2.toFixed(1), method: m,
        ...(m === 'ink' && dw != null ? { diff: { wcag: +dw.toFixed(2), apca: +dap.toFixed(1) } } : {}), ...(shade ? { shadow: shade } : {}), glyphPx: glyphPx || M.diff.w.length, maxDiff: maxd, low, tag });
    }
  }
  return { rows, low: rows.filter(r => r.low), outlined, hidden, shadowed, unreadable, missing: [...new Set(missing)] };
}

// ── purity: frames re-rendered in a shuffled order on one fresh page vs the film. purityFrames picks them from a seed of
// the timeline, by rank: every shot's inside frame (inside its hold if it has one), then every shot's first frame, then
// every last frame (each rank in a seeded shot order), then more inside frames round-robin — 3 per shot, at least 24,
// at most 120; `range` [a, b] keeps them inside it
export const PURITY_N = 24, PURITY_MAX = 120, PURITY_TOL = { max: 2, share: 1e-4 };
const mulberry = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const hashStr = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
export function purityFrames(tl, range = null) {
  const r = mulberry(hashStr(`${tl.slug}|${tl.id}|${tl.frames}|${tl.shots.map(s => `${s.id}:${s.block}:${s.f0}`).join(',')}`));
  const lo = range ? range[0] : 0, hi = range ? range[1] : tl.frames - 1, take = new Set();
  const shots = tl.shots.map(s => {
    const a = Math.max(lo, Math.round(s.f0 * 2)), b = Math.min(hi, Math.round(s.f1 * 2) - 1);
    if (a > b) return null;
    const hold = s.hold ? [Math.max(a, Math.round((s.f0 + Number(s.hold[0])) * 2) + 1), Math.min(b, Math.round((s.f0 + Number(s.hold[1])) * 2))] : null;
    const inside = () => a + 1 < b ? a + 1 + Math.floor(r() * (b - a - 1)) : a;
    return { a, b, inside, held: () => hold && hold[0] <= hold[1] ? hold[0] + Math.floor(r() * (hold[1] - hold[0] + 1)) : inside() };
  }).filter(Boolean);
  const shuffle = v => { for (let i = v.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [v[i], v[j]] = [v[j], v[i]]; } return v; };
  shuffle(shots);
  const want = Math.min(Math.max(PURITY_N, 3 * shots.length), PURITY_MAX, hi - lo + 1), add = f => { if (take.size < want) take.add(f); };
  for (const s of shots) add(s.held());
  for (const s of shots) add(s.a);
  for (const s of shots) add(s.b);
  for (let guard = 0; take.size < want && guard < 50; guard++)
    for (const s of shots) { let f = s.inside(); for (let t = 0; take.has(f) && t < 8; t++) f = s.inside(); add(f); }
  return shuffle([...take]);
}
// one film frame against another rendering of it: max |Δ| per channel, the pixels beyond the tolerance, pass
function frameDiff(a, b, W, H) {
  const A = rgbOf(a, W, H), B = rgbOf(b, W, H);
  let max = 0, over = 0;
  for (let p = 0; p < A.length; p += 3) { const d = Math.max(Math.abs(A[p] - B[p]), Math.abs(A[p + 1] - B[p + 1]), Math.abs(A[p + 2] - B[p + 2])); if (d > max) max = d; if (d > PURITY_TOL.max) over++; }
  return { max, over, share: +(over / (W * H)).toFixed(7), pass: max <= PURITY_TOL.max || over <= PURITY_TOL.share * W * H };
}
// purity, run by lv.mjs --film right after an aspect's frames are drawn (film = that renderFrames result, idx = the film
// frame numbers it drew, in its order; render = renderFrames). Never throws: a failure is written as {error} and QA
// reports "not measured". → purity.json (QA reads it, so --qa re-runs report it):
//   frames     the purityFrames drawn again in shuffled order on one fresh page, each against the film: pixels; `state`
//              = the page's visible DOM state differs between that order and the reverse order (a block keeping state
//              between render calls); `anims` = CSS transitions / animations running on that page
//   replay     each frame beyond the tolerance whose state doesn't depend on order, drawn again on a fresh page the
//              way the film drew it (from its shot's first frame — or, when its film page began inside the shot, after
//              a warm-up from that page's first frame): `history` true = it then matches the film — the difference is
//              Chrome's raster history (only out-of-order drawing shows it), false = something isn't a function of t
//   seams      every worker seam of this render (a page's first frame, drawn after its warm-up instead of the frame
//              before it) and a --range render's first frame: the film's frame against the same frame drawn in order
//              from its shot's first frame — a difference carries on to the shot's end (calibration: dark-ui-check
//              frame 230, 20 frames past the seam at 210, still differs), so the film jumps slightly at the seam
//   filmAnims  the CSS transitions / animations running while the film's frames were drawn (film.anims), per shot
// workers: the film's --workers — at most that many replays (each its own Chrome) run at a time, never more than 3
// (verify pass: a --workers 1 or 2 run, kept low to spare a hot machine, must not open three browsers here)
export async function purityRun({ job, tl, aspect, dir, prints, range = null, film = null, idx = null, render, workers = 3, log = console.log }) {
  const { W, H } = ASPECTS[aspect], pdir = join(dir, 'purity'), starts = [0, ...tl.cuts], pad = i => String(i).padStart(5, '0');
  const shotAt = k => tl.shots[starts.filter(c => c <= k).length - 1].id, filmPng = i => join(dir, 'frames', `${pad(i)}.png`);
  const filmAnims = [];
  if (film && film.anims && idx) idx.forEach((i, k) => {
    if (!film.anims[k]) return;
    const sh = shotAt(i), cur = filmAnims.find(x => x.shot === sh && x.what === film.anims[k]);
    if (cur) { cur.n++; cur.last = i; } else filmAnims.push({ shot: sh, what: film.anims[k], first: i, last: i, n: 1 });
  });
  const base = { aspect, cut: tl.id, prints, range, tol: PURITY_TOL, history: 'shot', filmAnims };
  const save = res => { writeFileSync(join(dir, 'purity.json'), JSON.stringify({ ...base, ...res }, null, 1)); return { ...base, ...res }; };
  rmSync(pdir, { recursive: true, force: true });
  try {
    const order = purityFrames(tl, range);
    const pr = await render({ job, tl, aspect, workers: 1, sigs: true, anims: true, frames: order.map(i => ({ f: i / 2, path: join(pdir, `${pad(i)}.png`) })) });
    const frames = order.map((i, k) => {
      let d; try { d = frameDiff(filmPng(i), join(pdir, `${pad(i)}.png`), W, H); } catch (e) { d = { error: String(e.message || e).split('\n')[0].replace(/\S*\//g, '').slice(0, 160) }; }
      return { i, shot: shotAt(i), ...d, state: pr.sigs[k] !== pr.sigs2[k], ...(pr.anims && pr.anims[k] ? { anims: pr.anims[k] } : {}) };
    });
    // the history each frame was drawn with in the film: its page's warm-up (every shot's hero frame), then the page's
    // run of frames. Calibration (dark-ui-check, phone/panel text): what matters is that history since the frame's shot
    // first showed — drawn from the shot's first frame a frame matches the film, drawn after only the 60 frames before
    // it, it doesn't (the earlier shots are hidden then and don't count). So each target is drawn again from its shot's
    // first frame, or from its film page's first frame after a fresh warm-up when that page began inside the shot.
    const pos = new Map((idx || []).map((i, k) => [i, k])), heroes = tl.shots.map(s => s.f0 + s.heroF);
    const shotStart = i => starts.filter(c => c <= i).pop();
    const runStart = i => { let k = pos.get(i); if (k == null || !film || !film.pages) return null; while (k > 0 && film.pages[k - 1] === film.pages[k] && idx[k - 1] === idx[k] - 1) k--; return idx[k]; };
    const seamAt = idx && film && film.pages ? idx.filter((i, k) => i > 0 && (k === 0 ? !!range : film.pages[k] !== film.pages[k - 1] || idx[k - 1] !== i - 1)) : [];
    // replay: as the film drew it (from the later of shot start / page start); seam: as one page drawing in order would
    const targets = [...frames.filter(x => !x.error && !x.pass && !x.state).map(x => { const r0 = runStart(x.i), a = shotStart(x.i); return { kind: 'replay', i: x.i, from: Math.max(a, r0 ?? a), warm: r0 != null && r0 > a }; }),
      ...seamAt.filter(i => existsSync(filmPng(i))).map(i => ({ kind: 'seam', i, from: shotStart(i), warm: false }))];
    const groups = new Map();
    for (const t of targets) { const key = `${t.from}|${t.warm}`; if (!groups.has(key)) groups.set(key, { from: t.from, warm: t.warm, to: t.i, list: [] }); const g = groups.get(key); g.list.push(t); g.to = Math.max(g.to, t.i); }
    const replay = [], seams = [], rdir = join(pdir, 'replay'), G = [...groups.values()];
    const shot = (g, i) => join(rdir, `${g.from}-${g.warm ? 'w' : 'n'}-${pad(i)}.png`);
    const par = Math.max(1, Math.min(3, Math.floor(Number(workers)) || 1));
    for (let n = 0; n < G.length; n += par) await Promise.all(G.slice(n, n + par).map((g, m) => {
      const keep = new Set(g.list.map(t => t.i));
      const list = [...(g.warm ? heroes.map((f, j) => ({ f, path: join(rdir, 'pre', `${n + m}-h${j}.png`) })) : []),
        ...Array.from({ length: g.to - g.from + 1 }, (_, j) => g.from + j).map(i => ({ f: i / 2, path: keep.has(i) ? shot(g, i) : join(rdir, 'pre', `${n + m}-${i}.png`) }))];
      return render({ job, tl, aspect, workers: 1, frames: list });
    }));
    rmSync(join(rdir, 'pre'), { recursive: true, force: true });
    const diffOf = (a, b) => { try { return frameDiff(a, b, W, H); } catch (e) { return { error: String(e.message || e).split('\n')[0].replace(/\S*\//g, '').slice(0, 160) }; } };
    const D1 = new Map(G.flatMap(g => g.list.map(t => [`${t.kind}:${t.i}`, diffOf(filmPng(t.i), shot(g, t.i))])));
    // a difference warns only when it repeats: every replay / seam frame that differs from the film is drawn once more on
    // a fresh page with the same predecessors (its group's frames from the same first frame, the same warm-up); one that
    // matches then was a one-off raster glitch (a tile drawn late under load), not something the film shows
    const again = new Map(), adir = join(pdir, 'again'), G2 = G.map(g => ({ g, fail: g.list.filter(t => { const d = D1.get(`${t.kind}:${t.i}`); return !d.error && !d.pass; }) })).filter(x => x.fail.length);
    const shot2 = (g, i) => join(adir, `${g.from}-${g.warm ? 'w' : 'n'}-${pad(i)}.png`);
    for (let n = 0; n < G2.length; n += par) await Promise.all(G2.slice(n, n + par).map(({ g, fail }, m) => {
      const keep = new Set(fail.map(t => t.i)), to = Math.max(...fail.map(t => t.i));
      const list = [...(g.warm ? heroes.map((f, j) => ({ f, path: join(adir, 'pre', `${n + m}-h${j}.png`) })) : []),
        ...Array.from({ length: to - g.from + 1 }, (_, j) => g.from + j).map(i => ({ f: i / 2, path: keep.has(i) ? shot2(g, i) : join(adir, 'pre', `${n + m}-${i}.png`) }))];
      return render({ job, tl, aspect, workers: 1, frames: list });
    }));
    rmSync(join(adir, 'pre'), { recursive: true, force: true });
    for (const { g, fail } of G2) for (const t of fail) again.set(`${t.kind}:${t.i}`, diffOf(filmPng(t.i), shot2(g, t.i)));
    for (const g of G) for (const t of g.list) {
      const d = D1.get(`${t.kind}:${t.i}`), a = again.get(`${t.kind}:${t.i}`);
      const via = { from: g.from, warm: g.warm, ...(a ? { again: a, oneOff: !a.error && !!a.pass } : {}) };
      if (t.kind === 'replay') { const x = frames.find(y => y.i === t.i); x.history = d.error ? null : d.pass || !!(a && !a.error && a.pass); if (a && !a.error && a.pass) x.oneOff = true; replay.push({ i: t.i, shot: x.shot, ...via, ...d }); }
      else seams.push({ i: t.i, shot: shotAt(t.i), ...via, ...d });
    }
    // keep only the PNGs that differ (to look at); the matching ones are deleted once purity.json holds their numbers —
    // a film's purity/ folder otherwise kept 24–120 full frames plus replays (review fix #10)
    const drop = f => rmSync(f, { force: true });
    for (const x of frames) if (x.pass) drop(join(pdir, `${pad(x.i)}.png`));
    for (const g of G) for (const t of g.list) {
      const d = D1.get(`${t.kind}:${t.i}`), a = again.get(`${t.kind}:${t.i}`);
      if (d && d.pass) drop(shot(g, t.i));
      if (a && a.pass) drop(shot2(g, t.i));
    }
    for (const d of [adir, rdir, pdir]) { try { if (!readdirSync(d).length) rmSync(d, { recursive: true, force: true }); } catch { /* not there */ } }
    return save({ order, frames, replay, seams });
  } catch (e) {
    const why = String(e.message || e).replace(/\s*\n\s*/g, ' ').replace(/\S*\//g, '').slice(0, 200);
    log(`  purity not measured: ${why}`);
    return save({ error: why });
  }
}
// --film --no-purity: the check is skipped for this render (iteration renders on a hot laptop: purity re-draws 24–120
// frames on a fresh page, +~30 % on a film); QA reports it as not measured
export function puritySkip({ tl, aspect, dir, prints, range = null }) {
  rmSync(join(dir, 'purity'), { recursive: true, force: true });
  writeFileSync(join(dir, 'purity.json'), JSON.stringify({ aspect, cut: tl.id, prints, range, skipped: true }, null, 1));
}
// shot id → letterbox bar px, for the shots that have bars
export const barsOf = (tl, W, H) => Object.fromEntries(tl.shots.map(s => [s.id, letterboxBar(s.letterbox, W, H)]).filter(([, b]) => b));

export function qaFilm({ tl, aspect, dir, audioDir, mp4, shotLog, audits, pages = null, audioPrint = null, log = console.log }) {
  const { W, H } = ASPECTS[aspect], results = [];
  rmSync(join(dir, 'qa.json'), { force: true });      // a QA run that stops half-way must not leave an older verdict behind
  const check = (name, pass, detail, level = pass ? 'PASS' : 'FAIL', data = null) => { results.push({ name, level, pass: level !== 'FAIL', detail, ...(data ? { data } : {}) }); log(`${level.padEnd(4)}  ${name.padEnd(8)} ${detail}`); };
  const note = (name, warn, detail, data) => check(name, true, detail, warn ? 'WARN' : 'INFO', data);     // round-1 frame checks: never FAIL
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
    const soft = softCut(s, tl.shots[k + 1]);
    if (s.out === 'cut' && soft) check('cut', true, `${msg} — soft cut by design (${soft}), boundary proven by the shot log`, 'INFO');
    else if (s.out === 'cut') check('cut', d >= 1.25 * nb && d > 1, msg);
    else check('cut', true, `${msg} — ${soft ? `soft cut by design (${soft})` : s.out}, boundary proven by the shot log`, 'INFO');
  });
  // cut continuity from the logged camera (cams.json): WARN / INFO only; the numbers per cut go into qa.json
  const CC = cutContinuity({ tl, cams: J(join(dir, 'cams.json')), W, H });
  check('continuity', true, continuitySummary(CC), 'INFO'); results.at(-1).cuts = CC.cuts;
  for (const w of CC.warns) check('continuity', true, w, 'WARN');
  const { runs, stillIdx } = freezeRuns(input, pages);
  const held = i => tl.holds.some(([a, b]) => i >= a && i <= b);
  const badRuns = runs.filter(r => !(held(r[0]) && held(r[1])));
  const holdPairs = tl.holds.reduce((a, [x, y]) => a + (y - x + 1), 0), heldStill = stillIdx.filter(held).length;
  check('freeze', !badRuns.length, badRuns.length ? `frozen (≥ 4 identical frames) at ${badRuns.slice(0, 8).map(([a, b]) => `${a - 1}–${b}`).join(', ')}${badRuns.length > 8 ? ` … (${badRuns.length} runs)` : ''}`
    : `no frozen runs${holdPairs ? `; holds verified still for ${heldStill}/${holdPairs} frame pairs` : ''}`);
  const refDir = join(dir, 'bgref'), nRefs = existsSync(refDir) ? readdirSync(refDir).filter(f => f.endsWith('.png')).length : 0;
  const TH = thumbs(input, W, H);          // the frames' 1/10-scale grey thumbnails: content, dead air, flash
  if (nRefs !== n) check('content', false, `background references: ${nRefs}/${n} — re-run --film`);
  else {
    const c = contentCheck({ framesInput: input, refsInput: ['-framerate', '60', '-i', join(refDir, '%05d.png')], W, H, T: TH });
    check('content', !c.empty.length, c.empty.length ? `near-empty frames (look like the bare background): ${c.empty.slice(0, 12).join(', ')}${c.empty.length > 12 ? ` … (${c.empty.length})` : ''}`
      : `every frame has content beyond its background (min ${c.minCount} differing thumbnail px)`);
  }
  const bars = barsOf(tl, W, H), T = textIssues(audits, W, H, bars, tl.delivery);
  check('text', !T.clipped.length && !T.tiny.length, T.clipped.length || T.tiny.length ? [T.clipped.length && `clipped by the frame: ${T.clipped.join('; ')}`, T.tiny.length && `too small: ${T.tiny.join('; ')}`].filter(Boolean).join(' | ')
    : `${T.boxes} text boxes across ${audits.length} hero frames, none clipped or tiny${Object.keys(bars).length ? `, none under a letterbox bar (${Object.entries(bars).map(([id, b]) => `${id} ${b}px`).join(', ')})` : ''}`);
  if (T.unsafe.length) check('text', true, `outside the ${T.portrait ? 'platform-UI' : 'title'}-safe area: ${T.unsafe.slice(0, 6).join('; ')}`, 'WARN');
  if (T.small.length) check('text', true, `small (< 26 px): ${T.small.slice(0, 6).join('; ')}`, 'WARN');
  // ── round-1 frame checks (WARN / INFO; numbers in each result's data). Each runs guarded: one that can't run (an
  // unreadable frame, a bug) says "not measured" instead of stopping QA ──
  const guard = (name, fn) => { try { fn(); } catch (e) { note(name, false, `not measured: ${String(e.message || e).split('\n')[0].slice(0, 160)}`); } };
  if (T.floor.length) note('text', true, floorNote(T, aspect), { floors: T.floors, under: T.floor });
  guard('contrast', () => {
    const C = contrastCheck({ dir, audits, W, H }), ctag = r => `${r.tag} ${r.wcag.toFixed(1)}:1 Lc ${r.apca.toFixed(0)}${r.px >= CONTRAST.big ? ` (${r.px.toFixed(0)} px)` : ''}`;
    const cdata = { rows: C.rows.map(({ tag: _t, ...r }) => r), outlined: C.outlined, hidden: C.hidden, shadowed: C.shadowed.map(x => x.tag), unreadable: C.unreadable, missing: C.missing, thresholds: CONTRAST };
    const unread = C.unreadable.map(x => `${x.shot} (${x.why})`).join('; ');
    if (!C.rows.length && !C.outlined.length && !C.hidden.length) { note('contrast', false, C.unreadable.length ? `not measured for ${unread} — re-run --film` : C.missing.length ? `not measured: no textless frames for ${C.missing.join(', ')} (they are made by --film)` : 'no must-read text at the hero frames', cdata); return; }
    const worst = [...C.rows].sort((a, b) => a.wcag - b.wcag)[0], more = (a, k = 6) => a.length > k ? ` … (${a.length})` : '';
    if (C.low.length) note('contrast', true, `low contrast at the hero frames (WCAG < 4.5:1 or APCA Lc < 60; ≥ 48 px: 3:1 / 45): ${[...C.low].sort((a, b) => a.wcag - b.wcag).slice(0, 6).map(ctag).join('; ')}${more(C.low)} — raise it: another text colour, a plate behind the line, or more bgDim over footage`, cdata);
    else if (worst) note('contrast', false, `${C.rows.length} must-read text boxes at ${new Set(C.rows.map(r => r.shot)).size} hero frames, worst ${ctag(worst)}`, cdata);
    if (C.hidden.length) note('contrast', true, `must-read text not painted at its hero frame (covered by something opaque, masked or faded out — nothing to read there): ${C.hidden.slice(0, 6).join('; ')}${more(C.hidden)} — show it at the hero frame, or set the block's hero to a frame where it shows`);
    if (C.shadowed.length) note('contrast', false, `shadowed text, check by eye — low against the plain background, it reads against its own shadow or halo: ${C.shadowed.slice(0, 6).map(x => `${x.tag} ${x.wcag.toFixed(1)}:1 Lc ${x.apca.toFixed(0)}${x.against.wcag != null ? ` (${x.against.wcag.toFixed(1)}:1 Lc ${x.against.apca.toFixed(0)} against its shadow)` : ''}`).join('; ')}${more(C.shadowed)}`);
    if (C.outlined.length) note('contrast', false, `outlined text, check by eye: ${C.outlined.slice(0, 6).join('; ')}${more(C.outlined)}`);
    if (C.missing.length) note('contrast', false, `not measured for ${C.missing.join(', ')} (no textless frames — a --range render keeps older ones)`);
    if (C.unreadable.length) note('contrast', false, `not measured for ${unread} — re-run --film`);
  });
  guard('deadair', () => {
    const DA = deadAir({ T: TH, tl });
    const why = r => r.why === 'copy' ? `its copy needs ${r.allow.toFixed(2)} s` : r.why === 'end lockup' ? `an end lockup may hold ${r.allow.toFixed(2)} s` : `no read copy: floor ${r.allow.toFixed(2)} s`;
    const fmtRun = r => `${r.shot} at ${r.t.toFixed(2)} s for ${r.len.toFixed(2)} s (${why(r)}: ${(r.len - r.allow).toFixed(2)} s over)`, more = a => a.length > 6 ? ` … (${a.length})` : '';
    if (DA.dead.length) note('deadair', true, `nothing on screen moves for more than ${DA.grace} s longer than its copy needs to be read: ${DA.dead.slice(0, 6).map(fmtRun).join('; ')}${more(DA.dead)} — keep something moving (a drift, a cursor, a second beat) or shorten the shot`, DA);
    if (DA.near.length) note('deadair', false, `near dead air (up to ${DA.grace} s longer than its copy needs; a slow camera push alone scores as still): ${DA.near.slice(0, 6).map(fmtRun).join('; ')}${more(DA.near)}`, DA.dead.length ? null : DA);
    if (!DA.dead.length && !DA.near.length) { const longest = [...DA.longest].sort((a, b) => b.still / b.allow - a.still / a.allow)[0]; note('deadair', false, `no still stretch longer than its copy needs (closest: ${longest.shot} still for ${longest.still.toFixed(2)} s of ${longest.allow.toFixed(2)} s)`, DA); }
    // against the pace of the launch reels we measured (no whole-frame still past ~0.57 s), not only the reading allowance
    // (review fix #11) — INFO: a slow push alone counts as still here, so this is a pointer to the slowest holds, not a fault
    const slow = DA.longest.filter(x => x.still > DEADAIR_PACE && x.why !== 'end lockup').sort((a, b) => b.still - a.still);     // (the closing lockup may hold)
    if (slow.length) note('deadair', false, `${slow.length} shot${slow.length === 1 ? '' : 's'} hold${slow.length === 1 ? 's' : ''} a near-still stretch over ${DEADAIR_PACE} s (the launch reels we measured hold none past ~0.57 s): ${slow.slice(0, 8).map(x => `${x.shot} ${x.still.toFixed(2)} s`).join(', ')}${slow.length > 8 ? ' …' : ''} — a second beat in the hold (a glint, a chip pulse, a cursor) keeps the pace`);
  });
  guard('flash', () => {
    const FL = flashCheck({ T: TH });
    note('flash', FL.spans.length > 0, FL.spans.length ? `more than ${FLASH_MAX} flashes in a second over ≥ 25 % of a 10° field (WCAG 2.3.1): ${FL.spans.slice(0, 6).map(s => `${s.t0.toFixed(2)}–${s.t1.toFixed(2)} s (${s.flashes} flashes)`).join(', ')} — slow the strobe or shrink the flashing area`
      : `at most ${FL.worst.flashes} flash${FL.worst.flashes === 1 ? '' : 'es'} in any second (WCAG 2.3.1 allows ${FLASH_MAX})`, FL);
  });
  guard('purity', () => {
    const pj = J(join(dir, 'purity.json'));
    if (!pj) { note('purity', false, existsSync(join(dir, 'purity.json')) ? 'not measured (purity.json is unreadable — re-run --film)' : 'not measured (purity.json is written by --film)'); return; }
    if (pj.skipped) { note('purity', false, 'not measured (--film --no-purity) — run the final --film without --no-purity'); return; }
    if (!rj || JSON.stringify(pj.prints) !== JSON.stringify(rj.prints)) { note('purity', false, 'purity.json is from an earlier render — not measured for these frames (re-run --film)'); return; }
    const fr = x => `frame ${x.i} (${x.shot}) max Δ ${x.max}, ${x.over} px`, list = a => `${a.slice(0, 6).map(fr).join('; ')}${a.length > 6 ? ` … (${a.length})` : ''}`;
    const shotsOf = a => [...new Set(a.map(x => x.shot))].join(', ');
    const F = pj.frames || [], ok = F.filter(x => !x.error), bad = F.filter(x => x.error), seams = pj.seams || [];
    const data = { frames: F, replay: pj.replay, seams, filmAnims: pj.filmAnims, tol: pj.tol, history: pj.history, range: pj.range };
    // running CSS transitions / animations: while the film was drawn (every frame) or on the shuffled page
    const anims = [...(pj.filmAnims || []).map(x => `${x.shot} ${x.what} (${x.n} frame${x.n === 1 ? '' : 's'}, ${x.first}–${x.last})`),
      ...ok.filter(x => x.anims && !(pj.filmAnims || []).some(y => y.shot === x.shot)).map(x => `${x.shot} ${x.anims} (frame ${x.i}, drawn out of order)`)];
    if (anims.length) note('purity', true, `CSS transitions / animations run while frames are drawn — they follow the wall clock, not t, so a frame depends on how long ago the one before it was drawn (rule 2: derive every value from t): ${anims.slice(0, 6).join('; ')}${anims.length > 6 ? ` … (${anims.length})` : ''}`, data);
    if (pj.error) { note('purity', false, `not measured: ${pj.error} — re-run --film`, data); return; }
    // history: true = reproduced in order (raster history), false = not reproduced, null = its replay couldn't be read
    const state = ok.filter(x => x.state), lag = ok.filter(x => !x.pass && !x.state && x.history !== true && x.history !== null);
    // a seam or an out-of-order difference in a shot already flagged here is explained by that (an impure block)
    const flagged = new Set([...(pj.filmAnims || []).map(x => x.shot), ...ok.filter(x => x.anims).map(x => x.shot), ...state.map(x => x.shot), ...lag.map(x => x.shot)]);
    const hist = ok.filter(x => !x.pass && !x.state && x.history === true && !flagged.has(x.shot));
    const glitch = seams.filter(x => !x.error && !x.pass && !x.oneOff && !flagged.has(x.shot)), span = id => { const s = tl.shots.find(y => y.id === id); return `${Math.round(s.f0 * 2)},${Math.round(s.f1 * 2) - 1}`; };
    if (state.length) note('purity', true, `${shotsOf(state)}: the page's state at ${state.length} frame(s) depends on the order frames are drawn in (state kept between render calls — derive everything from t): ${list(state)}`, data);
    if (lag.length) note('purity', true, `${shotsOf(lag)}: ${lag.length}/${F.length} frames differ from the film even when drawn again the way the film drew them (in order from the shot's first frame) — something on the page isn't a function of t (a CSS transition or animation, an image or footage frame that wasn't ready, a timer): ${list(lag)}`, data);
    if (glitch.length) note('purity', true, `a worker seam lands inside a shot and Chrome draws the rest of that shot differently from one page drawing it in order (the seam frame, its page's first, vs the same frame drawn in order from the shot's first frame: ${list(glitch)}) — a small jump at the seam (glyph edges shift); to draw the shot in one piece: ${[...new Set(glitch.map(x => x.shot))].map(id => `--film --range ${span(id)} --workers 1 (${id})`).join('; ')}`, data);
    const once = [...(pj.replay || []).filter(x => x.oneOff), ...seams.filter(x => x.oneOff)];
    if (once.length) note('purity', false, `${once.length} frame(s) (${shotsOf(once)}) differed from the film once and matched when drawn again on a fresh page with the same predecessors — a one-off raster glitch in the check's own render, not in the film: ${list(once)}`, data);
    if (hist.length) note('purity', false, `${hist.length}/${F.length} frames (${shotsOf(hist)}) differ only when drawn out of order — drawn again in order from their shot's first frame they match it (Chrome's raster history; the film draws its frames in order): ${list(hist)}`, data);
    const unproven = ok.filter(x => !x.pass && !x.state && x.history === null), replayErr = (pj.replay || []).find(x => x.error);
    if (bad.length) note('purity', false, `not measured for ${bad.length} frame(s): ${bad[0].error} — re-run --film`, data);
    if (unproven.length) note('purity', false, `${unproven.length} frame(s) differ when drawn out of order and couldn't be drawn again in order (${replayErr ? replayErr.error : 'replay missing'}) — not measured: ${list(unproven)}`, data);
    if (!anims.length && !state.length && !lag.length && !glitch.length && !hist.length && !unproven.length && ok.length) {
      const mx = Math.max(...ok.map(x => x.max)), ov = Math.max(...ok.map(x => x.over)), sm = seams.filter(x => !x.error);
      note('purity', false, `${ok.length} frames${pj.range ? ` in ${pj.range.join('–')}` : ''} drawn again in shuffled order on a fresh page match the film (max Δ ${mx}, ≤ ${ov} px beyond ±${pj.tol.max}) and their page state doesn't depend on draw order${sm.length ? `; ${sm.length} worker seam${sm.length === 1 ? '' : 's'} match the same frames drawn in order` : ''}`, data);
    }
  });
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
