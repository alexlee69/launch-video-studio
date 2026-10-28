import importlib.util
import json
import os
import threading
import types

CAST = os.path.expanduser('~/.claude/skills/product-launch-sting/video/casting/casting.py')
sp = importlib.util.spec_from_file_location('casting_current', CAST)
C = importlib.util.module_from_spec(sp)
sp.loader.exec_module(C)

ledger = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'concurrent-ledger.jsonl')
try:
    os.unlink(ledger)
except FileNotFoundError:
    pass

class S:
    rates = {'text_in': 5.0, 'image_in': 8.0, 'out': 30.0}
    sizes = ['2560x1440']
    cap = 0.34  # one estimated call (~$0.221) fits; two do not
    model = 'gpt-image-2'
    quality = 'high'
    def __init__(self):
        self.ledger = ledger
    def name(self, p):
        return p

shared = S()
barrier = threading.Barrier(2)
real_spent = C.spent
seen = threading.local()

def synchronized_read(s):
    value = real_spent(s)
    if not getattr(seen, 'done', False):
        seen.done = True
        barrier.wait()
    return value

# This changes no value; it only forces the legal context switch between the
# unprotected spent() read and log() append.
C.spent = synchronized_read
C.post = lambda endpoint, fields, refs, timeout: (200, json.dumps({'data': [{'b64_json': ''}]}))

req = {'endpoint': 'generations', 'refs': [], 'prompt': 'test', 'n': 1, 'label': 'concurrent'}
errors = []
def worker():
    try:
        C.call(shared, req, types.SimpleNamespace(timeout=1, backoff=0))
    except BaseException as ex:
        errors.append(repr(ex))

threads = [threading.Thread(target=worker) for _ in range(2)]
for t in threads:
    t.start()
for t in threads:
    t.join()
C.spent = real_spent
print('errors:', errors)
print('request rows:', [(r['status'], r['usd']) for r in C.ledger_calls(shared)])
print('spent:', round(C.spent(shared), 4), 'cap:', shared.cap)
