---
name: product-launch-sting
description: "Make product launch videos, social reels and UI motion clips in code, with automated QA. Mode A: a fixed 12 s square keynote-style launch sting from 7 brand inputs. Mode B (video/GUIDE.md): a video designed with the user (brief, script, beat grid, storyboard, film in 16:9 / 9:16 / 1:1 with music, footage, voiceover); Instagram / TikTok reels on the user's AI footage (Higgsfield, Veo, Kling) with stickers, floating UI cards, before/after splits, captions and a comment CTA; Higgsfield-style launch films with product UI over AI footage; transparent overlay clips and per-element layers for CapCut or After Effects; a breakdown of a saved reference reel (shots, pacing, tempo) or a track's BPM; review sheets whose notes Claude applies. Use for a launch sting, launch video or film, promo, teaser, reel / TikTok / Shorts, motion graphics over AI video, a storyboard, UI mockup or overlay clips, layers for After Effects or CapCut, a reference-video breakdown, or \"make a launch video/reel for <product>\"."
---

# Product launch videos

## Which mode

- **A — the 12 s sting** (this file, below): the user wants the quick, fixed, square keynote-style sting and can give
  7 inputs (name, logo, colours, prompt line, answer page, two feature names, music). Timing and animation are fixed.
- **B — from scratch** (`video/GUIDE.md` — read it before doing anything else in this mode): any other launch, feature
  or teaser video (their own story, length, 16:9 / 9:16 / 1:1, cutdowns, footage, voiceover), **or a reel or launch
  film on their AI footage** (GUIDE → "Reels and launch films": the reel blocks sticker / float / split / cta + captions,
  the film blocks lockup / type / scene / agent / roster / stack / wall, momentum `drift-*` cuts and camera fields measured
  on a Higgsfield film; `--init --kit reel|film` starts one), **or UI
  mockup clips for their own edit** (transparent ProRes 4444 per shot at their edit's frame rate, with matching UI sound
  effects — also the way to lay motion design over AI footage in CapCut), **or a shot split into per-element
  transparent layers** to polish by hand in After Effects or CapCut (`--layers`: one movie per element, an After Effects
  import script with live text, a manifest), **or a reference breakdown** of a reel they saved (`--breakdown FILE`:
  shots, transitions, pacing, tempo, contact sheets, a draft timing; GUIDE → "Reference breakdown") **or a track's
  tempo** (`--tempo FILE`).
  Staged with approval gates: brief → script → beat grid → storyboard stills → animatic → film + QA → review sheet
  (`--sheet`: per-shot notes the user types, you apply) → deliverables.

If it isn't clear which they want, ask one question: "the 12-second template sting, or a video we script and
storyboard together (a launch film, or a reel on your AI footage) — or UI clips to drop into your own edit?" Reels,
launch films, reference breakdowns and tempo checks are all mode B of this one skill.

# Mode A — product launch sting

A fixed, already-animated 12 s film (8 shots, exact frame numbers, hard cuts, SFX on the cuts) whose brand is swapped by
one file, `brand.json`. You never touch timing or animation; you gather inputs, write `brand.json`, show stills, then
build and QA the film.

`$S` below = `~/.claude/skills/product-launch-sting`. Requirements: Node ≥ 18, `ffmpeg`/`ffprobe` on PATH, Google Chrome
installed (driven headless via playwright-core with `channel: 'chrome'`; nothing is downloaded). Dependencies are
already in `$S/node_modules` (playwright-core 1.48.2, @fontsource/inter 5.1.0); if missing, `cd $S && npm ci`
(mode B also needs `cd $S/video && npm ci` for its one extra package, yaml).

## The film (fixed)

Frames are 29.97-fps numbers (`f`); the film renders at 59.94 (frame index = 2f), 720 frames, audio exactly 12.075 s.

| Shot | Frames | Time | On screen | Brand fields used |
|---|---|---|---|---|
| S1 | f0–71 | 0.00–2.40 s | lockup (logo disc · name · pill) drops in over a hub window; cursor clicks the disc | name, pill, logo, hubNav, hubSub |
| S2 | f72–100 | 2.40–3.37 | navy app icon with the logo, four squares orbit and fly into the menu bar | logo, navy/deep, blue/teal/mint |
| S3 | f101–158 | 3.37–5.30 | menu bar; a glass prompt springs out and the prompt line is typed | prompt, clock, deep/sky/teal |
| S4 | f159–186 | 5.30–6.24 | answer page scrolls in; cursor lands under the bold key phrase | crumbs, pageTitle, body, body2 |
| S5 | f187–214 | 6.24–7.17 | a card rises over the page (storyboard art with the logo) | card5, logo |
| S6 | f215–244 | 7.17–8.17 | two stacked feature cards, feature names in huge glass type | cards |
| S7 | f245–300 | 8.17–10.04 | logo disc settles, holds still f269–287, shrinks | logo |
| S8 | f301–359 | 10.04–12.01 | the name flies in on a black end card | name |

Hard cuts at f72, f101, f159, f215, f245, f301; whooshes on f72/f101/f159/f301, hits at 6.240 s and 8.175 s.

## Workflow

### 1. Ask for the 7 inputs, in one message

Offer a concrete suggestion for each from what the user already said, so they can just answer "yes" or fix one line.

1. **Product name + pill**: the name exactly as it should read (≤ 22 chars; longer shrinks the whole lockup) and a
   1–3-word pill saying where or what it is ("on Discord", "for iOS", "Beta").
2. **Logo**: an SVG (or a transparent PNG ≥ 512 px) of the *symbol* mark, not a wordmark. A single-colour mark is
   best: it gets recoloured per spot (dark on the light discs, white on the navy icon and menu bar). Multi-colour logos
   keep their own colours (`"logoTint": false`), so check they read on both light and dark. No logo means a 1–2 letter
   monogram inside corner brackets (`copy.mono`).
3. **Colours**: 2–3 brand colours as hex. You turn them into the 10-key palette (table below). **Palette rule** from the
   source prompt: no purple, violet, magenta or orange anywhere. `build.mjs` refuses them. If the brand colour is one
   of these, say so and propose the nearest allowed hue (blue, teal, green, red, yellow). Use `--allow-palette` only if
   the user insists after hearing that.
4. **Prompt line**: what gets typed into the AI prompt box in S3. One sentence, 20–45 chars, no final period ("Make a
   launch video for my app"). Up to ~33 chars stays on one line; up to ~65 wraps onto two.
5. **Answer page**: the page that prompt "produces". A title (≤ 26 chars), then 2–3 sentences. The first sentence
   holds a **key phrase** of 2–4 words, set in bold black, which the cursor lands under; it goes in `body`, and the
   rest goes in `body2`. Also 2–3 breadcrumbs, the first being the product name.
6. **Two feature names**: one word each, ideally ≤ 10 letters (set huge; both share the size of the longer one), each
   with a small chip label ("Module 3", "New", "Skill 1").
7. **Music**: (a) the built-in 124 BPM house cue (default; optionally `transpose` −7…+7 semitones to change key, with
   timing untouched); (b) their own track, given as a file plus a start time in seconds. It is trimmed to 12.075 s,
   levelled to the built-in cue's music-to-SFX balance and faded over the last 1.5 s; the licence is theirs, and a start
   that puts a downbeat at 2.40 s (the first cut) syncs best. (c) SFX only.

Fill the minor fields yourself from context (`card5`, `hubNav`, `hubSub`, `clock`); ask only if nothing fits. If the
user says "you decide", draft all 7 and show them with the stills.

### 2. Make the job folder and brand.json

Default job folder: `~/Downloads/launch-stings/<slug>/` unless the user names one. Then:

```bash
node ~/.claude/skills/product-launch-sting/build.mjs --job ~/Downloads/launch-stings/<slug> --init
```

That writes a starter `brand.json` (the reference brand's values, without `tints`). Overwrite its fields. Copy the logo
and music files into the job folder and reference them by relative path. A filled example is
`$S/brands/example-design-autopilot.json`.

### 3. Stills, then STOP for approval

```bash
node ~/.claude/skills/product-launch-sting/build.mjs --job DIR --stills
```

This takes about 3 s and writes `DIR/stills.png`, a captioned 2×2 sheet: f40 (S1 lockup + hub), f86 (S2 app icon),
f150 (S3 typed prompt), f230 (S6 feature cards). Before showing it:

- Resolve every `brand:` and `layout:` line printed (copy that was shrunk, wrapped or still overflowing). Fix the copy
  and re-run. A "too long … shorten it" line is never acceptable to ship.
- Look at the sheet (Read the PNG). Check the name and pill read clearly, the logo is crisp and centred in the disc and
  icon, the prompt is fully typed inside the glass, the feature words are legible, and the palette hangs together.

Show `stills.png` to the user (attach it with SendUserFile where available, else give the path) with a 3–5 line
summary of the inputs used, then **stop and ask for
approval or changes. Do not render the film before they approve.** Iterate by editing `brand.json` and re-running
`--stills`. To see all 8 shots, run `--stills 40,86,125,150,175,200,230,280,330` for a 3×3 sheet.

### 4. Film

```bash
node ~/.claude/skills/product-launch-sting/build.mjs --job DIR --film
```

Run it in the background. It takes about 1 min: 720 frames with 4 Chrome workers (~40 s), then audio → master → mux →
QA (~10 s). It writes `DIR/<slug>-sting.mp4` (H.264 high, CRF 14, yuv420p, bt709-tagged, AAC 320k) and
`DIR/<slug>-sting-master.wav` (48 kHz, 24-bit). The frames stay in `DIR/out/frames` (~130 MB). To change only the
music afterwards, edit `music` and run `--audio` (~10 s, no re-render).

### 5. QA

`build.mjs` runs `qa.mjs` last, and it must print `QA PASSED (8/8)`. To re-run it alone:
`node $S/qa.mjs --job DIR`. It writes `DIR/out/qa.json`.

| Check | Passes when | If it fails |
|---|---|---|
| video | 720 frames, 1080², 60000/1001, h264 yuv420p, bt709 primaries/transfer/matrix, tv range | re-run `--film` |
| cuts/png, cuts/mp4 | the 6 largest frame diffs (tblend difference → YAVG) are exactly indices 144, 202, 318, 430, 490, 602, each a one-frame spike (≥ 1.25× its neighbours) | a very high-contrast palette can make S3's camera move out-shout a cut: soften deep vs sky and re-render |
| freeze | pixel-identical neighbours in the PNG frames at 539–574 (S7 hold) and nowhere else | something changed `stage.html` motion, so don't ship |
| loudness | mp4 audio −14 ± 0.2 LUFS, true peak ≤ −1 dBTP | read the `master` passes in the log |
| duration | 579 600 samples (12.075 s) in master.wav and the mp4 | re-run `--audio` |
| sfx | SFX-only stem onsets within 1 ms of 0.100, 2.330, 3.830, 6.240, 8.175 s (energy-ratio detector) | audio code or timeline changed, so don't ship |
| whoosh | whoosh envelopes peak within 10 ms of 2.402, 3.370, 5.305, 10.043 s | same |

Never ship a FAIL, and never loosen a threshold to get a pass.

### 6. Deliver

Send the MP4 and master WAV (SendUserFile where available, else the paths) with one line on the format, the QA line,
and this caveat in substance: *the audio is verified by meters only (−14 LUFS, true peak ≤ −1 dBTP, SFX within 1 ms of
their cues); nobody has listened to it yet, so please give it one listen on headphones before it goes out.*

## brand.json

```jsonc
{
  "copy": {
    "name": "Design AutoPilot",          // S1 lockup, S1 hub card, S8 end card
    "pill": "on Discord",                // dark pill after the name
    "mono": "DA",                        // monogram, used only when there's no logo (1–2 chars; 3 max)
    "prompt": "Turn this campaign brief into a launch page",
    "crumbs": ["Design AutoPilot", "Playbooks", "Campaign pages"],
    "pageTitle": "Brief to page in one go",
    "body": ["Drop a campaign brief in the channel and AutoPilot drafts the ", {"k": "whole campaign page"}, ", from hero visual to rules and rewards."],
    "body2": "Review the draft in Discord, ask for changes in plain words, and send it to Figma when it looks right.",
    "card5": ["Campaign page draft", "Ready in about 4 min"],    // S5 card title + meta
    "cards": [["Skill 1", "Visuals"], ["Skill 4", "Comms"]],     // S6 [chip, feature] ×2
    "hubNav": ["Projects", "Chat"],      // optional: S1 sidebar labels
    "hubSub": "Discord bot · 6 skills",  // optional: S1 hub card subtitle
    "clock": "Mon Jun 22  9:41 AM"       // optional: S3 menu-bar clock
  },
  "palette": { "page": "#FBFDFD", "haze": "#B3DADF", "ice": "#E2F3F4", "deep": "#134E5C", "sky": "#5EA7B6",
               "navy": "#0D2930", "blue": "#1A73E8", "teal": "#1FC2B4", "mint": "#3DDC97", "white": "#FFFFFF" },
  "logoSvgPath": "logo.svg",             // relative to the job folder; null = monogram. .png/.webp also accepted
  "logoTint": true,                      // true: recolour the silhouette per spot; false: keep the logo's colours
  "logoScale": 0.8,                      // optional: logo size inside its slot
  "music": { "mode": "synth", "transpose": 0 }   // or {"mode":"track","path":"song.mp3","start":12.5} or {"mode":"none"}
}
```

`body` must contain exactly one `{"k": …}` (the key phrase never wraps). An optional `"tints": {…}` overrides any of
the 28 secondary tints that `stage.html` derives from the palette (`deriveTints`). Normally leave it out; the reference
brand pins them to reproduce the original film exactly.

### From 2–3 brand colours to the 10 palette keys

| Key | Role (where it shows) | Pick |
|---|---|---|
| page | background of every light shot | near-white, ≤ 2% toward the brand hue (L ≥ 97%) |
| haze | S1 opening haze | light, low-saturation brand tint (L ≈ 80–85%) |
| ice | pale tint: hub header, glows, card art | L ≈ 93–95% |
| deep | dark brand tone: S3 wallpaper top, card art, icon gradient | L ≈ 22–30% |
| sky | mid brand tone: S3 wallpaper bottom, card art | L ≈ 52–62% |
| navy | darkest: S2 app icon, play button, all shadows | L ≈ 10–18% (the white logo sits on it) |
| blue | primary accent: send button, first square, menu dot, hub icon | brand primary, saturated |
| teal | secondary accent: glows, S1 ring, second square | brand secondary |
| mint | third accent: third square, sound bars on the S6 card | a fresh third (green, aqua, yellow-green) |
| white | white | `#FFFFFF` |

Keep deep, sky and navy in one hue family (the brand's dominant hue) and let blue, teal and mint carry the accents.
`brand.mjs` warns if `page` isn't light or `navy` isn't dark.

## Files

`build.mjs` is the entry point (`--init | --stills [list] | --film [--workers N] | --audio`, plus `--allow-palette`).
`brand.mjs` loads and validates brand.json (palette rule, field shapes, logo/music paths). `stage.html` is the film:
`window.seek(f)` renders any frame as a pure function, `window.BRAND` is injected by `render.mjs`, and `window.LAYOUT`
reports auto-fit warnings. `render.mjs` drives system Chrome to stills or frames and writes `out/timeline.json` (typing
frames). `audio.mjs` synthesises music + SFX (`STEM=sfx|music`, `TRANSPOSE=n`). `master.mjs` solves −14 LUFS with a
limiter and also checks the true peak after an AAC round-trip. `qa.mjs` holds the checks above. `brands/` holds the
reference brand (Frame by Frame, which reproduces the original film) and the example; never edit those, copy them.

## Limits and gotchas

- The timeline is fixed: 12 s, square, 8 shots. For vertical, 16:9, other durations, the user's own story, footage or
  UI clips, use mode B (`video/GUIDE.md`) instead of re-animating `stage.html`.
- "Could not start Google Chrome": install Chrome, or set `CHROME_PATH` to a Chrome binary.
- `stage failed to build: logo: …` means the SVG needs a `viewBox` (or numeric width/height) and must not be empty or
  fully transparent. A logo with a solid background box becomes a solid square when tinted; use a transparent mark or
  `"logoTint": false`.
- Chrome's raster differs by a few code values run to run on blurred frames; that is normal and QA doesn't depend on it.
- Each job keeps ~130 MB of frames. Delete `DIR/out/frames` once the user is happy (QA's cut and freeze checks need
  them, so re-run `--film` if you need QA again).

Footage: video/FOOTAGE.md · recreate a film: video/RECREATE.md
