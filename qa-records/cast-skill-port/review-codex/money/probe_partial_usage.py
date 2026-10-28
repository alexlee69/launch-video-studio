import importlib.util
import os
import types

CAST = os.path.expanduser('~/.claude/skills/product-launch-sting/video/casting/casting.py')
sp = importlib.util.spec_from_file_location('casting_current', CAST)
C = importlib.util.module_from_spec(sp)
sp.loader.exec_module(C)
S = types.SimpleNamespace(rates={'text_in': 5.0, 'image_in': 8.0, 'out': 30.0})

for usage in (
    {'total_tokens': 9000},
    {'input_tokens_details': {'text_tokens': 100, 'image_tokens': 0}},
    {'input_tokens': 100, 'output_tokens': 7370},
):
    print(repr(usage), '=> $%.6f' % C.usage_cost(S, usage))
