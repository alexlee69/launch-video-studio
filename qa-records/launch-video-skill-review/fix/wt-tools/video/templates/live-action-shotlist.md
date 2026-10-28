# Live-action shot list (film on a phone; the skill composites over it)

General: shoot 4K or 1080p at 30 or 60 fps, landscape for 16:9 (vertical for 9:16 — or shoot both), lock exposure and
focus, hold each shot 2 s longer than needed at both ends, no talking during the take, natural light, steady (lean on
something or use a gimbal). **Turn HDR video off** (iPhone: Settings → Camera → Record Video → HDR Video): HDR clips
are converted to SDR automatically, but filming SDR matches the phone's own look best. Name files `s<shot>-<take>.mp4`.

| Shot id | What we see | Framing / angle | Move | Length | Notes for compositing |
|---|---|---|---|---|---|
| s? | e.g. a hand holds a phone, scanning a QR code on a café window | medium close-up, eye level | slow push in | 5 s | leave the top third clear for the headline |
| s? | e.g. phone in hand by a window, city behind, screen facing camera | over the shoulder | static | 4 s | screen content gets replaced: keep the screen flat to camera, no glare |
| s? | e.g. a street of shopfronts | wide | slow pan right | 6 s | characters get placed at the shopfronts: avoid people crossing them |

Deliver the files into `assets/footage/` and put each behind its shot with `bg:` (`bgFrom` = seconds into the file where
the usable part starts; any block's copy or UI goes on top), or give it a `media` shot of its own (`src`, `from`).
