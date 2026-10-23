'use strict';
// W2 — the plates and the listener carousel. Motion = measured on the reference (motion/w2.js, notes/w2.md).
// Every picture and word is ours: the plates are original illustrations drawn here in SVG; copy comes from story.js.
//   w2-plate1    n95–263    a card rushes out of W1's corridor and grows to full bleed (n95–111); the camera keeps pushing into a sunny
//                            kitchen (speed bursts at n123/n126 = the "in-plate cut"), the prompt bar rises (n123–135), types the prompt in two
//                            bursts (n132–140, n170–178), sends with a press + sweep (n202–220), lifts and whips down off frame (n223–233); the
//                            camera eases back up off her hands while she reaches for her mug (n229–263)
//   w2-plate2    n1529–1628 a card rises from below under W6's phone whip (n1529–1540), grows to full bleed (n1541–1553), slow push on a
//                            listener on the bus, Critic's bubble rises in (n1590–1595) and drifts
//   w2-carousel  n1629–1697 a row of portrait cards (six illustrated listeners, each with Hush on a phone) flicks in from the right,
//                            decays to a 9.8 px/f drift, then drops off the bottom (n1679–1697)
(() => {
  const M = window.MW2 || {};
  const QA = /w2qa/.test(location.search);            // measurement renders: plates drawn flat dark so the bar/bubble edges read cleanly
  // footage-slot test renders (?w2foot): point the slots at test media in out/w2/footage_test (never set in a normal render)
  if (/w2foot/.test(location.search) && window.STORY && STORY.footage) {
    STORY.footage.plate1 = 'out/w2/footage_test/plate.png'; STORY.footage.plate2 = 'out/w2/footage_test/clip.mp4';
    STORY.footage.carousel = ['out/w2/footage_test/plate.png', 'out/w2/footage_test/clip.mp4', null, null, null, null];
  }
  const INK = '#16151B', INK3 = '#A29FA8', PAPER = '#F5F3EF';
  const SHADOW = '0 10px 30px rgba(22,21,27,.10), 0 0 0 1px rgba(22,21,27,.06)';
  const NS = 'http://www.w3.org/2000/svg';
  const f2 = v => (+v).toFixed(2);
  const building = (S, fn) => { S.root.style.display = 'block'; try { fn(); } finally { S.root.style.display = 'none'; } };

  // ───────────── kit ─────────────
  // an inline SVG of w×h user units, laid out at (x, y) in its parent
  function svgBox(parent, w, h, inner, { x = 0, y = 0 } = {}) {
    const box = el(parent, 'abs', { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    box.innerHTML = `<svg xmlns="${NS}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="display:block;overflow:visible">${inner}</svg>`;
    box.svg = box.firstChild;
    return box;
  }
  // lib/art.js gives every cover gradient a seed-derived id, so two scenes drawing the same cover share an id; a url(#id) that resolves
  // into a display:none scene paints nothing. Rename every id inside this scene (and its url() references) to a scene-unique one.
  let uq = 0;
  function uniquify(root, tag) {
    root.querySelectorAll('svg').forEach(svg => {
      const map = {};
      svg.querySelectorAll('[id]').forEach(e => { const nu = `${tag}${uq++}_${e.id}`; map[e.id] = nu; e.id = nu; });
      if (!Object.keys(map).length) return;
      svg.querySelectorAll('*').forEach(e => {
        for (const at of ['fill', 'stroke', 'clip-path', 'mask', 'filter', 'href']) {
          const v = e.getAttribute(at);
          if (v && v.includes('#')) e.setAttribute(at, v.replace(/url\(#([^)]+)\)/g, (m, id) => map[id] ? `url(#${map[id]})` : m).replace(/^#(.+)$/, (m, id) => map[id] ? '#' + map[id] : m));
        }
      });
    });
  }
  // a footage slot from an explicit path (image or video), cover-fit into w×h; same seek contract as core's footagePlate()
  function mediaSlot(parent, src, w, h) {
    if (!src) return null;
    const isVid = /\.(mp4|mov|webm|m4v)$/i.test(src);
    const node = document.createElement(isVid ? 'video' : 'img');
    Object.assign(node.style, { position: 'absolute', left: 0, top: 0, width: w + 'px', height: h + 'px', objectFit: 'cover' });
    node.src = src; if (isVid) { node.muted = true; node.preload = 'auto'; }
    parent.appendChild(node);
    node._isVid = isVid;
    node._seekTo = t => new Promise(res => {
      if (!isVid) return res();
      const target = Math.max(0, Math.min(t, (node.duration || 1e9) - 0.001));
      if (Math.abs(node.currentTime - target) < 1e-4 && node.readyState >= 2) return res();
      node.addEventListener('seeked', () => res(), { once: true }); node.currentTime = target;
    });
    return node;
  }
  // an <img> slot must be decoded before the capture, or the first frames catch it half-drawn
  const decoded = img => img && img.tagName === 'IMG' ? (img._dec || (img._dec = (img.decode ? img.decode() : Promise.resolve()).catch(() => {}))) : null;
  // camera on a picture layer: x_frame = s·x + t (origin 0 0) — the tracker's own model
  const setCam = (node, s, tx, ty) => { node.style.transform = `matrix(${s.toFixed(5)},0,0,${s.toFixed(5)},${f2(tx)},${f2(ty)})`; };
  // a flat limb: shoulder → elbow → wrist as one round-capped stroke (the sleeve), optional stripes across it (a dashed stroke on
  // the same path), a plain cuff at the wrist, an optional watch, and a hand (palm, four fingers, thumb) turned along the forearm
  function limb(g, { sleeve, stripe = null, cuff, skin, skin2, w = 30, hand = 18, watch = false }) {
    const h = hand;
    const fingers = [-0.4, -0.13, 0.14, 0.4].map((y, i) => `<rect class="f${i}" x="${h * 0.95}" y="${h * (y - 0.12)}" width="${h * (0.86 - Math.abs(y) * 0.25)}" height="${h * 0.25}" rx="${h * 0.125}" fill="${skin}" stroke="${skin2}" stroke-width="0.8"/>`).join('');
    g.insertAdjacentHTML('beforeend', `<path class="sl" fill="none" stroke="${sleeve}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>` +
      (stripe ? `<path class="st" fill="none" stroke="${stripe}" stroke-width="${w}" stroke-dasharray="5.5 7.5" stroke-linejoin="round"/>` : '') +
      `<path class="cf" fill="none" stroke="${cuff}" stroke-width="${w * 0.98}" stroke-linecap="butt"/>` +
      (watch ? `<path class="wb" fill="none" stroke="#2E2B33" stroke-width="${w * 0.84}" stroke-linecap="butt"/><circle class="wf" r="${w * 0.2}" fill="#F7F3EA" stroke="#C9A35A" stroke-width="1.2"/>` : '') +
      `<g class="hd"><rect x="${-h * 0.15}" y="${-h * 0.56}" width="${h * 1.3}" height="${h * 1.12}" rx="${h * 0.48}" fill="${skin}"/>${fingers}` +
      `<rect x="${h * 0.3}" y="${-h * 0.86}" width="${h * 0.72}" height="${h * 0.3}" rx="${h * 0.15}" fill="${skin}" stroke="${skin2}" stroke-width="0.8" transform="rotate(-24 ${h * 0.3} ${-h * 0.7})"/>` +
      `<path d="M${h * 0.92} ${-h * 0.42} q${h * 0.06} ${h * 0.42} 0 ${h * 0.84}" fill="none" stroke="${skin2}" stroke-width="1" opacity=".6"/></g>`);
    const sP = g.querySelector('.sl'), tP = g.querySelector('.st'), cP = g.querySelector('.cf'), hG = g.querySelector('.hd');
    const wB = g.querySelector('.wb'), wF = g.querySelector('.wf'), f0 = hG.querySelector('.f0');
    return {
      set([sx, sy], [ex, ey], [wx, wy], ang = null, finger = 0) {
        const d = `M${f2(sx)} ${f2(sy)} L${f2(ex)} ${f2(ey)} L${f2(wx)} ${f2(wy)}`;
        sP.setAttribute('d', d); if (tP) tP.setAttribute('d', d);
        const dx = wx - ex, dy = wy - ey, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
        cP.setAttribute('d', `M${f2(wx - ux * w * 0.5)} ${f2(wy - uy * w * 0.5)} L${f2(wx - ux * 0.5)} ${f2(wy - uy * 0.5)}`);
        if (wB) {
          wB.setAttribute('d', `M${f2(wx - ux * w * 0.86)} ${f2(wy - uy * w * 0.86)} L${f2(wx - ux * w * 0.6)} ${f2(wy - uy * w * 0.6)}`);
          wF.setAttribute('cx', f2(wx - ux * w * 0.73 - uy * w * 0.2)); wF.setAttribute('cy', f2(wy - uy * w * 0.73 + ux * w * 0.2));
        }
        const a = ang == null ? Math.atan2(dy, dx) * 180 / Math.PI : ang;
        hG.setAttribute('transform', `translate(${f2(wx)} ${f2(wy)}) rotate(${f2(a)})`);
        f0.setAttribute('transform', `rotate(${f2(finger)} ${h * 0.95} ${-h * 0.4})`);
      },
    };
  }

  // ───────────── plate 1: a sunny morning kitchen (key = the full-bleed view at n112, 1080×608) ─────────────
  function plate1SVG() {
    const stripes = Array.from({ length: 14 }, (_, r) => `<rect x="560" y="${293 + r * 13}" width="180" height="5.5"/>`).join('');
    // the laptop deck: axes u (from her side toward the hinge) and v (along the hinge)
    const D0 = [640, 380], DU = [168, -12], DV = [22, 24];
    const P = (u, v) => [+(D0[0] + DU[0] * u + DV[0] * v).toFixed(1), +(D0[1] + DU[1] * u + DV[1] * v).toFixed(1)];
    const up = (p, dx, dy) => [p[0] + dx, p[1] + dy];
    const keys = [];
    for (let i = 0; i < 11; i++) for (let j = 0; j < 4; j++) {
      const u0 = 0.2 + i * 0.062, v0 = 0.12 + j * 0.19, du = 0.05, dv = 0.15;
      keys.push(`<path d="M${P(u0, v0)} L${P(u0 + du, v0)} L${P(u0 + du, v0 + dv)} L${P(u0, v0 + dv)}Z"/>`);
    }
    return `
<defs>
  <linearGradient id="k1sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A7D2EC"/><stop offset=".55" stop-color="#D3E7EE"/><stop offset="1" stop-color="#FDE3B6"/></linearGradient>
  <linearGradient id="k1wall" x1="0" y1="0" x2="1" y2="0.4"><stop offset="0" stop-color="#F3DDBC"/><stop offset=".6" stop-color="#EDD3AE"/><stop offset="1" stop-color="#E4C59C"/></linearGradient>
  <linearGradient id="k1table" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E2A86C"/><stop offset="1" stop-color="#C9844C"/></linearGradient>
  <linearGradient id="k1beam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF6DD" stop-opacity=".75"/><stop offset="1" stop-color="#FFF6DD" stop-opacity="0"/></linearGradient>
  <radialGradient id="k1sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF4C9"/><stop offset=".45" stop-color="#FFE7A1" stop-opacity=".9"/><stop offset="1" stop-color="#FFE7A1" stop-opacity="0"/></radialGradient>
  <radialGradient id="k1glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE9B8" stop-opacity=".8"/><stop offset="1" stop-color="#FFE9B8" stop-opacity="0"/></radialGradient>
  <linearGradient id="k1screen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EEF3FF"/><stop offset="1" stop-color="#C9D7FF"/></linearGradient>
  <linearGradient id="k1mugg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F08467"/><stop offset=".6" stop-color="#E06A4E"/><stop offset="1" stop-color="#C9563D"/></linearGradient>
  <linearGradient id="k1sweater" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FBF4E8"/><stop offset="1" stop-color="#EFE3CF"/></linearGradient>
  <clipPath id="k1torsoClip"><path d="M588 312 C590 292 612 282 638 280 L672 280 C700 283 714 296 716 318 L726 470 L578 470Z"/></clipPath>
</defs>
<rect x="-240" y="-240" width="1560" height="720" fill="url(#k1wall)"/>
<!-- back counter (right): tiles, cabinets, kettle, fruit, open shelf -->
<g>
  <rect x="842" y="196" width="480" height="114" fill="#F8EFE1"/>
  <path d="M842 220H1322M842 244H1322M842 268H1322M842 292H1322" stroke="#EADBC4" stroke-width="1.4"/>
  <path d="M868 196V310M894 196V310M920 196V310M946 196V310M972 196V310M998 196V310M1024 196V310M1050 196V310M1076 196V310M1102 196V310M1128 196V310M1154 196V310M1180 196V310M1206 196V310M1232 196V310M1258 196V310M1284 196V310M1310 196V310" stroke="#EADBC4" stroke-width="1.4"/>
  <rect x="836" y="306" width="490" height="12" rx="3" fill="#EBDCC3"/>
  <rect x="842" y="318" width="480" height="150" fill="#93B4A0"/>
  <path d="M928 318V468M1014 318V468M1100 318V468M1186 318V468" stroke="#7FA28C" stroke-width="3"/>
  <rect x="902" y="352" width="4" height="34" rx="2" fill="#F3E6CF"/><rect x="938" y="352" width="4" height="34" rx="2" fill="#F3E6CF"/><rect x="988" y="352" width="4" height="34" rx="2" fill="#F3E6CF"/><rect x="1024" y="352" width="4" height="34" rx="2" fill="#F3E6CF"/>
  <path d="M948 306 C948 270 962 258 984 258 C1006 258 1020 270 1020 306Z" fill="#E9735A"/><rect x="972" y="248" width="24" height="10" rx="4" fill="#3A3540"/>
  <path d="M1020 274 q20 4 18 24" fill="none" stroke="#3A3540" stroke-width="5" stroke-linecap="round"/><path d="M956 288 q28 -6 56 0" fill="none" stroke="#FFFFFF" stroke-width="3" opacity=".5"/>
  <ellipse cx="884" cy="300" rx="26" ry="8" fill="#F4E9D6"/><circle cx="874" cy="290" r="10" fill="#F2B544"/><circle cx="892" cy="288" r="9" fill="#E9735A"/><circle cx="884" cy="282" r="8" fill="#8DBB6F"/>
  <rect x="872" y="136" width="210" height="10" rx="2" fill="#C98A55"/>
  <rect x="886" y="104" width="22" height="32" rx="4" fill="#EBDDC6"/><rect x="884" y="100" width="26" height="8" rx="3" fill="#B97A4A"/>
  <rect x="918" y="112" width="18" height="24" rx="4" fill="#EBDDC6"/><rect x="916" y="108" width="22" height="7" rx="3" fill="#B97A4A"/>
  <ellipse cx="972" cy="132" rx="22" ry="5" fill="#F7F1E6"/><ellipse cx="972" cy="126" rx="20" ry="5" fill="#7FA8D0"/><ellipse cx="972" cy="120" rx="18" ry="5" fill="#F7F1E6"/>
  <path d="M1030 136 q-6 -30 6 -44 q8 18 4 44Z" fill="#5E9E6E"/><path d="M1040 136 q10 -26 26 -30 q-6 22 -18 30Z" fill="#478A5B"/><rect x="1024" y="122" width="34" height="16" rx="4" fill="#DE7A52"/>
</g>
<g transform="translate(790 120)"><circle r="27" fill="#FFFFFF"/><circle r="27" fill="none" stroke="#E2CDAE" stroke-width="3"/><path d="M0 0V-16M0 0L11 6" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><circle r="2.4" fill="#E9735A"/></g>
<!-- window: sunrise over the rooftops -->
<g>
  <rect x="38" y="30" width="336" height="308" rx="6" fill="#FFFFFF"/>
  <rect x="52" y="44" width="308" height="280" fill="url(#k1sky)"/>
  <circle cx="128" cy="268" r="70" fill="url(#k1sun)"/><circle cx="128" cy="268" r="24" fill="#FFF3C4"/>
  <path d="M52 262 L84 262 L84 246 L118 246 L118 270 L150 270 L150 236 L176 222 L202 236 L202 260 L236 260 L236 240 L268 240 L268 256 L300 256 L300 230 L330 230 L330 252 L360 252 L360 324 L52 324Z" fill="#EBC9A2"/>
  <path d="M52 286 L96 286 L96 274 L140 274 L140 292 L190 292 L190 280 L240 280 L240 296 L300 296 L300 284 L360 284 L360 324 L52 324Z" fill="#DDAF85"/>
  <circle cx="320" cy="262" r="26" fill="#9CC48F"/><circle cx="342" cy="276" r="20" fill="#86B47A"/><rect x="326" y="280" width="5" height="40" fill="#9B7350"/>
  <path d="M232 92 q6 -5 12 0 q6 -5 12 0" fill="none" stroke="#7F98A8" stroke-width="2" stroke-linecap="round"/><path d="M270 112 q5 -4 10 0 q5 -4 10 0" fill="none" stroke="#7F98A8" stroke-width="1.8" stroke-linecap="round"/>
  <rect x="200" y="44" width="10" height="280" fill="#FFFFFF"/><rect x="52" y="178" width="308" height="9" fill="#FFFFFF"/>
  <rect x="26" y="332" width="360" height="16" rx="3" fill="#FFFFFF"/><rect x="30" y="348" width="352" height="6" fill="#E6D2B4"/>
  <path d="M302 330 L346 330 L340 294 L308 294Z" fill="#DE7A52"/>
  <path d="M324 296 q-26 -26 -20 -54 q22 18 20 54Z" fill="#5E9E6E"/><path d="M324 296 q14 -36 40 -40 q-8 30 -40 40Z" fill="#478A5B"/><path d="M324 296 q-6 -40 10 -62 q12 26 -10 62Z" fill="#6DAE7B"/>
  <rect x="70" y="306" width="22" height="26" rx="4" fill="#F2B544"/><rect x="96" y="314" width="16" height="18" rx="3" fill="#FFFFFF" stroke="#E6D2B4" stroke-width="2"/>
</g>
<!-- shelf, jars, pendant lamp -->
<g>
  <rect x="404" y="124" width="196" height="10" rx="2" fill="#C98A55"/>
  <rect x="418" y="86" width="28" height="38" rx="5" fill="#EBDDC6"/><rect x="416" y="80" width="32" height="9" rx="3" fill="#B97A4A"/><rect x="424" y="100" width="16" height="16" rx="2" fill="#F7F0E2"/>
  <rect x="456" y="96" width="22" height="28" rx="5" fill="#EBDDC6"/><rect x="454" y="91" width="26" height="8" rx="3" fill="#B97A4A"/>
  <path d="M492 124 q0 -26 20 -26 q20 0 20 26Z" fill="#5FA58A"/><path d="M500 106 q12 -8 24 0" fill="none" stroke="#F7F0E2" stroke-width="2"/>
  <rect x="544" y="102" width="40" height="22" rx="4" fill="#F7F0E2"/><rect x="544" y="98" width="40" height="6" rx="2" fill="#E9735A"/>
  <path d="M590 134 q8 30 -2 58" fill="none" stroke="#5E9E6E" stroke-width="2.4"/><ellipse cx="584" cy="160" rx="7" ry="4" fill="#5E9E6E" transform="rotate(-30 584 160)"/><ellipse cx="594" cy="178" rx="7" ry="4" fill="#478A5B" transform="rotate(30 594 178)"/>
  <path d="M478 -240 V52" stroke="#3A3540" stroke-width="2.4"/>
  <ellipse cx="478" cy="96" rx="64" ry="34" fill="url(#k1glow)"/>
  <path d="M446 84 C446 62 460 52 478 52 C496 52 510 62 510 84Z" fill="#2E2B33"/><ellipse cx="478" cy="84" rx="32" ry="5" fill="#FFE2A8"/>
</g>
<path d="M374 40 L560 40 L860 470 L560 470Z" fill="url(#k1beam)" opacity=".55"/>
<path d="M374 190 L470 190 L700 470 L560 470Z" fill="url(#k1beam)" opacity=".4"/>
<!-- chair -->
<g transform="translate(-22 6)">
<path d="M560 300 C560 286 570 278 584 278 L716 278 C730 278 738 288 738 302 L738 470 L560 470Z" fill="#B57A47"/>
<path d="M572 300 C572 292 578 288 586 288 L712 288 C720 288 726 292 726 300 L726 470 L572 470Z" fill="#C98D58"/>
</g>
<!-- her: striped top, neckline, neck, head, hair bun -->
<g transform="translate(-22 6)">
  <path d="M588 312 C590 292 612 282 638 280 L672 280 C700 283 714 296 716 318 L726 470 L578 470Z" fill="url(#k1sweater)"/>
  <g fill="#2F3F6B" clip-path="url(#k1torsoClip)">${stripes}</g>
  <path d="M600 330 C606 360 604 400 598 440" fill="none" stroke="#D9CBB4" stroke-width="2" opacity=".6"/>
  <path d="M626 283 C634 298 670 300 680 283" fill="none" stroke="#2F3F6B" stroke-width="3"/>
  <path d="M642 250 L668 250 L670 284 C662 292 648 292 640 284Z" fill="#B97A55"/>
  <ellipse cx="654" cy="220" rx="31" ry="38" fill="#C68863"/>
  <path d="M672 192 q16 10 14 32 q-2 18 -12 30 q10 -18 6 -40Z" fill="#D49A75" opacity=".6"/>
  <ellipse cx="628" cy="228" rx="6.5" ry="10" fill="#B97A55"/><circle cx="629" cy="241" r="3.2" fill="#F2C14E"/>
  <path d="M686 226 q5 4 1 9 q-3 2 -6 1" fill="none" stroke="#9A5E40" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="664" cy="219" rx="3.6" ry="4.4" fill="#2B1F1C"/><path d="M658 215 q6 -4 12 0" fill="none" stroke="#2B1F1C" stroke-width="2.2" stroke-linecap="round"/>
  <ellipse cx="681" cy="218" rx="2.6" ry="4" fill="#2B1F1C"/><path d="M677 214.5 q4 -3 8 0" fill="none" stroke="#2B1F1C" stroke-width="2" stroke-linecap="round"/>
  <path d="M657 206 q8 -5 15 -2 M676 205 q5 -3 10 0" fill="none" stroke="#2B1F1C" stroke-width="2.6" stroke-linecap="round"/>
  <ellipse cx="664" cy="234" rx="9" ry="5" fill="#E2846E" opacity=".45"/>
  <path d="M666 247 q7 3 13 -1" fill="none" stroke="#8F3E33" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M622 214 C618 184 640 170 662 174 C680 177 690 188 688 204 C676 192 660 190 646 196 C640 204 636 214 636 226 C630 222 626 220 622 214Z" fill="#2B1F1C"/>
  <circle cx="618" cy="186" r="19" fill="#2B1F1C"/><path d="M606 178 q10 -8 22 -2 M604 190 q12 -6 26 0" fill="none" stroke="#45322C" stroke-width="2"/>
  <path d="M640 182 q20 -6 40 8" fill="none" stroke="#45322C" stroke-width="2"/>
</g>
<!-- table -->
<path d="M-240 400.1 L1320 383.9 L1320 840 L-240 840Z" fill="url(#k1table)"/>
<path d="M-240 400.1 L1320 383.9 L1320 391.9 L-240 408.1Z" fill="#EDB97F" opacity=".7"/>
<g fill="none" stroke="#B9783F" stroke-width="1.6" opacity=".35" stroke-linecap="round">
  <path d="M-220 444 C0 436 200 432 420 444 S760 430 1080 432 S1240 430 1300 431"/><path d="M-220 486 C0 478 200 474 420 486 S760 472 1080 474 S1240 472 1300 473"/><path d="M-220 532 C20 524 240 520 460 532 S800 516 1080 520 S1240 518 1300 519"/><path d="M-220 582 C0 574 220 570 500 584 S860 566 1080 568 S1240 566 1300 567"/><path d="M-220 640 C40 632 300 646 560 636 S900 626 1300 630"/><path d="M-220 700 C60 690 360 704 640 694 S960 688 1300 690"/>
  <path d="M120 500 C220 496 300 504 380 498"/><path d="M780 546 C860 542 940 548 1040 542"/><path d="M420 600 C520 594 600 602 680 596"/>
</g>
<path d="M420 404 L660 398 L880 840 L560 840Z" fill="#FFF3D6" opacity=".22"/>
<!-- plate of toast, notebook, flowers -->
<g>
  <ellipse cx="470" cy="508" rx="78" ry="24" fill="#B9783F" opacity=".25"/>
  <ellipse cx="468" cy="502" rx="76" ry="23" fill="#FFFFFF"/><ellipse cx="468" cy="502" rx="58" ry="16" fill="#F4EEE4"/>
  <path d="M424 498 L452 484 L486 490 L462 506Z" fill="#C98742"/><path d="M428 496 L452 486 L482 491 L460 503Z" fill="#E7B06A"/><path d="M446 492 l10 -3 l9 2 l-9 4Z" fill="#FFF0A6"/>
  <path d="M466 500 L500 490 L520 498 L486 512Z" fill="#C98742"/><path d="M470 499 L500 492 L516 498 L487 509Z" fill="#E7B06A"/>
  <path d="M884 470 L1040 462 L1052 500 L892 510Z" fill="#FFFFFF"/><path d="M896 478 L1030 471 M898 486 L1034 479 M900 494 L1000 489" stroke="#E3DACB" stroke-width="2"/>
  <path d="M960 466 L976 466 L974 440 L962 440Z" fill="#DCE9F2" opacity=".9"/>
  <path d="M968 440 q-4 -20 -14 -30 M968 440 q2 -24 12 -34 M968 440 q-1 -18 0 -36" fill="none" stroke="#5E9E6E" stroke-width="2"/>
  <circle cx="954" cy="408" r="7" fill="#FF7A1F"/><circle cx="980" cy="404" r="7" fill="#F2B544"/><circle cx="968" cy="398" r="6" fill="#E9735A"/>
</g>
<!-- laptop: deck (keys, trackpad) and the lid at the hinge, its screen facing her -->
<g>
  <path d="M${P(0, 1)} L${P(1, 1)} L${up(P(1, 1), 0, 6)} L${up(P(0, 1), 0, 6)}Z" fill="#A9B0BA"/>
  <path d="M${P(0, 0)} L${P(1, 0)} L${P(1, 1)} L${P(0, 1)}Z" fill="#D7DCE3"/>
  <g fill="#BCC3CC">${keys.join('')}</g>
  <path d="M${P(0.04, 0.3)} L${P(0.16, 0.3)} L${P(0.16, 0.85)} L${P(0.04, 0.85)}Z" fill="#C8CED6"/>
  <path d="M${P(1, 0)} L${P(1, 1)} L${up(P(1.04, 0.96), 24, -112)} L${up(P(1.04, 0), 24, -112)}Z" fill="#C3C9D1"/>
  <path d="M${P(0.985, 0.06)} L${P(0.985, 0.94)} L${up(P(1.02, 0.9), 22, -106)} L${up(P(1.02, 0.06), 22, -106)}Z" fill="url(#k1screen)"/>
</g>
<ellipse cx="740" cy="300" rx="70" ry="56" fill="#DCE6FF" opacity=".16"/>
`;
  }

  // ───────────── plate 2: a listener on the city bus, by the window ─────────────
  function plate2SVG() {
    const fab = Array.from({ length: 17 }, (_, r) => Array.from({ length: 13 }, (_, c) =>
      `<circle cx="${466 + c * 26 + (r % 2) * 13}" cy="${222 + r * 26}" r="2.4"/>`).join('')).join('');
    const fab2 = Array.from({ length: 6 }, (_, r) => Array.from({ length: 18 }, (_, c) =>
      `<circle cx="${-40 + c * 26 + (r % 2) * 13}" cy="${528 + r * 24}" r="2.4"/>`).join('')).join('');
    const bld = [[40, 170, 70, '#EAC1A8'], [112, 130, 64, '#D8CAB0'], [178, 196, 58, '#A9C3D0'], [262, 150, 76, '#F2DDBA'], [340, 120, 60, '#E4B7A4'], [402, 182, 66, '#C9D6C3']]
      .map(([x, y, w, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${380 - y}" fill="${c}"/>` +
        Array.from({ length: Math.floor((340 - y) / 26) }, (_, r) => Array.from({ length: Math.floor((w - 12) / 18) }, (_, k) =>
          `<rect x="${x + 9 + k * 18}" y="${y + 12 + r * 26}" width="9" height="13" rx="1.5" fill="#FFFFFF" opacity=".55"/>`).join('')).join('')).join('');
    const curls = Array.from({ length: 15 }, (_, i) => { const a = Math.PI * (0.98 + i * 0.075), r = 42 + (i % 3) * 3; return `<circle cx="${(598 + Math.cos(a) * r).toFixed(1)}" cy="${(206 + Math.sin(a) * r * 0.9).toFixed(1)}" r="${12 + (i % 2) * 3}"/>`; }).join('');
    return `
<defs>
  <linearGradient id="b2sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ED0EE"/><stop offset=".7" stop-color="#DCEDF2"/><stop offset="1" stop-color="#FBE5C2"/></linearGradient>
  <linearGradient id="b2wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EDE8DE"/><stop offset="1" stop-color="#DCD5C8"/></linearGradient>
  <linearGradient id="b2seat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3550A8"/><stop offset="1" stop-color="#28408C"/></linearGradient>
  <linearGradient id="b2jacket" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7FB096"/><stop offset="1" stop-color="#5F937A"/></linearGradient>
  <linearGradient id="b2glare" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset=".5" stop-color="#FFFFFF" stop-opacity=".55"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
  <radialGradient id="b2sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF6D2"/><stop offset="1" stop-color="#FFF6D2" stop-opacity="0"/></radialGradient>
  <clipPath id="b2win"><rect x="30" y="60" width="448" height="328" rx="18"/></clipPath>
</defs>
<rect x="-40" y="-40" width="1160" height="700" fill="url(#b2wall)"/>
<rect x="-40" y="-40" width="1160" height="84" fill="#343A55"/><rect x="110" y="4" width="440" height="9" rx="4.5" fill="#FFF3D2"/><rect x="690" y="4" width="340" height="9" rx="4.5" fill="#FFF3D2"/>
<g opacity=".9"><rect x="-10" y="20" width="150" height="22" rx="4" fill="#FF7A1F"/><rect x="152" y="20" width="190" height="22" rx="4" fill="#8B5CF6"/><rect x="354" y="20" width="150" height="22" rx="4" fill="#19B47E"/>
<rect x="516" y="20" width="210" height="22" rx="4" fill="#F2B544"/><rect x="738" y="20" width="160" height="22" rx="4" fill="#2E6BFF"/><rect x="910" y="20" width="200" height="22" rx="4" fill="#E9735A"/></g>
<path d="M-40 44 H1120" stroke="#2A2F47" stroke-width="4"/>
<g fill="none" stroke="#3A3540" stroke-width="5" stroke-linecap="round"><path d="M600 44 V58"/><path d="M760 44 V52"/><path d="M930 44 V60"/></g>
<g fill="none" stroke="#E9735A" stroke-width="7"><ellipse cx="600" cy="72" rx="13" ry="16"/><ellipse cx="760" cy="66" rx="13" ry="16"/><ellipse cx="930" cy="74" rx="13" ry="16"/></g>
<!-- window with the city -->
<rect x="18" y="48" width="472" height="352" rx="26" fill="#2A2830"/>
<rect x="30" y="60" width="448" height="328" rx="18" fill="url(#b2sky)"/>
<g clip-path="url(#b2win)">
  <circle cx="420" cy="120" r="90" fill="url(#b2sun)"/>
  ${bld}
  <circle cx="300" cy="352" r="34" fill="#8DBB7F"/><circle cx="334" cy="338" r="28" fill="#79AB6C"/><rect x="314" y="350" width="6" height="40" fill="#8E6C4C"/>
  <rect x="30" y="360" width="448" height="30" fill="#BFB7AA"/>
  <path d="M20 400 L180 60 L250 60 L90 400Z" fill="url(#b2glare)" opacity=".7"/><path d="M150 400 L310 60 L340 60 L180 400Z" fill="url(#b2glare)" opacity=".45"/>
</g>
<rect x="250" y="60" width="8" height="328" fill="#2A2830"/>
<rect x="18" y="396" width="472" height="18" rx="6" fill="#C9C1B3"/>
<rect x="902" y="56" width="220" height="330" rx="24" fill="#2A2830"/><rect x="914" y="68" width="210" height="306" rx="16" fill="url(#b2sky)"/>
<rect x="940" y="200" width="70" height="174" fill="#E4C7A8"/><rect x="1016" y="160" width="80" height="214" fill="#B9CBD4"/>
<path d="M930 374 L1000 70 L1030 70 L960 374Z" fill="url(#b2glare)" opacity=".6"/>
<!-- seat back behind her -->
<path d="M452 214 C452 190 470 176 494 176 L742 176 C766 176 780 190 780 214 L780 680 L452 680Z" fill="url(#b2seat)"/>
<g fill="#F2B544" opacity=".55">${fab}</g>
<rect x="452" y="176" width="328" height="34" rx="17" fill="#C9C1B3"/>
<!-- her: jacket, hood, tee, neck, head, curls, earbuds -->
<g>
  <path d="M480 680 L492 352 C496 318 520 300 552 296 L640 296 C676 300 700 320 704 356 L716 680Z" fill="url(#b2jacket)"/>
  <path d="M520 304 C536 286 560 280 598 280 C636 280 660 288 676 304 C652 300 628 300 598 300 C566 300 544 302 520 304Z" fill="#6B9C83"/>
  <path d="M572 296 L598 344 L624 296Z" fill="#FF8A6B"/>
  <path d="M498 380 C500 440 500 520 496 600" fill="none" stroke="#5A8A72" stroke-width="2.4" opacity=".6"/><path d="M698 380 C700 440 704 520 706 600" fill="none" stroke="#5A8A72" stroke-width="2.4" opacity=".6"/>
  <path d="M582 262 L614 262 L618 300 C608 310 590 310 580 300Z" fill="#7A4A31"/>
  <ellipse cx="598" cy="222" rx="38" ry="46" fill="#8D5A3C"/>
  <ellipse cx="582" cy="225" rx="3.8" ry="3.4" fill="#2A1A14"/><ellipse cx="614" cy="225" rx="3.8" ry="3.4" fill="#2A1A14"/>
  <path d="M575 221 q7 -3 14 0 M607 221 q7 -3 14 0" fill="none" stroke="#2A1A14" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M572 206 q9 -5 18 -1 M606 205 q9 -4 18 1" fill="none" stroke="#2A1A14" stroke-width="2.8" stroke-linecap="round"/>
  <path d="M598 224 q-3 12 2 16" fill="none" stroke="#6E4029" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M587 250 q11 8 22 0" fill="none" stroke="#5A2A20" stroke-width="2.6" stroke-linecap="round"/>
  <ellipse cx="578" cy="238" rx="8" ry="5" fill="#C86A55" opacity=".35"/><ellipse cx="620" cy="238" rx="8" ry="5" fill="#C86A55" opacity=".35"/>
  <g fill="#1F1714">${curls}<ellipse cx="598" cy="186" rx="40" ry="26"/></g>
  <ellipse cx="560" cy="230" rx="7" ry="11" fill="#7A4A31"/><ellipse cx="636" cy="230" rx="7" ry="11" fill="#7A4A31"/>
  <g fill="#FFFFFF"><ellipse cx="558" cy="232" rx="5.5" ry="6.5"/><rect x="555" y="234" width="5" height="16" rx="2.5"/><ellipse cx="638" cy="232" rx="5.5" ry="6.5"/><rect x="636" y="234" width="5" height="16" rx="2.5"/></g>
</g>
<!-- seat in front of her (foreground) + the yellow pole -->
<path d="M-60 520 C-60 500 -44 488 -20 488 L330 488 C354 488 370 500 370 520 L370 680 L-60 680Z" fill="url(#b2seat)"/>
<g fill="#F2B544" opacity=".5">${fab2}</g>
<rect x="-60" y="488" width="430" height="26" rx="13" fill="#C9C1B3"/>
<rect x="842" y="-40" width="26" height="720" rx="13" fill="#F2C230"/><rect x="848" y="-40" width="6" height="720" fill="#FFE07A" opacity=".8"/>
<rect x="836" y="236" width="38" height="30" rx="8" fill="#E04F3C"/><circle cx="855" cy="251" r="7" fill="#FFFFFF" opacity=".85"/>
`;
  }

  // ───────────── carousel listeners (portrait cards, 280×498, 304 apart) ─────────────
  const CW = 280, CH = 498, CTOP = 55, CPITCH = 304;
  const LISTENERS = [
    { bg: 'park', skin: '#C68863', hair: '#2B1F1C', style: 'curls', top: '#F2C230', top2: '#E0A91B', phone: 'home', tilt: -8, extra: 'headphones' },
    { bg: 'kitchen', skin: '#F0C3A2', hair: '#B5562F', style: 'braid', top: '#8B5CF6', top2: '#6B3EDF', phone: 'player', tilt: 6 },
    { bg: 'track', skin: '#8D5A3C', hair: '#1F1714', style: 'cap', top: '#FF7A1F', top2: '#E35F08', phone: 'chapters', tilt: -4, extra: 'buds' },
    { bg: 'bedroom', skin: '#E7B48F', hair: '#3A2A22', style: 'bob', top: '#9CC3E6', top2: '#7FA8D0', phone: 'library', tilt: 9 },
    { bg: 'platform', skin: '#B9784F', hair: '#2A1E1A', style: 'beanie', top: '#19B47E', top2: '#0E9566', phone: 'home', tilt: -7, extra: 'scarf' },
    { bg: 'cafe', skin: '#F3CDB0', hair: '#E2C27A', style: 'short', top: '#3D5A80', top2: '#2C4566', phone: 'player', tilt: 5, extra: 'glasses' },
  ];
  function bgSVG(kind, alt) {
    const W = CW, H = CH;
    if (kind === 'park') return `<rect width="${W}" height="${H}" fill="${alt ? '#CFE7F2' : '#BFE1F0'}"/><circle cx="220" cy="70" r="34" fill="#FFF2C2"/>
      <circle cx="40" cy="250" r="80" fill="#8DBB7F"/><circle cx="250" cy="230" r="90" fill="#79AB6C"/><circle cx="140" cy="270" r="70" fill="#9CC88E"/>
      <rect x="0" y="300" width="${W}" height="${H - 300}" fill="#A9D08E"/><path d="M0 330 Q140 310 280 336" fill="none" stroke="#93C07A" stroke-width="6"/>
      <rect x="30" y="360" width="220" height="12" rx="4" fill="#B57A47"/>`;
    if (kind === 'kitchen') return `<rect width="${W}" height="${H}" fill="${alt ? '#F1DDC4' : '#F5E3CC'}"/><rect x="0" y="300" width="${W}" height="${H - 300}" fill="#E7C9A3"/>
      <rect x="170" y="40" width="96" height="250" rx="10" fill="#E9EEF0"/><rect x="176" y="150" width="84" height="3" fill="#CCD5D9"/><rect x="250" y="70" width="4" height="60" rx="2" fill="#B9C3C8"/>
      <rect x="20" y="70" width="120" height="8" rx="2" fill="#C98A55"/><rect x="30" y="46" width="22" height="24" rx="4" fill="#E9735A"/><rect x="62" y="40" width="26" height="30" rx="4" fill="#F2B544"/><circle cx="110" cy="58" r="12" fill="#19B47E"/>
      <ellipse cx="80" cy="150" rx="40" ry="26" fill="#FFE2A8" opacity=".6"/><path d="M80 0 V120" stroke="#3A3540" stroke-width="2"/><path d="M58 120 q22 -24 44 0Z" fill="#2E2B33"/>`;
    if (kind === 'track') return `<rect width="${W}" height="${H}" fill="${alt ? '#D9ECF7' : '#CBE6F5'}"/><rect x="0" y="230" width="${W}" height="40" fill="#6FAE6A"/>
      <path d="M0 270 L${W} 250 L${W} ${H} L0 ${H}Z" fill="#D9684A"/><path d="M0 330 L${W} 300 M0 400 L${W} 360 M0 470 L${W} 420" stroke="#FFFFFF" stroke-width="4" opacity=".8"/>
      <rect x="20" y="120" width="8" height="110" fill="#9AA3AD"/><rect x="0" y="116" width="120" height="6" fill="#9AA3AD"/><circle cx="60" cy="60" r="26" fill="#FFF2C2"/>`;
    if (kind === 'bedroom') return `<rect width="${W}" height="${H}" fill="${alt ? '#3B3357' : '#2F2A4A'}"/><rect x="150" y="40" width="110" height="140" rx="6" fill="#1D2240"/><circle cx="220" cy="80" r="14" fill="#F6F0D8"/>
      <circle cx="180" cy="120" r="1.6" fill="#FFF"/><circle cx="240" cy="140" r="1.4" fill="#FFF"/><circle cx="196" cy="70" r="1.2" fill="#FFF"/>
      <path d="M0 40 Q70 70 140 40 T280 40" fill="none" stroke="#6E6080" stroke-width="1.5"/>${Array.from({ length: 9 }, (_, i) => `<circle cx="${10 + i * 32}" cy="${(46 + 14 * Math.sin(i * 1.3)).toFixed(1)}" r="4" fill="#FFD27A"/>`).join('')}
      <rect x="0" y="330" width="${W}" height="${H - 330}" fill="#E8DDF3"/><path d="M0 360 Q140 330 280 370 L280 498 L0 498Z" fill="#C9B6E8"/>`;
    if (kind === 'platform') return `<rect width="${W}" height="${H}" fill="${alt ? '#E4E8EA' : '#DDE3E6'}"/>${Array.from({ length: 8 }, (_, i) => `<path d="M${i * 40} 0 V300" stroke="#CBD3D8" stroke-width="2"/>`).join('')}
      <rect x="0" y="90" width="${W}" height="150" fill="#2E6BFF" opacity=".85"/>${Array.from({ length: 4 }, (_, i) => `<rect x="${14 + i * 68}" y="110" width="52" height="60" rx="6" fill="#BFD6FF"/>`).join('')}
      <rect x="0" y="236" width="${W}" height="10" fill="#F2C230"/><rect x="0" y="246" width="${W}" height="${H - 246}" fill="#B8BEC4"/>`;
    return `<rect width="${W}" height="${H}" fill="${alt ? '#F3E5D2' : '#F6E9D8'}"/><rect x="20" y="30" width="240" height="210" rx="8" fill="#BFE0EE"/><rect x="136" y="30" width="6" height="210" fill="#F6E9D8"/>
      <circle cx="70" cy="200" r="30" fill="#8DBB7F"/><circle cx="220" cy="190" r="24" fill="#79AB6C"/><rect x="0" y="300" width="${W}" height="${H - 300}" fill="#C98A55"/>
      <ellipse cx="230" cy="330" rx="26" ry="8" fill="#FFFFFF"/><rect x="212" y="300" width="36" height="30" rx="6" fill="#FFFFFF"/><ellipse cx="230" cy="302" rx="17" ry="5" fill="#8A5A3A"/>`;
  }
  // a listener bust, head centre (140, 196) in card units
  function listenerSVG(L) {
    const cx = 140, hy = 196, sk = L.skin, hr = L.hair;
    let hair = '';
    if (L.style === 'curls') hair = Array.from({ length: 14 }, (_, i) => { const a = Math.PI * (0.9 + i * 0.09); return `<circle cx="${(cx + Math.cos(a) * 44).toFixed(1)}" cy="${(hy - 8 + Math.sin(a) * 44).toFixed(1)}" r="${15 + (i % 3) * 2}" fill="${hr}"/>`; }).join('') + `<ellipse cx="${cx}" cy="${hy - 30}" rx="44" ry="26" fill="${hr}"/>`;
    else if (L.style === 'braid') hair = `<path d="M${cx - 44} ${hy + 6} C${cx - 48} ${hy - 50} ${cx + 48} ${hy - 50} ${cx + 44} ${hy + 6} C${cx + 30} ${hy - 22} ${cx - 30} ${hy - 22} ${cx - 44} ${hy + 6}Z" fill="${hr}"/>` + Array.from({ length: 5 }, (_, i) => `<ellipse cx="${cx + 46 + i * 2}" cy="${hy + 20 + i * 22}" rx="11" ry="13" fill="${hr}"/>`).join('');
    else if (L.style === 'cap') hair = `<path d="M${cx - 42} ${hy - 6} C${cx - 42} ${hy - 50} ${cx + 42} ${hy - 50} ${cx + 42} ${hy - 6}Z" fill="${L.top2}"/><path d="M${cx + 30} ${hy - 12} q30 -2 44 8 q-24 4 -44 2Z" fill="${L.top2}"/><circle cx="${cx}" cy="${hy - 44}" r="4" fill="${L.top}"/>`;
    else if (L.style === 'bob') hair = `<path d="M${cx - 48} ${hy + 30} C${cx - 56} ${hy - 50} ${cx + 56} ${hy - 50} ${cx + 48} ${hy + 30} L${cx + 34} ${hy + 30} C${cx + 36} ${hy - 4} ${cx + 10} ${hy - 22} ${cx - 24} ${hy - 14} C${cx - 34} ${hy} ${cx - 34} ${hy + 20} ${cx - 34} ${hy + 30}Z" fill="${hr}"/>`;
    else if (L.style === 'beanie') hair = `<path d="M${cx - 44} ${hy - 4} C${cx - 46} ${hy - 58} ${cx + 46} ${hy - 58} ${cx + 44} ${hy - 4}Z" fill="#E9735A"/><rect x="${cx - 46}" y="${hy - 14}" width="92" height="16" rx="7" fill="#D65F45"/><circle cx="${cx}" cy="${hy - 56}" r="10" fill="#F6E7D2"/>`;
    else hair = `<path d="M${cx - 42} ${hy - 2} C${cx - 46} ${hy - 52} ${cx + 46} ${hy - 52} ${cx + 42} ${hy - 2} C${cx + 30} ${hy - 26} ${cx - 10} ${hy - 30} ${cx - 42} ${hy - 2}Z" fill="${hr}"/>`;
    const extra = L.extra === 'headphones' ? `<path d="M${cx - 46} ${hy + 4} C${cx - 52} ${hy - 62} ${cx + 52} ${hy - 62} ${cx + 46} ${hy + 4}" fill="none" stroke="#2E2B33" stroke-width="8"/><rect x="${cx - 56}" y="${hy - 8}" width="18" height="30" rx="8" fill="#2E2B33"/><rect x="${cx + 38}" y="${hy - 8}" width="18" height="30" rx="8" fill="#2E2B33"/>`
      : L.extra === 'buds' ? `<circle cx="${cx - 40}" cy="${hy + 8}" r="5" fill="#FFFFFF"/><circle cx="${cx + 40}" cy="${hy + 8}" r="5" fill="#FFFFFF"/>`
      : L.extra === 'scarf' ? `<path d="M${cx - 50} ${hy + 62} C${cx - 20} ${hy + 80} ${cx + 20} ${hy + 80} ${cx + 50} ${hy + 62} L${cx + 46} ${hy + 84} C${cx + 16} ${hy + 98} ${cx - 16} ${hy + 98} ${cx - 46} ${hy + 84}Z" fill="#F2B544"/><rect x="${cx + 16}" y="${hy + 84}" width="18" height="50" rx="6" fill="#E0A91B"/>`
      : L.extra === 'glasses' ? `<g fill="none" stroke="#2E2B33" stroke-width="3"><circle cx="${cx - 15}" cy="${hy + 4}" r="11"/><circle cx="${cx + 15}" cy="${hy + 4}" r="11"/><path d="M${cx - 4} ${hy + 4} h8"/></g>` : '';
    return `
  <path d="M${cx - 112} ${CH + 10} C${cx - 108} ${hy + 120} ${cx - 76} ${hy + 76} ${cx - 34} ${hy + 70} L${cx + 34} ${hy + 70} C${cx + 76} ${hy + 76} ${cx + 108} ${hy + 120} ${cx + 112} ${CH + 10}Z" fill="${L.top}"/>
  <path d="M${cx - 24} ${hy + 70} C${cx - 14} ${hy + 92} ${cx + 14} ${hy + 92} ${cx + 24} ${hy + 70}Z" fill="${L.top2}"/>
  <rect x="${cx - 14}" y="${hy + 34}" width="28" height="44" rx="10" fill="${sk}"/><rect x="${cx - 14}" y="${hy + 50}" width="28" height="14" fill="#00000014"/>
  <ellipse cx="${cx}" cy="${hy}" rx="38" ry="46" fill="${sk}"/>
  <ellipse cx="${cx - 38}" cy="${hy + 6}" rx="7" ry="11" fill="${sk}"/><ellipse cx="${cx + 38}" cy="${hy + 6}" rx="7" ry="11" fill="${sk}"/>
  <circle cx="${cx - 14}" cy="${hy + 4}" r="3.6" fill="#1F1714"/><circle cx="${cx + 14}" cy="${hy + 4}" r="3.6" fill="#1F1714"/>
  <path d="M${cx - 21} ${hy - 9} q7 -4 14 -1 M${cx + 7} ${hy - 10} q7 -3 14 1" fill="none" stroke="#1F1714" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M${cx - 9} ${hy + 22} q9 8 18 0" fill="none" stroke="#7A2E24" stroke-width="2.8" stroke-linecap="round"/>
  <ellipse cx="${cx - 22}" cy="${hy + 16}" rx="7" ry="4" fill="#E2846E" opacity=".4"/><ellipse cx="${cx + 22}" cy="${hy + 16}" rx="7" ry="4" fill="#E2846E" opacity=".4"/>
  ${hair}${extra}`;
  }
  // the forearm and the gripping hand, drawn over the phone
  function gripSVG(L, px, py, pw, ph) {
    return `<path d="M${px + pw * 0.3} ${CH + 30} C${px + pw * 0.2} ${py + ph + 60} ${px + pw * 0.4} ${py + ph + 10} ${px + pw * 0.5} ${py + ph * 0.86}" fill="none" stroke="${L.top}" stroke-width="40" stroke-linecap="round"/>
      <ellipse cx="${px + pw * 0.5}" cy="${py + ph * 0.86}" rx="21" ry="12" fill="${L.top2}"/>
      <ellipse cx="${px + pw * 0.5}" cy="${py + ph * 0.72}" rx="${pw * 0.42}" ry="${ph * 0.17}" fill="${L.skin}"/>
      <rect x="${px - 8}" y="${py + ph * 0.38}" width="18" height="${ph * 0.12}" rx="7" fill="${L.skin}"/><rect x="${px - 7}" y="${py + ph * 0.53}" width="16" height="${ph * 0.11}" rx="7" fill="${L.skin}"/>
      <rect x="${px + pw - 10}" y="${py + ph * 0.46}" width="16" height="${ph * 0.16}" rx="7" fill="${L.skin}"/>`;
  }
  function listenerCard(parent, i) {
    const L = LISTENERS[i % LISTENERS.length], alt = i >= LISTENERS.length;
    const card = el(parent, 'abs', { left: (i * CPITCH) + 'px', top: '0px', width: CW + 'px', height: CH + 'px', borderRadius: '22px', overflow: 'hidden',
      background: '#FFFFFF', boxShadow: SHADOW });
    const fs = STORY.footage && STORY.footage.carousel;
    const src = Array.isArray(fs) ? fs[i % fs.length] : null;
    card.media = mediaSlot(card, src, CW, CH);
    if (card.media) return card;
    svgBox(card, CW, CH, bgSVG(L.bg, alt) + listenerSVG(L));
    // the phone, held up and tilted, showing Hush (small)
    const pw = 70, ph = 146, px = alt ? 34 : 176, py = 258, tilt = alt ? -L.tilt : L.tilt;
    const hold = el(card, 'abs', { left: px + 'px', top: py + 'px', width: pw + 'px', height: ph + 'px', transform: `rotate(${tilt}deg)`, transformOrigin: '50% 80%' });
    const body = phone(hold, { x: 0, y: 0, w: pw - 6, h: ph - 6, b: 3, r: 12 });
    body.style.boxShadow = '0 8px 18px rgba(20,14,30,.30), inset 0 0 0 1px rgba(255,255,255,.08)';
    hush(body.screen, L.phone, { w: pw - 6, h: ph - 6, r: 9 });
    const grip = svgBox(card, CW, CH, gripSVG(L, px, py, pw, ph));
    grip.style.transform = `rotate(${tilt}deg)`; grip.style.transformOrigin = `${px + pw / 2}px ${py + ph * 0.8}px`;
    return card;
  }

  // ───────────── the prompt bar (ours: a centred pill, crew avatars, a send arrow) ─────────────
  const BAR = { x: 230, top: 384, w: 620, h: 84 };
  const BTN = { d: 52, cx: BAR.x + BAR.w - 16 - 26 };
  function buildBar(parent) {
    const wrap = blurrable(el(parent, 'abs', { left: 0, top: 0, width: '1080px', height: '608px' }), '-10%', '120%');
    const bar = el(wrap, 'abs', { left: BAR.x + 'px', top: BAR.top + 'px', width: BAR.w + 'px', height: BAR.h + 'px', borderRadius: BAR.h / 2 + 'px', background: '#FFFFFF',
      boxShadow: '0 14px 36px rgba(22,21,27,.20), 0 2px 6px rgba(22,21,27,.08), 0 0 0 1px rgba(22,21,27,.06)' });
    // the send button, then the sweep over it (it glows on the button first) but under the text, clipped to the pill
    const btn = el(bar, 'abs', { left: (BTN.cx - BAR.x - BTN.d / 2) + 'px', top: (BAR.h / 2 - BTN.d / 2) + 'px', width: BTN.d + 'px', height: BTN.d + 'px', borderRadius: '50%', background: INK },
      `<svg viewBox="0 0 52 52" width="100%" height="100%"><path d="M26 36 V17 M18 24.5 L26 16.5 L34 24.5" fill="none" stroke="#FFFFFF" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
    const clip = el(bar, 'abs', { left: 0, top: 0, width: BAR.w + 'px', height: BAR.h + 'px', borderRadius: BAR.h / 2 + 'px', overflow: 'hidden' });
    const sweep = el(clip, 'abs', { left: 0, top: '-10px', width: '100px', height: (BAR.h + 20) + 'px', opacity: 0,
      background: 'radial-gradient(closest-side, rgba(46,107,255,.74), rgba(139,92,246,.42) 55%, rgba(255,122,31,.14) 80%, rgba(255,122,31,0))' });
    ['scout', 'critic', 'builder'].forEach((id, i) => {
      const disc = el(bar, 'abs', { left: (20 + i * 22) + 'px', top: (BAR.h / 2 - 17) + 'px', width: '34px', height: '34px', borderRadius: '50%', background: PAPER,
        boxShadow: '0 0 0 2.5px #FFFFFF', overflow: 'hidden', zIndex: 3 - i });
      const c = crew(disc, id, i === 0 ? 'happy' : 'open', 24); placeCrew(c, 17, 21, i === 0 ? 'happy' : 'open');
    });
    const tx = 20 + 2 * 22 + 34 + 16, base = BAR.h / 2 + 7.5;
    const ph = text(bar, STORY.promptPlaceholder, { x: tx, base, size: 21, weight: 500, color: INK3, ls: -0.015 });
    const typed = charText(bar, STORY.prompt, { x: tx, base, size: 21, weight: 500, color: INK, ls: -0.015 });
    return { wrap, bar, sweep, ph, typed, btn };
  }
  // the prompt types in two bursts at the reference's per-frame cadence, scaled to our copy's length (same first and last frames)
  function typeSchedule(str) {
    const T = M.p1.typeRef, n1 = str.length;
    let cut = str.lastIndexOf(' ', Math.round(n1 * 0.56)); if (cut < 1) cut = Math.round(n1 / 2);
    const a = cut, b = n1 - cut;
    const k1 = Object.fromEntries(Object.entries(T.b1).map(([n, k]) => [n, Math.round(k * a / 20)]));
    const k2 = Object.fromEntries(Object.entries(T.b2).map(([n, k]) => [n, a + Math.round(k * b / 18)]));
    return n => n < 132 ? 0 : n <= 140 ? k1[n] : n < 170 ? a : n <= 178 ? k2[n] : n1;
  }

  // ═════════════ plate 1 ═════════════
  scene({
    id: 'w2-plate1', from: 95, to: 263, z: 70,
    build(S) {
      building(S, () => {
        S.page = el(S.cam, 'abs', { left: '-200px', top: '-200px', width: '1480px', height: '1008px', background: PAPER });
        S.cw = blurrable(el(S.cam, 'abs', { left: 0, top: 0, width: '1080px', height: '608px' }), '-20%', '140%');
        S.card = el(S.cw, 'abs', { left: 0, top: 0, width: '1080px', height: '608px', overflow: 'hidden', transformOrigin: '540px 304px', background: '#E9D4B4' });
        S.pic = el(S.card, 'abs', { left: 0, top: 0, width: '1080px', height: '608px', transformOrigin: '0 0' });
        S.media = QA ? null : footagePlate(S.pic, 'plate1');
        // a still rides the measured camera, which starts wider than the key (F.s ≈ 0.80 at n95): lay it out 1.3× about the centre
        if (S.media && S.media.tagName === 'IMG') Object.assign(S.media.style, { left: '-162px', top: '-91px', width: '1404px', height: '790px' });
        if (QA) { S.card.style.background = '#262626'; S.qa = true; }
        else if (!S.media) {
          const svg = svgBox(S.pic, 1080, 608, plate1SVG()).svg;
          // live parts: steam, the mug, both forearms (drawn over the laptop)
          svg.insertAdjacentHTML('beforeend', `<g class="steam" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"><path/><path/></g>
            <g class="mug"><ellipse cx="0" cy="22" rx="24" ry="6" fill="#B9783F" opacity=".3"/><path d="M-20 -20 L-18 18 C-17 22 17 22 18 18 L20 -20Z" fill="url(#k1mugg)"/>
            <ellipse cx="0" cy="-20" rx="20" ry="5.5" fill="#E9735A"/><ellipse cx="0" cy="-19.4" rx="16.5" ry="4.2" fill="#6B4226"/><circle cx="-2" cy="2" r="8.5" fill="#19B47E"/><circle cx="-5" cy="2" r="1.3" fill="#15151A"/><circle cx="1" cy="2" r="1.3" fill="#15151A"/><path d="M-2 -6.5 q-5 -5 -8 -2 q4 3 8 2Z M-2 -6.5 q5 -5 8 -2 q-4 3 -8 2Z" fill="#2FCB92"/>
            <path d="M19 -12 q14 2 12 14 q-2 9 -13 9" fill="none" stroke="#D9654A" stroke-width="5" stroke-linecap="round"/></g>
            <g class="armL"></g><g class="armR"></g>`);
          S.steam = [...svg.querySelectorAll('.steam path')];
          S.mug = svg.querySelector('.mug');
          S.armL = limb(svg.querySelector('.armL'), { sleeve: '#EFE3CF', stripe: '#2A395F', cuff: '#E8DAC2', skin: '#C08060', skin2: '#A86B4C', w: 32, hand: 19 });
          S.armR = limb(svg.querySelector('.armR'), { sleeve: '#FBF4E8', stripe: '#2F3F6B', cuff: '#F1E6D3', skin: '#CB8E69', skin2: '#A86B4C', w: 32, hand: 19, watch: true });
        }
        S.ui = buildBar(S.cam);
        S.sched = typeSchedule(STORY.prompt);
        uniquify(S.root, 'w2a');
      });
    },
    seek(n, S) {
      const P1 = M.p1;
      S.page.style.display = n >= 98 ? 'block' : 'none';       // W1's corridor (to n96) shows behind the card; n97 sits on the body paper
      // the card: scale c about the frame centre, on-screen corner radius r, on-screen blur b
      const c = n >= 111 ? 1 : trk(P1.card.s, n), r = n >= 111 ? 0 : trk(P1.card.r, n);
      const b = n >= 111 ? 0 : trk(P1.card.blur, n), by = n >= 111 ? 0 : trk(P1.card.blurY, n);   // zoom blur: σy < σx
      S.card.style.transform = c < 1 ? `scale(${c.toFixed(5)})` : 'none';
      S.card.style.borderRadius = r > 0.05 ? f2(r / c) + 'px' : '0';
      S.card.style.boxShadow = c < 1 ? `0 0 0 ${f2(1 / c)}px rgba(22,21,27,.10)` : 'none';   // a hairline only: a soft shadow would widen the measured edge
      S.cw._blur(b, by);
      // the camera inside the card (measured, relative to the n112 full-bleed key)
      const s = trk(P1.cam.s, n), tx = trk(P1.cam.tx, n), ty = trk(P1.cam.ty, n);
      const work = [];
      if (S.media) {
        if (S.media.tagName === 'VIDEO') { setCam(S.pic, 1, 0, 0); work.push(S.media._seekTo((n - 95) / 30)); }
        else { setCam(S.pic, s, tx, ty); work.push(decoded(S.media)); }
      } else if (!S.qa) {
        setCam(S.pic, s, tx, ty);
        S.steam.forEach((p, i) => {
          const ph = n * 0.16 + i * 2.2, x0 = 594 + i * 12, y0 = 346;
          p.setAttribute('d', `M${x0} ${y0} C${f2(x0 - 8 + 5 * Math.sin(ph))} ${y0 - 14} ${f2(x0 + 8 + 5 * Math.sin(ph + 1))} ${y0 - 28} ${f2(x0 + 3 * Math.sin(ph + 2))} ${y0 - 44}`);
          p.setAttribute('opacity', f2(0.35 + 0.2 * Math.sin(ph * 0.7)));
        });
        // hands: typing during the bursts; the right index taps with the send (n203–210); after it her left hand reaches for the mug
        // (n229–244) and lifts it (n246–263)
        const tap = n < 203 ? 0 : n < 205 ? (n - 203) / 2 : n < 208 ? 1 : n < 211 ? 1 - (n - 208) / 3 : 0;
        const jig = k => (n >= 132 && n <= 140) || (n >= 170 && n <= 178) ? 1.6 * Math.sin(n * 2.1 + k) : 0;
        S.armR.set([684, 316], [716, 372], [748 + jig(0), 374 - jig(1) * 0.5 + tap * 6], 22 + tap * 8, -tap * 22);
        const reach = smooth((n - 229) / 15), lift = smooth((n - 246) / 17);
        const typing = [666 + jig(2), 384 + jig(3) * 0.5], atMug = [624, 372];
        const wx = lerp(typing[0], atMug[0], reach), wy = lerp(typing[1], atMug[1], reach) - 64 * lift;
        S.armL.set([578, 318], [580 + 8 * reach, 386 - 6 * reach - 30 * lift], [wx, wy], lerp(14, 170, reach), 0);
        S.mug.setAttribute('transform', `translate(${f2(598 + (wx - atMug[0]) * lift)} ${f2(370 + (wy - atMug[1]) * lift)}) rotate(${f2(-6 * lift)})`);
      }
      // ── the prompt bar ──
      const U = S.ui, on = n >= 123 && n <= 233;
      U.wrap.style.display = on ? 'block' : 'none';
      if (on) {
        U.bar.style.transform = `translate(0px, ${f2(trk(P1.bar.dy, n))}px)`;
        U.wrap._blur(0, trk(P1.bar.sig, n));
        const k = S.sched(n), kp = S.sched(n - 1);
        U.ph.style.opacity = k === 0 ? 1 : 0;
        U.typed.chars.forEach((sp, i) => { sp.style.opacity = i < k ? 1 : 0; sp.style.color = (i >= kp && i < k) ? '#2E6BFF' : INK; });
        const bs = n <= 201 || n >= 212 ? 1 : trk(P1.btn, n);
        U.btn.style.transform = `scale(${bs.toFixed(4)})`;
        const a = n < 204 || n > 221 ? 0 : trk(P1.sweep.a, n);
        U.sweep.style.opacity = a.toFixed(3);
        if (a > 0) {
          const w = Math.max(80, trk(P1.sweep.w, n) * 1.75), cx = BTN.cx - BAR.x + trk(P1.sweep.dx, n);   // ×1.75: our gradient's 25% width is 0.57 of the box
          U.sweep.style.width = f2(w) + 'px'; U.sweep.style.left = f2(cx - w / 2) + 'px';
        }
      }
      if (work.length) return Promise.all(work);
    },
  });

  // ═════════════ plate 2 ═════════════
  const BUB_TOP = 373;                                         // rest top of the bubble row (pill top +4); measured offsets ride on it
  scene({
    id: 'w2-plate2', from: 1529, to: 1628, z: 70,
    build(S) {
      building(S, () => {
        S.page = el(S.cam, 'abs', { left: '-200px', top: '-200px', width: '1480px', height: '1008px', background: PAPER });
        S.cw = blurrable(el(S.cam, 'abs', { left: 0, top: 0, width: '1080px', height: '608px' }), '-20%', '140%');
        S.card = el(S.cw, 'abs', { left: 0, top: 0, width: '1080px', height: '608px', overflow: 'hidden', transformOrigin: '540px 304px', background: '#DCD5C8' });
        S.pic = el(S.card, 'abs', { left: 0, top: 0, width: '1080px', height: '608px', transformOrigin: '0 0' });
        S.media = QA ? null : footagePlate(S.pic, 'plate2');
        if (QA) S.card.style.background = '#262626';
        else if (!S.media) {
          svgBox(S.pic, 1080, 608, plate2SVG());
          // her phone shows Hush's player; her hands hold it
          const hold = el(S.pic, 'abs', { left: '562px', top: '350px', width: '62px', height: '128px', transform: 'rotate(-12deg)', transformOrigin: '50% 60%' });
          const body = phone(hold, { x: 0, y: 0, w: 56, h: 122, b: 3, r: 10 });
          hush(body.screen, 'player', { w: 56, h: 122, r: 8 });
          // her hands around the phone (same −12° turn as the phone): fingers behind the edges, thumbs on the glass
          const sk = '#93603F', sk2 = '#7A4A31', hi = '#A8714D';
          svgBox(S.pic, 1080, 608, `<path d="M500 680 C506 560 522 500 560 474" fill="none" stroke="#6B9C83" stroke-width="44" stroke-linecap="round"/>
            <path d="M700 680 C700 560 672 500 628 476" fill="none" stroke="#5F937A" stroke-width="44" stroke-linecap="round"/>
            <g transform="rotate(-12 593 414)">
              ${[408, 424, 440].map(y => `<rect x="549" y="${y}" width="16" height="13" rx="6.5" fill="${sk}" stroke="${sk2}" stroke-width="0.9"/>`).join('')}
              ${[402, 418, 434].map(y => `<rect x="621" y="${y}" width="16" height="13" rx="6.5" fill="${sk}" stroke="${sk2}" stroke-width="0.9"/>`).join('')}
              <ellipse cx="567" cy="462" rx="19" ry="16" fill="${sk}"/><ellipse cx="620" cy="460" rx="19" ry="16" fill="${sk}"/>
              <path d="M556 452 q8 -6 18 -2" fill="none" stroke="${hi}" stroke-width="2" stroke-linecap="round" opacity=".8"/>
              <rect x="566" y="440" width="25" height="11" rx="5.5" fill="${hi}" stroke="${sk2}" stroke-width="0.9" transform="rotate(-38 570 446)"/>
              <rect x="597" y="436" width="25" height="11" rx="5.5" fill="${hi}" stroke="${sk2}" stroke-width="0.9" transform="rotate(38 618 442)"/>
              <rect x="546" y="470" width="44" height="14" rx="7" fill="#5A8A72"/><rect x="598" y="468" width="44" height="14" rx="7" fill="#527F69"/>
            </g>`);
        }
        // Critic's bubble (ours: white pill, the character on its left, one line)
        const B = STORY.bubbles.listeners;
        S.bw = blurrable(el(S.cam, 'abs', { left: 0, top: 0, width: '1080px', height: '608px' }), '-10%', '120%');
        S.bub = el(S.bw, 'abs', { left: '58px', top: BUB_TOP + 'px', width: '760px', height: '72px' });
        const ch = crew(S.bub, B.agent, 'happy', 62); placeCrew(ch, 34, 40, 'happy');
        el(S.bub, 'abs', { left: '78px', top: '4px', height: '64px', borderRadius: '32px', background: 'rgba(255,255,255,.96)', whiteSpace: 'nowrap',
          boxShadow: '0 12px 30px rgba(22,21,27,.22), 0 0 0 1px rgba(22,21,27,.05)', padding: '0 28px', font: '500 23px/64px Inter', color: INK, letterSpacing: '-0.015em' }, B.text);
        uniquify(S.root, 'w2b');
      });
    },
    seek(n, S) {
      const P2 = M.p2;
      S.page.style.display = n >= 1532 ? 'block' : 'none';     // W6's app shows while its phone whips away (it runs through n1531)
      const c = n >= 1553 ? 1 : trk(P2.card.s, n), dy = n >= 1553 ? 0 : trk(P2.card.dy, n), r = n >= 1553 ? 0 : trk(P2.card.r, n);
      const bx = n >= 1553 ? 0 : trk(P2.card.blurX, n), by = n >= 1553 ? 0 : trk(P2.card.blurY, n);
      S.card.style.transform = `translate(0px, ${f2(dy)}px) scale(${c.toFixed(5)})`;
      S.card.style.borderRadius = r > 0.05 ? f2(r / c) + 'px' : '0';
      S.cw._blur(bx, by);                                      // measured per axis: the rise blurs along y, the growth is a zoom blur
      const s = trk(P2.cam.s, n), tx = trk(P2.cam.tx, n), ty = trk(P2.cam.ty, n);
      const work = [];
      if (S.media && S.media.tagName === 'VIDEO') { setCam(S.pic, 1, 0, 0); work.push(S.media._seekTo((n - 1529) / 30)); }
      else { setCam(S.pic, s, tx, ty); if (S.media) work.push(decoded(S.media)); }
      const on = n >= 1590;
      S.bw.style.display = on ? 'block' : 'none';
      if (on) {
        S.bub.style.transform = `translate(0px, ${f2(trk(P2.bubble.dy, n))}px)`;
        S.bub.style.opacity = trk(P2.bubble.op, n).toFixed(3);
        S.bw._blur(0, trk(P2.bubble.sig, n));
      }
      if (work.length) return Promise.all(work);
    },
  });

  // ═════════════ carousel ═════════════
  scene({
    id: 'w2-carousel', from: 1629, to: 1697, z: 70,
    build(S) {
      building(S, () => {
        S.page = el(S.cam, 'abs', { left: '-200px', top: '-200px', width: '1480px', height: '1008px', background: PAPER });
        S.row = el(S.cam, 'abs', { left: 0, top: CTOP + 'px', width: (8 * CPITCH) + 'px', height: CH + 'px' });
        S.cards = Array.from({ length: 8 }, (_, i) => listenerCard(S.row, i));
        uniquify(S.root, 'w2c');
      });
    },
    seek(n, S) {
      S.page.style.display = n <= 1696 ? 'block' : 'none';     // the last frame of the drop sits on the body paper (or the outro's own backdrop)
      S.row.style.transform = `translate(${f2(trk(M.car.x, n))}px, ${f2(trk(M.car.y, n))}px)`;
      const work = [];
      S.cards.forEach(cd => { if (cd.media) work.push(cd.media._isVid ? cd.media._seekTo((n - 1629) / 30) : decoded(cd.media)); });
      if (work.length) return Promise.all(work);
    },
  });
})();
