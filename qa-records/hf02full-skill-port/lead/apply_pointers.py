# -*- coding: utf-8 -*-
# The port's small edits to existing skill files (docs + spec.mjs), as exact anchored replacements, so they can be re-applied on top of
# the fix round later (each anchor must match exactly once, or nothing is written).
#   python3 -E apply_pointers.py <skill dir> [--check]      (--check: report only)
import sys, re, os

skill, check = sys.argv[1], '--check' in sys.argv
DESC = ('Make product launch videos, reels and UI motion clips in code, with automated QA. Mode A: a fixed 12 s square '
        'sting from 7 brand inputs. Mode B (video/GUIDE.md): videos designed with the user (brief, script, beat grid, '
        'storyboard, 16:9 / 9:16 / 1:1 film, music, voiceover); reels on AI footage (stickers, floating UI cards, splits, '
        'captions, comment CTA); Higgsfield-style launch films with product UI over footage; photoreal AI footage made '
        "here via the user's fal.ai key (FLUX → MiniMax H3), graded to a reference, app screens pinned onto phones; a "
        'reference film recreated frame for frame with our own content, an original on-beat score and side-by-side proof; '
        "overlay clips and per-element layers for CapCut / After Effects; reference breakdowns, a track's BPM, review "
        'sheets. Use for a launch sting, video or film, promo, teaser, reel / TikTok / Shorts, AI footage, motion graphics '
        'over AI video, recreating a reference video, a storyboard, UI or overlay clips, layers, or \\"make a launch '
        'video/reel for <product>\\".')

EDITS = {
  'SKILL.md': [
    (re.compile(r'^description: ".*"$', re.M), 'description: "' + DESC + '"'),
    ("  tempo** (`--tempo FILE`).\n",
     "  tempo** (`--tempo FILE`).\n"
     "  **AI footage made here** (`video/FOOTAGE.md`): photoreal key frames → MiniMax H3 video through the user's own fal.ai\n"
     "  key (a dry run with the cost until they approve), conformed to the film's frame grid, graded to a reference's measured\n"
     "  look, the app's screen pinned onto phones held in the shot. **A reference film recreated frame for frame**\n"
     "  (`video/RECREATE.md`): its cuts, camera moves and beat grid with our own story, copy and official brand art, an\n"
     "  original score in the launch-film style on its grid (`music: film`), and side-by-side proof (`compare.py`).\n"),
    ("Reels,\nlaunch films, reference breakdowns and tempo checks are all mode B of this one skill.",
     "Reels,\nlaunch films, AI footage, frame-for-frame recreations, reference breakdowns and tempo checks are all mode B of this\none skill."),
  ],
  'video/GUIDE.md': [
    ("they saved (its shots, pacing and tempo — see Reference breakdown). For the fixed 12 s square sting from 7 inputs, use\n"
     "mode A (`../SKILL.md`).",
     "they saved (its shots, pacing and tempo — see Reference breakdown). It also **generates the AI footage** through the\n"
     "user's fal.ai key (`FOOTAGE.md`) and **recreates a reference film frame for frame** with our own story and an original\n"
     "on-beat score (`RECREATE.md`). For the fixed 12 s square sting from 7 inputs, use mode A (`../SKILL.md`)."),
    ("a live-action shot list (`templates/live-action-shotlist.md`) when footage is needed |",
     "a live-action shot list (`templates/live-action-shotlist.md`) when footage is needed; footage generated here: `FOOTAGE.md` (prompts and cost approved first) |"),
    ("node $V/lv.mjs --tempo assets/track.wav                 # the user's own track: bpm, first downbeat and a ready `music:` line\n",
     "node $V/lv.mjs --tempo assets/track.wav                 # the user's own track: bpm, first downbeat and a ready `music:` line\n"
     "node $V/footage/gen.mjs still|video … [--go]            # AI footage via the user's fal.ai key: a dry run with the cost until --go (FOOTAGE.md)\n"
     "python3 $V/recreate/compare.py --ref REF.mp4 --ours OURS.mp4 --out DIR/compare/NAME   # frame-exact side-by-side + cut report vs a reference (RECREATE.md)\n"),
    ("- `music`: `style: playful|keynote|calm|track|none`,", "- `music`: `style: playful|keynote|calm|film|track|none`,"),
    ("  (`--grid` warns, `--film` refuses rather than letting the music stop early).\n",
     "  (`--grid` warns, `--film` refuses rather than letting the music stop early). `film` is the launch-film groove (87 BPM\n"
     "  in F, from the Cue film): its grid starts at `downbeat`, so a film can sit on a reference's beat, and `hit:` moves its\n"
     "  end hit off the end card's first frame (seconds after it, −1…2; `RECREATE.md`).\n"),
    ("Requirements are the same as mode A (Node ≥ 18, ffmpeg/ffprobe, Google Chrome). If `$V/node_modules` is missing:\n"
     "`cd $V && npm ci` (and `cd .. && npm ci` for the parent's playwright-core + Inter).\n",
     "Requirements are the same as mode A (Node ≥ 18, ffmpeg/ffprobe, Google Chrome). If `$V/node_modules` is missing:\n"
     "`cd $V && npm ci` (and `cd .. && npm ci` for the parent's playwright-core + Inter). The footage and recreate tools\n"
     "(`FOOTAGE.md`, `RECREATE.md`) also need python3 with numpy and Pillow (`pip3 install numpy pillow`) and curl.\n"),
    ("music choice (compose: playful / keynote / calm, or their track", "music choice (compose: playful / keynote / calm / film, or their track"),
    ("- **Live action and AI footage** aren't generated here: the user generates clips in their AI video tool (or films them —\n"
     "  write a shot list, `templates/live-action-shotlist.md` — or licenses stock) and drops the files into `assets/`; `bg:`,\n"
     "  the blocks' footage fields and `media` play them and composite the motion design over them.\n",
     "- **Live action and AI footage**: generated here only through the user's own fal.ai key, prompts and cost approved\n"
     "  first (`FOOTAGE.md`); otherwise the user generates clips in their AI video tool (or films them — write a shot list,\n"
     "  `templates/live-action-shotlist.md` — or licenses stock) and drops the files into `assets/`. `bg:`, the blocks'\n"
     "  footage fields and `media` play them and composite the motion design over them. AI video never holds exact UI text,\n"
     "  logos or frame-exact UI motion: those stay code (or the official screenshot, pinned).\n"),
    [("drops the files into `assets/`; nothing is\n"                      # live (2026-10-21) wording
      "generated here. Generate at the film's aspect (9:16 for a reel) and a little longer than the shot (the clip must cover\n"
      "the shot from its `…From` point, or `--film` stops and says by how much); leave room where the sticker or card goes, and\n"
      "no text in the clip. Then, per shot:\n",
      "drops the files into `assets/` (or you\n"
      "generate them here with their fal.ai key: `FOOTAGE.md`). Generate at the film's aspect (9:16 for a reel) and a little\n"
      "longer than the shot (the clip must cover the shot from its `…From` point, or `--film` stops and says by how much);\n"
      "leave room where the sticker or card goes, and no text in the clip. Then, per shot:\n"),
     ("drops the files into `assets/`; nothing is\n"                      # the fix round's wording (wt-engine b1186dc)
      "generated here. Generate at the film's aspect (9:16 for a reel) and a little longer than the shot (the clip must cover\n"
      "the shot from its `…From` point: `--grid` warns, and `--storyboard` / `--film` stop and say by how much); leave room\n"
      "where the sticker or card goes, and no text in the clip. Then, per shot:\n",
      "drops the files into `assets/` (or you\n"
      "generate them here with their fal.ai key: `FOOTAGE.md`). Generate at the film's aspect (9:16 for a reel) and a little\n"
      "longer than the shot (the clip must cover the shot from its `…From` point: `--grid` warns, and `--storyboard` /\n"
      "`--film` stop and say by how much); leave room where the sticker or card goes, and no text in the clip. Then, per shot:\n")],
    ("Its thumbnails stay in `DIR/reference/` as study notes and never go into `assets/`.\n",
     "Its thumbnails stay in `DIR/reference/` as study notes and never go into `assets/`.\n"
     "A frame-for-frame recreation (`RECREATE.md`) also matches the motion (cut points, camera, easing, timings), never the\n"
     "content. The reference's audio appears only in a private temp-track copy for the user's own review, never in a\n"
     "deliverable.\n"),
  ],
  'video/templates/beats.yaml': [
    ("# playful (mallets, 120) | keynote (house, 124) | calm (pads, 96) | track | none",
     "# playful (mallets, 120) | keynote (house, 124) | calm (pads, 96) | film (groove, 87) | track | none"),
  ],
  'video/lib/spec.mjs': [                                             # music: film, music.hit, the hit warning: 5 edits
    ("export const STYLES = ['playful', 'keynote', 'calm', 'none', 'track'];\n",
     "export const STYLES = ['playful', 'keynote', 'calm', 'film', 'none', 'track'];\n"),
    ('const STYLE_BPM = { playful: 120, keynote: 124, calm: 96 };\n',
     'const STYLE_BPM = { playful: 120, keynote: 124, calm: 96, film: 87 };\n'),
    ("  const music = { style, bpm, key: m.key || { playful: 'F', keynote: 'D', calm: 'G' }[style] || 'C', file: m.file || null, start: Number(m.start || 0),\n",
     "  const music = { style, bpm, key: m.key || { playful: 'F', keynote: 'D', calm: 'G', film: 'F' }[style] || 'C', file: m.file || null, start: Number(m.start || 0),\n"),
    ('    downbeat: Number(m.downbeat || 0), drop: m.drop != null ? String(m.drop) : null, breaks: [].concat(m.breaks || []).map(String), level: Number(m.level || 0) };\n',
     "    downbeat: Number(m.downbeat || 0), drop: m.drop != null ? String(m.drop) : null, breaks: [].concat(m.breaks || []).map(String), level: Number(m.level || 0) };\n  // music.hit (style film only; the other styles ignore it, as before): when the hit lands, in seconds after the end card's first frame\n  if (style === 'film' && m.hit != null && !(m.hit !== '' && Number.isFinite(Number(m.hit)) && Number(m.hit) >= -1 && Number(m.hit) <= 2)) errs.push(`music.hit is seconds after the end card's first frame, −1…2 s (got ${JSON.stringify(m.hit)}) — e.g. hit: 0.372 when the reference's hit lands 0.372 s into its end card`);\n  if (style === 'film' && m.hit != null) music.hit = Number(m.hit);\n"),
    ('  for (const id of music.breaks) if (!ids.has(id)) errs.push(`music.breaks: unknown shot id ${id}`);\n',
     "  for (const id of music.breaks) if (!ids.has(id)) errs.push(`music.breaks: unknown shot id ${id}`);\n  { const L = shots[shots.length - 1]; if (music.style === 'film' && music.hit != null && L && L.block !== 'endcard') warns.push(`music.hit does nothing here: the film's last shot (${L.id}) is a ${L.block}, not an endcard — end on an endcard shot`); }   // film hit: the end card must be the last shot\n"),
  ],
}

bad, outs = 0, {}
for rel, edits in EDITS.items():
    path = os.path.join(skill, rel)
    s = open(path, encoding='utf-8').read()
    for edit in edits:
        if isinstance(edit, list) or isinstance(edit[0], str):
            # a list = the same edit for each known wording of its paragraph (live, the fix round): the first that matches.
            # Several replacements contain their own anchor, so "already applied" is decided by the new text first.
            alts = edit if isinstance(edit, list) else [edit]
            done = [new for old, new in alts if s.count(new) == 1]
            if done: print('%s: already applied: %s' % (rel, done[0][:60].replace('\n', ' '))); continue
            hit = [(old, new) for old, new in alts if s.count(old) == 1]
            if not hit:
                for old, new in alts: print('%s: anchor found %d times (need 1): %s' % (rel, s.count(old), old[:70].replace('\n', ' ')))
                bad += 1; continue
            s = s.replace(hit[0][0], hit[0][1])
        else:
            old, new = edit
            m = old.findall(s)
            if len(m) != 1: print('%s: pattern found %d times: %s' % (rel, len(m), old.pattern)); bad += 1; continue
            s = old.sub(lambda _: new, s)
    outs[path] = s
if not check and not bad:
    for path, s in outs.items(): open(path, 'w', encoding='utf-8').write(s)
d = DESC.replace('\\"', '"')
print('description: %d chars (limit 1024)' % len(d))
if len(d) > 1024: bad += 1
print('FAIL: %d problem(s), nothing written' % bad if bad else ('OK (check only)' if check else 'applied'))
sys.exit(1 if bad else 0)
