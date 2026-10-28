// Review sheet: one row per shot of a rendered cut — timecode, thumbnail, what's on screen, its sounds — with a box per
// shot for the user's direction (plus shot-type and exit pickers). Published as an Artifact, the page keeps the notes
// in its `db` (collection `notes`, doc `<cut>~<shot id>`, `<cut>~_film` for the whole film) and Claude reads them back
// with ArtifactData; opened locally, notes stay in that browser and "Copy notes" puts them on the clipboard.
// Writes DIR/review/<slug>[-<cut>]-<aspect>/: index.html (artifact body), preview.html (same page as a full document),
// film.mp4 (review proxy, < 15 MiB), thumbs/<id>.jpg (+ thumbs/cut.<frame>.jpg with the film: the frames either side of
// each cut), sheet.json (the rows, for Claude). artifact.json is Claude's:
// the published URL, kept across rebuilds.
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { VIDEO, ASPECTS, FPS, ff, UserError } from './common.mjs';
import { TRANSITIONS } from './spec.mjs';
import { plainCopy, carryPlan } from '../engine/kit.js';
import { shotPrints, staleShots, fileSha } from './fingerprint.mjs';
import { renderHeroes } from './render.mjs';

const PROXY_W = { '16x9': 960, '9x16': 540, '1x1': 720 }, THUMB_W = { '16x9': 480, '9x16': 300, '1x1': 400 };
const MAX_PROXY = 15 * 1024 * 1024 - 65536;            // the Artifact tool's per-file cap for binaries, with headroom
const HEX = /^#[0-9a-f]{6}$/i;

export const tc = s => {                               // 30-fps timecode, MM:SS:FF (HH: past an hour)
  const f = Math.round(s * FPS), h = Math.floor(f / (3600 * FPS)), m = Math.floor(f / (60 * FPS)) % 60, sec = Math.floor(f / FPS) % 60;
  return `${h ? String(h).padStart(2, '0') + ':' : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}:${String(f % FPS).padStart(2, '0')}`;
};
const flat = x => plainCopy(String(x));
const q = x => `“${flat(x)}”`;

// the line a viewer reads first, with *accent* markup kept for the page (| line breaks become spaces)
const partnerName = s => s.partner && typeof s.partner === 'object' ? s.partner.name : s.partner;
function headline(s) {
  const first = Array.isArray(s.copy) ? s.copy[0] : null;      // a block's own copy(s), as the timeline stored it
  const t = s.block === 'title' ? [s.pre, s.name].filter(Boolean).join(' ')
    : s.block === 'stat' && s.value != null ? `${s.prefix || ''}${s.value}${s.suffix || ''}${s.label ? ' ' + s.label : ''}`
    : s.block === 'cta' ? [s.pre ?? 'Comment', s.word, s.post ?? 'to get the link'].filter(Boolean).join(' ')
    : s.block === 'lockup' ? first
    : s.block === 'split' || s.block === 'float' ? s.text ?? s.caption ?? first
    : s.block === 'agent' ? s.title ?? s.user ?? first
    : s.block === 'roster' ? s.title ?? 'Your agents'
    : s.block === 'stack' ? s.pill ?? first
    : s.block === 'scene' ? first
    : s.text ?? s.name ?? s.prompt ?? s.tagline ?? s.label ?? (Array.isArray(s.words) ? s.words.join(' ') : '') ?? first;
  return String(t || first || '').replace(/\s*\|\s*/g, ' ').trim();
}

function item(it) {
  if (it == null || typeof it !== 'object') return null;
  const [k, v] = Object.entries(it).find(([k]) => k !== 'at') || [];
  const o = v && typeof v === 'object' ? v : {};
  switch (k) {
    case 'header': return `header ${q(o.title || '')}${o.sub ? ` — ${flat(o.sub)}` : ''}`;
    case 'row': return `row ${q(o.title || '')}${o.sub ? ` (${flat(o.sub)})` : ''}${o.value ? ` ${flat(o.value)}` : ''}${o.check ? ' ✓' : ''}`;
    case 'msg': return `${it.from === 'user' ? 'your message' : 'message'} ${q(v)}`;
    case 'typing': return 'typing dots';
    case 'input': return `types ${q(v)} and sends`;
    case 'card': return `card ${q(o.title || '')}${o.value ? ` ${flat(o.value)}` : ''}${Array.isArray(o.actions) ? ` [${o.actions.map(flat).join(' / ')}]` : ''}`;
    case 'tap': return `taps ${flat(v)}`;
    case 'toast': return `toast ${q(v)}`;
    case 'notif': return `notification ${q([o.title, o.body].filter(Boolean).join(': '))}`;
    case 'steps': return `steps ${[].concat(v || []).map(flat).join(' ✓ · ')} ✓`;
    case 'image': return `screenshot ${flat(v)}`;
    case 'chips': return `chips ${[].concat(v || []).map(flat).join(' · ')}`;
    case 'space': return null;
    default: return k ? `${k} ${typeof v === 'object' ? '' : flat(v)}`.trim() : null;
  }
}

// what happens on screen, in order, as short fragments
const hasBg = s => s.bg != null && s.bg !== false && String(s.bg).trim() !== '' && String(s.bg).toLowerCase() !== 'none';
// how the shot arrives across the cut (round 2; review fix #20): a carry or morph from the shot before, a dive, a flood,
// or cards grown out of the shot before (from:)
const fromLayer = s => ['float', 'stack', 'wall', 'fan'].includes(s.block) && typeof s.from === 'string' && !(s.block === 'float' && ['left', 'right'].includes(s.from))
  && !(s.block === 'wall' && s.layout != null && s.layout !== 'float') && !(s.block === 'stack' && s.mode != null && s.mode !== 'cycle');
function arrival(s, prev) {
  if (!prev) return { text: null };
  if (prev.carry != null) {
    const P = carryPlan(prev.carry);
    if (P.frame) return { text: `opens on ${prev.id}'s ${P.el} grown to fill the frame` };
    return { text: `${P.el} ${P.morph ? 'morphs' : 'is carried'} in from ${prev.id}${P.to !== P.el ? `, landing as the ${P.to}` : ''}`, onto: P.to };
  }
  // (after a flood the layer is under the colour: the stage grows the cards out of the flood's origin, a point)
  if (fromLayer(s)) return { text: prev.out === 'flood' ? `grows out of the point ${prev.id}'s colour floods from` : `grows out of ${prev.id}'s ${s.from}`, grown: true };
  if (Array.isArray(s.from) && ['float', 'stack', 'wall', 'fan'].includes(s.block)) return { text: 'grows out of a point', grown: true };
  if (prev.out === 'dive') return { text: `the camera dives in from ${prev.id}`, dive: true };
  if (prev.out === 'flood') return { text: `${prev.id}'s colour floods in` };
  return { text: null };
}
function onScreen(s, prev = null) {
  const out = [], push = x => { if (x) out.push(x); }, arr = arrival(s, prev);
  if (hasBg(s)) push(`over ${/\.(mp4|mov|m4v|webm|mkv)$/i.test(String(s.bg)) ? 'footage' : 'image'} ${flat(s.bg)}${s.letterbox ? ', letterboxed' : ''}`);
  push(arr.text);
  switch (s.block) {
    case 'title': push(`logo lockup${s.badge ? `, ${q(s.badge)} bubble` : ''}`); push(s.sub && `sub line ${q(s.sub)}`); break;
    case 'headline': push(s.kicker && `kicker ${q(s.kicker)}`); push('words rise in'); push(s.sub && `sub ${q(s.sub)}`); break;
    case 'cast': push(`${s.count || 'the'} characters spring up and hop`); break;
    case 'prompt': push(`prompt box types ${q(s.prompt || '')} and sends`); push(Array.isArray(s.steps) && `agent steps ${s.steps.map(flat).join(' ✓ · ')} ✓`); break;
    case 'orbit': case 'field': push(`hero ${flat(s.hero || 'mark')} with ${[].concat(s.items || s.icons || []).map(x => flat(typeof x === 'object' ? x.label || x.icon || '' : x)).filter(Boolean).join(', ') || 'icons'} around it`); break;
    case 'stat': push(`counts up${s.from != null ? ` from ${s.from}` : ''}`); push(s.sub && `sub ${q(s.sub)}`); break;
    case 'media': push(`${s.device ? `${s.device} showing ` : 'full-bleed '}${flat(s.src || 'media')}${s.move ? `, ${s.move}` : ''}`); break;
    case 'endcard': push(`end card${s.tagline ? ` ${q(s.tagline)}` : ''}`); push(s.cta && `buttons ${[].concat(s.cta).map(flat).join(' / ')}`); push(s.url && flat(s.url)); push(s.cast && `${s.cast} characters`); break;
    // reels
    case 'sticker': push(s.kicker && `kicker pill ${q(s.kicker)}${s.logo ? ' with the logo' : ''}`); push(`${s.style || 'outline'} sticker ${q(s.text || '')} slams in${s.shake === false ? '' : ' with an impact shake'}`); push(s.ribbon && `ribbon ${q(s.ribbon)} slides in`); break;
    case 'split': {
      const labels = [].concat(s.labels ?? ['Before', 'After']).map(flat);
      push(s.text && `sticker headline ${q(s.text)}`);
      push(s.mode === 'wipe' ? `divider sweeps across ${flat(s.before || '')} to reveal ${flat(s.after || '')}` : `${flat(s.before || '')} and ${flat(s.after || '')} pop in side by side${s.arrow === false ? '' : ' with an arrow'}`);
      push(labels.length && `labels ${labels.join(' / ')}`); break;
    }
    case 'float': push(s.text && `sticker headline ${q(s.text)}`); push(`${s.device === 'phone' ? 'phone' : 'card'} showing ${flat(s.card || '')}${arr.onto === 'card' || arr.grown || arr.dive ? '' : ` flies in from the ${['left', 'right'].includes(s.from) ? s.from : 'left'}${s.streak === false ? '' : ' with a speed streak'}`}`); push(s.label && `focus brackets + tag ${q(s.label)}`); break;
    case 'cta': push(`keyword ${q(s.word || '')} slams in`); push(`${q(s.pre ?? 'Comment')} / ${q(s.post ?? 'to get the link')} slide in`); push(s.logo !== false && 'logo pops'); push('chat bubble bounces'); break;
    // launch films
    case 'scene': for (const o of [].concat(s.overlays || [])) {
      if (!o || typeof o !== 'object') continue;
      if (o.bar != null) { const dark = (o.theme || ((hasBg(s) ? s.theme !== 'light' : s.theme === 'dark') ? 'dark' : 'light')) === 'dark';
        push(`${dark ? 'dark composer' : o.framing === 'macro' ? 'macro prompt bar' : 'prompt bar'} types ${q(o.bar)} and sends`); }
      else if (o.bubble != null) push(`message bubble ${q(o.bubble)}${o.from ? ` from ${flat(o.from)}` : ''}`);
      else if (o.words != null) push(`words pop: ${[].concat(o.words).map(flat).join(' · ')}`);
      else if (o.pill != null) push(`status pill ${q(o.pill)}`);
      else if (o.orb != null) push(`voice orb${o.caption != null ? `: ${[].concat(o.caption).map(q).join(' → ')}` : ''}`);
    } break;
    case 'agent': push(s.user && `your message ${q(s.user)}`);
      for (const r of [].concat(s.rows || [])) { const x = typeof r === 'string' ? { reply: r } : r || {}; push(`${flat(x.name || 'agent')} ${flat(x.status || 'thinking')} → ✓${x.reply ? `, streams ${q(x.reply)}` : ''}`); }
      push(s.title && `title ${q(s.title)} streams`); push(Array.isArray(s.steps) && s.steps.length && `steps ${s.steps.map(flat).join(' ✓ · ')} ✓`); push(s.input && `message bar ${q(s.input)}`); break;
    case 'roster': push(`agents ${[].concat(s.agents || []).map(a => flat(typeof a === 'object' && a ? a.name || '' : a)).join(', ')} step through the highlight${s.more ? ` → ${q(s.more)}` : ''}`); break;
    case 'type': push(s.over && `co-brand line ${q(s.over)}`); push(Array.isArray(s.words) && s.text == null ? `word beats ${s.words.map(q).join(' · ')}` : `${q(s.text || '')} settles${s.face === 'serif' ? ' (serif)' : ''}`); push(s.pill && `accent pill ${q(s.pill)}`); push(s.through && 'zooms through the camera'); break;
    // the motion kit (round 1)
    case 'press': push(s.control === 'send' && s.typed !== false ? `prompt ${q(s.label || 'Make a launch teaser')} types in, the cursor presses send, rings burst` : `cursor presses the ${s.control || 'button'}${s.label ? ` ${q(s.label)}` : ''}, rings burst`); push(s.after && `label turns ${q(s.after)}`); break;
    case 'fan': push(`${s.count || [].concat(s.cards || []).length || 5} cards deal out onto a fan, then a push into the hero`); push(Array.isArray(s.labels) && s.labels.length && `chips ${s.labels.map(flat).join(' · ')}`); break;
    case 'particles': push(`${s.mode || 'sphere'} of dots${s.orbits ? ' with orbits' : ''}${s.burstAt != null && (s.mode || 'sphere') === 'sphere' ? `, bursts at ${flat(s.burstAt)}` : ''}`); break;
    case 'map': push(`route draws itself${Array.isArray(s.stops) ? ` through ${s.stops.map(x => flat((x && x.label) || '')).filter(Boolean).join(' → ')}` : ''}, pins drop`); break;
    case 'lockup': push(`${flat(Array.isArray(s.copy) && s.copy[0] ? s.copy[0] : `${s.name || 'logo + name'} × ${partnerName(s) || ''}`)} types in`); push(s.pill && `pill ${q(s.pill)}`); push(s.cast !== false && s.cast !== 0 && `${s.cast ?? 6} mascots bounce in`); break;
    case 'stack': if (s.mode === 'exploded') { const L = [].concat(s.labels || []).map(flat); push(`${Math.max(3, Math.min(5, [].concat(s.cards || []).length || L.length || 4))} ${s.cards ? 'planes' : 'UI layers'} separate on a diagonal${s.tilt === 'low' ? ' (low tilt)' : ''}`); push(L.length && `labels ${L.join(' · ')} on leaders`); break; }
      push(`${s.count || Math.max(8, [].concat(s.cards || []).length)} cards cycle, the front one settles`); push(s.pill && `status pill ${q(s.pill)}`); break;
    case 'wall': push(s.layout === 'grid' ? `grid of ${[].concat(s.cards || []).length} cards cascades in, one tile lit, the rest dim` : `video wall of ${[].concat(s.cards || []).length} cards drifting`); push(s.text && `headline ${q(s.text)}`); push(Array.isArray(s.chips) && s.chips.length && `chips ${s.chips.map(flat).join(' · ')}`); break;
  }
  if (s.caption) push(`caption ${q(s.caption)} pops word by word`);
  if (Array.isArray(s.items) && ['phone', 'browser', 'panel'].includes(s.block)) {
    push(`${s.block === 'panel' ? `${s.style || 'card'} panel` : s.block}${s.side ? ` on the ${s.side}` : ''}`);
    for (const it of s.items) push(item(it));
  }
  if (s.hold) push(`holds frames ${s.hold[0]}–${s.hold[1]}`);
  return out;
}

function sounds(tl, s) {
  const n = {};
  for (const c of tl.cues) if (c.shot === s.id) n[c.kind] = (n[c.kind] || 0) + 1;
  const out = Object.entries(n).map(([k, c]) => `${c} ${k}${c > 1 ? (k.endsWith('sh') ? 'es' : 's') : ''}`);
  if (tl.whooshes.some(w => w.shot === s.id)) out.push('whoosh into the next shot');
  const m = tl.music || {};
  if (m.drop === s.id) out.push('music drops in');
  if ((m.breaks || []).includes(s.id)) out.push('drums drop out');
  if (tl.vo) out.push('voiceover runs under');
  return out;
}

// the film as delivered must still be the one this timeline describes, or the sheet would show a different video.
// Shot prints also cover the engine code, so a skill update alone marks every shot stale; then the job's own files
// decide: when none changed after the film was rendered, its shots still say what beats.yaml says.
const jobFiles = job => ['beats.yaml', ...['assets', 'blocks'].flatMap(d => existsSync(join(job, d))
  ? readdirSync(join(job, d), { recursive: true }).map(f => join(d, String(f))).filter(f => statSync(join(job, f)).isFile()) : [])];
function checkFilm(job, tl, aspect, mp4, log) {
  const mux = (() => { try { return JSON.parse(readFileSync(join(job, 'out', tl.id, aspect, 'mux.json'), 'utf8')); } catch { return null; } })();
  if (!mux) throw new UserError(`${mp4} has no QA record (out/${tl.id}/${aspect}/mux.json) — re-run --film (or --audio) so the sheet knows which timeline it shows`);
  const sha = fileSha(mp4);
  if (mux.mp4?.sha !== sha) throw new UserError(`${mp4} isn't the file the last --film/--audio wrote (checksum differs) — re-run --audio to rebuild it`);
  const stale = staleShots(tl, mux.frames, shotPrints(job, tl, aspect));
  if (stale.length) {
    const t = statSync(mp4).mtimeMs, newer = jobFiles(job).filter(f => statSync(join(job, f)).mtimeMs > t);
    if (newer.length) throw new UserError(`${newer.slice(0, 4).join(', ')}${newer.length > 4 ? ` (+${newer.length - 4} more)` : ''} changed after the film was rendered, so ${stale.map(s => s.id).join(', ')} may not show what the job now says — re-render first (` +
      stale.map(s => `--film --range ${s.from},${s.to}`).join('; ') + `), or pass --stills to review fresh storyboard stills instead`);
    log(`  ! ${stale.map(s => s.id).join(', ')} were rendered with older engine code; nothing in the job changed since, so the sheet describes the film as delivered`);
  }
  return sha;
}

function proxy(mp4, out, aspect) {
  for (const crf of [27, 31, 35]) {
    ff(['-i', mp4, '-vf', `scale=${PROXY_W[aspect]}:-2:flags=lanczos,fps=30`, '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf),
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '128k', out], 'review proxy');
    if (statSync(out).size <= MAX_PROXY) return statSync(out).size;
  }
  throw new UserError(`the review proxy is still over 15 MiB at CRF 35 (${(statSync(out).size / 1048576).toFixed(1)} MiB) — the cut is too long for one sheet`);
}

// the frames either side of every cut — 60-fps indices cut−1, cut, cut+1 — side by side in one JPEG per cut (each frame
// at half size, 8 px apart), thumbs/cut.<frame>.jpg: published with the thumbs, one file per cut (a shot id can't
// hold a dot, so it never meets a shot's thumb). From the film's PNG frames when they are the ones in the mp4 (mux.json's
// prints = render.json's), else decoded from the mp4 itself; with the film's cut-continuity verdict (qa.json: the
// problems QA warned for) when its QA ran on these cuts. Shot id → {at, into, out, w, h (one frame), stills, cont}
function cutStills(job, tl, aspect, mp4, thumbs) {
  const J = f => { try { return JSON.parse(readFileSync(join(job, 'out', tl.id, aspect, f), 'utf8')); } catch { return null; } };
  const fdir = join(job, 'out', tl.id, aspect, 'frames'), mux = J('mux.json'), rj = J('render.json');
  const pngs = !!mux && !!rj && JSON.stringify(mux.frames) === JSON.stringify(rj.prints) && existsSync(fdir);
  const qa = J('qa.json'), cc = (qa?.results || []).find(r => r.name === 'continuity' && Array.isArray(r.cuts))?.cuts || [];
  const { W, H } = ASPECTS[aspect], pad = i => String(i).padStart(5, '0'), scale = `scale=${W / 2}:-2:flags=lanczos`, out = {};
  const speed = r => `speed ${r.before.v} → ${r.after.v} px/s${r.ratio === undefined ? '' : r.ratio === null ? ` (${r.after.v < r.before.v ? 'to' : 'from'} rest)` : ` (${r.ratio}×${r.tuned ? ', tuned drift' : ''})`}`;
  tl.cuts.forEach((c, k) => {
    const A = tl.shots[k], B = tl.shots[k + 1], src = `thumbs/cut.${pad(c)}.jpg`;
    const ins = [c - 1, c, c + 1].flatMap(i => { const png = join(fdir, `${pad(i)}.png`); return pngs && existsSync(png) ? ['-i', png] : ['-ss', Math.max(0, (i - .5) / 60).toFixed(4), '-i', mp4]; });
    // 8 px of neutral between frames: a sub-pixel of crop slack in the page shows that, not the next frame's edge
    const gap = `pad=iw+8:ih:0:0:color=0xD9D9DE`;
    ff([...ins, '-filter_complex', `[0:v]${scale},${gap}[a];[1:v]${scale},${gap}[b];[2:v]${scale}[c];[a][b][c]hstack=inputs=3`, '-frames:v', '1', '-q:v', '3', join(thumbs, `cut.${pad(c)}.jpg`)], `cut stills ${c}`);
    const stills = [c - 1, c, c + 1].map((i, part) => ({ f: i, t: +(i / 60).toFixed(3), shot: i < c ? A.id : B.id, src, part, which: i < c ? 'cut−1' : i === c ? 'cut' : 'cut+1' }));
    // QA's verdict for the row's one-line summary: the problems it warned for (qa.mjs cutContinuity, `warn` per record)
    const q = cc.find(x => x.at === c && x.cut === `${A.id}→${B.id}`), r = q?.camera, carry = (q?.carry || []).filter(x => x.moving);
    const warned = x => !!(x && x.moving && x.warn && x.warn.length);
    const camText = !r ? 'camera: no data for this cut (re-run --film)' : !r.moving ? 'camera: still on both sides of the cut'
      : `camera: ${r.flips.length ? `direction flips (${r.flips.map(k => ({ z: 'zoom', vx: 'x', vy: 'y' })[k] || k).join(', ')}) · ` : ''}${speed(r)}${r.peak.off ? ` · fastest step ${Math.abs(r.peak.off)} f ${r.peak.off > 0 ? 'after' : 'before'} the cut${r.peak.settle ? ' (its entrance settling)' : ''}` : ' · fastest on the cut'}`;
    const cont = !q ? null : { text: camText + (carry.length ? ` · ${carry.length} carried object${carry.length > 1 ? 's' : ''}${carry.some(warned) ? ' (QA WARN)' : ', continuous'}` : ''),
      warn: warned(r) || carry.some(warned) };
    out[A.id] = { at: c, into: B.id, out: A.out, w: W / 2, h: H / 2, stills, cont };
  });
  return out;
}

export async function buildSheet({ job, spec, tl, aspect, name, stills = false, log = console.log }) {
  if (!ASPECTS[aspect]) throw new UserError(`unknown aspect ${aspect}`);
  const base = name(tl.id, `-${aspect}`), dir = join(job, 'review', base), thumbs = join(dir, 'thumbs');
  const mp4 = join(job, `${base}.mp4`), haveFilm = !stills && existsSync(mp4);
  if (!stills && !haveFilm) throw new UserError(`no film at ${mp4} — run --film first, or pass --stills to review storyboard stills`);
  const sha = haveFilm ? checkFilm(job, tl, aspect, mp4, log) : null;     // before touching the review folder
  mkdirSync(dir, { recursive: true }); rmSync(thumbs, { recursive: true, force: true }); mkdirSync(thumbs);
  let film = null, cuts = null;
  if (haveFilm) {
    log(`  review proxy from ${mp4}`);
    const size = proxy(mp4, join(dir, 'film.mp4'), aspect);
    for (const s of tl.shots) ff(['-ss', ((s.f0 + s.heroF) / FPS + 0.5 / FPS).toFixed(4), '-i', mp4, '-frames:v', '1',
      '-vf', `scale=${THUMB_W[aspect]}:-2:flags=lanczos`, '-q:v', '3', join(thumbs, `${s.id}.jpg`)], `thumbnail ${s.id}`);
    film = { src: 'film.mp4', sha: sha.slice(0, 7), rendered: statSync(mp4).mtime.toISOString(), proxyBytes: size };
    cuts = cutStills(job, tl, aspect, mp4, thumbs);
    rmSync(join(dir, 'stills'), { recursive: true, force: true });
  } else {
    log('  no film: rendering one storyboard still per shot');
    const sdir = join(dir, 'stills'); rmSync(sdir, { recursive: true, force: true }); mkdirSync(sdir);
    const { paths } = await renderHeroes({ job, tl, aspect, outDir: sdir });
    tl.shots.forEach((s, k) => ff(['-i', paths[k], '-vf', `scale=${THUMB_W[aspect]}:-2:flags=lanczos`, '-q:v', '3', join(thumbs, `${s.id}.jpg`)], `thumbnail ${s.id}`));
    rmSync(sdir, { recursive: true, force: true }); rmSync(join(dir, 'film.mp4'), { force: true });
  }
  const blocks = Object.entries(spec.blocks).filter(([k]) => k !== '__custom').map(([k, b]) => ({ id: k, doc: String(b.doc || '').split(/[.—]/)[0].trim() }));
  const c = spec.brand.colors || {};
  const data = {
    v: 1, title: spec.title, brand: spec.brand.name, slug: spec.slug, cut: tl.id, aspect, dur: +(tl.frames / 60).toFixed(3),
    bpm: tl.bpm, film, stills: !haveFilm, built: new Date().toISOString(),
    accent: HEX.test(c.accent) ? c.accent : '#4C8DF6', accentDark: HEX.test(c.accentOnDark) ? c.accentOnDark : '#8DB6FA',
    blocks, transitions: TRANSITIONS,
    shots: tl.shots.map((s, k) => ({
      id: s.id, n: k + 1, start: +s.start.toFixed(4), end: +s.end.toFixed(4), tcIn: tc(s.start), tcOut: tc(s.end),
      beats: s.beats ?? null, sec: +(s.end - s.start).toFixed(2), block: s.block, out: s.out, last: k === tl.shots.length - 1,
      theme: s.theme || null, headline: headline(s), screen: onScreen(s, tl.shots[k - 1] || null), sound: sounds(tl, s), note: s.note ? flat(s.note) : null,
      thumb: `thumbs/${s.id}.jpg`,
      cause: s.cause ? flat(s.cause) : null,
      cut: k < tl.shots.length - 1 ? (cuts ? cuts[s.id] : { at: tl.cuts[k], into: tl.shots[k + 1].id, out: s.out, stills: null, cont: null }) : null,
    })),
  };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');   // read back with JSON.parse, so only </script matters
  const esc = x => String(x).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
  const title = `${spec.brand.name || spec.title} ${tl.id === 'main' ? 'film' : `${tl.id} cut`} notes`;
  const page = readFileSync(join(VIDEO, 'lib', 'sheet.html'), 'utf8')
    .replace('__TITLE__', () => esc(title)).replace(/__ACCENT__/g, data.accent).replace(/__ACCENT_DARK__/g, data.accentDark)
    .replace('__DATA__', () => json);
  writeFileSync(join(dir, 'index.html'), page);
  writeFileSync(join(dir, 'preview.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + page + '</body></html>');
  writeFileSync(join(dir, 'sheet.json'), JSON.stringify({ ...data, notes: { collection: 'notes', doc: `${tl.id}~<shot id>`, film: `${tl.id}~_film` } }, null, 1));
  return { dir, title, rows: data.shots.length, film };
}
