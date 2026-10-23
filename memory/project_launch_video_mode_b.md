---
name: launch-video-mode-b
description: "From-scratch launch videos + transparent UI clips = mode B of the product-launch-sting skill (video/ subfolder); built 2026-10-20 for Alex's Manus 2.0 / Cue work; AI footage via fal + reference-film recreation tools merged into live 2026-10-22"
metadata:
  node_type: memory
  type: project
  originSessionId: 27298075-5641-4a31-9fd2-82e27fc1cc9c
  modified: 2026-10-23T01:35:00.000Z
---

`~/.claude/skills/product-launch-sting/video/` (entry `lv.mjs`, manual `GUIDE.md`) makes launch/feature/teaser videos designed with the user — brief → beats.yaml → beat grid → storyboard stills (PNG+PDF) → animatic → 60 fps film in 16:9/9:16/1:1 + cutdowns + QA — and per-shot UI clips (`--clips --alpha`: ProRes 4444 + WebM + preview + matching SFX WAV) for the user's own edit. SKILL.md has a mode router (A = the fixed 12 s sting, B = this). Job folders: `~/Downloads/launch-videos/<slug>/`; test jobs steady-sample (16:9+9:16), edge-test (1:1, track, footage, custom block, hold, cutdown), dark-ui-check, and deliberately broken probes that must FAIL: qa-probe (freeze + blank-after-cut), qa-probe2 (`--cut seam --workers 2` freeze across a worker seam; `--cut whip` blank frames during a whip).

**Why:** Alex joins Manus (offboards TikTok 2026-10-30) and wants Cue / Manus 2.0 launch videos or "simply UI mockup effects" to drop into videos he edits himself. Built-in characters are original generic shapes; Cue/Manus logos, mascots, fonts and screens must come from Manus's official brand kit — never recreate them from public videos.

**How to apply:** Use mode B for any non-template launch video or UI overlay clip; follow GUIDE.md gates (stills before film). Non-obvious design facts worth keeping:
- QA provenance lives in `out/<cut>/<aspect>/mux.json` (frame prints + master print + mp4 size/sha) — not mtimes; animatic/clips build audio in their own folders so they can never clobber the film's.
- Freeze = bit-identical within one Chrome page; ±2 tolerance only at page seams (`pages.json`). Content = each frame vs a per-frame bg-only render at dpr 0.25.
- `hold:` makes blocks plan for Db = D − hold length; cues/hero map through the hold; holds can't overlap a moving exit.
- HDR (HLG/PQ) footage → SDR via a generated 3D LUT (local ffmpeg has no zscale; macOS avconvert darkens generic HLG to 154/255).
- Clip SFX = one static gain capped at −3 dBTP (−18 LUFS target is unreachable for sparse clicks without gain riding).
Status 2026-10-20: Sonnet → Codex → Opus review chain done (27 + 18 + 17 findings fixed, Opus re-verified all 17 + 4 follow-ups fixed); final 3 QA runs GREEN (sample 4 films + 9 clips, edge main+cutdown + clips, dark-UI, all probes fail as planted); films sent to Alex's phone — awaiting his live test. The short-track check caught a real silent tail in edge-test (track start moved 3.0 → 1.0645 s, exactly 4 beats). Nothing committed (skill lives outside the repo). Audio is checked by meters only. Related: [[product-sting-recreation]], [[feedback-one-skill-per-domain]], [[reference-ffmpeg8-mux-traps]].

RETIRED 2026-10-21: Alex moved to GitHub `alexlee69` ([[user-github-account]]); the new backup is PRIVATE `alexlee69/launch-video-studio` (commit `6d8361b`, 244 files, verified file-for-file 2026-10-21); its releases `renders-2026-10-20` (984 MiB: cue + cue-overlays clips/layers zips rebuilt from local folders, painted-short masters) and `layers-2026-10-20` (s5–s7 layer zips, identical to the recorded checksums) were uploaded 2026-10-21 and verified by GitHub sha256 digest. Nothing more is pushed to the old one. Old backup, left as is: the PRIVATE repo `alexxxlitiktok/launch-video-studio` (skill, all launch-videos jobs minus out/clips/layers, experiments cue-painted/cue-launch/product-sting, 5 memory notes, HANDOVER) + release `renders-2026-10-20` (Cue + overlays clips/layers zips, painted-short masters, SHA256SUMS); second commit `8c463c9` (final layer code) + release `layers-2026-10-20` (Cue s5/s6/s7 16:9 layer zips, published 2026-10-20 23:30 PDT). New home: `alexlee69/launch-video-studio`, local clone `~/Downloads/launch-video-studio` (fresh history, authored Alex Lee); the old clone is `~/Downloads/launch-video-studio-old-alexxxlitiktok`. Not in any backup yet: the speed-up session's in-progress layer-export edits (lv.mjs, layers.mjs, common.mjs, deliver.mjs, new layers-qa-worker.mjs). Restore steps in its README; fresh-clone restore + storyboard render verified. Design-AutoPilot/TikTok work deliberately NOT included.

Layers (built 2026-10-20 in a side session): `lv.mjs --layers <ids|all> [--alpha] [--webm]` → `DIR/layers/<slug>[-<cut>]-<id>-<aspect>/` (NN-<layer>.mov ProRes 4444 back to front, -sfx.wav, manifest.json, After Effects .jsx with live text, -preview.mp4, -layers.png). Layer QA restacks the delivered movs vs a flattened `--clips --alpha` render (bit-identical to real clips output): still frames ≤ 64 px off by > 16, motion-blurred frames (camera blur ≥ 1 px) ≤ 64 px off by > 64 — both measured. Probe job `launch-videos/layers-probe/` (p1–p13 + probe.mjs tampering + ae-mock.mjs) must keep failing/passing as labelled. AE never available: .jsx only proven by ES3 parse + AE-API mock. CapCut alpha support still unknown (asked Alex). Phone upload limit is 30 MiB: full packs (with 34 MiB background movs) only reach the desktop; send `--alpha` packs to the phone. The GitHub backup above was refreshed with the final layers code on 2026-10-20 (its second commit). Chrome traps: [[reference-chrome-layer-separation-traps]]. Speed-up 2026-10-21 (side session, uncommitted, in NO backup): 3 Chromes + page reuse + async encodes + worker-thread QA, 36-export sweep 1,461 → 787 s with identical output; files lv.mjs, lib/render.mjs, layers.mjs, layers-qa-worker.mjs, deliver.mjs, common.mjs, GUIDE.md (engine/ untouched). Findings: [[reference-layers-render-speedup]].

Review sheet (built 2026-10-21 from an IG "Video Breakdown Sheet" tip Alex sent): `lv.mjs --sheet [--aspect all] [--cut X] [--stills]` → `DIR/review/<slug>[-cut]-<aspect>/` (index.html artifact body, preview.html, film.mp4 30 fps proxy, thumbs/, sheet.json; code in `lib/sheet.mjs` + `lib/sheet.html`, GUIDE "Review sheet"). Published as an Artifact with `db` + `user` (profile); notes = collection `notes`, doc `<cut>~<shot>` (`~_film` whole film), status open/keep/none → Claude writes done/question + reply + doneIn with if_version. Cue main sheet: https://claude.ai/artifact/WYFSY5KErkuC9EzRGXtUEE (URL also in `cue/review/cue-16x9/artifact.json`). Traps: shot prints include ENGINE code, so any skill edit marks every shot stale — `--sheet` falls back to job-file mtimes vs the mp4 and only warns; python http.server has no byte ranges so the video can't seek (page loads the proxy as a blob when unseekable); the browser pane is NOT signed in to claude.ai, so the live page's db code was only tested via a mock `window.claude` + ArtifactData probes. Not yet in the launch-video-studio backup. 2026-10-21 live test: Alex's first notes never reached the db — the page said "Notes stay in this browser" (db resolved null where he opened it, likely the phone/top-level view), so they sat in that device's localStorage. v3 shows a banner + "Turn on saving" (permissions.request/manage) and moves local notes up once db works; until confirmed, always ask him to press Copy notes and paste.

**10-21 work review + fix round:** the work done on 10-21 (W4 bg contract, the reel/film kit port, the hf02 motion upgrade) was reviewed 2026-10-22 by Sonnet + Opus. Codex hit its usage limit. Opus confirmed all 57 unique findings, 3 of them HIGH: the camera `move` vs media Ken Burns `move` collision, wall chips hidden, and QA `cut` false-failing `type through` → `cut`, the real K1 cause. Everything durable is in `Design-AutoPilot-stable/qa/launch-video-skill-review/`:
- `REPORTS.md` §5–6;
- `snap/` = the rollback copy, == live as of 10-21 19:45;
- `fix/` = a private scratch git staging repo, with worktrees per group, findings and work dirs.

The fix round started 01:20 (workflow wf_4b5e8a81-73f) and is still staged, unmerged (its session paused ~04:30 PDT 10-22). Nothing goes to the alexlee69 backup without Alex's OK. **Live is no longer == `snap/`:** the hf02-full port was merged on top (below). Never restore `snap/` over live; merge the fix round onto current live, then re-run the port's `apply_pointers.py` (see `qa/launch-video-skill-review/NOTE-hf02-port-merged.md`).

**hf02-full port, merged into live 2026-10-22 18:27 PDT (awaiting Alex's live test):** the [[hf02-motion-recreation]] job's tools became skill tools. The port is additive only: 14 new files and 5 edited ones. The other 73 files are byte-identical, and the old styles' output is byte-identical on 9 jobs.
- **`video/footage/` + `FOOTAGE.md`:**
  - `gen.mjs` drives the fal queue: a FLUX 1.1 Ultra still, then `minimax/h3-max/image-to-video`.
    - It never spends without `--go`. There are two approval rounds per plate (the stills, then the video), at ≈ $1.08 a plate.
    - A paid result and its request id are never lost. A cut-off run is resumed with `fetch`, never re-submitted.
  - `look.py` measures a clip against a reference, with an exact BT.709 decode.
  - `conform.py` grades and conforms with frame repeats, never `minterpolate`.
  - `pin.py` pins an app screen onto a generated phone.
  - `screen.mjs` makes the stand-in screen from the job's `phone` shot.
- **`video/recreate/` + `RECREATE.md`:**
  - `compare.py`: the frame-locked side-by-side and the cut report. `--cuts-from` with a checked list is the definitive route.
  - `track.py`: the motion tracker.
  - `music.py compare`: the beat check (ON THEIR BEAT).
  - `temptrack.py`: the PRIVATE copy with the reference's audio. Alex-only, never a deliverable.
- **`music: film` style:**
  - 87 BPM in F.
  - `hit:` is in seconds after the end card's first frame (−1…2).
  - The end card must be the last shot, or `--grid` warns.
  - The pre-hit silence is music-only. A cut into the end card gives true silence (≈0.4 s). A moving transition into it
    (zoom/whip/blur) leaves its whoosh tail in the first ≈0.2 s of the gap (QA3: −28 dBFS RMS). Alex 2026-10-23: keep
    it (no code change); RECREATE.md §4 says so.
- **Run fal `--go` / `fetch` with run_in_background.** A foreground Bash call times out at 2 min, and an H3 clip takes ~100 s or more. FOOTAGE.md says so.
- **Key order:** `--env FILE`, then `FAL_KEY` in the environment, then `~/Downloads/launch-videos/.env`.
- **Record and re-apply kit:** `Design-AutoPilot-stable/qa/hf02full-skill-port/`, containing:
  - `PATCHES.md`;
  - `lead/apply_pointers.py` (idempotent anchored edits);
  - `lead/merge_live.py`;
  - `lead/smoke_live.sh` (15 checks, 8 s);
  - `acceptance/run.sh <dir> [--allow-live]` (87 checks, ~8 min);
  - `live-before/`, the rollback copy.
- **Old jobs:** `lv.mjs --qa` fails its `audio` check until `--audio` is run once. `audioPrint` hashes audio.mjs; the stems rebuild byte-identical.
- **Not verified by a real paid fal call** (mocks only). One $0.06 FLUX still would prove it; that's Alex's call. The port is not in the alexlee69 backup, and the skill folder isn't a git repo.

**Fix round status (2026-10-22 18:40 PDT):** the first run died in a 03:25 network outage; work is intact in `qa/launch-video-skill-review/fix/`. Live now = snap + the hf02-full port (staging branch `port`), so NEVER restore `snap/` over live; merge = port + fix branches, then `qa/hf02full-skill-port/lead/apply_pointers.py`. Resumed as wf_72bb8632-4c8; REPORTS.md §7 has the details. The tools group's tempo change flagged higgsfield02 off-beat (0.941 → 0.55); must be resolved before merging.
