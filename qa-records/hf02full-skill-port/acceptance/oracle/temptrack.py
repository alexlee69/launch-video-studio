# -*- coding: utf-8 -*-
# ORACLE (harness-only): DESIGN.md §B temptrack.py — our picture + the reference's own audio, stream-copied, private.
#   python3 temptrack.py --film OURS.mp4 --ref REF.mp4 --out NAME[-tempmusic-PRIVATE.mp4]
# exit 0 PASS · 1 verification mismatch · 2 bad input (lengths differ by more than a frame)
import sys, os, re, json, subprocess

a = sys.argv[1:]
def opt(k, d=None):
    return a[a.index(k) + 1] if k in a else d
film, ref, name = opt('--film'), opt('--ref'), opt('--out')
if not (film and ref and name): print('usage: temptrack.py --film OURS.mp4 --ref REF.mp4 --out NAME'); sys.exit(2)
SUF = '-tempmusic-PRIVATE.mp4'
base = re.sub(r'(-tempmusic-PRIVATE)?\.mp4$', '', name)
out = base + SUF
def vinfo(p):
    j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=duration,r_frame_rate', '-of', 'json', p], capture_output=True, text=True).stdout)['streams'][0]
    n, d = j['r_frame_rate'].split('/'); return float(j['duration']), float(n) / float(d)
(df, ff_), (dr, fr) = vinfo(film), vinfo(ref)
if abs(df - dr) > 1.0 / ff_ + 1e-3:
    print('✗ %s is %.3f s and %s is %.3f s (%.1f frames apart): a temp track only fits a cut of the same length' % (film, df, ref, dr, (df - dr) * ff_)); sys.exit(2)
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', film, '-i', ref, '-map', '0:v', '-map', '1:a', '-c', 'copy',
                '-metadata', 'title=TEMP MUSIC — PRIVATE review copy (the reference\'s own audio)', '-metadata', 'comment=private temp track for review only, never a deliverable', out], check=True)
def md5(p, sel, copy):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-map', sel] + (['-c', 'copy'] if copy else []) + ['-f', 'md5', '-'], capture_output=True, text=True).stdout
    return r.strip().split('=')[-1]
def start(p):
    s = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=start_pts,start_time', '-of', 'json', p], capture_output=True, text=True).stdout)['streams'][0]
    return s.get('start_pts'), s.get('start_time')
bad = []
if md5(out, '0:a', False) != md5(ref, '0:a', False): bad.append('decoded audio differs from the reference')
if md5(out, '0:v', True) != md5(film, '0:v', True): bad.append('video packets differ from ours')
if start(out) != start(ref): bad.append('audio start %s ≠ reference %s' % (start(out), start(ref)))
if bad: print('FAIL ' + '; '.join(bad)); sys.exit(1)
print('PASS %s: our picture + the reference audio (bit-identical). PRIVATE: for your own review only — never a deliverable, never send it on.' % out)
