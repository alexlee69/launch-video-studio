---
name: reference-ffmpeg8-mux-traps
description: "ffmpeg 8 + x264/AAC delivery traps measured on the launch sting — CLI colour tags dropped, AAC raises true peak, x264 un-freezes held frames; default yuv→rgb reads ~1.8 dark at non-×16 widths and BT.601 for untagged; output-option colour tags convert pixels"
metadata:
  node_type: memory
  type: reference
  originSessionId: b58454b2-e032-4d4d-8472-b086dca2d0aa
  modified: 2026-10-23T01:35:00.000Z
---

Measured 2026-10-20 while packaging the launch-sting skill (ffmpeg 8.1, Homebrew):

- **Colour tags:** with `-vf scale=out_color_matrix=bt709:out_range=tv`, the CLI `-color_primaries bt709 -color_trc bt709` are silently dropped (ffprobe shows `unknown`). Append `setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv` to the filter chain — decoded pixels stay bit-identical (framemd5 checked).
- **AAC true-peak overshoot:** a master at −1.2 dBTP measured −0.9 dBTP after AAC 320k in the mp4. Meter an AAC round-trip with the exact mux settings, not just the WAV, and lower the limiter ceiling until the encoded peak holds.
- **Freeze checks:** x264 (CRF 14) leaves ±1–2 code values of noise on held frames, so "pixel-identical neighbours" (tblend YMAX==0) only holds on the lossless PNG frames, never on the mp4.
- Chrome headless raster differs run to run by a few code values on blurred/backdrop-filter frames (~10% of frames); compare computed styles, not pixels, for regression.

Measured 2026-10-22 during the hf02-full skill port (known Y'CbCr test frames):

- **yuv420p → rgb24 decode bias:**
  - ffmpeg's default swscale conversion is right only at widths that are a multiple of 16 (1920). At 1928, 1080 and 1076 it reads uniformly ~1.8 code values dark, and it decodes untagged clips as BT.601.
  - `-sws_flags accurate_rnd+bitexact+full_chroma_int` is exact. Or take the raw planes and convert them yourself, as the skill's `look.py` does.
  - Any RGB-domain filter (`curves`, `colorbalance`) inherits the bias, so the same grade gives different results at different widths. Grade and measure at the delivery size.
- **Colour tags as output options convert pixels:** `-colorspace` / `-color_primaries` / `-color_trc` on a re-encode can make ffmpeg convert the pixels when they differ from the input's tags. A "lossless" fixture came back 110 → 107 at 1920 and 106 at 1928. To only tag, use `setparams` in the filter chain and check that the planes round-trip exactly. When the input already carries the same tags, nothing changes (checked on hf02-full's share copy: Y mean 104.81 vs 104.82).

Related: [[product-sting-recreation]], [[feedback-verify-probe-success-path]].
