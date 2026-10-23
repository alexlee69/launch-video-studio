'use strict';
// Stand-in Cue app screens: our own generic UI (dark plum, coral accent) with the Cue story's content, until Manus's
// official Cue screens arrive. The header shows the official Cue app icon when STORY.brandArt.logo is set (as supplied),
// otherwise a plain "C" placeholder. (Function names still say hush.)
// hush(parent, kind, opts) draws one screen at w×h (default 180×390, a phone screen at reference scale; pass w to scale).
// kinds: 'home' | 'library' | 'player' | 'chapters'. Returns the screen node; parts that scenes animate are on node.parts.
const HUSH = { bg: '#17121F', surf: '#231B2E', surf2: '#2E2439', fg: '#F6F0FA', mu: '#A898B8', dim: '#6E6080', ac: '#FF6B5A', ac2: '#FFB4A8' };

function hushLogo(parent, { x = 0, y = 0, d = 20 } = {}) {
  const A = (window.STORY && STORY.brandArt) || {};
  if (A.logo) {   // the brand's official app icon, as supplied
    const k = 1 / (1 - 2 * (A.logoInset || 0)), s = d * k, o = (d - s) / 2;
    return el(parent, 'abs', { left: x + 'px', top: y + 'px', width: d + 'px', height: d + 'px' },
      `<img src="${A.logo}" alt="" style="position:absolute;left:${o.toFixed(2)}px;top:${o.toFixed(2)}px;width:${s.toFixed(2)}px;height:${s.toFixed(2)}px">`);
  }
  return el(parent, 'abs', { left: x + 'px', top: y + 'px', width: d + 'px', height: d + 'px', borderRadius: '50%', background: HUSH.ac },
    `<svg viewBox="0 0 20 20" width="100%" height="100%" style="display:block"><text x="10" y="14.2" text-anchor="middle" font-family="Inter" font-weight="700" font-size="11.5" fill="#fff">C</text></svg>`);
}
function hush(parent, kind, { w = 180, h = 390, x = 0, y = 0, r = 22 } = {}) {
  const k = w / 180;
  const s = el(parent, 'abs', { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', borderRadius: r + 'px', overflow: 'hidden', background: HUSH.bg });
  s.parts = {};
  const B = (css, html = '') => el(s, 'abs', Object.fromEntries(Object.entries(css).map(([p, v]) => [p, typeof v === 'number' && !['opacity', 'zIndex'].includes(p) ? v * k + 'px' : v])), html);
  const T = (str, l, t, size, wgt = 500, col = HUSH.fg, extra = {}) => B({ left: l, top: t, font: `${wgt} ${size * k}px/1.15 Inter`, color: col, letterSpacing: '-0.02em', whiteSpace: 'nowrap', ...extra }, str);
  // header: logo + app name, two round buttons
  hushLogo(s, { x: 12 * k, y: 16 * k, d: 14 * k }); T('Cue', 31, 17, 11.5, 600);
  B({ left: 136, top: 15, width: 16, height: 16, borderRadius: 8, background: HUSH.surf2 }); B({ left: 156, top: 15, width: 16, height: 16, borderRadius: 8, background: HUSH.surf2 });
  const tabs = (active) => {
    B({ left: 0, top: h / k - 34, width: 180, height: 34, background: HUSH.surf });
    ['Today', 'Tasks', 'Plan', 'You'].forEach((lab, i) => {
      const cx = 22 + i * 45;
      B({ left: cx - 6, top: h / k - 29, width: 12, height: 10, borderRadius: 3, background: i === active ? HUSH.ac : HUSH.dim });
      T(lab, cx, h / k - 15, 5.4, 500, i === active ? HUSH.fg : HUSH.dim, { transform: 'translateX(-50%)' });
    });
  };
  if (kind === 'home') {
    T('Today', 12, 44, 21, 700);
    const hero = cover(s, 3, { x: 12 * k, y: 76 * k, w: 156 * k, h: 168 * k, r: 14 * k }); s.parts.hero = hero;
    B({ left: 12, top: 76, width: 156, height: 168, borderRadius: 14, background: 'linear-gradient(180deg, rgba(23,18,31,0) 45%, rgba(23,18,31,.85) 100%)' });
    T('Saturday Dinner', 22, 206, 11, 700); T('Lune · 7 pm · 6 people', 22, 222, 6.5, 400, HUSH.ac2);
    const play = B({ left: 142, top: 214, width: 20, height: 20, borderRadius: 10, background: HUSH.ac }, `<svg viewBox="0 0 20 20" width="100%" height="100%"><path d="M8 6.5 L14 10 L8 13.5Z" fill="#fff"/></svg>`); s.parts.play = play;
    T('Waiting on you', 12, 258, 7.5, 600);
    for (let i = 0; i < 2; i++) { cover(s, 20 + i, { x: (12 + i * 80) * k, y: 272 * k, w: 76 * k, h: 50 * k, r: 9 * k }); B({ left: 12 + i * 80, top: 326, width: 60, height: 3, borderRadius: 2, background: HUSH.surf2 }); B({ left: 12 + i * 80, top: 326, width: 22 + i * 18, height: 3, borderRadius: 2, background: HUSH.ac }); }
    tabs(0);
  } else if (kind === 'library') {
    T('Tasks', 12, 44, 21, 700);
    B({ left: 12, top: 74, width: 156, height: 18, borderRadius: 9, background: HUSH.surf }); T('Find a task', 26, 79, 6.5, 400, HUSH.dim);
    const chips = ['All', 'Waiting', 'Done'].map((c, i) => { const b = B({ left: 12 + i * 46, top: 100, width: 42, height: 14, borderRadius: 7, background: i === 0 ? HUSH.ac : HUSH.surf2 }); T(c, 33 + i * 46, 103.5, 5.6, 600, HUSH.fg, { transform: 'translateX(-50%)' }); return b; });
    s.parts.chips = chips;
    for (let i = 0; i < 4; i++) { const yy = 124 + i * 52; cover(s, 30 + i, { x: 12 * k, y: yy * k, w: 44 * k, h: 44 * k, r: 8 * k }); T(['Book the table', 'Order the cake', 'Send the invites', 'Book rides home'][i], 64, yy + 6, 8, 600); T(['Held till 6 pm', 'Pickup 5:30 pm', '6 of 6 sent', 'Booked for 10 pm'][i], 64, yy + 20, 6, 400, HUSH.mu); B({ left: 64, top: yy + 33, width: 96, height: 3, borderRadius: 2, background: HUSH.surf2 }); B({ left: 64, top: yy + 33, width: 20 + i * 18, height: 3, borderRadius: 2, background: HUSH.ac }); }
    tabs(1);
  } else if (kind === 'player') {
    cover(s, 3, { x: 22 * k, y: 48 * k, w: 136 * k, h: 136 * k, r: 16 * k });
    T('Saturday Dinner', 22, 196, 12, 700); T('Deposit · $60 · Lune', 22, 213, 7, 500, HUSH.ac2);
    B({ left: 22, top: 234, width: 136, height: 4, borderRadius: 2, background: HUSH.surf2 });
    s.parts.prog = B({ left: 22, top: 234, width: 58, height: 4, borderRadius: 2, background: HUSH.ac });
    [0, 1, 2, 3, 4].forEach(i => B({ left: 22 + i * 30, top: 232, width: 2, height: 8, background: HUSH.fg, opacity: 0.6 }));
    T('Step 3', 22, 244, 5.5, 400, HUSH.mu); T('of 4', 158, 244, 5.5, 400, HUSH.mu, { transform: 'translateX(-100%)' });
    B({ left: 72, top: 262, width: 36, height: 36, borderRadius: 18, background: HUSH.fg }, `<svg viewBox="0 0 36 36" width="100%" height="100%"><rect x="13" y="11" width="3.6" height="14" rx="1.4" fill="${HUSH.bg}"/><rect x="19.4" y="11" width="3.6" height="14" rx="1.4" fill="${HUSH.bg}"/></svg>`);
    T('Recap', 32, 276, 6.5, 600, HUSH.mu); T('Sleep', 148, 276, 6.5, 600, HUSH.mu, { transform: 'translateX(-100%)' });
    tabs(2);
  } else if (kind === 'chapters') {
    T('Plan', 12, 44, 21, 700); T('Saturday · 6 people', 12, 70, 6.8, 500, HUSH.mu);
    const names = ['Pick a place', 'Hold the table', 'Order the cake', 'Send invites', 'Book rides', 'Approve'];
    s.parts.rows = names.map((nm, i) => {
      const yy = 88 + i * 38, on = i === 2;
      const row = B({ left: 12, top: yy, width: 156, height: 32, borderRadius: 9, background: on ? HUSH.surf2 : 'transparent' });
      T(String(i + 1).padStart(2, '0'), 22, yy + 11, 7, 600, on ? HUSH.ac : HUSH.dim); T(nm, 42, yy + 11, 8, 600, HUSH.fg); T(['Done', 'Done', '6 pm', 'Sent', '10 pm', 'Now'][i], 160, yy + 11.5, 6, 400, HUSH.mu, { transform: 'translateX(-100%)' });
      return row;
    });
    tabs(2);
  }
  return s;
}
// a phone body around a screen: x,y = top-left of the body; screen w×h; bezel b
function phone(parent, { x = 0, y = 0, w = 180, h = 390, b = 6, r = 28, body = '#0C0A10' } = {}) {
  const p = el(parent, 'abs', { left: x + 'px', top: y + 'px', width: (w + 2 * b) + 'px', height: (h + 2 * b) + 'px', borderRadius: r + 'px', background: body,
    boxShadow: '0 18px 50px rgba(20,14,30,.28), inset 0 0 0 1px rgba(255,255,255,.08)' });
  p.screen = el(p, 'abs', { left: b + 'px', top: b + 'px', width: w + 'px', height: h + 'px', borderRadius: (r - b) + 'px', overflow: 'hidden' });
  return p;
}
Object.assign(window, { HUSH, hush, hushLogo, phone });
