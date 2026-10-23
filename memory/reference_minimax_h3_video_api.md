---
name: reference-minimax-h3-video-api
description: "MiniMax H3 video API can take our animated draft as a reference_video (≤15 s) to generate photoreal footage — Leo's 'vector draft → MiniMax' workflow; no MiniMax key on this Mac (2026-10-21)"
metadata:
  node_type: memory
  type: reference
  originSessionId: db3322f5-f4cf-44bc-bee5-82db478af53f
  modified: 2026-10-23T01:35:00.000Z
---

Leo's tip (2026-10-21): use the "vector draft" (our code-animated film, flat shapes and UI) to direct MiniMax into a "real life" (photoreal) version.

**MiniMax API, as checked 2026-10-21:**
- **Endpoint:** `POST https://api.minimax.io/v2/video_generation`, with `Authorization: Bearer <key>`. Poll it with the v2 Query Task endpoint.
- **Models:** `MiniMax-H3` (768P/2K, 4–15 s) and `MiniMax-H3-Max` (480P/768P, 5–15 s). H3 needs the Pay-as-you-go plan.
- **Inputs:** a `content[]` array of `text`, `image_url`, `video_url` and `audio_url` items, each with a role:
  - `first_frame` and `last_frame` for image-to-video;
  - `reference_image` (up to 9), `reference_video` (up to 3 clips, 2–15 s each, ≤15 s total, ≤50 MB) and `reference_audio` for reference-to-video.
  - Image-to-video and reference-to-video can't be mixed in one request.
- **The docs don't confirm the bracket camera commands** like `[Push in]` for H3. The older v1 `/v1/video_generation` with `first_frame_image`/`last_frame_image` still exists for Hailuo-02/2.3.

**Access:** this Mac has no MiniMax key and no MiniMax or Higgsfield MCP (only Figma). Alex runs MiniMax through **fal.ai**: his `FAL_KEY` is in `~/Downloads/launch-videos/.env` (chmod 600, not a git repo). Never print it, sign up, or enter credentials yourself.

**fal route, tested 2026-10-21 on plate 1:**
- **Setup:** `minimax/h3-max/reference-to-video`, our guide clip as `reference_video_urls` ("Video 1"), sent as a base64 data URI. 1080P costs $0.16/s, and a 6 s clip came back in ~100 s.
- **Tools:** in `hf02-full/tools/fal/`:
  - `guide_clip.mjs` renders a plate without its UI;
  - `fal_gen.mjs` submits through the REST queue, polls, downloads, and logs to `.fal.json`;
  - `render_with_footage.mjs` swaps a footage slot in through an init script, without editing story.js.
- **What came back:** photoreal, and it follows the guide's composition, push and actions closely. But:
  - it's 24 fps with its own audio;
  - it is stretched over the requested length (asked 6 s, got 6.59 s, events ×1.17 late). Request ≈ the guide's length (5 s minimum) or retime uniformly; `setpts` + `minterpolate` to 30 fps worked.
- **Style leaks:** drawn details in the guide come through literally (the illustrated window skyline; a stray drawn-finger blob by the wrist). Fix them in the guide or the prompt.

**Alex: the draft-guided clip "looks so fake" (2026-10-22).** Measured against the Higgsfield reference's live-action plates (`tools/fal/look_stats.py`):

| | Reference plates | Draft-guided H3 |
|---|---|---|
| p50 luma | 63–80 | 127 |
| Deep shadow (luma < 40) | ~30% | 9% |
| Saturation | 42–46 | 30 |
| Sharpness | 3–5 | 10 |
| Shadows / highlights | cool / warm | flat warm |

The model copies the vector draft's flatness: even pastel light, staged props, drawn details.

**The reference's own recipe:**
- photographic sources with motivated, mixed-temperature low-key light;
- a lived-in set;
- a wide lens close to the subject, a handheld or real camera move with parallax;
- a performance;
- 24 fps footage dropped into the 30 fps edit by repeating frames (21 of 117 frames repeat), no interpolation.

**So:**
- Use the vector draft only for timing and composition intent.
- Generate a photoreal key frame first (FLUX 1.1 Pro Ultra `raw: true`, written as a cinematographer's brief), then run `minimax/h3-max/image-to-video` from it.
- Conform with `tools/fal/conform.py` (frame repeats, native speed), never `minterpolate`.

**v2 result (plate 1, 2026-10-22):** the photo key frame + i2v reads as real next to the reference (`out/fal/v2/plate1-ref-v1-v2.mp4`).
- **Raw i2v measured too dark:** p50 35 and 55% shadow.
- **The grade that hit the targets:** `curves=all='0/0 0.03/0.03 0.137/0.27 0.4/0.58 0.68/0.82 1/1',eq=saturation=1.25,colorbalance=rs=-0.04:bs=0.05:rh=0.08:gh=0.02:bh=-0.06,gblur=sigma=1.4`. It gives p50 64, saturation 46 and a cool/warm split; sharpness only came down to 9.5, and more blur reads as defocus.
- **Timing:** start 0.9 s in so the clip's action lands on the shot's beats at native speed.
- **Cost:** $1.08 per plate (2 stills $0.12 + 6 s at 1080P $0.96).

**Traps:**
- FLUX defaults to a MacBook with the Apple logo: ask for an unbranded laptop, or fill the logo out of the key frame (`out/fal/v2`).
- fal's CDN stalls from this network: download with curl resume and retries (`fal_gen.mjs` now does).

**How to apply:**
- AI video won't hold exact UI text or frame-exact motion. Generate the live-action moments (plates, carousel) as footage, keep the UI as vector on top, and drop the clips into the job's footage slots (`STORY.footage` in [[hf02-motion-recreation]]).
- Feed a guide clip of 15 s or less per request.

**Now a skill tool (2026-10-22):** for new jobs, `~/.claude/skills/product-launch-sting/video/footage/gen.mjs` and `FOOTAGE.md` replace `hf02-full/tools/fal/` ([[launch-video-mode-b]]). Run `--go` and `fetch` with run_in_background: an H3 clip outlasts the 2-min foreground shell timeout. The look table above used ffmpeg's dark default decode. The exact decode reads the reference plates ~2 higher (p50 65–82).
