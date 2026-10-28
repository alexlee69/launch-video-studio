# cmpdirs.py A B [glob] — byte-compare same-named PNGs in two folders; for differing ones print max |Δ| and px over 2
import sys, os, glob, subprocess, hashlib
A, B = sys.argv[1], sys.argv[2]; pat = sys.argv[3] if len(sys.argv) > 3 else '*.png'
def rgb(p):
    w, h = map(int, subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', p], capture_output=True, text=True).stdout.strip().split(','))
    return subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout, w, h
same, diff = 0, []
names = sorted(os.path.relpath(p, A) for p in glob.glob(os.path.join(A, pat), recursive=True))
for n in names:
    b = os.path.join(B, n)
    if not os.path.exists(b): diff.append((n, 'missing')); continue
    if open(os.path.join(A, n), 'rb').read() == open(b, 'rb').read(): same += 1; continue
    x, w, h = rgb(os.path.join(A, n)); y, _, _ = rgb(b)
    if len(x) != len(y): diff.append((n, 'size')); continue
    mx = 0; over = 0
    for i in range(0, len(x)):
        d = abs(x[i] - y[i])
        if d > mx: mx = d
        if d > 2: over += 1
    diff.append((n, f'max {mx}, {over} channels > 2'))
print(f'{same}/{len(names)} byte-identical')
for n, why in diff: print('  DIFF', n, why)
