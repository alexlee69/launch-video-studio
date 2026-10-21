// Shared paths, CLI args and process helpers for the from-scratch launch-video mode.
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const VIDEO = resolve(dirname(fileURLToPath(import.meta.url)), '..');   // …/product-launch-sting/video
export const SKILL = resolve(VIDEO, '..');                                       // …/product-launch-sting
export const FPS = 30;                 // timeline unit: frames at 30 fps (half frames allowed)
export const RENDER_FPS = 60;          // the film renders every half frame
export const SR = 48000;

// stage sizes per aspect; every block lays out from these
export const ASPECTS = {
  '16x9': { W: 1920, H: 1080 },
  '9x16': { W: 1080, H: 1920 },
  '1x1': { W: 1080, H: 1080 },
};

export function arg(argv, k, d) {
  const i = argv.indexOf(k);
  return i < 0 ? d : (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : true);
}
export function jobDir(argv = process.argv.slice(2)) {
  const j = arg(argv, '--job', process.env.JOB);
  if (!j || j === true) { console.error('missing --job DIR (the folder that holds beats.yaml)'); process.exit(2); }
  return resolve(j);
}
export const outDir = (job, cut = 'main', aspect = null) => aspect ? join(job, 'out', cut, aspect) : join(job, 'out', cut);

export function sh(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 30, ...opts });
}
export function ff(args, what = 'ffmpeg') {
  const r = sh('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args]);
  if (r.status !== 0) throw new Error(`${what} failed:\n${r.stderr}`);
  return r;
}
export function measureLoudness(path) {
  const s = sh('ffmpeg', ['-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-']).stderr;
  const I = Number((s.match(/I:\s+(-?[\d.]+) LUFS/g) || ['I: NaN']).pop().match(/-?[\d.]+|NaN/)[0]);
  const tp = s.match(/True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS/);
  return { I, TP: tp ? Number(tp[1]) : NaN };
}
export const fmtT = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
export const slugify = s => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 40) || 'launch-video';
// a problem the user fixes in beats.yaml / assets (printed as a plain message, no stack trace)
export class UserError extends Error {}
