# Try the shot writer (free: nothing is sent, nothing is spent)

A small job with two storyboard plates and their pencil sketches, a filled casting spec, and three shots:
- **S01:** an H3 reveal written from your words.
- **S02:** a Seedance dialogue shot from a short script.
- **S03:** a shot where my additions still wait for your OK.

```bash
cd ~/Downloads/launch-videos/shots-demo
V=~/.claude/skills/product-launch-sting/video
open assets/plates/sketches-sheet.jpg assets/plates/placeholders-sheet.jpg   # the pencil sketches beside the plates
python3 $V/shots/shots.py check              # warns that S03 still waits for your OK
python3 $V/shots/shots.py show S02           # the Seedance block prompt: the line lip-synced, "No music"
python3 $V/shots/shots.py show S03           # your words, my proposals, the prompts
python3 $V/shots/shots.py confirm S03        # you OK S03's proposals
python3 $V/shots/shots.py build              # shots/*.txt + shots/plan.json (draft at 480p, final at 720p)
python3 $V/shots/shots.py emit-casting       # the key frames into tools/casting.json
python3 $V/casting/casting.py plan stills --show S02   # the quote and the exact prompt, nothing sent
node $V/footage/gen.mjs video --endpoint bytedance/seedance-2.5/image-to-video --image assets/plates/S02.png \
  --prompt @shots/S02.seedance.txt --out footage/fal/S02.mp4 --sec 6 --res 480p   # a dry run with the price: never add --go
```

**Things to try breaking:**
- In `tools/shots.json`, give S02's line to `"who": "Narrator"`, or make S02 `"sec": 6.5`. Both are refused.
- Move the person in `tools/placeholders.json` (S01's `"x"`), then run `check`: it says the sketch is out of date.
  `python3 $V/storyboard/placeholders.py sketch S01` redraws it.

Rebuild this folder at any time: `/usr/bin/python3 -B ~/Downloads/Design-AutoPilot-stable/qa/shots-skill-port/make_demo.py --fresh`.
