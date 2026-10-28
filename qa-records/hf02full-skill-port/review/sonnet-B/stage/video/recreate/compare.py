# -*- coding: utf-8 -*-
# Reference vs ours, frame for frame: a side-by-side, a cut report and a contact sheet.
#
#   python3 compare.py --ref REF.mp4 --ours OURS.mp4 --out DIR [--from S] [--to S] [--half] [--audio ref|ours|none]
#                      [--label-ref TEXT] [--label-ours TEXT] [--cuts-from FILE] [--no-video] [--verify SBS.mp4]
#
#   DIR/sbs.mp4      output frame i = reference frame i | our frame i, both decoded by INDEX and scaled to one height
#                    (never ffmpeg hstack: it re-times irregular timestamps and slips frames). After encoding it is
#                    decoded back and every frame's halves are checked against the sources' frames i−1, i, i+1:
#                    "verify: N/N frames exact". --half: sbs-half.mp4 at half speed. --audio: whose soundtrack plays
#                    (default ours). --verify FILE re-checks a side-by-side made from the same inputs and range.
#   DIR/cuts.json, cuts.md   every reference cut, our biggest picture change within ±4 frames of it and the offset:
#                    exact / ±1 / off / missing; "trivial" when a neighbouring shot of ours is near-blank (a cut next to
#                    a blank shot matches for free); "check" when the offset says off but the two change curves line up
#                    (motion next to the cut won the peak — look at DIR/cuts/cut-nNNNN.png before calling it off).
#   DIR/sheet.png    every reference shot's middle frame, reference over ours, with shot number and timecode.
#
# --from/--to: seconds (12.5) or frames (n375). --cuts-from: the skill's breakdown.json (lv.mjs --breakdown), a cuts.json
# from an earlier run, or a list of reference cut frames (JSON [75, 97] or text lines "75 lockup > corridor"); without it
# the reference's cuts are detected here (hard cuts and the peak of a dissolve; a fallback — element whips can read as
# cuts and momentum cuts between near-identical screens can be missed).
# sbs.mp4 and sheet.png show the reference's own frames: private review only, never a deliverable.
# exit 0 done · 1 the side-by-side failed its frame check · 2 bad input (missing file, no video, frame rates differ …)
import os, sys, json, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True                  # no __pycache__ inside the skill
import media
from media import np, Image, ImageDraw, UserError
import subprocess

AN = 270                 # analysis thumbnails: long side (px), luma
WIN = 4                  # ± frames searched around each reference cut
BLANK = 2.0              # thumbnail luma std under which a frame counts as blank


# ── analysis: per-frame change on small grey thumbnails ──
def ncc(a, b):
    x = a - a.mean(); y = b - b.mean(); d = np.sqrt((x * x).sum() * (y * y).sum())
    return float((x * y).sum() / d) if d > 1e-3 else (1.0 if np.abs(a - b).mean() < 1 else 0.0)


def series(path, size, keep=False):
    """per frame n ≥ 1: change score vs frame n−1 (1 − NCC + MAD/30), luma std; optionally every thumbnail. Next to a
    blank frame NCC means nothing: a textured frame ↔ a blank one counts as a full change (1 + MAD/30), two blank or
    faint frames (a fade crossing the threshold) by their level change alone"""
    s, sd, kept, prev = [0.0], [], [], None
    for f in media.frames(path, size, 'gray', flags='area'):
        a = f.astype(np.float32)
        sd.append(float(a.std()))
        if prev is not None:
            mad = float(np.abs(a - prev).mean())
            lo, hi = min(sd[-1], sd[-2]), max(sd[-1], sd[-2])
            s.append(max(0.0, 1 - ncc(a, prev)) + mad / 30 if lo >= BLANK else (1 if hi >= 3 * BLANK else 0) + mad / 30 * (1 if hi >= BLANK else 2))
        if keep:
            kept.append(f)
        prev = a
    return np.array(s), np.array(sd), (np.stack(kept) if keep and kept else None)


def thumb_size(P, long=AN):
    w, h = P['video']['w'], P['video']['h']
    return (long, max(2, int(round(long * h / w / 2)) * 2)) if w >= h else (max(2, int(round(long * w / h / 2)) * 2), long)


# ── the reference's cuts when none are given: hard cuts that stand out from their neighbourhood and don't continue
# the picture under a global zoom/shift (an element whipping over a held picture, a pan, a push-in) ──
def _warp(img, s, dx, dy, grid):
    yy, xx, cy, cx = grid; H, W = img.shape
    u = (xx - cx - dx) / s + cx; v = (yy - cy - dy) / s + cy
    u0 = np.floor(u).astype(np.int32); v0 = np.floor(v).astype(np.int32); fu = u - u0; fv = v - v0
    ok = (u0 >= 0) & (u0 < W - 1) & (v0 >= 0) & (v0 < H - 1)
    u0 = np.clip(u0, 0, W - 2); v0 = np.clip(v0, 0, H - 2)
    return img[v0, u0] * (1 - fu) * (1 - fv) + img[v0, u0 + 1] * fu * (1 - fv) + img[v0 + 1, u0] * (1 - fu) * fv + img[v0 + 1, u0 + 1] * fu * fv, ok


def continues(a, b):
    """best NCC of b against a under a global zoom (×0.77–1.3) + shift (phase correlation)"""
    H, W = a.shape
    grid = (*np.mgrid[0:H, 0:W].astype(np.float32), (H - 1) / 2, (W - 1) / 2)
    win = np.outer(np.hanning(H), np.hanning(W)).astype(np.float32)
    def shift(p, q):
        R = np.fft.rfft2((q - q.mean()) * win) * np.conj(np.fft.rfft2((p - p.mean()) * win)); R /= np.abs(R) + 1e-6
        r = np.fft.irfft2(R, s=p.shape); ky, kx = np.unravel_index(np.argmax(r), r.shape)
        return float(kx - W if kx > W // 2 else kx), float(ky - H if ky > H // 2 else ky)
    best = -1.0
    for s in (1 / 1.3, 1 / 1.15, 1 / 1.06, 1.0, 1.06, 1.15, 1.3):
        az, _ = _warp(a, s, 0, 0, grid)
        for d in (shift(az, b), (0.0, 0.0)):
            w, ok = _warp(a, s, d[0], d[1], grid)
            if ok.sum() > 500:
                best = max(best, ncc(w[ok], b[ok]))
    return best


def detect(s, sd, thumbs, a, b):
    cuts = []
    for n in range(max(a + 1, 1), b + 1):
        lo, hi = max(1, n - 2), min(len(s), n + 3)
        if s[n] < .8 or s[n] < s[lo:hi].max():
            continue
        ctx = np.r_[s[max(1, n - 8):max(1, n - 2)], s[n + 3:n + 9]]
        if s[n] / ((float(np.median(ctx)) if len(ctx) else 0.0) + .15) < 1.6:
            continue
        p, q = max(0, n - 2), min(len(sd) - 1, n + 1)
        if s[n] < 4 and min(sd[p], sd[q]) >= BLANK and continues(thumbs[p].astype(np.float32), thumbs[q].astype(np.float32)) > .55:
            continue
        if cuts and n - cuts[-1]['n'] < 4:                                 # one event: keep the stronger
            if s[n] > s[cuts[-1]['n']]:
                cuts[-1] = {'n': n, 'label': ''}
            continue
        cuts.append({'n': n, 'label': ''})
    return cuts


# ── a cut list from a file ──
def read_cuts(path, fps):
    if not os.path.isfile(path):
        raise UserError('--cuts-from: no such file: %s' % path)
    txt = open(path, encoding='utf-8').read()
    try:
        j = json.loads(txt)
    except ValueError:
        j = None
    if isinstance(j, dict) and 'shots' in j and 'probe' in j:                  # the skill's breakdown.json
        bf = float(j['probe'].get('fps') or 0)
        if bf and abs(bf - fps) > .01 * fps:
            raise UserError('--cuts-from: that breakdown was made at %.3f fps, the reference runs at %.3f — re-run the breakdown on this reference' % (bf, fps))
        return [{'n': int(s['startFrame']), 'label': (s.get('in') or {}).get('type', '')} for s in j['shots'][1:]], 'breakdown'
    if isinstance(j, dict) and 'cuts' in j:                                    # cuts.json from an earlier run
        return [{'n': int(c.get('listed', c['n'])), 'label': c.get('label', '')} for c in j['cuts']], 'cuts.json'
    if isinstance(j, list):
        return [{'n': int(c['n']), 'label': str(c.get('label', ''))} if isinstance(c, dict) else {'n': int(c), 'label': ''} for c in j], 'list'
    out = []
    for line in txt.splitlines():
        line = line.split('#')[0].strip()
        if not line:
            continue
        tok, _, rest = line.partition(' ')
        tok = tok.strip().lstrip('nN').rstrip(',')
        try:
            out.append({'n': int(round(float(tok[:-1]) * fps)) if tok.endswith('s') else int(tok), 'label': rest.strip()})
        except ValueError:
            raise UserError('--cuts-from: can\'t read "%s" (one cut per line: a frame like 75 or n75, or seconds like 2.5s, then an optional label)' % line)
    return out, 'list'


# ── per cut: where does ours change most, and do the two change curves line up? ──
def match_cuts(cuts, sr, so, sdo, a, b, fps):
    cuts = sorted([c for c in cuts if a < c['n'] <= b], key=lambda c: c['n'])
    rows = []
    for i, c in enumerate(cuts):
        gap_l = c['n'] - cuts[i - 1]['n'] if i else 99
        gap_r = cuts[i + 1]['n'] - c['n'] if i + 1 < len(cuts) else 99
        w = max(1, min(WIN, (gap_l - 1) // 2, (gap_r - 1) // 2))
        win = [n for n in range(c['n'] - w, c['n'] + w + 1) if a < n <= b]
        rn = max(win, key=lambda n: sr[n])
        winO = [n for n in range(rn - w, rn + w + 1) if a < n <= b]
        on = max(winO, key=lambda n: so[n])
        off = on - rn
        # change-curve alignment: the shift (±w) that best correlates ours with the reference over rn ± 5
        best = (0, -1.0)
        ref_curve = np.array([sr[n] if a < n <= b else 0 for n in range(rn - 5, rn + 6)])
        for d in range(-w, w + 1):
            ours_curve = np.array([so[n] if a < n <= b else 0 for n in range(rn - 5 + d, rn + 6 + d)])
            x, y = ref_curve - ref_curve.mean(), ours_curve - ours_curve.mean()
            r = float((x * y).sum() / (np.sqrt((x * x).sum() * (y * y).sum()) + 1e-9))
            if r > best[1] + 1e-9 or (abs(r - best[1]) <= 1e-9 and abs(d) < abs(best[0])):
                best = (d, r)
        status = 'missing' if so[on] < max(.35, .3 * sr[rn]) else 'exact' if off == 0 else '±1' if abs(off) == 1 else 'off'
        # a neighbouring shot of ours (to the previous / next reference cut) that is mostly blank
        lo = cuts[i - 1]['n'] if i else a
        hi = cuts[i + 1]['n'] if i + 1 < len(cuts) else b + 1
        blank = lambda x0, x1: x1 > x0 and float((sdo[x0:x1] < BLANK).mean()) >= .8
        trivial = blank(lo, rn) or blank(rn, hi)
        check = status == 'off' and abs(best[0]) <= 1 and best[1] >= .7
        rows.append({'n': rn, 'listed': c['n'], 'label': c['label'], 't': round(rn / fps, 3), 'ref_strength': round(float(sr[rn]), 2),
                     'ours': on, 'ours_strength': round(float(so[on]), 2), 'offset': off, 'curve_offset': best[0], 'curve_r': round(best[1], 2),
                     'status': status, 'trivial': bool(trivial), 'check': bool(check)})
    return rows


def summary(rows, ref_name):
    if not rows:
        return 'cuts: none in the reference over this range'
    k = lambda st: sum(r['status'] == st for r in rows)
    bad = [r for r in rows if r['status'] in ('off', 'missing')]
    line = 'cuts: %d in the reference — %d exact, %d within 1 f' % (len(rows), k('exact'), k('±1'))
    if k('off'):
        line += ', %d off' % k('off')
    if k('missing'):
        line += ', %d missing' % k('missing')
    if bad:
        line += ' (%s)' % ', '.join('n%d %s' % (r['n'], '%+d f' % r['offset'] if r['status'] == 'off' else 'no change in ours') + (' — curves line up at %+d f, check by eye' % r['curve_offset'] if r['check'] else '') for r in bad)
    triv = [r for r in rows if r['trivial']]
    if triv:
        line += '; %d trivial (next to a blank shot of ours: %s)' % (len(triv), ', '.join('n%d' % r['n'] for r in triv))
    return line


# ── the side-by-side ──
def layout(R, O):
    ar, ao = R['video']['w'] / R['video']['h'], O['video']['w'] / O['video']['h']
    H = int(min(1080, R['video']['h'], O['video']['h'], 1920 / (ar + ao))) // 2 * 2
    return H, max(2, int(round(H * ar / 2)) * 2), max(2, int(round(H * ao / 2)) * 2)


def tag(arr, x, y, text, F, pad):
    """an opaque label box drawn into a numpy RGB frame"""
    x0, y0, x1, y1 = ImageDraw.Draw(Image.new('RGB', (1, 1))).textbbox((0, 0), text, font=F)
    im = Image.new('RGB', (x1 + 2 * pad, y1 + 2 * pad), (0, 0, 0))
    ImageDraw.Draw(im).text((pad, pad), text, font=F, fill=(255, 255, 255))
    w, h = min(im.size[0], arr.shape[1] - x), min(im.size[1], arr.shape[0] - y)
    arr[y:y + h, x:x + w] = np.asarray(im)[:h, :w]
    return y + h


def vthumb(half, band, m=3, f=4):
    """verification thumbnail of one RGB half: BT.709 luma below the label band and away from the seam, ¼ size by area"""
    x = half[band:, m:half.shape[1] - m].astype(np.float32)
    y = x[..., 0] * .2126 + x[..., 1] * .7152 + x[..., 2] * .0722
    h, w = y.shape[0] // f * f, y.shape[1] // f * f
    return y[:h, :w].reshape(h // f, f, w // f, f).mean(axis=(1, 3))


def verify(sbs, ref, ours, a, b, Wl, Wr, H, band):
    """decode the side-by-side next to both sources: each half of output frame k must show source frame a + k. A slip
    is a half that source frame k ± 1 explains clearly better (by a quarter of how much k and k ± 1 differ, and by at
    least 0.2 luma levels); a half that matches no source frame at all (mean difference > 10 levels) is wrong too.
    Returns (frames decoded, frames expected, [(k, side, shown, own, other)])"""
    srcs = (media.frames(ref, (Wl, H), 'rgb24', a, b, flags='bicubic'), media.frames(ours, (Wr, H), 'rgb24', a, b, flags='bicubic'))
    S, done, bad, n = ({}, {}), [False, False], [], 0
    def src(side, k):                      # source thumbnail k (read in order; frames before k − 1 are dropped)
        while k >= 0 and not done[side] and (not S[side] or max(S[side]) < k):
            try:
                S[side][max(S[side]) + 1 if S[side] else 0] = vthumb(next(srcs[side]), band)
            except StopIteration:
                done[side] = True
        return S[side].get(k)
    mad = lambda x, y: float(np.abs(x - y).mean())
    for k, f in enumerate(media.frames(sbs, (Wl + Wr, H), 'rgb24')):
        n += 1
        for side, name, half in ((0, 'reference', f[:, :Wl]), (1, 'ours', f[:, Wl:])):
            sk = src(side, k)
            if sk is None:
                continue
            d = vthumb(half, band)
            own, slip = mad(d, sk), None
            for j in (k - 1, k + 1):
                sj = src(side, j)
                if sj is not None:
                    other = mad(d, sj)
                    if other + max(.2, .25 * mad(sk, sj)) < own and (slip is None or other < slip[1]):
                        slip = (j, other)
            if slip:
                bad.append((k, name, slip[0], round(own, 2), round(slip[1], 2)))
            elif own > 10:
                bad.append((k, name, None, round(own, 2), None))
            for old in [x for x in S[side] if x < k - 1]:
                del S[side][old]
    return n, b - a + 1, bad


def report_verify(n, expect, bad, a):
    exact = expect - len(set(x[0] for x in bad)) if n == expect else 0
    print('verify: %d/%d frames exact%s' % (exact, expect, '' if n == expect else ' (decoded %d frames, expected %d)' % (n, expect)))
    for k, side, j, own, other in bad[:10]:
        print('  frame %d: the %s half %s' % (a + k, side, 'matches no source frame (mean difference %.1f levels)' % own if j is None
              else 'shows source frame %d (%.2f levels off it vs %.2f off frame %d)' % (a + j, other, own, a + k)))
    return exact == expect


def main():
    ap = argparse.ArgumentParser(description='reference vs ours, frame for frame: side-by-side, cut report, sheet')
    ap.add_argument('--ref', required=True); ap.add_argument('--ours', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--from', dest='frm'); ap.add_argument('--to')
    ap.add_argument('--half', action='store_true'); ap.add_argument('--audio', choices=['ref', 'ours', 'none'])
    ap.add_argument('--label-ref', default='reference'); ap.add_argument('--label-ours', default='ours')
    ap.add_argument('--cuts-from'); ap.add_argument('--no-video', action='store_true'); ap.add_argument('--verify')
    A = ap.parse_args()
    R, O = media.probe(A.ref), media.probe(A.ours)
    for P, who in ((R, '--ref'), (O, '--ours')):
        if not P['video']:
            raise UserError('%s %s has no video stream' % (who, P['name']))
    fps = R['video']['fps']
    if abs(O['video']['fps'] - fps) > .01 * fps:
        raise UserError('frame rates differ: the reference runs at %.3f fps, ours at %.3f — frame i must mean the same moment in both; conform ours to %.3f fps first (footage/conform.py --fps %g)' % (fps, O['video']['fps'], fps, round(fps, 3)))
    os.makedirs(A.out, exist_ok=True)
    # 1 · analysis (every frame of both, by index)
    sr, sdr, thr = series(A.ref, thumb_size(R), keep=True)
    so, sdo, _ = series(A.ours, thumb_size(O))
    nR, nO = len(sr), len(so)
    if not nR or not nO:
        raise UserError('no frames decoded from %s' % (A.ref if not nR else A.ours))
    N = min(nR, nO)
    notes = []
    if nR != nO:
        notes.append('lengths differ: the reference has %d frames, ours %d — comparing the first %d (%s)' % (nR, nO, N, media.tc(N, fps)))
    def at(v, end=False):           # 12.5 (seconds; --to is exclusive) or n375 (a frame, inclusive)
        v = str(v).strip()
        try:
            return int(v[1:]) if v[:1] in ('n', 'N') else int(round(float(v.rstrip('s')) * fps)) - (1 if end else 0)
        except ValueError:
            raise UserError('--from/--to take seconds (12.5) or a frame (n375), not "%s"' % v)
    a = max(0, at(A.frm)) if A.frm is not None else 0
    b = min(N - 1, at(A.to, True)) if A.to is not None else N - 1
    if b < a:
        raise UserError('--from/--to leave no frames (frames %d–%d of %d)' % (a, b, N))
    # 2 · the reference's cuts and where ours puts them
    if A.cuts_from:
        cuts, src = read_cuts(A.cuts_from, fps)
    else:
        cuts, src = detect(sr, sdr, thr, a, b), 'detected'
    rows = match_cuts(cuts, sr, so, sdo, a, b, fps)
    line = summary(rows, R['name'])
    # 3 · frames for the sheet (every reference shot's middle frame) and the strips (non-exact cuts ± 4)
    bounds = [a] + [r['n'] for r in rows] + [b + 1]
    mids = [(i + 1, (bounds[i] + bounds[i + 1] - 1) // 2, bounds[i]) for i in range(len(bounds) - 1)]
    strips = [r for r in rows if r['status'] != 'exact']
    want = set(m for _, m, _ in mids) | set(n for r in strips for n in range(r['n'] - 4, r['n'] + 5) if a <= n <= b)
    grabR, grabO = {}, {}
    H, Wl, Wr = layout(R, O)
    sbs = os.path.join(A.out, 'sbs-half.mp4' if A.half else 'sbs.mp4')
    F = media.font(max(12, int(round(H * .048))))
    pad = max(6, int(round(H * .026)))
    band = 2 * pad + max(12, int(round(H * .048))) + max(8, int(round(H * .026))) + 4    # label rows, kept out of the frame check
    small = lambda f, w: np.asarray(Image.fromarray(f).resize((w, max(2, int(round(w * f.shape[0] / f.shape[1])))), Image.BILINEAR))
    verdict = None
    if A.verify:
        P = media.probe(A.verify)
        if not P['video'] or (P['video']['w'], P['video']['h']) != (Wl + Wr, H):
            raise UserError('%s is %s, not the %d×%d side-by-side these inputs make — made from other inputs or settings?' % (A.verify, '%d×%d' % (P['video']['w'], P['video']['h']) if P['video'] else 'not a video', Wl + Wr, H))
        return 0 if report_verify(*verify(A.verify, A.ref, A.ours, a, b, Wl, Wr, H, band), a) else 1
    if not A.no_video:
        who = A.audio or ('ours' if O['audio'] else 'none')
        src_a = {'ref': R, 'ours': O}.get(who)
        if who != 'none' and not src_a['audio']:
            raise UserError('--audio %s: %s has no audio stream' % (who, src_a['name']))
        rate = fps / 2 if A.half else fps
        cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (Wl + Wr, H), '-framerate', '%.6f' % rate, '-i', '-']
        if who != 'none':
            cmd += ['-ss', '%.6f' % (a / fps), '-t', '%.6f' % ((b - a + 1) / fps), '-i', src_a['path']]
        cmd += ['-map', '0:v'] + (['-map', '1:a:0', '-c:a', 'aac', '-b:a', '192k', '-af', ('atempo=0.5,' if A.half else '') + 'apad'] if who != 'none' else [])   # apad: the picture sets the length
        cmd += ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv',
                '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', '-shortest', '-movflags', '+faststart', sbs]
        enc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
        it = zip(media.frames(A.ref, (Wl, H), 'rgb24', a, b, flags='bicubic'), media.frames(A.ours, (Wr, H), 'rgb24', a, b, flags='bicubic'))
        for k, (fl, fr) in enumerate(it):
            n = a + k
            if n in want:
                grabR[n], grabO[n] = small(fl, 320), small(fr, 320)
            frame = np.concatenate([fl, fr], axis=1)
            tag(frame, pad, pad, '%s  n%04d  %s' % (A.label_ref, n, media.tc(n, fps)), F, pad)
            tag(frame, Wl + pad, pad, A.label_ours, F, pad)
            try:
                enc.stdin.write(frame.tobytes())
            except BrokenPipeError:
                break
        enc.stdin.close()
        err = enc.stderr.read().decode('utf-8', 'replace'); enc.wait()
        if enc.returncode:
            raise UserError('encoding %s failed:\n%s' % (sbs, err.strip()[-1200:]))
        verdict = verify(sbs, A.ref, A.ours, a, b, Wl, Wr, H, band)
    else:
        for (fl, fr), n in zip(zip(media.frames(A.ref, (480, max(2, int(round(480 * R['video']['h'] / R['video']['w'] / 2)) * 2)), 'rgb24', a, b),
                                   media.frames(A.ours, (480, max(2, int(round(480 * O['video']['h'] / O['video']['w'] / 2)) * 2)), 'rgb24', a, b)), range(a, b + 1)):
            if n in want:
                grabR[n], grabO[n] = small(fl, 320), small(fr, 320)
    # 4 · sheet + strips
    portrait = R['video']['h'] > R['video']['w']
    cw = 180 if portrait else 320
    cols = 10 if portrait else 7
    ch = max(2, int(round(cw * R['video']['h'] / R['video']['w'])))
    Fh, Fs = media.font(20), media.font(13)
    lab, gap, P_ = 22, 4, 12
    nrow = (len(mids) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cw + (cols + 1) * P_, 44 + nrow * (lab + 2 * ch + gap) + (nrow + 1) * P_), (24, 23, 28))
    d = ImageDraw.Draw(sheet)
    d.text((P_, 12), '%s (top) vs %s (bottom) — the middle frame of every reference shot' % (A.label_ref, A.label_ours), font=Fh, fill=(240, 238, 244))
    st = {r['n']: r for r in rows}
    for i, (num, m, start) in enumerate(mids):
        x, y = P_ + (i % cols) * (cw + P_), 44 + P_ + (i // cols) * (lab + 2 * ch + gap + P_)
        cut = st.get(start)
        d.text((x, y + 3), '#%d  n%04d  %s%s' % (num, m, media.tc(m, fps), '  in: %s' % cut['status'] if cut else ''), font=Fs,
               fill=(240, 238, 244) if not cut or cut['status'] == 'exact' else (255, 190, 90))
        for k, im in enumerate((grabR.get(m), grabO.get(m))):
            if im is not None:
                sheet.paste(Image.fromarray(im).resize((cw, ch), Image.BILINEAR), (x, y + lab + k * (ch + gap)))
    sheet.save(os.path.join(A.out, 'sheet.png'))
    sd_ = os.path.join(A.out, 'cuts')
    for f in (os.listdir(sd_) if os.path.isdir(sd_) else []):          # this run's strips replace the last run's
        if f.startswith('cut-n') and f.endswith('.png'):
            os.remove(os.path.join(sd_, f))
    if strips:
        os.makedirs(sd_, exist_ok=True)
    for r in strips:
        sw = 200; sh = max(2, int(round(sw * R['video']['h'] / R['video']['w'])))
        im = Image.new('RGB', (9 * (sw + 4) + 4, 2 * sh + 52), (24, 23, 28)); dd = ImageDraw.Draw(im)
        dd.text((6, 4), 'n%d %s: %s, ours %s (curves line up at %+d f) — top %s, bottom %s' % (r['n'], r['label'], r['status'], '%+d f' % r['offset'], r['curve_offset'], A.label_ref, A.label_ours), font=Fs, fill=(240, 238, 244))
        for j, n in enumerate(range(r['n'] - 4, r['n'] + 5)):
            x = 4 + j * (sw + 4)
            dd.text((x, 24), 'n%d%s' % (n, ' (cut)' if n == r['n'] else ' (ours)' if n == r['ours'] else ''), font=Fs, fill=(255, 190, 90) if n in (r['n'], r['ours']) else (200, 200, 210))
            for k, g in enumerate((grabR, grabO)):
                if n in g:
                    im.paste(Image.fromarray(g[n]).resize((sw, sh), Image.BILINEAR), (x, 44 + k * (sh + 4)))
        im.save(os.path.join(A.out, 'cuts', 'cut-n%04d.png' % r['n']))
    # 5 · report
    out = {'ref': {'file': os.path.abspath(A.ref), 'frames': nR, 'size': [R['video']['w'], R['video']['h']]},
           'ours': {'file': os.path.abspath(A.ours), 'frames': nO, 'size': [O['video']['w'], O['video']['h']]},
           'fps': fps, 'range': [a, b], 'cuts_from': A.cuts_from and os.path.abspath(A.cuts_from), 'source': src, 'notes': notes, 'summary': line, 'cuts': rows}
    if verdict:
        n, expect, bad = verdict
        out['verify'] = {'file': sbs, 'decoded': n, 'expected': expect, 'exact': expect - len(set(x[0] for x in bad)) if n == expect else 0, 'mismatches': [list(x) for x in bad[:50]]}
    json.dump(out, open(os.path.join(A.out, 'cuts.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    md = ['# %s vs %s — cuts' % (A.label_ref, A.label_ours), '',
          '%s (%s, %d frames) vs %s (%s, %d frames) at %g fps, frames %d–%d. Reference cuts: %s.' % (R['name'], A.label_ref, nR, O['name'], A.label_ours, nO, round(fps, 3), a, b,
            {'breakdown': 'the breakdown (%s)' % A.cuts_from, 'cuts.json': 'an earlier cuts.json', 'list': 'the list in %s' % A.cuts_from, 'detected': 'detected here'}[src]), '', '**%s**' % line, '']
    md += ['- ' + x for x in notes] + ([''] if notes else [])
    md += ['| # | ref frame | time | label | ours | offset | curves | status | note |', '|---|---|---|---|---|---|---|---|---|']
    for i, r in enumerate(rows):
        note = '; '.join(x for x in ['trivial: next to a blank shot of ours' if r['trivial'] else '', 'check by eye: cuts/cut-n%04d.png' % r['n'] if r['check'] else ('cuts/cut-n%04d.png' % r['n'] if r['status'] != 'exact' else '')] if x)
        md.append('| %d | n%d%s | %s | %s | n%d | %+d f | %+d f (r %.2f) | %s | %s |' % (i + 1, r['n'], '' if r['listed'] == r['n'] else ' (listed n%d)' % r['listed'], media.tc(r['n'], fps), r['label'] or '—', r['ours'], r['offset'], r['curve_offset'], r['curve_r'], r['status'], note))
    md += ['', 'Offset = our biggest picture change within ±%d frames minus the reference\'s; curves = the shift that best lines up the two change curves (a second opinion: when motion next to a cut wins the peak, the curves still line up).' % WIN,
           'sheet.png and sbs.mp4 show the reference\'s own frames: private review only.']
    open(os.path.join(A.out, 'cuts.md'), 'w', encoding='utf-8').write('\n'.join(md) + '\n')
    for x in notes:
        print('! ' + x)
    print(line)
    print('→ %s (cuts.json, cuts.md, sheet.png%s)' % (A.out, ', cuts/ strips' if strips else ''))
    if verdict:
        ok = report_verify(*verdict, a)
        print('→ %s — private review only (it shows the reference\'s own frames)' % sbs)
        return 0 if ok else 1
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except UserError as e:
        media.die(str(e))
