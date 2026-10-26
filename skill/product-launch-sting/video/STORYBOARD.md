# Storyboard before any footage: placeholder plates and the phone edition (mode B)

Use this when a film's shots will be AI footage (`FOOTAGE.md`) that doesn't exist yet. The storyboard is approved before
anything is spent (GUIDE step 4), so each footage shot stands on a **placeholder plate**: a labelled stand-in still drawn
in code, free, with nothing generated. (Not to be confused with the *footage plates* `footage/plates.py` assembles from
generated clips, or casting's *location plates*.) The storyboard runs on those placeholder plates; once it is approved,
the person is cast (`CASTING.md`), the footage generated (`FOOTAGE.md`), and each shot's `bg:` swapped to its real
footage. The **phone edition** turns the storyboard into a PDF a phone opens, for a review away from the desk.

`$V` = `~/.claude/skills/product-launch-sting/video`. Requirements: `/usr/bin/python3` with numpy and Pillow (missing:
`pip3 install numpy pillow`; the tool says so and stops) and node, as for the rest of mode B.

```bash
cd DIR                                                              # the job folder (it holds beats.yaml)
python3 $V/storyboard/placeholders.py init --shots S01,S04,S09      # tools/placeholders.json, one plate per shot (never overwrites)
python3 $V/storyboard/placeholders.py check                          # validate only
python3 $V/storyboard/placeholders.py draw [S01 …] [--sheet]         # assets/plates/<ID>.png (+ a contact sheet); redraws only its own files
python3 $V/storyboard/placeholders.py sketch [S01 …] [--sheet]       # the same plates as pencil sketches: where people stand, for the AI
node $V/lv.mjs --job . --storyboard [--aspect all]                   # the board, on the plates (see "On each shot" below)
node $V/storyboard/phone.mjs --job . [--aspect A] [--cover cover.yaml]    # <slug>-storyboard-<aspect>-phone.pdf
python3 $V/storyboard/placeholders.py status                         # shots still on placeholder plates (exit 1 while any are)
```

All five `placeholders.py` commands take `--spec FILE` (default `tools/placeholders.json`); `status` also takes `--job DIR`
(default: the spec's `root`, else here) and `--cut NAME` (default `main`). `phone.mjs` takes `--aspect` (default: the
film's first aspect), `--cut NAME` (a cutdown's board; default `main`), `--cover FILE`, `--dpr` 1–3 (default 1.5),
`--quality` 30–100 (default 80) and `--max-mb` 1–500 (default 25).

**On each shot that stands on a plate**, in beats.yaml:

```yaml
    bg: assets/plates/S01.png
    bgMove: none      # the engine's default slow zoom would crop the plate's label off the board
    bgDim: 0          # and its default 15 % scrim would darken the plate's look
    push: 0           # the generated clip brings the real camera move; the plate's label names it
```

Leave out the camera fields (`zoom`, `offset`, `pan`, `move`) and `letterbox` on a plate shot too: they re-frame the
plate like a move, and a letterbox bar covers its label. `status` and `phone.mjs` both name any plate shot that still
moves, dims or covers its plate, and which field does it. The plates keep their label and tags 7 % inside every crop,
so a default move only trims the margin, but the board reads as drawn only with none of them set. (A block's own
motion still applies: a `type` shot's zoom-through, a sticker's shake.)

## Where it sits

| Step | You make | Gate | Cost |
|---|---|---|---|
| 1 · Story | loglines first, then the script (GUIDE step 2; a recreation keeps the reference's story engine: `RECREATE.md` → The story) | the premise, then the words | 0 |
| 2 · Plates | `tools/placeholders.json` → `draw`: one plate per footage shot, set on its shot as above | — (they show composition only) | 0 |
| 3 · Storyboard | `lv.mjs --storyboard` + `phone.mjs`: the user reviews the board, on a phone if they like | notes per shot, the most important gate | 0 |
| 4 · The real footage | `CASTING.md` (sheets, key frames) → `FOOTAGE.md` (video, grade, conform) → swap each `bg:`; `status` until it prints none | each step's own gate | quoted first |

## What a plate shows, and never shows

- **A framing guide, not art**: the people as simple figures (pose, facing, size, wardrobe colours), the world's big
  masses, where the light comes from (a glow), weather, props (a phone, a laptop), and a label: `AI FOOTAGE · S01 ·
  <one line> · <lens> · <camera move>`. Each person and tagged prop sits in a dashed bracket with its tag.
- **An END inset** (`end:`) when the camera move changes the frame: a small second composition, "what it ends on",
  about a third of the crop wide (never under a tenth of its height), under the label and inside every crop; `draw`
  warns and leaves it out only when the label leaves no room.
- **Crop guides** (`crops: [9x16, 1x1]`) when the film is cut to other aspects. `bg:` cover-crops a plate about its
  centre, and the dashed boxes show exactly what each aspect keeps. The label, the tags and the inset stay inside every
  crop; `draw` warns when a person or a prop leaves one (for a `bust`, when its head does: a bust's shoulders run past
  the frame on purpose). `init` fills `aspect` and `crops` from beats.yaml's `aspects` (the plate in the film's first
  aspect, a crop for each other one); `draw` warns when the film is cut to an aspect the spec has no crop for, and
  `status` / `phone.mjs` flag a plate shown in an aspect it wasn't drawn for.
- **Never** a reference's frames, product UI, logos or brand art (UI comes from the blocks drawn over the plate, as it
  will ship; brand art only from the official kit), and never a face meant to be judged: the plate says where a face
  is, the cast sheets say whose.

## The spec (`tools/placeholders.json`)

`init` writes it from `storyboard/starter.json` with `root` pointing at the folder it ran in and `aspect` / `crops`
from beats.yaml; run it from the job folder. Coordinates are fractions of the plate (0–1, a little past an edge is
fine). Unknown keys and duplicate keys are refused (a key another kind uses is a typo too), booleans must be `true` /
`false`, every `<FILL: …>` hint must be replaced, and every problem is listed at once before anything is drawn.

| Key | What it is |
|---|---|
| `root`, `out` | the job folder, relative to the spec (default `..`; it must hold `beats.yaml`), and the plates folder inside it (default `assets/plates`; never outside the job) |
| `aspect` | the plate's size: `16x9` 1920×1080 (default), `9x16` 1080×1920, `1x1` 1080×1080 |
| `crops` | the other aspects the film is cut to: dashed guides, label kept inside |
| `kind` | the label's first words (default `AI FOOTAGE`; `LIVE ACTION` / `STOCK` for a shoot or a licence) |
| `font` | a bold .ttf / .otf / .ttc, relative to the spec (default Arial Bold on macOS, else DejaVu Sans Bold); for Chinese or Japanese text use one that has the glyphs, e.g. `/System/Library/Fonts/Hiragino Sans GB.ttc` (`draw` warns when a character would draw as a box) |
| `cast.NAME` | a wardrobe: `body`, `accent`, `skin`, `hair` colours, used by `figures[].who` |
| `defaults` | any plate key except `line` and `end`, applied to every plate |
| `plates.ID.line` | what the shot shows, in one line, up to 300 characters (required). The id names the file: a letter, digit or `_` first, then letters, digits, `-` or `_`; two ids that differ only by case are refused (one file on macOS) |
| `lens`, `move` | e.g. `35 mm`, `slow push in`; both go on the label |
| `look` | `space`, `night`, `dawn`, `dusk`, `day`, `overcast`, `golden`, `interior-warm`, `interior-cool`, `office`, `studio`, or stops `[[0, "#hex"], …, [1, "#hex"]]` top to bottom |
| `horizon` | `{y, color, color2, line}`: the ground from `y` down |
| `fx` | `{kind: stars, n, box, seed}`, `{kind: glow, x, y, r, color, strength}` (the light), `{kind: rain, n, angle, alpha, seed}`, `{kind: fog, n, box, color, alpha, seed}`, `{kind: vignette, strength}` |
| `shapes` | the world's masses: `rect` `{box, radius}`, `ellipse` `{box}`, `poly` `{points}`, `line` `{points, width}`; each `color`, `alpha`, `blur` |
| `props` | `phone`, `laptop`, `screen`, `card`, `box`, `ball` at `{x, y, w}` (centre, width), `color`, `screen`, `tag`, `front` (drawn over the people) |
| `figures` | `{who, x, feet, height, pose, facing, tag, bracket}`: `x` the centre, `feet` the bottom, `height` head to feet as a fraction of the plate's height; `pose` `stand`, `walk`, `sit`, `float`, or `bust` (head and shoulders: the head's top is ~0.84 × `height` above `feet` and the shoulders run 0.2 × `height` below it, so set `feet` at or past the frame's bottom); `facing` `camera`, `left`, `right`, `away` |
| `end` | the END inset: `label` (required) plus `look`, `horizon`, `fx`, `shapes`, `props`, `figures` |
| `thirds`, `grain` | rule-of-thirds lines; film grain (default 4, `0` = none) |

Plates are deterministic (the same spec draws the same bytes), and a plate whose bytes wouldn't change is left as it is
(`→ … (unchanged)`), so redrawing doesn't make a board stale. Each PNG carries a text chunk `lv-placeholder` (its id,
aspect and crops) and the contact sheet (`--sheet`, `placeholders-sheet.jpg`) a JPEG comment: that is how `draw` knows
a file is its own to redraw, and how `status` and the phone edition spot a shot still on a stand-in.

## Pencil sketches: where the people stand, for the AI (`sketch`)

`sketch` draws each plate again as a **hand pencil sketch with no text**, for the key frame's prompt to send as "the
position reference only" (`SHOTS.md`). The generated frame then takes the plate's blocking and nothing else. This is
kaye.creatives' method from the Oakley × Meta ad: she sketched on an iPad, a red figure, a yellow head and product, a
green ground line. Alex asked for them to look drawn in pencil.

- **What it draws:**
  - **Red:** the people, as shaded mannequins: pose, size and where each stands, with hands and feet. The joints
    follow the plate's figures, so the blocking matches.
  - **Yellow:** each head, an oval whose red cross shows which way the face looks (a head shaded grey all over faces
    away, with no cross). Each product or prop is yellow too.
  - The legend names only what a sketch drew: no cross when every head faces away, no grey when no place is drawn
    (a sun outside the frame isn't).
  - **Green:** the ground line under their feet.
  - **Grey:** the place: the horizon, the big shapes (hatched darker for darker masses) and a sun where a `glow` is,
    drawn around the people.
- **What it leaves out:** the label, tags, crops, look, colours and the END inset. A sketch is the first frame's
  composition, nothing more.
- **The files:**
  - `assets/plates/<ID>-sketch.png` carries the marker `lv-position`.
  - `<ID>-sketch.json` holds its legend (only the colours it uses), a one-line description, and the plate's
    fingerprint.
  - `--sheet` adds `sketches-sheet.jpg`, with each id under its sketch.

  Sketches are deterministic: unchanged ones are left alone, and `sketch` replaces only its own files.
- **A shot uses one** with `"position": {"plate": "S01"}` in `tools/shots.json`. `shots.py` then:
  - sends the sketch with the key frame;
  - writes its legend into the key prompt;
  - warns when something the sketch draws changed after it was drawn: a person, a prop, the horizon, a shape (its tone
    too), the sun or the weather. A tag, the look, the label, the lens or a colour the sketch doesn't draw doesn't count.
- **Alex's own drawing works too.** Put it in the job, e.g. `assets/sketches/S03.jpg`, and set
  `"position": {"file": "assets/sketches/S03.jpg", "legend": {"red": "…", …}}`. He can use the same colours, or say
  what his mean.
- **Never on the board or in the film.** `status` names any shot that shows a sketch.

## The phone edition (`phone.mjs`)

- **The same board, re-laid.** It reads the board `--storyboard` wrote (`out/<cut>/<aspect>/board/board.html`): the
  same stills, copy, notes and card warnings, one card column on 1080 × 1920 pages at 1.5× (1620 × 2880 JPEG, quality
  80), a cover page first, the board's "Notes before the film" (reading time, shrunk or clipped copy) on the last
  pages, and a PDF that embeds those JPEGs untouched. Pages land in `out/<cut>/<aspect>/board-phone/` with a
  `pages.json` (shots per page, notes, the shots on placeholders, any still shrunk to fit).
- **The cover** comes from `--cover` (YAML or JSON): `title`, `line`, `tag` (the red pill), `logline`, `table`
  `{title, rows: [[a, b, c], …]}`, `read` (the "How to read it" list), `footer` (every page). Left out, each gets a
  default: the timeline's title, today's date, the shot count, and, when any shot shows a placeholder plate, a tag and
  footer saying nothing was generated.
- **Stills**: 16:9 at 1000 px wide, 9:16 at 1100 px tall, 1:1 at 1000 px. A card taller than a page gives up still
  height, never words, down to half the still (it says so); past that it refuses: shorten that shot's `note`.
- **A stale board is refused**: when `beats.yaml`, any file a shot uses (a plate, footage, a screen), a brand file
  (logo, font, cast art) or a custom block is newer than the board, run `--storyboard` again first. It compares
  modification times, so a file copied in with its old timestamp kept (`cp -p`, `rsync -a`) can slip past.
- **It only replaces its own PDF**: a PDF of the same name made by anything else (its `/Creator` says so) is refused;
  move or rename it.
- **One run per board at a time**: a second run on the same board is refused while the first holds its lock (a killed
  run's lock and pages are cleared next time). Pages are made in a folder of their own and swapped in only once the PDF
  is built, and a still that didn't load is refused, never shipped as a grey box.

## Exit codes

| | 0 | 1 | 2 | 5 | 129 / 130 / 143 |
|---|---|---|---|---|---|
| `placeholders.py` | done | done with warnings (a crop, a missing crop for the film's aspects, a long label, a missing glyph, no room for an END inset); `status`: shots still on placeholders, on the kit's stand-in stills or on a pencil sketch | refused: a spec problem, a file in the way, a folder it can't write, no numpy / Pillow, a missing or stale timeline | unexpected | hang-up / Ctrl-C / kill; temp files removed |
| `phone.mjs` | done | the PDF is over `--max-mb` (written; lower `--quality` or `--dpr`) | refused: no board, a stale board, a still that didn't load, a bad cover or flag, a card that can't fit, another tool's PDF in the way, another run on the same board, no Chrome | unexpected | hang-up / Ctrl-C / kill; the temp PDF and pages are removed (a killed run's are swept next time) |

## Traps

- **A plate is only redrawn while it carries its marker.** Open one in another app and save it, and the marker is
  gone: `draw` then refuses to replace it. Move it away, or give the plate another id. The same holds for a sketch
  (`lv-position`) and its `.json`.
- **Move a person on a plate, then sketch again.** The sketch is the key frame's blocking; `shots.py check` warns
  while a sketch is older than its plate.
- **YAML in a cover**: a line holding `: ` becomes a key, not text. Quote such lines; the cover check refuses them.
- **The phone edition is a picture of the board.** After any change, run `--storyboard`, then `phone.mjs`; it refuses
  a board older than `beats.yaml` or than any file a shot, the brand or a custom block uses.
- **`status` reads `out/<cut>/timeline.json`** and refuses one older than `beats.yaml`: run `--grid` (or
  `--storyboard`) after editing `beats.yaml`.
- **Placeholders never ship.** Before the final `--film`, `status` must print none; the label is drawn into the plate.
  `status` knows a plate by its marker and the kit's stand-ins (`assets/placeholder-*`) by name: a plate re-saved by
  another app (`sips`, Preview) loses its marker and slips past, so swap plates by pointing `bg:` at the real footage.
- **Keep the lid open while rendering**: a sleeping Mac stalls Chrome mid-screenshot and the storyboard step times out.

## Worked example: The Lull (manus2-space, 2026-10-23)

The Lull's 27-shot storyboard stood on placeholder plates: 12 live-action shots and 8 pieces of the film-within-the-film,
drawn by a job-only script (`manus2-space/tools/make_plates.py`, hand-drawn space art; `placeholders.py` is its general
form). Every plate shot set `bgMove: none`, `bgDim: 0`, `push: 0`. Alex reviewed the board on a phone, then the
astronaut was cast and the footage generated. The phone edition is now `phone.mjs`: with
`storyboard/examples/manus2-space-cover.yaml` it rebuilds that review's pages from a copy of the job's board, 26 pages
(cover + 25), 6.76 MB, every page byte-identical to the job tool's and to the pages sent on 10-23. (Run on the job
folder itself, it refuses: the 10-23 PDF there was made by the job tool, and the job's footage is newer than its board.)
