# -*- coding: utf-8 -*-
# Independent evaluators for tool outputs (black-box: they read only the files a tool wrote and the fixtures' truth).
# Each returns (ok, detail). The self-test feeds them planted-bad artifacts to prove every one of them can FAIL.
import os, sys, re, json, math, subprocess
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness as H
import barcode as BC


def luma(a):
    a = a.astype(np.float64)
    return a[..., 0] * .2126 + a[..., 1] * .7152 + a[..., 2] * .0722


def thumb(gray, w=96, h=54):
    return np.asarray(Image.fromarray(gray.astype(np.uint8)).resize((w, h), Image.BILINEAR), np.float64)


def ncc(a, b):
    a = a - a.mean(); b = b - b.mean()
    return float((a * b).sum() / (math.sqrt((a * a).sum() * (b * b).sum()) + 1e-9))


# ── stream properties ──
def stream_props(path):
    v, a, fmt = H.video_stream(path)
    if v is None: return None
    fr = v.get('r_frame_rate', '0/1').split('/')
    return {'w': int(v['width']), 'h': int(v['height']), 'fps': float(fr[0]) / float(fr[1] or 1), 'pix_fmt': v.get('pix_fmt'),
            'prim': v.get('color_primaries'), 'trc': v.get('color_transfer'), 'space': v.get('color_space'), 'audio': len(a),
            'frames': H.count_frames(path)}


def check_props(p, n=None, fps=None, size=None, audio=False, bt709=True, yuv420p=True):
    bad = []
    if p is None: return False, 'no video stream'
    if n is not None and p['frames'] != n: bad.append('%d frames (want %d)' % (p['frames'], n))
    if fps is not None and abs(p['fps'] - fps) > 1e-3: bad.append('%.3f fps (want %g)' % (p['fps'], fps))
    if size and (p['w'], p['h']) != tuple(size): bad.append('%dx%d (want %dx%d)' % (p['w'], p['h'], size[0], size[1]))
    if audio is False and p['audio']: bad.append('%d audio stream(s) (want none)' % p['audio'])
    if bt709 and not (p['prim'] == p['trc'] == p['space'] == 'bt709'): bad.append('colour tags %s/%s/%s (want bt709)' % (p['prim'], p['trc'], p['space']))
    if yuv420p and p['pix_fmt'] != 'yuv420p': bad.append('pix_fmt %s (want yuv420p)' % p['pix_fmt'])
    return not bad, '; '.join(bad) or '%d frames %dx%d @%g fps %s %s, no audio' % (p['frames'], p['w'], p['h'], p['fps'], p['pix_fmt'], p['prim'])


# ── conform: which source frame is each output frame? ──
def cover_map(sw, sh, size):
    """scale-to-cover + centre crop: source (x,y) → output (x*s+ox, y*s+oy)"""
    if not size: return 1.0, 0.0, 0.0
    W, H_ = size; s = max(W / float(sw), H_ / float(sh))
    return s, (W - sw * s) / 2.0, (H_ - sh * s) / 2.0


def frame_indices(path, bc, src_wh, size=None, frames=None):
    fr = frames if frames is not None else H.decode_frames(path)
    if fr is None: return None, None
    s, ox, oy = cover_map(src_wh[0], src_wh[1], size)
    return [BC.decode(f, sx=s, sy=s, ox=ox, oy=oy, **bc) for f in fr], fr


def cadence_eval(idx, n, start_idx, src_fps, out_fps):
    """idx: decoded source index per output frame (None = unreadable/blended)"""
    if idx is None: return False, 'no frames decoded'
    if len(idx) != n: return False, '%d frames (want %d)' % (len(idx), n)
    if any(i is None for i in idx):
        bad = [j for j, i in enumerate(idx) if i is None]
        return False, '%d frame(s) are not a clean source frame (blend/interpolation?) e.g. out %s' % (len(bad), bad[:6])
    steps = np.diff(idx)
    if not set(steps.tolist()) <= {0, 1}: return False, 'not native speed: source steps %s (want only 0/1)' % sorted(set(steps.tolist()))[:8]
    if abs(idx[0] - start_idx) > 1: return False, 'first frame is source #%d (want #%d for the start offset)' % (idx[0], start_idx)
    if src_fps == 24 and out_fps == 30:
        z = (steps == 0).astype(int)                         # exactly one repeat in every run of 5 consecutive frame steps
        wins = [int(z[j:j + 5].sum()) for j in range(0, len(z) - 4)]
        if any(w != 1 for w in wins): return False, 'cadence: %d run(s) of 5 frame steps without exactly one repeat (e.g. at out %d; repeats at %s)' % (sum(w != 1 for w in wins), [j for j, w in enumerate(wins) if w != 1][0], [int(j) + 1 for j in np.nonzero(z)[0]][:8])
        return True, 'source #%d…#%d, 1 repeat in every 5 frames (at out %s…), no blends' % (idx[0], idx[-1], [int(j) + 1 for j in np.nonzero(z)[0]][:3])
    if src_fps == out_fps:
        if any(steps != 1): return False, 'repeats/drops at %s' % [j for j, s in enumerate(steps) if s != 1][:6]
        return True, 'source #%d…#%d one-to-one' % (idx[0], idx[-1])
    return True, 'source #%d…#%d' % (idx[0], idx[-1])


def pixels_match_source(out_frames, idx, src_frames, size=None, tol=8.0):
    """every output frame ≈ its source frame (after the same cover crop): catches blends the barcode can't see"""
    worst = (0, -1)
    for j, (f, k) in enumerate(zip(out_frames, idx)):
        if k is None or k >= len(src_frames): continue
        s = src_frames[k]
        if size and (s.shape[1], s.shape[0]) != tuple(size):
            sc, ox, oy = cover_map(s.shape[1], s.shape[0], size)
            im = Image.fromarray(s).resize((int(round(s.shape[1] * sc)), int(round(s.shape[0] * sc))), Image.BICUBIC)
            s = np.asarray(im)[int(round(-oy)):int(round(-oy)) + size[1], int(round(-ox)):int(round(-ox)) + size[0]]
        if s.shape != f.shape: return False, 'size mismatch %s vs %s' % (s.shape, f.shape)
        d = np.abs(luma(f) - luma(s))[: int(f.shape[0] * .78)].mean()          # above the barcode strip
        if d > worst[0]: worst = (d, j)
    return worst[0] <= tol, 'worst frame %d differs from its source frame by %.2f (tol %.1f)' % (worst[1], worst[0], tol)


# ── pin: the screen goes only where the phone is black ──
def _poly_mask(W, H_, pts, grow=0.0):
    c = np.mean(pts, 0); q = [(c + (np.array(p) - c) * (1 + grow / max(1e-6, np.linalg.norm(np.array(p) - c)))) for p in pts]
    im = Image.new('L', (W, H_), 0); ImageDraw.Draw(im).polygon([tuple(x) for x in q], fill=255)
    return np.asarray(im) > 127


def _offset_poly(pts, d):
    """grow (+) / shrink (−) a convex quad by d px along its edge normals"""
    P = np.array(pts, float); c = P.mean(0); out = []
    n = len(P)
    lines = []
    for i in range(n):
        a, b = P[i], P[(i + 1) % n]; t = b - a; nrm = np.array([t[1], -t[0]]) / (np.linalg.norm(t) + 1e-9)
        if np.dot(nrm, a - c) < 0: nrm = -nrm
        lines.append((a + nrm * d, t))
    for i in range(n):
        (p1, t1), (p2, t2) = lines[i - 1], lines[i]
        A = np.array([t1, -t2]).T; s = np.linalg.solve(A, p2 - p1); out.append(p1 + t1 * s[0])
    return out


def _mask(W, H_, pts, d=0.0):
    im = Image.new('L', (W, H_), 0); ImageDraw.Draw(im).polygon([tuple(x) for x in (_offset_poly(pts, d) if d else pts)], fill=255)
    return np.asarray(im) > 127


def _capsule(W, H_, T, D, L, r):
    yy, xx = np.mgrid[0:H_, 0:W].astype(np.float64)
    ax, ay = xx - T[0], yy - T[1]; t = np.clip(ax * D[0] + ay * D[1], 0, L)
    return np.hypot(ax - t * D[0], ay - t * D[1]) <= r


def pin_eval(out_path, truth, src_frames, out_frames=None, scale=1.0):
    """out_path: pinned clip (same geometry as the fixture, or scaled by `scale`); truth: phone24 truth.json"""
    fr = out_frames if out_frames is not None else H.decode_frames(out_path)
    if fr is None or not len(fr): return {'ok': False, 'detail': 'no frames'}
    Hh, Ww = fr[0].shape[:2]
    bc = truth['barcode']; pf = truth['per_frame']
    fails = {'outside': [], 'bezel': [], 'finger': [], 'inside': [], 'orient': [], 'id': []}
    worst = {'outside': 0, 'bezel': 0, 'finger': 0, 'inside_luma': 999}
    for j, f in enumerate(fr):
        k = BC.decode(f, sx=scale, sy=scale, **bc)
        if k is None or k >= len(pf): fails['id'].append(j); continue
        t = pf[k]; S = [np.array(p) * scale for p in t['screen_corners']]
        src = src_frames[k]
        if scale != 1.0: src = np.asarray(Image.fromarray(src).resize((Ww, Hh), Image.BICUBIC))
        L_out, L_src = luma(f), luma(src)
        diff = np.abs(f.astype(np.float64) - src.astype(np.float64)).mean(2)
        fin = _capsule(Ww, Hh, np.array(t['finger']['tip']) * scale, t['finger']['dir'], t['finger']['len'] * scale, t['finger']['r'] * scale)
        fin_out = _capsule(Ww, Hh, np.array(t['finger']['tip']) * scale, t['finger']['dir'], t['finger']['len'] * scale, (t['finger']['r'] + 6) * scale)
        fin_in = _capsule(Ww, Hh, np.array(t['finger']['tip']) * scale, t['finger']['dir'], t['finger']['len'] * scale, max(1, t['finger']['r'] - 4) * scale)
        bez = truth['bezel'] * scale
        far = ~_mask(Ww, Hh, S, bez + 6 * scale)                                   # beyond the phone body
        bc_strip = np.zeros_like(far); bc_strip[int((bc['y0'] - 6) * scale):, :] = True
        o = diff[far & ~bc_strip]
        mo = float(o.mean()) if o.size else 0
        if mo > 3.0 or (o.size and np.percentile(o, 99.5) > 40): fails['outside'].append(j)
        worst['outside'] = max(worst['outside'], mo)
        ring = _mask(Ww, Hh, S, bez - 2.5 * scale) & ~_mask(Ww, Hh, S, 3.5 * scale) & ~fin_out
        b = diff[ring]; mb = float(b.mean()) if b.size else 0
        if mb > 8.0: fails['bezel'].append(j)
        worst['bezel'] = max(worst['bezel'], mb)
        scr = _mask(Ww, Hh, S, 0)
        fz = fin_in & _mask(Ww, Hh, S, -6 * scale)
        if fz.sum() > 50:
            mf = float(diff[fz].mean())
            if mf > 12.0: fails['finger'].append(j)
            worst['finger'] = max(worst['finger'], mf)
        inner = _mask(Ww, Hh, S, -10 * scale) & ~fin_out
        if inner.sum() < 500: fails['inside'].append(j); continue
        li = float(L_out[inner].mean())
        worst['inside_luma'] = min(worst['inside_luma'], li)
        dark_left = float((L_out[inner] < 30).mean())
        if li < 50 or dark_left > .05: fails['inside'].append(j)
        # orientation: sample the middle of each quadrant (screen-local u,v), under the header band
        P0, P1, P2, P3 = S                                  # TL TR BR BL
        def at(u, v): return (P0 * (1 - u) * (1 - v) + P1 * u * (1 - v) + P2 * u * v + P3 * (1 - u) * v)
        band = truth['screen_png']['band_frac']
        want = truth['screen_png']['quadrants']
        for name, (u0, v0) in (('TL', (.25, band + (.5 - band) / 2)), ('TR', (.75, band + (.5 - band) / 2)), ('BL', (.25, .75)), ('BR', (.75, .75))):
            x, y = at(u0, v0); xi, yi = int(round(x)), int(round(y)); r = int(14 * scale)
            box = (slice(max(0, yi - r), yi + r), slice(max(0, xi - r), xi + r))
            if fin_out[box].mean() > .05: continue
            m = f[box].reshape(-1, 3).mean(0); w = np.array(want[name], float)
            if np.argmax(m) != np.argmax(w) or np.linalg.norm(m / (m.sum() + 1e-6) - w / w.sum()) > .25:
                fails['orient'].append((j, name)); break
    n = len(fr)
    parts = []
    for k2, lab in (('id', 'unidentified frames'), ('outside', 'pixels changed outside the phone'), ('bezel', 'bezel (not black) overwritten'),
                    ('finger', 'finger overwritten'), ('inside', 'screen not filled'), ('orient', 'screen upside down / mirrored')):
        if fails[k2]: parts.append('%s in %d/%d frames (e.g. %s)' % (lab, len(fails[k2]), n, fails[k2][:3]))
    ok = not parts
    det = '; '.join(parts) if parts else '%d frames: outside Δ≤%.2f, bezel Δ≤%.2f, finger Δ≤%.2f, screen luma ≥%.0f, orientation right' % (
        n, worst['outside'], worst['bezel'], worst['finger'], worst['inside_luma'])
    return {'ok': ok, 'detail': det, 'fails': {k: len(v) for k, v in fails.items()}}


# ── side-by-side frame lock: frame i = ref i | ours i ──
def sbs_lock(sbs_path, ref_path, ours_path, start=0, half_speed=None, bc=None, label_frac=.42, ostep=1):
    """frame i of the side-by-side must show ref frame i | ours frame i (decoded by index); judged by thumbnail distance
    to frames i-1, i, i+1 (held/blank neighbours that look the same never count) and, on fixtures, by the burnt-in barcode"""
    S = H.decode_frames(sbs_path, fmt='gray')
    R = H.decode_frames(ref_path, fmt='gray'); O = H.decode_frames(ours_path, fmt='gray')
    if S is None or R is None or O is None: return False, 'could not decode', {}
    n, Hs, Ws = S.shape
    wl = int(round(R.shape[2] * Hs / float(R.shape[1])))
    if abs(wl * 2 - Ws) > 4 and abs(wl + int(round(O.shape[2] * Hs / float(O.shape[1]))) - Ws) > 4:
        return False, 'side-by-side is %dx%d: halves don\'t add up (%d + ours)' % (Ws, Hs, wl), {}
    nsrc = min(len(R), len(O) // ostep) - start                   # ostep: ours at an integer multiple of the reference fps
    if half_speed is None: half_speed = n >= 2 * nsrc - 2 and n > nsrc + 2
    k0 = int(54 * label_frac)
    tR = [thumb(f)[k0:] for f in R]; tO = [thumb(f)[k0:] for f in O]
    codes = {}
    if bc:
        codes['ref'] = [BC.decode(f, **bc) for f in R]; codes['ours'] = [BC.decode(f, **bc) for f in O]
    bad, ids = [], []
    for i in range(n):
        want = start + (i // 2 if half_speed else i)
        for side, sl, T, src in (('ref', slice(0, wl), tR, R), ('ours', slice(wl, Ws), tO, O)):
            w_ = want * (ostep if side == 'ours' else 1)
            if w_ >= len(T): bad.append((i, side, 'no source frame %d' % w_)); continue
            half = thumb(S[i][:, sl])[k0:]
            dist = {j: float(np.abs(half - T[j]).mean()) for j in (w_ - 1, w_, w_ + 1) if 0 <= j < len(T)}
            best = min(dist, key=dist.get)
            if best != w_ and dist[w_] - dist[best] > .5 and np.abs(T[best] - T[w_]).mean() >= 1.5: bad.append((i, side, best))
            if bc:
                sc = Hs / float(src.shape[1]); code = BC.decode(S[i][:, sl], sx=sc, sy=sc, **bc)
                exp = codes[side][w_]
                if code is not None and exp is not None and code != exp: ids.append((i, side, code, exp))
    detail = '%d frames%s; %d half(s) off their frame by thumbnail%s' % (n, ' (half speed)' if half_speed else '', len(bad), (', %d by barcode' % len(ids)) if bc else '')
    if bad[:3] or ids[:3]: detail += ' e.g. %s' % (bad[:3] + ids[:3])
    return (not bad and not ids), detail, {'n': n, 'half_speed': half_speed, 'bad': len(bad) + len(ids)}


# ── audio ──
def rms_db(x, sr, t0, t1):
    s = x[max(0, int(t0 * sr)):int(t1 * sr)]
    return 20 * math.log10(math.sqrt(float((s ** 2).mean())) + 1e-12) if len(s) else -999.0


def band_db(x, sr, t0, t1, lo, hi):
    s = x[max(0, int(t0 * sr)):int(t1 * sr)]
    if len(s) < 256: return -999.0
    X = np.abs(np.fft.rfft(s * np.hanning(len(s)))) ** 2; F = np.fft.rfftfreq(len(s), 1.0 / sr)
    return 10 * math.log10(X[(F >= lo) & (F < hi)].sum() / len(s) + 1e-20)


def onsets(x, sr, lo=4000, hi=11000, n=1024, hop=128):
    w = np.hanning(n); fr = np.lib.stride_tricks.sliding_window_view(x, n)[::hop] * w
    S = np.abs(np.fft.rfft(fr, axis=1)); F = np.fft.rfftfreq(n, 1.0 / sr); sel = (F >= lo) & (F < hi)
    m = np.log1p(100 * S[:, sel]); fl = np.r_[0, np.maximum(np.diff(m, axis=0), 0).sum(1)]
    t = (np.arange(len(fl)) * hop + n / 2.0) / sr
    thr = np.median(fl) + 3 * fl.std()
    pk = [i for i in range(1, len(fl) - 1) if fl[i] > thr and fl[i] >= fl[i - 1] and fl[i] > fl[i + 1]]
    return t[pk], fl[pk]


def grid_err(t, downbeat, beat, div=4):
    q = beat / div; e = ((t - downbeat) / q) % 1.0
    return np.minimum(e, 1 - e) * q


def first_onset_after(x, sr, t0, t1, frac=.3):
    hop = int(.002 * sr); s = x[int(t0 * sr):int(t1 * sr)]
    env = np.array([np.abs(s[i:i + hop]).max() for i in range(0, len(s) - hop, hop)])
    if not len(env) or env.max() <= 0: return None
    return t0 + int(np.argmax(env > frac * env.max())) * hop / float(sr)


def parse_tempo(text):
    m = re.search(r'([\d.]+) BPM \(confidence ([\d.]+).*?beat ([\d.]+) s · first beat ([\d.]+) s(?: · first downbeat ([\d.]+) s)?', text)
    if not m: return None
    return {'bpm': float(m.group(1)), 'confidence': float(m.group(2)), 'beat': float(m.group(3)), 'first': float(m.group(4)), 'downbeat': float(m.group(5)) if m.group(5) else None}


def tempo_on_grid(tm, bpm, downbeat, tol_bpm=.15, tol_s=.035, conf=.6):
    if not tm: return False, 'no tempo reading'
    beat = 60.0 / bpm
    e = float(grid_err(np.array([tm['first']]), downbeat, beat, div=1)[0])
    ok = abs(tm['bpm'] - bpm) <= tol_bpm and e <= tol_s and tm['confidence'] >= conf
    return ok, 'reads %.2f BPM (grid %.2f), first beat %.4f s → %.1f ms off the grid (downbeat %.4f), confidence %.2f' % (tm['bpm'], bpm, tm['first'], e * 1000, downbeat, tm['confidence'])


# ── temp track ──
def temptrack_eval(out, film, ref):
    bad = []
    if not out or not os.path.exists(out): return False, 'no output file'
    if not out.endswith('-tempmusic-PRIVATE.mp4'): bad.append('name %s lacks -tempmusic-PRIVATE.mp4' % os.path.basename(out))
    pa, pr = H.stream_md5(out, '0:a'), H.stream_md5(ref, '0:a')
    if pa is None or pa != pr: bad.append('decoded audio md5 %s ≠ reference %s' % (pa, pr))
    va, vf = H.stream_md5(out, '0:v', copy=True), H.stream_md5(film, '0:v', copy=True)
    if va is None or va != vf: bad.append('video packets md5 %s ≠ ours %s' % (va, vf))
    ja, jr = H.ffprobe_json(out), H.ffprobe_json(ref)
    sa = [s for s in ja.get('streams', []) if s.get('codec_type') == 'audio']; sr = [s for s in jr.get('streams', []) if s.get('codec_type') == 'audio']
    if not sa or not sr or (sa[0].get('start_pts'), sa[0].get('start_time')) != (sr[0].get('start_pts'), sr[0].get('start_time')):
        bad.append('audio start %s/%s ≠ reference %s/%s' % (sa and sa[0].get('start_pts'), sa and sa[0].get('start_time'), sr and sr[0].get('start_pts'), sr and sr[0].get('start_time')))
    tags = {k.lower(): str(v) for k, v in ja.get('format', {}).get('tags', {}).items()}
    if not re.search(r'private', tags.get('title', '') + ' ' + tags.get('comment', ''), re.I): bad.append('title/comment metadata don\'t say private (%s)' % {k: tags.get(k) for k in ('title', 'comment')})
    return not bad, '; '.join(bad) or 'PCM == reference (%s…), video packets == ours (%s…), same audio start, metadata marks it private' % (pa[:8], va[:8])


# ── cut report parsing (schema-agnostic) ──
def parse_cut_summary(text):
    m = re.search(r'cuts?:\s*(\d+)\s+in the reference', text)
    if not m: return None
    seg = text[m.start():m.start() + 400].split('\n')[0]
    g = lambda pat: int(re.search(pat, seg).group(1)) if re.search(pat, seg) else 0
    return {'ref': int(m.group(1)), 'exact': g(r'(\d+)\s+exact'), 'within1': g(r'(\d+)\s+within'), 'off': g(r'(\d+)\s+off'), 'missing': g(r'(\d+)\s+missing'), 'line': seg.strip()}


def cut_records(obj):
    """the list of per-cut dicts in cuts.json, whatever it is called"""
    best = None
    def walk(o):
        nonlocal best
        if isinstance(o, list) and o and all(isinstance(x, dict) for x in o):
            if any(any(re.search('status', k, re.I) for k in x) for x in o) and (best is None or len(o) > len(best)): best = o
            for x in o: walk(x)
        elif isinstance(o, dict):
            for v in o.values(): walk(v)
    walk(obj)
    return best or []


def rec_frame(r):
    for k in ('ref', 'n', 'frame', 'ref_frame', 'cut', 'at', 'f'):
        for kk, v in r.items():
            if kk.lower() == k and isinstance(v, (int, float)) and not isinstance(v, bool): return int(v)
    for kk, v in r.items():
        if re.search(r'(ref|frame|^n$)', kk, re.I) and isinstance(v, (int, float)) and not isinstance(v, bool): return int(v)
    return None


def rec_offset(r):
    for kk, v in r.items():
        if re.search(r'offset|delta|^d$|diff', kk, re.I) and isinstance(v, (int, float)) and not isinstance(v, bool): return int(v)
    return None


def rec_trivial(r):
    for kk, v in r.items():
        if re.search(r'trivial', kk, re.I): return bool(v)
    return None


def rec_status(r):
    for kk, v in r.items():
        if re.search('status', kk, re.I): return str(v)
    return ''
