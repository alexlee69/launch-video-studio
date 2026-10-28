// QA a finished job. Prints one line per check and exits 1 if any check fails; also writes DIR/out/qa.json.
//   node qa.mjs --job DIR [--mp4 FILE]       (default FILE: the one *-sting.mp4 in DIR)
// Checks
//   video     720 frames, 1080×1080, 60000/1001 fps, H.264 yuv420p, bt709 primaries/transfer/matrix, tv range
//   cuts      frame-to-frame luma difference (tblend difference → signalstats YAVG), on the PNG frames and on the mp4:
//             the 6 largest differences are exactly the 6 shot changes at 59.94-fps indices 144, 202, 318, 430, 490, 602
//             (f72, f101, f159, f215, f245, f301 — 144/202/318/602 are the whoosh cuts), and each is a one-frame spike
//             (≥ 1.25× every neighbour within 3 frames), i.e. a hard cut, no dissolve
//   freeze    pixel-identical neighbours (YMAX == 0) in the PNG frames occur at indices 539–574 (the S7 hold, f269–287)
//             and nowhere else (the mp4 can't show this: x264 leaves ±1–2 code values of noise on held frames)
//   loudness  ebur128 on the mp4's audio: −14 ± 0.2 LUFS integrated, true peak ≤ −1 dBTP
//   duration  audio is exactly 12.075 s (579 600 samples @ 48 kHz) in master.wav and in the mp4
//   sfx       on the SFX-only stem: onsets within 1 ms of 0.100, 2.330, 3.830, 6.240, 8.175 s (energy-ratio detector:
//             forward 1.5 ms vs trailing 20 ms energy — a level threshold gets fooled by reverb tails), and the
//             whoosh envelopes peak within 10 ms of 2.402, 3.370, 5.305, 10.043 s
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync, mkdirSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { arg, jobDir } from './brand.mjs';

const argv = process.argv.slice(2);
const job = jobDir(argv);
let mp4 = arg(argv, '--mp4', null);
if (!mp4) {
  const c = existsSync(job) ? readdirSync(job).filter(f => f.endsWith('-sting.mp4')) : [];
  if (c.length !== 1) { console.error(`expected one *-sting.mp4 in ${job}, found ${c.length}; pass --mp4`); process.exit(2); }
  mp4 = join(job, c[0]);
}
const SR = 48000, FPS = 60000 / 1001, N = 579600;
const CUTS = [144, 202, 318, 430, 490, 602], HOLD = [539, 574];
const ONSETS = [0.100, 2.330, 3.830, 6.240, 8.175], WHOOSH = [2.402, 3.370, 5.305, 10.043];

const results = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(9)} ${detail}`); };
const sh = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28 });
const probe = (file, sel) => JSON.parse(sh('ffprobe', ['-v', 'error', '-select_streams', sel, '-show_entries',
  'stream=codec_name,width,height,r_frame_rate,nb_frames,pix_fmt,color_space,color_primaries,color_transfer,color_range,sample_rate,duration_ts,time_base',
  '-of', 'json', file]).stdout).streams[0] || {};

// ── video stream ──
{
  const v = probe(mp4, 'v:0');
  const want = { codec_name: 'h264', width: 1080, height: 1080, r_frame_rate: '60000/1001', nb_frames: '720', pix_fmt: 'yuv420p',
    color_space: 'bt709', color_primaries: 'bt709', color_transfer: 'bt709', color_range: 'tv' };
  const bad = Object.entries(want).filter(([k, x]) => String(v[k]) !== String(x)).map(([k, x]) => `${k}=${v[k]} (want ${x})`);
  check('video', !bad.length, bad.length ? bad.join(', ') : '720 × 1080², 59.94 fps, h264 yuv420p, bt709 tv');
}

// ── per-frame luma difference: cuts + freeze ──
const TMP = mkdtempSync(join(tmpdir(), 'sting-qa-'));      // a path with no filter-graph specials (the job path may have any)
process.on('exit', () => rmSync(TMP, { recursive: true, force: true }));
function diffRows(input, tag) {
  const tmp = join(TMP, `tblend-${tag}.txt`);
  const r = sh('ffmpeg', ['-hide_banner', '-v', 'error', ...input, '-vf',
    `tblend=all_mode=difference,signalstats,metadata=mode=print:file=${tmp}`, '-f', 'null', '-']);
  if (r.status) { console.error(r.stderr); process.exit(1); }
  const rows = [];
  let cur = null;
  for (const line of readFileSync(tmp, 'utf8').split('\n')) {
    const m = line.match(/pts_time:([\d.]+)/);
    if (m) { cur = { i: Math.round(Number(m[1]) * FPS) }; rows.push(cur); continue; }
    const a = line.match(/lavfi\.signalstats\.(YAVG|YMAX)=([\d.]+)/);
    if (a && cur) cur[a[1]] = Number(a[2]);
  }
  return rows;
}
function cuts(rows, label) {
  if (rows.length !== 719) return check(label, false, `expected 719 frame differences, got ${rows.length}`);
  const by = Object.fromEntries(rows.map(r => [r.i, r.YAVG]));
  const top = [...rows].sort((a, b) => b.YAVG - a.YAVG), got = top.slice(0, CUTS.length).map(r => r.i).sort((a, b) => a - b);
  const spikes = CUTS.map(c => ({ c, k: by[c] / Math.max(...[-3, -2, -1, 1, 2, 3].map(d => by[c + d] ?? 0)) }));
  const flat = spikes.filter(s => !(s.k >= 1.25));
  const ok = got.join() === CUTS.join() && !flat.length;
  const weakest = Math.min(...CUTS.map(c => by[c])), next = top[CUTS.length];
  check(label, ok, ok ? `top-${CUTS.length} diffs at ${got.join(', ')}; weakest cut ${weakest.toFixed(1)} vs next ${next.YAVG.toFixed(1)} @${next.i}; min spike ${Math.min(...spikes.map(s => s.k)).toFixed(2)}×`
    : `top-${CUTS.length} diffs at ${got.join(', ')} (want ${CUTS.join(', ')}); top-8 ${top.slice(0, 8).map(r => `${r.i}:${r.YAVG.toFixed(1)}`).join(' ')}`
      + (flat.length ? `; not a one-frame spike at ${flat.map(s => `${s.c} (${s.k.toFixed(2)}×)`).join(', ')}` : ''));
}
const frames = join(job, 'out/frames');
if (existsSync(join(frames, '00719.png'))) {
  const rows = diffRows(['-framerate', '60000/1001', '-i', join(frames, '%05d.png')], 'frames');
  cuts(rows, 'cuts/png');
  const zero = rows.filter(r => r.YMAX === 0).map(r => r.i);
  const want = Array.from({ length: HOLD[1] - HOLD[0] + 1 }, (_, k) => HOLD[0] + k);
  const extra = zero.filter(i => !want.includes(i)), missing = want.filter(i => !zero.includes(i));
  check('freeze', !extra.length && !missing.length, !extra.length && !missing.length ? `identical neighbours exactly at ${HOLD[0]}–${HOLD[1]} (${zero.length} pairs, S7 hold)`
    : [extra.length && `unexpected frozen frames at ${extra.slice(0, 12).join(',')}${extra.length > 12 ? '…' : ''}`,
       missing.length && `hold not frozen at ${missing.slice(0, 12).join(',')}${missing.length > 12 ? '…' : ''}`].filter(Boolean).join('; '));
} else check('cuts/png', false, `no PNG frames in ${frames} — the cut and freeze checks need them (re-run --film)`);
cuts(diffRows(['-i', mp4], 'mp4'), 'cuts/mp4');

// ── loudness + duration ──
{
  const s = sh('ffmpeg', ['-hide_banner', '-nostats', '-i', mp4, '-map', '0:a', '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-']).stderr;
  const I = Number((s.match(/I:\s+(-?[\d.]+) LUFS/g) || ['NaN']).pop().match(/-?[\d.]+|NaN/)[0]);
  const tpm = s.match(/True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS/), TP = tpm ? Number(tpm[1]) : NaN;
  check('loudness', Math.abs(I + 14) <= .2 && TP <= -1, `${I} LUFS integrated (−14 ± 0.2), true peak ${TP} dBTP (≤ −1)`);
  const a = probe(mp4, 'a:0'), m = probe(join(job, 'out/audio/master.wav'), 'a:0');
  const aOk = Number(a.duration_ts) === N && a.time_base === '1/48000' && Number(a.sample_rate) === SR, mOk = Number(m.duration_ts) === N;
  check('duration', aOk && mOk, `mp4 audio ${a.duration_ts} samples @ ${a.sample_rate} Hz, master.wav ${m.duration_ts} samples (want ${N} = 12.075 s)`);
}

// ── SFX timing on the SFX-only stem ──
{
  const stem = join(job, 'out/audio/sfx-stem.wav');
  const r = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-i', stem, '-ac', '1', '-f', 'f32le', '-'], { maxBuffer: 1 << 26 });
  const buf = r.stdout, x = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  const P = new Float64Array(x.length + 1);
  for (let i = 0; i < x.length; i++) P[i + 1] = P[i] + x[i] * x[i];
  const Wf = Math.round(.0015 * SR), Wb = Math.round(.02 * SR);
  const onset = t => {           // argmax of forward/trailing energy ratio within ±40 ms
    let best = -1, bi = 0;
    for (let i = Math.round((t - .04) * SR); i <= Math.round((t + .04) * SR); i++) {
      const ef = (P[i + Wf] - P[i]) / Wf, eb = (P[i] - P[Math.max(0, i - Wb)]) / Wb, q = ef / (eb + 1e-12);
      if (q > best) { best = q; bi = i; }
    }
    return bi / SR;
  };
  const on = ONSETS.map(t => ({ t, got: onset(t) })), offOn = on.map(o => Math.abs(o.got - o.t) * 1000);
  check('sfx', offOn.every(e => e <= 1), on.map((o, k) => `${o.t.toFixed(3)}→${o.got.toFixed(4)}`).join('  ') + `  (max off ${Math.max(...offOn).toFixed(2)} ms, ≤ 1)`);
  // whoosh: argmax of a 15 ms RMS envelope (0.5 ms hop) within ±150 ms. 15 ms is long enough that the 2.330 s click
  // stays below the 2.402 s whoosh peak (~0.88×) and short enough to keep the peak within a few ms (measured on the
  // reference stem: −4/−1/−2/−2.5 ms; a stem shifted 20 ms reads +16…+19 ms and fails).
  const env = t => Math.sqrt((P[Math.min(x.length, Math.round((t + .0075) * SR))] - P[Math.max(0, Math.round((t - .0075) * SR))]) / (.015 * SR));
  const peak = tp => {
    let best = -1, bt = 0;
    for (let t = tp - .15; t <= tp + .15; t += .0005) { const e = env(t); if (e > best) { best = e; bt = t; } }
    return bt;
  };
  const wh = WHOOSH.map(t => ({ t, got: peak(t) })), offW = wh.map(o => Math.abs(o.got - o.t) * 1000);
  check('whoosh', offW.every(e => e <= 10), wh.map(o => `${o.t.toFixed(3)}→${o.got.toFixed(3)}`).join('  ') + `  (max off ${Math.max(...offW).toFixed(1)} ms, ≤ 10)`);
}

const failed = results.filter(r => !r.pass);
writeFileSync(join(job, 'out', 'qa.json'), JSON.stringify({ mp4, pass: !failed.length, checks: results }, null, 1));
console.log(failed.length ? `\nQA FAILED: ${failed.map(r => r.name).join(', ')}` : `\nQA PASSED (${results.length}/${results.length})`);
process.exitCode = failed.length ? 1 : 0;
