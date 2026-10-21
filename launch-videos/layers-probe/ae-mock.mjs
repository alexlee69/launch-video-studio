// Runs a --layers After Effects script (.jsx) against a MOCK of the After Effects scripting API — not After Effects.
// It proves the script is valid ES3 (acorn, ecmaVersion 3), runs start to finish without throwing or alerting an
// error, imports every file it names (they must exist next to it), and builds the comp the manifest describes:
// size, fps, duration, layers top→bottom = manifest back→front reversed, alpha straight, baked text switched off under
// its live-text precomp. Live text: every word's keyed position / scale / opacity, linearly interpolated the way the
// script asks After Effects to, is compared with the engine's per-frame samples (text-probe.json in the work folder).
//   node ae-mock.mjs <layers folder> <work folder> [--fonts Inter-Bold,…] [--acorn path/to/acorn]
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const [folder, work] = process.argv.slice(2);
const opt = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const fonts = new Set((opt('--fonts') ?? 'Inter-Regular,Inter-Medium,Inter-SemiBold,Inter-Bold').split(',').filter(Boolean));
const M = JSON.parse(readFileSync(join(folder, 'manifest.json'), 'utf8'));
const jsxPath = join(folder, M.ae), src = readFileSync(jsxPath, 'utf8');
const D = JSON.parse(src.match(/var M = (\{.*\});/)[1]);      // the script's own data (blurred → live text added switched off)
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };

// 1 · ES3 syntax
const acornPath = opt('--acorn');
if (acornPath) {
  const acorn = createRequire(import.meta.url)(acornPath);
  try { acorn.parse(src, { ecmaVersion: 3, sourceType: 'script' }); console.log('PASS  es3      parses as ECMAScript 3 (ExtendScript)'); }
  catch (e) { fails.push(`ES3 parse: ${e.message}`); console.log(`FAIL  es3      ${e.message}`); }
}

// 2 · the mock
const log = [], alerts = [];
class Prop {
  constructor(name, dims, value) { this.name = name; this.dims = dims; this.v = value; this.keys = []; this.dimensionsSeparated = false; this.interp = []; }
  get value() { return this.v; }
  get numKeys() { return this.keys.length; }
  setValue(v) { this.check(v); if (this.keys.length) throw new Error(`${this.name}: setValue on a keyed property`); this.v = v; }
  check(v) { if (this.dims === 1 ? typeof v !== 'number' || !Number.isFinite(v) : !(Array.isArray(v) && v.length >= 2 && v.every(Number.isFinite))) throw new Error(`${this.name}: bad value ${JSON.stringify(v)}`); }
  setValuesAtTimes(t, v) {
    if (!Array.isArray(t) || !Array.isArray(v) || t.length !== v.length || t.length < 2) throw new Error(`${this.name}: setValuesAtTimes wants equal arrays (${t.length}/${v.length})`);
    v.forEach(x => this.check(x));
    for (let i = 1; i < t.length; i++) if (!(t[i] > t[i - 1])) throw new Error(`${this.name}: key times not increasing`);
    this.keys = t.map((x, i) => [x, v[i]]); this.interp = t.map(() => 'default');
  }
  setInterpolationTypeAtKey(k, type) { if (!(k >= 1 && k <= this.keys.length)) throw new Error(`${this.name}: no key ${k}`); if (type !== 'LINEAR') throw new Error('unexpected interpolation'); this.interp[k - 1] = type; }
  valueAtTime(t) {
    if (!this.keys.length) return this.v;
    const K = this.keys; if (t <= K[0][0]) return K[0][1]; if (t >= K[K.length - 1][0]) return K[K.length - 1][1];
    let i = 0; while (K[i + 1][0] < t) i++;
    if (this.interp[i] !== 'LINEAR') throw new Error(`${this.name}: key ${i + 1} is not linear`);
    const a = K[i], b = K[i + 1], u = (t - a[0]) / (b[0] - a[0]);
    return Array.isArray(a[1]) ? a[1].map((x, j) => x + (b[1][j] - x) * u) : a[1] + (b[1] - a[1]) * u;
  }
}
class Group { constructor(props) { this.props = props; } property(n) { if (!(n in this.props)) throw new Error(`no property ${n}`); return this.props[n]; } }
class TextDocument { constructor(t) { this.text = t; this.font = 'ArialMT'; this.fontSize = 36; this.fillColor = [1, 1, 1]; this.applyFill = true; this.applyStroke = false; this.tracking = 0; this.justification = 'CENTER'; } resetCharStyle() { this.fontSize = 36; this.tracking = 0; } }
class Layer {
  constructor(coll, name, source) {
    this.coll = coll; this.name = name; this.source = source; this.startTime = 0; this.enabled = true;
    const pos = new Prop('Position', 2, [0, 0]);
    const tr = { 'ADBE Anchor Point': new Prop('Anchor Point', 2, [0, 0]), 'ADBE Position': pos, 'ADBE Scale': new Prop('Scale', 2, [100, 100]), 'ADBE Opacity': new Prop('Opacity', 1, 100) };
    for (const d of [0, 1]) { const p = new Prop(`Position_${d}`, 1, 0); const sv = p.setValue.bind(p), svt = p.setValuesAtTimes.bind(p); const guard = () => { if (!pos.dimensionsSeparated) throw new Error('Position dimensions are not separated'); }; p.setValue = v => { guard(); sv(v); }; p.setValuesAtTimes = (a, b) => { guard(); svt(a, b); }; tr[`ADBE Position_${d}`] = p; }
    this.groups = { 'ADBE Transform Group': new Group(tr) };
  }
  property(n) { if (!(n in this.groups)) throw new Error(`no property group ${n}`); return this.groups[n]; }
  get index() { return this.coll.list.indexOf(this) + 1; }
  moveToEnd() { const L = this.coll.list; L.splice(L.indexOf(this), 1); L.push(this); }
  moveBefore(other) { const L = this.coll.list; L.splice(L.indexOf(this), 1); L.splice(L.indexOf(other), 0, this); }
}
class Layers {
  constructor(comp) { this.comp = comp; this.list = []; }
  get length() { return this.list.length; }
  add(item) { if (!(item instanceof Footage || item instanceof Comp)) throw new Error('layers.add needs an item'); const L = new Layer(this, item.name, item); this.list.unshift(L); return L; }
  addText(t) {
    const L = new Layer(this, t, null), doc = new Prop('Source Text', 0, new TextDocument(t));
    doc.check = () => {}; doc.setValue = v => { if (!(v instanceof TextDocument)) throw new Error('Source Text wants a TextDocument'); const c = Object.assign(new TextDocument(v.text), v); if (!fonts.has(c.font)) c.font = 'ArialMT'; doc.v = c; };
    Object.defineProperty(doc, 'value', { get: () => Object.assign(new TextDocument(doc.v.text), doc.v) });
    L.groups['ADBE Text Properties'] = new Group({ 'ADBE Text Document': doc }); L.text = doc;
    this.list.unshift(L); return L;
  }
}
class Item { constructor(name) { this.name = name; this.parentFolder = null; } }
class Comp extends Item { constructor(name, w, h, par, dur, fps) { super(name); Object.assign(this, { width: w, height: h, pixelAspect: par, duration: dur, frameRate: fps, bgColor: [0, 0, 0] }); this.layers = new Layers(this); } openInViewer() { this.opened = true; } }
class Footage extends Item {
  constructor(file) {
    super(file.name); this.file = file;
    const src = { hasAlpha: /\.mov$/i.test(file.name), conformFrameRate: 0 }; let mode = null;
    Object.defineProperty(src, 'alphaMode', { get: () => mode, set: v => { if (!src.hasAlpha) throw new Error(`${file.name}: alphaMode can only be set on footage with alpha`); mode = v; } });
    this.mainSource = src;
  }
}
function File(p) { if (!(this instanceof File)) return new File(p); this.fsName = p; this.name = p.split('/').pop(); }
Object.defineProperty(File.prototype, 'exists', { get() { return existsSync(this.fsName) && statSync(this.fsName).isFile(); } });
Object.defineProperty(File.prototype, 'parent', { get() { return { fsName: dirname(this.fsName) }; } });
function ImportOptions(f) { if (!(f instanceof File)) throw new Error('ImportOptions wants a File'); this.file = f; }
const comps = [], footage = [];
const app = {
  beginUndoGroup: n => log.push(`undo+ ${n}`), endUndoGroup: () => log.push('undo-'),
  project: {
    items: { addFolder: n => new Item(n), addComp: (...a) => { const c = new Comp(...a); comps.push(c); return c; } },
    importFile: io => { if (!io.file.exists) throw new Error(`import: no file ${io.file.fsName}`); const f = new Footage(io.file); footage.push(f); return f; },
  },
};
const sandbox = { app, File, ImportOptions, alert: m => alerts.push(String(m)), $: { fileName: jsxPath },
  AlphaMode: { STRAIGHT: 'STRAIGHT', PREMULTIPLIED: 'PREMULTIPLIED' }, KeyframeInterpolationType: { LINEAR: 'LINEAR' }, ParagraphJustification: { LEFT_JUSTIFY: 'LEFT' } };
vm.createContext(sandbox);
try { vm.runInContext(src, sandbox, { filename: jsxPath }); } catch (e) { fails.push(`script threw: ${e.message}`); }
const errAlerts = alerts.filter(a => /stopped|error/i.test(a));
ok(!errAlerts.length, `script alerted an error: ${errAlerts.join(' | ')}`);
ok(log[0]?.startsWith('undo+') && log.at(-1) === 'undo-', 'undo group not opened and closed');

// 3 · the comp
const comp = comps.find(c => c.name === `${M.slug} ${M.shot} ${M.aspect}`);
ok(!!comp, 'main comp missing');
if (comp) {
  ok(comp.width === M.width && comp.height === M.height && comp.frameRate === M.fps && Math.abs(comp.duration - M.frames / M.fps) < 1e-9 && comp.opened, `comp ${comp.width}×${comp.height} ${comp.frameRate} fps ${comp.duration} s`);
  const top = comp.layers.list.map(l => l.name);
  const live = new Set(M.layers.filter(l => l.liveText).map(l => l.name));
  const want = [...M.layers].reverse().flatMap(l => live.has(l.name) ? [`${l.name} (live text)`, `${l.name} (baked)`] : [l.name]).concat(M.sfx ? ['UI sounds'] : []);
  ok(JSON.stringify(top) === JSON.stringify(want), `layer order top→bottom ${JSON.stringify(top)} want ${JSON.stringify(want)}`);
  for (const L of comp.layers.list) {
    if (L.source instanceof Footage && L.name !== 'UI sounds') ok(L.source.mainSource.alphaMode === 'STRAIGHT' && L.source.mainSource.conformFrameRate === M.fps, `${L.name}: alpha ${L.source.mainSource.alphaMode}, conform ${L.source.mainSource.conformFrameRate}`);
    if (/\(baked\)$/.test(L.name)) ok(L.enabled === !!D.blurred, `${L.name} should be switched ${D.blurred ? 'on (motion-blurred export)' : 'off'}`);
    if (/\(live text\)$/.test(L.name)) ok(L.enabled === !D.blurred, `${L.name} should be switched ${D.blurred ? 'off (motion-blurred export)' : 'on'}`);
  }
  const files = footage.map(f => f.name).sort(), wantFiles = [...M.layers.map(l => l.file), ...(M.sfx ? [M.sfx] : [])].sort();
  ok(JSON.stringify(files) === JSON.stringify(wantFiles), `imported ${files.join(', ')}`);
  console.log(`${fails.length ? 'FAIL' : 'PASS'}  comp     ${comp.width}×${comp.height} ${comp.frameRate} fps ${comp.duration.toFixed(3)} s; top→bottom: ${top.join(' · ')}${D.blurred ? ' (motion-blurred export: baked text on, live text off)' : ''}`);
}

// 4 · live text vs the engine's samples
const probes = work && existsSync(join(work, 'text-probe.json')) ? JSON.parse(readFileSync(join(work, 'text-probe.json'), 'utf8')).map(p => (p && p.text) || p) : null;
for (const L of M.layers.filter(l => l.liveText)) {
  const pc = comps.find(c => c.name === `${M.slug} ${M.shot} ${M.aspect} ${L.name} (live text)`);
  ok(!!pc, `${L.name}: live-text precomp missing`);
  if (!pc || !probes) continue;
  const words = pc.layers.list.slice().reverse();          // added in reading order, each on top
  const samples = probes[0][L.name].map((w, i) => i).filter(i => probes[0][L.name][i].style.text.trim());
  ok(words.length === samples.length, `${L.name}: ${words.length} word layers for ${samples.length} words`);
  let worst = { p: 0, s: 0, o: 0 };
  words.forEach((wl, k) => {
    const i = samples[k], st = probes[0][L.name][i].style, doc = wl.text.value;
    ok(doc.text === st.text && Math.abs(doc.fontSize - st.size) < .01 && doc.tracking === st.tracking && doc.justification === 'LEFT', `${L.name} word ${k}: ${doc.text} ${doc.fontSize} vs ${st.text} ${st.size}`);
    const tr = wl.property('ADBE Transform Group');
    ok(JSON.stringify(tr.property('ADBE Anchor Point').value.slice(0, 2)) === '[0,0]', 'anchor not at the text origin');
    probes.forEach((fr, f) => {
      const w = fr[L.name][i], t = f / M.fps;
      worst.p = Math.max(worst.p, Math.abs(tr.property('ADBE Position_0').valueAtTime(t) - w.x), Math.abs(tr.property('ADBE Position_1').valueAtTime(t) - w.y));
      worst.s = Math.max(worst.s, Math.abs(tr.property('ADBE Scale').valueAtTime(t)[0] - w.s * 100));
      worst.o = Math.max(worst.o, Math.abs(tr.property('ADBE Opacity').valueAtTime(t) - w.o * 100));
    });
  });
  ok(worst.p <= .21 && worst.s <= .051 && worst.o <= .41, `${L.name}: keyed motion off the engine by ${JSON.stringify(worst)}`);
  const nk = words.reduce((a, wl) => a + ['ADBE Position_0', 'ADBE Position_1', 'ADBE Scale', 'ADBE Opacity'].reduce((b, p) => b + wl.property('ADBE Transform Group').property(p).numKeys, 0), 0);
  console.log(`${fails.length ? 'FAIL' : 'PASS'}  livetext ${L.name}: ${words.length} words "${words.map(w => w.name).join(' ')}", ${nk} keys over ${probes.length} frames; worst vs engine: position ${worst.p.toFixed(3)} px, scale ${worst.s.toFixed(4)} %, opacity ${worst.o.toFixed(3)} %`);
}
const fontAlerts = alerts.filter(a => /install/i.test(a));
if (fontAlerts.length) console.log(`INFO  fonts    ${fontAlerts.join(' | ')}`);
console.log(fails.length ? `AE MOCK FAILED (${fails.length}):\n  ${fails.join('\n  ')}` : 'AE MOCK PASSED (mock API — not tested in After Effects)');
process.exit(fails.length ? 1 : 0);
