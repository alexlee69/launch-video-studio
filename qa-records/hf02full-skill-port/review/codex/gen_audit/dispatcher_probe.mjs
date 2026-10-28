const calls = [];
const headers = object => Object.entries(object).flatMap(([k, v]) => [Buffer.from(k), Buffer.from(String(v))]);
const dispatcher = {
  dispatch(options, handler) {
    calls.push({ method: options.method, origin: String(options.origin), path: options.path, headers: options.headers });
    queueMicrotask(() => {
      handler.onConnect(() => {});
      if (calls.length === 1) {
        handler.onHeaders(307, headers({ location: 'http://127.0.0.1:19730/accepted', 'content-length': 0 }), () => {}, 'Temporary Redirect');
        handler.onComplete([]);
      } else {
        const body = Buffer.from('{"ok":true}');
        handler.onHeaders(200, headers({ 'content-type': 'application/json', 'content-length': body.length }), () => {}, 'OK');
        handler.onData(body);
        handler.onComplete([]);
      }
    });
    return true;
  },
};
const response = await fetch('http://127.0.0.1:19730/submit', {
  method: 'POST',
  headers: { authorization: 'Key FAKE_REDIRECT_PROBE', 'content-type': 'application/json' },
  body: '{"prompt":"x"}',
  dispatcher,
});
console.log(JSON.stringify({ status: response.status, body: await response.json(), calls }, null, 2));
