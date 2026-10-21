// mix.mjs: the soundtrack for "Saturday" — composed music + frame-synced SFX + the VO, mixed and mastered with the
// product-launch-sting skill's audio engine (buildAudio → master, −14 LUFS / ≤ −1 dBTP), then muxed onto the film.
//   node audio/mix.mjs            (from cue-painted/)
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

const LIB = join(homedir(), '.claude/skills/product-launch-sting/video/lib');
const { buildAudio } = await import(pathToFileURL(join(LIB, 'audio.mjs')).href);
const { master } = await import(pathToFileURL(join(LIB, 'deliver.mjs')).href);

const ROOT = resolve('.'), AUD = join(ROOT, 'audio'), OUT = join(AUD, 'mix'), DUR = 34, BEAT = 60 / 100;
mkdirSync(OUT, { recursive: true });
const ff = args => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });

// ---------- voiceover: each trimmed line placed at its start, sped up only where it must fit ----------
const script = JSON.parse(readFileSync(join(AUD, 'vo_script.json'), 'utf8'));
const PLACE = { '01': [0.4, 1.05], '03': [5.0, 1.04], '04': [9.2, 1], '05': [11.55, 1.05], '06': [14.6, 1.1], '07': [17.85, 1], '08': [21.4, 1.1], '09': [29.3, 1], '10': [32.35, 1] };
const lines = script.lines.filter(l => PLACE[l.id]);
const inputs = lines.flatMap(l => ['-i', join(AUD, 'vo_trim', `${l.id}.wav`)]);
const chains = lines.map((l, i) => { const [st, tempo] = PLACE[l.id], ms = Math.round(st * 1000); return `[${i}:a]aresample=48000,aformat=channel_layouts=stereo${tempo !== 1 ? `,atempo=${tempo}` : ''},adelay=${ms}|${ms}[v${i}]`; });
ff([...inputs, '-filter_complex', `${chains.join(';')};${lines.map((_, i) => `[v${i}]`).join('')}amix=inputs=${lines.length}:normalize=0,apad=whole_dur=${DUR},atrim=end=${DUR}[vo]`, '-map', '[vo]', '-ar', '48000', join(AUD, 'vo_track.wav')]);
for (const l of lines) { const [st, tempo] = PLACE[l.id], d = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(AUD, 'vo_trim', `${l.id}.wav`)]).toString()) / tempo; console.log(`VO ${l.id}  ${st.toFixed(2)}–${(st + d).toFixed(2)} s  ×${tempo}  "${l.text}"`); }

// ---------- the timeline the engine reads ----------
// Audio sections sit on the 100 bpm grid (beat 0.6 s) that drives the animation's idles: the drop lands on the tap.
const sec = [['A', 0, 4.8], ['B', 4.8, 8.4], ['C', 8.4, 16.2], ['DE', 16.2, 24.0], ['F1', 24.0, 27.0], ['F2', 27.0, 31.2], ['G', 31.2, DUR]];
const shots = sec.map(([id, start, end]) => ({ id, start, end, out: 'cut' }));
const c = (t, kind, o = {}) => ({ t, kind, ...o });
const cues = [
  ...[.35, .45, .55, .65, .75, 1.05, 1.15, 1.25, 1.35, 1.45].map(t => c(t, 'tick', { gain: .55 })),   // phone buzz
  c(4.85, 'click'),                                                                                      // the tap
  c(5.0, 'pop', { note: 76 }), c(5.3, 'pop', { note: 79 }), c(5.6, 'pop', { note: 83 }),               // three agents out
  c(6.25, 'pop', { note: 86, gain: .8 }), c(6.7, 'pop', { note: 88, gain: .8 }), c(7.15, 'pop', { note: 91, gain: .8 }), // props
  c(8.05, 'tick'), c(8.2, 'pop', { note: 84, gain: .6 }),                                              // candle down; "on it"
  c(9.1, 'tick'), c(9.6, 'tick'), c(10.1, 'tick'),                                                       // planes launch
  c(10.15, 'chime', { gain: .4 }), c(10.65, 'chime', { gain: .4 }), c(11.15, 'chime', { gain: .4 }),    // planes twinkle out
  c(11.45, 'chime', { gain: .7 }), c(11.75, 'chime', { gain: .7 }),                                     // the ring
  c(12.1, 'click', { gain: .7 }),                                                                        // answer
  c(13.0, 'pop', { note: 84 }), c(13.65, 'tick'),                                                        // summary card out, lands
  c(14.85, 'click'), c(15.2, 'click'), c(15.55, 'click'),                                                // coins into the jar
  c(15.6, 'chime', { gain: .5 }), c(15.85, 'pop', { note: 88, gain: .6 }),                               // line reached; proud
  c(16.6, 'pop', { note: 79 }), c(17.35, 'tick'), c(17.95, 'tick'), c(18.6, 'tick'),                   // the hand-off
  c(18.85, 'hit', { gain: .8 }),                                                                         // burst
  c(18.9, 'pop', { note: 83, gain: .7 }), c(18.98, 'pop', { note: 86, gain: .7 }), c(19.06, 'pop', { note: 90, gain: .7 }), // cards
  c(22.2, 'chime'), c(22.75, 'pop', { note: 88 }),                                                       // the choice; cheer
  c(24.4, 'chime', { gain: .7 }),                                                                        // the friend's surprise
  c(27.3, 'pop', { note: 79, gain: .7 }), c(27.5, 'pop', { note: 83, gain: .7 }), c(27.7, 'pop', { note: 86, gain: .7 }), // window
  c(31.25, 'pop', { note: 84 }), c(32.1, 'click', { gain: .7 }), c(32.4, 'chime'),                      // cog pops, winks, wordmark
];
const whooshes = [{ t: 8.55, out: 'whip-right' }, { t: 23.95, out: 'whip-left' }];
const tl = {
  dur: DUR, beat: BEAT, endcard: 31.2, shots, cues, whooshes,
  music: { style: 'playful', key: 'F', drop: 'B', breaks: ['F1'], level: 0, file: null, start: 0 },
  vo: { file: 'vo_track.wav', start: 0, duck: 9 },
};
buildAudio(AUD, tl, OUT);
const m = master(OUT, DUR);
console.log(`master: ${m.I} LUFS, TP ${m.TP} dBTP (after AAC ${m.aacI} LUFS, TP ${m.aac})`);

// ---------- mux onto the film (picture stream copied untouched) ----------
const film = join(ROOT, 'out', 'cue_saturday.mp4');
ff(['-i', film, '-i', join(OUT, 'master.wav'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-shortest', '-movflags', '+faststart', join(ROOT, 'out', 'cue_saturday_sound.mp4')]);
ff(['-i', join(ROOT, 'out', 'cue_saturday_sound.mp4'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', join(ROOT, 'out', 'cue_saturday_sound_share.mp4')]);
console.log('wrote out/cue_saturday_sound.mp4 and out/cue_saturday_sound_share.mp4');
