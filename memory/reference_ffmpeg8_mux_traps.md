---
name: reference-ffmpeg8-mux-traps
description: "ffmpeg 8 + x264/AAC delivery traps measured on the launch sting — CLI colour tags dropped, AAC raises true peak, x264 un-freezes held frames"
metadata:
  node_type: memory
  type: reference
  originSessionId: b58454b2-e032-4d4d-8472-b086dca2d0aa
  modified: 2026-10-20T07:03:31.543Z
---

Measured 2026-10-20 while packaging the launch-sting skill (ffmpeg 8.1, Homebrew):

- **Colour tags:** with `-vf scale=out_color_matrix=bt709:out_range=tv`, the CLI `-color_primaries bt709 -color_trc bt709` are silently dropped (ffprobe shows `unknown`). Append `setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv` to the filter chain — decoded pixels stay bit-identical (framemd5 checked).
- **AAC true-peak overshoot:** a master at −1.2 dBTP measured −0.9 dBTP after AAC 320k in the mp4. Meter an AAC round-trip with the exact mux settings, not just the WAV, and lower the limiter ceiling until the encoded peak holds.
- **Freeze checks:** x264 (CRF 14) leaves ±1–2 code values of noise on held frames, so "pixel-identical neighbours" (tblend YMAX==0) only holds on the lossless PNG frames, never on the mp4.
- Chrome headless raster differs run to run by a few code values on blurred/backdrop-filter frames (~10% of frames); compare computed styles, not pixels, for regression.

Related: [[product-sting-recreation]], [[feedback-verify-probe-success-path]].
