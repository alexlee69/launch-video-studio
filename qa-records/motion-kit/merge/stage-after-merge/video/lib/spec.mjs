// Load + validate a job's beats.yaml into a normalised spec. Errors throw (with every problem listed); soft issues
// come back as warnings for the grid printout.
import { readFileSync, existsSync, readdirSync, openSync, readSync, closeSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { VIDEO, ASPECTS, slugify } from './common.mjs';
import { BLOCKS } from '../engine/blocks/index.js';
import { normItems } from '../engine/ui.js';
import { ICON_NAMES } from '../engine/art.js';
import { originOf } from '../engine/kit.js';

export const TRANSITIONS = ['cut', 'whip-left', 'whip-right', 'whip-up', 'whip-down', 'zoom-in', 'zoom-out', 'blur', 'glitch', 'smear-left', 'smear-right', 'tunnel', 'flash',
  'drift-left', 'drift-right', 'drift-up', 'drift-down', 'dive', 'flood'];
export const BG_MOVES = ['in', 'out', 'left', 'right', 'none'];
export const DELIVERY = ['web', 'feed', 'tv'];
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|svg)$/i, VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv)$/i;
// a block's footage-capable fields: `media: ['card', 'cards', {field: 'shot', fit: 'contain'}]` (string fields hold one
// path, list fields several); fit = cover (default: cover-cropped to the stage) | contain (whole, inside the stage);
// scale = plate size as a share of the stage (default 1; e.g. .35 for small cards — 1/8 the pixels to extract and decode)
export function mediaFields(block) {
  return [].concat((block && block.media) || []).map(m => typeof m === 'string' ? { field: m, fit: 'cover', scale: 1 }
    : m && typeof m === 'object' && m.field ? { field: String(m.field), fit: m.fit === 'contain' ? 'contain' : 'cover', scale: Number(m.scale) > 0 && Number(m.scale) <= 1 ? Number(m.scale) : 1 } : null).filter(Boolean);
}
export const STYLES = ['playful', 'keynote', 'calm', 'film', 'none', 'track'];
export const KEYS = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const HEX = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_COLORS = { bg: '#F6F6F7', ink: '#111114', muted: '#7C7C86', accent: '#4C8DF6', accent2: '#2FC2A3', accent3: '#FFC53D', dark: '#0E0E12', line: '#C3C8D4', card: '#FFFFFF' };
const lighten = (hex, k) => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) + (255 - parseInt(hex.slice(i, i + 2), 16)) * k).toString(16).padStart(2, '0')).join('').toUpperCase();
// fields a block can't do without (custom blocks may declare their own `required`)
const REQUIRED = { headline: ['text'], stat: ['value'], media: ['src'], prompt: ['prompt'], phone: ['items'], browser: ['items'], panel: ['items'] };
const STYLE_BPM = { playful: 120, keynote: 124, calm: 96, film: 87 };
const RESERVED = ['i', 'f0', 'f1', 'D', 'Db', 'start', 'end', 'heroF', 'cues', 'copy', 'copyRead'];   // fields the timeline adds to shots
// the reel and film blocks' fixed choices (checked for the built-in blocks; a job's own block of the same name is its own)
const ENUMS = {
  sticker: { style: ['outline', 'plate', 'pill'], pos: ['center', 'top', 'bottom'] },
  split: { mode: ['side', 'wipe'] },
  float: { device: ['card', 'phone'] },      // float's from: left | right (its fly-in side) or an origin — checked with the round-2 fields
  type: { face: ['sans', 'serif', 'brand'], faces: ['alternate', 'sans', 'serif'] },
  stack: { chrome: ['post', 'none'], mode: ['cycle', 'exploded'], tilt: ['iso', 'low'] },
  wall: { chrome: ['ugc', 'none'], drift: ['up', 'down', 'left', 'right'], layout: ['float', 'grid'] },
  // motion kit (round 1)
  press: { control: ['button', 'key', 'toggle', 'send'] },
  particles: { mode: ['sphere', 'burst', 'grid', 'terrain'] },
};
const OVERLAY_KINDS = ['bar', 'bubble', 'words', 'pill', 'orb'], OVERLAY_POS = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];
// an image file's bytes must be an image Chrome can decode (a failed download saved as .jpg is an HTML page; an iPhone
// photo renamed .jpg is HEIC): returns null when fine, else what's wrong. Raster formats are sniffed by content (any
// raster extension works); SVG must be named .svg (it is served as image/svg+xml)
export function imageProblem(file) {
  let buf;
  try { if (!statSync(file).isFile()) return null; const fd = openSync(file, 'r'); buf = Buffer.alloc(4096); const n = readSync(fd, buf, 0, 4096, 0); closeSync(fd); buf = buf.subarray(0, n); } catch { return null; }
  const at = (i, str) => buf.subarray(i, i + str.length).toString('latin1') === str, head = buf.toString('utf8').replace(/^\uFEFF/, '').trimStart().toLowerCase();
  const svgName = /\.svg$/i.test(file);
  if (!buf.length) return 'is empty';
  if (buf[0] === 0x89 && at(1, 'PNG') || buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF || at(0, 'GIF8') || at(0, 'RIFF') && at(8, 'WEBP')) return svgName ? 'is a raster image named .svg — give it its real extension (.png/.jpg/.webp)' : null;
  if (at(4, 'ftyp')) { const brand = buf.subarray(8, 12).toString('latin1'); return /^avi[fs]$/.test(brand) ? null : /^(hei[cxms]|hev[cx]|mif1|msf1)$/.test(brand) ? 'is a HEIC/HEIF photo — export it as JPEG or PNG' : `is a video/ISO file (${brand}), not an image`; }
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) return 'is an HTML page, not an image (a failed download?)';
  if (/<svg[\s>]/.test(head) && (head.startsWith('<svg') || head.startsWith('<?xml') || head.startsWith('<!--') || head.startsWith('<!doctype svg'))) return svgName ? null : 'is an SVG — name it .svg';
  return 'is not a PNG, JPEG, WebP, GIF, AVIF or SVG image';
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
  const mapOr = (v, what, eg) => { if (v == null) return {}; if (isMap(v)) return v; errs.push(`${what} must be a map${eg ? `, e.g. ${eg}` : ''} (got ${JSON.stringify(v)})`); return {}; };
  const b = mapOr(raw.brand, 'brand', '{name: Acme, colors: {accent: "#4C8DF6"}}');
  const colors = { ...DEFAULT_COLORS, ...mapOr(b.colors, 'brand.colors', '{accent: "#4C8DF6"}') };
  for (const [k, v] of Object.entries(colors)) if (!HEX.test(v)) errs.push(`brand.colors.${k} must be a #RRGGBB hex (got ${v})`);
  if (!colors.accentOnDark && HEX.test(colors.accent)) colors.accentOnDark = lighten(colors.accent, .45);   // dark shots: the brand accent, lifted
  const asset = (p, what) => { if (p && !existsSync(join(job, p))) errs.push(`${what}: file not found: ${p}`); return p; };
  // an existing image file that can't be an image: one clear line at --grid instead of a broken frame or a stage error
  const decodable = (p, what) => { if (p && IMAGE_EXT.test(p) && existsSync(join(job, p))) { const bad = imageProblem(join(job, p)); if (bad) errs.push(`${what}: ${p} ${bad}`); } };
  if (b.logo) { asset(b.logo, 'brand.logo'); if (!['.svg', '.png', '.webp'].includes(extname(b.logo).toLowerCase())) errs.push('brand.logo must be .svg, .png or .webp'); else decodable(b.logo, 'brand.logo'); }
  if (b.font != null && !(isMap(b.font) && b.font.family && isMap(b.font.files))) errs.push('brand.font must be {family: Name, files: {400: assets/x.woff2, 700: assets/y.woff2}}');
  else if (b.font) for (const [w, f] of Object.entries(b.font.files)) asset(f, `brand.font.files.${w}`);
  if (b.cast != null && !Array.isArray(b.cast)) errs.push('brand.cast must be a list, e.g. [{src: assets/hero.svg}, {shape: blob, col: "#FF8A4C"}]');
  for (const c of Array.isArray(b.cast) ? b.cast : []) { if (!isMap(c)) errs.push(`brand.cast: each entry is a map like {src: assets/x.svg} (got ${JSON.stringify(c)})`); else if (c.src) asset(c.src, 'brand.cast'); }
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
  // delivery: where the film is watched — sets the readable-text floors QA warns at (web = landscape / full-screen,
  // feed = a 16:9 film watched small in a phone feed, tv = a big screen)
  const delivery = raw.delivery == null ? 'web' : String(raw.delivery);
  if (!DELIVERY.includes(delivery)) errs.push(`delivery must be one of ${DELIVERY.join(', ')} (got ${JSON.stringify(raw.delivery)})`);
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
    // stack: cards are required by its default cycle mode (mode: exploded draws its own planes without them)
    if (s.block === 'stack' && blk === BLOCKS.stack && s.mode !== 'exploded' && (s.cards == null || s.cards === '' || (Array.isArray(s.cards) && !s.cards.length))) errs.push(`${where}: stack needs \`cards\``);
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
          if (it.type === 'image') asset(it.src, `${where} image item`);
          if (['card', 'row', 'notif'].includes(it.type) && it.icon && /[./]/.test(String(it.icon)) && it.icon !== 'logo') asset(String(it.icon), `${where} ${it.type} icon`);
        });
      } catch (e) { errs.push(`${where}: ${e.message}`); }
    }
    if (s.block === 'orbit' && s.items != null) {
      if (!Array.isArray(s.items) && typeof s.items !== 'string') errs.push(`${where}: orbit items must be a list of names or {icon, label} maps`);
      for (const it of [].concat(s.items)) {
        if (typeof it === 'string') { if (/[./]/.test(it)) asset(it, `${where} orbit icon`); }
        else if (!isMap(it)) errs.push(`${where}: orbit item ${JSON.stringify(it)} must be a name (mail, chat …) or {icon, label}`);
        else if (it.icon && !ICON_NAMES.includes(it.icon)) asset(String(it.icon), `${where} orbit icon`);
      }
    }
    for (const k of RESERVED) if (k in s) errs.push(`${where}: "${k}" is reserved by the timeline — rename that field`);
    if (s.block === 'type' && blk === BLOCKS.type && (s.text == null || String(s.text).trim() === '') && !(Array.isArray(s.words) && s.words.length)) errs.push(`${where}: type needs \`text\` (a name) or \`words\` (a list of word beats)`);
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
    for (const [k, v] of each('move')) if (v != null && !pair(v, -1, 1)) errs.push(`${where}: ${k} must be [x, y], a constant drift in fractions of the frame per second (e.g. [0, -0.04]) (got ${JSON.stringify(v)})`);
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
      if (!isMap(s.drift) || Object.keys(s.drift).some(k => !['in', 'out'].includes(k))) errs.push(`${where}: drift must be {in: N, out: N} — strengths of the shot's drift entrance / drift exit (1 = default) (got ${JSON.stringify(s.drift)})`);
      else for (const k of ['in', 'out']) if (s.drift[k] != null && !(num(s.drift[k]) && Number(s.drift[k]) >= 0 && Number(s.drift[k]) <= 10)) errs.push(`${where}: drift.${k} must be a number 0–10 (got ${JSON.stringify(s.drift[k])})`);
    }
    if (s.block === 'media' && s.src) { asset(s.src, `${where}.src`); decodable(String(s.src), `${where}.src`); }
    // the reel / film blocks: fixed choices, list fields, scene overlays, the lockup's partner logo
    if (blk && blk === BLOCKS[s.block]) {
      for (const [k, opts] of Object.entries(ENUMS[s.block] || {})) if (s[k] != null && !(k === 'drift' && isMap(s[k])) && !opts.includes(String(s[k]))) errs.push(`${where}: ${s.block} ${k} must be one of ${opts.join(', ')} (got ${JSON.stringify(s[k])})`);
      const list = (k, eg) => { if (s[k] != null && !Array.isArray(s[k])) errs.push(`${where}: ${s.block} ${k} must be a list, e.g. ${eg}`); };
      if (s.block === 'split') { list('labels', '[Before, After]'); if (Array.isArray(s.labels) && s.labels.length > 2) errs.push(`${where}: split labels takes up to two chip labels (got ${s.labels.length})`); }
      if (s.block === 'stack' || s.block === 'wall') list('cards', '[assets/a.mp4, assets/b.jpg]');
      if (s.block === 'wall') list('chips', '[Hook in 1s, Captions]');
      if (s.block === 'stack' && s.mode !== 'exploded' && s.count != null && !(Number.isInteger(Number(s.count)) && Number(s.count) >= 2 && Number(s.count) <= 14)) errs.push(`${where}: stack count must be a whole number 2–14 (got ${s.count})`);
      // ── motion kit (round 1): press · fan · particles · map, wall layout: grid, type words, stack mode: exploded
      const str = (k, eg) => { if (s[k] != null && (typeof s[k] === 'object')) errs.push(`${where}: ${s.block} ${k} must be text, e.g. ${eg} (got ${JSON.stringify(s[k])})`); };
      const frac = v => Array.isArray(v) && v.length === 2 && v.every(x => num(x) && Number(x) >= 0 && Number(x) <= 1);
      if (s.block === 'stack' && s.mode === 'exploded') {
        list('labels', '[Content, Media, Layout]'); str('text', '"Built in *layers.*"');
        if (s.count != null && !(Number.isInteger(Number(s.count)) && Number(s.count) >= 3 && Number(s.count) <= 5)) errs.push(`${where}: stack count must be 3–5 planes in mode: exploded (got ${s.count})`);
      } else if (s.block === 'stack' && (s.tilt != null || s.labels != null)) warns.push(`${where}: stack ${s.tilt != null ? 'tilt' : 'labels'} only works with mode: exploded`);
      if (s.block === 'press') {
        for (const [k, eg] of [['label', 'Generate'], ['text', '"One click."'], ['after', '"Generating…"'], ['icon', 'sparkle']]) str(k, eg);
        if (s.icon != null && typeof s.icon !== 'object' && !ICON_NAMES.includes(String(s.icon))) errs.push(`${where}: press icon must be a built-in icon: ${ICON_NAMES.join(', ')} (got ${JSON.stringify(s.icon)})`);
        if (!isAt(s.at)) errs.push(`${where}: press at must be the local frame of the press (52) or seconds like 1.7s (got ${JSON.stringify(s.at)})`);
      }
      if (s.block === 'fan') {
        list('cards', '[assets/a.mp4, assets/b.jpg, assets/c.jpg]'); list('labels', '[Clips, Stills, Captions]'); str('text', '"One prompt. *Every format.*"');
        if (Array.isArray(s.labels)) s.labels.forEach((x, j) => { if (x != null && typeof x === 'object') errs.push(`${where}: fan labels[${j}] must be text, e.g. Clips (got ${JSON.stringify(x)})`); });
        if (s.count != null && !(Number.isInteger(Number(s.count)) && Number(s.count) >= 3 && Number(s.count) <= 9 && Number(s.count) % 2 === 1)) errs.push(`${where}: fan count must be odd: 3, 5, 7 or 9 (got ${JSON.stringify(s.count)})`);
        const nc = Array.isArray(s.cards) ? s.cards.length : 0;
        if (s.pick != null && !(Number.isInteger(Number(s.pick)) && Number(s.pick) >= 0 && (!nc || Number(s.pick) < nc))) errs.push(`${where}: fan pick must be a card index 0–${Math.max(0, nc - 1)} (got ${JSON.stringify(s.pick)})`);
      }
      if (s.block === 'particles') {
        str('text', '"Built for *scale.*"');
        if (s.count != null && !(Number.isInteger(Number(s.count)) && Number(s.count) >= 100 && Number(s.count) <= 4000)) errs.push(`${where}: particles count must be a whole number 100–4000 (got ${JSON.stringify(s.count)})`);
        if (s.spacing != null && !(num(s.spacing) && Number(s.spacing) >= 14 && Number(s.spacing) <= 200)) errs.push(`${where}: particles spacing must be px 14–200 (got ${JSON.stringify(s.spacing)})`);
        if (s.color != null && !HEX.test(String(s.color))) errs.push(`${where}: particles color must be a #RRGGBB hex (got ${JSON.stringify(s.color)})`);
        if (s.orbits != null && typeof s.orbits !== 'boolean') errs.push(`${where}: particles orbits must be true or false (got ${JSON.stringify(s.orbits)})`);
        if (!isAt(s.burstAt)) errs.push(`${where}: particles burstAt must be a local frame (60) or seconds like 2s (got ${JSON.stringify(s.burstAt)})`);
        const pm = s.mode || 'sphere';
        if (s.count != null && (pm === 'grid' || pm === 'terrain')) warns.push(`${where}: particles count does nothing in mode ${pm} — its density comes from spacing`);
        else if (s.count != null && Number(s.count) > 2000) warns.push(`${where}: particles count ${s.count} — above ~2000 dots the field reads no denser and only paints slower; 900–2000 is the useful range`);
        if (s.spacing != null && (pm === 'sphere' || pm === 'burst')) warns.push(`${where}: particles spacing does nothing in mode ${pm} — use count`);
        else if (s.spacing != null && Number(s.spacing) < 20) warns.push(`${where}: particles spacing ${s.spacing} draws ~${Math.round(1920 * 1080 / (Number(s.spacing) ** 2) / 1000)}k dots a frame on 16:9 — slow to render; 24–40 reads as a field`);
      }
      if (s.block === 'map') {
        str('text', '"Every stop, *on time.*"');
        if (s.stops != null) {
          if (!Array.isArray(s.stops) || s.stops.length < 2 || s.stops.length > 6) errs.push(`${where}: map stops must be a list of 2–6 stops like [{pos: [0.2, 0.7], label: Pickup}, {pos: [0.8, 0.4], label: Studio}] (got ${Array.isArray(s.stops) ? `${s.stops.length} stops` : JSON.stringify(s.stops)})`);
          else s.stops.forEach((st, j) => {
            if (!isMap(st)) errs.push(`${where}: map stops[${j}] must be {pos: [x, y], label: Name} (got ${JSON.stringify(st)})`);
            else { if (!frac(st.pos)) errs.push(`${where}: map stops[${j}].pos must be [x, y], fractions 0–1 of the frame (got ${JSON.stringify(st.pos)})`); if (st.label != null && typeof st.label === 'object') errs.push(`${where}: map stops[${j}].label must be text (got ${JSON.stringify(st.label)})`); }
          });
        }
      }
      if (s.block === 'wall') {
        for (const k of ['cols', 'rows']) if (s[k] != null && !(Number.isInteger(Number(s[k])) && Number(s[k]) >= 1 && Number(s[k]) <= 12)) errs.push(`${where}: wall ${k} must be a whole number 1–12 (got ${JSON.stringify(s[k])})`);
        if (s.pick != null && !(Array.isArray(s.pick) ? s.pick.length === 2 && s.pick.every(x => Number.isInteger(Number(x)) && Number(x) >= 0) : Number.isInteger(Number(s.pick)) && Number(s.pick) >= 0)) errs.push(`${where}: wall pick must be [col, row] (from 0) or a tile index (got ${JSON.stringify(s.pick)})`);
        if (s.layout !== 'grid' && ['cols', 'rows', 'pick'].some(k => s[k] != null)) warns.push(`${where}: wall ${['cols', 'rows', 'pick'].filter(k => s[k] != null).join(', ')} only work with layout: grid`);
      }
      if (s.block === 'type' && s.words != null) {
        if (!Array.isArray(s.words) || !s.words.length) errs.push(`${where}: type words must be a list of word beats, e.g. [Generate., chaos., loud., Animate.] (got ${JSON.stringify(s.words)})`);
        else s.words.forEach((w, j) => { if (w == null || typeof w === 'object' || String(w).trim() === '') errs.push(`${where}: type words[${j}] must be a word (got ${JSON.stringify(w)})`); });
        if (!(isAt(s.every) && (s.every == null || s.every === '' || Number(String(s.every).replace(/s(ec)?$/, '')) > 0))) errs.push(`${where}: type every must be frames per word (24) or seconds like 0.8s (got ${JSON.stringify(s.every)})`);
      }
      if (s.block === 'type' && s.words == null && (s.faces != null || s.every != null)) warns.push(`${where}: type ${s.faces != null ? 'faces' : 'every'} only works with words`);
      const atNeg = v => v == null || v === '' || /^-?\d+(?:\.\d+)?\s*(s|sec)?$/.test(String(v).trim());     // frames, seconds, or negative (already there)
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
        [].concat(Array.isArray(s.rows) ? s.rows : []).forEach((r, j) => {
          if (!isMap(r)) return;
          for (const k of ['at', 'statusAt']) if (!atNeg(r[k])) errs.push(`${where}: agent rows[${j}].${k} must be a local frame (20; negative = before the shot) or seconds like 0.7s (got ${JSON.stringify(r[k])})`);
          if (r.think != null && !(num(r.think) && Number(r.think) >= 0)) errs.push(`${where}: agent rows[${j}].think must be frames ≥ 0 (got ${JSON.stringify(r.think)})`);
          if (r.statusLen != null && !(num(r.statusLen) && Number(r.statusLen) > 0)) errs.push(`${where}: agent rows[${j}].statusLen must be frames > 0 (got ${JSON.stringify(r.statusLen)})`);
        });
      }
      if (s.block === 'roster') {
        list('agents', '[{name: Scout, sub: Digs up what\'s working, mascot: 0}]'); for (const a of [].concat(s.agents || [])) if (!(typeof a === 'string' || (isMap(a) && a.name))) errs.push(`${where}: roster agents are names or {name, sub, mascot} (got ${JSON.stringify(a)})`);
        if (s.beat != null && !(num(s.beat) && Number(s.beat) >= 4)) errs.push(`${where}: roster beat must be frames per step ≥ 4 (got ${JSON.stringify(s.beat)})`);
        if (s.first != null && !(isAt(s.first) && s.first !== '')) errs.push(`${where}: roster first must be the local frame of the first step (38) or seconds like 1.3s (got ${JSON.stringify(s.first)})`);
        if (s.run != null && !(Number.isInteger(Number(s.run)) && Number(s.run) >= 0)) errs.push(`${where}: roster run must be a whole number of rows ≥ 0 (got ${JSON.stringify(s.run)})`);
      }
      if (s.block === 'lockup' && s.partner != null) {
        if (!(typeof s.partner === 'string' || (isMap(s.partner) && s.partner.name))) errs.push(`${where}: lockup partner must be {name: Acme, logo: assets/acme.svg} or a name`);
        else if (isMap(s.partner) && s.partner.logo) { asset(String(s.partner.logo), `${where}.partner.logo`); if (!['.svg', '.png', '.webp'].includes(extname(String(s.partner.logo)).toLowerCase())) errs.push(`${where}: partner.logo must be .svg, .png or .webp`); else decodable(String(s.partner.logo), `${where}.partner.logo`); }
      }
      if (s.block === 'stack' && s.mascot != null && !['logo', 'spark'].includes(String(s.mascot)) && !Number.isInteger(Number(s.mascot))) errs.push(`${where}: stack mascot is a cast index, logo or spark`);
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
      else { asset(s.bg, `${where}.bg`); decodable(s.bg, `${where}.bg`); if (!IMAGE_EXT.test(s.bg) && !VIDEO_EXT.test(s.bg)) errs.push(`${where}: bg must be an image (.png/.jpg/.webp/.svg) or footage (.mp4/.mov/.m4v/.webm/.mkv)`); }
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
        if (!IMAGE_EXT.test(x) && !VIDEO_EXT.test(x)) errs.push(`${where}: ${field}${j == null ? '' : `[${j}]`} must be an image (.png/.jpg/.webp/.svg) or footage (.mp4/.mov/.m4v/.webm/.mkv) (got ${x})`);
      }
      for (const x of [].concat(fromV ?? [])) if (!(Number.isFinite(Number(x)) && Number(x) >= 0)) errs.push(`${where}: ${field}From must be seconds ≥ 0 (got ${JSON.stringify(fromV)})`);
    }
    for (const ic of s.icons || []) asset(ic, `${where}.icons`);
    crossCut(s, where, blk, { errs, warns, isMap });
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
  { const L = shots[shots.length - 1]; if (music.style === 'film' && music.hit != null && L && L.block !== 'endcard') warns.push(`music.hit does nothing here: the film's last shot (${L.id}) is a ${L.block}, not an endcard — end on an endcard shot`); }   // film hit: the end card must be the last shot
  // signature: the one transition a film may repeat beyond the lint's two types (round 2; cut, drift-* never count)
  const signature = raw.signature != null ? String(raw.signature) : null;
  if (signature != null && (typeof raw.signature !== 'string' || !SIGNATURES.includes(signature))) errs.push(`signature must be one of ${SIGNATURES.join(', ')} (got ${JSON.stringify(raw.signature)}) — the transition the film repeats as its signature`);
  const thumbnail = raw.thumbnail != null ? String(raw.thumbnail) : null;
  if (thumbnail != null && !ids.has(thumbnail)) errs.push(`thumbnail: unknown shot id ${thumbnail}`);
  if (errs.length) throw new Error('beats.yaml has problems:\n  - ' + errs.join('\n  - '));
  return { title: raw.title || brand.name, slug: slugify(raw.slug || raw.title || brand.name), brand, music, vo, aspects, delivery, shots, cutdowns, blocks, warns, thumbnail, ...(signature ? { signature } : {}) };
}

// ── round 2: cross-cut continuity fields (any shot; all opt-in) ──
//   carry: {el, to, ease: smooth|needle, pre, post, lift, arc, mode: carry|morph, color}  (on the outgoing shot)
//   dive: {el | at: [x, y], zoom, from}  (with out: dive) · flood: {from: layer | [x, y], color}  (with out: flood)
//   from: <layer of the previous shot> | [x, y]  (on the incoming shot, for blocks that grow from a point: origin: true)
//   cause: "the cursor clicks Generate" (storyboard only) · top-level signature: <transition>
const LAYER_NAME = /^[a-z0-9][a-z0-9-]{0,39}$/, ENGINE_LAYERS = ['footage', 'transition', 'letterbox', 'carry', 'content'];
export const TRANSITION_FAMILY = o => /^(whip|smear|drift|zoom)-/.test(String(o)) ? String(o).replace(/-.*$/, '') : String(o);
export const SIGNATURES = [...new Set(TRANSITIONS.filter(t => t !== 'cut' && !/^drift-/.test(t)).flatMap(t => [t, TRANSITION_FAMILY(t)])), 'carry', 'morph'];
const CARRY_KEYS = ['el', 'to', 'ease', 'pre', 'post', 'lift', 'arc', 'mode', 'color'];
function crossCut(s, where, blk, { errs, warns, isMap }) {
  const num = (v, lo, hi) => v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) >= lo && Number(v) <= hi;
  const pt = v => Array.isArray(v) && v.length === 2 && v.every(x => num(x, 0, 1));
  const layer = (v, what) => { if (!(typeof v === 'string' && LAYER_NAME.test(v))) { errs.push(`${where}: ${what} must be a layer name the block tags (lower-case letters, digits, -; the names --blocks lists, e.g. prompt-box) (got ${JSON.stringify(v)})`); return false; } if (ENGINE_LAYERS.includes(v)) { errs.push(`${where}: ${what} "${v}" is the engine's own layer — name one of the block's elements`); return false; } return true; };
  if (s.carry != null) {
    const c = s.carry;
    if (!isMap(c)) errs.push(`${where}: carry must be a map like {el: prompt-box, to: panel} (got ${JSON.stringify(c)})`);
    else {
      const bad = Object.keys(c).filter(k => !CARRY_KEYS.includes(k));
      if (bad.length) errs.push(`${where}: carry takes ${CARRY_KEYS.join(', ')} (unknown: ${bad.join(', ')})`);
      if (c.el == null) errs.push(`${where}: carry needs el: — the layer name of the element that crosses the cut (e.g. {el: prompt-box})`); else layer(c.el, 'carry.el');
      if (c.mode != null && !['carry', 'morph'].includes(String(c.mode))) errs.push(`${where}: carry.mode must be carry (default: the element itself travels) or morph (its box becomes the next element's box) (got ${JSON.stringify(c.mode)})`);
      const morph = String(c.mode) === 'morph';
      if (c.to != null && !(morph && c.to === 'frame')) layer(c.to, 'carry.to');
      if (c.to === 'frame' && !morph) errs.push(`${where}: carry.to: frame needs mode: morph (the box fills the frame into the next shot)`);
      if (c.ease != null && !['smooth', 'needle'].includes(String(c.ease))) errs.push(`${where}: carry.ease must be smooth (default) or needle (got ${JSON.stringify(c.ease)})`);
      if (c.ease != null && morph) warns.push(`${where}: carry.ease does nothing with mode: morph (a morph always runs on its cusp curve)`);
      for (const k of ['pre', 'post']) if (c[k] != null && !num(c[k], k === 'post' && c.to === 'frame' ? 0 : 1, 60)) errs.push(`${where}: carry.${k} must be frames ${k === 'post' && c.to === 'frame' ? 0 : 1}–60 (got ${JSON.stringify(c[k])})`);
      if (c.lift != null && !num(c.lift, 1, 1.5)) errs.push(`${where}: carry.lift must be 1–1.5 (the lift in scale while it travels; 1 = none) (got ${JSON.stringify(c.lift)})`);
      if (c.arc != null && !num(c.arc, -.5, .5)) errs.push(`${where}: carry.arc must be −0.5…0.5 (the bow of its path as a share of the distance) (got ${JSON.stringify(c.arc)})`);
      if (c.color != null && !/^#[0-9a-fA-F]{6}$/.test(String(c.color))) errs.push(`${where}: carry.color must be a #RRGGBB hex (got ${JSON.stringify(c.color)})`);
      if (c.color != null && c.to !== 'frame') warns.push(`${where}: carry.color does nothing unless the morph goes to: frame`);
    }
  }
  if (s.dive != null) {
    const d = s.dive;
    if (!isMap(d)) errs.push(`${where}: dive must be a map like {el: card, zoom: 8} or {at: [0.62, 0.4]} (got ${JSON.stringify(d)})`);
    else {
      const bad = Object.keys(d).filter(k => !['el', 'at', 'zoom', 'from'].includes(k));
      if (bad.length) errs.push(`${where}: dive takes el, at, zoom, from (unknown: ${bad.join(', ')})`);
      if (d.el != null && d.at != null) errs.push(`${where}: dive takes el (a layer to fly into) OR at ([x, y] fractions of the frame), not both`);
      if (d.el != null) layer(d.el, 'dive.el');
      if (d.at != null && !pt(d.at)) errs.push(`${where}: dive.at must be [x, y], fractions 0–1 of the frame (got ${JSON.stringify(d.at)})`);
      if (d.zoom != null && !num(d.zoom, 1.5, 16)) errs.push(`${where}: dive.zoom must be 1.5–16 (how far the camera flies in; default 8) (got ${JSON.stringify(d.zoom)})`);
      if (d.from != null && !num(d.from, .1, .9)) errs.push(`${where}: dive.from must be 0.1–0.9 (the next shot's starting scale; default 0.3) (got ${JSON.stringify(d.from)})`);
    }
    if (s.out !== 'dive') warns.push(`${where}: dive does nothing without out: dive`);
  }
  if (s.flood != null) {
    const d = s.flood;
    if (!isMap(d)) errs.push(`${where}: flood must be a map like {from: prompt-box, color: "#0E0E12"} (got ${JSON.stringify(d)})`);
    else {
      const bad = Object.keys(d).filter(k => !['from', 'spot', 'color'].includes(k));
      if (bad.length) errs.push(`${where}: flood takes from, spot, color (unknown: ${bad.join(', ')})`);
      if (d.from != null && !Array.isArray(d.from)) layer(d.from, 'flood.from');
      else if (d.from != null && !pt(d.from)) errs.push(`${where}: flood.from must be a layer name or [x, y] fractions 0–1 of the frame (got ${JSON.stringify(d.from)})`);
      if (d.spot != null && !pt(d.spot)) errs.push(`${where}: flood.spot must be [x, y], fractions 0–1 of the from element's box (e.g. [0.93, 0.78] for a Send button at its bottom right) (got ${JSON.stringify(d.spot)})`);
      if (d.spot != null && (d.from == null || Array.isArray(d.from))) warns.push(`${where}: flood.spot does nothing without a layer in flood.from (it is a point inside that element)`);
      if (d.color != null && !/^#[0-9a-fA-F]{6}$/.test(String(d.color))) errs.push(`${where}: flood.color must be a #RRGGBB hex (got ${JSON.stringify(d.color)})`);
    }
    if (s.out !== 'flood') warns.push(`${where}: flood does nothing without out: flood`);
  }
  const o = originOf(s, blk);
  // float's from: is also its fly-in side: say so in every message (a typo of left / right must not pass as a layer name)
  if (o != null && s.block === 'float' && !Array.isArray(o) && !(typeof o === 'string' && LAYER_NAME.test(o))) errs.push(`${where}: float from must be left | right (the side it flies in from), a layer of the previous shot, or [x, y] (got ${JSON.stringify(o)})`);
  else if (o != null) { if (Array.isArray(o)) { if (!pt(o)) errs.push(`${where}: from must be [x, y] fractions 0–1 of the frame, or a layer name of the previous shot (got ${JSON.stringify(o)})`); } else layer(o, 'from'); }
  else if (s.from != null && blk && blk === BLOCKS[s.block] && !blk.origin && (Array.isArray(s.from) || (typeof s.from === 'string' && LAYER_NAME.test(s.from) && !Number.isFinite(Number(s.from)))) && !['media', 'stat'].includes(s.block))
    warns.push(`${where}: from: does nothing on ${s.block} — growing from a point works on float, stack and wall`);
  if (s.cause != null && (typeof s.cause !== 'string' || !s.cause.trim())) errs.push(`${where}: cause must be text — the on-screen reason for the transition, e.g. "the cursor clicks Generate"${typeof s.cause === 'string' ? ' (it is blank)' : ''}`);
}
