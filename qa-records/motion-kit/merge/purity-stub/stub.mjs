// purity-stub: decision (i) both ways, with a stub renderer (no Chrome). A frame that differs in the check's own render
// but matches when drawn again with the same predecessors must not warn; one that differs both times must.
//   node stub.mjs <video dir> <job> <workdir>
import { mkdirSync, copyFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
const [V, job, W0] = process.argv.slice(2);
const { loadSpec } = await import(V + '/lib/spec.mjs'), { compile } = await import(V + '/lib/timeline.mjs'), { purityRun, purityFrames } = await import(V + '/lib/qa.mjs');
const tl = compile(await loadSpec(job), 'main'), here = dirname(new URL(import.meta.url).pathname);
const good = join(here, 'good.png'), bad = join(here, 'bad.png');
const order = purityFrames(tl), X = order[3], SEAM = 450;           // a sampled frame, and a worker seam inside a shot
const pad = i => String(i).padStart(5, '0');
function scenario(name, { againGood }) {
  const dir = join(W0, name); rmSync(dir, { recursive: true, force: true }); mkdirSync(join(dir, 'frames'), { recursive: true });
  for (let i = 0; i < tl.frames; i++) copyFileSync(good, join(dir, 'frames', `${pad(i)}.png`));   // the film: all good
  const render = async ({ frames }) => {
    for (const f of frames) {
      mkdirSync(dirname(f.path), { recursive: true });
      const i = Math.round(f.f * 2), again = f.path.includes('/again/'), replay = f.path.includes('/replay/') && !f.path.includes('/pre/');
      // shuffled pass: X glitches; replay (in order): X and the seam glitch; again: good (one-off) or bad (repeatable)
      const isBad = again ? !againGood && !f.path.includes('/pre/') : replay ? (i === X || i === SEAM) : (i === X && !f.path.includes('/replay/'));
      copyFileSync(isBad ? bad : good, f.path);
    }
    return { sigs: frames.map(() => 's'), sigs2: frames.map(() => 's'), anims: frames.map(() => null) };
  };
  const idx = Array.from({ length: tl.frames }, (_, i) => i), pages = idx.map(i => i < SEAM ? 0 : 1);
  return purityRun({ job, tl, aspect: '16x9', dir, prints: { stub: 1 }, film: { pages, anims: null }, idx, render, workers: 1, log: () => {} }).then(pj => {
    // the same filters qaFilm uses (lib/qa.mjs guard('purity'))
    const ok = pj.frames.filter(x => !x.error), state = ok.filter(x => x.state);
    const lag = ok.filter(x => !x.pass && !x.state && x.history !== true && x.history !== null);
    const flagged = new Set([...state.map(x => x.shot), ...lag.map(x => x.shot)]);
    const glitch = (pj.seams || []).filter(x => !x.error && !x.pass && !x.oneOff && !flagged.has(x.shot));
    const once = [...(pj.replay || []).filter(x => x.oneOff), ...(pj.seams || []).filter(x => x.oneOff)];
    console.log(`${name}: X=${X} replay=${JSON.stringify(pj.replay.map(r => ({ i: r.i, pass: r.pass, again: r.again && r.again.pass, oneOff: r.oneOff })))} seams=${JSON.stringify(pj.seams.map(r => ({ i: r.i, pass: r.pass, again: r.again && r.again.pass, oneOff: r.oneOff })))}`);
    console.log(`   → WARN lines: lag ${lag.length}, seam ${glitch.length}; INFO one-off ${once.length}; again/ renders: ${existsSync(join(dir, 'purity', 'again')) ? 'yes' : 'no'}`);
  });
}
await scenario('one-off', { againGood: true });
await scenario('repeatable', { againGood: false });
