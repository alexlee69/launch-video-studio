import http from 'node:http';
import { readFileSync } from 'node:fs';

const port = Number(process.argv[2]);
const clip = readFileSync(process.argv[3]);
const seen = [];
const base = `http://127.0.0.1:${port}`;
const json = (res, code, value, headers = {}) => {
  const body = JSON.stringify(value);
  res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), ...headers });
  res.end(body);
};
const readBody = req => new Promise(resolve => {
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => resolve(Buffer.concat(chunks)));
});

http.createServer(async (req, res) => {
  const body = await readBody(req);
  seen.push({ method: req.method, url: req.url, auth: req.headers.authorization || null, bytes: body.length });
  if (req.url === '/__log') return json(res, 200, seen);
  if (req.method === 'POST' && req.url === '/minimax/h3-max/image-to-video') {
    res.writeHead(307, { location: `${base}/accepted` });
    return res.end();
  }
  if (req.method === 'POST' && req.url === '/accepted') {
    return json(res, 200, {
      request_id: 'redirect-second-request',
      status_url: `${base}/status`,
      response_url: `${base}/result`,
    });
  }
  if (req.url === '/status') return json(res, 200, { status: 'COMPLETED' });
  if (req.url === '/result') return json(res, 200, {
    video: { url: `${base}/clip.mp4`, content_type: 'video/mp4', file_size: clip.length },
  });
  if (req.url === '/clip.mp4' && req.method === 'HEAD') {
    res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': clip.length });
    return res.end();
  }
  if (req.url === '/clip.mp4') {
    res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': clip.length });
    return res.end(clip);
  }
  json(res, 404, { detail: 'not found' });
}).listen(port, '127.0.0.1', () => console.log(`ready ${base}`));
