# helpers for the review probes: a mock server with extra behaviours, a job builder, a runner. QA only; never real network.
import base64, io, json, os, shutil, subprocess, sys, threading
HERE = os.path.dirname(os.path.abspath(__file__)); PAR = os.path.dirname(HERE)
sys.path.insert(0, PAR); sys.dont_write_bytecode = True
import mock_openai as M
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
CAST = os.path.expanduser('~/.claude/skills/product-launch-sting/video/casting/casting.py')
KEYV = 'sk-test-' + ''.join(chr(65 + (i * 7) % 26) for i in range(40))

class H2(M.H):
    def do_POST(self):
        beh = M.STATE['script'][0] if M.STATE['script'] else 'ok'
        if beh == 'trunc':                       # a 200 whose body is cut short: Content-Length 5,000,000, 1,000 bytes sent
            M.STATE['script'].pop(0)
            n = int(self.headers.get('Content-Length', 0)); self.rfile.read(n); M.STATE['log'].append({'endpoint': 'trunc'})
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', '5000000')
            self.end_headers(); self.wfile.write(b'{"data": [{"b64_json": "' + b'A' * 1000); self.wfile.flush(); self.close_connection = True; self.connection.close(); return
        if isinstance(beh, tuple) and beh[0] == 'echo':    # a 401 whose body puts the key at char `beh[1]`
            M.STATE['script'].pop(0)
            n = int(self.headers.get('Content-Length', 0)); self.rfile.read(n); M.STATE['log'].append({'endpoint': 'echo'})
            key = self.headers.get('Authorization').split(' ', 1)[1]
            body = json.dumps({'error': {'message': 'x' * (beh[1] - 40) + ' Incorrect API key provided: ' + key + ' done'}}).encode()
            return self.send(401, raw=body)
        return super().do_POST()

def start():
    srv = ThreadingHTTPServer(('127.0.0.1', 0), H2)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, 'http://127.0.0.1:%d/v1' % srv.server_address[1]

SRV, URL = start()

def spec(job, **over):
    s = {'cap': 50, 'grey': '#8a8a8a', 'ban': [], 'text': {'WHO': 'a white woman of about 40'},
         'candidates': {'look-1': {'n': 1, 'prompt': '{SHEET} The person is {WHO}. {TAIL}'}},
         'lock': {'hero': {'prompt': '{LOCK} {KEEP}', 'restore': {'ellipse': [480, 545, 235, 290], 'feather': 28}, 'pin': {}}},
         'states': {'props': {'refs': ['sheet:hero'], 'prompt': '{STATE} props. {TAIL}', 'pin': {}},
                    'state-2': {'refs': ['sheet:hero'], 'prompt': '{STATE} wet. {TAIL}', 'pin': {}}},
         'locations': {'place-1': {'prompt': 'An empty office plate. {PLATE_TAIL}'}},
         'stills': {'S01': {'batch': 'identity', 'refs': ['sheet:hero', 'loc:place-1'], 'prompt': '{PRE_FACE}{PRE_LOC}A frame.'}}}
    s.update(over)
    os.makedirs(os.path.join(job, 'tools'), exist_ok=True)
    json.dump(s, open(os.path.join(job, 'tools', 'casting.json'), 'w'), indent=1)

def run(job, *args, key=True, url=None, backoff=True, env_extra=None):
    env = dict(os.environ, OPENAI_BASE_URL=url or URL); env.pop('OPENAI_API_KEY', None)
    if key: env['OPENAI_API_KEY'] = KEYV
    env.update(env_extra or {})
    a = list(args)
    if backoff and a and a[0] in ('candidates', 'lock', 'states', 'locations', 'stills', 'fix'): a += ['--backoff', '0.05']
    p = subprocess.run([sys.executable, CAST] + a, cwd=job, env=env, capture_output=True, text=True)
    return p.returncode, p.stdout + p.stderr

def newjob(name, **over):
    job = os.path.join(HERE, 'jobs', name); shutil.rmtree(job, ignore_errors=True); os.makedirs(job); spec(job, **over); return job

def ledger(job):
    p = os.path.join(job, 'cast', 'ledger.jsonl')
    return [json.loads(l) for l in open(p)] if os.path.exists(p) else []

def tree(job):
    return sorted(os.path.relpath(os.path.join(d, f), job) for d, _, fs in os.walk(job) for f in fs)
