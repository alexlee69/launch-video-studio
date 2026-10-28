import importlib.util
import json
import os
from types import SimpleNamespace

HERE = os.path.dirname(os.path.abspath(__file__))
CAST = os.path.expanduser('~/.claude/skills/product-launch-sting/video/casting/casting.py')
JOB = os.path.join(HERE, 'runs', 'empty-response')
os.makedirs(os.path.join(JOB, 'tools'), exist_ok=True)
spec_path = os.path.join(JOB, 'tools', 'casting.json')
with open(spec_path, 'w', encoding='utf-8') as f:
    json.dump({
        'root': '..',
        'cap': 50,
        'ledger': '../cast/ledger.jsonl',
        'candidates': {'look': {'n': 2, 'prompt': '{SHEET} {TAIL}'}},
    }, f)

modspec = importlib.util.spec_from_file_location('casting_under_review', CAST)
C = importlib.util.module_from_spec(modspec)
modspec.loader.exec_module(C)
S = C.Spec(spec_path)
req = C.requests(S, 'candidates')[0]
C.post = lambda *args: (200, json.dumps({
    'data': [],
    'usage': {'input_tokens': 0, 'output_tokens': 0,
              'input_tokens_details': {'text_tokens': 0, 'image_tokens': 0}},
}))
pngs, size = C.call(S, req, SimpleNamespace(timeout=1, backoff=0))
print('returned_images=%d requested_n=%d size=%s' % (len(pngs), req['n'], size))
print(open(S.ledger, encoding='utf-8').read().strip().splitlines()[-1])
