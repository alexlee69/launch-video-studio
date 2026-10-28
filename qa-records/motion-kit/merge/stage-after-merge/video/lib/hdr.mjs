// HDR footage (iPhones record HLG by default; some cameras record PQ / HDR10) → SDR BT.709, as an ffmpeg 3D LUT.
// Scene-light conversion (BT.2408 style): decode the HDR signal to linear light, put HDR reference white (75 % HLG,
// 203 nits PQ) at ≈ 95 % SDR signal, move BT.2020 primaries to BT.709 (out-of-gamut colours clip), BT.709 OETF, and
// roll highlights off above 90 % instead of clipping them. Works with any ffmpeg (no zscale / libplacebo needed).
import { writeFileSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export const HDR_TRC = { 'arib-std-b67': 'HLG', smpte2084: 'PQ (HDR10)' };
const N = 33;
const hlgInv = e => e <= .5 ? e * e / 3 : (Math.exp((e - .55991073) / .17883277) + .28466892) / 12;   // BT.2100 inverse OETF
const pqEotf = e => {                                                                                  // BT.2100 PQ → nits
  const m1 = .1593017578125, m2 = 78.84375, c1 = .8359375, c2 = 18.8515625, c3 = 18.6875, p = Math.pow(Math.max(e, 0), 1 / m2);
  return 10000 * Math.pow(Math.max(p - c1, 0) / (c2 - c3 * p), 1 / m1);
};
const M = [[1.6605, -.5876, -.0728], [-.1246, 1.1329, -.0083], [-.0182, -.1006, 1.1187]];          // BT.2020 → BT.709, linear
const REF = .9017;                                       // SDR linear level for HDR reference white (= 95 % BT.709 signal)
const oetf709 = l => l < .018 ? 4.5 * l : 1.099 * Math.pow(l, .45) - .099;
const knee = v => v <= .9 ? v : .9 + .1 * (1 - Math.exp(-(v - .9) / .1));     // soft highlight roll-off into 90–100 %

// path of a .cube LUT for this transfer (cached in the OS temp dir); its input is the HDR R'G'B' (BT.2020, full range)
export function hdrLut(trc) {
  const path = join(tmpdir(), `lv-${trc}-to-sdr709-v1.cube`);
  if (existsSync(path)) return path;
  const lin = trc === 'smpte2084' ? e => pqEotf(e) / 203 * REF : e => hlgInv(e) / hlgInv(.75) * REF;
  const rows = [`TITLE "${HDR_TRC[trc] || trc} to SDR BT.709"`, `LUT_3D_SIZE ${N}`];
  for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) {          // .cube order: red fastest
    const c = [r, g, b].map(i => lin(i / (N - 1)));
    rows.push(M.map(m => Math.min(1, Math.max(0, knee(oetf709(Math.max(0, m[0] * c[0] + m[1] * c[1] + m[2] * c[2])))))).map(v => v.toFixed(6)).join(' '));
  }
  writeFileSync(path + '.tmp', rows.join('\n') + '\n'); renameSync(path + '.tmp', path);
  return path;
}

// ffmpeg filter prefix that turns HDR footage into SDR BT.709 R'G'B' (empty for SDR footage)
export function hdrFilter(trc) {
  if (!HDR_TRC[trc]) return '';
  return `scale=in_color_matrix=bt2020:in_range=tv:out_range=pc,format=gbrpf32le,lut3d=file='${hdrLut(trc)}':interp=tetrahedral,`;
}
