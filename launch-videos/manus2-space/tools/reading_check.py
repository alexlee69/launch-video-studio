# -*- coding: utf-8 -*-
"""Reading-time check for the manus2-space storyboard: every string on screen at <= 3.0 words per readable second.

What it reads:
- JOB/out/main/timeline.json: each shot's `copy` (what the blocks actually put on screen, the storyboard's copy line);
- the final shot list (shotlist.json): each string's legible frame `r` and last frame `l` (hf01 frames).
The rule (shot list kit 'reading_rule'): words are whitespace tokens; '·', '/', '→' and '…' are not words; a timecode is
one word. A string may carry at most 3.0 words per readable second (readable = r .. l inclusive, 30 fps), and so may
every group of strings read together (strings whose readable windows overlap share one span, first r to last l).
A string on screen that the shot list does not time (e.g. a panel header a framing shows) is timed over its whole shot.
Also prints the skill's own --grid formula per shot (0.4 s + 0.25 s per word <= shot length).

usage: /usr/bin/python3 -B tools/reading_check.py JOB SHOTLIST_JSON [--selftest]   (exit 0 = PASS, 1 = FAIL)
"""
import json, sys

NOT_WORDS = {'·', '/', '→', '…', '-', '—'}


def words(s):
    return len([w for w in str(s).split() if w not in NOT_WORDS])


def check(tl_shots, sl_shots, limit=3.0):
    sl = {s['id']: s for s in sl_shots}
    rows, fails = [], []
    for s in tl_shots:
        sid, f0, D = s['id'], round(s['start'] * 30), round((s['end'] - s['start']) * 30)
        timed = {st['t'].replace(' (ad)', ''): st for st in sl.get(sid, {}).get('strings', []) if st.get('words')}
        items = []
        for c in s.get('copy') or []:
            st = timed.get(c) or next((v for k, v in timed.items() if c in k.split()), None)   # 'Wish' / 'fast!' = parts of 'Wish fast!'
            r, l = (st['r'], st['l']) if st else (f0, f0 + D - 1)
            items.append((c, r, l, words(c), bool(st)))
        # each string
        for c, r, l, w, known in items:
            sec = (l - r + 1) / 30
            if w / sec > limit:
                fails.append(f'{sid}: "{c}" {w} words in {sec:.2f} s = {w / sec:.2f} w/s')
        # groups of strings read together (overlapping windows)
        groups = []
        for it in sorted(items, key=lambda x: x[1]):
            if groups and it[1] <= groups[-1]['l']:
                g = groups[-1]; g['items'].append(it); g['l'] = max(g['l'], it[2])
            else:
                groups.append({'r': it[1], 'l': it[2], 'items': [it]})
        worst = 0.0
        for g in groups:
            w = sum(i[3] for i in g['items']); sec = (g['l'] - g['r'] + 1) / 30; worst = max(worst, w / sec)
            if w / sec > limit:
                fails.append(f'{sid}: group n{g["r"]}-{g["l"]} ({" | ".join(i[0] for i in g["items"])}) {w} words in {sec:.2f} s = {w / sec:.2f} w/s')
        tok = sum(len(str(c).split()) for c in s.get('copy') or [])
        need = .4 + tok * .25 if tok else 0
        rows.append((sid, D / 30, sum(i[3] for i in items), worst, tok, need, [i[0] for i in items if not i[4]]))
    return rows, fails


def main():
    job, slj = sys.argv[1], sys.argv[2]
    tl = json.load(open(job + '/out/main/timeline.json', encoding='utf-8'))
    sl = json.load(open(slj, encoding='utf-8'))['shots']
    if '--selftest' in sys.argv:
        # plant a dense card: S25's two-word title made into eight words (0.93 s shot) -> must FAIL
        bad = json.loads(json.dumps(tl['shots']))
        for s in bad:
            if s['id'] == 'S25':
                s['copy'] = ['The Lull, the quietest room in orbit tonight']
        _, f = check(bad, sl)
        ok = any(x.startswith('S25') for x in f)
        print('selftest (planted 8 words in S25, 0.93 s):', 'caught -> ' + f[0] if ok else 'MISSED')
        sys.exit(0 if ok else 1)
    rows, fails = check(tl['shots'], sl)
    print('shot  len s  words  worst w/s (readable windows)  | --grid: tokens, needs s (0.4 + 0.25/token)  | untimed strings (whole shot)')
    for sid, ln, w, worst, tok, need, extra in rows:
        print(f'{sid:4} {ln:6.2f} {w:6d}  {worst:6.2f}                         | {tok:3d} {need:5.2f} {"OK" if need <= ln + 1e-9 else "WARN"}  | {", ".join(extra)}')
    print('\n'.join(fails) if fails else 'no string or group above 3.0 w/s')
    print('RESULT:', 'PASS' if not fails else 'FAIL')
    sys.exit(0 if not fails else 1)


if __name__ == '__main__':
    main()
