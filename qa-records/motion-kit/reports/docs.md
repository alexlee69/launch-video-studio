# Docs pass: the motion kit, cross-cut transitions, frame and cut checks, launch starters (2026-10-27)

**Bottom line.** `video/GUIDE.md` now documents everything rounds 1 + 2 + the small items added. `SKILL.md` routes to it, and two one-line pointers went into `SHOTS.md` and `STORYBOARD.md`.
- **Validated as printed.** Every YAML example in the GUIDE compiles as printed: `runs/docs/validate-guide.py` pulls each block out of the GUIDE and runs `--grid` on it, and the result is **ALL EXAMPLES COMPILE** (5 examples, 14 shots).
- **Custom-block example.** It is byte-identical to `jobs/doc-custom/blocks/badge.mjs`. That film gives **QA PASSED (14 checks)** with no WARN lines, and purity matches at max Δ 0.
- **The unflattering part.**
  - **Suites will fail.** My edits break two shot-writer parity checks, P8 and P8c, and the storyboard port's P3b, once they run on these docs. Those tests pin SKILL.md and GUIDE.md byte for byte to their pre-port text plus pointer patches. The suites need a patch step before the kit ships (see Asks).
  - **The SKILL description had no room.** It was 1022 of 1024 characters, so adding the kit meant cutting other words (listed below).

I edited Markdown only, in the stage copy. I committed nothing, made no paid calls and ran no `--go`. Every render ran alone at `--workers 2`; `pmset -g therm` was checked before each one and never recorded a warning. Disk is at 40.5 GB free.

Shorthands:
- `M = qa/motion-kit`
- `S = $M/stage/product-launch-sting`

The pre-edit copies of the four docs are in `$M/runs/docs/pre/`.

---

## 1 · What I added, and where

### `video/GUIDE.md` (649 → ~1065 lines)

| Section | Change |
|---|---|
| Intro | One sentence: the motion kit, transitions that cross the cut, `--kit launch15/launch30`. |
| Workflow table | Step 1: fill the passport and trigger map before the first frame. Step 3: `--grid` warnings now include the transition lint. Step 4: the storyboard prints `cause:` and floor notes. Step 7: QA includes the frame and cut checks; the sheet shows cut stills. |
| Commands | The `--kit` line has gained `launch15` and `launch30`; the `--grid` line mentions the transition lint. |
| beats.yaml | The starters line now names `launch15.yaml` / `launch30.yaml`. New `delivery: web \| feed \| tv` bullet. `out:` gains `dive \| flood`. The hold rule adds "14 for a dive or flood" and flood to the cross-cut list (checked in `timeline.mjs`). New `cause:` field, plus a pointer to the cross-cut fields and `signature:`. |
| Blocks table | A **Motion kit** group with 7 rows: press, fan, particles, map, wall `layout: grid`, type `words`, stack `mode: exploded`. float / stack / wall rows gain `from` (and `mode` / `layout`). |
| Blocks → **Motion kit** (new) | One YAML block with an example of each of the 7, then a field-notes bullet per block: defaults, ranges, what `--grid` warns on, minimum lengths. All checked against `spec.mjs` and each block's `validate` / `params`. |
| Footage fields | Fan `cards` added (extracted at .75, like stack). |
| Custom blocks | Reserved layer names gain `carry`, and flood joins the `transition` list. New **Cross-cut hooks** paragraph: `origin: true`, `ctx.origin {x, y, w, h}`, `K.grow(o, rest, t, {t0, len, w, h, lead, bank, arc})` → `{x, y, s, rot, op, k}`, `K.growAt`, `ctx.entered`, `ctx.carried`, and text inside the carried element. New **Chrome transform rule** paragraph, followed by the full `badge.mjs` example and the two QA lessons it encodes. |
| Reels and launch films → "Which block for which moment" | 7 new rows. |
| **Transitions that cross the cut** (new section) | The core rule in our words. A field table with defaults: carry smooth / needle, morph, morph `to: frame`, dive, `from:`, flood, `cause:`, `signature:`. Four validated examples: flood + `from:`, carry + dive into a layer, needle, morph box→box → `to: frame`. Notes per device and the transition lint. What QA does (soft cut by design) and what exports do: clean = no carry / dive / flood; `--with-transitions` gives a `carry` layer, and a flood sits in `transition`. |
| **Launch starters: 15 s and 30 s, and the brief's passport** (new section) | `--init --kit launch15\|launch30 [--title]`, what each contains, and the measured numbers. The two WARN lines each film keeps: end-card URL 31 px, Lc 51–64; orange tags Lc 54, 31–36 px. The two-word-title warning on launch30. What pacing targets, passport and trigger map are for, and which beats.yaml field each one feeds. |
| Review sheet | New **Cut stills** paragraph: `thumbs/cut.<frame>.jpg`, three half-size frames, click to seek, continuity verdict in orange, `--stills` has none, and the row shows `cause:`. The publish recipe now says thumbs include the cut stills (shots + cuts + 2 files). |
| Layers | `--with-transitions` exports a `carry` layer, and the flood goes into `transition`. Layer names for the 7 kit blocks and modes. |
| QA | `cut` row: dives and soft cuts by design are INFO. `text` row points to the floors. New **Frame and cut checks** table (Check · Warns when · Fix it by): deadair, text floors by delivery, contrast, flash (net share, after Alex's 10-27 change), purity (with the one-off re-render INFO), continuity, and reading time. Also: "not measured" INFO, `qa.json` deleted first, quieting a WARN any other way counts as shipping it, and purity's cost. |
| Limits | Fan added to CSS 3D, at ~16 of 64. One shot per frame: only carries and cross-cut transitions draw across a cut. New lines: motion kit (orthographic planes, abstract map, SVG particles and their cost, system serif, fan headline layer); kit chips at ~35 px on 16:9; the 9:16 exploded defect; cross-cut weak spots still open (point dive onto an empty panel, wall `from:` lead card, flood caret, same-colour morph fill); QA lessons from the starters (zoom-through into the same background, first-frame pop, wall built from empty). The disk line mentions `textless/`. |

### `SKILL.md`
- **Description.** The new capabilities are in: set pieces, carries / morphs / dives across cuts, 15 / 30 s starters and frame-by-frame QA.
  - **The constraint.** The old description was **1022 / 1024** characters, so I cut words elsewhere to fit. The new one is 1018 characters parsed; I checked it with the `yaml` parser.
  - **What I dropped:**
    - "AI footage" from the use-for list (it is still in the body: "AI footage via the user's fal.ai key");
    - "splits";
    - "per-element" (layers);
    - "with our content … and proof" (now "with an original score");
    - "app" (screens);
    - "16:9 / 9:16 / 1:1" (now "any aspect");
    - "(… floods)" (the body has floods).
- **Router (Which mode → B).**
  - One clause: "or a 15 s / 30 s launch (`--init --kit launch15|launch30`) built on the motion kit … and transitions that cross the cut …".
  - The shot-writer clause gains phase 2: one trick per shot, the rules that can't break, failure lines.
  - One sentence on the review sheet's cut stills and on QA's frame and cut checks.
  - "15 s / 30 s launches" added to the mode question's summary.

### `video/SHOTS.md` and `video/STORYBOARD.md`
- **SHOTS.md → Story and edit rules → Link scenes:** between code-drawn shots, the same idea is `carry:` / `from:` with the trigger map's `cause:`.
- **STORYBOARD.md → phone edition:** the phone pages carry `cause:` lines and the floor warnings. I checked this by building the phone edition of `jobs/doc-xcut`: `out/main/16x9/board-phone/page-02.jpg` shows the cause line.

`templates/brief.md` needed nothing: S's passport, trigger map and pacing targets already say what they feed.

## 2 · Every example, validated

| Example in the GUIDE | How I checked it | Result |
|---|---|---|
| Motion kit: 7 shots (go, many, think, route, pick, words, layers) | `validate-guide.py` → `jobs/doc-guide-01` `--grid`; same shots + `out: cut` in `jobs/doc-kit` `--grid` + `--storyboard --aspect 16x9` | rc 0. One honest note: `fan many: count 5 — the outer cards bleed off the frame on 1x1 …` (documented). Storyboard `jobs/doc-kit/doc-kit-storyboard-16x9.png`: all 7 render composed, nothing empty. Its floor notes are the documented 34–35 px chips. |
| Flood + `from:` (ask → result) | `doc-guide-02` | rc 0, no warnings |
| Carry + dive into a layer (brief → plan → teaser) | `doc-guide-03`; also in `jobs/doc-xcut` (storyboard 16:9 + phone edition) | rc 0. The lint fires as the GUIDE says ("3 transition types … whip, carry, dive"); with `signature: dive` it is rc 0 and **0 warnings**. |
| Needle (teaser → again) | `doc-guide-04` | rc 0, no warnings |
| Morph box→box → `to: frame` → end | `doc-guide-05` | rc 0, no warnings. The first draft had `go` at 4 beats, which warned on reading time (1.93 s vs 1.95 s); the GUIDE now says `beats: 5`. |
| Custom block `badge.mjs` | Byte compare with `jobs/doc-custom/blocks/badge.mjs`; `--blocks --job` lists it; `--grid` clean; `--film --aspect 16x9 --workers 2` | Identical. **QA PASSED (14 checks)**. contrast INFO worst 5.8:1 Lc 84. deadair INFO, no still stretch. purity: 24 frames, max Δ 0, 1 seam matches. continuity: all hold, 1.2× after the dive. It exercises `from:` (grow), `ctx.entered` (after a dive), `ctx.carried` (a carry lands on it) and the plain house entrance. |
| `--init --kit launch15 --title "Acme Notes"` / `--kit launch30` (with and without title) / `--kit launch20` | `jobs/doc-init15`, `doc-init30`, `doc-init30t` | 8 and 15 shots, no warnings. With "Acme Notes", launch30 warns `again: … needs ~1.6 s` (documented). The title, slug, name cards and `acme-notes.app` are set. launch20 → `✗ --kit must be reel, film, launch15, launch30 …`. |
| Review-sheet cut stills | `jobs/doc-sheet` (APFS clone of the merge's `mrg-launch15`) `--sheet --aspect 16x9` | `thumbs/cut.00060.jpg … cut.00780.jpg` (7 cuts) next to the 8 shot thumbs. `cut.00360.jpg` shows the flood cut: cut−1 almost all flood colour, the cut frame with the result card already landed. |
| The 4 starter WARN lines quoted in the GUIDE | Read from `jobs/mrg-launch15|30/out/main/*/qa.json` (the merge's runs) | Each film × aspect has exactly two WARN lines, a text floor and a contrast line, with the numbers the GUIDE quotes. |

**The custom-block example took four renders to get right, and two of the fixes became GUIDE lines:**
1. **The label was its own layer.** The carry took only the disc, so the label sat under the carried copy, unseen, for about ¾ s. Now the text lives inside the disc, and the GUIDE says to put a card's text inside the card.
2. **`ctx.C.accent` on a dark shot is the lightened accent.** White on it measured **2.5:1 (contrast WARN)**. Now it uses `ctx.brand.colors.accent`.
3. **A badge that only bobs 10 px is dead air on a 2 s hold:** `WARN deadair landed … 0.53 s over`. Now a pulse ring gives it a second beat.
4. **That ring in the plain brand accent was still too faint on dark** to count as motion. Now it uses `ctx.C.accent` at 8 px. The final run gives QA PASSED with no WARN.

The stills are in `jobs/doc-custom/stills/` (`grow-v4.png`, `carry-v4.png`, `dive.png`, `plain.png`, `landed-ring.png`). By eye, the carry blends "Live" into "Done" through the blur on the cut, and nothing pops in.

## 3 · Doc strings and code: suggestions for the fixers (I changed no code)

1. **`lv.mjs` header (lines 5–8).** The `--kit` help only describes `reel / film`. Add "launch15 / launch30: a 15 s / 30 s launch on the motion kit (no assets needed)".
2. **`lv.mjs` `next:` line after `--init --kit launch*`.** It says to "un-comment the bg: lines", but the launch templates have none. Make it kit-specific: "swap the placeholder cards for your clips, or put footage behind any shot with `bg:`".
3. **`stack.js` `params.count`.** It reads "cards in the stack (default 8, max 14)" and says nothing for exploded. Suggest: "cycle: cards in the stack (default 8, max 14); exploded: planes 3–5 (default: the number of cards, else 4)".
4. **`--blocks` "Common to every shot".** It gives no defaults.
   - Suggest `dive {el | at [x,y], zoom (8, up to 16), from (.3)}` and `flood {…, color (default: the next shot's background)}`.
   - Add "pre/post in 30-fps frames" to `carry`.
   - Add "(default layouts / modes)" to `from`.
   - The `cause` text says "storyboard only", but the review sheet shows it too ("storyboard and review sheet; never a pixel").
5. **`storyboard/phone.mjs`.** `.card .cause` keeps the board's 15 px style. On a phone page the cause line is about half the size of the note next to it (`jobs/doc-xcut/out/main/16x9/board-phone/page-02.jpg`). Suggest a rule like `.card .note`: `font-size:22–24px; margin:0 22px 20px; padding:12px 16px`.
6. **`ctx.origin` in clean exports.** `runtime.js` `originFor` doesn't check `CLEAN`, so a `--clips` / `--layers` export of a `from:` shot still grows its cards out of the previous shot's element, which isn't in that clip. `ctx.entered` and `ctx.carried` are null in clean mode. I documented what the code does now, but it is a design call: return null when `CLEAN`, or keep it.
7. **New, still being written by another agent (`jobs/prv-tools`, 06:00).** `runtime.js` now ignores elements marked `data-lv-soft` when it measures carry / dive / flood / `from:` targets, and press / particles mark their glows with it. Once it's final, the GUIDE's cross-cut hooks paragraph needs one line: "mark a soft glow (a halo whose box fades out well inside its edges) with `data-lv-soft`, so carries, dives, floods and `from:` measure the element by its face". I didn't add it because the change was landing while I wrote.

**Code that changed under me.** Two other agents' edits landed during this pass:
- `timeline.mjs` at 05:40: mode-aware `layerNames`.
- `runtime.js`, `press.js` and `particles.js` at 06:00: `data-lv-soft`, and particles honouring `ctx.entered`.

None of it changes a documented field or default: `--blocks` printed the same doc strings at 06:00 as at the start. I re-ran the validator after both changes, and it still gives ALL EXAMPLES COMPILE. The start fingerprint is `runs/docs/code-at-start.sha1`, and the 06:00 `--blocks` output is `runs/docs/blocks-now.txt`.

## 4 · Test suites my edits will break (for the lead, before shipping)

| Suite · check | Why | Proof |
|---|---|---|
| `qa/shots-skill-port/test_parity.py` **P8** | Rebuilds SKILL.md, GUIDE.md, FOOTAGE.md, footage-prompts.md and brief.md from `rollback/` + `apply_pointers.py` + `apply_phase2_brief.py`, and requires all 5 to equal the copy's docs byte for byte. | I reproduced the rebuild in my scratchpad (read-only use of the scripts): **SKILL.md DIFF, GUIDE.md DIFF**; FOOTAGE.md, footage-prompts.md and brief.md the same. Against my pre-edit copies, SKILL.md and GUIDE.md are the same, so the edits are the only cause. |
| same file **P8c** | Requires SKILL.md's first 3 lines (the description) to equal the pre-port text. | The description changed by design. |
| `qa/storyboard-skill-port/test_parity.py` **P3b** | Compares the **live** skill's 4 docs with a rebuild; it is hard-coded to `~/.claude/skills/…`. | Fails only once these docs ship live. Its P4a / P4b, the engine checks, fail on ship anyway. |

**Fix pattern.** S already used this for brief.md: add an `apply_motion_kit_docs.py` with these doc edits as patch pairs, run it after the pointer scripts in P8 and P3b, and let P8c compare against the new description. Or reduce P8 to "every pointer hunk is present". The other suites' doc substring checks still pass: storyboard S1c / S7 / S16 / O12 / O13 / O14 and shots S11b. I grepped each string.

## 5 · Hygiene

| Check | Result |
|---|---|
| Files I edited | `S/SKILL.md`, `S/video/GUIDE.md`, `S/video/SHOTS.md`, `S/video/STORYBOARD.md` (pre-edit copies in `runs/docs/pre/`). No `.js` / `.mjs` / `.py` / `.yaml` in the skill. |
| Live skill | `shasum -c live-before.sha1` from `~/.claude/skills/product-launch-sting`: 0 not OK |
| `live-before/`, `base/`, `~/Downloads/launch-videos/` | No file newer than the start of this pass. Originals were never run with `--job`. |
| My jobs | `jobs/doc-kit`, `doc-xcut`, `doc-custom`, `doc-sheet` (a clone), `doc-init15`, `doc-init30`, `doc-init30t`, `doc-guide-01…05` (an unused `doc-bad` was deleted). Frames, bgref and textless of `doc-custom` were deleted after measuring; mp4, `qa.json`, logs and stills are kept. The test clips are synthetic ffmpeg gradients plus the skill's own placeholder SVGs: no research frames, reel stills or private footage. |
| Heat and disk | One render at a time, `--workers 2`; `pmset -g therm` recorded no warning before any render. 40.5 GB free at the end. |

## 6 · Asks
1. **Update the parity suites** (section 4) in the same change that ships these docs, or the shot-writer and storyboard suites go red on docs alone.
2. **Decide `ctx.origin` in clean exports** (section 3, item 6). The GUIDE describes the current behaviour and will need one line changed if you null it.
3. **When the `data-lv-soft` change settles,** add the one GUIDE line in section 3, item 7, and apply the `--blocks` wording in items 1–5.
