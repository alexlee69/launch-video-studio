# From-scratch launch videos (mode B of product-launch-sting)

Use this when the user wants a launch video, feature video or teaser **designed with them** (any length, 16:9 / 9:16 /
1:1, cutdowns), or **UI mockup clips to drop into their own edit** (a phone flow, an approval card, a prompt being typed,
agent steps ticking off — transparent ProRes 4444 or on a background). For the fixed 12 s square sting from 7 inputs,
use mode A (`../SKILL.md`).

`$V` = `~/.claude/skills/product-launch-sting/video`. Entry point: `node $V/lv.mjs --job DIR <command>`.
A job folder holds `brief.md`, `beats.yaml`, `assets/` and optional `blocks/*.mjs`; generated files go to `DIR/out/`,
deliverables land at the top of `DIR` (clips in `DIR/clips/`). Make jobs in `~/Downloads/launch-videos/<slug>/` unless the
user names a folder (the CLI always takes `--job DIR`).
Requirements are the same as mode A (Node ≥ 18, ffmpeg/ffprobe, Google Chrome). If `$V/node_modules` is missing:
`cd $V && npm ci` (and `cd .. && npm ci` for the parent's playwright-core + Inter).

## The workflow — every step ends with something the user approves

| # | Step | Ask the user for | You make | Gate |
|---|---|---|---|---|
| 1 | Brief | goal, audience, where it runs (→ aspects), length, deadline, 2–3 references + what to borrow from each, must-say / must-not-say, CTA | `brief.md` (from `templates/brief.md`; draft it from a PRD if they have one) | "yes, that's the video" |
| 2 | Script | product facts and the claims they may make | 2–3 directions in a few lines each; then the chosen one as `beats.yaml` | lock the words |
| 3 | Timing | music choice (compose: playful / keynote / calm, or their track + where to start), tempo feel | `lv.mjs --grid`: the beat grid table + warnings | lock length and cut points |
| 4 | Storyboard | — | `lv.mjs --storyboard`: one **real** still per shot (not a sketch), PNG + PDF per aspect | notes per shot number — the most important gate |
| 5 | Assets (in parallel with 2–4) | logo SVG, colours, fonts, Figma/screenshots, characters, footage, VO | `templates/assets-checklist.md`; a live-action shot list (`templates/live-action-shotlist.md`) when footage is needed | — |
| 6 | Animatic (optional; skip ≤ 15 s) | — | `lv.mjs --animatic`: whole video, half size, 30 fps, with sound | pacing notes |
| 7 | Film | — | `lv.mjs --film`: 60 fps master per aspect + mastered audio + QA | timestamped notes, ~2 rounds |
| 8 | Deliver | — | the MP4s, master WAV, captions SRT, thumbnails; `lv.mjs --clips` for UI clips; `lv.mjs --layers` for per-element layers to polish by hand; cutdowns via `--cut` | ship |

Rules that save the most time:
- **Words before visuals, timing before motion.** A word change late is cheap; a timing change shifts every later shot.
- **Never render the film before the storyboard is approved.** Iterate on stills (seconds) instead of films (minutes).
- Notes come back as shot ids or timestamps ("s4: headline too long"); edit `beats.yaml`, re-run the step.
- **The user is your ears**: audio is verified by meters only. Say so at every audio review and ask them to listen.
- Decide early how live action and voiceover are covered (see Limits).

## Commands

```bash
node $V/lv.mjs --job DIR --init [--title "Name"]       # starter brief.md + beats.yaml (the "Steady" sample) + assets/
node $V/lv.mjs --job DIR --grid                         # compile → beat-grid table; warnings: reading time, UI overflow
node $V/lv.mjs --job DIR --storyboard [--aspect all]    # ~5 s: DIR/<slug>-storyboard-<aspect>.png + .pdf
node $V/lv.mjs --job DIR --animatic                     # ~40 s for 20 s: DIR/<slug>-animatic-<aspect>.mp4 (preview only)
node $V/lv.mjs --job DIR --film [--aspect all] [--cut main|NAME|all]   # ~1.5 min per aspect per 20 s; run in background
node $V/lv.mjs --job DIR --film --range 300,420         # re-render only these 60-fps frame indices (whole numbers), re-mux, re-QA
node $V/lv.mjs --job DIR --audio                        # music/SFX changed only: redo audio → master → mux → QA
node $V/lv.mjs --job DIR --qa                           # re-run QA
node $V/lv.mjs --job DIR --clips s3,s5 --alpha --fps 30 # UI clips for an edit (see below)
node $V/lv.mjs --job DIR --layers s5,s6                 # every element as its own transparent layer + After Effects .jsx (see Layers)
node $V/lv.mjs --job DIR --serve                        # scrub preview URL for a human (?ui=1 slider + play)
node $V/lv.mjs --blocks [--job DIR]                     # the live block catalogue with every field and layer (+ the job's custom blocks)
```

**Stale frames are refused.** Every render stores a fingerprint per shot (its beats.yaml fields, timing, brand, the
assets it uses and the engine code). `--audio`, `--qa` and the mux stop when a shot's frames no longer match, name the
shots and print the exact `--film --range a,b` per shot to fix them. A `--range` render makes a shot current only when it
covers all of that shot's frames; a range that cuts through a shot leaves it stale, so re-render whole shots (the
`--grid` table and the error both give their frame ranges). The soundtrack is fingerprinted the same way: QA fails when
it was built from another timeline (run `--audio`).

Film deliverables per cut × aspect: `DIR/<slug>[-<cut>]-<aspect>.mp4` (H.264 high, CRF 16, yuv420p, bt709, AAC 320k),
`DIR/<slug>[-<cut>]-master.wav` (−14 LUFS, ≤ −1 dBTP after AAC), `DIR/<slug>[-<cut>]-captions.srt` (on-screen copy),
`DIR/<slug>[-<cut>]-<aspect>-thumb.jpg` (the `thumbnail:` shot, else the end card).

## beats.yaml

`templates/beats.yaml` is a complete, commented example (a 20 s fictional habit-tracker launch) — copy its shape.

- `aspects: [16x9, 9x16, 1x1]` — every block re-lays itself out per aspect (not a crop). 9:16 keeps text inside the
  platform-UI-safe band (10 % each side, top 10 %, bottom 20 %); QA warns when text leaves it.
- `brand`: `name`, `mono` (monogram stand-in), `logo` (SVG/PNG in assets; `logoTint` recolours a one-colour mark),
  `colors` (bg, ink, muted, accent, accent2, accent3, dark, line, card, accentOnDark — defaults #F6F6F7, #111114, #7C7C86,
  #4C8DF6, #2FC2A3, #FFC53D, #0E0E12, #C3C8D4, #FFFFFF, and accentOnDark = the accent lightened), `bg: grid|dots|plain`,
  `font: {family, files: {400: …, 700: …}}`, `cast: [{src: assets/x.svg} | {shape, col}]`.
- `music`: `style: playful|keynote|calm|track|none`, `bpm`, `key`, `drop: <shot id>`, `breaks: [shot ids]`,
  `level: dB` (music vs SFX), and for a track `file`, `start` (seconds into the file), `downbeat` (film time of its
  first downbeat). `music: calm` is shorthand for `{style: calm}`. A track must cover the whole cut from `start`
  (`--grid` warns, `--film` refuses rather than letting the music stop early).
  `voiceover: {file, start, duck}` (or just `voiceover: assets/vo.wav`) ducks the music under a recorded VO. Cutdowns
  never reuse the main read (its lines wouldn't match their shots): give one its own with
  `voiceover: {file: …, cutdowns: {10s: assets/vo-10s.wav}}`, otherwise that cutdown plays music + SFX only.
- `shots`: each has `id` (letters, digits, - or _), `block`, a length (`beats: N` — ends on the music grid — or `sec: S`), `out:` (`cut | whip-left |
  whip-right | whip-up | whip-down | zoom-in | zoom-out | blur`), optional `theme: dark` (UI mocks stay light), `hold: [from, to]`
  (local 30-fps frames inside the shot; the only way to freeze frames — the picture and its sounds wait out the hold, so
  the block paces its animation for the frames left; a hold must end before a moving exit's last 7 frames), `note:` (shown on the storyboard), `push:` (the camera's slow zoom over the shot, default .035;
  it continues the entrance's direction so it never cancels into a standstill) + the block's fields.
  The next shot always *enters* continuing the previous shot's exit (a whip-left exit enters moving left, etc.).
- Copy markup everywhere: `*accent words*` take the accent colour, `|` forces a line break (an accent can't span a `|`;
  close it before the break and reopen after).
- `cutdowns: {10s: [s1, s3, s7]}` — shorter edits reuse shots; the music re-arranges to the new length.
- `thumbnail: <shot id>`.

## Blocks

Run `node $V/lv.mjs --blocks` for the live list with every field. Summary:

| Block | What it is | Key fields |
|---|---|---|
| title | "Meet [logo] Name" opener, badge bubble, sub line | pre, name, badge, sub |
| headline | big statement, words rise in | text, kicker, sub, align |
| cast | headline + characters springing up, hopping | text, count |
| orbit | hero + 2–5 icon satellites with moving dotted links | text, hero, items[{icon, label, color}] or plain names (`[Mail, Calendar]`) |
| field | headline + hero inside orbiting app tiles | text, hero, icons, side |
| stat | a number counting up, label, sub | value, from, prefix, suffix, decimals, label, sub |
| phone | headline + phone running a UI flow | text, items, side |
| browser | headline + desktop window running a UI flow (cursor clicks) | text, items, url, column |
| panel | floating UI card (no device) — best for transparent overlays | text, items, style card/glass/bare, width |
| prompt | big prompt box: typed task → send → agent steps tick off | prompt, placeholder, text, steps, mode, speed |
| media | your image or footage (full-bleed, cover-cropped; or a screen recording in a phone/browser, shown whole), Ken Burns, headline over a scrim; HDR (HLG/PQ) footage is converted to SDR | src, from, device, move, text, pos |
| endcard | logo lockup, tagline, CTA buttons, URL, character row | name, tagline, cta, url, cast, theme |

**UI items** (phone / browser / panel `items:`), in order, each optionally pinned with `at: <local frame>` (or seconds, `at: 1.5s`):
`header {title, sub, avatar}` · `msg: text` (+ `from: user`) · `typing: frames` · `input: text` (typed, then sent) ·
`card {title, sub, value, icon, actions: [Decline, Approve]}` · `tap: Approve` (finger on phones, cursor elsewhere) ·
`toast: text` · `row {title, sub, icon, value, check: true}` · `steps: [a, b, c]` (spinner → check, one by one) ·
`notif {app, title, body, icon}` · `image: assets/screen.png` (+ `scroll: px`) · `chips: [a, b]` · `space: px`.
Built-in icon names: mail, phone, computer, calendar, chat, bell, chart, lock, check, star, heart, bolt, globe, camera,
music, sparkle — or an asset path (your own icon image), for orbit items and card/row/notif icons. A `tap:` must name
a button on a card above it. Items that make an SFX cue: `msg`, `card`, `image`, `notif`, `row` (+ a brighter pop on
`check`), `chips` (pop) · `toast` (chime) · `tap` (click) · `input` (a tick per character + a click on send) · `steps` (a
tick per step done). `header`, `typing` and `space` are silent.

**Real product UI**: put screenshots in `assets/` and show them with `image:` items or `media` with `device: phone`;
rebuild key moments with items in the brand's colours and font for crisp, animatable UI.

**Custom blocks**: drop `DIR/blocks/<name>.mjs` exporting `default { name, doc, cues(shot, D), hero(shot, D),
build(ctx, shot) → { render(t, D) } }` with no imports (helpers arrive as `ctx.K` (math/easing), `ctx.A` (art),
`ctx.el(html, css, layer)`, `ctx.text(copy, opts)`, `ctx.reveal(el, t)`, `ctx.logo(size)`, `ctx.cast(i)`, `ctx.asset(path)`,
`ctx.layer(el, name)`, `ctx.W/H/u/safe/C/font/portrait`). `t` is the local frame (30 fps units, half frames happen);
`render` must be a pure function of `t` and must keep something moving every frame (QA fails frozen frames). For
`--layers`, name each element's layer — `ctx.el(html, css, 'card')`, `ctx.text(copy, {layer: 'headline'})` or
`ctx.layer(el, 'badge')` (lower-case letters, digits, `-`; a tagged element takes its untagged children with it) and
add `layers: 'a · b'` to the block (`lv.mjs --blocks --job DIR` lists it); a block with no tags exports one `content`
layer, which layer QA fails when the shot has several elements. Layer names: lower-case letters, digits and `-`, up to
40 characters; `background` and `constructor` are reserved.

## UI clips for the user's own edit

```bash
node $V/lv.mjs --job DIR --clips s3,s5 --alpha --fps 30 [--webm] [--aspect 16x9] [--with-transitions]
```

Per shot → `DIR/clips/<slug>-<id>-<aspect>-alpha.mov` (ProRes 4444 with alpha: Premiere, Final Cut, Resolve,
After Effects), `…-preview.mp4` (the clip over the brand background), `…-sfx.wav` (that shot's UI sound effects at one
fixed gain — up to −18 LUFS, true peak ≤ −3 dBTP, relative levels untouched — to lay under it; only for shots with UI
sounds), and `.webm` (VP9 alpha, for web/CapCut) with `--webm`.
Both are BT.709-tagged. Without `--alpha`: an H.264 MP4 on
the background. `--fps` matches the user's edit (24, 25, 30, 50, 60). Clips are **clean** by default: no whip/zoom in or
out, just the shot's own animation with a slow drift, so they cut neatly. For overlays over the user's footage, leave
`text:` off the shot (the headline is part of the clip otherwise) or use a `panel` / `prompt` block, which centre the UI
when there is no headline; set `brand.colors.bg` to the edit's backdrop for the previews. Each clip is QA'd (frame
count, alpha plane present, no empty or frozen frames; empty frames only at the very start (≤ 1 s, while the UI
animates in) or end (≤ 0.5 s) are reported rather than failed). Re-exporting a clip replaces all of its files. ProRes 4444 decodes as yuva444p12le; the WebM carries its alpha
in a side channel (`alpha_mode=1`), so plain ffprobe shows yuv420p — that's expected.

## Layers: every element of a shot as its own transparent layer

For hand polish in After Effects or CapCut: the shot split into its elements, each a transparent movie, back to front.

```bash
node $V/lv.mjs --job DIR --layers s5,s6|all [--alpha] [--webm] [--fps 30] [--aspect 16x9] [--with-transitions]
```

Per shot → `DIR/layers/<slug>[-<cut>]-<id>-<aspect>/` (re-exporting replaces the folder; a cutdown gets its own):

| File | What it is |
|---|---|
| `00-background.mov` | the brand background (grid/dots, vignette) with the camera move; opaque. Left out with `--alpha` (overlays for the user's own footage) |
| `01-<layer>.mov` … | each element alone, numbered back to front: ProRes 4444 with alpha (straight), BT.709; `.webm` (VP9 alpha) too with `--webm` |
| `<slug>-<id>-<aspect>-sfx.wav` | the shot's UI sounds, as for clips |
| `manifest.json` | order (`layers[0]` is the bottom), names, kind (`background` / `text` / `element` / `content`), fps, frame count, size, each layer's visible frames and bounding box, the copy of text layers, QA results |
| `<slug>-<id>-<aspect>.jsx` | After Effects import script (below) |
| `…-preview.mp4` | the layers restacked by ffmpeg, i.e. what an editor will see |
| `…-layers.png` | contact sheet: the finished frame, then every layer alone on a checkerboard (good for a phone) |

The frames are the same as `--clips`: **clean** by default (no whip/zoom in or out, the slow camera drift only);
`--with-transitions` keeps the moves. The camera move and its motion blur are baked into every layer, so the stack lines
up frame for frame with the clip. Each block names its layers (`--blocks` lists them): title `pre · logo · badge · name
· sub`; headline `kicker · headline · sub`; stat `number · label · sub`; endcard `logo · name · tagline · cta · url ·
character-1 … character-N`; cast `headline · character-1 … character-N`; orbit `headline · characters (or logo) · lines ·
icons`; field `headline · icons · characters (or logo)`; media `media · scrim · headline`; phone,
browser and panel give the device (`phone` / `window` / `panel`), then **one layer per UI item** named after its type and
its place in `items:` (`msg-1`, `card-2`, `toast-4` …) and `cursor` when there is a tap; prompt gives `prompt-box ·
prompt-text · step-1 … step-N`. Custom blocks tag their elements (see Custom blocks); untagged ones become one `content`
layer.

**What stays editable**: everything a layer can do as a whole — position, scale, rotation, timing (slide, trim, retime,
reverse), opacity, colour (tint, curves, fill), masks, effects (glow, shadow, blur), blend modes, the stacking order,
deleting or replacing a layer (e.g. your footage instead of `00-background`). **What is baked**: the motion *inside* a
layer (its easing, the word-by-word reveal, a UI item's entrance, typing), the camera push and motion blur, drop shadows,
and the text itself (pixels — except the After Effects live text below; copy inside UI items is always pixels).

**After Effects**: File › Scripts › Run Script File… → the `.jsx` (keep it in the folder with the movies). It makes a
comp of the shot's size, fps and duration, imports the layers back to front with straight alpha, names them as in the
manifest and adds the UI sounds. Every text layer made by `ctx.text` (headline, kicker, sub, label, name, tagline, url,
pre) also gets a **live-text** precomp: one After Effects text layer per word with the same copy, size, tracking,
position and colour (accent words keep the accent), keyed for position, scale and opacity to within 0.2 px / 0.05 % /
0.4 % of the engine's own motion (reveal, drift, camera push). The baked text layer stays underneath, switched off — in a
`--with-transitions` export with camera motion blur it's the other way round (the live text can't carry the blur): the
baked text stays on and the live text is added switched off, ready to turn on for editing.
Live text needs the font installed (Inter, or the brand font under the PostScript name `Family-Weight`); the script
names any font it had to substitute. *Not run in After Effects here*: verified by an ES3 parse and by running it against
a mock of the After Effects scripting API (`launch-videos/layers-probe/ae-mock.mjs`).

**CapCut** has no project import. Import every `.mov`; put `00-background.mov` (or your footage) on the main track at
0:00, then `01-…`, `02-…` each on its own overlay track **above the previous one** (the higher track is in front), all
starting at 0:00, with the project canvas set to the export's aspect. Whether a CapCut build keeps ProRes 4444 alpha
varies: put one layer over a colour — a black box around it means the alpha was dropped; then try the `.webm` files
(`--webm`), and failing that use `--clips` on the background. The `-preview.mp4` shows what the stack should look like.

Cost: a shot of C layers renders C + 3 passes (the flattened reference, it on its background, the background, each
layer; C + 1 with `--alpha`) — about a minute for a 4 s shot of 6 layers — and keeps ~150 MB of PNGs per 4 s shot in `DIR/out/<cut>/<aspect>/layers/`
(QA and the contact sheet read them; delete the folder once the layers are handed over). Live text is skipped for text
whose words change during the shot (the counting `stat` number; the manifest says so in `liveTextNote`). `--aspect`
and `--cut` take one value here.

Layer QA (per shot; every line must PASS — never hand over a folder that has a `QA-FAILED.txt`):

| Check | Passes when |
|---|---|
| order | each file's `NN-` number is its position in the manifest (editors that stack by file name follow it) |
| format | every layer is a W×H ProRes 4444 with an alpha plane, exactly the clip's frame count and fps; with `--webm` each WebM twin too (VP9, alpha decoded with libvpx, same frame count, visible alpha) |
| layers | more than one content layer, unless the shot has a single element (a bare headline, a one-element custom block; elements are counted inside unpainted wrappers too) |
| nonempty | every layer is visible (≥ 4 pixels above 10 % alpha) in at least one frame |
| bg | without `--alpha`: the background layer is opaque in every pixel of every frame |
| stack | the delivered layers, decoded at 16 bit and stacked back to front in manifest order (premultiplied "over"), match a flattened `--clips --alpha` render of the same frames: per frame at most 64 pixels may differ by more than 16 code values (worst RGBA channel); in frames where the camera's motion blur is ≥ 1 px (whips and zooms, `--with-transitions` only) at most 64 pixels by more than 64 |
| stack+bg | without `--alpha`: background + layers match the flattened render on its background, same limits |

Where the limits come from (measured on the final engine: 30 clean exports of every block in 16:9 / 9:16 / 1:1,
transparent and on the background, plus 24 with transitions — 270 motion-blurred frames; an earlier 48-export campaign
also covered 24 and 60 fps): in still frames the stack differs from the flattened clip by 0–4 code values almost
everywhere — ProRes 4444 round trip and Chrome raster noise; the worst frame had 18 pixels off by more than 16 (a title
whose full frame Chrome composites around the user's rotating SVG logo image, while each layer alone isn't). In
motion-blurred frames the camera blur is baked into each layer separately, and blurring layers one by one is not the same
as blurring the finished frame where layers meet (up to 48 code values on edge pixels; none above 64). The QA's
reference render is bit-identical to `--clips --alpha` output (checked: 0 of 116 frames differ). A dropped, misordered, shifted or empty
layer misses by thousands of pixels — `launch-videos/layers-probe/probe.mjs` re-runs the QA on tampered exports to prove it.

**When the stack check fails** the layers don't add up to the frame: an element is in two layers or in none (a custom
block that animates with `visibility`, or an untagged painted wrapper), or Chrome drew part of the full frame
differently from the same part alone. Chrome does that when it decides to composite part of the page on its own (it
then rasterises it separately and resamples it, depending on what else is on screen and on the frames before); the FAIL
line names the frames and the passes where that happened. Triggers found while building this, all avoided by the
built-in blocks except `panel` `style: glass`:
`will-change` on anything; a transformed element (even `rotate(0deg)`) inside a container that fades or scales — set
`transform: none` while it doesn't move, and fade the element itself rather than a wrapper around rotated content; glass
styles (`backdrop-filter`): a `panel` with `style: glass` can't be split exactly (the blur behind each item sees other
layers in the full frame) and fails the stack check — use `card` or `bare` for layers. Content far outside the frame is
handled by the engine, with one known exception: `--with-transitions` on a `field` shot that exits with `zoom-out` (the
camera pulls back while the tiles fly past the frame edge) — its icons pass composites in the first exit frame and the
stack check fails there; export that shot clean (the default) or give it another exit. Also: a wrapper with opacity < 1 around elements of *different* layers that overlap blends them
as a group, which separate layers can't reproduce — fade each element instead.

What the stack check can't see: an element smaller than about 64 pixels dropped from the stack, a colour or opacity
error under ~15 %, or an opaque element drawn twice in exactly the same place. Swapping two layers that never overlap
changes nothing visible, so it passes (correctly).

## QA (runs at the end of --film; must say QA PASSED for every cut × aspect)

| Check | Passes when |
|---|---|
| video | W×H, 60 fps, frame count = timeline, h264 yuv420p, bt709 primaries/transfer/matrix, tv range |
| fresh / audio | the mp4 holds exactly the current frames and master (recorded at mux time); its soundtrack was built from this timeline and audio code — an animatic or clip export never touches the film's audio |
| shots | the renderer's log changes shot exactly at the timeline's cut indices |
| cut | hard cuts (`out: cut`) are one-frame luma spikes ≥ 1.25× their neighbours; moving transitions are INFO (the shot log proves them) |
| freeze | no run of ≥ 4 identical frames outside `hold:` ranges. Frames from one Chrome page must be pixel-identical to count; across a page seam (where one render worker hands over to the next, or where a `--range` render meets older frames) Chrome's raster noise is ±1–2 code values, so a pair there counts as still at ≤ 2. Holds are reported as verified still |
| content | every frame differs from a background-only render of the *same* frame (same camera, content hidden) in ≥ 3 thumbnail pixels (1/10 scale, by > 12 luma) — so a blank frame fails even on a busy grid or dark background |
| text | at each hero frame no text clipped by the frame and none under 18 px (UI mocks exempt); WARN outside the safe area or under 26 px |
| loudness / duration | mp4 audio −14 ± 0.2 LUFS, true peak ≤ −1 dBTP (INFO when the soundtrack is deliberately silent); exact timeline length |
| sfx / whoosh | every cue's onset within 1.5 ms (ticks, clicks) or 3 ms (pops, chimes, hits), measured on QA lanes (stems where the previous cue on the lane has finished ringing); cues buried in another sound's tail in the full mix are INFO (a design hint). Whoosh peaks within 12 ms of their cuts on the whoosh stem |

Clips get their own QA: frame count and format (alpha plane present), content (alpha coverage for transparent clips, the
per-frame background-only render otherwise) and freeze (same seam rule).

Never ship a FAIL and never loosen a threshold to get a pass. Fix the cause (usually copy too long, a shot too short
for its UI items, or a custom block that stops moving) and re-run.

## Limits (raise them at the brief)

- **Live action** can't be generated: write a shot list (`templates/live-action-shotlist.md`) for the user to film on a
  phone, or use licensed stock; the `media` block plays it and composites copy over it.
- **Voiceover** isn't synthesised: the user records it (or picks a TTS service); `voiceover:` mixes and ducks it.
- **Audio** is checked by meters (loudness, true peak, onset timing), never by ear.
- **Output is a code project**, not After Effects. If a motion designer takes over, deliver per-element layers
  (`--layers`, with an After Effects import script and live text), clips (`--clips --alpha`) and the storyboard PDF.
  Easing inside a layer stays baked; the .jsx is checked against a mock of the After Effects API, not in After Effects.
- Simple 2.5D only; no 3D scenes or character acting.
- Footage audio is not used (the `media` block is picture only; mix sound via `music`/`voiceover`).
- Disk: layer exports keep ~150 MB of PNGs per 4 s shot in `DIR/out/<cut>/<aspect>/layers/` (delete after hand-off).
  Frames stay in `DIR/out/` (~300 MB per 20 s per aspect, plus small `bgref/` thumbnails). Delete
  `DIR/out/*/*/frames` once the user signs off (QA needs them, so re-run `--film` before re-checking).
- Tested on macOS (Chrome, ffmpeg 8). Windows paths are untested. A job folder path can't contain `%` (ffmpeg reads it as
  a frame-number pattern); the CLI refuses such a folder up front.
- **Originality**: references inform pacing and style only. Characters, copy and music are made original (the built-in
  cast is generic shapes); a brand's own logo, characters, fonts and screens come only from the user's official assets.
