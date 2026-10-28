from pathlib import Path
from types import SimpleNamespace
import importlib.util
import json
import shutil
import sys


HERE = Path(__file__).resolve().parent
CASTING = Path.home() / ".claude/skills/product-launch-sting/video/casting/casting.py"
sys.path.insert(0, str(CASTING.parent.parent / "footage"))
module_spec = importlib.util.spec_from_file_location("casting_probe", CASTING)
casting = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(casting)

JOB = HERE / "key-escape-job"
if JOB.exists():
    shutil.rmtree(JOB)
JOB.mkdir()

fake_key = 'FAKE"KEY-DO-NOT-LEAK'
casting.KEY = fake_key


class S:
    ledger = str(JOB / "ledger.jsonl")
    cap = 5
    sizes = ["64x64"]
    model = "gpt-image-2"
    quality = "high"
    rates = casting.RATES

    @staticmethod
    def name(path):
        return str(path)


# This is the byte-for-byte shape of a JSON API error that echoes a quote in
# an Authorization value. No socket is opened.
wire_body = json.dumps({"error": {"message": "you sent Bearer " + fake_key}})
casting.post = lambda endpoint, fields, refs, timeout: (401, wire_body)
request = {"endpoint": "generations", "refs": [], "prompt": "A candidate.", "n": 1, "label": "candidate one"}
code = None
try:
    casting.call(S(), request, SimpleNamespace(timeout=1, backoff=0))
except SystemExit as ex:
    code = ex.code

ledger = JOB / "ledger.jsonl"
rows = [json.loads(line) for line in ledger.read_text().splitlines()]
escaped = json.dumps(fake_key)[1:-1]
print("exit:", code)
print("wire body:", wire_body)
print("scrub(wire body):", casting.scrub(wire_body))
print("escaped key survives scrub:", escaped in casting.scrub(wire_body))
print("last ledger error:", rows[-1].get("error"))
