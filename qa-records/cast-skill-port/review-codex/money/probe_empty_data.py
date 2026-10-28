import importlib.util
import json
import os
import types

CAST = os.path.expanduser('~/.claude/skills/product-launch-sting/video/casting/casting.py')
sp = importlib.util.spec_from_file_location('casting_current', CAST)
C = importlib.util.module_from_spec(sp)
sp.loader.exec_module(C)

ledger = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'empty-data-ledger.jsonl')
try:
    os.unlink(ledger)
except FileNotFoundError:
    pass

class S:
    rates = {'text_in': 5.0, 'image_in': 8.0, 'out': 30.0}
    sizes = ['2560x1440']
    cap = 10.0
    model = 'gpt-image-2'
    quality = 'high'
    def __init__(self):
        self.ledger = ledger
    def name(self, p):
        return p

C.post = lambda endpoint, fields, refs, timeout: (
    200,
    json.dumps({'data': [], 'usage': {
        'input_tokens': 10,
        'output_tokens': 7370,
        'input_tokens_details': {'text_tokens': 10, 'image_tokens': 0}
    }})
)
req = {'endpoint': 'generations', 'refs': [], 'prompt': 'test', 'n': 1, 'label': 'empty response'}
pngs, size = C.call(S(), req, types.SimpleNamespace(timeout=1, backoff=0))
print('returned image count:', len(pngs), 'size:', size)
print('collapsed ledger:', C.ledger_calls(S()))
