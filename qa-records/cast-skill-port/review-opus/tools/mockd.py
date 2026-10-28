# Persistent local mock (review-opus scratch): wraps qa/cast-skill-port/mock_openai.py, serves on 127.0.0.1:PORT,
# POST /control {"script": [...]} sets the behaviour script; GET /log returns the request log (no file bytes).
# Extra behaviours: 'badusage' (images + usage.input_tokens_details = "x"), 'webp' (a WEBP image).
import json, sys, os, io, base64
sys.path.insert(0, os.path.expanduser('~/Downloads/Design-AutoPilot-stable/qa/cast-skill-port'))
sys.dont_write_bytecode = True
import mock_openai as M
from http.server import ThreadingHTTPServer
from PIL import Image

class H2(M.H):
    def do_GET(self):
        if self.path == '/log':
            return self.send(200, M.STATE['log'])
        return self.send(404, {})
    def do_POST(self):
        if self.path == '/control':
            n = int(self.headers.get('Content-Length', 0)); d = json.loads(self.rfile.read(n))
            M.STATE['script'] = d.get('script', [])
            if d.get('clear'): M.STATE['log'] = []
            return self.send(200, {'ok': True})
        beh = M.STATE['script'][0] if M.STATE['script'] else 'ok'
        if beh in ('badusage', 'webp'):
            M.STATE['script'][0] = 'ok'
            orig = self.send
            def patched(code, obj=None, raw=None):
                if obj and 'data' in obj:
                    if beh == 'badusage':
                        obj['usage']['input_tokens_details'] = 'x'
                    else:
                        for d in obj['data']:
                            im = Image.open(io.BytesIO(base64.b64decode(d['b64_json']))); b = io.BytesIO(); im.save(b, 'WEBP')
                            d['b64_json'] = base64.b64encode(b.getvalue()).decode()
                return orig(code, obj, raw)
            self.send = patched
        return M.H.do_POST(self)

port = int(sys.argv[1])
srv = ThreadingHTTPServer(('127.0.0.1', port), H2)
print('listening', port, flush=True)
srv.serve_forever()
