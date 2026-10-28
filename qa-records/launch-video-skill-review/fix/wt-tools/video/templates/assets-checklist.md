# Assets checklist

Put everything in `assets/` and reference it by relative path in `beats.yaml`.

| Asset | Best format | Used by | Notes |
|---|---|---|---|
| Logo (symbol) | SVG with a viewBox; or PNG ≥ 512 px, transparent | `brand.logo` → title, endcard, phone headers, notifications | one-colour marks can be recoloured with `logoTint` |
| Brand colours | hex | `brand.colors` | bg, ink, accent (+ accent2/3); keep text contrast ≥ 4.5:1 on bg |
| Fonts | .woff2 (or .ttf/.otf) for 400 and 700 | `brand.font` | check the licence allows embedding in video |
| Product UI | Figma link, or screenshots at device resolution (phone 1170×2532, desktop 2560×1600) | `image:` items, `media` | rebuild key moments with UI items for crisp, animatable versions |
| Characters / illustrations | SVG, or PNG with transparency | `brand.cast` | the brand's own characters only from its official files |
| Footage | MP4/MOV, 1080p+, steady, 3–6 s per clip | `bg:` on any shot (bgFrom = seconds into it), the blocks' footage fields, `media` (src + from) | see live-action-shotlist.md |
| AI footage | MP4 from the user's AI video tool, at the film's aspect, a little longer than its shot, no text in it | `bg:` on the shot it goes behind; `float` card, `split` before/after, `stack` / `wall` cards | GUIDE.md → "Reels and launch films" |
| Music | WAV/MP3 you have a licence for + the second to start from | `music.style: track` | or let the skill compose (playful / keynote / calm) |
| Voiceover | WAV, dry, 48 kHz | `voiceover` | the music ducks under it |
| Legal lines | text | a `headline` sub or the endcard | store badges: use the official badge artwork only |
