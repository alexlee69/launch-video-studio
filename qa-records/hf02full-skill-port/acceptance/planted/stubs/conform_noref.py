# -*- coding: utf-8 -*-
# planted-bad stub for the self-test
import sys, os, shutil
out = [x for x in sys.argv[1:] if x.endswith('.mp4')][1]
shutil.copyfile(sys.argv[1], out)
print('ok')
