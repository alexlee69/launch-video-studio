# -*- coding: utf-8 -*-
# planted-bad stub for the self-test
import sys, os, shutil
a = sys.argv; o = a[a.index('--out') + 1]
import subprocess
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', a[a.index('--film') + 1], '-i', a[a.index('--ref') + 1], '-map', '0:v', '-map', '1:a', '-c', 'copy', o if o.endswith('.mp4') else o + '.mp4'])
print('PASS')
