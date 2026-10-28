# Shot writer: from any brief to checked prompts, for the model Alex picks (mode B)

Use this once the story is locked and before key frames or footage. Each AI-footage shot becomes one entry in
`tools/shots.json`. The tool then does three things, free (no network, no key, nothing generated):
- it compiles the **key-frame prompt** (a still from the cast sheets, made by `casting.py`);
- it compiles the **video prompt** for the model Alex chose;
- it **checks both** before anything is spent.

`$V` = `~/.claude/skills/product-launch-sting/video`; it needs only `/usr/bin/python3`. Learned from The Lull's
hand-built shot list and from two Higgsfield guides: kaye.creatives' Oakley × Meta ad and the Claude Motion guide (see
`qa/video-skill-learnings/BREAKDOWN-2026-10-26.md`).

## The model question, every time

Ask Alex before writing prompts, and again before generating. The spec refuses to compile without a `model`; the film
sets it, and a shot may override it.

| | H3 (`h3`) | Seedance 2.5 (`seedance`) |
|---|---|---|
| Resolution | 1080p | 480p drafts, 720p finals |
| Length | 5–10 s | 4–30 s |
| Sound | the model's own audio, dropped in the edit | speech lip-synced with the picture, plus sound effects |
| Price on fal | $0.16/s | about $0.22/s at 480p, $0.47/s at 720p (fal's page, 2026-10-26: confirm before quoting) |
| Prompt | a short motion brief (`FOOTAGE.md` order) | the long block prompt below |
| Choose it for | silent plates under UI, sharpness | people talking, a product that answers, long continuous takes |

## Intake: whatever Alex gives, his words stay his

| Alex gives | How it goes into the spec |
|---|---|
| A few sentences | Claude proposes the shots. The sentences stay verbatim in each shot's `brief`. Everything Claude adds is listed in `proposed` |
| A detailed brief or a script | Shots are cut from it as written. Lines, actions and specifics go into `script` and the fields as given; only what it doesn't cover is proposed |
| A rough storyboard (drawings, photos, frames) | Each frame becomes that shot's `position.file` (with a `legend` if he drew in colours) and its first-frame guide; his notes become the brief |
| "Let's write it together" | GUIDE step 2 (directions → logline; for a recreation, `RECREATE.md` → The story), then the same spec |

**Proposals wait for his OK.** `show ID` prints the prompts with the proposed fields listed. `check` warns until they
are confirmed, and `confirm ID` records that he OK'd them. `build` and `emit-casting` refuse a shot that still has
unconfirmed proposals, so no prompt goes towards a paid call before his OK.

## Commands

```bash
cd DIR                                                        # the job folder; the spec lives in tools/
python3 $V/shots/shots.py init --model h3|seedance [--shots S01,S02]   # starter (never overwrites)
python3 $V/shots/shots.py check                               # lint every shot
python3 $V/shots/shots.py show S01                            # one shot's prompts + what is still only proposed
python3 $V/shots/shots.py confirm S01 S02                     # Alex OK'd those shots' proposals
python3 $V/shots/shots.py build [S01 …]                       # shots/<ID>.key.txt + <ID>.h3.txt|.seedance.txt + shots/plan.json
python3 $V/shots/shots.py emit-casting [S01 …]                # key frames into casting.json "stills" (its own entries only)
python3 $V/shots/shots.py fov 35                              # 35 mm → about 54 degrees across
```

`plan.json` holds a dry-run `gen.mjs` line per shot built so far: a `build S02` replaces S02's row and keeps the others
while their shots still compile the same (a shot changed since is dropped, with a note to build it again). A Seedance
row has its draft line (`gen`, at `res`, 480p by default) and a `final` line at 720p for the chosen take. The key
frames go through `casting.py stills` (quoted, then `--go`). Each video goes through `gen.mjs` (quoted, Alex's yes,
then `--go`). `show` prints a shot's prompts and exits 2 while anything in the spec is refused.

## The spec (`tools/shots.json`)

Paths are relative to the job folder. Unknown keys, duplicate keys and a value of the wrong type are refused, so a
typo can't fail silently. Every `<FILL: …>` hint must be replaced; Alex's own words in `brief` and `script` may hold
anything, `<beat>` included.

| Key | What it is |
|---|---|
| `model` | `h3` or `seedance`, asked each time (a shot may override) |
| `res` | Seedance's draft resolution: `480p` (the default) or `720p` |
| `casting` | the casting spec (default `casting.json`, beside this one): sheets and locations are checked against it |
| `placeholders` | the storyboard's plate spec (default `placeholders.json`, beside this one), where `position.plate` finds its pencil sketch |
| `people.ID` | `{sheet, is}`: **every** character, extras and animals included, each with a sheet (`CASTING.md`) |
| `products.ID` | `{ref, anatomy, colourway, is}`: the product photo, its parts in words, this film's colours (the shape never changes), and how a line it speaks names it (default "the ID") |
| `places.ID` | `{loc}`: a casting location plate |
| `text`, `ban` | snippets (`{NAME}`) and the build-check words, as in `casting.py` |
| `shots.ID.brief`, `script` | Alex's own words, verbatim |
| `proposed`, `confirmed` | what Claude added; what Alex OK'd (`confirm`) |
| `recipe`, `sec`, `aspect` | a recipe (below) for the defaults; length in whole seconds (gen.mjs asks for whole seconds); aspect (the key frame is made at casting.json's `sizes`: a mismatch warns) |
| `people`, `products`, `place`, `extras` | who and what is in the shot; `extras` is a note of unsheeted background figures: it warns and goes into no prompt (describe them in the frame) |
| `position` | `{plate}`: a storyboard plate's pencil sketch (`STORYBOARD.md` → Pencil sketches), its legend read from beside it; or `{file, legend}`: Alex's own drawing. It shapes the key frame |
| `key` | `{frame, light, lens, batch, face, id, dir}`, or `prompt` + `refs` written by hand (job-relative, like every path here: `emit-casting` rewrites them for casting.json); `id` and `dir` name files (letters, digits, `. _ -`), and each key's id is its own, not even differing only by case |
| `motion` | `{camera, beats, extra, hold, tail}` or `prompt` written by hand. A beat is a sentence, or `{t: [start, end], do, say}`, where `say` is `{who, line, voice}`: `who` is a person in this shot (lip-synced; with one person it may be left out), a product in it (a voice from it), or `"voiceover"` (no one in the frame). Anything else is refused |
| `scene`, `first`, `final` | Seedance: the whole shot, its first frame, its final framing |
| `lens` | `{mm, distance, focus, look}`; the angle is computed (2·atan(18/mm)) |
| `light`, `palette`, `temp` | the light; `{only, accent, notes}`; `warm`, `cold` or `neutral` (for the contrast rule) |
| `count`, `physics`, `realism`, `audio`, `locks`, `links` | head count (never fewer than the people listed); physical rules; a realism text or preset; the sounds, and nothing else; what must not change; `{from, via}`: the element that crosses from shot `from` into this one (both prompts must name it, or it warns) |
| `trick`, `must`, `fail`, `refs`, `task`, `acting`, `sizes`, `negatives` | all optional: the shot's one mechanical idea, the 1–2 rules that can't break, how it fails, what not to take from each reference, a small task, acting, sizes three ways, the trick's inversions (below: **One trick, unbreakable rules, failure lines, acting**) |

## What gets compiled

- **Key frame** (`casting.py stills`):
  - a numbered preamble, one job per image, in the order the images are sent (sheets, place, product, sketch), so "Image N" always matches;
  - the sketch's line says it is the position reference only, gives its legend (the RED marks are …), and says none
    of its lines, colours or paper appear in the frame;
  - a product with no photo is described in words alone (it warns: it won't match the real one);
  - then the first frame, the light, the lens and `{KEY_TAIL}`.

  Casting's own snippets (`{PRE_FACE}`, `{NEG}` …, and any name casting.json defines) stay as written for `casting.py`
  to expand. `build` and `show` print the key frame exactly as `casting.py` will send it, `{FOV:35}` included: this
  spec's snippets first, then casting's own expansion of the rest (a casting.json snippet that names one of shots.py's
  built-ins is refused, as `casting.py` would refuse it).
- **H3** follows `FOOTAGE.md`'s motion-brief order: camera → beats → extra → `{H3_TAIL}` ("keep the look of the first frame … no text").
  A slow-motion realism (`{SLOWMO_120}`) goes in before the tail, and the tail then drops "real-time" (`{H3_TAIL_SLOW}`).
  A spoken line stays out of an H3 prompt (no lip-sync there): the edit adds it as a subtitle or a voiceover. So on
  H3 a line's speaker isn't checked, but every beat needs its action (`do`).
- **Seedance** is a block prompt, in this order:
  1. REFERENCES: the input image is the first frame, and its people, place, light and product stay as they are (with
     the product's anatomy), then the medium claim. Seedance runs image-to-video on the approved key frame, so the
     sheets, the place and the sketch reach it through that frame;
  2. SCENE and FIRST FRAME;
  3. OPTICS: mm plus the angle, one constant focal length (and "straight lines stay straight" only for a lens with no
     distortion);
  4. CAMERA: one move, then a hold (none after a locked-off camera);
  5. FINAL FRAMING;
  6. ACTION: time-coded, every line verbatim and lip-synced. A product's voice is "From the glasses, a voice says …"; a
     voiceover's, "A voice-over, from no one in the frame, says …";
  7. BODY AND PHYSICS: the exact head count;
  8. LIGHT, COLOUR and REALISM;
  9. AUDIO: "exactly these sounds and nothing else: the spoken lines above; … No music", because the score is ours
     (with no `audio` list there is no AUDIO block, it warns, and "No music." goes into LOCKS);
  10. LOCKS: the lines, plus `{NO_TEXT}`.

  The fields of **One trick, unbreakable rules, failure lines, acting** (below) slot into these blocks: the trick, the
  must rules and the task open the ACTION, the acting follows its beats, sizes go into BODY AND PHYSICS, fail lines and
  confirmed negatives into LOCKS.

  Kaye sent her references straight to Seedance (reference-to-video: `@Image1` … plus a MAP LEGEND for the sketch,
  no key frame). That route waits until fal's reference-to-video fields are confirmed; then the references and the
  legend move into the video prompt.

## The checks

**✗ refused:**
- no model;
- an unfilled hint or placeholder;
- an unknown snippet;
- a ban word;
- a prompt without "no text";
- a length outside the model's range, or not in whole seconds;
- a person with no sheet in `casting.json` (her campfire scene invented strangers without them);
- a place that isn't a casting location;
- a reference file that isn't there;
- a position with both a file and a plate, a plate the storyboard spec doesn't have, or a plate not sketched yet (the
  message gives the `sketch` command);
- "Image N" beyond the images sent;
- a brace left in a prompt after expansion (a typo'd snippet: `{FOV: 35}`, `{FOV:35.`, `{KEY_TAIL`);
- a key that says nothing about its frame (no `key.frame`, no `first`);
- a spoken line whose `who` is no one in this shot (nothing is guessed);
- a head count smaller than the people listed;
- two shots with one key id, or a `key.id` / `key.dir` that isn't a plain name;
- two shot ids, or two key ids, that differ only by case (one file on macOS);
- a Seedance beat that ends after the shot does;
- a `res` other than 480p or 720p;
- a `links.from` that isn't a shot;
- a line too long for its beat (more than 2.7 words a second, or 4 CJK characters a second). Words count in any
  script that puts spaces between them, accents and vowel signs included; a line in Thai, Lao, Khmer or Myanmar isn't
  timed (it warns: time it by ear);
- on Seedance: untimed beats, a missing scene or first frame.

**! warned:**
- more than one camera move;
- beats that don't tile the shot;
- too many beats for H3;
- "in the style of …" in a compiled prompt (say the lens, distance, light and movement instead; Alex's brief may say it);
- dialogue on H3 (no lip-sync there: the line stays out of the prompt and the edit adds it);
- extras without sheets;
- proposals not yet OK'd;
- three warm or three cold shots in a row;
- recipe expectations not met;
- on Seedance, no head count, or no `audio` list;
- a product with no photo (`ref`);
- a key frame asked for an aspect casting.json's `sizes` doesn't make;
- a snippet both specs define differently (a key frame that names it itself gets this spec's; a casting.json snippet
  that names it gets casting.json's);
- a linked element one of its two prompts never names;
- a sketch drawn before its plate last changed;
- a position with no legend, or on a shot with no key (the sketch only shapes the key frame).

## One trick, unbreakable rules, failure lines, acting

Ideas taken from a prompt library for AI video that we studied (2026-10-26), written in our own words. A model follows
a mechanism better than a description: give each shot **one trick** and derive what follows from it, say which rules
come first, describe how the shot fails, and measure things instead of praising them. Every field is optional and
type-checked like the rest; a shot without them compiles exactly as before.

| Key | What it is | Where it goes |
|---|---|---|
| `trick` | the one mechanical idea the shot is built on, one sentence (`"rule"`), or `{rule, so: [3–4 consequences]}`: "the frame never moves, and the crossing's countdown is the clock she races" | first in the ACTION (H3: right after the camera sentence, as "Rule of the shot: …") |
| `must` | the 1–2 rules that may never break | the ACTION, after the trick, marked as coming before everything else |
| `fail` | one line per weak point, as a condition: "the count skips" → "If the count skips, the shot is wrong." A leading if / when / whenever / once is dropped; a line that is already a whole verdict ("if …, the shot is wrong", "the shot is wrong if …") stays as written. A line that only names a wrong thing ("she grabs the wrong cup") still gets the frame, so it never reads as an instruction | LOCKS; H3 takes them while its prompt stays within 120 words, and warns about any it leaves out |
| `refs` | `[{ref, dont: [...]}]`: per reference image, what NOT to take from it (its people, light, grade, depth of field, framing, props …). `ref` is one of the shot's people, its place, its products, `position` (the sketch), or `first`: the input image Seedance animates. That one is already frame 1, so its list is what must not carry on from it into the motion or build up (a glare that should not spread, a prop that must not multiply) | the key frame, right after that image's line ("Take nothing else from Image 2: not …"); `first` goes in Seedance's REFERENCES, after what to keep ("From it, let none of this carry on into the motion or build up: …") |
| `task` | the small task the person keeps doing through the whole shot, never dropped at the main event ("she keeps glancing down at the band") | the ACTION, after the must rules |
| `acting` | `{who, direction, motive, goal, obstacle, tactic, eyes: [{t, do}], restrained, lens: [[start, end]]}`: the inner task (only the tactic shows on screen), eye beats on the timecodes, `restrained: true` (the strong moments land in the hands, breath and footing, not the face), and the moments the person may look into the lens (never, unless listed). `who` may be left out when the shot has one person | the ACTION, after the timed beats; the gaze line is always there once `acting` is given |
| `sizes` | `{"the band": {frame, body, hand}}`: each key object measured three ways, against the frame, the body and the hand, so the three cross-check each other. On a shot without people, measure it against the frame and something in it only ("a fifth of the frame width, about half the cup's width"): a body or hand measure there invites one into the picture | the key frame, after the first frame; Seedance's BODY AND PHYSICS, with "nothing changes its real size" (only distance changes how big it looks) |
| `negatives` | the trick turned inside out ("the camera pans or drifts", "the count freezes"). Claude writes them, so they sit in `proposed` | LOCKS ("None of these may happen: …"), and only once `confirmed`: `show` lists them apart until then |

**The short H3 prompt** gains only the trick and the fail lines that fit; `must`, `task`, `acting` and `negatives`
reach a Seedance prompt only (it warns when an H3 shot has them). The key frame gains `sizes` and the `refs` lines on
either model. A hand-written `motion.prompt` or `key.prompt` is never changed: it warns that the fields it would have
carried are left out.

**The checks.** Refused, one line each: a field of the wrong type; a trick without its rule; an empty entry (in `must`,
`fail`, `negatives`, `trick.so` or a `dont` list); a `refs` entry naming no reference of this shot, named twice, or
without `dont`; `acting` on a shot with no people, or with several and no `who`; an eye beat or a look into the lens
outside the shot; a size with none of the three measures.

Warned, on a shot that uses any of these fields:
- vague words (slightly, a little, beautiful, stunning, nice, somewhat, very) in the shot's own text: give a number or a
  comparison with the body (the recipe's and the snippets' words aren't counted, nor Alex's brief and script, nor the
  spoken lines);
- a trick of more than one sentence, or other than 3–4 consequences; more than 2 must rules;
- `acting` with none of direction, motive, goal, obstacle, tactic or eyes (it would add only the gaze line);
- fewer than 3 measures of a size on a shot with people, or a body or hand measure on a shot without;
- negatives with no trick, or not listed in `proposed`; a task with no person; a `dont` for a product with no photo;
- an H3 prompt over 120 words.

Info (`i`, never changes the exit code): a Seedance shot with people and no task (H3 can't carry a task, so H3 shots
don't get it); the same vague words in a shot that uses none of these fields, so old specs check as before.

**Worked example** (`shots/examples/phase2-band-shots.json`, a fictional fitness band; put it beside a casting.json
with the sheet `runner` and the location `bridge`). K01 on Seedance uses every field: a locked frame where the
crossing's countdown is the clock she races. Its negatives are still only proposed, so `show K01` lists them apart and
none reaches the prompt. The spec, cut down (the file has all of it):

```json
"trick": {"rule": "The frame never moves, and the crossing's countdown in the near corner is the shot's clock: she has to cover the whole bridge before it reaches zero.",
          "so": ["The count drops by one each second, from 8 to 1, sharp in every frame.", "She grows from a small figure at the far end to the full frame height at the kerb.",
                 "Everything else stays behind her: the traffic never crosses between her and the camera.", "She reaches the kerb as the count shows 1, not earlier and not later."]},
"must": ["The camera is locked off: it never pans, tilts, zooms or drifts.", "The count drops by exactly one each second and never skips or repeats."],
"fail": ["the count skips, repeats or runs backwards", "she reaches the kerb after the count shows 0"],
"refs": [{"ref": "runner", "dont": ["the grey backdrop", "the flat studio light", "the sheet's layout"]},
         {"ref": "first", "dont": ["the glare on the countdown box's glass"]}],
"task": "she keeps glancing down at the band on her wrist between strides",
"acting": {"direction": "she wants to make the crossing without breaking stride", "obstacle": "a wide puddle lies across her line halfway over",
           "tactic": "she swings wide round it and lengthens her stride instead of slowing", "restrained": true,
           "eyes": [{"t": [3, 5], "do": "on the puddle's near edge, judging her line round it"}]},
"sizes": {"the band": {"frame": "4 % of the frame width once she reaches the kerb", "body": "as wide as two of her fingers", "hand": "it wraps her wrist with a thumb's width to spare"}}
```

What it compiles to (lines from `show K01` and `show K02`, word for word; `test_phase2.py` checks they still are):

<!-- phase2-example -->
```text
Image 1 is the runner's locked character sheet: the face in its LEFT close-up is the only face to use, and its other panels show the wardrobe. Take nothing else from Image 1: not the grey backdrop, the flat studio light or the sheet's layout.
REFERENCES: The input image is the first frame of this shot. Keep exactly as they are: the people in it (the runner) with their faces, bodies and wardrobe; the place; the light; the product. Only what the ACTION describes changes. From it, let none of this carry on into the motion or build up: the glare on the countdown box's glass. The band is a flat matte strap with a small square face of black glass and one side button. This is real live-action footage, shot in camera on location by a real crew: real people, real places, real weather.
Rule of the shot, and everything in it follows from this: The frame never moves, and the crossing's countdown in the near corner is the shot's clock: she has to cover the whole bridge before it reaches zero. It follows that: The count drops by one each second, from 8 to 1, sharp in every frame. She grows from a small figure at the far end to the full frame height at the kerb. Everything else stays behind her: the traffic never crosses between her and the camera. She reaches the kerb as the count shows 1, not earlier and not later.
These two rules come before everything else in this shot, never traded for anything: The camera is locked off: it never pans, tilts, zooms or drifts. The count drops by exactly one each second and never skips or repeats.
All through the shot, first frame to last, they keep at one ordinary job: she keeps glancing down at the band on her wrist between strides. The event does not stop it and the camera does not feature it; whatever the event stirs in them stays smaller than this.
The runner's eyes, moment by moment: 0:00-0:03 on the countdown far ahead, then a flick down to the band; 0:03-0:05 on the puddle's near edge, judging her line round it; 0:05-0:08 back on the count, then the band.
The runner never looks into the lens. Head and eyes always turn the same way; the blinks keep no rhythm; the eyes keep working and never park on one point.
LOCKS: If the count skips, repeats or runs backwards, the shot is wrong. If she reaches the kerb after the count shows 0, the shot is wrong. No text, captions, subtitles or logos appear anywhere in the frame.
Straight down, locked off. Rule of the shot: The window frame's shadow is the moving part: its edge sweeps across the still desk and reaches the band at the moment its face lights. The shadow's edge sweeps slowly across the desk toward the band. The band's face lights up once with a soft glow. If the band moves, turns or slides on the desk, the shot is wrong. If the camera moves, the shot is wrong. Real-time, natural, candid motion. Keep the lighting, colours, depth of field and film grain of the first frame. No text, no captions, no logos.
```
<!-- /phase2-example -->

After `shots.py confirm K01`, LOCKS gains, before its no-text line: "None of these may happen: the camera pans, tilts,
zooms or drifts; the count freezes, skips or runs backwards; she reaches the kerb early and waits; a second runner
appears on the bridge." The last line above is K02's whole H3 prompt: the camera, the trick, the beats, both fail lines
(they fit), the tail. K02 has no people, so its band is sized against the frame and the cup only.

## Recipes (`shots/recipes.json`)

| Recipe | For | Defaults |
|---|---|---|
| `reveal-pullback` | the opening, the hook | 35 mm; one slow dolly-out, then a hold |
| `chase` | speed (**wide lens = speed**: near things streak, far ones barely move) | 24 mm, behind and above, banking late |
| `pov-action-cam` | what the subject sees; **a POV sells anything that records or sees** | ~150° action cam, constant shake |
| `pan-reveal-smear` | a gag: the subject tears past as a smear with one flash of the brand colour | 35 mm tripod pan, then a hold |
| `side-track-slowmo` | power and grace | 35 mm from about 40 m; 120 fps ≈ quarter speed |
| `telephoto-face-slowmo` | effort in a face | 100 mm, razor focus; 120 fps |
| `aerial-orbit` | scale, a small figure in a huge place | 24 mm, a 180° half orbit |
| `ultrawide-handheld` | intimacy, with the world still visible | 14 mm at 50–60 cm, one long take |
| `top-shot` | hands at work on a surface | straight down, locked off |
| `natural-packshot` | the product inside a real gesture, never posed | 100 mm macro at 45°, travelling with it |
| `telephoto-shore` | a compressed wall behind the subject | 300 mm from about 150 m |
| `product-answers` | a feature shown by talking: the product answers out loud (Seedance) | sound only |
| `fpv-hatch`, `kitchen-pushin`, `selfie-card` | ours, from The Lull and the Cue film | as there |

## Story and edit rules

- **For a recreation:** keep the reference's story engine and change its world (`RECREATE.md` → The story).
- **Product features become beats.** List the product's features from its own page; each one gets a moment. A speaker
  or a voice becomes "the product answers"; a camera becomes a POV shot.
- **Open on the hook:** the most arresting image you have, chosen from the reference photos or moodboard.
- **Pick an arc:**
  - launch: an intriguing detail → a reveal → the defining feature → a product-and-name lockup;
  - SaaS: select → change → a better result → name + call to action;
  - journey: into the app → transformations → back out to the payoff;
  - life moments: scenes where the product answers, then a slow close (a plan, friends, the packshot).
- **Temperature contrast:** neighbouring shots alternate warm and cold (`temp`); three of one in a row is warned.
- **Link scenes:** let a shared element cross from one scene into the next (`links`, e.g. the flyer passes the cyclist).
- **Pace:** about 4 s a shot in a live-action montage; 0.5–1 s a beat in a motion intro.
- **Dialogue:** subtitles are burned in by the edit, never generated. Seedance keeps the voice; on H3 the line becomes a
  subtitle or a voiceover.
- **The end:** a natural packshot, then the lockup inside a frame motif tied to the product (a viewfinder for a camera).
- **Drafts on Seedance:** 480p first, then the chosen take at 720p. A re-render isn't guaranteed to match the draft:
  check it.

## Seedance through `gen.mjs`

```bash
node $V/footage/gen.mjs video --endpoint bytedance/seedance-2.5/image-to-video --image KEY.jpg --prompt @shots/S01.seedance.txt \
  --out footage/fal/S01.mp4 --sec 10 --res 480p [--end LAST.jpg] [--audio on|off]   # dry run + quote; --go after Alex's yes
```

- **The fields** are the ones fal's docs list: `image_url`, `end_image_url`, `duration`, `resolution`,
  `generate_audio`, `seed`. They are unconfirmed from this Mac (fal.ai doesn't load here): check them on the endpoint's
  page before the first `--go`, since a field fal ignores would give a clip of another length or size than quoted.
- **Sound is on,** because the voice is the point. `conform.py` drops a clip's audio, so its lines reach the film
  through `voiceover:` (GUIDE.md). Cut the same window conform used out of the clip's sound,
  `ffmpeg -ss <conform --start> -t <the shot's seconds> -i footage/fal/S02.mp4 -vn -ac 2 -ar 48000 assets/S02-lines.wav`,
  and set `voiceover: {file: assets/S02-lines.wav, start: <the shot's start in the film>}`. Several talking shots:
  place each at its start (`adelay`) and mix them into one file (`amix`).
- **The prompt keeps its line breaks,** so each block and each timed beat stays on its own line. (An H3 prompt file is
  still joined into one line, as before.)
- **Reference-to-video** (tagged references, Kaye's route) is not wired yet: Seedance animates the key frame.

## Worked example: The Lull (manus2-space)

`shots/examples/manus2-space-shots.json` is built from the job's own files (`qa/shots-skill-port/make_example.py`):
- **20 shots:** 19 compile **byte for byte** to the H3 prompts actually sent. Each one is split into camera, beats,
  extra and a tail snippet (`{MTAIL}`; S24 has its own "keep the colours" sentence, then `{ATAIL}`). The hand-written
  retake `S01-1c-t2` is kept verbatim as `motion.prompt`.
- **`emit-casting`** rebuilds the 19 matching key-frame stills of `casting/examples/manus2-space-casting.json`, identical
  apart from the ownership mark.
- **The checks** pass with two honest warnings: S04-4A tilts and then pushes in, and S14-14A moves twice.

To use it, put it beside the job's `tools/casting.json` as `tools/shots.json`.

## Exit codes

`0` done · `1` done with warnings · `2` refused (nothing written) · `5` unexpected · `130` Ctrl-C. Info lines (`i`)
never change the exit code.

## Traps

- **Key frames keep casting's snippets.** `build` writes the expanded text for reading; `emit-casting` writes the
  unexpanded text for `casting.py`.
- **`emit-casting` only replaces its own stills** (`meta.from: "shots"`). Any other still with that id is refused:
  rename the key (`key.id`), as is one whose id differs only by case. One of its own that was edited in casting.json
  since (any field shots.py writes: prompt, refs, batch, dir, face, meta) is refused too, unless the new one would be
  the same (move the edit into `key.prompt`), or `--force`. Fields shots.py doesn't write, such as `n`, stay as set
  there. When a still that was already made changes, it says so: `casting.py` skips a still with variants, so make
  the new one with `stills --only ID --go --redo` (quoted first; `--batch` would re-make the whole batch).
- **`key.refs` written by hand needs `key.prompt` too**, or the numbered preamble would describe the wrong images.
- **The camera-move check is a heuristic.** It catches "pushes in … then tilts up", not every phrasing; read the
  prompt (`show`).
- **The Seedance prices and fields are as fal's page showed them on 2026-10-26.** Re-check both on fal.ai before the
  first quote.
