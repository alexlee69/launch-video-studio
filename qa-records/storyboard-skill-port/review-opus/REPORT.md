# Opus review of the storyboard port (round-2 code), 2026-10-26

Saved by the author from the reviewer's returned text. 15 findings: 0 high, 5 medium, 10 low; none repeats a Sonnet
finding or C1–C4. Runs were in `review-opus/work/` (a film-kit job at a path with spaces and unicode, a `--cut 10s`
cutdown, a reel kit, a 40-shot 9:16 stress job, a symlinked job path, a parity copy of manus2-space, adversarial specs
and covers). No skill file edited, nothing paid. `PH` = placeholders.py, `PM` = phone.mjs, `SB` = STORYBOARD.md.

## Medium
1. **Two phone runs on the same board corrupt each other and both can report success** (PM:345-356): each wipes
   `board-phone/` and screenshots into it, then builds the PDF from those paths. Repro: two runs 0.5 s apart with
   different `--dpr` → both exit 0, the PDF mixes 1080×1920 and 2160×3840 pages; 2.5 s apart → exit 5 ENOENT; SIGTERM
   mid-run leaves a half-filled folder. Fix: screenshot into a per-run temp folder and swap it in; an exclusive lock.
2. **Missing or broken stills ship as grey boxes, exit 0** (PM:242, 344): decode failures are swallowed; nothing checks
   `naturalWidth`. Repro: remove one still and truncate another → exit 0, two empty grey cards. Fix: refuse and name
   every card whose still didn't load.
3. **With the starter's `crops: []` the label is cut in the film's other aspects, unwarned** (starter.json:6): `init`
   ignores beats.yaml `aspects`; the plate's metadata has no crops; neither tool checks the aspect shown. Repro: film kit
   (16x9, 9x16, 1x1) → init/draw with defaults → 9:16 still shows "hand holds a phone at dusk ·" with "AI FOOTAGE · hook
   · A" cropped away. Fix: prefill aspect/crops from beats.yaml; warn in draw; record crops; flag in status/phone.
4. **`letterbox` on a plate shot hides the label's first line, unflagged** (the kit puts `# letterbox: true` beside
   `bg:`): a 2.39 bar is 138 px (12.8 %) on 16:9, the label sits 7 % down. Fix: add `letterbox` to `moves()` and SB.
5. **An END inset can never fit on a 16:9 plate with a 9:16 crop** (PH:820-827): max height 102.5 px vs a 129.6 px
   minimum, always; the warning's advice can't help. The common launch-film setup; the flow suite's plates hit it. Fix:
   size from the free height / a minimum relative to the inset's shape; say plainly when there's no room.

## Low
6. **Redrawing with no change makes every board stale**: byte-identical PNGs get new mtimes → phone refuses. Fix: skip
   the replace when the bytes are identical.
7. **Duplicate JSON keys are dropped silently** (two `"S01"` plates, two `"figures"`). Fix: `object_pairs_hook` refusal.
8. **Tags (and the END tag) can sit outside the frame or a crop**: a tall figure's tag above y = 0; tags only 3.5 %
   inside the crop, not 7 %; tags not kept inside crops. Fix: clamp tags inside the safe area with the full margin.
9. **`status`'s hint for a cutdown loops** (`--grid` rebuilds only the main timeline) and printed commands break on paths
   with spaces. Fix: add `--cut`; quote paths.
10. **`phone.mjs` and `status` can disagree about a moving plate** (PM checks moves only if the first placeholder file
    found is the bg). Fix: check whenever `s.bg` is among the shot's placeholder files.
11. **The default cover misnames the example plate** (shot id, not the plate id) **and Inter's contextual alternates draw
    "16x9.pdf" as "16×9.pdf"**. Fix: use the metadata id; turn `calt` off for the default line's filename only (keeps
    parity).
12. **GUIDE's command list reads `[--aspect 16x9]` as the default** (it's the film's first aspect) and omits `--cut`.
13. **The story section and GUIDE's fun rule go beyond the source note**: "each with its own engine" contradicts "keep
    the engine"; "A reference film works because of its story's engine" generalises (a UI-only reference like hf02 has
    none); GUIDE applies fun-scoring to every film and adds "an ad for an ad".
14. **"Placeholders never ship: status must print none" over-assures**: `status` sees only marked PNGs — not the kit's
    `assets/placeholder-*.svg` stand-ins, nor a plate re-saved by another app (`sips` strips the marker).
15. **Environment errors still exit 5**: `init` when `tools` is a file; `status` on a timeline that is a list; `draw`
    into a read-only plates folder.

## Checked and holds
Parity 26/26 byte-identical on a `cp -p` copy of manus2-space's board (6.76 MB); 13 PDFs structurally valid (xref,
stream lengths), embedded JPEGs equal the page files, correct /Creator and UTF-16 /Title, no text layer; every aspect,
a cutdown, a symlinked job, a unicode path with spaces; the 40-shot stress job (44 pages, 41 notes over 3 pages, an
escaped note, a 480-character note); crop geometry and label/inset containment in 15 aspect/crop combinations; the
unfilled starter lists all hints; cover edge cases; SIGTERM exits 143 with no temp PDF and no orphaned Chrome; both
`moves()` match the engine; `apply_pointers.py` rebuilds live; Python 3.9.6 / numpy 2.0.2 / Pillow 11.3.0.
