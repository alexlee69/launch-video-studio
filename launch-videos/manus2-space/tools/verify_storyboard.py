# -*- coding: utf-8 -*-
"""Independent checks of the manus2-space storyboard ("The Lull") against the final astronaut shot list.
(Reused from manus2-film; points at storyboard-space/final/shotlist.json.)

usage: /usr/bin/python3 -B tools/verify_storyboard.py [--selftest]
  1. grid   : every shot's `sec` x 30 and `n0` in beats.yaml against hf01's verified cut frames (cuts/cuts.json),
              read straight from beats.yaml (independent of lv.mjs and grid_check.py).
  2. copy   : every on-screen string in final/shotlist.json appears in the rendered board's copy lines
              (out/main/16x9/board/board.html), and nothing else does.
  3. trap   : each of our strings against hf01's text inventory (SHOTS.md §5) and Manus's 63 on-screen strings
              (manus2/study/words.json): flags a shared run of 2+ content words, or 3+ words with one content word,
              or a token overlap >= 0.34 with 2+ shared non-product words.
  4. plates : assets/plates/*.png are byte-identical to a fresh run of tools/make_plates.py in a temp folder, and
              make_plates.py opens no image file (fonts only), so no reference frame can be inside a plate.
  5. frame  : (added by the verify pass) the editor's fixed UI words (project name, 'Cloud Computer' chip, 'Alchemy'
              header) against each editor shot's framing in out/main/timeline.json: a word wholly in frame must be in
              that shot's `onscreen` (counted for reading time and in the board's copy line), and a word wholly out of
              frame must not be. Clipped words are listed, not failed (S19's clipped 'Alche' is counted to be safe).
--selftest plants a one-frame error in S10, four rewrites of reference lines and S06's project name back at the kit's
x 40 (off-frame but counted), and expects all of them to be caught.
Exit 0 = all pass."""
import html, json, os, re, shutil, subprocess, sys, tempfile

JOB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
H = os.path.join(os.path.dirname(JOB), 'hf01-study')
CUTS = os.path.join(H, 'cuts', 'cuts.json')
SL = os.path.join(H, 'storyboard-space', 'final', 'shotlist.json')
# strings a framing shows that the shot list did not time (the editor's Alchemy panel header; COPY.md, 'Storyboard build')
KNOWN_EXTRA = {'S17': 'Alchemy', 'S19': 'Alchemy'}
STOP = set('a an the to of on in at for and or is it its by we our your you i my me this that with from be are was as no not one'.split())
PRODUCT = set('manus 2.0 studio video editor automation automations cloud computer alchemy'.split())


def grid(beats_text):
    cj = json.load(open(CUTS, encoding='utf-8'))
    ref = [0] + [c['n'] for c in cj['cuts']] + [cj['frames']]
    ids = re.findall(r'^  - id: (S\d\d)', beats_text, re.M)
    secs = [float(s) for s in re.findall(r'^    sec: ([\d.]+)', beats_text, re.M)]
    n0s = dict(re.findall(r'^  - id: (S\d\d)\n(?:    .*\n)*?    n0: (\d+)', beats_text, re.M))
    bad, acc = [], 0.0
    for i, (sid, s) in enumerate(zip(ids, secs)):
        st, ln = ref[i], ref[i + 1] - ref[i]
        if not (abs(acc * 30 - st) < .01 and abs(s * 30 - ln) < .01 and (sid not in n0s or int(n0s[sid]) == st)):
            bad.append('%s start %.3f f (hf01 n%d) len %.3f f (hf01 %d)' % (sid, acc * 30, st, s * 30, ln))
        acc += s
    ok = len(ids) == len(secs) == len(ref) - 1 and not bad and abs(acc * 30 - cj['frames']) < .01
    return ok, '%d shots, %d n0 fields, film %.3f f (hf01 %d f), %d mismatches%s' % (
        len(ids), len(n0s), acc * 30, cj['frames'], len(bad), ('' if not bad else ': ' + '; '.join(bad[:4]) + (' ...' if len(bad) > 4 else '')))


def norm(s):
    s = s.replace('**', '').replace('…', '...').replace('’', "'")
    s = re.sub(r'\s*\(#[0-9A-Fa-f]{6}\)', '', s)
    s = re.sub(r'\s*/\s*', ' ', s)
    s = re.sub(r'[\s·:]+', ' ', s)        # the board joins lines with ' · ' and tiles as 'TITLE: rule'
    return s.strip()


def copy_check():
    board = open(os.path.join(JOB, 'out', 'main', '16x9', 'board', 'board.html'), encoding='utf-8').read()
    cards = re.findall(r'<b>\d+ · (S\d\d)</b>.*?<div class="copy">(.*?)</div>', board, re.S)
    bc = {sid: norm(html.unescape(re.sub(r'<[^>]+>', '', c))) for sid, c in cards}
    sl = json.load(open(SL, encoding='utf-8'))
    miss, extra, n = [], [], 0
    for sh in sl['shots']:
        b = bc.get(sh['id'], '')
        rest = ' ' + b + ' '
        for st in sh['strings']:
            if st.get('logo'):
                continue
            n += 1
            t = norm(st['t'])
            if t not in b:
                miss.append('%s %r' % (sh['id'], st['t']))
            rest = rest.replace(' ' + t + ' ', ' ', 1)
        left = rest.strip()
        if sh['id'] in KNOWN_EXTRA:
            left = (' ' + left + ' ').replace(' ' + KNOWN_EXTRA[sh['id']] + ' ', ' ', 1).strip()
        if left and left != 'no copy':
            extra.append('%s %r' % (sh['id'], left))
    return not miss and not extra, '%d shotlist strings, %d board cards; missing %d%s; extra %d%s' % (
        n, len(bc), len(miss), (': ' + '; '.join(miss) if miss else ''), len(extra), (': ' + '; '.join(extra) if extra else ''))


def toks(s):
    return re.findall(r"[a-z0-9][a-z0-9'.:]*[a-z0-9]|[a-z0-9]", s.lower().replace('’', "'"))


def run_(a, b):
    best = []
    for i in range(len(a)):
        for j in range(len(b)):
            k = 0
            while i + k < len(a) and j + k < len(b) and a[i + k] == b[j + k]:
                k += 1
            if k > len(best):
                best = a[i:i + k]
    return best


def trap(extra=()):
    sl = json.load(open(SL, encoding='utf-8'))
    ours = [(sh['id'], st['t']) for sh in sl['shots'] for st in sh['strings'] if not st.get('logo')] + list(extra)
    md = open(os.path.join(H, 'SHOTS.md'), encoding='utf-8').read()
    sec = md.split('## 5. Text inventory')[1].split('**Copy pattern')[0]
    refs = [('hf01', r.split('|')[2].strip()) for r in sec.splitlines() if re.match(r'\|\s*\d+\s*\|', r)]
    refs += [('manus', x['text']) for x in json.load(open(os.path.join(H, 'manus2', 'study', 'words.json'), encoding='utf-8'))['inventory']]
    flags = []
    for sid, t in ours:
        ta = toks(t)
        for src, r in refs:
            tb = toks(r)
            run = run_(ta, tb)
            content = [x for x in run if x not in STOP and x not in PRODUCT]
            ja, jb = set(ta) - STOP, set(tb) - STOP
            jac = len(ja & jb) / max(1, len(ja | jb))
            if len(content) >= 2 or (len(run) >= 3 and content) or (jac >= .34 and len(ja & jb - PRODUCT) >= 2):
                flags.append((sid, t, src, r, ' '.join(run), round(jac, 2)))
    return flags, len(ours) - len(extra), len(refs)


def plates():
    src = open(os.path.join(JOB, 'tools', 'make_plates.py'), encoding='utf-8').read()
    reads = re.findall(r'Image\.open|imread|VideoCapture|urlopen|requests\.', src)
    tmp = tempfile.mkdtemp(prefix='plates-')
    try:
        os.makedirs(os.path.join(tmp, 'tools'))
        shutil.copy(os.path.join(JOB, 'tools', 'make_plates.py'), os.path.join(tmp, 'tools'))
        subprocess.run([sys.executable, '-B', os.path.join(tmp, 'tools', 'make_plates.py')], check=True, capture_output=True)
        mine = os.path.join(JOB, 'assets', 'plates')
        names = sorted(f for f in os.listdir(mine) if f.endswith('.png'))
        same = [f for f in names if open(os.path.join(mine, f), 'rb').read() == open(os.path.join(tmp, 'assets', 'plates', f), 'rb').read()]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    ok = not reads and len(same) == len(names) > 0
    return ok, '%d/%d plates byte-identical to a fresh make_plates.py run; image/network reads in make_plates.py: %d' % (len(same), len(names), len(reads))


def frame_check(shots):
    """editor UI words vs framing. Boxes are master px (1080x608) of blocks/editor.mjs: project name at (projectX, 24),
    11 px Inter 500 (~44 px wide); the chip text 'Cloud Computer' inside the 862-960 pill; the 'Alchemy' header at
    (846, 54), 11 px Inter 600 (~46 px wide). A shot whose comp is the Alchemy board has its own 'Alchemy' eyebrow."""
    bad, clipped = [], []
    for s in shots:
        if s.get('block') != 'editor':
            continue
        fx, fy, fs = s.get('framing') or [540, 304, 1]
        vx0, vx1, vy0, vy1 = fx - 540 / fs, fx + 540 / fs, fy - 304 / fs, fy + 304 / fs
        px = s.get('projectX', 40)
        boxes = {s.get('project') or 'The Lull': (px, px + 44, 26, 36), 'Cloud Computer': (885, 954, 25, 35), 'Alchemy': (846, 892, 56, 66)}
        if (s.get('comp') or {}).get('type') == 'board':
            boxes.pop('Alchemy')
        on = set(s.get('onscreen') or [])
        for word, (x0, x1, y0, y1) in boxes.items():
            full = x0 >= vx0 and x1 <= vx1 and y0 >= vy0 and y1 <= vy1
            part = x0 < vx1 and x1 > vx0 and y0 < vy1 and y1 > vy0
            if full and word not in on:
                bad.append('%s: %r is in frame but not counted' % (s['id'], word))
            elif not part and word in on:
                bad.append('%s: %r is counted but out of frame (visible x %.0f-%.0f, y %.0f-%.0f)' % (s['id'], word, vx0, vx1, vy0, vy1))
            elif part and not full:
                clipped.append('%s %r (%s)' % (s['id'], word, 'counted' if word in on else 'not counted'))
    n = sum(1 for s in shots if s.get('block') == 'editor')
    return not bad, '%d editor shots; %d mismatches%s; clipped: %s' % (n, len(bad), (': ' + '; '.join(bad) if bad else ''), ', '.join(clipped) or 'none')


def main():
    beats = open(os.path.join(JOB, 'beats.yaml'), encoding='utf-8').read()
    res = []
    ok, msg = grid(beats); res.append(ok); print('1 grid   %s  %s' % ('PASS' if ok else 'FAIL', msg))
    ok, msg = copy_check(); res.append(ok); print('2 copy   %s  %s' % ('PASS' if ok else 'FAIL', msg))
    flags, n, nr = trap(); res.append(not flags)
    print('3 trap   %s  %d of our strings vs %d reference strings: %d flagged' % ('PASS' if not flags else 'FAIL', n, nr, len(flags)))
    for f in flags:
        print('         ', f)
    ok, msg = plates(); res.append(ok); print('4 plates %s  %s' % ('PASS' if ok else 'FAIL', msg))
    tl = json.load(open(os.path.join(JOB, 'out', 'main', 'timeline.json'), encoding='utf-8'))
    ok, msg = frame_check(tl['shots']); res.append(ok); print('5 frame  %s  %s' % ('PASS' if ok else 'FAIL', msg))
    if '--selftest' in sys.argv:
        bad = re.sub(r'^(    sec: )1\.5000( )', r'\g<1>1.5333\2', beats, count=1, flags=re.M)
        g_ok, g_msg = grid(bad)
        plant = [('CTRL', 'I need a promo, fast.'), ('CTRL', 'Mixing the score now…'),
                 ('CTRL', 'Looks great! Next brief is a safety film.'), ('CTRL', 'Every idea has a film.')]
        tf, _, _ = trap(plant)
        caught = len({f[1] for f in tf if f[0] == 'CTRL'})
        planted = json.loads(json.dumps(tl['shots']))
        for sh in planted:
            if sh['id'] == 'S06':
                sh.pop('projectX', None)          # the kit's x 40: off S06's frame, still counted -> must FAIL
        f_ok, f_msg = frame_check(planted)
        st = (not g_ok) and caught == len(plant) and not f_ok
        res.append(st)
        print('selftest %s  S10 +1 frame -> grid %s (%s); planted rewrites caught %d/%d; S06 name at x 40 -> frame %s' % (
            'PASS' if st else 'FAIL', 'FAIL' if not g_ok else 'PASS(!)', g_msg[:90], caught, len(plant), 'FAIL' if not f_ok else 'PASS(!)'))
    print('RESULT: %s' % ('PASS' if all(res) else 'FAIL'))
    sys.exit(0 if all(res) else 1)


if __name__ == '__main__':
    main()
