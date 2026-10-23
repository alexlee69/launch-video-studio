# -*- coding: utf-8 -*-
# A track's style on its beat grid, and "is our score on their beat?". Reads audio or video files (the first audio
# stream). Timing and feel only — never copy the reference's notes, and never ship its audio.
#
#   python3 music.py profile <audio|video> [--bpm B --first-beat T] [--downbeat T] [--from S] [--to S] [--json OUT]
#       groove = onset strength on each 16th of the bar, per band (kick 30–120 Hz, body 150–2500 Hz, hats 5–11 kHz),
#       as % of the band's busiest 16th; band balance; brightness (median spectral centroid); a key guess
#       (Krumhansl). The grid: --bpm/--first-beat, else the skill's tracker (lib/breakdown.mjs --tempo); bars start at
#       --downbeat, else the tracker's downbeat, else the first beat. Analysed stretch: --from/--to, else from 4 s to
#       7.5 s before the end (the intro and the ending of a launch film left out).
#   python3 music.py compare <ref> <ours> [--json OUT]
#       both tracks' tempo, first beat and confidence (the skill's tracker), the lag of ours behind the reference
#       (cross-correlation of the onset envelopes), quiet stretches (≥ 0.25 s under −45 dBFS RMS), the biggest hit,
#       both profiles on the reference's grid, and a verdict line.
# Each file needs at least 1 s of audio that isn't silent; --json is never an input (same path, hard link or symlink:
# refused), holds no NaN, and is written whole (a temp file + one rename).
# exit 0 done (compare: on their beat) · 1 compare: off their beat · 2 bad input (missing file, no audio, no tempo,
# too short, silent)
import os, sys, json, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True                  # no __pycache__ inside the skill
import media
from media import np, UserError

SR, NFFT, HOP = 22050, 2048, 256
BANDS = [('kick 30-120', 30, 120), ('snare/body 150-2.5k', 150, 2500), ('hats 5-11k', 5000, 11000)]
EDGES = [(20, 120, 'sub/bass'), (120, 500, 'low-mid'), (500, 2000, 'mid'), (2000, 6000, 'upper-mid'), (6000, 11000, 'air')]
NAMES = 'C C# D D# E F F# G G# A A# B'.split()
MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
MIN_SEC = 1.0            # shortest audio analysed
SILENT = 1e-4            # RMS (−80 dBFS) under which the analysed stretch counts as silence


def load(path):
    """the first audio stream, mono at SR, refused when shorter than MIN_SEC"""
    x = media.audio(path, SR)
    if len(x) < MIN_SEC * SR:
        raise UserError('%s has %.2f s of audio — too short to analyse (at least %g s)' % (os.path.basename(path), len(x) / SR, MIN_SEC))
    return x


def r_or_none(a, b):
    """Pearson r, None when either side is flat (no NaN)"""
    a, b = np.asarray(a, float), np.asarray(b, float)
    return float(np.corrcoef(a, b)[0, 1]) if a.std() > 1e-9 and b.std() > 1e-9 else None


def grid_of(path, bpm=None, first=None, downbeat=None):
    """bpm, first beat, bar start (+ the tracker's reading when it ran)"""
    T = None
    if bpm is None or first is None:
        T = media.tempo(path)
        if T.get('bpm') is None:
            raise UserError('%s: the tracker found no tempo (%s) — give --bpm and --first-beat' % (os.path.basename(path), T.get('reason')))
    bpm = float(bpm if bpm is not None else T['bpm'])
    first = float(first if first is not None else T['firstBeat'])
    if downbeat is None:
        downbeat = T['downbeat'] if T and T.get('downbeat') is not None else first
    return {'bpm': bpm, 'first_beat': first, 'downbeat': float(downbeat), 'tracker': T}


def spectrum(x):
    fr = np.lib.stride_tricks.sliding_window_view(x, NFFT)[::HOP] * np.hanning(NFFT)
    S = np.abs(np.fft.rfft(fr, axis=1))
    return S, np.fft.rfftfreq(NFFT, 1 / SR), (np.arange(len(S)) * HOP + NFFT / 2) / SR


def profile(x, g, t0=None, t1=None, name='the audio'):
    """music_profile.py (hf02, 2026-10-22) on grid g over [t0, t1]"""
    S, F, t = spectrum(x)
    dur = len(x) / SR
    t0 = min(4.0, .1 * dur) if t0 is None else t0
    t1 = dur - min(7.5, .15 * dur) if t1 is None else t1
    body = (t > t0) & (t < t1)
    if body.sum() < 50:
        raise UserError('the analysed stretch %.2f–%.2f s is too short for a profile' % (t0, t1))
    seg = x[max(0, int(t0 * SR)):int(t1 * SR)]
    if not seg.size or float(np.sqrt(np.mean(seg ** 2))) < SILENT:
        raise UserError('%s is silent over the analysed stretch %.1f–%.1f s (RMS under −80 dBFS) — nothing to profile' % (name, t0, t1))
    def flux(lo, hi):
        m = np.log1p(50 * S[:, (F >= lo) & (F < hi)]); f = np.r_[0, np.maximum(np.diff(m, axis=0), 0).sum(axis=1)]
        return f / (f[body].mean() + 1e-9)
    P = 60 / g['bpm']
    pos = np.floor(((t - g['downbeat']) / (P / 4)) % 16 + .5).astype(int) % 16
    groove = {}
    for name, lo, hi in BANDS:
        f = flux(lo, hi)
        v = np.array([f[body & (pos == k)].mean() if (body & (pos == k)).any() else 0 for k in range(16)])
        groove[name] = [float(100 * u) for u in v / (v.max() + 1e-12)]
    E = S[body] ** 2; tot = E.sum()
    balance = {n: float(10 * np.log10(E[:, (F >= lo) & (F < hi)].sum() / tot + 1e-12)) for lo, hi, n in EDGES}
    cent = (S[body] * F).sum(axis=1) / (S[body].sum(axis=1) + 1e-9)
    sel = (F > 80) & (F < 5000); pc = np.round(12 * np.log2(F[sel] / 440.0) + 9).astype(int) % 12
    ch = np.array([(S[body][:, sel][:, pc == k] ** 2).sum() for k in range(12)]); ch /= ch.sum() + 1e-12
    sc = sorted([(r_or_none(ch, np.roll(MAJ, k)) or 0.0, NAMES[k] + ' major') for k in range(12)] +
                [(r_or_none(ch, np.roll(MIN, k)) or 0.0, NAMES[k] + ' minor') for k in range(12)], reverse=True)
    return {'grid': {k: g[k] for k in ('bpm', 'first_beat', 'downbeat')}, 'from': t0, 'to': t1, 'groove': groove, 'balance_db': balance,
            'centroid_hz': float(np.median(cent)), 'key': sc[0][1], 'key_r': sc[0][0], 'runner_up': sc[1][1], 'runner_up_r': sc[1][0],
            'chroma': {NAMES[k]: float(100 * ch[k]) for k in range(12)}}


def rounded(v, nd=2):
    """for the JSON files: floats to nd decimals, all the way down"""
    if isinstance(v, float):
        return round(v, nd)
    if isinstance(v, dict):
        return {k: rounded(x, nd) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [rounded(x, nd) for x in v]
    return v


def print_profile(name, p, g):
    T = g.get('tracker')
    print('== %s: %.2f BPM, first beat %.4f s, bars from %.4f s%s · analysed %.1f–%.1f s' % (name, g['bpm'], g['first_beat'], g['downbeat'],
          " (the skill's tracker, confidence %s, bar confidence %s)" % (T['confidence'], T.get('downbeatConfidence')) if T else '', p['from'], p['to']))
    print('groove (onset strength on each 16th of the bar, % of the band\'s busiest; | = a beat):')
    for name_, v in p['groove'].items():
        print('  %-20s %s' % (name_, ' '.join(('|' if k % 4 == 0 else ' ') + '%3.0f' % u for k, u in enumerate(v))))
    print('band balance (share of energy, dB re total): ' + ' | '.join('%s %.1f' % (k, v) for k, v in p['balance_db'].items()))
    print('brightness (spectral centroid) median %.0f Hz' % p['centroid_hz'])
    print('key estimate: %s (r %.2f), runner-up %s (r %.2f)' % (p['key'], p['key_r'], p['runner_up'], p['runner_up_r']))
    print('chroma: ' + ' '.join('%s %.0f' % kv for kv in p['chroma'].items()))


# ── compare helpers ──
def onset_env(x, hop=128, n=1024):
    fr = np.lib.stride_tricks.sliding_window_view(x, n)[::hop] * np.hanning(n)
    mag = np.log1p(100 * np.abs(np.fft.rfft(fr, axis=1)))
    f = np.maximum(np.diff(mag, axis=0), 0).sum(axis=1)
    f = np.maximum(f - np.convolve(f, np.ones(61) / 61, 'same'), 0)          # the slow trend out
    return f, hop / SR


def lag_ms(xr, xo, max_s=.25):
    """ours' lag behind the reference (ms, + = later) from the onset envelopes' cross-correlation peak (sub-hop)"""
    er, dt = onset_env(xr); eo, _ = onset_env(xo)
    n = min(len(er), len(eo)); er, eo = er[:n] - er[:n].mean(), eo[:n] - eo[:n].mean()
    L = int(max_s / dt)
    cc = np.array([float((er[max(0, -k):n - max(0, k)] * eo[max(0, k):n - max(0, -k)]).sum()) for k in range(-L, L + 1)])
    cc /= np.sqrt((er * er).sum() * (eo * eo).sum()) + 1e-12
    i = int(np.argmax(cc))
    off = 0.0
    if 0 < i < len(cc) - 1:
        y0, y1, y2 = cc[i - 1], cc[i], cc[i + 1]; den = y0 - 2 * y1 + y2
        off = .5 * (y0 - y2) / den if den < 0 else 0.0
    return round((i - L + off) * dt * 1000, 1), round(float(cc[i]), 3)


def quiet(x, thr=-45.0, min_len=.25):
    w, h = int(.05 * SR), int(.01 * SR)
    r = np.array([np.sqrt(np.mean(x[i:i + w] ** 2)) for i in range(0, max(1, len(x) - w), h)])
    q = 20 * np.log10(r + 1e-12) < thr
    out, i = [], 0
    while i < len(q):
        if q[i]:
            j = i
            while j + 1 < len(q) and q[j + 1]:
                j += 1
            a, b = i * h / SR, (j * h + w) / SR
            if b - a >= min_len:
                out.append([round(a, 3), round(min(b, len(x) / SR), 3)])
            i = j + 1
        else:
            i += 1
    return out


def biggest_hit(x):
    """the onset with the biggest jump in level: 5 ms block peaks; among blocks within 6 dB of the loudest, the largest
    rise over the 150 ms before; its time = the first block above 30 % of that peak"""
    h = int(.005 * SR); n = len(x) // h
    e = np.abs(x[:n * h]).reshape(n, h).max(axis=1)
    L = 20 * np.log10(e + 1e-9)
    prev = np.array([L[max(0, k - 30):k].max() if k else -180 for k in range(n)])
    loud = L >= L.max() - 6
    k = int(np.argmax(np.where(loud, L - prev, -1e9)))
    j = k
    while j > max(0, k - 30) and e[j - 1] > .3 * e[k]:
        j -= 1
    return round(j * h / SR, 3), round(float(L[k] - prev[k]), 1)


def main():
    ap = argparse.ArgumentParser(description='a track\'s style on its beat grid; is our score on their beat?')
    sub = ap.add_subparsers(dest='cmd', required=True)
    p1 = sub.add_parser('profile'); p1.add_argument('file')
    p1.add_argument('--bpm', type=float); p1.add_argument('--first-beat', type=float); p1.add_argument('--downbeat', type=float)
    p1.add_argument('--from', dest='frm', type=float); p1.add_argument('--to', type=float); p1.add_argument('--json')
    p2 = sub.add_parser('compare'); p2.add_argument('ref'); p2.add_argument('ours'); p2.add_argument('--json')
    A = ap.parse_args()
    if A.json:                                      # never an input; its folder made before the work
        media.guard_outputs([A.json], [A.file] if A.cmd == 'profile' else [A.ref, A.ours])
    for f in ([A.file] if A.cmd == 'profile' else [A.ref, A.ours]):
        P = media.probe(f)
        if not P['audio']:
            raise UserError('%s has no audio stream' % P['name'])
    if A.cmd == 'profile':
        if (A.bpm is None) != (A.first_beat is None):
            raise UserError('give --bpm and --first-beat together (or neither: the skill\'s tracker reads them)')
        x = load(A.file)
        g = grid_of(A.file, A.bpm, A.first_beat, A.downbeat)
        p = profile(x, g, A.frm, A.to, os.path.basename(A.file))
        print_profile(os.path.basename(A.file), p, g)
        if A.json:
            media.write_json(A.json, rounded({'file': os.path.abspath(A.file), 'tracker': g['tracker'] and {k: g['tracker'].get(k) for k in ('bpm', 'confidence', 'firstBeat', 'downbeat', 'downbeatConfidence')}, **p}, 4), indent=1)
        return 0
    xr, xo = load(A.ref), load(A.ours)
    gr, go = grid_of(A.ref), grid_of(A.ours)
    lag, peak = lag_ms(xr, xo)
    qr, qo = quiet(xr), quiet(xo)
    hr, ho = biggest_hit(xr), biggest_hit(xo)
    t1 = min(len(xr), len(xo)) / SR
    pr = profile(xr, gr, None, t1 - min(7.5, .15 * t1), os.path.basename(A.ref)); po = profile(xo, gr, pr['from'], pr['to'], os.path.basename(A.ours))      # both on the reference's grid
    beat = 60 / gr['bpm']
    ph = ((go['first_beat'] - gr['first_beat']) / beat) % 1
    phase = min(ph, 1 - ph) * beat
    corr = {k: r_or_none(pr['groove'][k], po['groove'][k]) for k in pr['groove']}      # None: a flat groove (no NaN)
    dbal = {k: po['balance_db'][k] - pr['balance_db'][k] for k in pr['balance_db']}
    T = lambda g: g['tracker']
    print('reference  %.2f BPM · first beat %.4f s · confidence %s   (the skill\'s tracker)' % (gr['bpm'], gr['first_beat'], T(gr)['confidence']))
    print('ours       %.2f BPM · first beat %.4f s · confidence %s' % (go['bpm'], go['first_beat'], T(go)['confidence']))
    print('onset lag: ours %+.0f ms vs the reference (onset cross-correlation peak %.2f)' % (lag, peak))
    fmt_q = lambda q: ', '.join('%.2f–%.2f s' % (a, b) for a, b in q) or 'none'
    print('quiet (≥ 0.25 s under −45 dBFS RMS): reference %s · ours %s' % (fmt_q(qr), fmt_q(qo)))
    jump = lambda d: '> 60 dB, out of silence' if d > 60 else '+%.0f dB' % d
    print('biggest hit: reference %.3f s (%s) · ours %.3f s (%s)' % (hr[0], jump(hr[1]), ho[0], jump(ho[1])))
    print('profile on the reference\'s grid (%.1f–%.1f s): groove r %s · band balance Δ %s dB · centroid %.0f vs %.0f Hz · key %s vs %s'
          % (pr['from'], pr['to'], ' / '.join('%s %s' % (k.split(' ')[0], 'n/a' if v is None else '%.2f' % v) for k, v in corr.items()), ' '.join('%s %+.1f' % (k, v) for k, v in dbal.items()),
             po['centroid_hz'], pr['centroid_hz'], po['key'], pr['key']))
    why = []
    if abs(go['bpm'] - gr['bpm']) > .15:
        octave = any(abs(go['bpm'] / gr['bpm'] - f) < .02 * f for f in (2, .5))
        why.append('tempo %.2f vs %.2f BPM%s' % (go['bpm'], gr['bpm'], ' — ×%g: the tracker may have locked to half or double time on one of them (listen; lv.mjs --tempo lists the other octave)' % round(go['bpm'] / gr['bpm'], 2) if octave else ''))
    if phase > .035:
        why.append('beat phase %.0f ms apart' % (phase * 1000))
    if abs(lag) > 35:
        why.append('onsets %+.0f ms off' % lag)
    if abs(hr[0] - ho[0]) > .035:
        why.append('the biggest hit %.3f vs %.3f s' % (ho[0], hr[0]))
    if (T(go)['confidence'] or 0) < .6:
        why.append('our pulse reads weakly (confidence %s; accent the beats)' % T(go)['confidence'])
    on = not why
    print('verdict: %s' % ('ON THEIR BEAT — same tempo (Δ %.2f BPM), beat phase %.1f ms apart, onsets %+.0f ms, the biggest hit %.0f ms apart' % (abs(go['bpm'] - gr['bpm']), phase * 1000, lag, abs(hr[0] - ho[0]) * 1000)
                           if on else 'OFF THEIR BEAT — ' + '; '.join(why)))
    if A.json:
        tr = lambda g: {k: g['tracker'].get(k) for k in ('bpm', 'confidence', 'firstBeat', 'downbeat', 'downbeatConfidence')}
        media.write_json(A.json, rounded({'ref': {'file': os.path.abspath(A.ref), 'tracker': tr(gr), 'quiet': qr, 'hit': hr[0], 'profile': pr},
                   'ours': {'file': os.path.abspath(A.ours), 'tracker': tr(go), 'quiet': qo, 'hit': ho[0], 'profile': po},
                   'lag_ms': lag, 'lag_peak': peak, 'phase_ms': phase * 1000, 'groove_r': corr, 'balance_delta_db': dbal, 'on_beat': on, 'why': why}, 4), indent=1)
    return 0 if on else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except UserError as e:
        media.die(str(e))
