from h import *
import signal, time, subprocess
# a slow mock: the request is received (and, on the real API, would be generated and billed), the user presses Ctrl-C
class Slow(H2):
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0)); self.rfile.read(n); M.STATE['log'].append({'endpoint': 'slow'}); time.sleep(6)
        try: self.send(200, {'data': []})
        except Exception: pass
import threading
from http.server import ThreadingHTTPServer
srv = ThreadingHTTPServer(('127.0.0.1', 0), Slow); threading.Thread(target=srv.serve_forever, daemon=True).start()
u = 'http://127.0.0.1:%d/v1' % srv.server_address[1]
job = newjob('p13')
env = dict(os.environ, OPENAI_BASE_URL=u, OPENAI_API_KEY=KEYV)
p = subprocess.Popen([sys.executable, CAST, 'candidates', '--go'], cwd=job, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
time.sleep(2); p.send_signal(signal.SIGINT); out = p.communicate()[0]
print('exit', p.returncode, '| mock saw', len(M.STATE['log']), 'request(s) | ledger rows:', len(ledger(job)), '| cost-accounted $0 although the request was in flight')
print(out.strip().splitlines()[-1][:100])
