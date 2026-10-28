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
module_spec = importlib.util.spec_from_file_location("casting_state_collision_probe", CASTING)
casting = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(casting)

JOB = HERE / "state-collision-job"
if JOB.exists():
    shutil.rmtree(JOB)
(JOB / "tools").mkdir(parents=True)
(JOB / "tools" / "casting.json").write_text(json.dumps({
    "root": "..",
    "cap": 5,
    "sizes": ["128x128"],
    "states": {
        "foo": {"refs": [], "prompt": "FIRST", "pin": False},
        "foo-gen": {"refs": [], "prompt": "SECOND", "pin": False},
    },
}, indent=2))


def body(color):
    buf = io.BytesIO()
    Image.new("RGB", (128, 128), color).save(buf, "PNG")
    return json.dumps({
        "data": [{"b64_json": base64.b64encode(buf.getvalue()).decode()}],
        "usage": {"input_tokens": 1, "output_tokens": 1, "input_tokens_details": {"text_tokens": 1, "image_tokens": 0}},
    })


answers = [body((200, 0, 0)), body((0, 0, 200))]
casting.BASE_URL = "http://127.0.0.1:1/v1"
casting.load_key = lambda env: "FAKE-STATE-COLLISION-KEY"
casting.post = lambda endpoint, fields, refs, timeout: (200, answers.pop(0))
args = SimpleNamespace(only=None, rebuild=False, go=True, env=None, timeout=1, backoff=0)
casting.cmd_states(casting.Spec(str(JOB / "tools" / "casting.json")), args)

raw = JOB / "cast" / "locked" / "foo-gen.png"
record = json.loads((JOB / "cast" / "locked" / "foo-gen.req.json").read_text())
print("foo's raw pixel after both paid calls:", Image.open(raw).getpixel((0, 0)))
print("the adjacent req.json still says prompt:", record["prompt"])
