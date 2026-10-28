// Fingerprints: what a shot's frames (or the soundtrack) were made from. lv.mjs stores them next to the frames/audio and
// refuses to re-mux or QA output that no longer matches the current beats.yaml, assets or engine code.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { VIDEO } from './common.mjs';

const sha = x => createHash('sha1').update(typeof x === 'string' || Buffer.isBuffer(x) ? x : JSON.stringify(x)).digest('hex').slice(0, 16);
const files = dir => readdirSync(dir).filter(f => /\.(js|mjs|html)$/.test(f)).sort().map(f => join(dir, f));
let ENGINE = null, AUDIO = null;
const engineHash = () => ENGINE ||= sha(files(join(VIDEO, 'engine')).concat(files(join(VIDEO, 'engine/blocks'))).map(f => readFileSync(f)).join('\u0000'));
const audioHash = () => AUDIO ||= sha(['voices.mjs', 'audio.mjs'].map(f => readFileSync(join(VIDEO, 'lib', f))).join('\u0000'));
const stat = (job, rel) => { if (typeof rel !== 'string' || !rel) return null; const p = join(job, rel); if (!existsSync(p)) return null; const s = statSync(p); return `${rel}:${s.size}:${Math.round(s.mtimeMs)}`; };

// identity of a delivered file by content (copies without preserved timestamps still match)
export const fileSha = p => createHash('sha1').update(readFileSync(p)).digest('hex').slice(0, 20);

// every job file a shot's pixels can depend on: brand files, the shot's custom block, and any string anywhere in the
// shot (src, icons, items, a custom block's own fields …) that names a file in the job folder
function shotAssets(job, tl, s) {
  const b = tl.brand, refs = [b.logo, ...Object.values((b.font && b.font.files) || {}), ...(b.cast || []).map(c => c.src)];
  const walk = v => { if (typeof v === 'string') { if (v.length < 400 && /[./]/.test(v) && !/[\n*|]/.test(v)) refs.push(v); } else if (v && typeof v === 'object') for (const x of Object.values(v)) walk(x); };
  walk(s);
  if (tl.customBlocks && tl.customBlocks[s.block]) refs.push(tl.customBlocks[s.block].replace(/^\/job\//, ''));
  return [...new Set(refs.filter(r => typeof r === 'string' && r))].map(r => { try { return statSync(join(job, r)).isFile() ? stat(job, r) : null; } catch { return null; } }).filter(Boolean).sort();
}
const NOT_PIXELS = ['note'];                     // shot fields that never change a frame (storyboard-only)

export function shotPrints(job, tl, aspect) {
  const { warns: _w, cues: _c, whooshes: _wh, music: _m, vo: _v, ...look } = tl;
  const global = sha({ brand: look.brand, aspect, engine: engineHash() });          // a shot's own custom block file is in its assets
  return Object.fromEntries(tl.shots.map((s, i) => {
    const own = Object.fromEntries(Object.entries(s).filter(([k]) => !NOT_PIXELS.includes(k)));
    return [s.id, sha({ global, s: own, prevOut: i ? tl.shots[i - 1].out : null, last: i === tl.shots.length - 1, assets: shotAssets(job, tl, s) })];
  }));
}

export function audioPrint(job, tl) {
  return sha({ code: audioHash(), cues: tl.cues, whooshes: tl.whooshes, music: tl.music, vo: tl.vo, dur: tl.dur, beat: tl.beat, endcard: tl.endcard,
    shots: tl.shots.map(s => [s.id, s.start, s.end]), files: [stat(job, tl.music.file), tl.vo && stat(job, tl.vo.file)] });
}

// frames for a shot are current when the stored print for it matches; returns [{id, from, to}] of stale shots
export function staleShots(tl, stored, current) {
  return tl.shots.filter(s => !stored || stored[s.id] !== current[s.id]).map(s => ({ id: s.id, from: Math.round(s.f0 * 2), to: Math.round(s.f1 * 2) - 1 }));
}
