// Drive headless system Chrome (playwright-core, channel 'chrome': nothing is downloaded) over the stage.
// renderFrames() takes a list of {f, path} and returns the shot that produced each frame (+ optional text audits).
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync, statSync, rmSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
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
// --layers pass, for the layer QA's diagnostics); stage: draw on (and leave open) a stage's pages, see openStage
export async function renderFrames({ job, tl, aspect, frames, alpha = false, clean = false, bgOnly = false, layer = null, probe = false, layerTree = false, dpr = 1, workers = 4, audit = new Set(), browser = null, stage = null, onProgress = null }) {
  const { W, H } = ASPECTS[aspect];
  const plates = extractPlates(job, tl, aspect);
  const server = stage ? (stage.server ||= await serve(job)) : await serve(job);
  const own = !browser, contexts = stage ? stage.contexts : [], run = `${process.pid}.${++RUN}`;
  const errors = stage ? stage.errors : [], log = new Array(frames.length), pages = new Array(frames.length), audits = [], probes = probe ? new Array(frames.length) : null;
  const composited = probe || layerTree ? new Array(frames.length) : null;
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
        pages[k] = `${run}:${w}`;                       // which Chrome page drew it: QA treats page seams specially
        mkdirSync(dirname(fr.path), { recursive: true });
        await page.screenshot({ path: fr.path, omitBackground: alpha, type: 'png' });
        if (audit.has(k)) audits.push({ k, f: fr.f, shot: log[k], boxes: await page.evaluate(() => window.LV.audit()) });
        if (composited) composited[k] = page.lvLayers.filter(l => l.drawsContent && l.width * l.height > 0).length;
        if (probes) probes[k] = { ...(await page.evaluate(() => ({ text: window.LV.textProbe(), cam: window.LV.camera() }))), composited: composited[k] };
        if (onProgress && ++done % 120 === 0) onProgress(done, frames.length);
      }
    }));
    const fit = await pagesOpen[0].evaluate(() => window.LV.info().fit), layers = await pagesOpen[0].evaluate(() => window.LV.layers());
    if (errors.length) throw new UserError('page errors:\n' + errors.join('\n'));
    return { log, pages, audits, fit, layers, probes, composited };
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
