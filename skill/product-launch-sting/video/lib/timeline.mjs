// Compile a spec (or one of its cutdowns) into a timeline: shot frame ranges on the beat grid, cut indices at 60 fps,
// and every SFX cue (block cues + a whoosh on each moving transition). Everything downstream reads timeline.json.
import { FPS, RENDER_FPS, fmtT } from './common.mjs';
import { wordCount, plainCopy, EXIT_LEN } from '../engine/kit.js';

const COPY_FIELDS = ['kicker', 'pre', 'name', 'badge', 'text', 'label', 'prompt', 'tagline', 'sub'];   // display order
export const copyOf = s => [
  ...(s.block === 'stat' && s.value != null ? [`${s.prefix || ''}${s.value}${s.suffix || ''}`] : []),
  ...COPY_FIELDS.filter(k => s[k] != null && s[k] !== '').map(k => plainCopy(String(s[k]))),
  ...(Array.isArray(s.words) ? [s.words.join(' ')] : []),
  ...[].concat(s.cta || []).map(String), ...(s.url ? [String(s.url)] : []),
].join(' · ');
const CUE_KINDS = ['pop', 'tick', 'click', 'chime', 'hit'];
const readCopy = s => COPY_FIELDS.filter(k => s[k] != null && s[k] !== '').map(k => plainCopy(String(s[k]))).join(' ');   // what viewers read (reading-time check)

export function compile(spec, cut = 'main') {
  const beat = 60 / spec.music.bpm;
  const ids = cut === 'main' ? spec.shots.map(s => s.id) : [].concat(spec.cutdowns[cut]).map(String);
  const src = ids.map(id => spec.shots.find(s => s.id === id));
  const warns = [];
  // boundaries in seconds; beats count from the downbeat (a track can have its first downbeat after 0)
  // a beats: shot ends on the music grid (downbeat + k·beat), counted from the first grid line at or after its start —
  // so cuts stay on the beat even after a sec: shot or a track whose first downbeat isn't at 0
  // Boundaries are built one at a time from the previous *snapped* boundary (a cut can only happen on a 60-fps frame);
  // a grid line up to half a frame before that start counts as "at" it, so snapping never costs a beat.
  const db = spec.music.downbeat, half = .5 / RENDER_FPS;
  const idx = [0];
  src.forEach(s => {
    const t = idx[idx.length - 1] / RENDER_FPS;
    const end = s.beats != null ? db + Math.max(0, Math.ceil((t - half - db) / beat)) * beat + Number(s.beats) * beat : t + Number(s.sec);
    const k = Math.round(end * RENDER_FPS);
    if (!(k >= idx[idx.length - 1] + 2)) throw new Error(`${s.id}: shorter than one frame once snapped to the frame grid — give it more beats or seconds`);
    idx.push(k);
  });
  const shots = src.map((s, i) => {
    const f0 = idx[i] / 2, f1 = idx[i + 1] / 2, D = f1 - f0;
    const block = spec.blocks[s.block];
    const sh = { ...s, i, f0, f1, D, start: idx[i] / RENDER_FPS, end: idx[i + 1] / RENDER_FPS, out: i === src.length - 1 ? 'cut' : (s.out || 'cut') };
    // hold: [h0, h1] freezes the shot between those local frames; the block's own animation (and every sound it makes)
    // waits out the hold, so the block plans itself for Db = D − (h1 − h0) frames and its events map back to shot time
    const h0 = s.hold ? Number(s.hold[0]) : 0, L = s.hold ? Number(s.hold[1]) - h0 : 0, Db = D - L;
    if (s.hold) {
      if (Number(s.hold[1]) > D) throw new Error(`${s.id}: hold [${s.hold}] runs past the shot's ${D} frames (hold is in the shot's own 30-fps frames)`);
      if (sh.out !== 'cut' && Number(s.hold[1]) > D - EXIT_LEN) throw new Error(`${s.id}: hold [${s.hold}] runs into the shot's ${sh.out} exit (its last ${EXIT_LEN} frames) — end the hold by frame ${D - EXIT_LEN}, or use out: cut`);
      if (Db < 12) throw new Error(`${s.id}: hold [${s.hold}] leaves the shot only ${Db} frames of animation — shorten the hold or lengthen the shot`);
    }
    sh.Db = Db;
    const toShot = t => t <= h0 ? t : t + L;                     // block time → shot time
    for (const w of block.validate ? block.validate(sh, Db) : []) warns.push(w);
    // storyboard / text-audit / thumbnail frame — never inside a moving exit, where the camera is already blurring away
    sh.heroF = Math.max(0, Math.min(sh.out === 'cut' ? D - 1 : D - EXIT_LEN - 1, Math.round(toShot(block.hero ? block.hero(sh, Db) : Db * .7))));
    const raw = block.cues ? block.cues(sh, Db) : [];
    if (!Array.isArray(raw)) throw new Error(`${s.id}: block "${s.block}" cues() must return a list of {t, kind}`);
    sh.cues = raw.filter(c => c && c.t >= 0 && c.t < Db).map(c => ({ ...c, t: +((f0 + toShot(c.t)) / FPS).toFixed(5), shot: s.id }));
    for (const c of sh.cues) if (!CUE_KINDS.includes(c.kind)) throw new Error(`${s.id}: block "${s.block}" emits cue kind "${c.kind}" — use one of ${CUE_KINDS.join(', ')}`);
    const words = wordCount(readCopy(s));
    if (words && D / FPS < .4 + words * .25) warns.push(`${s.id}: ${words} words on screen for ${(D / FPS).toFixed(1)} s — viewers need ~${(.4 + words * .25).toFixed(1)} s (≈4 words/s); cut words or lengthen it`);
    if (s.beats != null && D < 30) warns.push(`${s.id}: only ${(D / FPS).toFixed(2)} s — under 1 s rarely reads`);
    return sh;
  });
  const dur = idx[idx.length - 1] / RENDER_FPS;
  const cuts = idx.slice(1, -1);
  const whooshes = shots.slice(0, -1).filter(s => s.out !== 'cut').map(s => ({ t: s.end, kind: 'whoosh', shot: s.id, out: s.out }));
  // drop cues closer than 20 ms to an earlier cue of the same kind (they would mask each other)
  const cues = [];
  for (const c of shots.flatMap(s => s.cues).sort((a, b) => a.t - b.t)) {
    if (cues.some(p => p.kind === c.kind && Math.abs(p.t - c.t) < .02)) continue;
    cues.push(c);
  }
  const lastShot = shots[shots.length - 1];
  // the main read only lines up with the main cut; a cutdown plays its own read (voiceover.cutdowns.<name>) or none
  const { cutdowns: voCuts = {}, ...voMain } = spec.vo || {};
  const vo = !spec.vo ? null : cut === 'main' ? voMain : voCuts[cut] || null;
  if (spec.vo && cut !== 'main' && !vo) warns.push(`cutdown "${cut}" has no voiceover of its own (the main read wouldn't line up with its shots) — it plays music + SFX only; add voiceover.cutdowns.${cut}: assets/<its read>.wav`);
  // held frame-pairs (pair k = frame k-1 → k) — never past the shot's own last pair, so a hold can't excuse a frozen cut
  const holds = shots.filter(s => s.hold).map(s => [Math.round((s.f0 + Number(s.hold[0])) * 2) + 1, Math.min(Math.round((s.f0 + Number(s.hold[1])) * 2), Math.round(s.f1 * 2) - 1)]);
  return {
    id: cut, title: spec.title, slug: spec.slug, bpm: spec.music.bpm, beat, fps: FPS, renderFps: RENDER_FPS,
    dur, frames: idx[idx.length - 1], cuts, shots: shots.map(({ cues: _c, ...s }) => s), cues, whooshes, holds,
    brand: spec.brand, music: spec.music, vo, aspects: spec.aspects, endcard: lastShot.block === 'endcard' ? lastShot.start : null,
    customBlocks: Object.fromEntries(Object.entries(spec.blocks.__custom || {}).filter(([n]) => src.some(s => s.block === n)).map(([n, b]) => [n, '/job/blocks/' + b.file])),
    warns,
  };
}

export function gridTable(tl) {
  const rows = tl.shots.map(s => {
    const beats = (s.end - s.start) / tl.beat;
    const onBeat = Math.abs(beats - Math.round(beats)) < .02 ? `${Math.round(beats)}` : beats.toFixed(2);
    return `  ${s.id.padEnd(6)} ${s.block.padEnd(9)} ${fmtT(s.start)}–${fmtT(s.end)}  f${String(s.f0).padEnd(6)} ${onBeat.padStart(5)} beats  ${String(s.out).padEnd(10)} ${copyOf(s).slice(0, 60)}`;
  });
  return [`timeline "${tl.id}": ${tl.dur.toFixed(2)} s, ${tl.frames} frames @60, ${tl.bpm} BPM (beat ${(tl.beat * 30).toFixed(2)} frames), ${tl.cues.length} SFX cues, ${tl.whooshes.length} whooshes`,
    '  shot   block     time              start     length  out        on screen', ...rows].join('\n');
}
