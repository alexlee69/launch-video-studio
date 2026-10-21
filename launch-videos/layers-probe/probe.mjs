// Proves the layer QA fails when it should: takes a good layer export (lv.mjs --layers) and re-runs the QA on tampered
// copies of its manifest / files. Every tampered case must FAIL on the named check; the untouched export must PASS.
//   node probe.mjs <layers folder> <work folder> <layer to drop> <layer A to swap> <layer B to swap>
import { readFileSync, mkdtempSync, cpSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { qaLayers } from '/Users/bytedance/.claude/skills/product-launch-sting/video/lib/layers.mjs';

const [folder, work, drop, swapA, swapB] = process.argv.slice(2);
const M0 = JSON.parse(readFileSync(join(folder, 'manifest.json'), 'utf8')), stats = JSON.parse(readFileSync(join(work, 'qa-stats.json'), 'utf8'));
const refs = { refAlpha: stats.refAlpha, refOpaque: stats.refOpaque, frameInfo: JSON.parse(readFileSync(join(work, 'text-probe.json'), 'utf8')) };
const quiet = () => {};
let bad = 0;
async function cse(label, want, mutate) {      // want: null = must pass, else the check that must FAIL
  const dir = mkdtempSync(join(tmpdir(), 'lprobe-'));
  try {
    cpSync(folder, dir, { recursive: true });
    const M = JSON.parse(JSON.stringify(M0)); delete M.qa;
    mutate(M, dir);
    const r = await qaLayers({ dir, manifest: M, ...refs, log: quiet });
    const failed = r.results.filter(x => !x.pass).map(x => x.name);
    const ok = want === null ? r.passed : failed.includes(want);
    if (!ok) bad++;
    console.log(`${ok ? 'OK  ' : 'BAD '} ${label.padEnd(44)} → ${r.passed ? 'PASSED' : `FAILED on ${failed.join(', ')}`}${want ? ` (want a ${want} FAIL)` : ' (want PASS)'}`);
    for (const x of r.results.filter(x => !x.pass)) console.log(`       ${x.name}: ${x.detail.slice(0, 150)}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
await cse('untouched export', null, () => {});
await cse(`drop layer "${drop}"`, 'stack', M => { M.layers = M.layers.filter(l => l.name !== drop); });
await cse(`swap "${swapA}" and "${swapB}"`, 'stack', M => { const a = M.layers.findIndex(l => l.name === swapA), b = M.layers.findIndex(l => l.name === swapB); [M.layers[a], M.layers[b]] = [M.layers[b], M.layers[a]]; });
await cse('reverse the whole stack', 'stack', M => { const bg = M.layers.filter(l => l.name === 'background'); M.layers = [...bg, ...M.layers.filter(l => l.name !== 'background').reverse()]; });
if (M0.layers.some(l => l.name === 'background')) await cse('drop the background layer', 'bg', M => { M.layers = M.layers.filter(l => l.name !== 'background'); });
if (M0.layers.some(l => l.name === 'background')) await cse('background moved to the top', 'bg', M => { const bg = M.layers.shift(); M.layers.push(bg); });
await cse(`"${drop}" re-encoded without alpha`, 'format', (M, dir) => {
  const f = join(dir, M.layers.find(l => l.name === drop).file), tmp = f + '.tmp.mov';
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le', tmp]); spawnSync('mv', [tmp, f]);
});
await cse(`"${drop}" replaced by an empty (transparent) clip`, 'nonempty', (M, dir) => {
  const f = join(dir, M.layers.find(l => l.name === drop).file);
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=black@0.0:s=${M.width}x${M.height}:r=${M.fps},format=rgba`, '-frames:v', String(M.frames), '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', f]);
});
await cse(`"${drop}" one frame short`, 'format', (M, dir) => {
  const f = join(dir, M.layers.find(l => l.name === drop).file), tmp = f + '.tmp.mov';
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-frames:v', String(M.frames - 1), '-c', 'copy', tmp]); spawnSync('mv', [tmp, f]);
});
await cse(`"${drop}" shifted one frame late`, 'stack', (M, dir) => {
  const f = join(dir, M.layers.find(l => l.name === drop).file), tmp = f + '.tmp.mov';
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-vf', `tpad=start=1:start_mode=clone,trim=end_frame=${M.frames}`, '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', tmp]); spawnSync('mv', [tmp, f]);
});
await cse('everything merged into one layer', 'layers', M => { M.layers = M.layers.filter(l => l.name === 'background' || l === M.layers.find(x => x.name !== 'background')); M.elements = 3; });
console.log(bad ? `PROBE FAILED: ${bad} case(s) did not behave` : 'PROBE PASSED: every tampered export failed on the right check, the untouched one passed');
process.exit(bad ? 1 : 0);
