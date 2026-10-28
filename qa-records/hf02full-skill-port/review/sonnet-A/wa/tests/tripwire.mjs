// test tripwire: a TCP port that writes one line to $1 for every connection it gets, answers nothing and hangs up.
import net from 'node:net'; import { appendFileSync, writeFileSync } from 'node:fs';
const [log, port] = process.argv.slice(2); writeFileSync(log, '');
net.createServer(s => { appendFileSync(log, `connection from ${s.remoteAddress}:${s.remotePort} at ${new Date().toISOString()}\n`); s.destroy(); })
  .listen(+port, '127.0.0.1', () => console.log(`tripwire on ${port}`));
