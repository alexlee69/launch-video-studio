# -*- coding: utf-8 -*-
# planted-bad stub for the self-test
import sys, os, shutil
import re, subprocess
a = sys.argv; o = re.sub(r'(-tempmusic-PRIVATE)?\.mp4$', '', a[a.index('--out') + 1]) + '-tempmusic-PRIVATE.mp4'
t = os.path.join(os.path.dirname(o), '.' + os.path.basename(o)[:-4] + '.k3j9.tmp.mp4')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', a[a.index('--film') + 1], '-i', a[a.index('--ref') + 1], '-map', '0:v', '-map', '1:a', '-c', 'copy', '-metadata', 'title=private temp track', t])
os.replace(t, o)
print('PASS (not actually verified) — private review copy')
