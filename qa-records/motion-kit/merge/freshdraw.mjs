// freshdraw.mjs ENGINE_VIDEO_DIR JOB ASPECT OUTDIR i1 i2 … — draws each 60-fps frame ALONE on its own fresh page (the
// renderer's own warm-up, then that one frame) and compares it with the film's frame in JOB/out/main/ASPECT/frames.
// Read-only on the engine; writes PNGs into OUTDIR only.
import { join } from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const [V, job, aspect, out, ...ids] = process.argv.slice(2);
const { loadSpec } = await import(V + '/lib/spec.mjs'), { compile } = await import(V + '/lib/timeline.mjs'), R = await import(V + '/lib/render.mjs');
const tl = compile(await loadSpec(job)); mkdirSync(out, { recursive: true });
const raw = p => spawnSync('ffmpeg', ['-v', 'error', '-i', p, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 }).stdout;
const pad = i => String(i).padStart(5, '0');
for (const i of ids.map(Number)) {
  const p = join(out, `${pad(i)}.png`), f = join(job, 'out', tl.id, aspect, 'frames', `${pad(i)}.png`);
  await R.renderFrames({ job, tl, aspect, frames: [{ f: i / 2, path: p }], workers: 1 });
  if (readFileSync(p).equals(readFileSync(f))) { console.log(`${i}: fresh page = film (byte-identical)`); continue; }
  const A = raw(p), B = raw(f); let max = 0, n = 0; for (let k = 0; k < A.length; k++) { const d = Math.abs(A[k] - B[k]); if (d > max) max = d; if (d > 2) n++; }
  console.log(`${i}: fresh page ≠ film: max Δ ${max}, ${n} channels > 2`);
}
