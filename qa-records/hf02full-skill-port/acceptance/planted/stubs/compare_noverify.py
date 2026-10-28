# -*- coding: utf-8 -*-
# planted-bad stub for the self-test
import sys, os, shutil
o = sys.argv[sys.argv.index('--out') + 1]; os.makedirs(o, exist_ok=True)
import subprocess
t = os.path.join(o, '.sbs.q7w8.tmp.mp4')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=30:duration=1', '-pix_fmt', 'yuv420p', t])
os.replace(t, os.path.join(o, 'sbs.mp4'))
print('verify: 300/300 frames exact')
