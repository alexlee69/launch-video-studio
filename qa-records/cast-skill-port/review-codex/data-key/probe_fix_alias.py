from pathlib import Path
from types import SimpleNamespace
import base64
import importlib.util
import io
import json
import shutil
import sys

from PIL import Image


HERE = Path(__file__).resolve().parent
CASTING = Path.home() / ".claude/skills/product-launch-sting/video/casting/casting.py"
sys.path.insert(0, str(CASTING.parent.parent / "footage"))
module_spec = importlib.util.spec_from_file_location("casting_fix_alias_probe", CASTING)
casting = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(casting)

JOB = HERE / "fix-alias-job"
if JOB.exists():
    shutil.rmtree(JOB)
(JOB / "tools").mkdir(parents=True)
(JOB / "tools" / "casting.json").write_text(json.dumps({
    "root": "..",
    "cap": 5,
    "sizes": ["128x128"],
    "fixes": {
        "patch": {
            "src": "../orig.png",
            "out": "../result.png",
            "edit": "../result.png",
            "prompt": "Fix it.",
            "box": [0, 0, 32, 32],
            "feather": 0,
        }
    },
}, indent=2))
Image.new("RGB", (128, 128), (10, 20, 30)).save(JOB / "orig.png")

buf = io.BytesIO()
Image.new("RGB", (128, 128), (40, 50, 60)).save(buf, "PNG")
answer = json.dumps({
    "data": [{"b64_json": base64.b64encode(buf.getvalue()).decode()}],
    "usage": {"input_tokens": 100, "output_tokens": 100, "input_tokens_details": {"text_tokens": 100, "image_tokens": 0}},
})
casting.BASE_URL = "http://127.0.0.1:1/v1"
casting.load_key = lambda env: "FAKE-FIX-ALIAS-KEY"
calls = []


def answer_post(endpoint, fields, refs, timeout):
    calls.append(endpoint)
    return 200, answer


casting.post = answer_post
args = SimpleNamespace(id="patch", rebuild=False, go=True, env=None, timeout=1, backoff=0)
for attempt in (1, 2):
    try:
        casting.cmd_fix(casting.Spec(str(JOB / "tools" / "casting.json")), args)
    except Exception as ex:
        print("attempt %d error: %s: %s" % (attempt, type(ex).__name__, ex))
    print("attempt %d: API calls=%d, result exists=%s, ledger spent=%.4f" % (
        attempt,
        len(calls),
        (JOB / "result.png").exists(),
        casting.spent(casting.Spec(str(JOB / "tools" / "casting.json"))),
    ))
