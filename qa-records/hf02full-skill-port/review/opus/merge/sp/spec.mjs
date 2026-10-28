// Load + validate a job's beats.yaml into a normalised spec. Errors throw (with every problem listed); soft issues
// come back as warnings for the grid printout.
import { readFileSync, existsSync, readdirSync, openSync, readSync, closeSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { VIDEO, ASPECTS, slugify, sh } from './common.mjs';
import { BLOCKS } from '../engine/blocks/index.js';
import { normItems } from '../engine/ui.js';
import { ICON_NAMES } from '../engine/art.js';

export const TRANSITIONS = ['cut', 'whip-left', 'whip-right', 'whip-up', 'whip-down', 'zoom-in', 'zoom-out', 'blur', 'glitch', 'smear-left', 'smear-right', 'tunnel', 'flash',
  'drift-left', 'drift-right', 'drift-up', 'drift-down'];
export const BG_MOVES = ['in', 'out', 'left', 'right', 'none'];
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|svg)$/i, VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv)$/i;
// a block's footage-capable fields: `media: ['card', 'cards', {field: 'shot', fit: 'contain'}]` (string fields hold one
// path, list fields several); fit = cover (default: cover-cropped to the stage) | contain (whole, inside the stage);
// scale = plate size as a share of the stage (default 1; e.g. .35 for small cards — 1/8 the pixels to extract and decode)
export function mediaFields(block) {
  return [].concat((block && block.media) || []).map(m => typeof m === 'string' ? { field: m, fit: 'cover', scale: 1 }
    : m && typeof m === 'object' && m.field ? { field: String(m.field), fit: m.fit === 'contain' ? 'contain' : 'cover', scale: Number(m.scale) > 0 && Number(m.scale) <= 1 ? Number(m.scale) : 1 } : null).filter(Boolean);
}
export const STYLES = ['playful', 'keynote', 'calm', 'none', 'track'];
export const KEYS = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const HEX = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_COLORS = { bg: '#F6F6F7', ink: '#111114', muted: '#7C7C86', accent: '#4C8DF6', accent2: '#2FC2A3', accent3: '#FFC53D', dark: '#0E0E12', line: '#C3C8D4', card: '#FFFFFF' };
const lighten = (hex, k) => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) + (255 - parseInt(hex.slice(i, i + 2), 16)) * k).toString(16).padStart(2, '0')).join('').toUpperCase();
// fields a block can't do without (custom blocks may declare their own `required`)
const REQUIRED = { headline: ['text'], stat: ['value'], media: ['src'], prompt: ['prompt'], phone: ['items'], browser: ['items'], panel: ['items'] };
const STYLE_BPM = { playful: 120, keynote: 124, calm: 96 };
const RESERVED = ['i', 'f0', 'f1', 'D', 'Db', 'start', 'end', 'heroF', 'cues', 'copy', 'copyRead', 'exitMove'];   // fields the timeline adds to shots
// the reel and film blocks' fixed choices (checked for the built-in blocks; a job's own block of the same name is its own)
const ENUMS = {
  sticker: { style: ['outline', 'plate', 'pill'], pos: ['center', 'top', 'bottom'] },
  split: { mode: ['side', 'wipe'] },
  float: { device: ['card', 'phone'], from: ['left', 'right'] },
  type: { face: ['sans', 'serif', 'brand'] },
  stack: { chrome: ['post', 'none'] },
  wall: { chrome: ['ugc', 'none'], drift: ['up', 'down', 'left', 'right'] },
};
// shot fields the engine itself reads on every shot (any block): a custom block's own param of that name collides
const ENGINE_FIELDS = Object.fromEntries([
  ...['zoom', 'focus', 'offset', 'pan', 'push'].map(k => [k, 'it moves the camera too']),
  ['move', 'a list moves the camera too (a word stays the block\'s)'],
  ...['bg', 'bgFrom', 'bgDim', 'bgMove', 'letterbox'].map(k => [k, 'the engine draws the footage background and the cinema bars itself']),
  ...['copy', 'copyRead'].map(k => [k, 'reserved by the timeline for the block\'s copy() lines']),
]);
const OVERLAY_KINDS = ['bar', 'bubble', 'words', 'pill', 'orb'], OVERLAY_POS = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];
// an image file's bytes must be an image Chrome can decode (a failed download saved as .jpg is an HTML page; an iPhone
// photo renamed .jpg is HEIC), whole (a download cut short still decodes in Chrome — its top part, the rest left blank —
// so ffmpeg decodes every raster once) and still (Chrome plays an animated GIF / APNG / WebP / AVIF / SVG on its own
// clock, not frame by frame, so no two renders would match): returns null when fine, else what's wrong. Raster formats
// are sniffed by content (any raster extension works); SVG must be named .svg (it is served as image/svg+xml). Each file
// is checked once per version (size + mtime).
const IMG_SEEN = new Map();
export function imageProblem(file) {
  let st;
  try { st = statSync(file); if (!st.isFile()) return null; } catch { return null; }
  const key = `${file}\0${st.size}\0${st.mtimeMs}`;
  if (!IMG_SEEN.has(key)) IMG_SEEN.set(key, imageCheck(file, st.size));
  return IMG_SEEN.get(key);
}
function imageCheck(file, size) {
  let buf;
  try { const fd = openSync(file, 'r'); buf = Buffer.alloc(Math.min(size, 16 << 20)); const n = readSync(fd, buf, 0, buf.length, 0); closeSync(fd); buf = buf.subarray(0, n); } catch { return null; }
  const at = (i, str) => buf.subarray(i, i + str.length).toString('latin1') === str, head = buf.subarray(0, 65536).toString('utf8').replace(/^\uFEFF/, '').trimStart().toLowerCase();
  const svgName = /\.svg$/i.test(file), name = file.split(/[\\/]/).pop();
  if (!buf.length) return 'is empty';
  const still = (kind, fix = `export it as a clip at least as long as the shot (.mp4${kind === 'GIF' ? `, e.g. ffmpeg -ignore_loop 0 -i ${name} -t 5 -pix_fmt yuv420p ${name.replace(/\.[^.]+$/, '')}.mp4` : ''}, or a ProRes 4444 .mov to keep transparency) or use a still`) =>
    `is an animated ${kind} — Chrome plays it on its own clock, not the film's, so no two renders would match; ${fix}`;
  // a raster: still, then decoded whole by ffmpeg (no ffmpeg: nothing more to say)
  const whole = () => {
    const r = sh('ffmpeg', ['-hide_banner', '-v', 'error', '-i', file, '-f', 'null', '-']);
    if (r.error) return null;
    const msg = String(r.stderr || '').trim().split('\n')[0].replace(/\[[^\]]*@ 0x[0-9a-f]+\]\s*/g, '');
    return r.status !== 0 || msg ? `is damaged or cut short (a truncated download?${msg ? ` ffmpeg: ${msg}` : ''}) — download or export it again` : null;
  };
  if (buf[0] === 0x89 && at(1, 'PNG') || buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF || at(0, 'GIF8') || at(0, 'RIFF') && at(8, 'WEBP')) {
    if (svgName) return 'is a raster image named .svg — give it its real extension (.png/.jpg/.webp)';
    const anim = animation(buf, at);
    return anim ? still(anim) : whole();
  }
  if (at(4, 'ftyp')) { const brand = buf.subarray(8, 12).toString('latin1'); return brand === 'avis' ? still('AVIF (an image sequence)') : brand === 'avif' ? whole() : /^(hei[cxms]|hev[cx]|mif1|msf1)$/.test(brand) ? 'is a HEIC/HEIF photo — export it as JPEG or PNG' : `is a video/ISO file (${brand}), not an image`; }
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) return 'is an HTML page, not an image (a failed download?)';
  if (/<svg[\s>]/.test(head) && (head.startsWith('<svg') || head.startsWith('<?xml') || head.startsWith('<!--') || head.startsWith('<!doctype svg'))) {
    if (!svgName) return 'is an SVG — name it .svg';
    return /<(animate|animateTransform|animateMotion|set)[\s/>]|@keyframes|animation(-name)?\s*:/i.test(buf.toString('utf8')) ? still('SVG (SMIL or CSS animation)', 'remove the animation, or export it as a clip at least as long as the shot') : null;
  }
  return 'is not a PNG, JPEG, WebP, GIF, AVIF or SVG image';
}
// which animated raster this is, or null: a GIF with a second frame, a PNG with an acTL chunk before its image data
// (APNG), a WebP whose VP8X header sets the animation flag
function animation(buf, at) {
  if (at(0, 'GIF8')) {
    let i = 13 + (buf[10] & 0x80 ? 3 << ((buf[10] & 7) + 1) : 0), frames = 0;
    const blocks = () => { while (i < buf.length && buf[i]) i += buf[i] + 1; i++; };      // data sub-blocks up to the 0 terminator
    while (i < buf.length && frames < 2) {
      if (buf[i] === 0x21) { i += 2; blocks(); }
      else if (buf[i] === 0x2C) { frames++; const p = buf[i + 9]; i += 10 + (p & 0x80 ? 3 << ((p & 7) + 1) : 0) + 1; blocks(); }
      else break;                                                                            // 0x3B trailer (or a cut-off file)
    }
    return frames > 1 ? 'GIF' : null;
  }
  if (buf[0] === 0x89) {
    for (let i = 8; i + 8 <= buf.length;) { const t = buf.subarray(i + 4, i + 8).toString('latin1'); if (t === 'acTL') return 'PNG (APNG)'; if (t === 'IDAT') break; i += 12 + buf.readUInt32BE(i); }
    return null;
  }
  return at(0, 'RIFF') && at(12, 'VP8X') && buf[20] & 0x02 ? 'WebP' : null;
}
// a footage file must be a video ffprobe can read, with a picture track and a duration (a failed download saved as
// .mp4 is an HTML page; an audio-only clip has no picture): {duration, alpha, codec} or {problem}; null without
// ffprobe. alpha: it carries transparency (ProRes 4444, PNG / QuickTime Animation, VP9 with alpha) — extracted as PNG
// frames so it keeps it (VP9's alpha needs the libvpx decoder)
const VID_SEEN = new Map();
export function footageInfo(file) {
  let st;
  try { st = statSync(file); if (!st.isFile()) return null; } catch { return null; }
  const key = `${file}\0${st.size}\0${st.mtimeMs}`;
  if (VID_SEEN.has(key)) return VID_SEEN.get(key);
  const r = st.size ? sh('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,pix_fmt,duration:stream_tags=alpha_mode:format=duration', '-of', 'json', file]) : null;
  let j = null, info = null;
  try { j = JSON.parse(r.stdout); } catch { /* not JSON: unreadable */ }
  const msg = r ? String(r.stderr || '').trim().split('\n').pop().split(file + ': ').join('') : '';
  if (!r) info = { problem: 'is empty' };
  else if (r.error) info = null;
  else if (r.status !== 0 || !j) info = { problem: `can't be read as video (a failed download, or not a video file?${msg ? ` ffprobe: ${msg}` : ''}) — export it again as .mp4 / .mov` };
  else {
    const v = (j.streams || [])[0], duration = Number((j.format || {}).duration) || Number(v && v.duration);
    info = !v ? { problem: 'has no picture track (an audio-only file?) — export the clip with its video' }
      : !(duration > 0) ? { problem: 'has no duration ffprobe can read — export it again as .mp4' }
      : { duration, codec: String(v.codec_name || ''), alpha: /^(yuva|rgba|bgra|argb|abgr|gbrap|ya\d)/.test(String(v.pix_fmt || '')) || String((v.tags || {}).alpha_mode) === '1' };
  }
  VID_SEEN.set(key, info);
  return info;
}
const isAt = v => v == null || v === '' || /^\d+(?:\.\d+)?\s*(s|sec)?$/.test(String(v).trim());     // a local frame (45) or seconds ("1.5s")

export async function loadBlocks(job) {
  const custom = {}, dir = join(job, 'blocks');
  if (existsSync(dir)) for (const f of readdirSync(dir).filter(f => f.endsWith('.mjs'))) {
    let mod;
    try { mod = (await import(pathToFileURL(join(dir, f)).href + `?v=${Date.now()}`)).default; }
    catch (e) { const at = String(e.stack || '').match(new RegExp(`${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\?v=\\d+)?:(\\d+)`)); throw new Error(`blocks/${f}${at ? `, line ${at[1]}` : ''}: ${e.message}`); }
    if (!mod || !mod.name || !mod.build) throw new Error(`blocks/${f}: must export default { name, build(ctx, shot), cues?, hero? }`);
    custom[mod.name] = { ...mod, file: f };
  }
  return { ...BLOCKS, ...custom, __custom: custom };
}

export async function loadSpec(job) {
  const file = join(job, 'beats.yaml');
  if (!existsSync(file)) throw new Error(`no beats.yaml in ${job} (run: lv.mjs --job ${job} --init)`);
  let raw;
  try { raw = YAML.parse(readFileSync(file, 'utf8')); } catch (e) { throw new Error(`beats.yaml is not valid YAML: ${e.message}`); }
  if (raw == null) throw new Error('beats.yaml is empty — run lv.mjs --init for a commented starter');
  const isMap = v => v != null && typeof v === 'object' && !Array.isArray(v);
  if (!isMap(raw)) throw new Error('beats.yaml must be a map of settings (title:, brand:, music:, shots: …) — see templates/beats.yaml');
  const errs = [], warns = [];
  const blocks = await loadBlocks(job);
  // a custom block's own params can't reuse the fields the engine reads on every shot: the engine would apply them too
  for (const cb of Object.values(blocks.__custom)) {
    const ks = Object.keys(cb.params || {}).filter(k => Object.hasOwn(ENGINE_FIELDS, k));
    if (ks.length) warns.push(`blocks/${cb.file}: ${ks.length > 1 ? 'params' : 'param'} ${ks.map(k => `\`${k}\``).join(', ')} ${ks.length > 1 ? 'are' : 'is'} the engine's on every shot (${[...new Set(ks.map(k => ENGINE_FIELDS[k]))].join('; ')}) — rename the block's own ${ks.length > 1 ? 'params' : 'param'} (GUIDE: Custom blocks)`);
  }
  const mapOr = (v, what, eg) => { if (v == null) return {}; if (isMap(v)) return v; errs.push(`${what} must be a map${eg ? `, e.g. ${eg}` : ''} (got ${JSON.stringify(v)})`); return {}; };
  const b = mapOr(raw.brand, 'brand', '{name: Acme, colors: {accent: "#4C8DF6"}}');
  const colors = { ...DEFAULT_COLORS, ...mapOr(b.colors, 'brand.colors', '{accent: "#4C8DF6"}') };
  for (const [k, v] of Object.entries(colors)) if (!HEX.test(v)) errs.push(`brand.colors.${k} must be a #RRGGBB hex (got ${v})`);
  if (!colors.accentOnDark && HEX.test(colors.accent)) colors.accentOnDark = lighten(colors.accent, .45);   // dark shots: the brand accent, lifted
  const asset = (p, what) => { if (p && !existsSync(join(job, p))) errs.push(`${what}: file not found: ${p}`); return p; };
  // an existing image file that can't be an image: one clear line at --grid instead of a broken frame or a stage error
  const decodable = (p, what) => { if (p && IMAGE_EXT.test(p) && existsSync(join(job, p))) { const bad = imageProblem(join(job, p)); if (bad) errs.push(`${what}: ${p} ${bad}`); } };
  // the same for footage: a file ffprobe can't read as video, or a start point past its end, is one clear line here
  // instead of an ffmpeg error when the frames are extracted; footage = what was probed ({path: {duration, alpha}}: the
  // timeline warns when a clip is too short for its shot, the extraction keeps an alpha clip's transparency)
  const footage = {};
  const playable = (p, what, from, fromK) => {
    if (!(p && VIDEO_EXT.test(p) && existsSync(join(job, p)))) return;
    const fi = footageInfo(join(job, p));
    if (!fi) return;
    if (fi.problem) { errs.push(`${what}: ${p} ${fi.problem}`); return; }
    footage[p] = fi;
    for (const x of [].concat(from ?? [])) if (Number(x) >= fi.duration) errs.push(`${what}: ${fromK} ${x} is past the end of ${p} (${fi.duration.toFixed(2)} s long) — lower it`);
  };
  if (b.logo) { asset(b.logo, 'brand.logo'); if (!['.svg', '.png', '.webp'].includes(extname(b.logo).toLowerCase())) errs.push('brand.logo must be .svg, .png or .webp'); else decodable(b.logo, 'brand.logo'); }
  if (b.font != null && !(isMap(b.font) && b.font.family && isMap(b.font.files))) errs.push('brand.font must be {family: Name, files: {400: assets/x.woff2, 700: assets/y.woff2}}');
  else if (b.font) for (const [w, f] of Object.entries(b.font.files)) asset(f, `brand.font.files.${w}`);
  if (b.cast != null && !Array.isArray(b.cast)) errs.push('brand.cast must be a list, e.g. [{src: assets/hero.svg}, {shape: blob, col: "#FF8A4C"}]');
  for (const c of Array.isArray(b.cast) ? b.cast : []) { if (!isMap(c)) errs.push(`brand.cast: each entry is a map like {src: assets/x.svg} (got ${JSON.stringify(c)})`); else if (c.src) { asset(c.src, 'brand.cast'); decodable(String(c.src), 'brand.cast'); } }
  const bname = String(b.name || raw.title || 'Product');
  const brand = {
    name: bname, mono: String(b.mono || (bname.match(/[A-Za-z0-9]/) || ['P'])[0].toUpperCase()), logo: b.logo || null, mark: b.mark || 'monogram',
    logoTint: b.logoTint || null, logoTintDark: b.logoTintDark || (b.logoTint ? '#FFFFFF' : null),
    colors, font: isMap(b.font) && b.font.family ? { ...b.font, family: String(b.font.family).replace(/['"\\;<>{}]/g, '').trim() || 'Brand' } : null, bg: b.bg || 'grid', cast: Array.isArray(b.cast) ? b.cast.filter(isMap) : null,
  };
  const m = typeof raw.music === 'string' ? { style: raw.music } : mapOr(raw.music, 'music', '{style: playful, bpm: 120} — or just "music: calm"');
  const style = m.style || 'playful';
  if (!STYLES.includes(style)) errs.push(`music.style must be one of ${STYLES.join(', ')}`);
  const bpm = Number(m.bpm || STYLE_BPM[style] || 120);
  if (!(bpm >= 60 && bpm <= 180)) errs.push('music.bpm must be 60–180');
  if (m.key && !(m.key in KEYS)) errs.push(`music.key must be one of ${Object.keys(KEYS).join(' ')}`);
  if (style === 'track') { if (!m.file) errs.push('music.style track needs music.file'); else asset(m.file, 'music.file'); }
  const music = { style, bpm, key: m.key || { playful: 'F', keynote: 'D', calm: 'G', film: 'F' }[style] || 'C', file: m.file || null, start: Number(m.start || 0),
    downbeat: Number(m.downbeat || 0), drop: m.drop != null ? String(m.drop) : null, breaks: [].concat(m.breaks || []).map(String), level: Number(m.level || 0) };
  // music.hit (style film only; the other styles ignore it, as before): when the hit lands, in seconds after the end card's first frame
  if (style === 'film' && m.hit != null && !(m.hit !== '' && Number.isFinite(Number(m.hit)) && Number(m.hit) >= -1 && Number(m.hit) <= 2)) errs.push(`music.hit is seconds after the end card's first frame, −1…2 s (got ${JSON.stringify(m.hit)}) — e.g. hit: 0.372 when the reference's hit lands 0.372 s into its end card`);
  if (style === 'film' && m.hit != null) music.hit = Number(m.hit);
  // voiceover: {file, start, duck} (or just a file path); a cutdown gets its own read under voiceover.cutdowns.<name>
  const voRead = (v, what) => {
    const x = typeof v === 'string' ? { file: v } : mapOr(v, what, '{file: assets/vo.wav, start: 0.5}');
    if (!x.file) { errs.push(`${what} needs file: (a WAV/MP3/M4A of the read)`); return null; }
    asset(String(x.file), `${what}.file`);
    return { file: String(x.file), start: Number(x.start || 0), duck: Number(x.duck ?? 9) };
  };
  const v0 = raw.voiceover, vo = v0 != null ? voRead(v0, 'voiceover') : null;
  if (vo) {
    vo.cutdowns = {};
    for (const [name, v] of Object.entries(isMap(v0) ? mapOr(v0.cutdowns, 'voiceover.cutdowns', '{10s: assets/vo-10s.wav}') : {})) vo.cutdowns[name] = voRead(v, `voiceover.cutdowns.${name}`);
  }
  const aspects = [].concat(raw.aspects ?? ['16x9']).map(String);
  if (!aspects.length) errs.push('aspects: list at least one of ' + Object.keys(ASPECTS).join(', '));
  if (new Set(aspects).size !== aspects.length) errs.push('aspects: each aspect only once');
  for (const a of aspects) if (!ASPECTS[a]) errs.push(`aspects: ${a} is not one of ${Object.keys(ASPECTS).join(', ')}`);
  const finite = (v, what, lo = -Infinity, hi = Infinity) => { if (v != null && !(Number.isFinite(Number(v)) && Number(v) >= lo && Number(v) <= hi)) errs.push(`${what} must be a number${lo > -Infinity ? ` ≥ ${lo}` : ''}${hi < Infinity ? ` ≤ ${hi}` : ''} (got ${v})`); };
  finite(m.downbeat, 'music.downbeat', 0, 30); finite(m.start, 'music.start', 0); finite(m.level, 'music.level', -30, 30);
  for (const [k, v] of vo ? [['voiceover', vo], ...Object.entries(vo.cutdowns).map(([n, x]) => [`voiceover.cutdowns.${n}`, x])] : []) if (v) { finite(v.start, `${k}.start`, 0); finite(v.duck, `${k}.duck`, 0, 40); }
  if (raw.shots != null && !Array.isArray(raw.shots)) errs.push('shots must be a list — each shot starts with "- " (see templates/beats.yaml)');
  const shots = (Array.isArray(raw.shots) ? raw.shots : []).flatMap((s, i) => {
    if (!isMap(s)) { errs.push(`shots[${i}] must be a map like {id: s${i + 1}, block: headline, beats: 4, text: …} (got ${JSON.stringify(s)})`); return []; }
    return [{ ...s, id: String(s.id || `s${i + 1}`) }];
  });
  if (!shots.length) errs.push('shots: list at least one shot');
  const ids = new Set();
  shots.forEach((s, i) => {
    const where = `shots[${i}] (${s.id})`;
    if (ids.has(s.id)) errs.push(`${where}: duplicate id`); ids.add(s.id);
    if (!/^[\w-]+$/.test(s.id)) errs.push(`${where}: id must be letters, digits, - or _ (it names files and URLs)`);
    const blk = blocks[s.block];
    for (const k of (blk && (blk.required || REQUIRED[s.block])) || []) if (s[k] == null || s[k] === '' || (Array.isArray(s[k]) && !s[k].length)) errs.push(`${where}: ${s.block} needs \`${k}\``);
    if (s.block === 'stat') for (const k of ['value', 'from', 'decimals']) if (s[k] != null && !Number.isFinite(Number(s[k]))) errs.push(`${where}: stat ${k} must be a number (got ${s[k]}) — put symbols in prefix/suffix`);
    if (s.block === 'stat' && s.decimals != null && !(Number.isInteger(Number(s.decimals)) && Number(s.decimals) >= 0 && Number(s.decimals) <= 6)) errs.push(`${where}: stat decimals must be a whole number 0–6`);
    if (['phone', 'browser', 'panel'].includes(s.block) && s.items != null && !Array.isArray(s.items)) errs.push(`${where}: items must be a list (one "- item" per line)`);
    for (const k of ['items', 'icons', 'steps']) if (s[k] != null && s.block !== 'prompt' && !Array.isArray(s[k]) && k !== 'items') errs.push(`${where}: ${k} must be a list`);
    if (['phone', 'browser', 'panel'].includes(s.block) && Array.isArray(s.items)) {
      try {
        const its = normItems(s.items);
        its.forEach((it, j) => {
          if (it.type === 'tap' && !its.slice(0, j).some(p => p.type === 'card' && [].concat(p.actions || []).map(String).includes(it.text)))
            errs.push(`${where}: tap "${it.text}" has no card button with that label before it`);
          if (it.type === 'image') { asset(it.src, `${where} image item`); decodable(String(it.src), `${where} image item`); }
          if (['card', 'row', 'notif'].includes(it.type) && it.icon && /[./]/.test(String(it.icon)) && it.icon !== 'logo') { asset(String(it.icon), `${where} ${it.type} icon`); decodable(String(it.icon), `${where} ${it.type} icon`); }
        });
      } catch (e) { errs.push(`${where}: ${e.message}`); }
    }
    if (s.block === 'orbit' && s.items != null) {
      if (!Array.isArray(s.items) && typeof s.items !== 'string') errs.push(`${where}: orbit items must be a list of names or {icon, label} maps`);
      for (const it of [].concat(s.items)) {
        if (typeof it === 'string') { if (/[./]/.test(it)) { asset(it, `${where} orbit icon`); decodable(it, `${where} orbit icon`); } }
        else if (!isMap(it)) errs.push(`${where}: orbit item ${JSON.stringify(it)} must be a name (mail, chat …) or {icon, label}`);
        else if (it.icon && !ICON_NAMES.includes(it.icon)) { asset(String(it.icon), `${where} orbit icon`); decodable(String(it.icon), `${where} orbit icon`); }
      }
    }
    for (const k of RESERVED) if (k in s) errs.push(`${where}: "${k}" is reserved by the timeline — rename that field`);
    if (!blocks[s.block]) errs.push(`${where}: unknown block "${s.block}" — built-in: ${Object.keys(BLOCKS).join(', ')}${Object.keys(blocks.__custom).length ? `; custom: ${Object.keys(blocks.__custom).join(', ')}` : ''}`);
    if (s.beats == null && s.sec == null) errs.push(`${where}: give a length as beats: N or sec: S`);
    if (s.beats != null && !(Number(s.beats) > 0)) errs.push(`${where}: beats must be > 0`);
    if (s.sec != null && !(Number(s.sec) > 0)) errs.push(`${where}: sec must be > 0`);
    if (s.out && !TRANSITIONS.includes(s.out)) errs.push(`${where}: out must be one of ${TRANSITIONS.join(', ')}`);
    if (s.hold && !(Array.isArray(s.hold) && s.hold.length === 2 && s.hold.every(x => Number.isFinite(Number(x)) && Number(x) >= 0) && Number(s.hold[1]) > Number(s.hold[0]))) errs.push(`${where}: hold must be [fromFrame, toFrame] in the shot's own 30-fps frames`);
    if (s.theme && !['light', 'dark'].includes(s.theme)) errs.push(`${where}: theme must be light or dark`);
    // camera fields (any shot): zoom about focus, offset, tanh pans, a constant move; drift: {in, out} strengths of a
    // drift cut. A camera field may be a per-aspect map ({16x9: 1.2, 9x16: 1}): each value is checked
    const num = v => v != null && v !== '' && Number.isFinite(Number(v));
    const camMaps = {};
    for (const k of ['zoom', 'focus', 'offset', 'pan', 'move']) {
      const v = s[k];
      if (isMap(v) && Object.keys(v).length && Object.keys(v).every(a => /^\d+x\d+$/.test(a))) {
        for (const a of Object.keys(v)) if (!ASPECTS[a]) errs.push(`${where}: ${k}: ${a} is not one of ${Object.keys(ASPECTS).join(', ')}`);
        camMaps[k] = v;
      }
    }
    const pair = (v, lo, hi) => Array.isArray(v) && v.length === 2 && v.every(x => num(x) && Number(x) >= lo && Number(x) <= hi);
    if (s.push != null && !num(s.push)) errs.push(`${where}: push must be a number (the slow zoom over the shot; 0 = none, default .035) (got ${JSON.stringify(s.push)})`);
    // each value of a camera field (or of its per-aspect map), with the name to report it under
    const each = k => s[k] == null ? [] : camMaps[k] ? Object.entries(camMaps[k]).map(([a, v]) => [`${k}.${a}`, v]) : [[k, s[k]]];
    for (const [k, v] of each('zoom')) if (v != null && !(num(v) && Number(v) >= .25 && Number(v) <= 6)) errs.push(`${where}: ${k} must be a number 0.25–6 (the camera's base scale; 2 = twice as close) (got ${JSON.stringify(v)})`);
    for (const [k, v] of each('focus')) if (v != null && !pair(v, 0, 1)) errs.push(`${where}: ${k} must be [x, y], fractions 0–1 of the frame — the point the zoom keeps in place (got ${JSON.stringify(v)})`);
    // `move` is the camera's as a list; a word is media's Ken Burns (a custom block's own word is its own)
    const ownMove = typeof s.move === 'string' && blk !== BLOCKS[s.block];
    if (typeof s.move === 'string' && s.block === 'media' && !ownMove) { if (!BG_MOVES.includes(s.move)) errs.push(`${where}: media move must be one of ${BG_MOVES.join(', ')} (its Ken Burns), or [x, y] for a camera drift (got ${JSON.stringify(s.move)})`); }
    else if (!ownMove) for (const [k, v] of each('move')) if (v != null && !pair(v, -1, 1)) errs.push(`${where}: ${k} must be [x, y], a constant drift in fractions of the frame per second (e.g. [0, -0.04]) (got ${JSON.stringify(v)})`);
    for (const [k, v] of each('offset')) if (v != null && !pair(v, -2, 2)) errs.push(`${where}: ${k} must be [x, y], fractions of the frame's width and height (e.g. [-0.14, 0]) (got ${JSON.stringify(v)})`);
    for (const [k, v] of each('pan')) {
      if (v == null) continue;
      const pans = Array.isArray(v) ? v : [v];
      pans.forEach((q, j) => {
        const pw = `${where}: ${k}${Array.isArray(v) ? ` #${j + 1}` : ''}`;
        if (!isMap(q)) { errs.push(`${pw} must be a map like {at: 22, by: [0.14, 0], len: 20} (got ${JSON.stringify(q)})`); return; }
        if (!isAt(q.at) || q.at == null || q.at === '') errs.push(`${pw}: at must be the local frame of its fastest moment (45) or seconds like 1.5s (got ${JSON.stringify(q.at)})`);
        if (!pair(q.by, -2, 2)) errs.push(`${pw}: by must be [x, y], how far the content moves as fractions of the frame's width and height (got ${JSON.stringify(q.by)})`);
        if (q.len != null && !(isAt(q.len) && Number(String(q.len).replace(/s(ec)?$/, '')) > 0)) errs.push(`${pw}: len must be the move's length in frames (20) or seconds (got ${JSON.stringify(q.len)})`);
      });
    }
    if (s.drift != null && (isMap(s.drift) || (blk === BLOCKS[s.block] && s.block !== 'wall'))) {      // a wall's (or a custom block's) own drift word is its own
      if (!isMap(s.drift) || Object.keys(s.drift).some(k => !['in', 'out', 'decay'].includes(k))) errs.push(`${where}: drift must be {in: N, out: N, decay: N} — strengths of the shot's drift entrance / drift exit (1 = default) and how fast the entrance settles (got ${JSON.stringify(s.drift)})`);
      else {
        for (const k of ['in', 'out']) if (s.drift[k] != null && !(num(s.drift[k]) && Number(s.drift[k]) >= 0 && Number(s.drift[k]) <= 10)) errs.push(`${where}: drift.${k} must be a number 0–10 (got ${JSON.stringify(s.drift[k])})`);
        if (s.drift.decay != null && !(num(s.drift.decay) && Number(s.drift.decay) >= .3 && Number(s.drift.decay) <= .95)) errs.push(`${where}: drift.decay must be a number 0.3–0.95 — the share of the entrance move left after each frame (default .65) (got ${JSON.stringify(s.drift.decay)})`);
      }
    }
    if (s.block === 'media' && s.from != null && !(Number.isFinite(Number(s.from)) && Number(s.from) >= 0)) errs.push(`${where}: media from must be seconds ≥ 0 into the footage (got ${JSON.stringify(s.from)})`);
    if (s.block === 'media' && s.src) { asset(s.src, `${where}.src`); decodable(String(s.src), `${where}.src`); playable(String(s.src), `${where}.src`, s.from, 'from'); }
    // the reel / film blocks: fixed choices, list fields, scene overlays, the lockup's partner logo
    if (blk && blk === BLOCKS[s.block]) {
      for (const [k, opts] of Object.entries(ENUMS[s.block] || {})) if (s[k] != null && !(k === 'drift' && isMap(s[k])) && !opts.includes(String(s[k]))) errs.push(`${where}: ${s.block} ${k} must be one of ${opts.join(', ')} (got ${JSON.stringify(s[k])})`);
      const list = (k, eg) => { if (s[k] != null && !Array.isArray(s[k])) errs.push(`${where}: ${s.block} ${k} must be a list, e.g. ${eg}`); };
      for (const k of REEL_BOOLS[s.block] || []) if (s[k] != null && typeof s[k] !== 'boolean') errs.push(`${where}: ${s.block} ${k} must be true or false (got ${JSON.stringify(s[k])})`);
      if (s.block === 'sticker' && s.tilt != null && !(num(s.tilt) && Math.abs(Number(s.tilt)) <= 45)) errs.push(`${where}: sticker tilt must be a number of degrees −45…45, without "deg" (default −5) (got ${JSON.stringify(s.tilt)})`);
      if (CAPTIONED.includes(s.block) && s.captionAt != null) {
        if (!isAt(s.captionAt)) errs.push(`${where}: captionAt must be the caption's first local frame (4) or seconds like 0.5s (got ${JSON.stringify(s.captionAt)})`);
        else if (s.caption == null || String(s.caption).trim() === '') warns.push(`${where}: captionAt does nothing without caption`);
      }
      if (s.block === 'split') { list('labels', '[Before, After]'); if (Array.isArray(s.labels) && s.labels.length > 2) errs.push(`${where}: split labels takes up to two chip labels (got ${s.labels.length})`); }
      if (s.block === 'stack' || s.block === 'wall') list('cards', '[assets/a.mp4, assets/b.jpg]');
      if (s.block === 'wall') list('chips', '[Hook in 1s, Captions]');
      if (s.block === 'stack' && s.count != null && !(Number.isInteger(Number(s.count)) && Number(s.count) >= 2 && Number(s.count) <= 14)) errs.push(`${where}: stack count must be a whole number 2–14 (got ${s.count})`);
      const atNeg = v => v == null || v === '' || /^-?\d+(?:\.\d+)?\s*(s|sec)?$/.test(String(v).trim());     // frames, seconds, or negative (already there)
      // a mascot / avatar: a cast index (a whole number ≥ 0: brand.cast or the built-in cast), or logo / spark where the
      // block draws them; a number > 0 (scene overlay sizes and speeds); an on/off field
      const whole = v => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isInteger(Number(v)) && Number(v) >= 0;
      const castIdx = (v, what, marks = true) => { if (v != null && !(whole(v) || (marks && ['logo', 'spark'].includes(String(v))))) errs.push(`${where}: ${what} must be a cast index (a whole number ≥ 0)${marks ? ', logo or spark' : ''} (got ${JSON.stringify(v)})`); };
      const pos = v => typeof v !== 'boolean' && num(v) && Number(v) > 0;
      const onOff = (k, what) => { if (s[k] != null && typeof s[k] !== 'boolean') errs.push(`${where}: ${s.block} ${k} must be true or false — ${what} (got ${JSON.stringify(s[k])})`); };
      if (s.block === 'type') {
        if (s.through != null && !(typeof s.through === 'boolean' || (num(s.through) && Number(s.through) >= 0))) errs.push(`${where}: type through must be true (its last 10 frames), false, or a frame count ≥ 0 — the zoom through the camera at the end of the shot (got ${JSON.stringify(s.through)})`);
        onOff('overLogo', 'false drops the brand logo from the co-brand line');
      }
      if (s.block === 'lockup') {
        if (s.cast != null && s.cast !== false && !(whole(s.cast) && Number(s.cast) <= 6)) errs.push(`${where}: lockup cast must be a whole number 0–6 (the mascots round the lockup) or false (got ${JSON.stringify(s.cast)})`);
        onOff('backdrop', 'false = the plain brand background instead of the light gradient');
      }
      if (s.block === 'agent') {
        list('rows', '[{avatar: 0, name: Scout, status: Scouting, reply: "…"}]'); list('steps', '[Mapped the market, Drafted the script]');
        if (s.frame != null && s.frame !== 'window') errs.push(`${where}: agent frame must be window (or left out) (got ${JSON.stringify(s.frame)})`);
        if (s.scroll != null && !['auto', 'always'].includes(String(s.scroll))) errs.push(`${where}: agent scroll must be auto or always (got ${JSON.stringify(s.scroll)})`);
        if (s.dolly != null && typeof s.dolly !== 'boolean') errs.push(`${where}: agent dolly must be true or false (got ${JSON.stringify(s.dolly)})`);
        if (s.rate != null && !(num(s.rate) && Number(s.rate) > 0)) errs.push(`${where}: agent rate must be words per second > 0 (got ${JSON.stringify(s.rate)})`);
        if (s.header != null && !isMap(s.header)) errs.push(`${where}: agent header must be {name, sub, avatar} (got ${JSON.stringify(s.header)})`);
        if (s.sidebar != null) {
          if (!isMap(s.sidebar)) errs.push(`${where}: agent sidebar must be {title, at, drop} (got ${JSON.stringify(s.sidebar)})`);
          else for (const k of ['at', 'drop']) if (!isAt(s.sidebar[k])) errs.push(`${where}: agent sidebar.${k} must be a local frame (25) or seconds like 0.8s (got ${JSON.stringify(s.sidebar[k])})`);
          if (s.frame !== 'window') warns.push(`${where}: agent sidebar does nothing without frame: window`);
        }
        if (isMap(s.header)) castIdx(s.header.avatar, 'agent header.avatar');
        [].concat(Array.isArray(s.rows) ? s.rows : []).forEach((r, j) => {
          if (!isMap(r)) return;
          castIdx(r.avatar, `agent rows[${j}].avatar`);
          for (const k of ['at', 'statusAt']) if (!atNeg(r[k])) errs.push(`${where}: agent rows[${j}].${k} must be a local frame (20; negative = before the shot) or seconds like 0.7s (got ${JSON.stringify(r[k])})`);
          if (r.think != null && !(num(r.think) && Number(r.think) >= 0)) errs.push(`${where}: agent rows[${j}].think must be frames ≥ 0 (got ${JSON.stringify(r.think)})`);
          if (r.statusLen != null && !(num(r.statusLen) && Number(r.statusLen) > 0)) errs.push(`${where}: agent rows[${j}].statusLen must be frames > 0 (got ${JSON.stringify(r.statusLen)})`);
        });
      }
      if (s.block === 'roster') {
        list('agents', '[{name: Scout, sub: Digs up what\'s working, mascot: 0}]'); for (const a of [].concat(s.agents || [])) if (!(typeof a === 'string' || (isMap(a) && a.name))) errs.push(`${where}: roster agents are names or {name, sub, mascot} (got ${JSON.stringify(a)})`);
        [].concat(Array.isArray(s.agents) ? s.agents : []).forEach((a, j) => { if (isMap(a)) castIdx(a.mascot, `roster agents[${j}].mascot`, false); });
        if (s.beat != null && !(num(s.beat) && Number(s.beat) >= 4)) errs.push(`${where}: roster beat must be frames per step ≥ 4 (got ${JSON.stringify(s.beat)})`);
        if (s.first != null && !(isAt(s.first) && s.first !== '')) errs.push(`${where}: roster first must be the local frame of the first step (38) or seconds like 1.3s (got ${JSON.stringify(s.first)})`);
        if (s.run != null && !(Number.isInteger(Number(s.run)) && Number(s.run) >= 0)) errs.push(`${where}: roster run must be a whole number of rows ≥ 0 (got ${JSON.stringify(s.run)})`);
      }
      if (s.block === 'lockup' && s.partner != null) {
        if (!(typeof s.partner === 'string' || (isMap(s.partner) && s.partner.name))) errs.push(`${where}: lockup partner must be {name: Acme, logo: assets/acme.svg} or a name`);
        else if (isMap(s.partner) && s.partner.logo) { asset(String(s.partner.logo), `${where}.partner.logo`); if (!['.svg', '.png', '.webp'].includes(extname(String(s.partner.logo)).toLowerCase())) errs.push(`${where}: partner.logo must be .svg, .png or .webp`); else decodable(String(s.partner.logo), `${where}.partner.logo`); }
      }
      if (s.block === 'stack') {
        castIdx(s.mascot, 'stack mascot');
        if (!isAt(s.pillAt)) errs.push(`${where}: stack pillAt must be a local frame (60) or seconds like 2s (got ${JSON.stringify(s.pillAt)})`);
      }
      if (s.block === 'scene') {
        list('overlays', '[{at: 10, pos: left, bubble: "Launch is Friday. Help?"}]');
        [].concat(Array.isArray(s.overlays) ? s.overlays : []).forEach((o, j) => {
          const ow = `${where} overlay #${j + 1}`;
          if (!isMap(o)) { errs.push(`${ow} must be a map like {at: 10, pos: left, bubble: "text"} (got ${JSON.stringify(o)})`); return; }
          const kinds = OVERLAY_KINDS.filter(k => Object.hasOwn(o, k));
          if (kinds.length !== 1) errs.push(`${ow} needs exactly one of ${OVERLAY_KINDS.join(', ')} (got ${kinds.length ? kinds.join(' + ') : 'none'})`);
          if (o.pos != null && !(Array.isArray(o.pos) ? o.pos.length === 2 && o.pos.every(v => Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 1) : OVERLAY_POS.includes(String(o.pos))))
            errs.push(`${ow}: pos must be one of ${OVERLAY_POS.join(', ')} or [x, y] fractions of the frame (got ${JSON.stringify(o.pos)})`);
          for (const k of ['at', 'until']) if (!isAt(o[k])) errs.push(`${ow}: ${k} must be a local frame (45) or seconds like 1.5s (got ${JSON.stringify(o[k])})`);
          const fr = v => { const m = String(v ?? 0).trim().match(/^(\d+(?:\.\d+)?)\s*(s|sec)?$/); return m ? Number(m[1]) * (m[2] ? 30 : 1) : null; };
          if (o.until != null && o.until !== '' && isAt(o.until) && isAt(o.at) && !(fr(o.until) > fr(o.at))) errs.push(`${ow}: until (${o.until}) must come after at (${o.at ?? 0}) — it is when the overlay has faded out`);
          for (const k of ['speed', 'every', 'rate', 'size', 'width']) if (o[k] != null && !pos(o[k])) errs.push(`${ow}: ${k} must be a number > 0 (got ${JSON.stringify(o[k])})`);
          if (Object.hasOwn(o, 'pill')) castIdx(o.mascot, `overlay #${j + 1} mascot`);
          if (o.words != null && !Array.isArray(o.words)) errs.push(`${ow}: words must be a list, e.g. [Who?, "By *when?*"]`);
          if (o.theme != null && !['dark', 'light'].includes(String(o.theme))) errs.push(`${ow}: theme must be dark or light`);
          if (o.framing != null && !['inline', 'macro'].includes(String(o.framing))) errs.push(`${ow}: framing must be inline or macro`);
          const onBg = s.bg != null && s.bg !== false && String(s.bg).trim() !== '' && String(s.bg).toLowerCase() !== 'none';
          const shotDark = onBg ? s.theme !== 'light' : s.theme === 'dark';      // the block's own rule: a bar is dark over footage
          if (Object.hasOwn(o, 'bar') && String(o.framing) === 'macro' && (o.theme || (shotDark ? 'dark' : 'light')) === 'dark')
            warns.push(`${ow}: framing: macro is a light bar's close-up — this bar is dark (${o.theme ? 'theme: dark' : onBg ? 'over footage' : 'a theme: dark shot'}), so it renders as the inline dark composer; add theme: light to the overlay for the macro`);
        });
      }
    }
    // universal footage background + letterbox (any block)
    const hasBg = s.bg != null && s.bg !== false && String(s.bg).trim() !== '' && String(s.bg).toLowerCase() !== 'none';
    if (hasBg) {
      if (typeof s.bg !== 'string') errs.push(`${where}: bg must be an image or footage path in assets/ (got ${JSON.stringify(s.bg)})`);
      else { asset(s.bg, `${where}.bg`); decodable(s.bg, `${where}.bg`); playable(s.bg, `${where}.bg`, s.bgFrom ?? ((blk && blk.bgDefaults) || {}).bgFrom, 'bgFrom'); if (!IMAGE_EXT.test(s.bg) && !VIDEO_EXT.test(s.bg)) errs.push(`${where}: bg must be an image (.png/.jpg/.webp/.svg) or footage (.mp4/.mov/.m4v/.webm/.mkv)`); }
    }
    if (s.bgFrom != null && !(Number.isFinite(Number(s.bgFrom)) && Number(s.bgFrom) >= 0)) errs.push(`${where}: bgFrom must be seconds ≥ 0 into the footage (got ${s.bgFrom})`);
    if (s.bgDim != null && !(Number.isFinite(Number(s.bgDim)) && Number(s.bgDim) >= 0 && Number(s.bgDim) <= 1)) errs.push(`${where}: bgDim must be 0–1 (got ${s.bgDim})`);
    if (s.bgMove != null && !BG_MOVES.includes(String(s.bgMove))) errs.push(`${where}: bgMove must be one of ${BG_MOVES.join(', ')}`);
    const bd = blk && blk.bgDefaults;      // a block's own defaults for the universal bg fields (used when the shot leaves one out)
    if (bd != null && (!isMap(bd) || Object.keys(bd).some(k => !['bgDim', 'bgMove', 'bgFrom'].includes(k)) || (bd.bgDim != null && !(Number(bd.bgDim) >= 0 && Number(bd.bgDim) <= 1))
      || (bd.bgMove != null && !BG_MOVES.includes(String(bd.bgMove))) || (bd.bgFrom != null && !(Number(bd.bgFrom) >= 0)))) errs.push(`${where}: block ${s.block}'s bgDefaults must be {bgDim: 0–1, bgMove: ${BG_MOVES.join('|')}, bgFrom: seconds}`);
    if (s.letterbox != null && s.letterbox !== false && s.letterbox !== true && !(Number.isFinite(Number(s.letterbox)) && Number(s.letterbox) >= 1.85 && Number(s.letterbox) <= 3))
      errs.push(`${where}: letterbox must be true (2.39:1), false, or a picture ratio 1.85–3 like 2.39 or 2 (got ${s.letterbox})`);
    // a block's declared footage fields: every path must exist; <field>From = seconds into the footage (a number, or a list for a list field)
    for (const { field } of mediaFields(blk)) {
      const v = s[field], fromV = s[`${field}From`];
      for (const [j, x] of (Array.isArray(v) ? v.map((x, j) => [j, x]) : v != null ? [[null, v]] : [])) {
        if (typeof x !== 'string') { if (x != null) errs.push(`${where}: ${field}${j == null ? '' : `[${j}]`} must be a file path (got ${JSON.stringify(x)})`); continue; }
        asset(x, `${where}.${field}${j == null ? '' : `[${j}]`}`); decodable(x, `${where}.${field}${j == null ? '' : `[${j}]`}`);
        playable(x, `${where}.${field}${j == null ? '' : `[${j}]`}`, Array.isArray(fromV) && j != null ? fromV[j] : fromV, `${field}From`);
        if (!IMAGE_EXT.test(x) && !VIDEO_EXT.test(x)) errs.push(`${where}: ${field}${j == null ? '' : `[${j}]`} must be an image (.png/.jpg/.webp/.svg) or footage (.mp4/.mov/.m4v/.webm/.mkv) (got ${x})`);
      }
      for (const x of [].concat(fromV ?? [])) if (!(Number.isFinite(Number(x)) && Number(x) >= 0)) errs.push(`${where}: ${field}From must be seconds ≥ 0 (got ${JSON.stringify(fromV)})`);
    }
    for (const ic of s.icons || []) { asset(ic, `${where}.icons`); decodable(String(ic), `${where}.icons`); }
  });
  const cutdowns = mapOr(raw.cutdowns, 'cutdowns', '{10s: [s1, s3, s7]} (a name, then its shots)');
  for (const [name, list] of Object.entries(cutdowns)) {
    if (!/^[\w-]+$/.test(name) || name === 'main') errs.push(`cutdowns: name "${name}" must be letters, digits, - or _ (and not "main")`);
    const ids2 = [].concat(list ?? []).map(String);
    if (!ids2.length) errs.push(`cutdowns.${name}: list at least one shot`);
    if (new Set(ids2).size !== ids2.length) errs.push(`cutdowns.${name}: a shot can appear only once (repeat it with a second shot id)`);
    for (const id of [].concat(list)) if (!ids.has(String(id))) errs.push(`cutdowns.${name}: unknown shot id ${id}`);
  }
  for (const name of Object.keys(vo ? vo.cutdowns : {})) if (!Object.hasOwn(cutdowns, name)) errs.push(`voiceover.cutdowns.${name}: no cutdown called "${name}"`);
  if (music.drop != null && !ids.has(music.drop)) errs.push(`music.drop: unknown shot id ${music.drop}`);
  for (const id of music.breaks) if (!ids.has(id)) errs.push(`music.breaks: unknown shot id ${id}`);
  const thumbnail = raw.thumbnail != null ? String(raw.thumbnail) : null;
  if (thumbnail != null && !ids.has(thumbnail)) errs.push(`thumbnail: unknown shot id ${thumbnail}`);
  if (errs.length) throw new Error('beats.yaml has problems:\n  - ' + errs.join('\n  - '));
  return { title: raw.title || brand.name, slug: slugify(raw.slug || raw.title || brand.name), brand, music, vo, aspects, shots, cutdowns, blocks, warns, thumbnail, footage };
}
