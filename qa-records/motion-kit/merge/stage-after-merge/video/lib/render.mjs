// Drive headless system Chrome (playwright-core, channel 'chrome': nothing is downloaded) over the stage.
// renderFrames() takes a list of {f, path} and returns the shot that produced each frame (+ optional text audits).
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync, statSync, rmSync, renameSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { ASPECTS, ff, sh, UserError } from './common.mjs';
import { serve } from './server.mjs';
import { hdrFilter, HDR_TRC } from './hdr.mjs';

export async function launch() {
  let err;
  for (let attempt = 0; attempt < 3; attempt++) {           // a launch can fail transiently while other renders run
    try {
      return await chromium.launch({
        ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }), headless: true,
        args: ['--force-color-profile=srgb', '--hide-scrollbars', '--disable-lcd-text', '--font-render-hinting=none'],
      });
    } catch (e) { err = e; await new Promise(r => setTimeout(r, 1500)); }
  }
  throw new UserError('Could not start Google Chrome after 3 tries (playwright-core channel "chrome"). If Chrome is installed, close other\nrenders and run again; otherwise install Chrome or set CHROME_PATH.\n' + err.message);
}

// footage → JPEG frames at 60 fps under out/<cut>/<aspect>/plates/<key>/ — one plate per footage field the timeline
// lists (timeline.mjs platePlan): media's src (key = shot id, dir plates/<id> as always), the universal bg (`<id>:bg`),
// a block's declared media fields (`<id>:<field>`, `<id>:<field>.<i>`; dirs use ~ for the colon). cover = cover-cropped
// to the stage (× scale), contain = whole, scaled to fit inside the stage (media's src: footage in a phone/browser keeps its
// shape) or, for a block's field, inside a square of scale × the stage's longer side. HDR footage
// (HLG / PQ) is converted to SDR BT.709. A manifest per plate records what it was cut from; any change (file replaced,
// from, shot length, aspect, fit) re-extracts, anything else is a no-op — so it is safe to call again before every pass.
const isVideo = p => /\.(mp4|mov|m4v|webm|mkv)$/i.test(p || '');
const legacyPlan = tl => tl.shots.filter(s => s.block === 'media' && isVideo(s.src)).map(s => ({ key: s.id, field: 'src', src: s.src, from: Number(s.from || 0), fit: s.device && s.device !== 'none' ? 'contain' : 'cover', shot: s.id }));
export function extractPlates(job, tl, aspect) {
  const { W: SW, H: SH } = ASPECTS[aspect], plates = {};
  for (const pl of tl.plates || legacyPlan(tl)) {
    // a block's `contain` field (a card, a panel) keeps the file whole: it fits a square of scale × the stage's longer side,
    // whatever its own shape or the stage's (a 16:9 clip in a 9:16 film keeps its full width); media's own src keeps the stage box
    const even = x => Math.max(2, 2 * Math.round(x / 2)), sq = pl.fit === 'contain' && pl.field !== 'src', L = Math.max(SW, SH) * (pl.scale || 1);
    const W = sq ? even(L) : pl.scale ? even(SW * pl.scale) : SW, H = sq ? even(L) : pl.scale ? even(SH * pl.scale) : SH;
    const s = tl.shots.find(x => x.id === pl.shot);
    if (!s || plates[pl.key]) continue;
    const rel = join('out', tl.id, aspect, 'plates', pl.key.replace(/:/g, '~')), dir = join(job, rel), src = join(job, pl.src);
    const st = statSync(src), need = Math.ceil(s.D * 2);           // indices 0 … 2D-1 at 60 fps
    const trc = sh('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=color_transfer', '-of', 'csv=p=0', src]).stdout.trim();
    const fit = pl.fit;
    // media's manifest keeps its old shape (existing caches stay valid); other plates also record their key
    const want = { ...(pl.key === s.id ? {} : { key: pl.key }), src: pl.src, size: st.size, mtime: Math.round(st.mtimeMs), from: Number(pl.from || 0), W, H, need, fit, hdr: HDR_TRC[trc] ? `${trc}:v1` : null };
    const metaPath = join(dir, 'plates.json');
    let have = null;
    try { have = JSON.parse(readFileSync(metaPath, 'utf8')); } catch { /* missing or half-written manifest = cache miss */ }
    if (!have || JSON.stringify(have) !== JSON.stringify(want)) {
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      ff(['-ss', String(want.from), '-i', src, '-t', String(need / 60 + .1),
        '-vf', `${hdrFilter(trc)}fps=60,${fit === 'cover' ? `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}` : `scale=${W}:${H}:force_original_aspect_ratio=decrease:force_divisible_by=2`}`,
        '-q:v', '3', '-start_number', '0', join(dir, '%05d.jpg')], `extract footage for ${pl.key}`);
      if (want.hdr) console.log(`  ${s.id}: ${pl.src} is ${HDR_TRC[trc]} HDR — converted to SDR (BT.709). For the closest match to the phone's own look, film with HDR Video off.`);
      writeFileSync(metaPath + '.tmp', JSON.stringify(want)); renameSync(metaPath + '.tmp', metaPath);   // atomic
    }
    const n = readdirSync(dir).filter(f => f.endsWith('.jpg')).length;
    if (n < need) {
      const len = Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).stdout.trim());
      const what = pl.field === 'src' ? `media ${s.id}: ${pl.src}` : `${s.id} ${pl.field}: ${pl.src}`, fromK = pl.field === 'src' ? 'from' : `${pl.field.replace(/\.\d+$/, '')}From`;
      throw new UserError(`${what} is too short — the shot needs ${(s.D / 30).toFixed(2)} s from ${want.from} s, the file has ${len.toFixed(2)} s in total. Lower \`${fromK}\`, shorten the shot, or use a longer clip.`);
    }
    plates[pl.key] = { url: '/job/' + rel.split('\\').join('/'), n };
  }
  return plates;
}

// --layers: a stage keeps a pass's pages open for the shot's later passes on the same Chrome (same `alpha`). Each of
// those switches the layer (LV.setLayer) or background-only (LV.setBgOnly: every shot's .lv-content hidden, as the
// runtime does for bgOnly at build; 'brand' also hides bg footage, overlays and bars), seeks frame 0
// and warms up exactly as a page does after it is built, then draws the same contiguous run of frames per page as every
// other pass — pixel-identical to fresh pages on the whole layer QA sweep, minus a page build per pass. (Warming up only
// the shot being drawn is not: Chrome then composites differently in some runs.) Pass `stage: openStage()` to
// renderFrames; closeStage() when done.
export const openStage = () => ({ pages: null, contexts: [], errors: [], server: null, alpha: null, layer: null, bgOnly: null });
export async function closeStage(st) {
  await Promise.allSettled(st.contexts.map(c => c.close()));
  if (st.server) await st.server.close();
  Object.assign(st, openStage());
}

let RUN = 0;
// layer: draw only that layer (--layers); probe: after every frame, sample the text layers' words (After Effects live text),
// the camera's motion blur and how many layers Chrome composited; layerTree: record only that composited count (every
// --layers pass, for the layer QA's diagnostics); stage: draw on (and leave open) a stage's pages, see openStage;
// textless: a folder — once a page has drawn all of its frames, it goes back to each audited frame it drew, shoots it
// again as drawn (it must match the saved frame), with every glyph hidden (LV.hideText, for the contrast check) and with
// every glyph solid black / white (-ink0 / -ink1: the glyph coverage) and, when the frame has must-read text with a
// text-shadow, with the glyphs hidden but their shadows kept (-shadow), then switches back: the film frames are never
// drawn with the switch on. Same file name as the frame; a re-shot frame that
// isn't byte-identical to the saved one is kept as <name>-real.png and the contrast check reads it instead.
// sigs: after each frame, a hash of the page's visible DOM state (the shown shot, the stage overlays, the SVG filters it
// uses, every canvas' pixels), then every frame of the page is sought again in reverse order and hashed again (sigs2) —
// a frame whose state differs between the two orders comes from a block with state left by earlier frames (purity
// check). Only what can show counts: an element at opacity 0 or display: none is skipped with everything inside it, a
// visibility: hidden one without its own attributes (a hidden cursor that keeps its last position isn't state anyone
// sees). The engine's filter bank (#lv-fx) grows lazily (a shot's blur filter is created the first time it blurs), so
// only the filters the frame references count.
const domSig = () => {
  const vis = [...document.querySelectorAll('.lv-shot')].find(e => e.style.display !== 'none');
  const ser = el => {
    if (!el) return '';
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.opacity === '0') return '<~>';
    let out = `<${el.tagName}`;
    if (cs.visibility !== 'hidden') for (const a of el.attributes) out += ` ${a.name}="${a.value}"`;
    out += '>';
    for (const n of el.childNodes) out += n.nodeType === 1 ? ser(n) : n.nodeType === 3 ? n.textContent : '';
    return out + '</>';
  };
  const parts = [vis, document.querySelector('.lv-ovl'), document.querySelector('.lv-lbox')].map(ser);
  const refs = [...new Set(parts.join('').match(/url\(["']?#[^)"']+/g) || [])].map(r => r.replace(/^url\(["']?#/, ''));
  let s = [...parts, ...refs.map(id => { const e = document.getElementById(id); return e ? e.outerHTML : ''; })].join('\u0001');
  for (const c of vis ? vis.querySelectorAll('canvas') : []) { try { s += c.toDataURL(); } catch { s += '?'; } }
  let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `${(h >>> 0).toString(16)}:${s.length}`;
};
// anims: after each frame, the CSS transitions / animations / Web Animations still running on the page (null when none)
// as "property@layer" — they run on the wall clock, not on t, so what a frame shows depends on how long ago the previous
// one was drawn (rule 2; the engine itself uses none). The DOM signature can't see them: the style attribute is the
// same, only the painted value lags. An animation on an element of a hidden shot (display: none) paints nothing and
// isn't listed: a Web Animation (el.animate) keeps "running" there, and would be blamed on every shot of the film
// (verify pass; read from inline styles only, no layout).
const animSig = () => {          // (runs in the page: everything it uses is defined inside it)
  const inHiddenShot = t => { const s = t && t.closest ? t.closest('.lv-shot') : null; return !!s && s.style.display === 'none'; };
  const a = document.getAnimations().filter(x => (x.playState === 'running' || x.pending) && !inHiddenShot(x.effect && x.effect.target));
  if (!a.length) return null;
  const where = t => { for (let n = t; n; n = n.parentElement) if (n.dataset && n.dataset.lvLayer) return n.dataset.lvLayer; return t ? t.tagName.toLowerCase() : '?'; };
  return [...new Set(a.map(x => `${x.transitionProperty || x.animationName || x.constructor.name}@${where(x.effect && x.effect.target)}`))].sort().join(', ');
};
export async function renderFrames({ job, tl, aspect, frames, alpha = false, clean = false, bgOnly = false, layer = null, probe = false, layerTree = false, dpr = 1, workers = 4, audit = new Set(), browser = null, stage = null, onProgress = null, textless = null, sigs: wantSigs = false, anims: wantAnims = false }) {
  const { W, H } = ASPECTS[aspect];
  const plates = extractPlates(job, tl, aspect);
  const server = stage ? (stage.server ||= await serve(job)) : await serve(job);
  const own = !browser, contexts = stage ? stage.contexts : [], run = `${process.pid}.${++RUN}`;
  const errors = stage ? stage.errors : [], log = new Array(frames.length), pages = new Array(frames.length), audits = [], probes = probe ? new Array(frames.length) : null;
  // LV.camera() per frame drawn ({s, x, y, blur} + any key the engine adds, e.g. carry): --film's cams.json. Only full-picture
  // passes log it (not the bg-only content references, clean clips or layer passes: one evaluate a frame saved)
  const cams = !bgOnly && !clean && !layer && !layerTree && !probe ? new Array(frames.length) : null;
  const composited = probe || layerTree ? new Array(frames.length) : null;
  const sigs = wantSigs ? new Array(frames.length) : null, sigs2 = wantSigs ? new Array(frames.length) : null;
  const anims = wantAnims ? new Array(frames.length).fill(null) : null;
  errors.length = 0;
  try {
  browser = browser || await launch();
  const inject = { timeline: tl, aspect, plates, alpha, clean, bgOnly, layer };
  const warm = async page => { for (const s of tl.shots) { await page.evaluate(x => window.LV.seek(x), s.f0 + s.heroF); await page.screenshot({ omitBackground: alpha }); } };   // warm caches
  async function openPage() {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
    contexts.push(ctx);
    await ctx.addInitScript({ content: `window.__LV__ = ${JSON.stringify(inject)};` });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400 && !/favicon\.ico$/.test(r.url())) errors.push(`HTTP ${r.status()} ${decodeURI(r.url().replace(/^https?:\/\/[^/]+/, ''))}`); });
    await page.goto(`${server.base}/skill/video/engine/stage.html`);
    try { await page.evaluate(() => window.LV.ready); }
    catch (e) { throw new UserError('stage failed to build: ' + String(e.message).split('\n')[0] + (errors.length ? '\n' + errors.join('\n') : '')); }
    if (composited || stage) {   // Chrome's composited layers as of the last frame drawn (DevTools LayerTree; enabled once the page is up)
      const cdp = await ctx.newCDPSession(page); page.lvLayers = [];
      cdp.on('LayerTree.layerTreeDidChange', e => { if (e.layers) page.lvLayers = e.layers; });
      await cdp.send('LayerTree.enable');
    }
    await warm(page);
    if (errors.length) throw new UserError('page errors while loading the stage (fix these before rendering):\n' + errors.join('\n'));
    return page;
  }
    const nPages = Math.max(1, Math.min(workers, frames.length));
    let pagesOpen;
    if (stage && stage.pages) {
      if (stage.alpha !== alpha || stage.pages.length !== nPages) throw new Error(`a stage opened with alpha=${stage.alpha} on ${stage.pages.length} pages can't draw alpha=${alpha} on ${nPages}`);
      pagesOpen = stage.pages;
      await Promise.all(pagesOpen.map(async page => {
        if (layer !== stage.layer) await page.evaluate(x => window.LV.setLayer(x), layer);
        if (bgOnly !== stage.bgOnly) await page.evaluate(x => window.LV.setBgOnly(x), bgOnly);   // what bgOnly does at build (true / 'brand')
        await page.evaluate(() => window.LV.seek(0));      // as LV.ready ends after a build
        await warm(page);
      }));
      if (errors.length) throw new UserError('page errors:\n' + errors.join('\n'));
    } else {
      pagesOpen = await Promise.all(Array.from({ length: nPages }, openPage));
      if (stage) Object.assign(stage, { pages: pagesOpen, alpha });
    }
    if (stage) Object.assign(stage, { layer, bgOnly });
    // each page renders one contiguous run of frames: neighbouring frames come from the same Chrome page, so a frozen
    // frame is bit-identical (pages differ by ±1 code value of raster noise, which would hide freezes from QA)
    const per = Math.ceil(frames.length / pagesOpen.length);
    let done = 0;
    await Promise.all(pagesOpen.map(async (page, w) => {
      for (let k = w * per; k < Math.min(frames.length, (w + 1) * per); k++) {
        const fr = frames[k];
        log[k] = await page.evaluate(x => window.LV.seek(x), fr.f);
        if (cams) cams[k] = await page.evaluate(() => window.LV.camera());
        pages[k] = `${run}:${w}`;                       // which Chrome page drew it: QA treats page seams specially
        // before the screenshot: getAnimations() brings the style up to date, so a transition this seek set off is listed
        // however short it is (after the screenshot a short one would already be over)
        if (anims) anims[k] = await page.evaluate(animSig);
        mkdirSync(dirname(fr.path), { recursive: true });
        await page.screenshot({ path: fr.path, omitBackground: alpha, type: 'png' });
        if (audit.has(k)) audits.push({ k, f: fr.f, shot: log[k], boxes: await page.evaluate(() => window.LV.audit()) });
        if (composited) composited[k] = page.lvLayers.filter(l => l.drawsContent && l.width * l.height > 0).length;
        if (probes) probes[k] = { ...(await page.evaluate(() => ({ text: window.LV.textProbe(), cam: window.LV.camera() }))), composited: composited[k] };
        if (sigs) sigs[k] = await page.evaluate(domSig);
        if (onProgress && ++done % 120 === 0) onProgress(done, frames.length);
      }
      if (sigs) for (let k = Math.min(frames.length, (w + 1) * per) - 1; k >= w * per; k--) { await page.evaluate(x => window.LV.seek(x), frames[k].f); sigs2[k] = await page.evaluate(domSig); }
      // (after every film frame of this page: a failure here can't touch them; it is recorded for the contrast check)
      if (textless) for (let k = w * per; k < Math.min(frames.length, (w + 1) * per); k++) {
        if (!audit.has(k)) continue;
        const fr = frames[k], name = basename(fr.path), a = audits.find(x => x.k === k);
        try {
          await page.evaluate(x => window.LV.seek(x), fr.f);
          const again = await page.screenshot({ omitBackground: alpha, type: 'png' }), same = again.equals(readFileSync(fr.path));
          mkdirSync(textless, { recursive: true });
          if (!same) writeFileSync(join(textless, name.replace(/\.png$/, '-real.png')), again);
          await page.evaluate(() => window.LV.hideText(true));
          await page.screenshot({ path: join(textless, name), omitBackground: alpha, type: 'png' });
          // glyph coverage: every glyph solid black, then solid white (their difference = how much of a pixel is glyph)
          const ink = [0, 1].map(i => name.replace(/\.png$/, `-ink${i}.png`));
          for (const [i, mode] of [[0, 'black'], [1, 'white']]) { await page.evaluate(x => window.LV.hideText(x), mode); await page.screenshot({ path: join(textless, ink[i]), omitBackground: alpha, type: 'png' }); }
          // shadowed / haloed must-read text: also the glyphs hidden with their shadows kept (what such a line is read against)
          const shadow = a && a.boxes.some(b => b.shadowed && !b.ui) ? name.replace(/\.png$/, '-shadow.png') : null;
          if (shadow) { await page.evaluate(() => window.LV.hideText('shadow')); await page.screenshot({ path: join(textless, shadow), omitBackground: alpha, type: 'png' }); }
          await page.evaluate(() => window.LV.hideText(false));
          if (a) Object.assign(a, { frame: name, textless: name, ink, ...(shadow ? { shadow } : {}), ...(same ? {} : { real: name.replace(/\.png$/, '-real.png') }) });
        } catch (e) {
          if (a) a.textlessError = String(e.message || e).split('\n')[0].slice(0, 200);
          await page.evaluate(() => window.LV.hideText(false)).catch(() => null);
        }
      }
    }));
    const fit = await pagesOpen[0].evaluate(() => window.LV.info().fit), layers = await pagesOpen[0].evaluate(() => window.LV.layers());
    if (errors.length) throw new UserError('page errors:\n' + errors.join('\n'));
    return { log, pages, audits, fit, layers, probes, composited, cams, sigs, sigs2, anims };
  } finally {
    // close every context this call opened (a shared browser otherwise accumulates them across clips and Chrome stalls)
    if (!stage) await Promise.allSettled(contexts.map(c => c.close()));
    if (own && browser) await browser.close().catch(() => null);
    if (!stage) await server.close();
  }
}

// one PNG per shot at its hero frame (storyboard); returns paths
export async function renderHeroes({ job, tl, aspect, outDir, alpha = false }) {
  const frames = tl.shots.map(s => ({ f: s.f0 + s.heroF, path: join(outDir, `${String(s.i + 1).padStart(2, '0')}-${s.id}.png`) }));
  const res = await renderFrames({ job, tl, aspect, frames, alpha, workers: 2, audit: new Set(frames.map((_, k) => k)) });
  return { paths: frames.map(x => x.path), ...res };
}
