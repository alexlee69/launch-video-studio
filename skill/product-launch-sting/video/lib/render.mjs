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

const isVideo = p => /\.(mp4|mov|m4v|webm|mkv)$/i.test(p || '');
// footage for media blocks → JPEG frames at 60 fps under out/<cut>/<aspect>/plates/<shot>/: full-bleed footage is
// cover-cropped to the stage; footage inside a phone/browser keeps its own shape (the device screen crops it once).
// HDR footage (HLG / PQ) is converted to SDR BT.709. A manifest records what they were cut from; any change (file
// replaced, `from`, shot length, aspect, device) re-extracts.
export function extractPlates(job, tl, aspect) {
  const { W, H } = ASPECTS[aspect], plates = {};
  for (const s of tl.shots.filter(s => s.block === 'media' && isVideo(s.src))) {
    const rel = join('out', tl.id, aspect, 'plates', s.id), dir = join(job, rel), src = join(job, s.src);
    const st = statSync(src), need = Math.ceil(s.D * 2);           // indices 0 … 2D-1 at 60 fps
    const trc = sh('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=color_transfer', '-of', 'csv=p=0', src]).stdout.trim();
    const fit = s.device && s.device !== 'none' ? 'contain' : 'cover';
    const want = { src: s.src, size: st.size, mtime: Math.round(st.mtimeMs), from: Number(s.from || 0), W, H, need, fit, hdr: HDR_TRC[trc] ? `${trc}:v1` : null };
    const metaPath = join(dir, 'plates.json');
    let have = null;
    try { have = JSON.parse(readFileSync(metaPath, 'utf8')); } catch { /* missing or half-written manifest = cache miss */ }
    if (!have || JSON.stringify(have) !== JSON.stringify(want)) {
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      ff(['-ss', String(want.from), '-i', src, '-t', String(need / 60 + .1),
        '-vf', `${hdrFilter(trc)}fps=60,${fit === 'cover' ? `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}` : `scale=${W}:${H}:force_original_aspect_ratio=decrease:force_divisible_by=2`}`,
        '-q:v', '3', '-start_number', '0', join(dir, '%05d.jpg')], `extract footage for ${s.id}`);
      if (want.hdr) console.log(`  ${s.id}: ${s.src} is ${HDR_TRC[trc]} HDR — converted to SDR (BT.709). For the closest match to the phone's own look, film with HDR Video off.`);
      writeFileSync(metaPath + '.tmp', JSON.stringify(want)); renameSync(metaPath + '.tmp', metaPath);   // atomic
    }
    const n = readdirSync(dir).filter(f => f.endsWith('.jpg')).length;
    if (n < need) {
      const len = Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).stdout.trim());
      throw new UserError(`media ${s.id}: ${s.src} is too short — the shot needs ${(s.D / 30).toFixed(2)} s from ${want.from} s, the file has ${len.toFixed(2)} s in total. Lower \`from\`, shorten the shot, or use a longer clip.`);
    }
    plates[s.id] = { url: '/job/' + rel.split('\\').join('/'), n };
  }
  return plates;
}

let RUN = 0;
// layer: draw only that layer (--layers); probe: after every frame, sample the text layers' words (After Effects live text),
// the camera's motion blur and how many layers Chrome composited; layerTree: record only that composited count (every
// --layers pass, for the layer QA's diagnostics)
export async function renderFrames({ job, tl, aspect, frames, alpha = false, clean = false, bgOnly = false, layer = null, probe = false, layerTree = false, dpr = 1, workers = 4, audit = new Set(), browser = null, onProgress = null }) {
  const { W, H } = ASPECTS[aspect];
  const plates = extractPlates(job, tl, aspect);
  const server = await serve(job);
  const own = !browser, contexts = [], run = `${process.pid}.${++RUN}`;
  const errors = [], log = new Array(frames.length), pages = new Array(frames.length), audits = [], probes = probe ? new Array(frames.length) : null;
  const composited = probe || layerTree ? new Array(frames.length) : null;
  try {
  browser = browser || await launch();
  const inject = { timeline: tl, aspect, plates, alpha, clean, bgOnly, layer };
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
    if (composited) {   // Chrome's composited layers as of the last frame drawn (DevTools LayerTree; enabled once the page is up)
      const cdp = await ctx.newCDPSession(page); page.lvLayers = [];
      cdp.on('LayerTree.layerTreeDidChange', e => { if (e.layers) page.lvLayers = e.layers; });
      await cdp.send('LayerTree.enable');
    }
    for (const s of tl.shots) { await page.evaluate(x => window.LV.seek(x), s.f0 + s.heroF); await page.screenshot({ omitBackground: alpha }); }   // warm caches
    if (errors.length) throw new UserError('page errors while loading the stage (fix these before rendering):\n' + errors.join('\n'));
    return page;
  }
    const pagesOpen = await Promise.all(Array.from({ length: Math.max(1, Math.min(workers, frames.length)) }, openPage));
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
    await Promise.allSettled(contexts.map(c => c.close()));
    if (own && browser) await browser.close().catch(() => null);
    await server.close();
  }
}

// one PNG per shot at its hero frame (storyboard); returns paths
export async function renderHeroes({ job, tl, aspect, outDir, alpha = false }) {
  const frames = tl.shots.map(s => ({ f: s.f0 + s.heroF, path: join(outDir, `${String(s.i + 1).padStart(2, '0')}-${s.id}.png`) }));
  const res = await renderFrames({ job, tl, aspect, frames, alpha, workers: 2, audit: new Set(frames.map((_, k) => k)) });
  return { paths: frames.map(x => x.path), ...res };
}
