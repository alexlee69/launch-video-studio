from pathlib import Path
import json
import os
import shutil

from PIL import Image


HERE = Path(__file__).resolve().parent
ROOT = HERE / "repro-data"
if ROOT.exists():
    shutil.rmtree(ROOT)
ROOT.mkdir(parents=True)


def image(path, color):
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (64, 64), color).save(path)


# A free paste's image output is new, but its implicit JSON sidecar already
# exists as a symlink to an unrelated file.
sidecar = ROOT / "sidecar"
sidecar.mkdir()
image(sidecar / "orig.png", (10, 20, 30))
image(sidecar / "edit.png", (200, 100, 50))
(sidecar / "victim.txt").write_text("KEEP-ME\n")
os.symlink("victim.txt", sidecar / "out.json")

sidecar_input = ROOT / "sidecar-input"
sidecar_input.mkdir()
image(sidecar_input / "orig.png", (10, 20, 30))
image(sidecar_input / "edit.png", (200, 100, 50))
os.symlink("orig.png", sidecar_input / "out.json")


def spec_job(name, body):
    job = ROOT / name
    (job / "tools").mkdir(parents=True)
    (job / "tools" / "casting.json").write_text(json.dumps(body, indent=2))
    return job


# Rebuild deletes the previous final before it proves the saved raw can be
# opened and a replacement can be produced.
state = spec_job("state", {
    "root": "..",
    "dirs": {"locked": "../cast/locked"},
    "states": {"hero": {"refs": [], "prompt": "A state.", "pin": False}},
})
(state / "cast" / "locked").mkdir(parents=True)
(state / "cast" / "locked" / "hero-gen.png").write_bytes(b"not an image")
image(state / "cast" / "locked" / "hero.png", (1, 2, 3))


# IDs are used as paths without validation; this state final is outside the
# configured locked directory.
trav = spec_job("traversal", {
    "root": "..",
    "dirs": {"locked": "../cast/locked"},
    "states": {"../victim": {"refs": [], "prompt": "A state.", "pin": False}},
})
(trav / "cast" / "locked").mkdir(parents=True)
(trav / "cast" / "victim-gen.png").write_bytes(b"not an image")
image(trav / "cast" / "victim.png", (4, 5, 6))


# pick replaces any symlink, including one it did not create.
pick = spec_job("pick", {
    "root": "..",
    "dirs": {"locations": "../stills/locations"},
    "locations": {"place": {"refs": [], "prompt": "A place."}},
})
locations = pick / "stills" / "locations"
locations.mkdir(parents=True)
image(locations / "place-v1.png", (7, 8, 9))
image(locations / "original-target.png", (11, 12, 13))
os.symlink("original-target.png", locations / "place.png")


# A non-in-place fix rebuild removes its prior good output before paste_boxes
# discovers that the saved edit has the wrong dimensions.
fix = spec_job("fix", {
    "root": "..",
    "fixes": {
        "patch": {
            "src": "../orig.png",
            "out": "../out.png",
            "edit": "../edit.png",
            "prompt": "Fix it.",
            "box": [0, 0, 32, 32],
            "feather": 0,
        }
    },
})
image(fix / "orig.png", (20, 30, 40))
image(fix / "out.png", (50, 60, 70))
Image.new("RGB", (32, 32), (80, 90, 100)).save(fix / "edit.png")


# Later-fix protection uses mtimes. Equal mtimes make the later f2 invisible
# when rebuilding f1.
chain = spec_job("fix-chain", {
    "root": "..",
    "dirs": {"locked": "../cast/locked"},
    "lock": {"hero": {"prompt": "Lock.", "pick": "unused"}},
    "fixes": {
        "f1": {"sheet": "hero", "prompt": "First fix.", "box": [0, 0, 64, 128], "feather": 0},
        "f2": {"sheet": "hero", "prompt": "Second fix.", "box": [64, 0, 128, 128], "feather": 0},
    },
})
locked = chain / "cast" / "locked"
locked.mkdir(parents=True)
original = Image.new("RGB", (128, 128), (0, 0, 0))
f1 = original.copy()
for x in range(64):
    for y in range(128):
        f1.putpixel((x, y), (200, 0, 0))
current = f1.copy()
for x in range(64, 128):
    for y in range(128):
        current.putpixel((x, y), (0, 0, 200))
original.save(locked / "hero-before-f1.png")
f1.save(locked / "hero-f1-edit.png")
f1.save(locked / "hero-before-f2.png")
current.save(locked / "hero.png")
same_time = 1_700_000_000
os.utime(locked / "hero-before-f1.png", (same_time, same_time))
os.utime(locked / "hero-before-f2.png", (same_time, same_time))

print(ROOT)
