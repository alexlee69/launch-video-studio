// cmpdirs.mjs A B [regex] — byte-compare same-named PNGs; for differing ones print max |Δ| and channels > 2
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const [A, B, re] = process.argv.slice(2), rx = new RegExp(re || '\\.png$');
const raw = p => spawnSync('ffmpeg', ['-v', 'error', '-i', p, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 }).stdout;
const names = readdirSync(A).filter(n => rx.test(n)).sort(); let same = 0; const diff = [];
for (const n of names) {
  const b = join(B, n); if (!existsSync(b)) { diff.push(`${n} missing`); continue; }
  const x = readFileSync(join(A, n)), y = readFileSync(b); if (x.equals(y)) { same++; continue; }
  const X = raw(join(A, n)), Y = raw(b); if (X.length !== Y.length) { diff.push(`${n} size`); continue; }
  let mx = 0, over = 0; for (let k = 0; k < X.length; k++) { const d = Math.abs(X[k] - Y[k]); if (d > mx) mx = d; if (d > 2) over++; }
  diff.push(`${n} max ${mx}, ${over} channels > 2`);
}
console.log(`${same}/${names.length} byte-identical`); for (const d of diff) console.log('  DIFF', d);
