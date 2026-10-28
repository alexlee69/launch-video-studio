// Compile a spec (or one of its cutdowns) into a timeline: shot frame ranges on the beat grid, cut indices at 60 fps,
// and every SFX cue (block cues + a whoosh on each moving transition). Everything downstream reads timeline.json.
import { FPS, RENDER_FPS, ASPECTS, fmtT } from './common.mjs';
import { wordCount, plainCopy, exitLen, isDrift, XFX } from '../engine/kit.js';
import { mediaFields } from './spec.mjs';

const isVideo = p => typeof p === 'string' && /\.(mp4|mov|m4v|webm|mkv)$/i.test(p);
export const hasBg = s => s.bg != null && s.bg !== false && String(s.bg).trim() !== '' && String(s.bg).toLowerCase() !== 'none';
// every footage file a shot shows → one plate each (lv.mjs extracts them to 60-fps JPEGs; the stage reads them by key):
// media's src → key = shot id (as always); the universal bg → `${id}:bg`; a block's declared `media:` fields →
// `${id}:${field}` (a list field: `${id}:${field}.${i}`). from = seconds into the file; fit = cover | contain.
export function platePlan(shot, block) {
  const out = [], add = (key, field, src, from, fit, scale = 1) => { if (isVideo(src) && !out.some(p => p.key === key)) out.push({ key, field, src, from: Number(from || 0), fit, ...(scale !== 1 ? { scale } : {}) }); };
  if (shot.block === 'media') add(shot.id, 'src', shot.src, shot.from, shot.device && shot.device !== 'none' ? 'contain' : 'cover');
  if (hasBg(shot)) add(`${shot.id}:bg`, 'bg', shot.bg, shot.bgFrom ?? ((block && block.bgDefaults) || {}).bgFrom, 'cover');
  for (const { field, fit, scale } of mediaFields(block)) {
    const v = shot[field], from = shot[`${field}From`];
    if (Array.isArray(v)) v.forEach((x, i) => add(`${shot.id}:${field}.${i}`, `${field}.${i}`, x, Array.isArray(from) ? from[i] : from, fit, scale));
    else add(`${shot.id}:${field}`, field, v, from, fit, scale);
  }
  return out;
}

const COPY_FIELDS = ['kicker', 'pre', 'name', 'badge', 'text', 'label', 'prompt', 'tagline', 'sub'];   // display order
// a block that exports copy(shot, {brand}) lists every line a viewer can read, in order (captions, overlays, labels, CTA
// lines …); compile() stores it on the timeline shot as `copy` (and the block's read(shot) — the lines the reading-time
// check counts, default all of copy — as `copyRead`). Blocks without it: the fixed fields below.
const lines = v => Array.isArray(v) ? v.filter(x => x != null && String(x).trim() !== '').map(x => plainCopy(String(x))).filter(Boolean) : null;
export const copyOf = s => lines(s.copy) ? lines(s.copy).join(' · ') : [
  ...(s.block === 'stat' && s.value != null ? [`${s.prefix || ''}${s.value}${s.suffix || ''}`] : []),
  ...COPY_FIELDS.filter(k => s[k] != null && s[k] !== '').map(k => plainCopy(String(s[k]))),
  ...(Array.isArray(s.words) ? [s.words.join(' ')] : []),
  ...[].concat(s.cta || []).map(String), ...(s.url ? [String(s.url)] : []),
].join(' · ');
const CUE_KINDS = ['pop', 'tick', 'click', 'chime', 'hit'];
// what viewers must read in the shot's time (reading-time check)
const readCopy = s => lines(s.copyRead) ? lines(s.copyRead).join(' ') : lines(s.copy) ? lines(s.copy).join(' ') : COPY_FIELDS.filter(k => s[k] != null && s[k] !== '').map(k => plainCopy(String(s[k]))).join(' ');

export function compile(spec, cut = 'main') {
  const beat = 60 / spec.music.bpm;
  const ids = cut === 'main' ? spec.shots.map(s => s.id) : [].concat(spec.cutdowns[cut]).map(String);
  const src = ids.map(id => spec.shots.find(s => s.id === id));
  const warns = cut === 'main' ? [...(spec.warns || [])] : [];      // beats.yaml-level warnings (loadSpec), once
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
  const sh0 = i => ({ out: i === src.length - 1 ? 'cut' : (src[i].out || 'cut') });
  const shots = src.map((s, i) => {
    const f0 = idx[i] / 2, f1 = idx[i + 1] / 2, D = f1 - f0;
    const block = spec.blocks[s.block];
    const sh = { ...s, i, f0, f1, D, start: idx[i] / RENDER_FPS, end: idx[i + 1] / RENDER_FPS, out: i === src.length - 1 ? 'cut' : (s.out || 'cut') };
    // hold: [h0, h1] freezes the shot between those local frames; the block's own animation (and every sound it makes)
    // waits out the hold, so the block plans itself for Db = D − (h1 − h0) frames and its events map back to shot time
    const h0 = s.hold ? Number(s.hold[0]) : 0, L = s.hold ? Number(s.hold[1]) - h0 : 0, Db = D - L;
    if (s.hold) {
      if (Number(s.hold[1]) > D) throw new Error(`${s.id}: hold [${s.hold}] runs past the shot's ${D} frames (hold is in the shot's own 30-fps frames)`);
      if (sh.out !== 'cut' && Number(s.hold[1]) > D - exitLen(sh.out)) throw new Error(`${s.id}: hold [${s.hold}] runs into the shot's ${sh.out} exit (its last ${exitLen(sh.out)} frames) — end the hold by frame ${D - exitLen(sh.out)}, or use out: cut`);
      if (Db < 12) throw new Error(`${s.id}: hold [${s.hold}] leaves the shot only ${Db} frames of animation — shorten the hold or lengthen the shot`);
    }
    sh.Db = Db;
    // the previous shot's cross-cut transition plays over this shot's first frames: a hold there would freeze under it
    const xin = i && XFX[sh0(i - 1).out];
    if (s.hold && xin && h0 < xin.post) throw new Error(`${s.id}: hold [${s.hold}] starts inside the ${sh0(i - 1).out} transition from ${src[i - 1].id} (its first ${xin.post} frames) — start the hold at frame ${xin.post} or later`);
    for (const k of ['bgFrom', 'bgDim', 'bgMove']) if (s[k] != null && !hasBg(s)) warns.push(`${s.id}: ${k} does nothing without bg`);
    // drift: {in, out} — strengths of this shot's drift exit / drift entrance (in this cut's order)
    const dr = s.drift && typeof s.drift === 'object' ? s.drift : {};      // (a wall's own `drift: up` is its direction)
    if (dr.out != null && !isDrift(sh.out)) warns.push(`${s.id}: drift.out does nothing — the shot ${i === src.length - 1 ? 'is the last one' : `exits on ${sh.out}, not a drift-*`}`);
    if (dr.in != null && !(i && isDrift(sh0(i - 1).out))) warns.push(`${s.id}: drift.in does nothing — ${i ? `${src[i - 1].id} exits on ${sh0(i - 1).out}, not a drift-*` : 'it is the first shot'}`);
    const toShot = t => t <= h0 ? t : t + L;                     // block time → shot time
    const copy = block.copy ? block.copy(sh, { brand: spec.brand }) : null;
    if (Array.isArray(copy)) {
      sh.copy = copy.filter(x => x != null && String(x).trim() !== '').map(String);
      const read = block.read ? block.read(sh, { brand: spec.brand }) : null;
      if (Array.isArray(read)) sh.copyRead = read.filter(x => x != null && String(x).trim() !== '').map(String);
    }
    // a block that draws its own exit move (exitMove(shot): type's zoom-through) — QA's cut check reads it
    if (block.exitMove && block.exitMove(sh)) sh.exitMove = true;
    // validate(shot, D, {aspects}): --grid warnings; aspects = the job's frames ({'9x16': {W, H}}) for layout checks
    for (const w of block.validate ? block.validate(sh, Db, { aspects: Object.fromEntries(spec.aspects.map(a => [a, ASPECTS[a]])) }) : []) warns.push(w);
    // storyboard / text-audit / thumbnail frame — never inside a moving exit, where the camera is already blurring away
    sh.heroF = Math.max(0, Math.min(sh.out === 'cut' ? D - 1 : D - exitLen(sh.out) - 1, Math.round(toShot(block.hero ? block.hero(sh, Db) : Db * .7))));
    const raw = block.cues ? block.cues(sh, Db) : [];
    if (!Array.isArray(raw)) throw new Error(`${s.id}: block "${s.block}" cues() must return a list of {t, kind}`);
    sh.cues = raw.filter(c => c && c.t >= 0 && c.t < Db).map(c => ({ ...c, t: +((f0 + toShot(c.t)) / FPS).toFixed(5), shot: s.id }));
    for (const c of sh.cues) if (!CUE_KINDS.includes(c.kind)) throw new Error(`${s.id}: block "${s.block}" emits cue kind "${c.kind}" — use one of ${CUE_KINDS.join(', ')}`);
    const words = wordCount(readCopy(sh));
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
    plates: shots.flatMap(s => platePlan(s, spec.blocks[s.block]).map(p => ({ ...p, shot: s.id }))),
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
