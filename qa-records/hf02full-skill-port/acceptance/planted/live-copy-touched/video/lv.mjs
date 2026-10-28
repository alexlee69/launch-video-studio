#!/usr/bin/env node
// From-scratch launch videos. One job folder = brief.md + beats.yaml + assets/ (+ optional blocks/*.mjs);
// generated files go to DIR/out/, deliverables land at the top of DIR (clips in DIR/clips/).
//
//   node lv.mjs --job DIR --init [--title "Name"] [--kit reel|film]
//                                                                 starter brief.md + beats.yaml + assets/ (never overwrites);
//                                                                 --kit reel / film: a reel (stickers, AI footage) or a launch
//                                                                 film (UI over AI footage) starter that runs with no assets
//   node lv.mjs --job DIR --grid [--cut NAME]                     compile beats.yaml → beat grid table + warnings
//   node lv.mjs --job DIR --storyboard [--aspect 16x9|all] [--cut NAME]
//                                                                 one real still per shot → <slug>-storyboard-<aspect>.png/.pdf
//   node lv.mjs --job DIR --animatic [--aspect 16x9] [--cut NAME] 30 fps half-size preview with sound → <slug>-animatic-<aspect>.mp4
//   node lv.mjs --job DIR --film [--aspect A|all] [--cut NAME|all] [--workers 4] [--range a,b]
//                                                                 60 fps frames → audio → master → mux → QA → <slug>-<aspect>.mp4
//   node lv.mjs --job DIR --audio [--cut NAME]                    redo audio → master → mux → QA on frames already rendered
//   node lv.mjs --job DIR --qa [--aspect A] [--cut NAME]          re-run QA
//   node lv.mjs --job DIR --clips [s2,s4|all] [--alpha] [--webm] [--fps 30] [--aspect 16x9] [--with-transitions]
//                                                                 one clip per shot for your own edit (ProRes 4444 alpha .mov,
//                                                                 or H.264), plus each clip's UI sound effects as a WAV
//   node lv.mjs --job DIR --layers [s5,s6|all] [--alpha] [--webm] [--fps 30] [--aspect 16x9] [--with-transitions]
//                                                                 every element of a shot as its own transparent layer
//                                                                 (ProRes 4444, back to front) + manifest.json + an After
//                                                                 Effects .jsx → DIR/layers/<slug>-<id>-<aspect>/
//   node lv.mjs --job DIR --serve [--aspect 16x9]                 scrub preview at http://127.0.0.1:PORT (Ctrl-C to stop)
//   node lv.mjs --job DIR --sheet [--aspect A|all] [--cut NAME] [--stills]
//                                                                 review sheet: every shot with timecode, thumbnail and a
//                                                                 box for the user's direction → DIR/review/<slug>-<aspect>/
//   node lv.mjs --job DIR --breakdown FILE [--threshold 0.3] [--min-shot 0.2] [--per-page 8]
//                                                                 a reel the user saved → its shots, pacing, tempo, contact
//                                                                 sheets and a draft timing → DIR/reference/<name>/
//   node lv.mjs --tempo FILE                                      a music track's bpm / first downbeat + a music: snippet
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync, rmSync, statSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { availableParallelism, totalmem } from 'node:os';
import { VIDEO, ASPECTS, arg, jobDir, outDir, slugify, UserError } from './lib/common.mjs';
import YAML from 'yaml';
import { loadSpec } from './lib/spec.mjs';
import { compile, gridTable } from './lib/timeline.mjs';
import { renderFrames, renderHeroes, launch, extractPlates, openStage, closeStage } from './lib/render.mjs';
import { buildAudio, audioIssues } from './lib/audio.mjs';
import { master, mux, encodeAlpha, encodeAlphaAsync, previewOver, sfxClip } from './lib/deliver.mjs';
import { qaFilm, qaClip, textIssues, barsOf } from './lib/qa.mjs';
import { letterboxBar } from './engine/kit.js';
import { hasBg } from './lib/timeline.mjs';
import { qaLayers, liveText, writeJsx, stackPreview, layerSheet, BLUR_MIN } from './lib/layers.mjs';
import { buildBoard, captions, thumbnail } from './lib/board.mjs';
import { serve } from './lib/server.mjs';
import { shotPrints, audioPrint, staleShots, fileSha } from './lib/fingerprint.mjs';

const argv = process.argv.slice(2);
if (argv.includes('--blocks')) {                 // the live block catalogue (no job needed; with --job DIR also its custom blocks)
  const { BLOCKS } = await import('./engine/blocks/index.js');
  let custom = {};
  if (argv.includes('--job')) { const { loadBlocks } = await import('./lib/spec.mjs'); try { custom = (await loadBlocks(jobDir(argv))).__custom; } catch (e) { console.error('✗ ' + e.message); process.exit(2); } }
  const { mediaFields } = await import('./lib/spec.mjs');
  for (const b of [...Object.values(BLOCKS), ...Object.values(custom).map(b => ({ ...b, name: `${b.name} (custom, blocks/${b.file})` }))]) {
    console.log(`\n${b.name} — ${b.doc}`);
    for (const [k, v] of Object.entries(b.params || {})) console.log(`  ${k.padEnd(12)} ${v}`);
    if (b.layers) console.log(`  ${'(layers)'.padEnd(12)} ${b.layers}`);
    const mf = mediaFields(b).map(m => m.field);
    if (mf.length) console.log(`  ${'(footage)'.padEnd(12)} ${mf.join(', ')} ${mf.length > 1 ? 'take' : 'takes'} footage too (.mp4/.mov …; <field>From = seconds into it)`);
    if (b.bgDefaults) console.log(`  ${'(bg)'.padEnd(12)} with bg: defaults ${Object.entries(b.bgDefaults).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  }
  console.log('\nCommon to every shot: id, block, beats | sec, out, theme (light|dark), hold [from,to], note, push,\n  bg (image/footage behind any block), bgFrom, bgDim, bgMove (in|out|left|right|none), letterbox (true | ratio),\n  camera: zoom, focus [x,y], offset [x,y], pan [{at, by: [x,y], len}], move [x,y] (each may be {16x9: …, 9x16: …}),\n  drift {in, out} (strengths of a drift-left|right|up|down cut)');
  console.log('(layers) = what --layers exports for the block, back to front; custom blocks name theirs with ctx.layer(el, name),\n  ctx.el(html, css, name) or ctx.text(copy, {layer: name}); untagged elements fall back to one `content` layer');
  process.exit(0);
}
if (argv.includes('--tempo')) {                  // a music track's tempo + a ready music: snippet (no job needed)
  const f = arg(argv, '--tempo', null);
  if (!f || f === true) { console.error('✗ --tempo needs a file, e.g. --tempo assets/track.wav'); process.exit(2); }
  const { tempo, formatTempo } = await import('./lib/breakdown.mjs');
  try { console.log(formatTempo(await tempo(String(f)))); process.exit(0); }
  catch (e) { console.error('\n✗ ' + (e instanceof UserError ? e.message : e.stack)); process.exit(1); }
}
const job = jobDir(argv);
// ffmpeg reads % in an image-sequence path as a frame-number pattern, so frame folders under such a path can't be read
if (job.includes('%')) { console.error(`\n✗ the job folder path has a "%" in it (${job}) — ffmpeg reads % as a frame-number pattern; rename the folder (e.g. "30 pct off")`); process.exit(2); }
const t0 = Date.now();
const step = s => console.log(`\n── ${s} ${'─'.repeat(Math.max(0, 62 - s.length))} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
const die = (msg, code = 1) => { console.error('\n✗ ' + msg); process.exit(code); };

async function main() {
  if (arg(argv, '--init', false)) return init();
  if (arg(argv, '--breakdown', false)) {           // a saved reference reel → DIR/reference/<name>/ (never touches beats.yaml)
    const f = arg(argv, '--breakdown', null);
    if (f === true) die('--breakdown needs the reel file, e.g. --breakdown ~/Downloads/reel.mp4', 2);
    const { breakdown, referenceDir, formatBreakdown } = await import('./lib/breakdown.mjs');
    const out = referenceDir(job, String(f));
    step(`reference breakdown: ${String(f).split('/').pop()}`);
    const B = await breakdown({ file: String(f), out, threshold: arg(argv, '--threshold', .3), minShot: arg(argv, '--min-shot', .2), perPage: arg(argv, '--per-page', 8) });
    console.log(formatBreakdown(B, out));
    return;
  }
  let spec;
  try { spec = await loadSpec(job); } catch (e) { die(e.message, 2); }
  const cutArg = arg(argv, '--cut', 'main');
  const cuts = cutArg === 'all' ? ['main', ...Object.keys(spec.cutdowns)] : [String(cutArg)];
  for (const c of cuts) if (c !== 'main' && !Object.hasOwn(spec.cutdowns, c)) die(`no cutdown "${c}" in beats.yaml (have: ${Object.keys(spec.cutdowns).join(', ') || 'none'})`, 2);
  const aspArg = arg(argv, '--aspect', null);
  const aspects = !aspArg || aspArg === true || aspArg === 'all' ? spec.aspects : String(aspArg).split(',');
  for (const a of aspects) if (!ASPECTS[a]) die(`unknown aspect ${a}`, 2);
  const tlFor = cut => {
    let tl;
    try { tl = compile(spec, cut); } catch (e) { die(`beats.yaml: ${e.message}`, 2); }        // timeline problems are the user's to fix: no stack
    const ai = audioIssues(job, tl);
    tl.warns.push(...ai.errors.map(x => `${x} (--film / --audio will refuse this)`), ...ai.warns);
    mkdirSync(outDir(job, cut), { recursive: true }); writeFileSync(join(outDir(job, cut), 'timeline.json'), JSON.stringify(tl, null, 1)); return tl;
  };
  const name = (cut, suffix) => `${spec.slug}${cut === 'main' ? '' : '-' + cut}${suffix}`;

  if (arg(argv, '--sheet', false)) {
    const { buildSheet } = await import('./lib/sheet.mjs');
    for (const cut of cuts) {
      const tl = tlFor(cut);
      for (const aspect of aspArg ? aspects : aspects.slice(0, 1)) {
        step(`review sheet ${cut} ${aspect}`);
        const r = await buildSheet({ job, spec, tl, aspect, name, stills: !!arg(argv, '--stills', false) });
        console.log(`→ ${r.dir}/ (${r.rows} shots, ${r.film ? `film ${r.film.sha}` : 'storyboard stills'}): preview.html to look locally, index.html + ${r.film ? 'film.mp4 + ' : ''}thumbs/ to publish (GUIDE: Review sheet)`);
      }
    }
    return;
  }

  if (arg(argv, '--grid', false)) {
    for (const cut of cuts) { const tl = tlFor(cut); console.log(gridTable(tl)); for (const w of tl.warns) console.log('  ! ' + w); }
    return;
  }
  if (arg(argv, '--serve', false)) {
    const tl = tlFor(cuts[0]), aspect = aspects[0];
    const plates = extractPlates(job, tl, aspect), pj = join(outDir(job, tl.id, aspect), 'plates.json');
    mkdirSync(outDir(job, tl.id, aspect), { recursive: true }); writeFileSync(pj, JSON.stringify(plates));
    const s = await serve(job);
    console.log(`scrub preview: ${s.base}/skill/video/engine/stage.html?tl=/job/out/${tl.id}/timeline.json&aspect=${aspect}&plates=/job/out/${tl.id}/${aspect}/plates.json&ui=1\n(Ctrl-C to stop)`);
    return new Promise(() => {});
  }
  if (arg(argv, '--storyboard', false)) {
    for (const cut of cuts) {
      const tl = tlFor(cut);
      for (const w of tl.warns) console.log('  ! ' + w);
      for (const aspect of aspects) {
        step(`storyboard ${cut} ${aspect}`);
        const dir = join(outDir(job, cut, aspect), 'board');
        rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
        const { paths, audits, fit } = await renderHeroes({ job, tl, aspect, outDir: dir });
        const shrunk = fit.filter(x => x.size0 && x.size < x.size0 * .85);
        const T = textIssues(audits, ASPECTS[aspect].W, ASPECTS[aspect].H, barsOf(tl, ASPECTS[aspect].W, ASPECTS[aspect].H));
        const notes = [...tl.warns,
          ...shrunk.map(x => `copy shrunk to fit: "${x.text}" ${x.size0}→${x.size}px — shorten it?`),
          ...T.clipped.map(x => `text clipped by the frame: ${x} (film QA will FAIL)`), ...T.tiny.map(x => `text too small: ${x} (film QA will FAIL)`),
          ...T.unsafe.map(x => `text outside the ${T.portrait ? 'platform-UI' : 'title'}-safe area: ${x}`), ...T.small.map(x => `small text (< 26 px): ${x}`)];
        for (const w of notes.slice(tl.warns.length)) console.log('  ! ' + w);
        const { png, pdf } = await buildBoard({ job, tl, aspect, dir, stills: paths, audits, warns: notes });
        for (const [src, ext] of [[png, '.png'], [pdf, '.pdf']]) copyFileSync(src, join(job, name(cut, `-storyboard-${aspect}${ext}`)));
        console.log(`→ ${join(job, name(cut, `-storyboard-${aspect}.png`))} (+ .pdf)`);
      }
    }
    return;
  }
  if (arg(argv, '--animatic', false)) {
    const cut = cuts[0], tl = tlFor(cut), aspect = aspects[0], dir = join(outDir(job, cut, aspect), 'animatic');
    rmSync(dir, { recursive: true, force: true });
    step(`animatic ${aspect}: ${Math.round(tl.frames / 2)} frames @30`);
    const frames = Array.from({ length: Math.round(tl.frames / 2) }, (_, i) => ({ f: i, path: join(dir, `${String(i).padStart(5, '0')}.png`) }));
    await renderFrames({ job, tl, aspect, frames, workers: Number(arg(argv, '--workers', 4)), onProgress: (d, n) => console.log(`  ${d}/${n}`) });
    step('animatic audio');
    const adir = join(outDir(job, cut), 'animatic-audio'); buildAudio(job, tl, adir);   // never the film's audio folder
    const out = join(job, name(cut, `-animatic-${aspect}.mp4`));
    mux({ framesDir: dir, fps: 30, audio: join(adir, 'raw.wav'), out, crf: 24, scale: Math.round(ASPECTS[aspect].W / 2) });
    console.log(`→ ${out} (preview only: half size, 30 fps, unmastered)`);
    return;
  }
  if (arg(argv, '--film', false) || arg(argv, '--audio', false) || arg(argv, '--qa', false)) {
    const doRender = !!arg(argv, '--film', false), doAudio = doRender || !!arg(argv, '--audio', false);
    const range = arg(argv, '--range', null);
    let rangeAB = null;
    if (range && range !== true) {
      const ab = String(range).split(',').map(x => x.trim());
      if (!ab.every(x => /^\d+$/.test(x)) || ab.length > 2) die('--range wants whole 60-fps frame indices: "a,b" or one index', 2);
      rangeAB = [Number(ab[0]), Number(ab[1] ?? ab[0])];
    }
    const readJSON = (f, d) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return d; } };
    const pad = i => String(i).padStart(5, '0');
    let failed = 0;
    for (const cut of cuts) {
      const tl = tlFor(cut);
      for (const w of tl.warns) console.log('  ! ' + w);
      if (rangeAB && !(rangeAB[0] <= rangeAB[1] && rangeAB[1] < tl.frames)) die(`--range must lie within 0–${tl.frames - 1} for "${cut}"`, 2);
      if (doAudio) { const ai = audioIssues(job, tl); if (ai.errors.length) die(ai.errors.join('\n'), 2); }   // before minutes of rendering
      const P = aspect => { const dir = outDir(job, cut, aspect); return { dir, fdir: join(dir, 'frames'), refDir: join(dir, 'bgref'), render: join(dir, 'render.json'), log: join(dir, 'shots.json'), aud: join(dir, 'audits.json'), pages: join(dir, 'pages.json') }; };
      // 1 · frames: render (--film), then every aspect must have a complete, current set before any audio or mux work
      for (const aspect of aspects) {
        const p = P(aspect), cur = shotPrints(job, tl, aspect);
        if (doRender) {
          const heroIdx = new Map(tl.shots.map(sh => [Math.round((sh.f0 + sh.heroF) * 2), sh.id]));
          let idx = Array.from({ length: tl.frames }, (_, i) => i);
          if (rangeAB) idx = idx.filter(i => i >= rangeAB[0] && i <= rangeAB[1]);
          else { rmSync(p.fdir, { recursive: true, force: true }); rmSync(p.refDir, { recursive: true, force: true }); }
          const workers = Number(arg(argv, '--workers', 4));
          // shots this render touches are 'partial' until it finishes, so a crashed or interrupted render leaves them stale
          const span = sh => [Math.round(sh.f0 * 2), Math.round(sh.f1 * 2) - 1];
          const touches = sh => { const [a, b] = span(sh); return !rangeAB || (rangeAB[0] <= b && rangeAB[1] >= a); };
          const prints = (rangeAB && readJSON(p.render, {}).prints) || {};
          for (const sh of tl.shots) if (touches(sh)) prints[sh.id] = 'partial';
          mkdirSync(p.dir, { recursive: true }); writeFileSync(p.render, JSON.stringify({ prints }));
          step(`render ${cut} ${aspect}: ${idx.length} frames @60`);
          const frames = idx.map(i => ({ f: i / 2, path: join(p.fdir, `${pad(i)}.png`) }));
          const audit = new Set(idx.map((i, k) => heroIdx.has(i) ? k : -1).filter(k => k >= 0));
          const res = await renderFrames({ job, tl, aspect, frames, workers, audit, onProgress: (d, n) => console.log(`  ${d}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`) });
          // background-only thumbnails for the same frames (same camera), for the content check
          await renderFrames({ job, tl, aspect, bgOnly: true, dpr: .25, workers, frames: idx.map(i => ({ f: i / 2, path: join(p.refDir, `${pad(i)}.png`) })) });
          const keep = rangeAB ? readJSON(p.log, null) : null, keepPages = rangeAB ? readJSON(p.pages, null) : null;
          const shotLog = keep && keep.length === tl.frames ? keep : new Array(tl.frames).fill(null);
          const pagesArr = keepPages && keepPages.length === tl.frames ? keepPages : new Array(tl.frames).fill(null);
          idx.forEach((i, k) => { shotLog[i] = res.log[k]; pagesArr[i] = res.pages[k]; });
          writeFileSync(p.log, JSON.stringify(shotLog)); writeFileSync(p.pages, JSON.stringify(pagesArr));
          const prev = rangeAB ? readJSON(p.aud, []) : [];
          writeFileSync(p.aud, JSON.stringify([...prev.filter(a => !res.audits.some(b => b.shot === a.shot)), ...res.audits]));
          // fingerprints: a shot is current only if this render covered all of its frames
          for (const sh of tl.shots) { const [a, b] = span(sh); if (!rangeAB || (rangeAB[0] <= a && rangeAB[1] >= b)) prints[sh.id] = cur[sh.id]; }
          writeFileSync(p.render, JSON.stringify({ prints }));
        }
        const pngs = existsSync(p.fdir) ? readdirSync(p.fdir).filter(f => f.endsWith('.png')).length : 0;
        const again = `--film${cut === 'main' ? '' : ` --cut ${cut}`} --aspect ${aspect}`;
        if (!existsSync(p.log) || pngs < tl.frames) die(`frames for ${cut} ${aspect}: ${pngs}/${tl.frames} on disk (never rendered, or deleted after sign-off) — run ${again}`);
        if (pngs > tl.frames) die(`frames for ${cut} ${aspect}: ${pngs} on disk for a ${tl.frames}-frame timeline (its length changed) — run ${again} (a --range render can't fix this)`);
        const stale = staleShots(tl, readJSON(p.render, {}).prints, cur);
        if (stale.length) die(`frames for ${cut} ${aspect} don't match beats.yaml / assets / engine any more: ${stale.map(x => `${x.id} (frames ${x.from}–${x.to})`).join(', ')}\n  re-render with --film${stale.length < tl.shots.length ? `, or per shot: ${stale.map(x => `--film --range ${x.from},${x.to}`).join(' ; ')}` : ''}`);
      }
      // 2 · audio
      const adir = join(outDir(job, cut), 'audio');
      if (doAudio) { step(`audio ${cut} (${tl.music.style}, ${tl.bpm} BPM${tl.music.style === 'track' ? `, ${tl.music.file} from ${tl.music.start}s` : `, key ${tl.music.key}`})`); buildAudio(job, tl, adir); step('master −14 LUFS, ≤ −1 dBTP after AAC'); master(adir, tl.dur); }
      if (!existsSync(join(adir, 'master.wav'))) die(`no master for "${cut}" — run --film first`);
      // 3 · mux (records what went into the mp4) → thumbnail → QA
      const masterPrint = readJSON(join(adir, 'master.json'), {}).print ?? null;
      for (const aspect of aspects) {
        const p = P(aspect), mp4 = join(job, name(cut, `-${aspect}.mp4`));
        if (doAudio) {
          step(`mux ${aspect}`); mux({ framesDir: p.fdir, fps: 60, audio: join(adir, 'master.wav'), out: mp4 });
          const st = statSync(mp4);
          writeFileSync(join(p.dir, 'mux.json'), JSON.stringify({ frames: readJSON(p.render, {}).prints, audio: masterPrint, mp4: { size: st.size, sha: fileSha(mp4) } }));
          const thumbShot = tl.shots.find(sh => sh.id === spec.thumbnail) || tl.shots.find(sh => sh.block === 'endcard') || tl.shots[0];
          thumbnail(join(p.fdir, `${pad(Math.round((thumbShot.f0 + thumbShot.heroF) * 2))}.png`), join(job, name(cut, `-${aspect}-thumb.jpg`)), ASPECTS[aspect].W);
        }
        step(`QA ${cut} ${aspect}`);
        const r = qaFilm({ tl, aspect, dir: p.dir, audioDir: adir, mp4, shotLog: readJSON(p.log, []), audits: readJSON(p.aud, []), pages: readJSON(p.pages, null), audioPrint: audioPrint(job, tl) });
        if (!r.passed) failed++;
        console.log(`→ ${mp4}`);
      }
      // 4 · the cut's shared deliverables, only once its mp4s carry this master
      if (doAudio) { copyFileSync(join(adir, 'master.wav'), join(job, name(cut, '-master.wav'))); captions(tl, join(job, name(cut, '-captions.srt'))); }
    }
    console.log(`\ndone in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    if (failed) die(`${failed} QA run(s) FAILED — read the FAIL lines above; never ship a FAIL`);
    return;
  }
  if (arg(argv, '--clips', false)) {
    const cut = cuts[0], tl = tlFor(cut), aspect = aspects[0], { W, H } = ASPECTS[aspect];
    const sel = arg(argv, '--clips', true), ids = sel === true || sel === 'all' ? tl.shots.map(s => s.id) : String(sel).split(',');
    const alpha = !!arg(argv, '--alpha', false), webm = !!arg(argv, '--webm', false), fps = Number(arg(argv, '--fps', 30)), clean = !arg(argv, '--with-transitions', false);
    if (![24, 25, 30, 50, 60].includes(fps)) die('--fps must be 24, 25, 30, 50 or 60', 2);
    const adir = join(outDir(job, cut), 'clips-audio');   // never the film's audio folder
    step('SFX stems'); buildAudio(job, tl, adir, { check: false });   // clips use only the SFX stems: music/VO problems don't matter here           // always fresh: a clip's -sfx.wav must match the current timeline
    const cdir = join(job, 'clips'); mkdirSync(cdir, { recursive: true });
    const browser = await launch();
    let bad = 0;
    try {
      for (const id of ids) {
        const s = tl.shots.find(x => x.id === id);
        if (!s) die(`no shot "${id}"`, 2);
        const n = Math.round(s.D / 30 * fps), fdir = join(outDir(job, cut, aspect), 'clips', id);
        rmSync(fdir, { recursive: true, force: true });
        step(`clip ${id} (${s.block}) ${aspect} ${fps} fps${alpha ? ' alpha' : ''}${clean ? ' clean' : ''}: ${n} frames`);
        const frames = Array.from({ length: n }, (_, i) => ({ f: s.f0 + i * 30 / fps, path: join(fdir, `${String(i).padStart(5, '0')}.png`) }));
        const rendered = await renderFrames({ job, tl, aspect, frames, alpha, clean, workers: 4, browser });
        const base = join(cdir, `${spec.slug}-${id}-${aspect}`);
        for (const ext of ['.mp4', '-alpha.mov', '-alpha.webm', '-preview.mp4', '-sfx.wav']) rmSync(base + ext, { force: true });   // no stale leftovers from an earlier export
        if (alpha) { encodeAlpha({ framesDir: fdir, fps, out: base + '-alpha.mov', webm }); previewOver({ mov: base + '-alpha.mov', bg: tl.brand.colors.bg, out: base + '-preview.mp4', W, H, fps }); }
        else mux({ framesDir: fdir, fps, audio: null, out: base + '.mp4', crf: 16 });
        const hasSfx = tl.cues.some(c => c.shot === id);           // a shot without UI cues gets no SFX file (loudnorm can't level silence)
        if (hasSfx) sfxClip({ stem: join(adir, 'points.wav'), start: s.start, dur: n / fps, out: base + '-sfx.wav' });
        const held = s.hold ? [[Math.round(s.hold[0] * fps / 30) + 1, Math.round(s.hold[1] * fps / 30)]] : [];
        let refsDir = null;
        if (!alpha) { refsDir = join(fdir, '..', `${id}-bgref`); rmSync(refsDir, { recursive: true, force: true }); await renderFrames({ job, tl, aspect, clean, bgOnly: true, dpr: .25, workers: 4, browser, frames: frames.map((fr, i) => ({ f: fr.f, path: join(refsDir, `${String(i).padStart(5, '0')}.png`) })) }); }
        const r = qaClip({ mov: alpha ? base + '-alpha.mov' : base + '.mp4', framesDir: fdir, n, fps, alpha, W, H, held, refsDir, pages: rendered.pages, bar: letterboxBar(s.letterbox, W, H) });
        if (r.some(x => !x.pass)) bad++;
        console.log(`→ ${base}${alpha ? '-alpha.mov (+ -preview.mp4' + (webm ? ', .webm' : '') + ')' : '.mp4'}${hasSfx ? ` + ${base}-sfx.wav` : ' (no UI sounds in this shot)'}`);
      }
    } finally { await browser.close(); }
    if (bad) die(`${bad} clip(s) failed QA`);
    return;
  }
  if (arg(argv, '--layers', false)) {
    const cut = cuts[0], tl = tlFor(cut), aspect = aspects[0], { W, H } = ASPECTS[aspect];
    const sel = arg(argv, '--layers', true), ids = sel === true || sel === 'all' ? tl.shots.map(s => s.id) : String(sel).split(',');
    const alpha = !!arg(argv, '--alpha', false), webm = !!arg(argv, '--webm', false), fps = Number(arg(argv, '--fps', 30)), clean = !arg(argv, '--with-transitions', false);
    if (![24, 25, 30, 50, 60].includes(fps)) die('--fps must be 24, 25, 30, 50 or 60', 2);
    for (const id of ids) if (!tl.shots.some(x => x.id === id)) die(`no shot "${id}" (have: ${tl.shots.map(s => s.id).join(', ')})`, 2);
    const adir = join(outDir(job, cut), 'clips-audio');   // never the film's audio folder
    step('SFX stems'); buildAudio(job, tl, adir, { check: false });
    const pad = i => String(i).padStart(5, '0');
    const runEncode = limiter(LAYER_ENCODES);
    let bad = 0, browsers = [], browser = null, server = null, runPass = null;
    try {
      const launched = await Promise.allSettled(Array.from({ length: LAYER_BROWSERS }, () => launch()));
      browsers = launched.filter(x => x.status === 'fulfilled').map(x => x.value); browser = browsers[0];
      for (const x of launched) if (x.status === 'rejected') throw x.reason;
      server = await serve(job);
      runPass = takeTurns(browsers);
      extractPlates(job, tl, aspect);       // footage frames once, before passes run side by side (each pass checks them, none re-extracts)
      for (const id of ids) {
        const s = tl.shots.find(x => x.id === id), n = Math.round(s.D / 30 * fps);
        const work = join(outDir(job, cut, aspect), 'layers', id);
        rmSync(work, { recursive: true, force: true });
        const comp = {};          // per pass: Chrome's composited-layer count per frame (> 1 = it composited part of the frame on its own)
        const R = async (sub, o, browser, stage) => { const res = await renderFrames({ job, tl, aspect, clean, workers: 4, browser, stage, layerTree: true, frames: Array.from({ length: n }, (_, i) => ({ f: s.f0 + i * 30 / fps, path: join(work, sub, `${pad(i)}.png`) })), ...o }); comp[sub] = res.composited; return res; };
        step(`layers ${id} (${s.block}) ${aspect} ${fps} fps${clean ? ' clean' : ''}${alpha ? ' alpha' : ''}: ${n} frames`);
        // Every pass draws the same frames in the same per-page runs after the same warm-up as the flattened reference
        // (Chrome's compositing is history-dependent), so the passes are independent: one per Chrome at a time,
        // LAYER_BROWSERS Chromes side by side, each keeping its pages for its next pass of the same kind (a stage, see
        // openStage in render.mjs); each pass's frames are encoded as soon as it is done. Layer movs go to the work folder
        // and replace the delivered folder once every pass succeeded.
        const deliver = join(work, 'deliver'), t1 = Date.now(), passes = [], encodes = [], stages = new Map(), queued = { true: 0, false: 0 };
        mkdirSync(deliver, { recursive: true });
        // a bg shot's footage is its own layer (01-footage, over the brand background) in opaque exports; --alpha leaves it out
        const foot = !alpha && hasBg(s);
        let nPass = alpha ? 1 : 3 + (foot ? 1 : 0), done = 0;
        const pass = (sub, o, out, enc = {}) => {
          const kind = !!o.alpha;
          comp[sub] = null;         // keys in pass order, whichever finishes first
          queued[kind]++;
          passes.push(runPass(async browser => {
            queued[kind]--;
            const key = `${browsers.indexOf(browser)}:${kind}`;
            if (!stages.has(key)) stages.set(key, openStage());
            const res = await R(sub, o, browser, stages.get(key));
            if (!kind && !queued[kind]) { await closeStage(stages.get(key)); stages.delete(key); }   // the opaque passes are queued first
            console.log(`  ${String(++done).padStart(2)}/${nPass} ${sub.replace(/^L-/, '')} rendered  ${((Date.now() - t1) / 1000).toFixed(1)}s`);
            encodes.push(runEncode(() => encodeAlphaAsync({ framesDir: join(work, sub), fps, out, ...enc })));
            return res;
          }));
        };
        pass('ref-alpha', { alpha: true, probe: true }, join(work, 'ref-alpha.mov'));
        if (!alpha) { pass('ref-opaque', {}, join(work, 'ref-opaque.mov')); pass('L-background', { bgOnly: 'brand' }, join(deliver, '00-background.mov'), { webm }); }
        if (foot) pass('L-footage', { alpha: true, layer: 'footage' }, join(deliver, '01-footage.mov'), { webm });
        const settle = async list => { for (let k = 0; k < list.length; k++) await list[k].catch(() => null); for (const p of list) await p; };   // wait for all, then throw the first failure
        let found, elements;
        try {
          ({ layers: found, elements } = (await passes[0]).layers[id]);
          console.log(`  back to front: ${found.map(l => l.name).join(', ')}`);
          nPass += found.length;
          found.forEach((l, k) => pass(`L-${l.name}`, { alpha: true, layer: l.name }, join(deliver, `${String(k + 1 + (foot ? 1 : 0)).padStart(2, '0')}-${l.name}.mov`), { webm }));
        } finally { await settle(passes).finally(() => Promise.allSettled([...stages.values()].map(closeStage))); await settle(encodes); }
        const ref = await passes[0];
        // deliver: DIR/layers/<slug>-<id>-<aspect>/ NN-<layer>.mov (+ .webm) · -sfx.wav · manifest.json · .jsx · -preview.mp4 · -layers.png
        const base = `${spec.slug}${cut === 'main' ? '' : '-' + cut}-${id}-${aspect}`, folder = join(job, 'layers', base);   // a cutdown never overwrites the main cut's export
        rmSync(folder, { recursive: true, force: true }); mkdirSync(folder, { recursive: true });
        step(`deliver ${found.length + (alpha ? 0 : 1) + (foot ? 1 : 0)} layers → ${folder}`);
        const list = [...(alpha ? [] : [{ name: 'background', kind: 'background' }]), ...(foot ? [{ name: 'footage', kind: 'footage' }] : []),
          ...found.map(l => ({ name: l.name, kind: l.name === 'content' ? 'content' : ['transition', 'letterbox'].includes(l.name) ? l.name : l.text ? 'text' : 'element' }))];
        const layers = list.map((l, i) => {
          const nn = String(alpha ? i + 1 : i).padStart(2, '0'), file = `${nn}-${l.name}.mov`;
          for (const f of [file, ...(webm ? [file.replace(/\.mov$/, '.webm')] : [])]) renameSync(join(deliver, f), join(folder, f));
          return { n: Number(nn), name: l.name, file, ...(webm ? { webm: file.replace(/\.mov$/, '.webm') } : {}), kind: l.kind };
        });
        rmSync(deliver, { recursive: true, force: true });
        const hasSfx = tl.cues.some(c => c.shot === id);
        if (hasSfx) sfxClip({ stem: join(adir, 'points.wav'), start: s.start, dur: n / fps, out: join(folder, `${base}-sfx.wav`) });
        const manifest = { tool: 'product-launch-sting lv.mjs --layers', title: spec.title, slug: spec.slug, shot: id, block: s.block, cut, aspect, width: W, height: H, fps, frames: n,
          duration: +(n / fps).toFixed(4), alpha, clean, order: 'back to front: layers[0] is the bottom of the stack', elements,
          layers, sfx: hasSfx ? `${base}-sfx.wav` : null, ae: `${base}.jsx`, preview: `${base}-preview.mp4`, sheet: `${base}-layers.png` };
        step(`QA layers ${id}`);
        const bg = s.theme === 'dark' || (hasBg(s) && s.theme !== 'light') ? tl.brand.colors.dark : tl.brand.colors.bg;      // what the shot sits on (previews, AE comp colour)
        const preview = stackPreview({ dir: folder, manifest, bg, out: join(folder, `${base}-preview.mp4`) }).then(() => null, e => e);   // encodes during the QA
        // per frame: the camera blur (flattened render) and which passes Chrome composited on its own
        const frameInfo = ref.probes.map((p, i) => ({ cam: p.cam, composited: Math.max(...Object.values(comp).map(c => c[i] || 0)), passes: Object.keys(comp).filter(k => comp[k][i] > 1).map(k => k.replace(/^L-/, '')) }));
        const r = await qaLayers({ dir: folder, manifest, refAlpha: join(work, 'ref-alpha.mov'), refOpaque: alpha ? null : join(work, 'ref-opaque.mov'), frameInfo });
        for (const l of layers) { const st = r.stats.layers[l.name]; if (st) Object.assign(l, { visible: st.first < 0 ? null : [st.first, st.last], bbox: st.bbox }); }
        const { text, skipped } = liveText(ref.probes, found.filter(l => l.text).map(l => l.name));
        for (const l of layers) if (l.kind === 'text') { l.liveText = !!text[l.name]; if (skipped[l.name]) l.liveTextNote = skipped[l.name]; if (text[l.name]) l.copy = text[l.name].map(w => w.t).join(' '); }
        const blurred = ref.probes.some(p => p && p.cam && p.cam.blur >= BLUR_MIN);   // camera motion blur the live text can't carry
        if (blurred) for (const l of layers) if (l.liveText) l.liveTextNote = 'added switched off in the .jsx: this export has camera motion blur that live text cannot reproduce';
        writeJsx({ path: join(folder, `${base}.jsx`), manifest, bg, text, blurred });
        const hero = Math.min(n - 1, Math.round(s.heroF * fps / 30));
        try {
          const failed = await preview;
          if (failed) throw failed;
          await layerSheet({ job, browser, serverBase: server.base, manifest, bg, out: join(work, 'sheet.png'),
            tiles: [{ png: join(work, alpha ? 'ref-alpha' : 'ref-opaque', `${pad(hero)}.png`), tag: 'all', label: 'the finished frame', checker: false, frame: hero },
              ...layers.map(l => {      // each layer at the hero frame, or mid-way through its own visible span if it isn't on screen then
                const f = !l.visible || (hero >= l.visible[0] && hero <= l.visible[1]) ? hero : Math.round((l.visible[0] + l.visible[1]) / 2);
                return { png: join(work, `L-${l.name}`, `${pad(f)}.png`), tag: String(l.n).padStart(2, '0'), label: `${l.name}${f !== hero ? ` · frame ${f}` : ''}`, checker: l.name !== 'background' };
              })] });
          copyFileSync(join(work, 'sheet.png'), join(folder, `${base}-layers.png`));
        } catch (e) { r.passed = false; r.results.push({ name: 'extras', pass: false, detail: `preview/contact sheet failed: ${String(e.message || e).split('\n')[0]}` }); console.log(`FAIL  extras   ${r.results.at(-1).detail}`); }
        manifest.qa = { passed: r.passed, checks: r.results };
        writeFileSync(join(folder, 'manifest.json'), JSON.stringify(manifest, null, 1));
        writeFileSync(join(work, 'qa-stats.json'), JSON.stringify({ stats: r.stats, refAlpha: join(work, 'ref-alpha.mov'), refOpaque: alpha ? null : join(work, 'ref-opaque.mov') }));
        writeFileSync(join(work, 'text-probe.json'), JSON.stringify(ref.probes.map((p, i) => ({ ...p, ...frameInfo[i] }))));   // per frame: word samples, camera blur, compositing
        if (!r.passed) { bad++; writeFileSync(join(folder, 'QA-FAILED.txt'), `These layers failed QA — don't use them:\n${r.results.filter(x => !x.pass).map(x => `${x.name}: ${x.detail}`).join('\n')}\n`); }
        console.log(`→ ${folder}/ (${layers.length} layers${hasSfx ? ', UI sounds' : ''}, ${base}.jsx for After Effects${Object.keys(text).length ? ` with live text for ${Object.keys(text).join(', ')}` : ''})`);
      }
    } finally { await Promise.allSettled(browsers.map(b => b.close())); if (server) await server.close(); }
    if (bad) die(`${bad} shot(s) failed layer QA — read the FAIL lines above; never ship a FAIL`);
    // a Chrome may have woken helpers that outlive it (its crash handler, Google's updater) holding the stdout/stderr it
    // inherited, and Node would wait minutes for them; everything this run started is closed by now
    process.stdout.write('', () => process.stderr.write('', () => process.exit(0)));
    return;
  }
  die('pass one of --init, --grid, --storyboard, --animatic, --film, --audio, --qa, --clips, --layers, --serve, --sheet, --breakdown (or --blocks, --tempo FILE)', 2);
}

// --layers: Chromes rendering passes side by side (a Chrome draws all its pages' frames on one 60 Hz clock, so passes
// sharing a browser only take turns: 6 passes of a 116-frame shot take 20 s in one Chrome, 12 s in 2, 11 s in 3 on a
// 12-core Mac — then the CPU is the limit; each Chrome holds ~3 GB at its peak) and layer encodes at once (ProRes
// ~0.8 GB each)
const LAYER_BROWSERS = Math.max(1, Math.min(3, Math.floor(availableParallelism() / 4), Math.floor(totalmem() / 12e9))), LAYER_ENCODES = LAYER_BROWSERS;
// run the queued async jobs at most n at a time, in the order they were queued
function limiter(n) {
  let active = 0;
  const q = [], next = () => {
    if (active >= n || !q.length) return;
    active++;
    const { fn, res, rej } = q.shift();
    Promise.resolve().then(fn).then(res, rej).finally(() => { active--; next(); });
  };
  return fn => new Promise((res, rej) => { q.push({ fn, res, rej }); next(); });
}
// run the queued async jobs one per resource (fn gets the resource), in the order they were queued
function takeTurns(resources) {
  const free = [...resources], q = [];
  const next = () => {
    if (!free.length || !q.length) return;
    const r = free.shift(), { fn, res, rej } = q.shift();
    Promise.resolve().then(() => fn(r)).then(res, rej).finally(() => { free.push(r); next(); });
  };
  return fn => new Promise((res, rej) => { q.push({ fn, res, rej }); next(); });
}

// starter kits: --init --kit reel|film writes that commented starter (templates/<kit>.yaml) and its placeholder stills
const KITS = { reel: ['card', 'before', 'after'], film: ['clip-1', 'clip-2', 'clip-3', 'clip-4'] };
function init() {
  const kit = arg(argv, '--kit', null);
  if (kit != null && !Object.hasOwn(KITS, String(kit))) die(`--kit must be ${Object.keys(KITS).join(' or ')} (a reel of AI footage + stickers, or a launch film with UI over AI footage)`, 2);
  mkdirSync(join(job, 'assets'), { recursive: true });
  const title = arg(argv, '--title', null);
  for (const f of ['brief.md', 'beats.yaml']) {
    const dst = join(job, f);
    if (existsSync(dst)) { console.log(`${dst} exists — left untouched`); continue; }
    let txt = readFileSync(join(VIDEO, 'templates', f === 'beats.yaml' && kit ? `${kit}.yaml` : f), 'utf8');
    if (title && title !== true) {
      const T = String(title), slug = slugify(T);
      if (f === 'brief.md') txt = txt.replaceAll('Steady', T);
      else if (kit) {                          // a kit starter: set just these lines (keeps its comments and layout)
        const y = v => /^[A-Za-z][\w .'-]*$/.test(v) ? v : JSON.stringify(v);
        txt = txt.replace(/^title: .*$/m, `title: ${y(`${T} ${kit === 'reel' ? 'reel' : 'launch film'}`)}`).replace(/^slug: .*$/m, `slug: ${slug}`)
          .replace(/^(  name: )Product$/m, (_, k) => k + y(T)).replace(/^(  mono: )P$/m, (_, k) => k + (T.match(/[A-Za-z0-9]/) || ['P'])[0].toUpperCase());
      } else {                                   // edit the YAML as YAML (keeps comments; quotes "Acme: The Movie" correctly)
        const doc = YAML.parseDocument(txt);
        doc.set('title', `${T} launch`); doc.set('slug', slug);
        doc.setIn(['brand', 'name'], T); doc.setIn(['brand', 'mono'], (T.match(/[A-Za-z0-9]/) || ['P'])[0].toUpperCase());
        if (!kit) for (const shot of doc.get('shots').items) {
          if (shot.get('name') === 'Steady') shot.set('name', T);
          if (shot.get('url') === 'steady.app') shot.set('url', `${slug}.app`);
        }
        txt = doc.toString();
      }
    }
    writeFileSync(dst, txt);
    console.log(`wrote ${dst}`);
  }
  for (const p of kit ? KITS[kit] : []) {        // stand-in stills the starter points at, until your own images / clips
    const dst = join(job, 'assets', `placeholder-${p}.svg`);
    if (!existsSync(dst)) { copyFileSync(join(VIDEO, 'templates', 'placeholders', `${p}.svg`), dst); console.log(`wrote ${dst}`); }
  }
  console.log(`assets go in ${join(job, 'assets')} (logo.svg, fonts, screenshots, footage, music)`);
  if (kit) console.log(`next: lv.mjs --job ${job} --grid, then --storyboard; drop your AI clips into assets/ and un-comment the bg: lines (GUIDE.md → "Reels and launch films")`);
}

main().catch(e => die(e instanceof UserError ? e.message : (e.stack || String(e))));
