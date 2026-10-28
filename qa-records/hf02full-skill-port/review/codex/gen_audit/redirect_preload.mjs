import { appendFileSync } from 'node:fs';

const nativeFetch = globalThis.fetch;
const base = process.env.FAL_QUEUE_URL;
const callLog = process.env.MOCK_CALL_LOG;
const rawHeaders = object => Object.entries(object).flatMap(([k, v]) => [Buffer.from(k), Buffer.from(String(v))]);
const send = (handler, status, value, extra = {}) => {
  const body = Buffer.from(JSON.stringify(value));
  handler.onHeaders(status, rawHeaders({ 'content-type': 'application/json', 'content-length': body.length, ...extra }), () => {}, String(status));
  if (body.length) handler.onData(body);
  handler.onComplete([]);
};
const dispatcher = {
  dispatch(options, handler) {
    const auth = options.headers && Object.keys(options.headers).some(k => k.toLowerCase() === 'authorization');
    if (callLog) appendFileSync(callLog, JSON.stringify({ method: options.method, origin: String(options.origin), path: options.path, auth }) + '\n');
    queueMicrotask(() => {
      handler.onConnect(() => {});
      if (options.method === 'POST' && options.path === '/minimax/h3-max/image-to-video') {
        send(handler, 307, {}, { location: process.env.MOCK_CROSS_REDIRECT || `${base}/accepted` });
      } else if (options.method === 'POST' && options.path === '/accepted') {
        send(handler, 200, { request_id: 'second-paid-request', status_url: `${base}/status/second-paid-request`, response_url: `${base}/result/second-paid-request` });
      } else if (options.path === '/status/second-paid-request') {
        send(handler, 200, { status: 'COMPLETED', request_id: 'second-paid-request' });
      } else if (options.path === '/result/second-paid-request') {
        send(handler, 200, {});
      } else {
        send(handler, 404, { detail: 'mock not found' });
      }
    });
    return true;
  },
};
globalThis.fetch = (url, options = {}) => nativeFetch(url, { ...options, dispatcher });
