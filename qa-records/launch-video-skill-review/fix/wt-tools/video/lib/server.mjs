// Tiny static server: /skill/* → the skill folder, /job/* → the job folder. Chrome loads the stage over http so
// ES modules, fonts and job assets work (file:// would block them). Binds 127.0.0.1 on a free port.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join, normalize, extname, sep } from 'node:path';
import { SKILL } from './common.mjs';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.wav': 'audio/wav' };

export function serve(job, port = 0) {
  const roots = { skill: SKILL, job };
  const srv = createServer((req, res) => {
    let url;
    try { url = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }   // malformed %-escapes
    const m = url.match(/^\/(skill|job)\/(.*)$/);
    if (!m) { res.writeHead(404); return res.end(); }
    const root = roots[m[1]], file = normalize(join(root, m[2]));
    if (!file.startsWith(root + sep) && file !== root) { res.writeHead(403); return res.end(); }
    try {
      if (!statSync(file).isFile()) throw 0;
      res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      createReadStream(file).on('error', () => res.destroy()).pipe(res);
    } catch { res.writeHead(404); res.end(); }
  });
  return new Promise((r, reject) => { srv.once('error', e => reject(new Error(`local file server failed to start: ${e.message}`))); srv.listen(port, '127.0.0.1', () => r({
    srv, base: `http://127.0.0.1:${srv.address().port}`,
    // drop keep-alive sockets first, or close() waits on Chrome's idle connections indefinitely
    close: () => new Promise(c => { srv.closeIdleConnections?.(); srv.closeAllConnections?.(); srv.close(() => c()); }),
  })); });
}
