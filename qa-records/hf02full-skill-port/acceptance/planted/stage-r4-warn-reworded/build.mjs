// One entry point for a launch-sting job. A job is a folder holding brand.json (+ the logo / music files it names);
// everything generated goes to DIR/out/, and the deliverables land at the top of DIR.
//   node build.mjs --job DIR --init                    write a starter DIR/brand.json to edit (won't overwrite)
//   node build.mjs --job DIR --stills [40,86,150,230]  validate brand.json, render the stills → DIR/stills.png (review sheet)
//   node build.mjs --job DIR --film [--workers 4]      validate, render 720 frames → audio → master → mux → QA
//   node build.mjs --job DIR --audio                   redo audio → master → mux → QA on the frames already rendered
//   --allow-palette                                    skip the no-purple/violet/magenta/orange palette rule
// Deliverables: DIR/<slug>-sting.mp4 (1080×1080 59.94 fps H.264 + AAC 320k) and DIR/<slug>-sting-master.wav.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SKILL, DUR, arg, jobDir, loadBrand } from './brand.mjs';

const argv = process.argv.slice(2);
const job = jobDir(argv);
const allow = arg(argv, '--allow-palette', false) ? ['--allow-palette'] : [];
const t0 = Date.now();

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) { console.error(`\n✗ step failed: ${cmd} ${args.join(' ')}`); process.exit(r.status || 1); }
}
const node = (script, args = [], env = {}) => run(process.execPath, [join(SKILL, script), '--job', job, ...args], env);
function ff(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(r.stderr); console.error('✗ ffmpeg failed'); process.exit(1); }
}
function lufs(path) {
  const s = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  return Number(s.match(/I:\s+(-?[\d.]+) LUFS/g).pop().match(/-?[\d.]+/)[0]);
}
const step = s => console.log(`\n── ${s} ${'─'.repeat(Math.max(0, 60 - s.length))} ${((Date.now() - t0) / 1000).toFixed(0)}s`);

if (arg(argv, '--init', false)) {
  mkdirSync(job, { recursive: true });
  const file = join(job, 'brand.json');
  if (existsSync(file)) { console.log(`${file} already exists — left untouched`); process.exit(0); }
  const ref = JSON.parse(readFileSync(join(SKILL, 'brands/reference-frame-by-frame.json'), 'utf8'));
  delete ref.tints;                                  // a new palette gets tints derived from it
  writeFileSync(file, JSON.stringify(ref, null, 2) + '\n');
  console.log(`wrote ${file} (reference brand — edit copy, palette, logo, music)`);
  process.exit(0);
}

let B;
try { B = loadBrand(job, { allowPalette: !!allow.length }); }
catch (e) { console.error(e.message); process.exit(1); }
for (const w of B.warns) console.log('  brand: ' + w);
for (const t of ['ffmpeg', 'ffprobe']) if (spawnSync(t, ['-version']).status !== 0) { console.error(`${t} not found on PATH`); process.exit(1); }

if (arg(argv, '--stills', false)) {
  const list = arg(argv, '--stills', true);
  step('stills');
  node('render.mjs', [...(list === true ? [] : ['--stills', String(list)]), ...allow]);
  copyFileSync(join(job, 'out/stills/sheet.png'), join(job, 'stills.png'));
  console.log(`\nreview sheet → ${join(job, 'stills.png')}`);
  process.exit(0);
}

const film = !!arg(argv, '--film', false), audioOnly = !!arg(argv, '--audio', false);
if (!film && !audioOnly) { console.error('pass one of --init, --stills, --film, --audio'); process.exit(2); }

if (film) {
  step('render 720 frames (system Chrome)');
  node('render.mjs', ['--film', '--workers', String(arg(argv, '--workers', 4)), ...allow]);
}
const frames = join(job, 'out/frames');
if (!existsSync(frames) || readdirSync(frames).filter(f => f.endsWith('.png')).length !== 720) {
  console.error('out/frames does not hold 720 frames — run --film'); process.exit(1);
}

step(`audio (music: ${B.music.mode}${B.music.mode === 'synth' && B.music.transpose ? `, transpose ${B.music.transpose}` : ''})`);
const A = join(job, 'out/audio');
node('audio.mjs', [], { STEM: 'sfx' });                         // SFX-only stem: timing QA + the bed for track/none
if (B.music.mode === 'synth') node('audio.mjs', [], { STEM: '', TRANSPOSE: String(B.music.transpose) });
else if (B.music.mode === 'none') copyFileSync(join(A, 'sfx-stem.wav'), join(A, 'raw.wav'));
else {
  // A supplied track: trim it to the film, sit it at the built-in cue's level relative to the SFX, fade it out across
  // the end card, sum with the SFX. REL: in the synth mix the music stem integrates 7.7 LU above the SFX stem
  // (music −16.4 LUFS @ pre-norm peak 1.4713, SFX −19.6 LUFS @ 0.8728; both stems normalised to −3 dBFS peak).
  const REL = 7.7;
  const trk = join(A, 'track.wav');
  ff(['-ss', String(B.music.start || 0), '-i', B.music.path, '-t', String(DUR), '-ac', '2', '-ar', '48000',
    '-af', `apad=whole_dur=${DUR},atrim=end=${DUR},afade=t=in:d=0.03,afade=t=out:st=${(DUR - 1.5).toFixed(3)}:d=1.5`, '-c:a', 'pcm_f32le', trk]);
  const gain = lufs(join(A, 'sfx-stem.wav')) + REL - lufs(trk);
  ff(['-i', trk, '-i', join(A, 'sfx-stem.wav'), '-filter_complex', `[0]volume=${gain.toFixed(2)}dB[m];[m][1]amix=inputs=2:normalize=0:duration=first`,
    '-c:a', 'pcm_f32le', join(A, 'raw.wav')]);
  console.log(`track: ${B.music.path} from ${B.music.start || 0}s, gain ${gain.toFixed(2)} dB`);
}

step('master (−14 LUFS, ≤ −1 dBTP)');
node('master.mjs');

step('mux');
const mp4 = join(job, `${B.slug}-sting.mp4`);
ff(['-framerate', '60000/1001', '-i', join(frames, '%05d.png'), '-i', join(A, 'master.wav'),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
  // ffmpeg 8 drops -color_primaries/-color_trc for filtered frames; setparams stamps them on the frames themselves
  '-vf', 'scale=out_color_matrix=bt709:out_range=tv,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv',
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
  '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-movflags', '+faststart', mp4]);
copyFileSync(join(A, 'master.wav'), join(job, `${B.slug}-sting-master.wav`));
console.log(`→ ${mp4}`);

step('QA');
node('qa.mjs', ['--mp4', mp4]);
console.log(`\ndone in ${((Date.now() - t0) / 1000).toFixed(0)}s\n  ${mp4}\n  ${join(job, `${B.slug}-sting-master.wav`)}`);
