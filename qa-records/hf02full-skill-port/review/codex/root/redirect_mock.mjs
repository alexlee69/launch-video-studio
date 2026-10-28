import http from 'node:http';

const port = 19720;
let posts = [];
const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    if (req.method === 'POST') posts.push({ path: req.url, auth: req.headers.authorization || null, bytes: Buffer.concat(chunks).length });
    if (req.url === '/__count') {
      const body = JSON.stringify({ posts });
      res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
      res.end(body);
      return;
    }
    if (req.method === 'POST' && req.url === '/fal-ai/flux-pro/v1.1-ultra') {
      res.writeHead(307, { location: '/redirected' });
      res.end();
      return;
    }
    if (req.method === 'POST' && req.url === '/redirected') {
      const body = JSON.stringify({ detail: 'redirect target refused after the repeated POST' });
      res.writeHead(422, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
      res.end(body);
      return;
    }
    res.writeHead(404);
    res.end();
  });
});
server.listen(port, '127.0.0.1', () => console.log(`redirect mock ${port}`));
