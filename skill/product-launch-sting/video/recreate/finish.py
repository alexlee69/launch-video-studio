# -*- coding: utf-8 -*-
# Finish a recreation the way its reference was finished (RECREATE.md §8): the reference's frame cadence rebuilt by
# index, an optional corner bug on the reference's own clock, the soundtrack re-mixed from the engine's stems to the
# reference's sound grammar, mastered and muxed — then QA'd against the reference.
#   python3 finish.py --master DIR/<slug>-16x9.mp4 --out DIR/<slug>-final-16x9.mp4 [--cuts CUTS|none]
#                     [--ref REF.mp4 | --pattern 15:5,10,14 | --cadence none] [--fps 30] [--frames N]
#                     [--bug corner-bug-hf01.json --bug-glyph mark.svg|png [--bug-text wordmark.svg|png]]
#                     [--keep music [--add audio/sfx.wav …] [--stems DIR/out/main/audio] | --no-audio] [--lufs -14] [--tp -1]
#   python3 finish.py --measure REF.mp4                  the reference's repeat cadence, e.g. 15:5,10,14
#   python3 finish.py --qa OUT.mp4 --master M.mp4 [--ref REF.mp4 | --pattern …] [--lufs -14] [--tp -1]   QA only
#
# 1 · Cadence. Many references are a 24 fps edit shown at 30 fps: every 15 output frames, 3 repeat the frame before
#   (higgsfield01: n % 15 in {5, 10, 14} — 457 of its 459 slots are exact repeats). That pattern IS the film's motion
#   texture, and every cut and judder step sits on it. `lv.mjs --film` renders 60 fps, so the 30 fps file is rebuilt by
#   index: output frame n shows edit frame m(n) = (n div P)·(P − k) + r − #{slots ≤ r} (r = n mod P, k slots). ffmpeg
#   can't do this with filters: `fps=30` on a 24p source repeats at n % 15 in {2, 7, 12} (its own rounding phase,
#   measured on a 24p testsrc2), never the reference's; `fps=24,fps=30` from 60 fps lands on that same wrong phase.
#   --ref measures the slots (--measure prints them), --pattern gives them, --cadence none is a straight 60 → 30.
#   Each frame runs on ITS OWN SHOT's clock. lv.mjs animates every shot, and samples its 24 fps plate (plate frame =
#   2·(f − f_k) // 5), in the shot's own time from its first 60 fps frame f_k, so the pick is anchored there: a shot
#   whose first output frame is n_k shows edit frame m at master frame j = f_k + ceil((m − m(n_k))·60/24) — one plate
#   frame per edit frame, repeats only on the reference's slots — and j is then clamped inside the shot (f_k …
#   f_{k+1} − 1), so no frame before a cut reaches into the next shot. Anchoring to the film's grid instead (j =
#   ceil(2.5·m)) puts every shot that starts on a master frame ≡ 3 mod 5 out of phase (shots at n/30 s starting on an
#   n % 15 = 4 or 9 cut; manus2-space's S03, S12, S15, S17, S19: plate 0,0,2,2,4,… = 12 fps judder all shot long), and
#   without the clamp the frame before such a cut shows the next shot (5 of higgsfield01's 26 cuts a frame early). The
#   shot starts are the master's own DIR/out/main/timeline.json (lv.mjs writes it; the default) or --cuts: a
#   timeline.json, or the shot starts in output frames (a recreation's = the reference's cut frames: compare.py's
#   cuts.json, lv.mjs --breakdown's breakdown.json, "348 label" lines or 348,364,…; the shots then start at n/30 s,
#   RECREATE.md §2). --cuts none = the film's grid, unclamped. A shot with more edit frames than its master frames hold
#   (one that starts on n % 15 = 0 and is 4 mod 5 frames long) keeps its last picture a frame: the clamped frames are listed.
# 2 · Corner bug — optional, off unless --bug: only when the storyboard has one, checked against every overlay. Sprites
#   (PNG; an SVG is rendered transparent with headless Chrome — qlmanage renders SVGs at their own tiny size and crops
#   them) placed by a clock spec: places and boxes, the switch frames, fade-out and fade-in tables, the build and the
#   end. corner-bug-hf01.json is higgsfield01's watermark recipe (TR ↔ BL every 270 frames, 9-frame fade out, 11 in). A
#   soft dark halo keeps white ink legible on light screens. Opacity runs on the edit's own clock (a repeat frame keeps
#   the frame before it, bug included), composited in YUV (no colour-matrix trip).
# 3 · Soundtrack. --keep re-mixes the engine's stems at their own levels (DIR/out/<cut>/audio: music, points = UI
#   cues, whoosh = transition whooshes) plus --add WAVs (recreate/sfx.py), then masters like the engine (gain + a
#   look-ahead limiter until −14 LUFS ±0.2 with the true peak ≤ −1 dBTP measured AFTER the AAC encode). Without --keep /
#   --add the engine's own master.wav is used as is. A reference with no transition whooshes and a silent UI
#   (higgsfield01) is --keep music --add sfx.wav. The music level and voiceover ducking aren't re-applied: a film with
#   a voiceover keeps the engine's master.
# QA (exit 1 on any ✗): the frame count and duration, BT.709 tags, the repeat cadence measured on the output against
#   the reference's (or the pattern), every non-repeat frame matching the master frame it was taken from, and the
#   loudness / true peak of the mp4's AAC. The output is written whole (a temp file + one rename) and is never an input.
# Exit codes: 0 done · 1 a QA check failed, ffmpeg failed, or the master can't reach the loudness spec · 2 bad arguments
#   or an unreadable input (both refused before any work).
import argparse, json, math, os, re, shutil, subprocess, sys, tempfile
from fractions import Fraction
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.dont_write_bytecode = True   # no __pycache__ in the skill
from media import np, Image, UserError, die, run, probe, frames, count_frames, guard_outputs, temp_beside, publish, discard
from PIL import ImageFilter


class Failed(UserError):
    """a tool or the loudness spec failed (not the arguments): exit 1"""


HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
CHROME = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']


# ── cadence ──
def parse_pattern(s):
    try:
        p, _, sl = str(s).partition(':')
        P, S = int(p), tuple(sorted({int(x) for x in sl.split(',') if x.strip()}))
    except ValueError:
        raise UserError('--pattern %s: give it as PERIOD:SLOT,SLOT,… — e.g. 15:5,10,14 (a 24 fps edit in a 30 fps file)' % s)
    if P < 1 or any(not 0 < x < P for x in S) or (S and len(S) * 2 >= P):
        raise UserError('--pattern %s: slots are output frames 1…%d of each period of %d that repeat the frame before, fewer than half of them' % (s, P - 1, P))
    return (P, S) if S else (1, ())


def same_pattern(a, b):
    """one cadence written two ways? (5:2 is 15:2,7,12; 30:5,10,14,20,25,29 is 15:5,10,14)"""
    if not a[0] or not b[0]:
        return a == b
    L = a[0] * b[0] // math.gcd(a[0], b[0])
    ex = lambda P, S: {s + k * P for k in range(L // P) for s in S}
    return ex(*a) == ex(*b)


def fmt_pattern(P, S):
    return 'none' if (P, S) == (1, ()) else '%d:%s' % (P, ','.join(map(str, S)))


def small_gray(path):
    """every frame by index, 240 px wide grey (area-scaled), as one uint8 array (n, h, w)"""
    V = probe(path)['video']
    if not V:
        raise UserError('%s has no video' % path)
    w = 240
    h = max(2, int(round(V['h'] * w / V['w'] / 2)) * 2)
    return np.array([f for f in frames(path, size=(w, h))], dtype=np.uint8)


def find_pattern(g, thr=0.25, hi=60):
    """the smallest period whose slots repeat (≥ 85 % of them, every other position ≤ 60 %): (P, S, d) or (None, (), d)"""
    d = np.array([np.abs(g[i + 1].astype(np.int16) - g[i]).mean() for i in range(len(g) - 1)])   # d[i]: frame i+1 against frame i
    rep, n = d < thr, np.arange(1, len(d) + 1)
    for P in range(2, hi + 1):
        if len(d) < 3 * P:
            break
        frac = np.array([rep[n % P == r].mean() if (n % P == r).any() else 0 for r in range(P)])
        R = tuple(r for r in range(P) if frac[r] >= 0.85)
        if R and len(R) * 2 < P and all(frac[r] <= 0.6 for r in range(P) if r not in R):
            return P, R, d
    return None, (), d


def slot_stats(d, P, S, thr=0.25):
    n = np.arange(1, len(d) + 1)
    slot = np.isin(n % P, S) if S else np.zeros(len(d), bool)
    rep = d < thr
    return int((rep & slot).sum()), int(slot.sum()), int((rep & ~slot).sum())


def index_map(N, P, S, F, O, starts=None, clamped=None):
    """output frame n → (edit frame m, master frame j); the edit rate M = O·(P − k)/P. starts (each shot's first master
    frame f_k): j = f_k + ceil((m − m(n_k))·F/M) on the shot's own clock (n_k = ceil(f_k·O/F), its first output frame),
    kept below the next shot's start (clamped frames are appended to `clamped`); None: one clock, ceil(m·F/M)."""
    K = P - len(S)
    M = O * K / P
    if F < M:
        raise UserError('the master is %s fps, slower than the edit rate %s fps it should carry' % (F, M))
    mo = lambda n: (n // P) * K + n % P - sum(1 for s in S if s <= n % P)
    fs = sorted({0} | {f for f in (starts or ()) if 0 < f < Fraction(N) * F / O})
    ns = [math.ceil(Fraction(f) * O / F) for f in fs]
    out, k = [], 0
    for n in range(N):
        m = mo(n)
        if starts is None:
            j = math.ceil(Fraction(m) * F / M)
        else:
            while k + 1 < len(fs) and n >= ns[k + 1]:
                k += 1
            j = fs[k] + math.ceil(Fraction(m - mo(ns[k])) * F / M)
            if k + 1 < len(fs) and j >= fs[k + 1]:
                j = fs[k + 1] - 1
                if clamped is not None:
                    clamped.append(n)
        out.append((m, j))
    return out, M


def early_residues(P, S, F, O):
    """n mod P of the cuts that land a frame early (and of the shots that judder) on one clock with shots at n/O s"""
    mp, _ = index_map(3 * P, P, S, F, O)
    return [r for r in range(P) if r not in S and mp[P + r - 1][1] >= Fraction(P + r) * F / O]


def read_cuts(arg):
    """shot starts → ('master', [f_k], its fps) from lv.mjs's timeline.json, or ('out', [n_k], None) from compare.py's
    cuts.json, lv.mjs --breakdown's breakdown.json, a text list ("348 label" a line) or 348,364,…"""
    if not os.path.isfile(arg):
        try:
            return 'out', [int(x.lstrip('n')) for x in re.split(r'[,\s]+', arg.strip()) if x], None
        except ValueError:
            raise UserError('--cuts %s: give the shot starts (348,364,…), a file that lists them (timeline.json, cuts.json, '
                            'breakdown.json, "348 label" lines), or none' % arg)
    txt = open(arg, encoding='utf-8').read()
    try:
        J = json.loads(txt)
    except ValueError:
        J = None
    if isinstance(J, dict) and isinstance(J.get('cuts'), list) and J.get('renderFps'):      # lv.mjs's own timeline.json
        return 'master', [int(c) for c in J['cuts']], Fraction(str(J['renderFps']))
    if isinstance(J, dict) and isinstance(J.get('cuts'), list):                            # compare.py's cuts.json
        return 'out', [int(c['n']) for c in J['cuts']], None
    if isinstance(J, dict) and isinstance(J.get('shots'), list):                           # lv.mjs --breakdown's breakdown.json
        return 'out', [int(x['startFrame']) for x in J['shots']], None
    if J is not None:
        raise UserError('%s: no "cuts" (timeline.json, compare.py) or "shots" (lv.mjs --breakdown) in it' % arg)
    cuts = [int(m.group(1)) for m in (re.match(r'\s*n?(\d+)\b', l) for l in txt.splitlines()) if m]
    if not cuts:
        raise UserError('%s: no shot starts in it (one a line, e.g. "75 lockup > corridor")' % arg)
    return 'out', cuts, None


def shot_starts(a, master, P, F, O):
    """(each shot's first master frame or None for one clock, where they came from)"""
    tl = os.path.join(os.path.dirname(os.path.abspath(master)), 'out', 'main', 'timeline.json')
    src = a.cuts or (tl if os.path.isfile(tl) else None)
    if src == 'none':
        return None, 'one clock (--cuts none)'
    if not src:
        if P > 1:
            raise UserError('which master frame starts each shot? There is no %s next to the master: give --cuts (the shot '
                            'starts — a recreation\'s are the reference\'s cut list) or --cuts none (one clock: RECREATE.md §8)' % tl)
        return None, 'one clock'
    kind, xs, rate = read_cuts(src)
    if kind == 'master':
        if rate != F:
            raise UserError('%s counts %s fps frames; the master is %s fps' % (src, rate, F))
        J = json.load(open(src, encoding='utf-8'))
        n = count_frames(probe(master))
        if J.get('frames') and int(J['frames']) != n:
            raise UserError('%s is the timeline of a %s-frame master; %s has %d frames — not the same render' % (src, J['frames'], master, n))
        return xs, '%d shots from %s' % (len(set(xs) | {0}), src)
    return [int(Fraction(n) * F / O + Fraction(1, 2)) for n in xs], '%d shots from %s (each starting at n/%s s)' % (len(set(xs) | {0}), src, O)


# ── corner bug ──
def find_chrome():
    for c in [os.environ.get('CHROME_PATH')] + CHROME:
        if c and (os.path.isfile(c) or shutil.which(c)):
            return c
    raise UserError('an SVG sprite is rendered with Google Chrome (headless), which was not found — install Chrome, set CHROME_PATH, '
                    'or give a PNG')


def svg_png(svg, tmp, px=960):
    """the SVG on a transparent page (its own colours), screenshotted by headless Chrome"""
    html, png = os.path.join(tmp, 'svg.html'), os.path.join(tmp, os.path.basename(svg) + '.png')
    with open(html, 'w', encoding='utf-8') as f:
        f.write('<html><head><style>html,body{margin:0;background:transparent}img{display:block;width:%dpx;height:%dpx;object-fit:contain}</style>'
                '</head><body><img src="file://%s"></body></html>' % (px, px, os.path.abspath(svg)))
    r = subprocess.run([find_chrome(), '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
                        '--default-background-color=00000000', '--window-size=%d,%d' % (px, px), '--screenshot=' + png, 'file://' + html],
                       capture_output=True)
    if r.returncode or not os.path.isfile(png):
        raise Failed('headless Chrome could not render %s: %s' % (svg, r.stderr.decode('utf-8', 'replace')[-400:]))
    return png


def rgb_to_yuv(rgb):
    """R'G'B' 0-255 → BT.709 TV-range Y'CbCr (float)"""
    r, g, b = [rgb[..., i].astype(np.float32) / 255 for i in range(3)]
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return 16 + 219 * y, 128 + 224 * (b - y) / 1.8556, 128 + 224 * (r - y) / 1.5748


def load_sprite(path, box_w, box_h, halo, ink, tmp):
    """alpha (ink coverage), halo (darkening), ink Y/U/V per pixel, fitted inside box_w × box_h, padded for the halo"""
    if path.lower().endswith('.svg'):
        path = svg_png(path, tmp)
    im = Image.open(path)
    rgba = np.asarray(im.convert('RGBA')).astype(np.float32)
    al = rgba[..., 3] / 255
    if im.mode not in ('RGBA', 'LA', 'PA') or al.min() > 0.99:            # no transparency: a light mark on a dark field, keyed by luma
        al = rgba[..., :3].mean(-1) / 255
        rgb = np.broadcast_to(np.array(ink, np.float32), rgba[..., :3].shape)
    else:
        rgb = rgba[..., :3]
    ys, xs = np.nonzero(al > 0.04)
    if not len(ys):
        raise UserError('%s: the sprite has no visible ink' % path)
    al, rgb = al[ys.min():ys.max() + 1, xs.min():xs.max() + 1], rgb[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = al.shape
    s = min(box_w / w, box_h / h)
    size = (max(1, round(w * s)), max(1, round(h * s)))
    a = np.asarray(Image.fromarray((al * 255).astype(np.uint8)).resize(size, Image.LANCZOS)).astype(np.float32) / 255
    col = np.asarray(Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).resize(size, Image.LANCZOS)).astype(np.float32)
    pad = int(halo.get('pad', 14))
    H2, W2 = a.shape[0] + 2 * pad, a.shape[1] + 2 * pad
    H2, W2 = H2 + H2 % 2, W2 + W2 % 2                              # even: chroma is 2×2
    A = np.zeros((H2, W2), np.float32); A[pad:pad + a.shape[0], pad:pad + a.shape[1]] = a
    C = np.full((H2, W2, 3), 255, np.float32); C[pad:pad + a.shape[0], pad:pad + a.shape[1]] = col
    halo_a = np.asarray(Image.fromarray((A * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(halo.get('blur', 5)))).astype(np.float32) / 255 * halo.get('opacity', 0.45)
    y, u, v = rgb_to_yuv(C)
    q = lambda c: (c[0::2, 0::2] + c[1::2, 0::2] + c[0::2, 1::2] + c[1::2, 1::2]) / 4   # 2×2 → the chroma grid
    return dict(a=A, h=halo_a, y=y, u=q(u), v=q(v), pad=pad, w=a.shape[1], hh=a.shape[0])


def interp(table, x):
    xs, ys = [p[0] for p in table], [p[1] for p in table]
    return float(np.interp(x, xs, ys))


class Bug:
    def __init__(self, spec_path, glyph, text, W, H, tmp):
        try:
            self.S = json.load(open(spec_path, encoding='utf-8'))
        except (OSError, ValueError) as e:
            raise UserError('%s: not a readable clock spec (%s)' % (spec_path, e))
        S = self.S
        fw, fh = S.get('frame', [1920, 1080])
        sx, sy = W / fw, H / fh
        halo, ink = S.get('halo', {}), S.get('ink', [255, 255, 255])
        src = {'glyph': glyph, 'text': text}
        self.parts = {}
        for place, parts in S['places'].items():
            for part, P in parts.items():
                if not src.get(part):
                    continue
                x0, y0, x1, y1 = [v * (sx if i % 2 == 0 else sy) for i, v in enumerate(P['box'])]
                sp = load_sprite(src[part], x1 - x0, y1 - y0, halo, ink, tmp)
                al = P.get('align', 'left')
                x = x1 - sp['w'] if al == 'right' else (x0 + x1 - sp['w']) / 2 if al == 'center' else x0
                y = (y0 + y1 - sp['hh']) / 2
                X, Y = int(x) - sp['pad'], int(y) - sp['pad']
                X, Y = max(0, X - X % 2), max(0, Y - Y % 2)
                h2, w2 = sp['a'].shape
                if X + w2 > W or Y + h2 > H:
                    raise UserError('the corner bug\'s %s at %s runs off the %dx%d frame' % (part, place, W, H))
                self.parts[(place, part)] = dict(sp, X=X, Y=Y)
        sw = S['switch']
        self.switch = sw.get('frames') or list(range(sw['first'], sw.get('until', S.get('end', 10 ** 9)), sw['every']))
        self.fo, self.fi = S['fade_out'], S['fade_in']
        self.out_end = max(p[0] for p in self.fo)
        self.order, self.end, self.build = S['order'], S.get('end', 10 ** 9), S.get('build', [])

    def state(self, n):
        """(place, {part: opacity}) at output frame n (the caller passes the first frame of n's edit frame)"""
        if n >= self.end:
            return None, {}
        k = sum(1 for s in self.switch if n > s + self.out_end)
        place = self.order[k % len(self.order)]
        f = 1.0
        for s in self.switch:
            if self.fo[0][0] <= n - s <= self.fo[-1][0]:
                f = interp(self.fo, n - s)
            elif self.fi[0][0] <= n - s <= self.fi[-1][0]:
                f = interp(self.fi, n - s)
        ops = {}
        for part in ('glyph', 'text'):
            b = [e for e in self.build if e[1] == part]
            v = 1.0 if not b else 0.0
            for frm, _, o in b:
                if n >= frm:
                    v = o
            ops[part] = v * f
        return place, ops

    def apply(self, Y, U, V, place, ops):
        for part, o in ops.items():
            p = self.parts.get((place, part))
            if not p or o <= 0:
                continue
            X, Yp, h2, w2 = p['X'], p['Y'], p['a'].shape[0], p['a'].shape[1]
            reg = Y[Yp:Yp + h2, X:X + w2].astype(np.float32)
            reg = 16 + (reg - 16) * (1 - p['h'] * o)                       # the soft dark halo (towards black, 16/128/128)
            reg += (p['y'] - reg) * (p['a'] * o)                           # the ink
            Y[Yp:Yp + h2, X:X + w2] = np.clip(np.rint(reg), 0, 255)
            ha = (p['h'][0::2, 0::2] + p['h'][1::2, 0::2] + p['h'][0::2, 1::2] + p['h'][1::2, 1::2]) / 4
            aa = (p['a'][0::2, 0::2] + p['a'][1::2, 0::2] + p['a'][0::2, 1::2] + p['a'][1::2, 1::2]) / 4
            for P_, ink in ((U, p['u']), (V, p['v'])):
                c = P_[Yp // 2:Yp // 2 + h2 // 2, X // 2:X // 2 + w2 // 2].astype(np.float32)
                c = 128 + (c - 128) * (1 - ha * o)
                c += (ink - c) * (aa * o)
                P_[Yp // 2:Yp // 2 + h2 // 2, X // 2:X // 2 + w2 // 2] = np.clip(np.rint(c), 0, 255)


# ── video ──
def build_video(master, out_v, N, P, S, O, bug_args, tmp, crf=16, starts=None):
    info = probe(master)
    V = info['video']
    if not V:
        raise UserError('%s has no video' % master)
    W, H, F = V['w'], V['h'], Fraction(V['rate'] or '0')
    if W % 2 or H % 2:
        raise UserError('%s is %dx%d: the cadence pass needs even sizes' % (master, W, H))
    clamped = []
    mp, M = index_map(N, P, S, F, O, starts, clamped)
    bug = Bug(*bug_args, W, H, tmp) if bug_args else None
    fsz = W * H * 3 // 2                                            # the master is read in order, every frame, up to the last one used
    dec = subprocess.Popen(['ffmpeg', '-v', 'error', '-nostdin', '-i', master, '-map', '0:v:0', '-an', '-fps_mode', 'passthrough',
                            '-frames:v', str(mp[-1][1] + 1), '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-'], stdout=subprocess.PIPE)
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-s', '%dx%d' % (W, H),
                            '-r', '%d/%d' % (O.numerator, O.denominator), '-i', '-',
                            # ffmpeg 8 drops -color_* options on frames that arrive untagged (rawvideo): stamp them on the frames
                            '-vf', 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv',
                            '-c:v', 'libx264', '-crf', str(crf), '-preset', 'slow', '-pix_fmt', 'yuv420p',
                            '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
                            '-movflags', '+faststart', out_v], stdin=subprocess.PIPE)
    cur, cur_j, held = None, -1, 0
    try:
        for n in range(N):
            m, j = mp[n]
            while cur_j < j:
                buf = dec.stdout.read(fsz)
                if len(buf) < fsz:
                    break
                cur, cur_j = buf, cur_j + 1
            if cur is None:
                raise Failed('%s: no frame decoded' % master)
            held += cur_j < j
            fr = cur
            if bug:
                n0 = n                                              # the bug runs on the edit's clock: a repeat keeps the frame before it
                while n0 > 0 and mp[n0 - 1][0] == m:
                    n0 -= 1
                place, ops = bug.state(n0)
                if place:
                    a = np.frombuffer(cur, np.uint8).copy()
                    Yp, Up, Vp = a[:W * H].reshape(H, W), a[W * H:W * H * 5 // 4].reshape(H // 2, W // 2), a[W * H * 5 // 4:].reshape(H // 2, W // 2)
                    bug.apply(Yp, Up, Vp, place, ops)
                    fr = a.tobytes()
            enc.stdin.write(fr)
    finally:
        enc.stdin.close(); rc = enc.wait()
        dec.stdout.close(); dec.kill() if dec.poll() is None else None; dec.wait()
    if rc:
        raise Failed('the x264 encode failed (exit %d)' % rc)
    return dict(W=W, H=H, F=F, M=M, held=held, map=mp, clamped=clamped)


# ── audio ──
def loudness(path):
    s = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    I = re.findall(r'I:\s+(-?[\d.]+) LUFS', s)
    tp = re.search(r'True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS', s)
    return (float(I[-1]) if I else float('nan')), (float(tp.group(1)) if tp and tp.group(1) != '-inf' else float('-inf'))


def ff(args, what):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args, capture_output=True)
    if r.returncode:
        raise Failed('%s failed:\n%s' % (what, r.stderr.decode('utf-8', 'replace').strip()[-1200:]))


def audio_inputs(a, master):
    """(the stem folder, the WAVs to re-mix — none: the engine's master as is), every one checked before any work"""
    stems = a.stems or os.path.join(os.path.dirname(os.path.abspath(master)), 'out', 'main', 'audio')
    ins = [os.path.join(stems, s.strip() + '.wav') for s in (a.keep or '').split(',') if s.strip()] + list(a.add or [])
    for p in ins:
        if not os.path.isfile(p):
            raise UserError('no such audio: %s%s' % (p, ' (the engine\'s stems are music, points, whoosh — run lv.mjs --film first)' if p.startswith(stems) else ''))
    if not ins and not os.path.isfile(os.path.join(stems, 'master.wav')) and not probe(master)['audio']:
        raise UserError('no soundtrack: %s has no master.wav and %s no audio — give --stems, --keep / --add, or --no-audio' % (stems, master))
    return stems, ins


def build_audio(a, stems, ins, master, dur, tmp):
    """→ a WAV of exactly dur seconds, mastered (or the engine's master as is)"""
    out = os.path.join(tmp, 'master.wav')
    if not ins:                                                 # the engine's own master, trimmed to the film
        src = os.path.join(stems, 'master.wav')
        src = src if os.path.isfile(src) else master
        ff(['-i', src, '-map', '0:a:0', '-af', 'apad=whole_dur=%.6f,atrim=end=%.6f' % (dur, dur), '-ar', str(SR), '-c:a', 'pcm_s24le', out], 'the soundtrack')
        return out, 'the engine\'s master (%s), as is' % os.path.relpath(src)
    mix = os.path.join(tmp, 'mix.wav')
    chain = ''.join('[%d:a]aresample=%d,aformat=sample_fmts=fltp:channel_layouts=stereo[s%d];' % (i, SR, i) for i in range(len(ins)))
    chain += ''.join('[s%d]' % i for i in range(len(ins))) + 'amix=inputs=%d:normalize=0:duration=longest,apad=whole_dur=%.6f,atrim=end=%.6f[m]' % (len(ins), dur, dur)
    ff(sum((['-i', p] for p in ins), []) + ['-filter_complex', chain, '-map', '[m]', '-c:a', 'pcm_f32le', mix], 'the stem mix')
    rawI = loudness(mix)[0]
    if not rawI > -70:
        raise UserError('the mix is silent (%s): nothing to master' % ', '.join(map(os.path.basename, ins)))
    target, tpmax = a.lufs, a.tp
    aac = os.path.join(tmp, 'aac-check.m4a')
    gain, ceil, m, ac = target - rawI, -1.6, (0, 0), (float('nan'), float('nan'))
    for it in range(16):                                        # the engine's own loop (lib/deliver.mjs master())
        ff(['-i', mix, '-af', 'volume=%.3fdB,alimiter=limit=%.4f:attack=1.5:release=45:level=false:latency=true,apad=whole_dur=%.6f,atrim=end=%.6f,'
            'afade=t=out:st=%.3f:d=0.06' % (gain, 10 ** (ceil / 20), dur, dur, dur - 0.06), '-ar', str(SR), '-c:a', 'pcm_s24le', out], 'mastering')
        m = loudness(out)
        if m[1] > tpmax:
            ceil -= 0.3
            continue
        ff(['-i', out, '-c:a', 'aac', '-b:a', '320k', '-ar', str(SR), aac], 'the AAC check')
        ac = loudness(aac)
        err = target - (m[0] + ac[0]) / 2
        if abs(err) > 0.05:
            gain += err
            continue
        if ac[1] > tpmax - 0.05:
            ceil -= 0.2
            continue
        break
    ok = abs(m[0] - target) <= 0.2 and abs(ac[0] - target) <= 0.2 and m[1] <= tpmax and ac[1] <= tpmax
    if not ok:
        raise Failed('the master is out of spec: WAV %.1f LUFS / TP %.1f dBTP, after AAC %.1f LUFS / TP %.1f dBTP (gain %.2f dB, ceiling %.1f dBFS)'
                        % (m[0], m[1], ac[0], ac[1], gain, ceil))
    return out, 'stems %s + %s, mastered: WAV %.1f LUFS / TP %.1f, after AAC %.1f LUFS / TP %.1f dBTP (gain %+.2f dB, limiter %.1f dBFS)' % (
        a.keep or '-', ', '.join(map(os.path.basename, a.add or [])) or '-', m[0], m[1], ac[0], ac[1], gain, ceil)


# ── QA ──
def qa(out, master, N, O, P, S, expect, a, mp=None, starts=None):
    rows, info = [], probe(out)
    V = info['video']
    n_out = count_frames(info)
    rows.append(('frames', n_out == N, '%d frames (want %d)' % (n_out, N)))
    rows.append(('duration', abs(info['duration'] - N / float(O)) <= 1.0 / float(O), '%.3f s (want %.3f)' % (info['duration'], N / float(O))))
    tags = run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=color_primaries,color_transfer,color_space', '-of', 'csv=p=0', out],
               'ffprobe tags', text=True).strip()
    rows.append(('bt709', tags.split(',') == ['bt709'] * 3, 'colour tags %s' % tags))
    g = small_gray(out)
    mP, mS, d = find_pattern(g)
    want = expect or (P, S)
    if want == (1, ()) and not expect:                          # --cadence none and no reference: nothing to hold the output to
        rows.append(('cadence', True, 'none built (a straight decimation); measured %s — the content\'s own, no --ref to check it against'
                     % (fmt_pattern(mP, mS) if mP else 'none')))
    elif want == (1, ()):
        rows.append(('cadence', mP is None, 'the reference has no repeat cadence; measured %s%s'
                     % ((fmt_pattern(mP, mS), ' — NOT the reference\'s') if mP else ('none', ''))))
    else:
        on, slots, extra = slot_stats(d, *want)
        rows.append(('cadence', same_pattern((mP, mS), want) and on >= 0.98 * slots,
                     'repeats on %s slots %d/%d, extra holds %d; measured %s%s' % (fmt_pattern(*want), on, slots, extra, fmt_pattern(mP, mS) if mP else 'none',
                                                                                   '' if same_pattern((mP, mS), want) else ' — NOT the reference\'s')))
    if mp is None and os.path.isfile(master or ''):
        mp, _ = index_map(N, P, S, Fraction(probe(master)['video']['rate']), O, starts)
    if mp is not None and os.path.isfile(master or ''):
        mg = small_gray(master)
        h, w = g.shape[1:]
        cy, cx = slice(int(h * .32), int(h * .68)), slice(int(w * .25), int(w * .75))      # clear of corner bugs

        def z(f):                                   # zero-mean, unit-norm: NCC ignores the global brightness and contrast
            f = f[cy, cx].astype(np.float64)        # shifts x264 makes on fades and flashes (a pulse) — not the structure
            f -= f.mean()
            return f / (np.sqrt((f * f).sum()) or 1.0)
        zm = {}
        good = tot = 0
        for n in range(1, min(N, len(g))):
            if mp[n][0] == mp[n - 1][0]:
                continue
            j = min(mp[n][1], len(mg) - 1)
            zo = z(g[n])
            sc = {}
            for jj in (j - 1, j, j + 1):
                jj = min(max(jj, 0), len(mg) - 1)
                if jj not in zm:
                    zm[jj] = z(mg[jj])
                sc[jj] = float((zo * zm[jj]).sum())
            tot += 1
            good += sc[j] >= max(sc.values()) - 0.002
        rows.append(('picks', good >= 0.995 * tot, '%d/%d frames match the master frame they were taken from (NCC vs ±1)' % (good, tot)))
    if info['audio']:
        I, TP = loudness(out)
        rows.append(('loudness', abs(I - a.lufs) <= 0.3, '%.1f LUFS (want %.1f ±0.3, the mp4\'s AAC)' % (I, a.lufs)))
        rows.append(('true peak', TP <= a.tp + 0.05, '%.1f dBTP (want ≤ %.1f)' % (TP, a.tp)))
    for k, ok, msg in rows:
        print('  %s %-9s %s' % ('✓' if ok else '✗', k, msg))
    return all(ok for _, ok, _ in rows)


def main():
    ap = argparse.ArgumentParser(description="Finish a recreation like its reference: cadence by index, corner bug, stems re-mix, QA.")
    ap.add_argument('--master'); ap.add_argument('--out')
    ap.add_argument('--cuts', help='each shot\'s start: a timeline.json (default: <master folder>/out/main/timeline.json), the '
                    'shot starts in output frames (cuts.json, breakdown.json, "348 label" lines, 348,364,…), or none (one clock)')
    ap.add_argument('--ref', help='the reference: its repeat cadence is measured, built and checked')
    ap.add_argument('--pattern', help='PERIOD:SLOTS, e.g. 15:5,10,14 (overrides --ref for the build; QA still checks --ref)')
    ap.add_argument('--cadence', choices=['pattern', 'none'], default='pattern')
    ap.add_argument('--fps', default='30', help='the output rate (default 30)')
    ap.add_argument('--frames', type=int, help='output frames (default: the master\'s duration × fps)')
    ap.add_argument('--bug', help='a corner-bug clock spec (e.g. corner-bug-hf01.json)')
    ap.add_argument('--bug-glyph'); ap.add_argument('--bug-text')
    ap.add_argument('--stems', help='the engine\'s stems (default: <master folder>/out/main/audio)')
    ap.add_argument('--keep', help='stems to re-mix, e.g. music or music,points,whoosh')
    ap.add_argument('--add', nargs='*', help='more WAVs to mix in (recreate/sfx.py)')
    ap.add_argument('--no-audio', action='store_true')
    ap.add_argument('--lufs', type=float, default=-14.0); ap.add_argument('--tp', type=float, default=-1.0)
    ap.add_argument('--crf', type=int, default=16, help='x264 quality (default 16, as the engine\'s masters; 0 = lossless)')
    ap.add_argument('--measure', metavar='REF', help='print REF\'s repeat cadence and exit')
    ap.add_argument('--qa', metavar='OUT', help='QA a finished file only (with --master and --ref/--pattern)')
    a = ap.parse_args()
    try:
        O = Fraction(a.fps)
    except (ValueError, ZeroDivisionError):
        raise UserError('--fps %s: give the output rate, e.g. 30' % a.fps)
    if a.measure:
        P, S, d = find_pattern(small_gray(a.measure))
        if not P:
            print('%s: no repeat cadence (every frame changes, or the holds are irregular)' % a.measure)
            return 0
        on, slots, extra = slot_stats(d, P, S)
        print('%s: %s — %d of %d slots repeat; %d other repeats (holds); edit rate %s fps in %s fps' % (
            a.measure, fmt_pattern(P, S), on, slots, extra, O * (P - len(S)) / P, O))
        return 0
    expect = None
    if a.ref:
        rP, rS, _ = find_pattern(small_gray(a.ref))
        expect = (rP, rS) if rP else (1, ())
        print('reference cadence: %s (%s)' % (fmt_pattern(*expect), a.ref))
    if a.cadence == 'none':
        P, S = 1, ()
    elif a.pattern:
        P, S = parse_pattern(a.pattern)
    elif expect:
        P, S = expect
    else:
        raise UserError('give --ref REF.mp4 (its cadence is measured), --pattern 15:5,10,14, or --cadence none')
    if a.qa:
        if not a.master:
            raise UserError('--qa needs --master (the frames are checked against it)')
        N = a.frames or int(round(probe(a.qa)['duration'] * O))
        starts, where = shot_starts(a, a.master, P, Fraction(probe(a.master)['video']['rate']), O)
        print('shots: %s' % where)
        return 0 if qa(a.qa, a.master, N, O, P, S, expect, a, starts=starts) else 1
    if not a.master or not a.out:
        raise UserError('give --master (lv.mjs --film\'s 60 fps master) and --out')
    if os.path.splitext(a.out)[1].lower() not in ('.mp4', '.mov', '.m4v'):
        raise UserError('%s: the output is an H.264 movie — name it .mp4' % a.out)
    if a.bug and not (a.bug_glyph or a.bug_text):
        raise UserError('--bug needs its sprites: --bug-glyph (and --bug-text)')
    if a.no_audio and (a.keep or a.add):
        raise UserError('--no-audio leaves the soundtrack out: drop --keep / --add, or --no-audio')
    info = probe(a.master)
    stems, ains = (None, []) if a.no_audio else audio_inputs(a, a.master)
    Fm = Fraction(info['video']['rate'] or '0')
    N = a.frames or int(round(info['duration'] * O))
    ins = [a.master] + [x for x in (a.ref, a.bug, a.bug_glyph, a.bug_text, a.cuts) if x and x != 'none' and os.path.isfile(x)] + ains
    guard_outputs([a.out], ins)
    starts, where = shot_starts(a, a.master, P, Fm, O)
    tmp = tempfile.mkdtemp(prefix='finish-')
    t = temp_beside(a.out)
    try:
        print('cadence %s at %s fps from a %s fps master: %d frames; %s' % (fmt_pattern(P, S), O, info['video']['rate'], N, where))
        v = build_video(a.master, os.path.join(tmp, 'video.mp4'), N, P, S, O,
                        (a.bug, a.bug_glyph, a.bug_text) if a.bug else None, tmp, a.crf, starts)
        print('video: edit rate %s fps, every shot on its own clock%s%s' % (
            v['M'], ', corner bug %s' % os.path.basename(a.bug) if a.bug else '',
            ', %d frames held at the end (the master ran out)' % v['held'] if v['held'] else '') if starts is not None else
            'video: edit rate %s fps, one clock%s%s' % (v['M'], ', corner bug %s' % os.path.basename(a.bug) if a.bug else '',
                                                        ', %d frames held at the end (the master ran out)' % v['held'] if v['held'] else ''))
        cl = v['clamped']
        if cl:
            print('  %d frame(s) kept inside their shot (more edit frames than its master frames hold: each repeats a picture): %s'
                  % (len(cl), ' '.join('n%d' % n for n in cl[:20]) + (' …' if len(cl) > 20 else '')))
        if starts is not None and P > 1:
            slot = [n for n in (math.ceil(Fraction(f) * O / Fm) for f in starts if f > 0) if n < N and n % P in S]
            if slot:
                print('  note: %s start on repeat slots — each such cut lands on its slot, which then shows the new shot' % ' '.join('n%d' % n for n in slot))
        elif P > 1 and early_residues(P, S, Fm, O):
            print('  one clock: a shot starting at n/%s s with n %% %d in {%s} judders (skip one plate frame, hold one) and its cut lands '
                  'a frame early (RECREATE.md §8)' % (O, P, ','.join(map(str, early_residues(P, S, Fm, O)))))
        if a.no_audio:
            shutil.copyfile(os.path.join(tmp, 'video.mp4'), t)
        else:
            wav, what = build_audio(a, stems, ains, a.master, N / float(O), tmp)
            print('audio: %s' % what)
            ff(['-i', os.path.join(tmp, 'video.mp4'), '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k',
                '-ar', str(SR), '-t', '%.6f' % (N / float(O)), '-movflags', '+faststart', t], 'the mux')
        publish(t, a.out)
    except BaseException:
        discard(t)
        raise
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print('QA %s' % a.out)
    ok = qa(a.out, a.master, N, O, P, S, expect, a, v['map'], starts)
    print('→ %s%s' % (a.out, '' if ok else '  (QA FAILED)'))
    return 0 if ok else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except UserError as e:
        sys.stderr.write('\n✗ %s\n' % e)
        sys.exit(1 if isinstance(e, Failed) else 2)
