---
name: cue-painted-short
description: "Saturday" — 34 s hand-painted Cue short built on JohnHeibel/ClaudeAnimationBase (p5.brush); Cue agent family as a painted character module
metadata:
  type: project
---

Built 2026-10-20 in `Design-AutoPilot-stable/cue-painted/` (copy of ClaudeAnimationBase, MIT). `src/cue.js` = the 9 Cue agents (tri, drop, star, heart, cog=logo, mint, brief, ghost, blob; colours sampled from @CueAgents' 09-28 launch film "Give it a cue." line-up) plugged into the kit's feel()/emotions(); use `cueEmotions(t, agent, keys)` — plain emotions() cross-fades from Clawd's clay colour. Model sheets in `docs/cue_family.jpg`, `docs/cue_emotions.jpg`. Film = `src/scenes/cue_saturday.js` + `STORYBOARD.md`; render `node render.mjs --clip --out=out/cue_saturday.mp4` (~3 min, ~0.2 s/frame on this Mac). Draft v0.1 delivered silent; v0.2 adds sound: `audio/mix.mjs` drives the launch-sting skill's buildAudio/master (playful, 100 bpm, drop on the tap, SFX cues on animation frames) + OpenAI gpt-4o-mini-tts VO (voice coral; it reads slow — trim silence, atempo ≤1.1, verify with whisper-1 transcript). Output `out/cue_saturday_sound.mp4`.

**Why:** Alex is joining Manus (Cue) and wanted a Cue launch-style video from this kit after seeing the Clawd demo.
**How to apply:** Agent art is a painted reinterpretation of public-video mascots — swap in Manus official assets before public use ([[launch-video-mode-b]] brand rule). End card "cue" wordmark is a Helvetica placeholder. Open: user listen-through (audio verified by meters + transcript only), review notes.
