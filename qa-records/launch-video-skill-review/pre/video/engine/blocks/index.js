// Built-in block registry (isomorphic: Node imports it for cues/hero/validate; the stage imports it to build).
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

export const BLOCKS = Object.fromEntries([title, headline, cast, orbit, field, stat, media, endcard, phone, browser, panel, prompt].map(b => [b.name, b]));
