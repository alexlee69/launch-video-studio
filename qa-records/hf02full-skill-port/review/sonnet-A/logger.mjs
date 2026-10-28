// scratch: a second origin that records the headers it receives (to see whether the key follows a cross-origin redirect)
import http from 'node:http';
const seen = [];
http.createServer((req, res) => {
  if (req.url === '/__seen') { res.writeHead(200, {'Content-Type':'application/json'}); return res.end(JSON.stringify(seen)); }
  seen.push({ url: req.url, authorization: req.headers.authorization ?? null });
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ status: 'COMPLETED' }));
}).listen(18952, '127.0.0.1', () => console.log('logger up'));
