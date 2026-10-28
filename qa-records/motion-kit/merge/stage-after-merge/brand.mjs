// Load + validate a job's brand.json, and turn it into the window.BRAND object stage.html reads.
// Every script takes --job DIR; DIR holds brand.json (and the logo / music files it points to) and gets out/.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL = dirname(fileURLToPath(import.meta.url));
export const DUR = 12.075;

export function arg(argv, k, d) {
  const i = argv.indexOf(k);
  return i < 0 ? d : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true);
}
export function jobDir(argv = process.argv.slice(2)) {
  const j = arg(argv, '--job', process.env.JOB);
  if (!j || j === true) { console.error('missing --job DIR (the folder that holds brand.json)'); process.exit(2); }
  return resolve(j);
}

const PALETTE_KEYS = ['page', 'haze', 'ice', 'deep', 'sky', 'navy', 'blue', 'teal', 'mint', 'white'];
const HEX = /^#[0-9a-fA-F]{6}$/;

export function hsl(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return { h: (h + 360) % 360, s, l };
}
// The source prompt's rule: no purple, violet, magenta or orange anywhere in the palette.
export function forbiddenHue(hex) {
  const { h, s, l } = hsl(hex);
  if (s < .22 || l < .1 || l > .94) return null;                    // greys, near-black, near-white carry no hue
  if (h >= 255 && h <= 340) return h < 285 ? 'violet' : h < 315 ? 'purple' : 'magenta';
  if (h >= 16 && h <= 46) return 'orange';
  return null;
}

export function loadBrand(dir, { allowPalette = false } = {}) {
  const file = join(dir, 'brand.json');
  if (!existsSync(file)) throw new Error(`${file} not found — run: node build.mjs --job ${dir} --init`);
  let b;
  try { b = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { throw new Error(`brand.json is not valid JSON: ${e.message}`); }
  const errs = [], warns = [];
  const c = b.copy || {};
  const str = (k, max) => {
    if (typeof c[k] !== 'string' || !c[k].trim()) errs.push(`copy.${k} must be a non-empty string`);
    else if (max && [...c[k]].length > max) warns.push(`copy.${k} is ${[...c[k]].length} chars (aim for ≤ ${max})`);
  };
  str('name', 22); str('pill', 14); if (!b.logoSvgPath || c.mono !== undefined) str('mono', 2); str('prompt', 48); str('pageTitle', 26); str('body2');
  if (typeof c.mono === 'string' && [...c.mono].length > 3) errs.push('copy.mono must be 1–3 characters');
  if (!Array.isArray(c.crumbs) || !c.crumbs.length || c.crumbs.some(x => typeof x !== 'string')) errs.push('copy.crumbs must be an array of strings');
  if (!Array.isArray(c.body)) errs.push('copy.body must be an array like ["text ", {"k": "key phrase"}, " text"]');
  else {
    const keys = c.body.filter(x => x && typeof x === 'object');
    if (keys.length !== 1 || typeof keys[0].k !== 'string' || !keys[0].k.trim()) errs.push('copy.body needs exactly one {"k": "key phrase"} entry');
    if (c.body.some(x => typeof x !== 'string' && !(x && typeof x === 'object'))) errs.push('copy.body entries must be strings or {"k": …}');
  }
  if (!Array.isArray(c.card5) || c.card5.length !== 2 || c.card5.some(x => typeof x !== 'string')) errs.push('copy.card5 must be [title, meta]');
  if (!Array.isArray(c.cards) || c.cards.length !== 2 || c.cards.some(p => !Array.isArray(p) || p.length !== 2 || p.some(x => typeof x !== 'string')))
    errs.push('copy.cards must be [[chip, feature], [chip, feature]]');
  for (const k of ['hubNav']) if (c[k] !== undefined && (!Array.isArray(c[k]) || c[k].length !== 2)) errs.push(`copy.${k} must be [label, label]`);
  for (const k of ['hubSub', 'clock']) if (c[k] !== undefined && typeof c[k] !== 'string') errs.push(`copy.${k} must be a string`);

  const pal = b.palette;
  if (pal) {
    for (const k of PALETTE_KEYS) if (!HEX.test(pal[k] || '')) errs.push(`palette.${k} must be a #RRGGBB hex (got ${JSON.stringify(pal[k])})`);
    for (const k of Object.keys(pal)) if (!PALETTE_KEYS.includes(k)) errs.push(`palette.${k} is not a palette key (${PALETTE_KEYS.join(', ')})`);
  }
  for (const [k, v] of Object.entries(b.tints || {})) if (!HEX.test(v)) errs.push(`tints.${k} must be a #RRGGBB hex`);
  if (pal && !allowPalette && !b.allowPalette) {
    for (const [k, v] of [...Object.entries(pal), ...Object.entries(b.tints || {})]) {
      const bad = HEX.test(v) && forbiddenHue(v);
      if (bad) errs.push(`palette rule: ${k} ${v} reads as ${bad} (hue ${hsl(v).h.toFixed(0)}°) — no purple/violet/magenta/orange`);
    }
  }
  if (pal && HEX.test(pal.page || '') && hsl(pal.page).l < .9) warns.push('palette.page should be an off-white (lightness ≥ 90%)');
  if (pal && HEX.test(pal.navy || '') && hsl(pal.navy).l > .32) warns.push('palette.navy should be dark — the white mark sits on it in S2');

  let logo = null;
  if (b.logoSvgPath) {
    const p = resolve(dir, b.logoSvgPath), ext = extname(p).toLowerCase();
    if (!existsSync(p)) errs.push(`logoSvgPath ${p} not found`);
    else if (ext === '.svg') logo = { svg: readFileSync(p, 'utf8') };
    else if (['.png', '.webp', '.jpg', '.jpeg'].includes(ext))
      logo = { data: `data:image/${ext === '.jpg' ? 'jpeg' : ext.slice(1)};base64,${readFileSync(p).toString('base64')}` };
    else errs.push('logoSvgPath must be .svg (or a transparent .png/.webp)');
    if (logo) { logo.tint = b.logoTint !== false; logo.scale = typeof b.logoScale === 'number' ? b.logoScale : .8; }
  }

  const music = Object.assign({ mode: 'synth', transpose: 0, start: 0 }, b.music);
  if (!['synth', 'track', 'none'].includes(music.mode)) errs.push('music.mode must be synth | track | none');
  if (music.mode === 'synth' && !(Number.isInteger(music.transpose) && Math.abs(music.transpose) <= 7)) errs.push('music.transpose must be an integer semitone shift in −7…+7');
  if (music.mode === 'track') {
    if (!music.path) errs.push('music.path is required when music.mode is "track"');
    else { music.path = resolve(dir, music.path); if (!existsSync(music.path)) errs.push(`music.path ${music.path} not found`); }
  }

  if (errs.length) throw new Error('brand.json problems:\n  - ' + errs.join('\n  - '));
  const slug = (c.name || 'product').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'product';
  const inject = { copy: c, palette: pal || undefined, tints: b.tints || undefined, logo: logo || undefined };
  return { brand: b, inject, music, slug, warns };
}
