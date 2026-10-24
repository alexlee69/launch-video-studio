# Casting and key frames: one face per sheet (mode B, OpenAI gpt-image-2)

When a film has a recurring person, they must be the same face in the same clothes in every generated shot. This lane
locks them first, as character sheets built the Higgsfield way, then makes every key frame (the first frame of each
video leg, FOOTAGE.md) **from those sheets as image references, never from text alone**. It also makes the location
plates, the faceless costume and prop sheets, and the film's own stills. Images run on the user's OpenAI key
(gpt-image-2, multi-reference edits at 2560×1440, quality high); video stays on fal (FOOTAGE.md).
`$V` = `~/.claude/skills/product-launch-sting/video`. Tool: `$V/casting/casting.py`, driven by one spec per job, `DIR/tools/casting.json` (start one with `init`).
Worked example: `examples/manus2-space-casting.json` (The Lull, 2026-10-23), the prompts the job really sent.
**Needs:** python3 with numpy and Pillow (`pip3 install numpy pillow`), and an OpenAI key with gpt-image-2 access.
**Run every command from the job folder** (`cd DIR`); the spec's paths are relative to the spec file.

```bash
cd DIR
python3 $V/casting/casting.py init .                                  # tools/casting.json: the method's templates, <placeholders> to fill
python3 $V/casting/casting.py plan                                    # every request, its references, the quote per batch; no network
python3 $V/casting/casting.py candidates [--only look-1] [--go]       # candidate sheets → cast/candidates/cand-NN.png (each run: new takes)
python3 $V/casting/casting.py review candidates                       # stills/review/candidates.jpg, numbered: the user picks one
python3 $V/casting/casting.py lock --pick cand-02 [--go]              # erase the body's face → put the untouched face back → pin the grey
python3 $V/casting/casting.py states [--only wet] [--go]              # each state / faceless costume / props sheet, grey pinned (made ones skipped)
python3 $V/casting/casting.py locations [--go]                        # empty 3/4 plates, 2 variants each (made ones skipped: --redo)
python3 $V/casting/casting.py pick place-1 v2                         # the variant the stills use
python3 $V/casting/casting.py stills --batch identity [--go]          # the face-carrying key frames FIRST, 2 variants each (made ones skipped: --redo)
python3 $V/casting/casting.py review stills --batch identity          # each still next to the locked close-up, for the face check
python3 $V/casting/casting.py stills --batch rest [--go]              # then the rest (and any other batch the spec names)
python3 $V/casting/casting.py fix S22-22-v1f [--go]                   # a one-line edit; only its box is pasted back (one id at a time)
python3 $V/casting/casting.py cost                                    # the ledger, one row per request
python3 $V/casting/casting.py pin SHEET.png OUT.png [--cols 962,1710]  # free tools: grey pin · paste ORIG EDIT OUT --box · restore BASE SRC OUT --ellipse
```

## The method

From Higgsfield Academy's lesson "One face per character sheet"
(higgsfield.ai/academy/courses/ai-ad-3-step/one-face-per-character-sheet) and OSideMedia's
`higgsfield-character-design` skill (skillsdirectory.com/skills/osidemedia-higgsfield-character-design). Its canonical
rules are `templates/ad-asset-prep.md` § Design for win rate and the checklist in github.com/OSideMedia/higgsfield-ai-prompt-skill
(MIT). These are the rules this tool builds in, in our words, plus what The Lull taught us. **Where it departs from
the source, on purpose:** every image runs on gpt-image-2 through the user's OpenAI key (the user's rule for stills),
where the source makes locations in Soul Cinema and one-line fixes in Nano Banana 2; sheets start at 2K, not 4K (see
Size below); rule 5 offers a second composite; and rule 12 keeps the source's Forbidden List out of the prompts.

1. **A sheet is ONE image**: a close-up of the face, the full body from the front, the full body from behind, side by
   side with thin gutters. One clean subject. Never a person from a single view: one clear face plus one full body is
   the floor, so the video model doesn't have to guess (the source says it of Seedance). Never as separate per-view
   images, each with its own face.
2. **Flat neutral grey, one hex per project**: "flat solid neutral grey background (#8a8a8a), seamless, no gradient",
   with no floor. `#8a8a8a` for people, `#7f7f7f` for creatures; never white or black (the source's one exception:
   anime / manga sheets run on white). The sources disagree on a soft contact shadow (unmeasured); for a sheet read as
   a reference, the flat field without one is the lower-risk default (it is baked light every shot would inherit).
   Grey wins more generations: nothing competes with the subject, edges stay clean when the sheet is read as a
   reference, and the cinema look stays in the locations and shots. The model's grey drifts, so the tool pins it back
   to the exact hex after every sheet (`pin`).
3. **Many candidates, one pick.** Generate several sheets of the person the brief describes and let the user pick by
   number (`review candidates`). Cast for what the story needs the face to do: The Lull's comedy lives in her eyebrows
   through a helmet bubble.
4. **Lock one face.** The full-body front panel's face is erased (a gpt-image-2 edit, High, 2K): the close-up becomes
   the only source of the face, and the body panels carry build, silhouette and wardrobe. A reference with several faces
   gets averaged into a generic one, or the model grabs the tiny blurry body face on wide shots. The back view keeps
   its head (it shows no face, and it carries the hair). The lock edit can fix other things in the same pass (The Lull:
   the helmet camera's side, the patch's shoulder).
5. **Every edit softens skin**, so the identity base is composited after the lock edit (the "anti-slop composite").
   The source's way pastes only the erased region of the edit back onto the untouched pick (`restore: {"boxes": […]}`).
   When the lock edit changes several places at once (The Lull: the face erased, the helmet camera and the patch
   moved), keep the edit and put the untouched close-up face back instead (`restore: {"ellipse": […]}`, the starter's
   default for the three-panel layout).
6. **Each state is its own sheet, made now**: wet, helmet off, injured, in uniform. Asking a shot prompt to "make her
   soaked" later makes the model improvise, and "the face drips off". A state sheet keeps one readable face too (its
   front body is faceless).
7. **Costume details and props go on faceless sheets** (a grid of product photographs on the same grey). A prop gets
   front, side and back, plus a view from below whenever it will be flipped or tumbled: the model can't invent an
   underside it has never seen. Props don't perform, so they skip the screen test.
8. **Fix a flaw with a one-line edit, never a rebuild**, and paste only the fixed region back onto the untouched
   original (`fixes`): an edit drifts and softens everything else (The Lull's patch fixes: drift 10.8 inside the box,
   3.2 outside, not used).
9. **Locations are empty 3/4-angle plates with the light pinned** (direction, height, quality), so camera moves have
   depth and the time of day can't jump. Generate a few and choose by affordance, not beauty: room for the action, a
   clean corridor where it happens, clutter pushed to the edges, no tint that would leak into every shot.
10. **Key frames are made from the sheets.** Each still sends its sheet (image 1) and its location (image 2) as
    references with a preamble that names what each is for (`{PRE_FACE}`, `{PRE_LOC}`). A shot that doesn't show the
    face sends the costume or props sheet instead, never the face sheet. **Identity-critical stills first** (the
    `identity` batch: the shots that carry the face), checked against the locked close-up before the rest is spent.
11. **Screen test before scenes** (recommended): one cheap audition clip in motion from an identity key frame shows
    whether the face holds when it moves (`node $V/footage/gen.mjs video --image stills/keys/<id>-vN.png --prompt
    @motion.txt --out out/fal/screen-test.mp4 --sec 6`: a dry run with the cost until `--go`, FOOTAGE.md). Expression
    and lighting tests belong there, not on the sheet.
12. **Prompt hygiene**: describe what things are ("blue-black solar arrays", "unbranded and fictional"). Never name the
    specific thing to keep out (a real agency, a real place, the reference film's world): naming it pulls the model
    toward it. Those words go in the spec's `ban` list, a build check that refuses any prompt containing one. Generic
    exclusions ("no text, no watermark", "no people" on a plate) are fine, and the built-in templates use them. This
    departs from the source, whose Style Sheet pastes a Forbidden List (what the world is NOT) into every prompt: The
    Lull's fidelity judge found named exclusions pulling their subject in, so the list became the build check.

## The steps and the user's gates

| # | Step | Command | The user approves | The Lull |
|---|---|---|---|---|
| 1 | Casting brief | fill `tools/casting.json` | who the person is, the one wardrobe, the states, props, places; the quote (`plan`) | one East Asian woman of about 40; 3 states/faceless sheets, 4 places |
| 2 | Candidates | `candidates --go`, `review candidates` | the pick, by number | 2 sheets, $0.46 (after a first round the user redirected) |
| 3 | Lock + sheets | `lock --pick cand-NN --go`, `states --go` | the locked sheet (one readable face), each state sheet | lock $0.23, 3 sheets $0.71, one tile fix $0.23 |
| 4 | Locations | `locations --go`, `pick NAME vN` | one variant per place | 4 × 2 variants, $1.85 |
| 5 | Identity stills | `stills --batch identity --go`, `review stills` | the face check, the picks, the notes → `fixes` | 7 legs × 2, $3.47; 3 patch fixes $0.70 |
| 6 | The rest | `stills --batch rest --go` (+ any other batch) | the picks | 9 legs × 2 + 5 film stills × 2 (+ one re-roll of S04's dawn) |
| 7 | Screen test, then video | FOOTAGE.md (`gen.mjs video` from the picked stills) | the motion | — |

Record the picks for the footage step (The Lull: `stills/picks.json`); FOOTAGE.md's video legs start from them.

## The spec (`DIR/tools/casting.json`)

`init` writes a starter that runs `plan` at once (it lists its `<placeholders>`; `--go` refuses any left).

| Field | What it is |
|---|---|
| `root` | the job folder (default `..`): `req.json` files and the ledger name references from it |
| `grey`, `cap`, `ledger` | the project grey (`#8a8a8a`); the spend the user approved, in USD (a `--go` past it is refused); the ledger (default `../cast/ledger.jsonl`) |
| `model`, `quality`, `sizes`, `rates` | defaults `gpt-image-2`, `high`, `["2560x1440", "2048x1152", "1536x1024"]` (a 400 naming the size steps down, free), USD per 1M tokens `{text_in 5, image_in 8, out 30}` |
| `dirs` | `candidates` (`../cast/candidates`), `locked` (`../cast/locked`), `locations` (`../stills/locations`), `stills` (`../stills`), `review` (`../stills/review`) |
| `ban` | words no prompt may contain (whole words, any case) |
| `text` | snippets: `{NAME}` in any prompt expands (also inside other snippets). Built in, and overridable: `SHEET` (the three-panel layout), `LOCK` + `KEEP` (the face-erase edit), `STATE`, `FACELESS`, `GREY` (with `{GREY_HEX}`), `TAIL` (people), `PROP_TAIL` (faceless costume and prop sheets), `PLATE_TAIL` (locations), `PRE_FACE`, `PRE_LOC` |
| `candidates.ID` | `prompt`, `n` (1–10, default 1), `refs` (none: a fresh generation; a face master: an edit). Every run makes new takes (cand numbers continue); to finish a run cut off by an error, `--only` the entries still to make |
| `lock.NAME` | the one locked sheet: `prompt`, `pick` (used when `lock` gets no `--pick`; `lock --rebuild` reads it from the saved edit's `req.json` and refuses any other), `restore` (either `{ellipse: [cx, cy, rx, ry], feather}` — the untouched close-up face put back onto the edit; on a 2560×1440 three-panel sheet `[480, 545, 235, 290]`, 28 — or `{boxes: [[x0, y0, x1, y1], …], feather}` — only those regions of the edit pasted onto the untouched pick), `pin: {cols, rows}` (gutter centres; `{}` or omitted: found automatically — thin near-white lines clearly brighter than the grey beside them; `false`: no pin) |
| `states.ID` | `refs` (`["sheet:NAME", …]`), `prompt`, `pin`; one image (`n` is 1); written as `ID-gen.png` → pinned `ID.png`. Made ones are skipped, so a cut-off batch resumes |
| `locations.ID` | `refs`, `prompt`, `n` (default 2) → `ID-vN.png`; `pick` links `ID.png` to one |
| `stills.ID` | `batch` (`identity` first, `rest`, any other name), `dir` (default `keys`), `refs`, `prompt`, `n` (1–10, default 2), `face` (the sheet whose close-up `review stills` shows), `meta` (copied into each `req.json`) |
| `fixes.ID` | `prompt`, `box` (pasted back), `feather` (18; 0 = a hard paste, for a sheet tile), and either `src` (+ `out`, default `<src>f.png`) or `sheet: NAME` (fixes a locked sheet in place, keeping the one before as `NAME-before-ID.png`, the record in `NAME-ID-fix.json`; add `pin` to re-pin it); `edit` names the raw edit (optional); `refs` adds references after the source; `why` is kept in the record. The edit asks for the source's own size, so it pastes back. `--rebuild` replaces `out` only when its record names this fix's own edit |
| `faces.NAME` | the close-up's crop box on that sheet, for the review sheets |
| ids | every entry id (and a still's `dir`) becomes a file name: letters, digits, `.`, `_`, `-`, no slashes |

References: `sheet:NAME` (a locked sheet: a `lock` or `states` entry), `loc:NAME` (a picked location: a `locations`
entry), `cand:NAME`, or a path relative to the spec; a `sheet:` or `loc:` that names no entry is refused, in `plan` too.
`--spec FILE` works before or after the command.
The request sends them in order as `image[]`, and the prompt names each by number ("Image 1 is …").

## Cost, the gate, the files

- **Nothing is spent without the user's yes.** Every paid command is a dry run until `--go`: the requests, each one's
  references and words, and the quote. Show the user the quote, then run with `--go`. `plan` quotes the whole job up
  front; a reference the pipeline hasn't made yet shows as "waits for …", which a `--go` refuses.
- **The quote** is measured on The Lull: a 2560×1440 high image is 7,370 output tokens; each reference costs 1,508
  input tokens at 2560×1440 (1,024 at 1024×1024) **per image asked for** (n = 2 doubles it); at the default rates an
  image is ≈ $0.22, a 2-reference still pair ≈ $0.50. The quote came within 2 % of the ledger on 25 of the job's calls
  ($12.06 quoted, $12.05 spent). The rates are a per-modality card; check OpenAI's pricing page and set `rates` if it
  has changed. The ledger keeps the API's raw usage, so any total can be recomputed.
- **Refused before any network** (exit 2): a quote past `cap` (the ledger total plus this batch); a ban-list word; an
  unfilled `<placeholder>`; a missing reference, or a `sheet:` / `loc:` that names no entry; a fix box or a restore mask
  that doesn't fit its image (or is smaller than twice its feather); an `n` outside 1–10; an output that already
  exists; an `OPENAI_BASE_URL` that isn't https (a local mock aside). Variants number on from the highest existing one,
  so nothing is overwritten.
- **Resume, re-roll, rebuild.** Stills and locations that already have variants are skipped, so a batch cut off by an
  error resumes where it stopped without re-paying; `--redo` makes more variants (a re-roll). `lock`, `states` and
  `fix` refuse a second `--go`; `--rebuild` (free, writes at once, no `--go`) redoes only their free steps from the
  saved edit, and refuses when a sheet fix has been applied on top (it would undo it).
- **The API**: a 400 naming the size steps down the ladder (free); a 429, 500, 502, 503 or 504, or a connection that
  never reached the API (refused, no DNS: $0), is retried once; everything else stops (exit 4). A request cut off
  **after** it was sent (a timeout, a reset, a body cut mid-way) is never retried by the tool, since a retry could pay
  twice: it stays counted as "may be billed"; check the OpenAI usage page, then re-run (made stills and locations are
  skipped). Every request is written to the ledger at its estimate **before** it is sent, and its answer replaces that
  row; a Ctrl-C (exit 130) leaves it counted. `cost` lists one row per request.
- **The grey must land**: if a sheet's background had no neutral grey to seed from (100–170), came out off the project
  hex by more than 3, or is still uneven (spread > 4 levels; The Lull's sheets measure 0.8–3.1), the sheet is saved but
  the run says "grey NOT pinned" and exits 1: look at it, give the gutters by hand (`pin: {cols, rows}`), or
  regenerate it on a mid grey.
- **Exit codes**: 0 done, or a dry run that could `--go` · 1 done, with something to look at (a grey not pinned, fewer
  images than asked, a non-PNG answer saved as PNG, a paid image kept as `-dupN` because another run took its name) ·
  2 a refusal (a dry run that a `--go` would refuse exits 2 too: over the cap, already made, a ✗) · 3 no key · 4 the
  API failed · 5 an unexpected error (a bug: the traceback is printed; paid images already saved stay) · 130 Ctrl-C.
- **Free tools** (`pin`, `paste`, `restore`) never write over an existing file (their `.json` record included) without
  `--force`, and never over an input even with it; records are written to a temp file and renamed, so a symlink is
  replaced, never written through.
- **Two runs at once** can't both pass the cap: the spend is read, checked and reserved under a lock on the ledger.
  Redirects are never followed (they would carry the key elsewhere), and flags are never abbreviated (`--g` is not
  `--go`).
- **A short answer**: a 200 with no images is billed and stops (exit 4, nothing saved); fewer images than asked are
  saved and the run exits 1 with a warning. Usage the API reports without token counts is billed at the estimate. A
  JPEG or WebP answer is converted to PNG (pixels unchanged) and noted in its `req.json`.
- **Never replaced**: a paid image is published with a link that fails if the name is taken, so two runs of the same
  batch at once take the next variant numbers instead of overwriting each other.
- **Size**: the ladder starts at 2560×1440, which the API accepted and The Lull measured. The source's sheet default is
  4K: put `"3840x2160"` first in `sizes` to try it (a 400 steps down, free). Any size but 2560×1440 is quoted at the
  2560×1440 numbers, unmeasured (a 1024×1024 output measured 7,024 tokens, so smaller isn't cheaper). `plan` prints
  the total and the part still to make (made entries are marked), and warns when that passes the cap.
- **The key**: `--env FILE`, else `OPENAI_API_KEY`, else `~/Downloads/launch-videos/.env` (one line
  `OPENAI_API_KEY=…`, chmod 600; the user pastes it there, never into the chat). It is never printed and is scrubbed
  from every message, ledger row and `req.json`.
- **Files**: each image beside its `.req.json` (endpoint, model, size, quality, n, references, the expanded prompt and
  the entry's `meta`); `lock` writes `NAME-edit.png` → `NAME-composite.png` (+ `.json`) → `NAME.png` (+ `pin-NAME.json`).

## Traps (The Lull, 2026-10-23)

- **Sides mirror.** Say whose side and where it lands: "her own LEFT side: in the front view on the right side of the
  picture". The patch and the helmet camera still came back on the wrong side; the fix is a one-line edit pasted back
  in its box, never a re-roll of the shot.
- **Light loses to a busy prompt**: S04's dawn came back in full daylight twice. Lead with it ("Lighting is the point of
  this frame: the sun has NOT risen yet …").
- **Ban words hide in innocent phrases**: "temple lamps" on a helmet tripped hf01's world list; it became "small side
  lamps".
- **gpt-image-2 rejects `input_fidelity`**: the tool never sends it.
- **A wrong prop in one tile** (the capsule came back as a ball): fix that tile alone and paste it back hard
  (`feather: 0`) so the other props keep their pixels.
- **Edits drift the whole frame**: always paste a fix back by its box, and restore the close-up face after the lock.
- **The first candidate round was redirected** ("why are you making 4 characters?"): cast one person from the brief
  and make a few sheets of them; candidates are takes of one casting, not a lineup.

## Worked example: manus2-space (The Lull, 2026-10-23)

`~/Downloads/launch-videos/manus2-space/` (its own copy: `tools/casting.json`): the user cast "an East Asian woman, about
40". Candidates cand-01 (an edit from an earlier face master) and cand-02 (fresh; picked). The lock edit erased the
front body's face and moved the helmet camera and the patch; her face was restored from cand-02 and the grey pinned on
the gutters at x 964 / 1712. States: helmet off (the sea), costume (with the patch as image 2), props (the capsule
tile fixed). Four locations × 2 (exterior, airlock, capsule interior, sea), then 16 key frames (7 identity first) and
5 film stills, and 3 patch-side fixes. Spend: $2.23 for 9 sheet calls, $13.24 for 29 still calls. The skill's tool
was checked against the job: every one of the 35 requests the example spec sends equals the job's own `req.json`
(39 records: endpoint, references, prompt byte for byte, n, size); the face restore, the four grey pins and the four pastes
rebuild the job's files pixel for pixel; the auto-found gutters land inside the job's (Design-AutoPilot-stable
`qa/cast-skill-port/`).
