# -*- coding: utf-8 -*-
# ORACLE (harness-only): DESIGN.md §B compare.py, minimal — side-by-side composed by frame index + verify, cut report,
# sheet. Used to prove the compare checks can PASS.
#   python3 compare.py --ref REF.mp4 --ours OURS.mp4 --out DIR [--from S] [--to S] [--half] [--audio ref|ours|none]
#                      [--label-ref T] [--label-ours T] [--cuts-from breakdown.json] [--no-video]
# exit 0 ok · 1 side-by-side verify mismatch · 2 bad input (fps differ)
import os, sys, json, math, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont

a = sys.argv[1:]
def opt(k, d=None):
    return a[a.index(k) + 1] if k in a else d
ref, ours, out = opt('--ref'), opt('--ours'), opt('--out')
os.makedirs(out, exist_ok=True)
def probe(p):
    j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'json', p], capture_output=True, text=True).stdout)['streams'][0]
    n, d = j['r_frame_rate'].split('/'); return int(j['width']), int(j['height']), float(n) / float(d)
(Wr, Hr, fr), (Wo, Ho, fo) = probe(ref), probe(ours)
K = int(round(fo / fr)) if fo > fr else 1                  # ours at an exact integer multiple: our frame K·i ↔ reference frame i
if abs(fr * K - fo) > 1e-3: print('✗ the reference is %g fps and ours %g fps: conform ours to %g fps first' % (fr, fo, fr)); sys.exit(2)
def frames(p, W, H_, w, h, fmt='rgb24'):
    c = 3 if fmt == 'rgb24' else 1; step = K if p == ours else 1
    pr = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', p, '-map', '0:v:0', '-fps_mode', 'passthrough', '-vf', 'scale=%d:%d' % (w, h), '-f', 'rawvideo', '-pix_fmt', fmt, '-'], stdout=subprocess.PIPE)
    k = 0
    while True:
        b = pr.stdout.read(w * h * c)
        if len(b) < w * h * c: break
        if k % step == 0: yield np.frombuffer(b, np.uint8).reshape(h, w, c) if c > 1 else np.frombuffer(b, np.uint8).reshape(h, w)
        k += 1
TW, TH = 270, 152
R = np.array(list(frames(ref, Wr, Hr, TW, TH, 'gray')), np.float32); O = np.array(list(frames(ours, Wo, Ho, TW, TH, 'gray')), np.float32)
a0 = int(round(float(opt('--from', 0)) * fr)); b0 = min(len(R), len(O)) if opt('--to') is None else min(len(R), len(O), int(round(float(opt('--to')) * fr)))
if len(R) != len(O): print('lengths differ (reference %d frames, ours %d): comparing the overlap, frames %d–%d' % (len(R), len(O), a0, b0 - 1))
def ncc(x, y):
    x = x - x.mean(); y = y - y.mean(); return float((x * y).sum() / (math.sqrt((x * x).sum() * (y * y).sum()) + 1e-6))
def series(F):
    s = np.zeros(len(F))
    for n in range(1, len(F)): s[n] = max(0.0, 1 - ncc(F[n], F[n - 1])) + float(np.abs(F[n] - F[n - 1]).mean()) / 30
    return s
sr, so = series(R), series(O)
if opt('--cuts-from'):
    bd = json.load(open(opt('--cuts-from'), encoding='utf-8')); cuts = [int(s['startFrame']) for s in bd['shots'][1:]]
else:
    cuts = []
    for n in range(1, len(sr)):
        nb = np.r_[sr[max(1, n - 8):n], sr[n + 1:n + 9]]
        if sr[n] > max(.35, 4 * float(np.median(nb)) if len(nb) else 0) and sr[n] >= sr[max(0, n - 1)] and sr[n] >= sr[min(len(sr) - 1, n + 1)] and (not cuts or n - cuts[-1] > 3): cuts.append(n)
cuts = [c for c in cuts if a0 < c < b0]
bounds = [a0] + cuts + [b0]
blank = lambda i0, i1: float(O[(i0 + i1) // 2].std()) < 4 if i1 > i0 else False
rows = []
for k, c in enumerate(cuts):
    win = [n for n in range(c - 4, c + 5) if a0 < n < b0]
    p = max(win, key=lambda n: so[n]); d = p - c
    st = 'missing' if so[p] < .25 else 'exact' if d == 0 else '±1' if abs(d) == 1 else 'off'
    rows.append({'n': c, 'ours_n': p, 'offset': d, 'status': st, 'strength': round(float(so[p]), 3), 'trivial': blank(bounds[k], c) or blank(c, bounds[k + 2])})
cnt = {s: sum(r['status'] == s for r in rows) for s in ('exact', '±1', 'off', 'missing')}
offs = ', '.join('n%d %+d f' % (r['n'], r['offset']) for r in rows if r['status'] == 'off')
line = 'cuts: %d in the reference — %d exact, %d within 1 f, %d off%s, %d missing' % (len(rows), cnt['exact'], cnt['±1'], cnt['off'], ' (%s)' % offs if offs else '', cnt['missing'])
json.dump({'ref': ref, 'ours': ours, 'fps': fr, 'range': [a0, b0], 'cuts': rows, 'summary': line}, open(os.path.join(out, 'cuts.json'), 'w', encoding='utf-8'), indent=1)
with open(os.path.join(out, 'cuts.md'), 'w', encoding='utf-8') as f:
    f.write('| ref cut | ours | offset | status | trivial |\n|---|---|---|---|---|\n' + ''.join('| n%d | n%d | %+d | %s | %s |\n' % (r['n'], r['ours_n'], r['offset'], r['status'], 'yes' if r['trivial'] else '') for r in rows) + '\n' + line + '\n')
print(line)
# sheet: every reference shot's middle frame, reference over ours
try: FONT = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 14)
except Exception: FONT = ImageFont.load_default()
SW, SH = 240, 135; cols = 6; shots = list(zip(bounds[:-1], bounds[1:])); rws = (len(shots) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (SW + 8) + 8, rws * (2 * SH + 30) + 8), (24, 23, 28)); d = ImageDraw.Draw(sheet)
RF = list(frames(ref, Wr, Hr, SW, SH)); OF = list(frames(ours, Wo, Ho, SW, SH))
for i, (s0, s1) in enumerate(shots):
    m = (s0 + s1) // 2; x, y = 8 + (i % cols) * (SW + 8), 8 + (i // cols) * (2 * SH + 30)
    d.text((x, y), 'shot %d  n%d  %d:%05.2f' % (i + 1, m, int(m / fr // 60), m / fr % 60), font=FONT, fill=(240, 240, 240))
    sheet.paste(Image.fromarray(RF[m]), (x, y + 20)); sheet.paste(Image.fromarray(OF[m]), (x, y + 22 + SH))
sheet.save(os.path.join(out, 'sheet.png'))
if '--no-video' in a: sys.exit(0)
# side-by-side, composed by frame index (never hstack), then verified frame by frame
half = '--half'in a; Hs = Hr; wl, wr = Wr, int(round(Wo * Hs / Ho)) // 2 * 2
name = os.path.join(out, 'sbs-half.mp4' if half else 'sbs.mp4')
aud = opt('--audio', 'none')
cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (wl + wr, Hs), '-framerate', '%g' % fr, '-i', '-']
if aud in ('ref', 'ours'): cmd += ['-ss', '%.4f' % (a0 / fr), '-i', ref if aud == 'ref' else ours]
cmd += ['-map', '0:v'] + (['-map', '1:a', '-c:a', 'aac', '-shortest'] if aud in ('ref', 'ours') else []) + ['-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', name]
enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
lab = Image.new('RGB', (1, 1))
for i, (fa, fb) in enumerate(zip(frames(ref, Wr, Hr, Wr, Hr), frames(ours, Wo, Ho, wr, Hs))):
    if i < a0: continue
    if i >= b0: break
    im = Image.fromarray(np.concatenate([fa, fb], 1)); dr = ImageDraw.Draw(im)
    for x0, t in ((0, opt('--label-ref', 'reference')), (wl, opt('--label-ours', 'ours'))):
        dr.rectangle((x0 + 8, 8, x0 + 16 + 9 * len(t), 30), fill=(0, 0, 0)); dr.text((x0 + 12, 12), t, font=FONT, fill=(255, 255, 255))
    b = im.tobytes()
    for _ in range(2 if half else 1): enc.stdin.write(b)
enc.stdin.close(); assert enc.wait() == 0
VW, VH = 96, 54
Sv = np.array(list(frames(name, wl + wr, Hs, 2 * VW, VH, 'gray')), np.float32)[:, int(VH * .42):]
tR = [np.asarray(Image.fromarray(R[n].astype(np.uint8)).resize((VW, VH), Image.BILINEAR), np.float32)[int(VH * .42):] for n in range(len(R))]
tO = [np.asarray(Image.fromarray(O[n].astype(np.uint8)).resize((VW, VH), Image.BILINEAR), np.float32)[int(VH * .42):] for n in range(len(O))]
bad = 0; N = len(Sv)
for j in range(N):
    i = a0 + (j // 2 if half else j); ok = True
    for sl, T in ((slice(0, VW), tR), (slice(VW, 2 * VW), tO)):
        c = {k: float(np.abs(Sv[j][:, sl] - T[k]).mean()) for k in (i - 1, i, i + 1) if 0 <= k < len(T)}
        best = min(c, key=c.get)
        if best != i and c[i] - c[best] > .5 and np.abs(T[best] - T[i]).mean() >= 1.5: ok = False
    bad += not ok
print('verify: %d/%d frames exact → %s' % (N - bad, N, name))
sys.exit(1 if bad else 0)
