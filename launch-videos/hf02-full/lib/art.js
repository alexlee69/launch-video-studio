'use strict';
// Original procedural pictures: podcast cover art, avatars, stars, and generic app screens for the "apps compared" fan.
// Seeded, so the same seed draws the same picture in every frame and every render.

function rng(seed) { let s = (seed * 2654435761 >>> 0) || 1; return () => ((s = (s ^ (s << 13)) >>> 0, s = (s ^ (s >>> 17)) >>> 0, s = (s ^ (s << 5)) >>> 0) % 100000) / 100000; }
const COVER_PAL = [
  ['#FF6B5A', '#FFC15E', '#2B1B3D'], ['#2E6BFF', '#7FD1FF', '#0C1A3A'], ['#19B47E', '#E6F59A', '#0D2B22'], ['#8B5CF6', '#FF9BD2', '#1E1036'],
  ['#E0A15A', '#F7E3C3', '#3A2412'], ['#FF7A1F', '#2A2B31', '#F3E9DC'], ['#0FA3B1', '#F7F052', '#102A30'], ['#D7263D', '#F5D0C5', '#1B1B1E'],
  ['#5B8E7D', '#F4E285', '#1F2F2A'], ['#3D5A80', '#E0FBFC', '#14213D'], ['#EE6C4D', '#293241', '#F8F1E5'], ['#9B5DE5', '#00F5D4', '#16112A'],
];
// cover art: gradient field + one bold shape + the show's title; w×h px, corner radius r
function cover(parent, seed, { w = 120, h = 120, r = 10, title = '', x = 0, y = 0 } = {}) {
  const R = rng(seed + 11), p = COVER_PAL[seed % COVER_PAL.length], kind = Math.floor(R() * 4);
  const ang = Math.round(R() * 360), id = 'cv' + seed + '_' + Math.round(R() * 1e5);
  let shape = '';
  if (kind === 0) shape = `<circle cx="${30 + R() * 40}" cy="${35 + R() * 30}" r="${22 + R() * 14}" fill="${p[1]}" opacity=".92"/>`;
  else if (kind === 1) shape = Array.from({ length: 6 }, (_, i) => `<rect x="${-10 + i * 20}" y="-10" width="9" height="130" fill="${p[1]}" opacity="${0.35 + i * 0.1}" transform="rotate(${18} 50 50)"/>`).join('');
  else if (kind === 2) shape = `<path d="M-5 ${70 + R() * 10} Q 30 ${30 + R() * 20} 55 ${60} T 110 ${45 + R() * 10} V 110 H -5Z" fill="${p[1]}" opacity=".9"/><circle cx="${70 + R() * 15}" cy="${25 + R() * 10}" r="9" fill="${p[1]}"/>`;
  else shape = Array.from({ length: 4 }, (_, i) => `<circle cx="50" cy="${58}" r="${44 - i * 10}" fill="none" stroke="${p[1]}" stroke-width="3.2" opacity="${0.4 + i * 0.18}"/>`).join('');
  const t = title ? `<text x="8" y="91" font-family="Inter" font-weight="700" font-size="${title.length > 14 ? 9.5 : 11.5}" letter-spacing="-0.02em" fill="${p[2] === '#F3E9DC' || p[2] === '#F8F1E5' ? '#1B1B1E' : '#FFFFFF'}">${title}</text>` : '';
  return el(parent, 'abs', { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', borderRadius: r + 'px', overflow: 'hidden' },
    `<svg viewBox="0 0 100 ${100 * h / w}" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"><defs><linearGradient id="${id}" gradientTransform="rotate(${ang} .5 .5)"><stop offset="0" stop-color="${p[0]}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient></defs><rect width="100" height="${100 * h / w + 1}" fill="url(#${id})"/>${shape}${t}</svg>`);
}
const AVA = ['#F4A261', '#2A9D8F', '#E76F51', '#457B9D', '#8D99AE', '#BC6C25', '#6D597A', '#B5838D', '#3A86FF', '#FB5607'];
function avatar(parent, name, { x = 0, y = 0, d = 32 } = {}) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const ini = name.split(/\s+/).map(s => s[0]).slice(0, 2).join('');
  return el(parent, 'abs', { left: x + 'px', top: y + 'px', width: d + 'px', height: d + 'px', borderRadius: '50%', background: AVA[h % AVA.length],
    color: '#fff', font: `600 ${d * 0.38}px/${d}px Inter`, textAlign: 'center', letterSpacing: '-0.02em' }, ini);
}
function stars(parent, k, { x = 0, y = 0, size = 12, color = '#FFB020', off = '#D9D5DE', gap = 2 } = {}) {
  const pts = '50,6 61,38 95,38 67,58 78,92 50,71 22,92 33,58 5,38 39,38';
  return el(parent, 'abs', { left: x + 'px', top: y + 'px', height: size + 'px', display: 'flex', gap: gap + 'px' },
    Array.from({ length: 5 }, (_, i) => `<svg viewBox="0 0 100 100" width="${size}" height="${size}"><polygon points="${pts}" fill="${i < k ? color : off}"/></svg>`).join(''));
}
// generic app screens (other apps the crew compares): a palette + one of four layouts; w×h is the screen
const APP_PAL = [
  { bg: '#0E1424', fg: '#F2F5FF', mu: '#7D88A6', ac: '#4C7DFF', card: '#18213A' }, { bg: '#FFFFFF', fg: '#14161C', mu: '#8A8F9C', ac: '#FF5A36', card: '#F2F3F6' },
  { bg: '#10221B', fg: '#EAF7F0', mu: '#7FA595', ac: '#3DDC97', card: '#18342A' }, { bg: '#F7F1E8', fg: '#2B2118', mu: '#9C8B78', ac: '#C8553D', card: '#EFE4D4' },
  { bg: '#1A1030', fg: '#F6EEFF', mu: '#9C8CB8', ac: '#C77DFF', card: '#26183F' }, { bg: '#FDFBF2', fg: '#1D1D1B', mu: '#8F8C80', ac: '#E8B10C', card: '#F1EDDC' },
  { bg: '#0B1E2D', fg: '#E9F4FB', mu: '#7A97AB', ac: '#00B4D8', card: '#12304A' }, { bg: '#2B0F14', fg: '#FFEDEF', mu: '#B98A90', ac: '#FF4D6D', card: '#3D1820' },
];
function appScreen(parent, seed, { w = 180, h = 390, x = 0, y = 0, r = 22 } = {}) {
  const P = APP_PAL[seed % APP_PAL.length], R = rng(seed + 3), L = seed % 4, k = w / 180;
  const s = el(parent, 'abs', { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', borderRadius: r + 'px', overflow: 'hidden', background: P.bg });
  const box = (css, html = '') => el(s, 'abs', css, html);
  const T = (str, l, t, size, wgt = 600, col = P.fg) => box({ left: l * k + 'px', top: t * k + 'px', font: `${wgt} ${size * k}px/1.1 Inter`, color: col, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }, str);
  const bar = (l, t, ww, hh, col = P.card, rr = 5) => box({ left: l * k + 'px', top: t * k + 'px', width: ww * k + 'px', height: hh * k + 'px', background: col, borderRadius: rr * k + 'px' });
  T(['Menu', 'Book', 'Reviews', 'Tonight'][L], 14, 30, 20, 700);
  bar(150, 30, 16, 16, P.card, 8);
  if (L === 0) { cover(s, seed * 7 + 1, { x: 14 * k, y: 62 * k, w: 152 * k, h: 120 * k, r: 12 * k }); for (let i = 0; i < 4; i++) { cover(s, seed * 7 + 2 + i, { x: 14 * k, y: (196 + i * 44) * k, w: 34 * k, h: 34 * k, r: 7 * k }); bar(56, 200 + i * 44, 80 - R() * 30, 8, P.fg, 4); bar(56, 214 + i * 44, 60, 6, P.mu, 3); } }
  else if (L === 1) { for (let i = 0; i < 6; i++) cover(s, seed * 5 + i, { x: (14 + (i % 2) * 78) * k, y: (64 + Math.floor(i / 2) * 92) * k, w: 74 * k, h: 74 * k, r: 10 * k }); for (let i = 0; i < 6; i++) bar(14 + (i % 2) * 78, 142 + Math.floor(i / 2) * 92, 50, 6, P.mu, 3); }
  else if (L === 2) { bar(14, 62, 152, 30, P.card, 15); for (let i = 0; i < 5; i++) { cover(s, seed * 3 + i, { x: 14 * k, y: (106 + i * 52) * k, w: 42 * k, h: 42 * k, r: 21 * k }); bar(64, 114 + i * 52, 90 - R() * 30, 9, P.fg, 4); bar(64, 129 + i * 52, 56, 6, P.mu, 3); } }
  else { cover(s, seed * 11, { x: 0, y: 56 * k, w: w, h: 170 * k, r: 0 }); T('Open at 7 pm', 14, 240, 9, 500, P.mu); bar(14, 256, 120, 11, P.fg, 4); bar(14, 290, 152, 4, P.card, 2); bar(14, 290, 70, 4, P.ac, 2); box({ left: 70 * k + 'px', top: 310 * k + 'px', width: 40 * k + 'px', height: 40 * k + 'px', borderRadius: '50%', background: P.ac }); }
  bar(0, 362, 180, 28, P.card, 0);
  for (let i = 0; i < 4; i++) bar(22 + i * 42, 371, 12, 10, i === 0 ? P.ac : P.mu, 3);
  return s;
}
Object.assign(window, { rng, cover, avatar, stars, appScreen, COVER_PAL, APP_PAL });
