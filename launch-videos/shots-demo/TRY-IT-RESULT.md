# Shot-writer demo: what happened when I ran it (2026-10-26)

Everything below ran on `~/Downloads/launch-videos/shots-demo`. Nothing was sent anywhere and nothing was spent. The
full output is in `demo-run.log` and `demo-break.log` beside this file.

## 1 · The pencil sketches

`demo-plates-vs-sketches.jpg` puts each storyboard plate next to the pencil sketch drawn from it. The key-frame
prompt sends the sketch, so the generated frame takes its blocking:
- **Red:** the people.
- **Yellow:** the heads (the red cross shows where the face looks) and the laptop.
- **Green:** the ground line.
- **Grey:** the place and the sun.

## 2 · `check`: S03 waits for your OK

```
! shots.S03: still only proposed, not yet OK'd by Alex: recipe, key.frame, motion (show it, then `shots.py confirm S03`)
✓ tools/shots.json: 3 shots, MiniMax H3 (fal), Seedance 2.5 (fal)
```

## 3 · `show S02`: the Seedance prompt written from your script

The script, kept verbatim: `She turns to him: "We made it." He laughs.`

```
REFERENCES: The input image is the first frame of this shot. Keep exactly as they are: the people in it (the founder
and her co-founder) with their faces, bodies and wardrobe; the place; the light. Only what the ACTION describes
changes. This is real live-action footage, shot in camera on location by a real crew: real people, real places, real
weather.

SCENE: The two founders stand at the office window at golden hour, the city behind them.

FIRST FRAME: Medium-wide: both at the window, she on the left, he on the right, looking out.

OPTICS: 50 mm full-frame look, about 40 degrees horizontal field of view, from about three metres. One constant focal
length for the whole shot; straight lines stay straight.

CAMERA: Locked off.

ACTION:
0:00-0:03. She turns to him. The founder says, lip-synced and word for word: "We made it."
0:03-0:06. He laughs and puts an arm round her shoulders.

BODY AND PHYSICS: Exactly two people are visible in this shot. Every body keeps its limb lengths, joints bend only the
way real joints bend, and gravity is real.

AUDIO: The soundtrack holds exactly these sounds and nothing else: the spoken lines above; his laugh; the hum of the
city. No music.

LOCKS: The only spoken words are "We made it." No text, captions, subtitles or logos appear anywhere in the frame.
```

Its key frame names four images in the order they are sent: her sheet, his sheet, the office plate, then the pencil
sketch with its colour legend.

## 4 · `show S03` then `confirm S03`: your words stay yours

- **Your brief, verbatim:** "Something that shows the laptop, the launch moment."
- **My proposals:** the `top-shot` recipe, the key frame, the motion. `confirm S03` recorded your OK; until then,
  `build` and `emit-casting` refused S03.

## 5 · `build`: prompt files and plan lines

```
→ S01  shots/S01.h3.txt  69 words  + shots/S01.key.txt
→ S02  shots/S02.seedance.txt  235 words  + shots/S02.key.txt
→ S03  shots/S03.h3.txt  57 words  + shots/S03.key.txt
```

`shots/plan.json` holds the dry-run commands. For S02 that is a 480p draft and a 720p final for the take you pick:

```
S02 draft: --sec 6 --res 480p  → footage/fal/S02.mp4
S02 final: --sec 6 --res 720p  → footage/fal/S02-720p.mp4
```

## 6 · `emit-casting` and `casting.py plan`: the key frames, quoted

```
still S01  edits  n=2  refs=hero.png,office.png,S01-sketch.png              $0.52
still S02  edits  n=2  refs=hero.png,cofounder.png,office.png,S02-sketch.png $0.54
still S03  edits  n=2  refs=hero.png,office.png                             $0.49
stills --batch identity: 3 calls, 6 images, quote $1.55 · spent so far $0.00
```

They wait for the locked sheets and the office plate, which casting makes first.

## 7 · The Seedance quote (dry run)

```
endpoint  bytedance/seedance-2.5/image-to-video
input     prompt (the block above, its line breaks kept), image_url, duration "6", resolution "480p", generate_audio true
estimate  6 s × about $0.2205/s at 480p = about $1.32 (fal's page as found 2026-10-26, unconfirmed: check before quoting)
dry run — show the user the prompt and the estimate; add --go once they approve the spend
```

## 8 · Things I tried to break (on a copy)

| What I did | What happened |
|---|---|
| Gave S02's line to "Narrator" | ✗ refused: "whose line? One of this shot's people (founder, cofounder), its products, or voiceover" |
| Made S02 6.5 s | ✗ refused: "whole seconds (gen.mjs asks the model for whole seconds)" |
| Moved the person on plate S01 | ! warned: "the sketch was drawn before plate S01 last changed; draw it again" |
| Drew S01's sketch again | ✓ check clean |
