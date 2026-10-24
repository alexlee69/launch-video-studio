# -*- coding: utf-8 -*-
"""Check every shot boundary of a job's --grid against higgsfield01's cut frames.
usage: /usr/bin/python3 -B tools/grid_check.py JOB_DIR CUTS_JSON GRID_TXT [OUT_TXT]
GRID_TXT is the captured stdout of `lv.mjs --job JOB_DIR --grid` (its time column); JOB_DIR/out/main/timeline.json holds
the exact boundaries. Exit 0 = every start equals hf01's frame, 1 = a mismatch."""
import json, re, sys
job, cuts_json, grid_txt = sys.argv[1:4]
out_txt = sys.argv[4] if len(sys.argv) > 4 else None
grid = open(grid_txt, encoding='utf-8').read()
tl = json.load(open(job + '/out/main/timeline.json', encoding='utf-8'))
cj = json.load(open(cuts_json, encoding='utf-8'))
ref = [0] + [c['n'] for c in cj['cuts']]
labels = ['start'] + [c['label'] for c in cj['cuts']]
total = cj['frames']
rows = [l for l in grid.splitlines() if re.match(r'\s+\S+\s+\S+\s+\d+:\d+\.\d+[–-]', l)]
out = ['# Grid check: %s shot boundaries vs higgsfield01 cut frames (%s)' % (job, cuts_json),
       '# Command: node ~/.claude/skills/product-launch-sting/video/lv.mjs --job %s --grid' % job,
       '# Per shot: hf01 first frame n | --grid time column start (s) x30 | timeline.json exact start (s) x30 | --grid start column',
       '# (30-fps frame) | length in frames vs hf01. PASS = the printed time x30 is within its 2-decimal precision of n',
       '# (<= 0.15 f), the exact start x30 equals n (< 0.001 f), the start column equals n and the length equals hf01\'s.']
ok = 0
if len(rows) != len(ref) or len(tl['shots']) != len(ref):
    out.append('MISMATCH: %d grid rows / %d timeline shots vs %d hf01 shots' % (len(rows), len(tl['shots']), len(ref)))
for i, (r, s) in enumerate(zip(rows, tl['shots'])):
    m = re.match(r'\s+(\S+)\s+\S+\s+(\d+):(\d+\.\d+)[–-](\d+):(\d+\.\d+)\s+f(\d+)', r)
    sid, tg, f30 = m.group(1), int(m.group(2)) * 60 + float(m.group(3)), int(m.group(6))
    n = ref[i]; nlen = (ref[i + 1] if i + 1 < len(ref) else total) - n
    slen = round((s['end'] - s['start']) * 30, 4)
    good = abs(tg * 30 - n) <= .15 and abs(s['start'] * 30 - n) < .001 and f30 == n and abs(slen - nlen) < .001 and sid == s['id']
    ok += good
    out.append('%-4s n%-5d grid %8.2fs -> %8.2f f | exact %9.5fs -> %9.4f f | start f%-5d | len %g f (hf01 %d) | %s  %s'
               % (sid, n, tg, tg * 30, s['start'], s['start'] * 30, f30, slen, nlen, 'EXACT' if good else 'MISMATCH', labels[i]))
end_ok = abs(tl['dur'] * 30 - total) < .001
out.append('END   film end %.5fs -> %.4f f (hf01 %d f) | %s' % (tl['dur'], tl['dur'] * 30, total, 'EXACT' if end_ok else 'MISMATCH'))
passed = ok == len(ref) and end_ok and len(rows) == len(ref)
out.append('RESULT: %s — %d/%d shot starts on hf01\'s frame (%d cuts + frame 0), film length %s.'
           % ('PASS' if passed else 'FAIL', ok, len(ref), len(ref) - 1, '%d/%d f' % (round(tl['dur'] * 30), total)))
txt = '\n'.join(out) + '\n'
print(txt)
if out_txt:
    open(out_txt, 'w', encoding='utf-8').write(txt)
sys.exit(0 if passed else 1)
