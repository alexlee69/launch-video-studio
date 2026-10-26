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

`0` done · `1` done with warnings · `2` refused (nothing written) · `5` unexpected · `130` Ctrl-C.

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
