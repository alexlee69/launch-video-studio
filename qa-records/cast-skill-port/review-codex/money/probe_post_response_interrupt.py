import json
import os
import signal
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
QA = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, QA)
import mock_openai as M

CAST = os.path.expanduser('~/.claude/skills/product-launch-sting/video/casting/casting.py')
JOB = os.path.join(HERE, 'job-post-response')
os.makedirs(os.path.join(JOB, 'tools'), exist_ok=True)
spec = {
    'cap': 50,
    'sizes': ['2560x1440'],
    'locations': {
        'place': {
            'n': 10,
            'prompt': 'An empty studio location plate. No people, no text.'
        }
    }
}
with open(os.path.join(JOB, 'tools', 'casting.json'), 'w') as f:
    json.dump(spec, f)

srv, url = M.start()
env = dict(os.environ, OPENAI_BASE_URL=url, OPENAI_API_KEY='sk-test-post-response')
ledger = os.path.join(JOB, 'cast', 'ledger.jsonl')
p = subprocess.Popen(
    [sys.executable, CAST, 'locations', '--go'], cwd=JOB, env=env,
    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

deadline = time.time() + 30
saw_200 = False
while time.time() < deadline and p.poll() is None:
    try:
        rows = [json.loads(x) for x in open(ledger) if x.strip()]
    except (OSError, ValueError):
        rows = []
    if any(r.get('status') == 200 for r in rows):
        saw_200 = True
        os.kill(p.pid, signal.SIGSTOP)
        break
    time.sleep(.001)

folder = os.path.join(JOB, 'stills', 'locations')
before = sorted(os.listdir(folder)) if os.path.isdir(folder) else []
if saw_200:
    os.kill(p.pid, signal.SIGINT)
    os.kill(p.pid, signal.SIGCONT)
out1 = p.communicate(timeout=10)[0]

q = subprocess.run(
    [sys.executable, CAST, 'locations', '--go'], cwd=JOB, env=env,
    capture_output=True, text=True, timeout=60)
after = sorted(os.listdir(folder)) if os.path.isdir(folder) else []
rows = [json.loads(x) for x in open(ledger) if x.strip()]
calls = {}
for row in rows:
    calls[row.get('call', id(row))] = row
print('saw status-200 before interrupt:', saw_200)
print('first exit:', p.returncode)
print('files present while stopped:', before)
print('first final line:', out1.strip().splitlines()[-1] if out1.strip() else '<none>')
print('rerun exit:', q.returncode)
print('mock request count:', len(M.STATE['log']))
print('collapsed ledger calls:', [(r.get('label'), r.get('status'), r.get('usd')) for r in calls.values()])
print('output png count after rerun:', len([x for x in after if x.endswith('.png')]))
