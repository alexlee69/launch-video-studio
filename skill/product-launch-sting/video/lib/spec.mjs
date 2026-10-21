// Load + validate a job's beats.yaml into a normalised spec. Errors throw (with every problem listed); soft issues
// come back as warnings for the grid printout.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { VIDEO, ASPECTS, slugify } from './common.mjs';
import { BLOCKS } from '../engine/blocks/index.js';
import { normItems } from '../engine/ui.js';
import { ICON_NAMES } from '../engine/art.js';

export const TRANSITIONS = ['cut', 'whip-left', 'whip-right', 'whip-up', 'whip-down', 'zoom-in', 'zoom-out', 'blur'];
export const STYLES = ['playful', 'keynote', 'calm', 'none', 'track'];
export const KEYS = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const HEX = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_COLORS = { bg: '#F6F6F7', ink: '#111114', muted: '#7C7C86', accent: '#4C8DF6', accent2: '#2FC2A3', accent3: '#FFC53D', dark: '#0E0E12', line: '#C3C8D4', card: '#FFFFFF' };
const lighten = (hex, k) => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) + (255 - parseInt(hex.slice(i, i + 2), 16)) * k).toString(16).padStart(2, '0')).join('').toUpperCase();
// fields a block can't do without (custom blocks may declare their own `required`)
const REQUIRED = { headline: ['text'], stat: ['value'], media: ['src'], prompt: ['prompt'], phone: ['items'], browser: ['items'], panel: ['items'] };
const STYLE_BPM = { playful: 120, keynote: 124, calm: 96 };
const RESERVED = ['i', 'f0', 'f1', 'D', 'Db', 'start', 'end', 'heroF', 'cues'];   // fields the timeline adds to every shot

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
  if (b.logo) { asset(b.logo, 'brand.logo'); if (!['.svg', '.png', '.webp'].includes(extname(b.logo).toLowerCase())) errs.push('brand.logo must be .svg, .png or .webp'); }
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
  const music = { style, bpm, key: m.key || { playful: 'F', keynote: 'D', calm: 'G' }[style] || 'C', file: m.file || null, start: Number(m.start || 0),
    downbeat: Number(m.downbeat || 0), drop: m.drop != null ? String(m.drop) : null, breaks: [].concat(m.breaks || []).map(String), level: Number(m.level || 0) };
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
    if (!blocks[s.block]) errs.push(`${where}: unknown block "${s.block}" — built-in: ${Object.keys(BLOCKS).join(', ')}${Object.keys(blocks.__custom).length ? `; custom: ${Object.keys(blocks.__custom).join(', ')}` : ''}`);
    if (s.beats == null && s.sec == null) errs.push(`${where}: give a length as beats: N or sec: S`);
    if (s.beats != null && !(Number(s.beats) > 0)) errs.push(`${where}: beats must be > 0`);
    if (s.sec != null && !(Number(s.sec) > 0)) errs.push(`${where}: sec must be > 0`);
    if (s.out && !TRANSITIONS.includes(s.out)) errs.push(`${where}: out must be one of ${TRANSITIONS.join(', ')}`);
    if (s.hold && !(Array.isArray(s.hold) && s.hold.length === 2 && s.hold.every(x => Number.isFinite(Number(x)) && Number(x) >= 0) && Number(s.hold[1]) > Number(s.hold[0]))) errs.push(`${where}: hold must be [fromFrame, toFrame] in the shot's own 30-fps frames`);
    if (s.theme && !['light', 'dark'].includes(s.theme)) errs.push(`${where}: theme must be light or dark`);
    if (s.block === 'media' && s.src) asset(s.src, `${where}.src`);
    for (const ic of s.icons || []) asset(ic, `${where}.icons`);
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
  return { title: raw.title || brand.name, slug: slugify(raw.slug || raw.title || brand.name), brand, music, vo, aspects, shots, cutdowns, blocks, warns, thumbnail };
}
