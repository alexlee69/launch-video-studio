// Master DIR/out/audio/raw.wav → DIR/out/audio/master.wav: −14 LUFS integrated, ≤ −1 dBTP, exactly 12.075 s,
// no fade except the last 60 ms. Gain is solved iteratively against ffmpeg's ebur128 meter.
//   node master.mjs --job DIR
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { jobDir } from './brand.mjs';

const job = jobDir();
const raw = join(job, 'out/audio/raw.wav'), out = join(job, 'out/audio/master.wav');
const DUR = 12.075, TARGET = -14, TP_MAX = -1.0;

function measure(path) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'], { encoding: 'utf8' });
  const s = r.stderr;
  const I = Number(s.match(/I:\s+(-?[\d.]+) LUFS/g).pop().match(/-?[\d.]+/)[0]);
  const tp = s.match(/True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS/);
  return { I, TP: tp ? Number(tp[1]) : NaN };
}
function render(gainDb, ceilDb) {
  const lim = Math.pow(10, ceilDb / 20).toFixed(4);
  const af = [`volume=${gainDb.toFixed(3)}dB`, `alimiter=limit=${lim}:attack=1.5:release=45:level=false:latency=true`,
    `apad=whole_dur=${DUR}`, `atrim=end=${DUR}`, `afade=t=out:st=${(DUR - .06).toFixed(3)}:d=0.06`].join(',');
  const r = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', raw, '-af', af, '-ar', '48000', '-c:a', 'pcm_s24le', out], { encoding: 'utf8' });
  if (r.status) throw new Error(r.stderr);
}

// The mp4 carries AAC, whose reconstruction can overshoot the PCM true peak by a few tenths of a dB (seen: −1.2 dBTP
// in master.wav → −0.9 in the mp4). So a candidate that meets spec is also round-tripped through the mux's exact AAC
// settings, and that true peak has to hold too; if not, the limiter ceiling comes down and the gain is re-solved.
function aacPeak() {
  const tmp = join(job, 'out/audio/master-aac-check.m4a');
  const r = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', out, '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', tmp], { encoding: 'utf8' });
  if (r.status) throw new Error(r.stderr);
  return measure(tmp).TP;
}

let { I } = measure(raw), gain = TARGET - I, ceil = -1.6, m, aac = NaN;
console.log(`raw: ${I} LUFS`);
for (let it = 0; it < 12; it++) {
  render(gain, ceil);
  m = measure(out);
  const loudOk = Math.abs(m.I - TARGET) <= .1;
  aac = m.TP <= TP_MAX && loudOk ? aacPeak() : NaN;
  console.log(`  pass ${it + 1}: gain ${gain.toFixed(2)} dB, ceiling ${ceil.toFixed(1)} dBFS → ${m.I} LUFS, TP ${m.TP} dBTP${Number.isNaN(aac) ? '' : `, after AAC ${aac} dBTP`}`);
  if (m.TP > TP_MAX) { ceil -= .3; continue; }
  if (!loudOk) { gain += TARGET - m.I; continue; }
  if (aac > TP_MAX - .05) { ceil -= .2; continue; }
  break;
}
const d = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=duration,sample_rate,channels', '-of', 'csv=p=0', out], { encoding: 'utf8' }).stdout.trim();
console.log(`master.wav: ${m.I} LUFS, ${m.TP} dBTP (${aac} dBTP after AAC), [${d}]`);
if (Math.abs(m.I - TARGET) > .2 || m.TP > TP_MAX || !(aac <= TP_MAX)) { console.error('MASTER OUT OF SPEC'); process.exitCode = 1; }
