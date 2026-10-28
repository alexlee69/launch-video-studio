// Layer-QA workers (qaLayers in layers.mjs runs several of each). Decoded frames live in shared memory: two buffers per
// input (content layers, background(s), refAlpha, refOpaque), so frame f + 1 is read while frame f is composited.
//   role 'read'   owns a few of the inputs' ffmpeg decoders and copies each one's next frame into the buffer it is told
//                 (a 1080p frame is 16 MB at 16 bit: one thread can't pull every layer through its pipe fast enough)
//   role 'stack'  one band of rows of every frame: composites the content layers back to front ("over", premultiplied,
//                 float32) and compares the stack with the flattened references; returns its band's share of the stats
//                 (visible-pixel counts and boxes per layer, error histograms, the background's lowest alpha), which
//                 qaLayers adds up. Every pixel goes through exactly the arithmetic of one pass over the whole frame.
import { parentPort, workerData } from 'node:worker_threads';
import { spawn } from 'node:child_process';

// one ProRes layer → 16-bit RGBA frames (BT.709 limited → full-range RGB, straight alpha), streamed into bufs[0], bufs[1],
// … in turn (yields after each whole frame). QA runs a decoder per input at once, each mostly waiting on its pipe with
// ffmpeg's queues full of 16 MB frames: with automatic threads that held ~0.5 GB per decoder (7 GB for a 12-layer
// shot); one codec thread and a one-packet output queue hold ~0.2 GB and still decode ~120 fps (same bytes out).
async function* rawFrames(file, W, H, bufs) {
  const size = W * H * 8;
  const p = spawn('ffmpeg', ['-hide_banner', '-v', 'error', '-threads', '1', '-filter_threads', '1', '-i', file, '-vf', 'scale=in_color_matrix=bt709:in_range=tv,format=rgba64le',
    '-thread_queue_size', '1', '-f', 'rawvideo', 'pipe:1'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let err = ''; p.stderr.on('data', d => { err += d; });
  const closed = new Promise(r => p.on('close', code => r(code)));
  let b = 0, frame = bufs[0], off = 0;
  try {
    for await (const chunk of p.stdout) {
      for (let c = 0; c < chunk.length;) {
        const k = Math.min(size - off, chunk.length - c);
        chunk.copy(frame, off, c, c + k); off += k; c += k;
        if (off === size) { yield b; b = (b + 1) % bufs.length; frame = bufs[b]; off = 0; }
      }
    }
    const code = await closed;
    if (code !== 0) throw new Error(`decoding ${file} failed: ${err.trim()}`);
    if (off) throw new Error(`decoding ${file}: ${off} stray bytes after the last whole frame`);
  } finally { p.kill(); }
}

if (workerData.role === 'read') {
  const { W, H, inputs, slots } = workerData;     // inputs: [{i, file}]
  const its = inputs.map(({ i, file }) => rawFrames(file, W, H, slots.map(s => Buffer.from(s[i])))[Symbol.asyncIterator]());
  parentPort.on('message', async m => {
    if (m === 'close') { await Promise.allSettled(its.map(it => it.return())); parentPort.postMessage({ closed: true }); return; }
    try {
      const rs = await Promise.all(its.map(it => it.next()));
      if (rs.some(r => !r.done && r.value !== m)) throw new Error('layer QA: decoders out of step');
      parentPort.postMessage({ done: rs.map(r => r.done) });
    } catch (e) { parentPort.postMessage({ err: String(e.message || e) }); }
  });
} else {
  const { W, H, C, nBg, hasBg, row0, row1, slots, VA } = workerData;
  const views = slots.map(set => set.map(b => new Uint16Array(b)));   // views[slot][input]
  const q0 = row0 * W * 4, q1 = row1 * W * 4;
  const acc = new Float32Array(q1 - q0);
  parentPort.on('message', slot => {
    const nF = Math.max(0, nBg - 1);                 // footage layers above the background (counted like content layers)
    const L = views[slot], cnt = new Uint32Array(C + nF), box = new Int32Array((C + nF) * 4), hA = new Uint32Array(256);
    acc.fill(0);
    for (let l = 0; l < C; l++) {
      const d = L[l];
      let c = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let p = q0, i = 0, x = 0, y = row0; p < q1; p += 4, i += 4) {
        const a = d[p + 3];
        if (a !== 0) {
          const k = a / 65535, inv = 1 - k;
          acc[i] = d[p] * k + acc[i] * inv; acc[i + 1] = d[p + 1] * k + acc[i + 1] * inv; acc[i + 2] = d[p + 2] * k + acc[i + 2] * inv; acc[i + 3] = a + acc[i + 3] * inv;
          if (a > VA) { c++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        if (++x === W) { x = 0; y++; }
      }
      cnt[l] = c; box[l * 4] = x0; box[l * 4 + 1] = y0; box[l * 4 + 2] = x1; box[l * 4 + 3] = y1;
    }
    for (let j = 0; j < nF; j++) {                    // the footage layer's visible pixels and box (not part of the content stack)
      const d = L[C + 1 + j];
      let c = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let p = q0, x = 0, y = row0; p < q1; p += 4) {
        if (d[p + 3] > VA) { c++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (++x === W) { x = 0; y++; }
      }
      const l = C + j; cnt[l] = c; box[l * 4] = x0; box[l * 4 + 1] = y0; box[l * 4 + 2] = x1; box[l * 4 + 3] = y1;
    }
    // content stack vs the flattened transparent render
    const ref = L[C + nBg];
    for (let p = q0, i = 0; p < q1; p += 4, i += 4) {
      const k = ref[p + 3] / 65535;
      let e = Math.abs(acc[i + 3] - ref[p + 3]);
      e = Math.max(e, Math.abs(acc[i] - ref[p] * k), Math.abs(acc[i + 1] - ref[p + 1] * k), Math.abs(acc[i + 2] - ref[p + 2] * k));
      hA[Math.min(255, Math.floor(e / 257))]++;
    }
    let hO = null, bgMin = 65535;
    if (hasBg) {        // background (+ footage over it) under the stack vs the flattened render on its background
      const bg = L[C], refO = L[C + nBg + 1], ft = nF ? L[C + 1] : null;
      hO = new Uint32Array(256);
      for (let p = q0, i = 0; p < q1; p += 4, i += 4) {
        if (bg[p + 3] < bgMin) bgMin = bg[p + 3];
        let br = bg[p], bgg = bg[p + 1], bb = bg[p + 2];
        if (ft) { const k = ft[p + 3] / 65535, kv = 1 - k; br = ft[p] * k + br * kv; bgg = ft[p + 1] * k + bgg * kv; bb = ft[p + 2] * k + bb * kv; }
        const inv = 1 - acc[i + 3] / 65535;
        const e = Math.max(Math.abs(acc[i] + br * inv - refO[p]), Math.abs(acc[i + 1] + bgg * inv - refO[p + 1]), Math.abs(acc[i + 2] + bb * inv - refO[p + 2]));
        hO[Math.min(255, Math.floor(e / 257))]++;
      }
    }
    parentPort.postMessage({ cnt, box, hA, hO, bgMin });
  });
}
