// Master out/audio/raw.wav → out/audio/master.wav: −14 LUFS integrated, ≤ −1 dBTP, exactly 12.075 s,
// no fade except the last 60 ms. Gain is solved iteratively against ffmpeg's ebur128 meter.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const raw = join(here, 'out/audio/raw.wav'), out = join(here, 'out/audio/master.wav');
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

let { I } = measure(raw), gain = TARGET - I, ceil = -1.6, m;
console.log(`raw: ${I} LUFS`);
for (let it = 0; it < 8; it++) {
  render(gain, ceil);
  m = measure(out);
  console.log(`  pass ${it + 1}: gain ${gain.toFixed(2)} dB, ceiling ${ceil} dBFS → ${m.I} LUFS, TP ${m.TP} dBTP`);
  if (m.TP > TP_MAX) { ceil -= .3; continue; }
  if (Math.abs(m.I - TARGET) <= .1) break;
  gain += TARGET - m.I;
}
const d = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=duration,sample_rate,channels', '-of', 'csv=p=0', out], { encoding: 'utf8' }).stdout.trim();
console.log(`master.wav: ${m.I} LUFS, ${m.TP} dBTP, [${d}]`);
if (Math.abs(m.I - TARGET) > .2 || m.TP > TP_MAX) { console.error('MASTER OUT OF SPEC'); process.exitCode = 1; }
