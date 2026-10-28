from pathlib import Path
from types import SimpleNamespace
import base64
import hashlib
import importlib.util
import io
import json
import shutil
import sys

from PIL import Image


HERE = Path(__file__).resolve().parent
CASTING = Path.home() / ".claude/skills/product-launch-sting/video/casting/casting.py"
sys.path.insert(0, str(CASTING.parent.parent / "footage"))
module_spec = importlib.util.spec_from_file_location("casting_composite_probe", CASTING)
casting = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(casting)

JOB = HERE / "lock-composite-job"
if JOB.exists():
    shutil.rmtree(JOB)
(JOB / "tools").mkdir(parents=True)
(JOB / "cast" / "candidates").mkdir(parents=True)
(JOB / "cast" / "locked").mkdir(parents=True)
(JOB / "tools" / "casting.json").write_text(json.dumps({
    "root": "..",
    "cap": 5,
    "sizes": ["128x128"],
    "dirs": {"candidates": "../cast/candidates", "locked": "../cast/locked"},
    "lock": {
        "hero": {
            "pick": "cand-01",
            "prompt": "Erase the body face.",
            "restore": {"ellipse": [32, 32, 16, 16], "feather": 2},
            "pin": False,
        }
    },
}, indent=2))

candidate = JOB / "cast" / "candidates" / "cand-01.png"
composite = JOB / "cast" / "locked" / "hero-composite.png"
Image.new("RGB", (128, 128), (10, 20, 30)).save(candidate)
Image.new("RGB", (128, 128), (250, 0, 0)).save(composite)
before = hashlib.sha256(composite.read_bytes()).hexdigest()

buf = io.BytesIO()
Image.new("RGB", (128, 128), (40, 50, 60)).save(buf, "PNG")
answer = json.dumps({
    "data": [{"b64_json": base64.b64encode(buf.getvalue()).decode()}],
    "usage": {"input_tokens": 1, "output_tokens": 1, "input_tokens_details": {"text_tokens": 1, "image_tokens": 0}},
})
casting.BASE_URL = "http://127.0.0.1:1/v1"
casting.load_key = lambda env: "FAKE-COMPOSITE-KEY"
casting.post = lambda endpoint, fields, refs, timeout: (200, answer)

args = SimpleNamespace(pick="cand-01", rebuild=False, go=True, env=None, timeout=1, backoff=0)
casting.cmd_lock(casting.Spec(str(JOB / "tools" / "casting.json")), args)
after = hashlib.sha256(composite.read_bytes()).hexdigest()
print("pre-existing composite hash before:", before)
print("pre-existing composite hash after: ", after)
print("overwritten:", before != after)
