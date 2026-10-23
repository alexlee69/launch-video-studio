'use strict';
// The crew: six ORIGINAL characters (nothing is taken from the reference's mascots).
// ───────────────────────────── the crew (original characters) ─────────────────────────────
// viewBox -5 -8 110 110; every body is ~80 units wide, centred near (50, 54).
let gN = 0;
const EYES = {
  open: (c, hi) => `<ellipse cx="40" cy="55" rx="5.4" ry="7.6" fill="${c}"/><ellipse cx="60" cy="55" rx="5.4" ry="7.6" fill="${c}"/>` +
    (hi ? `<circle cx="41.9" cy="52" r="1.8" fill="${hi}"/><circle cx="61.9" cy="52" r="1.8" fill="${hi}"/>` : ''),
  blink: c => `<rect x="34" y="54" width="12" height="3.8" rx="1.9" fill="${c}"/><rect x="54" y="54" width="12" height="3.8" rx="1.9" fill="${c}"/>`,
  happy: c => `<path d="M33.5 59 Q40 49 46.5 59 M53.5 59 Q60 49 66.5 59" fill="none" stroke="${c}" stroke-width="4.2" stroke-linecap="round"/>`,
  dots: c => `<circle cx="41" cy="56" r="3.5" fill="${c}"/><circle cx="59" cy="56" r="3.5" fill="${c}"/>`,
};
const BODY = {
  scout: { c: '#2E6BFF', lo: '#1B4FD6', hi: '#6F9CFF',
    under: g => `<path d="M60 17 Q64 6 70 2" fill="none" stroke="#1B4FD6" stroke-width="3.2" stroke-linecap="round"/><circle cx="71" cy="1.5" r="5" fill="url(#${g})"/>`,
    body: 'M50 14 C74 14 90 32 90 56 C90 78 72 93 50 93 C28 93 10 78 10 56 C10 32 26 14 50 14Z' },
  critic: { c: '#FF7A1F', lo: '#E35F08', hi: '#FFAA6B',
    under: g => `<circle cx="25" cy="25" r="10" fill="url(#${g})"/><circle cx="75" cy="25" r="10" fill="url(#${g})"/>`,
    body: 'M50 19 C76 19 90 35 90 57 C90 79 73 93 50 93 C27 93 10 79 10 57 C10 35 24 19 50 19Z' },
  analyst: { c: '#2A2B31', lo: '#15161A', hi: '#4A4C55', eye: '#FFFFFF', eyeHi: null,
    under: () => '', body: 'M36 17 H64 C80 17 90 27 90 43 V67 C90 83 80 93 64 93 H36 C20 93 10 83 10 67 V43 C10 27 20 17 36 17Z',
    over: `<g fill="none" stroke="#A9ABB8" stroke-width="2.6"><circle cx="40" cy="55" r="11.5"/><circle cx="60" cy="55" r="11.5"/></g>` },
  director: { c: '#F6F5F9', lo: '#DDDBE3', hi: '#FFFFFF', stroke: '#D3D1DA',
    under: () => '', body: 'M50 17 C72 17 89 34 89 56 C89 77 72 93 50 93 C28 93 11 77 11 56 C11 34 28 17 50 17Z',
    over: `<g transform="rotate(-14 50 18)"><ellipse cx="50" cy="16" rx="25" ry="8.5" fill="#3B3A46"/><rect x="47.5" y="3" width="5" height="7" rx="2.5" fill="#3B3A46"/></g>` },
  builder: { c: '#19B47E', lo: '#0E9566', hi: '#5FD9AE',
    under: () => `<path d="M50 18 Q50 10 50 7" stroke="#0E8A5E" stroke-width="3" stroke-linecap="round"/><path d="M50 9 C42 1 33 4 32 9 C38 13 45 12 50 9Z" fill="#2FCB92"/><path d="M50 8 C58 -1 68 2 69 7 C63 12 55 12 50 8Z" fill="#0E9566"/>`,
    body: 'M50 16 C80 16 90 27 90 55 C90 83 80 93 50 93 C20 93 10 83 10 55 C10 27 20 16 50 16Z' },
  writer: { c: '#8B5CF6', lo: '#6B3EDF', hi: '#B597FF',
    under: () => `<path d="M46 17 C44 7 54 3 58 9 C61 14 54 17 52 13" fill="none" stroke="#6B3EDF" stroke-width="3.2" stroke-linecap="round"/>`,
    body: 'M48 15 C76 13 92 33 90 58 C88 80 70 94 48 92 C26 90 10 76 11 53 C12 31 26 16 48 15Z' },
};
function crewSVG(id, expr) {
  const b = BODY[id], g = 'g' + (gN++), h = 'h' + gN;
  const eye = b.eye || '#15151A', eyeHi = b.eyeHi === undefined ? '#FFFFFF' : b.eyeHi;
  return `<svg viewBox="-5 -8 110 110" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b.hi}"/><stop offset="0.42" stop-color="${b.c}"/><stop offset="1" stop-color="${b.lo}"/></linearGradient>
  <radialGradient id="${h}" cx="0.34" cy="0.26" r="0.5"><stop offset="0" stop-color="#fff" stop-opacity="${id === 'analyst' ? 0.16 : 0.32}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
  ${b.under(g)}<path d="${b.body}" fill="url(#${g})" ${b.stroke ? `stroke="${b.stroke}" stroke-width="1.6"` : ''}/><path d="${b.body}" fill="url(#${h})"/>
  ${(EYES[expr] || EYES.open)(eye, eyeHi)}${b.over || ''}</svg>`;
}
// a character node: centre (cx, cy) in its parent, body `w` px wide (svg box is 110/80 of that)
// a brand's OFFICIAL agent art, when its files are listed in STORY.brandArt.cast (shown as supplied, never redrawn);
// otherwise our own character
function crewArt(id, ex) {
  const src = window.STORY && STORY.brandArt && STORY.brandArt.cast && STORY.brandArt.cast[id];
  return src ? `<img src="${src}" alt="" style="display:block;width:100%;height:100%;object-fit:contain">` : crewSVG(id, ex);
}
function crew(parent, id, expr, w) {
  const box = w * 110 / 80;
  const n = el(parent, 'crew', { width: box + 'px', height: box + 'px' });
  n._id = id; n._box = box; n._expr = null;
  n.set = (cx, cy, ex) => {
    n.style.left = (cx - box / 2 + 0.0 * box) + 'px'; n.style.top = (cy - box * (54 + 8) / 110) + 'px';
    if (ex && ex !== n._expr) { n.innerHTML = crewArt(id, ex); n._expr = ex; }
  };
  n.set(0, 0, expr);
  return n;
}
// left offset: viewBox x=-5 → body centre (50) sits at (55/110) of the box; we position by that centre
function placeCrew(n, cx, cy, ex) { n.style.left = (cx - n._box * 55 / 110) + 'px'; n.style.top = (cy - n._box * 62 / 110) + 'px'; if (ex && ex !== n._expr) { n.innerHTML = crewArt(n._id, ex); n._expr = ex; } }


Object.assign(window, { EYES, BODY, crewSVG, crew, placeCrew });
