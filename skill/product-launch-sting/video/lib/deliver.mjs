// Mastering, muxing and clip encoding.
import { join } from 'node:path';
import { writeFileSync, readFileSync, rmSync } from 'node:fs';
import { SR, ff, measureLoudness } from './common.mjs';

// raw.wav → master.wav at −14 LUFS with true peak ≤ −1 dBTP *after* the AAC encode the mux uses, exactly `dur` seconds,
// no fade except the last 60 ms. AAC drops the air band, so the encoded audio can read a few tenths of a LU quieter
// than the WAV (most with sparse, bright sound like whooshes): the gain centres the WAV and its AAC encode on the
// target, and both must land within ±0.2 LU (QA measures the mp4's AAC).
export function master(dir, dur, { target = -14, tpMax = -1.0, log = console.log } = {}) {
  const raw = join(dir, 'raw.wav'), out = join(dir, 'master.wav');
  let print = null; try { print = JSON.parse(readFileSync(join(dir, 'audio.json'), 'utf8')).print; } catch { /* no print → QA can't match it */ }
  // a silent soundtrack (music: none and no SFX — e.g. clips for an edit that gets its own music) can't be levelled:
  // write exact-length digital silence and say so; QA reports it as INFO instead of judging loudness
  const rawI = measureLoudness(raw).I;
  if (!(rawI > -70)) {
    ff(['-f', 'lavfi', '-i', `anullsrc=r=${SR}:cl=stereo`, '-t', String(dur), '-c:a', 'pcm_s24le', out], 'silent master');
    writeFileSync(join(dir, 'master.json'), JSON.stringify({ silent: true, print }));
    log('  master: the mix is silent (no music, no SFX) — wrote exact-length silence, loudness not applicable');
    return { silent: true, path: out };
  }
  const render = (gain, ceil) => ff(['-i', raw, '-af', [`volume=${gain.toFixed(3)}dB`, `alimiter=limit=${Math.pow(10, ceil / 20).toFixed(4)}:attack=1.5:release=45:level=false:latency=true`,
    `apad=whole_dur=${dur}`, `atrim=end=${dur}`, `afade=t=out:st=${(dur - .06).toFixed(3)}:d=0.06`].join(','), '-ar', String(SR), '-c:a', 'pcm_s24le', out], 'master');
  // the same AAC encode as mux() → its loudness and true peak are what the mp4 will measure
  const aacCheck = () => { const tmp = join(dir, 'master-aac-check.m4a'); ff(['-i', out, '-c:a', 'aac', '-b:a', '320k', '-ar', String(SR), tmp], 'aac check'); return measureLoudness(tmp); };
  let gain = target - rawI, ceil = -1.6, m, a = { I: NaN, TP: NaN };
  for (let it = 0; it < 16; it++) {
    render(gain, ceil);
    m = measureLoudness(out);
    a = m.TP <= tpMax ? aacCheck() : { I: NaN, TP: NaN };
    log(`  master pass ${it + 1}: gain ${gain.toFixed(2)} dB, ceiling ${ceil.toFixed(1)} → WAV ${m.I} LUFS, TP ${m.TP}${Number.isNaN(a.I) ? '' : ` · after AAC ${a.I} LUFS, TP ${a.TP}`} dBTP`);
    if (m.TP > tpMax) { ceil -= .3; continue; }
    const err = target - (m.I + a.I) / 2;
    if (Math.abs(err) > .05) { gain += err; continue; }
    if (a.TP > tpMax - .05) { ceil -= .2; continue; }
    break;
  }
  const ok = Math.abs(m.I - target) <= .2 && Math.abs(a.I - target) <= .2 && m.TP <= tpMax && a.TP <= tpMax;
  if (!ok) throw new Error(`master out of spec: WAV ${m.I} LUFS / TP ${m.TP} dBTP, after AAC ${a.I} LUFS / TP ${a.TP} dBTP (the AAC encode shifts this mix by ${(m.I - a.I).toFixed(1)} LU)`);
  writeFileSync(join(dir, 'master.json'), JSON.stringify({ silent: false, I: m.I, TP: m.TP, aacI: a.I, aac: a.TP, print }));
  return { I: m.I, TP: m.TP, aacI: a.I, aac: a.TP, path: out };
}

// a clip's UI sound effects as their own WAV, with ONE static gain and no limiter, so every effect keeps its exact level
// relative to the others: aim for −18 LUFS, but sparse clicks and pops are mostly silence with sharp peaks, so the gain
// stops wherever the true peak would pass −3 dBTP (the user sets the final level in their edit anyway).
export function sfxClip({ stem, start, dur, out }) {
  const tmp = out + '.tmp.wav';
  ff(['-i', stem, '-af', `atrim=start=${start}:end=${start + dur},asetpts=PTS-STARTPTS`, '-c:a', 'pcm_f32le', tmp], 'clip sfx trim');
  try {
    const L = measureLoudness(tmp);
    const gain = Math.min(L.I > -60 ? -18 - L.I : Infinity, -3 - L.TP);
    ff(['-i', tmp, '-af', `volume=${gain.toFixed(2)}dB`, '-ar', String(SR), '-c:a', 'pcm_s24le', out], 'clip sfx');
  } finally { rmSync(tmp, { force: true }); }
}

// ffmpeg 8 drops -color_primaries/-color_trc on filtered frames, so setparams stamps bt709 on the frames themselves
const BT709 = 'scale=out_color_matrix=bt709:out_range=tv,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv';
export function mux({ framesDir, fps, audio, out, crf = 16, scale = null, start = 0 }) {
  const vf = scale ? `scale=${scale}:-2:flags=lanczos,${BT709}` : BT709;
  ff(['-framerate', String(fps), '-start_number', String(start), '-i', join(framesDir, '%05d.png'), ...(audio ? ['-i', audio] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-vf', vf,
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
    ...(audio ? ['-c:a', 'aac', '-b:a', '320k', '-ar', String(SR)] : []), '-movflags', '+faststart', out], `mux ${out}`);
}

// transparent clip: ProRes 4444 with alpha (Premiere, Final Cut, Resolve, After Effects) and/or WebM VP9 alpha (web, CapCut)
export function encodeAlpha({ framesDir, fps, out, webm = false, start = 0 }) {
  // both: RGB → BT.709 limited (swscale defaults to 601), tags stamped with setparams (ffmpeg 8 drops the CLI ones)
  const tag = fmt => `scale=out_color_matrix=bt709:out_range=tv,format=${fmt},setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv`;
  ff(['-framerate', String(fps), '-start_number', String(start), '-i', join(framesDir, '%05d.png'), '-vf', tag('yuva444p10le'), '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le',
    '-alpha_bits', '16', '-vendor', 'apl0', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', out], `prores ${out}`);
  if (webm) ff(['-framerate', String(fps), '-start_number', String(start), '-i', join(framesDir, '%05d.png'), '-vf', tag('yuva420p'), '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '22',
    '-row-mt', '1', '-auto-alt-ref', '0', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', out.replace(/\.mov$/, '.webm')], `webm ${out}`);
}
// preview of a transparent clip over a flat colour, so it can be watched anywhere
export function previewOver({ mov, bg, out, W, H, fps = 30 }) {
  ff(['-i', mov, '-filter_complex', `color=c=${bg.replace('#', '0x')}:s=${W}x${H}:r=${fps}[b];[b][0:v]overlay=shortest=1,format=yuv420p`, '-c:v', 'libx264', '-crf', '18', '-movflags', '+faststart', out], `preview ${out}`);
}
