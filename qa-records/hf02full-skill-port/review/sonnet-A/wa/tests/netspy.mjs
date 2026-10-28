// test hook (node --import): records every network attempt this Node process makes — fetch(), net/tls connects,
// http(s).request, dns.lookup — one line each in $NETSPY_LOG, then lets it proceed. Proves a dry run never reaches out.
import { appendFileSync } from 'node:fs';
import net from 'node:net'; import tls from 'node:tls'; import http from 'node:http'; import https from 'node:https'; import dns from 'node:dns';
const LOG = process.env.NETSPY_LOG;
const note = (what, target) => { if (LOG) appendFileSync(LOG, `${process.pid} ${what} ${String(target).slice(0, 120)}\n`); };
const wrap = (obj, name, label) => { const f = obj[name]; if (typeof f !== 'function') return; obj[name] = function (...a) { note(label, typeof a[0] === 'object' && a[0] ? (a[0].href || a[0].host || a[0].hostname || a[0].port || JSON.stringify(a[0]).slice(0, 80)) : a[0]); return f.apply(this, a); }; };
const realFetch = globalThis.fetch;
globalThis.fetch = function (input, init) { note('fetch', typeof input === 'string' ? input : input?.url || input); return realFetch.call(this, input, init); };
wrap(net, 'connect', 'net.connect'); wrap(net, 'createConnection', 'net.createConnection'); wrap(net.Socket.prototype, 'connect', 'socket.connect');
wrap(tls, 'connect', 'tls.connect'); wrap(http, 'request', 'http.request'); wrap(http, 'get', 'http.get'); wrap(https, 'request', 'https.request'); wrap(https, 'get', 'https.get');
wrap(dns, 'lookup', 'dns.lookup'); wrap(dns.promises, 'lookup', 'dns.promises.lookup');
