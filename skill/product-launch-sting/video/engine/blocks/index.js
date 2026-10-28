// Built-in block registry (isomorphic: Node imports it for cues/hero/validate/copy; the stage imports it to build).
import title from './title.js';
import headline from './headline.js';
import cast from './cast.js';
import orbit from './orbit.js';
import field from './field.js';
import stat from './stat.js';
import media from './media.js';
import endcard from './endcard.js';
import phone from './phone.js';
import browser from './browser.js';
import panel from './panel.js';
import prompt from './prompt.js';
// reels (AI footage + stickers): sticker · split · float · cta — helpers in _reel.js
import sticker from './sticker.js';
import split from './split.js';
import float from './float.js';
import cta from './cta.js';
// launch films (UI over AI footage): scene · agent · roster · type · lockup · stack · wall — helpers in _film.js
import scene from './scene.js';
import agent from './agent.js';
import roster from './roster.js';
import type from './type.js';
import lockup from './lockup.js';
import stack from './stack.js';
import wall from './wall.js';
// motion kit (round 1): press · fan · particles · map (+ wall layout: grid, type words, stack mode: exploded) — helpers in _motion.js
import press from './press.js';
import fan from './fan.js';
import particles from './particles.js';
import map from './map.js';

export const BLOCKS = Object.fromEntries([title, headline, cast, orbit, field, stat, media, endcard, phone, browser, panel, prompt,
  sticker, split, float, cta, scene, agent, roster, type, lockup, stack, wall, press, fan, particles, map].map(b => [b.name, b]));
